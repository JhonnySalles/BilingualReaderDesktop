import { BrowserWindow, dialog, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from '../database/storage.service';
import {
  buildShareItemFromBook,
  buildShareItemFromManga,
  parseFlexibleDate,
  parseRangeString,
  parseShareItemFromCloud,
  serializeShareItemForCloud
} from './sharemark/share-item.mapper';
import { scaleBookBookmarkFromCloud } from '../../src/app/core/utils/share-mark-compare';
import { scaleAnnotationPageFromCloud } from '../../src/app/core/utils/share-annotation-reconcile';
import { ShareAnnotation, ShareItem } from '../../src/app/core/models/entities/share-item.model';
import { Manga } from '../../src/app/core/models/entities/manga.model';
import { Book } from '../../src/app/core/models/entities/book.model';

function formatExportStamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

export class DataExportImportService {
  constructor(
    private storage: StorageService,
    private getWindow: () => BrowserWindow | null
  ) {}

  public async exportToJson(): Promise<{ ok: boolean; canceled?: boolean; path?: string; count?: number; error?: string }> {
    const win = this.getWindow();
    if (!win) return { ok: false, canceled: true };

    const saveResult = await dialog.showSaveDialog(win, {
      title: 'Exportar dados de leitura (JSON)',
      defaultPath: path.join(
        app.getPath('documents'),
        `BilingualReader_Export_${formatExportStamp()}.json`
      ),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { ok: false, canceled: true };
    }

    const dest = saveResult.filePath.endsWith('.json') ? saveResult.filePath : `${saveResult.filePath}.json`;

    try {
      const exportItems: Array<Record<string, unknown>> = [];

      // 1. Export mangas
      const mangas = this.storage.mangaRepository.list();
      for (const manga of mangas) {
        if (!manga.id) continue;
        const histories = this.storage.historyRepository.listByReference('MANGA', manga.id);
        const annotations = this.storage.mangaAnnotationRepository.listByManga(manga.id);

        const hasBookmark = (manga.bookMark ?? 0) > 0;
        const hasHistory = histories.length > 0;
        const hasAnnotations = annotations.length > 0;

        if (hasBookmark || hasHistory || hasAnnotations) {
          const shareItem = buildShareItemFromManga(manga, histories, annotations);
          const serialized = serializeShareItemForCloud(shareItem);
          serialized['tipo'] = 'manga';
          exportItems.push(serialized);
        }
      }

      // 2. Export books
      const books = this.storage.bookRepository.list();
      for (const book of books) {
        if (!book.id) continue;
        const histories = this.storage.historyRepository.listByReference('BOOK', book.id);
        const annotations = this.storage.bookAnnotationRepository.listByBook(book.id);

        const hasBookmark = (book.bookMark ?? 0) > 0;
        const hasHistory = histories.length > 0;
        const hasAnnotations = annotations.length > 0;

        if (hasBookmark || hasHistory || hasAnnotations) {
          const shareItem = await buildShareItemFromBook(book, histories, annotations);
          const serialized = serializeShareItemForCloud(shareItem);
          serialized['tipo'] = 'livro';
          exportItems.push(serialized);
        }
      }

      fs.writeFileSync(dest, JSON.stringify(exportItems, null, 2), 'utf-8');
      return { ok: true, path: dest, count: exportItems.length };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, error: message };
    }
  }

  public async importFromJson(): Promise<{ ok: boolean; canceled?: boolean; count?: number; total?: number; path?: string; error?: string }> {
    const win = this.getWindow();
    if (!win) return { ok: false, canceled: true };

    const openResult = await dialog.showOpenDialog(win, {
      title: 'Importar dados de leitura (JSON)',
      properties: ['openFile'],
      filters: [
        { name: 'JSON', extensions: ['json'] },
        { name: 'Todos os arquivos', extensions: ['*'] }
      ]
    });

    if (openResult.canceled || openResult.filePaths.length === 0) {
      return { ok: false, canceled: true };
    }

    const filePath = openResult.filePaths[0];
    if (!fs.existsSync(filePath)) {
      return { ok: false, error: 'Arquivo não encontrado' };
    }

    try {
      const rawContent = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(rawContent);
      const rawList: any[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.itens)
          ? parsed.itens
          : Array.isArray(parsed?.marks)
            ? parsed.marks
            : [];

      if (!Array.isArray(rawList) || rawList.length === 0) {
        return { ok: false, error: 'Nenhum item válido encontrado no arquivo JSON' };
      }

      let importedCount = 0;

      for (const rawItem of rawList) {
        if (!rawItem || typeof rawItem !== 'object') continue;
        const rawTipo = String(rawItem.tipo || rawItem.type || '').toLowerCase();
        const shareItem = parseShareItemFromCloud(rawItem);
        if (!shareItem.file) continue;

        if (rawTipo.includes('manga')) {
          const manga = this.storage.mangaRepository.getByFileName(shareItem.file);
          if (manga && manga.id) {
            this.applyMangaImport(shareItem, manga);
            importedCount++;
          }
        } else {
          // Default to book/livro
          const book = this.storage.bookRepository.getByFileName(shareItem.file);
          if (book && book.id) {
            this.applyBookImport(shareItem, book);
            importedCount++;
          }
        }
      }

      return { ok: true, path: filePath, count: importedCount, total: rawList.length };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, error: message };
    }
  }

  private applyMangaImport(item: ShareItem, manga: Manga): void {
    if (!manga.id) return;
    const fkLibrary = manga.fkLibrary ?? 0;

    // Progress update
    const mangaAccessDate = manga.lastAccess ? parseFlexibleDate(manga.lastAccess) : null;
    const itemAccessDate = parseFlexibleDate(item.lastAccess) || new Date(0);

    if (
      !mangaAccessDate ||
      itemAccessDate >= mangaAccessDate ||
      (manga.bookMark ?? 0) <= 0 ||
      item.bookMark > (manga.bookMark ?? 0)
    ) {
      manga.bookMark =
        item.completed || item.bookMark >= (item.pages || manga.pages || 1)
          ? Math.max(1, manga.pages || 1)
          : Math.min(Math.max(0, item.bookMark), Math.max(1, manga.pages || 1));
      manga.lastAccess = item.lastAccess;
      manga.favorite = item.favorite ?? manga.favorite;
      manga.completed = item.completed || manga.bookMark >= (manga.pages || 1);
      manga.lastAlteration = new Date().toISOString();
      this.storage.mangaRepository.save(manga);
    }

    // Apply History
    if (item.history) {
      const local = this.storage.historyRepository.listByReference('MANGA', manga.id);
      const localStarts = new Set(
        local.map((h) => parseFlexibleDate(h.date_time_start)?.getTime() ?? 0)
      );
      for (const shared of Object.values(item.history)) {
        const start = parseFlexibleDate(shared.start);
        if (!start || localStarts.has(start.getTime())) continue;
        this.storage.historyRepository.insertSharedSession({
          fkLibrary,
          fkReference: manga.id,
          type: 'MANGA',
          pageStart: shared.pageStart,
          pageEnd: shared.pageEnd,
          pages: shared.pages,
          completed: shared.completed,
          volume: shared.volume,
          chaptersRead: shared.chaptersRead,
          dateTimeStart: shared.start,
          dateTimeEnd: shared.end,
          secondsRead: shared.secondsRead,
          averageTimeByPage: shared.averageTimeByPage,
          useTTS: shared.useTTS
        });
      }
    }

    // Apply Annotations
    if (item.annotation) {
      const annotations = this.storage.mangaAnnotationRepository.listByManga(manga.id);
      for (const shared of Object.values(item.annotation)) {
        const created = parseFlexibleDate(shared.created);
        const existing = annotations.find((a) => {
          const c = parseFlexibleDate(a.dateCreate);
          return c && created && c.getTime() === created.getTime();
        });
        if (existing) {
          existing.chapter = shared.chapter;
          existing.folder = shared.text;
          existing.page = shared.page;
          existing.pages = shared.pages;
          existing.note = shared.annotation;
          this.storage.mangaAnnotationRepository.save(existing);
        } else {
          this.storage.mangaAnnotationRepository.save({
            fkManga: manga.id,
            page: shared.page,
            pages: shared.pages,
            markType: shared.type || 'PageMark',
            chapter: shared.chapter,
            folder: shared.text,
            note: shared.annotation,
            dateCreate: shared.created
          });
        }
      }
    }
  }

  private applyBookImport(item: ShareItem, book: Book): void {
    if (!book.id) return;
    const fkLibrary = book.fkLibrary ?? 0;

    // Progress update
    const bookAccessDate = book.lastAccess ? parseFlexibleDate(book.lastAccess) : null;
    const itemAccessDate = parseFlexibleDate(item.lastAccess) || new Date(0);

    if (
      !bookAccessDate ||
      itemAccessDate >= bookAccessDate ||
      (book.bookMark ?? 0) <= 0 ||
      item.bookMark > (book.bookMark ?? 0)
    ) {
      if ((book.pages ?? 1) <= 1 && item.pages > 1) {
        book.bookMark = item.bookMark;
        book.pages = item.pages;
      } else if (item.completed || item.bookMark >= item.pages) {
        book.bookMark = book.pages;
      } else {
        book.bookMark = scaleBookBookmarkFromCloud(book, item);
      }
      book.completed = item.completed || (book.bookMark ?? 0) >= (book.pages || 1);
      book.lastAccess = item.lastAccess;
      book.favorite = item.favorite ?? book.favorite;
      book.lastAlteration = new Date().toISOString();
      this.storage.bookRepository.save(book);
    }

    // Apply History
    if (item.history) {
      const local = this.storage.historyRepository.listByReference('BOOK', book.id);
      const localStarts = new Set(
        local.map((h) => parseFlexibleDate(h.date_time_start)?.getTime() ?? 0)
      );
      for (const shared of Object.values(item.history)) {
        const start = parseFlexibleDate(shared.start);
        if (!start || localStarts.has(start.getTime())) continue;
        this.storage.historyRepository.insertSharedSession({
          fkLibrary,
          fkReference: book.id,
          type: 'BOOK',
          pageStart: shared.pageStart,
          pageEnd: shared.pageEnd,
          pages: shared.pages,
          completed: shared.completed,
          volume: shared.volume,
          chaptersRead: shared.chaptersRead,
          dateTimeStart: shared.start,
          dateTimeEnd: shared.end,
          secondsRead: shared.secondsRead,
          averageTimeByPage: shared.averageTimeByPage,
          useTTS: shared.useTTS
        });
      }
    }

    // Apply Annotations
    if (item.annotation) {
      const annotations = this.storage.bookAnnotationRepository.listByBook(book.id);
      const localPages = Math.max(1, book.pages ?? 1);
      for (const shared of Object.values(item.annotation) as ShareAnnotation[]) {
        const created = parseFlexibleDate(shared.created);
        const existing = annotations.find((a) => {
          const c = parseFlexibleDate(a.dateCreate);
          return c && created && c.getTime() === created.getTime();
        });
        const scaledPage = scaleAnnotationPageFromCloud(
          shared.page,
          shared.pages || localPages,
          localPages
        );
        const cfi = (shared.cfiRange || '').trim();
        if (existing) {
          existing.text = shared.text;
          existing.page = scaledPage;
          existing.pages = localPages;
          existing.fontSize = shared.fontSize;
          existing.note = shared.annotation;
          existing.range = parseRangeString(shared.range);
          existing.favorite = shared.favorite;
          existing.color = shared.color || existing.color;
          if (cfi) {
            existing.cfiRange = cfi;
          }
          this.storage.bookAnnotationRepository.save(existing);
        } else {
          this.storage.bookAnnotationRepository.save({
            fkBook: book.id,
            page: scaledPage,
            pages: localPages,
            fontSize: shared.fontSize,
            markType: shared.type || 'Annotation',
            chapterNumber: shared.chapterNumber,
            chapter: shared.chapter,
            text: shared.text,
            range: parseRangeString(shared.range),
            note: shared.annotation,
            favorite: shared.favorite,
            color: shared.color,
            dateCreate: shared.created,
            cfiRange: cfi || undefined
          });
        }
      }
    }
  }
}
