import { Injectable, inject } from '@angular/core';
import {
  ReaderTouchType,
  TouchPosition,
  TouchScreen,
  TouchZoneMap
} from '../models';
import { SettingsService } from './settings.service';

/** Landscape-style columns: 20% | 60% | 20%. */
export const TOUCH_COL_SIDE = 0.2;
/** Fixed top/bottom strip height in CSS pixels (desktop landscape equivalent). */
export const TOUCH_ROW_EDGE_PX = 88;
/** Minimum side column width in CSS pixels. */
export const TOUCH_COL_SIDE_MIN_PX = 160;

export const TOUCH_DEMO_FADE_MS = 300;
export const TOUCH_DEMO_HOLD_MS = 5000;
export const TOUCH_DOUBLE_CLICK_MS = 280;

export interface TouchZoneMeta {
  action: TouchScreen;
  label: string;
  /** Heroicons-style path(s) for a 24×24 outline icon. */
  iconPaths: string[];
}

const CONFIGURABLE_POSITIONS: Exclude<TouchPosition, TouchPosition.CENTER>[] = [
  TouchPosition.TOP,
  TouchPosition.CORNER_TOP_LEFT,
  TouchPosition.CORNER_TOP_RIGHT,
  TouchPosition.LEFT,
  TouchPosition.RIGHT,
  TouchPosition.BOTTOM,
  TouchPosition.CORNER_BOTTOM_LEFT,
  TouchPosition.CORNER_BOTTOM_RIGHT
];

const MANGA_DEFAULTS: TouchZoneMap = {
  [TouchPosition.TOP]: TouchScreen.SHARE_IMAGE,
  [TouchPosition.CORNER_TOP_LEFT]: TouchScreen.FIT_WIDTH,
  [TouchPosition.CORNER_TOP_RIGHT]: TouchScreen.ASPECT_FIT,
  [TouchPosition.LEFT]: TouchScreen.PREVIOUS_PAGE,
  [TouchPosition.RIGHT]: TouchScreen.NEXT_PAGE,
  [TouchPosition.BOTTOM]: TouchScreen.CHAPTER_LIST,
  [TouchPosition.CORNER_BOTTOM_LEFT]: TouchScreen.PREVIOUS_FILE,
  [TouchPosition.CORNER_BOTTOM_RIGHT]: TouchScreen.NEXT_FILE
};

const BOOK_DEFAULTS: TouchZoneMap = {
  [TouchPosition.TOP]: TouchScreen.PAGE_MARK,
  [TouchPosition.CORNER_TOP_LEFT]: TouchScreen.PREVIOUS_PAGE,
  [TouchPosition.CORNER_TOP_RIGHT]: TouchScreen.NEXT_PAGE,
  [TouchPosition.LEFT]: TouchScreen.PREVIOUS_PAGE,
  [TouchPosition.RIGHT]: TouchScreen.NEXT_PAGE,
  [TouchPosition.BOTTOM]: TouchScreen.CHAPTER_LIST,
  [TouchPosition.CORNER_BOTTOM_LEFT]: TouchScreen.PREVIOUS_FILE,
  [TouchPosition.CORNER_BOTTOM_RIGHT]: TouchScreen.NEXT_FILE
};

const ACTION_META: Record<TouchScreen, TouchZoneMeta> = {
  [TouchScreen.NOT_IMPLEMENTED]: {
    action: TouchScreen.NOT_IMPLEMENTED,
    label: 'Mostrar / ocultar controles',
    iconPaths: [
      'M4 8V4h4M20 8V4h-4M4 16v4h4m12-4v4h-4'
    ]
  },
  [TouchScreen.NOT_ASSIGNED]: {
    action: TouchScreen.NOT_ASSIGNED,
    label: 'Não atribuído',
    iconPaths: ['M6 18L18 6M6 6l12 12']
  },
  [TouchScreen.ASPECT_FIT]: {
    action: TouchScreen.ASPECT_FIT,
    label: 'Melhor aspecto',
    iconPaths: [
      'M4 8V4h4M20 8V4h-4M4 16v4h4m12-4v4h-4',
      'M9 9h6v6H9z'
    ]
  },
  [TouchScreen.FIT_WIDTH]: {
    action: TouchScreen.FIT_WIDTH,
    label: 'Ajustar à largura',
    iconPaths: ['M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4']
  },
  [TouchScreen.CHAPTER_LIST]: {
    action: TouchScreen.CHAPTER_LIST,
    label: 'Lista de capítulos',
    iconPaths: ['M4 6h16M4 10h16M4 14h10M4 18h10']
  },
  [TouchScreen.NEXT_FILE]: {
    action: TouchScreen.NEXT_FILE,
    label: 'Próximo arquivo',
    iconPaths: ['M13 5l7 7-7 7M5 5l7 7-7 7']
  },
  [TouchScreen.PREVIOUS_FILE]: {
    action: TouchScreen.PREVIOUS_FILE,
    label: 'Arquivo anterior',
    iconPaths: ['M11 19l-7-7 7-7m8 14l-7-7 7-7']
  },
  [TouchScreen.NEXT_PAGE]: {
    action: TouchScreen.NEXT_PAGE,
    label: 'Próxima página',
    iconPaths: ['M9 5l7 7-7 7']
  },
  [TouchScreen.PREVIOUS_PAGE]: {
    action: TouchScreen.PREVIOUS_PAGE,
    label: 'Página anterior',
    iconPaths: ['M15 19l-7-7 7-7']
  },
  [TouchScreen.SHARE_IMAGE]: {
    action: TouchScreen.SHARE_IMAGE,
    label: 'Compartilhar imagem',
    iconPaths: [
      'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z'
    ]
  },
  [TouchScreen.PAGE_MARK]: {
    action: TouchScreen.PAGE_MARK,
    label: 'Marcar página',
    iconPaths: ['M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z']
  }
};

