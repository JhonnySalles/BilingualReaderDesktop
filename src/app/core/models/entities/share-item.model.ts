/** Cloud sync payload — field names match Android ShareItem (PT-BR on the wire). */

export interface ShareHistory {
  pageStart: number;
  pageEnd: number;
  pages: number;
  completed: boolean;
  volume: string;
  chaptersRead: number;
  start: string;
  end: string;
  secondsRead: number;
  averageTimeByPage: number;
  useTTS: boolean;
}

export interface ShareAnnotation {
  page: number;
  pages: number;
  fontSize: number;
  type: string;
  chapterNumber: number;
  chapter: string;
  text: string;
  range: string;
  annotation: string;
  favorite: boolean;
  color: string;
  created: string;
  /** Optional desktop EPUB CFI — omitted on wire when empty (Android ignores unknown keys). */
  cfiRange?: string;
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

/** Google Drive JSON container (Android ShareMark entity). */
export interface ShareMarkFile {
  origin?: string | null;
  lastAlteration?: string | null;
  type?: 'MANGA' | 'BOOK' | null;
  marks?: ShareItem[] | null;
}

export const SHARE_ITEM_FIELDS = {
  FILE: 'arquivo',
  BOOKMARK: 'bookMark',
  PAGES: 'paginas',
  COMPLETED: 'completo',
  FAVORITE: 'favorito',
  LAST_ACCESS: 'ultimoAcesso',
  SYNC: 'sincronizado',
  HISTORY: 'historico',
  ANNOTATION: 'anotacao'
} as const;

export const SHARE_HISTORY_FIELDS = {
  PAGE_START: 'paginaInicial',
  PAGE_END: 'paginaFinal',
  PAGES: 'paginas',
  COMPLETED: 'completo',
  VOLUME: 'volume',
  CHAPTERS_READ: 'capitulosLidos',
  START: 'inicio',
  END: 'final',
  SECONDS_READ: 'segundosLidos',
  AVERAGE_TIME_BY_PAGE: 'mediaTempoPorPagina',
  USE_TTS: 'usadoTTS'
} as const;

export const SHARE_ANNOTATION_FIELDS = {
  PAGE: 'pagina',
  PAGES: 'paginas',
  FONT_SIZE: 'fonteTamanho',
  TYPE: 'tipo',
  CHAPTER_NUMBER: 'capituloNumero',
  CHAPTER: 'capitulo',
  TEXT: 'texto',
  RANGE: 'range',
  ANNOTATION: 'anotacao',
  FAVORITE: 'favorito',
  COLOR: 'cor',
  CREATED: 'criado',
  CFI_RANGE: 'cfiRange'
} as const;

export const SHARE_MARK_FILE_FIELDS = {
  ORIGIN: 'origem',
  LAST_ALTERATION: 'alteracao',
  TYPE: 'tipo',
  MARKS: 'itens'
} as const;

export const SHARE_MARK_DATE_FORMAT = "yyyy-MM-dd'T'HH:mm:ss.SSSZ";
export const SHARE_ITEM_KEY_DATE_FORMAT = 'yyyy-MM-dd-HH:mm:ss';
export const SHARE_MARK_INITIAL_SYNC = '2000-01-01T01:01:01.001-0300';
