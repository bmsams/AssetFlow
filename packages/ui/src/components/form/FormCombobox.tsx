import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { useFormContext } from './FormContext';
import styles from './Form.module.css';

export interface FormComboboxProps {
  name: string;
  options: Array<{ value: string; label: string }>;
  loadOptions?: (query: string) => Promise<Array<{ value: string; label: string }>>;
  placeholder?: string;
  disabled?: boolean;
  dependsOn?: string;
}

export function FormCombobox({
  name,
  options: staticOptions,
  loadOptions,
  placeholder,
  disabled = false,
  dependsOn,
}: FormComboboxProps) {
  const { values, errors, touched, setValue, setTouched, registerDependency } = useFormContext();
  const selectedValue = values[name] ?? '';
  const hasError = !!(errors[name] && touched[name]);

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [asyncOptions, setAsyncOptions] = useState<Array<{ value: string; label: string }>>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const baseOptions = loadOptions ? asyncOptions : staticOptions;
  const filteredOptions = query
    ? baseOptions.filter((opt) =>
        opt.label.toLowerCase().includes(query.toLowerCase())
      )
    : baseOptions;

  const selectedLabel = baseOptions.find((o) => o.value === selectedValue)?.label ?? '';

  useEffect(() => {
    return registerDependency(name, dependsOn);
  }, [dependsOn, name, registerDependency]);

  // Async loading
  useEffect(() => {
    if (!loadOptions || !isOpen) return;
    let cancelled = false;
    loadOptions(query).then((results) => {
      if (!cancelled) setAsyncOptions(results);
    });
    return () => { cancelled = true; };
  }, [loadOptions, query, isOpen]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      setIsOpen(true);
      setHighlightedIndex(-1);
      if (e.target.value === '') {
        setValue(name, '');
      }
    },
    [name, setValue]
  );

  const handleSelect = useCallback(
    (optValue: string) => {
      setValue(name, optValue);
      const label = baseOptions.find((o) => o.value === optValue)?.label ?? optValue;
      setQuery(label);
      setIsOpen(false);
    },
    [name, setValue, baseOptions]
  );

  const handleFocus = useCallback(() => {
    setIsOpen(true);
    if (!query && selectedLabel) {
      setQuery(selectedLabel);
    }
  }, [query, selectedLabel]);

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setTouched(name);
      if (!selectedValue) setQuery('');
    }, 150);
  }, [name, selectedValue, setTouched]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          setIsOpen(true);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex].value);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          break;
      }
    },
    [isOpen, filteredOptions, highlightedIndex, handleSelect]
  );

  return (
    <div className={styles.combobox} ref={containerRef}>
      <input
        id={name}
        type="text"
        role="combobox"
        className={styles.comboboxInput}
        value={isOpen ? query : (selectedLabel || query)}
        placeholder={placeholder}
        disabled={disabled}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-invalid={hasError || undefined}
        autoComplete="off"
      />
      {isOpen && (
        <div className={styles.comboboxDropdown} role="listbox">
          {filteredOptions.length === 0 ? (
            <div className={styles.comboboxEmpty}>No results found</div>
          ) : (
            filteredOptions.map((opt, index) => {
              const isHighlighted = index === highlightedIndex;
              const isSelected = opt.value === selectedValue;
              const optClasses = [
                styles.comboboxOption,
                isHighlighted ? styles.comboboxOptionHighlighted : '',
                isSelected ? styles.comboboxOptionSelected : '',
              ].filter(Boolean).join(' ');

              return (
                <div
                  key={opt.value}
                  role="option"
                  className={optClasses}
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(opt.value)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {opt.label}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
