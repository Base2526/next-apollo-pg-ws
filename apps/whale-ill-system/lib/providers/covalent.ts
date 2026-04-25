import {
  ProviderHoldersInput,
  ProviderHoldersResult,
  ProviderLabelInput,
  ProviderLabelResult,
  ProviderTransferInput,
  ProviderTransferResult,
  WhaleDataProvider,
} from "./types";
import { chainToCovalentSlug, normalizeAddress, requestJson } from "./http";

type CovalentTokenHolderRow = {
  address?: string;
  balance?: string;
  total_supply?: string;
};

type CovalentHolderResponse = {
  data?: {
    items?: CovalentTokenHolderRow[];
  };
};

type CovalentTransferRow = {
  tx_hash?: string;
  block_signed_at?: string;
  block_height?: number;
  sender_address?: string;
  receiver_address?: string;
  delta?: string;
  pretty_delta_quote?: string;
  log_offset?: number;
};

type CovalentTransferResponse = {
  data?: {
    items?: CovalentTransferRow[];
  };
};

export class CovalentProvider implements WhaleDataProvider {
  readonly name = "covalent" as const;

  constructor(private readonly apiKey: string | undefined) {}

  private debugLog(event: string, details: Record<string, unknown>): void {
    console.info("[whale-provider][covalent]", event, details);
  }

  private hasKey(): boolean {
    return Boolean((this.apiKey || "").trim());
  }

  private extractHttpStatus(error: unknown): number | null {
    const message = error instanceof Error ? error.message : String(error);
    const match = message.match(/HTTP\s+(\d{3})/i);
    if (!match) return null;
    const code = Number(match[1]);
    return Number.isFinite(code) ? code : null;
  }

  private authHeaders(): Record<string, string> {
    if (!this.apiKey) return {};
    return {
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  async fetchTransfers(input: ProviderTransferInput): Promise<ProviderTransferResult> {
    const chainSlug = chainToCovalentSlug(input.chain);
    if (!this.hasKey() || chainSlug == null) {
      this.debugLog("fetchTransfers_skipped", {
        keyPresent: this.hasKey(),
        chain: input.chain,
        chainSlug,
      });
      return {
        provider: this.name,
        transfers: [],
        meta: {
          called: false,
          requestUrl: null,
          responseStatus: null,
        },
      };
    }

    const pageSize = Math.max(10, Math.min(1000, input.limit || 200));
    const url = `https://api.covalenthq.com/v1/${chainSlug}/tokens/${input.tokenAddress}/token_holders_changes/?page-size=${pageSize}&key=${encodeURIComponent(this.apiKey || "")}`;
    let responseStatus: number | null = null;

    this.debugLog("fetchTransfers_called", {
      keyPresent: this.hasKey(),
      chain: input.chain,
      chainSlug,
      requestUrl: url.replace(this.apiKey || "", "***"),
    });

    let response: CovalentTransferResponse;
    try {
      response = await requestJson<CovalentTransferResponse>(url, {
        headers: this.authHeaders(),
        retries: 2,
        onResponse: (res) => {
          responseStatus = res.status;
        },
      });
    } catch (error) {
      responseStatus = this.extractHttpStatus(error);
      const message = error instanceof Error ? error.message : String(error);
      this.debugLog("fetchTransfers_non_fatal", {
        chain: input.chain,
        chainSlug,
        responseStatus,
        error: message,
      });

      return {
        provider: this.name,
        transfers: [],
        latestBlock: null,
        latestTimestamp: null,
        meta: {
          called: true,
          requestUrl: url,
          responseStatus,
        },
      };
    }

    this.debugLog("fetchTransfers_response", {
      chain: input.chain,
      chainSlug,
      responseStatus,
      itemCount: response.data?.items?.length || 0,
    });

    const items = response.data?.items || [];
    const transfers = items
      .filter((it) => it.tx_hash && it.sender_address && it.receiver_address)
      .map((it) => {
        const decimal = Number(it.delta || 0);
        const usd = Number(String(it.pretty_delta_quote || "").replace(/[^\d.-]/g, ""));
        return {
          chain: input.chain,
          txHash: normalizeAddress(it.tx_hash || ""),
          logIndex: Number.isFinite(it.log_offset) ? Number(it.log_offset) : 0,
          blockNumber: Number.isFinite(it.block_height) ? Number(it.block_height) : 0,
          blockTime: it.block_signed_at || new Date().toISOString(),
          fromAddress: normalizeAddress(it.sender_address || ""),
          toAddress: normalizeAddress(it.receiver_address || ""),
          amountRaw: null,
          amountDecimal: Number.isFinite(decimal) ? decimal : null,
          usdValue: Number.isFinite(usd) ? usd : null,
        };
      });

    const latestBlock = transfers.reduce((max, row) => Math.max(max, row.blockNumber), 0);

    return {
      provider: this.name,
      transfers,
      latestBlock: latestBlock > 0 ? String(latestBlock) : null,
      latestTimestamp: transfers[0]?.blockTime || null,
      meta: {
        called: true,
        requestUrl: url,
        responseStatus,
      },
    };
  }

  async fetchTopHolders(input: ProviderHoldersInput): Promise<ProviderHoldersResult> {
    const chainSlug = chainToCovalentSlug(input.chain);
    if (!this.hasKey() || chainSlug == null) {
      this.debugLog("fetchTopHolders_skipped", {
        keyPresent: this.hasKey(),
        chain: input.chain,
        chainSlug,
      });
      return {
        provider: this.name,
        holders: [],
        meta: {
          called: false,
          requestUrl: null,
          responseStatus: null,
        },
      };
    }

    const pageSize = Math.max(10, Math.min(100, input.limit || 100));
    const url = `https://api.covalenthq.com/v1/${chainSlug}/tokens/${input.tokenAddress}/token_holders_v2/?page-size=${pageSize}&key=${encodeURIComponent(this.apiKey || "")}`;
    let responseStatus: number | null = null;

    this.debugLog("fetchTopHolders_called", {
      keyPresent: this.hasKey(),
      chain: input.chain,
      chainSlug,
      requestUrl: url.replace(this.apiKey || "", "***"),
    });

    const response = await requestJson<CovalentHolderResponse>(url, {
      headers: this.authHeaders(),
      retries: 2,
      onResponse: (res) => {
        responseStatus = res.status;
      },
    });

    this.debugLog("fetchTopHolders_response", {
      chain: input.chain,
      chainSlug,
      responseStatus,
      itemCount: response.data?.items?.length || 0,
    });

    const holders = (response.data?.items || [])
      .filter((row) => row.address)
      .map((row) => {
        const balance = Number(row.balance || 0);
        const totalSupply = Number(row.total_supply || input.totalSupply || 0);
        const pct = totalSupply > 0 ? balance / totalSupply : 0;
        return {
          chain: input.chain,
          walletAddress: normalizeAddress(row.address || ""),
          balance: Number.isFinite(balance) ? balance : 0,
          pctSupply: Number.isFinite(pct) ? pct : 0,
        };
      });

    return {
      provider: this.name,
      holders,
      meta: {
        called: true,
        requestUrl: url,
        responseStatus,
      },
    };
  }

  async fetchWalletLabels(_input: ProviderLabelInput): Promise<ProviderLabelResult> {
    return {
      provider: this.name,
      labels: [],
    };
  }
}
