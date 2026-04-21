import {
	AssetMediaSize,
	getAssetOriginalPath,
	getAssetThumbnailPath,
	init,
	searchAssets,
	viewAsset,
} from "@immich/sdk";
import MyPlugin from "../main";

export class ImmichClient {
	constructor(private plugin: MyPlugin) {}

	reinit(): void {
		init({
			baseUrl: this.baseUrl(),
			apiKey: this.plugin.settings.apiKey,
		});
	}

	async lookupAssetIdByHash(hash: string): Promise<string | null> {
		const response = await searchAssets({
			metadataSearchDto: { checksum: hash, size: 1 },
		});
		return response.assets.items[0]?.id ?? null;
	}

	async fetchAssetBytes(
		assetId: string,
		fullResolution: boolean
	): Promise<ArrayBuffer> {
		const blob = await viewAsset({
			id: assetId,
			size: fullResolution
				? AssetMediaSize.Original
				: AssetMediaSize.Thumbnail,
		});
		return blob.arrayBuffer();
	}

	directUrl(assetId: string, fullResolution: boolean): string {
		const path = fullResolution
			? getAssetOriginalPath(assetId)
			: getAssetThumbnailPath(assetId);
		const apiKey = encodeURIComponent(this.plugin.settings.apiKey);
		return `${this.baseUrl()}${path}?apiKey=${apiKey}`;
	}

	private baseUrl(): string {
		return this.plugin.settings.serverUrl.replace(/\/+$/, "");
	}
}
