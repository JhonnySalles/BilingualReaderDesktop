import { TestBed } from '@angular/core/testing';
import { LibraryStateService, LibraryContext } from '../../../../src/app/core/services/library-state.service';
import { LibraryViewType, OrderType } from '../../../../src/app/core/models';

describe('LibraryStateService', () => {
  let service: LibraryStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [LibraryStateService]
    });
    service = TestBed.inject(LibraryStateService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created with default values', () => {
    expect(service).toBeTruthy();
    expect(service.activeContext()).toBe('manga');
    expect(service.currentView()).toBe(LibraryViewType.GRID_MEDIUM);
    expect(service.currentOrder()).toBe(OrderType.Name);
    expect(service.isAscending()).toBe(true);
    expect(service.searchQuery()).toBe('');
  });

  it('should update and clear search queries', () => {
    service.searchQuery.set('One Piece');
    service.filterQuery.set('One Piece');
    expect(service.searchQuery()).toBe('One Piece');
    expect(service.filterQuery()).toBe('One Piece');

    service.clearSearch();
    expect(service.searchQuery()).toBe('');
    expect(service.filterQuery()).toBe('');
  });

  it('should react with computed signals when activeContext changes', () => {
    // Modify Book settings
    service.bookView.set(LibraryViewType.LINE);
    service.bookOrder.set(OrderType.LastAccess);
    service.bookIsAscending.set(false);

    // Context is still 'manga'
    expect(service.currentView()).toBe(LibraryViewType.GRID_MEDIUM);
    expect(service.currentOrder()).toBe(OrderType.Name);
    expect(service.isAscending()).toBe(true);

    // Switch context to 'book'
    service.activeContext.set('book');

    expect(service.currentView()).toBe(LibraryViewType.LINE);
    expect(service.currentOrder()).toBe(OrderType.LastAccess);
    expect(service.isAscending()).toBe(false);

    // Switch context to 'history-manga'
    service.activeContext.set('history-manga');
    expect(service.currentOrder()).toBe(OrderType.LastAccess);
    expect(service.isAscending()).toBe(false);
  });

  it('should cycle through view modes on toggleViewMode()', () => {
    service.activeContext.set('manga');
    service.setCurrentView(LibraryViewType.GRID_BIG, 'manga');

    service.toggleViewMode('manga');
    expect(service.mangaView()).toBe(LibraryViewType.GRID_MEDIUM);

    service.toggleViewMode('manga');
    expect(service.mangaView()).toBe(LibraryViewType.GRID_OVERLAY);
  });

  it('should toggle sort direction on toggleSortDirection()', () => {
    service.activeContext.set('manga');
    service.setIsAscending(true, 'manga');

    service.toggleSortDirection('manga');
    expect(service.mangaIsAscending()).toBe(false);

    service.toggleSortDirection('manga');
    expect(service.mangaIsAscending()).toBe(true);
  });
});
