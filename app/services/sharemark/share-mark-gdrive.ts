import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import { ShareMarkBase } from './share-mark-base';
import { GoogleAuthService } from '../google-auth.service';
import {
  ShareItem,
  ShareMarkFile
} from '../../../src/app/core/models/entities/share-item.model';
import { ShareMarkType, ShareMarkStatus } from '../../../src/app/core/models/enums/sharemark.enum';
import { Manga } from '../../../src/app/core/models/entities/manga.model';
import { Book } from '../../../src/app/core/models/entities/book.model';
import { getAppCacheDir } from '../../utils/app-paths';
import { Telemetry } from '../../utils/telemetry';
import {
  formatShareMarkDate,
  parseFlexibleDate,
  parseShareMarkFile,
  serializeShareMarkFile
} from './share-item.mapper';

const FOLDER = 'BilingualReader';
const MANGA_FILE = 'MangaMarks';
const BOOK_FILE = 'BookMarks';
const EXT = '.json';
const MANGA_FILE_FULL = MANGA_FILE + EXT;
const BOOK_FILE_FULL = BOOK_FILE + EXT;

export class ShareMarkGDriveService extends ShareMarkBase {
  readonly notConnectErrorType = ShareMarkType.NOT_CONNECT_DRIVE;

  private idFolder = '';
  private idManga = '';
  private idBook = '';
  private drive: drive_v3.Drive | null = null;

