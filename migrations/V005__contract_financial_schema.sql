-- ============================================================================
-- V005: Contract and Financial Schema Migration
-- Asset Management System - Contract and Financial Tables
-- 
-- This migration updates placeholder tables and creates new tables for:
-- - vendors: Full vendor/supplier information (UPDATE from V002 placeholder)
-- - contracts: Legal agreements with vendors (UPDATE from V002 placeholder)
-- - purchase_orders: Procurement documents (UPDATE from V002 placeholder)
-- - purchase_order_lines: Line items for purchase orders (NEW)
-- - cost_centers: Financial allocation units (UPDATE from V002 placeholder)
-- - depreciation_schedules: Asset depreciation tracking (NEW)
-- - lease_payments: Lease payment tracking (NEW)
--
-- Requirements: 2D.1-2D.9
-- ============================================================================

-- ============================================================================
-- VENDORS TABLE - UPDATE PLACEHOLDER
-- Full vendor/supplier information
-- Requirement: 2D.4 (vendor_id, vendor_name, vendor_type, contact_name, 
--              contact_email, contact_phone, address, payment_terms)
-- ============================================================================

-- Add new columns to vendors table
ALTER TABLE vendors
    ADD COLUMN IF NOT EXISTS vendor_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS duns_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS website VARCHAR(500),
    ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255),
    ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255),
    ADD COLUMN IF NOT EXISTS city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS state_province VARCHAR(100),
    ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'USA',
    ADD COLUMN IF NOT EXISTS billing_address TEXT,
    ADD COLUMN IF NOT EXISTS secondary_contact_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS secondary_contact_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS secondary_contact_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(3) DEFAULT 'USD',
    ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(14, 2),
    ADD COLUMN IF NOT EXISTS rating VARCHAR(20),
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add constraint for vendor type if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_vendor_type'
    ) THEN
        ALTER TABLE vendors
            ADD CONSTRAINT valid_vendor_type CHECK (vendor_type IS NULL OR vendor_type IN (
                'MANUFACTURER',        -- Original equipment manufacturer
                'RESELLER',            -- Value-added reseller
                'DISTRIBUTOR',         -- Product distributor
                'SERVICE_PROVIDER',    -- Service/support provider
                'CONSULTANT',          -- Consulting services
                'CONTRACTOR',          -- Contract services
                'LESSOR',              -- Leasing company
                'OTHER'                -- Other vendor type
            ));
    END IF;
END $$;

-- Add constraint for vendor rating
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_vendor_rating'
    ) THEN
        ALTER TABLE vendors
            ADD CONSTRAINT valid_vendor_rating CHECK (rating IS NULL OR rating IN (
                'PREFERRED',           -- Preferred vendor
                'APPROVED',            -- Approved vendor
                'CONDITIONAL',         -- Conditionally approved
                'PROBATION',           -- On probation
                'SUSPENDED',           -- Temporarily suspended
                'BLACKLISTED'          -- Not allowed
            ));
    END IF;
END $$;

-- Create unique constraint on vendor_code if not exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_code ON vendors(vendor_code) WHERE vendor_code IS NOT NULL;

-- Add indexes for vendor queries
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(vendor_name);
CREATE INDEX IF NOT EXISTS idx_vendors_type ON vendors(vendor_type);
CREATE INDEX IF NOT EXISTS idx_vendors_active ON vendors(is_active);
CREATE INDEX IF NOT EXISTS idx_vendors_rating ON vendors(rating);
CREATE INDEX IF NOT EXISTS idx_vendors_city ON vendors(city);
CREATE INDEX IF NOT EXISTS idx_vendors_country ON vendors(country);

-- Update comments
COMMENT ON TABLE vendors IS 'Vendor/supplier information (Requirement 2D.4)';
COMMENT ON COLUMN vendors.vendor_id IS 'Unique identifier for the vendor';
COMMENT ON COLUMN vendors.vendor_code IS 'Short code for the vendor (e.g., DELL, CDW)';
COMMENT ON COLUMN vendors.vendor_name IS 'Full legal name of the vendor';
COMMENT ON COLUMN vendors.vendor_type IS 'Type of vendor (MANUFACTURER, RESELLER, etc.)';
COMMENT ON COLUMN vendors.contact_name IS 'Primary contact name';
COMMENT ON COLUMN vendors.contact_email IS 'Primary contact email';
COMMENT ON COLUMN vendors.contact_phone IS 'Primary contact phone';
COMMENT ON COLUMN vendors.address IS 'Legacy address field (use address_line1/2 for new records)';
COMMENT ON COLUMN vendors.payment_terms IS 'Payment terms (e.g., NET30, NET60)';
COMMENT ON COLUMN vendors.tax_id IS 'Tax identification number';
COMMENT ON COLUMN vendors.duns_number IS 'D-U-N-S number for business identification';
COMMENT ON COLUMN vendors.credit_limit IS 'Credit limit for this vendor';
COMMENT ON COLUMN vendors.rating IS 'Vendor rating/status';

-- Apply update timestamp trigger to vendors
DROP TRIGGER IF EXISTS trigger_vendors_updated_at ON vendors;
CREATE TRIGGER trigger_vendors_updated_at
    BEFORE UPDATE ON vendors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- CONTRACTS TABLE - UPDATE PLACEHOLDER
-- Legal agreements with vendors
-- Requirements: 2D.1, 2D.2, 2D.3 (contract details, terms, contract types)
-- ============================================================================

-- Add new columns to contracts table
ALTER TABLE contracts
    ADD COLUMN IF NOT EXISTS contract_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100),
    ADD COLUMN IF NOT EXISTS renewal_type VARCHAR(30),
    ADD COLUMN IF NOT EXISTS auto_renewal BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS cancellation_notice_days INTEGER,
    ADD COLUMN IF NOT EXISTS sla_terms TEXT,
    ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD',
    ADD COLUMN IF NOT EXISTS annual_value DECIMAL(14, 2),
    ADD COLUMN IF NOT EXISTS remaining_value DECIMAL(14, 2),
    ADD COLUMN IF NOT EXISTS document_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS document_storage_id UUID,
    ADD COLUMN IF NOT EXISTS signed_date DATE,
    ADD COLUMN IF NOT EXISTS effective_date DATE,
    ADD COLUMN IF NOT EXISTS termination_date DATE,
    ADD COLUMN IF NOT EXISTS termination_reason TEXT,
    ADD COLUMN IF NOT EXISTS renewal_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS previous_contract_id UUID,
    ADD COLUMN IF NOT EXISTS parent_contract_id UUID,
    ADD COLUMN IF NOT EXISTS owner_id UUID,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS created_by UUID,
    ADD COLUMN IF NOT EXISTS updated_by UUID;

-- Add foreign key constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'contracts_previous_contract_fk'
    ) THEN
        ALTER TABLE contracts
            ADD CONSTRAINT contracts_previous_contract_fk 
            FOREIGN KEY (previous_contract_id) REFERENCES contracts(contract_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'contracts_parent_contract_fk'
    ) THEN
        ALTER TABLE contracts
            ADD CONSTRAINT contracts_parent_contract_fk 
            FOREIGN KEY (parent_contract_id) REFERENCES contracts(contract_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'contracts_owner_fk'
    ) THEN
        ALTER TABLE contracts
            ADD CONSTRAINT contracts_owner_fk 
            FOREIGN KEY (owner_id) REFERENCES users(user_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'contracts_created_by_fk'
    ) THEN
        ALTER TABLE contracts
            ADD CONSTRAINT contracts_created_by_fk 
            FOREIGN KEY (created_by) REFERENCES users(user_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'contracts_updated_by_fk'
    ) THEN
        ALTER TABLE contracts
            ADD CONSTRAINT contracts_updated_by_fk 
            FOREIGN KEY (updated_by) REFERENCES users(user_id);
    END IF;
