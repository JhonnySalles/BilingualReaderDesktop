import { Injectable, signal, computed, effect, inject, ApplicationRef } from '@angular/core';
import { LibraryViewType, OrderType } from '../models';
import { LayoutAnimationService } from './layout-animation.service';

export interface ActiveLibraryInfo {
  id: string;
  name: string;
  type: 'manga' | 'book';
  count: number;
}

export type LibraryContext = 'manga' | 'book' | 'history-manga' | 'history-book';

const STORAGE_KEY = 'bilingual_reader_library_view_settings';

interface StoredViewPreferences {
  mangaView?: LibraryViewType;
  mangaOrder?: OrderType;
  mangaIsAscending?: boolean;
  bookView?: LibraryViewType;
  bookOrder?: OrderType;
  bookIsAscending?: boolean;
  historyMangaView?: LibraryViewType;
  historyBookView?: LibraryViewType;
  historyMangaOrder?: OrderType;
  historyBookOrder?: OrderType;
  historyMangaIsAscending?: boolean;
  historyBookIsAscending?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LibraryStateService {
  // Global search query (raw input text)
  searchQuery = signal<string>('');
  /** Debounced / committed query used for list filtering (pauses during incomplete @). */
  filterQuery = signal<string>('');

  clearSearch(): void {
    this.searchQuery.set('');
    this.filterQuery.set('');
  }

  // Active Library Information (when browsing libraries)
  activeLibrary = signal<ActiveLibraryInfo>({
    id: 'home',
    name: 'Início',
    type: 'manga',
    count: 0
  });

  // Current active screen context
  activeContext = signal<LibraryContext>('manga');

  // Separate view types for Manga, Book, History Manga, and History Book
  mangaView = signal<LibraryViewType>(LibraryViewType.GRID_MEDIUM);
  bookView = signal<LibraryViewType>(LibraryViewType.GRID_MEDIUM);
  historyMangaView = signal<LibraryViewType>(LibraryViewType.SEPARATOR_MEDIUM);
  historyBookView = signal<LibraryViewType>(LibraryViewType.SEPARATOR_MEDIUM);

  // Separate sorting for Manga, Book, History Manga, and History Book
  mangaOrder = signal<OrderType>(OrderType.Name);
  bookOrder = signal<OrderType>(OrderType.Name);
  historyMangaOrder = signal<OrderType>(OrderType.LastAccess);
  historyBookOrder = signal<OrderType>(OrderType.LastAccess);

  mangaIsAscending = signal<boolean>(true);
  bookIsAscending = signal<boolean>(true);
  historyMangaIsAscending = signal<boolean>(false);
  historyBookIsAscending = signal<boolean>(false);

  // Computed signals for current active context
  currentView = computed(() => {
    switch (this.activeContext()) {
      case 'book': return this.bookView();
      case 'history-manga': return this.historyMangaView();
      case 'history-book': return this.historyBookView();
      case 'manga':
      default:
        return this.mangaView();
    }
  });

  currentOrder = computed(() => {
    switch (this.activeContext()) {
      case 'book': return this.bookOrder();
      case 'history-manga': return this.historyMangaOrder();
      case 'history-book': return this.historyBookOrder();
      case 'manga':
      default:
        return this.mangaOrder();
    }
  });

  isAscending = computed(() => {
    switch (this.activeContext()) {
      case 'book': return this.bookIsAscending();
      case 'history-manga': return this.historyMangaIsAscending();
      case 'history-book': return this.historyBookIsAscending();
      case 'manga':
      default:
        return this.mangaIsAscending();
    }
  });

  // Modal control
  showFilterModal = signal<boolean>(false);

  constructor() {
    this.loadPreferences();

    effect(() => {
      const data: StoredViewPreferences = {
        mangaView: this.mangaView(),
        mangaOrder: this.mangaOrder(),
        mangaIsAscending: this.mangaIsAscending(),
        bookView: this.bookView(),
        bookOrder: this.bookOrder(),
        bookIsAscending: this.bookIsAscending(),
        historyMangaView: this.historyMangaView(),
        historyBookView: this.historyBookView(),
        historyMangaOrder: this.historyMangaOrder(),
        historyBookOrder: this.historyBookOrder(),
        historyMangaIsAscending: this.historyMangaIsAscending(),
        historyBookIsAscending: this.historyBookIsAscending()
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.error('Failed to save library view preferences to localStorage', e);
      }
    });
  }

  private loadPreferences(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data: StoredViewPreferences = JSON.parse(raw);

      if (data.mangaView && Object.values(LibraryViewType).includes(data.mangaView)) {
        this.mangaView.set(data.mangaView);
      }
      if (data.mangaOrder && Object.values(OrderType).includes(data.mangaOrder)) {
        this.mangaOrder.set(data.mangaOrder);
      }
      if (typeof data.mangaIsAscending === 'boolean') {
        this.mangaIsAscending.set(data.mangaIsAscending);
      }

      if (data.bookView && Object.values(LibraryViewType).includes(data.bookView)) {
        this.bookView.set(data.bookView);
      }
      if (data.bookOrder && Object.values(OrderType).includes(data.bookOrder)) {
        this.bookOrder.set(data.bookOrder);
      }
      if (typeof data.bookIsAscending === 'boolean') {
        this.bookIsAscending.set(data.bookIsAscending);
      }

      if (data.historyMangaView && Object.values(LibraryViewType).includes(data.historyMangaView)) {
        this.historyMangaView.set(this.sanitizeHistoryView(data.historyMangaView));
      }
      if (data.historyMangaOrder && Object.values(OrderType).includes(data.historyMangaOrder)) {
        this.historyMangaOrder.set(data.historyMangaOrder);
      }
      if (typeof data.historyMangaIsAscending === 'boolean') {
        this.historyMangaIsAscending.set(data.historyMangaIsAscending);
      }

      if (data.historyBookView && Object.values(LibraryViewType).includes(data.historyBookView)) {
        this.historyBookView.set(this.sanitizeHistoryView(data.historyBookView));
      }
      if (data.historyBookOrder && Object.values(OrderType).includes(data.historyBookOrder)) {
        this.historyBookOrder.set(data.historyBookOrder);
      }
      if (typeof data.historyBookIsAscending === 'boolean') {
        this.historyBookIsAscending.set(data.historyBookIsAscending);
      }
    } catch (e) {
      console.error('Failed to load library view preferences from localStorage', e);
    }
  }

