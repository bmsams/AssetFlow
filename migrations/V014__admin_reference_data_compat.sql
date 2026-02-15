-- Admin reference data compatibility
--
-- The admin-service expects manufacturer/model columns that were not present in
-- earlier schema versions (V002). This migration adds missing columns and
-- provides triggers to populate required normalized fields so admin CRUD works.

-- ============================================================================
-- MANUFACTURERS
-- ============================================================================

-- Add manufacturer "code" (used for searching/lookup). Keep it nullable.
ALTER TABLE manufacturers
  ADD COLUMN IF NOT EXISTS code VARCHAR(100);

-- Backfill manufacturer.code from normalized_name when available.
UPDATE manufacturers
SET code = COALESCE(code, normalized_name)
WHERE code IS NULL;

-- Ensure new/updated rows have normalized_name + code set (for older inserts
-- that don't provide normalized_name / code).
CREATE OR REPLACE FUNCTION trg_manufacturers_set_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.normalized_name IS NULL OR length(trim(NEW.normalized_name)) = 0 THEN
    NEW.normalized_name := upper(regexp_replace(trim(NEW.name), '\s+', ' ', 'g'));
  END IF;

  IF NEW.code IS NULL OR length(trim(NEW.code)) = 0 THEN
    NEW.code := NEW.normalized_name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_manufacturers_set_defaults ON manufacturers;
CREATE TRIGGER trigger_manufacturers_set_defaults
  BEFORE INSERT OR UPDATE ON manufacturers
  FOR EACH ROW
  EXECUTE FUNCTION trg_manufacturers_set_defaults();

CREATE INDEX IF NOT EXISTS idx_manufacturers_code ON manufacturers(code);

-- ============================================================================
-- MODELS
-- ============================================================================

-- Add admin-service columns expected by the model catalog.
ALTER TABLE models
  ADD COLUMN IF NOT EXISTS sku VARCHAR(100);

ALTER TABLE models
  ADD COLUMN IF NOT EXISTS category VARCHAR(100);

ALTER TABLE models
  ADD COLUMN IF NOT EXISTS status VARCHAR(20);

-- Default/backfill for existing data.
UPDATE models
SET
  sku = COALESCE(sku, model_number),
  category = COALESCE(category, model_category),
  status = COALESCE(status, 'ACTIVE')
WHERE sku IS NULL OR category IS NULL OR status IS NULL;

-- Constrain status values to what the admin-service uses.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'models'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'models_status_check'
  ) THEN
    ALTER TABLE models
      ADD CONSTRAINT models_status_check
      CHECK (status IN ('ACTIVE', 'DEPRECATED', 'END_OF_LIFE'));
  END IF;
END $$;

-- Ensure inserts/updates populate normalized_name and keep category/model_category
-- in sync so both the admin catalog and normalization use-cases remain workable.
CREATE OR REPLACE FUNCTION trg_models_set_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.normalized_name IS NULL OR length(trim(NEW.normalized_name)) = 0 THEN
    NEW.normalized_name := upper(regexp_replace(trim(NEW.model_name), '\s+', ' ', 'g'));
  END IF;

  IF NEW.status IS NULL OR length(trim(NEW.status)) = 0 THEN
    NEW.status := 'ACTIVE';
  END IF;

  IF NEW.category IS NULL AND NEW.model_category IS NOT NULL THEN
    NEW.category := NEW.model_category;
  END IF;
  IF NEW.model_category IS NULL AND NEW.category IS NOT NULL THEN
    NEW.model_category := NEW.category;
  END IF;

  IF NEW.sku IS NULL AND NEW.model_number IS NOT NULL THEN
    NEW.sku := NEW.model_number;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_models_set_defaults ON models;
CREATE TRIGGER trigger_models_set_defaults
  BEFORE INSERT OR UPDATE ON models
  FOR EACH ROW
  EXECUTE FUNCTION trg_models_set_defaults();

CREATE INDEX IF NOT EXISTS idx_models_sku ON models(sku);
CREATE INDEX IF NOT EXISTS idx_models_status ON models(status);
CREATE INDEX IF NOT EXISTS idx_models_category ON models(category);

