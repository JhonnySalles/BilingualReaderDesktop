import { BaseEntity } from '../interfaces/base-entity.model';
import { Vocabulary } from './vocabulary.model';

export interface SubTitleText {
  original: string;
  translated?: string;
  furigana?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** Android wire: textos[]. */
  texto?: string;
  sequencia?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

export interface SubTitlePage {
  pageNumber: number;
  texts: SubTitleText[];
  /** Android wire aliases. */
  numero?: number;
  nomePagina?: string;
  hash?: string;
  textos?: SubTitleText[];
  vocabularios?: VocabularyWire[];
}

export interface SubTitleChapter {
  chapterNumber: number;
  pages: SubTitlePage[];
  language?: string;
  lingua?: string;
  manga?: string;
  volume?: string;
  capitulo?: number;
  paginas?: SubTitlePage[];
  vocabularios?: VocabularyWire[];
}

export interface SubTitleVolume {
  volumeNumber: number;
  chapters: SubTitleChapter[];
  language?: string;
  lingua?: string;
  manga?: string;
  volume?: string;
  capitulos?: SubTitleChapter[];
  vocabulario?: VocabularyWire[];
}

export interface SubTitle extends BaseEntity<number> {
  fkManga?: number;
  fkBook?: number;
  language: string;
  volumes: SubTitleVolume[];
}

/** Android Gson Vocabulary wire fields in subtitle JSON. */
export interface VocabularyWire {
  id?: number;
  palavra?: string;
  word?: string;
  portugues?: string;
  portuguese?: string;
  ingles?: string;
  english?: string;
  leitura?: string;
  reading?: string;
  basicForm?: string;
  basic_form?: string;
  jlpt?: string | number;
  revisado?: boolean;
  revised?: boolean;
  favorite?: boolean;
  appears?: number;
}

export function normalizeVocabularyWire(raw: VocabularyWire | null | undefined): Vocabulary | null {
  if (!raw || typeof raw !== 'object') return null;
  const word = (raw.palavra || raw.word || '').trim();
  if (!word) return null;
  const basicForm = (raw.basicForm || raw.basic_form || word).trim();
  return {
    id: raw.id,
    word,
    basicForm,
    reading: (raw.leitura || raw.reading || '').trim(),
    english: (raw.ingles || raw.english || '').trim(),
    portuguese: (raw.portugues || raw.portuguese || '').trim(),
    jlpt: raw.jlpt != null ? String(raw.jlpt) : '',
    revised: raw.revisado ?? raw.revised ?? false,
    favorite: raw.favorite ?? false,
    appears: raw.appears ?? 0
  };
}
