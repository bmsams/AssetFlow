import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CatalogItem } from './CatalogItem';
import type { CatalogItem as CatalogItemType } from '../../types/service-catalog';

const mockItem: CatalogItemType = {
  itemId: 'cat-001',
  name: 'MacBook Pro 16" M3 Max',
  description: 'High-performance laptop for developers and creative professionals.',
  category: 'LAPTOPS',
  manufacturer: 'Apple',
  model: 'MacBook Pro 16" (2024)',
  imageUrl: '/images/catalog/macbook-pro-16.jpg',
  price: 3499,
  availability: 'IN_STOCK',
  stockQuantity: 15,
  leadTimeDays: 0,
  specifications: {
    'Processor': 'Apple M3 Max',
    'Memory': '36GB Unified',
  },
  tags: ['developer', 'creative'],
  isPopular: true,
  isFeatured: true,
};

describe('CatalogItem', () => {
  it('renders item name', () => {
    render(<CatalogItem item={mockItem} />);
    expect(screen.getByText('MacBook Pro 16" M3 Max')).toBeInTheDocument();
  });

  it('renders item category', () => {
    render(<CatalogItem item={mockItem} />);
    expect(screen.getByText('Laptops')).toBeInTheDocument();
  });

  it('renders manufacturer and model', () => {
    render(<CatalogItem item={mockItem} />);
    expect(screen.getByText('Apple • MacBook Pro 16" (2024)')).toBeInTheDocument();
  });

  it('renders formatted price', () => {
    render(<CatalogItem item={mockItem} />);
    expect(screen.getByText('$3,499')).toBeInTheDocument();
  });

  it('renders availability status', () => {
    render(<CatalogItem item={mockItem} />);
    expect(screen.getByText('In Stock')).toBeInTheDocument();
  });

  it('renders featured badge when item is featured', () => {
    render(<CatalogItem item={mockItem} />);
    expect(screen.getByText('Featured')).toBeInTheDocument();
  });

  it('renders popular badge when item is popular', () => {
    render(<CatalogItem item={mockItem} />);
    expect(screen.getByText('Popular')).toBeInTheDocument();
  });

  it('does not render badges when item is not featured or popular', () => {
    const regularItem = { ...mockItem, isFeatured: false, isPopular: false };
    render(<CatalogItem item={regularItem} />);
    expect(screen.queryByText('Featured')).not.toBeInTheDocument();
    expect(screen.queryByText('Popular')).not.toBeInTheDocument();
  });

  it('renders lead time when greater than 0', () => {
    const itemWithLeadTime = { ...mockItem, leadTimeDays: 5 };
    render(<CatalogItem item={itemWithLeadTime} />);
    expect(screen.getByText('Ships in 5 days')).toBeInTheDocument();
  });

  it('renders singular day text for 1 day lead time', () => {
    const itemWithLeadTime = { ...mockItem, leadTimeDays: 1 };
    render(<CatalogItem item={itemWithLeadTime} />);
    expect(screen.getByText('Ships in 1 day')).toBeInTheDocument();
  });

  it('does not render lead time when 0', () => {
    render(<CatalogItem item={mockItem} />);
    expect(screen.queryByText(/Ships in/)).not.toBeInTheDocument();
  });

  it('calls onItemClick when item is clicked', () => {
    const handleClick = vi.fn();
    render(<CatalogItem item={mockItem} onItemClick={handleClick} />);
    
    fireEvent.click(screen.getByRole('button', { name: /View details for MacBook Pro/ }));
    
    expect(handleClick).toHaveBeenCalledWith(mockItem);
  });

  it('calls onItemClick when Enter key is pressed', () => {
    const handleClick = vi.fn();
    render(<CatalogItem item={mockItem} onItemClick={handleClick} />);
    
    const item = screen.getByRole('button', { name: /View details for MacBook Pro/ });
    fireEvent.keyDown(item, { key: 'Enter' });
    
    expect(handleClick).toHaveBeenCalledWith(mockItem);
  });

  it('calls onAddToCart when add to cart button is clicked', () => {
    const handleAddToCart = vi.fn();
    render(<CatalogItem item={mockItem} onAddToCart={handleAddToCart} />);
    
    fireEvent.click(screen.getByLabelText(/Add MacBook Pro.*to cart/));
    
    expect(handleAddToCart).toHaveBeenCalledWith(mockItem);
  });

  it('shows "In Cart" when item is in cart', () => {
    render(<CatalogItem item={mockItem} isInCart />);
    expect(screen.getByText('In Cart')).toBeInTheDocument();
  });

  it('disables add to cart button when out of stock', () => {
    const outOfStockItem = { ...mockItem, availability: 'OUT_OF_STOCK' as const };
    render(<CatalogItem item={outOfStockItem} />);
    
    const addButton = screen.getByRole('button', { name: /Add.*to cart/ });
    expect(addButton).toBeDisabled();
  });

  it('renders in grid view mode by default', () => {
    const { container } = render(<CatalogItem item={mockItem} />);
    // CSS modules hash class names, so check for partial match
    const article = container.querySelector('article');
    expect(article).toBeInTheDocument();
    expect(article?.className).toMatch(/grid/);
  });

  it('renders in list view mode when specified', () => {
    const { container } = render(<CatalogItem item={mockItem} viewMode="list" />);
    const article = container.querySelector('article');
    expect(article).toBeInTheDocument();
    expect(article?.className).toMatch(/list/);
  });

  it('shows description in list view', () => {
    render(<CatalogItem item={mockItem} viewMode="list" />);
    expect(screen.getByText(/High-performance laptop/)).toBeInTheDocument();
  });

  it('renders placeholder when no image URL', () => {
    const itemWithoutImage = { ...mockItem, imageUrl: undefined };
    const { container } = render(<CatalogItem item={itemWithoutImage} />);
    // CSS modules hash class names, so check for SVG placeholder
    const placeholder = container.querySelector('svg[viewBox="0 0 24 24"]');
    expect(placeholder).toBeInTheDocument();
  });

  it('has accessible button role', () => {
    render(<CatalogItem item={mockItem} />);
    expect(screen.getByRole('button', { name: /View details for MacBook Pro/ })).toBeInTheDocument();
  });

  it('renders different availability colors', () => {
    const lowStockItem = { ...mockItem, availability: 'LOW_STOCK' as const };
    render(<CatalogItem item={lowStockItem} />);
    expect(screen.getByText('Low Stock')).toBeInTheDocument();
  });
});

describe('CatalogItem - Requirements Validation', () => {
  /**
   * Validates Requirement 6B.1: Service catalog shall display available items with descriptions and pricing
   */
  it('displays item with description and pricing (Requirement 6B.1)', () => {
    render(<CatalogItem item={mockItem} viewMode="list" />);
    
    // Verify name is displayed
    expect(screen.getByText('MacBook Pro 16" M3 Max')).toBeInTheDocument();
    
    // Verify description is displayed (in list view)
    expect(screen.getByText(/High-performance laptop/)).toBeInTheDocument();
    
    // Verify price is displayed
    expect(screen.getByText('$3,499')).toBeInTheDocument();
  });

  /**
   * Validates Requirement 6B.1: Service catalog shall display availability
   */
  it('displays item availability (Requirement 6B.1)', () => {
    render(<CatalogItem item={mockItem} />);
    expect(screen.getByText('In Stock')).toBeInTheDocument();
  });
});
