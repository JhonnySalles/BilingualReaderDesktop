import * as fs from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { BrowserWindow } from 'electron';
import { StorageService } from '../database/storage.service';
import { Book } from '../../src/app/core/models/entities/book.model';
import { getBookFileType } from '../../src/app/core/models/enums/app-enums';
import { BookExtractorFactory } from '../parser/book/book-extractor.factory';
import { BookImageCoverController } from '../controllers/book-image-cover.controller';
import { Telemetry } from '../utils/telemetry';
import { getAppBaseDir, getAppCoversDir } from '../utils/app-paths';

export class ScannerBookService {
  private isScanning = false;
  private isStopping = false;
  private currentFolderPath = '';
  private currentWorker: Worker | null = null;

  constructor(private storageService: StorageService) {}

  public isRunning(): boolean {
    return this.isScanning;
  }

  public async stopScanning(window?: BrowserWindow | null): Promise<void> {
    if (!this.isScanning && !this.currentWorker) return;
    this.isStopping = true;
    const stoppedFolder = this.currentFolderPath;
    if (this.currentWorker) {
      try {
        this.currentWorker.postMessage({ type: 'STOP' });
        await this.currentWorker.terminate();
      } catch (e) {
        console.warn('[ScannerBookService] Worker termination warning:', e);
      }
      this.currentWorker = null;
    }
    this.isScanning = false;
    this.isStopping = false;
    if (window) {
      window.webContents.send('book:scan-status', { status: 'CANCELLED', folderPath: stoppedFolder });
    }
  }

