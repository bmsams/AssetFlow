import {
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { FocusTrap } from '../accessibility/FocusTrap';
import { useAnnounce } from '../accessibility/useAnnounce';
import { Button } from './Button';
import styles from './Modal.module.css';

/**
 * Size variants for the Modal component.
 * Controls the maximum width of the modal dialog.
 *
 * @type ModalSize
 * @see {@link ModalProps} - Used in the size prop
 *
 * - `'sm'` - Small modal (400px) - Confirmations, simple forms
 * - `'md'` - Medium modal (500px) - Standard dialogs (default)
 * - `'lg'` - Large modal (600px) - Complex forms, detailed content
 * - `'xl'` - Extra large modal (800px) - Data tables, multi-step wizards
 */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Props for the Modal component.
 *
 * @interface ModalProps
 * @see {@link Modal} - The component that uses these props
 * @see {@link ModalSize} - Available size variants
 *
 * @example
 * ```typescript
 * const modalProps: ModalProps = {
 *   isOpen: true,
 *   onClose: () => setIsOpen(false),
 *   title: 'Confirm Delete',
 *   size: 'sm',
 *   children: <p>Are you sure you want to delete this item?</p>,
 *   footer: (
 *     <>
 *       <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
 *       <Button variant="danger" onClick={handleDelete}>Delete</Button>
 *     </>
 *   )
 * };
 * ```
 */
export interface ModalProps {
  /**
   * Controls whether the modal is visible.
   * When true, the modal is rendered and displayed.
   * When false, the modal is not rendered (returns null).
   */
  isOpen: boolean;

  /**
   * Callback function invoked when the modal should close.
   * Called when:
   * - User clicks the close button (X)
   * - User clicks the backdrop (if closeOnBackdropClick is true)
   * - User presses Escape key (if closeOnEscape is true)
   */
  onClose: () => void;

  /**
   * Title text displayed in the modal header.
   * Used for the modal's accessible label (aria-labelledby).
   */
  title: string;

  /**
   * Content to render in the modal body.
   * Can be any valid React content (text, forms, components, etc.).
   */
  children: ReactNode;

  /**
   * Content to render in the modal footer.
   * Typically contains action buttons (Cancel, Confirm, etc.).
   * @default undefined
   */
  footer?: ReactNode;

  /**
   * Size variant controlling the modal's maximum width.
   * @default 'md'
   * @see {@link ModalSize}
   */
  size?: ModalSize;

  /**
   * Whether clicking the backdrop (overlay) closes the modal.
   * Set to false for modals requiring explicit user action.
   * @default true
   */
  closeOnBackdropClick?: boolean;

  /**
   * Whether pressing the Escape key closes the modal.
   * Set to false for critical modals requiring explicit action.
   * @default true
   */
  closeOnEscape?: boolean;

  /**
   * ID of the element that triggered the modal opening.
   * Used to return focus when the modal closes.
   * If not provided, focus returns to the previously focused element.
   * @default undefined
   */
  triggerId?: string;

  /**
   * Additional CSS class name(s) to apply to the modal container.
   * @default ''
   */
  className?: string;
}

/**
 * Modal displays content in a centered overlay dialog with focus management.
 *
 * This component implements **Requirement 5: Reusable Modal Component** from the
 * frontend UI improvements specification. It provides consistent behavior and
 * styling for confirmation dialogs, forms, and focused interactions.
 *
 * ## Features
 * - **Centered overlay** - Modal appears centered with semi-transparent backdrop
 * - **Focus trapping** - Tab navigation is contained within the modal
 * - **Keyboard support** - Escape key closes the modal (configurable)
 * - **Focus management** - Returns focus to trigger element on close
 * - **Screen reader support** - Announces modal opening/closing
 * - **Configurable size** - Four size variants for different content needs
 * - **Portal rendering** - Renders at document body level to avoid z-index issues
 *
 * ## Accessibility (WCAG 2.1 AA)
 * - Uses `role="dialog"` and `aria-modal="true"`
 * - Title linked via `aria-labelledby`
 * - Focus trapped within modal while open
 * - Focus returns to trigger element on close
 * - Screen reader announcements for open/close
 * - Body scroll prevented while modal is open
 *
 * ## Keyboard Navigation
 * - **Tab** - Cycles through focusable elements within modal
 * - **Shift+Tab** - Reverse cycle through focusable elements
 * - **Escape** - Closes modal (when closeOnEscape is true)
 * - **Enter/Space** - Activates focused buttons
 *
 * @param props - Component props
 * @param props.isOpen - Whether the modal is visible (required)
 * @param props.onClose - Close callback function (required)
 * @param props.title - Modal title text (required)
 * @param props.children - Modal body content (required)
 * @param props.footer - Footer content (typically buttons)
 * @param props.size - Size variant ('sm' | 'md' | 'lg' | 'xl')
 * @param props.closeOnBackdropClick - Allow backdrop click to close
 * @param props.closeOnEscape - Allow Escape key to close
 * @param props.triggerId - ID of trigger element for focus return
 * @param props.className - Additional CSS classes
 *
 * @returns JSX element containing the modal, or null if not open
 *
 * @see {@link FocusTrap} - Used internally for focus management
 * @see {@link useAnnounce} - Used for screen reader announcements
 * @see {@link Button} - Commonly used in modal footer
 *
 * @example
 * Basic confirmation modal:
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <Modal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Confirm Action"
 *   footer={
 *     <>
 *       <Button variant="secondary" onClick={() => setIsOpen(false)}>
 *         Cancel
 *       </Button>
 *       <Button onClick={handleConfirm}>Confirm</Button>
 *     </>
 *   }
 * >
 *   <p>Are you sure you want to proceed with this action?</p>
 * </Modal>
 * ```
 *
 * @example
 * Form modal with custom size:
 * ```tsx
 * <Modal
 *   isOpen={isFormOpen}
 *   onClose={handleClose}
 *   title="Edit Asset"
 *   size="lg"
 *   closeOnBackdropClick={false}
 *   footer={
 *     <>
 *       <Button variant="secondary" onClick={handleClose}>Cancel</Button>
 *       <Button onClick={handleSave} disabled={!isValid}>Save</Button>
 *     </>
 *   }
 * >
 *   <AssetForm asset={selectedAsset} onChange={setFormData} />
 * </Modal>
 * ```
 *
 * @example
 * Delete confirmation with trigger ID:
 * ```tsx
 * <Button
 *   id="delete-btn"
 *   onClick={() => setShowDeleteModal(true)}
 * >
 *   Delete
 * </Button>
 *
 * <Modal
 *   isOpen={showDeleteModal}
 *   onClose={() => setShowDeleteModal(false)}
 *   title="Delete Item"
 *   size="sm"
 *   triggerId="delete-btn"
 *   footer={
 *     <>
 *       <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
 *         Cancel
 *       </Button>
 *       <Button variant="danger" onClick={handleDelete}>
 *         Delete
 *       </Button>
 *     </>
 *   }
 * >
 *   <p>This action cannot be undone.</p>
 * </Modal>
 * ```
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  triggerId,
  className = '',
}: ModalProps): JSX.Element | null {
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const titleId = `modal-title-${title.replace(/\s+/g, '-').toLowerCase()}`;
  const { announce } = useAnnounce();

  // Store the triggering element when modal opens
  useEffect(() => {
    if (isOpen) {
      // Try to find the trigger element by ID, or use the currently focused element
      if (triggerId) {
        triggerElementRef.current = document.getElementById(triggerId);
      } else {
        triggerElementRef.current = document.activeElement as HTMLElement;
      }

      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';

      // Announce modal opening to screen readers (assertive for important state change)
      announce(`Dialog opened: ${title}`, 'assertive');
    }

    return () => {
      // Restore body scroll when modal closes
      document.body.style.overflow = '';
    };
  }, [isOpen, triggerId, title, announce]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Only close if clicking directly on the backdrop, not the modal content
      if (closeOnBackdropClick && event.target === event.currentTarget) {
        announce('Dialog closed', 'polite');
        onClose();
      }
    },
    [closeOnBackdropClick, onClose, announce]
  );

  // Handle escape key (delegated to FocusTrap)
  const handleEscape = useCallback(() => {
    if (closeOnEscape) {
      announce('Dialog closed', 'polite');
      onClose();
    }
  }, [closeOnEscape, onClose, announce]);

  // Handle close button click
  const handleCloseButtonClick = useCallback(() => {
    announce('Dialog closed', 'polite');
    onClose();
  }, [onClose, announce]);

  // Handle focus return when modal closes
  useEffect(() => {
    if (!isOpen && triggerElementRef.current) {
      // Return focus to the triggering element
      triggerElementRef.current.focus();
    }
  }, [isOpen]);

  // Don't render anything if modal is not open
  if (!isOpen) {
    return null;
  }

  const sizeClass = styles[size] || styles.md;
  const modalClasses = [styles.modal, sizeClass, className].filter(Boolean).join(' ');

  const modalContent = (
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      data-testid="modal-backdrop"
    >
      <FocusTrap
        isActive={isOpen}
        onEscape={handleEscape}
        autoFocus
        restoreFocus={false} // We handle focus return manually
      >
        <div
          ref={modalRef}
          className={modalClasses}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          data-testid="modal"
        >
          <div className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCloseButtonClick}
              aria-label="Close modal"
              className={styles.closeButton}
            >
              <CloseIcon />
            </Button>
          </div>

          <div className={styles.content}>{children}</div>

          {footer && <div className={styles.footer}>{footer}</div>}
        </div>
      </FocusTrap>
    </div>
  );

  // Render modal in a portal to ensure it's at the top of the DOM
  return createPortal(modalContent, document.body);
}

/**
 * Close icon SVG component for the modal close button.
 *
 * Renders an X icon used in the modal header close button.
 * Hidden from screen readers as the button has an aria-label.
 *
 * @returns SVG element representing a close/X icon
 * @internal
 */
function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M15 5L5 15M5 5L15 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
