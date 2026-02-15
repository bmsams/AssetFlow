-- ============================================================================
-- V006: Stockroom and Inventory Schema Migration
-- Asset Management System - Stockroom and Inventory Tables
-- 
-- This migration updates placeholder tables and creates new tables for:
-- - stockrooms: Full stockroom definition (UPDATE from V002 placeholder)
-- - stockroom_inventory: Inventory tracking per stockroom/product (NEW)
-- - transfer_orders: Asset/inventory transfer requests (NEW)
-- - transfer_order_lines: Line items for transfer orders (NEW)
-- - stockroom_rules: Replenishment and inventory rules (NEW)
-- - receiving_records: Receiving documentation (NEW)
-- - receiving_lines: Line items for receiving records (NEW)
-- - loaner_checkouts: Loaner asset tracking (NEW)
-- - audit_records: Inventory audit tracking (NEW)
-- - audit_scans: Individual scan records for audits (NEW)
--
-- Requirements: 2E.1-2E.9
-- ============================================================================

-- ============================================================================
-- STOCKROOMS TABLE - UPDATE PLACEHOLDER
-- Physical or logical inventory locations
-- Requirement: 2E.1 (stockroom_id, name, location, stockroom_type, manager_id, is_active)
-- ============================================================================

-- Add new columns to stockrooms table
ALTER TABLE stockrooms
    ADD COLUMN IF NOT EXISTS stockroom_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255),
    ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255),
    ADD COLUMN IF NOT EXISTS city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS state_province VARCHAR(100),
    ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'USA',
    ADD COLUMN IF NOT EXISTS building VARCHAR(100),
    ADD COLUMN IF NOT EXISTS floor VARCHAR(20),
    ADD COLUMN IF NOT EXISTS room VARCHAR(50),
    ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS operating_hours VARCHAR(255),
    ADD COLUMN IF NOT EXISTS capacity_units INTEGER,
    ADD COLUMN IF NOT EXISTS current_utilization INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS parent_stockroom_id UUID,
    ADD COLUMN IF NOT EXISTS cost_center_id UUID,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS created_by UUID,
    ADD COLUMN IF NOT EXISTS updated_by UUID;

-- Add foreign key constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'stockrooms_parent_fk'
    ) THEN
        ALTER TABLE stockrooms
            ADD CONSTRAINT stockrooms_parent_fk 
            FOREIGN KEY (parent_stockroom_id) REFERENCES stockrooms(stockroom_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'stockrooms_cost_center_fk'
    ) THEN
        ALTER TABLE stockrooms
            ADD CONSTRAINT stockrooms_cost_center_fk 
            FOREIGN KEY (cost_center_id) REFERENCES cost_centers(cost_center_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'stockrooms_created_by_fk'
    ) THEN
        ALTER TABLE stockrooms
            ADD CONSTRAINT stockrooms_created_by_fk 
            FOREIGN KEY (created_by) REFERENCES users(user_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'stockrooms_updated_by_fk'
    ) THEN
        ALTER TABLE stockrooms
            ADD CONSTRAINT stockrooms_updated_by_fk 
            FOREIGN KEY (updated_by) REFERENCES users(user_id);
    END IF;
END $$;

-- Add constraint for stockroom type
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_stockroom_type'
    ) THEN
        ALTER TABLE stockrooms
            ADD CONSTRAINT valid_stockroom_type CHECK (stockroom_type IS NULL OR stockroom_type IN (
                'MAIN',                -- Main/primary stockroom
                'SATELLITE',           -- Satellite/remote stockroom
                'VIRTUAL',             -- Virtual/logical stockroom
                'REPAIR',              -- Repair/maintenance stockroom
                'QUARANTINE',          -- Quarantine for damaged/suspect items
                'DISPOSAL',            -- Disposal staging area
                'RECEIVING',           -- Receiving dock
                'LOANER',              -- Loaner pool
                'SPARE_PARTS',         -- Spare parts inventory
                'OTHER'                -- Other stockroom type
            ));
    END IF;
END $$;

-- Add constraint for capacity
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_stockroom_capacity'
    ) THEN
        ALTER TABLE stockrooms
            ADD CONSTRAINT valid_stockroom_capacity CHECK (
                capacity_units IS NULL OR capacity_units >= 0
            );
    END IF;
END $$;

-- Create unique constraint on stockroom_code if not exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_stockrooms_code ON stockrooms(stockroom_code) WHERE stockroom_code IS NOT NULL;

-- Add indexes for stockroom queries
CREATE INDEX IF NOT EXISTS idx_stockrooms_name ON stockrooms(name);
CREATE INDEX IF NOT EXISTS idx_stockrooms_type ON stockrooms(stockroom_type);
CREATE INDEX IF NOT EXISTS idx_stockrooms_active ON stockrooms(is_active);
CREATE INDEX IF NOT EXISTS idx_stockrooms_manager ON stockrooms(manager_id);
CREATE INDEX IF NOT EXISTS idx_stockrooms_parent ON stockrooms(parent_stockroom_id);
CREATE INDEX IF NOT EXISTS idx_stockrooms_location ON stockrooms(city, state_province);

-- Update comments
COMMENT ON TABLE stockrooms IS 'Physical or logical inventory locations (Requirement 2E.1)';
COMMENT ON COLUMN stockrooms.stockroom_id IS 'Unique identifier for the stockroom';
COMMENT ON COLUMN stockrooms.stockroom_code IS 'Short code for the stockroom (e.g., MAIN-NYC, SAT-CHI)';
COMMENT ON COLUMN stockrooms.name IS 'Full name of the stockroom';
COMMENT ON COLUMN stockrooms.location IS 'General location description';
COMMENT ON COLUMN stockrooms.stockroom_type IS 'Type of stockroom (MAIN, SATELLITE, VIRTUAL, etc.)';
COMMENT ON COLUMN stockrooms.manager_id IS 'User responsible for managing this stockroom';
COMMENT ON COLUMN stockrooms.is_active IS 'Whether the stockroom is currently active';
COMMENT ON COLUMN stockrooms.capacity_units IS 'Maximum capacity in units';
COMMENT ON COLUMN stockrooms.current_utilization IS 'Current utilization in units';
COMMENT ON COLUMN stockrooms.parent_stockroom_id IS 'Parent stockroom for hierarchical organization';

-- Apply update timestamp trigger to stockrooms
DROP TRIGGER IF EXISTS trigger_stockrooms_updated_at ON stockrooms;
CREATE TRIGGER trigger_stockrooms_updated_at
    BEFORE UPDATE ON stockrooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- STOCKROOM_INVENTORY TABLE - NEW
