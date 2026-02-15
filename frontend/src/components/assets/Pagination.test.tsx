import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('renders nothing when totalItems is 0', () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalItems={0}
        pageSize={10}
        onPageChange={() => {}}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders item count information', () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={10}
        onPageChange={() => {}}
      />
    );
    // Check the info section exists and contains expected text
    const infoSection = screen.getByText(/Showing/);
    expect(infoSection).toBeInTheDocument();
    expect(infoSection.textContent).toContain('1');
    expect(infoSection.textContent).toContain('10');
    expect(infoSection.textContent).toContain('50');
  });

  it('renders correct item range for middle page', () => {
    render(
      <Pagination
        currentPage={3}
        totalItems={50}
        pageSize={10}
        onPageChange={() => {}}
      />
    );
    expect(screen.getByText('21')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('renders correct item range for last page', () => {
    render(
      <Pagination
        currentPage={5}
        totalItems={45}
        pageSize={10}
        onPageChange={() => {}}
      />
    );
    // Check the info section contains expected range
    const infoSection = screen.getByText(/Showing/);
    expect(infoSection.textContent).toContain('41');
    expect(infoSection.textContent).toContain('45');
  });

  it('renders page size selector when onPageSizeChange is provided', () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={10}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />
    );
    expect(screen.getByLabelText('Show:')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('calls onPageSizeChange when page size is changed', () => {
    const handlePageSizeChange = vi.fn();
    const handlePageChange = vi.fn();
    render(
      <Pagination
        currentPage={2}
        totalItems={50}
        pageSize={10}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    );
    
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '25' } });
    
    expect(handlePageSizeChange).toHaveBeenCalledWith(25);
    expect(handlePageChange).toHaveBeenCalledWith(1); // Reset to first page
  });

  it('renders previous and next buttons', () => {
    render(
      <Pagination
        currentPage={2}
        totalItems={50}
        pageSize={10}
        onPageChange={() => {}}
      />
    );
    expect(screen.getByLabelText('Go to previous page')).toBeInTheDocument();
    expect(screen.getByLabelText('Go to next page')).toBeInTheDocument();
  });

  it('disables previous button on first page', () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={10}
        onPageChange={() => {}}
      />
    );
    expect(screen.getByLabelText('Go to previous page')).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(
      <Pagination
        currentPage={5}
        totalItems={50}
        pageSize={10}
        onPageChange={() => {}}
      />
    );
    expect(screen.getByLabelText('Go to next page')).toBeDisabled();
  });

  it('calls onPageChange when previous button is clicked', () => {
    const handlePageChange = vi.fn();
    render(
      <Pagination
        currentPage={3}
        totalItems={50}
        pageSize={10}
        onPageChange={handlePageChange}
      />
    );
    
    fireEvent.click(screen.getByLabelText('Go to previous page'));
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange when next button is clicked', () => {
    const handlePageChange = vi.fn();
    render(
      <Pagination
        currentPage={3}
        totalItems={50}
        pageSize={10}
        onPageChange={handlePageChange}
      />
    );
    
    fireEvent.click(screen.getByLabelText('Go to next page'));
    expect(handlePageChange).toHaveBeenCalledWith(4);
  });

  it('renders page number buttons', () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={10}
        onPageChange={() => {}}
      />
    );
    
    expect(screen.getByLabelText('Go to page 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Go to page 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Go to page 5')).toBeInTheDocument();
  });

  it('highlights current page', () => {
    render(
      <Pagination
        currentPage={3}
        totalItems={50}
        pageSize={10}
        onPageChange={() => {}}
      />
    );
    
    const currentPageButton = screen.getByLabelText('Go to page 3');
    expect(currentPageButton).toHaveAttribute('aria-current', 'page');
  });

  it('calls onPageChange when page number is clicked', () => {
    const handlePageChange = vi.fn();
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={10}
        onPageChange={handlePageChange}
      />
    );
    
    fireEvent.click(screen.getByLabelText('Go to page 3'));
    expect(handlePageChange).toHaveBeenCalledWith(3);
  });

  it('shows ellipsis for many pages', () => {
    render(
      <Pagination
        currentPage={5}
        totalItems={200}
        pageSize={10}
        onPageChange={() => {}}
      />
    );
    
    // Should show ellipsis between page groups
    const ellipses = screen.getAllByText('…');
    expect(ellipses.length).toBeGreaterThan(0);
  });

  it('disables all controls when disabled prop is true', () => {
    render(
      <Pagination
        currentPage={2}
        totalItems={50}
        pageSize={10}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        disabled
      />
    );
    
    expect(screen.getByLabelText('Go to previous page')).toBeDisabled();
    expect(screen.getByLabelText('Go to next page')).toBeDisabled();
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByLabelText('Go to page 1')).toBeDisabled();
  });

  it('has accessible navigation role', () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={10}
        onPageChange={() => {}}
      />
    );
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
  });
});

describe('Pagination - Requirements Validation', () => {
  /**
   * Validates Requirement 2.1: Paginated asset list
   */
  it('supports pagination through asset list (Requirement 2.1)', () => {
    const handlePageChange = vi.fn();
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={10}
        onPageChange={handlePageChange}
      />
    );
    
    // Verify pagination info is displayed
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    
    // Verify navigation works
    fireEvent.click(screen.getByLabelText('Go to next page'));
    expect(handlePageChange).toHaveBeenCalledWith(2);
    
    fireEvent.click(screen.getByLabelText('Go to page 3'));
    expect(handlePageChange).toHaveBeenCalledWith(3);
  });

  /**
   * Validates Requirement 2.1: Configurable page size
   */
  it('supports configurable page size (Requirement 2.1)', () => {
    const handlePageSizeChange = vi.fn();
    render(
      <Pagination
        currentPage={1}
        totalItems={100}
        pageSize={10}
        pageSizeOptions={[10, 25, 50, 100]}
        onPageChange={() => {}}
        onPageSizeChange={handlePageSizeChange}
      />
    );
    
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    
    // Verify all page size options are available
    expect(screen.getByRole('option', { name: '10' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '25' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '50' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '100' })).toBeInTheDocument();
    
    fireEvent.change(select, { target: { value: '50' } });
    expect(handlePageSizeChange).toHaveBeenCalledWith(50);
  });

  /**
   * Validates Requirement 2.1: Item count display
   */
  it('displays accurate item count information (Requirement 2.1)', () => {
    render(
      <Pagination
        currentPage={2}
        totalItems={45}
        pageSize={10}
        onPageChange={() => {}}
      />
    );
    
    // Page 2 should show items 11-20 of 45
    const infoSection = screen.getByText(/Showing/);
    expect(infoSection.textContent).toContain('11');
    expect(infoSection.textContent).toContain('20');
    expect(infoSection.textContent).toContain('45');
  });
});
