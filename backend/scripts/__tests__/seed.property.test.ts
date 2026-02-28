/**
 * Property-Based Tests for Seed Data
 *
 * These tests verify correctness properties of the seed data definitions
 * without requiring database connectivity.
 *
 * **Validates: Requirements 3.11, 3.12**
 */

import * as fc from 'fast-check';
import {
  DEPARTMENTS,
  USERS,
  STOCKROOMS,
  MANUFACTURERS,
  MODELS,
  SOFTWARE_PRODUCTS,
  ENTITLEMENTS,
  ENTERPRISE_ASSETS,
  MAINTENANCE_PLANS,
  FACILITIES,
  VENDORS,
  CONTRACTS,
  PURCHASE_ORDERS,
  LIFECYCLE_STATES,
  MODELS_BY_CATEGORY,
  ASSET_COUNTS_BY_STATE,
  DEPARTMENT_CODES,
  STOCKROOM_CODES,
  ASSIGNABLE_USERS,
  SeedDepartment,
  SeedUser,
  SeedStockroom,
  SeedManufacturer,
  SeedModel,
  SeedFacility,
  SeedVendor,
  SeedContract,
  SeedSoftwareProduct,
  SeedEntitlement,
  SeedEnterpriseAsset,
  SeedMaintenancePlan,
  SeedPurchaseOrder,
} from '@ams/seed-data';

