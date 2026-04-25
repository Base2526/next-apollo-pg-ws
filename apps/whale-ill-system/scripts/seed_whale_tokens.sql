-- Idempotent token seed for whale dashboard token selector.
-- Uses placeholder addresses where canonical addresses are not configured yet.

INSERT INTO whale_tokens (
  id,
  chain,
  token_address,
  symbol,
  name,
  decimals,
  total_supply,
  circulating_supply,
  created_at,
  updated_at
)
VALUES
  (
    '22222222-2222-4222-8222-222222222222'::uuid,
    'bsc',
    lower('0xsto_demo'),
    'STO',
    'StakeStone',
    18,
    NULL,
    NULL,
    NOW(),
    NOW()
  ),
  (
    '33333333-3333-4333-8333-333333333333'::uuid,
    'sol',
    'soon_demo',
    'SOON',
    'SOON',
    9,
    NULL,
    NULL,
    NOW(),
    NOW()
  ),
  (
    '44444444-4444-4444-8444-444444444444'::uuid,
    'cardano',
    'addr_test1qz0placeholdercardanotokenselector0000000000000000',
    'ADA',
    'Cardano',
    6,
    NULL,
    NULL,
    NOW(),
    NOW()
  )
ON CONFLICT (id)
DO UPDATE SET
  chain = EXCLUDED.chain,
  token_address = EXCLUDED.token_address,
  symbol = EXCLUDED.symbol,
  name = EXCLUDED.name,
  decimals = EXCLUDED.decimals,
  total_supply = EXCLUDED.total_supply,
  circulating_supply = EXCLUDED.circulating_supply,
  updated_at = NOW();
