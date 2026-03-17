# /// script
# requires-python = ">=3.11"
# dependencies = ["duckdb", "pyarrow"]
# ///
"""Export DuckDB tables to Parquet files for DuckDB-WASM frontend consumption.

Produces:
  public/data/appointees.parquet
  public/data/disclosure_entries.parquet
  public/data/documents.parquet

Usage: uv run scripts/export_parquet.py
"""
import os

import duckdb

DB = "scripts/scrape/data/disclosures.duckdb"
OUT = "public/data"

TABLES = [
    "appointees",
    "disclosure_entries",
    "documents",
]


def main():
    os.makedirs(OUT, exist_ok=True)
    con = duckdb.connect(DB, read_only=True)

    for table in TABLES:
        out_path = os.path.join(OUT, f"{table}.parquet")
        con.execute(f"COPY {table} TO '{out_path}' (FORMAT PARQUET)")
        row_count = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        size_kb = os.path.getsize(out_path) // 1024
        print(f"{table}: {row_count} rows → {out_path} ({size_kb} KB)")

    con.close()


if __name__ == "__main__":
    main()
