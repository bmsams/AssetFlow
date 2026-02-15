import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import styles from './SplitPanel.module.css';

interface SplitPanelLeftProps {
  children: ReactNode;
  className?: string;
}

function Left({ children, className = '' }: SplitPanelLeftProps) {
  return <div className={`${styles.left} ${className}`}>{children}</div>;
}

interface SplitPanelRightProps {
  children: ReactNode;
  className?: string;
}

function Right({ children, className = '' }: SplitPanelRightProps) {
  return <div className={className}>{children}</div>;
}

export interface SplitPanelProps {
  children: ReactNode;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  collapsible?: boolean;
  onResize?: (size: number) => void;
  className?: string;
}

export function SplitPanel({
  children,
  defaultSize = 50,
  minSize = 20,
  maxSize = 80,
  collapsible = false,
  onResize,
  className = '',
}: SplitPanelProps) {
  const [leftPercent, setLeftPercent] = useState(defaultSize);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
    },
    []
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(maxSize, Math.max(minSize, percent));
      setLeftPercent(clamped);
      onResize?.(clamped);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, maxSize, minSize, onResize]);

  const childArray = Array.isArray(children) ? children : [children];
  const leftChild = childArray.find((c: any) => c?.type === Left);
  const rightChild = childArray.find((c: any) => c?.type === Right);

  const containerClasses = [
    styles.container,
    isDragging ? styles.noSelect : '',
    className,
  ].filter(Boolean).join(' ');

  const handleClasses = [
    styles.handle,
    isDragging ? styles.dragging : '',
  ].filter(Boolean).join(' ');

  const rightClasses = [
    styles.right,
    isCollapsed ? styles.collapsed : '',
  ].filter(Boolean).join(' ');

  return (
    <div ref={containerRef} className={containerClasses}>
      <div className={styles.left} style={{ width: isCollapsed ? '100%' : `${leftPercent}%` }}>
        {leftChild}
      </div>
      <div
        className={handleClasses}
        onMouseDown={handleMouseDown}
        style={{ position: 'relative' }}
      >
        {collapsible && (
          <button
            className={styles.collapseButton}
            onClick={() => setIsCollapsed((c) => !c)}
            aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isCollapsed ? (
                <polyline points="9 18 15 12 9 6" />
              ) : (
                <polyline points="15 18 9 12 15 6" />
              )}
            </svg>
          </button>
        )}
      </div>
      <div className={rightClasses}>
        {rightChild}
      </div>
    </div>
  );
}

SplitPanel.Left = Left;
SplitPanel.Right = Right;
