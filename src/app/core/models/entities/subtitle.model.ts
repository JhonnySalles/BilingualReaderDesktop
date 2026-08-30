import { BaseEntity } from '../interfaces/base-entity.model';

export interface SubTitleText {
  original: string;
  translated?: string;
  furigana?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface SubTitlePage {
  pageNumber: number;
  texts: SubTitleText[];
}

export interface SubTitleChapter {
  chapterNumber: number;
  pages: SubTitlePage[];
}

export interface SubTitleVolume {
  volumeNumber: number;
  chapters: SubTitleChapter[];
}

export interface SubTitle extends BaseEntity<number> {
  fkManga?: number;
  fkBook?: number;
  language: string;
  volumes: SubTitleVolume[];
}
