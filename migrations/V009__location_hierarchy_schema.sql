-- ============================================================================
-- V009: Location Hierarchy Schema Migration
-- Asset Management System - Location Hierarchy Tables
-- 
-- This migration creates tables for physical location hierarchy:
-- - buildings: Physical structures containing floors and rooms
-- - floors: Levels within buildings containing rooms
-- - rooms: Spaces within floors that may contain racks or assets
-- - racks: Server racks with rack unit tracking
-- - bin_locations: Bin/shelf locations within stockrooms
-- - manufacturers: Hardware manufacturers (IF NOT EXISTS)
--
-- Requirements: 1-4 (Location Hierarchy), 6 (Bin Locations), 10 (Manufacturers)
-- ============================================================================

-- ============================================================================
-- BUILDINGS TABLE - NEW
-- Physical structures containing floors and rooms
-- Requirement: 1 (Building Management)
-- ============================================================================
CREATE TABLE buildings (
    building_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core identification
    building_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    
    -- Address information
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    
    -- Contact information
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id)
);

COMMENT ON TABLE buildings IS 'Physical structures containing floors and rooms (Requirement 1)';
COMMENT ON COLUMN buildings.building_id IS 'Unique identifier for the building';
COMMENT ON COLUMN buildings.building_code IS 'Short unique code for the building (e.g., HQ-NYC, DC-CHI)';
COMMENT ON COLUMN buildings.name IS 'Full name of the building';
COMMENT ON COLUMN buildings.address_line1 IS 'Primary street address';
COMMENT ON COLUMN buildings.address_line2 IS 'Secondary address line (suite, floor, etc.)';
COMMENT ON COLUMN buildings.city IS 'City where building is located';
COMMENT ON COLUMN buildings.state_province IS 'State or province';
COMMENT ON COLUMN buildings.postal_code IS 'Postal/ZIP code';
COMMENT ON COLUMN buildings.country IS 'Country (defaults to USA)';
COMMENT ON COLUMN buildings.contact_name IS 'Primary contact person for the building';
COMMENT ON COLUMN buildings.contact_email IS 'Contact email address';
COMMENT ON COLUMN buildings.contact_phone IS 'Contact phone number';
COMMENT ON COLUMN buildings.is_active IS 'Whether the building is currently active';
COMMENT ON COLUMN buildings.created_by IS 'User who created this record';
COMMENT ON COLUMN buildings.updated_by IS 'User who last updated this record';

-- Indexes for building queries
CREATE INDEX idx_buildings_code ON buildings(building_code);
CREATE INDEX idx_buildings_name ON buildings(name);
CREATE INDEX idx_buildings_active ON buildings(is_active);
CREATE INDEX idx_buildings_city ON buildings(city);
CREATE INDEX idx_buildings_location ON buildings(city, state_province, country);

-- Apply update timestamp trigger
CREATE TRIGGER trigger_buildings_updated_at
    BEFORE UPDATE ON buildings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- FLOORS TABLE - NEW
-- Levels within buildings containing rooms
-- Requirement: 2 (Floor Management)
-- ============================================================================
CREATE TABLE floors (
    floor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Building reference
    building_id UUID NOT NULL REFERENCES buildings(building_id),
    
    -- Core identification
    floor_number INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id),
    
    -- Ensure unique floor number per building
    CONSTRAINT unique_building_floor UNIQUE (building_id, floor_number)
);

COMMENT ON TABLE floors IS 'Levels within buildings containing rooms (Requirement 2)';
COMMENT ON COLUMN floors.floor_id IS 'Unique identifier for the floor';
COMMENT ON COLUMN floors.building_id IS 'Reference to the parent building';
COMMENT ON COLUMN floors.floor_number IS 'Floor number (can be negative for basement levels)';
COMMENT ON COLUMN floors.name IS 'Name of the floor (e.g., Ground Floor, Mezzanine, Level 3)';
COMMENT ON COLUMN floors.description IS 'Description of the floor';
COMMENT ON COLUMN floors.is_active IS 'Whether the floor is currently active';
COMMENT ON COLUMN floors.created_by IS 'User who created this record';
COMMENT ON COLUMN floors.updated_by IS 'User who last updated this record';

