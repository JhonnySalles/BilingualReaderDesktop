import Database from 'better-sqlite3';
import { MangaRepository } from '../../../app/database/manga.repository';
import { FileType } from '../../../src/app/core/models/enums/app-enums';

describe('MangaRepository (Backend SQLite Database)', () => {
  let db: Database.Database;
  let repo: MangaRepository;

  beforeEach(() => {
    // Inicia banco SQLite puramente em memória para isolamento de testes
    db = new Database(':memory:');

    // Cria as tabelas essenciais para o teste do MangaRepository
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

      CREATE INDEX IF NOT EXISTS index_Manga_name_title ON Manga(name, title);
    `);

    // Insere biblioteca mock
    db.prepare(`INSERT INTO Libraries (id, title, path) VALUES (1, 'Biblioteca Teste', '/mangas')`).run();

    repo = new MangaRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('deve inserir e recuperar um novo manga com sucesso', () => {
    const id = repo.save({
      title: 'One Piece Vol 01',
      path: '/mangas/op_01.cbz',
      name: 'op_01.cbz',
      folder: '/mangas',
      fileType: FileType.CBZ,
      pages: 200,
      fkLibrary: 1
    });

    expect(id).toBeGreaterThan(0);

    const manga = repo.getById(id);
    expect(manga).toBeDefined();
    expect(manga?.title).toBe('One Piece Vol 01');
    expect(manga?.pages).toBe(200);
    expect(manga?.completed).toBe(false);
    expect(manga?.bookMark).toBe(0);
  });

  it('deve atualizar o progresso de leitura (bookMark) e marcar como lido (markRead)', () => {
    const id = repo.save({
      title: 'Naruto Vol 01',
      path: '/mangas/naruto_01.cbz',
      pages: 150,
      fkLibrary: 1
    });

    repo.updateBookMark(id, 45);
    let manga = repo.getById(id);
    expect(manga?.bookMark).toBe(45);
    expect(manga?.completed).toBe(false);

    repo.markRead(id);
    manga = repo.getById(id);
    expect(manga?.completed).toBe(true);
    expect(manga?.bookMark).toBe(150);

    repo.clearProgress(id);
    manga = repo.getById(id);
    expect(manga?.completed).toBe(false);
    expect(manga?.bookMark).toBe(0);
  });

  it('deve listar mangás filtrando por biblioteca e excluindo soft-deleted', () => {
    repo.save({ title: 'Manga A', path: '/mangas/a.cbz', fkLibrary: 1 });
    repo.save({ title: 'Manga B', path: '/mangas/b.cbz', fkLibrary: 1 });
    const idC = repo.save({ title: 'Manga C', path: '/mangas/c.cbz', fkLibrary: 1 });

    expect(repo.getMangaCount(1)).toBe(3);
    expect(repo.list(1).length).toBe(3);

    repo.softDelete(idC);

    expect(repo.getMangaCount(1)).toBe(2);
    expect(repo.list(1).length).toBe(2);
    expect(repo.listDeleted(1).length).toBe(1);
    expect(repo.listDeleted(1)[0].id).toBe(idC);
  });

  it('deve buscar mangá por caminho de arquivo (getByPath)', () => {
    repo.save({ title: 'Bleach', path: '/mangas/bleach.cbz', fkLibrary: 1 });

    const found = repo.getByPath('/mangas/bleach.cbz');
    expect(found).toBeDefined();
    expect(found?.title).toBe('Bleach');

    const notFound = repo.getByPath('/mangas/inexistente.cbz');
    expect(notFound).toBeUndefined();
  });
});
