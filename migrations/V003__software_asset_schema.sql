-- ============================================================================
-- V003: Software Asset Schema Migration
-- Asset Management System - Software Asset Tables
-- 
-- This migration creates the software asset management tables:
-- - software_products: Catalog of known software products
-- - entitlements: Software licenses owned by the organization
-- - software_installations: Discovered/deployed software instances
-- - reconciliation_results: License compliance position tracking
-- - saas_subscriptions: SaaS subscription management
-- - reclamation_rules: Rules for identifying unused software
-- - reclamation_candidates: Software identified for license reclamation
--
-- Requirements: 2B.1-2B.9
-- ============================================================================

-- ============================================================================
-- SOFTWARE_PRODUCTS TABLE
-- Catalog of known software products for license management
-- Requirement: 2B.1 (product_id, publisher, product_name, version, edition, product_category, is_saas)
-- ============================================================================
CREATE TABLE software_products (
    product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher VARCHAR(255) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    version VARCHAR(50),
    edition VARCHAR(100),
    product_category VARCHAR(50),
    is_saas BOOLEAN DEFAULT FALSE,
    
    -- Normalization support
    normalization_key VARCHAR(255),
    normalized_publisher VARCHAR(255),
    normalized_product_name VARCHAR(255),
    
    -- Metadata
    description TEXT,
    vendor_url VARCHAR(500),
    support_url VARCHAR(500),
    end_of_life_date DATE,
    end_of_support_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id),
    
    -- Ensure unique product identification
    CONSTRAINT unique_software_product UNIQUE (publisher, product_name, version, edition),
    
    -- Valid product categories
    CONSTRAINT valid_product_category CHECK (product_category IS NULL OR product_category IN (
        'OPERATING_SYSTEM', 'DATABASE', 'MIDDLEWARE', 'DEVELOPMENT_TOOL',
        'OFFICE_PRODUCTIVITY', 'SECURITY', 'BACKUP', 'MONITORING',
        'COLLABORATION', 'ERP', 'CRM', 'ANALYTICS', 'VIRTUALIZATION',
        'NETWORKING', 'STORAGE', 'GRAPHICS', 'CAD', 'OTHER'
    ))
);

COMMENT ON TABLE software_products IS 'Catalog of known software products for license management (Requirement 2B.1)';
COMMENT ON COLUMN software_products.product_id IS 'Unique identifier for the software product';
COMMENT ON COLUMN software_products.publisher IS 'Software publisher/vendor name';
COMMENT ON COLUMN software_products.product_name IS 'Name of the software product';
COMMENT ON COLUMN software_products.version IS 'Version number (e.g., 2023, 15.0, 365)';
COMMENT ON COLUMN software_products.edition IS 'Edition (e.g., Standard, Professional, Enterprise)';
COMMENT ON COLUMN software_products.product_category IS 'Category classification for reporting';
COMMENT ON COLUMN software_products.is_saas IS 'Whether this is a SaaS/cloud-based product';
COMMENT ON COLUMN software_products.normalization_key IS 'Key for matching discovery data to this product';
COMMENT ON COLUMN software_products.normalized_publisher IS 'Canonical publisher name for matching';
COMMENT ON COLUMN software_products.normalized_product_name IS 'Canonical product name for matching';

-- Indexes for software product lookups
CREATE INDEX idx_sw_products_publisher ON software_products(publisher);
CREATE INDEX idx_sw_products_name ON software_products(product_name);
CREATE INDEX idx_sw_products_category ON software_products(product_category);
CREATE INDEX idx_sw_products_is_saas ON software_products(is_saas);
CREATE INDEX idx_sw_products_normalization ON software_products(normalization_key);
CREATE INDEX idx_sw_products_normalized_publisher ON software_products(normalized_publisher);
CREATE INDEX idx_sw_products_normalized_name ON software_products(normalized_product_name);

-- Full-text search index for product discovery
CREATE INDEX idx_sw_products_search ON software_products 
    USING gin(to_tsvector('english', publisher || ' ' || product_name || ' ' || COALESCE(edition, '')));


-- ============================================================================
-- ENTITLEMENTS TABLE
-- Software licenses owned by the organization
-- Requirements: 2B.2, 2B.3, 2B.4 (license details, contract attributes, license metrics)
-- ============================================================================
CREATE TABLE entitlements (
    entitlement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    software_product_id UUID NOT NULL REFERENCES software_products(product_id),
    
    -- Requirement 2B.2: license_type, quantity_purchased, quantity_available, unit_cost
    license_type VARCHAR(50) NOT NULL,
    quantity_purchased INTEGER NOT NULL,
    quantity_available INTEGER NOT NULL,
    unit_cost DECIMAL(10, 2),
    total_cost DECIMAL(14, 2),
    
    -- Requirement 2B.3: Contract attributes
    contract_id UUID REFERENCES contracts(contract_id),
    purchase_order_id UUID REFERENCES purchase_orders(po_id),
    start_date DATE,
    end_date DATE,
    renewal_date DATE,
    maintenance_included BOOLEAN DEFAULT FALSE,
    maintenance_end_date DATE,
    
    -- Requirement 2B.4: License metric attributes
    metric_type VARCHAR(30) NOT NULL,
    metric_value INTEGER,
    
    -- Additional tracking
    license_key VARCHAR(500),
    activation_code VARCHAR(255),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id),
    
    -- Valid license types
    CONSTRAINT valid_license_type CHECK (license_type IN (
        'PERPETUAL',           -- One-time purchase, unlimited use
        'SUBSCRIPTION',        -- Time-limited subscription
        'TERM',                -- Fixed term license
        'MAINTENANCE',         -- Maintenance/support agreement
        'UPGRADE',             -- Upgrade rights
        'ACADEMIC',            -- Educational license
        'VOLUME',              -- Volume license agreement
        'OEM',                 -- Pre-installed with hardware
        'TRIAL',               -- Trial/evaluation license
        'FREEWARE',            -- Free software
        'OPEN_SOURCE'          -- Open source license
    )),
    
    -- Valid metric types (Requirement 2B.4)
    CONSTRAINT valid_metric_type CHECK (metric_type IN (
        'PER_USER',            -- Licensed per named user
        'PER_DEVICE',          -- Licensed per device/machine
        'PER_CORE',            -- Licensed per CPU core
        'PER_PROCESSOR',       -- Licensed per physical processor
        'SUBSCRIPTION',        -- Subscription-based (typically per user/month)
        'SITE',                -- Site-wide license
        'ENTERPRISE',          -- Enterprise-wide license
        'CONCURRENT'           -- Concurrent/floating license
    )),
    
    -- Quantity constraints
    CONSTRAINT valid_quantity_purchased CHECK (quantity_purchased > 0),
    CONSTRAINT valid_quantity_available CHECK (quantity_available >= 0),
    CONSTRAINT quantity_available_lte_purchased CHECK (quantity_available <= quantity_purchased),
    
    -- Date constraints
    CONSTRAINT valid_entitlement_dates CHECK (
        (start_date IS NULL AND end_date IS NULL) OR
        (start_date IS NOT NULL AND (end_date IS NULL OR end_date >= start_date))
    )
);

