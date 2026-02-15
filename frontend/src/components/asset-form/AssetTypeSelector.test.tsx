import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetTypeSelector } from './AssetTypeSelector';

describe('AssetTypeSelector', () => {
  const defaultProps = {
    value: '' as const,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders all three asset type options', () => {
      render(<AssetTypeSelector {...defaultProps} />);
      
      expect(screen.getByText('Hardware')).toBeInTheDocument();
      expect(screen.getByText('Software')).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
    });

    it('renders descriptions for each type', () => {
      render(<AssetTypeSelector {...defaultProps} />);
      
      expect(screen.getByText(/Physical IT equipment/)).toBeInTheDocument();
      expect(screen.getByText(/Software licenses/)).toBeInTheDocument();
      expect(screen.getByText(/Non-IT assets/)).toBeInTheDocument();
    });

    it('renders the legend with required indicator', () => {
      render(<AssetTypeSelector {...defaultProps} />);
      
      expect(screen.getByText('Asset Type')).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('renders as a radiogroup for accessibility', () => {
      render(<AssetTypeSelector {...defaultProps} />);
      
      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('calls onChange when Hardware is selected', () => {
      const onChange = vi.fn();
      render(<AssetTypeSelector {...defaultProps} onChange={onChange} />);
      
      fireEvent.click(screen.getByText('Hardware'));
      
      expect(onChange).toHaveBeenCalledWith('HARDWARE');
    });

    it('calls onChange when Software is selected', () => {
      const onChange = vi.fn();
      render(<AssetTypeSelector {...defaultProps} onChange={onChange} />);
      
      fireEvent.click(screen.getByText('Software'));
      
      expect(onChange).toHaveBeenCalledWith('SOFTWARE');
    });

    it('calls onChange when Enterprise is selected', () => {
      const onChange = vi.fn();
      render(<AssetTypeSelector {...defaultProps} onChange={onChange} />);
      
      fireEvent.click(screen.getByText('Enterprise'));
      
      expect(onChange).toHaveBeenCalledWith('ENTERPRISE');
    });

    it('shows selected state for Hardware', () => {
      render(<AssetTypeSelector {...defaultProps} value="HARDWARE" />);
      
      const hardwareOption = screen.getByRole('radio', { name: /Hardware/ });
      expect(hardwareOption).toHaveAttribute('aria-checked', 'true');
    });

    it('shows selected state for Software', () => {
      render(<AssetTypeSelector {...defaultProps} value="SOFTWARE" />);
      
      const softwareOption = screen.getByRole('radio', { name: /Software/ });
      expect(softwareOption).toHaveAttribute('aria-checked', 'true');
    });

    it('shows selected state for Enterprise', () => {
      render(<AssetTypeSelector {...defaultProps} value="ENTERPRISE" />);
      
      const enterpriseOption = screen.getByRole('radio', { name: /Enterprise/ });
      expect(enterpriseOption).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Keyboard Navigation', () => {
    it('selects option on Enter key', () => {
      const onChange = vi.fn();
      render(<AssetTypeSelector {...defaultProps} onChange={onChange} />);
      
      const hardwareOption = screen.getByRole('radio', { name: /Hardware/ });
      fireEvent.keyDown(hardwareOption, { key: 'Enter' });
      
      expect(onChange).toHaveBeenCalledWith('HARDWARE');
    });

    it('selects option on Space key', () => {
      const onChange = vi.fn();
      render(<AssetTypeSelector {...defaultProps} onChange={onChange} />);
      
      const softwareOption = screen.getByRole('radio', { name: /Software/ });
      fireEvent.keyDown(softwareOption, { key: ' ' });
      
      expect(onChange).toHaveBeenCalledWith('SOFTWARE');
    });

    it('options are focusable', () => {
      render(<AssetTypeSelector {...defaultProps} />);
      
      const options = screen.getAllByRole('radio');
      options.forEach((option) => {
        expect(option).toHaveAttribute('tabIndex', '0');
      });
    });
  });

  describe('Disabled State', () => {
    it('does not call onChange when disabled', () => {
      const onChange = vi.fn();
      render(<AssetTypeSelector {...defaultProps} onChange={onChange} disabled />);
      
      fireEvent.click(screen.getByText('Hardware'));
      
      expect(onChange).not.toHaveBeenCalled();
    });

    it('sets tabIndex to -1 when disabled', () => {
      render(<AssetTypeSelector {...defaultProps} disabled />);
      
      const options = screen.getAllByRole('radio');
      options.forEach((option) => {
        expect(option).toHaveAttribute('tabIndex', '-1');
      });
    });
  });

  describe('Error State', () => {
    it('displays error message', () => {
      render(
        <AssetTypeSelector {...defaultProps} error="Please select an asset type" />
      );
      
      expect(screen.getByRole('alert')).toHaveTextContent('Please select an asset type');
    });
  });

  describe('Accessibility', () => {
    it('has proper aria-label on radiogroup', () => {
      render(<AssetTypeSelector {...defaultProps} />);
      
      expect(screen.getByRole('radiogroup')).toHaveAttribute(
        'aria-label',
        'Select asset type'
      );
    });

    it('each option has radio role', () => {
      render(<AssetTypeSelector {...defaultProps} />);
      
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);
    });
  });
});

describe('AssetTypeSelector - Requirements Validation', () => {
  /**
   * Validates Requirement 2.2: Support asset types including Hardware, Software, and Enterprise categories
   */
  it('supports all three asset type categories (Requirement 2.2)', () => {
    const onChange = vi.fn();
    render(<AssetTypeSelector value="" onChange={onChange} />);
    
    // Verify all three types are available
    expect(screen.getByText('Hardware')).toBeInTheDocument();
    expect(screen.getByText('Software')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
    
    // Verify each can be selected
    fireEvent.click(screen.getByText('Hardware'));
    expect(onChange).toHaveBeenCalledWith('HARDWARE');
    
    fireEvent.click(screen.getByText('Software'));
    expect(onChange).toHaveBeenCalledWith('SOFTWARE');
    
    fireEvent.click(screen.getByText('Enterprise'));
    expect(onChange).toHaveBeenCalledWith('ENTERPRISE');
  });
});
