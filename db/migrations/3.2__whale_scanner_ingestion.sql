-- Run this migration against database: whale_ill_system
CREATE TABLE IF NOT EXISTS whale_sync_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL REFERENCES whale_tokens(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  metric TEXT NOT NULL,
  cursor TEXT,
  latest_block TEXT,
  latest_timestamp TIMESTAMPTZ,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(token_id, provider, metric)
);

CREATE TABLE IF NOT EXISTS whale_ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL REFERENCES whale_tokens(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  status TEXT NOT NULL,
  details_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whale_provider_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL REFERENCES whale_tokens(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  stage TEXT NOT NULL,
  error_message TEXT NOT NULL,
  context_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_trade_history_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL REFERENCES whale_tokens(id) ON DELETE CASCADE,
  chain TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  early_entry_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  conviction_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  consistency_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  trade_quality_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  smart_money_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  classification_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(token_id, chain, wallet_address)
);

CREATE TABLE IF NOT EXISTS whale_scanner_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL REFERENCES whale_tokens(id) ON DELETE CASCADE,
  whale_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  smart_money_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  exchange_pressure_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  concentration_risk_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  unlock_risk_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  final_trade_state TEXT NOT NULL DEFAULT 'WAIT',
  reason_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(token_id)
);

CREATE INDEX IF NOT EXISTS idx_whale_sync_state_token
  ON whale_sync_state(token_id, provider, metric);

CREATE INDEX IF NOT EXISTS idx_whale_ingestion_jobs_recent
  ON whale_ingestion_jobs(token_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whale_provider_errors_recent
  ON whale_provider_errors(token_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_trade_history_summary_smart
  ON wallet_trade_history_summary(token_id, smart_money_score DESC);

CREATE INDEX IF NOT EXISTS idx_whale_scanner_results_state
  ON whale_scanner_results(final_trade_state, whale_score DESC);
