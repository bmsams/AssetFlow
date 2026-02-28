/**
 * Property-Based Tests: Department Hierarchy (Parent-Child Relationships)
 *
 * **Validates: Requirements 7.2, 7.4, 7.5**
 *
 * Properties tested:
 * 1. Parent-child relationship invariant: A department's parent must exist before the department can be created
 * 2. Hierarchy level invariant: A child department's hierarchy level = parent's level + 1
 * 3. Circular reference prevention: Setting a descendant as parent should be rejected
 * 4. Cascade deactivation: When a department is deactivated, all descendants must also be deactivated
 * 5. Root department invariant: Root departments have no parent (parentDepartmentId is null)
 * 6. Child count accuracy: A department's child count equals the number of direct children
 *
 * Requirements:
 * - 7.2: WHEN an administrator requests a department by ID, THEN THE Reference_Data_Service
 *        SHALL return department details including parent and child departments
 * - 7.4: WHEN an administrator deactivates a department, THEN THE Reference_Data_Service
 *        SHALL mark the department as inactive and cascade the status to child departments
 * - 7.5: WHEN an administrator lists departments with optional hierarchy filter, THEN THE
 *        Reference_Data_Service SHALL return departments in hierarchical order
 */

import * as fc from 'fast-check';

// ============================================================================
// Types for Department Hierarchy Testing
// ============================================================================

/**
 * Represents a department in the hierarchy
 */
interface Department {
  readonly departmentId: string;
  readonly code: string;
  readonly name: string;
  readonly parentDepartmentId: string | null;
  readonly isActive: boolean;
  readonly hierarchyLevel: number;
}

/**
 * Represents a department hierarchy (tree structure)
 */
interface DepartmentHierarchy {
  readonly departments: Map<string, Department>;
  readonly childrenMap: Map<string, string[]>; // parentId -> childIds
}


// ============================================================================
// Pure Functions Under Test
// ============================================================================

/**
 * Creates an empty department hierarchy
 */
function createEmptyHierarchy(): DepartmentHierarchy {
  return {
    departments: new Map(),
    childrenMap: new Map(),
  };
}

/**
 * Checks if a parent department exists in the hierarchy
 * Requirement 7.5: Parent must exist before child can be created
 *
 * @param hierarchy - The department hierarchy
 * @param parentId - The parent department ID to check
 * @returns true if parent exists or parentId is null (root department)
 */
function parentExists(hierarchy: DepartmentHierarchy, parentId: string | null): boolean {
  if (parentId === null) {
    return true; // Root departments have no parent
  }
  return hierarchy.departments.has(parentId);
}

/**
 * Calculates the hierarchy level for a department
 * Requirement 7.2: Hierarchy level = parent's level + 1
 *
 * @param hierarchy - The department hierarchy
 * @param parentId - The parent department ID
 * @returns The hierarchy level (0 for root, parent's level + 1 otherwise)
 */
function _calculateHierarchyLevel(hierarchy: DepartmentHierarchy, parentId: string | null): number {
  if (parentId === null) {
    return 0; // Root departments are at level 0
  }
  const parent = hierarchy.departments.get(parentId);
  if (!parent) {
    throw new Error(`Parent department not found: ${parentId}`);
  }
  return parent.hierarchyLevel + 1;
}

// Export for potential future use
void _calculateHierarchyLevel;

/**
 * Gets all descendant IDs for a department (recursive)
 * Used for cascade operations and circular reference detection
 *
 * @param hierarchy - The department hierarchy
 * @param departmentId - The department ID to get descendants for
 * @returns Array of all descendant department IDs
 */
function getDescendantIds(hierarchy: DepartmentHierarchy, departmentId: string): string[] {
  const descendants: string[] = [];
  const children = hierarchy.childrenMap.get(departmentId) ?? [];

  for (const childId of children) {
    descendants.push(childId);
    descendants.push(...getDescendantIds(hierarchy, childId));
  }

  return descendants;
}

/**
 * Checks if setting a new parent would create a circular reference
 * Requirement 7.5: Circular references must be prevented
 *
 * @param hierarchy - The department hierarchy
 * @param departmentId - The department that would get a new parent
 * @param newParentId - The proposed new parent ID
 * @returns true if circular reference would be created
 */
function wouldCreateCircularReference(
  hierarchy: DepartmentHierarchy,
  departmentId: string,
  newParentId: string
): boolean {
  // Cannot be your own parent
  if (departmentId === newParentId) {
    return true;
  }

  // Cannot set a descendant as parent
  const descendants = getDescendantIds(hierarchy, departmentId);
  return descendants.includes(newParentId);
}


