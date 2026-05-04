-- Fix user_id type mismatch in lotto_orders
-- lotto_users.id is UUID but lotto_orders.user_id is INTEGER

-- Change user_id to UUID type to match lotto_users.id
ALTER TABLE lotto_orders 
  ALTER COLUMN user_id TYPE uuid USING user_id::text::uuid;

-- Add foreign key constraint
ALTER TABLE lotto_orders
  ADD CONSTRAINT lotto_orders_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES lotto_users(id) ON DELETE SET NULL;

-- Verify
\d lotto_orders;
