import { useTheme } from './ThemeProvider';
import styles from './ThemeToggle.module.css';

export type ThemeToggleSize = 'sm' | 'md' | 'lg';

export interface ThemeToggleProps {
  /** Size of the toggle button */
  size?: ThemeToggleSize;
  /** Whether to show the theme label */
  showLabel?: boolean;
  /** Additional CSS class name */
  className?: string;
}

/**
 * ThemeToggle component provides an accessible way to switch between
 * light, dark, and system themes.
 * 
 * Features:
 * - Keyboard accessible (Enter/Space to toggle, arrow keys for options)
 * - Screen reader friendly with proper ARIA labels
 * - Persists preference to localStorage
 * - Respects system preference when set to 'system'
 */
export function ThemeToggle({ 
  size = 'md', 
  showLabel = false,
  className = '' 
}: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const handleToggle = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Allow arrow keys to cycle through themes
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      handleToggle();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      handleToggle();
    }
  };

  const getThemeLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
        return `System (${resolvedTheme})`;
    }
  };

  const getAriaLabel = () => {
    const currentLabel = getThemeLabel();
    return `Current theme: ${currentLabel}. Click to change theme.`;
  };

  const classNames = [
    styles.toggle,
    styles[size],
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={classNames}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      aria-label={getAriaLabel()}
      aria-live="polite"
      data-theme-value={theme}
      data-resolved-theme={resolvedTheme}
    >
      <span className={styles.iconContainer} aria-hidden="true">
        {/* Sun icon for light mode */}
        <svg
          className={`${styles.icon} ${styles.sunIcon} ${resolvedTheme === 'light' ? styles.active : ''}`}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>

        {/* Moon icon for dark mode */}
        <svg
          className={`${styles.icon} ${styles.moonIcon} ${resolvedTheme === 'dark' ? styles.active : ''}`}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>

        {/* System icon indicator */}
        {theme === 'system' && (
          <span className={styles.systemIndicator} aria-hidden="true">
            <svg
              width="8"
              height="8"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <circle cx="12" cy="12" r="10" />
            </svg>
          </span>
        )}
      </span>

      {showLabel && (
        <span className={styles.label}>{getThemeLabel()}</span>
      )}
    </button>
  );
}
