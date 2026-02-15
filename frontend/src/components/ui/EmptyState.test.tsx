import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { EmptyState, SearchEmptyState, FilteredEmptyState } from './EmptyState';

describe('EmptyState', () => {
  describe('Basic Rendering', () => {
    it('renders title and description', () => {
      render(
        <EmptyState
          title="No items found"
          description="Get started by adding your first item."
        />
      );

      expect(screen.getByText('No items found')).toBeInTheDocument();
      expect(screen.getByText('Get started by adding your first item.')).toBeInTheDocument();
    });

    it('renders with role="status" for accessibility', () => {
      render(
        <EmptyState
          title="No items"
          description="No items to display."
        />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('includes aria-label with the title', () => {
      render(
        <EmptyState
          title="No assets found"
          description="Add your first asset."
        />
      );

      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'No assets found');
    });

    it('renders custom icon when provided', () => {
      render(
        <EmptyState
          icon={<span data-testid="custom-icon">📦</span>}
          title="Custom Icon"
          description="With a custom icon."
        />
      );

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <EmptyState
          title="Test"
          description="Test description"
          className="custom-class"
        />
      );

      expect(screen.getByRole('status')).toHaveClass('custom-class');
    });
  });

  describe('Variants', () => {
    it('applies default variant class by default', () => {
      render(
        <EmptyState
          title="Default"
          description="Default variant"
        />
      );

      expect(screen.getByRole('status').className).toMatch(/default/);
    });

    it('applies search variant class', () => {
      render(
        <EmptyState
          variant="search"
          title="No results"
          description="Search variant"
        />
      );

      expect(screen.getByRole('status').className).toMatch(/search/);
    });

    it('applies error variant class', () => {
      render(
        <EmptyState
          variant="error"
          title="Error"
          description="Error variant"
        />
      );

      expect(screen.getByRole('status').className).toMatch(/error/);
    });

    it('applies filtered variant class', () => {
      render(
        <EmptyState
          variant="filtered"
          title="No matches"
          description="Filtered variant"
        />
      );

      expect(screen.getByRole('status').className).toMatch(/filtered/);
    });
  });

  describe('Primary Action', () => {
    it('renders primary action button when provided', () => {
      const handleClick = vi.fn();

      render(
        <EmptyState
          title="No items"
          description="Add your first item."
          primaryAction={{
            label: 'Add Item',
            onClick: handleClick,
          }}
        />
      );

      expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
    });

    it('calls onClick when primary action button is clicked', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(
        <EmptyState
          title="No items"
          description="Add your first item."
          primaryAction={{
            label: 'Add Item',
            onClick: handleClick,
          }}
        />
      );

      await user.click(screen.getByRole('button', { name: /add item/i }));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders primary action with icon when provided', () => {
      render(
        <EmptyState
          title="No items"
          description="Add your first item."
          primaryAction={{
            label: 'Add Item',
            onClick: vi.fn(),
            icon: <span data-testid="action-icon">+</span>,
          }}
        />
      );

      expect(screen.getByTestId('action-icon')).toBeInTheDocument();
    });
  });

  describe('Secondary Action', () => {
    it('renders secondary action link when provided', () => {
      const handleClick = vi.fn();

      render(
        <EmptyState
          title="No items"
          description="Add your first item."
          secondaryAction={{
            label: 'Learn more',
            onClick: handleClick,
          }}
        />
      );

      expect(screen.getByRole('button', { name: /learn more/i })).toBeInTheDocument();
    });

    it('calls onClick when secondary action is clicked', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(
        <EmptyState
          title="No items"
          description="Add your first item."
          secondaryAction={{
            label: 'Learn more',
            onClick: handleClick,
          }}
        />
      );

      await user.click(screen.getByRole('button', { name: /learn more/i }));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders both primary and secondary actions together', () => {
      render(
        <EmptyState
          title="No items"
          description="Add your first item."
          primaryAction={{
            label: 'Add Item',
            onClick: vi.fn(),
          }}
          secondaryAction={{
            label: 'Learn more',
            onClick: vi.fn(),
          }}
        />
      );

      expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /learn more/i })).toBeInTheDocument();
    });
  });

  describe('No Actions', () => {
    it('does not render actions container when no actions provided', () => {
      const { container } = render(
        <EmptyState
          title="No items"
          description="No actions available."
        />
      );

      // Should not have any buttons
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      // Actions container should not exist
      expect(container.querySelector('.actions')).not.toBeInTheDocument();
    });
  });
});

describe('SearchEmptyState', () => {
  it('renders with search variant styling', () => {
    render(<SearchEmptyState />);

    expect(screen.getByRole('status').className).toMatch(/search/);
  });

  it('displays default message when no search term provided', () => {
    render(<SearchEmptyState />);

    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(screen.getByText('No items match your search criteria.')).toBeInTheDocument();
  });

  it('displays search term in message when provided', () => {
    render(<SearchEmptyState searchTerm="laptop" />);

    expect(screen.getByText(/No items match "laptop"/)).toBeInTheDocument();
  });

  it('renders clear search button when onClearSearch provided', () => {
    const handleClear = vi.fn();

    render(<SearchEmptyState onClearSearch={handleClear} />);

    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
  });

  it('calls onClearSearch when clear button is clicked', async () => {
    const handleClear = vi.fn();
    const user = userEvent.setup();

    render(<SearchEmptyState onClearSearch={handleClear} />);

    await user.click(screen.getByRole('button', { name: /clear search/i }));

    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it('does not render clear button when onClearSearch not provided', () => {
    render(<SearchEmptyState searchTerm="test" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('FilteredEmptyState', () => {
  it('renders with filtered variant styling', () => {
    render(<FilteredEmptyState />);

    expect(screen.getByRole('status').className).toMatch(/filtered/);
  });

  it('displays appropriate message for filtered results', () => {
    render(<FilteredEmptyState />);

    expect(screen.getByText('No results match your filters')).toBeInTheDocument();
    expect(screen.getByText(/Try adjusting your filter criteria/)).toBeInTheDocument();
  });

  it('renders clear filters button when onClearFilters provided', () => {
    const handleClear = vi.fn();

    render(<FilteredEmptyState onClearFilters={handleClear} />);

    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
  });

  it('calls onClearFilters when clear button is clicked', async () => {
    const handleClear = vi.fn();
    const user = userEvent.setup();

    render(<FilteredEmptyState onClearFilters={handleClear} />);

    await user.click(screen.getByRole('button', { name: /clear filters/i }));

    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it('does not render clear button when onClearFilters not provided', () => {
    render(<FilteredEmptyState />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('EmptyState Accessibility', () => {
  it('has accessible title as heading', () => {
    render(
      <EmptyState
        title="No assets found"
        description="Add your first asset."
      />
    );

    expect(screen.getByRole('heading', { name: /no assets found/i })).toBeInTheDocument();
  });

  it('primary action button is keyboard accessible', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <EmptyState
        title="No items"
        description="Add your first item."
        primaryAction={{
          label: 'Add Item',
          onClick: handleClick,
        }}
      />
    );

    const button = screen.getByRole('button', { name: /add item/i });
    button.focus();
    await user.keyboard('{Enter}');

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('secondary action is keyboard accessible', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <EmptyState
        title="No items"
        description="Add your first item."
        secondaryAction={{
          label: 'Learn more',
          onClick: handleClick,
        }}
      />
    );

    const link = screen.getByRole('button', { name: /learn more/i });
    link.focus();
    await user.keyboard('{Enter}');

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
