"""
generate_demo_data.py
Generates 50 realistic bank customers across the full risk spectrum.
5 distinct archetypes — just like a real retail bank portfolio.

Run: python generate_demo_data.py
Output: server/data/*.json
"""
import json, math, random
from pathlib import Path
import numpy as np

OUT = Path(__file__).parent / "server" / "data"
OUT.mkdir(parents=True, exist_ok=True)

rng = np.random.default_rng(42)
random.seed(42)

# ─────────────────────────────────────────────────────────────────
# REFERENCE DATA
# ─────────────────────────────────────────────────────────────────
FIRST_NAMES = [
    "Arjun","Priya","Rahul","Sneha","Vikram","Ananya","Rohit","Kavya",
    "Aditya","Meera","Suresh","Divya","Nikhil","Pooja","Amit","Shreya",
    "Rajesh","Neha","Kiran","Swati","Varun","Anjali","Sanjay","Ritu",
    "Deepak","Nisha","Prakash","Simran","Vijay","Aarti","Manish","Pallavi",
    "Sunil","Komal","Ashish","Tanvi","Ravi","Shweta","Manoj","Preeti",
    "Gaurav","Rekha","Pankaj","Sunita","Sachin","Geeta","Vivek","Madhu",
    "Naveen","Leela"
]
LAST_NAMES = [
    "Sharma","Patel","Singh","Kumar","Gupta","Joshi","Mehta","Verma",
    "Nair","Iyer","Reddy","Menon","Shah","Agarwal","Mishra","Chauhan",
    "Bose","Das","Rao","Pillai","Malhotra","Khanna","Sinha","Dubey",
    "Choudhary","Pandey","Srivastava","Tripathi","Tiwari","Banerjee",
    "Bhatt","Naidu","Rajan","Iyengar","Goswami","Desai","Jain","Chopra",
    "Kapoor","Saxena","Bajaj","Oberoi","Lal","Dutta","Ghosh","Mukherjee",
    "Roy","Sen","Chakraborty","Bhatia"
]
CITIES = [
    ("Mumbai",1),("Delhi",1),("Bangalore",1),("Chennai",1),("Hyderabad",1),
    ("Pune",2),("Kolkata",2),("Ahmedabad",2),("Jaipur",2),("Surat",2),
    ("Lucknow",3),("Kochi",3),("Chandigarh",3),("Nagpur",3),("Indore",3),
]
RM_NAMES = [
    "Aditya Sharma","Priya Menon","Rohit Kapoor","Sunita Nair",
    "Vikram Joshi","Deepa Krishnan","Anand Pillai","Ritu Malhotra",
]
CHANNELS = ["email","sms","push","phone","branch"]
SIG_NAMES = [
    "txn_frequency","balance_change","atm_withdrawals",
    "app_logins","complaint_count","digital_ratio",
    "channel_entropy","salary_credits","inactivity_streak",
]

def pick_name(i):
    return f"{FIRST_NAMES[i % len(FIRST_NAMES)]} {LAST_NAMES[i % len(LAST_NAMES)]}"

def pick_city():
    c, t = random.choice(CITIES)
    return c, t

def sigmoid(x):
    return 1 / (1 + math.exp(-x))

# ─────────────────────────────────────────────────────────────────
# ARCHETYPE DEFINITIONS  (total = 50)
# ─────────────────────────────────────────────────────────────────
# Each archetype defines ranges for key fields.
# risk_tier, churn_score_range, and behaviour patterns.

