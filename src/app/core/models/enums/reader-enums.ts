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
  Vertical = 'Vertical',
  LongStrip = 'LongStrip',
  LongStripGap = 'LongStripGap'
}

export enum MangaFitMode {
  FitWidth = 'FitWidth',
  FitHeight = 'FitHeight',
  Original = 'Original'
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
