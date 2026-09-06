import { BookAnnotation, BookAnnotationColor } from './book.model';

export type AnnotationContentType = 'BOOK' | 'MANGA';

/** Mark type filters (Android Filter enum subset). */
export type AnnotationMarkFilter = 'Favorite' | 'Detach' | 'PageMark' | 'BookMark';

export interface AnnotationItem extends BookAnnotation {
  type: AnnotationContentType;
  parentTitle: string;
  parentFileName: string;
}

export interface AnnotationRootRow {
  kind: 'root';
  key: string;
  type: AnnotationContentType;
  parentId: number;
  title: string;
  subtitle: string;
}

export interface AnnotationChapterRow {
  kind: 'chapter';
  key: string;
  type: AnnotationContentType;
  parentId: number;
  title: string;
  chapterNumber: number;
  count: number;
}

export interface AnnotationItemRow {
  kind: 'item';
  key: string;
  item: AnnotationItem;
}

export type AnnotationRow = AnnotationRootRow | AnnotationChapterRow | AnnotationItemRow;

export interface AnnotationFilters {
  search: string;
  /** null = all types */
  type: AnnotationContentType | null;
  marks: AnnotationMarkFilter[];
  colors: string[];
  chapters: string[];
}

export const ANNOTATION_COLOR_OPTIONS: { value: string; label: string; hex: string | null }[] = [
  { value: 'None', label: 'Sem cor', hex: null },
  { value: BookAnnotationColor.Yellow, label: 'Amarelo', hex: '#e6b800' },
  { value: BookAnnotationColor.Red, label: 'Vermelho', hex: '#ff4d4d' },
  { value: BookAnnotationColor.Green, label: 'Verde', hex: '#00e600' },
  { value: BookAnnotationColor.Blue, label: 'Azul', hex: '#668cff' }
];

export const ANNOTATION_MARK_OPTIONS: { value: AnnotationMarkFilter; label: string }[] = [
  { value: 'Favorite', label: 'Favorito' },
  { value: 'Detach', label: 'Destaque' },
  { value: 'PageMark', label: 'Marca de página' },
  { value: 'BookMark', label: 'Marcador' }
];
