import { BaseEntity } from '../interfaces/base-entity.model';
import { HistoryType } from '../enums/annotation-enums';
import { AssistantMessage } from '../enums/ai-enums';

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

export interface AssistantHistory extends BaseEntity<number> {
  role: AssistantMessage;
  content: string;
  timestamp: string;
}
