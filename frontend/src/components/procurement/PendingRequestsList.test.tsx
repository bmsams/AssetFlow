import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PendingRequestsList } from './PendingRequestsList';
import type { AssetRequest } from '../../types/procurement';

const mockRequests: AssetRequest[] = [
  {
    requestId: 'req-001',
    requestNumber: 'REQ-2025-0001',
    requesterName: 'John Smith',
    requesterEmail: 'john.smith@company.com',
    requesterDepartment: 'Engineering',
    itemName: 'MacBook Pro 16"',
    itemCategory: 'Laptop',
    quantity: 1,
    unitPrice: 3499,
    totalPrice: 3499,
    justification: 'New hire equipment',
    status: 'PENDING_APPROVAL',
    priority: 'HIGH',
    requestedDate: '2025-01-25T10:30:00Z',
    deliveryLocation: 'Building A',
  },
  {
    requestId: 'req-002',
    requestNumber: 'REQ-2025-0002',
    requesterName: 'Sarah Johnson',
    requesterEmail: 'sarah.johnson@company.com',
    requesterDepartment: 'Marketing',
    itemName: 'Dell Monitor',
    itemCategory: 'Monitor',
    quantity: 2,
    unitPrice: 899,
    totalPrice: 1798,
    justification: 'Dual monitor setup',
    status: 'PENDING_APPROVAL',
    priority: 'MEDIUM',
    requestedDate: '2025-01-24T14:15:00Z',
    deliveryLocation: 'Building B',
  },
];

describe('PendingRequestsList', () => {
  it('renders the title', () => {
    render(<PendingRequestsList requests={mockRequests} />);
    expect(screen.getByText('Pending Requests')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<PendingRequestsList requests={mockRequests} title="My Requests" />);
    expect(screen.getByText('My Requests')).toBeInTheDocument();
  });

  it('displays pending count badge', () => {
    render(<PendingRequestsList requests={mockRequests} />);
    expect(screen.getByText('2 pending')).toBeInTheDocument();
  });

  it('renders request items', () => {
    render(<PendingRequestsList requests={mockRequests} />);
    expect(screen.getByText('REQ-2025-0001')).toBeInTheDocument();
    expect(screen.getByText('MacBook Pro 16"')).toBeInTheDocument();
    expect(screen.getByText('REQ-2025-0002')).toBeInTheDocument();
    expect(screen.getByText('Dell Monitor')).toBeInTheDocument();
  });

  it('displays requester information', () => {
    render(<PendingRequestsList requests={mockRequests} />);
    expect(screen.getByText(/John Smith/)).toBeInTheDocument();
    expect(screen.getByText(/Engineering/)).toBeInTheDocument();
  });

  it('displays priority badges', () => {
    render(<PendingRequestsList requests={mockRequests} />);
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('MEDIUM')).toBeInTheDocument();
  });

  it('displays formatted prices', () => {
    render(<PendingRequestsList requests={mockRequests} />);
    expect(screen.getByText('$3,499')).toBeInTheDocument();
    expect(screen.getByText('$1,798')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<PendingRequestsList requests={[]} isLoading />);
    expect(screen.getByRole('generic', { busy: true })).toBeInTheDocument();
  });

  it('shows empty state when no requests', () => {
    render(<PendingRequestsList requests={[]} />);
    expect(screen.getByText('No pending requests')).toBeInTheDocument();
  });

  it('calls onRequestClick when item is clicked', () => {
    const handleClick = vi.fn();
    render(<PendingRequestsList requests={mockRequests} onRequestClick={handleClick} />);
    
    const firstItem = screen.getByLabelText(/View request REQ-2025-0001/);
    fireEvent.click(firstItem);
    
    expect(handleClick).toHaveBeenCalledWith(mockRequests[0]);
  });

  it('calls onApprove when approve button is clicked', () => {
    const handleApprove = vi.fn();
    render(<PendingRequestsList requests={mockRequests} onApprove={handleApprove} />);
    
    const approveButtons = screen.getAllByText('Approve');
    fireEvent.click(approveButtons[0]);
    
    expect(handleApprove).toHaveBeenCalledWith(mockRequests[0]);
  });

  it('calls onReject when reject button is clicked', () => {
    const handleReject = vi.fn();
    render(<PendingRequestsList requests={mockRequests} onReject={handleReject} />);
    
    const rejectButtons = screen.getAllByText('Reject');
    fireEvent.click(rejectButtons[0]);
    
    expect(handleReject).toHaveBeenCalledWith(mockRequests[0]);
  });

  it('limits displayed items based on maxItems', () => {
    const manyRequests = Array.from({ length: 10 }, (_, i) => ({
      ...mockRequests[0],
      requestId: `req-${i}`,
      requestNumber: `REQ-2025-000${i}`,
    }));
    
    render(
      <PendingRequestsList 
        requests={manyRequests} 
        maxItems={3} 
        onViewAll={() => {}} 
      />
    );
    
    // Should show view all button
    expect(screen.getByText('View all 10 requests')).toBeInTheDocument();
  });

  it('calls onViewAll when view all button is clicked', () => {
    const handleViewAll = vi.fn();
    const manyRequests = Array.from({ length: 10 }, (_, i) => ({
      ...mockRequests[0],
      requestId: `req-${i}`,
      requestNumber: `REQ-2025-000${i}`,
    }));
    
    render(
      <PendingRequestsList 
        requests={manyRequests} 
        maxItems={3} 
        onViewAll={handleViewAll} 
      />
    );
    
    fireEvent.click(screen.getByText('View all 10 requests'));
    expect(handleViewAll).toHaveBeenCalled();
  });

  it('has accessible approve button labels', () => {
    render(<PendingRequestsList requests={mockRequests} />);
    expect(screen.getByLabelText('Approve request REQ-2025-0001')).toBeInTheDocument();
  });

  it('has accessible reject button labels', () => {
    render(<PendingRequestsList requests={mockRequests} />);
    expect(screen.getByLabelText('Reject request REQ-2025-0001')).toBeInTheDocument();
  });
});

describe('PendingRequestsList - Requirements Validation', () => {
  /**
   * Validates Requirement 12.3: Display pending requests
   */
  it('displays pending requests (Requirement 12.3)', () => {
    render(<PendingRequestsList requests={mockRequests} />);
    
    // Verify requests are displayed
    expect(screen.getByText('REQ-2025-0001')).toBeInTheDocument();
    expect(screen.getByText('MacBook Pro 16"')).toBeInTheDocument();
    expect(screen.getByText('$3,499')).toBeInTheDocument();
  });

  /**
   * Validates Requirement 12.3: Implement request approval interface
   */
  it('provides approval interface (Requirement 12.3)', () => {
    const handleApprove = vi.fn();
    const handleReject = vi.fn();
    
    render(
      <PendingRequestsList 
        requests={mockRequests} 
        onApprove={handleApprove}
        onReject={handleReject}
      />
    );
    
    // Verify approve/reject buttons exist
    const approveButtons = screen.getAllByText('Approve');
    const rejectButtons = screen.getAllByText('Reject');
    
    expect(approveButtons.length).toBe(2);
    expect(rejectButtons.length).toBe(2);
    
    // Verify they work
    fireEvent.click(approveButtons[0]);
    expect(handleApprove).toHaveBeenCalled();
    
    fireEvent.click(rejectButtons[0]);
    expect(handleReject).toHaveBeenCalled();
  });
});
