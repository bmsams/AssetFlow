-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: audit_relationship_changes()

CREATE OR REPLACE FUNCTION public.audit_relationship_changes()
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
        v_new_values := jsonb_build_object(
            'relationship_id', NEW.relationship_id,
            'source_asset_id', NEW.source_asset_id,
            'target_asset_id', NEW.target_asset_id,
            'relation_type', NEW.relation_type,
            'metadata', NEW.metadata
        );
        
        INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
        VALUES (NEW.created_by, v_action_type, 'ASSET_RELATIONSHIP', NEW.relationship_id, v_old_values, v_new_values);
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := jsonb_build_object(
            'relationship_id', OLD.relationship_id,
            'source_asset_id', OLD.source_asset_id,
            'target_asset_id', OLD.target_asset_id,
            'relation_type', OLD.relation_type,
            'metadata', OLD.metadata
        );
        v_new_values := NULL;
        
        INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
        VALUES (OLD.created_by, v_action_type, 'ASSET_RELATIONSHIP', OLD.relationship_id, v_old_values, v_new_values);
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$function$
