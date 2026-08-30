export interface BaseEntity<ID = number> {
  id?: ID;
}

export interface HistoryInterface {
  bookMark: number;
  pages: number;
  completed: boolean;
  lastAccess?: string;
}

export interface AnnotationInterface {
  id?: number;
  page: number;
  dateCreate?: string;
}
