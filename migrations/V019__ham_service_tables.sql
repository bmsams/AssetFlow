-- ============================================================================
-- V019: HAM-service missing tables
-- Creates tables referenced by ham-service disposal repository code that were
-- not included in earlier migrations.
-- Source: ham-service/disposal/disposal-repository.ts
-- ============================================================================

-- ============================================================================
-- 1. disposal_workflows
-- Tracks disposal workflow lifecycle for hardware assets
-- ============================================================================
CREATE TABLE IF NOT EXISTS disposal_workflows (
    workflow_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_number VARCHAR(50) UNIQUE NOT NULL,
    asset_id UUID NOT NULL REFERENCES assets(asset_id),
    status VARCHAR(40) NOT NULL DEFAULT 'INITIATED',
    disposal_method VARCHAR(30),
    initiated_by UUID NOT NULL,
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_wipe_required BOOLEAN NOT NULL DEFAULT TRUE,
    data_wipe_completed_at TIMESTAMPTZ,
    data_wipe_verified_by UUID,
    environmental_check_required BOOLEAN NOT NULL DEFAULT TRUE,
    environmental_check_completed_at TIMESTAMPTZ,
    environmental_check_verified_by UUID,
    pickup_scheduled_at TIMESTAMPTZ,
    pickup_vendor_id UUID,
    completed_at TIMESTAMPTZ,
    completed_by UUID,
    destruction_certificate_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_disposal_workflows_asset_id ON disposal_workflows(asset_id);
CREATE INDEX IF NOT EXISTS idx_disposal_workflows_status ON disposal_workflows(status);
CREATE INDEX IF NOT EXISTS idx_disposal_workflows_initiated_by ON disposal_workflows(initiated_by);

-- ============================================================================
-- 2. disposal_tasks
-- Individual tasks within a disposal workflow
-- ============================================================================
CREATE TABLE IF NOT EXISTS disposal_tasks (
    task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES disposal_workflows(workflow_id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL,
    task_name VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    assigned_to UUID,
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completed_by UUID,
    completion_notes TEXT,
    sequence INTEGER NOT NULL DEFAULT 1,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_disposal_tasks_workflow_id ON disposal_tasks(workflow_id);
CREATE INDEX IF NOT EXISTS idx_disposal_tasks_status ON disposal_tasks(status);

-- ============================================================================
-- 3. destruction_certificates
-- Records of asset destruction for compliance and audit purposes
-- ============================================================================
CREATE TABLE IF NOT EXISTS destruction_certificates (
    certificate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_number VARCHAR(50) UNIQUE NOT NULL,
    asset_id UUID NOT NULL REFERENCES assets(asset_id),
    workflow_id UUID NOT NULL REFERENCES disposal_workflows(workflow_id),
    vendor_id UUID,
    vendor_name VARCHAR(200),
    destruction_date TIMESTAMPTZ NOT NULL,
    destruction_method VARCHAR(30) NOT NULL,
    serial_number VARCHAR(100),
    asset_tag VARCHAR(50),
    document_url TEXT,
    verified_by UUID,
    verified_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_destruction_certificates_asset_id ON destruction_certificates(asset_id);
CREATE INDEX IF NOT EXISTS idx_destruction_certificates_workflow_id ON destruction_certificates(workflow_id);
