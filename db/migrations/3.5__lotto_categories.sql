-- Migration 3.5: Add lotto categories system
-- Adds category support for multiple lotto types (Thai Government, Yeekee VIP, etc.)

-- Create lotto_categories table
CREATE TABLE IF NOT EXISTS lotto_categories (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name_th VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url TEXT,
  color VARCHAR(20),
  close_time_label VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add category_id to lotto_bet_types if not exists
ALTER TABLE lotto_bet_types 
ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES lotto_categories(id);

-- Add display_order to lotto_bet_types if not exists
ALTER TABLE lotto_bet_types 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Add category_code to lotto_orders if not exists
ALTER TABLE lotto_orders 
ADD COLUMN IF NOT EXISTS category_code VARCHAR(50);

-- Insert default categories
INSERT INTO lotto_categories (code, name_th, description, color, close_time_label, is_active, display_order)
VALUES 
  ('THAI_GOVERNMENT', 'หวยรัฐบาลไทย', 'หวยรัฐบาลไทยออกงวดละ 2 ครั้งต่อเดือน', '#dc2626', 'ปิดรับ 15.30 น. วันงวด', true, 1),
  ('YEEKEE_VIP', 'จับยี่กี VIP', 'จับยี่กีรอบพิเศษ ออกทุกวัน', '#2563eb', 'ออกรางวัลทุก 15 นาที', true, 2)
ON CONFLICT (code) DO NOTHING;

-- Update existing bet types to belong to THAI_GOVERNMENT category
UPDATE lotto_bet_types 
SET category_id = (SELECT id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT')
WHERE category_id IS NULL;

-- Seed bet types for YEEKEE_VIP category (example)
DO $$
DECLARE
  yeekee_category_id INTEGER;
BEGIN
  SELECT id INTO yeekee_category_id FROM lotto_categories WHERE code = 'YEEKEE_VIP';
  
  -- Check if yeekee bet types already exist
  IF NOT EXISTS (SELECT 1 FROM lotto_bet_types WHERE category_id = yeekee_category_id) THEN
    INSERT INTO lotto_bet_types (category_id, code, name_th, digit_count, payout_rate, min_bet, max_bet, is_active, display_order)
    VALUES 
      (yeekee_category_id, 'YEEKEE_3_TOP', 'สามตัวบน', 3, 500, 1, 1000, true, 1),
      (yeekee_category_id, 'YEEKEE_2_TOP', 'สองตัวบน', 2, 90, 1, 1000, true, 2),
      (yeekee_category_id, 'YEEKEE_2_BOT', 'สองตัวล่าง', 2, 90, 1, 1000, true, 3),
      (yeekee_category_id, 'YEEKEE_RUN_TOP', 'วิ่งบน', 1, 3.5, 1, 1000, true, 4),
      (yeekee_category_id, 'YEEKEE_RUN_BOT', 'วิ่งล่าง', 1, 4.2, 1, 1000, true, 5);
  END IF;
END $$;

-- Create index on category_id for performance
CREATE INDEX IF NOT EXISTS idx_lotto_bet_types_category_id ON lotto_bet_types(category_id);
CREATE INDEX IF NOT EXISTS idx_lotto_orders_category_code ON lotto_orders(category_code);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_lotto_categories_updated_at ON lotto_categories;
CREATE TRIGGER update_lotto_categories_updated_at 
  BEFORE UPDATE ON lotto_categories 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE lotto_categories IS 'Lotto category definitions (Thai Government, Yeekee, etc.)';
COMMENT ON COLUMN lotto_categories.code IS 'Unique category code (THAI_GOVERNMENT, YEEKEE_VIP, etc.)';
COMMENT ON COLUMN lotto_categories.close_time_label IS 'Display text for closing time (e.g., "ปิดรับ 15.30 น.")';
COMMENT ON COLUMN lotto_bet_types.category_id IS 'References lotto_categories.id';
COMMENT ON COLUMN lotto_orders.category_code IS 'Category code at time of order';
