import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DataTable } from './DataTable';

const sampleData = [
  { id: '1', name: 'Laptop', tag: 'AST-001', status: 'Active' },
  { id: '2', name: 'Monitor', tag: 'AST-002', status: 'Deployed' },
  { id: '3', name: 'Keyboard', tag: 'AST-003', status: 'In Stock' },
  { id: '4', name: 'Mouse', tag: 'AST-004', status: 'Active' },
  { id: '5', name: 'Headset', tag: 'AST-005', status: 'Retired' },
];

describe('DataTable', () => {
  it('renders table with columns and data', () => {
    render(
      <DataTable data={sampleData} keyField="id">
        <DataTable.Column id="name" header="Name" accessor="name" />
        <DataTable.Column id="tag" header="Tag" accessor="tag" />
        <DataTable.Column id="status" header="Status" accessor="status" />
      </DataTable>
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Laptop')).toBeInTheDocument();
    expect(screen.getByText('AST-001')).toBeInTheDocument();
  });

  it('renders custom cell renderer', () => {
    render(
      <DataTable data={sampleData} keyField="id">
        <DataTable.Column id="name" header="Name" accessor="name" render={(v) => <strong>{v}</strong>} />
      </DataTable>
    );
    expect(screen.getByText('Laptop').tagName).toBe('STRONG');
  });

  it('sorts when clicking sortable column header', async () => {
    const user = userEvent.setup();
    render(
      <DataTable data={sampleData} keyField="id">
        <DataTable.Column id="name" header="Name" accessor="name" sortable />
      </DataTable>
    );
    await user.click(screen.getByText('Name'));
    const cells = screen.getAllByRole('cell');
    expect(cells[0].textContent).toBe('Headset');
  });

  it('renders selection checkboxes when selectable', () => {
    render(
      <DataTable data={sampleData} keyField="id" selectable="multi">
        <DataTable.Column id="name" header="Name" accessor="name" />
      </DataTable>
    );
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
  });

  it('renders toolbar with search', async () => {
    const user = userEvent.setup();
    render(
      <DataTable data={sampleData} keyField="id">
        <DataTable.Column id="name" header="Name" accessor="name" />
        <DataTable.Toolbar>
          <DataTable.Search placeholder="Search assets..." />
        </DataTable.Toolbar>
      </DataTable>
    );
    const search = screen.getByPlaceholderText('Search assets...');
    await user.type(search, 'Laptop');
    expect(screen.getByText('Laptop')).toBeInTheDocument();
    expect(screen.queryByText('Monitor')).not.toBeInTheDocument();
  });

  it('renders pagination', () => {
    render(
      <DataTable data={sampleData} keyField="id">
        <DataTable.Column id="name" header="Name" accessor="name" />
        <DataTable.Pagination pageSize={2} showTotal />
      </DataTable>
    );
    expect(screen.getByText(/showing/i)).toBeInTheDocument();
  });

  it('renders bulk actions when rows selected', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(
      <DataTable data={sampleData} keyField="id" selectable="multi">
        <DataTable.Column id="name" header="Name" accessor="name" />
        <DataTable.BulkActions>
          <button onClick={onExport}>Export</button>
        </DataTable.BulkActions>
      </DataTable>
    );
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]); // first row checkbox
    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('renders loading skeleton', () => {
    render(
      <DataTable data={[]} keyField="id" loading>
        <DataTable.Column id="name" header="Name" accessor="name" />
      </DataTable>
    );
    expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
  });

  it('renders density toggle', async () => {
    render(
      <DataTable data={sampleData} keyField="id">
        <DataTable.Column id="name" header="Name" accessor="name" />
        <DataTable.Toolbar>
          <DataTable.DensityToggle />
        </DataTable.Toolbar>
      </DataTable>
    );
    expect(screen.getByLabelText(/density/i)).toBeInTheDocument();
  });

  it('renders column toggle', async () => {
    render(
      <DataTable data={sampleData} keyField="id">
        <DataTable.Column id="name" header="Name" accessor="name" />
        <DataTable.Column id="tag" header="Tag" accessor="tag" />
        <DataTable.Toolbar>
          <DataTable.ColumnToggle />
        </DataTable.Toolbar>
      </DataTable>
    );
    expect(screen.getByLabelText(/columns/i)).toBeInTheDocument();
  });
});

/* ================================================================
 *  useVirtualScroll tests
 * ================================================================ */
import { renderHook, act } from '@testing-library/react';
import { useVirtualScroll } from './useVirtualScroll';

