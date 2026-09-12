import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('app:ping'),
  selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  checkPathOnline: (path: string) => ipcRenderer.invoke('fs:check-path-online', path),
  openMangaFile: () => ipcRenderer.invoke('dialog:openMangaFile'),
  listMangas: (folderPath?: string) => ipcRenderer.invoke('manga:list', folderPath),
  scanLibrary: (folderPath: string, externalHd?: boolean) => ipcRenderer.invoke('manga:scan', folderPath, externalHd),
  listBooks: (folderPath?: string) => ipcRenderer.invoke('book:list', folderPath),
  scanBookLibrary: (folderPath: string, externalHd?: boolean) => ipcRenderer.invoke('book:scan', folderPath, externalHd),
  getLibraryCount: (libraryId: number, type: 'MANGA' | 'BOOK') => ipcRenderer.invoke('library:get-count', libraryId, type),
  getManga: (id: number) => ipcRenderer.invoke('manga:get', id),
  getBook: (id: number) => ipcRenderer.invoke('book:get', id),
  setBookPassword: (id: number, password: string) =>
    ipcRenderer.invoke('book:set-password', id, password),
  getAdjacentBooks: (id: number) => ipcRenderer.invoke('book:adjacent', id),
  getAdjacentMangas: (id: number) => ipcRenderer.invoke('manga:adjacent', id),
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
  telemetryIsEnabled: () => ipcRenderer.invoke('telemetry:is-enabled'),
  telemetryRecord: (payload: {
    error: { name?: string; message?: string; stack?: string };
    message?: string;
  }) => ipcRenderer.invoke('telemetry:record', payload),
  telemetrySetKey: (key: string, value: string) =>
    ipcRenderer.invoke('telemetry:set-key', key, value),

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
    filters?: Array<{ kind: string; value: string }> | null;
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
  saveHistoryBookmarkEdit: (input: {
    fkLibrary: number;
    fkReference: number;
    type: 'MANGA' | 'BOOK';
    pageStart: number;
    pageEnd: number;
    pages: number;
    completed: boolean;
    volume?: string;
    dateTime: string;
    secondsRead?: number;
    averageTimePage?: number;
    wordCount?: number;
    secondsReadAutomatic?: boolean;
  }) => ipcRenderer.invoke('history:saveBookmarkEdit', input),
  countBookWords: (filePath: string, pageStart?: number, pageEnd?: number) =>
    ipcRenderer.invoke('history:countBookWords', filePath, pageStart, pageEnd),
  recalculateReadingTimeBatch: (options: {
    type: 'MANGA' | 'BOOK';
    onlyNew: boolean;
    avgTimePerPage: number;
    avgTimePerWord: number;
  }) => ipcRenderer.invoke('history:recalculateBatch', options),
  updateHistorySession: (update: { id: number; pageEnd: number; pages?: number }) =>
    ipcRenderer.invoke('history:update', update),
  endHistorySession: (payload: {
    id: number;
    pageEnd: number;
    pages?: number;
    type?: 'MANGA' | 'BOOK';
    fkReference?: number;
    useTTS?: boolean;
  }) => ipcRenderer.invoke('history:end', payload),

  ttsSynthesize: (req: { text: string; voice: string; rate?: number }) =>
    ipcRenderer.invoke('tts:synthesize', req),
  ttsPrefetch: (items: Array<{ text: string; voice: string; rate?: number }>) =>
    ipcRenderer.invoke('tts:prefetch', items),
  ttsClearCache: () => ipcRenderer.invoke('tts:clear-cache'),

  dbBackup: () => ipcRenderer.invoke('db:backup'),
  dbRestore: () => ipcRenderer.invoke('db:restore'),
  dataExportJson: () => ipcRenderer.invoke('data:export-json'),
  dataImportJson: () => ipcRenderer.invoke('data:import-json'),
  coversClearCache: () => ipcRenderer.invoke('covers:clear-cache'),
  statisticsClearHistory: () => ipcRenderer.invoke('statistics:clear-history'),
  appGetInfo: () => ipcRenderer.invoke('app:get-info'),
  aiTestConnection: (provider?: string) => ipcRenderer.invoke('ai:test-connection', provider),
  llmTestLocal: (payload: { baseUrl?: string; apiKey?: string }) =>
    ipcRenderer.invoke('llm:test-local', payload),
  llmListLocalModels: (payload: { baseUrl?: string; apiKey?: string }) =>
    ipcRenderer.invoke('llm:list-local-models', payload),
  llmGetProvider: () => ipcRenderer.invoke('llm:provider'),
  llmSetProvider: (provider: string) => ipcRenderer.invoke('llm:set-provider', provider),
  converterToolsStatus: () => ipcRenderer.invoke('converter:tools-status'),

  openMangaReader: (mangaId: number) => ipcRenderer.invoke('manga-reader:open', mangaId),
  closeMangaReader: (sessionId: string) => ipcRenderer.invoke('manga-reader:close', sessionId),
  getSessionSubtitles: (sessionId: string) => ipcRenderer.invoke('subtitle:getForSession', sessionId),
  importSubtitleJson: (sessionId: string) => ipcRenderer.invoke('subtitle:importJson', sessionId),
  ocrRecognize: (payload: {
    sessionId: string;
    pageIndex?: number;
    dataUrl?: string;
    lang: string;
    mode: 'region' | 'page';
    engine?: 'auto' | 'tesseract' | 'windows';
  }) => ipcRenderer.invoke('ocr:recognize', payload),
  ocrWindowsAvailable: () => ipcRenderer.invoke('ocr:windowsAvailable'),
  llmStatus: () => ipcRenderer.invoke('llm:status'),
  llmTranslate: (payload: {
    text?: string;
    blocks?: string[];
    mode: 'literal' | 'interpret';
    sourceLang?: string;
    targetLang?: string;
    model?: string;
    temperature?: number;
  }) => ipcRenderer.invoke('llm:translate', payload),

  assistantStatus: () => ipcRenderer.invoke('assistant:status'),
  assistantHistoryList: (referenceId: number, type: 'BOOK' | 'MANGA') =>
    ipcRenderer.invoke('assistant:history:list', referenceId, type),
  assistantHistoryClear: (referenceId: number, type: 'BOOK' | 'MANGA') =>
    ipcRenderer.invoke('assistant:history:clear', referenceId, type),
  assistantSelectionGet: (type: 'BOOK' | 'MANGA', referenceId: number) =>
    ipcRenderer.invoke('assistant:selection:get', type, referenceId),
  assistantSelectionSet: (type: 'BOOK' | 'MANGA', referenceId: number, value: string) =>
    ipcRenderer.invoke('assistant:selection:set', type, referenceId, value),
  assistantModels: (provider?: string) => ipcRenderer.invoke('assistant:models', provider),
  assistantPageImages: (sessionId: string, pages: number[]) =>
    ipcRenderer.invoke('assistant:page-images', sessionId, pages),
  assistantCancel: (requestId: string) => ipcRenderer.invoke('assistant:cancel', requestId),
  assistantAsk: (payload: any) => ipcRenderer.invoke('assistant:ask', payload),

  setMangaBookmark: (mangaId: number, page: number) => ipcRenderer.invoke('manga:set-bookmark', mangaId, page),
  toggleMangaFavorite: (mangaId: number) => ipcRenderer.invoke('manga:toggle-favorite', mangaId),
  listMangaAnnotations: (mangaId: number) => ipcRenderer.invoke('manga:list-annotations', mangaId),
  listAllMangaAnnotations: () => ipcRenderer.invoke('manga:list-all-annotations'),
  saveMangaAnnotation: (annotation: any) => ipcRenderer.invoke('manga:save-annotation', annotation),
  deleteMangaAnnotation: (id: number) => ipcRenderer.invoke('manga:delete-annotation', id),

  getFileLink: (mangaId: number) => ipcRenderer.invoke('file-link:get', mangaId),
  findFileLink: (mangaId: number, name: string, pages: number) =>
    ipcRenderer.invoke('file-link:find', mangaId, name, pages),
  saveFileLink: (file: any) => ipcRenderer.invoke('file-link:save', file),
  deleteFileLink: (mangaId: number) => ipcRenderer.invoke('file-link:delete', mangaId),
  openFileLink: (filePath: string, mangaId?: number) =>
    ipcRenderer.invoke('file-link:open-file', filePath, mangaId),
  closeFileLink: (sessionId: string) => ipcRenderer.invoke('file-link:close-file', sessionId),

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
  calculateBookPages: (bookId: number) => ipcRenderer.invoke('book:calculate-pages', bookId),
  toggleBookFavorite: (bookId: number) => ipcRenderer.invoke('book:toggle-favorite', bookId),
  getBookConfiguration: (bookId: number) => ipcRenderer.invoke('book:get-configuration', bookId),
  saveBookConfiguration: (config: any) => ipcRenderer.invoke('book:save-configuration', config),
  listBookAnnotations: (bookId: number) => ipcRenderer.invoke('book:list-annotations', bookId),
  listAllBookAnnotations: () => ipcRenderer.invoke('book:list-all-annotations'),
  saveBookAnnotation: (annotation: any) => ipcRenderer.invoke('book:save-annotation', annotation),
  deleteBookAnnotation: (id: number) => ipcRenderer.invoke('book:delete-annotation', id),
  listBookSearchHistory: (bookId: number) => ipcRenderer.invoke('book:search-history-list', bookId),
  saveBookSearchHistory: (bookId: number, search: string) =>
    ipcRenderer.invoke('book:search-history-save', bookId, search),
  deleteBookSearchHistory: (id: number) => ipcRenderer.invoke('book:search-history-delete', id),
  deleteAllBookSearchHistory: (bookId: number) =>
    ipcRenderer.invoke('book:search-history-delete-all', bookId),

  shareMarkStatus: () => ipcRenderer.invoke('sharemark:status'),
  shareMarkSignIn: () => ipcRenderer.invoke('sharemark:sign-in'),
  shareMarkSignOut: () => ipcRenderer.invoke('sharemark:sign-out'),
  shareMarkSetEnabled: (enabled: boolean) => ipcRenderer.invoke('sharemark:set-enabled', enabled),
  shareMarkSetCloud: (cloud: string) => ipcRenderer.invoke('sharemark:set-cloud', cloud),
  shareMarkClearLastSync: (type: 'MANGA' | 'BOOK') =>
    ipcRenderer.invoke('sharemark:clear-last-sync', type),
  shareMarkSync: (type: 'MANGA' | 'BOOK') => ipcRenderer.invoke('sharemark:sync', type),

  searchVocabulary: (options: any) => ipcRenderer.invoke('vocabulary:search', options),
  getVocabulary: (id: number) => ipcRenderer.invoke('vocabulary:get', id),
  setVocabularyFavorite: (id: number, favorite: boolean) =>
    ipcRenderer.invoke('vocabulary:setFavorite', id, favorite),
  getVocabularyRelated: (vocabularyId: number, titleHint?: string | null) =>
    ipcRenderer.invoke('vocabulary:related', vocabularyId, titleHint),
  getKanjax: (kanji: string) => ipcRenderer.invoke('kanjax:get', kanji),
  getKanjaxForWord: (word: string) => ipcRenderer.invoke('kanjax:forWord', word),
  importMangaVocabulary: (mangaId: number, forced?: boolean) =>
    ipcRenderer.invoke('vocabulary:importManga', mangaId, forced),
  importBookVocabulary: (bookId: number, forced?: boolean) =>
    ipcRenderer.invoke('vocabulary:importBook', bookId, forced),

  japaneseInit: () => ipcRenderer.invoke('japanese:init'),
  japaneseToRubyHtml: (text: string, withFurigana?: boolean) =>
    ipcRenderer.invoke('japanese:toRubyHtml', text, withFurigana),
  japaneseTokenize: (text: string) => ipcRenderer.invoke('japanese:tokenize', text),
  japaneseEngine: () => ipcRenderer.invoke('japanese:engine'),

  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  lookupVocabulary: (options: { text: string; mangaId?: number | null; bookId?: number | null }) =>
    ipcRenderer.invoke('vocabulary:lookup', options),

  /* Tracker APIs */
  listAllTracks: () => ipcRenderer.invoke('tracker:listAll'),
  listTracksByLibrary: (libraryId: number) => ipcRenderer.invoke('tracker:listByLibrary', libraryId),
  listTrackerLibraries: () => ipcRenderer.invoke('tracker:listLibraries'),
  getMatchedMedia: (payload: {
    libraryId: number;
    titleRegex: string;
    title?: string | null;
    malId?: number | null;
  }) => ipcRenderer.invoke('tracker:getMatchedMedia', payload),
  getTrack: (id: number) => ipcRenderer.invoke('tracker:get', id),
  saveTrack: (track: any) => ipcRenderer.invoke('tracker:save', track),
  deleteTrack: (id: number) => ipcRenderer.invoke('tracker:delete', id),
  matchTrack: (payload: {
    libraryId: number;
    title: string;
    filename: string;
    comicInfoMalId?: number | null;
    comicInfoTitle?: string | null;
  }) => ipcRenderer.invoke('tracker:match', payload),
  updateTrackProgress: (payload: {
    id: number;
    chaptersRead: number;
    volumesRead: number;
    status?: string;
  }) => ipcRenderer.invoke('tracker:updateProgress', payload),

  /* MyAnimeList APIs */
  malGetAuthStatus: () => ipcRenderer.invoke('mal:getAuthStatus'),
  malLogin: () => ipcRenderer.invoke('mal:login'),
  malLogout: () => ipcRenderer.invoke('mal:logout'),
  malSearch: (query: string, limit?: number) => ipcRenderer.invoke('mal:search', query, limit),
  malGetUserStatus: (malId: number) => ipcRenderer.invoke('mal:getUserStatus', malId),
  malUpdateUserStatus: (payload: any) => ipcRenderer.invoke('mal:updateUserStatus', payload),

  /* AniList APIs */
  anilistGetAuthStatus: () => ipcRenderer.invoke('anilist:getAuthStatus'),
  anilistLogin: () => ipcRenderer.invoke('anilist:login'),
  anilistLogout: () => ipcRenderer.invoke('anilist:logout'),
  anilistSearch: (query: string, limit?: number) => ipcRenderer.invoke('anilist:search', query, limit),
  anilistGetUserStatus: (mediaId: number) => ipcRenderer.invoke('anilist:getUserStatus', mediaId),
  anilistUpdateUserStatus: (payload: any) => ipcRenderer.invoke('anilist:updateUserStatus', payload),

  send: (channel: string, data: any) => ipcRenderer.send(channel, data),
  on: (channel: string, func: (...args: any[]) => void) => {
    const subscription = (_event: any, ...args: any[]) => func(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  }
});
