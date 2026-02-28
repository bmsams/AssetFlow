/**
 * Normalization Engine
 *
 * Standardizes manufacturer names, model numbers, and specifications
 * from discovery data into canonical forms.
 *
 * Requirement 3.1: WHEN discovery data is ingested, THE Normalization_Engine
 * SHALL standardize manufacturer names, model numbers, and specifications
 * to canonical forms.
 */

import type { DiscoveryData, NormalizedAsset } from '@ams/types';
import { createLogger } from '@ams/utils';

import {
  buildManufacturerAliasMap,
  buildModelAliasMap,
  getManufacturerByCanonical,
  getModelByCanonical,
  MANUFACTURER_LOOKUP,
  MODEL_LOOKUP,
} from './lookup-tables';
import {
  combinedSimilarity,
  findBestMatch,
  type FuzzyMatchResult,
} from './fuzzy-matching';

const logger = createLogger({ service: 'normalization-engine' });

/**
 * Normalization result with confidence score
 */
export interface NormalizationResult<T> {
  /** The normalized value */
  readonly value: T;
  /** Confidence score (0-1) */
  readonly confidence: number;
  /** The original input */
  readonly originalInput: string;
  /** Whether this was an exact match */
  readonly exactMatch: boolean;
  /** The match method used */
  readonly matchMethod: 'exact' | 'alias' | 'fuzzy' | 'none';
}

/**
 * Manufacturer normalization result
 */
export interface ManufacturerNormalizationResult extends NormalizationResult<string> {
  /** Display name for the manufacturer */
  readonly displayName: string;
}

/**
 * Model normalization result
 */
export interface ModelNormalizationResult extends NormalizationResult<string> {
  /** Display name for the model */
  readonly displayName: string;
  /** Model category (LAPTOP, DESKTOP, SERVER, etc.) */
  readonly category?: string;
}

/**
 * Full asset normalization result
 */
export interface AssetNormalizationResult {
  /** Normalized manufacturer */
  readonly manufacturer: ManufacturerNormalizationResult;
  /** Normalized model */
  readonly model: ModelNormalizationResult;
  /** The normalized asset data */
  readonly normalizedAsset: NormalizedAsset;
  /** Overall confidence score */
  readonly overallConfidence: number;
}

// Pre-built lookup maps for performance
const manufacturerAliasMap = buildManufacturerAliasMap();
const modelAliasMap = buildModelAliasMap();

// Pre-built list of all manufacturer aliases for fuzzy matching
const allManufacturerAliases: string[] = [];
for (const entry of MANUFACTURER_LOOKUP) {
  allManufacturerAliases.push(entry.canonical);
  allManufacturerAliases.push(...entry.aliases);
}

/**
 * Normalize a manufacturer name to its canonical form
 *
 * Uses a three-tier matching strategy:
 * 1. Exact match against canonical names and aliases
 * 2. Fuzzy matching for close matches
 * 3. Returns original (uppercased) if no match found
 *
 * @param rawManufacturer - The raw manufacturer name from discovery
 * @returns Normalization result with canonical name and confidence
 */
export function normalizeManufacturer(
  rawManufacturer: string
): ManufacturerNormalizationResult {
  if (!rawManufacturer || rawManufacturer.trim() === '') {
    return {
      value: 'UNKNOWN',
      displayName: 'Unknown',
      confidence: 0,
      originalInput: rawManufacturer ?? '',
      exactMatch: false,
      matchMethod: 'none',
    };
  }

  const normalized = rawManufacturer.toLowerCase().trim();

  // Step 1: Try exact match against alias map
  const exactMatch = manufacturerAliasMap.get(normalized);
  if (exactMatch) {
    const entry = getManufacturerByCanonical(exactMatch);
    logger.debug('Exact manufacturer match found', {
      input: rawManufacturer,
      canonical: exactMatch,
    });
    return {
      value: exactMatch,
      displayName: entry?.displayName ?? exactMatch,
      confidence: 1.0,
      originalInput: rawManufacturer,
      exactMatch: true,
      matchMethod: 'alias',
    };
  }

  // Step 2: Try fuzzy matching
  const fuzzyResult = findBestMatch(normalized, allManufacturerAliases, 0.75);
  if (fuzzyResult) {
    // Find the canonical name for the fuzzy match
    const canonicalFromFuzzy = manufacturerAliasMap.get(fuzzyResult.match.toLowerCase());
    if (canonicalFromFuzzy) {
      const entry = getManufacturerByCanonical(canonicalFromFuzzy);
      logger.debug('Fuzzy manufacturer match found', {
        input: rawManufacturer,
        match: fuzzyResult.match,
        canonical: canonicalFromFuzzy,
        score: fuzzyResult.score,
      });
      return {
        value: canonicalFromFuzzy,
        displayName: entry?.displayName ?? canonicalFromFuzzy,
        confidence: fuzzyResult.score,
        originalInput: rawManufacturer,
        exactMatch: false,
        matchMethod: 'fuzzy',
      };
    }
  }

  // Step 3: No match found - return normalized original
  const fallbackValue = rawManufacturer.toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_');
  logger.debug('No manufacturer match found, using fallback', {
    input: rawManufacturer,
    fallback: fallbackValue,
  });
  return {
    value: fallbackValue,
    displayName: rawManufacturer.trim(),
    confidence: 0.3,
    originalInput: rawManufacturer,
    exactMatch: false,
    matchMethod: 'none',
  };
}

