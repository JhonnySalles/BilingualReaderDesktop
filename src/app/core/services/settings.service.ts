import { Injectable, signal, effect } from '@angular/core';
import {
  BookAlign,
  BookMarginSize,
  BookScrollingMode,
  BookSpacingSize,
  MangaFitMode,
  MangaScrollingMode,
  OrderType,
  PageTransitionType,
  isPageTransitionType,
  TouchPosition,
  TouchScreen,
  TouchZoneMap
} from '../models';
import type { SubtitleTranslateTarget } from '../models/enums/ai-enums';
import { normalizeTranslateTarget } from '../utils/llm-translate.prompts';
import { DEFAULT_JAPANESE_FONT_CSS } from '../../features/reader-text/book-fonts';

export interface CustomLibrary {
  id: string;
  title: string;
  language: string;
  path: string;
  type: 'manga' | 'book';
  count?: number;
  externalHd?: boolean;
}

const SETTINGS_KEY = 'bilingual_reader_settings';

/** Android GeneralConsts.KEYS.READER.MANGA_PAGE_PAGINATION_TYPE */
export const MANGA_PAGE_PAGINATION_TYPE_KEY = 'MANGA_PAGE_PAGINATION_TYPE';
/** Android GeneralConsts.KEYS.READER.BOOK_PAGE_PAGINATION_TYPE */
export const BOOK_PAGE_PAGINATION_TYPE_KEY = 'BOOK_PAGE_PAGINATION_TYPE';

/** Main/renderer shared key for ebook convert cascade preference. */
export const EBOOK_CONVERT_MODE_KEY = 'EBOOK_CONVERT_MODE';
export type EbookConvertMode = 'auto' | 'calibre' | 'native';
export const DEFAULT_EBOOK_CONVERT_MODE: EbookConvertMode = 'auto';

export function normalizeEbookConvertMode(value: unknown): EbookConvertMode {
  if (value === 'calibre' || value === 'native' || value === 'auto') return value;
  return DEFAULT_EBOOK_CONVERT_MODE;
}

export const DEFAULT_LLM_MANGA_MODEL = 'openrouter/free';
export const DEFAULT_LLM_TEMPERATURE = 80;
export const DEFAULT_LLM_MAX_CONTEXT = 12000;
export const DEFAULT_LLM_MAX_HISTORY = 600;
export const DEFAULT_LLM_MAX_BOOK_CHAPTERS = 5;
export const DEFAULT_LLM_PROVIDER = 'openrouter' as const;
export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434/v1';
export const DEFAULT_LM_STUDIO_BASE_URL = 'http://127.0.0.1:1234/v1';
export const DEFAULT_LLM_LOCAL_MODEL = 'llama3.2';

export type LlmProviderSetting = 'openrouter' | 'ollama' | 'lm_studio';
export type LlmLocalKind = 'ollama' | 'lm_studio';
export const DEFAULT_LLM_MAX_MANGA_PAGES = 10;

const MANGA_TOUCH_DEFAULT: TouchZoneMap = {
  [TouchPosition.TOP]: TouchScreen.SHARE_IMAGE,
  [TouchPosition.CORNER_TOP_LEFT]: TouchScreen.FIT_WIDTH,
  [TouchPosition.CORNER_TOP_RIGHT]: TouchScreen.ASPECT_FIT,
  [TouchPosition.LEFT]: TouchScreen.PREVIOUS_PAGE,
  [TouchPosition.RIGHT]: TouchScreen.NEXT_PAGE,
  [TouchPosition.BOTTOM]: TouchScreen.CHAPTER_LIST,
  [TouchPosition.CORNER_BOTTOM_LEFT]: TouchScreen.PREVIOUS_FILE,
  [TouchPosition.CORNER_BOTTOM_RIGHT]: TouchScreen.NEXT_FILE
};

