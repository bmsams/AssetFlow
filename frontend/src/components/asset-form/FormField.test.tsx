import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormField } from './FormField';

describe('FormField', () => {
  const defaultProps = {
    name: 'testField',
    label: 'Test Field',
    value: '',
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Text Input', () => {
    it('renders a text input by default', () => {
      render(<FormField {...defaultProps} />);
      
      expect(screen.getByLabelText('Test Field')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text');
    });

    it('displays the current value', () => {
      render(<FormField {...defaultProps} value="test value" />);
      
      expect(screen.getByRole('textbox')).toHaveValue('test value');
    });

    it('calls onChange when value changes', () => {
      const onChange = vi.fn();
      render(<FormField {...defaultProps} onChange={onChange} />);
      
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new value' } });
      
      expect(onChange).toHaveBeenCalledWith('testField', 'new value');
    });

    it('calls onBlur when field loses focus', () => {
      const onBlur = vi.fn();
      render(<FormField {...defaultProps} onBlur={onBlur} />);
      
      fireEvent.blur(screen.getByRole('textbox'));
      
      expect(onBlur).toHaveBeenCalledWith('testField');
    });

    it('displays placeholder text', () => {
      render(<FormField {...defaultProps} placeholder="Enter value" />);
      
      expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument();
    });

    it('respects maxLength attribute', () => {
      render(<FormField {...defaultProps} maxLength={10} />);
      
      expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '10');
    });
  });

  describe('Number Input', () => {
    it('renders a number input', () => {
      render(<FormField {...defaultProps} type="number" value={42} />);
      
      expect(screen.getByRole('spinbutton')).toHaveAttribute('type', 'number');
      expect(screen.getByRole('spinbutton')).toHaveValue(42);
    });

    it('converts string value to number on change', () => {
      const onChange = vi.fn();
      render(<FormField {...defaultProps} type="number" onChange={onChange} />);
      
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '123' } });
      
      expect(onChange).toHaveBeenCalledWith('testField', 123);
    });

    it('handles empty value for number input', () => {
      const onChange = vi.fn();
      render(<FormField {...defaultProps} type="number" value={42} onChange={onChange} />);
      
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
      
      expect(onChange).toHaveBeenCalledWith('testField', '');
    });

    it('respects min and max attributes', () => {
      render(<FormField {...defaultProps} type="number" min={0} max={100} />);
      
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('min', '0');
      expect(input).toHaveAttribute('max', '100');
    });

    it('respects step attribute', () => {
      render(<FormField {...defaultProps} type="number" step={0.01} />);
      
      expect(screen.getByRole('spinbutton')).toHaveAttribute('step', '0.01');
    });
  });

  describe('Select Input', () => {
    const options = [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2' },
      { value: 'option3', label: 'Option 3' },
    ];

    it('renders a select input with options', () => {
      render(<FormField {...defaultProps} type="select" options={options} />);
      
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
      expect(screen.getByText('Option 3')).toBeInTheDocument();
    });

    it('displays default placeholder option', () => {
      render(<FormField {...defaultProps} type="select" options={options} />);
      
      expect(screen.getByText('Select an option')).toBeInTheDocument();
    });

    it('displays custom placeholder', () => {
      render(
        <FormField
          {...defaultProps}
          type="select"
          options={options}
          placeholder="Choose one"
        />
      );
      
      expect(screen.getByText('Choose one')).toBeInTheDocument();
    });

    it('calls onChange when selection changes', () => {
      const onChange = vi.fn();
      render(
        <FormField
          {...defaultProps}
          type="select"
          options={options}
          onChange={onChange}
        />
      );
      
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'option2' } });
      
      expect(onChange).toHaveBeenCalledWith('testField', 'option2');
    });
  });

  describe('Textarea Input', () => {
    it('renders a textarea', () => {
      render(<FormField {...defaultProps} type="textarea" />);
      
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('textbox').tagName).toBe('TEXTAREA');
    });

    it('respects rows attribute', () => {
      render(<FormField {...defaultProps} type="textarea" rows={5} />);
      
      expect(screen.getByRole('textbox')).toHaveAttribute('rows', '5');
    });
  });

  describe('Checkbox Input', () => {
    it('renders a checkbox', () => {
      render(<FormField {...defaultProps} type="checkbox" value={false} />);
      
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('displays checked state', () => {
      render(<FormField {...defaultProps} type="checkbox" value={true} />);
      
      expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('calls onChange with boolean value', () => {
      const onChange = vi.fn();
      render(
        <FormField
          {...defaultProps}
          type="checkbox"
          value={false}
          onChange={onChange}
        />
      );
      
      fireEvent.click(screen.getByRole('checkbox'));
      
      expect(onChange).toHaveBeenCalledWith('testField', true);
    });
  });

  describe('Required Field', () => {
    it('displays required indicator', () => {
      render(<FormField {...defaultProps} required />);
      
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('sets required attribute on input', () => {
      render(<FormField {...defaultProps} required />);
      
      expect(screen.getByRole('textbox')).toHaveAttribute('required');
    });
  });

  describe('Disabled State', () => {
    it('disables the input', () => {
      render(<FormField {...defaultProps} disabled />);
      
      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('disables select input', () => {
      render(
        <FormField
          {...defaultProps}
          type="select"
          options={[{ value: 'a', label: 'A' }]}
          disabled
        />
      );
      
      expect(screen.getByRole('combobox')).toBeDisabled();
    });

    it('disables checkbox', () => {
      render(<FormField {...defaultProps} type="checkbox" value={false} disabled />);
      
      expect(screen.getByRole('checkbox')).toBeDisabled();
    });
  });

  describe('Error State', () => {
    it('displays error message', () => {
      render(<FormField {...defaultProps} error="This field is required" />);
      
      expect(screen.getByRole('alert')).toHaveTextContent('This field is required');
    });

    it('sets aria-invalid on input', () => {
      render(<FormField {...defaultProps} error="Error" />);
      
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    });

    it('associates error with input via aria-describedby', () => {
      render(<FormField {...defaultProps} error="Error message" />);
      
      const input = screen.getByRole('textbox');
      const errorId = input.getAttribute('aria-describedby');
      expect(errorId).toBeTruthy();
      expect(document.getElementById(errorId!)).toHaveTextContent('Error message');
    });
  });

  describe('Help Text', () => {
    it('displays help text', () => {
      render(<FormField {...defaultProps} helpText="Enter your name" />);
      
      expect(screen.getByText('Enter your name')).toBeInTheDocument();
    });

    it('hides help text when error is present', () => {
      render(
        <FormField
          {...defaultProps}
          helpText="Enter your name"
          error="Required"
        />
      );
      
      expect(screen.queryByText('Enter your name')).not.toBeInTheDocument();
      expect(screen.getByText('Required')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('associates label with input', () => {
      render(<FormField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      const label = screen.getByText('Test Field');
      
      expect(label).toHaveAttribute('for', input.id);
    });

    it('supports autoFocus', () => {
      render(<FormField {...defaultProps} autoFocus />);
      
      expect(screen.getByRole('textbox')).toHaveFocus();
    });
  });
});

describe('FormField - Requirements Validation', () => {
  /**
   * Validates Requirement 2.1: Support asset creation with comprehensive attributes
   */
  it('supports various field types for comprehensive asset attributes (Requirement 2.1)', () => {
    const onChange = vi.fn();
    
    // Text field
    const { rerender } = render(
      <FormField name="name" label="Name" value="" onChange={onChange} type="text" />
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    
    // Number field
    rerender(
      <FormField name="price" label="Price" value={0} onChange={onChange} type="number" />
    );
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    
    // Select field
    rerender(
      <FormField
        name="status"
        label="Status"
        value=""
        onChange={onChange}
        type="select"
        options={[{ value: 'active', label: 'Active' }]}
      />
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    
    // Date field
    rerender(
      <FormField name="date" label="Date" value="" onChange={onChange} type="date" />
    );
    expect(screen.getByLabelText('Date')).toHaveAttribute('type', 'date');
  });
});
