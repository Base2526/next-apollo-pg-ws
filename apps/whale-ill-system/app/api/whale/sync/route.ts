export const runtime = "nodejs";

import type { PoolClient } from "pg";
import { NextRequest, NextResponse } from "next/server";

import { ensureWhaleSchema, query, runInTransaction } from "../../../../lib/db";
import { decideTradeState, isPlayableState } from "../../../../lib/scanner/tradeState";

const DEFAULT_EXCLUDED = ["exchange", "burn", "lp", "staking", "bridge", "treasury", "vesting"];
const PLAYABLE_LIQUIDITY_MIN = 500000;
const PLAYABLE_VOLUME_MIN = 1000000;

function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function scoreByThreshold(value: number, baseline: number, high: number): number {
  if (value <= baseline) return 0;
  if (high <= baseline) return clampScore(value);
  return clampScore(((value - baseline) / (high - baseline)) * 100);
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

async function recomputeDailyStats(
  client: PoolClient,
  tokenId: string,
  fromDate: string,
  toDate: string
): Promise<void> {
  await client.query(
    `
    WITH days AS (
      SELECT generate_series($2::date, $3::date, INTERVAL '1 day')::date AS stat_date
    ),
    snap AS (
      SELECT
        d.stat_date,
        (
          SELECT MAX(s.snapshot_at)
          FROM whale_holder_snapshots s
          WHERE s.token_id = $1::uuid
            AND s.snapshot_at < (d.stat_date + INTERVAL '1 day')
        ) AS snapshot_at
      FROM days d
    ),
    ranked AS (
      SELECT
        s.stat_date,
        hs.wallet_address,
        hs.balance,
        hs.pct_supply,
        wl.label_type,
        ROW_NUMBER() OVER (PARTITION BY s.stat_date ORDER BY hs.balance DESC NULLS LAST) AS rn
      FROM snap s
      LEFT JOIN whale_holder_snapshots hs
        ON hs.token_id = $1::uuid
       AND hs.snapshot_at = s.snapshot_at
      LEFT JOIN whale_wallet_labels wl
        ON wl.chain = hs.chain
       AND lower(wl.wallet_address) = lower(hs.wallet_address)
    ),
    agg AS (
      SELECT
        stat_date,
        COUNT(*) FILTER (WHERE balance > 0)::int AS holder_count,
        COUNT(*) FILTER (
          WHERE balance > 0
            AND pct_supply >= 0.001
            AND (label_type IS NULL OR label_type <> ALL($4::text[]))
        )::int AS whale_holder_count,
        COALESCE(SUM(pct_supply) FILTER (WHERE rn <= 10), 0)::float8 AS top10,
        COALESCE(SUM(pct_supply) FILTER (WHERE rn <= 20), 0)::float8 AS top20,
        COALESCE(SUM(pct_supply) FILTER (WHERE rn <= 50), 0)::float8 AS top50
      FROM ranked
      GROUP BY stat_date
    )
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
    SELECT
      $1::uuid,
      a.stat_date,
      a.holder_count,
      a.whale_holder_count,
      a.top10,
      a.top20,
      a.top50,
      NOW()
    FROM agg a
    ON CONFLICT (token_id, stat_date)
    DO UPDATE SET
      holder_count = EXCLUDED.holder_count,
      whale_holder_count = EXCLUDED.whale_holder_count,
      top10_concentration = EXCLUDED.top10_concentration,
      top20_concentration = EXCLUDED.top20_concentration,
      top50_concentration = EXCLUDED.top50_concentration
    `,
    [tokenId, fromDate, toDate, DEFAULT_EXCLUDED]
  );
}

async function recomputeExchangeFlow(
  client: PoolClient,
  tokenId: string,
  fromDate: string,
  toDate: string
): Promise<void> {
  await client.query(
    `
    WITH days AS (
      SELECT generate_series($2::date, $3::date, INTERVAL '1 day')::date AS stat_date
    )
    INSERT INTO whale_exchange_flow_daily (
      token_id,
      stat_date,
      exchange_inflow,
      exchange_outflow,
      netflow,
      created_at
    )
    SELECT
      $1::uuid,
      d.stat_date,
      COALESCE(SUM(t.amount_decimal) FILTER (WHERE t.is_exchange_in), 0) AS exchange_inflow,
      COALESCE(SUM(t.amount_decimal) FILTER (WHERE t.is_exchange_out), 0) AS exchange_outflow,
      COALESCE(SUM(
        CASE
          WHEN t.is_exchange_in THEN t.amount_decimal
          WHEN t.is_exchange_out THEN -t.amount_decimal
          ELSE 0
        END
      ), 0) AS netflow,
      NOW()
    FROM days d
    LEFT JOIN whale_transfers t
      ON t.token_id = $1::uuid
     AND t.block_time >= d.stat_date
     AND t.block_time < (d.stat_date + INTERVAL '1 day')
    GROUP BY d.stat_date
    ON CONFLICT (token_id, stat_date)
    DO UPDATE SET
      exchange_inflow = EXCLUDED.exchange_inflow,
      exchange_outflow = EXCLUDED.exchange_outflow,
      netflow = EXCLUDED.netflow
    `,
    [tokenId, fromDate, toDate]
  );
}

async function recomputeSignals(
  client: PoolClient,
  tokenId: string,
  fromDate: string,
  toDate: string
): Promise<void> {
  await client.query(
    `
    DELETE FROM whale_signals
    WHERE token_id = $1::uuid
      AND signal_date BETWEEN $2::date AND $3::date
    `,
    [tokenId, fromDate, toDate]
  );

  const rows = await client.query(
    `
    WITH dates AS (
      SELECT generate_series($2::date, $3::date, INTERVAL '1 day')::date AS d
    ),
    flow AS (
      SELECT stat_date, exchange_inflow, exchange_outflow, netflow
      FROM whale_exchange_flow_daily
      WHERE token_id = $1::uuid
        AND stat_date BETWEEN $2::date AND $3::date
    ),
    stats AS (
      SELECT stat_date, top10_concentration, top20_concentration, top50_concentration
      FROM whale_holder_daily_stats
      WHERE token_id = $1::uuid
        AND stat_date BETWEEN $2::date AND $3::date
    ),
    unlocks AS (
      SELECT unlock_date, pct_supply
      FROM whale_unlock_events
      WHERE token_id = $1::uuid
        AND unlock_date BETWEEN $2::date AND ($3::date + INTERVAL '7 day')
    )
    SELECT
      d.d AS signal_date,
      COALESCE(f.netflow, 0)::float8 AS exchange_netflow,
      COALESCE(f.exchange_inflow, 0)::float8 AS exchange_inflow,
      COALESCE(f.exchange_outflow, 0)::float8 AS exchange_outflow,
      COALESCE(s.top10_concentration, 0)::float8 AS top10,
      COALESCE(MAX(u.pct_supply), 0)::float8 AS max_unlock_pct
    FROM dates d
    LEFT JOIN flow f ON f.stat_date = d.d
    LEFT JOIN stats s ON s.stat_date = d.d
    LEFT JOIN unlocks u ON u.unlock_date BETWEEN d.d AND (d.d + INTERVAL '7 day')
    GROUP BY d.d, f.netflow, f.exchange_inflow, f.exchange_outflow, s.top10_concentration
    ORDER BY d.d
    `,
    [tokenId, fromDate, toDate]
  );

  for (const row of rows.rows) {
    const signalDate = row.signal_date;
    const exchangeNetflow = toNum(row.exchange_netflow);
    const exchangeInflow = toNum(row.exchange_inflow);
    const exchangeOutflow = toNum(row.exchange_outflow);
    const top10 = toNum(row.top10);
    const maxUnlockPct = toNum(row.max_unlock_pct);
    const whaleNetflowProxy = -exchangeNetflow;

    const inserts: Array<{ type: string; score: number; reason: string; metadata: Record<string, unknown> }> = [];

    if (whaleNetflowProxy > 0 && exchangeNetflow < 0) {
      inserts.push({
        type: "accumulation",
        score: Math.min(100, Math.abs(exchangeNetflow) * 10),
        reason: "Whale proxy netflow positive while exchange netflow is negative.",
        metadata: { whaleNetflowProxy, exchangeNetflow },
      });
    }

    if (whaleNetflowProxy < 0 && exchangeInflow > 0) {
      inserts.push({
        type: "distribution",
        score: Math.min(100, Math.abs(exchangeInflow) * 10),
        reason: "Whale proxy netflow negative with positive exchange inflow.",
        metadata: { whaleNetflowProxy, exchangeInflow },
      });
    }

    if (top10 >= 0.5) {
      inserts.push({
        type: "concentration_risk",
        score: Math.min(100, top10 * 100),
        reason: "Top 10 concentration is above risk threshold.",
        metadata: { top10 },
      });
    }

    if (maxUnlockPct >= 0.02) {
      inserts.push({
        type: "unlock_risk",
        score: Math.min(100, maxUnlockPct * 1000),
        reason: "Material unlock event detected within 7 days.",
        metadata: { maxUnlockPct },
      });
    }

    if (exchangeInflow > exchangeOutflow * 1.5 && exchangeInflow > 0) {
      inserts.push({
        type: "exchange_inflow_spike",
        score: Math.min(100, exchangeInflow * 5),
        reason: "Exchange inflow spike relative to outflow.",
        metadata: { exchangeInflow, exchangeOutflow },
      });
    }

    if (exchangeOutflow > exchangeInflow * 1.5 && exchangeOutflow > 0) {
      inserts.push({
        type: "exchange_outflow_spike",
        score: Math.min(100, exchangeOutflow * 5),
        reason: "Exchange outflow spike relative to inflow.",
        metadata: { exchangeInflow, exchangeOutflow },
      });
    }

    for (const item of inserts) {
      await client.query(
        `
        INSERT INTO whale_signals (
          id,
          token_id,
          signal_type,
          signal_score,
          signal_reason,
          signal_date,
          metadata_json,
          created_at
        )
        VALUES (uuid_generate_v4(), $1::uuid, $2, $3, $4, $5::date, $6::jsonb, NOW())
        `,
        [tokenId, item.type, item.score, item.reason, signalDate, JSON.stringify(item.metadata)]
      );
    }
  }
}

async function recomputeWalletPerformanceStats(
  client: PoolClient,
  tokenId: string,
  lookbackDays: number
): Promise<void> {
  await client.query(
    `
    WITH smart_wallets AS (
      SELECT chain, lower(wallet_address) AS wallet
      FROM smart_money_wallets
      WHERE is_active = true
      UNION
      SELECT chain, lower(wallet_address) AS wallet
      FROM whale_wallet_labels
      WHERE label_type = 'smart_money'
    ),
    wallet_agg AS (
      SELECT
        t.token_id,
        t.chain,
        s.wallet AS wallet_address,
        COALESCE(SUM(t.amount_decimal) FILTER (WHERE lower(t.to_address) = s.wallet), 0)::float8 AS inflow_amount,
        COALESCE(SUM(t.amount_decimal) FILTER (WHERE lower(t.from_address) = s.wallet), 0)::float8 AS outflow_amount,
        COALESCE(SUM(t.amount_decimal) FILTER (WHERE lower(t.to_address) = s.wallet), 0)::float8
          - COALESCE(SUM(t.amount_decimal) FILTER (WHERE lower(t.from_address) = s.wallet), 0)::float8 AS netflow_amount,
        AVG(
          CASE
            WHEN lower(t.to_address) = s.wallet
              AND t.amount_decimal > 0
              AND t.usd_value > 0
            THEN t.usd_value / t.amount_decimal
            ELSE NULL
          END
        )::float8 AS avg_entry_price,
        AVG(
          CASE
            WHEN lower(t.from_address) = s.wallet
              AND t.amount_decimal > 0
              AND t.usd_value > 0
            THEN t.usd_value / t.amount_decimal
            ELSE NULL
          END
        )::float8 AS avg_exit_price,
        COUNT(*) FILTER (
          WHERE lower(t.from_address) = s.wallet
             OR lower(t.to_address) = s.wallet
        )::int AS trades_count,
        MAX(t.block_time) AS last_active
      FROM whale_transfers t
      JOIN smart_wallets s
        ON s.chain = t.chain
       AND (s.wallet = lower(t.from_address) OR s.wallet = lower(t.to_address))
      WHERE t.token_id = $1::uuid
        AND t.block_time >= NOW() - ($2::int || ' day')::interval
      GROUP BY t.token_id, t.chain, s.wallet
    )
    INSERT INTO wallet_performance_stats (
      id,
      token_id,
      chain,
      wallet_address,
      lookback_days,
      inflow_amount,
      outflow_amount,
      netflow_amount,
      avg_entry_price,
      avg_exit_price,
      realized_pnl_pct,
      unrealized_pnl_pct,
      win_rate,
      trades_count,
      last_active,
      created_at,
      updated_at
    )
    SELECT
      uuid_generate_v4(),
      w.token_id,
      w.chain,
      w.wallet_address,
      $2::int,
      w.inflow_amount,
      w.outflow_amount,
      w.netflow_amount,
      w.avg_entry_price,
      w.avg_exit_price,
      CASE
        WHEN w.avg_entry_price IS NOT NULL
         AND w.avg_exit_price IS NOT NULL
         AND w.avg_entry_price > 0
        THEN ((w.avg_exit_price - w.avg_entry_price) / w.avg_entry_price) * 100
        ELSE NULL
      END AS realized_pnl_pct,
      CASE
        WHEN w.avg_entry_price IS NOT NULL
         AND w.avg_exit_price IS NOT NULL
         AND w.avg_entry_price > 0
        THEN ((w.avg_exit_price - w.avg_entry_price) / w.avg_entry_price) * 100
        ELSE NULL
      END AS unrealized_pnl_pct,
      LEAST(
        1,
        GREATEST(
          0,
          0.5 + COALESCE(
            CASE
              WHEN w.avg_entry_price IS NOT NULL
               AND w.avg_exit_price IS NOT NULL
               AND w.avg_entry_price > 0
              THEN ((w.avg_exit_price - w.avg_entry_price) / w.avg_entry_price) * 0.5
              ELSE 0
            END,
            0
          )
        )
      )::float8 AS win_rate,
      w.trades_count,
      w.last_active,
      NOW(),
      NOW()
    FROM wallet_agg w
    ON CONFLICT (token_id, wallet_address, lookback_days)
    DO UPDATE SET
      inflow_amount = EXCLUDED.inflow_amount,
      outflow_amount = EXCLUDED.outflow_amount,
      netflow_amount = EXCLUDED.netflow_amount,
      avg_entry_price = EXCLUDED.avg_entry_price,
      avg_exit_price = EXCLUDED.avg_exit_price,
      realized_pnl_pct = EXCLUDED.realized_pnl_pct,
      unrealized_pnl_pct = EXCLUDED.unrealized_pnl_pct,
      win_rate = EXCLUDED.win_rate,
      trades_count = EXCLUDED.trades_count,
      last_active = EXCLUDED.last_active,
      updated_at = NOW()
    `,
    [tokenId, lookbackDays]
  );
}

async function recomputeTokenPlayability(
  client: PoolClient,
  tokenId: string
): Promise<void> {
  const [flowRes, riskRes, unlockRes, marketRes, smartRes, qualityRes, snapshotsRes, whaleDeltaRes] = await Promise.all([
    client.query(
      `
      SELECT COALESCE(SUM(netflow), 0)::float8 AS exchange_netflow_7d
      FROM whale_exchange_flow_daily
      WHERE token_id = $1::uuid
        AND stat_date >= NOW()::date - INTERVAL '7 day'
      `,
      [tokenId]
    ),
    client.query(
      `
      SELECT top10_concentration::float8 AS top10, top20_concentration::float8 AS top20
      FROM whale_holder_daily_stats
      WHERE token_id = $1::uuid
      ORDER BY stat_date DESC
      LIMIT 1
      `,
      [tokenId]
    ),
    client.query(
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
    client.query(
      `
      WITH transfer_window AS (
        SELECT block_time,
               COALESCE(usd_value, 0)::float8 AS usd_value
        FROM whale_transfers
        WHERE token_id = $1::uuid
          AND block_time >= NOW() - INTERVAL '1 day'
      )
      SELECT COALESCE(SUM(ABS(usd_value)), 0)::float8 AS volume_24h
      FROM transfer_window
      `,
      [tokenId]
    ),
    client.query(
      `
      SELECT
        COALESCE(SUM(netflow_amount), 0)::float8 AS smart_money_inflow_7d
      FROM wallet_performance_stats
      WHERE token_id = $1::uuid
        AND lookback_days = 30
      `,
      [tokenId]
    ),
    client.query(
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
      SELECT b.total_cnt, b.labeled_cnt, b.exchange_cnt, b.smart_cnt, h.holder_days
      FROM base b
      CROSS JOIN holder h
      `,
      [tokenId]
    ),
    client.query(
      `
      WITH ranked AS (
        SELECT
          s.snapshot_at,
          SUM(
            CASE
              WHEN wl.label_type IS NULL OR wl.label_type <> ALL($2::text[])
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
      [tokenId, DEFAULT_EXCLUDED]
    ),
    client.query(
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

  const flow = flowRes.rows[0] || {};
  const risk = riskRes.rows[0] || {};
  const unlock = unlockRes.rows[0] || null;
  const market = marketRes.rows[0] || {};
  const smart = smartRes.rows[0] || {};
  const quality = qualityRes.rows[0] || {};
  const snapshots = snapshotsRes.rows[0] || {};
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
  const whaleAccumulation7d = toNum(snapshots.whale_accumulation_7d);
  const exchangeNetflow7d = toNum(flow.exchange_netflow_7d);
  const newWhales = toNum(whaleDelta.new_whales);
  const reducedWhales = toNum(whaleDelta.reduced_whales);
  const volume24h = toNum(market.volume_24h);
  const liquidity = volume24h * 0.15;

  const totalCnt = toNum(quality.total_cnt);
  const transferCoverage = totalCnt > 0 ? toNum(quality.labeled_cnt) / totalCnt : 0;
  const exchangeCoverage = totalCnt > 0 ? toNum(quality.exchange_cnt) / totalCnt : 0;
  const smartCoverage = totalCnt > 0 ? toNum(quality.smart_cnt) / totalCnt : 0;
  const holderDays = Math.max(0, Math.round(toNum(quality.holder_days)));
  const holderDepthScore = clampScore((holderDays / 30) * 100);
  const dataConfidenceScore = clampScore(
    transferCoverage * 100 * 0.35 +
      holderDepthScore * 0.2 +
      exchangeCoverage * 100 * 0.2 +
      smartCoverage * 100 * 0.25
  );

  const exchangePressureScore = clampScore(100 - scoreByThreshold(exchangeNetflow7d, 0, 1000000));
  const liquidityScore = scoreByThreshold(liquidity, PLAYABLE_LIQUIDITY_MIN, PLAYABLE_LIQUIDITY_MIN * 4);
  const volumeScore = scoreByThreshold(volume24h, PLAYABLE_VOLUME_MIN, PLAYABLE_VOLUME_MIN * 4);
  const smartMoneyScore = scoreByThreshold(smartMoneyInflow7d, 0, 1000000);
  const whaleAccumulationScore = scoreByThreshold(whaleAccumulation7d, 0, 1000000);
  const unlockRiskScore = unlockLevel === "high" ? 90 : unlockLevel === "medium" ? 55 : 20;
  const concentrationRiskScore = concentrationLevel === "high" ? 90 : concentrationLevel === "medium" ? 55 : 20;

  let score = 0;
  if (whaleAccumulation7d > 0) score += 30;
  if (newWhales > reducedWhales) score += 20;
  if (exchangeNetflow7d < 0) score += 20;
  if (exchangeNetflow7d > 0) score -= 30;
  if (daysToUnlock != null && daysToUnlock <= 7) score -= 25;
  if (top10 > 0.5) score -= 15;

  const playabilityScore = clampScore(score);
  const tradeState = decideTradeState({
    score,
    smartMoneyInflow7d,
    whaleAccumulation7d,
    exchangeNetflow7d,
    daysToUnlock,
    top10Concentration: top10,
    liquidity,
    volume24h,
  });
  const isPlayable = isPlayableState(tradeState);

  const reasons = [
    `Whale netflow 7d: ${whaleAccumulation7d.toFixed(2)}`,
    `Exchange netflow 7d: ${exchangeNetflow7d.toFixed(2)}`,
    `New whales vs reduced: ${newWhales} vs ${reducedWhales}`,
    `Unlock risk: ${daysToUnlock != null && daysToUnlock <= 7 ? "near unlock" : "no near unlock"}`,
    `Top10 concentration: ${(top10 * 100).toFixed(2)}%`,
    `Smart money inflow 7d: ${smartMoneyInflow7d.toFixed(2)}`,
  ];

  await client.query(
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
      tokenId,
      playabilityScore,
      tradeState,
      isPlayable,
      smartMoneyInflow7d,
      whaleAccumulation7d,
      exchangePressureScore,
      liquidityScore,
      volumeScore,
      unlockRiskScore,
      concentrationRiskScore,
      dataConfidenceScore,
      JSON.stringify(reasons),
    ]
  );
}

function allowDemoData(): boolean {
  const value = String(process.env.ALLOW_DEMO_DATA || "false").toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function isDemoLikeToken(tokenAddress: string, symbol: string, name: string): boolean {
  const ta = tokenAddress.toLowerCase();
  const s = symbol.toLowerCase();
  const n = name.toLowerCase();
  return (
    ta.includes("demo") ||
    ta.includes("placeholder") ||
    ta.includes("mock") ||
    ta.includes("test") ||
    s === "sto" ||
    s === "soon" ||
    n.includes("demo") ||
    n.includes("mock") ||
    n.includes("test")
  );
}

async function getDbLastUpdated(tokenId: string): Promise<string | null> {
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
    [tokenId]
  );

  const raw = res.rows[0]?.last_updated as Date | string | null | undefined;
  const parsed = raw ? new Date(raw) : null;
  if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.getTime() <= 0) {
    return null;
  }
  return parsed.toISOString();
}

export async function POST(req: NextRequest) {
  try {
    await ensureWhaleSchema();

    const body = (await req.json().catch(() => null)) as { tokenId?: unknown } | null;
    const tokenId = typeof body?.tokenId === "string" ? body.tokenId.trim() : "";

    if (!tokenId) {
      return NextResponse.json(
        { ok: false, error: "tokenId is required" },
        { status: 400 }
      );
    }

    const tokenRes = await query(
      `
      SELECT id, token_address, symbol, name
      FROM whale_tokens
      WHERE id = $1::uuid
      LIMIT 1
      `,
      [tokenId]
    );
    if (tokenRes.rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Token not found" },
        { status: 404 }
      );
    }

    const token = tokenRes.rows[0] as {
      id: string;
      token_address: string;
      symbol: string;
      name: string;
    };
    if (!allowDemoData() && isDemoLikeToken(token.token_address, token.symbol, token.name)) {
      return NextResponse.json(
        { ok: false, error: "Demo token sync is disabled (ALLOW_DEMO_DATA=false)" },
        { status: 403 }
      );
    }

    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end.getTime() - 1000 * 60 * 60 * 24 * 30);

    const fromDate = start.toISOString().slice(0, 10);
    const toDate = end.toISOString().slice(0, 10);

    await runInTransaction(async (client) => {
      await recomputeDailyStats(client, tokenId, fromDate, toDate);
      await recomputeExchangeFlow(client, tokenId, fromDate, toDate);
      await recomputeSignals(client, tokenId, fromDate, toDate);
      await recomputeWalletPerformanceStats(client, tokenId, 30);
      await recomputeTokenPlayability(client, tokenId);
    });

    const timestamp = await getDbLastUpdated(tokenId);

    return NextResponse.json({
      ok: true,
      tokenId,
      timestamp: timestamp || new Date().toISOString(),
      source: timestamp ? "db" : "client",
      fromDate,
      toDate,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
