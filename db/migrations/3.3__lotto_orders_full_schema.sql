-- Lotto Draws
CREATE TABLE IF NOT EXISTS lotto_draws (
  id SERIAL PRIMARY KEY,
  draw_date DATE NOT NULL,
  draw_number VARCHAR(50),
  status VARCHAR(20) DEFAULT 'open',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Lotto Orders
CREATE TABLE IF NOT EXISTS lotto_orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  draw_id INTEGER REFERENCES lotto_draws(id),
  total_amount NUMERIC DEFAULT 0,
  total_win NUMERIC DEFAULT 0,
  result_status VARCHAR(20) DEFAULT 'pending',
  checked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Lotto Order Items
CREATE TABLE IF NOT EXISTS lotto_order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES lotto_orders(id),
  number VARCHAR(10),
  type VARCHAR(10),
  amount NUMERIC DEFAULT 0,
  win_amount NUMERIC DEFAULT 0,
  result_status VARCHAR(20) DEFAULT 'pending',
  matched_result VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON lotto_orders(result_status);
CREATE INDEX IF NOT EXISTS idx_orders_draw ON lotto_orders(draw_id);
CREATE INDEX IF NOT EXISTS idx_items_order ON lotto_order_items(order_id);
