/**
 * Page turn animation types — values match Android PaginationType.toString()
 * so preference keys remain portable across platforms.
 *
 * Do NOT confuse with PaginationType in this file (PAGE_NUMBER | PERCENTAGE | CHAPTER).
 */
export enum PageTransitionType {
  Default = 'Default',
  Stack = 'Stack',
  Zooming = 'Zooming',
  CurlPage = 'CurlPage',
  Curl3DPage = 'Curl3DPage',
  Depth = 'Depth',
  Fade = 'Fade'
}

export const PAGE_TRANSITION_LABELS_PT: Record<PageTransitionType, string> = {
  [PageTransitionType.Default]: 'Padrão',
  [PageTransitionType.Stack]: 'Pilhas de página',
  [PageTransitionType.Zooming]: 'Zoom de página',
  [PageTransitionType.CurlPage]: 'Ondulação de página',
  [PageTransitionType.Curl3DPage]: 'Ondulação de página 3D',
  [PageTransitionType.Depth]: 'Profundidade de página',
  [PageTransitionType.Fade]: 'Desbotamento de página'
};

export const PAGE_TRANSITION_OPTIONS = Object.values(PageTransitionType);

/** Manga ViewPager custom scroller duration (AccelerateDecelerateInterpolator). */
export const PAGE_TURN_DURATION_MS = 400;

/** CSS equivalent of Android AccelerateDecelerateInterpolator. */
export const PAGE_TURN_EASING = 'cubic-bezier(0.45, 0, 0.55, 1)';

export type TurnAxis = 'x' | 'y';

/** Direction of the page turn: 1 = next, -1 = previous. */
export type TurnDir = 1 | -1;

export interface PageTurnStyle {
  transform: string;
  opacity: number;
  zIndex: number;
  /** Elevation / shadow intensity 0–1 (for CSS box-shadow). */
  shadow: number;
}

export function isPageTransitionType(value: unknown): value is PageTransitionType {
  return typeof value === 'string' && PAGE_TRANSITION_OPTIONS.includes(value as PageTransitionType);
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
