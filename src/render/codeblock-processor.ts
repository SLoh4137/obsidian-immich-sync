import ImmichSyncPlugin from "../main";
import { CODEBLOCK_LANG } from "../types";
import { ImageModal, ModalImage } from "./image-modal";

export function registerCodeblockProcessor(plugin: ImmichSyncPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor(CODEBLOCK_LANG, async (source, el) => {
		const hashes = source
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0);

		const grid = el.createDiv({ cls: "immich-sync-block" });
		const images: ModalImage[] = hashes.map((hash) => ({ hash, src: null }));

		for (const [index, hash] of hashes.entries()) {
			const container = grid.createDiv({ cls: "immich-sync-image" });
			void renderHash(plugin, container, hash, index, images);
		}
	});
}

async function renderHash(
	plugin: ImmichSyncPlugin,
	container: HTMLElement,
	hash: string,
	index: number,
	images: ModalImage[],
): Promise<void> {
	try {
		const src = await resolveImageSrc(plugin, hash);
		if (src === null) {
			renderError(container, `No Immich asset found for hash ${hash}`);
			return;
		}
		images[index]!.src = src;
		const img = container.createEl("img");
		img.src = src;
		img.alt = hash;
		img.addEventListener("click", () => {
			new ImageModal(plugin.app, images, index).open();
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		renderError(container, `Failed to load ${hash}: ${message}`);
	}
}

async function resolveImageSrc(plugin: ImmichSyncPlugin, hash: string): Promise<string | null> {
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

async function resolveAssetId(plugin: ImmichSyncPlugin, hash: string): Promise<string | null> {
	const cached = plugin.hashMap.get(hash);
	if (cached !== undefined) {
		return cached;
	}
	const assetId = await plugin.client.lookupAssetIdByHash(hash);
	if (assetId !== null) {
		plugin.hashMap.set(hash, assetId);
	}
	return assetId;
}

function renderError(container: HTMLElement, message: string): void {
	container.empty();
	container.createDiv({ cls: "immich-sync-error", text: message });
}
