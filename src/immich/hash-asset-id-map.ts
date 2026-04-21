import MyPlugin from "../main";

export type SerializedHashAssetIdMap = Record<string, string>;

export class HashAssetIdMap {
	private map = new Map<string, string>();

	constructor(private plugin: MyPlugin) {}

	hydrate(data: SerializedHashAssetIdMap | undefined): void {
		this.map = new Map(Object.entries(data ?? {}));
	}

	toJSON(): SerializedHashAssetIdMap {
		return Object.fromEntries(this.map);
	}

	get(hash: string): string | undefined {
		return this.map.get(hash);
	}

	has(hash: string): boolean {
		return this.map.has(hash);
	}

	async set(hash: string, assetId: string): Promise<void> {
		this.map.set(hash, assetId);
		await this.plugin.savePluginData();
	}
}
