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
const CACHE_SLOTS = ['a', 'b', 'c'];
const MAX_SESSIONS_PER_SLOT = 4;
const META_FILE = 'pages.json';
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
        return `local-page://manga/?p=${encodeURIComponent(normalized)}`;
    }
    async open(mangaId, mangaPath, title, bookMark, favorite, sender) {
        if (!fs.existsSync(mangaPath)) {
            throw new Error(`Arquivo não encontrado: ${mangaPath}`);
        }
        const hash = this.fileHash(mangaPath);
        let cacheDir = this.findExistingCache(hash);
        if (!cacheDir) {
            const slot = CACHE_SLOTS[Math.floor(Math.random() * CACHE_SLOTS.length)];
            this.trimSlot(slot);
            cacheDir = path.join(this.getCacheRoot(), slot, hash);
            fs.mkdirSync(cacheDir, { recursive: true });
            await this.extractPages(mangaId, mangaPath, cacheDir, sender);
        }
        const meta = this.readMeta(cacheDir);
        if (!meta || meta.pageCount < 1 || meta.files.length !== meta.pageCount) {
            // corrupt cache — rebuild
            fs.rmSync(cacheDir, { recursive: true, force: true });
            const slot = CACHE_SLOTS[Math.floor(Math.random() * CACHE_SLOTS.length)];
            this.trimSlot(slot);
            cacheDir = path.join(this.getCacheRoot(), slot, hash);
            fs.mkdirSync(cacheDir, { recursive: true });
            await this.extractPages(mangaId, mangaPath, cacheDir, sender);
        }
        const finalMeta = this.readMeta(cacheDir);
        const sessionId = crypto.randomBytes(8).toString('hex');
        this.active.set(sessionId, { sessionId, mangaId, cacheDir });
        const pages = finalMeta.files.map(f => this.toLocalPageUrl(path.join(cacheDir, f)));
        return {
            sessionId,
            mangaId,
            title,
            pageCount: finalMeta.pageCount,
            pages,
            chapters: finalMeta.chapters || [],
            bookMark: Math.min(Math.max(0, bookMark || 0), Math.max(0, finalMeta.pageCount - 1)),
            favorite: !!favorite,
            cacheDir
        };
    }
    close(sessionId) {
        return this.active.delete(sessionId);
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
            const chapters = parser.getChapters?.() ?? [];
            const files = [];
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
                if (sender && !sender.isDestroyed()) {
                    sender.webContents.send('manga-reader:extract-progress', {
                        current: i + 1,
                        total: pageCount
                    });
                }
            }
            const meta = {
                mangaId,
                path: mangaPath,
                pageCount,
                files,
                chapters,
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