@Injectable({
  providedIn: 'root'
})
export class TouchZoneService {
  private settings = inject(SettingsService);

  getConfigurablePositions(): Exclude<TouchPosition, TouchPosition.CENTER>[] {
    return [...CONFIGURABLE_POSITIONS];
  }

  getDefaults(type: ReaderTouchType): TouchZoneMap {
    return { ...(type === 'manga' ? MANGA_DEFAULTS : BOOK_DEFAULTS) };
  }

  getMap(type: ReaderTouchType): TouchZoneMap {
    const stored = type === 'manga'
      ? this.settings.mangaTouchMap()
      : this.settings.bookTouchMap();
    return this.normalizeMap(stored, type);
  }

  saveMap(type: ReaderTouchType, map: TouchZoneMap): void {
    const normalized = this.normalizeMap(map, type);
    if (type === 'manga') {
      this.settings.mangaTouchMap.set(normalized);
    } else {
      this.settings.bookTouchMap.set(normalized);
    }
  }

  resetToDefault(type: ReaderTouchType): TouchZoneMap {
    const defaults = this.getDefaults(type);
    this.saveMap(type, defaults);
    return defaults;
  }

  isDemoShown(type: ReaderTouchType): boolean {
    return type === 'manga'
      ? this.settings.mangaTouchDemoShown()
      : this.settings.bookTouchDemoShown();
  }

  markDemoShown(type: ReaderTouchType): void {
    if (type === 'manga') {
      this.settings.mangaTouchDemoShown.set(true);
    } else {
      this.settings.bookTouchDemoShown.set(true);
    }
  }

  getAction(type: ReaderTouchType, position: TouchPosition): TouchScreen {
    if (position === TouchPosition.CENTER) {
      return TouchScreen.NOT_IMPLEMENTED;
    }
    return this.getMap(type)[position];
  }

  getMeta(action: TouchScreen): TouchZoneMeta {
    return ACTION_META[action] ?? ACTION_META[TouchScreen.NOT_ASSIGNED];
  }

  /** Actions available in the config picker (excludes CENTER placeholder). */
  getAssignableActions(): TouchZoneMeta[] {
    return Object.values(ACTION_META)
      .filter(m => m.action !== TouchScreen.NOT_IMPLEMENTED)
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }

  /**
   * Hit-test matching the CSS grid used by overlay/config:
   * columns 20%|60%|20% (min side 160px), top/bottom strips 88px.
   */
  resolveTouchPosition(
    localX: number,
    localY: number,
    width: number,
    height: number
  ): TouchPosition {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    const sideW = Math.min(Math.max(w * TOUCH_COL_SIDE, TOUCH_COL_SIDE_MIN_PX), w / 3);
    const edgeH = Math.min(TOUCH_ROW_EDGE_PX, h / 4);

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
  }

  /**
   * Whether a corner cell should be hidden in the demo overlay
   * (matches Android: hide if NOT_ASSIGNED or same as adjacent edge).
   */
  shouldHideCorner(
    map: TouchZoneMap,
    corner: TouchPosition.CORNER_TOP_LEFT
      | TouchPosition.CORNER_TOP_RIGHT
      | TouchPosition.CORNER_BOTTOM_LEFT
      | TouchPosition.CORNER_BOTTOM_RIGHT
  ): boolean {
    const action = map[corner];
    if (action === TouchScreen.NOT_ASSIGNED) return true;

    switch (corner) {
      case TouchPosition.CORNER_TOP_LEFT:
        return action === map[TouchPosition.LEFT] || action === map[TouchPosition.TOP];
      case TouchPosition.CORNER_TOP_RIGHT:
        return action === map[TouchPosition.RIGHT] || action === map[TouchPosition.TOP];
      case TouchPosition.CORNER_BOTTOM_LEFT:
        return action === map[TouchPosition.LEFT] || action === map[TouchPosition.BOTTOM];
      case TouchPosition.CORNER_BOTTOM_RIGHT:
        return action === map[TouchPosition.RIGHT] || action === map[TouchPosition.BOTTOM];
    }
  }

  /** CSS grid template values shared by overlay and config. */
  gridStyle(width: number, height: number): { columns: string; rows: string } {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    const sideW = Math.min(Math.max(w * TOUCH_COL_SIDE, TOUCH_COL_SIDE_MIN_PX), w / 3);
    const edgeH = Math.min(TOUCH_ROW_EDGE_PX, h / 4);
    return {
      columns: `${sideW}px 1fr ${sideW}px`,
      rows: `${edgeH}px 1fr ${edgeH}px`
    };
  }

  private normalizeMap(raw: Partial<TouchZoneMap> | null | undefined, type: ReaderTouchType): TouchZoneMap {
    const defaults = this.getDefaults(type);
    const result = { ...defaults };
    if (!raw) return result;

    for (const pos of CONFIGURABLE_POSITIONS) {
      const value = raw[pos];
      if (value && Object.values(TouchScreen).includes(value) && value !== TouchScreen.NOT_IMPLEMENTED) {
        result[pos] = value;
      }
    }
    return result;
  }
}
