import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBadge, type StatusVariant } from './StatusBadge';

describe('StatusBadge', () => {
  describe('Basic Rendering', () => {
    it('renders the label text', () => {
      render(<StatusBadge label="Active" />);

      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('renders as a span element', () => {
      render(<StatusBadge label="Test Status" />);

      const badge = screen.getByText('Test Status');
      expect(badge.tagName).toBe('SPAN');
    });

    it('applies custom className', () => {
      render(<StatusBadge label="Test" className="custom-class" />);

      const badge = screen.getByText('Test');
      expect(badge).toHaveClass('custom-class');
    });

    it('passes through additional HTML attributes', () => {
      render(<StatusBadge label="Test" data-testid="status-badge" />);

      expect(screen.getByTestId('status-badge')).toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('applies small size class by default', () => {
      render(<StatusBadge label="Small" />);

      const badge = screen.getByText('Small');
      expect(badge.className).toMatch(/size-sm/);
    });

    it('applies small size class when size="sm"', () => {
      render(<StatusBadge label="Small" size="sm" />);

      const badge = screen.getByText('Small');
      expect(badge.className).toMatch(/size-sm/);
    });

    it('applies medium size class when size="md"', () => {
      render(<StatusBadge label="Medium" size="md" />);

      const badge = screen.getByText('Medium');
      expect(badge.className).toMatch(/size-md/);
    });
  });

  describe('Status Variants', () => {
    it('uses info variant by default', () => {
      const { container } = render(<StatusBadge label="Default" />);

      const badge = container.querySelector('span');
      const style = badge?.getAttribute('style');
      expect(style).toContain('--color-info-100');
      expect(style).toContain('--color-info-700');
    });

    const variantTestCases: Array<{
      variant: StatusVariant;
      expectedBg: string;
      expectedText: string;
    }> = [
      { variant: 'active', expectedBg: '--color-success-100', expectedText: '--color-success-700' },
      { variant: 'inactive', expectedBg: '--color-gray-100', expectedText: '--color-gray-600' },
      { variant: 'pending', expectedBg: '--color-warning-100', expectedText: '--color-warning-700' },
      { variant: 'approved', expectedBg: '--color-success-100', expectedText: '--color-success-700' },
      { variant: 'rejected', expectedBg: '--color-error-100', expectedText: '--color-error-700' },
      { variant: 'draft', expectedBg: '--color-gray-100', expectedText: '--color-gray-600' },
      { variant: 'pending_approval', expectedBg: '--color-warning-100', expectedText: '--color-warning-700' },
      { variant: 'sent', expectedBg: '--color-primary-100', expectedText: '--color-primary-700' },
      { variant: 'partially_received', expectedBg: '--color-info-100', expectedText: '--color-info-700' },
      { variant: 'received', expectedBg: '--color-success-100', expectedText: '--color-success-700' },
      { variant: 'closed', expectedBg: '--color-gray-100', expectedText: '--color-gray-600' },
      { variant: 'cancelled', expectedBg: '--color-error-100', expectedText: '--color-error-700' },
      { variant: 'ordered', expectedBg: '--color-info-100', expectedText: '--color-info-700' },
      { variant: 'in_stock', expectedBg: '--color-success-100', expectedText: '--color-success-700' },
      { variant: 'deployed', expectedBg: '--color-primary-100', expectedText: '--color-primary-700' },
      { variant: 'in_maintenance', expectedBg: '--color-warning-100', expectedText: '--color-warning-700' },
      { variant: 'retired', expectedBg: '--color-gray-100', expectedText: '--color-gray-600' },
      { variant: 'disposed', expectedBg: '--color-gray-200', expectedText: '--color-gray-500' },
      { variant: 'success', expectedBg: '--color-success-100', expectedText: '--color-success-700' },
      { variant: 'warning', expectedBg: '--color-warning-100', expectedText: '--color-warning-700' },
      { variant: 'error', expectedBg: '--color-error-100', expectedText: '--color-error-700' },
      { variant: 'info', expectedBg: '--color-info-100', expectedText: '--color-info-700' },
    ];

    variantTestCases.forEach(({ variant, expectedBg, expectedText }) => {
      it(`applies correct colors for "${variant}" variant`, () => {
        const { container } = render(<StatusBadge label={variant} variant={variant} />);

        const badge = container.querySelector('span');
        const style = badge?.getAttribute('style');
        expect(style).toContain(expectedBg);
        expect(style).toContain(expectedText);
      });
    });
  });

  describe('Custom Colors', () => {
    it('uses custom colors when provided', () => {
      const { container } = render(
        <StatusBadge
          label="Custom"
          colors={{
            background: '--color-purple-100',
            text: '--color-purple-700',
          }}
        />
      );

      const badge = container.querySelector('span');
      const style = badge?.getAttribute('style');
      expect(style).toContain('var(--color-purple-100)');
      expect(style).toContain('var(--color-purple-700)');
    });

    it('custom colors override variant colors', () => {
      const { container } = render(
        <StatusBadge
          label="Custom Override"
          variant="active"
          colors={{
            background: '--color-purple-100',
            text: '--color-purple-700',
          }}
        />
      );

      const badge = container.querySelector('span');
      const style = badge?.getAttribute('style');
      // Should use custom colors, not active variant colors
      expect(style).toContain('var(--color-purple-100)');
      expect(style).toContain('var(--color-purple-700)');
      expect(style).not.toContain('--color-success-100');
    });

    it('handles colors with var() prefix', () => {
      const { container } = render(
        <StatusBadge
          label="With Var"
          colors={{
            background: 'var(--color-custom-100)',
            text: 'var(--color-custom-700)',
          }}
        />
      );

      const badge = container.querySelector('span');
      const style = badge?.getAttribute('style');
      expect(style).toContain('var(--color-custom-100)');
      expect(style).toContain('var(--color-custom-700)');
    });

    it('handles colors without var() prefix', () => {
      const { container } = render(
        <StatusBadge
          label="Without Var"
          colors={{
            background: '--color-custom-100',
            text: '--color-custom-700',
          }}
        />
      );

      const badge = container.querySelector('span');
      const style = badge?.getAttribute('style');
      // Should wrap in var()
      expect(style).toContain('var(--color-custom-100)');
      expect(style).toContain('var(--color-custom-700)');
    });
  });

  describe('CSS Variable Usage (Theme Compliance)', () => {
    it('does not use inline color values', () => {
      const { container } = render(<StatusBadge label="Test" variant="active" />);

      const badge = container.querySelector('span');
      const style = badge?.getAttribute('style') || '';
      
      // Should not contain hex colors
      expect(style).not.toMatch(/#[0-9a-fA-F]{3,6}/);
      // Should not contain rgb/rgba
      expect(style).not.toMatch(/rgb\(/);
      expect(style).not.toMatch(/rgba\(/);
      // Should only use CSS variables
      expect(style).toMatch(/var\(--/);
    });

    it('uses CSS custom properties for dynamic colors', () => {
      const { container } = render(<StatusBadge label="Test" variant="error" />);

      const badge = container.querySelector('span');
      const style = badge?.getAttribute('style') || '';
      
      // Should set CSS custom properties
      expect(style).toContain('--status-badge-bg');
      expect(style).toContain('--status-badge-text');
    });
  });

  describe('Asset Lifecycle Statuses', () => {
    it('renders ordered status correctly', () => {
      render(<StatusBadge label="Ordered" variant="ordered" />);
      expect(screen.getByText('Ordered')).toBeInTheDocument();
    });

    it('renders in_stock status correctly', () => {
      render(<StatusBadge label="In Stock" variant="in_stock" />);
      expect(screen.getByText('In Stock')).toBeInTheDocument();
    });

    it('renders deployed status correctly', () => {
      render(<StatusBadge label="Deployed" variant="deployed" />);
      expect(screen.getByText('Deployed')).toBeInTheDocument();
    });

    it('renders in_maintenance status correctly', () => {
      render(<StatusBadge label="In Maintenance" variant="in_maintenance" />);
      expect(screen.getByText('In Maintenance')).toBeInTheDocument();
    });

    it('renders retired status correctly', () => {
      render(<StatusBadge label="Retired" variant="retired" />);
      expect(screen.getByText('Retired')).toBeInTheDocument();
    });

    it('renders disposed status correctly', () => {
      render(<StatusBadge label="Disposed" variant="disposed" />);
      expect(screen.getByText('Disposed')).toBeInTheDocument();
    });
  });

  describe('Purchase Order Statuses', () => {
    it('renders draft status correctly', () => {
      render(<StatusBadge label="Draft" variant="draft" />);
      expect(screen.getByText('Draft')).toBeInTheDocument();
    });

    it('renders pending_approval status correctly', () => {
      render(<StatusBadge label="Pending Approval" variant="pending_approval" />);
      expect(screen.getByText('Pending Approval')).toBeInTheDocument();
    });

    it('renders sent status correctly', () => {
      render(<StatusBadge label="Sent" variant="sent" />);
      expect(screen.getByText('Sent')).toBeInTheDocument();
    });

    it('renders partially_received status correctly', () => {
      render(<StatusBadge label="Partially Received" variant="partially_received" />);
      expect(screen.getByText('Partially Received')).toBeInTheDocument();
    });

    it('renders received status correctly', () => {
      render(<StatusBadge label="Received" variant="received" />);
      expect(screen.getByText('Received')).toBeInTheDocument();
    });

    it('renders closed status correctly', () => {
      render(<StatusBadge label="Closed" variant="closed" />);
      expect(screen.getByText('Closed')).toBeInTheDocument();
    });

    it('renders cancelled status correctly', () => {
      render(<StatusBadge label="Cancelled" variant="cancelled" />);
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });
  });
});
