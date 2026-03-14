import {
  useState,
  useCallback,
  useContext,
  useEffect,
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
  onSubmitError?: (error: unknown) => void;
  showSubmitError?: boolean;
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
  onSubmitError,
  showSubmitError = true,
}: FormProps) {
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouchedMap] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const initialRef = useRef(initialValues);
  const dependencyMapRef = useRef<Record<string, Set<string>>>({});

  useEffect(() => {
    initialRef.current = initialValues;
    setValues(initialValues);
    setErrors({});
    setTouchedMap({});
    setSubmitError(null);
  }, [initialValues]);

  const dirty = Object.keys(values).some(
    (key) => values[key] !== initialRef.current[key]
  );

  const getDependentFieldNames = useCallback((name: string): string[] => {
    const visited = new Set<string>();
    const walk = (parent: string) => {
      const deps = dependencyMapRef.current[parent];
      if (!deps) return;
      for (const dep of deps) {
        if (visited.has(dep)) continue;
        visited.add(dep);
        walk(dep);
      }
    };
    walk(name);
    return Array.from(visited);
  }, []);

  const clearDependentValue = (value: any) => {
    if (Array.isArray(value)) return [];
    if (typeof value === 'boolean') return false;
    return '';
  };

  const registerDependency = useCallback((name: string, dependsOn?: string) => {
    if (!dependsOn || dependsOn === name) return () => {};

    let deps = dependencyMapRef.current[dependsOn];
    if (!deps) {
      deps = new Set<string>();
      dependencyMapRef.current[dependsOn] = deps;
    }
    deps.add(name);

    return () => {
      const depSet = dependencyMapRef.current[dependsOn];
      if (!depSet) return;
      depSet.delete(name);
      if (depSet.size === 0) {
        delete dependencyMapRef.current[dependsOn];
      }
    };
  }, []);

  const setValue = useCallback((name: string, value: any) => {
    const dependentFields = getDependentFieldNames(name);

    setValues((prev) => {
      const hasChanged = !Object.is(prev[name], value);
      if (!hasChanged) return prev;

      const next = { ...prev, [name]: value };
      for (const dependentField of dependentFields) {
        next[dependentField] = clearDependentValue(prev[dependentField]);
      }
      return next;
    });

    setErrors((prev) => {
      const shouldClearCurrent = !!prev[name];
      const shouldClearDependents = dependentFields.some((field) => !!prev[field]);
      if (!shouldClearCurrent && !shouldClearDependents) return prev;

      const next = { ...prev };
      delete next[name];
      for (const dependentField of dependentFields) {
        delete next[dependentField];
      }
      return next;
    });

    setTouchedMap((prev) => {
      if (dependentFields.length === 0) return prev;

      const hasTouchedDependents = dependentFields.some((field) => !!prev[field]);
      if (!hasTouchedDependents) return prev;

      const next = { ...prev };
      for (const dependentField of dependentFields) {
        delete next[dependentField];
      }
      return next;
    });

    if (submitError) {
      setSubmitError(null);
    }
  }, [getDependentFieldNames, submitError]);

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

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    if (!runValidation()) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to submit form. Please try again.';
      setSubmitError(message);
      onSubmitError?.(error);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, onSubmit, onSubmitError, runValidation, values]);

  const handleFormSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      void handleSubmit();
    },
    [handleSubmit]
  );

  const ctx: FormContextValue = {
    values,
    errors,
    touched,
    dirty,
    isSubmitting,
    setValue,
    setError,
    setTouched,
    registerDependency,
    validate: runValidation,
    submit: handleSubmit,
  };

  const formClasses = [styles.form, className].filter(Boolean).join(' ');

  return (
    <FormContext.Provider value={ctx}>
      <form className={formClasses} onSubmit={handleFormSubmit} noValidate>
        {showSubmitError && submitError && (
          <div className={styles.formSubmitError} role="alert">
            {submitError}
          </div>
        )}
        {children}
      </form>
    </FormContext.Provider>
  );
}

export { FormRoot, FormSection, FormField };
