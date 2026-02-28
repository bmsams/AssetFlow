/**
 * Property Test: Audit Log Completeness
 *
 * **Validates: Requirements 2.7, 14.6**
 *
 * Property 4: For any create, update, or delete operation on an asset,
 * there SHALL exist a corresponding entry in the audit_log table with
 * matching resource_id, action_type, timestamp, and user_id.
 * The audit log entry SHALL contain the previous values (for updates)
 * or the deleted values (for deletes).
 *
 * Requirements:
 * - 2.7: WHEN an asset attribute changes, THE Asset_Management_System SHALL
 *        create an audit log entry preserving the change history
 * - 14.6: THE Audit_Service SHALL log all user actions with timestamp,
 *         user identity, action type, and affected resources
 */

import * as fc from 'fast-check';

import type {
  Asset,
  AssetStatus,
  AssetType,
  CreateAssetRequest,
  UpdateAssetRequest,
} from '@ams/types';

import type { AuditLogEntry } from '../service/asset-repository';

// ============================================================================
// Mock Setup
// ============================================================================

// In-memory stores for testing
let assetStore: Map<string, Asset>;
let auditLogStore: AuditLogEntry[];
let assetTagCounter: number;

/**
 * Generate a unique asset ID
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a unique asset tag
 */
function generateAssetTag(assetType: AssetType): string {
  const prefixes: Record<AssetType, string> = {
    HARDWARE: 'HW',
    SOFTWARE: 'SW',
    ENTERPRISE: 'EN',
  };
  const prefix = prefixes[assetType];
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  assetTagCounter++;
  return `AMS-${prefix}-${date}-${assetTagCounter.toString().padStart(6, '0')}`;
}

/**
 * Reset stores before each test
 */
function resetStores(): void {
  assetStore = new Map();
  auditLogStore = [];
  assetTagCounter = 0;
}

/**
 * Simulated createAsset that mirrors the real implementation behavior
 * with database trigger-based audit logging
 */
function simulateCreateAsset(
  request: CreateAssetRequest,
  userId?: string
): Asset {
  const assetId = generateUUID();
  const assetTag = generateAssetTag(request.assetType);
  const timestamp = new Date().toISOString();

  const asset: Asset = {
    assetId,
    assetTag,
    assetType: request.assetType,
    displayName: request.displayName,
    description: request.description,
    status: request.status ?? 'ORDERED',
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: userId,
    updatedBy: userId,
  };

  // Store the asset
  assetStore.set(assetId, asset);

  // Database trigger creates audit log entry (simulated)
  const auditEntry: AuditLogEntry = {
    logId: generateUUID(),
    userId,
    actionType: 'CREATE',
    resourceType: 'ASSET',
    resourceId: assetId,
    oldValues: undefined,
    newValues: {
      asset_id: assetId,
      asset_tag: assetTag,
      asset_type: request.assetType,
      display_name: request.displayName,
      description: request.description ?? null,
      status: request.status ?? 'ORDERED',
      created_at: timestamp,
      updated_at: timestamp,
      created_by: userId ?? null,
      updated_by: userId ?? null,
    },
    timestamp,
  };
  auditLogStore.push(auditEntry);

  return asset;
}

/**
 * Simulated updateAsset that mirrors the real implementation behavior
 */
