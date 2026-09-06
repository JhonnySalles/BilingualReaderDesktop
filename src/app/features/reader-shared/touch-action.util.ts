import { ReaderTouchType, TouchPosition, TouchScreen } from '../../core/models';
import { TouchZoneService } from '../../core/services/touch-zone.service';

/** Callbacks each reader must provide for zone action dispatch. */
export interface TouchActionHandlers {
  showChrome: () => void;
  hideChrome: () => void;
  isChromeVisible: () => boolean;
  goPrevPage: () => void;
  goNextPage: () => void;
  openChapters: () => void;
  markPage: () => void;
  /** Manga only — FitWidth */
  fitWidth?: () => void;
  /** Manga only — FitHeight / “melhor aspecto” */
  aspectFit?: () => void;
  /** Optional stubs — show toast / no-op for now */
  previousFile?: () => void;
  nextFile?: () => void;
  shareImage?: () => void;
}

/**
 * Shared single-tap flow:
 * 1. If chrome visible → hide chrome
 * 2. Resolve 3×3 position
 * 3. CENTER → show chrome
 * 4. Else dispatch configured action (unsupported → show chrome)
 */
export function handleReaderTouchTap(
  touch: TouchZoneService,
  type: ReaderTouchType,
  localX: number,
  localY: number,
  width: number,
  height: number,
  handlers: TouchActionHandlers
): void {
  if (handlers.isChromeVisible()) {
    handlers.hideChrome();
    return;
  }

  const position = touch.resolveTouchPosition(localX, localY, width, height);
  if (position === TouchPosition.CENTER) {
    handlers.showChrome();
    return;
  }

  const action = touch.getAction(type, position);
  dispatchTouchAction(type, action, handlers);
}

export function dispatchTouchAction(
  type: ReaderTouchType,
  action: TouchScreen,
  handlers: TouchActionHandlers
): void {
  switch (action) {
    case TouchScreen.PREVIOUS_PAGE:
      handlers.goPrevPage();
      return;
    case TouchScreen.NEXT_PAGE:
      handlers.goNextPage();
      return;
    case TouchScreen.CHAPTER_LIST:
      handlers.openChapters();
      return;
    case TouchScreen.PAGE_MARK:
      handlers.markPage();
      return;
    case TouchScreen.FIT_WIDTH:
      if (type === 'manga' && handlers.fitWidth) {
        handlers.fitWidth();
        return;
      }
      break;
    case TouchScreen.ASPECT_FIT:
      if (type === 'manga' && handlers.aspectFit) {
        handlers.aspectFit();
        return;
      }
      break;
    case TouchScreen.SHARE_IMAGE:
      if (type === 'manga' && handlers.shareImage) {
        handlers.shareImage();
        return;
      }
      break;
    case TouchScreen.PREVIOUS_FILE:
      if (handlers.previousFile) {
        handlers.previousFile();
        return;
      }
      break;
    case TouchScreen.NEXT_FILE:
      if (handlers.nextFile) {
        handlers.nextFile();
        return;
      }
      break;
    case TouchScreen.NOT_ASSIGNED:
    case TouchScreen.NOT_IMPLEMENTED:
    default:
      break;
  }
  // Fallback (Android): exit immersive / show chrome
  handlers.showChrome();
}
