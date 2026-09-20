import {
  PageTransitionType,
  PageTurnStyle,
  TurnAxis,
  TurnDir
} from '../../../core/models/enums/page-transition.enums';

/** Android ZoomPageTransform.MIN_SCALE */
const MIN_ZOOM_SCALE = 0.9;

export type TransitionVariant = 'book' | 'manga';

/**
 * Pure ViewPager-style transform at a given position in [-1, 1].
 *
 * Ported from Android PageTransformers.kt (book) and ImageViewPager.kt (manga).
 * Desktop has no native pager slide, so styles that leave translation at 0 on
 * Android must add `position * size` here; styles that anchor with
 * `translationX = -position * width` stay at the origin.
 *
 * General rule: the layer with `position < 0` moves and is elevated; the layer
 * with `position > 0` stays anchored underneath. Book Stack is the documented
 * exception (elevates `position > 0`).
 */
export function pageStyleAt(
  effect: PageTransitionType,
  position: number,
  axis: TurnAxis,
  size: number,
  variant: TransitionVariant = 'manga'
): PageTurnStyle {
  if (position < -1 || position > 1) {
    return { transform: 'none', opacity: 0, zIndex: 0, shadow: 0, elevated: false };
  }

  switch (effect) {
    case PageTransitionType.Stack:
      return variant === 'book'
        ? bookStackStyle(position, axis, size)
        : mangaStackStyle(position, axis, size);
    case PageTransitionType.Zooming:
      return zoomStyle(position, axis, size);
    case PageTransitionType.Fade:
      return fadeStyle(position);
    case PageTransitionType.Depth:
      return depthStyle(position, axis, size);
    case PageTransitionType.CurlPage:
    case PageTransitionType.Curl3DPage:
      return curlCssStyle(position);
    case PageTransitionType.Default:
    default:
      return defaultStyle(position, axis, size);
  }
}

/**
 * Build keyframe style positions for a full page turn.
 * @param dir 1 = next (outgoing slides toward -1), -1 = previous
 */
export function turnKeyframePositions(dir: TurnDir): { outgoing: number[]; incoming: number[] } {
  const outStart = 0;
  const outEnd = -dir;
  const inStart = dir;
  const inEnd = 0;
  return {
    outgoing: samplePositions(outStart, outEnd),
    incoming: samplePositions(inStart, inEnd)
  };
}

/** Android AccelerateDecelerateInterpolator. */
export function accelerateDecelerate(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return (1 - Math.cos(x * Math.PI)) / 2;
}

/** Dense position samples with AccelerateDecelerate applied to progress. */
export function samplePositions(from: number, to: number, steps = 24): number[] {
  const n = Math.max(1, steps);
  return Array.from({ length: n + 1 }, (_, i) => from + (to - from) * accelerateDecelerate(i / n));
}

function translate(axis: TurnAxis, amount: number): string {
  return axis === 'x' ? `translateX(${amount}px)` : `translateY(${amount}px)`;
}

function compose(parts: string[]): string {
  const filtered = parts.filter(Boolean);
  return filtered.length ? filtered.join(' ') : 'none';
}

function style(
  transform: string,
  opacity: number,
  elevated: boolean,
  shadow = elevated ? 0.5 : 0
): PageTurnStyle {
  return {
    transform,
    opacity,
    zIndex: elevated ? 2 : 1,
    shadow,
    elevated
  };
}

/**
 * Default / HorizontalPageTransformer / VerticalPageTransformer.
 * Android leaves translationX=0 (native slide) on horizontal; vertical anchors X
 * and applies translationY = position * height.
 */
function defaultStyle(position: number, axis: TurnAxis, size: number): PageTurnStyle {
  const amount = position * size;
  return style(translate(axis, amount), 1, false, Math.abs(position) > 0 ? 0.3 : 0);
}

/**
 * Manga StackPageTransform (LTR / Vertical).
 * position < 0: slides with native offset + elevation.
 * position >= 0: anchored at center, no elevation.
 */
