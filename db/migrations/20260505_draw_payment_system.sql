-- Migration: Lotto Draw Winner Payment System
-- Date: 2026-05-05
-- Features: Pay winners, track payment status, prevent double payment

-- ============================================
-- 1. Add payment tracking to draws
-- ============================================

ALTER TABLE lotto_draws 
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS paid_by UUID NULL REFERENCES lotto_users(id);

ALTER TABLE lotto_orders
  ADD COLUMN IF NOT EXISTS is_win_paid BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_win NUMERIC DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_lotto_draws_unpaid 
  ON lotto_draws(result_status, is_paid) 
  WHERE result_status = 'resulted' AND is_paid = false;

COMMENT ON COLUMN lotto_draws.is_paid IS 'Whether winners have been paid';
COMMENT ON COLUMN lotto_draws.paid_at IS 'Timestamp when payment was processed';
COMMENT ON COLUMN lotto_draws.paid_by IS 'Admin user who processed payment';

-- ============================================
-- 2. FUNCTION: Pay winners for a specific draw
-- ============================================

CREATE OR REPLACE FUNCTION pay_draw_winners(
  p_draw_id INT,
  p_admin_user_id UUID DEFAULT NULL
) RETURNS TABLE(
  paid_orders INT,
  paid_amount NUMERIC,
  transactions_created INT,
  message TEXT
) AS $$
DECLARE
  v_order RECORD;
  v_paid_count INT := 0;
  v_total_paid NUMERIC := 0;
  v_tx_count INT := 0;
  v_draw_status TEXT;
  v_draw_is_paid BOOLEAN;
  v_user_balance_before NUMERIC;
  v_user_balance_after NUMERIC;
  v_tx_id UUID;
BEGIN
  SELECT d.result_status, COALESCE(d.is_paid, false)
  INTO v_draw_status, v_draw_is_paid
  FROM lotto_draws d
  WHERE d.id = p_draw_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draw ID % not found', p_draw_id;
  END IF;
  
  IF v_draw_status != 'resulted' THEN
    RAISE EXCEPTION 'Draw must have status "resulted" before paying winners (current: %)', v_draw_status;
  END IF;
  
  IF v_draw_is_paid = true THEN
    RAISE EXCEPTION 'Draw ID % has already been paid. Cannot pay twice.', p_draw_id;
  END IF;
  
  FOR v_order IN 
    SELECT 
      o.id as order_id,
      o.user_id,
      o.total_win,
      u.credit as current_credit
    FROM lotto_orders o
    JOIN lotto_users u ON u.id = o.user_id
    WHERE o.draw_id = p_draw_id
      AND o.result_status = 'won'
      AND COALESCE(o.total_win, 0) > 0
      AND COALESCE(o.is_win_paid, false) = false
    FOR UPDATE OF o
  LOOP
    SELECT credit INTO v_user_balance_before
    FROM lotto_users
    WHERE id = v_order.user_id
    FOR UPDATE;
    
    v_user_balance_after := COALESCE(v_user_balance_before, 0) + COALESCE(v_order.total_win, 0);
    
    UPDATE lotto_users
    SET credit = v_user_balance_after,
        updated_at = NOW()
    WHERE id = v_order.user_id;
    
    INSERT INTO lotto_credit_transactions (
      user_id,
      type,
      amount,
      direction,
      balance_before,
      balance_after,
      ref_type,
      ref_id,
      status,
      note,
      created_by,
      created_at
    ) VALUES (
      v_order.user_id,
      'WIN_PAYOUT',
      v_order.total_win,
      'IN',
      v_user_balance_before,
      v_user_balance_after,
      'ORDER',
      v_order.order_id::TEXT,
      'COMPLETED',
      format('Winning payout for draw ID %s', p_draw_id),
      p_admin_user_id,
      NOW()
    ) RETURNING id INTO v_tx_id;
    
    UPDATE lotto_orders
    SET is_win_paid = true,
        updated_at = NOW()
    WHERE id = v_order.order_id;
    
    v_paid_count := v_paid_count + 1;
    v_total_paid := v_total_paid + COALESCE(v_order.total_win, 0);
    v_tx_count := v_tx_count + 1;
  END LOOP;
  
  UPDATE lotto_draws
  SET is_paid = true,
      paid_at = NOW(),
      paid_by = p_admin_user_id,
      status = 'PAID',
      updated_at = NOW()
  WHERE id = p_draw_id;
  
  RETURN QUERY SELECT 
    v_paid_count,
    v_total_paid,
    v_tx_count,
    format('Paid %s orders, total amount: %s, transactions: %s', 
      v_paid_count, v_total_paid, v_tx_count);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. FUNCTION: Get draw detail with summary
-- ============================================

