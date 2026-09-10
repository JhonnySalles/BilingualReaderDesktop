import {
  buildTranslateSystemPrompt,
  isTranslateTargetEnabled,
  joinOcrText,
  mapOcrLangToSource,
  normalizeTranslateTarget,
  temperaturePrefToApi
} from './llm-translate.prompts';

describe('llm-translate.prompts', () => {
  it('maps OCR langs to source', () => {
    expect(mapOcrLangToSource('jpn')).toBe('ja');
    expect(mapOcrLangToSource('jpn_vert')).toBe('ja');
    expect(mapOcrLangToSource('eng')).toBe('en');
    expect(mapOcrLangToSource('por')).toBe('pt');
    expect(mapOcrLangToSource('')).toBe('unknown');
  });

  it('normalizes translate targets', () => {
    expect(normalizeTranslateTarget('portuguese')).toBe('PORTUGUESE');
    expect(normalizeTranslateTarget('ENGLISH')).toBe('ENGLISH');
    expect(normalizeTranslateTarget('OFF')).toBe('OFF');
    expect(normalizeTranslateTarget('Desativado')).toBe('OFF');
  });

  it('detects enabled targets', () => {
    expect(isTranslateTargetEnabled('PORTUGUESE')).toBeTrue();
    expect(isTranslateTargetEnabled('ENGLISH')).toBeTrue();
    expect(isTranslateTargetEnabled('OFF')).toBeFalse();
  });

  it('converts temperature pref 0–100 to 0–1', () => {
    expect(temperaturePrefToApi(80)).toBeCloseTo(0.8);
    expect(temperaturePrefToApi(0)).toBe(0);
    expect(temperaturePrefToApi(100)).toBe(1);
    expect(temperaturePrefToApi(NaN)).toBe(0.8);
  });

  it('joins OCR text preferring fullText', () => {
    expect(joinOcrText('  hello  ', ['a', 'b'])).toBe('hello');
    expect(joinOcrText('', ['a', 'b'])).toBe('a\nb');
    expect(joinOcrText('  ', [])).toBe('');
  });

  it('builds distinct prompts for literal vs interpret', () => {
    const literal = buildTranslateSystemPrompt('literal', 'ja', 'PORTUGUESE');
    const interpret = buildTranslateSystemPrompt('interpret', 'ja', 'PORTUGUESE');
    expect(literal).toContain('faithful');
    expect(literal).not.toContain('interpretive');
    expect(interpret).toContain('interpretive');
    expect(interpret).toContain('Brazilian Portuguese');
  });

  it('uses English target label when ENGLISH', () => {
    const prompt = buildTranslateSystemPrompt('literal', 'ja', 'ENGLISH');
    expect(prompt).toContain('English');
    expect(prompt).not.toContain('Brazilian Portuguese');
  });
});
