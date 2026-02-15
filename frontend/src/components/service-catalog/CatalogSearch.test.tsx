import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogSearch } from './CatalogSearch';
import type { CatalogFilters } from '../../types/service-catalog';
import { defaultCatalogFilters } from '../../types/service-catalog';

describe('CatalogSearch', () => {
  const defaultProps = {
    filters: defaultCatalogFilters,
    onFiltersChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search input', () => {
    render(<CatalogSearch {...defaultProps} />);
    expect(screen.getByLabelText('Search catalog')).toBeInTheDocument();
  });

  it('renders category filter chips', () => {
    render(<CatalogSearch {...defaultProps} />);
    expect(screen.getByText('Laptops')).toBeInTheDocument();
    expect(screen.getByText('Desktops')).toBeInTheDocument();
    expect(screen.getByText('Monitors')).toBeInTheDocument();
    expect(screen.getByText('Software')).toBeInTheDocument();
  });

  it('renders availability filter chips', () => {
    render(<CatalogSearch {...defaultProps} />);
    expect(screen.getByText('In Stock')).toBeInTheDocument();
    expect(screen.getByText('Low Stock')).toBeInTheDocument();
    expect(screen.getByText('Backordered')).toBeInTheDocument();
  });

  it('renders in stock only checkbox', () => {
    render(<CatalogSearch {...defaultProps} />);
    expect(screen.getByLabelText(/In stock only/)).toBeInTheDocument();
  });

  it('calls onFiltersChange when search input changes', () => {
    const handleChange = vi.fn();
    render(<CatalogSearch {...defaultProps} onFiltersChange={handleChange} />);
    
    const searchInput = screen.getByLabelText('Search catalog');
    fireEvent.change(searchInput, { target: { value: 'MacBook' } });
    
    expect(handleChange).toHaveBeenCalledWith({
      ...defaultCatalogFilters,
      search: 'MacBook',
    });
  });

  it('calls onFiltersChange when category chip is clicked', () => {
    const handleChange = vi.fn();
    render(<CatalogSearch {...defaultProps} onFiltersChange={handleChange} />);
    
    fireEvent.click(screen.getByText('Laptops'));
    
    expect(handleChange).toHaveBeenCalledWith({
      ...defaultCatalogFilters,
      categories: ['LAPTOPS'],
    });
  });

  it('removes category when already selected category is clicked', () => {
    const handleChange = vi.fn();
    const filtersWithCategory: CatalogFilters = {
      ...defaultCatalogFilters,
      categories: ['LAPTOPS'],
    };
    render(<CatalogSearch {...defaultProps} filters={filtersWithCategory} onFiltersChange={handleChange} />);
    
    fireEvent.click(screen.getByText('Laptops'));
    
    expect(handleChange).toHaveBeenCalledWith({
      ...defaultCatalogFilters,
      categories: [],
    });
  });

  it('calls onFiltersChange when availability chip is clicked', () => {
    const handleChange = vi.fn();
    render(<CatalogSearch {...defaultProps} onFiltersChange={handleChange} />);
    
    fireEvent.click(screen.getByText('In Stock'));
    
    expect(handleChange).toHaveBeenCalledWith({
      ...defaultCatalogFilters,
      availability: ['IN_STOCK'],
    });
  });

  it('calls onFiltersChange when in stock only checkbox is toggled', () => {
    const handleChange = vi.fn();
    render(<CatalogSearch {...defaultProps} onFiltersChange={handleChange} />);
    
    fireEvent.click(screen.getByLabelText(/In stock only/));
    
    expect(handleChange).toHaveBeenCalledWith({
      ...defaultCatalogFilters,
      inStockOnly: true,
    });
  });

  it('shows clear search button when search has value', () => {
    const filtersWithSearch: CatalogFilters = {
      ...defaultCatalogFilters,
      search: 'test',
    };
    render(<CatalogSearch {...defaultProps} filters={filtersWithSearch} />);
    
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('clears search when clear search button is clicked', () => {
    const handleChange = vi.fn();
    const filtersWithSearch: CatalogFilters = {
      ...defaultCatalogFilters,
      search: 'test',
    };
    render(<CatalogSearch {...defaultProps} filters={filtersWithSearch} onFiltersChange={handleChange} />);
    
    fireEvent.click(screen.getByLabelText('Clear search'));
    
    expect(handleChange).toHaveBeenCalledWith({
      ...defaultCatalogFilters,
      search: '',
    });
  });

  it('shows clear all filters button when filters are active', () => {
    const filtersWithCategory: CatalogFilters = {
      ...defaultCatalogFilters,
      categories: ['LAPTOPS'],
    };
    render(<CatalogSearch {...defaultProps} filters={filtersWithCategory} />);
    
    expect(screen.getByText('Clear all filters')).toBeInTheDocument();
  });

  it('clears all filters when clear all button is clicked', () => {
    const handleChange = vi.fn();
    const activeFilters: CatalogFilters = {
      search: 'test',
      categories: ['LAPTOPS'],
      availability: ['IN_STOCK'],
      priceRange: { min: 100, max: 1000 },
      inStockOnly: true,
    };
    render(<CatalogSearch {...defaultProps} filters={activeFilters} onFiltersChange={handleChange} />);
    
    fireEvent.click(screen.getByText('Clear all filters'));
    
    expect(handleChange).toHaveBeenCalledWith(defaultCatalogFilters);
  });

  it('displays results count when provided', () => {
    render(<CatalogSearch {...defaultProps} resultsCount={42} />);
    expect(screen.getByText('42 items found')).toBeInTheDocument();
  });

  it('displays singular item text for single result', () => {
    render(<CatalogSearch {...defaultProps} resultsCount={1} />);
    expect(screen.getByText('1 item found')).toBeInTheDocument();
  });

  it('disables inputs when loading', () => {
    render(<CatalogSearch {...defaultProps} isLoading />);
    
    expect(screen.getByLabelText('Search catalog')).toBeDisabled();
    expect(screen.getByText('Laptops')).toBeDisabled();
  });

  it('has accessible search role', () => {
    render(<CatalogSearch {...defaultProps} />);
    expect(screen.getByRole('search')).toBeInTheDocument();
  });

  it('has accessible filter groups', () => {
    render(<CatalogSearch {...defaultProps} />);
    expect(screen.getByRole('group', { name: 'Filter by category' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Filter by availability' })).toBeInTheDocument();
  });
});

describe('CatalogSearch - Requirements Validation', () => {
  /**
   * Validates Requirement 6B.2: Service catalog shall support search functionality
   */
  it('supports search functionality (Requirement 6B.2)', () => {
    const handleChange = vi.fn();
    render(<CatalogSearch filters={defaultCatalogFilters} onFiltersChange={handleChange} />);
    
    const searchInput = screen.getByLabelText('Search catalog');
    fireEvent.change(searchInput, { target: { value: 'laptop' } });
    
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'laptop' })
    );
  });

  /**
   * Validates Requirement 6B.2: Service catalog shall support categories
   */
  it('supports category filtering (Requirement 6B.2)', () => {
    const handleChange = vi.fn();
    render(<CatalogSearch filters={defaultCatalogFilters} onFiltersChange={handleChange} />);
    
    // Click on a category
    fireEvent.click(screen.getByText('Laptops'));
    
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ categories: ['LAPTOPS'] })
    );
  });
});
