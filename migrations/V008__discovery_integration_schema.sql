-- ============================================================================
-- V008: Discovery Integration Schema Migration
-- Asset Management System - Discovery Integration Tables
-- 
-- This migration creates the discovery integration tables:
-- - discovery_source_configs: Configuration for discovery sources
-- - discovery_records: Records from discovery sources (SCCM, Jamf, Tanium)
--
-- Requirements: 7.1, 7.2
-- ============================================================================

-- ============================================================================
-- DISCOVERY_SOURCE_CONFIGS TABLE
-- Configuration for discovery data sources
-- Requirement: 7.1 (Ingest asset data from SCCM, Jamf, Tanium)
-- ============================================================================
CREATE TABLE discovery_source_configs (
    source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(20) NOT NULL,
    source_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    auto_create_assets BOOLEAN DEFAULT TRUE,
    match_by_serial_number BOOLEAN DEFAULT TRUE,
    match_by_mac_address BOOLEAN DEFAULT TRUE,
    sync_interval_minutes INTEGER DEFAULT 60,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    api_endpoint VARCHAR(500),
    api_credentials_secret_arn VARCHAR(500),
    additional_config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_source_type CHECK (source_type IN ('SCCM', 'JAMF', 'TANIUM', 'CUSTOM')),
    CONSTRAINT unique_source_config UNIQUE (source_type, source_name),
    CONSTRAINT valid_sync_interval CHECK (sync_interval_minutes > 0)
);

COMMENT ON TABLE discovery_source_configs IS 'Configuration for discovery data sources (Requirement 7.1)';
COMMENT ON COLUMN discovery_source_configs.source_type IS 'Type of discovery source: SCCM, JAMF, TANIUM, CUSTOM';
COMMENT ON COLUMN discovery_source_configs.source_name IS 'Name/identifier for this source instance';
COMMENT ON COLUMN discovery_source_configs.auto_create_assets IS 'Whether to automatically create assets for unmatched records';
COMMENT ON COLUMN discovery_source_configs.match_by_serial_number IS 'Whether to match by serial number';
COMMENT ON COLUMN discovery_source_configs.match_by_mac_address IS 'Whether to match by MAC address';
COMMENT ON COLUMN discovery_source_configs.sync_interval_minutes IS 'How often to sync from this source';
COMMENT ON COLUMN discovery_source_configs.last_sync_at IS 'Timestamp of last successful sync';
COMMENT ON COLUMN discovery_source_configs.api_endpoint IS 'API endpoint URL for the discovery source';
COMMENT ON COLUMN discovery_source_configs.api_credentials_secret_arn IS 'ARN of Secrets Manager secret containing API credentials';

-- Indexes for discovery source configs
CREATE INDEX idx_discovery_source_type ON discovery_source_configs(source_type);
CREATE INDEX idx_discovery_source_active ON discovery_source_configs(is_active) WHERE is_active = TRUE;

-- Insert default source configurations
INSERT INTO discovery_source_configs (source_type, source_name, is_active, auto_create_assets) VALUES
    ('SCCM', 'SCCM', TRUE, TRUE),
    ('JAMF', 'Jamf', TRUE, TRUE),
    ('TANIUM', 'Tanium', TRUE, TRUE);


-- ============================================================================
-- DISCOVERY_RECORDS TABLE
-- Records from discovery sources for asset matching and creation
-- Requirements: 7.1, 7.2
-- ============================================================================
CREATE TABLE discovery_records (
    discovery_record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(20) NOT NULL,
    source_id VARCHAR(255) NOT NULL,
    source_name VARCHAR(255) NOT NULL,
    
    -- Identifiers for matching
    serial_number VARCHAR(100),
    mac_address VARCHAR(50),
    hostname VARCHAR(255),
    
    -- Device information
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    operating_system VARCHAR(255),
    os_version VARCHAR(100),
    ip_address VARCHAR(50),
    
    -- Discovery timestamps
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL,
    discovered_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Processing status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    matched_asset_id UUID REFERENCES assets(asset_id),
    created_asset_id UUID REFERENCES assets(asset_id),
    error_message TEXT,
    
    -- Raw data from source
    raw_data JSONB NOT NULL,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_discovery_source_type CHECK (source_type IN ('SCCM', 'JAMF', 'TANIUM', 'CUSTOM')),
    CONSTRAINT valid_discovery_status CHECK (status IN ('PENDING', 'MATCHED', 'CREATED', 'FAILED', 'IGNORED')),
    CONSTRAINT unique_discovery_record UNIQUE (source_type, source_id)
);

