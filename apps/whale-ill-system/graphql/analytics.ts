import { query } from "../lib/db";
import { toNum } from "./utils";
import { decideTradeState, isPlayableState } from "../lib/scanner/tradeState";

const HOLDER_WHALE_THRESHOLD = 0.001;
const PLAYABLE_LIQUIDITY_MIN = 500000;
const PLAYABLE_VOLUME_MIN = 1000000;

export const analyticsTypeDefs = /* GraphQL */ `
  type WhaleDataFreshness {
    token_id: ID!
    last_updated: String
    source: String!
  }

  type WhaleMarketSummary {
    token_id: ID!
    price: Float
    price_change_24h_pct: Float
    price_change_7d_pct: Float
    volume_24h: Float
    market_cap: Float
    liquidity: Float
    fdv: Float
    circulating_supply: Float
    total_supply: Float
  }

  type WhaleRiskSummary {
    token_id: ID!
    top10_concentration: Float!
    top20_concentration: Float!
    next_unlock_date: String
    next_unlock_pct_supply: Float
    days_to_next_unlock: Int
    concentration_risk_level: String!
    unlock_risk_level: String!
    unknown_flow_ratio_7d: Float!
    internal_transfer_ratio_7d: Float!
    avg_label_confidence: Float!
    treasury_team_movement_count_7d: Int!
    large_holder_to_exchange_count_7d: Int!
  }

  type WhaleHolderBehavior {
    token_id: ID!
    holder_count_1d: Int!
    holder_count_7d: Int!
    holder_count_30d: Int!
    whale_holder_count_1d: Int!
    whale_holder_count_7d: Int!
    whale_holder_count_30d: Int!
    new_holders_1d: Int!
    new_holders_7d: Int!
    new_holders_30d: Int!
    lost_holders_1d: Int!
    lost_holders_7d: Int!
    lost_holders_30d: Int!
    new_large_holders_7d: Int!
    large_holders_exiting_7d: Int!
    whales_reduced_position_7d: Int!
    smart_money_netflow_7d: Float!
  }

  type WhaleHolderAdvanced {
    wallet_address: String!
    label: WhaleWalletLabel
    balance: Float!
    pct_supply: Float!
    balance_change_24h: Float!
    balance_change_7d: Float!
    netflow_7d: Float!
    first_seen: String
    last_active: String
    risk_tag: String!
  }

  type WhaleHolderStatsPoint {
    stat_date: String!
    holder_count: Int!
    whale_holder_count: Int!
    top10_concentration: Float!
    top20_concentration: Float!
  }

  type WhaleWalletPerformanceStat {
    token_id: ID!
    chain: String!
    wallet_address: String!
    lookback_days: Int!
    inflow_amount: Float!
    outflow_amount: Float!
    netflow_amount: Float!
    avg_entry_price: Float
    avg_exit_price: Float
    realized_pnl_pct: Float
    unrealized_pnl_pct: Float
    win_rate: Float
    trades_count: Int!
    last_active: String
    label_name: String
  }

  type WhaleDataQuality {
    token_id: ID!
    transfer_coverage: Float!
    holder_history_depth_days: Int!
    exchange_label_coverage: Float!
    smart_money_label_coverage: Float!
    confidence_score: Float!
    confidence_level: String!
  }

  type WhalePlayability {
    token_id: ID!
    playability_score: Float!
    trade_state: String!
    is_playable: Boolean!
    smart_money_inflow_7d: Float!
    whale_accumulation_7d: Float!
    exchange_pressure_score: Float!
    liquidity_score: Float!
    volume_score: Float!
    unlock_risk_score: Float!
    concentration_risk_score: Float!
    data_confidence_score: Float!
    reasons: [String!]!
    updated_at: String!
  }

  type WhaleWatchlistItem {
    token_id: ID!
    symbol: String!
    name: String!
    chain: String!
    trade_state: String!
    playability_score: Float!
    smart_money_inflow_7d: Float!
    whale_accumulation_7d: Float!
    liquidity_score: Float!
    volume_score: Float!
  }

  type WhaleWatchlists {
    top_smart_money_inflow: [WhaleWatchlistItem!]!
    top_early_accumulation: [WhaleWatchlistItem!]!
    top_avoid: [WhaleWatchlistItem!]!
  }

  type WhaleScannerResult {
    token_id: ID!
    symbol: String!
    name: String!
    chain: String!
    whale_score: Float!
    smart_money_score: Float!
    exchange_pressure_score: Float!
    concentration_risk_score: Float!
    unlock_risk_score: Float!
    final_trade_state: String!
    reason_json: JSON
    updated_at: String!
  }

  type WhaleLongAlert {
    id: ID!
    token_id: ID!
    symbol: String!
    chain: String!
    alert_type: String!
    state: String
    score: Float
    confidence: Float
    channel: String
    message_text: String
    status: String!
    created_at: String!
  }

  type WhaleSmartMoneySummary {
    token_id: ID!
    active_wallets: Int!
    avg_score: Float!
    avg_win_rate: Float!
    top_wallets: [WhaleWalletPerformanceStat!]!
  }

  extend type Query {
    whaleDataFreshness(tokenId: ID!): WhaleDataFreshness!
    whaleMarketSummary(tokenId: ID!): WhaleMarketSummary!
    whaleRiskSummary(tokenId: ID!): WhaleRiskSummary!
    whaleHolderBehavior(tokenId: ID!): WhaleHolderBehavior!
    whaleTopHoldersAdvanced(
      tokenId: ID!
      limit: Int = 50
      hideExchange: Boolean = false
      hideContracts: Boolean = false
      onlySmartMoney: Boolean = false
      whaleThresholdPct: Float = 0
    ): [WhaleHolderAdvanced!]!
    whaleHolderStatsSeries(tokenId: ID!, fromDate: String!, toDate: String!): [WhaleHolderStatsPoint!]!
    whaleWalletPerformanceStats(tokenId: ID!, lookbackDays: Int = 30, limit: Int = 20): [WhaleWalletPerformanceStat!]!
    whaleDataQuality(tokenId: ID!): WhaleDataQuality!
    whalePlayability(tokenId: ID!): WhalePlayability!
    whaleWatchlists(limit: Int = 5): WhaleWatchlists!
    whaleScanner(limit: Int = 20): [WhaleScannerResult!]!
    whaleTopOpportunities(limit: Int = 10): [WhaleScannerResult!]!
    whaleLongAlerts(limit: Int = 20): [WhaleLongAlert!]!
    whaleSmartMoneySummary(tokenId: ID!, limit: Int = 10): WhaleSmartMoneySummary!
  }
`;

