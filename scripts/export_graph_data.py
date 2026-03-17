# /// script
# requires-python = ">=3.11"
# dependencies = ["duckdb"]
# ///
"""Export graph data from DuckDB for the frontend visualizations.

Produces:
  public/data/bipartite.json  — appointees ↔ entities (shared holdings)
  public/data/network.json    — appointee ↔ appointee (weighted by shared count)
  public/data/tree.json       — agency → appointee → entities (DAG)
  public/data/stats.json      — summary stats

Usage: uv run scripts/export_graph_data.py
"""
import json
import os
import re
import sys
from collections import Counter, defaultdict

import duckdb


# Filter out common/boring holdings that create noise
def is_boring(desc: str) -> bool:
    """Returns True for generic financial instruments that everyone holds."""
    # Has a stock ticker in parens like (AAPL) — public equity
    if re.search(r'\([A-Z]{1,5}\)\s*$', desc.strip()):
        return True
    boring = [
        'IRA', 'Roth', 'U.S. Bank', 'BROKERAGE', 'Bank of America', 'JPMorgan',
        'Fidelity', 'Vanguard', 'iShares', 'SPDR', 'BlackRock', 'Schwab', 'T. Rowe',
        '401(k)', '401k', 'Cash', 'Savings', 'Checking', 'Money Market', 'Treasury',
        'Municipal', 'S&P 500', 'Index Fund', 'ETF', 'Bond Fund', 'Target Date',
        'Thrift Savings', 'Federal Employees', 'TIAA', 'Annuit', 'CD ', 'HSA',
        'MOHELA', 'NelNet', 'PENNYMAC', 'Mr. Cooper', 'SOFI', 'aidvantage',
        'Wells Fargo', 'Chase bank', 'Chase', 'family trust', 'Family trust',
    ]
    desc_lower = desc.lower()
    return any(b.lower() in desc_lower for b in boring)

DB = "data/disclosures.duckdb"
OUT = "public/data"


