import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import { app } from 'electron';

export class EBookConverterService {
  private static _instance: EBookConverterService;

  public static get instance(): EBookConverterService {
    if (!this._instance) {
      this._instance = new EBookConverterService();
    }
    return this._instance;
  }

  private getCacheDir(): string {
    const userData = app ? app.getPath('userData') : process.cwd();
    const cacheDir = path.join(userData, 'cache', 'converted');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    return cacheDir;
  }

  public generateHash(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex');
  }

  /**
   * Converts a given book file (MOBI, FB2, DOCX, TXT, etc.) into an EPUB format using Pandoc or Calibre ebook-convert CLI.
   */
  public async convertToEpub(inputPath: string): Promise<string> {
    const ext = path.extname(inputPath).toLowerCase();
    if (ext === '.epub' || ext === '.kepub') {
      return inputPath;
    }

    const hash = this.generateHash(inputPath);
    const cacheDir = this.getCacheDir();
    const outputPath = path.join(cacheDir, `${hash}.epub`);

    if (fs.existsSync(outputPath)) {
      return outputPath;
    }

    // Attempt Pandoc conversion first
    const pandocSuccess = await this.runCommand(`pandoc "${inputPath}" -o "${outputPath}"`);
    if (pandocSuccess && fs.existsSync(outputPath)) {
      return outputPath;
    }

    // Fallback: Calibre CLI ebook-convert
    const calibreSuccess = await this.runCommand(`ebook-convert "${inputPath}" "${outputPath}"`);
    if (calibreSuccess && fs.existsSync(outputPath)) {
      return outputPath;
    }

    throw new Error(`Failed to convert file to EPUB: ${inputPath}`);
  }

  private runCommand(cmd: string): Promise<boolean> {
    return new Promise((resolve) => {
      exec(cmd, (error) => {
        if (error) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }
}