END $$;

-- Update contract_type constraint to support all required types
-- Requirement 2D.3: Support contract types: Purchase, Lease, Maintenance, Support, License, Warranty
DO $$
BEGIN
    -- Drop existing constraint if it exists
    ALTER TABLE contracts DROP CONSTRAINT IF EXISTS valid_contract_type;
    
    -- Add new constraint with all required types
    ALTER TABLE contracts
        ADD CONSTRAINT valid_contract_type CHECK (contract_type IS NULL OR contract_type IN (
            'PURCHASE',            -- Purchase agreement
            'LEASE',               -- Equipment lease
            'MAINTENANCE',         -- Maintenance agreement
            'SUPPORT',             -- Support contract
            'LICENSE',             -- Software license agreement
            'WARRANTY',            -- Warranty agreement
            'SERVICE',             -- Service agreement
            'SUBSCRIPTION',        -- Subscription agreement
            'MASTER',              -- Master agreement
            'NDA',                 -- Non-disclosure agreement
            'OTHER'                -- Other contract type
        ));
END $$;

-- Add constraint for contract status
DO $$
BEGIN
    ALTER TABLE contracts DROP CONSTRAINT IF EXISTS valid_contract_status;
    
    ALTER TABLE contracts
        ADD CONSTRAINT valid_contract_status CHECK (status IS NULL OR status IN (
            'DRAFT',               -- Being drafted
            'PENDING_APPROVAL',    -- Awaiting approval
            'PENDING_SIGNATURE',   -- Awaiting signature
            'ACTIVE',              -- Currently active
            'EXPIRED',             -- Past end date
            'TERMINATED',          -- Terminated early
            'RENEWED',             -- Renewed (superseded)
            'CANCELLED',           -- Cancelled before activation
            'ON_HOLD'              -- Temporarily on hold
        ));
END $$;

-- Add constraint for renewal type
-- Requirement 2D.2: renewal_type
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_renewal_type'
    ) THEN
        ALTER TABLE contracts
            ADD CONSTRAINT valid_renewal_type CHECK (renewal_type IS NULL OR renewal_type IN (
                'NONE',                -- No renewal
                'MANUAL',              -- Manual renewal required
                'AUTO_RENEW',          -- Automatic renewal
                'EVERGREEN',           -- Continuous until cancelled
                'NEGOTIATED'           -- Renewal terms to be negotiated
            ));
    END IF;
END $$;

-- Add constraint for cancellation notice days
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_cancellation_notice'
    ) THEN
        ALTER TABLE contracts
            ADD CONSTRAINT valid_cancellation_notice CHECK (
                cancellation_notice_days IS NULL OR cancellation_notice_days >= 0
            );
    END IF;
END $$;

-- Add indexes for contract queries
CREATE INDEX IF NOT EXISTS idx_contracts_vendor ON contracts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_contracts_type ON contracts(contract_type);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_start_date ON contracts(start_date);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date);
CREATE INDEX IF NOT EXISTS idx_contracts_owner ON contracts(owner_id);
CREATE INDEX IF NOT EXISTS idx_contracts_parent ON contracts(parent_contract_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_contracts_active_end ON contracts(status, end_date) 
    WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_contracts_vendor_type ON contracts(vendor_id, contract_type);

-- Update comments
COMMENT ON TABLE contracts IS 'Legal agreements with vendors (Requirements 2D.1, 2D.2, 2D.3)';
COMMENT ON COLUMN contracts.contract_id IS 'Unique identifier for the contract';
COMMENT ON COLUMN contracts.contract_number IS 'Human-readable contract number';
COMMENT ON COLUMN contracts.contract_name IS 'Descriptive name for the contract';
COMMENT ON COLUMN contracts.vendor_id IS 'Reference to the vendor';
COMMENT ON COLUMN contracts.contract_type IS 'Type of contract (Purchase, Lease, Maintenance, Support, License, Warranty)';
COMMENT ON COLUMN contracts.start_date IS 'Contract start date';
COMMENT ON COLUMN contracts.end_date IS 'Contract end date';
COMMENT ON COLUMN contracts.total_value IS 'Total contract value';
COMMENT ON COLUMN contracts.status IS 'Current contract status';
COMMENT ON COLUMN contracts.payment_terms IS 'Payment terms (e.g., NET30, Monthly)';
COMMENT ON COLUMN contracts.renewal_type IS 'How the contract renews (NONE, MANUAL, AUTO_RENEW, EVERGREEN)';
COMMENT ON COLUMN contracts.auto_renewal IS 'Whether contract auto-renews';
COMMENT ON COLUMN contracts.cancellation_notice_days IS 'Days notice required for cancellation';
COMMENT ON COLUMN contracts.sla_terms IS 'Service level agreement terms';
COMMENT ON COLUMN contracts.previous_contract_id IS 'Reference to previous contract (for renewals)';
COMMENT ON COLUMN contracts.parent_contract_id IS 'Reference to parent/master contract';

-- Apply update timestamp trigger to contracts
DROP TRIGGER IF EXISTS trigger_contracts_updated_at ON contracts;
CREATE TRIGGER trigger_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- PURCHASE_ORDERS TABLE - UPDATE PLACEHOLDER
-- Procurement documents
-- Requirement: 2D.5 (po_id, po_number, vendor_id, requester_id, approver_id,
--              status, order_date, expected_delivery_date, total_amount)
-- ============================================================================

-- Add new columns to purchase_orders table
ALTER TABLE purchase_orders
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD',
    ADD COLUMN IF NOT EXISTS subtotal_amount DECIMAL(14, 2),
    ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(14, 2),
    ADD COLUMN IF NOT EXISTS shipping_amount DECIMAL(14, 2),
    ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(14, 2),
    ADD COLUMN IF NOT EXISTS contract_id UUID,
    ADD COLUMN IF NOT EXISTS cost_center_id UUID,
    ADD COLUMN IF NOT EXISTS department_id UUID,
    ADD COLUMN IF NOT EXISTS ship_to_address TEXT,
    ADD COLUMN IF NOT EXISTS ship_to_attention VARCHAR(255),
    ADD COLUMN IF NOT EXISTS bill_to_address TEXT,
    ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100),
    ADD COLUMN IF NOT EXISTS shipping_method VARCHAR(100),
    ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(255),
    ADD COLUMN IF NOT EXISTS actual_delivery_date DATE,
    ADD COLUMN IF NOT EXISTS submitted_date TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS approved_date TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS cancelled_date TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS created_by UUID,
    ADD COLUMN IF NOT EXISTS updated_by UUID;

-- Add foreign key constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'po_contract_fk'
    ) THEN
        ALTER TABLE purchase_orders
            ADD CONSTRAINT po_contract_fk 
            FOREIGN KEY (contract_id) REFERENCES contracts(contract_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'po_cost_center_fk'
    ) THEN
        ALTER TABLE purchase_orders
            ADD CONSTRAINT po_cost_center_fk 
            FOREIGN KEY (cost_center_id) REFERENCES cost_centers(cost_center_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'po_department_fk'
    ) THEN
        ALTER TABLE purchase_orders
            ADD CONSTRAINT po_department_fk 
            FOREIGN KEY (department_id) REFERENCES departments(department_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'po_created_by_fk'
    ) THEN
        ALTER TABLE purchase_orders
            ADD CONSTRAINT po_created_by_fk 
            FOREIGN KEY (created_by) REFERENCES users(user_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'po_updated_by_fk'
    ) THEN
        ALTER TABLE purchase_orders
            ADD CONSTRAINT po_updated_by_fk 
            FOREIGN KEY (updated_by) REFERENCES users(user_id);
    END IF;
