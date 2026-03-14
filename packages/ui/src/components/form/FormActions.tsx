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
  submittingLabel?: string;
  cancelLabel?: string;
  onCancel?: () => void;
  disableUntilDirty?: boolean;
  disabled?: boolean;
}

export function FormSubmit({
  label = 'Submit',
  submittingLabel = 'Submitting...',
  cancelLabel,
  onCancel,
  disableUntilDirty = false,
  disabled = false,
}: FormSubmitProps) {
  const { dirty, isSubmitting } = useFormContext();

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
          disabled={isSubmitting}
        >
          {cancelLabel}
        </button>
      )}
      <button
        type="submit"
        className={styles.submitButton}
        disabled={disabled || isSubmitting || (disableUntilDirty && !dirty)}
      >
        {isSubmitting ? submittingLabel : label}
      </button>
    </div>
  );
}
