import { createContext, useContext, type ReactNode } from 'react';

export interface ColumnDef {
  id: string;
  header: string;
  accessor?: string;
  width?: number | string;
  frozen?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, row: any) => ReactNode;
}

export interface SortState {
  columnId: string;
  direction: 'asc' | 'desc';
}

export type Density = 'compact' | 'comfortable' | 'spacious';

export interface DataTableState {
  data: any[];
  columns: ColumnDef[];
  sortState: SortState | null;
  selectedIds: Set<string>;
  density: Density;
  loading: boolean;
  keyField: string;
  searchQuery: string;
  visibleColumns: Set<string>;
}

export interface DataTableActions {
  sort: (columnId: string) => void;
  toggleSelection: (id: string) => void;
  toggleSelectAll: () => void;
  clearSelection: () => void;
  setDensity: (density: Density) => void;
  setSearchQuery: (query: string) => void;
  toggleColumnVisibility: (columnId: string) => void;
}

export interface DataTableContextValue extends DataTableState, DataTableActions {
  filteredData: any[];
  sortedData: any[];
  paginatedData: any[];
  currentPage: number;
  pageSize: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  selectable: false | 'single' | 'multi';
}

export const DataTableCtx = createContext<DataTableContextValue | null>(null);

export function useDataTable(): DataTableContextValue {
  const ctx = useContext(DataTableCtx);
  if (!ctx) throw new Error('useDataTable must be used within a DataTable');
  return ctx;
}
