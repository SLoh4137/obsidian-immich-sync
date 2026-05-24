import ImmichSyncPlugin from "../main";
import { CODEBLOCK_LANG } from "../types";
import { ImageModal, ModalImage } from "./image-modal";
import { resolveImageSrc } from "./image-source";

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

function renderError(container: HTMLElement, message: string): void {
	container.empty();
	container.createDiv({ cls: "immich-sync-error", text: message });
}
