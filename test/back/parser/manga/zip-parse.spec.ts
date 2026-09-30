import { ZipParse } from '../../../../app/parser/manga/zip-parse';
import AdmZip from 'adm-zip';

jest.mock('adm-zip');

describe('ZipParse (Backend Manga CBZ/ZIP Parser)', () => {
  let parser: ZipParse;
  let mockAdmZipInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    parser = new ZipParse();

    const mockEntries: any[] = [
      {
        entryName: 'Volume 01/cover_front.jpg',
        isDirectory: false
      },
      {
        entryName: 'Volume 01/page_02.png',
        isDirectory: false
      },
      {
        entryName: 'Volume 01/page_01.png',
        isDirectory: false
      },
      {
        entryName: 'Volume 01/subtitles.json',
        isDirectory: false
      },
      {
        entryName: 'ComicInfo.xml',
        isDirectory: false
      },
      {
        entryName: 'Volume 01/',
        isDirectory: true
      }
    ];

    mockAdmZipInstance = {
      getEntries: jest.fn().mockReturnValue(mockEntries),
      readFile: jest.fn().mockImplementation((entry: any) => Buffer.from(`data_${entry.entryName}`)),
      readAsText: jest.fn().mockImplementation((entry: any) => {
        if (entry.entryName === 'ComicInfo.xml') {
          return '<ComicInfo><Title>Manga Zip Teste</Title><PageCount>2</PageCount></ComicInfo>';
        }
        if (entry.entryName.endsWith('.json')) {
          return JSON.stringify({ 1: 'Legenda Pagina 1' });
        }
        return '';
      })
    };

    (AdmZip as unknown as jest.Mock).mockImplementation(() => mockAdmZipInstance);
  });

  afterEach(() => {
    parser.destroy();
  });

  it('deve realizar parse do arquivo zip filtrando e ordenando paginas naturalmente', () => {
    parser.parse('/caminho/manga.cbz');

    expect(AdmZip).toHaveBeenCalledWith('/caminho/manga.cbz');
    expect(parser.numPages()).toBe(3); // cover_front, page_01, page_02
    expect(parser.getPagePath(0)).toBe('Volume 01/cover_front.jpg');
    expect(parser.getPagePath(1)).toBe('Volume 01/page_01.png');
    expect(parser.getPagePath(2)).toBe('Volume 01/page_02.png');
  });

  it('deve extrair dados de ComicInfo.xml corretamente', () => {
    parser.parse('/caminho/manga.cbz');

    expect(parser.isComicInfo()).toBe(true);
    const comicInfo = parser.getComicInfo();
    expect(comicInfo).not.toBeNull();
    expect(comicInfo?.title).toBe('Manga Zip Teste');
    expect(comicInfo?.pageCount).toBe(2);
  });

  it('deve extrair legendas/subtitles json corretamente', () => {
    parser.parse('/caminho/manga.cbz');

    expect(parser.hasSubtitles()).toBe(true);
    const subs = parser.getSubtitles();
    expect(subs.length).toBe(1);
    expect(subs[0]).toContain('Legenda Pagina 1');

    const names = parser.getSubtitlesNames();
    expect(names['subtitles.json']).toBe(0);
  });

  it('deve obter buffer da pagina e capa', () => {
    parser.parse('/caminho/manga.cbz');

    const pageBuffer = parser.getPage(0);
    expect(pageBuffer).not.toBeNull();
    expect(pageBuffer?.toString()).toContain('data_Volume 01/cover_front.jpg');

    const cover = parser.getCover();
    expect(cover.front).not.toBeNull();
  });

  it('deve limpar referencias ao chamar destroy', () => {
    parser.parse('/caminho/manga.cbz');
    expect(parser.numPages()).toBe(3);

    parser.destroy();
    expect(parser.numPages()).toBe(0);
    expect(parser.getPage(0)).toBeNull();
    expect(parser.getComicInfo()).toBeNull();
  });
});
