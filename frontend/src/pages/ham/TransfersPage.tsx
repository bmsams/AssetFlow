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
  type TransferOrderLine,
  type TransferOrderStatus,
  type TransferPriority,
  type CompleteTransferLineReceipt,
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

interface CompletionLineState {
  lineId: string;
  lineNumber?: number;
  itemLabel: string;
  expectedQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
  conditionReceived: '' | 'NEW' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED' | 'UNKNOWN';
  conditionNotes: string;
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

function getExplicitStockroomBuildingIds(
  stockroom: Stockroom,
  roomToBuildingId: ReadonlyMap<string, string>
): string[] {
  const raw = stockroom as unknown as Record<string, unknown>;
  const rawIds = [
    raw['buildingId'],
    raw['building_id'],
    raw['buildingID'],
  ];

  const explicitIds = rawIds
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());

  if (explicitIds.length > 0) {
    return explicitIds;
  }

  if (stockroom.roomId && roomToBuildingId.has(stockroom.roomId)) {
    const mappedBuildingId = roomToBuildingId.get(stockroom.roomId);
    return mappedBuildingId ? [mappedBuildingId] : [];
  }

  return [];
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

function filterStockroomsByBuilding(
  stockrooms: Stockroom[],
  buildingId: string,
  buildings: Building[],
  roomToBuildingId: ReadonlyMap<string, string>
): Stockroom[] {
  if (!buildingId) return stockrooms;

  const building = buildings.find((item) => item.buildingId === buildingId);
  if (!building) return stockrooms;

  const explicitMatches = stockrooms.filter((stockroom) => {
    const explicitIds = getExplicitStockroomBuildingIds(stockroom, roomToBuildingId);
    return explicitIds.includes(buildingId);
  });

  const heuristicFallbackMatches = stockrooms.filter((stockroom) => {
    const explicitIds = getExplicitStockroomBuildingIds(stockroom, roomToBuildingId);
    if (explicitIds.length > 0) {
      return false;
    }
    return stockroomMatchesBuilding(stockroom, building);
  });

  const matchedById = new Set<string>();
  const matched = [...explicitMatches, ...heuristicFallbackMatches].filter((stockroom) => {
    if (matchedById.has(stockroom.stockroomId)) {
      return false;
    }
    matchedById.add(stockroom.stockroomId);
    return true;
  });

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

function getLineExpectedQuantity(line: TransferOrderLine): number {
  if (typeof line.shippedQuantity === 'number' && line.shippedQuantity > 0) {
    return line.shippedQuantity;
  }
  if (typeof line.quantity === 'number' && line.quantity > 0) {
    return line.quantity;
  }
  return 0;
}

function getTransferLineLabel(line: TransferOrderLine): string {
  if (line.productDescription && line.productDescription.trim().length > 0) {
    return line.productDescription;
  }
  if (line.productType && line.productType.trim().length > 0) {
    return line.productType;
  }
  if (line.assetId && line.assetId.trim().length > 0) {
    return `Asset ${line.assetId}`;
  }
  return `Line ${line.lineNumber ?? line.lineId}`;
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
  const [roomToBuildingId, setRoomToBuildingId] = useState<ReadonlyMap<string, string>>(new Map());
  const [assets, setAssets] = useState<Asset[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [form, setForm] = useState<CreateFormState>(INITIAL_FORM);
  const [activeCompletionTransfer, setActiveCompletionTransfer] = useState<TransferOrder | null>(null);
  const [completionLines, setCompletionLines] = useState<CompletionLineState[]>([]);
  const [completionNotes, setCompletionNotes] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);

  const fromStockrooms = useMemo(
    () => filterStockroomsByBuilding(stockrooms, form.fromBuildingId, buildings, roomToBuildingId),
    [stockrooms, form.fromBuildingId, buildings, roomToBuildingId]
  );

  const toStockrooms = useMemo(
    () => filterStockroomsByBuilding(stockrooms, form.toBuildingId, buildings, roomToBuildingId),
    [stockrooms, form.toBuildingId, buildings, roomToBuildingId]
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
      const [buildingResult, stockroomResult, floorResult, roomResult] = await Promise.all([
        adminApi.buildings.list({ isActive: true }, { pageSize: 500, sortBy: 'name', sortOrder: 'asc' }),
        adminApi.stockrooms.list({ isActive: true }, { pageSize: 500, sortBy: 'name', sortOrder: 'asc' }),
        adminApi.floors.list(undefined, { isActive: true }, { pageSize: 500, sortBy: 'floorNumber', sortOrder: 'asc' }),
        adminApi.rooms.list(undefined, { isActive: true }, { pageSize: 500, sortBy: 'roomNumber', sortOrder: 'asc' }),
      ]);

      setBuildings(buildingResult.items);
      setStockrooms(stockroomResult.items);

      const floorBuildingByFloorId = new Map<string, string>();
      for (const floor of floorResult.items) {
        floorBuildingByFloorId.set(floor.floorId, floor.buildingId);
      }

      const roomBuildingMap = new Map<string, string>();
      for (const room of roomResult.items) {
        const buildingId = floorBuildingByFloorId.get(room.floorId);
        if (buildingId) {
          roomBuildingMap.set(room.roomId, buildingId);
        }
      }
      setRoomToBuildingId(roomBuildingMap);
    } catch {
      // Keep page usable even if one environment has partial admin data.
      setBuildings([]);
      setStockrooms([]);
      setRoomToBuildingId(new Map());
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

  const openCompleteDialog = (transfer: TransferOrder) => {
    const transferLines = Array.isArray(transfer.lines) ? transfer.lines : [];
    if (transferLines.length === 0) {
      setError('Transfer completion requires line details, but no transfer lines were returned by the API.');
      return;
    }

    const initialLines = transferLines.map((line) => {
      const expectedQuantity = getLineExpectedQuantity(line);
      return {
        lineId: line.lineId,
        lineNumber: line.lineNumber,
        itemLabel: getTransferLineLabel(line),
        expectedQuantity,
        receivedQuantity: expectedQuantity,
        damagedQuantity: 0,
        conditionReceived: '',
        conditionNotes: '',
      } as CompletionLineState;
    });

    setError(null);
    setSuccessMessage(null);
    setActiveCompletionTransfer(transfer);
    setCompletionLines(initialLines);
    setCompletionNotes('');
  };

  const closeCompleteDialog = () => {
    if (isCompleting) {
      return;
    }
    setActiveCompletionTransfer(null);
    setCompletionLines([]);
    setCompletionNotes('');
  };

  const updateCompletionLine = (
    lineId: string,
    updater: (line: CompletionLineState) => CompletionLineState
  ) => {
    setCompletionLines((prev) => prev.map((line) => (line.lineId === lineId ? updater(line) : line)));
  };

  const submitCompletion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeCompletionTransfer) {
      return;
    }

    for (const line of completionLines) {
      if (!Number.isInteger(line.receivedQuantity) || line.receivedQuantity < 0) {
        setError(`Received quantity for line ${line.lineNumber ?? line.lineId} must be a whole number >= 0.`);
        return;
      }
      if (!Number.isInteger(line.damagedQuantity) || line.damagedQuantity < 0) {
        setError(`Damaged quantity for line ${line.lineNumber ?? line.lineId} must be a whole number >= 0.`);
        return;
      }
      if (line.damagedQuantity > line.receivedQuantity) {
        setError(`Damaged quantity cannot exceed received quantity for line ${line.lineNumber ?? line.lineId}.`);
        return;
      }
    }

    try {
      setIsCompleting(true);
      setError(null);
      setSuccessMessage(null);
      const lineReceipts: CompleteTransferLineReceipt[] = completionLines.map((line) => ({
        lineId: line.lineId,
        receivedQuantity: line.receivedQuantity,
        damagedQuantity: line.damagedQuantity,
        conditionReceived: line.conditionReceived || undefined,
        conditionNotes: line.conditionNotes.trim() || undefined,
      }));

      await completeTransfer(activeCompletionTransfer.transferId, {
        receivingNotes: completionNotes.trim() || undefined,
        lineReceipts,
      });

      closeCompleteDialog();
      setSuccessMessage('Transfer completed successfully.');
      await fetchTransfers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete transfer. Please try again.');
    } finally {
      setIsCompleting(false);
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
                        <button onClick={() => openCompleteDialog(transfer)}>Complete</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {activeCompletionTransfer && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Complete transfer"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--spacing-4)',
              zIndex: 20,
            }}
          >
            <form
              onSubmit={submitCompletion}
              style={{
                background: 'var(--color-surface, #ffffff)',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--color-border, #e5e7eb)',
                maxWidth: '920px',
                width: '100%',
                maxHeight: '85vh',
                overflow: 'auto',
                padding: 'var(--spacing-4)',
                display: 'grid',
                gap: 'var(--spacing-3)',
              }}
            >
              <h2 style={{ margin: 0 }}>
                Complete Transfer {activeCompletionTransfer.transferNumber ?? activeCompletionTransfer.transferId}
              </h2>
              <p style={{ margin: 0 }}>
                Provide line-level receiving details before completing this transfer.
              </p>

              <table className={styles.dataTable || ''} role="table" aria-label="Transfer completion lines">
                <thead>
                  <tr>
                    <th scope="col">Line</th>
                    <th scope="col">Expected</th>
                    <th scope="col">Received</th>
                    <th scope="col">Damaged</th>
                    <th scope="col">Condition</th>
                    <th scope="col">Condition Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {completionLines.map((line) => (
                    <tr key={line.lineId}>
                      <td>{line.itemLabel}</td>
                      <td>{line.expectedQuantity}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={line.receivedQuantity}
                          onChange={(event) =>
                            updateCompletionLine(line.lineId, (current) => ({
                              ...current,
                              receivedQuantity: Number(event.target.value) || 0,
                            }))
                          }
                          style={{ width: '92px' }}
                          disabled={isCompleting}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={line.damagedQuantity}
                          onChange={(event) =>
                            updateCompletionLine(line.lineId, (current) => ({
                              ...current,
                              damagedQuantity: Number(event.target.value) || 0,
                            }))
                          }
                          style={{ width: '92px' }}
                          disabled={isCompleting}
                        />
                      </td>
                      <td>
                        <select
                          value={line.conditionReceived}
                          onChange={(event) =>
                            updateCompletionLine(line.lineId, (current) => ({
                              ...current,
                              conditionReceived: event.target.value as CompletionLineState['conditionReceived'],
                            }))
                          }
                          disabled={isCompleting}
                        >
                          <option value="">Unspecified</option>
                          <option value="NEW">New</option>
                          <option value="EXCELLENT">Excellent</option>
                          <option value="GOOD">Good</option>
                          <option value="FAIR">Fair</option>
                          <option value="POOR">Poor</option>
                          <option value="DAMAGED">Damaged</option>
                          <option value="UNKNOWN">Unknown</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={line.conditionNotes}
                          onChange={(event) =>
                            updateCompletionLine(line.lineId, (current) => ({
                              ...current,
                              conditionNotes: event.target.value,
                            }))
                          }
                          style={{ width: '100%' }}
                          placeholder="Optional notes"
                          disabled={isCompleting}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <label>
                Receiving Notes
                <textarea
                  value={completionNotes}
                  onChange={(event) => setCompletionNotes(event.target.value)}
                  style={{ width: '100%' }}
                  rows={3}
                  placeholder="Optional receiving notes"
                  disabled={isCompleting}
                />
              </label>

              <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeCompleteDialog} disabled={isCompleting}>
                  Cancel
                </button>
                <button type="submit" disabled={isCompleting}>
                  {isCompleting ? 'Completing...' : 'Complete Transfer'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
