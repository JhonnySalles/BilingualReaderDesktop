import { Book } from '../models/entities/book.model';
import { Manga } from '../models/entities/manga.model';
import {
  LibrarySearchableItem,
  LibrarySearchScope,
  ParsedLibrarySearch
} from '../models/library-search.model';
import { itemMatchesSearch } from './library-search.filter';
import { buildBookCatalog, buildMangaCatalog, mergeCatalogs } from './library-search.catalog';
import { buildLibrarySearchSuggestions, shouldPauseFiltering } from './library-search.suggestions';
import { parseLibrarySearch } from './library-search.parser';

describe('library-search.filter', () => {
  const manga: LibrarySearchableItem = {
    title: 'One Piece Vol 1',
    name: 'one_piece_v1.cbz',
    author: 'Eiichiro Oda.',
    publisher: 'Shueisha',
    series: 'One Piece',
    volume: '1',
    fileType: 'CBZ'
  };

  const book: LibrarySearchableItem = {
    title: 'The Hobbit',
    name: 'hobbit.epub',
    author: 'J.R.R. Tolkien',
    publisher: 'Allen & Unwin',
    fileType: 'EPUB',
    tags: 'fantasy, classic'
  };

  it('matches manga volume exactly and author contains', () => {
    const parsed = parseLibrarySearch('@Autor:Oda @Volume:1', 'manga');
    expect(itemMatchesSearch(manga, parsed, 'manga')).toBe(true);
    expect(itemMatchesSearch({ ...manga, volume: '10' }, parsed, 'manga')).toBe(false);
  });

  it('ANDs multiple tokens', () => {
    const parsed = parseLibrarySearch('@Autor:Oda @Editora:Wrong', 'manga');
    expect(itemMatchesSearch(manga, parsed, 'manga')).toBe(false);
  });

  it('matches book tags and free text on title', () => {
    const parsed = parseLibrarySearch('@Tag:fantasy hobbit', 'book');
    expect(itemMatchesSearch(book, parsed, 'book')).toBe(true);
  });

  it('history volume uses contains', () => {
    const parsed = parseLibrarySearch('@Volume:1', 'history');
    expect(itemMatchesSearch({ ...manga, volume: '10' }, parsed, 'history')).toBe(true);
  });
});

describe('library-search.catalog', () => {
  it('builds manga and book catalogs with history merge', () => {
    const mangas = [
      {
        author: 'Oda.',
        publisher: 'Shueisha',
        series: 'One Piece',
        volume: '1'
      }
    ] as Manga[];
    const books = [
      {
        author: 'Tolkien, J.R.R.',
        publisher: 'Allen',
        tags: 'fantasy; epic'
      }
    ] as Book[];

    const m = buildMangaCatalog(mangas);
    const b = buildBookCatalog(books);
    expect(m.authors).toContain('Oda');
    expect(b.authors).toEqual(jasmine.arrayContaining(['Tolkien', 'J.R.R.']));
    expect(b.tags).toEqual(jasmine.arrayContaining(['fantasy', 'epic']));

    const hist = mergeCatalogs(m, b, 'both');
    expect(hist.series).toContain('One Piece');
    expect(hist.tags).toContain('fantasy');
  });
});

describe('library-search.suggestions', () => {
  const catalog = buildMangaCatalog([
    {
      author: 'Eiichiro Oda',
      publisher: 'Shueisha',
      series: 'One Piece',
      volume: '1'
    } as Manga
  ]);

  it('suggests filter types after @', () => {
    const suggestions = buildLibrarySearchSuggestions('@', 'manga', catalog);
    expect(suggestions.some(s => s.insertText === '@Autor:')).toBe(true);
    expect(suggestions.some(s => s.insertText === '@Volume:')).toBe(true);
  });

  it('suggests author values after @Autor:', () => {
    const suggestions = buildLibrarySearchSuggestions('@Autor:', 'manga', catalog);
    expect(suggestions.some(s => s.label.includes('Oda'))).toBe(true);
  });

  it('pauses filtering while typing @ segment without trailing space', () => {
    expect(shouldPauseFiltering('@Autor')).toBe(true);
    expect(shouldPauseFiltering('@Autor:')).toBe(true);
    expect(shouldPauseFiltering('@Autor:Oda')).toBe(true);
    expect(shouldPauseFiltering('@Autor:Oda ')).toBe(false);
    expect(shouldPauseFiltering('plain text')).toBe(false);
  });
});
