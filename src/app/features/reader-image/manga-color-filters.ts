/** Pref keys (must match app/utils/constants.ts COLOR_FILTER / READER). */
export const MANGA_COLOR_FILTER_KEYS = {
  CUSTOM_FILTER: 'COLOR_FILTER_CUSTOM',
  COLOR_RED: 'COLOR_FILTER_RED',
  COLOR_GREEN: 'COLOR_FILTER_GREEN',
  COLOR_BLUE: 'COLOR_FILTER_BLUE',
  COLOR_ALPHA: 'COLOR_FILTER_ALPHA',
  BLUE_LIGHT: 'COLOR_FILTER_BLUE_LIGHT',
  BLUE_LIGHT_ALPHA: 'COLOR_FILTER_BLUE_LIGHT_ALPHA',
  GRAY_SCALE: 'COLOR_FILTER_GRAY_SCALE',
  INVERT_COLOR: 'COLOR_FILTER_INVERT',
  SEPIA: 'COLOR_FILTER_SEPIA'
} as const;

export const MANGA_USE_MAGNIFIER_TYPE_KEY = 'MANGA_USE_MAGNIFIER_TYPE';

/** Android-parity manga color filter state (SharedPreferences COLOR_FILTER.*). */
export interface MangaColorFilterState {
  customFilter: boolean;
  colorRed: number;
  colorGreen: number;
  colorBlue: number;
  colorAlpha: number;
  blueLight: boolean;
  blueLightAlpha: number;
  grayScale: boolean;
  invertColor: boolean;
  sepia: boolean;
}

export const DEFAULT_MANGA_COLOR_FILTER: MangaColorFilterState = {
  customFilter: false,
  colorRed: 0,
  colorGreen: 0,
  colorBlue: 0,
  colorAlpha: 0,
  blueLight: false,
  blueLightAlpha: 80,
  grayScale: false,
  invertColor: false,
  sepia: false
};

/** CSS filter chain (grayscale → invert → sepia), matching Android stack order after tints. */
export function buildPageCssFilter(s: MangaColorFilterState): string {
  const parts: string[] = [];
  if (s.grayScale) parts.push('grayscale(1)');
  if (s.invertColor) parts.push('invert(1)');
  if (s.sepia) parts.push('sepia(1)');
  return parts.join(' ');
}

/**
 * Tint overlays (custom RGBA + blue light), drawn above the image.
 * Alpha channels follow Android Color.argb (0–255); blue light uses 0–200.
 */
export function buildTintOverlays(s: MangaColorFilterState): string[] {
  const out: string[] = [];
  if (s.customFilter && s.colorAlpha > 0) {
    out.push(
      `rgba(${clampByte(s.colorRed)},${clampByte(s.colorGreen)},${clampByte(s.colorBlue)},${clampByte(s.colorAlpha) / 255})`
    );
  }
  if (s.blueLight && s.blueLightAlpha > 0) {
    const a = Math.min(200, Math.max(0, Math.round(s.blueLightAlpha))) / 255;
    out.push(`rgba(255,50,0,${a})`);
  }
  return out;
}

export function blueLightPercent(alpha: number): number {
  return Math.round((Math.min(200, Math.max(0, alpha)) * 100) / 200);
}

function clampByte(n: number): number {
  return Math.min(255, Math.max(0, Math.round(n || 0)));
}
