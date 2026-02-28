/**
 * Software Product and Entitlement Seed Data
 * Validates: Requirement 3.7 - At least 20 software products with entitlements
 */

import type { SeedSoftwareProduct, SeedEntitlement } from './types';

export const SOFTWARE_PRODUCTS: SeedSoftwareProduct[] = [
  { publisher: 'Microsoft', productName: 'Microsoft 365 E3', version: '2024', edition: 'Enterprise', productCategory: 'OFFICE_PRODUCTIVITY', isSaas: true },
  { publisher: 'Microsoft', productName: 'Microsoft 365 E5', version: '2024', edition: 'Enterprise', productCategory: 'OFFICE_PRODUCTIVITY', isSaas: true },
  { publisher: 'Microsoft', productName: 'Windows 11 Pro', version: '23H2', edition: 'Professional', productCategory: 'OPERATING_SYSTEM', isSaas: false },
  { publisher: 'Microsoft', productName: 'Windows Server 2022', version: '2022', edition: 'Standard', productCategory: 'OPERATING_SYSTEM', isSaas: false },
  { publisher: 'Microsoft', productName: 'SQL Server 2022', version: '2022', edition: 'Standard', productCategory: 'DATABASE', isSaas: false },
  { publisher: 'Microsoft', productName: 'Visual Studio Enterprise', version: '2022', edition: 'Enterprise', productCategory: 'DEVELOPMENT_TOOL', isSaas: false },
  { publisher: 'Adobe', productName: 'Adobe Creative Cloud', version: '2024', edition: 'All Apps', productCategory: 'GRAPHICS', isSaas: true },
  { publisher: 'Adobe', productName: 'Adobe Acrobat Pro', version: '2024', edition: 'Professional', productCategory: 'OFFICE_PRODUCTIVITY', isSaas: true },
  { publisher: 'Salesforce', productName: 'Salesforce Sales Cloud', version: 'Enterprise', edition: 'Enterprise', productCategory: 'CRM', isSaas: true },
  { publisher: 'Salesforce', productName: 'Salesforce Service Cloud', version: 'Enterprise', edition: 'Enterprise', productCategory: 'CRM', isSaas: true },
  { publisher: 'Atlassian', productName: 'Jira Software', version: 'Cloud', edition: 'Premium', productCategory: 'DEVELOPMENT_TOOL', isSaas: true },
  { publisher: 'Atlassian', productName: 'Confluence', version: 'Cloud', edition: 'Premium', productCategory: 'COLLABORATION', isSaas: true },
  { publisher: 'Slack', productName: 'Slack Business+', version: 'Cloud', edition: 'Business+', productCategory: 'COLLABORATION', isSaas: true },
  { publisher: 'Zoom', productName: 'Zoom Business', version: 'Cloud', edition: 'Business', productCategory: 'COLLABORATION', isSaas: true },
  { publisher: 'VMware', productName: 'vSphere Enterprise Plus', version: '8.0', edition: 'Enterprise Plus', productCategory: 'VIRTUALIZATION', isSaas: false },
  { publisher: 'VMware', productName: 'Workstation Pro', version: '17', edition: 'Professional', productCategory: 'VIRTUALIZATION', isSaas: false },
  { publisher: 'Oracle', productName: 'Oracle Database', version: '19c', edition: 'Enterprise', productCategory: 'DATABASE', isSaas: false },
  { publisher: 'JetBrains', productName: 'IntelliJ IDEA Ultimate', version: '2024.1', edition: 'Ultimate', productCategory: 'DEVELOPMENT_TOOL', isSaas: false },
  { publisher: 'GitHub', productName: 'GitHub Enterprise', version: 'Cloud', edition: 'Enterprise', productCategory: 'DEVELOPMENT_TOOL', isSaas: true },
  { publisher: 'Datadog', productName: 'Datadog Pro', version: 'Cloud', edition: 'Pro', productCategory: 'MONITORING', isSaas: true },
  { publisher: 'Splunk', productName: 'Splunk Enterprise', version: '9.2', edition: 'Enterprise', productCategory: 'MONITORING', isSaas: false },
  { publisher: 'CrowdStrike', productName: 'Falcon Endpoint Protection', version: 'Cloud', edition: 'Enterprise', productCategory: 'SECURITY', isSaas: true },
];

