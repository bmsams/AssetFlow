import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './Header.module.css';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface HeaderUser {
  name: string;
  role: string;
  avatar?: string;
}

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  showNotifications?: boolean;
  notificationCount?: number;
  onNotificationClick?: () => void;
  user?: HeaderUser;
  onUserClick?: () => void;
  children?: ReactNode;
}

export function Header({
  title,
  subtitle,
  breadcrumbs,
  actions,
  showNotifications = false,
  notificationCount = 0,
  onNotificationClick,
  user,
  onUserClick,
  children,
}: HeaderProps) {
  return (
    <header className={styles.header}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className={styles.breadcrumbs}>
          <ol className={styles.breadcrumbList}>
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <li key={`${item.label}-${index}`} className={styles.breadcrumbItem}>
                  {index > 0 && <span className={styles.breadcrumbSeparator} aria-hidden="true">/</span>}
                  {isLast || !item.href ? (
                    <span className={styles.breadcrumbCurrent} aria-current={isLast ? 'page' : undefined}>
                      {item.label}
                    </span>
                  ) : (
                    <Link to={item.href} className={styles.breadcrumbLink}>{item.label}</Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {/* Main row */}
      <div className={styles.mainRow}>
        <div className={styles.titleArea}>
          {title && <h1 className={styles.title}>{title}</h1>}
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>

        <div className={styles.actionsArea}>
          {actions}

          {showNotifications && (
            <button
              className={styles.notificationButton}
              onClick={onNotificationClick}
              aria-label={`Notifications${notificationCount > 0 ? `, ${notificationCount} unread` : ''}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {notificationCount > 0 && (
                <span className={styles.notificationBadge}>{notificationCount > 99 ? '99+' : notificationCount}</span>
              )}
            </button>
          )}

          {user && (
            <button className={styles.userAvatar} onClick={onUserClick} aria-label={`User menu for ${user.name}`}>
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </button>
          )}

          {children}
        </div>
      </div>
    </header>
  );
}
