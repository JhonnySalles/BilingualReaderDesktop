import * as fs from 'fs';
import * as path from 'path';
import { JapaneseTokenizerService } from '../../../app/services/japanese-tokenizer.service';
import { JapaneseCharacterUtil } from '../../../app/services/japanese-character.util';

jest.mock('fs');
jest.mock('electron', () => ({
  app: {
    getAppPath: jest.fn().mockReturnValue('/app')
  }
}));
jest.mock('../../../app/utils/app-paths', () => ({
  getAppLibsDir: jest.fn().mockReturnValue('/userData/libs')
}));

describe('JapaneseCharacterUtil', () => {
  it('should detect kanji correctly', () => {
    expect(JapaneseCharacterUtil.containsKanji('本')).toBe(true);
    expect(JapaneseCharacterUtil.containsKanji('日本語')).toBe(true);
    expect(JapaneseCharacterUtil.containsKanji('ほん')).toBe(false);
    expect(JapaneseCharacterUtil.containsKanji('English')).toBe(false);
  });

  it('should detect Japanese characters (hiragana, katakana, kanji)', () => {
    expect(JapaneseCharacterUtil.containsJapanese('あ')).toBe(true);
    expect(JapaneseCharacterUtil.containsJapanese('ア')).toBe(true);
    expect(JapaneseCharacterUtil.containsJapanese('漢')).toBe(true);
    expect(JapaneseCharacterUtil.containsJapanese('Hello 123')).toBe(false);
  });

  it('should convert katakana reading to hiragana', () => {
    expect(JapaneseCharacterUtil.readingToHiragana('トウキョウ')).toBe('とうきょう');
    expect(JapaneseCharacterUtil.readingToHiragana('ニホンゴ')).toBe('にほんご');
    expect(JapaneseCharacterUtil.readingToHiragana('')).toBe('');
  });
});

