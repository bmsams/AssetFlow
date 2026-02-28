#!/usr/bin/env python3
"""Parse extracted schema JSON files and generate ERD diagram + product report."""
import json
from collections import defaultdict

def load_json(path):
    with open(path, 'r', encoding='utf-8-sig') as f:
        return json.load(f)

def extract_values(record):
    """Extract values from RDS Data API record format."""
    vals = []
    for cell in record:
        if 'stringValue' in cell:
            vals.append(cell['stringValue'])
        elif 'longValue' in cell:
            vals.append(cell['longValue'])
        elif 'booleanValue' in cell:
            vals.append(cell['booleanValue'])
        elif 'isNull' in cell:
            vals.append(None)
        else:
            vals.append(str(cell))
    return vals

# ── Load all schema data ──
columns_data = load_json('schema_columns.json')
constraints_data = load_json('schema_constraints.json')
indexes_data = load_json('schema_indexes.json')
triggers_data = load_json('schema_triggers.json')
functions_data = load_json('schema_functions.json')
views_data = load_json('schema_views.json')

# ── Parse columns ──
tables = defaultdict(list)
for rec in columns_data['records']:
    vals = extract_values(rec)
    table, col, dtype, nullable, default, max_len = vals
    tables[table].append({
        'column': col, 'type': dtype, 'nullable': nullable,
        'default': default, 'max_length': max_len
    })

# ── Parse constraints ──
pks = defaultdict(list)       # table -> [pk_columns]
fks = defaultdict(list)       # table -> [{col, ref_table, ref_col}]
uniques = defaultdict(list)   # table -> [unique_columns]
checks = defaultdict(list)

for rec in constraints_data['records']:
    vals = extract_values(rec)
    table, cname, ctype, col, ref_table, ref_col = vals
    if ctype == 'PRIMARY KEY':
        pks[table].append(col)
    elif ctype == 'FOREIGN KEY':
        fks[table].append({'column': col, 'ref_table': ref_table, 'ref_col': ref_col, 'name': cname})
    elif ctype == 'UNIQUE':
        uniques[table].append({'column': col, 'name': cname})
    elif ctype == 'CHECK':
        checks[table].append({'name': cname, 'column': col})

# ── Parse indexes ──
indexes = defaultdict(list)
for rec in indexes_data['records']:
    vals = extract_values(rec)
    table, idx_name, idx_def = vals
    indexes[table].append({'name': idx_name, 'definition': idx_def})

# ── Parse triggers ──
triggers = []
for rec in triggers_data['records']:
    vals = extract_values(rec)
    trig_name, event, obj_table, action, timing = vals
    triggers.append({'name': trig_name, 'event': event, 'table': obj_table, 'action': action, 'timing': timing})

# ── Parse functions ──
functions = []
for rec in functions_data['records']:
    vals = extract_values(rec)
    schema, fname, fdef = vals
    functions.append({'name': fname, 'definition': fdef})

# ── Parse views ──
views = []
for rec in views_data['records']:
    vals = extract_values(rec)
    vname, vdef = vals
    views.append({'name': vname, 'definition': vdef})

# ── Sort tables (exclude views and schema_migrations) ──
real_tables = sorted([t for t in tables.keys() if not t.startswith('v_') and t != 'schema_migrations'])

# ══════════════════════════════════════════════════════════════════
# Generate Mermaid ERD
# ══════════════════════════════════════════════════════════════════
mermaid_lines = ['erDiagram']

type_map = {
    'uuid': 'UUID', 'character varying': 'VARCHAR', 'text': 'TEXT',
    'integer': 'INT', 'bigint': 'BIGINT', 'smallint': 'SMALLINT',
    'boolean': 'BOOLEAN', 'numeric': 'NUMERIC', 'date': 'DATE',
    'timestamp with time zone': 'TIMESTAMPTZ', 'timestamp without time zone': 'TIMESTAMP',
    'jsonb': 'JSONB', 'json': 'JSON', 'inet': 'INET', 'ARRAY': 'ARRAY',
    'double precision': 'DOUBLE', 'real': 'REAL',
    'USER-DEFINED': 'ENUM',
}

for table in real_tables:
    cols = tables[table]
    pk_cols = set(pks.get(table, []))
    fk_cols = {f['column'] for f in fks.get(table, [])}
    
    mermaid_lines.append(f'    {table} {{')
    for c in cols:
        t = type_map.get(c['type'], c['type'].upper())
        if c['max_length']:
            t = f"{t}_{c['max_length']}"
        markers = []
        if c['column'] in pk_cols:
            markers.append('PK')
        if c['column'] in fk_cols:
            markers.append('FK')
        marker_str = f' "{",".join(markers)}"' if markers else ''
        mermaid_lines.append(f'        {t} {c["column"]}{marker_str}')
    mermaid_lines.append('    }')

# Add relationships
seen_rels = set()
for table in real_tables:
    for fk in fks.get(table, []):
        ref = fk['ref_table']
        if ref in real_tables or ref in tables:
            rel_key = f"{table}-{ref}-{fk['column']}"
            if rel_key not in seen_rels:
                seen_rels.add(rel_key)
                mermaid_lines.append(f'    {table} }}o--|| {ref} : "{fk["column"]}"')

mermaid_erd = '\n'.join(mermaid_lines)

# ══════════════════════════════════════════════════════════════════
# Generate the full report
# ══════════════════════════════════════════════════════════════════
report = []
report.append('# AMS Database Schema — ERD & Product Report')
report.append('')
report.append(f'Generated from live Aurora PostgreSQL database: `assetmgmt`')
report.append(f'Cluster: `ams-dev-database`  |  Region: `us-east-1`')
report.append(f'')
report.append(f'---')
report.append(f'')

