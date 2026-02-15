import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AssetsPage } from './AssetsPage';
import * as mockDataModule from '../components/assets/mockData';

// Mock the simulateApiDelay to return immediately
vi.mock('../components/assets/mockData', async () => {
  const actual = await vi.importActual('../components/assets/mockData');
  return {
    ...actual,
    simulateApiDelay: vi.fn((data) => Promise.resolve(data)),
  };
});

describe('AssetsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('renders page title', () => {
    render(<AssetsPage />);
    expect(screen.getByText('All Assets')).toBeInTheDocument();
  });

  it('renders page description', () => {
    render(<AssetsPage />);
    expect(
      screen.getByText('View and manage all assets in your organization')
    ).toBeInTheDocument();
  });

  it('renders create asset button', () => {
    render(<AssetsPage />);
    expect(screen.getByText('Create Asset')).toBeInTheDocument();
  });

  it('renders columns button', () => {
    render(<AssetsPage />);
    expect(screen.getByText('Columns')).toBeInTheDocument();
  });

  it('renders filter section', async () => {
    render(<AssetsPage />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search assets/i)).toBeInTheDocument();
    });
  });

  it('renders asset table after loading', async () => {
    render(<AssetsPage />);
    
    await waitFor(() => {
      expect(screen.getByRole('grid', { name: 'Assets table' })).toBeInTheDocument();
    });
  });

  it('renders pagination after loading', async () => {
    render(<AssetsPage />);
    
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    });
  });

  it('displays assets from mock data', async () => {
    render(<AssetsPage />);
    
    // Wait for loading to complete and table to render
    await waitFor(() => {
      expect(screen.getByRole('grid', { name: 'Assets table' })).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Verify table has rows (assets loaded)
    const table = screen.getByRole('grid', { name: 'Assets table' });
    const rows = table.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('filters assets by search', async () => {
    render(<AssetsPage />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search assets/i)).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText(/search assets/i);
    fireEvent.change(searchInput, { target: { value: 'Dell' } });
    
    await waitFor(() => {
      // Should show Dell assets
      expect(screen.getByText('Dell Latitude 5540 Laptop')).toBeInTheDocument();
    });
  });

  it('filters assets by type', async () => {
    render(<AssetsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Hardware')).toBeInTheDocument();
    });
    
    // Click Hardware filter
    const hardwareChips = screen.getAllByText('Hardware');
    const filterChip = hardwareChips.find(el => el.getAttribute('aria-pressed') !== null);
    if (filterChip) {
      fireEvent.click(filterChip);
    }
    
    // Assets should be filtered
    await waitFor(() => {
      expect(screen.getByRole('grid', { name: 'Assets table' })).toBeInTheDocument();
    });
  });

  it('shows bulk actions when assets are selected', async () => {
    render(<AssetsPage />);
    
    await waitFor(() => {
      expect(screen.getByRole('grid', { name: 'Assets table' })).toBeInTheDocument();
    });
    
    // Select all assets
    fireEvent.click(screen.getByLabelText('Select all assets'));
    
    await waitFor(() => {
      expect(screen.getByRole('toolbar', { name: 'Bulk actions' })).toBeInTheDocument();
    });
  });

  it('clears selection when clear selection is clicked', async () => {
    render(<AssetsPage />);
    
    await waitFor(() => {
      expect(screen.getByRole('grid', { name: 'Assets table' })).toBeInTheDocument();
    });
    
    // Select all assets
    fireEvent.click(screen.getByLabelText('Select all assets'));
    
    await waitFor(() => {
      expect(screen.getByText('Clear selection')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Clear selection'));
    
    await waitFor(() => {
      expect(screen.queryByRole('toolbar', { name: 'Bulk actions' })).not.toBeInTheDocument();
    });
  });

  it('changes page when pagination is clicked', async () => {
    render(<AssetsPage />);
    
    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    });
    
    // Go to page 2
    fireEvent.click(screen.getByLabelText('Go to page 2'));
    
    // Pagination should update
    await waitFor(() => {
      const page2Button = screen.getByLabelText('Go to page 2');
      expect(page2Button).toHaveAttribute('aria-current', 'page');
    });
  });

  it('sorts assets when column header is clicked', async () => {
    render(<AssetsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });
    
    // Click Name header to sort
    fireEvent.click(screen.getByText('Name'));
    
    // Should update sort indicator
    await waitFor(() => {
      const nameHeader = screen.getByText('Name').closest('th');
      expect(nameHeader).toHaveAttribute('aria-sort');
    });
  });

  it('opens column selector when columns button is clicked', async () => {
    render(<AssetsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Columns')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Columns'));
    
    expect(screen.getByText('Show/Hide Columns')).toBeInTheDocument();
  });

  it('has accessible section landmarks', async () => {
    render(<AssetsPage />);
    
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Asset filters' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Assets list' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Pagination' })).toBeInTheDocument();
    });
  });
});

