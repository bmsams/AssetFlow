-- ============================================================================
-- V004: Enterprise Asset Schema Migration
-- Asset Management System - Enterprise Asset Tables
-- 
-- This migration creates the enterprise asset management tables:
-- - facilities: Physical facility locations
-- - enterprise_assets: Enterprise-specific asset attributes
-- - linear_assets: Assets spanning physical distances
-- - linear_asset_segments: Segments of linear assets
-- - maintenance_plans: Scheduled maintenance configurations
-- - work_orders: Maintenance and repair tasks
-- - spare_parts: Parts inventory for maintenance
-- - work_order_parts: Parts used in work orders
--
-- Requirements: 2C.1-2C.9
-- ============================================================================

-- ============================================================================
-- FACILITIES TABLE
-- Physical facility locations for enterprise assets
-- Supporting table for Requirement 2C.2 (facility_id reference)
-- ============================================================================
CREATE TABLE facilities (
    facility_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    facility_type VARCHAR(50),
    
    -- Address information
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    
    -- Contact information
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    contact_email VARCHAR(255),
    
    -- GPS coordinates for mapping
    gps_latitude DECIMAL(10, 8),
    gps_longitude DECIMAL(11, 8),
    
    -- Operational details
    square_footage INTEGER,
    capacity INTEGER,
    operating_hours VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id),
    
    -- Valid facility types
    CONSTRAINT valid_facility_type CHECK (facility_type IS NULL OR facility_type IN (
        'HEADQUARTERS',        -- Main corporate office
        'BRANCH_OFFICE',       -- Branch/regional office
        'DATA_CENTER',         -- Data center facility
        'WAREHOUSE',           -- Storage/distribution warehouse
        'MANUFACTURING',       -- Manufacturing plant
        'LABORATORY',          -- Research/testing laboratory
        'HOSPITAL',            -- Healthcare facility
        'RETAIL',              -- Retail location
        'REMOTE_SITE',         -- Remote/field site
        'OTHER'                -- Other facility type
    ))
);

COMMENT ON TABLE facilities IS 'Physical facility locations for enterprise assets (Supporting Requirement 2C.2)';
COMMENT ON COLUMN facilities.facility_id IS 'Unique identifier for the facility';
COMMENT ON COLUMN facilities.facility_code IS 'Short code for the facility (e.g., HQ, DC1, WH-EAST)';
COMMENT ON COLUMN facilities.name IS 'Full name of the facility';
COMMENT ON COLUMN facilities.facility_type IS 'Type classification of the facility';
COMMENT ON COLUMN facilities.gps_latitude IS 'GPS latitude coordinate';
COMMENT ON COLUMN facilities.gps_longitude IS 'GPS longitude coordinate';

-- Indexes for facility lookups
CREATE INDEX idx_facilities_code ON facilities(facility_code);
CREATE INDEX idx_facilities_type ON facilities(facility_type);
CREATE INDEX idx_facilities_active ON facilities(is_active);
CREATE INDEX idx_facilities_city ON facilities(city);
CREATE INDEX idx_facilities_country ON facilities(country);

-- Apply update timestamp trigger to facilities
CREATE TRIGGER trigger_facilities_updated_at
    BEFORE UPDATE ON facilities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- ENTERPRISE_ASSETS TABLE
-- Enterprise-specific asset attributes extending the base assets table
-- Requirements: 2C.1, 2C.2, 2C.3
-- ============================================================================
CREATE TABLE enterprise_assets (
    -- Primary key references base assets table
    -- Requirement 2C.1: asset_id, asset_tag (from base), serial_number, manufacturer, model, asset_class, criticality_level
    asset_id UUID PRIMARY KEY REFERENCES assets(asset_id) ON DELETE CASCADE,
    serial_number VARCHAR(100),
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    asset_class VARCHAR(50),
    criticality_level VARCHAR(20),
    
    -- Location attributes
    -- Requirement 2C.2: facility_id, building, floor, zone, gps_coordinates
    facility_id UUID REFERENCES facilities(facility_id),
    building VARCHAR(100),
    floor VARCHAR(20),
    zone VARCHAR(50),
    gps_latitude DECIMAL(10, 8),
    gps_longitude DECIMAL(11, 8),
    
    -- Operational attributes
    -- Requirement 2C.3: operating_hours, meter_reading, last_calibration_date, next_calibration_due
    operating_hours INTEGER DEFAULT 0,
    meter_reading DECIMAL(15, 2),
    meter_unit VARCHAR(30),
    last_calibration_date DATE,
    next_calibration_due DATE,
    calibration_interval_days INTEGER,
    
    -- Additional operational tracking
    installation_date DATE,
    commissioning_date DATE,
    expected_end_of_life DATE,
    warranty_expiration DATE,
    
    -- Compliance and certification
    certification_number VARCHAR(100),
    certification_expiry DATE,
    regulatory_compliance TEXT[],
    
    -- Parent asset for hierarchical equipment
    parent_asset_id UUID REFERENCES enterprise_assets(asset_id),
    
    -- Metadata
    notes TEXT,
    specifications JSONB,
    
    -- Valid asset classes for enterprise assets
    CONSTRAINT valid_asset_class CHECK (asset_class IS NULL OR asset_class IN (
        'HVAC',                -- Heating, ventilation, air conditioning
        'ELECTRICAL',          -- Electrical systems and equipment
        'PLUMBING',            -- Plumbing systems
        'FIRE_SAFETY',         -- Fire safety equipment
        'SECURITY',            -- Security systems
        'ELEVATOR',            -- Elevators and lifts
        'MEDICAL',             -- Medical equipment
        'MANUFACTURING',       -- Manufacturing machinery
        'LABORATORY',          -- Laboratory equipment
        'TRANSPORTATION',      -- Vehicles and transport equipment
        'COMMUNICATION',       -- Communication systems
        'UTILITY',             -- Utility infrastructure
        'BUILDING',            -- Building structure components
        'GROUNDS',             -- Grounds and landscaping equipment
        'OTHER'                -- Other enterprise assets
    )),
    
    -- Valid criticality levels (Requirement 2C.1)
    CONSTRAINT valid_criticality_level CHECK (criticality_level IS NULL OR criticality_level IN (
        'CRITICAL',            -- Failure causes immediate business impact
        'HIGH',                -- Failure causes significant impact within hours
        'MEDIUM',              -- Failure causes moderate impact within days
        'LOW'                  -- Failure causes minimal impact
    )),
    
    -- Operational constraints
    CONSTRAINT valid_operating_hours CHECK (operating_hours >= 0),
    CONSTRAINT valid_meter_reading CHECK (meter_reading IS NULL OR meter_reading >= 0),
    CONSTRAINT valid_calibration_interval CHECK (calibration_interval_days IS NULL OR calibration_interval_days > 0)
);

