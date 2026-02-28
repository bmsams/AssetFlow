/**
 * Property Test: Stock Level Alert Generation
 *
 * **Validates: Requirements 3.3**
 *
 * Property 7: For any stockroom inventory item, WHEN the quantity_available
 * falls below the reorder_point, THEN a replenishment alert SHALL be generated
 * with the configured reorder_quantity.
 *
 * Requirements:
 * - 3.3: WHEN inventory quantity falls below the reorder_point, THE Stockroom_Manager
 *        SHALL generate a replenishment alert with recommended reorder_quantity.
 *
 * Properties tested:
 * 1. Alert generation: When quantity <= reorder_point, an alert is generated
 * 2. Alert contains correct reorder_quantity from inventory configuration
 * 3. Alert type is correctly determined based on stock level severity
 * 4. Alert priority is correctly determined based on shortfall percentage
 * 5. No alert when quantity > reorder_point
 * 6. No alert when reorder_point is not configured (null)
 * 7. Shortfall calculation is correct (reorder_point - quantity_on_hand)
 */

import * as fc from 'fast-check';

// ============================================================================
// Types for Alert Generation Simulation
// ============================================================================

/**
 * Represents an inventory item with stock level configuration
 */
interface InventoryItem {
  readonly inventoryId: string;
  readonly stockroomId: string;
  readonly stockroomName: string;
  readonly productId: string | null;
  readonly productType: ProductType;
  readonly productSku: string | null;
  readonly productDescription: string | null;
  readonly quantityOnHand: number;
  readonly quantityAvailable: number;
  readonly reorderPoint: number | null;
  readonly reorderQuantity: number | null;
}

/**
 * Product types for inventory
 */
type ProductType =
  | 'HARDWARE_MODEL'
  | 'SOFTWARE_PRODUCT'
  | 'SPARE_PART'
  | 'CONSUMABLE'
  | 'ACCESSORY'
  | 'OTHER';


/**
 * Alert types based on stock level severity
 */
type AlertType = 'LOW_STOCK' | 'OUT_OF_STOCK' | 'CRITICAL';

/**
 * Alert priority levels
 */
type AlertPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Replenishment alert structure
 */
interface ReplenishmentAlert {
  readonly alertId: string;
  readonly alertType: AlertType;
  readonly stockroomId: string;
  readonly stockroomName: string;
  readonly inventoryId: string;
  readonly productId: string | null;
  readonly productType: ProductType;
  readonly productSku: string | null;
  readonly productDescription: string | null;
  readonly currentQuantity: number;
  readonly reorderPoint: number;
  readonly reorderQuantity: number | null;
  readonly shortfall: number;
  readonly priority: AlertPriority;
  readonly createdAt: string;
}

// ============================================================================
// Alert Generation Logic (Pure Functions for Testing)
// ============================================================================

/**
 * Determine if an alert should be generated for an inventory item
 * Alert is generated when quantity_on_hand <= reorder_point
 */
function shouldGenerateAlert(item: InventoryItem): boolean {
  // No alert if reorder_point is not configured
  if (item.reorderPoint === null) {
    return false;
  }
  // Alert when quantity is at or below reorder point
  return item.quantityOnHand <= item.reorderPoint;
}

/**
 * Determine alert type based on stock levels
 * - OUT_OF_STOCK: quantity is 0
 * - CRITICAL: quantity is below 25% of reorder point
 * - LOW_STOCK: quantity is at or below reorder point
 */
function determineAlertType(quantityOnHand: number, reorderPoint: number): AlertType {
  if (quantityOnHand === 0) {
    return 'OUT_OF_STOCK';
  }
  // Critical if below 25% of reorder point
  if (quantityOnHand < reorderPoint * 0.25) {
    return 'CRITICAL';
  }
  return 'LOW_STOCK';
}


/**
 * Determine alert priority based on shortfall percentage
 * - CRITICAL: quantity is 0 or below 25% of reorder point
 * - HIGH: quantity is below 50% of reorder point
 * - MEDIUM: quantity is below 75% of reorder point
 * - LOW: quantity is at or below reorder point but above 75%
 */