function mangaStackStyle(position: number, axis: TurnAxis, size: number): PageTurnStyle {
  const elevated = position < 0;
  if (axis === 'y') {
    // Vertical: cancel native X, Y only when position < 0
    const ty = position < 0 ? position * size : 0;
    return style(translate('y', ty), 1, elevated);
  }
  // Horizontal LTR: position < 0 keeps native slide; position >= 0 anchors
  if (position < 0) {
    return style(translate('x', position * size), 1, true);
  }
  return style('none', 1, false, 0);
}

/**
 * Book StackPageTransform — documented exception: elevates position > 0.
 * Android anchors with translationX = -position * width on the positive side
 * of some branches, but uses page.width * position (double native) in others.
 * Desktop: anchored = no translate; sliding positive = 2 * position * size.
 */
function bookStackStyle(position: number, axis: TurnAxis, size: number): PageTurnStyle {
  if (position <= 0) {
    const alpha = 1 + position;
    const scale = 0.75 + 0.25 * (1 - Math.abs(position));
    return style(compose([`scale(${scale})`]), Math.max(0, alpha), false, 0);
  }

  if (position > 0.5) {
    // Android: translationX = -position * width (anchored) + alpha 0
    return style('none', 0, false, 0);
  }

  const amount = 2 * position * size;
  let scale: number;
  if (position > 0.3) {
    scale = 0.75;
  } else {
    const v = Math.min(0.3 - position, 0.25);
    scale = 0.75 + v;
  }
  return style(compose([translate(axis, amount), `scale(${scale})`]), 1, true);
}

/**
 * ZoomPageTransform — scale only on -1 < position < 0; alpha fades both sides.
 */
function zoomStyle(position: number, axis: TurnAxis, size: number): PageTurnStyle {
  const amount = position * size;
  let alpha = 0;
  let scale = 1;
  if (position >= 0 && position <= 1) {
    alpha = 1 - position;
  } else if (position > -1 && position < 0) {
    scale = Math.max(MIN_ZOOM_SCALE, 1 - Math.abs(position));
    alpha = position + 1;
  }

  const parts = [translate(axis, amount)];
  if (scale !== 1) parts.push(`scale(${scale})`);
  return style(compose(parts), Math.max(0, Math.min(1, alpha)), false, Math.abs(position) > 0 ? 0.3 : 0);
}

/**
 * FadePageTransformer — anchors (cancels native slide), crossfade in place.
 */
function fadeStyle(position: number): PageTurnStyle {
  const alpha = 1 - Math.abs(position);
  return style('none', Math.max(0, Math.min(1, alpha)), position <= 0, 0);
}

/**
 * DepthPageTransformer (LTR / shared book+manga horizontal).
 * position <= 0: elevated sliding top layer (native slide).
 * position > 0: anchored underneath, scale+fade with 1 - |position|.
 *
 * Manga overlay hosts an opaque underlay so scaling this leaf never
 * reveals the carousel (which would look like a stuck third page).
 */
function depthStyle(position: number, axis: TurnAxis, size: number): PageTurnStyle {
  if (position <= 0) {
    return style(translate(axis, position * size), 1, position < 0);
  }
  const progress = Math.abs(position);
  const scale = 1 - progress;
  const alpha = 1 - progress;
  return style(compose([`scale(${Math.max(0, scale)})`]), Math.max(0, alpha), false, 0);
}

/** Curl CSS layer — anchored; canvas paints the curl. Elevated when position < 0. */
function curlCssStyle(position: number): PageTurnStyle {
  return style('none', 1, position < 0, 0);
}

/**
 * Convert a PageTurnStyle to CSS keyframe properties.
 * Does NOT include zIndex — the player sets that once from `elevated`.
 */
export function styleToCss(style: PageTurnStyle): Record<string, string> {
  const shadow =
    style.shadow > 0
      ? `0 ${8 * style.shadow}px ${24 * style.shadow}px rgba(0,0,0,${0.45 * style.shadow})`
      : 'none';
  return {
    transform: style.transform,
    opacity: String(style.opacity),
    boxShadow: shadow
  };
}
