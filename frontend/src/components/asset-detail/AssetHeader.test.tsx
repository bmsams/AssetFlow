import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetHeader } from './AssetHeader';
import { mockHardwareAssetDetail, mockSoftwareAssetDetail, mockEnterpriseAssetDetail } from './mockData';

describe('AssetHeader', () => {
  it('renders asset display name', () => {
    render(<AssetHeader asset={mockHardwareAssetDetail} />);
    expect(screen.getByText('Dell Latitude 5540 Laptop')).toBeInTheDocument();
  });

  it('renders asset tag', () => {
    render(<AssetHeader asset={mockHardwareAssetDetail} />);
    expect(screen.getByText('AMS-HW-20240115-0001')).toBeInTheDocument();
  });

  it('renders hardware type badge', () => {
    render(<AssetHeader asset={mockHardwareAssetDetail} />);
    expect(screen.getByText('Hardware')).toBeInTheDocument();
  });

  it('renders software type badge', () => {
    render(<AssetHeader asset={mockSoftwareAssetDetail} />);
    expect(screen.getByText('Software')).toBeInTheDocument();
  });

  it('renders enterprise type badge', () => {
    render(<AssetHeader asset={mockEnterpriseAssetDetail} />);
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<AssetHeader asset={mockHardwareAssetDetail} />);
    expect(screen.getByText('Deployed')).toBeInTheDocument();
  });

  it('renders last updated date', () => {
    render(<AssetHeader asset={mockHardwareAssetDetail} />);
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });

  it('renders back button', () => {
    render(<AssetHeader asset={mockHardwareAssetDetail} />);
    expect(screen.getByLabelText('Go back to assets list')).toBeInTheDocument();
  });

  it('renders edit button', () => {
    render(<AssetHeader asset={mockHardwareAssetDetail} />);
    expect(screen.getByLabelText('Edit asset')).toBeInTheDocument();
  });

  it('renders more actions button', () => {
    render(<AssetHeader asset={mockHardwareAssetDetail} />);
    expect(screen.getByLabelText('More actions')).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn();
    render(<AssetHeader asset={mockHardwareAssetDetail} onBack={onBack} />);
    
    fireEvent.click(screen.getByLabelText('Go back to assets list'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = vi.fn();
    render(<AssetHeader asset={mockHardwareAssetDetail} onEdit={onEdit} />);
    
    fireEvent.click(screen.getByLabelText('Edit asset'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('renders loading skeleton when isLoading is true', () => {
    render(<AssetHeader asset={mockHardwareAssetDetail} isLoading={true} />);
    
    // Should not render the actual content
    expect(screen.queryByText('Dell Latitude 5540 Laptop')).not.toBeInTheDocument();
    
    // Should have aria-busy attribute
    expect(screen.getByRole('banner')).toHaveAttribute('aria-busy', 'true');
  });
});

describe('AssetHeader - Requirements Validation', () => {
  /**
   * Validates Requirement 2.1: Display asset with unique identifier
   */
  it('displays asset with unique identifier (Requirement 2.1)', () => {
    render(<AssetHeader asset={mockHardwareAssetDetail} />);
    
    // Asset tag is the unique identifier
    expect(screen.getByText('AMS-HW-20240115-0001')).toBeInTheDocument();
    
    // Display name is shown
    expect(screen.getByText('Dell Latitude 5540 Laptop')).toBeInTheDocument();
    
    // Type badge is shown
    expect(screen.getByText('Hardware')).toBeInTheDocument();
    
    // Status is shown
    expect(screen.getByText('Deployed')).toBeInTheDocument();
  });
});
