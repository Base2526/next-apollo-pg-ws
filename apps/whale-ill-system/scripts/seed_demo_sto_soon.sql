-- Real working demo seed for STO (bullish) and SOON (neutral/weak)
-- Idempotent: removes prior demo rows for target token IDs and reseeds deterministic data.

WITH demo_tokens AS (
  SELECT
    '22222222-2222-4222-8222-222222222222'::uuid AS sto_id,
    '33333333-3333-4333-8333-333333333333'::uuid AS soon_id
)
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
    1000000000,
    650000000,
    NOW(),
    NOW()
  ),
  (
    '33333333-3333-4333-8333-333333333333'::uuid,
    'sol',
    lower('soon_demo'),
    'SOON',
    'SOON',
    9,
    1000000000,
    700000000,
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

WITH demo_tokens AS (
  SELECT
    '22222222-2222-4222-8222-222222222222'::uuid AS sto_id,
    '33333333-3333-4333-8333-333333333333'::uuid AS soon_id
)
DELETE FROM whale_signals
WHERE token_id IN ((SELECT sto_id FROM demo_tokens), (SELECT soon_id FROM demo_tokens));

WITH demo_tokens AS (
  SELECT
    '22222222-2222-4222-8222-222222222222'::uuid AS sto_id,
    '33333333-3333-4333-8333-333333333333'::uuid AS soon_id
)
DELETE FROM token_playability_score
WHERE token_id IN ((SELECT sto_id FROM demo_tokens), (SELECT soon_id FROM demo_tokens));

WITH demo_tokens AS (
  SELECT
    '22222222-2222-4222-8222-222222222222'::uuid AS sto_id,
    '33333333-3333-4333-8333-333333333333'::uuid AS soon_id
)
DELETE FROM wallet_performance_stats
WHERE token_id IN ((SELECT sto_id FROM demo_tokens), (SELECT soon_id FROM demo_tokens));

WITH demo_tokens AS (
  SELECT
    '22222222-2222-4222-8222-222222222222'::uuid AS sto_id,
    '33333333-3333-4333-8333-333333333333'::uuid AS soon_id
)
DELETE FROM whale_unlock_events
WHERE token_id IN ((SELECT sto_id FROM demo_tokens), (SELECT soon_id FROM demo_tokens));

WITH demo_tokens AS (
  SELECT
    '22222222-2222-4222-8222-222222222222'::uuid AS sto_id,
    '33333333-3333-4333-8333-333333333333'::uuid AS soon_id
)
DELETE FROM whale_exchange_flow_daily
WHERE token_id IN ((SELECT sto_id FROM demo_tokens), (SELECT soon_id FROM demo_tokens));

WITH demo_tokens AS (
  SELECT
    '22222222-2222-4222-8222-222222222222'::uuid AS sto_id,
    '33333333-3333-4333-8333-333333333333'::uuid AS soon_id
)
DELETE FROM whale_holder_daily_stats
WHERE token_id IN ((SELECT sto_id FROM demo_tokens), (SELECT soon_id FROM demo_tokens));

WITH demo_tokens AS (
  SELECT
    '22222222-2222-4222-8222-222222222222'::uuid AS sto_id,
    '33333333-3333-4333-8333-333333333333'::uuid AS soon_id
)
DELETE FROM whale_transfers
WHERE token_id IN ((SELECT sto_id FROM demo_tokens), (SELECT soon_id FROM demo_tokens));

WITH demo_tokens AS (
  SELECT
    '22222222-2222-4222-8222-222222222222'::uuid AS sto_id,
    '33333333-3333-4333-8333-333333333333'::uuid AS soon_id
)
DELETE FROM whale_holder_snapshots
WHERE token_id IN ((SELECT sto_id FROM demo_tokens), (SELECT soon_id FROM demo_tokens));

INSERT INTO smart_money_wallets (
  id,
  chain,
  wallet_address,
  strategy_tag,
  win_rate,
  avg_return_30d,
  risk_score,
  confidence_score,
  is_active,
  source,
  created_at,
  updated_at
)
VALUES
  (
    '55555555-5555-4555-8555-555555555555'::uuid,
    'bsc',
    lower('0xsto_smart_1'),
    'swing_accumulation',
    0.71,
    0.14,
    32,
    88,
    true,
    'demo_seed',
    NOW(),
    NOW()
  ),
  (
    '66666666-6666-4666-8666-666666666666'::uuid,
    'bsc',
    lower('0xsto_smart_2'),
    'position_accumulator',
    0.68,
    0.12,
    35,
    84,
    true,
    'demo_seed',
    NOW(),
    NOW()
  ),
  (
    '77777777-7777-4777-8777-777777777777'::uuid,
    'sol',
    lower('soonsmartwallet1111111111111111111111111111111111'),
    'neutral_rotator',
    0.52,
    0.02,
    49,
    65,
    true,
    'demo_seed',
    NOW(),
    NOW()
  )
ON CONFLICT (chain, wallet_address)
DO UPDATE SET
  strategy_tag = EXCLUDED.strategy_tag,
  win_rate = EXCLUDED.win_rate,
  avg_return_30d = EXCLUDED.avg_return_30d,
  risk_score = EXCLUDED.risk_score,
  confidence_score = EXCLUDED.confidence_score,
  is_active = EXCLUDED.is_active,
  source = EXCLUDED.source,
  updated_at = NOW();

INSERT INTO whale_wallet_labels (
  id,
  chain,
  wallet_address,
  label_type,
  label_name,
  confidence_score,
  source,
  created_at,
  updated_at
)
VALUES
  (uuid_generate_v4(), 'bsc', lower('0xsto_exchange_1'), 'exchange', 'BSC CEX-1', 92, 'demo_seed', NOW(), NOW()),
  (uuid_generate_v4(), 'bsc', lower('0xsto_exchange_2'), 'exchange', 'BSC CEX-2', 89, 'demo_seed', NOW(), NOW()),
  (uuid_generate_v4(), 'sol', lower('soonexchangewallet1111111111111111111111111111111'), 'exchange', 'SOL CEX-1', 90, 'demo_seed', NOW(), NOW()),
  (uuid_generate_v4(), 'sol', lower('soonexchangewallet2222222222222222222222222222222'), 'exchange', 'SOL CEX-2', 87, 'demo_seed', NOW(), NOW()),
  (uuid_generate_v4(), 'bsc', lower('0xsto_smart_1'), 'smart_money', 'STO Smart 1', 88, 'demo_seed', NOW(), NOW()),
  (uuid_generate_v4(), 'bsc', lower('0xsto_smart_2'), 'smart_money', 'STO Smart 2', 84, 'demo_seed', NOW(), NOW()),
  (uuid_generate_v4(), 'sol', lower('soonsmartwallet1111111111111111111111111111111111'), 'smart_money', 'SOON Smart 1', 65, 'demo_seed', NOW(), NOW())
ON CONFLICT (chain, wallet_address)
DO UPDATE SET
  label_type = EXCLUDED.label_type,
  label_name = EXCLUDED.label_name,
  confidence_score = EXCLUDED.confidence_score,
  source = EXCLUDED.source,
  updated_at = NOW();

INSERT INTO whale_transfers (
  token_id,
  chain,
  tx_hash,
  log_index,
  block_number,
  block_time,
  from_address,
  to_address,
  amount_raw,
  amount_decimal,
  usd_value,
  from_label_type,
  to_label_type,
  is_exchange_in,
  is_exchange_out,
  is_internal_like,
  created_at
)
VALUES
  -- STO bullish: exchange -> whale / smart money accumulation
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bsc', lower('0xstotx01'), 0, 100001, NOW() - INTERVAL '7 day', lower('0xsto_exchange_1'), lower('0xsto_whale_1'), NULL, 120000, 960000, 'exchange', 'unknown', false, true, false, NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bsc', lower('0xstotx02'), 0, 100002, NOW() - INTERVAL '6 day', lower('0xsto_exchange_1'), lower('0xsto_smart_1'), NULL, 140000, 1134000, 'exchange', 'smart_money', false, true, false, NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bsc', lower('0xstotx03'), 0, 100003, NOW() - INTERVAL '5 day', lower('0xsto_exchange_2'), lower('0xsto_whale_2'), NULL, 160000, 1312000, 'exchange', 'unknown', false, true, false, NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bsc', lower('0xstotx04'), 0, 100004, NOW() - INTERVAL '4 day', lower('0xsto_exchange_2'), lower('0xsto_smart_2'), NULL, 180000, 1494000, 'exchange', 'smart_money', false, true, false, NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bsc', lower('0xstotx05'), 0, 100005, NOW() - INTERVAL '3 day', lower('0xsto_exchange_1'), lower('0xsto_whale_3'), NULL, 210000, 1764000, 'exchange', 'unknown', false, true, false, NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bsc', lower('0xstotx06'), 0, 100006, NOW() - INTERVAL '2 day', lower('0xsto_exchange_2'), lower('0xsto_smart_1'), NULL, 230000, 1978000, 'exchange', 'smart_money', false, true, false, NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bsc', lower('0xstotx07'), 0, 100007, NOW() - INTERVAL '1 day', lower('0xsto_exchange_1'), lower('0xsto_whale_4'), NULL, 250000, 2200000, 'exchange', 'unknown', false, true, false, NOW()),
  -- minimal bearish STO transfer
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bsc', lower('0xstotx08'), 0, 100008, NOW() - INTERVAL '18 hour', lower('0xsto_whale_2'), lower('0xsto_exchange_1'), NULL, 45000, 396000, 'unknown', 'exchange', true, false, false, NOW()),

  -- SOON neutral/weak: balanced with some whale -> exchange
  ('33333333-3333-4333-8333-333333333333'::uuid, 'sol', lower('0xsoontx01'), 0, 200001, NOW() - INTERVAL '7 day', lower('soonexchangewallet1111111111111111111111111111111'), lower('soon_whale_wallet_1'), NULL, 85000, 620500, 'exchange', 'unknown', false, true, false, NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'sol', lower('0xsoontx02'), 0, 200002, NOW() - INTERVAL '6 day', lower('soon_whale_wallet_1'), lower('soonexchangewallet1111111111111111111111111111111'), NULL, 90000, 657000, 'unknown', 'exchange', true, false, false, NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'sol', lower('0xsoontx03'), 0, 200003, NOW() - INTERVAL '5 day', lower('soonexchangewallet2222222222222222222222222222222'), lower('soonsmartwallet1111111111111111111111111111111111'), NULL, 76000, 547200, 'exchange', 'smart_money', false, true, false, NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'sol', lower('0xsoontx04'), 0, 200004, NOW() - INTERVAL '4 day', lower('soonsmartwallet1111111111111111111111111111111111'), lower('soonexchangewallet2222222222222222222222222222222'), NULL, 81000, 590490, 'smart_money', 'exchange', true, false, false, NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'sol', lower('0xsoontx05'), 0, 200005, NOW() - INTERVAL '3 day', lower('soonexchangewallet1111111111111111111111111111111'), lower('soon_whale_wallet_2'), NULL, 72000, 532800, 'exchange', 'unknown', false, true, false, NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'sol', lower('0xsoontx06'), 0, 200006, NOW() - INTERVAL '2 day', lower('soon_whale_wallet_2'), lower('soonexchangewallet1111111111111111111111111111111'), NULL, 55000, 412500, 'unknown', 'exchange', true, false, false, NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'sol', lower('0xsoontx07'), 0, 200007, NOW() - INTERVAL '1 day', lower('soonexchangewallet2222222222222222222222222222222'), lower('soon_whale_wallet_3'), NULL, 68000, 516800, 'exchange', 'unknown', false, true, false, NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'sol', lower('0xsoontx08'), 0, 200008, NOW() - INTERVAL '18 hour', lower('soon_whale_wallet_3'), lower('soonexchangewallet2222222222222222222222222222222'), NULL, 65000, 500500, 'unknown', 'exchange', true, false, false, NOW())
ON CONFLICT (token_id, tx_hash, log_index)
DO UPDATE SET
  amount_decimal = EXCLUDED.amount_decimal,
  usd_value = EXCLUDED.usd_value,
  from_label_type = EXCLUDED.from_label_type,
  to_label_type = EXCLUDED.to_label_type,
  is_exchange_in = EXCLUDED.is_exchange_in,
  is_exchange_out = EXCLUDED.is_exchange_out,
  is_internal_like = EXCLUDED.is_internal_like,
  block_time = EXCLUDED.block_time;

INSERT INTO whale_holder_snapshots (
  token_id,
  chain,
  wallet_address,
  balance,
  pct_supply,
  snapshot_at,
  created_at
)
VALUES
  -- STO snapshots: clear growth and more whales crossing threshold
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bsc', lower('0xsto_whale_1'), 1300000, 0.00130, NOW() - INTERVAL '7 day', NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bsc', lower('0xsto_whale_2'), 900000, 0.00090, NOW() - INTERVAL '7 day', NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bsc', lower('0xsto_whale_3'), 650000, 0.00065, NOW() - INTERVAL '7 day', NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bsc', lower('0xsto_smart_1'), 1200000, 0.00120, NOW() - INTERVAL '7 day', NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bsc', lower('0xsto_smart_2'), 880000, 0.00088, NOW() - INTERVAL '7 day', NOW()),

  ('22222222-2222-4222-8222-222222222222'::uuid, 'bsc', lower('0xsto_whale_1'), 1900000, 0.00190, NOW() - INTERVAL '1 day', NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bsc', lower('0xsto_whale_2'), 1400000, 0.00140, NOW() - INTERVAL '1 day', NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bsc', lower('0xsto_whale_3'), 1120000, 0.00112, NOW() - INTERVAL '1 day', NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bsc', lower('0xsto_whale_4'), 1080000, 0.00108, NOW() - INTERVAL '1 day', NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bsc', lower('0xsto_smart_1'), 1650000, 0.00165, NOW() - INTERVAL '1 day', NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'bsc', lower('0xsto_smart_2'), 1200000, 0.00120, NOW() - INTERVAL '1 day', NOW()),

  -- SOON snapshots: flatter / slight weakness
  ('33333333-3333-4333-8333-333333333333'::uuid, 'sol', lower('soon_whale_wallet_1'), 1500000, 0.00150, NOW() - INTERVAL '7 day', NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'sol', lower('soon_whale_wallet_2'), 1200000, 0.00120, NOW() - INTERVAL '7 day', NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'sol', lower('soon_whale_wallet_3'), 950000, 0.00095, NOW() - INTERVAL '7 day', NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'sol', lower('soonsmartwallet1111111111111111111111111111111111'), 1100000, 0.00110, NOW() - INTERVAL '7 day', NOW()),

  ('33333333-3333-4333-8333-333333333333'::uuid, 'sol', lower('soon_whale_wallet_1'), 1520000, 0.00152, NOW() - INTERVAL '1 day', NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'sol', lower('soon_whale_wallet_2'), 1190000, 0.00119, NOW() - INTERVAL '1 day', NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'sol', lower('soon_whale_wallet_3'), 1010000, 0.00101, NOW() - INTERVAL '1 day', NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'sol', lower('soonsmartwallet1111111111111111111111111111111111'), 1080000, 0.00108, NOW() - INTERVAL '1 day', NOW())
ON CONFLICT (token_id, wallet_address, snapshot_at)
DO UPDATE SET
  balance = EXCLUDED.balance,
  pct_supply = EXCLUDED.pct_supply;

INSERT INTO whale_exchange_flow_daily (
  token_id,
  stat_date,
  exchange_inflow,
  exchange_outflow,
  netflow,
  created_at
)
VALUES
  -- STO: sustained negative netflow (bullish)
  ('22222222-2222-4222-8222-222222222222'::uuid, (NOW()::date - INTERVAL '6 day')::date, 60000, 160000, -100000, NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, (NOW()::date - INTERVAL '5 day')::date, 50000, 170000, -120000, NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, (NOW()::date - INTERVAL '4 day')::date, 45000, 180000, -135000, NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, (NOW()::date - INTERVAL '3 day')::date, 55000, 210000, -155000, NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, (NOW()::date - INTERVAL '2 day')::date, 50000, 230000, -180000, NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, (NOW()::date - INTERVAL '1 day')::date, 70000, 250000, -180000, NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, NOW()::date, 80000, 260000, -180000, NOW()),

  -- SOON: flat/slightly bearish
  ('33333333-3333-4333-8333-333333333333'::uuid, (NOW()::date - INTERVAL '6 day')::date, 110000, 105000, 5000, NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, (NOW()::date - INTERVAL '5 day')::date, 98000, 97000, 1000, NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, (NOW()::date - INTERVAL '4 day')::date, 102000, 101000, 1000, NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, (NOW()::date - INTERVAL '3 day')::date, 108000, 96000, 12000, NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, (NOW()::date - INTERVAL '2 day')::date, 115000, 98000, 17000, NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, (NOW()::date - INTERVAL '1 day')::date, 109000, 102000, 7000, NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, NOW()::date, 112000, 103000, 9000, NOW())
ON CONFLICT (token_id, stat_date)
DO UPDATE SET
  exchange_inflow = EXCLUDED.exchange_inflow,
  exchange_outflow = EXCLUDED.exchange_outflow,
  netflow = EXCLUDED.netflow;

INSERT INTO whale_holder_daily_stats (
  token_id,
  stat_date,
  holder_count,
  whale_holder_count,
  top10_concentration,
  top20_concentration,
  top50_concentration,
  created_at
)
VALUES
  -- STO: clear growth in holders and whales
  ('22222222-2222-4222-8222-222222222222'::uuid, (NOW()::date - INTERVAL '6 day')::date, 4100, 48, 0.41, 0.56, 0.72, NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, (NOW()::date - INTERVAL '5 day')::date, 4160, 50, 0.415, 0.558, 0.723, NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, (NOW()::date - INTERVAL '4 day')::date, 4230, 53, 0.418, 0.562, 0.725, NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, (NOW()::date - INTERVAL '3 day')::date, 4310, 56, 0.422, 0.566, 0.729, NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, (NOW()::date - INTERVAL '2 day')::date, 4385, 59, 0.428, 0.571, 0.733, NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, (NOW()::date - INTERVAL '1 day')::date, 4460, 63, 0.434, 0.577, 0.738, NOW()),
  ('22222222-2222-4222-8222-222222222222'::uuid, NOW()::date, 4550, 67, 0.439, 0.582, 0.742, NOW()),

  -- SOON: mostly flat holders, slightly weaker whales
  ('33333333-3333-4333-8333-333333333333'::uuid, (NOW()::date - INTERVAL '6 day')::date, 5210, 61, 0.48, 0.63, 0.78, NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, (NOW()::date - INTERVAL '5 day')::date, 5205, 60, 0.485, 0.632, 0.781, NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, (NOW()::date - INTERVAL '4 day')::date, 5202, 59, 0.49, 0.635, 0.783, NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, (NOW()::date - INTERVAL '3 day')::date, 5198, 58, 0.494, 0.638, 0.785, NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, (NOW()::date - INTERVAL '2 day')::date, 5195, 58, 0.498, 0.641, 0.787, NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, (NOW()::date - INTERVAL '1 day')::date, 5190, 57, 0.503, 0.644, 0.789, NOW()),
  ('33333333-3333-4333-8333-333333333333'::uuid, NOW()::date, 5188, 56, 0.507, 0.647, 0.791, NOW())
ON CONFLICT (token_id, stat_date)
DO UPDATE SET
  holder_count = EXCLUDED.holder_count,
  whale_holder_count = EXCLUDED.whale_holder_count,
  top10_concentration = EXCLUDED.top10_concentration,
  top20_concentration = EXCLUDED.top20_concentration,
  top50_concentration = EXCLUDED.top50_concentration;

-- STO: no near unlock risk. SOON: small unlock inside 6 days.
INSERT INTO whale_unlock_events (
  id,
  token_id,
  unlock_date,
  amount,
  pct_supply,
  source,
  note,
  created_at,
  updated_at
)
VALUES
  (uuid_generate_v4(), '22222222-2222-4222-8222-222222222222'::uuid, (NOW()::date + INTERVAL '21 day')::date, 5000000, 0.005, 'demo_seed', 'Far unlock, low immediate risk', NOW(), NOW()),
  (uuid_generate_v4(), '33333333-3333-4333-8333-333333333333'::uuid, (NOW()::date + INTERVAL '6 day')::date, 12000000, 0.012, 'demo_seed', 'Near unlock for neutral/bearish pressure', NOW(), NOW())
ON CONFLICT (token_id, unlock_date, source)
DO UPDATE SET
  amount = EXCLUDED.amount,
  pct_supply = EXCLUDED.pct_supply,
  note = EXCLUDED.note,
  updated_at = NOW();
