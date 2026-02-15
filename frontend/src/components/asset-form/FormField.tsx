import { useId } from 'react';
import styles from './FormField.module.css';

export type FieldType = 'text' | 'number' | 'email' | 'date' | 'select' | 'textarea' | 'checkbox';

export interface SelectOption {
  value: string;
  label: string;
}

export interface FormFieldProps {
  /** Field name for form submission */
  name: string;
  /** Display label */
  label: string;
  /** Field type */
  type?: FieldType;
  /** Current value */
  value: string | number | boolean;
  /** Change handler */
  onChange: (name: string, value: string | number | boolean) => void;
  /** Blur handler for validation */
  onBlur?: (name: string) => void;
  /** Error message */
  error?: string;
  /** Whether field is required */
  required?: boolean;
  /** Whether field is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Help text */
  helpText?: string;
  /** Options for select fields */
  options?: SelectOption[];
  /** Minimum value for number fields */
  min?: number;
  /** Maximum value for number fields */
  max?: number;
  /** Step for number fields */
  step?: number;
  /** Pattern for text validation */
  pattern?: string;
  /** Maximum length for text fields */
  maxLength?: number;
  /** Number of rows for textarea */
  rows?: number;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

/**
 * FormField component - Reusable form field with validation support
 * 
 * Implements Requirements:
 * - 2.1: Support asset creation with comprehensive attributes
 */
export function FormField({
  name,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  required = false,
  disabled = false,
  placeholder,
  helpText,
  options = [],
  min,
  max,
  step,
  pattern,
  maxLength,
  rows = 3,
  autoFocus = false,
}: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const target = e.target;
    let newValue: string | number | boolean;

    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      newValue = target.checked;
    } else if (type === 'number') {
      newValue = target.value === '' ? '' : Number(target.value);
    } else {
      newValue = target.value;
    }

    onChange(name, newValue);
  };

  const handleBlur = () => {
    onBlur?.(name);
  };

  const describedBy = [
    error ? errorId : null,
    helpText ? helpId : null,
  ].filter(Boolean).join(' ') || undefined;

  const renderInput = () => {
    const commonProps = {
      id,
      name,
      disabled,
      'aria-invalid': !!error,
      'aria-describedby': describedBy,
      onBlur: handleBlur,
    };

    if (type === 'select') {
      return (
        <select
          {...commonProps}
          value={String(value)}
          onChange={handleChange}
          className={`${styles.input} ${styles.select} ${error ? styles.inputError : ''}`}
          required={required}
        >
          <option value="">{placeholder || 'Select an option'}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (type === 'textarea') {
      return (
        <textarea
          {...commonProps}
          value={String(value)}
          onChange={handleChange}
          className={`${styles.input} ${styles.textarea} ${error ? styles.inputError : ''}`}
          placeholder={placeholder}
          required={required}
          maxLength={maxLength}
          rows={rows}
          autoFocus={autoFocus}
        />
      );
    }

    if (type === 'checkbox') {
      return (
        <div className={styles.checkboxContainer}>
          <input
            {...commonProps}
            type="checkbox"
            checked={Boolean(value)}
            onChange={handleChange}
            className={styles.checkbox}
          />
          <span className={styles.checkboxLabel}>{label}</span>
        </div>
      );
    }

    return (
      <input
        {...commonProps}
        type={type}
        value={type === 'number' && value === '' ? '' : String(value)}
        onChange={handleChange}
        className={`${styles.input} ${error ? styles.inputError : ''}`}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
        step={step}
        pattern={pattern}
        maxLength={maxLength}
        autoFocus={autoFocus}
      />
    );
  };

  // Checkbox has a different layout
  if (type === 'checkbox') {
    return (
      <div className={styles.fieldContainer}>
        {renderInput()}
        {error && (
          <span id={errorId} className={styles.error} role="alert">
            {error}
          </span>
        )}
        {helpText && !error && (
          <span id={helpId} className={styles.helpText}>
            {helpText}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={styles.fieldContainer}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && <span className={styles.required} aria-hidden="true">*</span>}
      </label>
      {renderInput()}
      {error && (
        <span id={errorId} className={styles.error} role="alert">
          {error}
        </span>
      )}
      {helpText && !error && (
        <span id={helpId} className={styles.helpText}>
          {helpText}
        </span>
      )}
    </div>
  );
}

export default FormField;
