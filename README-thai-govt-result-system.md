# Thai Government Lottery Multi-Field Result System

## Overview
Complete implementation of Thai Government lottery result management system with multi-field result entry, safe recalculation, and comprehensive audit logging.

## ✅ Implementation Summary

### 1. Database Schema (Migration File)
**File:** `db/migrations/20260506_thai_government_results.sql`

#### New Tables:
- **`lotto_draw_results`** - Stores detailed lottery results
  - Supports multiple result types: `MAIN_6`, `FRONT_3`, `BACK_3`, `BOTTOM_2`
  - Allows multiple entries per type (e.g., multiple 3-digit front numbers)
  - Indexed on `draw_id` and `result_type` for fast lookups

- **`lotto_result_audit_log`** - Complete audit trail
  - Tracks all result modifications
  - Records who made changes and when
  - Stores previous and new values
  - Flags whether draw was calculated/paid before modification

#### New Columns on `lotto_draws`:
- `last_calculated_at` - Timestamp of last calculation
- `last_calculated_by` - UUID of admin who calculated
- `calculation_count` - Number of times calculated
- `result_modified_after_calc` - Flag indicating result changed after calculation

#### Key Functions:

**`save_thai_government_result()`**
- Validates all input fields (6-digit main, 3-digit front/back, 2-digit bottom)
- Prevents modification if draw is already paid
- Stores results in normalized `lotto_draw_results` table
- Updates main `lotto_draws.result_number` with 6-digit main number
- Automatically logs to audit table
- Flags `result_modified_after_calc` if result is modified post-calculation

**`recalculate_draw_winners()`**
- Safe recalculation with transaction locking
- Resets all `lotto_order_items.is_winner` and `win_amount` before recalculation
- Implements Thai Government lottery logic:
  - **6-digit main**: Full match with main number
  - **3-digit front**: Match with any front_3 numbers
  - **3-digit back**: Match with any back_3 numbers
  - **2-digit bottom**: Match with bottom_2 number
  - **Run top**: Any digit in main number
  - **Run bottom**: Any digit in bottom 2
- Returns warning if draw was already paid
- Does NOT auto-adjust credits if paid (requires manual adjustment)
- Maintains YEEKEE_VIP logic for backward compatibility

**`get_draw_detail()`** (Updated)
- Returns `result_details` JSONB with structured result data
- Includes calculation metadata fields

### 2. GraphQL Schema Extensions
**File:** `apps/lotto/graphql/typeDefs.enhancements.ts`

#### New Types:
```graphql
type ResultDetails {
  main6: [String!]
  front3: [String!]
  back3: [String!]
  bottom2: [String!]
}

type DrawDetail {
  # ... existing fields ...
  resultDetails: ResultDetails
  lastCalculatedAt: String
  calculationCount: Int
  resultModifiedAfterCalc: Boolean
}

input ThaiGovernmentResultInput {
  drawId: Int!
  mainNumber: String!
  front3: [String!]!
  back3: [String!]!
  bottom2: String!
}

type ThaiGovernmentResultPayload {
  success: Boolean!
  message: String!
  draw: DrawDetail
}
```

#### New Mutations:
- `updateThaiGovernmentResult(input: ThaiGovernmentResultInput!): ThaiGovernmentResultPayload!`
- `recalculateDrawWinners(drawId: Int!): WinnerCalculationResult!`

### 3. GraphQL Resolvers
**File:** `apps/lotto/graphql/resolvers.enhancements.ts`

#### Updated Query:
- **`lottoDraw`** - Now returns `resultDetails`, `lastCalculatedAt`, `calculationCount`, `resultModifiedAfterCalc`

#### New Mutations:
- **`updateThaiGovernmentResult`**
  - Extracts admin user ID from JWT token
  - Validates input arrays
  - Calls `save_thai_government_result()` stored procedure
  - Returns updated draw with structured result details

- **`recalculateDrawWinners`**
  - Extracts admin user ID from JWT token
  - Calls `recalculate_draw_winners()` stored procedure
  - Returns warning message if draw was already paid
  - Logs recalculation event

### 4. Admin UI Updates
**File:** `apps/lotto/app/(admin)/admin/draws/[id]/page.tsx`

#### New Features:

