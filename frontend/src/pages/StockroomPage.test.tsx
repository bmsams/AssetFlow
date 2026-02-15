import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StockroomPage } from './StockroomPage';

// Mock the simulateApiDelay to return immediately
vi.mock('../components/stockroom/mockData', async () => {
  const actual = await vi.importActual('../components/stockroom/mockData');
  return {
    ...actual,
    simulateApiDelay: vi.fn((data) => Promise.resolve(data)),
  };
});

describe('StockroomPage', () => {
  it('renders page title', () => {
    render(<StockroomPage />);
    expect(screen.getByText('Stockroom Dashboard')).toBeInTheDocument();
  });

  it('renders page description', () => {
    render(<StockroomPage />);
    expect(
      screen.getByText('Monitor inventory levels, transfers, and replenishment needs')
    ).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(<StockroomPage />);
    // Should show loading stat cards
    const loadingElements = screen.getAllByText('Loading statistic');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('renders stat cards after loading', async () => {
    render(<StockroomPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Stockrooms')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Inventory Value')).toBeInTheDocument();
    expect(screen.getByText('Low Stock Alerts')).toBeInTheDocument();
    expect(screen.getByText('Active Transfers')).toBeInTheDocument();
  });

  it('renders inventory levels section', async () => {
    render(<StockroomPage />);

    await waitFor(() => {
      expect(screen.getByText('Inventory by Stockroom')).toBeInTheDocument();
    });

    // Check for stockroom names from mock data (appears multiple times)
    const mainStockroomElements = screen.getAllByText('Main IT Stockroom');
    expect(mainStockroomElements.length).toBeGreaterThan(0);
  });

  it('renders transfer orders section', async () => {
    render(<StockroomPage />);

    await waitFor(() => {
      expect(screen.getByText('Transfer Orders')).toBeInTheDocument();
    });

    // Check for transfer numbers from mock data
    expect(screen.getByText('TRF-2025-0001')).toBeInTheDocument();
  });

  it('renders replenishment alerts section', async () => {
    render(<StockroomPage />);

    await waitFor(() => {
      expect(screen.getByText('Replenishment Alerts')).toBeInTheDocument();
    });
  });

  it('displays stockroom count', async () => {
    render(<StockroomPage />);

    await waitFor(() => {
      // Mock data has 5 stockrooms (appears multiple times in stats)
      const fiveElements = screen.getAllByText('5');
      expect(fiveElements.length).toBeGreaterThan(0);
    });
  });

  it('displays formatted inventory value', async () => {
    render(<StockroomPage />);

    await waitFor(() => {
      // Check for formatted total value from mock data
      expect(screen.getByText('$6,650,000')).toBeInTheDocument();
    });
  });

  it('renders last updated timestamp after loading', async () => {
    render(<StockroomPage />);

    await waitFor(() => {
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    });
  });

  it('has accessible section landmarks', async () => {
    render(<StockroomPage />);

    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: 'Stockroom summary statistics' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('region', { name: 'Inventory levels' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('region', { name: 'Transfer orders' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('region', { name: 'Replenishment alerts' })
      ).toBeInTheDocument();
    });
  });

  it('renders approve button for pending transfers', async () => {
    render(<StockroomPage />);

    await waitFor(() => {
      const approveButtons = screen.getAllByText('Approve Transfer');
      expect(approveButtons.length).toBeGreaterThan(0);
    });
  });

  it('renders create order buttons for alerts', async () => {
    render(<StockroomPage />);

    await waitFor(() => {
      const createOrderButtons = screen.getAllByText('Create Order');
      expect(createOrderButtons.length).toBeGreaterThan(0);
    });
  });
});

describe('StockroomPage - Requirements Validation', () => {
  /**
   * Validates Requirement 12.4: Display inventory levels by stockroom
   */
  it('displays inventory levels by stockroom (Requirement 12.4)', async () => {
    render(<StockroomPage />);

    await waitFor(() => {
      // Verify inventory section exists
      expect(screen.getByText('Inventory by Stockroom')).toBeInTheDocument();
      
      // Verify stockroom data is displayed (appears multiple times)
      const mainStockroomElements = screen.getAllByText('Main IT Stockroom');
      expect(mainStockroomElements.length).toBeGreaterThan(0);
    });
  });

  /**
   * Validates Requirement 12.4: Show transfer orders and status
   */
  it('shows transfer orders and status (Requirement 12.4)', async () => {
    render(<StockroomPage />);

    await waitFor(() => {
      // Verify transfer orders section exists
      expect(screen.getByText('Transfer Orders')).toBeInTheDocument();
      
      // Verify transfer data is displayed
      expect(screen.getByText('TRF-2025-0001')).toBeInTheDocument();
      
      // Verify status is shown (may appear multiple times)
      const inTransitElements = screen.getAllByText('In Transit');
      expect(inTransitElements.length).toBeGreaterThan(0);
    });
  });

  /**
   * Validates Requirement 12.4: Display replenishment alerts
   */
  it('displays replenishment alerts (Requirement 12.4)', async () => {
    render(<StockroomPage />);

    await waitFor(() => {
      // Verify alerts section exists
      expect(screen.getByText('Replenishment Alerts')).toBeInTheDocument();
      
      // Verify alert data is displayed
      expect(screen.getByText('Dell Latitude 5540 Laptop')).toBeInTheDocument();
    });
  });

  /**
   * Validates Requirement 12.4: Summary statistics
   */
  it('displays stockroom summary statistics (Requirement 12.4)', async () => {
    render(<StockroomPage />);

    await waitFor(() => {
      // Verify summary stat cards
      expect(screen.getByText('Total Stockrooms')).toBeInTheDocument();
      expect(screen.getByText('Total Inventory Value')).toBeInTheDocument();
      expect(screen.getByText('Low Stock Alerts')).toBeInTheDocument();
      expect(screen.getByText('Active Transfers')).toBeInTheDocument();
    });
  });

  /**
   * Validates Requirement 12.4: Actionable interface
   */
  it('provides actionable interface for stockroom management (Requirement 12.4)', async () => {
    render(<StockroomPage />);

    await waitFor(() => {
      // Verify action buttons exist
      const approveButtons = screen.getAllByText('Approve Transfer');
      const createOrderButtons = screen.getAllByText('Create Order');
      
      expect(approveButtons.length).toBeGreaterThan(0);
      expect(createOrderButtons.length).toBeGreaterThan(0);
    });
  });
});
