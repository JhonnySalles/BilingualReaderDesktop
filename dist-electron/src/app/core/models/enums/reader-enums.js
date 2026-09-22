"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TouchPosition = exports.TouchScreen = exports.ImageLoadType = exports.PaginationType = exports.ScrollingType = exports.LibraryBookType = exports.LibraryMangaType = exports.BookScrollingMode = exports.BookLayout = exports.BOOK_PAGE_SIZE_LABELS = exports.BookPageSize = exports.MangaFitMode = exports.MangaScrollingMode = exports.ReaderMode = void 0;
exports.isMangaDualMode = isMangaDualMode;
exports.isMangaHorizontalMode = isMangaHorizontalMode;
exports.isMangaRtlMode = isMangaRtlMode;
exports.isMangaVerticalMode = isMangaVerticalMode;
exports.isMangaLongStripMode = isMangaLongStripMode;
exports.getBookPageVirtualDimensions = getBookPageVirtualDimensions;
var ReaderMode;
(function (ReaderMode) {
    ReaderMode["DEFAULT"] = "DEFAULT";
    ReaderMode["CONTINUOUS_VERTICAL"] = "CONTINUOUS_VERTICAL";
    ReaderMode["CONTINUOUS_HORIZONTAL"] = "CONTINUOUS_HORIZONTAL";
    ReaderMode["PAGINATED_LTR"] = "PAGINATED_LTR";
    ReaderMode["PAGINATED_RTL"] = "PAGINATED_RTL";
    ReaderMode["WEBTOON"] = "WEBTOON";
})(ReaderMode || (exports.ReaderMode = ReaderMode = {}));
var MangaScrollingMode;
(function (MangaScrollingMode) {
    MangaScrollingMode["Horizontal"] = "Horizontal";
    MangaScrollingMode["HorizontalRtl"] = "HorizontalRtl";
    MangaScrollingMode["HorizontalDual"] = "HorizontalDual";
    MangaScrollingMode["HorizontalDualRtl"] = "HorizontalDualRtl";
    MangaScrollingMode["Vertical"] = "Vertical";
    MangaScrollingMode["VerticalDual"] = "VerticalDual";
    MangaScrollingMode["LongStrip"] = "LongStrip";
    MangaScrollingMode["LongStripGap"] = "LongStripGap";
})(MangaScrollingMode || (exports.MangaScrollingMode = MangaScrollingMode = {}));
var MangaFitMode;
(function (MangaFitMode) {
    MangaFitMode["FitWidth"] = "FitWidth";
    MangaFitMode["FitHeight"] = "FitHeight";
    MangaFitMode["Original"] = "Original";
})(MangaFitMode || (exports.MangaFitMode = MangaFitMode = {}));
function isMangaDualMode(m) {
    return (m === MangaScrollingMode.HorizontalDual ||
        m === MangaScrollingMode.HorizontalDualRtl ||
        m === MangaScrollingMode.VerticalDual);
}
function isMangaHorizontalMode(m) {
    return (m === MangaScrollingMode.Horizontal ||
        m === MangaScrollingMode.HorizontalRtl ||
        m === MangaScrollingMode.HorizontalDual ||
        m === MangaScrollingMode.HorizontalDualRtl);
}
function isMangaRtlMode(m) {
    return (m === MangaScrollingMode.HorizontalRtl ||
        m === MangaScrollingMode.HorizontalDualRtl);
}
function isMangaVerticalMode(m) {
    return m === MangaScrollingMode.Vertical || m === MangaScrollingMode.VerticalDual;
}
function isMangaLongStripMode(m) {
    return m === MangaScrollingMode.LongStrip || m === MangaScrollingMode.LongStripGap;
}
var BookPageSize;
(function (BookPageSize) {
    BookPageSize["DYNAMIC"] = "DYNAMIC";
    BookPageSize["HD_720"] = "HD_720";
    BookPageSize["FHD_1080"] = "FHD_1080";
})(BookPageSize || (exports.BookPageSize = BookPageSize = {}));
exports.BOOK_PAGE_SIZE_LABELS = {
    [BookPageSize.DYNAMIC]: 'Dinâmico (Tela / DPI Fixo)',
    [BookPageSize.HD_720]: 'HD 720p (800 × 1200)',
    [BookPageSize.FHD_1080]: 'Full HD 1080p (1080 × 1620)'
};
function getBookPageVirtualDimensions(size) {
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
var BookLayout;
(function (BookLayout) {
    BookLayout["SINGLE_PAGE"] = "SINGLE_PAGE";
    BookLayout["DOUBLE_PAGE"] = "DOUBLE_PAGE";
    BookLayout["CONTINUOUS"] = "CONTINUOUS";
})(BookLayout || (exports.BookLayout = BookLayout = {}));
var BookScrollingMode;
(function (BookScrollingMode) {
    BookScrollingMode["Pagination"] = "Pagination";
    BookScrollingMode["PaginationRtl"] = "PaginationRtl";
    BookScrollingMode["PaginationVertical"] = "PaginationVertical";
    BookScrollingMode["Continuous"] = "Continuous";
})(BookScrollingMode || (exports.BookScrollingMode = BookScrollingMode = {}));
var LibraryMangaType;
(function (LibraryMangaType) {
    LibraryMangaType["GRID_SMALL"] = "GRID_SMALL";
    LibraryMangaType["GRID_MEDIUM"] = "GRID_MEDIUM";
    LibraryMangaType["GRID_BIG"] = "GRID_BIG";
    LibraryMangaType["GRID_OVERLAY"] = "GRID_OVERLAY";
    LibraryMangaType["SEPARATOR_BIG"] = "SEPARATOR_BIG";
    LibraryMangaType["SEPARATOR_MEDIUM"] = "SEPARATOR_MEDIUM";
    LibraryMangaType["SEPARATOR_OVERLAY"] = "SEPARATOR_OVERLAY";
    LibraryMangaType["SEPARATOR_CAROUSEL"] = "SEPARATOR_CAROUSEL";
    LibraryMangaType["SEPARATOR_LINE"] = "SEPARATOR_LINE";
    LibraryMangaType["LINE"] = "LINE";
})(LibraryMangaType || (exports.LibraryMangaType = LibraryMangaType = {}));
var LibraryBookType;
(function (LibraryBookType) {
    LibraryBookType["GRID_SMALL"] = "GRID_SMALL";
    LibraryBookType["GRID_MEDIUM"] = "GRID_MEDIUM";
    LibraryBookType["GRID_BIG"] = "GRID_BIG";
    LibraryBookType["GRID_OVERLAY"] = "GRID_OVERLAY";
    LibraryBookType["SEPARATOR_OVERLAY"] = "SEPARATOR_OVERLAY";
    LibraryBookType["LINE"] = "LINE";
})(LibraryBookType || (exports.LibraryBookType = LibraryBookType = {}));
var ScrollingType;
(function (ScrollingType) {
    ScrollingType["SMOOTH"] = "SMOOTH";
    ScrollingType["PAGE"] = "PAGE";
    ScrollingType["OFF"] = "OFF";
})(ScrollingType || (exports.ScrollingType = ScrollingType = {}));
var PaginationType;
(function (PaginationType) {
    PaginationType["PAGE_NUMBER"] = "PAGE_NUMBER";
    PaginationType["PERCENTAGE"] = "PERCENTAGE";
    PaginationType["CHAPTER"] = "CHAPTER";
})(PaginationType || (exports.PaginationType = PaginationType = {}));
var ImageLoadType;
(function (ImageLoadType) {
    ImageLoadType["FIT_SCREEN"] = "FIT_SCREEN";
    ImageLoadType["FIT_WIDTH"] = "FIT_WIDTH";
    ImageLoadType["FIT_HEIGHT"] = "FIT_HEIGHT";
    ImageLoadType["ORIGINAL"] = "ORIGINAL";
})(ImageLoadType || (exports.ImageLoadType = ImageLoadType = {}));
/** Configurable click-zone actions (Android TouchScreen). CENTER is fixed chrome toggle. */
var TouchScreen;
(function (TouchScreen) {
    TouchScreen["NOT_IMPLEMENTED"] = "NOT_IMPLEMENTED";
    TouchScreen["NOT_ASSIGNED"] = "NOT_ASSIGNED";
    TouchScreen["ASPECT_FIT"] = "ASPECT_FIT";
    TouchScreen["FIT_WIDTH"] = "FIT_WIDTH";
    TouchScreen["CHAPTER_LIST"] = "CHAPTER_LIST";
    TouchScreen["NEXT_FILE"] = "NEXT_FILE";
    TouchScreen["PREVIOUS_FILE"] = "PREVIOUS_FILE";
    TouchScreen["NEXT_PAGE"] = "NEXT_PAGE";
    TouchScreen["PREVIOUS_PAGE"] = "PREVIOUS_PAGE";
    TouchScreen["SHARE_IMAGE"] = "SHARE_IMAGE";
    TouchScreen["PAGE_MARK"] = "PAGE_MARK";
})(TouchScreen || (exports.TouchScreen = TouchScreen = {}));
/** 3×3 grid positions for reader click zones. */
var TouchPosition;
(function (TouchPosition) {
    TouchPosition["TOP"] = "TOP";
    TouchPosition["BOTTOM"] = "BOTTOM";
    TouchPosition["RIGHT"] = "RIGHT";
    TouchPosition["LEFT"] = "LEFT";
    TouchPosition["CORNER_TOP_RIGHT"] = "CORNER_TOP_RIGHT";
    TouchPosition["CORNER_TOP_LEFT"] = "CORNER_TOP_LEFT";
    TouchPosition["CORNER_BOTTOM_RIGHT"] = "CORNER_BOTTOM_RIGHT";
    TouchPosition["CORNER_BOTTOM_LEFT"] = "CORNER_BOTTOM_LEFT";
    TouchPosition["CENTER"] = "CENTER";
})(TouchPosition || (exports.TouchPosition = TouchPosition = {}));
