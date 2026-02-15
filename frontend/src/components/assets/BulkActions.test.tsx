import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActions } from './BulkActions';
import type { Asset } from '../../types/asset';

const mockAssets: Asset[] = [
  {
    assetId: 'asset-001',
    assetTag: 'AMS-HW-20250101-0001',
    assetType: 'HARDWARE',
    displayName: 'Dell Latitude 5540',
    status: 'DEPLOYED',
    createdAt: '2025-01-01T10:00:00Z',
    updatedAt: '2025-01-15T14:30:00Z',
  },
  {
    assetId: 'asset-002',
    assetTag: 'AMS-SW-20250102-0002',
    assetType: 'SOFTWARE',
    displayName: 'Microsoft Office 365',
    status: 'IN_STOCK',
    createdAt: '2025-01-02T09:00:00Z',
    updatedAt: '2025-01-02T09:00:00Z',
  },
];

describe('BulkActions', () => {
  it('renders nothing when no assets are selected', () => {
    const { container } = render(
      <BulkActions selectedAssets={[]} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders selection count for single asset', () => {
    render(<BulkActions selectedAssets={[mockAssets[0]]} />);
    expect(screen.getByText('1 asset selected')).toBeInTheDocument();
  });

  it('renders selection count for multiple assets', () => {
    render(<BulkActions selectedAssets={mockAssets} />);
    expect(screen.getByText('2 assets selected')).toBeInTheDocument();
  });

  it('renders clear selection button', () => {
    render(
      <BulkActions 
        selectedAssets={mockAssets} 
        onClearSelection={() => {}} 
      />
    );
    expect(screen.getByText('Clear selection')).toBeInTheDocument();
  });

  it('calls onClearSelection when clear button is clicked', () => {
    const handleClear = vi.fn();
    render(
      <BulkActions 
        selectedAssets={mockAssets} 
        onClearSelection={handleClear} 
      />
    );
    
    fireEvent.click(screen.getByText('Clear selection'));
    expect(handleClear).toHaveBeenCalled();
  });

  it('renders delete button when onDelete is provided', () => {
    render(
      <BulkActions 
        selectedAssets={mockAssets} 
        onDelete={() => {}} 
      />
    );
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onDelete with selected assets when delete is clicked', () => {
    const handleDelete = vi.fn();
    render(
      <BulkActions 
        selectedAssets={mockAssets} 
        onDelete={handleDelete} 
      />
    );
    
    fireEvent.click(screen.getByText('Delete'));
    expect(handleDelete).toHaveBeenCalledWith(mockAssets);
  });

  it('renders export button when onExport is provided', () => {
    render(
      <BulkActions 
        selectedAssets={mockAssets} 
        onExport={() => {}} 
      />
    );
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('shows export menu when export button is clicked', () => {
    render(
      <BulkActions 
        selectedAssets={mockAssets} 
        onExport={() => {}} 
      />
    );
    
    fireEvent.click(screen.getByText('Export'));
    
    expect(screen.getByText('Export as CSV')).toBeInTheDocument();
    expect(screen.getByText('Export as Excel')).toBeInTheDocument();
    expect(screen.getByText('Export as PDF')).toBeInTheDocument();
  });

  it('calls onExport with correct format when export option is clicked', () => {
    const handleExport = vi.fn();
    render(
      <BulkActions 
        selectedAssets={mockAssets} 
        onExport={handleExport} 
      />
    );
    
    fireEvent.click(screen.getByText('Export'));
    fireEvent.click(screen.getByText('Export as CSV'));
    
    expect(handleExport).toHaveBeenCalledWith(mockAssets, 'csv');
  });

  it('renders change status button when onStatusChange is provided', () => {
    render(
      <BulkActions 
        selectedAssets={mockAssets} 
        onStatusChange={() => {}} 
      />
    );
    expect(screen.getByText('Change Status')).toBeInTheDocument();
  });

  it('shows status menu when change status button is clicked', () => {
    render(
      <BulkActions 
        selectedAssets={mockAssets} 
        onStatusChange={() => {}} 
      />
    );
    
    fireEvent.click(screen.getByText('Change Status'));
    
    expect(screen.getByText('In Stock')).toBeInTheDocument();
    expect(screen.getByText('Reserved')).toBeInTheDocument();
    expect(screen.getByText('Deployed')).toBeInTheDocument();
    expect(screen.getByText('In Maintenance')).toBeInTheDocument();
    expect(screen.getByText('Retired')).toBeInTheDocument();
  });

  it('calls onStatusChange with correct status when option is clicked', () => {
    const handleStatusChange = vi.fn();
    render(
      <BulkActions 
        selectedAssets={mockAssets} 
        onStatusChange={handleStatusChange} 
      />
    );
    
    fireEvent.click(screen.getByText('Change Status'));
    fireEvent.click(screen.getByText('Retired'));
    
    expect(handleStatusChange).toHaveBeenCalledWith(mockAssets, 'RETIRED');
  });

  it('disables buttons when disabled prop is true', () => {
    render(
      <BulkActions 
        selectedAssets={mockAssets} 
        onDelete={() => {}}
        onExport={() => {}}
        onStatusChange={() => {}}
        onClearSelection={() => {}}
        disabled
      />
    );
    
    expect(screen.getByText('Delete')).toBeDisabled();
    expect(screen.getByText('Export')).toBeDisabled();
    expect(screen.getByText('Change Status')).toBeDisabled();
    expect(screen.getByText('Clear selection')).toBeDisabled();
  });

  it('has accessible toolbar role', () => {
    render(
      <BulkActions 
        selectedAssets={mockAssets} 
        onDelete={() => {}}
      />
    );
    expect(screen.getByRole('toolbar', { name: 'Bulk actions' })).toBeInTheDocument();
  });

  it('has accessible aria-expanded on dropdown buttons', () => {
    render(
      <BulkActions 
        selectedAssets={mockAssets} 
        onExport={() => {}}
      />
    );
    
    const exportButton = screen.getByText('Export').closest('button');
    expect(exportButton).toHaveAttribute('aria-expanded', 'false');
    
    fireEvent.click(exportButton!);
    expect(exportButton).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('BulkActions - Requirements Validation', () => {
  /**
   * Validates Requirement 2.1: Bulk actions support
   */
  it('supports bulk delete action (Requirement 2.1)', () => {
    const handleDelete = vi.fn();
    render(
      <BulkActions 
        selectedAssets={mockAssets} 
        onDelete={handleDelete} 
      />
    );
    
    fireEvent.click(screen.getByText('Delete'));
    expect(handleDelete).toHaveBeenCalledWith(mockAssets);
  });

  /**
   * Validates Requirement 2.1: Bulk export action
   */
  it('supports bulk export action (Requirement 2.1)', () => {
    const handleExport = vi.fn();
    render(
      <BulkActions 
        selectedAssets={mockAssets} 
        onExport={handleExport} 
      />
    );
    
    fireEvent.click(screen.getByText('Export'));
    fireEvent.click(screen.getByText('Export as Excel'));
    
    expect(handleExport).toHaveBeenCalledWith(mockAssets, 'excel');
  });

  /**
   * Validates Requirement 2.1: Bulk status change action
   */
  it('supports bulk status change action (Requirement 2.1)', () => {
    const handleStatusChange = vi.fn();
    render(
      <BulkActions 
        selectedAssets={mockAssets} 
        onStatusChange={handleStatusChange} 
      />
    );
    
    fireEvent.click(screen.getByText('Change Status'));
    fireEvent.click(screen.getByText('In Maintenance'));
    
    expect(handleStatusChange).toHaveBeenCalledWith(mockAssets, 'IN_MAINTENANCE');
  });

  /**
   * Validates Requirement 2.1: Selection management
   */
  it('displays selection count and clear option (Requirement 2.1)', () => {
    const handleClear = vi.fn();
    render(
      <BulkActions 
        selectedAssets={mockAssets} 
        onClearSelection={handleClear} 
      />
    );
    
    expect(screen.getByText('2 assets selected')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Clear selection'));
    expect(handleClear).toHaveBeenCalled();
  });
});