**Conditional Result Entry Form:**
- **Thai Government Lottery** (`categoryCode === 'THAI_GOVERNMENT'`):
  - 4 separate input fields:
    - เลขที่ออก (Main 6 digits) - Single input
    - 3 ตัวหน้า (Front 3) - Comma-separated, e.g., "267,318"
    - 3 ตัวล่าง (Back 3) - Comma-separated, e.g., "065,153"
    - 2 ตัวล่าง (Bottom 2) - Single input
  - Real-time preview card showing entered values
  - Client-side validation:
    - Main number: exactly 6 digits
    - Bottom 2: exactly 2 digits
    - Front/Back 3: each number must be 3 digits
    - At least one number required for front and back

- **Other Lotteries** (YEEKEE_VIP, etc.):
  - Single result number input (existing behavior)

**Safety Warnings:**
- **Result Modified Warning** (yellow):
  - Shows if result was modified after calculation
  - Prompts admin to recalculate

- **Already Paid Warning** (red):
  - Shows if draw was already paid
  - Strong warning about not auto-adjusting credits
  - Prevents accidental double payout

**Smart Calculate Button:**
- Text changes based on state:
  - "🧮 คำนวณผู้ชนะ" - Initial calculation
  - "🔄 คำนวณใหม่" - If previously calculated
