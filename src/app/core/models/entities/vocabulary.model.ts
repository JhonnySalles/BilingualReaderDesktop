import { BaseEntity } from '../interfaces/base-entity.model';

export interface Vocabulary extends BaseEntity<number> {
  word: string;
  reading?: string;
  meaning: string;
  jlpt?: string;
  frequency?: number;
  tags?: string[];
  dateCreate?: string;
}

export interface VocabularyBook extends BaseEntity<number> {
  fkVocabulary: number;
  fkBook: number;
  count: number;
}

export interface VocabularyManga extends BaseEntity<number> {
  fkVocabulary: number;
  fkManga: number;
  count: number;
}

export interface Kanjax {
  kanji: string;
  meanings: string[];
  readingsOn: string[];
  readingsKun: string[];
  strokes: number;
  jlpt: number;
}

export interface KanjiJLPT {
  kanji: string;
  level: string;
}

export interface Tags {
  id?: number;
  name: string;
  color?: string;
}
