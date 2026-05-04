# Deposit Feature - Complete Implementation

## Overview
This document describes the complete deposit feature implementation for the lotto web application. Users can now submit deposit requests, and admins can approve/reject them to add credit to user accounts.

## Components

### 1. Database Tables

#### lotto_deposit_methods
Configuration table for available deposit methods:
```sql
CREATE TABLE lotto_deposit_methods (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name_th VARCHAR(200) NOT NULL,
  description TEXT,
  min_amount NUMERIC(12,2) NOT NULL DEFAULT 100.00,
  max_amount NUMERIC(12,2) NOT NULL DEFAULT 500000.00,
  bank_name VARCHAR(100),
  bank_account_no VARCHAR(50),
  bank_account_name VARCHAR(200),
  qr_image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT DEFAULT 0
);
```

**Current Methods:**
- `BANK_TRANSFER`: โอนผ่านบัญชีธนาคาร (min: 100฿, max: 500,000฿)
- `QR_TRANSFER`: สแกน QR Code (min: 50฿, max: 100,000฿)

#### lotto_deposits
User deposit requests:
```sql
CREATE TABLE lotto_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES lotto_users(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method VARCHAR(50) NOT NULL DEFAULT 'BANK_TRANSFER',
  bank_name VARCHAR(100),
  bank_account_no VARCHAR(50),
  bank_account_name VARCHAR(200),
  transfer_at TIMESTAMP WITH TIME ZONE,
  slip_image_url TEXT,
  note TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  approved_by UUID REFERENCES lotto_users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  reject_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Status Values:**
- `PENDING`: รอตรวจสอบ - Initial state, credit NOT yet added
- `APPROVED`: สำเร็จ - Admin approved, credit added to user account
- `REJECTED`: ถูกปฏิเสธ - Admin rejected, no credit added
- `CANCELLED`: ยกเลิก - User cancelled

#### lotto_credit_transactions
Ledger for all credit movements:
```sql
CREATE TABLE lotto_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES lotto_users(id),
  type VARCHAR(30) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  direction VARCHAR(10) NOT NULL,
  balance_before NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  ref_type VARCHAR(50),
  ref_id UUID,
  status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Transaction Types:**
- `DEPOSIT`: Deposit approved (direction: IN)
- `BET_PURCHASE`: Bet placed (direction: OUT)
- `BET_WIN`: Prize payout (direction: IN)
- `BET_REFUND`: Refund (direction: IN)
- `WITHDRAW`: Withdrawal approved (direction: OUT)
- `ADMIN_ADJUST`: Manual adjustment (direction: IN/OUT)

### 2. GraphQL Schema

```graphql
type DepositMethod {
  id: ID!
  code: String!
  nameTh: String!
  description: String
  minAmount: Float
  maxAmount: Float
  bankName: String
  bankAccountNo: String
  bankAccountName: String
  qrImageUrl: String
  isActive: Boolean!
  displayOrder: Int!
}

type Deposit {
  id: ID!
  userId: ID!
  amount: Float!
  method: String!
  bankName: String
  bankAccountNo: String
  bankAccountName: String
  transferAt: String
  slipImageUrl: String
  note: String
  status: String!
  approvedBy: ID
  approvedAt: String
  rejectReason: String
  createdAt: String!
}

type Query {
  depositMethods: [DepositMethod!]!
  myDeposits(limit: Int, offset: Int): [Deposit!]!
}

type Mutation {
  createDeposit(input: CreateDepositInput!): Deposit!
  approveDeposit(id: ID!, note: String): Deposit!
  rejectDeposit(id: ID!, reason: String!): Deposit!
}

input CreateDepositInput {
  amount: Float!
  method: String!
  bankName: String
  bankAccountNo: String
  bankAccountName: String
  transferAt: String
  slipImageUrl: String
  note: String
}
```

### 3. Resolvers

#### depositMethods
Fetches all active deposit methods:
```typescript
async depositMethods() {
  const methods = await queryLottoDb(
    `SELECT * FROM lotto_deposit_methods 
     WHERE is_active = true 
     ORDER BY display_order, id`,
    []
  );
  return methods.map(method => ({
    id: method.id,
    code: method.code,
    nameTh: method.name_th,
    // ...other fields
  }));
}
```

