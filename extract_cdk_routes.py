"""Extract CDK routes from api_lambda_stack.py and merge into mappings."""
import json
import re

with open("stacks/api_lambda_stack.py", "r") as f:
    content = f.read()

# Extract all route tuples: ("service", "handler", "/path", ["METHOD", ...])
pattern = re.compile(
    r"""\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*\[([^\]]+)\]\s*\)"""
)

routes = []
for m in pattern.finditer(content):
    service = m.group(1)
    handler = m.group(2)
    path = m.group(3)
    methods = [s.strip().strip('"').strip("'") for s in m.group(4).split(",")]
    routes.append({
        "service": service,
        "handler": handler,
        "path": path,
        "methods": methods,
    })

print(f"Extracted {len(routes)} CDK route definitions")

# Group by service
by_service = {}
for r in routes:
    svc = r["service"]
    if svc not in by_service:
        by_service[svc] = []
    by_service[svc].append(r)

for svc, rts in sorted(by_service.items()):
    print(f"  {svc}: {len(rts)} routes")

# Save CDK routes
with open("mappings/cdk_routes.json", "w") as f:
    json.dump({"routes": routes, "by_service": by_service, "total": len(routes)}, f, indent=2)
print("Written: mappings/cdk_routes.json")

# Now update flows.json to include CDK route info
with open("mappings/flows.json") as f:
    flows = json.load(f)

# Build handler->routes lookup
handler_routes = {}  # "service/handler" -> [routes]
for r in routes:
    key = f"{r['service']}/{r['handler']}"
    if key not in handler_routes:
        handler_routes[key] = []
    handler_routes[key].append({"path": r["path"], "methods": r["methods"]})

# Enrich flows with CDK route info
matched = 0
unmatched_cdk = set()
for flow_key, flow in flows.items():
    if flow.get("type") == "frontend_page":
        continue
    svc = flow.get("service", "")
    handler_file = flow.get("handler", "")
    # Try to match handler file to CDK handler name
    handler_base = handler_file.replace("src/", "").replace("handlers/", "").replace(".ts", "").replace("/", "-")
    # Also try just the filename
    handler_filename = handler_file.split("/")[-1].replace(".ts", "")

    # Check various matching strategies
    cdk_key = f"{svc}/{handler_base}"
    cdk_key2 = f"{svc}/{handler_filename}"

    if cdk_key in handler_routes:
        flow["cdk_routes"] = handler_routes[cdk_key]
        matched += 1
    elif cdk_key2 in handler_routes:
        flow["cdk_routes"] = handler_routes[cdk_key2]
        matched += 1
    else:
        # Try fuzzy: check if handler_filename is a substring of any CDK handler
        found = False
        for hk, hr in handler_routes.items():
            cdk_handler = hk.split("/")[-1]
            if handler_filename in cdk_handler or cdk_handler in handler_filename:
                if hk.startswith(svc + "/"):
                    flow["cdk_routes"] = hr
                    matched += 1
                    found = True
                    break
        if not found:
            flow["cdk_routes"] = []

# Find CDK routes not matched to any flow
all_flow_handlers = set()
for flow_key, flow in flows.items():
    if flow.get("type") != "frontend_page":
        svc = flow.get("service", "")
        handler_file = flow.get("handler", "")
        handler_filename = handler_file.split("/")[-1].replace(".ts", "")
        all_flow_handlers.add(f"{svc}/{handler_filename}")

for hk in handler_routes:
    if hk not in all_flow_handlers:
        unmatched_cdk.add(hk)

print(f"\nFlows enriched: {matched} matched, {len(unmatched_cdk)} CDK handlers unmatched")
if unmatched_cdk:
    for u in sorted(unmatched_cdk):
        print(f"  Unmatched CDK: {u}")

with open("mappings/flows.json", "w") as f:
    json.dump(flows, f, indent=2)
print("Updated: mappings/flows.json")

# Update gaps.json with orphan CDK routes
with open("mappings/gaps.json") as f:
    gaps = json.load(f)

gaps["unmatched_cdk_handlers"] = sorted(unmatched_cdk)

# Also check: CDK routes that have no corresponding handler file
# (handler defined in CDK but file doesn't exist)
import os
missing_handler_files = []
for r in routes:
    svc = r["service"]
    handler = r["handler"]
    # Check common paths
    possible_paths = [
        f"backend/packages/services/{svc}/src/handlers/{handler}.ts",
        f"backend/packages/services/{svc}/src/{handler}.ts",
        f"backend/packages/services/{svc}/src/handlers/{handler}/index.ts",
    ]
    found = any(os.path.isfile(p) for p in possible_paths)
    if not found:
        # Check if it's in a non-service package (admin-service, procurement-service, etc.)
        alt_paths = [
            f"backend/packages/services/{svc}/src/handlers/{handler}.ts",
        ]
        # Also check with glob
        import glob
        pattern_glob = f"backend/packages/services/{svc}/src/**/{handler}.ts"
        matches = glob.glob(pattern_glob, recursive=True)
        if not matches:
            # Try without -service suffix
            svc_alt = svc.replace("-service", "")
            pattern_glob2 = f"backend/packages/services/*{svc_alt}*/src/**/{handler}.ts"
            matches = glob.glob(pattern_glob2, recursive=True)
        if not matches:
            missing_handler_files.append({
                "service": svc,
                "handler": handler,
                "path": r["path"],
                "checked_paths": possible_paths[:2],
            })

gaps["missing_handler_files"] = missing_handler_files
if missing_handler_files:
    print(f"\nMissing handler files: {len(missing_handler_files)}")
    for m in missing_handler_files:
        print(f"  {m['service']}/{m['handler']} -> {m['path']}")

with open("mappings/gaps.json", "w") as f:
    json.dump(gaps, f, indent=2)
print("Updated: mappings/gaps.json")
