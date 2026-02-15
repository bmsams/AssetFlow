-- ============================================================================
-- V017: Enterprise Assets Cost + Acquisition Date Compatibility
-- Asset Management System - Report Service Compatibility Fix
--
-- The report-service queries expect:
-- - enterprise_assets.purchase_cost
-- - enterprise_assets.acquisition_date
--
-- The original enterprise_assets schema (V004) did not include these columns.
-- This migration adds them and performs a best-effort backfill for acquisition_date
-- using commissioning_date / installation_date when available.
-- ============================================================================

ALTER TABLE enterprise_assets
  ADD COLUMN IF NOT EXISTS acquisition_date DATE,
  ADD COLUMN IF NOT EXISTS purchase_cost DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Best-effort acquisition date backfill so aging reports include enterprise assets.
UPDATE enterprise_assets
SET acquisition_date = COALESCE(commissioning_date, installation_date)
WHERE acquisition_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_enterprise_assets_acquisition_date
  ON enterprise_assets(acquisition_date)
  WHERE acquisition_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_enterprise_assets_purchase_cost
  ON enterprise_assets(purchase_cost);

