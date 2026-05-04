-- Add result tracking fields to lotto_orders, lotto_order_items, and indexes for lotto_draws

ALTER TABLE lotto_orders
  ADD COLUMN IF NOT EXISTS result_status VARCHAR DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS win_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ;

ALTER TABLE lotto_order_items
  ADD COLUMN IF NOT EXISTS result_status VARCHAR DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS win_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS matched_result VARCHAR,
  ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ;

ALTER TABLE lotto_draws
  ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'open';

CREATE INDEX IF NOT EXISTS idx_lotto_orders_draw_id ON lotto_orders(draw_id);
CREATE INDEX IF NOT EXISTS idx_lotto_orders_status ON lotto_orders(status);
CREATE INDEX IF NOT EXISTS idx_lotto_orders_result_status ON lotto_orders(result_status);
CREATE INDEX IF NOT EXISTS idx_lotto_orders_created_at ON lotto_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_lotto_order_items_order_id ON lotto_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_lotto_draws_status ON lotto_draws(status);
CREATE INDEX IF NOT EXISTS idx_lotto_draws_draw_date ON lotto_draws(draw_date);
