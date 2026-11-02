import * as fs from 'fs';
import * as path from 'path';
import { EbookConverterAdapter, EbookConversionError } from '../types';
import { calibreCandidatePaths, findExecutable, spawnCommand } from '../cli-utils';

/** Broad Calibre coverage — used as low-priority fallback for most ebook formats. */
const EXTS = new Set([
  '.mobi',
  '.azw',
  '.azw3',
  '.azw4',
  '.pdb',
  '.prc',
  '.fb2',
  '.pdf',
  '.djvu',
  '.xps',
  '.htmlz',
  '.txtz',
  '.rb',
  '.pmlz',
  '.doc',
  '.docx',
  '.odt',
  '.rtf',
  '.txt',
  '.html',
  '.htm',
  '.xhtml',
  '.md',
  '.markdown',
  '.lit',
  '.lrf',
  '.snb',
  '.tcr'
]);

export class CalibreCliAdapter implements EbookConverterAdapter {
  readonly id = 'calibre' as const;
  readonly label = 'Calibre';
  readonly priority = 20;
  private cachedPath: string | null | undefined;

  isAvailable(): boolean {
    return !!this.resolveBin();
  }

  canHandle(ext: string): boolean {
    return EXTS.has(ext.toLowerCase());
  }

  getBinaryPath(): string | null {
    return this.resolveBin();
  }

  clearCache(): void {
    this.cachedPath = undefined;
  }

  async convert(inputPath: string, outputEpubPath: string): Promise<void> {
    const bin = this.resolveBin();
    if (!bin) {
      throw new EbookConversionError('Calibre (ebook-convert) não encontrado', 'missing_tools');
    }
    if (fs.existsSync(outputEpubPath)) {
      try {
        fs.unlinkSync(outputEpubPath);
      } catch {
        /* ignore */
      }
    }
    const ext = path.extname(inputPath).toLowerCase();
    const base = path.basename(inputPath, ext);
    const args = [inputPath, outputEpubPath, '--title', base];
    await spawnCommand(bin, args);
  }

  private resolveBin(): string | null {
    if (this.cachedPath !== undefined) return this.cachedPath;
    this.cachedPath = findExecutable('ebook-convert', calibreCandidatePaths());
    return this.cachedPath;
  }
}