/**
 * Normalize a model name to its canonical form
 *
 * Uses manufacturer context for better matching.
 *
 * @param rawModel - The raw model name from discovery
 * @param manufacturerCanonical - The canonical manufacturer name
 * @returns Normalization result with canonical name and confidence
 */
export function normalizeModel(
  rawModel: string,
  manufacturerCanonical: string
): ModelNormalizationResult {
  if (!rawModel || rawModel.trim() === '') {
    return {
      value: 'UNKNOWN',
      displayName: 'Unknown',
      confidence: 0,
      originalInput: rawModel ?? '',
      exactMatch: false,
      matchMethod: 'none',
    };
  }

  const normalized = rawModel.toLowerCase().trim();

  // Get manufacturer-specific model map
  const manufacturerModels = modelAliasMap.get(manufacturerCanonical);

  if (manufacturerModels) {
    // Step 1: Try exact match against manufacturer's model aliases
    const exactMatch = manufacturerModels.get(normalized);
    if (exactMatch) {
      const entry = getModelByCanonical(exactMatch, manufacturerCanonical);
      logger.debug('Exact model match found', {
        input: rawModel,
        manufacturer: manufacturerCanonical,
        canonical: exactMatch,
      });
      return {
        value: exactMatch,
        displayName: entry?.displayName ?? exactMatch,
        category: entry?.category,
        confidence: 1.0,
        originalInput: rawModel,
        exactMatch: true,
        matchMethod: 'alias',
      };
    }

    // Step 2: Try fuzzy matching against manufacturer's models
    const manufacturerModelAliases = Array.from(manufacturerModels.keys());
    const fuzzyResult = findBestMatch(normalized, manufacturerModelAliases, 0.7);
    if (fuzzyResult) {
      const canonicalFromFuzzy = manufacturerModels.get(fuzzyResult.match.toLowerCase());
      if (canonicalFromFuzzy) {
        const entry = getModelByCanonical(canonicalFromFuzzy, manufacturerCanonical);
        logger.debug('Fuzzy model match found', {
          input: rawModel,
          manufacturer: manufacturerCanonical,
          match: fuzzyResult.match,
          canonical: canonicalFromFuzzy,
          score: fuzzyResult.score,
        });
        return {
          value: canonicalFromFuzzy,
          displayName: entry?.displayName ?? canonicalFromFuzzy,
          category: entry?.category,
          confidence: fuzzyResult.score,
          originalInput: rawModel,
          exactMatch: false,
          matchMethod: 'fuzzy',
        };
      }
    }
  }

  // Step 3: Try matching against all models (cross-manufacturer)
  const allModelAliases: string[] = [];
  for (const entry of MODEL_LOOKUP) {
    allModelAliases.push(entry.canonical);
    allModelAliases.push(...entry.aliases);
  }

  const crossManufacturerResult = findBestMatch(normalized, allModelAliases, 0.8);
  if (crossManufacturerResult) {
    // Find the model entry
    for (const entry of MODEL_LOOKUP) {
      if (
        entry.canonical.toLowerCase() === crossManufacturerResult.match.toLowerCase() ||
        entry.aliases.some((a) => a.toLowerCase() === crossManufacturerResult.match.toLowerCase())
      ) {
        logger.debug('Cross-manufacturer model match found', {
          input: rawModel,
          match: crossManufacturerResult.match,
          canonical: entry.canonical,
          score: crossManufacturerResult.score,
        });
        return {
          value: entry.canonical,
          displayName: entry.displayName,
          category: entry.category,
          confidence: crossManufacturerResult.score * 0.9, // Slight penalty for cross-manufacturer
          originalInput: rawModel,
          exactMatch: false,
          matchMethod: 'fuzzy',
        };
      }
    }
  }

  // Step 4: No match found - return normalized original
  const fallbackValue = rawModel.toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_');
  logger.debug('No model match found, using fallback', {
    input: rawModel,
    manufacturer: manufacturerCanonical,
    fallback: fallbackValue,
  });
  return {
    value: fallbackValue,
    displayName: rawModel.trim(),
    confidence: 0.3,
    originalInput: rawModel,
    exactMatch: false,
    matchMethod: 'none',
  };
}

