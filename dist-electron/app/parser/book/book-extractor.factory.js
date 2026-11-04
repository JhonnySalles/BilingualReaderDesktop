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
exports.BookExtractorFactory = void 0;
const path = __importStar(require("path"));
const epub_book_extractor_1 = require("./epub-book-extractor");
const mobi_book_extractor_1 = require("./mobi-book-extractor");
const fb2_book_extractor_1 = require("./fb2-book-extractor");
const docx_book_extractor_1 = require("./docx-book-extractor");
const archive_book_extractor_1 = require("./archive-book-extractor");
const rocket_book_extractor_1 = require("./rocket-book-extractor");
const snb_book_extractor_1 = require("./snb-book-extractor");
const calibre_meta_extractor_1 = require("./calibre-meta-extractor");
const cover_generator_1 = require("./cover-generator");
class BookExtractorFactory {
    static getMetadata(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath, ext);
        let meta = null;
        // 1. Tenta extratores nativos específicos por formato
        meta = this.extractByExt(filePath, ext);
        // 2. Se não extraiu ou faltou capa, tenta o CalibreMetaExtractor (pasta do Calibre ou CLI)
        // Para formatos comprovadamente de texto puro (.txt, .pdb, .tcr), não executa CLI demorado se não houver capa local
        const isTextOnly = ext === '.txt' || ext === '.pdb' || ext === '.tcr';
        if (!meta || !meta.coverImage) {
            const calibreMeta = calibre_meta_extractor_1.CalibreMetaExtractor.extractMetadata(filePath, isTextOnly);
            if (calibreMeta) {
                if (!meta) {
                    meta = calibreMeta;
                }
                else {
                    if (!meta.coverImage && calibreMeta.coverImage) {
                        meta.coverImage = calibreMeta.coverImage;
                    }
                    if (!meta.author && calibreMeta.author)
                        meta.author = calibreMeta.author;
                    if (!meta.series && calibreMeta.series)
                        meta.series = calibreMeta.series;
                    if (!meta.annotation && calibreMeta.annotation)
                        meta.annotation = calibreMeta.annotation;
                    if (!meta.genre && calibreMeta.genre)
                        meta.genre = calibreMeta.genre;
                    if (!meta.isbn && calibreMeta.isbn)
                        meta.isbn = calibreMeta.isbn;
                    if (!meta.publisher && calibreMeta.publisher)
                        meta.publisher = calibreMeta.publisher;
                    if (!meta.language && calibreMeta.language)
                        meta.language = calibreMeta.language;
                    if (!meta.tags && calibreMeta.tags)
                        meta.tags = calibreMeta.tags;
                }
            }
        }
        // 3. Fallback de título e autor pelo nome do arquivo
        let title = meta?.title?.trim() || fileName;
        let author = meta?.author?.trim() || '';
        if (!author && fileName.includes(' - ')) {
            const parts = fileName.split(' - ');
            title = parts[0].trim();
            author = parts[1].trim();
        }
        // 4. Se ainda assim não houver imagem de capa (formatos de texto puro: .txt, .pdb, .tcr), gera a capa visual estilizada!
        let coverImage = meta?.coverImage || null;
        if (!coverImage) {
            coverImage = cover_generator_1.CoverGenerator.generateSvgCover(title, author, ext);
        }
        return {
            title,
            author,
            series: meta?.series || '',
            genre: meta?.genre || '',
            publisher: meta?.publisher || '',
            language: meta?.language || '',
            isbn: meta?.isbn || '',
            annotation: meta?.annotation || '',
            tags: meta?.tags || '',
            coverImage
        };
    }
    static extractByExt(filePath, ext) {
        switch (ext) {
            case '.epub':
            case '.kepub':
            case '.epub3':
                return epub_book_extractor_1.EpubBookExtractor.extractMetadata(filePath);
            case '.mobi':
            case '.azw':
            case '.azw3':
            case '.azw4':
            case '.prc':
                return mobi_book_extractor_1.MobiBookExtractor.extractMetadata(filePath);
            case '.fb2':
                return fb2_book_extractor_1.Fb2BookExtractor.extractMetadata(filePath);
            case '.docx':
                return docx_book_extractor_1.DocxBookExtractor.extractMetadata(filePath);
            case '.htmlz':
            case '.txtz':
                return archive_book_extractor_1.ArchiveBookExtractor.extractMetadata(filePath);
            case '.rb':
                return rocket_book_extractor_1.RocketBookExtractor.extractMetadata(filePath);
            case '.snb':
                return snb_book_extractor_1.SnbBookExtractor.extractMetadata(filePath);
            case '.pdf':
            case '.lit':
            case '.lrf':
                return calibre_meta_extractor_1.CalibreMetaExtractor.extractMetadata(filePath);
            default:
                return null;
        }
    }
}
exports.BookExtractorFactory = BookExtractorFactory;
