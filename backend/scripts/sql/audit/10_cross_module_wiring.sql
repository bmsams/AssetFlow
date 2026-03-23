WITH refs AS (
  SELECT
    (
      SELECT COUNT(*)
      FROM stockrooms s
      JOIN cost_centers cc ON cc.cost_center_id = s.cost_center_id
      WHERE s.stockroom_code IN (
        'AUD-SRC-' || {{AUDIT_RUN_KEY}}::text,
        'AUD-DST-' || {{AUDIT_RUN_KEY}}::text
      )
        AND cc.code = ('AUD-CC-' || {{AUDIT_RUN_KEY}}::text)
    ) AS stockroom_cost_center_refs,
    (
      SELECT COUNT(*)
      FROM purchase_orders po
      JOIN purchase_order_lines pol ON pol.po_id = po.po_id
      JOIN vendors v ON v.vendor_id = pol.vendor_id
      WHERE po.po_number = ('AUDPO-' || {{AUDIT_RUN_KEY}}::text)
        AND v.vendor_code = ('AUD-VND-' || {{AUDIT_RUN_KEY}}::text)
    ) AS po_vendor_refs,
    (
      SELECT COUNT(*)
      FROM audit_log al
      WHERE al.action_type = 'CREATE'
        AND al.resource_type = 'AUDIT_RUN'
        AND al.resource_id = {{AUDIT_RUN_UUID}}::uuid
    ) AS audit_log_refs
)
SELECT
  'cross_module_wiring' AS check_name,
  (stockroom_cost_center_refs = 2 AND po_vendor_refs >= 1 AND audit_log_refs >= 1) AS check_pass,
  format(
    'stockroom_cost_center_refs=%s po_vendor_refs=%s audit_log_refs=%s',
    stockroom_cost_center_refs,
    po_vendor_refs,
    audit_log_refs
  ) AS detail
FROM refs;
