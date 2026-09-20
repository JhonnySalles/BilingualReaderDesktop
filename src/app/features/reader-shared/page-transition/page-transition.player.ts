import {
  PAGE_TURN_DURATION_MS,
  PageTransitionType,
  TurnAxis,
  TurnDir,
  prefersReducedMotion
} from '../../../core/models/enums/page-transition.enums';
import { TransitionVariant } from './page-transition.math';
import { PageTurnDriver } from './page-transition.driver';

export type PageTurnOwner = string | symbol;

export interface PlayPageTurnOptions {
  outgoing: HTMLElement;
  incoming: HTMLElement;
  effect: PageTransitionType;
  axis: TurnAxis;
  /** Logical turn direction: +1 = next page, -1 = previous. */
  dir: TurnDir;
  size: number;
  durationMs?: number;
  signal?: AbortSignal;
  /** book | manga — selects Stack / Depth port variant. */
  variant?: TransitionVariant;
  /**
   * When true (RTL horizontal), flip CSS slide edge without changing
   * which element is outgoing vs incoming.
   */
  mirror?: boolean;
  /**
   * Called after the last frame is held and before styles are cleared —
   * swap the real page underneath here.
   */
  commit?: () => void | Promise<void>;
  /** Optional owner key so cancelActivePageTurns can target one reader. */
  owner?: PageTurnOwner;
}

export interface PlayFoldTurnOptions {
  el: HTMLElement;
  /** Logical turn direction (next/prev). */
  dir: TurnDir;
  size: number;
  mode?: '2d' | '3d';
  durationMs?: number;
  signal?: AbortSignal;
  commit?: () => void | Promise<void>;
  owner?: PageTurnOwner;
  /** Element shown underneath the fold (incoming page). */
  underneath?: HTMLElement | null;
  /** When true (RTL), flip fold origin / angle. */
  mirror?: boolean;
}

interface ActiveTurn {
  animations: Animation[];
  driver?: PageTurnDriver;
  owner: PageTurnOwner;
  cleanup: () => void;
}

const activeByOwner = new Map<PageTurnOwner, ActiveTurn>();

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function doubleRaf(): Promise<void> {
  await nextFrame();
  await nextFrame();
}

function registerTurn(owner: PageTurnOwner, turn: ActiveTurn): void {
  cancelActivePageTurns(owner);
  activeByOwner.set(owner, turn);
}

function unregisterTurn(owner: PageTurnOwner, turn: ActiveTurn): void {
  if (activeByOwner.get(owner) === turn) {
    activeByOwner.delete(owner);
  }
}

/**
 * Cancel active page-turn animations.
 * @param owner when provided, only that reader's turns are cancelled.
 *              when omitted, all owners are cancelled.
 */
export function cancelActivePageTurns(owner?: PageTurnOwner): void {
  if (owner !== undefined) {
    const turn = activeByOwner.get(owner);
    if (!turn) return;
    for (const a of turn.animations) {
      try {
        a.cancel();
      } catch {
        /* ignore */
      }
    }
    try {
      turn.driver?.release();
    } catch {
      /* ignore */
    }
    try {
      turn.cleanup();
    } catch {
      /* ignore */
    }
    activeByOwner.delete(owner);
    return;
  }
  for (const key of [...activeByOwner.keys()]) {
    cancelActivePageTurns(key);
  }
}

function clearAnimInline(el: HTMLElement): void {
  el.style.transform = '';
  el.style.opacity = '';
  el.style.zIndex = '';
  el.style.boxShadow = '';
  el.style.willChange = '';
  el.style.transformOrigin = '';
}

/**
 * Animate outgoing + incoming layers with the chosen effect via PageTurnDriver.
 * Last frame is held until `commit` resolves, then styles clear.
 */
export async function playPageTurn(opts: PlayPageTurnOptions): Promise<void> {
  const {
    outgoing,
    incoming,
    effect,
    axis,
    dir,
    size,
    durationMs = PAGE_TURN_DURATION_MS,
    signal,
    variant = 'manga',
    mirror = false,
    commit,
    owner = 'default'
  } = opts;

  if (prefersReducedMotion() || durationMs <= 0) {
    if (commit) await commit();
    return;
  }

  // Force incoming visible before first paint (Angular bindings alone can lag).
  const inPrev = {
    visibility: incoming.style.visibility,
    zIndex: incoming.style.zIndex,
    opacity: incoming.style.opacity,
    transform: incoming.style.transform
  };
  incoming.style.visibility = 'visible';
  incoming.style.opacity = '1';
  incoming.style.transform = 'none';
  incoming.style.zIndex = '1';
  outgoing.style.zIndex = '2';

  const visualDir = (mirror ? -dir : dir) as TurnDir;
  const driver = new PageTurnDriver({
    outgoing,
    incoming,
    effect,
    axis,
    dir: visualDir,
    size,
    variant
  });

  const cleanup = () => {
    driver.release();
    incoming.style.visibility = inPrev.visibility;
    incoming.style.zIndex = inPrev.zIndex;
    incoming.style.opacity = inPrev.opacity;
    incoming.style.transform = inPrev.transform;
  };

  const turn: ActiveTurn = { animations: [], driver, owner, cleanup };
  registerTurn(owner, turn);

  const abort = () => {
    driver.release();
  };
  signal?.addEventListener('abort', abort, { once: true });

  try {
    // Target outgoing end position: next → -1, prev → +1 (visual)
    await driver.animateTo(-visualDir, durationMs, commit);
  } catch {
    /* cancelled */
  } finally {
    signal?.removeEventListener('abort', abort);
    cleanup();
    unregisterTurn(owner, turn);
  }
}