COMMENT ON TABLE enterprise_assets IS 'Enterprise-specific asset attributes extending base assets table (Requirements 2C.1, 2C.2, 2C.3)';
COMMENT ON COLUMN enterprise_assets.asset_id IS 'Foreign key to base assets table';
COMMENT ON COLUMN enterprise_assets.serial_number IS 'Manufacturer serial number';
COMMENT ON COLUMN enterprise_assets.manufacturer IS 'Equipment manufacturer name';
COMMENT ON COLUMN enterprise_assets.model IS 'Equipment model name/number';
COMMENT ON COLUMN enterprise_assets.asset_class IS 'Classification of enterprise asset type';
COMMENT ON COLUMN enterprise_assets.criticality_level IS 'Business criticality level (CRITICAL, HIGH, MEDIUM, LOW)';
COMMENT ON COLUMN enterprise_assets.facility_id IS 'Reference to facility where asset is located';
COMMENT ON COLUMN enterprise_assets.zone IS 'Zone or area within the building';
COMMENT ON COLUMN enterprise_assets.gps_latitude IS 'GPS latitude for mobile equipment tracking';
COMMENT ON COLUMN enterprise_assets.gps_longitude IS 'GPS longitude for mobile equipment tracking';
COMMENT ON COLUMN enterprise_assets.operating_hours IS 'Total operating hours for usage-based maintenance';
COMMENT ON COLUMN enterprise_assets.meter_reading IS 'Current meter reading (e.g., mileage, cycles)';
COMMENT ON COLUMN enterprise_assets.meter_unit IS 'Unit of measure for meter reading';
COMMENT ON COLUMN enterprise_assets.last_calibration_date IS 'Date of last calibration';
COMMENT ON COLUMN enterprise_assets.next_calibration_due IS 'Date when next calibration is due';
COMMENT ON COLUMN enterprise_assets.parent_asset_id IS 'Parent asset for hierarchical equipment structures';


-- Indexes for enterprise asset queries
CREATE INDEX idx_ea_serial ON enterprise_assets(serial_number);
CREATE INDEX idx_ea_manufacturer ON enterprise_assets(manufacturer);
CREATE INDEX idx_ea_model ON enterprise_assets(model);
CREATE INDEX idx_ea_asset_class ON enterprise_assets(asset_class);
CREATE INDEX idx_ea_criticality ON enterprise_assets(criticality_level);
CREATE INDEX idx_ea_facility ON enterprise_assets(facility_id);
CREATE INDEX idx_ea_building ON enterprise_assets(building);
CREATE INDEX idx_ea_parent ON enterprise_assets(parent_asset_id);

-- Composite indexes for common queries
CREATE INDEX idx_ea_facility_class ON enterprise_assets(facility_id, asset_class);
CREATE INDEX idx_ea_class_criticality ON enterprise_assets(asset_class, criticality_level);

-- Index for calibration due queries
CREATE INDEX idx_ea_calibration_due ON enterprise_assets(next_calibration_due) 
    WHERE next_calibration_due IS NOT NULL;

-- Index for warranty expiration queries
CREATE INDEX idx_ea_warranty_expiration ON enterprise_assets(warranty_expiration) 
    WHERE warranty_expiration IS NOT NULL;

-- Trigger to update parent asset timestamp
CREATE TRIGGER trigger_ea_update_parent
    AFTER UPDATE ON enterprise_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_parent_asset_timestamp();


-- ============================================================================
-- LINEAR_ASSETS TABLE
-- Assets spanning physical distances (pipes, cables, tracks, etc.)
-- Requirement: 2C.4 (asset_id, start_location, end_location, total_length, 
--              segment_count, linear_unit_of_measure)
-- ============================================================================
CREATE TABLE linear_assets (
    linear_asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES enterprise_assets(asset_id) ON DELETE CASCADE,
    
    -- Requirement 2C.4: Linear asset attributes
    start_location VARCHAR(255),
    end_location VARCHAR(255),
    total_length DECIMAL(15, 2),
    segment_count INTEGER DEFAULT 0,
    linear_unit_of_measure VARCHAR(20) DEFAULT 'METERS',
    
    -- Additional location details
    start_gps_latitude DECIMAL(10, 8),
    start_gps_longitude DECIMAL(11, 8),
    end_gps_latitude DECIMAL(10, 8),
    end_gps_longitude DECIMAL(11, 8),
    
    -- Route/path information
    route_description TEXT,
    route_type VARCHAR(50),
    
    -- Condition tracking
    overall_condition_rating VARCHAR(20),
    last_inspection_date DATE,
    next_inspection_due DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Valid linear units of measure
    CONSTRAINT valid_linear_unit CHECK (linear_unit_of_measure IN (
        'METERS',              -- Metric meters
        'KILOMETERS',          -- Metric kilometers
        'FEET',                -- Imperial feet
        'MILES',               -- Imperial miles
        'YARDS'                -- Imperial yards
    )),
    
    -- Valid route types
    CONSTRAINT valid_route_type CHECK (route_type IS NULL OR route_type IN (
        'PIPELINE',            -- Gas, water, oil pipelines
        'CABLE',               -- Electrical, fiber optic cables
        'TRACK',               -- Rail tracks
        'ROAD',                -- Roads and pathways
        'FENCE',               -- Fencing and barriers
        'CONVEYOR',            -- Conveyor systems
        'DUCT',                -- HVAC ducts
        'OTHER'                -- Other linear asset types
    )),
    
    -- Valid condition ratings
    CONSTRAINT valid_condition_rating CHECK (overall_condition_rating IS NULL OR overall_condition_rating IN (
        'EXCELLENT',           -- Like new condition
        'GOOD',                -- Minor wear, fully functional
        'FAIR',                -- Moderate wear, functional
        'POOR',                -- Significant wear, needs attention
        'CRITICAL'             -- Requires immediate attention
    )),
    
    -- Constraints
    CONSTRAINT valid_total_length CHECK (total_length IS NULL OR total_length > 0),
    CONSTRAINT valid_segment_count CHECK (segment_count >= 0)
);

COMMENT ON TABLE linear_assets IS 'Assets spanning physical distances (Requirement 2C.4)';
COMMENT ON COLUMN linear_assets.linear_asset_id IS 'Unique identifier for the linear asset';
COMMENT ON COLUMN linear_assets.asset_id IS 'Reference to the enterprise asset';
COMMENT ON COLUMN linear_assets.start_location IS 'Description of the starting location';
COMMENT ON COLUMN linear_assets.end_location IS 'Description of the ending location';
COMMENT ON COLUMN linear_assets.total_length IS 'Total length of the linear asset';
COMMENT ON COLUMN linear_assets.segment_count IS 'Number of segments in this linear asset';
COMMENT ON COLUMN linear_assets.linear_unit_of_measure IS 'Unit of measure for length (METERS, FEET, etc.)';
COMMENT ON COLUMN linear_assets.overall_condition_rating IS 'Overall condition rating of the linear asset';

-- Indexes for linear asset queries
CREATE INDEX idx_la_asset ON linear_assets(asset_id);
CREATE INDEX idx_la_route_type ON linear_assets(route_type);
CREATE INDEX idx_la_condition ON linear_assets(overall_condition_rating);
CREATE INDEX idx_la_inspection_due ON linear_assets(next_inspection_due) 
    WHERE next_inspection_due IS NOT NULL;