  private cacheDir(): string {
    const dir = path.join(getAppCacheDir(), 'sharemark');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private cachePath(name: string): string {
    return path.join(this.cacheDir(), name);
  }

  async initialize(): Promise<ShareMarkType> {
    try {
      if (!GoogleAuthService.instance.isSignedIn()) {
        return ShareMarkType.NOT_SIGN_IN;
      }
      const auth = await GoogleAuthService.instance.getAuthenticatedClient();
      this.drive = google.drive({ version: 'v3', auth: auth as any });
      return await this.getShareFiles();
    } catch (e: any) {
      console.error('[ShareMarkGDrive] initialize:', e);
      Telemetry.recordException(e, '[ShareMarkGDrive] initialize');
      if (e?.message === 'NOT_SIGN_IN') return ShareMarkType.NOT_SIGN_IN;
      return ShareMarkType.NOT_CONNECT_DRIVE;
    }
  }

  private async getShareFiles(): Promise<ShareMarkType> {
    if (!this.drive) return ShareMarkType.NOT_SIGN_IN;
    try {
      this.idFolder = '';
      this.idManga = '';
      this.idBook = '';
      let mangaBackups = 0;
      let bookBackups = 0;
      const limit = 3;
      let pageToken: string | undefined;

      do {
        const result = await this.drive.files.list({
          q:
            `(name contains '${MANGA_FILE}' or name contains '${BOOK_FILE}' or name contains '${FOLDER}') and ` +
            `(mimeType='application/json' or mimeType='application/vnd.google-apps.folder') and trashed=false`,
          spaces: 'drive',
          fields: 'nextPageToken, files(id, name)',
          orderBy: 'name desc',
          pageToken
        });

        for (const file of result.data.files || []) {
          const name = file.name || '';
          const id = file.id || '';
          if (name === MANGA_FILE_FULL) this.idManga = id;
          else if (name === BOOK_FILE_FULL) this.idBook = id;
          else if (name === FOLDER) this.idFolder = id;
          else {
            if (name.includes(MANGA_FILE)) {
              mangaBackups++;
              if (mangaBackups > limit) await this.deleteFile(id);
            }
            if (name.includes(BOOK_FILE)) {
              bookBackups++;
              if (bookBackups > limit) await this.deleteFile(id);
            }
          }
        }
        pageToken = result.data.nextPageToken || undefined;
      } while (pageToken);

      if (!this.idBook || !this.idManga) {
        await this.createShareFiles();
      }

      await this.downloadToCache(this.idManga, MANGA_FILE_FULL);
      await this.downloadToCache(this.idBook, BOOK_FILE_FULL);
      return ShareMarkType.SUCCESS;
    } catch (e: any) {
      console.error('[ShareMarkGDrive] getShareFiles:', e);
      Telemetry.recordException(e, '[ShareMarkGDrive] getShareFiles');
      if (e?.code === 'ENOTFOUND' || e?.code === 'ECONNREFUSED') {
        return ShareMarkType.ERROR_NETWORK;
      }
      return ShareMarkType.ERROR_DOWNLOAD;
    }
  }

  private async deleteFile(id: string): Promise<void> {
    try {
      await this.drive!.files.delete({ fileId: id });
    } catch (e) {
      console.warn('[ShareMarkGDrive] delete backup failed', e);
    }
  }

  private async createShareFiles(): Promise<void> {
    if (!this.drive) return;
    if (!this.idFolder) {
      const folder = await this.drive.files.create({
        requestBody: {
          name: FOLDER,
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id'
      });
      this.idFolder = folder.data.id || '';
    }
    if (!this.idManga) {
      this.idManga = await this.uploadNew(
        MANGA_FILE_FULL,
        this.writeShareFile({ origin: '', type: 'MANGA', marks: [] }, MANGA_FILE_FULL)
      );
    }
    if (!this.idBook) {
      this.idBook = await this.uploadNew(
        BOOK_FILE_FULL,
        this.writeShareFile({ origin: '', type: 'BOOK', marks: [] }, BOOK_FILE_FULL)
      );
    }
  }

  private writeShareFile(share: ShareMarkFile, name: string): string {
    share.lastAlteration = new Date().toISOString();
    share.origin = this.getDeviceName();
    const filePath = this.cachePath(name);
    fs.writeFileSync(filePath, JSON.stringify(serializeShareMarkFile(share), null, 2), 'utf-8');
    return filePath;
  }

  private async uploadNew(name: string, filePath: string): Promise<string> {
    const res = await this.drive!.files.create({
      requestBody: {
        name,
        parents: [this.idFolder]
      },
      media: {
        mimeType: 'application/json',
        body: fs.createReadStream(filePath)
      },
      fields: 'id'
    });
    return res.data.id || '';
  }

  private async downloadToCache(fileId: string, name: string): Promise<void> {
    if (!fileId || !this.drive) return;
    const res = await this.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    const dest = this.cachePath(name);
    await new Promise<void>((resolve, reject) => {
      const ws = fs.createWriteStream(dest);
      (res.data as Readable).pipe(ws);
      ws.on('finish', () => resolve());
      ws.on('error', reject);
    });
  }

  private readCached(name: string, type: 'MANGA' | 'BOOK'): ShareMarkFile {
    const filePath = this.cachePath(name);
    if (!fs.existsSync(filePath)) {
      return { origin: '', type, marks: [] };
    }
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const parsed = parseShareMarkFile(raw);
      if (!parsed.marks) parsed.marks = [];
      if (!parsed.type) parsed.type = type;
      return parsed;
    } catch {
      return { origin: '', type, marks: [] };
    }
  }

  private async saveShareFile(
    idFile: string,
    nameWithoutExt: string,
    filePath: string
  ): Promise<ShareMarkType> {
    if (!this.drive) return ShareMarkType.ERROR_UPLOAD;
    try {
      const stamp = new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, '')
        .slice(0, 14);
      // Rename old file as backup
      await this.drive.files.update({
        fileId: idFile,
        requestBody: { name: `${nameWithoutExt}_${stamp}${EXT}` }
      });
      await this.uploadNew(nameWithoutExt + EXT, filePath);
      return ShareMarkType.SUCCESS;
    } catch (e) {
      console.error('[ShareMarkGDrive] upload:', e);
      Telemetry.recordException(e, '[ShareMarkGDrive] upload');
      return ShareMarkType.ERROR_UPLOAD;
    }
  }

