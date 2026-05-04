-- ============================================================
-- CREDIT SYSTEM MIGRATION
-- Created: 2026-05-02
-- Purpose: Add credit balance and transaction ledger system
-- ============================================================

-- 1. Add credit column to lotto_users
ALTER TABLE lotto_users 
  ADD COLUMN IF NOT EXISTS credit NUMERIC(12,2) DEFAULT 0.00 NOT NULL;

-- Add index for credit lookups
CREATE INDEX IF NOT EXISTS idx_lotto_users_credit ON lotto_users(credit);

-- 2. Create credit transactions ledger
CREATE TABLE IF NOT EXISTS lotto_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES lotto_users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'DEPOSIT',
    'WITHDRAW', 
    'BET_PURCHASE',
    'BET_REFUND',
    'WIN_PAYOUT',
    'ADMIN_ADJUST'
  )),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('IN', 'OUT')),
  balance_before NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  ref_type VARCHAR(30) NULL CHECK (ref_type IS NULL OR ref_type IN (
    'ORDER',
    'DEPOSIT',
    'WITHDRAW',
    'RESULT',
    'ADMIN'
  )),
  ref_id VARCHAR(100) NULL,
  status VARCHAR(30) DEFAULT 'COMPLETED' NOT NULL CHECK (status IN (
    'PENDING',
    'COMPLETED',
    'REJECTED',
    'CANCELLED'
  )),
  note TEXT NULL,
  created_by UUID NULL REFERENCES lotto_users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for transaction queries
CREATE INDEX IF NOT EXISTS idx_credit_tx_user_id ON lotto_credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_created_at ON lotto_credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_type ON lotto_credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_tx_ref ON lotto_credit_transactions(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_status ON lotto_credit_transactions(status);

-- 3. Create deposits table
CREATE TABLE IF NOT EXISTS lotto_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES lotto_users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method VARCHAR(50) NOT NULL DEFAULT 'BANK_TRANSFER',
  bank_name VARCHAR(100) NULL,
  bank_account_no VARCHAR(50) NULL,
  bank_account_name VARCHAR(200) NULL,
  transfer_at TIMESTAMPTZ NULL,
  slip_image_url TEXT NULL,
  note TEXT NULL,
  status VARCHAR(30) DEFAULT 'PENDING' NOT NULL CHECK (status IN (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
  )),
  approved_by UUID NULL REFERENCES lotto_users(id),
  approved_at TIMESTAMPTZ NULL,
  reject_reason TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for deposit queries
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON lotto_deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON lotto_deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_created_at ON lotto_deposits(created_at DESC);

-- 4. Create withdrawals table
CREATE TABLE IF NOT EXISTS lotto_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES lotto_users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  bank_name VARCHAR(100) NOT NULL,
  bank_account_no VARCHAR(50) NOT NULL,
  bank_account_name VARCHAR(200) NOT NULL,
  note TEXT NULL,
  status VARCHAR(30) DEFAULT 'PENDING' NOT NULL CHECK (status IN (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
  )),
  approved_by UUID NULL REFERENCES lotto_users(id),
  approved_at TIMESTAMPTZ NULL,
  reject_reason TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for withdrawal queries
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON lotto_withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON lotto_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON lotto_withdrawals(created_at DESC);

-- 5. Add total_win column to lotto_orders if not exists
ALTER TABLE lotto_orders 
  ADD COLUMN IF NOT EXISTS total_win NUMERIC(12,2) DEFAULT 0.00;

-- 6. Add is_paid flag to track if winning was paid
ALTER TABLE lotto_orders 
  ADD COLUMN IF NOT EXISTS is_win_paid BOOLEAN DEFAULT false;

-- Create index for unpaid wins
CREATE INDEX IF NOT EXISTS idx_orders_unpaid_wins 
  ON lotto_orders(result_status, is_win_paid) 
  WHERE result_status = 'won' AND is_win_paid = false;

COMMENT ON TABLE lotto_credit_transactions IS 'Ledger for all credit movements';
COMMENT ON TABLE lotto_deposits IS 'User deposit requests';
COMMENT ON TABLE lotto_withdrawals IS 'User withdrawal requests';
COMMENT ON COLUMN lotto_users.credit IS 'Current user credit balance';
COMMENT ON COLUMN lotto_orders.total_win IS 'Total winning amount for this order';
COMMENT ON COLUMN lotto_orders.is_win_paid IS 'Whether winning payout has been credited';
