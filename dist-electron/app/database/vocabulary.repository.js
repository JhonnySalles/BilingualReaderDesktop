"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VocabularyRepository = void 0;
class VocabularyRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    get(id) {
        const stmt = this.db.prepare(`SELECT * FROM Vocabulary WHERE id = ?`);
        const row = stmt.get(id);
        if (!row)
            return undefined;
        return this.mapRow(row);
    }
    findByWord(word) {
        const stmt = this.db.prepare(`SELECT * FROM Vocabulary WHERE word = ? OR basic_form = ?`);
        const row = stmt.get(word, word);
        if (!row)
            return undefined;
        return this.mapRow(row);
    }
    findByWordAndBasicForm(word, basicForm) {
        const stmt = this.db.prepare(`SELECT * FROM Vocabulary WHERE word = ? AND COALESCE(basic_form, '') = COALESCE(?, '')`);
        const row = stmt.get(word, basicForm);
        if (!row)
            return undefined;
        return this.mapRow(row);
    }
    list() {
        const stmt = this.db.prepare(`SELECT * FROM Vocabulary`);
        const rows = stmt.all();
        return rows.map(r => this.mapRow(r));
    }
    searchPage(options = {}) {
        const query = (options.query || '').trim();
        const favoriteOnly = !!options.favoriteOnly;
        const order = options.order || 'word';
        let desc = !!options.desc;
        // Android flips favorite sort direction for UX.
        if (order === 'favorite')
            desc = !desc;
        const offset = Math.max(0, options.offset ?? 0);
        const limit = Math.max(1, Math.min(200, options.limit ?? 40));
        const mangaId = options.mangaId ?? null;
        const bookId = options.bookId ?? null;
        const where = [];
        const params = [];
        if (mangaId != null) {
            where.push(`V.id IN (SELECT id_vocabulary FROM MangaVocabulary WHERE id_manga = ?)`);
            params.push(mangaId);
        }
        else if (bookId != null) {
            where.push(`V.id IN (SELECT id_vocabulary FROM BookVocabulary WHERE id_book = ?)`);
            params.push(bookId);
        }
        if (query) {
            where.push(`(V.word LIKE ? OR V.basic_form LIKE ?)`);
            const like = `%${query}%`;
            params.push(like, like);
        }
        if (favoriteOnly) {
            where.push(`V.favorite = 1`);
        }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        let orderCol = 'V.word COLLATE NOCASE';
        if (order === 'appears')
            orderCol = 'V.appears';
        else if (order === 'favorite')
            orderCol = 'V.favorite';
        const orderDir = desc ? 'DESC' : 'ASC';
        const countRow = this.db
            .prepare(`SELECT COUNT(*) AS c FROM Vocabulary V ${whereSql}`)
            .get(...params);
        const total = countRow?.c ?? 0;
        const rows = this.db
            .prepare(`SELECT V.* FROM Vocabulary V ${whereSql}
         ORDER BY ${orderCol} ${orderDir}, V.word COLLATE NOCASE ASC
         LIMIT ? OFFSET ?`)
            .all(...params, limit, offset);
        const items = rows.map(r => this.mapRow(r));
        return {
            items,
            total,
            offset,
            limit,
            hasMore: offset + items.length < total
        };
    }
    setFavorite(id, favorite) {
        this.db.prepare(`UPDATE Vocabulary SET favorite = ? WHERE id = ?`).run(favorite ? 1 : 0, id);
        return this.get(id);
    }
    /**
     * Upsert by (word, basic_form). Returns persisted vocabulary with id.
     * When existing, keeps dictionary fields unless incoming provides non-empty values.
     */
    upsert(vocab) {
        const word = vocab.word.trim();
        const basicForm = (vocab.basicForm || word).trim();
        const existing = this.findByWordAndBasicForm(word, basicForm);
        if (existing?.id) {
            const stmt = this.db.prepare(`
        UPDATE Vocabulary SET
          reading = CASE WHEN ? != '' THEN ? ELSE reading END,
          english = CASE WHEN ? != '' THEN ? ELSE english END,
          portuguese = CASE WHEN ? != '' THEN ? ELSE portuguese END,
          jlpt = CASE WHEN ? != '' THEN ? ELSE jlpt END,
          revised = CASE WHEN ? IS NOT NULL THEN ? ELSE revised END
        WHERE id = ?
      `);
            const reading = (vocab.reading || '').trim();
            const english = (vocab.english || '').trim();
            const portuguese = (vocab.portuguese || '').trim();
            const jlpt = vocab.jlpt != null ? String(vocab.jlpt) : '';
            const revised = vocab.revised == null ? null : vocab.revised ? 1 : 0;
            stmt.run(reading, reading, english, english, portuguese, portuguese, jlpt, jlpt, revised, revised, existing.id);
            return this.get(existing.id);
        }
        const info = this.db.prepare(`
      INSERT INTO Vocabulary (word, basic_form, reading, english, portuguese, jlpt, revised, favorite, appears)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(word, basicForm, (vocab.reading || '').trim(), (vocab.english || '').trim(), (vocab.portuguese || '').trim(), vocab.jlpt != null ? String(vocab.jlpt) : '', vocab.revised ? 1 : 0, vocab.favorite ? 1 : 0, vocab.appears ?? 0);
        return this.get(Number(info.lastInsertRowid));
    }
    linkManga(mangaId, vocabularyId, appears) {
        const existing = this.db
            .prepare(`SELECT id FROM MangaVocabulary WHERE id_manga = ? AND id_vocabulary = ?`)
            .get(mangaId, vocabularyId);
        if (existing?.id) {
            this.db
                .prepare(`UPDATE MangaVocabulary SET appears = ? WHERE id = ?`)
                .run(Math.max(1, appears), existing.id);
        }
        else {
            this.db
                .prepare(`INSERT INTO MangaVocabulary (id_manga, id_vocabulary, appears) VALUES (?, ?, ?)`)
                .run(mangaId, vocabularyId, Math.max(1, appears));
        }
        this.recomputeAppears(vocabularyId);
    }
    linkBook(bookId, vocabularyId, appears) {
        const existing = this.db
            .prepare(`SELECT id FROM BookVocabulary WHERE id_book = ? AND id_vocabulary = ?`)
            .get(bookId, vocabularyId);
        if (existing?.id) {
            this.db
                .prepare(`UPDATE BookVocabulary SET appears = ? WHERE id = ?`)
                .run(Math.max(1, appears), existing.id);
        }
        else {
            this.db
                .prepare(`INSERT INTO BookVocabulary (id_book, id_vocabulary, appears) VALUES (?, ?, ?)`)
                .run(bookId, vocabularyId, Math.max(1, appears));
        }
        this.recomputeAppears(vocabularyId);
    }
    clearMangaLinks(mangaId) {
        const ids = this.db
            .prepare(`SELECT id_vocabulary AS id FROM MangaVocabulary WHERE id_manga = ?`)
            .all(mangaId);
        this.db.prepare(`DELETE FROM MangaVocabulary WHERE id_manga = ?`).run(mangaId);
        for (const row of ids)
            this.recomputeAppears(row.id);
    }
    clearBookLinks(bookId) {
        const ids = this.db
            .prepare(`SELECT id_vocabulary AS id FROM BookVocabulary WHERE id_book = ?`)
            .all(bookId);
        this.db.prepare(`DELETE FROM BookVocabulary WHERE id_book = ?`).run(bookId);
        for (const row of ids)
            this.recomputeAppears(row.id);
    }
    recomputeAppears(vocabularyId) {
        const row = this.db
            .prepare(`SELECT
          COALESCE((SELECT SUM(appears) FROM MangaVocabulary WHERE id_vocabulary = ?), 0) +
          COALESCE((SELECT SUM(appears) FROM BookVocabulary WHERE id_vocabulary = ?), 0) AS total`)
            .get(vocabularyId, vocabularyId);
        this.db
            .prepare(`UPDATE Vocabulary SET appears = ? WHERE id = ?`)
            .run(row?.total ?? 0, vocabularyId);
    }
    findRelatedMangas(vocabularyId, titleHint) {
        const rows = this.db
            .prepare(`SELECT mv.id, mv.id_vocabulary AS fkVocabulary, mv.id_manga AS fkManga, mv.appears,
                m.title, m.name, m.cover_path AS coverPath
         FROM MangaVocabulary mv
         JOIN Manga m ON m.id = mv.id_manga
         WHERE mv.id_vocabulary = ? AND m.excluded = 0
         ORDER BY mv.appears DESC, m.title COLLATE NOCASE ASC`)
            .all(vocabularyId);
        const mapped = rows.map(r => ({
            id: r.id,
            fkVocabulary: r.fkVocabulary,
            fkManga: r.fkManga,
            appears: r.appears ?? 0,
            title: r.title || r.name || '',
            name: r.name || '',
            coverPath: r.coverPath || undefined
        }));
        const hint = (titleHint || '').trim().toLowerCase();
        if (!hint)
            return mapped;
        return mapped.sort((a, b) => {
            const aHit = (a.title || '').toLowerCase().includes(hint) ? 0 : 1;
            const bHit = (b.title || '').toLowerCase().includes(hint) ? 0 : 1;
            if (aHit !== bHit)
                return aHit - bHit;
            return (b.appears || 0) - (a.appears || 0);
        });
    }
    findRelatedBooks(vocabularyId, titleHint) {
        const rows = this.db
            .prepare(`SELECT bv.id, bv.id_vocabulary AS fkVocabulary, bv.id_book AS fkBook, bv.appears,
                b.title, b.name, b.cover_path AS coverPath
         FROM BookVocabulary bv
         JOIN Book b ON b.id = bv.id_book
         WHERE bv.id_vocabulary = ? AND b.excluded = 0
         ORDER BY bv.appears DESC, b.title COLLATE NOCASE ASC`)
            .all(vocabularyId);
        const mapped = rows.map(r => ({
            id: r.id,
            fkVocabulary: r.fkVocabulary,
            fkBook: r.fkBook,
            appears: r.appears ?? 0,
            title: r.title || r.name || '',
            name: r.name || '',
            coverPath: r.coverPath || undefined
        }));
        const hint = (titleHint || '').trim().toLowerCase();
        if (!hint)
            return mapped;
        return mapped.sort((a, b) => {
            const aHit = (a.title || '').toLowerCase().includes(hint) ? 0 : 1;
            const bHit = (b.title || '').toLowerCase().includes(hint) ? 0 : 1;
            if (aHit !== bHit)
                return aHit - bHit;
            return (b.appears || 0) - (a.appears || 0);
        });
    }
    mapRow(row) {
        return {
            id: row.id,
            word: row.word,
            basicForm: row.basic_form || '',
            reading: row.reading || '',
            english: row.english || '',
            portuguese: row.portuguese || '',
            jlpt: row.jlpt != null ? String(row.jlpt) : '',
            revised: Boolean(row.revised),
            favorite: Boolean(row.favorite),
            appears: row.appears ?? 0
        };
    }
}
exports.VocabularyRepository = VocabularyRepository;
