import { type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSidebarState } from '../../hooks/useSidebarState';
import styles from './Sidebar.module.css';

export interface NavItem {
  path: string;
  label: string;
  icon?: ReactNode;
  badge?: number | string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface SidebarUser {
  name: string;
  role: string;
  avatar?: string;
}

export interface SidebarProps {
  appName: string;
  navGroups: NavGroup[];
  user?: SidebarUser;
  logo?: ReactNode;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ appName, navGroups, user, logo, mobileOpen = false, onMobileClose }: SidebarProps) {
  const { collapsed, toggleCollapsed, isGroupCollapsed, toggleGroup } = useSidebarState();
  const location = useLocation();

  const sidebarClasses = [
    styles.sidebar,
    collapsed ? styles.collapsed : '',
    mobileOpen ? styles.mobileOpen : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      {mobileOpen && <div className={styles.overlay} onClick={onMobileClose} />}
      <aside className={sidebarClasses} aria-label="Sidebar navigation">
        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.brandLogo}>
            {logo || appName.charAt(0).toUpperCase()}
          </div>
          <span className={styles.brandName}>{appName}</span>
          <button
            className={styles.collapseToggle}
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {collapsed ? (
                <polyline points="9 18 15 12 9 6" />
              ) : (
                <polyline points="15 18 9 12 15 6" />
              )}
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {navGroups.map((group) => {
            const groupCollapsed = isGroupCollapsed(group.title);
            return (
              <div key={group.title} className={styles.group}>
                <div className={styles.groupHeader} onClick={() => toggleGroup(group.title)}>
                  <span className={styles.groupTitle}>{group.title}</span>
                  <svg
                    className={`${styles.groupChevron} ${!groupCollapsed ? styles.open : ''}`}
                    width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
                <ul className={`${styles.groupItems} ${groupCollapsed ? styles.hidden : ''}`}>
                  {group.items.map((item) => (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        className={({ isActive }) =>
                          `${styles.navLink} ${isActive ? styles.active : ''}`
                        }
                        end={item.path === '/'}
                      >
                        {item.icon && <span className={styles.navIcon}>{item.icon}</span>}
                        <span className={styles.navLabel}>{item.label}</span>
                        {item.badge !== undefined && (
                          <span className={styles.navBadge}>{item.badge}</span>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        {user && (
          <div className={styles.userFooter}>
            <div className={styles.userAvatar}>
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{user.name}</div>
              <div className={styles.userRole}>{user.role}</div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
