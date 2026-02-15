import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReceivingQueue } from './ReceivingQueue';
import type { ReceivingItem } from '../../types/procurement';

const mockReceivingItems: ReceivingItem[] = [
  {
    receivingId: 'recv-001',
    poNumber: 'PO-2025-0001',
    poId: 'po-001',
    vendorName: 'Dell Technologies',
    itemDescription: 'Dell PowerEdge R750 Server',
    expectedQuantity: 2,
    receivedQuantity: 0,
    status: 'PENDING',
    expectedDate: '2025-02-01T00:00:00Z',
    trackingNumber: '1Z999AA10123456784',
    stockroomName: 'Main IT Stockroom',
    stockroomId: 'stockroom-001',
  },
  {
    receivingId: 'recv-002',
    poNumber: 'PO-2025-0002',
    poId: 'po-002',
    vendorName: 'CDW Corporation',
    itemDescription: 'HP LaserJet Printers (6 units)',
    expectedQuantity: 6,
    receivedQuantity: 2,
    status: 'IN_PROGRESS',
    expectedDate: '2025-01-30T00:00:00Z',
    stockroomName: 'Main IT Stockroom',
    stockroomId: 'stockroom-001',
    notes: 'Partial shipment received',
  },
  {
    receivingId: 'recv-003',
    poNumber: 'PO-2025-0003',
    poId: 'po-003',
    vendorName: 'Apple Inc.',
    itemDescription: 'MacBook Pro Laptops',
    expectedQuantity: 5,
    receivedQuantity: 5,
    status: 'COMPLETED',
    expectedDate: '2025-01-25T00:00:00Z',
    stockroomName: 'IT Equipment Room',
    stockroomId: 'stockroom-002',
  },
];

