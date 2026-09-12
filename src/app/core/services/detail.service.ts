import { Injectable } from '@angular/core';
import { ElectronService } from './electron.service';
import { Manga, Book } from '../models';
import {
  clampBookMark,
  isCompleted,
  progressPercent as calcProgressPercent,
  progressPageLabel
} from '../utils/reading-progress.util';

@Injectable({ providedIn: 'root' })
export class DetailService {
  constructor(private electron: ElectronService) {}

  loadManga(id: number): Promise<Manga | null> {
    return this.electron.getManga(id);
  }

  loadBook(id: number): Promise<Book | null> {
    return this.electron.getBook(id);
  }

  async toggleFavoriteManga(manga: Manga): Promise<Manga | null> {
    return this.electron.saveManga({ ...manga, favorite: !manga.favorite });
  }

  async toggleFavoriteBook(book: Book): Promise<Book | null> {
    return this.electron.saveBook({ ...book, favorite: !book.favorite });
  }

  markMangaRead(id: number): Promise<Manga | null> {
    return this.electron.markMangaRead(id);
  }

  markBookRead(id: number): Promise<Book | null> {
    return this.electron.markBookRead(id);
  }

  clearMangaProgress(id: number): Promise<Manga | null> {
    return this.electron.clearMangaProgress(id);
  }

  clearBookProgress(id: number): Promise<Book | null> {
    return this.electron.clearBookProgress(id);
  }

  /** `page` is 1-based (1…pages) from the bookmark dialog. */
  async setMangaBookMark(manga: Manga, page: number): Promise<Manga | null> {
    const pages = Math.max(1, manga.pages || 1);
    const bookMark = clampBookMark(page, pages);
    return this.electron.saveManga({
      ...manga,
      bookMark,
      completed: isCompleted(bookMark, pages)
    });
  }

  /** Full bookmark edit from shared dialog (page + lastAccess + completed + History). */
  async setMangaBookmarkEdit(
    manga: Manga,
    payload: {
      page: number;
      lastAccess: string;
      completed: boolean;
      secondsRead?: number;
      secondsReadAutomatic?: boolean;
      wordCount?: number;
    }
  ): Promise<Manga | null> {
    if (!manga.id) return null;
    const pages = Math.max(1, manga.pages || 1);
    const bookMark = clampBookMark(payload.page, pages);
    const pageStart = manga.bookMark || 0;
    const updated = await this.electron.saveManga({
      ...manga,
      bookMark,
      completed: payload.completed,
      lastAccess: payload.lastAccess
    });
    await this.electron.saveHistoryBookmarkEdit({
      fkLibrary: manga.fkLibrary ?? 0,
      fkReference: manga.id,
      type: 'MANGA',
      pageStart,
      pageEnd: bookMark,
      pages,
      completed: payload.completed,
      volume: manga.volume || '',
      dateTime: payload.lastAccess,
      secondsRead: payload.secondsRead,
      secondsReadAutomatic: payload.secondsReadAutomatic,
      wordCount: payload.wordCount
    });
    return updated;
  }

  /** `page` is 1-based (1…pages) from the bookmark dialog. */
  async setBookBookMark(book: Book, page: number): Promise<Book | null> {
    const pages = Math.max(1, book.pages || 1);
    const bookMark = clampBookMark(page, pages);
    return this.electron.saveBook({
      ...book,
      bookMark,
      completed: isCompleted(bookMark, pages)
    });
  }

  async setBookBookmarkEdit(
    book: Book,
    payload: {
      page: number;
      lastAccess: string;
      completed: boolean;
      secondsRead?: number;
      secondsReadAutomatic?: boolean;
      wordCount?: number;
    }
  ): Promise<Book | null> {
    if (!book.id) return null;
    const pages = Math.max(1, book.pages || 1);
    const bookMark = clampBookMark(payload.page, pages);
    const pageStart = book.bookMark || 0;
    const updated = await this.electron.saveBook({
      ...book,
      bookMark,
      completed: payload.completed,
      lastAccess: payload.lastAccess
    });
    await this.electron.saveHistoryBookmarkEdit({
      fkLibrary: book.fkLibrary ?? 0,
      fkReference: book.id,
      type: 'BOOK',
      pageStart,
      pageEnd: bookMark,
      pages,
      completed: payload.completed,
      volume: book.volume || '',
      dateTime: payload.lastAccess,
      secondsRead: payload.secondsRead,
      secondsReadAutomatic: payload.secondsReadAutomatic,
      wordCount: payload.wordCount
    });
    return updated;
  }

  deleteManga(id: number): Promise<boolean> {
    return this.electron.deleteManga(id);
  }

  deleteBook(id: number): Promise<boolean> {
    return this.electron.deleteBook(id);
  }

  async updateBookLanguage(book: Book, language: string): Promise<Book | null> {
    return this.electron.saveBook({ ...book, language });
  }

  async updateBookTags(book: Book, tags: string): Promise<Book | null> {
    return this.electron.saveBook({ ...book, tags });
  }

  formatLastAccess(iso?: string | null): string {
    if (!iso) return 'Nunca';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Nunca';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  progressPercent(bookMark: number, pages: number, completed?: boolean | null): number {
    return calcProgressPercent(bookMark, pages, completed);
  }

  progressLabel(bookMark: number, pages: number, completed?: boolean | null): string {
    return progressPageLabel(bookMark, pages, completed);
  }

  parseTags(tags?: string | null): string[] {
    if (!tags?.trim()) return [];
    return tags
      .split(/[,;]/)
      .map(t => t.trim())
      .filter(Boolean);
  }

  serializeTags(tags: string[]): string {
    return tags.map(t => t.trim()).filter(Boolean).join(', ');
  }
}
