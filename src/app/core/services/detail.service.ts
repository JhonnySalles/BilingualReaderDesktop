import { Injectable } from '@angular/core';
import { ElectronService } from './electron.service';
import { Manga, Book } from '../models';

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

  async setMangaBookMark(manga: Manga, page: number): Promise<Manga | null> {
    const pages = Math.max(1, manga.pages || 1);
    const bookMark = Math.max(0, Math.min(page, pages));
    return this.electron.saveManga({
      ...manga,
      bookMark,
      completed: bookMark >= pages
    });
  }

  async setBookBookMark(book: Book, page: number): Promise<Book | null> {
    const pages = Math.max(1, book.pages || 1);
    const bookMark = Math.max(0, Math.min(page, pages));
    return this.electron.saveBook({
      ...book,
      bookMark,
      completed: bookMark >= pages
    });
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

  progressPercent(bookMark: number, pages: number): number {
    if (!pages || pages <= 0) return 0;
    return Math.min(100, Math.round((bookMark / pages) * 100));
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