/**
 * CSS 3D fold turn for book reader (iframe can't be cheaply rasterized).
 * Rotates the outgoing element around the fold edge to ~90° with
 * backface-visibility hidden so the underneath (incoming) page is revealed.
 * A crease shadow overlays the fold line.
 */
export async function playFoldTurn(opts: PlayFoldTurnOptions): Promise<void> {
  const {
    el,
    dir,
    size,
    mode = '2d',
    durationMs = PAGE_TURN_DURATION_MS,
    signal,
    commit,
    owner = 'default',
    underneath,
    mirror = false
  } = opts;

  if (prefersReducedMotion() || durationMs <= 0) {
    if (commit) await commit();
    return;
  }

  cancelActivePageTurns(owner);

  const host = el.parentElement;
  if (!host) {
    if (commit) await commit();
    return;
  }

  const visualDir = (mirror ? -dir : dir) as TurnDir;

  // Snapshot underneath styles so we can restore them exactly
  const underPrev = underneath
    ? {
        visibility: underneath.style.visibility,
        zIndex: underneath.style.zIndex,
        opacity: underneath.style.opacity,
        transform: underneath.style.transform
      }
    : null;

  if (underneath) {
    underneath.style.visibility = 'visible';
    underneath.style.zIndex = '1';
    underneath.style.opacity = '1';
    underneath.style.transform = 'none';
  }

  // Next folds around the left (spine) edge; previous around the right (visual).
  const origin = visualDir > 0 ? 'left center' : 'right center';
  const endAngle = visualDir > 0 ? -95 : 95;
  const tilt = mode === '3d' ? 6 : 0;

  el.style.zIndex = '2';
  el.style.transformOrigin = origin;
  el.style.backfaceVisibility = 'hidden';
  (el.style as CSSStyleDeclaration & { webkitBackfaceVisibility?: string }).webkitBackfaceVisibility =
    'hidden';
  el.style.willChange = 'transform';
  el.style.opacity = '1';

  const shadow = document.createElement('div');
  shadow.style.cssText = [
    'position:absolute',
    'top:0',
    'bottom:0',
    visualDir > 0 ? 'left:0' : 'right:0',
    'width:18%',
    'max-width:96px',
    'pointer-events:none',
    'z-index:4',
    visualDir > 0
      ? 'background:linear-gradient(to right, rgba(0,0,0,0.5), transparent)'
      : 'background:linear-gradient(to left, rgba(0,0,0,0.5), transparent)',
    'opacity:0'
  ].join(';');
  host.appendChild(shadow);

  const frames: Keyframe[] = [
    {
      transform: `perspective(1400px) rotateY(0deg) rotateX(0deg)`,
      offset: 0
    },
    {
      transform: `perspective(1400px) rotateY(${endAngle * 0.55}deg) rotateX(${tilt * 0.5}deg)`,
      offset: 0.55
    },
    {
      transform: `perspective(1400px) rotateY(${endAngle}deg) rotateX(${tilt}deg)`,
      offset: 1
    }
  ];

  const shadowFrames: Keyframe[] = [
    { opacity: 0 },
    { opacity: 0.9 },
    { opacity: 0.15 }
  ];

  const timing: KeyframeAnimationOptions = {
    duration: durationMs,
    easing: 'linear',
    fill: 'forwards'
  };

  const foldAnim = el.animate(frames, timing);
  const shadowAnim = shadow.animate(shadowFrames, timing);

  const cleanup = () => {
    try {
      shadow.remove();
    } catch {
      /* ignore */
    }
    clearAnimInline(el);
    el.style.backfaceVisibility = '';
    (el.style as CSSStyleDeclaration & { webkitBackfaceVisibility?: string }).webkitBackfaceVisibility =
      '';
    if (underneath && underPrev) {
      underneath.style.visibility = underPrev.visibility;
      underneath.style.zIndex = underPrev.zIndex;
      underneath.style.opacity = underPrev.opacity;
      underneath.style.transform = underPrev.transform;
    }
    void size;
  };

  const turn: ActiveTurn = { animations: [foldAnim, shadowAnim], owner, cleanup };
  registerTurn(owner, turn);

  const abort = () => {
    try {
      foldAnim.cancel();
    } catch {
      /* ignore */
    }
    try {
      shadowAnim.cancel();
    } catch {
      /* ignore */
    }
  };
  signal?.addEventListener('abort', abort, { once: true });

  try {
    await Promise.all([foldAnim.finished, shadowAnim.finished]);
    if (commit) await commit();
    await doubleRaf();
  } catch {
    /* cancelled */
  } finally {
    signal?.removeEventListener('abort', abort);
    try {
      foldAnim.cancel();
    } catch {
      /* ignore */
    }
    try {
      shadowAnim.cancel();
    } catch {
      /* ignore */
    }
    cleanup();
    unregisterTurn(owner, turn);
  }
}

/**
 * @deprecated Use playFoldTurn — kept as thin alias for any leftover callers.
 */
export async function playCssCurlTurn(
  el: HTMLElement,
  dir: TurnDir,
  durationMs = PAGE_TURN_DURATION_MS,
  signal?: AbortSignal
): Promise<void> {
  await playFoldTurn({
    el,
    dir,
    size: el.clientWidth || window.innerWidth,
    mode: '2d',
    durationMs,
    signal
  });
}
