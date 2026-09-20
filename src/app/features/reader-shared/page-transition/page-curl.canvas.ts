/**
 * Canvas 2D page-curl renderer — port of Android PageCurlFrame.setCurlFactor / dispatchDraw.
 *
 * curl: -1 (fully curled / gone) … 0 (flat).
 * When `under` is provided, it is painted first (destination / static page),
 * then the folding sheet is drawn on top.
 *
 * Back face should be the opposite page (verso), not a mirror of the front.
 */
import { MangaFitMode } from '../../../core/models';
import type { TurnDir } from '../../../core/models/enums/page-transition.enums';
import { pageFitRect, pageFitRectScrolled } from '../../reader-image/manga-page-geometry';

export type CurlMode = '2d' | '3d';

export interface DrawCurlOptions {
  front: CanvasImageSource;
  /** Back face of the folding leaf (typically the destination / opposite page). */
  back?: CanvasImageSource | null;
  /** Page painted underneath the fold (destination or current). */
  under?: CanvasImageSource | null;
  /** Curl amount: -1 (fully curled / gone) … 0 (flat). */
  curl: number;
  mode: CurlMode;
  /** Pointer Y for 3D tilt (viewport coords). Defaults to bottom. */
  pointerY?: number;
  /** Surface / page background fill when no back bitmap. */
  surfaceColor?: string;
  /** Turn direction: 1 = next (curls from right), -1 = prev/RTL (curls from left). */
  dir?: TurnDir;
  /** Image fit mode or helper string */
  fitMode?: MangaFitMode | 'contain' | 'fill';
  /** Current viewport zoom factor */
  zoom?: number;
  /** Slot scroll for front/fold leaf (matches reader crop). */
  scrollLeft?: number;
  scrollTop?: number;
  /** Optional separate scroll for under/back pages (default 0 = land start). */
  underScrollLeft?: number;
  underScrollTop?: number;
  /** Absolute content top-left in viewport (overrides scroll-based centering). */
  frontOffset?: { x: number; y: number } | null;
  underOffset?: { x: number; y: number } | null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function getFitRect(
  img: CanvasImageSource,
  W: number,
  H: number,
  mode: MangaFitMode | 'contain' | 'fill' = MangaFitMode.FitHeight,
  zoom = 1,
  scrollLeft = 0,
  scrollTop = 0
): { x: number; y: number; w: number; h: number } {
  if (mode === 'fill') {
    return {
      x: -scrollLeft,
      y: -scrollTop,
      w: W * (zoom || 1),
      h: H * (zoom || 1)
    };
  }
  const iw = (img as any).width || (img as any).naturalWidth || (img as any).videoWidth || W;
  const ih = (img as any).height || (img as any).naturalHeight || (img as any).videoHeight || H;
  const fitMode = mode === 'contain' ? MangaFitMode.FitHeight : (mode as MangaFitMode);
  return pageFitRectScrolled(iw, ih, W, H, fitMode, zoom, scrollLeft, scrollTop);
}

/**
 * Which page is the folding sheet for a given turn direction.
 * - Next (dir > 0): outgoing folds away 0 → -1
 * - Prev (dir < 0): incoming folds in from -1 → 0
 */
export function curlFoldingLeaf(dir: TurnDir): 'outgoing' | 'incoming' {
  return dir > 0 ? 'outgoing' : 'incoming';
}

/**
 * Map interactive progress (0..1) + dir to ViewPager curl position for the folding leaf.
 * Next: 0 → -1; Prev: -1 → 0 (incoming folds in).
 */
export function progressToCurlPosition(progress: number, dir: TurnDir): number {
  const p = clamp(progress, 0, 1);
  if (dir > 0) return -p;
  return -1 + p;
}

/**
 * Map interactive progress (0..1) + dir to outgoing ViewPager position for CSS turns.
 * Next: 0 → -1; Prev: 0 → +1.
 */
export function progressToTurnPosition(progress: number, dir: TurnDir): number {
  return -dir * clamp(progress, 0, 1);
}

/**
 * Draw a curled page into the canvas.
 * Canvas must already be sized to the page viewport.
 */
export function drawCurl(ctx: CanvasRenderingContext2D, opts: DrawCurlOptions): void {
  const {
    front,
    mode,
    surfaceColor = '#0f172a',
    dir = 1,
    fitMode = MangaFitMode.FitHeight,
    zoom = 1,
    under,
    scrollLeft = 0,
    scrollTop = 0,
    underScrollLeft = 0,
    underScrollTop = 0
  } = opts;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  if (W <= 0 || H <= 0) return;

  const rectBase = getFitRect(front, W, H, fitMode, zoom, scrollLeft, scrollTop);
  const rect = opts.frontOffset
    ? { x: opts.frontOffset.x, y: opts.frontOffset.y, w: rectBase.w, h: rectBase.h }
    : rectBase;

  ctx.clearRect(0, 0, W, H);

  // Destination / static page underneath (not mirrored)
  ctx.fillStyle = surfaceColor;
  ctx.fillRect(0, 0, W, H);
  if (under) {
    const underBase = getFitRect(under, W, H, fitMode, zoom, underScrollLeft, underScrollTop);
    const underRect = opts.underOffset
      ? { x: opts.underOffset.x, y: opts.underOffset.y, w: underBase.w, h: underBase.h }
      : underBase;
    ctx.drawImage(under, underRect.x, underRect.y, underRect.w, underRect.h);
  }

  ctx.save();

  // If turning backward (or RTL next), mirror across W so curl comes from the left edge
  if (dir === -1) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }

