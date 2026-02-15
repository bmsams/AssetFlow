import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetFilters } from './AssetFilters';
import type { AssetFiltersState } from './AssetFilters';

const defaultFilters: AssetFiltersState = {
  search: '',
  types: [],
  statuses: [],
};

describe('AssetFilters', () => {
  it('renders search input', () => {
    render(<AssetFilters filters={defaultFilters} onFiltersChange={() => {}} />);
    expect(screen.getByLabelText('Search assets')).toBeInTheDocument();
  });

  it('renders type filter chips', () => {
    render(<AssetFilters filters={defaultFilters} onFiltersChange={() => {}} />);
    expect(screen.getByText('Hardware')).toBeInTheDocument();
    expect(screen.getByText('Software')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  it('renders status filter chips', () => {
    render(<AssetFilters filters={defaultFilters} onFiltersChange={() => {}} />);
    expect(screen.getByText('Ordered')).toBeInTheDocument();
    expect(screen.getByText('Deployed')).toBeInTheDocument();
    expect(screen.getByText('In Stock')).toBeInTheDocument();
  });

  it('calls onFiltersChange when search input changes', () => {
    const handleChange = vi.fn();
    render(<AssetFilters filters={defaultFilters} onFiltersChange={handleChange} />);
    
    const searchInput = screen.getByLabelText('Search assets');
    fireEvent.change(searchInput, { target: { value: 'laptop' } });
    
    expect(handleChange).toHaveBeenCalledWith({
      ...defaultFilters,
      search: 'laptop',
    });
  });

  it('calls onFiltersChange when type chip is clicked', () => {
    const handleChange = vi.fn();
    render(<AssetFilters filters={defaultFilters} onFiltersChange={handleChange} />);
    
    fireEvent.click(screen.getByText('Hardware'));
    
    expect(handleChange).toHaveBeenCalledWith({
      ...defaultFilters,
      types: ['HARDWARE'],
    });
  });

  it('removes type from filter when active chip is clicked', () => {
    const handleChange = vi.fn();
    const filtersWithType: AssetFiltersState = {
      ...defaultFilters,
      types: ['HARDWARE'],
    };
    render(<AssetFilters filters={filtersWithType} onFiltersChange={handleChange} />);
    
    fireEvent.click(screen.getByText('Hardware'));
    
    expect(handleChange).toHaveBeenCalledWith({
      ...defaultFilters,
      types: [],
    });
  });

  it('calls onFiltersChange when status chip is clicked', () => {
    const handleChange = vi.fn();
    render(<AssetFilters filters={defaultFilters} onFiltersChange={handleChange} />);
    
    fireEvent.click(screen.getByText('Deployed'));
    
    expect(handleChange).toHaveBeenCalledWith({
      ...defaultFilters,
      statuses: ['DEPLOYED'],
    });
  });

  it('shows clear all filters button when filters are active', () => {
    const filtersWithSearch: AssetFiltersState = {
      search: 'test',
      types: [],
      statuses: [],
    };
    render(<AssetFilters filters={filtersWithSearch} onFiltersChange={() => {}} />);
    
    expect(screen.getByText('Clear all filters')).toBeInTheDocument();
  });

  it('does not show clear all filters button when no filters are active', () => {
    render(<AssetFilters filters={defaultFilters} onFiltersChange={() => {}} />);
    
    expect(screen.queryByText('Clear all filters')).not.toBeInTheDocument();
  });

  it('clears all filters when clear button is clicked', () => {
    const handleChange = vi.fn();
    const activeFilters: AssetFiltersState = {
      search: 'test',
      types: ['HARDWARE'],
      statuses: ['DEPLOYED'],
    };
    render(<AssetFilters filters={activeFilters} onFiltersChange={handleChange} />);
    
    fireEvent.click(screen.getByText('Clear all filters'));
    
    expect(handleChange).toHaveBeenCalledWith({
      search: '',
      types: [],
      statuses: [],
    });
  });

  it('disables inputs when isLoading is true', () => {
    render(<AssetFilters filters={defaultFilters} onFiltersChange={() => {}} isLoading />);
    
    expect(screen.getByLabelText('Search assets')).toBeDisabled();
    expect(screen.getByText('Hardware')).toBeDisabled();
  });

  it('shows clear search button when search has value', () => {
    const filtersWithSearch: AssetFiltersState = {
      search: 'test',
      types: [],
      statuses: [],
    };
    render(<AssetFilters filters={filtersWithSearch} onFiltersChange={() => {}} />);
    
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('clears search when clear search button is clicked', () => {
    const handleChange = vi.fn();
    const filtersWithSearch: AssetFiltersState = {
      search: 'test',
      types: ['HARDWARE'],
      statuses: [],
    };
    render(<AssetFilters filters={filtersWithSearch} onFiltersChange={handleChange} />);
    
    fireEvent.click(screen.getByLabelText('Clear search'));
    
    expect(handleChange).toHaveBeenCalledWith({
      search: '',
      types: ['HARDWARE'],
      statuses: [],
    });
  });

  it('has accessible filter group labels', () => {
    render(<AssetFilters filters={defaultFilters} onFiltersChange={() => {}} />);
    
    expect(screen.getByRole('group', { name: 'Filter by asset type' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Filter by asset status' })).toBeInTheDocument();
  });

  it('marks active chips with aria-pressed', () => {
    const filtersWithType: AssetFiltersState = {
      ...defaultFilters,
      types: ['HARDWARE'],
    };
    render(<AssetFilters filters={filtersWithType} onFiltersChange={() => {}} />);
    
    expect(screen.getByText('Hardware')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Software')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('AssetFilters - Requirements Validation', () => {
  /**
   * Validates Requirement 2.1: Asset filtering capabilities
   */
  it('supports filtering by asset type (Requirement 2.1)', () => {
    const handleChange = vi.fn();
    render(<AssetFilters filters={defaultFilters} onFiltersChange={handleChange} />);
    
    // Verify all asset types are available for filtering
    expect(screen.getByText('Hardware')).toBeInTheDocument();
    expect(screen.getByText('Software')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
    
    // Verify clicking a type triggers filter change
    fireEvent.click(screen.getByText('Hardware'));
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({
      types: ['HARDWARE'],
    }));
  });

  /**
   * Validates Requirement 2.1: Asset filtering by status
   */
  it('supports filtering by asset status (Requirement 2.1)', () => {
    const handleChange = vi.fn();
    render(<AssetFilters filters={defaultFilters} onFiltersChange={handleChange} />);
    
    // Verify all lifecycle statuses are available
    expect(screen.getByText('Ordered')).toBeInTheDocument();
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByText('In Stock')).toBeInTheDocument();
    expect(screen.getByText('Reserved')).toBeInTheDocument();
    expect(screen.getByText('Deployed')).toBeInTheDocument();
    expect(screen.getByText('In Maintenance')).toBeInTheDocument();
    expect(screen.getByText('Retired')).toBeInTheDocument();
    expect(screen.getByText('Disposed')).toBeInTheDocument();
  });

  /**
   * Validates Requirement 2.1: Search functionality
   */
  it('supports search by name, tag, or description (Requirement 2.1)', () => {
    const handleChange = vi.fn();
    render(<AssetFilters filters={defaultFilters} onFiltersChange={handleChange} />);
    
    const searchInput = screen.getByPlaceholderText(/Search assets by name, tag, or description/);
    expect(searchInput).toBeInTheDocument();
    
    fireEvent.change(searchInput, { target: { value: 'laptop' } });
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({
      search: 'laptop',
    }));
  });
});
