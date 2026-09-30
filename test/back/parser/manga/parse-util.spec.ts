import { ParseUtil } from '../../../../app/parser/manga/parse-util';
import { ComicInfo } from '../../../../src/app/core/models/entities/comic-info.model';

describe('ParseUtil (Backend Parser)', () => {
  describe('isImage', () => {
    it('deve retornar true para extensoes de imagem suportadas', () => {
      expect(ParseUtil.isImage('page01.jpg')).toBe(true);
      expect(ParseUtil.isImage('page02.JPEG')).toBe(true);
      expect(ParseUtil.isImage('image.png')).toBe(true);
      expect(ParseUtil.isImage('cover.webp')).toBe(true);
      expect(ParseUtil.isImage('anim.gif')).toBe(true);
      expect(ParseUtil.isImage('photo.bmp')).toBe(true);
      expect(ParseUtil.isImage('photo.avif')).toBe(true);
    });

    it('deve retornar false para extensoes nao suportadas ou outros tipos', () => {
      expect(ParseUtil.isImage('document.pdf')).toBe(false);
      expect(ParseUtil.isImage('data.json')).toBe(false);
      expect(ParseUtil.isImage('comic.cbz')).toBe(false);
      expect(ParseUtil.isImage('archive.zip')).toBe(false);
      expect(ParseUtil.isImage('')).toBe(false);
    });
  });

  describe('isJson / isXml', () => {
    it('deve identificar arquivos JSON corretamente', () => {
      expect(ParseUtil.isJson('info.json')).toBe(true);
      expect(ParseUtil.isJson('INFO.JSON')).toBe(true);
      expect(ParseUtil.isJson('info.xml')).toBe(false);
    });

    it('deve identificar arquivos XML corretamente', () => {
      expect(ParseUtil.isXml('ComicInfo.xml')).toBe(true);
      expect(ParseUtil.isXml('COMICINFO.XML')).toBe(true);
      expect(ParseUtil.isXml('info.json')).toBe(false);
    });
  });

  describe('getNameFromPath e getFolderFromPath', () => {
    it('deve extrair o nome do arquivo a partir de um caminho', () => {
      expect(ParseUtil.getNameFromPath('/mangas/volume1/capitulo1.cbz')).toBe('capitulo1.cbz');
    });

    it('deve extrair a pasta a partir de um caminho', () => {
      const folder = ParseUtil.getFolderFromPath('/mangas/volume1/capitulo1.cbz');
      expect(folder).toContain('volume1');
    });

    it('deve retornar string vazia se o arquivo estiver no diretorio atual sem subpasta', () => {
      expect(ParseUtil.getFolderFromPath('arquivo.cbz')).toBe('');
    });
  });

  describe('naturalSort', () => {
    it('deve ordenar nomes de paginas com logica numerica natural', () => {
      const list = ['page10.jpg', 'page2.jpg', 'page1.jpg', 'page20.jpg', 'page3.jpg'];
      list.sort(ParseUtil.naturalSort);
      expect(list).toEqual(['page1.jpg', 'page2.jpg', 'page3.jpg', 'page10.jpg', 'page20.jpg']);
    });
  });

  describe('buildChaptersPagesFromComicInfo', () => {
    it('deve retornar dicionario de marcadores/capitulos com base nas paginas', () => {
      const mockComicInfo: ComicInfo = {
        id: 1,
        title: 'Manga Teste',
        pages: [
          { imageIndex: 0, bookmark: 'Capa' },
          { imageIndex: 1 },
          { imageIndex: 2, bookmark: 'Capítulo 1: O Início' }
        ]
      };

      const result = ParseUtil.buildChaptersPagesFromComicInfo(mockComicInfo);
      expect(result).toEqual({
        0: 'Capa',
        2: 'Capítulo 1: O Início'
      });
    });

    it('deve retornar objeto vazio se comicInfo for nulo ou sem paginas', () => {
      expect(ParseUtil.buildChaptersPagesFromComicInfo(null)).toEqual({});
      expect(ParseUtil.buildChaptersPagesFromComicInfo({ id: 1, title: 'Sem paginas' })).toEqual({});
    });
  });

  describe('parseComicInfoXml', () => {
    it('deve fazer o parse de tags basicas e paginas de ComicInfo.xml', () => {
      const xml = `
        <ComicInfo>
          <Title>O Inicio</Title>
          <Series>Super Serie</Series>
          <Number>1</Number>
          <Writer>Autor Exemplo</Writer>
          <PageCount>3</PageCount>
          <Pages>
            <Page Image="0" Bookmark="Capa" Type="FrontCover" />
            <Page Image="1" />
            <Page Image="2" Bookmark="Capítulo 1" />
          </Pages>
        </ComicInfo>
      `;

      const result = ParseUtil.parseComicInfoXml(xml);
      expect(result).not.toBeNull();
      expect(result?.title).toBe('O Inicio');
      expect(result?.series).toBe('Super Serie');
      expect(result?.number).toBe('1');
      expect(result?.writer).toBe('Autor Exemplo');
      expect(result?.pageCount).toBe(3);
      expect(result?.pages?.length).toBe(3);
      expect(result?.pages?.[0].bookmark).toBe('Capa');
      expect(result?.pages?.[0].type).toBe('FrontCover');
      expect(result?.pages?.[2].bookmark).toBe('Capítulo 1');
    });

    it('deve retornar objeto mesmo se houver tags ausentes', () => {
      const xml = '<ComicInfo><Title>Apenas Titulo</Title></ComicInfo>';
      const result = ParseUtil.parseComicInfoXml(xml);
      expect(result?.title).toBe('Apenas Titulo');
      expect(result?.series).toBe('');
      expect(result?.pages).toEqual([]);
    });
  });
});
