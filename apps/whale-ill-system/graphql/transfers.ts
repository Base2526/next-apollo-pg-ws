import { query } from "../lib/db";
import { requireWhaleAdmin, type WhaleContext } from "./utils";

export const transferTypeDefs = /* GraphQL */ `
  extend type Query {
    whaleTransfers(
      tokenId: ID!
      fromDate: String
      toDate: String
      limit: Int = 100
      offset: Int = 0
      filter: WhaleTransferFilterInput
    ): [WhaleTransfer!]!
  }

  extend type Mutation {
    insertWhaleTransfer(input: InsertWhaleTransferInput!): WhaleTransfer!
  }
`;

export const transferResolvers = {
  Query: {
    whaleTransfers: async (
      _: unknown,
      args: {
        tokenId: string;
        fromDate?: string;
        toDate?: string;
        limit?: number;
        offset?: number;
        filter?: {
          isExchangeIn?: boolean;
          isExchangeOut?: boolean;
          isInternalLike?: boolean;
          minUsdValue?: number;
          fromLabelTypes?: string[];
          toLabelTypes?: string[];
        };
      }
    ) => {
      const limit = Math.min(Math.max(Number(args.limit ?? 100), 1), 500);
      const offset = Math.max(Number(args.offset ?? 0), 0);

      const res = await query(
        `
        SELECT *
        FROM whale_transfers
        WHERE token_id = $1::uuid
          AND ($2::timestamptz IS NULL OR block_time >= $2::timestamptz)
          AND ($3::timestamptz IS NULL OR block_time <= $3::timestamptz)
          AND ($4::boolean IS NULL OR is_exchange_in = $4::boolean)
          AND ($5::boolean IS NULL OR is_exchange_out = $5::boolean)
          AND ($6::boolean IS NULL OR is_internal_like = $6::boolean)
          AND ($7::numeric IS NULL OR COALESCE(usd_value, 0) >= $7::numeric)
          AND (
            COALESCE(array_length($8::text[], 1), 0) = 0
            OR COALESCE(from_label_type, 'unknown') = ANY($8::text[])
          )
          AND (
            COALESCE(array_length($9::text[], 1), 0) = 0
            OR COALESCE(to_label_type, 'unknown') = ANY($9::text[])
          )
        ORDER BY block_time DESC
        LIMIT $10 OFFSET $11
        `,
        [
          args.tokenId,
          args.fromDate ?? null,
          args.toDate ?? null,
          args.filter?.isExchangeIn ?? null,
          args.filter?.isExchangeOut ?? null,
          args.filter?.isInternalLike ?? null,
          args.filter?.minUsdValue ?? null,
          args.filter?.fromLabelTypes ?? [],
          args.filter?.toLabelTypes ?? [],
          limit,
          offset,
        ]
      );

      return res.rows;
    },
  },

  Mutation: {
    insertWhaleTransfer: async (
      _: unknown,
      args: {
        input: {
          token_id: string;
          chain: string;
          tx_hash: string;
          log_index: number;
          block_number: number;
          block_time: string;
          from_address: string;
          to_address: string;
          amount_raw?: string;
          amount_decimal?: number;
          usd_value?: number;
          from_label_type?: string;
          to_label_type?: string;
          is_exchange_in?: boolean;
          is_exchange_out?: boolean;
          is_internal_like?: boolean;
        };
      },
      ctx: WhaleContext
    ) => {
      requireWhaleAdmin(ctx);
      const input = args.input;

      const res = await query(
        `
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
        VALUES (
          $1::uuid,
          $2,
          lower($3),
          $4,
          $5,
          $6::timestamptz,
          lower($7),
          lower($8),
          $9,
          $10,
          $11,
          $12,
          $13,
          COALESCE($14, false),
          COALESCE($15, false),
          COALESCE($16, false),
          NOW()
        )
        ON CONFLICT (token_id, tx_hash, log_index)
        DO UPDATE SET
          amount_raw = EXCLUDED.amount_raw,
          amount_decimal = EXCLUDED.amount_decimal,
          usd_value = EXCLUDED.usd_value,
          from_label_type = EXCLUDED.from_label_type,
          to_label_type = EXCLUDED.to_label_type,
          is_exchange_in = EXCLUDED.is_exchange_in,
          is_exchange_out = EXCLUDED.is_exchange_out,
          is_internal_like = EXCLUDED.is_internal_like
        RETURNING *
        `,
        [
          input.token_id,
          input.chain,
          input.tx_hash,
          input.log_index,
          input.block_number,
          input.block_time,
          input.from_address,
          input.to_address,
          input.amount_raw ?? null,
          input.amount_decimal ?? null,
          input.usd_value ?? null,
          input.from_label_type ?? null,
          input.to_label_type ?? null,
          input.is_exchange_in ?? false,
          input.is_exchange_out ?? false,
          input.is_internal_like ?? false,
        ]
      );

      return res.rows[0];
    },
  },
};
