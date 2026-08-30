import { FileType } from '../enums/app-enums';
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
  completed: boolean;
  favorite: boolean;
  author: string;
  series: string;
  genre: string;
  publisher: string;
  volume: string;
  release?: string;
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

export interface BookAnnotation extends BaseEntity<number> {
  fkBook: number;
  page: number;
  text: string;
  note?: string;
  color?: string;
  dateCreate?: string;
}

export interface BookConfiguration {
  id?: number;
  fkBook: number;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  margin: number;
  backgroundColor: string;
  textColor: string;
}

export interface BookSearch {
  query: string;
  page: number;
  snippet: string;
}

export interface BookGroup {
  name: string;
  books: Book[];
}