-- Apply update timestamp trigger
CREATE TRIGGER trigger_la_updated_at
    BEFORE UPDATE ON linear_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- LINEAR_ASSET_SEGMENTS TABLE
-- Segments of linear assets for detailed tracking
-- Requirement: 2C.5 (segment_id, linear_asset_id, sequence_number, start_marker,
--              end_marker, segment_length, condition_rating)
-- ============================================================================
CREATE TABLE linear_asset_segments (
    segment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    linear_asset_id UUID NOT NULL REFERENCES linear_assets(linear_asset_id) ON DELETE CASCADE,
    
    -- Requirement 2C.5: Segment attributes
    sequence_number INTEGER NOT NULL,
    start_marker VARCHAR(100),
    end_marker VARCHAR(100),
    segment_length DECIMAL(15, 2),
    condition_rating VARCHAR(20),
    
    -- Additional segment details
    segment_description TEXT,
    material VARCHAR(100),
    installation_date DATE,
    
    -- GPS coordinates for segment endpoints
    start_gps_latitude DECIMAL(10, 8),
    start_gps_longitude DECIMAL(11, 8),
    end_gps_latitude DECIMAL(10, 8),
    end_gps_longitude DECIMAL(11, 8),
    
    -- Inspection and maintenance tracking
    last_inspection_date DATE,
    last_inspection_notes TEXT,
    next_inspection_due DATE,
    
    -- Defect tracking
    defect_count INTEGER DEFAULT 0,
    has_active_defects BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique sequence per linear asset
    CONSTRAINT unique_segment_sequence UNIQUE (linear_asset_id, sequence_number),
    
    -- Valid condition ratings
    CONSTRAINT valid_segment_condition CHECK (condition_rating IS NULL OR condition_rating IN (
        'EXCELLENT',           -- Like new condition
        'GOOD',                -- Minor wear, fully functional
        'FAIR',                -- Moderate wear, functional
        'POOR',                -- Significant wear, needs attention
        'CRITICAL'             -- Requires immediate attention
    )),
    
    -- Constraints
    CONSTRAINT valid_segment_length CHECK (segment_length IS NULL OR segment_length > 0),
    CONSTRAINT valid_sequence_number CHECK (sequence_number > 0),
    CONSTRAINT valid_defect_count CHECK (defect_count >= 0)
);

COMMENT ON TABLE linear_asset_segments IS 'Segments of linear assets for detailed tracking (Requirement 2C.5)';
COMMENT ON COLUMN linear_asset_segments.segment_id IS 'Unique identifier for the segment';
COMMENT ON COLUMN linear_asset_segments.linear_asset_id IS 'Reference to the parent linear asset';
COMMENT ON COLUMN linear_asset_segments.sequence_number IS 'Order of this segment in the linear asset';
COMMENT ON COLUMN linear_asset_segments.start_marker IS 'Marker/identifier for segment start point';
COMMENT ON COLUMN linear_asset_segments.end_marker IS 'Marker/identifier for segment end point';
COMMENT ON COLUMN linear_asset_segments.segment_length IS 'Length of this segment';
COMMENT ON COLUMN linear_asset_segments.condition_rating IS 'Condition rating for this segment';
COMMENT ON COLUMN linear_asset_segments.material IS 'Material composition of the segment';

-- Indexes for segment queries
CREATE INDEX idx_las_linear_asset ON linear_asset_segments(linear_asset_id);
CREATE INDEX idx_las_sequence ON linear_asset_segments(linear_asset_id, sequence_number);
CREATE INDEX idx_las_condition ON linear_asset_segments(condition_rating);
CREATE INDEX idx_las_inspection_due ON linear_asset_segments(next_inspection_due) 
    WHERE next_inspection_due IS NOT NULL;
CREATE INDEX idx_las_active_defects ON linear_asset_segments(has_active_defects) 
    WHERE has_active_defects = TRUE;

-- Apply update timestamp trigger
CREATE TRIGGER trigger_las_updated_at
    BEFORE UPDATE ON linear_asset_segments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- MAINTENANCE_PLANS TABLE
-- Scheduled maintenance configurations for assets
-- Requirement: 2C.6 (plan_id, asset_id, plan_name, maintenance_type, frequency_days,
--              frequency_hours, last_performed_date, next_due_date)
-- ============================================================================
CREATE TABLE maintenance_plans (
    plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    
    -- Requirement 2C.6: Maintenance plan attributes
    plan_name VARCHAR(255) NOT NULL,
    maintenance_type VARCHAR(50) NOT NULL,
    frequency_days INTEGER,
    frequency_hours INTEGER,
    last_performed_date DATE,
    next_due_date DATE,
    
    -- Additional plan details
    description TEXT,
    procedure_document_id UUID,
    estimated_duration_hours DECIMAL(5, 2),
    estimated_cost DECIMAL(10, 2),
    
    -- Scheduling configuration
    schedule_type VARCHAR(30) DEFAULT 'TIME_BASED',
    lead_time_days INTEGER DEFAULT 7,
    allow_early_execution BOOLEAN DEFAULT TRUE,
    max_overdue_days INTEGER,
    
    -- Assignment
    default_assigned_to UUID REFERENCES users(user_id),
    required_skills TEXT[],
    required_certifications TEXT[],
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    
    -- Tracking
    execution_count INTEGER DEFAULT 0,
    last_work_order_id UUID,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id),
    
    -- Valid maintenance types
    CONSTRAINT valid_maintenance_type CHECK (maintenance_type IN (
        'PREVENTIVE',          -- Scheduled preventive maintenance
        'PREDICTIVE',          -- Condition-based maintenance
        'INSPECTION',          -- Regular inspection
        'CALIBRATION',         -- Calibration activities
        'LUBRICATION',         -- Lubrication tasks
        'CLEANING',            -- Cleaning activities
        'SAFETY_CHECK',        -- Safety inspections
        'REGULATORY',          -- Regulatory compliance checks
        'SEASONAL',            -- Seasonal maintenance
        'OTHER'                -- Other maintenance types
    )),
    
    -- Valid schedule types
    CONSTRAINT valid_schedule_type CHECK (schedule_type IN (
        'TIME_BASED',          -- Based on calendar days
        'USAGE_BASED',         -- Based on operating hours/meter reading
        'CONDITION_BASED',     -- Based on condition monitoring
        'HYBRID'               -- Combination of time and usage
    )),
    
    -- Valid priority levels
    CONSTRAINT valid_mp_priority CHECK (priority IN (
        'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'
    )),
    
    -- Constraints
    CONSTRAINT valid_frequency CHECK (
        (frequency_days IS NOT NULL AND frequency_days > 0) OR
        (frequency_hours IS NOT NULL AND frequency_hours > 0)
    ),
    CONSTRAINT valid_lead_time CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
    CONSTRAINT valid_max_overdue CHECK (max_overdue_days IS NULL OR max_overdue_days >= 0),
    CONSTRAINT valid_execution_count CHECK (execution_count >= 0)
);

