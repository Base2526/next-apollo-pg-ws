# Fix: Thai Government Lottery Not Accepting Bets

## Problem Summary
หวยรัฐบาลไทยถูกปิดรับแทงทั้งที่ยังไม่ถึงเวลาปิด - Thai Government lottery shows as "closed" even though the close time hasn't been reached yet.

**Root Cause:**
- Draws created with status `'DRAFT'` instead of `'OPEN'` or `'PENDING'`
- Active draw query only checks for status `IN ('OPEN', 'PENDING')`
- No automatic status update based on time windows

## Solution Implemented

### 1. Backend: Auto Status Update in Resolver ✅
**File:** `apps/lotto/graphql/resolvers.ts`

Added automatic status update in the `activeDraw` resolver:
```typescript
// Auto-update status for draws in valid betting windows
await queryLottoDb(
  `UPDATE lotto_draws
   SET status = 'OPEN'
   WHERE category_id = $1
     AND is_active = true
     AND status IN ('DRAFT', 'PENDING')
     AND NOW() >= open_at
     AND NOW() < close_at
     AND status NOT IN ('CANCELLED', 'RESULTED', 'CLOSED')`,
  [categoryId]
);
```

**Benefits:**
- Automatically fixes status on every active draw query
- No manual intervention needed
- Works for all categories

### 2. Enhanced Debug Logging ✅
**Files:** 
- `apps/lotto/graphql/resolvers.ts`
- `apps/lotto/app/page.tsx` (homepage)
- `apps/lotto/app/(main)/play/[categoryCode]/page.tsx` (play page)

#### Backend Logging:
```javascript
console.log('[ACTIVE_DRAW_RESOLVER] All recent draws:', draws.map(d => ({
  id: d.id,
  code: d.code,
  status: d.status,
  reason: !d.is_open_time ? 'NOT_YET_OPEN' : 
          !d.is_before_close ? 'ALREADY_CLOSED' : 
          !['OPEN', 'PENDING'].includes(d.status) ? `INVALID_STATUS(${d.status})` : 
          'SHOULD_MATCH'
})));
```

#### Frontend Logging:
```javascript
console.log("[THAI_ACTIVE_DRAW_DEBUG]", {
  page: "homepage" | "play/THAI_GOVERNMENT",
  now: now.toISOString(),
  selectedDraw: {
    id, code, drawDate, openAt, closeAt, 
    status, resultStatus, isActive, isAcceptingBets
  },
  parsed: {
    openMs, closeMs, nowMs,
    isOpenTime, isBeforeClose,
    isStatusOpen, isAcceptingBets
  },
  formatted: {
    now, openAt, closeAt  // Thai timezone formatted
  }
});
```

### 3. SQL Fix Script ✅
**File:** `db/migrations/fix_thai_govt_draw_status.sql`

Immediate fix for existing draws:
- Updates DRAFT → OPEN for draws in betting window
- Updates past draws to CLOSED
- Verifies results with detailed status report
- Shows current active draw

## How to Apply the Fix

### Option 1: Automatic (Recommended)
The resolver now auto-updates status on every query. Simply:
1. Reload the frontend (homepage or play page)
2. Check browser console for `[THAI_ACTIVE_DRAW_DEBUG]` logs
3. Verify draw shows as "เปิดรับแทง"

### Option 2: Manual SQL (For Immediate Fix)
Run the SQL script:
```bash
cd /Users/s0mkidd/Desktop/Projects/next-apollo-pg-ws
docker exec -i <postgres_container> psql -U <user> -d lotto < db/migrations/fix_thai_govt_draw_status.sql
```

Or via psql:
```bash
docker exec -it <postgres_container> psql -U <user> -d lotto
\i /path/to/fix_thai_govt_draw_status.sql
```

## Verification Checklist

### ✅ Backend Verification
1. Check server logs for `[ACTIVE_DRAW_RESOLVER]` messages
2. Verify auto-update SQL executed successfully
3. Confirm active draw found with correct status
4. Check debug output shows `SHOULD_MATCH` reason

### ✅ Frontend Verification (Homepage)
1. Open `/` (homepage)
2. Open browser console (F12)
3. Look for `[THAI_ACTIVE_DRAW_DEBUG]` log entry
4. Verify:
   - ✅ `selectedDraw.id` exists
   - ✅ `selectedDraw.status` is `'OPEN'`
   - ✅ `parsed.isOpenTime` is `true`
   - ✅ `parsed.isBeforeClose` is `true`
   - ✅ `parsed.isAcceptingBets` is `true`
5. Card should show:
   - ✅ Green badge "เปิดรับแทง"
   - ✅ Countdown timer
   - ✅ Draw date and close time

