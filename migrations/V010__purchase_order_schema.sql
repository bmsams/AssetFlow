-- V010__purchase_order_schema.sql
-- Purchase Order Management Schema
-- Supports procurement workflows including PO creation, approval, and receiving

-- ============================================================================
-- Purchase Order Status Enum
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE po_status AS ENUM (
        'DRAFT',
        'PENDING_APPROVAL',
        'APPROVED',
        'REJECTED',
        'SENT',
        'PARTIALLY_RECEIVED',
        'RECEIVED',
        'CLOSED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Product Type Enum for PO Lines
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE po_product_type AS ENUM (
        'HARDWARE_MODEL',
        'SOFTWARE_PRODUCT',
        'SERVICE',
        'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Migrate existing purchase_orders table from V002 placeholder
-- The V002 placeholder has different column names, so we need to migrate
-- ============================================================================

-- Add missing columns to existing purchase_orders table
DO $$
BEGIN
    -- Add cost_center_id if it doesn't exist (make it nullable first, then set default)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'cost_center_id') THEN
        ALTER TABLE purchase_orders ADD COLUMN cost_center_id UUID REFERENCES cost_centers(cost_center_id);
    END IF;
    
    -- Rename requester_id to requested_by if requester_id exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'purchase_orders' AND column_name = 'requester_id') THEN
        ALTER TABLE purchase_orders RENAME COLUMN requester_id TO requested_by;
    END IF;
    
    -- Add requested_by if it doesn't exist (after potential rename)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'requested_by') THEN
        ALTER TABLE purchase_orders ADD COLUMN requested_by UUID REFERENCES users(user_id);
    END IF;
    
    -- Add requested_date if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'requested_date') THEN
        ALTER TABLE purchase_orders ADD COLUMN requested_date DATE DEFAULT CURRENT_DATE;
    END IF;
    
    -- Rename approver_id to approved_by if approver_id exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'purchase_orders' AND column_name = 'approver_id') THEN
        ALTER TABLE purchase_orders RENAME COLUMN approver_id TO approved_by;
    END IF;
    
    -- Add approved_by if it doesn't exist (after potential rename)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'approved_by') THEN
        ALTER TABLE purchase_orders ADD COLUMN approved_by UUID REFERENCES users(user_id);
    END IF;
    
    -- Add approved_date if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'approved_date') THEN
        ALTER TABLE purchase_orders ADD COLUMN approved_date TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add rejected_by if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'rejected_by') THEN
        ALTER TABLE purchase_orders ADD COLUMN rejected_by UUID REFERENCES users(user_id);
    END IF;
    
    -- Add rejected_date if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'rejected_date') THEN
        ALTER TABLE purchase_orders ADD COLUMN rejected_date TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add rejection_reason if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'rejection_reason') THEN
        ALTER TABLE purchase_orders ADD COLUMN rejection_reason TEXT;
    END IF;
    
    -- Add sent_date if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'sent_date') THEN
        ALTER TABLE purchase_orders ADD COLUMN sent_date TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add subtotal if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'subtotal') THEN
        ALTER TABLE purchase_orders ADD COLUMN subtotal DECIMAL(15, 2) DEFAULT 0;
    END IF;
    
    -- Add tax_amount if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'tax_amount') THEN
        ALTER TABLE purchase_orders ADD COLUMN tax_amount DECIMAL(15, 2) DEFAULT 0;
    END IF;
    
    -- Add shipping_amount if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'shipping_amount') THEN
        ALTER TABLE purchase_orders ADD COLUMN shipping_amount DECIMAL(15, 2) DEFAULT 0;
    END IF;
    
    -- Add notes if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'notes') THEN
        ALTER TABLE purchase_orders ADD COLUMN notes TEXT;
    END IF;
    
    -- Add created_by if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'created_by') THEN
        ALTER TABLE purchase_orders ADD COLUMN created_by UUID REFERENCES users(user_id);
    END IF;
    
    -- Add updated_by if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'purchase_orders' AND column_name = 'updated_by') THEN
        ALTER TABLE purchase_orders ADD COLUMN updated_by UUID REFERENCES users(user_id);
    END IF;
END $$;

