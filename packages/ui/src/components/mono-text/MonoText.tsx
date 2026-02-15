import { useState, useCallback, type ReactNode, type HTMLAttributes } from 'react';
import styles from './MonoText.module.css';

export interface MonoTextProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  children: ReactNode;
  code?: boolean;
  copyable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  truncate?: boolean;
  maxWidth?: number;
}

export function MonoText({
  children,
  code = false,
  copyable = false,
  size = 'md',
  truncate = false,
  maxWidth,
  className = '',
  ...props
}: MonoTextProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = typeof children === 'string' ? children : String(children);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [children]);

  const Tag = code ? 'code' : 'span';
  const monoClasses = [styles.mono, styles[size], truncate ? styles.truncate : '', className].filter(Boolean).join(' ');
  const style = truncate && maxWidth ? { maxWidth: `${maxWidth}px` } : undefined;

  if (!copyable) {
    return <Tag className={monoClasses} style={style} {...props}>{children}</Tag>;
  }

  return (
    <span className={styles.wrapper}>
      <Tag className={monoClasses} style={style} {...props}>{children}</Tag>
      {copied ? (
        <span className={styles.copied}>Copied!</span>
      ) : (
        <button type="button" className={styles.copyButton} onClick={handleCopy} aria-label="Copy to clipboard">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        </button>
      )}
    </span>
  );
}
