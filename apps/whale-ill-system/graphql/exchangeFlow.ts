import { query } from "../lib/db";

export const exchangeFlowTypeDefs = /* GraphQL */ `
  extend type Query {
    whaleExchangeFlow(tokenId: ID!, fromDate: String!, toDate: String!): [WhaleExchangeFlow!]!
  }
`;

export const exchangeFlowResolvers = {
  Query: {
    whaleExchangeFlow: async (
      _: unknown,
      args: { tokenId: string; fromDate: string; toDate: string }
    ) => {
      const daily = await query(
        `
        SELECT token_id, stat_date, exchange_inflow, exchange_outflow, netflow
        FROM whale_exchange_flow_daily
        WHERE token_id = $1::uuid
          AND stat_date BETWEEN $2::date AND $3::date
        ORDER BY stat_date ASC
        `,
        [args.tokenId, args.fromDate, args.toDate]
      );

      if (daily.rows.length > 0) return daily.rows;

      const fallback = await query(
        `
        SELECT
          token_id,
          DATE(block_time) AS stat_date,
          COALESCE(SUM(amount_decimal) FILTER (WHERE is_exchange_in), 0)::float8 AS exchange_inflow,
          COALESCE(SUM(amount_decimal) FILTER (WHERE is_exchange_out), 0)::float8 AS exchange_outflow,
          COALESCE(SUM(
            CASE
              WHEN is_exchange_in THEN amount_decimal
              WHEN is_exchange_out THEN -amount_decimal
              ELSE 0
            END
          ), 0)::float8 AS netflow
        FROM whale_transfers
        WHERE token_id = $1::uuid
          AND block_time >= $2::date
          AND block_time < ($3::date + INTERVAL '1 day')
        GROUP BY token_id, DATE(block_time)
        ORDER BY stat_date ASC
        `,
        [args.tokenId, args.fromDate, args.toDate]
      );

      return fallback.rows;
    },
  },
};
