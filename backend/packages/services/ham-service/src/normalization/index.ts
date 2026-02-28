/**
 * Normalization Module
 *
 * Exports the normalization engine and related utilities for
 * standardizing manufacturer names, model numbers, and specifications.
 *
 * Requirement 3.1: Normalization Engine for discovery data
 */

// Main normalization engine
export {
  normalizeManufacturer,
  normalizeModel,
  normalizeDiscoveryData,
  batchNormalizeDiscoveryData,
  getKnownManufacturers,
  getKnownModels,
  isKnownManufacturer,
  isKnownModel,
  suggestManufacturers,
  type ManufacturerNormalizationResult,
  type ModelNormalizationResult,
  type AssetNormalizationResult,
  type NormalizationResult,
} from './normalization-engine';

// Lookup tables
export {
  MANUFACTURER_LOOKUP,
  MODEL_LOOKUP,
  buildManufacturerAliasMap,
  buildModelAliasMap,
  getManufacturerByCanonical,
  getModelByCanonical,
  type ManufacturerEntry,
  type ModelEntry,
} from './lookup-tables';

// Fuzzy matching utilities
export {
  levenshteinDistance,
  levenshteinSimilarity,
  jaroWinklerSimilarity,
  ngramSimilarity,
  combinedSimilarity,
  findBestMatch,
  findAllMatches,
  containsIgnoreCase,
  startsWithIgnoreCase,
  type FuzzyMatchResult,
} from './fuzzy-matching';
