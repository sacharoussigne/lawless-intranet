#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

count=0
while IFS= read -r -d '' dir; do
  echo "Removing $dir"
  rm -rf "$dir"
  count=$((count + 1))
done < <(find "$ROOT" -type d -name .next -prune -print0 2>/dev/null)

if [[ "$count" -eq 0 ]]; then
  echo "No .next directories found."
else
  echo "Removed $count .next director$([[ "$count" -eq 1 ]] && echo 'y' || echo 'ies')."
fi
