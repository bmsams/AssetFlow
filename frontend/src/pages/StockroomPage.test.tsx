import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StockroomPage } from './StockroomPage';

// Mock admin-api to return mock data
const mockAdminStockrooms = [
  {
    stockroomId: 'sr-001',
    stockroomCode: 'MAIN-IT',
    name: 'Main IT Stockroom',
    description: 'Primary IT equipment stockroom',
    stockroomType: 'STANDARD',
    roomId: 'room-001',
    roomName: 'Building A, Floor 1',
    managerId: 'user-001',
    managerName: 'John Smith',
    totalItems: 450,
    totalValue: 2500000,
    binCount: 40,
    totalBins: 50,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2025-01-26T00:00:00Z',
  },
  {
    stockroomId: 'sr-002',
    stockroomCode: 'NET-EQUIP',
    name: 'Network Equipment Room',
    description: 'Network infrastructure equipment',
    stockroomType: 'STANDARD',
    roomId: 'room-002',
    roomName: 'Data Center B',
    managerId: 'user-002',
    managerName: 'Sarah Johnson',
    totalItems: 200,
    totalValue: 1500000,
    binCount: 20,
    totalBins: 30,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2025-01-26T00:00:00Z',
  },
  {
    stockroomId: 'sr-003',
    stockroomCode: 'LOANER',
    name: 'Loaner Pool',
    description: 'Loaner equipment pool',
    stockroomType: 'LOANER',
    roomId: 'room-003',
    roomName: 'Building A, Floor 2',
    managerId: 'user-001',
    managerName: 'John Smith',
    totalItems: 50,
    totalValue: 150000,
    binCount: 10,
    totalBins: 15,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2025-01-26T00:00:00Z',
  },
];

vi.mock('../services/admin-api', () => ({
  adminApi: {
    stockrooms: {
      list: vi.fn(() => Promise.resolve({
        items: mockAdminStockrooms,
        total: mockAdminStockrooms.length,
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
      <StockroomPage />
    </MemoryRouter>
  );
}

describe('StockroomPage', () => {
  it('renders page title', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Stockroom Dashboard' })).toBeInTheDocument();
  });

  it('renders page description', () => {
    renderPage();
    expect(
      screen.getByText('Monitor inventory levels, transfers, and replenishment needs')
    ).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    renderPage();
    const loadingElements = screen.getAllByText('Loading statistic');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('renders stat cards after loading', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Total Stockrooms')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Inventory Value')).toBeInTheDocument();
    expect(screen.getByText('Low Stock Alerts')).toBeInTheDocument();
    expect(screen.getByText('Active Transfers')).toBeInTheDocument();
  });

  it('renders inventory levels section', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Inventory by Stockroom')).toBeInTheDocument();
    });

    const mainStockroomElements = screen.getAllByText('Main IT Stockroom');
    expect(mainStockroomElements.length).toBeGreaterThan(0);
  });

  it('renders transfer orders section', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Transfer Orders')).toBeInTheDocument();
    });
  });

  it('renders replenishment alerts section', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Replenishment Alerts')).toBeInTheDocument();
    });
  });

  it('displays stockroom count', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Total Stockrooms')).toBeInTheDocument();
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

  it('shows non-zero inventory quantities on dashboard cards and stockroom rows', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('700 items')).toBeInTheDocument();
      expect(screen.getByText('450 items')).toBeInTheDocument();
    });
  });
});

describe('StockroomPage - Requirements Validation', () => {
  it('displays inventory levels by stockroom (Requirement 12.4)', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Inventory by Stockroom')).toBeInTheDocument();
      
      const mainStockroomElements = screen.getAllByText('Main IT Stockroom');
      expect(mainStockroomElements.length).toBeGreaterThan(0);
    });
  });

  it('displays stockroom summary statistics (Requirement 12.4)', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Total Stockrooms')).toBeInTheDocument();
      expect(screen.getByText('Total Inventory Value')).toBeInTheDocument();
      expect(screen.getByText('Low Stock Alerts')).toBeInTheDocument();
      expect(screen.getByText('Active Transfers')).toBeInTheDocument();
    });
  });

  it('shows transfer orders section (Requirement 12.4)', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Transfer Orders')).toBeInTheDocument();
    });
  });

  it('shows replenishment alerts section (Requirement 12.4)', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Replenishment Alerts')).toBeInTheDocument();
    });
  });
});
