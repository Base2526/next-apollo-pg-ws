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

type AlchemyTransfer = {
  hash?: string;
  blockNum?: string;
  metadata?: { blockTimestamp?: string };
  from?: string;
  to?: string;
  value?: number;
  rawContract?: {
    value?: string;
    decimal?: string;
  };
  logIndex?: string;
};

type AlchemyTransferResponse = {
  result?: {
    transfers?: AlchemyTransfer[];
    pageKey?: string;
  };
};

export class AlchemyProvider implements WhaleDataProvider {
  readonly name = "alchemy" as const;

  constructor(private readonly apiKey: string | undefined) {}

  private endpoint(chain: string): string {
    const network = (process.env.WHALE_ALCHEMY_NETWORK_MAP || "").trim();
    if (network) {
      return network.replace("{chain}", chain.toLowerCase()).replace("{apiKey}", this.apiKey || "");
    }
    const mapped = chain.toLowerCase() === "eth" ? "eth-mainnet" : `${chain.toLowerCase()}-mainnet`;
    return `https://${mapped}.g.alchemy.com/v2/${this.apiKey || ""}`;
  }

  async fetchTransfers(input: ProviderTransferInput): Promise<ProviderTransferResult> {
    if (!this.apiKey) {
      return { provider: this.name, transfers: [] };
    }

    const payload = {
      id: 1,
      jsonrpc: "2.0",
      method: "alchemy_getAssetTransfers",
      params: [
        {
          category: ["erc20"],
          withMetadata: true,
          maxCount: `0x${Math.max(10, Math.min(1000, input.limit || 200)).toString(16)}`,
          contractAddresses: [input.tokenAddress],
          fromBlock: input.fromBlock || "0x0",
        },
      ],
    };

    const response = await requestJson<AlchemyTransferResponse>(this.endpoint(input.chain), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      retries: 3,
    });

    const transfers = (response.result?.transfers || [])
      .filter((row) => row.hash && row.from && row.to)
      .map((row) => {
        const blockNumber = row.blockNum ? Number.parseInt(row.blockNum, 16) : 0;
        const logIndex = row.logIndex ? Number.parseInt(row.logIndex, 16) : 0;
        const valueDecimal = row.value != null ? Number(row.value) : null;

        return {
          chain: input.chain,
          txHash: normalizeAddress(row.hash || ""),
          logIndex: Number.isFinite(logIndex) ? logIndex : 0,
          blockNumber: Number.isFinite(blockNumber) ? blockNumber : 0,
          blockTime: row.metadata?.blockTimestamp || new Date().toISOString(),
          fromAddress: normalizeAddress(row.from || ""),
          toAddress: normalizeAddress(row.to || ""),
          amountRaw: row.rawContract?.value || null,
          amountDecimal: Number.isFinite(valueDecimal) ? valueDecimal : null,
          usdValue: null,
        };
      });

    const latestBlock = transfers.reduce((max, row) => Math.max(max, row.blockNumber), 0);

    return {
      provider: this.name,
      transfers,
      cursor: response.result?.pageKey || null,
      latestBlock: latestBlock > 0 ? String(latestBlock) : null,
      latestTimestamp: transfers[0]?.blockTime || null,
    };
  }

  async fetchTopHolders(_input: ProviderHoldersInput): Promise<ProviderHoldersResult> {
    return { provider: this.name, holders: [] };
  }

  async fetchWalletLabels(_input: ProviderLabelInput): Promise<ProviderLabelResult> {
    return { provider: this.name, labels: [] };
  }
}
