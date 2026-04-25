import { query } from "../lib/db";
import { requireWhaleAdmin, type WhaleContext } from "./utils";

const DEFAULT_EXCLUDED = ["exchange", "burn", "lp", "staking", "bridge", "treasury", "vesting"];

export const holderTypeDefs = /* GraphQL */ `
  extend type Query {
    whaleHolders(tokenId: ID!, limit: Int = 100, offset: Int = 0, snapshotAt: String): [WhaleHolderSnapshot!]!
    whaleTopHolders(
      tokenId: ID!
      limit: Int = 20
      snapshotAt: String
      excludeLabelTypes: [WhaleWalletLabelType!]
    ): [WhaleHolderSnapshot!]!
    whaleHolderChange(tokenId: ID!, fromDate: String!, toDate: String!): [WhaleHolderChangePoint!]!
    whaleConcentration(tokenId: ID!, snapshotAt: String): WhaleConcentration!
  }

  extend type Mutation {
    insertWhaleHolderSnapshot(input: InsertWhaleHolderSnapshotInput!): WhaleHolderSnapshot!
    recomputeWhaleDailyStats(tokenId: ID!, date: String!): WhaleRecomputeResult!
  }
`;

export const holderResolvers = {
  Query: {
    whaleHolders: async (
      _: unknown,
      args: { tokenId: string; limit?: number; offset?: number; snapshotAt?: string }
    ) => {
      const limit = Math.min(Math.max(Number(args.limit ?? 100), 1), 500);
      const offset = Math.max(Number(args.offset ?? 0), 0);

      const res = await query(
        `
        WITH target_snapshot AS (
          SELECT COALESCE($4::timestamptz, (
            SELECT MAX(snapshot_at) FROM whale_holder_snapshots WHERE token_id = $1::uuid
          )) AS snapshot_at
        )
        SELECT s.*, l.id AS label_id, l.chain AS label_chain,
               l.wallet_address AS label_wallet_address,
               l.label_type AS label_label_type,
               l.label_name AS label_label_name,
               l.confidence_score AS label_confidence_score,
               l.source AS label_source,
               l.created_at AS label_created_at,
               l.updated_at AS label_updated_at
        FROM whale_holder_snapshots s
        JOIN target_snapshot ts ON ts.snapshot_at = s.snapshot_at
        LEFT JOIN whale_wallet_labels l
          ON l.chain = s.chain AND lower(l.wallet_address) = lower(s.wallet_address)
        WHERE s.token_id = $1::uuid
        ORDER BY s.balance DESC
        LIMIT $2 OFFSET $3
        `,
        [args.tokenId, limit, offset, args.snapshotAt ?? null]
      );

      return res.rows.map((row: any) => ({
        ...row,
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
      }));
    },

    whaleTopHolders: async (
      _: unknown,
      args: {
        tokenId: string;
        limit?: number;
        snapshotAt?: string;
        excludeLabelTypes?: string[];
      }
    ) => {
      const limit = Math.min(Math.max(Number(args.limit ?? 20), 1), 200);
      const excluded = args.excludeLabelTypes?.length ? args.excludeLabelTypes : [];

      const res = await query(
        `
        WITH target_snapshot AS (
          SELECT COALESCE($3::timestamptz, (
            SELECT MAX(snapshot_at) FROM whale_holder_snapshots WHERE token_id = $1::uuid
          )) AS snapshot_at
        )
        SELECT s.*, l.id AS label_id, l.chain AS label_chain,
               l.wallet_address AS label_wallet_address,
               l.label_type AS label_label_type,
               l.label_name AS label_label_name,
               l.confidence_score AS label_confidence_score,
               l.source AS label_source,
               l.created_at AS label_created_at,
               l.updated_at AS label_updated_at
        FROM whale_holder_snapshots s
        JOIN target_snapshot ts ON ts.snapshot_at = s.snapshot_at
        LEFT JOIN whale_wallet_labels l
          ON l.chain = s.chain AND lower(l.wallet_address) = lower(s.wallet_address)
        WHERE s.token_id = $1::uuid
          AND (
            COALESCE(array_length($2::text[], 1), 0) = 0
            OR l.label_type IS NULL
            OR l.label_type <> ALL($2::text[])
          )
        ORDER BY s.balance DESC
        LIMIT $4
        `,
        [args.tokenId, excluded, args.snapshotAt ?? null, limit]
      );

      return res.rows.map((row: any) => ({
        ...row,
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
      }));
    },

    whaleHolderChange: async (
      _: unknown,
      args: { tokenId: string; fromDate: string; toDate: string }
    ) => {
      const res = await query(
        `
        SELECT token_id, stat_date, holder_count, whale_holder_count
        FROM whale_holder_daily_stats
        WHERE token_id = $1::uuid
          AND stat_date BETWEEN $2::date AND $3::date
        ORDER BY stat_date ASC
        `,
        [args.tokenId, args.fromDate, args.toDate]
      );
      return res.rows;
    },

    whaleConcentration: async (_: unknown, args: { tokenId: string; snapshotAt?: string }) => {
      const res = await query(
        `
        WITH target_snapshot AS (
          SELECT COALESCE($2::timestamptz, (
            SELECT MAX(snapshot_at) FROM whale_holder_snapshots WHERE token_id = $1::uuid
          )) AS snapshot_at
        ), ranked AS (
          SELECT
            s.pct_supply,
            ROW_NUMBER() OVER (ORDER BY s.balance DESC) AS rn,
            ts.snapshot_at
          FROM whale_holder_snapshots s
          JOIN target_snapshot ts ON ts.snapshot_at = s.snapshot_at
          WHERE s.token_id = $1::uuid
        )
        SELECT
          $1::uuid AS token_id,
          MIN(snapshot_at) AS snapshot_at,
          COALESCE(SUM(pct_supply) FILTER (WHERE rn <= 10), 0)::float8 AS top10,
          COALESCE(SUM(pct_supply) FILTER (WHERE rn <= 20), 0)::float8 AS top20,
          COALESCE(SUM(pct_supply) FILTER (WHERE rn <= 50), 0)::float8 AS top50
        FROM ranked
        `,
        [args.tokenId, args.snapshotAt ?? null]
      );

      return (
        res.rows[0] ?? {
          token_id: args.tokenId,
          snapshot_at: args.snapshotAt ?? new Date().toISOString(),
          top10: 0,
          top20: 0,
          top50: 0,
        }
      );
    },
  },

  Mutation: {
    insertWhaleHolderSnapshot: async (
      _: unknown,
      args: {
        input: {
          token_id: string;
          chain: string;
          wallet_address: string;
          balance: number;
          pct_supply: number;
          snapshot_at: string;
        };
      },
      ctx: WhaleContext
    ) => {
      requireWhaleAdmin(ctx);
      const input = args.input;
      const res = await query(
        `
        INSERT INTO whale_holder_snapshots (
          token_id,
          chain,
          wallet_address,
          balance,
          pct_supply,
          snapshot_at,
          created_at
        )
        VALUES ($1::uuid, $2, lower($3), $4, $5, $6::timestamptz, NOW())
        ON CONFLICT (token_id, wallet_address, snapshot_at)
        DO UPDATE SET
          balance = EXCLUDED.balance,
          pct_supply = EXCLUDED.pct_supply
        RETURNING *
        `,
        [
          input.token_id,
          input.chain,
          input.wallet_address,
          input.balance,
          input.pct_supply,
          input.snapshot_at,
        ]
      );
      return res.rows[0];
    },

    recomputeWhaleDailyStats: async (
      _: unknown,
      args: { tokenId: string; date: string },
      ctx: WhaleContext
    ) => {
      requireWhaleAdmin(ctx);

      const statDate = args.date;
      const stats = await query(
        `
        WITH snap AS (
          SELECT MAX(snapshot_at) AS snapshot_at
          FROM whale_holder_snapshots
          WHERE token_id = $1::uuid
            AND snapshot_at < ($2::date + INTERVAL '1 day')
        ), ranked AS (
          SELECT
            s.wallet_address,
            s.balance,
            s.pct_supply,
            ROW_NUMBER() OVER (ORDER BY s.balance DESC) AS rn,
            l.label_type
          FROM whale_holder_snapshots s
          JOIN snap ON snap.snapshot_at = s.snapshot_at
          LEFT JOIN whale_wallet_labels l
            ON l.chain = s.chain AND lower(l.wallet_address) = lower(s.wallet_address)
          WHERE s.token_id = $1::uuid
        )
        SELECT
          COUNT(*) FILTER (WHERE balance > 0)::int AS holder_count,
          COUNT(*) FILTER (
            WHERE balance > 0
              AND pct_supply >= 0.001
              AND (label_type IS NULL OR label_type <> ALL($3::text[]))
          )::int AS whale_holder_count,
          COALESCE(SUM(pct_supply) FILTER (WHERE rn <= 10), 0)::float8 AS top10,
          COALESCE(SUM(pct_supply) FILTER (WHERE rn <= 20), 0)::float8 AS top20,
          COALESCE(SUM(pct_supply) FILTER (WHERE rn <= 50), 0)::float8 AS top50
        FROM ranked
        `,
        [args.tokenId, statDate, DEFAULT_EXCLUDED]
      );

      const row = stats.rows[0] || {
        holder_count: 0,
        whale_holder_count: 0,
        top10: 0,
        top20: 0,
        top50: 0,
      };

      await query(
        `
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
        VALUES ($1::uuid, $2::date, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (token_id, stat_date)
        DO UPDATE SET
          holder_count = EXCLUDED.holder_count,
          whale_holder_count = EXCLUDED.whale_holder_count,
          top10_concentration = EXCLUDED.top10_concentration,
          top20_concentration = EXCLUDED.top20_concentration,
          top50_concentration = EXCLUDED.top50_concentration
        `,
        [
          args.tokenId,
          statDate,
          row.holder_count,
          row.whale_holder_count,
          row.top10,
          row.top20,
          row.top50,
        ]
      );

      await query(
        `
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
          $2::date,
          COALESCE(SUM(amount_decimal) FILTER (WHERE is_exchange_in), 0),
          COALESCE(SUM(amount_decimal) FILTER (WHERE is_exchange_out), 0),
          COALESCE(SUM(
            CASE
              WHEN is_exchange_in THEN amount_decimal
              WHEN is_exchange_out THEN -amount_decimal
              ELSE 0
            END
          ), 0),
          NOW()
        FROM whale_transfers
        WHERE token_id = $1::uuid
          AND block_time >= $2::date
          AND block_time < ($2::date + INTERVAL '1 day')
        ON CONFLICT (token_id, stat_date)
        DO UPDATE SET
          exchange_inflow = EXCLUDED.exchange_inflow,
          exchange_outflow = EXCLUDED.exchange_outflow,
          netflow = EXCLUDED.netflow
        `,
        [args.tokenId, statDate]
      );

      return {
        token_id: args.tokenId,
        date: statDate,
        signals_written: 0,
        stats_updated: true,
      };
    },
  },
};
