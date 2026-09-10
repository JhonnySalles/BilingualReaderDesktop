import * as fs from 'fs';
import { EbookConverterAdapter, EbookConversionError } from '../types';
import { findExecutable, spawnCommand } from '../cli-utils';

const EXTS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.html',
  '.htm',
  '.xhtml',
  '.xhtm',
  '.mht',
  '.mhtml',
  '.shtml',
  '.docx',
  '.odt',
  '.rtf'
]);

export class PandocCliAdapter implements EbookConverterAdapter {
  readonly id = 'pandoc' as const;
  readonly label = 'Pandoc';
  readonly priority = 40;
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
      throw new EbookConversionError('Pandoc não encontrado', 'missing_tools');
    }
    if (fs.existsSync(outputEpubPath)) {
      try {
        fs.unlinkSync(outputEpubPath);
      } catch {
        /* ignore */
      }
    }
    await spawnCommand(bin, [inputPath, '-o', outputEpubPath]);
  }

  private resolveBin(): string | null {
    if (this.cachedPath !== undefined) return this.cachedPath;
    this.cachedPath = findExecutable('pandoc', []);
    return this.cachedPath;
  }
}
