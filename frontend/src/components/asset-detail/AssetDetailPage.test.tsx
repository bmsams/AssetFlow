import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AssetDetailPage } from './AssetDetailPage';
import { getMockAssetDetail } from './mockData';

// Mock the asset API to return mock data
vi.mock('../../services/asset-api', () => ({
  assetApi: {
    getDetail: vi.fn((assetId) => {
      const detail = getMockAssetDetail(assetId);
      if (detail) return Promise.resolve(detail);
      return Promise.reject(new Error('Asset not found'));
    }),
    transitionState: vi.fn(() => Promise.resolve({ status: 'DEPLOYED' })),
    update: vi.fn(),
  },
}));

describe('AssetDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders asset header after loading', async () => {
    render(<AssetDetailPage assetId="asset-0001" />);
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dell Latitude 5540 Laptop' })).toBeInTheDocument();
    });
  });

  it('renders asset tag in header', async () => {
    render(<AssetDetailPage assetId="asset-0001" />);
    
    await waitFor(() => {
      expect(screen.getAllByText('AMS-HW-20240115-0001').length).toBeGreaterThan(0);
    });
  });

  it('renders type badge', async () => {
    render(<AssetDetailPage assetId="asset-0001" />);
    
    await waitFor(() => {
      expect(screen.getByText('Hardware')).toBeInTheDocument();
    });
  });

  it('renders status badge', async () => {
    render(<AssetDetailPage assetId="asset-0001" />);
    
    await waitFor(() => {
      expect(screen.getByText('Deployed')).toBeInTheDocument();
    });
  });

  it('renders all tabs', async () => {
    render(<AssetDetailPage assetId="asset-0001" />);
    
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Details/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Relationships/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /History/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Attachments/ })).toBeInTheDocument();
    });
  });

  it('shows Details tab content by default', async () => {
    render(<AssetDetailPage assetId="asset-0001" />);
    
    await waitFor(() => {
      expect(screen.getByText('General Information')).toBeInTheDocument();
      expect(screen.getByText('Hardware Details')).toBeInTheDocument();
    });
  });

  it('switches to Relationships tab when clicked', async () => {
    render(<AssetDetailPage assetId="asset-0001" />);
    
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Relationships/ })).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByRole('tab', { name: /Relationships/ }));
    
    await waitFor(() => {
      expect(screen.getByText('Server Rack A-01')).toBeInTheDocument();
    });
  });

  it('switches to History tab when clicked', async () => {
    render(<AssetDetailPage assetId="asset-0001" />);
    
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /History/ })).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByRole('tab', { name: /History/ }));
    
    await waitFor(() => {
      expect(screen.getByText('Audit History')).toBeInTheDocument();
      expect(screen.getByText('Asset created')).toBeInTheDocument();
    });
  });

  it('switches to Attachments tab when clicked', async () => {
    render(<AssetDetailPage assetId="asset-0001" />);
    
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Attachments/ })).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByRole('tab', { name: /Attachments/ }));
    
    await waitFor(() => {
      expect(screen.getByText('purchase_invoice.pdf')).toBeInTheDocument();
    });
  });

  it('calls onBack when back button is clicked', async () => {
    const onBack = vi.fn();
    render(<AssetDetailPage assetId="asset-0001" onBack={onBack} />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Go back to assets list')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByLabelText('Go back to assets list'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('toggles edit mode when edit button is clicked', async () => {
    render(<AssetDetailPage assetId="asset-0001" />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Edit asset')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByLabelText('Edit asset'));
    
    await waitFor(() => {
      expect(screen.getByLabelText('Edit Display Name')).toBeInTheDocument();
    });
  });

  it('exits edit mode when exit button is clicked', async () => {
    render(<AssetDetailPage assetId="asset-0001" />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Edit asset')).toBeInTheDocument();
    });
    
    // Enter edit mode
    fireEvent.click(screen.getByLabelText('Edit asset'));
    
    await waitFor(() => {
      expect(screen.getByLabelText('Edit Display Name')).toBeInTheDocument();
    });
    
    // Exit edit mode by clicking edit button again
    fireEvent.click(screen.getByLabelText('Edit asset'));
    
    await waitFor(() => {
      expect(screen.queryByLabelText('Edit Display Name')).not.toBeInTheDocument();
    });
  });

  it('shows error state when asset is not found', async () => {
    render(<AssetDetailPage assetId="non-existent-asset" />);
    
    await waitFor(() => {
      expect(screen.getByText('Unable to load asset')).toBeInTheDocument();
      expect(screen.getByText('Asset not found')).toBeInTheDocument();
    });
  });

  it('shows Go Back button in error state', async () => {
    const onBack = vi.fn();
    render(<AssetDetailPage assetId="non-existent-asset" onBack={onBack} />);
    
    await waitFor(() => {
      expect(screen.getByText('Go Back')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Go Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows Retry button in error state', async () => {
    render(<AssetDetailPage assetId="non-existent-asset" />);
    
    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('renders all four tabs with correct labels', async () => {
    render(<AssetDetailPage assetId="asset-0001" />);
    
    await waitFor(() => {
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(4);
      expect(tabs[0]).toHaveTextContent('Details');
      expect(tabs[1]).toHaveTextContent('Relationships');
      expect(tabs[2]).toHaveTextContent('History');
      expect(tabs[3]).toHaveTextContent('Attachments');
    });
  });

  it('loads software asset correctly', async () => {
    render(<AssetDetailPage assetId="asset-0002" />);
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Microsoft Office 365 E3' })).toBeInTheDocument();
      expect(screen.getByText('Software')).toBeInTheDocument();
    });
  });

  it('loads enterprise asset correctly', async () => {
    render(<AssetDetailPage assetId="asset-0003" />);
    
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'HVAC Unit - Building A' })).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
    });
  });
});

