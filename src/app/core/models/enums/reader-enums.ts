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

export enum TouchScreen {
  NONE = 'NONE',
  TAP_NEXT = 'TAP_NEXT',
  SWIPE = 'SWIPE'
}
