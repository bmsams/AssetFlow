"""Extract full database schema from Aurora via RDS Data API."""
import json
import subprocess
import sys

RESOURCE_ARN = "arn:aws:rds:us-east-1:764184373468:cluster:ams-dev-database-assetdatabase46a48a83-liltpjc5oxtn"
SECRET_ARN = "arn:aws:secretsmanager:us-east-1:764184373468:secret:ams-dev/database/credentials-5zePGU"
DATABASE = "assetmgmt"
REGION = "us-east-1"

def run_sql(sql: str) -> dict:
    cmd = [
        "aws", "rds-data", "execute-statement",
        "--resource-arn", RESOURCE_ARN,
        "--secret-arn", SECRET_ARN,
        "--database", DATABASE,
        "--sql", sql,
        "--region", REGION,
        "--include-result-metadata",
        "--output", "json"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        print(f"ERROR: {result.stderr}", file=sys.stderr)
        return {"records": [], "columnMetadata": []}
    return json.loads(result.stdout)

def parse_rows(response: dict) -> list[dict]:
    cols = [m["name"] for m in response.get("columnMetadata", [])]
    rows = []
    for record in response.get("records", []):
        row = {}
        for i, field in enumerate(record):
            if "stringValue" in field:
                row[cols[i]] = field["stringValue"]
            elif "longValue" in field:
                row[cols[i]] = field["longValue"]
            elif "booleanValue" in field:
                row[cols[i]] = field["booleanValue"]
            elif "isNull" in field and field["isNull"]:
                row[cols[i]] = None
            else:
                row[cols[i]] = str(field)
        rows.append(row)
    return rows

schema = {}

# 1. Tables and columns
print("Extracting tables and columns...")
resp = run_sql("""
SELECT t.table_name, c.column_name, c.data_type, c.is_nullable, 
       c.column_default, c.character_maximum_length, c.ordinal_position
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position
""")
tables_raw = parse_rows(resp)
tables = {}
for r in tables_raw:
    tn = r["table_name"]
    if tn not in tables:
        tables[tn] = {"columns": []}
    tables[tn]["columns"].append({
        "name": r["column_name"],
        "type": r["data_type"],
        "nullable": r["is_nullable"] == "YES",
        "default": r.get("column_default"),
        "max_length": r.get("character_maximum_length"),
    })
schema["tables"] = tables
print(f"  Found {len(tables)} tables, {len(tables_raw)} columns")

# 2. Foreign keys
print("Extracting foreign keys...")
resp = run_sql("""
SELECT tc.constraint_name, tc.table_name, kcu.column_name,
       ccu.table_name AS foreign_table, ccu.column_name AS foreign_column,
       rc.update_rule, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name
""")
fks = parse_rows(resp)
schema["foreign_keys"] = fks
print(f"  Found {len(fks)} foreign keys")

# 3. Triggers
print("Extracting triggers...")
resp = run_sql("""
SELECT trigger_name, event_object_table, action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name
""")
triggers = parse_rows(resp)
schema["triggers"] = triggers
print(f"  Found {len(triggers)} triggers")

# 4. Views
print("Extracting views...")
resp = run_sql("""
SELECT table_name as view_name, view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name
""")
views = parse_rows(resp)
schema["views"] = views
print(f"  Found {len(views)} views")

# 5. Indexes
print("Extracting indexes...")
resp = run_sql("""
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname
""")
indexes = parse_rows(resp)
schema["indexes"] = indexes
print(f"  Found {len(indexes)} indexes")

# 6. Primary keys
print("Extracting primary keys...")
resp = run_sql("""
SELECT tc.table_name, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name
""")
pks = parse_rows(resp)
schema["primary_keys"] = pks
print(f"  Found {len(pks)} primary key columns")

# 7. Unique constraints
print("Extracting unique constraints...")
resp = run_sql("""
SELECT tc.table_name, tc.constraint_name, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name
""")
uniques = parse_rows(resp)
schema["unique_constraints"] = uniques
print(f"  Found {len(uniques)} unique constraint columns")

# 8. Functions (stored procedures / trigger functions)
print("Extracting functions...")
resp = run_sql("""
SELECT routine_name, routine_type, data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name
""")
functions = parse_rows(resp)
schema["functions"] = functions
print(f"  Found {len(functions)} functions")

# Write output
with open("mappings/db_schema.json", "w") as f:
    json.dump(schema, f, indent=2, default=str)
print("\nSchema written to mappings/db_schema.json")
