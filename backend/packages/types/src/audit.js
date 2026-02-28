"use strict";
/**
 * Audit logging types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateChanges = calculateChanges;
/**
 * Calculate changes between two objects
 */
function calculateChanges(oldObj, newObj) {
    const changes = [];
    for (const key of Object.keys(newObj)) {
        const oldValue = oldObj[key];
        const newValue = newObj[key];
        if (oldValue !== newValue) {
            changes.push({
                field: key,
                oldValue,
                newValue,
            });
        }
    }
    return changes;
}
//# sourceMappingURL=audit.js.map