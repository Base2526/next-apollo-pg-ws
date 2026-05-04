# YEEKEE VIP Time-Based Round Logic - IMPLEMENTED

## ✅ Changes Applied

### Target File
`apps/lotto/app/(main)/play/YEEKEE_VIP/rounds/page.tsx`

---

## 🔧 What Was Fixed

### **Previous Logic (WRONG)**
```typescript
const isOpen = round.is_accepting_bets === true;
const isPast = round.status === 'CLOSED' || timeRemaining.expired;
const isFuture = !isOpen && !isPast;
```
**Problem:** Relied on backend-computed `is_accepting_bets` and database `status` field.

---

### **New Logic (CORRECT)**
```typescript
// Get current time in Bangkok timezone
const now = dayjs().tz("Asia/Bangkok");
const openTime = dayjs(round.open_at).tz("Asia/Bangkok");
const closeTime = dayjs(round.close_at).tz("Asia/Bangkok");

// Time-based status calculation
const isPast = now.isSameOrAfter(closeTime);         // close_at <= current_time
const isOpen = now.isSameOrAfter(openTime) && now.isBefore(closeTime);  // open_at <= current_time < close_at
const isFuture = now.isBefore(openTime);             // current_time < open_at
```

---

## 📋 Implementation Details

### 1. **Round Status Calculation**
Each round now calculates its status in real-time based on Thailand timezone:

- **🔴 Closed/Past**: `current_time >= close_at` → Betting window has closed
- **🟢 Open/Playable**: `open_at <= current_time < close_at` → Currently accepting bets  
- **🔵 Future/Waiting**: `current_time < open_at` → Not yet open

### 2. **Added Plugins**
```typescript
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
dayjs.extend(isSameOrAfter);
```

### 3. **Statistics Calculation**
Stats now calculate based on time comparison instead of database fields:
```typescript
// Open rounds count
const openRounds = rounds.filter((r) => {
  const openTime = dayjs(r.open_at).tz("Asia/Bangkok");
  const closeTime = dayjs(r.close_at).tz("Asia/Bangkok");
  return now.isSameOrAfter(openTime) && now.isBefore(closeTime);
});

// Closed rounds count
const closedRounds = rounds.filter((r) => {
  const closeTime = dayjs(r.close_at).tz("Asia/Bangkok");
  return now.isSameOrAfter(closeTime);
});
```

### 4. **Click Handler**
Prevents navigation to closed rounds:
```typescript
const handleRoundClick = (round: any) => {
  const now = dayjs().tz("Asia/Bangkok");
  const closeTime = dayjs(round.close_at).tz("Asia/Bangkok");
  const isPast = now.isSameOrAfter(closeTime);
  
  if (isPast || round.status === 'CLOSED') {
    console.log('[YeeKee Rounds] Round is closed, navigation blocked');
    return;
  }
  
  router.push(`/play/YEEKEE_VIP?drawId=${round.id}`);
};
```

---

## 🧪 Testing

### **Current System Time**
As of implementation: **2026-05-03 02:20 Bangkok Time**

### **Round Schedule**
- Round 1: 07:00 - 07:15
- Round 2: 07:15 - 07:30
- Round 3: 07:30 - 07:45
- ... (88 rounds total)

### **Expected Behavior at 02:20**
- ✅ All 88 rounds shown as **🔵 Future** (not yet open)
- ✅ Stats: "0 เปิดรับแทง" (0 open)
- ✅ Stats: "0 ปิดแล้ว" (0 closed)
- ✅ All rounds clickable but shown as "รอเปิด" (waiting to open)

### **Expected Behavior at 07:05**
- ✅ Round 1 (07:00-07:15): **🟢 Open** - Currently accepting bets
- ✅ Rounds 2-88: **🔵 Future** - Waiting to open
- ✅ Stats: "1 เปิดรับแทง" (1 open)

### **Expected Behavior at 07:20**
- ✅ Round 1 (07:00-07:15): **🔴 Closed** - Disabled, grey, not clickable
- ✅ Round 2 (07:15-07:30): **🟢 Open** - Currently accepting bets
- ✅ Rounds 3-88: **🔵 Future** - Waiting to open
- ✅ Stats: "1 เปิดรับแทง", "1 ปิดแล้ว"

---

## 📊 Debug Logging

### **Page Level Logs**
```javascript
console.log('[YeeKee Rounds] ==================== PAGE RENDER ====================');
console.log('[YeeKee Rounds] Current Bangkok Time:', currentBangkokTime);
console.log('[YeeKee Rounds] Selected Date:', selectedDate);
console.log('[YeeKee Rounds] Rounds Count:', rounds.length);
console.log('[YeeKee Rounds] First 3 Rounds:', ...);
```

