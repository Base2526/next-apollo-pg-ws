-- Create fixed function for generating Thai Government draws
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
BEGIN
  SELECT id INTO v_category_id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT';
  
  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'THAI_GOVERNMENT category not found';
  END IF;
  
  v_first_date := make_date(p_year, p_month, 1);
  v_second_date := make_date(p_year, p_month, 16);
  v_first_code := 'TH-' || p_year::text || '-' || lpad(p_month::text, 2, '0') || '-01';
  v_second_code := 'TH-' || p_year::text || '-' || lpad(p_month::text, 2, '0') || '-16';
  
  -- First half draw
  INSERT INTO lotto_draws (
    category_id, code, draw_date, draw_period, name_th, 
    open_at, close_at, status, is_active
  ) VALUES (
    v_category_id, v_first_code, v_first_date, 'FIRST_HALF',
    'งวดวันที่ ' || to_char(v_first_date, 'DD/MM/') || (EXTRACT(YEAR FROM v_first_date)::int + 543)::text,
    v_first_date - INTERVAL '7 days', v_first_date - INTERVAL '2 hours',
    'DRAFT', true
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
    v_second_date - INTERVAL '7 days', v_second_date - INTERVAL '2 hours',
    'DRAFT', true
  ) ON CONFLICT (code) DO UPDATE SET
    draw_date = CASE WHEN lotto_draws.is_date_overridden = false THEN EXCLUDED.draw_date ELSE lotto_draws.draw_date END,
    name_th = CASE WHEN lotto_draws.is_date_overridden = false THEN EXCLUDED.name_th ELSE lotto_draws.name_th END,
    open_at = CASE WHEN lotto_draws.is_date_overridden = false THEN EXCLUDED.open_at ELSE lotto_draws.open_at END,
    close_at = CASE WHEN lotto_draws.is_date_overridden = false THEN EXCLUDED.close_at ELSE lotto_draws.close_at END;
  
  RAISE NOTICE 'Generated draws for % - %', p_year, p_month;
END;
$$ LANGUAGE plpgsql;

-- Generate draws for next 12 months
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

-- Set draws to OPEN for next 3 months
UPDATE lotto_draws
SET status = 'OPEN',
    open_at = CURRENT_TIMESTAMP - INTERVAL '1 day'
WHERE status = 'DRAFT'
  AND draw_date >= CURRENT_DATE
  AND draw_date <= CURRENT_DATE + INTERVAL '3 months'
  AND category_id = (SELECT id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT');
