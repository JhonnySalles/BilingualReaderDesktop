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

  // Active view type: GRID vs LIST
  currentView = signal<LibraryViewType>(LibraryViewType.GRID_MEDIUM);

  // Sorting
  currentOrder = signal<OrderType>(OrderType.Name);
  isAscending = signal<boolean>(true);

  // Active Library State
  activeLibrary = signal<ActiveLibraryInfo>({
    id: 'home',
    name: 'Início',
    type: 'manga',
    count: 0
  });

  // Modal control
  showFilterModal = signal<boolean>(false);

  // Toggle View Mode
  toggleViewMode() {
    if (this.currentView() === LibraryViewType.LINE) {
      this.currentView.set(LibraryViewType.GRID_MEDIUM);
    } else {
      this.currentView.set(LibraryViewType.LINE);
    }
  }

  // Toggle Sort Direction
  toggleSortDirection() {
    this.isAscending.set(!this.isAscending());
  }
}
