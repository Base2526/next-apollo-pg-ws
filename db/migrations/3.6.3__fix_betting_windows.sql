-- Fix Thai Government Lottery open/close windows
-- ROOT CAUSE: open_at = draw_date - 7 days is WRONG
-- CORRECT: open_at = when previous draw closes

-- Drop and recreate function with correct logic
DROP FUNCTION IF EXISTS generate_thai_govt_draws(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION generate_thai_govt_draws(
  p_year INTEGER,
  p_month INTEGER
) RETURNS VOID AS $$
DECLARE
  v_category_id INTEGER;
  v_first_date DATE;
  v_second_date DATE;
  v_first_code VARCHAR;
  v_second_code VARCHAR;
  v_first_open_at TIMESTAMPTZ;
  v_first_close_at TIMESTAMPTZ;
  v_second_open_at TIMESTAMPTZ;
  v_second_close_at TIMESTAMPTZ;
  v_prev_month INTEGER;
  v_prev_year INTEGER;
  v_prev_16th_date DATE;
BEGIN
  SELECT id INTO v_category_id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT';
  
  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'THAI_GOVERNMENT category not found';
  END IF;
  
  -- Calculate dates
  v_first_date := make_date(p_year, p_month, 1);
  v_second_date := make_date(p_year, p_month, 16);
  v_first_code := 'TH-' || p_year::text || '-' || lpad(p_month::text, 2, '0') || '-01';
  v_second_code := 'TH-' || p_year::text || '-' || lpad(p_month::text, 2, '0') || '-16';
  
  -- Calculate previous month for 1st draw open_at
  v_prev_month := p_month - 1;
  v_prev_year := p_year;
  IF v_prev_month < 1 THEN
    v_prev_month := 12;
    v_prev_year := v_prev_year - 1;
  END IF;
  v_prev_16th_date := make_date(v_prev_year, v_prev_month, 16);
  
  -- CORRECT BETTING WINDOWS:
  -- 1st draw: opens when previous month 16th closes (prev month 16th 15:30)
  --          closes on 1st at 15:30
  v_first_open_at := (v_prev_16th_date::text || ' 15:30:00')::timestamp AT TIME ZONE 'Asia/Bangkok';
  v_first_close_at := (v_first_date::text || ' 15:30:00')::timestamp AT TIME ZONE 'Asia/Bangkok';
  
  -- 16th draw: opens when current month 1st closes (current month 1st 15:30)
  --           closes on 16th at 15:30
  v_second_open_at := (v_first_date::text || ' 15:30:00')::timestamp AT TIME ZONE 'Asia/Bangkok';
  v_second_close_at := (v_second_date::text || ' 15:30:00')::timestamp AT TIME ZONE 'Asia/Bangkok';
  
  -- First half draw
  INSERT INTO lotto_draws (
    category_id, code, draw_date, draw_period, name_th, 
    open_at, close_at, status, is_active
  ) VALUES (
    v_category_id, v_first_code, v_first_date, 'FIRST_HALF',
    'งวดวันที่ ' || to_char(v_first_date, 'DD/MM/') || (EXTRACT(YEAR FROM v_first_date)::int + 543)::text,
    v_first_open_at, v_first_close_at, 'DRAFT', true
  ) ON CONFLICT (code) DO UPDATE SET
    draw_date = CASE WHEN lotto_draws.is_date_overridden = false THEN EXCLUDED.draw_date ELSE lotto_draws.draw_date END,
    name_th = CASE WHEN lotto_draws.is_date_overridden = false THEN EXCLUDED.name_th ELSE lotto_draws.name_th END,
    open_at = CASE WHEN lotto_draws.is_date_overridden = false THEN EXCLUDED.open_at ELSE lotto_draws.open_at END,
    close_at = CASE WHEN lotto_draws.is_date_overridden = false THEN EXCLUDED.close_at ELSE lotto_draws.close_at END;
  
  -- Second half draw
  INSERT INTO lotto_draws (
    category_id, code, draw_date, draw_period, name_th, 
    open_at, close_at, status, is_active
  ) VALUES (
    v_category_id, v_second_code, v_second_date, 'SECOND_HALF',
    'งวดวันที่ ' || to_char(v_second_date, 'DD/MM/') || (EXTRACT(YEAR FROM v_second_date)::int + 543)::text,
    v_second_open_at, v_second_close_at, 'DRAFT', true
  ) ON CONFLICT (code) DO UPDATE SET
    draw_date = CASE WHEN lotto_draws.is_date_overridden = false THEN EXCLUDED.draw_date ELSE lotto_draws.draw_date END,
    name_th = CASE WHEN lotto_draws.is_date_overridden = false THEN EXCLUDED.name_th ELSE lotto_draws.name_th END,
    open_at = CASE WHEN lotto_draws.is_date_overridden = false THEN EXCLUDED.open_at ELSE lotto_draws.open_at END,
    close_at = CASE WHEN lotto_draws.is_date_overridden = false THEN EXCLUDED.close_at ELSE lotto_draws.close_at END;
  
  RAISE NOTICE 'Generated draws for % - %', p_year, p_month;
END;
$$ LANGUAGE plpgsql;

-- Regenerate all draws with correct open_at/close_at
DO $$
DECLARE
  v_year INTEGER := 2026;
  v_month INTEGER := 5;
  v_counter INTEGER := 0;
BEGIN
  WHILE v_counter < 12 LOOP
    PERFORM generate_thai_govt_draws(v_year, v_month);
    
    v_month := v_month + 1;
    IF v_month > 12 THEN
      v_month := 1;
      v_year := v_year + 1;
    END IF;
    
    v_counter := v_counter + 1;
  END LOOP;
END $$;

-- Update status based on current time and windows
-- If now is within open_at and close_at, set to OPEN
UPDATE lotto_draws
SET status = 'OPEN'
WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT')
  AND is_active = true
  AND NOW() >= open_at
  AND NOW() < close_at
  AND status NOT IN ('CANCELLED', 'RESULTED');

-- If close_at has passed, set to CLOSED
UPDATE lotto_draws
SET status = 'CLOSED'
WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT')
  AND is_active = true
  AND NOW() >= close_at
  AND status NOT IN ('CANCELLED', 'RESULTED', 'CLOSED');

-- Verify results
SELECT 
  code,
  draw_date,
  TO_CHAR(open_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI') as open_bkk,
  TO_CHAR(close_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI') as close_bkk,
  status,
  CASE 
    WHEN NOW() >= open_at AND NOW() < close_at THEN '✓ ACCEPTING BETS'
    WHEN NOW() < open_at THEN '⏳ FUTURE'
    ELSE '✗ CLOSED'
  END as window_status,
  NOW() AT TIME ZONE 'Asia/Bangkok' as current_time
FROM lotto_draws
WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT')
  AND draw_date >= CURRENT_DATE
ORDER BY draw_date
LIMIT 5;
