import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export class Secrets {
  private static _instance: Secrets;

  private animeListClientId: string = '';
  private googleIdToken: string = '';
  private googleOAuthClientId: string = '';
  private googleOAuthClientSecret: string = '';
  private firebaseApiKey: string = '';
  private firebaseAuthDomain: string = '';
  private firebaseProjectId: string = '';
  private firebaseAppId: string = '';
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

  private candidateRoots(): string[] {
    const roots: string[] = [process.cwd()];
    try {
      if (app) {
        roots.push(app.getAppPath());
        if (!app.isPackaged) {
          roots.push(path.join(app.getAppPath(), '..'));
        }
      }
    } catch {
      // app may be unavailable in some test contexts
    }
    try {
      roots.push(path.join(__dirname, '../..'));
      roots.push(path.join(__dirname, '../../..'));
    } catch {
      // ignore
    }
    return [...new Set(roots.filter(Boolean))];
  }

  private loadSecrets(): void {
    try {
      for (const root of this.candidateRoots()) {
        const envPath = path.join(root, '.env');
        const propsPath = path.join(root, 'secrets.properties');
        if (fs.existsSync(envPath)) {
          this.parseEnv(fs.readFileSync(envPath, 'utf-8'));
          return;
        }
        if (fs.existsSync(propsPath)) {
          this.parseProperties(fs.readFileSync(propsPath, 'utf-8'));
          return;
        }
      }
    } catch (e) {
      console.error('Error reading secrets:', e);
    }
  }

  private applyKey(k: string, value: string): void {
    switch (k) {
      case 'ANIME_LIST_CLIENT_ID':
      case 'MY_ANIME_LIST_CLIENT_ID':
        this.animeListClientId = value;
        break;
      case 'GOOGLE_ID_TOKEN':
        this.googleIdToken = value;
        break;
      case 'GOOGLE_OAUTH_CLIENT_ID':
        this.googleOAuthClientId = value;
        break;
      case 'GOOGLE_OAUTH_CLIENT_SECRET':
        this.googleOAuthClientSecret = value;
        break;
      case 'FIREBASE_API_KEY':
        this.firebaseApiKey = value;
        break;
      case 'FIREBASE_AUTH_DOMAIN':
        this.firebaseAuthDomain = value;
        break;
      case 'FIREBASE_PROJECT_ID':
        this.firebaseProjectId = value;
        break;
      case 'FIREBASE_APP_ID':
        this.firebaseAppId = value;
        break;
      case 'OPENROUTER_API_KEY':
        this.openRouterApiKey = value;
        break;
    }
  }

  private parseEnv(content: string): void {
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      this.applyKey(key.trim(), value);
    }
  }

  private parseProperties(content: string): void {
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue;
      const [key, ...valueParts] = trimmed.split('=');
      this.applyKey(key.trim(), valueParts.join('=').trim());
    }
  }

  public getMyAnimeListClientId(): string {
    return this.animeListClientId;
  }

  public getGoogleIdToken(): string {
    return this.googleIdToken;
  }

  public getGoogleOAuthClientId(): string {
    return this.googleOAuthClientId || this.googleIdToken;
  }

  public getGoogleOAuthClientSecret(): string {
    return this.googleOAuthClientSecret;
  }

  public getFirebaseApiKey(): string {
    return this.firebaseApiKey;
  }

  public getFirebaseAuthDomain(): string {
    return this.firebaseAuthDomain;
  }

  public getFirebaseProjectId(): string {
    return this.firebaseProjectId;
  }

  public getFirebaseAppId(): string {
    return this.firebaseAppId;
  }

  public getOpenRouterApiKey(): string {
    return this.openRouterApiKey;
  }
}
