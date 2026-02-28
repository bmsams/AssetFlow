"""
Build updated dependency mappings from DB schema + code scanning.
Produces: flows.json, graph.json, tables.json, gaps.json, last_run.json
"""
import json
import os
import re
import glob
from datetime import datetime, timezone

# Load DB schema
with open("mappings/db_schema.json") as f:
    db_schema = json.load(f)

DB_TABLES = set(db_schema["tables"].keys())
DB_VIEWS = {v["view_name"] for v in db_schema["views"]}
DB_FK_MAP = {}  # table -> [{column, foreign_table, foreign_column, delete_rule, update_rule}]
for fk in db_schema["foreign_keys"]:
    t = fk["table_name"]
    if t not in DB_FK_MAP:
        DB_FK_MAP[t] = []
    DB_FK_MAP[t].append(fk)

DB_TRIGGER_MAP = {}  # table -> [trigger]
for tr in db_schema["triggers"]:
    t = tr["event_object_table"]
    if t not in DB_TRIGGER_MAP:
        DB_TRIGGER_MAP[t] = []
    DB_TRIGGER_MAP[t].append(tr)

DB_INDEX_MAP = {}  # table -> [index]
for idx in db_schema["indexes"]:
    t = idx["tablename"]
    if t not in DB_INDEX_MAP:
        DB_INDEX_MAP[t] = []
    DB_INDEX_MAP[t].append(idx)

DB_PK_MAP = {}  # table -> [column]
for pk in db_schema["primary_keys"]:
    t = pk["table_name"]
    if t not in DB_PK_MAP:
        DB_PK_MAP[t] = []
    DB_PK_MAP[t].append(pk["column_name"])

print(f"DB: {len(DB_TABLES)} tables, {len(DB_VIEWS)} views, {len(db_schema['foreign_keys'])} FKs, {len(db_schema['indexes'])} indexes")

# ============================================================
# Phase 2: Backend Code Scanning
# ============================================================
print("\n=== Phase 2: Backend Code Scanning ===")

BACKEND_ROOT = "backend/packages"
SERVICE_DIRS = [
    "services/asset-service",
    "services/ham-service",
    "services/sam-service",
    "services/eam-service",
    "services/lifecycle-service",
    "services/integration-service",
    "services/admin-service",
    "services/notification-service",
    "services/procurement-service",
    "services/report-service",
]
SHARED_PACKAGES = ["types", "utils", "database", "cache", "events", "search"]

# Regex patterns for extracting info from TS files
TABLE_REF_PATTERN = re.compile(r"""(?:FROM|INTO|UPDATE|JOIN|TABLE)\s+['"`]?(\w+)['"`]?""", re.IGNORECASE)
TABLE_STRING_PATTERN = re.compile(r"""['"`]((?:public\.)?[a-z_]+)['"`]""")
HANDLER_EXPORT_PATTERN = re.compile(r"""export\s+(?:const|async\s+function)\s+handler""")
SNS_PUBLISH_PATTERN = re.compile(r"""(?:publish|sns\.publish|eventPublisher|publishEvent)""", re.IGNORECASE)
SQS_PATTERN = re.compile(r"""(?:sendMessage|sqs\.send|sqsClient)""", re.IGNORECASE)
CACHE_PATTERN = re.compile(r"""(?:cacheService|redis|getFromCache|setInCache|invalidateCache|cacheClient)""", re.IGNORECASE)
IMPORT_PATTERN = re.compile(r"""(?:import|from)\s+['"](@ams/\w+)['"]""")

def scan_ts_file(filepath):
    """Scan a TypeScript file and extract references."""
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except Exception:
        return None

    tables_found = set()
    # Look for SQL table references
    for m in TABLE_REF_PATTERN.finditer(content):
        name = m.group(1).lower().replace("public.", "")
        if name in DB_TABLES:
            tables_found.add(name)
    # Also check string literals that match table names
    for m in TABLE_STRING_PATTERN.finditer(content):
        name = m.group(1).lower().replace("public.", "")
        if name in DB_TABLES:
            tables_found.add(name)

    has_handler = bool(HANDLER_EXPORT_PATTERN.search(content))
    has_sns = bool(SNS_PUBLISH_PATTERN.search(content))
    has_sqs = bool(SQS_PATTERN.search(content))
    has_cache = bool(CACHE_PATTERN.search(content))
    imports = set(IMPORT_PATTERN.findall(content))

    return {
        "tables": list(tables_found),
        "has_handler": has_handler,
        "has_sns": has_sns,
        "has_sqs": has_sqs,
        "has_cache": has_cache,
        "imports": list(imports),
    }