function pctChange(current: number, previous: number): number {
  if (!Number.isFinite(previous) || previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function concentrationRiskLevel(top10: number, top20: number): string {
  if (top10 >= 0.6 || top20 >= 0.8) return "high";
  if (top10 >= 0.45 || top20 >= 0.65) return "medium";
  return "low";
}

function unlockRiskLevel(daysToUnlock: number | null, unlockPct: number): string {
  if (daysToUnlock == null) return "low";
  if (daysToUnlock <= 7 && unlockPct >= 0.02) return "high";
  if (daysToUnlock <= 30 && unlockPct >= 0.01) return "medium";
  return "low";
}

function holderRiskTag(labelType: string | null, pctSupply: number, netflow7d: number): string {
  if (labelType === "team" || labelType === "treasury" || labelType === "vesting") return "treasury/team";
  if (labelType === "exchange") return "exchange";
  if (pctSupply >= 0.05) return "high-concentration";
  if (netflow7d < 0) return "distributing";
  if (labelType === "smart_money") return "smart-money";
  return "normal";
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function scoreByThreshold(value: number, baseline: number, high: number): number {
  if (value <= baseline) return 0;
  if (high <= baseline) return clampScore(value);
  return clampScore(((value - baseline) / (high - baseline)) * 100);
}

function confidenceLevel(score: number): string {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

async function getDataQuality(tokenId: string) {
  const stats = await query(
    `
    WITH base AS (
      SELECT
        COUNT(*)::float8 AS total_cnt,
        COUNT(*) FILTER (
          WHERE COALESCE(from_label_type, 'unknown') <> 'unknown'
            AND COALESCE(to_label_type, 'unknown') <> 'unknown'
        )::float8 AS labeled_cnt,
        COUNT(*) FILTER (
          WHERE COALESCE(from_label_type, 'unknown') = 'exchange'
             OR COALESCE(to_label_type, 'unknown') = 'exchange'
        )::float8 AS exchange_cnt,
        COUNT(*) FILTER (
          WHERE COALESCE(from_label_type, 'unknown') = 'smart_money'
             OR COALESCE(to_label_type, 'unknown') = 'smart_money'
             OR EXISTS (
               SELECT 1 FROM smart_money_wallets sm
               WHERE sm.chain = whale_transfers.chain
                 AND sm.is_active = true
                 AND (
                   lower(sm.wallet_address) = lower(whale_transfers.from_address)
                   OR lower(sm.wallet_address) = lower(whale_transfers.to_address)
                 )
             )
        )::float8 AS smart_cnt
      FROM whale_transfers
      WHERE token_id = $1::uuid
        AND block_time >= NOW() - INTERVAL '30 day'
    ),
    holder AS (
      SELECT COUNT(DISTINCT stat_date)::int AS holder_days
      FROM whale_holder_daily_stats
      WHERE token_id = $1::uuid
        AND stat_date >= NOW()::date - INTERVAL '120 day'
    )
    SELECT
      b.total_cnt,
      b.labeled_cnt,
      b.exchange_cnt,
      b.smart_cnt,
      h.holder_days
    FROM base b
    CROSS JOIN holder h
    `,
    [tokenId]
  );

  const row = stats.rows[0] || {};
  const totalCnt = toNum(row.total_cnt);
  const transferCoverage = totalCnt > 0 ? toNum(row.labeled_cnt) / totalCnt : 0;
  const exchangeCoverage = totalCnt > 0 ? toNum(row.exchange_cnt) / totalCnt : 0;
  const smartCoverage = totalCnt > 0 ? toNum(row.smart_cnt) / totalCnt : 0;
  const holderDays = Math.max(0, Math.round(toNum(row.holder_days)));
  const holderDepthScore = clampScore((holderDays / 30) * 100);

  const confidence = clampScore(
    transferCoverage * 100 * 0.35 +
      holderDepthScore * 0.2 +
      exchangeCoverage * 100 * 0.2 +
      smartCoverage * 100 * 0.25
  );

  return {
    transfer_coverage: transferCoverage,
    holder_history_depth_days: holderDays,
    exchange_label_coverage: exchangeCoverage,
    smart_money_label_coverage: smartCoverage,
    confidence_score: confidence,
    confidence_level: confidenceLevel(confidence),
  };
}

async function computePlayabilityForToken(tokenId: string) {
  const [flowRes, riskRes, unlockRes, marketRes, smartRes, quality, whaleDeltaRes] = await Promise.all([
    query(
      `
      SELECT COALESCE(SUM(netflow), 0)::float8 AS exchange_netflow_7d
      FROM whale_exchange_flow_daily
      WHERE token_id = $1::uuid
        AND stat_date >= NOW()::date - INTERVAL '7 day'
      `,
      [tokenId]
    ),
    query(
      `
      SELECT top10_concentration::float8 AS top10, top20_concentration::float8 AS top20
      FROM whale_holder_daily_stats
      WHERE token_id = $1::uuid
      ORDER BY stat_date DESC
      LIMIT 1
      `,
      [tokenId]
    ),
    query(
      `
      SELECT unlock_date, pct_supply
      FROM whale_unlock_events
      WHERE token_id = $1::uuid
        AND unlock_date >= NOW()::date
      ORDER BY unlock_date ASC
      LIMIT 1
      `,
      [tokenId]
    ),
    query(
      `
      WITH transfer_window AS (
        SELECT
          block_time,
          COALESCE(usd_value, 0)::float8 AS usd_value,
          CASE
            WHEN amount_decimal IS NOT NULL AND amount_decimal > 0
              AND usd_value IS NOT NULL AND usd_value > 0
            THEN usd_value / amount_decimal
            ELSE NULL
          END AS implied_price
        FROM whale_transfers
        WHERE token_id = $1::uuid
          AND block_time >= NOW() - INTERVAL '14 day'
      ),
      buckets AS (
        SELECT
          AVG(implied_price) FILTER (WHERE block_time >= NOW() - INTERVAL '1 day')::float8 AS p_24h,
          COALESCE(SUM(ABS(usd_value)) FILTER (WHERE block_time >= NOW() - INTERVAL '1 day'), 0)::float8 AS volume_24h
        FROM transfer_window
      )
      SELECT p_24h, volume_24h FROM buckets
      `,
      [tokenId]
    ),
    query(
      `
      WITH smart_wallets AS (
        SELECT chain, lower(wallet_address) AS wallet
        FROM smart_money_wallets
        WHERE is_active = true
        UNION
        SELECT chain, lower(wallet_address) AS wallet
        FROM whale_wallet_labels
        WHERE label_type = 'smart_money'
      )
      SELECT
        COALESCE(SUM(t.amount_decimal) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM smart_wallets s
            WHERE s.chain = t.chain
              AND s.wallet = lower(t.to_address)
          )
        ), 0)::float8
        -
        COALESCE(SUM(t.amount_decimal) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM smart_wallets s
            WHERE s.chain = t.chain
              AND s.wallet = lower(t.from_address)
          )
        ), 0)::float8
        AS smart_money_inflow_7d,
        COALESCE(SUM(t.amount_decimal) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM smart_wallets s
            WHERE s.chain = t.chain
              AND s.wallet = lower(t.to_address)
          )
        ), 0)::float8 AS smart_inflow,
        COALESCE(SUM(t.amount_decimal) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM smart_wallets s
            WHERE s.chain = t.chain
              AND s.wallet = lower(t.from_address)
          )
        ), 0)::float8 AS smart_outflow
      FROM whale_transfers t
      WHERE t.token_id = $1::uuid
        AND t.block_time >= NOW() - INTERVAL '7 day'
      `,
      [tokenId]
    ),
    getDataQuality(tokenId),
    query(
      `
      WITH latest_ts AS (
        SELECT MAX(snapshot_at) AS ts
        FROM whale_holder_snapshots
        WHERE token_id = $1::uuid
      ),
      prev_ts AS (
        SELECT MIN(snapshot_at) AS ts
        FROM whale_holder_snapshots
        WHERE token_id = $1::uuid
          AND snapshot_at >= CURRENT_DATE - INTERVAL '7 day'
      ),
      latest AS (
        SELECT wallet_address, pct_supply
        FROM whale_holder_snapshots
        WHERE token_id = $1::uuid
          AND snapshot_at = (SELECT ts FROM latest_ts)
      ),
      prev AS (
        SELECT wallet_address, pct_supply
        FROM whale_holder_snapshots
        WHERE token_id = $1::uuid
          AND snapshot_at = (SELECT ts FROM prev_ts)
      )
      SELECT
        COUNT(*) FILTER (
          WHERE l.pct_supply >= 0.001
            AND COALESCE(p.pct_supply, 0) < 0.001
        )::int AS new_whales,
        COUNT(*) FILTER (
          WHERE COALESCE(p.pct_supply, 0) >= 0.001
            AND l.pct_supply < 0.001
        )::int AS reduced_whales
      FROM latest l
      LEFT JOIN prev p ON p.wallet_address = l.wallet_address
      `,
      [tokenId]
    ),
  ]);

  const snapshots = await query(
    `
    WITH ranked AS (
      SELECT
        s.snapshot_at,
        SUM(
          CASE
            WHEN wl.label_type IS NULL OR wl.label_type NOT IN ('exchange', 'burn', 'lp', 'staking', 'bridge', 'treasury', 'vesting')
            THEN s.balance
            ELSE 0
          END
        )::float8 AS whale_balance,
        ROW_NUMBER() OVER (ORDER BY s.snapshot_at ASC) AS rn_asc,
        ROW_NUMBER() OVER (ORDER BY s.snapshot_at DESC) AS rn_desc
      FROM whale_holder_snapshots s
      LEFT JOIN whale_wallet_labels wl
        ON wl.chain = s.chain
       AND lower(wl.wallet_address) = lower(s.wallet_address)
      WHERE s.token_id = $1::uuid
        AND s.snapshot_at >= CURRENT_DATE - INTERVAL '7 day'
      GROUP BY s.snapshot_at
    )
    SELECT
      COALESCE(MAX(whale_balance) FILTER (WHERE rn_desc = 1), 0)::float8
      -
      COALESCE(MAX(whale_balance) FILTER (WHERE rn_asc = 1), 0)::float8 AS whale_accumulation_7d
    FROM ranked
    `,
    [tokenId]
  );

  const risk = riskRes.rows[0] || {};
  const unlock = unlockRes.rows[0] || null;
  const flow = flowRes.rows[0] || {};
  const market = marketRes.rows[0] || {};
  const smart = smartRes.rows[0] || {};
  const whaleDelta = whaleDeltaRes.rows[0] || {};

  const top10 = toNum(risk.top10);
  const top20 = toNum(risk.top20);
  const concentrationLevel = concentrationRiskLevel(top10, top20);

  const unlockDate = unlock ? new Date(unlock.unlock_date) : null;
  const daysToUnlock =
    unlockDate && Number.isFinite(unlockDate.getTime())
      ? Math.max(0, Math.ceil((unlockDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;
  const unlockPct = unlock ? toNum(unlock.pct_supply) : 0;
  const unlockLevel = unlockRiskLevel(daysToUnlock, unlockPct);

  const smartMoneyInflow7d = toNum(smart.smart_money_inflow_7d);
  const whaleAccumulation7d = toNum(snapshots.rows[0]?.whale_accumulation_7d);
  const exchangeNetflow7d = toNum(flow.exchange_netflow_7d);
  const newWhales = toNum(whaleDelta.new_whales);
  const reducedWhales = toNum(whaleDelta.reduced_whales);
  const volume24h = toNum(market.volume_24h);
  const liquidity = volume24h * 0.15;

  const exchangePressureScore = clampScore(100 - scoreByThreshold(exchangeNetflow7d, 0, 1000000));
  const liquidityScore = scoreByThreshold(liquidity, PLAYABLE_LIQUIDITY_MIN, PLAYABLE_LIQUIDITY_MIN * 4);
  const volumeScore = scoreByThreshold(volume24h, PLAYABLE_VOLUME_MIN, PLAYABLE_VOLUME_MIN * 4);
  const smartMoneyScore = scoreByThreshold(smartMoneyInflow7d, 0, 1000000);
  const whaleAccumulationScore = scoreByThreshold(whaleAccumulation7d, 0, 1000000);
  const unlockRiskScore = unlockLevel === "high" ? 90 : unlockLevel === "medium" ? 55 : 20;
  const concentrationRiskScore = concentrationLevel === "high" ? 90 : concentrationLevel === "medium" ? 55 : 20;
  const dataConfidenceScore = quality.confidence_score;

  let rawScore = 0;
  if (whaleAccumulation7d > 0) rawScore += 30;
  if (newWhales > reducedWhales) rawScore += 20;
  if (exchangeNetflow7d < 0) rawScore += 20;
  if (exchangeNetflow7d > 0) rawScore -= 30;
  if (daysToUnlock != null && daysToUnlock <= 7) rawScore -= 25;
  if (top10 > 0.5) rawScore -= 15;

  const playabilityScore = clampScore(rawScore);
  const tradeState = decideTradeState({
    score: rawScore,
    smartMoneyInflow7d,
    whaleAccumulation7d,
    exchangeNetflow7d,
    daysToUnlock,
    top10Concentration: top10,
    liquidity,
    volume24h,
  });
  const isPlayable = isPlayableState(tradeState);

  const reasons: string[] = [];
  reasons.push(`Whale netflow 7d: ${whaleAccumulation7d.toFixed(2)}`);
  reasons.push(`Exchange netflow 7d: ${exchangeNetflow7d.toFixed(2)}`);
  reasons.push(`New whales vs reduced: ${newWhales} vs ${reducedWhales}`);
  reasons.push(`Unlock risk: ${daysToUnlock != null && daysToUnlock <= 7 ? "near unlock" : "no near unlock"}`);
  reasons.push(`Top10 concentration: ${(top10 * 100).toFixed(2)}%`);
  reasons.push(`Smart money inflow 7d: ${smartMoneyInflow7d.toFixed(2)}`);

  return {
    token_id: tokenId,
    playability_score: playabilityScore,
    trade_state: tradeState,
    is_playable: isPlayable,
    smart_money_inflow_7d: smartMoneyInflow7d,
    whale_accumulation_7d: whaleAccumulation7d,
    exchange_pressure_score: exchangePressureScore,
    liquidity_score: liquidityScore,
    volume_score: volumeScore,
    unlock_risk_score: unlockRiskScore,
    concentration_risk_score: concentrationRiskScore,
    data_confidence_score: dataConfidenceScore,
    reasons,
    updated_at: new Date().toISOString(),
  };
}

async function upsertPlayabilitySnapshot(playability: {
  token_id: string;
  playability_score: number;
  trade_state: string;
  is_playable: boolean;
  smart_money_inflow_7d: number;
  whale_accumulation_7d: number;
  exchange_pressure_score: number;
  liquidity_score: number;
  volume_score: number;
  unlock_risk_score: number;
  concentration_risk_score: number;
  data_confidence_score: number;
  reasons: string[];
}) {
  await query(
    `
    INSERT INTO token_playability_score (
      id,
      token_id,
      playability_score,
      trade_state,
      is_playable,
      smart_money_inflow_7d,
      whale_accumulation_7d,
      exchange_pressure_score,
      liquidity_score,
      volume_score,
      unlock_risk_score,
      concentration_risk_score,
      data_confidence_score,
      reasons_json,
      created_at,
      updated_at
    )
    VALUES (
      uuid_generate_v4(),
      $1::uuid,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12,
      $13::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT (token_id)
    DO UPDATE SET
      playability_score = EXCLUDED.playability_score,
      trade_state = EXCLUDED.trade_state,
      is_playable = EXCLUDED.is_playable,
      smart_money_inflow_7d = EXCLUDED.smart_money_inflow_7d,
      whale_accumulation_7d = EXCLUDED.whale_accumulation_7d,
      exchange_pressure_score = EXCLUDED.exchange_pressure_score,
      liquidity_score = EXCLUDED.liquidity_score,
      volume_score = EXCLUDED.volume_score,
      unlock_risk_score = EXCLUDED.unlock_risk_score,
      concentration_risk_score = EXCLUDED.concentration_risk_score,
      data_confidence_score = EXCLUDED.data_confidence_score,
      reasons_json = EXCLUDED.reasons_json,
      updated_at = NOW()
    `,
    [
      playability.token_id,
      playability.playability_score,
      playability.trade_state,
      playability.is_playable,
      playability.smart_money_inflow_7d,
      playability.whale_accumulation_7d,
      playability.exchange_pressure_score,
      playability.liquidity_score,
      playability.volume_score,
      playability.unlock_risk_score,
      playability.concentration_risk_score,
      playability.data_confidence_score,
      JSON.stringify(playability.reasons),
    ]
  );
}

export const analyticsResolvers = {
  Query: {
    whaleDataFreshness: async (_: unknown, args: { tokenId: string }) => {
      const res = await query(
        `
        SELECT
          GREATEST(
            COALESCE((SELECT updated_at FROM whale_tokens WHERE id = $1::uuid), to_timestamp(0)),
            COALESCE((SELECT MAX(created_at) FROM whale_holder_snapshots WHERE token_id = $1::uuid), to_timestamp(0)),
            COALESCE((SELECT MAX(created_at) FROM whale_transfers WHERE token_id = $1::uuid), to_timestamp(0)),
            COALESCE((SELECT MAX(created_at) FROM whale_holder_daily_stats WHERE token_id = $1::uuid), to_timestamp(0)),
            COALESCE((SELECT MAX(created_at) FROM whale_exchange_flow_daily WHERE token_id = $1::uuid), to_timestamp(0)),
            COALESCE((SELECT MAX(created_at) FROM whale_signals WHERE token_id = $1::uuid), to_timestamp(0)),
            COALESCE((SELECT MAX(updated_at) FROM whale_unlock_events WHERE token_id = $1::uuid), to_timestamp(0)),
            COALESCE((SELECT MAX(updated_at) FROM wallet_performance_stats WHERE token_id = $1::uuid), to_timestamp(0)),
            COALESCE((SELECT MAX(updated_at) FROM token_playability_score WHERE token_id = $1::uuid), to_timestamp(0)),
            COALESCE((SELECT MAX(updated_at) FROM smart_money_wallets), to_timestamp(0))
          ) AS last_updated
        `,
        [args.tokenId]
      );

      const raw = res.rows[0]?.last_updated as Date | string | null | undefined;
      const parsed = raw ? new Date(raw) : null;
      const hasDbValue = Boolean(parsed && Number.isFinite(parsed.getTime()) && parsed.getTime() > 0);

      return {
        token_id: args.tokenId,
        last_updated: hasDbValue ? parsed!.toISOString() : null,
        source: hasDbValue ? "db" : "client",
      };
    },

    whaleMarketSummary: async (_: unknown, args: { tokenId: string }) => {
      const tokenRes = await query(
        `SELECT id, total_supply, circulating_supply FROM whale_tokens WHERE id = $1::uuid LIMIT 1`,
        [args.tokenId]
      );

      const token = tokenRes.rows[0] || { total_supply: 0, circulating_supply: 0 };

      const priceRes = await query(
        `
        WITH transfer_window AS (
          SELECT block_time,
                 COALESCE(usd_value, 0)::float8 AS usd_value,
                 CASE
                   WHEN amount_decimal IS NOT NULL AND amount_decimal > 0
                        AND usd_value IS NOT NULL AND usd_value > 0
                   THEN usd_value / amount_decimal
                   ELSE NULL
                 END AS implied_price
          FROM whale_transfers
          WHERE token_id = $1::uuid
            AND block_time >= NOW() - INTERVAL '14 day'
        ),
        buckets AS (
          SELECT
            AVG(implied_price) FILTER (WHERE block_time >= NOW() - INTERVAL '1 day')::float8 AS p_24h,
            AVG(implied_price) FILTER (
              WHERE block_time >= NOW() - INTERVAL '2 day'
                AND block_time < NOW() - INTERVAL '1 day'
            )::float8 AS p_prev_24h,
            AVG(implied_price) FILTER (WHERE block_time >= NOW() - INTERVAL '7 day')::float8 AS p_7d,
            AVG(implied_price) FILTER (
              WHERE block_time >= NOW() - INTERVAL '14 day'
                AND block_time < NOW() - INTERVAL '7 day'
            )::float8 AS p_prev_7d,
            COALESCE(SUM(ABS(usd_value)) FILTER (WHERE block_time >= NOW() - INTERVAL '1 day'), 0)::float8 AS volume_24h
          FROM transfer_window
        )
        SELECT * FROM buckets
        `,
        [args.tokenId]
      );

      const row = priceRes.rows[0] || {};
      const price = toNum(row.p_24h);
      const volume24h = toNum(row.volume_24h);
      const marketCap = price * toNum(token.circulating_supply);
      const fdv = price * toNum(token.total_supply);

      return {
        token_id: args.tokenId,
        price,
        price_change_24h_pct: pctChange(price, toNum(row.p_prev_24h)),
        price_change_7d_pct: pctChange(toNum(row.p_7d), toNum(row.p_prev_7d)),
        volume_24h: volume24h,
        market_cap: marketCap,
        liquidity: volume24h * 0.15,
        fdv,
        circulating_supply: toNum(token.circulating_supply),
        total_supply: toNum(token.total_supply),
      };
    },

    whaleRiskSummary: async (_: unknown, args: { tokenId: string }) => {
      const [statsRes, unlockRes, flowRes, labelRes] = await Promise.all([
        query(
          `
          SELECT top10_concentration, top20_concentration
          FROM whale_holder_daily_stats
          WHERE token_id = $1::uuid
          ORDER BY stat_date DESC
          LIMIT 1
          `,
          [args.tokenId]
        ),
        query(
          `
          SELECT unlock_date, pct_supply
          FROM whale_unlock_events
          WHERE token_id = $1::uuid
            AND unlock_date >= NOW()::date
          ORDER BY unlock_date ASC
          LIMIT 1
          `,
          [args.tokenId]
        ),
        query(
          `
          WITH base AS (
            SELECT
              COUNT(*)::float8 AS total_cnt,
              COUNT(*) FILTER (
                WHERE COALESCE(from_label_type, 'unknown') = 'unknown'
                   OR COALESCE(to_label_type, 'unknown') = 'unknown'
              )::float8 AS unknown_cnt,
              COUNT(*) FILTER (WHERE is_internal_like)::float8 AS internal_cnt,
              COUNT(*) FILTER (
                WHERE is_exchange_in
                  AND amount_decimal >= 10000
              )::float8 AS large_holder_to_exchange_cnt,
              COUNT(*) FILTER (
                WHERE COALESCE(from_label_type, '') IN ('team', 'treasury', 'vesting')
                   OR COALESCE(to_label_type, '') IN ('team', 'treasury', 'vesting')
              )::float8 AS treasury_team_movement_cnt
            FROM whale_transfers
            WHERE token_id = $1::uuid
              AND block_time >= NOW() - INTERVAL '7 day'
          )
          SELECT * FROM base
          `,
          [args.tokenId]
        ),
        query(
          `
          SELECT COALESCE(AVG(confidence_score), 0)::float8 AS avg_conf
          FROM whale_wallet_labels
          WHERE confidence_score IS NOT NULL
          `
        ),
      ]);

      const stats = statsRes.rows[0] || {};
      const unlock = unlockRes.rows[0] || null;
      const flow = flowRes.rows[0] || {};
      const label = labelRes.rows[0] || {};

      const top10 = toNum(stats.top10_concentration);
      const top20 = toNum(stats.top20_concentration);

      const unlockDate = unlock ? new Date(unlock.unlock_date) : null;
      const daysToUnlock =
        unlockDate && Number.isFinite(unlockDate.getTime())
          ? Math.max(0, Math.ceil((unlockDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : null;

      const totalCnt = toNum(flow.total_cnt);

      return {
        token_id: args.tokenId,
        top10_concentration: top10,
        top20_concentration: top20,
        next_unlock_date: unlock?.unlock_date ?? null,
        next_unlock_pct_supply: unlock ? toNum(unlock.pct_supply) : null,
        days_to_next_unlock: daysToUnlock,
        concentration_risk_level: concentrationRiskLevel(top10, top20),
        unlock_risk_level: unlockRiskLevel(daysToUnlock, unlock ? toNum(unlock.pct_supply) : 0),
        unknown_flow_ratio_7d: totalCnt > 0 ? toNum(flow.unknown_cnt) / totalCnt : 0,
        internal_transfer_ratio_7d: totalCnt > 0 ? toNum(flow.internal_cnt) / totalCnt : 0,
        avg_label_confidence: toNum(label.avg_conf),
        treasury_team_movement_count_7d: Math.round(toNum(flow.treasury_team_movement_cnt)),
        large_holder_to_exchange_count_7d: Math.round(toNum(flow.large_holder_to_exchange_cnt)),
      };
    },

    whaleHolderBehavior: async (_: unknown, args: { tokenId: string }) => {
      const [trendRes, deltaRes, whalesRes, smartMoneyRes] = await Promise.all([
        query(
          `
          WITH latest AS (
            SELECT MAX(stat_date) AS d
            FROM whale_holder_daily_stats
            WHERE token_id = $1::uuid
          )
          SELECT
            COALESCE((SELECT holder_count FROM whale_holder_daily_stats WHERE token_id = $1::uuid AND stat_date = (SELECT d FROM latest)), 0)::int AS holder_0d,
            COALESCE((SELECT holder_count FROM whale_holder_daily_stats WHERE token_id = $1::uuid AND stat_date <= (SELECT d - INTERVAL '1 day' FROM latest) ORDER BY stat_date DESC LIMIT 1), 0)::int AS holder_1d,
            COALESCE((SELECT holder_count FROM whale_holder_daily_stats WHERE token_id = $1::uuid AND stat_date <= (SELECT d - INTERVAL '7 day' FROM latest) ORDER BY stat_date DESC LIMIT 1), 0)::int AS holder_7d,
            COALESCE((SELECT holder_count FROM whale_holder_daily_stats WHERE token_id = $1::uuid AND stat_date <= (SELECT d - INTERVAL '30 day' FROM latest) ORDER BY stat_date DESC LIMIT 1), 0)::int AS holder_30d,
            COALESCE((SELECT whale_holder_count FROM whale_holder_daily_stats WHERE token_id = $1::uuid AND stat_date = (SELECT d FROM latest)), 0)::int AS whale_holder_0d,
            COALESCE((SELECT whale_holder_count FROM whale_holder_daily_stats WHERE token_id = $1::uuid AND stat_date <= (SELECT d - INTERVAL '1 day' FROM latest) ORDER BY stat_date DESC LIMIT 1), 0)::int AS whale_holder_1d,
            COALESCE((SELECT whale_holder_count FROM whale_holder_daily_stats WHERE token_id = $1::uuid AND stat_date <= (SELECT d - INTERVAL '7 day' FROM latest) ORDER BY stat_date DESC LIMIT 1), 0)::int AS whale_holder_7d,
            COALESCE((SELECT whale_holder_count FROM whale_holder_daily_stats WHERE token_id = $1::uuid AND stat_date <= (SELECT d - INTERVAL '30 day' FROM latest) ORDER BY stat_date DESC LIMIT 1), 0)::int AS whale_holder_30d
          `,
          [args.tokenId]
        ),
        query(
          `
          WITH dates AS (
            SELECT
              NOW()::date AS d0,
              (NOW()::date - INTERVAL '1 day')::date AS d1,
              (NOW()::date - INTERVAL '7 day')::date AS d7,
              (NOW()::date - INTERVAL '30 day')::date AS d30
          ),
          latest AS (
            SELECT wallet_address
            FROM whale_holder_snapshots
            WHERE token_id = $1::uuid
              AND snapshot_at >= (SELECT d0 FROM dates)
          ),
          d1 AS (
            SELECT wallet_address
            FROM whale_holder_snapshots
            WHERE token_id = $1::uuid
              AND snapshot_at >= (SELECT d1 FROM dates)
              AND snapshot_at < (SELECT d0 FROM dates)
          ),
          d7 AS (
            SELECT wallet_address
            FROM whale_holder_snapshots
            WHERE token_id = $1::uuid
              AND snapshot_at >= (SELECT d7 FROM dates)
              AND snapshot_at < (SELECT d0 FROM dates)
          ),
          d30 AS (
            SELECT wallet_address
            FROM whale_holder_snapshots
            WHERE token_id = $1::uuid
              AND snapshot_at >= (SELECT d30 FROM dates)
              AND snapshot_at < (SELECT d0 FROM dates)
          )
          SELECT
            (SELECT COUNT(*) FROM latest l WHERE NOT EXISTS (SELECT 1 FROM d1 x WHERE x.wallet_address = l.wallet_address))::int AS new_1d,
            (SELECT COUNT(*) FROM latest l WHERE NOT EXISTS (SELECT 1 FROM d7 x WHERE x.wallet_address = l.wallet_address))::int AS new_7d,
            (SELECT COUNT(*) FROM latest l WHERE NOT EXISTS (SELECT 1 FROM d30 x WHERE x.wallet_address = l.wallet_address))::int AS new_30d,
            (SELECT COUNT(*) FROM d1 x WHERE NOT EXISTS (SELECT 1 FROM latest l WHERE l.wallet_address = x.wallet_address))::int AS lost_1d,
            (SELECT COUNT(*) FROM d7 x WHERE NOT EXISTS (SELECT 1 FROM latest l WHERE l.wallet_address = x.wallet_address))::int AS lost_7d,
            (SELECT COUNT(*) FROM d30 x WHERE NOT EXISTS (SELECT 1 FROM latest l WHERE l.wallet_address = x.wallet_address))::int AS lost_30d
          `,
          [args.tokenId]
        ),
        query(
          `
          WITH latest_ts AS (
            SELECT MAX(snapshot_at) AS ts FROM whale_holder_snapshots WHERE token_id = $1::uuid
          ),
          prev_ts AS (
            SELECT MIN(snapshot_at) AS ts
            FROM whale_holder_snapshots
            WHERE token_id = $1::uuid
              AND snapshot_at >= CURRENT_DATE - INTERVAL '7 day'
          ),
          latest AS (
            SELECT wallet_address, balance, pct_supply
            FROM whale_holder_snapshots
            WHERE token_id = $1::uuid
              AND snapshot_at = (SELECT ts FROM latest_ts)
          ),
          prev AS (
            SELECT wallet_address, balance, pct_supply
            FROM whale_holder_snapshots
            WHERE token_id = $1::uuid
              AND snapshot_at = (SELECT ts FROM prev_ts)
          )
          SELECT
            COUNT(*) FILTER (
              WHERE l.pct_supply >= $2::numeric
                AND COALESCE(p.pct_supply, 0) < $2::numeric
            )::int AS new_large_holders_7d,
            COUNT(*) FILTER (
              WHERE COALESCE(p.pct_supply, 0) >= $2::numeric
                AND l.pct_supply < $2::numeric
            )::int AS large_holders_exiting_7d,
            COUNT(*) FILTER (
              WHERE l.pct_supply >= $2::numeric
                AND l.balance < COALESCE(p.balance, l.balance)
            )::int AS whales_reduced_position_7d
          FROM latest l
          LEFT JOIN prev p ON p.wallet_address = l.wallet_address
          `,
          [args.tokenId, HOLDER_WHALE_THRESHOLD]
        ),
        query(
          `
          SELECT
            COALESCE(SUM(amount_decimal) FILTER (WHERE to_label_type = 'smart_money'), 0)::float8
            -
            COALESCE(SUM(amount_decimal) FILTER (WHERE from_label_type = 'smart_money'), 0)::float8
            AS smart_money_netflow_7d
          FROM whale_transfers
          WHERE token_id = $1::uuid
            AND block_time >= NOW() - INTERVAL '7 day'
          `,
          [args.tokenId]
        ),
      ]);

      const t = trendRes.rows[0] || {};
      const d = deltaRes.rows[0] || {};
      const w = whalesRes.rows[0] || {};
      const s = smartMoneyRes.rows[0] || {};

      return {
        token_id: args.tokenId,
        holder_count_1d: toNum(t.holder_1d),
        holder_count_7d: toNum(t.holder_7d),
        holder_count_30d: toNum(t.holder_30d),
        whale_holder_count_1d: toNum(t.whale_holder_1d),
        whale_holder_count_7d: toNum(t.whale_holder_7d),
        whale_holder_count_30d: toNum(t.whale_holder_30d),
        new_holders_1d: toNum(d.new_1d),
        new_holders_7d: toNum(d.new_7d),
        new_holders_30d: toNum(d.new_30d),
        lost_holders_1d: toNum(d.lost_1d),
        lost_holders_7d: toNum(d.lost_7d),
        lost_holders_30d: toNum(d.lost_30d),
        new_large_holders_7d: toNum(w.new_large_holders_7d),
        large_holders_exiting_7d: toNum(w.large_holders_exiting_7d),
        whales_reduced_position_7d: toNum(w.whales_reduced_position_7d),
        smart_money_netflow_7d: toNum(s.smart_money_netflow_7d),
      };
    },

    whaleTopHoldersAdvanced: async (
      _: unknown,
      args: {
        tokenId: string;
        limit?: number;
        hideExchange?: boolean;
        hideContracts?: boolean;
        onlySmartMoney?: boolean;
        whaleThresholdPct?: number;
      }
    ) => {
      const limit = Math.max(1, Math.min(toNum(args.limit || 50), 200));
      const whaleThreshold = Math.max(0, toNum(args.whaleThresholdPct || 0));

      const res = await query(
        `
        WITH latest_ts AS (
          SELECT MAX(snapshot_at) AS ts
          FROM whale_holder_snapshots
          WHERE token_id = $1::uuid
        ),
        ts_24h AS (
          SELECT MAX(snapshot_at) AS ts
          FROM whale_holder_snapshots
          WHERE token_id = $1::uuid
            AND snapshot_at <= NOW() - INTERVAL '1 day'
        ),
        ts_7d AS (
          SELECT MAX(snapshot_at) AS ts
          FROM whale_holder_snapshots
            WHERE token_id = $1::uuid
              AND snapshot_at <= CURRENT_DATE - INTERVAL '7 day'
        ),
        latest AS (
          SELECT s.wallet_address, s.balance, s.pct_supply, s.chain
          FROM whale_holder_snapshots s
          WHERE s.token_id = $1::uuid
            AND s.snapshot_at = (SELECT ts FROM latest_ts)
        ),
        b24 AS (
          SELECT wallet_address, balance
          FROM whale_holder_snapshots
          WHERE token_id = $1::uuid
            AND snapshot_at = (SELECT ts FROM ts_24h)
        ),
        b7 AS (
          SELECT wallet_address, balance
          FROM whale_holder_snapshots
          WHERE token_id = $1::uuid
            AND snapshot_at = (SELECT ts FROM ts_7d)
        ),
        tx AS (
          SELECT
            lower(from_address) AS wallet,
            -COALESCE(SUM(amount_decimal), 0)::float8 AS flow,
            MIN(block_time) AS first_seen,
            MAX(block_time) AS last_seen
          FROM whale_transfers
          WHERE token_id = $1::uuid
            AND block_time >= NOW() - INTERVAL '7 day'
          GROUP BY lower(from_address)
          UNION ALL
          SELECT
            lower(to_address) AS wallet,
            COALESCE(SUM(amount_decimal), 0)::float8 AS flow,
            MIN(block_time) AS first_seen,
            MAX(block_time) AS last_seen
          FROM whale_transfers
          WHERE token_id = $1::uuid
            AND block_time >= NOW() - INTERVAL '7 day'
          GROUP BY lower(to_address)
        ),
        tx_agg AS (
          SELECT wallet,
                 COALESCE(SUM(flow), 0)::float8 AS netflow_7d,
                 MIN(first_seen) AS first_seen,
                 MAX(last_seen) AS last_active
          FROM tx
          GROUP BY wallet
        )
        SELECT
          l.wallet_address,
          l.balance::float8 AS balance,
          l.pct_supply::float8 AS pct_supply,
          (l.balance - COALESCE(b24.balance, l.balance))::float8 AS balance_change_24h,
          (l.balance - COALESCE(b7.balance, l.balance))::float8 AS balance_change_7d,
          COALESCE(t.netflow_7d, 0)::float8 AS netflow_7d,
          t.first_seen,
          t.last_active,
          w.id AS label_id,
          w.chain AS label_chain,
          w.wallet_address AS label_wallet_address,
          w.label_type AS label_label_type,
          w.label_name AS label_label_name,
          w.confidence_score AS label_confidence_score,
          w.source AS label_source,
          w.created_at AS label_created_at,
          w.updated_at AS label_updated_at
        FROM latest l
        LEFT JOIN b24 ON lower(b24.wallet_address) = lower(l.wallet_address)
        LEFT JOIN b7 ON lower(b7.wallet_address) = lower(l.wallet_address)
        LEFT JOIN tx_agg t ON lower(t.wallet) = lower(l.wallet_address)
        LEFT JOIN whale_wallet_labels w
          ON w.chain = l.chain AND lower(w.wallet_address) = lower(l.wallet_address)
        WHERE ($2::boolean = false OR COALESCE(w.label_type, '') <> 'exchange')
          AND ($3::boolean = false OR COALESCE(w.label_type, '') NOT IN ('bridge', 'lp', 'staking'))
          AND ($4::boolean = false OR COALESCE(w.label_type, '') = 'smart_money')
          AND l.pct_supply >= $5::numeric
        ORDER BY l.balance DESC
        LIMIT $6::int
        `,
        [
          args.tokenId,
          Boolean(args.hideExchange),
          Boolean(args.hideContracts),
          Boolean(args.onlySmartMoney),
          whaleThreshold,
          limit,
        ]
      );

      return res.rows.map((row: any) => {
        const labelType = (row.label_label_type as string | null) ?? null;
        const pctSupply = toNum(row.pct_supply);
        const netflow7d = toNum(row.netflow_7d);
        return {
          wallet_address: row.wallet_address,
          balance: toNum(row.balance),
          pct_supply: pctSupply,
          balance_change_24h: toNum(row.balance_change_24h),
          balance_change_7d: toNum(row.balance_change_7d),
          netflow_7d: netflow7d,
          first_seen: row.first_seen,
          last_active: row.last_active,
          risk_tag: holderRiskTag(labelType, pctSupply, netflow7d),
          label: row.label_id
            ? {
                id: row.label_id,
                chain: row.label_chain,
                wallet_address: row.label_wallet_address,
                label_type: row.label_label_type,
                label_name: row.label_label_name,
                confidence_score: row.label_confidence_score,
                source: row.label_source,
                created_at: row.label_created_at,
                updated_at: row.label_updated_at,
              }
            : null,
        };
      });
    },

    whaleHolderStatsSeries: async (
      _: unknown,
      args: { tokenId: string; fromDate: string; toDate: string }
    ) => {
      const res = await query(
        `
        SELECT
          stat_date,
          holder_count,
          whale_holder_count,
          top10_concentration::float8 AS top10_concentration,
          top20_concentration::float8 AS top20_concentration
        FROM whale_holder_daily_stats
        WHERE token_id = $1::uuid
          AND stat_date BETWEEN $2::date AND $3::date
        ORDER BY stat_date ASC
        `,
        [args.tokenId, args.fromDate, args.toDate]
      );
      return res.rows;
    },

    whaleWalletPerformanceStats: async (
      _: unknown,
      args: { tokenId: string; lookbackDays?: number; limit?: number }
    ) => {
      const lookbackDays = Math.max(1, Math.min(toNum(args.lookbackDays || 30), 180));
      const limit = Math.max(1, Math.min(toNum(args.limit || 20), 200));

      const res = await query(
        `
        SELECT
          s.token_id,
          s.chain,
          s.wallet_address,
          s.lookback_days,
          s.inflow_amount::float8 AS inflow_amount,
          s.outflow_amount::float8 AS outflow_amount,
          s.netflow_amount::float8 AS netflow_amount,
          s.avg_entry_price::float8 AS avg_entry_price,
          s.avg_exit_price::float8 AS avg_exit_price,
          s.realized_pnl_pct::float8 AS realized_pnl_pct,
          s.unrealized_pnl_pct::float8 AS unrealized_pnl_pct,
          s.win_rate::float8 AS win_rate,
          s.trades_count,
          s.last_active,
          l.label_name
        FROM wallet_performance_stats s
        LEFT JOIN whale_wallet_labels l
          ON l.chain = s.chain
         AND lower(l.wallet_address) = lower(s.wallet_address)
        WHERE s.token_id = $1::uuid
          AND s.lookback_days = $2::int
        ORDER BY s.netflow_amount DESC
        LIMIT $3::int
        `,
        [args.tokenId, lookbackDays, limit]
      );

      return res.rows;
    },

    whaleDataQuality: async (_: unknown, args: { tokenId: string }) => {
      const quality = await getDataQuality(args.tokenId);
      return {
        token_id: args.tokenId,
        ...quality,
      };
    },

    whalePlayability: async (_: unknown, args: { tokenId: string }) => {
      const cached = await query(
        `
        SELECT
          token_id,
          playability_score::float8 AS playability_score,
          trade_state,
          is_playable,
          smart_money_inflow_7d::float8 AS smart_money_inflow_7d,
          whale_accumulation_7d::float8 AS whale_accumulation_7d,
          exchange_pressure_score::float8 AS exchange_pressure_score,
          liquidity_score::float8 AS liquidity_score,
          volume_score::float8 AS volume_score,
          unlock_risk_score::float8 AS unlock_risk_score,
          concentration_risk_score::float8 AS concentration_risk_score,
          data_confidence_score::float8 AS data_confidence_score,
          reasons_json,
          updated_at
        FROM token_playability_score
        WHERE token_id = $1::uuid
        LIMIT 1
        `,
        [args.tokenId]
      );

      if (cached.rows.length > 0) {
        const row = cached.rows[0] as any;
        return {
          ...row,
          reasons: Array.isArray(row.reasons_json) ? row.reasons_json.map((x: unknown) => String(x)) : [],
        };
      }

      const playability = await computePlayabilityForToken(args.tokenId);
      await upsertPlayabilitySnapshot(playability);
      return playability;
    },

    whaleWatchlists: async (_: unknown, args: { limit?: number }) => {
      const limit = Math.max(1, Math.min(toNum(args.limit || 5), 30));

      const [topSmart, topAccum, topAvoid] = await Promise.all([
        query(
          `
          SELECT
            t.id AS token_id,
            t.symbol,
            t.name,
            t.chain,
            COALESCE(p.trade_state, 'Wait') AS trade_state,
            COALESCE(p.playability_score, 0)::float8 AS playability_score,
            COALESCE(p.smart_money_inflow_7d, 0)::float8 AS smart_money_inflow_7d,
            COALESCE(p.whale_accumulation_7d, 0)::float8 AS whale_accumulation_7d,
            COALESCE(p.liquidity_score, 0)::float8 AS liquidity_score,
            COALESCE(p.volume_score, 0)::float8 AS volume_score
          FROM whale_tokens t
          LEFT JOIN token_playability_score p ON p.token_id = t.id
          ORDER BY COALESCE(p.smart_money_inflow_7d, 0) DESC, COALESCE(p.playability_score, 0) DESC
          LIMIT $1::int
          `,
          [limit]
        ),
        query(
          `
          SELECT
            t.id AS token_id,
            t.symbol,
            t.name,
            t.chain,
            COALESCE(p.trade_state, 'Wait') AS trade_state,
            COALESCE(p.playability_score, 0)::float8 AS playability_score,
            COALESCE(p.smart_money_inflow_7d, 0)::float8 AS smart_money_inflow_7d,
            COALESCE(p.whale_accumulation_7d, 0)::float8 AS whale_accumulation_7d,
            COALESCE(p.liquidity_score, 0)::float8 AS liquidity_score,
            COALESCE(p.volume_score, 0)::float8 AS volume_score
          FROM whale_tokens t
          LEFT JOIN token_playability_score p ON p.token_id = t.id
          ORDER BY COALESCE(p.whale_accumulation_7d, 0) DESC, COALESCE(p.playability_score, 0) DESC
          LIMIT $1::int
          `,
          [limit]
        ),
        query(
          `
          SELECT
            t.id AS token_id,
            t.symbol,
            t.name,
            t.chain,
            COALESCE(p.trade_state, 'Wait') AS trade_state,
            COALESCE(p.playability_score, 0)::float8 AS playability_score,
            COALESCE(p.smart_money_inflow_7d, 0)::float8 AS smart_money_inflow_7d,
            COALESCE(p.whale_accumulation_7d, 0)::float8 AS whale_accumulation_7d,
            COALESCE(p.liquidity_score, 0)::float8 AS liquidity_score,
            COALESCE(p.volume_score, 0)::float8 AS volume_score
          FROM whale_tokens t
          LEFT JOIN token_playability_score p ON p.token_id = t.id
          ORDER BY COALESCE(p.playability_score, 0) ASC, COALESCE(p.concentration_risk_score, 0) DESC
          LIMIT $1::int
          `,
          [limit]
        ),
      ]);

      return {
        top_smart_money_inflow: topSmart.rows,
        top_early_accumulation: topAccum.rows,
        top_avoid: topAvoid.rows,
      };
    },

    whaleScanner: async (_: unknown, args: { limit?: number }) => {
      const limit = Math.max(1, Math.min(toNum(args.limit || 20), 100));
      const res = await query(
        `
        SELECT
          r.token_id,
          t.symbol,
          t.name,
          t.chain,
          r.whale_score::float8 AS whale_score,
          r.smart_money_score::float8 AS smart_money_score,
          r.exchange_pressure_score::float8 AS exchange_pressure_score,
          r.concentration_risk_score::float8 AS concentration_risk_score,
          r.unlock_risk_score::float8 AS unlock_risk_score,
          r.final_trade_state,
          r.reason_json,
          r.updated_at
        FROM whale_scanner_results r
        JOIN whale_tokens t ON t.id = r.token_id
        ORDER BY r.updated_at DESC
        LIMIT $1::int
        `,
        [limit]
      );
      return res.rows;
    },

    whaleTopOpportunities: async (_: unknown, args: { limit?: number }) => {
      const limit = Math.max(1, Math.min(toNum(args.limit || 10), 100));
      const res = await query(
        `
        SELECT
          r.token_id,
          t.symbol,
          t.name,
          t.chain,
          r.whale_score::float8 AS whale_score,
          r.smart_money_score::float8 AS smart_money_score,
          r.exchange_pressure_score::float8 AS exchange_pressure_score,
          r.concentration_risk_score::float8 AS concentration_risk_score,
          r.unlock_risk_score::float8 AS unlock_risk_score,
          r.final_trade_state,
          r.reason_json,
          r.updated_at
        FROM whale_scanner_results r
        JOIN whale_tokens t ON t.id = r.token_id
        ORDER BY
          CASE
            WHEN r.final_trade_state IN ('STRONG_LONG', 'Strong Long') THEN 1
            WHEN r.final_trade_state IN ('LONG', 'Long') THEN 2
            WHEN r.final_trade_state IN ('WATCH', 'Watchlist') THEN 3
            WHEN r.final_trade_state IN ('WAIT', 'Wait') THEN 4
            WHEN r.final_trade_state IN ('SHORT_BIAS', 'Short Bias') THEN 5
            ELSE 6
          END,
          r.whale_score DESC,
          r.updated_at DESC
        LIMIT $1::int
        `,
        [limit]
      );
      return res.rows;
    },

    whaleLongAlerts: async (_: unknown, args: { limit?: number }) => {
      const limit = Math.max(1, Math.min(toNum(args.limit || 20), 200));
      const res = await query(
        `
        SELECT
          a.id,
          a.token_id,
          t.symbol,
          t.chain,
          a.alert_type,
          a.state,
          a.score::float8 AS score,
          a.confidence::float8 AS confidence,
          a.channel,
          a.message_text,
          a.status,
          a.created_at
        FROM whale_alert_events a
        JOIN whale_tokens t ON t.id = a.token_id
        ORDER BY a.created_at DESC
        LIMIT $1::int
        `,
        [limit]
      );
      return res.rows;
    },

    whaleSmartMoneySummary: async (_: unknown, args: { tokenId: string; limit?: number }) => {
      const limit = Math.max(1, Math.min(toNum(args.limit || 10), 50));

      const [summaryRes, topWalletsRes] = await Promise.all([
        query(
          `
          SELECT
            COUNT(*) FILTER (WHERE sm.is_active)::int AS active_wallets,
            COALESCE(AVG(sm.confidence_score), 0)::float8 AS avg_score,
            COALESCE(AVG(sm.win_rate), 0)::float8 AS avg_win_rate
          FROM smart_money_wallets sm
          WHERE EXISTS (
            SELECT 1
            FROM whale_holder_snapshots s
            WHERE s.token_id = $1::uuid
              AND s.chain = sm.chain
              AND lower(s.wallet_address) = lower(sm.wallet_address)
          )
          `,
          [args.tokenId]
        ),
        query(
          `
          SELECT
            s.token_id,
            s.chain,
            s.wallet_address,
            s.lookback_days,
            s.inflow_amount::float8 AS inflow_amount,
            s.outflow_amount::float8 AS outflow_amount,
            s.netflow_amount::float8 AS netflow_amount,
            s.avg_entry_price::float8 AS avg_entry_price,
            s.avg_exit_price::float8 AS avg_exit_price,
            s.realized_pnl_pct::float8 AS realized_pnl_pct,
            s.unrealized_pnl_pct::float8 AS unrealized_pnl_pct,
            s.win_rate::float8 AS win_rate,
            s.trades_count,
            s.last_active,
            l.label_name
          FROM wallet_performance_stats s
          LEFT JOIN whale_wallet_labels l
            ON l.chain = s.chain
           AND lower(l.wallet_address) = lower(s.wallet_address)
          WHERE s.token_id = $1::uuid
          ORDER BY s.netflow_amount DESC
          LIMIT $2::int
          `,
          [args.tokenId, limit]
        ),
      ]);

      const s = summaryRes.rows[0] || {};
      return {
        token_id: args.tokenId,
        active_wallets: toNum((s as any).active_wallets),
        avg_score: toNum((s as any).avg_score),
        avg_win_rate: toNum((s as any).avg_win_rate),
        top_wallets: topWalletsRes.rows,
      };
    },
  },
};