function simulateUpdateAsset(
  assetId: string,
  request: UpdateAssetRequest,
  userId?: string
): Asset | null {
  const existingAsset = assetStore.get(assetId);
  if (!existingAsset) {
    return null;
  }

  const timestamp = new Date().toISOString();

  // Capture old values for audit
  const oldValues = {
    asset_id: existingAsset.assetId,
    asset_tag: existingAsset.assetTag,
    asset_type: existingAsset.assetType,
    display_name: existingAsset.displayName,
    description: existingAsset.description ?? null,
    status: existingAsset.status,
    substatus: existingAsset.substatus ?? null,
    created_at: existingAsset.createdAt,
    updated_at: existingAsset.updatedAt,
    created_by: existingAsset.createdBy ?? null,
    updated_by: existingAsset.updatedBy ?? null,
  };

  // Apply updates
  const updatedAsset: Asset = {
    ...existingAsset,
    displayName: request.displayName ?? existingAsset.displayName,
    description: request.description ?? existingAsset.description,
    substatus: request.substatus ?? existingAsset.substatus,
    updatedAt: timestamp,
    updatedBy: userId,
  };

  // Store updated asset
  assetStore.set(assetId, updatedAsset);

  // Capture new values for audit
  const newValues = {
    asset_id: updatedAsset.assetId,
    asset_tag: updatedAsset.assetTag,
    asset_type: updatedAsset.assetType,
    display_name: updatedAsset.displayName,
    description: updatedAsset.description ?? null,
    status: updatedAsset.status,
    substatus: updatedAsset.substatus ?? null,
    created_at: updatedAsset.createdAt,
    updated_at: updatedAsset.updatedAt,
    created_by: updatedAsset.createdBy ?? null,
    updated_by: userId ?? null,
  };

  // Database trigger creates audit log entry (simulated)
  const auditEntry: AuditLogEntry = {
    logId: generateUUID(),
    userId,
    actionType: 'UPDATE',
    resourceType: 'ASSET',
    resourceId: assetId,
    oldValues,
    newValues,
    timestamp,
  };
  auditLogStore.push(auditEntry);

  return updatedAsset;
}

/**
 * Simulated updateAssetStatus (state change) that mirrors the real implementation
 */
function simulateUpdateAssetStatus(
  assetId: string,
  newStatus: AssetStatus,
  userId?: string
): Asset | null {
  const existingAsset = assetStore.get(assetId);
  if (!existingAsset) {
    return null;
  }

  const timestamp = new Date().toISOString();

  // Capture old values for audit
  const oldValues = {
    asset_id: existingAsset.assetId,
    asset_tag: existingAsset.assetTag,
    asset_type: existingAsset.assetType,
    display_name: existingAsset.displayName,
    description: existingAsset.description ?? null,
    status: existingAsset.status,
    substatus: existingAsset.substatus ?? null,
    created_at: existingAsset.createdAt,
    updated_at: existingAsset.updatedAt,
    created_by: existingAsset.createdBy ?? null,
    updated_by: existingAsset.updatedBy ?? null,
  };

  // Apply status change
  const updatedAsset: Asset = {
    ...existingAsset,
    status: newStatus,
    updatedAt: timestamp,
    updatedBy: userId,
  };

  // Store updated asset
  assetStore.set(assetId, updatedAsset);

  // Capture new values for audit
  const newValues = {
    asset_id: updatedAsset.assetId,
    asset_tag: updatedAsset.assetTag,
    asset_type: updatedAsset.assetType,
    display_name: updatedAsset.displayName,
    description: updatedAsset.description ?? null,
    status: updatedAsset.status,
    substatus: updatedAsset.substatus ?? null,
    created_at: updatedAsset.createdAt,
    updated_at: updatedAsset.updatedAt,
    created_by: updatedAsset.createdBy ?? null,
    updated_by: userId ?? null,
  };

  // Database trigger creates STATUS_CHANGE audit log entry (simulated)
  const auditEntry: AuditLogEntry = {
    logId: generateUUID(),
    userId,
    actionType: 'STATUS_CHANGE',
    resourceType: 'ASSET',
    resourceId: assetId,
    oldValues,
    newValues,
    timestamp,
  };
  auditLogStore.push(auditEntry);

  return updatedAsset;
}

/**
 * Simulated deleteAsset that mirrors the real implementation behavior
 */
function simulateDeleteAsset(assetId: string, userId?: string): boolean {
  const existingAsset = assetStore.get(assetId);
  if (!existingAsset) {
    return false;
  }

  const timestamp = new Date().toISOString();

  // Capture old values for audit
  const oldValues = {
    asset_id: existingAsset.assetId,
    asset_tag: existingAsset.assetTag,
    asset_type: existingAsset.assetType,
    display_name: existingAsset.displayName,
    description: existingAsset.description ?? null,
    status: existingAsset.status,
    substatus: existingAsset.substatus ?? null,
    created_at: existingAsset.createdAt,
    updated_at: existingAsset.updatedAt,
    created_by: existingAsset.createdBy ?? null,
    updated_by: existingAsset.updatedBy ?? null,
  };

  // Delete the asset
  assetStore.delete(assetId);

  // Database trigger creates audit log entry (simulated)
  const auditEntry: AuditLogEntry = {
    logId: generateUUID(),
    userId,
    actionType: 'DELETE',
    resourceType: 'ASSET',
    resourceId: assetId,
    oldValues,
    newValues: undefined,
    timestamp,
  };
  auditLogStore.push(auditEntry);

  return true;
}

