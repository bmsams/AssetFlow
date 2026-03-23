import { useState, useEffect, type ReactNode } from 'react';

export type Politeness = 'polite' | 'assertive' | 'off';

export interface LiveRegionProps {
  /** Content to announce to screen readers */
  children?: ReactNode;
  /** Politeness level for announcements */
  politeness?: Politeness;
  /** Whether the region is atomic (announce entire region on change) */
  atomic?: boolean;
  /** What types of changes should be announced */
  relevant?: 'additions' | 'removals' | 'text' | 'all';
  /** Additional CSS class */
  className?: string;
  /** Role for the live region */
  role?: 'status' | 'alert' | 'log' | 'marquee' | 'timer';
}

/**
 * LiveRegion component for screen reader announcements
 * Announces dynamic content changes to assistive technologies
 * Implements WCAG 2.1 AA requirement for screen reader accessibility
 * 
 * @example
 * ```tsx
 * <LiveRegion politeness="polite">
 *   {statusMessage}
 * </LiveRegion>
 * ```
 */
export function LiveRegion({
  children,
  politeness = 'polite',
  atomic = true,
  relevant = 'additions',
  className = '',
  role,
}: LiveRegionProps) {
  // Visually hidden styles
  const hiddenStyles: React.CSSProperties = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  };

  return (
    <div
      aria-live={politeness}
      aria-atomic={atomic}
      aria-relevant={relevant}
      role={role}
      style={hiddenStyles}
      className={className}
    >
      {children}
    </div>
  );
}

/**
 * Props for the Announcer component
 */
export interface AnnouncerProps {
  /** ID for the announcer (useful for multiple announcers) */
  id?: string;
}

/**
 * Global announcer component that can be used with useAnnounce hook
 * Place this component once at the root of your app
 * 
 * @example
 * ```tsx
 * // In App.tsx
 * <Announcer />
 * 
 * // In any component
 * const { announce } = useAnnounce();
 * announce('Item saved successfully');
 * ```
 */
export function Announcer({ id = 'global-announcer' }: AnnouncerProps) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  // Listen for custom announce events
  useEffect(() => {
    const handleAnnounce = (event: CustomEvent<{ message: string; politeness: Politeness }>) => {
      const { message, politeness } = event.detail;
      
      if (politeness === 'assertive') {
        setAssertiveMessage(message);
        // Clear after announcement
        setTimeout(() => setAssertiveMessage(''), 1000);
      } else {
        setPoliteMessage(message);
        // Clear after announcement
        setTimeout(() => setPoliteMessage(''), 1000);
      }
    };

    window.addEventListener('announce' as keyof WindowEventMap, handleAnnounce as EventListener);
    
    return () => {
      window.removeEventListener('announce' as keyof WindowEventMap, handleAnnounce as EventListener);
    };
  }, []);

  return (
    <>
      <LiveRegion politeness="polite" role="status" aria-label="Notifications" className={`${id}-polite`}>
        {politeMessage}
      </LiveRegion>
      {assertiveMessage && (
        <LiveRegion politeness="assertive" role="alert" aria-label="Alerts" className={`${id}-assertive`}>
          {assertiveMessage}
        </LiveRegion>
      )}
    </>
  );
}
