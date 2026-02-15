-- ============================================================================
-- V015: Vendor ↔ Model Pricing
--
-- Adds a simple pricing association between vendors and hardware models so:
-- - Procurement line items can be selected from the Product Catalog (models)
-- - A vendor-specific unit price (and optional vendor SKU) can be stored and reused
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_model_prices (
    vendor_model_price_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    vendor_id UUID NOT NULL REFERENCES vendors(vendor_id) ON DELETE CASCADE,
    model_id UUID NOT NULL REFERENCES models(model_id) ON DELETE CASCADE,

    unit_price DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    vendor_sku VARCHAR(100),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT vendor_model_prices_unit_price_nonnegative CHECK (unit_price >= 0),
    CONSTRAINT vendor_model_prices_currency_len CHECK (char_length(currency) = 3),
    CONSTRAINT vendor_model_prices_unique UNIQUE (vendor_id, model_id)
);

COMMENT ON TABLE vendor_model_prices IS 'Vendor-specific pricing for hardware models (catalog items).';
COMMENT ON COLUMN vendor_model_prices.vendor_id IS 'Vendor (supplier/reseller/manufacturer).';
COMMENT ON COLUMN vendor_model_prices.model_id IS 'Hardware model from models table.';
COMMENT ON COLUMN vendor_model_prices.unit_price IS 'Unit price for this vendor+model.';
COMMENT ON COLUMN vendor_model_prices.currency IS 'ISO 4217 currency code (default USD).';
COMMENT ON COLUMN vendor_model_prices.vendor_sku IS 'Optional vendor-specific SKU/part number.';

CREATE INDEX IF NOT EXISTS idx_vendor_model_prices_vendor ON vendor_model_prices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_model_prices_model ON vendor_model_prices(model_id);
CREATE INDEX IF NOT EXISTS idx_vendor_model_prices_active ON vendor_model_prices(vendor_id, is_active);

-- Apply update timestamp trigger
DROP TRIGGER IF EXISTS trigger_vendor_model_prices_updated_at ON vendor_model_prices;
CREATE TRIGGER trigger_vendor_model_prices_updated_at
    BEFORE UPDATE ON vendor_model_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

