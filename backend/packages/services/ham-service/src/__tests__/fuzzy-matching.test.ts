/**
 * Fuzzy Matching Tests
 *
 * Tests for the fuzzy string matching algorithms used by the normalization engine.
 */

import {
  levenshteinDistance,
  levenshteinSimilarity,
  jaroWinklerSimilarity,
  ngramSimilarity,
  combinedSimilarity,
  findBestMatch,
  findAllMatches,
  containsIgnoreCase,
  startsWithIgnoreCase,
} from '../normalization/fuzzy-matching';

describe('Fuzzy Matching', () => {
  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
    });

    it('should return correct distance for single character difference', () => {
      expect(levenshteinDistance('hello', 'hallo')).toBe(1);
    });

    it('should return correct distance for insertion', () => {
      expect(levenshteinDistance('hello', 'helloo')).toBe(1);
    });

    it('should return correct distance for deletion', () => {
      expect(levenshteinDistance('hello', 'helo')).toBe(1);
    });

    it('should return correct distance for multiple edits', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    });

    it('should handle empty strings', () => {
      expect(levenshteinDistance('', '')).toBe(0);
      expect(levenshteinDistance('hello', '')).toBe(5);
      expect(levenshteinDistance('', 'hello')).toBe(5);
    });
  });

  describe('levenshteinSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(levenshteinSimilarity('hello', 'hello')).toBe(1);
    });

    it('should return 0 for completely different strings', () => {
      expect(levenshteinSimilarity('abc', 'xyz')).toBe(0);
    });

    it('should return value between 0 and 1 for similar strings', () => {
      const similarity = levenshteinSimilarity('hello', 'hallo');
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it('should return 1 for two empty strings', () => {
      expect(levenshteinSimilarity('', '')).toBe(1);
    });
  });

  describe('jaroWinklerSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(jaroWinklerSimilarity('hello', 'hello')).toBe(1);
    });

    it('should return 0 for completely different strings', () => {
      expect(jaroWinklerSimilarity('abc', 'xyz')).toBe(0);
    });

    it('should give higher score to strings matching from beginning', () => {
      const score1 = jaroWinklerSimilarity('DELL', 'DELLX');
      const score2 = jaroWinklerSimilarity('DELL', 'XDELL');
      expect(score1).toBeGreaterThan(score2);
    });

    it('should handle transpositions', () => {
      const similarity = jaroWinklerSimilarity('MARTHA', 'MARHTA');
      expect(similarity).toBeGreaterThan(0.9);
    });

    it('should handle empty strings', () => {
      expect(jaroWinklerSimilarity('', '')).toBe(1);
      expect(jaroWinklerSimilarity('hello', '')).toBe(0);
      expect(jaroWinklerSimilarity('', 'hello')).toBe(0);
    });
  });

  describe('ngramSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(ngramSimilarity('hello', 'hello')).toBe(1);
    });

    it('should return 0 for completely different strings', () => {
      expect(ngramSimilarity('abc', 'xyz')).toBe(0);
    });

    it('should return value between 0 and 1 for similar strings', () => {
      const similarity = ngramSimilarity('hello', 'hallo');
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it('should handle strings shorter than n', () => {
      expect(ngramSimilarity('a', 'a', 2)).toBe(1);
      expect(ngramSimilarity('a', 'b', 2)).toBe(0);
    });

    it('should work with different n values', () => {
      const bigram = ngramSimilarity('hello', 'hallo', 2);
      const trigram = ngramSimilarity('hello', 'hallo', 3);
      expect(bigram).toBeGreaterThan(0);
      expect(trigram).toBeGreaterThan(0);
    });
  });

  describe('combinedSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(combinedSimilarity('hello', 'hello')).toBe(1);
    });

    it('should be case insensitive', () => {
      expect(combinedSimilarity('HELLO', 'hello')).toBe(1);
    });

    it('should trim whitespace', () => {
      expect(combinedSimilarity('  hello  ', 'hello')).toBe(1);
    });

    it('should return high score for similar strings', () => {
      const similarity = combinedSimilarity('Dell Inc', 'Dell Inc.');
      expect(similarity).toBeGreaterThan(0.9);
    });

    it('should return low score for different strings', () => {
      const similarity = combinedSimilarity('Dell', 'Apple');
      expect(similarity).toBeLessThan(0.5);
    });
  });

  describe('findBestMatch', () => {
    const candidates = ['Dell', 'HP', 'Lenovo', 'Apple', 'Microsoft'];

    it('should find exact match', () => {
      const result = findBestMatch('Dell', candidates);
      expect(result).not.toBeNull();
      expect(result!.match).toBe('Dell');
      expect(result!.score).toBe(1);
    });

    it('should find case-insensitive match', () => {
      const result = findBestMatch('DELL', candidates);
      expect(result).not.toBeNull();
      expect(result!.match).toBe('Dell');
      expect(result!.score).toBe(1);
    });

    it('should find fuzzy match', () => {
      const result = findBestMatch('Dellll', candidates, 0.7);
      expect(result).not.toBeNull();
      expect(result!.match).toBe('Dell');
      expect(result!.score).toBeGreaterThan(0.7);
    });

    it('should return null when no match above threshold', () => {
      const result = findBestMatch('XYZ Corp', candidates, 0.9);
      expect(result).toBeNull();
    });

    it('should return null for empty candidates', () => {
      const result = findBestMatch('Dell', []);
      expect(result).toBeNull();
    });

    it('should respect threshold parameter', () => {
      const highThreshold = findBestMatch('Dellll', candidates, 0.99);
      const lowThreshold = findBestMatch('Dellll', candidates, 0.5);
      expect(highThreshold).toBeNull();
      expect(lowThreshold).not.toBeNull();
    });
  });

  describe('findAllMatches', () => {
    const candidates = ['Dell', 'Dell Inc', 'Dell Technologies', 'HP', 'Lenovo'];

    it('should find all matches above threshold', () => {
      const results = findAllMatches('Dell', candidates, 0.5);
      expect(results.length).toBeGreaterThan(1);
      expect(results.every((r) => r.score >= 0.5)).toBe(true);
    });

    it('should sort results by score descending', () => {
      const results = findAllMatches('Dell', candidates, 0.5);
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        if (prev && curr) {
          expect(prev.score).toBeGreaterThanOrEqual(curr.score);
        }
      }
    });

    it('should limit results to maxResults', () => {
      const results = findAllMatches('Dell', candidates, 0.3, 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array when no matches', () => {
      const results = findAllMatches('XYZ', candidates, 0.9);
      expect(results).toHaveLength(0);
    });
  });

  describe('containsIgnoreCase', () => {
    it('should find substring case-insensitively', () => {
      expect(containsIgnoreCase('Hello World', 'world')).toBe(true);
      expect(containsIgnoreCase('Hello World', 'WORLD')).toBe(true);
      expect(containsIgnoreCase('Hello World', 'World')).toBe(true);
    });

    it('should return false when substring not found', () => {
      expect(containsIgnoreCase('Hello World', 'xyz')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(containsIgnoreCase('Hello', '')).toBe(true);
      expect(containsIgnoreCase('', 'Hello')).toBe(false);
    });
  });

  describe('startsWithIgnoreCase', () => {
    it('should check prefix case-insensitively', () => {
      expect(startsWithIgnoreCase('Hello World', 'hello')).toBe(true);
      expect(startsWithIgnoreCase('Hello World', 'HELLO')).toBe(true);
      expect(startsWithIgnoreCase('Hello World', 'Hello')).toBe(true);
    });

    it('should return false when prefix not matched', () => {
      expect(startsWithIgnoreCase('Hello World', 'World')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(startsWithIgnoreCase('Hello', '')).toBe(true);
      expect(startsWithIgnoreCase('', 'Hello')).toBe(false);
    });
  });
});
