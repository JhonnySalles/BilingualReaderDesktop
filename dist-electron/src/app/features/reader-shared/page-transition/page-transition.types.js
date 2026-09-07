"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAGE_TURN_EASING = exports.PAGE_TURN_DURATION_MS = exports.PAGE_TRANSITION_OPTIONS = exports.PAGE_TRANSITION_LABELS_PT = exports.PageTransitionType = void 0;
exports.isPageTransitionType = isPageTransitionType;
exports.prefersReducedMotion = prefersReducedMotion;
/**
 * Page turn animation types — values match Android PaginationType.toString()
 * so preference keys remain portable across platforms.
 *
 * Do NOT confuse with PaginationType in reader-enums.ts (PAGE_NUMBER | PERCENTAGE | CHAPTER).
 */
var PageTransitionType;
(function (PageTransitionType) {
    PageTransitionType["Default"] = "Default";
    PageTransitionType["Stack"] = "Stack";
    PageTransitionType["Zooming"] = "Zooming";
    PageTransitionType["CurlPage"] = "CurlPage";
    PageTransitionType["Curl3DPage"] = "Curl3DPage";
    PageTransitionType["Depth"] = "Depth";
    PageTransitionType["Fade"] = "Fade";
})(PageTransitionType || (exports.PageTransitionType = PageTransitionType = {}));
exports.PAGE_TRANSITION_LABELS_PT = {
    [PageTransitionType.Default]: 'Padrão',
    [PageTransitionType.Stack]: 'Pilhas de página',
    [PageTransitionType.Zooming]: 'Zoom de página',
    [PageTransitionType.CurlPage]: 'Ondulação de página',
    [PageTransitionType.Curl3DPage]: 'Ondulação de página 3D',
    [PageTransitionType.Depth]: 'Profundidade de página',
    [PageTransitionType.Fade]: 'Desbotamento de página'
};
exports.PAGE_TRANSITION_OPTIONS = Object.values(PageTransitionType);
/** Manga ViewPager custom scroller duration (AccelerateDecelerateInterpolator). */
exports.PAGE_TURN_DURATION_MS = 400;
/** CSS equivalent of Android AccelerateDecelerateInterpolator. */
exports.PAGE_TURN_EASING = 'cubic-bezier(0.45, 0, 0.55, 1)';
function isPageTransitionType(value) {
    return typeof value === 'string' && exports.PAGE_TRANSITION_OPTIONS.includes(value);
}
function prefersReducedMotion() {
    if (typeof window === 'undefined' || !window.matchMedia)
        return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
