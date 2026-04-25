export type WhaleProviderName = "alchemy" | "covalent" | "dune" | "arkham";

export type ProviderStatusCode =
  | "key_missing"
  | "configured"
  | "ready"
  | "used"
  | "not_used"
  | "request_failed"
  | "unsupported_chain";

export type ProviderExecutionMeta = {
  called?: boolean;
  requestUrl?: string | null;
  responseStatus?: number | null;
};

export type ProviderDiagnostics = {
  provider: WhaleProviderName;
  keyPresent: boolean;
  chainSupported: boolean;
  calls: number;
  failures: number;
  used: boolean;
  lastError: string | null;
  requestUrl: string | null;
  responseStatus: number | null;
  status: ProviderStatusCode;
};

export type NormalizedTransfer = {
  chain: string;
  txHash: string;
  logIndex: number;
  blockNumber: number;
  blockTime: string;
  fromAddress: string;
  toAddress: string;
  amountRaw: string | null;
  amountDecimal: number | null;
  usdValue: number | null;
  fromLabelType?: string | null;
  toLabelType?: string | null;
};

export type NormalizedHolder = {
  chain: string;
  walletAddress: string;
  balance: number;
  pctSupply: number;
};

export type NormalizedWalletLabel = {
  chain: string;
  walletAddress: string;
  labelType: string;
  labelName?: string | null;
  confidenceScore: number;
  source: string;
};

export type ProviderTransferInput = {
  chain: string;
  tokenAddress: string;
  fromBlock?: string;
  fromTimestamp?: string;
  limit?: number;
};

export type ProviderTransferResult = {
  provider: WhaleProviderName;
  transfers: NormalizedTransfer[];
  cursor?: string | null;
  latestBlock?: string | null;
  latestTimestamp?: string | null;
  meta?: ProviderExecutionMeta;
};

export type ProviderHoldersInput = {
  chain: string;
  tokenAddress: string;
  totalSupply?: number | null;
  limit?: number;
};

export type ProviderHoldersResult = {
  provider: WhaleProviderName;
  holders: NormalizedHolder[];
  meta?: ProviderExecutionMeta;
};

export type ProviderLabelInput = {
  chain: string;
  addresses: string[];
};

export type ProviderLabelResult = {
  provider: WhaleProviderName;
  labels: NormalizedWalletLabel[];
  meta?: ProviderExecutionMeta;
};

export type WhaleDataProvider = {
  name: WhaleProviderName;
  fetchTransfers(input: ProviderTransferInput): Promise<ProviderTransferResult>;
  fetchTopHolders(input: ProviderHoldersInput): Promise<ProviderHoldersResult>;
  fetchWalletLabels(input: ProviderLabelInput): Promise<ProviderLabelResult>;
};
