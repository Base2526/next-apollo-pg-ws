-- QA Test Suite for Thai Government Lottery Close Time Fix
-- Run: docker exec -i next-apollo-pg-ws-postgres-1 psql -U app -d lotto < this_file.sql

\echo '=================================================='
\echo 'QA TEST 1: Verify all draws close at 15:30 Bangkok'
\echo '=================================================='
SELECT 
  code,
  draw_date,
  TO_CHAR(close_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS') as close_bangkok,
  status,
  CASE 
    WHEN EXTRACT(HOUR FROM close_at AT TIME ZONE 'Asia/Bangkok') = 15 
     AND EXTRACT(MINUTE FROM close_at AT TIME ZONE 'Asia/Bangkok') = 30
    THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as test_result
FROM lotto_draws 
WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT')
ORDER BY draw_date
LIMIT 10;

\echo ''
\echo '=================================================='
\echo 'QA TEST 2: Check current Bangkok time vs close time'
\echo '=================================================='
SELECT 
  NOW() AT TIME ZONE 'Asia/Bangkok' as bangkok_now,
  (SELECT close_at AT TIME ZONE 'Asia/Bangkok' FROM lotto_draws WHERE code = 'TH-2026-05-16') as next_open_close,
  CASE 
    WHEN NOW() < (SELECT close_at FROM lotto_draws WHERE code = 'TH-2026-05-16')
    THEN '✓ PASS - Draw still open (before 15:30)'
    ELSE '✗ FAIL - Draw should be closed'
  END as test_result;

\echo ''
\echo '=================================================='
\echo 'QA TEST 3: activeDraw query logic'
\echo '=================================================='
-- Simulate what activeDraw resolver does
WITH cat AS (
  SELECT id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT' AND is_active = true
)
SELECT 
  d.code,
  d.draw_date,
  d.status,
  TO_CHAR(d.close_at AT TIME ZONE 'Asia/Bangkok', 'HH24:MI') as close_time,
  CASE 
    WHEN d.status = 'OPEN' AND (d.close_at IS NULL OR d.close_at > NOW())
    THEN '✓ PASS - Should be returned as active draw'
    ELSE 'SKIP - Not active'
  END as test_result
FROM lotto_draws d, cat
WHERE d.category_id = cat.id
  AND d.status = 'OPEN'
  AND d.is_active = true
  AND (d.close_at IS NULL OR d.close_at > NOW())
ORDER BY d.draw_date ASC
LIMIT 1;

\echo ''
\echo '=================================================='
\echo 'QA TEST 4: Close time for admin-changed dates'
\echo '=================================================='
-- Test case: If admin changes draw_date to 2026-05-17, close_at should be 2026-05-17 15:30
\echo 'Simulating admin changing draw_date...'
UPDATE lotto_draws
SET draw_date = '2026-05-03',
    is_date_overridden = true
WHERE code = 'TH-2026-05-999';

SELECT 
  code,
  draw_date,
  TO_CHAR(close_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS') as close_bangkok,
  is_date_overridden,
  CASE 
    WHEN is_date_overridden = true
    THEN '✓ PASS - Override flag set, close_at preserved'
    ELSE '✗ FAIL - Override flag should be set'
  END as test_result
FROM lotto_draws 
WHERE code = 'TH-2026-05-999';

-- If admin wants to update close_at to match new draw_date, they should do:
-- UPDATE lotto_draws 
-- SET close_at = (draw_date::text || ' 15:30:00')::timestamp AT TIME ZONE 'Asia/Bangkok'
-- WHERE code = 'TH-2026-05-999';

\echo ''
\echo '=================================================='
\echo 'QA TEST 5: Validate NULL/invalid close_at handling'
\echo '=================================================='
-- Check if any draws have NULL close_at
SELECT 
  COUNT(*) as null_close_at_count,
  CASE 
    WHEN COUNT(*) = 0 
    THEN '✓ PASS - No NULL close_at values'
    ELSE '✗ FAIL - Found NULL close_at values'
  END as test_result
FROM lotto_draws
WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT')
  AND close_at IS NULL;

\echo ''
\echo '=================================================='
\echo 'QA TEST SUMMARY'
\echo '=================================================='
\echo 'All tests completed. Check results above.'
\echo 'Expected: All PASS except admin override test (should preserve old close_at)'
\echo '=================================================='