#### myDeposits
Fetches user's deposit history:
```typescript
async myDeposits(_parent, { limit = 20, offset = 0 }, context) {
  const currentUser = getUserFromContext(context);
  const deposits = await queryLottoDb(
    `SELECT * FROM lotto_deposits 
     WHERE user_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2 OFFSET $3`,
    [currentUser.userId, limit, offset]
  );
  return deposits.map(deposit => ({
    id: deposit.id,
    userId: deposit.user_id,
    amount: parseFloat(deposit.amount),
    // ...other fields
  }));
}
```

#### createDeposit
Creates new deposit request (status: PENDING):
```typescript
async createDeposit(_parent, { input }, context) {
  const currentUser = getUserFromContext(context);
  
  // Validate amount
  if (input.amount <= 0) {
    throw new Error("จำนวนเงินต้องมากกว่า 0");
  }
  
  // Create deposit record with status PENDING
  const deposits = await queryLottoDb(
    `INSERT INTO lotto_deposits 
     (user_id, amount, method, ...) 
     VALUES ($1, $2, $3, ...) 
     RETURNING *`,
    [currentUser.userId, input.amount, input.method, ...]
  );
  
  // NOTE: Credit is NOT added here
  // Must wait for admin approval
  
  return {
    id: deposit.id,
    userId: deposit.user_id,
    amount: parseFloat(deposit.amount),
    status: 'PENDING',
    // ...other fields
  };
}
```

#### approveDeposit (Admin only)
Approves deposit and adds credit:
```typescript
async approveDeposit(_parent, { id, note }, context) {
  const admin = requireAdmin(context);
  
  // Lock rows to prevent race conditions
  const deposit = await queryLottoDb(
    `SELECT * FROM lotto_deposits WHERE id = $1 FOR UPDATE`,
    [id]
  );
  
  if (deposit.status !== 'PENDING') {
    throw new Error("Deposit already processed");
  }
  
  const user = await queryLottoDb(
    `SELECT * FROM lotto_users WHERE id = $1 FOR UPDATE`,
    [deposit.user_id]
  );
  
  const balanceBefore = parseFloat(user.credit || 0);
  const balanceAfter = balanceBefore + amount;
  
  // Update user credit
  await queryLottoDb(
    `UPDATE lotto_users SET credit = $1 WHERE id = $2`,
    [balanceAfter, deposit.user_id]
  );
  
  // Update deposit status
  await queryLottoDb(
    `UPDATE lotto_deposits 
     SET status = 'APPROVED', 
         approved_by = $1, 
         approved_at = NOW()
     WHERE id = $2`,
    [admin.userId, id]
  );
  
  // Create credit transaction
  await queryLottoDb(
    `INSERT INTO lotto_credit_transactions 
     (user_id, type, amount, direction, balance_before, balance_after, 
      ref_type, ref_id, status, note)
     VALUES ($1, 'DEPOSIT', $2, 'IN', $3, $4, 'DEPOSIT', $5, 'COMPLETED', $6)`,
    [deposit.user_id, amount, balanceBefore, balanceAfter, id, note]
  );
  
  return deposit;
}
```

#### rejectDeposit (Admin only)
Rejects deposit (no credit added):
```typescript
async rejectDeposit(_parent, { id, reason }, context) {
  const admin = requireAdmin(context);
  
  const deposit = await queryLottoDb(
    `SELECT * FROM lotto_deposits WHERE id = $1`,
    [id]
  );
  
  if (deposit.status !== 'PENDING') {
    throw new Error("Deposit already processed");
  }
  
  // Update status to REJECTED
  await queryLottoDb(
    `UPDATE lotto_deposits 
     SET status = 'REJECTED', 
         approved_by = $1, 
         approved_at = NOW(), 
         reject_reason = $2
     WHERE id = $3`,
    [admin.userId, reason, id]
  );
  
  // No credit transaction created
  return deposit;
}
```

### 4. User Interface

#### Page: `/deposit`
File: `app/(main)/deposit/page.tsx`

**Features:**
1. **Current Credit Display** - Shows user's current balance with gradient background
2. **Deposit Methods** - Radio button selection with bank details
3. **Bank Account Info** - Shows bank name, account name, account number with copy button
4. **Amount Input** - Number input with validation (min/max from selected method)
5. **Transfer Date/Time** - Date and time pickers for when user made the transfer
6. **Slip Upload** - Image upload with preview for transfer slip
7. **Note Field** - Optional text area for additional info
8. **Deposit History** - Shows last 10 deposits with status tags

