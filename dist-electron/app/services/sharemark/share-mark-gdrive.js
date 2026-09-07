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
exports.ShareMarkGDriveService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const electron_1 = require("electron");
const googleapis_1 = require("googleapis");
const share_mark_base_1 = require("./share-mark-base");
const google_auth_service_1 = require("../google-auth.service");
const sharemark_enum_1 = require("../../../src/app/core/models/enums/sharemark.enum");
const telemetry_1 = require("../../utils/telemetry");
const share_item_mapper_1 = require("./share-item.mapper");
const FOLDER = 'BilingualReader';
const MANGA_FILE = 'MangaMarks';
const BOOK_FILE = 'BookMarks';
const EXT = '.json';
const MANGA_FILE_FULL = MANGA_FILE + EXT;
const BOOK_FILE_FULL = BOOK_FILE + EXT;
class ShareMarkGDriveService extends share_mark_base_1.ShareMarkBase {
    notConnectErrorType = sharemark_enum_1.ShareMarkType.NOT_CONNECT_DRIVE;
    idFolder = '';
    idManga = '';
    idBook = '';
    drive = null;
    cacheDir() {
        const base = electron_1.app ? electron_1.app.getPath('userData') : process.cwd();
        const dir = path.join(base, 'sharemark-cache');
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        return dir;
    }
    cachePath(name) {
        return path.join(this.cacheDir(), name);
    }
    async initialize() {
        try {
            if (!google_auth_service_1.GoogleAuthService.instance.isSignedIn()) {
                return sharemark_enum_1.ShareMarkType.NOT_SIGN_IN;
            }
            const auth = await google_auth_service_1.GoogleAuthService.instance.getAuthenticatedClient();
            this.drive = googleapis_1.google.drive({ version: 'v3', auth: auth });
            return await this.getShareFiles();
        }
        catch (e) {
            console.error('[ShareMarkGDrive] initialize:', e);
            telemetry_1.Telemetry.recordException(e, '[ShareMarkGDrive] initialize');
            if (e?.message === 'NOT_SIGN_IN')
                return sharemark_enum_1.ShareMarkType.NOT_SIGN_IN;
            return sharemark_enum_1.ShareMarkType.NOT_CONNECT_DRIVE;
        }
    }
    async getShareFiles() {
        if (!this.drive)
            return sharemark_enum_1.ShareMarkType.NOT_SIGN_IN;
        try {
            this.idFolder = '';
            this.idManga = '';
            this.idBook = '';
            let mangaBackups = 0;
            let bookBackups = 0;
            const limit = 3;
            let pageToken;
            do {
                const result = await this.drive.files.list({
                    q: `(name contains '${MANGA_FILE}' or name contains '${BOOK_FILE}' or name contains '${FOLDER}') and ` +
                        `(mimeType='application/json' or mimeType='application/vnd.google-apps.folder') and trashed=false`,
                    spaces: 'drive',
                    fields: 'nextPageToken, files(id, name)',
                    orderBy: 'name desc',
                    pageToken
                });
                for (const file of result.data.files || []) {
                    const name = file.name || '';
                    const id = file.id || '';
                    if (name === MANGA_FILE_FULL)
                        this.idManga = id;
                    else if (name === BOOK_FILE_FULL)
                        this.idBook = id;
                    else if (name === FOLDER)
                        this.idFolder = id;
                    else {
                        if (name.includes(MANGA_FILE)) {
                            mangaBackups++;
                            if (mangaBackups > limit)
                                await this.deleteFile(id);
                        }
                        if (name.includes(BOOK_FILE)) {
                            bookBackups++;
                            if (bookBackups > limit)
                                await this.deleteFile(id);
                        }
                    }
                }
                pageToken = result.data.nextPageToken || undefined;
            } while (pageToken);
            if (!this.idBook || !this.idManga) {
                await this.createShareFiles();
            }
            await this.downloadToCache(this.idManga, MANGA_FILE_FULL);
            await this.downloadToCache(this.idBook, BOOK_FILE_FULL);
            return sharemark_enum_1.ShareMarkType.SUCCESS;
        }
        catch (e) {
            console.error('[ShareMarkGDrive] getShareFiles:', e);
            telemetry_1.Telemetry.recordException(e, '[ShareMarkGDrive] getShareFiles');
            if (e?.code === 'ENOTFOUND' || e?.code === 'ECONNREFUSED') {
                return sharemark_enum_1.ShareMarkType.ERROR_NETWORK;
            }
            return sharemark_enum_1.ShareMarkType.ERROR_DOWNLOAD;
        }
    }
    async deleteFile(id) {
        try {
            await this.drive.files.delete({ fileId: id });
        }
        catch (e) {
            console.warn('[ShareMarkGDrive] delete backup failed', e);
        }
    }
    async createShareFiles() {
        if (!this.drive)
            return;
        if (!this.idFolder) {
            const folder = await this.drive.files.create({
                requestBody: {
                    name: FOLDER,
                    mimeType: 'application/vnd.google-apps.folder'
                },
                fields: 'id'
            });
            this.idFolder = folder.data.id || '';
        }
        if (!this.idManga) {
            this.idManga = await this.uploadNew(MANGA_FILE_FULL, this.writeShareFile({ origin: '', type: 'MANGA', marks: [] }, MANGA_FILE_FULL));
        }
        if (!this.idBook) {
            this.idBook = await this.uploadNew(BOOK_FILE_FULL, this.writeShareFile({ origin: '', type: 'BOOK', marks: [] }, BOOK_FILE_FULL));
        }
    }
    writeShareFile(share, name) {
        share.lastAlteration = new Date().toISOString();
        share.origin = this.getDeviceName();
        const filePath = this.cachePath(name);
        fs.writeFileSync(filePath, JSON.stringify((0, share_item_mapper_1.serializeShareMarkFile)(share), null, 2), 'utf-8');
        return filePath;
    }
    async uploadNew(name, filePath) {
        const res = await this.drive.files.create({
            requestBody: {
                name,
                parents: [this.idFolder]
            },
            media: {
                mimeType: 'application/json',
                body: fs.createReadStream(filePath)
            },
            fields: 'id'
        });
        return res.data.id || '';
    }
    async downloadToCache(fileId, name) {
        if (!fileId || !this.drive)
            return;
        const res = await this.drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
        const dest = this.cachePath(name);
        await new Promise((resolve, reject) => {
            const ws = fs.createWriteStream(dest);
            res.data.pipe(ws);
            ws.on('finish', () => resolve());
            ws.on('error', reject);
        });
    }
    readCached(name, type) {
        const filePath = this.cachePath(name);
        if (!fs.existsSync(filePath)) {
            return { origin: '', type, marks: [] };
        }
        try {
            const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const parsed = (0, share_item_mapper_1.parseShareMarkFile)(raw);
            if (!parsed.marks)
                parsed.marks = [];
            if (!parsed.type)
                parsed.type = type;
            return parsed;
        }
        catch {
            return { origin: '', type, marks: [] };
        }
    }
    async saveShareFile(idFile, nameWithoutExt, filePath) {
        if (!this.drive)
            return sharemark_enum_1.ShareMarkType.ERROR_UPLOAD;
        try {
            const stamp = new Date()
                .toISOString()
                .replace(/[-:TZ.]/g, '')
                .slice(0, 14);
            // Rename old file as backup
            await this.drive.files.update({
                fileId: idFile,
                requestBody: { name: `${nameWithoutExt}_${stamp}${EXT}` }
            });
            await this.uploadNew(nameWithoutExt + EXT, filePath);
            return sharemark_enum_1.ShareMarkType.SUCCESS;
        }
        catch (e) {
            console.error('[ShareMarkGDrive] upload:', e);
            telemetry_1.Telemetry.recordException(e, '[ShareMarkGDrive] upload');
            return sharemark_enum_1.ShareMarkType.ERROR_UPLOAD;
        }
    }
    async processManga(onUpdate) {
        const sync = new Date();
        const alteration = new Date().toISOString();
        const share = this.readCached(MANGA_FILE_FULL, 'MANGA');
        if (!share.marks)
            share.marks = [];
        const lastSync = share.marks.length === 0
            ? new Date(share_mark_base_1.ShareMarkBase.INITIAL_SYNC_DATE_TIME)
            : this.getLastSync('MANGA');
        const list = share.marks.filter((m) => {
            const s = (0, share_item_mapper_1.parseFlexibleDate)(m.sync);
            return s && s > lastSync;
        });
        const locals = this.storage.mangaRepository.listSync(lastSync);
        for (const manga of locals) {
            const existing = share.marks.find((m) => m.file === manga.name);
            if (existing) {
                if (this.compareManga(existing, manga)) {
                    manga.lastAlteration = alteration;
                    this.storage.saveManga(manga);
                    onUpdate(manga);
                }
            }
            else if (!share.marks.some((s) => s.file === manga.name)) {
                share.marks.push(this.createMangaShareItem(manga));
            }
        }
        for (const item of list.filter((i) => !i.processed)) {
            const manga = this.storage.mangaRepository.getByFileName(item.file);
            if (manga && this.compareManga(item, manga)) {
                manga.lastAlteration = alteration;
                this.storage.saveManga(manga);
                onUpdate(manga);
            }
        }
        for (const item of list) {
            const manga = this.storage.mangaRepository.getByFileName(item.file);
            if (manga)
                this.applyMangaHistoryAndAnnotations(item, manga);
        }
        const isUpdate = share.marks.some((m) => m.alter);
        let result;
        if (isUpdate) {
            for (const m of share.marks.filter((i) => i.alter)) {
                m.sync = (0, share_item_mapper_1.formatShareMarkDate)(sync);
            }
            const filePath = this.writeShareFile(share, MANGA_FILE_FULL);
            result = await this.saveShareFile(this.idManga, MANGA_FILE, filePath);
            // Refresh canonical file id after rename+upload
            await this.getShareFiles();
        }
        else if (list.length > 0) {
            result = sharemark_enum_1.ShareMarkType.SUCCESS;
        }
        else {
            result = sharemark_enum_1.ShareMarkType.NOT_ALTERATION;
        }
        sharemark_enum_1.ShareMarkStatus.send = list.filter((i) => i.alter).length;
        sharemark_enum_1.ShareMarkStatus.receive = list.filter((i) => i.received).length;
        // Also count newly added alters not in list
        const alterAll = share.marks.filter((m) => m.alter).length;
        if (alterAll > sharemark_enum_1.ShareMarkStatus.send)
            sharemark_enum_1.ShareMarkStatus.send = alterAll;
        this.setLastSync('MANGA', sync);
        return result;
    }
    async processBook(onUpdate) {
        const sync = new Date();
        const alteration = new Date().toISOString();
        const share = this.readCached(BOOK_FILE_FULL, 'BOOK');
        if (!share.marks)
            share.marks = [];
        const lastSync = this.getLastSync('BOOK');
        const list = share.marks.filter((m) => {
            const s = (0, share_item_mapper_1.parseFlexibleDate)(m.sync);
            return s && s > lastSync;
        });
        const locals = this.storage.bookRepository.listSync(lastSync);
        for (const book of locals) {
            const existing = list.find((m) => m.file === book.name);
            if (existing) {
                if (this.compareBook(existing, book)) {
                    book.lastAlteration = alteration;
                    this.storage.saveBook(book);
                    onUpdate(book);
                }
            }
            else if (!share.marks.some((s) => s.file === book.name)) {
                share.marks.push(await this.createBookShareItem(book));
            }
        }
        for (const item of list.filter((i) => !i.processed)) {
            const book = this.storage.bookRepository.getByFileName(item.file);
            if (book && this.compareBook(item, book)) {
                book.lastAlteration = alteration;
                this.storage.saveBook(book);
                onUpdate(book);
            }
        }
        for (const item of list) {
            const book = this.storage.bookRepository.getByFileName(item.file);
            if (book)
                this.applyBookHistoryAndAnnotations(item, book);
        }
        const isUpdate = share.marks.some((m) => m.alter);
        let result;
        if (isUpdate) {
            for (const m of share.marks.filter((i) => i.alter)) {
                m.sync = (0, share_item_mapper_1.formatShareMarkDate)(sync);
            }
            const filePath = this.writeShareFile(share, BOOK_FILE_FULL);
            result = await this.saveShareFile(this.idBook, BOOK_FILE, filePath);
            await this.getShareFiles();
        }
        else {
            result = list.length > 0 ? sharemark_enum_1.ShareMarkType.SUCCESS : sharemark_enum_1.ShareMarkType.NOT_ALTERATION;
        }
        sharemark_enum_1.ShareMarkStatus.send = Math.max(list.filter((i) => i.alter).length, share.marks.filter((m) => m.alter).length);
        sharemark_enum_1.ShareMarkStatus.receive = list.filter((i) => i.received).length;
        this.setLastSync('BOOK', sync);
        return result;
    }
}
exports.ShareMarkGDriveService = ShareMarkGDriveService;