COMMENT ON TABLE maintenance_plans IS 'Scheduled maintenance configurations for assets (Requirement 2C.6)';
COMMENT ON COLUMN maintenance_plans.plan_id IS 'Unique identifier for the maintenance plan';
COMMENT ON COLUMN maintenance_plans.asset_id IS 'Reference to the asset this plan applies to';
COMMENT ON COLUMN maintenance_plans.plan_name IS 'Name of the maintenance plan';
COMMENT ON COLUMN maintenance_plans.maintenance_type IS 'Type of maintenance (PREVENTIVE, PREDICTIVE, etc.)';
COMMENT ON COLUMN maintenance_plans.frequency_days IS 'Frequency in calendar days';
COMMENT ON COLUMN maintenance_plans.frequency_hours IS 'Frequency in operating hours';
COMMENT ON COLUMN maintenance_plans.last_performed_date IS 'Date maintenance was last performed';
COMMENT ON COLUMN maintenance_plans.next_due_date IS 'Date when next maintenance is due';
COMMENT ON COLUMN maintenance_plans.schedule_type IS 'How the schedule is calculated';
COMMENT ON COLUMN maintenance_plans.lead_time_days IS 'Days before due date to generate work order';
COMMENT ON COLUMN maintenance_plans.procedure_document_id IS 'Reference to procedure documentation';

-- Indexes for maintenance plan queries
CREATE INDEX idx_mp_asset ON maintenance_plans(asset_id);
CREATE INDEX idx_mp_type ON maintenance_plans(maintenance_type);
CREATE INDEX idx_mp_next_due ON maintenance_plans(next_due_date) WHERE is_active = TRUE;
CREATE INDEX idx_mp_active ON maintenance_plans(is_active);
CREATE INDEX idx_mp_priority ON maintenance_plans(priority);
CREATE INDEX idx_mp_assigned ON maintenance_plans(default_assigned_to);

-- Composite index for due date queries
CREATE INDEX idx_mp_active_due ON maintenance_plans(is_active, next_due_date) 
    WHERE is_active = TRUE AND next_due_date IS NOT NULL;

-- Apply update timestamp trigger
CREATE TRIGGER trigger_mp_updated_at
    BEFORE UPDATE ON maintenance_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- WORK_ORDERS TABLE
-- Maintenance and repair task assignments
-- Requirement: 2C.7 (work_order_id, asset_id, maintenance_plan_id, work_type,
--              priority, status, assigned_to, scheduled_date, completed_date)
-- ============================================================================
CREATE TABLE work_orders (
    work_order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_order_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Requirement 2C.7: Work order attributes
    asset_id UUID NOT NULL REFERENCES assets(asset_id),
    maintenance_plan_id UUID REFERENCES maintenance_plans(plan_id),
    work_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    status VARCHAR(30) DEFAULT 'OPEN',
    assigned_to UUID REFERENCES users(user_id),
    scheduled_date DATE,
    completed_date DATE,
    
    -- Work order details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,
    
    -- Scheduling
    requested_date DATE,
    due_date DATE,
    estimated_duration_hours DECIMAL(5, 2),
    actual_duration_hours DECIMAL(5, 2),
    
    -- Assignment tracking
    assigned_by UUID REFERENCES users(user_id),
    assigned_date TIMESTAMP WITH TIME ZONE,
    started_date TIMESTAMP WITH TIME ZONE,
    
    -- Completion details
    completion_notes TEXT,
    failure_code VARCHAR(50),
    root_cause TEXT,
    corrective_action TEXT,
    
    -- Cost tracking
    estimated_cost DECIMAL(10, 2),
    actual_labor_cost DECIMAL(10, 2),
    actual_parts_cost DECIMAL(10, 2),
    actual_total_cost DECIMAL(10, 2),
    
    -- Location (for field work)
    work_location VARCHAR(255),
    facility_id UUID REFERENCES facilities(facility_id),
    
    -- Approval workflow
    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES users(user_id),
    approved_date TIMESTAMP WITH TIME ZONE,
    
    -- Parent work order (for child tasks)
    parent_work_order_id UUID REFERENCES work_orders(work_order_id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id),
    
    -- Valid work types
    CONSTRAINT valid_work_type CHECK (work_type IN (
        'PREVENTIVE',          -- Scheduled preventive maintenance
        'CORRECTIVE',          -- Repair/fix issues
        'EMERGENCY',           -- Emergency repairs
        'INSPECTION',          -- Inspection tasks
        'CALIBRATION',         -- Calibration work
        'INSTALLATION',        -- New equipment installation
        'MODIFICATION',        -- Equipment modification
        'DECOMMISSION',        -- Equipment decommissioning
        'PROJECT',             -- Project-related work
        'OTHER'                -- Other work types
    )),
    
    -- Valid priority levels
    CONSTRAINT valid_wo_priority CHECK (priority IN (
        'CRITICAL',            -- Immediate attention required
        'HIGH',                -- Complete within 24 hours
        'MEDIUM',              -- Complete within 1 week
        'LOW'                  -- Complete when convenient
    )),
    
    -- Valid work order status
    CONSTRAINT valid_wo_status CHECK (status IN (
        'OPEN',                -- Newly created
        'ASSIGNED',            -- Assigned to technician
        'IN_PROGRESS',         -- Work has started
        'ON_HOLD',             -- Temporarily paused
        'PENDING_PARTS',       -- Waiting for parts
        'PENDING_APPROVAL',    -- Waiting for approval
        'COMPLETED',           -- Work completed
        'CANCELLED',           -- Work order cancelled
        'CLOSED'               -- Administratively closed
    )),
    
    -- Constraints
    CONSTRAINT valid_duration CHECK (
        (estimated_duration_hours IS NULL OR estimated_duration_hours > 0) AND
        (actual_duration_hours IS NULL OR actual_duration_hours >= 0)
    ),
    CONSTRAINT valid_costs CHECK (
        (estimated_cost IS NULL OR estimated_cost >= 0) AND
        (actual_labor_cost IS NULL OR actual_labor_cost >= 0) AND
        (actual_parts_cost IS NULL OR actual_parts_cost >= 0) AND
        (actual_total_cost IS NULL OR actual_total_cost >= 0)
    )
);

COMMENT ON TABLE work_orders IS 'Maintenance and repair task assignments (Requirement 2C.7)';
COMMENT ON COLUMN work_orders.work_order_id IS 'Unique identifier for the work order';
COMMENT ON COLUMN work_orders.work_order_number IS 'Human-readable work order number';
COMMENT ON COLUMN work_orders.asset_id IS 'Reference to the asset being worked on';
COMMENT ON COLUMN work_orders.maintenance_plan_id IS 'Reference to the maintenance plan (if scheduled)';
COMMENT ON COLUMN work_orders.work_type IS 'Type of work (PREVENTIVE, CORRECTIVE, etc.)';
COMMENT ON COLUMN work_orders.priority IS 'Priority level (CRITICAL, HIGH, MEDIUM, LOW)';
COMMENT ON COLUMN work_orders.status IS 'Current status of the work order';
COMMENT ON COLUMN work_orders.assigned_to IS 'User assigned to complete the work';
COMMENT ON COLUMN work_orders.scheduled_date IS 'Scheduled date for the work';
COMMENT ON COLUMN work_orders.completed_date IS 'Date the work was completed';
COMMENT ON COLUMN work_orders.failure_code IS 'Standardized failure code for analysis';
COMMENT ON COLUMN work_orders.parent_work_order_id IS 'Parent work order for hierarchical tasks';


