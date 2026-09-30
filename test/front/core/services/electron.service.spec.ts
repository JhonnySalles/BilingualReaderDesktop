import { TestBed } from '@angular/core/testing';
import { ElectronService } from '../../../../src/app/core/services/electron.service';

describe('ElectronService (Frontend Angular)', () => {
  let service: ElectronService;
  let originalElectronAPI: any;

  beforeEach(() => {
    originalElectronAPI = (window as any).electronAPI;
    TestBed.configureTestingModule({
      providers: [ElectronService]
    });
  });

  afterEach(() => {
    (window as any).electronAPI = originalElectronAPI;
  });

  it('deve ser instanciado com sucesso', () => {
    service = TestBed.inject(ElectronService);
    expect(service).toBeTruthy();
  });

  describe('Quando executado com window.electronAPI presente', () => {
    let mockApi: any;

    beforeEach(() => {
      mockApi = {
        ping: jasmine.createSpy('ping').and.resolveTo('pong-ipc'),
        getSetting: jasmine.createSpy('getSetting').and.resolveTo('tema-escuro'),
        setSetting: jasmine.createSpy('setSetting').and.resolveTo(true),
        telemetryIsEnabled: jasmine.createSpy('telemetryIsEnabled').and.resolveTo(true),
        telemetryRecord: jasmine.createSpy('telemetryRecord').and.resolveTo(true),
        telemetrySetKey: jasmine.createSpy('telemetrySetKey').and.resolveTo(true),
        selectDirectory: jasmine.createSpy('selectDirectory').and.resolveTo('/path/dir'),
        checkPathOnline: jasmine.createSpy('checkPathOnline').and.resolveTo(true),
        listMangas: jasmine.createSpy('listMangas').and.resolveTo([{ id: 1, title: 'Manga 1' }]),
        getManga: jasmine.createSpy('getManga').and.resolveTo({ id: 1, title: 'Manga 1' }),
        listBooks: jasmine.createSpy('listBooks').and.resolveTo([{ id: 1, title: 'Book 1' }]),
        getBook: jasmine.createSpy('getBook').and.resolveTo({ id: 1, title: 'Book 1' }),
        getLibraryCount: jasmine.createSpy('getLibraryCount').and.resolveTo(5),
        cancelMangaScan: jasmine.createSpy('cancelMangaScan').and.resolveTo(true),
        cancelBookScan: jasmine.createSpy('cancelBookScan').and.resolveTo(true),
        cancelAllScans: jasmine.createSpy('cancelAllScans').and.resolveTo(true),
        send: jasmine.createSpy('send'),
        on: jasmine.createSpy('on').and.returnValue(() => {})
      };

      (window as any).electronAPI = mockApi;
      service = TestBed.inject(ElectronService);
    });

    it('isElectron deve retornar true', () => {
      expect(service.isElectron).toBeTrue();
    });

    it('ping deve chamar window.electronAPI.ping e retornar a resposta', async () => {
      const res = await service.ping();
      expect(mockApi.ping).toHaveBeenCalled();
      expect(res).toBe('pong-ipc');
    });

    it('getSetting e setSetting devem chamar a API correspondente', async () => {
      const getVal = await service.getSetting('theme', 'default');
      expect(mockApi.getSetting).toHaveBeenCalledWith('theme', 'default');
      expect(getVal).toBe('tema-escuro');

      const setVal = await service.setSetting('theme', 'dark');
      expect(mockApi.setSetting).toHaveBeenCalledWith('theme', 'dark');
      expect(setVal).toBe(true);
    });

    it('listMangas e getManga devem delegar para a API do Electron', async () => {
      const mangas = await service.listMangas('/caminho');
      expect(mockApi.listMangas).toHaveBeenCalledWith('/caminho');
      expect(mangas.length).toBe(1);

      const manga = await service.getManga(1);
      expect(mockApi.getManga).toHaveBeenCalledWith(1);
      expect(manga?.title).toBe('Manga 1');
    });

    it('telemetryRecord deve chamar telemetryRecord com formato correto de erro', async () => {
      const error = new Error('Falha de teste');
      await service.telemetryRecord(error, 'Contexto adicional');

      expect(mockApi.telemetryRecord).toHaveBeenCalledWith({
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        message: 'Contexto adicional'
      });
    });

    it('cancelAllScans, cancelMangaScan e cancelBookScan devem invocar electronAPI', async () => {
      expect(await service.cancelMangaScan()).toBeTrue();
      expect(mockApi.cancelMangaScan).toHaveBeenCalled();

      expect(await service.cancelBookScan()).toBeTrue();
      expect(mockApi.cancelBookScan).toHaveBeenCalled();

      expect(await service.cancelAllScans()).toBeTrue();
      expect(mockApi.cancelAllScans).toHaveBeenCalled();
    });
  });

  describe('Fallback no Navegador quando window.electronAPI está ausente ou incompleto', () => {
    beforeEach(() => {
      delete (window as any).electronAPI;
      service = new ElectronService();
    });

    it('deve inicializar mock em window.electronAPI quando rodando em browser sem API', () => {
      expect((window as any).electronAPI).toBeDefined();
    });

    it('ping do mock browser deve retornar mensagem mock', async () => {
      const res = await (window as any).electronAPI.ping();
      expect(res).toContain('mock');
    });

    it('getSetting no fallback deve retornar o valor padrao fornecido', async () => {
      const val = await service.getSetting('chave_inexistente', 'valor_default');
      expect(val).toBe('valor_default');
    });
  });
});
