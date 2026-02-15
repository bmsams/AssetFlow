import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssetForm } from './AssetForm';
import type { HardwareAsset, SoftwareAsset, EnterpriseAsset } from '../../types/asset';

describe('AssetForm', () => {
  const defaultProps = {
    mode: 'create' as const,
    onSubmit: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Mode', () => {
    it('renders create form with title', () => {
      render(<AssetForm {...defaultProps} />);
      
      expect(screen.getByText('Create New Asset')).toBeInTheDocument();
      expect(screen.getByText('Fill in the details below to create a new asset')).toBeInTheDocument();
    });

    it('renders asset type selector', () => {
      render(<AssetForm {...defaultProps} />);
      
      expect(screen.getByText('Hardware')).toBeInTheDocument();
      expect(screen.getByText('Software')).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
    });

    it('renders general information fields', () => {
      render(<AssetForm {...defaultProps} />);
      
      expect(screen.getByLabelText(/Display Name/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Status/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    });

    it('disables submit button when no asset type selected', () => {
      render(<AssetForm {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: 'Create Asset' })).toBeDisabled();
    });

    it('enables submit button when asset type is selected', async () => {
      render(<AssetForm {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Hardware'));
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Create Asset' })).not.toBeDisabled();
      });
    });
  });

  describe('Edit Mode', () => {
    const mockHardwareAsset: HardwareAsset = {
      assetId: 'asset-001',
      assetTag: 'AMS-HW-20240115-0001',
      assetType: 'HARDWARE',
      displayName: 'Dell Laptop',
      description: 'Development laptop',
      status: 'DEPLOYED',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
      serialNumber: 'DELL-ABC123',
      manufacturer: 'Dell',
      model: 'Latitude 5540',
    };

    it('renders edit form with title', () => {
      render(<AssetForm {...defaultProps} mode="edit" initialData={mockHardwareAsset} />);
      
      expect(screen.getByText('Edit Asset')).toBeInTheDocument();
      expect(screen.getByText('Update the asset information below')).toBeInTheDocument();
    });

    it('does not render asset type selector in edit mode', () => {
      render(<AssetForm {...defaultProps} mode="edit" initialData={mockHardwareAsset} />);
      
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    });

    it('pre-fills form with initial data', () => {
      render(<AssetForm {...defaultProps} mode="edit" initialData={mockHardwareAsset} />);
      
      expect(screen.getByLabelText(/Display Name/)).toHaveValue('Dell Laptop');
      expect(screen.getByLabelText(/Description/)).toHaveValue('Development laptop');
    });

    it('shows Save Changes button in edit mode', () => {
      render(<AssetForm {...defaultProps} mode="edit" initialData={mockHardwareAsset} />);
      
      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    });
  });

  describe('Hardware Form Fields', () => {
    it('shows hardware-specific fields when Hardware is selected', async () => {
      render(<AssetForm {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Hardware'));
      
      await waitFor(() => {
        expect(screen.getByText('Hardware Details')).toBeInTheDocument();
        expect(screen.getByLabelText(/Serial Number/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Manufacturer/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Model/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Category/)).toBeInTheDocument();
      });
    });

    it('shows technical specifications section', async () => {
      render(<AssetForm {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Hardware'));
      
      await waitFor(() => {
        expect(screen.getByText('Technical Specifications')).toBeInTheDocument();
        expect(screen.getByLabelText(/CPU/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Memory \(GB\)/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Storage \(GB\)/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Operating System/)).toBeInTheDocument();
      });
    });

    it('shows network section', async () => {
      render(<AssetForm {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Hardware'));
      
      await waitFor(() => {
        expect(screen.getByText('Network')).toBeInTheDocument();
        expect(screen.getByLabelText(/IP Address/)).toBeInTheDocument();
        expect(screen.getByLabelText(/MAC Address/)).toBeInTheDocument();
      });
    });

    it('shows financial section', async () => {
      render(<AssetForm {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Hardware'));
      
      await waitFor(() => {
        expect(screen.getByText('Financial')).toBeInTheDocument();
        expect(screen.getByLabelText(/Purchase Price/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Warranty Expiration/)).toBeInTheDocument();
      });
    });
  });

  describe('Software Form Fields', () => {
    it('shows software-specific fields when Software is selected', async () => {
      render(<AssetForm {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Software'));
      
      await waitFor(() => {
        expect(screen.getByText('Software Details')).toBeInTheDocument();
        expect(screen.getByLabelText(/Publisher/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Product Name/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Version/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Edition/)).toBeInTheDocument();
        expect(screen.getByLabelText(/License Type/)).toBeInTheDocument();
      });
    });

    it('shows SaaS checkbox', async () => {
      render(<AssetForm {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Software'));
      
      await waitFor(() => {
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
      });
    });
  });

  describe('Enterprise Form Fields', () => {
    it('shows enterprise-specific fields when Enterprise is selected', async () => {
      render(<AssetForm {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Enterprise'));
      
      await waitFor(() => {
        expect(screen.getByText('Enterprise Asset Details')).toBeInTheDocument();
        expect(screen.getByLabelText(/Serial Number/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Manufacturer/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Model/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Asset Class/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Criticality Level/)).toBeInTheDocument();
      });
    });

    it('shows operational data section', async () => {
      render(<AssetForm {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Enterprise'));
      
      await waitFor(() => {
        expect(screen.getByText('Operational Data')).toBeInTheDocument();
        expect(screen.getByLabelText(/Operating Hours/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Meter Reading/)).toBeInTheDocument();
      });
    });
  });

  describe('Custom Attributes', () => {
    it('shows custom attributes editor when asset type is selected', async () => {
      render(<AssetForm {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Hardware'));
      
      await waitFor(() => {
        expect(screen.getByText('Custom Attributes')).toBeInTheDocument();
      });
    });

    it('does not show custom attributes when no asset type selected', () => {
      render(<AssetForm {...defaultProps} />);
      
      expect(screen.queryByText('Custom Attributes')).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('shows validation error for empty display name on submit', async () => {
      render(<AssetForm {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Hardware'));
      fireEvent.click(screen.getByRole('button', { name: 'Create Asset' }));
      
      await waitFor(() => {
        expect(screen.getByText('Display Name is required')).toBeInTheDocument();
      });
    });

    it('shows validation error for short display name', async () => {
      render(<AssetForm {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Hardware'));
      fireEvent.change(screen.getByLabelText(/Display Name/), { target: { value: 'ab' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create Asset' }));
      
      await waitFor(() => {
        expect(screen.getByText('Display Name must be at least 3 characters')).toBeInTheDocument();
      });
    });

    it('shows validation error for invalid IP address', async () => {
      render(<AssetForm {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Hardware'));
      fireEvent.change(screen.getByLabelText(/Display Name/), { target: { value: 'Test Asset' } });
      fireEvent.change(screen.getByLabelText(/IP Address/), { target: { value: 'invalid' } });
      fireEvent.blur(screen.getByLabelText(/IP Address/));
      
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid IP address')).toBeInTheDocument();
      });
    });

    it('shows validation error for missing publisher in software form', async () => {
      render(<AssetForm {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Software'));
      fireEvent.change(screen.getByLabelText(/Display Name/), { target: { value: 'Test Software' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create Asset' }));
      
      await waitFor(() => {
        expect(screen.getByText('Publisher is required')).toBeInTheDocument();
      });
    });

    it('clears error when field is corrected', async () => {
      render(<AssetForm {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Hardware'));
      fireEvent.click(screen.getByRole('button', { name: 'Create Asset' }));
      
      await waitFor(() => {
        expect(screen.getByText('Display Name is required')).toBeInTheDocument();
      });
      
      fireEvent.change(screen.getByLabelText(/Display Name/), { target: { value: 'Valid Name' } });
      
      await waitFor(() => {
        expect(screen.queryByText('Display Name is required')).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('calls onSubmit with form data when valid', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      render(<AssetForm {...defaultProps} onSubmit={onSubmit} />);
      
      fireEvent.click(screen.getByText('Hardware'));
      fireEvent.change(screen.getByLabelText(/Display Name/), { target: { value: 'Test Asset' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create Asset' }));
      
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            assetType: 'HARDWARE',
            displayName: 'Test Asset',
          })
        );
      });
    });

    it('does not call onSubmit when form is invalid', async () => {
      const onSubmit = vi.fn();
      render(<AssetForm {...defaultProps} onSubmit={onSubmit} />);
      
      fireEvent.click(screen.getByText('Hardware'));
      fireEvent.click(screen.getByRole('button', { name: 'Create Asset' }));
      
      await waitFor(() => {
        expect(onSubmit).not.toHaveBeenCalled();
      });
    });

    it('shows loading state during submission', async () => {
      const onSubmit = vi.fn().mockImplementation(() => new Promise(() => {}));
      render(<AssetForm {...defaultProps} onSubmit={onSubmit} isSubmitting />);
      
      fireEvent.click(screen.getByText('Hardware'));
      
      expect(screen.getByRole('button', { name: /Creating.../ })).toBeInTheDocument();
    });

    it('disables form during submission', () => {
      render(<AssetForm {...defaultProps} isSubmitting />);
      
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    });
  });

  describe('Cancel Action', () => {
    it('calls onCancel when cancel button is clicked', () => {
      const onCancel = vi.fn();
      render(<AssetForm {...defaultProps} onCancel={onCancel} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      
      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Asset Type Switching', () => {
    it('preserves common fields when switching asset type', async () => {
      render(<AssetForm {...defaultProps} />);
      
      // Select Hardware and fill in display name
      fireEvent.click(screen.getByText('Hardware'));
      fireEvent.change(screen.getByLabelText(/Display Name/), { target: { value: 'Test Asset' } });
      
      // Switch to Software
      fireEvent.click(screen.getByText('Software'));
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Display Name/)).toHaveValue('Test Asset');
      });
    });

    it('clears type-specific fields when switching asset type', async () => {
      render(<AssetForm {...defaultProps} />);
      
      // Select Hardware and fill in serial number
      fireEvent.click(screen.getByText('Hardware'));
      fireEvent.change(screen.getByLabelText(/Serial Number/), { target: { value: 'ABC123' } });
      
      // Switch to Software
      fireEvent.click(screen.getByText('Software'));
      
      // Switch back to Hardware
      fireEvent.click(screen.getByText('Hardware'));
      
      await waitFor(() => {
        expect(screen.getByLabelText(/Serial Number/)).toHaveValue('');
      });
    });
  });
});

describe('AssetForm - Requirements Validation', () => {
  /**
   * Validates Requirement 2.1: System shall maintain a comprehensive asset registry with unique identifiers
   */
  it('supports comprehensive asset creation (Requirement 2.1)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AssetForm mode="create" onSubmit={onSubmit} onCancel={vi.fn()} />);
    
    // Select Hardware type
    fireEvent.click(screen.getByText('Hardware'));
    
    // Fill in comprehensive asset data
    fireEvent.change(screen.getByLabelText(/Display Name/), { target: { value: 'Dell Latitude 5540' } });
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'Development laptop' } });
    fireEvent.change(screen.getByLabelText(/Serial Number/), { target: { value: 'DELL-ABC123' } });
    fireEvent.change(screen.getByLabelText(/Manufacturer/), { target: { value: 'Dell' } });
    fireEvent.change(screen.getByLabelText(/Model/), { target: { value: 'Latitude 5540' } });
    fireEvent.change(screen.getByLabelText(/CPU/), { target: { value: 'Intel Core i7' } });
    fireEvent.change(screen.getByLabelText(/Memory \(GB\)/), { target: { value: '16' } });
    fireEvent.change(screen.getByLabelText(/Storage \(GB\)/), { target: { value: '512' } });
    
    fireEvent.click(screen.getByRole('button', { name: 'Create Asset' }));
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          assetType: 'HARDWARE',
          displayName: 'Dell Latitude 5540',
          description: 'Development laptop',
          serialNumber: 'DELL-ABC123',
          manufacturer: 'Dell',
          model: 'Latitude 5540',
          cpu: 'Intel Core i7',
          memoryGb: 16,
          storageGb: 512,
        })
      );
    });
  });

  /**
   * Validates Requirement 2.8: System shall support custom attributes per asset type for extensibility
   */
  it('supports custom attributes for extensibility (Requirement 2.8)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AssetForm mode="create" onSubmit={onSubmit} onCancel={vi.fn()} />);
    
    // Select Hardware type
    fireEvent.click(screen.getByText('Hardware'));
    
    // Fill in required fields
    fireEvent.change(screen.getByLabelText(/Display Name/), { target: { value: 'Test Asset' } });
    
    // Add custom attribute
    fireEvent.change(screen.getByPlaceholderText('New key'), { target: { value: 'customField' } });
    fireEvent.change(screen.getByPlaceholderText('New value'), { target: { value: 'customValue' } });
    fireEvent.click(screen.getByLabelText('Add attribute'));
    
    fireEvent.click(screen.getByRole('button', { name: 'Create Asset' }));
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          customAttributes: [
            expect.objectContaining({
              key: 'customField',
              value: 'customValue',
            }),
          ],
        })
      );
    });
  });

  /**
   * Validates dynamic form based on asset type
   */
  it('renders dynamic form fields based on asset type', async () => {
    render(<AssetForm mode="create" onSubmit={vi.fn()} onCancel={vi.fn()} />);
    
    // Hardware type shows hardware fields
    fireEvent.click(screen.getByRole('radio', { name: /Hardware/ }));
    await waitFor(() => {
      expect(screen.getByText('Hardware Details')).toBeInTheDocument();
      expect(screen.getByLabelText(/CPU/)).toBeInTheDocument();
    });
    
    // Software type shows software fields
    fireEvent.click(screen.getByRole('radio', { name: /Software/ }));
    await waitFor(() => {
      expect(screen.getByText('Software Details')).toBeInTheDocument();
      expect(screen.getByLabelText(/Publisher/)).toBeInTheDocument();
      expect(screen.queryByLabelText(/CPU/)).not.toBeInTheDocument();
    });
    
    // Enterprise type shows enterprise fields
    fireEvent.click(screen.getByRole('radio', { name: /Enterprise/ }));
    await waitFor(() => {
      expect(screen.getByText('Enterprise Asset Details')).toBeInTheDocument();
      expect(screen.getByLabelText(/Criticality Level/)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Publisher/)).not.toBeInTheDocument();
    });
  });
});
