import { query, runInTransaction } from "../db";
import { maybeSendLongAlert } from "./alerts";
import {
  ensureScannerJob,
  ingestHolderSnapshotsForToken,
  ingestTransfersForToken,
  persistScannerResult,
  refreshTransferLabelsAndFlags,
  writeProviderError,
} from "./ingestion";
import { refreshExchangeLabels } from "./labels";
import { scannerLog } from "./logger";
import { refreshSmartMoneyWallets } from "./smartMoney";
import type { WhaleTokenRow } from "./types";

type ScanSummary = {
  scannedTokens: number;
  successTokens: number;
  failedTokens: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  skipped?: boolean;
};

function allowDemoData(): boolean {
  const value = String(process.env.ALLOW_DEMO_DATA || "false").toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

const SCANNER_LOCK_KEY = 94621031;

async function acquireScannerLock(): Promise<boolean> {
  const lock = await query<{ locked: boolean }>(
    `SELECT pg_try_advisory_lock($1) AS locked`,
    [SCANNER_LOCK_KEY]
  );
  return Boolean(lock.rows[0]?.locked);
}

async function releaseScannerLock(): Promise<void> {
  await query(`SELECT pg_advisory_unlock($1)`, [SCANNER_LOCK_KEY]);
}

async function listTokens(limit?: number): Promise<WhaleTokenRow[]> {
  const includeDemo = allowDemoData();
  const res = await query<WhaleTokenRow>(
    `
    SELECT id, chain, token_address, symbol, name, decimals, total_supply
    FROM whale_tokens
    WHERE (
      $2::boolean = true
      OR NOT (
        lower(token_address) LIKE '%demo%'
        OR lower(token_address) LIKE '%placeholder%'
        OR lower(token_address) LIKE '%mock%'
        OR lower(token_address) LIKE '%test%'
        OR lower(symbol) IN ('sto', 'soon')
        OR lower(name) LIKE '%demo%'
        OR lower(name) LIKE '%mock%'
        OR lower(name) LIKE '%test%'
      )
    )
    ORDER BY updated_at DESC
    LIMIT $1
    `,
    [Math.max(1, Math.min(limit || 100, 1000)), includeDemo]
  );
  return res.rows;
}

async function callSyncApi(tokenId: string): Promise<void> {
  const base =
    process.env.WHALE_SCANNER_SYNC_URL ||
    `http://localhost:${process.env.PORT || process.env.WHALE_ILL_PORT || "3010"}/api/whale/sync`;

  const response = await fetch(base, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-whale-admin-token": process.env.WHALE_ADMIN_TOKEN || "",
    },
    body: JSON.stringify({ tokenId }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`sync route failed for token ${tokenId}: ${response.status} ${text.slice(0, 400)}`);
  }
}

export async function runWhaleScanner(limit?: number): Promise<ScanSummary> {
  const startedAt = new Date();
  const lockAcquired = await acquireScannerLock();
  if (!lockAcquired) {
    const finished = new Date();
    scannerLog("warn", "scanner run skipped; lock not acquired", {
      lockKey: SCANNER_LOCK_KEY,
    });
    return {
      scannedTokens: 0,
      successTokens: 0,
      failedTokens: 0,
      startedAt: startedAt.toISOString(),
      finishedAt: finished.toISOString(),
      durationMs: finished.getTime() - startedAt.getTime(),
      skipped: true,
    };
  }

  const tokens = await listTokens(limit);

  let successTokens = 0;
  let failedTokens = 0;

  scannerLog("info", "scanner cycle started", {
    tokenCount: tokens.length,
  });

  try {
    for (const token of tokens) {
      const tokenStart = Date.now();

      try {
        await runInTransaction(async (client) => {
        await ensureScannerJob(client, token.id, "token_scan", "started", { symbol: token.symbol, chain: token.chain });

        const transferRows = await ingestTransfersForToken(client, token);
        const holderRows = await ingestHolderSnapshotsForToken(client, token);
        const labelRows = await refreshExchangeLabels(client, token);
        await refreshTransferLabelsAndFlags(client, token.id);
        const smartMoneyAssigned = await refreshSmartMoneyWallets(client, token);

        await ensureScannerJob(client, token.id, "token_scan", "success", {
          transferRows,
          holderRows,
          labelRows,
          smartMoneyAssigned,
        });
      });

        await callSyncApi(token.id);

        await runInTransaction(async (client) => {
          await persistScannerResult(client, token.id);
          await maybeSendLongAlert(client, token.id);
        });

        successTokens += 1;
        scannerLog("info", "token scan completed", {
          tokenId: token.id,
          symbol: token.symbol,
          durationMs: Date.now() - tokenStart,
        });
      } catch (error) {
        failedTokens += 1;
        const message = error instanceof Error ? error.message : String(error);

        scannerLog("error", "token scan failed", {
          tokenId: token.id,
          symbol: token.symbol,
          error: message,
        });

        await runInTransaction(async (client) => {
          await ensureScannerJob(client, token.id, "token_scan", "error", { error: message });
          await writeProviderError(client, token.id, "multi", "token_scan", message, {
            symbol: token.symbol,
            chain: token.chain,
          });
        }).catch(() => void 0);
      }
    }

    const finishedAt = new Date();
    const summary: ScanSummary = {
      scannedTokens: tokens.length,
      successTokens,
      failedTokens,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };

    scannerLog("info", "scanner cycle finished", summary);
    return summary;
  } finally {
    await releaseScannerLock().catch(() => void 0);
  }
}
