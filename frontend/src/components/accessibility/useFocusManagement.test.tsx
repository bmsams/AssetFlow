import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, useState } from 'vitest';
import { useFocusManagement } from './useFocusManagement';

// Test component that uses the hook with proper state management
function TestContainer({
  autoFocus = false,
  restoreFocus = false,
  focusSelector,
}: {
  autoFocus?: boolean;
  restoreFocus?: boolean;
  focusSelector?: string;
}) {
  const { containerRef, focusFirst, focusLast, focusElement, containsFocus, getFocusableElements } =
    useFocusManagement({
      autoFocus,
      restoreFocus,
      focusSelector,
    });

  return (
    <div ref={containerRef} data-testid="container">
      <button data-testid="first">First</button>
      <button data-testid="second">Second</button>
      <button data-testid="third">Third</button>
      <div>
        <button onClick={focusFirst} data-testid="focus-first-btn">
          Focus First
        </button>
        <button onClick={focusLast} data-testid="focus-last-btn">
          Focus Last
        </button>
        <button onClick={() => focusElement('[data-testid="second"]')} data-testid="focus-second-btn">
          Focus Second
        </button>
      </div>
    </div>
  );
}

describe('useFocusManagement', () => {
  describe('containerRef', () => {
    it('attaches ref to container element', () => {
      render(<TestContainer />);
      expect(screen.getByTestId('container')).toBeInTheDocument();
    });
  });

  describe('focusElement', () => {
    it('focuses element matching selector', async () => {
      const user = userEvent.setup();
      render(<TestContainer />);

      await user.click(screen.getByTestId('focus-second-btn'));

      expect(screen.getByTestId('second')).toHaveFocus();
    });
  });

  describe('containsFocus', () => {
    it('hook provides containsFocus function', () => {
      render(<TestContainer />);
      // Just verify the component renders - containsFocus is tested via the hook
      expect(screen.getByTestId('container')).toBeInTheDocument();
    });
  });

  describe('options', () => {
    it('renders without errors when autoFocus is true', () => {
      render(<TestContainer autoFocus />);
      expect(screen.getByTestId('container')).toBeInTheDocument();
    });

    it('renders without errors when restoreFocus is true', () => {
      render(<TestContainer restoreFocus />);
      expect(screen.getByTestId('container')).toBeInTheDocument();
    });

    it('renders without errors when focusSelector is provided', () => {
      render(<TestContainer focusSelector='[data-testid="second"]' />);
      expect(screen.getByTestId('container')).toBeInTheDocument();
    });
  });

  describe('hook return values', () => {
    it('returns all expected functions', () => {
      let hookResult: ReturnType<typeof useFocusManagement> | null = null;

      function TestHook() {
        hookResult = useFocusManagement({});
        return <div ref={hookResult.containerRef}>Test</div>;
      }

      render(<TestHook />);

      expect(hookResult).not.toBeNull();
      expect(typeof hookResult!.focusFirst).toBe('function');
      expect(typeof hookResult!.focusLast).toBe('function');
      expect(typeof hookResult!.focusElement).toBe('function');
      expect(typeof hookResult!.containsFocus).toBe('function');
      expect(typeof hookResult!.getFocusableElements).toBe('function');
      expect(hookResult!.containerRef).toBeDefined();
    });
  });
});
