/**
 * Book page-curl player — manga-style wave via canvas bitmaps.
 * Callers must use Fade (playPageTurn) when bitmaps are unavailable.
 */
import {
  PAGE_TURN_DURATION_MS,
  TurnDir,
  prefersReducedMotion
} from '../../../core/models/enums/page-transition.enums';
import { MangaFitMode } from '../../../core/models';
import { accelerateDecelerate } from './page-transition.math';
import {
  curlFoldingLeaf,
  drawCurl,
  positionToCurl,
  progressToCurlPosition
} from './page-curl.canvas';
import type { BookCurlBitmaps } from './book-curl.capture';

export type BookCurlOwner = string | symbol;

export interface PlayBookCurlTurnOptions {
  host: HTMLElement;
  viewerShell: HTMLElement;
  peekShell: HTMLElement;
  bitmaps: BookCurlBitmaps | null;
  dir: TurnDir;
  mirror?: boolean;
  mode: '2d' | '3d';
  durationMs?: number;
  signal?: AbortSignal;
  commit?: () => void | Promise<void>;
  owner?: BookCurlOwner;
  /** When set, scrub from this progress (0..1) instead of animating 0→1. */
  fromProgress?: number;
  surfaceColor?: string;
  /**
   * Reuse an existing overlay canvas (e.g. drag scrub) instead of creating a new one.
   * When set, cleanup does not remove the canvas (caller owns teardown).
   */
  canvas?: HTMLCanvasElement | null;
  /** Pointer Y for dynamic 3D curl angle. */
  pointerY?: number;
  /** Leave this many CSS px clear at the bottom (progress strip). */
  bottomInsetCss?: number;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function doubleRaf(): Promise<void> {
  await nextFrame();
  await nextFrame();
}

interface ActiveBookCurl {
  owner: BookCurlOwner;
  cleanup: () => void;
  rafId: number;
  cancelled: boolean;
}

const activeCurl = new Map<BookCurlOwner, ActiveBookCurl>();

/** Cancel in-flight book curl canvas animations. */
export function cancelBookCurlTurns(owner?: BookCurlOwner): void {
  if (owner !== undefined) {
    cancelBookCurl(owner);
    return;
  }
  for (const key of [...activeCurl.keys()]) {
    cancelBookCurl(key);
  }
}

function cancelBookCurl(owner: BookCurlOwner): void {
  const cur = activeCurl.get(owner);
  if (!cur) return;
  cur.cancelled = true;
  if (cur.rafId) cancelAnimationFrame(cur.rafId);
  try {
    cur.cleanup();
  } catch {
    /* ignore */
  }
  activeCurl.delete(owner);
}

/**
 * Paint one curl frame using the same leaf selection as manga:
 * next → fold outgoing (front); prev → fold incoming (under) and uncurl from left.
 */
export function paintCanvasAtProgress(
  canvas: HTMLCanvasElement,
  bitmaps: BookCurlBitmaps,
  progress: number,
  logicalDir: TurnDir,
  mirror: boolean,
  mode: '2d' | '3d',
  pointerY?: number
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const leaf = curlFoldingLeaf(logicalDir);
  const fold = leaf === 'outgoing' ? bitmaps.front : bitmaps.under;
  const under = leaf === 'outgoing' ? bitmaps.under : bitmaps.front;
  const curlPos = progressToCurlPosition(progress, logicalDir);
  drawCurl(ctx, {
    front: fold,
    back: null,
    under,
    curl: positionToCurl(curlPos),
    mode,
    pointerY,
    surfaceColor: bitmaps.surfaceColor,
    mirror,
    isRightEdge: mirror ? logicalDir < 0 : logicalDir > 0,
    fitMode: 'fill' as MangaFitMode | 'fill',
    zoom: 1
  });
}

/** Paint a flat freeze of the current page (before under bitmap is ready). */
export function paintBookCurlFreeze(
  canvas: HTMLCanvasElement,
  front: ImageBitmap,
  width: number,
  height: number,
  surfaceColor: string
): void {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  drawCurl(ctx, {
    front,
    under: front,
    back: null,
    curl: 0,
    mode: '2d',
    surfaceColor,
    mirror: false,
    fitMode: 'fill' as MangaFitMode | 'fill',
    zoom: 1
  });
}

/**
 * Animate book curl using captured bitmaps + drawCurl (manga wave).
 * When bitmaps are null, commits immediately — caller should use Fade instead.
 */
export async function playBookCurlTurn(opts: PlayBookCurlTurnOptions): Promise<void> {
  const {
    host,
    viewerShell,
    peekShell,
    bitmaps,
    dir,
    mirror = false,
    mode,
    durationMs = PAGE_TURN_DURATION_MS,
    signal,
    commit,
    owner = 'book-reader',
    fromProgress = 0,
    canvas: reuseCanvas,
    pointerY,
    bottomInsetCss = 0
  } = opts;

  if (prefersReducedMotion() || durationMs <= 0) {
    if (commit) await commit();
    return;
  }

  const willReuse = !!(reuseCanvas && reuseCanvas.isConnected);
  if (willReuse) {
    // Stop prior rAF without restoring shells / removing the shared canvas
    const cur = activeCurl.get(owner);
    if (cur) {
      cur.cancelled = true;
      if (cur.rafId) cancelAnimationFrame(cur.rafId);
      activeCurl.delete(owner);
    }
  } else {
    cancelBookCurl(owner);
  }

  if (!bitmaps) {
    if (commit) await commit();
    return;
  }

  await playCanvasCurl({
    host,
    viewerShell,
    peekShell,
    bitmaps,
    dir,
    mirror,
    mode,
    durationMs,
    signal,
    commit,
    owner,
    fromProgress,
    reuseCanvas: willReuse ? reuseCanvas! : null,
    pointerY,
    bottomInsetCss
  });
}

async function playCanvasCurl(opts: {
  host: HTMLElement;
  viewerShell: HTMLElement;
  peekShell: HTMLElement;
  bitmaps: BookCurlBitmaps;
  dir: TurnDir;
  mirror: boolean;
  mode: '2d' | '3d';
  durationMs: number;
  signal?: AbortSignal;
  commit?: () => void | Promise<void>;
  owner: BookCurlOwner;
  fromProgress: number;
  reuseCanvas: HTMLCanvasElement | null;
  pointerY?: number;
  bottomInsetCss: number;
}): Promise<void> {
  const {
    host,
    viewerShell,
    peekShell,
    bitmaps,
    dir,
    mirror,
    mode,
    durationMs,
    signal,
    commit,
    owner,
    fromProgress,
    reuseCanvas,
    pointerY,
    bottomInsetCss
  } = opts;

  const ownsCanvas = !reuseCanvas;
  const canvas =
    reuseCanvas ||
    (() => {
      const inset = Math.max(0, bottomInsetCss);
      const c = document.createElement('canvas');
      c.className = 'absolute inset-0 pointer-events-none';
      c.style.cssText =
        `position:absolute;top:0;left:0;right:0;bottom:${inset}px;` +
        `width:100%;height:${inset > 0 ? 'auto' : '100%'};` +
        'z-index:5;pointer-events:none;';
      host.appendChild(c);
      return c;
    })();

  canvas.width = bitmaps.width;
  canvas.height = bitmaps.height;

  // Paint first frame BEFORE hiding shells (covers peek flash).
  paintCanvasAtProgress(canvas, bitmaps, fromProgress, dir, mirror, mode, pointerY);

  const viewerPrev = viewerShell.style.visibility;
  const peekPrev = peekShell.style.visibility;
  viewerShell.style.visibility = 'hidden';
  peekShell.style.visibility = 'hidden';

  let rafId = 0;
  let cancelled = false;

  const cleanup = () => {
    cancelled = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (ownsCanvas) {
      try {
        canvas.remove();
      } catch {
        /* ignore */
      }
    }
    viewerShell.style.visibility = viewerPrev;
    peekShell.style.visibility = peekPrev;
  };

  const active: ActiveBookCurl = { owner, cleanup, rafId: 0, cancelled: false };
  activeCurl.set(owner, active);

  const onAbort = () => {
    active.cancelled = true;
    cancelled = true;
    if (rafId) cancelAnimationFrame(rafId);
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    await new Promise<void>(resolve => {
      const start = performance.now();
      const from = Math.max(0, Math.min(1, fromProgress));
      const tick = (now: number) => {
        if (cancelled || active.cancelled) {
          resolve();
          return;
        }
        const t = Math.min(1, (now - start) / Math.max(1, durationMs));
        const eased = accelerateDecelerate(t);
        const progress = from + (1 - from) * eased;
        paintCanvasAtProgress(canvas, bitmaps, progress, dir, mirror, mode, pointerY);
        if (t >= 1) {
          resolve();
          return;
        }
        rafId = requestAnimationFrame(tick);
        active.rafId = rafId;
      };
      rafId = requestAnimationFrame(tick);
      active.rafId = rafId;
    });

    if (!cancelled && !active.cancelled) {
      if (commit) await commit();
      await doubleRaf();
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
    cleanup();
    activeCurl.delete(owner);
  }
}

/** Paint a single curl frame for interactive drag scrub (canvas path). */
export function paintBookCurlProgress(
  canvas: HTMLCanvasElement,
  bitmaps: BookCurlBitmaps,
  progress: number,
  logicalDir: TurnDir,
  mirror: boolean,
  mode: '2d' | '3d',
  pointerY?: number
): void {
  if (canvas.width !== bitmaps.width || canvas.height !== bitmaps.height) {
    canvas.width = bitmaps.width;
    canvas.height = bitmaps.height;
  }
  paintCanvasAtProgress(canvas, bitmaps, progress, logicalDir, mirror, mode, pointerY);
}