def main():
    os.makedirs(OUT, exist_ok=True)
    con = duckdb.connect(DB, read_only=True)

    # Get all appointees
    appointees = con.sql("""
        SELECT slug, name, title, agency, net_worth_low, net_worth_high,
               confirmation_status, in_cabinet
        FROM appointees
        ORDER BY net_worth_low DESC NULLS LAST
    """).fetchall()

    cols = ["slug", "name", "title", "agency", "net_worth_low", "net_worth_high",
            "confirmation_status", "in_cabinet"]
    appointee_list = [dict(zip(cols, row)) for row in appointees]
    appointee_by_slug = {a["slug"]: a for a in appointee_list}

    # Get all disclosure entries with descriptions
    entries = con.sql("""
        SELECT slug, description FROM disclosure_entries
        WHERE description IS NOT NULL AND description != ''
    """).fetchall()

    # Build entity → appointees mapping
    entity_to_slugs = defaultdict(set)
    slug_to_entities = defaultdict(set)
    for slug, desc in entries:
        desc = desc.strip()
        if desc:
            entity_to_slugs[desc].add(slug)
            slug_to_entities[slug].add(desc)

    # Filter to entities shared by 2+ appointees
    shared_entities = {k: v for k, v in entity_to_slugs.items() if len(v) >= 2}
    print(f"Shared entities (2+): {len(shared_entities)}")

    # --- BIPARTITE GRAPH ---
    # Filter: only interesting (non-generic) entities shared by 3+ appointees
    interesting_entities = {
        k: v for k, v in shared_entities.items()
        if not is_boring(k) and len(v) >= 3
    }
    # Categorize entities for visual grouping
    def categorize(desc: str) -> str:
        d = desc.lower()
        if any(w in d for w in ['republican', 'democrat', 'trump', 'committee', 'campaign', 'inaugural', 'pac']):
            return 'political'
        if any(w in d for w in ['heritage', 'institute', 'foundation', 'society', 'council', 'center for']):
            return 'think_tank'
        if any(w in d for w in ['bitcoin', 'ethereum', 'coinbase', 'crypto', 'defi', 'token']):
            return 'crypto'
        if any(w in d for w in ['llc', 'l.l.c', 'lp', 'l.p.', 'holdings', 'partners', 'capital', 'fund', 'ventures']):
            return 'private'
        if any(w in d for w in ['department of', 'u.s. ', 'federal', 'government', 'agency']):
            return 'government'
        return 'other'

    top_entities = sorted(interesting_entities.items(), key=lambda x: -len(x[1]))[:100]

    involved_slugs = set()
    for _, slugs in top_entities:
        involved_slugs.update(slugs)

    bipartite_nodes = []
    bipartite_links = []

    for a in appointee_list:
        if a["slug"] in involved_slugs:
            bipartite_nodes.append({
                "id": a["slug"],
                "type": "appointee",
                "name": a["name"],
                "agency": a["agency"],
                "title": a["title"],
                "net_worth_low": a["net_worth_low"],
            })

    for entity, slugs in top_entities:
        eid = f"e:{entity}"
        cat = categorize(entity)
        bipartite_nodes.append({
            "id": eid,
            "type": "entity",
            "name": entity,
            "count": len(slugs),
            "category": cat,
        })
        for slug in slugs:
            if slug in involved_slugs:
                bipartite_links.append({"source": slug, "target": eid})

    bipartite = {"nodes": bipartite_nodes, "links": bipartite_links}
    with open(os.path.join(OUT, "bipartite.json"), "w") as f:
        json.dump(bipartite, f)
    print(f"Bipartite: {len(bipartite_nodes)} nodes, {len(bipartite_links)} links")
    cats = Counter(categorize(e) for e, _ in top_entities)
    print(f"  Categories: {dict(cats)}")

    # --- NETWORK GRAPH (appointee ↔ appointee) ---
    # Weight = number of shared entities between pairs
    pair_weights = Counter()
    for entity, slugs in shared_entities.items():
        slug_list = sorted(slugs)
        for i in range(len(slug_list)):
            for j in range(i + 1, len(slug_list)):
                pair_weights[(slug_list[i], slug_list[j])] += 1

    # Top pairs by weight, limit for performance
    top_pairs = pair_weights.most_common(500)
    network_slugs = set()
    for (a, b), _ in top_pairs:
        network_slugs.add(a)
        network_slugs.add(b)

    network_nodes = []
    for a in appointee_list:
        if a["slug"] in network_slugs:
            network_nodes.append({
                "id": a["slug"],
                "name": a["name"],
                "agency": a["agency"],
                "title": a["title"],
                "net_worth_low": a["net_worth_low"],
            })

    network_links = [
        {"source": a, "target": b, "weight": w}
        for (a, b), w in top_pairs
    ]

    network = {"nodes": network_nodes, "links": network_links}
    with open(os.path.join(OUT, "network.json"), "w") as f:
        json.dump(network, f)
    print(f"Network: {len(network_nodes)} nodes, {len(network_links)} links")

    # --- TREE / DAG ---
    # agency → appointees → their top entities
    agencies = defaultdict(list)
    for a in appointee_list:
        agency = a["agency"] or "Unknown"
        # Get this appointee's entities that are shared
        appt_shared = [e for e in slug_to_entities.get(a["slug"], []) if e in shared_entities]
        # Top 5 by how many other appointees share them
        appt_shared.sort(key=lambda e: -len(shared_entities.get(e, set())))
        agencies[agency].append({
            "slug": a["slug"],
            "name": a["name"],
            "title": a["title"],
            "net_worth_low": a["net_worth_low"],
            "entities": appt_shared[:5],
        })

    tree = {
        "name": "US Government",
        "children": [
            {
                "name": agency,
                "children": members[:20],  # limit per agency for perf
            }
            for agency, members in sorted(agencies.items())
            if members
        ],
    }
    with open(os.path.join(OUT, "tree.json"), "w") as f:
        json.dump(tree, f)
    print(f"Tree: {len(tree['children'])} agencies")

    # --- STATS ---
    stats = {
        "total_appointees": len(appointee_list),
        "total_entries": len(entries),
        "total_shared_entities": len(shared_entities),
        "total_agencies": len(agencies),
        "top_entities": [
            {"name": e, "count": len(s)}
            for e, s in sorted(shared_entities.items(), key=lambda x: -len(x[1]))[:50]
        ],
    }
    with open(os.path.join(OUT, "stats.json"), "w") as f:
        json.dump(stats, f, indent=2)
    print(f"Stats exported")

    con.close()


if __name__ == "__main__":
    main()
