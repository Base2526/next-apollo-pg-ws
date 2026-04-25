import { query, runInTransaction } from "../lib/db";
import { requireWhaleAdmin, type WhaleContext, toNum } from "./utils";

const DEFAULT_EXCLUDED = ["exchange", "burn", "lp", "staking", "bridge", "treasury", "vesting"];

type SummaryRow = {
  whale_netflow_1d: number;
  whale_netflow_7d: number;
  exchange_netflow_1d: number;
  exchange_netflow_7d: number;
  holder_growth_7d: number;
  whale_holder_growth_7d: number;
  top10: number;
  top20: number;
};

function classifySignalState(row: SummaryRow): { state: "accumulation" | "neutral" | "distribution"; explanation: string } {
  if (row.whale_netflow_7d > 0 && row.exchange_netflow_7d < 0) {
    return {
      state: "accumulation",
      explanation:
        "Whale balances increased while exchange netflow was negative (net withdrawal from exchanges).",
    };
  }

  if (row.whale_netflow_7d < 0 && row.exchange_netflow_7d > 0) {
    return {
      state: "distribution",
      explanation:
        "Whale balances decreased while exchange netflow was positive (net deposits to exchanges).",
    };
  }

  return {
    state: "neutral",
    explanation: "No strong accumulation/distribution crossover signal in current window.",
  };
}

export const signalTypeDefs = /* GraphQL */ `
  extend type Query {
    whaleSignals(tokenId: ID!, fromDate: String!, toDate: String!): [WhaleSignal!]!
    whaleAccumulationSummary(tokenId: ID!, window: Int = 7): WhaleAccumulationSummary!
    whaleUnlockEvents(tokenId: ID!): [WhaleUnlockEvent!]!
  }

  extend type Mutation {
    upsertWhaleUnlockEvent(input: UpsertWhaleUnlockEventInput!): WhaleUnlockEvent!
    recomputeWhaleSignals(tokenId: ID!, fromDate: String!, toDate: String!): WhaleRecomputeResult!
  }
`;

async function getSummaryRow(tokenId: string, windowDays: number): Promise<SummaryRow> {
  const safeWindow = Math.max(1, Math.min(windowDays, 90));

  const res = await query(
    `
    WITH now_anchor AS (
      SELECT NOW()::date AS d
    ),
    daily AS (
      SELECT *
      FROM whale_holder_daily_stats h
      JOIN now_anchor n ON true
      WHERE h.token_id = $1::uuid
        AND h.stat_date BETWEEN (n.d - ($2::int * INTERVAL '1 day'))::date AND n.d
    ),
    flow AS (
      SELECT *
      FROM whale_exchange_flow_daily f
      JOIN now_anchor n ON true
      WHERE f.token_id = $1::uuid
        AND f.stat_date BETWEEN (n.d - ($2::int * INTERVAL '1 day'))::date AND n.d
    ),
    latest_day AS (
      SELECT MAX(stat_date) AS d FROM daily
    ),
    prev_day AS (
      SELECT (d - INTERVAL '1 day')::date AS d FROM latest_day
    ),
    latest_stats AS (
      SELECT * FROM daily WHERE stat_date = (SELECT d FROM latest_day)
    ),
    prev_stats AS (
      SELECT * FROM daily WHERE stat_date = (SELECT d FROM prev_day)
    ),
    snapshots AS (
      SELECT
        s.snapshot_at,
        SUM(CASE WHEN l.label_type IS NULL OR l.label_type <> ALL($3::text[]) THEN s.balance ELSE 0 END)::float8 AS whale_balance
      FROM whale_holder_snapshots s
      LEFT JOIN whale_wallet_labels l
        ON l.chain = s.chain AND lower(l.wallet_address) = lower(s.wallet_address)
      WHERE s.token_id = $1::uuid
        AND s.snapshot_at >= NOW() - ($2::int || ' day')::interval
      GROUP BY s.snapshot_at
    ),
    netflow_calc AS (
      SELECT
        COALESCE((SELECT whale_balance FROM snapshots ORDER BY snapshot_at DESC LIMIT 1), 0)
        -
        COALESCE((SELECT whale_balance FROM snapshots ORDER BY snapshot_at ASC LIMIT 1), 0) AS whale_netflow_7d,
        COALESCE((SELECT whale_balance FROM snapshots ORDER BY snapshot_at DESC LIMIT 1), 0)
        -
        COALESCE((SELECT whale_balance FROM snapshots ORDER BY snapshot_at DESC OFFSET 1 LIMIT 1), 0) AS whale_netflow_1d
    )
    SELECT
      COALESCE((SELECT whale_netflow_1d FROM netflow_calc), 0)::float8 AS whale_netflow_1d,
      COALESCE((SELECT whale_netflow_7d FROM netflow_calc), 0)::float8 AS whale_netflow_7d,
      COALESCE((SELECT SUM(netflow) FROM flow WHERE stat_date = (SELECT d FROM latest_day)), 0)::float8 AS exchange_netflow_1d,
      COALESCE((SELECT SUM(netflow) FROM flow), 0)::float8 AS exchange_netflow_7d,
      COALESCE((SELECT holder_count FROM latest_stats), 0) - COALESCE((SELECT holder_count FROM prev_stats), 0) AS holder_growth_7d,
      COALESCE((SELECT whale_holder_count FROM latest_stats), 0) - COALESCE((SELECT whale_holder_count FROM prev_stats), 0) AS whale_holder_growth_7d,
      COALESCE((SELECT top10_concentration FROM latest_stats), 0)::float8 AS top10,
      COALESCE((SELECT top20_concentration FROM latest_stats), 0)::float8 AS top20
    `,
    [tokenId, safeWindow, DEFAULT_EXCLUDED]
  );

  return {
    whale_netflow_1d: toNum(res.rows[0]?.whale_netflow_1d),
    whale_netflow_7d: toNum(res.rows[0]?.whale_netflow_7d),
    exchange_netflow_1d: toNum(res.rows[0]?.exchange_netflow_1d),
    exchange_netflow_7d: toNum(res.rows[0]?.exchange_netflow_7d),
    holder_growth_7d: toNum(res.rows[0]?.holder_growth_7d),
    whale_holder_growth_7d: toNum(res.rows[0]?.whale_holder_growth_7d),
    top10: toNum(res.rows[0]?.top10),
    top20: toNum(res.rows[0]?.top20),
  };
}

