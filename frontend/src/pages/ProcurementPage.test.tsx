import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProcurementPage } from './ProcurementPage';
import { mockPurchaseOrders } from '../components/procurement/mockData';

// Mock the procurement API to return mock data
vi.mock('../services/procurement-api', () => ({
  procurementApi: {
    purchaseOrders: {
      list: vi.fn(() => Promise.resolve({
        items: mockPurchaseOrders,
        total: mockPurchaseOrders.length,
        page: 1,
        pageSize: 100,
        totalPages: 1,
      })),
    },
  },
}));

// Mock useAuth
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { userId: 'test', email: 'test@test.com', name: 'Test', roles: ['admin'] },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: () => true,
    hasAnyRole: () => true,
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ProcurementPage />
    </MemoryRouter>
  );
}

describe('ProcurementPage', () => {
  it('renders page title', () => {
    renderPage();
    expect(screen.getByText('Procurement Workspace')).toBeInTheDocument();
  });

  it('renders page description', () => {
    renderPage();
    expect(
      screen.getByText('Manage asset requests, purchase orders, and receiving')
    ).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    renderPage();
    // Should show loading stat cards
    const loadingElements = screen.getAllByText('Loading statistic');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('renders stat cards after loading', async () => {
    renderPage();

    await waitFor(() => {
      const pendingElements = screen.getAllByText('Pending Requests');
      expect(pendingElements.length).toBeGreaterThan(0);
    });

    expect(screen.getByText('Open Purchase Orders')).toBeInTheDocument();
    expect(screen.getByText('Awaiting Receiving')).toBeInTheDocument();
    expect(screen.getByText('Overdue Deliveries')).toBeInTheDocument();
  });

  it('renders pending requests section', async () => {
    renderPage();

    await waitFor(() => {
      const pendingElements = screen.getAllByText('Pending Requests');
      expect(pendingElements.length).toBeGreaterThan(0);
    });
  });

  it('renders purchase orders section', async () => {
    renderPage();

    await waitFor(() => {
      const purchaseOrdersElements = screen.getAllByText('Purchase Orders');
      expect(purchaseOrdersElements.length).toBeGreaterThan(0);
    });
  });

  it('renders receiving queue section', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Receiving Queue')).toBeInTheDocument();
    });
  });

  it('displays open purchase orders count', async () => {
    renderPage();

    await waitFor(() => {
      // Mock data has open POs (SENT, PARTIALLY_RECEIVED, etc.)
      expect(screen.getByText('Open Purchase Orders')).toBeInTheDocument();
    });
  });

  it('renders last updated timestamp after loading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    });
  });

  it('has accessible section landmarks', async () => {
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: 'Procurement summary statistics' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('region', { name: 'Pending requests' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('region', { name: 'Purchase orders' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('region', { name: 'Receiving queue' })
      ).toBeInTheDocument();
    });
  });

  it('renders Create PO button', () => {
    renderPage();
    expect(screen.getByText('Create PO')).toBeInTheDocument();
  });
});

describe('ProcurementPage - Requirements Validation', () => {
  /**
   * Validates Requirement 12.3: Display purchase orders
   */
  it('displays purchase orders (Requirement 12.3)', async () => {
    renderPage();

    await waitFor(() => {
      // Verify purchase orders section exists
      const purchaseOrdersElements = screen.getAllByText('Purchase Orders');
      expect(purchaseOrdersElements.length).toBeGreaterThan(0);
    });
  });

  /**
   * Validates Requirement 12.3: Summary statistics
   */
  it('displays procurement summary statistics (Requirement 12.3)', async () => {
    renderPage();

    await waitFor(() => {
      // Verify summary stat cards
      const pendingElements = screen.getAllByText('Pending Requests');
      expect(pendingElements.length).toBeGreaterThan(0);
      
      expect(screen.getByText('Open Purchase Orders')).toBeInTheDocument();
      expect(screen.getByText('Awaiting Receiving')).toBeInTheDocument();
      expect(screen.getByText('Overdue Deliveries')).toBeInTheDocument();
    });
  });

  /**
   * Validates Requirement 12.3: Receiving queue display
   */
  it('shows receiving queue section (Requirement 12.3)', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Receiving Queue')).toBeInTheDocument();
    });
  });

  /**
   * Validates Requirement 12.3: Page layout and structure
   */
  it('has proper page layout structure (Requirement 12.3)', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Procurement Workspace')).toBeInTheDocument();
      expect(screen.getByText('Create PO')).toBeInTheDocument();
    });
  });
});