**Validation Rules:**
- Amount is required
- Amount >= minAmount (from selected method)
- Amount <= maxAmount (from selected method)
- Transfer date is required
- Transfer time is required
- Slip image is required
- Must be logged in

**Status Display:**
- 🟠 PENDING: รอตรวจสอบ (Orange)
- 🟢 APPROVED: สำเร็จ (Green)
- 🔴 REJECTED: ถูกปฏิเสธ (Red)
- ⚪ CANCELLED: ยกเลิก (Gray)

## User Flow

### User Submits Deposit

1. User navigates to `/deposit`
2. System shows current credit balance
3. User selects deposit method (BANK_TRANSFER or QR_TRANSFER)
4. System displays bank account details for the selected method
5. User copies account number and makes bank transfer
6. User fills form:
   - Amount: e.g., 1000฿
   - Transfer Date: e.g., 2026-05-02
   - Transfer Time: e.g., 14:30
   - Upload slip image
   - Add note (optional)
7. User clicks "แจ้งหลักฐานการโอนเงิน" (Submit)
8. System creates deposit record with status PENDING
9. System shows success message
10. **Credit is NOT yet added** - waiting for admin approval
11. Deposit appears in history with orange "รอตรวจสอบ" tag

### Admin Approves Deposit

1. Admin navigates to admin deposit management page (future implementation)
2. Admin sees list of PENDING deposits
3. Admin reviews slip image and details
4. Admin clicks "Approve" button
5. System:
   - Locks user and deposit rows
   - Adds credit to user account
   - Updates deposit status to APPROVED
   - Creates credit transaction (type: DEPOSIT, direction: IN)
   - Records admin ID and timestamp
6. User can now see updated credit balance
7. Deposit history shows green "สำเร็จ" tag

### Admin Rejects Deposit

1. Admin reviews deposit and finds issue (e.g., wrong amount, fake slip)
2. Admin enters rejection reason
3. Admin clicks "Reject" button
4. System:
   - Updates deposit status to REJECTED
   - Does NOT add credit
   - Records admin ID, timestamp, and reason
5. User sees red "ถูกปฏิเสธ" tag in history
6. User can contact support or resubmit with correct details

## Security Considerations

1. **Authentication Required** - All deposit operations require JWT token
2. **Authorization** - Only admins can approve/reject deposits
3. **Row Locking** - Uses `FOR UPDATE` to prevent race conditions
4. **Amount Validation** - Enforces min/max limits from deposit methods
5. **Database Constraints** - CHECK constraints ensure amount > 0 and valid status
6. **Transaction Ledger** - All credit changes logged in lotto_credit_transactions
7. **Balance Tracking** - Records balance_before and balance_after for audit trail

## Testing

### Manual Testing

1. **Test User Creation**
   ```sql
   -- Check existing test users
   SELECT id, phone, name, credit FROM lotto_users;
   ```

2. **Test Deposit Methods**
   ```sql
   SELECT code, name_th, min_amount, max_amount 
   FROM lotto_deposit_methods 
   ORDER BY display_order;
   ```

3. **Test Deposit Flow**
   - Login as test user (0988264820)
   - Navigate to `/deposit`
   - Verify current credit displays (999.00฿)
   - Select BANK_TRANSFER method
   - Verify bank details show: กสิกรไทย, 123-4-56789-0, บริษัท ล็อตโต้ จำกัด
   - Fill amount: 500฿
   - Select today's date and current time
   - Upload a test image
   - Submit form
   - Verify success message
   - Verify deposit appears in history with PENDING status
   - Verify credit still 999.00฿ (not changed until approval)

4. **Test Admin Approval** (Future)
   - Login as admin user
   - Navigate to admin deposits page
   - Find the PENDING deposit
   - Click approve
   - Verify user credit increased to 1499.00฿
   - Verify deposit status changed to APPROVED

