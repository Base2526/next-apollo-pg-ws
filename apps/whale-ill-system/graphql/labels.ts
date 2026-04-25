import { query } from "../lib/db";
import { requireWhaleAdmin, type WhaleContext } from "./utils";

export const labelTypeDefs = /* GraphQL */ `
  extend type Query {
    whaleWalletLabel(walletAddress: String!, chain: String): WhaleWalletLabel
    smartMoneyWallets(chain: String, activeOnly: Boolean = true, limit: Int = 100): [SmartMoneyWallet!]!
  }

  extend type Mutation {
    upsertWhaleWalletLabel(input: UpsertWhaleWalletLabelInput!): WhaleWalletLabel!
    upsertSmartMoneyWallet(input: UpsertSmartMoneyWalletInput!): SmartMoneyWallet!
  }
`;

export const labelResolvers = {
  Query: {
    whaleWalletLabel: async (
      _: unknown,
      args: { walletAddress: string; chain?: string }
    ) => {
      const res = await query(
        `
        SELECT *
        FROM whale_wallet_labels
        WHERE lower(wallet_address) = lower($1)
          AND ($2::text IS NULL OR chain = $2)
        ORDER BY confidence_score DESC NULLS LAST, updated_at DESC
        LIMIT 1
        `,
        [args.walletAddress, args.chain ?? null]
      );
      return res.rows[0] ?? null;
    },

    smartMoneyWallets: async (
      _: unknown,
      args: { chain?: string; activeOnly?: boolean; limit?: number }
    ) => {
      const limit = Math.min(Math.max(Number(args.limit ?? 100), 1), 500);
      const res = await query(
        `
        SELECT *
        FROM smart_money_wallets
        WHERE ($1::text IS NULL OR chain = $1)
          AND ($2::boolean = false OR is_active = true)
        ORDER BY confidence_score DESC NULLS LAST, updated_at DESC
        LIMIT $3
        `,
        [args.chain ?? null, Boolean(args.activeOnly ?? true), limit]
      );
      return res.rows;
    },
  },

  Mutation: {
    upsertWhaleWalletLabel: async (
      _: unknown,
      args: {
        input: {
          id?: string;
          chain: string;
          wallet_address: string;
          label_type: string;
          label_name?: string;
          confidence_score?: number;
          source?: string;
        };
      },
      ctx: WhaleContext
    ) => {
      requireWhaleAdmin(ctx);
      const input = args.input;

      const res = await query(
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
          COALESCE($1::uuid, uuid_generate_v4()),
          $2,
          lower($3),
          $4,
          $5,
          $6,
          $7,
          NOW(),
          NOW()
        )
        ON CONFLICT (chain, wallet_address)
        DO UPDATE SET
          label_type = EXCLUDED.label_type,
          label_name = EXCLUDED.label_name,
          confidence_score = EXCLUDED.confidence_score,
          source = EXCLUDED.source,
          updated_at = NOW()
        RETURNING *
        `,
        [
          input.id ?? null,
          input.chain,
          input.wallet_address,
          input.label_type,
          input.label_name ?? null,
          input.confidence_score ?? null,
          input.source ?? null,
        ]
      );

      return res.rows[0];
    },

    upsertSmartMoneyWallet: async (
      _: unknown,
      args: {
        input: {
          id?: string;
          chain: string;
          wallet_address: string;
          strategy_tag?: string;
          win_rate?: number;
          avg_return_30d?: number;
          risk_score?: number;
          confidence_score?: number;
          is_active?: boolean;
          source?: string;
          label_name?: string;
        };
      },
      ctx: WhaleContext
    ) => {
      requireWhaleAdmin(ctx);
      const input = args.input;

      const res = await query(
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
          COALESCE($1::uuid, uuid_generate_v4()),
          $2,
          lower($3),
          $4,
          $5,
          $6,
          $7,
          $8,
          COALESCE($9, true),
          $10,
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
        RETURNING *
        `,
        [
          input.id ?? null,
          input.chain,
          input.wallet_address,
          input.strategy_tag ?? null,
          input.win_rate ?? null,
          input.avg_return_30d ?? null,
          input.risk_score ?? null,
          input.confidence_score ?? null,
          input.is_active ?? true,
          input.source ?? "manual",
        ]
      );

      await query(
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
          lower($2),
          'smart_money',
          $3,
          $4,
          $5,
          NOW(),
          NOW()
        )
        ON CONFLICT (chain, wallet_address)
        DO UPDATE SET
          label_type = 'smart_money',
          label_name = COALESCE(EXCLUDED.label_name, whale_wallet_labels.label_name),
          confidence_score = COALESCE(EXCLUDED.confidence_score, whale_wallet_labels.confidence_score),
          source = COALESCE(EXCLUDED.source, whale_wallet_labels.source),
          updated_at = NOW()
        `,
        [
          input.chain,
          input.wallet_address,
          input.label_name ?? input.strategy_tag ?? "smart_money",
          input.confidence_score ?? null,
          input.source ?? "manual",
        ]
      );

      return res.rows[0];
    },
  },
};
