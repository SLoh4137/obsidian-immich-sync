import { Editor, MarkdownView, Menu, Notice } from "obsidian";
import ImmichSyncPlugin from "../main";
import { uploadImagesToImmich } from "./upload-command";

const ICON = "image-up";
const LABEL = "Upload images to Immich";

export function registerUploadEntryPoints(plugin: ImmichSyncPlugin): void {
	plugin.registerEvent(
		plugin.app.workspace.on("editor-menu", (menu: Menu, editor: Editor) => {
			menu.addItem((item) =>
				item
					.setTitle(LABEL)
					.setIcon(ICON)
					.onClick(() => {
						void uploadImagesToImmich(plugin, editor);
					}),
			);
		}),
	);

	plugin.addCommand({
		id: "upload-images-to-immich",
		name: "Upload images to Immich",
		editorCallback: (editor: Editor) => {
			void uploadImagesToImmich(plugin, editor);
		},
	});

	plugin.addRibbonIcon(ICON, LABEL, async () => {
		const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (view === null) {
			new Notice("Open a note before uploading to Immich");
			return;
		}
		await uploadImagesToImmich(plugin, view.editor);
	});
}
