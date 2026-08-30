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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const electron_1 = require("electron");
const migrations_1 = require("./migrations");
const manga_repository_1 = require("./manga.repository");
class StorageService {
    db;
    mangaRepository;
    constructor() {
        this.initDatabase();
    }
    initDatabase() {
        const userDataPath = electron_1.app.getPath('userData');
        const dbPath = path.join(userDataPath, 'bilingual_reader.db');
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        this.db = new better_sqlite3_1.default(dbPath);
        this.db.pragma('journal_mode = WAL');
        const migrationsManager = new migrations_1.MigrationsManager(this.db);
        migrationsManager.runMigrations();
        this.mangaRepository = new manga_repository_1.MangaRepository(this.db);
    }
    // --- Manga Repository Delegates ---
    listMangas(libraryId) {
        return this.mangaRepository.list(libraryId);
    }
    findMangaByPath(filePath) {
        return this.mangaRepository.getByPath(filePath);
    }
    saveManga(manga) {
        return this.mangaRepository.save(manga);
    }
    deleteManga(id) {
        this.mangaRepository.delete(id);
    }
    getOrCreateLibrary(folderPath) {
        const findStmt = this.db.prepare(`SELECT id FROM Libraries WHERE path = ?`);
        const row = findStmt.get(folderPath);
        if (row)
            return row.id;
        const title = path.basename(folderPath) || 'Biblioteca';
        const insertStmt = this.db.prepare(`INSERT INTO Libraries (title, path, type, enabled, excluded) VALUES (?, ?, 'MANGA', 1, 0)`);
        const res = insertStmt.run(title, folderPath);
        return Number(res.lastInsertRowid);
    }
}
exports.StorageService = StorageService;