# Scan all backend services
service_map = {}  # service_name -> {handlers: [], repositories: [], services: [], tables: set}
handler_files = []  # All handler files found
files_processed = 0

for svc_dir in SERVICE_DIRS:
    svc_path = os.path.join(BACKEND_ROOT, svc_dir)
    svc_name = os.path.basename(svc_dir)
    if not os.path.isdir(svc_path):
        print(f"  SKIP (not found): {svc_path}")
        continue

    svc_info = {"handlers": [], "repositories": [], "services": [], "tables": set(), "events": False, "cache": False, "imports": set()}

    for root, dirs, files in os.walk(svc_path):
        # Skip node_modules, __tests__, dist
        dirs[:] = [d for d in dirs if d not in ("node_modules", "__tests__", "dist", ".turbo")]
        for fname in files:
            if not fname.endswith(".ts"):
                continue
            fpath = os.path.join(root, fname)
            rel_path = fpath.replace("\\", "/")
            files_processed += 1
            info = scan_ts_file(fpath)
            if not info:
                continue

            svc_info["tables"].update(info["tables"])
            svc_info["imports"].update(info["imports"])
            if info["has_sns"] or info["has_sqs"]:
                svc_info["events"] = True
            if info["has_cache"]:
                svc_info["cache"] = True

            # Classify file
            rel_from_svc = os.path.relpath(fpath, svc_path).replace("\\", "/")
            if "handler" in rel_from_svc.lower() or info["has_handler"]:
                svc_info["handlers"].append({"file": rel_from_svc, "tables": info["tables"], "has_handler_export": info["has_handler"]})
                handler_files.append({"service": svc_name, "file": rel_from_svc, "full_path": rel_path, "tables": info["tables"]})
            elif "repository" in rel_from_svc.lower():
                svc_info["repositories"].append({"file": rel_from_svc, "tables": info["tables"]})
            elif "service" in rel_from_svc.lower():
                svc_info["services"].append({"file": rel_from_svc, "tables": info["tables"]})

    svc_info["tables"] = sorted(svc_info["tables"])
    svc_info["imports"] = sorted(svc_info["imports"])
    service_map[svc_name] = svc_info
    print(f"  {svc_name}: {len(svc_info['handlers'])} handlers, {len(svc_info['tables'])} tables, events={svc_info['events']}, cache={svc_info['cache']}")

# Scan shared packages
shared_map = {}
for pkg in SHARED_PACKAGES:
    pkg_path = os.path.join(BACKEND_ROOT, pkg)
    if not os.path.isdir(pkg_path):
        continue
    pkg_info = {"files": [], "tables": set(), "exports": []}
    for root, dirs, files in os.walk(pkg_path):
        dirs[:] = [d for d in dirs if d not in ("node_modules", "__tests__", "dist", ".turbo")]
        for fname in files:
            if not fname.endswith(".ts"):
                continue
            fpath = os.path.join(root, fname)
            files_processed += 1
            info = scan_ts_file(fpath)
            if info:
                pkg_info["tables"].update(info["tables"])
                pkg_info["files"].append(os.path.relpath(fpath, pkg_path).replace("\\", "/"))
    pkg_info["tables"] = sorted(pkg_info["tables"])
    shared_map[pkg] = pkg_info
    print(f"  @ams/{pkg}: {len(pkg_info['files'])} files, {len(pkg_info['tables'])} tables")

print(f"\nBackend: {files_processed} TS files processed")

# ============================================================
# Phase 3: Frontend Code Scanning
# ============================================================
print("\n=== Phase 3: Frontend Code Scanning ===")