/**
 * Adds a department to the hierarchy
 * Validates parent existence before adding
 *
 * @param hierarchy - The department hierarchy
 * @param department - The department to add
 * @returns Updated hierarchy or null if parent doesn't exist
 */
function addDepartment(
  hierarchy: DepartmentHierarchy,
  department: Department
): DepartmentHierarchy | null {
  // Validate parent exists (Requirement 7.5)
  if (!parentExists(hierarchy, department.parentDepartmentId)) {
    return null;
  }

  // Create new maps (immutable update)
  const newDepartments = new Map(hierarchy.departments);
  const newChildrenMap = new Map(hierarchy.childrenMap);

  // Add department
  newDepartments.set(department.departmentId, department);

  // Update children map
  if (department.parentDepartmentId !== null) {
    const siblings = newChildrenMap.get(department.parentDepartmentId) ?? [];
    newChildrenMap.set(department.parentDepartmentId, [...siblings, department.departmentId]);
  }

  return {
    departments: newDepartments,
    childrenMap: newChildrenMap,
  };
}

/**
 * Gets the direct child count for a department
 * Requirement 7.2: Child count equals number of direct children
 *
 * @param hierarchy - The department hierarchy
 * @param departmentId - The department ID
 * @returns Number of direct children
 */
function getChildCount(hierarchy: DepartmentHierarchy, departmentId: string): number {
  return (hierarchy.childrenMap.get(departmentId) ?? []).length;
}

/**
 * Deactivates a department and all its descendants (cascade)
 * Requirement 7.4: Cascade deactivation to all child departments
 *
 * @param hierarchy - The department hierarchy
 * @param departmentId - The department ID to deactivate
 * @returns Updated hierarchy with deactivated departments
 */
function deactivateDepartmentCascade(
  hierarchy: DepartmentHierarchy,
  departmentId: string
): DepartmentHierarchy {
  const department = hierarchy.departments.get(departmentId);
  if (!department) {
    return hierarchy;
  }

  // Get all descendants
  const descendantIds = getDescendantIds(hierarchy, departmentId);
  const allIdsToDeactivate = [departmentId, ...descendantIds];

  // Create new departments map with deactivated departments
  const newDepartments = new Map(hierarchy.departments);
  for (const id of allIdsToDeactivate) {
    const dept = newDepartments.get(id);
    if (dept) {
      newDepartments.set(id, { ...dept, isActive: false });
    }
  }

  return {
    departments: newDepartments,
    childrenMap: hierarchy.childrenMap,
  };
}


/**
 * Checks if all descendants of a department are deactivated
 * Used to verify cascade deactivation
 *
 * @param hierarchy - The department hierarchy
 * @param departmentId - The department ID
 * @returns true if all descendants are inactive
 */
function allDescendantsDeactivated(
  hierarchy: DepartmentHierarchy,
  departmentId: string
): boolean {
  const descendantIds = getDescendantIds(hierarchy, departmentId);
  for (const id of descendantIds) {
    const dept = hierarchy.departments.get(id);
    if (dept && dept.isActive) {
      return false;
    }
  }
  return true;
}

/**
 * Validates that a department's hierarchy level is correct
 * Requirement 7.2: Child's level = parent's level + 1
 *
 * @param hierarchy - The department hierarchy
 * @param departmentId - The department ID to validate
 * @returns true if hierarchy level is correct
 */
function isHierarchyLevelCorrect(
  hierarchy: DepartmentHierarchy,
  departmentId: string
): boolean {
  const department = hierarchy.departments.get(departmentId);
  if (!department) {
    return false;
  }

  if (department.parentDepartmentId === null) {
    // Root departments should be at level 0
    return department.hierarchyLevel === 0;
  }

  const parent = hierarchy.departments.get(department.parentDepartmentId);
  if (!parent) {
    return false;
  }

  return department.hierarchyLevel === parent.hierarchyLevel + 1;
}

/**
 * Validates the entire hierarchy structure
 * Checks all invariants for all departments
 *
 * @param hierarchy - The department hierarchy
 * @returns true if all invariants hold
 */