COMMENT ON TABLE entitlements IS 'Software licenses owned by the organization (Requirements 2B.2, 2B.3, 2B.4)';
COMMENT ON COLUMN entitlements.entitlement_id IS 'Unique identifier for the entitlement';
COMMENT ON COLUMN entitlements.software_product_id IS 'Reference to the software product';
COMMENT ON COLUMN entitlements.license_type IS 'Type of license (perpetual, subscription, etc.)';
COMMENT ON COLUMN entitlements.quantity_purchased IS 'Total number of licenses purchased';
COMMENT ON COLUMN entitlements.quantity_available IS 'Number of licenses currently available for assignment';
COMMENT ON COLUMN entitlements.unit_cost IS 'Cost per license unit';
COMMENT ON COLUMN entitlements.metric_type IS 'License metric type (per_user, per_device, per_core, etc.)';
COMMENT ON COLUMN entitlements.metric_value IS 'Value for the metric (e.g., number of cores for per_core)';
COMMENT ON COLUMN entitlements.contract_id IS 'Reference to associated contract';
COMMENT ON COLUMN entitlements.purchase_order_id IS 'Reference to purchase order';
COMMENT ON COLUMN entitlements.maintenance_included IS 'Whether maintenance/support is included';

-- Indexes for entitlement queries
CREATE INDEX idx_entitlements_product ON entitlements(software_product_id);
CREATE INDEX idx_entitlements_contract ON entitlements(contract_id);
CREATE INDEX idx_entitlements_po ON entitlements(purchase_order_id);
CREATE INDEX idx_entitlements_license_type ON entitlements(license_type);
CREATE INDEX idx_entitlements_metric_type ON entitlements(metric_type);
CREATE INDEX idx_entitlements_end_date ON entitlements(end_date) WHERE end_date IS NOT NULL;
CREATE INDEX idx_entitlements_renewal_date ON entitlements(renewal_date) WHERE renewal_date IS NOT NULL;
CREATE INDEX idx_entitlements_active ON entitlements(is_active);

-- Composite index for compliance queries
CREATE INDEX idx_entitlements_product_active ON entitlements(software_product_id, is_active);


-- ============================================================================
-- SOFTWARE_INSTALLATIONS TABLE
-- Discovered/deployed software instances on hardware assets
-- Requirements: 2B.5, 2B.6 (installation details, discovery attributes)
-- ============================================================================
CREATE TABLE software_installations (
    installation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    software_product_id UUID NOT NULL REFERENCES software_products(product_id),
    hardware_asset_id UUID NOT NULL REFERENCES hardware_assets(asset_id),
    
    -- Requirement 2B.5: installed_date, last_used_date, usage_minutes_30day
    installed_date DATE,
    last_used_date DATE,
    usage_minutes_30day INTEGER DEFAULT 0,
    usage_minutes_90day INTEGER DEFAULT 0,
    
    -- Requirement 2B.6: Discovery attributes
    discovery_source VARCHAR(50),
    discovery_date TIMESTAMP WITH TIME ZONE,
    install_path VARCHAR(500),
    version_detected VARCHAR(50),
    
    -- Additional tracking
    is_authorized BOOLEAN DEFAULT TRUE,
    authorization_date DATE,
    authorized_by UUID REFERENCES users(user_id),
    entitlement_id UUID REFERENCES entitlements(entitlement_id),
    
    -- Installation status
    status VARCHAR(30) DEFAULT 'ACTIVE',
    uninstalled_date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Valid discovery sources
    CONSTRAINT valid_discovery_source CHECK (discovery_source IS NULL OR discovery_source IN (
        'SCCM',                -- Microsoft System Center Configuration Manager
        'JAMF',                -- Jamf Pro (macOS/iOS)
        'TANIUM',              -- Tanium endpoint management
        'INTUNE',              -- Microsoft Intune
        'BIGFIX',              -- HCL BigFix
        'SNOW',                -- Snow Software
        'FLEXERA',             -- Flexera
        'ITSM',                -- External ITSM discovery
        'MANUAL',              -- Manual entry
        'AGENT',               -- Custom agent
        'OTHER'                -- Other discovery source
    )),
    
    -- Valid installation status
    CONSTRAINT valid_installation_status CHECK (status IN (
        'ACTIVE',              -- Currently installed and active
        'INACTIVE',            -- Installed but not in use
        'UNINSTALLED',         -- Has been uninstalled
        'PENDING_REMOVAL',     -- Scheduled for removal
        'UNKNOWN'              -- Status unknown
    )),
    
    -- Usage constraints
    CONSTRAINT valid_usage_minutes CHECK (usage_minutes_30day >= 0 AND usage_minutes_90day >= 0)
);

COMMENT ON TABLE software_installations IS 'Discovered/deployed software instances on hardware assets (Requirements 2B.5, 2B.6)';
COMMENT ON COLUMN software_installations.installation_id IS 'Unique identifier for the installation';
COMMENT ON COLUMN software_installations.software_product_id IS 'Reference to the software product';
COMMENT ON COLUMN software_installations.hardware_asset_id IS 'Reference to the hardware asset where installed';
COMMENT ON COLUMN software_installations.installed_date IS 'Date the software was installed';
COMMENT ON COLUMN software_installations.last_used_date IS 'Date the software was last used';
COMMENT ON COLUMN software_installations.usage_minutes_30day IS 'Usage in minutes over the last 30 days';
COMMENT ON COLUMN software_installations.discovery_source IS 'Source system that discovered this installation';
COMMENT ON COLUMN software_installations.discovery_date IS 'When this installation was discovered';
COMMENT ON COLUMN software_installations.install_path IS 'File system path where software is installed';
COMMENT ON COLUMN software_installations.version_detected IS 'Version detected by discovery';
COMMENT ON COLUMN software_installations.is_authorized IS 'Whether this installation is authorized';
COMMENT ON COLUMN software_installations.entitlement_id IS 'Reference to the entitlement covering this installation';