END $$;

-- Update status constraint
DO $$
BEGIN
    ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS valid_po_status;
    
    ALTER TABLE purchase_orders
        ADD CONSTRAINT valid_po_status CHECK (status IS NULL OR status IN (
            'DRAFT',               -- Being created
            'PENDING_APPROVAL',    -- Awaiting approval
            'APPROVED',            -- Approved, ready to send
            'SENT',                -- Sent to vendor
            'ACKNOWLEDGED',        -- Vendor acknowledged receipt
            'PARTIALLY_RECEIVED',  -- Some items received
            'RECEIVED',            -- All items received
            'INVOICED',            -- Invoice received
            'PAID',                -- Payment completed
            'CANCELLED',           -- Order cancelled
            'ON_HOLD'              -- Temporarily on hold
        ));
END $$;

-- Add amount constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_po_amounts'
    ) THEN
        ALTER TABLE purchase_orders
            ADD CONSTRAINT valid_po_amounts CHECK (
                (total_amount IS NULL OR total_amount >= 0) AND
                (subtotal_amount IS NULL OR subtotal_amount >= 0) AND
                (tax_amount IS NULL OR tax_amount >= 0) AND
                (shipping_amount IS NULL OR shipping_amount >= 0) AND
                (discount_amount IS NULL OR discount_amount >= 0)
            );
    END IF;
END $$;