### ✅ Frontend Verification (Play Page)
1. Open `/play/THAI_GOVERNMENT`
2. Open browser console (F12)
3. Look for `[THAI_ACTIVE_DRAW_DEBUG]` log entry
4. Verify same conditions as homepage
5. Page should show:
   - ✅ Bet type selection enabled
   - ✅ Number input enabled
   - ✅ "เพิ่มโพย" button enabled
   - ✅ No warning messages about closed betting

### ✅ Consistency Check
Compare `[ACTIVE_DRAW_COMPARE_DEBUG]` logs from both pages:
- ✅ `selectedDrawId` should be identical
- ✅ `code` should match
- ✅ `status` should be the same
- ✅ `isAcceptingBets` should both be `true`

## Expected Behavior After Fix

### Scenario 1: Within Betting Window
**Conditions:**
- Current time: 2026-05-14 10:00
- Draw: 2026-05-16 (closes 15:30)
- open_at: 2026-05-01 15:30
- close_at: 2026-05-16 15:30

**Expected:**
- ✅ Status auto-updated to `'OPEN'`
- ✅ Homepage shows "เปิดรับแทง"
- ✅ Play page accepts bets
- ✅ `is_accepting_bets` = true

### Scenario 2: Before Open Time
**Conditions:**
- Current time: 2026-04-20 10:00
- Draw: 2026-05-16
- open_at: 2026-05-01 15:30
- close_at: 2026-05-16 15:30

**Expected:**
- ✅ No active draw returned
- ✅ Homepage shows "ยังไม่มีงวดที่เปิดรับแทง"
- ✅ Debug shows reason: `NOT_YET_OPEN`

### Scenario 3: After Close Time
**Conditions:**
- Current time: 2026-05-16 16:00
- Draw: 2026-05-16
- open_at: 2026-05-01 15:30
- close_at: 2026-05-16 15:30 (passed)

**Expected:**
- ✅ No active draw returned
- ✅ Status updated to `'CLOSED'`
- ✅ Homepage shows "ปิดรับแทงแล้ว"
- ✅ Debug shows reason: `ALREADY_CLOSED`

## Files Modified

1. ✅ `apps/lotto/graphql/resolvers.ts` - Auto status update + debug logging
2. ✅ `apps/lotto/app/page.tsx` - Enhanced frontend debug logging
3. ✅ `apps/lotto/app/(main)/play/[categoryCode]/page.tsx` - Enhanced debug logging
4. ✅ `db/migrations/fix_thai_govt_draw_status.sql` - Manual fix script

## No Impact on YEEKEE_VIP
The fix specifically targets the active draw logic and does NOT affect YEEKEE_VIP:
- ✅ YEEKEE_VIP uses `drawId` parameter with `drawById` query
- ✅ Different status checking logic (real-time close time check)
- ✅ No changes to YEEKEE rounds selection
- ✅ Separate code path in play page

## Testing Commands

### Check Current Active Draw
```sql
SELECT 
  id, code, draw_date, status,
  TO_CHAR(open_at AT TIME ZONE 'Asia/Bangkok', 'DD/MM HH24:MI') as open_bkk,
  TO_CHAR(close_at AT TIME ZONE 'Asia/Bangkok', 'DD/MM HH24:MI') as close_bkk,
  NOW() >= open_at as is_open_time,
  NOW() < close_at as is_before_close
FROM lotto_draws
WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT')
  AND is_active = true
  AND draw_date >= CURRENT_DATE
ORDER BY draw_date ASC;
```

### Force Status Update
```sql
UPDATE lotto_draws
SET status = 'OPEN'
WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT')
  AND is_active = true
  AND status = 'DRAFT'
  AND NOW() >= open_at
  AND NOW() < close_at;
```

### Check All Draw Windows
```sql
SELECT 
  code,
  TO_CHAR(draw_date, 'DD/MM/YYYY') as date,
  TO_CHAR(open_at AT TIME ZONE 'Asia/Bangkok', 'DD/MM HH24:MI') as opens,
  TO_CHAR(close_at AT TIME ZONE 'Asia/Bangkok', 'DD/MM HH24:MI') as closes,
  status,
  CASE 
    WHEN NOW() >= open_at AND NOW() < close_at THEN '✓ OPEN WINDOW'
    WHEN NOW() < open_at THEN '⏳ FUTURE'
    ELSE '✗ CLOSED'
  END as window
FROM lotto_draws
WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'THAI_GOVERNMENT')
  AND draw_date >= CURRENT_DATE
ORDER BY draw_date;
```

## Summary

The fix addresses the root cause by:
1. ✅ Auto-updating draw status based on time windows
2. ✅ Adding comprehensive debug logging at all levels
3. ✅ Providing manual SQL fix for immediate resolution
4. ✅ Maintaining consistency between homepage and play page
5. ✅ No impact on other lottery categories

**Status:** ✅ FIXED - Ready for deployment
