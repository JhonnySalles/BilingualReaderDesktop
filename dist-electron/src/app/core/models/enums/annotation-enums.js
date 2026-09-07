"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Import = exports.HistoryType = exports.PageLinkType = exports.MarkType = void 0;
var MarkType;
(function (MarkType) {
    MarkType["HIGHLIGHT"] = "HIGHLIGHT";
    MarkType["UNDERLINE"] = "UNDERLINE";
    MarkType["BOOKMARK"] = "BOOKMARK";
    MarkType["NOTE"] = "NOTE";
})(MarkType || (exports.MarkType = MarkType = {}));
var PageLinkType;
(function (PageLinkType) {
    PageLinkType["INTERNAL"] = "INTERNAL";
    PageLinkType["EXTERNAL"] = "EXTERNAL";
    PageLinkType["DICTIONARY"] = "DICTIONARY";
})(PageLinkType || (exports.PageLinkType = PageLinkType = {}));
var HistoryType;
(function (HistoryType) {
    HistoryType["MANGA"] = "MANGA";
    HistoryType["BOOK"] = "BOOK";
    HistoryType["VOCABULARY"] = "VOCABULARY";
})(HistoryType || (exports.HistoryType = HistoryType = {}));
var Import;
(function (Import) {
    Import["FILE"] = "FILE";
    Import["FOLDER"] = "FOLDER";
    Import["URL"] = "URL";
})(Import || (exports.Import = Import = {}));
