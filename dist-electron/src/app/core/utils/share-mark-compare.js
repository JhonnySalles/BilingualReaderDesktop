"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scaleBookBookmarkFromCloud = scaleBookBookmarkFromCloud;
/** Pure book bookmark scaling used by ShareMark compare (Android parity). */
function scaleBookBookmarkFromCloud(book, item) {
    if ((book.pages ?? 1) <= 1 && item.pages > 1) {
        return item.bookMark;
    }
    if (item.completed || item.bookMark >= item.pages) {
        return book.pages ?? 1;
    }
    const percent = item.pages > 0 ? item.bookMark / item.pages : 0;
    let mark = Math.round((book.pages ?? 1) * percent);
    if (mark < 0)
        mark = 0;
    else if (mark > (book.pages ?? 1))
        mark = book.pages ?? 1;
    return mark;
}
