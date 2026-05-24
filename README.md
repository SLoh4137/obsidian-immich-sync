# Obsidian Immich Sync

Keep your vault tiny. This plugin replaces image embeds with the Immich checksum of each image and renders them at view time by fetching from your Immich server, with optional local LRU caching for offline reading.

## How it works

-   **Upload**: pick images from your OS file dialog. The plugin computes each image's SHA-1 (Base64-encoded — the same algorithm Immich uses for `checksum`) and inserts a single fenced codeblock at the cursor:
    ````md
    ```immich-sync
    <hash1>
    <hash2>
    ```
    ````
    No image bytes go into the vault. The plugin assumes you've also uploaded the same images to Immich (e.g., via the mobile auto-backup); rendering will look them up by checksum. If your cursor is already inside an `immich-sync` codeblock, new hashes are appended to it instead of opening a new block.
-   **Render**: when an `immich-sync` codeblock is shown, each hash is resolved to an Immich asset ID (cached in `data.json` after first lookup) and either pulled from disk cache or fetched from Immich. Cache misses populate the cache for next time. Images render in a grid, and clicking one opens a fullscreen viewer with prev/next arrows, arrow-key shortcuts, and horizontal swipe-to-navigate.
-   **Banner**: a note's frontmatter can carry an `immichImages` array of hashes; the plugin renders them as a banner pinned to the top of the note in both reading and edit modes. Clicking the banner opens the same fullscreen viewer over all banner images.

## Installation

This plugin is not yet on the community catalog. To install manually:

1. Build:
    ```bash
    npm install
    npm run build
    ```
2. Copy `main.js`, `manifest.json`, and `styles.css` into `<YourVault>/.obsidian/plugins/obsidian-immich-sync/`.
3. Reload Obsidian and enable the plugin in **Settings → Community plugins**.

## Settings

-   **Immich server URL** — must include `/api` (e.g. `https://immich.example.com/api`).
-   **Immich API key** — stored in this plugin's `data.json` on disk in plain text. Needs `asset.read`, `asset.download`, and `asset.view` permissions.
-   **Cache images locally** — keep fetched images on disk so notes render offline. Cached files live at `<vault>/.obsidian/plugins/obsidian-immich-sync/cache/`. Default: on. With caching off, every render fetches from Immich and renders via an in-memory blob URL (held until plugin reload).
-   **Full resolution** — fetch originals instead of thumbnails. Uses much more bandwidth and disk. Default: off.
-   **Convert HEIC to JPEG on upload** — when caching is on, transcode HEIC uploads to JPEG so the very first render is instant. Turn off to skip the transcoding cost on upload at the price of refetching from Immich the first time. Default: on. See the HEIC section below for the full tradeoff.
-   **Max cache size (MB)** — oldest accessed images are evicted when this is exceeded. Default: 50.
-   **Clear cache** — deletes all cached files. The hash → asset ID map is preserved so you don't have to re-search Immich.

## HEIC and other non-web image formats

