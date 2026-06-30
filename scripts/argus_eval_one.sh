#!/bin/bash
# argus_eval_one.sh — run ARGUS for a single customer via the
# orchestrator bridge, print a human-readable summary, then exit.
#
# Used by the TUI to show a clean demo log instead of raw JSON.
#
# Usage:
#   scripts/argus_eval_one.sh CUST-001
#   scripts/argus_eval_one.sh CUST-001 --reset
#   scripts/argus_eval_one.sh C-00000001
#
# Flags:
#   --reset    Reset the agent state for this customer first

set -e

ORCH="${ORCHESTRATOR_URL:-http://localhost:8000}"
USER="${PCOP_USER:-admin}"
PASS="${PCOP_PASS:-admin123}"
CUSTOMER=""
RESET=false

while [ $# -gt 0 ]; do
  case "$1" in
    --reset) RESET=true; shift ;;
    --orch)  ORCH="$2"; shift 2 ;;
    --user)  USER="$2"; shift 2 ;;
    --pass)  PASS="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 CUSTOMER_ID [--reset]"; exit 0 ;;
    *)
      [ -z "$CUSTOMER" ] && CUSTOMER="$1" || { echo "unknown arg: $1" >&2; exit 2; }
      shift ;;
  esac
done

if [ -z "$CUSTOMER" ]; then
  echo "  ✗ no customer ID given"; exit 2
fi

# Login → JWT
TOKEN=$(/usr/bin/curl -sS -X POST "$ORCH/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" \
  | /usr/bin/python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))")

if [ -z "$TOKEN" ]; then
  echo "  ✗ could not log in to $ORCH"; exit 1
fi

if $RESET; then
  /usr/bin/curl -sS -X POST "$ORCH/api/argus/reset/$CUSTOMER" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{}' > /dev/null
  echo "  ✓ ARGUS state reset for $CUSTOMER"
fi

# Trigger evaluation and pretty-print
/usr/bin/curl -sS -X POST "$ORCH/api/argus/evaluate-customer/$CUSTOMER" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}' \
  | /usr/bin/python3 -c "
import json,sys
r = json.load(sys.stdin)
if r.get('error'):
    print(f'  ✗ error: {r.get(\"message\")}')
    sys.exit(1)
print(f'  → {r[\"customer_id\"]}  evaluated_at: {r[\"evaluated_at\"]}')
signals = r.get('signals', [])
detected = [s for s in signals if s.get('detected')]
warden = r.get('warden', {})
print(f'  → {len(signals)} signals evaluated · {len(detected)} detected · WARDEN: {warden.get(\"severity\")} (alarm={warden.get(\"alarm\")})')
print()
for s in signals:
    marker = '🔥' if s.get('detected') else '  '
    conf = s.get('confidence', 0) * 100
    print(f'    {marker} {s[\"signal_type\"]:<22} conf={conf:5.1f}% cusum={s.get(\"cusum_value\", 0):>12.2f} method={s.get(\"method\")}')
if r.get('alarm'):
    ap = r['alarm']
    print()
    print(f'  ECHO alarm payload: severity={ap.get(\"alarm_severity\")} active={ap.get(\"active_signal_count\")} rejected={ap.get(\"rejected_tests\")}')
"
