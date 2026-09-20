import { MangaFitMode } from '../../core/models';

export interface PageFitRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PageWrapperStyle {
  widthPercent: number | null;
  heightPercent: number | null;
}

/**
 * Wrapper classes for the image container.
 * When zoom > 1, drop max-w/h-full so the page can grow past the slot.
 */
export function pageWrapperClasses(zoom: number): string {
  const base = 'relative inline-block';
  if (zoom > 1) return `${base} max-w-none max-h-none`;
  return `${base} max-h-full max-w-full`;
}

/** Percent sizing driven by fit mode + zoom (mirrors viewport + turn-layer). */
export function pageWrapperStyle(fitMode: MangaFitMode, zoom: number): PageWrapperStyle {
  if (fitMode === MangaFitMode.FitWidth) {
    return { widthPercent: 100 * zoom, heightPercent: null };
  }
  if (fitMode === MangaFitMode.FitHeight) {
    return { widthPercent: null, heightPercent: 100 * zoom };
  }
  return { widthPercent: null, heightPercent: null };
}

/**
 * Image element classes. When zoom > 1, use max-w-none so FitWidth can exceed slot.
 */
export function pageImageClasses(
  fitMode: MangaFitMode,
  zoom: number,
  longStrip = false
): string {
  const base = 'reader-zoom-img block object-contain [-webkit-user-drag:none]';
  const maxW = zoom > 1 ? 'max-w-none' : 'max-w-full';

  if (longStrip) {
    return `${base} w-full h-auto`;
  }
  if (fitMode === MangaFitMode.FitHeight) {
    return `${base} w-auto h-full ${maxW}`;
  }
  if (fitMode === MangaFitMode.Original) {
    return `${base} reader-zoom-original w-auto h-auto`;
  }
  // FitWidth
  return `${base} h-auto w-full ${maxW}`;
}

/**
 * Compute the destination rect for an image inside a viewport of size W×H.
 * Shared by DOM layout and canvas curl so both paint the same geometry.
 */
export function pageFitRect(
  iw: number,
  ih: number,
  W: number,
  H: number,
  fitMode: MangaFitMode,
  zoom = 1
): PageFitRect {
  if (!iw || !ih || W <= 0 || H <= 0) {
    return { x: 0, y: 0, w: W, h: H };
  }
  const z = zoom || 1;
  let w = W;
  let h = H;

  if (fitMode === MangaFitMode.FitWidth) {
    const scale = (W / iw) * z;
    w = iw * scale;
    h = ih * scale;
  } else if (fitMode === MangaFitMode.FitHeight) {
    const scale = (H / ih) * z;
    w = iw * scale;
    h = ih * scale;
  } else if (fitMode === MangaFitMode.Original) {
    w = iw * z;
    h = ih * z;
  } else {
    const scale = Math.min(W / iw, H / ih) * z;
    w = iw * scale;
    h = ih * scale;
  }

  return {
    x: (W - w) / 2,
    y: (H - h) / 2,
    w,
    h
  };
}

/**
 * Destination rect for an image inside a viewport, shifted by slot scroll so
 * the painted crop matches the reader's scrolled view.
 */
export function pageFitRectScrolled(
  iw: number,
  ih: number,
  W: number,
  H: number,
  fitMode: MangaFitMode,
  zoom = 1,
  scrollLeft = 0,
  scrollTop = 0
): PageFitRect {
  const base = pageFitRect(iw, ih, W, H, fitMode, zoom);
  return {
    x: base.x - scrollLeft,
    y: base.y - scrollTop,
    w: base.w,
    h: base.h
  };
}

/**
 * Visible top-left of a scrolled content wrapper inside a slot
 * (accounts for flex centering + scroll).
 */
export function slotContentViewportOffset(
  slot: HTMLElement,
  content: HTMLElement
): { x: number; y: number; scrollLeft: number; scrollTop: number } {
  const sr = slot.getBoundingClientRect();
  const cr = content.getBoundingClientRect();
  return {
    scrollLeft: slot.scrollLeft,
    scrollTop: slot.scrollTop,
    x: cr.left - sr.left,
    y: cr.top - sr.top
  };
}

/**
 * Absolute content offset for an incoming turn leaf at land start/end,
 * matching pageLandOffsets scroll semantics.
 */
export function synthesizeLandView(
  contentW: number,
  contentH: number,
  viewportW: number,
  viewportH: number,
  land: 'start' | 'end',
  rtl = false
): { scrollLeft: number; scrollTop: number; offsetX: number; offsetY: number } {
  const maxX = Math.max(0, contentW - viewportW);
  const maxY = Math.max(0, contentH - viewportH);
  const scrollLeft = land === 'start' ? (rtl ? maxX : 0) : rtl ? 0 : maxX;
  const scrollTop = land === 'start' ? 0 : maxY;
  const baseX = (viewportW - contentW) / 2;
  const baseY = (viewportH - contentH) / 2;
  return {
    scrollLeft,
    scrollTop,
    offsetX: baseX - scrollLeft,
    offsetY: baseY - scrollTop
  };
}