ARCHETYPES = [
    # ── 1. VIP LOYALISTS  (8 customers)
    # Long tenure, premium segment, multiple products, high balance,
    # very active digitally, salary credit every month, 0 complaints.
    # These are the bank's best customers — NOT at risk.
    {
        "label":        "vip_loyal",
        "count":        8,
        "risk_tier":    "NONE",
        "score_range":  (0.03, 0.18),
        "segment":      ["HNW","Mass Affluent"],
        "tenure_mth":   (84, 216),          # 7–18 years
        "age":          (38, 62),
        "income":       (1_200_000, 5_000_000),
        "balance":      (800_000, 8_000_000),
        "product_count":(4, 6),
        "txn_freq_90d": (45, 75),
        "inactivity":   (0, 8),
        "digital_ratio":(0.75, 0.98),
        "complaint_ct": (0, 0),
        "salary_credits":(3, 4),
        "app_logins":   (30, 60),
        "nps":          (8, 10),
        "n_signals":    0,
        "life_event_prob": 0.10,
    },
    # ── 2. HEALTHY ACTIVE  (12 customers)
    # Mid-tenure, mass affluent / mass, regular transactions,
    # consistent salary credit, low inactivity. Slight dip recently.
    {
        "label":        "healthy_active",
        "count":        12,
        "risk_tier":    "MONITOR",
        "score_range":  (0.18, 0.35),
        "segment":      ["Mass Affluent","Mass Market","SME"],
        "tenure_mth":   (36, 96),
        "age":          (28, 52),
        "income":       (400_000, 1_500_000),
        "balance":      (80_000, 600_000),
        "product_count":(2, 4),
        "txn_freq_90d": (28, 55),
        "inactivity":   (5, 22),
        "digital_ratio":(0.55, 0.80),
        "complaint_ct": (0, 1),
        "salary_credits":(2, 3),
        "app_logins":   (18, 45),
        "nps":          (5, 8),
        "n_signals":    (1, 2),
        "life_event_prob": 0.20,
    },
    # ── 3. DRIFTING AWAY  (12 customers)
    # Activity declining over last 60 days, some inactivity,
    # digital engagement dropping. Could be a life event or churn signal.
    {
        "label":        "drifting",
        "count":        12,
        "risk_tier":    "STANDARD",
        "score_range":  (0.38, 0.60),
        "segment":      ["Mass Market","Mass Affluent","SME"],
        "tenure_mth":   (18, 72),
        "age":          (25, 48),
        "income":       (280_000, 900_000),
        "balance":      (20_000, 250_000),
        "product_count":(1, 3),
        "txn_freq_90d": (12, 32),
        "inactivity":   (22, 48),
        "digital_ratio":(0.30, 0.60),
        "complaint_ct": (0, 2),
        "salary_credits":(1, 3),
        "app_logins":   (6, 22),
        "nps":          (2, 6),
        "n_signals":    (2, 4),
        "life_event_prob": 0.40,
    },
    # ── 4. HIGH RISK  (10 customers)
    # Multiple complaint calls, inactivity streaks, declining balance,
    # salary may have stopped, exploring competitor products.
    {
        "label":        "high_risk",
        "count":        10,
        "risk_tier":    "ESCALATE",
        "score_range":  (0.62, 0.80),
        "segment":      ["Mass Market","Mass Affluent","SME"],
        "tenure_mth":   (8, 48),
        "age":          (24, 55),
        "income":       (180_000, 700_000),
        "balance":      (5_000, 120_000),
        "product_count":(1, 2),
        "txn_freq_90d": (4, 20),
        "inactivity":   (45, 72),
        "digital_ratio":(0.15, 0.42),
        "complaint_ct": (1, 3),
        "salary_credits":(0, 2),
        "app_logins":   (1, 10),
        "nps":          (-1, 4),
        "n_signals":    (4, 6),
        "life_event_prob": 0.60,
    },
    # ── 5. CRITICAL / ABOUT TO CHURN  (8 customers)
    # Barely any activity, overdrafts, multiple escalated complaints,
    # no salary credit for 2+ months, possible account closure inquiry.
    {
        "label":        "critical",
        "count":        8,
        "risk_tier":    "PRIORITY",
        "score_range":  (0.81, 0.96),
        "segment":      ["Mass Market","SME","Mass Affluent"],
        "tenure_mth":   (4, 36),
        "age":          (22, 50),
        "income":       (120_000, 500_000),
        "balance":      (500, 35_000),
        "product_count":(1, 1),
        "txn_freq_90d": (0, 10),
        "inactivity":   (60, 88),
        "digital_ratio":(0.05, 0.25),
        "complaint_ct": (2, 5),
        "salary_credits":(0, 1),
        "app_logins":   (0, 5),
        "nps":          (-1, 2),
        "n_signals":    (5, 9),
        "life_event_prob": 0.70,
    },
]

