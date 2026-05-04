-- QA Test Suite for Thai Government Betting Windows Fix
-- Run: docker exec -i next-apollo-pg-ws-postgres-1 psql -U app -d lotto < this_file.sql

\echo '=================================================='
\echo 'QA TEST 1: Verify betting windows are correct'
\echo '=================================================='
\echo 'Today: May 2, 2026 ~12:30 Bangkok'
\echo 'Expected: May 16 draw should be OPEN and accepting bets'
\echo ''

SELECT 
  code,
  draw_date,
  TO_CHAR(open_at AT TIME ZONE 'Asia/Bangkok', 'MM/DD HH24:MI') as open_bkk,
  TO_CHAR(close_at AT TIME ZONE 'Asia/Bangkok', 'MM/DD HH24:MI') as close_bkk,
  status,
  CASE 
    WHEN NOW() >= open_at AND NOW() < close_at THEN '✓ ACCEPTING BETS'
    WHEN NOW() < open_at THEN '⏳ NOT YET OPEN'
    ELSE '✗ CLOSED'
  END as betting_status,
  TO_CHAR(NOW() AT TIME ZONE 'Asia/Bangkok', 'MM/DD HH24:MI') as current_time
FROM lotto_draws
WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT')
  AND draw_date BETWEEN '2026-05-01' AND '2026-06-16'
ORDER BY draw_date;

\echo ''
\echo '=================================================='
\echo 'QA TEST 2: Verify May 16 draw opens after May 1 closes'
\echo '=================================================='

WITH draws AS (
  SELECT 
    code,
    draw_date,
    open_at AT TIME ZONE 'Asia/Bangkok' as open_bkk,
    close_at AT TIME ZONE 'Asia/Bangkok' as close_bkk
  FROM lotto_draws
  WHERE code IN ('TH-2026-05-01', 'TH-2026-05-16')
)
SELECT 
  (SELECT close_bkk FROM draws WHERE code = 'TH-2026-05-01') as may_1_closes,
  (SELECT open_bkk FROM draws WHERE code = 'TH-2026-05-16') as may_16_opens,
  CASE 
    WHEN (SELECT close_bkk FROM draws WHERE code = 'TH-2026-05-01') = 
         (SELECT open_bkk FROM draws WHERE code = 'TH-2026-05-16')
    THEN '✓ PASS - May 16 opens when May 1 closes'
    ELSE '✗ FAIL - Times do not match'
  END as test_result;

\echo ''
\echo '=================================================='
\echo 'QA TEST 3: Verify June 1 draw opens after May 16 closes'
\echo '=================================================='

WITH draws AS (
  SELECT 
    code,
    draw_date,
    open_at AT TIME ZONE 'Asia/Bangkok' as open_bkk,
    close_at AT TIME ZONE 'Asia/Bangkok' as close_bkk
  FROM lotto_draws
  WHERE code IN ('TH-2026-05-16', 'TH-2026-06-01')
)
SELECT 
  (SELECT close_bkk FROM draws WHERE code = 'TH-2026-05-16') as may_16_closes,
  (SELECT open_bkk FROM draws WHERE code = 'TH-2026-06-01') as june_1_opens,
  CASE 
    WHEN (SELECT close_bkk FROM draws WHERE code = 'TH-2026-05-16') = 
         (SELECT open_bkk FROM draws WHERE code = 'TH-2026-06-01')
    THEN '✓ PASS - June 1 opens when May 16 closes'
    ELSE '✗ FAIL - Times do not match'
  END as test_result;

\echo ''
\echo '=================================================='
\echo 'QA TEST 4: activeDraw logic simulation (May 2)'
\echo '=================================================='
\echo 'Should return May 16 draw as currently accepting bets'
\echo ''

SELECT 
  code,
  draw_date,
  TO_CHAR(open_at AT TIME ZONE 'Asia/Bangkok', 'MM/DD HH24:MI') as opens,
  TO_CHAR(close_at AT TIME ZONE 'Asia/Bangkok', 'MM/DD HH24:MI') as closes,
  status,
  (NOW() >= open_at AND NOW() < close_at AND is_active = true AND status NOT IN ('CANCELLED', 'RESULTED')) as is_accepting_bets,
  CASE 
    WHEN code = 'TH-2026-05-16' AND 
         NOW() >= open_at AND 
         NOW() < close_at
    THEN '✓ PASS - Correct draw selected'
    ELSE 'Not selected'
  END as test_result
FROM lotto_draws
WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT')
  AND NOW() >= open_at
  AND NOW() < close_at
ORDER BY close_at ASC
LIMIT 1;

\echo ''
\echo '=================================================='
\echo 'QA TEST 5: Future draw test (simulate May 17)'
\echo '=================================================='
\echo 'If today were May 17 (after May 16 closes), June 1 should be active'
\echo ''

SELECT 
  code,
  draw_date,
  TO_CHAR(open_at AT TIME ZONE 'Asia/Bangkok', 'MM/DD HH24:MI') as opens,
  TO_CHAR(close_at AT TIME ZONE 'Asia/Bangkok', 'MM/DD HH24:MI') as closes,
  CASE 
    WHEN code = 'TH-2026-06-01'
    THEN '✓ PASS - June 1 would be next active draw after May 16 closes'
    ELSE 'Other draw'
  END as test_result
FROM lotto_draws
WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT')
  AND '2026-05-17 10:00:00'::timestamptz >= open_at
  AND '2026-05-17 10:00:00'::timestamptz < close_at
ORDER BY close_at ASC
LIMIT 1;

\echo ''
\echo '=================================================='
\echo 'QA TEST SUMMARY'
\echo '=================================================='
\echo 'All tests completed. Expected results:'
\echo '- TEST 1: May 16 shows ACCEPTING BETS'
\echo '- TEST 2: May 16 opens at May 1 15:30'
\echo '- TEST 3: June 1 opens at May 16 15:30'
\echo '- TEST 4: May 16 selected for May 2'
\echo '- TEST 5: June 1 would be selected for May 17'
\echo '=================================================='
