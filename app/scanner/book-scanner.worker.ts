import { parentPort, workerData } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';
import { Book } from '../../src/app/core/models/entities/book.model';
import { getBookFileType } from '../../src/app/core/models/enums/app-enums';
import { BookExtractorFactory } from '../parser/book/book-extractor.factory';
import { BookImageCoverController } from '../controllers/book-image-cover.controller';
import { setAppBaseDir, setAppCoversDir } from '../utils/app-paths';

const BOOK_EXTENSIONS = new Set([
  '.epub',
  '.kepub',
  '.epub3',
  '.pdf',
  '.xps',
  '.mobi',
  '.azw',
  '.azw3',
  '.azw4',
  '.pdb',
  '.prc',
  '.djvu',
  '.fb2',
  '.txt',
  '.rtf',
  '.html',
  '.htm',
  '.xhtml',
  '.xhtm',
  '.htmlz',
  '.pmlz',
  '.doc',
  '.docx',
  '.odt',
  '.md',
  '.markdown',
  '.mht',
  '.mhtml',
  '.shtml'
]);

const BATCH_SIZE = 5;

interface WorkerInput {
  folderPath: string;
  libraryId: number;
  existingItemsMap: Record<string, Partial<Book>>;
  baseDir?: string;
  coversDir?: string;
}

async function run(): Promise<void> {
  if (!parentPort) {
    console.error('[book-scanner.worker] parentPort is not available.');
    return;
  }

  let isStopped = false;
  parentPort.on('message', (msg: { type: string }) => {
    if (msg?.type === 'STOP') {
      isStopped = true;
    }
  });

  const { folderPath, libraryId, existingItemsMap, baseDir, coversDir } = workerData as WorkerInput;
  if (baseDir) {
    setAppBaseDir(baseDir);
  }
  if (coversDir) {
    setAppCoversDir(coversDir);
  }
  const foundPaths = new Set<string>();
  let batch: Partial<Book>[] = [];
  let processedCount = 0;
  let lastFlushTime = Date.now();

  const flushBatch = () => {
    if (isStopped) return;
    if (batch.length > 0) {
      parentPort!.postMessage({ type: 'BATCH', items: batch });
      batch = [];
      lastFlushTime = Date.now();
    }
  };

  const walkDirectory = async (dir: string): Promise<void> => {
    if (isStopped) return;
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (isStopped) return;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walkDirectory(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(fullPath).toLowerCase();
          if (BOOK_EXTENSIONS.has(ext)) {
            const stat = await fs.promises.stat(fullPath);
            foundPaths.add(fullPath);
            await handleBookPath(fullPath, stat);
          }
        }
      }
    } catch (err) {
      console.warn(`[book-scanner.worker] Could not read directory ${dir}:`, err);
    }
  };

  const handleBookPath = async (
    filePath: string,
    stat: fs.Stats
  ): Promise<void> => {
    if (isStopped) return;
    const normKey = path.normalize(filePath).toLowerCase();
    const existing = existingItemsMap[normKey];

    if (existing) {
      let needsUpdate = false;
      const updated: Partial<Book> = { ...existing };

      if (!existing.coverPath || !fs.existsSync(existing.coverPath)) {
        const extractedCover = BookImageCoverController.instance.getBookCoverFile(existing as Book);
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
        batch.push(updated);
      }
    } else {
      const ext = path.extname(filePath).toLowerCase();
      const fileName = path.basename(filePath);
      const folder = path.dirname(filePath);

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

      batch.push(book);
    }

    if (isStopped) return;
    processedCount++;
    const now = Date.now();
    if (batch.length >= BATCH_SIZE || (batch.length > 0 && now - lastFlushTime >= 300)) {
      flushBatch();
    }

    if (processedCount % 5 === 0) {
      if (!isStopped) {
        parentPort!.postMessage({ type: 'PROGRESS', processedCount, totalFound: foundPaths.size });
      }
    }

    // Yield event loop every 5 items
    if (processedCount % 5 === 0) {
      await new Promise<void>(resolve => setImmediate(resolve));
    }
  };

  try {
    await walkDirectory(folderPath);
    if (!isStopped) {
      flushBatch();
      parentPort.postMessage({ type: 'DONE', foundPaths: Array.from(foundPaths) });
    }
  } catch (err: any) {
    if (!isStopped) {
      console.error('[book-scanner.worker] Unhandled error during scan:', err);
      parentPort.postMessage({ type: 'ERROR', message: err?.message || String(err) });
    }
  }
}

void run();
