-- Migration: Update calculation functions to check order status
-- Date: 2026-05-07
-- Purpose: Ensure only approved orders are included in winner calculations

-- ========================================
-- UPDATE CALCULATION FUNCTIONS
-- ========================================

/*
IMPORTANT: This script updates the winner calculation functions to:
1. Only count orders with status='approved'
2. Exclude orders with status='pending_confirm', 'refunded', or 'rejected'
3. Ensure refunded orders don't affect prize calculations

You need to locate and update the following stored procedures in your database:
- calculate_draw_winners()
- recalculate_draw_winners()
- save_thai_government_result()
- Any other functions that query lotto_orders for calculations

Add this WHERE clause to all queries that calculate winners:
WHERE o.status = 'approved'

Example:
*/

-- OLD QUERY (INCORRECT):
-- SELECT o.id, o.total_amount, oi.number, oi.bet_type_code, oi.price
-- FROM lotto_orders o
-- INNER JOIN lotto_order_items oi ON oi.order_id = o.id
-- WHERE o.draw_id = $1

-- NEW QUERY (CORRECT):
-- SELECT o.id, o.total_amount, oi.number, oi.bet_type_code, oi.price
-- FROM lotto_orders o
-- INNER JOIN lotto_order_items oi ON oi.order_id = o.id
-- WHERE o.draw_id = $1
--   AND o.status = 'approved'  -- <-- ADD THIS LINE

-- ========================================
-- EXAMPLE: Update calculate_draw_winners function
-- ========================================

-- If your calculate_draw_winners function looks like this, update it:

/*
CREATE OR REPLACE FUNCTION calculate_draw_winners(p_draw_id INT)
RETURNS TABLE (
  updated_orders INT,
  updated_items INT,
  total_payout NUMERIC,
  message TEXT
) AS $$
DECLARE
  v_result_number TEXT;
  v_updated_orders INT := 0;
  v_updated_items INT := 0;
  v_total_payout NUMERIC := 0;
BEGIN
  -- Get result number
  SELECT result_number INTO v_result_number
  FROM lotto_draws
  WHERE id = p_draw_id;

  IF v_result_number IS NULL THEN
    RAISE EXCEPTION 'Draw % has no result number', p_draw_id;
  END IF;

  -- Calculate winners
  -- ADD STATUS CHECK HERE
  UPDATE lotto_order_items oi
  SET 
    is_winner = (
      CASE 
        WHEN bt.code = '3_TOP' AND oi.number = RIGHT(v_result_number, 3) THEN TRUE
        WHEN bt.code = '3_TOED' AND oi.number = LEFT(v_result_number, 3) THEN TRUE
        WHEN bt.code = '2_BOTTOM' AND oi.number = RIGHT(v_result_number, 2) THEN TRUE
        ELSE FALSE
      END
    ),
    win_amount = (
      CASE 
        WHEN bt.code = '3_TOP' AND oi.number = RIGHT(v_result_number, 3) THEN oi.price * oi.payout_rate
        WHEN bt.code = '3_TOED' AND oi.number = LEFT(v_result_number, 3) THEN oi.price * oi.payout_rate
        WHEN bt.code = '2_BOTTOM' AND oi.number = RIGHT(v_result_number, 2) THEN oi.price * oi.payout_rate
        ELSE 0
      END
    )
  FROM lotto_orders o
  INNER JOIN lotto_bet_types bt ON bt.code = oi.bet_type_code
  WHERE oi.order_id = o.id
    AND o.draw_id = p_draw_id
    AND o.status = 'approved';  -- <-- ADD THIS LINE

  GET DIAGNOSTICS v_updated_items = ROW_COUNT;

  -- Update orders
  UPDATE lotto_orders o
  SET 
    total_win = (
      SELECT COALESCE(SUM(oi2.win_amount), 0)
      FROM lotto_order_items oi2
      WHERE oi2.order_id = o.id
    ),
    result_status = (
      CASE 
        WHEN (SELECT COALESCE(SUM(oi2.win_amount), 0) FROM lotto_order_items oi2 WHERE oi2.order_id = o.id) > 0 
        THEN 'won'
        ELSE 'lost'
      END
    ),
    checked_at = NOW(),
    updated_at = NOW()
  WHERE o.draw_id = p_draw_id
    AND o.status = 'approved';  -- <-- ADD THIS LINE

  GET DIAGNOSTICS v_updated_orders = ROW_COUNT;

  -- Calculate total payout
  SELECT COALESCE(SUM(oi.win_amount), 0) INTO v_total_payout
  FROM lotto_order_items oi
  INNER JOIN lotto_orders o ON o.id = oi.order_id
  WHERE o.draw_id = p_draw_id
    AND o.status = 'approved'  -- <-- ADD THIS LINE
    AND oi.is_winner = TRUE;

  RETURN QUERY SELECT 
    v_updated_orders,
    v_updated_items,
    v_total_payout,
    'Winners calculated successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;
*/

-- ========================================
-- VERIFICATION QUERY
-- ========================================

-- After updating functions, run this to verify:
/*
SELECT 
  d.id as draw_id,
  d.code as draw_code,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'approved') as approved_orders,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'pending_confirm') as pending_orders,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'refunded') as refunded_orders,
  COALESCE(SUM(oi.price) FILTER (WHERE o.status = 'approved'), 0) as approved_sales,
  COALESCE(SUM(oi.win_amount) FILTER (WHERE o.status = 'approved' AND oi.is_winner = TRUE), 0) as approved_payout
FROM lotto_draws d
LEFT JOIN lotto_orders o ON o.draw_id = d.id
LEFT JOIN lotto_order_items oi ON oi.order_id = o.id
WHERE d.result_status = 'resulted'
GROUP BY d.id, d.code
ORDER BY d.id DESC
LIMIT 10;
*/

-- ========================================
-- NOTES
-- ========================================

/*
This ensures:
1. Only approved orders are counted in calculations
2. Refunded orders don't affect prize money
3. Pending orders waiting for approval don't get calculated
4. System integrity is maintained

Remember to:
- Backup your database before making changes
- Test on staging environment first
- Run verification queries after update
- Document any custom calculation logic you have
*/
