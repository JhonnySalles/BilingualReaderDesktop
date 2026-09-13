import { parentPort, workerData } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';
import { Manga } from '../../src/app/core/models/entities/manga.model';
import { FileType, getMangaFileType } from '../../src/app/core/models/enums/app-enums';
import { ParseFactory } from '../parser/manga/parse-factory';
import { MangaImageCoverController } from '../controllers/manga-image-cover.controller';
import { setAppBaseDir, setAppCoversDir } from '../utils/app-paths';

const MANGA_EXTENSIONS = new Set(['.cbz', '.cbr', '.cb7', '.cbt', '.zip', '.rar', '.7z', '.tar']);
const BATCH_SIZE = 5;

interface WorkerInput {
  folderPath: string;
  libraryId: number;
  existingItemsMap: Record<string, Partial<Manga>>;
  baseDir?: string;
  coversDir?: string;
}

async function run(): Promise<void> {
  if (!parentPort) {
    console.error('[manga-scanner.worker] parentPort is not available.');
    return;
  }

  const { folderPath, libraryId, existingItemsMap, baseDir, coversDir } = workerData as WorkerInput;
  if (baseDir) {
    setAppBaseDir(baseDir);
  }
  if (coversDir) {
    setAppCoversDir(coversDir);
  }
  const foundPaths = new Set<string>();
  let batch: Partial<Manga>[] = [];
  let processedCount = 0;
  let lastFlushTime = Date.now();

  const flushBatch = () => {
    if (batch.length > 0) {
      parentPort!.postMessage({ type: 'BATCH', items: batch });
      batch = [];
      lastFlushTime = Date.now();
    }
  };

  const walkDirectory = async (dir: string): Promise<void> => {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const stat = await fs.promises.stat(fullPath);
          const parser = await ParseFactory.create(fullPath);
          if (parser) {
            try {
              if (parser.numPages() >= 4) {
                foundPaths.add(fullPath);
                await handleMangaPath(fullPath, stat, true);
                continue;
              }
            } finally {
              parser.destroy();
            }
          }
          await walkDirectory(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(fullPath).toLowerCase();
          if (MANGA_EXTENSIONS.has(ext)) {
            const stat = await fs.promises.stat(fullPath);
            foundPaths.add(fullPath);
            await handleMangaPath(fullPath, stat, false);
          }
        }
      }
    } catch (err) {
      console.warn(`[manga-scanner.worker] Could not read directory ${dir}:`, err);
    }
  };

  const handleMangaPath = async (
    itemPath: string,
    stat: fs.Stats,
    isDirectory: boolean
  ): Promise<void> => {
    const normKey = path.normalize(itemPath).toLowerCase();
    const existing = existingItemsMap[normKey];

    if (existing) {
      // Existing manga: check if metadata/cover needs recovery
      let needsUpdate = false;
      const updated: Partial<Manga> = { ...existing };

      if (!existing.coverPath || !fs.existsSync(existing.coverPath)) {
        const extractedCover = await MangaImageCoverController.instance.getMangaCoverFile(existing as Manga);
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
        batch.push(updated);
      }
    } else {
      // New manga
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
          console.warn(`[manga-scanner.worker] Could not parse ${fileName}:`, e);
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

      batch.push(manga);
    }

    processedCount++;
    const now = Date.now();
    if (batch.length >= BATCH_SIZE || (batch.length > 0 && now - lastFlushTime >= 300)) {
      flushBatch();
    }

    if (processedCount % 5 === 0) {
      parentPort!.postMessage({ type: 'PROGRESS', processedCount, totalFound: foundPaths.size });
    }

    // Yield event loop every 5 items
    if (processedCount % 5 === 0) {
      await new Promise<void>(resolve => setImmediate(resolve));
    }
  };

  try {
    await walkDirectory(folderPath);
    flushBatch();
    parentPort.postMessage({ type: 'DONE', foundPaths: Array.from(foundPaths) });
  } catch (err: any) {
    console.error('[manga-scanner.worker] Unhandled error during scan:', err);
    parentPort.postMessage({ type: 'ERROR', message: err?.message || String(err) });
  }
}

void run();
