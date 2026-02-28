-- V027: Procurement accounting baseline
--
-- Adds line-level accounting objects required for:
--   1) PO distribution allocation
--   2) Budget encumbrance tracking
--   3) Procurement subledger entries and lines
--
-- This is a schema baseline for WS8. Posting orchestration is implemented
-- in service code in follow-up work.

-- ============================================================================
-- 1. PO distributions (line-level accounting split)
-- ============================================================================

CREATE TABLE IF NOT EXISTS po_distributions (
    po_distribution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    po_line_id UUID NOT NULL REFERENCES purchase_order_lines(line_id) ON DELETE CASCADE,
    requisition_distribution_id UUID REFERENCES requisition_distributions(requisition_distribution_id) ON DELETE SET NULL,

    cost_center_id UUID NOT NULL REFERENCES cost_centers(cost_center_id),
    department_id UUID REFERENCES departments(department_id),
    gl_account VARCHAR(50),

    percent_allocation DECIMAL(5, 2) NOT NULL CHECK (percent_allocation > 0 AND percent_allocation <= 100),
    amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    distribution_type VARCHAR(30) NOT NULL DEFAULT 'ENCUMBRANCE'
        CHECK (distribution_type IN ('PRE_ENCUMBRANCE', 'ENCUMBRANCE', 'ACCRUAL', 'LIABILITY', 'RELIEF', 'ADJUSTMENT')),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_po_distributions_po
    ON po_distributions(po_id);

CREATE INDEX IF NOT EXISTS idx_po_distributions_line
    ON po_distributions(po_line_id);

CREATE INDEX IF NOT EXISTS idx_po_distributions_cost_center
    ON po_distributions(cost_center_id);

CREATE INDEX IF NOT EXISTS idx_po_distributions_active
    ON po_distributions(is_active)
    WHERE is_active = TRUE;

-- ============================================================================
-- 2. Budget encumbrances (pre-encumbrance, encumbrance, accrual, liability)
-- ============================================================================

CREATE TABLE IF NOT EXISTS budget_encumbrances (
    encumbrance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(30) NOT NULL
        CHECK (source_type IN ('REQUISITION', 'PURCHASE_ORDER', 'RECEIPT', 'INVOICE', 'MANUAL_ADJUSTMENT', 'RELEASE')),
    source_document_id UUID NOT NULL,
    source_line_id UUID,

    reference_requisition_id UUID REFERENCES requisition_headers(requisition_id) ON DELETE SET NULL,
    reference_po_id UUID REFERENCES purchase_orders(po_id) ON DELETE SET NULL,
    reference_po_line_id UUID REFERENCES purchase_order_lines(line_id) ON DELETE SET NULL,

    cost_center_id UUID NOT NULL REFERENCES cost_centers(cost_center_id),
    department_id UUID REFERENCES departments(department_id),
    fiscal_year INTEGER NOT NULL,
    fiscal_period VARCHAR(20),

    encumbrance_type VARCHAR(30) NOT NULL
        CHECK (encumbrance_type IN ('PRE_ENCUMBRANCE', 'ENCUMBRANCE', 'ACCRUAL', 'LIABILITY', 'RELIEF', 'ADJUSTMENT')),
    amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',

    status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'PARTIALLY_RELEASED', 'RELEASED', 'REVERSED', 'CLOSED')),
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    released_date TIMESTAMPTZ,

    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_budget_encumbrances_source
    ON budget_encumbrances(source_type, source_document_id);

CREATE INDEX IF NOT EXISTS idx_budget_encumbrances_cost_center
    ON budget_encumbrances(cost_center_id, fiscal_year, fiscal_period);

CREATE INDEX IF NOT EXISTS idx_budget_encumbrances_status
    ON budget_encumbrances(status);

CREATE INDEX IF NOT EXISTS idx_budget_encumbrances_reference_po
    ON budget_encumbrances(reference_po_id)
    WHERE reference_po_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_budget_encumbrances_reference_requisition
    ON budget_encumbrances(reference_requisition_id)
    WHERE reference_requisition_id IS NOT NULL;

-- ============================================================================
-- 3. Subledger headers
-- ============================================================================

