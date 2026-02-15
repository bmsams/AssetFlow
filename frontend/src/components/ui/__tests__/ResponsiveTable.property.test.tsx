/**
 * Property-Based Tests for ResponsiveTable Scrollability
 * **Validates: Requirement 9** - Mobile Responsive Tables
 * **Validates: Property 9**
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { ResponsiveTable } from '../ResponsiveTable';

class MockResizeObserver {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe() { this.callback([], this); }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => { vi.stubGlobal('ResizeObserver', MockResizeObserver); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const minWidthArbitrary = fc.integer({ min: 100, max: 2000 }).map(n => n + 'px');
const ariaLabelArbitrary = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,20}$/).filter(s => s.length > 0 && s.trim() === s);
const columnCountArbitrary = fc.integer({ min: 1, max: 10 });
const rowCountArbitrary = fc.integer({ min: 0, max: 20 });
const showScrollIndicatorArbitrary = fc.boolean();
const classNameArbitrary = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,20}$/);

function createTable(columns: number, rows: number): JSX.Element {
  return (
    <table data-testid="test-table">
      <thead><tr>{Array.from({ length: columns }, (_, i) => <th key={i}>Col {i}</th>)}</tr></thead>
      <tbody>{Array.from({ length: rows }, (_, r) => <tr key={r}>{Array.from({ length: columns }, (_, c) => <td key={c}>Cell</td>)}</tr>)}</tbody>
    </table>
  );
}

describe('ResponsiveTable Property Tests', () => {
  describe('Container Structure', () => {
    it('renders with scrollable container', () => {
      fc.assert(fc.property(minWidthArbitrary, columnCountArbitrary, (minWidth, cols) => {
        cleanup();
        render(<ResponsiveTable minWidth={minWidth}>{createTable(cols, 3)}</ResponsiveTable>);
        expect(screen.getByRole('region')).toBeInTheDocument();
        expect(screen.getByTestId('test-table')).toBeInTheDocument();
      }), { numRuns: 20 });
    });

    it('applies minWidth CSS variable', () => {
      fc.assert(fc.property(minWidthArbitrary, (minWidth) => {
        cleanup();
        render(<ResponsiveTable minWidth={minWidth}>{createTable(3, 3)}</ResponsiveTable>);
        expect(screen.getByRole('region').getAttribute('style')).toContain('--table-min-width: ' + minWidth);
      }), { numRuns: 15 });
    });
  });

  describe('Accessibility', () => {
    it('has role=region', () => {
      fc.assert(fc.property(showScrollIndicatorArbitrary, (show) => {
        cleanup();
        render(<ResponsiveTable showScrollIndicator={show}>{createTable(3, 3)}</ResponsiveTable>);
        expect(screen.getByRole('region')).toBeInTheDocument();
      }), { numRuns: 10 });
    });

    it('applies custom aria-label', () => {
      fc.assert(fc.property(ariaLabelArbitrary, (label) => {
        cleanup();
        render(<ResponsiveTable aria-label={label}>{createTable(3, 3)}</ResponsiveTable>);
        const container = screen.getByRole('region');
        expect(container).toHaveAttribute('aria-label', label);
      }), { numRuns: 15 });
    });

    it('has tabIndex=0', () => {
      cleanup();
      render(<ResponsiveTable>{createTable(3, 3)}</ResponsiveTable>);
      expect(screen.getByRole('region')).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Content Rendering', () => {
    it('renders correct column count', () => {
      fc.assert(fc.property(columnCountArbitrary, (cols) => {
        cleanup();
        render(<ResponsiveTable>{createTable(cols, 2)}</ResponsiveTable>);
        expect(screen.getByTestId('test-table').querySelectorAll('th').length).toBe(cols);
      }), { numRuns: 15 });
    });

    it('renders correct row count', () => {
      fc.assert(fc.property(rowCountArbitrary, (rows) => {
        cleanup();
        render(<ResponsiveTable>{createTable(3, rows)}</ResponsiveTable>);
        expect(screen.getByTestId('test-table').querySelectorAll('tbody tr').length).toBe(rows);
      }), { numRuns: 15 });
    });
  });

  describe('Keyboard Focus', () => {
    it('container receives focus via Tab', async () => {
      const user = userEvent.setup();
      cleanup();
      render(<ResponsiveTable>{createTable(3, 3)}</ResponsiveTable>);
      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole('region'));
    });
  });
});
