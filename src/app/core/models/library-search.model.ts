export type LibrarySearchScope = 'manga' | 'book' | 'history';

export type LibraryFilterKind =
  | 'Author'
  | 'Publisher'
  | 'Series'
  | 'Type'
  | 'Volume'
  | 'Tag';

export interface LibraryFilterDef {
  kind: LibraryFilterKind;
  /** Primary PT-BR label shown in suggestions (e.g. Autor). */
  label: string;
  /** Extra aliases accepted when typing (@Author, @Autor, etc.). */
  aliases: string[];
}

export interface LibrarySearchToken {
  kind: LibraryFilterKind;
  /** Display label used when formatting (PT-BR). */
  label: string;
  value: string;
  /** Full matched substring including @ and optional quotes. */
  raw: string;
  index: number;
}

export interface ParsedLibrarySearch {
  tokens: LibrarySearchToken[];
  freeText: string;
  /** True when the last @ segment is incomplete (typing @Autor or @Autor:). */
  hasIncompleteAt: boolean;
}

export interface LibrarySearchCatalog {
  authors: string[];
  publishers: string[];
  series: string[];
  volumes: string[];
  tags: string[];
  types: string[];
}

export interface LibrarySearchSuggestion {
  kind: 'type' | 'value';
  /** Text inserted on select (e.g. @Autor: or @Autor:"Nome" ). */
  insertText: string;
  /** Visible label in the dropdown. */
  label: string;
  /** Optional filter kind for type suggestions. */
  filterKind?: LibraryFilterKind;
  /** Highlight fragment already typed after : */
  matchHint?: string;
}

export interface LibrarySearchableItem {
  title?: string;
  name?: string;
  author?: string;
  publisher?: string;
  series?: string;
  volume?: string;
  fileType?: string;
  tags?: string | null;
}

export const LIBRARY_SEARCH_DEBOUNCE_MS = 500;

export const MANGA_FILTER_DEFS: LibraryFilterDef[] = [
  { kind: 'Author', label: 'Autor', aliases: ['Author', 'Autor'] },
  { kind: 'Publisher', label: 'Editora', aliases: ['Publisher', 'Editora'] },
  { kind: 'Series', label: 'Série', aliases: ['Series', 'Serie', 'Série'] },
  { kind: 'Type', label: 'Tipo', aliases: ['Type', 'Tipo'] },
  { kind: 'Volume', label: 'Volume', aliases: ['Volume'] }
];

export const BOOK_FILTER_DEFS: LibraryFilterDef[] = [
  { kind: 'Author', label: 'Autor', aliases: ['Author', 'Autor'] },
  { kind: 'Publisher', label: 'Editora', aliases: ['Publisher', 'Editora'] },
  { kind: 'Tag', label: 'Tag', aliases: ['Tag'] },
  { kind: 'Type', label: 'Tipo', aliases: ['Type', 'Tipo'] }
];

/** Manga filters first, then book-only Tag — mirrors Android getHistoryFilters(). */
export const HISTORY_FILTER_DEFS: LibraryFilterDef[] = (() => {
  const byKind = new Map<LibraryFilterKind, LibraryFilterDef>();
  for (const def of MANGA_FILTER_DEFS) {
    byKind.set(def.kind, def);
  }
  for (const def of BOOK_FILTER_DEFS) {
    if (!byKind.has(def.kind)) {
      byKind.set(def.kind, def);
    }
  }
  return Array.from(byKind.values());
})();

export function getFilterDefs(scope: LibrarySearchScope): LibraryFilterDef[] {
  switch (scope) {
    case 'manga':
      return MANGA_FILTER_DEFS;
    case 'book':
      return BOOK_FILTER_DEFS;
    case 'history':
      return HISTORY_FILTER_DEFS;
  }
}

export function emptyLibrarySearchCatalog(): LibrarySearchCatalog {
  return {
    authors: [],
    publishers: [],
    series: [],
    volumes: [],
    tags: [],
    types: []
  };
}
