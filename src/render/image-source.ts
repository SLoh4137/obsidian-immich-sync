import ImmichSyncPlugin from "../main";

export async function resolveImageSrc(
	plugin: ImmichSyncPlugin,
	hash: string,
): Promise<string | null> {
	const fullRes = plugin.settings.fullResolution;
	if (plugin.settings.enableLocalCache) {
		const cachedPath = await plugin.cache.get(hash, fullRes);
		if (cachedPath !== null) {
			return plugin.app.vault.adapter.getResourcePath(cachedPath);
		}
	}

	const assetId = await resolveAssetId(plugin, hash);
	if (assetId === null) {
		return null;
	}

	const buffer = await plugin.client.fetchAssetBytes(assetId, fullRes);

	if (plugin.settings.enableLocalCache) {
		const writtenPath = await plugin.cache.put(hash, buffer, fullRes);
		return plugin.app.vault.adapter.getResourcePath(writtenPath);
	}

	// Cache disabled: hand the bytes to the browser as a blob URL. The URL is
	// not revoked — it lives until plugin reload — so the modal can still use
	// it after the codeblock re-renders. Memory cost is bounded by image count
	// per session.
	return URL.createObjectURL(new Blob([buffer]));
}

async function resolveAssetId(
	plugin: ImmichSyncPlugin,
	hash: string,
): Promise<string | null> {
	const cached = plugin.hashMap.get(hash);
	if (cached !== undefined) {
		return cached;
	}
	const assetId = await plugin.client.lookupAssetIdByHash(hash);
	if (assetId !== null) {
		plugin.hashMap.set(hash, assetId);
	}
	return assetId;
}
