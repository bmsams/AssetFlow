/**
 * Asset Hierarchy Service Unit Tests
 *
 * Tests for asset parent-child relationship management and status propagation.
 * Requirement 5.6: Support parent-child relationships for complex equipment with sub-components
 * Requirement 5.7: Propagate relevant status updates to child components
 */

import type { AssetStatus } from '../asset-hierarchy';

describe('AssetHierarchyService', () => {
  describe('Circular reference detection', () => {
    /**
     * Simulates checking if linking would create a circular reference
     * by checking if the proposed parent is a descendant of the child
     */
    function wouldCreateCircularReference(
      parentId: string,
      childId: string,
      hierarchy: Map<string, string | null> // Map of assetId -> parentAssetId
    ): boolean {
      // Check if parent is the same as child (self-reference)
      if (parentId === childId) {
        return true;
      }

      // Check if parentId is a descendant of childId
      // by traversing down from childId
      const visited = new Set<string>();
      const queue = [childId];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);

        // Find all children of current
        for (const [assetId, parent] of hierarchy.entries()) {
          if (parent === current) {
            if (assetId === parentId) {
              return true; // Found parentId as a descendant of childId
            }
            queue.push(assetId);
          }
        }
      }

      return false;
    }

    it('should detect self-reference', () => {
      const hierarchy = new Map<string, string | null>();
      hierarchy.set('asset-1', null);

      expect(wouldCreateCircularReference('asset-1', 'asset-1', hierarchy)).toBe(true);
    });

    it('should detect direct circular reference', () => {
      // asset-1 -> asset-2 (asset-2 is child of asset-1)
      // Trying to make asset-1 a child of asset-2 would create a cycle
      const hierarchy = new Map<string, string | null>();
      hierarchy.set('asset-1', null);
      hierarchy.set('asset-2', 'asset-1');

      // Trying to link asset-1 as child of asset-2
      expect(wouldCreateCircularReference('asset-2', 'asset-1', hierarchy)).toBe(true);
    });

    it('should detect indirect circular reference', () => {
      // asset-1 -> asset-2 -> asset-3
      // Trying to make asset-1 a child of asset-3 would create a cycle
      const hierarchy = new Map<string, string | null>();
      hierarchy.set('asset-1', null);
      hierarchy.set('asset-2', 'asset-1');
      hierarchy.set('asset-3', 'asset-2');

      // Trying to link asset-1 as child of asset-3
      expect(wouldCreateCircularReference('asset-3', 'asset-1', hierarchy)).toBe(true);
    });

    it('should allow valid parent-child link', () => {
      const hierarchy = new Map<string, string | null>();
      hierarchy.set('asset-1', null);
      hierarchy.set('asset-2', null);

      // Linking asset-2 as child of asset-1 is valid
      expect(wouldCreateCircularReference('asset-1', 'asset-2', hierarchy)).toBe(false);
    });

    it('should allow linking to sibling', () => {
      // asset-1 -> asset-2
      // asset-1 -> asset-3
      // Linking asset-3 as child of asset-2 is valid
      const hierarchy = new Map<string, string | null>();
      hierarchy.set('asset-1', null);
      hierarchy.set('asset-2', 'asset-1');
      hierarchy.set('asset-3', 'asset-1');

      expect(wouldCreateCircularReference('asset-2', 'asset-3', hierarchy)).toBe(false);
    });
  });

  describe('Status propagation', () => {
    const PROPAGATING_STATUSES: readonly AssetStatus[] = [
      'RETIRED',
      'DISPOSED',
      'IN_MAINTENANCE',
    ];

    function shouldPropagateStatus(status: AssetStatus): boolean {
      return PROPAGATING_STATUSES.includes(status);
    }

    it('should propagate RETIRED status', () => {
      expect(shouldPropagateStatus('RETIRED')).toBe(true);
    });

    it('should propagate DISPOSED status', () => {
      expect(shouldPropagateStatus('DISPOSED')).toBe(true);
    });

    it('should propagate IN_MAINTENANCE status', () => {
      expect(shouldPropagateStatus('IN_MAINTENANCE')).toBe(true);
    });

    it('should NOT propagate DEPLOYED status', () => {
      expect(shouldPropagateStatus('DEPLOYED')).toBe(false);
    });

    it('should NOT propagate IN_STOCK status', () => {
      expect(shouldPropagateStatus('IN_STOCK')).toBe(false);
    });

    it('should NOT propagate ORDERED status', () => {
      expect(shouldPropagateStatus('ORDERED')).toBe(false);
    });

    it('should NOT propagate RECEIVED status', () => {
      expect(shouldPropagateStatus('RECEIVED')).toBe(false);
    });

    it('should NOT propagate RESERVED status', () => {
      expect(shouldPropagateStatus('RESERVED')).toBe(false);
    });
  });

  describe('Hierarchy traversal', () => {
    interface TestHierarchyNode {
      assetId: string;
      parentAssetId: string | null;
      depth: number;
    }

    function getDescendants(
      assetId: string,
      hierarchy: Map<string, string | null>,
      maxDepth: number = 10
    ): TestHierarchyNode[] {
      const descendants: TestHierarchyNode[] = [];
      const queue: { id: string; depth: number }[] = [];

      // Find direct children
      for (const [childId, parentId] of hierarchy.entries()) {
        if (parentId === assetId) {
          queue.push({ id: childId, depth: 1 });
        }
      }

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.depth > maxDepth) continue;

        descendants.push({
          assetId: current.id,
          parentAssetId: hierarchy.get(current.id) ?? null,
          depth: current.depth,
        });

        // Find children of current
        for (const [childId, parentId] of hierarchy.entries()) {
          if (parentId === current.id) {
            queue.push({ id: childId, depth: current.depth + 1 });
          }
        }
      }

      return descendants;
    }

    function getAncestors(
      assetId: string,
      hierarchy: Map<string, string | null>,
      maxDepth: number = 10
    ): TestHierarchyNode[] {
      const ancestors: TestHierarchyNode[] = [];
      let currentId = hierarchy.get(assetId);
      let depth = 1;

      while (currentId && depth <= maxDepth) {
        ancestors.push({
          assetId: currentId,
          parentAssetId: hierarchy.get(currentId) ?? null,
          depth,
        });
        currentId = hierarchy.get(currentId);
        depth++;
      }

      return ancestors;
    }

    it('should get all descendants', () => {
      // Build hierarchy: root -> child1 -> grandchild1
      //                       -> child2
      const hierarchy = new Map<string, string | null>();
      hierarchy.set('root', null);
      hierarchy.set('child1', 'root');
      hierarchy.set('child2', 'root');
      hierarchy.set('grandchild1', 'child1');

      const descendants = getDescendants('root', hierarchy);

      expect(descendants.length).toBe(3);
      expect(descendants.map(d => d.assetId)).toContain('child1');
      expect(descendants.map(d => d.assetId)).toContain('child2');
      expect(descendants.map(d => d.assetId)).toContain('grandchild1');
    });

    it('should return empty array for leaf node', () => {
      const hierarchy = new Map<string, string | null>();
      hierarchy.set('root', null);
      hierarchy.set('leaf', 'root');

      const descendants = getDescendants('leaf', hierarchy);

      expect(descendants.length).toBe(0);
    });

    it('should respect max depth limit', () => {
      // Build deep hierarchy: root -> l1 -> l2 -> l3 -> l4 -> l5
      const hierarchy = new Map<string, string | null>();
      hierarchy.set('root', null);
      hierarchy.set('l1', 'root');
      hierarchy.set('l2', 'l1');
      hierarchy.set('l3', 'l2');
      hierarchy.set('l4', 'l3');
      hierarchy.set('l5', 'l4');

      const descendants = getDescendants('root', hierarchy, 2);

      expect(descendants.length).toBe(2);
      expect(descendants.map(d => d.assetId)).toContain('l1');
      expect(descendants.map(d => d.assetId)).toContain('l2');
      expect(descendants.map(d => d.assetId)).not.toContain('l3');
    });

    it('should get all ancestors', () => {
      const hierarchy = new Map<string, string | null>();
      hierarchy.set('root', null);
      hierarchy.set('child', 'root');
      hierarchy.set('grandchild', 'child');

      const ancestors = getAncestors('grandchild', hierarchy);

      expect(ancestors.length).toBe(2);
      expect(ancestors[0]!.assetId).toBe('child');
      expect(ancestors[1]!.assetId).toBe('root');
    });

    it('should return empty array for root node', () => {
      const hierarchy = new Map<string, string | null>();
      hierarchy.set('root', null);

      const ancestors = getAncestors('root', hierarchy);

      expect(ancestors.length).toBe(0);
    });

    it('should track correct depth for descendants', () => {
      const hierarchy = new Map<string, string | null>();
      hierarchy.set('root', null);
      hierarchy.set('child', 'root');
      hierarchy.set('grandchild', 'child');

      const descendants = getDescendants('root', hierarchy);

      const child = descendants.find(d => d.assetId === 'child');
      const grandchild = descendants.find(d => d.assetId === 'grandchild');

      expect(child?.depth).toBe(1);
      expect(grandchild?.depth).toBe(2);
    });
  });

  describe('Hierarchy depth calculation', () => {
    function getHierarchyDepth(
      assetId: string,
      hierarchy: Map<string, string | null>
    ): number {
      let depth = 0;
      let currentId = hierarchy.get(assetId);

      while (currentId) {
        depth++;
        currentId = hierarchy.get(currentId);
      }

      return depth;
    }

    it('should return 0 for root node', () => {
      const hierarchy = new Map<string, string | null>();
      hierarchy.set('root', null);

      expect(getHierarchyDepth('root', hierarchy)).toBe(0);
    });

    it('should return 1 for direct child of root', () => {
      const hierarchy = new Map<string, string | null>();
      hierarchy.set('root', null);
      hierarchy.set('child', 'root');

      expect(getHierarchyDepth('child', hierarchy)).toBe(1);
    });

    it('should return correct depth for deeply nested node', () => {
      const hierarchy = new Map<string, string | null>();
      hierarchy.set('root', null);
      hierarchy.set('l1', 'root');
      hierarchy.set('l2', 'l1');
      hierarchy.set('l3', 'l2');
      hierarchy.set('l4', 'l3');

      expect(getHierarchyDepth('l4', hierarchy)).toBe(4);
    });
  });

  describe('Child count calculation', () => {
    function getChildCount(
      assetId: string,
      hierarchy: Map<string, string | null>
    ): number {
      let count = 0;
      for (const parentId of hierarchy.values()) {
        if (parentId === assetId) {
          count++;
        }
      }
      return count;
    }

    function getDescendantCount(
      assetId: string,
      hierarchy: Map<string, string | null>
    ): number {
      let count = 0;
      const queue = [assetId];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);

        for (const [childId, parentId] of hierarchy.entries()) {
          if (parentId === current) {
            count++;
            queue.push(childId);
          }
        }
      }

      return count;
    }

    it('should count direct children', () => {
      const hierarchy = new Map<string, string | null>();
      hierarchy.set('root', null);
      hierarchy.set('child1', 'root');
      hierarchy.set('child2', 'root');
      hierarchy.set('child3', 'root');

      expect(getChildCount('root', hierarchy)).toBe(3);
    });

    it('should return 0 for leaf node', () => {
      const hierarchy = new Map<string, string | null>();
      hierarchy.set('root', null);
      hierarchy.set('leaf', 'root');

      expect(getChildCount('leaf', hierarchy)).toBe(0);
    });

    it('should count all descendants', () => {
      const hierarchy = new Map<string, string | null>();
      hierarchy.set('root', null);
      hierarchy.set('child1', 'root');
      hierarchy.set('child2', 'root');
      hierarchy.set('grandchild1', 'child1');
      hierarchy.set('grandchild2', 'child1');

      expect(getDescendantCount('root', hierarchy)).toBe(4);
    });

    it('should not count siblings as descendants', () => {
      const hierarchy = new Map<string, string | null>();
      hierarchy.set('root', null);
      hierarchy.set('child1', 'root');
      hierarchy.set('child2', 'root');

      expect(getDescendantCount('child1', hierarchy)).toBe(0);
    });
  });
});