- Color changes:
  - Orange (#f59e0b) - First calculation
  - Red (#dc2626) - Recalculation (warning color)
- Shows calculation history: "คำนวณล่าสุด: DD/MM/YYYY HH:mm (ครั้งที่ N)"

**Enhanced Confirmation Dialogs:**
- **First Calculation:**
  ```
  ยืนยันคำนวณผู้ถูกรางวัล?
  ระบบจะตรวจสอบโพยทั้งหมดและคำนวณผลชนะ
  ```

- **Recalculation (Not Paid):**
  ```
  ⚠️ งวดนี้เคยคำนวณแล้ว ยืนยันคำนวณใหม่?
  
  ระบบจะ:
  - รีเซ็ตผลการคำนวณเดิม
  - คำนวณผู้ถูกรางวัลใหม่ตามผลรางวัลปัจจุบัน
  - ไม่กระทบเงินที่จ่ายแล้ว (ถ้ามี)
  ```

- **Recalculation (Already Paid):**
  ```
  ⛔ คำเตือนสำคัญ: งวดนี้จ่ายเงินแล้ว
  
  การคำนวณใหม่จะ:
  - รีเซ็ตยอดชนะในระบบ
  - ไม่ดึงเงินคืนอัตโนมัติ
  - อาจต้องทำ adjustment transaction แยก
  
  ยืนยันคำนวณใหม่?
  ```

**Workflow Information Updated:**
- Added recalculation section
- Clarified safety mechanisms
- Warning about manual adjustment needed for paid draws

## 🔒 Safety Mechanisms

### 1. Database Level
- ✅ Transaction locking with `FOR UPDATE` on draw record
- ✅ Check `is_paid` status before allowing modifications
- ✅ Validate all input formats with regex
- ✅ Complete audit trail with before/after snapshots
- ✅ Prevent duplicate payment through `is_paid` flag

### 2. Application Level
- ✅ Admin authentication required (JWT with role check)
- ✅ Client-side input validation
- ✅ Server-side validation in stored procedure
- ✅ Confirmation dialogs with clear warnings
- ✅ Visual indicators for dangerous operations

### 3. Business Logic
- ✅ Recalculation resets all win flags before recalculating
- ✅ No automatic credit reversal for paid draws
- ✅ Flag set when result modified after calculation
- ✅ Calculation count tracking
- ✅ Admin user tracking for all operations

## 📊 Data Flow

### Saving Thai Government Result:
```
Admin Form → GraphQL Mutation → JWT Auth Check → 
save_thai_government_result() → Validate Inputs → 
Delete Old Results → Insert New Results → 
Update lotto_draws → Audit Log → Return Success
```

### Recalculating Winners:
```
Admin Button → Confirmation Dialog → GraphQL Mutation → 
JWT Auth Check → recalculate_draw_winners() → 
Lock Draw → Reset is_winner/win_amount → 
Load Result Details → Loop Orders → Loop Items → 
Check Win Conditions → Update Items → Update Orders → 
Update Draw Summary → Audit Log → Return Result + Warning
```

## 🚀 Deployment Steps

### 1. Run Database Migration
```bash
cd /Users/s0mkidd/Desktop/Projects/next-apollo-pg-ws
psql -U app -d lotto -f db/migrations/20260506_thai_government_results.sql
```

Verify tables and functions:
```sql
-- Check tables
\dt lotto_draw_results
\dt lotto_result_audit_log

-- Check functions
\df save_thai_government_result
\df recalculate_draw_winners
\df get_draw_detail

-- Check new columns
\d lotto_draws
```

### 2. Restart Application
```bash
cd apps/lotto
npm run build
npm run start  # or restart your production process
```

### 3. Test Workflow
1. Navigate to `/admin/draws`
2. Click on a Thai Government lottery draw (or create one via `/admin/lotto-config`)
3. Test result entry:
   - เลขที่ออก: 536077
   - 3 ตัวหน้า: 267,318,490
   - 3 ตัวล่าง: 065,153,782
   - 2 ตัวล่าง: 43
4. Click "✅ บันทึกผลรางวัล"
5. Click "🧮 คำนวณผู้ชนะ"
6. Verify results in summary card
7. Test recalculation:
   - Modify result
   - Click "🔄 คำนวณใหม่" (button should be red)
   - Verify warning dialogs
8. Test payment (if applicable)

## ⚠️ Important Notes

### DO NOT Break These Features:
- ✅ User play page - Unaffected
- ✅ Submit order - Unaffected
- ✅ Slips page - Unaffected
- ✅ Deposit/Withdraw - Unaffected
- ✅ YEEKEE result flow - Maintained backward compatibility

### Manual Adjustment Required:
If a draw was **paid** and result was **incorrect**, you must:
1. Record the error in audit log (automatically done)
2. Recalculate to get new winners
3. Create manual `ADMIN_ADJUST` transactions in `lotto_credit_transactions` for:
   - Deduct incorrect payouts
   - Add correct payouts
4. Document in `notes` field of adjustment transactions

### Audit Log Query Examples:
```sql
-- View all result modifications for a draw
SELECT * FROM lotto_result_audit_log
WHERE draw_id = 123
ORDER BY created_at DESC;

-- Find all recalculations after payment
SELECT * FROM lotto_result_audit_log
WHERE action = 'RECALCULATE' AND was_paid = TRUE;

-- Find draws with modified results after calculation
SELECT d.*, l.created_at as last_audit
FROM lotto_draws d
LEFT JOIN lotto_result_audit_log l ON d.id = l.draw_id
WHERE d.result_modified_after_calc = TRUE;
```

## 🎯 Build Status

✅ **Build Successful**
- Route `/admin/draws/[id]`: 6.45 kB (increased from 4.51 kB due to new features)
- No TypeScript errors
- All GraphQL types properly merged
- All resolvers implemented
- All UI components functional

## 📝 File Summary

### Created:
1. `/db/migrations/20260506_thai_government_results.sql` (683 lines)
2. `/README-thai-govt-result-system.md` (this file)

### Modified:
1. `/apps/lotto/graphql/typeDefs.enhancements.ts` - Added Thai Government types
2. `/apps/lotto/graphql/resolvers.enhancements.ts` - Added Thai Government resolvers
3. `/apps/lotto/app/(admin)/admin/draws/[id]/page.tsx` - Complete UI overhaul

## 🔐 Security Checklist

- ✅ JWT authentication required for all mutations
- ✅ Admin role validation
- ✅ SQL injection prevention (parameterized queries)
- ✅ Input validation (client + server)
- ✅ Transaction safety (database locks)
- ✅ Audit logging for all changes
- ✅ No credit manipulation without audit trail

## 📞 Support Information

If issues arise:
1. Check audit log: `SELECT * FROM lotto_result_audit_log ORDER BY created_at DESC LIMIT 20;`
2. Check draw state: `SELECT * FROM get_draw_detail(draw_id);`
3. Check calculation count: `SELECT id, code, calculation_count, result_modified_after_calc FROM lotto_draws WHERE id = draw_id;`
4. Review GraphQL logs in terminal for error messages

## ✨ Future Enhancements

Potential improvements (not implemented):
- [ ] Bulk result import from official lottery API
- [ ] Automated result verification against external source
- [ ] SMS/Email notification to winners
- [ ] Automatic adjustment transaction creation UI
- [ ] Result history comparison view
- [ ] Winner announcement page for users
- [ ] Export calculation report to PDF

---

**Status:** ✅ Complete and Production Ready
**Date:** May 6, 2026
**Version:** 1.0.0
