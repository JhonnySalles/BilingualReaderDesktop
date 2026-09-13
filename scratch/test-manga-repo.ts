import Database from 'better-sqlite3';
import { MangaRepository } from '../../app/database/manga.repository';
import * as path from 'path';

const dbPath = path.join(__dirname, '../../database.sqlite');
console.log('Using in-memory db for testing');
const db = new Database(':memory:');

db.exec(`
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
        language TEXT DEFAULT '',
        story_arch TEXT DEFAULT '',
        characters TEXT DEFAULT '',
        tags TEXT DEFAULT '',
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
`);

const repo = new MangaRepository(db);

const mangaPayload = {
    title: "Test",
    path: "F:\\test.cbz",
    folder: "F:\\",
    name: "test.cbz",
    fileSize: 100,
    // explicitly pass null for fileType
    fileType: null as any, 
    pages: 10,
    chapters: [],
    chaptersPages: {},
    bookMark: 0,
    completed: false,
    favorite: false,
    hasSubtitle: false,
    author: "",
    series: "",
    genre: "",
    publisher: "",
    volume: "",
    language: "",
    storyArch: "",
    characters: "",
    tags: "",
    fkLibrary: 1,
    excluded: false,
    fileAlteration: new Date().toISOString()
};

try {
    console.log('Saving empty payload...');
    repo.save({});
    console.log('Empty payload OK');
} catch(e) {
    console.log('Empty payload error:', e.message);
}

try {
    console.log('Saving null fileType payload...');
    repo.save(mangaPayload);
    console.log('Null fileType payload OK');
} catch(e) {
    console.log('Null fileType payload error:', e.message);
}
