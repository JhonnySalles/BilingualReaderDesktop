"use strict";
/** Cloud sync payload — field names match Android ShareItem (PT-BR on the wire). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHARE_MARK_INITIAL_SYNC = exports.SHARE_ITEM_KEY_DATE_FORMAT = exports.SHARE_MARK_DATE_FORMAT = exports.SHARE_MARK_FILE_FIELDS = exports.SHARE_ANNOTATION_FIELDS = exports.SHARE_HISTORY_FIELDS = exports.SHARE_ITEM_FIELDS = void 0;
exports.SHARE_ITEM_FIELDS = {
    FILE: 'arquivo',
    BOOKMARK: 'bookMark',
    PAGES: 'paginas',
    COMPLETED: 'completo',
    FAVORITE: 'favorito',
    LAST_ACCESS: 'ultimoAcesso',
    SYNC: 'sincronizado',
    HISTORY: 'historico',
    ANNOTATION: 'anotacao'
};
exports.SHARE_HISTORY_FIELDS = {
    PAGE_START: 'paginaInicial',
    PAGE_END: 'paginaFinal',
    PAGES: 'paginas',
    COMPLETED: 'completo',
    VOLUME: 'volume',
    CHAPTERS_READ: 'capitulosLidos',
    START: 'inicio',
    END: 'final',
    SECONDS_READ: 'segundosLidos',
    AVERAGE_TIME_BY_PAGE: 'mediaTempoPorPagina',
    USE_TTS: 'usadoTTS'
};
exports.SHARE_ANNOTATION_FIELDS = {
    PAGE: 'pagina',
    PAGES: 'paginas',
    FONT_SIZE: 'fonteTamanho',
    TYPE: 'tipo',
    CHAPTER_NUMBER: 'capituloNumero',
    CHAPTER: 'capitulo',
    TEXT: 'texto',
    RANGE: 'range',
    ANNOTATION: 'anotacao',
    FAVORITE: 'favorito',
    COLOR: 'cor',
    CREATED: 'criado',
    CFI_RANGE: 'cfiRange'
};
exports.SHARE_MARK_FILE_FIELDS = {
    ORIGIN: 'origem',
    LAST_ALTERATION: 'alteracao',
    TYPE: 'tipo',
    MARKS: 'itens'
};
exports.SHARE_MARK_DATE_FORMAT = "yyyy-MM-dd'T'HH:mm:ss.SSSZ";
exports.SHARE_ITEM_KEY_DATE_FORMAT = 'yyyy-MM-dd-HH:mm:ss';
exports.SHARE_MARK_INITIAL_SYNC = '2000-01-01T01:01:01.001-0300';
