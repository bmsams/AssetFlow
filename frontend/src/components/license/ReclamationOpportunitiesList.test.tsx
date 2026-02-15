import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReclamationOpportunitiesList } from './ReclamationOpportunitiesList';
import type { ReclamationOpportunity } from '../../types/license';

const mockOpportunities: ReclamationOpportunity[] = [
  {
    opportunityId: 'reclaim-001',
    installationId: 'install-001',
    productId: 'product-003',
    publisher: 'Adobe',
    productName: 'Adobe Creative Cloud',
    assignedTo: 'John Smith',
    assignedToEmail: 'john.smith@company.com',
    deviceName: 'LAPTOP-JS001',
    lastUsedDate: '2024-10-15T10:30:00Z',
    daysSinceLastUse: 103,
    reclamationStatus: 'IDENTIFIED',
    estimatedSavings: 660,
    reclamationRuleName: '90 Day Unused Software',
  },
  {
    opportunityId: 'reclaim-002',
    installationId: 'install-002',
    productId: 'product-003',
    publisher: 'Adobe',
    productName: 'Adobe Creative Cloud',
    assignedTo: 'Sarah Johnson',
    assignedToEmail: 'sarah.johnson@company.com',
    deviceName: 'DESKTOP-SJ002',
    lastUsedDate: '2024-09-20T14:00:00Z',
    daysSinceLastUse: 128,
    reclamationStatus: 'PENDING_APPROVAL',
    estimatedSavings: 660,
    reclamationRuleName: '90 Day Unused Software',
  },
  {
    opportunityId: 'reclaim-003',
    installationId: 'install-003',
    productId: 'product-005',
    publisher: 'Salesforce',
    productName: 'Salesforce Sales Cloud',
    assignedTo: 'Mike Chen',
    assignedToEmail: 'mike.chen@company.com',
    deviceName: 'N/A (SaaS)',
    lastUsedDate: '2024-11-01T09:15:00Z',
    daysSinceLastUse: 86,
    reclamationStatus: 'APPROVED',
    estimatedSavings: 1800,
    reclamationRuleName: '60 Day Unused SaaS',
  },
];