### **Round Card Logs** (first 3 rounds only)
```javascript
console.log(`[Round ${round.round_no}] Status Calculation:`, {
  now: now.format('YYYY-MM-DD HH:mm:ss'),
  openTime: openTime.format('YYYY-MM-DD HH:mm:ss'),
  closeTime: closeTime.format('YYYY-MM-DD HH:mm:ss'),
  isPast,
  isOpen,
  isFuture,
  isUrgent,
  timeRemaining: `${remaining.hours}h ${remaining.minutes}m ${remaining.seconds}s`
});
```

### **Click Logs**
```javascript
console.log('[YeeKee Rounds] Round Click:', {
  round_no: round.round_no,
  now: now.format('HH:mm:ss'),
  close_at: closeTime.format('HH:mm:ss'),
  isPast,
  status: round.status
});
```

---

## 🚀 How to Test

### 1. Start Development Server
```bash
cd /Users/s0mkidd/Desktop/Projects/next-apollo-pg-ws/apps/lotto
npm run dev
```

### 2. Navigate to Round Selection Page
```
http://localhost:3000/play/YEEKEE_VIP/rounds
```

### 3. Open Browser DevTools Console (F12)

### 4. Verify Logs
You should see:
```
[YeeKee Rounds] ==================== PAGE RENDER ====================
[YeeKee Rounds] Current Bangkok Time: 2026-05-03 02:XX:XX
[YeeKee Rounds] Selected Date: 2026-05-03
[YeeKee Rounds] Rounds Count: 88
[YeeKee Rounds] First 3 Rounds: [...]

[Round 1] Status Calculation: {
  now: '2026-05-03 02:XX:XX',
  openTime: '2026-05-03 07:00:00',
  closeTime: '2026-05-03 07:15:00',
  isPast: false,
  isOpen: false,
  isFuture: true,
  isUrgent: false,
  timeRemaining: '4h 40m XXs'
}
```

### 5. Test Time-Based Behavior

#### **To simulate different times** (for testing):
You can temporarily modify the `now` variable in the code:
```typescript
// TEST ONLY: Simulate 07:05 time
const now = dayjs().tz("Asia/Bangkok").hour(7).minute(5);
```

Or wait for actual round times to test naturally.

---

## 📝 Key Requirements Met

✅ **Requirement 1:** Show playable/open only when `round_time >= current_time`  
   → Implemented: `isOpen = open_at <= current_time < close_at`

✅ **Requirement 2:** Example - at 01:00, only rounds >= 01:00 playable  
   → Implemented: Time-based comparison in Bangkok timezone

✅ **Requirement 3:** Do not hardcode round list  
   → Implemented: Uses DB/API data via `useYeeKeeRounds()`

✅ **Requirement 4:** Use DB/API round config  
   → Implemented: Reads `open_at`, `close_at` from GraphQL query

✅ **Requirement 5:** Do not break existing page flow  
   → Implemented: All navigation and UI structure preserved

✅ **Requirement 6:** Normalize times using Thailand timezone  
   → Implemented: All comparisons use `dayjs().tz("Asia/Bangkok")`

✅ **Requirement 7:** Calculate each round status dynamically  
   → Implemented: Real-time status calculation in `useEffect` with 1-second updates

✅ **Requirement 8:** Disabled rounds grey/dark and not clickable  
   → Implemented: `isPast` rounds have opacity 0.5, cursor not-allowed, onClick blocked

✅ **Requirement 9:** Open rounds clickable with remaining time  
   → Implemented: Countdown timer shows for open rounds, navigation works

✅ **Requirement 10:** Add console logs during development  
   → Implemented: Comprehensive logging at page and round card levels

---

## 🔍 Technical Notes

### **Time Comparison Methods**
- `now.isSameOrAfter(closeTime)` - Check if current time >= close time (round is past)
- `now.isSameOrAfter(openTime) && now.isBefore(closeTime)` - Check if in betting window
- `now.isBefore(openTime)` - Check if round hasn't opened yet

### **Timezone Handling**
All time operations explicitly use Bangkok timezone:
```typescript
dayjs(round.open_at).tz("Asia/Bangkok")
dayjs().tz("Asia/Bangkok")
```

### **Update Frequency**
Status recalculates every 1 second via `setInterval(updateTimer, 1000)` to ensure:
- Countdowns update smoothly
- Status changes happen exactly when rounds open/close
- No manual refresh needed

---

## 📌 Summary

**Before:** Round status based on backend `is_accepting_bets` field and database `status`  
**After:** Round status calculated in real-time based on time comparison in Bangkok timezone

**Result:** Rounds now correctly display as open/closed based purely on their scheduled times, matching the requirement that "playable rounds must be rounds with time >= current_time" (interpreted as betting window logic).