const BOOK_TOUCH_DEFAULT: TouchZoneMap = {
  [TouchPosition.TOP]: TouchScreen.PAGE_MARK,
  [TouchPosition.CORNER_TOP_LEFT]: TouchScreen.PREVIOUS_PAGE,
  [TouchPosition.CORNER_TOP_RIGHT]: TouchScreen.NEXT_PAGE,
  [TouchPosition.LEFT]: TouchScreen.PREVIOUS_PAGE,
  [TouchPosition.RIGHT]: TouchScreen.NEXT_PAGE,
  [TouchPosition.BOTTOM]: TouchScreen.CHAPTER_LIST,
  [TouchPosition.CORNER_BOTTOM_LEFT]: TouchScreen.PREVIOUS_FILE,
  [TouchPosition.CORNER_BOTTOM_RIGHT]: TouchScreen.NEXT_FILE
};

interface SettingsData {
  mangaBasePath: string;
  bookBasePath: string;
  mangaBasePathExternalHd?: boolean;
  bookBasePathExternalHd?: boolean;
  libraries: CustomLibrary[];
  mangaScrollingMode?: MangaScrollingMode;
  mangaFitMode?: MangaFitMode;
  mangaPageTransition?: PageTransitionType;
  bookScrollingMode?: BookScrollingMode;
  bookPageTransition?: PageTransitionType;
  bookFontSize?: number;
  bookFontFamily?: string;
  bookLineHeight?: number;
  bookMargin?: BookMarginSize;
  bookAlign?: BookAlign;
  bookSpacing?: BookSpacingSize;
  mangaTouchMap?: Partial<TouchZoneMap>;
  bookTouchMap?: Partial<TouchZoneMap>;
  mangaTouchDemoShown?: boolean;
  bookTouchDemoShown?: boolean;
  mangaProcessVocabulary?: boolean;
  bookProcessVocabulary?: boolean;
  bookProcessJapaneseText?: boolean;
  bookGenerateFurigana?: boolean;
  bookFontJapaneseStyle?: boolean;
  bookFontFamilyJapanese?: string;
  subtitleLanguage?: string;
  ocrLanguage?: string;
  subtitleTranslate?: SubtitleTranslateTarget;
  llmEnabled?: boolean;
  llmProvider?: LlmProviderSetting;
  llmOpenRouterApiKey?: string;
  llmMangaTranslateModel?: string;
  llmMangaInterpretModel?: string;
  llmBookQaModel?: string;
  llmBookSummaryModel?: string;
  llmOllamaBaseUrl?: string;
  llmOllamaApiKey?: string;
  llmLmStudioBaseUrl?: string;
  llmLmStudioApiKey?: string;
  llmLocalKind?: LlmLocalKind;
  llmBookLocalModel?: string;
  llmBookLocalModelSummary?: string;
  llmMangaLocalModel?: string;
  llmTemperature?: number;
  llmMaxContextChars?: number;
  llmMaxHistoryChars?: number;
  llmMaxBookChapters?: number;
  llmMaxMangaPages?: number;
  ocrAutoTranslate?: boolean;
  ocrAutoInterpret?: boolean;
  mangaUsePagePathForLinked?: boolean;
  mangaDualPageCalculate?: boolean;
  themeGlassmorphism?: boolean;
  theme3DCovers?: boolean;
  libraryDefaultOrder?: OrderType;
  ebookConvertMode?: EbookConvertMode;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  mangaBasePath = signal<string>('C:\\Users\\Jhonny\\Documents\\BilingualReader\\Mangas');
  bookBasePath = signal<string>('C:\\Users\\Jhonny\\Documents\\BilingualReader\\Books');
  mangaBasePathExternalHd = signal(false);
  bookBasePathExternalHd = signal(false);
  libraries = signal<CustomLibrary[]>([]);
  mangaScrollingMode = signal<MangaScrollingMode>(MangaScrollingMode.Horizontal);
  mangaFitMode = signal<MangaFitMode>(MangaFitMode.FitWidth);
  mangaPageTransition = signal<PageTransitionType>(PageTransitionType.Default);

