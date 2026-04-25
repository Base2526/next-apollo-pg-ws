-- Run this migration against database: whale_ill_system
CREATE TABLE IF NOT EXISTS whale_alert_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL REFERENCES whale_tokens(id) ON DELETE CASCADE,
  last_trade_state TEXT,
  last_score NUMERIC(6, 2),
  last_alerted_at TIMESTAMPTZ,
  dedupe_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(token_id)
);

CREATE TABLE IF NOT EXISTS whale_alert_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL REFERENCES whale_tokens(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  state TEXT,
  score NUMERIC(6, 2),
  confidence NUMERIC(6, 2),
  dedupe_key TEXT,
  channel TEXT,
  message_text TEXT,
  reason_json JSONB,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whale_alert_state_recent
  ON whale_alert_state(token_id, last_alerted_at DESC);

CREATE INDEX IF NOT EXISTS idx_whale_alert_events_recent
  ON whale_alert_events(token_id, created_at DESC);
