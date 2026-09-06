import { FileType } from '../enums/app-enums';
import {
  BookAlign,
  BookMarginSize,
  BookScrollingMode,
  BookSpacingSize
} from '../enums/reader-enums';
import { BaseEntity, HistoryInterface } from '../interfaces/base-entity.model';

export interface Book extends BaseEntity<number>, HistoryInterface {
  title: string;
  path: string;
  folder: string;
  name: string;
  fileSize: number;
  fileType: FileType;
  pages: number;
  bookMark: number;
  bookMarkCfi?: string;
  completed: boolean;
  favorite: boolean;
  author: string;
  series: string;
  genre: string;
  publisher: string;
  volume: string;
  release?: string;
  language?: string;
  isbn?: string;
  annotation?: string;
  tags?: string;
  chapter?: string;
  chapterDescription?: string;
  password?: string;
  fkLibrary?: number;
  excluded: boolean;
  dateCreate?: string;
  lastAccess?: string;
  lastAlteration?: string;
  fileAlteration: string;
  lastVocabImport?: string;
  lastVerify?: string;
  coverPath?: string;
}

/** Highlight colors — names match Android Color enum; hex from Color.getHtmlColor(). */
export enum BookAnnotationColor {
  Yellow = 'Yellow',
  Green = 'Green',
  Blue = 'Blue',
  Red = 'Red'
}

export const BOOK_ANNOTATION_COLOR_HEX: Record<BookAnnotationColor, string> = {
  [BookAnnotationColor.Yellow]: '#e6b800',
  [BookAnnotationColor.Green]: '#00e600',
  [BookAnnotationColor.Blue]: '#668cff',
  [BookAnnotationColor.Red]: '#ff4d4d'
};

export interface BookAnnotation extends BaseEntity<number> {
  fkBook: number;
  page: number;
  pages: number;
  text: string;
  note?: string;
  color?: string;
  chapter?: string;
  chapterNumber?: number;
  /** Character offsets [start, end] for mobile parity — not used for desktop rendering. */
  range?: number[];
  markType?: string;
  favorite?: boolean;
  /** EPUB CFI range — desktop highlight anchor. */
  cfiRange?: string;
  fontSize?: number;
  dateCreate?: string;
  alteration?: string;
}

export interface BookConfiguration {
  id?: number;
  fkBook: number;
  alignment: BookAlign;
  margin: BookMarginSize;
  spacing: BookSpacingSize;
  scrolling: BookScrollingMode | string;
  pagination: string;
  fontType: string;
  fontSize: number;
}

export interface BookSearchHistory {
  id?: number;
  fkBook: number;
  search: string;
  date: string; // ISO
}

export type BookSearchListItem =
  | { kind: 'chapter'; title: string; chapterIndex: number }
  | {
      kind: 'hit';
      cfi: string;
      page: number; // location index 0-based for UI "Página N"
      excerptHtml: string; // trecho com <mark>…</mark>
      plainExcerpt: string;
      query: string;
    };

export interface BookGroup {
  name: string;
  books: Book[];
}

