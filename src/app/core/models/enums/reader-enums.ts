export enum ReaderMode {
  DEFAULT = 'DEFAULT',
  CONTINUOUS_VERTICAL = 'CONTINUOUS_VERTICAL',
  CONTINUOUS_HORIZONTAL = 'CONTINUOUS_HORIZONTAL',
  PAGINATED_LTR = 'PAGINATED_LTR',
  PAGINATED_RTL = 'PAGINATED_RTL',
  WEBTOON = 'WEBTOON'
}

export enum MangaScrollingMode {
  Horizontal = 'Horizontal',
  HorizontalRtl = 'HorizontalRtl',
  HorizontalDual = 'HorizontalDual',
  HorizontalDualRtl = 'HorizontalDualRtl',
  Vertical = 'Vertical',
  VerticalDual = 'VerticalDual',
  LongStrip = 'LongStrip',
  LongStripGap = 'LongStripGap'
}

export enum MangaFitMode {
  FitWidth = 'FitWidth',
  FitHeight = 'FitHeight',
  Original = 'Original'
}

export function isMangaDualMode(m: MangaScrollingMode): boolean {
  return (
    m === MangaScrollingMode.HorizontalDual ||
    m === MangaScrollingMode.HorizontalDualRtl ||
    m === MangaScrollingMode.VerticalDual
  );
}

export function isMangaHorizontalMode(m: MangaScrollingMode): boolean {
  return (
    m === MangaScrollingMode.Horizontal ||
    m === MangaScrollingMode.HorizontalRtl ||
    m === MangaScrollingMode.HorizontalDual ||
    m === MangaScrollingMode.HorizontalDualRtl
  );
}

export function isMangaRtlMode(m: MangaScrollingMode): boolean {
  return (
    m === MangaScrollingMode.HorizontalRtl ||
    m === MangaScrollingMode.HorizontalDualRtl
  );
}

export function isMangaVerticalMode(m: MangaScrollingMode): boolean {
  return m === MangaScrollingMode.Vertical || m === MangaScrollingMode.VerticalDual;
}

export function isMangaLongStripMode(m: MangaScrollingMode): boolean {
  return m === MangaScrollingMode.LongStrip || m === MangaScrollingMode.LongStripGap;
}

export enum BookPageSize {
  DYNAMIC = 'DYNAMIC',
  HD_720 = 'HD_720',
  FHD_1080 = 'FHD_1080'
}

export const BOOK_PAGE_SIZE_LABELS: Record<BookPageSize, string> = {
  [BookPageSize.DYNAMIC]: 'Dinâmico (Tela / DPI Fixo)',
  [BookPageSize.HD_720]: 'HD 720p (800 × 1200)',
  [BookPageSize.FHD_1080]: 'Full HD 1080p (1080 × 1620)'
};

export function getBookPageVirtualDimensions(size: BookPageSize): { width: number; height: number } {
  switch (size) {
    case BookPageSize.HD_720:
      return { width: 800, height: 1200 };
    case BookPageSize.FHD_1080:
      return { width: 1080, height: 1620 };
    case BookPageSize.DYNAMIC:
    default: {
      if (typeof window !== 'undefined' && window.screen) {
        const dpr = window.devicePixelRatio || 1;
        const sw = Math.round((window.screen.width || 1920) * dpr);
        const sh = Math.round((window.screen.height || 1080) * dpr);
        return {
          width: Math.max(600, Math.min(sw, 1920)),
          height: Math.max(800, Math.min(sh, 2880))
        };
      }
      return { width: 1080, height: 1620 };
    }
  }
}

export enum BookLayout {
  SINGLE_PAGE = 'SINGLE_PAGE',
  DOUBLE_PAGE = 'DOUBLE_PAGE',
  CONTINUOUS = 'CONTINUOUS'
}

export enum BookScrollingMode {
  Pagination = 'Pagination',
  PaginationRtl = 'PaginationRtl',
  PaginationVertical = 'PaginationVertical',
  Continuous = 'Continuous'
}

export type BookAlign = 'justify' | 'left' | 'center' | 'right';
export type BookMarginSize = 'small' | 'medium' | 'large';
export type BookSpacingSize = 'small' | 'medium' | 'large';

export enum LibraryMangaType {
  GRID_SMALL = 'GRID_SMALL',
  GRID_MEDIUM = 'GRID_MEDIUM',
  GRID_BIG = 'GRID_BIG',
  GRID_OVERLAY = 'GRID_OVERLAY',
  SEPARATOR_BIG = 'SEPARATOR_BIG',
  SEPARATOR_MEDIUM = 'SEPARATOR_MEDIUM',
  SEPARATOR_OVERLAY = 'SEPARATOR_OVERLAY',
  SEPARATOR_CAROUSEL = 'SEPARATOR_CAROUSEL',
  SEPARATOR_LINE = 'SEPARATOR_LINE',
  LINE = 'LINE'
}

export enum LibraryBookType {
  GRID_SMALL = 'GRID_SMALL',
  GRID_MEDIUM = 'GRID_MEDIUM',
  GRID_BIG = 'GRID_BIG',
  GRID_OVERLAY = 'GRID_OVERLAY',
  SEPARATOR_OVERLAY = 'SEPARATOR_OVERLAY',
  LINE = 'LINE'
}

export enum ScrollingType {
  SMOOTH = 'SMOOTH',
  PAGE = 'PAGE',
  OFF = 'OFF'
}

export enum PaginationType {
  PAGE_NUMBER = 'PAGE_NUMBER',
  PERCENTAGE = 'PERCENTAGE',
  CHAPTER = 'CHAPTER'
}

export enum ImageLoadType {
  FIT_SCREEN = 'FIT_SCREEN',
  FIT_WIDTH = 'FIT_WIDTH',
  FIT_HEIGHT = 'FIT_HEIGHT',
  ORIGINAL = 'ORIGINAL'
}

/** Configurable click-zone actions (Android TouchScreen). CENTER is fixed chrome toggle. */
export enum TouchScreen {
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  NOT_ASSIGNED = 'NOT_ASSIGNED',
  ASPECT_FIT = 'ASPECT_FIT',
  FIT_WIDTH = 'FIT_WIDTH',
  CHAPTER_LIST = 'CHAPTER_LIST',
  NEXT_FILE = 'NEXT_FILE',
  PREVIOUS_FILE = 'PREVIOUS_FILE',
  NEXT_PAGE = 'NEXT_PAGE',
  PREVIOUS_PAGE = 'PREVIOUS_PAGE',
  SHARE_IMAGE = 'SHARE_IMAGE',
  PAGE_MARK = 'PAGE_MARK'
}

/** 3×3 grid positions for reader click zones. */
export enum TouchPosition {
  TOP = 'TOP',
  BOTTOM = 'BOTTOM',
  RIGHT = 'RIGHT',
  LEFT = 'LEFT',
  CORNER_TOP_RIGHT = 'CORNER_TOP_RIGHT',
  CORNER_TOP_LEFT = 'CORNER_TOP_LEFT',
  CORNER_BOTTOM_RIGHT = 'CORNER_BOTTOM_RIGHT',
  CORNER_BOTTOM_LEFT = 'CORNER_BOTTOM_LEFT',
  CENTER = 'CENTER'
}

export type ReaderTouchType = 'manga' | 'book';

/** Persisted map of outer zones (CENTER is never stored). */
export type TouchZoneMap = Record<Exclude<TouchPosition, TouchPosition.CENTER>, TouchScreen>;