-- Inventory tracking per stockroom and product
-- Requirement: 2E.2 (stockroom_id, product_id, quantity_on_hand, quantity_reserved,
--              quantity_available, reorder_point, reorder_quantity)
-- ============================================================================
CREATE TABLE stockroom_inventory (
    inventory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Requirement 2E.2: Core inventory attributes
    stockroom_id UUID NOT NULL REFERENCES stockrooms(stockroom_id) ON DELETE CASCADE,
    product_id UUID,
    product_type VARCHAR(30) NOT NULL,
    product_sku VARCHAR(100),
    product_description VARCHAR(500),
    
    -- Quantity tracking
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    quantity_reserved INTEGER NOT NULL DEFAULT 0,
    quantity_available INTEGER GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
    quantity_in_transit INTEGER DEFAULT 0,
    quantity_on_order INTEGER DEFAULT 0,
    
    -- Reorder settings
    reorder_point INTEGER,
    reorder_quantity INTEGER,
    max_quantity INTEGER,
    
    -- Unit information
    unit_of_measure VARCHAR(20) DEFAULT 'EACH',
    unit_cost DECIMAL(12, 2),
    total_value DECIMAL(14, 2),
    
    -- Location within stockroom
    bin_location VARCHAR(50),
    shelf_location VARCHAR(50),
    
    -- Tracking
    last_count_date DATE,
    last_count_quantity INTEGER,
    last_received_date DATE,
    last_issued_date DATE,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique product per stockroom
    CONSTRAINT unique_stockroom_product UNIQUE (stockroom_id, product_id, product_type),
    
    -- Valid product types
    CONSTRAINT valid_inventory_product_type CHECK (product_type IN (
        'HARDWARE_MODEL',      -- Hardware model (from models table)
        'SOFTWARE_PRODUCT',    -- Software product
        'SPARE_PART',          -- Spare part
        'CONSUMABLE',          -- Consumable item
        'ACCESSORY',           -- Accessory item
        'OTHER'                -- Other product type
    )),
    
    -- Quantity constraints
    CONSTRAINT valid_quantity_on_hand CHECK (quantity_on_hand >= 0),
    CONSTRAINT valid_quantity_reserved CHECK (quantity_reserved >= 0),
    CONSTRAINT reserved_lte_on_hand CHECK (quantity_reserved <= quantity_on_hand),
    CONSTRAINT valid_quantity_in_transit CHECK (quantity_in_transit IS NULL OR quantity_in_transit >= 0),
    CONSTRAINT valid_quantity_on_order CHECK (quantity_on_order IS NULL OR quantity_on_order >= 0),
    
    -- Reorder constraints
    CONSTRAINT valid_reorder_point CHECK (reorder_point IS NULL OR reorder_point >= 0),
    CONSTRAINT valid_reorder_quantity CHECK (reorder_quantity IS NULL OR reorder_quantity > 0),
    CONSTRAINT valid_max_quantity CHECK (max_quantity IS NULL OR max_quantity >= 0),
    CONSTRAINT reorder_lte_max CHECK (
        reorder_point IS NULL OR max_quantity IS NULL OR reorder_point <= max_quantity
    ),
    
    -- Unit of measure constraint
    CONSTRAINT valid_unit_of_measure CHECK (unit_of_measure IN (
        'EACH', 'BOX', 'CASE', 'PACK', 'SET', 'KIT', 'ROLL', 'PAIR', 'OTHER'
    ))
);

COMMENT ON TABLE stockroom_inventory IS 'Inventory tracking per stockroom and product (Requirement 2E.2)';
COMMENT ON COLUMN stockroom_inventory.inventory_id IS 'Unique identifier for the inventory record';
COMMENT ON COLUMN stockroom_inventory.stockroom_id IS 'Reference to the stockroom';
COMMENT ON COLUMN stockroom_inventory.product_id IS 'Reference to the product (model_id, software_product_id, etc.)';
COMMENT ON COLUMN stockroom_inventory.product_type IS 'Type of product being tracked';
COMMENT ON COLUMN stockroom_inventory.quantity_on_hand IS 'Total quantity physically in stockroom';
COMMENT ON COLUMN stockroom_inventory.quantity_reserved IS 'Quantity reserved for pending orders/requests';
COMMENT ON COLUMN stockroom_inventory.quantity_available IS 'Computed: on_hand - reserved';
COMMENT ON COLUMN stockroom_inventory.reorder_point IS 'Quantity threshold to trigger reorder';
COMMENT ON COLUMN stockroom_inventory.reorder_quantity IS 'Quantity to order when reorder triggered';
COMMENT ON COLUMN stockroom_inventory.bin_location IS 'Bin location within stockroom';

-- Indexes for stockroom inventory queries
CREATE INDEX idx_si_stockroom ON stockroom_inventory(stockroom_id);
CREATE INDEX idx_si_product ON stockroom_inventory(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_si_product_type ON stockroom_inventory(product_type);
CREATE INDEX idx_si_sku ON stockroom_inventory(product_sku) WHERE product_sku IS NOT NULL;
CREATE INDEX idx_si_active ON stockroom_inventory(is_active);
CREATE INDEX idx_si_bin ON stockroom_inventory(stockroom_id, bin_location) WHERE bin_location IS NOT NULL;

-- Index for reorder alerts (finding items below reorder point)
CREATE INDEX idx_si_reorder_alert ON stockroom_inventory(stockroom_id, quantity_on_hand, reorder_point)
    WHERE is_active = TRUE AND reorder_point IS NOT NULL;

-- Apply update timestamp trigger
CREATE TRIGGER trigger_si_updated_at
    BEFORE UPDATE ON stockroom_inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- TRANSFER_ORDERS TABLE - NEW
-- Asset/inventory transfer requests between stockrooms
-- Requirement: 2E.3 (transfer_id, from_stockroom_id, to_stockroom_id, status,
--              requested_by, requested_date, approved_by, approved_date)
-- ============================================================================
CREATE TABLE transfer_orders (
    transfer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Requirement 2E.3: Core transfer attributes
    from_stockroom_id UUID NOT NULL REFERENCES stockrooms(stockroom_id),
    to_stockroom_id UUID NOT NULL REFERENCES stockrooms(stockroom_id),
    
    -- Status tracking
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    priority VARCHAR(20) DEFAULT 'NORMAL',
    
    -- Request information
    requested_by UUID NOT NULL REFERENCES users(user_id),
    requested_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT,
    
    -- Approval information
    approved_by UUID REFERENCES users(user_id),
    approved_date TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Shipping information
    shipped_by UUID REFERENCES users(user_id),
    shipped_date TIMESTAMP WITH TIME ZONE,
    shipping_method VARCHAR(100),
    tracking_number VARCHAR(255),
    carrier VARCHAR(100),
    
    -- Receiving information
    received_by UUID REFERENCES users(user_id),
    received_date TIMESTAMP WITH TIME ZONE,
    receiving_notes TEXT,
    
    -- Completion
    completed_date TIMESTAMP WITH TIME ZONE,
    cancelled_date TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    
    -- Counts
    total_line_count INTEGER DEFAULT 0,
    total_quantity INTEGER DEFAULT 0,
    shipped_quantity INTEGER DEFAULT 0,
    received_quantity INTEGER DEFAULT 0,
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id),
    
    -- Cannot transfer to same stockroom
    CONSTRAINT different_stockrooms CHECK (from_stockroom_id != to_stockroom_id),
    
    -- Valid status values
    CONSTRAINT valid_transfer_status CHECK (status IN (
        'DRAFT',               -- Being created
        'PENDING_APPROVAL',    -- Awaiting approval
        'APPROVED',            -- Approved, ready to ship
        'REJECTED',            -- Rejected
        'IN_TRANSIT',          -- Shipped, in transit
        'PARTIALLY_RECEIVED',  -- Some items received
        'RECEIVED',            -- All items received
        'COMPLETED',           -- Transfer completed
        'CANCELLED',           -- Transfer cancelled
        'ON_HOLD'              -- Temporarily on hold
    )),
    
    -- Valid priority values
    CONSTRAINT valid_transfer_priority CHECK (priority IN (
        'LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'
    ))
);

COMMENT ON TABLE transfer_orders IS 'Asset/inventory transfer requests between stockrooms (Requirement 2E.3)';
COMMENT ON COLUMN transfer_orders.transfer_id IS 'Unique identifier for the transfer order';
COMMENT ON COLUMN transfer_orders.transfer_number IS 'Human-readable transfer number';
COMMENT ON COLUMN transfer_orders.from_stockroom_id IS 'Source stockroom';
COMMENT ON COLUMN transfer_orders.to_stockroom_id IS 'Destination stockroom';
COMMENT ON COLUMN transfer_orders.status IS 'Current transfer status';
COMMENT ON COLUMN transfer_orders.requested_by IS 'User who requested the transfer';
COMMENT ON COLUMN transfer_orders.requested_date IS 'Date/time transfer was requested';
COMMENT ON COLUMN transfer_orders.approved_by IS 'User who approved the transfer';
COMMENT ON COLUMN transfer_orders.approved_date IS 'Date/time transfer was approved';

-- Indexes for transfer order queries
CREATE INDEX idx_to_from_stockroom ON transfer_orders(from_stockroom_id);
CREATE INDEX idx_to_to_stockroom ON transfer_orders(to_stockroom_id);
CREATE INDEX idx_to_status ON transfer_orders(status);
CREATE INDEX idx_to_requested_by ON transfer_orders(requested_by);
CREATE INDEX idx_to_requested_date ON transfer_orders(requested_date);
CREATE INDEX idx_to_approved_by ON transfer_orders(approved_by);
CREATE INDEX idx_to_priority ON transfer_orders(priority);

