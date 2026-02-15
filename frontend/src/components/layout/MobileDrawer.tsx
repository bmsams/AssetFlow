import { useEffect, useRef, useCallback, type ReactNode } from 'react';
import { FocusTrap } from '../accessibility/FocusTrap';
import styles from './MobileDrawer.module.css';

export type DrawerPosition = 'left' | 'right' | 'bottom';

export interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  position?: DrawerPosition;
  children: ReactNode;
  footer?: ReactNode;
  showCloseButton?: boolean;
}

/**
 * Mobile drawer component for slide-out menus and panels.
 * Supports left, right, and bottom positions with touch-friendly interactions.
 * Includes focus trapping for accessibility.
 */
export function MobileDrawer({
  isOpen,
  onClose,
  title,
  position = 'left',
  children,
  footer,
  showCloseButton = true,
}: MobileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const touchStartX = useRef<number>(0);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Handle touch start for swipe gestures
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    touchStartY.current = event.touches[0].clientY;
    touchStartX.current = event.touches[0].clientX;
  }, []);

  // Handle touch end for swipe gestures
  const handleTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      const touchEndY = event.changedTouches[0].clientY;
      const touchEndX = event.changedTouches[0].clientX;
      const deltaY = touchEndY - touchStartY.current;
      const deltaX = touchEndX - touchStartX.current;
      const swipeThreshold = 50;

      // Swipe down to close bottom drawer
      if (position === 'bottom' && deltaY > swipeThreshold) {
        onClose();
      }
      // Swipe left to close left drawer
      else if (position === 'left' && deltaX < -swipeThreshold) {
        onClose();
      }
      // Swipe right to close right drawer
      else if (position === 'right' && deltaX > swipeThreshold) {
        onClose();
      }
    },
    [position, onClose]
  );

  const drawerContent = (
    <>
      {/* Overlay */}
      <div
        className={`${styles.overlay} ${isOpen ? styles.visible : ''}`}
        onClick={onClose}
        aria-hidden="true"
        data-testid="drawer-overlay"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`${styles.drawer} ${styles[position]} ${isOpen ? styles.open : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Navigation drawer'}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Swipe handle for bottom drawer */}
        {position === 'bottom' && (
          <div className={styles.swipeHandle} aria-hidden="true" />
        )}

        {/* Header */}
        {(title || showCloseButton) && (
          <div className={styles.header}>
            {title && <h2 className={styles.title}>{title}</h2>}
            {showCloseButton && (
              <button
                type="button"
                className={styles.closeButton}
                onClick={onClose}
                aria-label="Close drawer"
              >
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
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className={styles.content}>{children}</div>

        {/* Footer */}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </>
  );

  // Wrap in FocusTrap when open
  if (isOpen) {
    return <FocusTrap isActive={isOpen}>{drawerContent}</FocusTrap>;
  }

  return drawerContent;
}
