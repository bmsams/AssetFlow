import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageLayout } from '../../components/layout/PageLayout';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  listTransfers,
  createTransfer,
  approveTransfer,
  completeTransfer,
  type TransferOrder,
  type TransferOrderStatus,
  type TransferPriority,
} from '../../services/ham-api';
import { adminApi } from '../../services/admin-api';
import { assetApi } from '../../services/asset-api';
import { stockroomApi, type InventoryItem } from '../../services/stockroom-api';
import type { Building, Stockroom } from '../../types/admin';
import type { Asset } from '../../types/asset';
import styles from '../Page.module.css';

type StatusFilter =
  | 'all'
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'IN_TRANSIT'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ON_HOLD';

interface CreateFormState {
  fromBuildingId: string;
  fromStockroomId: string;
  toBuildingId: string;
  toStockroomId: string;
  itemKey: string;
  quantity: number;
  priority: TransferPriority;
  reason: string;
  notes: string;
}

interface TransferItemOption {
  key: string;
  label: string;
  kind: 'asset' | 'inventory';
  assetId?: string;
  assetTag?: string;
  productId?: string;
  productType?: string;
  productDescription?: string;
  quantityAvailable?: number;
}

const INITIAL_FORM: CreateFormState = {
  fromBuildingId: '',
  fromStockroomId: '',
  toBuildingId: '',
  toStockroomId: '',
  itemKey: '',
  quantity: 1,
  priority: 'NORMAL',
  reason: '',
  notes: '',
};

function formatTransferStatus(status: TransferOrderStatus): string {
  return status
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function getStockroomHints(stockroom: Stockroom): string[] {
  const raw = stockroom as unknown as Record<string, unknown>;
  const hints = [
    raw['buildingId'],
    raw['building'],
    raw['buildingCode'],
    raw['location'],
    raw['roomName'],
    raw['name'],
    stockroom.roomName,
    stockroom.name,
  ];

  return hints
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase());
}

function stockroomMatchesBuilding(stockroom: Stockroom, building: Building): boolean {
  const buildingTokens = [building.buildingId, building.buildingCode, building.name]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase());

  if (buildingTokens.length === 0) return true;

  const stockroomHints = getStockroomHints(stockroom);
  if (stockroomHints.length === 0) return false;

  return stockroomHints.some((hint) =>
    buildingTokens.some((token) => hint === token || hint.includes(token) || token.includes(hint))
  );
}

function filterStockroomsByBuilding(stockrooms: Stockroom[], buildingId: string, buildings: Building[]): Stockroom[] {
  if (!buildingId) return stockrooms;

  const building = buildings.find((item) => item.buildingId === buildingId);
  if (!building) return stockrooms;

  const matched = stockrooms.filter((stockroom) => stockroomMatchesBuilding(stockroom, building));

  // Fallback: if stockrooms do not expose building linkage in this environment,
  // keep workflow usable by returning all stockrooms.
  return matched.length > 0 ? matched : stockrooms;
}

function canApprove(status: TransferOrderStatus): boolean {
  return status === 'PENDING_APPROVAL';
}

function canComplete(status: TransferOrderStatus): boolean {
  return (
    status === 'APPROVED' ||
    status === 'IN_TRANSIT' ||
    status === 'PARTIALLY_RECEIVED' ||
    status === 'RECEIVED'
  );
}

function getTransferRouteLabel(transfer: TransferOrder): string {
  const from = transfer.fromBuildingName
    ? `${transfer.fromBuildingName} (${transfer.fromStockroomName ?? transfer.fromStockroomId})`
    : (transfer.fromStockroomName ?? transfer.fromStockroomId);

  const to = transfer.toBuildingName
    ? `${transfer.toBuildingName} (${transfer.toStockroomName ?? transfer.toStockroomId})`
    : (transfer.toStockroomName ?? transfer.toStockroomId);

  return `${from} -> ${to}`;
}

