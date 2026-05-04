# Lotto Bet Types - API-Driven Configuration

## ✅ Complete - Hardcoded Config Removed

All lotto bet type configuration now comes from the database via GraphQL API.

---

## 📁 Files Changed (2)

### 1. [app/page.tsx](next-apollo-pg-ws/apps/lotto/app/page.tsx)
- ❌ **Removed** hardcoded `FALLBACK_BET_TYPES` array
- ✅ **Added** proper loading state with centered spinner
- ✅ **Added** error state with retry button
- ✅ **Added** `betTypeCode` to cart items for backend validation
- ✅ **Removed** fallback to hardcoded config on API error

### 2. [graphql/resolvers.ts](next-apollo-pg-ws/apps/lotto/graphql/resolvers.ts)
- ✅ **Added** DB validation in `createLottoOrder` mutation
- ✅ **Validates** bet type exists and is active
- ✅ **Validates** number length matches `digit_count` from DB
- ✅ **Validates** price is between `min_bet` and `max_bet` from DB
- ✅ **Uses** DB `payout_rate` instead of trusting frontend
- ✅ **Calculates** `possible_win` from DB payout rate

---

## 🗄️ Database Config Source

### Table: `lotto_bet_types`

**Location:** Already created in migration [3.4__create_dev_draw.sql](next-apollo-pg-ws/db/migrations/3.4__create_dev_draw.sql)

**Columns:**
```sql
id              SERIAL PRIMARY KEY
code            VARCHAR(50) UNIQUE NOT NULL
name_th         VARCHAR(100) NOT NULL
digit_count     INTEGER NOT NULL
payout_rate     NUMERIC NOT NULL
min_bet         NUMERIC DEFAULT 1
max_bet         NUMERIC DEFAULT 2000
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMP DEFAULT NOW()
updated_at      TIMESTAMP DEFAULT NOW()
```

**Seeded with 10 bet types:**
1. THREE_TOP - 3 ตัวบน (900x)
2. THREE_TOD - 3 ตัวโต๊ด (150x)
3. THREE_FRONT - 3 ตัวหน้า (450x)
4. THREE_BOTTOM - 3 ตัวล่าง (450x)
5. TWO_TOP - 2 ตัวบน (90x)
6. TWO_BOTTOM - 2 ตัวล่าง (90x)
7. RUN_TOP - วิ่งบน (3.2x)
8. RUN_BOTTOM - วิ่งล่าง (4.2x)
9. THREE_REVERSE - 3 ตัวกลับ (900x)
10. TWO_REVERSE - 2 ตัวกลับ (2x)

---

## 🔌 GraphQL Query

### Already Exists

**Query:** `lottoBetTypes`

**Schema:**
```graphql
type LottoBetType {
  code: String!
  name_th: String!
  digit_count: Int!
  payout_rate: Float!
  min_bet: Float!
  max_bet: Float!
  is_active: Boolean!
}

type Query {
  lottoBetTypes: [LottoBetType!]!
}
```

**Resolver:**
```typescript
async lottoBetTypes() {
  return await queryLottoDb(
    `SELECT * FROM lotto_bet_types WHERE is_active = true ORDER BY digit_count, code`
  );
}
```

**Client Hook:**
```typescript
import { useLottoBetTypes } from "../graphql/client";

const { data, loading, error } = useLottoBetTypes();
const betTypes = data?.lottoBetTypes || [];
```

---

## 🎨 Frontend Rendering (page.tsx)

### Before (Hardcoded)
```tsx
const FALLBACK_BET_TYPES = [
  { code: "THREE_TOP", name_th: "3 ตัวบน", ... },
  ...
];

let betTypes = betTypesData?.lottoBetTypes;
if (!betTypes || betTypes.length === 0) {
  betTypes = FALLBACK_BET_TYPES; // ❌ Fallback
}
```

### After (API-Driven)
```tsx
const { data, loading, error } = useLottoBetTypes();
const betTypes = data?.lottoBetTypes || [];

// Loading State
if (loading) {
  return <LoadingSpinner />;
}

// Error State
if (error || betTypes.length === 0) {
  return <ErrorMessage />;
}

// Render from API
betTypes.map(type => (
  <button>
    {type.name_th}
    <small>{type.digit_count} หลัก • {type.payout_rate}x</small>
  </button>
))
```

### UI States

**1. Loading (betTypesLoading = true)**
```
┌─────────────────────────────┐
│                             │
│    กำลังโหลดข้อมูล...       │
│                             │
└─────────────────────────────┘
```

