-- V012__fix_audit_triggers_v2.sql
-- Fix audit trigger functions with proper $$ dollar-quoting
-- V011 had incorrect single $ quoting which caused functions to not be replaced properly

-- ============================================================================
-- FIX MANUFACTURER AUDIT TRIGGER (CRITICAL - manufacturers table has no created_by)
-- ============================================================================
CREATE OR REPLACE FUNCTION log_manufacturer_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, new_values
        ) VALUES (
            'MANUFACTURER',
            NEW.manufacturer_id,
            'CREATE',
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values, new_values
        ) VALUES (
            'MANUFACTURER',
            NEW.manufacturer_id,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values
        ) VALUES (
            'MANUFACTURER',
            OLD.manufacturer_id,
            'DELETE',
            to_jsonb(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FIX BUILDING AUDIT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION log_building_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, new_values, user_id
        ) VALUES (
            'BUILDING',
            NEW.building_id,
            'CREATE',
            to_jsonb(NEW),
            NEW.created_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values, new_values, user_id
        ) VALUES (
            'BUILDING',
            NEW.building_id,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW),
            NEW.updated_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values, user_id
        ) VALUES (
            'BUILDING',
            OLD.building_id,
            'DELETE',
            to_jsonb(OLD),
            OLD.updated_by
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FIX FLOOR AUDIT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION log_floor_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, new_values, user_id
        ) VALUES (
            'FLOOR',
            NEW.floor_id,
            'CREATE',
            to_jsonb(NEW),
            NEW.created_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values, new_values, user_id
        ) VALUES (
            'FLOOR',
            NEW.floor_id,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW),
            NEW.updated_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values, user_id
        ) VALUES (
            'FLOOR',
            OLD.floor_id,
            'DELETE',
            to_jsonb(OLD),
            OLD.updated_by
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FIX ROOM AUDIT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION log_room_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, new_values, user_id
        ) VALUES (
            'ROOM',
            NEW.room_id,
            'CREATE',
            to_jsonb(NEW),
            NEW.created_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values, new_values, user_id
        ) VALUES (
            'ROOM',
            NEW.room_id,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW),
            NEW.updated_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values, user_id
        ) VALUES (
            'ROOM',
            OLD.room_id,
            'DELETE',
            to_jsonb(OLD),
            OLD.updated_by
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FIX RACK AUDIT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION log_rack_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, new_values, user_id
        ) VALUES (
            'RACK',
            NEW.rack_id,
            'CREATE',
            to_jsonb(NEW),
            NEW.created_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values, new_values, user_id
        ) VALUES (
            'RACK',
            NEW.rack_id,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW),
            NEW.updated_by
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values, user_id
        ) VALUES (
            'RACK',
            OLD.rack_id,
            'DELETE',
            to_jsonb(OLD),
            OLD.updated_by
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FIX BIN LOCATION AUDIT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION log_bin_location_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, new_values
        ) VALUES (
            'BIN_LOCATION',
            NEW.bin_id,
            'CREATE',
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values, new_values
        ) VALUES (
            'BIN_LOCATION',
            NEW.bin_id,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (
            resource_type, resource_id, action_type, old_values
        ) VALUES (
            'BIN_LOCATION',
            OLD.bin_id,
            'DELETE',
            to_jsonb(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