  async processManga(onUpdate: (manga: Manga) => void): Promise<ShareMarkType> {
    const sync = new Date();
    const alteration = new Date().toISOString();
    const share = this.readCached(MANGA_FILE_FULL, 'MANGA');
    if (!share.marks) share.marks = [];

    const lastSync =
      share.marks.length === 0
        ? new Date(ShareMarkBase.INITIAL_SYNC_DATE_TIME)
        : this.getLastSync('MANGA');

    const list = share.marks.filter((m) => {
      const s = parseFlexibleDate(m.sync);
      return s && s > lastSync;
    });

    const locals = this.storage.mangaRepository.listSync(lastSync);
    for (const manga of locals) {
      const existing = share.marks.find((m) => m.file === manga.name);
      if (existing) {
        if (this.compareManga(existing, manga)) {
          manga.lastAlteration = alteration;
          this.storage.saveManga(manga);
          onUpdate(manga);
        }
      } else if (!share.marks.some((s) => s.file === manga.name)) {
        share.marks.push(this.createMangaShareItem(manga));
      }
    }

    for (const item of list.filter((i) => !i.processed)) {
      const manga = this.storage.mangaRepository.getByFileName(item.file);
      if (manga && this.compareManga(item, manga)) {
        manga.lastAlteration = alteration;
        this.storage.saveManga(manga);
        onUpdate(manga);
      }
    }

    for (const item of list) {
      const manga = this.storage.mangaRepository.getByFileName(item.file);
      if (manga) this.applyMangaHistoryAndAnnotations(item, manga);
    }

    const isUpdate = share.marks.some((m) => m.alter);
    let result: ShareMarkType;
    if (isUpdate) {
      for (const m of share.marks.filter((i) => i.alter)) {
        m.sync = formatShareMarkDate(sync);
      }
      const filePath = this.writeShareFile(share, MANGA_FILE_FULL);
      result = await this.saveShareFile(this.idManga, MANGA_FILE, filePath);
      // Refresh canonical file id after rename+upload
      await this.getShareFiles();
    } else if (list.length > 0) {
      result = ShareMarkType.SUCCESS;
    } else {
      result = ShareMarkType.NOT_ALTERATION;
    }

    ShareMarkStatus.send = list.filter((i) => i.alter).length;
    ShareMarkStatus.receive = list.filter((i) => i.received).length;
    // Also count newly added alters not in list
    const alterAll = share.marks.filter((m) => m.alter).length;
    if (alterAll > ShareMarkStatus.send) ShareMarkStatus.send = alterAll;

    this.setLastSync('MANGA', sync);
    return result;
  }

  async processBook(onUpdate: (book: Book) => void): Promise<ShareMarkType> {
    const sync = new Date();
    const alteration = new Date().toISOString();
    const share = this.readCached(BOOK_FILE_FULL, 'BOOK');
    if (!share.marks) share.marks = [];

    const lastSync = this.getLastSync('BOOK');
    const list = share.marks.filter((m) => {
      const s = parseFlexibleDate(m.sync);
      return s && s > lastSync;
    });

    const locals = this.storage.bookRepository.listSync(lastSync);
    for (const book of locals) {
      const existing = list.find((m) => m.file === book.name);
      if (existing) {
        if (this.compareBook(existing, book)) {
          book.lastAlteration = alteration;
          this.storage.saveBook(book);
          onUpdate(book);
        }
      } else if (!share.marks.some((s) => s.file === book.name)) {
        share.marks.push(await this.createBookShareItem(book));
      }
    }

    for (const item of list.filter((i) => !i.processed)) {
      const book = this.storage.bookRepository.getByFileName(item.file);
      if (book && this.compareBook(item, book)) {
        book.lastAlteration = alteration;
        this.storage.saveBook(book);
        onUpdate(book);
      }
    }

    for (const item of list) {
      const book = this.storage.bookRepository.getByFileName(item.file);
      if (book) this.applyBookHistoryAndAnnotations(item, book);
    }

    const isUpdate = share.marks.some((m) => m.alter);
    let result: ShareMarkType;
    if (isUpdate) {
      for (const m of share.marks.filter((i) => i.alter)) {
        m.sync = formatShareMarkDate(sync);
      }
      const filePath = this.writeShareFile(share, BOOK_FILE_FULL);
      result = await this.saveShareFile(this.idBook, BOOK_FILE, filePath);
      await this.getShareFiles();
    } else {
      result = list.length > 0 ? ShareMarkType.SUCCESS : ShareMarkType.NOT_ALTERATION;
    }

    ShareMarkStatus.send = Math.max(
      list.filter((i) => i.alter).length,
      share.marks.filter((m) => m.alter).length
    );
    ShareMarkStatus.receive = list.filter((i) => i.received).length;
    this.setLastSync('BOOK', sync);
    return result;
  }
}
