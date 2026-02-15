import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReplenishmentAlertsList } from './ReplenishmentAlertsList';
import type { ReplenishmentAlert } from '../../types/stockroom';

const mockAlerts: ReplenishmentAlert[] = [
  {
    alertId: 'alert-001',
    stockroomId: 'stockroom-001',
    stockroomName: 'Main IT Stockroom',
    productId: 'product-001',
    productName: 'Dell Latitude 5540 Laptop',
    productCategory: 'Laptop',
    currentQuantity: 3,
    reorderPoint: 10,
    reorderQuantity: 25,
    severity: 'critical',
    daysUntilStockout: 2,
    suggestedAction: 'Create purchase order immediately',
    createdAt: '2025-01-26T08:00:00Z',
  },
  {
    alertId: 'alert-002',
    stockroomId: 'stockroom-001',
    stockroomName: 'Main IT Stockroom',
    productId: 'product-002',
    productName: 'HP LaserJet Pro MFP',
    productCategory: 'Printer',
    currentQuantity: 5,
    reorderPoint: 8,
    reorderQuantity: 15,
    severity: 'warning',
    daysUntilStockout: 7,
    suggestedAction: 'Review and create purchase order',
    createdAt: '2025-01-25T14:30:00Z',
  },
  {
    alertId: 'alert-003',
    stockroomId: 'stockroom-002',
    stockroomName: 'Data Center',
    productId: 'product-003',
    productName: 'Server RAM Module',
    productCategory: 'Component',
    currentQuantity: 10,
    reorderPoint: 12,
    reorderQuantity: 20,
    severity: 'info',
    daysUntilStockout: 21,
    suggestedAction: 'Monitor stock levels',
    createdAt: '2025-01-24T10:00:00Z',
  },
];

describe('ReplenishmentAlertsList', () => {
  it('renders the title', () => {
    render(<ReplenishmentAlertsList alerts={mockAlerts} />);
    expect(screen.getByText('Replenishment Alerts')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<ReplenishmentAlertsList alerts={mockAlerts} title="Stock Alerts" />);
    expect(screen.getByText('Stock Alerts')).toBeInTheDocument();
  });

  it('displays severity badges', () => {
    render(<ReplenishmentAlertsList alerts={mockAlerts} />);
    expect(screen.getByText('1 critical')).toBeInTheDocument();
    expect(screen.getByText('1 warning')).toBeInTheDocument();
  });

  it('renders alert items', () => {
    render(<ReplenishmentAlertsList alerts={mockAlerts} />);
    expect(screen.getByText('Dell Latitude 5540 Laptop')).toBeInTheDocument();
    expect(screen.getByText('HP LaserJet Pro MFP')).toBeInTheDocument();
  });

  it('displays product categories', () => {
    render(<ReplenishmentAlertsList alerts={mockAlerts} />);
    expect(screen.getByText('Laptop')).toBeInTheDocument();
    expect(screen.getByText('Printer')).toBeInTheDocument();
  });

  it('displays stock levels', () => {
    render(<ReplenishmentAlertsList alerts={mockAlerts} />);
    // Current stock values - use getAllByText since numbers may appear multiple times
    const threeElements = screen.getAllByText('3');
    expect(threeElements.length).toBeGreaterThan(0);
    const fiveElements = screen.getAllByText('5');
    expect(fiveElements.length).toBeGreaterThan(0);
    // Reorder points
    const tenElements = screen.getAllByText('10');
    expect(tenElements.length).toBeGreaterThan(0);
    const eightElements = screen.getAllByText('8');
    expect(eightElements.length).toBeGreaterThan(0);
  });

  it('displays stockroom names', () => {
    render(<ReplenishmentAlertsList alerts={mockAlerts} />);
    const stockroomElements = screen.getAllByText('Main IT Stockroom');
    expect(stockroomElements.length).toBeGreaterThan(0);
  });

  it('displays stockout warnings', () => {
    render(<ReplenishmentAlertsList alerts={mockAlerts} />);
    expect(screen.getByText('Stockout in 2 days!')).toBeInTheDocument();
    expect(screen.getByText('~7 days until stockout')).toBeInTheDocument();
  });

  it('displays suggested actions', () => {
    render(<ReplenishmentAlertsList alerts={mockAlerts} />);
    expect(screen.getByText('Create purchase order immediately')).toBeInTheDocument();
    expect(screen.getByText('Review and create purchase order')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<ReplenishmentAlertsList alerts={[]} isLoading />);
    expect(screen.getByRole('generic', { busy: true })).toBeInTheDocument();
  });

  it('shows empty state when no alerts', () => {
    render(<ReplenishmentAlertsList alerts={[]} />);
    expect(screen.getByText('All stock levels are healthy')).toBeInTheDocument();
  });

  it('calls onAlertClick when item is clicked', () => {
    const handleClick = vi.fn();
    render(<ReplenishmentAlertsList alerts={mockAlerts} onAlertClick={handleClick} />);
    
    const firstItem = screen.getByLabelText(/View alert for Dell Latitude 5540 Laptop/);
    fireEvent.click(firstItem);
    
    expect(handleClick).toHaveBeenCalledWith(mockAlerts[0]);
  });

  it('shows create order button for critical/warning alerts', () => {
    const handleCreateOrder = vi.fn();
    render(<ReplenishmentAlertsList alerts={mockAlerts} onCreateOrder={handleCreateOrder} />);
    
    const createOrderButtons = screen.getAllByText('Create Order');
    expect(createOrderButtons.length).toBe(2); // Only for critical and warning
  });

  it('calls onCreateOrder when create order button is clicked', () => {
    const handleCreateOrder = vi.fn();
    render(<ReplenishmentAlertsList alerts={mockAlerts} onCreateOrder={handleCreateOrder} />);
    
    const createOrderButton = screen.getByLabelText('Create purchase order for Dell Latitude 5540 Laptop');
    fireEvent.click(createOrderButton);
    
    expect(handleCreateOrder).toHaveBeenCalledWith(mockAlerts[0]);
  });

  it('shows dismiss button for critical/warning alerts', () => {
    const handleDismiss = vi.fn();
    render(<ReplenishmentAlertsList alerts={mockAlerts} onDismiss={handleDismiss} />);
    
    const dismissButtons = screen.getAllByText('Dismiss');
    expect(dismissButtons.length).toBe(2); // Only for critical and warning
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const handleDismiss = vi.fn();
    render(<ReplenishmentAlertsList alerts={mockAlerts} onDismiss={handleDismiss} />);
    
    const dismissButton = screen.getByLabelText('Dismiss alert for Dell Latitude 5540 Laptop');
    fireEvent.click(dismissButton);
    
    expect(handleDismiss).toHaveBeenCalledWith(mockAlerts[0]);
  });

  it('limits displayed items based on maxItems', () => {
    const manyAlerts = Array.from({ length: 10 }, (_, i) => ({
      ...mockAlerts[0],
      alertId: `alert-${i}`,
      productName: `Product ${i}`,
    }));
    
    render(
      <ReplenishmentAlertsList 
        alerts={manyAlerts} 
        maxItems={3} 
        onViewAll={() => {}} 
      />
    );
    
    expect(screen.getByText('View all 10 alerts')).toBeInTheDocument();
  });

  it('calls onViewAll when view all button is clicked', () => {
    const handleViewAll = vi.fn();
    const manyAlerts = Array.from({ length: 10 }, (_, i) => ({
      ...mockAlerts[0],
      alertId: `alert-${i}`,
      productName: `Product ${i}`,
    }));
    
    render(
      <ReplenishmentAlertsList 
        alerts={manyAlerts} 
        maxItems={3} 
        onViewAll={handleViewAll} 
      />
    );
    
    fireEvent.click(screen.getByText('View all 10 alerts'));
    expect(handleViewAll).toHaveBeenCalled();
  });

  it('has accessible item labels', () => {
    render(<ReplenishmentAlertsList alerts={mockAlerts} />);
    expect(screen.getByLabelText('View alert for Dell Latitude 5540 Laptop')).toBeInTheDocument();
  });
});

