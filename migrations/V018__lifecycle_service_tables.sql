-- ============================================================================
-- V018: Lifecycle-service missing tables
-- Creates tables referenced by lifecycle-service repository code that were
-- not included in earlier migrations.
-- ============================================================================

-- ============================================================================
-- 1. approval_workflows
-- Source: lifecycle-service/approval-workflow/approval-workflow-repository.ts
-- ============================================================================
CREATE TABLE IF NOT EXISTS approval_workflows (
    workflow_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL,
    request_type VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    current_level INTEGER NOT NULL DEFAULT 1,
    max_level INTEGER NOT NULL DEFAULT 1,
    current_approver_id UUID,
    initiated_by UUID NOT NULL,
    initiated_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_date TIMESTAMPTZ,
    completed_by UUID,
    final_decision VARCHAR(20),
    decision_reason TEXT,
    estimated_cost DECIMAL(15, 2),
    requester_department VARCHAR(100),
    item_type VARCHAR(50),
    priority VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_approval_workflows_request_id ON approval_workflows(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_status ON approval_workflows(status);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_initiated_by ON approval_workflows(initiated_by);

-- ============================================================================
-- 2. approval_steps
-- Source: lifecycle-service/approval-workflow/approval-workflow-repository.ts
-- ============================================================================
CREATE TABLE IF NOT EXISTS approval_steps (
    step_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES approval_workflows(workflow_id) ON DELETE CASCADE,
    step_level INTEGER NOT NULL,
    approver_id UUID NOT NULL,
    approver_name VARCHAR(200),
    approver_email VARCHAR(255),
    approver_role VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    decision VARCHAR(20),
    decision_date TIMESTAMPTZ,
    decision_reason TEXT,
    delegated_to UUID,
    delegated_date TIMESTAMPTZ,
    delegation_reason TEXT,
    due_date TIMESTAMPTZ,
    reminder_sent_date TIMESTAMPTZ,
    escalated_date TIMESTAMPTZ,
    escalated_to UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_approval_steps_workflow_id ON approval_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_approver_id ON approval_steps(approver_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_status ON approval_steps(status);


-- ============================================================================
-- 3. approval_routing_rules
-- Source: lifecycle-service/approval-workflow/approval-workflow-repository.ts
-- ============================================================================
CREATE TABLE IF NOT EXISTS approval_routing_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(200) NOT NULL,
    rule_type VARCHAR(30) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    conditions JSONB NOT NULL DEFAULT '[]',
    approver_ids UUID[] NOT NULL DEFAULT '{}',
    approver_roles TEXT[] NOT NULL DEFAULT '{}',
    require_all_approvers BOOLEAN NOT NULL DEFAULT FALSE,
    approval_levels INTEGER NOT NULL DEFAULT 1,
    escalation_days INTEGER,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_approval_routing_rules_active ON approval_routing_rules(is_active, priority);

-- ============================================================================
-- 4. requests
-- Source: lifecycle-service/request/request-repository.ts
-- ============================================================================
CREATE TABLE IF NOT EXISTS requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number VARCHAR(50) UNIQUE NOT NULL,
    requester_id UUID NOT NULL,
    requester_name VARCHAR(200),
    requester_email VARCHAR(255),
    requester_department VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    request_type VARCHAR(50) NOT NULL DEFAULT 'STANDARD',
    justification TEXT,
    business_need TEXT,
    delivery_location VARCHAR(200),
    delivery_address TEXT,
    delivery_instructions TEXT,
    requested_delivery_date TIMESTAMPTZ,
    cost_center_id UUID,
    project_code VARCHAR(50),
    approval_workflow_id UUID,
    current_approver_id UUID,
    approval_level INTEGER NOT NULL DEFAULT 0,
    submitted_date TIMESTAMPTZ,
    approved_date TIMESTAMPTZ,
    approved_by UUID,
    rejected_date TIMESTAMPTZ,
    rejected_by UUID,
    rejection_reason TEXT,
    fulfilled_date TIMESTAMPTZ,
    cancelled_date TIMESTAMPTZ,
    cancellation_reason TEXT,
    total_line_count INTEGER NOT NULL DEFAULT 0,
    total_quantity INTEGER NOT NULL DEFAULT 0,
    fulfilled_quantity INTEGER NOT NULL DEFAULT 0,
    estimated_cost DECIMAL(15, 2),
    actual_cost DECIMAL(15, 2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_requests_requester_id ON requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_request_number ON requests(request_number);
CREATE INDEX IF NOT EXISTS idx_requests_current_approver ON requests(current_approver_id) WHERE current_approver_id IS NOT NULL;

-- ============================================================================
-- 5. request_lines
-- Source: lifecycle-service/request/request-repository.ts
-- ============================================================================
CREATE TABLE IF NOT EXISTS request_lines (
    line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES requests(request_id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    catalog_item_id UUID,
    product_id UUID,
    product_type VARCHAR(50),
    product_name VARCHAR(200),
    product_description TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    fulfilled_quantity INTEGER NOT NULL DEFAULT 0,
    unit_price DECIMAL(15, 2),
    total_price DECIMAL(15, 2),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    justification TEXT,
    specifications JSONB,
    asset_ids_assigned UUID[],
    purchase_order_id UUID,
    purchase_order_line_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_request_lines_request_id ON request_lines(request_id);
CREATE INDEX IF NOT EXISTS idx_request_lines_status ON request_lines(status);


-- ============================================================================
-- 6. deployment_records
-- Source: lifecycle-service/deployment/deployment-repository.ts
-- ============================================================================
CREATE TABLE IF NOT EXISTS deployment_records (
    deployment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(asset_id),
    assigned_to_user_id UUID NOT NULL,
    deployed_by UUID NOT NULL,
    deployed_by_name VARCHAR(200),
    deployment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    location VARCHAR(200),
    department VARCHAR(100),
    cost_center VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_deployment_records_asset_id ON deployment_records(asset_id);
CREATE INDEX IF NOT EXISTS idx_deployment_records_user_id ON deployment_records(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_deployment_records_status ON deployment_records(status);

-- ============================================================================
-- 7. discovery_correlations
-- Source: lifecycle-service/deployment/deployment-repository.ts
-- ============================================================================
CREATE TABLE IF NOT EXISTS discovery_correlations (
    correlation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(asset_id),
    discovery_source VARCHAR(50) NOT NULL,
    discovery_record_id VARCHAR(200) NOT NULL,
    serial_number VARCHAR(100),
    mac_address VARCHAR(50),
    hostname VARCHAR(200),
    ip_address VARCHAR(50),
    last_discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    correlated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    correlated_by UUID,
    confidence INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_discovery_correlations_source_record
    ON discovery_correlations(discovery_source, discovery_record_id);
CREATE INDEX IF NOT EXISTS idx_discovery_correlations_asset_id ON discovery_correlations(asset_id);

-- ============================================================================
-- 8. retirement_workflows
-- Source: lifecycle-service/retirement/retirement-repository.ts
-- ============================================================================
CREATE TABLE IF NOT EXISTS retirement_workflows (
    workflow_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_number VARCHAR(50) UNIQUE NOT NULL,
    asset_id UUID NOT NULL REFERENCES assets(asset_id),
    asset_tag VARCHAR(50),
    asset_name VARCHAR(200),
    status VARCHAR(30) NOT NULL DEFAULT 'INITIATED',
    retirement_reason TEXT,
    disposal_method VARCHAR(30),
    initiated_by UUID NOT NULL,
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    data_wipe_required BOOLEAN NOT NULL DEFAULT TRUE,
    data_wipe_completed_at TIMESTAMPTZ,
    data_wipe_verified_by UUID,
    disposal_completed_at TIMESTAMPTZ,
    disposal_completed_by UUID,
    destruction_certificate_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_retirement_workflows_asset_id ON retirement_workflows(asset_id);
CREATE INDEX IF NOT EXISTS idx_retirement_workflows_status ON retirement_workflows(status);

-- ============================================================================
-- 9. retirement_tasks
-- Source: lifecycle-service/retirement/retirement-repository.ts
-- ============================================================================
CREATE TABLE IF NOT EXISTS retirement_tasks (
    task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES retirement_workflows(workflow_id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_retirement_tasks_workflow_id ON retirement_tasks(workflow_id);
CREATE INDEX IF NOT EXISTS idx_retirement_tasks_status ON retirement_tasks(status);


-- ============================================================================
-- 10. catalog_items
-- Source: lifecycle-service/service-catalog/service-catalog-repository.ts
-- ============================================================================
CREATE TABLE IF NOT EXISTS catalog_items (
    catalog_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    item_type VARCHAR(30) NOT NULL DEFAULT 'HARDWARE',
    category_id UUID,
    subcategory_id UUID,
    manufacturer VARCHAR(200),
    model VARCHAR(200),
    sku VARCHAR(100),
    unit_price DECIMAL(15, 2),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    image_url TEXT,
    thumbnail_url TEXT,
    specifications JSONB,
    features TEXT[],
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    is_requestable BOOLEAN NOT NULL DEFAULT TRUE,
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    approval_threshold DECIMAL(15, 2),
    lead_time_days INTEGER,
    max_quantity_per_request INTEGER,
    vendor_id UUID,
    stockroom_id UUID,
    tags TEXT[],
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_catalog_items_category_id ON catalog_items(category_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_item_type ON catalog_items(item_type);
CREATE INDEX IF NOT EXISTS idx_catalog_items_status ON catalog_items(status);
CREATE INDEX IF NOT EXISTS idx_catalog_items_vendor_id ON catalog_items(vendor_id) WHERE vendor_id IS NOT NULL;

-- ============================================================================
-- 11. catalog_categories
-- Source: lifecycle-service/service-catalog/service-catalog-repository.ts
-- ============================================================================
CREATE TABLE IF NOT EXISTS catalog_categories (
    category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    parent_category_id UUID REFERENCES catalog_categories(category_id),
    icon_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_catalog_categories_parent ON catalog_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_catalog_categories_active ON catalog_categories(is_active);

-- Add FK from catalog_items to catalog_categories now that both exist
ALTER TABLE catalog_items
    ADD CONSTRAINT fk_catalog_items_category FOREIGN KEY (category_id) REFERENCES catalog_categories(category_id),
    ADD CONSTRAINT fk_catalog_items_subcategory FOREIGN KEY (subcategory_id) REFERENCES catalog_categories(category_id);

-- ============================================================================
-- 12. catalog_entitlement_rules
-- Source: lifecycle-service/service-catalog/service-catalog-repository.ts
-- ============================================================================
CREATE TABLE IF NOT EXISTS catalog_entitlement_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_item_id UUID REFERENCES catalog_items(catalog_item_id) ON DELETE CASCADE,
    category_id UUID REFERENCES catalog_categories(category_id) ON DELETE CASCADE,
    rule_type VARCHAR(30) NOT NULL,
    rule_value VARCHAR(200) NOT NULL,
    action VARCHAR(30) NOT NULL DEFAULT 'ALLOW',
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_catalog_entitlement_rules_item ON catalog_entitlement_rules(catalog_item_id) WHERE catalog_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_catalog_entitlement_rules_category ON catalog_entitlement_rules(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_catalog_entitlement_rules_active ON catalog_entitlement_rules(is_active);


-- ============================================================================
-- 13. deployment_relationships
-- Source: lifecycle-service/deployment/deployment-repository.ts
-- ============================================================================
CREATE TABLE IF NOT EXISTS deployment_relationships (
    relationship_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL REFERENCES deployment_records(deployment_id) ON DELETE CASCADE,
    source_asset_id UUID NOT NULL REFERENCES assets(asset_id),
    target_asset_id UUID NOT NULL REFERENCES assets(asset_id),
    relation_type VARCHAR(30) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_deployment_relationships_deployment ON deployment_relationships(deployment_id);
CREATE INDEX IF NOT EXISTS idx_deployment_relationships_source ON deployment_relationships(source_asset_id);
CREATE INDEX IF NOT EXISTS idx_deployment_relationships_target ON deployment_relationships(target_asset_id);

-- ============================================================================
-- 14. inventory_reservations
-- Source: lifecycle-service/procurement/procurement-repository.ts
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_reservations (
    reservation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES stockroom_inventory(inventory_id),
    stockroom_id UUID NOT NULL,
    product_id UUID,
    product_type VARCHAR(50) NOT NULL,
    request_id UUID,
    request_line_id UUID,
    quantity_reserved INTEGER NOT NULL,
    reserved_by UUID NOT NULL,
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_inventory ON inventory_reservations(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_request ON inventory_reservations(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_status ON inventory_reservations(status);

-- ============================================================================
-- 15. contract_assets
-- Source: lifecycle-service/contract/contract-repository.ts
-- ============================================================================
CREATE TABLE IF NOT EXISTS contract_assets (
    link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    link_type VARCHAR(50) NOT NULL DEFAULT 'COVERED',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    UNIQUE (contract_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_contract_assets_contract ON contract_assets(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_assets_asset ON contract_assets(asset_id);

-- ============================================================================
-- 16. contract_entitlements
-- Source: lifecycle-service/contract/contract-repository.ts
-- ============================================================================
CREATE TABLE IF NOT EXISTS contract_entitlements (
    link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
    entitlement_id UUID NOT NULL,
    link_type VARCHAR(50) NOT NULL DEFAULT 'LICENSE',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    UNIQUE (contract_id, entitlement_id)
);

CREATE INDEX IF NOT EXISTS idx_contract_entitlements_contract ON contract_entitlements(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_entitlements_entitlement ON contract_entitlements(entitlement_id);
