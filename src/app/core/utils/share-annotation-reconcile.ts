/** Shared rules for book annotation page ↔ CFI reconciliation (ShareMark + reader). */

export const ANNOTATION_PAGE_CFI_DIFF_THRESHOLD = 3;

/**
 * Scale a cloud annotation page onto the local book's page count
 * (same spirit as book bookmark sync).
 */
export function scaleAnnotationPageFromCloud(
  sharedPage: number,
  sharedPages: number,
  localPages: number
): number {
  const destPages = Math.max(1, localPages || 1);
  if (destPages <= 1 && sharedPages > 1) {
    return Math.max(0, sharedPage);
  }
  if (sharedPages <= 0) {
    return Math.min(Math.max(0, sharedPage), destPages);
  }
  if (sharedPage >= sharedPages) {
    return destPages;
  }
  let page = Math.round(destPages * (sharedPage / sharedPages));
  if (page < 0) page = 0;
  else if (page > destPages) page = destPages;
  return page;
}

export function annotationPageCfiDiffers(
  page: number,
  pageFromCfi: number,
  threshold = ANNOTATION_PAGE_CFI_DIFF_THRESHOLD
): boolean {
  return Math.abs(pageFromCfi - page) >= threshold;
}

export interface AnnotationReconcileInput {
  page: number;
  pages: number;
  cfiRange?: string | null;
  pageFromCfi?: number | null;
  cfiFromPage?: string | null;
  /** Current book location count (epub.js). */
  localPages: number;
}

export interface AnnotationReconcileResult {
  page: number;
  pages: number;
  cfiRange: string;
  changed: boolean;
}

/**
 * Reconcile page/pages/cfiRange after locations are available.
 * - Missing CFI + valid page → use cfiFromPage
 * - Valid CFI + |page - pageFromCfi| >= threshold → prefer CFI for page
 * - Broken CFI + valid page → regenerate CFI from page
 */
export function reconcileAnnotationPageAndCfi(
  input: AnnotationReconcileInput,
  threshold = ANNOTATION_PAGE_CFI_DIFF_THRESHOLD
): AnnotationReconcileResult {
  const localPages = Math.max(1, input.localPages || 1);
  let page = Math.max(0, input.page ?? 0);
  let pages = localPages;
  let cfiRange = (input.cfiRange || '').trim();
  let changed = false;

  if (page > pages) {
    page = pages;
    changed = true;
  }

  const pageFromCfi =
    input.pageFromCfi != null && !Number.isNaN(input.pageFromCfi)
      ? Math.max(0, input.pageFromCfi)
      : null;
  const cfiFromPage = (input.cfiFromPage || '').trim();

  if (!cfiRange) {
    if (cfiFromPage) {
      cfiRange = cfiFromPage;
      changed = true;
    }
    return { page, pages, cfiRange, changed };
  }

  if (pageFromCfi != null) {
    if (annotationPageCfiDiffers(page, pageFromCfi, threshold)) {
      page = Math.min(pageFromCfi, pages);
      changed = true;
    }
    return { page, pages, cfiRange, changed };
  }

  // CFI present but could not resolve location — regenerate from page if possible
  if (cfiFromPage) {
    cfiRange = cfiFromPage;
    changed = true;
  }

  return { page, pages, cfiRange, changed };
}
