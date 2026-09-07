import { scaleBookBookmarkFromCloud } from './share-mark-compare';
import { ShareItem } from '../models/entities/share-item.model';
import { Book } from '../models/entities/book.model';
import { FileType } from '../models/enums/app-enums';

describe('scaleBookBookmarkFromCloud', () => {
  const baseBook = (pages: number): Book => ({
    title: 'T',
    path: '/t.epub',
    folder: '/',
    name: 't.epub',
    fileSize: 1,
    fileType: FileType.EPUB,
    pages,
    bookMark: 0,
    completed: false,
    favorite: false,
    author: '',
    series: '',
    genre: '',
    publisher: '',
    volume: '',
    excluded: false,
    fileAlteration: ''
  });

  const item = (bookMark: number, pages: number, completed = false): ShareItem => ({
    file: 't.epub',
    bookMark,
    pages,
    completed,
    favorite: false,
    lastAccess: new Date().toISOString(),
    sync: new Date().toISOString()
  });

  it('scales proportionally', () => {
    expect(scaleBookBookmarkFromCloud(baseBook(200), item(50, 100))).toBe(100);
  });

  it('sets to local pages when completed', () => {
    expect(scaleBookBookmarkFromCloud(baseBook(200), item(100, 100, true))).toBe(200);
  });
});
