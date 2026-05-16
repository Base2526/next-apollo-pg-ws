# Admin Draw Management System - Implementation Complete ✅

## 🎯 Overview

ระบบจัดการงวดหวยสำหรับ Admin ที่ครบถ้วน รองรับ:
- **หวยรัฐบาลไทย**: 1 งวด/วัน
- **จับยี่กี VIP**: 88 รอบ/วัน (ทุก 15 นาที)

## ✅ Features Completed

### 1. Database Functions
- ✅ `pay_draw_winners()` - จ่ายเงินให้ผู้ชนะพร้อม transaction safety
- ✅ `get_draw_detail()` - ดึงรายละเอียดงวดพร้อม summary
- ✅ Payment tracking (is_paid, paid_at, paid_by)
- ✅ Audit logging (lotto_payment_logs table)
- ✅ Double payment prevention
- ✅ Automatic credit transaction creation

### 2. GraphQL API
**Queries:**
- ✅ `adminDraws(filter, pagination)` - รายการงวดทั้งหมดพร้อม filter
- ✅ `lottoDraw(id)` - รายละเอียดงวดเดี่ยว

**Mutations:**
- ✅ `generateLottoDraws()` - สร้างงวดล่วงหน้า (YEEKEE_VIP + THAI_GOVERNMENT)
- ✅ `updateDrawResult()` - บันทึกผลรางวัล
- ✅ `calculateDrawWinners()` - คำนวณผู้ชนะ
- ✅ `payDrawWinners()` - จ่ายเงินให้ผู้ชนะ

### 3. Admin UI Pages
- ✅ `/admin/draws` - รายการงวดพร้อมฟีลเตอร์และ pagination
- ✅ `/admin/draws/[id]` - รายละเอียดงวด + จัดการผล + จ่ายเงิน
- ✅ `/admin/lotto-config` - สร้างงวดล่วงหน้า (already existed, enhanced)
- ✅ Admin menu link "Draws" added

---

## 📦 Files Created/Modified

### Database Migrations
```
db/migrations/20260505_draw_payment_system.sql
```
**Features:**
- Payment tracking columns (is_paid, paid_at, paid_by)
- pay_draw_winners() function with transaction safety
- get_draw_detail() function with permissions check
- lotto_payment_logs table for audit trail
- Auto-logging trigger
- Constraint: cannot mark as paid without result

### GraphQL Schema
```
apps/lotto/graphql/typeDefs.enhancements.ts
```
**Added Types:**
- DrawDetail (with permissions: canSetResult, canCalculate, canPay)
- UpdateDrawResultInput
- PayWinnersResult

### GraphQL Resolvers
```
apps/lotto/graphql/resolvers.enhancements.ts
```
**Added Resolvers:**
- Query: lottoDraw
- Mutation: updateDrawResult
- Mutation: payDrawWinners

### Admin UI
```
apps/lotto/app/(admin)/admin/draws/page.tsx
apps/lotto/app/(admin)/admin/draws/[id]/page.tsx
apps/lotto/components/AdminHeader.tsx (modified)
```

---

## 🚀 Deployment Steps

### Step 1: Run Database Migration

```bash
cd /Users/s0mkidd/Desktop/Projects/next-apollo-pg-ws

# Connect to PostgreSQL
psql -U app -d lotto -h localhost -p 5432

# Run migration
\i db/migrations/20260505_draw_payment_system.sql

# Verify functions exist
\df pay_draw_winners
\df get_draw_detail

# Check payment logs table
\d lotto_payment_logs
```

### Step 2: Verify Tables

```sql
-- Check new columns on lotto_draws
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'lotto_draws' 
  AND column_name IN ('is_paid', 'paid_at', 'paid_by');

-- Should return 3 rows

-- Check payment logs table exists
SELECT COUNT(*) FROM lotto_payment_logs;
```

### Step 3: Deploy Application

```bash
cd /Users/s0mkidd/Desktop/Projects/next-apollo-pg-ws/apps/lotto

# Already built and verified
npm run build

# Start production
npm start

# Or for development
npm run dev
```

