import type { ReactNode } from 'react';
import styles from './DetailHeader.module.css';

export interface DetailHeaderProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  badges?: Array<{ label: string; color?: string }>;
  actions?: ReactNode;
  sticky?: boolean;
  className?: string;
}

const COLOR_MAP: Record<string, string> = {
  green: styles.badgeGreen,
  blue: styles.badgeBlue,
  red: styles.badgeRed,
  yellow: styles.badgeYellow,
  gray: styles.badgeGray,
  orange: styles.badgeOrange,
  purple: styles.badgePurple,
};

/**
 * DetailHeader - A reusable sticky header bar for detail pages.
 *
 * Renders an icon on the left, title/subtitle/badges in the center,
 * and action buttons on the right. Uses `position: sticky` by default.
 */
export function DetailHeader({
  icon,
  title,
  subtitle,
  badges,
  actions,
  sticky = true,
  className,
}: DetailHeaderProps) {
  const rootClasses = [
    styles.header,
    sticky ? styles.sticky : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <header className={rootClasses} data-testid="detail-header">
      {icon && <div className={styles.icon}>{icon}</div>}

      <div className={styles.content}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{title}</h1>
          {badges && badges.length > 0 && (
            <div className={styles.badges}>
              {badges.map((badge) => (
                <span
                  key={badge.label}
                  className={[
                    styles.badge,
                    badge.color ? COLOR_MAP[badge.color] ?? '' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          )}
        </div>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>

      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}

export default DetailHeader;