FRONTEND_ROOT = "frontend/src"
API_CALL_PATTERN = re.compile(r"""(?:apiClient|fetch|axios)\s*[.(]\s*['"`]([^'"`]+)['"`]""")
API_METHOD_PATTERN = re.compile(r"""(?:\.get|\.post|\.put|\.patch|\.delete)\s*[<(]\s*['"`]?([^'"`),]+)""")
ROUTE_PATTERN = re.compile(r"""(?:path|to)\s*[:=]\s*['"`](/[^'"`]+)['"`]""")
API_URL_PATTERN = re.compile(r"""['"`](/(?:api/v1|v1|assets|ham|sam|eam|lifecycle|integration)[^'"`]*)['"`]""", re.IGNORECASE)

frontend_pages = {}  # page_name -> {file, routes, api_calls}
frontend_api_clients = {}  # client_name -> {file, endpoints}
frontend_routes = []

# Scan frontend services (API clients)
svc_dir = os.path.join(FRONTEND_ROOT, "services")
if os.path.isdir(svc_dir):
    for fname in os.listdir(svc_dir):
        if not fname.endswith(".ts") and not fname.endswith(".tsx"):
            continue
        fpath = os.path.join(svc_dir, fname)
        files_processed += 1
        try:
            with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except Exception:
            continue

        endpoints = []
        for m in API_URL_PATTERN.finditer(content):
            endpoints.append(m.group(1))
        for m in API_METHOD_PATTERN.finditer(content):
            ep = m.group(1).strip()
            if ep.startswith("/") or ep.startswith("$"):
                endpoints.append(ep)

        client_name = fname.replace(".ts", "").replace(".tsx", "")
        frontend_api_clients[client_name] = {
            "file": f"services/{fname}",
            "endpoints": sorted(set(endpoints)),
        }
        print(f"  API client: {client_name} -> {len(endpoints)} endpoints")

# Scan frontend pages
pages_dir = os.path.join(FRONTEND_ROOT, "pages")
if os.path.isdir(pages_dir):
    for root, dirs, files in os.walk(pages_dir):
        dirs[:] = [d for d in dirs if d not in ("node_modules", "__tests__")]
        for fname in files:
            if not fname.endswith(".tsx") and not fname.endswith(".ts"):
                continue
            fpath = os.path.join(root, fname)
            files_processed += 1
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
            except Exception:
                continue

            api_calls = []
            for m in API_URL_PATTERN.finditer(content):
                api_calls.append(m.group(1))

            routes = []
            for m in ROUTE_PATTERN.finditer(content):
                routes.append(m.group(1))

            # Check which API clients are imported
            imported_clients = re.findall(r"""from\s+['"].*?/services/([^'"/]+)['"]""", content)

            page_name = os.path.relpath(fpath, pages_dir).replace("\\", "/").replace(".tsx", "").replace(".ts", "")
            frontend_pages[page_name] = {
                "file": os.path.relpath(fpath, FRONTEND_ROOT).replace("\\", "/"),
                "api_calls": sorted(set(api_calls)),
                "routes": sorted(set(routes)),
                "imported_clients": imported_clients,
            }

