/**
 * Vendor Repository - Data access layer for vendor management
 *
 * Implements database operations for:
 * - Vendor CRUD operations (Requirement 9.1-9.7)
 * - Full-text search on vendor name, code, and contact info
 * - Filtering by type, rating, and active status
 * - Rating change tracking for audit trail
 */

import type {
  CreateVendorRequest,
  PaginatedResult,
  PaginationParams,
  UpdateVendorRequest,
  UUID,
  VendorDetails,
  VendorListFilters,
  VendorRating,
  VendorType,
} from '@ams/types';
import { query, queryMany, queryOne } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'vendor-repository' });

// ============================================================================
// Database Row Types
// ============================================================================

/**
 * Database row type for vendors table
 */
interface VendorRow {
  vendor_id: string;
  vendor_code: string | null;
  vendor_name: string;
  vendor_type: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
  payment_terms: string | null;
  rating: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Vendor dependencies row
 */
interface VendorDependenciesRow {
  po_count: string;
  asset_count: string;
}

// ============================================================================
// Row Mappers
// ============================================================================

/**
 * Map database row to VendorDetails entity
 * Requirement 9.2: Return complete vendor details including contacts and payment terms
 */
function mapRowToVendor(row: VendorRow): VendorDetails {
  return {
    vendorId: row.vendor_id,
    vendorCode: row.vendor_code,
    vendorName: row.vendor_name,
    vendorType: row.vendor_type as VendorType | null,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    stateProvince: row.state_province,
    postalCode: row.postal_code,
    country: row.country,
    paymentTerms: row.payment_terms,
    rating: row.rating as VendorRating | null,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Vendor Repository Functions
// ============================================================================

/**
 * Create a new vendor
 * Requirement 9.1: Create vendor with name, type, contact information, and payment terms
 */
export async function createVendor(
  request: CreateVendorRequest,
  userId?: UUID
): Promise<VendorDetails> {
  const timestamp = now();

  const result = await queryOne<VendorRow>(
    `INSERT INTO vendors (
      vendor_code, vendor_name, vendor_type, contact_name, contact_email,
      contact_phone, address_line1, address_line2, city, state_province,
      postal_code, country, payment_terms, is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE, $14, $14)
    RETURNING *`,
    [
      request.vendorCode ?? null,
      request.vendorName,
      request.vendorType ?? null,
      request.contactName ?? null,
      request.contactEmail ?? null,
      request.contactPhone ?? null,
      request.addressLine1 ?? null,
      request.addressLine2 ?? null,
      request.city ?? null,
      request.stateProvince ?? null,
      request.postalCode ?? null,
      request.country ?? null,
      request.paymentTerms ?? null,
      timestamp,
    ]
  );

  if (!result) {
    throw new Error('Failed to create vendor');
  }

  logger.info('Vendor created', {
    vendorId: result.vendor_id,
    vendorCode: result.vendor_code,
    vendorName: result.vendor_name,
    userId,
  });

  return mapRowToVendor(result);
}

/**
 * Get vendor by ID
 * Requirement 9.2: Return complete vendor details including contacts and payment terms
 */
export async function getVendorById(vendorId: UUID): Promise<VendorDetails | null> {
  const result = await queryOne<VendorRow>(
    `SELECT vendor_id, vendor_code, vendor_name, vendor_type, contact_name,
            contact_email, contact_phone, address, address_line1, address_line2,
            city, state_province, postal_code, country, payment_terms, rating,
            is_active, created_at, updated_at
     FROM vendors
     WHERE vendor_id = $1`,
    [vendorId]
  );

  return result ? mapRowToVendor(result) : null;
}

/**
 * Get vendor by code
 */
export async function getVendorByCode(code: string): Promise<VendorDetails | null> {
  const result = await queryOne<VendorRow>(
    `SELECT vendor_id, vendor_code, vendor_name, vendor_type, contact_name,
            contact_email, contact_phone, address, address_line1, address_line2,
            city, state_province, postal_code, country, payment_terms, rating,
            is_active, created_at, updated_at
     FROM vendors
     WHERE vendor_code = $1`,
    [code]
  );

  return result ? mapRowToVendor(result) : null;
}

/**
 * Get all vendors
 */
export async function getAllVendors(): Promise<VendorDetails[]> {
  const rows = await queryMany<VendorRow>(
    `SELECT vendor_id, vendor_code, vendor_name, vendor_type, contact_name,
            contact_email, contact_phone, address, address_line1, address_line2,
            city, state_province, postal_code, country, payment_terms, rating,
            is_active, created_at, updated_at
     FROM vendors
     ORDER BY vendor_name ASC`
  );

  return rows.map(mapRowToVendor);
}

/**
 * Get active vendors only
 */
export async function getActiveVendors(): Promise<VendorDetails[]> {
  const rows = await queryMany<VendorRow>(
    `SELECT vendor_id, vendor_code, vendor_name, vendor_type, contact_name,
            contact_email, contact_phone, address, address_line1, address_line2,
            city, state_province, postal_code, country, payment_terms, rating,
            is_active, created_at, updated_at
     FROM vendors
     WHERE is_active = TRUE
     ORDER BY vendor_name ASC`
  );

  return rows.map(mapRowToVendor);
}

/**
 * Update vendor details
 * Requirement 9.3: Update vendor details including contacts and payment terms
 */
export async function updateVendor(
  vendorId: UUID,
  request: UpdateVendorRequest,
  userId?: UUID
): Promise<VendorDetails | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (request.vendorName !== undefined) {
    updates.push(`vendor_name = $${paramIndex++}`);
    values.push(request.vendorName);
  }

  if (request.vendorType !== undefined) {
    updates.push(`vendor_type = $${paramIndex++}`);
    values.push(request.vendorType);
  }

  if (request.contactName !== undefined) {
    updates.push(`contact_name = $${paramIndex++}`);
    values.push(request.contactName);
  }

  if (request.contactEmail !== undefined) {
    updates.push(`contact_email = $${paramIndex++}`);
    values.push(request.contactEmail);
  }

  if (request.contactPhone !== undefined) {
    updates.push(`contact_phone = $${paramIndex++}`);
    values.push(request.contactPhone);
  }

  if (request.addressLine1 !== undefined) {
    updates.push(`address_line1 = $${paramIndex++}`);
    values.push(request.addressLine1);
  }

  if (request.addressLine2 !== undefined) {
    updates.push(`address_line2 = $${paramIndex++}`);
    values.push(request.addressLine2);
  }

  if (request.city !== undefined) {
    updates.push(`city = $${paramIndex++}`);
    values.push(request.city);
  }

  if (request.stateProvince !== undefined) {
    updates.push(`state_province = $${paramIndex++}`);
    values.push(request.stateProvince);
  }

  if (request.postalCode !== undefined) {
    updates.push(`postal_code = $${paramIndex++}`);
    values.push(request.postalCode);
  }

  if (request.country !== undefined) {
    updates.push(`country = $${paramIndex++}`);
    values.push(request.country);
  }

  if (request.paymentTerms !== undefined) {
    updates.push(`payment_terms = $${paramIndex++}`);
    values.push(request.paymentTerms);
  }

  if (request.rating !== undefined) {
    updates.push(`rating = $${paramIndex++}`);
    values.push(request.rating);
  }

  if (request.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(request.isActive);
  }

  if (updates.length === 0) {
    return getVendorById(vendorId);
  }

  updates.push(`updated_at = $${paramIndex++}`);
  values.push(now());

  values.push(vendorId);

  const sql = `UPDATE vendors 
               SET ${updates.join(', ')} 
               WHERE vendor_id = $${paramIndex}
               RETURNING vendor_id, vendor_code, vendor_name, vendor_type, contact_name,
                         contact_email, contact_phone, address, address_line1, address_line2,
                         city, state_province, postal_code, country, payment_terms, rating,
                         is_active, created_at, updated_at`;

  const result = await queryOne<VendorRow>(sql, values);

  if (!result) {
    return null;
  }

  logger.info('Vendor updated', { vendorId, userId });

  return mapRowToVendor(result);
}

/**
 * Deactivate a vendor
 * Requirement 9.5: Mark vendor as inactive and prevent new purchase orders
 */
export async function deactivateVendor(
  vendorId: UUID,
  userId?: UUID
): Promise<VendorDetails | null> {
  const timestamp = now();

  const result = await queryOne<VendorRow>(
    `UPDATE vendors 
     SET is_active = FALSE, updated_at = $1 
     WHERE vendor_id = $2
     RETURNING vendor_id, vendor_code, vendor_name, vendor_type, contact_name,
               contact_email, contact_phone, address, address_line1, address_line2,
               city, state_province, postal_code, country, payment_terms, rating,
               is_active, created_at, updated_at`,
    [timestamp, vendorId]
  );

  if (!result) {
    return null;
  }

  logger.info('Vendor deactivated', { vendorId, userId });

  return mapRowToVendor(result);
}

/**
 * Delete a vendor (only if no dependencies)
 */
export async function deleteVendor(vendorId: UUID): Promise<boolean> {
  const result = await query('DELETE FROM vendors WHERE vendor_id = $1', [vendorId]);

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    logger.info('Vendor deleted', { vendorId });
  }

  return deleted;
}

/**
 * Check if a vendor code already exists
 * Used for uniqueness validation
 */
export async function vendorCodeExists(
  code: string,
  excludeId?: UUID
): Promise<boolean> {
  const condition = excludeId
    ? 'WHERE vendor_code = $1 AND vendor_id != $2'
    : 'WHERE vendor_code = $1';
  const params = excludeId ? [code, excludeId] : [code];

  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM vendors ${condition}) as exists`,
    params
  );

  return result?.exists ?? false;
}

/**
 * Get vendor dependencies (PO count and asset count)
 * Used to check if vendor can be deleted
 */
export async function getVendorDependencies(vendorId: UUID): Promise<{
  poCount: number;
  assetCount: number;
}> {
  const result = await queryOne<VendorDependenciesRow>(
    `SELECT 
       COALESCE((SELECT COUNT(*) FROM purchase_orders WHERE vendor_id = $1), 0)::text as po_count,
       COALESCE((SELECT COUNT(*) FROM hardware_assets WHERE vendor_id = $1), 0)::text as asset_count`,
    [vendorId]
  );

  return {
    poCount: parseInt(result?.po_count ?? '0', 10),
    assetCount: parseInt(result?.asset_count ?? '0', 10),
  };
}

/**
 * List vendors with pagination and filters
 * Requirement 9.6: Return paginated list with type and rating filters
 */
export async function listVendors(
  filters: VendorListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<VendorDetails>> {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.vendorType !== undefined) {
    conditions.push(`vendor_type = $${paramIndex++}`);
    values.push(filters.vendorType);
  }

  if (filters.rating !== undefined) {
    conditions.push(`rating = $${paramIndex++}`);
    values.push(filters.rating);
  }

  if (filters.isActive !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    values.push(filters.isActive);
  }

  if (filters.search) {
    conditions.push(
      `(vendor_name ILIKE $${paramIndex} OR vendor_code ILIKE $${paramIndex} OR contact_name ILIKE $${paramIndex} OR contact_email ILIKE $${paramIndex})`
    );
    values.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM vendors ${whereClause}`,
    values
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated results
  values.push(limit, offset);

