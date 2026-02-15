import { useEffect, useContext } from 'react';
import { TourContext } from './TourProvider';

export interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  action?: { label: string; onClick: () => void };
}

export function useTour(tourId: string, steps: TourStep[]) {
  const ctx = useContext(TourContext);
  if (!ctx) return { startTour: () => {}, isActive: false };

  const { startTour, activeTourId, isCompleted, registerTour } = ctx;

  useEffect(() => {
    registerTour(tourId, steps);

    // Auto-start on first visit after a delay
    const timer = setTimeout(() => {
      if (!isCompleted(tourId)) {
        startTour(tourId);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [tourId]); // intentionally limited deps

  return {
    startTour: () => startTour(tourId),
    isActive: activeTourId === tourId,
  };
}
