import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('app:ping'),
  selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  listMangas: (folderPath?: string) => ipcRenderer.invoke('manga:list', folderPath),
  scanLibrary: (folderPath: string) => ipcRenderer.invoke('manga:scan', folderPath),
  listBooks: (folderPath?: string) => ipcRenderer.invoke('book:list', folderPath),
  scanBookLibrary: (folderPath: string) => ipcRenderer.invoke('book:scan', folderPath),
  getLibraryCount: (libraryId: number, type: 'MANGA' | 'BOOK') => ipcRenderer.invoke('library:get-count', libraryId, type),
  getManga: (id: number) => ipcRenderer.invoke('manga:get', id),
  getBook: (id: number) => ipcRenderer.invoke('book:get', id),
  getAdjacentBooks: (id: number) => ipcRenderer.invoke('book:adjacent', id),
  saveManga: (manga: any) => ipcRenderer.invoke('manga:save', manga),
  saveBook: (book: any) => ipcRenderer.invoke('book:save', book),
  deleteManga: (id: number) => ipcRenderer.invoke('manga:delete', id),
  deleteBook: (id: number) => ipcRenderer.invoke('book:delete', id),
  clearMangaProgress: (id: number) => ipcRenderer.invoke('manga:clear-progress', id),
  clearBookProgress: (id: number) => ipcRenderer.invoke('book:clear-progress', id),
  markMangaRead: (id: number) => ipcRenderer.invoke('manga:markRead', id),
  markBookRead: (id: number) => ipcRenderer.invoke('book:markRead', id),
  getSetting: (key: string, defaultValue?: any) => ipcRenderer.invoke('settings:get', key, defaultValue),
  setSetting: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
  getSecret: (secretKey: string) => ipcRenderer.invoke('secrets:get', secretKey),

  getStatistics: () => ipcRenderer.invoke('statistics:get'),
  getStatisticsChart: (type: 'MANGA' | 'BOOK', year: number, libraryId?: number | null) =>
    ipcRenderer.invoke('statistics:chart', type, year, libraryId),
  getStatisticsYears: (type: 'MANGA' | 'BOOK') => ipcRenderer.invoke('statistics:years', type),
  listLibrariesByType: (type: 'MANGA' | 'BOOK') => ipcRenderer.invoke('libraries:listByType', type),
  listHistoryAggregated: (options: {
    type: 'MANGA' | 'BOOK';
    year?: number | null;
    libraryId?: number | null;
    search?: string | null;
  }) => ipcRenderer.invoke('history:listAggregated', options),
  listRecentReads: (limit?: number) => ipcRenderer.invoke('history:listRecent', limit),
  getReadingActivityHeatmap: (weeks?: number) => ipcRenderer.invoke('statistics:heatmap', weeks),
  startHistorySession: (input: {
    fkLibrary: number;
    fkReference: number;
    type: 'MANGA' | 'BOOK';
    pageStart: number;
    pages: number;
    volume?: string;
  }) => ipcRenderer.invoke('history:start', input),
  updateHistorySession: (update: { id: number; pageEnd: number; pages?: number }) =>
    ipcRenderer.invoke('history:update', update),
  endHistorySession: (payload: {
    id: number;
    pageEnd: number;
    pages?: number;
    type?: 'MANGA' | 'BOOK';
    fkReference?: number;
  }) => ipcRenderer.invoke('history:end', payload),

  openMangaReader: (mangaId: number) => ipcRenderer.invoke('manga-reader:open', mangaId),
  closeMangaReader: (sessionId: string) => ipcRenderer.invoke('manga-reader:close', sessionId),
  setMangaBookmark: (mangaId: number, page: number) => ipcRenderer.invoke('manga:set-bookmark', mangaId, page),
  toggleMangaFavorite: (mangaId: number) => ipcRenderer.invoke('manga:toggle-favorite', mangaId),

  openBookReader: (bookId: number) => ipcRenderer.invoke('book-reader:open', bookId),
  closeBookReader: (sessionId: string) => ipcRenderer.invoke('book-reader:close', sessionId),
  setBookBookmark: (payload: {
    id: number;
    bookMark: number;
    bookMarkCfi?: string;
    chapter?: string;
    chapterDescription?: string;
    pages?: number;
  }) => ipcRenderer.invoke('book:set-bookmark', payload),
  toggleBookFavorite: (bookId: number) => ipcRenderer.invoke('book:toggle-favorite', bookId),
  getBookConfiguration: (bookId: number) => ipcRenderer.invoke('book:get-configuration', bookId),
  saveBookConfiguration: (config: any) => ipcRenderer.invoke('book:save-configuration', config),
  listBookAnnotations: (bookId: number) => ipcRenderer.invoke('book:list-annotations', bookId),
  saveBookAnnotation: (annotation: any) => ipcRenderer.invoke('book:save-annotation', annotation),
  deleteBookAnnotation: (id: number) => ipcRenderer.invoke('book:delete-annotation', id),

  send: (channel: string, data: any) => ipcRenderer.send(channel, data),
  on: (channel: string, func: (...args: any[]) => void) => {
    const subscription = (_event: any, ...args: any[]) => func(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  }
});
