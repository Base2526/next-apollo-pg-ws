-- Fix Thai Government Lottery Draw Status Issue
-- Problem: Draws are stuck in 'DRAFT' status when they should be 'OPEN'
-- Solution: Update status based on current time and betting windows

-- ============================================
-- STEP 1: Update draws that should be OPEN
-- ============================================
UPDATE lotto_draws
SET status = 'OPEN'
WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT')
  AND is_active = true
  AND status IN ('DRAFT', 'PENDING')
  AND NOW() >= open_at
  AND NOW() < close_at
  AND status NOT IN ('CANCELLED', 'RESULTED', 'CLOSED');

-- ============================================
-- STEP 2: Update draws that should be CLOSED
-- ============================================
UPDATE lotto_draws
SET status = 'CLOSED'
WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT')
  AND is_active = true
  AND NOW() >= close_at
  AND status NOT IN ('CANCELLED', 'RESULTED', 'CLOSED');

-- ============================================
-- STEP 3: Verify the fix
-- ============================================
SELECT 
  id,
  code,
  draw_date,
  TO_CHAR(open_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI') as open_bkk,
  TO_CHAR(close_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI') as close_bkk,
  status,
  is_active,
  CASE 
    WHEN NOW() >= open_at AND NOW() < close_at AND status IN ('OPEN', 'PENDING') THEN '✓ ACCEPTING BETS'
    WHEN NOW() < open_at THEN '⏳ FUTURE (opens ' || TO_CHAR(open_at AT TIME ZONE 'Asia/Bangkok', 'DD/MM HH24:MI') || ')'
    WHEN NOW() >= close_at THEN '✗ CLOSED'
    ELSE '⚠️ CHECK STATUS: ' || status
  END as betting_status,
  TO_CHAR(NOW() AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS') as current_time_bkk
FROM lotto_draws
WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT')
  AND draw_date >= CURRENT_DATE - INTERVAL '7 days'
  AND draw_date <= CURRENT_DATE + INTERVAL '90 days'
ORDER BY draw_date ASC;

-- ============================================
-- STEP 4: Show current active draw
-- ============================================
SELECT 
  '🎯 ACTIVE DRAW' as info,
  id,
  code,
  name_th,
  TO_CHAR(draw_date, 'DD/MM/YYYY') as draw_date_thai,
  TO_CHAR(open_at AT TIME ZONE 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI') as open_at_bkk,
  TO_CHAR(close_at AT TIME ZONE 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI') as close_at_bkk,
  status,
  is_active,
  (NOW() >= open_at AND NOW() < close_at AND is_active = true AND status IN ('OPEN', 'PENDING')) as is_accepting_bets
FROM lotto_draws
WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT')
  AND is_active = true
  AND status IN ('OPEN', 'PENDING')
  AND NOW() >= open_at
  AND NOW() < close_at
ORDER BY close_at ASC
LIMIT 1;