-- Add indexes for purchase order queries
CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_po_requester ON purchase_orders(requester_id);
CREATE INDEX IF NOT EXISTS idx_po_approver ON purchase_orders(approver_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_order_date ON purchase_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_po_expected_delivery ON purchase_orders(expected_delivery_date);
CREATE INDEX IF NOT EXISTS idx_po_contract ON purchase_orders(contract_id);
CREATE INDEX IF NOT EXISTS idx_po_cost_center ON purchase_orders(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_po_department ON purchase_orders(department_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_po_vendor_status ON purchase_orders(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_po_pending ON purchase_orders(status, submitted_date) 
    WHERE status = 'PENDING_APPROVAL';

-- Update comments
COMMENT ON TABLE purchase_orders IS 'Procurement documents (Requirement 2D.5)';
COMMENT ON COLUMN purchase_orders.po_id IS 'Unique identifier for the purchase order';
COMMENT ON COLUMN purchase_orders.po_number IS 'Human-readable PO number';
COMMENT ON COLUMN purchase_orders.vendor_id IS 'Reference to the vendor';
COMMENT ON COLUMN purchase_orders.requester_id IS 'User who requested the purchase';
COMMENT ON COLUMN purchase_orders.approver_id IS 'User who approved the purchase';
COMMENT ON COLUMN purchase_orders.status IS 'Current PO status';
COMMENT ON COLUMN purchase_orders.order_date IS 'Date the order was placed';
COMMENT ON COLUMN purchase_orders.expected_delivery_date IS 'Expected delivery date';
COMMENT ON COLUMN purchase_orders.total_amount IS 'Total order amount';
COMMENT ON COLUMN purchase_orders.contract_id IS 'Reference to associated contract';
COMMENT ON COLUMN purchase_orders.cost_center_id IS 'Cost center for this purchase';

-- Apply update timestamp trigger to purchase_orders
DROP TRIGGER IF EXISTS trigger_po_updated_at ON purchase_orders;
CREATE TRIGGER trigger_po_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();



-- ============================================================================
-- PURCHASE_ORDER_LINES TABLE - NEW
-- Line items for purchase orders
-- Requirement: 2D.6 (line_id, po_id, product_id, quantity, unit_price, 
--              total_price, received_quantity, asset_ids_created)
-- ============================================================================
CREATE TABLE purchase_order_lines (
    line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    
    -- Requirement 2D.6: Line item attributes
    product_id UUID,
    product_type VARCHAR(30),
    product_description VARCHAR(500) NOT NULL,
    product_sku VARCHAR(100),
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    
    -- Quantities and pricing
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    total_price DECIMAL(14, 2) NOT NULL,
    discount_percent DECIMAL(5, 2),
    discount_amount DECIMAL(12, 2),
    tax_rate DECIMAL(5, 2),
    tax_amount DECIMAL(12, 2),
    
    -- Receiving tracking
    received_quantity INTEGER DEFAULT 0,
    pending_quantity INTEGER,
    cancelled_quantity INTEGER DEFAULT 0,
    
    -- Asset creation tracking
    asset_ids_created UUID[],
    assets_created_count INTEGER DEFAULT 0,
    
    -- Delivery tracking
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    
    -- Status
    status VARCHAR(30) DEFAULT 'PENDING',
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique line number per PO
    CONSTRAINT unique_po_line UNIQUE (po_id, line_number),
    
    -- Valid product types
    CONSTRAINT valid_product_type CHECK (product_type IS NULL OR product_type IN (
        'HARDWARE',            -- Hardware asset
        'SOFTWARE',            -- Software license
        'SERVICE',             -- Service item
        'CONSUMABLE',          -- Consumable item
        'SPARE_PART',          -- Spare part
        'OTHER'                -- Other item type
    )),
    
    -- Valid line status
    CONSTRAINT valid_line_status CHECK (status IN (
        'PENDING',             -- Not yet received
        'PARTIALLY_RECEIVED',  -- Some items received
        'RECEIVED',            -- All items received
        'CANCELLED',           -- Line cancelled
        'BACKORDERED'          -- On backorder
    )),
    
    -- Quantity constraints
    CONSTRAINT valid_quantity CHECK (quantity > 0),
    CONSTRAINT valid_received_quantity CHECK (received_quantity >= 0),
    CONSTRAINT valid_cancelled_quantity CHECK (cancelled_quantity >= 0),
    CONSTRAINT received_lte_quantity CHECK (received_quantity <= quantity),
    
    -- Price constraints
    CONSTRAINT valid_unit_price CHECK (unit_price >= 0),
    CONSTRAINT valid_total_price CHECK (total_price >= 0),
    CONSTRAINT valid_discount_percent CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)),
    CONSTRAINT valid_tax_rate CHECK (tax_rate IS NULL OR (tax_rate >= 0 AND tax_rate <= 100))
);

COMMENT ON TABLE purchase_order_lines IS 'Line items for purchase orders (Requirement 2D.6)';
COMMENT ON COLUMN purchase_order_lines.line_id IS 'Unique identifier for the line item';
COMMENT ON COLUMN purchase_order_lines.po_id IS 'Reference to the purchase order';
COMMENT ON COLUMN purchase_order_lines.line_number IS 'Line number within the PO';
COMMENT ON COLUMN purchase_order_lines.product_id IS 'Reference to product (software_product, model, etc.)';
COMMENT ON COLUMN purchase_order_lines.product_type IS 'Type of product being ordered';
COMMENT ON COLUMN purchase_order_lines.product_description IS 'Description of the item';
COMMENT ON COLUMN purchase_order_lines.quantity IS 'Quantity ordered';
COMMENT ON COLUMN purchase_order_lines.unit_price IS 'Price per unit';
COMMENT ON COLUMN purchase_order_lines.total_price IS 'Total price for this line';
COMMENT ON COLUMN purchase_order_lines.received_quantity IS 'Quantity received so far';
COMMENT ON COLUMN purchase_order_lines.asset_ids_created IS 'Array of asset IDs created from this line';
COMMENT ON COLUMN purchase_order_lines.assets_created_count IS 'Count of assets created from this line';

-- Indexes for purchase order line queries
CREATE INDEX idx_pol_po ON purchase_order_lines(po_id);
CREATE INDEX idx_pol_product ON purchase_order_lines(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_pol_product_type ON purchase_order_lines(product_type);
CREATE INDEX idx_pol_status ON purchase_order_lines(status);
CREATE INDEX idx_pol_expected_delivery ON purchase_order_lines(expected_delivery_date);

-- Composite index for receiving queries
CREATE INDEX idx_pol_pending ON purchase_order_lines(po_id, status) 
    WHERE status IN ('PENDING', 'PARTIALLY_RECEIVED', 'BACKORDERED');

-- Apply update timestamp trigger
CREATE TRIGGER trigger_pol_updated_at
    BEFORE UPDATE ON purchase_order_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- COST_CENTERS TABLE - UPDATE PLACEHOLDER
-- Financial allocation units for asset expenses
-- Requirement: 2D.7 (cost_center_id, code, name, department_id, budget_amount,
--              spent_amount, fiscal_year)
-- ============================================================================

-- Add new columns to cost_centers table
ALTER TABLE cost_centers
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS parent_cost_center_id UUID,
    ADD COLUMN IF NOT EXISTS manager_id UUID,
    ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD',
    ADD COLUMN IF NOT EXISTS budget_start_date DATE,
    ADD COLUMN IF NOT EXISTS budget_end_date DATE,
    ADD COLUMN IF NOT EXISTS committed_amount DECIMAL(14, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS available_amount DECIMAL(14, 2),
    ADD COLUMN IF NOT EXISTS allocation_method VARCHAR(30),
    ADD COLUMN IF NOT EXISTS gl_account VARCHAR(50),
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS created_by UUID,
    ADD COLUMN IF NOT EXISTS updated_by UUID;

-- Add foreign key constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cc_parent_fk'
    ) THEN
        ALTER TABLE cost_centers
            ADD CONSTRAINT cc_parent_fk 
            FOREIGN KEY (parent_cost_center_id) REFERENCES cost_centers(cost_center_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cc_manager_fk'
    ) THEN
        ALTER TABLE cost_centers
            ADD CONSTRAINT cc_manager_fk 
            FOREIGN KEY (manager_id) REFERENCES users(user_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cc_created_by_fk'
    ) THEN
        ALTER TABLE cost_centers
            ADD CONSTRAINT cc_created_by_fk 
            FOREIGN KEY (created_by) REFERENCES users(user_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'cc_updated_by_fk'
    ) THEN
        ALTER TABLE cost_centers
            ADD CONSTRAINT cc_updated_by_fk 
            FOREIGN KEY (updated_by) REFERENCES users(user_id);
    END IF;
END $$;

-- Add constraint for allocation method
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_allocation_method'
    ) THEN
        ALTER TABLE cost_centers
            ADD CONSTRAINT valid_allocation_method CHECK (allocation_method IS NULL OR allocation_method IN (
                'DIRECT',              -- Direct allocation
                'PERCENTAGE',          -- Percentage-based allocation
                'HEADCOUNT',           -- Based on headcount
                'SQUARE_FOOTAGE',      -- Based on space
                'USAGE',               -- Based on usage
                'FIXED'                -- Fixed allocation
            ));
    END IF;
END $$;

-- Add amount constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_cc_amounts'
    ) THEN
        ALTER TABLE cost_centers
            ADD CONSTRAINT valid_cc_amounts CHECK (
                (budget_amount IS NULL OR budget_amount >= 0) AND
                (spent_amount IS NULL OR spent_amount >= 0) AND
                (committed_amount IS NULL OR committed_amount >= 0) AND
                (available_amount IS NULL OR available_amount >= 0)
            );
    END IF;
END $$;

-- Add indexes for cost center queries
CREATE INDEX IF NOT EXISTS idx_cc_department ON cost_centers(department_id);
CREATE INDEX IF NOT EXISTS idx_cc_parent ON cost_centers(parent_cost_center_id);
CREATE INDEX IF NOT EXISTS idx_cc_manager ON cost_centers(manager_id);
CREATE INDEX IF NOT EXISTS idx_cc_fiscal_year ON cost_centers(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_cc_active ON cost_centers(is_active);
CREATE INDEX IF NOT EXISTS idx_cc_gl_account ON cost_centers(gl_account);

-- Composite index for budget queries
CREATE INDEX IF NOT EXISTS idx_cc_active_year ON cost_centers(is_active, fiscal_year);

-- Update comments
COMMENT ON TABLE cost_centers IS 'Financial allocation units for asset expenses (Requirement 2D.7)';
COMMENT ON COLUMN cost_centers.cost_center_id IS 'Unique identifier for the cost center';
COMMENT ON COLUMN cost_centers.code IS 'Short code for the cost center';
COMMENT ON COLUMN cost_centers.name IS 'Full name of the cost center';
COMMENT ON COLUMN cost_centers.department_id IS 'Reference to associated department';
COMMENT ON COLUMN cost_centers.budget_amount IS 'Total budget amount';
COMMENT ON COLUMN cost_centers.spent_amount IS 'Amount spent to date';
COMMENT ON COLUMN cost_centers.fiscal_year IS 'Fiscal year for this budget';
COMMENT ON COLUMN cost_centers.committed_amount IS 'Amount committed but not yet spent';
COMMENT ON COLUMN cost_centers.available_amount IS 'Remaining available budget';
COMMENT ON COLUMN cost_centers.parent_cost_center_id IS 'Parent cost center for hierarchical budgets';
COMMENT ON COLUMN cost_centers.gl_account IS 'General ledger account code';

-- Apply update timestamp trigger to cost_centers
DROP TRIGGER IF EXISTS trigger_cc_updated_at ON cost_centers;
CREATE TRIGGER trigger_cc_updated_at
    BEFORE UPDATE ON cost_centers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- DEPRECIATION_SCHEDULES TABLE - NEW
-- Asset depreciation tracking
-- Requirement: 2D.8 (asset_id, period_start, period_end, beginning_value,
--              depreciation_amount, ending_value, accumulated_depreciation)
-- ============================================================================
CREATE TABLE depreciation_schedules (
    schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    
    -- Requirement 2D.8: Depreciation schedule attributes
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    beginning_value DECIMAL(14, 2) NOT NULL,
    depreciation_amount DECIMAL(14, 2) NOT NULL,
    ending_value DECIMAL(14, 2) NOT NULL,
    accumulated_depreciation DECIMAL(14, 2) NOT NULL,
    
    -- Additional depreciation details
    depreciation_method VARCHAR(30) NOT NULL,
    useful_life_months INTEGER,
    salvage_value DECIMAL(14, 2),
    period_number INTEGER NOT NULL,
    total_periods INTEGER,
    
    -- Fiscal tracking
    fiscal_year INTEGER NOT NULL,
    fiscal_period VARCHAR(20),
    
    -- Status
    status VARCHAR(20) DEFAULT 'SCHEDULED',
    posted_date DATE,
    posted_by UUID REFERENCES users(user_id),
    
    -- GL integration
    gl_account_debit VARCHAR(50),
    gl_account_credit VARCHAR(50),
    journal_entry_id VARCHAR(100),
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    
    -- Ensure unique period per asset
    CONSTRAINT unique_asset_period UNIQUE (asset_id, period_start, period_end),
    
    -- Valid depreciation methods
    CONSTRAINT valid_dep_method CHECK (depreciation_method IN (
        'STRAIGHT_LINE',       -- Equal depreciation each period
        'DECLINING_BALANCE',   -- Accelerated depreciation
        'DOUBLE_DECLINING',    -- Double declining balance
        'SUM_OF_YEARS',        -- Sum of years digits
        'UNITS_OF_PRODUCTION', -- Based on usage
        'MACRS',               -- Modified Accelerated Cost Recovery System
        'NONE'                 -- No depreciation
    )),
    
    -- Valid status
    CONSTRAINT valid_dep_status CHECK (status IN (
        'SCHEDULED',           -- Scheduled for future
        'PENDING',             -- Ready to post
        'POSTED',              -- Posted to GL
        'REVERSED',            -- Reversed/corrected
        'SKIPPED'              -- Skipped (e.g., asset disposed)
    )),
    
    -- Value constraints
    CONSTRAINT valid_beginning_value CHECK (beginning_value >= 0),
    CONSTRAINT valid_depreciation_amount CHECK (depreciation_amount >= 0),
    CONSTRAINT valid_ending_value CHECK (ending_value >= 0),
    CONSTRAINT valid_accumulated_depreciation CHECK (accumulated_depreciation >= 0),
    CONSTRAINT valid_salvage_value CHECK (salvage_value IS NULL OR salvage_value >= 0),
    
    -- Period constraints
    CONSTRAINT valid_period_dates CHECK (period_end >= period_start),
    CONSTRAINT valid_period_number CHECK (period_number > 0),
    CONSTRAINT valid_total_periods CHECK (total_periods IS NULL OR total_periods > 0),
    
    -- Value consistency
    CONSTRAINT valid_value_calculation CHECK (
        ABS(beginning_value - depreciation_amount - ending_value) < 0.01
    )
);

COMMENT ON TABLE depreciation_schedules IS 'Asset depreciation tracking (Requirement 2D.8)';
COMMENT ON COLUMN depreciation_schedules.schedule_id IS 'Unique identifier for the schedule entry';
COMMENT ON COLUMN depreciation_schedules.asset_id IS 'Reference to the asset being depreciated';
COMMENT ON COLUMN depreciation_schedules.period_start IS 'Start date of the depreciation period';
COMMENT ON COLUMN depreciation_schedules.period_end IS 'End date of the depreciation period';
COMMENT ON COLUMN depreciation_schedules.beginning_value IS 'Asset value at start of period';
COMMENT ON COLUMN depreciation_schedules.depreciation_amount IS 'Depreciation amount for this period';
COMMENT ON COLUMN depreciation_schedules.ending_value IS 'Asset value at end of period';
COMMENT ON COLUMN depreciation_schedules.accumulated_depreciation IS 'Total accumulated depreciation';
COMMENT ON COLUMN depreciation_schedules.depreciation_method IS 'Method used for depreciation calculation';
COMMENT ON COLUMN depreciation_schedules.period_number IS 'Period number in the depreciation schedule';
COMMENT ON COLUMN depreciation_schedules.fiscal_year IS 'Fiscal year for this depreciation';
COMMENT ON COLUMN depreciation_schedules.status IS 'Status of this depreciation entry';
COMMENT ON COLUMN depreciation_schedules.journal_entry_id IS 'Reference to GL journal entry';

-- Indexes for depreciation schedule queries
CREATE INDEX idx_dep_asset ON depreciation_schedules(asset_id);
CREATE INDEX idx_dep_period_start ON depreciation_schedules(period_start);
CREATE INDEX idx_dep_period_end ON depreciation_schedules(period_end);
CREATE INDEX idx_dep_fiscal_year ON depreciation_schedules(fiscal_year);
CREATE INDEX idx_dep_status ON depreciation_schedules(status);
CREATE INDEX idx_dep_method ON depreciation_schedules(depreciation_method);

-- Composite indexes for common queries
CREATE INDEX idx_dep_asset_period ON depreciation_schedules(asset_id, period_start DESC);
CREATE INDEX idx_dep_pending ON depreciation_schedules(status, period_end) 
    WHERE status IN ('SCHEDULED', 'PENDING');
CREATE INDEX idx_dep_fiscal ON depreciation_schedules(fiscal_year, fiscal_period);

-- Apply update timestamp trigger
CREATE TRIGGER trigger_dep_updated_at
    BEFORE UPDATE ON depreciation_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- LEASE_PAYMENTS TABLE - NEW
-- Lease payment tracking
-- Requirement: 2D.9 (payment_id, contract_id, due_date, amount, status,
--              paid_date, payment_reference)
-- ============================================================================
CREATE TABLE lease_payments (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
    
    -- Requirement 2D.9: Lease payment attributes
    due_date DATE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(30) DEFAULT 'SCHEDULED',
    paid_date DATE,
    payment_reference VARCHAR(255),
    
    -- Additional payment details
    payment_number INTEGER NOT NULL,
    payment_type VARCHAR(30) DEFAULT 'REGULAR',
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Amount breakdown
    principal_amount DECIMAL(12, 2),
    interest_amount DECIMAL(12, 2),
    tax_amount DECIMAL(12, 2),
    fees_amount DECIMAL(12, 2),
    
    -- Payment processing
    payment_method VARCHAR(30),
    bank_account VARCHAR(100),
    check_number VARCHAR(50),
    transaction_id VARCHAR(255),
    
    -- Invoice tracking
    invoice_number VARCHAR(100),
    invoice_date DATE,
    invoice_received_date DATE,
    
    -- Approval workflow
    approved_by UUID REFERENCES users(user_id),
    approved_date TIMESTAMP WITH TIME ZONE,
    
    -- Late payment tracking
    is_late BOOLEAN DEFAULT FALSE,
    days_late INTEGER DEFAULT 0,
    late_fee_amount DECIMAL(10, 2),
    late_fee_paid BOOLEAN DEFAULT FALSE,
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id),
    
    -- Ensure unique payment number per contract
    CONSTRAINT unique_contract_payment UNIQUE (contract_id, payment_number),
    
    -- Valid payment status
    CONSTRAINT valid_payment_status CHECK (status IN (
        'SCHEDULED',           -- Future payment
        'DUE',                 -- Payment is due
        'PENDING',             -- Payment initiated
        'PROCESSING',          -- Being processed
        'PAID',                -- Payment completed
        'PARTIAL',             -- Partially paid
        'OVERDUE',             -- Past due date
        'CANCELLED',           -- Payment cancelled
        'REFUNDED',            -- Payment refunded
        'DISPUTED'             -- Payment disputed
    )),
    
    -- Valid payment types
    CONSTRAINT valid_payment_type CHECK (payment_type IN (
        'REGULAR',             -- Regular scheduled payment
        'ADVANCE',             -- Advance payment
        'FINAL',               -- Final payment
        'BUYOUT',              -- Lease buyout
        'SECURITY_DEPOSIT',    -- Security deposit
        'ADJUSTMENT',          -- Adjustment payment
        'PENALTY',             -- Penalty payment
        'OTHER'                -- Other payment type
    )),
    
    -- Valid payment methods
    CONSTRAINT valid_payment_method CHECK (payment_method IS NULL OR payment_method IN (
        'ACH',                 -- ACH transfer
        'WIRE',                -- Wire transfer
        'CHECK',               -- Check payment
        'CREDIT_CARD',         -- Credit card
        'VIRTUAL_CARD',        -- Virtual card
        'CASH',                -- Cash payment
        'OTHER'                -- Other method
    )),
    
    -- Amount constraints
    CONSTRAINT valid_payment_amount CHECK (amount > 0),
    CONSTRAINT valid_principal CHECK (principal_amount IS NULL OR principal_amount >= 0),
    CONSTRAINT valid_interest CHECK (interest_amount IS NULL OR interest_amount >= 0),
    CONSTRAINT valid_payment_tax CHECK (tax_amount IS NULL OR tax_amount >= 0),
    CONSTRAINT valid_fees CHECK (fees_amount IS NULL OR fees_amount >= 0),
    CONSTRAINT valid_late_fee CHECK (late_fee_amount IS NULL OR late_fee_amount >= 0),
    
    -- Payment number constraint
    CONSTRAINT valid_payment_number CHECK (payment_number > 0),
    
    -- Days late constraint
    CONSTRAINT valid_days_late CHECK (days_late >= 0)
);

COMMENT ON TABLE lease_payments IS 'Lease payment tracking (Requirement 2D.9)';
COMMENT ON COLUMN lease_payments.payment_id IS 'Unique identifier for the payment';
COMMENT ON COLUMN lease_payments.contract_id IS 'Reference to the lease contract';
COMMENT ON COLUMN lease_payments.due_date IS 'Date the payment is due';
COMMENT ON COLUMN lease_payments.amount IS 'Total payment amount';
COMMENT ON COLUMN lease_payments.status IS 'Current payment status';
COMMENT ON COLUMN lease_payments.paid_date IS 'Date the payment was made';
COMMENT ON COLUMN lease_payments.payment_reference IS 'Reference number for the payment';
COMMENT ON COLUMN lease_payments.payment_number IS 'Sequential payment number for this contract';
COMMENT ON COLUMN lease_payments.payment_type IS 'Type of payment (REGULAR, ADVANCE, FINAL, etc.)';
COMMENT ON COLUMN lease_payments.principal_amount IS 'Principal portion of payment';
COMMENT ON COLUMN lease_payments.interest_amount IS 'Interest portion of payment';
COMMENT ON COLUMN lease_payments.is_late IS 'Whether payment was/is late';
COMMENT ON COLUMN lease_payments.days_late IS 'Number of days payment is/was late';
COMMENT ON COLUMN lease_payments.late_fee_amount IS 'Late fee charged';

-- Indexes for lease payment queries
CREATE INDEX idx_lp_contract ON lease_payments(contract_id);
CREATE INDEX idx_lp_due_date ON lease_payments(due_date);
CREATE INDEX idx_lp_status ON lease_payments(status);
CREATE INDEX idx_lp_paid_date ON lease_payments(paid_date) WHERE paid_date IS NOT NULL;
CREATE INDEX idx_lp_payment_type ON lease_payments(payment_type);
CREATE INDEX idx_lp_is_late ON lease_payments(is_late) WHERE is_late = TRUE;

-- Composite indexes for common queries
CREATE INDEX idx_lp_contract_due ON lease_payments(contract_id, due_date);
CREATE INDEX idx_lp_upcoming ON lease_payments(status, due_date) 
    WHERE status IN ('SCHEDULED', 'DUE');
CREATE INDEX idx_lp_overdue ON lease_payments(status, due_date, days_late) 
    WHERE status = 'OVERDUE';

-- Apply update timestamp trigger
CREATE TRIGGER trigger_lp_updated_at
    BEFORE UPDATE ON lease_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();



-- ============================================================================
-- AUDIT TRIGGERS
-- Audit logging for contract and financial tables
-- ============================================================================

-- Audit trigger for contracts
CREATE OR REPLACE FUNCTION audit_contract_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
    v_user_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        v_user_id := NEW.created_by;
        
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            v_action_type := 'STATUS_CHANGE';
        ELSE
            v_action_type := 'UPDATE';
        END IF;
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        v_user_id := NEW.updated_by;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
        v_user_id := OLD.updated_by;
    END IF;
    
    INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
    VALUES (v_user_id, v_action_type, 'CONTRACT', COALESCE(NEW.contract_id, OLD.contract_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_contracts
    AFTER INSERT OR UPDATE OR DELETE ON contracts
    FOR EACH ROW
    EXECUTE FUNCTION audit_contract_changes();


-- Audit trigger for purchase orders
CREATE OR REPLACE FUNCTION audit_purchase_order_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
    v_user_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        v_user_id := NEW.created_by;
        
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            v_action_type := 'STATUS_CHANGE';
        ELSE
            v_action_type := 'UPDATE';
        END IF;
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        v_user_id := NEW.updated_by;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
        v_user_id := OLD.updated_by;
    END IF;
    
    INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
    VALUES (v_user_id, v_action_type, 'PURCHASE_ORDER', COALESCE(NEW.po_id, OLD.po_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_purchase_orders
    AFTER INSERT OR UPDATE OR DELETE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION audit_purchase_order_changes();


-- Audit trigger for lease payments
CREATE OR REPLACE FUNCTION audit_lease_payment_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
    v_user_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        v_user_id := NEW.created_by;
        
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            v_action_type := 'STATUS_CHANGE';
        ELSE
            v_action_type := 'UPDATE';
        END IF;
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        v_user_id := NEW.updated_by;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
        v_user_id := OLD.updated_by;
    END IF;
    
    INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
    VALUES (v_user_id, v_action_type, 'LEASE_PAYMENT', COALESCE(NEW.payment_id, OLD.payment_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_lease_payments
    AFTER INSERT OR UPDATE OR DELETE ON lease_payments
    FOR EACH ROW
    EXECUTE FUNCTION audit_lease_payment_changes();


-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Active contracts with vendor details
CREATE OR REPLACE VIEW v_active_contracts AS
SELECT 
    c.contract_id,
    c.contract_number,
    c.contract_name,
    c.contract_type,
    c.status,
    c.start_date,
    c.end_date,
    c.total_value,
    c.annual_value,
    c.renewal_type,
    c.auto_renewal,
    c.cancellation_notice_days,
    c.end_date - CURRENT_DATE AS days_until_expiration,
    v.vendor_id,
    v.vendor_name,
    v.vendor_type,
    v.contact_name AS vendor_contact,
    v.contact_email AS vendor_email,
    u.email AS owner_email,
    u.first_name || ' ' || u.last_name AS owner_name
FROM contracts c
LEFT JOIN vendors v ON c.vendor_id = v.vendor_id
LEFT JOIN users u ON c.owner_id = u.user_id
WHERE c.status = 'ACTIVE';

COMMENT ON VIEW v_active_contracts IS 'Active contracts with vendor and owner details';


-- View: Contracts expiring soon (within 90 days)
CREATE OR REPLACE VIEW v_contracts_expiring AS
SELECT 
    c.contract_id,
    c.contract_number,
    c.contract_name,
    c.contract_type,
    c.end_date,
    c.end_date - CURRENT_DATE AS days_until_expiration,
    c.total_value,
    c.renewal_type,
    c.auto_renewal,
    c.cancellation_notice_days,
    CASE 
        WHEN c.cancellation_notice_days IS NOT NULL 
        THEN c.end_date - c.cancellation_notice_days
        ELSE NULL
    END AS cancellation_deadline,
    v.vendor_name,
    u.email AS owner_email
FROM contracts c
LEFT JOIN vendors v ON c.vendor_id = v.vendor_id
LEFT JOIN users u ON c.owner_id = u.user_id
WHERE c.status = 'ACTIVE'
  AND c.end_date IS NOT NULL
  AND c.end_date <= CURRENT_DATE + INTERVAL '90 days'
  AND c.end_date >= CURRENT_DATE
ORDER BY c.end_date ASC;

COMMENT ON VIEW v_contracts_expiring IS 'Contracts expiring within 90 days';


-- View: Contract value by vendor
CREATE OR REPLACE VIEW v_contract_value_by_vendor AS
SELECT 
    v.vendor_id,
    v.vendor_name,
    v.vendor_type,
    COUNT(c.contract_id) AS contract_count,
    COUNT(c.contract_id) FILTER (WHERE c.status = 'ACTIVE') AS active_contracts,
    SUM(c.total_value) AS total_contract_value,
    SUM(c.total_value) FILTER (WHERE c.status = 'ACTIVE') AS active_contract_value,
    SUM(c.annual_value) FILTER (WHERE c.status = 'ACTIVE') AS active_annual_value,
    MIN(c.end_date) FILTER (WHERE c.status = 'ACTIVE') AS earliest_expiration
FROM vendors v
LEFT JOIN contracts c ON v.vendor_id = c.vendor_id
GROUP BY v.vendor_id, v.vendor_name, v.vendor_type;

COMMENT ON VIEW v_contract_value_by_vendor IS 'Total contract value aggregated by vendor';


-- View: Purchase order summary
CREATE OR REPLACE VIEW v_purchase_order_summary AS
SELECT 
    po.po_id,
    po.po_number,
    po.status,
    po.order_date,
    po.expected_delivery_date,
    po.total_amount,
    v.vendor_name,
    u_req.email AS requester_email,
    u_req.first_name || ' ' || u_req.last_name AS requester_name,
    u_app.email AS approver_email,
    u_app.first_name || ' ' || u_app.last_name AS approver_name,
    cc.name AS cost_center_name,
    d.name AS department_name,
    COUNT(pol.line_id) AS line_count,
    SUM(pol.quantity) AS total_items,
    SUM(pol.received_quantity) AS total_received
FROM purchase_orders po
LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
LEFT JOIN users u_req ON po.requester_id = u_req.user_id
LEFT JOIN users u_app ON po.approver_id = u_app.user_id
LEFT JOIN cost_centers cc ON po.cost_center_id = cc.cost_center_id
LEFT JOIN departments d ON po.department_id = d.department_id
LEFT JOIN purchase_order_lines pol ON po.po_id = pol.po_id
GROUP BY po.po_id, po.po_number, po.status, po.order_date, po.expected_delivery_date,
         po.total_amount, v.vendor_name, u_req.email, u_req.first_name, u_req.last_name,
         u_app.email, u_app.first_name, u_app.last_name, cc.name, d.name;

COMMENT ON VIEW v_purchase_order_summary IS 'Purchase order summary with vendor and line item counts';


-- View: Pending purchase orders for approval
CREATE OR REPLACE VIEW v_pending_purchase_orders AS
SELECT 
    po.po_id,
    po.po_number,
    po.description,
    po.total_amount,
    po.submitted_date,
    CURRENT_DATE - po.submitted_date::DATE AS days_pending,
    v.vendor_name,
    u_req.email AS requester_email,
    u_req.first_name || ' ' || u_req.last_name AS requester_name,
    d.name AS department_name,
    cc.name AS cost_center_name
FROM purchase_orders po
LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
LEFT JOIN users u_req ON po.requester_id = u_req.user_id
LEFT JOIN departments d ON po.department_id = d.department_id
LEFT JOIN cost_centers cc ON po.cost_center_id = cc.cost_center_id
WHERE po.status = 'PENDING_APPROVAL'
ORDER BY po.submitted_date ASC;

COMMENT ON VIEW v_pending_purchase_orders IS 'Purchase orders pending approval';


-- View: Cost center budget status
CREATE OR REPLACE VIEW v_cost_center_budget AS
SELECT 
    cc.cost_center_id,
    cc.code,
    cc.name,
    cc.fiscal_year,
    cc.budget_amount,
    cc.spent_amount,
    cc.committed_amount,
    cc.budget_amount - COALESCE(cc.spent_amount, 0) - COALESCE(cc.committed_amount, 0) AS available_amount,
    CASE 
        WHEN cc.budget_amount > 0 
        THEN ROUND((COALESCE(cc.spent_amount, 0) / cc.budget_amount) * 100, 2)
        ELSE 0
    END AS spent_percentage,
    CASE 
        WHEN cc.budget_amount > 0 
        THEN ROUND(((COALESCE(cc.spent_amount, 0) + COALESCE(cc.committed_amount, 0)) / cc.budget_amount) * 100, 2)
        ELSE 0
    END AS utilized_percentage,
    d.name AS department_name,
    u.email AS manager_email,
    u.first_name || ' ' || u.last_name AS manager_name
FROM cost_centers cc
LEFT JOIN departments d ON cc.department_id = d.department_id
LEFT JOIN users u ON cc.manager_id = u.user_id
WHERE cc.is_active = TRUE;

COMMENT ON VIEW v_cost_center_budget IS 'Cost center budget status with utilization percentages';


-- View: Asset depreciation summary
CREATE OR REPLACE VIEW v_asset_depreciation_summary AS
SELECT 
    a.asset_id,
    a.asset_tag,
    a.display_name,
    a.asset_type,
    ds.depreciation_method,
    ds.fiscal_year,
    MIN(ds.period_start) AS first_period,
    MAX(ds.period_end) AS last_period,
    SUM(ds.depreciation_amount) AS total_depreciation,
    MAX(ds.accumulated_depreciation) AS current_accumulated,
    MIN(ds.beginning_value) FILTER (WHERE ds.period_number = 1) AS original_value,
    MIN(ds.ending_value) AS current_book_value,
    COUNT(ds.schedule_id) AS periods_completed,
    COUNT(ds.schedule_id) FILTER (WHERE ds.status = 'POSTED') AS periods_posted
FROM assets a
JOIN depreciation_schedules ds ON a.asset_id = ds.asset_id
GROUP BY a.asset_id, a.asset_tag, a.display_name, a.asset_type, 
         ds.depreciation_method, ds.fiscal_year;

COMMENT ON VIEW v_asset_depreciation_summary IS 'Asset depreciation summary by fiscal year';


-- View: Upcoming lease payments
CREATE OR REPLACE VIEW v_upcoming_lease_payments AS
SELECT 
    lp.payment_id,
    lp.contract_id,
    c.contract_number,
    c.contract_name,
    v.vendor_name,
    lp.payment_number,
    lp.due_date,
    lp.due_date - CURRENT_DATE AS days_until_due,
    lp.amount,
    lp.payment_type,
    lp.status,
    lp.principal_amount,
    lp.interest_amount
FROM lease_payments lp
JOIN contracts c ON lp.contract_id = c.contract_id
LEFT JOIN vendors v ON c.vendor_id = v.vendor_id
WHERE lp.status IN ('SCHEDULED', 'DUE')
  AND lp.due_date >= CURRENT_DATE
ORDER BY lp.due_date ASC;

COMMENT ON VIEW v_upcoming_lease_payments IS 'Upcoming lease payments due';


-- View: Overdue lease payments
CREATE OR REPLACE VIEW v_overdue_lease_payments AS
SELECT 
    lp.payment_id,
    lp.contract_id,
    c.contract_number,
    c.contract_name,
    v.vendor_name,
    lp.payment_number,
    lp.due_date,
    CURRENT_DATE - lp.due_date AS days_overdue,
    lp.amount,
    lp.late_fee_amount,
    lp.amount + COALESCE(lp.late_fee_amount, 0) AS total_due,
    lp.status
FROM lease_payments lp
JOIN contracts c ON lp.contract_id = c.contract_id
LEFT JOIN vendors v ON c.vendor_id = v.vendor_id
WHERE lp.status = 'OVERDUE'
   OR (lp.status IN ('SCHEDULED', 'DUE') AND lp.due_date < CURRENT_DATE)
ORDER BY lp.due_date ASC;

COMMENT ON VIEW v_overdue_lease_payments IS 'Overdue lease payments requiring attention';


-- View: Lease payment schedule by contract
CREATE OR REPLACE VIEW v_lease_payment_schedule AS
SELECT 
    c.contract_id,
    c.contract_number,
    c.contract_name,
    v.vendor_name,
    COUNT(lp.payment_id) AS total_payments,
    COUNT(lp.payment_id) FILTER (WHERE lp.status = 'PAID') AS payments_made,
    COUNT(lp.payment_id) FILTER (WHERE lp.status IN ('SCHEDULED', 'DUE')) AS payments_remaining,
    SUM(lp.amount) AS total_lease_value,
    SUM(lp.amount) FILTER (WHERE lp.status = 'PAID') AS total_paid,
    SUM(lp.amount) FILTER (WHERE lp.status IN ('SCHEDULED', 'DUE')) AS total_remaining,
    MIN(lp.due_date) FILTER (WHERE lp.status IN ('SCHEDULED', 'DUE')) AS next_payment_date,
    MAX(lp.due_date) AS final_payment_date
FROM contracts c
LEFT JOIN vendors v ON c.vendor_id = v.vendor_id
LEFT JOIN lease_payments lp ON c.contract_id = lp.contract_id
WHERE c.contract_type = 'LEASE'
GROUP BY c.contract_id, c.contract_number, c.contract_name, v.vendor_name;

COMMENT ON VIEW v_lease_payment_schedule IS 'Lease payment schedule summary by contract';


-- ============================================================================
-- FUNCTIONS FOR COMMON OPERATIONS
-- ============================================================================

-- Function: Generate next PO number
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS VARCHAR(100) AS $$
DECLARE
    v_year VARCHAR(4);
    v_sequence INTEGER;
    v_po_number VARCHAR(100);
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    SELECT COALESCE(MAX(
        CASE 
            WHEN po_number ~ ('^PO-' || v_year || '-[0-9]+$')
            THEN CAST(SUBSTRING(po_number FROM '[0-9]+$') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM purchase_orders
    WHERE po_number LIKE 'PO-' || v_year || '-%';
    
    v_po_number := 'PO-' || v_year || '-' || LPAD(v_sequence::TEXT, 6, '0');
    
    RETURN v_po_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_po_number IS 'Generates next PO number in format PO-YYYY-NNNNNN';


-- Function: Generate next contract number
CREATE OR REPLACE FUNCTION generate_contract_number(p_contract_type VARCHAR(50))
RETURNS VARCHAR(100) AS $$
DECLARE
    v_prefix VARCHAR(10);
    v_year VARCHAR(4);
    v_sequence INTEGER;
    v_contract_number VARCHAR(100);
BEGIN
    -- Determine prefix based on contract type
    CASE p_contract_type
        WHEN 'PURCHASE' THEN v_prefix := 'PUR';
        WHEN 'LEASE' THEN v_prefix := 'LSE';
        WHEN 'MAINTENANCE' THEN v_prefix := 'MNT';
        WHEN 'SUPPORT' THEN v_prefix := 'SUP';
        WHEN 'LICENSE' THEN v_prefix := 'LIC';
        WHEN 'WARRANTY' THEN v_prefix := 'WRN';
        WHEN 'SERVICE' THEN v_prefix := 'SVC';
        WHEN 'SUBSCRIPTION' THEN v_prefix := 'SUB';
        WHEN 'MASTER' THEN v_prefix := 'MST';
        ELSE v_prefix := 'CON';
    END CASE;
    
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    SELECT COALESCE(MAX(
        CASE 
            WHEN contract_number ~ ('^' || v_prefix || '-' || v_year || '-[0-9]+$')
            THEN CAST(SUBSTRING(contract_number FROM '[0-9]+$') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM contracts
    WHERE contract_number LIKE v_prefix || '-' || v_year || '-%';
    
    v_contract_number := v_prefix || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 5, '0');
    
    RETURN v_contract_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_contract_number IS 'Generates next contract number based on type in format TYPE-YYYY-NNNNN';


-- Function: Calculate depreciation for an asset
CREATE OR REPLACE FUNCTION calculate_straight_line_depreciation(
    p_asset_id UUID,
    p_original_value DECIMAL(14, 2),
    p_salvage_value DECIMAL(14, 2),
    p_useful_life_months INTEGER,
    p_start_date DATE
)
RETURNS TABLE (
    period_number INTEGER,
    period_start DATE,
    period_end DATE,
    beginning_value DECIMAL(14, 2),
    depreciation_amount DECIMAL(14, 2),
    ending_value DECIMAL(14, 2),
    accumulated_depreciation DECIMAL(14, 2)
) AS $$
DECLARE
    v_depreciable_amount DECIMAL(14, 2);
    v_monthly_depreciation DECIMAL(14, 2);
    v_current_value DECIMAL(14, 2);
    v_accumulated DECIMAL(14, 2);
    v_period INTEGER;
    v_period_start DATE;
    v_period_end DATE;
BEGIN
    v_depreciable_amount := p_original_value - COALESCE(p_salvage_value, 0);
    v_monthly_depreciation := ROUND(v_depreciable_amount / p_useful_life_months, 2);
    v_current_value := p_original_value;
    v_accumulated := 0;
    
    FOR v_period IN 1..p_useful_life_months LOOP
        v_period_start := p_start_date + ((v_period - 1) * INTERVAL '1 month');
        v_period_end := p_start_date + (v_period * INTERVAL '1 month') - INTERVAL '1 day';
        
        -- Adjust last period for rounding
        IF v_period = p_useful_life_months THEN
            v_monthly_depreciation := v_current_value - COALESCE(p_salvage_value, 0);
        END IF;
        
        period_number := v_period;
        period_start := v_period_start;
        period_end := v_period_end;
        beginning_value := v_current_value;
        depreciation_amount := v_monthly_depreciation;
        ending_value := v_current_value - v_monthly_depreciation;
        v_accumulated := v_accumulated + v_monthly_depreciation;
        accumulated_depreciation := v_accumulated;
        
        v_current_value := ending_value;
        
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_straight_line_depreciation IS 'Calculates straight-line depreciation schedule for an asset';


-- Function: Update lease payment status based on due date
CREATE OR REPLACE FUNCTION update_lease_payment_status()
RETURNS INTEGER AS $$
DECLARE
    v_updated_count INTEGER := 0;
    v_temp_count INTEGER;
BEGIN
    -- Update scheduled payments that are now due
    UPDATE lease_payments
    SET status = 'DUE',
        updated_at = NOW()
    WHERE status = 'SCHEDULED'
      AND due_date <= CURRENT_DATE;
    
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_updated_count := v_updated_count + v_temp_count;
    
    -- Update due payments that are now overdue
    UPDATE lease_payments
    SET status = 'OVERDUE',
        is_late = TRUE,
        days_late = CURRENT_DATE - due_date,
        updated_at = NOW()
    WHERE status = 'DUE'
      AND due_date < CURRENT_DATE;
    
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_updated_count := v_updated_count + v_temp_count;
    
    -- Update days_late for already overdue payments
    UPDATE lease_payments
    SET days_late = CURRENT_DATE - due_date,
        updated_at = NOW()
    WHERE status = 'OVERDUE'
      AND days_late != CURRENT_DATE - due_date;
    
    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_lease_payment_status IS 'Updates lease payment status based on current date';


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
