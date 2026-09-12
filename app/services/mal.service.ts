import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { BrowserWindow } from 'electron';
import { getAppDataDir } from '../utils/app-paths';
import { Secrets } from '../utils/secrets';
import { Telemetry } from '../utils/telemetry';
import {
  ExternalTrackerSearchResult,
  ExternalTrackerUserStatus,
  ExternalTrackerUpdatePayload,
  TrackerAuthStatus
} from '../../src/app/core/models/entities/track.model';

export interface MalOAuthTokens {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
  created_at: number;
  username?: string | null;
  avatar?: string | null;
}

export class MalService {
  private static _instance: MalService;
  private tokenPath: string;
  private tokens: MalOAuthTokens | null = null;

  public static get instance(): MalService {
    if (!this._instance) {
      this._instance = new MalService();
    }
    return this._instance;
  }

  constructor() {
    this.tokenPath = path.join(getAppDataDir(), 'mal-auth.json');
    this.loadTokens();
  }

  private loadTokens(): void {
    try {
      if (fs.existsSync(this.tokenPath)) {
        this.tokens = JSON.parse(fs.readFileSync(this.tokenPath, 'utf-8'));
      }
    } catch (e) {
      console.error('[MalService] Failed to load tokens:', e);
      this.tokens = null;
    }
  }

  private saveTokens(tokens: MalOAuthTokens): void {
    this.tokens = tokens;
    try {
      fs.writeFileSync(this.tokenPath, JSON.stringify(tokens, null, 2), 'utf-8');
    } catch (e) {
      console.error('[MalService] Failed to save tokens:', e);
      Telemetry.recordException(e, '[MalService] Failed to save tokens');
    }
  }

  private getClientId(): string {
    const clientId = Secrets.instance.getMyAnimeListClientId();
    if (!clientId) {
      throw new Error('MY_ANIME_LIST_CLIENT_ID não configurado no .env');
    }
    return clientId;
  }

  private generateCodeVerifier(): string {
    return crypto.randomBytes(64).toString('hex').slice(0, 128);
  }

  public async getAuthStatus(): Promise<TrackerAuthStatus> {
    if (!this.tokens?.access_token) {
      return { authenticated: false };
    }
    const isExpired = Date.now() >= (this.tokens.created_at + this.tokens.expires_in * 1000 - 60_000);
    if (isExpired && this.tokens.refresh_token) {
      try {
        await this.refreshAccessToken();
      } catch (e) {
        return { authenticated: false };
      }
    }
    return {
      authenticated: true,
      username: this.tokens.username ?? null,
      avatar: this.tokens.avatar ?? null,
      expiresAt: this.tokens.created_at + this.tokens.expires_in * 1000
    };
  }