-- Indexes for floor queries
CREATE INDEX idx_floors_building ON floors(building_id);
CREATE INDEX idx_floors_number ON floors(floor_number);
CREATE INDEX idx_floors_active ON floors(is_active);
CREATE INDEX idx_floors_building_active ON floors(building_id, is_active);

-- Apply update timestamp trigger
CREATE TRIGGER trigger_floors_updated_at
    BEFORE UPDATE ON floors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- ROOMS TABLE - NEW
-- Spaces within floors that may contain racks or assets
-- Requirement: 3 (Room Management)
-- ============================================================================
CREATE TABLE rooms (
    room_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Floor reference
    floor_id UUID NOT NULL REFERENCES floors(floor_id),
    
    -- Core identification
    room_number VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    room_type VARCHAR(30) NOT NULL,
    capacity INTEGER,
    description TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id),
    
    -- Valid room types
    CONSTRAINT valid_room_type CHECK (room_type IN (
        'OFFICE',           -- Standard office space
        'SERVER_ROOM',      -- Data center / server room
        'STORAGE',          -- Storage room
        'CONFERENCE',       -- Conference / meeting room
        'LAB',              -- Laboratory / testing area
        'UTILITY',          -- Utility / mechanical room
        'OTHER'             -- Other room type
    )),
    
    -- Ensure unique room number per floor
    CONSTRAINT unique_floor_room UNIQUE (floor_id, room_number)
);

COMMENT ON TABLE rooms IS 'Spaces within floors that may contain racks or assets (Requirement 3)';
COMMENT ON COLUMN rooms.room_id IS 'Unique identifier for the room';
COMMENT ON COLUMN rooms.floor_id IS 'Reference to the parent floor';
COMMENT ON COLUMN rooms.room_number IS 'Room number or identifier within the floor';
COMMENT ON COLUMN rooms.name IS 'Name of the room';
COMMENT ON COLUMN rooms.room_type IS 'Type of room (OFFICE, SERVER_ROOM, STORAGE, etc.)';
COMMENT ON COLUMN rooms.capacity IS 'Capacity of the room (people, equipment, etc.)';
COMMENT ON COLUMN rooms.description IS 'Description of the room';
COMMENT ON COLUMN rooms.is_active IS 'Whether the room is currently active';
COMMENT ON COLUMN rooms.created_by IS 'User who created this record';
COMMENT ON COLUMN rooms.updated_by IS 'User who last updated this record';

-- Indexes for room queries
CREATE INDEX idx_rooms_floor ON rooms(floor_id);
CREATE INDEX idx_rooms_number ON rooms(room_number);
CREATE INDEX idx_rooms_type ON rooms(room_type);
CREATE INDEX idx_rooms_active ON rooms(is_active);
CREATE INDEX idx_rooms_floor_active ON rooms(floor_id, is_active);
CREATE INDEX idx_rooms_type_active ON rooms(room_type, is_active);

-- Apply update timestamp trigger
CREATE TRIGGER trigger_rooms_updated_at
    BEFORE UPDATE ON rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- RACKS TABLE - NEW
-- Server racks with rack unit tracking
-- Requirement: 4 (Rack Management)
-- ============================================================================
CREATE TABLE racks (
    rack_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Room reference
    room_id UUID NOT NULL REFERENCES rooms(room_id),
    
    -- Core identification
    rack_name VARCHAR(100) NOT NULL,
    total_units INTEGER NOT NULL,
    used_units INTEGER DEFAULT 0,
    description TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id),
    
    -- Rack unit constraints
    CONSTRAINT valid_rack_units CHECK (
        total_units > 0 AND 
        used_units >= 0 AND 
        used_units <= total_units
    ),
    
    -- Ensure unique rack name per room
    CONSTRAINT unique_room_rack UNIQUE (room_id, rack_name)
);

