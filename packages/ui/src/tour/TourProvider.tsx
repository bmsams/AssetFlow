import { createContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { TourOverlay } from './TourOverlay';
import type { TourStep } from './useTour';

const STORAGE_KEY = 'ams_tours_completed';

export interface TourContextValue {
  activeTourId: string | null;
  currentStep: number;
  totalSteps: number;
  currentStepData: TourStep | null;
  startTour: (tourId: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  isCompleted: (tourId: string) => boolean;
  registerTour: (tourId: string, steps: TourStep[]) => void;
}

export const TourContext = createContext<TourContextValue | null>(null);

function getCompleted(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch { return new Set(); }
}

function saveCompleted(completed: Set<string>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed])); } catch {}
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState<Set<string>>(getCompleted);
  const toursRef = useRef<Map<string, TourStep[]>>(new Map());

  const registerTour = useCallback((tourId: string, steps: TourStep[]) => {
    toursRef.current.set(tourId, steps);
  }, []);

  const currentSteps = activeTourId ? toursRef.current.get(activeTourId) || [] : [];
  const currentStepData = currentSteps[currentStep] || null;
  const totalSteps = currentSteps.length;

  const startTour = useCallback((tourId: string) => {
    const steps = toursRef.current.get(tourId);
    if (!steps?.length) return;
    setActiveTourId(tourId);
    setCurrentStep(0);
  }, []);

  const completeTour = useCallback(() => {
    if (activeTourId) {
      const newCompleted = new Set(completed);
      newCompleted.add(activeTourId);
      setCompleted(newCompleted);
      saveCompleted(newCompleted);
    }
    setActiveTourId(null);
    setCurrentStep(0);
  }, [activeTourId, completed]);

  const nextStep = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      let next = currentStep + 1;
      // Skip steps whose targets don't exist
      while (next < totalSteps) {
        const step = currentSteps[next];
        if (document.querySelector(step.target)) break;
        next++;
      }
      if (next >= totalSteps) {
        completeTour();
      } else {
        setCurrentStep(next);
      }
    } else {
      completeTour();
    }
  }, [currentStep, totalSteps, currentSteps, completeTour]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  }, [currentStep]);

  const skipTour = useCallback(() => { completeTour(); }, [completeTour]);

  const isCompleted = useCallback((tourId: string) => completed.has(tourId), [completed]);

  return (
    <TourContext.Provider value={{
      activeTourId, currentStep, totalSteps, currentStepData,
      startTour, nextStep, prevStep, skipTour, isCompleted, registerTour,
    }}>
      {children}
      {activeTourId && currentStepData && (
        <TourOverlay
          step={currentStepData}
          currentStep={currentStep}
          totalSteps={totalSteps}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={skipTour}
        />
      )}
    </TourContext.Provider>
  );
}
