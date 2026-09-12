import * as fs from 'fs';
import * as path from 'path';
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

export interface AnilistOAuthTokens {
  token_type?: string;
  expires_in?: number;
  access_token: string;
  created_at: number;
  userId?: number | null;
  username?: string | null;
  avatar?: string | null;
}

export class AnilistService {
  private static _instance: AnilistService;
  private tokenPath: string;
  private tokens: AnilistOAuthTokens | null = null;

  public static get instance(): AnilistService {
    if (!this._instance) {
      this._instance = new AnilistService();
    }
    return this._instance;
  }

  constructor() {
    this.tokenPath = path.join(getAppDataDir(), 'anilist-auth.json');
    this.loadTokens();
  }

  private loadTokens(): void {
    try {
      if (fs.existsSync(this.tokenPath)) {
        this.tokens = JSON.parse(fs.readFileSync(this.tokenPath, 'utf-8'));
      }
    } catch (e) {
      console.error('[AnilistService] Failed to load tokens:', e);
      this.tokens = null;
    }
  }

  private saveTokens(tokens: AnilistOAuthTokens): void {
    this.tokens = tokens;
    try {
      fs.writeFileSync(this.tokenPath, JSON.stringify(tokens, null, 2), 'utf-8');
    } catch (e) {
      console.error('[AnilistService] Failed to save tokens:', e);
      Telemetry.recordException(e, '[AnilistService] Failed to save tokens');
    }
  }

  private getClientId(): string {
    const clientId = Secrets.instance.getAniListClientId();
    if (!clientId) {
      throw new Error('ANILIST_CLIENT_ID não configurado no .env');
    }
    return clientId;
  }

  public async getAuthStatus(): Promise<TrackerAuthStatus> {
    if (!this.tokens?.access_token) {
      return { authenticated: false };
    }
    const expiresAt = this.tokens.expires_in
      ? this.tokens.created_at + this.tokens.expires_in * 1000
      : undefined;

    return {
      authenticated: true,
      username: this.tokens.username ?? null,
      avatar: this.tokens.avatar ?? null,
      expiresAt: expiresAt ?? null
    };
  }

