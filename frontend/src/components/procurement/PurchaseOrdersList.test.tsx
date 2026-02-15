import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PurchaseOrdersList } from './PurchaseOrdersList';
import type { PurchaseOrder } from '../../types/procurement';

const mockPurchaseOrders: PurchaseOrder[] = [
  {
    poId: 'po-001',
    poNumber: 'PO-2025-0001',
    vendorName: 'Dell Technologies',
    vendorId: 'vendor-001',
    status: 'ORDERED',
    orderDate: '2025-01-20T00:00:00Z',
    expectedDeliveryDate: '2025-02-01T00:00:00Z',
    totalAmount: 45000,
    lineItemCount: 15,
    requesterName: 'IT Procurement',
    approverName: 'Jane Wilson',
    approvedDate: '2025-01-19T00:00:00Z',
    receivedCount: 5,
    totalCount: 15,
  },
  {
    poId: 'po-002',
    poNumber: 'PO-2025-0002',
    vendorName: 'CDW Corporation',
    vendorId: 'vendor-002',
    status: 'PARTIALLY_RECEIVED',
    orderDate: '2025-01-15T00:00:00Z',
    expectedDeliveryDate: '2025-01-28T00:00:00Z',
    totalAmount: 28500,
    lineItemCount: 8,
    requesterName: 'IT Procurement',
    approverName: 'Jane Wilson',
    approvedDate: '2025-01-14T00:00:00Z',
    receivedCount: 5,
    totalCount: 8,
  },
];

describe('PurchaseOrdersList', () => {
  it('renders the title', () => {
    render(<PurchaseOrdersList purchaseOrders={mockPurchaseOrders} />);
    expect(screen.getByText('Purchase Orders')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<PurchaseOrdersList purchaseOrders={mockPurchaseOrders} title="My Orders" />);
    expect(screen.getByText('My Orders')).toBeInTheDocument();
  });

  it('displays order count badge', () => {
    render(<PurchaseOrdersList purchaseOrders={mockPurchaseOrders} />);
    expect(screen.getByText('2 orders')).toBeInTheDocument();
  });

  it('renders purchase order items', () => {
    render(<PurchaseOrdersList purchaseOrders={mockPurchaseOrders} />);
    expect(screen.getByText('PO-2025-0001')).toBeInTheDocument();
    expect(screen.getByText('Dell Technologies')).toBeInTheDocument();
    expect(screen.getByText('PO-2025-0002')).toBeInTheDocument();
    expect(screen.getByText('CDW Corporation')).toBeInTheDocument();
  });

  it('displays formatted amounts', () => {
    render(<PurchaseOrdersList purchaseOrders={mockPurchaseOrders} />);
    expect(screen.getByText('$45,000')).toBeInTheDocument();
    expect(screen.getByText('$28,500')).toBeInTheDocument();
  });

  it('displays line item counts', () => {
    render(<PurchaseOrdersList purchaseOrders={mockPurchaseOrders} />);
    expect(screen.getByText('15 items')).toBeInTheDocument();
    expect(screen.getByText('8 items')).toBeInTheDocument();
  });

  it('displays status badges', () => {
    render(<PurchaseOrdersList purchaseOrders={mockPurchaseOrders} />);
    expect(screen.getByText('Ordered')).toBeInTheDocument();
    expect(screen.getByText('Partially Received')).toBeInTheDocument();
  });

  it('shows progress bar for partially received items', () => {
    render(<PurchaseOrdersList purchaseOrders={mockPurchaseOrders} />);
    // Check for progress text - only shown for PARTIALLY_RECEIVED status
    expect(screen.getByText(/5\/8 received/)).toBeInTheDocument();
    // Progress bar should exist
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<PurchaseOrdersList purchaseOrders={[]} isLoading />);
    expect(screen.getByRole('generic', { busy: true })).toBeInTheDocument();
  });

  it('shows empty state when no orders', () => {
    render(<PurchaseOrdersList purchaseOrders={[]} />);
    expect(screen.getByText('No purchase orders')).toBeInTheDocument();
  });

  it('calls onPurchaseOrderClick when item is clicked', () => {
    const handleClick = vi.fn();
    render(
      <PurchaseOrdersList 
        purchaseOrders={mockPurchaseOrders} 
        onPurchaseOrderClick={handleClick} 
      />
    );
    
    const firstItem = screen.getByLabelText(/View purchase order PO-2025-0001/);
    fireEvent.click(firstItem);
    
    expect(handleClick).toHaveBeenCalledWith(mockPurchaseOrders[0]);
  });

  it('limits displayed items based on maxItems', () => {
    const manyOrders = Array.from({ length: 10 }, (_, i) => ({
      ...mockPurchaseOrders[0],
      poId: `po-${i}`,
      poNumber: `PO-2025-000${i}`,
    }));
    
    render(
      <PurchaseOrdersList 
        purchaseOrders={manyOrders} 
        maxItems={3} 
        onViewAll={() => {}} 
      />
    );
    
    expect(screen.getByText('View all 10 orders')).toBeInTheDocument();
  });

  it('calls onViewAll when view all button is clicked', () => {
    const handleViewAll = vi.fn();
    const manyOrders = Array.from({ length: 10 }, (_, i) => ({
      ...mockPurchaseOrders[0],
      poId: `po-${i}`,
      poNumber: `PO-2025-000${i}`,
    }));
    
    render(
      <PurchaseOrdersList 
        purchaseOrders={manyOrders} 
        maxItems={3} 
        onViewAll={handleViewAll} 
      />
    );
    
    fireEvent.click(screen.getByText('View all 10 orders'));
    expect(handleViewAll).toHaveBeenCalled();
  });

  it('has accessible item labels', () => {
    render(<PurchaseOrdersList purchaseOrders={mockPurchaseOrders} />);
    expect(
      screen.getByLabelText('View purchase order PO-2025-0001 from Dell Technologies')
    ).toBeInTheDocument();
  });
});

describe('PurchaseOrdersList - Requirements Validation', () => {
  /**
   * Validates Requirement 12.3: Display purchase orders
   */
  it('displays purchase orders (Requirement 12.3)', () => {
    render(<PurchaseOrdersList purchaseOrders={mockPurchaseOrders} />);
    
    // Verify purchase orders are displayed with key information
    expect(screen.getByText('PO-2025-0001')).toBeInTheDocument();
    expect(screen.getByText('Dell Technologies')).toBeInTheDocument();
    expect(screen.getByText('$45,000')).toBeInTheDocument();
    expect(screen.getByText('Ordered')).toBeInTheDocument();
  });

  /**
   * Validates Requirement 12.3: Show receiving progress
   */
  it('shows receiving progress for orders (Requirement 12.3)', () => {
    render(<PurchaseOrdersList purchaseOrders={mockPurchaseOrders} />);
    
    // Verify progress is shown for PARTIALLY_RECEIVED status
    expect(screen.getByText(/5\/8 received/)).toBeInTheDocument();
    
    // Verify progress bars exist
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBeGreaterThan(0);
  });
});
