import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuditRisksList } from './AuditRisksList';
import type { AuditRisk } from '../../types/license';

const mockRisks: AuditRisk[] = [
  {
    riskId: 'risk-001',
    productId: 'product-002',
    publisher: 'Microsoft',
    productName: 'SQL Server Enterprise',
    riskLevel: 'critical',
    riskType: 'Under-Licensing',
    description: 'SQL Server Enterprise is under-licensed by 16 cores.',
    underLicensedCount: 16,
    estimatedExposure: 241968,
    recommendedAction: 'Purchase additional core licenses.',
    lastAssessedDate: '2025-01-25T14:30:00Z',
  },
  {
    riskId: 'risk-002',
    productId: 'product-004',
    publisher: 'Oracle',
    productName: 'Oracle Database Enterprise',
    riskLevel: 'high',
    riskType: 'Under-Licensing',
    description: 'Oracle Database is under-licensed by 4 processors.',
    underLicensedCount: 4,
    estimatedExposure: 190000,
    recommendedAction: 'Engage Oracle licensing specialist.',
    lastAssessedDate: '2025-01-24T11:00:00Z',
  },
  {
    riskId: 'risk-003',
    productId: 'product-007',
    publisher: 'VMware',
    productName: 'vSphere Enterprise Plus',
    riskLevel: 'medium',
    riskType: 'Under-Licensing',
    description: 'VMware vSphere is under-licensed by 4 processors.',
    underLicensedCount: 4,
    estimatedExposure: 18380,
    recommendedAction: 'Purchase additional processor licenses.',
    lastAssessedDate: '2025-01-23T10:00:00Z',
  },
];

describe('AuditRisksList', () => {
  it('renders the title', () => {
    render(<AuditRisksList risks={mockRisks} />);
    expect(screen.getByText('Audit Risks')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<AuditRisksList risks={mockRisks} title="License Risks" />);
    expect(screen.getByText('License Risks')).toBeInTheDocument();
  });

  it('displays risk count badge', () => {
    render(<AuditRisksList risks={mockRisks} />);
    expect(screen.getByText('3 risks')).toBeInTheDocument();
  });

  it('displays total exposure', () => {
    render(<AuditRisksList risks={mockRisks} />);
    expect(screen.getByText('Total Exposure')).toBeInTheDocument();
    expect(screen.getByText('$450,348')).toBeInTheDocument();
  });

  it('renders audit risk items', () => {
    render(<AuditRisksList risks={mockRisks} />);
    expect(screen.getByText('SQL Server Enterprise')).toBeInTheDocument();
    expect(screen.getByText('Oracle Database Enterprise')).toBeInTheDocument();
    expect(screen.getByText('vSphere Enterprise Plus')).toBeInTheDocument();
  });

  it('displays publisher names', () => {
    render(<AuditRisksList risks={mockRisks} />);
    expect(screen.getByText('Microsoft')).toBeInTheDocument();
    expect(screen.getByText('Oracle')).toBeInTheDocument();
    expect(screen.getByText('VMware')).toBeInTheDocument();
  });

  it('displays risk levels', () => {
    render(<AuditRisksList risks={mockRisks} />);
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
  });

  it('displays risk types', () => {
    render(<AuditRisksList risks={mockRisks} />);
    const riskTypes = screen.getAllByText('Under-Licensing');
    expect(riskTypes.length).toBe(3);
  });

  it('displays risk descriptions', () => {
    render(<AuditRisksList risks={mockRisks} />);
    expect(screen.getByText(/SQL Server Enterprise is under-licensed/)).toBeInTheDocument();
  });

  it('displays individual exposure amounts', () => {
    render(<AuditRisksList risks={mockRisks} />);
    expect(screen.getByText('Exposure: $241,968')).toBeInTheDocument();
    expect(screen.getByText('Exposure: $190,000')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<AuditRisksList risks={[]} isLoading />);
    expect(screen.getByRole('generic', { busy: true })).toBeInTheDocument();
  });

  it('shows empty state when no risks', () => {
    render(<AuditRisksList risks={[]} />);
    expect(screen.getByText('No audit risks identified')).toBeInTheDocument();
  });

  it('calls onRiskClick when item is clicked', () => {
    const handleClick = vi.fn();
    render(<AuditRisksList risks={mockRisks} onRiskClick={handleClick} />);
    
    const firstItem = screen.getByLabelText(/View SQL Server Enterprise risk details/);
    fireEvent.click(firstItem);
    
    expect(handleClick).toHaveBeenCalledWith(mockRisks[0]);
  });

  it('calls onViewDetails when details button is clicked', () => {
    const handleViewDetails = vi.fn();
    render(<AuditRisksList risks={mockRisks} onViewDetails={handleViewDetails} />);
    
    const detailsButtons = screen.getAllByLabelText(/View details for/);
    fireEvent.click(detailsButtons[0]);
    
    expect(handleViewDetails).toHaveBeenCalledWith(mockRisks[0]);
  });

  it('limits displayed items based on maxItems', () => {
    const manyRisks = Array.from({ length: 10 }, (_, i) => ({
      ...mockRisks[0],
      riskId: `risk-${i}`,
      productName: `Product ${i}`,
    }));
    
    render(
      <AuditRisksList 
        risks={manyRisks} 
        maxItems={3} 
        onViewAll={() => {}} 
      />
    );
    
    expect(screen.getByText('View all 10 audit risks')).toBeInTheDocument();
  });

  it('calls onViewAll when view all button is clicked', () => {
    const handleViewAll = vi.fn();
    const manyRisks = Array.from({ length: 10 }, (_, i) => ({
      ...mockRisks[0],
      riskId: `risk-${i}`,
      productName: `Product ${i}`,
    }));
    
    render(
      <AuditRisksList 
        risks={manyRisks} 
        maxItems={3} 
        onViewAll={handleViewAll} 
      />
    );
    
    fireEvent.click(screen.getByText('View all 10 audit risks'));
    expect(handleViewAll).toHaveBeenCalled();
  });

  it('has accessible item labels', () => {
    render(<AuditRisksList risks={mockRisks} />);
    expect(screen.getByLabelText('View SQL Server Enterprise risk details')).toBeInTheDocument();
  });
});

describe('AuditRisksList - Requirements Validation', () => {
  /**
   * Validates Requirement 12.5: Show audit risks
   */
  it('displays audit risks with severity levels (Requirement 12.5)', () => {
    render(<AuditRisksList risks={mockRisks} />);
    
    // Verify audit risks are displayed with severity
    expect(screen.getByText('SQL Server Enterprise')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  /**
   * Validates Requirement 4.10: Display audit risks
   */
  it('displays audit risks with exposure amounts (Requirement 4.10)', () => {
    render(<AuditRisksList risks={mockRisks} />);
    
    // Verify exposure amounts are displayed
    expect(screen.getByText('Total Exposure')).toBeInTheDocument();
    expect(screen.getByText('$450,348')).toBeInTheDocument();
    expect(screen.getByText('Exposure: $241,968')).toBeInTheDocument();
  });

  /**
   * Validates Requirement 12.5: Implement drill-down to detailed records
   */
  it('supports drill-down to detailed records (Requirement 12.5)', () => {
    const handleClick = vi.fn();
    render(<AuditRisksList risks={mockRisks} onRiskClick={handleClick} />);
    
    const item = screen.getByLabelText(/View SQL Server Enterprise risk details/);
    fireEvent.click(item);
    
    expect(handleClick).toHaveBeenCalledWith(expect.objectContaining({
      riskId: 'risk-001',
      productName: 'SQL Server Enterprise',
    }));
  });
});
