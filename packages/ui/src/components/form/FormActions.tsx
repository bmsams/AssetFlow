import { useCallback, type ReactNode } from 'react';
import { useFormContext } from './FormContext';
import styles from './Form.module.css';

/* -------------------------------------------------------------------------- */
/*  FormActions                                                                */
/* -------------------------------------------------------------------------- */

export interface FormActionsProps {
  sticky?: boolean;
  children?: ReactNode;
}

export function FormActions({ sticky = false, children }: FormActionsProps) {
  const actionsClasses = [
    styles.actions,
    sticky ? styles.actionsSticky : '',
  ].filter(Boolean).join(' ');

  return <div className={actionsClasses}>{children}</div>;
}

/* -------------------------------------------------------------------------- */
/*  FormSubmit                                                                 */
/* -------------------------------------------------------------------------- */

export interface FormSubmitProps {
  label?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  disableUntilDirty?: boolean;
}

export function FormSubmit({
  label = 'Submit',
  cancelLabel,
  onCancel,
  disableUntilDirty = false,
}: FormSubmitProps) {
  const { dirty } = useFormContext();

  const handleCancel = useCallback(() => {
    onCancel?.();
  }, [onCancel]);

  return (
    <div className={styles.actions}>
      {cancelLabel && onCancel && (
        <button
          type="button"
          className={styles.cancelButton}
          onClick={handleCancel}
        >
          {cancelLabel}
        </button>
      )}
      <button
        type="submit"
        className={styles.submitButton}
        disabled={disableUntilDirty && !dirty}
      >
        {label}
      </button>
    </div>
  );
}
