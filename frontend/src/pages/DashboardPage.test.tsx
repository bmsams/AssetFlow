import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import type { AssetEstateSummary } from '../types/dashboard';

// Mock dashboard data
const mockDashboardData: AssetEstateSummary = {
  totalAssetValue: 8200000,
  totalAssetCount: 4900,
  countsByCategory: [
    { category: 'HARDWARE', label: 'Hardware Assets', count: 2800, value: 5200000, percentageOfTotal: 57 },
    { category: 'SOFTWARE', label: 'Software Licenses', count: 1500, value: 2100000, percentageOfTotal: 31 },
    { category: 'ENTERPRISE', label: 'Enterprise Assets', count: 524, value: 900000, percentageOfTotal: 12 },
  ],
  lifecycleDistribution: [
    { status: 'DEPLOYED', label: 'Deployed', count: 2500, percentage: 51, color: '#22c55e' },
    { status: 'IN_STOCK', label: 'In Stock', count: 1200, percentage: 24, color: '#3b82f6' },
    { status: 'RETIRED', label: 'Retired', count: 600, percentage: 12, color: '#6b7280' },
    { status: 'IN_MAINTENANCE', label: 'In Maintenance', count: 400, percentage: 8, color: '#f97316' },
    { status: 'ORDERED', label: 'Ordered', count: 200, percentage: 4, color: '#8b5cf6' },
  ],
  leaseExpirations: [
    { assetId: '1', assetTag: 'AMS-HW-001', displayName: 'Dell PowerEdge R750 Server', leaseEndDate: '2025-03-15', daysUntilExpiration: 30, monthlyLeaseCost: 1500, severity: 'critical' },
    { assetId: '2', assetTag: 'AMS-HW-002', displayName: 'HP ProLiant DL380 Gen10', leaseEndDate: '2025-04-20', daysUntilExpiration: 65, monthlyLeaseCost: 1200, severity: 'warning' },
  ],
  complianceIndicators: [
    { id: '1', name: 'Microsoft Licenses', type: 'license', status: 'compliant', value: 450, threshold: 500, description: 'Microsoft 365 licenses', lastChecked: '2025-02-10' },
    { id: '2', name: 'Oracle Database', type: 'license', status: 'at_risk', value: 48, threshold: 50, description: 'Oracle DB licenses', lastChecked: '2025-02-10' },
    { id: '3', name: 'Hardware Warranties', type: 'warranty', status: 'compliant', value: 85, threshold: 100, description: 'Active warranties', lastChecked: '2025-02-10' },
  ],
};

// Mock the dashboard API
vi.mock('../services/dashboard-api', () => ({
  dashboardApi: {
    getSummary: vi.fn(() => Promise.resolve(mockDashboardData)),
  },
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('DashboardPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    localStorageMock.clear();
  });

  it('renders page title', () => {
    renderWithRouter(<DashboardPage />);

    expect(screen.getByText('Asset Estate Dashboard')).toBeInTheDocument();
  });

  it('renders page description', () => {
    renderWithRouter(<DashboardPage />);

    expect(screen.getByText("Overview of your organization's asset portfolio")).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    renderWithRouter(<DashboardPage />);

    // Should show loading widget content
    const loadingElements = screen.getAllByText('Loading widget content');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('renders stat cards after loading', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      // Check for widget titles (h3 elements)
      expect(screen.getByRole('article', { name: 'Total Asset Value' })).toBeInTheDocument();
    });

    expect(screen.getByRole('article', { name: 'Total Assets' })).toBeInTheDocument();
  });

  it('renders lifecycle chart section', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Asset Lifecycle Distribution')).toBeInTheDocument();
    });
  });

  it('renders lease expirations section', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Upcoming Lease Expirations')).toBeInTheDocument();
    });
  });

  it('renders compliance indicators section', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Compliance Status')).toBeInTheDocument();
    });
  });

  it('displays formatted currency values', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      // Total asset value should be formatted as currency
      expect(screen.getByText('$8,200,000')).toBeInTheDocument();
    });
  });

  it('displays formatted number values', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      // Total assets should be formatted
      expect(screen.getByText('4.9K')).toBeInTheDocument();
    });
  });

  it('renders category stat cards', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Hardware Assets')).toBeInTheDocument();
      expect(screen.getByText('Software Licenses')).toBeInTheDocument();
      expect(screen.getByText('Enterprise Assets')).toBeInTheDocument();
    });
  });

  it('renders last updated timestamp after loading', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      // There may be multiple "Last updated" elements (header and widget grid)
      expect(screen.getAllByText(/Last updated:/).length).toBeGreaterThan(0);
    });
  });

  it('has accessible section landmarks', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Dashboard widgets' })).toBeInTheDocument();
    });
  });

  it('renders trend indicators on stat cards', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      // Check for trend percentages
      expect(screen.getByText(/5.2%/)).toBeInTheDocument();
      expect(screen.getByText(/2.8%/)).toBeInTheDocument();
    });
  });
});

