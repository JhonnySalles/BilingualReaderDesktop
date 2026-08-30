import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export class Secrets {
  private static _instance: Secrets;

  private animeListClientId: string = '';
  private googleIdToken: string = '';
  private openRouterApiKey: string = '';

  public static get instance(): Secrets {
    if (!this._instance) {
      this._instance = new Secrets();
    }
    return this._instance;
  }

  constructor() {
    this.loadSecrets();
  }

  private loadSecrets(): void {
    try {
      // Look for .env or secrets.properties in process cwd or app root
      const rootPath = process.cwd();
      const envPath = path.join(rootPath, '.env');
      const propsPath = path.join(rootPath, 'secrets.properties');

      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        this.parseEnv(content);
      } else if (fs.existsSync(propsPath)) {
        const content = fs.readFileSync(propsPath, 'utf-8');
        this.parseProperties(content);
      }
    } catch (e) {
      console.error('Error reading secrets:', e);
    }
  }

  private parseEnv(content: string): void {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      const k = key.trim();

      if (k === 'ANIME_LIST_CLIENT_ID' || k === 'MY_ANIME_LIST_CLIENT_ID') {
        this.animeListClientId = value;
      } else if (k === 'GOOGLE_ID_TOKEN') {
        this.googleIdToken = value;
      } else if (k === 'OPENROUTER_API_KEY') {
        this.openRouterApiKey = value;
      }
    }
  }

  private parseProperties(content: string): void {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue;
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim();
      const k = key.trim();

      if (k === 'ANIME_LIST_CLIENT_ID') {
        this.animeListClientId = value;
      } else if (k === 'GOOGLE_ID_TOKEN') {
        this.googleIdToken = value;
      } else if (k === 'OPENROUTER_API_KEY') {
        this.openRouterApiKey = value;
      }
    }
  }

  public getMyAnimeListClientId(): string {
    return this.animeListClientId;
  }

  public getGoogleIdToken(): string {
    return this.googleIdToken;
  }

  public getOpenRouterApiKey(): string {
    return this.openRouterApiKey;
  }
}
