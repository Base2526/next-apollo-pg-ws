-- Migration: Add proper status flow for lotto orders
-- Date: 2026-05-07
-- Purpose: Add pending_confirm, refunded, rejected status values

-- ========================================
-- 1. UPDATE STATUS VALUES
-- ========================================

-- Note: PostgreSQL doesn't have ALTER TYPE for CHECK constraints
-- We need to update the constraint if it exists, or just ensure our app logic handles these values

-- Update existing pending orders to pending_confirm (orders that haven't been approved yet)
UPDATE lotto_orders 
SET status = 'pending_confirm' 
WHERE status = 'pending' 
  AND result_status = 'pending'
  AND checked_at IS NULL;

-- ========================================
-- 2. ADD APPROVED_AT COLUMN (for tracking when admin approved)
-- ========================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lotto_orders' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE lotto_orders ADD COLUMN approved_at TIMESTAMPTZ NULL DEFAULT NULL;
  END IF;
END $$;

-- ========================================
-- 3. ADD REFUNDED_AT COLUMN
-- ========================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lotto_orders' AND column_name = 'refunded_at'
  ) THEN
    ALTER TABLE lotto_orders ADD COLUMN refunded_at TIMESTAMPTZ NULL DEFAULT NULL;
  END IF;
END $$;

-- ========================================
-- 4. ADD REFUND_REASON COLUMN
-- ========================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lotto_orders' AND column_name = 'refund_reason'
  ) THEN
    ALTER TABLE lotto_orders ADD COLUMN refund_reason TEXT NULL DEFAULT NULL;
  END IF;
END $$;

-- ========================================
-- 5. CREATE INDEX FOR EXPIRED PENDING ORDERS
-- ========================================

CREATE INDEX IF NOT EXISTS idx_lotto_orders_pending_confirm 
ON lotto_orders(status, draw_id) 
WHERE status = 'pending_confirm';

-- ========================================
-- 6. COMMENTS
-- ========================================

COMMENT ON COLUMN lotto_orders.status IS 'Order workflow status: pending_confirm, approved, refunded, rejected';
COMMENT ON COLUMN lotto_orders.result_status IS 'Result/win status: pending, won, lost, paid, refunded';
COMMENT ON COLUMN lotto_orders.approved_at IS 'Timestamp when admin approved/accepted the order';
COMMENT ON COLUMN lotto_orders.refunded_at IS 'Timestamp when order was refunded';
COMMENT ON COLUMN lotto_orders.refund_reason IS 'Reason for refund (expired, cancelled, etc)';

-- ========================================
-- STATUS FLOW EXPLANATION
-- ========================================

/*
ORDER STATUS FLOW (lotto_orders.status):
1. pending_confirm - User submitted order, waiting for admin approval
2. approved - Admin accepted the order, waiting for draw result
3. refunded - Order refunded (expired before approval, or manually refunded)
4. rejected - Admin rejected the order (optional, future use)

RESULT STATUS FLOW (lotto_orders.result_status):
1. pending - No result yet (draw not completed)
2. won - Order won a prize
3. lost - Order did not win
4. paid - Winnings paid to user
5. refunded - Order refunded (duplicates with status for clarity)

IMPORTANT RULES:
- Only orders with status='approved' should be included in prize calculation
- Orders with status='refunded' or 'rejected' should NOT be calculated
- Orders with status='pending_confirm' that exceed draw.close_at should be auto-refunded
*/
