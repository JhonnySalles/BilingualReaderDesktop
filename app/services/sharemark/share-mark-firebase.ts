import { ShareMarkBase } from './share-mark-base';
import { GoogleAuthService } from '../google-auth.service';
import { Secrets } from '../../utils/secrets';
import { ShareItem } from '../../../src/app/core/models/entities/share-item.model';
import { ShareMarkType, ShareMarkStatus } from '../../../src/app/core/models/enums/sharemark.enum';
import { Manga } from '../../../src/app/core/models/entities/manga.model';
import { Book } from '../../../src/app/core/models/entities/book.model';
import {
  formatShareMarkDate,
  parseFlexibleDate,
  parseShareItemFromCloud,
  serializeShareItemForCloud
} from './share-item.mapper';
import { SHARE_ITEM_FIELDS } from '../../../src/app/core/models/entities/share-item.model';

export class ShareMarkFirebaseService extends ShareMarkBase {
  readonly notConnectErrorType = ShareMarkType.NOT_CONNECT_FIREBASE;

  private userPrefix = '';
  private idToken: string | null = null;
  private projectId = '';

  async initialize(): Promise<ShareMarkType> {
    try {
      if (!GoogleAuthService.instance.isSignedIn()) {
        return ShareMarkType.NOT_SIGN_IN;
      }
      const email = GoogleAuthService.instance.getEmail();
      if (!email) return ShareMarkType.ERROR;

      this.projectId = Secrets.instance.getFirebaseProjectId();
      if (!this.projectId || !Secrets.instance.getFirebaseApiKey()) {
        console.error('[ShareMarkFirebase] FIREBASE_PROJECT_ID / FIREBASE_API_KEY missing');
        return ShareMarkType.NOT_CONNECT_FIREBASE;
      }

      this.userPrefix = email.substring(0, email.lastIndexOf('@'));
      this.idToken = await GoogleAuthService.instance.getFirebaseIdToken();
      if (!this.idToken) {
        // Try refreshing Google token then Firebase again
        await GoogleAuthService.instance.getAuthenticatedClient();
        this.idToken = await GoogleAuthService.instance.getFirebaseIdToken();
      }
      if (!this.idToken) return ShareMarkType.NOT_CONNECT_FIREBASE;
      return ShareMarkType.SUCCESS;
    } catch (e) {
      console.error('[ShareMarkFirebase] initialize:', e);
      return ShareMarkType.NOT_CONNECT_FIREBASE;
    }
  }

  private collectionId(kind: 'manga' | 'book'): string {
    return `bilingualreader_${this.userPrefix}_${kind}`;
  }

  private baseUrl(kind: 'manga' | 'book'): string {
    return `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents/${this.collectionId(kind)}`;
  }

