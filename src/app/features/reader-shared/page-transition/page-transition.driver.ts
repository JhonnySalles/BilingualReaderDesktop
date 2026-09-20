import {
  PAGE_TURN_DURATION_MS,
  PageTransitionType,
  TurnAxis,
  TurnDir
} from '../../../core/models/enums/page-transition.enums';
import {
  TransitionVariant,
  accelerateDecelerate,
  pageStyleAt,
  styleToCss
} from './page-transition.math';

export interface PageTurnDriverOptions {
  outgoing: HTMLElement;
  incoming: HTMLElement;
  effect: PageTransitionType;
  axis: TurnAxis;
  dir: TurnDir;
  size: number;
  variant?: TransitionVariant;
  /**
   * When provided, CSS transforms are skipped and this callback paints
   * the frame (curl canvas path). Position is the outgoing ViewPager position.
   */
  paint?: (position: number) => void;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function doubleRaf(): Promise<void> {
  await nextFrame();
  await nextFrame();
}

function clearInline(el: HTMLElement): void {
  el.style.transform = '';
  el.style.opacity = '';
  el.style.zIndex = '';
  el.style.boxShadow = '';
  el.style.willChange = '';
  el.style.transformOrigin = '';
}

/**
 * ViewPager-style position driver.
 *
 * Outgoing position = p, incoming position = p + dir.
 * - Next (dir=1): p goes 0 → -1; incoming goes 1 → 0
 * - Prev (dir=-1): p goes 0 → +1; incoming goes -1 → 0
 */
export class PageTurnDriver {
  private readonly outgoing: HTMLElement;
  private readonly incoming: HTMLElement;
  private readonly effect: PageTransitionType;
  private readonly axis: TurnAxis;
  private readonly dir: TurnDir;
  private readonly size: number;
  private readonly variant: TransitionVariant;
  private readonly paint?: (position: number) => void;

  private position = 0;
  private animating = false;
  private rafId = 0;
  private zApplied = false;
  private animResolve: (() => void) | null = null;
  private cancelled = false;

  constructor(opts: PageTurnDriverOptions) {
    this.outgoing = opts.outgoing;
    this.incoming = opts.incoming;
    this.effect = opts.effect;
    this.axis = opts.axis;
    this.dir = opts.dir;
    this.size = opts.size;
    this.variant = opts.variant ?? 'manga';
    this.paint = opts.paint;
  }

  /** Current outgoing ViewPager position. */
  getPosition(): number {
    return this.position;
  }

  /** Apply styles immediately (gesture scrub). */
  setPosition(p: number): void {
    this.position = Math.max(-1, Math.min(1, p));
    this.apply();
  }

  /**
   * Animate from the current position to `target` with AccelerateDecelerate.
   * Holds the last frame, runs `commit`, then releases styles.
   */
  async animateTo(
    target: number,
    durationMs = PAGE_TURN_DURATION_MS,
    commit?: () => void | Promise<void>
  ): Promise<void> {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.cancelled = false;
    this.animating = true;
    const from = this.position;
    const to = Math.max(-1, Math.min(1, target));
    const duration = Math.max(0, durationMs);

    if (duration <= 0 || from === to) {
      this.setPosition(to);
      if (commit) await commit();
      await doubleRaf();
      this.release();
      this.animating = false;
      return;
    }

    await new Promise<void>(resolve => {
      this.animResolve = resolve;
      const start = performance.now();
      const tick = (now: number) => {
        if (this.cancelled || !this.animResolve) return;
        const t = Math.min(1, (now - start) / duration);
        const eased = accelerateDecelerate(t);
        this.position = from + (to - from) * eased;
        this.apply();
        if (t >= 1) {
          this.rafId = 0;
          const r = this.animResolve;
          this.animResolve = null;
          r?.();
          return;
        }
        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    });

    if (this.cancelled) {
      this.animating = false;
      return;
    }

    try {
      if (commit) await commit();
      await doubleRaf();
    } finally {
      this.release();
      this.animating = false;
    }
  }

  /** Clear inline styles from both layers. */
  release(): void {
    this.cancelled = true;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    if (this.animResolve) {
      const r = this.animResolve;
      this.animResolve = null;
      r();
    }
    clearInline(this.outgoing);
    clearInline(this.incoming);
    this.zApplied = false;
    this.animating = false;
  }

  isAnimating(): boolean {
    return this.animating;
  }

  private apply(): void {
    const outPos = this.position;
    const inPos = this.position + this.dir;

    if (this.paint) {
      this.paint(outPos);
      // Incoming stays anchored underneath for curl (canvas paints everything)
      if (!this.zApplied) {
        this.outgoing.style.zIndex = '2';
        this.incoming.style.zIndex = '1';
        this.zApplied = true;
      }
      return;
    }

    const outStyle = pageStyleAt(this.effect, outPos, this.axis, this.size, this.variant);
    const inStyle = pageStyleAt(this.effect, inPos, this.axis, this.size, this.variant);

    if (!this.zApplied) {
      // Mid-path elevation for stable stacking during the turn
      const midOut = pageStyleAt(
        this.effect,
        outPos === 0 ? -this.dir * 0.5 : outPos,
        this.axis,
        this.size,
        this.variant
      );
      const midIn = pageStyleAt(
        this.effect,
        inPos === this.dir ? this.dir * 0.5 : inPos,
        this.axis,
        this.size,
        this.variant
      );
      this.outgoing.style.zIndex = midOut.elevated ? '2' : '1';
      this.incoming.style.zIndex = midIn.elevated ? '2' : '1';
      this.outgoing.style.willChange = 'transform, opacity';
      this.incoming.style.willChange = 'transform, opacity';
      this.zApplied = true;
    }

    Object.assign(this.outgoing.style, styleToCss(outStyle));
    Object.assign(this.incoming.style, styleToCss(inStyle));
  }
}