-- Composite indexes for common queries
CREATE INDEX idx_to_pending_approval ON transfer_orders(status, requested_date)
    WHERE status = 'PENDING_APPROVAL';
CREATE INDEX idx_to_in_transit ON transfer_orders(status, shipped_date)
    WHERE status = 'IN_TRANSIT';
CREATE INDEX idx_to_stockroom_status ON transfer_orders(from_stockroom_id, status);

-- Apply update timestamp trigger
CREATE TRIGGER trigger_to_updated_at
    BEFORE UPDATE ON transfer_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- TRANSFER_ORDER_LINES TABLE - NEW
-- Line items for transfer orders
-- Requirement: 2E.4 (line_id, transfer_id, asset_id or product_id, quantity,
--              shipped_date, received_date)
-- ============================================================================
CREATE TABLE transfer_order_lines (
    line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES transfer_orders(transfer_id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    
    -- Requirement 2E.4: Item identification (asset_id OR product_id)
    asset_id UUID REFERENCES assets(asset_id),
    product_id UUID,
    product_type VARCHAR(30),
    product_description VARCHAR(500),
    serial_number VARCHAR(100),
    asset_tag VARCHAR(50),
    
    -- Quantities
    quantity INTEGER NOT NULL DEFAULT 1,
    shipped_quantity INTEGER DEFAULT 0,
    received_quantity INTEGER DEFAULT 0,
    damaged_quantity INTEGER DEFAULT 0,
    
    -- Dates
    shipped_date TIMESTAMP WITH TIME ZONE,
    received_date TIMESTAMP WITH TIME ZONE,
    
    -- Status
    status VARCHAR(30) DEFAULT 'PENDING',
    
    -- Condition tracking
    condition_shipped VARCHAR(30),
    condition_received VARCHAR(30),
    condition_notes TEXT,
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique line number per transfer
    CONSTRAINT unique_transfer_line UNIQUE (transfer_id, line_number),
    
    -- Must have either asset_id or product_id
    CONSTRAINT has_item_reference CHECK (
        asset_id IS NOT NULL OR product_id IS NOT NULL
    ),
    
    -- Valid line status
    CONSTRAINT valid_tol_status CHECK (status IN (
        'PENDING',             -- Not yet shipped
        'SHIPPED',             -- Shipped
        'IN_TRANSIT',          -- In transit
        'RECEIVED',            -- Received
        'PARTIALLY_RECEIVED',  -- Partially received
        'DAMAGED',             -- Received damaged
        'CANCELLED'            -- Line cancelled
    )),
    
    -- Valid condition values
    CONSTRAINT valid_condition_shipped CHECK (condition_shipped IS NULL OR condition_shipped IN (
        'NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'UNKNOWN'
    )),
    CONSTRAINT valid_condition_received CHECK (condition_received IS NULL OR condition_received IN (
        'NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'UNKNOWN'
    )),
    
    -- Quantity constraints
    CONSTRAINT valid_tol_quantity CHECK (quantity > 0),
    CONSTRAINT valid_tol_shipped CHECK (shipped_quantity >= 0),
    CONSTRAINT valid_tol_received CHECK (received_quantity >= 0),
    CONSTRAINT valid_tol_damaged CHECK (damaged_quantity >= 0),
    CONSTRAINT shipped_lte_quantity CHECK (shipped_quantity <= quantity),
    CONSTRAINT received_lte_shipped CHECK (received_quantity <= shipped_quantity OR shipped_quantity = 0)
);

COMMENT ON TABLE transfer_order_lines IS 'Line items for transfer orders (Requirement 2E.4)';
COMMENT ON COLUMN transfer_order_lines.line_id IS 'Unique identifier for the line item';
COMMENT ON COLUMN transfer_order_lines.transfer_id IS 'Reference to the transfer order';
COMMENT ON COLUMN transfer_order_lines.line_number IS 'Line number within the transfer';
COMMENT ON COLUMN transfer_order_lines.asset_id IS 'Reference to specific asset (for individual asset transfers)';
COMMENT ON COLUMN transfer_order_lines.product_id IS 'Reference to product (for bulk inventory transfers)';
COMMENT ON COLUMN transfer_order_lines.quantity IS 'Quantity to transfer';
COMMENT ON COLUMN transfer_order_lines.shipped_date IS 'Date/time item was shipped';
COMMENT ON COLUMN transfer_order_lines.received_date IS 'Date/time item was received';

-- Indexes for transfer order line queries
CREATE INDEX idx_tol_transfer ON transfer_order_lines(transfer_id);
CREATE INDEX idx_tol_asset ON transfer_order_lines(asset_id) WHERE asset_id IS NOT NULL;
CREATE INDEX idx_tol_product ON transfer_order_lines(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_tol_status ON transfer_order_lines(status);
CREATE INDEX idx_tol_serial ON transfer_order_lines(serial_number) WHERE serial_number IS NOT NULL;

-- Apply update timestamp trigger
CREATE TRIGGER trigger_tol_updated_at
    BEFORE UPDATE ON transfer_order_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- STOCKROOM_RULES TABLE - NEW
-- Replenishment and inventory rules per stockroom/product
-- Requirement: 2E.5 (rule_id, stockroom_id, product_id, min_quantity, max_quantity,
--              auto_replenish, replenish_vendor_id)
-- ============================================================================
CREATE TABLE stockroom_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Requirement 2E.5: Core rule attributes
    stockroom_id UUID NOT NULL REFERENCES stockrooms(stockroom_id) ON DELETE CASCADE,
    product_id UUID,
    product_type VARCHAR(30),
    product_sku VARCHAR(100),
    
    -- Rule name and description
    rule_name VARCHAR(255),
    description TEXT,
    
    -- Quantity thresholds
    min_quantity INTEGER NOT NULL,
    max_quantity INTEGER,
    reorder_point INTEGER,
    reorder_quantity INTEGER,
    safety_stock INTEGER DEFAULT 0,
    
    -- Auto-replenishment settings
    auto_replenish BOOLEAN DEFAULT FALSE,
    replenish_vendor_id UUID REFERENCES vendors(vendor_id),
    replenish_lead_days INTEGER,
    replenish_cost_center_id UUID REFERENCES cost_centers(cost_center_id),
    
    -- Alert settings
    alert_on_low_stock BOOLEAN DEFAULT TRUE,
    alert_on_overstock BOOLEAN DEFAULT FALSE,
    alert_recipients TEXT[],
    
    -- Rule priority and status
    priority INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Effective dates
    effective_start_date DATE,
    effective_end_date DATE,
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id),
    
    -- Ensure unique rule per stockroom/product combination
    CONSTRAINT unique_stockroom_product_rule UNIQUE (stockroom_id, product_id, product_type),
    
    -- Valid product types
    CONSTRAINT valid_rule_product_type CHECK (product_type IS NULL OR product_type IN (
        'HARDWARE_MODEL', 'SOFTWARE_PRODUCT', 'SPARE_PART', 'CONSUMABLE', 'ACCESSORY', 'OTHER'
    )),
    
    -- Quantity constraints
    CONSTRAINT valid_min_quantity CHECK (min_quantity >= 0),
    CONSTRAINT valid_max_quantity CHECK (max_quantity IS NULL OR max_quantity >= 0),
    CONSTRAINT min_lte_max CHECK (max_quantity IS NULL OR min_quantity <= max_quantity),
    CONSTRAINT valid_reorder_point CHECK (reorder_point IS NULL OR reorder_point >= 0),
    CONSTRAINT valid_rule_reorder_qty CHECK (reorder_quantity IS NULL OR reorder_quantity > 0),
    CONSTRAINT valid_safety_stock CHECK (safety_stock >= 0),
    CONSTRAINT valid_lead_days CHECK (replenish_lead_days IS NULL OR replenish_lead_days >= 0),
    
    -- Auto-replenish requires vendor
    CONSTRAINT auto_replenish_needs_vendor CHECK (
        auto_replenish = FALSE OR replenish_vendor_id IS NOT NULL
    )
);

