-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: audit_loaner_checkout_changes()

CREATE OR REPLACE FUNCTION public.audit_loaner_checkout_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(NEW.updated_by, NEW.created_by, OLD.updated_by);
    
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != NEW.status THEN
            v_action_type := 'STATUS_CHANGE';
        ELSIF NEW.return_date IS NOT NULL AND OLD.return_date IS NULL THEN
            v_action_type := 'RETURN';
        ELSE
            v_action_type := 'UPDATE';
        END IF;
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
        v_user_id := OLD.updated_by;
    END IF;
    
    INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
    VALUES (v_user_id, v_action_type, 'LOANER_CHECKOUT', COALESCE(NEW.checkout_id, OLD.checkout_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$