  // Ensures history always uses separator-enabled views where dates are shown
  private sanitizeHistoryView(view: LibraryViewType): LibraryViewType {
    switch (view) {
      case LibraryViewType.GRID_BIG:
        return LibraryViewType.SEPARATOR_BIG;
      case LibraryViewType.GRID_MEDIUM:
        return LibraryViewType.SEPARATOR_MEDIUM;
      case LibraryViewType.GRID_SMALL:
        return LibraryViewType.SEPARATOR_SMALL;
      case LibraryViewType.GRID_OVERLAY:
        return LibraryViewType.SEPARATOR_OVERLAY;
      case LibraryViewType.CAROUSEL:
        return LibraryViewType.SEPARATOR_CAROUSEL;
      case LibraryViewType.CAROUSEL_SMALL:
        return LibraryViewType.SEPARATOR_CAROUSEL_SMALL;
      case LibraryViewType.LINE:
        return LibraryViewType.SEPARATOR_LINE;
      default:
        return view;
    }
  }

  // Getters for specific context
  getView(context?: LibraryContext): LibraryViewType {
    const ctx = context || this.activeContext();
    switch (ctx) {
      case 'book': return this.bookView();
      case 'history-manga': return this.historyMangaView();
      case 'history-book': return this.historyBookView();
      case 'manga':
      default:
        return this.mangaView();
    }
  }

  getOrder(context?: LibraryContext): OrderType {
    const ctx = context || this.activeContext();
    switch (ctx) {
      case 'book': return this.bookOrder();
      case 'history-manga': return this.historyMangaOrder();
      case 'history-book': return this.historyBookOrder();
      case 'manga':
      default:
        return this.mangaOrder();
    }
  }

  getIsAscending(context?: LibraryContext): boolean {
    const ctx = context || this.activeContext();
    switch (ctx) {
      case 'book': return this.bookIsAscending();
      case 'history-manga': return this.historyMangaIsAscending();
      case 'history-book': return this.historyBookIsAscending();
      case 'manga':
      default:
        return this.mangaIsAscending();
    }
  }

  private layoutAnimation = inject(LayoutAnimationService);
  private appRef = inject(ApplicationRef);

  // Card resize state for backward compatibility
  cardResizeState = signal<'shrink' | 'grow' | null>(null);
  // Card morph state for grid <-> blur transition ('to-blur' | 'to-standard' | null)
  cardMorphState = signal<'to-blur' | 'to-standard' | null>(null);

  private morphTimeout: any = null;

  private isBlurView(view: LibraryViewType): boolean {
    return view === LibraryViewType.GRID_OVERLAY || view === LibraryViewType.SEPARATOR_OVERLAY;
  }

