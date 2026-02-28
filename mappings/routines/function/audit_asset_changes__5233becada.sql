-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: audit_asset_changes()

CREATE OR REPLACE FUNCTION public.audit_asset_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        
        INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
        VALUES (NEW.created_by, v_action_type, 'ASSET', NEW.asset_id, v_old_values, v_new_values);
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Determine if this is a status change or general update
        IF OLD.status != NEW.status THEN
            v_action_type := 'STATUS_CHANGE';
        ELSE
            v_action_type := 'UPDATE';
        END IF;
        
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        
        INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
        VALUES (NEW.updated_by, v_action_type, 'ASSET', NEW.asset_id, v_old_values, v_new_values);
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
        
        INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
        VALUES (OLD.updated_by, v_action_type, 'ASSET', OLD.asset_id, v_old_values, v_new_values);
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$function$
