import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LicenseWorkbenchPage } from './LicenseWorkbenchPage';

describe('LicenseWorkbenchPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the page title', async () => {
    render(<LicenseWorkbenchPage />);
    
    // Title should be visible immediately
    expect(screen.getByText('License Workbench')).toBeInTheDocument();
  });

  it('renders the page description', async () => {
    render(<LicenseWorkbenchPage />);
    
    expect(screen.getByText(/Monitor software compliance, audit risks/)).toBeInTheDocument();
  });

  it('displays summary statistics labels', async () => {
    render(<LicenseWorkbenchPage />);
    
    // Advance timers to allow data to load
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      expect(screen.getByText('Software Titles')).toBeInTheDocument();
    });
    // Under-Licensed appears in both stats and compliance positions
    expect(screen.getAllByText('Under-Licensed').length).toBeGreaterThan(0);
    // Audit Risks appears in both stats and section title
    expect(screen.getAllByText('Audit Risks').length).toBeGreaterThan(0);
    expect(screen.getByText('Reclamation Savings')).toBeInTheDocument();
  });

  it('displays entitlement value summary section', async () => {
    render(<LicenseWorkbenchPage />);
    
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      expect(screen.getByText('Total Entitlement Value')).toBeInTheDocument();
    });
    // Over-Licensed appears in both value summary and compliance positions
    expect(screen.getAllByText('Over-Licensed').length).toBeGreaterThan(0);
    expect(screen.getByText('Potential Exposure')).toBeInTheDocument();
  });

  it('renders compliance positions section', async () => {
    render(<LicenseWorkbenchPage />);
    
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      expect(screen.getByText('Compliance Positions')).toBeInTheDocument();
    });
  });

  it('renders audit risks section', async () => {
    render(<LicenseWorkbenchPage />);
    
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      // Look for the section by aria-label
      expect(screen.getByRole('region', { name: /Audit risks/ })).toBeInTheDocument();
    });
  });

  it('renders reclamation opportunities section', async () => {
    render(<LicenseWorkbenchPage />);
    
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      expect(screen.getByText('Reclamation Opportunities')).toBeInTheDocument();
    });
  });

  it('has accessible section labels', async () => {
    render(<LicenseWorkbenchPage />);
    
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

  /**
   * Validates Requirement 12.5: License Workbench displays compliance positions
   */
  it('displays compliance positions by software title (Requirement 12.5)', async () => {
    render(<LicenseWorkbenchPage />);
    
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      // Verify compliance positions section exists
      expect(screen.getByText('Compliance Positions')).toBeInTheDocument();
    });
    // Verify software titles are displayed (may appear in multiple sections)
    expect(screen.getAllByText('Microsoft 365 E3').length).toBeGreaterThan(0);
  });

  /**
   * Validates Requirement 12.5: License Workbench shows audit risks
   */
  it('shows audit risks (Requirement 12.5)', async () => {
    render(<LicenseWorkbenchPage />);
    
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      // Verify audit risks section exists
      expect(screen.getByRole('region', { name: /Audit risks/ })).toBeInTheDocument();
    });
    // Verify audit risk data is displayed (may appear in multiple sections)
    expect(screen.getAllByText('SQL Server Enterprise').length).toBeGreaterThan(0);
  });

  /**
   * Validates Requirement 12.5: License Workbench shows reclamation opportunities
   */
  it('shows reclamation opportunities (Requirement 12.5)', async () => {
    render(<LicenseWorkbenchPage />);
    
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      // Verify reclamation opportunities section exists
      expect(screen.getByRole('region', { name: /Reclamation opportunities/ })).toBeInTheDocument();
    });
    // Verify reclamation data is displayed (may appear in multiple sections)
    expect(screen.getAllByText('Adobe Creative Cloud').length).toBeGreaterThan(0);
  });

  /**
   * Validates Requirement 4.10: Display compliance positions, audit risks, and optimization opportunities
   */
  it('displays all three key areas (Requirement 4.10)', async () => {
    render(<LicenseWorkbenchPage />);
    
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      // All three sections should be present
      expect(screen.getByText('Compliance Positions')).toBeInTheDocument();
    });
    expect(screen.getByRole('region', { name: /Audit risks/ })).toBeInTheDocument();
    expect(screen.getByText('Reclamation Opportunities')).toBeInTheDocument();
  });

  /**
   * Validates Requirement 12.5: Implement drill-down to detailed records
   */
  it('supports drill-down navigation via clickable items (Requirement 12.5)', async () => {
    render(<LicenseWorkbenchPage />);
    
    await vi.advanceTimersByTimeAsync(1000);
    
    await waitFor(() => {
      // Verify items are clickable (have accessible labels for drill-down)
      expect(screen.getByLabelText(/View Microsoft 365 E3 compliance details/)).toBeInTheDocument();
    });
  });
});
