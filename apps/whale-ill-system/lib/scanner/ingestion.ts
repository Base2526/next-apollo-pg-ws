import type { PoolClient } from "pg";

import { fetchTopHoldersWithFallback, fetchTransfersWithFallback } from "../providers";
import { scannerLog } from "./logger";
import type { WhaleTokenRow } from "./types";

function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalize(address: string): string {
  return String(address || "").trim().toLowerCase();
}

async function getSyncState(
  client: PoolClient,
  tokenId: string,
  provider: string,
  metric: string
): Promise<{ cursor: string | null; latestBlock: string | null; latestTimestamp: string | null }> {
  const res = await client.query<{ cursor: string | null; latest_block: string | null; latest_timestamp: string | null }>(
    `
    SELECT cursor, latest_block, latest_timestamp
    FROM whale_sync_state
    WHERE token_id = $1::uuid
      AND provider = $2
      AND metric = $3
    LIMIT 1
    `,
    [tokenId, provider, metric]
  );

  if (res.rows.length === 0) {
    return { cursor: null, latestBlock: null, latestTimestamp: null };
  }

  return {
    cursor: res.rows[0].cursor,
    latestBlock: res.rows[0].latest_block,
    latestTimestamp: res.rows[0].latest_timestamp,
  };
}

async function saveSyncState(
  client: PoolClient,
  tokenId: string,
  provider: string,
  metric: string,
  state: { cursor?: string | null; latestBlock?: string | null; latestTimestamp?: string | null; metadata?: Record<string, unknown> }
): Promise<void> {
  await client.query(
    `
    INSERT INTO whale_sync_state (
      id,
      token_id,
      provider,
      metric,
      cursor,
      latest_block,
      latest_timestamp,
      metadata_json,
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
      $7::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT (token_id, provider, metric)
    DO UPDATE SET
      cursor = EXCLUDED.cursor,
      latest_block = EXCLUDED.latest_block,
      latest_timestamp = EXCLUDED.latest_timestamp,
      metadata_json = EXCLUDED.metadata_json,
      updated_at = NOW()
    `,
    [tokenId, provider, metric, state.cursor || null, state.latestBlock || null, state.latestTimestamp || null, JSON.stringify(state.metadata || {})]
  );
}

export async function ingestTransfersForToken(client: PoolClient, token: WhaleTokenRow): Promise<number> {
  const transferState = await getSyncState(client, token.id, "multi", "transfers");

  const merged = await fetchTransfersWithFallback({
    chain: token.chain,
    tokenAddress: token.token_address,
    fromBlock: transferState.latestBlock || undefined,
    fromTimestamp: transferState.latestTimestamp || undefined,
    limit: Number(process.env.WHALE_PROVIDER_TRANSFER_LIMIT || 500),
  });

  let inserted = 0;

  for (const row of merged.transfers) {
    await client.query(
      `
      INSERT INTO whale_transfers (
        id,
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
        uuid_generate_v4(),
        $1::uuid,
        $2,
        $3,
        $4,
        $5,
        $6::timestamptz,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        false,
        false,
        false,
        NOW()
      )
      ON CONFLICT (token_id, tx_hash, log_index)
      DO UPDATE SET
        block_number = EXCLUDED.block_number,
        block_time = EXCLUDED.block_time,
        from_address = EXCLUDED.from_address,
        to_address = EXCLUDED.to_address,
        amount_raw = EXCLUDED.amount_raw,
        amount_decimal = EXCLUDED.amount_decimal,
        usd_value = COALESCE(EXCLUDED.usd_value, whale_transfers.usd_value),
        from_label_type = COALESCE(EXCLUDED.from_label_type, whale_transfers.from_label_type),
        to_label_type = COALESCE(EXCLUDED.to_label_type, whale_transfers.to_label_type),
        is_internal_like = whale_transfers.from_address = whale_transfers.to_address
      `,
      [
        token.id,
        token.chain,
        row.txHash,
        row.logIndex,
        row.blockNumber,
        row.blockTime,
        row.fromAddress,
        row.toAddress,
        row.amountRaw,
        row.amountDecimal,
        row.usdValue,
        row.fromLabelType || null,
        row.toLabelType || null,
      ]
    );
    inserted += 1;
  }

  await saveSyncState(client, token.id, "multi", "transfers", {
    latestBlock: merged.latestBlock,
    latestTimestamp: merged.latestTimestamp,
    metadata: {
      sourceProviders: merged.sourceProviders,
      rowsSeen: merged.transfers.length,
    },
  });

  scannerLog("info", "transfer ingestion complete", {
    tokenId: token.id,
    symbol: token.symbol,
    inserted,
    providers: merged.sourceProviders,
  });

  return inserted;
}

