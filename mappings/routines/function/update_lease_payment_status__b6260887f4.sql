-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: update_lease_payment_status()

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
