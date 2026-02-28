/**
 * Property-Based Tests: Budget Calculations
 *
 * **Validates: Requirements 8.4**
 *
 * Properties tested:
 * 1. Budget Calculation Invariant: For any cost center, availableAmount = budgetAmount - spentAmount
 * 2. Non-negative Budget: budgetAmount should always be non-negative
 * 3. Expense Recording: After recording an expense, spentAmount should increase by exactly the expense amount
 * 4. Available Amount Decreases: After recording an expense, availableAmount should decrease by exactly the expense amount
 * 5. Utilization Percentage: Utilization should be (spentAmount / budgetAmount) * 100 when budgetAmount > 0
 * 6. Over-budget Detection: isOverBudget should be true when spentAmount > budgetAmount
 *
 * Requirements:
 * - 8.4: WHEN an administrator deactivates a cost center, THEN THE Reference_Data_Service
 *        SHALL mark the cost center as inactive and prevent new expense allocations
 *        Track spending against budget and calculate available amount
 */

import * as fc from 'fast-check';

// ============================================================================
// Types for Budget Calculation Testing
// ============================================================================

/**
 * Represents a cost center's budget state
 */
interface BudgetState {
  readonly budgetAmount: number;
  readonly spentAmount: number;
  readonly availableAmount: number;
}

/**
 * Represents a cost center with budget information
 */
interface CostCenter {
  readonly costCenterId: string;
  readonly code: string;
  readonly name: string;
  readonly budgetAmount: number;
  readonly spentAmount: number;
  readonly availableAmount: number;
  readonly isActive: boolean;
}

// ============================================================================
// Pure Functions Under Test
// ============================================================================


/**
 * Calculates available amount from budget and spent amounts.
 * This is a pure function that mirrors the cost center service logic for testing.
 *
 * **Validates: Requirements 8.4**
 *
 * @param budgetAmount - Total budget allocated
 * @param spentAmount - Amount already spent
 * @returns Available amount (budgetAmount - spentAmount)
 */
function calculateAvailableAmount(budgetAmount: number, spentAmount: number): number {
  return budgetAmount - spentAmount;
}

/**
 * Creates a valid budget state with calculated availableAmount.
 *
 * **Validates: Requirements 8.4**
 *
 * @param budgetAmount - Total budget allocated
 * @param spentAmount - Amount already spent
 * @returns BudgetState with calculated availableAmount
 */
function createBudgetState(budgetAmount: number, spentAmount: number): BudgetState {
  return {
    budgetAmount,
    spentAmount,
    availableAmount: calculateAvailableAmount(budgetAmount, spentAmount),
  };
}

/**
 * Records an expense against a budget state.
 * Updates spentAmount and recalculates availableAmount.
 *
 * **Validates: Requirements 8.4**
 *
 * @param state - Current budget state
 * @param expenseAmount - Amount of expense to record
 * @returns Updated budget state
 */
function recordExpense(state: BudgetState, expenseAmount: number): BudgetState {
  const newSpentAmount = state.spentAmount + expenseAmount;
  return createBudgetState(state.budgetAmount, newSpentAmount);
}

/**
 * Calculates utilization percentage.
 * Returns (spentAmount / budgetAmount) * 100 when budgetAmount > 0.
 *
 * **Validates: Requirements 8.4**
 *
 * @param budgetAmount - Total budget allocated
 * @param spentAmount - Amount already spent
 * @returns Utilization percentage (0-100+)
 */
function calculateUtilizationPercentage(budgetAmount: number, spentAmount: number): number {
  if (budgetAmount <= 0) {
    return 0;
  }
  return (spentAmount / budgetAmount) * 100;
}


/**
 * Determines if a cost center is over budget.
 * Returns true when spentAmount > budgetAmount.
 *
 * **Validates: Requirements 8.4**
 *
 * @param budgetAmount - Total budget allocated
 * @param spentAmount - Amount already spent
 * @returns true if over budget
 */
function isOverBudget(budgetAmount: number, spentAmount: number): boolean {
  return spentAmount > budgetAmount;
}

/**
 * Validates that a budget amount is valid (non-negative).
 *
 * **Validates: Requirements 8.4**
 *
 * @param budgetAmount - Budget amount to validate
 * @returns true if budget amount is valid
 */
