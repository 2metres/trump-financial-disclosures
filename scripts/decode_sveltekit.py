#!/usr/bin/env python3
"""Decode SvelteKit compact __data.json into usable records.

Usage:
  # Decode a single appointee file
  python3 decode_sveltekit.py appointee data/raw/trump-donald-j.json

  # Decode the search index (all appointees list)
  python3 decode_sveltekit.py search /tmp/search_data.json

  # Fetch and decode the search index from ProPublica
  python3 decode_sveltekit.py fetch-search > data/all_appointees.json

  # Batch decode all raw files into data/decoded/
  python3 decode_sveltekit.py batch data/raw/ data/decoded/
"""
import json
import os
import sys
import urllib.request


SEARCH_URL = "https://projects.propublica.org/trump-team-financial-disclosures/search/__data.json?x-sveltekit-invalidated=01"


def resolve_row(flat: list, schema: dict) -> dict:
    """Resolve a SvelteKit schema+flat array row into a plain dict."""
    result = {}
    for key, val_idx in schema.items():
        if isinstance(val_idx, int) and val_idx < len(flat):
            result[key] = flat[val_idx]
        else:
            result[key] = val_idx
    return result


def decode_search(raw: dict) -> list[dict]:
    """Decode search __data.json into a list of appointees."""
    flat = raw["nodes"][1]["data"]
    schema = flat[0]
    result_list = flat[schema["result"]]

    appointees = []
    for idx in result_list:
        row_schema = flat[idx]
        row = resolve_row(flat, row_schema)
        appointees.append({
            "name": row.get("a_txt"),
            "slug": row.get("a_slug"),
            "agency": row.get("agency_name"),
            "title": row.get("title"),
            "net_worth_low": row.get("net_worth_low"),
        })
    return appointees


def decode_appointee(raw: dict) -> dict:
    """Decode an appointee __data.json into structured data."""
    flat = raw["nodes"][1]["data"]
    schema = flat[0]

    # Decode appointee documents
    appointee_indices = flat[schema["appointees"]]
    documents = []
    for idx in appointee_indices:
        documents.append(resolve_row(flat, flat[idx]))

    appointee = documents[0] if documents else {}

    # Decode disclosure entries
    entries = []
    disc_idx = schema.get("disclosure_entries")
    if disc_idx is not None:
        for idx in flat[disc_idx]:
            entries.append(resolve_row(flat, flat[idx]))

    return {
        "appointee": {
            "name": appointee.get("name"),
            "slug": appointee.get("slug"),
            "title": appointee.get("title"),
            "agency": appointee.get("agency_name"),
            "pic": appointee.get("pic"),
            "in_cabinet": appointee.get("in_cabinet"),
            "confirmation_status": appointee.get("confirmation_status"),
            "holdover": appointee.get("holdover"),
            "date_of_appointment": appointee.get("date_of_appointment"),
            "net_worth_low": appointee.get("net_worth_low"),
            "net_worth_high": appointee.get("net_worth_high"),
            "net_worth_plus": appointee.get("net_worth_plus"),
        },
        "documents": documents,
        "disclosure_entries": entries,
    }


def fetch_search() -> list[dict]:
    """Fetch and decode the search index from ProPublica."""
    req = urllib.request.Request(SEARCH_URL)
    with urllib.request.urlopen(req) as resp:
        raw = json.loads(resp.read())
    return decode_search(raw)


def batch_decode(raw_dir: str, out_dir: str):
    """Decode all raw JSON files into structured output."""
    os.makedirs(out_dir, exist_ok=True)
    files = [f for f in os.listdir(raw_dir) if f.endswith(".json")]
    for i, fname in enumerate(sorted(files)):
        slug = fname.replace(".json", "")
        try:
            with open(os.path.join(raw_dir, fname)) as f:
                raw = json.load(f)
            decoded = decode_appointee(raw)
            with open(os.path.join(out_dir, fname), "w") as f:
                json.dump(decoded, f, indent=2)
            entries = len(decoded["disclosure_entries"])
            print(f"[{i+1}/{len(files)}] {slug}: {entries} entries")
        except Exception as e:
            print(f"[{i+1}/{len(files)}] {slug}: ERROR {e}", file=sys.stderr)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"

    if cmd == "search":
        raw = json.load(open(sys.argv[2]))
        print(json.dumps(decode_search(raw), indent=2))

    elif cmd == "appointee":
        raw = json.load(open(sys.argv[2]))
        print(json.dumps(decode_appointee(raw), indent=2))

    elif cmd == "fetch-search":
        print(json.dumps(fetch_search(), indent=2))

    elif cmd == "batch":
        batch_decode(sys.argv[2], sys.argv[3])

    else:
        print(__doc__)
