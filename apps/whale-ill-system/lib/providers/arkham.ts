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

type ArkhamLabelRow = {
  address?: string;
  entityType?: string;
  entityName?: string;
  confidence?: number;
};

type ArkhamLabelResponse = {
  data?: ArkhamLabelRow[];
};

export class ArkhamProvider implements WhaleDataProvider {
  readonly name = "arkham" as const;

  constructor(private readonly apiKey: string | undefined) {}

  private baseUrl(): string {
    return process.env.WHALE_ARKHAM_BASE_URL || "https://api.arkhamintelligence.com";
  }

  private headers(): Record<string, string> {
    return this.apiKey
      ? {
          Authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        }
      : {
          "content-type": "application/json",
        };
  }

  async fetchTransfers(_input: ProviderTransferInput): Promise<ProviderTransferResult> {
    return {
      provider: this.name,
      transfers: [],
    };
  }

  async fetchTopHolders(_input: ProviderHoldersInput): Promise<ProviderHoldersResult> {
    return {
      provider: this.name,
      holders: [],
    };
  }

  async fetchWalletLabels(input: ProviderLabelInput): Promise<ProviderLabelResult> {
    if (!this.apiKey || input.addresses.length === 0) {
      return {
        provider: this.name,
        labels: [],
      };
    }

    const url = `${this.baseUrl().replace(/\/$/, "")}/v1/entity/resolve`;

    const response = await requestJson<ArkhamLabelResponse>(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        chain: input.chain,
        addresses: input.addresses,
      }),
      retries: 2,
    }).catch(() => ({ data: [] }));

    const labels = (response.data || [])
      .map((row) => ({
        chain: input.chain,
        walletAddress: normalizeAddress(row.address || ""),
        labelType: String(row.entityType || "unknown").toLowerCase(),
        labelName: row.entityName || null,
        confidenceScore: Number.isFinite(Number(row.confidence)) ? Number(row.confidence) : 70,
        source: "arkham",
      }))
      .filter((row) => row.walletAddress && row.labelType !== "unknown");

    return {
      provider: this.name,
      labels,
    };
  }
}
