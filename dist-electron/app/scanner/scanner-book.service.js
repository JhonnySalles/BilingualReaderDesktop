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
const app_enums_1 = require("../../src/app/core/models/enums/app-enums");
const book_extractor_factory_1 = require("../parser/book/book-extractor.factory");
const book_image_cover_controller_1 = require("../controllers/book-image-cover.controller");
const BOOK_EXTENSIONS = new Set([
    '.epub', '.kepub', '.epub3', '.pdf', '.xps', '.mobi', '.azw', '.azw3', '.azw4',
    '.pdb', '.prc', '.djvu', '.fb2', '.txt', '.playlist', '.log', '.tcr', '.rtf',
    '.html', '.htm', '.xhtml', '.xhtm', '.xml', '.htmlz', '.pmlz', '.doc', '.docx',
    '.odt', '.md', '.markdown', '.mht', '.mhtml', '.shtml'
]);
class ScannerBookService {
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
            window.webContents.send('book:scan-status', { status: 'STARTED', folderPath });
        }
        try {
            if (!fs.existsSync(folderPath)) {
                return;
            }
            const libraryId = this.storageService.getOrCreateLibrary(folderPath, 'BOOK');
            const existingBooks = this.storageService.listBooks(libraryId);
            const existingMap = new Map();
            existingBooks.forEach(b => existingMap.set(b.path || '', b));
            const foundPaths = new Set();
            await this.walkDirectory(folderPath, async (filePath, stat) => {
                const ext = path.extname(filePath).toLowerCase();
                if (BOOK_EXTENSIONS.has(ext)) {
                    foundPaths.add(filePath);
                    if (!existingMap.has(filePath)) {
                        // New Book Found
                        await this.processNewBook(filePath, stat, libraryId, window);
                    }
                    else {
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
        }
        catch (err) {
            console.error('Error scanning book folder:', err);
        }
        finally {
            this.isScanning = false;
            if (window) {
                window.webContents.send('book:scan-status', { status: 'FINISHED', folderPath });
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
    async processNewBook(filePath, stat, libraryId, window) {
        const ext = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath);
        const folder = path.dirname(filePath);
        // Extract metadata using BookExtractorFactory
        const meta = book_extractor_factory_1.BookExtractorFactory.getMetadata(filePath);
        const title = meta.title || path.basename(filePath, ext);
        const typeStr = ext.replace('.', '').toUpperCase();
        const book = {
            title,
            path: filePath,
            folder,
            name: fileName,
            fileSize: stat.size,
            fileType: app_enums_1.FileType[typeStr] || app_enums_1.FileType.UNKNOWN,
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
        const id = this.storageService.saveBook(book);
        book.id = id;
        if (window) {
            window.webContents.send('book:updated-add', book);
        }
    }
}
exports.ScannerBookService = ScannerBookService;