LIFE_EVENTS = [
    ("JOB_CHANGE",        "Changed employer recently — income pattern shifted"),
    ("RELOCATION",        "Moved to a new city — branch / ATM usage changed"),
    ("SALARY_CHANGE",     "Significant income variation detected over 60 days"),
    ("FINANCIAL_STRESS",  "Overdraft pattern and late-payment signals detected"),
    ("RETIREMENT",        "Approaching / recently retired — income cadence changed"),
    ("COMPLAINT_DRIVEN",  "Escalated complaint not resolved — service dissatisfaction"),
    ("COMPETITOR_INQUIRY","Possible inquiry at competitor bank detected via enrichment"),
    ("LIFE_MILESTONE",    "Wedding / new baby / home purchase detected via MCC pattern"),
]

SEG_EMPLOYERS = {
    "HNW":          ["Tata Group","Reliance Industries","HDFC Bank Ltd","Infosys Ltd","Self-employed (Director)"],
    "Mass Affluent":["Cognizant","HCL Technologies","Axis Bank","L&T","Wipro Ltd","Mahindra & Mahindra"],
    "Mass Market":  ["State Bank of India","ONGC","BHEL","Indian Railways","Punjab National Bank","Govt. of India","NTPC Ltd"],
    "SME":          ["Proprietorship (Retail)","Partnership Firm","Family Business","Sole Trader","Private Ltd Co."],
}

TIER_ACTION = {
    "PRIORITY": ("RM_VISIT",   "IMMEDIATE", "RETENTION_OFFER",  "full_retention"),
    "ESCALATE": ("PHONE_CALL", "24H",       "FEE_WAIVER",       "full_retention"),
    "STANDARD": ("EMAIL",      "72H",       "PRODUCT_UPGRADE",  "standard"),
    "MONITOR":  ("SMS",        "WEEKLY",    "ENGAGEMENT_REWARD","light_touch"),
    "NONE":     ("PUSH",       "MONTHLY",   "NONE",             "none"),
}

EMAIL_BODIES = {
    "PRIORITY": (
        "Dear {name},\n\n"
        "I wanted to reach out personally as your Relationship Manager at Union Bank. "
        "I've noticed some changes in your account over the past few weeks and would love "
        "the opportunity to speak with you directly.\n\n"
        "As a valued customer, I've arranged a {offer} for your account — no paperwork "
        "needed on your end. I'd also love to understand if there's anything we can do better.\n\n"
        "Could we find 15 minutes this week? My direct line is 1800-XXX-XXXX.\n\n"
        "Warm regards,\n{rm}\nSenior Relationship Manager, Union Bank"
    ),
    "ESCALATE": (
        "Dear {name},\n\n"
        "I hope you're well. Your relationship with Union Bank means a great deal to us, "
        "and I noticed some recent changes in your account that I'd like to discuss.\n\n"
        "I've taken the liberty of arranging a {offer} as a token of our appreciation "
        "for your continued trust in us. This has been applied to your account automatically.\n\n"
        "Please don't hesitate to call me at 1800-XXX-XXXX or simply reply to this email.\n\n"
        "Best regards,\n{rm}\nRelationship Manager, Union Bank"
    ),
    "STANDARD": (
        "Dear {name},\n\n"
        "Thank you for being a Union Bank customer. We've been reviewing our portfolio "
        "and noticed an opportunity to add more value to your banking experience.\n\n"
        "Based on your profile, you're eligible for a {offer}. "
        "To know more, please visit your nearest branch or call 1800-XXX-XXXX.\n\n"
        "Regards,\n{rm}\nUnion Bank Customer Relations"
    ),
    "MONITOR": (
        "Hi {name},\n\n"
        "We appreciate your loyalty to Union Bank. As a thank-you, "
        "you've been selected for our {offer} programme.\n\n"
        "Log in to the Union Bank app or visit unionbank.in to claim your benefit.\n\n"
        "Thanks,\nUnion Bank Team"
    ),
}

