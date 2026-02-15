import type { AssetType } from '../../types/asset';
import styles from './AssetTypeSelector.module.css';

export interface AssetTypeSelectorProps {
  /** Currently selected asset type */
  value: AssetType | '';
  /** Change handler */
  onChange: (type: AssetType) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Error message */
  error?: string;
}

interface AssetTypeOption {
  type: AssetType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const assetTypeOptions: AssetTypeOption[] = [
  {
    type: 'HARDWARE',
    label: 'Hardware',
    description: 'Physical IT equipment like laptops, servers, and network devices',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    type: 'SOFTWARE',
    label: 'Software',
    description: 'Software licenses, subscriptions, and entitlements',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    type: 'ENTERPRISE',
    label: 'Enterprise',
    description: 'Non-IT assets like medical devices, machinery, and facilities equipment',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M3 21h18" />
        <path d="M9 8h1" />
        <path d="M9 12h1" />
        <path d="M9 16h1" />
        <path d="M14 8h1" />
        <path d="M14 12h1" />
        <path d="M14 16h1" />
        <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
      </svg>
    ),
  },
];

/**
 * AssetTypeSelector component - Visual selector for asset type
 * 
 * Implements Requirements:
 * - 2.2: Support asset types including Hardware, Software, and Enterprise categories
 */
export function AssetTypeSelector({
  value,
  onChange,
  disabled = false,
  error,
}: AssetTypeSelectorProps) {
  const handleSelect = (type: AssetType) => {
    if (!disabled) {
      onChange(type);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, type: AssetType) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect(type);
    }
  };

  return (
    <div className={styles.container}>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>
          Asset Type
          <span className={styles.required} aria-hidden="true">*</span>
        </legend>
        <div className={styles.options} role="radiogroup" aria-label="Select asset type">
          {assetTypeOptions.map((option) => (
            <div
              key={option.type}
              className={`${styles.option} ${value === option.type ? styles.optionSelected : ''} ${disabled ? styles.optionDisabled : ''}`}
              role="radio"
              aria-checked={value === option.type}
              tabIndex={disabled ? -1 : 0}
              onClick={() => handleSelect(option.type)}
              onKeyDown={(e) => handleKeyDown(e, option.type)}
            >
              <div className={styles.optionIcon}>{option.icon}</div>
              <div className={styles.optionContent}>
                <span className={styles.optionLabel}>{option.label}</span>
                <span className={styles.optionDescription}>{option.description}</span>
              </div>
              {value === option.type && (
                <div className={styles.checkmark}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </fieldset>
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export default AssetTypeSelector;
