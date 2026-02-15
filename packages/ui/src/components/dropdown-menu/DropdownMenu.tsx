import {
  useState,
  useRef,
  useCallback,
  useEffect,
  createContext,
  useContext,
  type ReactNode,
  type ReactElement,
  type KeyboardEvent,
} from 'react';
import styles from './DropdownMenu.module.css';

interface DropdownContextValue {
  close: () => void;
}
const DropdownContext = createContext<DropdownContextValue>({ close: () => {} });

interface GroupProps {
  label: string;
  children: ReactNode;
}
function Group({ label, children }: GroupProps) {
  return (
    <div role="group" aria-label={label}>
      <div className={styles.groupLabel}>{label}</div>
      {children}
    </div>
  );
}

interface ItemProps {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  shortcut?: string;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}
function Item({ children, onClick, icon, shortcut, variant = 'default', disabled = false }: ItemProps) {
  const { close } = useContext(DropdownContext);

  const handleClick = useCallback(() => {
    if (disabled) return;
    onClick?.();
    close();
  }, [onClick, close, disabled]);

  const itemClasses = [
    styles.item,
    variant === 'danger' ? styles.danger : '',
    disabled ? styles.disabled : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      role="menuitem"
      className={itemClasses}
      onClick={handleClick}
      disabled={disabled}
      tabIndex={-1}
      aria-disabled={disabled || undefined}
    >
      {icon && <span className={styles.itemIcon} aria-hidden="true">{icon}</span>}
      <span className={styles.itemLabel}>{children}</span>
      {shortcut && <span className={styles.itemShortcut} aria-hidden="true">{shortcut}</span>}
    </button>
  );
}

function Separator() {
  return <div role="separator" className={styles.separator} />;
}

export interface DropdownMenuProps {
  trigger: ReactElement;
  children: ReactNode;
  align?: 'left' | 'right';
}

export function DropdownMenu({ trigger, children, align = 'right' }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, close]);

  const handleMenuKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])');
      if (!items?.length) return;
      const currentIndex = Array.from(items).findIndex((el) => el === document.activeElement);

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          close();
          triggerRef.current?.querySelector('button')?.focus();
          break;
        case 'ArrowDown':
          e.preventDefault();
          items[currentIndex < items.length - 1 ? currentIndex + 1 : 0]?.focus();
          break;
        case 'ArrowUp':
          e.preventDefault();
          items[currentIndex > 0 ? currentIndex - 1 : items.length - 1]?.focus();
          break;
        case 'Home':
          e.preventDefault();
          items[0]?.focus();
          break;
        case 'End':
          e.preventDefault();
          items[items.length - 1]?.focus();
          break;
      }
    },
    [close]
  );

  useEffect(() => {
    if (isOpen && menuRef.current) {
      const firstItem = menuRef.current.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])');
      firstItem?.focus();
    }
  }, [isOpen]);

  const menuStyle = align === 'left' ? { left: 0, right: 'auto' } : {};

  return (
    <DropdownContext.Provider value={{ close }}>
      <div className={styles.wrapper}>
        <div ref={triggerRef} className={styles.trigger} onClick={toggle}>
          {trigger}
        </div>
        {isOpen && (
          <div
            ref={menuRef}
            role="menu"
            className={styles.menu}
            style={menuStyle}
            onKeyDown={handleMenuKeyDown}
          >
            {children}
          </div>
        )}
      </div>
    </DropdownContext.Provider>
  );
}

DropdownMenu.Group = Group;
DropdownMenu.Item = Item;
DropdownMenu.Separator = Separator;