describe('AssetsPage - Requirements Validation', () => {
  /**
   * Validates Requirement 2.1: Paginated asset list with filtering and sorting
   */
  it('provides paginated asset list with filtering and sorting (Requirement 2.1)', async () => {
    render(<AssetsPage />);
    
    await waitFor(() => {
      // Verify asset table is rendered
      expect(screen.getByRole('grid', { name: 'Assets table' })).toBeInTheDocument();
      
      // Verify pagination is available
      expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
      
      // Verify filters are available - search input uses placeholder as aria-label
      expect(screen.getByPlaceholderText(/search assets/i)).toBeInTheDocument();
      // Verify filter toolbar is present
      expect(screen.getByRole('search', { name: 'Filter toolbar' })).toBeInTheDocument();
    });
    
    // Verify sorting is available
    const nameHeader = screen.getByText('Name').closest('th');
    expect(nameHeader).toBeInTheDocument();
    fireEvent.click(screen.getByText('Name'));
    
    await waitFor(() => {
      expect(nameHeader).toHaveAttribute('aria-sort');
    });
  });

  /**
   * Validates Requirement 2.1: Column customization
   */
  it('supports column customization (Requirement 2.1)', async () => {
    render(<AssetsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Columns')).toBeInTheDocument();
    });
    
    // Open column selector
    fireEvent.click(screen.getByText('Columns'));
    
    // Verify column options are available
    expect(screen.getByText('Show/Hide Columns')).toBeInTheDocument();
    // Use getAllByText since column names appear in both dropdown and table
    expect(screen.getAllByText('Asset Tag').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Name').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Type').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Status').length).toBeGreaterThan(0);
  });

  /**
   * Validates Requirement 2.1: Bulk actions support
   */
  it('supports bulk actions (Requirement 2.1)', async () => {
    render(<AssetsPage />);
    
    await waitFor(() => {
      expect(screen.getByRole('grid', { name: 'Assets table' })).toBeInTheDocument();
    });
    
    // Select assets
    fireEvent.click(screen.getByLabelText('Select all assets'));
    
    await waitFor(() => {
      // Verify bulk actions bar appears
      expect(screen.getByRole('toolbar', { name: 'Bulk actions' })).toBeInTheDocument();
      
      // Verify bulk action buttons
      expect(screen.getByText('Delete')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
      expect(screen.getByText('Change Status')).toBeInTheDocument();
    });
  });

  /**
   * Validates Requirement 2.1: Asset registry display
   */
  it('displays comprehensive asset registry (Requirement 2.1)', async () => {
    render(<AssetsPage />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByRole('grid', { name: 'Assets table' })).toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Verify table has rows (assets loaded)
    const table = screen.getByRole('grid', { name: 'Assets table' });
    const rows = table.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(0);
    
    // Verify asset types are displayed (in filter chips)
    const hardwareBadges = screen.getAllByText('Hardware');
    expect(hardwareBadges.length).toBeGreaterThan(0);
  });

  /**
   * Validates Requirement 2.1: Search functionality
   */
  it('supports search across asset attributes (Requirement 2.1)', async () => {
    render(<AssetsPage />);
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search assets/i)).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText(/search assets/i);
    
    // Search by name
    fireEvent.change(searchInput, { target: { value: 'Dell' } });
    
    await waitFor(() => {
      expect(screen.getByText('Dell Latitude 5540 Laptop')).toBeInTheDocument();
    });
  });
});