  private triggerMorphAnimation(dir: 'to-blur' | 'to-standard'): void {
    if (this.morphTimeout) clearTimeout(this.morphTimeout);
    this.cardMorphState.set(dir);
    this.morphTimeout = setTimeout(() => {
      this.cardMorphState.set(null);
      this.morphTimeout = null;
    }, 500);
  }

  // Setters
  setCurrentView(view: LibraryViewType, context?: LibraryContext) {
    const ctx = context || this.activeContext();
    const prevView = this.getView(ctx);
    if (prevView === view) return;

    // 1. Capture screen positions of visible cards prior to DOM mutation (FIRST)
    this.layoutAnimation.capture();

    const prevWasBlur = this.isBlurView(prevView);
    const newIsBlur = this.isBlurView(view);

    // Detect blur change for inner card collapse and gradient activation
    if (!prevWasBlur && newIsBlur) {
      this.triggerMorphAnimation('to-blur');
    } else if (prevWasBlur && !newIsBlur) {
      this.triggerMorphAnimation('to-standard');
    }

    switch (ctx) {
      case 'book':
        this.bookView.set(view);
        break;
      case 'history-manga':
        this.historyMangaView.set(this.sanitizeHistoryView(view));
        break;
      case 'history-book':
        this.historyBookView.set(this.sanitizeHistoryView(view));
        break;
      case 'manga':
      default:
        this.mangaView.set(view);
        break;
    }

    // 2. Synchronously flush DOM mutations before Chromium can paint an intermediate frame
    try {
      this.appRef.tick();
    } catch (e) {
      // In case tick is already running or handled
    }

    // 3. Execute FLIP layout animation (LAST, INVERT, PLAY) synchronously
    this.layoutAnimation.playSync();
  }

  setCurrentOrder(order: OrderType, context?: LibraryContext) {
    const ctx = context || this.activeContext();
    switch (ctx) {
      case 'book':
        this.bookOrder.set(order);
        break;
      case 'history-manga':
        this.historyMangaOrder.set(order);
        break;
      case 'history-book':
        this.historyBookOrder.set(order);
        break;
      case 'manga':
      default:
        this.mangaOrder.set(order);
        break;
    }
  }

  setIsAscending(isAsc: boolean, context?: LibraryContext) {
    const ctx = context || this.activeContext();
    switch (ctx) {
      case 'book':
        this.bookIsAscending.set(isAsc);
        break;
      case 'history-manga':
        this.historyMangaIsAscending.set(isAsc);
        break;
      case 'history-book':
        this.historyBookIsAscending.set(isAsc);
        break;
      case 'manga':
      default:
        this.mangaIsAscending.set(isAsc);
        break;
    }
  }

  // Toggle View Mode Sequence for active or specified context
  toggleViewMode(context?: LibraryContext) {
    const ctx = context || this.activeContext();
    const current = this.getView(ctx);

    const isHistory = ctx === 'history-manga' || ctx === 'history-book';
    const sequence: LibraryViewType[] = isHistory
      ? [
          LibraryViewType.SEPARATOR_BIG,
          LibraryViewType.SEPARATOR_MEDIUM,
          LibraryViewType.SEPARATOR_SMALL,
          LibraryViewType.SEPARATOR_OVERLAY,
          LibraryViewType.SEPARATOR_CAROUSEL,
          LibraryViewType.SEPARATOR_CAROUSEL_SMALL,
          LibraryViewType.SEPARATOR_LINE
        ]
      : [
          LibraryViewType.GRID_BIG,
          LibraryViewType.GRID_MEDIUM,
          LibraryViewType.GRID_SMALL,
          LibraryViewType.GRID_OVERLAY,
          LibraryViewType.CAROUSEL,
          LibraryViewType.CAROUSEL_SMALL,
          LibraryViewType.LINE,
          LibraryViewType.SEPARATOR_BIG,
          LibraryViewType.SEPARATOR_MEDIUM,
          LibraryViewType.SEPARATOR_SMALL,
          LibraryViewType.SEPARATOR_OVERLAY,
          LibraryViewType.SEPARATOR_CAROUSEL,
          LibraryViewType.SEPARATOR_CAROUSEL_SMALL,
          LibraryViewType.SEPARATOR_LINE
        ];

    const currentIndex = sequence.indexOf(current);
    const nextIndex = (currentIndex + 1) % sequence.length;
    this.setCurrentView(sequence[nextIndex], ctx);
  }

  // Toggle Sort Direction for active or specified context
  toggleSortDirection(context?: LibraryContext) {
    const ctx = context || this.activeContext();
    const currentAsc = this.getIsAscending(ctx);
    this.setIsAscending(!currentAsc, ctx);
  }
}
