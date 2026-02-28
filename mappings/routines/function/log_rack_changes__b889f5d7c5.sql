-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: log_rack_changes()

CREATE OR REPLACE FUNCTION public.log_rack_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$
