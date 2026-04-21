import MyPlugin from "../main";
import { CODEBLOCK_LANG } from "../types";

export function registerCodeblockProcessor(plugin: MyPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor(CODEBLOCK_LANG, async (source, el) => {
		const hashes = source
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0);

		for (const hash of hashes) {
			const container = el.createDiv({ cls: "immich-sync-image" });
			void renderHash(plugin, container, hash);
		}
	});
}

async function renderHash(plugin: MyPlugin, container: HTMLElement, hash: string): Promise<void> {
	try {
		const src = await resolveImageSrc(plugin, hash);
		if (src === null) {
			renderError(container, `No Immich asset found for hash ${hash}`);
			return;
		}
		const img = container.createEl("img");
		img.src = src;
		img.alt = hash;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		renderError(container, `Failed to load ${hash}: ${message}`);
	}
}

async function resolveImageSrc(plugin: MyPlugin, hash: string): Promise<string | null> {
	if (plugin.settings.enableLocalCache) {
		const cachedPath = await plugin.cache.get(hash);
		if (cachedPath !== null) {
			return plugin.app.vault.adapter.getResourcePath(cachedPath);
		}
	}

	const assetId = await resolveAssetId(plugin, hash);
	if (assetId === null) {
		return null;
	}

	if (plugin.settings.enableLocalCache) {
		const buffer = await plugin.client.fetchAssetBytes(assetId, plugin.settings.fullResolution);
		const writtenPath = await plugin.cache.put(hash, buffer);
		return plugin.app.vault.adapter.getResourcePath(writtenPath);
	}

	return plugin.client.directUrl(assetId, plugin.settings.fullResolution);
}

async function resolveAssetId(plugin: MyPlugin, hash: string): Promise<string | null> {
	const cached = plugin.hashMap.get(hash);
	if (cached !== undefined) {
		return cached;
	}
	const assetId = await plugin.client.lookupAssetIdByHash(hash);
	if (assetId !== null) {
		await plugin.hashMap.set(hash, assetId);
	}
	return assetId;
}

function renderError(container: HTMLElement, message: string): void {
	container.empty();
	container.createDiv({ cls: "immich-sync-error", text: message });
}
