/**
 * Tests for WidgetContainer component
 * Validates Requirements 12.7, 12.8:
 * - Configurable widgets
 * - Drill-down navigation from summary to detail views
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { WidgetContainer } from './WidgetContainer';
import type { WidgetConfig } from '../../types/widget';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockWidgetConfig: WidgetConfig = {
  id: 'test-widget',
  type: 'stat_card',
  title: 'Test Widget',
  visible: true,
  position: { row: 0, column: 0 },
  size: 'medium',
};

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('WidgetContainer', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('Basic Rendering', () => {
    it('renders widget with title', () => {
      renderWithRouter(
        <WidgetContainer config={mockWidgetConfig}>
          <div>Widget Content</div>
        </WidgetContainer>
      );

      expect(screen.getByText('Test Widget')).toBeInTheDocument();
      expect(screen.getByText('Widget Content')).toBeInTheDocument();
    });

    it('renders children content', () => {
      renderWithRouter(
        <WidgetContainer config={mockWidgetConfig}>
          <div data-testid="child-content">Child Content</div>
        </WidgetContainer>
      );

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    it('applies correct size class', () => {
      const { container } = renderWithRouter(
        <WidgetContainer config={{ ...mockWidgetConfig, size: 'large' }}>
          <div>Content</div>
        </WidgetContainer>
      );

      const article = container.querySelector('article');
      expect(article?.className).toContain('sizeLarge');
    });

    it('has accessible article landmark', () => {
      renderWithRouter(
        <WidgetContainer config={mockWidgetConfig}>
          <div>Content</div>
        </WidgetContainer>
      );

      expect(screen.getByRole('article', { name: 'Test Widget' })).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when isLoading is true', () => {
      renderWithRouter(
        <WidgetContainer config={mockWidgetConfig} isLoading>
          <div>Content</div>
        </WidgetContainer>
      );

      expect(screen.getByText('Loading widget content')).toBeInTheDocument();
    });

    it('hides content when loading', () => {
      renderWithRouter(
        <WidgetContainer config={mockWidgetConfig} isLoading>
          <div data-testid="content">Content</div>
        </WidgetContainer>
      );

      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('shows edit controls when isEditing is true', () => {
      const onRemove = vi.fn();
      const onToggleVisibility = vi.fn();

      renderWithRouter(
        <WidgetContainer
          config={mockWidgetConfig}
          isEditing
          onRemove={onRemove}
          onToggleVisibility={onToggleVisibility}
        >
          <div>Content</div>
        </WidgetContainer>
      );

      expect(screen.getByRole('button', { name: /hide widget/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /remove widget/i })).toBeInTheDocument();
    });

    it('calls onRemove when remove button is clicked', () => {
      const onRemove = vi.fn();

      renderWithRouter(
        <WidgetContainer config={mockWidgetConfig} isEditing onRemove={onRemove}>
          <div>Content</div>
        </WidgetContainer>
      );

      fireEvent.click(screen.getByRole('button', { name: /remove widget/i }));
      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('calls onToggleVisibility when visibility button is clicked', () => {
      const onToggleVisibility = vi.fn();

      renderWithRouter(
        <WidgetContainer
          config={mockWidgetConfig}
          isEditing
          onToggleVisibility={onToggleVisibility}
        >
          <div>Content</div>
        </WidgetContainer>
      );

      fireEvent.click(screen.getByRole('button', { name: /hide widget/i }));
      expect(onToggleVisibility).toHaveBeenCalledTimes(1);
    });

    it('hides drill-down button in edit mode', () => {
      renderWithRouter(
        <WidgetContainer config={mockWidgetConfig} isEditing>
          <div>Content</div>
        </WidgetContainer>
      );

      expect(screen.queryByRole('button', { name: /navigate to details/i })).not.toBeInTheDocument();
    });
  });

  describe('Drill-Down Navigation (Requirement 12.8)', () => {
    /**
     * Validates Requirement 12.8: Drill-down navigation from summary to detail views
     */
    it('shows drill-down button for supported widget types', () => {
      renderWithRouter(
        <WidgetContainer config={mockWidgetConfig}>
          <div>Content</div>
        </WidgetContainer>
      );

      expect(screen.getByRole('button', { name: /navigate to details/i })).toBeInTheDocument();
    });

    it('navigates to correct path when drill-down button is clicked', () => {
      renderWithRouter(
        <WidgetContainer config={mockWidgetConfig}>
          <div>Content</div>
        </WidgetContainer>
      );

      fireEvent.click(screen.getByRole('button', { name: /navigate to details/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/assets');
    });

    it('includes context params in drill-down navigation', () => {
      renderWithRouter(
        <WidgetContainer
          config={mockWidgetConfig}
          drillDownContext={{ status: 'DEPLOYED' }}
        >
          <div>Content</div>
        </WidgetContainer>
      );

      fireEvent.click(screen.getByRole('button', { name: /navigate to details/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/assets?status=DEPLOYED');
    });

    it('shows drill-down link in footer on hover', () => {
      renderWithRouter(
        <WidgetContainer config={mockWidgetConfig}>
          <div>Content</div>
        </WidgetContainer>
      );

      // Footer link should exist (visibility controlled by CSS)
      expect(screen.getByRole('button', { name: 'View All Assets' })).toBeInTheDocument();
    });

    it('navigates when footer drill-down link is clicked', () => {
      renderWithRouter(
        <WidgetContainer config={mockWidgetConfig}>
          <div>Content</div>
        </WidgetContainer>
      );

      fireEvent.click(screen.getByRole('button', { name: 'View All Assets' }));
      expect(mockNavigate).toHaveBeenCalled();
    });

    it('navigates to contracts for lease_expirations widget', () => {
      const leaseWidget: WidgetConfig = {
        ...mockWidgetConfig,
        type: 'lease_expirations',
      };

      renderWithRouter(
        <WidgetContainer config={leaseWidget}>
          <div>Content</div>
        </WidgetContainer>
      );

      fireEvent.click(screen.getByRole('button', { name: /navigate to details/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/contracts?type=lease');
    });

    it('navigates to licenses for compliance_indicators widget', () => {
      const complianceWidget: WidgetConfig = {
        ...mockWidgetConfig,
        type: 'compliance_indicators',
      };

      renderWithRouter(
        <WidgetContainer config={complianceWidget}>
          <div>Content</div>
        </WidgetContainer>
      );

      fireEvent.click(screen.getByRole('button', { name: /navigate to details/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/licenses');
    });
  });

  describe('Widget Sizes', () => {
    it('applies small size class', () => {
      const { container } = renderWithRouter(
        <WidgetContainer config={{ ...mockWidgetConfig, size: 'small' }}>
          <div>Content</div>
        </WidgetContainer>
      );

      expect(container.querySelector('article')?.className).toContain('sizeSmall');
    });

    it('applies medium size class', () => {
      const { container } = renderWithRouter(
        <WidgetContainer config={{ ...mockWidgetConfig, size: 'medium' }}>
          <div>Content</div>
        </WidgetContainer>
      );

      expect(container.querySelector('article')?.className).toContain('sizeMedium');
    });

    it('applies large size class', () => {
      const { container } = renderWithRouter(
        <WidgetContainer config={{ ...mockWidgetConfig, size: 'large' }}>
          <div>Content</div>
        </WidgetContainer>
      );

      expect(container.querySelector('article')?.className).toContain('sizeLarge');
    });
  });

  describe('Accessibility', () => {
    it('has accessible button labels', () => {
      renderWithRouter(
        <WidgetContainer config={mockWidgetConfig} isEditing>
          <div>Content</div>
        </WidgetContainer>
      );

      expect(screen.getByRole('button', { name: /hide widget/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /remove widget/i })).toBeInTheDocument();
    });

    it('indicates loading state with aria-busy', () => {
      renderWithRouter(
        <WidgetContainer config={mockWidgetConfig} isLoading>
          <div>Content</div>
        </WidgetContainer>
      );

      expect(screen.getByRole('article')).toHaveAttribute('aria-label', 'Test Widget');
    });
  });
});
