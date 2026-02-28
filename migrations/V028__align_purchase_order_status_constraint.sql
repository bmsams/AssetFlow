-- V028: Align purchase_orders.valid_po_status with active workflow lifecycle
--
-- Problem:
-- Existing environments may still enforce a legacy status check constraint
-- that omits REJECTED and CLOSED, which breaks current PO workflow handlers.
--
-- Goal:
-- Keep legacy-compatible statuses while adding statuses required by the
-- current app flow.

DO $$
BEGIN
    ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS valid_po_status;

    ALTER TABLE purchase_orders
        ADD CONSTRAINT valid_po_status CHECK (
            status IS NULL OR status IN (
                'DRAFT',
                'PENDING_APPROVAL',
                'APPROVED',
                'REJECTED',
                'SENT',
                'ACKNOWLEDGED',
                'PARTIALLY_RECEIVED',
                'RECEIVED',
                'CLOSED',
                'INVOICED',
                'PAID',
                'CANCELLED',
                'ON_HOLD'
            )
        );
END $$;