**2. Error (betTypesError or betTypes.length === 0)**
```
┌─────────────────────────────┐
│            ⚠️              │
│  ไม่สามารถโหลดประเภทหวยได้  │
│                             │
│  กรุณาลองใหม่อีกครั้งหรือ... │
│                             │
│      [ โหลดใหม่ ]           │
└─────────────────────────────┘
```

**3. Success (betTypes from API)**
```
┌─────────────────────────────┐
│  [ 3 ตัวบน ]  [ 3 ตัวโต๊ด ] │
│  [ 2 ตัวบน ]  [ 2 ตัวล่าง ] │
│  [ วิ่งบน ]   [ วิ่งล่าง ]  │
└─────────────────────────────┘
```

---

## 🛡️ Backend Validation (createLottoOrder)

### Before
```typescript
// Only basic validation
if (!item.bet_type_code || !item.number) {
  throw new Error("Invalid item");
}
if (item.price < 1) {
  throw new Error("Invalid price");
}
// ❌ No validation against DB config
// ❌ Accepts any digit count
// ❌ Accepts any price range
// ❌ Uses frontend payout_rate
```

### After
```typescript
// Load bet types from DB
const betTypesRows = await queryLottoDb(
  `SELECT * FROM lotto_bet_types WHERE is_active = true`
);
const betTypesMap = new Map(betTypesRows.map(bt => [bt.code, bt]));

for (const item of items) {
  // ✅ Validate bet type exists and is active
  const betType = betTypesMap.get(item.bet_type_code);
  if (!betType) {
    throw new Error(`Invalid bet type: ${item.bet_type_code}`);
  }
  
  // ✅ Validate number length matches DB digit_count
  if (item.number.length !== betType.digit_count) {
    throw new Error(`Invalid number length: expected ${betType.digit_count}`);
  }
  
  // ✅ Validate price is within DB min_bet/max_bet
  if (price < betType.min_bet || price > betType.max_bet) {
    throw new Error(`Price must be between ${betType.min_bet} and ${betType.max_bet}`);
  }
  
  // ✅ Use DB payout_rate (not frontend value)
  const payoutRate = betType.payout_rate;
  const possibleWin = price * payoutRate;
  
  // Insert with DB values
  await queryLottoDb(
    `INSERT INTO lotto_order_items (..., payout_rate, possible_win) VALUES (..., $5, $6)`,
    [..., payoutRate, possibleWin]
  );
}
```

### Validation Errors
```
❌ "Invalid bet type: INVALID_CODE not found or inactive"
❌ "Invalid number length for 2 ตัวบน: expected 2 digits, got 3"
❌ "Invalid price for 3 ตัวบน: must be between 1 and 2000"
```

---

## 🧪 How to Test

### 1. Start Application
```bash
cd /Users/s0mkidd/Desktop/Projects/next-apollo-pg-ws/apps/lotto
npm run dev
```

### 2. Verify Database Has Bet Types
```sql
psql -d lotto -c "SELECT code, name_th, digit_count, payout_rate, is_active FROM lotto_bet_types;"
```

Expected: 10 rows with is_active = true

### 3. Test Frontend Loading

**A. Normal Load**
1. Open http://localhost:3000
2. Should see "กำลังโหลดข้อมูล..." briefly
3. Then bet type buttons appear from API

**B. Empty Database**
```sql
psql -d lotto -c "UPDATE lotto_bet_types SET is_active = false;"
```
Reload page → Should show error: "ยังไม่มีการตั้งค่าประเภทหวย"

**C. Network Error**
Stop GraphQL server, reload page → Should show error with retry button

### 4. Test Backend Validation

**A. Invalid Bet Type Code**
```typescript
// Try to submit with fake code
createOrder({
  variables: {
    input: {
      draw_id: 999,
      items: [{ bet_type_code: "FAKE_CODE", number: "22", price: 1 }]
    }
  }
});
```
Expected error: "Invalid bet type: FAKE_CODE not found or inactive"

**B. Wrong Number Length**
```typescript
// Try 3 digits for 2-digit bet type
createOrder({
  variables: {
    input: {
      draw_id: 999,
      items: [{ bet_type_code: "TWO_TOP", number: "123", price: 1 }]
    }
  }
});
```
Expected error: "Invalid number length for 2 ตัวบน: expected 2 digits, got 3"

**C. Price Out of Range**
```typescript
// Try price = 3000 (max is 2000)
createOrder({
  variables: {
    input: {
      draw_id: 999,
      items: [{ bet_type_code: "TWO_TOP", number: "22", price: 3000 }]
    }
  }
});
```
Expected error: "Invalid price for 2 ตัวบน: must be between 1 and 2000"

