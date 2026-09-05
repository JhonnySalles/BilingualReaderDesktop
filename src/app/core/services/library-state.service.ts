import { Injectable, signal, computed } from '@angular/core';
import { LibraryViewType, OrderType } from '../models';

export interface ActiveLibraryInfo {
  id: string;
  name: string;
  type: 'manga' | 'book';
  count: number;
}

@Injectable({
  providedIn: 'root'
})
export class LibraryStateService {
  // Global search query
  searchQuery = signal<string>('');

  // Active Library State
  activeLibrary = signal<ActiveLibraryInfo>({
    id: 'home',
    name: 'Início',
    type: 'manga',
    count: 0
  });

  // Separate view types for Manga and Book
  mangaView = signal<LibraryViewType>(LibraryViewType.GRID_MEDIUM);
  bookView = signal<LibraryViewType>(LibraryViewType.GRID_MEDIUM);

  // Separate sorting for Manga and Book
  mangaOrder = signal<OrderType>(OrderType.Name);
  bookOrder = signal<OrderType>(OrderType.Name);

  mangaIsAscending = signal<boolean>(true);
  bookIsAscending = signal<boolean>(true);

  // Computed signals for current active library type
  currentView = computed(() => {
    return this.activeLibrary().type === 'book' ? this.bookView() : this.mangaView();
  });

  currentOrder = computed(() => {
    return this.activeLibrary().type === 'book' ? this.bookOrder() : this.mangaOrder();
  });

  isAscending = computed(() => {
    return this.activeLibrary().type === 'book' ? this.bookIsAscending() : this.mangaIsAscending();
  });

  // Modal control
  showFilterModal = signal<boolean>(false);

  // Getters for specific type
  getView(type?: 'manga' | 'book'): LibraryViewType {
    const targetType = type || this.activeLibrary().type;
    return targetType === 'book' ? this.bookView() : this.mangaView();
  }

  getOrder(type?: 'manga' | 'book'): OrderType {
    const targetType = type || this.activeLibrary().type;
    return targetType === 'book' ? this.bookOrder() : this.mangaOrder();
  }

  getIsAscending(type?: 'manga' | 'book'): boolean {
    const targetType = type || this.activeLibrary().type;
    return targetType === 'book' ? this.bookIsAscending() : this.mangaIsAscending();
  }

  // Setters
  setCurrentView(view: LibraryViewType, type?: 'manga' | 'book') {
    const targetType = type || this.activeLibrary().type;
    if (targetType === 'book') {
      this.bookView.set(view);
    } else {
      this.mangaView.set(view);
    }
  }

  setCurrentOrder(order: OrderType, type?: 'manga' | 'book') {
    const targetType = type || this.activeLibrary().type;
    if (targetType === 'book') {
      this.bookOrder.set(order);
    } else {
      this.mangaOrder.set(order);
    }
  }

  setIsAscending(isAsc: boolean, type?: 'manga' | 'book') {
    const targetType = type || this.activeLibrary().type;
    if (targetType === 'book') {
      this.bookIsAscending.set(isAsc);
    } else {
      this.mangaIsAscending.set(isAsc);
    }
  }

  // Toggle View Mode Sequence for active or specified library type
  toggleViewMode(type?: 'manga' | 'book') {
    const targetType = type || this.activeLibrary().type;
    const current = this.getView(targetType);
    const sequence: LibraryViewType[] = [
      LibraryViewType.GRID_BIG,
      LibraryViewType.GRID_MEDIUM,
      LibraryViewType.GRID_OVERLAY,
      LibraryViewType.SEPARATOR_BIG,
      LibraryViewType.SEPARATOR_MEDIUM,
      LibraryViewType.SEPARATOR_OVERLAY,
      LibraryViewType.SEPARATOR_LINE,
      LibraryViewType.LINE
    ];
    const currentIndex = sequence.indexOf(current);
    const nextIndex = (currentIndex + 1) % sequence.length;
    this.setCurrentView(sequence[nextIndex], targetType);
  }

  // Toggle Sort Direction for active or specified library type
  toggleSortDirection(type?: 'manga' | 'book') {
    const targetType = type || this.activeLibrary().type;
    const currentAsc = this.getIsAscending(targetType);
    this.setIsAscending(!currentAsc, targetType);
  }
}

