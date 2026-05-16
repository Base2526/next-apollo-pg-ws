# Order Status Flow & Refund System Implementation

**Date:** May 7, 2026  
**Status:** ✅ Complete  
**Issue:** โพยที่ยังไม่ได้รับแสดงเป็น "รอตรวจ" แทนที่จะเป็น "รอยืนยัน" และไม่มีระบบคืนเงินโพยหมดเวลา

---

## 📋 Changes Summary

### 1. Database Schema Changes

**File:** `/db/migrations/20260507_add_order_status_flow.sql`

- ✅ อัพเดท existing `pending` orders เป็น `pending_confirm`
- ✅ เพิ่ม column `approved_at` (timestamp เมื่อ admin รับโพย)
- ✅ เพิ่ม column `refunded_at` (timestamp เมื่อคืนเงิน)
- ✅ เพิ่ม column `refund_reason` (เหตุผลการคืนเงิน)
- ✅ เพิ่ม index สำหรับ query expired pending orders

**Status Columns:**
- `status` → Order workflow: `pending_confirm | approved | refunded | rejected`
- `result_status` → Win/loss result: `pending | won | lost | paid | refunded`

### 2. Refund Service

**File:** `/apps/lotto/services/refundService.ts`

**Functions:**
- `refundOrder(orderId, reason, adminUserId)` - คืนเงินโพยเดี่ยว
- `refundExpiredPendingOrders()` - หาและคืนเงินโพยที่หมดเวลาอัตโนมัติ
- `scheduleAutoRefund()` - สำหรับ cron job

**Features:**
- ✅ Transaction-safe (ใช้ FOR UPDATE เพื่อ lock row)
- ✅ Idempotent (ห้าม refund ซ้ำ)
- ✅ อัพเดท user credit
- ✅ สร้าง credit transaction record
- ✅ Debug logging ตาม spec

### 3. GraphQL Updates

**TypeDefs Updates:** `/apps/lotto/graphql/typeDefs.ts`
- ✅ เพิ่ม `status` field ใน `DashboardRecentSlip`
- ✅ เพิ่ม `closeAt` field ใน `DashboardRecentSlip`
- ✅ เพิ่ม type `RefundResult` และ `RefundSummary`
- ✅ เพิ่ม mutation `refundOrder`
- ✅ เพิ่ม mutation `refundExpiredPendingOrders`

**Resolvers Updates:** `/apps/lotto/graphql/resolvers.ts`
- ✅ `createLottoOrder` → ใช้ `status='pending_confirm'` และ `result_status='pending'`
- ✅ `approveSlip` → อัพเดท `status='approved'` (แทน result_status)
- ✅ `approveSlip` → เช็คว่างวด/รอบยังไม่ปิดก่อนอนุมัติ
- ✅ `refundOrder` → resolver ใหม่สำหรับคืนเงินด้วยตนเอง
- ✅ `refundExpiredPendingOrders` → resolver ใหม่สำหรับคืนเงินอัตโนมัติ
- ✅ `adminDashboard` → query ดึง `status` และ `close_at`

**Mutations Updates:** `/apps/lotto/graphql/mutations.ts`
- ✅ อัพเดท `APPROVE_SLIP` mutation ให้ return `status`
- ✅ เพิ่ม `REFUND_ORDER` mutation
- ✅ เพิ่ม `REFUND_EXPIRED_PENDING_ORDERS` mutation

### 4. UI Component Updates

**Slip Helpers:** `/apps/lotto/lib/slipHelpers.ts`
- ✅ แยก `STATUS_LABELS` (order status) และ `RESULT_STATUS_LABELS` (result status)
- ✅ อัพเดท `getSlipStatusLabel()` ให้รับ 2 parameters
- ✅ อัพเดท `getSlipStatusColor()` ให้รับ 2 parameters
- ✅ แสดง status ตามลำดับความสำคัญที่ถูกต้อง

**Status Labels:**
```
pending_confirm → "รอยืนยัน" (orange)
approved → "รับโพยแล้ว" (blue)
refunded → "คืนเงินแล้ว" (default/gray)
rejected → "ปฏิเสธ" (red)
won → "ถูกรางวัล" (green)
lost → "ไม่ถูกรางวัล" (default)
paid → "จ่ายเงินแล้ว" (green)
```

**Recent Slips Table:** `/apps/lotto/components/admin/RecentSlipsTable.tsx`
- ✅ ใช้ `getSlipStatusLabel(status, resultStatus)` แทน direct mapping
- ✅ แสดงปุ่ม "รับโพย" เฉพาะ `status='pending_confirm'` และยังไม่หมดเวลา
- ✅ แสดงปุ่ม "คืนเงิน" สำหรับ `status='pending_confirm'` ที่หมดเวลาแล้ว
- ✅ แสดง status indicator สำหรับ approved/refunded/rejected orders
- ✅ เพิ่ม `refundOrder` mutation

