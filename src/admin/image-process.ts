// Browser-side image preparation. Canvas re-encoding drops every EXIF field (including GPS),
// so the public variants are safe to publish. The untouched original goes to the private bucket.

export const variantSizes = { lg: 2560, md: 1280, thumb: 480 } as const;
export type Variant = keyof typeof variantSizes;
export const originalTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif', 'image/tiff', 'image/gif'];

export interface ProcessedImage {
  width: number;
  height: number;
  color: string | null;
  takenAt: string | null;
  variants: Record<Variant, Blob>;
}

async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const blob = (type: string) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));
  // Safari without WebP encoding returns PNG; fall back to JPEG in that case.
  const webp = await blob('image/webp');
  if (webp?.type === 'image/webp') return webp;
  const jpeg = await blob('image/jpeg');
  if (!jpeg) throw new Error('이미지를 변환하지 못했습니다.');
  return jpeg;
}

export async function processImage(file: File): Promise<ProcessedImage> {
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('이 브라우저에서 열 수 없는 이미지 형식입니다. JPEG/PNG/WebP로 변환해 올려 주세요.'); }
  const { width, height } = bitmap;
  const variants = {} as Record<Variant, Blob>;
  try {
    for (const [variant, size] of Object.entries(variantSizes) as [Variant, number][]) {
      const scale = Math.min(1, size / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d')!;
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      variants[variant] = await encode(canvas, variant === 'thumb' ? 0.8 : 0.86);
    }
    return { width, height, variants, color: averageColor(bitmap), takenAt: await readTakenAt(file) };
  } finally { bitmap.close(); }
}

function averageColor(bitmap: ImageBitmap) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

/** Reads EXIF DateTimeOriginal from a JPEG. Returns an ISO string (camera local time treated as KST) or null. */
export async function readTakenAt(file: Blob): Promise<string | null> {
  const view = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    const length = view.getUint16(offset + 2);
    if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) return parseExifDate(view, offset + 10);
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return null;
    offset += 2 + length;
  }
  return null;
}

function parseExifDate(view: DataView, tiff: number): string | null {
  try {
    const little = view.getUint16(tiff) === 0x4949;
    const u16 = (at: number) => view.getUint16(at, little);
    const u32 = (at: number) => view.getUint32(at, little);
    const entries = (ifd: number) => Array.from({ length: u16(ifd) }, (_, index) => ifd + 2 + index * 12);
    const ifd0 = tiff + u32(tiff + 4);
    const read = (entry: number) => {
      const count = u32(entry + 4);
      const at = count > 4 ? tiff + u32(entry + 8) : entry + 8;
      return Array.from({ length: count - 1 }, (_, index) => String.fromCharCode(view.getUint8(at + index))).join('');
    };
    let value: string | null = null;
    for (const entry of entries(ifd0)) {
      if (u16(entry) === 0x8769) for (const sub of entries(tiff + u32(entry + 8))) if (u16(sub) === 0x9003) value = read(sub);
      if (!value && u16(entry) === 0x0132) value = read(entry);
    }
    const match = value?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (!match) return null;
    const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}+09:00`;
    return Number.isFinite(Date.parse(iso)) ? new Date(iso).toISOString() : null;
  } catch { return null; }
}