describe('ReclamationOpportunitiesList', () => {
  it('renders the title', () => {
    render(<ReclamationOpportunitiesList opportunities={mockOpportunities} />);
    expect(screen.getByText('Reclamation Opportunities')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<ReclamationOpportunitiesList opportunities={mockOpportunities} title="License Recovery" />);
    expect(screen.getByText('License Recovery')).toBeInTheDocument();
  });

  it('displays opportunity count badge', () => {
    render(<ReclamationOpportunitiesList opportunities={mockOpportunities} />);
    expect(screen.getByText('3 opportunities')).toBeInTheDocument();
  });

  it('displays total potential savings', () => {
    render(<ReclamationOpportunitiesList opportunities={mockOpportunities} />);
    expect(screen.getByText('Potential Savings')).toBeInTheDocument();
    expect(screen.getByText('$3,120')).toBeInTheDocument();
  });

  it('renders reclamation opportunity items', () => {
    render(<ReclamationOpportunitiesList opportunities={mockOpportunities} />);
    expect(screen.getAllByText('Adobe Creative Cloud').length).toBe(2);
    expect(screen.getByText('Salesforce Sales Cloud')).toBeInTheDocument();
  });

  it('displays publisher names', () => {
    render(<ReclamationOpportunitiesList opportunities={mockOpportunities} />);
    expect(screen.getAllByText('Adobe').length).toBe(2);
    expect(screen.getByText('Salesforce')).toBeInTheDocument();
  });

  it('displays reclamation status badges', () => {
    render(<ReclamationOpportunitiesList opportunities={mockOpportunities} />);
    expect(screen.getByText('Identified')).toBeInTheDocument();
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('displays assigned user names', () => {
    render(<ReclamationOpportunitiesList opportunities={mockOpportunities} />);
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
    expect(screen.getByText('Mike Chen')).toBeInTheDocument();
  });

  it('displays device names', () => {
    render(<ReclamationOpportunitiesList opportunities={mockOpportunities} />);
    expect(screen.getByText('LAPTOP-JS001')).toBeInTheDocument();
    expect(screen.getByText('DESKTOP-SJ002')).toBeInTheDocument();
    expect(screen.getByText('N/A (SaaS)')).toBeInTheDocument();
  });

  it('displays days since last use', () => {
    render(<ReclamationOpportunitiesList opportunities={mockOpportunities} />);
    expect(screen.getByText('(103 days ago)')).toBeInTheDocument();
    expect(screen.getByText('(128 days ago)')).toBeInTheDocument();
    expect(screen.getByText('(86 days ago)')).toBeInTheDocument();
  });

  it('displays estimated savings', () => {
    render(<ReclamationOpportunitiesList opportunities={mockOpportunities} />);
    expect(screen.getAllByText('Savings: $660/year').length).toBe(2);
    expect(screen.getByText('Savings: $1,800/year')).toBeInTheDocument();
  });

  it('displays reclamation rule names', () => {
    render(<ReclamationOpportunitiesList opportunities={mockOpportunities} />);
    expect(screen.getAllByText('90 Day Unused Software').length).toBe(2);
    expect(screen.getByText('60 Day Unused SaaS')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<ReclamationOpportunitiesList opportunities={[]} isLoading />);
    expect(screen.getByRole('generic', { busy: true })).toBeInTheDocument();
  });

  it('shows empty state when no opportunities', () => {
    render(<ReclamationOpportunitiesList opportunities={[]} />);
    expect(screen.getByText('No reclamation opportunities found')).toBeInTheDocument();
  });

  it('calls onOpportunityClick when item is clicked', () => {
    const handleClick = vi.fn();
    render(<ReclamationOpportunitiesList opportunities={mockOpportunities} onOpportunityClick={handleClick} />);
    
    // Multiple Adobe Creative Cloud items exist, so use getAllByLabelText and click the first one
    const items = screen.getAllByLabelText(/View Adobe Creative Cloud reclamation details/);
    fireEvent.click(items[0]);
    
    expect(handleClick).toHaveBeenCalledWith(mockOpportunities[0]);
  });

  it('shows reclaim button for IDENTIFIED status', () => {
    render(
      <ReclamationOpportunitiesList 
        opportunities={mockOpportunities} 
        onInitiateReclamation={() => {}} 
      />
    );
    
    const reclaimButtons = screen.getAllByText('Reclaim');
    expect(reclaimButtons.length).toBe(1); // Only one IDENTIFIED status
  });

  it('calls onInitiateReclamation when reclaim button is clicked', () => {
    const handleReclaim = vi.fn();
    render(
      <ReclamationOpportunitiesList 
        opportunities={mockOpportunities} 
        onInitiateReclamation={handleReclaim} 
      />
    );
    
    const reclaimButton = screen.getByText('Reclaim');
    fireEvent.click(reclaimButton);
    
    expect(handleReclaim).toHaveBeenCalledWith(mockOpportunities[0]);
  });

  it('limits displayed items based on maxItems', () => {
    const manyOpportunities = Array.from({ length: 10 }, (_, i) => ({
      ...mockOpportunities[0],
      opportunityId: `reclaim-${i}`,
      assignedTo: `User ${i}`,
    }));
    
    render(
      <ReclamationOpportunitiesList 
        opportunities={manyOpportunities} 
        maxItems={3} 
        onViewAll={() => {}} 
      />
    );
    
    expect(screen.getByText('View all 10 opportunities')).toBeInTheDocument();
  });

  it('calls onViewAll when view all button is clicked', () => {
    const handleViewAll = vi.fn();
    const manyOpportunities = Array.from({ length: 10 }, (_, i) => ({
      ...mockOpportunities[0],
      opportunityId: `reclaim-${i}`,
      assignedTo: `User ${i}`,
    }));
    
    render(
      <ReclamationOpportunitiesList 
        opportunities={manyOpportunities} 
        maxItems={3} 
        onViewAll={handleViewAll} 
      />
    );
    
    fireEvent.click(screen.getByText('View all 10 opportunities'));
    expect(handleViewAll).toHaveBeenCalled();
  });

  it('has accessible item labels', () => {
    render(<ReclamationOpportunitiesList opportunities={mockOpportunities} />);
    // Multiple Adobe Creative Cloud items exist, so use getAllByLabelText
    const adobeItems = screen.getAllByLabelText(/View Adobe Creative Cloud reclamation details/);
    expect(adobeItems.length).toBeGreaterThan(0);
  });
});

describe('ReclamationOpportunitiesList - Requirements Validation', () => {
  /**
   * Validates Requirement 12.5: Show reclamation opportunities
   */
  it('displays reclamation opportunities with savings (Requirement 12.5)', () => {
    render(<ReclamationOpportunitiesList opportunities={mockOpportunities} />);
    
    // Verify reclamation opportunities are displayed with savings
    expect(screen.getAllByText('Adobe Creative Cloud').length).toBe(2);
    expect(screen.getByText('Potential Savings')).toBeInTheDocument();
    expect(screen.getByText('$3,120')).toBeInTheDocument();
  });

  /**
   * Validates Requirement 4.10: Display optimization opportunities
   */
  it('displays optimization opportunities with usage data (Requirement 4.10)', () => {
    render(<ReclamationOpportunitiesList opportunities={mockOpportunities} />);
    
    // Verify usage data is displayed
    expect(screen.getByText('(103 days ago)')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('LAPTOP-JS001')).toBeInTheDocument();
  });

  /**
   * Validates Requirement 12.5: Implement drill-down to detailed records
   */
  it('supports drill-down to detailed records (Requirement 12.5)', () => {
    const handleClick = vi.fn();
    render(<ReclamationOpportunitiesList opportunities={mockOpportunities} onOpportunityClick={handleClick} />);
    
    // Multiple Adobe Creative Cloud items exist, so use getAllByLabelText and click the first one
    const items = screen.getAllByLabelText(/View Adobe Creative Cloud reclamation details/);
    fireEvent.click(items[0]);
    
    expect(handleClick).toHaveBeenCalledWith(expect.objectContaining({
      opportunityId: 'reclaim-001',
      productName: 'Adobe Creative Cloud',
    }));
  });

  /**
   * Validates Requirement 4.10: Support reclamation actions
   */
  it('supports initiating reclamation workflow (Requirement 4.10)', () => {
    const handleReclaim = vi.fn();
    render(
      <ReclamationOpportunitiesList 
        opportunities={mockOpportunities} 
        onInitiateReclamation={handleReclaim} 
      />
    );
    
    const reclaimButton = screen.getByText('Reclaim');
    fireEvent.click(reclaimButton);
    
    expect(handleReclaim).toHaveBeenCalledWith(expect.objectContaining({
      reclamationStatus: 'IDENTIFIED',
    }));
  });
});
