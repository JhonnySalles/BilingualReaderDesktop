import { BrowserWindow } from 'electron';
import * as os from 'os';
import { StorageService } from '../../database/storage.service';
import { SettingsService } from '../settings.service';
import { GoogleAuthService } from '../google-auth.service';
import {
  ShareItem,
  SHARE_MARK_INITIAL_SYNC
} from '../../../src/app/core/models/entities/share-item.model';
import {
  ShareMarkCloud,
  ShareMarkStatus,
  ShareMarkType
} from '../../../src/app/core/models/enums/sharemark.enum';
import { Manga } from '../../../src/app/core/models/entities/manga.model';
import { Book } from '../../../src/app/core/models/entities/book.model';
import {
  buildShareItemFromBook,
  buildShareItemFromManga,
  formatShareMarkDate,
  parseFlexibleDate,
  parseRangeString,
  refreshShareItemBookAnnotations,
  refreshShareItemHistory,
  refreshShareItemMangaAnnotations
} from './share-item.mapper';
import { scaleBookBookmarkFromCloud } from '../../../src/app/core/utils/share-mark-compare';
import { scaleAnnotationPageFromCloud } from '../../../src/app/core/utils/share-annotation-reconcile';
import { ShareAnnotation } from '../../../src/app/core/models/entities/share-item.model';

export type ShareMarkContentType = 'MANGA' | 'BOOK';

export interface ShareMarkProgress {
  phase: string;
  send: number;
  receive: number;
  type: ShareMarkContentType;
}

export abstract class ShareMarkBase {
  public static readonly INITIAL_SYNC_DATE_TIME = SHARE_MARK_INITIAL_SYNC;
  public static inSync = false;

  abstract readonly notConnectErrorType: ShareMarkType;

  constructor(
    protected storage: StorageService,
    protected getWindow: () => BrowserWindow | null
  ) {}

  abstract initialize(): Promise<ShareMarkType>;
  abstract processManga(
    onUpdate: (manga: Manga) => void
  ): Promise<ShareMarkType>;
  abstract processBook(
    onUpdate: (book: Book) => void
  ): Promise<ShareMarkType>;

  protected emitProgress(phase: string, type: ShareMarkContentType): void {
    const win = this.getWindow();
    const payload: ShareMarkProgress = {
      phase,
      send: ShareMarkStatus.send,
      receive: ShareMarkStatus.receive,
      type
    };
    win?.webContents.send('sharemark:progress', payload);
  }

  protected isOnline(): boolean {
    try {
      const nets = os.networkInterfaces();
      for (const list of Object.values(nets)) {
        if (!list) continue;
        for (const n of list) {
          if (!n.internal && (n.family === 'IPv4' || (n.family as unknown) === 4)) {
            return true;
          }
        }
      }
    } catch {
      return true;
    }
    return true;
  }

  protected getDeviceName(): string {
    return os.hostname() || `${os.platform()} ${os.arch()}`;
  }

  protected getLastSync(type: ShareMarkContentType): Date {
    const settings = SettingsService.instance;
    const key = type === 'MANGA' ? 'shareMarkLastSyncManga' : 'shareMarkLastSyncBook';
    const raw = settings.get<string>(key, ShareMarkBase.INITIAL_SYNC_DATE_TIME);
    return parseFlexibleDate(raw) || new Date(ShareMarkBase.INITIAL_SYNC_DATE_TIME);
  }

  protected setLastSync(type: ShareMarkContentType, sync: Date): void {
    const settings = SettingsService.instance;
    const key = type === 'MANGA' ? 'shareMarkLastSyncManga' : 'shareMarkLastSyncBook';
    const next = new Date(sync.getTime() + 1000);
    settings.set(key, formatShareMarkDate(next));
  }

  public static clearLastSync(type: ShareMarkContentType): void {
    const settings = SettingsService.instance;
    if (type === 'MANGA') {
      settings.remove('shareMarkLastSyncManga');
    } else {
      settings.remove('shareMarkLastSyncBook');
    }
  }

