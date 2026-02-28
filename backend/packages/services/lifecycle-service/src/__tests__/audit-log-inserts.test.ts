/**
 * Audit log INSERT regression tests.
 *
 * These validate that repository code writes to `audit_log` using the expected
 * column names (resource_type/resource_id/action_type/user_id/new_values).
 */

// Mock deps before importing repositories.
jest.mock('@ams/database', () => {
  const ctx = {
    queryOne: jest.fn(),
    queryMany: jest.fn(),
  };

  return {
    __ctx: ctx,
    queryOne: jest.fn(),
    queryMany: jest.fn(),
    withTransaction: jest.fn(async (fn: (tx: typeof ctx) => unknown) => fn(ctx)),
  };
});

jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  now: () => '2024-01-15T10:00:00.000Z',
}));

import { createDeployment } from '../deployment/deployment-repository';
import { createWorkflow, createDestructionCertificate } from '../retirement/retirement-repository';
import { withTransaction } from '@ams/database';

const db = jest.requireMock('@ams/database') as {
  __ctx: { queryOne: jest.Mock; queryMany: jest.Mock };
};

const VALID_ASSET_ID = '123e4567-e89b-12d3-a456-426614174001';
const VALID_USER_ID = '123e4567-e89b-12d3-a456-426614174002';
const VALID_ACTOR_ID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_WORKFLOW_ID = '123e4567-e89b-12d3-a456-426614174010';

function findInsertCall(): { sql: string; params: unknown[] } {
  const calls = db.__ctx.queryOne.mock.calls as unknown[][];
  for (const call of calls) {
    const sql = String(call[0] ?? '');
    const params = (call[1] ?? []) as unknown[];
    if (sql.includes('INSERT INTO audit_log')) return { sql, params };
  }
  throw new Error('Expected an INSERT INTO audit_log call');
}

