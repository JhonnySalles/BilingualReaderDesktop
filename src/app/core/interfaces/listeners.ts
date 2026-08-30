import { Manga, Book, Library } from '../models';

export interface BaseCardListener {}

export interface MangaCardListener extends BaseCardListener {
  onClick(manga: Manga, event?: MouseEvent): void;
  onClickFavorite(manga: Manga): void;
  onClickConfig(manga: Manga, event?: MouseEvent, position?: number): void;
  onClickLong(manga: Manga, event?: MouseEvent, position?: number): void;
}

export interface BookCardListener extends BaseCardListener {
  onClick(book: Book, event?: MouseEvent): void;
  onClickFavorite(book: Book): void;
  onClickConfig(book: Book, event?: MouseEvent, position?: number): void;
  onClickLong(book: Book, event?: MouseEvent, position?: number): void;
}

export interface LibrariesCardListener {
  onClick(library: Library): void;
  onClickLong(library: Library, event?: MouseEvent, position?: number): void;
  changeEnable(library: Library): void;
}

export interface PopupOrderListener<T = string> {
  popupOrderOnChange(): void;
  popupSorted(order: T, isDesc?: boolean): void;
  popupGetOrder(): { order: T; isDesc: boolean } | null;
}

export interface PopupLayoutListener {
  openTouchFunctions(): void;
  configTouchFunctions(): void;
}

export interface MangaAnnotationListener {
  onAnnotationClick(manga: Manga): void;
}

export interface BookSearchListener {
  onSearch(query: string): void;
}

export interface ReaderListener {
  onPageChanged(pageNumber: number): void;
  onReaderClosed(): void;
}
