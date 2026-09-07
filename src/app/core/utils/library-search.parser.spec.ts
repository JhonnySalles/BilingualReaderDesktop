import {
  BOOK_FILTER_DEFS,
  HISTORY_FILTER_DEFS,
  MANGA_FILTER_DEFS
} from '../models/library-search.model';
import {
  formatToken,
  parseLibrarySearch,
  resolveFilterKind
} from './library-search.parser';

describe('library-search.parser', () => {
  it('parses quoted and unquoted tokens and free text', () => {
    const parsed = parseLibrarySearch(
      '@Autor:"Nome Com Espaço" @Volume:3 residual',
      'history'
    );
    expect(parsed.tokens.length).toBe(2);
    expect(parsed.tokens[0].kind).toBe('Author');
    expect(parsed.tokens[0].value).toBe('Nome Com Espaço');
    expect(parsed.tokens[1].kind).toBe('Volume');
    expect(parsed.tokens[1].value).toBe('3');
    expect(parsed.freeText).toBe('residual');
  });

  it('accepts English aliases for filter types', () => {
    const parsed = parseLibrarySearch('@Author:Smith @Publisher:Kodansha', 'manga');
    expect(parsed.tokens.map(t => t.kind)).toEqual(['Author', 'Publisher']);
    expect(parsed.tokens[0].value).toBe('Smith');
  });

  it('ignores incomplete @ segments', () => {
    const parsed = parseLibrarySearch('hello @Autor', 'book');
    expect(parsed.tokens.length).toBe(0);
    expect(parsed.freeText).toBe('hello');
    expect(parsed.hasIncompleteAt).toBe(true);
  });

  it('resolves PT-BR labels including accents', () => {
    expect(resolveFilterKind('Série', 'manga')?.kind).toBe('Series');
    expect(resolveFilterKind('Serie', 'manga')?.kind).toBe('Series');
    expect(resolveFilterKind('Editora', 'book')?.kind).toBe('Publisher');
  });

  it('formats tokens with quotes when needed', () => {
    expect(formatToken('Autor', 'John')).toBe('@Autor:John ');
    expect(formatToken('Autor', 'John Doe')).toBe('@Autor:"John Doe" ');
  });

  it('exposes distinct filter defs per scope', () => {
    expect(MANGA_FILTER_DEFS.map(d => d.kind)).toEqual([
      'Author',
      'Publisher',
      'Series',
      'Type',
      'Volume'
    ]);
    expect(BOOK_FILTER_DEFS.map(d => d.kind)).toEqual([
      'Author',
      'Publisher',
      'Tag',
      'Type'
    ]);
    expect(HISTORY_FILTER_DEFS.map(d => d.kind)).toContain('Tag');
    expect(HISTORY_FILTER_DEFS.map(d => d.kind)).toContain('Series');
    expect(HISTORY_FILTER_DEFS.map(d => d.kind)).toContain('Volume');
  });
});
