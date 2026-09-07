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
exports.MangaReaderSessionService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const electron_1 = require("electron");
const parse_factory_1 = require("../parser/manga/parse-factory");
const parse_util_1 = require("../parser/manga/parse-util");
const subtitle_normalize_1 = require("../../src/app/core/utils/subtitle-normalize");
const CACHE_SLOTS = ['a', 'b', 'c'];
const MAX_SESSIONS_PER_SLOT = 4;
const META_FILE = 'pages.json';
const SUBTITLES_FILE = 'subtitles.json';
class MangaReaderSessionService {
    active = new Map();
    getCacheRoot() {
        return path.join(electron_1.app.getPath('userData'), 'cache', 'manga-pages');
    }
    isPathAllowed(filePath) {
        const root = path.resolve(this.getCacheRoot());
        let candidate = filePath;
        if (/^\/[A-Za-z]:\//.test(candidate)) {
            candidate = candidate.slice(1);
        }
        const resolved = path.resolve(candidate);
        return resolved === root || resolved.startsWith(root + path.sep);
    }
    toLocalPageUrl(filePath) {
        const normalized = path.resolve(filePath).replace(/\\/g, '/');
        return 'local-page:///' + normalized;
    }
    async open(mangaId, mangaPath, title, bookMark, favorite, sender) {
        const opened = await this.openByPath(mangaPath, mangaId, sender);
        return {
            ...opened,
            mangaId,
            title,
            bookMark: Math.min(Math.max(0, bookMark || 0), opened.pageCount),
            favorite: !!favorite
        };
    }
    /**
     * Open/extract any manga archive or folder by path (primary or linked file).
     * mangaId may be 0 for ad-hoc / linked files not in the library.
     */
    async openByPath(filePath, mangaId = 0, sender) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`Arquivo não encontrado: ${filePath}`);
        }
        const hash = this.fileHash(filePath);
        let cacheDir = this.findExistingCache(hash);
        if (!cacheDir || !this.metaHasNames(cacheDir)) {
            if (cacheDir) {
                try {
                    fs.rmSync(cacheDir, { recursive: true, force: true });
                }
                catch { }
            }
            const slot = CACHE_SLOTS[Math.floor(Math.random() * CACHE_SLOTS.length)];
            this.trimSlot(slot);
            cacheDir = path.join(this.getCacheRoot(), slot, hash);
            fs.mkdirSync(cacheDir, { recursive: true });
            await this.extractPages(mangaId, filePath, cacheDir, sender);
        }
        let meta = this.readMeta(cacheDir);
        if (!meta || meta.pageCount < 1 || meta.files.length !== meta.pageCount) {
            fs.rmSync(cacheDir, { recursive: true, force: true });
            const slot = CACHE_SLOTS[Math.floor(Math.random() * CACHE_SLOTS.length)];
            this.trimSlot(slot);
            cacheDir = path.join(this.getCacheRoot(), slot, hash);
            fs.mkdirSync(cacheDir, { recursive: true });
            await this.extractPages(mangaId, filePath, cacheDir, sender);
            meta = this.readMeta(cacheDir);
        }
        const finalMeta = meta;
        const sessionId = crypto.randomBytes(8).toString('hex');
        let subtitles = this.readSubtitles(cacheDir);
        if (!subtitles || subtitles.chapters.length === 0) {
            subtitles = await this.loadSubtitlesFromPath(filePath);
            this.writeSubtitles(cacheDir, subtitles);
        }
        this.active.set(sessionId, {
            sessionId,
            mangaId,
            cacheDir,
            filePath,
            subtitles
        });
        const pages = finalMeta.files.map(f => this.toLocalPageUrl(path.join(cacheDir, f)));
        const pageNames = finalMeta.pageNames?.length === finalMeta.pageCount
            ? finalMeta.pageNames
            : finalMeta.files.map((_, i) => String(i));
        const pagePaths = finalMeta.pagePaths?.length === finalMeta.pageCount
            ? finalMeta.pagePaths
            : finalMeta.files.map(() => '');
        let pageHashes = finalMeta.pageHashes?.length === finalMeta.pageCount
            ? finalMeta.pageHashes
            : [];
        if (pageHashes.length === 0) {
            pageHashes = finalMeta.files.map(f => this.hashFile(path.join(cacheDir, f)));
            try {
                const updated = { ...finalMeta, pageHashes };
                fs.writeFileSync(path.join(cacheDir, META_FILE), JSON.stringify(updated, null, 2), 'utf8');
            }
            catch { }
        }
        return {
            sessionId,
            mangaId,
            title: path.basename(filePath),
            pageCount: finalMeta.pageCount,
            pages,
            pageNames,
            pagePaths,
            pageHashes,
            chapters: finalMeta.chapters || [],
            chaptersPages: finalMeta.chaptersPages || {},
            bookMark: 0,
            favorite: false,
            cacheDir,
            path: filePath,
            subtitles,
            hasSubtitles: subtitles.chapters.length > 0
        };
    }
    getSessionSubtitles(sessionId) {
        return this.active.get(sessionId)?.subtitles ?? null;
    }
    setSessionSubtitles(sessionId, catalog) {
        const session = this.active.get(sessionId);
        if (!session)
            return false;
        session.subtitles = catalog;
        this.writeSubtitles(session.cacheDir, catalog);
        return true;
    }
    async importExternalSubtitles(sessionId, jsonPath) {
        const session = this.active.get(sessionId);
        if (!session)
            throw new Error('Sessão não encontrada');
        if (!fs.existsSync(jsonPath))
            throw new Error('Arquivo não encontrado');
        const raw = fs.readFileSync(jsonPath, 'utf-8');
        const catalog = (0, subtitle_normalize_1.buildSubtitleCatalog)([raw], 'external');
        session.subtitles = catalog;
        this.writeSubtitles(session.cacheDir, catalog);
        return catalog;
    }
    resolvePageAbsolutePath(sessionId, pageIndex) {
        const session = this.active.get(sessionId);
        if (!session)
            return null;
        const meta = this.readMeta(session.cacheDir);
        if (!meta || pageIndex < 0 || pageIndex >= meta.files.length)
            return null;
        const full = path.join(session.cacheDir, meta.files[pageIndex]);
        return fs.existsSync(full) ? full : null;
    }
    /**
     * Lightweight ComicInfo read when cache/meta lacks chaptersPages (old caches).
     */
    async loadChaptersPages(mangaPath) {
        const parser = await parse_factory_1.ParseFactory.create(mangaPath);
        if (!parser)
            return {};
        try {
            if (!parser.isComicInfo?.())
                return {};
            const info = parser.getComicInfo?.() ?? null;
            return parse_util_1.ParseUtil.buildChaptersPagesFromComicInfo(info);
        }
        catch (e) {
            console.warn('[MangaReaderSession] Failed to load ComicInfo chapters', e);
            return {};
        }
        finally {
            try {
                parser.destroy(false);
            }
            catch { }
        }
    }
    /** Folders win; else bookmark keys sorted. */
    resolveChapters(folderChapters, chaptersPages) {
        if (folderChapters.length > 0)
            return folderChapters;
        return Object.keys(chaptersPages)
            .map(Number)
            .filter(n => Number.isFinite(n))
            .sort((a, b) => a - b);
    }
    close(sessionId) {
        return this.active.delete(sessionId);
    }
    metaHasNames(cacheDir) {
        const meta = this.readMeta(cacheDir);
        return !!(meta?.pageNames && meta.pageNames.length === meta.pageCount);
    }
    fileHash(filePath) {
        const stat = fs.statSync(filePath);
        const key = `${filePath}|${stat.size}|${stat.mtimeMs}`;
        return crypto.createHash('md5').update(key).digest('hex');
    }
    findExistingCache(hash) {
        for (const slot of CACHE_SLOTS) {
            const dir = path.join(this.getCacheRoot(), slot, hash);
            const metaPath = path.join(dir, META_FILE);
            if (fs.existsSync(metaPath)) {
                try {
                    const meta = this.readMeta(dir);
                    if (meta && meta.pageCount > 0 && meta.files.length === meta.pageCount) {
                        const allExist = meta.files.every(f => fs.existsSync(path.join(dir, f)));
                        if (allExist)
                            return dir;
                    }
                }
                catch {
                    // ignore and continue
                }
            }
        }
        return null;
    }
    readMeta(cacheDir) {
        const metaPath = path.join(cacheDir, META_FILE);
        if (!fs.existsSync(metaPath))
            return null;
        try {
            return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        }
        catch {
            return null;
        }
    }
    trimSlot(slot) {
        const slotDir = path.join(this.getCacheRoot(), slot);
        if (!fs.existsSync(slotDir)) {
            fs.mkdirSync(slotDir, { recursive: true });
            return;
        }
        const entries = fs.readdirSync(slotDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => {
            const full = path.join(slotDir, d.name);
            const meta = this.readMeta(full);
            let mtime = 0;
            try {
                mtime = fs.statSync(full).mtimeMs;
            }
            catch { }
            return { full, createdAt: meta?.createdAt ?? mtime };
        })
            .sort((a, b) => b.createdAt - a.createdAt);
        while (entries.length >= MAX_SESSIONS_PER_SLOT) {
            const oldest = entries.pop();
            if (!oldest)
                break;
            try {
                fs.rmSync(oldest.full, { recursive: true, force: true });
            }
            catch (e) {
                console.warn('[MangaReaderSession] Failed to trim cache', e);
            }
        }
    }
    async extractPages(mangaId, mangaPath, cacheDir, sender) {
        const parser = await parse_factory_1.ParseFactory.create(mangaPath);
        if (!parser) {
            throw new Error('Não foi possível abrir o arquivo de mangá');
        }
        try {
            const pageCount = parser.numPages();
            if (pageCount < 1) {
                throw new Error('Arquivo sem páginas de imagem');
            }
            const folderChapters = parser.getChapters?.() ?? [];
            let chaptersPages = {};
            try {
                if (parser.isComicInfo?.()) {
                    const info = parser.getComicInfo?.() ?? null;
                    chaptersPages = parse_util_1.ParseUtil.buildChaptersPagesFromComicInfo(info);
                }
            }
            catch (e) {
                console.warn('[MangaReaderSession] ComicInfo chapters failed', e);
            }
            const chapters = this.resolveChapters(folderChapters, chaptersPages);
            const files = [];
            const pageNames = [];
            const pagePaths = [];
            const pageHashes = [];
            for (let i = 0; i < pageCount; i++) {
                const buf = parser.getPage(i);
                if (!buf) {
                    throw new Error(`Falha ao extrair página ${i}`);
                }
                const sourcePath = parser.getPagePath(i) || '';
                const ext = this.resolveExtension(sourcePath, buf);
                const name = `${String(i).padStart(4, '0')}${ext}`;
                fs.writeFileSync(path.join(cacheDir, name), buf);
                files.push(name);
                pageNames.push(parse_util_1.ParseUtil.getNameFromPath(sourcePath) || name);
                pagePaths.push(parse_util_1.ParseUtil.getFolderFromPath(sourcePath));
                pageHashes.push(crypto.createHash('md5').update(buf).digest('hex'));
                if (sender && !sender.isDestroyed()) {
                    sender.webContents.send('manga-reader:extract-progress', {
                        current: i + 1,
                        total: pageCount
                    });
                }
            }
            let subtitles = (0, subtitle_normalize_1.emptySubtitleCatalog)();
            try {
                if (parser.hasSubtitles?.()) {
                    subtitles = (0, subtitle_normalize_1.buildSubtitleCatalog)(parser.getSubtitles() || [], 'embedded');
                }
            }
            catch (e) {
                console.warn('[MangaReaderSession] Failed to load subtitles', e);
            }
            this.writeSubtitles(cacheDir, subtitles);
            const meta = {
                mangaId,
                path: mangaPath,
                pageCount,
                files,
                pageNames,
                pagePaths,
                pageHashes,
                chapters,
                chaptersPages,
                createdAt: Date.now()
            };
            fs.writeFileSync(path.join(cacheDir, META_FILE), JSON.stringify(meta, null, 2), 'utf8');
        }
        finally {
            try {
                parser.destroy(false);
            }
            catch { }
        }
    }
    async loadSubtitlesFromPath(mangaPath) {
        const parser = await parse_factory_1.ParseFactory.create(mangaPath);
        if (!parser)
            return (0, subtitle_normalize_1.emptySubtitleCatalog)();
        try {
            if (!parser.hasSubtitles?.())
                return (0, subtitle_normalize_1.emptySubtitleCatalog)();
            return (0, subtitle_normalize_1.buildSubtitleCatalog)(parser.getSubtitles() || [], 'embedded');
        }
        catch (e) {
            console.warn('[MangaReaderSession] loadSubtitlesFromPath failed', e);
            return (0, subtitle_normalize_1.emptySubtitleCatalog)();
        }
        finally {
            try {
                parser.destroy(false);
            }
            catch { }
        }
    }
    readSubtitles(cacheDir) {
        const p = path.join(cacheDir, SUBTITLES_FILE);
        if (!fs.existsSync(p))
            return null;
        try {
            return JSON.parse(fs.readFileSync(p, 'utf8'));
        }
        catch {
            return null;
        }
    }
    writeSubtitles(cacheDir, catalog) {
        try {
            fs.writeFileSync(path.join(cacheDir, SUBTITLES_FILE), JSON.stringify(catalog, null, 2), 'utf8');
        }
        catch (e) {
            console.warn('[MangaReaderSession] Failed to write subtitles cache', e);
        }
    }
    hashFile(filePath) {
        try {
            return crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
        }
        catch {
            return '';
        }
    }
    resolveExtension(sourcePath, buf) {
        const fromPath = path.extname(sourcePath).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(fromPath)) {
            return fromPath === '.jpeg' ? '.jpg' : fromPath;
        }
        if (buf.length >= 8) {
            if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
                return '.png';
            if (buf[0] === 0xff && buf[1] === 0xd8)
                return '.jpg';
            if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46)
                return '.gif';
            if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46)
                return '.webp';
        }
        return '.jpg';
    }
}
exports.MangaReaderSessionService = MangaReaderSessionService;