SMS_BODIES = {
    "PRIORITY": "Union Bank: {name}, your RM {rm} will call you today regarding your account. Ref: {cid}. Call 1800-XXX-XXXX. Reply STOP to opt out.",
    "ESCALATE": "Hi {name}! Your {offer} from Union Bank is live. No action needed. Questions? Call 1800-XXX-XXXX. Reply STOP to unsubscribe.",
    "STANDARD": "Union Bank: {name}, you're eligible for a {offer}. Login to app or visit branch. Reply STOP to opt out.",
    "MONITOR":  "Hi {name}! Your {offer} is ready on the Union Bank app. Tap to claim. Reply STOP to unsubscribe.",
}

# ─────────────────────────────────────────────────────────────────
# GENERATE CUSTOMERS
# ─────────────────────────────────────────────────────────────────
customers, scores_list, signals_list = [], [], []
txn_list, survival_list = [], []
action_plans, herald_list = [], []

idx = 0
for arch in ARCHETYPES:
    for k in range(arch["count"]):
        i   = idx
        idx += 1
        cid = f"CUST-{i+1:03d}"

        # --- core demographics
        age = int(rng.integers(*arch["age"]))
        seg = random.choice(arch["segment"])
        emp_pool = SEG_EMPLOYERS.get(seg, SEG_EMPLOYERS["Mass Market"])
        employer = random.choice(emp_pool)
        city, city_tier = pick_city()

        income    = int(rng.integers(*arch["income"]))
        balance   = int(rng.integers(*arch["balance"]))
        tenure    = int(rng.integers(*arch["tenure_mth"]))
        prod_ct   = int(rng.integers(arch["product_count"][0], arch["product_count"][1]+1))
        txn_freq  = int(rng.integers(*arch["txn_freq_90d"]))
        inact_d   = int(rng.integers(*arch["inactivity"]))
        dig_r     = float(rng.uniform(*arch["digital_ratio"]))
        comp_ct   = int(rng.integers(arch["complaint_ct"][0], max(arch["complaint_ct"][1]+1, arch["complaint_ct"][0]+1)))
        sal_cred  = int(rng.integers(*arch["salary_credits"]))
        app_log   = int(rng.integers(*arch["app_logins"]))
        nps_val   = int(rng.integers(*arch["nps"]))

        # --- churn score
        lo, hi   = arch["score_range"]
        score    = round(float(rng.uniform(lo, hi)), 4)
        tier     = arch["risk_tier"]

        # --- individual model scores (realistic spread around fusion)
        def jitter(base, sd=0.05):
            return round(float(np.clip(base + rng.normal(0, sd), 0.01, 0.99)), 4)

        genesis_s = jitter(score, 0.08)
        habitat_s = jitter(score, 0.05)
        tare_s    = jitter(score, 0.06)
        graph_s   = jitter(score, 0.04)
        ci_w      = 0.04 + 0.08 * abs(score - 0.5)
        ci_lo     = round(max(0.01, score - ci_w), 4)
        ci_hi     = round(min(0.99, score + ci_w), 4)

        # --- survival probabilities
        def surv(s, days, scale=60):
            lam = -math.log(max(1-s, 0.005)) / scale
            return round(math.exp(-lam * days), 4)
        p7  = round(1 - surv(score, 7),  4)
        p30 = round(1 - surv(score, 30), 4)
        p90 = round(1 - surv(score, 90), 4)
        urgency = "7d" if p7>0.40 else ("30d" if p30>0.40 else "90d")

        # --- life event
        le_type = le_desc = None
        if rng.random() < arch["life_event_prob"]:
            ev = random.choice(LIFE_EVENTS)
            le_type, le_desc = ev

        # --- ARGUS signals
        n_sig_range = arch["n_signals"]
        if isinstance(n_sig_range, tuple):
            n_sigs = int(rng.integers(*n_sig_range))
        else:
            n_sigs = n_sig_range
        sig_pool  = list(range(9))
        chosen_sigs = random.sample(sig_pool, min(n_sigs, 9))
        signals = []
        for j in chosen_sigs:
            method = ("SR" if SIG_NAMES[j] in ("txn_frequency","channel_entropy","inactivity_streak")
                      else ("SPRT" if SIG_NAMES[j] in ("complaint_count","salary_credits") else "CUSUM"))
            signals.append({
                "signal_type":     SIG_NAMES[j],
                "detected":        True,
                "confidence":      round(float(rng.uniform(0.62, 0.97)), 2),
                "cusum_value":     round(float(rng.uniform(5.5, 28.0)), 2),
                "alarm_threshold": 5.0,
                "method":          method,
                "days_active":     int(rng.integers(1, 45)),
            })

        # --- 60-day transactions
        base_f   = max(1, txn_freq // 3)
        n_txns   = int(rng.integers(max(1, base_f-3), base_f+6))
        txns     = []
        for _ in range(n_txns):
            day = int(rng.integers(1, 61))
            amt = float(rng.exponential(max(200, income/800)))
            month = 6 - (day-1) // 30
            day_of_month = ((day-1) % 30) + 1
            txns.append({
                "date":    f"2025-{month:02d}-{day_of_month:02d}",
                "amount":  round(amt, 2),
                "channel": random.choices(["APP","ATM","BRANCH","POS","ONLINE"],
                                           weights=[45,20,5,25,5])[0],
                "type":    random.choices(["DEBIT","CREDIT","TRANSFER","WITHDRAWAL"],
                                           weights=[50,20,20,10])[0],
                "category":random.choice(["Grocery","Salary","Rent","Utilities",
                                           "Entertainment","Healthcare","Travel","Dining"]),
            })
        txns.sort(key=lambda x: x["date"])

        # --- survival curve (30 time points)
        t_pts   = list(range(0, 361, 12))
        s_curve = [surv(score, t) for t in t_pts]

        # --- action plan
        action, urgency_act, offer_code, strategy = TIER_ACTION[tier]
        if seg == "HNW" and tier == "ESCALATE":
            action = "RM_VISIT"
        offer_str = offer_code.replace("_"," ").title()
        rm_name   = random.choice(RM_NAMES)
        pref_ch   = random.choice(CHANNELS)
        rationale = (
            f"{len(signals)} active ARGUS signal{'s' if len(signals)!=1 else ''} detected. "
            + (f"Life event: {le_type}. " if le_type else "")
            + f"Ensemble score {score:.3f} → {tier} tier. "
            + f"Urgency horizon: {urgency}."
        )

        # --- HERALD content
        email_body = sms_body = push_body = None
        if tier in EMAIL_BODIES:
            email_body = EMAIL_BODIES[tier].format(
                name=FIRST_NAMES[i % len(FIRST_NAMES)],
                offer=offer_str, rm=rm_name, cid=cid)
            sms_body   = SMS_BODIES.get(tier,"").format(
                name=FIRST_NAMES[i % len(FIRST_NAMES)],
                offer=offer_str, rm=rm_name, cid=cid)
            push_body  = f"Your {offer_str} from Union Bank is ready. Tap to view."

        # ── assemble records
        customers.append({
            "customer_id":          cid,
            "full_name":            pick_name(i),
            "first_name":           FIRST_NAMES[i % len(FIRST_NAMES)],
            "email":                f"{FIRST_NAMES[i%len(FIRST_NAMES)].lower()}.{LAST_NAMES[i%len(LAST_NAMES)].lower()}@email.com",
            "phone":                f"+91 {rng.integers(70000,99999):05d} {rng.integers(10000,99999):05d}",
            "age":                  age,
            "income":               income,
            "tenure_months":        tenure,
            "segment":              seg,
            "archetype":            arch["label"],
            "city":                 city,
            "city_tier":            city_tier,
            "product_count":        prod_ct,
            "employer":             employer,
            "relationship_manager": rm_name,
            "preferred_channel":    pref_ch,
            "email_opt_in":         bool(rng.random() > 0.12),
            "sms_opt_in":           bool(rng.random() > 0.08),
            "txn_freq_90d":         txn_freq,
            "avg_txn_amount":       round(float(rng.exponential(max(200, income/900))), 2),
            "inactivity_days":      inact_d,
            "digital_ratio":        round(dig_r, 3),
            "complaint_count":      comp_ct,
            "atm_withdrawals_90d":  int(rng.integers(0, 20)),
            "app_logins_30d":       app_log,
            "balance":              balance,
            "salary_credit_count":  sal_cred,
            "nps":                  nps_val,
            "risk_tier":            tier,
            "churn_score":          score,
            "life_event":           le_type,
            "life_event_desc":      le_desc,
        })

        scores_list.append({
            "customer_id":           cid,
            "final_score":           score,
            "risk_tier":             tier,
            "genesis_score":         genesis_s,
            "habitat_score":         habitat_s,
            "tare_score":            tare_s,
            "graph_score":           graph_s,
            "ci_lower":              ci_lo,
            "ci_upper":              ci_hi,
            "p7":                    p7,
            "p30":                   p30,
            "p90":                   p90,
            "urgency_horizon":       urgency,
            "ensemble_disagreement": round(float(np.std([genesis_s,habitat_s,tare_s,graph_s])),4),
        })

        signals_list.append({
            "customer_id": cid,
            "signals":     signals,
            "alarm_count": len(signals),
        })

        txn_list.append({"customer_id": cid, "transactions": txns})

        survival_list.append({
            "customer_id":  cid,
            "time_points":  t_pts,
            "survival":     s_curve,
            "p7": p7, "p30": p30, "p90": p90,
        })

        action_plans.append({
            "customer_id":      cid,
            "action":           action,
            "channel":          pref_ch,
            "urgency":          urgency_act,
            "offer_code":       offer_code,
            "offer_display":    offer_str,
            "content_strategy": strategy,
            "rationale":        rationale,
            "life_event":       le_type,
            "suppressed":       False,
            "tone_modifiers":   ["empathetic","personalised"] if le_type else ["professional"],
            "priority_rank":    i + 1,
        })

        if email_body:
            herald_list.append({
                "customer_id": cid,
                "risk_tier":   tier,
                "email": {
                    "subject":            "A personal note from your Relationship Manager" if tier in ("PRIORITY","ESCALATE") else f"An offer for you from Union Bank",
                    "body":               email_body,
                    "compliance_status":  "PASSED",
                    "variant":            "A",
                    "word_count":         len(email_body.split()),
                },
                "sms": {
                    "body":              sms_body,
                    "compliance_status": "PASSED",
                    "char_count":        len(sms_body),
                },
                "push": {
                    "title":             "Union Bank",
                    "body":              push_body,
                    "compliance_status": "PASSED",
                },
            })

# ─────────────────────────────────────────────────────────────────
# PORTFOLIO AGGREGATES
# ─────────────────────────────────────────────────────────────────
all_scores  = [c["churn_score"] for c in customers]
tier_counts = {}
for c in customers:
    tier_counts[c["risk_tier"]] = tier_counts.get(c["risk_tier"], 0) + 1

# 12-week trend
rng2 = np.random.default_rng(99)
base = float(np.mean(all_scores))
trend = []
for w in range(12):
    trend.append({
        "week": w+1, "label": f"W{w+1}",
        "avg_score":      round(base + float(rng2.normal(0, 0.012)) + w*0.0015, 4),
        "critical_count": max(0, int(tier_counts.get("PRIORITY",0) + rng2.integers(-1,2))),
        "high_count":     max(0, int(tier_counts.get("ESCALATE",0) + rng2.integers(-2,2))),
    })

# Signal breakdown
sig_type_counts = {}
for s in signals_list:
    for sig in s["signals"]:
        sig_type_counts[sig["signal_type"]] = sig_type_counts.get(sig["signal_type"],0)+1

portfolio = {
    "summary": {
        "total_customers":      len(customers),
        "avg_churn_score":      round(float(np.mean(all_scores)), 4),
        "priority_count":       int(tier_counts.get("PRIORITY",0)),
        "escalate_count":       int(tier_counts.get("ESCALATE",0)),
        "standard_count":       int(tier_counts.get("STANDARD",0)),
        "monitor_count":        int(tier_counts.get("MONITOR",0)),
        "safe_count":           int(tier_counts.get("NONE",0)),
        "active_signals":       int(sum(s["alarm_count"] for s in signals_list)),
        "life_events_detected": int(sum(1 for c in customers if c["life_event"])),
        "outreach_dispatched":  int(sum(1 for c in customers if c["risk_tier"] in ("PRIORITY","ESCALATE","STANDARD"))),
        "suppression_rate":     0.08,
    },
    "tier_distribution": [
        {"tier": t, "count": int(tier_counts.get(t,0)),
         "pct": round(tier_counts.get(t,0)/len(customers)*100, 1)}
        for t in ["PRIORITY","ESCALATE","STANDARD","MONITOR","NONE"]
    ],
    "churn_trend":     trend,
    "signal_breakdown":[{"type":k,"count":v} for k,v in
                         sorted(sig_type_counts.items(), key=lambda x:-x[1])],
    "model_health": {
        "ensemble_weights": {"genesis":0.15,"habitat":0.30,"tare":0.35,"graph_sage":0.20},
        "model_aucs":       {"genesis":0.742,"habitat":0.881,"tare":0.798,"graph_sage":0.930},
        "fusion_ece":       0.032,
        "fusion_auc":       0.917,
        "last_retrained":   "2026-05-28",
        "n_customers_scored": len(customers),
        "calibration_points": [
            {"bin": round(b,2), "predicted": round(b,2),
             "actual": round(b + float(rng2.uniform(-0.03,0.03)),3)}
            for b in np.arange(0.05,1.0,0.10)
        ],
        "feature_importance": [
            {"feature": f, "importance": round(float(rng2.uniform(0.02,0.18)),4)}
            for f in ["inactivity_days","txn_freq_90d","digital_ratio","complaint_count",
                       "salary_credit_count","balance","app_logins_30d","tenure_months",
                       "product_count","nps","avg_txn_amount","income","age","atm_withdrawals_90d"]
        ],
    },
    "uplift_stats": {
        "ate_doubly_robust": 0.0412,
        "ate_ci_lower":      0.0188,
        "ate_ci_upper":      0.0636,
        "qini_coefficient":  0.1847,
        "treated_visit_rate":0.1423,
        "control_visit_rate":0.1011,
        "n_treated":         32,
        "n_control":         18,
        "qini_curve": [
            {"pct": round(p,2), "uplift": round(p * 0.42 * (1 - p * 0.5), 4)}
            for p in np.arange(0, 1.01, 0.05).tolist()
        ],
    },
    "bandit_state": {
        "arms":          ["Email","SMS","Push","Phone","RM_Visit"],
        "true_rates":    [0.12, 0.09, 0.06, 0.22, 0.35],
        "expected_reward":[0.118, 0.091, 0.063, 0.219, 0.347],
        "selection_counts":[187, 142, 98, 312, 261],
        "total_steps":   1000,
        "regret_reduction_pct": 68.4,
        "best_arm":      "RM_Visit",
        "posteriors": [
            {"arm":"Email",    "alpha":23,"beta":170,"mean":0.119},
            {"arm":"SMS",      "alpha":13,"beta":129,"mean":0.091},
            {"arm":"Push",     "alpha": 6,"beta": 92,"mean":0.061},
            {"arm":"Phone",    "alpha":68,"beta":244,"mean":0.218},
            {"arm":"RM_Visit", "alpha":91,"beta":171,"mean":0.347},
        ],
    },
    "top_at_risk": [
        {
            "customer_id": c["customer_id"], "full_name": c["full_name"],
            "segment": c["segment"], "churn_score": c["churn_score"],
            "risk_tier": c["risk_tier"], "city": c["city"],
            "alarm_count": next(s["alarm_count"] for s in signals_list
                                if s["customer_id"] == c["customer_id"]),
        }
        for c in sorted(customers, key=lambda x: -x["churn_score"])[:10]
    ],
}

# ─────────────────────────────────────────────────────────────────
# WRITE JSON
# ─────────────────────────────────────────────────────────────────
files = {
    "customers.json":    customers,
    "scores.json":       scores_list,
    "signals.json":      signals_list,
    "transactions.json": txn_list,
    "survival.json":     survival_list,
    "action_plans.json": action_plans,
    "herald.json":       herald_list,
    "portfolio.json":    portfolio,
}

for fname, data in files.items():
    p = OUT / fname
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    n = len(data) if isinstance(data, list) else "dict"
    print(f"  {fname:<25} {p.stat().st_size/1024:>7.1f} KB   ({n})")

print(f"\nDone — {len(customers)} customers across {len(ARCHETYPES)} archetypes")
for arch in ARCHETYPES:
    t = arch["risk_tier"]
    print(f"  {arch['label']:<18} {arch['count']:>3}  tier={t}  score={arch['score_range']}")
