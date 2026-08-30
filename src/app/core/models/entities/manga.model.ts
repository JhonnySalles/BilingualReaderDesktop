import { FileType } from '../enums/app-enums';
import { BaseEntity, HistoryInterface } from '../interfaces/base-entity.model';

export interface Manga extends BaseEntity<number>, HistoryInterface {
  title: string;
  path: string;
  folder: string;
  name: string;
  fileSize: number;
  fileType: FileType;
  pages: number;
  chapters: number[];
  chaptersPages: Record<number, string>;
  bookMark: number;
  completed: boolean;
  favorite: boolean;
  hasSubtitle: boolean;
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

export interface MangaAnnotation extends BaseEntity<number> {
  fkManga: number;
  page: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  note?: string;
  dateCreate?: string;
}

export interface MangaGroup {
  name: string;
  mangas: Manga[];
}
