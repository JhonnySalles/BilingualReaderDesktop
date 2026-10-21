import { OrderType } from '../models';
import { sortLibraryItems, hasLastAccess } from './library-sort.util';

describe('library-sort.util', () => {
  const createMockItem = (override: Partial<any>): any => ({
    id: 1,
    title: 'Item',
    favorite: false,
    author: '',
    dateCreate: '',
    lastAccess: '',
    ...override
  });

  describe('OrderType.Name', () => {
    const items = [
      createMockItem({ id: 1, title: 'Zebra' }),
      createMockItem({ id: 2, title: 'Alpha' }),
      createMockItem({ id: 3, title: 'Beta' })
    ];

    it('should sort ascending A-Z', () => {
      const sorted = sortLibraryItems(items, OrderType.Name, true);
      expect(sorted.map(i => i.title)).toEqual(['Alpha', 'Beta', 'Zebra']);
    });

    it('should sort descending Z-A', () => {
      const sorted = sortLibraryItems(items, OrderType.Name, false);
      expect(sorted.map(i => i.title)).toEqual(['Zebra', 'Beta', 'Alpha']);
    });
  });

  describe('OrderType.Author', () => {
    const items = [
      createMockItem({ id: 1, title: 'Book 1', author: 'Stephen King' }),
      createMockItem({ id: 2, title: 'Book 2', author: 'Agatha Christie' }),
      createMockItem({ id: 3, title: 'Book 3', author: 'Stephen King' }),
      createMockItem({ id: 4, title: 'Book 4', author: '' })
    ];

    it('should sort by author ascending with name tie-break and empty author at end', () => {
      const sorted = sortLibraryItems(items, OrderType.Author, true);
      expect(sorted.map(i => `${i.author} - ${i.title}`)).toEqual([
        'Agatha Christie - Book 2',
        'Stephen King - Book 1',
        'Stephen King - Book 3',
        ' - Book 4'
      ]);
    });

    it('should sort by author descending with empty author at end', () => {
      const sorted = sortLibraryItems(items, OrderType.Author, false);
      expect(sorted.map(i => `${i.author} - ${i.title}`)).toEqual([
        'Stephen King - Book 3',
        'Stephen King - Book 1',
        'Agatha Christie - Book 2',
        ' - Book 4'
      ]);
    });
  });

  describe('OrderType.Date', () => {
    const items = [
      createMockItem({ id: 1, title: 'B', dateCreate: '2025-01-01' }),
      createMockItem({ id: 2, title: 'A', dateCreate: '2026-01-01' }),
      createMockItem({ id: 3, title: 'C', dateCreate: '2024-01-01' }),
      createMockItem({ id: 4, title: 'D', dateCreate: '' })
    ];

    it('should sort by date ascending with empty date at end', () => {
      const sorted = sortLibraryItems(items, OrderType.Date, true);
      expect(sorted.map(i => i.title)).toEqual(['C', 'B', 'A', 'D']);
    });

    it('should sort by date descending with empty date at end', () => {
      const sorted = sortLibraryItems(items, OrderType.Date, false);
      expect(sorted.map(i => i.title)).toEqual(['A', 'B', 'C', 'D']);
    });
  });

  describe('OrderType.Favorite (Two-block cascade sorting)', () => {
    const items = [
      createMockItem({ id: 1, title: 'Delta', favorite: false }),
      createMockItem({ id: 2, title: 'Zebra', favorite: true }),
      createMockItem({ id: 3, title: 'Alpha', favorite: true }),
      createMockItem({ id: 4, title: 'Beta', favorite: false }),
      createMockItem({ id: 5, title: 'Charlie', favorite: true })
    ];

    it('should place favorites first (A-Z) and non-favorites after (A-Z) in ascending mode', () => {
      const sorted = sortLibraryItems(items, OrderType.Favorite, true);
      expect(sorted.map(i => `${i.favorite ? '★' : '☆'} ${i.title}`)).toEqual([
        '★ Alpha',
        '★ Charlie',
        '★ Zebra',
        '☆ Beta',
        '☆ Delta'
      ]);
    });

    it('should KEEP favorites first (Z-A) and non-favorites after (Z-A) in descending mode', () => {
      const sorted = sortLibraryItems(items, OrderType.Favorite, false);
      expect(sorted.map(i => `${i.favorite ? '★' : '☆'} ${i.title}`)).toEqual([
        '★ Zebra',
        '★ Charlie',
        '★ Alpha',
        '☆ Delta',
        '☆ Beta'
      ]);
    });
  });

  describe('OrderType.LastAccess (Two-block cascade sorting)', () => {
    const items = [
      createMockItem({ id: 1, title: 'Unread Zebra', lastAccess: '' }),
      createMockItem({ id: 2, title: 'Read Alpha', lastAccess: '2026-03-01' }),
      createMockItem({ id: 3, title: 'Unread Beta', lastAccess: '0000-00-00' }),
      createMockItem({ id: 4, title: 'Read Charlie', lastAccess: '2026-05-01' }),
      createMockItem({ id: 5, title: 'Read Delta', lastAccess: '2026-01-01' }),
      createMockItem({ id: 6, title: 'Unread Alpha', lastAccess: undefined })
    ];

    it('should place items with access first (oldest to newest) and unread items after (A-Z) in ascending mode', () => {
      const sorted = sortLibraryItems(items, OrderType.LastAccess, true);
      expect(sorted.map(i => `${hasLastAccess(i) ? 'READ' : 'UNREAD'}: ${i.title}`)).toEqual([
        'READ: Read Delta',
        'READ: Read Alpha',
        'READ: Read Charlie',
        'UNREAD: Unread Alpha',
        'UNREAD: Unread Beta',
        'UNREAD: Unread Zebra'
      ]);
    });

    it('should place items with access first (newest to oldest) and unread items after (Z-A) in descending mode', () => {
      const sorted = sortLibraryItems(items, OrderType.LastAccess, false);
      expect(sorted.map(i => `${hasLastAccess(i) ? 'READ' : 'UNREAD'}: ${i.title}`)).toEqual([
        'READ: Read Charlie',
        'READ: Read Alpha',
        'READ: Read Delta',
        'UNREAD: Unread Zebra',
        'UNREAD: Unread Beta',
        'UNREAD: Unread Alpha'
      ]);
    });
  });
});
