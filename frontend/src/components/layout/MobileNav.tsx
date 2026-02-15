import { NavLink } from 'react-router-dom';
import styles from './MobileNav.module.css';

export interface MobileNavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

export interface MobileNavProps {
  items: MobileNavItem[];
  maxItems?: number;
  onMoreClick?: () => void;
}

/**
 * Mobile bottom navigation bar component.
 * Displays up to maxItems navigation items with an optional "More" button.
 * Optimized for touch interactions with 44px minimum touch targets.
 */
export function MobileNav({ items, maxItems = 4, onMoreClick }: MobileNavProps) {
  const displayItems = items.slice(0, maxItems);
  const hasMore = items.length > maxItems || onMoreClick;

  return (
    <nav className={styles.mobileNav} aria-label="Mobile navigation">
      <ul className={styles.navList}>
        {displayItems.map((item) => (
          <li key={item.path} className={styles.navItem}>
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.active : ''}`
              }
            >
              <span className={styles.navIcon} aria-hidden="true">
                {item.icon}
              </span>
              <span className={styles.navLabel}>{item.label}</span>
            </NavLink>
          </li>
        ))}
        {hasMore && (
          <li className={styles.navItem}>
            <button
              type="button"
              className={styles.navLink}
              onClick={onMoreClick}
              aria-label="More navigation options"
            >
              <span className={styles.navIcon} aria-hidden="true">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </span>
              <span className={styles.navLabel}>More</span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}