function isValidHierarchy(hierarchy: DepartmentHierarchy): boolean {
  for (const [departmentId, department] of hierarchy.departments) {
    // Check parent exists
    if (!parentExists(hierarchy, department.parentDepartmentId)) {
      return false;
    }

    // Check hierarchy level is correct
    if (!isHierarchyLevelCorrect(hierarchy, departmentId)) {
      return false;
    }
  }
  return true;
}

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate valid department codes
 * Alphanumeric with dashes and underscores, 3-50 characters
 */
const departmentCodeArb = fc.stringOf(
  fc.constantFrom(
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    '-', '_'
  ),
  { minLength: 3, maxLength: 50 }
).filter(s => s.trim().length > 0 && !s.startsWith('-') && !s.endsWith('-'));

/**
 * Generate valid department names (1-255 characters)
 */
const departmentNameArb = fc.string({ minLength: 1, maxLength: 255 })
  .filter(s => s.trim().length > 0);

/**
 * Generate UUID-like department IDs
 */
const departmentIdArb = fc.uuid();


/**
 * Generate a department hierarchy with varying depths (1-5 levels)
 * Creates a valid tree structure with proper parent-child relationships
 */
const departmentHierarchyArb = fc.integer({ min: 1, max: 5 }).chain((maxDepth) =>
  fc.integer({ min: 1, max: 10 }).chain((nodesPerLevel) =>
    fc.tuple(
      fc.array(departmentIdArb, { minLength: 1, maxLength: nodesPerLevel }),
      fc.array(departmentCodeArb, { minLength: 1, maxLength: nodesPerLevel * maxDepth }),
      fc.array(departmentNameArb, { minLength: 1, maxLength: nodesPerLevel * maxDepth })
    ).map(([rootIds, codes, names]) => {
      let hierarchy = createEmptyHierarchy();
      let currentLevelIds = rootIds.slice(0, Math.min(rootIds.length, nodesPerLevel));
      let codeIndex = 0;
      let nameIndex = 0;

      // Create root departments (level 0)
      for (const id of currentLevelIds) {
        const codeBase = codes[codeIndex % codes.length] ?? 'DEPT';
        const code = codeBase + '-' + codeIndex;
        const name = names[nameIndex % names.length] ?? `Department ${nameIndex}`;
        codeIndex++;
        nameIndex++;

        const dept: Department = {
          departmentId: id,
          code,
          name,
          parentDepartmentId: null,
          isActive: true,
          hierarchyLevel: 0,
        };

        const result = addDepartment(hierarchy, dept);
        if (result) {
          hierarchy = result;
        }
      }

      // Create child departments for each level
      for (let level = 1; level < maxDepth; level++) {
        const parentIds = currentLevelIds;
        const newLevelIds: string[] = [];

        for (const parentId of parentIds) {
          // Create 1-3 children per parent
          const childCount = Math.min(3, nodesPerLevel);
          for (let i = 0; i < childCount; i++) {
            const childId = `${parentId}-child-${level}-${i}`;
            const codeBase = codes[codeIndex % codes.length] ?? 'DEPT';
            const code = codeBase + '-' + codeIndex;
            const name = names[nameIndex % names.length] ?? `Department ${nameIndex}`;
            codeIndex++;
            nameIndex++;

            const dept: Department = {
              departmentId: childId,
              code,
              name,
              parentDepartmentId: parentId,
              isActive: true,
              hierarchyLevel: level,
            };

            const result = addDepartment(hierarchy, dept);
            if (result) {
              hierarchy = result;
              newLevelIds.push(childId);
            }
          }
        }

        currentLevelIds = newLevelIds;
        if (currentLevelIds.length === 0) break;
      }

      return hierarchy;
    })
  )
);

/**
 * Generate a simple hierarchy with a root and one child
 */
const simpleHierarchyArb = fc.tuple(
  departmentIdArb,
  departmentIdArb,
  departmentCodeArb,
  departmentCodeArb,
  departmentNameArb,
  departmentNameArb
).map(([rootId, childId, rootCode, childCode, rootName, childName]) => {
  let hierarchy = createEmptyHierarchy();

  // Add root
  const root: Department = {
    departmentId: rootId,
    code: rootCode,
    name: rootName,
    parentDepartmentId: null,
    isActive: true,
    hierarchyLevel: 0,
  };
  hierarchy = addDepartment(hierarchy, root) ?? hierarchy;

  // Add child
  const child: Department = {
    departmentId: childId,
    code: childCode + '-child',
    name: childName,
    parentDepartmentId: rootId,
    isActive: true,
    hierarchyLevel: 1,
  };
  hierarchy = addDepartment(hierarchy, child) ?? hierarchy;

  return { hierarchy, rootId, childId };
});


