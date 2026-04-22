import { Editor, Notice, arrayBufferToBase64 } from "obsidian";
import ImmichSyncPlugin from "../main";
import { CODEBLOCK_LANG } from "../types";
import { pickImages } from "./picker";

export async function uploadImagesToImmich(
	plugin: ImmichSyncPlugin,
	editor: Editor
): Promise<void> {
	const files = await pickImages();
	if (files.length === 0) {
		return;
	}

	const hashes: string[] = [];
	for (const file of files) {
		const buffer = await file.arrayBuffer();
		const hash = await sha1Base64(buffer);
		hashes.push(hash);

		// Disabled for now until we can handle HEIC files
		// if (plugin.settings.enableLocalCache) {
		// 	await plugin.cache.put(hash, buffer, plugin.settings.fullResolution);
		// }
	}

	const block = "```" + CODEBLOCK_LANG + "\n" + hashes.join("\n") + "\n```\n";
	editor.replaceSelection(block);

	new Notice(
		`Inserted ${hashes.length} Immich hash${
			hashes.length === 1 ? "" : "es"
		}`
	);
}

async function sha1Base64(buffer: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-1", buffer);
	return arrayBufferToBase64(digest);
}
