import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssetHistory } from './AssetHistory';
import { mockHardwareAssetDetail } from './mockData';

describe('AssetHistory', () => {
  const mockHistory = mockHardwareAssetDetail.auditHistory;

  it('renders audit history header with count', () => {
    render(<AssetHistory history={mockHistory} />);
    expect(screen.getByText('Audit History')).toBeInTheDocument();
    expect(screen.getByText(`(${mockHistory.length})`)).toBeInTheDocument();
  });

  it('renders empty state when no history', () => {
    render(<AssetHistory history={[]} />);
    expect(screen.getByText('No history available')).toBeInTheDocument();
    expect(screen.getByText('Changes to this asset will appear here')).toBeInTheDocument();
  });

  it('renders timeline with audit entries', () => {
    render(<AssetHistory history={mockHistory} />);
    
    // Should render as an ordered list
    expect(screen.getByRole('list', { name: 'Asset audit history' })).toBeInTheDocument();
  });

  it('renders action badges for different action types', () => {
    render(<AssetHistory history={mockHistory} />);
    
    // Check for various action types
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getAllByText('Updated').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Status Changed').length).toBeGreaterThan(0);
    expect(screen.getByText('Assignment')).toBeInTheDocument();
    expect(screen.getByText('Relationship')).toBeInTheDocument();
  });

  it('renders audit entry descriptions', () => {
    render(<AssetHistory history={mockHistory} />);
    
    expect(screen.getByText('Asset created')).toBeInTheDocument();
    expect(screen.getByText('Description updated')).toBeInTheDocument();
    expect(screen.getByText('Status changed from Ordered to Received')).toBeInTheDocument();
    expect(screen.getByText('Asset assigned to John Smith')).toBeInTheDocument();
  });

  it('renders user names for each entry', () => {
    render(<AssetHistory history={mockHistory} />);
    
    // Multiple entries by John Smith
    const johnSmithEntries = screen.getAllByText('John Smith');
    expect(johnSmithEntries.length).toBeGreaterThan(0);
  });

  it('renders timestamps for each entry', () => {
    render(<AssetHistory history={mockHistory} />);
    
    // Should have time elements with datetime attributes
    const timeElements = document.querySelectorAll('time[datetime]');
    expect(timeElements.length).toBe(mockHistory.length);
  });

  it('renders change details for field updates', () => {
    render(<AssetHistory history={mockHistory} />);
    
    // Should show field name and from/to values for updates
    expect(screen.getByText('description:')).toBeInTheDocument();
    expect(screen.getByText('Initial description')).toBeInTheDocument();
    expect(screen.getByText('Updated description with more details')).toBeInTheDocument();
  });

  it('renders status change details', () => {
    render(<AssetHistory history={mockHistory} />);
    
    // Should show status field changes
    expect(screen.getAllByText('status:').length).toBeGreaterThan(0);
    expect(screen.getByText('ORDERED')).toBeInTheDocument();
    expect(screen.getAllByText('RECEIVED').length).toBeGreaterThan(0);
  });

  it('renders loading skeleton when isLoading is true', () => {
    render(<AssetHistory history={mockHistory} isLoading={true} />);
    
    // Should have aria-busy attribute on the container
    const container = document.querySelector('[aria-busy="true"]');
    expect(container).toBeInTheDocument();
    
    // Should not render actual history
    expect(screen.queryByText('Asset created')).not.toBeInTheDocument();
  });

  it('displays entries in reverse chronological order (most recent first)', () => {
    render(<AssetHistory history={mockHistory} />);
    
    const listItems = screen.getAllByRole('listitem');
    expect(listItems.length).toBe(mockHistory.length);
    
    // First item should be the most recent (Relationship entry based on mock data)
    // The mock data is already reversed, so first entry should be "Linked to parent asset"
    expect(listItems[0]).toHaveTextContent('Linked to parent asset');
  });
});

describe('AssetHistory - Requirements Validation', () => {
  /**
   * Validates Requirement 2.5: System shall maintain complete audit trail of all asset changes
   */
  it('displays complete audit trail with timestamp, user, and previous values (Requirement 2.5)', () => {
    render(<AssetHistory history={mockHardwareAssetDetail.auditHistory} />);
    
    // Verify audit entries are displayed
    expect(screen.getByRole('list', { name: 'Asset audit history' })).toBeInTheDocument();
    
    // Verify timestamps are present
    const timeElements = document.querySelectorAll('time[datetime]');
    expect(timeElements.length).toBe(mockHardwareAssetDetail.auditHistory.length);
    
    // Verify user names are displayed
    expect(screen.getAllByText('John Smith').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0);
    
    // Verify previous values are shown for updates
    expect(screen.getByText('Initial description')).toBeInTheDocument();
    expect(screen.getByText('ORDERED')).toBeInTheDocument();
    
    // Verify new values are shown
    expect(screen.getByText('Updated description with more details')).toBeInTheDocument();
    expect(screen.getAllByText('RECEIVED').length).toBeGreaterThan(0);
  });

  /**
   * Validates that all change types are tracked
   */
  it('tracks all types of asset changes (Requirement 2.5)', () => {
    render(<AssetHistory history={mockHardwareAssetDetail.auditHistory} />);
    
    // CREATE action
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Asset created')).toBeInTheDocument();
    
    // UPDATE action
    expect(screen.getAllByText('Updated').length).toBeGreaterThan(0);
    expect(screen.getByText('Description updated')).toBeInTheDocument();
    
    // STATUS_CHANGE action
    expect(screen.getAllByText('Status Changed').length).toBeGreaterThan(0);
    
    // ASSIGNMENT action
    expect(screen.getByText('Assignment')).toBeInTheDocument();
    expect(screen.getByText('Asset assigned to John Smith')).toBeInTheDocument();
    
    // RELATIONSHIP action
    expect(screen.getByText('Relationship')).toBeInTheDocument();
    expect(screen.getByText('Linked to parent asset AMS-HW-20240101-0001')).toBeInTheDocument();
  });
});