COMMENT ON TABLE racks IS 'Server racks with rack unit tracking (Requirement 4)';
COMMENT ON COLUMN racks.rack_id IS 'Unique identifier for the rack';
COMMENT ON COLUMN racks.room_id IS 'Reference to the parent room';
COMMENT ON COLUMN racks.rack_name IS 'Name or identifier of the rack';
COMMENT ON COLUMN racks.total_units IS 'Total rack units available (e.g., 42U)';
COMMENT ON COLUMN racks.used_units IS 'Number of rack units currently in use';
COMMENT ON COLUMN racks.description IS 'Description of the rack';
COMMENT ON COLUMN racks.is_active IS 'Whether the rack is currently active';
COMMENT ON COLUMN racks.created_by IS 'User who created this record';
COMMENT ON COLUMN racks.updated_by IS 'User who last updated this record';

-- Indexes for rack queries
CREATE INDEX idx_racks_room ON racks(room_id);
CREATE INDEX idx_racks_name ON racks(rack_name);
CREATE INDEX idx_racks_active ON racks(is_active);
CREATE INDEX idx_racks_room_active ON racks(room_id, is_active);
CREATE INDEX idx_racks_utilization ON racks(total_units, used_units);

-- Apply update timestamp trigger
CREATE TRIGGER trigger_racks_updated_at
    BEFORE UPDATE ON racks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- BIN_LOCATIONS TABLE - NEW
-- Bin/shelf locations within stockrooms for inventory organization
-- Requirement: 6 (Stockroom Bin/Shelf Location Management)
-- ============================================================================
CREATE TABLE bin_locations (
    bin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Stockroom reference
    stockroom_id UUID NOT NULL REFERENCES stockrooms(stockroom_id),
    
    -- Core identification
    bin_code VARCHAR(50) NOT NULL,
    shelf_location VARCHAR(100),
    
    -- Capacity tracking
    capacity INTEGER,
    current_count INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Capacity constraints
    CONSTRAINT valid_bin_capacity CHECK (capacity IS NULL OR capacity >= 0),
    CONSTRAINT valid_bin_count CHECK (current_count >= 0),
    
    -- Ensure unique bin code per stockroom
    CONSTRAINT unique_stockroom_bin UNIQUE (stockroom_id, bin_code)
);

COMMENT ON TABLE bin_locations IS 'Bin/shelf locations within stockrooms for inventory organization (Requirement 6)';
COMMENT ON COLUMN bin_locations.bin_id IS 'Unique identifier for the bin location';
COMMENT ON COLUMN bin_locations.stockroom_id IS 'Reference to the parent stockroom';
COMMENT ON COLUMN bin_locations.bin_code IS 'Code or identifier for the bin (e.g., A1, B2-3)';
COMMENT ON COLUMN bin_locations.shelf_location IS 'Shelf location description within the bin area';
COMMENT ON COLUMN bin_locations.capacity IS 'Maximum capacity of the bin (optional)';
COMMENT ON COLUMN bin_locations.current_count IS 'Current number of items in the bin';
COMMENT ON COLUMN bin_locations.is_active IS 'Whether the bin location is currently active';

-- Indexes for bin location queries
CREATE INDEX idx_bin_locations_stockroom ON bin_locations(stockroom_id);
CREATE INDEX idx_bin_locations_code ON bin_locations(bin_code);
CREATE INDEX idx_bin_locations_active ON bin_locations(is_active);
CREATE INDEX idx_bin_locations_stockroom_active ON bin_locations(stockroom_id, is_active);
CREATE INDEX idx_bin_locations_shelf ON bin_locations(stockroom_id, shelf_location) WHERE shelf_location IS NOT NULL;

-- Apply update timestamp trigger
CREATE TRIGGER trigger_bin_locations_updated_at
    BEFORE UPDATE ON bin_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- MANUFACTURERS TABLE - NEW (IF NOT EXISTS)
-- Hardware manufacturers for model catalog
-- Requirement: 10 (Manufacturer Management)
-- ============================================================================

