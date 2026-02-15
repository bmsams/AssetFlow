import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

export type CardVariant = 'elevated' | 'outlined' | 'flat';
export type CardPadding = 'none' | 'compact' | 'default' | 'spacious';

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

function CardHeader({ title, subtitle, actions }: CardHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.headerText}>
        <h3 className={styles.headerTitle}>{title}</h3>
        {subtitle && <span className={styles.headerSubtitle}>{subtitle}</span>}
      </div>
      {actions && <div className={styles.headerActions}>{actions}</div>}
    </div>
  );
}

function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.body} ${className}`}>{children}</div>;
}

function CardFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.footer} ${className}`}>{children}</div>;
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  interactive?: boolean;
  children: ReactNode;
}

const paddingMap: Record<CardPadding, string> = {
  none: styles.paddingNone,
  compact: styles.paddingCompact,
  default: styles.paddingDefault,
  spacious: styles.paddingSpacious,
};

export function Card({
  variant,
  padding = 'none',
  interactive = false,
  children,
  className = '',
  onClick,
  ...props
}: CardProps) {
  const cardClasses = [
    styles.card,
    variant ? styles[variant] : '',
    paddingMap[padding],
    interactive ? styles.interactive : '',
    className,
  ].filter(Boolean).join(' ');

  if (interactive) {
    return (
      <div
        className={cardClasses}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onClick) { e.preventDefault(); onClick(e as any); } }}
        {...props}
      >
        {children}
      </div>
    );
  }

  return <div className={cardClasses} onClick={onClick} {...props}>{children}</div>;
}

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