describe('ReplenishmentAlertsList - Requirements Validation', () => {
  /**
   * Validates Requirement 12.4: Display replenishment alerts
   */
  it('displays replenishment alerts (Requirement 12.4)', () => {
    render(<ReplenishmentAlertsList alerts={mockAlerts} />);
    
    // Verify alerts are displayed
    expect(screen.getByText('Dell Latitude 5540 Laptop')).toBeInTheDocument();
    expect(screen.getByText('HP LaserJet Pro MFP')).toBeInTheDocument();
    
    // Verify severity indicators
    expect(screen.getByText('1 critical')).toBeInTheDocument();
    expect(screen.getByText('1 warning')).toBeInTheDocument();
  });

  /**
   * Validates Requirement 12.4: Stock level information
   */
  it('displays stock level information (Requirement 12.4)', () => {
    render(<ReplenishmentAlertsList alerts={mockAlerts} />);
    
    // Verify stock levels are shown (use getAllByText since numbers may appear multiple times)
    const threeElements = screen.getAllByText('3'); // Current quantity
    expect(threeElements.length).toBeGreaterThan(0);
    const tenElements = screen.getAllByText('10'); // Reorder point
    expect(tenElements.length).toBeGreaterThan(0);
    const twentyFiveElements = screen.getAllByText('25'); // Reorder quantity
    expect(twentyFiveElements.length).toBeGreaterThan(0);
  });

  /**
   * Validates Requirement 12.4: Actionable alerts
   */
  it('provides actionable alerts (Requirement 12.4)', () => {
    const handleCreateOrder = vi.fn();
    render(<ReplenishmentAlertsList alerts={mockAlerts} onCreateOrder={handleCreateOrder} />);
    
    // Verify action buttons exist
    const createOrderButtons = screen.getAllByText('Create Order');
    expect(createOrderButtons.length).toBeGreaterThan(0);
    
    // Verify suggested actions are shown
    expect(screen.getByText('Create purchase order immediately')).toBeInTheDocument();
  });

  /**
   * Validates Requirement 12.4: Stockout warnings
   */
  it('displays stockout warnings (Requirement 12.4)', () => {
    render(<ReplenishmentAlertsList alerts={mockAlerts} />);
    
    // Verify stockout warnings are shown
    expect(screen.getByText('Stockout in 2 days!')).toBeInTheDocument();
    expect(screen.getByText('~7 days until stockout')).toBeInTheDocument();
  });
});
