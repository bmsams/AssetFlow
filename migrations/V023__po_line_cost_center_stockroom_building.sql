-- V023: Add cost_center_id to purchase_order_lines and building_id to stockrooms
--
-- Part of po-transfer-sam-fixes:
--   1. Line-level cost center on PO lines (Coupa-style)
--   2. Building association for stockrooms (building-to-building transfers)
--
-- Both columns are nullable and backward-compatible — no existing data changes required.

-- ============================================================================
-- 1. Add cost_center_id to purchase_order_lines
-- ============================================================================

ALTER TABLE purchase_order_lines
    ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES cost_centers(cost_center_id);

CREATE INDEX IF NOT EXISTS idx_pol_cost_center
    ON purchase_order_lines(cost_center_id)
    WHERE cost_center_id IS NOT NULL;

COMMENT ON COLUMN purchase_order_lines.cost_center_id
    IS 'Line-level cost center override (falls back to PO header cost_center_id if null)';

-- ============================================================================
-- 2. Add building_id to stockrooms
-- ============================================================================

ALTER TABLE stockrooms
    ADD COLUMN IF NOT EXISTS building_id UUID REFERENCES buildings(building_id);

CREATE INDEX IF NOT EXISTS idx_stockrooms_building
    ON stockrooms(building_id)
    WHERE building_id IS NOT NULL;

COMMENT ON COLUMN stockrooms.building_id
    IS 'Building where this stockroom is physically located';
