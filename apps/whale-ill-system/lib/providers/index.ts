import { AlchemyProvider } from "./alchemy";
import { ArkhamProvider } from "./arkham";
import { CovalentProvider } from "./covalent";
import { DuneProvider } from "./dune";
import { chainToCovalentSlug } from "./http";
import { ensureWhaleEnvLoaded } from "../config/env";
import {
  NormalizedHolder,
  NormalizedTransfer,
  NormalizedWalletLabel,
  ProviderDiagnostics,
  ProviderHoldersInput,
  ProviderStatusCode,
  ProviderTransferInput,
  WhaleDataProvider,
  WhaleProviderName,
} from "./types";

function uniqBy<T>(rows: T[], keyOf: (row: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = keyOf(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function keyPresentForProvider(provider: WhaleProviderName): boolean {
  ensureWhaleEnvLoaded();
  if (provider === "alchemy") return Boolean((process.env.WHALE_ALCHEMY_API_KEY || "").trim());
  if (provider === "covalent") return Boolean((process.env.WHALE_COVALENT_API_KEY || "").trim());
  if (provider === "dune") return Boolean((process.env.WHALE_DUNE_API_KEY || "").trim());
  if (provider === "arkham") return Boolean((process.env.WHALE_ARKHAM_API_KEY || "").trim());
  return false;
}

function chainSupportedForProvider(provider: WhaleProviderName, chain: string): boolean {
  if (provider === "covalent") return chainToCovalentSlug(chain) != null;
  return true;
}

function resolveProviderStatus(diagnostic: ProviderDiagnostics): ProviderStatusCode {
  if (!diagnostic.keyPresent) return "key_missing";
  if (!diagnostic.chainSupported) return "unsupported_chain";
  if (diagnostic.failures > 0) return "request_failed";
  if (diagnostic.used) return "used";
  if (diagnostic.calls > 0) return "not_used";
  if (diagnostic.keyPresent && diagnostic.chainSupported) return "ready";
  return "configured";
}

function createBaseDiagnostics(chain: string): Record<WhaleProviderName, ProviderDiagnostics> {
  const providers: WhaleProviderName[] = ["alchemy", "covalent", "dune", "arkham"];
  const base = {} as Record<WhaleProviderName, ProviderDiagnostics>;

  for (const provider of providers) {
    const keyPresent = keyPresentForProvider(provider);
    const chainSupported = chainSupportedForProvider(provider, chain);
    base[provider] = {
      provider,
      keyPresent,
      chainSupported,
      calls: 0,
      failures: 0,
      used: false,
      lastError: null,
      requestUrl: null,
      responseStatus: null,
      status: keyPresent ? (chainSupported ? "configured" : "unsupported_chain") : "key_missing",
    };
  }

  return base;
}

function finalizeDiagnostics(diagnostics: Record<WhaleProviderName, ProviderDiagnostics>): Record<WhaleProviderName, ProviderDiagnostics> {
  const out = {} as Record<WhaleProviderName, ProviderDiagnostics>;
  for (const key of Object.keys(diagnostics) as WhaleProviderName[]) {
    const diag = diagnostics[key];
    out[key] = {
      ...diag,
      status: resolveProviderStatus(diag),
    };
  }
  return out;
}

export function createProviders(): WhaleDataProvider[] {
  ensureWhaleEnvLoaded();
  return [
    new AlchemyProvider(process.env.WHALE_ALCHEMY_API_KEY),
    new CovalentProvider(process.env.WHALE_COVALENT_API_KEY),
    new DuneProvider(process.env.WHALE_DUNE_API_KEY),
    new ArkhamProvider(process.env.WHALE_ARKHAM_API_KEY),
  ];
}

export async function fetchTransfersWithFallback(input: ProviderTransferInput): Promise<{
  transfers: NormalizedTransfer[];
  sourceProviders: string[];
  latestBlock: string | null;
  latestTimestamp: string | null;
  providerDiagnostics: Record<WhaleProviderName, ProviderDiagnostics>;
}> {
  const providers = createProviders();
  const merged: NormalizedTransfer[] = [];
  const sourceProviders: string[] = [];
  let latestBlock: string | null = null;
  let latestTimestamp: string | null = null;
  const diagnostics = createBaseDiagnostics(input.chain);

  for (const provider of providers) {
    const diag = diagnostics[provider.name];

    if (!diag.keyPresent || !diag.chainSupported) {
      continue;
    }

    diag.calls += 1;

    try {
      const result = await provider.fetchTransfers(input);
      if (result.meta?.requestUrl) diag.requestUrl = result.meta.requestUrl;
      if (result.meta?.responseStatus != null) diag.responseStatus = result.meta.responseStatus;

      if (result.transfers.length > 0) {
        merged.push(...result.transfers);
        sourceProviders.push(provider.name);
        diag.used = true;
      }
      if (result.latestBlock && (!latestBlock || Number(result.latestBlock) > Number(latestBlock))) {
        latestBlock = result.latestBlock;
      }
      if (result.latestTimestamp && (!latestTimestamp || result.latestTimestamp > latestTimestamp)) {
        latestTimestamp = result.latestTimestamp;
      }
    } catch (error) {
      diag.failures += 1;
      diag.lastError = error instanceof Error ? error.message : String(error);
      continue;
    }
  }

  const deduped = uniqBy(merged, (row) => `${row.chain}|${row.txHash}|${row.logIndex}`);
  deduped.sort((a, b) => (a.blockTime < b.blockTime ? 1 : -1));

  return {
    transfers: deduped,
    sourceProviders,
    latestBlock,
    latestTimestamp,
    providerDiagnostics: finalizeDiagnostics(diagnostics),
  };
}

export async function fetchTopHoldersWithFallback(input: ProviderHoldersInput): Promise<{
  holders: NormalizedHolder[];
  sourceProviders: string[];
  providerDiagnostics: Record<WhaleProviderName, ProviderDiagnostics>;
}> {
  const providers = createProviders();
  const merged: NormalizedHolder[] = [];
  const sourceProviders: string[] = [];
  const diagnostics = createBaseDiagnostics(input.chain);

  for (const provider of providers) {
    const diag = diagnostics[provider.name];

    if (!diag.keyPresent || !diag.chainSupported) {
      continue;
    }

    diag.calls += 1;

    try {
      const result = await provider.fetchTopHolders(input);
      if (result.meta?.requestUrl) diag.requestUrl = result.meta.requestUrl;
      if (result.meta?.responseStatus != null) diag.responseStatus = result.meta.responseStatus;

      if (result.holders.length > 0) {
        merged.push(...result.holders);
        sourceProviders.push(provider.name);
        diag.used = true;
      }
    } catch (error) {
      diag.failures += 1;
      diag.lastError = error instanceof Error ? error.message : String(error);
      continue;
    }
  }

  const deduped = uniqBy(merged, (row) => `${row.chain}|${row.walletAddress}`);
  deduped.sort((a, b) => b.balance - a.balance);

  return {
    holders: deduped,
    sourceProviders,
    providerDiagnostics: finalizeDiagnostics(diagnostics),
  };
}

export async function fetchWalletLabelsWithFallback(chain: string, addresses: string[]): Promise<{
  labels: NormalizedWalletLabel[];
  sourceProviders: string[];
  providerDiagnostics: Record<WhaleProviderName, ProviderDiagnostics>;
}> {
  const providers = createProviders();
  const merged: NormalizedWalletLabel[] = [];
  const sourceProviders: string[] = [];
  const diagnostics = createBaseDiagnostics(chain);

  for (const provider of providers) {
    const diag = diagnostics[provider.name];

    if (!diag.keyPresent || !diag.chainSupported) {
      continue;
    }

    diag.calls += 1;

    try {
      const result = await provider.fetchWalletLabels({ chain, addresses });
      if (result.meta?.requestUrl) diag.requestUrl = result.meta.requestUrl;
      if (result.meta?.responseStatus != null) diag.responseStatus = result.meta.responseStatus;

      if (result.labels.length > 0) {
        merged.push(...result.labels);
        sourceProviders.push(provider.name);
        diag.used = true;
      }
    } catch (error) {
      diag.failures += 1;
      diag.lastError = error instanceof Error ? error.message : String(error);
      continue;
    }
  }

  const deduped = uniqBy(merged, (row) => `${row.chain}|${row.walletAddress}|${row.labelType}`);
  deduped.sort((a, b) => b.confidenceScore - a.confidenceScore);

  return {
    labels: deduped,
    sourceProviders,
    providerDiagnostics: finalizeDiagnostics(diagnostics),
  };
}
