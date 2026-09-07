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
exports.ShareMarkBase = void 0;
const os = __importStar(require("os"));
const settings_service_1 = require("../settings.service");
const google_auth_service_1 = require("../google-auth.service");
const share_item_model_1 = require("../../../src/app/core/models/entities/share-item.model");
const sharemark_enum_1 = require("../../../src/app/core/models/enums/sharemark.enum");
const telemetry_1 = require("../../utils/telemetry");
const share_item_mapper_1 = require("./share-item.mapper");
const share_mark_compare_1 = require("../../../src/app/core/utils/share-mark-compare");
const share_annotation_reconcile_1 = require("../../../src/app/core/utils/share-annotation-reconcile");
class ShareMarkBase {
    storage;
    getWindow;
    static INITIAL_SYNC_DATE_TIME = share_item_model_1.SHARE_MARK_INITIAL_SYNC;
    static inSync = false;
    constructor(storage, getWindow) {
        this.storage = storage;
        this.getWindow = getWindow;
    }
    emitProgress(phase, type) {
        const win = this.getWindow();
        const payload = {
            phase,
            send: sharemark_enum_1.ShareMarkStatus.send,
            receive: sharemark_enum_1.ShareMarkStatus.receive,
            type
        };
        win?.webContents.send('sharemark:progress', payload);
    }
    isOnline() {
        try {
            const nets = os.networkInterfaces();
            for (const list of Object.values(nets)) {
                if (!list)
                    continue;
                for (const n of list) {
                    if (!n.internal && (n.family === 'IPv4' || n.family === 4)) {
                        return true;
                    }
                }
            }
        }
        catch {
            return true;
        }
        return true;
    }
    getDeviceName() {
        return os.hostname() || `${os.platform()} ${os.arch()}`;
    }
    getLastSync(type) {
        const settings = settings_service_1.SettingsService.instance;
        const key = type === 'MANGA' ? 'shareMarkLastSyncManga' : 'shareMarkLastSyncBook';
        const raw = settings.get(key, ShareMarkBase.INITIAL_SYNC_DATE_TIME);
        return (0, share_item_mapper_1.parseFlexibleDate)(raw) || new Date(ShareMarkBase.INITIAL_SYNC_DATE_TIME);
    }
    setLastSync(type, sync) {
        const settings = settings_service_1.SettingsService.instance;
        const key = type === 'MANGA' ? 'shareMarkLastSyncManga' : 'shareMarkLastSyncBook';
        const next = new Date(sync.getTime() + 1000);
        settings.set(key, (0, share_item_mapper_1.formatShareMarkDate)(next));
    }
    static clearLastSync(type) {
        const settings = settings_service_1.SettingsService.instance;
        if (type === 'MANGA') {
            settings.remove('shareMarkLastSyncManga');
        }
        else {
            settings.remove('shareMarkLastSyncBook');
        }
    }
    static getInstance(storage, getWindow) {
        const cloud = settings_service_1.SettingsService.instance.get('shareMarkCloud', sharemark_enum_1.ShareMarkCloud.GOOGLE_DRIVE);
        // Lazy require to avoid circular imports
        if (cloud === sharemark_enum_1.ShareMarkCloud.FIRESTORE) {
            const { ShareMarkFirebaseService } = require('./share-mark-firebase');
            return new ShareMarkFirebaseService(storage, getWindow);
        }
        const { ShareMarkGDriveService } = require('./share-mark-gdrive');
        return new ShareMarkGDriveService(storage, getWindow);
    }
    async mangaShareMark(onUpdate) {
        return this.runSync('MANGA', () => this.processManga(onUpdate));
    }
    async bookShareMark(onUpdate) {
        return this.runSync('BOOK', () => this.processBook(onUpdate));
    }
    async runSync(type, process) {
        if (ShareMarkBase.inSync) {
            return sharemark_enum_1.ShareMarkType.SYNC_IN_PROGRESS;
        }
        sharemark_enum_1.ShareMarkStatus.clear();
        if (!this.isOnline()) {
            return sharemark_enum_1.ShareMarkType.ERROR_NETWORK;
        }
        if (!google_auth_service_1.GoogleAuthService.instance.isSignedIn()) {
            return sharemark_enum_1.ShareMarkType.NOT_SIGN_IN;
        }
        ShareMarkBase.inSync = true;
        this.emitProgress('initialize', type);
        try {
            const access = await this.initialize();
            if (access !== sharemark_enum_1.ShareMarkType.SUCCESS) {
                return access;
            }
            this.emitProgress('syncing', type);
            const result = await process();
            this.emitProgress('done', type);
            return result;
        }
        catch (e) {
            telemetry_1.Telemetry.recordException(e, '[ShareMark] sync error');
            return this.notConnectErrorType;
        }
        finally {
            ShareMarkBase.inSync = false;
        }
    }
    /** @returns true if cloud data was applied to local entity */
    compareManga(item, manga) {
        const mangaAccessDate = manga.lastAccess ? (0, share_item_mapper_1.parseFlexibleDate)(manga.lastAccess) : null;
        const mangaAlterationDate = manga.lastAlteration ? (0, share_item_mapper_1.parseFlexibleDate)(manga.lastAlteration) : null;
        const syncDate = (0, share_item_mapper_1.parseFlexibleDate)(item.sync) || new Date(0);
        const itemAccessDate = (0, share_item_mapper_1.parseFlexibleDate)(item.lastAccess) || new Date(0);
        if ((!mangaAccessDate && !mangaAlterationDate) ||
            (mangaAlterationDate && mangaAlterationDate < syncDate) ||
            (mangaAccessDate && itemAccessDate > mangaAccessDate)) {
            manga.bookMark =
                item.completed || item.bookMark >= (item.pages || manga.pages || 1)
                    ? Math.max(1, manga.pages || 1)
                    : Math.min(Math.max(0, item.bookMark), Math.max(1, manga.pages || 1));
            manga.lastAccess = item.lastAccess;
            manga.favorite = item.favorite;
            manga.completed = item.completed || manga.bookMark >= (manga.pages || 1);
            item.processed = true;
            item.received = true;
            return true;
        }
        if (!mangaAccessDate) {
            this.mergeManga(item, manga);
        }
        else {
            const diff = itemAccessDate.getTime() - mangaAccessDate.getTime();
            if (diff > 5000 || diff < -5000) {
                this.mergeManga(item, manga);
            }
        }
        return false;
    }
    compareBook(item, book) {
        const bookAccessDate = book.lastAccess ? (0, share_item_mapper_1.parseFlexibleDate)(book.lastAccess) : null;
        const bookAlterationDate = book.lastAlteration ? (0, share_item_mapper_1.parseFlexibleDate)(book.lastAlteration) : null;
        const syncDate = (0, share_item_mapper_1.parseFlexibleDate)(item.sync) || new Date(0);
        const itemAccessDate = (0, share_item_mapper_1.parseFlexibleDate)(item.lastAccess) || new Date(0);
        if ((!bookAccessDate && !bookAlterationDate) ||
            (bookAlterationDate && bookAlterationDate < syncDate) ||
            (bookAccessDate && itemAccessDate > bookAccessDate)) {
            if ((book.pages ?? 1) <= 1 && item.pages > 1) {
                book.bookMark = item.bookMark;
                book.pages = item.pages;
            }
            else if (item.completed || item.bookMark >= item.pages) {
                book.bookMark = book.pages;
            }
            else {
                book.bookMark = (0, share_mark_compare_1.scaleBookBookmarkFromCloud)(book, item);
            }
            book.completed = item.completed || book.bookMark >= (book.pages || 1);
            book.lastAccess = item.lastAccess;
            book.favorite = item.favorite;
            item.processed = true;
            item.received = true;
            return true;
        }
        if (!bookAccessDate) {
            this.mergeBook(item, book);
        }
        else {
            const diff = itemAccessDate.getTime() - bookAccessDate.getTime();
            if (diff > 5000 || diff < -5000) {
                this.mergeBook(item, book);
            }
        }
        return false;
    }
    mergeManga(item, manga) {
        item.bookMark = manga.bookMark;
        item.pages = manga.pages;
        item.completed = manga.completed;
        item.lastAccess = manga.lastAccess || ShareMarkBase.INITIAL_SYNC_DATE_TIME;
        item.favorite = manga.favorite;
        item.alter = true;
        item.processed = true;
    }
    mergeBook(item, book) {
        item.bookMark = book.bookMark;
        item.pages = book.pages;
        item.completed = book.completed;
        item.lastAccess = book.lastAccess || ShareMarkBase.INITIAL_SYNC_DATE_TIME;
        item.favorite = book.favorite;
        item.alter = true;
        item.processed = true;
    }
    applyMangaHistoryAndAnnotations(item, manga) {
        if (!manga.id)
            return;
        const fkLibrary = manga.fkLibrary ?? 0;
        if (item.history) {
            const local = this.storage.historyRepository.listByReference('MANGA', manga.id);
            const localStarts = new Set(local.map((h) => ((0, share_item_mapper_1.parseFlexibleDate)(h.date_time_start)?.getTime() ?? 0)));
            for (const shared of Object.values(item.history)) {
                const start = (0, share_item_mapper_1.parseFlexibleDate)(shared.start);
                if (!start || localStarts.has(start.getTime()))
                    continue;
                this.storage.historyRepository.insertSharedSession({
                    fkLibrary,
                    fkReference: manga.id,
                    type: 'MANGA',
                    pageStart: shared.pageStart,
                    pageEnd: shared.pageEnd,
                    pages: shared.pages,
                    completed: shared.completed,
                    volume: shared.volume,
                    chaptersRead: shared.chaptersRead,
                    dateTimeStart: shared.start,
                    dateTimeEnd: shared.end,
                    secondsRead: shared.secondsRead,
                    averageTimeByPage: shared.averageTimeByPage,
                    useTTS: shared.useTTS
                });
            }
        }
        if (item.annotation) {
            const annotations = this.storage.mangaAnnotationRepository.listByManga(manga.id);
            for (const shared of Object.values(item.annotation)) {
                const created = (0, share_item_mapper_1.parseFlexibleDate)(shared.created);
                const existing = annotations.find((a) => {
                    const c = (0, share_item_mapper_1.parseFlexibleDate)(a.dateCreate);
                    return c && created && c.getTime() === created.getTime();
                });
                if (existing) {
                    existing.chapter = shared.chapter;
                    existing.folder = shared.text;
                    existing.page = shared.page;
                    existing.pages = shared.pages;
                    existing.note = shared.annotation;
                    this.storage.mangaAnnotationRepository.save(existing);
                }
                else {
                    this.storage.mangaAnnotationRepository.save({
                        fkManga: manga.id,
                        page: shared.page,
                        pages: shared.pages,
                        markType: shared.type || 'PageMark',
                        chapter: shared.chapter,
                        folder: shared.text,
                        note: shared.annotation,
                        dateCreate: shared.created
                    });
                }
            }
        }
    }
    applyBookHistoryAndAnnotations(item, book) {
        if (!book.id)
            return;
        const fkLibrary = book.fkLibrary ?? 0;
        if (item.history) {
            const local = this.storage.historyRepository.listByReference('BOOK', book.id);
            const localStarts = new Set(local.map((h) => ((0, share_item_mapper_1.parseFlexibleDate)(h.date_time_start)?.getTime() ?? 0)));
            for (const shared of Object.values(item.history)) {
                const start = (0, share_item_mapper_1.parseFlexibleDate)(shared.start);
                if (!start || localStarts.has(start.getTime()))
                    continue;
                this.storage.historyRepository.insertSharedSession({
                    fkLibrary,
                    fkReference: book.id,
                    type: 'BOOK',
                    pageStart: shared.pageStart,
                    pageEnd: shared.pageEnd,
                    pages: shared.pages,
                    completed: shared.completed,
                    volume: shared.volume,
                    chaptersRead: shared.chaptersRead,
                    dateTimeStart: shared.start,
                    dateTimeEnd: shared.end,
                    secondsRead: shared.secondsRead,
                    averageTimeByPage: shared.averageTimeByPage,
                    useTTS: shared.useTTS
                });
            }
        }
        if (item.annotation) {
            const annotations = this.storage.bookAnnotationRepository.listByBook(book.id);
            const localPages = Math.max(1, book.pages ?? 1);
            for (const shared of Object.values(item.annotation)) {
                const created = (0, share_item_mapper_1.parseFlexibleDate)(shared.created);
                const existing = annotations.find((a) => {
                    const c = (0, share_item_mapper_1.parseFlexibleDate)(a.dateCreate);
                    return c && created && c.getTime() === created.getTime();
                });
                const scaledPage = (0, share_annotation_reconcile_1.scaleAnnotationPageFromCloud)(shared.page, shared.pages || localPages, localPages);
                const cfi = (shared.cfiRange || '').trim();
                if (existing) {
                    existing.text = shared.text;
                    existing.page = scaledPage;
                    existing.pages = localPages;
                    existing.fontSize = shared.fontSize;
                    existing.note = shared.annotation;
                    existing.range = (0, share_item_mapper_1.parseRangeString)(shared.range);
                    existing.favorite = shared.favorite;
                    existing.color = shared.color || existing.color;
                    if (cfi) {
                        existing.cfiRange = cfi;
                    }
                    this.storage.bookAnnotationRepository.save(existing);
                }
                else {
                    this.storage.bookAnnotationRepository.save({
                        fkBook: book.id,
                        page: scaledPage,
                        pages: localPages,
                        fontSize: shared.fontSize,
                        markType: shared.type || 'Annotation',
                        chapterNumber: shared.chapterNumber,
                        chapter: shared.chapter,
                        text: shared.text,
                        range: (0, share_item_mapper_1.parseRangeString)(shared.range),
                        note: shared.annotation,
                        favorite: shared.favorite,
                        color: shared.color || 'Yellow',
                        dateCreate: shared.created,
                        cfiRange: cfi || undefined
                    });
                }
            }
        }
    }
    createMangaShareItem(manga) {
        const histories = manga.id
            ? this.storage.historyRepository.listByReference('MANGA', manga.id)
            : [];
        const annotations = manga.id
            ? this.storage.mangaAnnotationRepository.listByManga(manga.id)
            : [];
        return (0, share_item_mapper_1.buildShareItemFromManga)(manga, histories, annotations);
    }
    async createBookShareItem(book) {
        const histories = book.id
            ? this.storage.historyRepository.listByReference('BOOK', book.id)
            : [];
        const annotations = book.id
            ? this.storage.bookAnnotationRepository.listByBook(book.id)
            : [];
        return (0, share_item_mapper_1.buildShareItemFromBook)(book, histories, annotations);
    }
    refreshMangaItem(item, manga) {
        if (!manga.id)
            return;
        (0, share_item_mapper_1.refreshShareItemHistory)(item, this.storage.historyRepository.listByReference('MANGA', manga.id));
        (0, share_item_mapper_1.refreshShareItemMangaAnnotations)(item, this.storage.mangaAnnotationRepository.listByManga(manga.id));
        item.id = manga.id;
        item.idLibrary = manga.fkLibrary;
    }
    async refreshBookItem(item, book) {
        if (!book.id)
            return;
        (0, share_item_mapper_1.refreshShareItemHistory)(item, this.storage.historyRepository.listByReference('BOOK', book.id));
        await (0, share_item_mapper_1.refreshShareItemBookAnnotations)(item, this.storage.bookAnnotationRepository.listByBook(book.id), book);
        item.id = book.id;
        item.idLibrary = book.fkLibrary;
    }
}
exports.ShareMarkBase = ShareMarkBase;
