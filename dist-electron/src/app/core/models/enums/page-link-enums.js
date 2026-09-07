"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DUAL_PAGE_RATIO = exports.PAGE_EMPTY = exports.PageLinkSlot = void 0;
/** Slot / list type used by the manga page-link editor (not annotation PageLinkType). */
var PageLinkSlot;
(function (PageLinkSlot) {
    PageLinkSlot["LINKED"] = "LINKED";
    PageLinkSlot["NOT_LINKED"] = "NOT_LINKED";
    PageLinkSlot["DUAL_PAGE"] = "DUAL_PAGE";
    PageLinkSlot["MANGA"] = "MANGA";
    PageLinkSlot["ALL"] = "ALL";
})(PageLinkSlot || (exports.PageLinkSlot = PageLinkSlot = {}));
exports.PAGE_EMPTY = -1;
/** Aspect ratio above which an image is treated as a dual/spread page. */
exports.DUAL_PAGE_RATIO = 0.9;
