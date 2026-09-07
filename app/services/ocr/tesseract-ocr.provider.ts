import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { createWorker, Worker } from 'tesseract.js';
import { GeneralConsts } from '../../utils/constants';
import { OcrBlock, OcrProvider, OcrRecognizeInput, OcrResult } from './ocr.types';

const LANGS = new Set(['eng', 'por', 'jpn', 'jpn_vert']);

/**
 * Tesseract.js OCR with tessdata under userData/cache/Tesseract/tessdata
 * (Android CACHE_FOLDER.TESSERACT parity). Bundled packs live in app/assets/tessdata.
 */
export class TesseractOcrProvider implements OcrProvider {
  readonly id = 'tesseract' as const;
  private worker: Worker | null = null;
  private workerLang: string | null = null;
  private readyPromise: Promise<void> | null = null;

  async isAvailable(): Promise<boolean> {
    try {
      this.ensureTessdata();
      return true;
    } catch {
      return false;
    }
  }

  async recognize(input: OcrRecognizeInput): Promise<OcrResult> {
    const lang = LANGS.has(input.lang) ? input.lang : 'jpn';
    await this.ensureWorker(lang);

    const source = input.dataUrl || input.imagePath;
    if (!source) {
      throw new Error('Imagem OCR não informada');
    }

    const result = await this.worker!.recognize(source);
    const blocks: OcrBlock[] = [];
    const words = (result.data as any).words as Array<{
      text: string;
      bbox: { x0: number; y0: number; x1: number; y1: number };
    }> | undefined;

    if (Array.isArray(words)) {
      for (const w of words) {
        const text = (w.text || '').trim();
        if (!text) continue;
        blocks.push({
          text,
          x: w.bbox.x0,
          y: w.bbox.y0,
          width: Math.max(1, w.bbox.x1 - w.bbox.x0),
          height: Math.max(1, w.bbox.y1 - w.bbox.y0)
        });
      }
    }

    return {
      fullText: (result.data.text || '').replace(/\n+/g, ' ').trim(),
      blocks,
      engine: 'tesseract'
    };
  }

  async dispose(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.workerLang = null;
    }
  }

  private tessdataDir(): string {
    return path.join(
      app.getPath('userData'),
      'cache',
      GeneralConsts.CACHE_FOLDER.TESSERACT,
      'tessdata'
    );
  }

  private bundledTessdataDir(): string {
    const candidates = [
      path.join(app.getAppPath(), 'app/assets/tessdata'),
      path.join(__dirname, '../../assets/tessdata'),
      path.join(process.resourcesPath || '', 'tessdata'),
      path.join(app.getAppPath(), 'assets/tessdata')
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return candidates[0];
  }

  private ensureTessdata(): void {
    const dest = this.tessdataDir();
    fs.mkdirSync(dest, { recursive: true });
    const src = this.bundledTessdataDir();
    for (const lang of LANGS) {
      const name = `${lang}.traineddata`;
      const from = path.join(src, name);
      const to = path.join(dest, name);
      const best = path.join(dest, `${lang}.traineddata.best`);
      // Prefer manually dropped tessdata_best if present
      if (fs.existsSync(best) && !fs.existsSync(to)) {
        fs.copyFileSync(best, to);
        continue;
      }
      if (!fs.existsSync(to) && fs.existsSync(from)) {
        fs.copyFileSync(from, to);
      }
    }
  }

  private async ensureWorker(lang: string): Promise<void> {
    this.ensureTessdata();
    if (this.worker && this.workerLang === lang) return;

    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }

    const langPath = this.tessdataDir();
    this.worker = await createWorker(lang, 1, {
      langPath,
      gzip: false,
      cachePath: langPath,
      cacheMethod: 'none'
    });
    this.workerLang = lang;
  }
}
