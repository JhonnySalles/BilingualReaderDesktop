import { BrowserWindow, ipcMain } from 'electron';
import { StorageService } from '../database/storage.service';
import { MangaReaderSessionService } from '../services/manga-reader-session.service';
import {
  AssistantAskInput,
  ReadingAssistantService
} from '../services/llm/reading-assistant.service';
import { AssistantContentType } from '../database/assistant-history.repository';

export class AssistantController {
  private service: ReadingAssistantService;

  constructor(
    storage: StorageService,
    private getMainWindow: () => BrowserWindow | null,
    mangaSessions?: MangaReaderSessionService
  ) {
    this.service = new ReadingAssistantService(storage, mangaSessions);
  }

  registerIpcHandlers(): void {
    ipcMain.handle('assistant:status', async () => {
      const ready = this.service.isReady();
      return {
        enabled: this.service.isEnabled(),
        hasApiKey: !!this.service.resolveApiKey(),
        provider: ready.provider,
        ready: ready.ready,
        readyReason: ready.reason || null,
        maxContextChars: this.service.getMaxContextChars(),
        maxHistoryChars: this.service.getMaxHistoryChars()
      };
    });

    ipcMain.handle(
      'assistant:history:list',
      async (_e, referenceId: number, type: AssistantContentType) => {
        return this.service.listHistory(Number(referenceId) || 0, type === 'MANGA' ? 'MANGA' : 'BOOK');
      }
    );

    ipcMain.handle(
      'assistant:history:clear',
      async (_e, referenceId: number, type: AssistantContentType) => {
        return this.service.clearHistory(Number(referenceId) || 0, type === 'MANGA' ? 'MANGA' : 'BOOK');
      }
    );

    ipcMain.handle(
      'assistant:selection:get',
      async (_e, type: AssistantContentType, referenceId: number) => {
        return this.service.getSelection(type === 'MANGA' ? 'MANGA' : 'BOOK', Number(referenceId) || 0);
      }
    );

    ipcMain.handle(
      'assistant:selection:set',
      async (_e, type: AssistantContentType, referenceId: number, value: string) => {
        this.service.setSelection(
          type === 'MANGA' ? 'MANGA' : 'BOOK',
          Number(referenceId) || 0,
          String(value || '')
        );
        return true;
      }
    );

    ipcMain.handle('assistant:models', async (_e, provider?: string) => {
      try {
        return { ok: true as const, models: await this.service.listModels(provider) };
      } catch (e: any) {
        return { ok: false as const, models: [], error: e?.message || String(e) };
      }
    });

    ipcMain.handle(
      'assistant:page-images',
      async (_e, sessionId: string, pages: number[]) => {
        return this.service.encodeMangaPageImages(String(sessionId || ''), Array.isArray(pages) ? pages : []);
      }
    );

    ipcMain.handle('assistant:cancel', async (_e, requestId: string) => {
      return this.service.cancel(String(requestId || ''));
    });

    ipcMain.handle('assistant:ask', async (_e, payload: AssistantAskInput) => {
      const requestId = String(payload?.requestId || `ask-${Date.now()}`);
      const win = this.getMainWindow();
      const result = await this.service.ask(
        { ...payload, requestId },
        delta => {
          try {
            win?.webContents.send('assistant:chunk', { requestId, delta });
          } catch {
            /* ignore */
          }
        }
      );
      try {
        win?.webContents.send('assistant:done', { requestId, ...result });
      } catch {
        /* ignore */
      }
      return { requestId, ...result };
    });
  }
}
