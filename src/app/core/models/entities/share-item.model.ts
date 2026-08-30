export interface ShareHistory {
  pageStart: number;
  pageEnd: number;
  pages: number;
  completed: boolean;
  volume: string;
  chaptersRead: string;
  start: string;
  end: string;
  secondsRead: number;
  averageTimeByPage: number;
  useTTS: boolean;
}

export interface ShareAnnotation {
  page: number;
  pages: number;
  type: string;
  chapter: string;
  text: string;
  annotation: string;
  created: string;
}

export interface ShareItem {
  id?: number;
  idLibrary?: number;
  file: string;
  bookMark: number;
  pages: number;
  completed: boolean;
  favorite: boolean;
  lastAccess: string;
  sync: string;
  history?: Record<string, ShareHistory>;
  annotation?: Record<string, ShareAnnotation>;
  alter?: boolean;
  received?: boolean;
  processed?: boolean;
}