CREATE OR REPLACE FUNCTION get_draw_detail(
  p_draw_id INT
) RETURNS TABLE(
  draw_id INT,
  draw_code TEXT,
  category_code TEXT,
  category_name TEXT,
  draw_date DATE,
  round_no INT,
  name_th TEXT,
  open_at TIMESTAMPTZ,
  close_at TIMESTAMPTZ,
  status TEXT,
  result_status TEXT,
  result_number TEXT,
  is_paid BOOLEAN,
  paid_at TIMESTAMPTZ,
  total_orders INT,
  total_bet_amount NUMERIC,
  total_winning_amount NUMERIC,
  total_winners INT,
  profit_loss NUMERIC,
  can_set_result BOOLEAN,
  can_calculate BOOLEAN,
  can_pay BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.code::TEXT,
    lc.code::TEXT,
    lc.name_th::TEXT,
    d.draw_date,
    d.round_no,
    d.name_th::TEXT,
    d.open_at,
    d.close_at,
    d.status::TEXT,
    d.result_status::TEXT,
    d.result_number::TEXT,
    COALESCE(d.is_paid, false),
    d.paid_at,
    COUNT(DISTINCT o.id)::INT,
    COALESCE(SUM(oi.price), 0),
    COALESCE(SUM(CASE WHEN oi.is_winner = true THEN oi.win_amount ELSE 0 END), 0),
    COUNT(CASE WHEN oi.is_winner = true THEN 1 END)::INT,
    COALESCE(SUM(oi.price), 0) - COALESCE(SUM(CASE WHEN oi.is_winner = true THEN oi.win_amount ELSE 0 END), 0),
    (d.result_status IS NULL OR d.result_status = 'pending'),
    (d.result_number IS NOT NULL AND (d.result_status IS NULL OR d.result_status IN ('pending', 'resulted'))),
    (d.result_status = 'resulted' AND COALESCE(d.is_paid, false) = false)
  FROM lotto_draws d
  LEFT JOIN lotto_categories lc ON d.category_id = lc.id
  LEFT JOIN lotto_orders o ON o.draw_id = d.id
  LEFT JOIN lotto_order_items oi ON oi.order_id = o.id
  WHERE d.id = p_draw_id
  GROUP BY d.id, d.code, lc.code, lc.name_th, d.draw_date, d.round_no, d.name_th,
           d.open_at, d.close_at, d.status, d.result_status, d.result_number,
           d.is_paid, d.paid_at;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. Add check constraint for payment status
-- ============================================

ALTER TABLE lotto_draws 
  DROP CONSTRAINT IF EXISTS chk_paid_requires_result;

ALTER TABLE lotto_draws 
  ADD CONSTRAINT chk_paid_requires_result 
  CHECK (is_paid = false OR (is_paid = true AND result_number IS NOT NULL));

-- ============================================
-- 5. Create view for unpaid winning orders
-- ============================================

DROP VIEW IF EXISTS v_unpaid_winning_orders;

CREATE OR REPLACE VIEW v_unpaid_winning_orders AS
SELECT 
  d.id as draw_id,
  d.code as draw_code,
  d.draw_date,
  lc.code as category_code,
  o.id as order_id,
  o.id::TEXT as order_code,
  o.user_id,
  u.phone as user_phone,
  u.name as user_name,
  o.total_win,
  o.created_at as order_created_at
FROM lotto_orders o
JOIN lotto_draws d ON d.id = o.draw_id
JOIN lotto_categories lc ON lc.id = d.category_id
JOIN lotto_users u ON u.id = o.user_id
WHERE o.result_status = 'won'
  AND COALESCE(o.total_win, 0) > 0
  AND COALESCE(o.is_win_paid, false) = false
ORDER BY d.draw_date DESC, o.created_at DESC;

-- ============================================
-- 6. Audit log for payments
-- ============================================

CREATE TABLE IF NOT EXISTS lotto_payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id INT NOT NULL REFERENCES lotto_draws(id),
  admin_user_id UUID NULL REFERENCES lotto_users(id),
  paid_orders INT NOT NULL,
  paid_amount NUMERIC(12,2) NOT NULL,
  transactions_created INT NOT NULL,
  status VARCHAR(30) DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED', 'PARTIAL')),
  error_message TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_logs_draw_id ON lotto_payment_logs(draw_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_created_at ON lotto_payment_logs(created_at DESC);

-- ============================================
-- 7. Trigger to log payments
-- ============================================

CREATE OR REPLACE FUNCTION log_draw_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_paid = true AND COALESCE(OLD.is_paid, false) = false THEN
    INSERT INTO lotto_payment_logs (
      draw_id,
      admin_user_id,
      paid_orders,
      paid_amount,
      transactions_created,
      status,
      created_at
    )
    SELECT 
      NEW.id,
      NEW.paid_by,
      COUNT(o.id)::INT,
      COALESCE(SUM(o.total_win), 0),
      COUNT(o.id)::INT,
      'SUCCESS',
      NOW()
    FROM lotto_orders o
    WHERE o.draw_id = NEW.id
      AND o.result_status = 'won'
      AND COALESCE(o.is_win_paid, false) = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_draw_payment ON lotto_draws;

CREATE TRIGGER trg_log_draw_payment
  AFTER UPDATE OF is_paid ON lotto_draws
  FOR EACH ROW
  EXECUTE FUNCTION log_draw_payment();