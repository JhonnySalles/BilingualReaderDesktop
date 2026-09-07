import { BaseEntity } from '../interfaces/base-entity.model';

export interface Vocabulary extends BaseEntity<number> {
  word: string;
  basicForm?: string;
  reading?: string;
  english?: string;
  portuguese?: string;
  jlpt?: string;
  revised?: boolean;
  favorite?: boolean;
  appears?: number;
}

export interface VocabularyBook extends BaseEntity<number> {
  fkVocabulary: number;
  fkBook: number;
  appears: number;
  title?: string;
  coverPath?: string;
  name?: string;
}

export interface VocabularyManga extends BaseEntity<number> {
  fkVocabulary: number;
  fkManga: number;
  appears: number;
  title?: string;
  coverPath?: string;
  name?: string;
}

export interface VocabularyRelated {
  mangas: VocabularyManga[];
  books: VocabularyBook[];
}

export type VocabularySortOrder = 'word' | 'appears' | 'favorite';

export interface VocabularySearchOptions {
  query?: string | null;
  favoriteOnly?: boolean;
  order?: VocabularySortOrder;
  desc?: boolean;
  offset?: number;
  limit?: number;
  mangaId?: number | null;
  bookId?: number | null;
}

export interface VocabularySearchPage {
  items: Vocabulary[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface VocabularyImportResult {
  ok: boolean;
  skipped?: boolean;
  linked: number;
  message?: string;
}

export interface Kanjax {
  id?: number;
  kanji: string;
  keyword?: string;
  meaning?: string;
  koohii?: string;
  kohii2?: string;
  onyomi?: string;
  kunyomi?: string;
  onwords?: string;
  kunwords?: string;
  jlpt?: number;
  grade?: number;
  frequence?: number;
  strokes?: number;
  variants?: string;
  radical?: string;
  parts?: string;
  utf8?: string;
  sjis?: string;
  keywordsPt?: string;
  meaningPt?: string;
}

export interface KanjiJLPT {
  id?: number;
  kanji: string;
  level: number;
}

export interface Tags {
  id?: number;
  name: string;
  color?: string;
}
