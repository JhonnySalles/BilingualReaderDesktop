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
exports.BookReaderSessionService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const electron_1 = require("electron");
const ebook_converter_service_1 = require("./ebook-converter.service");
class BookReaderSessionService {
    active = new Map();
    allowedPaths = new Set();
    getConvertedCacheRoot() {
        return path.join(electron_1.app.getPath('userData'), 'cache', 'converted');
    }
    isPathAllowed(filePath) {
        let candidate = filePath;
        if (/^\/[A-Za-z]:\//.test(candidate)) {
            candidate = candidate.slice(1);
        }
        const resolved = path.resolve(candidate);
        if (this.allowedPaths.has(resolved)) {
            return true;
        }
        const convertRoot = path.resolve(this.getConvertedCacheRoot());
        return resolved === convertRoot || resolved.startsWith(convertRoot + path.sep);
    }
    toLocalBookUrl(filePath) {
        const normalized = path.resolve(filePath).replace(/\\/g, '/');
        return `local-book://book/?p=${encodeURIComponent(normalized)}`;
    }
    async open(bookId, bookPath, title, author, bookMark, bookMarkCfi, favorite, configuration) {
        if (!fs.existsSync(bookPath)) {
            throw new Error(`Arquivo não encontrado: ${bookPath}`);
        }
        let epubPath;
        try {
            epubPath = await ebook_converter_service_1.EBookConverterService.instance.convertToEpub(bookPath);
        }
        catch (err) {
            const msg = err?.message || String(err);
            if (/Failed to convert/i.test(msg)) {
                throw new Error('Não foi possível converter o arquivo para EPUB. Instale Pandoc ou Calibre (ebook-convert) e tente novamente.');
            }
            throw err;
        }
        if (!fs.existsSync(epubPath)) {
            throw new Error('Arquivo EPUB convertido não encontrado');
        }
        const resolvedEpub = path.resolve(epubPath);
        const resolvedSource = path.resolve(bookPath);
        this.allowedPaths.add(resolvedEpub);
        this.allowedPaths.add(resolvedSource);
        const sessionId = crypto.randomBytes(8).toString('hex');
        this.active.set(sessionId, {
            sessionId,
            bookId,
            epubPath: resolvedEpub,
            sourcePath: resolvedSource
        });
        return {
            sessionId,
            bookId,
            title,
            author,
            epubUrl: this.toLocalBookUrl(resolvedEpub),
            epubPath: resolvedEpub,
            bookMark: Math.max(0, bookMark || 0),
            bookMarkCfi: bookMarkCfi || '',
            favorite: !!favorite,
            configuration
        };
    }
    close(sessionId) {
        const session = this.active.get(sessionId);
        if (!session)
            return false;
        this.active.delete(sessionId);
        return true;
    }
}
exports.BookReaderSessionService = BookReaderSessionService;