COMMENT ON TABLE stockroom_rules IS 'Replenishment and inventory rules per stockroom/product (Requirement 2E.5)';
COMMENT ON COLUMN stockroom_rules.rule_id IS 'Unique identifier for the rule';
COMMENT ON COLUMN stockroom_rules.stockroom_id IS 'Reference to the stockroom';
COMMENT ON COLUMN stockroom_rules.product_id IS 'Reference to the product';
COMMENT ON COLUMN stockroom_rules.min_quantity IS 'Minimum quantity to maintain';
COMMENT ON COLUMN stockroom_rules.max_quantity IS 'Maximum quantity allowed';
COMMENT ON COLUMN stockroom_rules.auto_replenish IS 'Whether to auto-generate POs when below threshold';
COMMENT ON COLUMN stockroom_rules.replenish_vendor_id IS 'Preferred vendor for auto-replenishment';
COMMENT ON COLUMN stockroom_rules.replenish_lead_days IS 'Expected lead time for replenishment';

-- Indexes for stockroom rules queries
CREATE INDEX idx_sr_stockroom ON stockroom_rules(stockroom_id);
CREATE INDEX idx_sr_product ON stockroom_rules(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_sr_vendor ON stockroom_rules(replenish_vendor_id) WHERE replenish_vendor_id IS NOT NULL;
CREATE INDEX idx_sr_active ON stockroom_rules(is_active);
CREATE INDEX idx_sr_auto_replenish ON stockroom_rules(stockroom_id, auto_replenish) WHERE auto_replenish = TRUE;

-- Apply update timestamp trigger
CREATE TRIGGER trigger_sr_updated_at
    BEFORE UPDATE ON stockroom_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- RECEIVING_RECORDS TABLE - NEW
-- Receiving documentation for purchase orders
-- Requirement: 2E.6 (receiving_id, po_id, received_by, received_date, stockroom_id, notes)
-- ============================================================================
CREATE TABLE receiving_records (
    receiving_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receiving_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Requirement 2E.6: Core receiving attributes
    po_id UUID REFERENCES purchase_orders(po_id),
    stockroom_id UUID NOT NULL REFERENCES stockrooms(stockroom_id),
    
    -- Receiving information
    received_by UUID NOT NULL REFERENCES users(user_id),
    received_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Vendor/shipping information
    vendor_id UUID REFERENCES vendors(vendor_id),
    packing_slip_number VARCHAR(100),
    carrier VARCHAR(100),
    tracking_number VARCHAR(255),
    
    -- Status
    status VARCHAR(30) DEFAULT 'IN_PROGRESS',
    
    -- Counts
    total_line_count INTEGER DEFAULT 0,
    total_quantity_expected INTEGER DEFAULT 0,
    total_quantity_received INTEGER DEFAULT 0,
    total_quantity_rejected INTEGER DEFAULT 0,
    
    -- Completion
    completed_date TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES users(user_id),
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id),
    
    -- Valid status values
    CONSTRAINT valid_receiving_status CHECK (status IN (
        'IN_PROGRESS',         -- Currently receiving
        'COMPLETED',           -- All items received
        'PARTIALLY_COMPLETED', -- Some items received, rest pending
        'ON_HOLD',             -- Receiving on hold
        'CANCELLED'            -- Receiving cancelled
    ))
);

COMMENT ON TABLE receiving_records IS 'Receiving documentation for purchase orders (Requirement 2E.6)';
COMMENT ON COLUMN receiving_records.receiving_id IS 'Unique identifier for the receiving record';
COMMENT ON COLUMN receiving_records.receiving_number IS 'Human-readable receiving number';
COMMENT ON COLUMN receiving_records.po_id IS 'Reference to the purchase order';
COMMENT ON COLUMN receiving_records.stockroom_id IS 'Stockroom where items are being received';
COMMENT ON COLUMN receiving_records.received_by IS 'User who performed the receiving';
COMMENT ON COLUMN receiving_records.received_date IS 'Date/time of receiving';
COMMENT ON COLUMN receiving_records.notes IS 'General notes about the receiving';

-- Indexes for receiving records queries
CREATE INDEX idx_rr_po ON receiving_records(po_id) WHERE po_id IS NOT NULL;
CREATE INDEX idx_rr_stockroom ON receiving_records(stockroom_id);
CREATE INDEX idx_rr_received_by ON receiving_records(received_by);
CREATE INDEX idx_rr_received_date ON receiving_records(received_date);
CREATE INDEX idx_rr_vendor ON receiving_records(vendor_id) WHERE vendor_id IS NOT NULL;
CREATE INDEX idx_rr_status ON receiving_records(status);
CREATE INDEX idx_rr_tracking ON receiving_records(tracking_number) WHERE tracking_number IS NOT NULL;

-- Apply update timestamp trigger
CREATE TRIGGER trigger_rr_updated_at
    BEFORE UPDATE ON receiving_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- RECEIVING_LINES TABLE - NEW