### 5. Test Admin Can Modify Config

```sql
-- Change payout rate
psql -d lotto -c "UPDATE lotto_bet_types SET payout_rate = 100 WHERE code = 'TWO_TOP';"

-- Disable a bet type
psql -d lotto -c "UPDATE lotto_bet_types SET is_active = false WHERE code = 'RUN_TOP';"
```

Reload frontend → Changes should reflect immediately (no hardcoded fallback)

---

## 📊 Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                                 │
└──────────────────────────────────────────────────────────────────┘

1. Admin Updates Config
   └─> psql: UPDATE lotto_bet_types SET payout_rate = 100

2. Frontend Loads
   └─> GraphQL: query { lottoBetTypes { ... } }
       └─> Resolver: SELECT * FROM lotto_bet_types WHERE is_active = true
           └─> Returns: [{ code: "TWO_TOP", payout_rate: 100, ... }]

3. User Selects Bet Type
   └─> UI shows: "2 ตัวบน • 100x" (from API)
   └─> Validates: number length = 2, price between 1-2000 (from API)

4. User Submits Order
   └─> GraphQL: mutation { createLottoOrder(...) }
       └─> Resolver:
           ├─> Load bet types from DB
           ├─> Validate bet type exists and active
           ├─> Validate number length = digit_count (from DB)
           ├─> Validate price in range (from DB)
           ├─> Calculate possible_win = price × payout_rate (from DB)
           └─> Insert with DB values (not frontend values)

5. Order Saved
   └─> lotto_order_items:
       └─> payout_rate = 100 (from DB, not frontend)
       └─> possible_win = price × 100 (calculated from DB)
```

---

## ✅ Benefits

### 1. **Single Source of Truth**
- Database is the only config source
- No sync issues between code and DB
- Admin can change config without code deploy

### 2. **Security**
- Backend validates all rules from DB
- Frontend can't manipulate payout rates
- Price ranges enforced server-side

### 3. **Flexibility**
- Add new bet types via DB insert
- Change payout rates without code changes
- Enable/disable bet types dynamically
- A/B test different configs

### 4. **Maintainability**
- No duplicate config in frontend/backend
- Changes in one place (database)
- Easier to audit and track changes

### 5. **Better UX**
- Loading states inform user
- Error states with retry option
- No silent fallbacks that hide issues

---

## 🔒 Security Improvements

### Before
```typescript
// ❌ Frontend could send fake payout_rate
{ bet_type_code: "TWO_TOP", payout_rate: 9999, price: 1 }
// Backend would save it: possible_win = 9999 ❌
```

### After
```typescript
// ✅ Backend loads from DB and ignores frontend value
const betType = betTypesMap.get(item.bet_type_code);
const payoutRate = betType.payout_rate; // From DB
const possibleWin = price * payoutRate; // Calculated server-side ✅
```

---

## 🚀 Next Steps (Optional)

### 1. Admin UI for Config Management
Create admin page to manage bet types:
- Add new bet types
- Edit payout rates, min/max bets
- Enable/disable bet types
- Reorder display

### 2. Audit Log
Track config changes:
```sql
CREATE TABLE lotto_bet_type_changes (
  id SERIAL PRIMARY KEY,
  bet_type_code VARCHAR(50),
  field_changed VARCHAR(50),
  old_value TEXT,
  new_value TEXT,
  changed_by INT,
  changed_at TIMESTAMP DEFAULT NOW()
);
```

### 3. A/B Testing
Test different payout rates for different users:
```sql
ALTER TABLE lotto_bet_types
  ADD COLUMN ab_test_group VARCHAR(20),
  ADD COLUMN ab_test_payout_rate NUMERIC;
```

### 4. Scheduled Changes
Support future config changes:
```sql
ALTER TABLE lotto_bet_types
  ADD COLUMN effective_from TIMESTAMP,
  ADD COLUMN effective_to TIMESTAMP;
```

---

## 📝 Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Config Source** | Hardcoded in frontend | Database via API |
| **Fallback** | Silent fallback to hardcoded | Error state with retry |
| **Backend Validation** | Basic (type + price > 1) | Full (type exists, digit count, price range, active) |
| **Payout Rate** | Trusted from frontend | Loaded from DB |
| **Possible Win** | Calculated with frontend rate | Calculated with DB rate |
| **Admin Changes** | Requires code deploy | Database update only |
| **Security** | Frontend can manipulate | Server validates all |
| **UX** | Silent failures | Clear loading/error states |

---

**Status:** ✅ **Complete - API-Driven Configuration**

All bet type configuration now loads from database. Frontend has no hardcoded fallback. Backend validates against DB config.