# Scan router/routes file
for route_file in ["App.tsx", "routes.tsx", "router.tsx", "Routes.tsx"]:
    rpath = os.path.join(FRONTEND_ROOT, route_file)
    if os.path.isfile(rpath):
        try:
            with open(rpath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            for m in ROUTE_PATTERN.finditer(content):
                frontend_routes.append(m.group(1))
        except Exception:
            pass

# Also check for routes in a routes directory
routes_dir = os.path.join(FRONTEND_ROOT, "routes")
if os.path.isdir(routes_dir):
    for fname in os.listdir(routes_dir):
        if fname.endswith(".tsx") or fname.endswith(".ts"):
            fpath = os.path.join(routes_dir, fname)
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                for m in ROUTE_PATTERN.finditer(content):
                    frontend_routes.append(m.group(1))
            except Exception:
                pass

frontend_routes = sorted(set(frontend_routes))
print(f"  Pages: {len(frontend_pages)}, API clients: {len(frontend_api_clients)}, Routes: {len(frontend_routes)}")

# ============================================================
# Phase 3b: CDK API Routes Scanning
# ============================================================
print("\n=== Phase 3b: CDK API Routes ===")

cdk_routes = []  # {method, path, handler_path, service}
api_stack_file = "stacks/api_lambda_stack.py"
if os.path.isfile(api_stack_file):
    with open(api_stack_file, "r", encoding="utf-8") as f:
        cdk_content = f.read()

    # Pattern: add_method("GET", ...) or resource.add_method(...)
    # Also look for add_resource patterns
    resource_pattern = re.compile(r"""(\w+)\s*=\s*\w+\.add_resource\(\s*['"]([^'"]+)['"]""")
    method_pattern = re.compile(r"""(\w+)\.add_method\(\s*['"](\w+)['"]""")
    lambda_handler_pattern = re.compile(r"""handler\s*=\s*['"]([^'"]+)['"]""")

    # Simpler: find all route definitions by looking for patterns
    route_blocks = re.findall(
        r"""add_method\(\s*['"](\w+)['"].*?(?:handler|entry)\s*=\s*['"]([^'"]+)['"]""",
        cdk_content, re.DOTALL
    )
    # Also find resource paths
    resources = re.findall(r"""add_resource\(\s*['"]([^'"]+)['"]""", cdk_content)

    print(f"  CDK routes found: {len(route_blocks)} methods, {len(resources)} resources")

    # Extract full route info from the CDK file more carefully
    lines = cdk_content.split("\n")
    current_resource_path = ""
    for line in lines:
        res_match = re.search(r"""add_resource\(\s*['"]([^'"]+)['"]""", line)
        if res_match:
            current_resource_path = res_match.group(1)
        method_match = re.search(r"""add_method\(\s*['"](\w+)['"]""", line)
        if method_match:
            cdk_routes.append({
                "method": method_match.group(1),
                "resource_hint": current_resource_path,
            })

print(f"  Total CDK route entries: {len(cdk_routes)}")

# ============================================================
# Phase 4: Assembly
# ============================================================
print("\n=== Phase 4: Assembly ===")

# --- tables.json ---
tables_json = {}
for table_name in sorted(DB_TABLES):
    cols = db_schema["tables"][table_name]["columns"]
    fks = DB_FK_MAP.get(table_name, [])
    triggers = DB_TRIGGER_MAP.get(table_name, [])
    indexes = DB_INDEX_MAP.get(table_name, [])
    pks = DB_PK_MAP.get(table_name, [])

    # Find which services reference this table
    owning_services = []
    for svc_name, svc_info in service_map.items():
        if table_name in svc_info["tables"]:
            owning_services.append(svc_name)

    tables_json[table_name] = {
        "columns": [c["name"] for c in cols],
        "column_count": len(cols),
        "primary_key": pks,
        "foreign_keys": [
            {
                "column": fk["column_name"],
                "references": f"{fk['foreign_table']}.{fk['foreign_column']}",
                "on_delete": fk.get("delete_rule", "NO ACTION"),
                "on_update": fk.get("update_rule", "NO ACTION"),
            }
            for fk in fks
        ],
        "triggers": [
            {
                "name": tr["trigger_name"],
                "timing": tr["action_timing"],
                "event": tr["event_manipulation"],
            }
            for tr in triggers
        ],
        "index_count": len(indexes),
        "indexes": [idx["indexname"] for idx in indexes],
        "owning_services": owning_services,
    }

# Add views
for view in db_schema["views"]:
    vname = view["view_name"]
    # Find which tables the view references
    vdef = (view.get("view_definition") or "").lower()
    referenced_tables = [t for t in DB_TABLES if t in vdef]
    tables_json[f"VIEW:{vname}"] = {
        "type": "view",
        "referenced_tables": referenced_tables,
        "definition_preview": (view.get("view_definition") or "")[:200],
    }

print(f"  tables.json: {len(tables_json)} entries ({len(DB_TABLES)} tables + {len(DB_VIEWS)} views)")

# --- graph.json ---
graph_edges = []

# DB FK edges
for fk in db_schema["foreign_keys"]:
    graph_edges.append({
        "from": fk["table_name"],
        "to": fk["foreign_table"],
        "type": "fk",
        "label": f"{fk['column_name']} -> {fk['foreign_column']}",
        "on_delete": fk.get("delete_rule", "NO ACTION"),
    })

# Service -> table edges
for svc_name, svc_info in service_map.items():
    for table in svc_info["tables"]:
        graph_edges.append({
            "from": f"svc:{svc_name}",
            "to": table,
            "type": "service_reads",
        })

# Service -> shared package edges
for svc_name, svc_info in service_map.items():
    for imp in svc_info["imports"]:
        graph_edges.append({
            "from": f"svc:{svc_name}",
            "to": imp,
            "type": "imports",
        })

# Frontend -> API client edges
for page_name, page_info in frontend_pages.items():
    for client in page_info.get("imported_clients", []):
        graph_edges.append({
            "from": f"page:{page_name}",
            "to": f"api:{client}",
            "type": "frontend_uses_api",
        })

# Service -> events edges
for svc_name, svc_info in service_map.items():
    if svc_info["events"]:
        graph_edges.append({
            "from": f"svc:{svc_name}",
            "to": "sns:asset-events",
            "type": "publishes_events",
        })
    if svc_info["cache"]:
        graph_edges.append({
            "from": f"svc:{svc_name}",
            "to": "redis:cache",
            "type": "uses_cache",
        })

print(f"  graph.json: {len(graph_edges)} edges")

# --- flows.json ---
flows = {}

# Build handler -> service -> repository -> table chains
for svc_name, svc_info in service_map.items():
    for handler in svc_info["handlers"]:
        handler_file = handler["file"]
        handler_name = handler_file.replace("/", ".").replace(".ts", "")

        # Find which service files this handler likely calls
        # (heuristic: same subdirectory or matching name patterns)
        handler_base = os.path.splitext(os.path.basename(handler_file))[0]
        related_services = [s["file"] for s in svc_info["services"]]
        related_repos = [r["file"] for r in svc_info["repositories"]]

        # Tables accessed (union of handler + repo tables)
        all_tables = set(handler["tables"])
        for repo in svc_info["repositories"]:
            all_tables.update(repo["tables"])

        flow_key = f"{svc_name}/{handler_name}"
        flows[flow_key] = {
            "service": svc_name,
            "handler": handler_file,
            "has_handler_export": handler.get("has_handler_export", False),
            "service_files": related_services,
            "repository_files": related_repos,
            "tables_accessed": sorted(all_tables),
            "uses_events": svc_info["events"],
            "uses_cache": svc_info["cache"],
            "imports": svc_info["imports"],
        }

# Add frontend flows
for page_name, page_info in frontend_pages.items():
    flow_key = f"frontend/{page_name}"
    flows[flow_key] = {
        "type": "frontend_page",
        "file": page_info["file"],
        "api_calls": page_info["api_calls"],
        "routes": page_info["routes"],
        "imported_clients": page_info.get("imported_clients", []),
    }

print(f"  flows.json: {len(flows)} flows")

# --- gaps.json ---
gaps = {
    "orphan_handlers": [],
    "dead_tables": [],
    "missing_fk_indexes": [],
    "handlers_without_export": [],
    "tables_without_service": [],
    "views_referencing_missing_tables": [],
    "frontend_pages_without_api": [],
    "api_clients_without_pages": [],
}

# Orphan handlers: handlers with no matching CDK route
# (We can't perfectly match without parsing CDK deeply, but flag handlers without handler export)
for h in handler_files:
    if not any(hh.get("has_handler_export") for hh in service_map[h["service"]]["handlers"] if hh["file"] == h["file"]):
        # Check if the file actually has a handler export
        pass  # Already tracked in has_handler_export

for svc_name, svc_info in service_map.items():
    for handler in svc_info["handlers"]:
        if not handler.get("has_handler_export"):
            gaps["handlers_without_export"].append({
                "service": svc_name,
                "file": handler["file"],
            })

# Dead tables: tables not referenced by any service
for table_name in sorted(DB_TABLES):
    owning = tables_json[table_name]["owning_services"]
    if not owning and table_name != "schema_migrations":
        # Check if referenced by any view
        referenced_by_view = False
        for view in db_schema["views"]:
            vdef = (view.get("view_definition") or "").lower()
            if table_name in vdef:
                referenced_by_view = True
                break
        gaps["dead_tables"].append({
            "table": table_name,
            "referenced_by_view": referenced_by_view,
            "column_count": len(db_schema["tables"][table_name]["columns"]),
            "has_fks": len(DB_FK_MAP.get(table_name, [])) > 0,
        })

# Missing FK indexes
for fk in db_schema["foreign_keys"]:
    table = fk["table_name"]
    col = fk["column_name"]
    # Check if there's an index on this FK column
    has_index = False
    for idx in DB_INDEX_MAP.get(table, []):
        indexdef = idx.get("indexdef", "").lower()
        if col.lower() in indexdef:
            has_index = True
            break
    if not has_index:
        gaps["missing_fk_indexes"].append({
            "table": table,
            "column": col,
            "references": f"{fk['foreign_table']}.{fk['foreign_column']}",
        })

# Tables without any service owner
for table_name in sorted(DB_TABLES):
    if not tables_json[table_name]["owning_services"] and table_name != "schema_migrations":
        gaps["tables_without_service"].append(table_name)

# Frontend pages that don't import any API client
for page_name, page_info in frontend_pages.items():
    if not page_info.get("imported_clients") and not page_info.get("api_calls"):
        gaps["frontend_pages_without_api"].append({
            "page": page_name,
            "file": page_info["file"],
        })

# API clients not imported by any page
used_clients = set()
for page_info in frontend_pages.values():
    used_clients.update(page_info.get("imported_clients", []))
for client_name in frontend_api_clients:
    clean_name = client_name.replace("-api", "").replace("_api", "")
    if client_name not in used_clients and clean_name not in used_clients:
        gaps["api_clients_without_pages"].append({
            "client": client_name,
            "file": frontend_api_clients[client_name]["file"],
            "endpoint_count": len(frontend_api_clients[client_name]["endpoints"]),
        })

# Summary
total_gaps = sum(len(v) for v in gaps.values())
print(f"  gaps.json: {total_gaps} total gaps")
for k, v in gaps.items():
    if v:
        print(f"    {k}: {len(v)}")

# ============================================================
# Write output files
# ============================================================
print("\n=== Writing output files ===")

os.makedirs("mappings", exist_ok=True)

with open("mappings/tables.json", "w") as f:
    json.dump(tables_json, f, indent=2, default=str)
print("  Written: mappings/tables.json")

with open("mappings/graph.json", "w") as f:
    json.dump({"edges": graph_edges, "node_count": len(set(
        [e["from"] for e in graph_edges] + [e["to"] for e in graph_edges]
    ))}, f, indent=2, default=str)
print("  Written: mappings/graph.json")

with open("mappings/flows.json", "w") as f:
    json.dump(flows, f, indent=2, default=str)
print("  Written: mappings/flows.json")

with open("mappings/gaps.json", "w") as f:
    json.dump(gaps, f, indent=2, default=str)
print("  Written: mappings/gaps.json")

# last_run.json
last_run = {
    "timestamp": datetime.now(timezone.utc).isoformat(),
    "files_processed": files_processed,
    "files_skipped": 0,
    "db_tables": len(DB_TABLES),
    "db_views": len(DB_VIEWS),
    "db_foreign_keys": len(db_schema["foreign_keys"]),
    "db_triggers": len(db_schema["triggers"]),
    "db_indexes": len(db_schema["indexes"]),
    "backend_services": len(service_map),
    "backend_handlers": len(handler_files),
    "frontend_pages": len(frontend_pages),
    "frontend_api_clients": len(frontend_api_clients),
    "frontend_routes": len(frontend_routes),
    "total_flows": len(flows),
    "total_graph_edges": len(graph_edges),
    "total_gaps": total_gaps,
}
with open("mappings/last_run.json", "w") as f:
    json.dump(last_run, f, indent=2)
print("  Written: mappings/last_run.json")

print(f"\nDone. {files_processed} files processed, {total_gaps} gaps found.")