Browsers (and Obsidian's Chromium) can't natively render HEIC, HEIF, or RAW files. To make those embeds work, Immich must transcode them to a web-friendly format on the server side. The plugin requests the **`fullsize`** image variant when **Full resolution** is on, which Immich only serves if full-size generation is enabled.

In your Immich admin UI:

1. **Administration → System Settings → Image**.
2. Enable **Generate full-size images** (sometimes labeled "Full-size image generation").
3. Re-run **Job Status → Generate Thumbnails → All** so existing assets are processed.

Without this, HEIC/RAW assets will render as broken images and you'll see a `404` (or a 500 from the transcoding pipeline) for `/api/assets/<id>/fullsize` in the console. JPEG/PNG/WebP work without this setting because the original or thumbnail formats are already web-compatible.

### Client-side HEIC → JPEG on upload

When **Cache images locally** and **Convert HEIC to JPEG on upload** are both on, the plugin detects HEIC files at upload time (by checking ISOBMFF magic bytes for `ftyp` + a HEIC brand) and transcodes them to JPEG before writing to the cache. This is so the very first render of a freshly-uploaded HEIC is instant — without it, the cache would hold unrenderable HEIC bytes and the first render would have to wait for an Immich fetch.

The conversion uses the [`heic-convert`](https://www.npmjs.com/package/heic-convert) package (with `heic-convert/browser` so encoding goes through Canvas, not Node's `jpeg-js`). The dependency tree pulls in `libheif-js`, whose WASM is base64-inlined into `main.js` — currently that adds about **1.4 MB** to the plugin bundle.

**When to disable it (via the setting):**

-   **You'd rather take the network hit.** With the toggle off, uploads still complete and the hash still gets written to the note — the first render just refetches the transcoded fullsize from Immich (which is already required for HEIC anyway, per the section above). Subsequent renders hit the cache normally.
-   **Chromium gains native HEIC decoding.** If a future Electron release that Obsidian ships with can render HEIC in `<img>` tags directly, the conversion is dead weight — the cached HEIC bytes would render fine. At that point the dependency can also be dropped from the build to shrink the bundle back to ~28 KB. Check `data:image/heic;base64,…` support in the DevTools console.

The hash inserted into the codeblock is always the SHA-1 of the **original** HEIC bytes (not the JPEG), so toggling this setting later doesn't invalidate any existing notes — Immich's `searchAssets` lookup still resolves the same way.

## Uploading images

Three entry points, all open the OS file picker (multi-select):

-   Right-click in the editor → **Add images to note**
-   Command palette → **Upload images to Immich**
-   Ribbon icon (image-up icon)

All three insert an `immich-sync` codeblock into the currently-active note. If the cursor is already inside one, new hashes are appended to it instead.

## Banner images

A note can declare banner images in its frontmatter under the `immichImages` key:

```yaml
---
immichImages:
    - <hash1>
    - <hash2>
---
```

The first hash renders as a full-width banner pinned to the top of the note (in both reading and edit modes), with the remaining images available by clicking the banner to open the fullscreen viewer.

To manage banners without editing YAML by hand, use any of:

-   Right-click in the editor → **Edit banner images**
-   Command palette → **Edit Immich banner images**
-   Ribbon icon (panel-top icon)

The editor opens a modal showing the current banner images. **Add images** opens the OS file picker and appends new hashes; the **×** on each thumbnail removes that image from the frontmatter (the asset stays in Immich).

## CORS configuration (Nginx Proxy Manager)

Obsidian's web origin is `app://obsidian.md`. Immich servers fronted by NPM will reject the plugin's `fetch()` calls (preflight + POST to `/api/search/metadata`) unless CORS is explicitly allowed. Direct `<img src>` loads are not affected — only the SDK calls used for asset lookup and cache population.

In your Immich proxy host:

1. **Custom locations** tab → Add location.
2. **Define location**: `/api`. Set scheme/forward hostname/forward port to the same values as the main proxy.
3. Click the gear/settings icon on the row and paste:

    ```nginx
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'x-api-key, content-type, authorization' always;
    add_header 'Access-Control-Expose-Headers' 'content-length, content-type' always;

    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'x-api-key, content-type, authorization' always;
        add_header 'Access-Control-Max-Age' 1728000 always;
        add_header 'Content-Type' 'text/plain; charset=UTF-8';
        add_header 'Content-Length' 0;
        return 204;
    }
    ```

4. Save.

A few nginx footguns this works around:

-   The CORS headers must live in a **location-scope** custom config, not in the proxy host's "Advanced → Custom Nginx Configuration" field. Server-scope `if` blocks in NPM can shift SSL directives and cause `ERR_SSL_UNRECOGNIZED_NAME_ALERT`.
-   The `add_header` directives outside the `if` apply to all proxied methods (POST, GET, etc.). They must be repeated _inside_ the `if ($request_method = 'OPTIONS')` block because nginx does not inherit `add_header` into `if` blocks that short-circuit with `return`.
-   `always` is required so the headers attach to non-2xx responses (e.g., a 401 from Immich), otherwise auth failures look like CORS failures in the browser console.

Verify with curl:

```bash
curl -i -X POST https://immich.example.com/api/search/metadata \
  -H "Origin: app://obsidian.md" \
  -H "x-api-key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{"size":1}' | grep -i 'access-control\|HTTP/'
```

You should see `HTTP/2 200` and `access-control-allow-origin: *`.

## Recommended: use a scoped Immich API key

The plugin authenticates every Immich call with the `x-api-key` HTTP header. Your API key never appears in the DOM, in `<img>` URLs, or in your reverse proxy's query-string logs. Even so, the key sits in `data.json` on disk in plain text. To limit the blast radius if the file is ever exposed, generate a dedicated key for this plugin rather than reusing your main one:

1. Immich web UI → **Account Settings → API Keys → New API Key**.
2. Grant only the permissions the plugin needs:
    - `asset.read`
    - `asset.view`
    - `asset.download` (only required if you use full resolution)
3. Copy the key into **Settings → Immich Sync → Immich API key**.

A scoped, read-only key means the worst an attacker can do with the leaked key is read assets you've already embedded the checksums of.

## Privacy

-   Network calls go only to the Immich server you configure, using the API key you provide.
-   The plugin does not send any vault contents, telemetry, or analytics anywhere.
-   The hash → asset ID map and image cache live entirely in `<vault>/.obsidian/plugins/obsidian-immich-sync/`.
