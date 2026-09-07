import { ipcMain } from 'electron';
import { EdgeTtsService, TtsSynthesizeRequest } from '../services/tts/edge-tts.service';

export class TtsController {
  private service = new EdgeTtsService();

  registerIpcHandlers(): void {
    ipcMain.handle('tts:synthesize', async (_event, req: TtsSynthesizeRequest) => {
      return await this.service.synthesize(req || { text: '', voice: '' });
    });

    ipcMain.handle('tts:prefetch', async (_event, items: TtsSynthesizeRequest[]) => {
      return await this.service.prefetch(items || []);
    });

    ipcMain.handle('tts:clear-cache', async () => {
      return this.service.clearCache();
    });
  }
}