# ── Summary stats ──
report.append('## Summary')
report.append('')
report.append(f'| Metric | Count |')
report.append(f'|--------|-------|')
report.append(f'| Tables | {len(real_tables)} |')
report.append(f'| Views | {len(views)} |')
report.append(f'| Functions | {len(functions)} |')
report.append(f'| Triggers | {len(set(t["name"] for t in triggers))} |')
total_fks = sum(len(v) for v in fks.values())
total_indexes = sum(len(v) for v in indexes.values())
report.append(f'| Foreign Keys | {total_fks} |')
report.append(f'| Indexes | {total_indexes} |')
report.append('')

# ── Domain grouping ──
report.append('## Domain Grouping')
report.append('')

domain_groups = {
    'Core Asset Management': ['assets', 'asset_relationships', 'audit_log'],
    'Hardware Asset Management (HAM)': ['hardware_assets', 'stockrooms', 'stockroom_inventory', 'stockroom_rules', 'bin_locations', 'racks', 'loaner_checkouts', 'audit_records', 'audit_scans'],
    'Software Asset Management (SAM)': ['software_assets', 'software_products', 'software_installations', 'entitlements', 'saas_subscriptions', 'reclamation_rules', 'reclamation_candidates', 'reconciliation_results'],
    'Enterprise Asset Management (EAM)': ['enterprise_assets', 'maintenance_plans', 'work_orders', 'work_order_parts', 'spare_parts', 'linear_assets', 'linear_asset_segments', 'inspection_records'],
    'Procurement & Lifecycle': ['purchase_orders', 'purchase_order_lines', 'po_lines', 'receiving_records', 'receiving_lines', 'transfer_orders', 'transfer_order_lines', 'approval_records', 'approval_thresholds', 'approval_delegations'],
    'Financial': ['contracts', 'depreciation_schedules', 'lease_payments', 'cost_centers', 'vendor_model_prices'],
    'Location & Facilities': ['buildings', 'floors', 'rooms', 'facilities'],
    'Organization & Reference': ['users', 'roles', 'permissions', 'role_permissions', 'user_roles', 'departments', 'manufacturers', 'models', 'vendors'],
    'Discovery & Integration': ['discovery_records', 'discovery_source_configs'],
}

for group, group_tables in domain_groups.items():
    existing = [t for t in group_tables if t in real_tables]
    report.append(f'### {group}')
    report.append(f'Tables: {", ".join(f"`{t}`" for t in existing)}')
    report.append('')

# ── ERD Diagram ──
report.append('## Entity Relationship Diagram')
report.append('')
report.append('```mermaid')
report.append(mermaid_erd)
report.append('```')
report.append('')

# ── Table Details ──
report.append('## Table Details')
report.append('')

for table in real_tables:
    cols = tables[table]
    pk_cols = set(pks.get(table, []))
    fk_list = fks.get(table, [])
    fk_cols_set = {f['column'] for f in fk_list}
    idx_list = indexes.get(table, [])
    uniq_list = uniques.get(table, [])
    
    report.append(f'### `{table}`')
    report.append('')
    report.append(f'| Column | Type | Nullable | Default | Key |')
    report.append(f'|--------|------|----------|---------|-----|')
    for c in cols:
        t = c['type']
        if c['max_length']:
            t = f"{t}({c['max_length']})"
        keys = []
        if c['column'] in pk_cols:
            keys.append('PK')
        if c['column'] in fk_cols_set:
            keys.append('FK')
        key_str = ', '.join(keys)
        default = c['default'] if c['default'] else ''
        report.append(f'| {c["column"]} | {t} | {c["nullable"]} | {default} | {key_str} |')
    
    if fk_list:
        report.append('')
        report.append('Foreign Keys:')
        for fk in fk_list:
            report.append(f'- `{fk["column"]}` → `{fk["ref_table"]}.{fk["ref_col"]}` ({fk["name"]})')
    
    if idx_list:
        report.append('')
        report.append('Indexes:')
        for idx in idx_list:
            report.append(f'- `{idx["name"]}`: `{idx["definition"]}`')
    
    report.append('')

# ── Functions ──
report.append('## Functions')
report.append('')
for fn in functions:
    report.append(f'### `{fn["name"]}`')
    report.append('')
    report.append('```sql')
    report.append(fn['definition'])
    report.append('```')
    report.append('')

# ── Triggers ──
report.append('## Triggers')
report.append('')
report.append('| Trigger | Table | Event | Timing | Action |')
report.append('|---------|-------|-------|--------|--------|')
seen_triggers = set()
for t in triggers:
    key = f"{t['name']}-{t['table']}-{t['event']}"
    if key not in seen_triggers:
        seen_triggers.add(key)
        action_short = t['action'].replace('\n', ' ').strip()
        report.append(f'| {t["name"]} | {t["table"]} | {t["event"]} | {t["timing"]} | {action_short} |')
report.append('')

# ── Views ──
report.append('## Views')
report.append('')
for v in views:
    report.append(f'### `{v["name"]}`')
    report.append('')
    report.append('```sql')
    report.append(v['definition'].strip())
    report.append('```')
    report.append('')

# ── Write report ──
with open('AMS_DATABASE_ERD_REPORT.md', 'w', encoding='utf-8') as f:
    f.write('\n'.join(report))

print(f"Report generated: AMS_DATABASE_ERD_REPORT.md")
print(f"  Tables: {len(real_tables)}")
print(f"  Views: {len(views)}")
print(f"  Functions: {len(functions)}")
print(f"  Triggers: {len(set(t['name'] for t in triggers))}")
print(f"  Foreign Keys: {total_fks}")
print(f"  Indexes: {total_indexes}")
