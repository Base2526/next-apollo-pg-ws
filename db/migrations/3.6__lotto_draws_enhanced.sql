-- Migration 3.6: Enhanced lotto draws for Thai Government Lottery
-- Adds category support, draw periods, and proper lifecycle management

-- Add new columns to lotto_draws
ALTER TABLE lotto_draws 
ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES lotto_categories(id),
ADD COLUMN IF NOT EXISTS code VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS draw_period VARCHAR(20),
ADD COLUMN IF NOT EXISTS name_th VARCHAR(200),
ADD COLUMN IF NOT EXISTS open_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS close_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_date_overridden BOOLEAN DEFAULT false;

-- Update status column to support new statuses
-- Existing: open, closed
-- New: DRAFT, OPEN, CLOSED, RESULTED, CANCELLED
-- Keep existing values compatible

-- Create index on category_id for performance
CREATE INDEX IF NOT EXISTS idx_lotto_draws_category_id ON lotto_draws(category_id);
CREATE INDEX IF NOT EXISTS idx_lotto_draws_status ON lotto_draws(status);
CREATE INDEX IF NOT EXISTS idx_lotto_draws_draw_date ON lotto_draws(draw_date);
CREATE INDEX IF NOT EXISTS idx_lotto_draws_code ON lotto_draws(code);

