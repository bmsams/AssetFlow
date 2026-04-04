/**
 * WidgetPicker - Component for selecting widgets to add to dashboard
 * Implements Requirement 12.7: Dashboard widgets shall be configurable per user
 */

import { useState, useCallback } from 'react';
import type { WidgetType, WidgetConfig, WidgetSize } from '../../types/widget';
import { WIDGET_METADATA } from '../../types/widget';
import styles from './WidgetPicker.module.css';

export interface WidgetPickerProps {
  /** Callback when a widget is selected */
  onSelectWidget: (widget: WidgetConfig) => void;
  /** Callback to close the picker */
  onClose: () => void;
  /** Widget IDs already in use (to prevent duplicates) */
  existingWidgetIds?: string[];
}

/**
 * Generate a unique widget ID
 */
function generateWidgetId(type: WidgetType): string {
  return `widget-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * WidgetPicker component
 */
export function WidgetPicker({
  onSelectWidget,
  onClose,
  existingWidgetIds: _existingWidgetIds = [],
}: WidgetPickerProps) {
  const [selectedType, setSelectedType] = useState<WidgetType | null>(null);
  const [title, setTitle] = useState('');
  const [size, setSize] = useState<WidgetSize>('medium');

  const selectedMetadata = selectedType
    ? WIDGET_METADATA.find((m) => m.type === selectedType)
    : null;

  const handleTypeSelect = useCallback((type: WidgetType) => {
    setSelectedType(type);
    const metadata = WIDGET_METADATA.find((m) => m.type === type);
    if (metadata) {
      setTitle(metadata.name);
      setSize(metadata.defaultSize);
    }
  }, []);

  const handleAddWidget = useCallback(() => {
    if (!selectedType || !title.trim()) return;

    const newWidget: WidgetConfig = {
      id: generateWidgetId(selectedType),
      type: selectedType,
      title: title.trim(),
      visible: true,
      position: { row: 999, column: 0 }, // Will be placed at the end
      size,
      settings: {},
    };

    onSelectWidget(newWidget);
    onClose();
  }, [selectedType, title, size, onSelectWidget, onClose]);

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.picker}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="widget-picker-title"
        aria-modal="true"
      >
        <header className={styles.header}>
          <h2 id="widget-picker-title" className={styles.title}>
            Add Widget
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close widget picker"
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className={styles.content}>
          {/* Widget Type Selection */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Select Widget Type</h3>
            <div className={styles.widgetGrid} role="listbox" aria-label="Widget types">
              {WIDGET_METADATA.map((metadata) => (
                <button
                  key={metadata.type}
                  type="button"
                  className={`${styles.widgetOption} ${
                    selectedType === metadata.type ? styles.selected : ''
                  }`}
                  onClick={() => handleTypeSelect(metadata.type)}
                  role="option"
                  aria-selected={selectedType === metadata.type}
                >
                  <span className={styles.widgetIcon} aria-hidden="true">
                    {metadata.icon}
                  </span>
                  <span className={styles.widgetName}>{metadata.name}</span>
                  <span className={styles.widgetDescription}>{metadata.description}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Widget Configuration */}
          {selectedMetadata && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Configure Widget</h3>
              
              <div className={styles.formGroup}>
                <label htmlFor="widget-title" className={styles.label}>
                  Title
                </label>
                <input
                  id="widget-title"
                  type="text"
                  className={styles.input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter widget title"
                  maxLength={50}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="widget-size" className={styles.label}>
                  Size
                </label>
                <select
                  id="widget-size"
                  className={styles.select}
                  value={size}
                  onChange={(e) => setSize(e.target.value as WidgetSize)}
                >
                  {selectedMetadata.availableSizes.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </section>
          )}
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.addButton}
            onClick={handleAddWidget}
            disabled={!selectedType || !title.trim()}
          >
            Add Widget
          </button>
        </footer>
      </div>
    </div>
  );
}

export default WidgetPicker;
