-- Migration: Lotto System Enhancements
-- Date: 2026-05-04
-- Features: Draw Generator, Result Management, Winner Calculation, Reports

-- ============================================
-- 1. LOTTO_DRAWS: Add result_number field
-- ============================================
ALTER TABLE lotto_draws 
  ADD COLUMN IF NOT EXISTS result_number VARCHAR(10);

COMMENT ON COLUMN lotto_draws.result_number IS 'Winning number for this draw (e.g., "123", "45")';

-- ============================================
-- 2. LOTTO_ORDERS: Ensure all result fields exist
-- ============================================
ALTER TABLE lotto_orders
  ADD COLUMN IF NOT EXISTS total_win NUMERIC DEFAULT 0;

COMMENT ON COLUMN lotto_orders.total_win IS 'Total winnings for this order';

-- ============================================
-- 3. LOTTO_ORDER_ITEMS: Add is_winner field
-- ============================================
ALTER TABLE lotto_order_items
  ADD COLUMN IF NOT EXISTS is_winner BOOLEAN DEFAULT false;

COMMENT ON COLUMN lotto_order_items.is_winner IS 'Whether this bet won';

-- ============================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================

-- Draw lookups by date + category
CREATE INDEX IF NOT EXISTS idx_lotto_draws_date_category 
  ON lotto_draws(draw_date, category_id);

-- Draw lookups for active rounds
CREATE INDEX IF NOT EXISTS idx_lotto_draws_active_open 
  ON lotto_draws(category_id, draw_date, round_no) 
  WHERE is_active = true;

-- Order lookups by draw
CREATE INDEX IF NOT EXISTS idx_lotto_orders_draw 
  ON lotto_orders(draw_id);

-- Order lookups by user + date
CREATE INDEX IF NOT EXISTS idx_lotto_orders_user_created 
  ON lotto_orders(user_id, created_at DESC);

-- Item lookups by order
CREATE INDEX IF NOT EXISTS idx_lotto_order_items_order 
  ON lotto_order_items(order_id);

-- Winner queries
CREATE INDEX IF NOT EXISTS idx_lotto_order_items_winner 
  ON lotto_order_items(order_id, is_winner) 
  WHERE is_winner = true;

-- Result status queries
CREATE INDEX IF NOT EXISTS idx_lotto_orders_result_draw 
  ON lotto_orders(draw_id, result_status);

-- ============================================
-- 5. UNIQUE CONSTRAINT FOR DRAW GENERATION
-- ============================================

-- Prevent duplicate draws for same date/category/round
CREATE UNIQUE INDEX IF NOT EXISTS idx_lotto_draws_unique_round
  ON lotto_draws(draw_date, category_id, round_no)
  WHERE is_active = true;

COMMENT ON INDEX idx_lotto_draws_unique_round IS 'Ensures no duplicate draws for same date/category/round';

-- ============================================
-- 6. CREATE SUMMARY VIEW (OPTIONAL - for reporting)
-- ============================================

CREATE OR REPLACE VIEW v_draw_summary AS
SELECT 
  d.id as draw_id,
  d.code as draw_code,
  d.draw_date,
  d.round_no,
  d.result_number,
  d.result_status as draw_result_status,
  lc.code as category_code,
  lc.name_th as category_name,
  COUNT(DISTINCT o.id) as total_orders,
  COUNT(oi.id) as total_items,
  COALESCE(SUM(oi.price), 0) as total_sales,
  COUNT(CASE WHEN oi.is_winner = true THEN 1 END) as total_winners,
  COALESCE(SUM(CASE WHEN oi.is_winner = true THEN oi.win_amount ELSE 0 END), 0) as total_payout,
  COALESCE(SUM(oi.price), 0) - COALESCE(SUM(CASE WHEN oi.is_winner = true THEN oi.win_amount ELSE 0 END), 0) as profit
