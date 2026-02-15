import { useCallback, useState, useRef, useEffect } from 'react';
import styles from './ColumnSelector.module.css';

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  sortable?: boolean;
}

export interface ColumnSelectorProps {
  /** Available columns */
  columns: ColumnConfig[];
  /** Callback when column visibility changes */
  onColumnsChange: (columns: ColumnConfig[]) => void;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * ColumnSelector component for customizing visible columns
 * Implements Requirement 2.1: Column customization for asset list
 */
export function ColumnSelector({
  columns,
  onColumnsChange,
  disabled = false,
}: ColumnSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleColumnToggle = useCallback(
    (columnId: string) => {
      const newColumns = columns.map((col) =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      );
      onColumnsChange(newColumns);
    },
    [columns, onColumnsChange]
  );

  const handleShowAll = useCallback(() => {
    const newColumns = columns.map((col) => ({ ...col, visible: true }));
    onColumnsChange(newColumns);
  }, [columns, onColumnsChange]);

  const handleHideAll = useCallback(() => {
    // Keep at least the first column visible
    const newColumns = columns.map((col, index) => ({
      ...col,
      visible: index === 0,
    }));
    onColumnsChange(newColumns);
  }, [columns, onColumnsChange]);

  const visibleCount = columns.filter((col) => col.visible).length;

  return (
    <div className={styles.columnSelector}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.toggleButton}
        onClick={handleToggle}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Customize columns. ${visibleCount} of ${columns.length} visible`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
        Columns
        <span className={styles.badge}>{visibleCount}</span>
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className={styles.dropdown}
          role="menu"
          aria-label="Column visibility options"
        >
          <div className={styles.dropdownHeader}>
            <span className={styles.dropdownTitle}>Show/Hide Columns</span>
            <div className={styles.dropdownActions}>
              <button
                type="button"
                className={styles.actionButton}
                onClick={handleShowAll}
              >
                Show All
              </button>
              <button
                type="button"
                className={styles.actionButton}
                onClick={handleHideAll}
              >
                Hide All
              </button>
            </div>
          </div>
          <div className={styles.dropdownContent}>
            {columns.map((column) => (
              <label
                key={column.id}
                className={styles.columnOption}
                role="menuitemcheckbox"
                aria-checked={column.visible}
              >
                <input
                  type="checkbox"
                  checked={column.visible}
                  onChange={() => handleColumnToggle(column.id)}
                  className={styles.checkbox}
                />
                <span className={styles.columnLabel}>{column.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ColumnSelector;