### 5. Calculation Function Updates

**File:** `/db/migrations/20260507_update_calculation_functions.sql`

⚠️ **MANUAL ACTION REQUIRED:**
- ต้องอัพเดท stored procedures ที่คำนวณผลหวย
- เพิ่มเงื่อนไข `WHERE o.status = 'approved'` ในทุก query
- Functions ที่ต้องแก้:
  - `calculate_draw_winners()`
  - `recalculate_draw_winners()`
  - `save_thai_government_result()`
  - ฟังก์ชันอื่นๆ ที่ query lotto_orders

---

## 🔄 Status Flow

### User Flow:
1. **User ส่งโพย** → `status='pending_confirm'`, `result_status='pending'` → แสดง "รอยืนยัน"
2. **Admin รับโพย** → `status='approved'` → แสดง "รับโพยแล้ว"  
3. **ออกผล** → `result_status='won'/'lost'` → แสดง "ถูกรางวัล"/"ไม่ถูกรางวัล"
4. **จ่ายเงิน** → `result_status='paid'` → แสดง "จ่ายเงินแล้ว"

### Refund Flow:
1. **หมดเวลา** → Auto/Manual refund → `status='refunded'`, `result_status='refunded'` → แสดง "คืนเงินแล้ว"
2. **Credit คืน** → User credit += order amount
3. **Transaction** → สร้าง credit transaction type='BET_REFUND'

---

## 🔧 How to Use

### 1. Run Database Migration
```bash
# Run migration to add new columns and indexes
psql -U postgres -d lotto_db -f db/migrations/20260507_add_order_status_flow.sql
```

### 2. Update Calculation Functions (Manual)
```bash
# Review and update your stored procedures
psql -U postgres -d lotto_db -f db/migrations/20260507_update_calculation_functions.sql
```

### 3. Test Order Creation
```typescript
// New orders will automatically use status='pending_confirm'
const order = await createLottoOrder({
  draw_id: 123,
  category_code: 'YEEKEE_VIP',
  items: [{ bet_type_code: '3_TOP', number: '123', price: 1 }]
});
// order.status === 'pending_confirm'
// order.result_status === 'pending'
```

### 4. Admin Approve Order
```graphql
mutation {
  approveSlip(orderId: "123") {
    id
    orderNo
    status        # "approved"
    resultStatus  # "pending"
  }
}
```

### 5. Manual Refund
```graphql
mutation {
  refundOrder(
    orderId: "123"
    reason: "Admin คืนเงินด้วยตัวเอง"
  ) {
    id
    status        # "refunded"
    totalAmount   # จำนวนที่คืน
  }
}
```

### 6. Auto Refund Expired Orders
```graphql
mutation {
  refundExpiredPendingOrders {
    totalProcessed
    totalRefunded
    totalAmount
    errors
  }
}
```

### 7. Setup Cron Job (Optional)
```typescript
// In your server or separate cron service
import { scheduleAutoRefund } from './services/refundService';

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  await scheduleAutoRefund();
});
```

---

## ✅ Testing Checklist

### Database
- [ ] Migration ทำงานสำเร็จ
- [ ] Columns ใหม่ถูกสร้าง (approved_at, refunded_at, refund_reason)
- [ ] Index ถูกสร้าง (idx_lotto_orders_pending_confirm)
- [ ] Existing orders ถูก migrate เป็น pending_confirm

### Backend
- [ ] New orders ใช้ status='pending_confirm'
- [ ] approveSlip ปรับ status เป็น 'approved'
- [ ] approveSlip เช็คว่างวดยังไม่ปิด
- [ ] refundOrder คืนเงินได้ถูกต้อง
- [ ] refundExpiredPendingOrders หาโพยหมดเวลาได้
- [ ] Credit transactions ถูกสร้างครบ
- [ ] Debug logs แสดงตาม spec

### Frontend
- [ ] โพยใหม่แสดง "รอยืนยัน" (pending_confirm)
- [ ] โพยที่รับแล้วแสดง "รับโพยแล้ว" (approved)
- [ ] โพยที่คืนแล้วแสดง "คืนเงินแล้ว" (refunded)
- [ ] ปุ่ม "รับโพย" แสดงเฉพาะ pending_confirm + ยังไม่หมดเวลา
- [ ] ปุ่ม "คืนเงิน" แสดงเฉพาะ pending_confirm + หมดเวลาแล้ว
- [ ] Modal confirm ทำงานถูกต้อง

### Calculation
- [ ] เฉพาะ orders ที่ status='approved' ถูกคำนวณรางวัล
- [ ] Orders ที่ refunded ไม่ถูกคำนวณ
- [ ] Orders ที่ pending_confirm ไม่ถูกคำนวณ