  bookScrollingMode = signal<BookScrollingMode>(BookScrollingMode.Pagination);
  bookPageTransition = signal<PageTransitionType>(PageTransitionType.Default);
  bookFontSize = signal<number>(18);
  bookFontFamily = signal<string>('Georgia, serif');
  bookLineHeight = signal<number>(1.6);
  bookMargin = signal<BookMarginSize>('medium');
  bookAlign = signal<BookAlign>('justify');
  bookSpacing = signal<BookSpacingSize>('medium');

  mangaTouchMap = signal<TouchZoneMap>({ ...MANGA_TOUCH_DEFAULT });
  bookTouchMap = signal<TouchZoneMap>({ ...BOOK_TOUCH_DEFAULT });
  mangaTouchDemoShown = signal(false);
  bookTouchDemoShown = signal(false);
  mangaProcessVocabulary = signal(true);
  bookProcessVocabulary = signal(true);
  bookProcessJapaneseText = signal(true);
  bookGenerateFurigana = signal(true);
  /** Vertical Japanese writing (tate-gaki) in the EPUB reader. */
  bookFontJapaneseStyle = signal(false);
  bookFontFamilyJapanese = signal<string>(DEFAULT_JAPANESE_FONT_CSS);
  /** Android-style subtitle language key: JAPANESE | ENGLISH | PORTUGUESE */
  subtitleLanguage = signal('JAPANESE');
  /** Tesseract lang: jpn | jpn_vert | eng | por */
  ocrLanguage = signal('jpn');
  /** OCR / LLM translation target: PORTUGUESE | ENGLISH | OFF */
  subtitleTranslate = signal<SubtitleTranslateTarget>('PORTUGUESE');
  llmEnabled = signal(false);
  /** Active provider: openrouter | ollama | lm_studio */
  llmProvider = signal<LlmProviderSetting>(DEFAULT_LLM_PROVIDER);
  /** User override; empty = use env OPENROUTER_API_KEY in main. */
  llmOpenRouterApiKey = signal('');
  llmMangaTranslateModel = signal(DEFAULT_LLM_MANGA_MODEL);
  llmMangaInterpretModel = signal(DEFAULT_LLM_MANGA_MODEL);
  llmBookQaModel = signal(DEFAULT_LLM_MANGA_MODEL);
  llmBookSummaryModel = signal(DEFAULT_LLM_MANGA_MODEL);
  /** Which local backend the settings card is editing. */
  llmLocalKind = signal<LlmLocalKind>('ollama');
  llmOllamaBaseUrl = signal(DEFAULT_OLLAMA_BASE_URL);
  llmOllamaApiKey = signal('');
  llmLmStudioBaseUrl = signal(DEFAULT_LM_STUDIO_BASE_URL);
  llmLmStudioApiKey = signal('');
  llmBookLocalModel = signal(DEFAULT_LLM_LOCAL_MODEL);
  llmBookLocalModelSummary = signal(DEFAULT_LLM_LOCAL_MODEL);
  llmMangaLocalModel = signal(DEFAULT_LLM_LOCAL_MODEL);
  /** 0–100 → API 0–1 */
  llmTemperature = signal(DEFAULT_LLM_TEMPERATURE);
  llmMaxContextChars = signal(DEFAULT_LLM_MAX_CONTEXT);
  llmMaxHistoryChars = signal(DEFAULT_LLM_MAX_HISTORY);
  llmMaxBookChapters = signal(DEFAULT_LLM_MAX_BOOK_CHAPTERS);
  llmMaxMangaPages = signal(DEFAULT_LLM_MAX_MANGA_PAGES);
  ocrAutoTranslate = signal(true);
  ocrAutoInterpret = signal(false);
  /** Pad linked pages using folder paths (Android USE_PAGE_PATH_FOR_LINKED). */
  mangaUsePagePathForLinked = signal(true);
  /** When reordering, treat dual-page images specially. */
  mangaDualPageCalculate = signal(false);
  themeGlassmorphism = signal(true);
  theme3DCovers = signal(true);
  /** Default library sort applied to manga + book contexts. */
  libraryDefaultOrder = signal<OrderType>(OrderType.Name);
  /** auto = Calibre then native; calibre = Calibre only; native = builtin only. */
  ebookConvertMode = signal<EbookConvertMode>(DEFAULT_EBOOK_CONVERT_MODE);

