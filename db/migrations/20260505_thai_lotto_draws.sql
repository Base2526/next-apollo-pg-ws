-- Migration: Thai Government Lottery Draw Generation
-- Date: 2026-05-05
-- Features: Generate Thai lottery draws (typically 1st and 16th of each month)

-- ============================================
-- FUNCTION: Generate Thai Government Lottery draws
-- ============================================

CREATE OR REPLACE FUNCTION generate_thai_lottery_draws(
  p_start_date DATE,
  p_end_date DATE,
  p_auto_dates BOOLEAN DEFAULT true -- Auto-generate for 1st and 16th
) RETURNS TABLE(
  generated_count INT,
  skipped_count INT,
  created_draws JSONB,
  skipped_draws JSONB,
  message TEXT
) AS $$
DECLARE
  v_category_id INT;
  v_current_date DATE;
  v_year INT;
  v_month INT;
  v_code TEXT;
  v_name_th TEXT;
  v_open_at TIMESTAMPTZ;
  v_close_at TIMESTAMPTZ;
  v_draw_period TEXT;
  v_generated INT := 0;
  v_skipped INT := 0;
  v_created_list JSONB := '[]'::JSONB;
  v_skipped_list JSONB := '[]'::JSONB;
  v_draw_info JSONB;
  v_exists BOOLEAN;
