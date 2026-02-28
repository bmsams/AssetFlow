/**
 * Facility Seed Data
 * Facilities for enterprise assets
 */

import type { SeedFacility } from './types';

export const FACILITIES: SeedFacility[] = [
  { facilityCode: 'HQ', name: 'Corporate Headquarters', facilityType: 'HEADQUARTERS', city: 'New York', stateProvince: 'NY', country: 'USA' },
  { facilityCode: 'DC1', name: 'Primary Data Center', facilityType: 'DATA_CENTER', city: 'Ashburn', stateProvince: 'VA', country: 'USA' },
  { facilityCode: 'WH-EAST', name: 'East Coast Warehouse', facilityType: 'WAREHOUSE', city: 'Newark', stateProvince: 'NJ', country: 'USA' },
  { facilityCode: 'BRANCH-CHI', name: 'Chicago Branch Office', facilityType: 'BRANCH_OFFICE', city: 'Chicago', stateProvince: 'IL', country: 'USA' },
  { facilityCode: 'BRANCH-LA', name: 'Los Angeles Branch Office', facilityType: 'BRANCH_OFFICE', city: 'Los Angeles', stateProvince: 'CA', country: 'USA' },
];