---

## 🎮 How to Use

### Workflow: จัดการงวดหวยใหม่

#### 1. สร้างงวดล่วงหน้า
1. Go to: **Admin → Lotto Config** (`/admin/lotto-config`)
2. เลือกประเภทหวย (YEEKEE_VIP / THAI_GOVERNMENT)
3. เลือกช่วงวันที่
4. กด **สร้างรอบหวย**

#### 2. ดูรายการงวด
1. Go to: **Admin → Draws** (`/admin/draws`)
2. ใช้ filter:
   - ประเภทหวย
   - ช่วงวันที่
   - สถานะผล (รอผล / มีผลแล้ว)
3. กด **จัดการ** เพื่อเข้าสู่รายละเอียด

#### 3. บันทึกผลรางวัล
1. เข้าหน้ารายละเอียดงวด (`/admin/draws/[id]`)
2. ในส่วน **"📝 บันทึกผลรางวัล"**:
   - กรอกหมายเลขผลรางวัล
   - YEEKEE_VIP: 3 หลัก (เช่น 123)
   - THAI_GOVERNMENT: 6 หลัก (เช่น 123456)
3. กด **✅ บันทึกผล**

#### 4. คำนวณผู้ชนะ
1. หลังบันทึกผลแล้ว กด **🧮 คำนวณผู้ชนะ**
2. ระบบจะ:
   - ตรวจสอบโพยทั้งหมด
   - คำนวณผลชนะตามประเภทการแทง
   - อัพเดท is_winner และ win_amount
   - แสดงยอดจ่ายรวม

#### 5. จ่ายเงินให้ผู้ชนะ
1. กด **💰 จ่ายเงินให้ผู้ชนะ**
2. ยืนยันการจ่ายเงิน
3. ระบบจะ:
   - ✅ เพิ่มเครดิตให้ผู้ชนะทันที
   - ✅ สร้าง credit transaction (type: WIN_PAYOUT)
   - ✅ ทำเครื่องหมาย is_win_paid = true
   - ✅ อัพเดท draw.is_paid = true
   - ✅ บันทึก audit log
4. ⚠️ **หลังจ่ายเงินแล้ว ไม่สามารถยกเลิกได้!**

---

## 🔒 Safety Features

### 1. Double Payment Prevention
```sql
-- Function checks if draw is already paid
IF v_draw_is_paid = true THEN
  RAISE EXCEPTION 'Draw has already been paid';
END IF;

-- Lock orders to prevent concurrent payment
FOR UPDATE OF o
```

### 2. Transaction Safety
- All operations in single transaction
- Rollback on any error
- Row-level locking for user balance updates

### 3. Audit Trail
- `lotto_payment_logs` table tracks all payments
- Records: admin, orders paid, amount, timestamp
- Automatic trigger on draw.is_paid update

### 4. Validation
- Cannot pay before result is set
- Cannot pay before winner calculation
- Cannot mark as paid without result_number (constraint)

### 5. Status Flow
```
PENDING → OPEN → CLOSED → RESULTED → PAID
                           ↓
                   (must calculate winners first)
```

---

## 📊 Database Schema Reference

### lotto_draws (Extended)
```sql
-- New columns
is_paid BOOLEAN DEFAULT false
paid_at TIMESTAMPTZ NULL
paid_by UUID NULL REFERENCES lotto_users(id)

-- Constraint
CHECK (is_paid = false OR result_number IS NOT NULL)
```

### lotto_orders (Existing)
```sql
total_win NUMERIC(12,2) DEFAULT 0.00
is_win_paid BOOLEAN DEFAULT false
```

### lotto_credit_transactions (Existing)
```sql
type 'WIN_PAYOUT' -- For winner payments
direction 'IN' -- Credit increase
ref_type 'ORDER'
ref_id -- Order ID
```