-- Indexes for work order queries
CREATE INDEX idx_wo_number ON work_orders(work_order_number);
CREATE INDEX idx_wo_asset ON work_orders(asset_id);
CREATE INDEX idx_wo_plan ON work_orders(maintenance_plan_id);
CREATE INDEX idx_wo_type ON work_orders(work_type);
CREATE INDEX idx_wo_priority ON work_orders(priority);
CREATE INDEX idx_wo_status ON work_orders(status);
CREATE INDEX idx_wo_assigned ON work_orders(assigned_to);
CREATE INDEX idx_wo_scheduled ON work_orders(scheduled_date);
CREATE INDEX idx_wo_due ON work_orders(due_date);
CREATE INDEX idx_wo_facility ON work_orders(facility_id);
CREATE INDEX idx_wo_parent ON work_orders(parent_work_order_id);

-- Composite indexes for common queries
CREATE INDEX idx_wo_status_priority ON work_orders(status, priority);
CREATE INDEX idx_wo_assigned_status ON work_orders(assigned_to, status);
CREATE INDEX idx_wo_asset_status ON work_orders(asset_id, status);

-- Index for open work orders
CREATE INDEX idx_wo_open ON work_orders(status, scheduled_date) 
    WHERE status NOT IN ('COMPLETED', 'CANCELLED', 'CLOSED');

-- Index for overdue work orders
CREATE INDEX idx_wo_overdue ON work_orders(due_date, status) 
    WHERE status NOT IN ('COMPLETED', 'CANCELLED', 'CLOSED') AND due_date IS NOT NULL;

-- Apply update timestamp trigger
CREATE TRIGGER trigger_wo_updated_at
    BEFORE UPDATE ON work_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- FUNCTION: Generate work order number
-- Generates a unique work order number with format: WO-{YEAR}-{SEQUENCE}
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_work_order_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    v_year INTEGER;
    v_sequence INTEGER;
    v_number VARCHAR(50);