  let curl = opts.curl;
  if (curl >= 0) {
    // Flat — draw the front page over under
    ctx.drawImage(front, rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
    return;
  }

  const foldingPage = true;
  let factor = curl + 1; // [-1,0) → [0,1)
  factor = clamp(factor, 0, 1);

  if (mode === '3d') {
    const back = opts.back ?? under ?? front;
    const backBase = getFitRect(
      back,
      W,
      H,
      fitMode,
      zoom,
      underScrollLeft,
      underScrollTop
    );
    const backRect = opts.underOffset
      ? { x: opts.underOffset.x, y: opts.underOffset.y, w: backBase.w, h: backBase.h }
      : backBase;
    drawCurl3d(
      ctx,
      front,
      back,
      factor,
      foldingPage,
      W,
      H,
      rect,
      backRect,
      opts.pointerY,
      surfaceColor
    );
  } else {
    drawCurl2d(ctx, front, factor, foldingPage, W, H, rect, surfaceColor);
  }

  ctx.restore();
}

/** CurlPage (2D): flap is surface + shadow only — never paints the opposite page. */
function drawCurl2d(
  ctx: CanvasRenderingContext2D,
  front: CanvasImageSource,
  factor: number,
  _foldingPage: boolean,
  W: number,
  H: number,
  rect: { x: number; y: number; w: number; h: number },
  surfaceColor: string
): void {
  const geo = curl2dFoldGeometry(factor, W, H);
  const { bottomFold, topFold, bottomFoldTip, topFoldTip } = geo;

  // Visible (uncurled) region of the folding page
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  if (topFold.y !== 0) ctx.lineTo(W, 0);
  ctx.lineTo(topFold.x, topFold.y);
  ctx.lineTo(bottomFold.x, bottomFold.y);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(front, rect.x, rect.y, rect.w, rect.h);
  ctx.restore();

  // Curled flap — 2D wave uses surface color only (no next-page verso paint)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bottomFold.x, bottomFold.y);
  ctx.lineTo(bottomFoldTip.x, bottomFoldTip.y);
  ctx.lineTo(topFoldTip.x, topFoldTip.y);
  ctx.lineTo(topFold.x, topFold.y);
  ctx.closePath();

  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = surfaceColor;
  ctx.fill();
  ctx.shadowBlur = 0;

  const overlay = ctx.createLinearGradient(bottomFold.x, 0, bottomFoldTip.x, 0);
  overlay.addColorStop(0, 'rgba(0,0,0,0.4)');
  overlay.addColorStop(0.55, 'rgba(255,255,255,0.08)');
  overlay.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = overlay;
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Crease stroke
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(topFold.x, topFold.y);
  ctx.lineTo(bottomFold.x, bottomFold.y);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawCurl3d(
  ctx: CanvasRenderingContext2D,
  front: CanvasImageSource,
  back: CanvasImageSource,
  factor: number,
  _foldingPage: boolean,
  W: number,
  H: number,
  rect: { x: number; y: number; w: number; h: number },
  backRect: { x: number; y: number; w: number; h: number },
  pointerY: number | undefined,
  surfaceColor: string
): void {
  const touchY =
    pointerY != null && pointerY >= 0 ? clamp(pointerY, 0, H) : H;
  const maxAngle = (25 * Math.PI) / 180;
  const angleTaper = Math.sin(factor * Math.PI);
  const alpha = (touchY / H - 0.5) * maxAngle * angleTaper;

  const x0 = W * factor;
  const xTop = x0 + Math.tan(alpha) * touchY;
  const xBot = x0 - Math.tan(alpha) * (H - touchY);

  // Left of crease — front page
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(xTop, 0);
  ctx.lineTo(xBot, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(front, rect.x, rect.y, rect.w, rect.h);
  ctx.restore();

  const angleRad = Math.atan2(H, xBot - xTop);

  // Flap (right of crease) — opposite page as verso
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(xTop, 0);
  ctx.lineTo(2 * W, 0);
  ctx.lineTo(2 * W, H);
  ctx.lineTo(xBot, H);
  ctx.closePath();

  ctx.translate(xTop, 0);
  ctx.rotate(angleRad);
  ctx.scale(1, -1);
  ctx.rotate(-angleRad);
  ctx.translate(-xTop, 0);

  ctx.clip();
  ctx.drawImage(back, backRect.x, backRect.y, backRect.w, backRect.h);

  const [r, g, b] = hexToRgb(surfaceColor);
  const overlay = ctx.createLinearGradient(xTop, 0, xBot, H);
  overlay.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
  overlay.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Crease shadow — clip ONLY front + flap
  const angleNormal = angleRad - Math.PI / 2;
  const nx = Math.cos(angleNormal);
  const ny = Math.sin(angleNormal);
  const shadowWidth = clamp(W * 0.15, 50, 250);
  const cx = (xTop + xBot) / 2;
  const cy = H / 2;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(xTop, 0);
  ctx.lineTo(xBot, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.moveTo(xTop, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, H);
  ctx.lineTo(xBot, H);
  ctx.closePath();
  ctx.clip();

  const grad = ctx.createLinearGradient(
    cx - nx * shadowWidth,
    cy - ny * shadowWidth,
    cx + nx * shadowWidth,
    cy + ny * shadowWidth
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.48, 'rgba(0,0,0,0.35)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.54, 'rgba(255,255,255,0.12)');
  grad.addColorStop(0.65, 'rgba(0,0,0,0.12)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return [15, 23, 42]; // slate-950
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/** Convert ViewPager position (-1..0) to drawCurl curl value. */
export function positionToCurl(position: number): number {
  if (position >= 0) return 0;
  return Math.max(-1, Math.min(0, position));
}

/** Fold polygon geometry shared by canvas CurlPage and CSS book fallback. */
export interface Curl2dFoldGeometry {
  factor: number;
  bottomFold: { x: number; y: number };
  topFold: { x: number; y: number };
  bottomFoldTip: { x: number; y: number };
  topFoldTip: { x: number; y: number };
  /** clip-path polygon for the still-visible front region (uncurled). */
  frontClipPolygon: string;
  /** clip-path polygon for the curled flap. */
  flapClipPolygon: string;
}

/**
 * Compute CurlPage (2D) fold geometry for a given curl factor in [0,1)
 * (0 = flat / fully visible, 1 = fully curled away).
 */
export function curl2dFoldGeometry(factor: number, W: number, H: number): Curl2dFoldGeometry {
  const f = clamp(factor, 0, 1);
  const bottomFold = { x: W * f, y: H };
  let topFold: { x: number; y: number };
  if (bottomFold.x > W / 2) {
    topFold = { x: W, y: H - ((W - bottomFold.x) * H) / Math.max(1, bottomFold.x) };
  } else {
    topFold = { x: 2 * bottomFold.x, y: 0 };
  }

  const angle = Math.atan((H - topFold.y) / Math.max(1e-6, topFold.x - bottomFold.x));
  const cos2 = Math.cos(2 * angle);
  const sin2 = Math.sin(2 * angle);
  const foldWidth = W - bottomFold.x;

  const bottomFoldTip = {
    x: bottomFold.x + foldWidth * cos2,
    y: H - foldWidth * sin2
  };
  const topFoldTip =
    bottomFold.x > W / 2
      ? { ...topFold }
      : {
          x: topFold.x + (W - topFold.x) * cos2,
          y: -(sin2 * (W - topFold.x))
        };

  const frontPts: string[] = ['0px 0px'];
  if (topFold.y !== 0) frontPts.push(`${W}px 0px`);
  frontPts.push(`${topFold.x}px ${topFold.y}px`);
  frontPts.push(`${bottomFold.x}px ${bottomFold.y}px`);
  frontPts.push(`0px ${H}px`);

  const flapPts = [
    `${bottomFold.x}px ${bottomFold.y}px`,
    `${bottomFoldTip.x}px ${bottomFoldTip.y}px`,
    `${topFoldTip.x}px ${topFoldTip.y}px`,
    `${topFold.x}px ${topFold.y}px`
  ];

  return {
    factor: f,
    bottomFold,
    topFold,
    bottomFoldTip,
    topFoldTip,
    frontClipPolygon: `polygon(${frontPts.join(', ')})`,
    flapClipPolygon: `polygon(${flapPts.join(', ')})`
  };
}

// Re-export for callers that still import pageFitRect via this module path
export { pageFitRect };
