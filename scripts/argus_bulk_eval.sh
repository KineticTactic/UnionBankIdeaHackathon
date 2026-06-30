#!/bin/bash
# argus_bulk_eval.sh — trigger ARGUS evaluation for all customers via the
# orchestrator bridge.  Used by the TUI to pre-populate signals so the
# client's Signals tab has data to show.
#
# Usage:
#   scripts/argus_bulk_eval.sh                  # all orchestrator customers
#   scripts/argus_bulk_eval.sh --archetype critical
#   scripts/argus_bulk_eval.sh --bank          # bank-format C-00000001 IDs

set -e

ORCH="${ORCHESTRATOR_URL:-http://localhost:8000}"
USER="${PCOP_USER:-admin}"
PASS="${PCOP_PASS:-admin123}"
ARCHETYPE=""
USE_BANK=false

while [ $# -gt 0 ]; do
  case "$1" in
    --archetype)  ARCHETYPE="$2"; shift 2 ;;
    --bank)       USE_BANK=true; shift ;;
    --orch)       ORCH="$2"; shift 2 ;;
    --user)       USER="$2"; shift 2 ;;
    --pass)       PASS="$2"; shift 2 ;;
    *)            echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

# Login → JWT
TOKEN=$(/usr/bin/curl -sS -X POST "$ORCH/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" \
  | /usr/bin/python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))")

if [ -z "$TOKEN" ]; then
  echo "  ✗ could not log in to $ORCH" >&2
  exit 1
fi

# Pull customer list
if $USE_BANK; then
  CUSTOMERS=$(/usr/bin/curl -sS "$ORCH/api/customers?limit=200" \
    -H "Authorization: Bearer $TOKEN" \
    | /usr/bin/python3 -c "
import json,sys
r = json.load(sys.stdin)
for c in (r.get('customers') or []):
    print(c['customer_id'])
")
else
  CUSTOMERS=$(/usr/bin/curl -sS "$ORCH/api/customers?limit=200" \
    -H "Authorization: Bearer $TOKEN" \
    | /usr/bin/python3 -c "
import json,sys
r = json.load(sys.stdin)
for c in (r.get('customers') or []):
    if not '$ARCHETYPE' or c.get('archetype') == '$ARCHETYPE':
        print(c['customer_id'])
")
fi

COUNT=0
TOTAL=$(echo "$CUSTOMERS" | wc -l | tr -d ' ')
echo "  evaluating $TOTAL customers via /api/argus/evaluate-customer …"
echo

for CID in $CUSTOMERS; do
  RESULT=$(/usr/bin/curl -sS -X POST "$ORCH/api/argus/evaluate-customer/$CID" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{}')
  N=$(echo "$RESULT" | /usr/bin/python3 -c "
import json,sys
try:
    r = json.load(sys.stdin)
    detected = sum(1 for s in r.get('signals', []) if s.get('detected'))
    sev = (r.get('warden') or {}).get('severity', '?')
    print(f'{detected}/{len(r.get(\"signals\", []))} sev={sev}')
except Exception as e:
    print(f'ERROR: {e}')
")
  COUNT=$((COUNT + 1))
  printf "  [%3d/%3d] %-12s %s\n" "$COUNT" "$TOTAL" "$CID" "$N"
done

echo
echo "  ✓ done.  $COUNT evaluations completed."
echo "  state-tracked customers:"
/usr/bin/curl -sS "$ORCH/api/argus/state-summary" \
  -H "Authorization: Bearer $TOKEN" \
  | /usr/bin/python3 -m json.tool
