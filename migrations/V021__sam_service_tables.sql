-- ============================================================================
-- V021: SAM-service missing tables
-- Creates tables referenced by sam-service repository code that were
-- not included in earlier migrations.
-- Sources: shadow-it/shadow-it-repository.ts, publisher-pack/publisher-pack-repository.ts,
--          saas-license/saas-license-repository.ts, compliance-report/compliance-report-repository.ts
-- Requirements: 4.9, 4.10
-- ============================================================================

-- ============================================================================
-- 1. known_applications
-- Known/approved SaaS applications for shadow IT detection
-- Source: KnownApplicationRow interface + getKnownApplications/findApplicationByDomain
-- ============================================================================
CREATE TABLE IF NOT EXISTS known_applications (
    application_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    domain_patterns TEXT[] NOT NULL DEFAULT '{}',
    category VARCHAR(30) NOT NULL,
    vendor VARCHAR(255),
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    risk_level VARCHAR(20) NOT NULL DEFAULT 'LOW',
    description TEXT,
    data_classification VARCHAR(50),
    compliance_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    CONSTRAINT valid_ka_category CHECK (category IN (
        'FILE_SHARING', 'COLLABORATION', 'DEVELOPMENT', 'COMMUNICATION',
        'PRODUCTIVITY', 'SOCIAL_MEDIA', 'ENTERTAINMENT', 'SECURITY',
        'ANALYTICS', 'MARKETING', 'FINANCE', 'HR', 'CRM', 'OTHER'
    )),
    CONSTRAINT valid_ka_risk_level CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

CREATE INDEX IF NOT EXISTS idx_known_applications_domain ON known_applications(LOWER(domain));
CREATE INDEX IF NOT EXISTS idx_known_applications_approved ON known_applications(is_approved) WHERE is_approved = TRUE;
CREATE INDEX IF NOT EXISTS idx_known_applications_blocked ON known_applications(is_blocked) WHERE is_blocked = TRUE;

-- ============================================================================
-- 2. shadow_it_detections
-- Shadow IT detection records from network traffic analysis
-- Source: ShadowITDetectionRow interface + upsertDetection/getDetections
-- ============================================================================
CREATE TABLE IF NOT EXISTS shadow_it_detections (
    detection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_name VARCHAR(255) NOT NULL,
    application_domain VARCHAR(255) NOT NULL,
    category VARCHAR(30) NOT NULL,
    risk_level VARCHAR(20) NOT NULL DEFAULT 'LOW',
    users_affected TEXT[] NOT NULL DEFAULT '{}',
    first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_bytes_transferred BIGINT NOT NULL DEFAULT 0,
    access_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'DETECTED',
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    known_application_id UUID REFERENCES known_applications(application_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    CONSTRAINT valid_sid_category CHECK (category IN (
        'FILE_SHARING', 'COLLABORATION', 'DEVELOPMENT', 'COMMUNICATION',
        'PRODUCTIVITY', 'SOCIAL_MEDIA', 'ENTERTAINMENT', 'SECURITY',
        'ANALYTICS', 'MARKETING', 'FINANCE', 'HR', 'CRM', 'OTHER'
    )),
    CONSTRAINT valid_sid_risk_level CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT valid_sid_status CHECK (status IN ('DETECTED', 'UNDER_REVIEW', 'APPROVED', 'BLOCKED'))
);

CREATE INDEX IF NOT EXISTS idx_shadow_it_detections_domain ON shadow_it_detections(LOWER(application_domain));
CREATE INDEX IF NOT EXISTS idx_shadow_it_detections_status ON shadow_it_detections(status);
CREATE INDEX IF NOT EXISTS idx_shadow_it_detections_last_seen ON shadow_it_detections(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_shadow_it_detections_risk ON shadow_it_detections(risk_level);

-- ============================================================================
-- 3. shadow_it_alerts
-- Alerts generated from shadow IT detections per user
-- Source: ShadowITAlertRow interface + createAlert/getAlertsByDetectionId
-- ============================================================================
CREATE TABLE IF NOT EXISTS shadow_it_alerts (
    alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    detection_id UUID NOT NULL REFERENCES shadow_it_detections(detection_id) ON DELETE CASCADE,
    application_name VARCHAR(255) NOT NULL,
    application_domain VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL,
    user_email VARCHAR(255),
    risk_level VARCHAR(20) NOT NULL DEFAULT 'LOW',
    access_count INTEGER NOT NULL DEFAULT 0,
    bytes_transferred BIGINT NOT NULL DEFAULT 0,
    first_access_at TIMESTAMPTZ NOT NULL,
    last_access_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'NEW',
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    CONSTRAINT valid_sia_risk_level CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT valid_sia_status CHECK (status IN ('NEW', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED'))
);

CREATE INDEX IF NOT EXISTS idx_shadow_it_alerts_detection ON shadow_it_alerts(detection_id);
CREATE INDEX IF NOT EXISTS idx_shadow_it_alerts_user ON shadow_it_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_shadow_it_alerts_status ON shadow_it_alerts(status);
CREATE INDEX IF NOT EXISTS idx_shadow_it_alerts_created ON shadow_it_alerts(created_at DESC);

-- ============================================================================
-- 4. publisher_packs
-- Publisher-specific license calculation configurations
-- Source: PublisherPackRow interface + getPublisherPackByPublisher
-- ============================================================================
CREATE TABLE IF NOT EXISTS publisher_packs (
    pack_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publisher VARCHAR(255) NOT NULL,
    pack_name VARCHAR(255) NOT NULL,
    pack_version VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_publisher_packs_publisher ON publisher_packs(UPPER(publisher));
CREATE INDEX IF NOT EXISTS idx_publisher_packs_active ON publisher_packs(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 5. publisher_license_rules
-- Vendor-specific license calculation rules within a publisher pack
-- Source: PublisherLicenseRuleRow interface + getLicenseRulesForPack
-- ============================================================================
CREATE TABLE IF NOT EXISTS publisher_license_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id UUID NOT NULL REFERENCES publisher_packs(pack_id) ON DELETE CASCADE,
    product_pattern VARCHAR(255) NOT NULL,
    license_metric VARCHAR(50) NOT NULL,
    calculation_method VARCHAR(50) NOT NULL,
    multiplier NUMERIC(10,4) NOT NULL DEFAULT 1.0,
    min_licenses INTEGER,
    max_licenses INTEGER,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_publisher_license_rules_pack ON publisher_license_rules(pack_id);
CREATE INDEX IF NOT EXISTS idx_publisher_license_rules_active ON publisher_license_rules(pack_id, is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 6. saas_usage_records
-- Per-user usage tracking for SaaS subscriptions
-- Source: UsageRecordRow interface + upsertUsageRecord/getUsageRecordsBySubscription
-- ============================================================================
CREATE TABLE IF NOT EXISTS saas_usage_records (
    usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES saas_subscriptions(subscription_id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    user_email VARCHAR(255),
    last_active_date DATE,
    login_count_30day INTEGER NOT NULL DEFAULT 0,
    feature_usage JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_saas_usage_records_subscription ON saas_usage_records(subscription_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_usage_records_sub_user ON saas_usage_records(subscription_id, user_id);
CREATE INDEX IF NOT EXISTS idx_saas_usage_records_active ON saas_usage_records(last_active_date) WHERE is_active = TRUE;

-- ============================================================================
-- 7. renewal_notifications
-- Subscription renewal notification tracking
-- Source: NotificationRow interface + createRenewalNotification/getPendingNotifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS renewal_notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES saas_subscriptions(subscription_id) ON DELETE CASCADE,
    days_before_renewal INTEGER NOT NULL,
    notification_type VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    sent_at TIMESTAMPTZ,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    CONSTRAINT valid_rn_type CHECK (notification_type IN ('90_DAY', '60_DAY', '30_DAY')),
    CONSTRAINT valid_rn_status CHECK (status IN ('PENDING', 'SENT', 'ACKNOWLEDGED', 'DISMISSED'))
);

CREATE INDEX IF NOT EXISTS idx_renewal_notifications_subscription ON renewal_notifications(subscription_id);
CREATE INDEX IF NOT EXISTS idx_renewal_notifications_status ON renewal_notifications(status) WHERE status = 'PENDING';
CREATE UNIQUE INDEX IF NOT EXISTS idx_renewal_notifications_sub_type ON renewal_notifications(subscription_id, notification_type);

-- ============================================================================
-- 8. license_ownership_evidence
-- Audit-ready evidence linking entitlements to purchase documents
-- Source: EvidenceRow interface + getLicenseOwnershipEvidence
-- ============================================================================
CREATE TABLE IF NOT EXISTS license_ownership_evidence (
    evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entitlement_id UUID NOT NULL REFERENCES entitlements(entitlement_id) ON DELETE CASCADE,
    evidence_type VARCHAR(30) NOT NULL,
    document_number VARCHAR(255) NOT NULL,
    document_date DATE NOT NULL,
    vendor_id UUID REFERENCES vendors(vendor_id),
    description TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_cost NUMERIC(12,2),
    total_cost NUMERIC(12,2),
    document_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    CONSTRAINT valid_loe_type CHECK (evidence_type IN ('PURCHASE_ORDER', 'CONTRACT', 'INVOICE', 'LICENSE_KEY'))
);

CREATE INDEX IF NOT EXISTS idx_license_ownership_evidence_entitlement ON license_ownership_evidence(entitlement_id);
CREATE INDEX IF NOT EXISTS idx_license_ownership_evidence_type ON license_ownership_evidence(evidence_type);
CREATE INDEX IF NOT EXISTS idx_license_ownership_evidence_vendor ON license_ownership_evidence(vendor_id);
