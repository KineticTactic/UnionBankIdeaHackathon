# Union Bank — Retention Playbooks

## PLAYBOOK-001: High-Value Customer (Premium / HNI Tier)

**Target Signal:** churn_score > 0.80, portfolio_value > 500,000

**Primary Channel:** RM personal call within 48 hours

**Offer Ladder:**
1. Relationship Manager assignment / re-introduction call
2. Premium rate on FD (up to +0.25% above standard)
3. Waiver of annual locker or credit card fees
4. Invitation to exclusive customer event

**Talk Track:** Lead with appreciation for long tenure. Acknowledge recent activity change if applicable. Do NOT mention churn risk explicitly. Position call as a proactive service check-in.

**Success Metric:** Digital activity restoration within 14 days OR new product opened within 30 days

---

## PLAYBOOK-002: Mid-Tier Salary Account

**Target Signal:** churn_score 0.60–0.80, salary credit gap > 2 months

**Primary Channel:** Email (personalized) + In-app banner

**Offer Ladder:**
1. Zero-balance waiver for 3 months
2. Salary advance / overdraft facility pre-approval
3. Cashback offer on UPI transactions (2% up to ₹500/month)

**Talk Track:** Subject line: "Your Union Bank account — a quick note." Acknowledge service gap without blame. Offer convenience as primary hook.

**Exclusion:** Do not contact within 48 hours of a declined transaction (customer frustration window).

---

## PLAYBOOK-003: Digital Drop-off (Mobile/NetBanking Inactive)

**Target Signal:** app_logins_30d == 0, was_active_prior_90d == True

**Primary Channel:** SMS + app push notification

**Offer:** Reactivation bonus — ₹100 cashback on first transaction after reactivation

**Talk Track:** "We noticed you haven't logged in recently. Here's ₹100 to say hello again."

**Timing:** Send at 10:00 AM or 6:00 PM local time (engagement peaks). Avoid Mondays.

---

## PLAYBOOK-004: Life Event — Job Change / Salary Bank Switch Risk

**Target Signal:** employer_change_detected OR salary_credit_source_changed

**Primary Channel:** RM call (if HNI), else personalised email

**Offer Ladder:**
1. Salary account benefits presentation (0 min balance, fuel surcharge waiver)
2. Home loan / auto loan pre-approval letter (if credit score > 720)
3. Payroll relationship manager introduction

**Talk Track:** Congratulate on new role. Position Union Bank as the ideal primary bank for the new phase. Frame loan pre-approval as a welcome gift.

---

## PLAYBOOK-005: Seasonal Reactivation (Festival / Year-End)

**Target Signal:** dormant_days > 60, seasonal_spend_profile_match == True

**Primary Channel:** In-app offer card + email

**Offer:** Festival cashback offer on category spend (groceries, travel, or electronics based on past profile)

**Timing:** Launch 7 days before festival. End offer 2 days after.

**Cap:** Max ₹300 cashback per customer per event.

---

## PLAYBOOK-006: Suppression Rules (Apply Before Any Outreach)

- Customer has opted out of all marketing: **SUPPRESS all channels**
- Deceased flag on CRM: **SUPPRESS immediately, escalate to branch**
- Legal / collections hold: **SUPPRESS, notify collections team only**
- Recent complaint (< 7 days, unresolved): **SUPPRESS, route to service recovery team**
- Already contacted via same channel < 72h: **SUPPRESS** (cooldown)
