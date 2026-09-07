"use strict";
/** Shared rules for book annotation page ↔ CFI reconciliation (ShareMark + reader). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANNOTATION_PAGE_CFI_DIFF_THRESHOLD = void 0;
exports.scaleAnnotationPageFromCloud = scaleAnnotationPageFromCloud;
exports.annotationPageCfiDiffers = annotationPageCfiDiffers;
exports.reconcileAnnotationPageAndCfi = reconcileAnnotationPageAndCfi;
exports.ANNOTATION_PAGE_CFI_DIFF_THRESHOLD = 3;
/**
 * Scale a cloud annotation page onto the local book's page count
 * (same spirit as book bookmark sync).
 */
function scaleAnnotationPageFromCloud(sharedPage, sharedPages, localPages) {
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
    if (page < 0)
        page = 0;
    else if (page > destPages)
        page = destPages;
    return page;
}
function annotationPageCfiDiffers(page, pageFromCfi, threshold = exports.ANNOTATION_PAGE_CFI_DIFF_THRESHOLD) {
    return Math.abs(pageFromCfi - page) >= threshold;
}
/**
 * Reconcile page/pages/cfiRange after locations are available.
 * - Missing CFI + valid page → use cfiFromPage
 * - Valid CFI + |page - pageFromCfi| >= threshold → prefer CFI for page
 * - Broken CFI + valid page → regenerate CFI from page
 */
function reconcileAnnotationPageAndCfi(input, threshold = exports.ANNOTATION_PAGE_CFI_DIFF_THRESHOLD) {
    const localPages = Math.max(1, input.localPages || 1);
    let page = Math.max(0, input.page ?? 0);
    let pages = localPages;
    let cfiRange = (input.cfiRange || '').trim();
    let changed = false;
    if (page > pages) {
        page = pages;
        changed = true;
    }
    const pageFromCfi = input.pageFromCfi != null && !Number.isNaN(input.pageFromCfi)
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
