import { Util, FileUtil } from '../../../app/utils/helpers';
import { FileType } from '../../../src/app/core/models/enums/app-enums';

describe('Helpers Util & FileUtil (Backend Electron)', () => {
  describe('Util', () => {
    it('deve gerar hash MD5 consistente', () => {
      const hash1 = Util.MD5('teste123');
      const hash2 = Util.MD5('teste123');
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(32);
    });

    it('deve extrair nome do arquivo a partir de um path', () => {
      expect(Util.getNameFromPath('/caminho/para/meu-livro.epub')).toBe('meu-livro.epub');
      expect(Util.getNameFromPath('C:\\Users\\Livros\\manga.cbz')).toBe('manga.cbz');
      expect(Util.getNameFromPath('')).toBe('');
    });

    it('deve extrair nome sem extensao', () => {
      expect(Util.getNameWithoutExtensionFromPath('/livros/one-piece-vol-01.cbz')).toBe('one-piece-vol-01');
      expect(Util.getNameWithoutExtensionFromPath('documento')).toBe('documento');
    });

    it('deve extrair a extensao corretamente', () => {
      expect(Util.getExtensionFromPath('livro.epub')).toBe('epub');
      expect(Util.getExtensionFromPath('arquivo.tar.gz')).toBe('gz');
      expect(Util.getExtensionFromPath('')).toBe('');
    });

    it('deve identificar numero do capitulo a partir do caminho', () => {
      expect(Util.getChapterFromPath('/manga/One Piece/Capitulo 1050')).toBe(1050);
      expect(Util.getChapterFromPath('/manga/Bleach/Capítulo 12.5')).toBe(12.5);
      expect(Util.getChapterFromPath('/manga/Naruto/SemCapitulo')).toBe(-1);
    });

    it('deve formatar ordenacao numerica com zero a esquerda', () => {
      const normalized = Util.getNormalizedNameOrdering('pagina_5.jpg');
      expect(normalized).toBe('pagina_0000000005.jpg');
    });
  });

  describe('FileUtil', () => {
    it('deve classificar extensoes de imagem suportadas', () => {
      expect(FileUtil.isImage('foto.png')).toBe(true);
      expect(FileUtil.isImage('foto.webp')).toBe(true);
      expect(FileUtil.isImage('foto.jxl')).toBe(true);
      expect(FileUtil.isImage('foto.avif')).toBe(true);
      expect(FileUtil.isImage('texto.txt')).toBe(false);
    });

    it('deve mapear corretamente o FileType de quadrinhos e ebooks', () => {
      expect(FileUtil.getFileType('livro.epub')).toBe(FileType.EPUB);
      expect(FileUtil.getFileType('manga.cbz')).toBe(FileType.CBZ);
      expect(FileUtil.getFileType('manga.cbr')).toBe(FileType.CBR);
      expect(FileUtil.getFileType('documento.pdf')).toBe(FileType.PDF);
      expect(FileUtil.getFileType('desconhecido.xyz')).toBe(FileType.UNKNOWN);
    });

    it('deve formatar tamanho de bytes para formato legivel', () => {
      expect(FileUtil.formatSize(500)).toBe('500 B');
      expect(FileUtil.formatSize(1024)).toBe('1.0 KB');
      expect(FileUtil.formatSize(1024 * 1024 * 5)).toBe('5.0 MB');
    });
  });
});