describe('Seed Data Property Tests', () => {
  /**
   * Property 2: Seed Data Referential Integrity
   * **Validates: Requirements 3.11**
   *
   * All foreign key references in seed data must point to valid parent records.
   */
  describe('Property 2: Seed Data Referential Integrity', () => {
    const departmentCodes = new Set(DEPARTMENTS.map((d: SeedDepartment) => d.code));
    const manufacturerNames = new Set(MANUFACTURERS.map((m: SeedManufacturer) => m.normalizedName));
    const facilityCodes = new Set(FACILITIES.map((f: SeedFacility) => f.facilityCode));
    const vendorCodes = new Set(VENDORS.map((v: SeedVendor) => v.vendorCode));
    const productNames = new Set(SOFTWARE_PRODUCTS.map((p: SeedSoftwareProduct) => p.productName));
    const userEmails = new Set(USERS.map((u: SeedUser) => u.email));
    const stockroomCodes = new Set(STOCKROOMS.map((s: SeedStockroom) => s.stockroomCode));
    const enterpriseAssetNames = new Set(ENTERPRISE_ASSETS.map((e: SeedEnterpriseAsset) => e.displayName));

    it('all users reference valid departments', () => {
      fc.assert(
        fc.property(fc.constantFrom(...USERS), (user: SeedUser) => {
          return departmentCodes.has(user.departmentCode);
        }),
        { numRuns: USERS.length }
      );
    });

    it('all models reference valid manufacturers', () => {
      fc.assert(
        fc.property(fc.constantFrom(...MODELS), (model: SeedModel) => {
          return manufacturerNames.has(model.manufacturerName);
        }),
        { numRuns: MODELS.length }
      );
    });

    it('all enterprise assets reference valid facilities', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ENTERPRISE_ASSETS), (asset: SeedEnterpriseAsset) => {
          return facilityCodes.has(asset.facilityCode);
        }),
        { numRuns: ENTERPRISE_ASSETS.length }
      );
    });

    it('all contracts reference valid vendors', () => {
      fc.assert(
        fc.property(fc.constantFrom(...CONTRACTS), (contract: SeedContract) => {
          return vendorCodes.has(contract.vendorCode);
        }),
        { numRuns: CONTRACTS.length }
      );
    });

    it('all purchase orders reference valid vendors', () => {
      fc.assert(
        fc.property(fc.constantFrom(...PURCHASE_ORDERS), (po: SeedPurchaseOrder) => {
          return vendorCodes.has(po.vendorCode);
        }),
        { numRuns: PURCHASE_ORDERS.length }
      );
    });

    it('all purchase orders reference valid requesters', () => {
      fc.assert(
        fc.property(fc.constantFrom(...PURCHASE_ORDERS), (po: SeedPurchaseOrder) => {
          return userEmails.has(po.requesterEmail);
        }),
        { numRuns: PURCHASE_ORDERS.length }
      );
    });

    it('all entitlements reference valid software products', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ENTITLEMENTS), (entitlement: SeedEntitlement) => {
          return productNames.has(entitlement.productName);
        }),
        { numRuns: ENTITLEMENTS.length }
      );
    });

    it('all maintenance plans reference valid enterprise assets', () => {
      fc.assert(
        fc.property(fc.constantFrom(...MAINTENANCE_PLANS), (plan: SeedMaintenancePlan) => {
          return enterpriseAssetNames.has(plan.assetDisplayName);
        }),
        { numRuns: MAINTENANCE_PLANS.length }
      );
    });

    it('all models in MODELS_BY_CATEGORY reference valid models', () => {
      const modelNames = new Set(MODELS.map((m: SeedModel) => m.normalizedName));
      
      for (const [, models] of Object.entries(MODELS_BY_CATEGORY)) {
        for (const modelName of models) {
          expect(modelNames.has(modelName)).toBe(true);
        }
      }
    });

    it('all department codes in constants reference valid departments', () => {
      for (const code of DEPARTMENT_CODES) {
        expect(departmentCodes.has(code)).toBe(true);
      }
    });

    it('all stockroom codes in constants reference valid stockrooms', () => {
      for (const code of STOCKROOM_CODES) {
        expect(stockroomCodes.has(code)).toBe(true);
      }
    });

    it('all assignable users in constants reference valid users', () => {
      for (const email of ASSIGNABLE_USERS) {
        expect(userEmails.has(email)).toBe(true);
      }
    });
  });

  /**
   * Property 3: Seed Script Idempotence
   * **Validates: Requirements 3.12**
   *
   * Seed data definitions must have unique identifiers to support idempotent operations.
   */
  describe('Property 3: Seed Script Idempotence', () => {
    it('all department codes are unique', () => {
      const codes = DEPARTMENTS.map((d: SeedDepartment) => d.code);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('all user emails are unique', () => {
      const emails = USERS.map((u: SeedUser) => u.email);
      const uniqueEmails = new Set(emails);
      expect(uniqueEmails.size).toBe(emails.length);
    });

    it('all stockroom codes are unique', () => {
      const codes = STOCKROOMS.map((s: SeedStockroom) => s.stockroomCode);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('all manufacturer normalized names are unique', () => {
      const names = MANUFACTURERS.map((m: SeedManufacturer) => m.normalizedName);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('all model normalized names within manufacturer are unique', () => {
      const modelsByManufacturer = new Map<string, string[]>();
      for (const model of MODELS) {
        const existing = modelsByManufacturer.get(model.manufacturerName) || [];
        existing.push(model.normalizedName);
        modelsByManufacturer.set(model.manufacturerName, existing);
      }

      for (const [, models] of modelsByManufacturer) {
        const uniqueModels = new Set(models);
        expect(uniqueModels.size).toBe(models.length);
      }
    });

    it('all facility codes are unique', () => {
      const codes = FACILITIES.map((f: SeedFacility) => f.facilityCode);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('all vendor codes are unique', () => {
      const codes = VENDORS.map((v: SeedVendor) => v.vendorCode);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('all contract numbers are unique', () => {
      const numbers = CONTRACTS.map((c: SeedContract) => c.contractNumber);
      const uniqueNumbers = new Set(numbers);
      expect(uniqueNumbers.size).toBe(numbers.length);
    });

    it('all purchase order numbers are unique', () => {
      const numbers = PURCHASE_ORDERS.map((po: SeedPurchaseOrder) => po.poNumber);
      const uniqueNumbers = new Set(numbers);
      expect(uniqueNumbers.size).toBe(numbers.length);
    });

    it('all software products have unique publisher+name+version+edition combinations', () => {
      const keys = SOFTWARE_PRODUCTS.map(
        (p: SeedSoftwareProduct) => `${p.publisher}|${p.productName}|${p.version}|${p.edition}`
      );
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });

  /**
   * Data Completeness Tests
   * Verify minimum data requirements are met
   */
  describe('Data Completeness', () => {
    it('has at least 5 departments (Requirement 3.1)', () => {
      expect(DEPARTMENTS.length).toBeGreaterThanOrEqual(5);
    });

    it('has at least 10 users (Requirement 3.2)', () => {
      expect(USERS.length).toBeGreaterThanOrEqual(10);
    });

    it('has at least 3 stockrooms (Requirement 3.3)', () => {
      expect(STOCKROOMS.length).toBeGreaterThanOrEqual(3);
    });

    it('has at least 10 manufacturers (Requirement 3.4)', () => {
      expect(MANUFACTURERS.length).toBeGreaterThanOrEqual(10);
    });

    it('has at least 20 models (Requirement 3.5)', () => {
      expect(MODELS.length).toBeGreaterThanOrEqual(20);
    });

    it('has enough asset counts to generate 50+ hardware assets (Requirement 3.6)', () => {
      let totalAssets = 0;
      for (const state of LIFECYCLE_STATES) {
        totalAssets += ASSET_COUNTS_BY_STATE[state] ?? ASSET_COUNTS_BY_STATE['DEFAULT'] ?? 5;
      }
      expect(totalAssets).toBeGreaterThanOrEqual(50);
    });

    it('has at least 20 software products (Requirement 3.7)', () => {
      expect(SOFTWARE_PRODUCTS.length).toBeGreaterThanOrEqual(20);
    });

    it('has at least 10 enterprise assets (Requirement 3.8)', () => {
      expect(ENTERPRISE_ASSETS.length).toBeGreaterThanOrEqual(10);
    });

    it('has at least 5 contracts (Requirement 3.9)', () => {
      expect(CONTRACTS.length).toBeGreaterThanOrEqual(5);
    });

    it('has at least 10 purchase orders (Requirement 3.10)', () => {
      expect(PURCHASE_ORDERS.length).toBeGreaterThanOrEqual(10);
    });

    it('lifecycle states cover all expected states', () => {
      const expectedStates = ['ORDERED', 'RECEIVED', 'IN_STOCK', 'RESERVED', 'DEPLOYED', 'IN_MAINTENANCE', 'RETIRED', 'DISPOSED'];
      
      for (const state of expectedStates) {
        expect(LIFECYCLE_STATES).toContain(state);
      }
    });
  });
});
