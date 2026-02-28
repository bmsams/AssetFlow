-- V025: Add vendor_id and vendor_name to purchase_order_lines
--
-- Part of po-header-line-items:
--   Line-level vendor on PO lines (Coupa-style, mirrors SAP MM multi-vendor POs)
--   Each line can override the header-level vendor; resolution logic in the
--   application layer falls back to the PO header vendor when the line value is null.
--
-- Both columns are nullable and backward-compatible — no existing data changes required.

-- ============================================================================
-- 1. Add vendor columns to purchase_order_lines
-- ============================================================================

ALTER TABLE purchase_order_lines
    ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(vendor_id),
    ADD COLUMN IF NOT EXISTS vendor_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_pol_vendor
    ON purchase_order_lines(vendor_id)
    WHERE vendor_id IS NOT NULL;

COMMENT ON COLUMN purchase_order_lines.vendor_id
    IS 'Line-level vendor override (falls back to PO header vendor_id if null)';

COMMENT ON COLUMN purchase_order_lines.vendor_name
    IS 'Denormalized vendor name for display (line-level, falls back to PO header vendor_name if null)';
