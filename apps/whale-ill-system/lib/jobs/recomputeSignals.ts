import { runInTransaction } from "../db";
import { maybeSendLongAlert } from "../scanner/alerts";
import { persistScannerResult } from "../scanner/ingestion";

export async function recomputeSignals(tokenId: string): Promise<void> {
  await runInTransaction(async (client) => {
    await persistScannerResult(client, tokenId);
    await maybeSendLongAlert(client, tokenId);
  });
}
