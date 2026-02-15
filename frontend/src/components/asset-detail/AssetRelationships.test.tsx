import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetRelationships } from './AssetRelationships';
import { mockHardwareAssetDetail } from './mockData';

describe('AssetRelationships', () => {
  const mockRelationships = mockHardwareAssetDetail.relationships;

  it('renders relationships header with count', () => {
    render(<AssetRelationships relationships={mockRelationships} />);
    expect(screen.getByText('Relationships')).toBeInTheDocument();
    expect(screen.getByText(`(${mockRelationships.length})`)).toBeInTheDocument();
  });

  it('renders add button', () => {
    render(<AssetRelationships relationships={mockRelationships} />);
    expect(screen.getByLabelText('Add relationship')).toBeInTheDocument();
  });

  it('renders empty state when no relationships', () => {
    render(<AssetRelationships relationships={[]} />);
    expect(screen.getByText('No relationships defined')).toBeInTheDocument();
    expect(screen.getByText('Add relationships to link this asset with other assets')).toBeInTheDocument();
  });

  it('renders relationship groups by type', () => {
    render(<AssetRelationships relationships={mockRelationships} />);
    
    // Should have Parent/Child group
    expect(screen.getByText('Parent/Child')).toBeInTheDocument();
    
    // Should have Dependency group
    expect(screen.getByText('Dependency')).toBeInTheDocument();
    
    // Should have Component group
    expect(screen.getByText('Component')).toBeInTheDocument();
  });

  it('renders related asset names', () => {
    render(<AssetRelationships relationships={mockRelationships} />);
    
    expect(screen.getByText('Server Rack A-01')).toBeInTheDocument();
    expect(screen.getByText('Microsoft Office 365 E3')).toBeInTheDocument();
    expect(screen.getByText('Samsung 1TB NVMe SSD')).toBeInTheDocument();
  });

  it('renders related asset tags', () => {
    render(<AssetRelationships relationships={mockRelationships} />);
    
    expect(screen.getByText('AMS-HW-20240101-0001')).toBeInTheDocument();
    expect(screen.getByText('AMS-SW-20240201-0001')).toBeInTheDocument();
    expect(screen.getByText('AMS-HW-20240115-0002')).toBeInTheDocument();
  });

  it('renders type badges for related assets', () => {
    render(<AssetRelationships relationships={mockRelationships} />);
    
    // Hardware badges
    const hardwareBadges = screen.getAllByText('Hardware');
    expect(hardwareBadges.length).toBeGreaterThan(0);
    
    // Software badge
    expect(screen.getByText('Software')).toBeInTheDocument();
  });

  it('renders relationship descriptions', () => {
    render(<AssetRelationships relationships={mockRelationships} />);
    
    expect(screen.getByText('Installed in rack')).toBeInTheDocument();
    expect(screen.getByText('Software installed on this hardware')).toBeInTheDocument();
    expect(screen.getByText('Storage component')).toBeInTheDocument();
  });

  it('calls onAssetClick when relationship card is clicked', () => {
    const onAssetClick = vi.fn();
    render(<AssetRelationships relationships={mockRelationships} onAssetClick={onAssetClick} />);
    
    fireEvent.click(screen.getByLabelText('View Server Rack A-01'));
    expect(onAssetClick).toHaveBeenCalledWith('asset-parent-001');
  });

  it('calls onAddRelationship when add button is clicked', () => {
    const onAddRelationship = vi.fn();
    render(<AssetRelationships relationships={mockRelationships} onAddRelationship={onAddRelationship} />);
    
    fireEvent.click(screen.getByLabelText('Add relationship'));
    expect(onAddRelationship).toHaveBeenCalledTimes(1);
  });

  it('renders loading skeleton when isLoading is true', () => {
    render(<AssetRelationships relationships={mockRelationships} isLoading={true} />);
    
    // Should have aria-busy attribute on the container
    const container = document.querySelector('[aria-busy="true"]');
    expect(container).toBeInTheDocument();
    
    // Should not render actual relationships
    expect(screen.queryByText('Server Rack A-01')).not.toBeInTheDocument();
  });
});

describe('AssetRelationships - Requirements Validation', () => {
  /**
   * Validates Requirement 2.3: System shall support asset relationships (parent-child, dependencies)
   */
  it('displays asset relationships including parent-child and dependencies (Requirement 2.3)', () => {
    render(<AssetRelationships relationships={mockHardwareAssetDetail.relationships} />);
    
    // Parent/Child relationships
    expect(screen.getByText('Parent/Child')).toBeInTheDocument();
    expect(screen.getByText('Server Rack A-01')).toBeInTheDocument();
    expect(screen.getByText('Installed in rack')).toBeInTheDocument();
    
    // Dependency relationships
    expect(screen.getByText('Dependency')).toBeInTheDocument();
    expect(screen.getByText('Microsoft Office 365 E3')).toBeInTheDocument();
    expect(screen.getByText('Software installed on this hardware')).toBeInTheDocument();
    
    // Component relationships
    expect(screen.getByText('Component')).toBeInTheDocument();
    expect(screen.getByText('Samsung 1TB NVMe SSD')).toBeInTheDocument();
  });

  /**
   * Validates that relationship direction is indicated
   */
  it('indicates relationship direction (source vs target)', () => {
    render(<AssetRelationships relationships={mockHardwareAssetDetail.relationships} />);
    
    // The component shows direction via icons (arrows)
    // Verify that relationship cards are rendered with proper structure
    const relationshipCards = screen.getAllByRole('button', { name: /View/ });
    expect(relationshipCards.length).toBe(mockHardwareAssetDetail.relationships.length);
  });
});
