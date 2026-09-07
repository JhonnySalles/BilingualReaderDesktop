import {
  PAGE_TURN_DURATION_MS,
  PAGE_TURN_EASING,
  PageTransitionType,
  TurnAxis,
  TurnDir,
  prefersReducedMotion
} from '../../../core/models/enums/page-transition.enums';
import { pageStyleAt, styleToCss, turnKeyframePositions } from './page-transition.math';

export interface PlayPageTurnOptions {
  outgoing: HTMLElement;
  incoming: HTMLElement;
  effect: PageTransitionType;
  axis: TurnAxis;
  dir: TurnDir;
  size: number;
  durationMs?: number;
  signal?: AbortSignal;
}

let activeAnimations: Animation[] = [];

export function cancelActivePageTurns(): void {
  for (const a of activeAnimations) {
    try {
      a.cancel();
    } catch {
      /* ignore */
    }
  }
  activeAnimations = [];
}

/**
 * Animate outgoing + incoming layers with the chosen effect.
 * Positions follow ViewPager convention via turnKeyframePositions.
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
    signal
  } = opts;

  if (
    effect === PageTransitionType.Default ||
    prefersReducedMotion() ||
    durationMs <= 0
  ) {
    return;
  }

  cancelActivePageTurns();

  const { outgoing: outPos, incoming: inPos } = turnKeyframePositions(dir);
  const outFrames = outPos.map(p => styleToCss(pageStyleAt(effect, p, axis, size)));
  const inFrames = inPos.map(p => styleToCss(pageStyleAt(effect, p, axis, size)));

  // Seed starting styles so first frame isn't a flash
  Object.assign(outgoing.style, outFrames[0]);
  Object.assign(incoming.style, inFrames[0]);
  outgoing.style.willChange = 'transform, opacity';
  incoming.style.willChange = 'transform, opacity';

  const timing: KeyframeAnimationOptions = {
    duration: durationMs,
    easing: PAGE_TURN_EASING,
    fill: 'forwards'
  };

  const outAnim = outgoing.animate(outFrames as Keyframe[], timing);
  const inAnim = incoming.animate(inFrames as Keyframe[], timing);
  activeAnimations = [outAnim, inAnim];

  const abort = () => {
    outAnim.cancel();
    inAnim.cancel();
  };
  signal?.addEventListener('abort', abort, { once: true });

  try {
    await Promise.all([outAnim.finished, inAnim.finished]);
  } catch {
    /* cancelled */
  } finally {
    signal?.removeEventListener('abort', abort);
    activeAnimations = activeAnimations.filter(a => a !== outAnim && a !== inAnim);
    outgoing.style.willChange = '';
    incoming.style.willChange = '';
  }
}

/**
 * Animate a CSS 3D curl on a single element (book reader fallback).
 */
export async function playCssCurlTurn(
  el: HTMLElement,
  dir: TurnDir,
  durationMs = PAGE_TURN_DURATION_MS,
  signal?: AbortSignal
): Promise<void> {
  if (prefersReducedMotion()) return;
  cancelActivePageTurns();

  const origin = dir > 0 ? 'left center' : 'right center';
  el.style.transformOrigin = origin;
  el.style.willChange = 'transform';

  const frames: Keyframe[] = [
    { transform: 'perspective(1200px) rotateY(0deg)', opacity: 1 },
    {
      transform: `perspective(1200px) rotateY(${dir > 0 ? -90 : 90}deg)`,
      opacity: 0.85
    },
    {
      transform: `perspective(1200px) rotateY(${dir > 0 ? -180 : 180}deg)`,
      opacity: 0
    }
  ];

  const anim = el.animate(frames, {
    duration: durationMs,
    easing: PAGE_TURN_EASING,
    fill: 'forwards'
  });
  activeAnimations = [anim];

  const abort = () => anim.cancel();
  signal?.addEventListener('abort', abort, { once: true });

  try {
    await anim.finished;
  } catch {
    /* cancelled */
  } finally {
    signal?.removeEventListener('abort', abort);
    activeAnimations = activeAnimations.filter(a => a !== anim);
    el.style.willChange = '';
  }
}
