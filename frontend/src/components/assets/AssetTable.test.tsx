import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetTable } from './AssetTable';
import type { ColumnConfig } from './ColumnSelector';
import type { Asset } from '../../types/asset';

const mockAssets: Asset[] = [
  {
    assetId: 'asset-001',
    assetTag: 'AMS-HW-20250101-0001',
    assetType: 'HARDWARE',
    displayName: 'Dell Latitude 5540',
    description: 'Laptop for development',
    status: 'DEPLOYED',
    createdAt: '2025-01-01T10:00:00Z',
    updatedAt: '2025-01-15T14:30:00Z',
  },
  {
    assetId: 'asset-002',
    assetTag: 'AMS-SW-20250102-0002',
    assetType: 'SOFTWARE',
    displayName: 'Microsoft Office 365',
    description: 'Office suite license',
    status: 'IN_STOCK',
    createdAt: '2025-01-02T09:00:00Z',
    updatedAt: '2025-01-02T09:00:00Z',
  },
];

const defaultColumns: ColumnConfig[] = [
  { id: 'assetTag', label: 'Asset Tag', visible: true, sortable: true },
  { id: 'displayName', label: 'Name', visible: true, sortable: true },
  { id: 'assetType', label: 'Type', visible: true, sortable: true },
  { id: 'status', label: 'Status', visible: true, sortable: true },
  { id: 'createdAt', label: 'Created', visible: true, sortable: true },
];