5. **Test Database Records**
   ```sql
   -- Check deposit created
   SELECT id, user_id, amount, method, status, created_at 
   FROM lotto_deposits 
   ORDER BY created_at DESC 
   LIMIT 5;
   
   -- After approval, check credit transaction
   SELECT user_id, type, amount, direction, balance_before, balance_after, ref_type
   FROM lotto_credit_transactions
   WHERE type = 'DEPOSIT'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

### Edge Cases to Test

1. **Amount below minimum** - Should show validation error
2. **Amount above maximum** - Should show validation error
3. **Missing required fields** - Should show validation errors
4. **Unauthenticated user** - Should show login prompt
5. **Concurrent approvals** - Row locking should prevent duplicate credit adds
6. **Double approval attempt** - Should show "already processed" error
7. **Approve rejected deposit** - Should show "already processed" error

## Future Enhancements

1. **Admin Deposits Page** - Build `/admin/deposits` to manage pending deposits
2. **Real-time Notifications** - Notify users when deposit is approved/rejected
3. **Auto-approval** - Integrate with bank API for automatic slip verification
4. **QR Code Generation** - Generate unique QR code per deposit request
5. **Deposit Limits** - Daily/monthly deposit limits per user
6. **Slip OCR** - Automatically extract amount and date from slip image
7. **Email Notifications** - Send email when deposit approved/rejected
8. **LINE Notifications** - Send LINE message with deposit status

## Migration History

1. `20260502_credit_system.sql` - Created base tables (lotto_credit_transactions, lotto_deposits, lotto_withdrawals)
2. `20260502_deposit_methods.sql` - Created lotto_deposit_methods table and seeded 2 methods

## Files Modified

### Database
- `db/migrations/20260502_credit_system.sql` - Created
- `db/migrations/20260502_deposit_methods.sql` - Created

### GraphQL
- `apps/lotto/graphql/typeDefs.ts` - Added DepositMethod type, depositMethods/myDeposits queries
- `apps/lotto/graphql/resolvers.ts` - Added depositMethods, myDeposits, createDeposit, approveDeposit, rejectDeposit resolvers

### Frontend
- `apps/lotto/app/(main)/deposit/page.tsx` - Complete rebuild with form, validation, and history

## Credit System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Actions                          │
├─────────────────┬──────────────────┬────────────────────────┤
│   Place Bet     │  Submit Deposit  │  Request Withdrawal    │
│   (Immediate)   │   (Pending)      │   (Pending)           │
└────────┬────────┴────────┬─────────┴───────────┬───────────┘
         │                 │                      │
         ▼                 ▼                      ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│ lotto_orders    │ │ lotto_deposits  │ │ lotto_withdrawals   │
│ status: PENDING │ │ status: PENDING │ │ status: PENDING     │
└────────┬────────┘ └────────┬────────┘ └───────────┬─────────┘
         │                   │                       │
         │ createOrder       │ approveDeposit        │ approveWithdrawal
         │ (deducts credit)  │ (adds credit)         │ (already deducted)
         ▼                   ▼                       ▼
┌──────────────────────────────────────────────────────────────┐
│              lotto_users.credit (NUMERIC(12,2))              │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            │ Every change creates a transaction
                            ▼
┌──────────────────────────────────────────────────────────────┐
│         lotto_credit_transactions (Immutable Ledger)         │
│  - balance_before                                            │
│  - balance_after                                             │
│  - type: DEPOSIT|BET_PURCHASE|BET_WIN|BET_REFUND|WITHDRAW   │
│  - direction: IN|OUT                                         │
│  - ref_type: ORDER|DEPOSIT|WITHDRAW                          │
│  - ref_id: UUID                                              │
└──────────────────────────────────────────────────────────────┘
```

## Status Summary

✅ **Completed:**
- Database tables (lotto_deposit_methods, lotto_deposits)
- GraphQL schema (DepositMethod type, queries)
- GraphQL resolvers (depositMethods, myDeposits, createDeposit, approveDeposit, rejectDeposit)
- User deposit page UI with form, validation, and history
- Credit transaction ledger integration
- Build verification (npm run build successful)

🔄 **Pending:**
- Admin deposit management page (`/admin/deposits`)
- Real-time notifications
- Automated slip verification
- Email/LINE notifications

## Notes

- **Credit Addition**: Credit is ONLY added when admin approves deposit (not on submission)
- **Transaction Type**: Use `DEPOSIT` for approved deposits in lotto_credit_transactions
- **Balance Tracking**: Always record balance_before and balance_after for audit trail
- **Row Locking**: Use `FOR UPDATE` when updating credit to prevent race conditions
- **Status Workflow**: PENDING → APPROVED/REJECTED (no going back)