-- Line items for receiving records
-- Requirement: 2E.7 (line_id, receiving_id, po_line_id, quantity_received,
--              condition, asset_ids_created, serial_numbers_scanned)
-- ============================================================================
CREATE TABLE receiving_lines (
    line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receiving_id UUID NOT NULL REFERENCES receiving_records(receiving_id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    
    -- Requirement 2E.7: Core line attributes
    po_line_id UUID REFERENCES purchase_order_lines(line_id),
    
    -- Product information
    product_id UUID,
    product_type VARCHAR(30),
    product_description VARCHAR(500),
    product_sku VARCHAR(100),
    
    -- Quantities
    quantity_expected INTEGER,
    quantity_received INTEGER NOT NULL DEFAULT 0,
    quantity_rejected INTEGER DEFAULT 0,
    quantity_damaged INTEGER DEFAULT 0,
    
    -- Condition assessment
    condition VARCHAR(30) DEFAULT 'GOOD',
    condition_notes TEXT,
    
    -- Asset creation tracking
    asset_ids_created UUID[],
    assets_created_count INTEGER DEFAULT 0,
    
    -- Serial number tracking
    serial_numbers_scanned TEXT[],
    serial_numbers_expected TEXT[],
    
    -- Location assignment
    bin_location VARCHAR(50),
    shelf_location VARCHAR(50),
    
    -- Status
    status VARCHAR(30) DEFAULT 'PENDING',
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique line number per receiving record
    CONSTRAINT unique_receiving_line UNIQUE (receiving_id, line_number),
    
    -- Valid condition values
    CONSTRAINT valid_rl_condition CHECK (condition IN (
        'NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'DEFECTIVE', 'UNKNOWN'
    )),
    
    -- Valid line status
    CONSTRAINT valid_rl_status CHECK (status IN (
        'PENDING',             -- Not yet received
        'RECEIVED',            -- Fully received
        'PARTIALLY_RECEIVED',  -- Partially received
        'REJECTED',            -- Rejected
        'DAMAGED',             -- Received damaged
        'CANCELLED'            -- Line cancelled
    )),
    
    -- Quantity constraints
    CONSTRAINT valid_rl_received CHECK (quantity_received >= 0),
    CONSTRAINT valid_rl_rejected CHECK (quantity_rejected >= 0),
    CONSTRAINT valid_rl_damaged CHECK (quantity_damaged >= 0)
);

COMMENT ON TABLE receiving_lines IS 'Line items for receiving records (Requirement 2E.7)';
COMMENT ON COLUMN receiving_lines.line_id IS 'Unique identifier for the line item';
COMMENT ON COLUMN receiving_lines.receiving_id IS 'Reference to the receiving record';
COMMENT ON COLUMN receiving_lines.line_number IS 'Line number within the receiving record';
COMMENT ON COLUMN receiving_lines.po_line_id IS 'Reference to the purchase order line';
COMMENT ON COLUMN receiving_lines.quantity_received IS 'Quantity actually received';
COMMENT ON COLUMN receiving_lines.condition IS 'Condition of received items';
COMMENT ON COLUMN receiving_lines.asset_ids_created IS 'Array of asset IDs created from this line';
COMMENT ON COLUMN receiving_lines.serial_numbers_scanned IS 'Array of serial numbers scanned during receiving';

-- Indexes for receiving lines queries
CREATE INDEX idx_rl_receiving ON receiving_lines(receiving_id);
CREATE INDEX idx_rl_po_line ON receiving_lines(po_line_id) WHERE po_line_id IS NOT NULL;
CREATE INDEX idx_rl_product ON receiving_lines(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_rl_status ON receiving_lines(status);
CREATE INDEX idx_rl_condition ON receiving_lines(condition);

-- Apply update timestamp trigger
CREATE TRIGGER trigger_rl_updated_at
    BEFORE UPDATE ON receiving_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- LOANER_CHECKOUTS TABLE - NEW
-- Loaner asset checkout tracking
-- Requirement: 2E.8 (checkout_id, asset_id, checked_out_to, checked_out_by,
--              checkout_date, due_date, return_date, condition_out, condition_in)
-- ============================================================================
CREATE TABLE loaner_checkouts (
    checkout_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkout_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Requirement 2E.8: Core checkout attributes
    asset_id UUID NOT NULL REFERENCES assets(asset_id),
    
    -- Checkout information
    checked_out_to UUID NOT NULL REFERENCES users(user_id),
    checked_out_by UUID NOT NULL REFERENCES users(user_id),
    checkout_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Due date and return
    due_date DATE NOT NULL,
    return_date TIMESTAMP WITH TIME ZONE,
    returned_by UUID REFERENCES users(user_id),
    
    -- Condition tracking
    condition_out VARCHAR(30) NOT NULL,
    condition_in VARCHAR(30),
    condition_out_notes TEXT,
    condition_in_notes TEXT,
    
    -- Checkout details
    purpose TEXT,
    department_id UUID REFERENCES departments(department_id),
    cost_center_id UUID REFERENCES cost_centers(cost_center_id),
    project_code VARCHAR(50),
    
    -- Status
    status VARCHAR(30) DEFAULT 'CHECKED_OUT',
    
    -- Extension tracking
    original_due_date DATE,
    extension_count INTEGER DEFAULT 0,
    last_extension_date DATE,
    extension_approved_by UUID REFERENCES users(user_id),
    
    -- Overdue tracking
    is_overdue BOOLEAN DEFAULT FALSE,
    overdue_notification_count INTEGER DEFAULT 0,
    last_overdue_notification TIMESTAMP WITH TIME ZONE,
    escalation_level INTEGER DEFAULT 0,
    
    -- Fees/charges
    daily_rate DECIMAL(10, 2),
    total_charges DECIMAL(10, 2),
    damage_charges DECIMAL(10, 2),
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id),
    
    -- Valid status values
    CONSTRAINT valid_checkout_status CHECK (status IN (
        'CHECKED_OUT',         -- Currently checked out
        'RETURNED',            -- Returned on time
        'RETURNED_LATE',       -- Returned after due date
        'RETURNED_DAMAGED',    -- Returned with damage
        'OVERDUE',             -- Past due date, not returned
        'LOST',                -- Asset reported lost
        'CANCELLED'            -- Checkout cancelled
    )),
    
    -- Valid condition values
    CONSTRAINT valid_condition_out CHECK (condition_out IN (
        'NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'
    )),
    CONSTRAINT valid_condition_in CHECK (condition_in IS NULL OR condition_in IN (
        'NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'LOST'
    )),
    
    -- Due date must be after checkout date
    CONSTRAINT due_after_checkout CHECK (due_date >= checkout_date::DATE),
    
    -- Return date must be after checkout date
    CONSTRAINT return_after_checkout CHECK (
        return_date IS NULL OR return_date >= checkout_date
    ),
    
    -- Extension count must be non-negative
    CONSTRAINT valid_extension_count CHECK (extension_count >= 0),
    
    -- Escalation level must be non-negative
    CONSTRAINT valid_escalation_level CHECK (escalation_level >= 0)
);

COMMENT ON TABLE loaner_checkouts IS 'Loaner asset checkout tracking (Requirement 2E.8)';
COMMENT ON COLUMN loaner_checkouts.checkout_id IS 'Unique identifier for the checkout';
COMMENT ON COLUMN loaner_checkouts.checkout_number IS 'Human-readable checkout number';
COMMENT ON COLUMN loaner_checkouts.asset_id IS 'Reference to the loaner asset';
COMMENT ON COLUMN loaner_checkouts.checked_out_to IS 'User who has the asset';
COMMENT ON COLUMN loaner_checkouts.checked_out_by IS 'User who processed the checkout';
COMMENT ON COLUMN loaner_checkouts.checkout_date IS 'Date/time of checkout';
COMMENT ON COLUMN loaner_checkouts.due_date IS 'Date asset is due to be returned';
COMMENT ON COLUMN loaner_checkouts.return_date IS 'Date/time asset was returned';
COMMENT ON COLUMN loaner_checkouts.condition_out IS 'Condition when checked out';
COMMENT ON COLUMN loaner_checkouts.condition_in IS 'Condition when returned';
COMMENT ON COLUMN loaner_checkouts.is_overdue IS 'Whether the checkout is currently overdue';
COMMENT ON COLUMN loaner_checkouts.escalation_level IS 'Current escalation level for overdue notifications';

-- Indexes for loaner checkout queries
CREATE INDEX idx_lc_asset ON loaner_checkouts(asset_id);
CREATE INDEX idx_lc_checked_out_to ON loaner_checkouts(checked_out_to);
CREATE INDEX idx_lc_checked_out_by ON loaner_checkouts(checked_out_by);
CREATE INDEX idx_lc_checkout_date ON loaner_checkouts(checkout_date);
CREATE INDEX idx_lc_due_date ON loaner_checkouts(due_date);
CREATE INDEX idx_lc_return_date ON loaner_checkouts(return_date);
CREATE INDEX idx_lc_status ON loaner_checkouts(status);
CREATE INDEX idx_lc_department ON loaner_checkouts(department_id) WHERE department_id IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX idx_lc_active ON loaner_checkouts(status, due_date)
    WHERE status = 'CHECKED_OUT';
CREATE INDEX idx_lc_overdue ON loaner_checkouts(is_overdue, due_date)
    WHERE is_overdue = TRUE;
CREATE INDEX idx_lc_user_active ON loaner_checkouts(checked_out_to, status)
    WHERE status = 'CHECKED_OUT';

-- Apply update timestamp trigger
CREATE TRIGGER trigger_lc_updated_at
    BEFORE UPDATE ON loaner_checkouts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- AUDIT_RECORDS TABLE - NEW
-- Inventory audit tracking
-- Requirement: 2E.9 (audit_id, stockroom_id, audit_type, auditor_id,
--              start_date, end_date, status, discrepancy_count)
-- ============================================================================
CREATE TABLE audit_records (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Requirement 2E.9: Core audit attributes
    stockroom_id UUID NOT NULL REFERENCES stockrooms(stockroom_id),
    audit_type VARCHAR(30) NOT NULL,
    
    -- Auditor information
    auditor_id UUID NOT NULL REFERENCES users(user_id),
    secondary_auditor_id UUID REFERENCES users(user_id),
    
    -- Audit dates
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    scheduled_date DATE,
    
    -- Status
    status VARCHAR(30) DEFAULT 'SCHEDULED',
    
    -- Scope
    scope_description TEXT,
    product_types TEXT[],
    bin_locations TEXT[],
    categories TEXT[],
    
    -- Results
    discrepancy_count INTEGER DEFAULT 0,
    items_expected INTEGER DEFAULT 0,
    items_found INTEGER DEFAULT 0,
    items_missing INTEGER DEFAULT 0,
    items_extra INTEGER DEFAULT 0,
    items_damaged INTEGER DEFAULT 0,
    
    -- Accuracy metrics
    accuracy_percentage DECIMAL(5, 2),
    value_variance DECIMAL(14, 2),
    
    -- Completion
    completed_by UUID REFERENCES users(user_id),
    completed_date TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(user_id),
    approved_date TIMESTAMP WITH TIME ZONE,
    
    -- Follow-up
    requires_recount BOOLEAN DEFAULT FALSE,
    recount_audit_id UUID,
    corrective_actions TEXT,
    
    -- Notes
    notes TEXT,
    findings_summary TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id),
    
    -- Valid audit types
    CONSTRAINT valid_audit_type CHECK (audit_type IN (
        'FULL',                -- Full stockroom audit
        'CYCLE',               -- Cycle count (subset of inventory)
        'SPOT',                -- Spot check (random sample)
        'BLIND',               -- Blind audit (no expected values shown)
        'RECONCILIATION',      -- Reconciliation audit
        'ANNUAL',              -- Annual inventory audit
        'TRANSFER',            -- Transfer verification audit
        'RECEIVING',           -- Receiving verification
        'OTHER'                -- Other audit type
    )),
    
    -- Valid status values
    CONSTRAINT valid_audit_status CHECK (status IN (
        'SCHEDULED',           -- Scheduled for future
        'IN_PROGRESS',         -- Currently being conducted
        'PENDING_REVIEW',      -- Completed, awaiting review
        'UNDER_REVIEW',        -- Being reviewed
        'COMPLETED',           -- Completed and approved
        'CANCELLED',           -- Audit cancelled
        'ON_HOLD'              -- Temporarily on hold
    )),
    
    -- End date must be after start date
    CONSTRAINT end_after_start CHECK (
        end_date IS NULL OR end_date >= start_date
    ),
    
    -- Count constraints
    CONSTRAINT valid_discrepancy_count CHECK (discrepancy_count >= 0),
    CONSTRAINT valid_items_expected CHECK (items_expected >= 0),
    CONSTRAINT valid_items_found CHECK (items_found >= 0),
    CONSTRAINT valid_items_missing CHECK (items_missing >= 0),
    CONSTRAINT valid_items_extra CHECK (items_extra >= 0),
    CONSTRAINT valid_items_damaged CHECK (items_damaged >= 0)
);

