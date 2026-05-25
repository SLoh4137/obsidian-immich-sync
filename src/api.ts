import { gps } from "exifr";
import { FileSystemAdapter } from "obsidian";
import ImmichSyncPlugin from "./main";

export interface LatLng {
	latitude: number;
	longitude: number;
}

export class ImmichSyncApi {
	constructor(private plugin: ImmichSyncPlugin) {}

	async getLatLng(hash: string): Promise<LatLng | null> {
		const fromCache = await this.readLatLngFromCachedImage(hash);
		if (fromCache !== null) return fromCache;
		return this.readLatLngFromImmich(hash);
	}

	private async readLatLngFromCachedImage(
		hash: string,
	): Promise<LatLng | null> {
		// Try fullsize first — thumbnails typically have GPS EXIF stripped.
		for (const fullRes of [true, false]) {
			const path = await this.plugin.cache.get(hash, fullRes);
			if (path === null) continue;
			try {
				const input = await this.exifrInput(path);
				const result = await gps(input);
				if (
					result &&
					typeof result.latitude === "number" &&
					typeof result.longitude === "number"
				) {
					return {
						latitude: result.latitude,
						longitude: result.longitude,
					};
				}
			} catch {
				// Fall through to the next strategy.
			}
		}
		return null;
	}

	// On desktop, hand exifr the absolute filesystem path so it can chunk-read
	// only the EXIF header instead of loading the full image into memory.
	// On mobile the adapter isn't filesystem-backed, so fall back to the bytes.
	private async exifrInput(
		vaultPath: string,
	): Promise<string | ArrayBuffer> {
		const adapter = this.plugin.app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			return adapter.getFullPath(vaultPath);
		}
		return adapter.readBinary(vaultPath);
	}

	private async readLatLngFromImmich(
		hash: string,
	): Promise<LatLng | null> {
		let assetId = this.plugin.hashMap.get(hash);
		if (assetId === undefined) {
			const looked = await this.plugin.client.lookupAssetIdByHash(hash);
			if (looked === null) return null;
			this.plugin.hashMap.set(hash, looked);
			assetId = looked;
		}
		return this.plugin.client.fetchAssetLatLng(assetId);
	}
}
