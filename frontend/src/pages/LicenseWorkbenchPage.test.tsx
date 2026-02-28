import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LicenseWorkbenchPage } from './LicenseWorkbenchPage';
import { mockLicenseWorkbenchSummary } from '../components/license/mockData';

// Mock sam-api to return mock data
vi.mock('../services/sam-api', () => ({
  getLicenseWorkbenchSummary: vi.fn(() => Promise.resolve(mockLicenseWorkbenchSummary)),
  runReconciliation: vi.fn(),
  initiateReclamation: vi.fn(),
  analyzeShadowIt: vi.fn(),
  generateComplianceReport: vi.fn(),
  syncSaasUsage: vi.fn(),
  applyPublisherRules: vi.fn(),
  getUnusedSubscriptions: vi.fn(),
}));

// Mock useAuth
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { userId: 'test', email: 'test@test.com', name: 'Test', roles: ['admin', 'license_analyst'] },
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
      <LicenseWorkbenchPage />
    </MemoryRouter>
  );
}

describe('LicenseWorkbenchPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the page title', async () => {
    renderPage();
    
    expect(screen.getByRole('heading', { name: 'License Workbench' })).toBeInTheDocument();
  });

  it('renders the page description', async () => {
    renderPage();
    
    expect(screen.getByText(/Monitor software compliance, audit risks/)).toBeInTheDocument();
  });

  it('displays summary statistics labels', async () => {
    renderPage();
    
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      expect(screen.getByText('Software Titles')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Under-Licensed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Audit Risks').length).toBeGreaterThan(0);
    expect(screen.getByText('Reclamation Savings')).toBeInTheDocument();
  });

  it('displays entitlement value summary section', async () => {
    renderPage();
    
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      expect(screen.getByText('Total Entitlement Value')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Over-Licensed').length).toBeGreaterThan(0);
    expect(screen.getByText('Potential Exposure')).toBeInTheDocument();
  });

  it('renders compliance positions section', async () => {
    renderPage();
    
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      expect(screen.getByText('Compliance Positions')).toBeInTheDocument();
    });
  });

  it('renders audit risks section', async () => {
    renderPage();
    
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      expect(screen.getByRole('region', { name: /Audit risks/ })).toBeInTheDocument();
    });
  });

  it('renders reclamation opportunities section', async () => {
    renderPage();
    
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      expect(screen.getByText('Reclamation Opportunities')).toBeInTheDocument();
    });
  });

  it('has accessible section labels', async () => {
    renderPage();
    
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      expect(screen.getByRole('region', { name: /License summary statistics/ })).toBeInTheDocument();
    });
    expect(screen.getByRole('region', { name: /Entitlement value summary/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Compliance positions/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Audit risks/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Reclamation opportunities/ })).toBeInTheDocument();
  });
});

describe('LicenseWorkbenchPage - Requirements Validation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('displays compliance positions by software title (Requirement 12.5)', async () => {
    renderPage();
    
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      expect(screen.getByText('Compliance Positions')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Microsoft 365 E3').length).toBeGreaterThan(0);
  });

  it('shows audit risks (Requirement 12.5)', async () => {
    renderPage();
    
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      expect(screen.getByRole('region', { name: /Audit risks/ })).toBeInTheDocument();
    });
    expect(screen.getAllByText('SQL Server Enterprise').length).toBeGreaterThan(0);
  });

  it('shows reclamation opportunities (Requirement 12.5)', async () => {
    renderPage();
    
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      expect(screen.getByRole('region', { name: /Reclamation opportunities/ })).toBeInTheDocument();
    });
    expect(screen.getAllByText('Adobe Creative Cloud').length).toBeGreaterThan(0);
  });

  it('displays all three key areas (Requirement 4.10)', async () => {
    renderPage();
    
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      expect(screen.getByText('Compliance Positions')).toBeInTheDocument();
    });
    expect(screen.getByRole('region', { name: /Audit risks/ })).toBeInTheDocument();
    expect(screen.getByText('Reclamation Opportunities')).toBeInTheDocument();
  });

  it('supports drill-down navigation via clickable items (Requirement 12.5)', async () => {
    renderPage();
    
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      expect(screen.getByLabelText(/View Microsoft 365 E3 compliance details/)).toBeInTheDocument();
    });
  });
});
