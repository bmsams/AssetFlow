/**
 * Asset Relationship Service - Business logic layer for asset relationships
 *
 * Implements CMDB relationship management with:
 * - Referential integrity enforcement (Requirement 2.9)
 * - Support for multiple relationship types (Requirement 2.3)
 * - Circular dependency detection for hierarchical relationships
 */

import type {
  AssetRelationship,
  AssetRelationType,
  CreateRelationshipRequest,
  DeleteRelationshipRequest,
  PaginatedResult,
  PaginationParams,
  RelatedAsset,
  RelatedAssetsQuery,
  UUID,
} from '@ams/types';
import { createLogger } from '@ams/utils';

import * as assetRepository from './asset-repository';
import * as relationshipRepository from './relationship-repository';

const logger = createLogger({ service: 'relationship-service' });

/**
 * Error thrown when a relationship operation violates referential integrity
 */
export class ReferentialIntegrityError extends Error {
  readonly assetId: UUID;
  readonly reason: string;

  constructor(assetId: UUID, reason: string) {
    super(`Referential integrity violation for asset ${assetId}: ${reason}`);
    this.name = 'ReferentialIntegrityError';
    this.assetId = assetId;
    this.reason = reason;
  }
}

/**
 * Error thrown when a circular dependency would be created
 */
export class CircularDependencyError extends Error {
  readonly sourceAssetId: UUID;
  readonly targetAssetId: UUID;
  readonly relationType: AssetRelationType;

  constructor(sourceAssetId: UUID, targetAssetId: UUID, relationType: AssetRelationType) {
    super(
      `Creating relationship ${sourceAssetId} -> ${targetAssetId} (${relationType}) would create a circular dependency`
    );
    this.name = 'CircularDependencyError';
    this.sourceAssetId = sourceAssetId;
    this.targetAssetId = targetAssetId;
    this.relationType = relationType;
  }
}

/**
 * Error thrown when a duplicate relationship is detected
 */
export class DuplicateRelationshipError extends Error {
  readonly sourceAssetId: UUID;
  readonly targetAssetId: UUID;
  readonly relationType: AssetRelationType;

  constructor(sourceAssetId: UUID, targetAssetId: UUID, relationType: AssetRelationType) {
    super(
      `Relationship already exists: ${sourceAssetId} -> ${targetAssetId} (${relationType})`
    );
    this.name = 'DuplicateRelationshipError';
    this.sourceAssetId = sourceAssetId;
    this.targetAssetId = targetAssetId;
    this.relationType = relationType;
  }
}

/**
 * Link two assets with a relationship
 *
 * Implements Requirement 2.3: Maintain asset relationships in the CMDB
 * Implements Requirement 2.9: Enforce referential integrity for relationships
 *
 * @param request - The relationship creation request
 * @param userId - The user creating the relationship
 * @returns The created relationship
 * @throws ReferentialIntegrityError if source or target asset doesn't exist
 * @throws CircularDependencyError if the relationship would create a cycle
 * @throws DuplicateRelationshipError if the relationship already exists
 */
export async function linkAssets(
  request: CreateRelationshipRequest,
  userId?: UUID
): Promise<AssetRelationship> {
  logger.info('Linking assets', {
    sourceAssetId: request.sourceAssetId,
    targetAssetId: request.targetAssetId,
    relationType: request.relationType,
    userId,
  });

  // Validate source asset exists
  const sourceExists = await relationshipRepository.assetExists(request.sourceAssetId);
  if (!sourceExists) {
    throw new ReferentialIntegrityError(
      request.sourceAssetId,
      'Source asset does not exist'
    );
  }

  // Validate target asset exists
  const targetExists = await relationshipRepository.assetExists(request.targetAssetId);
  if (!targetExists) {
    throw new ReferentialIntegrityError(
      request.targetAssetId,
      'Target asset does not exist'
    );
  }

  // Prevent self-referential relationships
  if (request.sourceAssetId === request.targetAssetId) {
    throw new ReferentialIntegrityError(
      request.sourceAssetId,
      'Cannot create relationship between an asset and itself'
    );
  }

  // Check for duplicate relationship
  const exists = await relationshipRepository.relationshipExists(
    request.sourceAssetId,
    request.targetAssetId,
    request.relationType
  );
  if (exists) {
    throw new DuplicateRelationshipError(
      request.sourceAssetId,
      request.targetAssetId,
      request.relationType
    );
  }

  // Check for circular dependencies (for hierarchical relationship types)
  const wouldCreateCycle = await relationshipRepository.wouldCreateCircularDependency(
    request.sourceAssetId,
    request.targetAssetId,
    request.relationType
  );
  if (wouldCreateCycle) {
    throw new CircularDependencyError(
      request.sourceAssetId,
      request.targetAssetId,
      request.relationType
    );
  }

  // Create the relationship
  const relationship = await relationshipRepository.createRelationship(request, userId);

  logger.info('Assets linked successfully', {
    relationshipId: relationship.relationshipId,
    sourceAssetId: request.sourceAssetId,
    targetAssetId: request.targetAssetId,
    relationType: request.relationType,
  });

  return relationship;
}