function determineAlertPriority(quantityOnHand: number, reorderPoint: number): AlertPriority {
  if (quantityOnHand === 0) {
    return 'CRITICAL';
  }
  const percentageOfReorderPoint = (quantityOnHand / reorderPoint) * 100;
  if (percentageOfReorderPoint < 25) {
    return 'CRITICAL';
  }
  if (percentageOfReorderPoint < 50) {
    return 'HIGH';
  }
  if (percentageOfReorderPoint < 75) {
    return 'MEDIUM';
  }
  return 'LOW';
}

/**
 * Calculate shortfall (how much below reorder point)
 */
function calculateShortfall(quantityOnHand: number, reorderPoint: number): number {
  return reorderPoint - quantityOnHand;
}

/**
 * Generate a unique alert ID
 */
function generateAlertId(): string {
  return `ALERT-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a replenishment alert from an inventory item
 * Returns null if no alert should be generated
 */
function createReplenishmentAlert(item: InventoryItem): ReplenishmentAlert | null {
  if (!shouldGenerateAlert(item)) {
    return null;
  }

  const reorderPoint = item.reorderPoint!; // Safe because shouldGenerateAlert checks this

  return {
    alertId: generateAlertId(),
    alertType: determineAlertType(item.quantityOnHand, reorderPoint),
    stockroomId: item.stockroomId,
    stockroomName: item.stockroomName,
    inventoryId: item.inventoryId,
    productId: item.productId,
    productType: item.productType,
    productSku: item.productSku,
    productDescription: item.productDescription,
    currentQuantity: item.quantityOnHand,
    reorderPoint: reorderPoint,
    reorderQuantity: item.reorderQuantity,
    shortfall: calculateShortfall(item.quantityOnHand, reorderPoint),
    priority: determineAlertPriority(item.quantityOnHand, reorderPoint),
    createdAt: new Date().toISOString(),
  };
}


// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate a valid UUID-like string
 */
const uuidArb = fc.uuid();

/**
 * Generate a product type
 */
const productTypeArb: fc.Arbitrary<ProductType> = fc.constantFrom(
  'HARDWARE_MODEL',
  'SOFTWARE_PRODUCT',
  'SPARE_PART',
  'CONSUMABLE',
  'ACCESSORY',
  'OTHER'
);

/**
 * Generate an inventory item that should trigger an alert
 * (quantity_on_hand <= reorder_point)
 */
const alertTriggeringItemArb: fc.Arbitrary<InventoryItem> = fc
  .record({
    inventoryId: uuidArb,
    stockroomId: uuidArb,
    stockroomName: fc.string({ minLength: 1, maxLength: 50 }),
    productId: fc.option(uuidArb, { nil: null }),
    productType: productTypeArb,
    productSku: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
    productDescription: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
    reorderPoint: fc.integer({ min: 1, max: 1000 }),
    reorderQuantity: fc.option(fc.integer({ min: 1, max: 500 }), { nil: null }),
  })
  .chain((base) =>
    // Generate quantity at or below reorder point
    fc.integer({ min: 0, max: base.reorderPoint }).map((quantityOnHand) => ({
      ...base,
      quantityOnHand,
      quantityAvailable: quantityOnHand, // Simplified: assume no reservations
    }))
  );

/**
 * Generate an inventory item that should NOT trigger an alert
 * (quantity_on_hand > reorder_point)
 */
const nonAlertTriggeringItemArb: fc.Arbitrary<InventoryItem> = fc
  .record({
    inventoryId: uuidArb,
    stockroomId: uuidArb,
    stockroomName: fc.string({ minLength: 1, maxLength: 50 }),
    productId: fc.option(uuidArb, { nil: null }),
    productType: productTypeArb,
    productSku: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
    productDescription: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
    reorderPoint: fc.integer({ min: 1, max: 500 }),
    reorderQuantity: fc.option(fc.integer({ min: 1, max: 500 }), { nil: null }),
  })
  .chain((base) =>
    // Generate quantity above reorder point
    fc.integer({ min: base.reorderPoint + 1, max: base.reorderPoint + 1000 }).map((quantityOnHand) => ({
      ...base,
      quantityOnHand,
      quantityAvailable: quantityOnHand,
    }))
  );


/**
 * Generate an inventory item with no reorder point configured
 */
const noReorderPointItemArb: fc.Arbitrary<InventoryItem> = fc.record({
  inventoryId: uuidArb,
  stockroomId: uuidArb,
  stockroomName: fc.string({ minLength: 1, maxLength: 50 }),
  productId: fc.option(uuidArb, { nil: null }),
  productType: productTypeArb,
  productSku: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  productDescription: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
  quantityOnHand: fc.integer({ min: 0, max: 1000 }),
  quantityAvailable: fc.integer({ min: 0, max: 1000 }),
  reorderPoint: fc.constant(null),
  reorderQuantity: fc.option(fc.integer({ min: 1, max: 500 }), { nil: null }),
});

/**
 * Generate an inventory item with zero quantity (out of stock)
 */
const outOfStockItemArb: fc.Arbitrary<InventoryItem> = fc.record({
  inventoryId: uuidArb,
  stockroomId: uuidArb,
  stockroomName: fc.string({ minLength: 1, maxLength: 50 }),
  productId: fc.option(uuidArb, { nil: null }),
  productType: productTypeArb,
  productSku: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  productDescription: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
  quantityOnHand: fc.constant(0),
  quantityAvailable: fc.constant(0),
  reorderPoint: fc.integer({ min: 1, max: 1000 }),
  reorderQuantity: fc.option(fc.integer({ min: 1, max: 500 }), { nil: null }),
});

/**
 * Generate an inventory item exactly at reorder point
 */
const exactlyAtReorderPointArb: fc.Arbitrary<InventoryItem> = fc
  .record({
    inventoryId: uuidArb,
    stockroomId: uuidArb,
    stockroomName: fc.string({ minLength: 1, maxLength: 50 }),
    productId: fc.option(uuidArb, { nil: null }),
    productType: productTypeArb,
    productSku: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
    productDescription: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
    reorderPoint: fc.integer({ min: 1, max: 1000 }),
    reorderQuantity: fc.option(fc.integer({ min: 1, max: 500 }), { nil: null }),
  })
  .map((base) => ({
    ...base,
    quantityOnHand: base.reorderPoint, // Exactly at reorder point
    quantityAvailable: base.reorderPoint,
  }));


// ============================================================================
// Property Tests
// ============================================================================

describe('Property 7: Stock Level Alert Generation', () => {
  /**
   * **Validates: Requirements 3.3**
   */

  describe('Alert Generation Trigger', () => {
    /**
     * Property: When quantity_on_hand <= reorder_point, an alert SHALL be generated.
     *
     * **Validates: Requirements 3.3**
     */
    it('should generate alert when quantity is at or below reorder point', () => {
      fc.assert(
        fc.property(alertTriggeringItemArb, (item) => {
          const alert = createReplenishmentAlert(item);

          // Alert must be generated
          expect(alert).not.toBeNull();
          expect(alert!.inventoryId).toBe(item.inventoryId);
          expect(alert!.stockroomId).toBe(item.stockroomId);
          expect(alert!.currentQuantity).toBe(item.quantityOnHand);
          expect(alert!.reorderPoint).toBe(item.reorderPoint);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: When quantity_on_hand > reorder_point, NO alert should be generated.
     *
     * **Validates: Requirements 3.3**
     */
    it('should NOT generate alert when quantity is above reorder point', () => {
      fc.assert(
        fc.property(nonAlertTriggeringItemArb, (item) => {
          const alert = createReplenishmentAlert(item);

          // No alert should be generated
          expect(alert).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: When reorder_point is null (not configured), NO alert should be generated.
     *
     * **Validates: Requirements 3.3**
     */
    it('should NOT generate alert when reorder point is not configured', () => {
      fc.assert(
        fc.property(noReorderPointItemArb, (item) => {
          const alert = createReplenishmentAlert(item);

          // No alert should be generated
          expect(alert).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Alert should be generated when quantity is exactly at reorder point.
     *
     * **Validates: Requirements 3.3**
     */
    it('should generate alert when quantity is exactly at reorder point', () => {
      fc.assert(
        fc.property(exactlyAtReorderPointArb, (item) => {
          const alert = createReplenishmentAlert(item);

          // Alert must be generated (at reorder point triggers alert)
          expect(alert).not.toBeNull();
          expect(alert!.currentQuantity).toBe(item.reorderPoint);
          expect(alert!.shortfall).toBe(0); // No shortfall when exactly at reorder point
        }),
        { numRuns: 100 }
      );
    });
  });


  describe('Reorder Quantity in Alert', () => {
    /**
     * Property: Alert SHALL contain the configured reorder_quantity.
     *
     * **Validates: Requirements 3.3**
     */
    it('should include configured reorder quantity in alert', () => {
      fc.assert(
        fc.property(alertTriggeringItemArb, (item) => {
          const alert = createReplenishmentAlert(item);

          expect(alert).not.toBeNull();
          // Alert should contain the same reorder quantity as configured
          expect(alert!.reorderQuantity).toBe(item.reorderQuantity);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Alert should handle null reorder_quantity gracefully.
     *
     * **Validates: Requirements 3.3**
     */
    it('should handle null reorder quantity in alert', () => {
      const itemWithNullReorderQty = fc
        .record({
          inventoryId: uuidArb,
          stockroomId: uuidArb,
          stockroomName: fc.string({ minLength: 1, maxLength: 50 }),
          productId: fc.option(uuidArb, { nil: null }),
          productType: productTypeArb,
          productSku: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
          productDescription: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
          reorderPoint: fc.integer({ min: 10, max: 1000 }),
          reorderQuantity: fc.constant(null),
        })
        .chain((base) =>
          fc.integer({ min: 0, max: base.reorderPoint - 1 }).map((quantityOnHand) => ({
            ...base,
            quantityOnHand,
            quantityAvailable: quantityOnHand,
          }))
        );

      fc.assert(
        fc.property(itemWithNullReorderQty, (item) => {
          const alert = createReplenishmentAlert(item);

          expect(alert).not.toBeNull();
          expect(alert!.reorderQuantity).toBeNull();
        }),
        { numRuns: 50 }
      );
    });
  });


  describe('Alert Type Determination', () => {
    /**
     * Property: Alert type should be OUT_OF_STOCK when quantity is 0.
     *
     * **Validates: Requirements 3.3**
     */
    it('should set alert type to OUT_OF_STOCK when quantity is zero', () => {
      fc.assert(
        fc.property(outOfStockItemArb, (item) => {
          const alert = createReplenishmentAlert(item);

          expect(alert).not.toBeNull();
          expect(alert!.alertType).toBe('OUT_OF_STOCK');
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Alert type should be CRITICAL when quantity < 25% of reorder point.
     *
     * **Validates: Requirements 3.3**
     */
    it('should set alert type to CRITICAL when quantity is below 25% of reorder point', () => {
      const criticalStockArb = fc
        .integer({ min: 100, max: 1000 })
        .chain((reorderPoint) =>
          fc.integer({ min: 1, max: Math.floor(reorderPoint * 0.25) - 1 }).map((quantityOnHand) => ({
            reorderPoint,
            quantityOnHand: Math.max(1, quantityOnHand), // Ensure at least 1 (not out of stock)
          }))
        )
        .filter(({ reorderPoint, quantityOnHand }) => quantityOnHand > 0 && quantityOnHand < reorderPoint * 0.25);

      fc.assert(
        fc.property(criticalStockArb, ({ reorderPoint, quantityOnHand }) => {
          const alertType = determineAlertType(quantityOnHand, reorderPoint);
          expect(alertType).toBe('CRITICAL');
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Alert type should be LOW_STOCK when quantity >= 25% of reorder point.
     *
     * **Validates: Requirements 3.3**
     */
    it('should set alert type to LOW_STOCK when quantity is at or above 25% of reorder point', () => {
      const lowStockArb = fc
        .integer({ min: 100, max: 1000 })
        .chain((reorderPoint) =>
          fc.integer({ min: Math.ceil(reorderPoint * 0.25), max: reorderPoint }).map((quantityOnHand) => ({
            reorderPoint,
            quantityOnHand,
          }))
        );

      fc.assert(
        fc.property(lowStockArb, ({ reorderPoint, quantityOnHand }) => {
          const alertType = determineAlertType(quantityOnHand, reorderPoint);
          expect(alertType).toBe('LOW_STOCK');
        }),
        { numRuns: 50 }
      );
    });
  });


  describe('Alert Priority Determination', () => {
    /**
     * Property: Priority should be CRITICAL when quantity is 0.
     *
     * **Validates: Requirements 3.3**
     */
    it('should set priority to CRITICAL when quantity is zero', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (reorderPoint) => {
          const priority = determineAlertPriority(0, reorderPoint);
          expect(priority).toBe('CRITICAL');
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Priority should be CRITICAL when quantity < 25% of reorder point.
     *
     * **Validates: Requirements 3.3**
     */
    it('should set priority to CRITICAL when quantity is below 25% of reorder point', () => {
      const criticalArb = fc
        .integer({ min: 100, max: 1000 })
        .chain((reorderPoint) =>
          fc.integer({ min: 1, max: Math.max(1, Math.floor(reorderPoint * 0.25) - 1) }).map((quantityOnHand) => ({
            reorderPoint,
            quantityOnHand,
          }))
        )
        .filter(({ reorderPoint, quantityOnHand }) => quantityOnHand < reorderPoint * 0.25);

      fc.assert(
        fc.property(criticalArb, ({ reorderPoint, quantityOnHand }) => {
          const priority = determineAlertPriority(quantityOnHand, reorderPoint);
          expect(priority).toBe('CRITICAL');
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Priority should be HIGH when 25% <= quantity < 50% of reorder point.
     *
     * **Validates: Requirements 3.3**
     */
    it('should set priority to HIGH when quantity is between 25% and 50% of reorder point', () => {
      const highArb = fc
        .integer({ min: 100, max: 1000 })
        .chain((reorderPoint) => {
          const min = Math.ceil(reorderPoint * 0.25);
          const max = Math.floor(reorderPoint * 0.5) - 1;
          if (min > max) return fc.constant({ reorderPoint, quantityOnHand: min });
          return fc.integer({ min, max }).map((quantityOnHand) => ({
            reorderPoint,
            quantityOnHand,
          }));
        })
        .filter(({ reorderPoint, quantityOnHand }) => {
          const pct = (quantityOnHand / reorderPoint) * 100;
          return pct >= 25 && pct < 50;
        });

      fc.assert(
        fc.property(highArb, ({ reorderPoint, quantityOnHand }) => {
          const priority = determineAlertPriority(quantityOnHand, reorderPoint);
          expect(priority).toBe('HIGH');
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Priority should be MEDIUM when 50% <= quantity < 75% of reorder point.
     *
     * **Validates: Requirements 3.3**
     */
    it('should set priority to MEDIUM when quantity is between 50% and 75% of reorder point', () => {
      const mediumArb = fc
        .integer({ min: 100, max: 1000 })
        .chain((reorderPoint) => {
          const min = Math.ceil(reorderPoint * 0.5);
          const max = Math.floor(reorderPoint * 0.75) - 1;
          if (min > max) return fc.constant({ reorderPoint, quantityOnHand: min });
          return fc.integer({ min, max }).map((quantityOnHand) => ({
            reorderPoint,
            quantityOnHand,
          }));
        })
        .filter(({ reorderPoint, quantityOnHand }) => {
          const pct = (quantityOnHand / reorderPoint) * 100;
          return pct >= 50 && pct < 75;
        });

      fc.assert(
        fc.property(mediumArb, ({ reorderPoint, quantityOnHand }) => {
          const priority = determineAlertPriority(quantityOnHand, reorderPoint);
          expect(priority).toBe('MEDIUM');
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Priority should be LOW when quantity >= 75% of reorder point.
     *
     * **Validates: Requirements 3.3**
     */
    it('should set priority to LOW when quantity is at or above 75% of reorder point', () => {
      const lowArb = fc
        .integer({ min: 100, max: 1000 })
        .chain((reorderPoint) =>
          fc.integer({ min: Math.ceil(reorderPoint * 0.75), max: reorderPoint }).map((quantityOnHand) => ({
            reorderPoint,
            quantityOnHand,
          }))
        );

      fc.assert(
        fc.property(lowArb, ({ reorderPoint, quantityOnHand }) => {
          const priority = determineAlertPriority(quantityOnHand, reorderPoint);
          expect(priority).toBe('LOW');
        }),
        { numRuns: 50 }
      );
    });
  });


  describe('Shortfall Calculation', () => {
    /**
     * Property: Shortfall should equal reorder_point - quantity_on_hand.
     *
     * **Validates: Requirements 3.3**
     */
    it('should calculate shortfall correctly', () => {
      fc.assert(
        fc.property(alertTriggeringItemArb, (item) => {
          const alert = createReplenishmentAlert(item);

          expect(alert).not.toBeNull();
          const expectedShortfall = item.reorderPoint! - item.quantityOnHand;
          expect(alert!.shortfall).toBe(expectedShortfall);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Shortfall should be non-negative when alert is triggered.
     *
     * **Validates: Requirements 3.3**
     */
    it('should have non-negative shortfall when alert is triggered', () => {
      fc.assert(
        fc.property(alertTriggeringItemArb, (item) => {
          const alert = createReplenishmentAlert(item);

          expect(alert).not.toBeNull();
          expect(alert!.shortfall).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Shortfall should be zero when quantity equals reorder point.
     *
     * **Validates: Requirements 3.3**
     */
    it('should have zero shortfall when quantity equals reorder point', () => {
      fc.assert(
        fc.property(exactlyAtReorderPointArb, (item) => {
          const alert = createReplenishmentAlert(item);

          expect(alert).not.toBeNull();
          expect(alert!.shortfall).toBe(0);
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Shortfall should equal reorder_point when quantity is zero.
     *
     * **Validates: Requirements 3.3**
     */
    it('should have shortfall equal to reorder point when quantity is zero', () => {
      fc.assert(
        fc.property(outOfStockItemArb, (item) => {
          const alert = createReplenishmentAlert(item);

          expect(alert).not.toBeNull();
          expect(alert!.shortfall).toBe(item.reorderPoint);
        }),
        { numRuns: 50 }
      );
    });
  });


  describe('Alert Data Integrity', () => {
    /**
     * Property: Alert should preserve all inventory item identifiers.
     *
     * **Validates: Requirements 3.3**
     */
    it('should preserve inventory item identifiers in alert', () => {
      fc.assert(
        fc.property(alertTriggeringItemArb, (item) => {
          const alert = createReplenishmentAlert(item);

          expect(alert).not.toBeNull();
          expect(alert!.inventoryId).toBe(item.inventoryId);
          expect(alert!.stockroomId).toBe(item.stockroomId);
          expect(alert!.stockroomName).toBe(item.stockroomName);
          expect(alert!.productId).toBe(item.productId);
          expect(alert!.productType).toBe(item.productType);
          expect(alert!.productSku).toBe(item.productSku);
          expect(alert!.productDescription).toBe(item.productDescription);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Alert should have a unique alertId.
     *
     * **Validates: Requirements 3.3**
     */
    it('should generate unique alert IDs', () => {
      fc.assert(
        fc.property(
          fc.array(alertTriggeringItemArb, { minLength: 2, maxLength: 10 }),
          (items) => {
            const alerts = items
              .map(createReplenishmentAlert)
              .filter((a): a is ReplenishmentAlert => a !== null);

            const alertIds = alerts.map((a) => a.alertId);
            const uniqueIds = new Set(alertIds);

            // All alert IDs should be unique
            expect(uniqueIds.size).toBe(alertIds.length);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Alert should have a valid createdAt timestamp.
     *
     * **Validates: Requirements 3.3**
     */
    it('should have valid createdAt timestamp', () => {
      fc.assert(
        fc.property(alertTriggeringItemArb, (item) => {
          const beforeCreate = new Date().toISOString();
          const alert = createReplenishmentAlert(item);
          const afterCreate = new Date().toISOString();

          expect(alert).not.toBeNull();
          expect(alert!.createdAt).toBeDefined();
          // Timestamp should be between before and after
          expect(alert!.createdAt >= beforeCreate).toBe(true);
          expect(alert!.createdAt <= afterCreate).toBe(true);
        }),
        { numRuns: 50 }
      );
    });
  });


  describe('Edge Cases', () => {
    /**
     * Property: Should handle reorder point of 1 correctly.
     *
     * **Validates: Requirements 3.3**
     */
    it('should handle minimum reorder point of 1', () => {
      const minReorderPointArb = fc.record({
        inventoryId: uuidArb,
        stockroomId: uuidArb,
        stockroomName: fc.string({ minLength: 1, maxLength: 50 }),
        productId: fc.option(uuidArb, { nil: null }),
        productType: productTypeArb,
        productSku: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
        productDescription: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
        quantityOnHand: fc.constantFrom(0, 1),
        quantityAvailable: fc.constantFrom(0, 1),
        reorderPoint: fc.constant(1),
        reorderQuantity: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
      });

      fc.assert(
        fc.property(minReorderPointArb, (item) => {
          const alert = createReplenishmentAlert(item);

          // Alert should be generated (quantity <= reorder point)
          expect(alert).not.toBeNull();
          expect(alert!.reorderPoint).toBe(1);
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Should handle large quantities correctly.
     *
     * **Validates: Requirements 3.3**
     */
    it('should handle large quantities correctly', () => {
      const largeQuantityArb = fc
        .record({
          inventoryId: uuidArb,
          stockroomId: uuidArb,
          stockroomName: fc.string({ minLength: 1, maxLength: 50 }),
          productId: fc.option(uuidArb, { nil: null }),
          productType: productTypeArb,
          productSku: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
          productDescription: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
          reorderPoint: fc.integer({ min: 100000, max: 1000000 }),
          reorderQuantity: fc.option(fc.integer({ min: 1000, max: 100000 }), { nil: null }),
        })
        .chain((base) =>
          fc.integer({ min: 0, max: base.reorderPoint }).map((quantityOnHand) => ({
            ...base,
            quantityOnHand,
            quantityAvailable: quantityOnHand,
          }))
        );

      fc.assert(
        fc.property(largeQuantityArb, (item) => {
          const alert = createReplenishmentAlert(item);

          expect(alert).not.toBeNull();
          expect(alert!.shortfall).toBe(item.reorderPoint! - item.quantityOnHand);
          expect(alert!.reorderQuantity).toBe(item.reorderQuantity);
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Alert type and priority should be consistent.
     *
     * **Validates: Requirements 3.3**
     */
    it('should have consistent alert type and priority', () => {
      fc.assert(
        fc.property(alertTriggeringItemArb, (item) => {
          const alert = createReplenishmentAlert(item);

          expect(alert).not.toBeNull();

          // OUT_OF_STOCK should always have CRITICAL priority
          if (alert!.alertType === 'OUT_OF_STOCK') {
            expect(alert!.priority).toBe('CRITICAL');
          }

          // CRITICAL alert type should have CRITICAL priority
          if (alert!.alertType === 'CRITICAL') {
            expect(alert!.priority).toBe('CRITICAL');
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