-- Indexes for software installation queries (as specified in design)
CREATE INDEX idx_install_product ON software_installations(software_product_id);
CREATE INDEX idx_install_asset ON software_installations(hardware_asset_id);
CREATE INDEX idx_install_last_used ON software_installations(last_used_date);

-- Additional indexes for common query patterns
CREATE INDEX idx_install_discovery_source ON software_installations(discovery_source);
CREATE INDEX idx_install_discovery_date ON software_installations(discovery_date);
CREATE INDEX idx_install_status ON software_installations(status);
CREATE INDEX idx_install_authorized ON software_installations(is_authorized);
CREATE INDEX idx_install_entitlement ON software_installations(entitlement_id);

-- Composite indexes for compliance and reclamation queries
CREATE INDEX idx_install_product_status ON software_installations(software_product_id, status);
CREATE INDEX idx_install_asset_status ON software_installations(hardware_asset_id, status);
CREATE INDEX idx_install_product_last_used ON software_installations(software_product_id, last_used_date);

-- Index for finding unused software (reclamation candidates)
CREATE INDEX idx_install_unused ON software_installations(last_used_date, status) 
    WHERE status = 'ACTIVE' AND last_used_date IS NOT NULL;


-- ============================================================================
-- RECONCILIATION_RESULTS TABLE
-- License compliance position tracking
-- Requirement: 2B.7 (product_id, entitlements_owned, installations_found, 
--              compliance_position, over_under_licensed_count, last_reconciled_date)
-- ============================================================================
CREATE TABLE reconciliation_results (
    result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    software_product_id UUID NOT NULL REFERENCES software_products(product_id),
    
    -- Requirement 2B.7: Compliance position data
    entitlements_owned INTEGER NOT NULL,
    installations_found INTEGER NOT NULL,
    compliance_position VARCHAR(20) NOT NULL,
    over_under_licensed_count INTEGER NOT NULL,
    last_reconciled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Additional compliance details
    effective_license_position INTEGER,
    license_demand INTEGER,
    compliance_percentage DECIMAL(5, 2),
    
    -- Reconciliation metadata
    reconciliation_run_id UUID,
    reconciliation_type VARCHAR(30) DEFAULT 'AUTOMATIC',
    notes TEXT,
    
    -- Publisher pack used (if any)
    publisher_pack_id UUID,
    publisher_pack_version VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    
    -- Valid compliance positions
    CONSTRAINT valid_compliance_position CHECK (compliance_position IN (
        'COMPLIANT',           -- Licenses owned >= installations found
        'OVER_LICENSED',       -- More licenses than needed
        'UNDER_LICENSED'       -- Fewer licenses than needed (compliance risk)
    )),
    
    -- Valid reconciliation types
    CONSTRAINT valid_reconciliation_type CHECK (reconciliation_type IN (
        'AUTOMATIC',           -- Scheduled automatic reconciliation
        'MANUAL',              -- Manual reconciliation run
        'ON_DEMAND',           -- User-triggered reconciliation
        'AUDIT_PREP'           -- Pre-audit reconciliation
    ))
);

COMMENT ON TABLE reconciliation_results IS 'License compliance position tracking (Requirement 2B.7)';
COMMENT ON COLUMN reconciliation_results.result_id IS 'Unique identifier for the reconciliation result';
COMMENT ON COLUMN reconciliation_results.software_product_id IS 'Reference to the software product';
COMMENT ON COLUMN reconciliation_results.entitlements_owned IS 'Total entitlements/licenses owned';
COMMENT ON COLUMN reconciliation_results.installations_found IS 'Total installations discovered';
COMMENT ON COLUMN reconciliation_results.compliance_position IS 'Compliance status (compliant, over, under)';
COMMENT ON COLUMN reconciliation_results.over_under_licensed_count IS 'Difference between owned and found (positive=over, negative=under)';
COMMENT ON COLUMN reconciliation_results.last_reconciled_at IS 'When this reconciliation was performed';
COMMENT ON COLUMN reconciliation_results.effective_license_position IS 'Effective license position after applying rules';
COMMENT ON COLUMN reconciliation_results.license_demand IS 'Calculated license demand based on metric type';
COMMENT ON COLUMN reconciliation_results.compliance_percentage IS 'Percentage of compliance (owned/demand * 100)';

-- Indexes for reconciliation queries
CREATE INDEX idx_recon_product ON reconciliation_results(software_product_id);
CREATE INDEX idx_recon_position ON reconciliation_results(compliance_position);
CREATE INDEX idx_recon_date ON reconciliation_results(last_reconciled_at);
CREATE INDEX idx_recon_run ON reconciliation_results(reconciliation_run_id);

-- Composite index for compliance dashboard queries
CREATE INDEX idx_recon_product_date ON reconciliation_results(software_product_id, last_reconciled_at DESC);

-- Index for finding compliance risks
CREATE INDEX idx_recon_under_licensed ON reconciliation_results(compliance_position, over_under_licensed_count) 
    WHERE compliance_position = 'UNDER_LICENSED';


