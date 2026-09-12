import { ipcMain } from 'electron';
import { StorageService } from '../database/storage.service';
import { TrackerService } from '../services/tracker.service';
import { MalService } from '../services/mal.service';
import { AnilistService } from '../services/anilist.service';
import { Track, ExternalTrackerUpdatePayload } from '../../src/app/core/models/entities/track.model';

export class TrackerController {
  private trackerService: TrackerService;
  private malService: MalService;
  private anilistService: AnilistService;

  constructor(private storage: StorageService) {
    this.trackerService = new TrackerService(this.storage);
    this.malService = MalService.instance;
    this.anilistService = AnilistService.instance;
  }

  public registerIpcHandlers(): void {
    ipcMain.handle('tracker:listAll', async () => {
      return this.trackerService.getAllTracksWithMetadata();
    });

    ipcMain.handle('tracker:listByLibrary', async (_event, libraryId: number) => {
      return this.storage.getTracksByLibrary(libraryId);
    });

    ipcMain.handle('tracker:listLibraries', async () => {
      return this.trackerService.listLibrariesFormatted();
    });

    ipcMain.handle(
      'tracker:getMatchedMedia',
      async (
        _event,
        payload: {
          libraryId: number;
          titleRegex: string;
          title?: string | null;
          malId?: number | null;
        }
      ) => {
        return this.trackerService.getMatchedMedia(
          payload.libraryId,
          payload.titleRegex,
          payload.title,
          payload.malId
        );
      }
    );

    ipcMain.handle('tracker:get', async (_event, id: number) => {
      return this.storage.getTrackById(id);
    });

    ipcMain.handle('tracker:save', async (_event, track: Partial<Track>) => {
      const id = this.storage.saveTrack(track);
      return this.storage.getTrackById(id);
    });

    ipcMain.handle('tracker:delete', async (_event, id: number) => {
      this.storage.deleteTrack(id);
      return true;
    });

    ipcMain.handle(
      'tracker:match',
      async (
        _event,
        payload: {
          libraryId: number;
          title: string;
          filename: string;
          comicInfoMalId?: number | null;
          comicInfoTitle?: string | null;
        }
      ) => {
        return this.trackerService.matchTrack(
          payload.libraryId,
          payload.title,
          payload.filename,
          payload.comicInfoMalId,
          payload.comicInfoTitle
        );
      }
    );

    ipcMain.handle(
      'tracker:updateProgress',
      async (
        _event,
        payload: {
          id: number;
          chaptersRead: number;
          volumesRead: number;
          status?: string;
        }
      ) => {
        this.storage.updateTrackProgress(
          payload.id,
          payload.chaptersRead,
          payload.volumesRead,
          payload.status
        );
        return this.storage.getTrackById(payload.id);
      }
    );

    /* ================= MyAnimeList Handlers ================= */
    ipcMain.handle('mal:getAuthStatus', async () => {
      return await this.malService.getAuthStatus();
    });

    ipcMain.handle('mal:login', async () => {
      return await this.malService.login();
    });

    ipcMain.handle('mal:logout', async () => {
      await this.malService.logout();
      return true;
    });

    ipcMain.handle('mal:search', async (_event, query: string, limit?: number) => {
      return await this.malService.search(query, limit);
    });

    ipcMain.handle('mal:getUserStatus', async (_event, malId: number) => {
      return await this.malService.getUserStatus(malId);
    });

    ipcMain.handle('mal:updateUserStatus', async (_event, payload: ExternalTrackerUpdatePayload) => {
      return await this.malService.updateUserStatus(payload);
    });

    /* ================= AniList Handlers ================= */
    ipcMain.handle('anilist:getAuthStatus', async () => {
      return await this.anilistService.getAuthStatus();
    });

    ipcMain.handle('anilist:login', async () => {
      return await this.anilistService.login();
    });

    ipcMain.handle('anilist:logout', async () => {
      await this.anilistService.logout();
      return true;
    });

    ipcMain.handle('anilist:search', async (_event, query: string, limit?: number) => {
      return await this.anilistService.search(query, limit);
    });

    ipcMain.handle('anilist:getUserStatus', async (_event, mediaId: number) => {
      return await this.anilistService.getUserStatus(mediaId);
    });

    ipcMain.handle('anilist:updateUserStatus', async (_event, payload: ExternalTrackerUpdatePayload) => {
      return await this.anilistService.updateUserStatus(payload);
    });
  }
}