### lotto_payment_logs (New)
```sql
id UUID PRIMARY KEY
draw_id INT NOT NULL
admin_user_id UUID NULL
paid_orders INT NOT NULL
paid_amount NUMERIC(12,2) NOT NULL
transactions_created INT NOT NULL
status VARCHAR(30) -- 'SUCCESS', 'FAILED', 'PARTIAL'
error_message TEXT NULL
created_at TIMESTAMPTZ NOT NULL
```

---

## 🧪 Testing Scenarios

### Scenario 1: YEEKEE_VIP Complete Flow

```bash
# 1. Create draws
Mutation: generateLottoDraws
Input: { categoryCode: "YEEKEE_VIP", startDate: "2026-05-06", endDate: "2026-05-06" }
Expected: 88 draws created

# 2. Set result for round 1
Mutation: updateDrawResult
Input: { drawId: 123, resultNumber: "456" }
Expected: result_status = 'resulted'

# 3. Calculate winners
Mutation: calculateDrawWinners
Input: { drawId: 123 }
Expected: Orders and items updated with is_winner and win_amount

# 4. Pay winners
Mutation: payDrawWinners
Input: { drawId: 123 }
Expected: 
- Users receive credit
- Transactions created
- draw.is_paid = true
- Audit log created
```

### Scenario 2: Thai Lottery Complete Flow

```bash
# 1. Create draws (1st & 16th of May)
Mutation: generateLottoDraws
Input: { 
  categoryCode: "THAI_GOVERNMENT", 
  startDate: "2026-05-01", 
  endDate: "2026-05-31",
  autoGenerate: true 
}
Expected: 2 draws created

# 2. Set result
Mutation: updateDrawResult
Input: { drawId: 456, resultNumber: "123456" }

# 3. Calculate + Pay (same as YEEKEE_VIP)
```

### Scenario 3: Error Cases

```bash
# Try to pay without result
Mutation: payDrawWinners
Input: { drawId: 999 }
Expected: ERROR "Draw must have status resulted"

# Try to pay twice
Mutation: payDrawWinners (2nd time)
Input: { drawId: 123 }
Expected: ERROR "Draw has already been paid"

# Invalid result number
Mutation: updateDrawResult
Input: { drawId: 123, resultNumber: "" }
Expected: Validation error
```

---

## 🎯 API Examples

### Query: Get Draw List
```graphql
query AdminDraws {
  adminDraws(
    filter: {
      categoryCode: "YEEKEE_VIP"
      dateFrom: "2026-05-01"
      dateTo: "2026-05-31"
      resultStatus: "pending"
    }
    pagination: {
      page: 1
      pageSize: 20
    }
  ) {
    total
    items {
      id
      code
      drawDate
      roundNo
      status
      resultNumber
      totalOrders
      totalSales
      totalPayout
      profit
    }
  }
}
```

### Query: Get Draw Detail
```graphql
query LottoDraw {
  lottoDraw(id: 123) {
    id
    code
    categoryCode
    categoryName
    drawDate
    resultNumber
    totalOrders
    totalBetAmount
    totalWinningAmount
    totalWinners
    profitLoss
    canSetResult
    canCalculate
    canPay
    isPaid
  }
}
```

### Mutation: Update Result
```graphql
mutation UpdateResult {
  updateDrawResult(input: {
    drawId: 123
    resultNumber: "456"
  }) {
    success
    message
    draw {
      id
      resultNumber
      resultStatus
    }
  }
}
```

### Mutation: Calculate Winners
```graphql
mutation Calculate {
  calculateDrawWinners(drawId: 123) {
    success
    message
    updatedOrders
    updatedItems
    totalPayout
  }
}
```

### Mutation: Pay Winners
```graphql
mutation Pay {
  payDrawWinners(drawId: 123) {
    success
    message
    paidOrders
    paidAmount
    transactions
  }
}
```

---

## 🔍 Troubleshooting

### Issue: Function not found
```
ERROR: function pay_draw_winners(integer, uuid) does not exist
```

**Solution**: Run migration:
```bash
psql -U app -d lotto < db/migrations/20260505_draw_payment_system.sql
```

