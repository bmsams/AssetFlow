import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CustomAttributesEditor } from './CustomAttributesEditor';
import type { CustomAttribute } from './CustomAttributesEditor';

describe('CustomAttributesEditor', () => {
  const defaultProps = {
    attributes: [] as CustomAttribute[],
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the component with title', () => {
      render(<CustomAttributesEditor {...defaultProps} />);
      
      expect(screen.getByText('Custom Attributes')).toBeInTheDocument();
    });

    it('displays attribute count', () => {
      render(<CustomAttributesEditor {...defaultProps} maxAttributes={20} />);
      
      expect(screen.getByText('0 / 20')).toBeInTheDocument();
    });

    it('renders existing attributes', () => {
      const attributes: CustomAttribute[] = [
        { id: '1', key: 'color', value: 'blue' },
        { id: '2', key: 'size', value: 'large' },
      ];
      
      render(<CustomAttributesEditor {...defaultProps} attributes={attributes} />);
      
      expect(screen.getByDisplayValue('color')).toBeInTheDocument();
      expect(screen.getByDisplayValue('blue')).toBeInTheDocument();
      expect(screen.getByDisplayValue('size')).toBeInTheDocument();
      expect(screen.getByDisplayValue('large')).toBeInTheDocument();
    });

    it('renders add new attribute inputs', () => {
      render(<CustomAttributesEditor {...defaultProps} />);
      
      expect(screen.getByPlaceholderText('New key')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('New value')).toBeInTheDocument();
    });
  });

  describe('Adding Attributes', () => {
    it('adds a new attribute when add button is clicked', () => {
      const onChange = vi.fn();
      render(<CustomAttributesEditor {...defaultProps} onChange={onChange} />);
      
      fireEvent.change(screen.getByPlaceholderText('New key'), {
        target: { value: 'newKey' },
      });
      fireEvent.change(screen.getByPlaceholderText('New value'), {
        target: { value: 'newValue' },
      });
      fireEvent.click(screen.getByLabelText('Add attribute'));
      
      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({ key: 'newKey', value: 'newValue' }),
      ]);
    });

    it('adds attribute on Enter key press', () => {
      const onChange = vi.fn();
      render(<CustomAttributesEditor {...defaultProps} onChange={onChange} />);
      
      const keyInput = screen.getByPlaceholderText('New key');
      fireEvent.change(keyInput, { target: { value: 'testKey' } });
      fireEvent.change(screen.getByPlaceholderText('New value'), {
        target: { value: 'testValue' },
      });
      fireEvent.keyDown(keyInput, { key: 'Enter' });
      
      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({ key: 'testKey', value: 'testValue' }),
      ]);
    });

    it('clears inputs after adding attribute', async () => {
      const onChange = vi.fn();
      render(<CustomAttributesEditor {...defaultProps} onChange={onChange} />);
      
      fireEvent.change(screen.getByPlaceholderText('New key'), {
        target: { value: 'newKey' },
      });
      fireEvent.change(screen.getByPlaceholderText('New value'), {
        target: { value: 'newValue' },
      });
      fireEvent.click(screen.getByLabelText('Add attribute'));
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('New key')).toHaveValue('');
        expect(screen.getByPlaceholderText('New value')).toHaveValue('');
      });
    });

    it('disables add button when key is empty', () => {
      render(<CustomAttributesEditor {...defaultProps} />);
      
      expect(screen.getByLabelText('Add attribute')).toBeDisabled();
    });

    it('enables add button when key has value', () => {
      render(<CustomAttributesEditor {...defaultProps} />);
      
      fireEvent.change(screen.getByPlaceholderText('New key'), {
        target: { value: 'test' },
      });
      
      expect(screen.getByLabelText('Add attribute')).not.toBeDisabled();
    });
  });

  describe('Validation', () => {
    it('shows error for empty key', () => {
      render(<CustomAttributesEditor {...defaultProps} />);
      
      // Enter a valid key first, then try to add with whitespace
      fireEvent.change(screen.getByPlaceholderText('New key'), {
        target: { value: 'validKey' },
      });
      // Clear it to whitespace
      fireEvent.change(screen.getByPlaceholderText('New key'), {
        target: { value: '' },
      });
      
      // Button should be disabled for empty key
      expect(screen.getByLabelText('Add attribute')).toBeDisabled();
    });

    it('shows error for key exceeding max length', () => {
      render(<CustomAttributesEditor {...defaultProps} />);
      
      const longKey = 'a'.repeat(51);
      fireEvent.change(screen.getByPlaceholderText('New key'), {
        target: { value: longKey },
      });
      fireEvent.click(screen.getByLabelText('Add attribute'));
      
      expect(screen.getByRole('alert')).toHaveTextContent('50 characters or less');
    });

    it('shows error for invalid key format', () => {
      render(<CustomAttributesEditor {...defaultProps} />);
      
      fireEvent.change(screen.getByPlaceholderText('New key'), {
        target: { value: '123invalid' },
      });
      fireEvent.click(screen.getByLabelText('Add attribute'));
      
      expect(screen.getByRole('alert')).toHaveTextContent('must start with a letter');
    });

    it('shows error for duplicate key', () => {
      const attributes: CustomAttribute[] = [
        { id: '1', key: 'existingKey', value: 'value' },
      ];
      
      render(<CustomAttributesEditor {...defaultProps} attributes={attributes} />);
      
      fireEvent.change(screen.getByPlaceholderText('New key'), {
        target: { value: 'existingKey' },
      });
      fireEvent.click(screen.getByLabelText('Add attribute'));
      
      expect(screen.getByRole('alert')).toHaveTextContent('already exists');
    });

    it('clears error when key is modified', () => {
      render(<CustomAttributesEditor {...defaultProps} />);
      
      // Trigger error
      fireEvent.change(screen.getByPlaceholderText('New key'), {
        target: { value: '123' },
      });
      fireEvent.click(screen.getByLabelText('Add attribute'));
      expect(screen.getByRole('alert')).toBeInTheDocument();
      
      // Modify key
      fireEvent.change(screen.getByPlaceholderText('New key'), {
        target: { value: 'validKey' },
      });
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Removing Attributes', () => {
    it('removes attribute when remove button is clicked', () => {
      const onChange = vi.fn();
      const attributes: CustomAttribute[] = [
        { id: '1', key: 'color', value: 'blue' },
        { id: '2', key: 'size', value: 'large' },
      ];
      
      render(
        <CustomAttributesEditor
          {...defaultProps}
          attributes={attributes}
          onChange={onChange}
        />
      );
      
      fireEvent.click(screen.getByLabelText('Remove attribute color'));
      
      expect(onChange).toHaveBeenCalledWith([
        { id: '2', key: 'size', value: 'large' },
      ]);
    });
  });

  describe('Updating Attributes', () => {
    it('updates attribute key', () => {
      const onChange = vi.fn();
      const attributes: CustomAttribute[] = [
        { id: '1', key: 'color', value: 'blue' },
      ];
      
      render(
        <CustomAttributesEditor
          {...defaultProps}
          attributes={attributes}
          onChange={onChange}
        />
      );
      
      fireEvent.change(screen.getByDisplayValue('color'), {
        target: { value: 'newColor' },
      });
      
      expect(onChange).toHaveBeenCalledWith([
        { id: '1', key: 'newColor', value: 'blue' },
      ]);
    });

    it('updates attribute value', () => {
      const onChange = vi.fn();
      const attributes: CustomAttribute[] = [
        { id: '1', key: 'color', value: 'blue' },
      ];
      
      render(
        <CustomAttributesEditor
          {...defaultProps}
          attributes={attributes}
          onChange={onChange}
        />
      );
      
      fireEvent.change(screen.getByDisplayValue('blue'), {
        target: { value: 'red' },
      });
      
      expect(onChange).toHaveBeenCalledWith([
        { id: '1', key: 'color', value: 'red' },
      ]);
    });
  });

  describe('Max Attributes Limit', () => {
    it('hides add section when max is reached', () => {
      const attributes: CustomAttribute[] = [
        { id: '1', key: 'attr1', value: 'val1' },
        { id: '2', key: 'attr2', value: 'val2' },
      ];
      
      render(
        <CustomAttributesEditor
          {...defaultProps}
          attributes={attributes}
          maxAttributes={2}
        />
      );
      
      expect(screen.queryByPlaceholderText('New key')).not.toBeInTheDocument();
    });

    it('shows max reached message', () => {
      const attributes: CustomAttribute[] = [
        { id: '1', key: 'attr1', value: 'val1' },
        { id: '2', key: 'attr2', value: 'val2' },
      ];
      
      render(
        <CustomAttributesEditor
          {...defaultProps}
          attributes={attributes}
          maxAttributes={2}
        />
      );
      
      expect(screen.getByText('Maximum number of attributes reached')).toBeInTheDocument();
    });

    it('updates count display correctly', () => {
      const attributes: CustomAttribute[] = [
        { id: '1', key: 'attr1', value: 'val1' },
      ];
      
      render(
        <CustomAttributesEditor
          {...defaultProps}
          attributes={attributes}
          maxAttributes={5}
        />
      );
      
      expect(screen.getByText('1 / 5')).toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('disables all inputs when disabled', () => {
      const attributes: CustomAttribute[] = [
        { id: '1', key: 'color', value: 'blue' },
      ];
      
      render(
        <CustomAttributesEditor
          {...defaultProps}
          attributes={attributes}
          disabled
        />
      );
      
      expect(screen.getByDisplayValue('color')).toBeDisabled();
      expect(screen.getByDisplayValue('blue')).toBeDisabled();
      expect(screen.getByLabelText('Remove attribute color')).toBeDisabled();
    });

    it('disables add inputs when disabled', () => {
      render(<CustomAttributesEditor {...defaultProps} disabled />);
      
      expect(screen.getByPlaceholderText('New key')).toBeDisabled();
      expect(screen.getByPlaceholderText('New value')).toBeDisabled();
    });
  });

  describe('Error Display', () => {
    it('displays error message', () => {
      render(
        <CustomAttributesEditor
          {...defaultProps}
          error="Custom attributes validation failed"
        />
      );
      
      expect(screen.getByText('Custom attributes validation failed')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper aria-label on list', () => {
      const attributes: CustomAttribute[] = [
        { id: '1', key: 'color', value: 'blue' },
      ];
      
      render(<CustomAttributesEditor {...defaultProps} attributes={attributes} />);
      
      expect(screen.getByRole('list')).toHaveAttribute(
        'aria-label',
        'Custom attributes'
      );
    });

    it('has proper aria-labels on inputs', () => {
      const attributes: CustomAttribute[] = [
        { id: '1', key: 'color', value: 'blue' },
      ];
      
      render(<CustomAttributesEditor {...defaultProps} attributes={attributes} />);
      
      expect(screen.getByLabelText('Attribute key for color')).toBeInTheDocument();
      expect(screen.getByLabelText('Attribute value for color')).toBeInTheDocument();
    });
  });
});

describe('CustomAttributesEditor - Requirements Validation', () => {
  /**
   * Validates Requirement 2.8: System shall support custom attributes per asset type for extensibility
   */
  it('supports custom key-value attributes for extensibility (Requirement 2.8)', () => {
    const onChange = vi.fn();
    render(<CustomAttributesEditor attributes={[]} onChange={onChange} />);
    
    // Add a custom attribute
    fireEvent.change(screen.getByPlaceholderText('New key'), {
      target: { value: 'customField' },
    });
    fireEvent.change(screen.getByPlaceholderText('New value'), {
      target: { value: 'customValue' },
    });
    fireEvent.click(screen.getByLabelText('Add attribute'));
    
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        key: 'customField',
        value: 'customValue',
      }),
    ]);
  });

  it('allows multiple custom attributes (Requirement 2.8)', () => {
    const attributes: CustomAttribute[] = [
      { id: '1', key: 'field1', value: 'value1' },
      { id: '2', key: 'field2', value: 'value2' },
      { id: '3', key: 'field3', value: 'value3' },
    ];
    
    render(<CustomAttributesEditor attributes={attributes} onChange={vi.fn()} />);
    
    expect(screen.getByDisplayValue('field1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('field2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('field3')).toBeInTheDocument();
  });
});