  public async scanFolder(folderPath: string, window: BrowserWindow | null, externalHd?: boolean): Promise<void> {
    if (this.isScanning) {
      await this.stopScanning(window);
    }
    this.isScanning = true;
    this.currentFolderPath = folderPath;

    if (window) {
      window.webContents.send('book:scan-status', { status: 'STARTED', folderPath });
    }

    let libraryId = 0;
    try {
      if (!fs.existsSync(folderPath)) {
        if (externalHd) {
          if (window) {
            window.webContents.send('book:scan-status', { status: 'SKIPPED_EXTERNAL_HD', folderPath });
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

      libraryId = this.storageService.getOrCreateLibrary(folderPath, 'BOOK');
      const existingBooks = this.storageService.listBooks(libraryId);
      const existingMap = new Map<string, Book>();
      const existingItemsMap: Record<string, Partial<Book>> = {};

      existingBooks.forEach(b => {
        if (b.path) {
          const normKey = path.normalize(b.path).toLowerCase();
          existingMap.set(normKey, b);
          existingItemsMap[normKey] = {
            id: b.id,
            path: b.path,
            title: b.title,
            coverPath: b.coverPath,
            author: b.author,
            series: b.series,
            genre: b.genre,
            publisher: b.publisher,
            volume: b.volume,
            fkLibrary: b.fkLibrary
          };
        }
      });

      const workerPath = path.join(__dirname, 'book-scanner.worker.js');

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

        worker.on('message', (msg: { type: string; items?: Partial<Book>[]; foundPaths?: string[]; message?: string; processedCount?: number; totalFound?: number }) => {
          try {
            if (this.isStopping) return;
            if (msg.type === 'BATCH' && msg.items && msg.items.length > 0) {
              const savedList = this.storageService.saveBooksBatch(msg.items);
              if (window && savedList.length > 0) {
                window.webContents.send('book:updated-batch', {
                  folderPath,
                  libraryId,
                  items: savedList
                });
              }
            } else if (msg.type === 'PROGRESS') {
              if (window) {
                window.webContents.send('book:scan-status', {
                  status: 'PROGRESS',
                  folderPath,
                  libraryId,
                  processedCount: msg.processedCount,
                  totalFound: msg.totalFound
                });
              }
            } else if (msg.type === 'DONE') {
              const foundSet = new Set<string>((msg.foundPaths || []).map((p: string) => path.normalize(p).toLowerCase()));
              // Remove missing books
              for (const [missingPath, missingBook] of existingMap.entries()) {
                if (!foundSet.has(missingPath) && missingBook.id) {
                  this.storageService.deleteBook(missingBook.id);
                  if (window) {
                    window.webContents.send('book:updated-remove', { id: missingBook.id, path: missingPath, folderPath, libraryId });
                  }
                }
              }
              resolve();
            } else if (msg.type === 'ERROR') {
              console.error('[ScannerBookService] Worker reported error:', msg.message);
              reject(new Error(msg.message || 'Worker error'));
            }
          } catch (handlerErr) {
            console.error('[ScannerBookService] Error handling worker message:', handlerErr);
          }
        });

        worker.on('error', (err) => {
          if (this.isStopping) {
            resolve();
            return;
          }
          console.error('[ScannerBookService] Worker thread error:', err);
          Telemetry.recordException(err, 'Book scanner worker error');
          reject(err);
        });

        worker.on('exit', (code) => {
          this.currentWorker = null;
          if (code !== 0 && !this.isStopping) {
            console.warn(`[ScannerBookService] Worker stopped with exit code ${code}`);
          }
          resolve();
        });
      });

    } catch (err) {
      if (!this.isStopping) {
        console.error('Error scanning book folder:', err);
        Telemetry.recordException(err, 'Error scanning book folder');
      }
    } finally {
      if (this.currentWorker) {
        try {
          this.currentWorker.terminate();
        } catch {}
        this.currentWorker = null;
      }
      const wasScanning = this.isScanning;
      this.isScanning = false;
      if (window && wasScanning && !this.isStopping) {
        window.webContents.send('book:scan-status', { status: 'FINISHED', folderPath, libraryId });
      }
    }
  }

  public async processSingleFile(filePath: string, window: BrowserWindow | null): Promise<Book | null> {
    try {
      if (!fs.existsSync(filePath)) return null;
      const stat = await fs.promises.stat(filePath);
      const folder = path.dirname(filePath);
      const libraryId = this.storageService.getOrCreateLibrary(folder, 'BOOK');

      const existingInDb = this.storageService.findBookByPath(filePath);
      if (existingInDb && existingInDb.id) {
        await this.checkAndRecoverMetadata(existingInDb, filePath, stat, libraryId, window);
        return this.storageService.findBookById(existingInDb.id) || existingInDb;
      }

      await this.processNewBook(filePath, stat, libraryId, window);
      return this.storageService.findBookByPath(filePath) || null;
    } catch (e) {
      console.error('Failed to process single book file:', filePath, e);
      Telemetry.recordException(e, `Failed to process single book file: ${filePath}`);
      return null;
    }
  }

  private async processNewBook(
    filePath: string,
    stat: fs.Stats,
    libraryId: number,
    window: BrowserWindow | null
  ): Promise<void> {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    const folder = path.dirname(filePath);

    // Extract metadata using BookExtractorFactory
    const meta = BookExtractorFactory.getMetadata(filePath);
    const title = meta.title || path.basename(filePath, ext);

    const book: Partial<Book> = {
      title,
      path: filePath,
      folder,
      name: fileName,
      fileSize: stat.size,
      fileType: getBookFileType(filePath),
      pages: 1,
      bookMark: 0,
      completed: false,
      favorite: false,
      author: meta.author || '',
      series: meta.series || '',
      genre: meta.genre || '',
      publisher: meta.publisher || '',
      volume: '',
      fkLibrary: libraryId,
      excluded: false,
      fileAlteration: stat.mtime.toISOString()
    };

    const extractedCover = BookImageCoverController.instance.getBookCoverFile(book as Book);
    if (extractedCover) {
      book.coverPath = extractedCover;
    }

    const existingInDb = this.storageService.findBookByPath(filePath);
    if (existingInDb) {
      book.id = existingInDb.id;
    }

    const id = this.storageService.saveBook(book);
    book.id = id;

    if (window) {
      window.webContents.send('book:updated-add', book);
    }
  }

  private async checkAndRecoverMetadata(
    existing: Book,
    filePath: string,
    stat: fs.Stats,
    libraryId: number,
    window: BrowserWindow | null
  ): Promise<void> {
    let needsUpdate = false;
    const updated: Partial<Book> = { ...existing };

    if (!existing.coverPath || !fs.existsSync(existing.coverPath)) {
      const extractedCover = BookImageCoverController.instance.getBookCoverFile(existing);
      if (extractedCover) {
        updated.coverPath = extractedCover;
        needsUpdate = true;
      }
    }

    if (!existing.author) {
      const meta = BookExtractorFactory.getMetadata(filePath);
      if (meta.author && !existing.author) { updated.author = meta.author; needsUpdate = true; }
      if (meta.series && !existing.series) { updated.series = meta.series; needsUpdate = true; }
      if (meta.genre && !existing.genre) { updated.genre = meta.genre; needsUpdate = true; }
      if (meta.publisher && !existing.publisher) { updated.publisher = meta.publisher; needsUpdate = true; }
    }

    if (needsUpdate || existing.fkLibrary !== libraryId) {
      updated.fkLibrary = libraryId;
      this.storageService.saveBook(updated);
      if (window) {
        window.webContents.send('book:updated-add', updated);
      }
    }
  }
}
