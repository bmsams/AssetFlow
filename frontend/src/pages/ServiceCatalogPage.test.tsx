import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ServiceCatalogPage } from './ServiceCatalogPage';
import { mockCatalogItems } from '../components/service-catalog/mockData';

vi.mock('../services/catalog-api', () => ({
  getCatalogItems: vi.fn(() => Promise.resolve({
    items: mockCatalogItems,
    total: mockCatalogItems.length,
  })),
}));

const MACBOOK_NAME = /MacBook Pro 16.*M3 Max/;

describe('ServiceCatalogPage', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); });

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
      expect(screen.getByText(MACBOOK_NAME)).toBeInTheDocument();
    });
  });

  it('displays multiple catalog items', async () => {
    render(<ServiceCatalogPage />);
    await waitFor(() => {
      expect(screen.getByText(MACBOOK_NAME)).toBeInTheDocument();
      expect(screen.getByText('Dell Latitude 5540')).toBeInTheDocument();
      expect(screen.getByText('Dell UltraSharp U2723QE')).toBeInTheDocument();
    });
  });

  it('switches to list view', async () => {
    render(<ServiceCatalogPage />);
    await waitFor(() => {
      expect(screen.getByText(MACBOOK_NAME)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('List view'));
    expect(screen.getByLabelText('List view')).toHaveAttribute('aria-pressed', 'true');
  });

  it('filters items when search is used', async () => {
    render(<ServiceCatalogPage />);
    await waitFor(() => {
      expect(screen.getByText(MACBOOK_NAME)).toBeInTheDocument();
    });
    const searchInput = screen.getByLabelText('Search catalog');
    fireEvent.change(searchInput, { target: { value: 'MacBook' } });
    await waitFor(() => {
      expect(screen.getByText(MACBOOK_NAME)).toBeInTheDocument();
      expect(screen.queryByText('Dell Latitude 5540')).not.toBeInTheDocument();
    });
  });

  it('filters items when category is selected', async () => {
    render(<ServiceCatalogPage />);
    await waitFor(() => {
      expect(screen.getByText(MACBOOK_NAME)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('option', { name: /Monitors/ }));
    await waitFor(() => {
      expect(screen.getByText('Dell UltraSharp U2723QE')).toBeInTheDocument();
      expect(screen.queryByText(MACBOOK_NAME)).not.toBeInTheDocument();
    });
  });

  it('shows empty state when no items match', async () => {
    render(<ServiceCatalogPage />);
    await waitFor(() => {
      expect(screen.getByText(MACBOOK_NAME)).toBeInTheDocument();
    });
    const searchInput = screen.getByLabelText('Search catalog');
    fireEvent.change(searchInput, { target: { value: 'nonexistent item xyz123' } });
    await waitFor(() => {
      expect(screen.getByText('No items found')).toBeInTheDocument();
    });
  });

  it('displays results count', async () => {
    render(<ServiceCatalogPage />);
    await waitFor(() => {
      expect(screen.getByText(/\d+ items found/)).toBeInTheDocument();
    });
  });
});

describe('ServiceCatalogPage - Requirements Validation', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it('displays items with pricing (Requirement 6B.1)', async () => {
    render(<ServiceCatalogPage />);
    await waitFor(() => {
      expect(screen.getByText(MACBOOK_NAME)).toBeInTheDocument();
      expect(screen.getByText(/3.{0,1}499/)).toBeInTheDocument();
      expect(screen.getAllByText('In Stock').length).toBeGreaterThan(0);
    });
  });

  it('supports categories and search (Requirement 6B.2)', async () => {
    render(<ServiceCatalogPage />);
    await waitFor(() => {
      expect(screen.getByText(MACBOOK_NAME)).toBeInTheDocument();
    });
    expect(screen.getByText('Categories')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Laptops/ })).toBeInTheDocument();
  });
});
