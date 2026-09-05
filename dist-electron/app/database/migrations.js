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
exports.MigrationsManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const electron_1 = require("electron");
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
            this.seedInitialData();
            this.db.pragma('user_version = 17');
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
        if (currentVersion < 5) {
            this.migrate4To5();
            this.db.pragma('user_version = 5');
        }
        if (currentVersion < 15) {
            this.db.pragma('user_version = 15');
        }
        if (currentVersion < 16) {
            this.migrate15To16();
            this.db.pragma('user_version = 16');
        }
        if (currentVersion < 17) {
            this.migrate16To17();
            this.db.pragma('user_version = 17');
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
        cover_path TEXT,
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
        book_mark_cfi TEXT,
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
        cover_path TEXT,
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

      CREATE TABLE IF NOT EXISTS Jlpt (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kanji TEXT NOT NULL,
        level INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS index_Jlpt_kanji ON Jlpt(kanji);

      CREATE TABLE IF NOT EXISTS Kanjax (
        id INTEGER PRIMARY KEY,
        kanji TEXT NOT NULL,
        keyword TEXT,
        meaning TEXT,
        koohii TEXT,
        kohii2 TEXT,
        onyomi TEXT,
        kunyomi TEXT,
        onwords TEXT,
        kunwords TEXT,
        jlpt INTEGER,
        grade INTEGER,
        frequence INTEGER,
        strokes INTEGER,
        variants TEXT,
        radical TEXT,
        parts TEXT,
        utf8 TEXT,
        sjis TEXT,
        keywords_pt TEXT,
        meaning_pt TEXT
      );

      CREATE INDEX IF NOT EXISTS index_Kanjax_kanji ON Kanjax(kanji);

      CREATE TABLE IF NOT EXISTS Vocabulary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL,
        basic_form TEXT,
        reading TEXT,
        english TEXT,
        portuguese TEXT,
        jlpt TEXT,
        revised INTEGER NOT NULL DEFAULT 0,
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

      CREATE TABLE IF NOT EXISTS History (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_library INTEGER NOT NULL DEFAULT 0,
        id_reference INTEGER NOT NULL,
        type TEXT NOT NULL,
        page_start INTEGER NOT NULL DEFAULT 0,
        page_end INTEGER NOT NULL DEFAULT 0,
        pages INTEGER NOT NULL DEFAULT 1,
        completed INTEGER NOT NULL DEFAULT 0,
        volume TEXT DEFAULT '',
        chapters_read INTEGER NOT NULL DEFAULT 0,
        date_time_start TEXT NOT NULL,
        date_time_end TEXT NOT NULL,
        seconds_read INTEGER NOT NULL DEFAULT 0,
        average_time_page INTEGER NOT NULL DEFAULT 0,
        use_tts INTEGER NOT NULL DEFAULT 0,
        notified INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS index_History_reference_library ON History(id_reference, id_library);
      CREATE INDEX IF NOT EXISTS index_History_type_start ON History(type, date_time_start);
    `);
    }
    seedInitialData() {
        console.log('Seeding initial database data from assets...');
        const possiblePaths = [
            path.join(process.cwd(), 'public', 'assets'),
            path.join(electron_1.app ? electron_1.app.getAppPath() : process.cwd(), 'public', 'assets'),
            path.join(__dirname, '..', '..', 'public', 'assets')
        ];
        let assetsDir = '';
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                assetsDir = p;
                break;
            }
        }
        if (!assetsDir) {
            console.warn('Assets directory not found for seeding database.');
            return;
        }
        const PREFIX_KANJI = 'INSERT INTO Jlpt (kanji, level) VALUES ';
        const PREFIX_KANJAX = 'INSERT INTO Kanjax (id, kanji, keyword, meaning, koohii, kohii2, onyomi, kunyomi, onwords, kunwords, jlpt, grade, frequence, strokes, variants, radical, parts, utf8, sjis, keywords_pt, meaning_pt) VALUES ';
        const PREFIX_VOCABULARY = 'INSERT INTO Vocabulary (word, basic_form, reading, english, portuguese, jlpt, revised) VALUES ';
        this.executeBatchSqlFile(path.join(assetsDir, 'kanji.sql'), PREFIX_KANJI);
        this.executeBatchSqlFile(path.join(assetsDir, 'kanjax.sql'), PREFIX_KANJAX);
        this.executeBatchSqlFile(path.join(assetsDir, 'vocabulary.sql'), PREFIX_VOCABULARY);
        console.log('Database initial data seeding completed.');
    }
    executeBatchSqlFile(filePath, prefixSql) {
        if (!fs.existsSync(filePath)) {
            console.warn(`File not found for database seeding: ${filePath}`);
            return;
        }
        try {
            const data = fs.readFileSync(filePath, 'utf-8');
            const batchSize = 450;
            const values = data.split('),(');
            const transaction = this.db.transaction(() => {
                for (let i = 0; i < values.length; i += batchSize) {
                    const end = Math.min(i + batchSize, values.length);
                    const chunk = values.slice(i, end).join('),(');
                    let sql = prefixSql + (i > 0 ? '(' : '') + chunk + (end < values.length ? ')' : '');
                    if (!sql.endsWith(';'))
                        sql += ';';
                    this.db.exec(sql);
                }
            });
            transaction();
        }
        catch (e) {
            console.error(`Error executing batch SQL from ${filePath}:`, e);
        }
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
    migrate4To5() {
        try {
            this.db.exec(`ALTER TABLE Manga ADD COLUMN cover_path TEXT`);
        }
        catch (e) {
            // Column may already exist
        }
        try {
            this.db.exec(`ALTER TABLE Book ADD COLUMN cover_path TEXT`);
        }
        catch (e) {
            // Column may already exist
        }
    }
    migrate15To16() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS History (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_library INTEGER NOT NULL DEFAULT 0,
        id_reference INTEGER NOT NULL,
        type TEXT NOT NULL,
        page_start INTEGER NOT NULL DEFAULT 0,
        page_end INTEGER NOT NULL DEFAULT 0,
        pages INTEGER NOT NULL DEFAULT 1,
        completed INTEGER NOT NULL DEFAULT 0,
        volume TEXT DEFAULT '',
        chapters_read INTEGER NOT NULL DEFAULT 0,
        date_time_start TEXT NOT NULL,
        date_time_end TEXT NOT NULL,
        seconds_read INTEGER NOT NULL DEFAULT 0,
        average_time_page INTEGER NOT NULL DEFAULT 0,
        use_tts INTEGER NOT NULL DEFAULT 0,
        notified INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS index_History_reference_library ON History(id_reference, id_library);
      CREATE INDEX IF NOT EXISTS index_History_type_start ON History(type, date_time_start);
    `);
    }
    migrate16To17() {
        try {
            this.db.exec(`ALTER TABLE Book ADD COLUMN book_mark_cfi TEXT`);
        }
        catch (e) {
            // Column may already exist
        }
    }
}
exports.MigrationsManager = MigrationsManager;