export const signalResolvers = {
  Query: {
    whaleSignals: async (
      _: unknown,
      args: { tokenId: string; fromDate: string; toDate: string }
    ) => {
      const res = await query(
        `
        SELECT *
        FROM whale_signals
        WHERE token_id = $1::uuid
          AND signal_date BETWEEN $2::date AND $3::date
        ORDER BY signal_date DESC, created_at DESC
        `,
        [args.tokenId, args.fromDate, args.toDate]
      );
      return res.rows;
    },

    whaleUnlockEvents: async (_: unknown, args: { tokenId: string }) => {
      const res = await query(
        `
        SELECT *
        FROM whale_unlock_events
        WHERE token_id = $1::uuid
        ORDER BY unlock_date ASC
        `,
        [args.tokenId]
      );
      return res.rows;
    },

    whaleAccumulationSummary: async (
      _: unknown,
      args: { tokenId: string; window?: number }
    ) => {
      const tokenRes = await query(`SELECT * FROM whale_tokens WHERE id = $1::uuid LIMIT 1`, [args.tokenId]);
      const token = tokenRes.rows[0];
      if (!token) throw new Error("Token not found");

      const summary = await getSummaryRow(args.tokenId, args.window ?? 7);
      const state = classifySignalState(summary);

      return {
        token,
        whaleNetflow1d: summary.whale_netflow_1d,
        whaleNetflow7d: summary.whale_netflow_7d,
        exchangeNetflow1d: summary.exchange_netflow_1d,
        exchangeNetflow7d: summary.exchange_netflow_7d,
        holderGrowth7d: summary.holder_growth_7d,
        whaleHolderGrowth7d: summary.whale_holder_growth_7d,
        top10Concentration: summary.top10,
        top20Concentration: summary.top20,
        signalState: state.state,
        explanation: state.explanation,
      };
    },
  },

  Mutation: {
    upsertWhaleUnlockEvent: async (
      _: unknown,
      args: {
        input: {
          id?: string;
          token_id: string;
          unlock_date: string;
          amount: number;
          pct_supply?: number;
          source?: string;
          note?: string;
        };
      },
      ctx: WhaleContext
    ) => {
      requireWhaleAdmin(ctx);
      const i = args.input;
      const res = await query(
        `
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
        VALUES (
          COALESCE($1::uuid, uuid_generate_v4()),
          $2::uuid,
          $3::date,
          $4,
          $5,
          $6,
          $7,
          NOW(),
          NOW()
        )
        ON CONFLICT (token_id, unlock_date, source)
        DO UPDATE SET
          amount = EXCLUDED.amount,
          pct_supply = EXCLUDED.pct_supply,
          note = EXCLUDED.note,
          updated_at = NOW()
        RETURNING *
        `,
        [
          i.id ?? null,
          i.token_id,
          i.unlock_date,
          i.amount,
          i.pct_supply ?? null,
          i.source ?? "manual",
          i.note ?? null,
        ]
      );
      return res.rows[0];
    },

    recomputeWhaleSignals: async (
      _: unknown,
      args: { tokenId: string; fromDate: string; toDate: string },
      ctx: WhaleContext
    ) => {
      requireWhaleAdmin(ctx);

      const result = await runInTransaction(async (client) => {
        await client.query(
          `
          DELETE FROM whale_signals
          WHERE token_id = $1::uuid
            AND signal_date BETWEEN $2::date AND $3::date
          `,
          [args.tokenId, args.fromDate, args.toDate]
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
            COALESCE(s.top20_concentration, 0)::float8 AS top20,
            COALESCE(s.top50_concentration, 0)::float8 AS top50,
            COALESCE(MAX(u.pct_supply), 0)::float8 AS max_unlock_pct
          FROM dates d
          LEFT JOIN flow f ON f.stat_date = d.d
          LEFT JOIN stats s ON s.stat_date = d.d
          LEFT JOIN unlocks u ON u.unlock_date BETWEEN d.d AND (d.d + INTERVAL '7 day')
          GROUP BY d.d, f.netflow, f.exchange_inflow, f.exchange_outflow, s.top10_concentration, s.top20_concentration, s.top50_concentration
          ORDER BY d.d
          `,
          [args.tokenId, args.fromDate, args.toDate]
        );

        let signalsWritten = 0;

        for (const row of rows.rows) {
          const signalDate = row.signal_date;
          const exchangeNetflow = toNum(row.exchange_netflow);
          const exchangeInflow = toNum(row.exchange_inflow);
          const exchangeOutflow = toNum(row.exchange_outflow);
          const top10 = toNum(row.top10);
          const maxUnlockPct = toNum(row.max_unlock_pct);
          const whaleNetflowProxy = -exchangeNetflow;

          const toInsert: Array<{ type: string; score: number; reason: string; metadata: Record<string, unknown> }> = [];

          if (whaleNetflowProxy > 0 && exchangeNetflow < 0) {
            toInsert.push({
              type: "accumulation",
              score: Math.min(100, Math.abs(exchangeNetflow) * 10),
              reason: "Whale proxy netflow positive while exchange netflow is negative.",
              metadata: { whaleNetflowProxy, exchangeNetflow },
            });
          }

          if (whaleNetflowProxy < 0 && exchangeInflow > 0) {
            toInsert.push({
              type: "distribution",
              score: Math.min(100, Math.abs(exchangeInflow) * 10),
              reason: "Whale proxy netflow negative with positive exchange inflow.",
              metadata: { whaleNetflowProxy, exchangeInflow },
            });
          }

          if (top10 >= 0.5) {
            toInsert.push({
              type: "concentration_risk",
              score: Math.min(100, top10 * 100),
              reason: "Top 10 concentration is above risk threshold.",
              metadata: { top10 },
            });
          }

          if (maxUnlockPct >= 0.02) {
            toInsert.push({
              type: "unlock_risk",
              score: Math.min(100, maxUnlockPct * 1000),
              reason: "Material unlock event detected within 7 days.",
              metadata: { maxUnlockPct },
            });
          }

          if (exchangeInflow > exchangeOutflow * 1.5 && exchangeInflow > 0) {
            toInsert.push({
              type: "exchange_inflow_spike",
              score: Math.min(100, exchangeInflow * 5),
              reason: "Exchange inflow spike relative to outflow.",
              metadata: { exchangeInflow, exchangeOutflow },
            });
          }

          if (exchangeOutflow > exchangeInflow * 1.5 && exchangeOutflow > 0) {
            toInsert.push({
              type: "exchange_outflow_spike",
              score: Math.min(100, exchangeOutflow * 5),
              reason: "Exchange outflow spike relative to inflow.",
              metadata: { exchangeInflow, exchangeOutflow },
            });
          }

          for (const s of toInsert) {
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
              [args.tokenId, s.type, s.score, s.reason, signalDate, JSON.stringify(s.metadata)]
            );
            signalsWritten += 1;
          }
        }

        return signalsWritten;
      });

      return {
        token_id: args.tokenId,
        date: args.toDate,
        signals_written: result,
        stats_updated: false,
      };
    },
  },
};