describe('DashboardPage - Requirements Validation', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    localStorageMock.clear();
  });

  /**
   * Validates Requirement 12.1: Display total asset value and counts by category
   */
  it('displays total asset value (Requirement 12.1)', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      // Check for the widget containing total asset value
      expect(screen.getByRole('article', { name: 'Total Asset Value' })).toBeInTheDocument();
      expect(screen.getByText('$8,200,000')).toBeInTheDocument();
    });
  });

  /**
   * Validates Requirement 12.1: Display counts by category
   */
  it('displays counts by category (Requirement 12.1)', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      // Hardware count
      expect(screen.getByText('Hardware Assets')).toBeInTheDocument();
      expect(screen.getByText('2.8K')).toBeInTheDocument();

      // Software count
      expect(screen.getByText('Software Licenses')).toBeInTheDocument();
      expect(screen.getByText('1.5K')).toBeInTheDocument();

      // Enterprise count
      expect(screen.getByText('Enterprise Assets')).toBeInTheDocument();
      expect(screen.getByText('524')).toBeInTheDocument();
    });
  });

  /**
   * Validates Requirement 12.1: Show lifecycle distribution charts
   */
  it('shows lifecycle distribution chart (Requirement 12.1)', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Asset Lifecycle Distribution')).toBeInTheDocument();
      // Check for lifecycle states - use getAllByText since they appear in chart and legend
      expect(screen.getAllByText('Deployed').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('In Stock').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Retired').length).toBeGreaterThanOrEqual(1);
    });
  });

  /**
   * Validates Requirement 12.2: Display lease expirations
   */
  it('displays lease expirations (Requirement 12.2)', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Upcoming Lease Expirations')).toBeInTheDocument();
      // Check for expiring assets
      expect(screen.getByText('Dell PowerEdge R750 Server')).toBeInTheDocument();
      expect(screen.getByText('HP ProLiant DL380 Gen10')).toBeInTheDocument();
    });
  });

  /**
   * Validates Requirement 12.2: Display compliance indicators
   */
  it('displays compliance indicators (Requirement 12.2)', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Compliance Status')).toBeInTheDocument();
      // Check for compliance items
      expect(screen.getByText('Microsoft Licenses')).toBeInTheDocument();
      expect(screen.getByText('Oracle Database')).toBeInTheDocument();
      expect(screen.getByText('Hardware Warranties')).toBeInTheDocument();
    });
  });
});

