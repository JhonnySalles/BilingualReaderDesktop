import * as fs from 'fs';
import * as path from 'path';
import { BrowserWindow } from 'electron';
import { StorageService } from '../database/storage.service';
import { Book } from '../../src/app/core/models/entities/book.model';
import { FileType } from '../../src/app/core/models/enums/app-enums';
import { BookExtractorFactory } from '../parser/book/book-extractor.factory';
import { BookImageCoverController } from '../controllers/book-image-cover.controller';

const BOOK_EXTENSIONS = new Set([
  '.epub', '.kepub', '.epub3', '.pdf', '.xps', '.mobi', '.azw', '.azw3', '.azw4',
  '.pdb', '.prc', '.djvu', '.fb2', '.txt', '.playlist', '.log', '.tcr', '.rtf',
  '.html', '.htm', '.xhtml', '.xhtm', '.xml', '.htmlz', '.pmlz', '.doc', '.docx',
  '.odt', '.md', '.markdown', '.mht', '.mhtml', '.shtml'
]);

export class ScannerBookService {
  private isScanning = false;

  constructor(private storageService: StorageService) {}

  public isRunning(): boolean {
    return this.isScanning;
  }

  public async scanFolder(folderPath: string, window: BrowserWindow | null): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    if (window) {
      window.webContents.send('book:scan-status', { status: 'STARTED', folderPath });
    }

    try {
      if (!fs.existsSync(folderPath)) {
        return;
      }

      const libraryId = this.storageService.getOrCreateLibrary(folderPath, 'BOOK');
      const existingBooks = this.storageService.listBooks(libraryId);
      const existingMap = new Map<string, Book>();
      existingBooks.forEach(b => existingMap.set(b.path || '', b));

      const foundPaths = new Set<string>();
      await this.walkDirectory(folderPath, async (filePath, stat) => {
        const ext = path.extname(filePath).toLowerCase();
        if (BOOK_EXTENSIONS.has(ext)) {
          foundPaths.add(filePath);
          if (!existingMap.has(filePath)) {
            // New Book Found
            await this.processNewBook(filePath, stat, libraryId, window);
          } else {
            existingMap.delete(filePath);
          }
        }
      });

      // Remove missing books
      for (const [missingPath, missingBook] of existingMap.entries()) {
        if (missingBook.id) {
          this.storageService.deleteBook(missingBook.id);
          if (window) {
            window.webContents.send('book:updated-remove', { id: missingBook.id, path: missingPath });
          }
        }
      }

    } catch (err) {
      console.error('Error scanning book folder:', err);
    } finally {
      this.isScanning = false;
      if (window) {
        window.webContents.send('book:scan-status', { status: 'FINISHED', folderPath });
      }
    }
  }

  private async walkDirectory(dir: string, callback: (filePath: string, stat: fs.Stats) => Promise<void>): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.walkDirectory(fullPath, callback);
      } else if (entry.isFile()) {
        const stat = await fs.promises.stat(fullPath);
        await callback(fullPath, stat);
      }
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

    const typeStr = ext.replace('.', '').toUpperCase();
    const book: Partial<Book> = {
      title,
      path: filePath,
      folder,
      name: fileName,
      fileSize: stat.size,
      fileType: (FileType as any)[typeStr] || FileType.UNKNOWN,
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

    const id = this.storageService.saveBook(book);
    book.id = id;

    if (window) {
      window.webContents.send('book:updated-add', book);
    }
  }
}
