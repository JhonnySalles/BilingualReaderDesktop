"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOOK_ANNOTATION_COLOR_HEX = exports.BookAnnotationColor = void 0;
/** Highlight colors — names match Android Color enum; hex from Color.getHtmlColor(). */
var BookAnnotationColor;
(function (BookAnnotationColor) {
    BookAnnotationColor["Yellow"] = "Yellow";
    BookAnnotationColor["Green"] = "Green";
    BookAnnotationColor["Blue"] = "Blue";
    BookAnnotationColor["Red"] = "Red";
})(BookAnnotationColor || (exports.BookAnnotationColor = BookAnnotationColor = {}));
exports.BOOK_ANNOTATION_COLOR_HEX = {
    [BookAnnotationColor.Yellow]: '#e6b800',
    [BookAnnotationColor.Green]: '#00e600',
    [BookAnnotationColor.Blue]: '#668cff',
    [BookAnnotationColor.Red]: '#ff4d4d'
};
