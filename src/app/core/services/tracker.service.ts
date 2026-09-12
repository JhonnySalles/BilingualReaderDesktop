import { Injectable, inject } from '@angular/core';
import { ElectronService } from './electron.service';
import {
  Track,
  TrackerLibraryOption,
  TrackerMatchedItem,
  ExternalTrackerSearchResult,
  ExternalTrackerUserStatus,
  ExternalTrackerUpdatePayload,
  TrackerAuthStatus
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class TrackerService {
  private electronService = inject(ElectronService);

  async getAllTracks(): Promise<Track[]> {
    return await this.electronService.listAllTracks();
  }

  async listLibraries(): Promise<TrackerLibraryOption[]> {
    return await this.electronService.listTrackerLibraries();
  }

  async getMatchedMedia(payload: {
    libraryId: number;
    titleRegex: string;
    title?: string | null;
    malId?: number | null;
  }): Promise<TrackerMatchedItem[]> {
    return await this.electronService.getMatchedMedia(payload);
  }

  async getTracksByLibrary(libraryId: number): Promise<Track[]> {
    return await this.electronService.listTracksByLibrary(libraryId);
  }

  async getTrack(id: number): Promise<Track | null> {
    return await this.electronService.getTrack(id);
  }

  async saveTrack(track: Partial<Track>): Promise<Track | null> {
    return await this.electronService.saveTrack(track);
  }

  async deleteTrack(id: number): Promise<boolean> {
    return await this.electronService.deleteTrack(id);
  }

  async matchTrack(payload: {
    libraryId: number;
    title: string;
    filename: string;
    comicInfoMalId?: number | null;
    comicInfoTitle?: string | null;
  }) {
    return await this.electronService.matchTrack(payload);
  }

  async updateProgress(payload: {
    id: number;
    chaptersRead: number;
    volumesRead: number;
    status?: string;
  }): Promise<Track | null> {
    return await this.electronService.updateTrackProgress(payload);
  }

  /* ================= MyAnimeList APIs ================= */

  /**
   * 1. Obter status da autenticação no MyAnimeList
   */
  async malGetAuthStatus(): Promise<TrackerAuthStatus> {
    return await this.electronService.malGetAuthStatus();
  }

  /**
   * 1. Iniciar login OAuth PKCE no MyAnimeList
   */
  async malLogin(): Promise<TrackerAuthStatus> {
    return await this.electronService.malLogin();
  }

  /**
   * 1. Logout do MyAnimeList
   */
  async malLogout(): Promise<boolean> {
    return await this.electronService.malLogout();
  }

  /**
   * 2. Busca de mangas e novels por nome no MyAnimeList (retorna id, titulo, score, capa, etc.)
   */
  async malSearch(query: string, limit = 20): Promise<ExternalTrackerSearchResult[]> {
    return await this.electronService.malSearch(query, limit);
  }

  /**
   * 3. Obter status da obra na lista do usuário no MyAnimeList (inList, score, volume, capítulo)
   */
  async malGetUserStatus(malId: number): Promise<ExternalTrackerUserStatus> {
    return await this.electronService.malGetUserStatus(malId);
  }

  /**
   * 3.2. Atualizar ou vincular obra na lista do usuário no MyAnimeList
   */
  async malUpdateUserStatus(payload: ExternalTrackerUpdatePayload): Promise<ExternalTrackerUserStatus> {
    return await this.electronService.malUpdateUserStatus(payload);
  }

  /* ================= AniList APIs ================= */

  /**
   * 1. Obter status da autenticação no AniList
   */
  async anilistGetAuthStatus(): Promise<TrackerAuthStatus> {
    return await this.electronService.anilistGetAuthStatus();
  }

  /**
   * 1. Iniciar login OAuth no AniList
   */
  async anilistLogin(): Promise<TrackerAuthStatus> {
    return await this.electronService.anilistLogin();
  }

  /**
   * 1. Logout do AniList
   */
  async anilistLogout(): Promise<boolean> {
    return await this.electronService.anilistLogout();
  }

  /**
   * 2. Busca de mangas e novels por nome no AniList (retorna id, titulo, score, capa, etc.)
   */
  async anilistSearch(query: string, limit = 20): Promise<ExternalTrackerSearchResult[]> {
    return await this.electronService.anilistSearch(query, limit);
  }

  /**
   * 3. Obter status da obra na lista do usuário no AniList (inList, score, volume, capítulo)
   */
  async anilistGetUserStatus(mediaId: number): Promise<ExternalTrackerUserStatus> {
    return await this.electronService.anilistGetUserStatus(mediaId);
  }

  /**
   * 3.2. Atualizar ou vincular obra na lista do usuário no AniList
   */
  async anilistUpdateUserStatus(payload: ExternalTrackerUpdatePayload): Promise<ExternalTrackerUserStatus> {
    return await this.electronService.anilistUpdateUserStatus(payload);
  }

  /**
   * Sincronização automática ou sob demanda de um Track local com as APIs configuradas (MAL e AniList)
   */
  async syncTrackWithExternalServices(track: Track): Promise<{
    malUpdated?: ExternalTrackerUserStatus | null;
    anilistUpdated?: ExternalTrackerUserStatus | null;
    error?: string | null;
  }> {
    const results: {
      malUpdated?: ExternalTrackerUserStatus | null;
      anilistUpdated?: ExternalTrackerUserStatus | null;
      error?: string | null;
    } = {};

    const payload = {
      score: track.score ?? undefined,
      chaptersRead: track.chaptersRead,
      volumesRead: track.volumesRead,
      status: track.status ?? undefined
    };

    if (track.malId) {
      try {
        const malAuth = await this.malGetAuthStatus();
        if (malAuth.authenticated) {
          results.malUpdated = await this.malUpdateUserStatus({
            mediaId: track.malId,
            ...payload
          });
        }
      } catch (e: any) {
        console.warn('[TrackerService] Erro ao sincronizar com MAL:', e);
        results.error = `MAL: ${e?.message || e}`;
      }
    }

    if (track.aniId) {
      try {
        const aniAuth = await this.anilistGetAuthStatus();
        if (aniAuth.authenticated) {
          results.anilistUpdated = await this.anilistUpdateUserStatus({
            mediaId: track.aniId,
            ...payload
          });
        }
      } catch (e: any) {
        console.warn('[TrackerService] Erro ao sincronizar com AniList:', e);
        results.error = (results.error ? results.error + ' | ' : '') + `AniList: ${e?.message || e}`;
      }
    }

    return results;
  }
}

