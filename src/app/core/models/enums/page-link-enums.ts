/** Slot / list type used by the manga page-link editor (not annotation PageLinkType). */
export enum PageLinkSlot {
  LINKED = 'LINKED',
  NOT_LINKED = 'NOT_LINKED',
  DUAL_PAGE = 'DUAL_PAGE',
  MANGA = 'MANGA',
  ALL = 'ALL'
}

export const PAGE_EMPTY = -1;

/** Aspect ratio above which an image is treated as a dual/spread page. */
export const DUAL_PAGE_RATIO = 0.9;