describe('AssetDetailPage - Accessibility', () => {
  it('has proper tab panel structure', async () => {
    render(<AssetDetailPage assetId="asset-0001" />);
    
    await waitFor(() => {
      // Tab list
      expect(screen.getByRole('tablist', { name: 'Asset sections' })).toBeInTheDocument();
      
      // Tabs
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(4);
      
      // Tab panel
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });
  });

  it('has correct aria-selected on active tab', async () => {
    render(<AssetDetailPage assetId="asset-0001" />);
    
    await waitFor(() => {
      const detailsTab = screen.getByRole('tab', { name: /Details/ });
      expect(detailsTab).toHaveAttribute('aria-selected', 'true');
      
      const relationshipsTab = screen.getByRole('tab', { name: /Relationships/ });
      expect(relationshipsTab).toHaveAttribute('aria-selected', 'false');
    });
  });

  it('updates aria-selected when tab changes', async () => {
    render(<AssetDetailPage assetId="asset-0001" />);
    
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Relationships/ })).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByRole('tab', { name: /Relationships/ }));
    
    await waitFor(() => {
      const detailsTab = screen.getByRole('tab', { name: /Details/ });
      expect(detailsTab).toHaveAttribute('aria-selected', 'false');
      
      const relationshipsTab = screen.getByRole('tab', { name: /Relationships/ });
      expect(relationshipsTab).toHaveAttribute('aria-selected', 'true');
    });
  });
});

describe('AssetDetailPage - Requirements Validation', () => {
  /**
   * Validates Requirement 2.1: System shall maintain a comprehensive asset registry with unique identifiers
   */
  it('displays comprehensive asset registry with unique identifier (Requirement 2.1)', async () => {
    render(<AssetDetailPage assetId="asset-0001" />);
    
    await waitFor(() => {
      // Unique identifier (asset tag) - appears in header and details
      expect(screen.getAllByText('AMS-HW-20240115-0001').length).toBeGreaterThan(0);
      
      // Asset name
      expect(screen.getByRole('heading', { name: 'Dell Latitude 5540 Laptop' })).toBeInTheDocument();
      
      // Asset type
      expect(screen.getByText('Hardware')).toBeInTheDocument();
      
      // Status
      expect(screen.getByText('Deployed')).toBeInTheDocument();
    });
    
    // Verify detailed attributes are shown
    await waitFor(() => {
      expect(screen.getByText('General Information')).toBeInTheDocument();
      expect(screen.getByText('Hardware Details')).toBeInTheDocument();
    });
  });

  /**
   * Validates Requirement 2.3: System shall support asset relationships (parent-child, dependencies)
   */
  it('displays asset relationships (Requirement 2.3)', async () => {
    render(<AssetDetailPage assetId="asset-0001" />);
    
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Relationships/ })).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByRole('tab', { name: /Relationships/ }));
    
    await waitFor(() => {
      // Parent-child relationship
      expect(screen.getByText('Parent/Child')).toBeInTheDocument();
      expect(screen.getByText('Server Rack A-01')).toBeInTheDocument();
      
      // Dependency relationship
      expect(screen.getByText('Dependency')).toBeInTheDocument();
      expect(screen.getByText('Microsoft Office 365 E3')).toBeInTheDocument();
      
      // Component relationship
      expect(screen.getByText('Component')).toBeInTheDocument();
      expect(screen.getByText('Samsung 1TB NVMe SSD')).toBeInTheDocument();
    });
  });

  /**
   * Validates Requirement 2.5: System shall maintain complete audit trail of all asset changes
   */
  it('displays complete audit trail (Requirement 2.5)', async () => {
    render(<AssetDetailPage assetId="asset-0001" />);
    
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /History/ })).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByRole('tab', { name: /History/ }));
    
    await waitFor(() => {
      // Audit history header
      expect(screen.getByText('Audit History')).toBeInTheDocument();
      
      // Various audit actions
      expect(screen.getByText('Created')).toBeInTheDocument();
      expect(screen.getAllByText('Updated').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Status Changed').length).toBeGreaterThan(0);
      expect(screen.getByText('Assignment')).toBeInTheDocument();
      
      // User names
      expect(screen.getAllByText('John Smith').length).toBeGreaterThan(0);
      
      // Change details
      expect(screen.getByText('Asset created')).toBeInTheDocument();
    });
  });

  /**
   * Validates inline editing capability
   */
  it('supports inline editing (Requirement 2.1)', async () => {
    render(<AssetDetailPage assetId="asset-0001" />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Edit asset')).toBeInTheDocument();
    });
    
    // Enter edit mode
    fireEvent.click(screen.getByLabelText('Edit asset'));
    
    await waitFor(() => {
      expect(screen.getByLabelText('Edit Display Name')).toBeInTheDocument();
    });
  });
});
