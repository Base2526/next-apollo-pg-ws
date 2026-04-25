import { runInTransaction } from "../db";
import { ingestTransfersForToken } from "../scanner/ingestion";
import type { WhaleTokenRow } from "../scanner/types";

export async function syncTransfers(token: WhaleTokenRow): Promise<number> {
  return runInTransaction(async (client) => ingestTransfersForToken(client, token));
}
