WITH transfer_ctx AS (
  SELECT t.transfer_id, t.from_stockroom_id, t.to_stockroom_id
  FROM transfer_orders t
  WHERE t.transfer_number = ('AUDTR-' || {{AUDIT_RUN_KEY}}::text)
  LIMIT 1
),
counts AS (
  SELECT
    (SELECT COUNT(*) FROM transfer_ctx) AS transfer_count,
    (
      SELECT COUNT(*)
      FROM transfer_order_lines tl
      JOIN transfer_ctx t ON t.transfer_id = tl.transfer_id
    ) AS line_count,
    (
      SELECT COUNT(*)
      FROM stockroom_inventory si
      JOIN transfer_ctx t ON t.from_stockroom_id = si.stockroom_id
      WHERE si.product_type = 'HARDWARE_MODEL'
        AND si.quantity_on_hand >= 5
    ) AS source_inventory_ready
)
SELECT
  'ham_transfer_chain' AS check_name,
  (transfer_count = 1 AND line_count >= 1 AND source_inventory_ready >= 1) AS check_pass,
  format('transfer=%s lines=%s source_inventory_ready=%s', transfer_count, line_count, source_inventory_ready) AS detail
FROM counts;
