-- Migration: Fix bet_type_code column size
-- Date: 2026-05-03
-- Issue: YEEKEE_3_TOP (12 chars) fails on VARCHAR(10) column
-- Fix: Alter bet_type_code to VARCHAR(50) to support longer codes

BEGIN;

-- Alter lotto_order_items.bet_type_code from VARCHAR(10) to VARCHAR(50)
-- This allows YEEKEE_3_TOP (12 chars) and other longer bet type codes
ALTER TABLE lotto_order_items 
  ALTER COLUMN bet_type_code TYPE VARCHAR(50);

-- Verify and add index if not exists
CREATE INDEX IF NOT EXISTS idx_lotto_order_items_bet_type 
  ON lotto_order_items(bet_type_code);

-- Also ensure number column has enough space (currently VARCHAR(10) is fine for 6-digit numbers)
-- But let's future-proof it
ALTER TABLE lotto_order_items 
  ALTER COLUMN number TYPE VARCHAR(20);

COMMIT;

-- Verification queries (run manually after migration)
-- SELECT column_name, data_type, character_maximum_length 
-- FROM information_schema.columns 
-- WHERE table_name = 'lotto_order_items' 
-- AND column_name IN ('bet_type_code', 'number');