  public static getInstance(
    storage: StorageService,
    getWindow: () => BrowserWindow | null
  ): ShareMarkBase {
    const cloud = SettingsService.instance.get<string>(
      'shareMarkCloud',
      ShareMarkCloud.GOOGLE_DRIVE
    ) as ShareMarkCloud;

    // Lazy require to avoid circular imports
    if (cloud === ShareMarkCloud.FIRESTORE) {
      const { ShareMarkFirebaseService } = require('./share-mark-firebase') as typeof import('./share-mark-firebase');
      return new ShareMarkFirebaseService(storage, getWindow);
    }
    const { ShareMarkGDriveService } = require('./share-mark-gdrive') as typeof import('./share-mark-gdrive');
    return new ShareMarkGDriveService(storage, getWindow);
  }

  public async mangaShareMark(
    onUpdate: (manga: Manga) => void
  ): Promise<ShareMarkType> {
    return this.runSync('MANGA', () => this.processManga(onUpdate));
  }

  public async bookShareMark(
    onUpdate: (book: Book) => void
  ): Promise<ShareMarkType> {
    return this.runSync('BOOK', () => this.processBook(onUpdate));
  }

  private async runSync(
    type: ShareMarkContentType,
    process: () => Promise<ShareMarkType>
  ): Promise<ShareMarkType> {
    if (ShareMarkBase.inSync) {
      return ShareMarkType.SYNC_IN_PROGRESS;
    }
    ShareMarkStatus.clear();
    if (!this.isOnline()) {
      return ShareMarkType.ERROR_NETWORK;
    }
    if (!GoogleAuthService.instance.isSignedIn()) {
      return ShareMarkType.NOT_SIGN_IN;
    }

    ShareMarkBase.inSync = true;
    this.emitProgress('initialize', type);
    try {
      const access = await this.initialize();
      if (access !== ShareMarkType.SUCCESS) {
        return access;
      }
      this.emitProgress('syncing', type);
      const result = await process();
      this.emitProgress('done', type);
      return result;
    } catch (e) {
      console.error('[ShareMark] sync error:', e);
      return this.notConnectErrorType;
    } finally {
      ShareMarkBase.inSync = false;
    }
  }

  /** @returns true if cloud data was applied to local entity */
  protected compareManga(item: ShareItem, manga: Manga): boolean {
    const mangaAccessDate = manga.lastAccess ? parseFlexibleDate(manga.lastAccess) : null;
    const mangaAlterationDate = manga.lastAlteration ? parseFlexibleDate(manga.lastAlteration) : null;
    const syncDate = parseFlexibleDate(item.sync) || new Date(0);
    const itemAccessDate = parseFlexibleDate(item.lastAccess) || new Date(0);

    if (
      (!mangaAccessDate && !mangaAlterationDate) ||
      (mangaAlterationDate && mangaAlterationDate < syncDate) ||
      (mangaAccessDate && itemAccessDate > mangaAccessDate)
    ) {
      manga.bookMark = item.bookMark;
      manga.lastAccess = item.lastAccess;
      manga.favorite = item.favorite;
      manga.completed = item.completed;
      item.processed = true;
      item.received = true;
      return true;
    }

    if (!mangaAccessDate) {
      this.mergeManga(item, manga);
    } else {
      const diff = itemAccessDate.getTime() - mangaAccessDate.getTime();
      if (diff > 5000 || diff < -5000) {
        this.mergeManga(item, manga);
      }
    }
    return false;
  }

