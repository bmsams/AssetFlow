import { useCallback } from 'react';
import { useFormContext } from './FormContext';
import styles from './Form.module.css';

export interface FormDynamicFieldsProps {
  name: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
  disabled?: boolean;
}

interface KeyValuePair {
  key: string;
  value: string;
}

export function FormDynamicFields({
  name,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  addLabel = '+ Add row',
  disabled = false,
}: FormDynamicFieldsProps) {
  const { values, setValue } = useFormContext();
  const pairs: KeyValuePair[] = values[name] ?? [];

  const updatePair = useCallback(
    (index: number, field: 'key' | 'value', fieldValue: string) => {
      const updated = pairs.map((pair, i) =>
        i === index ? { ...pair, [field]: fieldValue } : pair
      );
      setValue(name, updated);
    },
    [name, pairs, setValue]
  );

  const addRow = useCallback(() => {
    setValue(name, [...pairs, { key: '', value: '' }]);
  }, [name, pairs, setValue]);

  const removeRow = useCallback(
    (index: number) => {
      setValue(
        name,
        pairs.filter((_, i) => i !== index)
      );
    },
    [name, pairs, setValue]
  );

  return (
    <div className={styles.dynamicFields}>
      {pairs.map((pair, index) => (
        <div key={index} className={styles.dynamicFieldRow}>
          <input
            className={styles.dynamicFieldKey}
            value={pair.key}
            placeholder={keyPlaceholder}
            disabled={disabled}
            onChange={(e) => updatePair(index, 'key', e.target.value)}
            aria-label={`${keyPlaceholder} ${index + 1}`}
          />
          <input
            className={styles.dynamicFieldValue}
            value={pair.value}
            placeholder={valuePlaceholder}
            disabled={disabled}
            onChange={(e) => updatePair(index, 'value', e.target.value)}
            aria-label={`${valuePlaceholder} ${index + 1}`}
          />
          <button
            type="button"
            className={styles.dynamicFieldRemove}
            onClick={() => removeRow(index)}
            disabled={disabled}
            aria-label={`Remove row ${index + 1}`}
          >
            &#215;
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.dynamicFieldAdd}
        onClick={addRow}
        disabled={disabled}
      >
        {addLabel}
      </button>
    </div>
  );
}
