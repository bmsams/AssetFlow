-- V030: Procurement sequence-backed numbering and requisition approval status guard
--
-- Goals:
-- 1) Replace count/max-based document numbering with sequence-backed generators.
-- 2) Enforce requisition_approvals.status integrity with an explicit check constraint.

-- ============================================================================
-- 1) Sequence-backed PO and Requisition numbering
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS purchase_order_number_seq
    AS BIGINT
    INCREMENT BY 1
    MINVALUE 1
    START WITH 1
    CACHE 50;

SELECT setval(
    'purchase_order_number_seq',
    COALESCE(
        (
            SELECT MAX(CAST(SUBSTRING(po_number FROM '([0-9]+)$') AS BIGINT)) + 1
            FROM purchase_orders
            WHERE po_number ~ '[0-9]+$'
        ),
        1
    ),
    FALSE
);

CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS VARCHAR(100) AS $$
DECLARE
    v_period VARCHAR(6);
    v_sequence BIGINT;
BEGIN
    v_period := TO_CHAR(CURRENT_DATE, 'YYYYMM');
    v_sequence := nextval('purchase_order_number_seq');
    RETURN 'PO-' || v_period || '-' || LPAD(v_sequence::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_po_number IS
    'Generates next PO number in format PO-YYYYMM-NNNNNN using purchase_order_number_seq';

CREATE SEQUENCE IF NOT EXISTS requisition_number_seq
    AS BIGINT
    INCREMENT BY 1
    MINVALUE 1
    START WITH 1
    CACHE 50;

SELECT setval(
    'requisition_number_seq',
    COALESCE(
        (
            SELECT MAX(CAST(SUBSTRING(requisition_number FROM '([0-9]+)$') AS BIGINT)) + 1
            FROM requisition_headers
            WHERE requisition_number ~ '[0-9]+$'
        ),
        1
    ),
    FALSE
);

CREATE OR REPLACE FUNCTION generate_requisition_number()
RETURNS VARCHAR(100) AS $$
DECLARE
    v_period VARCHAR(6);
    v_sequence BIGINT;
BEGIN
    v_period := TO_CHAR(CURRENT_DATE, 'YYYYMM');
    v_sequence := nextval('requisition_number_seq');
    RETURN 'RQ-' || v_period || '-' || LPAD(v_sequence::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_requisition_number IS
    'Generates next requisition number in format RQ-YYYYMM-NNNNNN using requisition_number_seq';

-- ============================================================================
-- 2) Requisition approvals status integrity
-- ============================================================================

UPDATE requisition_approvals
SET status = 'PENDING'
WHERE status IS NULL
   OR status NOT IN ('PENDING', 'APPROVED', 'REJECTED');

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'requisition_approvals'
          AND c.conname = 'valid_requisition_approval_status'
    ) THEN
        ALTER TABLE requisition_approvals
            ADD CONSTRAINT valid_requisition_approval_status
            CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'));
    END IF;
END $$;

COMMENT ON CONSTRAINT valid_requisition_approval_status ON requisition_approvals IS
    'Restricts requisition approval decisions to valid lifecycle values';
