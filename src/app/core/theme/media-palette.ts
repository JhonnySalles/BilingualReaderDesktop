export interface ColorShades {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

export const MANGA_PALETTE: ColorShades = {
  50: '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  300: '#a5b4fc',
  400: '#818cf8',
  500: '#6366f1',
  600: '#4f46e5',
  700: '#4338ca',
  800: '#3730a3',
  900: '#312e81',
  950: '#1e1b4b',
};

export const BOOK_PALETTE: ColorShades & { alt: string } = {
  50: '#fffbeb',
  100: '#fef3c7',
  200: '#fde68a',
  300: '#fcd34d',
  400: '#fbbf24',
  500: '#f59e0b',
  600: '#d97706',
  700: '#b45309',
  800: '#92400e',
  900: '#78350f',
  950: '#451a03',
  alt: '#f97316',
};

export type MediaType = 'manga' | 'book' | 'MANGA' | 'BOOK';

export function normalizeMediaType(type: MediaType | string | null | undefined): 'manga' | 'book' {
  if (!type) return 'manga';
  const lower = type.toLowerCase();
  return lower === 'book' ? 'book' : 'manga';
}

export function getMediaColor(type: MediaType | string | null | undefined, shade: keyof ColorShades = 500): string {
  return normalizeMediaType(type) === 'book' ? BOOK_PALETTE[shade] : MANGA_PALETTE[shade];
}

