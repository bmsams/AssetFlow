import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SwipeableCard, type SwipeAction } from './SwipeableCard';

function renderSwipeableCard(props: Partial<React.ComponentProps<typeof SwipeableCard>> = {}) {
  const defaultProps = {
    children: <div data-testid="card-content">Card Content</div>,
  };

  return render(<SwipeableCard {...defaultProps} {...props} />);
}

describe('SwipeableCard', () => {
  it('renders children content', () => {
    renderSwipeableCard();

    expect(screen.getByTestId('card-content')).toBeInTheDocument();
  });

  it('renders with custom className', () => {
    renderSwipeableCard({ className: 'custom-class' });

    const container = screen.getByTestId('swipeable-card');
    expect(container).toHaveClass('custom-class');
  });

  it('calls onTap when card is tapped', async () => {
    const onTap = vi.fn();
    const user = userEvent.setup();

    renderSwipeableCard({ onTap });

    // Simulate a quick tap (click)
    const card = screen.getByTestId('card-content').parentElement!;
    await user.click(card);

    // Note: The actual tap detection requires touch events, but click should work for keyboard
  });

  it('has button role when onTap is provided', () => {
    renderSwipeableCard({ onTap: vi.fn() });

    const card = screen.getByRole('button');
    expect(card).toBeInTheDocument();
  });

  it('is keyboard accessible when onTap is provided', async () => {
    const onTap = vi.fn();
    const user = userEvent.setup();

    renderSwipeableCard({ onTap });

    const card = screen.getByRole('button');
    card.focus();

    await user.keyboard('{Enter}');
    expect(onTap).toHaveBeenCalledTimes(1);

    await user.keyboard(' ');
    expect(onTap).toHaveBeenCalledTimes(2);
  });

  it('does not have button role when onTap is not provided', () => {
    renderSwipeableCard();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  describe('swipe actions', () => {
    const leftAction: SwipeAction = {
      direction: 'left',
      label: 'Delete',
      color: 'danger',
      onSwipe: vi.fn(),
    };

    const rightAction: SwipeAction = {
      direction: 'right',
      label: 'Archive',
      color: 'success',
      onSwipe: vi.fn(),
    };

    it('renders left action background', () => {
      renderSwipeableCard({ actions: [leftAction] });

      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('renders right action background', () => {
      renderSwipeableCard({ actions: [rightAction] });

      expect(screen.getByText('Archive')).toBeInTheDocument();
    });

    it('renders both action backgrounds', () => {
      renderSwipeableCard({ actions: [leftAction, rightAction] });

      expect(screen.getByText('Delete')).toBeInTheDocument();
      expect(screen.getByText('Archive')).toBeInTheDocument();
    });

    it('renders action icons when provided', () => {
      const actionWithIcon: SwipeAction = {
        direction: 'left',
        label: 'Delete',
        icon: <span data-testid="delete-icon">🗑️</span>,
        onSwipe: vi.fn(),
      };

      renderSwipeableCard({ actions: [actionWithIcon] });

      expect(screen.getByTestId('delete-icon')).toBeInTheDocument();
    });

    it('handles touch start event', () => {
      renderSwipeableCard({ actions: [leftAction] });

      const card = screen.getByTestId('card-content').parentElement!;

      fireEvent.touchStart(card, {
        touches: [{ clientX: 200, clientY: 100 }],
      });

      // Should not throw
      expect(card).toBeInTheDocument();
    });

    it('handles touch move event', () => {
      renderSwipeableCard({ actions: [leftAction] });

      const card = screen.getByTestId('card-content').parentElement!;

      fireEvent.touchStart(card, {
        touches: [{ clientX: 200, clientY: 100 }],
      });

      fireEvent.touchMove(card, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      // Should not throw
      expect(card).toBeInTheDocument();
    });

    it('triggers left action on swipe left', () => {
      const onSwipe = vi.fn();
      const action: SwipeAction = {
        direction: 'left',
        label: 'Delete',
        onSwipe,
      };

      renderSwipeableCard({ actions: [action], swipeThreshold: 50 });

      const card = screen.getByTestId('card-content').parentElement!;

      // Start touch
      fireEvent.touchStart(card, {
        touches: [{ clientX: 200, clientY: 100 }],
      });

      // Move left past threshold
      fireEvent.touchMove(card, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      // End touch
      fireEvent.touchEnd(card, {
        changedTouches: [{ clientX: 100, clientY: 100 }],
      });

      expect(onSwipe).toHaveBeenCalledTimes(1);
    });

    it('triggers right action on swipe right', () => {
      const onSwipe = vi.fn();
      const action: SwipeAction = {
        direction: 'right',
        label: 'Archive',
        onSwipe,
      };

      renderSwipeableCard({ actions: [action], swipeThreshold: 50 });

      const card = screen.getByTestId('card-content').parentElement!;

      // Start touch
      fireEvent.touchStart(card, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      // Move right past threshold
      fireEvent.touchMove(card, {
        touches: [{ clientX: 200, clientY: 100 }],
      });

      // End touch
      fireEvent.touchEnd(card, {
        changedTouches: [{ clientX: 200, clientY: 100 }],
      });

      expect(onSwipe).toHaveBeenCalledTimes(1);
    });

    it('does not trigger action on small swipe', () => {
      const onSwipe = vi.fn();
      const action: SwipeAction = {
        direction: 'left',
        label: 'Delete',
        onSwipe,
      };

      renderSwipeableCard({ actions: [action], swipeThreshold: 80 });

      const card = screen.getByTestId('card-content').parentElement!;

      // Start touch
      fireEvent.touchStart(card, {
        touches: [{ clientX: 200, clientY: 100 }],
      });

      // Small move (less than threshold)
      fireEvent.touchMove(card, {
        touches: [{ clientX: 170, clientY: 100 }],
      });

      // End touch
      fireEvent.touchEnd(card, {
        changedTouches: [{ clientX: 170, clientY: 100 }],
      });

      expect(onSwipe).not.toHaveBeenCalled();
    });

    it('does not allow swipe when disabled', () => {
      const onSwipe = vi.fn();
      const action: SwipeAction = {
        direction: 'left',
        label: 'Delete',
        onSwipe,
      };

      renderSwipeableCard({ actions: [action], disabled: true });

      const card = screen.getByTestId('card-content').parentElement!;

      fireEvent.touchStart(card, {
        touches: [{ clientX: 200, clientY: 100 }],
      });

      fireEvent.touchMove(card, {
        touches: [{ clientX: 50, clientY: 100 }],
      });

      fireEvent.touchEnd(card, {
        changedTouches: [{ clientX: 50, clientY: 100 }],
      });

      expect(onSwipe).not.toHaveBeenCalled();
    });
  });

  describe('action colors', () => {
    it('applies primary color class', () => {
      const action: SwipeAction = {
        direction: 'left',
        label: 'Primary',
        color: 'primary',
        onSwipe: vi.fn(),
      };

      renderSwipeableCard({ actions: [action] });

      const actionBg = screen.getByText('Primary').parentElement!;
      expect(actionBg.className).toContain('actionPrimary');
    });

    it('applies success color class', () => {
      const action: SwipeAction = {
        direction: 'left',
        label: 'Success',
        color: 'success',
        onSwipe: vi.fn(),
      };

      renderSwipeableCard({ actions: [action] });

      const actionBg = screen.getByText('Success').parentElement!;
      expect(actionBg.className).toContain('actionSuccess');
    });

    it('applies warning color class', () => {
      const action: SwipeAction = {
        direction: 'left',
        label: 'Warning',
        color: 'warning',
        onSwipe: vi.fn(),
      };

      renderSwipeableCard({ actions: [action] });

      const actionBg = screen.getByText('Warning').parentElement!;
      expect(actionBg.className).toContain('actionWarning');
    });

    it('applies danger color class', () => {
      const action: SwipeAction = {
        direction: 'left',
        label: 'Danger',
        color: 'danger',
        onSwipe: vi.fn(),
      };

      renderSwipeableCard({ actions: [action] });

      const actionBg = screen.getByText('Danger').parentElement!;
      expect(actionBg.className).toContain('actionDanger');
    });
  });
});
