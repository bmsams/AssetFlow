/**
 * DashboardCustomizer - Toolbar for customizing dashboard layout
 * Implements Requirement 12.7: Dashboard widgets shall be configurable per user
 */

import { useState, useCallback } from 'react';
import type { WidgetConfig } from '../../types/widget';
import { WidgetPicker } from './WidgetPicker';
import styles from './DashboardCustomizer.module.css';

export interface DashboardCustomizerProps {
  /** Whether edit mode is active */
  isEditing: boolean;
  /** Toggle edit mode */
  onToggleEdit: () => void;
  /** Whether there are unsaved changes */
  hasChanges: boolean;
  /** Save the current layout */
  onSave: () => void;
  /** Reset to default layout */
  onReset: () => void;
  /** Add a new widget */
  onAddWidget: (widget: WidgetConfig) => void;
  /** Existing widget IDs */
  existingWidgetIds: string[];
}

/**
 * DashboardCustomizer component
 */
export function DashboardCustomizer({
  isEditing,
  onToggleEdit,
  hasChanges,
  onSave,
  onReset,
  onAddWidget,
  existingWidgetIds,
}: DashboardCustomizerProps) {
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleAddWidget = useCallback(() => {
    setShowWidgetPicker(true);
  }, []);

  const handleWidgetSelected = useCallback(
    (widget: WidgetConfig) => {
      onAddWidget(widget);
      setShowWidgetPicker(false);
    },
    [onAddWidget]
  );

  const handleReset = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  const handleConfirmReset = useCallback(() => {
    onReset();
    setShowResetConfirm(false);
  }, [onReset]);

  const handleCancelReset = useCallback(() => {
    setShowResetConfirm(false);
  }, []);

  return (
    <>
      <div className={styles.customizer} role="toolbar" aria-label="Dashboard customization">
        {/* Edit Mode Toggle */}
        <button
          type="button"
          className={`${styles.button} ${isEditing ? styles.active : ''}`}
          onClick={onToggleEdit}
          aria-pressed={isEditing}
          aria-label={isEditing ? 'Exit edit mode' : 'Customize dashboard'}
          title={isEditing ? 'Exit edit mode' : 'Customize dashboard'}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={styles.icon}
            aria-hidden="true"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <span className={styles.buttonText}>
            {isEditing ? 'Done Editing' : 'Customize'}
          </span>
        </button>

        {/* Edit Mode Actions */}
        {isEditing && (
          <>
            <div className={styles.divider} aria-hidden="true" />

            {/* Add Widget Button */}
            <button
              type="button"
              className={styles.button}
              onClick={handleAddWidget}
              aria-label="Add widget to dashboard"
              title="Add widget"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={styles.icon}
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              <span className={styles.buttonText}>Add Widget</span>
            </button>

            {/* Reset Button */}
            <button
              type="button"
              className={`${styles.button} ${styles.resetButton}`}
              onClick={handleReset}
              aria-label="Reset dashboard to default layout"
              title="Reset to default layout"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={styles.icon}
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span className={styles.buttonText}>Reset</span>
            </button>

            <div className={styles.divider} aria-hidden="true" />

            {/* Save Button */}
            <button
              type="button"
              className={`${styles.button} ${styles.saveButton} ${hasChanges ? styles.hasChanges : ''}`}
              onClick={onSave}
              disabled={!hasChanges}
              aria-label={hasChanges ? 'Save dashboard changes' : 'No changes to save'}
              title={hasChanges ? 'Save changes' : 'No changes to save'}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={styles.icon}
                aria-hidden="true"
              >
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span className={styles.buttonText}>
                {hasChanges ? 'Save Changes' : 'Saved'}
              </span>
            </button>
          </>
        )}

        {/* Unsaved Changes Indicator */}
        {hasChanges && !isEditing && (
          <span className={styles.unsavedIndicator} aria-live="polite">
            Unsaved changes
          </span>
        )}
      </div>

      {/* Widget Picker Modal */}
      {showWidgetPicker && (
        <WidgetPicker
          onSelectWidget={handleWidgetSelected}
          onClose={() => setShowWidgetPicker(false)}
          existingWidgetIds={existingWidgetIds}
        />
      )}

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className={styles.confirmOverlay} role="presentation">
          <div
            className={styles.confirmDialog}
            role="alertdialog"
            aria-labelledby="reset-confirm-title"
            aria-describedby="reset-confirm-description"
          >
            <h3 id="reset-confirm-title" className={styles.confirmTitle}>
              Reset Dashboard Layout?
            </h3>
            <p id="reset-confirm-description" className={styles.confirmDescription}>
              This will restore the default dashboard layout. All your customizations will be lost.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmCancel}
                onClick={handleCancelReset}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.confirmReset}
                onClick={handleConfirmReset}
              >
                Reset Layout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DashboardCustomizer;
