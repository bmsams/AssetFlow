WITH transfer_line AS (
  SELECT
    t.from_stockroom_id,
    t.to_stockroom_id,
    tl.quantity,
    tl.product_id
  FROM transfer_orders t
  JOIN transfer_order_lines tl ON tl.transfer_id = t.transfer_id
  WHERE t.transfer_number = ('AUDTR-' || {{AUDIT_RUN_KEY}}::text)
  LIMIT 1
),
checks AS (
  SELECT
    (SELECT COUNT(*) FROM transfer_line) AS line_count,
    (
      SELECT COUNT(*)
      FROM transfer_line t
      WHERE t.from_stockroom_id <> t.to_stockroom_id
    ) AS distinct_stockrooms,
    (
      SELECT COUNT(*)
      FROM transfer_line t
      JOIN stockroom_inventory si
        ON si.stockroom_id = t.from_stockroom_id
       AND si.product_id = t.product_id
      WHERE si.quantity_on_hand >= t.quantity
    ) AS quantity_guard_ok
)
SELECT
  'ham_edge_case_guards' AS check_name,
  (line_count = 1 AND distinct_stockrooms = 1 AND quantity_guard_ok = 1) AS check_pass,
  format('line=%s distinct_stockrooms=%s quantity_guard=%s', line_count, distinct_stockrooms, quantity_guard_ok) AS detail
FROM checks;
