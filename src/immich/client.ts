import {
	AssetMediaSize,
	getAssetInfo,
	init,
	searchAssets,
	viewAsset,
} from "@immich/sdk";
import ImmichSyncPlugin from "../main";

export interface AssetLatLng {
	latitude: number;
	longitude: number;
}

export class ImmichClient {
	constructor(private plugin: ImmichSyncPlugin) {}

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
				? AssetMediaSize.Fullsize
				: AssetMediaSize.Thumbnail,
		});

		return blob.arrayBuffer();
	}

	async fetchAssetLatLng(assetId: string): Promise<AssetLatLng | null> {
		const asset = await getAssetInfo({ id: assetId });
		const lat = asset.exifInfo?.latitude;
		const lng = asset.exifInfo?.longitude;
		if (typeof lat !== "number" || typeof lng !== "number") {
			return null;
		}
		return { latitude: lat, longitude: lng };
	}

	private baseUrl(): string {
		return this.plugin.settings.serverUrl.replace(/\/+$/, "");
	}
}
