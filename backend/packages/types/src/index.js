"use strict";
/**
 * @ams/types - Shared TypeScript types for Asset Management System
 *
 * This package contains all shared type definitions used across
 * the backend services.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Core asset types
__exportStar(require("./asset"), exports);
__exportStar(require("./hardware-asset"), exports);
__exportStar(require("./software-asset"), exports);
__exportStar(require("./enterprise-asset"), exports);
// Supporting types
__exportStar(require("./contract"), exports);
__exportStar(require("./stockroom"), exports);
__exportStar(require("./user"), exports);
__exportStar(require("./audit"), exports);
// API types
__exportStar(require("./api"), exports);
__exportStar(require("./events"), exports);
// Common types
__exportStar(require("./common"), exports);
// Location hierarchy types
__exportStar(require("./location"), exports);
// Reference data types
__exportStar(require("./reference-data"), exports);
// Purchase order types
__exportStar(require("./purchase-order"), exports);
// Report types
__exportStar(require("./report"), exports);
//# sourceMappingURL=index.js.map