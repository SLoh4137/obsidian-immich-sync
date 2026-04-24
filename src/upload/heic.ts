// heic-convert ships no published types — declare a minimal shape and cast.
type ConvertOptions = {
	buffer: Uint8Array;
	format: "JPEG" | "PNG";
	quality?: number;
};
type Convert = (opts: ConvertOptions) => Promise<Uint8Array>;
// @ts-expect-error — no types
import convertImpl from "heic-convert/browser";
const convert = convertImpl as Convert;

// HEIC/HEIF major brands found at offset 8 of an ISOBMFF `ftyp` box.
// `mif1` and `msf1` are also used by HEIF derivatives (Apple's still and
// burst formats), so they're treated as HEIC for conversion purposes.
const HEIC_BRANDS = new Set([
	"heic",
	"heix",
	"heim",
	"heis",
	"hevc",
	"hevx",
	"hevm",
	"hevs",
	"mif1",
	"msf1",
]);

const FTYP_BYTES = [0x66, 0x74, 0x79, 0x70]; // 'ftyp'

export function isHeic(buffer: ArrayBuffer): boolean {
	if (buffer.byteLength < 12) return false;
	const view = new Uint8Array(buffer, 0, 12);
	for (let i = 0; i < FTYP_BYTES.length; i++) {
		if (view[4 + i] !== FTYP_BYTES[i]) return false;
	}
	const brand = String.fromCharCode(view[8]!, view[9]!, view[10]!, view[11]!);
	return HEIC_BRANDS.has(brand);
}

export async function convertHeicToJpeg(
	buffer: ArrayBuffer
): Promise<ArrayBuffer> {
	const result = await convert({
		buffer: new Uint8Array(buffer),
		format: "JPEG",
		quality: 0.92,
	});
	// Copy into a fresh ArrayBuffer to detach from the underlying decoder buffer.
	return result.slice().buffer;
}
