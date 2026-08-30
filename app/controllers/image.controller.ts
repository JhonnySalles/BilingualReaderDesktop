import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';
import { app } from 'electron';

export class ImageController {
  private static _instance: ImageController;

  public static get instance(): ImageController {
    if (!this._instance) {
      this._instance = new ImageController();
    }
    return this._instance;
  }

  private getCacheDir(): string {
    const userData = app ? app.getPath('userData') : process.cwd();
    const cacheDir = path.join(userData, 'cache', 'images');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    return cacheDir;
  }

  public generateHash(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex');
  }

  public async getImageFromUrl(url: string): Promise<string | null> {
    if (!url || url === 'null') return null;

    const hash = this.generateHash(url);
    const cacheDir = this.getCacheDir();
    const cachedFilePath = path.join(cacheDir, hash);

    if (fs.existsSync(cachedFilePath)) {
      return cachedFilePath;
    }

    return new Promise((resolve) => {
      const client = url.startsWith('https') ? https : http;
      client.get(url, (res) => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }

        const data: Buffer[] = [];
        res.on('data', (chunk) => data.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(data);
          fs.writeFileSync(cachedFilePath, buffer);
          resolve(cachedFilePath);
        });
      }).on('error', () => {
        resolve(null);
      });
    });
  }
}