-- Add self-referential foreign key for recount
ALTER TABLE audit_records
    ADD CONSTRAINT audit_recount_fk 
    FOREIGN KEY (recount_audit_id) REFERENCES audit_records(audit_id);

COMMENT ON TABLE audit_records IS 'Inventory audit tracking (Requirement 2E.9)';
COMMENT ON COLUMN audit_records.audit_id IS 'Unique identifier for the audit';
COMMENT ON COLUMN audit_records.audit_number IS 'Human-readable audit number';
COMMENT ON COLUMN audit_records.stockroom_id IS 'Reference to the stockroom being audited';
COMMENT ON COLUMN audit_records.audit_type IS 'Type of audit (FULL, CYCLE, SPOT, BLIND, etc.)';
COMMENT ON COLUMN audit_records.auditor_id IS 'Primary auditor';
COMMENT ON COLUMN audit_records.start_date IS 'Date/time audit started';
COMMENT ON COLUMN audit_records.end_date IS 'Date/time audit ended';
COMMENT ON COLUMN audit_records.status IS 'Current audit status';
COMMENT ON COLUMN audit_records.discrepancy_count IS 'Number of discrepancies found';
COMMENT ON COLUMN audit_records.accuracy_percentage IS 'Calculated accuracy percentage';

-- Indexes for audit records queries
CREATE INDEX idx_ar_stockroom ON audit_records(stockroom_id);
CREATE INDEX idx_ar_auditor ON audit_records(auditor_id);
CREATE INDEX idx_ar_type ON audit_records(audit_type);
CREATE INDEX idx_ar_status ON audit_records(status);
CREATE INDEX idx_ar_start_date ON audit_records(start_date);
CREATE INDEX idx_ar_scheduled_date ON audit_records(scheduled_date);

-- Composite indexes for common queries
CREATE INDEX idx_ar_stockroom_status ON audit_records(stockroom_id, status);
CREATE INDEX idx_ar_scheduled ON audit_records(status, scheduled_date)
    WHERE status = 'SCHEDULED';
CREATE INDEX idx_ar_in_progress ON audit_records(status, start_date)
    WHERE status = 'IN_PROGRESS';

-- Apply update timestamp trigger
CREATE TRIGGER trigger_ar_updated_at
    BEFORE UPDATE ON audit_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- AUDIT_SCANS TABLE - NEW
