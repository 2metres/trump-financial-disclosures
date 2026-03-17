#!/usr/bin/env bash
# Scrape a single appointee's data via curl
# Usage: ./scrape_appointee.sh <slug> [output_dir]
# Example: ./scrape_appointee.sh trump-donald-j data/raw

set -euo pipefail

SLUG="$1"
OUTDIR="${2:-data/raw}"
BASE="https://projects.propublica.org/trump-team-financial-disclosures/appointees"

mkdir -p "$OUTDIR"

curl -sf "${BASE}/${SLUG}/__data.json?x-sveltekit-invalidated=01" -o "${OUTDIR}/${SLUG}.json"
echo "Scraped ${SLUG} ($(wc -c < "${OUTDIR}/${SLUG}.json" | tr -d ' ') bytes)"