describe('Audit Log INSERT Statements', () => {
  beforeEach(() => {
    db.__ctx.queryOne.mockReset();
    db.__ctx.queryMany.mockReset();
    (withTransaction as unknown as jest.Mock).mockClear();
  });

  it('createDeployment writes to audit_log with correct columns', async () => {
    db.__ctx.queryOne
      // asset row
      .mockResolvedValueOnce({
        asset_id: VALID_ASSET_ID,
        asset_tag: 'AST-ABC123',
        display_name: 'MacBook Pro',
        status: 'IN_STOCK',
      })
      // user row
      .mockResolvedValueOnce({
        user_id: VALID_USER_ID,
        display_name: 'John Doe',
        email: 'john.doe@example.com',
      })
      // INSERT deployment_records row
      .mockResolvedValueOnce({
        deployment_id: '123e4567-e89b-12d3-a456-426614174099',
        asset_id: VALID_ASSET_ID,
        asset_tag: 'AST-ABC123',
        asset_name: 'MacBook Pro',
        assigned_to_user_id: VALID_USER_ID,
        assigned_to_user_name: 'John Doe',
        assigned_to_user_email: 'john.doe@example.com',
        deployed_by: VALID_ACTOR_ID,
        deployed_by_name: 'Admin',
        deployment_date: '2024-01-15T10:00:00.000Z',
        status: 'COMPLETED',
        location: 'Building A',
        department: 'Engineering',
        cost_center: 'CC-1001',
        notes: null,
        discovery_correlation_id: null,
        discovery_source: null,
        discovery_correlated_at: null,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
      })
      // UPDATE assets
      .mockResolvedValueOnce(null)
      // UPDATE hardware_assets
      .mockResolvedValueOnce(null)
      // INSERT audit_log
      .mockResolvedValueOnce(null);

    await createDeployment({
      assetId: VALID_ASSET_ID,
      assignedToUserId: VALID_USER_ID,
      deployedBy: VALID_ACTOR_ID,
      deployedByName: 'Admin',
      location: 'Building A',
      department: 'Engineering',
      costCenter: 'CC-1001',
      notes: undefined,
    });

    const { sql, params } = findInsertCall();
    expect(sql).toContain('INSERT INTO audit_log');
    expect(sql).toContain('user_id, action_type, resource_type, resource_id, new_values');
    expect(sql).toContain("'STATUS_CHANGE'");
    expect(sql).toContain("'ASSET'");
    expect(params[0]).toBe(VALID_ACTOR_ID); // user_id
    expect(params[1]).toBe(VALID_ASSET_ID); // resource_id
  });

  it('createWorkflow writes to audit_log with correct columns', async () => {
    db.__ctx.queryOne
      // asset row
      .mockResolvedValueOnce({
        asset_id: VALID_ASSET_ID,
        asset_tag: 'AST-ABC123',
        display_name: 'MacBook Pro',
        status: 'DEPLOYED',
      })
      // INSERT retirement_workflows row
      .mockResolvedValueOnce({
        workflow_id: VALID_WORKFLOW_ID,
        workflow_number: 'RET-000001',
        asset_id: VALID_ASSET_ID,
        asset_tag: 'AST-ABC123',
        asset_name: 'MacBook Pro',
        status: 'DATA_WIPE_PENDING',
        retirement_reason: 'END_OF_LIFE',
        disposal_method: 'RECYCLED',
        initiated_by: VALID_ACTOR_ID,
        initiated_at: '2024-01-15T10:00:00.000Z',
        approved_by: null,
        approved_at: null,
        data_wipe_required: true,
        data_wipe_completed_at: null,
        data_wipe_verified_by: null,
        disposal_completed_at: null,
        disposal_completed_by: null,
        destruction_certificate_id: null,
        notes: null,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
      })
      // UPDATE assets
      .mockResolvedValueOnce(null)
      // UPDATE hardware_assets
      .mockResolvedValueOnce(null)
      // INSERT audit_log
      .mockResolvedValueOnce(null);

    await createWorkflow({
      assetId: VALID_ASSET_ID,
      retirementReason: 'END_OF_LIFE',
      disposalMethod: 'RECYCLED',
      initiatedBy: VALID_ACTOR_ID,
      dataWipeRequired: true,
      notes: undefined,
    });

    const { sql, params } = findInsertCall();
    expect(sql).toContain('INSERT INTO audit_log');
    expect(sql).toContain('user_id, action_type, resource_type, resource_id, new_values');
    expect(sql).toContain("'STATUS_CHANGE'");
    expect(params[0]).toBe(VALID_ACTOR_ID); // user_id
    expect(params[1]).toBe(VALID_ASSET_ID); // resource_id
  });

  it('createDestructionCertificate writes to audit_log with correct columns', async () => {
    db.__ctx.queryOne
      // INSERT destruction_certificates row
      .mockResolvedValueOnce({
        certificate_id: '123e4567-e89b-12d3-a456-426614174500',
        certificate_number: 'DC-000001',
        asset_id: VALID_ASSET_ID,
        workflow_id: VALID_WORKFLOW_ID,
        vendor_id: null,
        vendor_name: null,
        destruction_date: '2024-01-15T10:00:00.000Z',
        destruction_method: 'RECYCLED',
        serial_number: null,
        asset_tag: null,
        document_url: null,
        verified_by: null,
        verified_at: null,
        notes: null,
        created_at: '2024-01-15T10:00:00.000Z',
        created_by: VALID_ACTOR_ID,
      })
      // UPDATE assets
      .mockResolvedValueOnce(null)
      // UPDATE hardware_assets
      .mockResolvedValueOnce(null)
      // INSERT audit_log
      .mockResolvedValueOnce(null);

    await createDestructionCertificate(
      VALID_WORKFLOW_ID,
      VALID_ASSET_ID,
      {
        vendorId: undefined,
        vendorName: undefined,
        destructionDate: '2024-01-15T10:00:00.000Z',
        destructionMethod: 'RECYCLED',
        serialNumber: undefined,
        assetTag: undefined,
        documentUrl: undefined,
        verifiedBy: VALID_ACTOR_ID,
        notes: undefined,
      },
      VALID_ACTOR_ID
    );

    const { sql, params } = findInsertCall();
    expect(sql).toContain('INSERT INTO audit_log');
    expect(sql).toContain('user_id, action_type, resource_type, resource_id, new_values');
    expect(sql).toContain("'STATUS_CHANGE'");
    expect(params[0]).toBe(VALID_ACTOR_ID); // user_id
    expect(params[1]).toBe(VALID_ASSET_ID); // resource_id
  });
});
