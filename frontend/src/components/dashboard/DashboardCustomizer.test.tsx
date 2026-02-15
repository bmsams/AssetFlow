/**
 * Tests for DashboardCustomizer component
 * Validates Requirement 12.7: Dashboard widgets shall be configurable per user
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardCustomizer } from './DashboardCustomizer';
import type { WidgetConfig } from '../../types/widget';

describe('DashboardCustomizer', () => {
  const mockOnToggleEdit = vi.fn();
  const mockOnSave = vi.fn();
  const mockOnReset = vi.fn();
  const mockOnAddWidget = vi.fn();

  const defaultProps = {
    isEditing: false,
    onToggleEdit: mockOnToggleEdit,
    hasChanges: false,
    onSave: mockOnSave,
    onReset: mockOnReset,
    onAddWidget: mockOnAddWidget,
    existingWidgetIds: ['widget-1', 'widget-2'],
  };

  beforeEach(() => {
    mockOnToggleEdit.mockClear();
    mockOnSave.mockClear();
    mockOnReset.mockClear();
    mockOnAddWidget.mockClear();
  });

  describe('Basic Rendering', () => {
    it('renders the customizer toolbar', () => {
      render(<DashboardCustomizer {...defaultProps} />);

      expect(screen.getByRole('toolbar', { name: /dashboard customization/i })).toBeInTheDocument();
    });

    it('shows customize button when not editing', () => {
      render(<DashboardCustomizer {...defaultProps} />);

      expect(screen.getByRole('button', { name: /customize/i })).toBeInTheDocument();
    });

    it('shows done editing button when editing', () => {
      render(<DashboardCustomizer {...defaultProps} isEditing />);

      expect(screen.getByRole('button', { name: /exit edit mode/i })).toBeInTheDocument();
    });
  });

  describe('Edit Mode Toggle', () => {
    it('calls onToggleEdit when customize button is clicked', () => {
      render(<DashboardCustomizer {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /customize/i }));

      expect(mockOnToggleEdit).toHaveBeenCalledTimes(1);
    });

    it('calls onToggleEdit when done editing button is clicked', () => {
      render(<DashboardCustomizer {...defaultProps} isEditing />);

      fireEvent.click(screen.getByRole('button', { name: /exit edit mode/i }));

      expect(mockOnToggleEdit).toHaveBeenCalledTimes(1);
    });

    it('indicates active state when editing', () => {
      render(<DashboardCustomizer {...defaultProps} isEditing />);

      const editButton = screen.getByRole('button', { name: /exit edit mode/i });
      expect(editButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Edit Mode Actions', () => {
    it('shows add widget button in edit mode', () => {
      render(<DashboardCustomizer {...defaultProps} isEditing />);

      expect(screen.getByRole('button', { name: /add widget/i })).toBeInTheDocument();
    });

    it('shows reset button in edit mode', () => {
      render(<DashboardCustomizer {...defaultProps} isEditing />);

      expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
    });

    it('shows save button in edit mode', () => {
      render(<DashboardCustomizer {...defaultProps} isEditing />);

      expect(screen.getByText(/saved/i)).toBeInTheDocument();
    });

    it('hides edit actions when not in edit mode', () => {
      render(<DashboardCustomizer {...defaultProps} />);

      expect(screen.queryByRole('button', { name: /add widget/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reset/i })).not.toBeInTheDocument();
    });
  });

  describe('Add Widget', () => {
    it('opens widget picker when add widget button is clicked', () => {
      render(<DashboardCustomizer {...defaultProps} isEditing />);

      fireEvent.click(screen.getByRole('button', { name: /add widget/i }));

      expect(screen.getByRole('dialog', { name: /add widget/i })).toBeInTheDocument();
    });

    it('calls onAddWidget when widget is selected from picker', () => {
      render(<DashboardCustomizer {...defaultProps} isEditing />);

      // Open picker
      fireEvent.click(screen.getByRole('button', { name: /add widget/i }));

      // Select a widget type
      fireEvent.click(screen.getByRole('option', { name: /statistics card/i }));

      // Add the widget - use the button inside the dialog footer
      const dialog = screen.getByRole('dialog');
      const addButton = dialog.querySelector('footer button:last-child') as HTMLButtonElement;
      fireEvent.click(addButton);

      expect(mockOnAddWidget).toHaveBeenCalledTimes(1);
      expect(mockOnAddWidget).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stat_card',
        })
      );
    });

    it('closes widget picker after adding widget', () => {
      render(<DashboardCustomizer {...defaultProps} isEditing />);

      fireEvent.click(screen.getByRole('button', { name: /add widget/i }));
      fireEvent.click(screen.getByRole('option', { name: /statistics card/i }));
      
      // Add the widget - use the button inside the dialog footer
      const dialog = screen.getByRole('dialog');
      const addButton = dialog.querySelector('footer button:last-child') as HTMLButtonElement;
      fireEvent.click(addButton);

      expect(screen.queryByRole('dialog', { name: /add widget/i })).not.toBeInTheDocument();
    });
  });

  describe('Save Changes', () => {
    it('disables save button when no changes', () => {
      render(<DashboardCustomizer {...defaultProps} isEditing hasChanges={false} />);

      const saveButton = screen.getByText(/saved/i).closest('button');
      expect(saveButton).toBeDisabled();
    });

    it('enables save button when there are changes', () => {
      render(<DashboardCustomizer {...defaultProps} isEditing hasChanges />);

      const saveButton = screen.getByText(/save changes/i).closest('button');
      expect(saveButton).not.toBeDisabled();
    });

    it('calls onSave when save button is clicked', () => {
      render(<DashboardCustomizer {...defaultProps} isEditing hasChanges />);

      fireEvent.click(screen.getByText(/save changes/i));

      expect(mockOnSave).toHaveBeenCalledTimes(1);
    });

    it('shows unsaved indicator when not editing but has changes', () => {
      render(<DashboardCustomizer {...defaultProps} hasChanges />);

      expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
    });
  });

  describe('Reset Layout', () => {
    it('shows confirmation dialog when reset is clicked', () => {
      render(<DashboardCustomizer {...defaultProps} isEditing />);

      fireEvent.click(screen.getByRole('button', { name: /reset/i }));

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByText(/reset dashboard layout/i)).toBeInTheDocument();
    });

    it('calls onReset when reset is confirmed', () => {
      render(<DashboardCustomizer {...defaultProps} isEditing />);

      fireEvent.click(screen.getByRole('button', { name: /reset/i }));
      fireEvent.click(screen.getByRole('button', { name: /reset layout/i }));

      expect(mockOnReset).toHaveBeenCalledTimes(1);
    });

    it('closes confirmation dialog when cancel is clicked', () => {
      render(<DashboardCustomizer {...defaultProps} isEditing />);

      fireEvent.click(screen.getByRole('button', { name: /reset/i }));
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('does not call onReset when cancel is clicked', () => {
      render(<DashboardCustomizer {...defaultProps} isEditing />);

      fireEvent.click(screen.getByRole('button', { name: /reset/i }));
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockOnReset).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has accessible toolbar role', () => {
      render(<DashboardCustomizer {...defaultProps} />);

      expect(screen.getByRole('toolbar')).toHaveAttribute('aria-label', 'Dashboard customization');
    });

    it('edit button has aria-pressed attribute', () => {
      render(<DashboardCustomizer {...defaultProps} />);

      const editButton = screen.getByRole('button', { name: /customize/i });
      expect(editButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('confirmation dialog has proper ARIA attributes', () => {
      render(<DashboardCustomizer {...defaultProps} isEditing />);

      fireEvent.click(screen.getByRole('button', { name: /reset/i }));

      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveAttribute('aria-labelledby');
      expect(dialog).toHaveAttribute('aria-describedby');
    });
  });

  describe('Requirement 12.7 Validation', () => {
    /**
     * Validates Requirement 12.7: Dashboard widgets shall be configurable per user
     */
    it('provides complete customization workflow (Requirement 12.7)', () => {
      const { rerender } = render(<DashboardCustomizer {...defaultProps} />);

      // Step 1: Enter edit mode
      fireEvent.click(screen.getByRole('button', { name: /customize/i }));
      expect(mockOnToggleEdit).toHaveBeenCalled();

      // Simulate edit mode being active
      rerender(<DashboardCustomizer {...defaultProps} isEditing hasChanges />);

      // Step 2: Add a widget
      fireEvent.click(screen.getByRole('button', { name: /add widget/i }));
      fireEvent.click(screen.getByRole('option', { name: /compliance status/i }));
      
      // Add the widget - use the button inside the dialog footer
      const dialog = screen.getByRole('dialog');
      const addButton = dialog.querySelector('footer button:last-child') as HTMLButtonElement;
      fireEvent.click(addButton);
      expect(mockOnAddWidget).toHaveBeenCalled();

      // Step 3: Save changes
      fireEvent.click(screen.getByText(/save changes/i));
      expect(mockOnSave).toHaveBeenCalled();
    });

    /**
     * Validates Requirement 12.7: Layout customization per user
     */
    it('supports layout reset to default (Requirement 12.7)', () => {
      render(<DashboardCustomizer {...defaultProps} isEditing />);

      // Reset layout
      fireEvent.click(screen.getByRole('button', { name: /reset/i }));
      fireEvent.click(screen.getByRole('button', { name: /reset layout/i }));

      expect(mockOnReset).toHaveBeenCalled();
    });
  });
});
