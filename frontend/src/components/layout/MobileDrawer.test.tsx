import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MobileDrawer } from './MobileDrawer';

function renderMobileDrawer(props: Partial<React.ComponentProps<typeof MobileDrawer>> = {}) {
  const defaultProps = {
    isOpen: false,
    onClose: vi.fn(),
    children: <div data-testid="drawer-content">Drawer Content</div>,
  };

  return render(<MobileDrawer {...defaultProps} {...props} />);
}

describe('MobileDrawer', () => {
  beforeEach(() => {
    // Reset body overflow before each test
    document.body.style.overflow = '';
  });

  afterEach(() => {
    // Clean up body overflow after each test
    document.body.style.overflow = '';
  });

  it('renders children content', () => {
    renderMobileDrawer({ isOpen: true });

    expect(screen.getByTestId('drawer-content')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    renderMobileDrawer({ isOpen: true, title: 'Test Drawer' });

    expect(screen.getByRole('heading', { name: /test drawer/i })).toBeInTheDocument();
  });

  it('shows overlay when drawer is open', () => {
    renderMobileDrawer({ isOpen: true });

    expect(screen.getByTestId('drawer-overlay')).toBeInTheDocument();
  });

  it('calls onClose when overlay is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderMobileDrawer({ isOpen: true, onClose });

    await user.click(screen.getByTestId('drawer-overlay'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders close button by default', () => {
    renderMobileDrawer({ isOpen: true });

    expect(screen.getByRole('button', { name: /close drawer/i })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderMobileDrawer({ isOpen: true, onClose });

    await user.click(screen.getByRole('button', { name: /close drawer/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hides close button when showCloseButton is false', () => {
    renderMobileDrawer({ isOpen: true, showCloseButton: false });

    expect(screen.queryByRole('button', { name: /close drawer/i })).not.toBeInTheDocument();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();

    renderMobileDrawer({ isOpen: true, onClose });

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose on Escape when drawer is closed', () => {
    const onClose = vi.fn();

    renderMobileDrawer({ isOpen: false, onClose });

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('has dialog role with aria-modal', () => {
    renderMobileDrawer({ isOpen: true });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('has accessible label from title', () => {
    renderMobileDrawer({ isOpen: true, title: 'Navigation Menu' });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', 'Navigation Menu');
  });

  it('has default accessible label when no title', () => {
    renderMobileDrawer({ isOpen: true });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', 'Navigation drawer');
  });

  it('renders footer when provided', () => {
    renderMobileDrawer({
      isOpen: true,
      footer: <div data-testid="drawer-footer">Footer Content</div>,
    });

    expect(screen.getByTestId('drawer-footer')).toBeInTheDocument();
  });

  it('prevents body scroll when open', () => {
    const { rerender } = renderMobileDrawer({ isOpen: false });

    expect(document.body.style.overflow).not.toBe('hidden');

    rerender(
      <MobileDrawer isOpen={true} onClose={vi.fn()}>
        <div>Content</div>
      </MobileDrawer>
    );

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body scroll when closed', () => {
    const { rerender } = renderMobileDrawer({ isOpen: true });

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <MobileDrawer isOpen={false} onClose={vi.fn()}>
        <div>Content</div>
      </MobileDrawer>
    );

    expect(document.body.style.overflow).not.toBe('hidden');
  });

  describe('position variants', () => {
    it('renders with left position by default', () => {
      renderMobileDrawer({ isOpen: true });

      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('left');
    });

    it('renders with right position', () => {
      renderMobileDrawer({ isOpen: true, position: 'right' });

      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('right');
    });

    it('renders with bottom position', () => {
      renderMobileDrawer({ isOpen: true, position: 'bottom' });

      const dialog = screen.getByRole('dialog');
      expect(dialog.className).toContain('bottom');
    });
  });

  describe('touch interactions', () => {
    it('handles touch start event', () => {
      renderMobileDrawer({ isOpen: true });

      const dialog = screen.getByRole('dialog');

      fireEvent.touchStart(dialog, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      // Should not throw
      expect(dialog).toBeInTheDocument();
    });

    it('handles touch end event', () => {
      const onClose = vi.fn();
      renderMobileDrawer({ isOpen: true, onClose, position: 'left' });

      const dialog = screen.getByRole('dialog');

      // Simulate swipe left (should close left drawer)
      fireEvent.touchStart(dialog, {
        touches: [{ clientX: 200, clientY: 100 }],
      });

      fireEvent.touchEnd(dialog, {
        changedTouches: [{ clientX: 50, clientY: 100 }],
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes bottom drawer on swipe down', () => {
      const onClose = vi.fn();
      renderMobileDrawer({ isOpen: true, onClose, position: 'bottom' });

      const dialog = screen.getByRole('dialog');

      fireEvent.touchStart(dialog, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchEnd(dialog, {
        changedTouches: [{ clientX: 100, clientY: 200 }],
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes right drawer on swipe right', () => {
      const onClose = vi.fn();
      renderMobileDrawer({ isOpen: true, onClose, position: 'right' });

      const dialog = screen.getByRole('dialog');

      fireEvent.touchStart(dialog, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchEnd(dialog, {
        changedTouches: [{ clientX: 200, clientY: 100 }],
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close on small swipe', () => {
      const onClose = vi.fn();
      renderMobileDrawer({ isOpen: true, onClose, position: 'left' });

      const dialog = screen.getByRole('dialog');

      fireEvent.touchStart(dialog, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      // Small swipe (less than threshold)
      fireEvent.touchEnd(dialog, {
        changedTouches: [{ clientX: 80, clientY: 100 }],
      });

      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
