-- Database routine definitions
-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public

-- FUNCTION: audit_asset_changes()
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

-- FUNCTION: audit_audit_record_changes()
CREATE OR REPLACE FUNCTION public.audit_audit_record_changes()
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
    VALUES (v_user_id, v_action_type, 'AUDIT_RECORD', COALESCE(NEW.audit_id, OLD.audit_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$

-- FUNCTION: audit_contract_changes()
CREATE OR REPLACE FUNCTION public.audit_contract_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
    v_user_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        v_user_id := NEW.created_by;
        
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            v_action_type := 'STATUS_CHANGE';
        ELSE
            v_action_type := 'UPDATE';
        END IF;
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        v_user_id := NEW.updated_by;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
        v_user_id := OLD.updated_by;
    END IF;
    
    INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
    VALUES (v_user_id, v_action_type, 'CONTRACT', COALESCE(NEW.contract_id, OLD.contract_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$

-- FUNCTION: audit_enterprise_asset_changes()
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

-- FUNCTION: audit_entitlement_changes()
CREATE OR REPLACE FUNCTION public.audit_entitlement_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
    v_user_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        v_user_id := NEW.created_by;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Check for quantity changes
        IF OLD.quantity_available != NEW.quantity_available THEN
            IF NEW.quantity_available < OLD.quantity_available THEN
                v_action_type := 'LICENSE_CONSUMED';
            ELSE
                v_action_type := 'LICENSE_RELEASED';
            END IF;
        ELSE
            v_action_type := 'UPDATE';
        END IF;
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        v_user_id := NEW.updated_by;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
        v_user_id := OLD.updated_by;
    END IF;
    
    INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
    VALUES (v_user_id, v_action_type, 'ENTITLEMENT', COALESCE(NEW.entitlement_id, OLD.entitlement_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$

-- FUNCTION: audit_hardware_asset_changes()
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

-- FUNCTION: audit_lease_payment_changes()
CREATE OR REPLACE FUNCTION public.audit_lease_payment_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
    v_user_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        v_user_id := NEW.created_by;
        
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            v_action_type := 'STATUS_CHANGE';
        ELSE
            v_action_type := 'UPDATE';
        END IF;
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        v_user_id := NEW.updated_by;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
        v_user_id := OLD.updated_by;
    END IF;
    
    INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
    VALUES (v_user_id, v_action_type, 'LEASE_PAYMENT', COALESCE(NEW.payment_id, OLD.payment_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$

-- FUNCTION: audit_loaner_checkout_changes()
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

-- FUNCTION: audit_maintenance_plan_changes()
CREATE OR REPLACE FUNCTION public.audit_maintenance_plan_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(NEW.updated_by, NEW.created_by, OLD.updated_by, OLD.created_by);
    
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
            IF NEW.is_active THEN
                v_action_type := 'ACTIVATE';
            ELSE
                v_action_type := 'DEACTIVATE';
            END IF;
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
    VALUES (v_user_id, v_action_type, 'MAINTENANCE_PLAN', COALESCE(NEW.plan_id, OLD.plan_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$

-- FUNCTION: audit_purchase_order_changes()
CREATE OR REPLACE FUNCTION public.audit_purchase_order_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
    v_user_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        v_user_id := NEW.created_by;
        
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            v_action_type := 'STATUS_CHANGE';
        ELSE
            v_action_type := 'UPDATE';
        END IF;
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        v_user_id := NEW.updated_by;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
        v_user_id := OLD.updated_by;
    END IF;
    
    INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
    VALUES (v_user_id, v_action_type, 'PURCHASE_ORDER', COALESCE(NEW.po_id, OLD.po_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$

-- FUNCTION: audit_reclamation_candidate_changes()
CREATE OR REPLACE FUNCTION public.audit_reclamation_candidate_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
    v_user_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        v_user_id := NEW.created_by;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Check for status changes
        IF OLD.status != NEW.status THEN
            v_action_type := 'STATUS_CHANGE';
        ELSIF OLD.license_recovered != NEW.license_recovered AND NEW.license_recovered THEN
            v_action_type := 'LICENSE_RECOVERED';
        ELSE
            v_action_type := 'UPDATE';
        END IF;
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        v_user_id := COALESCE(NEW.approved_by, NEW.created_by);
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
        v_user_id := OLD.created_by;
    END IF;
    
    INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
    VALUES (v_user_id, v_action_type, 'RECLAMATION_CANDIDATE', COALESCE(NEW.candidate_id, OLD.candidate_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$

-- FUNCTION: audit_relationship_changes()
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

-- FUNCTION: audit_software_installation_changes()
CREATE OR REPLACE FUNCTION public.audit_software_installation_changes()
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
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Check for status changes
        IF OLD.status != NEW.status THEN
            v_action_type := 'STATUS_CHANGE';
        ELSIF OLD.is_authorized != NEW.is_authorized THEN
            IF NEW.is_authorized THEN
                v_action_type := 'AUTHORIZE';
            ELSE
                v_action_type := 'UNAUTHORIZE';
            END IF;
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
    VALUES (NEW.authorized_by, v_action_type, 'SOFTWARE_INSTALLATION', COALESCE(NEW.installation_id, OLD.installation_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$

-- FUNCTION: audit_software_product_changes()
CREATE OR REPLACE FUNCTION public.audit_software_product_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
    v_user_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        v_user_id := NEW.created_by;
        
    ELSIF TG_OP = 'UPDATE' THEN
        v_action_type := 'UPDATE';
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        v_user_id := NEW.updated_by;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
        v_user_id := OLD.updated_by;
    END IF;
    
    INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
    VALUES (v_user_id, v_action_type, 'SOFTWARE_PRODUCT', COALESCE(NEW.product_id, OLD.product_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$

-- FUNCTION: audit_transfer_order_changes()
CREATE OR REPLACE FUNCTION public.audit_transfer_order_changes()
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
    VALUES (v_user_id, v_action_type, 'TRANSFER_ORDER', COALESCE(NEW.transfer_id, OLD.transfer_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$

-- FUNCTION: audit_work_order_changes()
CREATE OR REPLACE FUNCTION public.audit_work_order_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(NEW.updated_by, NEW.created_by, OLD.updated_by, OLD.created_by);
    
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Check for status changes
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            v_action_type := 'STATUS_CHANGE';
        -- Check for assignment changes
        ELSIF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
            v_action_type := 'ASSIGN';
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
    VALUES (v_user_id, v_action_type, 'WORK_ORDER', COALESCE(NEW.work_order_id, OLD.work_order_id), v_old_values, v_new_values);
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$

-- FUNCTION: calculate_compliance_position(uuid)
CREATE OR REPLACE FUNCTION public.calculate_compliance_position(p_product_id uuid)
 RETURNS TABLE(entitlements_owned integer, installations_found integer, compliance_position character varying, over_under_count integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_entitlements INTEGER;
    v_installations INTEGER;
BEGIN
    -- Get total entitlements
    SELECT COALESCE(SUM(quantity_purchased), 0)
    INTO v_entitlements
    FROM entitlements
    WHERE software_product_id = p_product_id
      AND is_active = TRUE;
    
    -- Get active installations
    SELECT COUNT(*)
    INTO v_installations
    FROM software_installations
    WHERE software_product_id = p_product_id
      AND status = 'ACTIVE';
    
    -- Return results
    RETURN QUERY SELECT 
        v_entitlements,
        v_installations,
        CASE 
            WHEN v_entitlements >= v_installations THEN 
                CASE WHEN v_entitlements > v_installations THEN 'OVER_LICENSED'::VARCHAR(20)
                     ELSE 'COMPLIANT'::VARCHAR(20)
                END
            ELSE 'UNDER_LICENSED'::VARCHAR(20)
        END,
        v_entitlements - v_installations;
END;
$function$

-- FUNCTION: calculate_straight_line_depreciation(uuid,numeric,numeric,integer,date)
CREATE OR REPLACE FUNCTION public.calculate_straight_line_depreciation(p_asset_id uuid, p_original_value numeric, p_salvage_value numeric, p_useful_life_months integer, p_start_date date)
 RETURNS TABLE(period_number integer, period_start date, period_end date, beginning_value numeric, depreciation_amount numeric, ending_value numeric, accumulated_depreciation numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_depreciable_amount DECIMAL(14, 2);
    v_monthly_depreciation DECIMAL(14, 2);
    v_current_value DECIMAL(14, 2);
    v_accumulated DECIMAL(14, 2);
    v_period INTEGER;
    v_period_start DATE;
    v_period_end DATE;
BEGIN
    v_depreciable_amount := p_original_value - COALESCE(p_salvage_value, 0);
    v_monthly_depreciation := ROUND(v_depreciable_amount / p_useful_life_months, 2);
    v_current_value := p_original_value;
    v_accumulated := 0;
    
    FOR v_period IN 1..p_useful_life_months LOOP
        v_period_start := p_start_date + ((v_period - 1) * INTERVAL '1 month');
        v_period_end := p_start_date + (v_period * INTERVAL '1 month') - INTERVAL '1 day';
        
        -- Adjust last period for rounding
        IF v_period = p_useful_life_months THEN
            v_monthly_depreciation := v_current_value - COALESCE(p_salvage_value, 0);
        END IF;
        
        period_number := v_period;
        period_start := v_period_start;
        period_end := v_period_end;
        beginning_value := v_current_value;
        depreciation_amount := v_monthly_depreciation;
        ending_value := v_current_value - v_monthly_depreciation;
        v_accumulated := v_accumulated + v_monthly_depreciation;
        accumulated_depreciation := v_accumulated;
        
        v_current_value := ending_value;
        
        RETURN NEXT;
    END LOOP;
END;
$function$

-- FUNCTION: generate_asset_tag(character varying)
CREATE OR REPLACE FUNCTION public.generate_asset_tag(p_asset_type character varying)
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_prefix VARCHAR(10);
    v_sequence INTEGER;
    v_tag VARCHAR(50);
BEGIN
    -- Determine prefix based on asset type
    CASE p_asset_type
        WHEN 'HARDWARE' THEN v_prefix := 'HW';
        WHEN 'SOFTWARE' THEN v_prefix := 'SW';
        WHEN 'ENTERPRISE' THEN v_prefix := 'EA';
        ELSE v_prefix := 'AS';
    END CASE;
    
    -- Get next sequence number for this type
    SELECT COALESCE(MAX(
        CASE 
            WHEN asset_tag ~ ('^AMS-' || v_prefix || '-[0-9]+$')
            THEN CAST(SUBSTRING(asset_tag FROM '[0-9]+$') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM assets
    WHERE asset_type = p_asset_type;
    
    -- Generate tag with zero-padded sequence
    v_tag := 'AMS-' || v_prefix || '-' || LPAD(v_sequence::TEXT, 8, '0');
    
    RETURN v_tag;
END;
$function$

-- FUNCTION: generate_audit_number()
CREATE OR REPLACE FUNCTION public.generate_audit_number()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_sequence INTEGER;
    v_number VARCHAR(50);
BEGIN
    SELECT COALESCE(MAX(
        CASE 
            WHEN audit_number ~ '^AUD-[0-9]+$'
            THEN CAST(SUBSTRING(audit_number FROM 5) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM audit_records;
    
    v_number := 'AUD-' || LPAD(v_sequence::TEXT, 8, '0');
    RETURN v_number;
END;
$function$

-- FUNCTION: generate_checkout_number()
CREATE OR REPLACE FUNCTION public.generate_checkout_number()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_sequence INTEGER;
    v_number VARCHAR(50);
BEGIN
    SELECT COALESCE(MAX(
        CASE 
            WHEN checkout_number ~ '^LNR-[0-9]+$'
            THEN CAST(SUBSTRING(checkout_number FROM 5) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM loaner_checkouts;
    
    v_number := 'LNR-' || LPAD(v_sequence::TEXT, 8, '0');
    RETURN v_number;
END;
$function$

-- FUNCTION: generate_contract_number(character varying)
CREATE OR REPLACE FUNCTION public.generate_contract_number(p_contract_type character varying)
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_prefix VARCHAR(10);
    v_year VARCHAR(4);
    v_sequence INTEGER;
    v_contract_number VARCHAR(100);
BEGIN
    -- Determine prefix based on contract type
    CASE p_contract_type
        WHEN 'PURCHASE' THEN v_prefix := 'PUR';
        WHEN 'LEASE' THEN v_prefix := 'LSE';
        WHEN 'MAINTENANCE' THEN v_prefix := 'MNT';
        WHEN 'SUPPORT' THEN v_prefix := 'SUP';
        WHEN 'LICENSE' THEN v_prefix := 'LIC';
        WHEN 'WARRANTY' THEN v_prefix := 'WRN';
        WHEN 'SERVICE' THEN v_prefix := 'SVC';
        WHEN 'SUBSCRIPTION' THEN v_prefix := 'SUB';
        WHEN 'MASTER' THEN v_prefix := 'MST';
        ELSE v_prefix := 'CON';
    END CASE;
    
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    SELECT COALESCE(MAX(
        CASE 
            WHEN contract_number ~ ('^' || v_prefix || '-' || v_year || '-[0-9]+$')
            THEN CAST(SUBSTRING(contract_number FROM '[0-9]+$') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM contracts
    WHERE contract_number LIKE v_prefix || '-' || v_year || '-%';
    
    v_contract_number := v_prefix || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 5, '0');
    
    RETURN v_contract_number;
END;
$function$

-- FUNCTION: generate_po_number()
CREATE OR REPLACE FUNCTION public.generate_po_number()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_year VARCHAR(4);
    v_sequence INTEGER;
    v_po_number VARCHAR(100);
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    SELECT COALESCE(MAX(
        CASE 
            WHEN po_number ~ ('^PO-' || v_year || '-[0-9]+$')
            THEN CAST(SUBSTRING(po_number FROM '[0-9]+$') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM purchase_orders
    WHERE po_number LIKE 'PO-' || v_year || '-%';
    
    v_po_number := 'PO-' || v_year || '-' || LPAD(v_sequence::TEXT, 6, '0');
    
    RETURN v_po_number;
END;
$function$

-- FUNCTION: generate_receiving_number()
CREATE OR REPLACE FUNCTION public.generate_receiving_number()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_sequence INTEGER;
    v_number VARCHAR(50);
BEGIN
    SELECT COALESCE(MAX(
        CASE 
            WHEN receiving_number ~ '^RCV-[0-9]+$'
            THEN CAST(SUBSTRING(receiving_number FROM 5) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM receiving_records;
    
    v_number := 'RCV-' || LPAD(v_sequence::TEXT, 8, '0');
    RETURN v_number;
END;
$function$

-- FUNCTION: generate_transfer_number()
CREATE OR REPLACE FUNCTION public.generate_transfer_number()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_sequence INTEGER;
    v_number VARCHAR(50);
BEGIN
    SELECT COALESCE(MAX(
        CASE 
            WHEN transfer_number ~ '^TO-[0-9]+$'
            THEN CAST(SUBSTRING(transfer_number FROM 4) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM transfer_orders;
    
    v_number := 'TO-' || LPAD(v_sequence::TEXT, 8, '0');
    RETURN v_number;
END;
$function$

-- FUNCTION: generate_work_order_number()
CREATE OR REPLACE FUNCTION public.generate_work_order_number()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_year INTEGER;
    v_sequence INTEGER;
    v_number VARCHAR(50);
BEGIN
    v_year := EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Get next sequence number for this year
    SELECT COALESCE(MAX(
        CASE 
            WHEN work_order_number ~ ('^WO-' || v_year || '-[0-9]+$')
            THEN CAST(SUBSTRING(work_order_number FROM '[0-9]+$') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM work_orders
    WHERE work_order_number LIKE 'WO-' || v_year || '-%';
    
    -- Generate number with zero-padded sequence
    v_number := 'WO-' || v_year || '-' || LPAD(v_sequence::TEXT, 6, '0');
    
    RETURN v_number;
END;
$function$

-- FUNCTION: get_asset_ancestors(uuid,character varying)
CREATE OR REPLACE FUNCTION public.get_asset_ancestors(p_asset_id uuid, p_relation_type character varying DEFAULT 'PARENT_CHILD'::character varying)
 RETURNS TABLE(ancestor_id uuid, depth integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH RECURSIVE ancestors AS (
        -- Base case: direct parents
        SELECT 
            r.source_asset_id AS ancestor_id,
            1 AS depth
        FROM asset_relationships r
        WHERE r.target_asset_id = p_asset_id
          AND r.relation_type = p_relation_type
        
        UNION ALL
        
        -- Recursive case: parents of parents
        SELECT 
            r.source_asset_id,
            a.depth + 1
        FROM asset_relationships r
        INNER JOIN ancestors a ON r.target_asset_id = a.ancestor_id
        WHERE r.relation_type = p_relation_type
          AND a.depth < 100  -- Prevent infinite loops
    )
    SELECT DISTINCT a.ancestor_id, MIN(a.depth) AS depth
    FROM ancestors a
    GROUP BY a.ancestor_id
    ORDER BY depth;
END;
$function$

-- FUNCTION: get_asset_descendants(uuid,character varying)
CREATE OR REPLACE FUNCTION public.get_asset_descendants(p_asset_id uuid, p_relation_type character varying DEFAULT 'PARENT_CHILD'::character varying)
 RETURNS TABLE(descendant_id uuid, depth integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH RECURSIVE descendants AS (
        -- Base case: direct children
        SELECT 
            r.target_asset_id AS descendant_id,
            1 AS depth
        FROM asset_relationships r
        WHERE r.source_asset_id = p_asset_id
          AND r.relation_type = p_relation_type
        
        UNION ALL
        
        -- Recursive case: children of children
        SELECT 
            r.target_asset_id,
            d.depth + 1
        FROM asset_relationships r
        INNER JOIN descendants d ON r.source_asset_id = d.descendant_id
        WHERE r.relation_type = p_relation_type
          AND d.depth < 100  -- Prevent infinite loops
    )
    SELECT DISTINCT d.descendant_id, MIN(d.depth) AS depth
    FROM descendants d
    GROUP BY d.descendant_id
    ORDER BY depth;
END;
$function$

-- FUNCTION: get_reorder_alerts(uuid)
CREATE OR REPLACE FUNCTION public.get_reorder_alerts(p_stockroom_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(stockroom_id uuid, stockroom_name character varying, product_id uuid, product_type character varying, product_description character varying, quantity_on_hand integer, quantity_available integer, reorder_point integer, reorder_quantity integer, shortage integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        si.stockroom_id,
        s.name AS stockroom_name,
        si.product_id,
        si.product_type,
        si.product_description,
        si.quantity_on_hand,
        si.quantity_available,
        si.reorder_point,
        si.reorder_quantity,
        (si.reorder_point - si.quantity_available) AS shortage
    FROM stockroom_inventory si
    JOIN stockrooms s ON si.stockroom_id = s.stockroom_id
    WHERE si.is_active = TRUE
      AND si.reorder_point IS NOT NULL
      AND si.quantity_available <= si.reorder_point
      AND (p_stockroom_id IS NULL OR si.stockroom_id = p_stockroom_id)
    ORDER BY shortage DESC, s.name, si.product_description;
END;
$function$

-- FUNCTION: get_stale_assets(integer)
CREATE OR REPLACE FUNCTION public.get_stale_assets(p_days_threshold integer DEFAULT 30)
 RETURNS TABLE(asset_id uuid, asset_tag character varying, display_name character varying, serial_number character varying, mac_address macaddr, last_discovered_at timestamp with time zone, days_since_discovery integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        a.asset_id,
        a.asset_tag,
        a.display_name,
        ha.serial_number,
        ha.mac_address,
        ha.last_discovered_at,
        EXTRACT(DAY FROM NOW() - ha.last_discovered_at)::INTEGER AS days_since_discovery
    FROM assets a
    JOIN hardware_assets ha ON a.asset_id = ha.asset_id
    WHERE a.asset_type = 'HARDWARE'
      AND a.status IN ('DEPLOYED', 'IN_STOCK')
      AND (
          ha.last_discovered_at IS NULL 
          OR ha.last_discovered_at < NOW() - (p_days_threshold || ' days')::INTERVAL
      )
    ORDER BY ha.last_discovered_at ASC NULLS FIRST;
END;
$function$

-- FUNCTION: identify_reclamation_candidates(uuid)
CREATE OR REPLACE FUNCTION public.identify_reclamation_candidates(p_rule_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_rule RECORD;
    v_count INTEGER := 0;
    v_total INTEGER := 0;
BEGIN
    -- Process each active rule (or specific rule if provided)
    FOR v_rule IN 
        SELECT * FROM reclamation_rules 
        WHERE is_active = TRUE 
          AND auto_create_candidates = TRUE
          AND (p_rule_id IS NULL OR rule_id = p_rule_id)
        ORDER BY priority
    LOOP
        -- Insert candidates matching this rule
        INSERT INTO reclamation_candidates (
            installation_id,
            days_since_last_use,
            reclamation_rule_id,
            usage_at_identification,
            status
        )
        SELECT 
            si.installation_id,
            CURRENT_DATE - si.last_used_date,
            v_rule.rule_id,
            si.usage_minutes_30day,
            'IDENTIFIED'
        FROM software_installations si
        JOIN software_products sp ON si.software_product_id = sp.product_id
        WHERE si.status = 'ACTIVE'
          AND si.last_used_date IS NOT NULL
          AND (CURRENT_DATE - si.last_used_date) >= v_rule.days_since_last_use
          AND si.usage_minutes_30day <= v_rule.min_usage_minutes_30day
          -- Apply product filter if specified
          AND (v_rule.software_product_id IS NULL OR si.software_product_id = v_rule.software_product_id)
          -- Apply category filter if specified
          AND (v_rule.product_category IS NULL OR sp.product_category = v_rule.product_category)
          -- Apply publisher filter if specified
          AND (v_rule.publisher IS NULL OR sp.publisher = v_rule.publisher)
          -- Don't create duplicate candidates
          AND NOT EXISTS (
              SELECT 1 FROM reclamation_candidates rc
              WHERE rc.installation_id = si.installation_id
                AND rc.status NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED')
          );
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_total := v_total + v_count;
    END LOOP;
    
    RETURN v_total;
END;
$function$

-- FUNCTION: log_bin_location_changes()
CREATE OR REPLACE FUNCTION public.log_bin_location_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$

-- FUNCTION: log_building_changes()
CREATE OR REPLACE FUNCTION public.log_building_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$

-- FUNCTION: log_floor_changes()
CREATE OR REPLACE FUNCTION public.log_floor_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$

-- FUNCTION: log_manufacturer_changes()
CREATE OR REPLACE FUNCTION public.log_manufacturer_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$

-- FUNCTION: log_rack_changes()
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

-- FUNCTION: log_room_changes()
CREATE OR REPLACE FUNCTION public.log_room_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$

-- FUNCTION: match_discovery_to_asset(character varying,character varying)
CREATE OR REPLACE FUNCTION public.match_discovery_to_asset(p_serial_number character varying, p_mac_address character varying)
 RETURNS TABLE(asset_id uuid, match_type character varying, confidence integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Try serial number match first (highest confidence)
    IF p_serial_number IS NOT NULL AND TRIM(p_serial_number) != '' THEN
        RETURN QUERY
        SELECT 
            ha.asset_id,
            'SERIAL_NUMBER'::VARCHAR(20) AS match_type,
            100 AS confidence
        FROM hardware_assets ha
        WHERE UPPER(TRIM(ha.serial_number)) = UPPER(TRIM(p_serial_number))
        LIMIT 1;
        
        IF FOUND THEN
            RETURN;
        END IF;
    END IF;
    
    -- Try MAC address match (slightly lower confidence)
    IF p_mac_address IS NOT NULL AND TRIM(p_mac_address) != '' THEN
        RETURN QUERY
        SELECT 
            ha.asset_id,
            'MAC_ADDRESS'::VARCHAR(20) AS match_type,
            95 AS confidence
        FROM hardware_assets ha
        WHERE UPPER(REPLACE(REPLACE(REPLACE(ha.mac_address::TEXT, ':', ''), '-', ''), '.', '')) = 
              UPPER(REPLACE(REPLACE(REPLACE(p_mac_address, ':', ''), '-', ''), '.', ''))
        LIMIT 1;
        
        IF FOUND THEN
            RETURN;
        END IF;
    END IF;
    
    -- No match found
    RETURN;
END;
$function$

-- FUNCTION: normalize_manufacturer(character varying)
CREATE OR REPLACE FUNCTION public.normalize_manufacturer(p_raw_name character varying)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_normalized VARCHAR(255);
    v_manufacturer_id UUID;
BEGIN
    -- Normalize the input: uppercase, trim whitespace
    v_normalized := UPPER(TRIM(p_raw_name));
    
    -- First, try to find by normalized name
    SELECT manufacturer_id INTO v_manufacturer_id
    FROM manufacturers
    WHERE normalized_name = v_normalized;
    
    IF v_manufacturer_id IS NOT NULL THEN
        RETURN v_manufacturer_id;
    END IF;
    
    -- Try to find by alias match
    SELECT manufacturer_id INTO v_manufacturer_id
    FROM manufacturers
    WHERE v_normalized = ANY(
        SELECT UPPER(TRIM(unnest(aliases)))
    );
    
    IF v_manufacturer_id IS NOT NULL THEN
        RETURN v_manufacturer_id;
    END IF;
    
    -- If not found, create a new manufacturer entry
    INSERT INTO manufacturers (name, normalized_name)
    VALUES (p_raw_name, v_normalized)
    ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name
    RETURNING manufacturer_id INTO v_manufacturer_id;
    
    RETURN v_manufacturer_id;
END;
$function$

-- FUNCTION: normalize_model(uuid,character varying,character varying)
CREATE OR REPLACE FUNCTION public.normalize_model(p_manufacturer_id uuid, p_raw_model_name character varying, p_model_category character varying DEFAULT NULL::character varying)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_normalized VARCHAR(255);
    v_model_id UUID;
BEGIN
    -- Normalize the input: uppercase, trim whitespace
    v_normalized := UPPER(TRIM(p_raw_model_name));
    
    -- First, try to find by manufacturer and normalized name
    SELECT model_id INTO v_model_id
    FROM models
    WHERE manufacturer_id = p_manufacturer_id
      AND normalized_name = v_normalized;
    
    IF v_model_id IS NOT NULL THEN
        RETURN v_model_id;
    END IF;
    
    -- Try to find by alias match
    SELECT model_id INTO v_model_id
    FROM models
    WHERE manufacturer_id = p_manufacturer_id
      AND v_normalized = ANY(
          SELECT UPPER(TRIM(unnest(aliases)))
      );
    
    IF v_model_id IS NOT NULL THEN
        RETURN v_model_id;
    END IF;
    
    -- If not found, create a new model entry
    INSERT INTO models (manufacturer_id, model_name, normalized_name, model_category)
    VALUES (p_manufacturer_id, p_raw_model_name, v_normalized, p_model_category)
    ON CONFLICT (manufacturer_id, normalized_name) DO UPDATE 
        SET model_name = EXCLUDED.model_name,
            model_category = COALESCE(EXCLUDED.model_category, models.model_category)
    RETURNING model_id INTO v_model_id;
    
    RETURN v_model_id;
END;
$function$

-- FUNCTION: trg_manufacturers_set_defaults()
CREATE OR REPLACE FUNCTION public.trg_manufacturers_set_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.normalized_name IS NULL OR length(trim(NEW.normalized_name)) = 0 THEN
    NEW.normalized_name := upper(regexp_replace(trim(NEW.name), '\s+', ' ', 'g'));
  END IF;

  IF NEW.code IS NULL OR length(trim(NEW.code)) = 0 THEN
    NEW.code := NEW.normalized_name;
  END IF;

  RETURN NEW;
END;
$function$

-- FUNCTION: trg_models_set_defaults()
CREATE OR REPLACE FUNCTION public.trg_models_set_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$

-- FUNCTION: update_discovery_record_timestamp()
CREATE OR REPLACE FUNCTION public.update_discovery_record_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$

-- FUNCTION: update_inspection_records_updated_at()
CREATE OR REPLACE FUNCTION public.update_inspection_records_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$

-- FUNCTION: update_lease_payment_status()
CREATE OR REPLACE FUNCTION public.update_lease_payment_status()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_updated_count INTEGER := 0;
    v_temp_count INTEGER;
BEGIN
    -- Update scheduled payments that are now due
    UPDATE lease_payments
    SET status = 'DUE',
        updated_at = NOW()
    WHERE status = 'SCHEDULED'
      AND due_date <= CURRENT_DATE;
    
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_updated_count := v_updated_count + v_temp_count;
    
    -- Update due payments that are now overdue
    UPDATE lease_payments
    SET status = 'OVERDUE',
        is_late = TRUE,
        days_late = CURRENT_DATE - due_date,
        updated_at = NOW()
    WHERE status = 'DUE'
      AND due_date < CURRENT_DATE;
    
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_updated_count := v_updated_count + v_temp_count;
    
    -- Update days_late for already overdue payments
    UPDATE lease_payments
    SET days_late = CURRENT_DATE - due_date,
        updated_at = NOW()
    WHERE status = 'OVERDUE'
      AND days_late != CURRENT_DATE - due_date;
    
    RETURN v_updated_count;
END;
$function$

-- FUNCTION: update_linear_asset_segment_count()
CREATE OR REPLACE FUNCTION public.update_linear_asset_segment_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE linear_assets
        SET segment_count = (
            SELECT COUNT(*) FROM linear_asset_segments 
            WHERE linear_asset_id = NEW.linear_asset_id
        ),
        updated_at = NOW()
        WHERE linear_asset_id = NEW.linear_asset_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE linear_assets
        SET segment_count = (
            SELECT COUNT(*) FROM linear_asset_segments 
            WHERE linear_asset_id = OLD.linear_asset_id
        ),
        updated_at = NOW()
        WHERE linear_asset_id = OLD.linear_asset_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$function$

-- FUNCTION: update_overdue_loaners()
CREATE OR REPLACE FUNCTION public.update_overdue_loaners()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE loaner_checkouts
    SET is_overdue = TRUE,
        status = 'OVERDUE',
        updated_at = NOW()
    WHERE status = 'CHECKED_OUT'
      AND due_date < CURRENT_DATE
      AND is_overdue = FALSE;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$function$

-- FUNCTION: update_parent_asset_timestamp()
CREATE OR REPLACE FUNCTION public.update_parent_asset_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE assets 
    SET updated_at = NOW()
    WHERE asset_id = NEW.asset_id;
    RETURN NEW;
END;
$function$

-- FUNCTION: update_po_lines_updated_at()
CREATE OR REPLACE FUNCTION public.update_po_lines_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$

-- FUNCTION: update_purchase_orders_updated_at()
CREATE OR REPLACE FUNCTION public.update_purchase_orders_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$

-- FUNCTION: update_spare_parts_reserved()
CREATE OR REPLACE FUNCTION public.update_spare_parts_reserved()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Update the spare parts reserved quantity
        UPDATE spare_parts
        SET quantity_reserved = (
            SELECT COALESCE(SUM(quantity_reserved), 0)
            FROM work_order_parts
            WHERE part_id = NEW.part_id
            AND reservation_status IN ('RESERVED', 'PARTIALLY_RESERVED')
        ),
        updated_at = NOW()
        WHERE part_id = NEW.part_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE spare_parts
        SET quantity_reserved = (
            SELECT COALESCE(SUM(quantity_reserved), 0)
            FROM work_order_parts
            WHERE part_id = OLD.part_id
            AND reservation_status IN ('RESERVED', 'PARTIALLY_RESERVED')
        ),
        updated_at = NOW()
        WHERE part_id = OLD.part_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$function$

-- FUNCTION: update_updated_at_column()
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$

-- FUNCTION: uuid_generate_v1()
CREATE OR REPLACE FUNCTION public.uuid_generate_v1()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v1$function$

-- FUNCTION: uuid_generate_v1mc()
CREATE OR REPLACE FUNCTION public.uuid_generate_v1mc()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v1mc$function$

-- FUNCTION: uuid_generate_v3(uuid,text)
CREATE OR REPLACE FUNCTION public.uuid_generate_v3(namespace uuid, name text)
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v3$function$

-- FUNCTION: uuid_generate_v4()
CREATE OR REPLACE FUNCTION public.uuid_generate_v4()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v4$function$

-- FUNCTION: uuid_generate_v5(uuid,text)
CREATE OR REPLACE FUNCTION public.uuid_generate_v5(namespace uuid, name text)
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v5$function$

-- FUNCTION: uuid_nil()
CREATE OR REPLACE FUNCTION public.uuid_nil()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_nil$function$

-- FUNCTION: uuid_ns_dns()
CREATE OR REPLACE FUNCTION public.uuid_ns_dns()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_ns_dns$function$

-- FUNCTION: uuid_ns_oid()
CREATE OR REPLACE FUNCTION public.uuid_ns_oid()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_ns_oid$function$

-- FUNCTION: uuid_ns_url()
CREATE OR REPLACE FUNCTION public.uuid_ns_url()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_ns_url$function$

-- FUNCTION: uuid_ns_x500()
CREATE OR REPLACE FUNCTION public.uuid_ns_x500()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_ns_x500$function$

-- FUNCTION: would_create_cycle(uuid,uuid,character varying)
CREATE OR REPLACE FUNCTION public.would_create_cycle(p_source_asset_id uuid, p_target_asset_id uuid, p_relation_type character varying)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_has_cycle BOOLEAN;
BEGIN
    -- Only check for hierarchical relationship types
    IF p_relation_type NOT IN ('PARENT_CHILD', 'DEPENDENCY') THEN
        RETURN FALSE;
    END IF;
    
    -- Check if target is already an ancestor of source
    SELECT EXISTS(
        SELECT 1 
        FROM get_asset_ancestors(p_source_asset_id, p_relation_type) a
        WHERE a.ancestor_id = p_target_asset_id
    ) INTO v_has_cycle;
    
    RETURN v_has_cycle;
END;
$function$