  protected compareBook(item: ShareItem, book: Book): boolean {
    const bookAccessDate = book.lastAccess ? parseFlexibleDate(book.lastAccess) : null;
    const bookAlterationDate = book.lastAlteration ? parseFlexibleDate(book.lastAlteration) : null;
    const syncDate = parseFlexibleDate(item.sync) || new Date(0);
    const itemAccessDate = parseFlexibleDate(item.lastAccess) || new Date(0);

    if (
      (!bookAccessDate && !bookAlterationDate) ||
      (bookAlterationDate && bookAlterationDate < syncDate) ||
      (bookAccessDate && itemAccessDate > bookAccessDate)
    ) {
      if ((book.pages ?? 1) <= 1 && item.pages > 1) {
        book.bookMark = item.bookMark;
        book.pages = item.pages;
      } else if (item.completed || item.bookMark >= item.pages) {
        book.bookMark = book.pages;
      } else {
        book.bookMark = scaleBookBookmarkFromCloud(book, item);
      }

      book.completed = item.completed;
      book.lastAccess = item.lastAccess;
      book.favorite = item.favorite;
      item.processed = true;
      item.received = true;
      return true;
    }

    if (!bookAccessDate) {
      this.mergeBook(item, book);
    } else {
      const diff = itemAccessDate.getTime() - bookAccessDate.getTime();
      if (diff > 5000 || diff < -5000) {
        this.mergeBook(item, book);
      }
    }
    return false;
  }

  protected mergeManga(item: ShareItem, manga: Manga): void {
    item.bookMark = manga.bookMark;
    item.pages = manga.pages;
    item.completed = manga.completed;
    item.lastAccess = manga.lastAccess || ShareMarkBase.INITIAL_SYNC_DATE_TIME;
    item.favorite = manga.favorite;
    item.alter = true;
    item.processed = true;
  }

  protected mergeBook(item: ShareItem, book: Book): void {
    item.bookMark = book.bookMark;
    item.pages = book.pages;
    item.completed = book.completed;
    item.lastAccess = book.lastAccess || ShareMarkBase.INITIAL_SYNC_DATE_TIME;
    item.favorite = book.favorite;
    item.alter = true;
    item.processed = true;
  }

  protected applyMangaHistoryAndAnnotations(item: ShareItem, manga: Manga): void {
    if (!manga.id) return;
    const fkLibrary = manga.fkLibrary ?? 0;

    if (item.history) {
      const local = this.storage.historyRepository.listByReference('MANGA', manga.id);
      const localStarts = new Set(
        local.map((h) => (parseFlexibleDate(h.date_time_start)?.getTime() ?? 0))
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

  protected applyBookHistoryAndAnnotations(item: ShareItem, book: Book): void {
    if (!book.id) return;
    const fkLibrary = book.fkLibrary ?? 0;

    if (item.history) {
      const local = this.storage.historyRepository.listByReference('BOOK', book.id);
      const localStarts = new Set(
        local.map((h) => (parseFlexibleDate(h.date_time_start)?.getTime() ?? 0))
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
            color: shared.color || 'Yellow',
            dateCreate: shared.created,
            cfiRange: cfi || undefined
          });
        }
      }
    }
  }

  protected createMangaShareItem(manga: Manga): ShareItem {
    const histories = manga.id
      ? this.storage.historyRepository.listByReference('MANGA', manga.id)
      : [];
    const annotations = manga.id
      ? this.storage.mangaAnnotationRepository.listByManga(manga.id)
      : [];
    return buildShareItemFromManga(manga, histories, annotations);
  }

  protected async createBookShareItem(book: Book): Promise<ShareItem> {
    const histories = book.id
      ? this.storage.historyRepository.listByReference('BOOK', book.id)
      : [];
    const annotations = book.id
      ? this.storage.bookAnnotationRepository.listByBook(book.id)
      : [];
    return buildShareItemFromBook(book, histories, annotations);
  }

  protected refreshMangaItem(item: ShareItem, manga: Manga): void {
    if (!manga.id) return;
    refreshShareItemHistory(item, this.storage.historyRepository.listByReference('MANGA', manga.id));
    refreshShareItemMangaAnnotations(
      item,
      this.storage.mangaAnnotationRepository.listByManga(manga.id)
    );
    item.id = manga.id;
    item.idLibrary = manga.fkLibrary;
  }

  protected async refreshBookItem(item: ShareItem, book: Book): Promise<void> {
    if (!book.id) return;
    refreshShareItemHistory(item, this.storage.historyRepository.listByReference('BOOK', book.id));
    await refreshShareItemBookAnnotations(
      item,
      this.storage.bookAnnotationRepository.listByBook(book.id),
      book
    );
    item.id = book.id;
    item.idLibrary = book.fkLibrary;
  }
}
