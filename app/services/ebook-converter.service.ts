import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getAppCacheDir } from '../utils/app-paths';
import { EbookConvertFactory } from './ebook-convert/ebook-convert.factory';
import {
  AdapterStatus,
  DEFAULT_EBOOK_CONVERT_MODE,
  EBOOK_CONVERT_MODE_KEY,
  EbookConversionError,
  EbookConvertMode,
  normalizeEbookConvertMode,
  normalizeExt
} from './ebook-convert/types';
import { SettingsService } from './settings.service';

export { EbookConversionError } from './ebook-convert/types';
export type { AdapterStatus, EbookConvertMode } from './ebook-convert/types';
export { EBOOK_CONVERT_MODE_KEY, DEFAULT_EBOOK_CONVERT_MODE } from './ebook-convert/types';

/** @deprecated Prefer getAdapterStatuses(); kept for Settings/IPC compatibility. */
export interface ConverterToolsStatus {
  pandoc: string | null;
  calibre: string | null;
}

/**
 * Public facade: cache + hash + convertToEpub, delegates to EbookConvertFactory.
 */
export class EBookConverterService {
  private static _instance: EBookConverterService;
  private factory = new EbookConvertFactory();

  public static get instance(): EBookConverterService {
    if (!this._instance) {
      this._instance = new EBookConverterService();
    }
    return this._instance;
  }

  private getCacheDir(): string {
    const cacheDir = path.join(getAppCacheDir(), 'convert');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    return cacheDir;
  }

  public getConvertMode(): EbookConvertMode {
    try {
      const raw = SettingsService.instance.get<string>(
        EBOOK_CONVERT_MODE_KEY,
        DEFAULT_EBOOK_CONVERT_MODE
      );
      return normalizeEbookConvertMode(raw);
    } catch {
      return DEFAULT_EBOOK_CONVERT_MODE;
    }
  }

  public generateHash(
    inputPath: string,
    mtimeMs: number,
    size: number,
    mode: EbookConvertMode = DEFAULT_EBOOK_CONVERT_MODE
  ): string {
    return crypto
      .createHash('md5')
      .update(`${inputPath}|${mtimeMs}|${size}|${mode}`)
      .digest('hex');
  }

  public clearToolsCache(): void {
    this.factory.clearCliCaches();
  }

  /** Legacy shape for IPC consumers that still expect pandoc/calibre paths. */
  public getToolsStatus(): ConverterToolsStatus {
    const statuses = this.factory.getAdapterStatuses();
    const pandoc = statuses.find(s => s.id === 'pandoc');
    const calibre = statuses.find(s => s.id === 'calibre');
    return {
      pandoc: pandoc?.detail && pandoc.available ? pandoc.detail : null,
      calibre: calibre?.detail && calibre.available ? calibre.detail : null
    };
  }

  public getAdapterStatuses(): AdapterStatus[] {
    return this.factory.getAdapterStatuses();
  }

  /**
   * Converts a book file into EPUB via the adapter factory.
   * Native EPUB/KEPUB/EPUB3 are returned unchanged (no cache copy).
   */
  public async convertToEpub(inputPath: string): Promise<string> {
    if (!fs.existsSync(inputPath)) {
      throw new EbookConversionError(`Arquivo não encontrado: ${inputPath}`, 'not_found');
    }

    const ext = normalizeExt(inputPath);
    if (ext === '.epub' || ext === '.kepub' || ext === '.epub3') {
      return inputPath;
    }

    const mode = this.getConvertMode();
    const stat = fs.statSync(inputPath);
    const hash = this.generateHash(inputPath, stat.mtimeMs, stat.size, mode);
    const cacheDir = this.getCacheDir();
    const outputPath = path.join(cacheDir, `${hash}.epub`);

    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
      return outputPath;
    }

    this.pruneLegacyCache(inputPath, hash);

    await this.factory.convert(inputPath, outputPath, mode);

    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
      throw new EbookConversionError(
        `Falha ao converter para EPUB: ${path.basename(inputPath)}`,
        'conversion_failed'
      );
    }
    return outputPath;
  }

  private pruneLegacyCache(inputPath: string, currentHash: string): void {
    try {
      const legacy = crypto.createHash('md5').update(inputPath).digest('hex');
      if (legacy === currentHash) return;
      const legacyPath = path.join(this.getCacheDir(), `${legacy}.epub`);
      if (fs.existsSync(legacyPath)) {
        fs.unlinkSync(legacyPath);
      }
    } catch {
      /* ignore */
    }
  }
}
