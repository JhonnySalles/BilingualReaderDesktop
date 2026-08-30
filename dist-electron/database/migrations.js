"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationsManager = void 0;
class MigrationsManager {
    db;
    constructor(db) {
        this.db = db;
    }
    runMigrations() {
        const row = this.db.pragma('user_version', { simple: true });
        let currentVersion = row || 0;
        if (currentVersion === 0) {
            this.createInitialSchema();
            this.db.pragma('user_version = 15');
            return;
        }
        if (currentVersion < 2) {
            this.migrate1To2();
            this.db.pragma('user_version = 2');
        }
        if (currentVersion < 3) {
            this.migrate2To3();
            this.db.pragma('user_version = 3');
        }
        if (currentVersion < 4) {
            this.migrate3To4();
            this.db.pragma('user_version = 4');
        }
        // Additional migrations up to 15...
        if (currentVersion < 15) {
            this.db.pragma('user_version = 15');
        }
    }
    createInitialSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS Libraries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        language TEXT DEFAULT 'PORTUGUESE',
        type TEXT NOT NULL DEFAULT 'MANGA',
        enabled INTEGER NOT NULL DEFAULT 1,
        excluded INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS Manga (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        folder TEXT NOT NULL,
        name TEXT NOT NULL,
        size INTEGER NOT NULL DEFAULT 0,
        type TEXT NOT NULL,
        pages INTEGER NOT NULL DEFAULT 1,
        chapters TEXT DEFAULT '[]',
        chapters_pages TEXT DEFAULT '{}',
        book_mark INTEGER NOT NULL DEFAULT 0,
        completed INTEGER NOT NULL DEFAULT 0,
        favorite INTEGER NOT NULL DEFAULT 0,
        has_subtitle INTEGER NOT NULL DEFAULT 0,
        author TEXT DEFAULT '',
        series TEXT DEFAULT '',
        genre TEXT DEFAULT '',
        publisher TEXT DEFAULT '',
        release TEXT,
        volume TEXT DEFAULT '',
        date_create TEXT,
        last_access TEXT,
        excluded INTEGER NOT NULL DEFAULT 0,
        id_library INTEGER,
        last_alteration TEXT,
        file_alteration TEXT NOT NULL,
        last_vocabulary_import TEXT,
        last_verify TEXT,
        FOREIGN KEY (id_library) REFERENCES Libraries (id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS index_Manga_name_title ON Manga(name, title);

      CREATE TABLE IF NOT EXISTS Book (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT DEFAULT '',
        password TEXT DEFAULT '',
        annotation TEXT DEFAULT '',
        release TEXT,
        genre TEXT DEFAULT '',
        publisher TEXT DEFAULT '',
        series TEXT DEFAULT '',
        isbn TEXT DEFAULT '',
        pages INTEGER NOT NULL DEFAULT 1,
        volume TEXT DEFAULT '',
        chapter TEXT DEFAULT '',
        chapter_description TEXT DEFAULT '',
        book_mark INTEGER NOT NULL DEFAULT 0,
        completed INTEGER NOT NULL DEFAULT 0,
        language TEXT DEFAULT '',
        path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        folder TEXT NOT NULL,
        size INTEGER NOT NULL DEFAULT 0,
        favorite INTEGER NOT NULL DEFAULT 0,
        date_create TEXT,
        last_access TEXT,
        id_library INTEGER,
        tags TEXT DEFAULT '',
        excluded INTEGER NOT NULL DEFAULT 0,
        last_alteration TEXT,
        file_alteration TEXT NOT NULL,
        last_vocabulary_import TEXT,
        last_verify TEXT,
        FOREIGN KEY (id_library) REFERENCES Libraries (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS MangaMark (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_manga INTEGER NOT NULL,
        page INTEGER NOT NULL,
        pages INTEGER NOT NULL,
        type TEXT NOT NULL,
        chapter TEXT NOT NULL,
        folder TEXT NOT NULL,
        annotation TEXT NOT NULL,
        alteration TEXT NOT NULL,
        created TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS index_MangaMark_id_manga_chapter ON MangaMark(id_manga, chapter);

      CREATE TABLE IF NOT EXISTS BookConfiguration (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_book INTEGER NOT NULL,
        alignment TEXT NOT NULL,
        margin TEXT NOT NULL,
        spacing TEXT NOT NULL,
        scrolling TEXT NOT NULL,
        pagination TEXT NOT NULL DEFAULT 'Default',
        font_type TEXT NOT NULL,
        font_size REAL NOT NULL
      );

      CREATE TABLE IF NOT EXISTS AssistantHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_reference INTEGER NOT NULL,
        type TEXT NOT NULL,
        role TEXT NOT NULL,
        message TEXT NOT NULL,
        date TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS index_AssistantHistory_id_reference_type ON AssistantHistory(id_reference, type);

      CREATE TABLE IF NOT EXISTS Vocabulary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL,
        basic_form TEXT,
        portuguese TEXT,
        english TEXT,
        reading TEXT,
        revised INTEGER NOT NULL DEFAULT 0,
        jlpt TEXT,
        favorite INTEGER NOT NULL DEFAULT 0,
        appears INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS MangaVocabulary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_manga INTEGER NOT NULL,
        id_vocabulary INTEGER NOT NULL,
        appears INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS BookVocabulary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_book INTEGER NOT NULL,
        id_vocabulary INTEGER NOT NULL,
        appears INTEGER NOT NULL DEFAULT 1
      );
    `);
    }
    migrate1To2() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS MangaMark (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_manga INTEGER NOT NULL,
        page INTEGER NOT NULL,
        pages INTEGER NOT NULL,
        type TEXT NOT NULL,
        chapter TEXT NOT NULL,
        folder TEXT NOT NULL,
        annotation TEXT NOT NULL,
        alteration TEXT NOT NULL,
        created TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS index_MangaMark_id_manga_chapter ON MangaMark(id_manga, chapter);
    `);
        try {
            this.db.exec(`ALTER TABLE Manga ADD COLUMN chapters_pages TEXT DEFAULT '' NOT NULL`);
        }
        catch (e) {
            // Column may already exist
        }
    }
    migrate2To3() {
        try {
            this.db.exec(`ALTER TABLE BookConfiguration ADD COLUMN pagination TEXT DEFAULT 'Default' NOT NULL`);
        }
        catch (e) {
            // Column may already exist
        }
    }
    migrate3To4() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS AssistantHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_reference INTEGER NOT NULL,
        type TEXT NOT NULL,
        role TEXT NOT NULL,
        message TEXT NOT NULL,
        date TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS index_AssistantHistory_id_reference_type ON AssistantHistory(id_reference, type);
    `);
    }
}
exports.MigrationsManager = MigrationsManager;