  constructor() {
    this.loadSettings();
    this.applyThemeDocumentAttrs();

    effect(() => {
      const data: SettingsData = {
        mangaBasePath: this.mangaBasePath(),
        bookBasePath: this.bookBasePath(),
        mangaBasePathExternalHd: this.mangaBasePathExternalHd(),
        bookBasePathExternalHd: this.bookBasePathExternalHd(),
        libraries: this.libraries(),
        mangaScrollingMode: this.mangaScrollingMode(),
        mangaFitMode: this.mangaFitMode(),
        mangaPageTransition: this.mangaPageTransition(),
        bookScrollingMode: this.bookScrollingMode(),
        bookPageTransition: this.bookPageTransition(),
        bookFontSize: this.bookFontSize(),
        bookFontFamily: this.bookFontFamily(),
        bookLineHeight: this.bookLineHeight(),
        bookMargin: this.bookMargin(),
        bookAlign: this.bookAlign(),
        bookSpacing: this.bookSpacing(),
        mangaTouchMap: this.mangaTouchMap(),
        bookTouchMap: this.bookTouchMap(),
        mangaTouchDemoShown: this.mangaTouchDemoShown(),
        bookTouchDemoShown: this.bookTouchDemoShown(),
        mangaProcessVocabulary: this.mangaProcessVocabulary(),
        bookProcessVocabulary: this.bookProcessVocabulary(),
        bookProcessJapaneseText: this.bookProcessJapaneseText(),
        bookGenerateFurigana: this.bookGenerateFurigana(),
        bookFontJapaneseStyle: this.bookFontJapaneseStyle(),
        bookFontFamilyJapanese: this.bookFontFamilyJapanese(),
        subtitleLanguage: this.subtitleLanguage(),
        ocrLanguage: this.ocrLanguage(),
        subtitleTranslate: this.subtitleTranslate(),
        llmEnabled: this.llmEnabled(),
        llmProvider: this.llmProvider(),
        llmOpenRouterApiKey: this.llmOpenRouterApiKey(),
        llmMangaTranslateModel: this.llmMangaTranslateModel(),
        llmMangaInterpretModel: this.llmMangaInterpretModel(),
        llmBookQaModel: this.llmBookQaModel(),
        llmBookSummaryModel: this.llmBookSummaryModel(),
        llmLocalKind: this.llmLocalKind(),
        llmOllamaBaseUrl: this.llmOllamaBaseUrl(),
        llmOllamaApiKey: this.llmOllamaApiKey(),
        llmLmStudioBaseUrl: this.llmLmStudioBaseUrl(),
        llmLmStudioApiKey: this.llmLmStudioApiKey(),
        llmBookLocalModel: this.llmBookLocalModel(),
        llmBookLocalModelSummary: this.llmBookLocalModelSummary(),
        llmMangaLocalModel: this.llmMangaLocalModel(),
        llmTemperature: this.llmTemperature(),
        llmMaxContextChars: this.llmMaxContextChars(),
        llmMaxHistoryChars: this.llmMaxHistoryChars(),
        llmMaxBookChapters: this.llmMaxBookChapters(),
        llmMaxMangaPages: this.llmMaxMangaPages(),
        ocrAutoTranslate: this.ocrAutoTranslate(),
        ocrAutoInterpret: this.ocrAutoInterpret(),
        mangaUsePagePathForLinked: this.mangaUsePagePathForLinked(),
        mangaDualPageCalculate: this.mangaDualPageCalculate(),
        themeGlassmorphism: this.themeGlassmorphism(),
        theme3DCovers: this.theme3DCovers(),
        libraryDefaultOrder: this.libraryDefaultOrder(),
        ebookConvertMode: this.ebookConvertMode()
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
      this.applyThemeDocumentAttrs();
      if (typeof window !== 'undefined' && window.electronAPI?.setSetting) {
        void window.electronAPI.setSetting('libraries', this.libraries());
        void window.electronAPI.setSetting('mangaBasePath', this.mangaBasePath());
        void window.electronAPI.setSetting('bookBasePath', this.bookBasePath());
        void window.electronAPI.setSetting('MANGA_BASE_PATH_EXTERNAL_HD', this.mangaBasePathExternalHd());
        void window.electronAPI.setSetting('BOOK_BASE_PATH_EXTERNAL_HD', this.bookBasePathExternalHd());
        void window.electronAPI.setSetting('MANGA_PROCESS_VOCABULARY', this.mangaProcessVocabulary());
        void window.electronAPI.setSetting('BOOK_PROCESS_VOCABULARY', this.bookProcessVocabulary());
        void window.electronAPI.setSetting('BOOK_PROCESS_JAPANESE_TEXT', this.bookProcessJapaneseText());
        void window.electronAPI.setSetting('BOOK_GENERATE_FURIGANA_ON_TEXT', this.bookGenerateFurigana());
        void window.electronAPI.setSetting('BOOK_FONT_JAPANESE_STYLE', this.bookFontJapaneseStyle());
        void window.electronAPI.setSetting('BOOK_PAGE_FONT_TYPE_JAPANESE', this.bookFontFamilyJapanese());
        void window.electronAPI.setSetting('SUBTITLE_LANGUAGE', this.subtitleLanguage());
        void window.electronAPI.setSetting('OCR_LANGUAGE', this.ocrLanguage());
        void window.electronAPI.setSetting('SUBTITLE_TRANSLATE', this.subtitleTranslate());
        void window.electronAPI.setSetting('LLM_ENABLED', this.llmEnabled());
        void window.electronAPI.setSetting('LLM_PROVIDER', this.llmProvider());
        void window.electronAPI.setSetting('LLM_OPENROUTER_API_KEY', this.llmOpenRouterApiKey());
        void window.electronAPI.setSetting('LLM_MANGA_OPENROUTER_MODEL', this.llmMangaTranslateModel());
        void window.electronAPI.setSetting('LLM_MANGA_INTERPRET_MODEL', this.llmMangaInterpretModel());
        void window.electronAPI.setSetting('LLM_BOOK_OPENROUTER_MODEL', this.llmBookQaModel());
        void window.electronAPI.setSetting('LLM_BOOK_OPENROUTER_MODEL_SUMMARY', this.llmBookSummaryModel());
        void window.electronAPI.setSetting('LLM_OLLAMA_BASE_URL', this.llmOllamaBaseUrl());
        void window.electronAPI.setSetting('LLM_OLLAMA_API_KEY', this.llmOllamaApiKey());
        void window.electronAPI.setSetting('LLM_LM_STUDIO_BASE_URL', this.llmLmStudioBaseUrl());
        void window.electronAPI.setSetting('LLM_LM_STUDIO_API_KEY', this.llmLmStudioApiKey());
        void window.electronAPI.setSetting('LLM_BOOK_LOCAL_MODEL', this.llmBookLocalModel());
        void window.electronAPI.setSetting('LLM_BOOK_LOCAL_MODEL_SUMMARY', this.llmBookLocalModelSummary());
        void window.electronAPI.setSetting('LLM_MANGA_LOCAL_MODEL', this.llmMangaLocalModel());
        void window.electronAPI.setSetting('LLM_TEMPERATURE', this.llmTemperature());
        void window.electronAPI.setSetting('LLM_MAX_CONTEXT_CHARS', this.llmMaxContextChars());
        void window.electronAPI.setSetting('LLM_MAX_HISTORY_CHARS', this.llmMaxHistoryChars());
        void window.electronAPI.setSetting('LLM_MAX_BOOK_CHAPTERS', this.llmMaxBookChapters());
        void window.electronAPI.setSetting('LLM_MAX_MANGA_PAGES', this.llmMaxMangaPages());
        void window.electronAPI.setSetting('OCR_AUTO_TRANSLATE', this.ocrAutoTranslate());
        void window.electronAPI.setSetting('OCR_AUTO_INTERPRET', this.ocrAutoInterpret());
        void window.electronAPI.setSetting(MANGA_PAGE_PAGINATION_TYPE_KEY, this.mangaPageTransition());
        void window.electronAPI.setSetting(BOOK_PAGE_PAGINATION_TYPE_KEY, this.bookPageTransition());
        void window.electronAPI.setSetting('THEME_GLASSMORPHISM', this.themeGlassmorphism());
        void window.electronAPI.setSetting('THEME_3D_COVER_IN_DETAIL', this.theme3DCovers());
        void window.electronAPI.setSetting('MANGA_LIBRARY_ORDER', this.libraryDefaultOrder());
        void window.electronAPI.setSetting('BOOK_LIBRARY_ORDER', this.libraryDefaultOrder());
        void window.electronAPI.setSetting(EBOOK_CONVERT_MODE_KEY, this.ebookConvertMode());
      }
    });
  }

  private loadSettings(): void {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      try {
        const data: SettingsData = JSON.parse(raw);
        if (data.mangaBasePath) this.mangaBasePath.set(data.mangaBasePath);
        if (data.bookBasePath) this.bookBasePath.set(data.bookBasePath);
        if (typeof data.mangaBasePathExternalHd === 'boolean') this.mangaBasePathExternalHd.set(data.mangaBasePathExternalHd);
        if (typeof data.bookBasePathExternalHd === 'boolean') this.bookBasePathExternalHd.set(data.bookBasePathExternalHd);
        if (Array.isArray(data.libraries)) this.libraries.set(data.libraries);
        if (data.mangaScrollingMode && Object.values(MangaScrollingMode).includes(data.mangaScrollingMode)) {
          this.mangaScrollingMode.set(data.mangaScrollingMode);
        }
        if (data.mangaFitMode && Object.values(MangaFitMode).includes(data.mangaFitMode)) {
          this.mangaFitMode.set(data.mangaFitMode);
        }
        if (isPageTransitionType(data.mangaPageTransition)) {
          this.mangaPageTransition.set(data.mangaPageTransition);
        }
        if (data.bookScrollingMode && Object.values(BookScrollingMode).includes(data.bookScrollingMode)) {
          this.bookScrollingMode.set(data.bookScrollingMode);
        }
        if (isPageTransitionType(data.bookPageTransition)) {
          this.bookPageTransition.set(data.bookPageTransition);
        }
        if (typeof data.bookFontSize === 'number' && data.bookFontSize >= 10 && data.bookFontSize <= 40) {
          this.bookFontSize.set(data.bookFontSize);
        }
        if (typeof data.bookFontFamily === 'string' && data.bookFontFamily.trim()) {
          this.bookFontFamily.set(data.bookFontFamily);
        }
        if (typeof data.bookLineHeight === 'number' && data.bookLineHeight >= 1.2 && data.bookLineHeight <= 2.4) {
          this.bookLineHeight.set(data.bookLineHeight);
        }
        if (data.bookMargin && ['small', 'medium', 'large'].includes(data.bookMargin)) {
          this.bookMargin.set(data.bookMargin);
        }
        if (data.bookAlign && ['justify', 'left', 'center', 'right'].includes(data.bookAlign)) {
          this.bookAlign.set(data.bookAlign);
        }
        if (data.bookSpacing && ['small', 'medium', 'large'].includes(data.bookSpacing)) {
          this.bookSpacing.set(data.bookSpacing);
        }
        if (data.mangaTouchMap) {
          this.mangaTouchMap.set(this.mergeTouchMap(MANGA_TOUCH_DEFAULT, data.mangaTouchMap));
        }
        if (data.bookTouchMap) {
          this.bookTouchMap.set(this.mergeTouchMap(BOOK_TOUCH_DEFAULT, data.bookTouchMap));
        }
        if (typeof data.mangaTouchDemoShown === 'boolean') {
          this.mangaTouchDemoShown.set(data.mangaTouchDemoShown);
        }
        if (typeof data.bookTouchDemoShown === 'boolean') {
          this.bookTouchDemoShown.set(data.bookTouchDemoShown);
        }
        if (typeof data.mangaProcessVocabulary === 'boolean') {
          this.mangaProcessVocabulary.set(data.mangaProcessVocabulary);
        }
        if (typeof data.bookProcessVocabulary === 'boolean') {
          this.bookProcessVocabulary.set(data.bookProcessVocabulary);
        }
        if (typeof data.bookProcessJapaneseText === 'boolean') {
          this.bookProcessJapaneseText.set(data.bookProcessJapaneseText);
        }
        if (typeof data.bookGenerateFurigana === 'boolean') {
          this.bookGenerateFurigana.set(data.bookGenerateFurigana);
        }
        if (typeof data.bookFontJapaneseStyle === 'boolean') {
          this.bookFontJapaneseStyle.set(data.bookFontJapaneseStyle);
        }
        if (typeof data.bookFontFamilyJapanese === 'string' && data.bookFontFamilyJapanese.trim()) {
          this.bookFontFamilyJapanese.set(data.bookFontFamilyJapanese);
        }
        if (typeof data.subtitleLanguage === 'string' && data.subtitleLanguage.trim()) {
          this.subtitleLanguage.set(data.subtitleLanguage.trim().toUpperCase());
        }
        if (typeof data.ocrLanguage === 'string' && data.ocrLanguage.trim()) {
          this.ocrLanguage.set(data.ocrLanguage.trim());
        }
        if (data.subtitleTranslate != null) {
          this.subtitleTranslate.set(normalizeTranslateTarget(data.subtitleTranslate));
        }
        if (typeof data.llmEnabled === 'boolean') {
          this.llmEnabled.set(data.llmEnabled);
        }
        if (
          data.llmProvider === 'openrouter' ||
          data.llmProvider === 'ollama' ||
          data.llmProvider === 'lm_studio'
        ) {
          this.llmProvider.set(data.llmProvider);
        }
        if (typeof data.llmOpenRouterApiKey === 'string') {
          this.llmOpenRouterApiKey.set(data.llmOpenRouterApiKey);
        }
        if (typeof data.llmMangaTranslateModel === 'string' && data.llmMangaTranslateModel.trim()) {
          this.llmMangaTranslateModel.set(data.llmMangaTranslateModel.trim());
        }
        if (typeof data.llmMangaInterpretModel === 'string' && data.llmMangaInterpretModel.trim()) {
          this.llmMangaInterpretModel.set(data.llmMangaInterpretModel.trim());
        } else if (typeof data.llmMangaTranslateModel === 'string' && data.llmMangaTranslateModel.trim()) {
          this.llmMangaInterpretModel.set(data.llmMangaTranslateModel.trim());
        }
        if (typeof data.llmBookQaModel === 'string' && data.llmBookQaModel.trim()) {
          this.llmBookQaModel.set(data.llmBookQaModel.trim());
        }
        if (typeof data.llmBookSummaryModel === 'string' && data.llmBookSummaryModel.trim()) {
          this.llmBookSummaryModel.set(data.llmBookSummaryModel.trim());
        }
        if (data.llmLocalKind === 'ollama' || data.llmLocalKind === 'lm_studio') {
          this.llmLocalKind.set(data.llmLocalKind);
        }
        if (typeof data.llmOllamaBaseUrl === 'string' && data.llmOllamaBaseUrl.trim()) {
          this.llmOllamaBaseUrl.set(data.llmOllamaBaseUrl.trim());
        }
        if (typeof data.llmOllamaApiKey === 'string') {
          this.llmOllamaApiKey.set(data.llmOllamaApiKey);
        }
        if (typeof data.llmLmStudioBaseUrl === 'string' && data.llmLmStudioBaseUrl.trim()) {
          this.llmLmStudioBaseUrl.set(data.llmLmStudioBaseUrl.trim());
        }
        if (typeof data.llmLmStudioApiKey === 'string') {
          this.llmLmStudioApiKey.set(data.llmLmStudioApiKey);
        }
        if (typeof data.llmBookLocalModel === 'string' && data.llmBookLocalModel.trim()) {
          this.llmBookLocalModel.set(data.llmBookLocalModel.trim());
        }
        if (typeof data.llmBookLocalModelSummary === 'string' && data.llmBookLocalModelSummary.trim()) {
          this.llmBookLocalModelSummary.set(data.llmBookLocalModelSummary.trim());
        }
        if (typeof data.llmMangaLocalModel === 'string' && data.llmMangaLocalModel.trim()) {
          this.llmMangaLocalModel.set(data.llmMangaLocalModel.trim());
        }
        if (typeof data.llmTemperature === 'number' && data.llmTemperature >= 0 && data.llmTemperature <= 100) {
          this.llmTemperature.set(Math.round(data.llmTemperature));
        }
        if (typeof data.llmMaxContextChars === 'number' && data.llmMaxContextChars >= 2000) {
          this.llmMaxContextChars.set(Math.round(data.llmMaxContextChars));
        }
        if (typeof data.llmMaxHistoryChars === 'number' && data.llmMaxHistoryChars >= 100) {
          this.llmMaxHistoryChars.set(Math.round(data.llmMaxHistoryChars));
        }
        if (typeof data.llmMaxBookChapters === 'number' && data.llmMaxBookChapters >= 1) {
          this.llmMaxBookChapters.set(Math.round(data.llmMaxBookChapters));
        }
        if (typeof data.llmMaxMangaPages === 'number' && data.llmMaxMangaPages >= 1) {
          this.llmMaxMangaPages.set(Math.round(data.llmMaxMangaPages));
        }
        if (typeof data.ocrAutoTranslate === 'boolean') {
          this.ocrAutoTranslate.set(data.ocrAutoTranslate);
        }
        if (typeof data.ocrAutoInterpret === 'boolean') {
          this.ocrAutoInterpret.set(data.ocrAutoInterpret);
        }
        if (typeof data.mangaUsePagePathForLinked === 'boolean') {
          this.mangaUsePagePathForLinked.set(data.mangaUsePagePathForLinked);
        }
        if (typeof data.mangaDualPageCalculate === 'boolean') {
          this.mangaDualPageCalculate.set(data.mangaDualPageCalculate);
        }
        if (typeof data.themeGlassmorphism === 'boolean') {
          this.themeGlassmorphism.set(data.themeGlassmorphism);
        }
        if (typeof data.theme3DCovers === 'boolean') {
          this.theme3DCovers.set(data.theme3DCovers);
        }
        if (data.libraryDefaultOrder && Object.values(OrderType).includes(data.libraryDefaultOrder)) {
          this.libraryDefaultOrder.set(data.libraryDefaultOrder);
        }
        if (data.ebookConvertMode != null) {
          this.ebookConvertMode.set(normalizeEbookConvertMode(data.ebookConvertMode));
        }
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }
  }

  private applyThemeDocumentAttrs(): void {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute(
      'data-glass',
      this.themeGlassmorphism() ? '1' : '0'
    );
    document.documentElement.setAttribute(
      'data-covers-3d',
      this.theme3DCovers() ? '1' : '0'
    );
  }

  private mergeTouchMap(defaults: TouchZoneMap, raw: Partial<TouchZoneMap>): TouchZoneMap {
    const result = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof TouchZoneMap)[]) {
      const value = raw[key];
      if (value && Object.values(TouchScreen).includes(value) && value !== TouchScreen.NOT_IMPLEMENTED) {
        result[key] = value;
      }
    }
    return result;
  }

  addLibrary(library: CustomLibrary): void {
    this.libraries.update(libs => [...libs, library]);
  }

  updateLibrary(library: CustomLibrary): void {
    this.libraries.update(libs => libs.map(l => l.id === library.id ? library : l));
  }

  deleteLibrary(id: string): void {
    this.libraries.update(libs => libs.filter(l => l.id !== id));
  }
}