describe('ReceivingQueue', () => {
  it('renders the title', () => {
    render(<ReceivingQueue items={mockReceivingItems} />);
    expect(screen.getByText('Receiving Queue')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<ReceivingQueue items={mockReceivingItems} title="My Queue" />);
    expect(screen.getByText('My Queue')).toBeInTheDocument();
  });

  it('displays awaiting count badge', () => {
    render(<ReceivingQueue items={mockReceivingItems} />);
    // 2 items are PENDING or IN_PROGRESS
    expect(screen.getByText('2 awaiting')).toBeInTheDocument();
  });

  it('renders receiving items', () => {
    render(<ReceivingQueue items={mockReceivingItems} />);
    expect(screen.getByText('PO-2025-0001')).toBeInTheDocument();
    expect(screen.getByText('Dell PowerEdge R750 Server')).toBeInTheDocument();
    expect(screen.getByText('PO-2025-0002')).toBeInTheDocument();
    expect(screen.getByText('HP LaserJet Printers (6 units)')).toBeInTheDocument();
  });

  it('displays vendor names', () => {
    render(<ReceivingQueue items={mockReceivingItems} />);
    expect(screen.getByText('Dell Technologies')).toBeInTheDocument();
    expect(screen.getByText('CDW Corporation')).toBeInTheDocument();
  });

  it('displays quantity information', () => {
    render(<ReceivingQueue items={mockReceivingItems} />);
    expect(screen.getByText('0/2 received')).toBeInTheDocument();
    expect(screen.getByText('2/6 received')).toBeInTheDocument();
  });

  it('displays status badges', () => {
    render(<ReceivingQueue items={mockReceivingItems} />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('displays stockroom names', () => {
    render(<ReceivingQueue items={mockReceivingItems} />);
    expect(screen.getAllByText('Main IT Stockroom').length).toBeGreaterThan(0);
  });

  it('displays tracking numbers when available', () => {
    render(<ReceivingQueue items={mockReceivingItems} />);
    expect(screen.getByText('1Z999AA10123456784')).toBeInTheDocument();
  });

  it('displays notes when available', () => {
    render(<ReceivingQueue items={mockReceivingItems} />);
    expect(screen.getByText('Partial shipment received')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<ReceivingQueue items={[]} isLoading />);
    expect(screen.getByRole('generic', { busy: true })).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(<ReceivingQueue items={[]} />);
    expect(screen.getByText('No items in receiving queue')).toBeInTheDocument();
  });

  it('calls onItemClick when item is clicked', () => {
    const handleClick = vi.fn();
    render(<ReceivingQueue items={mockReceivingItems} onItemClick={handleClick} />);
    
    const firstItem = screen.getByLabelText(/View receiving item from Dell Technologies/);
    fireEvent.click(firstItem);
    
    expect(handleClick).toHaveBeenCalledWith(mockReceivingItems[0]);
  });

  it('shows receive button for pending items', () => {
    render(<ReceivingQueue items={mockReceivingItems} />);
    const receiveButtons = screen.getAllByText('Receive');
    // Should have receive buttons for PENDING and IN_PROGRESS items
    expect(receiveButtons.length).toBe(2);
  });

  it('shows report issue button for pending items', () => {
    render(<ReceivingQueue items={mockReceivingItems} />);
    const issueButtons = screen.getAllByText('Report Issue');
    expect(issueButtons.length).toBe(2);
  });

  it('calls onReceive when receive button is clicked', () => {
    const handleReceive = vi.fn();
    render(<ReceivingQueue items={mockReceivingItems} onReceive={handleReceive} />);
    
    const receiveButtons = screen.getAllByText('Receive');
    fireEvent.click(receiveButtons[0]);
    
    expect(handleReceive).toHaveBeenCalledWith(mockReceivingItems[0]);
  });

  it('calls onReportIssue when report issue button is clicked', () => {
    const handleReportIssue = vi.fn();
    render(<ReceivingQueue items={mockReceivingItems} onReportIssue={handleReportIssue} />);
    
    const issueButtons = screen.getAllByText('Report Issue');
    fireEvent.click(issueButtons[0]);
    
    expect(handleReportIssue).toHaveBeenCalledWith(mockReceivingItems[0]);
  });

  it('limits displayed items based on maxItems', () => {
    const manyItems = Array.from({ length: 10 }, (_, i) => ({
      ...mockReceivingItems[0],
      receivingId: `recv-${i}`,
      poNumber: `PO-2025-000${i}`,
    }));
    
    render(
      <ReceivingQueue 
        items={manyItems} 
        maxItems={3} 
        onViewAll={() => {}} 
      />
    );
    
    expect(screen.getByText('View all 10 items')).toBeInTheDocument();
  });

  it('calls onViewAll when view all button is clicked', () => {
    const handleViewAll = vi.fn();
    const manyItems = Array.from({ length: 10 }, (_, i) => ({
      ...mockReceivingItems[0],
      receivingId: `recv-${i}`,
      poNumber: `PO-2025-000${i}`,
    }));
    
    render(
      <ReceivingQueue 
        items={manyItems} 
        maxItems={3} 
        onViewAll={handleViewAll} 
      />
    );
    
    fireEvent.click(screen.getByText('View all 10 items'));
    expect(handleViewAll).toHaveBeenCalled();
  });

  it('has accessible receive button labels', () => {
    render(<ReceivingQueue items={mockReceivingItems} />);
    expect(screen.getByLabelText('Receive items for PO-2025-0001')).toBeInTheDocument();
  });

  it('has accessible report issue button labels', () => {
    render(<ReceivingQueue items={mockReceivingItems} />);
    expect(screen.getByLabelText('Report issue for PO-2025-0001')).toBeInTheDocument();
  });
});

describe('ReceivingQueue - Requirements Validation', () => {
  /**
   * Validates Requirement 12.3: Show receiving queue
   */
  it('shows receiving queue (Requirement 12.3)', () => {
    render(<ReceivingQueue items={mockReceivingItems} />);
    
    // Verify receiving items are displayed
    expect(screen.getByText('Dell PowerEdge R750 Server')).toBeInTheDocument();
    expect(screen.getByText('HP LaserJet Printers (6 units)')).toBeInTheDocument();
    expect(screen.getByText('0/2 received')).toBeInTheDocument();
  });

  /**
   * Validates Requirement 12.3: Show receiving queue with actions
   */
  it('provides receiving actions (Requirement 12.3)', () => {
    const handleReceive = vi.fn();
    const handleReportIssue = vi.fn();
    
    render(
      <ReceivingQueue 
        items={mockReceivingItems} 
        onReceive={handleReceive}
        onReportIssue={handleReportIssue}
      />
    );
    
    // Verify action buttons exist for pending items
    const receiveButtons = screen.getAllByText('Receive');
    const issueButtons = screen.getAllByText('Report Issue');
    
    expect(receiveButtons.length).toBe(2);
    expect(issueButtons.length).toBe(2);
    
    // Verify they work
    fireEvent.click(receiveButtons[0]);
    expect(handleReceive).toHaveBeenCalled();
    
    fireEvent.click(issueButtons[0]);
    expect(handleReportIssue).toHaveBeenCalled();
  });
});
