/**
 * Fuzzy Matching for Normalization Engine
 *
 * Implements fuzzy string matching algorithms for finding similar
 * manufacturer and model names when exact matches are not found.
 *
 * Requirement 3.1: Implement fuzzy matching for unknown manufacturers
 */

/**
 * Fuzzy match result
 */
export interface FuzzyMatchResult {
  /** The matched value */
  readonly match: string;
  /** Similarity score (0-1, where 1 is exact match) */
  readonly score: number;
  /** The original input */
  readonly input: string;
}

/**
 * Calculate Levenshtein distance between two strings
 *
 * The Levenshtein distance is the minimum number of single-character edits
 * (insertions, deletions, or substitutions) required to change one string
 * into the other.
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns The edit distance between the strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create a matrix to store distances
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = [];
    for (let j = 0; j <= n; j++) {
      dp[i]![j] = 0;
    }
  }

  // Initialize first column
  for (let i = 0; i <= m; i++) {
    dp[i]![0] = i;
  }

  // Initialize first row
  for (let j = 0; j <= n; j++) {
    dp[0]![j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!;
      } else {
        dp[i]![j] = 1 + Math.min(
          dp[i - 1]![j]!,     // deletion
          dp[i]![j - 1]!,     // insertion
          dp[i - 1]![j - 1]!  // substitution
        );
      }
    }
  }

  return dp[m]![n]!;
}

/**
 * Calculate similarity score based on Levenshtein distance
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score between 0 and 1
 */
export function levenshteinSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) {
    return 1; // Both strings are empty
  }

  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLength;
}

/**
 * Calculate Jaro-Winkler similarity between two strings
 *
 * Jaro-Winkler is particularly good for short strings like names.
 * It gives higher scores to strings that match from the beginning.
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score between 0 and 1
 */
export function jaroWinklerSimilarity(str1: string, str2: string): number {
  if (str1 === str2) {
    return 1;
  }

  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0 || len2 === 0) {
    return 0;
  }

  // Calculate match window
  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;

  const str1Matches = new Array(len1).fill(false);
  const str2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);

    for (let j = start; j < end; j++) {
      if (str2Matches[j] || str1[i] !== str2[j]) {
        continue;
      }
      str1Matches[i] = true;
      str2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) {
    return 0;
  }

  // Count transpositions
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!str1Matches[i]) {
      continue;
    }
    while (!str2Matches[k]) {
      k++;
    }
    if (str1[i] !== str2[k]) {
      transpositions++;
    }
    k++;
  }

  // Calculate Jaro similarity
  const jaro =
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  // Calculate common prefix (up to 4 characters)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (str1[i] === str2[i]) {
      prefix++;
    } else {
      break;
    }
  }

  // Jaro-Winkler similarity (with scaling factor of 0.1)
  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Calculate n-gram similarity between two strings
 *
 * N-gram similarity compares the set of n-character substrings.
 * Good for catching typos and character transpositions.
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @param n - Size of n-grams (default: 2 for bigrams)
 * @returns Similarity score between 0 and 1
 */
export function ngramSimilarity(str1: string, str2: string, n: number = 2): number {
  if (str1 === str2) {
    return 1;
  }

  if (str1.length < n || str2.length < n) {
    return str1 === str2 ? 1 : 0;
  }

  // Generate n-grams
  const ngrams1 = new Set<string>();
  const ngrams2 = new Set<string>();

  for (let i = 0; i <= str1.length - n; i++) {
    ngrams1.add(str1.substring(i, i + n));
  }

  for (let i = 0; i <= str2.length - n; i++) {
    ngrams2.add(str2.substring(i, i + n));
  }

  // Calculate intersection
  let intersection = 0;
  for (const ngram of ngrams1) {
    if (ngrams2.has(ngram)) {
      intersection++;
    }
  }

  // Jaccard similarity
  const union = ngrams1.size + ngrams2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Combined similarity score using multiple algorithms
 *
 * Combines Levenshtein, Jaro-Winkler, and n-gram similarities
 * with weighted averaging for more robust matching.
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Combined similarity score between 0 and 1
 */
export function combinedSimilarity(str1: string, str2: string): number {
  // Normalize strings for comparison
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) {
    return 1;
  }

  // Calculate individual similarities
  const levenshtein = levenshteinSimilarity(s1, s2);
  const jaroWinkler = jaroWinklerSimilarity(s1, s2);
  const ngram = ngramSimilarity(s1, s2, 2);

  // Weighted average (Jaro-Winkler is best for names)
  return levenshtein * 0.25 + jaroWinkler * 0.5 + ngram * 0.25;
}

/**
 * Find the best fuzzy match from a list of candidates
 *
 * @param input - The input string to match
 * @param candidates - List of candidate strings to match against
 * @param threshold - Minimum similarity score to consider a match (default: 0.7)
 * @returns The best match result, or null if no match above threshold
 */
export function findBestMatch(
  input: string,
  candidates: readonly string[],
  threshold: number = 0.7
): FuzzyMatchResult | null {
  if (candidates.length === 0) {
    return null;
  }

  const normalizedInput = input.toLowerCase().trim();
  let bestMatch: FuzzyMatchResult | null = null;

  for (const candidate of candidates) {
    const normalizedCandidate = candidate.toLowerCase().trim();
    const score = combinedSimilarity(normalizedInput, normalizedCandidate);

    if (score >= threshold && (bestMatch === null || score > bestMatch.score)) {
      bestMatch = {
        match: candidate,
        score,
        input,
      };
    }
  }

  return bestMatch;
}

/**
 * Find all matches above a threshold, sorted by score
 *
 * @param input - The input string to match
 * @param candidates - List of candidate strings to match against
 * @param threshold - Minimum similarity score to consider a match (default: 0.6)
 * @param maxResults - Maximum number of results to return (default: 5)
 * @returns Array of match results sorted by score (highest first)
 */
export function findAllMatches(
  input: string,
  candidates: readonly string[],
  threshold: number = 0.6,
  maxResults: number = 5
): readonly FuzzyMatchResult[] {
  const normalizedInput = input.toLowerCase().trim();
  const results: FuzzyMatchResult[] = [];

  for (const candidate of candidates) {
    const normalizedCandidate = candidate.toLowerCase().trim();
    const score = combinedSimilarity(normalizedInput, normalizedCandidate);

    if (score >= threshold) {
      results.push({
        match: candidate,
        score,
        input,
      });
    }
  }

  // Sort by score descending and limit results
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

/**
 * Check if a string contains another string (case-insensitive)
 *
 * @param haystack - The string to search in
 * @param needle - The string to search for
 * @returns True if needle is found in haystack
 */
export function containsIgnoreCase(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Check if a string starts with another string (case-insensitive)
 *
 * @param str - The string to check
 * @param prefix - The prefix to look for
 * @returns True if str starts with prefix
 */
export function startsWithIgnoreCase(str: string, prefix: string): boolean {
  return str.toLowerCase().startsWith(prefix.toLowerCase());
}
