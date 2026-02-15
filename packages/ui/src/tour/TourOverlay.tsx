import { useState, useEffect, useRef } from 'react';
import type { TourStep } from './useTour';
import styles from './Tour.module.css';

interface TourOverlayProps {
  step: TourStep;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

interface Rect { top: number; left: number; width: number; height: number; }

function getTargetRect(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function calcTooltipPosition(targetRect: Rect, placement: string) {
  const padding = 12;
  const tooltipWidth = 320;
  const tooltipHeight = 180; // approximate

  switch (placement) {
    case 'bottom':
      return { top: targetRect.top + targetRect.height + padding, left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2 };
    case 'top':
      return { top: targetRect.top - tooltipHeight - padding, left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2 };
    case 'right':
      return { top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2, left: targetRect.left + targetRect.width + padding };
    case 'left':
      return { top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2, left: targetRect.left - tooltipWidth - padding };
    default:
      return { top: targetRect.top + targetRect.height + padding, left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2 };
  }
}

export function TourOverlay({ step, currentStep, totalSteps, onNext, onPrev, onSkip }: TourOverlayProps) {
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateRect = () => {
      const rect = getTargetRect(step.target);
      if (rect) {
        setTargetRect(rect);
        // Scroll target into view if supported
        const el = document.querySelector(step.target);
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [step.target]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onNext, onPrev, onSkip]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!targetRect) return null;

  const cutoutPadding = 8;
  const cutout = {
    x: targetRect.left - cutoutPadding,
    y: targetRect.top - cutoutPadding,
    w: targetRect.width + cutoutPadding * 2,
    h: targetRect.height + cutoutPadding * 2,
    rx: 4,
  };

  const placement = step.placement || 'bottom';
  const tooltipPos = calcTooltipPosition(targetRect, placement);

  // Clamp tooltip to viewport
  const maxLeft = window.innerWidth - 340;
  tooltipPos.left = Math.max(12, Math.min(tooltipPos.left, maxLeft));
  tooltipPos.top = Math.max(12, tooltipPos.top);

  return (
    <div ref={overlayRef} className={styles.overlay}>
      <svg className={styles.mask} width="100%" height="100%">
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={cutout.x} y={cutout.y} width={cutout.w} height={cutout.h} rx={cutout.rx} fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#tour-mask)" />
      </svg>

      <div className={styles.tooltip} style={{ top: tooltipPos.top, left: tooltipPos.left }}>
        <div className={styles.tooltipHeader}>
          <span className={styles.stepCounter}>{currentStep + 1} of {totalSteps}</span>
          <button className={styles.skipButton} onClick={onSkip}>Skip tour</button>
        </div>
        <h3 className={styles.tooltipTitle}>{step.title}</h3>
        <p className={styles.tooltipContent}>{step.content}</p>
        {step.action && (
          <button className={styles.actionButton} onClick={step.action.onClick}>
            {step.action.label}
          </button>
        )}
        <div className={styles.tooltipFooter}>
          <div className={styles.dots}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <span key={i} className={`${styles.dot} ${i === currentStep ? styles.dotActive : ''}`} />
            ))}
          </div>
          <div className={styles.navButtons}>
            {currentStep > 0 && (
              <button className={styles.backButton} onClick={onPrev}>Back</button>
            )}
            <button className={styles.nextButton} onClick={onNext}>
              {currentStep === totalSteps - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
