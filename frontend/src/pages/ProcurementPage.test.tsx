import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProcurementPage } from './ProcurementPage';

// Mock the simulateApiDelay to return immediately
vi.mock('../components/procurement/mockData', async () => {
  const actual = await vi.importActual('../components/procurement/mockData');
  return {
    ...actual,
    simulateApiDelay: vi.fn((data) => Promise.resolve(data)),
  };
});

describe('ProcurementPage', () => {
  it('renders page title', () => {
    render(<ProcurementPage />);
    expect(screen.getByText('Procurement Workspace')).toBeInTheDocument();
  });

  it('renders page description', () => {
    render(<ProcurementPage />);
    expect(
      screen.getByText('Manage asset requests, purchase orders, and receiving')
    ).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(<ProcurementPage />);
    // Should show loading stat cards
    const loadingElements = screen.getAllByText('Loading statistic');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('renders stat cards after loading', async () => {
    render(<ProcurementPage />);

    await waitFor(() => {
      expect(screen.getByText('Pending Requests')).toBeInTheDocument();
    });

    expect(screen.getByText('Open Purchase Orders')).toBeInTheDocument();
    expect(screen.getByText('Awaiting Receiving')).toBeInTheDocument();
    expect(screen.getByText('Overdue Deliveries')).toBeInTheDocument();
  });

  it('renders pending requests section', async () => {
    render(<ProcurementPage />);

    await waitFor(() => {
      expect(screen.getByText('Pending Requests')).toBeInTheDocument();
    });

    // Check for request numbers from mock data
    expect(screen.getByText('REQ-2025-0001')).toBeInTheDocument();
  });

  it('renders purchase orders section', async () => {
    render(<ProcurementPage />);

    await waitFor(() => {
      const purchaseOrdersElements = screen.getAllByText('Purchase Orders');
      expect(purchaseOrdersElements.length).toBeGreaterThan(0);
    });

    // Check for PO numbers from mock data (use getAllByText since it appears in multiple places)
    const poElements = screen.getAllByText('PO-2025-0001');
    expect(poElements.length).toBeGreaterThan(0);
  });

  it('renders receiving queue section', async () => {
    render(<ProcurementPage />);

    await waitFor(() => {
      expect(screen.getByText('Receiving Queue')).toBeInTheDocument();
    });
  });

  it('displays pending requests count', async () => {
    render(<ProcurementPage />);

    await waitFor(() => {
      // Mock data has 5 pending requests (use getAllByText since 5 appears multiple times)
      const fiveElements = screen.getAllByText('5');
      expect(fiveElements.length).toBeGreaterThan(0);
    });
  });

  it('displays formatted currency values', async () => {
    render(<ProcurementPage />);

    await waitFor(() => {
      // Check for formatted values from mock data
      expect(screen.getByText('$27,044')).toBeInTheDocument(); // pending requests value
    });
  });

  it('renders last updated timestamp after loading', async () => {
    render(<ProcurementPage />);

    await waitFor(() => {
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    });
  });

  it('has accessible section landmarks', async () => {
    render(<ProcurementPage />);

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

  it('renders approve and reject buttons for requests', async () => {
    render(<ProcurementPage />);

    await waitFor(() => {
      const approveButtons = screen.getAllByText('Approve');
      const rejectButtons = screen.getAllByText('Reject');
      
      expect(approveButtons.length).toBeGreaterThan(0);
      expect(rejectButtons.length).toBeGreaterThan(0);
    });
  });

  it('renders receive buttons for receiving queue items', async () => {
    render(<ProcurementPage />);

    await waitFor(() => {
      const receiveButtons = screen.getAllByText('Receive');
      expect(receiveButtons.length).toBeGreaterThan(0);
    });
  });
});

describe('ProcurementPage - Requirements Validation', () => {
  /**
   * Validates Requirement 12.3: Display pending requests
   */
  it('displays pending requests (Requirement 12.3)', async () => {
    render(<ProcurementPage />);

    await waitFor(() => {
      // Verify pending requests section exists (use getAllByText since it appears in stat card and section)
      const pendingRequestsElements = screen.getAllByText('Pending Requests');
      expect(pendingRequestsElements.length).toBeGreaterThan(0);
      
      // Verify request data is displayed
      expect(screen.getByText('REQ-2025-0001')).toBeInTheDocument();
      expect(screen.getByText('MacBook Pro 16" M3 Max')).toBeInTheDocument();
    });
  });

  /**
   * Validates Requirement 12.3: Display purchase orders
   */
  it('displays purchase orders (Requirement 12.3)', async () => {
    render(<ProcurementPage />);

    await waitFor(() => {
      // Verify purchase orders section exists
      const purchaseOrdersElements = screen.getAllByText('Purchase Orders');
      expect(purchaseOrdersElements.length).toBeGreaterThan(0);
      
      // Verify PO data is displayed (use getAllByText since PO number appears in multiple places)
      const poElements = screen.getAllByText('PO-2025-0001');
      expect(poElements.length).toBeGreaterThan(0);
      
      // Verify vendor name is displayed (use getAllByText since it appears in multiple places)
      const vendorElements = screen.getAllByText('Dell Technologies');
      expect(vendorElements.length).toBeGreaterThan(0);
    });
  });

  /**
   * Validates Requirement 12.3: Show receiving queue with actions
   */
  it('shows receiving queue with actions (Requirement 12.3)', async () => {
    render(<ProcurementPage />);

    await waitFor(() => {
      // Verify receiving queue section exists
      expect(screen.getByText('Receiving Queue')).toBeInTheDocument();
      
      // Verify action buttons exist
      const receiveButtons = screen.getAllByText('Receive');
      const issueButtons = screen.getAllByText('Report Issue');
      
      expect(receiveButtons.length).toBeGreaterThan(0);
      expect(issueButtons.length).toBeGreaterThan(0);
    });
  });

  /**
   * Validates Requirement 12.3: Implement request approval interface
   */
  it('implements request approval interface (Requirement 12.3)', async () => {
    render(<ProcurementPage />);

    await waitFor(() => {
      // Verify approval buttons exist for pending requests
      const approveButtons = screen.getAllByText('Approve');
      const rejectButtons = screen.getAllByText('Reject');
      
      expect(approveButtons.length).toBeGreaterThan(0);
      expect(rejectButtons.length).toBeGreaterThan(0);
    });
  });

  /**
   * Validates Requirement 12.3: Summary statistics
   */
  it('displays procurement summary statistics (Requirement 12.3)', async () => {
    render(<ProcurementPage />);

    await waitFor(() => {
      // Verify summary stat cards (use getAllByText for elements that appear multiple times)
      const pendingRequestsElements = screen.getAllByText('Pending Requests');
      expect(pendingRequestsElements.length).toBeGreaterThan(0);
      
      expect(screen.getByText('Open Purchase Orders')).toBeInTheDocument();
      expect(screen.getByText('Awaiting Receiving')).toBeInTheDocument();
      expect(screen.getByText('Overdue Deliveries')).toBeInTheDocument();
    });
  });
});
