"use strict";
/**
 * Core Asset types for the Asset Management System
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_RELATIONSHIP_TYPES = exports.VALID_STATE_TRANSITIONS = void 0;
/**
 * Valid state transitions for assets
 */
exports.VALID_STATE_TRANSITIONS = {
    ORDERED: ['RECEIVED'],
    RECEIVED: ['IN_STOCK'],
    IN_STOCK: ['RESERVED', 'DEPLOYED', 'RETIRED'],
    RESERVED: ['IN_STOCK', 'DEPLOYED'],
    DEPLOYED: ['IN_STOCK', 'IN_MAINTENANCE', 'RETIRED'],
    IN_MAINTENANCE: ['DEPLOYED', 'RETIRED'],
    RETIRED: ['DISPOSED'],
    DISPOSED: [],
};
/**
 * Valid relationship types array for validation
 */
exports.VALID_RELATIONSHIP_TYPES = [
    'PARENT_CHILD',
    'DEPENDENCY',
    'CONNECTED_TO',
    'INSTALLED_ON',
    'RUNS_ON',
    'LOCATION',
    'COMPONENT',
];
//# sourceMappingURL=asset.js.map