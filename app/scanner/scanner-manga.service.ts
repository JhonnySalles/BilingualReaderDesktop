import * as fs from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { BrowserWindow } from 'electron';
import { StorageService } from '../database/storage.service';
import { Manga } from '../../src/app/core/models/entities/manga.model';
import { FileType, getMangaFileType } from '../../src/app/core/models/enums/app-enums';
import { ParseFactory } from '../parser/manga/parse-factory';
import { MangaImageCoverController } from '../controllers/manga-image-cover.controller';
import { Telemetry } from '../utils/telemetry';
import { getAppBaseDir, getAppCoversDir } from '../utils/app-paths';

export class ScannerMangaService {
  private isScanning = false;
  private currentWorker: Worker | null = null;

  constructor(private storageService: StorageService) {}

  public isRunning(): boolean {
    return this.isScanning;
  }

  public async scanFolder(folderPath: string, window: BrowserWindow | null, externalHd?: boolean): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    if (window) {
      window.webContents.send('manga:scan-status', { status: 'STARTED', folderPath });
    }

    try {
      if (!fs.existsSync(folderPath)) {
        if (externalHd) {
          if (window) {
            window.webContents.send('manga:scan-status', { status: 'SKIPPED_EXTERNAL_HD', folderPath });
          }
          this.isScanning = false;
          return;
        }
        try {
          fs.mkdirSync(folderPath, { recursive: true });
        } catch (e) {
          console.warn(`Could not create directory ${folderPath}:`, e);
          this.isScanning = false;
          return;
        }
      }

      const libraryId = this.storageService.getOrCreateLibrary(folderPath, 'MANGA');
      const existingMangas = this.storageService.listMangas(libraryId);
      const existingMap = new Map<string, Manga>();
      const existingItemsMap: Record<string, Partial<Manga>> = {};

      existingMangas.forEach(m => {
        const p = m.path || (m as any).file || '';
        if (p) {
          const normKey = path.normalize(p).toLowerCase();
          existingMap.set(normKey, m);
          existingItemsMap[normKey] = {
            id: m.id,
            path: m.path,
            title: m.title,
            coverPath: m.coverPath,
            author: m.author,
            series: m.series,
            genre: m.genre,
            publisher: m.publisher,
            volume: m.volume,
            fkLibrary: m.fkLibrary
          };
        }
      });

      const workerPath = path.join(__dirname, 'manga-scanner.worker.js');

      await new Promise<void>((resolve, reject) => {
        const worker = new Worker(workerPath, {
          workerData: {
            folderPath,
            libraryId,
            existingItemsMap,
            baseDir: getAppBaseDir(),
            coversDir: getAppCoversDir()
          }
        });
        this.currentWorker = worker;

        worker.on('message', (msg: { type: string; items?: Partial<Manga>[]; foundPaths?: string[]; message?: string; processedCount?: number; totalFound?: number }) => {
          try {
            if (msg.type === 'BATCH' && msg.items && msg.items.length > 0) {
              const savedList = this.storageService.saveMangasBatch(msg.items);
              if (window && savedList.length > 0) {
                window.webContents.send('manga:updated-batch', savedList);
              }
            } else if (msg.type === 'PROGRESS') {
              if (window) {
                window.webContents.send('manga:scan-status', {
                  status: 'PROGRESS',
                  folderPath,
                  processedCount: msg.processedCount,
                  totalFound: msg.totalFound
                });
              }
            } else if (msg.type === 'DONE') {
              const foundSet = new Set<string>((msg.foundPaths || []).map((p: string) => path.normalize(p).toLowerCase()));
              // Remove missing mangas
              for (const [missingPath, missingManga] of existingMap.entries()) {
                if (!foundSet.has(missingPath) && missingManga.id) {
                  this.storageService.deleteManga(missingManga.id);
                  if (window) {
                    window.webContents.send('manga:updated-remove', { id: missingManga.id, path: missingPath });
                  }
                }
              }
              resolve();
            } else if (msg.type === 'ERROR') {
              console.error('[ScannerMangaService] Worker reported error:', msg.message);
              reject(new Error(msg.message || 'Worker error'));
            }
          } catch (handlerErr) {
            console.error('[ScannerMangaService] Error handling worker message:', handlerErr);
          }
        });

        worker.on('error', (err) => {
          console.error('[ScannerMangaService] Worker thread error:', err);
          Telemetry.recordException(err, 'Manga scanner worker error');
          reject(err);
        });

        worker.on('exit', (code) => {
          this.currentWorker = null;
          if (code !== 0) {
            console.warn(`[ScannerMangaService] Worker stopped with exit code ${code}`);
          }
          resolve();
        });
      });

    } catch (err) {
      console.error('Error scanning manga folder:', err);
      Telemetry.recordException(err, 'Error scanning manga folder');
    } finally {
      if (this.currentWorker) {
        try {
          this.currentWorker.terminate();
        } catch {}
        this.currentWorker = null;
      }
      this.isScanning = false;
      if (window) {
        window.webContents.send('manga:scan-status', { status: 'FINISHED', folderPath });
      }
    }
  }

  public async processSingleFile(filePath: string, window: BrowserWindow | null): Promise<Manga | null> {
    try {
      if (!fs.existsSync(filePath)) return null;
      const stat = await fs.promises.stat(filePath);
      const isDir = stat.isDirectory();
      const folder = isDir ? filePath : path.dirname(filePath);
      const libraryId = this.storageService.getOrCreateLibrary(folder, 'MANGA');

      const existingInDb = this.storageService.findMangaByPath(filePath);
      if (existingInDb && existingInDb.id) {
        await this.checkAndRecoverMetadata(existingInDb, filePath, stat, libraryId, window);
        return this.storageService.findMangaById(existingInDb.id) || existingInDb;
      }

      await this.processNewManga(filePath, stat, libraryId, window, isDir);
      return this.storageService.findMangaByPath(filePath) || null;
    } catch (e) {
      console.error('Failed to process single manga file:', filePath, e);
      Telemetry.recordException(e, `Failed to process single manga file: ${filePath}`);
      return null;
    }
  }

  private async processNewManga(
    itemPath: string,
    stat: fs.Stats,
    libraryId: number,
    window: BrowserWindow | null,
    isDirectory: boolean = false
  ): Promise<void> {
    const ext = isDirectory ? '' : path.extname(itemPath).toLowerCase();
    const fileName = path.basename(itemPath);
    const title = isDirectory ? fileName : path.basename(itemPath, ext);
    const folder = isDirectory ? itemPath : path.dirname(itemPath);

    let pages = 1;
    let coverPath: string | undefined = undefined;

    let author = '';
    let series = '';
    let genre = '';
    let publisher = '';
    let volume = '';
    let hasSubtitle = false;

    const parser = await ParseFactory.create(itemPath);
    if (parser) {
      try {
        pages = Math.max(1, parser.numPages());
        hasSubtitle = parser.hasSubtitles();

        const comicInfo = parser.getComicInfo();
        if (comicInfo) {
          if (comicInfo.writer) author = comicInfo.writer;
          if (comicInfo.series) series = comicInfo.series;
          if (comicInfo.genre) genre = comicInfo.genre;
          if (comicInfo.publisher) publisher = comicInfo.publisher;
          if (comicInfo.number) volume = comicInfo.number;
        }

        const coverStreams = parser.getCover();
        if (coverStreams.front) {
          coverPath = MangaImageCoverController.instance.saveCoverToCache(itemPath, coverStreams.front);
        }
      } catch (e) {
        console.warn(`Could not parse ${fileName}:`, e);
      } finally {
        parser.destroy();
      }
    }

    const manga: Partial<Manga> = {
      title,
      path: itemPath,
      folder,
      name: fileName,
      fileSize: stat.size,
      fileType: isDirectory ? FileType.DIRECTORY : getMangaFileType(itemPath),
      pages,
      chapters: [],
      chaptersPages: {},
      bookMark: 0,
      completed: false,
      favorite: false,
      hasSubtitle,
      author,
      series,
      genre,
      publisher,
      volume,
      fkLibrary: libraryId,
      excluded: false,
      fileAlteration: stat.mtime.toISOString(),
      coverPath
    };

    const existingInDb = this.storageService.findMangaByPath(itemPath);
    if (existingInDb) {
      manga.id = existingInDb.id;
    }

    const id = this.storageService.saveManga(manga);
    manga.id = id;

    if (window) {
      window.webContents.send('manga:updated-add', manga);
    }
  }

  private async checkAndRecoverMetadata(
    existing: Manga,
    itemPath: string,
    stat: fs.Stats,
    libraryId: number,
    window: BrowserWindow | null
  ): Promise<void> {
    let needsUpdate = false;
    const updated: Partial<Manga> = { ...existing };

    if (!existing.coverPath || !fs.existsSync(existing.coverPath)) {
      const extractedCover = await MangaImageCoverController.instance.getMangaCoverFile(existing);
      if (extractedCover) {
        updated.coverPath = extractedCover;
        needsUpdate = true;
      }
    }

    if (!existing.author || !existing.series) {
      const parser = await ParseFactory.create(itemPath);
      if (parser) {
        try {
          const comicInfo = parser.getComicInfo();
          if (comicInfo) {
            if (comicInfo.writer && !existing.author) { updated.author = comicInfo.writer; needsUpdate = true; }
            if (comicInfo.series && !existing.series) { updated.series = comicInfo.series; needsUpdate = true; }
            if (comicInfo.genre && !existing.genre) { updated.genre = comicInfo.genre; needsUpdate = true; }
            if (comicInfo.publisher && !existing.publisher) { updated.publisher = comicInfo.publisher; needsUpdate = true; }
            if (comicInfo.number && !existing.volume) { updated.volume = comicInfo.number; needsUpdate = true; }
          }
        } finally {
          parser.destroy();
        }
      }
    }

    if (needsUpdate || existing.fkLibrary !== libraryId) {
      updated.fkLibrary = libraryId;
      this.storageService.saveManga(updated);
      if (window) {
        window.webContents.send('manga:updated-add', updated);
      }
    }
  }
}
