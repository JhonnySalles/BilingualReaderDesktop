import * as fs from 'fs';
import * as path from 'path';
import { EbookConverterAdapter, EbookConversionError } from '../types';

const EXTS = new Set(['.epub', '.kepub', '.epub3']);

export class PassthroughAdapter implements EbookConverterAdapter {
  readonly id = 'passthrough' as const;
  readonly label = 'EPUB nativo';
  readonly priority = 100;

  isAvailable(): boolean {
    return true;
  }

  canHandle(ext: string): boolean {
    return EXTS.has(ext.toLowerCase());
  }

  async convert(inputPath: string, outputEpubPath: string): Promise<void> {
    if (!fs.existsSync(inputPath)) {
      throw new EbookConversionError(`Arquivo não encontrado: ${inputPath}`, 'not_found');
    }
    if (path.resolve(inputPath) === path.resolve(outputEpubPath)) {
      return;
    }
    const dir = path.dirname(outputEpubPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(inputPath, outputEpubPath);
  }
}
