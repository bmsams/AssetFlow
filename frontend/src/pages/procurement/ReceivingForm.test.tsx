import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ReceivingForm } from './ReceivingForm';
import { receivingApi } from '../../services/receiving-api';

vi.mock('../../services/receiving-api', () => ({
  receivingApi: {
    createFromPO: vi.fn(),
    get: vi.fn(),
    scanAsset: vi.fn(),
    complete: vi.fn(),
    cancel: vi.fn(),
    inspection: {
      get: vi.fn(),
      markForInspection: vi.fn(),
      recordResult: vi.fn(),
    },
  },
}));

vi.mock('../../services/procurement-api', () => ({
  procurementApi: {
    purchaseOrders: {
      get: vi.fn(),
    },
  },
}));

function renderReceivingForm(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/procurement/receiving" element={<ReceivingForm />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ReceivingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders receiving progress without NaN values', async () => {
    vi.mocked(receivingApi.createFromPO).mockResolvedValue({
      receivingRecord: {
        receivingId: 'recv-1',
        poId: 'po-1',
        poNumber: 'PO-123',
        vendorName: 'Acme Vendor',
        status: 'IN_PROGRESS',
        stockroomId: 'sr-1',
        stockroomName: 'Main Stockroom',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      lines: [
        {
          receivingLineId: 'line-1',
          receivingId: 'recv-1',
          lineNumber: 1,
          poLineId: 'po-line-1',
          productDescription: 'Widget A',
          expectedQuantity: 2,
          receivedQuantity: 0,
          pendingQuantity: 2,
          inspectionRequired: false,
        },
      ],
    } as any);

    renderReceivingForm('/procurement/receiving?poId=po-1');

    await screen.findByRole('heading', { name: 'Receive Items' });
    expect(screen.getByText('0 / 2 items')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
  });

  it('enables complete receiving after a serial is entered and scanned', async () => {
    const user = userEvent.setup();

    vi.mocked(receivingApi.createFromPO).mockResolvedValue({
      receivingRecord: {
        receivingId: 'recv-1',
        poId: 'po-1',
        poNumber: 'PO-123',
        vendorName: 'Acme Vendor',
        status: 'IN_PROGRESS',
        stockroomId: 'sr-1',
        stockroomName: 'Main Stockroom',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      lines: [
        {
          receivingLineId: 'line-1',
          receivingId: 'recv-1',
          lineNumber: 1,
          poLineId: 'po-line-1',
          productDescription: 'Widget A',
          expectedQuantity: 2,
          receivedQuantity: 0,
          pendingQuantity: 2,
          inspectionRequired: false,
        },
      ],
    } as any);

    vi.mocked(receivingApi.scanAsset).mockResolvedValue({
      asset: {
        assetId: 'asset-1',
        assetTag: 'AST-1',
        serialNumber: 'SN-001',
        createdAt: '2026-03-01T00:00:01.000Z',
      },
      receivingLine: {
        receivingLineId: 'line-1',
        receivingId: 'recv-1',
        lineNumber: 1,
        poLineId: 'po-line-1',
        productDescription: 'Widget A',
        expectedQuantity: 2,
        receivedQuantity: 1,
        pendingQuantity: 1,
        inspectionRequired: false,
      },
      receivingRecord: {
        receivingId: 'recv-1',
        poId: 'po-1',
        poNumber: 'PO-123',
        status: 'IN_PROGRESS',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:01.000Z',
      },
      isLineComplete: false,
      isReceivingComplete: false,
    } as any);

    renderReceivingForm('/procurement/receiving?poId=po-1');
    await screen.findByRole('heading', { name: 'Receive Items' });

    const completeButtonInitial = screen.getByRole('button', {
      name: 'Complete Receiving (0 items)',
    });
    expect(completeButtonInitial).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Single Entry' }));
    await user.type(
      screen.getByPlaceholderText('Enter or scan serial number...'),
      'SN-001'
    );
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(receivingApi.scanAsset).toHaveBeenCalledWith('recv-1', {
        receivingLineId: 'line-1',
        serialNumber: 'SN-001',
        condition: 'NEW',
      });
    });

    await waitFor(() => {
      const completeButton = screen.getByRole('button', {
        name: 'Complete Receiving (1 items)',
      });
      expect(completeButton).toBeEnabled();
    });
  });
});