-- Individual scan records for audits
-- Supporting table for audit_records
-- ============================================================================
CREATE TABLE audit_scans (
    scan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference to audit
    audit_id UUID NOT NULL REFERENCES audit_records(audit_id) ON DELETE CASCADE,
    
    -- Asset/item identification
    asset_id UUID REFERENCES assets(asset_id),
    asset_tag VARCHAR(50),
    serial_number VARCHAR(100),
    barcode_scanned VARCHAR(255),
    
    -- Scan information
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scanned_by UUID NOT NULL REFERENCES users(user_id),
    
    -- Expected vs found
    expected BOOLEAN DEFAULT TRUE,
    found BOOLEAN DEFAULT TRUE,
    
    -- Location
    expected_location VARCHAR(255),
    found_location VARCHAR(255),
    bin_location VARCHAR(50),
    
    -- Condition
    expected_condition VARCHAR(30),
    found_condition VARCHAR(30),
    
    -- Quantity (for bulk items)
    expected_quantity INTEGER DEFAULT 1,
    found_quantity INTEGER DEFAULT 1,
    
    -- Discrepancy details
    is_discrepancy BOOLEAN DEFAULT FALSE,
    discrepancy_type VARCHAR(30),
    discrepancy_notes TEXT,
    
    -- Resolution
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES users(user_id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Valid condition values
    CONSTRAINT valid_as_expected_condition CHECK (expected_condition IS NULL OR expected_condition IN (
        'NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'UNKNOWN'
    )),
    CONSTRAINT valid_as_found_condition CHECK (found_condition IS NULL OR found_condition IN (
        'NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'MISSING', 'UNKNOWN'
    )),
    
    -- Valid discrepancy types
    CONSTRAINT valid_discrepancy_type CHECK (discrepancy_type IS NULL OR discrepancy_type IN (
        'MISSING',             -- Expected but not found
        'EXTRA',               -- Found but not expected
        'WRONG_LOCATION',      -- Found in wrong location
        'WRONG_CONDITION',     -- Condition different than expected
        'QUANTITY_MISMATCH',   -- Quantity different than expected
        'DATA_MISMATCH',       -- Data doesn't match records
        'DAMAGED',             -- Found damaged
        'OTHER'                -- Other discrepancy
    )),
    
    -- Quantity constraints
    CONSTRAINT valid_as_expected_qty CHECK (expected_quantity >= 0),
    CONSTRAINT valid_as_found_qty CHECK (found_quantity >= 0)
);

COMMENT ON TABLE audit_scans IS 'Individual scan records for audits (supporting table for audit_records)';
COMMENT ON COLUMN audit_scans.scan_id IS 'Unique identifier for the scan';
COMMENT ON COLUMN audit_scans.audit_id IS 'Reference to the audit record';
COMMENT ON COLUMN audit_scans.asset_id IS 'Reference to the asset (if matched)';
COMMENT ON COLUMN audit_scans.asset_tag IS 'Asset tag scanned';
COMMENT ON COLUMN audit_scans.barcode_scanned IS 'Raw barcode/QR code value scanned';
COMMENT ON COLUMN audit_scans.scanned_at IS 'Date/time of scan';
COMMENT ON COLUMN audit_scans.scanned_by IS 'User who performed the scan';
COMMENT ON COLUMN audit_scans.expected IS 'Whether the item was expected at this location';
COMMENT ON COLUMN audit_scans.found IS 'Whether the item was found';
COMMENT ON COLUMN audit_scans.is_discrepancy IS 'Whether this scan represents a discrepancy';
COMMENT ON COLUMN audit_scans.discrepancy_type IS 'Type of discrepancy if applicable';

-- Indexes for audit scans queries
CREATE INDEX idx_as_audit ON audit_scans(audit_id);
CREATE INDEX idx_as_asset ON audit_scans(asset_id) WHERE asset_id IS NOT NULL;
CREATE INDEX idx_as_asset_tag ON audit_scans(asset_tag) WHERE asset_tag IS NOT NULL;
CREATE INDEX idx_as_serial ON audit_scans(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX idx_as_scanned_by ON audit_scans(scanned_by);
CREATE INDEX idx_as_scanned_at ON audit_scans(scanned_at);
CREATE INDEX idx_as_discrepancy ON audit_scans(is_discrepancy) WHERE is_discrepancy = TRUE;

-- Composite indexes for common queries
CREATE INDEX idx_as_audit_discrepancy ON audit_scans(audit_id, is_discrepancy);
CREATE INDEX idx_as_unresolved ON audit_scans(audit_id, resolved)
    WHERE is_discrepancy = TRUE AND resolved = FALSE;

-- Apply update timestamp trigger
CREATE TRIGGER trigger_as_updated_at
    BEFORE UPDATE ON audit_scans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- AUDIT LOGGING TRIGGERS
-- Create audit log entries for significant changes
-- ============================================================================

-- Audit trigger for transfer orders
CREATE OR REPLACE FUNCTION audit_transfer_order_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(NEW.updated_by, NEW.created_by, OLD.updated_by);
    
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != NEW.status THEN
            v_action_type := 'STATUS_CHANGE';
        ELSE
            v_action_type := 'UPDATE';
        END IF;
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
        v_user_id := OLD.updated_by;
    END IF;
    
    INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
    VALUES (v_user_id, v_action_type, 'TRANSFER_ORDER', COALESCE(NEW.transfer_id, OLD.transfer_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_transfer_orders
    AFTER INSERT OR UPDATE OR DELETE ON transfer_orders
    FOR EACH ROW
    EXECUTE FUNCTION audit_transfer_order_changes();


-- Audit trigger for loaner checkouts
CREATE OR REPLACE FUNCTION audit_loaner_checkout_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(NEW.updated_by, NEW.created_by, OLD.updated_by);
    
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != NEW.status THEN
            v_action_type := 'STATUS_CHANGE';
        ELSIF NEW.return_date IS NOT NULL AND OLD.return_date IS NULL THEN
            v_action_type := 'RETURN';
        ELSE
            v_action_type := 'UPDATE';
        END IF;
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
        v_user_id := OLD.updated_by;
    END IF;
    
    INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
    VALUES (v_user_id, v_action_type, 'LOANER_CHECKOUT', COALESCE(NEW.checkout_id, OLD.checkout_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_loaner_checkouts
    AFTER INSERT OR UPDATE OR DELETE ON loaner_checkouts
    FOR EACH ROW
    EXECUTE FUNCTION audit_loaner_checkout_changes();


-- Audit trigger for audit records (meta-audit!)
CREATE OR REPLACE FUNCTION audit_audit_record_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(NEW.updated_by, NEW.created_by, OLD.updated_by);
    
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != NEW.status THEN
            v_action_type := 'STATUS_CHANGE';
        ELSE
            v_action_type := 'UPDATE';
        END IF;
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
        v_user_id := OLD.updated_by;
    END IF;
    
    INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
    VALUES (v_user_id, v_action_type, 'AUDIT_RECORD', COALESCE(NEW.audit_id, OLD.audit_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_audit_records
    AFTER INSERT OR UPDATE OR DELETE ON audit_records
    FOR EACH ROW
    EXECUTE FUNCTION audit_audit_record_changes();


-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to generate transfer order number
CREATE OR REPLACE FUNCTION generate_transfer_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    v_sequence INTEGER;
    v_number VARCHAR(50);
BEGIN
    SELECT COALESCE(MAX(
        CASE 
            WHEN transfer_number ~ '^TO-[0-9]+$'
            THEN CAST(SUBSTRING(transfer_number FROM 4) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM transfer_orders;
    
    v_number := 'TO-' || LPAD(v_sequence::TEXT, 8, '0');
    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_transfer_number IS 'Generates unique transfer order number';


-- Function to generate receiving number
CREATE OR REPLACE FUNCTION generate_receiving_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    v_sequence INTEGER;
    v_number VARCHAR(50);
BEGIN
    SELECT COALESCE(MAX(
        CASE 
            WHEN receiving_number ~ '^RCV-[0-9]+$'
            THEN CAST(SUBSTRING(receiving_number FROM 5) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM receiving_records;
    
    v_number := 'RCV-' || LPAD(v_sequence::TEXT, 8, '0');
    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_receiving_number IS 'Generates unique receiving record number';


-- Function to generate checkout number
CREATE OR REPLACE FUNCTION generate_checkout_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    v_sequence INTEGER;
    v_number VARCHAR(50);
BEGIN
    SELECT COALESCE(MAX(
        CASE 
            WHEN checkout_number ~ '^LNR-[0-9]+$'
            THEN CAST(SUBSTRING(checkout_number FROM 5) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM loaner_checkouts;
    
    v_number := 'LNR-' || LPAD(v_sequence::TEXT, 8, '0');
    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_checkout_number IS 'Generates unique loaner checkout number';


-- Function to generate audit number
CREATE OR REPLACE FUNCTION generate_audit_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    v_sequence INTEGER;
    v_number VARCHAR(50);
BEGIN
    SELECT COALESCE(MAX(
        CASE 
            WHEN audit_number ~ '^AUD-[0-9]+$'
            THEN CAST(SUBSTRING(audit_number FROM 5) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM audit_records;
    
    v_number := 'AUD-' || LPAD(v_sequence::TEXT, 8, '0');
    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_audit_number IS 'Generates unique audit record number';


-- Function to check and update overdue loaners
CREATE OR REPLACE FUNCTION update_overdue_loaners()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE loaner_checkouts
    SET is_overdue = TRUE,
        status = 'OVERDUE',
        updated_at = NOW()
    WHERE status = 'CHECKED_OUT'
      AND due_date < CURRENT_DATE
      AND is_overdue = FALSE;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_overdue_loaners IS 'Updates status of overdue loaner checkouts';


-- Function to calculate inventory reorder alerts
CREATE OR REPLACE FUNCTION get_reorder_alerts(p_stockroom_id UUID DEFAULT NULL)
RETURNS TABLE (
    stockroom_id UUID,
    stockroom_name VARCHAR(255),
    product_id UUID,
    product_type VARCHAR(30),
    product_description VARCHAR(500),
    quantity_on_hand INTEGER,
    quantity_available INTEGER,
    reorder_point INTEGER,
    reorder_quantity INTEGER,
    shortage INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        si.stockroom_id,
        s.name AS stockroom_name,
        si.product_id,
        si.product_type,
        si.product_description,
        si.quantity_on_hand,
        si.quantity_available,
        si.reorder_point,
        si.reorder_quantity,
        (si.reorder_point - si.quantity_available) AS shortage
    FROM stockroom_inventory si
    JOIN stockrooms s ON si.stockroom_id = s.stockroom_id
    WHERE si.is_active = TRUE
      AND si.reorder_point IS NOT NULL
      AND si.quantity_available <= si.reorder_point
      AND (p_stockroom_id IS NULL OR si.stockroom_id = p_stockroom_id)
    ORDER BY shortage DESC, s.name, si.product_description;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_reorder_alerts IS 'Returns inventory items below reorder point';


-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: Stockroom summary
CREATE OR REPLACE VIEW v_stockroom_summary AS
SELECT 
    s.stockroom_id,
    s.stockroom_code,
    s.name AS stockroom_name,
    s.stockroom_type,
    s.location,
    s.is_active,
    u.email AS manager_email,
    u.first_name || ' ' || u.last_name AS manager_name,
    COUNT(DISTINCT si.inventory_id) AS product_count,
    SUM(si.quantity_on_hand) AS total_quantity,
    SUM(si.quantity_available) AS available_quantity,
    SUM(si.total_value) AS total_value,
    COUNT(DISTINCT CASE WHEN si.quantity_available <= si.reorder_point THEN si.inventory_id END) AS items_below_reorder
FROM stockrooms s
LEFT JOIN users u ON s.manager_id = u.user_id
LEFT JOIN stockroom_inventory si ON s.stockroom_id = si.stockroom_id AND si.is_active = TRUE
GROUP BY s.stockroom_id, s.stockroom_code, s.name, s.stockroom_type, s.location, s.is_active,
         u.email, u.first_name, u.last_name;

COMMENT ON VIEW v_stockroom_summary IS 'Summary view of stockrooms with inventory counts';


-- View: Active transfers
CREATE OR REPLACE VIEW v_active_transfers AS
SELECT 
    t.transfer_id,
    t.transfer_number,
    t.status,
    t.priority,
    fs.name AS from_stockroom_name,
    ts.name AS to_stockroom_name,
    u_req.email AS requested_by_email,
    t.requested_date,
    u_app.email AS approved_by_email,
    t.approved_date,
    t.shipped_date,
    t.total_line_count,
    t.total_quantity,
    t.shipped_quantity,
    t.received_quantity
FROM transfer_orders t
JOIN stockrooms fs ON t.from_stockroom_id = fs.stockroom_id
JOIN stockrooms ts ON t.to_stockroom_id = ts.stockroom_id
LEFT JOIN users u_req ON t.requested_by = u_req.user_id
LEFT JOIN users u_app ON t.approved_by = u_app.user_id
WHERE t.status NOT IN ('COMPLETED', 'CANCELLED')
ORDER BY 
    CASE t.priority 
        WHEN 'CRITICAL' THEN 1 
        WHEN 'URGENT' THEN 2 
        WHEN 'HIGH' THEN 3 
        WHEN 'NORMAL' THEN 4 
        WHEN 'LOW' THEN 5 
    END,
    t.requested_date;

COMMENT ON VIEW v_active_transfers IS 'Active transfer orders with stockroom and user details';


-- View: Overdue loaners
CREATE OR REPLACE VIEW v_overdue_loaners AS
SELECT 
    lc.checkout_id,
    lc.checkout_number,
    a.asset_tag,
    a.display_name AS asset_name,
    u_to.email AS checked_out_to_email,
    u_to.first_name || ' ' || u_to.last_name AS checked_out_to_name,
    u_mgr.email AS manager_email,
    lc.checkout_date,
    lc.due_date,
    CURRENT_DATE - lc.due_date AS days_overdue,
    lc.escalation_level,
    lc.overdue_notification_count,
    lc.last_overdue_notification,
    lc.condition_out,
    lc.purpose,
    d.name AS department_name
FROM loaner_checkouts lc
JOIN assets a ON lc.asset_id = a.asset_id
JOIN users u_to ON lc.checked_out_to = u_to.user_id
LEFT JOIN users u_mgr ON u_to.manager_id = u_mgr.user_id
LEFT JOIN departments d ON lc.department_id = d.department_id
WHERE lc.status IN ('CHECKED_OUT', 'OVERDUE')
  AND lc.due_date < CURRENT_DATE
ORDER BY days_overdue DESC, lc.escalation_level DESC;

COMMENT ON VIEW v_overdue_loaners IS 'Overdue loaner checkouts with borrower and manager details';


-- View: Audit discrepancies
CREATE OR REPLACE VIEW v_audit_discrepancies AS
SELECT 
    ar.audit_id,
    ar.audit_number,
    ar.audit_type,
    s.name AS stockroom_name,
    ascan.scan_id,
    ascan.asset_tag,
    ascan.serial_number,
    ascan.discrepancy_type,
    ascan.expected,
    ascan.found,
    ascan.expected_location,
    ascan.found_location,
    ascan.expected_condition,
    ascan.found_condition,
    ascan.expected_quantity,
    ascan.found_quantity,
    ascan.discrepancy_notes,
    ascan.resolved,
    ascan.resolution_notes,
    u_scan.email AS scanned_by_email,
    ascan.scanned_at
FROM audit_scans ascan
JOIN audit_records ar ON ascan.audit_id = ar.audit_id
JOIN stockrooms s ON ar.stockroom_id = s.stockroom_id
LEFT JOIN users u_scan ON ascan.scanned_by = u_scan.user_id
WHERE ascan.is_discrepancy = TRUE
ORDER BY ar.audit_number, ascan.scanned_at;

COMMENT ON VIEW v_audit_discrepancies IS 'Audit scan discrepancies with audit and stockroom details';


-- View: Pending receiving
CREATE OR REPLACE VIEW v_pending_receiving AS
SELECT 
    rr.receiving_id,
    rr.receiving_number,
    rr.status,
    po.po_number,
    v.vendor_name,
    s.name AS stockroom_name,
    u.email AS received_by_email,
    rr.received_date,
    rr.total_quantity_expected,
    rr.total_quantity_received,
    rr.total_quantity_expected - rr.total_quantity_received AS quantity_pending,
    rr.tracking_number,
    rr.carrier
FROM receiving_records rr
LEFT JOIN purchase_orders po ON rr.po_id = po.po_id
LEFT JOIN vendors v ON rr.vendor_id = v.vendor_id
JOIN stockrooms s ON rr.stockroom_id = s.stockroom_id
LEFT JOIN users u ON rr.received_by = u.user_id
WHERE rr.status IN ('IN_PROGRESS', 'PARTIALLY_COMPLETED')
ORDER BY rr.received_date;

COMMENT ON VIEW v_pending_receiving IS 'Receiving records in progress with vendor and stockroom details';


-- ============================================================================
-- PERMISSIONS
-- Add new permissions for stockroom and inventory management
-- ============================================================================
INSERT INTO permissions (permission_name, resource_type, action, description) VALUES
    -- Stockroom permissions
    ('stockroom:create', 'STOCKROOM', 'CREATE', 'Create new stockrooms'),
    ('stockroom:read', 'STOCKROOM', 'READ', 'View stockroom details'),
    ('stockroom:update', 'STOCKROOM', 'UPDATE', 'Modify stockroom attributes'),
    ('stockroom:delete', 'STOCKROOM', 'DELETE', 'Delete stockrooms'),
    
    -- Inventory permissions
    ('inventory:read', 'INVENTORY', 'READ', 'View inventory levels'),
    ('inventory:update', 'INVENTORY', 'UPDATE', 'Modify inventory quantities'),
    ('inventory:adjust', 'INVENTORY', 'ADJUST', 'Make inventory adjustments'),
    
    -- Transfer permissions
    ('transfer:create', 'TRANSFER', 'CREATE', 'Create transfer orders'),
    ('transfer:read', 'TRANSFER', 'READ', 'View transfer orders'),
    ('transfer:approve', 'TRANSFER', 'APPROVE', 'Approve transfer orders'),
    ('transfer:ship', 'TRANSFER', 'SHIP', 'Ship transfer orders'),
    ('transfer:receive', 'TRANSFER', 'RECEIVE', 'Receive transfer orders'),
    
    -- Receiving permissions
    ('receiving:create', 'RECEIVING', 'CREATE', 'Create receiving records'),
    ('receiving:read', 'RECEIVING', 'READ', 'View receiving records'),
    ('receiving:complete', 'RECEIVING', 'COMPLETE', 'Complete receiving records'),
    
    -- Loaner permissions
    ('loaner:checkout', 'LOANER', 'CHECKOUT', 'Check out loaner assets'),
    ('loaner:read', 'LOANER', 'READ', 'View loaner checkouts'),
    ('loaner:return', 'LOANER', 'RETURN', 'Return loaner assets'),
    ('loaner:extend', 'LOANER', 'EXTEND', 'Extend loaner due dates'),
    
    -- Audit permissions
    ('audit:create', 'AUDIT', 'CREATE', 'Create inventory audits'),
    ('audit:conduct', 'AUDIT', 'CONDUCT', 'Conduct inventory audits'),
    ('audit:approve', 'AUDIT', 'APPROVE', 'Approve audit results')
ON CONFLICT (permission_name) DO NOTHING;

-- Assign stockroom/inventory permissions to INVENTORY_MANAGER role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'INVENTORY_MANAGER'
  AND p.resource_type IN ('STOCKROOM', 'INVENTORY', 'TRANSFER', 'RECEIVING', 'LOANER', 'AUDIT')
ON CONFLICT DO NOTHING;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

