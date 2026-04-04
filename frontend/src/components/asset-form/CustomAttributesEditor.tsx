import { useState, useCallback } from 'react';
import styles from './CustomAttributesEditor.module.css';

export interface CustomAttribute {
  id: string;
  key: string;
  value: string;
}

export interface CustomAttributesEditorProps {
  /** Current custom attributes */
  attributes: CustomAttribute[];
  /** Change handler */
  onChange: (attributes: CustomAttribute[]) => void;
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Maximum number of attributes allowed */
  maxAttributes?: number;
  /** Error message */
  error?: string;
}

/**
 * CustomAttributesEditor component - Manages custom key-value attributes
 * 
 * Implements Requirements:
 * - 2.8: System shall support custom attributes per asset type for extensibility
 */
export function CustomAttributesEditor({
  attributes,
  onChange,
  disabled = false,
  maxAttributes = 20,
  error,
}: CustomAttributesEditorProps) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);

  const generateId = () => `attr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const validateKey = useCallback((key: string): string | null => {
    if (!key.trim()) {
      return 'Key is required';
    }
    if (key.length > 50) {
      return 'Key must be 50 characters or less';
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
      return 'Key must start with a letter and contain only letters, numbers, and underscores';
    }
    if (attributes.some((attr) => attr.key.toLowerCase() === key.toLowerCase())) {
      return 'This key already exists';
    }
    return null;
  }, [attributes]);

  const handleAddAttribute = useCallback(() => {
    const validationError = validateKey(newKey);
    if (validationError) {
      setKeyError(validationError);
      return;
    }

    const newAttribute: CustomAttribute = {
      id: generateId(),
      key: newKey.trim(),
      value: newValue.trim(),
    };

    onChange([...attributes, newAttribute]);
    setNewKey('');
    setNewValue('');
    setKeyError(null);
  }, [newKey, newValue, attributes, onChange, validateKey]);

  const handleRemoveAttribute = useCallback(
    (id: string) => {
      onChange(attributes.filter((attr) => attr.id !== id));
    },
    [attributes, onChange]
  );

  const handleUpdateAttribute = useCallback(
    (id: string, field: 'key' | 'value', value: string) => {
      onChange(
        attributes.map((attr) =>
          attr.id === id ? { ...attr, [field]: value } : attr
        )
      );
    },
    [attributes, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddAttribute();
    }
  };

  const canAddMore = attributes.length < maxAttributes;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4 className={styles.title}>Custom Attributes</h4>
        <span className={styles.count}>
          {attributes.length} / {maxAttributes}
        </span>
      </div>

      {/* Existing Attributes */}
      {attributes.length > 0 && (
        <div className={styles.attributesList} role="list" aria-label="Custom attributes">
          {attributes.map((attr) => (
            <div key={attr.id} className={styles.attributeRow} role="listitem">
              <input
                type="text"
                value={attr.key}
                onChange={(e) => handleUpdateAttribute(attr.id, 'key', e.target.value)}
                className={styles.keyInput}
                placeholder="Key"
                disabled={disabled}
                aria-label={`Attribute key for ${attr.key || 'new attribute'}`}
              />
              <input
                type="text"
                value={attr.value}
                onChange={(e) => handleUpdateAttribute(attr.id, 'value', e.target.value)}
                className={styles.valueInput}
                placeholder="Value"
                disabled={disabled}
                aria-label={`Attribute value for ${attr.key || 'new attribute'}`}
              />
              <button
                type="button"
                onClick={() => handleRemoveAttribute(attr.id)}
                className={styles.removeButton}
                disabled={disabled}
                aria-label={`Remove attribute ${attr.key}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Attribute */}
      {canAddMore && (
        <div className={styles.addSection}>
          <div className={styles.addRow}>
            <input
              type="text"
              value={newKey}
              onChange={(e) => {
                setNewKey(e.target.value);
                setKeyError(null);
              }}
              onKeyDown={handleKeyDown}
              className={`${styles.keyInput} ${keyError ? styles.inputError : ''}`}
              placeholder="New key"
              disabled={disabled}
              aria-label="New attribute key"
              aria-invalid={!!keyError}
            />
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className={styles.valueInput}
              placeholder="New value"
              disabled={disabled}
              aria-label="New attribute value"
            />
            <button
              type="button"
              onClick={handleAddAttribute}
              className={styles.addButton}
              disabled={disabled || !newKey.trim()}
              aria-label="Add attribute"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
          {keyError && (
            <span className={styles.keyError} role="alert">
              {keyError}
            </span>
          )}
        </div>
      )}

      {/* Empty State */}
      {attributes.length === 0 && !canAddMore && (
        <p className={styles.emptyState}>No custom attributes</p>
      )}

      {/* Max Reached Message */}
      {!canAddMore && attributes.length > 0 && (
        <p className={styles.maxReached}>Maximum number of attributes reached</p>
      )}

      {/* Error */}
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export default CustomAttributesEditor;
