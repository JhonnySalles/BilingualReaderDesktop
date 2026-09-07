import { TouchPosition, TouchScreen } from '../../core/models';
import { TouchZoneService } from '../../core/services/touch-zone.service';
import { handleReaderTouchTap, TouchActionHandlers } from './touch-action.util';

/** Minimal stub mirroring default manga LEFT/RIGHT/CENTER behavior. */
function stubTouch(): Pick<TouchZoneService, 'resolveTouchPosition' | 'getAction'> {
  return {
    resolveTouchPosition(localX, localY, width, height) {
      const w = Math.max(1, width);
      const h = Math.max(1, height);
      const sideW = Math.min(Math.max(w * 0.2, 160), w / 3);
      const edgeH = Math.min(88, h / 4);
      const x = Math.min(Math.max(0, localX), w);
      const y = Math.min(Math.max(0, localY), h);
      const isLeft = x < sideW;
      const isRight = x > w - sideW;
      const isTop = y <= edgeH;
      const isBottom = y >= h - edgeH;
      if (isLeft) {
        if (isTop) return TouchPosition.CORNER_TOP_LEFT;
        if (isBottom) return TouchPosition.CORNER_BOTTOM_LEFT;
        return TouchPosition.LEFT;
      }
      if (isRight) {
        if (isTop) return TouchPosition.CORNER_TOP_RIGHT;
        if (isBottom) return TouchPosition.CORNER_BOTTOM_RIGHT;
        return TouchPosition.RIGHT;
      }
      if (isTop) return TouchPosition.TOP;
      if (isBottom) return TouchPosition.BOTTOM;
      return TouchPosition.CENTER;
    },
    getAction(_type, position) {
      if (position === TouchPosition.CENTER) return TouchScreen.NOT_IMPLEMENTED;
      if (position === TouchPosition.LEFT) return TouchScreen.PREVIOUS_PAGE;
      if (position === TouchPosition.RIGHT) return TouchScreen.NEXT_PAGE;
      return TouchScreen.NOT_ASSIGNED;
    }
  };
}

function makeHandlers(overrides: Partial<TouchActionHandlers> = {}): TouchActionHandlers & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    showChrome: () => calls.push('showChrome'),
    hideChrome: () => calls.push('hideChrome'),
    isChromeVisible: () => false,
    goPrevPage: () => calls.push('goPrevPage'),
    goNextPage: () => calls.push('goNextPage'),
    openChapters: () => calls.push('openChapters'),
    markPage: () => calls.push('markPage'),
    ...overrides
  };
}

describe('handleReaderTouchTap (dual viewport 3x3)', () => {
  const touch = stubTouch() as TouchZoneService;
  const W = 1280;
  const H = 800;

  it('shows chrome on center tap when chrome is hidden', () => {
    const handlers = makeHandlers();
    handleReaderTouchTap(touch, 'manga', W / 2, H / 2, W, H, handlers);
    expect(handlers.calls).toEqual(['showChrome']);
  });

  it('hides chrome when chrome is already visible', () => {
    const handlers = makeHandlers({ isChromeVisible: () => true });
    handleReaderTouchTap(touch, 'manga', W / 2, H / 2, W, H, handlers);
    expect(handlers.calls).toEqual(['hideChrome']);
  });

  it('goes previous on left zone', () => {
    const handlers = makeHandlers();
    handleReaderTouchTap(touch, 'manga', 40, H / 2, W, H, handlers);
    expect(handlers.calls).toEqual(['goPrevPage']);
  });

  it('goes next on right zone', () => {
    const handlers = makeHandlers();
    handleReaderTouchTap(touch, 'manga', W - 40, H / 2, W, H, handlers);
    expect(handlers.calls).toEqual(['goNextPage']);
  });
});
