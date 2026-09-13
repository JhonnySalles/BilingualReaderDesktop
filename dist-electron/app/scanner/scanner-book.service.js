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
exports.ScannerBookService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const worker_threads_1 = require("worker_threads");
const app_enums_1 = require("../../src/app/core/models/enums/app-enums");
const book_extractor_factory_1 = require("../parser/book/book-extractor.factory");
const book_image_cover_controller_1 = require("../controllers/book-image-cover.controller");
const telemetry_1 = require("../utils/telemetry");
const app_paths_1 = require("../utils/app-paths");
class ScannerBookService {
    storageService;
    isScanning = false;
    currentWorker = null;
    constructor(storageService) {
        this.storageService = storageService;
    }
    isRunning() {
        return this.isScanning;
    }
    async scanFolder(folderPath, window, externalHd) {
        if (this.isScanning)
            return;
        this.isScanning = true;
        if (window) {
            window.webContents.send('book:scan-status', { status: 'STARTED', folderPath });
        }
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
                }
                catch (e) {
                    console.warn(`Could not create directory ${folderPath}:`, e);
                    this.isScanning = false;
                    return;
                }
            }
            const libraryId = this.storageService.getOrCreateLibrary(folderPath, 'BOOK');
            const existingBooks = this.storageService.listBooks(libraryId);
            const existingMap = new Map();
            const existingItemsMap = {};
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
                        if (msg.type === 'BATCH' && msg.items && msg.items.length > 0) {
                            const savedList = this.storageService.saveBooksBatch(msg.items);
                            if (window && savedList.length > 0) {
                                window.webContents.send('book:updated-batch', savedList);
                            }
                        }
                        else if (msg.type === 'PROGRESS') {
                            if (window) {
                                window.webContents.send('book:scan-status', {
                                    status: 'PROGRESS',
                                    folderPath,
                                    processedCount: msg.processedCount,
                                    totalFound: msg.totalFound
                                });
                            }
                        }
                        else if (msg.type === 'DONE') {
                            const foundSet = new Set((msg.foundPaths || []).map((p) => path.normalize(p).toLowerCase()));
                            // Remove missing books
                            for (const [missingPath, missingBook] of existingMap.entries()) {
                                if (!foundSet.has(missingPath) && missingBook.id) {
                                    this.storageService.deleteBook(missingBook.id);
                                    if (window) {
                                        window.webContents.send('book:updated-remove', { id: missingBook.id, path: missingPath });
                                    }
                                }
                            }
                            resolve();
                        }
                        else if (msg.type === 'ERROR') {
                            console.error('[ScannerBookService] Worker reported error:', msg.message);
                            reject(new Error(msg.message || 'Worker error'));
                        }
                    }
                    catch (handlerErr) {
                        console.error('[ScannerBookService] Error handling worker message:', handlerErr);
                    }
                });
                worker.on('error', (err) => {
                    console.error('[ScannerBookService] Worker thread error:', err);
                    telemetry_1.Telemetry.recordException(err, 'Book scanner worker error');
                    reject(err);
                });
                worker.on('exit', (code) => {
                    this.currentWorker = null;
                    if (code !== 0) {
                        console.warn(`[ScannerBookService] Worker stopped with exit code ${code}`);
                    }
                    resolve();
                });
            });
        }
        catch (err) {
            console.error('Error scanning book folder:', err);
            telemetry_1.Telemetry.recordException(err, 'Error scanning book folder');
        }
        finally {
            if (this.currentWorker) {
                try {
                    this.currentWorker.terminate();
                }
                catch { }
                this.currentWorker = null;
            }
            this.isScanning = false;
            if (window) {
                window.webContents.send('book:scan-status', { status: 'FINISHED', folderPath });
            }
        }
    }
    async processSingleFile(filePath, window) {
        try {
            if (!fs.existsSync(filePath))
                return null;
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
        }
        catch (e) {
            console.error('Failed to process single book file:', filePath, e);
            telemetry_1.Telemetry.recordException(e, `Failed to process single book file: ${filePath}`);
            return null;
        }
    }
    async processNewBook(filePath, stat, libraryId, window) {
        const ext = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath);
        const folder = path.dirname(filePath);
        // Extract metadata using BookExtractorFactory
        const meta = book_extractor_factory_1.BookExtractorFactory.getMetadata(filePath);
        const title = meta.title || path.basename(filePath, ext);
        const book = {
            title,
            path: filePath,
            folder,
            name: fileName,
            fileSize: stat.size,
            fileType: (0, app_enums_1.getBookFileType)(filePath),
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
        const extractedCover = book_image_cover_controller_1.BookImageCoverController.instance.getBookCoverFile(book);
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
    async checkAndRecoverMetadata(existing, filePath, stat, libraryId, window) {
        let needsUpdate = false;
        const updated = { ...existing };
        if (!existing.coverPath || !fs.existsSync(existing.coverPath)) {
            const extractedCover = book_image_cover_controller_1.BookImageCoverController.instance.getBookCoverFile(existing);
            if (extractedCover) {
                updated.coverPath = extractedCover;
                needsUpdate = true;
            }
        }
        if (!existing.author) {
            const meta = book_extractor_factory_1.BookExtractorFactory.getMetadata(filePath);
            if (meta.author && !existing.author) {
                updated.author = meta.author;
                needsUpdate = true;
            }
            if (meta.series && !existing.series) {
                updated.series = meta.series;
                needsUpdate = true;
            }
            if (meta.genre && !existing.genre) {
                updated.genre = meta.genre;
                needsUpdate = true;
            }
            if (meta.publisher && !existing.publisher) {
                updated.publisher = meta.publisher;
                needsUpdate = true;
            }
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
exports.ScannerBookService = ScannerBookService;