-- ============================================================================
-- SAAS_SUBSCRIPTIONS TABLE
-- SaaS subscription management
-- Requirement: 2B.8 (subscription_id, product_id, vendor_portal_id, total_licenses,
--              assigned_licenses, monthly_cost, renewal_date)
-- ============================================================================
CREATE TABLE saas_subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    software_product_id UUID NOT NULL REFERENCES software_products(product_id),
    
    -- Requirement 2B.8: SaaS subscription attributes
    vendor_portal_id VARCHAR(255),
    total_licenses INTEGER NOT NULL,
    assigned_licenses INTEGER DEFAULT 0,
    monthly_cost DECIMAL(10, 2),
    annual_cost DECIMAL(12, 2),
    renewal_date DATE,
    
    -- Subscription details
    subscription_name VARCHAR(255),
    subscription_tier VARCHAR(100),
    billing_cycle VARCHAR(20) DEFAULT 'MONTHLY',
    contract_id UUID REFERENCES contracts(contract_id),
    
    -- Vendor portal integration
    vendor_portal_url VARCHAR(500),
    api_integration_enabled BOOLEAN DEFAULT FALSE,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(30) DEFAULT 'NOT_SYNCED',
    sync_error_message TEXT,
    
    -- Usage tracking
    active_users INTEGER DEFAULT 0,
    last_login_count_30day INTEGER DEFAULT 0,
    average_usage_minutes_30day INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(30) DEFAULT 'ACTIVE',
    start_date DATE,
    end_date DATE,
    auto_renewal BOOLEAN DEFAULT FALSE,
    cancellation_notice_days INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id),
    
    -- Valid billing cycles
    CONSTRAINT valid_billing_cycle CHECK (billing_cycle IN (
        'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'MULTI_YEAR'
    )),
    
    -- Valid sync status
    CONSTRAINT valid_sync_status CHECK (sync_status IN (
        'NOT_SYNCED',          -- Never synced
        'SYNCED',              -- Successfully synced
        'SYNC_FAILED',         -- Last sync failed
        'SYNCING',             -- Currently syncing
        'SYNC_DISABLED'        -- Sync disabled
    )),
    
    -- Valid subscription status
    CONSTRAINT valid_subscription_status CHECK (status IN (
        'ACTIVE',              -- Active subscription
        'TRIAL',               -- Trial period
        'SUSPENDED',           -- Temporarily suspended
        'CANCELLED',           -- Cancelled
        'EXPIRED',             -- Expired
        'PENDING'              -- Pending activation
    )),
    
    -- License constraints
    CONSTRAINT valid_total_licenses CHECK (total_licenses > 0),
    CONSTRAINT valid_assigned_licenses CHECK (assigned_licenses >= 0),
    CONSTRAINT assigned_lte_total CHECK (assigned_licenses <= total_licenses)
);

COMMENT ON TABLE saas_subscriptions IS 'SaaS subscription management (Requirement 2B.8)';
COMMENT ON COLUMN saas_subscriptions.subscription_id IS 'Unique identifier for the subscription';
COMMENT ON COLUMN saas_subscriptions.software_product_id IS 'Reference to the software product';
COMMENT ON COLUMN saas_subscriptions.vendor_portal_id IS 'Identifier in the vendor portal';
COMMENT ON COLUMN saas_subscriptions.total_licenses IS 'Total licenses in the subscription';
COMMENT ON COLUMN saas_subscriptions.assigned_licenses IS 'Number of licenses currently assigned';
COMMENT ON COLUMN saas_subscriptions.monthly_cost IS 'Monthly subscription cost';
COMMENT ON COLUMN saas_subscriptions.renewal_date IS 'Next renewal date';
COMMENT ON COLUMN saas_subscriptions.last_synced_at IS 'Last time data was synced from vendor portal';
COMMENT ON COLUMN saas_subscriptions.active_users IS 'Number of active users in the subscription';

-- Indexes for SaaS subscription queries
CREATE INDEX idx_saas_product ON saas_subscriptions(software_product_id);
CREATE INDEX idx_saas_vendor_portal ON saas_subscriptions(vendor_portal_id);
CREATE INDEX idx_saas_renewal_date ON saas_subscriptions(renewal_date) WHERE renewal_date IS NOT NULL;
CREATE INDEX idx_saas_status ON saas_subscriptions(status);
CREATE INDEX idx_saas_contract ON saas_subscriptions(contract_id);
CREATE INDEX idx_saas_last_synced ON saas_subscriptions(last_synced_at);

-- Composite index for renewal notifications
CREATE INDEX idx_saas_active_renewal ON saas_subscriptions(status, renewal_date) 
    WHERE status = 'ACTIVE' AND renewal_date IS NOT NULL;

-- Index for finding underutilized subscriptions
CREATE INDEX idx_saas_utilization ON saas_subscriptions(total_licenses, assigned_licenses, status) 
    WHERE status = 'ACTIVE';


-- ============================================================================
-- RECLAMATION_RULES TABLE
-- Rules for identifying unused software for license reclamation
-- Requirement: 2B.9 (Rules for identifying unused software)
-- ============================================================================
CREATE TABLE reclamation_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Rule criteria
    software_product_id UUID REFERENCES software_products(product_id),
    product_category VARCHAR(50),
    publisher VARCHAR(255),
    
    -- Usage thresholds
    days_since_last_use INTEGER NOT NULL,
    min_usage_minutes_30day INTEGER DEFAULT 0,
    min_usage_minutes_90day INTEGER DEFAULT 0,
    
    -- Rule configuration
    priority INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    auto_create_candidates BOOLEAN DEFAULT TRUE,
    require_approval BOOLEAN DEFAULT TRUE,
    
    -- Notification settings
    notify_user BOOLEAN DEFAULT TRUE,
    notify_manager BOOLEAN DEFAULT TRUE,
    notification_days_before_action INTEGER DEFAULT 14,
    
    -- Exclusions
    exclude_departments UUID[],
    exclude_user_roles VARCHAR(100)[],
    exclude_asset_categories VARCHAR(50)[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id),
    
    -- Constraints
    CONSTRAINT valid_days_threshold CHECK (days_since_last_use > 0),
    CONSTRAINT valid_usage_thresholds CHECK (
        min_usage_minutes_30day >= 0 AND min_usage_minutes_90day >= 0
    ),
    CONSTRAINT valid_priority CHECK (priority >= 0),
    CONSTRAINT valid_notification_days CHECK (notification_days_before_action >= 0)
);

COMMENT ON TABLE reclamation_rules IS 'Rules for identifying unused software for license reclamation (Requirement 2B.9)';
COMMENT ON COLUMN reclamation_rules.rule_id IS 'Unique identifier for the rule';
COMMENT ON COLUMN reclamation_rules.rule_name IS 'Human-readable name for the rule';
COMMENT ON COLUMN reclamation_rules.software_product_id IS 'Specific product this rule applies to (NULL for all)';
COMMENT ON COLUMN reclamation_rules.product_category IS 'Product category this rule applies to (NULL for all)';
COMMENT ON COLUMN reclamation_rules.publisher IS 'Publisher this rule applies to (NULL for all)';
COMMENT ON COLUMN reclamation_rules.days_since_last_use IS 'Number of days without use to trigger reclamation';
COMMENT ON COLUMN reclamation_rules.min_usage_minutes_30day IS 'Minimum usage in 30 days below which software is considered unused';
COMMENT ON COLUMN reclamation_rules.auto_create_candidates IS 'Automatically create reclamation candidates when rule matches';
COMMENT ON COLUMN reclamation_rules.require_approval IS 'Whether reclamation requires approval';
COMMENT ON COLUMN reclamation_rules.notification_days_before_action IS 'Days to notify user before taking action';

