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
exports.MangaImageCoverController = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const parse_factory_1 = require("../parser/manga/parse-factory");
class MangaImageCoverController {
    static _instance;
    static get instance() {
        if (!this._instance) {
            this._instance = new MangaImageCoverController();
        }
        return this._instance;
    }
    getCacheDir() {
        const baseDir = process.cwd();
        const cacheDir = path.join(baseDir, 'manga_cover');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
        return cacheDir;
    }
    generateHash(filePath) {
        return crypto.createHash('md5').update(filePath).digest('hex');
    }
    async getMangaCoverFile(manga) {
        const filePath = manga.path || manga.file;
        if (!filePath || !fs.existsSync(filePath)) {
            return null;
        }
        const hash = this.generateHash(filePath);
        const cacheDir = this.getCacheDir();
        const coverPath = path.join(cacheDir, `${hash}.png`);
        if (fs.existsSync(coverPath)) {
            return coverPath;
        }
        const parser = await parse_factory_1.ParseFactory.create(filePath);
        if (!parser) {
            return null;
        }
        try {
            const cover = parser.getCover();
            const coverBuffer = cover.front;
            if (coverBuffer) {
                fs.writeFileSync(coverPath, coverBuffer);
                return coverPath;
            }
        }
        catch (e) {
            console.error('Error extracting cover for manga:', manga.name, e);
        }
        finally {
            parser.destroy();
        }
        return null;
    }
    saveCoverToCache(filePath, buffer) {
        const hash = this.generateHash(filePath);
        const cacheDir = this.getCacheDir();
        const coverPath = path.join(cacheDir, `${hash}.png`);
        fs.writeFileSync(coverPath, buffer);
        return coverPath;
    }
}
exports.MangaImageCoverController = MangaImageCoverController;
