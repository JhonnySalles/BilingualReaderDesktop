import * as path from 'path';
import * as fs from 'fs';
import { RocketBookExtractor } from '../../../../app/parser/book/rocket-book-extractor';

describe('RocketBookExtractor', () => {
  const sampleRbPath = path.resolve('teste/Livro/Teste/01-86--EIGHTY-SIX, Vol. 01.rb');

  it('deve extrair metadados e a capa correta (12.png retrato) do arquivo .rb real', () => {
    if (!fs.existsSync(sampleRbPath)) {
      console.warn('Arquivo de teste não encontrado:', sampleRbPath);
      return;
    }

    const meta = RocketBookExtractor.extractMetadata(sampleRbPath);

    expect(meta.title).toBe('86--EIGHTY-SIX, Vol. 01');
    expect(meta.author).toBe('Asato & Shirabii');
    expect(meta.coverImage).not.toBeNull();
    expect(meta.coverImage!.length).toBe(995123); // tamanho exato de 12.png (e não 530039 de 0.png)

    // Verifica que as dimensões do PNG são formato retrato (1466 x 2200)
    const w = meta.coverImage!.readUInt32BE(16);
    const h = meta.coverImage!.readUInt32BE(20);
    expect(w).toBe(1466);
    expect(h).toBe(2200);
    expect(h).toBeGreaterThan(w);
  });

  it('deve retornar título fallback e null para arquivos inexistentes ou corrompidos', () => {
    const meta = RocketBookExtractor.extractMetadata('/invalid/path/nonexistent.rb');
    expect(meta.title).toBe('nonexistent');
    expect(meta.author).toBe('');
    expect(meta.coverImage).toBeNull();
  });
});