-- Create manufacturers table if it doesn't already exist
-- This table may have been created in an earlier migration
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'manufacturers') THEN
        CREATE TABLE manufacturers (
            manufacturer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            
            -- Core identification
            name VARCHAR(255) UNIQUE NOT NULL,
            website VARCHAR(500),
            
            -- Status
            is_active BOOLEAN DEFAULT TRUE,
            
            -- Audit fields
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_by UUID REFERENCES users(user_id),
            updated_by UUID REFERENCES users(user_id)
        );

        -- Add comments
        COMMENT ON TABLE manufacturers IS 'Hardware manufacturers for model catalog (Requirement 10)';
        COMMENT ON COLUMN manufacturers.manufacturer_id IS 'Unique identifier for the manufacturer';
        COMMENT ON COLUMN manufacturers.name IS 'Name of the manufacturer (must be unique)';
        COMMENT ON COLUMN manufacturers.website IS 'Manufacturer website URL';
        COMMENT ON COLUMN manufacturers.is_active IS 'Whether the manufacturer is currently active';
        COMMENT ON COLUMN manufacturers.created_by IS 'User who created this record';
        COMMENT ON COLUMN manufacturers.updated_by IS 'User who last updated this record';

        -- Create indexes
        CREATE INDEX idx_manufacturers_name ON manufacturers(name);
        CREATE INDEX idx_manufacturers_active ON manufacturers(is_active);

        -- Apply update timestamp trigger
        CREATE TRIGGER trigger_manufacturers_updated_at
            BEFORE UPDATE ON manufacturers
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
            
        RAISE NOTICE 'Created manufacturers table';
    ELSE
        RAISE NOTICE 'manufacturers table already exists, skipping creation';
    END IF;
END $$;


-- ============================================================================
-- ADDITIONAL INDEXES FOR COMMON QUERY PATTERNS
-- Optimized indexes for location hierarchy traversal and lookups
-- ============================================================================

-- Composite indexes for location hierarchy traversal
-- These support common queries that traverse the building → floor → room → rack hierarchy

-- Index for finding all rooms in a building (via floor join)
CREATE INDEX idx_floors_building_number ON floors(building_id, floor_number);

-- Index for finding all racks in a floor (via room join)
CREATE INDEX idx_rooms_floor_type ON rooms(floor_id, room_type);

-- Index for finding racks by utilization (for capacity planning)
CREATE INDEX idx_racks_available_units ON racks((total_units - used_units)) WHERE is_active = TRUE;

-- Index for bin location capacity alerts
CREATE INDEX idx_bin_locations_capacity_alert ON bin_locations(stockroom_id, current_count, capacity)
    WHERE is_active = TRUE AND capacity IS NOT NULL;

-- Full-text search support for building names and addresses
CREATE INDEX idx_buildings_search ON buildings USING gin(
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(address_line1, '') || ' ' || coalesce(city, ''))
);

-- Full-text search support for room names
CREATE INDEX idx_rooms_search ON rooms USING gin(
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
);


-- ============================================================================
-- AUDIT LOGGING FUNCTIONS FOR LOCATION HIERARCHY
-- Logs changes to audit_log table for compliance and tracking
-- ============================================================================

