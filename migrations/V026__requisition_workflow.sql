-- V026: Requisition workflow and requisition->PO linkage
--
-- Adds procurement-owned requisition entities to support:
--   1) Requisition create/approve lifecycle
--   2) Source snapshot (catalog/vendor-model-price)
--   3) Conversion to one-vendor-per-PO grouped drafts
--   4) Full traceability from requisition lines to PO lines

-- ============================================================================
-- 1. Enums
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE requisition_status AS ENUM (
        'DRAFT',
        'PENDING_APPROVAL',
        'APPROVED',
        'REJECTED',
        'PARTIALLY_CONVERTED',
        'CONVERTED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE requisition_line_status AS ENUM (
        'DRAFT',
        'APPROVED',
        'REJECTED',
        'CONVERTED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Ensure legacy enum used by requisition_lines exists.
-- Some environments dropped this type during PO line consolidation.
DO $$ BEGIN
    CREATE TYPE po_product_type AS ENUM (
        'HARDWARE_MODEL',
        'SOFTWARE_PRODUCT',
        'SERVICE',
        'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;

ALTER TYPE po_product_type ADD VALUE IF NOT EXISTS 'HARDWARE_MODEL';
ALTER TYPE po_product_type ADD VALUE IF NOT EXISTS 'SOFTWARE_PRODUCT';
ALTER TYPE po_product_type ADD VALUE IF NOT EXISTS 'SERVICE';
ALTER TYPE po_product_type ADD VALUE IF NOT EXISTS 'OTHER';

-- ============================================================================
-- 2. Requisition headers
-- ============================================================================

CREATE TABLE IF NOT EXISTS requisition_headers (
    requisition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_number VARCHAR(50) NOT NULL UNIQUE,
    status requisition_status NOT NULL DEFAULT 'DRAFT',

    requested_by UUID REFERENCES users(user_id),
    requested_date DATE NOT NULL DEFAULT CURRENT_DATE,
    need_by_date DATE,

    legal_entity VARCHAR(120),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    cost_center_id UUID REFERENCES cost_centers(cost_center_id),
    ship_to_building_id UUID REFERENCES buildings(building_id),
    ship_to_address TEXT,

    notes TEXT,

    approved_by UUID REFERENCES users(user_id),
    approved_date TIMESTAMPTZ,
    rejected_by UUID REFERENCES users(user_id),
    rejected_date TIMESTAMPTZ,
    rejection_reason TEXT,
    converted_date TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_requisition_headers_status
    ON requisition_headers(status);

CREATE INDEX IF NOT EXISTS idx_requisition_headers_requested_by
    ON requisition_headers(requested_by);

CREATE INDEX IF NOT EXISTS idx_requisition_headers_requested_date
    ON requisition_headers(requested_date);

-- ============================================================================
-- 3. Requisition lines
-- ============================================================================

CREATE TABLE IF NOT EXISTS requisition_lines (
    req_line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID NOT NULL REFERENCES requisition_headers(requisition_id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    status requisition_line_status NOT NULL DEFAULT 'DRAFT',

    product_type po_product_type NOT NULL,
    product_id UUID,
    product_description VARCHAR(500) NOT NULL,
    sku VARCHAR(100),

    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(15, 2) NOT NULL CHECK (unit_price >= 0),
    line_total DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',

    vendor_id UUID REFERENCES vendors(vendor_id),
    vendor_model_price_id UUID REFERENCES vendor_model_prices(vendor_model_price_id),
    cost_center_id UUID REFERENCES cost_centers(cost_center_id),

    source_type VARCHAR(30) NOT NULL DEFAULT 'CATALOG',
    source_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
    notes TEXT,

    converted_po_id UUID REFERENCES purchase_orders(po_id),
    converted_po_line_id UUID REFERENCES purchase_order_lines(line_id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id),

    UNIQUE (requisition_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_requisition_lines_requisition
    ON requisition_lines(requisition_id);

CREATE INDEX IF NOT EXISTS idx_requisition_lines_status
    ON requisition_lines(status);

CREATE INDEX IF NOT EXISTS idx_requisition_lines_vendor
    ON requisition_lines(vendor_id)
    WHERE vendor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_requisition_lines_product
    ON requisition_lines(product_id)
    WHERE product_id IS NOT NULL;

-- ============================================================================
-- 4. Requisition accounting distributions
-- ============================================================================

CREATE TABLE IF NOT EXISTS requisition_distributions (
    requisition_distribution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    req_line_id UUID NOT NULL REFERENCES requisition_lines(req_line_id) ON DELETE CASCADE,

    cost_center_id UUID NOT NULL REFERENCES cost_centers(cost_center_id),
    department_id UUID REFERENCES departments(department_id),

    percent_allocation DECIMAL(5, 2) NOT NULL CHECK (percent_allocation > 0 AND percent_allocation <= 100),
    amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_requisition_distributions_line
    ON requisition_distributions(req_line_id);

CREATE INDEX IF NOT EXISTS idx_requisition_distributions_cost_center
    ON requisition_distributions(cost_center_id);

-- ============================================================================
-- 5. Requisition approvals
-- ============================================================================

CREATE TABLE IF NOT EXISTS requisition_approvals (
    requisition_approval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID NOT NULL REFERENCES requisition_headers(requisition_id) ON DELETE CASCADE,
    approval_level INTEGER NOT NULL DEFAULT 1,
    approver_id UUID NOT NULL REFERENCES users(user_id),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    decision_notes TEXT,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requisition_approvals_requisition
    ON requisition_approvals(requisition_id);

CREATE INDEX IF NOT EXISTS idx_requisition_approvals_approver
    ON requisition_approvals(approver_id);

CREATE INDEX IF NOT EXISTS idx_requisition_approvals_status
    ON requisition_approvals(status);

-- ============================================================================
-- 6. Requisition line sourcing options
-- ============================================================================

CREATE TABLE IF NOT EXISTS requisition_line_sources (
    requisition_line_source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    req_line_id UUID NOT NULL REFERENCES requisition_lines(req_line_id) ON DELETE CASCADE,
    source_rank INTEGER NOT NULL DEFAULT 1,

    vendor_id UUID NOT NULL REFERENCES vendors(vendor_id),
    model_id UUID REFERENCES models(model_id),
    vendor_model_price_id UUID REFERENCES vendor_model_prices(vendor_model_price_id),

    unit_price DECIMAL(15, 2) NOT NULL CHECK (unit_price >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    is_selected BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requisition_line_sources_line
    ON requisition_line_sources(req_line_id);

CREATE INDEX IF NOT EXISTS idx_requisition_line_sources_vendor
    ON requisition_line_sources(vendor_id);

CREATE INDEX IF NOT EXISTS idx_requisition_line_sources_selected
    ON requisition_line_sources(req_line_id, is_selected)
    WHERE is_selected = TRUE;

-- ============================================================================
-- 7. Requisition to PO linkage table (line-level lineage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS requisition_po_links (
    requisition_po_link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID NOT NULL REFERENCES requisition_headers(requisition_id) ON DELETE CASCADE,
    req_line_id UUID NOT NULL REFERENCES requisition_lines(req_line_id) ON DELETE CASCADE,
    po_id UUID NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    po_line_id UUID NOT NULL REFERENCES purchase_order_lines(line_id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(vendor_id),
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),

    UNIQUE (req_line_id, po_line_id)
);

CREATE INDEX IF NOT EXISTS idx_requisition_po_links_requisition
    ON requisition_po_links(requisition_id);

CREATE INDEX IF NOT EXISTS idx_requisition_po_links_po
    ON requisition_po_links(po_id);

CREATE INDEX IF NOT EXISTS idx_requisition_po_links_vendor
    ON requisition_po_links(vendor_id);

-- ============================================================================
-- 8. Comments
-- ============================================================================

COMMENT ON TABLE requisition_headers IS 'Procurement requisition headers that can convert into one or more vendor-specific POs';
COMMENT ON TABLE requisition_lines IS 'Procurement requisition lines with resolved sourcing snapshots';
COMMENT ON TABLE requisition_distributions IS 'Line-level accounting allocations for requisitions';
COMMENT ON TABLE requisition_approvals IS 'Approval history/steps for requisitions';
COMMENT ON TABLE requisition_line_sources IS 'Candidate and selected sources (vendor + price) for requisition lines';
COMMENT ON TABLE requisition_po_links IS 'Line-level lineage from requisition lines to generated PO lines';
