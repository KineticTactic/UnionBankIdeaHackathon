-- PCOP production schema — idempotent (safe to run on every boot)
-- All CREATE TABLE/INDEX use IF NOT EXISTS so replicas can boot concurrently.

CREATE TABLE IF NOT EXISTS customers (
    customer_id             TEXT PRIMARY KEY,
    full_name               TEXT,
    first_name              TEXT,
    age                     INT,
    city                    TEXT,
    segment                 TEXT,
    archetype               TEXT,
    employer                TEXT,
    relationship_manager    TEXT,
    tenure_months           INT,
    balance                 NUMERIC,
    income                  NUMERIC,
    product_count           INT,
    nps                     INT,
    risk_tier               TEXT,
    churn_score             NUMERIC,
    preferred_channel       TEXT,
    inactivity_days         INT,
    app_logins_30d          INT,
    txn_freq_90d            INT,
    digital_ratio           NUMERIC,
    salary_credit_count     INT,
    complaint_count         INT,
    life_event              TEXT,
    life_event_desc         TEXT,
    raw                     JSONB,
    updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_risk_tier   ON customers(risk_tier);
CREATE INDEX IF NOT EXISTS idx_customers_segment     ON customers(segment);
CREATE INDEX IF NOT EXISTS idx_customers_churn_score ON customers(churn_score DESC);
CREATE INDEX IF NOT EXISTS idx_customers_city        ON customers(city);

-- Scores — CHRONOS ensemble output (single source of truth in prod)
CREATE TABLE IF NOT EXISTS scores (
    customer_id   TEXT PRIMARY KEY REFERENCES customers(customer_id),
    final_score   NUMERIC,
    risk_tier     TEXT,
    p7            NUMERIC,
    p30           NUMERIC,
    p90           NUMERIC,
    model_version TEXT,
    components    JSONB,
    updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scores_tier  ON scores(risk_tier);
CREATE INDEX IF NOT EXISTS idx_scores_final ON scores(final_score DESC);

-- Signals — ARGUS; one row per signal so we can query/paginate
CREATE TABLE IF NOT EXISTS signals (
    id              BIGSERIAL PRIMARY KEY,
    customer_id     TEXT REFERENCES customers(customer_id),
    signal_type     TEXT,
    method          TEXT,
    confidence      NUMERIC,
    cusum_value     NUMERIC,
    alarm_threshold NUMERIC,
    days_active     INT,
    detected        BOOLEAN DEFAULT true,
    archived        BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signals_customer ON signals(customer_id);
CREATE INDEX IF NOT EXISTS idx_signals_created  ON signals(created_at DESC);

-- Action plans — COMPASS decisions
CREATE TABLE IF NOT EXISTS action_plans (
    customer_id      TEXT PRIMARY KEY REFERENCES customers(customer_id),
    action           TEXT,
    channel          TEXT,
    offer_code       TEXT,
    offer_display    TEXT,
    timing           TEXT,
    rationale        TEXT,
    content_strategy TEXT,
    tone_modifiers   JSONB,
    raw              JSONB,
    updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Outreach log — replaces in-memory outreachLog (deterministic seed, no Math.random)
CREATE TABLE IF NOT EXISTS outreach_log (
    id            TEXT PRIMARY KEY,
    customer_id   TEXT REFERENCES customers(customer_id),
    channel       TEXT,
    risk_tier     TEXT,
    status        TEXT,
    offer_code    TEXT,
    content_hash  TEXT,
    dispatched_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_customer ON outreach_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_outreach_status   ON outreach_log(status);

-- Review cases — replaces reviewStore Maps (UUIDs, not integer counters)
CREATE TABLE IF NOT EXISTS review_cases (
    id          TEXT PRIMARY KEY,
    customer_id TEXT,
    type        TEXT,
    priority    TEXT,
    title       TEXT,
    description TEXT,
    status      TEXT,
    created_by  TEXT,
    assigned_to TEXT,
    context     JSONB,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_status   ON review_cases(status);
CREATE INDEX IF NOT EXISTS idx_review_customer ON review_cases(customer_id);

CREATE TABLE IF NOT EXISTS review_actions (
    id         TEXT PRIMARY KEY,
    case_id    TEXT REFERENCES review_cases(id),
    action     TEXT,
    actor      TEXT,
    notes      TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_actions_case ON review_actions(case_id);

-- Precomputed portfolio aggregates — refreshed on score write, not per-request
CREATE TABLE IF NOT EXISTS portfolio_aggregates (
    id         INT PRIMARY KEY DEFAULT 1,
    data       JSONB,
    updated_at TIMESTAMPTZ DEFAULT now()
);
