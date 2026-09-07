"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileLinkRepository = void 0;
const linked_file_model_1 = require("../../src/app/core/models/entities/linked-file.model");
const app_enums_1 = require("../../src/app/core/models/enums/app-enums");
const page_link_enums_1 = require("../../src/app/core/models/enums/page-link-enums");
class FileLinkRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    mapFileLink(row) {
        return {
            id: row.id,
            idManga: row.id_manga,
            pages: row.pages ?? 0,
            path: row.path || '',
            name: row.name || '',
            type: row.type || '',
            folder: row.folder || '',
            language: row.language || app_enums_1.Languages.PORTUGUESE,
            dateCreate: row.date_create || undefined,
            lastAccess: row.last_access || undefined,
            lastAlteration: row.last_alteration || undefined
        };
    }
    mapPageLink(row) {
        return (0, linked_file_model_1.createEmptyLinkedPage)({
            id: row.id,
            idFile: row.id_file,
            mangaPage: row.manga_page ?? page_link_enums_1.PAGE_EMPTY,
            mangaPages: row.manga_pages ?? 0,
            mangaPageName: row.manga_page_name || '',
            mangaPagePath: row.manga_page_path || '',
            fileLinkLeftPage: row.file_link_page ?? page_link_enums_1.PAGE_EMPTY,
            fileLinkLeftPages: row.file_link_pages ?? 0,
            fileLinkLeftPageName: row.file_link_page_name || '',
            fileLinkLeftPagePath: row.file_link_page_path || '',
            fileLinkRightPage: row.file_right_link_page ?? page_link_enums_1.PAGE_EMPTY,
            fileLinkRightPageName: row.file_right_link_page_name || '',
            fileLinkRightPagePath: row.file_right_link_page_path || '',
            isNotLinked: Boolean(row.not_linked),
            isDualImage: Boolean(row.dual_image),
            isMangaDualPage: Boolean(row.manga_dual_page),
            isFileLeftDualPage: Boolean(row.file_left_dual_page),
            isFileRightDualPage: Boolean(row.file_right_dual_page)
        });
    }
    getPagesLink(idFile) {
        const stmt = this.db.prepare(`SELECT * FROM PagesLink WHERE id_file = ? AND not_linked = 0 ORDER BY manga_page ASC, id ASC`);
        return stmt.all(idFile).map(row => this.mapPageLink(row));
    }
    getPagesNotLink(idFile) {
        const stmt = this.db.prepare(`SELECT * FROM PagesLink WHERE id_file = ? AND not_linked = 1 ORDER BY file_link_page ASC, id ASC`);
        return stmt.all(idFile).map(row => this.mapPageLink(row));
    }
    insertPages(idFile, pages) {
        const stmt = this.db.prepare(`
      INSERT INTO PagesLink (
        id_file, manga_page, manga_pages, manga_page_name, manga_page_path,
        file_link_page, file_link_pages, file_link_page_name, file_link_page_path,
        file_right_link_page, file_right_link_page_name, file_right_link_page_path,
        not_linked, dual_image, manga_dual_page, file_left_dual_page, file_right_dual_page
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        for (const page of pages) {
            const result = stmt.run(idFile, page.mangaPage ?? page_link_enums_1.PAGE_EMPTY, page.mangaPages ?? 0, page.mangaPageName || '', page.mangaPagePath || '', page.fileLinkLeftPage ?? page_link_enums_1.PAGE_EMPTY, page.fileLinkLeftPages ?? 0, page.fileLinkLeftPageName || '', page.fileLinkLeftPagePath || '', page.fileLinkRightPage ?? page_link_enums_1.PAGE_EMPTY, page.fileLinkRightPageName || '', page.fileLinkRightPagePath || '', page.isNotLinked ? 1 : 0, page.isDualImage ? 1 : 0, page.isMangaDualPage ? 1 : 0, page.isFileLeftDualPage ? 1 : 0, page.isFileRightDualPage ? 1 : 0);
            page.id = Number(result.lastInsertRowid);
            page.idFile = idFile;
        }
    }
    /** Replace any existing link for this manga (Android save semantics). */
    save(obj) {
        this.deleteByManga(obj.idManga);
        const now = new Date().toISOString();
        obj.lastAlteration = now;
        if (!obj.dateCreate)
            obj.dateCreate = now;
        if (!obj.lastAccess)
            obj.lastAccess = now;
        const stmt = this.db.prepare(`
      INSERT INTO FileLink (
        id_manga, pages, path, name, type, folder, language,
        date_create, last_access, last_alteration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(obj.idManga, obj.pages ?? 0, obj.path || '', obj.name || '', obj.type || '', obj.folder || '', obj.language || app_enums_1.Languages.PORTUGUESE, obj.dateCreate, obj.lastAccess, obj.lastAlteration);
        const id = Number(result.lastInsertRowid);
        obj.id = id;
        this.db.prepare(`DELETE FROM PagesLink WHERE id_file = ?`).run(id);
        if (obj.pagesLink?.length)
            this.insertPages(id, obj.pagesLink);
        if (obj.pagesNotLink?.length)
            this.insertPages(id, obj.pagesNotLink);
        return id;
    }
    update(obj) {
        if (!obj.id) {
            this.save(obj);
            return;
        }
        const now = new Date().toISOString();
        obj.lastAlteration = now;
        this.db.prepare(`
      UPDATE FileLink SET
        id_manga = ?, pages = ?, path = ?, name = ?, type = ?, folder = ?,
        language = ?, last_access = ?, last_alteration = ?
      WHERE id = ?
    `).run(obj.idManga, obj.pages ?? 0, obj.path || '', obj.name || '', obj.type || '', obj.folder || '', obj.language || app_enums_1.Languages.PORTUGUESE, obj.lastAccess || now, obj.lastAlteration, obj.id);
        this.db.prepare(`DELETE FROM PagesLink WHERE id_file = ?`).run(obj.id);
        if (obj.pagesLink?.length)
            this.insertPages(obj.id, obj.pagesLink);
        if (obj.pagesNotLink?.length)
            this.insertPages(obj.id, obj.pagesNotLink);
    }
    getByManga(mangaId) {
        if (!mangaId)
            return undefined;
        const row = this.db.prepare(`
      SELECT * FROM FileLink
      WHERE id_manga = ?
      ORDER BY datetime(COALESCE(last_access, date_create)) DESC, id DESC
      LIMIT 1
    `).get(mangaId);
        if (!row)
            return undefined;
        const fileLink = this.mapFileLink(row);
        fileLink.pagesLink = this.getPagesLink(fileLink.id);
        fileLink.pagesNotLink = this.getPagesNotLink(fileLink.id);
        return fileLink;
    }
    findByFileName(mangaId, name, pages) {
        const row = this.db.prepare(`
      SELECT * FROM FileLink
      WHERE id_manga = ? AND name = ? AND pages = ?
      ORDER BY id DESC LIMIT 1
    `).get(mangaId, name, pages);
        if (!row)
            return undefined;
        const fileLink = this.mapFileLink(row);
        fileLink.pagesLink = this.getPagesLink(fileLink.id);
        fileLink.pagesNotLink = this.getPagesNotLink(fileLink.id);
        return fileLink;
    }
    findAllByManga(mangaId) {
        const rows = this.db.prepare(`
      SELECT * FROM FileLink WHERE id_manga = ? ORDER BY datetime(COALESCE(last_access, date_create)) DESC
    `).all(mangaId);
        return rows.map(row => this.mapFileLink(row));
    }
    deleteById(id) {
        this.db.prepare(`DELETE FROM PagesLink WHERE id_file = ?`).run(id);
        this.db.prepare(`DELETE FROM FileLink WHERE id = ?`).run(id);
    }
    deleteByManga(mangaId) {
        this.db.prepare(`
      DELETE FROM PagesLink WHERE id_file IN (SELECT id FROM FileLink WHERE id_manga = ?)
    `).run(mangaId);
        this.db.prepare(`DELETE FROM FileLink WHERE id_manga = ?`).run(mangaId);
    }
    delete(obj) {
        if (obj.id)
            this.deleteById(obj.id);
    }
}
exports.FileLinkRepository = FileLinkRepository;
