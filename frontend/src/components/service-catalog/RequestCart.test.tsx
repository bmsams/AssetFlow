import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RequestCart } from './RequestCart';
import type { CartItem, CatalogItem } from '../../types/service-catalog';

const mockCatalogItem: CatalogItem = {
  itemId: 'cat-001',
  name: 'MacBook Pro 16"',
  description: 'High-performance laptop',
  category: 'LAPTOPS',
  manufacturer: 'Apple',
  model: 'MacBook Pro 16" (2024)',
  price: 3499,
  availability: 'IN_STOCK',
  stockQuantity: 15,
  leadTimeDays: 0,
  specifications: {},
  tags: [],
};

const mockCartItems: CartItem[] = [
  {
    itemId: 'cat-001',
    catalogItem: mockCatalogItem,
    quantity: 2,
    justification: '',
    deliveryLocation: '',
  },
  {
    itemId: 'cat-002',
    catalogItem: {
      ...mockCatalogItem,
      itemId: 'cat-002',
      name: 'Dell Monitor',
      price: 799,
    },
    quantity: 1,
    justification: '',
    deliveryLocation: '',
  },
];

describe('RequestCart', () => {
  const defaultProps = {
    items: mockCartItems,
    onQuantityChange: vi.fn(),
    onRemoveItem: vi.fn(),
    onClearCart: vi.fn(),
    onSubmitRequest: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders cart title', () => {
    render(<RequestCart {...defaultProps} />);
    expect(screen.getByText('Request Cart')).toBeInTheDocument();
  });

  it('displays item count badge', () => {
    render(<RequestCart {...defaultProps} />);
    // Total quantity: 2 + 1 = 3
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('displays total price', () => {
    render(<RequestCart {...defaultProps} />);
    // Total: (3499 * 2) + (799 * 1) = 7797
    expect(screen.getByText('$7,797')).toBeInTheDocument();
  });

  it('shows empty state when cart is empty', () => {
    render(<RequestCart {...defaultProps} items={[]} />);
    expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
  });

  it('expands cart when header is clicked', () => {
    render(<RequestCart {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Request Cart'));
    
    expect(screen.getByText('MacBook Pro 16"')).toBeInTheDocument();
    expect(screen.getByText('Dell Monitor')).toBeInTheDocument();
  });

  it('displays item names in expanded cart', () => {
    render(<RequestCart {...defaultProps} />);
    fireEvent.click(screen.getByText('Request Cart'));
    
    expect(screen.getByText('MacBook Pro 16"')).toBeInTheDocument();
    expect(screen.getByText('Dell Monitor')).toBeInTheDocument();
  });

  it('displays item quantities', () => {
    render(<RequestCart {...defaultProps} />);
    fireEvent.click(screen.getByText('Request Cart'));
    
    expect(screen.getByText('2')).toBeInTheDocument(); // MacBook quantity
  });

  it('displays item prices', () => {
    render(<RequestCart {...defaultProps} />);
    fireEvent.click(screen.getByText('Request Cart'));
    
    expect(screen.getByText('$3,499 each')).toBeInTheDocument();
    expect(screen.getByText('$799 each')).toBeInTheDocument();
  });

  it('displays item totals', () => {
    render(<RequestCart {...defaultProps} />);
    fireEvent.click(screen.getByText('Request Cart'));
    
    expect(screen.getByText('$6,998')).toBeInTheDocument(); // 3499 * 2
    expect(screen.getByText('$799')).toBeInTheDocument(); // 799 * 1
  });

  it('calls onQuantityChange when increase button is clicked', () => {
    const handleQuantityChange = vi.fn();
    render(<RequestCart {...defaultProps} onQuantityChange={handleQuantityChange} />);
    fireEvent.click(screen.getByText('Request Cart'));
    
    const increaseButtons = screen.getAllByLabelText('Increase quantity');
    fireEvent.click(increaseButtons[0]);
    
    expect(handleQuantityChange).toHaveBeenCalledWith('cat-001', 3);
  });

  it('calls onQuantityChange when decrease button is clicked', () => {
    const handleQuantityChange = vi.fn();
    render(<RequestCart {...defaultProps} onQuantityChange={handleQuantityChange} />);
    fireEvent.click(screen.getByText('Request Cart'));
    
    const decreaseButtons = screen.getAllByLabelText('Decrease quantity');
    fireEvent.click(decreaseButtons[0]);
    
    expect(handleQuantityChange).toHaveBeenCalledWith('cat-001', 1);
  });

  it('disables decrease button when quantity is 1', () => {
    const singleItemCart: CartItem[] = [
      { ...mockCartItems[0], quantity: 1 },
    ];
    render(<RequestCart {...defaultProps} items={singleItemCart} />);
    fireEvent.click(screen.getByText('Request Cart'));
    
    const decreaseButton = screen.getByLabelText('Decrease quantity');
    expect(decreaseButton).toBeDisabled();
  });

  it('calls onRemoveItem when remove button is clicked', () => {
    const handleRemove = vi.fn();
    render(<RequestCart {...defaultProps} onRemoveItem={handleRemove} />);
    fireEvent.click(screen.getByText('Request Cart'));
    
    const removeButton = screen.getByLabelText(/Remove MacBook Pro.*from cart/);
    fireEvent.click(removeButton);
    
    expect(handleRemove).toHaveBeenCalledWith('cat-001');
  });

  it('calls onClearCart when clear cart button is clicked', () => {
    const handleClear = vi.fn();
    render(<RequestCart {...defaultProps} onClearCart={handleClear} />);
    fireEvent.click(screen.getByText('Request Cart'));
    
    fireEvent.click(screen.getByText('Clear Cart'));
    
    expect(handleClear).toHaveBeenCalled();
  });

  it('shows submit form when proceed button is clicked', () => {
    render(<RequestCart {...defaultProps} />);
    fireEvent.click(screen.getByText('Request Cart'));
    fireEvent.click(screen.getByText('Proceed to Submit'));
    
    expect(screen.getByLabelText('Priority')).toBeInTheDocument();
    expect(screen.getByLabelText(/Required By/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Notes/)).toBeInTheDocument();
  });

  it('allows selecting priority', () => {
    render(<RequestCart {...defaultProps} />);
    fireEvent.click(screen.getByText('Request Cart'));
    fireEvent.click(screen.getByText('Proceed to Submit'));
    
    const prioritySelect = screen.getByLabelText('Priority');
    fireEvent.change(prioritySelect, { target: { value: 'HIGH' } });
    
    expect(prioritySelect).toHaveValue('HIGH');
  });

  it('calls onSubmitRequest when submit button is clicked', () => {
    const handleSubmit = vi.fn();
    render(<RequestCart {...defaultProps} onSubmitRequest={handleSubmit} />);
    fireEvent.click(screen.getByText('Request Cart'));
    fireEvent.click(screen.getByText('Proceed to Submit'));
    fireEvent.click(screen.getByText('Submit Request'));
    
    expect(handleSubmit).toHaveBeenCalledWith({
      items: mockCartItems,
      priority: 'MEDIUM',
      notes: undefined,
      requiredByDate: undefined,
    });
  });

  it('includes notes in submission when provided', () => {
    const handleSubmit = vi.fn();
    render(<RequestCart {...defaultProps} onSubmitRequest={handleSubmit} />);
    fireEvent.click(screen.getByText('Request Cart'));
    fireEvent.click(screen.getByText('Proceed to Submit'));
    
    const notesInput = screen.getByLabelText(/Notes/);
    fireEvent.change(notesInput, { target: { value: 'Urgent need for project' } });
    
    fireEvent.click(screen.getByText('Submit Request'));
    
    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'Urgent need for project' })
    );
  });

  it('hides submit form when cancel is clicked', () => {
    render(<RequestCart {...defaultProps} />);
    fireEvent.click(screen.getByText('Request Cart'));
    fireEvent.click(screen.getByText('Proceed to Submit'));
    fireEvent.click(screen.getByText('Cancel'));
    
    expect(screen.queryByLabelText('Priority')).not.toBeInTheDocument();
    expect(screen.getByText('Proceed to Submit')).toBeInTheDocument();
  });

  it('shows loading state when submitting', () => {
    render(<RequestCart {...defaultProps} isSubmitting />);
    fireEvent.click(screen.getByText('Request Cart'));
    fireEvent.click(screen.getByText('Proceed to Submit'));
    
    expect(screen.getByText('Submitting...')).toBeInTheDocument();
  });

  it('disables submit button when submitting', () => {
    render(<RequestCart {...defaultProps} isSubmitting />);
    fireEvent.click(screen.getByText('Request Cart'));
    fireEvent.click(screen.getByText('Proceed to Submit'));
    
    expect(screen.getByText('Submitting...')).toBeDisabled();
  });

  it('has accessible expand/collapse button', () => {
    render(<RequestCart {...defaultProps} />);
    
    const headerButton = screen.getByRole('button', { expanded: false });
    expect(headerButton).toHaveAttribute('aria-controls', 'cart-content');
  });
});

