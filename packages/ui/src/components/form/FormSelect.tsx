import { useCallback, type ChangeEvent } from 'react';
import { useFormContext } from './FormContext';
import styles from './Form.module.css';

export interface FormSelectProps {
  name: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
  dependsOn?: string;
}

export function FormSelect({
  name,
  options,
  placeholder,
  disabled = false,
}: FormSelectProps) {
  const { values, errors, touched, setValue, setTouched } = useFormContext();
  const value = values[name] ?? '';
  const hasError = !!(errors[name] && touched[name]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      setValue(name, e.target.value);
    },
    [name, setValue]
  );

  const handleBlur = useCallback(() => {
    setTouched(name);
  }, [name, setTouched]);

  const selectClasses = [
    styles.select,
    hasError ? styles.selectError : '',
    !value ? styles.selectPlaceholder : '',
  ].filter(Boolean).join(' ');

  return (
    <select
      id={name}
      name={name}
      className={selectClasses}
      value={value}
      disabled={disabled}
      onChange={handleChange}
      onBlur={handleBlur}
      aria-invalid={hasError || undefined}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