export const ENTITLEMENTS: SeedEntitlement[] = [
  { productName: 'Microsoft 365 E3', licenseType: 'SUBSCRIPTION', quantityPurchased: 200, unitCost: 36.00, metricType: 'PER_USER', startDate: '2024-01-01', endDate: '2024-12-31' },
  { productName: 'Microsoft 365 E5', licenseType: 'SUBSCRIPTION', quantityPurchased: 50, unitCost: 57.00, metricType: 'PER_USER', startDate: '2024-01-01', endDate: '2024-12-31' },
  { productName: 'Windows 11 Pro', licenseType: 'PERPETUAL', quantityPurchased: 300, unitCost: 199.00, metricType: 'PER_DEVICE', startDate: '2023-06-01' },
  { productName: 'Windows Server 2022', licenseType: 'PERPETUAL', quantityPurchased: 10, unitCost: 1069.00, metricType: 'PER_CORE', startDate: '2023-01-01' },
  { productName: 'SQL Server 2022', licenseType: 'PERPETUAL', quantityPurchased: 8, unitCost: 3945.00, metricType: 'PER_CORE', startDate: '2023-03-01' },
  { productName: 'Visual Studio Enterprise', licenseType: 'SUBSCRIPTION', quantityPurchased: 25, unitCost: 250.00, metricType: 'PER_USER', startDate: '2024-01-01', endDate: '2024-12-31' },
  { productName: 'Adobe Creative Cloud', licenseType: 'SUBSCRIPTION', quantityPurchased: 30, unitCost: 79.99, metricType: 'PER_USER', startDate: '2024-01-01', endDate: '2024-12-31' },
  { productName: 'Adobe Acrobat Pro', licenseType: 'SUBSCRIPTION', quantityPurchased: 100, unitCost: 22.99, metricType: 'PER_USER', startDate: '2024-01-01', endDate: '2024-12-31' },
  { productName: 'Salesforce Sales Cloud', licenseType: 'SUBSCRIPTION', quantityPurchased: 50, unitCost: 165.00, metricType: 'PER_USER', startDate: '2024-01-01', endDate: '2024-12-31' },
  { productName: 'Jira Software', licenseType: 'SUBSCRIPTION', quantityPurchased: 100, unitCost: 14.00, metricType: 'PER_USER', startDate: '2024-01-01', endDate: '2024-12-31' },
  { productName: 'Confluence', licenseType: 'SUBSCRIPTION', quantityPurchased: 100, unitCost: 10.00, metricType: 'PER_USER', startDate: '2024-01-01', endDate: '2024-12-31' },
  { productName: 'Slack Business+', licenseType: 'SUBSCRIPTION', quantityPurchased: 150, unitCost: 15.00, metricType: 'PER_USER', startDate: '2024-01-01', endDate: '2024-12-31' },
  { productName: 'Zoom Business', licenseType: 'SUBSCRIPTION', quantityPurchased: 100, unitCost: 21.99, metricType: 'PER_USER', startDate: '2024-01-01', endDate: '2024-12-31' },
  { productName: 'vSphere Enterprise Plus', licenseType: 'PERPETUAL', quantityPurchased: 20, unitCost: 4595.00, metricType: 'PER_PROCESSOR', startDate: '2023-01-01' },
  { productName: 'GitHub Enterprise', licenseType: 'SUBSCRIPTION', quantityPurchased: 75, unitCost: 21.00, metricType: 'PER_USER', startDate: '2024-01-01', endDate: '2024-12-31' },
  { productName: 'Datadog Pro', licenseType: 'SUBSCRIPTION', quantityPurchased: 50, unitCost: 23.00, metricType: 'PER_USER', startDate: '2024-01-01', endDate: '2024-12-31' },
  { productName: 'Falcon Endpoint Protection', licenseType: 'SUBSCRIPTION', quantityPurchased: 300, unitCost: 8.99, metricType: 'PER_DEVICE', startDate: '2024-01-01', endDate: '2024-12-31' },
];