COMMENT ON TABLE discovery_records IS 'Records from discovery sources for asset matching (Requirements 7.1, 7.2)';
COMMENT ON COLUMN discovery_records.source_type IS 'Type of discovery source: SCCM, JAMF, TANIUM, CUSTOM';
COMMENT ON COLUMN discovery_records.source_id IS 'Unique identifier from the source system';
COMMENT ON COLUMN discovery_records.source_name IS 'Name of the source instance';
COMMENT ON COLUMN discovery_records.serial_number IS 'Device serial number for matching';
COMMENT ON COLUMN discovery_records.mac_address IS 'Device MAC address for matching';
COMMENT ON COLUMN discovery_records.hostname IS 'Device hostname/computer name';
COMMENT ON COLUMN discovery_records.last_seen IS 'Last time the device was seen by the discovery source';
COMMENT ON COLUMN discovery_records.discovered_at IS 'When this record was discovered/ingested';
COMMENT ON COLUMN discovery_records.status IS 'Processing status: PENDING, MATCHED, CREATED, FAILED, IGNORED';
COMMENT ON COLUMN discovery_records.matched_asset_id IS 'Asset ID if matched to existing asset';
COMMENT ON COLUMN discovery_records.created_asset_id IS 'Asset ID if new asset was created';
COMMENT ON COLUMN discovery_records.raw_data IS 'Original raw data from the discovery source';

-- Indexes for discovery records
-- Primary lookup indexes for matching
CREATE INDEX idx_discovery_serial ON discovery_records(serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX idx_discovery_mac ON discovery_records(mac_address) WHERE mac_address IS NOT NULL;
CREATE INDEX idx_discovery_hostname ON discovery_records(hostname) WHERE hostname IS NOT NULL;

-- Status and source indexes
CREATE INDEX idx_discovery_status ON discovery_records(status);
CREATE INDEX idx_discovery_source ON discovery_records(source_type, source_name);
CREATE INDEX idx_discovery_source_id ON discovery_records(source_type, source_id);

-- Asset reference indexes
CREATE INDEX idx_discovery_matched_asset ON discovery_records(matched_asset_id) WHERE matched_asset_id IS NOT NULL;
CREATE INDEX idx_discovery_created_asset ON discovery_records(created_asset_id) WHERE created_asset_id IS NOT NULL;

-- Timestamp indexes for queries
CREATE INDEX idx_discovery_last_seen ON discovery_records(last_seen);
CREATE INDEX idx_discovery_discovered_at ON discovery_records(discovered_at);

-- Composite index for pending records processing
CREATE INDEX idx_discovery_pending ON discovery_records(status, discovered_at) WHERE status = 'PENDING';


-- ============================================================================
-- TRIGGER: Update timestamp on discovery_records modification
-- ============================================================================
CREATE OR REPLACE FUNCTION update_discovery_record_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_discovery_record_update
    BEFORE UPDATE ON discovery_records
    FOR EACH ROW
    EXECUTE FUNCTION update_discovery_record_timestamp();


-- ============================================================================
-- TRIGGER: Update timestamp on discovery_source_configs modification
-- ============================================================================
CREATE TRIGGER trigger_discovery_source_config_update
    BEFORE UPDATE ON discovery_source_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_discovery_record_timestamp();


-- ============================================================================
-- VIEW: Discovery records summary by source
-- Dashboard view for discovery statistics
-- ============================================================================
CREATE OR REPLACE VIEW v_discovery_summary AS
SELECT 
    source_type,
    source_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE status = 'MATCHED') as matched_count,
    COUNT(*) FILTER (WHERE status = 'CREATED') as created_count,
    COUNT(*) FILTER (WHERE status = 'FAILED') as failed_count,
    COUNT(*) FILTER (WHERE status = 'PENDING') as pending_count,
    COUNT(*) FILTER (WHERE status = 'IGNORED') as ignored_count,
    MAX(discovered_at) as last_discovery_at,
    MAX(last_seen) as last_seen_at
FROM discovery_records
GROUP BY source_type, source_name;

COMMENT ON VIEW v_discovery_summary IS 'Summary statistics for discovery records by source';


-- ============================================================================
-- VIEW: Unmatched discovery records
-- Shows discovery records that haven't been matched or created
-- ============================================================================
CREATE OR REPLACE VIEW v_discovery_unmatched AS
SELECT 
    dr.discovery_record_id,
    dr.source_type,
    dr.source_name,
    dr.source_id,
    dr.serial_number,
    dr.mac_address,
    dr.hostname,
    dr.manufacturer,
    dr.model,
    dr.operating_system,
    dr.ip_address,
    dr.last_seen,
    dr.discovered_at,
    dr.status,
    dr.error_message
FROM discovery_records dr
WHERE dr.status IN ('PENDING', 'FAILED')
ORDER BY dr.discovered_at DESC;

COMMENT ON VIEW v_discovery_unmatched IS 'Discovery records pending processing or failed';


