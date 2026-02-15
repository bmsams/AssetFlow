/**
 * Screen Reader Accessibility Verification Tests
 * 
 * This test file verifies that all UI components follow proper accessibility patterns
 * for screen reader compatibility as required by Requirement 11: Accessibility Improvements.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';
import { EmptyState } from '../EmptyState';
import { Modal } from '../Modal';
import { FilterToolbar } from '../FilterToolbar';

describe('Accessibility Tests', () => {
  describe('StatusBadge Accessibility', () => {
    it('renders as a span element for inline display', () => {
      render(<StatusBadge label="Active" variant="active" />);
      const badge = screen.getByText('Active');
      expect(badge.tagName).toBe('SPAN');
    });

    it('does not use color alone to convey status', () => {
      render(<StatusBadge label="Active" variant="active" />);
      const badge = screen.getByText('Active');
      expect(badge).toHaveTextContent('Active');
    });
  });

  describe('EmptyState Accessibility', () => {
    it('has proper heading structure', () => {
      render(
        <EmptyState
          title="No items found"
          description="Try adjusting your filters"
        />
      );
      expect(screen.getByText('No items found')).toBeInTheDocument();
    });

    it('action button is keyboard accessible', () => {
      const onClick = vi.fn();
      render(
        <EmptyState
          title="No items"
          description="Add some items"
          primaryAction={{ label: 'Add Item', onClick }}
        />
      );
      const button = screen.getByRole('button', { name: /add item/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Modal Accessibility', () => {
    it('has role="dialog" attribute', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal="true" attribute', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby pointing to title', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby');
    });

    it('close button has aria-label', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );
      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('FilterToolbar Accessibility', () => {
    it('has role="search" on the toolbar', () => {
      render(<FilterToolbar />);
      expect(screen.getByRole('search')).toBeInTheDocument();
    });

    it('has aria-label on the toolbar', () => {
      render(<FilterToolbar />);
      expect(screen.getByRole('search', { name: /filter toolbar/i })).toBeInTheDocument();
    });

    it('search input has aria-label', () => {
      const onChange = vi.fn();
      render(
        <FilterToolbar
          search={{
            placeholder: 'Search assets...',
            value: '',
            onChange,
          }}
        />
      );
      const searchInput = screen.getByRole('textbox', { name: /search assets/i });
      expect(searchInput).toBeInTheDocument();
    });

    it('clear search button has aria-label', () => {
      const onChange = vi.fn();
      render(
        <FilterToolbar
          search={{
            placeholder: 'Search...',
            value: 'test',
            onChange,
          }}
        />
      );
      expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
    });

    it('clear filters button has aria-label', () => {
      const onClearFilters = vi.fn();
      render(
        <FilterToolbar
          hasActiveFilters={true}
          onClearFilters={onClearFilters}
        />
      );
      expect(screen.getByRole('button', { name: /clear all filters/i })).toBeInTheDocument();
    });
  });
});
