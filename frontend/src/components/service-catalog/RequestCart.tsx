import { useState, useCallback } from 'react';
import type { HTMLAttributes } from 'react';
import type { CartItem, CatalogRequestSubmission } from '../../types/service-catalog';
import { formatCatalogPrice } from '../../types/service-catalog';
import styles from './RequestCart.module.css';

export interface RequestCartProps extends HTMLAttributes<HTMLDivElement> {
  /** Items in the cart */
  items: CartItem[];
  /** Callback when item quantity changes */
  onQuantityChange: (itemId: string, quantity: number) => void;
  /** Callback when item is removed */
  onRemoveItem: (itemId: string) => void;
  /** Callback when cart is cleared */
  onClearCart: () => void;
  /** Callback when request is submitted */
  onSubmitRequest: (submission: CatalogRequestSubmission) => void;
  /** Loading state for submission */
  isSubmitting?: boolean;
}

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * RequestCart component for managing and submitting catalog requests
 * Implements Requirement 6B.3: Request submission flow
 */
export function RequestCart({
  items,
  onQuantityChange,
  onRemoveItem,
  onClearCart,
  onSubmitRequest,
  isSubmitting = false,
  className = '',
  ...props
}: RequestCartProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [notes, setNotes] = useState('');
  const [requiredByDate, setRequiredByDate] = useState('');
  const [showSubmitForm, setShowSubmitForm] = useState(false);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + item.catalogItem.price * item.quantity,
    0
  );

  const handleSubmit = useCallback(() => {
    onSubmitRequest({
      items,
      priority,
      notes: notes || undefined,
      requiredByDate: requiredByDate || undefined,
    });
  }, [items, priority, notes, requiredByDate, onSubmitRequest]);

  const handleQuantityChange = (itemId: string, delta: number) => {
    const item = items.find((i) => i.itemId === itemId);
    if (item) {
      const newQuantity = Math.max(1, item.quantity + delta);
      onQuantityChange(itemId, newQuantity);
    }
  };

  if (items.length === 0) {
    return (
      <div className={`${styles.cart} ${styles.empty} ${className}`} {...props}>
        <div className={styles.emptyState}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
          </svg>
          <p>Your cart is empty</p>
          <span>Add items from the catalog to get started</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.cart} ${isExpanded ? styles.expanded : ''} ${className}`} {...props}>
      {/* Cart Header */}
      <button
        type="button"
        className={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls="cart-content"
      >
        <div className={styles.headerLeft}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
          </svg>
          <span className={styles.cartTitle}>Request Cart</span>
          <span className={styles.itemBadge}>{totalItems}</span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.totalPrice}>{formatCatalogPrice(totalPrice)}</span>
          <svg
            className={`${styles.chevron} ${isExpanded ? styles.chevronUp : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Cart Content */}
      {isExpanded && (
        <div id="cart-content" className={styles.content}>
          {/* Cart Items */}
          <ul className={styles.itemList} role="list">
            {items.map((item) => (
              <li key={item.itemId} className={styles.cartItem}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{item.catalogItem.name}</span>
                  <span className={styles.itemPrice}>
                    {formatCatalogPrice(item.catalogItem.price)} each
                  </span>
                </div>
                <div className={styles.itemActions}>
                  <div className={styles.quantityControl}>
                    <button
                      type="button"
                      className={styles.quantityButton}
                      onClick={() => handleQuantityChange(item.itemId, -1)}
                      disabled={item.quantity <= 1}
                      aria-label="Decrease quantity"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                    <span className={styles.quantity}>{item.quantity}</span>
                    <button
                      type="button"
                      className={styles.quantityButton}
                      onClick={() => handleQuantityChange(item.itemId, 1)}
                      aria-label="Increase quantity"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>
                  </div>
                  <span className={styles.itemTotal}>
                    {formatCatalogPrice(item.catalogItem.price * item.quantity)}
                  </span>
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => onRemoveItem(item.itemId)}
                    aria-label={`Remove ${item.catalogItem.name} from cart`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* Cart Summary */}
          <div className={styles.summary}>
            <div className={styles.summaryRow}>
              <span>Subtotal ({totalItems} items)</span>
              <span className={styles.summaryValue}>{formatCatalogPrice(totalPrice)}</span>
            </div>
          </div>

          {/* Submit Form */}
          {showSubmitForm ? (
            <div className={styles.submitForm}>
              <div className={styles.formGroup}>
                <label htmlFor="priority" className={styles.formLabel}>
                  Priority
                </label>
                <select
                  id="priority"
                  className={styles.formSelect}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="requiredByDate" className={styles.formLabel}>
                  Required By (optional)
                </label>
                <input
                  type="date"
                  id="requiredByDate"
                  className={styles.formInput}
                  value={requiredByDate}
                  onChange={(e) => setRequiredByDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="notes" className={styles.formLabel}>
                  Notes (optional)
                </label>
                <textarea
                  id="notes"
                  className={styles.formTextarea}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any additional notes or justification..."
                  rows={3}
                />
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setShowSubmitForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.submitButton}
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className={styles.spinner} />
                      Submitting...
                    </>
                  ) : (
                    'Submit Request'
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.cartActions}>
              <button
                type="button"
                className={styles.clearButton}
                onClick={onClearCart}
              >
                Clear Cart
              </button>
              <button
                type="button"
                className={styles.checkoutButton}
                onClick={() => setShowSubmitForm(true)}
              >
                Proceed to Submit
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RequestCart;