export async function ingestHolderSnapshotsForToken(client: PoolClient, token: WhaleTokenRow): Promise<number> {
  const merged = await fetchTopHoldersWithFallback({
    chain: token.chain,
    tokenAddress: token.token_address,
    totalSupply: token.total_supply,
    limit: Number(process.env.WHALE_PROVIDER_HOLDER_LIMIT || 200),
  });

  let upserts = 0;
  for (const holder of merged.holders) {
    const pctSupply = holder.pctSupply > 0
      ? holder.pctSupply
      : token.total_supply && token.total_supply > 0
      ? holder.balance / token.total_supply
      : 0;

    await client.query(
      `
      INSERT INTO whale_holder_snapshots (
        id,
        token_id,
        chain,
        wallet_address,
        balance,
        pct_supply,
        snapshot_at,
        created_at
      )
      VALUES (
        uuid_generate_v4(),
        $1::uuid,
        $2,
        $3,
        $4,
        $5,
        NOW(),
        NOW()
      )
      ON CONFLICT (token_id, wallet_address, snapshot_at)
      DO UPDATE SET
        balance = EXCLUDED.balance,
        pct_supply = EXCLUDED.pct_supply
      `,
      [token.id, token.chain, normalize(holder.walletAddress), holder.balance, pctSupply]
    );
    upserts += 1;
  }

  await saveSyncState(client, token.id, "multi", "holders", {
    latestTimestamp: new Date().toISOString(),
    metadata: {
      sourceProviders: merged.sourceProviders,
      rowsSeen: merged.holders.length,
    },
  });

  scannerLog("info", "holder snapshot ingestion complete", {
    tokenId: token.id,
    symbol: token.symbol,
    upserts,
    providers: merged.sourceProviders,
  });

  return upserts;
}

export async function refreshTransferLabelsAndFlags(client: PoolClient, tokenId: string): Promise<void> {
  await client.query(
    `
    UPDATE whale_transfers t
    SET
      from_label_type = (
        SELECT wl.label_type
        FROM whale_wallet_labels wl
        WHERE wl.chain = t.chain
          AND lower(wl.wallet_address) = lower(t.from_address)
        LIMIT 1
      ),
      to_label_type = (
        SELECT wl.label_type
        FROM whale_wallet_labels wl
        WHERE wl.chain = t.chain
          AND lower(wl.wallet_address) = lower(t.to_address)
        LIMIT 1
      ),
      is_exchange_in = EXISTS (
        SELECT 1
        FROM whale_wallet_labels wl
        WHERE wl.chain = t.chain
          AND lower(wl.wallet_address) = lower(t.to_address)
          AND wl.label_type = 'exchange'
      ),
      is_exchange_out = EXISTS (
        SELECT 1
        FROM whale_wallet_labels wl
        WHERE wl.chain = t.chain
          AND lower(wl.wallet_address) = lower(t.from_address)
          AND wl.label_type = 'exchange'
      ),
      is_internal_like = lower(t.from_address) = lower(t.to_address)
    WHERE t.token_id = $1::uuid
      AND t.block_time >= NOW() - INTERVAL '30 day'
    `,
    [tokenId]
  );
}

export async function writeProviderError(
  client: PoolClient,
  tokenId: string,
  provider: string,
  stage: string,
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  await client.query(
    `
    INSERT INTO whale_provider_errors (
      id,
      token_id,
      provider,
      stage,
      error_message,
      context_json,
      created_at
    )
    VALUES (
      uuid_generate_v4(),
      $1::uuid,
      $2,
      $3,
      $4,
      $5::jsonb,
      NOW()
    )
    `,
    [tokenId, provider, stage, message.slice(0, 2000), JSON.stringify(context || {})]
  );
}

export async function ensureScannerJob(
  client: PoolClient,
  tokenId: string,
  phase: string,
  status: "started" | "success" | "error",
  details: Record<string, unknown>
): Promise<void> {
  await client.query(
    `
    INSERT INTO whale_ingestion_jobs (
      id,
      token_id,
      phase,
      status,
      details_json,
      created_at,
      updated_at
    )
    VALUES (
      uuid_generate_v4(),
      $1::uuid,
      $2,
      $3,
      $4::jsonb,
      NOW(),
      NOW()
    )
    `,
    [tokenId, phase, status, JSON.stringify(details)]
  );
}

export async function persistScannerResult(
  client: PoolClient,
  tokenId: string
): Promise<void> {
  const latestPlayability = await client.query<{
    playability_score: number;
    trade_state: string;
    smart_money_inflow_7d: number;
    whale_accumulation_7d: number;
    exchange_pressure_score: number;
    concentration_risk_score: number;
    unlock_risk_score: number;
    reasons_json: unknown;
  }>(
    `
    SELECT
      playability_score,
      trade_state,
      smart_money_inflow_7d,
      whale_accumulation_7d,
      exchange_pressure_score,
      concentration_risk_score,
      unlock_risk_score,
      reasons_json
    FROM token_playability_score
    WHERE token_id = $1::uuid
    LIMIT 1
    `,
    [tokenId]
  );

  const p = latestPlayability.rows[0];
  if (!p) return;

  await client.query(
    `
    INSERT INTO whale_scanner_results (
      id,
      token_id,
      whale_score,
      smart_money_score,
      exchange_pressure_score,
      concentration_risk_score,
      unlock_risk_score,
      final_trade_state,
      reason_json,
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
      $8::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT (token_id)
    DO UPDATE SET
      whale_score = EXCLUDED.whale_score,
      smart_money_score = EXCLUDED.smart_money_score,
      exchange_pressure_score = EXCLUDED.exchange_pressure_score,
      concentration_risk_score = EXCLUDED.concentration_risk_score,
      unlock_risk_score = EXCLUDED.unlock_risk_score,
      final_trade_state = EXCLUDED.final_trade_state,
      reason_json = EXCLUDED.reason_json,
      updated_at = NOW()
    `,
    [
      tokenId,
      toNum(p.playability_score),
      Math.max(0, Math.min(100, toNum(p.smart_money_inflow_7d) > 0 ? 70 : 30)),
      toNum(p.exchange_pressure_score),
      toNum(p.concentration_risk_score),
      toNum(p.unlock_risk_score),
      p.trade_state,
      JSON.stringify(p.reasons_json || []),
    ]
  );
}
