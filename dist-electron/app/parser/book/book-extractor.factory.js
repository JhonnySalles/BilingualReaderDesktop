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
class BookExtractorFactory {
    static getMetadata(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.epub' || ext === '.kepub') {
            const meta = epub_book_extractor_1.EpubBookExtractor.extractMetadata(filePath);
            if (!meta.title) {
                meta.title = path.basename(filePath, ext);
            }
            return meta;
        }
        // Default metadata inferred from file name
        const fileName = path.basename(filePath, ext);
        let title = fileName;
        let author = '';
        // Handle "Title - Author" format if present in filename
        if (fileName.includes(' - ')) {
            const parts = fileName.split(' - ');
            title = parts[0].trim();
            author = parts[1].trim();
        }
        return {
            title,
            author,
            series: '',
            genre: '',
            publisher: '',
            language: '',
            coverImage: null
        };
    }
}
exports.BookExtractorFactory = BookExtractorFactory;
