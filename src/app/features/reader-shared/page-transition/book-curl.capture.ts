/**
 * Book curl bitmaps — paired from the offscreen page cache (no visible DOM capture).
 */

export interface BookCurlBitmaps {
  front: ImageBitmap;
  under: ImageBitmap;
  width: number;
  height: number;
  surfaceColor: string;
}

/**
 * Pair already-decoded page bitmaps for canvas curl.
 * Does not close the source bitmaps (caller owns the cache entries).
 */
export function pairBookCurlBitmaps(
  front: ImageBitmap,
  under: ImageBitmap,
  surfaceColor: string
): BookCurlBitmaps {
  return {
    front,
    under,
    width: front.width,
    height: front.height,
    surfaceColor
  };
}

/**
 * Decode a PNG/JPEG data URL into an opaque ImageBitmap with a solid surface fill.
 */
export async function dataUrlToOpaqueBitmap(
  dataUrl: string,
  width: number,
  height: number,
  surfaceColor: string
): Promise<ImageBitmap | null> {
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = dataUrl;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = surfaceColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await createImageBitmap(canvas);
  } catch (e) {
    console.warn('[book-curl] bitmap decode failed', e);
    return null;
  }
}

/** @deprecated Visible-DOM capture was removed; use pairBookCurlBitmaps + offscreen cache. */
export type CaptureRectFn = (rect: {
  x: number;
  y: number;
  width: number;
  height: number;
  beyondViewport?: boolean;
}) => Promise<string | null>;

/** @deprecated Removed — book curl uses offscreen Electron capture. */
export async function captureBookPageBitmaps(_opts: unknown): Promise<BookCurlBitmaps | null> {
  console.warn('[book-curl] captureBookPageBitmaps is disabled; use offscreen pageBitmapCache');
  return null;
}
