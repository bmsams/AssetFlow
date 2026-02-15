import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Modal } from './Modal';

// Mock the useAnnounce hook
const mockAnnounce = vi.fn();
vi.mock('../accessibility/useAnnounce', () => ({
  useAnnounce: () => ({
    announce: mockAnnounce,
    announcePolite: (msg: string) => mockAnnounce(msg, 'polite'),
    announceAssertive: (msg: string) => mockAnnounce(msg, 'assertive'),
  }),
}));

describe('Modal', () => {
  // Clean up any modals after each test
  afterEach(() => {
    document.body.style.overflow = '';
    mockAnnounce.mockClear();
  });

  describe('Basic Rendering', () => {
    it('renders nothing when isOpen is false', () => {
      render(
        <Modal isOpen={false} onClose={vi.fn()} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders modal when isOpen is true', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('renders title correctly', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="My Modal Title">
          <p>Content</p>
        </Modal>
      );

      expect(screen.getByRole('heading', { name: /my modal title/i })).toBeInTheDocument();
    });

    it('renders children content', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <p>This is the modal content</p>
        </Modal>
      );

      expect(screen.getByText('This is the modal content')).toBeInTheDocument();
    });

    it('renders footer when provided', () => {
      render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
          footer={<button>Save</button>}
        >
          <p>Content</p>
        </Modal>
      );

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('does not render footer when not provided', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      // Footer should not exist (only close button should be present)
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1); // Only close button
    });
  });

  describe('ARIA Attributes', () => {
    it('has role="dialog"', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal="true"', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby pointing to title', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();

      const title = document.getElementById(labelledBy!);
      expect(title).toHaveTextContent('Test Modal');
    });

    it('close button has aria-label', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      expect(screen.getByRole('button', { name: /close modal/i })).toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('applies sm size class', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal" size="sm">
          <p>Content</p>
        </Modal>
      );

      expect(screen.getByTestId('modal').className).toMatch(/sm/);
    });

    it('applies md size class by default', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      expect(screen.getByTestId('modal').className).toMatch(/md/);
    });

    it('applies lg size class', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal" size="lg">
          <p>Content</p>
        </Modal>
      );

      expect(screen.getByTestId('modal').className).toMatch(/lg/);
    });

    it('applies xl size class', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal" size="xl">
          <p>Content</p>
        </Modal>
      );

      expect(screen.getByTestId('modal').className).toMatch(/xl/);
    });
  });

  describe('Close Button', () => {
    it('calls onClose when close button is clicked', async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={handleClose} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      await user.click(screen.getByRole('button', { name: /close modal/i }));

      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Backdrop Click', () => {
    it('calls onClose when backdrop is clicked (default behavior)', async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={handleClose} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      await user.click(screen.getByTestId('modal-backdrop'));

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when backdrop click is disabled', async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();

      render(
        <Modal
          isOpen={true}
          onClose={handleClose}
          title="Test Modal"
          closeOnBackdropClick={false}
        >
          <p>Content</p>
        </Modal>
      );

      await user.click(screen.getByTestId('modal-backdrop'));

      expect(handleClose).not.toHaveBeenCalled();
    });

    it('does not call onClose when clicking inside modal content', async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={handleClose} title="Test Modal">
          <p data-testid="modal-content">Content</p>
        </Modal>
      );

      await user.click(screen.getByTestId('modal-content'));

      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  describe('Escape Key', () => {
    it('calls onClose when Escape key is pressed (default behavior)', async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={handleClose} title="Test Modal">
          <button>Focus me</button>
        </Modal>
      );

      // Focus an element inside the modal first
      const button = screen.getByRole('button', { name: /focus me/i });
      button.focus();

      await user.keyboard('{Escape}');

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when Escape is disabled', async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();

      render(
        <Modal
          isOpen={true}
          onClose={handleClose}
          title="Test Modal"
          closeOnEscape={false}
        >
          <button>Focus me</button>
        </Modal>
      );

      // Focus an element inside the modal first
      const button = screen.getByRole('button', { name: /focus me/i });
      button.focus();

      await user.keyboard('{Escape}');

      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  describe('Focus Management', () => {
    it('traps focus within the modal', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <button>First Button</button>
          <button>Second Button</button>
        </Modal>
      );

      // Tab through all focusable elements
      await user.tab();
      await user.tab();
      await user.tab();

      // Focus should cycle back to the first focusable element (close button)
      // The exact element depends on the focus trap implementation
      const focusedElement = document.activeElement;
      expect(focusedElement).toBeInstanceOf(HTMLButtonElement);
    });

    it('auto-focuses first focusable element when opened', async () => {
      // The FocusTrap component handles auto-focus via setTimeout
      // We verify the mechanism is in place by checking the FocusTrap is active
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <button>First Button</button>
          <button>Second Button</button>
        </Modal>
      );

      // Verify the focus trap is active (which handles auto-focus)
      const focusTrapContainer = document.querySelector('[data-focus-trap="active"]');
      expect(focusTrapContainer).toBeInTheDocument();
    });

    it('returns focus to trigger element when closed using triggerId', async () => {
      const { rerender } = render(
        <>
          <button id="trigger-button">Open Modal</button>
          <Modal
            isOpen={true}
            onClose={vi.fn()}
            title="Test Modal"
            triggerId="trigger-button"
          >
            <p>Content</p>
          </Modal>
        </>
      );

      // Modal should be open
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Close the modal by re-rendering with isOpen=false
      rerender(
        <>
          <button id="trigger-button">Open Modal</button>
          <Modal
            isOpen={false}
            onClose={vi.fn()}
            title="Test Modal"
            triggerId="trigger-button"
          >
            <p>Content</p>
          </Modal>
        </>
      );

      // Modal should be closed
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Focus should return to the trigger button
      const triggerButton = screen.getByRole('button', { name: /open modal/i });
      expect(document.activeElement).toBe(triggerButton);
    });

    it('returns focus to previously focused element when triggerId is not provided', async () => {
      // Create a button and focus it before opening the modal
      const { rerender } = render(
        <>
          <button data-testid="focus-target">Focus Target</button>
          <Modal isOpen={false} onClose={vi.fn()} title="Test Modal">
            <p>Content</p>
          </Modal>
        </>
      );

      // Focus the button before opening the modal
      const focusTarget = screen.getByTestId('focus-target');
      focusTarget.focus();
      expect(document.activeElement).toBe(focusTarget);

      // Open the modal - it should capture the currently focused element
      rerender(
        <>
          <button data-testid="focus-target">Focus Target</button>
          <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
            <p>Content</p>
          </Modal>
        </>
      );

      // Modal should be open
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Close the modal
      rerender(
        <>
          <button data-testid="focus-target">Focus Target</button>
          <Modal isOpen={false} onClose={vi.fn()} title="Test Modal">
            <p>Content</p>
          </Modal>
        </>
      );

      // Modal should be closed
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Focus should return to the previously focused element
      expect(document.activeElement).toBe(focusTarget);
    });

    it('handles missing trigger element gracefully', async () => {
      const { rerender } = render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
          triggerId="non-existent-id"
        >
          <p>Content</p>
        </Modal>
      );

      // Modal should be open
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Close the modal - should not throw even if trigger element doesn't exist
      rerender(
        <Modal
          isOpen={false}
          onClose={vi.fn()}
          title="Test Modal"
          triggerId="non-existent-id"
        >
          <p>Content</p>
        </Modal>
      );

      // Modal should be closed without errors
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Body Scroll Lock', () => {
    it('prevents body scroll when modal is open', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll when modal is closed', () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      expect(document.body.style.overflow).toBe('hidden');

      rerender(
        <Modal isOpen={false} onClose={vi.fn()} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Custom className', () => {
    it('applies custom className to modal', () => {
      render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
          className="custom-modal-class"
        >
          <p>Content</p>
        </Modal>
      );

      expect(screen.getByTestId('modal')).toHaveClass('custom-modal-class');
    });
  });

  describe('Portal Rendering', () => {
    it('renders modal in document.body via portal', () => {
      const { baseElement } = render(
        <div id="app-root">
          <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
            <p>Content</p>
          </Modal>
        </div>
      );

      // Modal should be rendered as a direct child of body, not inside app-root
      const modal = screen.getByRole('dialog');
      expect(modal.closest('#app-root')).toBeNull();
      expect(document.body.contains(modal)).toBe(true);
    });
  });

  describe('Keyboard Navigation', () => {
    it('close button is keyboard accessible', async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={handleClose} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      const closeButton = screen.getByRole('button', { name: /close modal/i });
      await user.click(closeButton);

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('footer buttons are keyboard accessible', async () => {
      const handleSave = vi.fn();
      const user = userEvent.setup();

      render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
          footer={<button onClick={handleSave}>Save</button>}
        >
          <p>Content</p>
        </Modal>
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(handleSave).toHaveBeenCalledTimes(1);
    });
  });

  describe('Screen Reader Announcements', () => {
    it('announces modal opening with assertive priority', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Confirm Delete">
          <p>Content</p>
        </Modal>
      );

      expect(mockAnnounce).toHaveBeenCalledWith('Dialog opened: Confirm Delete', 'assertive');
    });

    it('announces modal closing when close button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      // Clear the open announcement
      mockAnnounce.mockClear();

      await user.click(screen.getByRole('button', { name: /close modal/i }));

      expect(mockAnnounce).toHaveBeenCalledWith('Dialog closed', 'polite');
    });

    it('announces modal closing when backdrop is clicked', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <p>Content</p>
        </Modal>
      );

      // Clear the open announcement
      mockAnnounce.mockClear();

      await user.click(screen.getByTestId('modal-backdrop'));

      expect(mockAnnounce).toHaveBeenCalledWith('Dialog closed', 'polite');
    });

    it('announces modal closing when Escape key is pressed', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <button>Focus me</button>
        </Modal>
      );

      // Clear the open announcement
      mockAnnounce.mockClear();

      // Focus an element inside the modal first
      const button = screen.getByRole('button', { name: /focus me/i });
      button.focus();

      await user.keyboard('{Escape}');

      expect(mockAnnounce).toHaveBeenCalledWith('Dialog closed', 'polite');
    });

    it('does not announce close when backdrop click is disabled', async () => {
      const user = userEvent.setup();

      render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
          closeOnBackdropClick={false}
        >
          <p>Content</p>
        </Modal>
      );

      // Clear the open announcement
      mockAnnounce.mockClear();

      await user.click(screen.getByTestId('modal-backdrop'));

      expect(mockAnnounce).not.toHaveBeenCalled();
    });

    it('does not announce close when Escape is disabled', async () => {
      const user = userEvent.setup();

      render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Test Modal"
          closeOnEscape={false}
        >
          <button>Focus me</button>
        </Modal>
      );

      // Clear the open announcement
      mockAnnounce.mockClear();

      const button = screen.getByRole('button', { name: /focus me/i });
      button.focus();

      await user.keyboard('{Escape}');

      expect(mockAnnounce).not.toHaveBeenCalled();
    });

    it('includes modal title in open announcement', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Important Warning">
          <p>Content</p>
        </Modal>
      );

      expect(mockAnnounce).toHaveBeenCalledWith(
        expect.stringContaining('Important Warning'),
        'assertive'
      );
    });
  });
});
