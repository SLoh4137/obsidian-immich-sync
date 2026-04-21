import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import ImmichSyncPlugin from "./main";

export interface ImmichSyncSettings {
	serverUrl: string;
	apiKey: string;
	enableLocalCache: boolean;
	fullResolution: boolean;
	maxCacheSizeMb: number;
}

export const DEFAULT_SETTINGS: ImmichSyncSettings = {
	serverUrl: "",
	apiKey: "",
	enableLocalCache: true,
	fullResolution: false,
	maxCacheSizeMb: 50,
};

export class ImmichSyncSettingTab extends PluginSettingTab {
	plugin: ImmichSyncPlugin;

	constructor(app: App, plugin: ImmichSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Immich server URL")
			.setDesc(
				"Base URL of your Immich instance, including /api (e.g. https://immich.example.com/api)."
			)
			.addText((text) =>
				text
					.setPlaceholder("https://immich.example.com/api")
					.setValue(this.plugin.settings.serverUrl)
					.onChange(async (value) => {
						this.plugin.settings.serverUrl = value.trim();
						await this.plugin.saveSettings();
						this.plugin.client.reinit();
					})
			);

		new Setting(containerEl)
			.setName("Immich API key")
			.setDesc(
				"Stored in this plugin's data.json on disk in plain text. Needs asset.read, asset.download, and asset.view permissions. See https://api.immich.app/getting-started"
			)
			.addText((text) => {
				text.inputEl.type = "password";
				text.setPlaceholder("API key")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value.trim();
						await this.plugin.saveSettings();
						this.plugin.client.reinit();
					});
			});

		new Setting(containerEl)
			.setName("Cache images locally")
			.setDesc(
				"Store fetched images on disk so notes render offline and faster without re-fetching."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableLocalCache)
					.onChange(async (value) => {
						this.plugin.settings.enableLocalCache = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Full resolution")
			.setDesc(
				"Fetch the original asset instead of a thumbnail. Uses much more bandwidth and disk."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.fullResolution)
					.onChange(async (value) => {
						this.plugin.settings.fullResolution = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Max cache size (MB)")
			.setDesc(
				"Oldest accessed images are evicted when the cache exceeds this size."
			)
			.addText((text) => {
				text.inputEl.type = "number";
				text.inputEl.min = "1";
				text.setPlaceholder("50")
					.setValue(String(this.plugin.settings.maxCacheSizeMb))
					.onChange(async (value) => {
						const parsed = Number(value);
						if (!Number.isFinite(parsed) || parsed < 1) {
							return;
						}
						this.plugin.settings.maxCacheSizeMb =
							Math.floor(parsed);
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Clear cache")
			.setDesc(
				"Delete all locally cached images. Hash-to-asset-id mappings are preserved."
			)
			.addButton((button) =>
				button
					.setButtonText("Clear cache")
					.setWarning()
					.onClick(async () => {
						await this.plugin.clearCache();
						new Notice("Immich cache cleared");
					})
			);
	}
}
