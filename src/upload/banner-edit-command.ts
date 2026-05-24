import { App, EventRef, Modal, Notice, TFile, setIcon } from "obsidian";
import ImmichSyncPlugin from "../main";
import { FRONTMATTER_KEY, extractHashes } from "../render/banner";
import { resolveImageSrc } from "../render/image-source";
import { pickAndCacheImages } from "./pick-and-cache";

export async function openBannerEditModal(
	plugin: ImmichSyncPlugin,
	file: TFile,
): Promise<void> {
	new BannerEditModal(plugin, file).open();
}

class BannerEditModal extends Modal {
	private gridEl: HTMLElement | null = null;
	private emptyEl: HTMLElement | null = null;
	private metadataRef: EventRef | null = null;

	constructor(private plugin: ImmichSyncPlugin, private file: TFile) {
		super(plugin.app);
	}

	onOpen(): void {
		this.modalEl.addClass("immich-sync-banner-editor");
		this.titleEl.setText("Edit Immich banner images");

		const toolbar = this.contentEl.createDiv({
			cls: "immich-sync-banner-editor-toolbar",
		});
		const addBtn = toolbar.createEl("button", {
			cls: "mod-cta",
			text: "Add images",
		});
		addBtn.addEventListener("click", () => void this.handleAdd());

		this.gridEl = this.contentEl.createDiv({
			cls: "immich-sync-banner-editor-grid",
		});
		this.emptyEl = this.contentEl.createDiv({
			cls: "immich-sync-banner-editor-empty",
			text: "No banner images yet. Use Add images to upload some.",
		});

		this.metadataRef = this.plugin.app.metadataCache.on(
			"changed",
			(file) => {
				if (file.path === this.file.path) this.render();
			},
		);

		this.render();
	}

	onClose(): void {
		if (this.metadataRef !== null) {
			this.plugin.app.metadataCache.offref(this.metadataRef);
			this.metadataRef = null;
		}
		this.contentEl.empty();
	}

	private currentHashes(): string[] {
		const fm =
			this.plugin.app.metadataCache.getFileCache(this.file)?.frontmatter;
		return extractHashes(fm?.[FRONTMATTER_KEY]);
	}

	private render(): void {
		if (this.gridEl === null || this.emptyEl === null) return;
		this.gridEl.empty();

		const hashes = this.currentHashes();
		this.emptyEl.toggle(hashes.length === 0);
		this.gridEl.toggle(hashes.length > 0);

		hashes.forEach((hash, index) => {
			this.renderThumb(this.gridEl!, hash, index);
		});
	}

	private renderThumb(
		grid: HTMLElement,
		hash: string,
		index: number,
	): void {
		const item = grid.createDiv({ cls: "immich-sync-banner-editor-item" });
		const img = item.createEl("img", {
			attr: { alt: hash },
		});
		void resolveImageSrc(this.plugin, hash)
			.then((src) => {
				if (src !== null) img.src = src;
			})
			.catch(() => {
				/* leave placeholder */
			});

		const removeBtn = item.createEl("button", {
			cls: "immich-sync-banner-editor-remove",
			attr: { "aria-label": "Remove image" },
		});
		setIcon(removeBtn, "x");
		removeBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			new ConfirmRemoveModal(this.app, () => {
				void this.handleRemove(index);
			}).open();
		});
	}

	private async handleAdd(): Promise<void> {
		const newHashes = await pickAndCacheImages(this.plugin);
		if (newHashes.length === 0) return;

		await this.plugin.app.fileManager.processFrontMatter(
			this.file,
			(fm: Record<string, unknown>) => {
				const existing = extractHashes(fm[FRONTMATTER_KEY]);
				fm[FRONTMATTER_KEY] = [...existing, ...newHashes];
			},
		);
		new Notice(
			`Added ${newHashes.length} image${
				newHashes.length === 1 ? "" : "s"
			} to banner`,
		);
	}

	private async handleRemove(index: number): Promise<void> {
		await this.plugin.app.fileManager.processFrontMatter(
			this.file,
			(fm: Record<string, unknown>) => {
				const existing = extractHashes(fm[FRONTMATTER_KEY]);
				if (index < 0 || index >= existing.length) return;
				existing.splice(index, 1);
				fm[FRONTMATTER_KEY] = existing;
			},
		);
	}
}

class ConfirmRemoveModal extends Modal {
	constructor(app: App, private onConfirm: () => void) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText("Remove image from banner?");
		this.contentEl.createEl("p", {
			text: "This removes the image from this note's frontmatter. The asset stays in Immich.",
		});

		const buttons = this.contentEl.createDiv({
			cls: "immich-sync-confirm-buttons",
		});
		const cancel = buttons.createEl("button", { text: "Cancel" });
		cancel.addEventListener("click", () => this.close());

		const remove = buttons.createEl("button", {
			cls: "mod-warning",
			text: "Remove",
		});
		remove.addEventListener("click", () => {
			this.close();
			this.onConfirm();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
