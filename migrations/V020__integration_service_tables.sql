-- ============================================================================
-- V020: Integration-service missing tables
-- Creates tables referenced by integration-service repository code that were
-- not included in earlier migrations.
-- Sources: vendor/vendor-repository.ts, erp/erp-repository.ts
-- ============================================================================

-- ============================================================================
-- 1. vendor_integration_configs
-- Configuration for vendor integrations (CDW, Insight, etc.)
-- Source: VendorConfigRow interface + getVendorConfig/updateVendorLastSync
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_integration_configs (
    config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_type VARCHAR(30) NOT NULL,
    vendor_name VARCHAR(200) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    auto_process_asn BOOLEAN NOT NULL DEFAULT FALSE,
    auto_create_assets BOOLEAN NOT NULL DEFAULT FALSE,
    default_stockroom_id UUID,
    webhook_url TEXT,
    api_endpoint TEXT,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_vendor_integration_configs_vendor_type ON vendor_integration_configs(vendor_type);

-- ============================================================================
-- 2. vendor_asns
-- Advance Ship Notices from vendors
-- Source: ASNRow interface + createASN/getASNById/updateASNStatus
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_asns (
    asn_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_type VARCHAR(30) NOT NULL,
    vendor_name VARCHAR(200) NOT NULL,
    vendor_asn_number VARCHAR(100) NOT NULL,
    purchase_order_number VARCHAR(100) NOT NULL,
    purchase_order_id UUID,
    ship_date TIMESTAMPTZ NOT NULL,
    expected_delivery_date TIMESTAMPTZ NOT NULL,
    carrier_name VARCHAR(200),
    tracking_number VARCHAR(200),
    ship_from_address JSONB,
    ship_to_address JSONB,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    raw_data JSONB,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_vendor_asns_vendor_type ON vendor_asns(vendor_type);
CREATE INDEX IF NOT EXISTS idx_vendor_asns_status ON vendor_asns(status);
CREATE INDEX IF NOT EXISTS idx_vendor_asns_vendor_asn_number ON vendor_asns(vendor_type, vendor_asn_number);

-- ============================================================================
-- 3. vendor_asn_lines
-- Individual line items within an ASN
-- Source: ASNLineRow interface + createASNLine/updateASNLineStatus
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_asn_lines (
    line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asn_id UUID NOT NULL REFERENCES vendor_asns(asn_id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    vendor_part_number VARCHAR(100) NOT NULL,
    manufacturer_part_number VARCHAR(100),
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    serial_numbers JSONB NOT NULL DEFAULT '[]'::JSONB,
    manufacturer VARCHAR(200),
    model VARCHAR(200),
    unit_price NUMERIC(12,2),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    created_asset_ids JSONB NOT NULL DEFAULT '[]'::JSONB,
    linked_asset_ids JSONB NOT NULL DEFAULT '[]'::JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_vendor_asn_lines_asn_id ON vendor_asn_lines(asn_id);
CREATE INDEX IF NOT EXISTS idx_vendor_asn_lines_status ON vendor_asn_lines(status);

-- ============================================================================
-- 4. vendor_asn_assets
-- Tracks assets pre-created from ASN data
-- Source: preCreateAssetFromASN INSERT statement
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_asn_assets (
    asn_asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(asset_id),
    asn_id UUID NOT NULL REFERENCES vendor_asns(asn_id),
    asn_line_id UUID NOT NULL REFERENCES vendor_asn_lines(line_id),
    serial_number VARCHAR(100) NOT NULL,
    vendor_type VARCHAR(30) NOT NULL,
    expected_delivery_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ORDERED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_vendor_asn_assets_asset_id ON vendor_asn_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_vendor_asn_assets_asn_id ON vendor_asn_assets(asn_id);
CREATE INDEX IF NOT EXISTS idx_vendor_asn_assets_serial_number ON vendor_asn_assets(serial_number);

-- ============================================================================
-- 5. vendor_catalog_items
-- Vendor product catalog items
-- Source: VendorCatalogItemRow interface + upsertVendorCatalogItem/getVendorCatalogItems
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_catalog_items (
    catalog_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_type VARCHAR(30) NOT NULL,
    vendor_part_number VARCHAR(100) NOT NULL,
    manufacturer_part_number VARCHAR(100),
    manufacturer VARCHAR(200) NOT NULL,
    model VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    unit_price NUMERIC(12,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    availability VARCHAR(30) NOT NULL DEFAULT 'IN_STOCK',
    lead_time_days INTEGER,
    minimum_order_quantity INTEGER,
    specifications JSONB,
    image_url TEXT,
    product_url TEXT,
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_catalog_items_vendor_part
    ON vendor_catalog_items(vendor_type, vendor_part_number);
CREATE INDEX IF NOT EXISTS idx_vendor_catalog_items_category ON vendor_catalog_items(category);
CREATE INDEX IF NOT EXISTS idx_vendor_catalog_items_manufacturer ON vendor_catalog_items(manufacturer);

-- ============================================================================
-- 6. erp_connection_configs
-- ERP system connection configurations
-- Source: ERPConnectionConfigRow interface + getERPConnectionConfig/updateERPConnectionLastSync
-- ============================================================================
CREATE TABLE IF NOT EXISTS erp_connection_configs (
    connection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_system VARCHAR(30) NOT NULL,
    connection_name VARCHAR(200) NOT NULL,
    base_url TEXT NOT NULL,
    auth_type VARCHAR(30) NOT NULL DEFAULT 'BASIC',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sync_direction VARCHAR(30) NOT NULL DEFAULT 'INBOUND',
    sync_interval_minutes INTEGER NOT NULL DEFAULT 60,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_erp_connection_configs_erp_system ON erp_connection_configs(erp_system);

-- ============================================================================
-- 7. erp_purchase_orders
-- Purchase orders synced from ERP systems
-- Source: ERPPurchaseOrderRow interface + upsertERPPurchaseOrder/findERPPurchaseOrderByErpId
-- ============================================================================
CREATE TABLE IF NOT EXISTS erp_purchase_orders (
    erp_purchase_order_id VARCHAR(200) NOT NULL,
    erp_system VARCHAR(30) NOT NULL,
    po_number VARCHAR(100) NOT NULL,
    vendor_id VARCHAR(200) NOT NULL,
    vendor_name VARCHAR(200) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    order_date TIMESTAMPTZ NOT NULL,
    expected_delivery_date TIMESTAMPTZ,
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    requester_id VARCHAR(200),
    requester_name VARCHAR(200),
    approver_id VARCHAR(200),
    approver_name VARCHAR(200),
    cost_center_id VARCHAR(200),
    cost_center_name VARCHAR(200),
    company_code VARCHAR(50),
    plant_code VARCHAR(50),
    lines_json JSONB NOT NULL DEFAULT '[]'::JSONB,
    notes TEXT,
    local_po_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    PRIMARY KEY (erp_system, erp_purchase_order_id)
);

CREATE INDEX IF NOT EXISTS idx_erp_purchase_orders_po_number ON erp_purchase_orders(erp_system, po_number);
CREATE INDEX IF NOT EXISTS idx_erp_purchase_orders_status ON erp_purchase_orders(status);

-- ============================================================================
-- 8. erp_cost_centers
-- Cost centers synced from ERP systems
-- Source: ERPCostCenterRow interface + upsertERPCostCenter/findERPCostCenterByErpId
-- ============================================================================
CREATE TABLE IF NOT EXISTS erp_cost_centers (
    erp_cost_center_id VARCHAR(200) NOT NULL,
    erp_system VARCHAR(30) NOT NULL,
    cost_center_code VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    parent_cost_center_id VARCHAR(200),
    manager_id VARCHAR(200),
    manager_name VARCHAR(200),
    company_code VARCHAR(50),
    department_id VARCHAR(200),
    department_name VARCHAR(200),
    budget_amount NUMERIC(14,2),
    spent_amount NUMERIC(14,2),
    currency VARCHAR(10),
    fiscal_year INTEGER,
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    local_cost_center_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    PRIMARY KEY (erp_system, erp_cost_center_id)
);

CREATE INDEX IF NOT EXISTS idx_erp_cost_centers_code ON erp_cost_centers(erp_system, cost_center_code);
CREATE INDEX IF NOT EXISTS idx_erp_cost_centers_status ON erp_cost_centers(status);

-- ============================================================================
-- 9. erp_sync_audit_logs
-- Audit trail for ERP synchronization operations
-- Source: ERPSyncAuditLogRow interface + createERPSyncAuditLog/updateERPSyncAuditLog
-- ============================================================================
CREATE TABLE IF NOT EXISTS erp_sync_audit_logs (
    audit_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    erp_system VARCHAR(30) NOT NULL,
    operation VARCHAR(50) NOT NULL,
    direction VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    total_records INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_erp_sync_audit_logs_erp_system ON erp_sync_audit_logs(erp_system);
CREATE INDEX IF NOT EXISTS idx_erp_sync_audit_logs_operation ON erp_sync_audit_logs(operation);
CREATE INDEX IF NOT EXISTS idx_erp_sync_audit_logs_started_at ON erp_sync_audit_logs(started_at DESC);
