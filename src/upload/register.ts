import { Editor, MarkdownView, Menu, Notice, TFile } from "obsidian";
import ImmichSyncPlugin from "../main";
import { addImagesToImmichBlock } from "./upload-command";
import { openBannerEditModal } from "./banner-edit-command";

const UPLOAD_ICON = "image-up";
const UPLOAD_LABEL = "Add images to note";
const BANNER_ICON = "panel-top";
const BANNER_LABEL = "Edit banner images";

export function registerUploadEntryPoints(plugin: ImmichSyncPlugin): void {
	plugin.registerEvent(
		plugin.app.workspace.on(
			"editor-menu",
			(menu: Menu, editor: Editor, view: MarkdownView) => {
				menu.addItem((item) =>
					item
						.setTitle(UPLOAD_LABEL)
						.setIcon(UPLOAD_ICON)
						.onClick(() => {
							void addImagesToImmichBlock(plugin, editor);
						})
				);
				const file = view.file;
				if (file !== null) {
					menu.addItem((item) =>
						item
							.setTitle(BANNER_LABEL)
							.setIcon(BANNER_ICON)
							.onClick(() => {
								void openBannerEditModal(plugin, file);
							})
					);
				}
			}
		)
	);

	plugin.addCommand({
		id: "upload-images-to-immich",
		name: "Upload images to Immich",
		editorCallback: (editor: Editor) => {
			void addImagesToImmichBlock(plugin, editor);
		},
	});

	plugin.addCommand({
		id: "edit-immich-banner-images",
		name: "Edit Immich banner images",
		editorCallback: (_editor: Editor, view: MarkdownView) => {
			const file = view.file;
			if (file === null) {
				new Notice("Open a note before editing banner images");
				return;
			}
			void openBannerEditModal(plugin, file);
		},
	});

	plugin.addRibbonIcon(UPLOAD_ICON, UPLOAD_LABEL, async () => {
		const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (view === null) {
			new Notice("Open a note before uploading to Immich");
			return;
		}
		await addImagesToImmichBlock(plugin, view.editor);
	});

	plugin.addRibbonIcon(BANNER_ICON, BANNER_LABEL, async () => {
		const file = activeFile(plugin);
		if (file === null) {
			new Notice("Open a note before editing banner images");
			return;
		}
		await openBannerEditModal(plugin, file);
	});
}

function activeFile(plugin: ImmichSyncPlugin): TFile | null {
	return plugin.app.workspace.getActiveViewOfType(MarkdownView)?.file ?? null;
}