function isValidBudgetAmount(budgetAmount: number): boolean {
  return budgetAmount >= 0;
}

/**
 * Validates that an expense amount is valid (non-negative).
 *
 * **Validates: Requirements 8.4**
 *
 * @param expenseAmount - Expense amount to validate
 * @returns true if expense amount is valid
 */
function isValidExpenseAmount(expenseAmount: number): boolean {
  return expenseAmount >= 0;
}

/**
 * Creates a cost center with budget information.
 *
 * @param costCenterId - Unique identifier
 * @param code - Cost center code
 * @param name - Cost center name
 * @param budgetAmount - Total budget allocated
 * @param spentAmount - Amount already spent
 * @param isActive - Whether cost center is active
 * @returns CostCenter with calculated availableAmount
 */
function createCostCenter(
  costCenterId: string,
  code: string,
  name: string,
  budgetAmount: number,
  spentAmount: number,
  isActive: boolean = true
): CostCenter {
  return {
    costCenterId,
    code,
    name,
    budgetAmount,
    spentAmount,
    availableAmount: calculateAvailableAmount(budgetAmount, spentAmount),
    isActive,
  };
}


/**
 * Updates budget amount for a cost center.
 * Recalculates availableAmount based on new budget.
 *
 * @param costCenter - Current cost center
 * @param newBudgetAmount - New budget amount
 * @returns Updated cost center or null if invalid
 */
function updateBudgetAmount(
  costCenter: CostCenter,
  newBudgetAmount: number
): CostCenter | null {
  if (!isValidBudgetAmount(newBudgetAmount)) {
    return null;
  }
  return {
    ...costCenter,
    budgetAmount: newBudgetAmount,
    availableAmount: calculateAvailableAmount(newBudgetAmount, costCenter.spentAmount),
  };
}

/**
 * Records an expense for a cost center.
 * Updates spentAmount and recalculates availableAmount.
 *
 * @param costCenter - Current cost center
 * @param expenseAmount - Amount of expense to record
 * @returns Updated cost center or null if invalid/inactive
 */
function recordCostCenterExpense(
  costCenter: CostCenter,
  expenseAmount: number
): CostCenter | null {
  if (!costCenter.isActive) {
    return null; // Cannot record expense on inactive cost center
  }
  if (!isValidExpenseAmount(expenseAmount)) {
    return null;
  }
  const newSpentAmount = costCenter.spentAmount + expenseAmount;
  return {
    ...costCenter,
    spentAmount: newSpentAmount,
    availableAmount: calculateAvailableAmount(costCenter.budgetAmount, newSpentAmount),
  };
}

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate valid budget amounts (non-negative numbers).
 * Using reasonable ranges for testing (0.01 to 10,000,000) to avoid floating-point precision issues.
 */
const budgetAmountArb = fc.double({ min: 0.01, max: 10_000_000, noNaN: true });

/**
 * Generate valid spent amounts (non-negative numbers).
 * Using reasonable ranges for testing (0 to 10,000,000) to avoid floating-point precision issues.
 */
const spentAmountArb = fc.double({ min: 0, max: 10_000_000, noNaN: true });


/**
 * Generate valid expense amounts (non-negative numbers).
 */
const expenseAmountArb = fc.double({ min: 0, max: 1_000_000, noNaN: true });

/**
 * Generate a valid budget state with consistent calculations.
 */
const validBudgetStateArb = fc.tuple(budgetAmountArb, spentAmountArb).map(
  ([budgetAmount, spentAmount]) => createBudgetState(budgetAmount, spentAmount)
);

/**
 * Generate a valid budget state where spent <= budget (not over budget).
 */
const underBudgetStateArb = budgetAmountArb.chain((budgetAmount) =>
  fc.double({ min: 0, max: budgetAmount, noNaN: true }).map((spentAmount) =>
    createBudgetState(budgetAmount, spentAmount)
  )
);

/**
 * Generate a valid budget state where spent > budget (over budget).
 */
