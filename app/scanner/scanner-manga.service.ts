import * as fs from 'fs';
import * as path from 'path';
import { BrowserWindow } from 'electron';
import { StorageService } from '../database/storage.service';
import { Manga } from '../../src/app/core/models/entities/manga.model';
import { FileType } from '../../src/app/core/models/enums/app-enums';
import { ParseFactory } from '../parser/manga/parse-factory';
import { MangaImageCoverController } from '../controllers/manga-image-cover.controller';

const MANGA_EXTENSIONS = new Set(['.cbz', '.cbr', '.cb7', '.cbt', '.zip', '.rar', '.7z', '.tar']);

export class ScannerMangaService {
  private isScanning = false;

  constructor(private storageService: StorageService) {}

  public isRunning(): boolean {
    return this.isScanning;
  }

  public async scanFolder(folderPath: string, window: BrowserWindow | null): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    if (window) {
      window.webContents.send('manga:scan-status', { status: 'STARTED', folderPath });
    }

    try {
      if (!fs.existsSync(folderPath)) {
        try {
          fs.mkdirSync(folderPath, { recursive: true });
        } catch (e) {
          console.warn(`Could not create directory ${folderPath}:`, e);
          return;
        }
      }

      const libraryId = this.storageService.getOrCreateLibrary(folderPath);
      const existingMangas = this.storageService.listMangas(libraryId);
      const existingMap = new Map<string, Manga>();
      existingMangas.forEach(m => {
        const p = m.path || (m as any).file || '';
        if (p) {
          existingMap.set(path.normalize(p).toLowerCase(), m);
        }
      });

      const foundPaths = new Set<string>();
      await this.walkDirectory(folderPath, async (itemPath, stat, isDir) => {
        if (isDir) {
          // Check if directory itself is a chapter/manga (e.g. contains images)
          const parser = await ParseFactory.create(itemPath);
          if (parser) {
            try {
              if (parser.numPages() >= 4) {
                foundPaths.add(itemPath);
                const normKey = path.normalize(itemPath).toLowerCase();
                if (!existingMap.has(normKey)) {
                  await this.processNewManga(itemPath, stat, libraryId, window, true);
                } else {
                  const existingItem = existingMap.get(normKey)!;
                  await this.checkAndRecoverMetadata(existingItem, itemPath, stat, libraryId, window);
                  existingMap.delete(normKey);
                }
              }
            } finally {
              parser.destroy();
            }
          }
          return;
        }

        const ext = path.extname(itemPath).toLowerCase();
        if (MANGA_EXTENSIONS.has(ext)) {
          foundPaths.add(itemPath);
          const normKey = path.normalize(itemPath).toLowerCase();
          if (!existingMap.has(normKey)) {
            // New Manga Found
            await this.processNewManga(itemPath, stat, libraryId, window, false);
          } else {
            const existingItem = existingMap.get(normKey)!;
            await this.checkAndRecoverMetadata(existingItem, itemPath, stat, libraryId, window);
            existingMap.delete(normKey);
          }
        }
      });

      // Remove missing mangas
      for (const [missingPath, missingManga] of existingMap.entries()) {
        if (missingManga.id) {
          this.storageService.deleteManga(missingManga.id);
          if (window) {
            window.webContents.send('manga:updated-remove', { id: missingManga.id, path: missingPath });
          }
        }
      }

    } catch (err) {
      console.error('Error scanning folder:', err);
    } finally {
      this.isScanning = false;
      if (window) {
        window.webContents.send('manga:scan-status', { status: 'FINISHED', folderPath });
      }
    }
  }

  private async walkDirectory(
    dir: string, 
    callback: (itemPath: string, stat: fs.Stats, isDirectory: boolean) => Promise<void>
  ): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const stat = await fs.promises.stat(fullPath);
          await callback(fullPath, stat, true);
          await this.walkDirectory(fullPath, callback);
        } else if (entry.isFile()) {
          const stat = await fs.promises.stat(fullPath);
          await callback(fullPath, stat, false);
        }
      }
    } catch (err) {
      console.warn(`Could not read directory ${dir}:`, err);
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

    // Use ParseFactory to inspect comic/manga file or directory
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

    const typeStr = isDirectory ? 'FOLDER' : ext.replace('.', '').toUpperCase();
    const manga: Partial<Manga> = {
      title,
      path: itemPath,
      folder,
      name: fileName,
      fileSize: stat.size,
      fileType: isDirectory ? (FileType as any)['CBZ'] || FileType.CBZ : ((FileType as any)[typeStr] || FileType.UNKNOWN),
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


