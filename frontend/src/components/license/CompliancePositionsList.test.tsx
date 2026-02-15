import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompliancePositionsList } from './CompliancePositionsList';
import type { CompliancePosition } from '../../types/license';

const mockPositions: CompliancePosition[] = [
  {
    productId: 'product-001',
    publisher: 'Microsoft',
    productName: 'Microsoft 365 E3',
    version: '2024',
    productCategory: 'Productivity Suite',
    licenseMetricType: 'SUBSCRIPTION',
    entitlementsOwned: 500,
    installationsFound: 485,
    compliancePosition: 'COMPLIANT',
    overUnderCount: 15,
    lastReconciledDate: '2025-01-26T08:00:00Z',
    unitCost: 432,
    totalEntitlementValue: 216000,
    potentialExposure: 0,
  },
  {
    productId: 'product-002',
    publisher: 'Microsoft',
    productName: 'SQL Server Enterprise',
    version: '2022',
    edition: 'Enterprise',
    productCategory: 'Database',
    licenseMetricType: 'PER_CORE',
    entitlementsOwned: 48,
    installationsFound: 64,
    compliancePosition: 'UNDER_LICENSED',
    overUnderCount: -16,
    lastReconciledDate: '2025-01-25T14:30:00Z',
    unitCost: 15123,
    totalEntitlementValue: 725904,
    potentialExposure: 241968,
  },
  {
    productId: 'product-003',
    publisher: 'Salesforce',
    productName: 'Salesforce Sales Cloud',
    version: 'Enterprise',
    productCategory: 'CRM',
    licenseMetricType: 'PER_USER',
    entitlementsOwned: 200,
    installationsFound: 165,
    compliancePosition: 'OVER_LICENSED',
    overUnderCount: 35,
    lastReconciledDate: '2025-01-26T09:15:00Z',
    unitCost: 1800,
    totalEntitlementValue: 360000,
    potentialExposure: 0,
  },
];

