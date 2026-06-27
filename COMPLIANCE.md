# PCOP Regulatory Compliance Guide

**DPDPA 2023 · TRAI TCCCPR 2025 · RBI AI Governance 2024 · GDPR (mapped)**

---

## Overview

PCOP (Predictive Customer Outreach Platform) is designed for Union Bank of India. All AI-driven outreach is subject to the following regulatory frameworks:

| Regulation | Applicability | Key Obligations |
|---|---|---|
| **DPDPA 2023** | India | Purpose limitation, consent, erasure, access rights |
| **TRAI TCCCPR 2025** | India | DLT registration, DCA consent, DND scrubbing |
| **RBI AI Governance 2024** | India (banking) | Human override, explainability, bias audit |
| **GDPR** (mapped) | EU reference | Erasure, right of access, automated decision rights |

---

## 1. Consent Framework

### DPDPA 2023 §7 — Purpose Limitation & Consent

- Every customer must grant explicit **DPDPA processing consent** before their data is used for outreach scoring or content generation.
- Consent is scoped to `purpose: outreach` and stored with a timestamp.
- **API**: `POST /api/rights/consent/dpdpa` — body `{ customerId, grant: true/false }`

### TRAI TCCCPR 2025 — Distributed Consent Aggregator (DCA)

- Commercial communications (SMS/Email/Push) require a separate **TRAI DCA consent** in addition to DPDPA.
- Promotional content must use the **140-series** number range.
- Transactional content must use the **160-series** number range.
- All entities must be registered on the **DLT Principal Entity** system.
- Demo entity `DEMO-DLT-001` is pre-approved for all 20 seed customers.
- **API**: `POST /api/rights/consent/trai` — body `{ customerId, grant: true/false, channels: [...] }`

### Opt-Out

- Customers can opt out of individual channels at any time.
- Opt-out is checked in real-time before every outreach dispatch.
- **API**: `POST /api/rights/optout` — body `{ customerId, channel, remove: bool }`

---

## 2. Human-in-the-Loop Gate (RBI AI Governance 2024)

HERALD never sends content autonomously. All AI-generated outreach goes through a mandatory human approval gate:

```
Generate (HERALD) → PENDING_APPROVAL → RM reviews → APPROVED → Send
                                                  ↘ REJECTED → Archived
```

- Approvals expire after **48 hours** if not reviewed.
- The Outreach Hub shows the live approval queue, refreshing every 30 seconds.
- **APIs**:
  - `GET  /api/outreach/pending` — list pending approvals
  - `POST /api/outreach/approve/:id` — approve and trigger send
  - `POST /api/outreach/reject/:id` — reject with mandatory reason

---

## 3. Data Subject Rights (DPDPA 2023 §12–§16)

### Right to Access (§12)
- `GET /api/rights/export?customerId=...` — returns JSON summary including profile, consent history, audit log (last 50 events), approval history, and data categories held.

### Right to Correction (§13)
- `PUT /api/rights/correct` — body `{ customerId, field, newValue, reason }` — logs correction request in audit trail. Allowed fields: `city, segment, email, phone, full_name, age`.

### Right to Erasure (§14)
- `POST /api/rights/erase` — anonymisation request. Consent is revoked immediately; pending approvals are expired. The erasure itself is queued for DPO review.
- **Audit logs are NEVER deleted** — this is a legal retention obligation under DPDPA Rule 4 (7 years).
- Once a customer appears on the erasure list, ARGUS signals are suppressed for that customer.

---

## 4. Audit Log

All compliance-relevant events are appended to an append-only audit log (`server/data/auditLog.json`).

**Retention**: 7 years minimum — never archived, never deleted.

| Event Type | When |
|---|---|
| `SIGNAL_FIRED` | ARGUS detects a behavioural signal |
| `OUTREACH_QUEUED` | HERALD generates content for RM review |
| `OUTREACH_SENT` | RM approves and outreach is dispatched |
| `OUTREACH_BLOCKED` | Consent missing or DND registered |
| `HUMAN_APPROVAL` | RM approves an outreach request |
| `HUMAN_REJECTION` | RM rejects an outreach request |
| `CONSENT_GRANTED` | Customer grants DPDPA or TRAI consent |
| `CONSENT_REVOKED` | Customer revokes consent |
| `OPT_OUT_CHANGED` | Channel opt-out updated |
| `DATA_ACCESS_REQUEST` | Customer requests data export |
| `DATA_CORRECTION` | Correction request logged |
| `DATA_DELETION_REQUEST` | Erasure request filed |
| `RETENTION_CHECK` | Scheduled retention sweep result |

---

## 5. AI Explainability (RBI AI Governance 2024 + GDPR Article 22)

All churn scores computed by CHRONOS FusionXV2 are explainable via the SHAP-style feature decomposition endpoint:

- `GET /api/explain/churn-score?customerId=...` — returns top feature drivers, their contribution percentages, and a plain-language narrative.
- `GET /api/explain/model-health` — model registry with AUC, precision, recall, bias audit status.

The customer detail page exposes an **Explain** tab for RM use.

---

## 6. Bias Audit (RBI AI Governance 2024 §9)

CHRONOS runs a **disparate impact audit** (EEOC 4/5ths rule) before any model recalibration:

- Protected attributes: `gender`, `region`, `age_group`
- Adverse Impact Ratio must be ≥ 0.80 and ≤ 1.20 for all groups
- Results stored in `chronos/ml/checkpoints/bias_audit_results.json`
- **Endpoints**: `GET /bias-audit/status`, `POST /bias-audit/run` (CHRONOS service)

ORACLE's retraining gate (`layer7 oracle analytics/retraining_gate.py`) blocks model recalibration unless:
1. A bias audit has been run within the last 90 days AND passed, AND
2. A model committee approval entry exists.

---

## 7. Data Retention Policy

| Data Category | Retention | Policy |
|---|---|---|
| Audit log entries | 7 years | **Never deleted** — DPDPA Rule 4 |
| Pending approvals (REJECTED/EXPIRED) | 90 days | Archived (flag set, not deleted) |
| Signal data | 2 years | Archived after expiry |
| Churn scores | 2 years | Archived after expiry |

---

## 8. Environment Variables (Compliance-Related)

| Variable | Default | Purpose |
|---|---|---|
| `DLT_ENTITY_ID` | `DEMO-DLT-001` | TRAI DLT registered entity ID |
| `CONSENT_AUDIT_RETENTION_DAYS` | `2555` (7yr) | Consent audit log retention |
| `APPROVAL_EXPIRY_HOURS` | `48` | How long a HERALD approval remains valid |
| `HUMAN_OVERRIDE_REQUIRED` | `true` | Must be `true` in production |
| `DATA_LOCALISATION_MODE` | `india` | Ensures data stays in India region |

---

## 9. Demo Seed Data

All 20 demo customers (`C-00000001` – `C-00000020`) are pre-seeded with:
- `dpdpaConsent.granted = true`
- `traiConsent.granted = true`
- `channels = ['SMS', 'EMAIL', 'PUSH']`
- `optOutChannels = []`
- `dltEntityId = 'DEMO-DLT-001'`

This ensures the live demo at https://moneylords-pcop.up.railway.app works without manual consent setup.
