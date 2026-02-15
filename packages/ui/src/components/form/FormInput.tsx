import { useCallback, type ChangeEvent } from 'react';
import { useFormContext } from './FormContext';
import styles from './Form.module.css';

export interface FormInputProps {
  name: string;
  type?: 'text' | 'number' | 'email' | 'password' | 'date' | 'url';
  placeholder?: string;
  prefix?: string;
  mono?: boolean;
  disabled?: boolean;
  dependsOn?: string;
}

export function FormInput({
  name,
  type = 'text',
  placeholder,
  prefix,
  mono = false,
  disabled = false,
}: FormInputProps) {
  const { values, errors, touched, setValue, setTouched } = useFormContext();
  const value = values[name] ?? '';
  const hasError = !!(errors[name] && touched[name]);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      setValue(name, type === 'number' ? (rawValue === '' ? '' : Number(rawValue)) : rawValue);
    },
    [name, setValue, type]
  );

  const handleBlur = useCallback(() => {
    setTouched(name);
  }, [name, setTouched]);

  const inputClasses = [
    styles.input,
    hasError ? styles.inputError : '',
    mono ? styles.inputMono : '',
    prefix ? styles.inputWithPrefix : '',
  ].filter(Boolean).join(' ');

  const inputEl = (
    <input
      id={name}
      name={name}
      type={type}
      className={inputClasses}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={handleChange}
      onBlur={handleBlur}
      aria-invalid={hasError || undefined}
    />
  );

  if (prefix) {
    return (
      <div className={styles.inputWrapper}>
        <span className={styles.inputPrefix}>{prefix}</span>
        {inputEl}
      </div>
    );
  }

  return inputEl;
}