describe('CompliancePositionsList', () => {
  it('renders the title', () => {
    render(<CompliancePositionsList positions={mockPositions} />);
    expect(screen.getByText('Compliance Positions')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<CompliancePositionsList positions={mockPositions} title="Software Compliance" />);
    expect(screen.getByText('Software Compliance')).toBeInTheDocument();
  });

  it('displays status summary counts', () => {
    render(<CompliancePositionsList positions={mockPositions} />);
    // Should show counts for each status
    const summaryItems = screen.getAllByTestId ? 
      screen.getAllByText(/^[0-3]$/) : 
      document.querySelectorAll('[data-status]');
    expect(summaryItems.length).toBeGreaterThan(0);
  });

  it('renders compliance position items', () => {
    render(<CompliancePositionsList positions={mockPositions} />);
    expect(screen.getByText('Microsoft 365 E3')).toBeInTheDocument();
    expect(screen.getByText('SQL Server Enterprise')).toBeInTheDocument();
    expect(screen.getByText('Salesforce Sales Cloud')).toBeInTheDocument();
  });

  it('displays publisher names', () => {
    render(<CompliancePositionsList positions={mockPositions} />);
    expect(screen.getAllByText('Microsoft').length).toBeGreaterThan(0);
    expect(screen.getByText('Salesforce')).toBeInTheDocument();
  });

  it('displays compliance status badges', () => {
    render(<CompliancePositionsList positions={mockPositions} />);
    expect(screen.getByText('Compliant')).toBeInTheDocument();
    expect(screen.getByText('Under-Licensed')).toBeInTheDocument();
    expect(screen.getByText('Over-Licensed')).toBeInTheDocument();
  });

  it('displays license metric types', () => {
    render(<CompliancePositionsList positions={mockPositions} />);
    expect(screen.getByText('Subscription')).toBeInTheDocument();
    expect(screen.getByText('Per Core')).toBeInTheDocument();
    expect(screen.getByText('Per User')).toBeInTheDocument();
  });

  it('displays entitlement counts', () => {
    render(<CompliancePositionsList positions={mockPositions} />);
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('485')).toBeInTheDocument();
  });

  it('displays variance values', () => {
    render(<CompliancePositionsList positions={mockPositions} />);
    expect(screen.getByText('+15')).toBeInTheDocument();
    expect(screen.getByText('-16')).toBeInTheDocument();
    expect(screen.getByText('+35')).toBeInTheDocument();
  });

  it('displays potential exposure for under-licensed items', () => {
    render(<CompliancePositionsList positions={mockPositions} />);
    expect(screen.getByText('Exposure: $241,968')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<CompliancePositionsList positions={[]} isLoading />);
    expect(screen.getByRole('generic', { busy: true })).toBeInTheDocument();
  });

  it('shows empty state when no positions', () => {
    render(<CompliancePositionsList positions={[]} />);
    expect(screen.getByText('No compliance data available')).toBeInTheDocument();
  });

  it('calls onPositionClick when item is clicked', () => {
    const handleClick = vi.fn();
    render(<CompliancePositionsList positions={mockPositions} onPositionClick={handleClick} />);
    
    const firstItem = screen.getByLabelText(/View Microsoft 365 E3 compliance details/);
    fireEvent.click(firstItem);
    
    expect(handleClick).toHaveBeenCalledWith(mockPositions[0]);
  });

  it('limits displayed items based on maxItems', () => {
    const manyPositions = Array.from({ length: 10 }, (_, i) => ({
      ...mockPositions[0],
      productId: `product-${i}`,
      productName: `Product ${i}`,
    }));
    
    render(
      <CompliancePositionsList 
        positions={manyPositions} 
        maxItems={3} 
        onViewAll={() => {}} 
      />
    );
    
    expect(screen.getByText('View all 10 software titles')).toBeInTheDocument();
  });

  it('calls onViewAll when view all button is clicked', () => {
    const handleViewAll = vi.fn();
    const manyPositions = Array.from({ length: 10 }, (_, i) => ({
      ...mockPositions[0],
      productId: `product-${i}`,
      productName: `Product ${i}`,
    }));
    
    render(
      <CompliancePositionsList 
        positions={manyPositions} 
        maxItems={3} 
        onViewAll={handleViewAll} 
      />
    );
    
    fireEvent.click(screen.getByText('View all 10 software titles'));
    expect(handleViewAll).toHaveBeenCalled();
  });

  it('has accessible item labels', () => {
    render(<CompliancePositionsList positions={mockPositions} />);
    expect(screen.getByLabelText('View Microsoft 365 E3 compliance details')).toBeInTheDocument();
  });
});

describe('CompliancePositionsList - Requirements Validation', () => {
  /**
   * Validates Requirement 12.5: Display compliance positions by software title
   */
  it('displays compliance positions by software title (Requirement 12.5)', () => {
    render(<CompliancePositionsList positions={mockPositions} />);
    
    // Verify software titles are displayed with compliance information
    expect(screen.getByText('Microsoft 365 E3')).toBeInTheDocument();
    expect(screen.getByText('SQL Server Enterprise')).toBeInTheDocument();
    expect(screen.getByText('Compliant')).toBeInTheDocument();
    expect(screen.getByText('Under-Licensed')).toBeInTheDocument();
  });

  /**
   * Validates Requirement 4.10: Display compliance positions
   */
  it('displays compliance positions with owned vs found counts (Requirement 4.10)', () => {
    render(<CompliancePositionsList positions={mockPositions} />);
    
    // Verify entitlements owned and installations found are displayed
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('485')).toBeInTheDocument();
    // Multiple items have "owned" and "found" text
    expect(screen.getAllByText(/owned/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/found/).length).toBeGreaterThan(0);
  });

  /**
   * Validates Requirement 12.5: Implement drill-down to detailed records
   */
  it('supports drill-down to detailed records (Requirement 12.5)', () => {
    const handleClick = vi.fn();
    render(<CompliancePositionsList positions={mockPositions} onPositionClick={handleClick} />);
    
    const item = screen.getByLabelText(/View Microsoft 365 E3 compliance details/);
    fireEvent.click(item);
    
    expect(handleClick).toHaveBeenCalledWith(expect.objectContaining({
      productId: 'product-001',
      productName: 'Microsoft 365 E3',
    }));
  });
});
