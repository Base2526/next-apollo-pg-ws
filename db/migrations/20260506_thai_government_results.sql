-- Migration: Thai Government Lottery Multi-Field Results
-- Fixed: users table does not exist -> use lotto_users
-- Date: 2026-05-06

-- ============================================
-- 1. Create lotto_draw_results table
-- ============================================

CREATE TABLE IF NOT EXISTS lotto_draw_results (
  id SERIAL PRIMARY KEY,
  draw_id INT NOT NULL REFERENCES lotto_draws(id) ON DELETE CASCADE,
  result_type VARCHAR(20) NOT NULL,
  result_number VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_draw_results_draw_id
  ON lotto_draw_results(draw_id);

CREATE INDEX IF NOT EXISTS idx_draw_results_type
  ON lotto_draw_results(draw_id, result_type);

-- ============================================
-- 2. Create audit log table
-- ============================================

CREATE TABLE IF NOT EXISTS lotto_result_audit_log (
  id SERIAL PRIMARY KEY,
  draw_id INT NOT NULL REFERENCES lotto_draws(id) ON DELETE CASCADE,
  admin_user_id UUID NULL REFERENCES lotto_users(id),
  action VARCHAR(50) NOT NULL,
  previous_result JSONB,
  new_result JSONB,
  was_calculated BOOLEAN DEFAULT FALSE,
  was_paid BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_result_audit_draw
  ON lotto_result_audit_log(draw_id);

CREATE INDEX IF NOT EXISTS idx_result_audit_admin
  ON lotto_result_audit_log(admin_user_id);

-- ============================================
-- 3. Add recalculation tracking columns
-- ============================================

ALTER TABLE lotto_draws
  ADD COLUMN IF NOT EXISTS last_calculated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_calculated_by UUID NULL REFERENCES lotto_users(id),
  ADD COLUMN IF NOT EXISTS calculation_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS result_modified_after_calc BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS total_orders INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_bet_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_winning_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_winners INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_loss NUMERIC DEFAULT 0;

-- ============================================
-- 4. Function: Save Thai Government Result
-- ============================================

CREATE OR REPLACE FUNCTION save_thai_government_result(
  p_draw_id INT,
  p_admin_user_id UUID,
  p_main_number VARCHAR(6),
  p_front_3 TEXT[],
  p_back_3 TEXT[],
  p_bottom_2 VARCHAR(2)
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  draw_id INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_draw_record RECORD;
  v_old_result JSONB;
  v_new_result JSONB;
  v_front_num TEXT;
  v_back_num TEXT;
BEGIN
  SELECT *
  INTO v_draw_record
  FROM lotto_draws
  WHERE id = p_draw_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Draw not found', p_draw_id;
    RETURN;
  END IF;

  IF COALESCE(v_draw_record.is_paid, false) = TRUE THEN
    RETURN QUERY SELECT FALSE, 'Cannot modify result: Already paid. Need adjustment transaction.', p_draw_id;
    RETURN;
  END IF;

  IF LENGTH(p_main_number) != 6 OR p_main_number !~ '^\d{6}$' THEN
    RETURN QUERY SELECT FALSE, 'Main number must be 6 digits', p_draw_id;
    RETURN;
  END IF;

  IF LENGTH(p_bottom_2) != 2 OR p_bottom_2 !~ '^\d{2}$' THEN
    RETURN QUERY SELECT FALSE, 'Bottom 2 must be 2 digits', p_draw_id;
    RETURN;
  END IF;

  FOREACH v_front_num IN ARRAY p_front_3 LOOP
    IF LENGTH(v_front_num) != 3 OR v_front_num !~ '^\d{3}$' THEN
      RETURN QUERY SELECT FALSE, 'Each front 3 number must be 3 digits', p_draw_id;
      RETURN;
    END IF;
  END LOOP;

  FOREACH v_back_num IN ARRAY p_back_3 LOOP
    IF LENGTH(v_back_num) != 3 OR v_back_num !~ '^\d{3}$' THEN
      RETURN QUERY SELECT FALSE, 'Each back 3 number must be 3 digits', p_draw_id;
      RETURN;
    END IF;
  END LOOP;

  SELECT jsonb_build_object(
    'result_number', v_draw_record.result_number,
    'result_status', v_draw_record.result_status,
    'details', (
      SELECT jsonb_agg(
        jsonb_build_object('type', ldr.result_type, 'number', ldr.result_number)
      )
      FROM lotto_draw_results ldr
      WHERE ldr.draw_id = p_draw_id
    )
  )
  INTO v_old_result;

  v_new_result := jsonb_build_object(
    'main_number', p_main_number,
    'front_3', p_front_3,
    'back_3', p_back_3,
    'bottom_2', p_bottom_2
  );

  DELETE FROM lotto_draw_results ldr
  WHERE ldr.draw_id = p_draw_id;

  INSERT INTO lotto_draw_results (draw_id, result_type, result_number)
  VALUES (p_draw_id, 'MAIN_6', p_main_number);

  FOREACH v_front_num IN ARRAY p_front_3 LOOP
    INSERT INTO lotto_draw_results (draw_id, result_type, result_number)
    VALUES (p_draw_id, 'FRONT_3', v_front_num);
  END LOOP;

  FOREACH v_back_num IN ARRAY p_back_3 LOOP
    INSERT INTO lotto_draw_results (draw_id, result_type, result_number)
    VALUES (p_draw_id, 'BACK_3', v_back_num);
  END LOOP;

  INSERT INTO lotto_draw_results (draw_id, result_type, result_number)
  VALUES (p_draw_id, 'BOTTOM_2', p_bottom_2);

  UPDATE lotto_draws
  SET
    result_number = p_main_number,
    result_status = 'resulted',
    status = 'RESULTED',
    result_modified_after_calc = CASE
      WHEN last_calculated_at IS NOT NULL THEN TRUE
      ELSE FALSE
    END,
    updated_at = NOW()
  WHERE id = p_draw_id;

  INSERT INTO lotto_result_audit_log (
    draw_id,
    admin_user_id,
    action,
    previous_result,
    new_result,
    was_calculated,
    was_paid,
    notes
  )
  VALUES (
    p_draw_id,
    p_admin_user_id,
    'UPDATE_RESULT',
    v_old_result,
    v_new_result,
    v_draw_record.last_calculated_at IS NOT NULL,
    COALESCE(v_draw_record.is_paid, false),
    CASE
      WHEN v_draw_record.last_calculated_at IS NOT NULL
        THEN 'Result modified after calculation - needs recalculation'
      ELSE 'Initial result entry'
    END
  );

  RETURN QUERY SELECT TRUE, 'Result saved successfully', p_draw_id;
END;
$$;

-- ============================================
-- 5. Function: Recalculate Winners
-- ============================================

CREATE OR REPLACE FUNCTION recalculate_draw_winners(
  p_draw_id INT,
  p_admin_user_id UUID
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  updated_orders INT,
  updated_items INT,
  total_payout DECIMAL(12,2),
  warning TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_draw RECORD;
  v_category_code TEXT;
  v_order RECORD;
  v_item RECORD;
  v_is_winner BOOLEAN;
  v_win_amount DECIMAL(12,2);
  v_updated_orders INT := 0;
  v_updated_items INT := 0;
  v_total_payout DECIMAL(12,2) := 0;
  v_result_main TEXT;
  v_result_front3 TEXT[];
  v_result_back3 TEXT[];
  v_result_bottom2 TEXT;
  v_warning TEXT := '';
BEGIN
  SELECT d.*, lc.code AS category_code
  INTO v_draw
  FROM lotto_draws d
  LEFT JOIN lotto_categories lc ON lc.id = d.category_id
  WHERE d.id = p_draw_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Draw not found', 0, 0, 0::DECIMAL, '';
    RETURN;
  END IF;

  v_category_code := v_draw.category_code;

  IF COALESCE(v_draw.is_paid, false) = TRUE THEN
    v_warning := 'WARNING: Draw already paid. This recalculation will not auto-adjust credits. Manual adjustment may be required.';
  END IF;

  IF v_draw.result_number IS NULL OR v_draw.result_status != 'resulted' THEN
    RETURN QUERY SELECT FALSE, 'Cannot calculate: No result entered yet', 0, 0, 0::DECIMAL, '';
    RETURN;
  END IF;

  IF v_category_code = 'THAI_GOVERNMENT' THEN
    SELECT ldr.result_number INTO v_result_main
    FROM lotto_draw_results ldr
    WHERE ldr.draw_id = p_draw_id AND ldr.result_type = 'MAIN_6'
    LIMIT 1;

    SELECT ARRAY_AGG(ldr.result_number) INTO v_result_front3
    FROM lotto_draw_results ldr
    WHERE ldr.draw_id = p_draw_id AND ldr.result_type = 'FRONT_3';

    SELECT ARRAY_AGG(ldr.result_number) INTO v_result_back3
    FROM lotto_draw_results ldr
    WHERE ldr.draw_id = p_draw_id AND ldr.result_type = 'BACK_3';

    SELECT ldr.result_number INTO v_result_bottom2
    FROM lotto_draw_results ldr
    WHERE ldr.draw_id = p_draw_id AND ldr.result_type = 'BOTTOM_2'
    LIMIT 1;
  END IF;

  UPDATE lotto_order_items
  SET
    is_winner = FALSE,
    win_amount = 0,
    updated_at = NOW()
  WHERE order_id IN (
    SELECT id FROM lotto_orders WHERE draw_id = p_draw_id
  );

  FOR v_order IN
    SELECT *
    FROM lotto_orders
    WHERE draw_id = p_draw_id
    ORDER BY id
  LOOP
    FOR v_item IN
      SELECT
        loi.*,
        lbt.payout_rate,
        COALESCE(lbt.bet_type_code, lbt.code) AS bet_type_code
      FROM lotto_order_items loi
      JOIN lotto_bet_types lbt ON loi.bet_type_id = lbt.id
      WHERE loi.order_id = v_order.id
      ORDER BY loi.id
    LOOP
      v_is_winner := FALSE;
      v_win_amount := 0;

      IF v_category_code = 'THAI_GOVERNMENT' THEN
        CASE v_item.bet_type_code
          WHEN '6_digit' THEN
            IF v_item.number = v_result_main THEN
              v_is_winner := TRUE;
            END IF;

          WHEN '3_front' THEN
            IF v_item.number = ANY(COALESCE(v_result_front3, ARRAY[]::TEXT[])) THEN
              v_is_winner := TRUE;
            END IF;

          WHEN '3_back' THEN
            IF v_item.number = ANY(COALESCE(v_result_back3, ARRAY[]::TEXT[])) THEN
              v_is_winner := TRUE;
            END IF;

          WHEN '2_bottom' THEN
            IF v_item.number = v_result_bottom2 THEN
              v_is_winner := TRUE;
            END IF;

          WHEN 'run_top' THEN
            IF POSITION(v_item.number IN COALESCE(v_result_main, '')) > 0 THEN
              v_is_winner := TRUE;
            END IF;

          WHEN 'run_bottom' THEN
            IF POSITION(v_item.number IN COALESCE(v_result_bottom2, '')) > 0 THEN
              v_is_winner := TRUE;
            END IF;
        END CASE;

      ELSIF v_category_code = 'YEEKEE_VIP' THEN
        CASE v_item.bet_type_code
          WHEN '3_top' THEN
            IF v_item.number = SUBSTRING(v_draw.result_number, 1, 3) THEN
              v_is_winner := TRUE;
            END IF;

          WHEN '3_tod' THEN
            IF v_item.number = SUBSTRING(v_draw.result_number, 1, 3) THEN
              v_is_winner := TRUE;
            END IF;

          WHEN '2_top' THEN
            IF v_item.number = SUBSTRING(v_draw.result_number, 1, 2) THEN
              v_is_winner := TRUE;
            END IF;

          WHEN '2_bottom' THEN
            IF v_item.number = RIGHT(v_draw.result_number, 2) THEN
              v_is_winner := TRUE;
            END IF;

          WHEN 'run_top' THEN
            IF POSITION(v_item.number IN SUBSTRING(v_draw.result_number, 1, 1)) > 0 THEN
              v_is_winner := TRUE;
            END IF;

          WHEN 'run_bottom' THEN
            IF POSITION(v_item.number IN RIGHT(v_draw.result_number, 1)) > 0 THEN
              v_is_winner := TRUE;
            END IF;
        END CASE;
      END IF;

      IF v_is_winner THEN
        v_win_amount := COALESCE(v_item.amount, v_item.price, 0) * COALESCE(v_item.payout_rate, 0);

        UPDATE lotto_order_items
        SET
          is_winner = TRUE,
          win_amount = v_win_amount,
          updated_at = NOW()
        WHERE id = v_item.id;

        v_updated_items := v_updated_items + 1;
        v_total_payout := v_total_payout + v_win_amount;
      END IF;
    END LOOP;

    UPDATE lotto_orders
    SET
      total_win = (
        SELECT COALESCE(SUM(win_amount), 0)
        FROM lotto_order_items
        WHERE order_id = v_order.id
      ),
      result_status = CASE
        WHEN EXISTS (
          SELECT 1
          FROM lotto_order_items
          WHERE order_id = v_order.id
            AND is_winner = TRUE
        ) THEN 'won'
        ELSE 'lost'
      END,
      updated_at = NOW()
    WHERE id = v_order.id;

    v_updated_orders := v_updated_orders + 1;
  END LOOP;

  UPDATE lotto_draws
  SET
    total_orders = (
      SELECT COUNT(*)
      FROM lotto_orders
      WHERE draw_id = p_draw_id
    ),
    total_bet_amount = (
      SELECT COALESCE(SUM(total_amount), 0)
      FROM lotto_orders
      WHERE draw_id = p_draw_id
    ),
    total_winning_amount = v_total_payout,
    total_winners = (
      SELECT COUNT(DISTINCT order_id)
      FROM lotto_order_items
      WHERE order_id IN (
        SELECT id FROM lotto_orders WHERE draw_id = p_draw_id
      )
      AND is_winner = TRUE
    ),
    profit_loss = (
      SELECT COALESCE(SUM(total_amount), 0) - v_total_payout
      FROM lotto_orders
      WHERE draw_id = p_draw_id
    ),
    last_calculated_at = NOW(),
    last_calculated_by = p_admin_user_id,
    calculation_count = COALESCE(calculation_count, 0) + 1,
    result_modified_after_calc = FALSE,
    updated_at = NOW()
  WHERE id = p_draw_id;

  INSERT INTO lotto_result_audit_log (
    draw_id,
    admin_user_id,
    action,
    new_result,
    was_calculated,
    was_paid,
    notes
  )
  VALUES (
    p_draw_id,
    p_admin_user_id,
    'RECALCULATE',
    jsonb_build_object(
      'updated_orders', v_updated_orders,
      'updated_items', v_updated_items,
      'total_payout', v_total_payout
    ),
    TRUE,
    COALESCE(v_draw.is_paid, false),
    CASE
      WHEN COALESCE(v_draw.is_paid, false) = TRUE
        THEN 'RECALCULATION AFTER PAYOUT - Manual adjustment may be needed'
      ELSE 'Normal recalculation'
    END
  );

  RETURN QUERY SELECT TRUE, 'Calculation completed', v_updated_orders, v_updated_items, v_total_payout, v_warning;
END;
$$;

-- ============================================
-- 6. Function: Get draw detail
-- ============================================

DROP FUNCTION IF EXISTS get_draw_detail(INT);

CREATE OR REPLACE FUNCTION get_draw_detail(p_draw_id INT)
RETURNS TABLE(
  id INT,
  code VARCHAR,
  category_code VARCHAR,
  category_name VARCHAR,
  draw_date DATE,
  round_no INT,
  name_th VARCHAR,
  open_at TIMESTAMPTZ,
  close_at TIMESTAMPTZ,
  status VARCHAR,
  result_status VARCHAR,
  result_number VARCHAR,
  result_details JSONB,
  total_orders BIGINT,
  total_bet_amount DECIMAL,
  total_winning_amount DECIMAL,
  total_winners BIGINT,
  profit_loss DECIMAL,
  can_set_result BOOLEAN,
  can_calculate BOOLEAN,
  can_pay BOOLEAN,
  is_paid BOOLEAN,
  paid_at TIMESTAMPTZ,
  last_calculated_at TIMESTAMPTZ,
  calculation_count INT,
  result_modified_after_calc BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_draw RECORD;
  v_results JSONB;
BEGIN
  SELECT
    d.*,
    lc.code AS category_code,
    lc.name_th AS category_name
  INTO v_draw
  FROM lotto_draws d
  LEFT JOIN lotto_categories lc ON lc.id = d.category_id
  WHERE d.id = p_draw_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT jsonb_build_object(
    'main_6', (
      SELECT COALESCE(jsonb_agg(ldr.result_number ORDER BY ldr.id), '[]'::jsonb)
      FROM lotto_draw_results ldr
      WHERE ldr.draw_id = p_draw_id AND ldr.result_type = 'MAIN_6'
    ),
    'front_3', (
      SELECT COALESCE(jsonb_agg(ldr.result_number ORDER BY ldr.id), '[]'::jsonb)
      FROM lotto_draw_results ldr
      WHERE ldr.draw_id = p_draw_id AND ldr.result_type = 'FRONT_3'
    ),
    'back_3', (
      SELECT COALESCE(jsonb_agg(ldr.result_number ORDER BY ldr.id), '[]'::jsonb)
      FROM lotto_draw_results ldr
      WHERE ldr.draw_id = p_draw_id AND ldr.result_type = 'BACK_3'
    ),
    'bottom_2', (
      SELECT COALESCE(jsonb_agg(ldr.result_number ORDER BY ldr.id), '[]'::jsonb)
      FROM lotto_draw_results ldr
      WHERE ldr.draw_id = p_draw_id AND ldr.result_type = 'BOTTOM_2'
    )
  )
  INTO v_results;

  RETURN QUERY
  SELECT
    v_draw.id,
    v_draw.code::VARCHAR,
    v_draw.category_code::VARCHAR,
    v_draw.category_name::VARCHAR,
    v_draw.draw_date,
    v_draw.round_no,
    v_draw.name_th::VARCHAR,
    v_draw.open_at,
    v_draw.close_at,
    v_draw.status::VARCHAR,
    v_draw.result_status::VARCHAR,
    v_draw.result_number::VARCHAR,
    v_results,
    COALESCE(v_draw.total_orders, 0)::BIGINT,
    COALESCE(v_draw.total_bet_amount, 0)::DECIMAL,
    COALESCE(v_draw.total_winning_amount, 0)::DECIMAL,
    COALESCE(v_draw.total_winners, 0)::BIGINT,
    COALESCE(v_draw.profit_loss, 0)::DECIMAL,
    (COALESCE(v_draw.is_paid, false) IS NOT TRUE),
    (v_draw.result_status = 'resulted' AND COALESCE(v_draw.is_paid, false) IS NOT TRUE),
    (COALESCE(v_draw.total_winning_amount, 0) > 0
      AND v_draw.last_calculated_at IS NOT NULL
      AND COALESCE(v_draw.is_paid, false) IS NOT TRUE),
    COALESCE(v_draw.is_paid, false),
    v_draw.paid_at,
    v_draw.last_calculated_at,
    COALESCE(v_draw.calculation_count, 0),
    COALESCE(v_draw.result_modified_after_calc, false);
END;
$$;

COMMENT ON TABLE lotto_draw_results IS 'Stores detailed lottery results for multiple prize types';
COMMENT ON TABLE lotto_result_audit_log IS 'Audit trail for result changes and recalculations';
COMMENT ON FUNCTION save_thai_government_result IS 'Saves Thai Government lottery results with validation and audit';
COMMENT ON FUNCTION recalculate_draw_winners IS 'Safely recalculates winners with protection against duplicate payouts';