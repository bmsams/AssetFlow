/**
 * Model Seed Data
 * Validates: Requirement 3.5 - At least 20 models linked to manufacturers
 */

import type { SeedModel } from './types';

export const MODELS: SeedModel[] = [
  // Dell models
  { manufacturerName: 'DELL', modelName: 'Latitude 5540', normalizedName: 'LATITUDE 5540', modelNumber: 'LAT5540', modelCategory: 'LAPTOP', specifications: { cpu: 'Intel Core i7-1365U', memory_gb: 16, storage_gb: 512 } },
  { manufacturerName: 'DELL', modelName: 'Latitude 7440', normalizedName: 'LATITUDE 7440', modelNumber: 'LAT7440', modelCategory: 'LAPTOP', specifications: { cpu: 'Intel Core i7-1365U', memory_gb: 32, storage_gb: 1024 } },
  { manufacturerName: 'DELL', modelName: 'OptiPlex 7010', normalizedName: 'OPTIPLEX 7010', modelNumber: 'OPT7010', modelCategory: 'DESKTOP', specifications: { cpu: 'Intel Core i5-13500', memory_gb: 16, storage_gb: 512 } },
  { manufacturerName: 'DELL', modelName: 'PowerEdge R750', normalizedName: 'POWEREDGE R750', modelNumber: 'PER750', modelCategory: 'SERVER', specifications: { cpu: 'Intel Xeon Gold 6330', memory_gb: 256, storage_gb: 4096 } },
  { manufacturerName: 'DELL', modelName: 'UltraSharp U2723QE', normalizedName: 'ULTRASHARP U2723QE', modelNumber: 'U2723QE', modelCategory: 'MONITOR' },
  // HP models
  { manufacturerName: 'HP', modelName: 'EliteBook 840 G10', normalizedName: 'ELITEBOOK 840 G10', modelNumber: 'EB840G10', modelCategory: 'LAPTOP', specifications: { cpu: 'Intel Core i7-1365U', memory_gb: 16, storage_gb: 512 } },
  { manufacturerName: 'HP', modelName: 'ProDesk 400 G9', normalizedName: 'PRODESK 400 G9', modelNumber: 'PD400G9', modelCategory: 'DESKTOP', specifications: { cpu: 'Intel Core i5-12500', memory_gb: 16, storage_gb: 256 } },
  { manufacturerName: 'HP', modelName: 'LaserJet Pro M404dn', normalizedName: 'LASERJET PRO M404DN', modelNumber: 'M404DN', modelCategory: 'PRINTER' },
  // Lenovo models
  { manufacturerName: 'LENOVO', modelName: 'ThinkPad X1 Carbon Gen 11', normalizedName: 'THINKPAD X1 CARBON GEN 11', modelNumber: 'X1CG11', modelCategory: 'LAPTOP', specifications: { cpu: 'Intel Core i7-1365U', memory_gb: 32, storage_gb: 1024 } },
  { manufacturerName: 'LENOVO', modelName: 'ThinkPad T14 Gen 4', normalizedName: 'THINKPAD T14 GEN 4', modelNumber: 'T14G4', modelCategory: 'LAPTOP', specifications: { cpu: 'Intel Core i5-1345U', memory_gb: 16, storage_gb: 512 } },
  { manufacturerName: 'LENOVO', modelName: 'ThinkCentre M70q Gen 4', normalizedName: 'THINKCENTRE M70Q GEN 4', modelNumber: 'M70QG4', modelCategory: 'DESKTOP', specifications: { cpu: 'Intel Core i5-13400T', memory_gb: 16, storage_gb: 512 } },
  // Apple models
  { manufacturerName: 'APPLE', modelName: 'MacBook Pro 14" M3 Pro', normalizedName: 'MACBOOK PRO 14 M3 PRO', modelNumber: 'MBP14M3P', modelCategory: 'LAPTOP', specifications: { cpu: 'Apple M3 Pro', memory_gb: 18, storage_gb: 512 } },
  { manufacturerName: 'APPLE', modelName: 'MacBook Air 15" M3', normalizedName: 'MACBOOK AIR 15 M3', modelNumber: 'MBA15M3', modelCategory: 'LAPTOP', specifications: { cpu: 'Apple M3', memory_gb: 16, storage_gb: 512 } },
  { manufacturerName: 'APPLE', modelName: 'Mac Mini M2 Pro', normalizedName: 'MAC MINI M2 PRO', modelNumber: 'MMIM2P', modelCategory: 'DESKTOP', specifications: { cpu: 'Apple M2 Pro', memory_gb: 16, storage_gb: 512 } },
  { manufacturerName: 'APPLE', modelName: 'iPhone 15 Pro', normalizedName: 'IPHONE 15 PRO', modelNumber: 'IP15PRO', modelCategory: 'MOBILE' },
  // Cisco models
  { manufacturerName: 'CISCO', modelName: 'Catalyst 9200L-24P-4G', normalizedName: 'CATALYST 9200L-24P-4G', modelNumber: 'C9200L-24P-4G', modelCategory: 'NETWORK' },
  { manufacturerName: 'CISCO', modelName: 'Meraki MR46', normalizedName: 'MERAKI MR46', modelNumber: 'MR46', modelCategory: 'NETWORK' },
  // Samsung models
  { manufacturerName: 'SAMSUNG', modelName: 'Galaxy Tab S9+', normalizedName: 'GALAXY TAB S9+', modelNumber: 'SM-X810', modelCategory: 'MOBILE' },
  { manufacturerName: 'SAMSUNG', modelName: 'ViewFinity S8 32"', normalizedName: 'VIEWFINITY S8 32', modelNumber: 'LS32B800', modelCategory: 'MONITOR' },
  // Logitech models
  { manufacturerName: 'LOGITECH', modelName: 'MX Master 3S', normalizedName: 'MX MASTER 3S', modelNumber: 'MXM3S', modelCategory: 'PERIPHERAL' },
  { manufacturerName: 'LOGITECH', modelName: 'MX Keys S', normalizedName: 'MX KEYS S', modelNumber: 'MXKS', modelCategory: 'PERIPHERAL' },
  { manufacturerName: 'LOGITECH', modelName: 'Rally Bar', normalizedName: 'RALLY BAR', modelNumber: 'RALLYBAR', modelCategory: 'PERIPHERAL' },
  // Brother models
  { manufacturerName: 'BROTHER', modelName: 'MFC-L8900CDW', normalizedName: 'MFC-L8900CDW', modelNumber: 'MFCL8900CDW', modelCategory: 'PRINTER' },
];

