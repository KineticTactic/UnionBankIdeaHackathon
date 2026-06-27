-- Migration 002: RM Conversational Copilot message history
-- Item 5 — on-demand [LLM:1 per turn], Postgres-backed memory

CREATE TABLE IF NOT EXISTS copilot_messages (
    id              BIGSERIAL       PRIMARY KEY,
    session_id      UUID            NOT NULL,
    rm_user_id      VARCHAR(64)     NOT NULL,
    customer_id     VARCHAR(64)     NOT NULL,
    role            VARCHAR(16)     NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
    content         TEXT            NOT NULL,
    tools_used      JSONB           NULL,          -- list of tool names invoked this turn
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_copilot_messages_session ON copilot_messages (session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_copilot_messages_customer ON copilot_messages (customer_id, created_at DESC);
