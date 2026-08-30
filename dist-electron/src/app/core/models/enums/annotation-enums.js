"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Import = exports.HistoryType = exports.PageLinkType = exports.ShareMarkCloud = exports.ShareMarkType = exports.MarkType = void 0;
var MarkType;
(function (MarkType) {
    MarkType["HIGHLIGHT"] = "HIGHLIGHT";
    MarkType["UNDERLINE"] = "UNDERLINE";
    MarkType["BOOKMARK"] = "BOOKMARK";
    MarkType["NOTE"] = "NOTE";
})(MarkType || (exports.MarkType = MarkType = {}));
var ShareMarkType;
(function (ShareMarkType) {
    ShareMarkType["EXPORT"] = "EXPORT";
    ShareMarkType["IMPORT"] = "IMPORT";
    ShareMarkType["CLOUD_SYNC"] = "CLOUD_SYNC";
})(ShareMarkType || (exports.ShareMarkType = ShareMarkType = {}));
var ShareMarkCloud;
(function (ShareMarkCloud) {
    ShareMarkCloud["GOOGLE_DRIVE"] = "GOOGLE_DRIVE";
    ShareMarkCloud["ONEDRIVE"] = "ONEDRIVE";
    ShareMarkCloud["DROPBOX"] = "DROPBOX";
    ShareMarkCloud["LOCAL"] = "LOCAL";
})(ShareMarkCloud || (exports.ShareMarkCloud = ShareMarkCloud = {}));
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
