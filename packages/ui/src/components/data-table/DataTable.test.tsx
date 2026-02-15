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
