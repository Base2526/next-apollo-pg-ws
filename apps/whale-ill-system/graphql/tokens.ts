import { query } from "../lib/db";
import { requireWhaleAdmin, type WhaleContext } from "./utils";

function allowDemoData(): boolean {
  const value = String(process.env.ALLOW_DEMO_DATA || "false").toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function demoFilterSql(alias: string): string {
  return `
    lower(${alias}.token_address) LIKE '%demo%'
    OR lower(${alias}.token_address) LIKE '%placeholder%'
    OR lower(${alias}.token_address) LIKE '%mock%'
    OR lower(${alias}.token_address) LIKE '%test%'
    OR lower(${alias}.symbol) IN ('sto', 'soon')
    OR lower(${alias}.name) LIKE '%demo%'
    OR lower(${alias}.name) LIKE '%mock%'
    OR lower(${alias}.name) LIKE '%test%'
  `;
}

export const tokenTypeDefs = /* GraphQL */ `
  extend type Query {
    whaleTokens(limit: Int = 100, offset: Int = 0): [WhaleToken!]!
    whaleToken(tokenId: ID, tokenAddress: String, chain: String): WhaleToken
  }

  extend type Mutation {
    upsertWhaleToken(input: UpsertWhaleTokenInput!): WhaleToken!
  }
`;

export const tokenResolvers = {
  Query: {
    whaleTokens: async (_: unknown, args: { limit?: number; offset?: number }) => {
      const limit = Math.min(Math.max(Number(args.limit ?? 100), 1), 500);
      const offset = Math.max(Number(args.offset ?? 0), 0);
      const includeDemo = allowDemoData();
      const res = await query(
        `
        SELECT *
        FROM whale_tokens
        WHERE ($3::boolean = true OR NOT (${demoFilterSql("whale_tokens")}))
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
        `,
        [limit, offset, includeDemo]
      );
      return res.rows;
    },

    whaleToken: async (
      _: unknown,
      args: { tokenId?: string; tokenAddress?: string; chain?: string }
    ) => {
      const includeDemo = allowDemoData();
      if (args.tokenId) {
        const byId = await query(
          `
          SELECT *
          FROM whale_tokens
          WHERE id = $1::uuid
            AND ($2::boolean = true OR NOT (${demoFilterSql("whale_tokens")}))
          LIMIT 1
          `,
          [args.tokenId, includeDemo]
        );
        return byId.rows[0] ?? null;
      }

      if (!args.tokenAddress) return null;

      const byAddress = await query(
        `
        SELECT * FROM whale_tokens
        WHERE lower(token_address) = lower($1)
          AND ($2::text IS NULL OR chain = $2)
          AND ($3::boolean = true OR NOT (${demoFilterSql("whale_tokens")}))
        LIMIT 1
        `,
        [args.tokenAddress, args.chain ?? null, includeDemo]
      );
      return byAddress.rows[0] ?? null;
    },
  },

  Mutation: {
    upsertWhaleToken: async (
      _: unknown,
      args: {
        input: {
          id?: string;
          chain: string;
          token_address: string;
          symbol: string;
          name: string;
          decimals: number;
          total_supply?: number;
          circulating_supply?: number;
        };
      },
      ctx: WhaleContext
    ) => {
      requireWhaleAdmin(ctx);
      const input = args.input;

      const res = await query(
        `
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
        VALUES (
          COALESCE($1::uuid, uuid_generate_v4()),
          $2,
          lower($3),
          $4,
          $5,
          $6,
          $7,
          $8,
          NOW(),
          NOW()
        )
        ON CONFLICT (chain, token_address)
        DO UPDATE SET
          symbol = EXCLUDED.symbol,
          name = EXCLUDED.name,
          decimals = EXCLUDED.decimals,
          total_supply = EXCLUDED.total_supply,
          circulating_supply = EXCLUDED.circulating_supply,
          updated_at = NOW()
        RETURNING *
        `,
        [
          input.id ?? null,
          input.chain,
          input.token_address,
          input.symbol,
          input.name,
          input.decimals,
          input.total_supply ?? null,
          input.circulating_supply ?? null,
        ]
      );

      return res.rows[0];
    },
  },
};
