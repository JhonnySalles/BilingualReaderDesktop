"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HISTORY_FILTER_DEFS = exports.BOOK_FILTER_DEFS = exports.MANGA_FILTER_DEFS = exports.LIBRARY_SEARCH_DEBOUNCE_MS = void 0;
exports.getFilterDefs = getFilterDefs;
exports.emptyLibrarySearchCatalog = emptyLibrarySearchCatalog;
exports.LIBRARY_SEARCH_DEBOUNCE_MS = 500;
exports.MANGA_FILTER_DEFS = [
    { kind: 'Author', label: 'Autor', aliases: ['Author', 'Autor'] },
    { kind: 'Publisher', label: 'Editora', aliases: ['Publisher', 'Editora'] },
    { kind: 'Series', label: 'Série', aliases: ['Series', 'Serie', 'Série'] },
    { kind: 'Type', label: 'Tipo', aliases: ['Type', 'Tipo'] },
    { kind: 'Volume', label: 'Volume', aliases: ['Volume'] }
];
exports.BOOK_FILTER_DEFS = [
    { kind: 'Author', label: 'Autor', aliases: ['Author', 'Autor'] },
    { kind: 'Publisher', label: 'Editora', aliases: ['Publisher', 'Editora'] },
    { kind: 'Tag', label: 'Tag', aliases: ['Tag'] },
    { kind: 'Type', label: 'Tipo', aliases: ['Type', 'Tipo'] }
];
/** Manga filters first, then book-only Tag — mirrors Android getHistoryFilters(). */
exports.HISTORY_FILTER_DEFS = (() => {
    const byKind = new Map();
    for (const def of exports.MANGA_FILTER_DEFS) {
        byKind.set(def.kind, def);
    }
    for (const def of exports.BOOK_FILTER_DEFS) {
        if (!byKind.has(def.kind)) {
            byKind.set(def.kind, def);
        }
    }
    return Array.from(byKind.values());
})();
function getFilterDefs(scope) {
    switch (scope) {
        case 'manga':
            return exports.MANGA_FILTER_DEFS;
        case 'book':
            return exports.BOOK_FILTER_DEFS;
        case 'history':
            return exports.HISTORY_FILTER_DEFS;
    }
}
function emptyLibrarySearchCatalog() {
    return {
        authors: [],
        publishers: [],
        series: [],
        volumes: [],
        tags: [],
        types: []
    };
}
