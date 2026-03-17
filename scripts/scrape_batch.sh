#!/usr/bin/env bash
# Scrape a batch of appointees via curl with polite delay
# Usage: ./scrape_batch.sh <slugs_file> [output_dir] [delay_secs]
# slugs_file: one slug per line
# Example: ./scrape_batch.sh /tmp/batch_01.txt data/raw 0.5

set -euo pipefail

SLUGS_FILE="$1"
OUTDIR="${2:-data/raw}"
DELAY="${3:-0.5}"
TOTAL=$(wc -l < "$SLUGS_FILE" | tr -d ' ')
COUNT=0
FAILED=0

mkdir -p "$OUTDIR"

while IFS= read -r SLUG; do
  COUNT=$((COUNT + 1))
  if [ -f "${OUTDIR}/${SLUG}.json" ]; then
    echo "[${COUNT}/${TOTAL}] SKIP ${SLUG} (already exists)"
    continue
  fi
  if curl -sf "https://projects.propublica.org/trump-team-financial-disclosures/appointees/${SLUG}/__data.json?x-sveltekit-invalidated=01" -o "${OUTDIR}/${SLUG}.json" 2>/dev/null; then
    echo "[${COUNT}/${TOTAL}] OK ${SLUG} ($(wc -c < "${OUTDIR}/${SLUG}.json" | tr -d ' ') bytes)"
  else
    echo "[${COUNT}/${TOTAL}] FAIL ${SLUG}"
    FAILED=$((FAILED + 1))
  fi
  sleep "$DELAY"
done < "$SLUGS_FILE"

echo "Done: ${COUNT} processed, ${FAILED} failed"
