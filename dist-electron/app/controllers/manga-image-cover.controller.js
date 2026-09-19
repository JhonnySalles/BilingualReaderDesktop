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
const app_paths_1 = require("../utils/app-paths");
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
        const cacheDir = path.join((0, app_paths_1.getAppCoversDir)(), 'manga');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
        return cacheDir;
    }
    generateHash(filePath) {
        return crypto.createHash('md5').update(filePath).digest('hex');
    }
    async getMangaCover3D(manga) {
        const filePath = manga.path || manga.file;
        if (!filePath || !fs.existsSync(filePath)) {
            return { fullCoverPath: null, frontCoverPath: null, backCoverPath: null, isFullCover: false };
        }
        const hash = this.generateHash(filePath);
        const cacheDir = this.getCacheDir();
        const fullPath = path.join(cacheDir, `${hash}_full.png`);
        const frontPath = path.join(cacheDir, `${hash}_front.png`);
        const backPath = path.join(cacheDir, `${hash}_back.png`);
        if (fs.existsSync(fullPath)) {
            return {
                fullCoverPath: fullPath,
                frontCoverPath: fs.existsSync(frontPath) ? frontPath : fullPath,
                backCoverPath: fs.existsSync(backPath) ? backPath : null,
                isFullCover: true
            };
        }
        const parser = await parse_factory_1.ParseFactory.create(filePath);
        if (!parser) {
            const defaultCover = manga.coverPath && fs.existsSync(manga.coverPath) ? manga.coverPath : null;
            return { fullCoverPath: defaultCover, frontCoverPath: defaultCover, backCoverPath: null, isFullCover: false };
        }
        try {
            if (parser.hasFullCover()) {
                const fullCoverBuffer = parser.getFullCover();
                if (fullCoverBuffer) {
                    fs.writeFileSync(fullPath, fullCoverBuffer);
                    const coverStreams = parser.getCover();
                    if (coverStreams.front)
                        fs.writeFileSync(frontPath, coverStreams.front);
                    if (coverStreams.back)
                        fs.writeFileSync(backPath, coverStreams.back);
                    return {
                        fullCoverPath: fullPath,
                        frontCoverPath: fs.existsSync(frontPath) ? frontPath : fullPath,
                        backCoverPath: fs.existsSync(backPath) ? backPath : null,
                        isFullCover: true
                    };
                }
            }
            const coverStreams = parser.getCover();
            if (coverStreams.front) {
                fs.writeFileSync(frontPath, coverStreams.front);
            }
            if (coverStreams.back) {
                fs.writeFileSync(backPath, coverStreams.back);
            }
            const front = fs.existsSync(frontPath) ? frontPath : (manga.coverPath || null);
            const back = fs.existsSync(backPath) ? backPath : null;
            return {
                fullCoverPath: null,
                frontCoverPath: front,
                backCoverPath: back,
                isFullCover: false
            };
        }
        catch (e) {
            console.error('Error extracting 3D cover for manga:', manga.name, e);
            return {
                fullCoverPath: null,
                frontCoverPath: manga.coverPath || null,
                backCoverPath: null,
                isFullCover: false
            };
        }
        finally {
            parser.destroy();
        }
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
    /** Return existing coverPath if present on disk; otherwise re-extract from source. */
    async ensureCover(manga) {
        if (manga.coverPath && fs.existsSync(manga.coverPath)) {
            return manga.coverPath;
        }
        try {
            return await this.getMangaCoverFile(manga);
        }
        catch (e) {
            console.warn('[MangaImageCover] ensureCover failed', manga.name, e);
            return null;
        }
    }
    saveCoverToCache(filePath, buffer) {
        const hash = this.generateHash(filePath);
        const cacheDir = this.getCacheDir();
        const coverPath = path.join(cacheDir, `${hash}.png`);
        fs.writeFileSync(coverPath, buffer);
        return coverPath;
    }
    /** Remove all cached cover files. Returns count of entries removed. */
    clearCache() {
        const cacheDir = this.getCacheDir();
        if (!fs.existsSync(cacheDir))
            return 0;
        let removed = 0;
        for (const name of fs.readdirSync(cacheDir)) {
            const full = path.join(cacheDir, name);
            try {
                const st = fs.statSync(full);
                if (st.isDirectory()) {
                    fs.rmSync(full, { recursive: true, force: true });
                }
                else {
                    fs.unlinkSync(full);
                }
                removed += 1;
            }
            catch (e) {
                console.warn('[MangaImageCover] clearCache failed', full, e);
            }
        }
        return removed;
    }
}
exports.MangaImageCoverController = MangaImageCoverController;
