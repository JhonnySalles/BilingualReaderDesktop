import { TestBed } from '@angular/core/testing';
import { TrackerService } from '../../../../src/app/core/services/tracker.service';
import { ElectronService } from '../../../../src/app/core/services/electron.service';
import { Track, TrackerAuthStatus, ExternalTrackerUserStatus } from '../../../../src/app/core/models';

describe('TrackerService (Frontend Angular)', () => {
  let service: TrackerService;
  let mockElectronService: jasmine.SpyObj<ElectronService>;

  beforeEach(() => {
    mockElectronService = jasmine.createSpyObj('ElectronService', [
      'listAllTracks',
      'listTrackerLibraries',
      'getMatchedMedia',
      'listTracksByLibrary',
      'getTrack',
      'saveTrack',
      'deleteTrack',
      'matchTrack',
      'updateTrackProgress',
      'malGetAuthStatus',
      'malLogin',
      'malLogout',
      'malSearch',
      'malGetUserStatus',
      'malUpdateUserStatus',
      'anilistGetAuthStatus',
      'anilistLogin',
      'anilistLogout',
      'anilistSearch',
      'anilistGetUserStatus',
      'anilistUpdateUserStatus',
      'malGetDetails',
      'anilistGetDetails',
      'trackerGetMediaDetails'
    ]);

    TestBed.configureTestingModule({
      providers: [
        TrackerService,
        { provide: ElectronService, useValue: mockElectronService }
      ]
    });

    service = TestBed.inject(TrackerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('syncTrackWithExternalServices', () => {
    const baseTrack: Track = {
      id: 1,
      fkLibrary: 1,
      title: 'One Piece',
      titleRegex: 'One Piece',
      chaptersRead: 100,
      volumesRead: 10,
      score: 10,
      status: 'READING'
    };

    it('should synchronize with MAL when malId exists and authenticated', async () => {
      const track: Track = { ...baseTrack, malId: 13 };
      const authStatus: TrackerAuthStatus = { authenticated: true, username: 'otaku' };
      const userStatus: ExternalTrackerUserStatus = {
        inList: true,
        score: 10,
        chaptersRead: 100,
        volumesRead: 10
      };

      mockElectronService.malGetAuthStatus.and.returnValue(Promise.resolve(authStatus));
      mockElectronService.malUpdateUserStatus.and.returnValue(Promise.resolve(userStatus));

      const result = await service.syncTrackWithExternalServices(track);

      expect(mockElectronService.malGetAuthStatus).toHaveBeenCalled();
      expect(mockElectronService.malUpdateUserStatus).toHaveBeenCalledWith({
        mediaId: 13,
        score: 10,
        chaptersRead: 100,
        volumesRead: 10,
        status: 'READING'
      });
      expect(result.malUpdated).toEqual(userStatus);
    });

    it('should synchronize with AniList when aniId exists and authenticated', async () => {
      const track: Track = { ...baseTrack, aniId: 30013 };
      const authStatus: TrackerAuthStatus = { authenticated: true, username: 'otaku' };
      const userStatus: ExternalTrackerUserStatus = {
        inList: true,
        score: 10,
        chaptersRead: 100,
        volumesRead: 10
      };

      mockElectronService.anilistGetAuthStatus.and.returnValue(Promise.resolve(authStatus));
      mockElectronService.anilistUpdateUserStatus.and.returnValue(Promise.resolve(userStatus));

      const result = await service.syncTrackWithExternalServices(track);

      expect(mockElectronService.anilistGetAuthStatus).toHaveBeenCalled();
      expect(mockElectronService.anilistUpdateUserStatus).toHaveBeenCalledWith({
        mediaId: 30013,
        score: 10,
        chaptersRead: 100,
        volumesRead: 10,
        status: 'READING'
      });
      expect(result.anilistUpdated).toEqual(userStatus);
    });

    it('should catch and record errors without throwing', async () => {
      const track: Track = { ...baseTrack, malId: 13 };
      const authStatus: TrackerAuthStatus = { authenticated: true, username: 'otaku' };

      mockElectronService.malGetAuthStatus.and.returnValue(Promise.resolve(authStatus));
      mockElectronService.malUpdateUserStatus.and.returnValue(Promise.reject(new Error('Network error')));

      const result = await service.syncTrackWithExternalServices(track);

      expect(result.error).toContain('MAL: Network error');
    });
  });
});
