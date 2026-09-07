/**
 * Canvas 2D page-curl renderer — port of Android PageCurlFrame.setCurlFactor / dispatchDraw.
 *
 * factor / curl:
 * - Transformer position in [-1, 0) maps to factor = position + 1 in (0, 1]
 * - drawCurl expects curl in [-1, 0] (outgoing page) or uses factor in [0, 1] after conversion
 */

export type CurlMode = '2d' | '3d';

export interface DrawCurlOptions {
  front: CanvasImageSource;
  /** Optional back face (mirrored front if omitted). */
  back?: CanvasImageSource | null;
  /** Curl amount: -1 (fully curled / gone) … 0 (flat). */
  curl: number;
  mode: CurlMode;
  /** Pointer Y for 3D tilt (viewport coords). Defaults to bottom. */
  pointerY?: number;
  /** Surface / page background fill when no back bitmap. */
  surfaceColor?: string;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Draw a curled page into the canvas.
 * Canvas must already be sized to the page viewport.
 */
export function drawCurl(ctx: CanvasRenderingContext2D, opts: DrawCurlOptions): void {
  const { front, mode, surfaceColor = '#0f172a' } = opts;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  if (W <= 0 || H <= 0) return;

  let curl = opts.curl;
  if (curl >= 0) {
    // Flat — just draw the front page
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(front, 0, 0, W, H);
    return;
  }

  const foldingPage = true;
  let factor = curl + 1; // [-1,0) → [0,1)
  factor = clamp(factor, 0, 1);

  ctx.clearRect(0, 0, W, H);

  if (mode === '3d') {
    drawCurl3d(ctx, front, opts.back ?? front, factor, foldingPage, W, H, opts.pointerY, surfaceColor);
  } else {
    drawCurl2d(ctx, front, factor, foldingPage, W, H, surfaceColor);
  }
}

function drawCurl2d(
  ctx: CanvasRenderingContext2D,
  front: CanvasImageSource,
  factor: number,
  _foldingPage: boolean,
  W: number,
  H: number,
  surfaceColor: string
): void {
  const bottomFold = { x: W * factor, y: H };
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

  // Visible (uncurled) region
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  if (topFold.y !== 0) ctx.lineTo(W, 0);
  ctx.lineTo(topFold.x, topFold.y);
  ctx.lineTo(bottomFold.x, bottomFold.y);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(front, 0, 0, W, H);
  ctx.restore();

  // Curled flap
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bottomFold.x, bottomFold.y);
  ctx.lineTo(bottomFoldTip.x, bottomFoldTip.y);
  ctx.lineTo(topFoldTip.x, topFoldTip.y);
  ctx.lineTo(topFold.x, topFold.y);
  ctx.closePath();

  // Shadow stroke
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = surfaceColor;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Soft edge
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
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
  ctx.drawImage(front, 0, 0, W, H);
  ctx.restore();

  // Mirror matrix across crease (port of Android rotate-scale-rotate)
  const angleRad = Math.atan2(H, xBot - xTop);
  const angleDeg = (angleRad * 180) / Math.PI;

  ctx.save();
  ctx.beginPath();
  // Curl region (right of crease), then transform for mirror
  ctx.moveTo(xTop, 0);
  ctx.lineTo(2 * W, 0);
  ctx.lineTo(2 * W, H);
  ctx.lineTo(xBot, H);
  ctx.closePath();

  // Apply mirror: T(-xTop) R(-a) Scale(1,-1) R(a) T(xTop)
  ctx.translate(xTop, 0);
  ctx.rotate(angleRad);
  ctx.scale(1, -1);
  ctx.rotate(-angleRad);
  ctx.translate(-xTop, 0);

  ctx.clip();
  ctx.drawImage(back, 0, 0, W, H);

  // Surface overlay on flap
  const [r, g, b] = hexToRgb(surfaceColor);
  const overlay = ctx.createLinearGradient(xTop, 0, xBot, H);
  overlay.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
  overlay.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Crease shadow
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
  // Also include curl side loosely
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
  grad.addColorStop(0.48, 'rgba(0,0,0,0.47)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.7)');
  grad.addColorStop(0.54, 'rgba(255,255,255,0.16)');
  grad.addColorStop(0.65, 'rgba(0,0,0,0.16)');
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
