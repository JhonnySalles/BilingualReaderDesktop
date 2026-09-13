import { app, ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { getAppDataDir, getAppLibsDir } from '../utils/app-paths';
import { SettingsService } from '../services/settings.service';

export interface LlmCatalogModel {
  id: string;
  name: string;
  tier: 'basic' | 'intermediate' | 'advanced';
  description: string;
  filename: string;
  sizeBytes: number;
  sizeFormatted: string;
  recommendedRam: string;
  url: string;
  installed: boolean;
  installedPath: string | null;
  downloading: boolean;
  progress: number;
  downloadSpeed: string;
  downloadedBytes: number;
  totalBytes: number;
  error?: string | null;
}

export interface LlmDownloadProgressEvent {
  modelId: string;
  status: 'downloading' | 'completed' | 'cancelled' | 'error';
  progress: number;
  speed: string;
  downloadedBytes: number;
  totalBytes: number;
  error?: string | null;
}

const LLM_ACTIVE_MODEL_KEY = 'LLM_LOCAL_ACTIVE_MODEL';

export const LLM_MODELS_CATALOG: Omit<LlmCatalogModel, 'installed' | 'installedPath' | 'downloading' | 'progress' | 'downloadSpeed' | 'downloadedBytes' | 'totalBytes' | 'error'>[] = [
  {
    id: 'qwen2.5-1.5b',
    name: 'Qwen 2.5 1.5B (Básico)',
    tier: 'basic',
    description: 'Modelo ultraleve e rápido. Ideal para qualquer computador, laptops e uso sem placa de vídeo.',
    filename: 'Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    sizeBytes: 986000000,
    sizeFormatted: '~986 MB',
    recommendedRam: '4 GB',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf'
  },
  {
    id: 'llama-3.2-3b',
    name: 'Llama 3.2 3B (Intermediário)',
    tier: 'intermediate',
    description: 'Excelente equilíbrio entre velocidade e inteligência. Muito bom para resumos, perguntas e interpretações.',
    filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    sizeBytes: 2020000000,
    sizeFormatted: '~2.0 GB',
    recommendedRam: '8 GB',
    url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf'
  },
  {
    id: 'qwen2.5-7b',
    name: 'Qwen 2.5 7B (Avançado)',
    tier: 'advanced',
    description: 'Alta capacidade literária, resumos profundos e contexto amplo. Requer computador com boa memória RAM.',
    filename: 'Qwen2.5-7B-Instruct-Q4_K_M.gguf',
    sizeBytes: 4680000000,
    sizeFormatted: '~4.7 GB',
    recommendedRam: '12-16 GB',
    url: 'https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf'
  }
];

interface ActiveDownload {
  modelId: string;
  request: http.ClientRequest | null;
  fileStream: fs.WriteStream | null;
  targetPath: string;
  tempPath: string;
  downloadedBytes: number;
  totalBytes: number;
  startTime: number;
  lastSpeedCalcTime: number;
  lastDownloadedBytes: number;
  speed: string;
  cancelled: boolean;
}

export class LlmDownloaderController {
  private static _instance: LlmDownloaderController;
  private activeDownloads: Map<string, ActiveDownload> = new Map();
  private getWindowFn: (() => BrowserWindow | null) | null = null;

  public static get instance(): LlmDownloaderController {
    if (!this._instance) {
      this._instance = new LlmDownloaderController();
    }
    return this._instance;
  }

  public setWindowGetter(getter: () => BrowserWindow | null): void {
    this.getWindowFn = getter;
  }

  public getModelsDir(): string {
    const dir = path.join(getAppDataDir(), 'models');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Scans all possible directories to find if a model file exists on disk.
   */
  public findModelFile(filename: string): string | null {
    const candidateDirs = [
      this.getModelsDir(),
      path.join(getAppLibsDir(), 'llm'),
      process.resourcesPath ? path.join(process.resourcesPath, 'assets', 'llm') : null,
      process.resourcesPath ? path.join(process.resourcesPath, 'llm') : null,
      typeof app?.getAppPath === 'function' ? path.join(app.getAppPath(), 'public', 'assets', 'llm') : null,
      typeof app?.getAppPath === 'function' ? path.join(app.getAppPath(), 'app', 'assets', 'llm') : null,
      path.join(process.cwd(), 'public', 'assets', 'llm'),
      path.join(process.cwd(), 'app', 'assets', 'llm')
    ].filter(Boolean) as string[];

    for (const dir of candidateDirs) {
      const fullPath = path.join(dir, filename);
      if (fs.existsSync(fullPath)) {
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > 1000000) { // must be at least 1MB
            return fullPath;
          }
        } catch {
          // ignore
        }
      }
    }

    return null;
  }

  /**
   * Returns list of catalog models with current install/download state.
   */
  public getModelsList(): LlmCatalogModel[] {
    return LLM_MODELS_CATALOG.map((cat) => {
      const installedPath = this.findModelFile(cat.filename);
      const installed = Boolean(installedPath);
      const download = this.activeDownloads.get(cat.id);

      if (download) {
        const progress = download.totalBytes > 0
          ? Math.round((download.downloadedBytes / download.totalBytes) * 100)
          : 0;

        return {
          ...cat,
          installed,
          installedPath,
          downloading: true,
          progress,
          downloadSpeed: download.speed,
          downloadedBytes: download.downloadedBytes,
          totalBytes: download.totalBytes,
          error: null
        };
      }

      return {
        ...cat,
        installed,
        installedPath,
        downloading: false,
        progress: installed ? 100 : 0,
        downloadSpeed: '',
        downloadedBytes: 0,
        totalBytes: cat.sizeBytes,
        error: null
      };
    });
  }

  public getActiveModelId(): string {
    const saved = SettingsService.instance.get(LLM_ACTIVE_MODEL_KEY, '');
    if (saved) {
      const found = LLM_MODELS_CATALOG.find(m => m.id === saved);
      if (found && this.findModelFile(found.filename)) {
        return found.id;
      }
    }
    // Default: find the first installed model
    const list = this.getModelsList();
    const firstInstalled = list.find(m => m.installed);
    return firstInstalled ? firstInstalled.id : 'qwen2.5-1.5b';
  }

  public setActiveModelId(modelId: string): boolean {
    const found = LLM_MODELS_CATALOG.find(m => m.id === modelId);
    if (!found) return false;
    SettingsService.instance.set(LLM_ACTIVE_MODEL_KEY, modelId);
    return true;
  }

  /**
   * Resolves the path of the model file for a given modelId (or the active model).
   */
  public getActiveModelPath(modelId?: string): string | null {
    const targetId = modelId || this.getActiveModelId();
    const item = LLM_MODELS_CATALOG.find(m => m.id === targetId);
    if (item) {
      const p = this.findModelFile(item.filename);
      if (p) return p;
    }

    // Fallback: any installed model
    for (const cat of LLM_MODELS_CATALOG) {
      const p = this.findModelFile(cat.filename);
      if (p) return p;
    }

    return null;
  }

  /**
   * Starts downloading a model file in background with progress events.
   */
  public async downloadModel(modelId: string): Promise<{ ok: boolean; error?: string }> {
    if (this.activeDownloads.has(modelId)) {
      return { ok: false, error: 'O download deste modelo já está em andamento.' };
    }

    const item = LLM_MODELS_CATALOG.find(m => m.id === modelId);
    if (!item) {
      return { ok: false, error: `Modelo "${modelId}" não encontrado no catálogo.` };
    }

    const targetDir = this.getModelsDir();
    const targetPath = path.join(targetDir, item.filename);
    const tempPath = path.join(targetDir, `${item.filename}.download`);

    const downloadState: ActiveDownload = {
      modelId,
      request: null,
      fileStream: null,
      targetPath,
      tempPath,
      downloadedBytes: 0,
      totalBytes: item.sizeBytes,
      startTime: Date.now(),
      lastSpeedCalcTime: Date.now(),
      lastDownloadedBytes: 0,
      speed: '0 KB/s',
      cancelled: false
    };

    this.activeDownloads.set(modelId, downloadState);
    this.emitProgress(modelId, 'downloading', 0, 'Iniciando conexão...', 0, item.sizeBytes);

    this.startStreamingDownload(item.url, downloadState, 0)
      .then(() => {
        if (downloadState.cancelled) return;
        try {
          if (fs.existsSync(tempPath)) {
            if (fs.existsSync(targetPath)) {
              fs.unlinkSync(targetPath);
            }
            fs.renameSync(tempPath, targetPath);
          }
        } catch (renameErr: any) {
          console.error('[LlmDownloader] Error finalizing downloaded file:', renameErr);
        }

        this.activeDownloads.delete(modelId);
        this.emitProgress(modelId, 'completed', 100, '', downloadState.totalBytes, downloadState.totalBytes);
      })
      .catch((err) => {
        if (downloadState.cancelled) return;
        console.error(`[LlmDownloader] Download failed for ${modelId}:`, err);
        try {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        } catch {}

        this.activeDownloads.delete(modelId);
        this.emitProgress(modelId, 'error', 0, '', 0, downloadState.totalBytes, err?.message || 'Falha no download');
      });

    return { ok: true };
  }

  private startStreamingDownload(
    urlStr: string,
    state: ActiveDownload,
    redirectCount = 0
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (state.cancelled) {
        return resolve();
      }

      if (redirectCount > 6) {
        return reject(new Error('Muitos redirecionamentos ao baixar modelo.'));
      }

      const parsedUrl = new URL(urlStr);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const req = client.get(
        urlStr,
        {
          headers: {
            'User-Agent': 'BilingualReaderDesktop/1.0',
            'Accept': '*/*'
          }
        },
        (res) => {
          if (state.cancelled) {
            res.destroy();
            return resolve();
          }

          // Handle HTTP redirects (301, 302, 303, 307, 308)
          if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            const nextUrl = new URL(res.headers.location, urlStr).toString();
            res.resume(); // drain
            return resolve(this.startStreamingDownload(nextUrl, state, redirectCount + 1));
          }

          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            res.resume();
            return reject(new Error(`Servidor respondeu com status HTTP ${res.statusCode}`));
          }

          const contentLength = parseInt(res.headers['content-length'] || '0', 10);
          if (contentLength > 0) {
            state.totalBytes = contentLength;
          }

          const fileStream = fs.createWriteStream(state.tempPath, { flags: 'w' });
          state.fileStream = fileStream;

          let lastEmit = Date.now();

          res.on('data', (chunk: Buffer) => {
            if (state.cancelled) {
              res.destroy();
              fileStream.close();
              return;
            }

            state.downloadedBytes += chunk.length;
            const now = Date.now();

            // Calculate speed and emit every 500ms
            if (now - lastEmit > 500) {
              const deltaSec = (now - state.lastSpeedCalcTime) / 1000;
              if (deltaSec > 0) {
                const bytesInPeriod = state.downloadedBytes - state.lastDownloadedBytes;
                const speedBps = bytesInPeriod / deltaSec;
                state.speed = this.formatSpeed(speedBps);
                state.lastDownloadedBytes = state.downloadedBytes;
                state.lastSpeedCalcTime = now;
              }

              const progress = state.totalBytes > 0
                ? Math.min(99, Math.round((state.downloadedBytes / state.totalBytes) * 100))
                : 0;

              this.emitProgress(
                state.modelId,
                'downloading',
                progress,
                state.speed,
                state.downloadedBytes,
                state.totalBytes
              );
              lastEmit = now;
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            resolve();
          });

          fileStream.on('error', (err) => {
            fileStream.close();
            reject(err);
          });

          res.on('error', (err) => {
            fileStream.close();
            reject(err);
          });
        }
      );

      state.request = req;

      req.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Cancels an ongoing download.
   */
  public cancelDownload(modelId: string): boolean {
    const download = this.activeDownloads.get(modelId);
    if (!download) return false;

    download.cancelled = true;
    if (download.request) {
      try {
        download.request.destroy();
      } catch {}
    }
    if (download.fileStream) {
      try {
        download.fileStream.close();
      } catch {}
    }

    try {
      if (fs.existsSync(download.tempPath)) {
        fs.unlinkSync(download.tempPath);
      }
    } catch {}

    this.activeDownloads.delete(modelId);
    this.emitProgress(modelId, 'cancelled', 0, '', 0, download.totalBytes);
    return true;
  }

  /**
   * Deletes an installed model from the user data directory.
   */
  public deleteModel(modelId: string): { ok: boolean; error?: string } {
    const item = LLM_MODELS_CATALOG.find(m => m.id === modelId);
    if (!item) return { ok: false, error: 'Modelo não encontrado.' };

    const userModelPath = path.join(this.getModelsDir(), item.filename);
    if (fs.existsSync(userModelPath)) {
      try {
        fs.unlinkSync(userModelPath);
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: `Erro ao excluir arquivo: ${e?.message || String(e)}` };
      }
    }

    return { ok: false, error: 'O modelo faz parte do pacote embutido e não pode ser excluído da pasta do sistema.' };
  }

  private formatSpeed(bps: number): string {
    if (bps >= 1024 * 1024) {
      return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    return `${Math.round(bps / 1024)} KB/s`;
  }

  private emitProgress(
    modelId: string,
    status: 'downloading' | 'completed' | 'cancelled' | 'error',
    progress: number,
    speed: string,
    downloadedBytes: number,
    totalBytes: number,
    error?: string | null
  ): void {
    const payload: LlmDownloadProgressEvent = {
      modelId,
      status,
      progress,
      speed,
      downloadedBytes,
      totalBytes,
      error: error || null
    };

    const win = this.getWindowFn ? this.getWindowFn() : null;
    if (win && !win.isDestroyed()) {
      win.webContents.send('llm:download-progress', payload);
    }
  }

  public registerIpcHandlers(): void {
    ipcMain.handle('llm-models:list', async () => this.getModelsList());
    ipcMain.handle('llm-models:get-active', async () => this.getActiveModelId());
    ipcMain.handle('llm-models:set-active', async (_event, modelId: string) => this.setActiveModelId(modelId));
    ipcMain.handle('llm-models:download', async (_event, modelId: string) => this.downloadModel(modelId));
    ipcMain.handle('llm-models:cancel-download', async (_event, modelId: string) => this.cancelDownload(modelId));
    ipcMain.handle('llm-models:delete', async (_event, modelId: string) => this.deleteModel(modelId));
  }
}
