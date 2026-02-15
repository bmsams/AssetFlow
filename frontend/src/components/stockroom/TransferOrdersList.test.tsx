import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransferOrdersList } from './TransferOrdersList';
import type { TransferOrder } from '../../types/stockroom';

const mockTransferOrders: TransferOrder[] = [
  {
    transferId: 'transfer-001',
    transferNumber: 'TRF-2025-0001',
    fromStockroomId: 'stockroom-001',
    fromStockroomName: 'Main IT Stockroom',
    toStockroomId: 'stockroom-003',
    toStockroomName: 'Network Equipment Room',
    status: 'IN_TRANSIT',
    requestedBy: 'Mike Chen',
    requestedDate: '2025-01-24T10:30:00Z',
    approvedBy: 'John Smith',
    approvedDate: '2025-01-24T14:00:00Z',
    itemCount: 15,
    totalValue: 45000,
    expectedDeliveryDate: '2025-01-28T00:00:00Z',
    notes: 'Network upgrade equipment',
  },
  {
    transferId: 'transfer-002',
    transferNumber: 'TRF-2025-0002',
    fromStockroomId: 'stockroom-002',
    fromStockroomName: 'Data Center Receiving',
    toStockroomId: 'stockroom-001',
    toStockroomName: 'Main IT Stockroom',
    status: 'PENDING_APPROVAL',
    requestedBy: 'Sarah Johnson',
    requestedDate: '2025-01-26T09:15:00Z',
    itemCount: 8,
    totalValue: 28500,
    notes: 'Excess inventory redistribution',
  },
];

describe('TransferOrdersList', () => {
  it('renders the title', () => {
    render(<TransferOrdersList transferOrders={mockTransferOrders} />);
    expect(screen.getByText('Transfer Orders')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<TransferOrdersList transferOrders={mockTransferOrders} title="My Transfers" />);
    expect(screen.getByText('My Transfers')).toBeInTheDocument();
  });

  it('displays active count badge', () => {
    render(<TransferOrdersList transferOrders={mockTransferOrders} />);
    expect(screen.getByText('2 active')).toBeInTheDocument();
  });

  it('renders transfer order items', () => {
    render(<TransferOrdersList transferOrders={mockTransferOrders} />);
    expect(screen.getByText('TRF-2025-0001')).toBeInTheDocument();
    expect(screen.getByText('TRF-2025-0002')).toBeInTheDocument();
  });

  it('displays transfer routes', () => {
    render(<TransferOrdersList transferOrders={mockTransferOrders} />);
    // Main IT Stockroom appears in both transfers (as from and to)
    const mainStockroomElements = screen.getAllByText('Main IT Stockroom');
    expect(mainStockroomElements.length).toBeGreaterThan(0);
    expect(screen.getByText('Network Equipment Room')).toBeInTheDocument();
  });

  it('displays status badges', () => {
    render(<TransferOrdersList transferOrders={mockTransferOrders} />);
    expect(screen.getByText('In Transit')).toBeInTheDocument();
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
  });

  it('displays item counts', () => {
    render(<TransferOrdersList transferOrders={mockTransferOrders} />);
    expect(screen.getByText('15 items')).toBeInTheDocument();
    expect(screen.getByText('8 items')).toBeInTheDocument();
  });

  it('displays formatted values', () => {
    render(<TransferOrdersList transferOrders={mockTransferOrders} />);
    expect(screen.getByText('$45,000')).toBeInTheDocument();
    expect(screen.getByText('$28,500')).toBeInTheDocument();
  });

  it('displays requester names', () => {
    render(<TransferOrdersList transferOrders={mockTransferOrders} />);
    expect(screen.getByText('Requested by Mike Chen')).toBeInTheDocument();
    expect(screen.getByText('Requested by Sarah Johnson')).toBeInTheDocument();
  });

  it('displays notes when present', () => {
    render(<TransferOrdersList transferOrders={mockTransferOrders} />);
    expect(screen.getByText('Network upgrade equipment')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<TransferOrdersList transferOrders={[]} isLoading />);
    expect(screen.getByRole('generic', { busy: true })).toBeInTheDocument();
  });

  it('shows empty state when no transfers', () => {
    render(<TransferOrdersList transferOrders={[]} />);
    expect(screen.getByText('No transfer orders')).toBeInTheDocument();
  });

  it('calls onTransferClick when item is clicked', () => {
    const handleClick = vi.fn();
    render(<TransferOrdersList transferOrders={mockTransferOrders} onTransferClick={handleClick} />);
    
    const firstItem = screen.getByLabelText(/View transfer order TRF-2025-0001/);
    fireEvent.click(firstItem);
    
    expect(handleClick).toHaveBeenCalledWith(mockTransferOrders[0]);
  });

  it('shows approve button for pending transfers', () => {
    const handleApprove = vi.fn();
    render(<TransferOrdersList transferOrders={mockTransferOrders} onApprove={handleApprove} />);
    
    const approveButton = screen.getByLabelText('Approve transfer TRF-2025-0002');
    expect(approveButton).toBeInTheDocument();
  });

  it('calls onApprove when approve button is clicked', () => {
    const handleApprove = vi.fn();
    render(<TransferOrdersList transferOrders={mockTransferOrders} onApprove={handleApprove} />);
    
    const approveButton = screen.getByLabelText('Approve transfer TRF-2025-0002');
    fireEvent.click(approveButton);
    
    expect(handleApprove).toHaveBeenCalledWith(mockTransferOrders[1]);
  });

  it('limits displayed items based on maxItems', () => {
    const manyTransfers = Array.from({ length: 10 }, (_, i) => ({
      ...mockTransferOrders[0],
      transferId: `transfer-${i}`,
      transferNumber: `TRF-2025-000${i}`,
    }));
    
    render(
      <TransferOrdersList 
        transferOrders={manyTransfers} 
        maxItems={3} 
        onViewAll={() => {}} 
      />
    );
    
    expect(screen.getByText('View all 10 transfers')).toBeInTheDocument();
  });

  it('calls onViewAll when view all button is clicked', () => {
    const handleViewAll = vi.fn();
    const manyTransfers = Array.from({ length: 10 }, (_, i) => ({
      ...mockTransferOrders[0],
      transferId: `transfer-${i}`,
      transferNumber: `TRF-2025-000${i}`,
    }));
    
    render(
      <TransferOrdersList 
        transferOrders={manyTransfers} 
        maxItems={3} 
        onViewAll={handleViewAll} 
      />
    );
    
    fireEvent.click(screen.getByText('View all 10 transfers'));
    expect(handleViewAll).toHaveBeenCalled();
  });

  it('has accessible item labels', () => {
    render(<TransferOrdersList transferOrders={mockTransferOrders} />);
    expect(screen.getByLabelText('View transfer order TRF-2025-0001')).toBeInTheDocument();
  });
});

