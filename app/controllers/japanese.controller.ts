import { ipcMain } from 'electron';
import { JapaneseTokenizerService } from '../services/japanese-tokenizer.service';

export class JapaneseController {
  private tokenizer = JapaneseTokenizerService.getInstance();

  registerIpcHandlers(): void {
    ipcMain.handle('japanese:init', async () => {
      return this.tokenizer.init();
    });

    ipcMain.handle('japanese:toRubyHtml', async (_event, text: string, withFurigana = true) => {
      if (typeof text !== 'string' || !text) return '';
      return this.tokenizer.toRubyHtml(text, withFurigana !== false);
    });

    ipcMain.handle('japanese:tokenize', async (_event, text: string) => {
      if (typeof text !== 'string' || !text) return [];
      return this.tokenizer.tokenize(text);
    });

    ipcMain.handle('japanese:engine', async () => {
      await this.tokenizer.init();
      return this.tokenizer.getEngine();
    });
  }
}