  const rows = await queryMany<VendorRow>(
    `SELECT vendor_id, vendor_code, vendor_name, vendor_type, contact_name,
            contact_email, contact_phone, address, address_line1, address_line2,
            city, state_province, postal_code, country, payment_terms, rating,
            is_active, created_at, updated_at
     FROM vendors
     ${whereClause}
     ORDER BY vendor_name ASC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values
  );

  return {
    items: rows.map(mapRowToVendor),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Search vendors by name, code, or contact information
 * Requirement 9.7: Return matching vendors using partial text matching
 */
export async function searchVendors(searchTerm: string): Promise<VendorDetails[]> {
  const searchPattern = `%${searchTerm}%`;

  const rows = await queryMany<VendorRow>(
    `SELECT vendor_id, vendor_code, vendor_name, vendor_type, contact_name,
            contact_email, contact_phone, address, address_line1, address_line2,
            city, state_province, postal_code, country, payment_terms, rating,
            is_active, created_at, updated_at
     FROM vendors
     WHERE vendor_name ILIKE $1
        OR vendor_code ILIKE $1
        OR contact_name ILIKE $1
        OR contact_email ILIKE $1
        OR contact_phone ILIKE $1
        OR city ILIKE $1
     ORDER BY 
       CASE 
         WHEN vendor_name ILIKE $1 THEN 1
         WHEN vendor_code ILIKE $1 THEN 2
         ELSE 3
       END,
       vendor_name ASC
     LIMIT 50`,
    [searchPattern]
  );

  return rows.map(mapRowToVendor);
}

/**
 * Get vendors by type
 * Requirement 9.6: Filter vendors by type (SUPPLIER, MANUFACTURER, SERVICE_PROVIDER, etc.)
 */
export async function getVendorsByType(vendorType: VendorType): Promise<VendorDetails[]> {
  const rows = await queryMany<VendorRow>(
    `SELECT vendor_id, vendor_code, vendor_name, vendor_type, contact_name,
            contact_email, contact_phone, address, address_line1, address_line2,
            city, state_province, postal_code, country, payment_terms, rating,
            is_active, created_at, updated_at
     FROM vendors
     WHERE vendor_type = $1 AND is_active = TRUE
     ORDER BY vendor_name ASC`,
    [vendorType]
  );

  return rows.map(mapRowToVendor);
}

/**
 * Get vendors by rating
 * Requirement 9.6: Filter vendors by rating
 */
export async function getVendorsByRating(rating: VendorRating): Promise<VendorDetails[]> {
  const rows = await queryMany<VendorRow>(
    `SELECT vendor_id, vendor_code, vendor_name, vendor_type, contact_name,
            contact_email, contact_phone, address, address_line1, address_line2,
            city, state_province, postal_code, country, payment_terms, rating,
            is_active, created_at, updated_at
     FROM vendors
     WHERE rating = $1 AND is_active = TRUE
     ORDER BY vendor_name ASC`,
    [rating]
  );

  return rows.map(mapRowToVendor);
}

/**
 * Update vendor rating
 * Requirement 9.4: Update rating and log the change in audit history
 * Returns the previous rating for audit trail purposes
 */
export async function updateVendorRating(
  vendorId: UUID,
  newRating: VendorRating,
  userId?: UUID
): Promise<{ vendor: VendorDetails; previousRating: VendorRating | null } | null> {
  // First, get the current rating for audit trail
  const currentVendor = await getVendorById(vendorId);
  if (!currentVendor) {
    return null;
  }

  const previousRating = currentVendor.rating;
  const timestamp = now();

  const result = await queryOne<VendorRow>(
    `UPDATE vendors 
     SET rating = $1, updated_at = $2 
     WHERE vendor_id = $3
     RETURNING vendor_id, vendor_code, vendor_name, vendor_type, contact_name,
               contact_email, contact_phone, address, address_line1, address_line2,
               city, state_province, postal_code, country, payment_terms, rating,
               is_active, created_at, updated_at`,
    [newRating, timestamp, vendorId]
  );

  if (!result) {
    return null;
  }

  logger.info('Vendor rating updated', {
    vendorId,
    previousRating,
    newRating,
    userId,
  });

  return {
    vendor: mapRowToVendor(result),
    previousRating,
  };
}

/**
 * Get preferred vendors (vendors with PREFERRED rating)
 */
export async function getPreferredVendors(): Promise<VendorDetails[]> {
  return getVendorsByRating('PREFERRED');
}

/**
 * Get approved vendors (vendors with PREFERRED or APPROVED rating)
 */
export async function getApprovedVendors(): Promise<VendorDetails[]> {
  const rows = await queryMany<VendorRow>(
    `SELECT vendor_id, vendor_code, vendor_name, vendor_type, contact_name,
            contact_email, contact_phone, address, address_line1, address_line2,
            city, state_province, postal_code, country, payment_terms, rating,
            is_active, created_at, updated_at
     FROM vendors
     WHERE rating IN ('PREFERRED', 'APPROVED') AND is_active = TRUE
     ORDER BY 
       CASE rating
         WHEN 'PREFERRED' THEN 1
         WHEN 'APPROVED' THEN 2
       END,
       vendor_name ASC`
  );

  return rows.map(mapRowToVendor);
}

/**
 * Get vendors that can receive purchase orders
 * Excludes SUSPENDED and BLACKLISTED vendors
 */
export async function getVendorsForPurchasing(): Promise<VendorDetails[]> {
  const rows = await queryMany<VendorRow>(
    `SELECT vendor_id, vendor_code, vendor_name, vendor_type, contact_name,
            contact_email, contact_phone, address, address_line1, address_line2,
            city, state_province, postal_code, country, payment_terms, rating,
            is_active, created_at, updated_at
     FROM vendors
     WHERE is_active = TRUE
       AND (rating IS NULL OR rating NOT IN ('SUSPENDED', 'BLACKLISTED'))
     ORDER BY 
       CASE rating
         WHEN 'PREFERRED' THEN 1
         WHEN 'APPROVED' THEN 2
         WHEN 'CONDITIONAL' THEN 3
         WHEN 'PROBATION' THEN 4
         ELSE 5
       END,
       vendor_name ASC`
  );

  return rows.map(mapRowToVendor);
}
