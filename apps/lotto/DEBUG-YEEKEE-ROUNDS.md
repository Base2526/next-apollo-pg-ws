# 🔍 YEEKEE_VIP Rounds Page - Debugging Guide

## ✅ Changes Applied

### 1. **Frontend Debugging** ([app/(main)/play/YEEKEE_VIP/rounds/page.tsx](app/(main)/play/YEEKEE_VIP/rounds/page.tsx))

Added comprehensive console logs to track data flow:

```typescript
// Line ~170
console.log('[YeeKee Rounds] Query State:', { loading, error, data, selectedDate });
console.log('[YeeKee Rounds] Raw Data:', data);
console.log('[YeeKee Rounds] yeeKeeRounds:', data?.yeeKeeRounds);
console.log('[YeeKee Rounds] Rounds Array:', rounds);
console.log('[YeeKee Rounds] Rounds Length:', rounds.length);
```

**Enhanced Error Messages:**
- Error state now shows actual error message
- Empty state shows selected date + debug info
- Warning alert for empty results

### 2. **Backend Debugging** ([graphql/resolvers.ts](graphql/resolvers.ts))

Added server-side logging in `yeeKeeRounds` resolver:

```typescript
// Line ~122
console.log('[yeeKeeRounds] Query params:', { date, targetDate });
console.log('[yeeKeeRounds] Category rows:', categoryRows);
console.log('[yeeKeeRounds] Category ID:', categoryId);
console.log('[yeeKeeRounds] Query result:', { 
  count: rounds?.length || 0, 
  firstRound: rounds?.[0],
  params: [categoryId, targetDate]
});
```

---

## 🧪 How to Test

### Step 1: Start Dev Server
```bash
cd /Users/s0mkidd/Desktop/Projects/next-apollo-pg-ws/apps/lotto
npm run dev
```

### Step 2: Open Browser Console
1. Navigate to `http://localhost:3000/play/YEEKEE_VIP/rounds`
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to Console tab
4. Clear console (Cmd+K)
5. Refresh page (Cmd+R)

---

## 📊 Expected Console Output

### ✅ **If Working Correctly:**

**Backend (Terminal):**
```
[yeeKeeRounds] Query params: { date: '2026-05-03', targetDate: '2026-05-03' }
[yeeKeeRounds] Category rows: [ { id: 2 } ]
[yeeKeeRounds] Category ID: 2
[yeeKeeRounds] Query result: { 
  count: 88, 
  firstRound: { 
    id: 1, 
    round_no: 1, 
    name_th: 'รอบที่ 1',
    status: 'CLOSED',
    is_accepting_bets: false,
    ...
  },
  params: [ 2, '2026-05-03' ]
}
```

**Frontend (Browser Console):**
```
[YeeKee Rounds] Query State: { 
  loading: false, 
  error: undefined, 
  data: { yeeKeeRounds: [...] },
  selectedDate: '2026-05-03'
}
[YeeKee Rounds] Raw Data: { yeeKeeRounds: Array(88) }
[YeeKee Rounds] yeeKeeRounds: Array(88) [ {...}, {...}, ... ]
[YeeKee Rounds] Rounds Array: Array(88)
[YeeKee Rounds] Rounds Length: 88
```

**UI Result:**
- Grid showing 88 round cards
- Statistics: 88 total, X open, X closed
- Individual countdowns on open rounds

---

## ❌ **If Still Broken - Possible Issues:**

### Issue 1: Empty Array (count: 0)
**Backend shows:**
```
[yeeKeeRounds] Query result: { count: 0, firstRound: undefined, params: [2, '2026-05-03'] }
```

**Cause:** No data in database for that date

**Fix:**
```bash
# Generate rounds for today
docker exec -i next-apollo-pg-ws-postgres-1 psql -U app -d lotto -c "SELECT generate_yeekee_rounds(CURRENT_DATE);"

# Verify
docker exec -i next-apollo-pg-ws-postgres-1 psql -U app -d lotto -c "SELECT COUNT(*) FROM lotto_draws WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'YEEKEE_VIP') AND draw_date = CURRENT_DATE;"
```

---

### Issue 2: No Category Found
**Backend shows:**
```
[yeeKeeRounds] Category rows: []
[yeeKeeRounds] No YEEKEE_VIP category found!
```

**Cause:** YEEKEE_VIP category doesn't exist or is inactive

**Fix:**
```bash
# Check category
docker exec -i next-apollo-pg-ws-postgres-1 psql -U app -d lotto -c "SELECT id, code, is_active FROM lotto_categories WHERE code = 'YEEKEE_VIP';"

# If inactive, activate it
docker exec -i next-apollo-pg-ws-postgres-1 psql -U app -d lotto -c "UPDATE lotto_categories SET is_active = true WHERE code = 'YEEKEE_VIP';"
```

