-- ============================================================================
-- V016: Software Assets Table (compatibility for reporting)
-- Asset Management System
--
-- The report-service asset reports expect a per-asset software table similar to
-- hardware_assets and enterprise_assets. The core schema currently includes
-- software_products (catalog) but not software_assets.
--
-- This migration adds a minimal software_assets table so report queries (asset
-- summary, aging, assets-by-department) do not fail at runtime.
-- ============================================================================

CREATE TABLE IF NOT EXISTS software_assets (
    asset_id UUID PRIMARY KEY REFERENCES assets(asset_id) ON DELETE CASCADE,

    -- Optional link to software catalog item
    software_product_id UUID REFERENCES software_products(product_id) ON DELETE SET NULL,

    -- Minimal fields used by report-service
    acquisition_date DATE,
    purchase_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,

    -- Optional metadata for future use
    license_key VARCHAR(500),
    vendor_id UUID REFERENCES vendors(vendor_id) ON DELETE SET NULL,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id)
);

-- Indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_software_assets_acquisition_date ON software_assets(acquisition_date);
CREATE INDEX IF NOT EXISTS idx_software_assets_software_product_id ON software_assets(software_product_id);
CREATE INDEX IF NOT EXISTS idx_software_assets_vendor_id ON software_assets(vendor_id);

-- Backfill minimal rows for any existing SOFTWARE assets
INSERT INTO software_assets (asset_id, acquisition_date, purchase_cost)
SELECT a.asset_id, a.created_at::date, 0
FROM assets a
WHERE a.asset_type = 'SOFTWARE'
ON CONFLICT (asset_id) DO NOTHING;

