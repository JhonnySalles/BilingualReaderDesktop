import { BaseEntity } from '../interfaces/base-entity.model';

export interface Information extends BaseEntity<number> {
  key: string;
  value: string;
}

export interface Statistics {
  totalMangas: number;
  totalBooks: number;
  totalPagesRead: number;
  totalTimeSpent: number;
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
