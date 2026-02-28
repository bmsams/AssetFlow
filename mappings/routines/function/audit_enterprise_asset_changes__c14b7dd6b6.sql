-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: audit_enterprise_asset_changes()

CREATE OR REPLACE FUNCTION public.audit_enterprise_asset_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
    v_user_id UUID;
BEGIN
    -- Get the user_id from the parent asset record
    SELECT updated_by INTO v_user_id FROM assets WHERE asset_id = COALESCE(NEW.asset_id, OLD.asset_id);
    
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Check for location changes
        IF OLD.facility_id IS DISTINCT FROM NEW.facility_id OR
           OLD.building IS DISTINCT FROM NEW.building OR
           OLD.zone IS DISTINCT FROM NEW.zone THEN
            v_action_type := 'TRANSFER';
        -- Check for calibration updates
        ELSIF OLD.last_calibration_date IS DISTINCT FROM NEW.last_calibration_date THEN
            v_action_type := 'CALIBRATION';
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
    VALUES (v_user_id, v_action_type, 'ENTERPRISE_ASSET', COALESCE(NEW.asset_id, OLD.asset_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$
