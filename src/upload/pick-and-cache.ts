import { arrayBufferToBase64 } from "obsidian";
import ImmichSyncPlugin from "../main";
import { convertHeicToJpeg, isHeic } from "./heic";
import { pickImages } from "./picker";

export async function pickAndCacheImages(
	plugin: ImmichSyncPlugin
): Promise<string[]> {
	const files = await pickImages();
	if (files.length === 0) {
		return [];
	}

	const hashes: string[] = [];
	for (const file of files) {
		const buffer = await file.arrayBuffer();
		const hash = await sha1Base64(buffer);
		hashes.push(hash);

		if (plugin.settings.enableLocalCache) {
			// Transcode HEIC → JPEG only if the user opted in. Otherwise
			// store the original bytes (the hash stays SHA-1 of the original
			// either way, so Immich's checksum lookup still resolves).
			const cacheBytes =
				plugin.settings.convertHeicOnUpload && isHeic(buffer)
					? await convertHeicToJpeg(buffer)
					: buffer;
			await plugin.cache.put(
				hash,
				cacheBytes,
				plugin.settings.fullResolution
			);
		}
	}
	return hashes;
}

async function sha1Base64(buffer: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-1", buffer);
	return arrayBufferToBase64(digest);
}