describe('TransferOrdersList - Requirements Validation', () => {
  /**
   * Validates Requirement 12.4: Show transfer orders and status
   */
  it('shows transfer orders and status (Requirement 12.4)', () => {
    render(<TransferOrdersList transferOrders={mockTransferOrders} />);
    
    // Verify transfer orders are displayed
    expect(screen.getByText('TRF-2025-0001')).toBeInTheDocument();
    expect(screen.getByText('TRF-2025-0002')).toBeInTheDocument();
    
    // Verify status is shown
    expect(screen.getByText('In Transit')).toBeInTheDocument();
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
  });

  /**
   * Validates Requirement 12.4: Transfer route information
   */
  it('displays transfer route information (Requirement 12.4)', () => {
    render(<TransferOrdersList transferOrders={mockTransferOrders} />);
    
    // Verify from/to stockrooms are shown (Main IT Stockroom appears multiple times)
    const mainStockroomElements = screen.getAllByText('Main IT Stockroom');
    expect(mainStockroomElements.length).toBeGreaterThan(0);
    expect(screen.getByText('Network Equipment Room')).toBeInTheDocument();
  });

  /**
   * Validates Requirement 12.4: Transfer approval interface
   */
  it('provides transfer approval interface (Requirement 12.4)', () => {
    const handleApprove = vi.fn();
    render(<TransferOrdersList transferOrders={mockTransferOrders} onApprove={handleApprove} />);
    
    // Verify approve button exists for pending transfers
    const approveButton = screen.getByText('Approve Transfer');
    expect(approveButton).toBeInTheDocument();
    
    // Verify it works
    fireEvent.click(approveButton);
    expect(handleApprove).toHaveBeenCalled();
  });
});