export function TransfersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingReference, setIsLoadingReference] = useState(false);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [transfers, setTransfers] = useState<TransferOrder[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [stockrooms, setStockrooms] = useState<Stockroom[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [form, setForm] = useState<CreateFormState>(INITIAL_FORM);

  const fromStockrooms = useMemo(
    () => filterStockroomsByBuilding(stockrooms, form.fromBuildingId, buildings),
    [stockrooms, form.fromBuildingId, buildings]
  );

  const toStockrooms = useMemo(
    () => filterStockroomsByBuilding(stockrooms, form.toBuildingId, buildings),
    [stockrooms, form.toBuildingId, buildings]
  );

  const transferItemOptions = useMemo<TransferItemOption[]>(() => {
    const inventoryOptions = inventoryItems
      .filter((item) => Boolean(item.productId))
      .map((item) => ({
        key: `inventory:${item.inventoryId}`,
        kind: 'inventory' as const,
        productId: item.productId,
        productType: item.productType,
        productDescription: item.productDescription,
        quantityAvailable: item.quantityAvailable,
        label: `${item.productDescription ?? item.productSku ?? item.productId} (Available: ${item.quantityAvailable})`,
      }));

    const assetOptions = assets.map((asset) => ({
      key: `asset:${asset.assetId}`,
      kind: 'asset' as const,
      assetId: asset.assetId,
      assetTag: asset.assetTag,
      label: `${asset.assetTag} - ${asset.displayName}`,
    }));

    return [...inventoryOptions, ...assetOptions];
  }, [inventoryItems, assets]);

  const selectedTransferItem = useMemo(
    () => transferItemOptions.find((item) => item.key === form.itemKey),
    [transferItemOptions, form.itemKey]
  );

  const fetchTransfers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const result = await listTransfers(status);
      setTransfers(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transfers. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  const loadReferenceData = useCallback(async () => {
    try {
      setIsLoadingReference(true);
      const [buildingResult, stockroomResult] = await Promise.all([
        adminApi.buildings.list({ isActive: true }, { pageSize: 500, sortBy: 'name', sortOrder: 'asc' }),
        adminApi.stockrooms.list({ isActive: true }, { pageSize: 500, sortBy: 'name', sortOrder: 'asc' }),
      ]);

      setBuildings(buildingResult.items);
      setStockrooms(stockroomResult.items);
    } catch {
      // Keep page usable even if one environment has partial admin data.
      setBuildings([]);
      setStockrooms([]);
    } finally {
      setIsLoadingReference(false);
    }
  }, []);

  const loadAssets = useCallback(async () => {
    try {
      setIsLoadingAssets(true);
      const filters: {
        type: 'HARDWARE';
        buildingId?: string;
        stockroomId?: string;
      } = {
        type: 'HARDWARE' as const,
        buildingId: form.fromBuildingId || undefined,
        stockroomId: form.fromStockroomId || undefined,
      };

      const response = await assetApi.list(filters, {
        page: 1,
        pageSize: 500,
        sortBy: 'displayName',
        sortOrder: 'asc',
      });

      setAssets(response.items);
    } catch {
      setAssets([]);
    } finally {
      setIsLoadingAssets(false);
    }
  }, [form.fromBuildingId, form.fromStockroomId]);

  const loadInventory = useCallback(async () => {
    if (!form.fromStockroomId) {
      setInventoryItems([]);
      return;
    }

    try {
      setIsLoadingInventory(true);
      const response = await stockroomApi.getInventory(form.fromStockroomId, { page: 1, limit: 500 });
      setInventoryItems(response.items);
    } catch {
      setInventoryItems([]);
    } finally {
      setIsLoadingInventory(false);
    }
  }, [form.fromStockroomId]);

  useEffect(() => {
    void loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    void fetchTransfers();
  }, [fetchTransfers]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    setForm((prev) => {
      const exists = transferItemOptions.some((item) => item.key === prev.itemKey);
      return exists ? prev : { ...prev, itemKey: '' };
    });
  }, [transferItemOptions]);

  const handleApprove = async (transferId: string) => {
    try {
      setError(null);
      setSuccessMessage(null);
      await approveTransfer(transferId);
      await fetchTransfers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve transfer. Please try again.');
    }
  };

  const handleComplete = async (transferId: string) => {
    try {
      setError(null);
      setSuccessMessage(null);
      await completeTransfer(transferId, { lineReceipts: [] });
      await fetchTransfers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete transfer. Please try again.';
      if (/lineReceipts/i.test(message)) {
        setError('Transfer completion requires line-level receiving details. This simplified page can approve and create transfers, but completion requires receiving details.');
      } else {
        setError(message);
      }
    }
  };

  const handleCreateTransfer = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.fromStockroomId || !form.toStockroomId) {
      setError('Select both source and destination stockrooms.');
      return;
    }

    if (form.fromStockroomId === form.toStockroomId) {
      setError('Source and destination stockrooms must be different.');
      return;
    }

    if (!form.itemKey) {
      setError('Select an asset or stock item to transfer.');
      return;
    }

    if (!selectedTransferItem) {
      setError('Selected transfer item is no longer available. Please choose it again.');
      return;
    }

    if (!Number.isFinite(form.quantity) || form.quantity <= 0 || !Number.isInteger(form.quantity)) {
      setError('Quantity must be a positive whole number.');
      return;
    }

    if (
      selectedTransferItem.kind === 'inventory' &&
      typeof selectedTransferItem.quantityAvailable === 'number' &&
      form.quantity > selectedTransferItem.quantityAvailable
    ) {
      setError('Quantity exceeds available stock in the source stockroom.');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      setSuccessMessage(null);

      const notes = form.notes.trim() || undefined;
      const line =
        selectedTransferItem.kind === 'inventory'
          ? {
            productId: selectedTransferItem.productId,
            productType: selectedTransferItem.productType,
            productDescription: selectedTransferItem.productDescription,
            quantity: form.quantity,
            notes,
          }
          : {
            assetId: selectedTransferItem.assetId,
            assetTag: selectedTransferItem.assetTag,
            quantity: form.quantity,
            notes,
          };

      await createTransfer({
        fromStockroomId: form.fromStockroomId,
        toStockroomId: form.toStockroomId,
        priority: form.priority,
        reason: form.reason.trim() || undefined,
        notes,
        lines: [line],
      });

      setSuccessMessage('Transfer request created successfully.');
      setForm((prev) => ({
        ...prev,
        itemKey: '',
        quantity: 1,
        reason: '',
        notes: '',
      }));
      await fetchTransfers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create transfer. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <PageLayout
      title="Transfers"
      description="Manage asset transfer orders between buildings and stockrooms"
      breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Transfers' }]}
      maxWidth="xl"
    >
      <div className={styles.pageContent}>
        <form
          onSubmit={handleCreateTransfer}
          style={{
            marginBottom: 'var(--spacing-4)',
            padding: 'var(--spacing-4)',
            border: '1px solid var(--color-border, #e5e7eb)',
            borderRadius: 'var(--radius-md, 8px)',
            display: 'grid',
            gap: 'var(--spacing-3)',
          }}
        >
          <strong>Create Transfer</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--spacing-3)' }}>
            <label>
              From Building
              <select
                value={form.fromBuildingId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    fromBuildingId: event.target.value,
                    fromStockroomId: '',
                    itemKey: '',
                  }))
                }
                disabled={isLoadingReference || isCreating}
                style={{ width: '100%' }}
              >
                <option value="">All / Unspecified</option>
                {buildings.map((building) => (
                  <option key={building.buildingId} value={building.buildingId}>
                    {building.buildingCode} - {building.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              From Stockroom
              <select
                value={form.fromStockroomId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    fromStockroomId: event.target.value,
                    itemKey: '',
                  }))
                }
                disabled={isLoadingReference || isCreating}
                style={{ width: '100%' }}
                required
              >
                <option value="">Select source stockroom</option>
                {fromStockrooms.map((stockroom) => (
                  <option key={stockroom.stockroomId} value={stockroom.stockroomId}>
                    {(stockroom.stockroomCode ?? stockroom.stockroomId)} - {stockroom.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              To Building
              <select
                value={form.toBuildingId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    toBuildingId: event.target.value,
                    toStockroomId: '',
                  }))
                }
                disabled={isLoadingReference || isCreating}
                style={{ width: '100%' }}
              >
                <option value="">All / Unspecified</option>
                {buildings.map((building) => (
                  <option key={building.buildingId} value={building.buildingId}>
                    {building.buildingCode} - {building.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              To Stockroom
              <select
                value={form.toStockroomId}
                onChange={(event) => setForm((prev) => ({ ...prev, toStockroomId: event.target.value }))}
                disabled={isLoadingReference || isCreating}
                style={{ width: '100%' }}
                required
              >
                <option value="">Select destination stockroom</option>
                {toStockrooms.map((stockroom) => (
                  <option key={stockroom.stockroomId} value={stockroom.stockroomId}>
                    {(stockroom.stockroomCode ?? stockroom.stockroomId)} - {stockroom.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Asset / Stock Item
              <select
                value={form.itemKey}
                onChange={(event) => setForm((prev) => ({ ...prev, itemKey: event.target.value }))}
                disabled={isLoadingAssets || isLoadingInventory || isCreating}
                style={{ width: '100%' }}
                required
              >
                <option value="">
                  {(isLoadingAssets || isLoadingInventory) ? 'Loading items...' : 'Select asset or stock item'}
                </option>
                {transferItemOptions.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.kind === 'inventory' ? `[Inventory] ${item.label}` : `[Asset] ${item.label}`}
                  </option>
                ))}
              </select>
              {!isLoadingAssets && !isLoadingInventory && transferItemOptions.length === 0 && (
                <small style={{ display: 'block', marginTop: '4px' }}>
                  No transferable items found for the selected source stockroom.
                </small>
              )}
            </label>

            <label>
              Quantity
              <input
                type="number"
                min={1}
                step={1}
                value={form.quantity}
                onChange={(event) => setForm((prev) => ({ ...prev, quantity: Number(event.target.value) || 0 }))}
                disabled={isCreating}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              Priority
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, priority: event.target.value as TransferPriority }))
                }
                disabled={isCreating}
                style={{ width: '100%' }}
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </label>
          </div>

          <label>
            Reason
            <input
              type="text"
              value={form.reason}
              onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
              disabled={isCreating}
              style={{ width: '100%' }}
              placeholder="Reason for transfer"
            />
          </label>

          <label>
            Notes
            <textarea
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              disabled={isCreating}
              style={{ width: '100%' }}
              rows={3}
              placeholder="Optional transfer notes"
            />
          </label>

          <div>
            <button
              type="submit"
              disabled={isCreating || isLoadingReference || isLoadingAssets || isLoadingInventory}
            >
              {isCreating ? 'Creating...' : 'Create Transfer'}
            </button>
          </div>
        </form>

        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <label htmlFor="status-filter" style={{ marginRight: 'var(--spacing-2)' }}>
            Status:
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="all">All</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="PARTIALLY_RECEIVED">Partially Received</option>
            <option value="RECEIVED">Received</option>
            <option value="COMPLETED">Completed</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        {successMessage && (
          <div
            role="status"
            style={{
              marginBottom: 'var(--spacing-4)',
              padding: 'var(--spacing-3)',
              border: '1px solid var(--color-success, #16a34a)',
              borderRadius: 'var(--radius-md, 8px)',
              background: 'var(--color-success-bg, #f0fdf4)',
            }}
          >
            {successMessage}
          </div>
        )}

        {error && (
          <ErrorMessage
            title="Error"
            message={error}
            type="error"
            variant="inline"
            recoveryOptions={[{ label: 'Retry', action: fetchTransfers }]}
          />
        )}

        {isLoading && (
          <div aria-live="polite" aria-busy="true">
            <p>Loading transfers...</p>
          </div>
        )}

        {!isLoading && !error && transfers.length === 0 && (
          <EmptyState
            title="No transfers found"
            description="No transfer orders match the current filter."
          />
        )}

        {!isLoading && !error && transfers.length > 0 && (
          <table className={styles.dataTable || ''} role="table" aria-label="Transfer orders">
            <thead>
              <tr>
                <th scope="col">Transfer</th>
                <th scope="col">Route</th>
                <th scope="col">Status</th>
                <th scope="col">Requested</th>
                <th scope="col">Qty</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer) => {
                const requestedDate = transfer.requestedDate ?? transfer.requestedAt;
                return (
                  <tr key={transfer.transferId}>
                    <td>{transfer.transferNumber ?? transfer.transferId}</td>
                    <td>{getTransferRouteLabel(transfer)}</td>
                    <td>{formatTransferStatus(transfer.status)}</td>
                    <td>{requestedDate ? new Date(requestedDate).toLocaleDateString() : '-'}</td>
                    <td>{transfer.totalQuantity ?? '-'}</td>
                    <td>
                      {canApprove(transfer.status) && (
                        <button onClick={() => handleApprove(transfer.transferId)}>Approve</button>
                      )}
                      {canComplete(transfer.status) && (
                        <button onClick={() => handleComplete(transfer.transferId)}>Complete</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </PageLayout>
  );
}
