import { ipcMain } from 'electron';
import { OcrRouter } from '../services/ocr/ocr-router';
import { MangaReaderSessionService } from '../services/manga-reader-session.service';
import { OcrEnginePref } from '../services/ocr/ocr.types';

export class OcrController {
  private router = new OcrRouter();

  constructor(private sessions: MangaReaderSessionService) {}

  registerIpcHandlers(): void {
    ipcMain.handle('ocr:windowsAvailable', async () => {
      return this.router.windowsAvailable();
    });

    ipcMain.handle(
      'ocr:recognize',
      async (
        _event,
        payload: {
          sessionId: string;
          pageIndex?: number;
          dataUrl?: string;
          lang: string;
          mode: 'region' | 'page';
          engine?: OcrEnginePref;
        }
      ) => {
        let imagePath: string | undefined;
        if (!payload.dataUrl && payload.sessionId != null && payload.pageIndex != null) {
          imagePath =
            this.sessions.resolvePageAbsolutePath(payload.sessionId, payload.pageIndex) ||
            undefined;
        }
        return this.router.recognize({
          imagePath,
          dataUrl: payload.dataUrl,
          lang: payload.lang || 'jpn',
          mode: payload.mode || 'page',
          engine: payload.engine || 'auto'
        });
      }
    );
  }
}
