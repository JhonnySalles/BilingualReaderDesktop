import { BaseEntity } from '../interfaces/base-entity.model';
import { HistoryContentType } from './history.model';

export interface Information extends BaseEntity<number> {
  key: string;
  value: string;
}

/** Legacy aggregate stub kept for compatibility */
export interface Statistics {
  totalMangas: number;
  totalBooks: number;
  totalPagesRead: number;
  totalTimeSpent: number;
}

export interface SectorStats {
  type: HistoryContentType;
  reading: number;
  toRead: number;
  library: number;
  read: number;
  completeReadingPages: number;
  completeReadingSeconds: number;
  currentReadingPages: number;
  currentReadingSeconds: number;
  totalReadPages: number;
  totalReadSeconds: number;
  averageMinutesPerPage: number;
}

export interface StatisticsOverview {
  manga: SectorStats;
  book: SectorStats;
}

export interface ChartPoint {
  month: number;
  count: number;
}

export interface LibraryOption {
  id: number;
  title: string;
  type: HistoryContentType;
  path: string;
}

export interface Speech {
  text: string;
  language: string;
  audioUrl?: string;
}

export interface Separator {
  id?: number;
  title: string;
  index: number;
}
