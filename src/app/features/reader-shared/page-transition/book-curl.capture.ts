/**
 * Capture opaque front/under bitmaps of the book viewer shells for canvas curl.
 *
 * Order matters for visuals:
 * 1. Hide chrome (no CSS transition) so menus are not in the PNG.
 * 2. Capture front (viewer visible, peek hidden).
 * 3. Optional onFrontReady — caller paints a freeze canvas before under capture.
 * 4. Capture under (viewer hidden, peek visible) while freeze covers the host.
 */
export interface CaptureRectFn {
  (rect: { x: number; y: number; width: number; height: number }): Promise<string | null>;
}

export interface BookCurlBitmaps {
  front: ImageBitmap;
  under: ImageBitmap;
  width: number;
  height: number;
  surfaceColor: string;
}

export interface CaptureBookPageBitmapsOptions {
  viewerShell: HTMLElement;
  peekShell: HTMLElement;
  captureRect: CaptureRectFn;
  surfaceColor: string;
  /** Scale factor to multiply CSS dimensions (e.g. devicePixelRatio * 0.85). Defaults to Math.max(1, (window.devicePixelRatio || 1) * 0.85). */
  scale?: number;
  /**
   * Called after the front bitmap is ready and before under capture.
   * Viewer is still visible; peek is hidden. Use to paint a freeze overlay.
   */
  onFrontReady?: (
    front: ImageBitmap,
    width: number,
    height: number
  ) => void | Promise<void>;
  /** Called before capturing the under page (use to hide freeze canvas). */
  onBeforeUnderCapture?: () => void | Promise<void>;
  /** Called after capturing the under page (use to restore freeze canvas). */
  onAfterUnderCapture?: () => void | Promise<void>;
  /** Hide chrome overlays during capture; return a restore function. */
  hideChrome?: () => () => void;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function doubleRaf(): Promise<void> {
  await nextFrame();
  await nextFrame();
}

async function dataUrlToOpaqueBitmap(
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

function elementDipRect(el: HTMLElement): { x: number; y: number; width: number; height: number } {
  const r = el.getBoundingClientRect();
  return {
    x: r.left,
    y: r.top,
    width: Math.max(1, r.width),
    height: Math.max(1, r.height)
  };
}

/**
 * Snapshot viewer (front) and peek (under) shells as opaque ImageBitmaps.
 */
export async function captureBookPageBitmaps(
  opts: CaptureBookPageBitmapsOptions
): Promise<BookCurlBitmaps | null> {
  const {
    viewerShell,
    peekShell,
    captureRect,
    surfaceColor,
    onFrontReady,
    onBeforeUnderCapture,
    onAfterUnderCapture,
    hideChrome
  } = opts;
  const hostRect = elementDipRect(viewerShell);
  const cssW = Math.round(hostRect.width);
  const cssH = Math.round(hostRect.height);
  if (cssW < 8 || cssH < 8) return null;

  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  const scale = opts.scale ?? Math.max(1, Math.round(dpr * 0.85 * 100) / 100);
  const bitmapW = Math.max(1, Math.round(cssW * scale));
  const bitmapH = Math.max(1, Math.round(cssH * scale));

  const peekPrev = {
    visibility: peekShell.style.visibility,
    opacity: peekShell.style.opacity
  };
  const viewerPrev = {
    visibility: viewerShell.style.visibility,
    opacity: viewerShell.style.opacity
  };

  let restoreChrome: (() => void) | null = null;
  try {
    if (hideChrome) {
      restoreChrome = hideChrome();
    }

    // Front = viewer only (page stays on screen)
    peekShell.style.visibility = 'hidden';
    peekShell.style.opacity = '0';
    viewerShell.style.visibility = 'visible';
    viewerShell.style.opacity = '1';
    viewerShell.style.background = surfaceColor;
    await doubleRaf();
    const frontUrl = await captureRect(elementDipRect(viewerShell));
    if (!frontUrl) return null;

    const front = await dataUrlToOpaqueBitmap(frontUrl, bitmapW, bitmapH, surfaceColor);
    if (!front) return null;

    // Freeze overlay before we hide the viewer for under capture
    if (onFrontReady) {
      await onFrontReady(front, bitmapW, bitmapH);
    }

    // Under = peek captured in offscreen slot (x = 10000) via CDP captureBeyondViewport
    const peekOriginalCss = {
      position: peekShell.style.position,
      left: peekShell.style.left,
      top: peekShell.style.top,
      width: peekShell.style.width,
      height: peekShell.style.height,
      visibility: peekShell.style.visibility,
      opacity: peekShell.style.opacity,
      zIndex: peekShell.style.zIndex
    };

    const OFFSCREEN_X = 10000;
    peekShell.style.position = 'fixed';
    peekShell.style.left = `${OFFSCREEN_X}px`;
    peekShell.style.top = '0px';
    peekShell.style.width = `${cssW}px`;
    peekShell.style.height = `${cssH}px`;
    peekShell.style.visibility = 'visible';
    peekShell.style.opacity = '1';
    peekShell.style.zIndex = '-1';
    peekShell.style.background = surfaceColor;

    const hiddenChildren = Array.from(
      peekShell.querySelectorAll<HTMLElement>('[style*="visibility: hidden"], [style*="visibility:hidden"]')
    );
    for (const el of hiddenChildren) {
      el.style.visibility = 'visible';
    }

    await doubleRaf();

    if (onBeforeUnderCapture) {
      await onBeforeUnderCapture();
      await doubleRaf();
    }
    const underUrl = await captureRect({
      x: OFFSCREEN_X,
      y: 0,
      width: cssW,
      height: cssH
    });
    if (onAfterUnderCapture) {
      await onAfterUnderCapture();
    }

    for (const el of hiddenChildren) {
      el.style.visibility = 'hidden';
    }

    peekShell.style.position = peekOriginalCss.position;
    peekShell.style.left = peekOriginalCss.left;
    peekShell.style.top = peekOriginalCss.top;
    peekShell.style.width = peekOriginalCss.width;
    peekShell.style.height = peekOriginalCss.height;
    peekShell.style.visibility = peekOriginalCss.visibility;
    peekShell.style.opacity = peekOriginalCss.opacity;
    peekShell.style.zIndex = peekOriginalCss.zIndex;
    if (!underUrl) {
      front.close();
      return null;
    }

    const under = await dataUrlToOpaqueBitmap(underUrl, bitmapW, bitmapH, surfaceColor);
    if (!under) {
      front.close();
      return null;
    }

    return { front, under, width: bitmapW, height: bitmapH, surfaceColor };
  } finally {
    peekShell.style.visibility = peekPrev.visibility;
    peekShell.style.opacity = peekPrev.opacity;
    viewerShell.style.visibility = viewerPrev.visibility;
    viewerShell.style.opacity = viewerPrev.opacity;
    try {
      restoreChrome?.();
    } catch {
      /* ignore */
    }
  }
}
