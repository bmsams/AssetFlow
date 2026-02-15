import {
  useState,
  useCallback,
  useRef,
  createContext,
  useContext,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import styles from './Tabs.module.css';

interface TabsContextValue {
  activeValue: string;
  setActiveValue: (value: string) => void;
  variant: 'underline' | 'pill';
  visitedTabs: Set<string>;
}

const TabsContext = createContext<TabsContextValue>({
  activeValue: '',
  setActiveValue: () => {},
  variant: 'underline',
  visitedTabs: new Set(),
});

interface TabsProps {
  defaultValue: string;
  value?: string;
  onChange?: (value: string) => void;
  variant?: 'underline' | 'pill';
  children: ReactNode;
}

function TabsRoot({ defaultValue, value, onChange, variant = 'underline', children }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [visitedTabs] = useState<Set<string>>(() => new Set([defaultValue]));
  const activeValue = value ?? internalValue;

  const setActiveValue = useCallback(
    (val: string) => {
      visitedTabs.add(val);
      setInternalValue(val);
      onChange?.(val);
    },
    [onChange, visitedTabs]
  );

  return (
    <TabsContext.Provider value={{ activeValue, setActiveValue, variant, visitedTabs }}>
      <div className={variant === 'pill' ? styles.pill : undefined}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

function TabList({ children }: { children: ReactNode }) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const tabs = listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])');
    if (!tabs?.length) return;
    const currentIndex = Array.from(tabs).findIndex((t) => t === document.activeElement);

    let nextIndex = currentIndex;
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }
    tabs[nextIndex]?.focus();
  }, []);

  return (
    <div ref={listRef} role="tablist" className={styles.tabList} onKeyDown={handleKeyDown}>
      {children}
    </div>
  );
}

interface TabProps {
  value: string;
  badge?: number | string;
  disabled?: boolean;
  children: ReactNode;
}

function Tab({ value, badge, disabled = false, children }: TabProps) {
  const { activeValue, setActiveValue } = useContext(TabsContext);
  const isActive = activeValue === value;

  const handleClick = useCallback(() => {
    if (!disabled) setActiveValue(value);
  }, [disabled, setActiveValue, value]);

  const tabClasses = [
    styles.tab,
    isActive ? styles.active : '',
    disabled ? styles.disabled : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      role="tab"
      className={tabClasses}
      aria-selected={isActive}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      tabIndex={isActive ? 0 : -1}
      onClick={handleClick}
    >
      {children}
      {badge !== undefined && <span className={styles.badge}>{badge}</span>}
    </button>
  );
}

interface PanelProps {
  value: string;
  lazy?: boolean;
  children: ReactNode;
}

function Panel({ value, lazy = false, children }: PanelProps) {
  const { activeValue, visitedTabs } = useContext(TabsContext);
  const isActive = activeValue === value;

  if (!isActive && (lazy && !visitedTabs.has(value))) {
    return null;
  }

  if (!isActive) {
    return null;
  }

  return (
    <div role="tabpanel" className={styles.panel}>
      {children}
    </div>
  );
}

export const Tabs = Object.assign(TabsRoot, {
  List: TabList,
  Tab,
  Panel,
});
