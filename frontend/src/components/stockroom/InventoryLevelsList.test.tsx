import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InventoryLevelsList } from './InventoryLevelsList';
import type { Stockroom } from '../../types/stockroom';

const mockStockrooms: Stockroom[] = [
  {
    stockroomId: 'stockroom-001',
    name: 'Main IT Stockroom',
    location: 'Building A, Floor 1',
    stockroomType: 'IT',
    managerName: 'John Smith',
    managerId: 'user-001',
    isActive: true,
    totalItems: 1247,
    totalValue: 2450000,
    utilizationPercentage: 78,
  },
  {
    stockroomId: 'stockroom-002',
    name: 'Data Center Receiving',
    location: 'Data Center, Dock B',
    stockroomType: 'DATA_CENTER',
    managerName: 'Sarah Johnson',
    managerId: 'user-002',
    isActive: true,
    totalItems: 523,
    totalValue: 1850000,
    utilizationPercentage: 65,
  },
];

describe('InventoryLevelsList', () => {
  it('renders the title', () => {
    render(<InventoryLevelsList stockrooms={mockStockrooms} />);
    expect(screen.getByText('Inventory Levels')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<InventoryLevelsList stockrooms={mockStockrooms} title="My Stockrooms" />);
    expect(screen.getByText('My Stockrooms')).toBeInTheDocument();
  });

  it('displays location count badge', () => {
    render(<InventoryLevelsList stockrooms={mockStockrooms} />);
    expect(screen.getByText('2 locations')).toBeInTheDocument();
  });

  it('renders stockroom items', () => {
    render(<InventoryLevelsList stockrooms={mockStockrooms} />);
    expect(screen.getByText('Main IT Stockroom')).toBeInTheDocument();
    expect(screen.getByText('Data Center Receiving')).toBeInTheDocument();
  });

  it('displays stockroom locations', () => {
    render(<InventoryLevelsList stockrooms={mockStockrooms} />);
    expect(screen.getByText('Building A, Floor 1')).toBeInTheDocument();
    expect(screen.getByText('Data Center, Dock B')).toBeInTheDocument();
  });

  it('displays stockroom types', () => {
    render(<InventoryLevelsList stockrooms={mockStockrooms} />);
    expect(screen.getByText('IT Stockroom')).toBeInTheDocument();
    expect(screen.getByText('Data Center')).toBeInTheDocument();
  });

  it('displays formatted values', () => {
    render(<InventoryLevelsList stockrooms={mockStockrooms} />);
    expect(screen.getByText('$2,450,000')).toBeInTheDocument();
    expect(screen.getByText('$1,850,000')).toBeInTheDocument();
  });

  it('displays item counts', () => {
    render(<InventoryLevelsList stockrooms={mockStockrooms} />);
    expect(screen.getByText('1,247 items')).toBeInTheDocument();
    expect(screen.getByText('523 items')).toBeInTheDocument();
  });

  it('displays manager names', () => {
    render(<InventoryLevelsList stockrooms={mockStockrooms} />);
    expect(screen.getByText('Managed by John Smith')).toBeInTheDocument();
    expect(screen.getByText('Managed by Sarah Johnson')).toBeInTheDocument();
  });

  it('displays utilization percentages', () => {
    render(<InventoryLevelsList stockrooms={mockStockrooms} />);
    expect(screen.getByText('78%')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<InventoryLevelsList stockrooms={[]} isLoading />);
    expect(screen.getByRole('generic', { busy: true })).toBeInTheDocument();
  });

  it('shows empty state when no stockrooms', () => {
    render(<InventoryLevelsList stockrooms={[]} />);
    expect(screen.getByText('No stockrooms configured')).toBeInTheDocument();
  });

  it('calls onStockroomClick when item is clicked', () => {
    const handleClick = vi.fn();
    render(<InventoryLevelsList stockrooms={mockStockrooms} onStockroomClick={handleClick} />);
    
    const firstItem = screen.getByLabelText(/View Main IT Stockroom inventory details/);
    fireEvent.click(firstItem);
    
    expect(handleClick).toHaveBeenCalledWith(mockStockrooms[0]);
  });

  it('limits displayed items based on maxItems', () => {
    const manyStockrooms = Array.from({ length: 10 }, (_, i) => ({
      ...mockStockrooms[0],
      stockroomId: `stockroom-${i}`,
      name: `Stockroom ${i}`,
    }));
    
    render(
      <InventoryLevelsList 
        stockrooms={manyStockrooms} 
        maxItems={3} 
        onViewAll={() => {}} 
      />
    );
    
    expect(screen.getByText('View all 10 stockrooms')).toBeInTheDocument();
  });

  it('calls onViewAll when view all button is clicked', () => {
    const handleViewAll = vi.fn();
    const manyStockrooms = Array.from({ length: 10 }, (_, i) => ({
      ...mockStockrooms[0],
      stockroomId: `stockroom-${i}`,
      name: `Stockroom ${i}`,
    }));
    
    render(
      <InventoryLevelsList 
        stockrooms={manyStockrooms} 
        maxItems={3} 
        onViewAll={handleViewAll} 
      />
    );
    
    fireEvent.click(screen.getByText('View all 10 stockrooms'));
    expect(handleViewAll).toHaveBeenCalled();
  });

  it('has accessible item labels', () => {
    render(<InventoryLevelsList stockrooms={mockStockrooms} />);
    expect(screen.getByLabelText('View Main IT Stockroom inventory details')).toBeInTheDocument();
  });

  it('renders progress bars with correct aria attributes', () => {
    render(<InventoryLevelsList stockrooms={mockStockrooms} />);
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBe(2);
    expect(progressBars[0]).toHaveAttribute('aria-valuenow', '78');
  });
});

describe('InventoryLevelsList - Requirements Validation', () => {
  /**
   * Validates Requirement 12.4: Display inventory levels by stockroom
   */
  it('displays inventory levels by stockroom (Requirement 12.4)', () => {
    render(<InventoryLevelsList stockrooms={mockStockrooms} />);
    
    // Verify stockrooms are displayed with inventory information
    expect(screen.getByText('Main IT Stockroom')).toBeInTheDocument();
    expect(screen.getByText('1,247 items')).toBeInTheDocument();
    expect(screen.getByText('$2,450,000')).toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();
  });

  /**
   * Validates Requirement 12.4: Multiple stockroom locations
   */
  it('displays multiple stockroom locations (Requirement 12.4)', () => {
    render(<InventoryLevelsList stockrooms={mockStockrooms} />);
    
    // Verify multiple stockrooms are shown
    expect(screen.getByText('Main IT Stockroom')).toBeInTheDocument();
    expect(screen.getByText('Data Center Receiving')).toBeInTheDocument();
    expect(screen.getByText('2 locations')).toBeInTheDocument();
  });
});
