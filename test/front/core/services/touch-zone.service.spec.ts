import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TouchZoneService, TOUCH_COL_SIDE, TOUCH_COL_SIDE_MIN_PX, TOUCH_ROW_EDGE_PX } from '../../../../src/app/core/services/touch-zone.service';
import { SettingsService } from '../../../../src/app/core/services/settings.service';
import { TouchPosition, TouchScreen, TouchZoneMap } from '../../../../src/app/core/models';

describe('TouchZoneService', () => {
  let service: TouchZoneService;
  let mockSettingsService: any;

  beforeEach(() => {
    mockSettingsService = {
      mangaTouchMap: signal<TouchZoneMap>({
        [TouchPosition.TOP]: TouchScreen.SHARE_IMAGE,
        [TouchPosition.CORNER_TOP_LEFT]: TouchScreen.FIT_WIDTH,
        [TouchPosition.CORNER_TOP_RIGHT]: TouchScreen.ASPECT_FIT,
        [TouchPosition.LEFT]: TouchScreen.PREVIOUS_PAGE,
        [TouchPosition.RIGHT]: TouchScreen.NEXT_PAGE,
        [TouchPosition.BOTTOM]: TouchScreen.CHAPTER_LIST,
        [TouchPosition.CORNER_BOTTOM_LEFT]: TouchScreen.PREVIOUS_FILE,
        [TouchPosition.CORNER_BOTTOM_RIGHT]: TouchScreen.NEXT_FILE
      }),
      bookTouchMap: signal<TouchZoneMap>({
        [TouchPosition.TOP]: TouchScreen.PAGE_MARK,
        [TouchPosition.CORNER_TOP_LEFT]: TouchScreen.PREVIOUS_PAGE,
        [TouchPosition.CORNER_TOP_RIGHT]: TouchScreen.NEXT_PAGE,
        [TouchPosition.LEFT]: TouchScreen.PREVIOUS_PAGE,
        [TouchPosition.RIGHT]: TouchScreen.NEXT_PAGE,
        [TouchPosition.BOTTOM]: TouchScreen.CHAPTER_LIST,
        [TouchPosition.CORNER_BOTTOM_LEFT]: TouchScreen.PREVIOUS_FILE,
        [TouchPosition.CORNER_BOTTOM_RIGHT]: TouchScreen.NEXT_FILE
      }),
      mangaTouchDemoShown: signal(false),
      bookTouchDemoShown: signal(false)
    };

    TestBed.configureTestingModule({
      providers: [
        TouchZoneService,
        { provide: SettingsService, useValue: mockSettingsService }
      ]
    });

    service = TestBed.inject(TouchZoneService);
  });

  describe('defaults & map retrieval', () => {
    it('should return 8 configurable positions excluding CENTER', () => {
      const positions = service.getConfigurablePositions();
      expect(positions.length).toBe(8);
      expect((positions as TouchPosition[])).not.toContain(TouchPosition.CENTER);
    });

    it('should return correct defaults for manga and book', () => {
      const mangaDefaults = service.getDefaults('manga');
      const bookDefaults = service.getDefaults('book');

      expect(mangaDefaults[TouchPosition.TOP]).toBe(TouchScreen.SHARE_IMAGE);
      expect(mangaDefaults[TouchPosition.CORNER_TOP_LEFT]).toBe(TouchScreen.FIT_WIDTH);

      expect(bookDefaults[TouchPosition.TOP]).toBe(TouchScreen.PAGE_MARK);
      expect(bookDefaults[TouchPosition.CORNER_TOP_LEFT]).toBe(TouchScreen.PREVIOUS_PAGE);
    });

    it('should get normalized map from settings', () => {
      const map = service.getMap('manga');
      expect(map[TouchPosition.LEFT]).toBe(TouchScreen.PREVIOUS_PAGE);
      expect(map[TouchPosition.RIGHT]).toBe(TouchScreen.NEXT_PAGE);
    });

    it('should save and reset map correctly', () => {
      const customMap: TouchZoneMap = {
        ...service.getDefaults('manga'),
        [TouchPosition.TOP]: TouchScreen.NOT_ASSIGNED
      };

      service.saveMap('manga', customMap);
      expect(mockSettingsService.mangaTouchMap()).toEqual(customMap);

      service.resetToDefault('manga');
      expect(mockSettingsService.mangaTouchMap()).toEqual(service.getDefaults('manga'));
    });
  });

  describe('demo overlay state', () => {
    it('should check and mark demo as shown', () => {
      expect(service.isDemoShown('manga')).toBe(false);
      service.markDemoShown('manga');
      expect(mockSettingsService.mangaTouchDemoShown()).toBe(true);
      expect(service.isDemoShown('manga')).toBe(true);

      expect(service.isDemoShown('book')).toBe(false);
      service.markDemoShown('book');
      expect(mockSettingsService.bookTouchDemoShown()).toBe(true);
    });
  });

  describe('getAction & getMeta', () => {
    it('should return NOT_IMPLEMENTED for CENTER position', () => {
      expect(service.getAction('manga', TouchPosition.CENTER)).toBe(TouchScreen.NOT_IMPLEMENTED);
    });

    it('should return mapped action for corner and side positions', () => {
      expect(service.getAction('manga', TouchPosition.LEFT)).toBe(TouchScreen.PREVIOUS_PAGE);
      expect(service.getAction('book', TouchPosition.TOP)).toBe(TouchScreen.PAGE_MARK);
    });

    it('should return metadata and list assignable actions', () => {
      const meta = service.getMeta(TouchScreen.NEXT_PAGE);
      expect(meta.label).toBe('Próxima página');
      expect(meta.iconPaths.length).toBeGreaterThan(0);

      const assignable = service.getAssignableActions();
      expect(assignable.some(a => a.action === TouchScreen.NOT_IMPLEMENTED)).toBe(false);
      expect(assignable.some(a => a.action === TouchScreen.NEXT_PAGE)).toBe(true);
    });
  });

  describe('resolveTouchPosition (Geometry & Hit-box)', () => {
    const width = 1000;
    const height = 800;

    it('should resolve corners correctly', () => {
      // Top-Left: x=50 (< 200px), y=40 (<= 88px)
      expect(service.resolveTouchPosition(50, 40, width, height)).toBe(TouchPosition.CORNER_TOP_LEFT);

      // Top-Right: x=950 (> 800px), y=40 (<= 88px)
      expect(service.resolveTouchPosition(950, 40, width, height)).toBe(TouchPosition.CORNER_TOP_RIGHT);

      // Bottom-Left: x=50 (< 200px), y=760 (>= 712px)
      expect(service.resolveTouchPosition(50, 760, width, height)).toBe(TouchPosition.CORNER_BOTTOM_LEFT);

      // Bottom-Right: x=950 (> 800px), y=760 (>= 712px)
      expect(service.resolveTouchPosition(950, 760, width, height)).toBe(TouchPosition.CORNER_BOTTOM_RIGHT);
    });

    it('should resolve edges correctly', () => {
      // Top Edge: x=500, y=40
      expect(service.resolveTouchPosition(500, 40, width, height)).toBe(TouchPosition.TOP);

      // Bottom Edge: x=500, y=760
      expect(service.resolveTouchPosition(500, 760, width, height)).toBe(TouchPosition.BOTTOM);

      // Left Edge: x=50, y=400
      expect(service.resolveTouchPosition(50, 400, width, height)).toBe(TouchPosition.LEFT);

      // Right Edge: x=950, y=400
      expect(service.resolveTouchPosition(950, 400, width, height)).toBe(TouchPosition.RIGHT);
    });

    it('should resolve Center correctly', () => {
      // Center: x=500, y=400
      expect(service.resolveTouchPosition(500, 400, width, height)).toBe(TouchPosition.CENTER);
    });

    it('should clamp out-of-bound coordinates gracefully', () => {
      expect(service.resolveTouchPosition(-100, -100, width, height)).toBe(TouchPosition.CORNER_TOP_LEFT);
      expect(service.resolveTouchPosition(2000, 2000, width, height)).toBe(TouchPosition.CORNER_BOTTOM_RIGHT);
    });
  });

  describe('shouldHideCorner', () => {
    it('should return true if corner action is NOT_ASSIGNED', () => {
      const map: TouchZoneMap = {
        ...service.getDefaults('book'),
        [TouchPosition.CORNER_TOP_LEFT]: TouchScreen.NOT_ASSIGNED
      };
      expect(service.shouldHideCorner(map, TouchPosition.CORNER_TOP_LEFT)).toBe(true);
    });

    it('should return true if corner has same action as adjacent edge', () => {
      // In BOOK_DEFAULTS: CORNER_TOP_LEFT is PREVIOUS_PAGE, LEFT is PREVIOUS_PAGE
      const map = service.getDefaults('book');
      expect(service.shouldHideCorner(map, TouchPosition.CORNER_TOP_LEFT)).toBe(true);
    });

    it('should return false if corner has unique distinct action', () => {
      // In MANGA_DEFAULTS: CORNER_TOP_LEFT is FIT_WIDTH, TOP is SHARE_IMAGE, LEFT is PREVIOUS_PAGE
      const map = service.getDefaults('manga');
      expect(service.shouldHideCorner(map, TouchPosition.CORNER_TOP_LEFT)).toBe(false);
    });
  });

  describe('gridStyle', () => {
    it('should compute CSS grid columns and rows', () => {
      const style = service.gridStyle(1000, 800);
      expect(style.columns).toBe('200px 1fr 200px');
      expect(style.rows).toBe('88px 1fr 88px');
    });
  });
});
