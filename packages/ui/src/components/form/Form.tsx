import {
  useState,
  useCallback,
  useContext,
  useRef,
  type ReactNode,
  type FormEvent,
} from 'react';
import { FormContext, type FormContextValue } from './FormContext';
import styles from './Form.module.css';

/* -------------------------------------------------------------------------- */
/*  Form Props                                                                 */
/* -------------------------------------------------------------------------- */

export interface FormProps {
  initialValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => void | Promise<void>;
  validate?: (values: Record<string, any>) => Record<string, string>;
  children: ReactNode;
  className?: string;
}

/* -------------------------------------------------------------------------- */
/*  FormSection                                                                */
/* -------------------------------------------------------------------------- */

export interface FormSectionProps {
  title: string;
  description?: string;
  columns?: 1 | 2;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  children: ReactNode;
}

function FormSection({
  title,
  description,
  columns = 1,
  collapsible = false,
  defaultCollapsed = false,
  children,
}: FormSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const handleToggle = useCallback(() => {
    if (collapsible) setCollapsed((prev) => !prev);
  }, [collapsible]);

  const sectionClasses = [
    styles.section,
    collapsed ? styles.sectionCollapsed : '',
  ].filter(Boolean).join(' ');

  const headerClasses = [
    styles.sectionHeader,
    collapsible ? styles.sectionHeaderCollapsible : '',
  ].filter(Boolean).join(' ');

  const columnClass = columns === 2 ? styles.columns2 : styles.columns1;

  return (
    <fieldset className={sectionClasses}>
      <div
        className={headerClasses}
        onClick={handleToggle}
        role={collapsible ? 'button' : undefined}
        aria-expanded={collapsible ? !collapsed : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={collapsible ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        } : undefined}
      >
        <div>
          <div className={styles.sectionTitle}>{title}</div>
          {description && (
            <div className={styles.sectionDescription}>{description}</div>
          )}
        </div>
        {collapsible && (
          <span
            className={`${styles.sectionCollapseIcon} ${
              !collapsed ? styles.sectionCollapseIconOpen : ''
            }`}
            aria-hidden="true"
          >
            &#9660;
          </span>
        )}
      </div>
      <div className={styles.sectionBody}>
        <div className={columnClass}>{children}</div>
      </div>
    </fieldset>
  );
}

/* -------------------------------------------------------------------------- */
/*  FormField                                                                  */
/* -------------------------------------------------------------------------- */

export interface FormFieldProps {
  name: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}

function FormField({ name, label, required, hint, children }: FormFieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={name}>
        {label}
        {required && <span className={styles.fieldRequired}>*</span>}
      </label>
      {children}
      {hint && <span className={styles.fieldHint}>{hint}</span>}
      <FormFieldError name={name} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  FormFieldError (internal helper)                                           */
/* -------------------------------------------------------------------------- */

function FormFieldError({ name }: { name: string }) {
  const { errors, touched } = useContext(FormContext);
  const error = errors[name];
  const isTouched = touched[name];

  if (!error || !isTouched) return null;

  return (
    <span className={styles.fieldError} role="alert">
      {error}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  FormRoot                                                                   */
/* -------------------------------------------------------------------------- */

function FormRoot({
  initialValues = {},
  onSubmit,
  validate,
  children,
  className = '',
}: FormProps) {
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouchedMap] = useState<Record<string, boolean>>({});
  const initialRef = useRef(initialValues);

  const dirty = Object.keys(values).some(
    (key) => values[key] !== initialRef.current[key]
  );

  const setValue = useCallback((name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const setError = useCallback((name: string, error: string) => {
    setErrors((prev) => ({ ...prev, [name]: error }));
  }, []);

  const setTouched = useCallback((name: string) => {
    setTouchedMap((prev) => {
      if (prev[name]) return prev;
      return { ...prev, [name]: true };
    });
  }, []);

  const runValidation = useCallback((): boolean => {
    if (!validate) return true;
    const validationErrors = validate(values);
    setErrors(validationErrors);
    const touchAll: Record<string, boolean> = {};
    for (const key of Object.keys(validationErrors)) {
      touchAll[key] = true;
    }
    if (Object.keys(touchAll).length > 0) {
      setTouchedMap((prev) => ({ ...prev, ...touchAll }));
    }
    return Object.keys(validationErrors).length === 0;
  }, [validate, values]);

  const handleSubmit = useCallback(() => {
    if (runValidation()) {
      onSubmit(values);
    }
  }, [onSubmit, runValidation, values]);

  const handleFormSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      handleSubmit();
    },
    [handleSubmit]
  );

  const ctx: FormContextValue = {
    values,
    errors,
    touched,
    dirty,
    setValue,
    setError,
    setTouched,
    validate: runValidation,
    submit: handleSubmit,
  };

  const formClasses = [styles.form, className].filter(Boolean).join(' ');

  return (
    <FormContext.Provider value={ctx}>
      <form className={formClasses} onSubmit={handleFormSubmit} noValidate>
        {children}
      </form>
    </FormContext.Provider>
  );
}

export { FormRoot, FormSection, FormField };
