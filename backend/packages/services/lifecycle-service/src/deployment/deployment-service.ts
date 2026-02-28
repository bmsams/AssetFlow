/**
 * Deployment Service - Business logic layer for deployment operations
 *
 * Implements:
 * - Deploying assets to users (Requirement 6.6)
 * - Creating CMDB relationships on deployment (Requirement 6.6)
 * - Correlating with discovery data (Requirement 6.7)
 */

import type { UUID } from '@ams/types';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import type {
  DeploymentRecord,
  DeploymentRelationship,
  DiscoveryCorrelation,
  RelationType,
} from './deployment-repository';
import * as repository from './deployment-repository';

const logger = createLogger({ service: 'deployment-service' });

/**
 * Result of deploying an asset
 */
export interface DeployAssetResult {
  readonly deployment: DeploymentRecord;
  readonly relationships: DeploymentRelationship[];
}

/**
 * Result of assigning an asset to a user
 */
export interface AssignToUserResult {
  readonly deployment: DeploymentRecord;
  readonly previousAssignment: DeploymentRecord | null;
}

/**
 * Input for deploying an asset
 */
export interface DeployAssetInput {
  readonly assetId: UUID;
  readonly assignedToUserId: UUID;
  readonly deployedBy: UUID;
  readonly deployedByName?: string;
  readonly location?: string;
  readonly department?: string;
  readonly costCenter?: string;
  readonly notes?: string;
  /** Optional relationships to create during deployment */
  readonly relationships?: Array<{
    targetAssetId: UUID;
    relationType: RelationType;
    metadata?: Record<string, unknown>;
  }>;
  /** Optional discovery data to correlate */
  readonly discoveryData?: {
    discoverySource: string;
    discoveryRecordId: string;
    serialNumber?: string;
    macAddress?: string;
    hostname?: string;
    ipAddress?: string;
  };
}

/**
 * Input for assigning an asset to a user
 */
export interface AssignToUserInput {
  readonly assetId: UUID;
  readonly newUserId: UUID;
  readonly assignedBy: UUID;
  readonly assignedByName?: string;
  readonly location?: string;
  readonly department?: string;
  readonly costCenter?: string;
  readonly notes?: string;
}

/**
 * Input for correlating discovery data
 */
export interface CorrelateDiscoveryDataInput {
  readonly assetId: UUID;
  readonly discoverySource: string;
  readonly discoveryRecordId: string;
  readonly serialNumber?: string;
  readonly macAddress?: string;
  readonly hostname?: string;
  readonly ipAddress?: string;
  readonly correlatedBy?: UUID;
  readonly confidence?: number;
}

/**
 * Deploy an asset to a user
 * Requirement 6.6: Assign the asset to a user and create CMDB relationships
 */
