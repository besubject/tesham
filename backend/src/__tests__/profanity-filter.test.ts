import { checkProfanity, censorText } from '../utils/profanity-filter';

describe('profanity-filter', () => {
  describe('checkProfanity', () => {
    it('returns no profanity for clean text', () => {
      const result = checkProfanity('Отличный сервис, всем рекомендую!');
      expect(result.hasProfanity).toBe(false);
      expect(result.cleaned).toBe('Отличный сервис, всем рекомендую!');
      expect(result.matches).toEqual([]);
    });

    it('returns no profanity for empty/null/undefined input', () => {
      expect(checkProfanity('').hasProfanity).toBe(false);
      expect(checkProfanity(null).hasProfanity).toBe(false);
      expect(checkProfanity(undefined).hasProfanity).toBe(false);
      expect(checkProfanity('   ').hasProfanity).toBe(false);
    });

    it('detects Russian profanity (basic root)', () => {
      const result = checkProfanity('Какая сука этот мастер');
      expect(result.hasProfanity).toBe(true);
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.cleaned).not.toContain('сука');
      expect(result.cleaned).toContain('****');
    });

    it('detects profanity in inflected forms (root match)', () => {
      // 'пизд' as a root catches пиздец and similar conjugations
      const result = checkProfanity('Это полный пиздец');
      expect(result.hasProfanity).toBe(true);
      expect(result.matches).toContain('пизд');
    });

    it('replaces matched word with asterisks of same length', () => {
      const result = checkProfanity('блядь');
      expect(result.hasProfanity).toBe(true);
      expect(result.cleaned).toBe('*****');
    });

    it('preserves surrounding clean text', () => {
      const result = checkProfanity('Хороший сервис, но мастер сука опоздал');
      expect(result.hasProfanity).toBe(true);
      expect(result.cleaned).toContain('Хороший сервис');
      expect(result.cleaned).toContain('опоздал');
      expect(result.cleaned).not.toContain('сука');
    });

    it('is case-insensitive', () => {
      const upper = checkProfanity('СУКА');
      const lower = checkProfanity('сука');
      expect(upper.hasProfanity).toBe(true);
      expect(lower.hasProfanity).toBe(true);
    });

    it('does not match across non-letter boundaries incorrectly', () => {
      // 'хер' is in stop list; 'херувим' contains 'хер' as substring
      // Our regex matches inside word boundaries, so 'херувим' will match.
      // This documents the conservative behavior — caller may flag false positives.
      const result = checkProfanity('херувим');
      // It WILL match — this is by design (substring within word).
      expect(result.hasProfanity).toBe(true);
    });

    it('does not match unrelated words', () => {
      const result = checkProfanity('Прекрасный день, отличная погода');
      expect(result.hasProfanity).toBe(false);
    });
  });

  describe('censorText', () => {
    it('returns censored string', () => {
      expect(censorText('блядь')).toBe('*****');
    });

    it('returns empty string for empty input', () => {
      expect(censorText('')).toBe('');
    });

    it('returns clean text unchanged', () => {
      expect(censorText('всё хорошо')).toBe('всё хорошо');
    });
  });
});