CREATE TABLE IF NOT EXISTS subledger_entries (
    subledger_entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_number VARCHAR(50) NOT NULL UNIQUE,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),

    source_module VARCHAR(30) NOT NULL DEFAULT 'PROCUREMENT'
        CHECK (source_module IN ('PROCUREMENT', 'LIFECYCLE', 'FINANCE', 'MANUAL')),
    source_type VARCHAR(30) NOT NULL
        CHECK (source_type IN ('REQUISITION', 'PURCHASE_ORDER', 'RECEIPT', 'INVOICE', 'ADJUSTMENT', 'REVERSAL')),
    source_document_id UUID NOT NULL,
    source_document_number VARCHAR(100),

    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'POSTED', 'REVERSED', 'ERROR')),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    total_debit DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (total_debit >= 0),
    total_credit DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (total_credit >= 0),
    description TEXT,

    posted_at TIMESTAMPTZ,
    posted_by UUID REFERENCES users(user_id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_subledger_entries_date
    ON subledger_entries(entry_date);

CREATE INDEX IF NOT EXISTS idx_subledger_entries_period
    ON subledger_entries(period_year, period_month);

CREATE INDEX IF NOT EXISTS idx_subledger_entries_source
    ON subledger_entries(source_type, source_document_id);

CREATE INDEX IF NOT EXISTS idx_subledger_entries_status
    ON subledger_entries(status);

-- ============================================================================
-- 4. Subledger lines
-- ============================================================================

CREATE TABLE IF NOT EXISTS subledger_lines (
    subledger_line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subledger_entry_id UUID NOT NULL REFERENCES subledger_entries(subledger_entry_id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,

    po_distribution_id UUID REFERENCES po_distributions(po_distribution_id) ON DELETE SET NULL,
    budget_encumbrance_id UUID REFERENCES budget_encumbrances(encumbrance_id) ON DELETE SET NULL,
    requisition_distribution_id UUID REFERENCES requisition_distributions(requisition_distribution_id) ON DELETE SET NULL,

    cost_center_id UUID REFERENCES cost_centers(cost_center_id),
    department_id UUID REFERENCES departments(department_id),
    gl_account VARCHAR(50) NOT NULL,

    debit_amount DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (debit_amount >= 0),
    credit_amount DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    memo TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),

    CONSTRAINT unique_subledger_line_number UNIQUE (subledger_entry_id, line_number),
    CONSTRAINT valid_subledger_line_amounts CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR
        (credit_amount > 0 AND debit_amount = 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_subledger_lines_entry
    ON subledger_lines(subledger_entry_id);

CREATE INDEX IF NOT EXISTS idx_subledger_lines_po_distribution
    ON subledger_lines(po_distribution_id)
    WHERE po_distribution_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subledger_lines_budget_encumbrance
    ON subledger_lines(budget_encumbrance_id)
    WHERE budget_encumbrance_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subledger_lines_cost_center
    ON subledger_lines(cost_center_id)
    WHERE cost_center_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subledger_lines_gl_account
    ON subledger_lines(gl_account);

-- ============================================================================
-- 5. Updated-at triggers
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_po_distributions_updated_at ON po_distributions;
CREATE TRIGGER trigger_po_distributions_updated_at
    BEFORE UPDATE ON po_distributions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_budget_encumbrances_updated_at ON budget_encumbrances;
CREATE TRIGGER trigger_budget_encumbrances_updated_at
    BEFORE UPDATE ON budget_encumbrances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_subledger_entries_updated_at ON subledger_entries;
CREATE TRIGGER trigger_subledger_entries_updated_at
    BEFORE UPDATE ON subledger_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. Comments
-- ============================================================================

COMMENT ON TABLE po_distributions IS 'Line-level accounting allocations for purchase order lines';
COMMENT ON TABLE budget_encumbrances IS 'Budget commitment, relief, and accrual lifecycle by source document';
COMMENT ON TABLE subledger_entries IS 'Procurement accounting subledger headers generated from transactional events';
COMMENT ON TABLE subledger_lines IS 'Double-entry accounting lines tied to procurement distributions and encumbrances';
