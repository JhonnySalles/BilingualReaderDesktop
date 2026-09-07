import { Injectable, computed, effect, signal } from '@angular/core';
import {
  LIBRARY_SEARCH_DEBOUNCE_MS,
  LibrarySearchCatalog,
  LibrarySearchScope,
  LibrarySearchSuggestion,
  LibrarySearchToken,
  ParsedLibrarySearch,
  emptyLibrarySearchCatalog
} from '../models/library-search.model';
import { HistoryContentType } from '../models/entities/history.model';
import { MangaLibraryService } from './manga-library.service';
import { BookLibraryService } from './book-library.service';
import {
  buildBookCatalog,
  buildMangaCatalog,
  catalogForScope
} from '../utils/library-search.catalog';
import { parseLibrarySearch, removeTokenFromQuery } from '../utils/library-search.parser';
import { buildLibrarySearchSuggestions, shouldPauseFiltering } from '../utils/library-search.suggestions';
import { itemMatchesSearch, isSearchActive } from '../utils/library-search.filter';
import { LibrarySearchableItem } from '../models/library-search.model';

@Injectable({ providedIn: 'root' })
export class LibrarySearchService {
  readonly debounceMs = LIBRARY_SEARCH_DEBOUNCE_MS;

  /** Optional history toggle — affects Type suggestions for history scope. */
  readonly historyContentType = signal<HistoryContentType | null>(null);

  private readonly mangaCatalog = signal<LibrarySearchCatalog>(emptyLibrarySearchCatalog());
  private readonly bookCatalog = signal<LibrarySearchCatalog>(emptyLibrarySearchCatalog());

  readonly catalogsReady = computed(
    () => this.mangaCatalog().authors.length >= 0 && this.bookCatalog().authors.length >= 0
  );

  constructor(
    private readonly mangaLibrary: MangaLibraryService,
    private readonly bookLibrary: BookLibraryService
  ) {
    effect(() => {
      const mangas = this.mangaLibrary.mangas();
      this.mangaCatalog.set(buildMangaCatalog(mangas));
    });

    effect(() => {
      const books = this.bookLibrary.books();
      this.bookCatalog.set(buildBookCatalog(books));
    });
  }

  getCatalog(scope: LibrarySearchScope): LibrarySearchCatalog {
    return catalogForScope(
      scope,
      this.mangaCatalog(),
      this.bookCatalog(),
      scope === 'history' ? this.historyContentType() : null
    );
  }

  parse(query: string, scope: LibrarySearchScope): ParsedLibrarySearch {
    return parseLibrarySearch(query, scope);
  }

  getSuggestions(query: string, scope: LibrarySearchScope): LibrarySearchSuggestion[] {
    return buildLibrarySearchSuggestions(query, scope, this.getCatalog(scope));
  }

  shouldPauseFiltering(query: string): boolean {
    return shouldPauseFiltering(query);
  }

  matches(
    item: LibrarySearchableItem,
    query: string,
    scope: LibrarySearchScope
  ): boolean {
    const parsed = this.parse(query, scope);
    if (!isSearchActive(parsed)) return true;
    return itemMatchesSearch(item, parsed, scope);
  }

  filterItems<T extends LibrarySearchableItem>(
    items: T[],
    query: string,
    scope: LibrarySearchScope
  ): T[] {
    const parsed = this.parse(query, scope);
    if (!isSearchActive(parsed)) return items;
    return items.filter(item => itemMatchesSearch(item, parsed, scope));
  }

  removeToken(query: string, token: LibrarySearchToken): string {
    return removeTokenFromQuery(query, token);
  }
}
