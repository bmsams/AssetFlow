/**
 * Tests for WidgetPicker component
 * Validates Requirement 12.7: Dashboard widgets shall be configurable per user
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WidgetPicker } from './WidgetPicker';
import { WIDGET_METADATA } from '../../types/widget';

describe('WidgetPicker', () => {
  const mockOnSelectWidget = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnSelectWidget.mockClear();
    mockOnClose.mockClear();
  });

  describe('Basic Rendering', () => {
    it('renders the picker dialog', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('dialog', { name: /add widget/i })).toBeInTheDocument();
    });

    it('renders all available widget types', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      WIDGET_METADATA.forEach((metadata) => {
        expect(screen.getByText(metadata.name)).toBeInTheDocument();
      });
    });

    it('displays widget descriptions', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      WIDGET_METADATA.forEach((metadata) => {
        expect(screen.getByText(metadata.description)).toBeInTheDocument();
      });
    });
  });

  describe('Widget Selection', () => {
    it('highlights selected widget type', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      const statCardOption = screen.getByRole('option', { name: /statistics card/i });
      fireEvent.click(statCardOption);

      expect(statCardOption).toHaveAttribute('aria-selected', 'true');
    });

    it('shows configuration form after selecting widget type', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByRole('option', { name: /statistics card/i }));

      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/size/i)).toBeInTheDocument();
    });

    it('pre-fills title with widget name', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByRole('option', { name: /statistics card/i }));

      const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
      expect(titleInput.value).toBe('Statistics Card');
    });

    it('allows customizing widget title', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByRole('option', { name: /statistics card/i }));
      
      const titleInput = screen.getByLabelText(/title/i);
      fireEvent.change(titleInput, { target: { value: 'My Custom Widget' } });

      expect((titleInput as HTMLInputElement).value).toBe('My Custom Widget');
    });

    it('allows selecting widget size', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByRole('option', { name: /lifecycle chart/i }));
      
      const sizeSelect = screen.getByLabelText(/size/i);
      fireEvent.change(sizeSelect, { target: { value: 'large' } });

      expect((sizeSelect as HTMLSelectElement).value).toBe('large');
    });
  });

  describe('Adding Widgets', () => {
    it('disables add button when no widget type is selected', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('button', { name: /add widget/i })).toBeDisabled();
    });

    it('disables add button when title is empty', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByRole('option', { name: /statistics card/i }));
      
      const titleInput = screen.getByLabelText(/title/i);
      fireEvent.change(titleInput, { target: { value: '' } });

      expect(screen.getByRole('button', { name: /add widget/i })).toBeDisabled();
    });

    it('enables add button when widget type and title are provided', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByRole('option', { name: /statistics card/i }));

      expect(screen.getByRole('button', { name: /add widget/i })).not.toBeDisabled();
    });

    it('calls onSelectWidget with correct config when adding widget', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByRole('option', { name: /statistics card/i }));
      
      const titleInput = screen.getByLabelText(/title/i);
      fireEvent.change(titleInput, { target: { value: 'My Stats' } });

      fireEvent.click(screen.getByRole('button', { name: /add widget/i }));

      expect(mockOnSelectWidget).toHaveBeenCalledTimes(1);
      expect(mockOnSelectWidget).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stat_card',
          title: 'My Stats',
          visible: true,
        })
      );
    });

    it('generates unique widget ID', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByRole('option', { name: /statistics card/i }));
      fireEvent.click(screen.getByRole('button', { name: /add widget/i }));

      const widgetConfig = mockOnSelectWidget.mock.calls[0][0];
      expect(widgetConfig.id).toMatch(/^widget-stat_card-\d+-[a-z0-9]+$/);
    });

    it('closes picker after adding widget', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByRole('option', { name: /statistics card/i }));
      fireEvent.click(screen.getByRole('button', { name: /add widget/i }));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Closing the Picker', () => {
    it('calls onClose when close button is clicked', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /close widget picker/i }));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when cancel button is clicked', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when clicking overlay', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      // Click on the overlay (the presentation div)
      const overlay = screen.getByRole('presentation');
      fireEvent.click(overlay);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the picker', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByRole('dialog'));

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has accessible dialog role', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('has accessible listbox for widget options', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('listbox', { name: /widget types/i })).toBeInTheDocument();
    });

    it('widget options have correct role', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      const options = screen.getAllByRole('option');
      expect(options.length).toBe(WIDGET_METADATA.length);
    });
  });

  describe('Requirement 12.7 Validation', () => {
    /**
     * Validates Requirement 12.7: Dashboard widgets shall be configurable per user
     */
    it('allows users to add configurable widgets (Requirement 12.7)', () => {
      render(
        <WidgetPicker
          onSelectWidget={mockOnSelectWidget}
          onClose={mockOnClose}
        />
      );

      // Select widget type
      fireEvent.click(screen.getByRole('option', { name: /compliance status/i }));
      
      // Configure title
      const titleInput = screen.getByLabelText(/title/i);
      fireEvent.change(titleInput, { target: { value: 'My Compliance Dashboard' } });
      
      // Configure size
      const sizeSelect = screen.getByLabelText(/size/i);
      fireEvent.change(sizeSelect, { target: { value: 'large' } });

      // Add widget
      fireEvent.click(screen.getByRole('button', { name: /add widget/i }));

      expect(mockOnSelectWidget).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'compliance_indicators',
          title: 'My Compliance Dashboard',
          size: 'large',
        })
      );
    });
  });
});
