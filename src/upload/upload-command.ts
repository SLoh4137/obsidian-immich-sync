import { Editor, Notice, arrayBufferToBase64 } from "obsidian";
import ImmichSyncPlugin from "../main";
import { CODEBLOCK_LANG } from "../types";
import { convertHeicToJpeg, isHeic } from "./heic";
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

		if (plugin.settings.enableLocalCache) {
			// Browsers can't render HEIC; transcode to JPEG before caching.
			// The hash stays as SHA-1 of the original — that's what matches
			// Immich's checksum on lookup.
			const cacheBytes = isHeic(buffer)
				? await convertHeicToJpeg(buffer)
				: buffer;
			await plugin.cache.put(
				hash,
				cacheBytes,
				plugin.settings.fullResolution
			);
		}
	}

	const enclosing = findEnclosingImmichBlock(editor);
	if (enclosing !== null) {
		// Append into the existing block, just before the closing fence.
		editor.replaceRange(hashes.join("\n") + "\n", {
			line: enclosing.closeLine,
			ch: 0,
		});
	} else {
		const block =
			"```" + CODEBLOCK_LANG + "\n" + hashes.join("\n") + "\n```\n";
		editor.replaceSelection(block);
	}

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

// Returns the line index of the closing ``` if the cursor is currently inside
// an immich-sync codeblock, otherwise null.
function findEnclosingImmichBlock(
	editor: Editor
): { closeLine: number } | null {
	const cursorLine = editor.getCursor().line;

	let openLine = -1;
	for (let i = cursorLine; i >= 0; i--) {
		const fence = parseFence(editor.getLine(i));
		if (fence === null) continue;
		if (fence.lang === CODEBLOCK_LANG) {
			openLine = i;
			break;
		}
		// Any other fence above the cursor means we're either past the end of
		// a different block (closing fence) or inside one (different-language
		// opening fence). Either way, not in an immich-sync block.
		if (i < cursorLine) return null;
	}
	if (openLine === -1) return null;

	const lineCount = editor.lineCount();
	for (let i = openLine + 1; i < lineCount; i++) {
		const fence = parseFence(editor.getLine(i));
		if (fence !== null && fence.lang === "") {
			return { closeLine: i };
		}
	}
	return null;
}

// Cheap fence parser. Returns { lang } for a CommonMark fenced code line, or
// null otherwise. Avoids allocating `.trim()` strings for non-fence lines —
// most prose has no leading backtick so the early exit fires immediately.
function parseFence(line: string): { lang: string } | null {
	const len = line.length;
	let i = 0;
	// CommonMark allows up to 3 spaces of indent before the fence.
	while (i < len && (line.charCodeAt(i) === 32 || line.charCodeAt(i) === 9)) {
		i++;
		if (i > 3) return null;
	}
	// Need ```.
	if (
		i + 2 >= len ||
		line.charCodeAt(i) !== 96 ||
		line.charCodeAt(i + 1) !== 96 ||
		line.charCodeAt(i + 2) !== 96
	) {
		return null;
	}
	// Skip whitespace after ``` and read the first word as the language.
	let start = i + 3;
	while (
		start < len &&
		(line.charCodeAt(start) === 32 || line.charCodeAt(start) === 9)
	)
		start++;
	let end = start;
	while (end < len && line.charCodeAt(end) > 32) end++;
	return { lang: line.substring(start, end) };
}
