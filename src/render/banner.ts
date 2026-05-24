import { MarkdownView, TFile } from "obsidian";
import ImmichSyncPlugin from "../main";
import { ImageModal, ModalImage } from "./image-modal";
import { resolveImageSrc } from "./image-source";

export const FRONTMATTER_KEY = "immichImages";
const BANNER_CLASS = "immich-sync-banner";
const READING_HOST_SELECTOR = ".markdown-preview-sizer";
const EDITOR_HOST_SELECTOR = ".cm-sizer";

export function registerBannerRenderer(plugin: ImmichSyncPlugin): void {
	const refreshAll = (): void => {
		plugin.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
			if (leaf.view instanceof MarkdownView) {
				void updateBanner(plugin, leaf.view);
			}
		});
	};

	// Run once now, and once after the next frame. Switching into a cached
	// reading-mode tab fires our events before Obsidian re-attaches the
	// preview DOM, so the immediate pass finds no sizer and bails. The
	// follow-up rAF pass catches it once the DOM settles.
	const refreshDeferred = (): void => {
		refreshAll();
		requestAnimationFrame(refreshAll);
	};

	plugin.registerEvent(
		plugin.app.workspace.on("file-open", refreshDeferred),
	);
	plugin.registerEvent(
		plugin.app.workspace.on("layout-change", refreshDeferred),
	);
	plugin.registerEvent(
		plugin.app.workspace.on("active-leaf-change", refreshDeferred),
	);
	plugin.registerEvent(
		plugin.app.metadataCache.on("changed", (file) => {
			plugin.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
				if (
					leaf.view instanceof MarkdownView &&
					leaf.view.file?.path === file.path
				) {
					void updateBanner(plugin, leaf.view);
				}
			});
		}),
	);

	// Fresh reading-mode renders also create .markdown-preview-sizer
	// asynchronously after layout-change. The post-processor catches that
	// path by walking up from a rendered section once it's attached.
	plugin.registerMarkdownPostProcessor((el, ctx) => {
		requestAnimationFrame(() => {
			const sizer = el.closest(READING_HOST_SELECTOR);
			if (!(sizer instanceof HTMLElement)) return;
			const file =
				plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
			if (!(file instanceof TFile)) return;
			syncBanner(plugin, sizer, file);
		});
	});

	refreshDeferred();
}

async function updateBanner(
	plugin: ImmichSyncPlugin,
	view: MarkdownView,
): Promise<void> {
	const file = view.file;
	if (file === null) {
		removeAllBanners(view);
		return;
	}

	const mode = view.getMode();
	const selector =
		mode === "preview" ? READING_HOST_SELECTOR : EDITOR_HOST_SELECTOR;
	const host = view.containerEl.querySelector(selector);

	if (!(host instanceof HTMLElement)) {
		// Active mode's host isn't mounted yet. Leave any existing banner in
		// place — the post-processor (reading mode) or a follow-up
		// layout-change event will mount it once the host appears.
		return;
	}

	syncBanner(plugin, host, file);
	removeBannersExcept(view, host);
}

function syncBanner(
	plugin: ImmichSyncPlugin,
	host: HTMLElement,
	file: TFile,
): void {
	const frontmatter =
		plugin.app.metadataCache.getFileCache(file)?.frontmatter;
	const hashes = extractHashes(frontmatter?.[FRONTMATTER_KEY]);

	if (hashes.length === 0) {
		host.querySelectorAll(`:scope > .${BANNER_CLASS}`).forEach((b) =>
			b.remove(),
		);
		return;
	}

	const signature = bannerSignature(file.path, hashes);
	const firstChild = host.firstElementChild;
	if (
		firstChild instanceof HTMLElement &&
		firstChild.classList.contains(BANNER_CLASS) &&
		firstChild.dataset.signature === signature
	) {
		return;
	}

	host.querySelectorAll(`:scope > .${BANNER_CLASS}`).forEach((b) =>
		b.remove(),
	);
	mountBanner(plugin, host, file, hashes);
}

function mountBanner(
	plugin: ImmichSyncPlugin,
	host: HTMLElement,
	file: TFile,
	hashes: string[],
): void {
	const banner = document.createElement("div");
	banner.classList.add(BANNER_CLASS);
	banner.dataset.signature = bannerSignature(file.path, hashes);

	const bg = document.createElement("img");
	bg.classList.add(`${BANNER_CLASS}-bg`);
	bg.alt = "";
	bg.setAttribute("aria-hidden", "true");
	banner.appendChild(bg);

	const fg = document.createElement("img");
	fg.classList.add(`${BANNER_CLASS}-fg`);
	fg.alt = hashes[0]!;
	banner.appendChild(fg);

	const images: ModalImage[] = hashes.map((hash) => ({
		hash,
		src: null,
	}));

	banner.addEventListener("click", () => {
		new ImageModal(plugin.app, images, 0).open();
	});

	host.prepend(banner);

	hashes.forEach((hash, index) => {
		void loadImage(plugin, hash).then((src) => {
			images[index]!.src = src;
			if (index === 0 && src !== null) {
				bg.src = src;
				fg.src = src;
			}
		});
	});
}

async function loadImage(
	plugin: ImmichSyncPlugin,
	hash: string,
): Promise<string | null> {
	try {
		return await resolveImageSrc(plugin, hash);
	} catch {
		return null;
	}
}

function removeAllBanners(view: MarkdownView): void {
	view.containerEl
		.querySelectorAll(`.${BANNER_CLASS}`)
		.forEach((el) => el.remove());
}

function removeBannersExcept(view: MarkdownView, keepHost: HTMLElement): void {
	view.containerEl.querySelectorAll(`.${BANNER_CLASS}`).forEach((el) => {
		if (el.parentElement !== keepHost) el.remove();
	});
}

export function extractHashes(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value
			.filter((v): v is string => typeof v === "string")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
	}
	if (typeof value === "string") {
		return value
			.split(/[\s,]+/)
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
	}
	return [];
}

function bannerSignature(path: string, hashes: string[]): string {
	return `${path}\n${hashes.join("\n")}`;
}