-- ============================================================================
-- PO Lines Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS po_lines (
    line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    
    -- Product information
    product_type po_product_type NOT NULL,
    product_id UUID, -- References hardware_models or software_products depending on type
    product_description VARCHAR(500) NOT NULL,
    sku VARCHAR(100),
    
    -- Quantity and pricing
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(15, 2) NOT NULL CHECK (unit_price >= 0),
    line_total DECIMAL(15, 2) NOT NULL,
    
    -- Receiving tracking
    quantity_received INTEGER NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
    
    -- Additional information
    notes TEXT,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Ensure unique line numbers per PO
    UNIQUE (po_id, line_number)
);

-- ============================================================================
-- Approval Thresholds Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS approval_thresholds (
    threshold_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    min_amount DECIMAL(15, 2) NOT NULL,
    max_amount DECIMAL(15, 2), -- NULL means no upper limit
    approver_role_id UUID NOT NULL REFERENCES roles(role_id),
    requires_multiple_approvers BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Ensure non-overlapping ranges
    CONSTRAINT valid_amount_range CHECK (max_amount IS NULL OR max_amount > min_amount)
);

-- ============================================================================
-- Approval Delegations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS approval_delegations (
    delegation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delegator_id UUID NOT NULL REFERENCES users(user_id),
    delegate_id UUID NOT NULL REFERENCES users(user_id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Ensure valid date range
    CONSTRAINT valid_delegation_dates CHECK (end_date >= start_date),
    -- Prevent self-delegation
    CONSTRAINT no_self_delegation CHECK (delegator_id != delegate_id)
);

-- ============================================================================
-- Approval Records Table (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS approval_records (
    record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(po_id),
    action VARCHAR(50) NOT NULL, -- SUBMITTED, APPROVED, REJECTED, DELEGATED
    performed_by UUID NOT NULL REFERENCES users(user_id),
    performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    notes TEXT,
    
    -- For delegated approvals
    delegated_from UUID REFERENCES users(user_id)
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Purchase Orders indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_cost_center ON purchase_orders(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_requested_by ON purchase_orders(requested_by);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_requested_date ON purchase_orders(requested_date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON purchase_orders(po_number);

-- PO Lines indexes
CREATE INDEX IF NOT EXISTS idx_po_lines_po_id ON po_lines(po_id);
CREATE INDEX IF NOT EXISTS idx_po_lines_product_type ON po_lines(product_type);
CREATE INDEX IF NOT EXISTS idx_po_lines_product_id ON po_lines(product_id);

-- Approval Thresholds indexes
CREATE INDEX IF NOT EXISTS idx_approval_thresholds_active ON approval_thresholds(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_approval_thresholds_amounts ON approval_thresholds(min_amount, max_amount);

-- Approval Delegations indexes
CREATE INDEX IF NOT EXISTS idx_approval_delegations_delegator ON approval_delegations(delegator_id);
CREATE INDEX IF NOT EXISTS idx_approval_delegations_delegate ON approval_delegations(delegate_id);
CREATE INDEX IF NOT EXISTS idx_approval_delegations_dates ON approval_delegations(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_approval_delegations_active ON approval_delegations(is_active) WHERE is_active = TRUE;

-- Approval Records indexes
CREATE INDEX IF NOT EXISTS idx_approval_records_po_id ON approval_records(po_id);
CREATE INDEX IF NOT EXISTS idx_approval_records_performed_by ON approval_records(performed_by);
CREATE INDEX IF NOT EXISTS idx_approval_records_performed_at ON approval_records(performed_at);

-- ============================================================================
-- Triggers for Updated Timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_purchase_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_po_lines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER trigger_purchase_orders_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_purchase_orders_updated_at();

DROP TRIGGER IF EXISTS trigger_po_lines_updated_at ON po_lines;
CREATE TRIGGER trigger_po_lines_updated_at
    BEFORE UPDATE ON po_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_po_lines_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE purchase_orders IS 'Purchase orders for procurement workflow';
COMMENT ON TABLE po_lines IS 'Line items for purchase orders';
COMMENT ON TABLE approval_thresholds IS 'Approval routing rules based on PO amount';
COMMENT ON TABLE approval_delegations IS 'Temporary approval authority delegations';
COMMENT ON TABLE approval_records IS 'Audit trail for approval actions';