  public async login(): Promise<TrackerAuthStatus> {
    const clientId = this.getClientId();
    const codeVerifier = this.generateCodeVerifier();
    const state = crypto.randomBytes(16).toString('hex');

    const authUrl = `https://myanimelist.net/v1/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(
      clientId
    )}&code_challenge=${encodeURIComponent(codeVerifier)}&code_challenge_method=plain&state=${encodeURIComponent(
      state
    )}`;

    return new Promise((resolve, reject) => {
      let resolved = false;

      const authWindow = new BrowserWindow({
        width: 600,
        height: 750,
        title: 'Login - MyAnimeList',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      authWindow.setMenuBarVisibility(false);

      const handleUrl = async (urlStr: string) => {
        try {
          const url = new URL(urlStr);
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');

          if (error) {
            resolved = true;
            authWindow.close();
            reject(new Error(`Erro no login MAL: ${error}`));
            return;
          }

          if (code) {
            resolved = true;
            authWindow.close();
            await this.exchangeCodeForToken(code, codeVerifier);
            const status = await this.getAuthStatus();
            resolve(status);
            return;
          }
        } catch {
          // URL intermediária
        }
      };

      authWindow.webContents.on('will-redirect', (_event, url) => {
        void handleUrl(url);
      });

      authWindow.webContents.on('did-navigate', (_event, url) => {
        void handleUrl(url);
      });

      authWindow.on('closed', () => {
        if (!resolved) {
          reject(new Error('Janela de login fechada pelo usuário.'));
        }
      });

      void authWindow.loadURL(authUrl);
    });
  }

  private async exchangeCodeForToken(code: string, codeVerifier: string): Promise<void> {
    const clientId = this.getClientId();
    const bodyParams = new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code'
    });

    const res = await fetch('https://myanimelist.net/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: bodyParams.toString()
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Falha ao obter token do MAL (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as {
      token_type: string;
      expires_in: number;
      access_token: string;
      refresh_token: string;
    };

    const tokens: MalOAuthTokens = {
      ...data,
      created_at: Date.now()
    };

    this.saveTokens(tokens);

    try {
      const profile = await this.fetchUserProfile(data.access_token);
      if (profile) {
        tokens.username = profile.name;
        tokens.avatar = profile.picture;
        this.saveTokens(tokens);
      }
    } catch {
      // Perfil opcional
    }
  }

  public async refreshAccessToken(): Promise<string> {
    if (!this.tokens?.refresh_token) {
      throw new Error('Nenhum refresh token do MAL disponível.');
    }
    const clientId = this.getClientId();
    const bodyParams = new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: this.tokens.refresh_token
    });

    const res = await fetch('https://myanimelist.net/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: bodyParams.toString()
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Falha ao atualizar token do MAL (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as {
      token_type: string;
      expires_in: number;
      access_token: string;
      refresh_token: string;
    };

    this.tokens = {
      ...this.tokens,
      ...data,
      created_at: Date.now()
    };
    this.saveTokens(this.tokens);
    return data.access_token;
  }

  private async getValidAccessToken(): Promise<string> {
    if (!this.tokens?.access_token) {
      throw new Error('Usuário não autenticado no MyAnimeList.');
    }
    const isExpired = Date.now() >= (this.tokens.created_at + this.tokens.expires_in * 1000 - 60_000);
    if (isExpired && this.tokens.refresh_token) {
      return await this.refreshAccessToken();
    }
    return this.tokens.access_token;
  }

  public async logout(): Promise<void> {
    this.tokens = null;
    try {
      if (fs.existsSync(this.tokenPath)) {
        fs.unlinkSync(this.tokenPath);
      }
    } catch (e) {
      console.error('[MalService] Error deleting token file:', e);
    }
  }

  private async fetchUserProfile(accessToken: string): Promise<{ name: string; picture?: string } | null> {
    try {
      const res = await fetch('https://api.myanimelist.net/v2/users/@me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      if (!res.ok) return null;
      const json = (await res.json()) as any;
      return {
        name: json.name,
        picture: json.picture
      };
    } catch {
      return null;
    }
  }

  /**
   * Busca de mangás / novels por nome no MyAnimeList.
   */
  public async search(query: string, limit = 20): Promise<ExternalTrackerSearchResult[]> {
    if (!query || !query.trim()) return [];

    let headers: Record<string, string> = {};
    if (this.tokens?.access_token) {
      const token = await this.getValidAccessToken();
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      headers['X-MAL-CLIENT-ID'] = this.getClientId();
    }

    const url = `https://api.myanimelist.net/v2/manga?q=${encodeURIComponent(
      query.trim()
    )}&limit=${limit}&fields=id,title,main_picture,mean,num_chapters,num_volumes,status,media_type`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Erro na busca MAL (${res.status}): ${text}`);
    }

    const data = (await res.json()) as { data?: Array<{ node: any }> };
    if (!data.data) return [];

    return data.data.map(item => {
      const node = item.node;
      return {
        id: node.id,
        title: node.title,
        score: node.mean != null ? Number(node.mean) : null,
        coverImage: node.main_picture?.large || node.main_picture?.medium || null,
        totalChapters: node.num_chapters || null,
        totalVolumes: node.num_volumes || null,
        status: node.status || null,
        mediaType: node.media_type || null
      };
    });
  }

  /**
   * Obtém o status do mangá na lista do usuário no MyAnimeList.
   */
  public async getUserStatus(mangaId: number): Promise<ExternalTrackerUserStatus> {
    const token = await this.getValidAccessToken();
    const url = `https://api.myanimelist.net/v2/manga/${mangaId}?fields=my_list_status`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      if (res.status === 404) {
        return { inList: false };
      }
      const text = await res.text();
      throw new Error(`Erro ao obter status MAL (${res.status}): ${text}`);
    }

    const json = (await res.json()) as any;
    const listStatus = json.my_list_status;

    if (!listStatus) {
      return { inList: false };
    }

    return {
      inList: true,
      status: listStatus.status || null,
      score: listStatus.score != null ? Number(listStatus.score) : null,
      chaptersRead: listStatus.num_chapters_read ?? 0,
      volumesRead: listStatus.num_volumes_read ?? 0,
      updatedAt: listStatus.updated_at || null
    };
  }

  /**
   * Atualiza ou vincula o mangá na lista do usuário no MyAnimeList.
   */
  public async updateUserStatus(payload: ExternalTrackerUpdatePayload): Promise<ExternalTrackerUserStatus> {
    const token = await this.getValidAccessToken();
    const url = `https://api.myanimelist.net/v2/manga/${payload.mediaId}/my_list_status`;

    const bodyParams = new URLSearchParams();

    if (payload.status) {
      // Normaliza status para os valores aceitos pelo MAL
      const s = payload.status.toLowerCase();
      let malStatus = 'reading';
      if (s === 'completed') malStatus = 'completed';
      else if (s === 'on_hold' || s === 'on-hold') malStatus = 'on_hold';
      else if (s === 'dropped') malStatus = 'dropped';
      else if (s === 'plan_to_read' || s === 'plantoread') malStatus = 'plan_to_read';
      else if (s === 'reading') malStatus = 'reading';

      bodyParams.set('status', malStatus);
    }

    if (payload.score != null) {
      bodyParams.set('score', String(Math.round(payload.score)));
    }

    if (payload.chaptersRead != null) {
      bodyParams.set('num_chapters_read', String(payload.chaptersRead));
    }

    if (payload.volumesRead != null) {
      bodyParams.set('num_volumes_read', String(payload.volumesRead));
    }

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: bodyParams.toString()
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Erro ao atualizar status MAL (${res.status}): ${text}`);
    }

    const listStatus = (await res.json()) as any;

    return {
      inList: true,
      status: listStatus.status || null,
      score: listStatus.score != null ? Number(listStatus.score) : null,
      chaptersRead: listStatus.num_chapters_read ?? 0,
      volumesRead: listStatus.num_volumes_read ?? 0,
      updatedAt: listStatus.updated_at || null
    };
  }
}