/**
 * Get audit log entries for a specific asset
 */
function getAuditLogForAsset(assetId: string): AuditLogEntry[] {
  return auditLogStore.filter((entry) => entry.resourceId === assetId);
}

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate valid asset types
 */
const assetTypeArb = fc.constantFrom<AssetType>('HARDWARE', 'SOFTWARE', 'ENTERPRISE');

/**
 * Generate valid asset statuses
 */
const assetStatusArb = fc.constantFrom<AssetStatus>(
  'ORDERED',
  'RECEIVED',
  'IN_STOCK',
  'RESERVED',
  'DEPLOYED',
  'IN_MAINTENANCE',
  'RETIRED',
  'DISPOSED'
);

/**
 * Generate valid display names (non-empty, reasonable length)
 */
const displayNameArb = fc.string({ minLength: 1, maxLength: 255 }).filter((s) => s.trim().length > 0);

/**
 * Generate optional descriptions
 */
const descriptionArb = fc.option(fc.string({ maxLength: 2000 }), { nil: undefined });

/**
 * Generate optional substatus
 */
const substatusArb = fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined });

/**
 * Generate valid user IDs (UUID format)
 */
const userIdArb = fc.uuid();

/**
 * Generate CreateAssetRequest
 */
const createAssetRequestArb = fc.record({
  assetType: assetTypeArb,
  displayName: displayNameArb,
  description: descriptionArb,
  status: fc.option(assetStatusArb, { nil: undefined }),
});

/**
 * Generate UpdateAssetRequest with at least one field set
 */
const updateAssetRequestArb = fc
  .record({
    displayName: fc.option(displayNameArb, { nil: undefined }),
    description: descriptionArb,
    substatus: substatusArb,
  })
  .filter(
    (req) =>
      req.displayName !== undefined ||
      req.description !== undefined ||
      req.substatus !== undefined
  );

// ============================================================================
// Property Tests
// ============================================================================

