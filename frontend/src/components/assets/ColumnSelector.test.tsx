import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColumnSelector } from './ColumnSelector';
import type { ColumnConfig } from './ColumnSelector';

const mockColumns: ColumnConfig[] = [
  { id: 'assetTag', label: 'Asset Tag', visible: true, sortable: true },
  { id: 'displayName', label: 'Name', visible: true, sortable: true },
  { id: 'assetType', label: 'Type', visible: true, sortable: true },
  { id: 'status', label: 'Status', visible: false, sortable: true },
  { id: 'createdAt', label: 'Created', visible: false, sortable: true },
];

describe('ColumnSelector', () => {
  it('renders toggle button', () => {
    render(<ColumnSelector columns={mockColumns} onColumnsChange={() => {}} />);
    expect(screen.getByText('Columns')).toBeInTheDocument();
  });

  it('shows visible column count in badge', () => {
    render(<ColumnSelector columns={mockColumns} onColumnsChange={() => {}} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('opens dropdown when button is clicked', () => {
    render(<ColumnSelector columns={mockColumns} onColumnsChange={() => {}} />);
    
    fireEvent.click(screen.getByText('Columns'));
    
    expect(screen.getByText('Show/Hide Columns')).toBeInTheDocument();
  });

  it('shows all column options in dropdown', () => {
    render(<ColumnSelector columns={mockColumns} onColumnsChange={() => {}} />);
    
    fireEvent.click(screen.getByText('Columns'));
    
    expect(screen.getByText('Asset Tag')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
  });

  it('shows checkboxes with correct checked state', () => {
    render(<ColumnSelector columns={mockColumns} onColumnsChange={() => {}} />);
    
    fireEvent.click(screen.getByText('Columns'));
    
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked(); // Asset Tag
    expect(checkboxes[1]).toBeChecked(); // Name
    expect(checkboxes[2]).toBeChecked(); // Type
    expect(checkboxes[3]).not.toBeChecked(); // Status
    expect(checkboxes[4]).not.toBeChecked(); // Created
  });

  it('calls onColumnsChange when column visibility is toggled', () => {
    const handleChange = vi.fn();
    render(<ColumnSelector columns={mockColumns} onColumnsChange={handleChange} />);
    
    fireEvent.click(screen.getByText('Columns'));
    
    const statusCheckbox = screen.getAllByRole('checkbox')[3];
    fireEvent.click(statusCheckbox);
    
    expect(handleChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'status', visible: true }),
      ])
    );
  });

  it('hides column when visible column checkbox is clicked', () => {
    const handleChange = vi.fn();
    render(<ColumnSelector columns={mockColumns} onColumnsChange={handleChange} />);
    
    fireEvent.click(screen.getByText('Columns'));
    
    const assetTagCheckbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(assetTagCheckbox);
    
    expect(handleChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'assetTag', visible: false }),
      ])
    );
  });

  it('shows all columns when Show All is clicked', () => {
    const handleChange = vi.fn();
    render(<ColumnSelector columns={mockColumns} onColumnsChange={handleChange} />);
    
    fireEvent.click(screen.getByText('Columns'));
    fireEvent.click(screen.getByText('Show All'));
    
    expect(handleChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'assetTag', visible: true }),
        expect.objectContaining({ id: 'displayName', visible: true }),
        expect.objectContaining({ id: 'assetType', visible: true }),
        expect.objectContaining({ id: 'status', visible: true }),
        expect.objectContaining({ id: 'createdAt', visible: true }),
      ])
    );
  });

  it('hides all columns except first when Hide All is clicked', () => {
    const handleChange = vi.fn();
    render(<ColumnSelector columns={mockColumns} onColumnsChange={handleChange} />);
    
    fireEvent.click(screen.getByText('Columns'));
    fireEvent.click(screen.getByText('Hide All'));
    
    expect(handleChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'assetTag', visible: true }), // First column stays visible
        expect.objectContaining({ id: 'displayName', visible: false }),
        expect.objectContaining({ id: 'assetType', visible: false }),
        expect.objectContaining({ id: 'status', visible: false }),
        expect.objectContaining({ id: 'createdAt', visible: false }),
      ])
    );
  });

  it('closes dropdown when clicking outside', () => {
    render(
      <div>
        <ColumnSelector columns={mockColumns} onColumnsChange={() => {}} />
        <button type="button">Outside</button>
      </div>
    );
    
    fireEvent.click(screen.getByText('Columns'));
    expect(screen.getByText('Show/Hide Columns')).toBeInTheDocument();
    
    fireEvent.mouseDown(screen.getByText('Outside'));
    expect(screen.queryByText('Show/Hide Columns')).not.toBeInTheDocument();
  });

  it('disables button when disabled prop is true', () => {
    render(<ColumnSelector columns={mockColumns} onColumnsChange={() => {}} disabled />);
    expect(screen.getByText('Columns').closest('button')).toBeDisabled();
  });

  it('has accessible aria attributes', () => {
    render(<ColumnSelector columns={mockColumns} onColumnsChange={() => {}} />);
    
    const button = screen.getByText('Columns').closest('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-haspopup', 'true');
    
    fireEvent.click(button!);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('ColumnSelector - Requirements Validation', () => {
  /**
   * Validates Requirement 2.1: Column customization
   */
  it('supports column visibility customization (Requirement 2.1)', () => {
    const handleChange = vi.fn();
    render(<ColumnSelector columns={mockColumns} onColumnsChange={handleChange} />);
    
    // Open dropdown
    fireEvent.click(screen.getByText('Columns'));
    
    // Verify all columns are listed
    expect(screen.getByText('Asset Tag')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    
    // Toggle a column
    const statusCheckbox = screen.getAllByRole('checkbox')[3];
    fireEvent.click(statusCheckbox);
    
    expect(handleChange).toHaveBeenCalled();
  });

  /**
   * Validates Requirement 2.1: Bulk column operations
   */
  it('supports bulk show/hide operations (Requirement 2.1)', () => {
    const handleChange = vi.fn();
    render(<ColumnSelector columns={mockColumns} onColumnsChange={handleChange} />);
    
    fireEvent.click(screen.getByText('Columns'));
    
    // Verify Show All and Hide All buttons exist
    expect(screen.getByText('Show All')).toBeInTheDocument();
    expect(screen.getByText('Hide All')).toBeInTheDocument();
    
    // Test Show All
    fireEvent.click(screen.getByText('Show All'));
    expect(handleChange).toHaveBeenCalled();
  });
});
