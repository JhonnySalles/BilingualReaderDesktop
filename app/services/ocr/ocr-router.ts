import { TesseractOcrProvider } from './tesseract-ocr.provider';
import { WindowsOcrProvider } from './windows-ocr.provider';
import { OcrEnginePref, OcrRecognizeInput, OcrResult } from './ocr.types';

export class OcrRouter {
  private tesseract = new TesseractOcrProvider();
  private windows = new WindowsOcrProvider();

  async recognize(input: OcrRecognizeInput): Promise<OcrResult> {
    const pref: OcrEnginePref = input.engine || 'auto';

    if (pref === 'tesseract') {
      return this.tesseract.recognize(input);
    }

    if (pref === 'windows') {
      if (await this.windows.isAvailable()) {
        try {
          return await this.windows.recognize(input);
        } catch (e) {
          console.warn('[OcrRouter] Windows OCR failed, falling back to Tesseract', e);
        }
      }
      return this.tesseract.recognize(input);
    }

    // auto: prefer Windows for full page when available; region stays tesseract-friendly
    if (input.mode === 'page' && (await this.windows.isAvailable())) {
      try {
        return await this.windows.recognize(input);
      } catch (e) {
        console.warn('[OcrRouter] Windows OCR failed, falling back to Tesseract', e);
      }
    }
    return this.tesseract.recognize(input);
  }

  async windowsAvailable(): Promise<boolean> {
    return this.windows.isAvailable();
  }
}
