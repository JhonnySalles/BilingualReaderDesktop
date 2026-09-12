import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export class Secrets {
  private static _instance: Secrets;

  private animeListClientId: string = '';
  private aniListClientId: string = '';
  private aniListClientSecret: string = '';
  private googleIdToken: string = '';
  private googleOAuthClientId: string = '';
  private googleOAuthClientSecret: string = '';
  private firebaseApiKey: string = '';
  private firebaseAuthDomain: string = '';
  private firebaseProjectId: string = '';
  private firebaseAppId: string = '';
  private openRouterApiKey: string = '';
  private sentryDsn: string = '';
  private telemetryEnabled: boolean = false;
  private sentryEnvironment: string = '';
  private sentryTracesSampleRate: number | null = null;

  public static get instance(): Secrets {
    if (!this._instance) {
      this._instance = new Secrets();
    }
    return this._instance;
  }

  constructor() {
    this.loadSecrets();
  }

  private isPackaged(): boolean {
    try {
      return !!app?.isPackaged;
    } catch {
      return false;
    }
  }

  private candidateRoots(): string[] {
    const roots: string[] = [process.cwd()];
    try {
      if (typeof process.resourcesPath === 'string' && process.resourcesPath) {
        roots.push(process.resourcesPath);
      }
    } catch {
      // ignore
    }
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

  /** Preferred env filenames: packaged → .env.production first; dev → .env first. */
  private preferredEnvFiles(): string[] {
    if (this.isPackaged()) {
      return ['.env.production', '.env'];
    }
    return ['.env', '.env.production'];
  }

  private loadSecrets(): void {
    try {
      const envNames = this.preferredEnvFiles();
      for (const root of this.candidateRoots()) {
        for (const name of envNames) {
          const envPath = path.join(root, name);
          if (fs.existsSync(envPath)) {
            this.parseEnv(fs.readFileSync(envPath, 'utf-8'));
            return;
          }
        }
        const propsPath = path.join(root, 'secrets.properties');
        if (fs.existsSync(propsPath)) {
          this.parseProperties(fs.readFileSync(propsPath, 'utf-8'));
          return;
        }
      }
    } catch (e) {
      console.error('Error reading secrets:', e);
    }
  }

  private parseBool(value: string): boolean {
    const v = value.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
  }

  private applyKey(k: string, value: string): void {
    switch (k) {
      case 'ANIME_LIST_CLIENT_ID':
      case 'MY_ANIME_LIST_CLIENT_ID':
        this.animeListClientId = value;
        break;
      case 'ANILIST_CLIENT_ID':
      case 'ANI_LIST_CLIENT_ID':
        this.aniListClientId = value;
        break;
      case 'ANILIST_CLIENT_SECRET':
      case 'ANI_LIST_CLIENT_SECRET':
        this.aniListClientSecret = value;
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
      case 'SENTRY_DSN':
        this.sentryDsn = value;
        break;
      case 'TELEMETRY_ENABLED':
        this.telemetryEnabled = this.parseBool(value);
        break;
      case 'SENTRY_ENVIRONMENT':
        this.sentryEnvironment = value;
        break;
      case 'SENTRY_TRACES_SAMPLE_RATE': {
        const n = Number(value);
        this.sentryTracesSampleRate = Number.isFinite(n) ? n : null;
        break;
      }
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

  public getAniListClientId(): string {
    return this.aniListClientId;
  }

  public getAniListClientSecret(): string {
    return this.aniListClientSecret;
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

  public getSentryDsn(): string {
    return this.sentryDsn;
  }

  /** True only when TELEMETRY_ENABLED is on and a DSN is present. */
  public isTelemetryEnabled(): boolean {
    return this.telemetryEnabled && !!this.sentryDsn.trim();
  }

  public getSentryEnvironment(): string {
    if (this.sentryEnvironment.trim()) return this.sentryEnvironment.trim();
    return this.isPackaged() ? 'production' : 'development';
  }

  public getSentryTracesSampleRate(): number {
    if (this.sentryTracesSampleRate != null) {
      return Math.min(1, Math.max(0, this.sentryTracesSampleRate));
    }
    return this.isPackaged() ? 0.1 : 0;
  }
}
