WITH ctx AS (
  SELECT {{AUDIT_RUN_KEY}}::text AS run_key
),
counts AS (
  SELECT
    (SELECT COUNT(*) FROM buildings b, ctx WHERE b.building_code = 'AUD-BLD-' || ctx.run_key) AS building_count,
    (
      SELECT COUNT(*)
      FROM floors f
      JOIN buildings b ON b.building_id = f.building_id
      JOIN ctx ON TRUE
      WHERE b.building_code = 'AUD-BLD-' || ctx.run_key
    ) AS floor_count,
    (
      SELECT COUNT(*)
      FROM rooms r
      JOIN floors f ON f.floor_id = r.floor_id
      JOIN buildings b ON b.building_id = f.building_id
      JOIN ctx ON TRUE
      WHERE b.building_code = 'AUD-BLD-' || ctx.run_key
    ) AS room_count,
    (
      SELECT COUNT(*)
      FROM racks k
      JOIN rooms r ON r.room_id = k.room_id
      JOIN floors f ON f.floor_id = r.floor_id
      JOIN buildings b ON b.building_id = f.building_id
      JOIN ctx ON TRUE
      WHERE b.building_code = 'AUD-BLD-' || ctx.run_key
    ) AS rack_count,
    (
      SELECT COUNT(*)
      FROM stockrooms s
      JOIN ctx ON TRUE
      WHERE s.stockroom_code IN ('AUD-SRC-' || ctx.run_key, 'AUD-DST-' || ctx.run_key)
    ) AS stockroom_count
)
SELECT
  'admin_master_data_hierarchy' AS check_name,
  (
    building_count = 1
    AND floor_count >= 1
    AND room_count >= 1
    AND rack_count >= 1
    AND stockroom_count = 2
  ) AS check_pass,
  format(
    'building=%s floor=%s room=%s rack=%s stockrooms=%s',
    building_count,
    floor_count,
    room_count,
    rack_count,
    stockroom_count
  ) AS detail
FROM counts;
