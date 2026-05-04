-- ============================================================
-- DEPOSIT METHODS MIGRATION
-- Created: 2026-05-02
-- Purpose: Add deposit methods configuration table
-- ============================================================

-- Create deposit methods table
CREATE TABLE IF NOT EXISTS lotto_deposit_methods (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name_th VARCHAR(200) NOT NULL,
  description TEXT,
  min_amount NUMERIC(12,2) DEFAULT 100.00,
  max_amount NUMERIC(12,2) DEFAULT 500000.00,
  bank_name VARCHAR(100),
  bank_account_no VARCHAR(50),
  bank_account_name VARCHAR(200),
  qr_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_deposit_methods_active ON lotto_deposit_methods(is_active, display_order);

-- Seed deposit methods
INSERT INTO lotto_deposit_methods (code, name_th, description, min_amount, max_amount, bank_name, bank_account_no, bank_account_name, display_order) VALUES
  ('BANK_TRANSFER', 'โอนผ่านบัญชีธนาคาร', 'โอนเงินผ่านแอปธนาคารหรือ ATM', 100.00, 500000.00, 'ธนาคารกสิกรไทย', '123-4-56789-0', 'บริษัท ล็อตโต้ จำกัด', 1),
  ('QR_TRANSFER', 'สแกน QR Code', 'สแกน QR Code ผ่านแอปธนาคาร เงินเข้าเร็ว', 50.00, 100000.00, 'ธนาคารกสิกรไทย', '123-4-56789-0', 'บริษัท ล็อตโต้ จำกัด', 2)
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE lotto_deposit_methods IS 'Deposit method configurations';
