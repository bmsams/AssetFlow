WITH po_ctx AS (
  SELECT po.po_id
  FROM purchase_orders po
  WHERE po.po_number = ('AUDPO-' || {{AUDIT_RUN_KEY}}::text)
  LIMIT 1
),
counts AS (
  SELECT
    (SELECT COUNT(*) FROM po_ctx) AS po_count,
    (
      SELECT COUNT(*)
      FROM purchase_order_lines pol
      JOIN po_ctx po ON po.po_id = pol.po_id
    ) AS po_line_count,
    (
      SELECT COUNT(*)
      FROM receiving_records rr
      JOIN po_ctx po ON po.po_id = rr.po_id
      WHERE rr.receiving_number = ('AUDRCV-' || {{AUDIT_RUN_KEY}}::text)
    ) AS receiving_count,
    (
      SELECT COUNT(*)
      FROM receiving_lines rl
      JOIN receiving_records rr ON rr.receiving_id = rl.receiving_id
      JOIN po_ctx po ON po.po_id = rr.po_id
    ) AS receiving_line_count
)
SELECT
  'procurement_to_receiving_chain' AS check_name,
  (po_count = 1 AND po_line_count >= 1 AND receiving_count = 1 AND receiving_line_count >= 1) AS check_pass,
  format(
    'po=%s po_lines=%s receiving=%s receiving_lines=%s',
    po_count,
    po_line_count,
    receiving_count,
    receiving_line_count
  ) AS detail
FROM counts;