describe('useVirtualScroll', () => {
  it('calculates initial visible window with default overscan', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalItems: 1000,
        itemHeight: 44,
        containerHeight: 400,
      })
    );

    // visibleCount = ceil(400/44) = 10
    // startIndex = max(0, floor(0/44) - 5) = 0
    // endIndex = min(0 + 10 + 10, 999) = 20
    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(20);
    expect(result.current.totalHeight).toBe(1000 * 44);
    expect(result.current.offsetY).toBe(0);
  });

  it('updates visible window on scroll', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalItems: 1000,
        itemHeight: 44,
        containerHeight: 400,
        overscan: 3,
      })
    );

    act(() => {
      result.current.onScroll(4400); // scrollTop = 4400
    });

    // visibleCount = ceil(400/44) = 10
    // raw start = floor(4400/44) - 3 = 100 - 3 = 97
    // endIndex = 97 + 10 + 6 = 113
    expect(result.current.startIndex).toBe(97);
    expect(result.current.endIndex).toBe(113);
    expect(result.current.offsetY).toBe(97 * 44);
  });

  it('clamps startIndex to 0', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalItems: 100,
        itemHeight: 40,
        containerHeight: 300,
        overscan: 10,
      })
    );

    // scrollTop = 0, floor(0/40) - 10 = -10 -> clamped to 0
    expect(result.current.startIndex).toBe(0);
  });

  it('clamps endIndex to totalItems - 1', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalItems: 10,
        itemHeight: 40,
        containerHeight: 800,
        overscan: 5,
      })
    );

    // visibleCount = ceil(800/40) = 20
    // endIndex = 0 + 20 + 10 = 30, clamped to 9
    expect(result.current.endIndex).toBe(9);
  });

  it('handles zero items', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalItems: 0,
        itemHeight: 44,
        containerHeight: 400,
      })
    );

    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(-1);
    expect(result.current.totalHeight).toBe(0);
  });

  it('handles zero containerHeight gracefully', () => {
    const { result } = renderHook(() =>
      useVirtualScroll({
        totalItems: 100,
        itemHeight: 44,
        containerHeight: 0,
      })
    );

    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(99);
    expect(result.current.totalHeight).toBe(0);
  });
});

/* ================================================================
 *  Frozen column tests
 * ================================================================ */
describe('DataTable frozen columns', () => {
  it('renders frozen column with sticky class', () => {
    const { container } = render(
      <DataTable data={sampleData} keyField="id">
        <DataTable.Column id="name" header="Name" accessor="name" frozen />
        <DataTable.Column id="tag" header="Tag" accessor="tag" />
        <DataTable.Column id="status" header="Status" accessor="status" />
      </DataTable>
    );

    // The table should be wrapped in a scrollable container
    const scrollableDiv = container.querySelector('[class*="tableScrollable"]');
    expect(scrollableDiv).toBeInTheDocument();

    // The frozen header should have the frozenCellHeader class
    const headerCells = container.querySelectorAll('th');
    const nameHeader = Array.from(headerCells).find(th => th.textContent?.includes('Name'));
    expect(nameHeader?.className).toContain('frozenCellHeader');

    // The frozen data cells should have the frozenCell class
    const dataCells = container.querySelectorAll('td');
    const frozenDataCells = Array.from(dataCells).filter(td => td.className.includes('frozenCell'));
    expect(frozenDataCells.length).toBe(sampleData.length);
  });

  it('does not add scrollable wrapper without frozen columns', () => {
    const { container } = render(
      <DataTable data={sampleData} keyField="id">
        <DataTable.Column id="name" header="Name" accessor="name" />
        <DataTable.Column id="tag" header="Tag" accessor="tag" />
      </DataTable>
    );

    const scrollableDiv = container.querySelector('[class*="tableScrollable"]');
    expect(scrollableDiv).not.toBeInTheDocument();
  });
});

/* ================================================================
 *  Virtual scroll integration tests
 * ================================================================ */
describe('DataTable virtual scroll', () => {
  const largeData = Array.from({ length: 100 }, (_, i) => ({
    id: String(i + 1),
    name: `Item ${i + 1}`,
    tag: `TAG-${String(i + 1).padStart(3, '0')}`,
  }));

  it('renders only visible rows when virtualScroll is enabled', () => {
    // containerHeight=200, itemHeight=44 (comfortable), overscan=2
    // visibleCount = ceil(200/44) = 5
    // rendered rows = 5 + 2*2 = 9 (but clamped to totalItems if less)
    const { container } = render(
      <DataTable data={largeData} keyField="id" virtualScroll={{ containerHeight: 200, overscan: 2 }}>
        <DataTable.Column id="name" header="Name" accessor="name" />
        <DataTable.Column id="tag" header="Tag" accessor="tag" />
      </DataTable>
    );

    // Should have a virtual scroll container
    const scrollContainer = container.querySelector('[class*="virtualScrollContainer"]');
    expect(scrollContainer).toBeInTheDocument();

    // Count data rows (excluding spacer rows)
    const dataRows = container.querySelectorAll('tbody tr:not([aria-hidden="true"])');
    expect(dataRows.length).toBeLessThan(largeData.length);
    expect(dataRows.length).toBe(10); // startIndex=0, endIndex=9 -> 10 rows
  });

  it('does not use virtual scroll when prop is not provided', () => {
    const { container } = render(
      <DataTable data={sampleData} keyField="id">
        <DataTable.Column id="name" header="Name" accessor="name" />
      </DataTable>
    );

    const scrollContainer = container.querySelector('[class*="virtualScrollContainer"]');
    expect(scrollContainer).not.toBeInTheDocument();

    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(sampleData.length);
  });
});
