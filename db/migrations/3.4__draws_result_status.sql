-- 20260425: Add result_status and resulted_at to lotto_draws for robust slip filtering

ALTER TABLE lotto_draws
  ADD COLUMN IF NOT EXISTS result_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS resulted_at TIMESTAMPTZ;

-- Backfill result_status for existing draws if needed
UPDATE lotto_draws SET result_status = 'resulted' WHERE status IN ('resulted','closed','completed') AND (result_status IS NULL OR result_status = 'pending');
UPDATE lotto_draws SET result_status = 'pending' WHERE status IN ('open','pending','waiting_result') AND (result_status IS NULL);

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_lotto_draws_result_status ON lotto_draws(result_status);