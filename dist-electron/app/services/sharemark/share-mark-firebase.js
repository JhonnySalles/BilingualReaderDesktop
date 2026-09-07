"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShareMarkFirebaseService = void 0;
const share_mark_base_1 = require("./share-mark-base");
const google_auth_service_1 = require("../google-auth.service");
const secrets_1 = require("../../utils/secrets");
const sharemark_enum_1 = require("../../../src/app/core/models/enums/sharemark.enum");
const share_item_mapper_1 = require("./share-item.mapper");
const share_item_model_1 = require("../../../src/app/core/models/entities/share-item.model");
class ShareMarkFirebaseService extends share_mark_base_1.ShareMarkBase {
    notConnectErrorType = sharemark_enum_1.ShareMarkType.NOT_CONNECT_FIREBASE;
    userPrefix = '';
    idToken = null;
    projectId = '';
    async initialize() {
        try {
            if (!google_auth_service_1.GoogleAuthService.instance.isSignedIn()) {
                return sharemark_enum_1.ShareMarkType.NOT_SIGN_IN;
            }
            const email = google_auth_service_1.GoogleAuthService.instance.getEmail();
            if (!email)
                return sharemark_enum_1.ShareMarkType.ERROR;
            this.projectId = secrets_1.Secrets.instance.getFirebaseProjectId();
            if (!this.projectId || !secrets_1.Secrets.instance.getFirebaseApiKey()) {
                console.error('[ShareMarkFirebase] FIREBASE_PROJECT_ID / FIREBASE_API_KEY missing');
                return sharemark_enum_1.ShareMarkType.NOT_CONNECT_FIREBASE;
            }
            this.userPrefix = email.substring(0, email.lastIndexOf('@'));
            this.idToken = await google_auth_service_1.GoogleAuthService.instance.getFirebaseIdToken();
            if (!this.idToken) {
                // Try refreshing Google token then Firebase again
                await google_auth_service_1.GoogleAuthService.instance.getAuthenticatedClient();
                this.idToken = await google_auth_service_1.GoogleAuthService.instance.getFirebaseIdToken();
            }
            if (!this.idToken)
                return sharemark_enum_1.ShareMarkType.NOT_CONNECT_FIREBASE;
            return sharemark_enum_1.ShareMarkType.SUCCESS;
        }
        catch (e) {
            console.error('[ShareMarkFirebase] initialize:', e);
            return sharemark_enum_1.ShareMarkType.NOT_CONNECT_FIREBASE;
        }
    }
    collectionId(kind) {
        return `bilingualreader_${this.userPrefix}_${kind}`;
    }
    baseUrl(kind) {
        return `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents/${this.collectionId(kind)}`;
    }
    async firestoreFetch(url, init) {
        const headers = {
            Authorization: `Bearer ${this.idToken}`,
            'Content-Type': 'application/json',
            ...init?.headers
        };
        return fetch(url, { ...init, headers });
    }
    fromFirestoreValue(value) {
        if (value == null)
            return null;
        if ('stringValue' in value)
            return value.stringValue;
        if ('integerValue' in value)
            return Number(value.integerValue);
        if ('doubleValue' in value)
            return Number(value.doubleValue);
        if ('booleanValue' in value)
            return Boolean(value.booleanValue);
        if ('timestampValue' in value)
            return value.timestampValue;
        if ('nullValue' in value)
            return null;
        if ('mapValue' in value) {
            const fields = value.mapValue?.fields || {};
            const obj = {};
            for (const [k, v] of Object.entries(fields)) {
                obj[k] = this.fromFirestoreValue(v);
            }
            return obj;
        }
        if ('arrayValue' in value) {
            return (value.arrayValue?.values || []).map((v) => this.fromFirestoreValue(v));
        }
        return null;
    }
    docToObject(doc) {
        const fields = doc?.fields || {};
        const obj = {};
        for (const [k, v] of Object.entries(fields)) {
            obj[k] = this.fromFirestoreValue(v);
        }
        return obj;
    }
    toFirestoreValue(value) {
        if (value === null || value === undefined)
            return { nullValue: null };
        if (typeof value === 'string')
            return { stringValue: value };
        if (typeof value === 'boolean')
            return { booleanValue: value };
        if (typeof value === 'number') {
            if (Number.isInteger(value))
                return { integerValue: String(value) };
            return { doubleValue: value };
        }
        if (typeof value === 'object' && value !== null && 'seconds' in value && 'nanos' in value) {
            const ts = value;
            const iso = new Date(ts.seconds * 1000 + Math.floor(ts.nanos / 1e6)).toISOString();
            return { timestampValue: iso };
        }
        if (Array.isArray(value)) {
            return { arrayValue: { values: value.map((v) => this.toFirestoreValue(v)) } };
        }
        if (typeof value === 'object') {
            const fields = {};
            for (const [k, v] of Object.entries(value)) {
                fields[k] = this.toFirestoreValue(v);
            }
            return { mapValue: { fields } };
        }
        return { stringValue: String(value) };
    }
    objectToFields(obj) {
        const fields = {};
        for (const [k, v] of Object.entries(obj)) {
            fields[k] = this.toFirestoreValue(v);
        }
        return fields;
    }
    async runQuery(kind, lastSync) {
        const parent = `projects/${this.projectId}/databases/(default)/documents`;
        const url = `https://firestore.googleapis.com/v1/${parent}:runQuery`;
        const body = {
            structuredQuery: {
                from: [{ collectionId: this.collectionId(kind) }],
                where: {
                    fieldFilter: {
                        field: { fieldPath: share_item_model_1.SHARE_ITEM_FIELDS.SYNC },
                        op: 'GREATER_THAN',
                        value: { timestampValue: lastSync.toISOString() }
                    }
                }
            }
        };
        const res = await this.firestoreFetch(url, { method: 'POST', body: JSON.stringify(body) });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`runQuery failed: ${res.status} ${text}`);
        }
        const rows = (await res.json());
        const items = [];
        for (const row of rows) {
            if (!row.document)
                continue;
            const name = row.document.name || '';
            const docId = name.split('/').pop() || '';
            if (docId.startsWith('_'))
                continue;
            items.push((0, share_item_mapper_1.parseShareItemFromCloud)(this.docToObject(row.document)));
        }
        return items;
    }
    async getIndexDoc(kind) {
        const url = `${this.baseUrl(kind)}/_${kind}`;
        const res = await this.firestoreFetch(url);
        if (res.status === 404)
            return {};
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`get index failed: ${res.status} ${text}`);
        }
        const doc = await res.json();
        const obj = this.docToObject(doc);
        const map = {};
        for (const [k, v] of Object.entries(obj)) {
            const d = (0, share_item_mapper_1.parseFlexibleDate)(v);
            if (d)
                map[k] = d;
        }
        return map;
    }
    async getDocument(kind, docId) {
        const encoded = encodeURIComponent(docId);
        const url = `${this.baseUrl(kind)}/${encoded}`;
        const res = await this.firestoreFetch(url);
        if (res.status === 404)
            return null;
        if (!res.ok)
            return null;
        const doc = await res.json();
        return (0, share_item_mapper_1.parseShareItemFromCloud)(this.docToObject(doc));
    }
    async setDocument(kind, docId, data) {
        const encoded = encodeURIComponent(docId);
        const url = `${this.baseUrl(kind)}/${encoded}`;
        const res = await this.firestoreFetch(url, {
            method: 'PATCH',
            body: JSON.stringify({ fields: this.objectToFields(data) })
        });
        if (!res.ok) {
            // create if missing
            if (res.status === 404) {
                const createUrl = `${this.baseUrl(kind)}?documentId=${encoded}`;
                const createRes = await this.firestoreFetch(createUrl, {
                    method: 'POST',
                    body: JSON.stringify({ fields: this.objectToFields(data) })
                });
                if (!createRes.ok) {
                    throw new Error(`create doc failed: ${createRes.status} ${await createRes.text()}`);
                }
                return;
            }
            throw new Error(`set doc failed: ${res.status} ${await res.text()}`);
        }
    }
    async processManga(onUpdate) {
        const sync = new Date();
        const alteration = new Date(Date.now() - 1000).toISOString();
        const lastSync = this.getLastSync('MANGA');
        let share = [];
        let index = {};
        try {
            share = await this.runQuery('manga', lastSync);
            index = await this.getIndexDoc('manga');
        }
        catch (e) {
            console.error('[ShareMarkFirebase] download manga:', e);
            return sharemark_enum_1.ShareMarkType.ERROR_DOWNLOAD;
        }
        const locals = this.storage.mangaRepository.listSync(lastSync);
        for (const manga of locals) {
            let item = share.find((s) => s.file === manga.name);
            if (item) {
                if (this.compareManga(item, manga)) {
                    manga.lastAlteration = alteration;
                    this.storage.saveManga(manga);
                    onUpdate(manga);
                }
            }
            else if (index[manga.name]) {
                const doc = await this.getDocument('manga', manga.name);
                if (doc) {
                    share.push(doc);
                    if (this.compareManga(doc, manga)) {
                        manga.lastAlteration = alteration;
                        this.storage.saveManga(manga);
                        onUpdate(manga);
                    }
                }
                else {
                    share.push(this.createMangaShareItem(manga));
                }
            }
            else if ((manga.bookMark ?? 0) > 0) {
                share.push(this.createMangaShareItem(manga));
            }
        }
        for (const item of share.filter((i) => !i.processed)) {
            const manga = this.storage.mangaRepository.getByFileName(item.file);
            if (manga && this.compareManga(item, manga)) {
                manga.lastAlteration = alteration;
                this.storage.saveManga(manga);
                onUpdate(manga);
            }
        }
        for (const item of share) {
            const manga = this.storage.mangaRepository.getByFileName(item.file);
            if (manga)
                this.applyMangaHistoryAndAnnotations(item, manga);
        }
        const isUpdate = share.some((i) => i.alter);
        let result;
        if (isUpdate) {
            try {
                for (const item of share.filter((i) => i.alter)) {
                    index[item.file] = sync;
                    item.sync = (0, share_item_mapper_1.formatShareMarkDate)(sync);
                    const manga = this.storage.mangaRepository.getByFileName(item.file);
                    if (manga)
                        this.refreshMangaItem(item, manga);
                    await this.setDocument('manga', item.file, (0, share_item_mapper_1.serializeShareItemForCloud)(item, true));
                }
                const indexPayload = {};
                for (const [k, v] of Object.entries(index)) {
                    indexPayload[k] = { seconds: Math.floor(v.getTime() / 1000), nanos: 0 };
                }
                await this.setDocument('manga', '_manga', indexPayload);
                result = sharemark_enum_1.ShareMarkType.SUCCESS;
            }
            catch (e) {
                console.error('[ShareMarkFirebase] upload manga:', e);
                result = sharemark_enum_1.ShareMarkType.ERROR_UPLOAD;
            }
        }
        else if (share.length > 0) {
            result = sharemark_enum_1.ShareMarkType.SUCCESS;
        }
        else {
            result = sharemark_enum_1.ShareMarkType.NOT_ALTERATION;
        }
        sharemark_enum_1.ShareMarkStatus.send = share.filter((i) => i.alter).length;
        sharemark_enum_1.ShareMarkStatus.receive = share.filter((i) => i.received).length;
        if (result !== sharemark_enum_1.ShareMarkType.ERROR_UPLOAD) {
            this.setLastSync('MANGA', sync);
        }
        return result;
    }
    async processBook(onUpdate) {
        const sync = new Date();
        const alteration = new Date(Date.now() - 1000).toISOString();
        const lastSync = this.getLastSync('BOOK');
        let share = [];
        let index = {};
        try {
            share = await this.runQuery('book', lastSync);
            index = await this.getIndexDoc('book');
        }
        catch (e) {
            console.error('[ShareMarkFirebase] download book:', e);
            return sharemark_enum_1.ShareMarkType.ERROR_DOWNLOAD;
        }
        const locals = this.storage.bookRepository.listSync(lastSync);
        for (const book of locals) {
            let item = share.find((s) => s.file === book.name);
            if (item) {
                if (this.compareBook(item, book)) {
                    book.lastAlteration = alteration;
                    this.storage.saveBook(book);
                    onUpdate(book);
                }
            }
            else if (index[book.name]) {
                const doc = await this.getDocument('book', book.name);
                if (doc) {
                    share.push(doc);
                    if (this.compareBook(doc, book)) {
                        book.lastAlteration = alteration;
                        this.storage.saveBook(book);
                        onUpdate(book);
                    }
                }
                else {
                    share.push(await this.createBookShareItem(book));
                }
            }
            else if ((book.bookMark ?? 0) > 0) {
                share.push(await this.createBookShareItem(book));
            }
        }
        for (const item of share.filter((i) => !i.processed)) {
            const book = this.storage.bookRepository.getByFileName(item.file);
            if (book && this.compareBook(item, book)) {
                book.lastAlteration = alteration;
                this.storage.saveBook(book);
                onUpdate(book);
            }
        }
        for (const item of share) {
            const book = this.storage.bookRepository.getByFileName(item.file);
            if (book)
                this.applyBookHistoryAndAnnotations(item, book);
        }
        const isUpdate = share.some((i) => i.alter);
        let result;
        if (isUpdate) {
            try {
                for (const item of share.filter((i) => i.alter)) {
                    index[item.file] = sync;
                    item.sync = (0, share_item_mapper_1.formatShareMarkDate)(sync);
                    const book = this.storage.bookRepository.getByFileName(item.file);
                    if (book)
                        await this.refreshBookItem(item, book);
                    await this.setDocument('book', item.file, (0, share_item_mapper_1.serializeShareItemForCloud)(item, true));
                }
                const indexPayload = {};
                for (const [k, v] of Object.entries(index)) {
                    indexPayload[k] = { seconds: Math.floor(v.getTime() / 1000), nanos: 0 };
                }
                await this.setDocument('book', '_book', indexPayload);
                result = sharemark_enum_1.ShareMarkType.SUCCESS;
            }
            catch (e) {
                console.error('[ShareMarkFirebase] upload book:', e);
                result = sharemark_enum_1.ShareMarkType.ERROR_UPLOAD;
            }
        }
        else if (share.length > 0) {
            result = sharemark_enum_1.ShareMarkType.SUCCESS;
        }
        else {
            result = sharemark_enum_1.ShareMarkType.NOT_ALTERATION;
        }
        sharemark_enum_1.ShareMarkStatus.send = share.filter((i) => i.alter).length;
        sharemark_enum_1.ShareMarkStatus.receive = share.filter((i) => i.received).length;
        if (result !== sharemark_enum_1.ShareMarkType.ERROR_UPLOAD) {
            this.setLastSync('BOOK', sync);
        }
        return result;
    }
}
exports.ShareMarkFirebaseService = ShareMarkFirebaseService;
