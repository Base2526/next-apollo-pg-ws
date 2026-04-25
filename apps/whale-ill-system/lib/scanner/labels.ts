import type { PoolClient } from "pg";

import { fetchWalletLabelsWithFallback } from "../providers";
import { scannerLog } from "./logger";
import type { WhaleTokenRow } from "./types";

function normalize(address: string): string {
  return String(address || "").trim().toLowerCase();
}

function parseSeedExchangeLabels(): Array<{
  chain: string;
  walletAddress: string;
  labelName: string;
}> {
  const raw = process.env.WHALE_EXCHANGE_WALLETS_JSON || "[]";
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => row && typeof row === "object")
      .map((row) => {
        const r = row as Record<string, unknown>;
        return {
          chain: String(r.chain || "").toLowerCase(),
          walletAddress: normalize(String(r.walletAddress || r.wallet_address || "")),
          labelName: String(r.labelName || r.label_name || "exchange"),
        };
      })
      .filter((row) => row.chain && row.walletAddress);
  } catch {
    return [];
  }
}

export async function refreshExchangeLabels(client: PoolClient, token: WhaleTokenRow): Promise<number> {
  const seedLabels = parseSeedExchangeLabels().filter((row) => row.chain === token.chain.toLowerCase());

  for (const row of seedLabels) {
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
        'exchange',
        $3,
        95,
        'manual',
        NOW(),
        NOW()
      )
      ON CONFLICT (chain, wallet_address)
      DO UPDATE SET
        label_type = EXCLUDED.label_type,
        label_name = EXCLUDED.label_name,
        confidence_score = GREATEST(whale_wallet_labels.confidence_score, EXCLUDED.confidence_score),
        source = EXCLUDED.source,
        updated_at = NOW()
      `,
      [row.chain, row.walletAddress, row.labelName]
    );
  }

  const addressesRes = await client.query<{ wallet_address: string }>(
    `
    SELECT DISTINCT lower(from_address) AS wallet_address
    FROM whale_transfers
    WHERE token_id = $1::uuid
      AND block_time >= NOW() - INTERVAL '30 day'
    UNION
    SELECT DISTINCT lower(to_address) AS wallet_address
    FROM whale_transfers
    WHERE token_id = $1::uuid
      AND block_time >= NOW() - INTERVAL '30 day'
    LIMIT 600
    `,
    [token.id]
  );

  const addresses = addressesRes.rows.map((r) => r.wallet_address).filter(Boolean);
  const providerLabels = await fetchWalletLabelsWithFallback(token.chain, addresses);

  let upserts = 0;
  for (const label of providerLabels.labels) {
    const mappedType =
      label.labelType === "exchange" ||
      label.labelType === "treasury" ||
      label.labelType === "vesting" ||
      label.labelType === "lp" ||
      label.labelType === "staking" ||
      label.labelType === "bridge" ||
      label.labelType === "burn" ||
      label.labelType === "smart_money"
        ? label.labelType
        : "unknown";

    if (mappedType === "unknown") continue;

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
        $3,
        $4,
        $5,
        $6,
        NOW(),
        NOW()
      )
      ON CONFLICT (chain, wallet_address)
      DO UPDATE SET
        label_type = CASE
          WHEN EXCLUDED.confidence_score >= whale_wallet_labels.confidence_score THEN EXCLUDED.label_type
          ELSE whale_wallet_labels.label_type
        END,
        label_name = CASE
          WHEN EXCLUDED.confidence_score >= whale_wallet_labels.confidence_score THEN EXCLUDED.label_name
          ELSE whale_wallet_labels.label_name
        END,
        confidence_score = GREATEST(whale_wallet_labels.confidence_score, EXCLUDED.confidence_score),
        source = CASE
          WHEN EXCLUDED.confidence_score >= whale_wallet_labels.confidence_score THEN EXCLUDED.source
          ELSE whale_wallet_labels.source
        END,
        updated_at = NOW()
      `,
      [token.chain, label.walletAddress, mappedType, label.labelName, label.confidenceScore, label.source]
    );
    upserts += 1;
  }

  scannerLog("info", "wallet labels refreshed", {
    tokenId: token.id,
    symbol: token.symbol,
    providerLabelCount: providerLabels.labels.length,
    seedLabelCount: seedLabels.length,
    upserts,
    providerSources: providerLabels.sourceProviders,
  });

  return upserts + seedLabels.length;
}