-- Function to log building changes to audit_log
CREATE OR REPLACE FUNCTION log_building_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, new_values, user_id
        ) VALUES (
            'BUILDING',
            NEW.building_id,
            'CREATE',
            to_jsonb(NEW),
            NEW.created_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values, new_values, user_id
        ) VALUES (
            'BUILDING',
            NEW.building_id,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW),
            NEW.updated_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values
        ) VALUES (
            'BUILDING',
            OLD.building_id,
            'DELETE',
            to_jsonb(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to log floor changes to audit_log
CREATE OR REPLACE FUNCTION log_floor_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, new_values, user_id
        ) VALUES (
            'FLOOR',
            NEW.floor_id,
            'CREATE',
            to_jsonb(NEW),
            NEW.created_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values, new_values, user_id
        ) VALUES (
            'FLOOR',
            NEW.floor_id,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW),
            NEW.updated_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values
        ) VALUES (
            'FLOOR',
            OLD.floor_id,
            'DELETE',
            to_jsonb(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to log room changes to audit_log
CREATE OR REPLACE FUNCTION log_room_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, new_values, user_id
        ) VALUES (
            'ROOM',
            NEW.room_id,
            'CREATE',
            to_jsonb(NEW),
            NEW.created_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values, new_values, user_id
        ) VALUES (
            'ROOM',
            NEW.room_id,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW),
            NEW.updated_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values
        ) VALUES (
            'ROOM',
            OLD.room_id,
            'DELETE',
            to_jsonb(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to log rack changes to audit_log
CREATE OR REPLACE FUNCTION log_rack_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, new_values, user_id
        ) VALUES (
            'RACK',
            NEW.rack_id,
            'CREATE',
            to_jsonb(NEW),
            NEW.created_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values, new_values, user_id
        ) VALUES (
            'RACK',
            NEW.rack_id,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW),
            NEW.updated_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values
        ) VALUES (
            'RACK',
            OLD.rack_id,
            'DELETE',
            to_jsonb(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to log bin location changes to audit_log
CREATE OR REPLACE FUNCTION log_bin_location_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, new_values
        ) VALUES (
            'BIN_LOCATION',
            NEW.bin_id,
            'CREATE',
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values, new_values
        ) VALUES (
            'BIN_LOCATION',
            NEW.bin_id,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values
        ) VALUES (
            'BIN_LOCATION',
            OLD.bin_id,
            'DELETE',
            to_jsonb(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to log manufacturer changes to audit_log
CREATE OR REPLACE FUNCTION log_manufacturer_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, new_values, user_id
        ) VALUES (
            'MANUFACTURER',
            NEW.manufacturer_id,
            'CREATE',
            to_jsonb(NEW),
            NEW.created_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values, new_values, user_id
        ) VALUES (
            'MANUFACTURER',
            NEW.manufacturer_id,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW),
            NEW.updated_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values
        ) VALUES (
            'MANUFACTURER',
            OLD.manufacturer_id,
            'DELETE',
            to_jsonb(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- APPLY AUDIT TRIGGERS TO TABLES
-- These triggers fire AFTER insert/update/delete to log changes
-- ============================================================================

-- Apply audit trigger to buildings table
CREATE TRIGGER trigger_buildings_audit
    AFTER INSERT OR UPDATE OR DELETE ON buildings
    FOR EACH ROW
    EXECUTE FUNCTION log_building_changes();

-- Apply audit trigger to floors table
CREATE TRIGGER trigger_floors_audit
    AFTER INSERT OR UPDATE OR DELETE ON floors
    FOR EACH ROW
    EXECUTE FUNCTION log_floor_changes();

-- Apply audit trigger to rooms table
CREATE TRIGGER trigger_rooms_audit
    AFTER INSERT OR UPDATE OR DELETE ON rooms
    FOR EACH ROW
    EXECUTE FUNCTION log_room_changes();

-- Apply audit trigger to racks table
CREATE TRIGGER trigger_racks_audit
    AFTER INSERT OR UPDATE OR DELETE ON racks
    FOR EACH ROW
    EXECUTE FUNCTION log_rack_changes();

-- Apply audit trigger to bin_locations table
CREATE TRIGGER trigger_bin_locations_audit
    AFTER INSERT OR UPDATE OR DELETE ON bin_locations
    FOR EACH ROW
    EXECUTE FUNCTION log_bin_location_changes();

-- Apply audit trigger to manufacturers table (if it was created in this migration)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_manufacturers_audit'
    ) THEN
        CREATE TRIGGER trigger_manufacturers_audit
            AFTER INSERT OR UPDATE OR DELETE ON manufacturers
            FOR EACH ROW
            EXECUTE FUNCTION log_manufacturer_changes();
        RAISE NOTICE 'Created audit trigger for manufacturers table';
    ELSE
        RAISE NOTICE 'Audit trigger for manufacturers table already exists';
    END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Tables created:
--   - buildings: Physical structures with address and contact info
--   - floors: Levels within buildings
--   - rooms: Spaces within floors with room type classification
--   - racks: Server racks with unit tracking
--   - bin_locations: Bin/shelf locations within stockrooms
--   - manufacturers: Hardware manufacturers (if not exists)
--
-- Indexes created for:
--   - Primary key lookups
--   - Foreign key relationships
--   - Common query patterns (active status, location hierarchy)
--   - Full-text search on building and room names
--   - Capacity and utilization queries
--
-- Triggers created for:
--   - Automatic updated_at timestamp updates
--   - Audit logging for all CRUD operations
-- ============================================================================
