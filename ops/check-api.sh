#!/usr/bin/env bash
# Read-only check: exit nonzero if local API or product catalog is unavailable.
set -euo pipefail
base="${API_BASE_URL:-http://127.0.0.1:4000}"
curl --fail --silent --show-error --max-time 10 "${base}/api/health" >/dev/null
curl --fail --silent --show-error --max-time 15 "${base}/api/products" >/dev/null
printf 'Karlo Wear API and catalog are responding: %s\n' "$base"
