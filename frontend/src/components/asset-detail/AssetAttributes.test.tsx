import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AssetAttributes } from './AssetAttributes';
import { mockHardwareAssetDetail, mockSoftwareAssetDetail, mockEnterpriseAssetDetail } from './mockData';

describe('AssetAttributes', () => {
  describe('Common Attributes', () => {
    it('renders general information section', () => {
      render(<AssetAttributes asset={mockHardwareAssetDetail} />);
      expect(screen.getByText('General Information')).toBeInTheDocument();
    });

    it('renders asset ID', () => {
      render(<AssetAttributes asset={mockHardwareAssetDetail} />);
      expect(screen.getByText('Asset ID')).toBeInTheDocument();
      expect(screen.getByText('asset-0001')).toBeInTheDocument();
    });

    it('renders asset tag', () => {
      render(<AssetAttributes asset={mockHardwareAssetDetail} />);
      expect(screen.getByText('Asset Tag')).toBeInTheDocument();
      expect(screen.getByText('AMS-HW-20240115-0001')).toBeInTheDocument();
    });

    it('renders display name', () => {
      render(<AssetAttributes asset={mockHardwareAssetDetail} />);
      expect(screen.getByText('Display Name')).toBeInTheDocument();
      expect(screen.getByText('Dell Latitude 5540 Laptop')).toBeInTheDocument();
    });

    it('renders status', () => {
      render(<AssetAttributes asset={mockHardwareAssetDetail} />);
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('DEPLOYED')).toBeInTheDocument();
    });
  });

  describe('Hardware Attributes', () => {
    it('renders hardware details section', () => {
      render(<AssetAttributes asset={mockHardwareAssetDetail} />);
      expect(screen.getByText('Hardware Details')).toBeInTheDocument();
    });

    it('renders serial number', () => {
      render(<AssetAttributes asset={mockHardwareAssetDetail} />);
      expect(screen.getByText('Serial Number')).toBeInTheDocument();
      expect(screen.getByText('DELL-5540-ABC123XYZ')).toBeInTheDocument();
    });

    it('renders manufacturer', () => {
      render(<AssetAttributes asset={mockHardwareAssetDetail} />);
      expect(screen.getByText('Manufacturer')).toBeInTheDocument();
      expect(screen.getByText('Dell')).toBeInTheDocument();
    });

    it('renders model', () => {
      render(<AssetAttributes asset={mockHardwareAssetDetail} />);
      expect(screen.getByText('Model')).toBeInTheDocument();
      expect(screen.getByText('Latitude 5540')).toBeInTheDocument();
    });

    it('renders CPU', () => {
      render(<AssetAttributes asset={mockHardwareAssetDetail} />);
      expect(screen.getByText('CPU')).toBeInTheDocument();
      expect(screen.getByText('Intel Core i7-1365U')).toBeInTheDocument();
    });

    it('renders memory', () => {
      render(<AssetAttributes asset={mockHardwareAssetDetail} />);
      expect(screen.getByText('Memory (GB)')).toBeInTheDocument();
      expect(screen.getByText('16')).toBeInTheDocument();
    });

    it('renders purchase price as currency', () => {
      render(<AssetAttributes asset={mockHardwareAssetDetail} />);
      expect(screen.getByText('Purchase Price')).toBeInTheDocument();
      expect(screen.getByText('$1,499.99')).toBeInTheDocument();
    });
  });

  describe('Software Attributes', () => {
    it('renders software details section', () => {
      render(<AssetAttributes asset={mockSoftwareAssetDetail} />);
      expect(screen.getByText('Software Details')).toBeInTheDocument();
    });

    it('renders publisher', () => {
      render(<AssetAttributes asset={mockSoftwareAssetDetail} />);
      expect(screen.getByText('Publisher')).toBeInTheDocument();
      expect(screen.getByText('Microsoft')).toBeInTheDocument();
    });

    it('renders product name', () => {
      render(<AssetAttributes asset={mockSoftwareAssetDetail} />);
      expect(screen.getByText('Product Name')).toBeInTheDocument();
      expect(screen.getByText('Office 365')).toBeInTheDocument();
    });

    it('renders license type', () => {
      render(<AssetAttributes asset={mockSoftwareAssetDetail} />);
      expect(screen.getByText('License Type')).toBeInTheDocument();
      expect(screen.getByText('Subscription')).toBeInTheDocument();
    });

    it('renders SaaS indicator', () => {
      render(<AssetAttributes asset={mockSoftwareAssetDetail} />);
      expect(screen.getByText('SaaS')).toBeInTheDocument();
      expect(screen.getByText('Yes')).toBeInTheDocument();
    });

    it('renders compliance status', () => {
      render(<AssetAttributes asset={mockSoftwareAssetDetail} />);
      expect(screen.getByText('Compliance Status')).toBeInTheDocument();
      expect(screen.getByText('COMPLIANT')).toBeInTheDocument();
    });
  });

  describe('Enterprise Attributes', () => {
    it('renders enterprise details section', () => {
      render(<AssetAttributes asset={mockEnterpriseAssetDetail} />);
      expect(screen.getByText('Enterprise Details')).toBeInTheDocument();
    });

    it('renders asset class', () => {
      render(<AssetAttributes asset={mockEnterpriseAssetDetail} />);
      expect(screen.getByText('Asset Class')).toBeInTheDocument();
      expect(screen.getByText('HVAC')).toBeInTheDocument();
    });

    it('renders criticality level', () => {
      render(<AssetAttributes asset={mockEnterpriseAssetDetail} />);
      expect(screen.getByText('Criticality')).toBeInTheDocument();
      expect(screen.getByText('HIGH')).toBeInTheDocument();
    });

    it('renders facility name', () => {
      render(<AssetAttributes asset={mockEnterpriseAssetDetail} />);
      expect(screen.getByText('Facility')).toBeInTheDocument();
      expect(screen.getByText('Corporate Headquarters')).toBeInTheDocument();
    });

    it('renders maintenance plan', () => {
      render(<AssetAttributes asset={mockEnterpriseAssetDetail} />);
      expect(screen.getByText('Maintenance Plan')).toBeInTheDocument();
      expect(screen.getByText('Quarterly HVAC Maintenance')).toBeInTheDocument();
    });
  });

  describe('Inline Editing', () => {
    it('shows edit icon on editable fields when editMode is true', () => {
      render(<AssetAttributes asset={mockHardwareAssetDetail} editMode={true} />);
      
      // Display Name is editable
      const displayNameValue = screen.getByText('Dell Latitude 5540 Laptop');
      expect(displayNameValue).toHaveAttribute('role', 'button');
    });

    it('does not show edit icon when editMode is false', () => {
      render(<AssetAttributes asset={mockHardwareAssetDetail} editMode={false} />);
      
      const displayNameValue = screen.getByText('Dell Latitude 5540 Laptop');
      expect(displayNameValue).not.toHaveAttribute('role', 'button');
    });

    it('shows input field when editable field is clicked', async () => {
      render(<AssetAttributes asset={mockHardwareAssetDetail} editMode={true} />);
      
      const displayNameValue = screen.getByText('Dell Latitude 5540 Laptop');
      fireEvent.click(displayNameValue);
      
      await waitFor(() => {
        expect(screen.getByLabelText('Edit Display Name')).toBeInTheDocument();
      });
    });

    it('calls onAttributeChange when edit is saved', async () => {
      const onAttributeChange = vi.fn();
      render(
        <AssetAttributes
          asset={mockHardwareAssetDetail}
          editMode={true}
          onAttributeChange={onAttributeChange}
        />
      );
      
      // Click to edit
      const displayNameValue = screen.getByText('Dell Latitude 5540 Laptop');
      fireEvent.click(displayNameValue);
      
      // Change value
      const input = await screen.findByLabelText('Edit Display Name');
      fireEvent.change(input, { target: { value: 'New Name' } });
      
      // Save
      fireEvent.click(screen.getByLabelText('Save'));
      
      expect(onAttributeChange).toHaveBeenCalledWith('displayName', 'New Name');
    });

    it('cancels edit when cancel button is clicked', async () => {
      render(<AssetAttributes asset={mockHardwareAssetDetail} editMode={true} />);
      
      // Click to edit
      const displayNameValue = screen.getByText('Dell Latitude 5540 Laptop');
      fireEvent.click(displayNameValue);
      
      // Cancel
      fireEvent.click(screen.getByLabelText('Cancel'));
      
      // Should show original value again
      await waitFor(() => {
        expect(screen.getByText('Dell Latitude 5540 Laptop')).toBeInTheDocument();
      });
    });

    it('saves edit when Enter key is pressed', async () => {
      const onAttributeChange = vi.fn();
      render(
        <AssetAttributes
          asset={mockHardwareAssetDetail}
          editMode={true}
          onAttributeChange={onAttributeChange}
        />
      );
      
      // Click to edit
      const displayNameValue = screen.getByText('Dell Latitude 5540 Laptop');
      fireEvent.click(displayNameValue);
      
      // Change value and press Enter
      const input = await screen.findByLabelText('Edit Display Name');
      fireEvent.change(input, { target: { value: 'New Name' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(onAttributeChange).toHaveBeenCalledWith('displayName', 'New Name');
    });

    it('cancels edit when Escape key is pressed', async () => {
      render(<AssetAttributes asset={mockHardwareAssetDetail} editMode={true} />);
      
      // Click to edit
      const displayNameValue = screen.getByText('Dell Latitude 5540 Laptop');
      fireEvent.click(displayNameValue);
      
      // Press Escape
      const input = await screen.findByLabelText('Edit Display Name');
      fireEvent.keyDown(input, { key: 'Escape' });
      
      // Should show original value again
      await waitFor(() => {
        expect(screen.getByText('Dell Latitude 5540 Laptop')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('renders loading skeleton when isLoading is true', () => {
      render(<AssetAttributes asset={mockHardwareAssetDetail} isLoading={true} />);
      
      // Should have aria-busy attribute on the container
      const container = document.querySelector('[aria-busy="true"]');
      expect(container).toBeInTheDocument();
    });
  });
});

describe('AssetAttributes - Requirements Validation', () => {
  /**
   * Validates Requirement 2.1: Display all asset attributes by type
   */
  it('displays all asset attributes by type (Requirement 2.1)', () => {
    render(<AssetAttributes asset={mockHardwareAssetDetail} />);
    
    // General attributes
    expect(screen.getByText('Asset ID')).toBeInTheDocument();
    expect(screen.getByText('Asset Tag')).toBeInTheDocument();
    expect(screen.getByText('Display Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    
    // Hardware-specific attributes
    expect(screen.getByText('Hardware Details')).toBeInTheDocument();
    expect(screen.getByText('Serial Number')).toBeInTheDocument();
    expect(screen.getByText('Manufacturer')).toBeInTheDocument();
    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('Memory (GB)')).toBeInTheDocument();
    expect(screen.getByText('Storage (GB)')).toBeInTheDocument();
  });
});