export async function deployAsset(input: DeployAssetInput): Promise<DeployAssetResult> {
  logger.info('Deploying asset', {
    assetId: input.assetId,
    assignedToUserId: input.assignedToUserId,
    deployedBy: input.deployedBy,
  });

  // Create the deployment record
  const deployment = await repository.createDeployment({
    assetId: input.assetId,
    assignedToUserId: input.assignedToUserId,
    deployedBy: input.deployedBy,
    deployedByName: input.deployedByName,
    location: input.location,
    department: input.department,
    costCenter: input.costCenter,
    notes: input.notes,
  });

  const relationships: DeploymentRelationship[] = [];

  // Create CMDB relationships if specified
  if (input.relationships && input.relationships.length > 0) {
    for (const rel of input.relationships) {
      try {
        const relationship = await repository.createDeploymentRelationship({
          deploymentId: deployment.deploymentId,
          sourceAssetId: input.assetId,
          targetAssetId: rel.targetAssetId,
          relationType: rel.relationType,
          metadata: rel.metadata,
        });
        relationships.push(relationship);
      } catch (error) {
        logger.warn('Failed to create deployment relationship', {
          deploymentId: deployment.deploymentId,
          targetAssetId: rel.targetAssetId,
          relationType: rel.relationType,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with other relationships even if one fails
      }
    }
  }

  // Correlate with discovery data if provided
  if (input.discoveryData) {
    try {
      await repository.correlateDiscoveryData({
        assetId: input.assetId,
        discoverySource: input.discoveryData.discoverySource,
        discoveryRecordId: input.discoveryData.discoveryRecordId,
        serialNumber: input.discoveryData.serialNumber,
        macAddress: input.discoveryData.macAddress,
        hostname: input.discoveryData.hostname,
        ipAddress: input.discoveryData.ipAddress,
        correlatedBy: input.deployedBy,
      });
    } catch (error) {
      logger.warn('Failed to correlate discovery data during deployment', {
        deploymentId: deployment.deploymentId,
        assetId: input.assetId,
        discoverySource: input.discoveryData.discoverySource,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't fail deployment if discovery correlation fails
    }
  }

  // Publish deployment event
  await publishEvent('ASSET_DEPLOYED', {
    deploymentId: deployment.deploymentId,
    assetId: input.assetId,
    assetTag: deployment.assetTag,
    assignedToUserId: input.assignedToUserId,
    assignedToUserName: deployment.assignedToUserName,
    deployedBy: input.deployedBy,
    deploymentDate: deployment.deploymentDate,
    location: input.location,
    department: input.department,
    relationshipsCreated: relationships.length,
  });

  logger.info('Asset deployed successfully', {
    deploymentId: deployment.deploymentId,
    assetId: input.assetId,
    assignedToUserId: input.assignedToUserId,
    relationshipsCreated: relationships.length,
  });

  return {
    deployment,
    relationships,
  };
}

/**
 * Assign an asset to a different user (reassignment)
 * Requirement 6.6: Assign the asset to a user
 */
export async function assignToUser(input: AssignToUserInput): Promise<AssignToUserResult> {
  logger.info('Assigning asset to user', {
    assetId: input.assetId,
    newUserId: input.newUserId,
    assignedBy: input.assignedBy,
  });

  // Get current deployment if exists
  const previousAssignment = await repository.getDeploymentByAssetId(input.assetId);

  // Check if already assigned to the same user
  if (previousAssignment && previousAssignment.assignedToUserId === input.newUserId) {
    logger.info('Asset already assigned to this user', {
      assetId: input.assetId,
      userId: input.newUserId,
    });
    return {
      deployment: previousAssignment,
      previousAssignment: null,
    };
  }

  // Create new deployment record for the reassignment
  const deployment = await repository.createDeployment({
    assetId: input.assetId,
    assignedToUserId: input.newUserId,
    deployedBy: input.assignedBy,
    deployedByName: input.assignedByName,
    location: input.location,
    department: input.department,
    costCenter: input.costCenter,
    notes: input.notes ?? (previousAssignment 
      ? `Reassigned from ${previousAssignment.assignedToUserName ?? previousAssignment.assignedToUserId}`
      : undefined),
  });

  // Publish reassignment event
  await publishEvent('ASSET_REASSIGNED', {
    deploymentId: deployment.deploymentId,
    assetId: input.assetId,
    assetTag: deployment.assetTag,
    previousUserId: previousAssignment?.assignedToUserId ?? null,
    previousUserName: previousAssignment?.assignedToUserName ?? null,
    newUserId: input.newUserId,
    newUserName: deployment.assignedToUserName,
    assignedBy: input.assignedBy,
    deploymentDate: deployment.deploymentDate,
  });

  logger.info('Asset assigned to user successfully', {
    deploymentId: deployment.deploymentId,
    assetId: input.assetId,
    previousUserId: previousAssignment?.assignedToUserId,
    newUserId: input.newUserId,
  });

  return {
    deployment,
    previousAssignment,
  };
}

/**
 * Create CMDB relationship for a deployed asset
 * Requirement 6.6: Create CMDB relationships on deployment
 */
export async function createDeploymentRelationship(
  deploymentId: UUID,
  sourceAssetId: UUID,
  targetAssetId: UUID,
  relationType: RelationType,
  metadata?: Record<string, unknown>
): Promise<DeploymentRelationship> {
  logger.info('Creating deployment relationship', {
    deploymentId,
    sourceAssetId,
    targetAssetId,
    relationType,
  });

  // Verify deployment exists
  const deployment = await repository.getDeploymentById(deploymentId);
  if (!deployment) {
    throw new Error(`Deployment not found: ${deploymentId}`);
  }

  // Verify source asset matches deployment
  if (deployment.assetId !== sourceAssetId) {
    throw new Error(
      `Source asset ${sourceAssetId} does not match deployment asset ${deployment.assetId}`
    );
  }

  const relationship = await repository.createDeploymentRelationship({
    deploymentId,
    sourceAssetId,
    targetAssetId,
    relationType,
    metadata,
  });

  // Publish relationship created event
  await publishEvent('CMDB_RELATIONSHIP_CREATED', {
    relationshipId: relationship.relationshipId,
    deploymentId,
    sourceAssetId,
    targetAssetId,
    relationType,
    createdAt: relationship.createdAt,
  });

  logger.info('Deployment relationship created', {
    relationshipId: relationship.relationshipId,
    deploymentId,
    sourceAssetId,
    targetAssetId,
    relationType,
  });

  return relationship;
}

/**
 * Correlate discovery data with an asset
 * Requirement 6.7: Correlate discovery data with the asset record
 */
export async function correlateDiscoveryData(
  input: CorrelateDiscoveryDataInput
): Promise<DiscoveryCorrelation> {
  logger.info('Correlating discovery data', {
    assetId: input.assetId,
    discoverySource: input.discoverySource,
    discoveryRecordId: input.discoveryRecordId,
  });

  const correlation = await repository.correlateDiscoveryData({
    assetId: input.assetId,
    discoverySource: input.discoverySource,
    discoveryRecordId: input.discoveryRecordId,
    serialNumber: input.serialNumber,
    macAddress: input.macAddress,
    hostname: input.hostname,
    ipAddress: input.ipAddress,
    correlatedBy: input.correlatedBy,
    confidence: input.confidence,
  });

  // Publish correlation event
  await publishEvent('DISCOVERY_CORRELATED', {
    correlationId: correlation.correlationId,
    assetId: input.assetId,
    discoverySource: input.discoverySource,
    discoveryRecordId: input.discoveryRecordId,
    serialNumber: input.serialNumber,
    macAddress: input.macAddress,
    hostname: input.hostname,
    ipAddress: input.ipAddress,
    confidence: correlation.confidence,
    correlatedAt: correlation.correlatedAt,
  });

  logger.info('Discovery data correlated', {
    correlationId: correlation.correlationId,
    assetId: input.assetId,
    discoverySource: input.discoverySource,
    confidence: correlation.confidence,
  });

  return correlation;
}

/**
 * Auto-correlate discovery data by matching attributes
 * Requirement 6.7: Correlate discovery data with the asset record
 */
export async function autoCorrelateDiscovery(
  discoverySource: string,
  discoveryRecordId: string,
  attributes: {
    serialNumber?: string;
    macAddress?: string;
    hostname?: string;
    ipAddress?: string;
  },
  correlatedBy?: UUID
): Promise<DiscoveryCorrelation | null> {
  logger.info('Auto-correlating discovery data', {
    discoverySource,
    discoveryRecordId,
    hasSerialNumber: !!attributes.serialNumber,
    hasMacAddress: !!attributes.macAddress,
    hasHostname: !!attributes.hostname,
  });

  // Try to find matching asset
  const matchedAsset = await repository.findAssetByDiscoveryAttributes(
    attributes.serialNumber,
    attributes.macAddress,
    attributes.hostname
  );

  if (!matchedAsset) {
    logger.info('No matching asset found for discovery data', {
      discoverySource,
      discoveryRecordId,
    });
    return null;
  }

  // Calculate confidence based on match type
  let confidence = 50; // Base confidence
  if (attributes.serialNumber) confidence = 100; // Serial number is most reliable
  else if (attributes.macAddress) confidence = 90; // MAC address is very reliable
  else if (attributes.hostname) confidence = 70; // Hostname is less reliable

  const correlation = await repository.correlateDiscoveryData({
    assetId: matchedAsset.asset_id,
    discoverySource,
    discoveryRecordId,
    serialNumber: attributes.serialNumber,
    macAddress: attributes.macAddress,
    hostname: attributes.hostname,
    ipAddress: attributes.ipAddress,
    correlatedBy,
    confidence,
  });

  // Publish auto-correlation event
  await publishEvent('DISCOVERY_AUTO_CORRELATED', {
    correlationId: correlation.correlationId,
    assetId: matchedAsset.asset_id,
    assetTag: matchedAsset.asset_tag,
    discoverySource,
    discoveryRecordId,
    matchedBy: attributes.serialNumber ? 'serial_number' 
      : attributes.macAddress ? 'mac_address' 
      : 'hostname',
    confidence,
    correlatedAt: correlation.correlatedAt,
  });

  logger.info('Discovery data auto-correlated', {
    correlationId: correlation.correlationId,
    assetId: matchedAsset.asset_id,
    assetTag: matchedAsset.asset_tag,
    confidence,
  });

  return correlation;
}

/**
 * Get deployment by ID
 */
export async function getDeployment(deploymentId: UUID): Promise<DeploymentRecord | null> {
  return repository.getDeploymentById(deploymentId);
}

/**
 * Get deployment by asset ID
 */
export async function getDeploymentByAsset(assetId: UUID): Promise<DeploymentRecord | null> {
  return repository.getDeploymentByAssetId(assetId);
}

/**
 * Get deployments for a user
 */
export async function getDeploymentsForUser(
  userId: UUID,
  pagination?: { page?: number; limit?: number }
): Promise<{ items: DeploymentRecord[]; total: number; hasMore: boolean }> {
  const result = await repository.getDeploymentsByUserId(userId, pagination);
  return {
    items: [...result.items],
    total: result.total,
    hasMore: result.hasMore,
  };
}

/**
 * Get relationships created during a deployment
 */
export async function getDeploymentRelationships(
  deploymentId: UUID
): Promise<DeploymentRelationship[]> {
  return repository.getDeploymentRelationships(deploymentId);
}

/**
 * Get discovery correlations for an asset
 */
export async function getDiscoveryCorrelations(
  assetId: UUID
): Promise<DiscoveryCorrelation[]> {
  return repository.getDiscoveryCorrelations(assetId);
}

/**
 * Cancel a deployment (for pending deployments only)
 */
export async function cancelDeployment(
  deploymentId: UUID,
  cancelledBy: UUID,
  reason?: string
): Promise<DeploymentRecord> {
  logger.info('Cancelling deployment', { deploymentId, cancelledBy, reason });

  const deployment = await repository.getDeploymentById(deploymentId);
  if (!deployment) {
    throw new Error(`Deployment not found: ${deploymentId}`);
  }

  if (deployment.status === 'COMPLETED') {
    throw new Error('Cannot cancel a completed deployment');
  }

  if (deployment.status === 'CANCELLED') {
    throw new Error('Deployment is already cancelled');
  }

  const updatedDeployment = await repository.updateDeploymentStatus(deploymentId, 'CANCELLED');
  if (!updatedDeployment) {
    throw new Error(`Failed to cancel deployment: ${deploymentId}`);
  }

  // Publish cancellation event
  await publishEvent('DEPLOYMENT_CANCELLED', {
    deploymentId,
    assetId: deployment.assetId,
    assetTag: deployment.assetTag,
    cancelledBy,
    reason,
  });

  logger.info('Deployment cancelled', { deploymentId, cancelledBy });

  return updatedDeployment;
}

// Re-export types
export type {
  CorrelateDiscoveryInput,
  CreateRelationshipInput,
  DeploymentRecord,
  DeploymentRelationship,
  DeploymentStatus,
  DiscoveryCorrelation,
  RelationType,
} from './deployment-repository';
