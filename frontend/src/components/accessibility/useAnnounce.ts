import { useCallback } from 'react';
import type { Politeness } from './LiveRegion';

export interface UseAnnounceReturn {
  /** Announce a message to screen readers */
  announce: (message: string, politeness?: Politeness) => void;
  /** Announce a polite message (non-interrupting) */
  announcePolite: (message: string) => void;
  /** Announce an assertive message (interrupting) */
  announceAssertive: (message: string) => void;
}

/**
 * Hook for announcing messages to screen readers
 * Works with the Announcer component placed at the app root
 * Implements WCAG 2.1 AA requirement for screen reader accessibility
 * 
 * @example
 * ```tsx
 * function SaveButton() {
 *   const { announce } = useAnnounce();
 * 
 *   const handleSave = async () => {
 *     await saveData();
 *     announce('Changes saved successfully');
 *   };
 * 
 *   return <button onClick={handleSave}>Save</button>;
 * }
 * ```
 */
export function useAnnounce(): UseAnnounceReturn {
  const announce = useCallback((message: string, politeness: Politeness = 'polite') => {
    // Dispatch custom event that Announcer component listens for
    const event = new CustomEvent('announce', {
      detail: { message, politeness },
    });
    window.dispatchEvent(event);
  }, []);

  const announcePolite = useCallback(
    (message: string) => {
      announce(message, 'polite');
    },
    [announce]
  );

  const announceAssertive = useCallback(
    (message: string) => {
      announce(message, 'assertive');
    },
    [announce]
  );

  return {
    announce,
    announcePolite,
    announceAssertive,
  };
}
