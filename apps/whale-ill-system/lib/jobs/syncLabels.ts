import { runInTransaction } from "../db";
import { refreshTransferLabelsAndFlags } from "../scanner/ingestion";
import { refreshExchangeLabels } from "../scanner/labels";
import type { WhaleTokenRow } from "../scanner/types";

export async function syncLabels(token: WhaleTokenRow): Promise<number> {
  return runInTransaction(async (client) => {
    const n = await refreshExchangeLabels(client, token);
    await refreshTransferLabelsAndFlags(client, token.id);
    return n;
  });
}
