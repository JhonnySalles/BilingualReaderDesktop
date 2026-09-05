"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TouchScreen = exports.ImageLoadType = exports.PaginationType = exports.ScrollingType = exports.LibraryBookType = exports.LibraryMangaType = exports.BookScrollingMode = exports.BookLayout = exports.MangaFitMode = exports.MangaScrollingMode = exports.ReaderMode = void 0;
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
    MangaScrollingMode["Vertical"] = "Vertical";
    MangaScrollingMode["LongStrip"] = "LongStrip";
    MangaScrollingMode["LongStripGap"] = "LongStripGap";
})(MangaScrollingMode || (exports.MangaScrollingMode = MangaScrollingMode = {}));
var MangaFitMode;
(function (MangaFitMode) {
    MangaFitMode["FitWidth"] = "FitWidth";
    MangaFitMode["FitHeight"] = "FitHeight";
    MangaFitMode["Original"] = "Original";
})(MangaFitMode || (exports.MangaFitMode = MangaFitMode = {}));
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
var TouchScreen;
(function (TouchScreen) {
    TouchScreen["NONE"] = "NONE";
    TouchScreen["TAP_NEXT"] = "TAP_NEXT";
    TouchScreen["SWIPE"] = "SWIPE";
})(TouchScreen || (exports.TouchScreen = TouchScreen = {}));
