import { useState, useRef, useCallback, type ReactNode } from 'react';
import styles from './SwipeableCard.module.css';

export type SwipeDirection = 'left' | 'right';

export interface SwipeAction {
  direction: SwipeDirection;
  label: string;
  icon?: ReactNode;
  color?: 'primary' | 'success' | 'warning' | 'danger';
  onSwipe: () => void;
}

export interface SwipeableCardProps {
  children: ReactNode;
  actions?: SwipeAction[];
  swipeThreshold?: number;
  disabled?: boolean;
  className?: string;
  onTap?: () => void;
}

/**
 * Touch-friendly swipeable card component.
 * Supports left and right swipe actions with visual feedback.
 * Optimized for mobile touch interactions.
 */
export function SwipeableCard({
  children,
  actions = [],
  swipeThreshold = 80,
  disabled = false,
  className = '',
  onTap,
}: SwipeableCardProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [activeAction, setActiveAction] = useState<SwipeAction | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const leftAction = actions.find((a) => a.direction === 'left');
  const rightAction = actions.find((a) => a.direction === 'right');

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (disabled) return;

      touchStartX.current = event.touches[0].clientX;
      touchStartY.current = event.touches[0].clientY;
      touchStartTime.current = Date.now();
      isHorizontalSwipe.current = null;
      setIsDragging(true);
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (disabled || !isDragging) return;

      const currentX = event.touches[0].clientX;
      const currentY = event.touches[0].clientY;
      const deltaX = currentX - touchStartX.current;
      const deltaY = currentY - touchStartY.current;

      // Determine swipe direction on first significant movement
      if (isHorizontalSwipe.current === null) {
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
          isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
        }
      }

      // Only handle horizontal swipes
      if (isHorizontalSwipe.current !== true) return;

      // Prevent vertical scrolling during horizontal swipe
      event.preventDefault();

      // Limit swipe distance with resistance
      const maxSwipe = 150;
      const resistance = 0.5;
      let newTranslateX = deltaX;

      // Apply resistance when swiping beyond threshold
      if (Math.abs(deltaX) > swipeThreshold) {
        const excess = Math.abs(deltaX) - swipeThreshold;
        newTranslateX =
          Math.sign(deltaX) * (swipeThreshold + excess * resistance);
      }

      // Clamp to max swipe distance
      newTranslateX = Math.max(-maxSwipe, Math.min(maxSwipe, newTranslateX));

      // Only allow swipe if there's an action for that direction
      if (newTranslateX > 0 && !rightAction) newTranslateX = 0;
      if (newTranslateX < 0 && !leftAction) newTranslateX = 0;

      setTranslateX(newTranslateX);

      // Update active action indicator
      if (Math.abs(newTranslateX) >= swipeThreshold) {
        setActiveAction(newTranslateX > 0 ? rightAction || null : leftAction || null);
      } else {
        setActiveAction(null);
      }
    },
    [disabled, isDragging, swipeThreshold, leftAction, rightAction]
  );

  const handleTouchEnd = useCallback(() => {
    if (disabled) return;

    const touchDuration = Date.now() - touchStartTime.current;
    const isTap = touchDuration < 200 && Math.abs(translateX) < 10;

    if (isTap && onTap) {
      onTap();
    } else if (activeAction) {
      // Trigger the swipe action
      activeAction.onSwipe();
    }

    // Reset state
    setTranslateX(0);
    setIsDragging(false);
    setActiveAction(null);
    isHorizontalSwipe.current = null;
  }, [disabled, translateX, activeAction, onTap]);

  const getActionColorClass = (color?: string) => {
    switch (color) {
      case 'success':
        return styles.actionSuccess;
      case 'warning':
        return styles.actionWarning;
      case 'danger':
        return styles.actionDanger;
      default:
        return styles.actionPrimary;
    }
  };

  return (
    <div
      className={`${styles.container} ${className}`}
      data-testid="swipeable-card"
    >
      {/* Left action background (revealed when swiping right) */}
      {rightAction && (
        <div
          className={`${styles.actionBackground} ${styles.actionLeft} ${getActionColorClass(rightAction.color)} ${activeAction === rightAction ? styles.actionActive : ''}`}
          aria-hidden="true"
        >
          {rightAction.icon && (
            <span className={styles.actionIcon}>{rightAction.icon}</span>
          )}
          <span className={styles.actionLabel}>{rightAction.label}</span>
        </div>
      )}

      {/* Right action background (revealed when swiping left) */}
      {leftAction && (
        <div
          className={`${styles.actionBackground} ${styles.actionRight} ${getActionColorClass(leftAction.color)} ${activeAction === leftAction ? styles.actionActive : ''}`}
          aria-hidden="true"
        >
          <span className={styles.actionLabel}>{leftAction.label}</span>
          {leftAction.icon && (
            <span className={styles.actionIcon}>{leftAction.icon}</span>
          )}
        </div>
      )}

      {/* Card content */}
      <div
        ref={cardRef}
        className={`${styles.card} ${isDragging ? styles.dragging : ''}`}
        style={{
          transform: `translateX(${translateX}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role={onTap ? 'button' : undefined}
        tabIndex={onTap ? 0 : undefined}
        onKeyDown={
          onTap
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onTap();
                }
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}