describe('JapaneseTokenizerService', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  let service: JapaneseTokenizerService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance if necessary
    (JapaneseTokenizerService as any).instance = null;
    service = JapaneseTokenizerService.getInstance();
  });

  describe('Non-Japanese / empty text handling', () => {
    it('should return empty array for empty input', async () => {
      const tokens = await service.tokenize('');
      expect(tokens).toEqual([]);
    });

    it('should return single token without kanji for non-Japanese text without initializing engines', async () => {
      const tokens = await service.tokenize('Hello world 123');
      expect(tokens).toEqual([
        {
          surface: 'Hello world 123',
          readingHiragana: '',
          dictionaryForm: 'Hello world 123',
          hasKanji: false
        }
      ]);
    });

    it('should handle toRubyHtml for empty or non-Japanese text', async () => {
      expect(await service.toRubyHtml('')).toBe('');
      expect(await service.toRubyHtml('Hello & goodbye <tag>')).toBe('Hello &amp; goodbye &lt;tag&gt;');
    });
  });

  describe('Tokenizer with Sudachi engine', () => {
    it('should tokenize and format ruby HTML using Sudachi when available', async () => {
      // Mock sudachi-ts
      const mockMorphemes = [
        {
          surface: () => '東京',
          readingForm: () => 'トウキョウ',
          dictionaryForm: () => '東京'
        },
        {
          surface: () => 'に',
          readingForm: () => 'ニ',
          dictionaryForm: () => 'に'
        },
        {
          surface: () => '行く',
          readingForm: () => 'イク',
          dictionaryForm: () => '行く'
        }
      ];

      const mockTokenizer = {
        tokenize: jest.fn().mockReturnValue(mockMorphemes)
      };

      const mockDict = {
        create: jest.fn().mockReturnValue(mockTokenizer)
      };

      // Set up internal fields directly to test Sudachi engine execution path
      (service as any).engine = 'SUDACHI';
      (service as any).sudachi = mockTokenizer;
      (service as any).sudachiModeC = 'C';

      const tokens = await service.tokenize('東京に行く');

      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toEqual({
        surface: '東京',
        readingHiragana: 'とうきょう',
        dictionaryForm: '東京',
        hasKanji: true
      });
      expect(tokens[1]).toEqual({
        surface: 'に',
        readingHiragana: 'に',
        dictionaryForm: 'に',
        hasKanji: false
      });
      expect(tokens[2]).toEqual({
        surface: '行く',
        readingHiragana: 'いく',
        dictionaryForm: '行く',
        hasKanji: true
      });

      const rubyHtml = await service.toRubyHtml('東京に行く', true);
      expect(rubyHtml).toContain('<ruby>東京<rt>とうきょう</rt></ruby>');
      expect(rubyHtml).toContain('<span class="br-vocab" data-surface="東京" data-basic="東京">');
      expect(rubyHtml).toContain('<span class="br-vocab" data-surface="に" data-basic="に">に</span>');
      expect(rubyHtml).toContain('<ruby>行く<rt>いく</rt></ruby>');
    });

    it('should generate ruby HTML without furigana when withFurigana is false', async () => {
      const mockMorphemes = [
        {
          surface: () => '日本語',
          readingForm: () => 'ニホンゴ',
          dictionaryForm: () => '日本語'
        }
      ];
      (service as any).engine = 'SUDACHI';
      (service as any).sudachi = {
        tokenize: jest.fn().mockReturnValue(mockMorphemes)
      };

      const html = await service.toRubyHtml('日本語', false);
      expect(html).not.toContain('<ruby>');
      expect(html).toContain('<span class="br-vocab" data-surface="日本語" data-basic="日本語">日本語</span>');
    });
  });

  describe('Tokenizer with Kuromoji engine', () => {
    it('should tokenize using Kuromoji when engine is KUROMOJI', async () => {
      const mockKuromojiTokens = [
        {
          surface_form: '本',
          reading: 'ホン',
          basic_form: '本'
        },
        {
          surface_form: 'を',
          reading: 'ヲ',
          basic_form: 'を'
        },
        {
          surface_form: '読む',
          reading: 'ヨム',
          basic_form: '読む'
        }
      ];

      (service as any).engine = 'KUROMOJI';
      (service as any).kuromoji = {
        tokenize: jest.fn().mockReturnValue(mockKuromojiTokens)
      };

      const tokens = await service.tokenize('本を読む');

      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toEqual({
        surface: '本',
        readingHiragana: 'ほん',
        dictionaryForm: '本',
        hasKanji: true
      });
      expect(tokens[1]).toEqual({
        surface: 'を',
        readingHiragana: 'を',
        dictionaryForm: 'を',
        hasKanji: false
      });
      expect(tokens[2]).toEqual({
        surface: '読む',
        readingHiragana: 'よむ',
        dictionaryForm: '読む',
        hasKanji: true
      });
    });

    it('should fallback to Kuromoji if Sudachi tokenize throws an error', async () => {
      (service as any).engine = 'SUDACHI';
      (service as any).sudachi = {
        tokenize: jest.fn().mockImplementation(() => {
          throw new Error('Sudachi tokenizer crash');
        })
      };
      (service as any).kuromoji = {
        tokenize: jest.fn().mockReturnValue([
          {
            surface_form: '猫',
            reading: 'ネコ',
            basic_form: '猫'
          }
        ])
      };

      const tokens = await service.tokenize('猫');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].surface).toBe('猫');
      expect(tokens[0].readingHiragana).toBe('ねこ');
    });
  });

  describe('Fallback when no engine is available (NONE)', () => {
    it('should return fallback token when engine is NONE', async () => {
      (service as any).engine = 'NONE';
      (service as any).sudachi = null;
      (service as any).kuromoji = null;

      const tokens = await service.tokenize('漢字');
      expect(tokens).toEqual([
        {
          surface: '漢字',
          readingHiragana: '',
          dictionaryForm: '漢字',
          hasKanji: true
        }
      ]);
    });

    it('should return escaped plain text in toRubyHtml when engine is NONE', async () => {
      (service as any).engine = 'NONE';
      (service as any).sudachi = null;
      (service as any).kuromoji = null;

      const html = await service.toRubyHtml('漢字 & ひらがな');
      expect(html).toBe('漢字 &amp; ひらがな');
    });
  });
});
