import { ComicInfo } from '../../../src/app/core/models/entities/comic-info.model';

export interface CoverStreams {
  front: Buffer | null;
  back: Buffer | null;
}

export interface Parse {
  parse(filePath: string): Promise<void> | void;
  destroy(isClearCache?: boolean): void;
  getPage(num: number): Buffer | null;
  numPages(): number;
  getSubtitles(): string[];
  hasSubtitles(): boolean;
  getSubtitlesNames(): Record<string, number>;
  getPagePath(num: number): string | null;
  getPagePaths(): Record<string, number>;
  getChapters(): number[];
  isComicInfo(): boolean;
  getComicInfo(): ComicInfo | null;
  getCover(): CoverStreams;
  hasFullCover(): boolean;
  getFullCover(): Buffer | null;
}
