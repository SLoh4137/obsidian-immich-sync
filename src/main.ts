import { Debouncer, Plugin, debounce } from "obsidian";
import {
	DEFAULT_SETTINGS,
	ImmichSyncSettings,
	ImmichSyncSettingTab,
} from "./settings";
import {
	HashAssetIdMap,
	SerializedHashAssetIdMap,
} from "./immich/hash-asset-id-map";
import { ImmichClient } from "./immich/client";
import { LruCache, SerializedCacheIndex } from "./cache/lru-cache";
import { registerUploadEntryPoints } from "./upload/register";
import { registerCodeblockProcessor } from "./render/codeblock-processor";

interface PersistedPluginData {
	settings: ImmichSyncSettings;
	hashToAssetId: SerializedHashAssetIdMap;
	cacheIndex: SerializedCacheIndex;
}

const PERSIST_DEBOUNCE_MS = 250;

export default class ImmichSyncPlugin extends Plugin {
	settings: ImmichSyncSettings;
	hashMap: HashAssetIdMap = new HashAssetIdMap(this);
	cache: LruCache = new LruCache(this);
	client: ImmichClient = new ImmichClient(this);

	private debouncedPersist: Debouncer<[], Promise<void>> = debounce(
		() => this.savePluginData(),
		PERSIST_DEBOUNCE_MS,
	);

	async onload() {
		await this.loadSettings();
		this.client.reinit();
		registerUploadEntryPoints(this);
		registerCodeblockProcessor(this);
		this.addSettingTab(new ImmichSyncSettingTab(this.app, this));
	}

	onunload() {
		// Flush any debounced writes. Plugin.onunload is sync, so this is
		// best-effort — the save kicks off but won't block teardown.
		void this.debouncedPersist.run();
	}

	schedulePersist(): void {
		this.debouncedPersist();
	}

	async clearCache(): Promise<void> {
		await this.cache.clear();
	}

	async loadSettings() {
		const data =
			(await this.loadData()) as Partial<PersistedPluginData> | null;
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			data?.settings ?? {},
		);
		this.hashMap.hydrate(data?.hashToAssetId);
		this.cache.hydrate(data?.cacheIndex);
	}

	async saveSettings() {
		await this.savePluginData();
	}

	async savePluginData() {
		const data: PersistedPluginData = {
			settings: this.settings,
			hashToAssetId: this.hashMap.toJSON(),
			cacheIndex: this.cache.toJSON(),
		};
		await this.saveData(data);
	}
}