describe('AssetTable', () => {
  it('renders table headers', () => {
    render(
      <AssetTable
        assets={mockAssets}
        columns={defaultColumns}
        sortConfig={null}
        onSortChange={() => {}}
        selectedIds={new Set()}
        onSelectionChange={() => {}}
      />
    );
    
    expect(screen.getByText('Asset Tag')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders asset rows', () => {
    render(
      <AssetTable
        assets={mockAssets}
        columns={defaultColumns}
        sortConfig={null}
        onSortChange={() => {}}
        selectedIds={new Set()}
        onSelectionChange={() => {}}
      />
    );
    
    expect(screen.getByText('Dell Latitude 5540')).toBeInTheDocument();
    expect(screen.getByText('Microsoft Office 365')).toBeInTheDocument();
  });

  it('renders asset tags', () => {
    render(
      <AssetTable
        assets={mockAssets}
        columns={defaultColumns}
        sortConfig={null}
        onSortChange={() => {}}
        selectedIds={new Set()}
        onSelectionChange={() => {}}
      />
    );
    
    expect(screen.getByText('AMS-HW-20250101-0001')).toBeInTheDocument();
    expect(screen.getByText('AMS-SW-20250102-0002')).toBeInTheDocument();
  });

  it('renders asset type badges', () => {
    render(
      <AssetTable
        assets={mockAssets}
        columns={defaultColumns}
        sortConfig={null}
        onSortChange={() => {}}
        selectedIds={new Set()}
        onSelectionChange={() => {}}
      />
    );
    
    expect(screen.getByText('Hardware')).toBeInTheDocument();
    expect(screen.getByText('Software')).toBeInTheDocument();
  });

  it('renders status badges', () => {
    render(
      <AssetTable
        assets={mockAssets}
        columns={defaultColumns}
        sortConfig={null}
        onSortChange={() => {}}
        selectedIds={new Set()}
        onSelectionChange={() => {}}
      />
    );
    
    expect(screen.getByText('Deployed')).toBeInTheDocument();
    expect(screen.getByText('In Stock')).toBeInTheDocument();
  });

  it('only renders visible columns', () => {
    const columnsWithHidden: ColumnConfig[] = [
      { id: 'assetTag', label: 'Asset Tag', visible: true, sortable: true },
      { id: 'displayName', label: 'Name', visible: false, sortable: true },
      { id: 'status', label: 'Status', visible: true, sortable: true },
    ];
    
    render(
      <AssetTable
        assets={mockAssets}
        columns={columnsWithHidden}
        sortConfig={null}
        onSortChange={() => {}}
        selectedIds={new Set()}
        onSelectionChange={() => {}}
      />
    );
    
    expect(screen.getByText('Asset Tag')).toBeInTheDocument();
    expect(screen.queryByText('Name')).not.toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('calls onSortChange when sortable header is clicked', () => {
    const handleSort = vi.fn();
    render(
      <AssetTable
        assets={mockAssets}
        columns={defaultColumns}
        sortConfig={null}
        onSortChange={handleSort}
        selectedIds={new Set()}
        onSelectionChange={() => {}}
      />
    );
    
    fireEvent.click(screen.getByText('Name'));
    
    expect(handleSort).toHaveBeenCalledWith({
      column: 'displayName',
      direction: 'asc',
    });
  });

  it('toggles sort direction when same column is clicked', () => {
    const handleSort = vi.fn();
    render(
      <AssetTable
        assets={mockAssets}
        columns={defaultColumns}
        sortConfig={{ column: 'displayName', direction: 'asc' }}
        onSortChange={handleSort}
        selectedIds={new Set()}
        onSelectionChange={() => {}}
      />
    );
    
    fireEvent.click(screen.getByText('Name'));
    
    expect(handleSort).toHaveBeenCalledWith({
      column: 'displayName',
      direction: 'desc',
    });
  });

  it('renders select all checkbox', () => {
    render(
      <AssetTable
        assets={mockAssets}
        columns={defaultColumns}
        sortConfig={null}
        onSortChange={() => {}}
        selectedIds={new Set()}
        onSelectionChange={() => {}}
      />
    );
    
    expect(screen.getByLabelText('Select all assets')).toBeInTheDocument();
  });

  it('selects all assets when select all is clicked', () => {
    const handleSelection = vi.fn();
    render(
      <AssetTable
        assets={mockAssets}
        columns={defaultColumns}
        sortConfig={null}
        onSortChange={() => {}}
        selectedIds={new Set()}
        onSelectionChange={handleSelection}
      />
    );
    
    fireEvent.click(screen.getByLabelText('Select all assets'));
    
    expect(handleSelection).toHaveBeenCalledWith(
      new Set(['asset-001', 'asset-002'])
    );
  });

  it('deselects all when all are selected and select all is clicked', () => {
    const handleSelection = vi.fn();
    render(
      <AssetTable
        assets={mockAssets}
        columns={defaultColumns}
        sortConfig={null}
        onSortChange={() => {}}
        selectedIds={new Set(['asset-001', 'asset-002'])}
        onSelectionChange={handleSelection}
      />
    );
    
    fireEvent.click(screen.getByLabelText('Deselect all assets'));
    
    expect(handleSelection).toHaveBeenCalledWith(new Set());
  });

  it('selects individual asset when row checkbox is clicked', () => {
    const handleSelection = vi.fn();
    render(
      <AssetTable
        assets={mockAssets}
        columns={defaultColumns}
        sortConfig={null}
        onSortChange={() => {}}
        selectedIds={new Set()}
        onSelectionChange={handleSelection}
      />
    );
    
    fireEvent.click(screen.getByLabelText('Select Dell Latitude 5540'));
    
    expect(handleSelection).toHaveBeenCalledWith(new Set(['asset-001']));
  });

  it('calls onAssetClick when row is clicked', () => {
    const handleClick = vi.fn();
    render(
      <AssetTable
        assets={mockAssets}
        columns={defaultColumns}
        sortConfig={null}
        onSortChange={() => {}}
        selectedIds={new Set()}
        onSelectionChange={() => {}}
        onAssetClick={handleClick}
      />
    );
    
    fireEvent.click(screen.getByText('Dell Latitude 5540'));
    
    expect(handleClick).toHaveBeenCalledWith(mockAssets[0]);
  });

  it('shows loading state', () => {
    render(
      <AssetTable
        assets={[]}
        columns={defaultColumns}
        sortConfig={null}
        onSortChange={() => {}}
        selectedIds={new Set()}
        onSelectionChange={() => {}}
        isLoading
      />
    );
    
    expect(screen.getByRole('table', { busy: true })).toBeInTheDocument();
  });

  it('shows empty state when no assets', () => {
    render(
      <AssetTable
        assets={[]}
        columns={defaultColumns}
        sortConfig={null}
        onSortChange={() => {}}
        selectedIds={new Set()}
        onSelectionChange={() => {}}
      />
    );
    
    expect(screen.getByText('No assets found')).toBeInTheDocument();
  });

  it('has accessible aria-sort attribute on sorted column', () => {
    render(
      <AssetTable
        assets={mockAssets}
        columns={defaultColumns}
        sortConfig={{ column: 'displayName', direction: 'asc' }}
        onSortChange={() => {}}
        selectedIds={new Set()}
        onSelectionChange={() => {}}
      />
    );
    
    const nameHeader = screen.getByText('Name').closest('th');
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
  });
});

describe('AssetTable - Requirements Validation', () => {
  /**
   * Validates Requirement 2.1: Sortable asset list
   */
  it('supports sorting by columns (Requirement 2.1)', () => {
    const handleSort = vi.fn();
    render(
      <AssetTable
        assets={mockAssets}
        columns={defaultColumns}
        sortConfig={null}
        onSortChange={handleSort}
        selectedIds={new Set()}
        onSelectionChange={() => {}}
      />
    );
    
    // Verify sortable columns can be clicked
    fireEvent.click(screen.getByText('Name'));
    expect(handleSort).toHaveBeenCalled();
    
    fireEvent.click(screen.getByText('Created'));
    expect(handleSort).toHaveBeenCalledTimes(2);
  });

  /**
   * Validates Requirement 2.1: Asset selection for bulk actions
   */
  it('supports asset selection for bulk actions (Requirement 2.1)', () => {
    const handleSelection = vi.fn();
    render(
      <AssetTable
        assets={mockAssets}
        columns={defaultColumns}
        sortConfig={null}
        onSortChange={() => {}}
        selectedIds={new Set()}
        onSelectionChange={handleSelection}
      />
    );
    
    // Verify individual selection
    fireEvent.click(screen.getByLabelText('Select Dell Latitude 5540'));
    expect(handleSelection).toHaveBeenCalled();
    
    // Verify select all
    fireEvent.click(screen.getByLabelText('Select all assets'));
    expect(handleSelection).toHaveBeenCalledTimes(2);
  });

  /**
   * Validates Requirement 2.1: Display asset information
   */
  it('displays comprehensive asset information (Requirement 2.1)', () => {
    render(
      <AssetTable
        assets={mockAssets}
        columns={defaultColumns}
        sortConfig={null}
        onSortChange={() => {}}
        selectedIds={new Set()}
        onSelectionChange={() => {}}
      />
    );
    
    // Verify asset tag is displayed
    expect(screen.getByText('AMS-HW-20250101-0001')).toBeInTheDocument();
    
    // Verify asset name is displayed
    expect(screen.getByText('Dell Latitude 5540')).toBeInTheDocument();
    
    // Verify asset type is displayed
    expect(screen.getByText('Hardware')).toBeInTheDocument();
    
    // Verify status is displayed
    expect(screen.getByText('Deployed')).toBeInTheDocument();
  });
});
