import {
  getBookFileTypes,
  getMangaFileTypes
} from '../models/enums/app-enums';
import { Book } from '../models/entities/book.model';
import { Manga } from '../models/entities/manga.model';
import {
  emptyLibrarySearchCatalog,
  LibrarySearchCatalog,
  LibrarySearchScope
} from '../models/library-search.model';
import { parseTagsField } from './library-search.filter';

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).map(v => v.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
}

function splitAuthors(author: string | undefined | null, stripTrailingDot: boolean): string[] {
  if (!author?.trim()) return [];
  const parts = author.includes(',')
    ? author.split(',').map(p => p.trim())
    : [author.trim()];
  return parts
    .map(p => (stripTrailingDot && p.endsWith('.') ? p.slice(0, -1).trim() : p))
    .filter(Boolean);
}

export function buildMangaCatalog(mangas: Manga[]): LibrarySearchCatalog {
  const authors = new Set<string>();
  const publishers = new Set<string>();
  const series = new Set<string>();
  const volumes = new Set<string>();

  for (const m of mangas ?? []) {
    for (const a of splitAuthors(m.author, true)) {
      authors.add(a);
    }
    if (m.publisher?.trim()) publishers.add(m.publisher.trim());
    if (m.series?.trim()) series.add(m.series.trim());
    if (m.volume?.trim()) volumes.add(m.volume.trim());
  }

  return {
    authors: uniqueSorted(authors),
    publishers: uniqueSorted(publishers),
    series: uniqueSorted(series),
    volumes: uniqueSorted(volumes),
    tags: [],
    types: getMangaFileTypes().map(String)
  };
}

export function buildBookCatalog(books: Book[]): LibrarySearchCatalog {
  const authors = new Set<string>();
  const publishers = new Set<string>();
  const tags = new Set<string>();

  for (const b of books ?? []) {
    for (const a of splitAuthors(b.author, false)) {
      authors.add(a);
    }
    if (b.publisher?.trim()) publishers.add(b.publisher.trim());
    for (const t of parseTagsField(b.tags)) {
      tags.add(t);
    }
  }

  return {
    authors: uniqueSorted(authors),
    publishers: uniqueSorted(publishers),
    series: [],
    volumes: [],
    tags: uniqueSorted(tags),
    types: getBookFileTypes().map(String)
  };
}

export function mergeCatalogs(
  manga: LibrarySearchCatalog,
  book: LibrarySearchCatalog,
  typeSource: 'manga' | 'book' | 'both' = 'both'
): LibrarySearchCatalog {
  const types =
    typeSource === 'manga'
      ? manga.types
      : typeSource === 'book'
        ? book.types
        : uniqueSorted([...manga.types, ...book.types]);

  return {
    authors: uniqueSorted([...manga.authors, ...book.authors]),
    publishers: uniqueSorted([...manga.publishers, ...book.publishers]),
    series: uniqueSorted([...manga.series, ...book.series]),
    volumes: uniqueSorted([...manga.volumes, ...book.volumes]),
    tags: uniqueSorted([...manga.tags, ...book.tags]),
    types
  };
}

export function catalogForScope(
  scope: LibrarySearchScope,
  manga: LibrarySearchCatalog,
  book: LibrarySearchCatalog,
  historyType?: 'MANGA' | 'BOOK' | null
): LibrarySearchCatalog {
  if (scope === 'manga') return manga;
  if (scope === 'book') return book;
  if (historyType === 'MANGA') {
    return mergeCatalogs(manga, book, 'manga');
  }
  if (historyType === 'BOOK') {
    return mergeCatalogs(manga, book, 'book');
  }
  return mergeCatalogs(manga, book, 'both');
}

export function ensureCatalog(catalog?: LibrarySearchCatalog | null): LibrarySearchCatalog {
  return catalog ?? emptyLibrarySearchCatalog();
}
