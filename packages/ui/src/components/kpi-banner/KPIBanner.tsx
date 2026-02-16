import { type HTMLAttributes } from 'react';
import styles from './KPIBanner.module.css';

export interface KPIItem {
  label: string;
  value: string | number;
  trend?: { direction: 'up' | 'down' | 'flat'; value: string; period: string };
  sparkline?: number[];
  variant?: 'primary' | 'success' | 'warning' | 'error';
  onClick?: () => void;
}

export interface KPIBannerProps {
  items: KPIItem[];
  className?: string;
}

export function KPIBanner({ items, className = '' }: KPIBannerProps) {
  return (
    <div className={`${styles.banner} ${className}`}>
      <div className={styles.grid}>
        {items.map((item, i) => (
          <div
            key={i}
            className={`${styles.card} ${item.onClick ? styles.clickable : ''}`}
            onClick={item.onClick}
            role={item.onClick ? 'button' : undefined}
            tabIndex={item.onClick ? 0 : undefined}
          >
            <div className={styles.label}>{item.label}</div>
            <div className={styles.value}>{item.value}</div>
            {item.trend && (
              <div className={`${styles.trend} ${styles[item.trend.direction]}`}>
                <span className={styles.trendIcon}>
                  {item.trend.direction === 'up' ? '↑' : item.trend.direction === 'down' ? '↓' : '→'}
                </span>
                <span>{item.trend.value}</span>
                <span className={styles.period}>{item.trend.period}</span>
              </div>
            )}
            {item.sparkline && item.sparkline.length > 1 && (
              <svg className={styles.sparkline} viewBox={`0 0 ${(item.sparkline.length - 1) * 10} 30`} preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  points={item.sparkline.map((v, j) => {
                    const max = Math.max(...item.sparkline!);
                    const min = Math.min(...item.sparkline!);
                    const range = max - min || 1;
                    return `${j * 10},${30 - ((v - min) / range) * 28}`;
                  }).join(' ')}
                />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