-- Indexes for reclamation rules
CREATE INDEX idx_reclaim_rules_product ON reclamation_rules(software_product_id);
CREATE INDEX idx_reclaim_rules_category ON reclamation_rules(product_category);
CREATE INDEX idx_reclaim_rules_publisher ON reclamation_rules(publisher);
CREATE INDEX idx_reclaim_rules_active ON reclamation_rules(is_active);
CREATE INDEX idx_reclaim_rules_priority ON reclamation_rules(priority);

-- Insert default reclamation rules
INSERT INTO reclamation_rules (rule_name, description, days_since_last_use, min_usage_minutes_30day, priority) VALUES
    ('Standard 90-Day Unused', 'Software not used in 90 days with less than 60 minutes usage in last 30 days', 90, 60, 100),
    ('Extended 180-Day Unused', 'Software not used in 180 days', 180, 0, 200),
    ('Low Usage 60-Day', 'Software with minimal usage (< 30 min) in last 60 days', 60, 30, 50);


-- ============================================================================
-- RECLAMATION_CANDIDATES TABLE
-- Software identified for license reclamation
-- Requirement: 2B.9 (installation_id, days_since_last_use, reclamation_rule_id, 
--              reclamation_status, workflow_id)
-- ============================================================================
CREATE TABLE reclamation_candidates (
    candidate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id UUID NOT NULL REFERENCES software_installations(installation_id),
    
    -- Requirement 2B.9: Reclamation candidate attributes
    days_since_last_use INTEGER NOT NULL,
    reclamation_rule_id UUID REFERENCES reclamation_rules(rule_id),
    status VARCHAR(30) DEFAULT 'IDENTIFIED',
    workflow_id UUID,
    
    -- Additional tracking
    identified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usage_at_identification INTEGER,
    
    -- User notification tracking
    user_notified_at TIMESTAMP WITH TIME ZONE,
    manager_notified_at TIMESTAMP WITH TIME ZONE,
    notification_count INTEGER DEFAULT 0,
    
    -- Approval workflow
    approval_requested_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(user_id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Action tracking
    action_scheduled_at TIMESTAMP WITH TIME ZONE,
    action_completed_at TIMESTAMP WITH TIME ZONE,
    action_type VARCHAR(30),
    action_result TEXT,
    
    -- License recovery
    license_recovered BOOLEAN DEFAULT FALSE,
    license_recovered_at TIMESTAMP WITH TIME ZONE,
    entitlement_id UUID REFERENCES entitlements(entitlement_id),
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    
    -- Valid reclamation status (Requirement 2B.9)
    CONSTRAINT valid_reclamation_status CHECK (status IN (
        'IDENTIFIED',          -- Candidate identified by rule
        'PENDING_NOTIFICATION', -- Waiting to notify user
        'USER_NOTIFIED',       -- User has been notified
        'PENDING_APPROVAL',    -- Waiting for approval
        'APPROVED',            -- Approved for reclamation
        'REJECTED',            -- Reclamation rejected
        'IN_PROGRESS',         -- Reclamation in progress
        'COMPLETED',           -- Reclamation completed
        'CANCELLED',           -- Reclamation cancelled
        'DEFERRED'             -- Deferred for later review
    )),
    
    -- Valid action types
    CONSTRAINT valid_action_type CHECK (action_type IS NULL OR action_type IN (
        'UNINSTALL',           -- Software uninstalled
        'DISABLE',             -- Software disabled
        'REVOKE_LICENSE',      -- License revoked
        'REASSIGN',            -- License reassigned
        'ARCHIVE',             -- Installation archived
        'MANUAL'               -- Manual action taken
    )),
    
    -- Constraints
    CONSTRAINT valid_days_since_use CHECK (days_since_last_use >= 0)
);

COMMENT ON TABLE reclamation_candidates IS 'Software identified for license reclamation (Requirement 2B.9)';
COMMENT ON COLUMN reclamation_candidates.candidate_id IS 'Unique identifier for the candidate';
COMMENT ON COLUMN reclamation_candidates.installation_id IS 'Reference to the software installation';
COMMENT ON COLUMN reclamation_candidates.days_since_last_use IS 'Days since the software was last used';
COMMENT ON COLUMN reclamation_candidates.reclamation_rule_id IS 'Rule that identified this candidate';
COMMENT ON COLUMN reclamation_candidates.status IS 'Current status in the reclamation workflow';
COMMENT ON COLUMN reclamation_candidates.workflow_id IS 'Reference to the workflow instance';
COMMENT ON COLUMN reclamation_candidates.identified_at IS 'When this candidate was identified';
COMMENT ON COLUMN reclamation_candidates.license_recovered IS 'Whether the license was successfully recovered';

-- Indexes for reclamation candidates
CREATE INDEX idx_reclaim_cand_installation ON reclamation_candidates(installation_id);
CREATE INDEX idx_reclaim_cand_rule ON reclamation_candidates(reclamation_rule_id);
CREATE INDEX idx_reclaim_cand_status ON reclamation_candidates(status);
CREATE INDEX idx_reclaim_cand_workflow ON reclamation_candidates(workflow_id);
CREATE INDEX idx_reclaim_cand_identified ON reclamation_candidates(identified_at);
CREATE INDEX idx_reclaim_cand_entitlement ON reclamation_candidates(entitlement_id);

-- Composite indexes for workflow queries
CREATE INDEX idx_reclaim_cand_status_date ON reclamation_candidates(status, identified_at);
CREATE INDEX idx_reclaim_cand_pending ON reclamation_candidates(status, action_scheduled_at) 
    WHERE status IN ('APPROVED', 'IN_PROGRESS');

-- Index for finding candidates needing notification
CREATE INDEX idx_reclaim_cand_notify ON reclamation_candidates(status, user_notified_at) 
    WHERE status = 'IDENTIFIED' AND user_notified_at IS NULL;


-- ============================================================================
-- TRIGGERS: Update timestamps on modification
-- ============================================================================

-- Apply update timestamp trigger to software_products
CREATE TRIGGER trigger_sw_products_updated_at
    BEFORE UPDATE ON software_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply update timestamp trigger to entitlements
CREATE TRIGGER trigger_entitlements_updated_at
    BEFORE UPDATE ON entitlements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply update timestamp trigger to software_installations
CREATE TRIGGER trigger_sw_installations_updated_at
    BEFORE UPDATE ON software_installations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply update timestamp trigger to saas_subscriptions
CREATE TRIGGER trigger_saas_subscriptions_updated_at
    BEFORE UPDATE ON saas_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply update timestamp trigger to reclamation_rules
CREATE TRIGGER trigger_reclaim_rules_updated_at
    BEFORE UPDATE ON reclamation_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply update timestamp trigger to reclamation_candidates
CREATE TRIGGER trigger_reclaim_cand_updated_at
    BEFORE UPDATE ON reclamation_candidates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TRIGGER: Audit log for software product changes
-- ============================================================================
CREATE OR REPLACE FUNCTION audit_software_product_changes()
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
        v_action_type := 'UPDATE';
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
    VALUES (v_user_id, v_action_type, 'SOFTWARE_PRODUCT', COALESCE(NEW.product_id, OLD.product_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_software_products
    AFTER INSERT OR UPDATE OR DELETE ON software_products
    FOR EACH ROW
    EXECUTE FUNCTION audit_software_product_changes();

-- ============================================================================
-- TRIGGER: Audit log for entitlement changes
-- ============================================================================
CREATE OR REPLACE FUNCTION audit_entitlement_changes()
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
        -- Check for quantity changes
        IF OLD.quantity_available != NEW.quantity_available THEN
            IF NEW.quantity_available < OLD.quantity_available THEN
                v_action_type := 'LICENSE_CONSUMED';
            ELSE
                v_action_type := 'LICENSE_RELEASED';
            END IF;
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
    VALUES (v_user_id, v_action_type, 'ENTITLEMENT', COALESCE(NEW.entitlement_id, OLD.entitlement_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_entitlements
    AFTER INSERT OR UPDATE OR DELETE ON entitlements
    FOR EACH ROW
    EXECUTE FUNCTION audit_entitlement_changes();

-- ============================================================================
-- TRIGGER: Audit log for software installation changes
-- ============================================================================
CREATE OR REPLACE FUNCTION audit_software_installation_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Check for status changes
        IF OLD.status != NEW.status THEN
            v_action_type := 'STATUS_CHANGE';
        ELSIF OLD.is_authorized != NEW.is_authorized THEN
            IF NEW.is_authorized THEN
                v_action_type := 'AUTHORIZE';
            ELSE
                v_action_type := 'UNAUTHORIZE';
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
    VALUES (NEW.authorized_by, v_action_type, 'SOFTWARE_INSTALLATION', COALESCE(NEW.installation_id, OLD.installation_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_software_installations
    AFTER INSERT OR UPDATE OR DELETE ON software_installations
    FOR EACH ROW
    EXECUTE FUNCTION audit_software_installation_changes();

-- ============================================================================
-- TRIGGER: Audit log for reclamation candidate changes
-- ============================================================================
CREATE OR REPLACE FUNCTION audit_reclamation_candidate_changes()
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
        -- Check for status changes
        IF OLD.status != NEW.status THEN
            v_action_type := 'STATUS_CHANGE';
        ELSIF OLD.license_recovered != NEW.license_recovered AND NEW.license_recovered THEN
            v_action_type := 'LICENSE_RECOVERED';
        ELSE
            v_action_type := 'UPDATE';
        END IF;
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        v_user_id := COALESCE(NEW.approved_by, NEW.created_by);
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
        v_user_id := OLD.created_by;
    END IF;
    
    INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
    VALUES (v_user_id, v_action_type, 'RECLAMATION_CANDIDATE', COALESCE(NEW.candidate_id, OLD.candidate_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_reclamation_candidates
    AFTER INSERT OR UPDATE OR DELETE ON reclamation_candidates
    FOR EACH ROW
    EXECUTE FUNCTION audit_reclamation_candidate_changes();


-- ============================================================================
-- VIEWS: Common queries for software asset management
-- ============================================================================

-- ============================================================================
-- VIEW: Software product summary with entitlement counts
-- ============================================================================
CREATE OR REPLACE VIEW v_software_products AS
SELECT 
    sp.product_id,
    sp.publisher,
    sp.product_name,
    sp.version,
    sp.edition,
    sp.product_category,
    sp.is_saas,
    sp.is_active,
    COALESCE(e.total_entitlements, 0) AS total_entitlements,
    COALESCE(e.total_licenses_purchased, 0) AS total_licenses_purchased,
    COALESCE(e.total_licenses_available, 0) AS total_licenses_available,
    COALESCE(i.installation_count, 0) AS installation_count,
    COALESCE(i.active_installation_count, 0) AS active_installation_count,
    sp.created_at,
    sp.updated_at
FROM software_products sp
LEFT JOIN (
    SELECT 
        software_product_id,
        COUNT(*) AS total_entitlements,
        SUM(quantity_purchased) AS total_licenses_purchased,
        SUM(quantity_available) AS total_licenses_available
    FROM entitlements
    WHERE is_active = TRUE
    GROUP BY software_product_id
) e ON sp.product_id = e.software_product_id
LEFT JOIN (
    SELECT 
        software_product_id,
        COUNT(*) AS installation_count,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_installation_count
    FROM software_installations
    GROUP BY software_product_id
) i ON sp.product_id = i.software_product_id;

COMMENT ON VIEW v_software_products IS 'Software products with aggregated entitlement and installation counts';

-- ============================================================================
-- VIEW: Entitlements with product details
-- ============================================================================
CREATE OR REPLACE VIEW v_entitlements AS
SELECT 
    e.entitlement_id,
    e.software_product_id,
    sp.publisher,
    sp.product_name,
    sp.version,
    sp.edition,
    e.license_type,
    e.quantity_purchased,
    e.quantity_available,
    e.quantity_purchased - e.quantity_available AS quantity_consumed,
    e.unit_cost,
    e.total_cost,
    e.metric_type,
    e.metric_value,
    e.contract_id,
    c.contract_number,
    e.start_date,
    e.end_date,
    e.renewal_date,
    e.maintenance_included,
    e.is_active,
    CASE 
        WHEN e.end_date IS NULL THEN NULL
        WHEN e.end_date < CURRENT_DATE THEN 'EXPIRED'
        WHEN e.end_date < CURRENT_DATE + INTERVAL '30 days' THEN 'EXPIRING_SOON'
        WHEN e.end_date < CURRENT_DATE + INTERVAL '90 days' THEN 'EXPIRING'
        ELSE 'ACTIVE'
    END AS expiration_status,
    e.end_date - CURRENT_DATE AS days_until_expiration,
    e.created_at,
    e.updated_at
FROM entitlements e
JOIN software_products sp ON e.software_product_id = sp.product_id
LEFT JOIN contracts c ON e.contract_id = c.contract_id;

COMMENT ON VIEW v_entitlements IS 'Entitlements with product details and expiration status';

-- ============================================================================
-- VIEW: Software installations with product and asset details
-- ============================================================================
CREATE OR REPLACE VIEW v_software_installations AS
SELECT 
    si.installation_id,
    si.software_product_id,
    sp.publisher,
    sp.product_name,
    sp.version AS product_version,
    sp.edition,
    si.hardware_asset_id,
    a.asset_tag,
    a.display_name AS asset_name,
    ha.serial_number,
    u.email AS assigned_to_email,
    u.first_name || ' ' || u.last_name AS assigned_to_name,
    d.name AS department_name,
    si.installed_date,
    si.last_used_date,
    si.usage_minutes_30day,
    si.usage_minutes_90day,
    CURRENT_DATE - si.last_used_date AS days_since_last_use,
    si.discovery_source,
    si.discovery_date,
    si.version_detected,
    si.install_path,
    si.is_authorized,
    si.status,
    si.entitlement_id,
    si.created_at,
    si.updated_at
FROM software_installations si
JOIN software_products sp ON si.software_product_id = sp.product_id
JOIN hardware_assets ha ON si.hardware_asset_id = ha.asset_id
JOIN assets a ON ha.asset_id = a.asset_id
LEFT JOIN users u ON ha.assigned_to = u.user_id
LEFT JOIN departments d ON ha.department_id = d.department_id;

COMMENT ON VIEW v_software_installations IS 'Software installations with product and hardware asset details';

-- ============================================================================
-- VIEW: License compliance summary
-- ============================================================================
CREATE OR REPLACE VIEW v_license_compliance AS
SELECT 
    sp.product_id,
    sp.publisher,
    sp.product_name,
    sp.version,
    sp.edition,
    sp.product_category,
    COALESCE(e.total_licenses, 0) AS licenses_owned,
    COALESCE(i.active_installations, 0) AS installations_found,
    COALESCE(e.total_licenses, 0) - COALESCE(i.active_installations, 0) AS license_balance,
    CASE 
        WHEN COALESCE(e.total_licenses, 0) = 0 AND COALESCE(i.active_installations, 0) > 0 THEN 'UNDER_LICENSED'
        WHEN COALESCE(e.total_licenses, 0) >= COALESCE(i.active_installations, 0) THEN 'COMPLIANT'
        ELSE 'UNDER_LICENSED'
    END AS compliance_position,
    CASE 
        WHEN COALESCE(e.total_licenses, 0) > COALESCE(i.active_installations, 0) THEN 'OVER_LICENSED'
        WHEN COALESCE(e.total_licenses, 0) = COALESCE(i.active_installations, 0) THEN 'OPTIMAL'
        ELSE 'UNDER_LICENSED'
    END AS optimization_status,
    rr.last_reconciled_at,
    rr.compliance_percentage
FROM software_products sp
LEFT JOIN (
    SELECT 
        software_product_id,
        SUM(quantity_purchased) AS total_licenses
    FROM entitlements
    WHERE is_active = TRUE
    GROUP BY software_product_id
) e ON sp.product_id = e.software_product_id
LEFT JOIN (
    SELECT 
        software_product_id,
        COUNT(*) AS active_installations
    FROM software_installations
    WHERE status = 'ACTIVE'
    GROUP BY software_product_id
) i ON sp.product_id = i.software_product_id
LEFT JOIN LATERAL (
    SELECT last_reconciled_at, compliance_percentage
    FROM reconciliation_results
    WHERE software_product_id = sp.product_id
    ORDER BY last_reconciled_at DESC
    LIMIT 1
) rr ON TRUE
WHERE sp.is_active = TRUE;

COMMENT ON VIEW v_license_compliance IS 'License compliance summary showing owned vs installed for each product';

-- ============================================================================
-- VIEW: SaaS subscription utilization
-- ============================================================================
CREATE OR REPLACE VIEW v_saas_utilization AS
SELECT 
    ss.subscription_id,
    ss.software_product_id,
    sp.publisher,
    sp.product_name,
    ss.subscription_name,
    ss.subscription_tier,
    ss.total_licenses,
    ss.assigned_licenses,
    ss.total_licenses - ss.assigned_licenses AS available_licenses,
    ROUND((ss.assigned_licenses::DECIMAL / ss.total_licenses) * 100, 2) AS utilization_percentage,
    ss.active_users,
    ss.monthly_cost,
    ss.annual_cost,
    CASE 
        WHEN ss.assigned_licenses = 0 THEN ss.monthly_cost
        ELSE ROUND(ss.monthly_cost / ss.assigned_licenses, 2)
    END AS cost_per_assigned_license,
    ss.renewal_date,
    ss.renewal_date - CURRENT_DATE AS days_until_renewal,
    ss.status,
    ss.last_synced_at,
    ss.sync_status,
    CASE 
        WHEN (ss.assigned_licenses::DECIMAL / ss.total_licenses) < 0.5 THEN 'LOW'
        WHEN (ss.assigned_licenses::DECIMAL / ss.total_licenses) < 0.8 THEN 'MEDIUM'
        ELSE 'HIGH'
    END AS utilization_level
FROM saas_subscriptions ss
JOIN software_products sp ON ss.software_product_id = sp.product_id
WHERE ss.status = 'ACTIVE';

COMMENT ON VIEW v_saas_utilization IS 'SaaS subscription utilization and cost analysis';

-- ============================================================================
-- VIEW: Reclamation candidates with details
-- ============================================================================
CREATE OR REPLACE VIEW v_reclamation_candidates AS
SELECT 
    rc.candidate_id,
    rc.installation_id,
    rc.days_since_last_use,
    rc.status AS reclamation_status,
    rc.identified_at,
    rc.user_notified_at,
    rc.approved_at,
    rc.license_recovered,
    sp.publisher,
    sp.product_name,
    sp.version,
    sp.edition,
    a.asset_tag,
    a.display_name AS asset_name,
    u.email AS user_email,
    u.first_name || ' ' || u.last_name AS user_name,
    d.name AS department_name,
    rr.rule_name AS reclamation_rule,
    si.usage_minutes_30day,
    si.last_used_date,
    rc.created_at
FROM reclamation_candidates rc
JOIN software_installations si ON rc.installation_id = si.installation_id
JOIN software_products sp ON si.software_product_id = sp.product_id
JOIN hardware_assets ha ON si.hardware_asset_id = ha.asset_id
JOIN assets a ON ha.asset_id = a.asset_id
LEFT JOIN users u ON ha.assigned_to = u.user_id
LEFT JOIN departments d ON ha.department_id = d.department_id
LEFT JOIN reclamation_rules rr ON rc.reclamation_rule_id = rr.rule_id;

COMMENT ON VIEW v_reclamation_candidates IS 'Reclamation candidates with software, asset, and user details';

-- ============================================================================
-- VIEW: Entitlements expiring soon
-- ============================================================================
CREATE OR REPLACE VIEW v_entitlements_expiring AS
SELECT 
    e.entitlement_id,
    sp.publisher,
    sp.product_name,
    sp.version,
    sp.edition,
    e.license_type,
    e.quantity_purchased,
    e.quantity_available,
    e.end_date,
    e.renewal_date,
    e.end_date - CURRENT_DATE AS days_until_expiration,
    c.contract_number,
    v.vendor_name,
    e.unit_cost,
    e.total_cost
FROM entitlements e
JOIN software_products sp ON e.software_product_id = sp.product_id
LEFT JOIN contracts c ON e.contract_id = c.contract_id
LEFT JOIN vendors v ON c.vendor_id = v.vendor_id
WHERE e.is_active = TRUE
  AND e.end_date IS NOT NULL
  AND e.end_date >= CURRENT_DATE
  AND e.end_date <= CURRENT_DATE + INTERVAL '90 days'
ORDER BY e.end_date ASC;

COMMENT ON VIEW v_entitlements_expiring IS 'Entitlements expiring within the next 90 days';

-- ============================================================================
-- VIEW: Unauthorized software installations (Shadow IT)
-- ============================================================================
CREATE OR REPLACE VIEW v_unauthorized_software AS
SELECT 
    si.installation_id,
    sp.publisher,
    sp.product_name,
    sp.version,
    si.version_detected,
    a.asset_tag,
    a.display_name AS asset_name,
    u.email AS user_email,
    u.first_name || ' ' || u.last_name AS user_name,
    d.name AS department_name,
    si.discovery_source,
    si.discovery_date,
    si.installed_date,
    si.last_used_date,
    si.usage_minutes_30day
FROM software_installations si
JOIN software_products sp ON si.software_product_id = sp.product_id
JOIN hardware_assets ha ON si.hardware_asset_id = ha.asset_id
JOIN assets a ON ha.asset_id = a.asset_id
LEFT JOIN users u ON ha.assigned_to = u.user_id
LEFT JOIN departments d ON ha.department_id = d.department_id
WHERE si.is_authorized = FALSE
  AND si.status = 'ACTIVE'
ORDER BY si.discovery_date DESC;

COMMENT ON VIEW v_unauthorized_software IS 'Unauthorized software installations (potential Shadow IT)';

-- ============================================================================
-- FUNCTION: Calculate compliance position for a product
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_compliance_position(p_product_id UUID)
RETURNS TABLE (
    entitlements_owned INTEGER,
    installations_found INTEGER,
    compliance_position VARCHAR(20),
    over_under_count INTEGER
) AS $$
DECLARE
    v_entitlements INTEGER;
    v_installations INTEGER;
BEGIN
    -- Get total entitlements
    SELECT COALESCE(SUM(quantity_purchased), 0)
    INTO v_entitlements
    FROM entitlements
    WHERE software_product_id = p_product_id
      AND is_active = TRUE;
    
    -- Get active installations
    SELECT COUNT(*)
    INTO v_installations
    FROM software_installations
    WHERE software_product_id = p_product_id
      AND status = 'ACTIVE';
    
    -- Return results
    RETURN QUERY SELECT 
        v_entitlements,
        v_installations,
        CASE 
            WHEN v_entitlements >= v_installations THEN 
                CASE WHEN v_entitlements > v_installations THEN 'OVER_LICENSED'::VARCHAR(20)
                     ELSE 'COMPLIANT'::VARCHAR(20)
                END
            ELSE 'UNDER_LICENSED'::VARCHAR(20)
        END,
        v_entitlements - v_installations;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_compliance_position IS 'Calculates the license compliance position for a software product';

-- ============================================================================
-- FUNCTION: Identify reclamation candidates based on rules
-- ============================================================================
CREATE OR REPLACE FUNCTION identify_reclamation_candidates(p_rule_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
    v_rule RECORD;
    v_count INTEGER := 0;
    v_total INTEGER := 0;
BEGIN
    -- Process each active rule (or specific rule if provided)
    FOR v_rule IN 
        SELECT * FROM reclamation_rules 
        WHERE is_active = TRUE 
          AND auto_create_candidates = TRUE
          AND (p_rule_id IS NULL OR rule_id = p_rule_id)
        ORDER BY priority
    LOOP
        -- Insert candidates matching this rule
        INSERT INTO reclamation_candidates (
            installation_id,
            days_since_last_use,
            reclamation_rule_id,
            usage_at_identification,
            status
        )
        SELECT 
            si.installation_id,
            CURRENT_DATE - si.last_used_date,
            v_rule.rule_id,
            si.usage_minutes_30day,
            'IDENTIFIED'
        FROM software_installations si
        JOIN software_products sp ON si.software_product_id = sp.product_id
        WHERE si.status = 'ACTIVE'
          AND si.last_used_date IS NOT NULL
          AND (CURRENT_DATE - si.last_used_date) >= v_rule.days_since_last_use
          AND si.usage_minutes_30day <= v_rule.min_usage_minutes_30day
          -- Apply product filter if specified
          AND (v_rule.software_product_id IS NULL OR si.software_product_id = v_rule.software_product_id)
          -- Apply category filter if specified
          AND (v_rule.product_category IS NULL OR sp.product_category = v_rule.product_category)
          -- Apply publisher filter if specified
          AND (v_rule.publisher IS NULL OR sp.publisher = v_rule.publisher)
          -- Don't create duplicate candidates
          AND NOT EXISTS (
              SELECT 1 FROM reclamation_candidates rc
              WHERE rc.installation_id = si.installation_id
                AND rc.status NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED')
          );
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_total := v_total + v_count;
    END LOOP;
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION identify_reclamation_candidates IS 'Identifies software installations eligible for reclamation based on rules';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