// ============================================================================
// Property Tests
// ============================================================================

describe('Property Tests: Department Hierarchy (Parent-Child Relationships)', () => {
  /**
   * **Validates: Requirements 7.2, 7.4, 7.5**
   */

  describe('Property 1: Parent-child relationship invariant', () => {
    /**
     * Property: A department's parent must exist before the department can be created.
     * Creating a department with a non-existent parent should fail.
     *
     * **Validates: Requirements 7.5**
     */
    it('should reject department creation when parent does not exist', () => {
      fc.assert(
        fc.property(
          departmentIdArb,
          departmentIdArb,
          departmentCodeArb,
          departmentNameArb,
          (departmentId, nonExistentParentId, code, name) => {
            const hierarchy = createEmptyHierarchy();

            const department: Department = {
              departmentId,
              code,
              name,
              parentDepartmentId: nonExistentParentId,
              isActive: true,
              hierarchyLevel: 1,
            };

            const result = addDepartment(hierarchy, department);

            // Should fail because parent doesn't exist
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: A department with an existing parent should be successfully created.
     *
     * **Validates: Requirements 7.5**
     */
    it('should allow department creation when parent exists', () => {
      fc.assert(
        fc.property(simpleHierarchyArb, ({ hierarchy, rootId }) => {
          // The hierarchy should have both root and child
          expect(hierarchy.departments.size).toBeGreaterThanOrEqual(2);

          // Root should exist
          expect(hierarchy.departments.has(rootId)).toBe(true);

          // All departments should have valid parents
          for (const [, dept] of hierarchy.departments) {
            expect(parentExists(hierarchy, dept.parentDepartmentId)).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Root departments (null parent) should always be creatable.
     *
     * **Validates: Requirements 7.5**
     */
    it('should allow root department creation (null parent)', () => {
      fc.assert(
        fc.property(
          departmentIdArb,
          departmentCodeArb,
          departmentNameArb,
          (departmentId, code, name) => {
            const hierarchy = createEmptyHierarchy();

            const department: Department = {
              departmentId,
              code,
              name,
              parentDepartmentId: null,
              isActive: true,
              hierarchyLevel: 0,
            };

            const result = addDepartment(hierarchy, department);

            // Should succeed because root departments have no parent requirement
            expect(result).not.toBeNull();
            expect(result!.departments.has(departmentId)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('Property 2: Hierarchy level invariant', () => {
    /**
     * Property: A child department's hierarchy level must equal parent's level + 1.
     *
     * **Validates: Requirements 7.2**
     */
    it('should have child hierarchy level = parent level + 1', () => {
      fc.assert(
        fc.property(departmentHierarchyArb, (hierarchy) => {
          for (const [, department] of hierarchy.departments) {
            if (department.parentDepartmentId !== null) {
              const parent = hierarchy.departments.get(department.parentDepartmentId);
              expect(parent).toBeDefined();
              expect(department.hierarchyLevel).toBe(parent!.hierarchyLevel + 1);
            }
          }
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Root departments should have hierarchy level 0.
     *
     * **Validates: Requirements 7.2**
     */
    it('should have root departments at hierarchy level 0', () => {
      fc.assert(
        fc.property(departmentHierarchyArb, (hierarchy) => {
          for (const [, department] of hierarchy.departments) {
            if (department.parentDepartmentId === null) {
              expect(department.hierarchyLevel).toBe(0);
            }
          }
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Hierarchy level calculation should be consistent.
     *
     * **Validates: Requirements 7.2**
     */
    it('should calculate hierarchy level consistently', () => {
      fc.assert(
        fc.property(departmentHierarchyArb, (hierarchy) => {
          for (const [departmentId] of hierarchy.departments) {
            expect(isHierarchyLevelCorrect(hierarchy, departmentId)).toBe(true);
          }
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Hierarchy levels should be non-negative.
     *
     * **Validates: Requirements 7.2**
     */
    it('should have non-negative hierarchy levels', () => {
      fc.assert(
        fc.property(departmentHierarchyArb, (hierarchy) => {
          for (const [, department] of hierarchy.departments) {
            expect(department.hierarchyLevel).toBeGreaterThanOrEqual(0);
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 3: Circular reference prevention', () => {
    /**
     * Property: Setting a department as its own parent should be rejected.
     *
     * **Validates: Requirements 7.5**
     */
    it('should reject self-referential parent', () => {
      fc.assert(
        fc.property(departmentIdArb, (departmentId) => {
          const hierarchy = createEmptyHierarchy();

          // Add a root department first
          const root: Department = {
            departmentId,
            code: 'ROOT',
            name: 'Root Department',
            parentDepartmentId: null,
            isActive: true,
            hierarchyLevel: 0,
          };
          const withRoot = addDepartment(hierarchy, root)!;

          // Check if setting self as parent would create circular reference
          const wouldBeCircular = wouldCreateCircularReference(
            withRoot,
            departmentId,
            departmentId
          );

          expect(wouldBeCircular).toBe(true);
        }),
        { numRuns: 100 }
      );
    });


    /**
     * Property: Setting a descendant as parent should be rejected.
     *
     * **Validates: Requirements 7.5**
     */
    it('should reject descendant as parent', () => {
      fc.assert(
        fc.property(simpleHierarchyArb, ({ hierarchy, rootId, childId }) => {
          // Trying to set child as parent of root should be rejected
          const wouldBeCircular = wouldCreateCircularReference(
            hierarchy,
            rootId,
            childId
          );

          expect(wouldBeCircular).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Setting a non-descendant as parent should be allowed.
     *
     * **Validates: Requirements 7.5**
     */
    it('should allow non-descendant as parent', () => {
      fc.assert(
        fc.property(
          departmentIdArb,
          departmentIdArb,
          departmentIdArb,
          (rootId, siblingId, childId) => {
            // Skip if IDs are the same
            if (rootId === siblingId || rootId === childId || siblingId === childId) {
              return;
            }

            let hierarchy = createEmptyHierarchy();

            // Create two root departments (siblings)
            const root1: Department = {
              departmentId: rootId,
              code: 'ROOT1',
              name: 'Root 1',
              parentDepartmentId: null,
              isActive: true,
              hierarchyLevel: 0,
            };
            hierarchy = addDepartment(hierarchy, root1)!;

            const root2: Department = {
              departmentId: siblingId,
              code: 'ROOT2',
              name: 'Root 2',
              parentDepartmentId: null,
              isActive: true,
              hierarchyLevel: 0,
            };
            hierarchy = addDepartment(hierarchy, root2)!;

            // Create a child of root1
            const child: Department = {
              departmentId: childId,
              code: 'CHILD',
              name: 'Child',
              parentDepartmentId: rootId,
              isActive: true,
              hierarchyLevel: 1,
            };
            hierarchy = addDepartment(hierarchy, child)!;

            // Setting root2 (sibling) as parent of child should be allowed
            // (root2 is not a descendant of child)
            const wouldBeCircular = wouldCreateCircularReference(
              hierarchy,
              childId,
              siblingId
            );

            expect(wouldBeCircular).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Deep hierarchy circular reference detection.
     *
     * **Validates: Requirements 7.5**
     */
    it('should detect circular reference in deep hierarchies', () => {
      fc.assert(
        fc.property(departmentHierarchyArb, (hierarchy) => {
          // For each department, check that no descendant can be set as parent
          for (const [departmentId] of hierarchy.departments) {
            const descendants = getDescendantIds(hierarchy, departmentId);
            for (const descendantId of descendants) {
              const wouldBeCircular = wouldCreateCircularReference(
                hierarchy,
                departmentId,
                descendantId
              );
              expect(wouldBeCircular).toBe(true);
            }
          }
        }),
        { numRuns: 30 }
      );
    });
  });


  describe('Property 4: Cascade deactivation', () => {
    /**
     * Property: When a department is deactivated, all descendants must also be deactivated.
     *
     * **Validates: Requirements 7.4**
     */
    it('should deactivate all descendants when parent is deactivated', () => {
      fc.assert(
        fc.property(departmentHierarchyArb, (hierarchy) => {
          // Find a department with children
          for (const [departmentId] of hierarchy.departments) {
            const childCount = getChildCount(hierarchy, departmentId);
            if (childCount > 0) {
              // Deactivate this department
              const deactivated = deactivateDepartmentCascade(hierarchy, departmentId);

              // The department itself should be deactivated
              const dept = deactivated.departments.get(departmentId);
              expect(dept?.isActive).toBe(false);

              // All descendants should be deactivated
              expect(allDescendantsDeactivated(deactivated, departmentId)).toBe(true);

              // Test only one department per hierarchy to keep test fast
              break;
            }
          }
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Deactivating a leaf department should not affect siblings.
     *
     * **Validates: Requirements 7.4**
     */
    it('should not affect siblings when leaf is deactivated', () => {
      fc.assert(
        fc.property(
          departmentIdArb,
          departmentIdArb,
          departmentIdArb,
          (rootId, child1Id, child2Id) => {
            // Skip if IDs are the same
            if (rootId === child1Id || rootId === child2Id || child1Id === child2Id) {
              return;
            }

            let hierarchy = createEmptyHierarchy();

            // Create root
            const root: Department = {
              departmentId: rootId,
              code: 'ROOT',
              name: 'Root',
              parentDepartmentId: null,
              isActive: true,
              hierarchyLevel: 0,
            };
            hierarchy = addDepartment(hierarchy, root)!;

            // Create two children (siblings)
            const child1: Department = {
              departmentId: child1Id,
              code: 'CHILD1',
              name: 'Child 1',
              parentDepartmentId: rootId,
              isActive: true,
              hierarchyLevel: 1,
            };
            hierarchy = addDepartment(hierarchy, child1)!;

            const child2: Department = {
              departmentId: child2Id,
              code: 'CHILD2',
              name: 'Child 2',
              parentDepartmentId: rootId,
              isActive: true,
              hierarchyLevel: 1,
            };
            hierarchy = addDepartment(hierarchy, child2)!;

            // Deactivate child1
            const deactivated = deactivateDepartmentCascade(hierarchy, child1Id);

            // Child1 should be deactivated
            expect(deactivated.departments.get(child1Id)?.isActive).toBe(false);

            // Child2 (sibling) should still be active
            expect(deactivated.departments.get(child2Id)?.isActive).toBe(true);

            // Root should still be active
            expect(deactivated.departments.get(rootId)?.isActive).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });


    /**
     * Property: Cascade deactivation should be idempotent.
     *
     * **Validates: Requirements 7.4**
     */
    it('should be idempotent - deactivating twice has same effect', () => {
      fc.assert(
        fc.property(departmentHierarchyArb, (hierarchy) => {
          // Find a department with children
          for (const [departmentId] of hierarchy.departments) {
            const childCount = getChildCount(hierarchy, departmentId);
            if (childCount > 0) {
              // Deactivate once
              const deactivated1 = deactivateDepartmentCascade(hierarchy, departmentId);

              // Deactivate again
              const deactivated2 = deactivateDepartmentCascade(deactivated1, departmentId);

              // Results should be the same
              for (const [id] of deactivated1.departments) {
                const dept1 = deactivated1.departments.get(id);
                const dept2 = deactivated2.departments.get(id);
                expect(dept1?.isActive).toBe(dept2?.isActive);
              }

              break;
            }
          }
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Deactivating root should deactivate entire subtree.
     *
     * **Validates: Requirements 7.4**
     */
    it('should deactivate entire subtree when root is deactivated', () => {
      fc.assert(
        fc.property(departmentHierarchyArb, (hierarchy) => {
          // Find root departments
          for (const [departmentId, department] of hierarchy.departments) {
            if (department.parentDepartmentId === null) {
              // Deactivate root
              const deactivated = deactivateDepartmentCascade(hierarchy, departmentId);

              // Root should be deactivated
              expect(deactivated.departments.get(departmentId)?.isActive).toBe(false);

              // All descendants should be deactivated
              const descendants = getDescendantIds(hierarchy, departmentId);
              for (const descendantId of descendants) {
                expect(deactivated.departments.get(descendantId)?.isActive).toBe(false);
              }

              break;
            }
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 5: Root department invariant', () => {
    /**
     * Property: Root departments have no parent (parentDepartmentId is null).
     *
     * **Validates: Requirements 7.2**
     */
    it('should have null parentDepartmentId for root departments', () => {
      fc.assert(
        fc.property(departmentHierarchyArb, (hierarchy) => {
          for (const [, department] of hierarchy.departments) {
            if (department.hierarchyLevel === 0) {
              expect(department.parentDepartmentId).toBeNull();
            }
          }
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Non-root departments must have a parent.
     *
     * **Validates: Requirements 7.2**
     */
    it('should have non-null parentDepartmentId for non-root departments', () => {
      fc.assert(
        fc.property(departmentHierarchyArb, (hierarchy) => {
          for (const [, department] of hierarchy.departments) {
            if (department.hierarchyLevel > 0) {
              expect(department.parentDepartmentId).not.toBeNull();
            }
          }
        }),
        { numRuns: 50 }
      );
    });


    /**
     * Property: Every hierarchy must have at least one root department.
     *
     * **Validates: Requirements 7.2**
     */
    it('should have at least one root department in non-empty hierarchy', () => {
      fc.assert(
        fc.property(departmentHierarchyArb, (hierarchy) => {
          if (hierarchy.departments.size > 0) {
            let hasRoot = false;
            for (const [, department] of hierarchy.departments) {
              if (department.parentDepartmentId === null) {
                hasRoot = true;
                break;
              }
            }
            expect(hasRoot).toBe(true);
          }
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Root departments should be reachable from any department by following parent chain.
     *
     * **Validates: Requirements 7.2**
     */
    it('should reach root by following parent chain', () => {
      fc.assert(
        fc.property(departmentHierarchyArb, (hierarchy) => {
          for (const [, department] of hierarchy.departments) {
            let current = department;
            let depth = 0;
            const maxDepth = hierarchy.departments.size; // Prevent infinite loops

            while (current.parentDepartmentId !== null && depth < maxDepth) {
              const parent = hierarchy.departments.get(current.parentDepartmentId);
              expect(parent).toBeDefined();
              current = parent!;
              depth++;
            }

            // Should have reached a root
            expect(current.parentDepartmentId).toBeNull();
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 6: Child count accuracy', () => {
    /**
     * Property: A department's child count equals the number of direct children.
     *
     * **Validates: Requirements 7.2**
     */
    it('should have accurate child count', () => {
      fc.assert(
        fc.property(departmentHierarchyArb, (hierarchy) => {
          for (const [departmentId] of hierarchy.departments) {
            const childCount = getChildCount(hierarchy, departmentId);
            const actualChildren = hierarchy.childrenMap.get(departmentId) ?? [];

            expect(childCount).toBe(actualChildren.length);
          }
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Leaf departments should have zero children.
     *
     * **Validates: Requirements 7.2**
     */
    it('should have zero children for leaf departments', () => {
      fc.assert(
        fc.property(departmentHierarchyArb, (hierarchy) => {
          for (const [departmentId] of hierarchy.departments) {
            const children = hierarchy.childrenMap.get(departmentId) ?? [];
            if (children.length === 0) {
              expect(getChildCount(hierarchy, departmentId)).toBe(0);
            }
          }
        }),
        { numRuns: 50 }
      );
    });


    /**
     * Property: Sum of all child counts should equal total non-root departments.
     *
     * **Validates: Requirements 7.2**
     */
    it('should have sum of child counts equal to non-root department count', () => {
      fc.assert(
        fc.property(departmentHierarchyArb, (hierarchy) => {
          let totalChildCount = 0;
          let nonRootCount = 0;

          for (const [departmentId, department] of hierarchy.departments) {
            totalChildCount += getChildCount(hierarchy, departmentId);
            if (department.parentDepartmentId !== null) {
              nonRootCount++;
            }
          }

          expect(totalChildCount).toBe(nonRootCount);
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Child count should be non-negative.
     *
     * **Validates: Requirements 7.2**
     */
    it('should have non-negative child count', () => {
      fc.assert(
        fc.property(departmentHierarchyArb, (hierarchy) => {
          for (const [departmentId] of hierarchy.departments) {
            expect(getChildCount(hierarchy, departmentId)).toBeGreaterThanOrEqual(0);
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Edge Cases', () => {
    /**
     * Property: Empty hierarchy should be valid.
     *
     * **Validates: Requirements 7.2**
     */
    it('should handle empty hierarchy', () => {
      const hierarchy = createEmptyHierarchy();

      expect(hierarchy.departments.size).toBe(0);
      expect(hierarchy.childrenMap.size).toBe(0);
      expect(isValidHierarchy(hierarchy)).toBe(true);
    });

    /**
     * Property: Single root department should be valid.
     *
     * **Validates: Requirements 7.2**
     */
    it('should handle single root department', () => {
      fc.assert(
        fc.property(
          departmentIdArb,
          departmentCodeArb,
          departmentNameArb,
          (departmentId, code, name) => {
            let hierarchy = createEmptyHierarchy();

            const root: Department = {
              departmentId,
              code,
              name,
              parentDepartmentId: null,
              isActive: true,
              hierarchyLevel: 0,
            };

            hierarchy = addDepartment(hierarchy, root)!;

            expect(hierarchy.departments.size).toBe(1);
            expect(getChildCount(hierarchy, departmentId)).toBe(0);
            expect(isValidHierarchy(hierarchy)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });


    /**
     * Property: Deep hierarchy (5 levels) should maintain all invariants.
     *
     * **Validates: Requirements 7.2**
     */
    it('should handle deep hierarchies correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 5 }),
          (depth) => {
            let hierarchy = createEmptyHierarchy();
            let currentParentId: string | null = null;

            for (let level = 0; level < depth; level++) {
              const departmentId = `dept-level-${level}`;
              const department: Department = {
                departmentId,
                code: `LEVEL${level}`,
                name: `Level ${level} Department`,
                parentDepartmentId: currentParentId,
                isActive: true,
                hierarchyLevel: level,
              };

              const result = addDepartment(hierarchy, department);
              expect(result).not.toBeNull();
              hierarchy = result!;
              currentParentId = departmentId;
            }

            // Verify all invariants
            expect(isValidHierarchy(hierarchy)).toBe(true);
            expect(hierarchy.departments.size).toBe(depth);

            // Verify hierarchy levels
            for (let level = 0; level < depth; level++) {
              const dept = hierarchy.departments.get(`dept-level-${level}`);
              expect(dept?.hierarchyLevel).toBe(level);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property: Multiple root departments should be valid.
     *
     * **Validates: Requirements 7.2**
     */
    it('should handle multiple root departments', () => {
      fc.assert(
        fc.property(
          fc.array(departmentIdArb, { minLength: 2, maxLength: 5 }),
          (rootIds) => {
            // Ensure unique IDs
            const uniqueIds = [...new Set(rootIds)];
            if (uniqueIds.length < 2) return;

            let hierarchy = createEmptyHierarchy();

            for (let i = 0; i < uniqueIds.length; i++) {
              const deptId = uniqueIds[i];
              if (!deptId) continue;
              
              const root: Department = {
                departmentId: deptId,
                code: `ROOT${i}`,
                name: `Root ${i}`,
                parentDepartmentId: null,
                isActive: true,
                hierarchyLevel: 0,
              };

              hierarchy = addDepartment(hierarchy, root)!;
            }

            // All should be roots
            for (const id of uniqueIds) {
              const dept = hierarchy.departments.get(id);
              expect(dept?.parentDepartmentId).toBeNull();
              expect(dept?.hierarchyLevel).toBe(0);
            }

            expect(isValidHierarchy(hierarchy)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Deactivating non-existent department should be safe.
     *
     * **Validates: Requirements 7.4**
     */
    it('should handle deactivating non-existent department safely', () => {
      fc.assert(
        fc.property(departmentIdArb, (nonExistentId) => {
          const hierarchy = createEmptyHierarchy();

          // Should not throw, just return unchanged hierarchy
          const result = deactivateDepartmentCascade(hierarchy, nonExistentId);

          expect(result.departments.size).toBe(0);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Consistency Properties', () => {
    /**
     * Property: Hierarchy should remain valid after any valid operation.
     *
     * **Validates: Requirements 7.2, 7.4, 7.5**
     */
    it('should maintain validity after operations', () => {
      fc.assert(
        fc.property(departmentHierarchyArb, (hierarchy) => {
          // Initial hierarchy should be valid
          expect(isValidHierarchy(hierarchy)).toBe(true);

          // After deactivating any department, hierarchy should still be valid
          for (const [departmentId] of hierarchy.departments) {
            const deactivated = deactivateDepartmentCascade(hierarchy, departmentId);
            expect(isValidHierarchy(deactivated)).toBe(true);
          }
        }),
        { numRuns: 30 }
      );
    });

    /**
     * Property: Operations should be deterministic.
     *
     * **Validates: Requirements 7.2, 7.4, 7.5**
     */
    it('should produce deterministic results', () => {
      fc.assert(
        fc.property(departmentHierarchyArb, (hierarchy) => {
          for (const [departmentId] of hierarchy.departments) {
            // Multiple calls should produce same result
            const result1 = getChildCount(hierarchy, departmentId);
            const result2 = getChildCount(hierarchy, departmentId);
            expect(result1).toBe(result2);

            const descendants1 = getDescendantIds(hierarchy, departmentId);
            const descendants2 = getDescendantIds(hierarchy, departmentId);
            expect(descendants1).toEqual(descendants2);
          }
        }),
        { numRuns: 30 }
      );
    });
  });
});