BEGIN
  -- Get THAI_GOVERNMENT category ID
  SELECT id INTO v_category_id 
  FROM lotto_categories 
  WHERE code = 'THAI_GOVERNMENT' AND is_active = true;
  
  IF v_category_id IS NULL THEN
    RETURN QUERY SELECT 
      0, 
      0, 
      '[]'::JSONB, 
      '[]'::JSONB, 
      'ERROR: THAI_GOVERNMENT category not found or not active';
    RETURN;
  END IF;
  
  -- If auto_dates is true, generate for 1st and 16th only
  IF p_auto_dates THEN
    v_current_date := p_start_date;
    
    WHILE v_current_date <= p_end_date LOOP
      v_year := EXTRACT(YEAR FROM v_current_date);
      v_month := EXTRACT(MONTH FROM v_current_date);
      
      -- Generate for 1st of month
      IF v_current_date <= DATE(v_year || '-' || LPAD(v_month::TEXT, 2, '0') || '-01') 
         AND DATE(v_year || '-' || LPAD(v_month::TEXT, 2, '0') || '-01') <= p_end_date THEN
        
        v_current_date := DATE(v_year || '-' || LPAD(v_month::TEXT, 2, '0') || '-01');
        
        -- Check if draw already exists
        SELECT EXISTS(
          SELECT 1 FROM lotto_draws 
          WHERE category_id = v_category_id 
            AND draw_date = v_current_date
            AND is_active = true
        ) INTO v_exists;
        
        IF NOT v_exists THEN
          -- Generate code: TH-YYYYMMDD
          v_code := 'TH-' || TO_CHAR(v_current_date, 'YYYYMMDD');
          
          -- Generate Thai name: "งวดวันที่ 1/MM/YYYY" (Buddhist year)
          v_name_th := 'งวดวันที่ ' || 
                       TO_CHAR(v_current_date, 'DD/MM/') || 
                       (EXTRACT(YEAR FROM v_current_date) + 543)::TEXT;
          
          -- Draw period identifier
          v_draw_period := TO_CHAR(v_current_date, 'YYYY-MM') || '-01';
          
          -- Open time: 00:00 of draw date
          v_open_at := v_current_date::TIMESTAMPTZ;
          
          -- Close time: 15:30 on draw date (typical Thai lottery closing)
          v_close_at := (v_current_date + TIME '15:30:00')::TIMESTAMPTZ;
          
          -- Insert draw
          INSERT INTO lotto_draws (
            category_id,
            code,
            draw_date,
            round_no,
            name_th,
            open_at,
            close_at,
            status,
            is_active,
            result_status,
            created_at,
            updated_at
          ) VALUES (
            v_category_id,
            v_code,
            v_current_date,
            1, -- Round 1 for 1st of month
            v_name_th,
            v_open_at,
            v_close_at,
            'PENDING',
            true,
            'pending',
            NOW(),
            NOW()
          );
          
          v_generated := v_generated + 1;
          v_draw_info := jsonb_build_object(
            'date', v_current_date,
            'code', v_code,
            'name_th', v_name_th
          );
          v_created_list := v_created_list || v_draw_info;
        ELSE
          v_skipped := v_skipped + 1;
          v_draw_info := jsonb_build_object(
            'date', v_current_date,
            'reason', 'Already exists'
          );
          v_skipped_list := v_skipped_list || v_draw_info;
        END IF;
      END IF;
      
      -- Generate for 16th of month
      IF v_current_date <= DATE(v_year || '-' || LPAD(v_month::TEXT, 2, '0') || '-16')
         AND DATE(v_year || '-' || LPAD(v_month::TEXT, 2, '0') || '-16') <= p_end_date THEN
        
        v_current_date := DATE(v_year || '-' || LPAD(v_month::TEXT, 2, '0') || '-16');
        
        -- Check if draw already exists
        SELECT EXISTS(
          SELECT 1 FROM lotto_draws 
          WHERE category_id = v_category_id 
            AND draw_date = v_current_date
            AND is_active = true
        ) INTO v_exists;
        
        IF NOT v_exists THEN
          -- Generate code: TH-YYYYMMDD
          v_code := 'TH-' || TO_CHAR(v_current_date, 'YYYYMMDD');
          
          -- Generate Thai name
          v_name_th := 'งวดวันที่ ' || 
                       TO_CHAR(v_current_date, 'DD/MM/') || 
                       (EXTRACT(YEAR FROM v_current_date) + 543)::TEXT;
          
          -- Draw period identifier
          v_draw_period := TO_CHAR(v_current_date, 'YYYY-MM') || '-16';
          
          -- Open time: 00:00 of draw date
          v_open_at := v_current_date::TIMESTAMPTZ;
          
          -- Close time: 15:30 on draw date
          v_close_at := (v_current_date + TIME '15:30:00')::TIMESTAMPTZ;
          
          -- Insert draw
          INSERT INTO lotto_draws (
            category_id,
            code,
            draw_date,
            round_no,
            name_th,
            open_at,
            close_at,
            status,
            is_active,
            result_status,
            created_at,
            updated_at
          ) VALUES (
            v_category_id,
            v_code,
            v_current_date,
            2, -- Round 2 for 16th of month
            v_name_th,
            v_open_at,
            v_close_at,
            'PENDING',
            true,
            'pending',
            NOW(),
            NOW()
          );
          
          v_generated := v_generated + 1;
          v_draw_info := jsonb_build_object(
            'date', v_current_date,
            'code', v_code,
            'name_th', v_name_th
          );
          v_created_list := v_created_list || v_draw_info;
        ELSE
          v_skipped := v_skipped + 1;
          v_draw_info := jsonb_build_object(
            'date', v_current_date,
            'reason', 'Already exists'
          );
          v_skipped_list := v_skipped_list || v_draw_info;
        END IF;
      END IF;
      
      -- Move to next month
      v_current_date := DATE(v_year || '-' || LPAD(v_month::TEXT, 2, '0') || '-01') + INTERVAL '1 month';
    END LOOP;
    
  ELSE
    -- Manual mode: generate for specific dates in range
    v_current_date := p_start_date;
    
    WHILE v_current_date <= p_end_date LOOP
      -- Check if draw already exists
      SELECT EXISTS(
        SELECT 1 FROM lotto_draws 
        WHERE category_id = v_category_id 
          AND draw_date = v_current_date
          AND is_active = true
      ) INTO v_exists;
      
      IF NOT v_exists THEN
        -- Generate code: TH-YYYYMMDD
        v_code := 'TH-' || TO_CHAR(v_current_date, 'YYYYMMDD');
        
        -- Generate Thai name
        v_name_th := 'งวดวันที่ ' || 
                     TO_CHAR(v_current_date, 'DD/MM/') || 
                     (EXTRACT(YEAR FROM v_current_date) + 543)::TEXT;
        
        -- Open time: 00:00 of draw date
        v_open_at := v_current_date::TIMESTAMPTZ;
        
        -- Close time: 15:30 on draw date
        v_close_at := (v_current_date + TIME '15:30:00')::TIMESTAMPTZ;
        
        -- Insert draw
        INSERT INTO lotto_draws (
          category_id,
          code,
          draw_date,
          round_no,
          name_th,
          open_at,
          close_at,
          status,
          is_active,
          result_status,
          created_at,
          updated_at
        ) VALUES (
          v_category_id,
          v_code,
          v_current_date,
          1, -- Default to round 1
          v_name_th,
          v_open_at,
          v_close_at,
          'PENDING',
          true,
          'pending',
          NOW(),
          NOW()
        );
        
        v_generated := v_generated + 1;
        v_draw_info := jsonb_build_object(
          'date', v_current_date,
          'code', v_code,
          'name_th', v_name_th
        );
        v_created_list := v_created_list || v_draw_info;
      ELSE
        v_skipped := v_skipped + 1;
        v_draw_info := jsonb_build_object(
          'date', v_current_date,
          'reason', 'Already exists'
        );
        v_skipped_list := v_skipped_list || v_draw_info;
      END IF;
      
      v_current_date := v_current_date + INTERVAL '1 day';
    END LOOP;
  END IF;
  
  RETURN QUERY SELECT 
    v_generated,
    v_skipped,
    v_created_list,
    v_skipped_list,
    format('Generated %s draws, skipped %s existing draws', v_generated, v_skipped);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_thai_lottery_draws IS 'Generate Thai Government Lottery draws. Auto mode creates for 1st and 16th of each month. Manual mode creates for all dates in range.';