-- Update existing draw to have category
UPDATE lotto_draws 
SET category_id = (SELECT id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT' LIMIT 1),
    code = 'TH-2026-05-999',
    draw_period = 'FIRST_HALF',
    name_th = 'งวดวันที่ ' || to_char(draw_date, 'DD/MM/') || (EXTRACT(YEAR FROM draw_date)::int + 543)::text,
    open_at = draw_date - INTERVAL '7 days',
    close_at = draw_date + INTERVAL '12 hours',
    is_active = true
WHERE category_id IS NULL;

-- Function to generate Thai Government draws for a given month
CREATE OR REPLACE FUNCTION generate_thai_govt_draws(
  p_year INTEGER,
  p_month INTEGER
) RETURNS TABLE(draw_id INTEGER, draw_code VARCHAR, draw_date DATE, draw_period VARCHAR) AS $$
DECLARE
  v_category_id INTEGER;
  v_first_date DATE;
  v_second_date DATE;
  v_first_code VARCHAR;
  v_second_code VARCHAR;
  v_first_id INTEGER;
  v_second_id INTEGER;
BEGIN
  -- Get Thai Government category ID
  SELECT id INTO v_category_id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT';
  
  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'THAI_GOVERNMENT category not found';
  END IF;
  
  -- Default dates: 1st and 16th of month
  v_first_date := make_date(p_year, p_month, 1);
  v_second_date := make_date(p_year, p_month, 16);
  
  -- Generate codes
  v_first_code := 'TH-' || p_year::text || '-' || lpad(p_month::text, 2, '0') || '-01';
  v_second_code := 'TH-' || p_year::text || '-' || lpad(p_month::text, 2, '0') || '-16';
  
  -- Insert first half draw (UPSERT)
  INSERT INTO lotto_draws (
    category_id, code, draw_date, draw_period, name_th, 
    open_at, close_at, status, is_active
  ) VALUES (
    v_category_id,
    v_first_code,
    v_first_date,
    'FIRST_HALF',
    'งวดวันที่ ' || to_char(v_first_date, 'DD/MM/') || (EXTRACT(YEAR FROM v_first_date)::int + 543)::text,
    v_first_date - INTERVAL '7 days',
    v_first_date - INTERVAL '2 hours',
    'DRAFT',
    true
  )
  ON CONFLICT (code) DO UPDATE SET
    -- Only update if not overridden by admin
    draw_date = CASE 
      WHEN lotto_draws.is_date_overridden = false THEN EXCLUDED.draw_date 
      ELSE lotto_draws.draw_date 
    END,
    name_th = CASE 
      WHEN lotto_draws.is_date_overridden = false THEN EXCLUDED.name_th 
      ELSE lotto_draws.name_th 
    END,
    open_at = CASE 
      WHEN lotto_draws.is_date_overridden = false THEN EXCLUDED.open_at 
      ELSE lotto_draws.open_at 
    END,
    close_at = CASE 
      WHEN lotto_draws.is_date_overridden = false THEN EXCLUDED.close_at 
      ELSE lotto_draws.close_at 
    END
  RETURNING id INTO v_first_id;
  
  -- Insert second half draw (UPSERT)
  INSERT INTO lotto_draws (
    category_id, code, draw_date, draw_period, name_th, 
    open_at, close_at, status, is_active
  ) VALUES (
    v_category_id,
    v_second_code,
    v_second_date,
    'SECOND_HALF',
    'งวดวันที่ ' || to_char(v_second_date, 'DD/MM/') || (EXTRACT(YEAR FROM v_second_date)::int + 543)::text,
    v_second_date - INTERVAL '7 days',
    v_second_date - INTERVAL '2 hours',
    'DRAFT',
    true
  )
  ON CONFLICT (code) DO UPDATE SET
    draw_date = CASE 
      WHEN lotto_draws.is_date_overridden = false THEN EXCLUDED.draw_date 
      ELSE lotto_draws.draw_date 
    END,
    name_th = CASE 
      WHEN lotto_draws.is_date_overridden = false THEN EXCLUDED.name_th 
      ELSE lotto_draws.name_th 
    END,
    open_at = CASE 
      WHEN lotto_draws.is_date_overridden = false THEN EXCLUDED.open_at 
      ELSE lotto_draws.open_at 
    END,
    close_at = CASE 
      WHEN lotto_draws.is_date_overridden = false THEN EXCLUDED.close_at 
      ELSE lotto_draws.close_at 
    END
  RETURNING id INTO v_second_id;
  
  -- Return generated draws
  RETURN QUERY
  SELECT id, code, draw_date, draw_period
  FROM lotto_draws
  WHERE code IN (v_first_code, v_second_code);
END;
$$ LANGUAGE plpgsql;

-- Generate draws for next 12 months starting from current month
DO $$
DECLARE
  v_year INTEGER;
  v_month INTEGER;
  v_counter INTEGER := 0;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_month := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
  
  WHILE v_counter < 12 LOOP
    PERFORM generate_thai_govt_draws(v_year, v_month);
    
    -- Increment month
    v_month := v_month + 1;
    IF v_month > 12 THEN
      v_month := 1;
      v_year := v_year + 1;
    END IF;
    
    v_counter := v_counter + 1;
  END LOOP;
END $$;

-- Set current and next draws to OPEN status
UPDATE lotto_draws
SET status = 'OPEN',
    open_at = CURRENT_TIMESTAMP - INTERVAL '1 day'
WHERE status = 'DRAFT'
  AND draw_date >= CURRENT_DATE
  AND draw_date <= CURRENT_DATE + INTERVAL '2 months'
  AND category_id = (SELECT id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT');

-- Comments
COMMENT ON COLUMN lotto_draws.category_id IS 'References lotto_categories - which type of lottery';
COMMENT ON COLUMN lotto_draws.code IS 'Unique draw code (e.g., TH-2026-05-01)';
COMMENT ON COLUMN lotto_draws.draw_period IS 'FIRST_HALF, SECOND_HALF, or CUSTOM';
COMMENT ON COLUMN lotto_draws.name_th IS 'Thai display name (e.g., งวดวันที่ 16/02/2569)';
COMMENT ON COLUMN lotto_draws.open_at IS 'When betting opens for this draw';
COMMENT ON COLUMN lotto_draws.close_at IS 'When betting closes for this draw';
COMMENT ON COLUMN lotto_draws.is_date_overridden IS 'True if admin manually changed draw_date';
