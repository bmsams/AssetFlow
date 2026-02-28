-- ============================================================================
-- V022: Consolidate po_lines into purchase_order_lines
-- 
-- The po_lines table (V010) and purchase_order_lines table (V005) serve the
-- same purpose. This migration moves any data from po_lines into
-- purchase_order_lines and drops the duplicate table.
--
-- Safe to run even if po_lines does not exist.
-- Requirement: 5.3
-- ============================================================================

DO $$
BEGIN
    -- Only proceed if po_lines table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'po_lines'
    ) THEN
        -- Migrate rows that don't already exist in purchase_order_lines
        -- (avoid duplicate PK conflicts)
        INSERT INTO purchase_order_lines (
            line_id,
            po_id,
            line_number,
            product_type,
            product_id,
            product_description,
            product_sku,
            quantity,
            unit_price,
            total_price,
            received_quantity,
            notes,
            created_at,
            updated_at
        )
        SELECT
            pl.line_id,
            pl.po_id,
            pl.line_number,
            CASE pl.product_type::TEXT
                WHEN 'HARDWARE_MODEL' THEN 'HARDWARE'
                WHEN 'SOFTWARE_PRODUCT' THEN 'SOFTWARE'
                ELSE pl.product_type::TEXT
            END,                         -- map enum to valid product_type values
            pl.product_id,
            pl.product_description,
            pl.sku,                      -- sku -> product_sku
            pl.quantity,
            pl.unit_price,
            pl.line_total,               -- line_total -> total_price
            pl.quantity_received,        -- quantity_received -> received_quantity
            pl.notes,
            pl.created_at,
            pl.updated_at
        FROM po_lines pl
        WHERE NOT EXISTS (
            SELECT 1 FROM purchase_order_lines pol
            WHERE pol.line_id = pl.line_id
        );

        -- Drop the duplicate table
        DROP TABLE po_lines;

        -- Drop the po_product_type enum if it is no longer referenced
        DROP TYPE IF EXISTS po_product_type;
    END IF;
END $$;
