import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryFilter } from './CategoryFilter';
import type { CategoryInfo, CatalogCategory } from '../../types/service-catalog';

const mockCategories: CategoryInfo[] = [
  { id: 'LAPTOPS', name: 'Laptops', description: 'Portable computers', icon: 'laptop', itemCount: 5 },
  { id: 'DESKTOPS', name: 'Desktops', description: 'Desktop computers', icon: 'desktop', itemCount: 3 },
  { id: 'MONITORS', name: 'Monitors', description: 'Displays', icon: 'monitor', itemCount: 8 },
  { id: 'SOFTWARE', name: 'Software', description: 'Software licenses', icon: 'software', itemCount: 2 },
];

describe('CategoryFilter', () => {
  const defaultProps = {
    categories: mockCategories,
    selectedCategories: [] as CatalogCategory[],
    onCategoryChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title', () => {
    render(<CategoryFilter {...defaultProps} />);
    expect(screen.getByText('Categories')).toBeInTheDocument();
  });

  it('renders all categories', () => {
    render(<CategoryFilter {...defaultProps} />);
    expect(screen.getByText('Laptops')).toBeInTheDocument();
    expect(screen.getByText('Desktops')).toBeInTheDocument();
    expect(screen.getByText('Monitors')).toBeInTheDocument();
    expect(screen.getByText('Software')).toBeInTheDocument();
  });

  it('renders "All Items" option', () => {
    render(<CategoryFilter {...defaultProps} />);
    expect(screen.getByText('All Items')).toBeInTheDocument();
  });

  it('displays item counts for each category', () => {
    render(<CategoryFilter {...defaultProps} />);
    expect(screen.getByText('5')).toBeInTheDocument(); // Laptops
    expect(screen.getByText('3')).toBeInTheDocument(); // Desktops
    expect(screen.getByText('8')).toBeInTheDocument(); // Monitors
    expect(screen.getByText('2')).toBeInTheDocument(); // Software
  });

  it('displays total item count for All Items', () => {
    render(<CategoryFilter {...defaultProps} />);
    // Total: 5 + 3 + 8 + 2 = 18
    expect(screen.getByText('18')).toBeInTheDocument();
  });

  it('calls onCategoryChange when category is clicked', () => {
    const handleChange = vi.fn();
    render(<CategoryFilter {...defaultProps} onCategoryChange={handleChange} />);
    
    fireEvent.click(screen.getByText('Laptops'));
    
    expect(handleChange).toHaveBeenCalledWith(['LAPTOPS']);
  });

  it('adds category to selection when clicked', () => {
    const handleChange = vi.fn();
    const propsWithSelection = {
      ...defaultProps,
      selectedCategories: ['DESKTOPS'] as CatalogCategory[],
      onCategoryChange: handleChange,
    };
    render(<CategoryFilter {...propsWithSelection} />);
    
    fireEvent.click(screen.getByText('Laptops'));
    
    expect(handleChange).toHaveBeenCalledWith(['DESKTOPS', 'LAPTOPS']);
  });

  it('removes category from selection when already selected', () => {
    const handleChange = vi.fn();
    const propsWithSelection = {
      ...defaultProps,
      selectedCategories: ['LAPTOPS'] as CatalogCategory[],
      onCategoryChange: handleChange,
    };
    render(<CategoryFilter {...propsWithSelection} />);
    
    fireEvent.click(screen.getByText('Laptops'));
    
    expect(handleChange).toHaveBeenCalledWith([]);
  });

  it('clears selection when All Items is clicked', () => {
    const handleChange = vi.fn();
    const propsWithSelection = {
      ...defaultProps,
      selectedCategories: ['LAPTOPS', 'DESKTOPS'] as CatalogCategory[],
      onCategoryChange: handleChange,
    };
    render(<CategoryFilter {...propsWithSelection} />);
    
    fireEvent.click(screen.getByText('All Items'));
    
    expect(handleChange).toHaveBeenCalledWith([]);
  });

  it('shows clear button when categories are selected', () => {
    const propsWithSelection = {
      ...defaultProps,
      selectedCategories: ['LAPTOPS'] as CatalogCategory[],
    };
    render(<CategoryFilter {...propsWithSelection} />);
    
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('does not show clear button when no categories selected', () => {
    render(<CategoryFilter {...defaultProps} />);
    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
  });

  it('clears selection when clear button is clicked', () => {
    const handleChange = vi.fn();
    const propsWithSelection = {
      ...defaultProps,
      selectedCategories: ['LAPTOPS'] as CatalogCategory[],
      onCategoryChange: handleChange,
    };
    render(<CategoryFilter {...propsWithSelection} />);
    
    fireEvent.click(screen.getByText('Clear'));
    
    expect(handleChange).toHaveBeenCalledWith([]);
  });

  it('marks All Items as active when no categories selected', () => {
    render(<CategoryFilter {...defaultProps} />);
    
    const allItemsButton = screen.getByRole('option', { name: /All Items/ });
    expect(allItemsButton).toHaveAttribute('aria-selected', 'true');
  });

  it('marks selected category as active', () => {
    const propsWithSelection = {
      ...defaultProps,
      selectedCategories: ['LAPTOPS'] as CatalogCategory[],
    };
    render(<CategoryFilter {...propsWithSelection} />);
    
    const laptopsButton = screen.getByRole('option', { name: /Laptops/ });
    expect(laptopsButton).toHaveAttribute('aria-selected', 'true');
  });

  it('renders in sidebar layout by default', () => {
    const { container } = render(<CategoryFilter {...defaultProps} />);
    const nav = container.querySelector('nav');
    expect(nav).toBeInTheDocument();
    expect(nav?.className).toMatch(/sidebar/);
  });

  it('renders in horizontal layout when specified', () => {
    const { container } = render(<CategoryFilter {...defaultProps} layout="horizontal" />);
    const nav = container.querySelector('nav');
    expect(nav).toBeInTheDocument();
    expect(nav?.className).toMatch(/horizontal/);
  });

  it('shows loading skeleton when loading', () => {
    const { container } = render(<CategoryFilter {...defaultProps} isLoading />);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('has accessible navigation role', () => {
    render(<CategoryFilter {...defaultProps} />);
    expect(screen.getByRole('navigation', { name: 'Category filter' })).toBeInTheDocument();
  });

  it('has accessible listbox role', () => {
    render(<CategoryFilter {...defaultProps} />);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});

describe('CategoryFilter - Requirements Validation', () => {
  /**
   * Validates Requirement 6B.2: Service catalog shall support categories
   */
  it('supports category navigation (Requirement 6B.2)', () => {
    const handleChange = vi.fn();
    render(
      <CategoryFilter
        categories={mockCategories}
        selectedCategories={[]}
        onCategoryChange={handleChange}
      />
    );
    
    // Verify categories are displayed
    expect(screen.getByText('Laptops')).toBeInTheDocument();
    expect(screen.getByText('Desktops')).toBeInTheDocument();
    
    // Verify category selection works
    fireEvent.click(screen.getByText('Laptops'));
    expect(handleChange).toHaveBeenCalledWith(['LAPTOPS']);
  });

  /**
   * Validates Requirement 6B.2: Categories show item counts
   */
  it('displays item counts per category (Requirement 6B.2)', () => {
    render(
      <CategoryFilter
        categories={mockCategories}
        selectedCategories={[]}
        onCategoryChange={vi.fn()}
      />
    );
    
    // Verify item counts are displayed
    expect(screen.getByText('5')).toBeInTheDocument(); // Laptops count
    expect(screen.getByText('18')).toBeInTheDocument(); // Total count
  });
});
