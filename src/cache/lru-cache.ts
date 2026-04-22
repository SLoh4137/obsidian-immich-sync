import { normalizePath } from "obsidian";
import ImmichSyncPlugin from "../main";

interface CacheEntry {
	hash: string;
	sizeBytes: number;
	lastAccessMs: number;
}

export type SerializedCacheIndex = CacheEntry[];

const BYTES_PER_MB = 1024 * 1024;

export class LruCache {
	// Invariant: ordered by `lastAccessMs` ascending (oldest first, newest last).
	private entries: CacheEntry[] = [];
	private dirEnsured = false;

	constructor(private plugin: ImmichSyncPlugin) {}

	hydrate(data: SerializedCacheIndex | undefined): void {
		this.entries = (data ?? []).slice().sort((a, b) => a.lastAccessMs - b.lastAccessMs);
		this.dirEnsured = false;
	}

	toJSON(): SerializedCacheIndex {
		return this.entries.slice();
	}

	async get(hash: string): Promise<string | null> {
		const idx = this.entries.findIndex((e) => e.hash === hash);
		if (idx === -1) {
			return null;
		}
		const path = this.filePath(hash);
		if (!(await this.plugin.app.vault.adapter.exists(path))) {
			// File missing on disk — drop the stale index entry.
			this.entries.splice(idx, 1);
			this.plugin.schedulePersist();
			return null;
		}
		const entry = this.entries.splice(idx, 1)[0]!;
		entry.lastAccessMs = Date.now();
		this.entries.push(entry);
		this.plugin.schedulePersist();
		return path;
	}

	async put(hash: string, buffer: ArrayBuffer): Promise<string> {
		await this.ensureDir();
		const path = this.filePath(hash);
		await this.plugin.app.vault.adapter.writeBinary(path, buffer);

		const existingIdx = this.entries.findIndex((e) => e.hash === hash);
		if (existingIdx !== -1) {
			this.entries.splice(existingIdx, 1);
		}
		this.entries.push({
			hash,
			sizeBytes: buffer.byteLength,
			lastAccessMs: Date.now(),
		});

		await this.evictIfNeeded();
		this.plugin.schedulePersist();
		return path;
	}

	async clear(): Promise<void> {
		const adapter = this.plugin.app.vault.adapter;
		for (const entry of this.entries) {
			try {
				await adapter.remove(this.filePath(entry.hash));
			} catch {
				// Ignore — file may already be gone.
			}
		}
		this.entries = [];
		this.plugin.schedulePersist();
	}

	private async evictIfNeeded(): Promise<void> {
		const maxBytes = this.plugin.settings.maxCacheSizeMb * BYTES_PER_MB;
		let total = this.entries.reduce((sum, e) => sum + e.sizeBytes, 0);
		const adapter = this.plugin.app.vault.adapter;
		while (total > maxBytes && this.entries.length > 0) {
			const oldest = this.entries.shift()!;
			total -= oldest.sizeBytes;
			try {
				await adapter.remove(this.filePath(oldest.hash));
			} catch {
				// Ignore — file may already be gone.
			}
		}
	}

	private filePath(hash: string): string {
		return normalizePath(`${this.cacheDir()}/${hashToFilename(hash)}`);
	}

	private cacheDir(): string {
		return normalizePath(
			`${this.plugin.app.vault.configDir}/plugins/${this.plugin.manifest.id}/cache`,
		);
	}

	private async ensureDir(): Promise<void> {
		if (this.dirEnsured) return;
		const adapter = this.plugin.app.vault.adapter;
		const dir = this.cacheDir();
		if (!(await adapter.exists(dir))) {
			await adapter.mkdir(dir);
		}
		this.dirEnsured = true;
	}
}

// Convert base64 to base64url so the hash is filesystem-safe.
function hashToFilename(hash: string): string {
	return hash.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
