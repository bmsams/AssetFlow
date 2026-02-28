#!/usr/bin/env python3
"""Export DB reference schema (tables + procedures) via AWS RDS Data API."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def run_sql(
    sql: str,
    *,
    resource_arn: str,
    secret_arn: str,
    database: str,
    region: str,
) -> dict[str, Any]:
    cmd = [
        "aws",
        "rds-data",
        "execute-statement",
        "--resource-arn",
        resource_arn,
        "--secret-arn",
        secret_arn,
        "--database",
        database,
        "--sql",
        sql,
        "--region",
        region,
        "--include-result-metadata",
        "--output",
        "json",
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip())
    return json.loads(result.stdout)


def parse_rows(response: dict[str, Any]) -> list[dict[str, Any]]:
    cols = [m["name"] for m in response.get("columnMetadata", [])]
    rows: list[dict[str, Any]] = []

    for record in response.get("records", []):
        row: dict[str, Any] = {}
        for i, field in enumerate(record):
            if "stringValue" in field:
                row[cols[i]] = field["stringValue"]
            elif "longValue" in field:
                row[cols[i]] = field["longValue"]
            elif "doubleValue" in field:
                row[cols[i]] = field["doubleValue"]
            elif "booleanValue" in field:
                row[cols[i]] = field["booleanValue"]
            elif "isNull" in field and field["isNull"]:
                row[cols[i]] = None
            else:
                row[cols[i]] = str(field)
        rows.append(row)
    return rows


def build_reference(
    *,
    resource_arn: str,
    secret_arn: str,
    database: str,
    region: str,
    schema_name: str,
) -> dict[str, Any]:
    table_cols_resp = run_sql(
        f"""
        SELECT
          c.table_schema,
          c.table_name,
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          c.character_maximum_length,
          c.numeric_precision,
          c.numeric_scale,
          c.ordinal_position
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema
         AND t.table_name = c.table_name
        WHERE c.table_schema = '{schema_name}'
          AND t.table_type = 'BASE TABLE'
        ORDER BY c.table_name, c.ordinal_position
        """,
        resource_arn=resource_arn,
        secret_arn=secret_arn,
        database=database,
        region=region,
    )
    table_cols = parse_rows(table_cols_resp)

    routines_resp = run_sql(
        f"""
        SELECT
          routine_schema,
          routine_name,
          routine_type,
          data_type,
          specific_name
        FROM information_schema.routines
        WHERE routine_schema = '{schema_name}'
        ORDER BY routine_type, routine_name
        """,
        resource_arn=resource_arn,
        secret_arn=secret_arn,
        database=database,
        region=region,
    )
    routines = parse_rows(routines_resp)

    routine_defs_resp = run_sql(
        f"""
        SELECT
          n.nspname AS routine_schema,
          p.proname AS routine_name,
          CASE p.prokind
            WHEN 'p' THEN 'PROCEDURE'
            WHEN 'f' THEN 'FUNCTION'
            WHEN 'a' THEN 'AGGREGATE'
            WHEN 'w' THEN 'WINDOW'
            ELSE p.prokind::text
          END AS routine_kind,
          p.oid::regprocedure::text AS signature,
          pg_get_functiondef(p.oid) AS definition
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = '{schema_name}'
        ORDER BY routine_kind, routine_name, signature
        """,
        resource_arn=resource_arn,
        secret_arn=secret_arn,
        database=database,
        region=region,
    )
    routine_definitions = parse_rows(routine_defs_resp)

    table_map: dict[str, dict[str, Any]] = defaultdict(lambda: {"columns": []})
    for col in table_cols:
        table_map[col["table_name"]]["columns"].append(
            {
                "name": col["column_name"],
                "data_type": col["data_type"],
                "nullable": col["is_nullable"] == "YES",
                "default": col.get("column_default"),
                "char_max_length": col.get("character_maximum_length"),
                "numeric_precision": col.get("numeric_precision"),
                "numeric_scale": col.get("numeric_scale"),
                "ordinal_position": col["ordinal_position"],
            }
        )

    procedures = [r for r in routines if r.get("routine_type") == "PROCEDURE"]
    functions = [r for r in routines if r.get("routine_type") == "FUNCTION"]
    procedure_definitions = [
        r for r in routine_definitions if r.get("routine_kind") == "PROCEDURE"
    ]
    function_definitions = [
        r for r in routine_definitions if r.get("routine_kind") == "FUNCTION"
    ]

    return {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "database": database,
        "region": region,
        "schema": schema_name,
        "counts": {
            "tables": len(table_map),
            "columns": len(table_cols),
            "procedures": len(procedures),
            "functions": len(functions),
            "routines_total": len(routines),
            "routine_definitions_total": len(routine_definitions),
        },
        "tables": table_map,
        "procedures": procedures,
        "functions": functions,
        "routines": routines,
        "procedure_definitions": procedure_definitions,
        "function_definitions": function_definitions,
        "routine_definitions": routine_definitions,
    }


def write_markdown(reference: dict[str, Any], output_path: str) -> None:
    counts = reference["counts"]
    table_names = sorted(reference["tables"].keys())
    procedures = reference["procedures"]

    lines: list[str] = []
    lines.append("# Database Reference Schema")
    lines.append("")
    lines.append(f"- Generated: `{reference['generated_at_utc']}`")
    lines.append(f"- Region: `{reference['region']}`")
    lines.append(f"- Database: `{reference['database']}`")
    lines.append(f"- Schema: `{reference['schema']}`")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append(f"- Tables: **{counts['tables']}**")
    lines.append(f"- Columns: **{counts['columns']}**")
    lines.append(f"- Procedures: **{counts['procedures']}**")
    lines.append(f"- Functions: **{counts['functions']}**")
    lines.append("")
    lines.append("## Tables")
    lines.append("")
    for name in table_names:
        col_count = len(reference["tables"][name]["columns"])
        lines.append(f"- `{name}` ({col_count} columns)")
    lines.append("")
    lines.append("## Procedures")
    lines.append("")
    if not procedures:
        lines.append("- No stored procedures found in this schema.")
    else:
        for proc in procedures:
            lines.append(
                f"- `{proc['routine_name']}` ({proc.get('data_type', 'unknown')})"
            )
    lines.append("")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def write_routine_definitions_sql(reference: dict[str, Any], output_path: str) -> None:
    routine_definitions = reference.get("routine_definitions", [])
    lines: list[str] = []
    lines.append("-- Database routine definitions")
    lines.append(f"-- Generated: {reference['generated_at_utc']}")
    lines.append(f"-- Database: {reference['database']}")
    lines.append(f"-- Schema: {reference['schema']}")
    lines.append("")

    if not routine_definitions:
        lines.append("-- No routines found.")
    else:
        for item in routine_definitions:
            lines.append(
                f"-- {item.get('routine_kind', 'ROUTINE')}: "
                f"{item.get('signature', item.get('routine_name', 'unknown'))}"
            )
            definition = item.get("definition", "")
            lines.append(definition.rstrip())
            lines.append("")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def _slug(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_") or "routine"


def write_split_routine_files(reference: dict[str, Any], output_dir: str) -> int:
    routine_definitions = reference.get("routine_definitions", [])
    base_path = Path(output_dir)
    base_path.mkdir(parents=True, exist_ok=True)

    # Clear old generated SQL files so removed routines do not leave stale files.
    for old_file in base_path.rglob("*.sql"):
        old_file.unlink()

    count = 0
    for item in routine_definitions:
        kind = _slug(item.get("routine_kind", "routine"))
        name = _slug(item.get("routine_name", "routine"))
        signature = item.get("signature", item.get("routine_name", "routine"))
        sig_hash = hashlib.sha1(signature.encode("utf-8")).hexdigest()[:10]
        out_dir = base_path / kind
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{name}__{sig_hash}.sql"

        lines = [
            f"-- Generated: {reference['generated_at_utc']}",
            f"-- Database: {reference['database']}",
            f"-- Schema: {reference['schema']}",
            f"-- Kind: {item.get('routine_kind', 'ROUTINE')}",
            f"-- Signature: {signature}",
            "",
            item.get("definition", "").rstrip(),
            "",
        ]
        out_path.write_text("\n".join(lines), encoding="utf-8")
        count += 1

    return count


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--resource-arn",
        default="arn:aws:rds:us-east-1:764184373468:cluster:ams-dev-database-assetdatabase46a48a83-liltpjc5oxtn",
    )
    parser.add_argument(
        "--secret-arn",
        default="arn:aws:secretsmanager:us-east-1:764184373468:secret:ams-dev/database/credentials-5zePGU",
    )
    parser.add_argument("--database", default="assetmgmt")
    parser.add_argument("--region", default="us-east-1")
    parser.add_argument("--schema", default="public")
    parser.add_argument(
        "--json-output", default="mappings/db_reference_schema.json"
    )
    parser.add_argument(
        "--markdown-output", default="mappings/DB_REFERENCE_SCHEMA.md"
    )
    parser.add_argument(
        "--definitions-output", default="mappings/DB_ROUTINE_DEFINITIONS.sql"
    )
    parser.add_argument("--routines-dir", default="mappings/routines")
    args = parser.parse_args()

    try:
        reference = build_reference(
            resource_arn=args.resource_arn,
            secret_arn=args.secret_arn,
            database=args.database,
            region=args.region,
            schema_name=args.schema,
        )
    except Exception as exc:  # pragma: no cover
        print(f"Failed to export DB reference schema: {exc}", file=sys.stderr)
        return 1

    with open(args.json_output, "w", encoding="utf-8") as f:
        json.dump(reference, f, indent=2, default=str)

    write_markdown(reference, args.markdown_output)
    write_routine_definitions_sql(reference, args.definitions_output)
    split_count = write_split_routine_files(reference, args.routines_dir)
    print(f"Reference JSON written to {args.json_output}")
    print(f"Reference markdown written to {args.markdown_output}")
    print(f"Routine definitions SQL written to {args.definitions_output}")
    print(f"Split routine files written to {args.routines_dir} ({split_count} files)")
    print(
        "Summary: "
        f"{reference['counts']['tables']} tables, "
        f"{reference['counts']['columns']} columns, "
        f"{reference['counts']['procedures']} procedures, "
        f"{reference['counts']['functions']} functions, "
        f"{reference['counts']['routine_definitions_total']} routine definitions"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
