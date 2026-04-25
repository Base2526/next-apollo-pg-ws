import {
  ProviderHoldersInput,
  ProviderHoldersResult,
  ProviderLabelInput,
  ProviderLabelResult,
  ProviderTransferInput,
  ProviderTransferResult,
  WhaleDataProvider,
} from "./types";
import { normalizeAddress, requestJson } from "./http";

type DuneExecutionResponse = {
  execution_id?: string;
  state?: string;
};

type DuneResultResponse = {
  result?: {
    rows?: Array<Record<string, unknown>>;
  };
};

export class DuneProvider implements WhaleDataProvider {
  readonly name = "dune" as const;

  constructor(private readonly apiKey: string | undefined) {}

  private headers(): Record<string, string> {
    return this.apiKey
      ? {
          "x-dune-api-key": this.apiKey,
          "content-type": "application/json",
        }
      : {};
  }

  private async executeQuery(queryId: string, parameters: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
    if (!this.apiKey || !queryId) return [];

    const execUrl = `https://api.dune.com/api/v1/query/${queryId}/execute`;
    const execution = await requestJson<DuneExecutionResponse>(execUrl, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ query_parameters: parameters }),
      retries: 2,
    });

    if (!execution.execution_id) return [];

    const resultUrl = `https://api.dune.com/api/v1/execution/${execution.execution_id}/results`;
    for (let i = 0; i < 10; i += 1) {
      const result = await requestJson<DuneResultResponse>(resultUrl, {
        headers: this.headers(),
        retries: 1,
      });

      const rows = result.result?.rows;
      if (Array.isArray(rows)) {
        return rows;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    return [];
  }

  async fetchTransfers(input: ProviderTransferInput): Promise<ProviderTransferResult> {
    const queryId = process.env.WHALE_DUNE_TRANSFER_QUERY_ID || "";
    if (!queryId) return { provider: this.name, transfers: [] };

    const rows = await this.executeQuery(queryId, {
      chain: input.chain,
      token_address: input.tokenAddress,
      from_ts: input.fromTimestamp || null,
      limit: input.limit || 500,
    });

    const transfers = rows
      .map((row) => ({
        chain: input.chain,
        txHash: normalizeAddress(String(row.tx_hash || "")),
        logIndex: Number(row.log_index || 0),
        blockNumber: Number(row.block_number || 0),
        blockTime: String(row.block_time || new Date().toISOString()),
        fromAddress: normalizeAddress(String(row.from_address || "")),
        toAddress: normalizeAddress(String(row.to_address || "")),
        amountRaw: row.amount_raw ? String(row.amount_raw) : null,
        amountDecimal: Number.isFinite(Number(row.amount_decimal)) ? Number(row.amount_decimal) : null,
        usdValue: Number.isFinite(Number(row.usd_value)) ? Number(row.usd_value) : null,
      }))
      .filter((row) => row.txHash && row.fromAddress && row.toAddress);

    const latestBlock = transfers.reduce((max, row) => Math.max(max, row.blockNumber), 0);
    return {
      provider: this.name,
      transfers,
      latestBlock: latestBlock > 0 ? String(latestBlock) : null,
      latestTimestamp: transfers[0]?.blockTime || null,
    };
  }

  async fetchTopHolders(input: ProviderHoldersInput): Promise<ProviderHoldersResult> {
    const queryId = process.env.WHALE_DUNE_HOLDERS_QUERY_ID || "";
    if (!queryId) return { provider: this.name, holders: [] };

    const rows = await this.executeQuery(queryId, {
      chain: input.chain,
      token_address: input.tokenAddress,
      limit: input.limit || 100,
    });

    const holders = rows
      .map((row) => {
        const balance = Number(row.balance || 0);
        const pct = Number.isFinite(Number(row.pct_supply))
          ? Number(row.pct_supply)
          : input.totalSupply && input.totalSupply > 0
          ? balance / input.totalSupply
          : 0;
        return {
          chain: input.chain,
          walletAddress: normalizeAddress(String(row.wallet_address || "")),
          balance: Number.isFinite(balance) ? balance : 0,
          pctSupply: Number.isFinite(pct) ? pct : 0,
        };
      })
      .filter((row) => row.walletAddress);

    return { provider: this.name, holders };
  }

  async fetchWalletLabels(input: ProviderLabelInput): Promise<ProviderLabelResult> {
    const queryId = process.env.WHALE_DUNE_LABELS_QUERY_ID || "";
    if (!queryId || input.addresses.length === 0) return { provider: this.name, labels: [] };

    const rows = await this.executeQuery(queryId, {
      chain: input.chain,
      wallet_addresses: input.addresses,
    });

    const labels = rows
      .map((row) => ({
        chain: input.chain,
        walletAddress: normalizeAddress(String(row.wallet_address || "")),
        labelType: String(row.label_type || "unknown"),
        labelName: row.label_name ? String(row.label_name) : null,
        confidenceScore: Number.isFinite(Number(row.confidence_score)) ? Number(row.confidence_score) : 55,
        source: "dune",
      }))
      .filter((row) => row.walletAddress && row.labelType !== "unknown");

    return { provider: this.name, labels };
  }
}
