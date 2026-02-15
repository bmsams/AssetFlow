-- ============================================================================
-- V002: Hardware Asset Schema Migration
-- Asset Management System - Hardware Asset Tables
-- 
-- This migration creates the hardware asset management tables:
-- - manufacturers: Normalized manufacturer lookup table
-- - models: Normalized model lookup table with manufacturer reference
-- - stockrooms: Physical/logical inventory locations (placeholder for V006)
-- - cost_centers: Financial allocation units (placeholder for V005)
-- - vendors: Vendor/supplier information (placeholder for V005)
-- - purchase_orders: Procurement documents (placeholder for V005)
-- - contracts: Legal agreements (placeholder for V005)
-- - hardware_assets: Hardware-specific asset attributes
--
-- Requirements: 2A.1-2A.9
-- ============================================================================

-- ============================================================================
-- PLACEHOLDER TABLES
-- These tables are created here with minimal structure to support foreign keys.
-- They will be fully defined in their respective migrations (V005, V006).
-- ============================================================================

-- Stockrooms placeholder (full definition in V006)
CREATE TABLE IF NOT EXISTS stockrooms (
    stockroom_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    stockroom_type VARCHAR(50),
    manager_id UUID REFERENCES users(user_id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE stockrooms IS 'Physical or logical inventory locations (placeholder - full definition in V006)';

-- Cost Centers placeholder (full definition in V005)
CREATE TABLE IF NOT EXISTS cost_centers (
    cost_center_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    department_id UUID REFERENCES departments(department_id),
    budget_amount DECIMAL(14, 2),
    spent_amount DECIMAL(14, 2) DEFAULT 0,
    fiscal_year INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE cost_centers IS 'Financial allocation units for asset expenses (placeholder - full definition in V005)';

-- Vendors placeholder (full definition in V005)
CREATE TABLE IF NOT EXISTS vendors (
    vendor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_name VARCHAR(255) NOT NULL,
    vendor_type VARCHAR(50),
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    payment_terms VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE vendors IS 'Vendor/supplier information (placeholder - full definition in V005)';


-- Contracts placeholder (full definition in V005)
CREATE TABLE IF NOT EXISTS contracts (
    contract_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_number VARCHAR(100) UNIQUE,
    vendor_id UUID REFERENCES vendors(vendor_id),
    contract_type VARCHAR(50),
    start_date DATE,
    end_date DATE,
    total_value DECIMAL(14, 2),
    status VARCHAR(30) DEFAULT 'DRAFT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE contracts IS 'Legal agreements with vendors (placeholder - full definition in V005)';

-- Purchase Orders placeholder (full definition in V005)
CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(100) UNIQUE NOT NULL,
    vendor_id UUID REFERENCES vendors(vendor_id),
    requester_id UUID REFERENCES users(user_id),
    approver_id UUID REFERENCES users(user_id),
    status VARCHAR(30) DEFAULT 'DRAFT',
    order_date DATE,
    expected_delivery_date DATE,
    total_amount DECIMAL(14, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE purchase_orders IS 'Procurement documents (placeholder - full definition in V005)';

-- ============================================================================
-- MANUFACTURERS TABLE
-- Normalized manufacturer lookup for hardware asset normalization
-- Requirement: 2A.8 (normalized manufacturer references)
-- ============================================================================
CREATE TABLE manufacturers (
    manufacturer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    aliases TEXT[],
    website VARCHAR(500),
    support_url VARCHAR(500),
    support_phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure normalized names are unique for deduplication
    CONSTRAINT unique_normalized_manufacturer UNIQUE (normalized_name)
);

COMMENT ON TABLE manufacturers IS 'Normalized manufacturer lookup table for hardware asset normalization (Requirement 2A.8)';
COMMENT ON COLUMN manufacturers.name IS 'Display name of the manufacturer';
COMMENT ON COLUMN manufacturers.normalized_name IS 'Canonical normalized name for matching (uppercase, trimmed)';
COMMENT ON COLUMN manufacturers.aliases IS 'Array of known aliases/variations for this manufacturer';

-- Index for manufacturer lookups
CREATE INDEX idx_manufacturers_normalized ON manufacturers(normalized_name);
CREATE INDEX idx_manufacturers_name ON manufacturers(name);

-- Insert common manufacturers for normalization
INSERT INTO manufacturers (name, normalized_name, aliases) VALUES
    ('Dell Technologies', 'DELL', ARRAY['Dell', 'Dell Inc', 'Dell Inc.', 'Dell Computer', 'Dell EMC']),
    ('Hewlett Packard Enterprise', 'HPE', ARRAY['HPE', 'HP Enterprise', 'Hewlett-Packard Enterprise']),
    ('HP Inc.', 'HP', ARRAY['HP', 'Hewlett-Packard', 'Hewlett Packard', 'HP Inc']),
    ('Lenovo', 'LENOVO', ARRAY['Lenovo Group', 'Lenovo Inc', 'Lenovo Ltd']),
    ('Apple Inc.', 'APPLE', ARRAY['Apple', 'Apple Computer', 'Apple Inc']),
    ('Microsoft Corporation', 'MICROSOFT', ARRAY['Microsoft', 'Microsoft Corp', 'MSFT']),
    ('Cisco Systems', 'CISCO', ARRAY['Cisco', 'Cisco Systems Inc', 'Cisco Systems, Inc.']),
    ('IBM', 'IBM', ARRAY['International Business Machines', 'IBM Corporation', 'IBM Corp']),
    ('Samsung Electronics', 'SAMSUNG', ARRAY['Samsung', 'Samsung Electronics Co']),
    ('Intel Corporation', 'INTEL', ARRAY['Intel', 'Intel Corp']);


-- ============================================================================
-- MODELS TABLE
-- Normalized model lookup for hardware asset normalization
-- Requirement: 2A.8 (normalized model references)
-- ============================================================================
CREATE TABLE models (
    model_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturer_id UUID NOT NULL REFERENCES manufacturers(manufacturer_id),
    model_name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    model_number VARCHAR(100),
    model_category VARCHAR(50),
    aliases TEXT[],
    specifications JSONB,
    end_of_life_date DATE,
    end_of_support_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique model per manufacturer
    CONSTRAINT unique_model_per_manufacturer UNIQUE (manufacturer_id, normalized_name)
);

COMMENT ON TABLE models IS 'Normalized model lookup table for hardware asset normalization (Requirement 2A.8)';
COMMENT ON COLUMN models.model_name IS 'Display name of the model';
COMMENT ON COLUMN models.normalized_name IS 'Canonical normalized name for matching';
COMMENT ON COLUMN models.model_number IS 'Official model number/SKU';
COMMENT ON COLUMN models.model_category IS 'Category: LAPTOP, DESKTOP, SERVER, NETWORK, MOBILE, PERIPHERAL, STORAGE';
COMMENT ON COLUMN models.specifications IS 'JSON object with default specifications (cpu, memory, storage)';
COMMENT ON COLUMN models.end_of_life_date IS 'Date when manufacturer stops selling the model';
COMMENT ON COLUMN models.end_of_support_date IS 'Date when manufacturer stops supporting the model';

-- Indexes for model lookups
CREATE INDEX idx_models_manufacturer ON models(manufacturer_id);
CREATE INDEX idx_models_normalized ON models(normalized_name);
CREATE INDEX idx_models_category ON models(model_category);
CREATE INDEX idx_models_model_number ON models(model_number);

-- ============================================================================
-- HARDWARE_ASSETS TABLE
-- Hardware-specific asset attributes extending the base assets table
-- Requirements: 2A.1-2A.9
-- ============================================================================
CREATE TABLE hardware_assets (
    -- Primary key references base assets table
    -- Requirement 2A.1: asset_id, asset_tag (from base), serial_number, manufacturer, model, model_category, status, substatus
    asset_id UUID PRIMARY KEY REFERENCES assets(asset_id) ON DELETE CASCADE,
    serial_number VARCHAR(100),
    manufacturer_id UUID REFERENCES manufacturers(manufacturer_id),
    model_id UUID REFERENCES models(model_id),
    model_category VARCHAR(50),
    
    -- Location attributes
    -- Requirement 2A.2: stockroom_id, building, floor, room, rack, rack_unit
    stockroom_id UUID REFERENCES stockrooms(stockroom_id),
    building VARCHAR(100),
    floor VARCHAR(20),
    room VARCHAR(50),
    rack VARCHAR(50),
    rack_unit INTEGER,
    
    -- Ownership attributes
    -- Requirement 2A.3: assigned_to_user_id, department_id, cost_center_id, managed_by_user_id
    assigned_to UUID REFERENCES users(user_id),
    department_id UUID REFERENCES departments(department_id),
    cost_center_id UUID REFERENCES cost_centers(cost_center_id),
    managed_by UUID REFERENCES users(user_id),
    
    -- Financial attributes
    -- Requirement 2A.4: purchase_price, residual_value, depreciation_method, depreciation_start_date, useful_life_months
    purchase_price DECIMAL(12, 2),
    residual_value DECIMAL(12, 2),
    depreciation_method VARCHAR(20) DEFAULT 'STRAIGHT_LINE',
    depreciation_start_date DATE,
    useful_life_months INTEGER,
    
    -- Procurement attributes
    -- Requirement 2A.5: purchase_order_id, vendor_id, received_date, warranty_expiration_date
    purchase_order_id UUID REFERENCES purchase_orders(po_id),
    vendor_id UUID REFERENCES vendors(vendor_id),
    received_date DATE,
    warranty_expiration DATE,
    
    -- Technical attributes
    -- Requirement 2A.6: cpu, memory_gb, storage_gb, operating_system, ip_address, mac_address, last_discovered_date
    cpu VARCHAR(100),
    memory_gb INTEGER,
    storage_gb INTEGER,
    operating_system VARCHAR(100),
    ip_address INET,
    mac_address MACADDR,
    last_discovered_at TIMESTAMP WITH TIME ZONE,
    
    -- Lifecycle attributes
    -- Requirement 2A.7: install_date, retirement_date, disposal_date, disposal_method, destruction_certificate_id
    install_date DATE,
    retirement_date DATE,
    disposal_date DATE,
    disposal_method VARCHAR(50),
    destruction_certificate_id UUID,
    
    -- Lease information
    -- Requirement 2A.9: lease_contract_id, lease_start_date, lease_end_date, monthly_lease_cost
    lease_contract_id UUID REFERENCES contracts(contract_id),
    lease_start_date DATE,
    lease_end_date DATE,
    monthly_lease_cost DECIMAL(10, 2),
    
    -- Constraints
    CONSTRAINT valid_model_category CHECK (model_category IN (
        'LAPTOP', 'DESKTOP', 'SERVER', 'NETWORK', 'MOBILE', 
        'PERIPHERAL', 'STORAGE', 'PRINTER', 'MONITOR', 'OTHER'
    )),
    CONSTRAINT valid_depreciation_method CHECK (depreciation_method IN (
        'STRAIGHT_LINE', 'DECLINING_BALANCE', 'SUM_OF_YEARS', 'UNITS_OF_PRODUCTION', 'NONE'
    )),
    CONSTRAINT valid_disposal_method CHECK (disposal_method IS NULL OR disposal_method IN (
        'RECYCLED', 'DONATED', 'SOLD', 'DESTROYED', 'RETURNED_TO_VENDOR', 'TRADE_IN'
    )),
    CONSTRAINT valid_useful_life CHECK (useful_life_months IS NULL OR useful_life_months > 0),
    CONSTRAINT valid_rack_unit CHECK (rack_unit IS NULL OR rack_unit > 0),
    CONSTRAINT valid_memory CHECK (memory_gb IS NULL OR memory_gb > 0),
    CONSTRAINT valid_storage CHECK (storage_gb IS NULL OR storage_gb > 0),
    CONSTRAINT valid_lease_dates CHECK (
        (lease_start_date IS NULL AND lease_end_date IS NULL) OR
        (lease_start_date IS NOT NULL AND lease_end_date IS NOT NULL AND lease_end_date > lease_start_date)
    )
);


COMMENT ON TABLE hardware_assets IS 'Hardware-specific asset attributes extending base assets table (Requirements 2A.1-2A.9)';
COMMENT ON COLUMN hardware_assets.asset_id IS 'Foreign key to base assets table';
COMMENT ON COLUMN hardware_assets.serial_number IS 'Manufacturer serial number for physical identification';
COMMENT ON COLUMN hardware_assets.manufacturer_id IS 'Reference to normalized manufacturer (Requirement 2A.8)';
COMMENT ON COLUMN hardware_assets.model_id IS 'Reference to normalized model (Requirement 2A.8)';
COMMENT ON COLUMN hardware_assets.model_category IS 'Hardware category: LAPTOP, DESKTOP, SERVER, etc.';
COMMENT ON COLUMN hardware_assets.stockroom_id IS 'Current stockroom location if in inventory';
COMMENT ON COLUMN hardware_assets.assigned_to IS 'User currently assigned this asset';
COMMENT ON COLUMN hardware_assets.managed_by IS 'User responsible for managing this asset';
COMMENT ON COLUMN hardware_assets.depreciation_method IS 'Method for calculating depreciation';
COMMENT ON COLUMN hardware_assets.warranty_expiration IS 'Date when warranty coverage ends';
COMMENT ON COLUMN hardware_assets.last_discovered_at IS 'Last time asset was seen by discovery tools';
COMMENT ON COLUMN hardware_assets.disposal_method IS 'How the asset was disposed (if applicable)';
COMMENT ON COLUMN hardware_assets.destruction_certificate_id IS 'Reference to destruction certificate document';
COMMENT ON COLUMN hardware_assets.lease_contract_id IS 'Reference to lease contract if leased asset';

-- ============================================================================
-- INDEXES FOR HARDWARE_ASSETS
-- Optimized for common query patterns
-- ============================================================================

-- Primary lookup indexes (as specified in task)
CREATE INDEX idx_hw_serial ON hardware_assets(serial_number);
CREATE INDEX idx_hw_assigned ON hardware_assets(assigned_to);
CREATE INDEX idx_hw_stockroom ON hardware_assets(stockroom_id);

-- Additional indexes for common query patterns
CREATE INDEX idx_hw_manufacturer ON hardware_assets(manufacturer_id);
CREATE INDEX idx_hw_model ON hardware_assets(model_id);
CREATE INDEX idx_hw_department ON hardware_assets(department_id);
CREATE INDEX idx_hw_cost_center ON hardware_assets(cost_center_id);
CREATE INDEX idx_hw_vendor ON hardware_assets(vendor_id);
CREATE INDEX idx_hw_category ON hardware_assets(model_category);

-- Composite indexes for common filtered queries
CREATE INDEX idx_hw_category_stockroom ON hardware_assets(model_category, stockroom_id);
CREATE INDEX idx_hw_assigned_category ON hardware_assets(assigned_to, model_category);

-- Index for warranty expiration queries (finding assets with expiring warranties)
CREATE INDEX idx_hw_warranty_expiration ON hardware_assets(warranty_expiration) 
    WHERE warranty_expiration IS NOT NULL;

-- Index for lease end date queries (finding assets with expiring leases)
CREATE INDEX idx_hw_lease_end ON hardware_assets(lease_end_date) 
    WHERE lease_end_date IS NOT NULL;

-- Index for discovery tracking (finding stale assets)
CREATE INDEX idx_hw_last_discovered ON hardware_assets(last_discovered_at);

-- Index for MAC address lookups (common in discovery matching)
CREATE INDEX idx_hw_mac_address ON hardware_assets(mac_address) 
    WHERE mac_address IS NOT NULL;

-- Index for IP address lookups
CREATE INDEX idx_hw_ip_address ON hardware_assets(ip_address) 
    WHERE ip_address IS NOT NULL;

-- ============================================================================
-- TRIGGER: Update timestamp on hardware_assets modification
-- ============================================================================
-- Note: hardware_assets doesn't have its own updated_at column since changes
-- should update the parent assets table's updated_at via the existing trigger.
-- However, we create a trigger to ensure the parent is updated when hardware
-- attributes change.

CREATE OR REPLACE FUNCTION update_parent_asset_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE assets 
    SET updated_at = NOW()
    WHERE asset_id = NEW.asset_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_hw_update_parent
    AFTER UPDATE ON hardware_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_parent_asset_timestamp();

-- ============================================================================
-- TRIGGER: Audit log for hardware asset changes
-- ============================================================================
CREATE OR REPLACE FUNCTION audit_hardware_asset_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
    v_user_id UUID;
BEGIN
    -- Get the user_id from the parent asset record
    SELECT updated_by INTO v_user_id FROM assets WHERE asset_id = COALESCE(NEW.asset_id, OLD.asset_id);
    
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        
        INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
        VALUES (v_user_id, v_action_type, 'HARDWARE_ASSET', NEW.asset_id, v_old_values, v_new_values);
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Check for assignment changes
        IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
            IF NEW.assigned_to IS NOT NULL AND OLD.assigned_to IS NULL THEN
                v_action_type := 'ASSIGN';
            ELSIF NEW.assigned_to IS NULL AND OLD.assigned_to IS NOT NULL THEN
                v_action_type := 'UNASSIGN';
            ELSE
                v_action_type := 'TRANSFER';
            END IF;
        -- Check for location changes
        ELSIF OLD.stockroom_id IS DISTINCT FROM NEW.stockroom_id THEN
            v_action_type := 'TRANSFER';
        ELSE
            v_action_type := 'UPDATE';
        END IF;
        
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        
        INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
        VALUES (v_user_id, v_action_type, 'HARDWARE_ASSET', NEW.asset_id, v_old_values, v_new_values);
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
        
        INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
        VALUES (v_user_id, v_action_type, 'HARDWARE_ASSET', OLD.asset_id, v_old_values, v_new_values);
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_hardware_assets
    AFTER INSERT OR UPDATE OR DELETE ON hardware_assets
    FOR EACH ROW
    EXECUTE FUNCTION audit_hardware_asset_changes();


-- ============================================================================
-- FUNCTION: Normalize manufacturer name
-- Looks up or creates a normalized manufacturer entry
-- Requirement: 2A.8 (normalized manufacturer references)
-- ============================================================================
CREATE OR REPLACE FUNCTION normalize_manufacturer(p_raw_name VARCHAR(255))
RETURNS UUID AS $$
DECLARE
    v_normalized VARCHAR(255);
    v_manufacturer_id UUID;
BEGIN
    -- Normalize the input: uppercase, trim whitespace
    v_normalized := UPPER(TRIM(p_raw_name));
    
    -- First, try to find by normalized name
    SELECT manufacturer_id INTO v_manufacturer_id
    FROM manufacturers
    WHERE normalized_name = v_normalized;
    
    IF v_manufacturer_id IS NOT NULL THEN
        RETURN v_manufacturer_id;
    END IF;
    
    -- Try to find by alias match
    SELECT manufacturer_id INTO v_manufacturer_id
    FROM manufacturers
    WHERE v_normalized = ANY(
        SELECT UPPER(TRIM(unnest(aliases)))
    );
    
    IF v_manufacturer_id IS NOT NULL THEN
        RETURN v_manufacturer_id;
    END IF;
    
    -- If not found, create a new manufacturer entry
    INSERT INTO manufacturers (name, normalized_name)
    VALUES (p_raw_name, v_normalized)
    ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name
    RETURNING manufacturer_id INTO v_manufacturer_id;
    
    RETURN v_manufacturer_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION normalize_manufacturer IS 'Looks up or creates a normalized manufacturer entry from raw input';

-- ============================================================================
-- FUNCTION: Normalize model name
-- Looks up or creates a normalized model entry for a manufacturer
-- Requirement: 2A.8 (normalized model references)
-- ============================================================================
CREATE OR REPLACE FUNCTION normalize_model(
    p_manufacturer_id UUID,
    p_raw_model_name VARCHAR(255),
    p_model_category VARCHAR(50) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_normalized VARCHAR(255);
    v_model_id UUID;
BEGIN
    -- Normalize the input: uppercase, trim whitespace
    v_normalized := UPPER(TRIM(p_raw_model_name));
    
    -- First, try to find by manufacturer and normalized name
    SELECT model_id INTO v_model_id
    FROM models
    WHERE manufacturer_id = p_manufacturer_id
      AND normalized_name = v_normalized;
    
    IF v_model_id IS NOT NULL THEN
        RETURN v_model_id;
    END IF;
    
    -- Try to find by alias match
    SELECT model_id INTO v_model_id
    FROM models
    WHERE manufacturer_id = p_manufacturer_id
      AND v_normalized = ANY(
          SELECT UPPER(TRIM(unnest(aliases)))
      );
    
    IF v_model_id IS NOT NULL THEN
        RETURN v_model_id;
    END IF;
    
    -- If not found, create a new model entry
    INSERT INTO models (manufacturer_id, model_name, normalized_name, model_category)
    VALUES (p_manufacturer_id, p_raw_model_name, v_normalized, p_model_category)
    ON CONFLICT (manufacturer_id, normalized_name) DO UPDATE 
        SET model_name = EXCLUDED.model_name,
            model_category = COALESCE(EXCLUDED.model_category, models.model_category)
    RETURNING model_id INTO v_model_id;
    
    RETURN v_model_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION normalize_model IS 'Looks up or creates a normalized model entry from raw input';

-- ============================================================================
-- VIEW: Hardware asset summary
-- Provides a denormalized view of hardware assets with manufacturer/model names
-- ============================================================================
CREATE OR REPLACE VIEW v_hardware_assets AS
SELECT 
    a.asset_id,
    a.asset_tag,
    a.display_name,
    a.status,
    a.substatus,
    ha.serial_number,
    m.name AS manufacturer_name,
    mo.model_name,
    ha.model_category,
    ha.building,
    ha.floor,
    ha.room,
    s.name AS stockroom_name,
    u_assigned.email AS assigned_to_email,
    u_assigned.first_name || ' ' || u_assigned.last_name AS assigned_to_name,
    d.name AS department_name,
    cc.name AS cost_center_name,
    ha.purchase_price,
    ha.warranty_expiration,
    ha.cpu,
    ha.memory_gb,
    ha.storage_gb,
    ha.operating_system,
    ha.ip_address,
    ha.mac_address,
    ha.last_discovered_at,
    a.created_at,
    a.updated_at
FROM assets a
JOIN hardware_assets ha ON a.asset_id = ha.asset_id
LEFT JOIN manufacturers m ON ha.manufacturer_id = m.manufacturer_id
LEFT JOIN models mo ON ha.model_id = mo.model_id
LEFT JOIN stockrooms s ON ha.stockroom_id = s.stockroom_id
LEFT JOIN users u_assigned ON ha.assigned_to = u_assigned.user_id
LEFT JOIN departments d ON ha.department_id = d.department_id
LEFT JOIN cost_centers cc ON ha.cost_center_id = cc.cost_center_id
WHERE a.asset_type = 'HARDWARE';

COMMENT ON VIEW v_hardware_assets IS 'Denormalized view of hardware assets with related entity names';

-- ============================================================================
-- VIEW: Hardware assets by category summary
-- Dashboard view for hardware asset counts by category and status
-- ============================================================================
CREATE OR REPLACE VIEW v_hardware_summary_by_category AS
SELECT 
    ha.model_category,
    a.status,
    COUNT(*) as asset_count,
    SUM(ha.purchase_price) as total_value,
    AVG(ha.purchase_price) as avg_value
FROM assets a
JOIN hardware_assets ha ON a.asset_id = ha.asset_id
WHERE a.asset_type = 'HARDWARE'
GROUP BY ha.model_category, a.status;

COMMENT ON VIEW v_hardware_summary_by_category IS 'Summary of hardware assets by category and status for dashboards';

-- ============================================================================
-- VIEW: Warranty expiration report
-- Shows assets with warranties expiring within configurable period
-- ============================================================================
CREATE OR REPLACE VIEW v_warranty_expiring AS
SELECT 
    a.asset_id,
    a.asset_tag,
    a.display_name,
    ha.serial_number,
    m.name AS manufacturer_name,
    mo.model_name,
    ha.warranty_expiration,
    ha.warranty_expiration - CURRENT_DATE AS days_until_expiration,
    u_assigned.email AS assigned_to_email,
    d.name AS department_name
FROM assets a
JOIN hardware_assets ha ON a.asset_id = ha.asset_id
LEFT JOIN manufacturers m ON ha.manufacturer_id = m.manufacturer_id
LEFT JOIN models mo ON ha.model_id = mo.model_id
LEFT JOIN users u_assigned ON ha.assigned_to = u_assigned.user_id
LEFT JOIN departments d ON ha.department_id = d.department_id
WHERE a.asset_type = 'HARDWARE'
  AND ha.warranty_expiration IS NOT NULL
  AND ha.warranty_expiration >= CURRENT_DATE
  AND a.status NOT IN ('RETIRED', 'DISPOSED')
ORDER BY ha.warranty_expiration ASC;

COMMENT ON VIEW v_warranty_expiring IS 'Hardware assets with upcoming warranty expirations';

-- ============================================================================
-- VIEW: Lease expiration report
-- Shows leased assets with leases expiring
-- ============================================================================
CREATE OR REPLACE VIEW v_lease_expiring AS
SELECT 
    a.asset_id,
    a.asset_tag,
    a.display_name,
    ha.serial_number,
    m.name AS manufacturer_name,
    mo.model_name,
    ha.lease_start_date,
    ha.lease_end_date,
    ha.monthly_lease_cost,
    ha.lease_end_date - CURRENT_DATE AS days_until_expiration,
    c.contract_number AS lease_contract_number,
    u_assigned.email AS assigned_to_email
FROM assets a
JOIN hardware_assets ha ON a.asset_id = ha.asset_id
LEFT JOIN manufacturers m ON ha.manufacturer_id = m.manufacturer_id
LEFT JOIN models mo ON ha.model_id = mo.model_id
LEFT JOIN contracts c ON ha.lease_contract_id = c.contract_id
LEFT JOIN users u_assigned ON ha.assigned_to = u_assigned.user_id
WHERE a.asset_type = 'HARDWARE'
  AND ha.lease_end_date IS NOT NULL
  AND ha.lease_end_date >= CURRENT_DATE
  AND a.status NOT IN ('RETIRED', 'DISPOSED')
ORDER BY ha.lease_end_date ASC;

COMMENT ON VIEW v_lease_expiring IS 'Leased hardware assets with upcoming lease expirations';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