const overBudgetStateArb = budgetAmountArb
  .filter((b) => b > 0)
  .chain((budgetAmount) =>
    fc.double({ min: budgetAmount + 0.01, max: budgetAmount * 2 + 1000, noNaN: true }).map(
      (spentAmount) => createBudgetState(budgetAmount, spentAmount)
    )
  );

/**
 * Generate valid cost center codes (alphanumeric with dashes).
 */
const costCenterCodeArb = fc.stringOf(
  fc.constantFrom(
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-'
  ),
  { minLength: 3, maxLength: 20 }
).filter((s) => s.trim().length > 0 && !s.startsWith('-') && !s.endsWith('-'));

/**
 * Generate valid cost center names.
 */
const costCenterNameArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

/**
 * Generate UUID-like cost center IDs.
 */
const costCenterIdArb = fc.uuid();


/**
 * Generate a valid cost center with budget information.
 */
const validCostCenterArb = fc.tuple(
  costCenterIdArb,
  costCenterCodeArb,
  costCenterNameArb,
  budgetAmountArb,
  spentAmountArb,
  fc.boolean()
).map(([id, code, name, budget, spent, isActive]) =>
  createCostCenter(id, code, name, budget, spent, isActive)
);

/**
 * Generate an active cost center (can accept expenses).
 */
const activeCostCenterArb = fc.tuple(
  costCenterIdArb,
  costCenterCodeArb,
  costCenterNameArb,
  budgetAmountArb,
  spentAmountArb
).map(([id, code, name, budget, spent]) =>
  createCostCenter(id, code, name, budget, spent, true)
);

/**
 * Generate an inactive cost center (cannot accept expenses).
 */
const inactiveCostCenterArb = fc.tuple(
  costCenterIdArb,
  costCenterCodeArb,
  costCenterNameArb,
  budgetAmountArb,
  spentAmountArb
).map(([id, code, name, budget, spent]) =>
  createCostCenter(id, code, name, budget, spent, false)
);

// ============================================================================
// Property Tests
// ============================================================================