---

### Issue 3: GraphQL Error
**Frontend shows:**
```
[YeeKee Rounds] Query State: { 
  loading: false, 
  error: { message: 'Network error: ...' },
  data: undefined
}
```

**Causes:**
1. Database connection issue
2. GraphQL server not running
3. Network/CORS problem

**Fix:**
```bash
# Check Docker containers
docker ps

# Should see: next-apollo-pg-ws-postgres-1 running

# If not, start containers
cd /Users/s0mkidd/Desktop/Projects/next-apollo-pg-ws
docker-compose up -d

# Check GraphQL endpoint
curl http://localhost:3000/api/graphql -X POST -H "Content-Type: application/json" -d '{"query": "{ __typename }"}'
```

---

### Issue 4: Date Format Mismatch
**Backend shows:**
```
[yeeKeeRounds] Query params: { date: '2026-05-03', targetDate: '2026-05-03' }
[yeeKeeRounds] Query result: { count: 0, ... }
```

**But database has data for different date format**

**Fix:**
```bash
# Check actual draw_date format in DB
docker exec -i next-apollo-pg-ws-postgres-1 psql -U app -d lotto -c "SELECT DISTINCT draw_date FROM lotto_draws WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'YEEKEE_VIP') ORDER BY draw_date DESC LIMIT 5;"

# If format differs, regenerate with correct date
docker exec -i next-apollo-pg-ws-postgres-1 psql -U app -d lotto -c "SELECT generate_yeekee_rounds('2026-05-03'::DATE);"
```

---

### Issue 5: Frontend Receives Data But Shows Empty
**Console shows:**
```
[YeeKee Rounds] Rounds Length: 88
```

**But UI still shows "ยังไม่มีรอบหวยที่เปิดใช้งาน"**

**Cause:** Render logic issue (unlikely with current code)

**Fix:** Check if there's a React re-render issue. Try:
```typescript
// Force re-render by adding key
<div key={rounds.length}>
  {/* Grid content */}
</div>
```

---

## 🔧 Quick Diagnostic Commands

### Check Everything at Once:
```bash
# 1. Database status
docker ps | grep postgres

# 2. Category exists
docker exec -i next-apollo-pg-ws-postgres-1 psql -U app -d lotto -c "SELECT * FROM lotto_categories WHERE code = 'YEEKEE_VIP';"

# 3. Rounds count
docker exec -i next-apollo-pg-ws-postgres-1 psql -U app -d lotto -c "SELECT COUNT(*), MIN(draw_date), MAX(draw_date) FROM lotto_draws WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'YEEKEE_VIP');"

# 4. Sample round data
docker exec -i next-apollo-pg-ws-postgres-1 psql -U app -d lotto -c "SELECT id, round_no, name_th, status, open_at, close_at FROM lotto_draws WHERE category_id = (SELECT id FROM lotto_categories WHERE code = 'YEEKEE_VIP') AND draw_date = CURRENT_DATE ORDER BY round_no LIMIT 3;"
```

---

## 📝 What to Report Back

After checking the console, please provide:

1. **Backend Terminal Output:**
   - Copy all `[yeeKeeRounds]` log lines

2. **Browser Console Output:**
   - Copy all `[YeeKee Rounds]` log lines

3. **Network Tab:**
   - Find GraphQL request to `/api/graphql`
   - Check request payload
   - Check response body
   - Screenshot if possible

4. **UI State:**
   - What message is showing?
   - Loading spinner?
   - Error alert?
   - Empty state?

5. **Database Check:**
   - Run diagnostic commands above
   - Copy output

---

## 🎯 Root Cause Checklist

- [ ] Docker containers running?
- [ ] Database has YEEKEE_VIP category?
- [ ] Database has rounds for today (2026-05-03)?
- [ ] GraphQL query executing?
- [ ] Backend logs show data returned?
- [ ] Frontend receives data?
- [ ] Data structure matches expected format?
- [ ] No filter removing all data?
- [ ] UI render condition correct?

---

## ✅ Success Criteria

When working correctly, you should see:

**Console:**
- 88 rounds loaded
- No errors

**UI:**
- Header: "จับยี่กี VIP"
- Stats: "88 รอบ", "X รอบ เปิดรับแทง", "X รอบ ปิดแล้ว"
- Grid: 88 cards displayed
- Open rounds: Green border, countdown timer
- Closed rounds: Gray background, disabled
- Future rounds: Blue border, "เปิดใน X"

---

## 🚀 Next Steps

1. Start dev server
2. Check console logs
3. Report findings
4. We'll fix based on what the logs reveal

The debugging is now in place - the logs will tell us exactly where the problem is!
