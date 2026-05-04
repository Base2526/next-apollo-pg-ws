-- Create lotto_order_items table with correct columns to match resolver
-- This replaces the old schema with proper column names

-- First, check if old columns exist and migrate data if needed
DO $$
BEGIN
  -- If old 'type' column exists, rename to bet_type_code
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='lotto_order_items' AND column_name='type') THEN
    ALTER TABLE lotto_order_items RENAME COLUMN type TO bet_type_code;
  END IF;
  
  -- If old 'amount' column exists, rename to price
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='lotto_order_items' AND column_name='amount') THEN
    ALTER TABLE lotto_order_items RENAME COLUMN amount TO price;
  END IF;
END $$;

-- Add missing columns if they don't exist
ALTER TABLE lotto_order_items
  ADD COLUMN IF NOT EXISTS bet_type_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_rate NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS possible_win NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS generated_from VARCHAR(50);

-- Create lotto_bet_types table if not exists
CREATE TABLE IF NOT EXISTS lotto_bet_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name_th VARCHAR(100) NOT NULL,
  digit_count INTEGER NOT NULL,
  payout_rate NUMERIC NOT NULL,
  min_bet NUMERIC DEFAULT 1,
  max_bet NUMERIC DEFAULT 2000,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create a development draw for testing
-- This ensures the lotto app works in development mode
INSERT INTO lotto_draws (id, draw_date, draw_number, status, created_at, updated_at)
VALUES (999, CURRENT_DATE, 'DEV999', 'open', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  draw_date = EXCLUDED.draw_date,
  status = EXCLUDED.status,
  updated_at = NOW();

-- Insert bet types if they don't exist
INSERT INTO lotto_bet_types (code, name_th, digit_count, payout_rate, min_bet, max_bet, is_active)
VALUES 
  ('THREE_TOP', '3 ตัวบน', 3, 900, 1, 2000, true),
  ('THREE_TOD', '3 ตัวโต๊ด', 3, 150, 1, 2000, true),
  ('THREE_FRONT', '3 ตัวหน้า', 3, 450, 1, 2000, true),
  ('THREE_BOTTOM', '3 ตัวล่าง', 3, 450, 1, 2000, true),
  ('TWO_TOP', '2 ตัวบน', 2, 90, 1, 2000, true),
  ('TWO_BOTTOM', '2 ตัวล่าง', 2, 90, 1, 2000, true),
  ('RUN_TOP', 'วิ่งบน', 1, 3.2, 1, 2000, true),
  ('RUN_BOTTOM', 'วิ่งล่าง', 1, 4.2, 1, 2000, true),
  ('THREE_REVERSE', '3 ตัวกลับ', 3, 900, 1, 2000, true),
  ('TWO_REVERSE', '2 ตัวกลับ', 2, 90, 1, 2000, true)
ON CONFLICT (code) DO UPDATE SET
  name_th = EXCLUDED.name_th,
  digit_count = EXCLUDED.digit_count,
  payout_rate = EXCLUDED.payout_rate,
  min_bet = EXCLUDED.min_bet,
  max_bet = EXCLUDED.max_bet,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Add status column to lotto_orders if not exists
ALTER TABLE lotto_orders
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS order_no VARCHAR(50) UNIQUE;

-- Create index for order_no
CREATE INDEX IF NOT EXISTS idx_lotto_orders_order_no ON lotto_orders(order_no);

