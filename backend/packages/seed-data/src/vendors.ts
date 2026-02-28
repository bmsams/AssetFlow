/**
 * Vendor Seed Data
 * Vendors for contracts and purchase orders
 */

import type { SeedVendor } from './types';

export const VENDORS: SeedVendor[] = [
  { vendorName: 'Dell Technologies', vendorCode: 'DELL', vendorType: 'MANUFACTURER', contactName: 'John Dell', contactEmail: 'sales@dell.com', contactPhone: '1-800-999-3355', paymentTerms: 'NET30' },
  { vendorName: 'CDW Corporation', vendorCode: 'CDW', vendorType: 'RESELLER', contactName: 'Sarah CDW', contactEmail: 'sales@cdw.com', contactPhone: '1-800-800-4239', paymentTerms: 'NET30' },
  { vendorName: 'SHI International', vendorCode: 'SHI', vendorType: 'RESELLER', contactName: 'Mike SHI', contactEmail: 'sales@shi.com', contactPhone: '1-888-764-8888', paymentTerms: 'NET45' },
  { vendorName: 'HP Inc.', vendorCode: 'HP', vendorType: 'MANUFACTURER', contactName: 'Tom HP', contactEmail: 'sales@hp.com', contactPhone: '1-800-474-6836', paymentTerms: 'NET30' },
  { vendorName: 'Lenovo', vendorCode: 'LENOVO', vendorType: 'MANUFACTURER', contactName: 'Amy Lenovo', contactEmail: 'sales@lenovo.com', contactPhone: '1-855-253-6686', paymentTerms: 'NET30' },
  { vendorName: 'Apple Inc.', vendorCode: 'APPLE', vendorType: 'MANUFACTURER', contactName: 'Steve Apple', contactEmail: 'business@apple.com', contactPhone: '1-800-854-3680', paymentTerms: 'NET30' },
  { vendorName: 'Cisco Systems', vendorCode: 'CISCO', vendorType: 'MANUFACTURER', contactName: 'Chuck Cisco', contactEmail: 'sales@cisco.com', contactPhone: '1-800-553-6387', paymentTerms: 'NET45' },
  { vendorName: 'Microsoft Corporation', vendorCode: 'MSFT', vendorType: 'MANUFACTURER', contactName: 'Bill Microsoft', contactEmail: 'sales@microsoft.com', contactPhone: '1-800-642-7676', paymentTerms: 'NET30' },
  { vendorName: 'TechServe Solutions', vendorCode: 'TECHSERVE', vendorType: 'SERVICE_PROVIDER', contactName: 'Dan TechServe', contactEmail: 'support@techserve.com', contactPhone: '1-888-555-0100', paymentTerms: 'NET30' },
  { vendorName: 'Insight Enterprises', vendorCode: 'INSIGHT', vendorType: 'RESELLER', contactName: 'Lisa Insight', contactEmail: 'sales@insight.com', contactPhone: '1-800-467-4448', paymentTerms: 'NET30' },
];