  private async firestoreFetch(url: string, init?: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.idToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> | undefined)
    };
    return fetch(url, { ...init, headers });
  }

  private fromFirestoreValue(value: any): unknown {
    if (value == null) return null;
    if ('stringValue' in value) return value.stringValue;
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return Number(value.doubleValue);
    if ('booleanValue' in value) return Boolean(value.booleanValue);
    if ('timestampValue' in value) return value.timestampValue;
    if ('nullValue' in value) return null;
    if ('mapValue' in value) {
      const fields = value.mapValue?.fields || {};
      const obj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        obj[k] = this.fromFirestoreValue(v);
      }
      return obj;
    }
    if ('arrayValue' in value) {
      return (value.arrayValue?.values || []).map((v: any) => this.fromFirestoreValue(v));
    }
    return null;
  }

  private docToObject(doc: any): Record<string, unknown> {
    const fields = doc?.fields || {};
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      obj[k] = this.fromFirestoreValue(v);
    }
    return obj;
  }

  private toFirestoreValue(value: unknown): any {
    if (value === null || value === undefined) return { nullValue: null };
    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (typeof value === 'number') {
      if (Number.isInteger(value)) return { integerValue: String(value) };
      return { doubleValue: value };
    }
    if (typeof value === 'object' && value !== null && 'seconds' in (value as object) && 'nanos' in (value as object)) {
      const ts = value as { seconds: number; nanos: number };
      const iso = new Date(ts.seconds * 1000 + Math.floor(ts.nanos / 1e6)).toISOString();
      return { timestampValue: iso };
    }
    if (Array.isArray(value)) {
      return { arrayValue: { values: value.map((v) => this.toFirestoreValue(v)) } };
    }
    if (typeof value === 'object') {
      const fields: Record<string, any> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        fields[k] = this.toFirestoreValue(v);
      }
      return { mapValue: { fields } };
    }
    return { stringValue: String(value) };
  }

  private objectToFields(obj: Record<string, unknown>): Record<string, any> {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      fields[k] = this.toFirestoreValue(v);
    }
    return fields;
  }

  private async runQuery(kind: 'manga' | 'book', lastSync: Date): Promise<ShareItem[]> {
    const parent = `projects/${this.projectId}/databases/(default)/documents`;
    const url = `https://firestore.googleapis.com/v1/${parent}:runQuery`;
    const body = {
      structuredQuery: {
        from: [{ collectionId: this.collectionId(kind) }],
        where: {
          fieldFilter: {
            field: { fieldPath: SHARE_ITEM_FIELDS.SYNC },
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
    const rows = (await res.json()) as Array<{ document?: any }>;
    const items: ShareItem[] = [];
    for (const row of rows) {
      if (!row.document) continue;
      const name: string = row.document.name || '';
      const docId = name.split('/').pop() || '';
      if (docId.startsWith('_')) continue;
      items.push(parseShareItemFromCloud(this.docToObject(row.document)));
    }
    return items;
  }

  private async getIndexDoc(kind: 'manga' | 'book'): Promise<Record<string, Date>> {
    const url = `${this.baseUrl(kind)}/_${kind}`;
    const res = await this.firestoreFetch(url);
    if (res.status === 404) return {};
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`get index failed: ${res.status} ${text}`);
    }
    const doc = await res.json();
    const obj = this.docToObject(doc);
    const map: Record<string, Date> = {};
    for (const [k, v] of Object.entries(obj)) {
      const d = parseFlexibleDate(v);
      if (d) map[k] = d;
    }
    return map;
  }

  private async getDocument(kind: 'manga' | 'book', docId: string): Promise<ShareItem | null> {
    const encoded = encodeURIComponent(docId);
    const url = `${this.baseUrl(kind)}/${encoded}`;
    const res = await this.firestoreFetch(url);
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const doc = await res.json();
    return parseShareItemFromCloud(this.docToObject(doc));
  }

  private async setDocument(kind: 'manga' | 'book', docId: string, data: Record<string, unknown>): Promise<void> {
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

  async processManga(onUpdate: (manga: Manga) => void): Promise<ShareMarkType> {
    const sync = new Date();
    const alteration = new Date(Date.now() - 1000).toISOString();
    const lastSync = this.getLastSync('MANGA');
    let share: ShareItem[] = [];
    let index: Record<string, Date> = {};

    try {
      share = await this.runQuery('manga', lastSync);
      index = await this.getIndexDoc('manga');
    } catch (e) {
      console.error('[ShareMarkFirebase] download manga:', e);
      return ShareMarkType.ERROR_DOWNLOAD;
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
      } else if (index[manga.name]) {
        const doc = await this.getDocument('manga', manga.name);
        if (doc) {
          share.push(doc);
          if (this.compareManga(doc, manga)) {
            manga.lastAlteration = alteration;
            this.storage.saveManga(manga);
            onUpdate(manga);
          }
        } else {
          share.push(this.createMangaShareItem(manga));
        }
      } else if ((manga.bookMark ?? 0) > 0) {
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
      if (manga) this.applyMangaHistoryAndAnnotations(item, manga);
    }

    const isUpdate = share.some((i) => i.alter);
    let result: ShareMarkType;
    if (isUpdate) {
      try {
        for (const item of share.filter((i) => i.alter)) {
          index[item.file] = sync;
          item.sync = formatShareMarkDate(sync);
          const manga = this.storage.mangaRepository.getByFileName(item.file);
          if (manga) this.refreshMangaItem(item, manga);
          await this.setDocument('manga', item.file, serializeShareItemForCloud(item, true));
        }
        const indexPayload: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(index)) {
          indexPayload[k] = { seconds: Math.floor(v.getTime() / 1000), nanos: 0 };
        }
        await this.setDocument('manga', '_manga', indexPayload);
        result = ShareMarkType.SUCCESS;
      } catch (e) {
        console.error('[ShareMarkFirebase] upload manga:', e);
        result = ShareMarkType.ERROR_UPLOAD;
      }
    } else if (share.length > 0) {
      result = ShareMarkType.SUCCESS;
    } else {
      result = ShareMarkType.NOT_ALTERATION;
    }

    ShareMarkStatus.send = share.filter((i) => i.alter).length;
    ShareMarkStatus.receive = share.filter((i) => i.received).length;
    if (result !== ShareMarkType.ERROR_UPLOAD) {
      this.setLastSync('MANGA', sync);
    }
    return result;
  }

  async processBook(onUpdate: (book: Book) => void): Promise<ShareMarkType> {
    const sync = new Date();
    const alteration = new Date(Date.now() - 1000).toISOString();
    const lastSync = this.getLastSync('BOOK');
    let share: ShareItem[] = [];
    let index: Record<string, Date> = {};

    try {
      share = await this.runQuery('book', lastSync);
      index = await this.getIndexDoc('book');
    } catch (e) {
      console.error('[ShareMarkFirebase] download book:', e);
      return ShareMarkType.ERROR_DOWNLOAD;
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
      } else if (index[book.name]) {
        const doc = await this.getDocument('book', book.name);
        if (doc) {
          share.push(doc);
          if (this.compareBook(doc, book)) {
            book.lastAlteration = alteration;
            this.storage.saveBook(book);
            onUpdate(book);
          }
        } else {
          share.push(await this.createBookShareItem(book));
        }
      } else if ((book.bookMark ?? 0) > 0) {
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
      if (book) this.applyBookHistoryAndAnnotations(item, book);
    }

    const isUpdate = share.some((i) => i.alter);
    let result: ShareMarkType;
    if (isUpdate) {
      try {
        for (const item of share.filter((i) => i.alter)) {
          index[item.file] = sync;
          item.sync = formatShareMarkDate(sync);
          const book = this.storage.bookRepository.getByFileName(item.file);
          if (book) await this.refreshBookItem(item, book);
          await this.setDocument('book', item.file, serializeShareItemForCloud(item, true));
        }
        const indexPayload: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(index)) {
          indexPayload[k] = { seconds: Math.floor(v.getTime() / 1000), nanos: 0 };
        }
        await this.setDocument('book', '_book', indexPayload);
        result = ShareMarkType.SUCCESS;
      } catch (e) {
        console.error('[ShareMarkFirebase] upload book:', e);
        result = ShareMarkType.ERROR_UPLOAD;
      }
    } else if (share.length > 0) {
      result = ShareMarkType.SUCCESS;
    } else {
      result = ShareMarkType.NOT_ALTERATION;
    }

    ShareMarkStatus.send = share.filter((i) => i.alter).length;
    ShareMarkStatus.receive = share.filter((i) => i.received).length;
    if (result !== ShareMarkType.ERROR_UPLOAD) {
      this.setLastSync('BOOK', sync);
    }
    return result;
  }
}