---

## 🐛 Known Issues & Edge Cases

### 1. โพยที่ถูกรับหลังปิดรับแล้ว
**ปัญหา:** Admin กดรับโพยหลังจากงวดปิดรับแล้ว  
**Solution:** ✅ แก้ไขแล้ว - เช็ค `draw.close_at` ใน approveSlip resolver  
**Error:** "ไม่สามารถรับโพยได้ เนื่องจากงวด/รอบปิดรับแล้ว กรุณาคืนเงินแทน"

### 2. Race Condition ในการ Refund
**ปัญหา:** 2 admins พยายาม refund order เดียวกันพร้อมกัน  
**Solution:** ✅ แก้ไขแล้ว - ใช้ `FOR UPDATE` ใน refundService  
**Result:** Transaction แรกจะ lock row, transaction ที่สองจะรอหรือ error

### 3. Legacy Orders
**ปัญหา:** Orders เก่าที่ยังใช้ status='pending' แทน 'pending_confirm'  
**Solution:** ✅ Migration จะ convert อัตโนมัติ  
**Note:** ตรวจสอบ UI ว่ารองรับทั้ง 'pending' และ 'pending_confirm'

### 4. Calculation Functions
**ปัญหา:** Stored procedures ยังใช้ query แบบเก่าที่ไม่ filter status  
**Solution:** ⚠️ ต้องแก้ manual ตามไฟล์ migration  
**Impact:** หาก calculated ก่อนแก้ -> ต้อง recalculate ใหม่

---

## 📊 Monitoring & Logs

### Debug Logs to Watch:
```
[REFUND_PENDING_EXPIRED_DEBUG] - รายละเอียด order ที่ถูก refund
[REFUND_SUCCESS] - สรุปการ refund สำเร็จ
[REFUND_ERROR] - error ในการ refund
[AUTO_REFUND_JOB] - ผลการ run auto refund
[CREATE_ORDER_ITEM_DEBUG] - debug การสร้าง order
[BACKEND_ORDER_SUCCESS] - order สร้างสำเร็จ
```

### Metrics to Monitor:
- จำนวน pending_confirm orders ที่ยังไม่หมดเวลา
- จำนวน refunded orders ต่อวัน
- จำนวนเงินที่ refund ต่อวัน
- Average time to approve (approved_at - created_at)
- Orders ที่หมดเวลาแล้วยังไม่ถูก refund (potential issues)

---

## 🚀 Next Steps (Optional Enhancements)

1. **Email/SMS Notification**
   - แจ้งเตือน user เมื่อโพยถูก refund
   - แจ้งเตือน admin เมื่อมีโพยใหม่รอยืนยัน

2. **Auto Approval**
   - Auto approve โพยที่ผ่านเงื่อนไขบางอย่าง (เช่น จำนวนเงินต่ำ)
   - ลด manual work ของ admin

3. **Batch Refund UI**
   - หน้า admin สำหรับ refund หลายโพยพร้อมกัน
   - Filter และ bulk action

4. **Analytics Dashboard**
   - แสดงสถิติ refund rate
   - แสดงเวลาเฉลี่ยในการรับโพย
   - แสดง conversion rate (pending → approved)

5. **Scheduled Refund Job**
   - Setup cron job ให้ run `refundExpiredPendingOrders` ทุก 5-15 นาที
   - Monitor job health

---

## 📝 Documentation

- Database schema: [lotto-07052026.sql](../lotto-07052026.sql)
- Migration files: [/db/migrations/](../db/migrations/)
- Service layer: [/apps/lotto/services/refundService.ts](../apps/lotto/services/refundService.ts)
- GraphQL schema: [/apps/lotto/graphql/typeDefs.ts](../apps/lotto/graphql/typeDefs.ts)
- Resolvers: [/apps/lotto/graphql/resolvers.ts](../apps/lotto/graphql/resolvers.ts)
- UI components: [/apps/lotto/components/admin/RecentSlipsTable.tsx](../apps/lotto/components/admin/RecentSlipsTable.tsx)

---

## 👥 Contributors

- Implementation Date: May 7, 2026
- Implemented by: GitHub Copilot + User
- Reviewed by: TBD
- Deployed to: TBD

---

## 📞 Support

หากพบปัญหาหรือมีคำถาม:
1. ตรวจสอบ debug logs ใน console/server logs
2. ตรวจสอบ database ว่า migration ทำงานถูกต้อง
3. ตรวจสอบ stored procedures ว่าอัพเดทแล้ว
4. ตรวจสอบ credit transactions ว่าถูกสร้างครบ

---

**Status:** ✅ Implementation Complete - Ready for Testing
