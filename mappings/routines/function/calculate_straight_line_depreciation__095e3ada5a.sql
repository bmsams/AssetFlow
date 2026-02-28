-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: calculate_straight_line_depreciation(uuid,numeric,numeric,integer,date)

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