describe('RequestCart - Requirements Validation', () => {
  /**
   * Validates Requirement 6B.3: Request submission flow
   */
  it('supports request submission flow (Requirement 6B.3)', () => {
    const handleSubmit = vi.fn();
    render(
      <RequestCart
        items={mockCartItems}
        onQuantityChange={vi.fn()}
        onRemoveItem={vi.fn()}
        onClearCart={vi.fn()}
        onSubmitRequest={handleSubmit}
      />
    );
    
    // Expand cart
    fireEvent.click(screen.getByText('Request Cart'));
    
    // Proceed to submit
    fireEvent.click(screen.getByText('Proceed to Submit'));
    
    // Fill in priority
    const prioritySelect = screen.getByLabelText('Priority');
    fireEvent.change(prioritySelect, { target: { value: 'HIGH' } });
    
    // Submit request
    fireEvent.click(screen.getByText('Submit Request'));
    
    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        items: mockCartItems,
        priority: 'HIGH',
      })
    );
  });

  /**
   * Validates Requirement 6B.3: Cart displays items with quantities
   */
  it('displays cart items with quantities (Requirement 6B.3)', () => {
    render(
      <RequestCart
        items={mockCartItems}
        onQuantityChange={vi.fn()}
        onRemoveItem={vi.fn()}
        onClearCart={vi.fn()}
        onSubmitRequest={vi.fn()}
      />
    );
    
    // Expand cart
    fireEvent.click(screen.getByText('Request Cart'));
    
    // Verify items are displayed
    expect(screen.getByText('MacBook Pro 16"')).toBeInTheDocument();
    expect(screen.getByText('Dell Monitor')).toBeInTheDocument();
    
    // Verify quantities are displayed
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
