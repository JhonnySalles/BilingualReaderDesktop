import { app, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';
import { getAppLibsDir, getAppModelsDir } from '../utils/app-paths';
import { LlmDownloaderController } from './llm-downloader.controller';

export interface LlmServerStatus {
  available: boolean;
  running: boolean;
  port: number;
  model: string | null;
  modelPath: string | null;
  binaryPath: string | null;
  error?: string | null;
}

export class LlmServerController {
  private static _instance: LlmServerController;
  private serverProcess: ChildProcess | null = null;
  private currentModelPath: string | null = null;
  private isStarting = false;
  private port = 8080;
  private host = '127.0.0.1';

  public static get instance(): LlmServerController {
    if (!this._instance) {
      this._instance = new LlmServerController();
    }
    return this._instance;
  }

  public getPort(): number {
    return this.port;
  }

  public getBaseUrl(): string {
    return `http://${this.host}:${this.port}/v1`;
  }

  public isRunning(): boolean {
    return this.serverProcess !== null && !this.serverProcess.killed;
  }

  /**
   * Discovers the llama-server executable path.
   */
  public findBinaryPath(): string | null {
    const isWin = process.platform === 'win32';
    const binaryName = isWin ? 'llama-server.exe' : 'llama-server';

    const candidateDirs = [
      path.join(getAppLibsDir(), 'llm'),
      process.resourcesPath ? path.join(process.resourcesPath, 'assets', 'llm') : null,
      process.resourcesPath ? path.join(process.resourcesPath, 'llm') : null,
      typeof app?.getAppPath === 'function' ? path.join(app.getAppPath(), 'public', 'assets', 'llm') : null,
      typeof app?.getAppPath === 'function' ? path.join(app.getAppPath(), 'app', 'assets', 'llm') : null,
      path.join(process.cwd(), 'public', 'assets', 'llm'),
      path.join(process.cwd(), 'app', 'assets', 'llm')
    ].filter(Boolean) as string[];

    for (const dir of candidateDirs) {
      const fullPath = path.join(dir, binaryName);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    return null;
  }

  /**
   * Discovers the .gguf model file path.
   */
  public findModelPath(modelId?: string): string | null {
    // 1. Check LlmDownloaderController active or requested model
    const fromDownloader = LlmDownloaderController.instance.getActiveModelPath(modelId);
    if (fromDownloader) {
      return fromDownloader;
    }

    // 2. Scan candidate directories
    const candidateDirs = [
      getAppModelsDir(),
      path.join(getAppLibsDir(), 'llm'),
      process.resourcesPath ? path.join(process.resourcesPath, 'assets', 'llm') : null,
      process.resourcesPath ? path.join(process.resourcesPath, 'llm') : null,
      typeof app?.getAppPath === 'function' ? path.join(app.getAppPath(), 'public', 'assets', 'llm') : null,
      typeof app?.getAppPath === 'function' ? path.join(app.getAppPath(), 'app', 'assets', 'llm') : null,
      path.join(process.cwd(), 'public', 'assets', 'llm'),
      path.join(process.cwd(), 'app', 'assets', 'llm')
    ].filter(Boolean) as string[];

    for (const dir of candidateDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        const gguf = files.find(f => f.toLowerCase().endsWith('.gguf') && !f.endsWith('.download'));
        if (gguf) {
          return path.join(dir, gguf);
        }
      }
    }

    return null;
  }

  public getStatus(modelId?: string): LlmServerStatus {
    const binaryPath = this.findBinaryPath();
    const modelPath = this.currentModelPath || this.findModelPath(modelId);
    const available = Boolean(binaryPath && modelPath);

    return {
      available,
      running: this.isRunning(),
      port: this.port,
      model: modelPath ? path.basename(modelPath) : null,
      modelPath,
      binaryPath,
      error: !available ? 'Executável (llama-server.exe) ou modelo (.gguf) não encontrado. Verifique as configurações para baixar um modelo.' : null
    };
  }

  /**
   * Starts the internal llama-server if not already running, or restarts if model changed.
   */
  public async startServer(modelId?: string): Promise<LlmServerStatus> {
    const modelPath = this.findModelPath(modelId);

    if (this.isRunning()) {
      if (modelPath && this.currentModelPath && this.currentModelPath !== modelPath) {
        console.log(`[LlmServer] Model changed from ${this.currentModelPath} to ${modelPath}. Restarting server...`);
        this.stopServer();
        await new Promise(resolve => setTimeout(resolve, 800));
      } else {
        return this.getStatus();
      }
    }

    if (this.isStarting) {
      // Wait until startup finishes
      for (let i = 0; i < 60; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (this.isRunning()) {
          return this.getStatus();
        }
        if (!this.isStarting) break;
      }
    }

    const binaryPath = this.findBinaryPath();

    if (!binaryPath || !modelPath) {
      return {
        available: false,
        running: false,
        port: this.port,
        model: null,
        modelPath: null,
        binaryPath: null,
        error: 'llama-server ou modelo .gguf ausente'
      };
    }

    this.isStarting = true;

    try {
      console.log(`[LlmServer] Starting ${binaryPath} with model ${modelPath} on port ${this.port}...`);

      const args = [
        '-m', modelPath,
        '--port', String(this.port),
        '--host', this.host,
        '-c', '4096',
        '--n-gpu-layers', '0',
        '--threads', '4'
      ];

      this.serverProcess = spawn(binaryPath, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.serverProcess.stdout?.on('data', (chunk) => {
        const text = chunk.toString();
        if (text.includes('HTTP server listening') || text.includes('ready')) {
          console.log(`[LlmServer stdout]`, text.trim());
        }
      });

      this.serverProcess.stderr?.on('data', (chunk) => {
        const text = chunk.toString();
        if (text.toLowerCase().includes('error') || text.toLowerCase().includes('fail')) {
          console.warn(`[LlmServer stderr]`, text.trim());
        }
      });

      this.serverProcess.on('exit', (code, signal) => {
        console.log(`[LlmServer] Process exited with code ${code}, signal ${signal}`);
        this.serverProcess = null;
        this.isStarting = false;
      });

      this.serverProcess.on('error', (err) => {
        console.error(`[LlmServer] Spawn error:`, err);
        this.serverProcess = null;
        this.isStarting = false;
      });

      // Poll until the server responds to /health or /v1/models
      const ready = await this.waitForHealthCheck(30000);
      this.isStarting = false;

      if (!ready) {
        this.stopServer();
        return {
          available: true,
          running: false,
          port: this.port,
          model: path.basename(modelPath),
          modelPath,
          binaryPath,
          error: 'Timeout aguardando inicialização do servidor LLM'
        };
      }

      this.currentModelPath = modelPath;
      return this.getStatus();
    } catch (e: any) {
      this.isStarting = false;
      this.stopServer();
      return {
        available: true,
        running: false,
        port: this.port,
        model: path.basename(modelPath),
        modelPath,
        binaryPath,
        error: e?.message || String(e)
      };
    }
  }

  /**
   * Stops the internal llama-server process.
   */
  public stopServer(): boolean {
    this.currentModelPath = null;
    if (this.serverProcess) {
      try {
        console.log('[LlmServer] Terminating server process...');
        this.serverProcess.kill('SIGTERM');
        setTimeout(() => {
          if (this.serverProcess && !this.serverProcess.killed) {
            try {
              this.serverProcess.kill('SIGKILL');
            } catch {
              /* ignore */
            }
          }
          this.serverProcess = null;
        }, 1500);
      } catch (e) {
        console.warn('[LlmServer] Error stopping process:', e);
      }
      this.serverProcess = null;
      return true;
    }
    return false;
  }

  private async waitForHealthCheck(timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (!this.serverProcess || this.serverProcess.killed) {
        return false;
      }
      const ok = await this.checkHealth();
      if (ok) return true;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return false;
  }

  private checkHealth(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://${this.host}:${this.port}/health`, (res) => {
        if (res.statusCode === 200 || res.statusCode === 503 || res.statusCode === 204) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      req.on('error', () => {
        // Also try /v1/models as a fallback check
        const req2 = http.get(`http://${this.host}:${this.port}/v1/models`, (res2) => {
          resolve(res2.statusCode === 200);
        });
        req2.on('error', () => resolve(false));
        req2.setTimeout(1000, () => {
          req2.destroy();
          resolve(false);
        });
      });
      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  public registerIpcHandlers(): void {
    ipcMain.handle('llm-server:status', async (_event, modelId?: string) => this.getStatus(modelId));
    ipcMain.handle('llm-server:start', async (_event, modelId?: string) => this.startServer(modelId));
    ipcMain.handle('llm-server:stop', async () => this.stopServer());
  }
}
