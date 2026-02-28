/**
 * Manufacturer Seed Data
 * Validates: Requirement 3.4 - At least 10 manufacturers
 */

import type { SeedManufacturer } from './types';

export const MANUFACTURERS: SeedManufacturer[] = [
  { name: 'Dell Technologies', normalizedName: 'DELL', aliases: ['Dell', 'Dell Inc', 'Dell EMC'], website: 'https://dell.com' },
  { name: 'HP Inc.', normalizedName: 'HP', aliases: ['HP', 'Hewlett-Packard', 'Hewlett Packard'], website: 'https://hp.com' },
  { name: 'Lenovo', normalizedName: 'LENOVO', aliases: ['Lenovo Group', 'Lenovo Inc'], website: 'https://lenovo.com' },
  { name: 'Apple Inc.', normalizedName: 'APPLE', aliases: ['Apple', 'Apple Computer'], website: 'https://apple.com' },
  { name: 'Microsoft Corporation', normalizedName: 'MICROSOFT', aliases: ['Microsoft', 'MSFT'], website: 'https://microsoft.com' },
  { name: 'Cisco Systems', normalizedName: 'CISCO', aliases: ['Cisco', 'Cisco Systems Inc'], website: 'https://cisco.com' },
  { name: 'Samsung Electronics', normalizedName: 'SAMSUNG', aliases: ['Samsung'], website: 'https://samsung.com' },
  { name: 'ASUS', normalizedName: 'ASUS', aliases: ['ASUSTeK', 'ASUS Computer'], website: 'https://asus.com' },
  { name: 'Acer', normalizedName: 'ACER', aliases: ['Acer Inc'], website: 'https://acer.com' },
  { name: 'Intel Corporation', normalizedName: 'INTEL', aliases: ['Intel', 'Intel Corp'], website: 'https://intel.com' },
  { name: 'Logitech', normalizedName: 'LOGITECH', aliases: ['Logitech International'], website: 'https://logitech.com' },
  { name: 'Brother Industries', normalizedName: 'BROTHER', aliases: ['Brother'], website: 'https://brother.com' },
];
