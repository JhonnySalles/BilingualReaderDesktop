import { BaseEntity } from '../interfaces/base-entity.model';
import { HistoryType } from '../enums/annotation-enums';
import { AssistantMessage } from '../enums/ai-enums';

export type HistoryContentType = 'MANGA' | 'BOOK';

export interface HistorySession {
  id?: number;
  fkLibrary: number;
  fkReference: number;
  type: HistoryContentType;
  pageStart: number;
  pageEnd: number;
  pages: number;
  completed: boolean;
  volume?: string;
  chaptersRead?: number;
  dateTimeStart: string;
  dateTimeEnd: string;
  secondsRead: number;
  averageTimeByPage?: number;
}

export interface HistoryRecord extends BaseEntity<number> {
  type: HistoryType;
  fkId: number;
  pagesRead: number;
  timeSpentSeconds: number;
  date: string;
}

export interface HistoryGroup {
  date: string;
  records: HistoryRecord[];
}

export interface HistoryStatistics {
  totalPagesRead: number;
  totalTimeSpentSeconds: number;
  totalItemsCompleted: number;
}

export interface HistoryStatisticsItem {
  id: number;
  type: HistoryContentType;
  fkReference: number;
  fkLibrary: number;
  title: string;
  author: string;
  series: string;
  publisher: string;
  coverPath: string | null;
  favorite: boolean;
  hasSubtitle: boolean;
  bookMark: number;
  pages: number;
  completed: boolean;
  libraryName: string;
  pagesRead: number;
  timeRead: number;
  sessionDate: string;
  lastAccess: string;
}

export interface AssistantHistory extends BaseEntity<number> {
  role: AssistantMessage;
  content: string;
  timestamp: string;
}