-- ============================================================================
-- VIEW: Discovery to asset mapping
-- Shows the relationship between discovery records and assets
-- ============================================================================
CREATE OR REPLACE VIEW v_discovery_asset_mapping AS
SELECT 
    dr.discovery_record_id,
    dr.source_type,
    dr.source_name,
    dr.source_id,
    dr.serial_number AS discovery_serial,
    dr.mac_address AS discovery_mac,
    dr.hostname AS discovery_hostname,
    dr.status,
    COALESCE(dr.matched_asset_id, dr.created_asset_id) AS asset_id,
    a.asset_tag,
    a.display_name AS asset_name,
    a.status AS asset_status,
    ha.serial_number AS asset_serial,
    ha.mac_address::TEXT AS asset_mac,
    CASE 
        WHEN dr.matched_asset_id IS NOT NULL THEN 'MATCHED'
        WHEN dr.created_asset_id IS NOT NULL THEN 'CREATED'
        ELSE 'NONE'
    END AS mapping_type,
    dr.last_seen,
    dr.discovered_at
FROM discovery_records dr
LEFT JOIN assets a ON a.asset_id = COALESCE(dr.matched_asset_id, dr.created_asset_id)
LEFT JOIN hardware_assets ha ON ha.asset_id = a.asset_id
ORDER BY dr.discovered_at DESC;

COMMENT ON VIEW v_discovery_asset_mapping IS 'Mapping between discovery records and assets';


-- ============================================================================
-- FUNCTION: Match discovery record to existing asset
-- Attempts to match by serial number first, then MAC address
-- Requirement: 7.2 (Match discovery records to existing assets)
-- ============================================================================
CREATE OR REPLACE FUNCTION match_discovery_to_asset(
    p_serial_number VARCHAR(100),
    p_mac_address VARCHAR(50)
)
RETURNS TABLE (
    asset_id UUID,
    match_type VARCHAR(20),
    confidence INTEGER
) AS $$
BEGIN
    -- Try serial number match first (highest confidence)
    IF p_serial_number IS NOT NULL AND TRIM(p_serial_number) != '' THEN
        RETURN QUERY
        SELECT 
            ha.asset_id,
            'SERIAL_NUMBER'::VARCHAR(20) AS match_type,
            100 AS confidence
        FROM hardware_assets ha
        WHERE UPPER(TRIM(ha.serial_number)) = UPPER(TRIM(p_serial_number))
        LIMIT 1;
        
        IF FOUND THEN
            RETURN;
        END IF;
    END IF;
    
    -- Try MAC address match (slightly lower confidence)
    IF p_mac_address IS NOT NULL AND TRIM(p_mac_address) != '' THEN
        RETURN QUERY
        SELECT 
            ha.asset_id,
            'MAC_ADDRESS'::VARCHAR(20) AS match_type,
            95 AS confidence
        FROM hardware_assets ha
        WHERE UPPER(REPLACE(REPLACE(REPLACE(ha.mac_address::TEXT, ':', ''), '-', ''), '.', '')) = 
              UPPER(REPLACE(REPLACE(REPLACE(p_mac_address, ':', ''), '-', ''), '.', ''))
        LIMIT 1;
        
        IF FOUND THEN
            RETURN;
        END IF;
    END IF;
    
    -- No match found
    RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION match_discovery_to_asset IS 'Matches discovery record to existing asset by serial number or MAC address (Requirement 7.2)';


-- ============================================================================
-- FUNCTION: Get stale assets not seen in discovery
-- Finds assets that haven't been seen by discovery sources recently
-- ============================================================================
CREATE OR REPLACE FUNCTION get_stale_assets(
    p_days_threshold INTEGER DEFAULT 30
)
RETURNS TABLE (
    asset_id UUID,
    asset_tag VARCHAR(50),
    display_name VARCHAR(255),
    serial_number VARCHAR(100),
    mac_address MACADDR,
    last_discovered_at TIMESTAMP WITH TIME ZONE,
    days_since_discovery INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.asset_id,
        a.asset_tag,
        a.display_name,
        ha.serial_number,
        ha.mac_address,
        ha.last_discovered_at,
        EXTRACT(DAY FROM NOW() - ha.last_discovered_at)::INTEGER AS days_since_discovery
    FROM assets a
    JOIN hardware_assets ha ON a.asset_id = ha.asset_id
    WHERE a.asset_type = 'HARDWARE'
      AND a.status IN ('DEPLOYED', 'IN_STOCK')
      AND (
          ha.last_discovered_at IS NULL 
          OR ha.last_discovered_at < NOW() - (p_days_threshold || ' days')::INTERVAL
      )
    ORDER BY ha.last_discovered_at ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_stale_assets IS 'Returns assets not seen by discovery sources within threshold days';


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
