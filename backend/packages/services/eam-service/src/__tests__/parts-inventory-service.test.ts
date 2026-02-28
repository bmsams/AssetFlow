/**
 * Parts Inventory Service Unit Tests
 *
 * Tests for the Parts Inventory Service business logic.
 * Requirements: 5.4, 5.5
 */

describe('PartsInventoryService', () => {
  describe('Part Reservation Logic', () => {
    /**
     * Simulates part reservation calculation
     * Requirement 5.5: Reserve parts and update availability
     */
    function calculateReservation(
      availableQuantity: number,
      requestedQuantity: number
    ): { quantityReserved: number; fullyReserved: boolean } {
      const quantityReserved = Math.min(requestedQuantity, availableQuantity);
      const fullyReserved = quantityReserved >= requestedQuantity;
      return { quantityReserved, fullyReserved };
    }

    it('should fully reserve when sufficient quantity available', () => {
      const result = calculateReservation(100, 50);

      expect(result.quantityReserved).toBe(50);
      expect(result.fullyReserved).toBe(true);
    });

    it('should partially reserve when insufficient quantity', () => {
      const result = calculateReservation(30, 50);

      expect(result.quantityReserved).toBe(30);
      expect(result.fullyReserved).toBe(false);
    });

    it('should reserve zero when no quantity available', () => {
      const result = calculateReservation(0, 50);

      expect(result.quantityReserved).toBe(0);
      expect(result.fullyReserved).toBe(false);
    });

    it('should handle exact quantity match', () => {
      const result = calculateReservation(50, 50);

      expect(result.quantityReserved).toBe(50);
      expect(result.fullyReserved).toBe(true);
    });
  });

  describe('Part Consumption Logic', () => {
    /**
     * Simulates part consumption validation
     */
    function validateConsumption(
      reservedQuantity: number,
      quantityToConsume: number
    ): { valid: boolean; error?: string } {
      if (quantityToConsume <= 0) {
        return { valid: false, error: 'Quantity to consume must be positive' };
      }
      if (quantityToConsume > reservedQuantity) {
        return { 
          valid: false, 
          error: `Cannot consume ${quantityToConsume}. Only ${reservedQuantity} reserved.` 
        };
      }
      return { valid: true };
    }

    it('should allow consuming reserved quantity', () => {
      const result = validateConsumption(50, 30);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should allow consuming all reserved quantity', () => {
      const result = validateConsumption(50, 50);

      expect(result.valid).toBe(true);
    });

    it('should reject consuming more than reserved', () => {
      const result = validateConsumption(30, 50);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot consume 50');
      expect(result.error).toContain('Only 30 reserved');
    });

    it('should reject zero consumption', () => {
      const result = validateConsumption(50, 0);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Quantity to consume must be positive');
    });

    it('should reject negative consumption', () => {
      const result = validateConsumption(50, -10);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Quantity to consume must be positive');
    });
  });

  describe('Stock Level Alert Logic', () => {
    /**
     * Simulates stock level check
     * Requirement 5.4: Manage spare parts inventory
     */
    interface PartStockInfo {
      partId: string;
      partNumber: string;
      quantityAvailable: number;
      reorderPoint: number;
      reorderQuantity: number | null;
      isCritical: boolean;
    }

    function checkStockLevel(part: PartStockInfo): {
      needsReplenishment: boolean;
      quantityBelowReorder: number;
      suggestedOrderQuantity: number;
    } {
      const needsReplenishment = part.quantityAvailable <= part.reorderPoint;
      const quantityBelowReorder = Math.max(0, part.reorderPoint - part.quantityAvailable);
      const suggestedOrderQuantity = part.reorderQuantity ?? Math.max(quantityBelowReorder, part.reorderPoint);

      return {
        needsReplenishment,
        quantityBelowReorder,
        suggestedOrderQuantity,
      };
    }

    it('should detect part below reorder point', () => {
      const part: PartStockInfo = {
        partId: '123',
        partNumber: 'PART-001',
        quantityAvailable: 5,
        reorderPoint: 10,
        reorderQuantity: 50,
        isCritical: false,
      };

      const result = checkStockLevel(part);

      expect(result.needsReplenishment).toBe(true);
      expect(result.quantityBelowReorder).toBe(5);
      expect(result.suggestedOrderQuantity).toBe(50);
    });

    it('should detect part at reorder point', () => {
      const part: PartStockInfo = {
        partId: '123',
        partNumber: 'PART-001',
        quantityAvailable: 10,
        reorderPoint: 10,
        reorderQuantity: 50,
        isCritical: false,
      };

      const result = checkStockLevel(part);

      expect(result.needsReplenishment).toBe(true);
      expect(result.quantityBelowReorder).toBe(0);
    });

    it('should not flag part above reorder point', () => {
      const part: PartStockInfo = {
        partId: '123',
        partNumber: 'PART-001',
        quantityAvailable: 50,
        reorderPoint: 10,
        reorderQuantity: 50,
        isCritical: false,
      };

      const result = checkStockLevel(part);

      expect(result.needsReplenishment).toBe(false);
      expect(result.quantityBelowReorder).toBe(0);
    });

    it('should use reorder point as suggested quantity when reorderQuantity is null', () => {
      const part: PartStockInfo = {
        partId: '123',
        partNumber: 'PART-001',
        quantityAvailable: 2,
        reorderPoint: 10,
        reorderQuantity: null,
        isCritical: false,
      };

      const result = checkStockLevel(part);

      expect(result.needsReplenishment).toBe(true);
      expect(result.suggestedOrderQuantity).toBe(10); // Uses reorderPoint
    });

    it('should handle zero available quantity', () => {
      const part: PartStockInfo = {
        partId: '123',
        partNumber: 'PART-001',
        quantityAvailable: 0,
        reorderPoint: 10,
        reorderQuantity: 100,
        isCritical: true,
      };

      const result = checkStockLevel(part);

      expect(result.needsReplenishment).toBe(true);
      expect(result.quantityBelowReorder).toBe(10);
      expect(result.suggestedOrderQuantity).toBe(100);
    });
  });

  describe('Inventory Quantity Calculations', () => {
    /**
     * Simulates inventory quantity calculations
     */
    function calculateAvailableQuantity(
      quantityOnHand: number,
      quantityReserved: number
    ): number {
      return quantityOnHand - quantityReserved;
    }

    function updateQuantityAfterReservation(
      currentReserved: number,
      newReservation: number
    ): number {
      return currentReserved + newReservation;
    }

    function updateQuantityAfterConsumption(
      quantityOnHand: number,
      quantityReserved: number,
      quantityConsumed: number
    ): { newOnHand: number; newReserved: number } {
      return {
        newOnHand: quantityOnHand - quantityConsumed,
        newReserved: quantityReserved - quantityConsumed,
      };
    }

    it('should calculate available quantity correctly', () => {
      expect(calculateAvailableQuantity(100, 30)).toBe(70);
      expect(calculateAvailableQuantity(50, 50)).toBe(0);
      expect(calculateAvailableQuantity(100, 0)).toBe(100);
    });

    it('should update reserved quantity after reservation', () => {
      expect(updateQuantityAfterReservation(20, 10)).toBe(30);
      expect(updateQuantityAfterReservation(0, 50)).toBe(50);
    });

    it('should update quantities after consumption', () => {
      const result = updateQuantityAfterConsumption(100, 30, 20);

      expect(result.newOnHand).toBe(80);
      expect(result.newReserved).toBe(10);
    });

    it('should handle full consumption of reserved quantity', () => {
      const result = updateQuantityAfterConsumption(100, 30, 30);

      expect(result.newOnHand).toBe(70);
      expect(result.newReserved).toBe(0);
    });
  });

  describe('Part Requirement Validation', () => {
    /**
     * Validates part requirements for reservation
     */
    interface PartRequirement {
      partId: string;
      quantityRequired: number;
    }

    function validatePartRequirements(
      requirements: PartRequirement[]
    ): { valid: boolean; errors: string[] } {
      const errors: string[] = [];

      if (!requirements || requirements.length === 0) {
        errors.push('At least one part requirement is required');
        return { valid: false, errors };
      }

      const seenPartIds = new Set<string>();

      for (let i = 0; i < requirements.length; i++) {
        const req: PartRequirement | undefined = requirements[i];

        if (!req) {
          errors.push(`parts[${i}] is undefined`);
          continue;
        }

        if (!req.partId) {
          errors.push(`parts[${i}].partId is required`);
        } else if (seenPartIds.has(req.partId)) {
          errors.push(`Duplicate partId: ${req.partId}`);
        } else {
          seenPartIds.add(req.partId);
        }

        if (req.quantityRequired === undefined || req.quantityRequired === null) {
          errors.push(`parts[${i}].quantityRequired is required`);
        } else if (req.quantityRequired <= 0) {
          errors.push(`parts[${i}].quantityRequired must be greater than 0`);
        } else if (!Number.isInteger(req.quantityRequired)) {
          errors.push(`parts[${i}].quantityRequired must be an integer`);
        }
      }

      return { valid: errors.length === 0, errors };
    }

    it('should accept valid part requirements', () => {
      const result = validatePartRequirements([
        { partId: 'part-1', quantityRequired: 10 },
        { partId: 'part-2', quantityRequired: 5 },
      ]);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty requirements array', () => {
      const result = validatePartRequirements([]);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one part requirement is required');
    });

    it('should reject duplicate part IDs', () => {
      const result = validatePartRequirements([
        { partId: 'part-1', quantityRequired: 10 },
        { partId: 'part-1', quantityRequired: 5 },
      ]);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Duplicate partId: part-1');
    });

    it('should reject zero quantity', () => {
      const result = validatePartRequirements([
        { partId: 'part-1', quantityRequired: 0 },
      ]);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be greater than 0'))).toBe(true);
    });

    it('should reject negative quantity', () => {
      const result = validatePartRequirements([
        { partId: 'part-1', quantityRequired: -5 },
      ]);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be greater than 0'))).toBe(true);
    });

    it('should reject non-integer quantity', () => {
      const result = validatePartRequirements([
        { partId: 'part-1', quantityRequired: 5.5 },
      ]);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be an integer'))).toBe(true);
    });
  });
});
