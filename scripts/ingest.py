# /// script
# requires-python = ">=3.11"
# dependencies = ["duckdb"]
# ///
"""Decode all raw SvelteKit JSON files and load into DuckDB.

Usage:
  uv run scripts/ingest.py [raw_dir] [db_path]

Defaults:
  raw_dir  = data/raw
  db_path  = data/disclosures.duckdb

Reads _manifest.tsv to skip already-ingested files. Appends to manifest on success.
"""
import json
import os
import sys
import time

import duckdb


def resolve_row(flat: list, schema: dict) -> dict:
    result = {}
    for key, val_idx in schema.items():
        if isinstance(val_idx, int) and val_idx < len(flat):
            result[key] = flat[val_idx]
        else:
            result[key] = val_idx
    return result


def decode_appointee(raw: dict) -> dict:
    flat = raw["nodes"][1]["data"]
    schema = flat[0]

    appointee_indices = flat[schema["appointees"]]
    documents = []
    for idx in appointee_indices:
        documents.append(resolve_row(flat, flat[idx]))

    appointee = documents[0] if documents else {}

    entries = []
    disc_idx = schema.get("disclosure_entries")
    if disc_idx is not None:
        for idx in flat[disc_idx]:
            entries.append(resolve_row(flat, flat[idx]))

    return {
        "appointee": appointee,
        "documents": documents,
        "disclosure_entries": entries,
    }


def str_or_none(v):
    if v is None:
        return None
    return str(v)


def int_or_none(v):
    if v is None:
        return None
    try:
        return int(v)
    except (ValueError, TypeError):
        return None


def create_schema(con: duckdb.DuckDBPyConnection):
    con.execute("""
        CREATE TABLE IF NOT EXISTS appointees (
            slug VARCHAR PRIMARY KEY,
            name VARCHAR,
            title VARCHAR,
            agency VARCHAR,
            pic VARCHAR,
            in_cabinet BOOLEAN,
            confirmation_status VARCHAR,
            holdover BOOLEAN,
            date_of_appointment DATE,
            net_worth_low BIGINT,
            net_worth_high BIGINT,
            net_worth_plus BOOLEAN
        )
    """)
    con.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id VARCHAR,
            slug VARCHAR,
            doc_url VARCHAR,
            file_name VARCHAR,
            form_type VARCHAR,
            form_subtype VARCHAR,
            FOREIGN KEY (slug) REFERENCES appointees(slug)
        )
    """)
    con.execute("""
        CREATE TABLE IF NOT EXISTS disclosure_entries (
            id INTEGER,
            slug VARCHAR,
            doc_id VARCHAR,
            description VARCHAR,
            metadata VARCHAR,
            income_amount VARCHAR,
            income_type VARCHAR,
            value_category_id VARCHAR,
            line_no VARCHAR,
            endnote VARCHAR,
            entity_id INTEGER,
            form_type VARCHAR,
            doc_url VARCHAR,
            FOREIGN KEY (slug) REFERENCES appointees(slug)
        )
    """)


def insert_appointee(con: duckdb.DuckDBPyConnection, slug: str, data: dict):
    a = data["appointee"]
    con.execute("""
        INSERT OR REPLACE INTO appointees VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        slug,
        str_or_none(a.get("name")),
        str_or_none(a.get("title")),
        str_or_none(a.get("agency_name")),
        str_or_none(a.get("pic")),
        a.get("in_cabinet") is not None and a.get("in_cabinet") not in (None, False, 0),
        str_or_none(a.get("confirmation_status")),
        a.get("holdover") is not None and a.get("holdover") not in (None, False, 0),
        str_or_none(a.get("date_of_appointment")),
        int_or_none(a.get("net_worth_low")),
        int_or_none(a.get("net_worth_high")),
        a.get("net_worth_plus") is not None and a.get("net_worth_plus") not in (None, False, 0),
    ])

    for doc in data["documents"]:
        con.execute("""
            INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?)
        """, [
            str_or_none(doc.get("did", doc.get("id"))),
            slug,
            str_or_none(doc.get("url")),
            str_or_none(doc.get("file")),
            str_or_none(doc.get("form_type")),
            str_or_none(doc.get("form_subtype")),
        ])

    for entry in data["disclosure_entries"]:
        con.execute("""
            INSERT INTO disclosure_entries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            int_or_none(entry.get("id")),
            slug,
            str_or_none(entry.get("doc_id")),
            str_or_none(entry.get("description")),
            str_or_none(entry.get("metadata")),
            str_or_none(entry.get("income_amount")),
            str_or_none(entry.get("income_type")),
            str_or_none(entry.get("value_category_id")),
            str_or_none(entry.get("line_no")),
            str_or_none(entry.get("endnote")),
            int_or_none(entry.get("entity_id")),
            str_or_none(entry.get("form_type")),
            str_or_none(entry.get("doc_url")),
        ])


def load_manifest(path: str) -> set[str]:
    done = set()
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                parts = line.strip().split("\t")
                if len(parts) >= 2 and parts[0] == "OK":
                    done.add(parts[1])
    return done


def append_manifest(path: str, status: str, slug: str, entries: int):
    with open(path, "a") as f:
        f.write(f"{status}\t{slug}\t{entries}\t{time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}\n")


def main():
    raw_dir = sys.argv[1] if len(sys.argv) > 1 else "data/raw"
    db_path = sys.argv[2] if len(sys.argv) > 2 else "data/disclosures.duckdb"

    manifest_path = os.path.join(raw_dir, "_ingest_manifest.tsv")
    done = load_manifest(manifest_path)
    print(f"Manifest: {len(done)} already ingested")

    files = sorted(f for f in os.listdir(raw_dir) if f.endswith(".json") and not f.startswith("_"))
    print(f"Found {len(files)} raw files")

    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
    con = duckdb.connect(db_path)
    create_schema(con)

    ingested = 0
    skipped = 0
    failed = 0

    for i, fname in enumerate(files):
        slug = fname.replace(".json", "")

        if slug in done:
            skipped += 1
            continue

        try:
            with open(os.path.join(raw_dir, fname)) as f:
                raw = json.load(f)

            data = decode_appointee(raw)
            insert_appointee(con, slug, data)

            entry_count = len(data["disclosure_entries"])
            append_manifest(manifest_path, "OK", slug, entry_count)
            ingested += 1

            if ingested % 50 == 0:
                print(f"[{i+1}/{len(files)}] {slug}: {entry_count} entries (ingested {ingested})")

        except Exception as e:
            append_manifest(manifest_path, "FAIL", slug, 0)
            failed += 1
            print(f"[{i+1}/{len(files)}] FAIL {slug}: {e}", file=sys.stderr)

    con.close()
    print(f"\nDone: {ingested} ingested, {skipped} skipped, {failed} failed out of {len(files)}")


if __name__ == "__main__":
    main()
