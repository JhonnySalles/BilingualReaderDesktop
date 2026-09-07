import {
  PageTransitionType,
  PageTurnStyle,
  TurnAxis,
  TurnDir
} from '../../../core/models/enums/page-transition.enums';

const MIN_ZOOM_SCALE = 0.9;

/**
 * Pure ViewPager-style transform at a given position in [-1, 1].
 * Ported from Android PageTransformers.kt (book) with vertical axis support.
 *
 * For a page turn animation:
 * - Outgoing page (leaving toward dir): position goes 0 → -dir
 * - Incoming page (entering from -dir): position goes dir → 0
 */
export function pageStyleAt(
  effect: PageTransitionType,
  position: number,
  axis: TurnAxis,
  size: number
): PageTurnStyle {
  if (position < -1 || position > 1) {
    return { transform: 'none', opacity: 0, zIndex: 0, shadow: 0 };
  }

  switch (effect) {
    case PageTransitionType.Stack:
      return stackStyle(position, axis, size);
    case PageTransitionType.Zooming:
      return zoomStyle(position, axis, size);
    case PageTransitionType.Fade:
      return fadeStyle(position, axis, size);
    case PageTransitionType.Depth:
      return depthStyle(position, axis, size);
    case PageTransitionType.CurlPage:
    case PageTransitionType.Curl3DPage:
      // Curl uses canvas overlay; CSS layer just cancels default slide.
      return curlCssStyle(position, axis, size);
    case PageTransitionType.Default:
    default:
      return defaultStyle(position, axis, size);
  }
}

/**
 * Build keyframe styles for a full page turn.
 * @param dir 1 = next (outgoing slides left/up), -1 = previous
 */
export function turnKeyframePositions(dir: TurnDir): { outgoing: number[]; incoming: number[] } {
  // Outgoing leaves toward -dir; incoming arrives from +dir
  const outStart = 0;
  const outEnd = -dir;
  const inStart = dir;
  const inEnd = 0;
  const steps = [0, 0.25, 0.5, 0.75, 1];
  return {
    outgoing: steps.map(t => outStart + (outEnd - outStart) * t),
    incoming: steps.map(t => inStart + (inEnd - inStart) * t)
  };
}

function translate(axis: TurnAxis, amount: number): string {
  return axis === 'x' ? `translateX(${amount}px)` : `translateY(${amount}px)`;
}

function compose(parts: string[]): string {
  const filtered = parts.filter(Boolean);
  return filtered.length ? filtered.join(' ') : 'none';
}

function defaultStyle(position: number, axis: TurnAxis, size: number): PageTurnStyle {
  // Classic slide: cancel ViewPager default by staying put visually relative to container.
  // For overlay turns we translate by -position * size so the page slides with the gesture.
  const amount = -position * size;
  return {
    transform: translate(axis, amount),
    opacity: 1,
    zIndex: 1,
    shadow: 0
  };
}

function stackStyle(position: number, axis: TurnAxis, size: number): PageTurnStyle {
  // Book StackPageTransform
  let alpha = 1;
  let scale = 1;
  let amount = 0;
  let z = 0;
  let shadow = 0;

  if (position <= 0) {
    alpha = 1 + position;
    scale = 0.75 + 0.25 * (1 - Math.abs(position));
    amount = -position * size;
  } else if (position > 0.5) {
    alpha = 0;
    amount = -position * size;
    z = 20;
    shadow = 0.6;
  } else if (position > 0.3) {
    alpha = 1;
    scale = 0.75;
    amount = position * size;
    z = 20;
    shadow = 0.5;
  } else {
    // (0, 0.3]
    alpha = 1;
    scale = 0.75 + Math.min(0.3 - position, 0.25);
    amount = position * size;
    z = 20;
    shadow = 0.4;
  }

  return {
    transform: compose([translate(axis, amount), `scale(${scale})`]),
    opacity: Math.max(0, Math.min(1, alpha)),
    zIndex: z,
    shadow
  };
}

function zoomStyle(position: number, axis: TurnAxis, size: number): PageTurnStyle {
  let alpha = 0;
  let scale = 1;

  if (position >= 0 && position <= 1) {
    alpha = 1 - position;
  } else if (position > -1 && position < 0) {
    scale = Math.max(MIN_ZOOM_SCALE, 1 - Math.abs(position));
    alpha = position + 1;
  }

  // Manga vertical remap
  const amount = -position * size;
  return {
    transform: compose([translate(axis, amount), `scale(${scale})`]),
    opacity: Math.max(0, Math.min(1, alpha)),
    zIndex: 1,
    shadow: 0
  };
}

function fadeStyle(position: number, axis: TurnAxis, size: number): PageTurnStyle {
  const amount = -position * size;
  return {
    transform: translate(axis, amount),
    opacity: Math.max(0, Math.min(1, 1 - Math.abs(position))),
    zIndex: 1,
    shadow: 0
  };
}

function depthStyle(position: number, axis: TurnAxis, size: number): PageTurnStyle {
  if (position <= 0) {
    return {
      transform: 'none',
      opacity: 1,
      zIndex: position < 0 ? 20 : 1,
      shadow: position < 0 ? 0.5 : 0
    };
  }
  const a = 1 - Math.abs(position);
  const amount = -position * size;
  return {
    transform: compose([translate(axis, amount), `scale(${a})`]),
    opacity: Math.max(0, Math.min(1, a)),
    zIndex: 0,
    shadow: 0
  };
}

function curlCssStyle(position: number, axis: TurnAxis, size: number): PageTurnStyle {
  // Same as book CurlPageTransformer CSS part
  if (position <= -1 || position >= 1) {
    return { transform: 'none', opacity: 0, zIndex: 0, shadow: 0 };
  }
  const amount = -position * size;
  return {
    transform: translate(axis, amount),
    opacity: 1,
    zIndex: position < 0 ? 2 : 1,
    shadow: 0
  };
}

/** CSS 3D curl approximation for the book reader (no canvas rasterization). */
export function bookCssCurlStyle(
  progress: number, // 0 = flat, 1 = fully turned
  dir: TurnDir,
  size: number
): PageTurnStyle {
  const angle = progress * 180 * dir;
  const origin = dir > 0 ? 'left center' : 'right center';
  return {
    transform: `perspective(1200px) rotateY(${-angle}deg)`,
    opacity: 1,
    zIndex: 2,
    shadow: progress * 0.6
  };
}

export function styleToCss(style: PageTurnStyle): Record<string, string> {
  const shadow =
    style.shadow > 0
      ? `0 ${8 * style.shadow}px ${24 * style.shadow}px rgba(0,0,0,${0.45 * style.shadow})`
      : 'none';
  return {
    transform: style.transform,
    opacity: String(style.opacity),
    zIndex: String(style.zIndex),
    boxShadow: shadow
  };
}
