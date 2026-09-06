"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANNOTATION_MARK_OPTIONS = exports.ANNOTATION_COLOR_OPTIONS = void 0;
const book_model_1 = require("./book.model");
exports.ANNOTATION_COLOR_OPTIONS = [
    { value: 'None', label: 'Sem cor', hex: null },
    { value: book_model_1.BookAnnotationColor.Yellow, label: 'Amarelo', hex: '#e6b800' },
    { value: book_model_1.BookAnnotationColor.Red, label: 'Vermelho', hex: '#ff4d4d' },
    { value: book_model_1.BookAnnotationColor.Green, label: 'Verde', hex: '#00e600' },
    { value: book_model_1.BookAnnotationColor.Blue, label: 'Azul', hex: '#668cff' }
];
exports.ANNOTATION_MARK_OPTIONS = [
    { value: 'Favorite', label: 'Favorito' },
    { value: 'Detach', label: 'Destaque' },
    { value: 'PageMark', label: 'Marca de página' },
    { value: 'BookMark', label: 'Marcador' }
];
