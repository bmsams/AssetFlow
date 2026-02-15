import { NavLink } from 'react-router-dom';
import type { UserRole } from '../../hooks/useAuth';
import styles from './Sidebar.module.css';

export interface NavItem {
  path: string;
  label: string;
  icon?: React.ReactNode;
  roles?: UserRole[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  navGroups: NavGroup[];
}

export function Sidebar({ isOpen, onClose, navGroups }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className={styles.overlay}
          onClick={onClose}
          aria-hidden="true"
          data-testid="sidebar-overlay"
        />
      )}

      <aside
        className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}
      >
        <nav className={styles.nav} aria-label="Main navigation">
          {navGroups.map((group) => (
            <div key={group.title} className={styles.navGroup}>
              <h2 className={styles.navGroupTitle}>{group.title}</h2>
              <ul className={styles.navList}>
                {group.items.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === '/assets' || item.path === '/procurement'}
                      className={({ isActive }) =>
                        `${styles.navLink} ${isActive ? styles.active : ''}`
                      }
                      onClick={() => {
                        // Close sidebar on mobile after navigation
                        if (window.innerWidth < 768) {
                          onClose();
                        }
                      }}
                    >
                      {item.icon && <span className={styles.navIcon}>{item.icon}</span>}
                      <span className={styles.navLabel}>{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