BEGIN
    v_year := EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Get next sequence number for this year
    SELECT COALESCE(MAX(
        CASE 
            WHEN work_order_number ~ ('^WO-' || v_year || '-[0-9]+$')
            THEN CAST(SUBSTRING(work_order_number FROM '[0-9]+$') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM work_orders
    WHERE work_order_number LIKE 'WO-' || v_year || '-%';
    
    -- Generate number with zero-padded sequence
    v_number := 'WO-' || v_year || '-' || LPAD(v_sequence::TEXT, 6, '0');
    
    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_work_order_number IS 'Generates unique work order number with format WO-{YEAR}-{SEQUENCE}';


-- ============================================================================
-- SPARE_PARTS TABLE
-- Parts inventory for maintenance activities
-- Requirement: 2C.8 (part_id, part_number, description, manufacturer,
--              quantity_on_hand, reorder_point, unit_cost, storage_location)
-- ============================================================================
CREATE TABLE spare_parts (
    part_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Requirement 2C.8: Spare part attributes
    part_number VARCHAR(100) UNIQUE NOT NULL,
    description VARCHAR(500),
    manufacturer VARCHAR(255),
    quantity_on_hand INTEGER DEFAULT 0,
    reorder_point INTEGER DEFAULT 0,
    unit_cost DECIMAL(10, 2),
    storage_location VARCHAR(255),
    
    -- Additional part details
    part_name VARCHAR(255),
    category VARCHAR(50),
    uom VARCHAR(20) DEFAULT 'EACH',
    
    -- Inventory management
    quantity_reserved INTEGER DEFAULT 0,
    quantity_available INTEGER GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
    reorder_quantity INTEGER,
    max_quantity INTEGER,
    lead_time_days INTEGER,
    
    -- Supplier information
    preferred_vendor_id UUID REFERENCES vendors(vendor_id),
    vendor_part_number VARCHAR(100),
    last_purchase_price DECIMAL(10, 2),
    last_purchase_date DATE,
    
    -- Tracking
    last_count_date DATE,
    last_count_quantity INTEGER,
    abc_classification VARCHAR(1),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_critical BOOLEAN DEFAULT FALSE,
    obsolete_date DATE,
    replacement_part_id UUID REFERENCES spare_parts(part_id),
    
    -- Specifications
    specifications JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id),
    
    -- Valid categories
    CONSTRAINT valid_part_category CHECK (category IS NULL OR category IN (
        'MECHANICAL',          -- Mechanical parts
        'ELECTRICAL',          -- Electrical components
        'ELECTRONIC',          -- Electronic components
        'HYDRAULIC',           -- Hydraulic parts
        'PNEUMATIC',           -- Pneumatic parts
        'FILTER',              -- Filters
        'BEARING',             -- Bearings
        'SEAL',                -- Seals and gaskets
        'BELT',                -- Belts and chains
        'FASTENER',            -- Fasteners
        'LUBRICANT',           -- Lubricants
        'CONSUMABLE',          -- Consumable items
        'SAFETY',              -- Safety equipment
        'OTHER'                -- Other parts
    )),
    
    -- Valid units of measure
    CONSTRAINT valid_uom CHECK (uom IN (
        'EACH',                -- Individual items
        'BOX',                 -- Box
        'CASE',                -- Case
        'PACK',                -- Pack
        'SET',                 -- Set
        'KIT',                 -- Kit
        'ROLL',                -- Roll
        'GALLON',              -- Gallon
        'LITER',               -- Liter
        'POUND',               -- Pound
        'KILOGRAM',            -- Kilogram
        'FOOT',                -- Foot
        'METER'                -- Meter
    )),
    
    -- Valid ABC classification
    CONSTRAINT valid_abc_class CHECK (abc_classification IS NULL OR abc_classification IN ('A', 'B', 'C')),
    
    -- Quantity constraints
    CONSTRAINT valid_quantities CHECK (
        quantity_on_hand >= 0 AND
        quantity_reserved >= 0 AND
        quantity_reserved <= quantity_on_hand AND
        (reorder_point IS NULL OR reorder_point >= 0) AND
        (reorder_quantity IS NULL OR reorder_quantity > 0) AND
        (max_quantity IS NULL OR max_quantity >= reorder_point)
    ),
    
    -- Cost constraints
    CONSTRAINT valid_part_costs CHECK (
        (unit_cost IS NULL OR unit_cost >= 0) AND
        (last_purchase_price IS NULL OR last_purchase_price >= 0)
    )
);

COMMENT ON TABLE spare_parts IS 'Parts inventory for maintenance activities (Requirement 2C.8)';
COMMENT ON COLUMN spare_parts.part_id IS 'Unique identifier for the spare part';
COMMENT ON COLUMN spare_parts.part_number IS 'Unique part number for identification';
COMMENT ON COLUMN spare_parts.description IS 'Description of the part';
COMMENT ON COLUMN spare_parts.manufacturer IS 'Part manufacturer';
COMMENT ON COLUMN spare_parts.quantity_on_hand IS 'Current quantity in inventory';
COMMENT ON COLUMN spare_parts.reorder_point IS 'Quantity at which to reorder';
COMMENT ON COLUMN spare_parts.unit_cost IS 'Cost per unit';
COMMENT ON COLUMN spare_parts.storage_location IS 'Physical storage location';
COMMENT ON COLUMN spare_parts.quantity_reserved IS 'Quantity reserved for work orders';
COMMENT ON COLUMN spare_parts.quantity_available IS 'Quantity available (on_hand - reserved)';
COMMENT ON COLUMN spare_parts.abc_classification IS 'ABC inventory classification (A=high value, C=low value)';
COMMENT ON COLUMN spare_parts.is_critical IS 'Whether this is a critical spare part';
COMMENT ON COLUMN spare_parts.replacement_part_id IS 'Reference to replacement part if obsolete';

-- Indexes for spare parts queries
CREATE INDEX idx_sp_part_number ON spare_parts(part_number);
CREATE INDEX idx_sp_manufacturer ON spare_parts(manufacturer);
CREATE INDEX idx_sp_category ON spare_parts(category);
CREATE INDEX idx_sp_storage ON spare_parts(storage_location);
CREATE INDEX idx_sp_vendor ON spare_parts(preferred_vendor_id);
CREATE INDEX idx_sp_active ON spare_parts(is_active);
CREATE INDEX idx_sp_critical ON spare_parts(is_critical) WHERE is_critical = TRUE;
CREATE INDEX idx_sp_abc ON spare_parts(abc_classification);

-- Index for reorder alerts
CREATE INDEX idx_sp_reorder ON spare_parts(quantity_on_hand, reorder_point) 
    WHERE is_active = TRUE AND reorder_point IS NOT NULL;

-- Full-text search index
CREATE INDEX idx_sp_search ON spare_parts 
    USING gin(to_tsvector('english', part_number || ' ' || COALESCE(description, '') || ' ' || COALESCE(manufacturer, '')));

-- Apply update timestamp trigger
CREATE TRIGGER trigger_sp_updated_at
    BEFORE UPDATE ON spare_parts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- WORK_ORDER_PARTS TABLE
-- Parts used in work orders
-- Requirement: 2C.9 (work_order_id, part_id, quantity_required, quantity_used,
--              reserved_date)
-- ============================================================================
CREATE TABLE work_order_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Requirement 2C.9: Work order parts attributes
    work_order_id UUID NOT NULL REFERENCES work_orders(work_order_id) ON DELETE CASCADE,
    part_id UUID NOT NULL REFERENCES spare_parts(part_id),
    quantity_required INTEGER NOT NULL,
    quantity_used INTEGER DEFAULT 0,
    reserved_date TIMESTAMP WITH TIME ZONE,
    
    -- Additional tracking
    quantity_reserved INTEGER DEFAULT 0,
    reservation_status VARCHAR(30) DEFAULT 'PENDING',
    
    -- Usage tracking
    issued_date TIMESTAMP WITH TIME ZONE,
    issued_by UUID REFERENCES users(user_id),
    returned_quantity INTEGER DEFAULT 0,
    returned_date TIMESTAMP WITH TIME ZONE,
    
    -- Cost tracking
    unit_cost_at_issue DECIMAL(10, 2),
    total_cost DECIMAL(10, 2),
    
    -- Notes
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique part per work order
    CONSTRAINT unique_wo_part UNIQUE (work_order_id, part_id),
    
    -- Valid reservation status
    CONSTRAINT valid_reservation_status CHECK (reservation_status IN (
        'PENDING',             -- Reservation requested
        'RESERVED',            -- Parts reserved
        'PARTIALLY_RESERVED',  -- Some parts reserved
        'ISSUED',              -- Parts issued to technician
        'USED',                -- Parts used in work
        'RETURNED',            -- Parts returned to inventory
        'CANCELLED'            -- Reservation cancelled
    )),
    
    -- Quantity constraints
    CONSTRAINT valid_wop_quantities CHECK (
        quantity_required > 0 AND
        quantity_used >= 0 AND
        quantity_used <= quantity_required AND
        quantity_reserved >= 0 AND
        quantity_reserved <= quantity_required AND
        returned_quantity >= 0 AND
        returned_quantity <= quantity_used
    )
);

COMMENT ON TABLE work_order_parts IS 'Parts used in work orders (Requirement 2C.9)';
COMMENT ON COLUMN work_order_parts.id IS 'Unique identifier for the work order part record';
COMMENT ON COLUMN work_order_parts.work_order_id IS 'Reference to the work order';
COMMENT ON COLUMN work_order_parts.part_id IS 'Reference to the spare part';
COMMENT ON COLUMN work_order_parts.quantity_required IS 'Quantity of parts required for the work';
COMMENT ON COLUMN work_order_parts.quantity_used IS 'Quantity of parts actually used';
COMMENT ON COLUMN work_order_parts.reserved_date IS 'Date when parts were reserved';
COMMENT ON COLUMN work_order_parts.quantity_reserved IS 'Quantity currently reserved';
COMMENT ON COLUMN work_order_parts.reservation_status IS 'Current status of the part reservation';
COMMENT ON COLUMN work_order_parts.returned_quantity IS 'Quantity returned to inventory';
COMMENT ON COLUMN work_order_parts.unit_cost_at_issue IS 'Unit cost at time of issue';

-- Indexes for work order parts queries
CREATE INDEX idx_wop_work_order ON work_order_parts(work_order_id);
CREATE INDEX idx_wop_part ON work_order_parts(part_id);
CREATE INDEX idx_wop_status ON work_order_parts(reservation_status);
CREATE INDEX idx_wop_reserved_date ON work_order_parts(reserved_date);

-- Composite index for part usage queries
CREATE INDEX idx_wop_part_status ON work_order_parts(part_id, reservation_status);

-- Apply update timestamp trigger
CREATE TRIGGER trigger_wop_updated_at
    BEFORE UPDATE ON work_order_parts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- TRIGGERS: Audit logging for enterprise asset tables
-- ============================================================================

-- Audit trigger for enterprise assets
CREATE OR REPLACE FUNCTION audit_enterprise_asset_changes()
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
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Check for location changes
        IF OLD.facility_id IS DISTINCT FROM NEW.facility_id OR
           OLD.building IS DISTINCT FROM NEW.building OR
           OLD.zone IS DISTINCT FROM NEW.zone THEN
            v_action_type := 'TRANSFER';
        -- Check for calibration updates
        ELSIF OLD.last_calibration_date IS DISTINCT FROM NEW.last_calibration_date THEN
            v_action_type := 'CALIBRATION';
        ELSE
            v_action_type := 'UPDATE';
        END IF;
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
    END IF;
    
    INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
    VALUES (v_user_id, v_action_type, 'ENTERPRISE_ASSET', COALESCE(NEW.asset_id, OLD.asset_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_enterprise_assets
    AFTER INSERT OR UPDATE OR DELETE ON enterprise_assets
    FOR EACH ROW
    EXECUTE FUNCTION audit_enterprise_asset_changes();


-- Audit trigger for work orders
CREATE OR REPLACE FUNCTION audit_work_order_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(NEW.updated_by, NEW.created_by, OLD.updated_by, OLD.created_by);
    
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Check for status changes
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            v_action_type := 'STATUS_CHANGE';
        -- Check for assignment changes
        ELSIF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
            v_action_type := 'ASSIGN';
        ELSE
            v_action_type := 'UPDATE';
        END IF;
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
    END IF;
    
    INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
    VALUES (v_user_id, v_action_type, 'WORK_ORDER', COALESCE(NEW.work_order_id, OLD.work_order_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_work_orders
    AFTER INSERT OR UPDATE OR DELETE ON work_orders
    FOR EACH ROW
    EXECUTE FUNCTION audit_work_order_changes();


-- Audit trigger for maintenance plans
CREATE OR REPLACE FUNCTION audit_maintenance_plan_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(NEW.updated_by, NEW.created_by, OLD.updated_by, OLD.created_by);
    
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
            IF NEW.is_active THEN
                v_action_type := 'ACTIVATE';
            ELSE
                v_action_type := 'DEACTIVATE';
            END IF;
        ELSE
            v_action_type := 'UPDATE';
        END IF;
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
    END IF;
    
    INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
    VALUES (v_user_id, v_action_type, 'MAINTENANCE_PLAN', COALESCE(NEW.plan_id, OLD.plan_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_maintenance_plans
    AFTER INSERT OR UPDATE OR DELETE ON maintenance_plans
    FOR EACH ROW
    EXECUTE FUNCTION audit_maintenance_plan_changes();


-- ============================================================================
-- TRIGGER: Update segment count on linear assets
-- Automatically updates segment_count when segments are added/removed
-- ============================================================================
CREATE OR REPLACE FUNCTION update_linear_asset_segment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE linear_assets
        SET segment_count = (
            SELECT COUNT(*) FROM linear_asset_segments 
            WHERE linear_asset_id = NEW.linear_asset_id
        ),
        updated_at = NOW()
        WHERE linear_asset_id = NEW.linear_asset_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE linear_assets
        SET segment_count = (
            SELECT COUNT(*) FROM linear_asset_segments 
            WHERE linear_asset_id = OLD.linear_asset_id
        ),
        updated_at = NOW()
        WHERE linear_asset_id = OLD.linear_asset_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_segment_count
    AFTER INSERT OR UPDATE OR DELETE ON linear_asset_segments
    FOR EACH ROW
    EXECUTE FUNCTION update_linear_asset_segment_count();


-- ============================================================================
-- TRIGGER: Update spare parts reserved quantity
-- Automatically updates quantity_reserved when work order parts change
-- ============================================================================
CREATE OR REPLACE FUNCTION update_spare_parts_reserved()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Update the spare parts reserved quantity
        UPDATE spare_parts
        SET quantity_reserved = (
            SELECT COALESCE(SUM(quantity_reserved), 0)
            FROM work_order_parts
            WHERE part_id = NEW.part_id
            AND reservation_status IN ('RESERVED', 'PARTIALLY_RESERVED')
        ),
        updated_at = NOW()
        WHERE part_id = NEW.part_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE spare_parts
        SET quantity_reserved = (
            SELECT COALESCE(SUM(quantity_reserved), 0)
            FROM work_order_parts
            WHERE part_id = OLD.part_id
            AND reservation_status IN ('RESERVED', 'PARTIALLY_RESERVED')
        ),
        updated_at = NOW()
        WHERE part_id = OLD.part_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_parts_reserved
    AFTER INSERT OR UPDATE OR DELETE ON work_order_parts
    FOR EACH ROW
    EXECUTE FUNCTION update_spare_parts_reserved();


-- ============================================================================
-- VIEWS: Common queries for enterprise asset management
-- ============================================================================

-- View: Enterprise assets with facility information
CREATE OR REPLACE VIEW v_enterprise_assets AS
SELECT 
    a.asset_id,
    a.asset_tag,
    a.display_name,
    a.status,
    a.substatus,
    ea.serial_number,
    ea.manufacturer,
    ea.model,
    ea.asset_class,
    ea.criticality_level,
    f.name AS facility_name,
    f.facility_code,
    ea.building,
    ea.floor,
    ea.zone,
    ea.operating_hours,
    ea.meter_reading,
    ea.meter_unit,
    ea.last_calibration_date,
    ea.next_calibration_due,
    ea.warranty_expiration,
    a.created_at,
    a.updated_at
FROM assets a
JOIN enterprise_assets ea ON a.asset_id = ea.asset_id
LEFT JOIN facilities f ON ea.facility_id = f.facility_id
WHERE a.asset_type = 'ENTERPRISE';

COMMENT ON VIEW v_enterprise_assets IS 'Denormalized view of enterprise assets with facility information';


-- View: Linear assets with segment summary
CREATE OR REPLACE VIEW v_linear_assets AS
SELECT 
    a.asset_id,
    a.asset_tag,
    a.display_name,
    a.status,
    ea.manufacturer,
    ea.model,
    ea.asset_class,
    la.linear_asset_id,
    la.start_location,
    la.end_location,
    la.total_length,
    la.linear_unit_of_measure,
    la.segment_count,
    la.route_type,
    la.overall_condition_rating,
    la.last_inspection_date,
    la.next_inspection_due,
    f.name AS facility_name
FROM assets a
JOIN enterprise_assets ea ON a.asset_id = ea.asset_id
JOIN linear_assets la ON ea.asset_id = la.asset_id
LEFT JOIN facilities f ON ea.facility_id = f.facility_id
WHERE a.asset_type = 'ENTERPRISE';

COMMENT ON VIEW v_linear_assets IS 'View of linear assets with segment summary';


-- View: Maintenance plans due soon
CREATE OR REPLACE VIEW v_maintenance_due AS
SELECT 
    mp.plan_id,
    mp.plan_name,
    mp.maintenance_type,
    mp.next_due_date,
    mp.next_due_date - CURRENT_DATE AS days_until_due,
    mp.priority,
    mp.frequency_days,
    mp.frequency_hours,
    a.asset_id,
    a.asset_tag,
    a.display_name AS asset_name,
    a.status AS asset_status,
    ea.criticality_level,
    f.name AS facility_name,
    u.email AS assigned_to_email
FROM maintenance_plans mp
JOIN assets a ON mp.asset_id = a.asset_id
LEFT JOIN enterprise_assets ea ON a.asset_id = ea.asset_id
LEFT JOIN facilities f ON ea.facility_id = f.facility_id
LEFT JOIN users u ON mp.default_assigned_to = u.user_id
WHERE mp.is_active = TRUE
  AND mp.next_due_date IS NOT NULL
  AND a.status NOT IN ('RETIRED', 'DISPOSED')
ORDER BY mp.next_due_date ASC;

COMMENT ON VIEW v_maintenance_due IS 'Maintenance plans with upcoming due dates';


-- View: Open work orders
CREATE OR REPLACE VIEW v_open_work_orders AS
SELECT 
    wo.work_order_id,
    wo.work_order_number,
    wo.title,
    wo.work_type,
    wo.priority,
    wo.status,
    wo.scheduled_date,
    wo.due_date,
    CASE 
        WHEN wo.due_date < CURRENT_DATE THEN TRUE 
        ELSE FALSE 
    END AS is_overdue,
    wo.due_date - CURRENT_DATE AS days_until_due,
    a.asset_id,
    a.asset_tag,
    a.display_name AS asset_name,
    ea.criticality_level,
    f.name AS facility_name,
    u_assigned.email AS assigned_to_email,
    u_assigned.first_name || ' ' || u_assigned.last_name AS assigned_to_name,
    wo.created_at
FROM work_orders wo
JOIN assets a ON wo.asset_id = a.asset_id
LEFT JOIN enterprise_assets ea ON a.asset_id = ea.asset_id
LEFT JOIN facilities f ON wo.facility_id = f.facility_id
LEFT JOIN users u_assigned ON wo.assigned_to = u_assigned.user_id
WHERE wo.status NOT IN ('COMPLETED', 'CANCELLED', 'CLOSED')
ORDER BY 
    CASE wo.priority 
        WHEN 'CRITICAL' THEN 1 
        WHEN 'HIGH' THEN 2 
        WHEN 'MEDIUM' THEN 3 
        WHEN 'LOW' THEN 4 
    END,
    wo.due_date NULLS LAST;

COMMENT ON VIEW v_open_work_orders IS 'Open work orders sorted by priority and due date';


-- View: Spare parts needing reorder
CREATE OR REPLACE VIEW v_parts_reorder_needed AS
SELECT 
    sp.part_id,
    sp.part_number,
    sp.part_name,
    sp.description,
    sp.manufacturer,
    sp.category,
    sp.quantity_on_hand,
    sp.quantity_reserved,
    sp.quantity_available,
    sp.reorder_point,
    sp.reorder_quantity,
    sp.unit_cost,
    sp.storage_location,
    sp.is_critical,
    sp.abc_classification,
    v.vendor_name AS preferred_vendor,
    sp.lead_time_days
FROM spare_parts sp
LEFT JOIN vendors v ON sp.preferred_vendor_id = v.vendor_id
WHERE sp.is_active = TRUE
  AND sp.reorder_point IS NOT NULL
  AND sp.quantity_on_hand <= sp.reorder_point
ORDER BY 
    sp.is_critical DESC,
    sp.abc_classification ASC NULLS LAST,
    (sp.reorder_point - sp.quantity_on_hand) DESC;

COMMENT ON VIEW v_parts_reorder_needed IS 'Spare parts at or below reorder point';


-- View: Work order parts summary
CREATE OR REPLACE VIEW v_work_order_parts_summary AS
SELECT 
    wo.work_order_id,
    wo.work_order_number,
    wo.title AS work_order_title,
    wo.status AS work_order_status,
    COUNT(wop.id) AS total_parts,
    SUM(wop.quantity_required) AS total_quantity_required,
    SUM(wop.quantity_used) AS total_quantity_used,
    SUM(wop.total_cost) AS total_parts_cost,
    COUNT(CASE WHEN wop.reservation_status = 'PENDING' THEN 1 END) AS pending_reservations,
    COUNT(CASE WHEN wop.reservation_status = 'RESERVED' THEN 1 END) AS reserved_parts,
    COUNT(CASE WHEN wop.reservation_status = 'ISSUED' THEN 1 END) AS issued_parts
FROM work_orders wo
LEFT JOIN work_order_parts wop ON wo.work_order_id = wop.work_order_id
GROUP BY wo.work_order_id, wo.work_order_number, wo.title, wo.status;

COMMENT ON VIEW v_work_order_parts_summary IS 'Summary of parts for each work order';


-- View: Calibration due report
CREATE OR REPLACE VIEW v_calibration_due AS
SELECT 
    a.asset_id,
    a.asset_tag,
    a.display_name,
    a.status,
    ea.serial_number,
    ea.manufacturer,
    ea.model,
    ea.asset_class,
    ea.criticality_level,
    ea.last_calibration_date,
    ea.next_calibration_due,
    ea.next_calibration_due - CURRENT_DATE AS days_until_due,
    ea.calibration_interval_days,
    f.name AS facility_name,
    ea.building,
    ea.zone
FROM assets a
JOIN enterprise_assets ea ON a.asset_id = ea.asset_id
LEFT JOIN facilities f ON ea.facility_id = f.facility_id
WHERE a.asset_type = 'ENTERPRISE'
  AND ea.next_calibration_due IS NOT NULL
  AND a.status NOT IN ('RETIRED', 'DISPOSED')
ORDER BY ea.next_calibration_due ASC;

COMMENT ON VIEW v_calibration_due IS 'Enterprise assets with upcoming calibration due dates';


-- View: Enterprise asset summary by facility
CREATE OR REPLACE VIEW v_enterprise_summary_by_facility AS
SELECT 
    f.facility_id,
    f.name AS facility_name,
    f.facility_code,
    ea.asset_class,
    a.status,
    COUNT(*) AS asset_count,
    COUNT(CASE WHEN ea.criticality_level = 'CRITICAL' THEN 1 END) AS critical_count,
    COUNT(CASE WHEN ea.criticality_level = 'HIGH' THEN 1 END) AS high_count
FROM assets a
JOIN enterprise_assets ea ON a.asset_id = ea.asset_id
LEFT JOIN facilities f ON ea.facility_id = f.facility_id
WHERE a.asset_type = 'ENTERPRISE'
GROUP BY f.facility_id, f.name, f.facility_code, ea.asset_class, a.status;

COMMENT ON VIEW v_enterprise_summary_by_facility IS 'Summary of enterprise assets by facility, class, and status';


-- View: Work order metrics
CREATE OR REPLACE VIEW v_work_order_metrics AS
SELECT 
    DATE_TRUNC('month', wo.created_at) AS month,
    wo.work_type,
    COUNT(*) AS total_work_orders,
    COUNT(CASE WHEN wo.status = 'COMPLETED' THEN 1 END) AS completed_count,
    COUNT(CASE WHEN wo.status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS') THEN 1 END) AS open_count,
    AVG(CASE WHEN wo.completed_date IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (wo.completed_date - wo.created_at)) / 86400 
    END) AS avg_completion_days,
    SUM(wo.actual_total_cost) AS total_cost
FROM work_orders wo
GROUP BY DATE_TRUNC('month', wo.created_at), wo.work_type
ORDER BY month DESC, wo.work_type;

COMMENT ON VIEW v_work_order_metrics IS 'Monthly work order metrics by type';


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