/**
 * Normalize discovery data to canonical asset form
 *
 * Main entry point for the normalization engine.
 * Takes raw discovery data and returns normalized asset data.
 *
 * @param discoveryData - Raw discovery data from external sources
 * @returns Full normalization result with normalized asset
 */
export function normalizeDiscoveryData(
  discoveryData: DiscoveryData
): AssetNormalizationResult {
  logger.info('Normalizing discovery data', {
    sourceId: discoveryData.sourceId,
    sourceName: discoveryData.sourceName,
    manufacturer: discoveryData.manufacturer,
    model: discoveryData.model,
  });

  // Normalize manufacturer
  const manufacturerResult = normalizeManufacturer(discoveryData.manufacturer ?? '');

  // Normalize model using manufacturer context
  const modelResult = normalizeModel(
    discoveryData.model ?? '',
    manufacturerResult.value
  );

  // Calculate overall confidence
  const overallConfidence =
    (manufacturerResult.confidence + modelResult.confidence) / 2;

  // Build normalized asset
  const normalizedAsset: NormalizedAsset = {
    serialNumber: discoveryData.serialNumber,
    macAddress: discoveryData.macAddress,
    operatingSystem: discoveryData.operatingSystem,
    ipAddress: discoveryData.ipAddress,
    normalizedManufacturer: manufacturerResult.value,
    normalizedModel: modelResult.value,
  };

  logger.info('Discovery data normalized', {
    sourceId: discoveryData.sourceId,
    normalizedManufacturer: manufacturerResult.value,
    normalizedModel: modelResult.value,
    overallConfidence,
  });

  return {
    manufacturer: manufacturerResult,
    model: modelResult,
    normalizedAsset,
    overallConfidence,
  };
}

/**
 * Batch normalize multiple discovery records
 *
 * @param discoveryRecords - Array of discovery data records
 * @returns Array of normalization results
 */
export function batchNormalizeDiscoveryData(
  discoveryRecords: readonly DiscoveryData[]
): readonly AssetNormalizationResult[] {
  logger.info('Batch normalizing discovery data', { count: discoveryRecords.length });

  return discoveryRecords.map((record) => normalizeDiscoveryData(record));
}

/**
 * Get all known manufacturer canonical names
 */
export function getKnownManufacturers(): readonly string[] {
  return MANUFACTURER_LOOKUP.map((entry) => entry.canonical);
}

/**
 * Get all known model canonical names for a manufacturer
 */
export function getKnownModels(manufacturerCanonical: string): readonly string[] {
  return MODEL_LOOKUP
    .filter((entry) => entry.manufacturer === manufacturerCanonical)
    .map((entry) => entry.canonical);
}

/**
 * Check if a manufacturer is known (has entries in lookup table)
 */
export function isKnownManufacturer(canonical: string): boolean {
  return MANUFACTURER_LOOKUP.some((entry) => entry.canonical === canonical);
}

/**
 * Check if a model is known for a manufacturer
 */
export function isKnownModel(modelCanonical: string, manufacturerCanonical: string): boolean {
  return MODEL_LOOKUP.some(
    (entry) =>
      entry.canonical === modelCanonical && entry.manufacturer === manufacturerCanonical
  );
}

/**
 * Suggest similar manufacturers for an unknown input
 *
 * Useful for UI autocomplete or validation feedback.
 *
 * @param input - The input to find suggestions for
 * @param maxSuggestions - Maximum number of suggestions (default: 5)
 * @returns Array of suggested manufacturers with scores
 */
export function suggestManufacturers(
  input: string,
  maxSuggestions: number = 5
): readonly FuzzyMatchResult[] {
  if (!input || input.trim() === '') {
    return [];
  }

  const normalized = input.toLowerCase().trim();
  const suggestions: FuzzyMatchResult[] = [];

  for (const entry of MANUFACTURER_LOOKUP) {
    // Check canonical name
    const canonicalScore = combinedSimilarity(normalized, entry.canonical.toLowerCase());
    if (canonicalScore > 0.4) {
      suggestions.push({
        match: entry.canonical,
        score: canonicalScore,
        input,
      });
      continue;
    }

    // Check aliases
    let bestAliasScore = 0;
    for (const alias of entry.aliases) {
      const aliasScore = combinedSimilarity(normalized, alias.toLowerCase());
      if (aliasScore > bestAliasScore) {
        bestAliasScore = aliasScore;
      }
    }

    if (bestAliasScore > 0.4) {
      suggestions.push({
        match: entry.canonical,
        score: bestAliasScore,
        input,
      });
    }
  }

  // Sort by score and deduplicate
  const seen = new Set<string>();
  return suggestions
    .sort((a, b) => b.score - a.score)
    .filter((s) => {
      if (seen.has(s.match)) {
        return false;
      }
      seen.add(s.match);
      return true;
    })
    .slice(0, maxSuggestions);
}
