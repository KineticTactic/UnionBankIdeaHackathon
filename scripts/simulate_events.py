#!/usr/bin/env python3
"""PCOP live-event simulator.

Posts a configurable stream of synthetic banking events to the
orchestrator's ``POST /api/kafka/publish`` endpoint.  Each event
targets a real customer pulled from ``GET /api/core-banking/customers``
so the events are grounded in live data.

This drives the existing Kafka-simulation pipeline:
    bank → server kafkaService → eventBus → SSE → client KafkaFeed
                                              ↘ TUI log broker

Usage:
    python3 scripts/simulate_events.py --rate 1.0
    python3 scripts/simulate_events.py --burst 50
    python3 scripts/simulate_events.py --scenario critical_cascade --customer C-00000001
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from datetime import datetime, timezone
from typing import Any


ORCHESTRATOR = "http://localhost:8000"
BANK         = "http://localhost:3001"

DEFAULT_USERS = [
    ("admin",   "admin123"),
    ("rm_user", "rm123"),
]

# ── HTTP helpers (stdlib only — no third-party deps) ────────────────────────
# httpx is used in e2e_test.py; the simulator intentionally avoids it
# so the script runs on any fresh Python ≥ 3.8 with zero install step.
import json as _json
from urllib import request as _urlrequest
from urllib.error import HTTPError, URLError

_http_timeout = 5.0


def _http_json(method: str, url: str, *, headers: dict | None = None, body: dict | None = None):
    data = None
    h = {"Accept": "application/json"}
    if body is not None:
        data = _json.dumps(body).encode("utf-8")
        h["Content-Type"] = "application/json"
    if headers:
        h.update(headers)
    req = _urlrequest.Request(url, data=data, method=method, headers=h)
    try:
        with _urlrequest.urlopen(req, timeout=_http_timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return resp.status, _safe_json(raw)
    except HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        return e.code, _safe_json(raw)
    except URLError as e:
        return 0, {"error": f"connection error: {e.reason}"}
    except Exception as e:
        return 0, {"error": str(e)}


def _safe_json(raw: str):
    if not raw:
        return None
    try:
        return _json.loads(raw)
    except Exception:
        return {"_raw": raw}


# ── Topic generators ───────────────────────────────────────────────────────
def gen_transaction(customers: list[dict]) -> dict[str, Any]:
    cust = random.choice(customers)
    is_credit = random.random() < 0.20
    amount = (
        random.randint(40_000, 90_000) if is_credit
        else random.randint(100, 15_000)
    )
    categories = ["grocery", "utility", "food", "fuel", "emi", "shopping",
                  "travel", "salary", "transfer", "entertainment"]
    channels = ["upi", "netbanking", "pos", "nach", "atm", "card"]
    merchants = ["BigBasket", "Swiggy", "Zomato", "BPCL", "IRCTC", "Flipkart",
                 "Amazon", "PhonePe", "RelianceFresh", "MakeMyTrip"]
    return {
        "topic": "cbs.transactions",
        "key": cust["customer_id"],
        "value": {
            "customer_id": cust["customer_id"],
            "amount": amount,
            "direction": "credit" if is_credit else "debit",
            "category": "salary" if is_credit else random.choice(categories),
            "channel": random.choice(channels),
            "merchant_name": random.choice(merchants),
        },
    }


def gen_account_update(customers: list[dict]) -> dict[str, Any]:
    cust = random.choice(customers)
    return {
        "topic": "cbs.account_updates",
        "key": cust["customer_id"],
        "value": {
            "customer_id":   cust["customer_id"],
            "account_type":  random.choice(["savings", "current", "fd"]),
            "balance_delta":  random.randint(-25_000, 25_000),
            "status":         random.choice(["active", "active", "active", "dormant"]),
        },
    }


def gen_crm_event(customers: list[dict]) -> dict[str, Any]:
    cust = random.choice(customers)
    notes = [
        "Customer called about unexpected fee deduction on savings account.",
        "Delay in NEFT transfer processing — customer escalated.",
        "Net banking login issues persisted for 3 days.",
        "Request for interest rate review on personal loan.",
        "Customer reported missing transaction in statement.",
        "Asked about home-loan pre-approval eligibility.",
        "Requested higher credit limit on credit card.",
        "Requested help with mutual fund statement download.",
    ]
    return {
        "topic": "crm.customer_events",
        "key": cust["customer_id"],
        "value": {
            "customer_id": cust["customer_id"],
            "note_type":    random.choice(["complaint", "inquiry", "feedback", "service_request"]),
            "note_text":    random.choice(notes),
            "channel":      random.choice(["call", "email", "branch", "chat"]),
            "resolved":     random.random() < 0.3,
        },
    }


def gen_signal(customers: list[dict]) -> dict[str, Any]:
    cust = random.choice(customers)
    sigs = [
        ("transaction_frequency", "CUSUM"),
        ("salary_amount",         "BOCPD"),
        ("digital_engagement",    "SA-EWMA"),
        ("complaint_sentiment",   "SPRT"),
        ("stress_overdraft",      "CUSUM"),
        ("location_city",         "RULE"),
        ("lifecycle_mcc",          "RULE"),
        ("beta_cusum_sentiment",  "BETA-CUSUM"),
    ]
    sig_type, method = random.choice(sigs)
    threshold = 3.0
    cusum = threshold + random.random() * 2
    return {
        "topic": "risk.signal_detections",
        "key": cust["customer_id"],
        "value": {
            "customer_id":     cust["customer_id"],
            "signal_type":     sig_type,
            "confidence":      round(0.65 + random.random() * 0.3, 2),
            "cusum_value":     round(cusum, 2),
            "alarm_threshold": threshold,
            "method":          method,
            "evidence":        f"Simulated drift in {sig_type}",
        },
    }


def gen_score_update(customers: list[dict]) -> dict[str, Any]:
    cust = random.choice(customers)
    # Drift the score by ±0.05 to keep things interesting
    base = cust.get("churn_score", 0.5)
    new_score = max(0.05, min(0.98, base + (random.random() - 0.5) * 0.10))
    if new_score >= 0.80:   tier = "PRIORITY"
    elif new_score >= 0.60: tier = "ESCALATE"
    elif new_score >= 0.40: tier = "STANDARD"
    elif new_score >= 0.20: tier = "MONITOR"
    else:                   tier = "NONE"
    return {
        "topic": "risk.score_updates",
        "key": cust["customer_id"],
        "value": {
            "customer_id":   cust["customer_id"],
            "churn_score":   round(new_score, 4),
            "risk_tier":     tier,
            "model_version": "FusionXV2-sim",
            "reason":        "simulator tick",
        },
    }


def gen_engagement(customers: list[dict]) -> dict[str, Any]:
    cust = random.choice(customers)
    return {
        "topic": "engagement.activity",
        "key": cust["customer_id"],
        "value": {
            "customer_id": cust["customer_id"],
            "event_type":  random.choice(["login", "app_open", "statement_view",
                                          "bill_pay", "transfer_init", "card_swipe"]),
            "channel":     random.choice(["mobile_app", "web", "branch_kiosk"]),
        },
    }


GENERATORS = [
    ("cbs.transactions",     0.32, gen_transaction),
    ("cbs.account_updates",  0.10, gen_account_update),
    ("crm.customer_events",  0.10, gen_crm_event),
    ("risk.signal_detections", 0.20, gen_signal),
    ("risk.score_updates",   0.18, gen_score_update),
    ("engagement.activity",  0.10, gen_engagement),
]


# ── Pre-built demo scenarios ───────────────────────────────────────────────
def scenario_critical_cascade(customers: list[dict], target_id: str | None) -> list[dict[str, Any]]:
    """Fire 3 signals + 1 score spike + 1 negative CRM in quick succession
    on a single customer.  Designed to make the dashboard's risk tier
    jump from MONITOR/STANDARD to PRIORITY visibly."""
    cust_id = target_id or (random.choice(customers)["customer_id"] if customers else "C-00000001")
    events = [
        gen_signal([{"customer_id": cust_id}]),
        gen_signal([{"customer_id": cust_id}]),
        gen_signal([{"customer_id": cust_id}]),
        {
            "topic": "risk.score_updates",
            "key":   cust_id,
            "value": {
                "customer_id":   cust_id,
                "churn_score":   0.91,
                "risk_tier":     "PRIORITY",
                "model_version": "FusionXV2-sim",
                "reason":        "critical_cascade scenario",
            },
        },
        {
            "topic": "crm.customer_events",
            "key":   cust_id,
            "value": {
                "customer_id": cust_id,
                "note_type":    "complaint",
                "note_text":    "Customer mentioned switching to a competitor in a recent call.",
                "channel":      "call",
                "resolved":     False,
            },
        },
    ]
    return events


SCENARIOS = {
    "critical_cascade": scenario_critical_cascade,
}


# ── CLI ─────────────────────────────────────────────────────────────────────
def fetch_customers(token: str, limit: int = 50, prefer: str = "orchestrator") -> list[dict]:
    """Pull a customer pool.  Prefers the orchestrator's customer list
    (CUST-001 IDs) so events flow to the same customers the client UI
    is displaying.  Falls back to the Bank API (C-00000001 IDs) if the
    orchestrator is unreachable."""
    if prefer == "orchestrator":
        # /api/customers → orchestrator (format CUST-001, matches client list)
        code, body = _http_json("GET", f"{ORCHESTRATOR}/api/customers?limit={limit}",
                                headers={"Authorization": f"Bearer {token}"})
        if code == 200 and isinstance(body, dict):
            custs = body.get("customers") or []
            if custs:
                return custs
    # Fallback: bank API (format C-00000001)
    code, body = _http_json("GET", f"{BANK}/api/core-banking/customers?limit={limit}")
    if code == 200 and isinstance(body, dict):
        return body.get("data") or []
    print(f"  ✗ no customer source returned data", file=sys.stderr)
    return []


def fetch_token(username: str, password: str) -> str | None:
    code, body = _http_json("POST", f"{ORCHESTRATOR}/auth/login",
                            body={"username": username, "password": password})
    if code == 200 and isinstance(body, dict):
        return body.get("token")
    print(f"  ✗ orchestrator login failed: HTTP {code} {body}", file=sys.stderr)
    return None


def publish(token: str, topic: str, key: str, value: dict) -> tuple[int, dict | None]:
    code, body = _http_json(
        "POST",
        f"{ORCHESTRATOR}/api/kafka/publish",
        headers={"Authorization": f"Bearer {token}"},
        body={"topic": topic, "key": key, "value": value},
    )
    if code == 200:
        return 200, body if isinstance(body, dict) else None
    return code, body if isinstance(body, dict) else None


def evaluate_argus(token: str, customer_id: str) -> tuple[int, dict | None]:
    """Trigger a live ARGUS evaluation for ``customer_id``.

    Calls ``POST /api/argus/evaluate-customer/:id`` on the orchestrator,
    which fetches the customer's data from the Bank API, transforms it
    into the herald_data shape ARGUS expects, runs the 9 HERALD agents
    + NEXUS + ORACLE + WARDEN, then writes the detected signals back
    into the orchestrator's in-memory store so they appear in the
    client's Signals tab on the next poll.
    """
    code, body = _http_json(
        "POST",
        f"{ORCHESTRATOR}/api/argus/evaluate-customer/{customer_id}",
        headers={"Authorization": f"Bearer {token}"},
        body={},
    )
    if isinstance(body, dict) and "signals" in body:
        n = len(body.get("signals", []))
        sev = (body.get("warden") or {}).get("severity") or "none"
        return code, {"detected": n, "severity": sev, "raw": body}
    return code, body


def run_rate(token: str, customers: list[dict], rate: float, duration: float) -> int:
    interval = 1.0 / max(rate, 0.01)
    deadline = time.time() + duration if duration > 0 else float("inf")
    sent, failed, argus_runs, started = 0, 0, 0, time.time()
    topic_names = [name for name, _, _ in GENERATORS]
    weights = [w for _, w, _ in GENERATORS]
    print(f"  rate={rate:.2f} evt/s   duration={'∞' if duration <= 0 else f'{duration:.0f}s'}")
    print(f"  customers={len(customers)}   topics={topic_names}")
    print(f"  ARGUS live-eval: every 5th event triggers a real /api/argus/evaluate-customer")
    print()
    try:
        while time.time() < deadline:
            _, _, gen = random.choices(GENERATORS, weights=weights, k=1)[0]
            evt = gen(customers)
            cust_id = evt["value"].get("customer_id", "")
            code, _ = publish(token, evt["topic"], evt["key"], evt["value"])
            if code == 200:
                sent += 1
            else:
                failed += 1
            # Live ARGUS evaluation: every 5th event
            if cust_id and (sent % 5 == 0):
                ac, ab = evaluate_argus(token, cust_id)
                if ac == 200:
                    argus_runs += 1
            elapsed = time.time() - started
            rate_actual = sent / elapsed if elapsed > 0 else 0
            print(f"  [{elapsed:6.1f}s] {evt['topic']:<26} {cust_id:<12} "
                  f"sent={sent:>5}  failed={failed:>3}  argus={argus_runs:>3}  rate={rate_actual:.2f}/s", end="\r")
            sys.stdout.flush()
            time.sleep(interval)
    except KeyboardInterrupt:
        print()
    print()
    print(f"  total sent={sent}  failed={failed}  argus_evaluations={argus_runs}")
    return 0 if failed == 0 else 1


def run_burst(token: str, customers: list[dict], n: int) -> int:
    print(f"  burst mode: firing {n} events as fast as possible")
    sent, failed, argus_runs = 0, 0, 0
    weights = [w for _, w, _ in GENERATORS]
    for i in range(n):
        _, _, gen = random.choices(GENERATORS, weights=weights, k=1)[0]
        evt = gen(customers)
        cust_id = evt["value"].get("customer_id", "")
        code, _ = publish(token, evt["topic"], evt["key"], evt["value"])
        if code == 200:
            sent += 1
        else:
            failed += 1
        # Live ARGUS evaluation: every 3rd event
        if cust_id and (i % 3 == 0):
            ac, ab = evaluate_argus(token, cust_id)
            if ac == 200:
                argus_runs += 1
    print(f"  sent={sent}  failed={failed}  argus_evaluations={argus_runs}")
    return 0 if failed == 0 else 1


def run_scenario(token: str, customers: list[dict], name: str, target: str | None) -> int:
    if name not in SCENARIOS:
        print(f"  ✗ unknown scenario: {name}.  valid: {list(SCENARIOS)}", file=sys.stderr)
        return 2
    events = SCENARIOS[name](customers, target)
    print(f"  scenario '{name}': {len(events)} events targeting {target or 'random customer'}")
    sent, failed, argus_runs = 0, 0, 0
    cust_id = target or (events[0]['value'].get('customer_id') if events else '')
    for evt in events:
        code, _ = publish(token, evt["topic"], evt["key"], evt["value"])
        if code == 200:
            sent += 1
            print(f"    ✓ {evt['topic']:<26} {evt['value'].get('customer_id','?')}")
        else:
            failed += 1
            print(f"    ✗ {evt['topic']:<26} HTTP {code}")
        time.sleep(0.4)
    # Final live ARGUS evaluation on the target customer
    if cust_id:
        print(f"  → triggering live ARGUS evaluation for {cust_id}…")
        ac, ab = evaluate_argus(token, cust_id)
        if ac == 200 and isinstance(ab, dict):
            argus_runs = 1
            print(f"    ✓ ARGUS detected {ab.get('detected', 0)} signals · warden severity: {ab.get('severity', '?')}")
        else:
            print(f"    ✗ ARGUS eval failed: HTTP {ac}")
    print(f"  sent={sent}  failed={failed}  argus_evaluations={argus_runs}")
    return 0 if failed == 0 else 1


def main() -> int:
    global ORCHESTRATOR, BANK
    p = argparse.ArgumentParser(description="PCOP live-event simulator")
    p.add_argument("--rate", type=float, default=1.0,
                   help="events per second in --rate mode (default 1.0)")
    p.add_argument("--duration", type=float, default=0,
                   help="stop after N seconds in --rate mode (0 = forever)")
    p.add_argument("--burst", type=int, default=0,
                   help="fire N events as fast as possible and exit")
    p.add_argument("--scenario", choices=list(SCENARIOS),
                   help="fire a pre-built demo scenario and exit")
    p.add_argument("--argus", metavar="CUSTOMER_ID",
                   help="run a single live ARGUS evaluation for CUSTOMER_ID and exit")
    p.add_argument("--customer", help="scenario target customer (default: random)")
    p.add_argument("--user", default="admin", help="login username")
    p.add_argument("--password", default="admin123", help="login password")
    p.add_argument("--limit", type=int, default=50, help="customer pool size")
    p.add_argument("--orchestrator", default=ORCHESTRATOR)
    p.add_argument("--bank", default=BANK)
    args = p.parse_args()

    ORCHESTRATOR = args.orchestrator
    BANK         = args.bank

    print("PCOP live-event simulator")
    print(f"  orchestrator = {ORCHESTRATOR}")
    print(f"  bank         = {BANK}")
    print(f"  started at   = {datetime.now(timezone.utc).isoformat()}")
    print()

    print("  → logging in…")
    token = fetch_token(args.user, args.password)
    if not token:
        print("  ✗ could not obtain JWT — is the orchestrator running?", file=sys.stderr)
        return 1
    print(f"  ✓ JWT obtained for {args.user}")

    print(f"  → fetching up to {args.limit} customers from Bank API…")
    customers = fetch_customers(token, args.limit)
    if not customers:
        print("  ✗ no customers returned", file=sys.stderr)
        return 1
    print(f"  ✓ {len(customers)} customers loaded")

    print()
    if args.argus:
        print(f"  → running live ARGUS evaluation for {args.argus}…")
        ac, ab = evaluate_argus(token, args.argus)
        if ac == 200 and isinstance(ab, dict):
            n = ab.get("detected", 0)
            sev = ab.get("severity", "?")
            print(f"    ✓ ARGUS detected {n} signals · warden severity: {sev}")
            signals = (ab.get("raw") or {}).get("signals", [])
            for s in signals:
                marker = "🔥" if s.get("detected") else "  "
                print(f"    {marker} {s.get('signal_type'):<22} conf={s.get('confidence', 0):.2f} "
                      f"stat={s.get('cusum_value', 0):.2f} method={s.get('method')}")
            return 0
        print(f"    ✗ ARGUS eval failed: HTTP {ac}  body={ab}", file=sys.stderr)
        return 1
    if args.scenario:
        return run_scenario(token, customers, args.scenario, args.customer)
    if args.burst > 0:
        return run_burst(token, customers, args.burst)
    return run_rate(token, customers, args.rate, args.duration)


if __name__ == "__main__":
    sys.exit(main())