/**
 * Unlink two assets by removing their relationship
 *
 * @param request - The relationship deletion request
 * @returns True if the relationship was deleted, false if it didn't exist
 */
export async function unlinkAssets(request: DeleteRelationshipRequest): Promise<boolean> {
  logger.info('Unlinking assets', {
    sourceAssetId: request.sourceAssetId,
    targetAssetId: request.targetAssetId,
    relationType: request.relationType,
  });

  const deleted = await relationshipRepository.deleteRelationship(
    request.sourceAssetId,
    request.targetAssetId,
    request.relationType
  );

  if (deleted) {
    logger.info('Assets unlinked successfully', {
      sourceAssetId: request.sourceAssetId,
      targetAssetId: request.targetAssetId,
      relationType: request.relationType,
    });
  } else {
    logger.warn('Relationship not found for unlinking', {
      sourceAssetId: request.sourceAssetId,
      targetAssetId: request.targetAssetId,
      relationType: request.relationType,
    });
  }

  return deleted;
}

/**
 * Get all related assets for a given asset
 *
 * Implements Requirement 2.3: Maintain asset relationships in the CMDB
 *
 * @param query - The query parameters
 * @returns Array of related assets with relationship details
 */
export async function getRelatedAssets(
  query: RelatedAssetsQuery
): Promise<RelatedAsset[]> {
  logger.info('Getting related assets', {
    assetId: query.assetId,
    relationType: query.relationType,
    direction: query.direction,
  });

  // Get relationships for the asset
  const relationships = await relationshipRepository.getRelationshipsForAsset(
    query.assetId,
    {
      relationType: query.relationType,
      direction: query.direction,
    }
  );

  // Fetch the related assets
  const relatedAssets: RelatedAsset[] = [];

  for (const relationship of relationships) {
    // Determine which asset is the "related" one
    const isSource = relationship.sourceAssetId === query.assetId;
    const relatedAssetId = isSource ? relationship.targetAssetId : relationship.sourceAssetId;
    const direction = isSource ? 'target' : 'source';

    // Fetch the related asset
    const asset = await assetRepository.getAssetById(relatedAssetId);
    if (asset) {
      relatedAssets.push({
        asset,
        relationship,
        direction,
      });
    }
  }

  logger.info('Related assets retrieved', {
    assetId: query.assetId,
    count: relatedAssets.length,
  });

  return relatedAssets;
}

/**
 * Get relationships for an asset with pagination
 *
 * @param assetId - The asset ID
 * @param options - Filter options
 * @param pagination - Pagination parameters
 * @returns Paginated list of relationships
 */
export async function getRelationships(
  assetId: UUID,
  options: {
    relationType?: AssetRelationType;
    direction?: 'source' | 'target' | 'both';
  } = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<AssetRelationship>> {
  logger.info('Getting relationships', { assetId, options, pagination });

  return relationshipRepository.getRelationshipsForAssetPaginated(
    assetId,
    options,
    pagination
  );
}

/**
 * Get a specific relationship by ID
 *
 * @param relationshipId - The relationship ID
 * @returns The relationship or null if not found
 */
export async function getRelationshipById(
  relationshipId: UUID
): Promise<AssetRelationship | null> {
  return relationshipRepository.getRelationshipById(relationshipId);
}

/**
 * Delete a relationship by ID
 *
 * @param relationshipId - The relationship ID
 * @returns True if deleted, false if not found
 */
export async function deleteRelationshipById(relationshipId: UUID): Promise<boolean> {
  logger.info('Deleting relationship by ID', { relationshipId });

  const deleted = await relationshipRepository.deleteRelationshipById(relationshipId);

  if (deleted) {
    logger.info('Relationship deleted successfully', { relationshipId });
  } else {
    logger.warn('Relationship not found for deletion', { relationshipId });
  }

  return deleted;
}

/**
 * Get relationship statistics for an asset
 *
 * @param assetId - The asset ID
 * @returns Counts of relationships by type
 */
export async function getRelationshipStats(
  assetId: UUID
): Promise<Record<AssetRelationType, number>> {
  return relationshipRepository.getRelationshipCountsByType(assetId);
}

/**
 * Delete all relationships for an asset
 * Used when deleting an asset to maintain referential integrity
 *
 * @param assetId - The asset ID
 * @returns Number of relationships deleted
 */
export async function deleteAllRelationshipsForAsset(assetId: UUID): Promise<number> {
  logger.info('Deleting all relationships for asset', { assetId });

  const deletedCount = await relationshipRepository.deleteAllRelationshipsForAsset(assetId);

  logger.info('All relationships deleted for asset', { assetId, deletedCount });

  return deletedCount;
}
