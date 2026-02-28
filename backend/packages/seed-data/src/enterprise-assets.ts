/**
 * Enterprise Asset and Maintenance Plan Seed Data
 * Validates: Requirement 3.8 - At least 10 enterprise assets with maintenance plans
 */

import type { SeedEnterpriseAsset, SeedMaintenancePlan } from './types';

export const ENTERPRISE_ASSETS: SeedEnterpriseAsset[] = [
  { displayName: 'Main HVAC System', description: 'Central HVAC system for headquarters building', status: 'DEPLOYED', serialNumber: 'HVAC-HQ-001', manufacturer: 'Carrier', model: 'WeatherExpert 50XC', assetClass: 'HVAC', criticalityLevel: 'CRITICAL', facilityCode: 'HQ', operatingHours: 45000 },
  { displayName: 'Backup Generator A', description: 'Primary backup generator for data center', status: 'DEPLOYED', serialNumber: 'GEN-DC1-001', manufacturer: 'Caterpillar', model: 'C18 ACERT', assetClass: 'ELECTRICAL', criticalityLevel: 'CRITICAL', facilityCode: 'DC1', operatingHours: 1200 },
  { displayName: 'Backup Generator B', description: 'Secondary backup generator for data center', status: 'DEPLOYED', serialNumber: 'GEN-DC1-002', manufacturer: 'Caterpillar', model: 'C18 ACERT', assetClass: 'ELECTRICAL', criticalityLevel: 'CRITICAL', facilityCode: 'DC1', operatingHours: 800 },
  { displayName: 'UPS System - DC1', description: 'Uninterruptible power supply for data center', status: 'DEPLOYED', serialNumber: 'UPS-DC1-001', manufacturer: 'Eaton', model: '93PM 200kW', assetClass: 'ELECTRICAL', criticalityLevel: 'CRITICAL', facilityCode: 'DC1', operatingHours: 35000 },
  { displayName: 'Fire Suppression System', description: 'FM-200 fire suppression for data center', status: 'DEPLOYED', serialNumber: 'FIRE-DC1-001', manufacturer: 'Kidde', model: 'FM-200 ECS', assetClass: 'FIRE_SAFETY', criticalityLevel: 'CRITICAL', facilityCode: 'DC1', operatingHours: 0 },
  { displayName: 'Elevator A - HQ', description: 'Main passenger elevator at headquarters', status: 'DEPLOYED', serialNumber: 'ELEV-HQ-001', manufacturer: 'Otis', model: 'Gen2 Premier', assetClass: 'ELEVATOR', criticalityLevel: 'HIGH', facilityCode: 'HQ', operatingHours: 28000 },
  { displayName: 'Elevator B - HQ', description: 'Secondary passenger elevator at headquarters', status: 'IN_MAINTENANCE', serialNumber: 'ELEV-HQ-002', manufacturer: 'Otis', model: 'Gen2 Premier', assetClass: 'ELEVATOR', criticalityLevel: 'HIGH', facilityCode: 'HQ', operatingHours: 27500 },
  { displayName: 'Security Camera System', description: 'IP camera system for headquarters', status: 'DEPLOYED', serialNumber: 'SEC-HQ-001', manufacturer: 'Axis', model: 'P3245-V', assetClass: 'SECURITY', criticalityLevel: 'MEDIUM', facilityCode: 'HQ', operatingHours: 52000 },
  { displayName: 'Warehouse Forklift 1', description: 'Electric forklift for warehouse operations', status: 'DEPLOYED', serialNumber: 'FORK-WH-001', manufacturer: 'Toyota', model: '8FBMT25', assetClass: 'TRANSPORTATION', criticalityLevel: 'MEDIUM', facilityCode: 'WH-EAST', operatingHours: 4500 },
  { displayName: 'Warehouse Forklift 2', description: 'Electric forklift for warehouse operations', status: 'DEPLOYED', serialNumber: 'FORK-WH-002', manufacturer: 'Toyota', model: '8FBMT25', assetClass: 'TRANSPORTATION', criticalityLevel: 'MEDIUM', facilityCode: 'WH-EAST', operatingHours: 3800 },
  { displayName: 'CRAC Unit - DC1', description: 'Computer room air conditioning unit', status: 'DEPLOYED', serialNumber: 'CRAC-DC1-001', manufacturer: 'Liebert', model: 'DS 105kW', assetClass: 'HVAC', criticalityLevel: 'CRITICAL', facilityCode: 'DC1', operatingHours: 42000 },
  { displayName: 'Access Control System', description: 'Building access control system', status: 'DEPLOYED', serialNumber: 'ACC-HQ-001', manufacturer: 'HID Global', model: 'Aero X1100', assetClass: 'SECURITY', criticalityLevel: 'HIGH', facilityCode: 'HQ', operatingHours: 48000 },
];

export const MAINTENANCE_PLANS: SeedMaintenancePlan[] = [
  { assetDisplayName: 'Main HVAC System', planName: 'Quarterly HVAC Inspection', maintenanceType: 'PREVENTIVE', frequencyDays: 90, estimatedDurationHours: 4 },
  { assetDisplayName: 'Backup Generator A', planName: 'Monthly Generator Test', maintenanceType: 'PREVENTIVE', frequencyDays: 30, estimatedDurationHours: 2 },
  { assetDisplayName: 'Backup Generator B', planName: 'Monthly Generator Test', maintenanceType: 'PREVENTIVE', frequencyDays: 30, estimatedDurationHours: 2 },
  { assetDisplayName: 'UPS System - DC1', planName: 'Annual UPS Maintenance', maintenanceType: 'PREVENTIVE', frequencyDays: 365, estimatedDurationHours: 8 },
  { assetDisplayName: 'Fire Suppression System', planName: 'Semi-Annual Fire System Inspection', maintenanceType: 'INSPECTION', frequencyDays: 180, estimatedDurationHours: 3 },
  { assetDisplayName: 'Elevator A - HQ', planName: 'Monthly Elevator Inspection', maintenanceType: 'INSPECTION', frequencyDays: 30, estimatedDurationHours: 2 },
  { assetDisplayName: 'Elevator B - HQ', planName: 'Monthly Elevator Inspection', maintenanceType: 'INSPECTION', frequencyDays: 30, estimatedDurationHours: 2 },
  { assetDisplayName: 'Security Camera System', planName: 'Quarterly Camera Calibration', maintenanceType: 'CALIBRATION', frequencyDays: 90, estimatedDurationHours: 4 },
  { assetDisplayName: 'Warehouse Forklift 1', planName: 'Weekly Forklift Safety Check', maintenanceType: 'SAFETY_CHECK', frequencyDays: 7, estimatedDurationHours: 0.5 },
  { assetDisplayName: 'Warehouse Forklift 2', planName: 'Weekly Forklift Safety Check', maintenanceType: 'SAFETY_CHECK', frequencyDays: 7, estimatedDurationHours: 0.5 },
  { assetDisplayName: 'CRAC Unit - DC1', planName: 'Monthly CRAC Filter Change', maintenanceType: 'PREVENTIVE', frequencyDays: 30, estimatedDurationHours: 1 },
  { assetDisplayName: 'Access Control System', planName: 'Annual Access Control Audit', maintenanceType: 'REGULATORY', frequencyDays: 365, estimatedDurationHours: 8 },
];