-- ============================================
-- FUNCTION: Calculate Thai lottery winners
-- ============================================
-- Note: This extends the existing calculate_draw_winners function
-- to handle Thai lottery bet types

CREATE OR REPLACE FUNCTION calculate_draw_winners(
  p_draw_id INT
) RETURNS TABLE(
  updated_orders INT,
  updated_items INT,
  total_payout NUMERIC,
  message TEXT
) AS $$
DECLARE
  v_result_number TEXT;
  v_category_code TEXT;
  v_order_count INT := 0;
  v_item_count INT := 0;
  v_payout NUMERIC := 0;
  v_item RECORD;
  v_is_winner BOOLEAN;
  v_win_amt NUMERIC;
BEGIN
  -- Get draw info
  SELECT d.result_number, lc.code 
  INTO v_result_number, v_category_code
  FROM lotto_draws d
  JOIN lotto_categories lc ON d.category_id = lc.id
  WHERE d.id = p_draw_id;
  
  IF v_result_number IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0::NUMERIC, 'ERROR: Draw has no result number';
    RETURN;
  END IF;
  
  -- Loop through all order items for this draw
  FOR v_item IN 
    SELECT oi.id, oi.order_id, oi.bet_type_code, oi.number, oi.price, oi.payout_rate
    FROM lotto_order_items oi
    JOIN lotto_orders o ON o.id = oi.order_id
    WHERE o.draw_id = p_draw_id
  LOOP
    v_is_winner := false;
    v_win_amt := 0;
    
    -- Check if winner based on bet type
    -- YEEKEE_VIP bet types
    IF v_item.bet_type_code = 'YEEKEE_3_TOP' THEN
      -- 3 ตัวบน: exact match
      v_is_winner := v_item.number = v_result_number;
    ELSIF v_item.bet_type_code = 'YEEKEE_2_TOP' THEN
      -- 2 ตัวบน: last 2 digits
      v_is_winner := RIGHT(v_item.number, 2) = RIGHT(v_result_number, 2);
    ELSIF v_item.bet_type_code = 'YEEKEE_2_BOT' THEN
      -- 2 ตัวล่าง: first 2 digits  
      v_is_winner := LEFT(v_item.number, 2) = LEFT(v_result_number, 2);
    ELSIF v_item.bet_type_code = 'YEEKEE_RUN_TOP' THEN
      -- วิ่งบน: last digit
      v_is_winner := RIGHT(v_item.number, 1) = RIGHT(v_result_number, 1);
    ELSIF v_item.bet_type_code = 'YEEKEE_RUN_BOT' THEN
      -- วิ่งล่าง: first digit
      v_is_winner := LEFT(v_item.number, 1) = LEFT(v_result_number, 1);
    
    -- THAI_GOVERNMENT bet types (assuming result_number contains full 6-digit number)
    ELSIF v_item.bet_type_code = 'THAI_3_TOP' THEN
      -- 3 ตัวบน: last 3 digits of 6-digit result
      v_is_winner := RIGHT(v_item.number, 3) = RIGHT(v_result_number, 3);
    ELSIF v_item.bet_type_code = 'THAI_3_BOT' THEN
      -- 3 ตัวล่าง/เลขท้าย 3 ตัว: first 3 digits
      v_is_winner := LEFT(v_item.number, 3) = LEFT(v_result_number, 3);
    ELSIF v_item.bet_type_code = 'THAI_2_TOP' THEN
      -- 2 ตัวบน: last 2 digits
      v_is_winner := RIGHT(v_item.number, 2) = RIGHT(v_result_number, 2);
    ELSIF v_item.bet_type_code = 'THAI_2_BOT' THEN
      -- 2 ตัวล่าง: first 2 digits
      v_is_winner := LEFT(v_item.number, 2) = LEFT(v_result_number, 2);
    ELSIF v_item.bet_type_code = 'THAI_RUN_TOP' THEN
      -- วิ่งบน: last digit
      v_is_winner := RIGHT(v_item.number, 1) = RIGHT(v_result_number, 1);
    ELSIF v_item.bet_type_code = 'THAI_RUN_BOT' THEN
      -- วิ่งล่าง: first digit
      v_is_winner := LEFT(v_item.number, 1) = LEFT(v_result_number, 1);
    END IF;
    
    -- Calculate win amount
    IF v_is_winner THEN
      v_win_amt := v_item.price * v_item.payout_rate;
      v_payout := v_payout + v_win_amt;
    END IF;
    
    -- Update item
    UPDATE lotto_order_items 
    SET 
      is_winner = v_is_winner,
      win_amount = v_win_amt,
      result_status = CASE WHEN v_is_winner THEN 'won' ELSE 'lost' END,
      updated_at = NOW()
    WHERE id = v_item.id;
    
    v_item_count := v_item_count + 1;
  END LOOP;
  
  -- Update orders: sum up wins per order
  FOR v_item IN
    SELECT DISTINCT o.id as order_id
    FROM lotto_orders o
    WHERE o.draw_id = p_draw_id
  LOOP
    UPDATE lotto_orders o
    SET 
      total_win = (
        SELECT COALESCE(SUM(win_amount), 0)
        FROM lotto_order_items
        WHERE order_id = v_item.order_id
      ),
      result_status = CASE 
        WHEN EXISTS(SELECT 1 FROM lotto_order_items WHERE order_id = v_item.order_id AND is_winner = true) 
        THEN 'won' 
        ELSE 'lost' 
      END,
      updated_at = NOW()
    WHERE o.id = v_item.order_id;
    
    v_order_count := v_order_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT 
    v_order_count, 
    v_item_count, 
    v_payout, 
    format('Updated %s orders, %s items, total payout: %s', v_order_count, v_item_count, v_payout);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_draw_winners IS 'Calculate winners for both YEEKEE_VIP and THAI_GOVERNMENT draws';
