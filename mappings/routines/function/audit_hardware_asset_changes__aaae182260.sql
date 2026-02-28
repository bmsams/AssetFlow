-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: audit_hardware_asset_changes()

CREATE OR REPLACE FUNCTION public.audit_hardware_asset_changes()
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
        
        INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
        VALUES (v_user_id, v_action_type, 'HARDWARE_ASSET', NEW.asset_id, v_old_values, v_new_values);
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Check for assignment changes
        IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
            IF NEW.assigned_to IS NOT NULL AND OLD.assigned_to IS NULL THEN
                v_action_type := 'ASSIGN';
            ELSIF NEW.assigned_to IS NULL AND OLD.assigned_to IS NOT NULL THEN
                v_action_type := 'UNASSIGN';
            ELSE
                v_action_type := 'TRANSFER';
            END IF;
        -- Check for location changes
        ELSIF OLD.stockroom_id IS DISTINCT FROM NEW.stockroom_id THEN
            v_action_type := 'TRANSFER';
        ELSE
            v_action_type := 'UPDATE';
        END IF;
        
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        
        INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
        VALUES (v_user_id, v_action_type, 'HARDWARE_ASSET', NEW.asset_id, v_old_values, v_new_values);
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
        
        INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
        VALUES (v_user_id, v_action_type, 'HARDWARE_ASSET', OLD.asset_id, v_old_values, v_new_values);
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$function$
