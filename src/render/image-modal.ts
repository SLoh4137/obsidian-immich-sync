import { App, Modal, setIcon } from "obsidian";

export interface ModalImage {
	hash: string;
	src: string | null;
}

const SWIPE_THRESHOLD_PX = 50;
const SWIPE_MAX_OFF_AXIS_RATIO = 0.75;

export class ImageModal extends Modal {
	private index: number;
	private imgEl: HTMLImageElement | null = null;
	private counterEl: HTMLElement | null = null;
	private prevBtn: HTMLButtonElement | null = null;
	private nextBtn: HTMLButtonElement | null = null;
	private pointerStartX: number | null = null;
	private pointerStartY: number | null = null;
	private pointerId: number | null = null;

	constructor(app: App, private images: ModalImage[], startIndex: number) {
		super(app);
		this.index = startIndex;
	}

	onOpen(): void {
		this.modalEl.addClass("immich-sync-modal");

		this.prevBtn = this.contentEl.createEl("button", {
			cls: "immich-sync-modal-nav immich-sync-modal-prev",
			attr: { "aria-label": "Previous image" },
		});
		setIcon(this.prevBtn, "chevron-left");
		this.prevBtn.addEventListener("click", () => this.prev());

		this.imgEl = this.contentEl.createEl("img", {
			cls: "immich-sync-modal-image",
		});

		this.nextBtn = this.contentEl.createEl("button", {
			cls: "immich-sync-modal-nav immich-sync-modal-next",
			attr: { "aria-label": "Next image" },
		});
		setIcon(this.nextBtn, "chevron-right");
		this.nextBtn.addEventListener("click", () => this.next());

		this.counterEl = this.contentEl.createDiv({
			cls: "immich-sync-modal-counter",
		});

		this.scope.register([], "ArrowLeft", () => this.prev());
		this.scope.register([], "ArrowRight", () => this.next());

		this.contentEl.addEventListener("pointerdown", (e) => this.onPointerDown(e));
		this.contentEl.addEventListener("pointerup", (e) => this.onPointerUp(e));
		this.contentEl.addEventListener("pointercancel", () => this.resetPointer());

		this.update();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private onPointerDown(e: PointerEvent): void {
		if (e.pointerType === "mouse" && e.button !== 0) return;
		this.pointerStartX = e.clientX;
		this.pointerStartY = e.clientY;
		this.pointerId = e.pointerId;
	}

	private onPointerUp(e: PointerEvent): void {
		if (
			this.pointerStartX === null ||
			this.pointerStartY === null ||
			this.pointerId !== e.pointerId
		) {
			return;
		}
		const dx = e.clientX - this.pointerStartX;
		const dy = e.clientY - this.pointerStartY;
		this.resetPointer();
		if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
		if (Math.abs(dy) > Math.abs(dx) * SWIPE_MAX_OFF_AXIS_RATIO) return;
		if (dx < 0) {
			this.next();
		} else {
			this.prev();
		}
	}

	private resetPointer(): void {
		this.pointerStartX = null;
		this.pointerStartY = null;
		this.pointerId = null;
	}

	private prev(): void {
		if (this.images.length <= 1) return;
		this.index = (this.index - 1 + this.images.length) % this.images.length;
		this.update();
	}

	private next(): void {
		if (this.images.length <= 1) return;
		this.index = (this.index + 1) % this.images.length;
		this.update();
	}

	private update(): void {
		const current = this.images[this.index];
		if (this.imgEl !== null) {
			if (current?.src) {
				this.imgEl.src = current.src;
				this.imgEl.alt = current.hash;
				this.imgEl.show();
			} else {
				this.imgEl.removeAttribute("src");
				this.imgEl.hide();
			}
		}
		if (this.counterEl !== null) {
			this.counterEl.setText(`${this.index + 1} / ${this.images.length}`);
		}
		const multi = this.images.length > 1;
		if (this.prevBtn !== null) this.prevBtn.toggle(multi);
		if (this.nextBtn !== null) this.nextBtn.toggle(multi);
	}
}
