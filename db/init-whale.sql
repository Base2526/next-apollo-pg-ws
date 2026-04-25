-- Create dedicated whale database on first cluster initialization.
SELECT 'CREATE DATABASE whale_ill_system OWNER app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'whale_ill_system')
\gexec

\connect whale_ill_system

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS whale_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain TEXT NOT NULL,
  token_address TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  decimals INT NOT NULL,
  total_supply NUMERIC(78, 18),
  circulating_supply NUMERIC(78, 18),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chain, token_address)
);

CREATE TABLE IF NOT EXISTS whale_wallet_labels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  label_type TEXT NOT NULL,
  label_name TEXT,
  confidence_score NUMERIC(5, 2),
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chain, wallet_address)
);

CREATE TABLE IF NOT EXISTS smart_money_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chain TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  strategy_tag TEXT,
  win_rate NUMERIC(6, 4),
  avg_return_30d NUMERIC(12, 6),
  risk_score NUMERIC(6, 2),
  confidence_score NUMERIC(6, 2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chain, wallet_address)
);

CREATE TABLE IF NOT EXISTS whale_holder_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL REFERENCES whale_tokens(id) ON DELETE CASCADE,
  chain TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  balance NUMERIC(78, 18) NOT NULL,
  pct_supply NUMERIC(24, 12) NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(token_id, wallet_address, snapshot_at)
);

CREATE TABLE IF NOT EXISTS whale_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL REFERENCES whale_tokens(id) ON DELETE CASCADE,
  chain TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INT NOT NULL,
  block_number BIGINT NOT NULL,
  block_time TIMESTAMPTZ NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount_raw NUMERIC(78, 0),
  amount_decimal NUMERIC(78, 18),
  usd_value NUMERIC(32, 8),
  from_label_type TEXT,
  to_label_type TEXT,
  is_exchange_in BOOLEAN NOT NULL DEFAULT FALSE,
  is_exchange_out BOOLEAN NOT NULL DEFAULT FALSE,
  is_internal_like BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(token_id, tx_hash, log_index)
);

CREATE TABLE IF NOT EXISTS whale_holder_daily_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL REFERENCES whale_tokens(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  holder_count INT NOT NULL DEFAULT 0,
  whale_holder_count INT NOT NULL DEFAULT 0,
  top10_concentration NUMERIC(24, 12) NOT NULL DEFAULT 0,
  top20_concentration NUMERIC(24, 12) NOT NULL DEFAULT 0,
  top50_concentration NUMERIC(24, 12) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(token_id, stat_date)
);

CREATE TABLE IF NOT EXISTS whale_exchange_flow_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL REFERENCES whale_tokens(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  exchange_inflow NUMERIC(78, 18) NOT NULL DEFAULT 0,
  exchange_outflow NUMERIC(78, 18) NOT NULL DEFAULT 0,
  netflow NUMERIC(78, 18) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(token_id, stat_date)
);

CREATE TABLE IF NOT EXISTS whale_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL REFERENCES whale_tokens(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  signal_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  signal_reason TEXT,
  signal_date DATE NOT NULL,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whale_unlock_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL REFERENCES whale_tokens(id) ON DELETE CASCADE,
  unlock_date DATE NOT NULL,
  amount NUMERIC(78, 18) NOT NULL,
  pct_supply NUMERIC(24, 12),
  source TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(token_id, unlock_date, source)
);

CREATE TABLE IF NOT EXISTS wallet_performance_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL REFERENCES whale_tokens(id) ON DELETE CASCADE,
  chain TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  lookback_days INT NOT NULL DEFAULT 30,
  inflow_amount NUMERIC(78, 18) NOT NULL DEFAULT 0,
  outflow_amount NUMERIC(78, 18) NOT NULL DEFAULT 0,
  netflow_amount NUMERIC(78, 18) NOT NULL DEFAULT 0,
  avg_entry_price NUMERIC(32, 8),
  avg_exit_price NUMERIC(32, 8),
  realized_pnl_pct NUMERIC(12, 6),
  unrealized_pnl_pct NUMERIC(12, 6),
  win_rate NUMERIC(6, 4),
  trades_count INT NOT NULL DEFAULT 0,
  last_active TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(token_id, wallet_address, lookback_days)
);

CREATE TABLE IF NOT EXISTS token_playability_score (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL REFERENCES whale_tokens(id) ON DELETE CASCADE,
  playability_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  trade_state TEXT NOT NULL DEFAULT 'Wait',
  is_playable BOOLEAN NOT NULL DEFAULT FALSE,
  smart_money_inflow_7d NUMERIC(78, 18) NOT NULL DEFAULT 0,
  whale_accumulation_7d NUMERIC(78, 18) NOT NULL DEFAULT 0,
  exchange_pressure_score NUMERIC(6, 2) NOT NULL DEFAULT 50,
  liquidity_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  volume_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  unlock_risk_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  concentration_risk_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  data_confidence_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  reasons_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(token_id)
);

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

CREATE INDEX IF NOT EXISTS idx_whale_holder_snapshots_token_snapshot
  ON whale_holder_snapshots(token_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_whale_holder_snapshots_wallet
  ON whale_holder_snapshots(chain, wallet_address);

CREATE INDEX IF NOT EXISTS idx_whale_transfers_token_time
  ON whale_transfers(token_id, block_time DESC);

CREATE INDEX IF NOT EXISTS idx_whale_transfers_exchange_flags
  ON whale_transfers(token_id, is_exchange_in, is_exchange_out, block_time DESC);

CREATE INDEX IF NOT EXISTS idx_whale_wallet_labels_chain_wallet
  ON whale_wallet_labels(chain, wallet_address);

CREATE INDEX IF NOT EXISTS idx_smart_money_wallets_chain_wallet
  ON smart_money_wallets(chain, wallet_address);

CREATE INDEX IF NOT EXISTS idx_wallet_performance_token_lookback
  ON wallet_performance_stats(token_id, lookback_days, netflow_amount DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_performance_wallet
  ON wallet_performance_stats(chain, wallet_address);

CREATE INDEX IF NOT EXISTS idx_token_playability_score
  ON token_playability_score(playability_score DESC, trade_state);

CREATE INDEX IF NOT EXISTS idx_whale_signals_token_date
  ON whale_signals(token_id, signal_date DESC);

CREATE INDEX IF NOT EXISTS idx_whale_unlock_events_token_date
  ON whale_unlock_events(token_id, unlock_date);

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

CREATE INDEX IF NOT EXISTS idx_whale_alert_state_recent
  ON whale_alert_state(token_id, last_alerted_at DESC);

CREATE INDEX IF NOT EXISTS idx_whale_alert_events_recent
  ON whale_alert_events(token_id, created_at DESC);
