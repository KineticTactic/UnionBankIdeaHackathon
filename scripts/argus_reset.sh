#!/bin/bash
# argus_reset.sh — reset ARGUS state for a customer via the
# orchestrator.  Used by the TUI to clear cached signals before a
# fresh evaluation.  Obtains a JWT inline so the command works
# from a non-interactive TUI subprocess.
#
# Usage:
#   scripts/argus_reset.sh CUST-001
#   scripts/argus_reset.sh CUST-043 --no-auth   # skip auth (testing only)

set -e

ORCH="${ORCHESTRATOR_URL:-http://localhost:8000}"
USER="${PCOP_USER:-admin}"
PASS="${PCOP_PASS:-admin123}"
CUSTOMER=""
NO_AUTH=false

while [ $# -gt 0 ]; do
  case "$1" in
    --no-auth) NO_AUTH=true; shift ;;
    --orch)    ORCH="$2"; shift 2 ;;
    --user)    USER="$2"; shift 2 ;;
    --pass)    PASS="$2"; shift 2 ;;
    *)         [ -z "$CUSTOMER" ] && CUSTOMER="$1" || { echo "unknown arg: $1" >&2; exit 2; }
               shift ;;
  esac
done

if [ -z "$CUSTOMER" ]; then
  echo "  ✗ no customer ID given"; exit 2
fi

if $NO_AUTH; then
  /usr/bin/curl -sS -X POST "$ORCH/api/argus/reset/$CUSTOMER" \
    -H 'Content-Type: application/json' \
    -d '{}'
  exit 0
fi

TOKEN=$(/usr/bin/curl -sS -X POST "$ORCH/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" \
  | /usr/bin/python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))")

if [ -z "$TOKEN" ]; then
  echo "  ✗ could not log in to $ORCH"; exit 1
fi

/usr/bin/curl -sS -X POST "$ORCH/api/argus/reset/$CUSTOMER" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}'
echo
