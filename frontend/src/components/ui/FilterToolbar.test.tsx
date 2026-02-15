import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterToolbar, type FilterConfig } from './FilterToolbar';

describe('FilterToolbar', () => {
  describe('Basic Rendering', () => {
    it('renders the toolbar container', () => {
      render(<FilterToolbar />);
      const toolbar = screen.getByRole('search', { name: /filter toolbar/i });
      expect(toolbar).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<FilterToolbar className="custom-class" />);
      const toolbar = screen.getByRole('search');
      expect(toolbar).toHaveClass('custom-class');
    });

    it('renders without search or filters', () => {
      render(<FilterToolbar />);
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  describe('Search Input', () => {
    it('renders search input when search config is provided', () => {
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
      const searchInput = screen.getByPlaceholderText('Search assets...');
      expect(searchInput).toBeInTheDocument();
    });

    it('displays the current search value', () => {
      const onChange = vi.fn();
      render(
        <FilterToolbar
          search={{
            placeholder: 'Search...',
            value: 'test query',
            onChange,
          }}
        />
      );
      const searchInput = screen.getByDisplayValue('test query');
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe('Select Filter', () => {
    const statusFilter: FilterConfig = {
      id: 'status',
      type: 'select',
      label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'pending', label: 'Pending' },
      ],
      placeholder: 'All Statuses',
    };

    it('renders select filter with label', () => {
      render(<FilterToolbar filters={[statusFilter]} />);
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /status/i })).toBeInTheDocument();
    });

    it('renders all options including placeholder', () => {
      render(<FilterToolbar filters={[statusFilter]} />);
      const select = screen.getByRole('combobox', { name: /status/i });
      expect(select).toBeInTheDocument();
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(4);
      expect(options[0]).toHaveTextContent('All Statuses');
    });

    it('displays current filter value', () => {
      render(
        <FilterToolbar
          filters={[statusFilter]}
          filterValues={{ status: 'active' }}
        />
      );
      const select = screen.getByRole('combobox', { name: /status/i });
      expect(select).toHaveValue('active');
    });

    it('calls onFilterChange when selection changes', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();
      render(
        <FilterToolbar
          filters={[statusFilter]}
          filterValues={{}}
          onFilterChange={onFilterChange}
        />
      );
      const select = screen.getByRole('combobox', { name: /status/i });
      await user.selectOptions(select, 'active');
      expect(onFilterChange).toHaveBeenCalledWith('status', 'active');
    });
  });

  describe('Date Filter', () => {
    const dateFilter: FilterConfig = {
      id: 'createdDate',
      type: 'date',
      label: 'Created Date',
    };

    it('renders date filter with label', () => {
      render(<FilterToolbar filters={[dateFilter]} />);
      expect(screen.getByText('Created Date')).toBeInTheDocument();
      expect(screen.getByLabelText('Created Date')).toBeInTheDocument();
    });

    it('displays current date value', () => {
      render(
        <FilterToolbar
          filters={[dateFilter]}
          filterValues={{ createdDate: '2024-01-15' }}
        />
      );
      const dateInput = screen.getByLabelText('Created Date');
      expect(dateInput).toHaveValue('2024-01-15');
    });

    it('calls onFilterChange when date changes', () => {
      const onFilterChange = vi.fn();
      render(
        <FilterToolbar
          filters={[dateFilter]}
          filterValues={{}}
          onFilterChange={onFilterChange}
        />
      );
      const dateInput = screen.getByLabelText('Created Date');
      fireEvent.change(dateInput, { target: { value: '2024-02-20' } });
      expect(onFilterChange).toHaveBeenCalledWith('createdDate', '2024-02-20');
    });
  });

  describe('Clear Filters Button', () => {
    it('shows clear filters button when hasActiveFilters is true', () => {
      const onClearFilters = vi.fn();
      render(
        <FilterToolbar
          hasActiveFilters={true}
          onClearFilters={onClearFilters}
        />
      );
      expect(screen.getByRole('button', { name: /clear all filters/i })).toBeInTheDocument();
    });

    it('hides clear filters button when hasActiveFilters is false', () => {
      const onClearFilters = vi.fn();
      render(
        <FilterToolbar
          hasActiveFilters={false}
          onClearFilters={onClearFilters}
        />
      );
      expect(screen.queryByRole('button', { name: /clear all filters/i })).not.toBeInTheDocument();
    });

    it('calls onClearFilters when clear button is clicked', async () => {
      const user = userEvent.setup();
      const onClearFilters = vi.fn();
      render(
        <FilterToolbar
          hasActiveFilters={true}
          onClearFilters={onClearFilters}
        />
      );
      const clearButton = screen.getByRole('button', { name: /clear all filters/i });
      await user.click(clearButton);
      expect(onClearFilters).toHaveBeenCalled();
    });
  });

  describe('Actions', () => {
    it('renders custom actions', () => {
      render(
        <FilterToolbar
          actions={<button data-testid="custom-action">Add New</button>}
        />
      );
      expect(screen.getByTestId('custom-action')).toBeInTheDocument();
      expect(screen.getByText('Add New')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has role="search" on the toolbar', () => {
      render(<FilterToolbar />);
      expect(screen.getByRole('search')).toBeInTheDocument();
    });

    it('has aria-label on the toolbar', () => {
      render(<FilterToolbar />);
      expect(screen.getByRole('search', { name: /filter toolbar/i })).toBeInTheDocument();
    });
  });
});
