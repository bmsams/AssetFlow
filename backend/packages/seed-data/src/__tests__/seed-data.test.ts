/**
 * Tests for @ams/seed-data package
 * Validates that seed data meets requirements from real-api-integration spec
 */

import {
  DEPARTMENTS,
  USERS,
  STOCKROOMS,
  MANUFACTURERS,
  MODELS,
  CONTRACTS,
  SOFTWARE_PRODUCTS,
  ENTITLEMENTS,
  ENTERPRISE_ASSETS,
  MAINTENANCE_PLANS,
  PURCHASE_ORDERS,
  TRANSFER_ORDERS,
  LOANER_CHECKOUTS,
  DISPOSAL_WORKFLOWS,
  WORK_ORDERS,
  SPARE_PARTS,
  LINEAR_ASSETS,
  LIFECYCLE_STATES,
  generateAssetTag,
  generateSerialNumber,
  generateCognitoSub,
} from '../index';

describe('@ams/seed-data', () => {
  describe('Requirement 3.1: Departments', () => {
    it('should have at least 5 departments', () => {
      expect(DEPARTMENTS.length).toBeGreaterThanOrEqual(5);
    });

    it('should have unique department codes', () => {
      const codes = DEPARTMENTS.map(d => d.code);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('should include required departments (IT, Finance, HR, Operations, Engineering)', () => {
      const codes = DEPARTMENTS.map(d => d.code);
      expect(codes).toContain('IT');
      expect(codes).toContain('FIN');
      expect(codes).toContain('HR');
      expect(codes).toContain('OPS');
      expect(codes).toContain('ENG');
    });
  });

  describe('Requirement 3.2: Users', () => {
    it('should have at least 10 users', () => {
      expect(USERS.length).toBeGreaterThanOrEqual(10);
    });

    it('should have unique email addresses', () => {
      const emails = USERS.map(u => u.email);
      expect(new Set(emails).size).toBe(emails.length);
    });

    it('should have users with different roles', () => {
      const roles = new Set(USERS.map(u => u.role));
      expect(roles.size).toBeGreaterThanOrEqual(3);
    });

    it('should include admin, asset_manager, and viewer roles', () => {
      const roles = USERS.map(u => u.role);
      expect(roles).toContain('SYSTEM_ADMIN');
      expect(roles).toContain('ASSET_MANAGER');
      expect(roles).toContain('VIEWER');
    });
  });

  describe('Requirement 3.3: Stockrooms', () => {
    it('should have at least 3 stockrooms', () => {
      expect(STOCKROOMS.length).toBeGreaterThanOrEqual(3);
    });

    it('should have unique stockroom codes', () => {
      const codes = STOCKROOMS.map(s => s.stockroomCode);
      expect(new Set(codes).size).toBe(codes.length);
    });

    it('should include Main Warehouse, IT Closet, and Remote Office', () => {
      const names = STOCKROOMS.map(s => s.name);
      expect(names).toContain('Main Warehouse');
      expect(names).toContain('IT Closet');
      expect(names).toContain('Remote Office');
    });
  });

  describe('Requirement 3.4: Manufacturers', () => {
    it('should have at least 10 manufacturers', () => {
      expect(MANUFACTURERS.length).toBeGreaterThanOrEqual(10);
    });

    it('should have unique normalized names', () => {
      const names = MANUFACTURERS.map(m => m.normalizedName);
      expect(new Set(names).size).toBe(names.length);
    });

    it('should include major manufacturers', () => {
      const names = MANUFACTURERS.map(m => m.normalizedName);
      expect(names).toContain('DELL');
      expect(names).toContain('HP');
      expect(names).toContain('LENOVO');
      expect(names).toContain('APPLE');
      expect(names).toContain('MICROSOFT');
    });
  });

  describe('Requirement 3.5: Models', () => {
    it('should have at least 20 models', () => {
      expect(MODELS.length).toBeGreaterThanOrEqual(20);
    });

    it('should have unique normalized names', () => {
      const names = MODELS.map(m => m.normalizedName);
      expect(new Set(names).size).toBe(names.length);
    });

    it('should link to valid manufacturers', () => {
      const manufacturerNames = new Set(MANUFACTURERS.map(m => m.normalizedName));
      MODELS.forEach(model => {
        expect(manufacturerNames.has(model.manufacturerName)).toBe(true);
      });
    });
  });

  describe('Requirement 3.7: Software Products', () => {
    it('should have at least 20 software products', () => {
      expect(SOFTWARE_PRODUCTS.length).toBeGreaterThanOrEqual(20);
    });

    it('should have entitlements for products', () => {
      expect(ENTITLEMENTS.length).toBeGreaterThan(0);
    });

    it('should link entitlements to valid products', () => {
      const productNames = new Set(SOFTWARE_PRODUCTS.map(p => p.productName));
      ENTITLEMENTS.forEach(e => {
        expect(productNames.has(e.productName)).toBe(true);
      });
    });
  });

  describe('Requirement 3.8: Enterprise Assets', () => {
    it('should have at least 10 enterprise assets', () => {
      expect(ENTERPRISE_ASSETS.length).toBeGreaterThanOrEqual(10);
    });

    it('should have maintenance plans', () => {
      expect(MAINTENANCE_PLANS.length).toBeGreaterThan(0);
    });

    it('should link maintenance plans to valid assets', () => {
      const assetNames = new Set(ENTERPRISE_ASSETS.map(a => a.displayName));
      MAINTENANCE_PLANS.forEach(plan => {
        expect(assetNames.has(plan.assetDisplayName)).toBe(true);
      });
    });
  });

  describe('Requirement 3.9: Contracts', () => {
    it('should have at least 5 contracts', () => {
      expect(CONTRACTS.length).toBeGreaterThanOrEqual(5);
    });

    it('should have different contract types', () => {
      const types = new Set(CONTRACTS.map(c => c.contractType));
      expect(types.size).toBeGreaterThanOrEqual(3);
    });

    it('should include Lease, Maintenance, and Support types', () => {
      const types = CONTRACTS.map(c => c.contractType);
      expect(types).toContain('LEASE');
      expect(types).toContain('MAINTENANCE');
      expect(types).toContain('SUPPORT');
    });
  });

  describe('Requirement 3.10: Purchase Orders', () => {
    it('should have at least 10 purchase orders', () => {
      expect(PURCHASE_ORDERS.length).toBeGreaterThanOrEqual(10);
    });

    it('should have line items for each PO', () => {
      PURCHASE_ORDERS.forEach(po => {
        expect(po.lines.length).toBeGreaterThan(0);
      });
    });

    it('should have unique PO numbers', () => {
      const numbers = PURCHASE_ORDERS.map(po => po.poNumber);
      expect(new Set(numbers).size).toBe(numbers.length);
    });
  });

  describe('Utility Functions', () => {
    describe('generateAssetTag', () => {
      it('should generate valid hardware asset tag', () => {
        const tag = generateAssetTag('HARDWARE');
        expect(tag).toMatch(/^AMS-HW-\d{8}-[A-Z0-9]{6}$/);
      });

      it('should generate valid software asset tag', () => {
        const tag = generateAssetTag('SOFTWARE');
        expect(tag).toMatch(/^AMS-SW-\d{8}-[A-Z0-9]{6}$/);
      });

      it('should generate valid enterprise asset tag', () => {
        const tag = generateAssetTag('ENTERPRISE');
        expect(tag).toMatch(/^AMS-EA-\d{8}-[A-Z0-9]{6}$/);
      });

      it('should generate unique tags', () => {
        const tags = new Set([
          generateAssetTag('HARDWARE'),
          generateAssetTag('HARDWARE'),
          generateAssetTag('HARDWARE'),
        ]);
        expect(tags.size).toBe(3);
      });
    });

    describe('generateSerialNumber', () => {
      it('should generate serial number with prefix', () => {
        const sn = generateSerialNumber('SN', 1);
        expect(sn).toMatch(/^SN[A-Z0-9]+0001$/);
      });
    });

    describe('generateCognitoSub', () => {
      it('should generate cognito sub from email', () => {
        const sub = generateCognitoSub('test@example.com');
        expect(sub).toBe('cognito-test-example-com');
      });
    });
  });

  describe('HAM Operations: Transfer Orders', () => {
    it('should have at least 5 transfer orders', () => {
      expect(TRANSFER_ORDERS.length).toBeGreaterThanOrEqual(5);
    });

    it('should have unique transfer numbers', () => {
      const nums = TRANSFER_ORDERS.map(t => t.transferNumber);
      expect(new Set(nums).size).toBe(nums.length);
    });

    it('should reference valid stockroom codes', () => {
      const codes = new Set(STOCKROOMS.map(s => s.stockroomCode));
      TRANSFER_ORDERS.forEach(t => {
        expect(codes.has(t.fromStockroomCode)).toBe(true);
        expect(codes.has(t.toStockroomCode)).toBe(true);
      });
    });

    it('should reference valid user emails', () => {
      const emails = new Set(USERS.map(u => u.email));
      TRANSFER_ORDERS.forEach(t => {
        expect(emails.has(t.requesterEmail)).toBe(true);
      });
    });

    it('should have line items for each transfer', () => {
      TRANSFER_ORDERS.forEach(t => {
        expect(t.lines.length).toBeGreaterThan(0);
      });
    });
  });

  describe('HAM Operations: Loaner Checkouts', () => {
    it('should have at least 5 loaner checkouts', () => {
      expect(LOANER_CHECKOUTS.length).toBeGreaterThanOrEqual(5);
    });

    it('should have unique checkout numbers', () => {
      const nums = LOANER_CHECKOUTS.map(l => l.checkoutNumber);
      expect(new Set(nums).size).toBe(nums.length);
    });

    it('should reference valid user emails', () => {
      const emails = new Set(USERS.map(u => u.email));
      LOANER_CHECKOUTS.forEach(l => {
        expect(emails.has(l.checkedOutToEmail)).toBe(true);
        expect(emails.has(l.checkedOutByEmail)).toBe(true);
      });
    });

    it('should reference valid department codes', () => {
      const codes = new Set(DEPARTMENTS.map(d => d.code));
      LOANER_CHECKOUTS.forEach(l => {
        expect(codes.has(l.departmentCode)).toBe(true);
      });
    });
  });

  describe('HAM Operations: Disposal Workflows', () => {
    it('should have at least 4 disposal workflows', () => {
      expect(DISPOSAL_WORKFLOWS.length).toBeGreaterThanOrEqual(4);
    });

    it('should have unique workflow numbers', () => {
      const nums = DISPOSAL_WORKFLOWS.map(d => d.workflowNumber);
      expect(new Set(nums).size).toBe(nums.length);
    });

    it('should reference valid user emails', () => {
      const emails = new Set(USERS.map(u => u.email));
      DISPOSAL_WORKFLOWS.forEach(d => {
        expect(emails.has(d.initiatedByEmail)).toBe(true);
      });
    });

    it('should have tasks for each workflow', () => {
      DISPOSAL_WORKFLOWS.forEach(d => {
        expect(d.tasks.length).toBeGreaterThan(0);
      });
    });
  });

  describe('EAM Operations: Work Orders', () => {
    it('should have at least 10 work orders', () => {
      expect(WORK_ORDERS.length).toBeGreaterThanOrEqual(10);
    });

    it('should have unique work order numbers', () => {
      const nums = WORK_ORDERS.map(w => w.workOrderNumber);
      expect(new Set(nums).size).toBe(nums.length);
    });

    it('should reference valid enterprise asset names', () => {
      const names = new Set(ENTERPRISE_ASSETS.map(a => a.displayName));
      WORK_ORDERS.forEach(wo => {
        expect(names.has(wo.assetDisplayName)).toBe(true);
      });
    });

    it('should reference valid facility codes', () => {
      const facilities = new Set(['HQ', 'DC1', 'WH-EAST', 'WH-WEST']);
      WORK_ORDERS.forEach(wo => {
        expect(facilities.has(wo.facilityCode)).toBe(true);
      });
    });

    it('should reference valid user emails when assigned', () => {
      const emails = new Set(USERS.map(u => u.email));
      WORK_ORDERS.filter(wo => wo.assignedToEmail).forEach(wo => {
        expect(emails.has(wo.assignedToEmail as string)).toBe(true);
      });
    });
  });

  describe('EAM Operations: Spare Parts', () => {
    it('should have at least 12 spare parts', () => {
      expect(SPARE_PARTS.length).toBeGreaterThanOrEqual(12);
    });

    it('should have unique part numbers', () => {
      const nums = SPARE_PARTS.map(p => p.partNumber);
      expect(new Set(nums).size).toBe(nums.length);
    });

    it('should have valid ABC classifications', () => {
      SPARE_PARTS.forEach(p => {
        expect(['A', 'B', 'C']).toContain(p.abcClassification);
      });
    });

    it('should have reorder points less than quantity on hand', () => {
      SPARE_PARTS.forEach(p => {
        expect(p.reorderPoint).toBeLessThanOrEqual(p.quantityOnHand);
      });
    });
  });

  describe('EAM Operations: Linear Assets', () => {
    it('should have at least 3 linear assets', () => {
      expect(LINEAR_ASSETS.length).toBeGreaterThanOrEqual(3);
    });

    it('should reference valid enterprise asset names', () => {
      const names = new Set(ENTERPRISE_ASSETS.map(a => a.displayName));
      LINEAR_ASSETS.forEach(la => {
        expect(names.has(la.assetDisplayName)).toBe(true);
      });
    });

    it('should have segments for each linear asset', () => {
      LINEAR_ASSETS.forEach(la => {
        expect(la.segments.length).toBeGreaterThan(0);
      });
    });

    it('should have segments with sequential numbers', () => {
      LINEAR_ASSETS.forEach(la => {
        la.segments.forEach((seg, idx) => {
          expect(seg.sequenceNumber).toBe(idx + 1);
        });
      });
    });

    it('should have segment lengths that sum close to total length', () => {
      LINEAR_ASSETS.forEach(la => {
        const segmentSum = la.segments.reduce((sum, s) => sum + s.segmentLength, 0);
        expect(segmentSum).toBeCloseTo(la.totalLength, 0);
      });
    });
  });

  describe('Constants', () => {
    it('should have all lifecycle states', () => {
      expect(LIFECYCLE_STATES).toContain('ORDERED');
      expect(LIFECYCLE_STATES).toContain('RECEIVED');
      expect(LIFECYCLE_STATES).toContain('IN_STOCK');
      expect(LIFECYCLE_STATES).toContain('DEPLOYED');
      expect(LIFECYCLE_STATES).toContain('RETIRED');
      expect(LIFECYCLE_STATES).toContain('DISPOSED');
    });
  });
});
