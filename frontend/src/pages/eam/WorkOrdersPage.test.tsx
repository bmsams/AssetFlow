import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { WorkOrdersPage } from './WorkOrdersPage';
import type { WorkOrder } from '../../services/eam-api';
import type { Building } from '../../types/admin';
import type { Asset } from '../../types/asset';

const {
  listWorkOrdersMock,
  createWorkOrderMock,
  assignWorkOrderMock,
  completeWorkOrderMock,
  listBuildingsMock,
  listAssetsMock,
} = vi.hoisted(() => ({
  listWorkOrdersMock: vi.fn(),
  createWorkOrderMock: vi.fn(),
  assignWorkOrderMock: vi.fn(),
  completeWorkOrderMock: vi.fn(),
  listBuildingsMock: vi.fn(),
  listAssetsMock: vi.fn(),
}));

vi.mock('../../services/eam-api', () => ({
  listWorkOrders: listWorkOrdersMock,
  createWorkOrder: createWorkOrderMock,
  assignWorkOrder: assignWorkOrderMock,
  completeWorkOrder: completeWorkOrderMock,
}));

vi.mock('../../services/admin-api', () => ({
  adminApi: {
    buildings: {
      list: listBuildingsMock,
    },
  },
}));

vi.mock('../../services/asset-api', () => ({
  assetApi: {
    list: listAssetsMock,
  },
}));

const buildingFixture: Building = {
  buildingId: 'bldg-1',
  buildingCode: 'HQ-1',
  name: 'Headquarters',
  addressLine1: null,
  addressLine2: null,
  city: null,
  stateProvince: null,
  postalCode: null,
  country: 'USA',
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  totalFloors: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const assetFixture: Asset = {
  assetId: 'asset-1',
  assetTag: 'AST-0001',
  assetType: 'HARDWARE',
  displayName: 'Boiler Pump Controller',
  status: 'DEPLOYED',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const createdWorkOrderFixture: WorkOrder = {
  workOrderId: 'wo-1',
  assetId: 'asset-1',
  assetTag: 'AST-0001',
  title: 'Inspect controller',
  description: '',
  priority: 'medium',
  status: 'open',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <WorkOrdersPage />
    </MemoryRouter>
  );
}

describe('WorkOrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    listWorkOrdersMock.mockResolvedValue([]);
    createWorkOrderMock.mockResolvedValue(createdWorkOrderFixture);
    assignWorkOrderMock.mockResolvedValue(createdWorkOrderFixture);
    completeWorkOrderMock.mockResolvedValue(createdWorkOrderFixture);

    listBuildingsMock.mockResolvedValue({
      items: [buildingFixture],
      total: 1,
      page: 1,
      pageSize: 200,
      totalPages: 1,
    });

    listAssetsMock.mockResolvedValue({
      items: [assetFixture],
      total: 1,
      page: 1,
      pageSize: 200,
      totalPages: 1,
    });
  });

  it('loads building-scoped assets when a building is selected', async () => {
    renderPage();

    const buildingFilter = await screen.findByLabelText('Building:');
    fireEvent.change(buildingFilter, { target: { value: buildingFixture.buildingId } });

    await waitFor(() => {
      expect(listAssetsMock).toHaveBeenCalledWith(
        { type: 'HARDWARE', buildingId: buildingFixture.buildingId },
        { page: 1, pageSize: 200, sortBy: 'displayName', sortOrder: 'asc' }
      );
    });

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: `${assetFixture.assetTag} - ${assetFixture.displayName}` })
      ).toBeInTheDocument();
    });
  });

  it('enforces create flow gating until building + asset + title are set', async () => {
    renderPage();

    const createButton = screen.getByRole('button', { name: 'Create Work Order' });
    expect(createButton).toBeDisabled();

    fireEvent.change(await screen.findByLabelText('Building:'), {
      target: { value: buildingFixture.buildingId },
    });

    await waitFor(() => {
      expect(listAssetsMock).toHaveBeenCalled();
    });

    expect(createButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Inspect controller' },
    });

    await waitFor(() => {
      expect(createButton).not.toBeDisabled();
    });
  });

  it('creates a work order using the selected building-scoped asset', async () => {
    renderPage();

    fireEvent.change(await screen.findByLabelText('Building:'), {
      target: { value: buildingFixture.buildingId },
    });

    await waitFor(() => {
      expect(listAssetsMock).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Inspect controller' },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Routine inspection before planned shutdown' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Work Order' }));

    await waitFor(() => {
      expect(createWorkOrderMock).toHaveBeenCalledWith({
        assetId: assetFixture.assetId,
        buildingId: buildingFixture.buildingId,
        workType: 'corrective',
        title: 'Inspect controller',
        description: 'Routine inspection before planned shutdown',
        priority: 'medium',
        estimatedHours: undefined,
      });
    });

    await waitFor(() => {
      expect(listWorkOrdersMock).toHaveBeenCalledWith(
        expect.objectContaining({ buildingId: buildingFixture.buildingId })
      );
    });

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('');
  });
});
