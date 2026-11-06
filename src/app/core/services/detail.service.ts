import { Injectable } from '@angular/core';
import { ElectronService } from './electron.service';
import { Manga, Book, MangaAnnotation, BookAnnotation } from '../models';
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

  loadMangaCover3D(id: number) {
    return this.electron.getMangaCover3D(id);
  }

  loadBook(id: number, force?: boolean): Promise<Book | null> {
    return this.electron.getBook(id, force);
  }

  syncBookMetadata(id: number): Promise<Book | null> {
    return this.electron.syncBookMetadata(id);
  }

  loadBookChapters(id: number) {
    return this.electron.getBookChapters(id);
  }

  loadBookCover3D(id: number) {
    return this.electron.getBookCover3D(id);
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

  loadMangaAnnotations(mangaId: number): Promise<MangaAnnotation[]> {
    return this.electron.listMangaAnnotations(mangaId);
  }

  loadBookAnnotations(bookId: number): Promise<BookAnnotation[]> {
    return this.electron.listBookAnnotations(bookId);
  }

  deleteMangaAnnotation(id: number): Promise<boolean> {
    return this.electron.deleteMangaAnnotation(id);
  }

  deleteBookAnnotation(id: number): Promise<boolean> {
    return this.electron.deleteBookAnnotation(id);
  }

  async updateMangaTags(manga: Manga, tags: string): Promise<Manga | null> {
    return this.electron.saveManga({ ...manga, tags });
  }

  async updateBookLanguage(book: Book, language: string): Promise<Book | null> {
    return this.electron.saveBook({ ...book, language });
  }

  async updateBookTags(book: Book, tags: string): Promise<Book | null> {
    return this.electron.saveBook({ ...book, tags });
  }

  getTags(): Promise<any[]> {
    return this.electron.getTags();
  }

  saveTag(name: string): Promise<any> {
    return this.electron.saveTag(name);
  }

  deleteTag(id: number): Promise<boolean> {
    return this.electron.deleteTag(id);
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

  stripHtml(input?: string | null): string {
    if (!input) return '';

    // Substitui quebras e fechamentos de bloco por quebras de linha
    let text = input
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\/\s*(p|div|h[1-6]|li|blockquote|tr)\s*>/gi, '\n')
      .replace(/<\s*(p|div|h[1-6]|li|blockquote|tr)[^>]*>/gi, '');

    // Remove qualquer outra tag HTML
    text = text.replace(/<[^>]+>/g, '');

    // Decodifica entidades HTML via DOMParser se disponível
    if (typeof DOMParser !== 'undefined') {
      try {
        const doc = new DOMParser().parseFromString(text, 'text/html');
        text = doc.body.textContent || doc.body.innerText || text;
      } catch {
        // Fallback básico caso DOMParser falhe
        text = text
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&hellip;/g, '...')
          .replace(/&mdash;/g, '—')
          .replace(/&ndash;/g, '–');
      }
    }

    // Normaliza quebras de linha e espaçamentos
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  formatLanguage(codeOrName?: string | null): string {
    if (!codeOrName || !codeOrName.trim()) return '';
    const raw = codeOrName.trim();
    const lower = raw.toLowerCase();

    if (lower.startsWith('pt') || lower === 'portuguese' || lower === 'português') {
      return 'Português';
    }
    if (lower.startsWith('ja') || lower.startsWith('jp') || lower === 'japanese' || lower === 'japonês') {
      return 'Japonês';
    }
    if (lower.startsWith('en') || lower === 'english' || lower === 'inglês') {
      return 'Inglês';
    }
    if (lower.startsWith('es') || lower === 'spanish' || lower === 'espanhol') {
      return 'Espanhol';
    }
    if (lower.startsWith('fr') || lower === 'french' || lower === 'francês') {
      return 'Francês';
    }
    if (lower.startsWith('de') || lower === 'german' || lower === 'alemão') {
      return 'Alemão';
    }
    if (lower.startsWith('it') || lower === 'italian' || lower === 'italiano') {
      return 'Italiano';
    }
    if (lower.startsWith('ko') || lower === 'korean' || lower === 'coreano') {
      return 'Coreano';
    }
    if (lower.startsWith('zh') || lower === 'chinese' || lower === 'chinês') {
      return 'Chinês';
    }
    if (lower.startsWith('ru') || lower === 'russian' || lower === 'russo') {
      return 'Russo';
    }

    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
}