FROM lotto_draws d
LEFT JOIN lotto_categories lc ON d.category_id = lc.id
LEFT JOIN lotto_orders o ON o.draw_id = d.id
LEFT JOIN lotto_order_items oi ON oi.order_id = o.id
GROUP BY d.id, d.code, d.draw_date, d.round_no, d.result_number, d.result_status, lc.code, lc.name_th;

COMMENT ON VIEW v_draw_summary IS 'Summary view for draw reporting: sales, winners, payout, profit';

-- ============================================
-- 7. FUNCTION: Generate YEEKEE_VIP draws
-- ============================================

CREATE OR REPLACE FUNCTION generate_yeekee_vip_draws(
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE(
  generated_count INT,
  message TEXT
) AS $$
DECLARE
  v_category_id INT;
  v_current_date DATE;
  v_round_no INT;
  v_open_at TIMESTAMPTZ;
  v_close_at TIMESTAMPTZ;
  v_code TEXT;
  v_name_th TEXT;
  v_count INT := 0;
  v_base_time TIME := '03:45:00';
BEGIN
  -- Get YEEKEE_VIP category ID
  SELECT id INTO v_category_id 
  FROM lotto_categories 
  WHERE code = 'YEEKEE_VIP' AND is_active = true;
  
  IF v_category_id IS NULL THEN
    RETURN QUERY SELECT 0, 'ERROR: YEEKEE_VIP category not found or not active';
    RETURN;
  END IF;
  
  -- Loop through each date
  v_current_date := p_start_date;
  WHILE v_current_date <= p_end_date LOOP
    
    -- Generate 88 rounds per day
    FOR v_round_no IN 1..88 LOOP
      -- Calculate times
      v_open_at := v_current_date + v_base_time + ((v_round_no - 1) * INTERVAL '15 minutes');
      v_close_at := v_open_at + INTERVAL '15 minutes';
      
      -- Generate code: YK-YYYYMMDD-XX
      v_code := 'YK-' || TO_CHAR(v_current_date, 'YYYYMMDD') || '-' || LPAD(v_round_no::TEXT, 2, '0');
      
      -- Generate Thai name
      v_name_th := 'รอบที่ ' || LPAD(v_round_no::TEXT, 2, '0');
      
      -- Insert draw (skip if exists)
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
        v_round_no,
        v_name_th,
        v_open_at,
        v_close_at,
        'PENDING',
        true,
        'pending',
        NOW(),
        NOW()
      )
      ON CONFLICT DO NOTHING;
      
      v_count := v_count + 1;
    END LOOP;
    
    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;
  
  RETURN QUERY SELECT v_count, format('Successfully generated %s draws', v_count);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_yeekee_vip_draws IS 'Generate YEEKEE_VIP draws for date range (88 rounds per day)';

-- ============================================
-- 8. FUNCTION: Calculate winners for a draw
-- ============================================

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

COMMENT ON FUNCTION calculate_draw_winners IS 'Calculate winners for a specific draw based on result_number';

-- ============================================
-- 9. LOGGING
-- ============================================

-- RAISE NOTICE '[MIGRATION] Lotto system enhancements applied successfully';
-- RAISE NOTICE '[MIGRATION] - Added result_number to lotto_draws';
-- RAISE NOTICE '[MIGRATION] - Added indexes for performance';
-- RAISE NOTICE '[MIGRATION] - Created v_draw_summary view';
-- RAISE NOTICE '[MIGRATION] - Created generate_yeekee_vip_draws function';
-- RAISE NOTICE '[MIGRATION] - Created calculate_draw_winners function';

DO $$
BEGIN
  RAISE NOTICE '[MIGRATION] Lotto system enhancements applied successfully';
  RAISE NOTICE '[MIGRATION] - Added result_number to lotto_draws';
  RAISE NOTICE '[MIGRATION] - Added indexes for performance';
  RAISE NOTICE '[MIGRATION] - Created v_draw_summary view';
  RAISE NOTICE '[MIGRATION] - Created generate_yeekee_vip_draws function';
  RAISE NOTICE '[MIGRATION] - Created calculate_draw_winners function';
END;
$$;
