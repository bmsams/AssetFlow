-- V013__inspection_records_schema.sql
-- Adds inspection workflow persistence used by lifecycle-service receiving handlers.

CREATE TABLE IF NOT EXISTS inspection_records (
    inspection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receiving_line_id UUID NOT NULL REFERENCES receiving_lines(line_id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(asset_id),
    serial_number VARCHAR(255),
    inspection_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    inspected_by UUID REFERENCES users(user_id),
    inspected_by_name VARCHAR(255),
    inspected_date TIMESTAMP WITH TIME ZONE,
    result VARCHAR(10),
    notes TEXT,
    failure_reason TEXT,
    routed_to_return BOOLEAN NOT NULL DEFAULT FALSE,
    return_order_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_inspection_status CHECK (
      inspection_status IN ('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED')
    ),
    CONSTRAINT valid_inspection_result CHECK (
      result IS NULL OR result IN ('PASSED', 'FAILED')
    )
);

CREATE INDEX IF NOT EXISTS idx_inspection_records_receiving_line_id
    ON inspection_records(receiving_line_id);
CREATE INDEX IF NOT EXISTS idx_inspection_records_asset_id
    ON inspection_records(asset_id)
    WHERE asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inspection_records_status
    ON inspection_records(inspection_status);
CREATE INDEX IF NOT EXISTS idx_inspection_records_result
    ON inspection_records(result)
    WHERE result IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inspection_records_created_at
    ON inspection_records(created_at DESC);

CREATE OR REPLACE FUNCTION update_inspection_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_inspection_records_updated_at ON inspection_records;
CREATE TRIGGER trigger_inspection_records_updated_at
    BEFORE UPDATE ON inspection_records
    FOR EACH ROW
    EXECUTE FUNCTION update_inspection_records_updated_at();