  public async login(): Promise<TrackerAuthStatus> {
    const clientId = this.getClientId();
    const authUrl = `https://anilist.co/api/v2/oauth/authorize?client_id=${encodeURIComponent(
      clientId
    )}&response_type=token`;

    return new Promise((resolve, reject) => {
      let resolved = false;

      const authWindow = new BrowserWindow({
        width: 600,
        height: 750,
        title: 'Login - AniList',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      authWindow.setMenuBarVisibility(false);

      const handleUrl = async (urlStr: string) => {
        try {
          if (urlStr.includes('#access_token=') || urlStr.includes('?access_token=')) {
            resolved = true;
            authWindow.close();

            const hashPart = urlStr.includes('#') ? urlStr.split('#')[1] : urlStr.split('?')[1];
            const params = new URLSearchParams(hashPart);
            const accessToken = params.get('access_token');
            const tokenType = params.get('token_type') || 'Bearer';
            const expiresIn = params.get('expires_in') ? Number(params.get('expires_in')) : 31536000;

            if (!accessToken) {
              reject(new Error('Token não encontrado no redirecionamento do AniList.'));
              return;
            }

            const tokens: AnilistOAuthTokens = {
              access_token: accessToken,
              token_type: tokenType,
              expires_in: expiresIn,
              created_at: Date.now()
            };

            this.saveTokens(tokens);

            try {
              const viewer = await this.fetchViewer(accessToken);
              if (viewer) {
                tokens.userId = viewer.id;
                tokens.username = viewer.name;
                tokens.avatar = viewer.avatar?.large || viewer.avatar?.medium || null;
                this.saveTokens(tokens);
              }
            } catch {
              // Ignore optional profile fetch error
            }

            const status = await this.getAuthStatus();
            resolve(status);
          }
        } catch (e) {
          // Intermediary URL
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

  public async logout(): Promise<void> {
    this.tokens = null;
    try {
      if (fs.existsSync(this.tokenPath)) {
        fs.unlinkSync(this.tokenPath);
      }
    } catch (e) {
      console.error('[AnilistService] Error deleting token file:', e);
    }
  }

  /**
   * Executa uma requisição GraphQL para a API do AniList.
   */
  private async queryGraphQL<T = any>(
    query: string,
    variables?: Record<string, any>,
    requireAuth = false
  ): Promise<T> {
    let accessToken: string | undefined = this.tokens?.access_token;
    if (requireAuth && !accessToken) {
      throw new Error('Usuário não autenticado no AniList.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables })
    });

    const json = (await res.json()) as any;

    if (!res.ok || json.errors) {
      const errMsg = json.errors?.[0]?.message || res.statusText || 'Erro desconhecido na API do AniList';
      throw new Error(`AniList GraphQL Error: ${errMsg}`);
    }

    return json.data as T;
  }

  private async fetchViewer(accessToken: string): Promise<{ id: number; name: string; avatar?: { medium?: string; large?: string } } | null> {
    const query = `
      query {
        Viewer {
          id
          name
          avatar {
            large
            medium
          }
        }
      }
    `;

    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ query })
      });
      const json = (await res.json()) as any;
      return json.data?.Viewer ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Busca de mangás / novels por nome no AniList.
   */
  public async search(query: string, limit = 20): Promise<ExternalTrackerSearchResult[]> {
    if (!query || !query.trim()) return [];

    const gqlQuery = `
      query ($search: String, $limit: Int) {
        Page(perPage: $limit) {
          media(search: $search, type: MANGA) {
            id
            title {
              romaji
              english
              native
            }
            averageScore
            meanScore
            coverImage {
              large
              medium
            }
            chapters
            volumes
            status
            format
          }
        }
      }
    `;

    const data = await this.queryGraphQL<{
      Page: {
        media: Array<{
          id: number;
          title: { romaji?: string; english?: string; native?: string };
          averageScore?: number | null;
          meanScore?: number | null;
          coverImage?: { large?: string; medium?: string };
          chapters?: number | null;
          volumes?: number | null;
          status?: string | null;
          format?: string | null;
        }>;
      };
    }>(gqlQuery, { search: query.trim(), limit });

    if (!data?.Page?.media) return [];

    return data.Page.media.map(media => {
      const title = media.title.romaji || media.title.english || media.title.native || 'Sem Título';
      const score = media.averageScore != null ? media.averageScore / 10 : (media.meanScore != null ? media.meanScore / 10 : null);

      return {
        id: media.id,
        title,
        score,
        coverImage: media.coverImage?.large || media.coverImage?.medium || null,
        totalChapters: media.chapters || null,
        totalVolumes: media.volumes || null,
        status: media.status || null,
        mediaType: media.format || 'MANGA'
      };
    });
  }

  /**
   * Obtém o status do mangá na lista do usuário no AniList.
   */
  public async getUserStatus(mediaId: number): Promise<ExternalTrackerUserStatus> {
    const gqlQuery = `
      query ($mediaId: Int) {
        Media(id: $mediaId, type: MANGA) {
          mediaListEntry {
            id
            status
            score(format: POINT_10_DECIMAL)
            progress
            progressVolumes
            updatedAt
          }
        }
      }
    `;

    const data = await this.queryGraphQL<{
      Media?: {
        mediaListEntry?: {
          id: number;
          status: string;
          score?: number | null;
          progress?: number | null;
          progressVolumes?: number | null;
          updatedAt?: number | null;
        };
      };
    }>(gqlQuery, { mediaId }, true);

    const entry = data?.Media?.mediaListEntry;
    if (!entry) {
      return { inList: false };
    }

    return {
      inList: true,
      status: entry.status || null,
      score: entry.score != null ? entry.score : null,
      chaptersRead: entry.progress ?? 0,
      volumesRead: entry.progressVolumes ?? 0,
      updatedAt: entry.updatedAt ? new Date(entry.updatedAt * 1000).toISOString() : null
    };
  }

  /**
   * Atualiza ou vincula o mangá na lista do usuário no AniList.
   */
  public async updateUserStatus(payload: ExternalTrackerUpdatePayload): Promise<ExternalTrackerUserStatus> {
    let anilistStatus: string | undefined = undefined;

    if (payload.status) {
      const s = payload.status.toUpperCase();
      if (s === 'READING' || s === 'CURRENT') anilistStatus = 'CURRENT';
      else if (s === 'COMPLETED') anilistStatus = 'COMPLETED';
      else if (s === 'ON_HOLD' || s === 'PAUSED') anilistStatus = 'PAUSED';
      else if (s === 'DROPPED') anilistStatus = 'DROPPED';
      else if (s === 'PLAN_TO_READ' || s === 'PLANNING') anilistStatus = 'PLANNING';
      else if (s === 'REPEATING') anilistStatus = 'REPEATING';
      else anilistStatus = 'CURRENT';
    }

    const mutation = `
      mutation (
        $mediaId: Int,
        $status: MediaListStatus,
        $score: Float,
        $progress: Int,
        $progressVolumes: Int
      ) {
        SaveMediaListEntry(
          mediaId: $mediaId,
          status: $status,
          score: $score,
          progress: $progress,
          progressVolumes: $progressVolumes
        ) {
          id
          mediaId
          status
          score(format: POINT_10_DECIMAL)
          progress
          progressVolumes
          updatedAt
        }
      }
    `;

    const variables: Record<string, any> = {
      mediaId: payload.mediaId
    };

    if (anilistStatus) variables['status'] = anilistStatus;
    if (payload.score != null) variables['score'] = payload.score;
    if (payload.chaptersRead != null) variables['progress'] = payload.chaptersRead;
    if (payload.volumesRead != null) variables['progressVolumes'] = payload.volumesRead;

    const data = await this.queryGraphQL<{
      SaveMediaListEntry: {
        id: number;
        mediaId: number;
        status: string;
        score?: number | null;
        progress?: number | null;
        progressVolumes?: number | null;
        updatedAt?: number | null;
      };
    }>(mutation, variables, true);

    const entry = data.SaveMediaListEntry;

    return {
      inList: true,
      status: entry.status || null,
      score: entry.score != null ? entry.score : null,
      chaptersRead: entry.progress ?? 0,
      volumesRead: entry.progressVolumes ?? 0,
      updatedAt: entry.updatedAt ? new Date(entry.updatedAt * 1000).toISOString() : null
    };
  }
}
