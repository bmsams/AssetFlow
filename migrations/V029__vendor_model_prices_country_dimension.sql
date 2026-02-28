-- V029: Add country dimension to vendor_model_prices
--
-- Rationale:
-- - Approved vendor/model pricing must support country-specific values.
-- - Existing rows become GLOBAL scope by default to keep backward compatibility.

ALTER TABLE vendor_model_prices
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(10) NOT NULL DEFAULT 'GLOBAL';

UPDATE vendor_model_prices
SET country_code = COALESCE(NULLIF(UPPER(TRIM(country_code)), ''), 'GLOBAL')
WHERE country_code IS DISTINCT FROM COALESCE(NULLIF(UPPER(TRIM(country_code)), ''), 'GLOBAL');

ALTER TABLE vendor_model_prices
  DROP CONSTRAINT IF EXISTS vendor_model_prices_unique;

ALTER TABLE vendor_model_prices
  DROP CONSTRAINT IF EXISTS vendor_model_prices_country_code_format;

ALTER TABLE vendor_model_prices
  ADD CONSTRAINT vendor_model_prices_country_code_format
  CHECK (country_code ~ '^[A-Z0-9_-]{2,10}$');

ALTER TABLE vendor_model_prices
  ADD CONSTRAINT vendor_model_prices_unique
  UNIQUE (vendor_id, model_id, country_code);

CREATE INDEX IF NOT EXISTS idx_vendor_model_prices_vendor_model_country
  ON vendor_model_prices(vendor_id, model_id, country_code);

COMMENT ON COLUMN vendor_model_prices.country_code IS
  'Country/region code for this vendor+model price (ISO code or GLOBAL fallback).';
