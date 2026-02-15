import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ServiceCatalogPage } from './ServiceCatalogPage';

// Mock the simulateApiDelay to speed up tests
vi.mock('../components/service-catalog/mockData', async () => {
  const actual = await vi.importActual('../components/service-catalog/mockData');
  return {
    ...actual,
    simulateApiDelay: vi.fn((data) => Promise.resolve(data)),
  };
});

describe('ServiceCatalogPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders page title', async () => {
    render(<ServiceCatalogPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Service Catalog')).toBeInTheDocument();
    });
  });

  it('renders page description', async () => {
    render(<ServiceCatalogPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/Browse and request hardware, software/)).toBeInTheDocument();
    });
  });

  it('renders view toggle buttons', async () => {
    render(<ServiceCatalogPage />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Grid view')).toBeInTheDocument();
      expect(screen.getByLabelText('List view')).toBeInTheDocument();
    });
  });

  it('renders search component', async () => {
    render(<ServiceCatalogPage />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Search catalog')).toBeInTheDocument();
    });
  });

  it('renders category filter', async () => {
    render(<ServiceCatalogPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Categories')).toBeInTheDocument();
    });
  });

  it('renders request cart', async () => {
    render(<ServiceCatalogPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
    });
  });

  it('displays catalog items after loading', async () => {
    render(<ServiceCatalogPage />);
    
    await waitFor(() => {
      expect(screen.getByText('MacBook Pro 16" M3 Max')).toBeInTheDocument();
    });
  });

  it('displays multiple catalog items', async () => {
    render(<ServiceCatalogPage />);
    
    await waitFor(() => {
      expect(screen.getByText('MacBook Pro 16" M3 Max')).toBeInTheDocument();
      expect(screen.getByText('Dell Latitude 5540')).toBeInTheDocument();
      expect(screen.getByText('Dell UltraSharp U2723QE')).toBeInTheDocument();
    });
  });

  it('switches to list view when list button is clicked', async () => {
    render(<ServiceCatalogPage />);
    
    await waitFor(() => {
      expect(screen.getByText('MacBook Pro 16" M3 Max')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByLabelText('List view'));
    
    expect(screen.getByLabelText('List view')).toHaveAttribute('aria-pressed', 'true');
  });

  it('filters items when search is used', async () => {
    render(<ServiceCatalogPage />);
    
    await waitFor(() => {
      expect(screen.getByText('MacBook Pro 16" M3 Max')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByLabelText('Search catalog');
    fireEvent.change(searchInput, { target: { value: 'MacBook' } });
    
    await waitFor(() => {
      expect(screen.getByText('MacBook Pro 16" M3 Max')).toBeInTheDocument();
      expect(screen.queryByText('Dell Latitude 5540')).not.toBeInTheDocument();
    });
  });

  it('filters items when category is selected', async () => {
    render(<ServiceCatalogPage />);
    
    await waitFor(() => {
      expect(screen.getByText('MacBook Pro 16" M3 Max')).toBeInTheDocument();
    });
    
    // Click on Monitors category
    fireEvent.click(screen.getByRole('option', { name: /Monitors/ }));
    
    await waitFor(() => {
      expect(screen.getByText('Dell UltraSharp U2723QE')).toBeInTheDocument();
      expect(screen.queryByText('MacBook Pro 16" M3 Max')).not.toBeInTheDocument();
    });
  });

  it('shows empty state when no items match filters', async () => {
    render(<ServiceCatalogPage />);
    
    await waitFor(() => {
      expect(screen.getByText('MacBook Pro 16" M3 Max')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByLabelText('Search catalog');
    fireEvent.change(searchInput, { target: { value: 'nonexistent item xyz123' } });
    
    await waitFor(() => {
      expect(screen.getByText('No items found')).toBeInTheDocument();
    });
  });

  it('clears filters when clear all button is clicked', async () => {
    render(<ServiceCatalogPage />);
    
    await waitFor(() => {
      expect(screen.getByText('MacBook Pro 16" M3 Max')).toBeInTheDocument();
    });
    
    // Apply a filter
    const searchInput = screen.getByLabelText('Search catalog');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    
    await waitFor(() => {
      expect(screen.getByText('No items found')).toBeInTheDocument();
    });
    
    // Clear filters - use the one in the empty state
    const clearButtons = screen.getAllByText('Clear all filters');
    fireEvent.click(clearButtons[clearButtons.length - 1]);
    
    await waitFor(() => {
      expect(screen.getByText('MacBook Pro 16" M3 Max')).toBeInTheDocument();
    });
  });

  it('adds item to cart when add to cart is clicked', async () => {
    render(<ServiceCatalogPage />);
    
    await waitFor(() => {
      expect(screen.getByText('MacBook Pro 16" M3 Max')).toBeInTheDocument();
    });
    
    // Find and click add to cart button for first item
    const addButtons = screen.getAllByText('Add to Cart');
    fireEvent.click(addButtons[0]);
    
    // Cart should now show item count
    await waitFor(() => {
      expect(screen.getByText('Request Cart')).toBeInTheDocument();
      // Should show "1" badge
      const badges = screen.getAllByText('1');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it('shows "In Cart" for items already in cart', async () => {
    render(<ServiceCatalogPage />);
    
    await waitFor(() => {
      expect(screen.getByText('MacBook Pro 16" M3 Max')).toBeInTheDocument();
    });
    
    // Add item to cart
    const addButtons = screen.getAllByText('Add to Cart');
    fireEvent.click(addButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('In Cart')).toBeInTheDocument();
    });
  });

  it('displays results count', async () => {
    render(<ServiceCatalogPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/\d+ items found/)).toBeInTheDocument();
    });
  });

  it('updates results count when filtering', async () => {
    render(<ServiceCatalogPage />);
    
    await waitFor(() => {
      expect(screen.getByText('MacBook Pro 16" M3 Max')).toBeInTheDocument();
    });
    
    // Filter to laptops only
    fireEvent.click(screen.getByRole('option', { name: /Laptops/ }));
    
    await waitFor(() => {
      expect(screen.getByText('3 items found')).toBeInTheDocument();
    });
  });
});

describe('ServiceCatalogPage - Requirements Validation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Validates Requirement 6B.1: Service catalog shall display available items with descriptions and pricing
   */
  it('displays catalog items with descriptions and pricing (Requirement 6B.1)', async () => {
    render(<ServiceCatalogPage />);
    
    await waitFor(() => {
      // Verify items are displayed
      expect(screen.getByText('MacBook Pro 16" M3 Max')).toBeInTheDocument();
      
      // Verify pricing is displayed
      expect(screen.getByText('$3,499')).toBeInTheDocument();
      
      // Verify availability is displayed
      expect(screen.getAllByText('In Stock').length).toBeGreaterThan(0);
    });
  });

  /**
   * Validates Requirement 6B.2: Service catalog shall support categories and search functionality
   */
  it('supports categories and search (Requirement 6B.2)', async () => {
    render(<ServiceCatalogPage />);
    
    await waitFor(() => {
      expect(screen.getByText('MacBook Pro 16" M3 Max')).toBeInTheDocument();
    });
    
    // Verify categories are displayed
    expect(screen.getByText('Categories')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Laptops/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Monitors/ })).toBeInTheDocument();
    
    // Verify search works
    const searchInput = screen.getByLabelText('Search catalog');
    fireEvent.change(searchInput, { target: { value: 'Dell' } });
    
    await waitFor(() => {
      expect(screen.getByText('Dell Latitude 5540')).toBeInTheDocument();
      expect(screen.queryByText('MacBook Pro 16" M3 Max')).not.toBeInTheDocument();
    });
    
    // Clear search and verify category filtering
    fireEvent.change(searchInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('option', { name: /Monitors/ }));
    
    await waitFor(() => {
      expect(screen.getByText('Dell UltraSharp U2723QE')).toBeInTheDocument();
      expect(screen.queryByText('MacBook Pro 16" M3 Max')).not.toBeInTheDocument();
    });
  });

  /**
   * Validates Requirement 6B.3: Request submission flow (add to cart)
   */
  it('supports adding items to cart for request (Requirement 6B.3)', async () => {
    render(<ServiceCatalogPage />);
    
    await waitFor(() => {
      expect(screen.getByText('MacBook Pro 16" M3 Max')).toBeInTheDocument();
    });
    
    // Add item to cart
    const addButtons = screen.getAllByText('Add to Cart');
    fireEvent.click(addButtons[0]);
    
    // Verify cart shows item
    await waitFor(() => {
      expect(screen.getByText('Request Cart')).toBeInTheDocument();
    });
    
    // Expand cart and verify item is there
    fireEvent.click(screen.getByText('Request Cart'));
    
    await waitFor(() => {
      // Use getAllByText since item appears in both catalog and cart
      const macbookElements = screen.getAllByText('MacBook Pro 16" M3 Max');
      expect(macbookElements.length).toBeGreaterThanOrEqual(2); // In catalog and cart
      expect(screen.getByText('Proceed to Submit')).toBeInTheDocument();
    });
  });
});