describe('Property Tests: Budget Calculations', () => {
  /**
   * **Validates: Requirements 8.4**
   */

  describe('Property 1: Budget Calculation Invariant', () => {
    /**
     * Property: For any cost center, availableAmount must always equal
     * budgetAmount - spentAmount.
     *
     * **Validates: Requirements 8.4**
     */
    it('should always calculate availableAmount as budgetAmount - spentAmount', () => {
      fc.assert(
        fc.property(validBudgetStateArb, (state) => {
          // The invariant must hold
          expect(state.availableAmount).toBeCloseTo(
            state.budgetAmount - state.spentAmount,
            10
          );
        }),
        { numRuns: 100 }
      );
    });


    /**
     * Property: The calculation function should be consistent with
     * the budget state creation.
     *
     * **Validates: Requirements 8.4**
     */
    it('should have consistent calculation between function and state', () => {
      fc.assert(
        fc.property(budgetAmountArb, spentAmountArb, (budgetAmount, spentAmount) => {
          const calculated = calculateAvailableAmount(budgetAmount, spentAmount);
          const budgetState = createBudgetState(budgetAmount, spentAmount);

          expect(calculated).toBeCloseTo(budgetState.availableAmount, 10);
          expect(calculated).toBeCloseTo(budgetAmount - spentAmount, 10);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: The sum of spentAmount and availableAmount should equal budgetAmount.
     * Note: Using relative tolerance for floating-point comparison due to precision limits.
     *
     * **Validates: Requirements 8.4**
     */
    it('should satisfy spentAmount + availableAmount = budgetAmount', () => {
      fc.assert(
        fc.property(validBudgetStateArb, (state) => {
          const sum = state.spentAmount + state.availableAmount;
          const expected = state.budgetAmount;
          
          // Use relative tolerance based on the magnitude of the larger operand
          const maxMagnitude = Math.max(Math.abs(state.spentAmount), Math.abs(state.availableAmount), Math.abs(expected));
          const tolerance = Math.max(maxMagnitude * 1e-9, 1e-9);
          expect(Math.abs(sum - expected)).toBeLessThanOrEqual(tolerance);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Cost center availableAmount should follow the same invariant.
     *
     * **Validates: Requirements 8.4**
     */
    it('should maintain invariant for cost center entities', () => {
      fc.assert(
        fc.property(validCostCenterArb, (costCenter) => {
          expect(costCenter.availableAmount).toBeCloseTo(
            costCenter.budgetAmount - costCenter.spentAmount,
            10
          );
        }),
        { numRuns: 100 }
      );
    });
  });


  describe('Property 2: Non-negative Budget', () => {
    /**
     * Property: budgetAmount should always be non-negative.
     *
     * **Validates: Requirements 8.4**
     */
    it('should validate that budget amounts are non-negative', () => {
      fc.assert(
        fc.property(budgetAmountArb, (budgetAmount) => {
          expect(isValidBudgetAmount(budgetAmount)).toBe(true);
          expect(budgetAmount).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Negative budget amounts should be rejected.
     *
     * **Validates: Requirements 8.4**
     */
    it('should reject negative budget amounts', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -10_000_000, max: -0.01, noNaN: true }),
          (negativeBudget) => {
            expect(isValidBudgetAmount(negativeBudget)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Zero budget should be valid.
     *
     * **Validates: Requirements 8.4**
     */
    it('should allow zero budget as a valid state', () => {
      expect(isValidBudgetAmount(0)).toBe(true);
      const state = createBudgetState(0, 0);
      expect(state.budgetAmount).toBe(0);
      expect(state.availableAmount).toBe(0);
    });

    /**
     * Property: Cost centers should have non-negative budget amounts.
     *
     * **Validates: Requirements 8.4**
     */
    it('should have non-negative budget amounts in cost centers', () => {
      fc.assert(
        fc.property(validCostCenterArb, (costCenter) => {
          expect(costCenter.budgetAmount).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });
  });


  describe('Property 3: Expense Recording - spentAmount increases', () => {
    /**
     * Property: After recording an expense, spentAmount should increase
     * by exactly the expense amount.
     *
     * **Validates: Requirements 8.4**
     */
    it('should increase spentAmount by exactly the expense amount', () => {
      fc.assert(
        fc.property(validBudgetStateArb, expenseAmountArb, (state, expense) => {
          const originalSpent = state.spentAmount;
          const updated = recordExpense(state, expense);

          expect(updated.spentAmount).toBeCloseTo(originalSpent + expense, 10);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Recording zero expense should not change spentAmount.
     *
     * **Validates: Requirements 8.4**
     */
    it('should not change spentAmount when recording zero expense', () => {
      fc.assert(
        fc.property(validBudgetStateArb, (state) => {
          const updated = recordExpense(state, 0);

          expect(updated.spentAmount).toBeCloseTo(state.spentAmount, 10);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Multiple expenses should accumulate correctly.
     *
     * **Validates: Requirements 8.4**
     */
    it('should accumulate multiple expenses correctly', () => {
      fc.assert(
        fc.property(
          validBudgetStateArb,
          fc.array(expenseAmountArb, { minLength: 1, maxLength: 10 }),
          (initialState, expenses) => {
            let state = initialState;
            const totalExpenses = expenses.reduce((sum, e) => sum + e, 0);

            for (const expense of expenses) {
              state = recordExpense(state, expense);
            }

            expect(state.spentAmount).toBeCloseTo(
              initialState.spentAmount + totalExpenses,
              8
            );
          }
        ),
        { numRuns: 50 }
      );
    });


    /**
     * Property: Cost center expense recording should increase spentAmount.
     *
     * **Validates: Requirements 8.4**
     */
    it('should increase cost center spentAmount by expense amount', () => {
      fc.assert(
        fc.property(activeCostCenterArb, expenseAmountArb, (costCenter, expense) => {
          const originalSpent = costCenter.spentAmount;
          const updated = recordCostCenterExpense(costCenter, expense);

          expect(updated).not.toBeNull();
          expect(updated!.spentAmount).toBeCloseTo(originalSpent + expense, 10);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Inactive cost centers should reject expense recording.
     *
     * **Validates: Requirements 8.4**
     */
    it('should reject expense recording on inactive cost centers', () => {
      fc.assert(
        fc.property(inactiveCostCenterArb, expenseAmountArb, (costCenter, expense) => {
          const updated = recordCostCenterExpense(costCenter, expense);

          expect(updated).toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: Available Amount Decreases', () => {
    /**
     * Property: After recording an expense, availableAmount should decrease
     * by exactly the expense amount.
     * Note: Using relative tolerance for floating-point comparison.
     *
     * **Validates: Requirements 8.4**
     */
    it('should decrease availableAmount by exactly the expense amount', () => {
      fc.assert(
        fc.property(validBudgetStateArb, expenseAmountArb, (state, expense) => {
          const originalAvailable = state.availableAmount;
          const updated = recordExpense(state, expense);
          const expected = originalAvailable - expense;

          // Use relative tolerance based on the magnitude of the values
          const maxMagnitude = Math.max(Math.abs(originalAvailable), Math.abs(expense), Math.abs(expected));
          const tolerance = Math.max(maxMagnitude * 1e-9, 1e-9);
          expect(Math.abs(updated.availableAmount - expected)).toBeLessThanOrEqual(tolerance);
        }),
        { numRuns: 100 }
      );
    });


    /**
     * Property: Recording zero expense should not change availableAmount.
     *
     * **Validates: Requirements 8.4**
     */
    it('should not change availableAmount when recording zero expense', () => {
      fc.assert(
        fc.property(validBudgetStateArb, (state) => {
          const updated = recordExpense(state, 0);

          expect(updated.availableAmount).toBeCloseTo(state.availableAmount, 10);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: The invariant should hold after expense recording.
     *
     * **Validates: Requirements 8.4**
     */
    it('should maintain invariant after expense recording', () => {
      fc.assert(
        fc.property(validBudgetStateArb, expenseAmountArb, (state, expense) => {
          const updated = recordExpense(state, expense);

          // Invariant: availableAmount = budgetAmount - spentAmount
          expect(updated.availableAmount).toBeCloseTo(
            updated.budgetAmount - updated.spentAmount,
            10
          );
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Cost center availableAmount should decrease by expense amount.
     * Note: Using relative tolerance for floating-point comparison.
     *
     * **Validates: Requirements 8.4**
     */
    it('should decrease cost center availableAmount by expense amount', () => {
      fc.assert(
        fc.property(activeCostCenterArb, expenseAmountArb, (costCenter, expense) => {
          const originalAvailable = costCenter.availableAmount;
          const updated = recordCostCenterExpense(costCenter, expense);

          expect(updated).not.toBeNull();
          const expected = originalAvailable - expense;
          const tolerance = Math.max(Math.abs(expected) * 1e-9, 1e-9);
          expect(Math.abs(updated!.availableAmount - expected)).toBeLessThanOrEqual(tolerance);
        }),
        { numRuns: 100 }
      );
    });


    /**
     * Property: Budget amount update should recalculate availableAmount.
     *
     * **Validates: Requirements 8.4**
     */
    it('should recalculate availableAmount after budget update', () => {
      fc.assert(
        fc.property(activeCostCenterArb, budgetAmountArb, (costCenter, newBudget) => {
          const updated = updateBudgetAmount(costCenter, newBudget);

          expect(updated).not.toBeNull();
          expect(updated!.budgetAmount).toBe(newBudget);
          expect(updated!.availableAmount).toBeCloseTo(
            newBudget - costCenter.spentAmount,
            10
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5: Utilization Percentage', () => {
    /**
     * Property: Utilization should be (spentAmount / budgetAmount) * 100
     * when budgetAmount > 0.
     *
     * **Validates: Requirements 8.4**
     */
    it('should calculate utilization as (spentAmount / budgetAmount) * 100', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 10_000_000, noNaN: true }),
          spentAmountArb,
          (budgetAmount, spentAmount) => {
            const utilization = calculateUtilizationPercentage(budgetAmount, spentAmount);
            const expected = (spentAmount / budgetAmount) * 100;

            expect(utilization).toBeCloseTo(expected, 10);
          }
        ),
        { numRuns: 100 }
      );
    });


    /**
     * Property: Utilization should be 0 when budgetAmount is 0.
     *
     * **Validates: Requirements 8.4**
     */
    it('should return 0 utilization when budget is 0', () => {
      fc.assert(
        fc.property(spentAmountArb, (spentAmount) => {
          const utilization = calculateUtilizationPercentage(0, spentAmount);

          expect(utilization).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Utilization should be 100% when spent equals budget.
     *
     * **Validates: Requirements 8.4**
     */
    it('should return 100% utilization when spent equals budget', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 10_000_000, noNaN: true }),
          (amount) => {
            const utilization = calculateUtilizationPercentage(amount, amount);

            expect(utilization).toBeCloseTo(100, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Utilization should be 0% when nothing is spent.
     *
     * **Validates: Requirements 8.4**
     */
    it('should return 0% utilization when nothing is spent', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 10_000_000, noNaN: true }),
          (budgetAmount) => {
            const utilization = calculateUtilizationPercentage(budgetAmount, 0);

            expect(utilization).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });


    /**
     * Property: Utilization can exceed 100% when over budget.
     *
     * **Validates: Requirements 8.4**
     */
    it('should allow utilization to exceed 100% when over budget', () => {
      fc.assert(
        fc.property(overBudgetStateArb, (state) => {
          const utilization = calculateUtilizationPercentage(
            state.budgetAmount,
            state.spentAmount
          );

          expect(utilization).toBeGreaterThan(100);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Utilization should be between 0 and 100 when under budget.
     *
     * **Validates: Requirements 8.4**
     */
    it('should have utilization between 0 and 100 when under budget', () => {
      fc.assert(
        fc.property(underBudgetStateArb, (state) => {
          // Skip zero budget case
          if (state.budgetAmount === 0) return;

          const utilization = calculateUtilizationPercentage(
            state.budgetAmount,
            state.spentAmount
          );

          expect(utilization).toBeGreaterThanOrEqual(0);
          expect(utilization).toBeLessThanOrEqual(100);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 6: Over-budget Detection', () => {
    /**
     * Property: isOverBudget should be true when spentAmount > budgetAmount.
     *
     * **Validates: Requirements 8.4**
     */
    it('should detect over-budget when spent exceeds budget', () => {
      fc.assert(
        fc.property(overBudgetStateArb, (state) => {
          const overBudget = isOverBudget(state.budgetAmount, state.spentAmount);

          expect(overBudget).toBe(true);
          expect(state.spentAmount).toBeGreaterThan(state.budgetAmount);
        }),
        { numRuns: 100 }
      );
    });


    /**
     * Property: isOverBudget should be false when spentAmount <= budgetAmount.
     *
     * **Validates: Requirements 8.4**
     */
    it('should not detect over-budget when spent is within budget', () => {
      fc.assert(
        fc.property(underBudgetStateArb, (state) => {
          const overBudget = isOverBudget(state.budgetAmount, state.spentAmount);

          expect(overBudget).toBe(false);
          expect(state.spentAmount).toBeLessThanOrEqual(state.budgetAmount);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: isOverBudget should be false when spent equals budget exactly.
     *
     * **Validates: Requirements 8.4**
     */
    it('should not detect over-budget when spent equals budget exactly', () => {
      fc.assert(
        fc.property(budgetAmountArb, (amount) => {
          const overBudget = isOverBudget(amount, amount);

          expect(overBudget).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Over-budget detection should be consistent with available amount sign.
     *
     * **Validates: Requirements 8.4**
     */
    it('should have negative availableAmount when over budget', () => {
      fc.assert(
        fc.property(overBudgetStateArb, (state) => {
          expect(state.availableAmount).toBeLessThan(0);
          expect(isOverBudget(state.budgetAmount, state.spentAmount)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Under-budget should have non-negative availableAmount.
     *
     * **Validates: Requirements 8.4**
     */
    it('should have non-negative availableAmount when under budget', () => {
      fc.assert(
        fc.property(underBudgetStateArb, (state) => {
          expect(state.availableAmount).toBeGreaterThanOrEqual(0);
          expect(isOverBudget(state.budgetAmount, state.spentAmount)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });


  describe('Edge Cases', () => {
    /**
     * Property: Zero budget with zero spent should have zero available.
     *
     * **Validates: Requirements 8.4**
     */
    it('should handle zero budget with zero spent', () => {
      const state = createBudgetState(0, 0);

      expect(state.budgetAmount).toBe(0);
      expect(state.spentAmount).toBe(0);
      expect(state.availableAmount).toBe(0);
      expect(isOverBudget(state.budgetAmount, state.spentAmount)).toBe(false);
    });

    /**
     * Property: Very small amounts should be handled correctly.
     *
     * **Validates: Requirements 8.4**
     */
    it('should handle very small amounts correctly', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.001, max: 1, noNaN: true }),
          fc.double({ min: 0.001, max: 1, noNaN: true }),
          (budget, spent) => {
            const state = createBudgetState(budget, spent);

            expect(state.availableAmount).toBeCloseTo(budget - spent, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Large amounts should be handled correctly.
     *
     * **Validates: Requirements 8.4**
     */
    it('should handle large amounts correctly', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1_000_000, max: 1_000_000_000, noNaN: true }),
          fc.double({ min: 0, max: 1_000_000_000, noNaN: true }),
          (budget, spent) => {
            const state = createBudgetState(budget, spent);

            expect(state.availableAmount).toBeCloseTo(budget - spent, 5);
          }
        ),
        { numRuns: 50 }
      );
    });


    /**
     * Property: Calculation should be deterministic.
     *
     * **Validates: Requirements 8.4**
     */
    it('should produce deterministic results', () => {
      fc.assert(
        fc.property(validBudgetStateArb, (state) => {
          const result1 = calculateAvailableAmount(state.budgetAmount, state.spentAmount);
          const result2 = calculateAvailableAmount(state.budgetAmount, state.spentAmount);
          const result3 = calculateAvailableAmount(state.budgetAmount, state.spentAmount);

          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Negative expense amounts should be rejected.
     *
     * **Validates: Requirements 8.4**
     */
    it('should reject negative expense amounts', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1_000_000, max: -0.01, noNaN: true }),
          (negativeExpense) => {
            expect(isValidExpenseAmount(negativeExpense)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Cost center expense recording should reject negative amounts.
     *
     * **Validates: Requirements 8.4**
     */
    it('should reject negative expense amounts for cost centers', () => {
      fc.assert(
        fc.property(
          activeCostCenterArb,
          fc.double({ min: -1_000_000, max: -0.01, noNaN: true }),
          (costCenter, negativeExpense) => {
            const updated = recordCostCenterExpense(costCenter, negativeExpense);

            expect(updated).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('Commutativity and Associativity', () => {
    /**
     * Property: Order of expense recording should not affect final spentAmount.
     *
     * **Validates: Requirements 8.4**
     */
    it('should reach same spentAmount regardless of expense order', () => {
      fc.assert(
        fc.property(
          validBudgetStateArb,
          fc.array(expenseAmountArb, { minLength: 2, maxLength: 5 }),
          (initialState, expenses) => {
            // Record expenses in original order
            let state1 = initialState;
            for (const expense of expenses) {
              state1 = recordExpense(state1, expense);
            }

            // Record expenses in reverse order
            let state2 = initialState;
            for (const expense of [...expenses].reverse()) {
              state2 = recordExpense(state2, expense);
            }

            // Final spentAmount should be the same
            expect(state1.spentAmount).toBeCloseTo(state2.spentAmount, 8);
            expect(state1.availableAmount).toBeCloseTo(state2.availableAmount, 8);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Recording expenses one at a time vs all at once should be equivalent.
     *
     * **Validates: Requirements 8.4**
     */
    it('should be equivalent to record expenses individually or as sum', () => {
      fc.assert(
        fc.property(
          validBudgetStateArb,
          fc.array(expenseAmountArb, { minLength: 1, maxLength: 5 }),
          (initialState, expenses) => {
            // Record expenses one at a time
            let stateIndividual = initialState;
            for (const expense of expenses) {
              stateIndividual = recordExpense(stateIndividual, expense);
            }

            // Record total expense at once
            const totalExpense = expenses.reduce((sum, e) => sum + e, 0);
            const stateTotal = recordExpense(initialState, totalExpense);

            // Results should be equivalent
            expect(stateIndividual.spentAmount).toBeCloseTo(stateTotal.spentAmount, 8);
            expect(stateIndividual.availableAmount).toBeCloseTo(stateTotal.availableAmount, 8);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
