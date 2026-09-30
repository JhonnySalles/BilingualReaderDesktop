import { ipcMain } from 'electron';
import { MangaReaderController } from '../../../app/controllers/manga-reader.controller';
import { StorageService } from '../../../app/database/storage.service';

jest.mock('electron', () => {
  const handlers: Record<string, Function> = {};
  return {
    ipcMain: {
      handle: jest.fn((channel: string, listener: Function) => {
        handlers[channel] = listener;
      }),
      _handlers: handlers
    },
    dialog: {
      showOpenDialog: jest.fn()
    },
    BrowserWindow: jest.fn()
  };
});

describe('MangaReaderController (Backend Electron Controller)', () => {
  let controller: MangaReaderController;
  let mockStorage: Partial<StorageService>;
  let handlers: Record<string, Function>;

  beforeEach(() => {
    jest.clearAllMocks();
    handlers = (ipcMain as any)._handlers;

    mockStorage = {
      findMangaById: jest.fn(),
      saveManga: jest.fn(),
      listMangaAnnotations: jest.fn(),
      listAllMangaAnnotations: jest.fn(),
      saveMangaAnnotation: jest.fn(),
      deleteMangaAnnotation: jest.fn()
    };

    controller = new MangaReaderController(mockStorage as StorageService);
    controller.registerIpcHandlers(() => null);
  });

  it('deve registrar os canais IPC esperados', () => {
    expect(ipcMain.handle).toHaveBeenCalledWith('manga-reader:open', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('manga-reader:close', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('manga:set-bookmark', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('manga:toggle-favorite', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('manga:list-annotations', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('manga:save-annotation', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('manga:delete-annotation', expect.any(Function));
  });

  describe('manga:set-bookmark handler', () => {
    it('deve atualizar o bookmark e marcar como completo se pagina atingir o total', async () => {
      const mockManga = {
        id: 10,
        title: 'Manga Teste',
        pages: 50,
        bookMark: 10,
        completed: false
      };

      (mockStorage.findMangaById as jest.Mock)
        .mockReturnValueOnce(mockManga)
        .mockReturnValueOnce({ ...mockManga, bookMark: 50, completed: true });

      (mockStorage.saveManga as jest.Mock).mockReturnValue(10);

      const result = await handlers['manga:set-bookmark']({}, 10, 50);

      expect(mockStorage.saveManga).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 10,
          bookMark: 50,
          completed: true
        })
      );
      expect(result.completed).toBe(true);
    });

    it('deve retornar null se o manga nao for encontrado', async () => {
      (mockStorage.findMangaById as jest.Mock).mockReturnValue(null);

      const result = await handlers['manga:set-bookmark']({}, 999, 10);
      expect(result).toBeNull();
    });
  });

  describe('manga:toggle-favorite handler', () => {
    it('deve alternar o status de favorito', async () => {
      const mockManga = {
        id: 5,
        title: 'Manga Favorito',
        favorite: false
      };

      (mockStorage.findMangaById as jest.Mock)
        .mockReturnValueOnce(mockManga)
        .mockReturnValueOnce({ ...mockManga, favorite: true });

      (mockStorage.saveManga as jest.Mock).mockReturnValue(5);

      const result = await handlers['manga:toggle-favorite']({}, 5);

      expect(mockStorage.saveManga).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 5,
          favorite: true
        })
      );
      expect(result.favorite).toBe(true);
    });
  });

  describe('manga:delete-annotation handler', () => {
    it('deve delegar a remocao de anotacao para o storage', async () => {
      (mockStorage.deleteMangaAnnotation as jest.Mock).mockReturnValue(true);

      const result = await handlers['manga:delete-annotation']({}, 12);
      expect(mockStorage.deleteMangaAnnotation).toHaveBeenCalledWith(12);
      expect(result).toBe(true);
    });

    it('deve retornar false se id for 0 ou invalido', async () => {
      const result = await handlers['manga:delete-annotation']({}, 0);
      expect(result).toBe(false);
    });
  });
});