### Issue: Cannot pay - already paid
```
ERROR: Draw has already been paid
```

**Solution**: This is by design. Check `draw.is_paid` and `lotto_payment_logs`:
```sql
SELECT * FROM lotto_draws WHERE id = 123;
SELECT * FROM lotto_payment_logs WHERE draw_id = 123;
```

### Issue: GraphQL error
```
Cannot query field "lottoDraw" on type "Query"
```

**Solution**: Restart Next.js server:
```bash
npm run dev
```

### Issue: Users not receiving credit
```sql
-- Check if payment ran successfully
SELECT * FROM lotto_payment_logs WHERE draw_id = 123;

-- Check credit transactions
SELECT * FROM lotto_credit_transactions 
WHERE ref_type = 'ORDER' 
  AND ref_id IN (
    SELECT id::TEXT FROM lotto_orders WHERE draw_id = 123
  );

-- Check user balance
SELECT id, phone, credit 
FROM lotto_users 
WHERE id IN (SELECT user_id FROM lotto_orders WHERE draw_id = 123);
```

---

## 📈 Performance Considerations

### Indexes Already Created
```sql
-- Draw payment lookups
idx_lotto_draws_unpaid (result_status, is_paid)

-- Order payment lookups  
idx_orders_unpaid_wins (result_status, is_win_paid)

-- Payment logs
idx_payment_logs_draw_id
idx_payment_logs_created_at
```

### Query Optimization
- Uses `FOR UPDATE` for row-level locking
- Single transaction reduces round trips
- Batch processing in database function
- Prepared statements via GraphQL resolvers

---

## 🎁 Bonus Features Included

1. **Detailed Summary Dashboard**
   - Total orders, sales, payout, winners
   - Profit/loss calculation
   - Color-coded indicators

2. **Permission System**
   - canSetResult
   - canCalculate
   - canPay
   - Prevents wrong order operations

3. **Responsive UI**
   - Mobile-friendly
   - Clean design
   - Loading states
   - Error handling

4. **Audit Trail**
   - Who paid when
   - How much was paid
   - Transaction IDs
   - Automatic logging

---

## ✅ Production Checklist

- [x] Database migration tested
- [x] GraphQL schema extended
- [x] Resolvers implemented with admin auth
- [x] UI pages created
- [x] Menu navigation added
- [x] Build successful
- [x] Double payment prevention
- [x] Transaction safety
- [x] Audit logging
- [x] Error handling
- [x] Permission checks

---

## 📞 Next Steps (Optional Enhancements)

### 1. Email Notifications
Send email when winners are paid:
```typescript
await sendEmail({
  to: user.email,
  subject: 'คุณถูกรางวัล!',
  body: `ยินดีด้วย! คุณได้รับเงิน ${winAmount} บาท`
});
```

### 2. SMS Notifications
Notify via SMS for large wins.

### 3. Export Reports
Add export to Excel/CSV for payment records.

### 4. Scheduled Auto-Payment
Cron job to auto-pay after result is set:
```bash
0 * * * * curl -X POST /api/admin/auto-pay-draws
```

### 5. Multi-Admin Approval
Require 2 admins to approve large payouts (> 100k THB).

---

## 🎉 Summary

ระบบ Admin Draw Management ครบถ้วนพร้อมใช้งาน:
- ✅ สร้างงวดล่วงหน้า
- ✅ บันทึกผลรางวัล
- ✅ คำนวณผู้ชนะอัตโนมัติ
- ✅ จ่ายเงินพร้อม safety checks
- ✅ Audit trail ครบถ้วน
- ✅ UI ใช้งานง่าย
- ✅ Production-ready

**Build Size:**
- `/admin/draws` - 2.99 kB
- `/admin/draws/[id]` - 4.51 kB

**Total Routes Added:** 2 new admin pages + GraphQL extensions

**Database Impact:** +1 table, +3 functions, +4 columns

**All safety features in place. Ready for production! 🚀**