describe('DashboardPage - Dashboard Customization (Requirements 12.7, 12.8)', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    localStorageMock.clear();
  });

  /**
   * Validates Requirement 12.7: Dashboard widgets shall be configurable per user
   */
  it('shows customization toolbar (Requirement 12.7)', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('toolbar', { name: /dashboard customization/i })).toBeInTheDocument();
    });
  });

  /**
   * Validates Requirement 12.7: Dashboard widgets shall be configurable per user
   */
  it('allows entering edit mode (Requirement 12.7)', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /customize/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /customize/i }));

    expect(screen.getByText(/done editing/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add widget/i })).toBeInTheDocument();
  });

  /**
   * Validates Requirement 12.7: Dashboard widgets shall be configurable per user
   */
  it('allows adding widgets (Requirement 12.7)', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /customize/i })).toBeInTheDocument();
    });

    // Enter edit mode
    fireEvent.click(screen.getByRole('button', { name: /customize/i }));

    // Open widget picker - click the toolbar button
    const toolbar = screen.getByRole('toolbar');
    const addWidgetButton = toolbar.querySelector('button[title="Add widget"]') as HTMLButtonElement;
    fireEvent.click(addWidgetButton);

    // Widget picker should be visible
    expect(screen.getByRole('dialog', { name: /add widget/i })).toBeInTheDocument();
  });

  /**
   * Validates Requirement 12.7: Layout customization per user
   */
  it('persists layout changes (Requirement 12.7)', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /customize/i })).toBeInTheDocument();
    });

    // Enter edit mode
    fireEvent.click(screen.getByRole('button', { name: /customize/i }));

    // Add a widget - click the toolbar button
    const toolbar = screen.getByRole('toolbar');
    const addWidgetButton = toolbar.querySelector('button[title="Add widget"]') as HTMLButtonElement;
    fireEvent.click(addWidgetButton);
    
    fireEvent.click(screen.getByRole('option', { name: /statistics card/i }));
    
    // Click the add button in the dialog
    const dialog = screen.getByRole('dialog');
    const dialogAddButton = dialog.querySelector('footer button:last-child') as HTMLButtonElement;
    fireEvent.click(dialogAddButton);

    // Save changes
    fireEvent.click(screen.getByText(/save changes/i));

    // Verify localStorage was called
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  /**
   * Validates Requirement 12.8: Drill-down navigation from summary to detail views
   */
  it('supports drill-down navigation from widgets (Requirement 12.8)', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      // Wait for widgets to load
      expect(screen.getByText('Total Asset Value')).toBeInTheDocument();
    });

    // Find and click a drill-down button
    const drillDownButtons = screen.getAllByRole('button', { name: /navigate to details/i });
    expect(drillDownButtons.length).toBeGreaterThan(0);

    fireEvent.click(drillDownButtons[0]);

    // Should navigate to a detail view
    expect(mockNavigate).toHaveBeenCalled();
  });

  /**
   * Validates Requirement 12.8: Drill-down navigation from summary to detail views
   */
  it('navigates to assets when clicking category cards (Requirement 12.8)', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Hardware Assets')).toBeInTheDocument();
    });

    // Click on a category card
    const hardwareCard = screen.getByLabelText(/view hardware assets/i);
    fireEvent.click(hardwareCard);

    expect(mockNavigate).toHaveBeenCalledWith('/assets?type=HARDWARE');
  });

  /**
   * Validates Requirement 12.8: Drill-down from lifecycle chart
   */
  it('navigates to assets by status when clicking lifecycle chart (Requirement 12.8)', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Deployed').length).toBeGreaterThanOrEqual(1);
    });

    // Click on a lifecycle status in the chart
    const deployedButton = screen.getByRole('button', { name: /deployed.*click to view details/i });
    fireEvent.click(deployedButton);

    expect(mockNavigate).toHaveBeenCalledWith('/assets?status=DEPLOYED');
  });

  /**
   * Validates Requirement 12.7: Reset to default layout
   */
  it('allows resetting to default layout (Requirement 12.7)', async () => {
    renderWithRouter(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /customize/i })).toBeInTheDocument();
    });

    // Enter edit mode
    fireEvent.click(screen.getByRole('button', { name: /customize/i }));

    // Click reset
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));

    // Confirm reset
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reset layout/i }));

    // Layout should be reset (localStorage cleared and re-saved)
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });
});