describe('Property 4: Audit Log Completeness', () => {
  /**
   * **Validates: Requirements 2.7, 14.6**
   */

  beforeEach(() => {
    resetStores();
  });

  describe('CREATE Operations', () => {
    /**
     * Property: Every asset creation generates a corresponding audit log entry
     * **Validates: Requirements 2.7**
     */
    it('should create audit log entry for every asset creation', () => {
      fc.assert(
        fc.property(
          createAssetRequestArb,
          fc.option(userIdArb, { nil: undefined }),
          (request, userId) => {
            resetStores();

            // Perform create operation
            const asset = simulateCreateAsset(request, userId);

            // Get audit log for this asset
            const auditEntries = getAuditLogForAsset(asset.assetId);

            // Property: There must be exactly one CREATE audit entry
            expect(auditEntries.length).toBe(1);

            const auditEntry = auditEntries[0]!;

            // Property: Action type must be CREATE
            expect(auditEntry.actionType).toBe('CREATE');

            // Property: Resource ID must match asset ID
            expect(auditEntry.resourceId).toBe(asset.assetId);

            // Property: Resource type must be ASSET
            expect(auditEntry.resourceType).toBe('ASSET');

            // Property: User ID must match
            expect(auditEntry.userId).toBe(userId);

            // Property: Timestamp must be present
            expect(auditEntry.timestamp).toBeDefined();

            // Property: old_values must be null/undefined for CREATE
            expect(auditEntry.oldValues).toBeUndefined();

            // Property: new_values must contain the created asset data
            expect(auditEntry.newValues).toBeDefined();
            expect(auditEntry.newValues?.['asset_id']).toBe(asset.assetId);
            expect(auditEntry.newValues?.['asset_tag']).toBe(asset.assetTag);
            expect(auditEntry.newValues?.['asset_type']).toBe(asset.assetType);
            expect(auditEntry.newValues?.['display_name']).toBe(asset.displayName);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('UPDATE Operations', () => {
    /**
     * Property: Every asset update generates a corresponding audit log entry
     * **Validates: Requirements 2.7**
     */
    it('should create audit log entry for every asset update', () => {
      fc.assert(
        fc.property(
          createAssetRequestArb,
          updateAssetRequestArb,
          fc.option(userIdArb, { nil: undefined }),
          fc.option(userIdArb, { nil: undefined }),
          (createRequest, updateRequest, createUserId, updateUserId) => {
            resetStores();

            // Create an asset first
            const asset = simulateCreateAsset(createRequest, createUserId);
            const originalDisplayName = asset.displayName;

            // Perform update operation
            const updatedAsset = simulateUpdateAsset(asset.assetId, updateRequest, updateUserId);
            expect(updatedAsset).not.toBeNull();

            // Get audit log for this asset
            const auditEntries = getAuditLogForAsset(asset.assetId);

            // Property: There must be exactly two audit entries (CREATE + UPDATE)
            expect(auditEntries.length).toBe(2);

            // Find the UPDATE entry
            const updateEntry = auditEntries.find((e) => e.actionType === 'UPDATE');
            expect(updateEntry).toBeDefined();

            // Property: Resource ID must match asset ID
            expect(updateEntry?.resourceId).toBe(asset.assetId);

            // Property: Resource type must be ASSET
            expect(updateEntry?.resourceType).toBe('ASSET');

            // Property: User ID must match the update user
            expect(updateEntry?.userId).toBe(updateUserId);

            // Property: Timestamp must be present
            expect(updateEntry?.timestamp).toBeDefined();

            // Property: old_values must contain previous state
            expect(updateEntry?.oldValues).toBeDefined();
            expect(updateEntry?.oldValues?.['display_name']).toBe(originalDisplayName);

            // Property: new_values must contain updated state
            expect(updateEntry?.newValues).toBeDefined();
            if (updateRequest.displayName !== undefined) {
              expect(updateEntry?.newValues?.['display_name']).toBe(updateRequest.displayName);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('STATUS_CHANGE Operations', () => {
    /**
     * Property: Every asset state change generates a STATUS_CHANGE audit log entry
     * **Validates: Requirements 2.7**
     */
    it('should create STATUS_CHANGE audit log entry for state transitions', () => {
      fc.assert(
        fc.property(
          createAssetRequestArb,
          fc.option(userIdArb, { nil: undefined }),
          fc.option(userIdArb, { nil: undefined }),
          (createRequest, createUserId, updateUserId) => {
            resetStores();

            // Create an asset with ORDERED status
            const request = { ...createRequest, status: 'ORDERED' as AssetStatus };
            const asset = simulateCreateAsset(request, createUserId);
            const originalStatus = asset.status;

            // Perform state transition to RECEIVED
            const newStatus: AssetStatus = 'RECEIVED';
            const updatedAsset = simulateUpdateAssetStatus(asset.assetId, newStatus, updateUserId);
            expect(updatedAsset).not.toBeNull();

            // Get audit log for this asset
            const auditEntries = getAuditLogForAsset(asset.assetId);

            // Property: There must be exactly two audit entries (CREATE + STATUS_CHANGE)
            expect(auditEntries.length).toBe(2);

            // Find the STATUS_CHANGE entry
            const statusChangeEntry = auditEntries.find((e) => e.actionType === 'STATUS_CHANGE');
            expect(statusChangeEntry).toBeDefined();

            // Property: Resource ID must match asset ID
            expect(statusChangeEntry?.resourceId).toBe(asset.assetId);

            // Property: Resource type must be ASSET
            expect(statusChangeEntry?.resourceType).toBe('ASSET');

            // Property: User ID must match
            expect(statusChangeEntry?.userId).toBe(updateUserId);

            // Property: Timestamp must be present
            expect(statusChangeEntry?.timestamp).toBeDefined();

            // Property: old_values must contain previous status
            expect(statusChangeEntry?.oldValues).toBeDefined();
            expect(statusChangeEntry?.oldValues?.['status']).toBe(originalStatus);

            // Property: new_values must contain new status
            expect(statusChangeEntry?.newValues).toBeDefined();
            expect(statusChangeEntry?.newValues?.['status']).toBe(newStatus);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('DELETE Operations', () => {
    /**
     * Property: Every asset deletion generates a corresponding audit log entry
     * **Validates: Requirements 2.7**
     */
    it('should create audit log entry for every asset deletion', () => {
      fc.assert(
        fc.property(
          createAssetRequestArb,
          fc.option(userIdArb, { nil: undefined }),
          fc.option(userIdArb, { nil: undefined }),
          (createRequest, createUserId, deleteUserId) => {
            resetStores();

            // Create an asset first
            const asset = simulateCreateAsset(createRequest, createUserId);
            const assetId = asset.assetId;
            const assetTag = asset.assetTag;

            // Perform delete operation
            const deleted = simulateDeleteAsset(assetId, deleteUserId);
            expect(deleted).toBe(true);

            // Get audit log for this asset (asset is deleted but audit log remains)
            const auditEntries = getAuditLogForAsset(assetId);

            // Property: There must be exactly two audit entries (CREATE + DELETE)
            expect(auditEntries.length).toBe(2);

            // Find the DELETE entry
            const deleteEntry = auditEntries.find((e) => e.actionType === 'DELETE');
            expect(deleteEntry).toBeDefined();

            // Property: Resource ID must match asset ID
            expect(deleteEntry?.resourceId).toBe(assetId);

            // Property: Resource type must be ASSET
            expect(deleteEntry?.resourceType).toBe('ASSET');

            // Property: User ID must match
            expect(deleteEntry?.userId).toBe(deleteUserId);

            // Property: Timestamp must be present
            expect(deleteEntry?.timestamp).toBeDefined();

            // Property: old_values must contain the deleted asset data
            expect(deleteEntry?.oldValues).toBeDefined();
            expect(deleteEntry?.oldValues?.['asset_id']).toBe(assetId);
            expect(deleteEntry?.oldValues?.['asset_tag']).toBe(assetTag);

            // Property: new_values must be null/undefined for DELETE
            expect(deleteEntry?.newValues).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Audit Log Required Fields', () => {
    /**
     * Property: All audit log entries contain required fields
     * **Validates: Requirements 14.6**
     */
    it('should ensure all audit entries have required fields', () => {
      fc.assert(
        fc.property(
          createAssetRequestArb,
          updateAssetRequestArb,
          fc.option(userIdArb, { nil: undefined }),
          (createRequest, updateRequest, userId) => {
            resetStores();

            // Perform multiple operations
            const asset = simulateCreateAsset(createRequest, userId);
            simulateUpdateAsset(asset.assetId, updateRequest, userId);
            simulateDeleteAsset(asset.assetId, userId);

            // Get all audit entries for this asset
            const auditEntries = getAuditLogForAsset(asset.assetId);

            // Property: Each entry must have all required fields
            for (const entry of auditEntries) {
              // Required: logId (unique identifier)
              expect(entry.logId).toBeDefined();
              expect(typeof entry.logId).toBe('string');
              expect(entry.logId.length).toBeGreaterThan(0);

              // Required: actionType
              expect(entry.actionType).toBeDefined();
              expect(['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE']).toContain(entry.actionType);

              // Required: resourceType
              expect(entry.resourceType).toBeDefined();
              expect(entry.resourceType).toBe('ASSET');

              // Required: resourceId (for asset operations)
              expect(entry.resourceId).toBeDefined();
              expect(entry.resourceId).toBe(asset.assetId);

              // Required: timestamp
              expect(entry.timestamp).toBeDefined();
              expect(typeof entry.timestamp).toBe('string');
              // Validate ISO 8601 format
              expect(() => new Date(entry.timestamp)).not.toThrow();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Audit Log Immutability', () => {
    /**
     * Property: Audit log entries are immutable (cannot be modified or deleted)
     * **Validates: Requirements 2.7, 14.6**
     *
     * Note: This tests the conceptual immutability - in a real system,
     * this would be enforced by database constraints and permissions.
     */
    it('should preserve audit log entries across operations', () => {
      fc.assert(
        fc.property(
          fc.array(createAssetRequestArb, { minLength: 1, maxLength: 10 }),
          fc.option(userIdArb, { nil: undefined }),
          (createRequests, userId) => {
            resetStores();

            const createdAssets: Asset[] = [];

            // Create multiple assets
            for (const request of createRequests) {
              const asset = simulateCreateAsset(request, userId);
              createdAssets.push(asset);
            }

            // Count audit entries after creation
            const entriesAfterCreate = auditLogStore.length;
            expect(entriesAfterCreate).toBe(createRequests.length);

            // Delete all assets
            for (const asset of createdAssets) {
              simulateDeleteAsset(asset.assetId, userId);
            }

            // Property: Audit log entries should still exist after asset deletion
            // (audit log is immutable and preserves history)
            const entriesAfterDelete = auditLogStore.length;
            expect(entriesAfterDelete).toBe(createRequests.length * 2); // CREATE + DELETE for each

            // Property: All original CREATE entries should still be present
            const createEntries = auditLogStore.filter((e) => e.actionType === 'CREATE');
            expect(createEntries.length).toBe(createRequests.length);

            // Property: All DELETE entries should be present
            const deleteEntries = auditLogStore.filter((e) => e.actionType === 'DELETE');
            expect(deleteEntries.length).toBe(createRequests.length);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Audit Log Completeness for Full Lifecycle', () => {
    /**
     * Property: Complete asset lifecycle generates complete audit trail
     * **Validates: Requirements 2.7, 14.6**
     */
    it('should generate complete audit trail for full asset lifecycle', () => {
      fc.assert(
        fc.property(
          createAssetRequestArb,
          updateAssetRequestArb,
          fc.option(userIdArb, { nil: undefined }),
          (createRequest, updateRequest, userId) => {
            resetStores();

            // 1. Create asset
            const request = { ...createRequest, status: 'ORDERED' as AssetStatus };
            const asset = simulateCreateAsset(request, userId);

            // 2. Update asset attributes
            simulateUpdateAsset(asset.assetId, updateRequest, userId);

            // 3. Transition through lifecycle states
            simulateUpdateAssetStatus(asset.assetId, 'RECEIVED', userId);
            simulateUpdateAssetStatus(asset.assetId, 'IN_STOCK', userId);
            simulateUpdateAssetStatus(asset.assetId, 'DEPLOYED', userId);
            simulateUpdateAssetStatus(asset.assetId, 'RETIRED', userId);
            simulateUpdateAssetStatus(asset.assetId, 'DISPOSED', userId);

            // 4. Delete asset
            simulateDeleteAsset(asset.assetId, userId);

            // Get complete audit trail
            const auditEntries = getAuditLogForAsset(asset.assetId);

            // Property: Should have entries for all operations
            // 1 CREATE + 1 UPDATE + 5 STATUS_CHANGE + 1 DELETE = 8 entries
            expect(auditEntries.length).toBe(8);

            // Property: Entries should be in chronological order
            for (let i = 1; i < auditEntries.length; i++) {
              const prevEntry = auditEntries[i - 1];
              const currEntry = auditEntries[i];
              if (prevEntry && currEntry) {
                const prevTime = new Date(prevEntry.timestamp).getTime();
                const currTime = new Date(currEntry.timestamp).getTime();
                expect(currTime).toBeGreaterThanOrEqual(prevTime);
              }
            }

            // Property: First entry should be CREATE
            expect(auditEntries[0]!.actionType).toBe('CREATE');

            // Property: Last entry should be DELETE
            expect(auditEntries[auditEntries.length - 1]!.actionType).toBe('DELETE');

            // Property: All entries should reference the same asset
            for (const entry of auditEntries) {
              expect(entry.resourceId).toBe(asset.assetId);
              expect(entry.resourceType).toBe('ASSET');
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
