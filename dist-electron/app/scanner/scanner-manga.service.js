"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScannerMangaService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const worker_threads_1 = require("worker_threads");
const app_enums_1 = require("../../src/app/core/models/enums/app-enums");
const parse_factory_1 = require("../parser/manga/parse-factory");
const manga_image_cover_controller_1 = require("../controllers/manga-image-cover.controller");
const telemetry_1 = require("../utils/telemetry");
const app_paths_1 = require("../utils/app-paths");
class ScannerMangaService {
    storageService;
    isScanning = false;
    isStopping = false;
    currentFolderPath = '';
    currentWorker = null;
    constructor(storageService) {
        this.storageService = storageService;
    }
    isRunning() {
        return this.isScanning;
    }
    async stopScanning(window) {
        if (!this.isScanning && !this.currentWorker)
            return;
        this.isStopping = true;
        const stoppedFolder = this.currentFolderPath;
        if (this.currentWorker) {
            try {
                this.currentWorker.postMessage({ type: 'STOP' });
                await this.currentWorker.terminate();
            }
            catch (e) {
                console.warn('[ScannerMangaService] Worker termination warning:', e);
            }
            this.currentWorker = null;
        }
        this.isScanning = false;
        this.isStopping = false;
        if (window) {
            window.webContents.send('manga:scan-status', { status: 'CANCELLED', folderPath: stoppedFolder });
        }
    }
    async scanFolder(folderPath, window, externalHd) {
        if (this.isScanning) {
            await this.stopScanning(window);
        }
        this.isScanning = true;
        this.currentFolderPath = folderPath;
        if (window) {
            window.webContents.send('manga:scan-status', { status: 'STARTED', folderPath });
        }
        let libraryId = 0;
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
                }
                catch (e) {
                    console.warn(`Could not create directory ${folderPath}:`, e);
                    this.isScanning = false;
                    return;
                }
            }
            libraryId = this.storageService.getOrCreateLibrary(folderPath, 'MANGA');
            const existingMangas = this.storageService.listMangas(libraryId);
            const existingMap = new Map();
            const existingItemsMap = {};
            existingMangas.forEach(m => {
                const p = m.path || m.file || '';
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
            await new Promise((resolve, reject) => {
                const worker = new worker_threads_1.Worker(workerPath, {
                    workerData: {
                        folderPath,
                        libraryId,
                        existingItemsMap,
                        baseDir: (0, app_paths_1.getAppBaseDir)(),
                        coversDir: (0, app_paths_1.getAppCoversDir)()
                    }
                });
                this.currentWorker = worker;
                worker.on('message', (msg) => {
                    try {
                        if (this.isStopping)
                            return;
                        if (msg.type === 'BATCH' && msg.items && msg.items.length > 0) {
                            const savedList = this.storageService.saveMangasBatch(msg.items);
                            if (window && savedList.length > 0) {
                                window.webContents.send('manga:updated-batch', {
                                    folderPath,
                                    libraryId,
                                    items: savedList
                                });
                            }
                        }
                        else if (msg.type === 'PROGRESS') {
                            if (window) {
                                window.webContents.send('manga:scan-status', {
                                    status: 'PROGRESS',
                                    folderPath,
                                    libraryId,
                                    processedCount: msg.processedCount,
                                    totalFound: msg.totalFound
                                });
                            }
                        }
                        else if (msg.type === 'DONE') {
                            const foundSet = new Set((msg.foundPaths || []).map((p) => path.normalize(p).toLowerCase()));
                            // Remove missing mangas
                            for (const [missingPath, missingManga] of existingMap.entries()) {
                                if (!foundSet.has(missingPath) && missingManga.id) {
                                    this.storageService.deleteManga(missingManga.id);
                                    if (window) {
                                        window.webContents.send('manga:updated-remove', { id: missingManga.id, path: missingPath, folderPath, libraryId });
                                    }
                                }
                            }
                            resolve();
                        }
                        else if (msg.type === 'ERROR') {
                            console.error('[ScannerMangaService] Worker reported error:', msg.message);
                            reject(new Error(msg.message || 'Worker error'));
                        }
                    }
                    catch (handlerErr) {
                        console.error('[ScannerMangaService] Error handling worker message:', handlerErr);
                    }
                });
                worker.on('error', (err) => {
                    if (this.isStopping) {
                        resolve();
                        return;
                    }
                    console.error('[ScannerMangaService] Worker thread error:', err);
                    telemetry_1.Telemetry.recordException(err, 'Manga scanner worker error');
                    reject(err);
                });
                worker.on('exit', (code) => {
                    this.currentWorker = null;
                    if (code !== 0 && !this.isStopping) {
                        console.warn(`[ScannerMangaService] Worker stopped with exit code ${code}`);
                    }
                    resolve();
                });
            });
        }
        catch (err) {
            if (!this.isStopping) {
                console.error('Error scanning manga folder:', err);
                telemetry_1.Telemetry.recordException(err, 'Error scanning manga folder');
            }
        }
        finally {
            if (this.currentWorker) {
                try {
                    this.currentWorker.terminate();
                }
                catch { }
                this.currentWorker = null;
            }
            const wasScanning = this.isScanning;
            this.isScanning = false;
            if (window && wasScanning && !this.isStopping) {
                window.webContents.send('manga:scan-status', { status: 'FINISHED', folderPath, libraryId });
            }
        }
    }
    async processSingleFile(filePath, window) {
        try {
            if (!fs.existsSync(filePath))
                return null;
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
        }
        catch (e) {
            console.error('Failed to process single manga file:', filePath, e);
            telemetry_1.Telemetry.recordException(e, `Failed to process single manga file: ${filePath}`);
            return null;
        }
    }
    async processNewManga(itemPath, stat, libraryId, window, isDirectory = false) {
        const ext = isDirectory ? '' : path.extname(itemPath).toLowerCase();
        const fileName = path.basename(itemPath);
        const title = isDirectory ? fileName : path.basename(itemPath, ext);
        const folder = isDirectory ? itemPath : path.dirname(itemPath);
        let pages = 1;
        let coverPath = undefined;
        let author = '';
        let series = '';
        let genre = '';
        let publisher = '';
        let volume = '';
        let hasSubtitle = false;
        const parser = await parse_factory_1.ParseFactory.create(itemPath);
        if (parser) {
            try {
                pages = Math.max(1, parser.numPages());
                hasSubtitle = parser.hasSubtitles();
                const comicInfo = parser.getComicInfo();
                if (comicInfo) {
                    if (comicInfo.writer)
                        author = comicInfo.writer;
                    if (comicInfo.series)
                        series = comicInfo.series;
                    if (comicInfo.genre)
                        genre = comicInfo.genre;
                    if (comicInfo.publisher)
                        publisher = comicInfo.publisher;
                    if (comicInfo.number)
                        volume = comicInfo.number;
                }
                const coverStreams = parser.getCover();
                if (coverStreams.front) {
                    coverPath = manga_image_cover_controller_1.MangaImageCoverController.instance.saveCoverToCache(itemPath, coverStreams.front);
                }
            }
            catch (e) {
                console.warn(`Could not parse ${fileName}:`, e);
            }
            finally {
                parser.destroy();
            }
        }
        const manga = {
            title,
            path: itemPath,
            folder,
            name: fileName,
            fileSize: stat.size,
            fileType: isDirectory ? app_enums_1.FileType.DIRECTORY : (0, app_enums_1.getMangaFileType)(itemPath),
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
    async checkAndRecoverMetadata(existing, itemPath, stat, libraryId, window) {
        let needsUpdate = false;
        const updated = { ...existing };
        if (!existing.coverPath || !fs.existsSync(existing.coverPath)) {
            const extractedCover = await manga_image_cover_controller_1.MangaImageCoverController.instance.getMangaCoverFile(existing);
            if (extractedCover) {
                updated.coverPath = extractedCover;
                needsUpdate = true;
            }
        }
        if (!existing.author || !existing.series) {
            const parser = await parse_factory_1.ParseFactory.create(itemPath);
            if (parser) {
                try {
                    const comicInfo = parser.getComicInfo();
                    if (comicInfo) {
                        if (comicInfo.writer && !existing.author) {
                            updated.author = comicInfo.writer;
                            needsUpdate = true;
                        }
                        if (comicInfo.series && !existing.series) {
                            updated.series = comicInfo.series;
                            needsUpdate = true;
                        }
                        if (comicInfo.genre && !existing.genre) {
                            updated.genre = comicInfo.genre;
                            needsUpdate = true;
                        }
                        if (comicInfo.publisher && !existing.publisher) {
                            updated.publisher = comicInfo.publisher;
                            needsUpdate = true;
                        }
                        if (comicInfo.number && !existing.volume) {
                            updated.volume = comicInfo.number;
                            needsUpdate = true;
                        }
                    }
                }
                finally {
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
exports.ScannerMangaService = ScannerMangaService;
