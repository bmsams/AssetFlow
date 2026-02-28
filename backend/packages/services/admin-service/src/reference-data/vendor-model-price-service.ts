/**
 * Vendor Model Price Service - thin layer over repository for vendor-specific model pricing.
 */

import type { UpsertVendorModelPriceRequest, UUID, VendorModelPrice, VendorModelPriceListFilters } from '@ams/types';

import * as repository from './vendor-model-price-repository';

export async function listVendorModelPrices(
  vendorId: UUID,
  filters: VendorModelPriceListFilters = {}
): Promise<VendorModelPrice[]> {
  return repository.listVendorModelPrices(vendorId, filters);
}

export async function upsertVendorModelPrice(
  vendorId: UUID,
  modelId: UUID,
  request: UpsertVendorModelPriceRequest,
  userId?: UUID
): Promise<VendorModelPrice> {
  return repository.upsertVendorModelPrice(vendorId, modelId, request, userId);
}

export async function deactivateVendorModelPrice(
  vendorId: UUID,
  modelId: UUID,
  countryCode?: string,
  userId?: UUID
): Promise<void> {
  return repository.deactivateVendorModelPrice(vendorId, modelId, countryCode, userId);
}
