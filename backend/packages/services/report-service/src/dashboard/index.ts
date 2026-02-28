/**
 * Dashboard Module
 *
 * Exports dashboard functionality including:
 * - Dashboard summary (asset counts, values, lifecycle distribution)
 * - Lease expiration tracking
 * - Compliance indicators
 *
 * Requirements:
 * - Requirement 12.1: Display total asset value and counts by category
 * - Requirement 12.2: Show lifecycle distribution and compliance indicators
 */

// Prefer service exports. Repository functions can be accessed via `dashboardRepository.*`
// to avoid name collisions (service functions often share names).
export * from './dashboard-service';
export * as dashboardRepository from './dashboard-repository';
