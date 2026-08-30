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
const app_enums_1 = require("../../src/app/core/models/enums/app-enums");
const parse_factory_1 = require("../parser/manga/parse-factory");
const manga_image_cover_controller_1 = require("../controllers/manga-image-cover.controller");
const MANGA_EXTENSIONS = new Set(['.cbz', '.cbr', '.cb7', '.cbt', '.zip', '.rar', '.7z', '.tar', '.epub', '.epub3']);
class ScannerMangaService {
    storageService;
    isScanning = false;
    constructor(storageService) {
        this.storageService = storageService;
    }
    isRunning() {
        return this.isScanning;
    }
    async scanFolder(folderPath, window) {
        if (this.isScanning)
            return;
        this.isScanning = true;
        if (window) {
            window.webContents.send('manga:scan-status', { status: 'STARTED', folderPath });
        }
        try {
            if (!fs.existsSync(folderPath)) {
                return;
            }
            const libraryId = this.storageService.getOrCreateLibrary(folderPath);
            const existingMangas = this.storageService.listMangas(libraryId);
            const existingMap = new Map();
            existingMangas.forEach(m => existingMap.set(m.path || m.file || '', m));
            const foundPaths = new Set();
            await this.walkDirectory(folderPath, async (filePath, stat) => {
                const ext = path.extname(filePath).toLowerCase();
                if (MANGA_EXTENSIONS.has(ext)) {
                    foundPaths.add(filePath);
                    if (!existingMap.has(filePath)) {
                        // New Manga Found
                        await this.processNewManga(filePath, stat, libraryId, window);
                    }
                    else {
                        existingMap.delete(filePath);
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
        }
        catch (err) {
            console.error('Error scanning folder:', err);
        }
        finally {
            this.isScanning = false;
            if (window) {
                window.webContents.send('manga:scan-status', { status: 'FINISHED', folderPath });
            }
        }
    }
    async walkDirectory(dir, callback) {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await this.walkDirectory(fullPath, callback);
            }
            else if (entry.isFile()) {
                const stat = await fs.promises.stat(fullPath);
                await callback(fullPath, stat);
            }
        }
    }
    async processNewManga(filePath, stat, libraryId, window) {
        const ext = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath);
        const title = path.basename(filePath, ext);
        const folder = path.dirname(filePath);
        let pages = 1;
        let coverPath = undefined;
        let author = '';
        let series = '';
        let genre = '';
        let publisher = '';
        let volume = '';
        let hasSubtitle = false;
        // Use ParseFactory to inspect comic/manga file
        const parser = parse_factory_1.ParseFactory.create(filePath);
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
                const mangaEntity = { path: filePath, name: fileName };
                const extractedCover = manga_image_cover_controller_1.MangaImageCoverController.instance.getMangaCoverFile(mangaEntity);
                if (extractedCover) {
                    coverPath = extractedCover;
                }
            }
            catch (e) {
                console.warn(`Could not parse ${fileName}:`, e);
            }
            finally {
                parser.destroy();
            }
        }
        const typeStr = ext.replace('.', '').toUpperCase();
        const manga = {
            title,
            path: filePath,
            folder,
            name: fileName,
            fileSize: stat.size,
            fileType: app_enums_1.FileType[typeStr] || app_enums_1.FileType.UNKNOWN,
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
        const id = this.storageService.saveManga(manga);
        manga.id = id;
        if (window) {
            window.webContents.send('manga:updated-add', manga);
        }
    }
}
exports.ScannerMangaService = ScannerMangaService;