/** Model categories for asset generation */
export const MODEL_CATEGORIES = ['LAPTOP', 'DESKTOP', 'SERVER', 'MONITOR', 'PRINTER', 'NETWORK', 'MOBILE', 'PERIPHERAL'] as const;

/** Models grouped by category for asset generation */
export const MODELS_BY_CATEGORY: Record<string, string[]> = {
  LAPTOP: ['LATITUDE 5540', 'LATITUDE 7440', 'ELITEBOOK 840 G10', 'THINKPAD X1 CARBON GEN 11', 'THINKPAD T14 GEN 4', 'MACBOOK PRO 14 M3 PRO', 'MACBOOK AIR 15 M3'],
  DESKTOP: ['OPTIPLEX 7010', 'PRODESK 400 G9', 'THINKCENTRE M70Q GEN 4', 'MAC MINI M2 PRO'],
  SERVER: ['POWEREDGE R750'],
  MONITOR: ['ULTRASHARP U2723QE', 'VIEWFINITY S8 32'],
  PRINTER: ['LASERJET PRO M404DN', 'MFC-L8900CDW'],
  NETWORK: ['CATALYST 9200L-24P-4G', 'MERAKI MR46'],
  MOBILE: ['IPHONE 15 PRO', 'GALAXY TAB S9+'],
  PERIPHERAL: ['MX MASTER 3S', 'MX KEYS S', 'RALLY BAR'],
};
