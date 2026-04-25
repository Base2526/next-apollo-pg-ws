import type { PoolClient } from "pg";

import type { WhaleTokenRow } from "./types";
import { scannerLog } from "./logger";

const EXCLUDED_LABEL_TYPES = ["exchange", "burn", "lp", "staking", "bridge", "treasury", "vesting"];

function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function refreshSmartMoneyWallets(client: PoolClient, token: WhaleTokenRow): Promise<number> {
  const threshold = Number(process.env.WHALE_SMART_MONEY_MIN_SCORE || 70);

  const candidatesRes = await client.query<{
    wallet_address: string;
    inflow: number;
    outflow: number;
    netflow: number;
    trades_count: number;
    avg_early_entry_hours: number;
  }>(
    `
    WITH transfers AS (
      SELECT
        lower(t.to_address) AS wallet_address,
        COALESCE(t.amount_decimal, 0)::float8 AS inflow,
        0::float8 AS outflow,
        t.block_time,
        t.tx_hash
      FROM whale_transfers t
      WHERE t.token_id = $1::uuid
        AND t.block_time >= NOW() - INTERVAL '30 day'
      UNION ALL
      SELECT
        lower(t.from_address) AS wallet_address,
        0::float8 AS inflow,
        COALESCE(t.amount_decimal, 0)::float8 AS outflow,
        t.block_time,
        t.tx_hash
      FROM whale_transfers t
      WHERE t.token_id = $1::uuid
        AND t.block_time >= NOW() - INTERVAL '30 day'
    ),
    with_labels AS (
      SELECT tr.*, wl.label_type
      FROM transfers tr
      LEFT JOIN whale_wallet_labels wl
        ON wl.chain = $2
       AND lower(wl.wallet_address) = tr.wallet_address
    ),
    filtered AS (
      SELECT *
      FROM with_labels
      WHERE COALESCE(label_type, 'unknown') <> ALL($3::text[])
    ),
    token_start AS (
      SELECT MIN(block_time) AS first_transfer_at
      FROM whale_transfers
      WHERE token_id = $1::uuid
    )
    SELECT
      wallet_address,
      SUM(inflow)::float8 AS inflow,
      SUM(outflow)::float8 AS outflow,
      (SUM(inflow) - SUM(outflow))::float8 AS netflow,
      COUNT(DISTINCT tx_hash)::int AS trades_count,
      AVG(EXTRACT(EPOCH FROM (f.block_time - ts.first_transfer_at)) / 3600.0)::float8 AS avg_early_entry_hours
    FROM filtered f
    CROSS JOIN token_start ts
    GROUP BY wallet_address
    HAVING COUNT(DISTINCT tx_hash) >= 3
    ORDER BY netflow DESC
    LIMIT 300
    `,
    [token.id, token.chain, EXCLUDED_LABEL_TYPES]
  );

  let assigned = 0;
  for (const row of candidatesRes.rows) {
    const inflow = toNum(row.inflow);
    const outflow = toNum(row.outflow);
    const netflow = toNum(row.netflow);
    const tradesCount = toNum(row.trades_count);
    const earlyHours = toNum(row.avg_early_entry_hours);

    const convictionScore = Math.max(0, Math.min(100, netflow > 0 ? (netflow / Math.max(1, inflow)) * 100 : 0));
    const consistencyScore = Math.max(0, Math.min(100, tradesCount * 10));
    const earlyEntryScore = Math.max(0, Math.min(100, 100 - earlyHours / 24));
    const smartMoneyScore = Math.max(
      0,
      Math.min(100, convictionScore * 0.45 + consistencyScore * 0.35 + earlyEntryScore * 0.2)
    );

    const isSmart = smartMoneyScore >= threshold;
    const source = isSmart ? "inferred" : "inferred-low";

    await client.query(
      `
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
      VALUES (
        uuid_generate_v4(),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
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
        updated_at = NOW()
      `,
      [
        token.chain,
        row.wallet_address,
        isSmart ? "early_accumulator" : "candidate",
        Math.max(0, Math.min(1, convictionScore / 100)),
        Math.max(-1, Math.min(1, (netflow - outflow * 0.15) / Math.max(1, inflow + outflow))),
        Math.max(0, Math.min(100, 100 - convictionScore)),
        smartMoneyScore,
        isSmart,
        source,
      ]
    );

    await client.query(
      `
      INSERT INTO wallet_trade_history_summary (
        id,
        token_id,
        chain,
        wallet_address,
        early_entry_score,
        conviction_score,
        consistency_score,
        trade_quality_score,
        smart_money_score,
        classification_reason,
        updated_at,
        created_at
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
        NOW(),
        NOW()
      )
      ON CONFLICT (token_id, chain, wallet_address)
      DO UPDATE SET
        early_entry_score = EXCLUDED.early_entry_score,
        conviction_score = EXCLUDED.conviction_score,
        consistency_score = EXCLUDED.consistency_score,
        trade_quality_score = EXCLUDED.trade_quality_score,
        smart_money_score = EXCLUDED.smart_money_score,
        classification_reason = EXCLUDED.classification_reason,
        updated_at = NOW()
      `,
      [
        token.id,
        token.chain,
        row.wallet_address,
        earlyEntryScore,
        convictionScore,
        consistencyScore,
        Math.max(0, Math.min(100, convictionScore * 0.6 + consistencyScore * 0.4)),
        smartMoneyScore,
        `V1 heuristic: netflow=${netflow.toFixed(4)}, trades=${tradesCount}, earlyHours=${earlyHours.toFixed(2)}`,
      ]
    );

    if (isSmart) {
      assigned += 1;
      await client.query(
        `
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
        VALUES (
          uuid_generate_v4(),
          $1,
          $2,
          'smart_money',
          'inferred_smart_money',
          $3,
          'inferred',
          NOW(),
          NOW()
        )
        ON CONFLICT (chain, wallet_address)
        DO UPDATE SET
          label_type = 'smart_money',
          label_name = 'inferred_smart_money',
          confidence_score = GREATEST(whale_wallet_labels.confidence_score, EXCLUDED.confidence_score),
          source = 'inferred',
          updated_at = NOW()
        `,
        [token.chain, row.wallet_address, smartMoneyScore]
      );
    }
  }

  scannerLog("info", "smart money refresh completed", {
    tokenId: token.id,
    symbol: token.symbol,
    candidates: candidatesRes.rows.length,
    assigned,
  });

  return assigned;
}
