export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { fetchTopHoldersWithFallback, fetchTransfersWithFallback, fetchWalletLabelsWithFallback } from "../../../../lib/providers";
import { normalizeAddress } from "../../../../lib/providers/http";
import { query } from "../../../../lib/db";
import { ProviderDiagnostics, ProviderStatusCode, WhaleProviderName } from "../../../../lib/providers/types";
import { ensureWhaleEnvLoaded } from "../../../../lib/config/env";

type AnalyzeAction = "LONG" | "SHORT" | "NO_SIGNAL";
type AnalyzeStatus = "LONG" | "SHORT" | "NO_SIGNAL" | "INSUFFICIENT_DATA";
type WhaleState = "ACCUMULATING" | "DISTRIBUTING" | "NEUTRAL";

type ResolvedToken = {
  symbol: string;
  name: string;
  chain: string;
  tokenAddress: string;
  decimals: number;
  totalSupply: number;
};

const COMMON_SYMBOLS: Record<string, ResolvedToken> = {
  ETH: {
    symbol: "ETH",
    name: "Wrapped Ether",
    chain: "eth",
    tokenAddress: "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2",
    decimals: 18,
    totalSupply: 120000000,
  },
  WETH: {
    symbol: "WETH",
    name: "Wrapped Ether",
    chain: "eth",
    tokenAddress: "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2",
    decimals: 18,
    totalSupply: 120000000,
  },
  BTC: {
    symbol: "BTC",
    name: "Wrapped BTC",
    chain: "eth",
    tokenAddress: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    decimals: 8,
    totalSupply: 21000000,
  },
  WBTC: {
    symbol: "WBTC",
    name: "Wrapped BTC",
    chain: "eth",
    tokenAddress: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    decimals: 8,
    totalSupply: 21000000,
  },
  SOL: {
    symbol: "SOL",
    name: "Wrapped SOL",
    chain: "sol",
    tokenAddress: "So11111111111111111111111111111111111111112",
    decimals: 9,
    totalSupply: 1000000000,
  },
};

const SAFE_CONFIDENCE_THRESHOLD = 40;
const MIN_TRANSFER_COVERAGE = 0.15;
const MIN_EXCHANGE_LABEL_COVERAGE = 0.1;
const SOURCE_PRIORITY = ["arkham", "covalent", "alchemy"] as const;

type ProviderState = {
  status: ProviderStatusCode;
  keyPresent: boolean;
  chainSupported: boolean;
  called: boolean;
  used: boolean;
  failures: number;
  requestUrl: string | null;
  responseStatus: number | null;
  error: string | null;
};

function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function parseTokenInput(raw: string): { chainHint: string | null; tokenValue: string } {
  const value = String(raw || "").trim();
  const byChain = value.match(/^([a-zA-Z0-9_-]+):(.*)$/);
  if (byChain) {
    return {
      chainHint: byChain[1].toLowerCase(),
      tokenValue: byChain[2].trim(),
    };
  }
  return { chainHint: null, tokenValue: value };
}

function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isLikelySolAddress(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

async function resolveToken(inputRaw: string, preferredChain?: string | null): Promise<ResolvedToken> {
  const { chainHint, tokenValue } = parseTokenInput(inputRaw);
  const chain = chainHint || preferredChain || process.env.WHALE_ANALYZE_DEFAULT_CHAIN || "eth";
  const upper = tokenValue.toUpperCase();

  if (COMMON_SYMBOLS[upper]) {
    return {
      ...COMMON_SYMBOLS[upper],
      chain,
    };
  }

  if (isEvmAddress(tokenValue)) {
    return {
      symbol: tokenValue.slice(0, 6).toUpperCase(),
      name: `Token ${tokenValue.slice(0, 10)}`,
      chain,
      tokenAddress: normalizeAddress(tokenValue),
      decimals: 18,
      totalSupply: 1000000000,
    };
  }

  if (isLikelySolAddress(tokenValue)) {
    return {
      symbol: tokenValue.slice(0, 6).toUpperCase(),
      name: `Token ${tokenValue.slice(0, 10)}`,
      chain: chainHint || preferredChain || "sol",
      tokenAddress: tokenValue,
      decimals: 9,
      totalSupply: 1000000000,
    };
  }

  const tokenRes = await query<{
    symbol: string;
    name: string;
    chain: string;
    token_address: string;
    decimals: number;
    total_supply: number | null;
  }>(
    `
    SELECT symbol, name, chain, token_address, decimals, total_supply
    FROM whale_tokens
    WHERE upper(symbol) = upper($1)
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [tokenValue]
  );

  if (tokenRes.rows[0]) {
    const t = tokenRes.rows[0];
    return {
      symbol: t.symbol,
      name: t.name,
      chain: t.chain,
      tokenAddress: t.token_address,
      decimals: t.decimals,
      totalSupply: toNum(t.total_supply || 1000000000),
    };
  }

  throw new Error("Unsupported token input. Use symbol like ETH/WBTC/SOL or a token address.");
}

function getWhaleState(whaleNetflow7d: number, grossFlow7d: number): WhaleState {
  const neutralBand = Math.max(1, grossFlow7d * 0.03);
  if (whaleNetflow7d > neutralBand) return "ACCUMULATING";
  if (whaleNetflow7d < -neutralBand) return "DISTRIBUTING";
  return "NEUTRAL";
}

function scoreToAction(score: number): AnalyzeAction {
  if (score >= 60) return "LONG";
  if (score <= 40) return "SHORT";
  return "NO_SIGNAL";
}

function statusFromAction(action: AnalyzeAction, insufficientData: boolean): AnalyzeStatus {
  if (insufficientData) return "INSUFFICIENT_DATA";
  if (action === "LONG") return "LONG";
  if (action === "SHORT") return "SHORT";
  return "NO_SIGNAL";
}

function mergeProviderDiagnostics(
  ...sets: Array<Record<WhaleProviderName, ProviderDiagnostics>>
): Record<WhaleProviderName, ProviderState> {
  const providers: WhaleProviderName[] = ["alchemy", "covalent", "dune", "arkham"];
  const merged = {} as Record<WhaleProviderName, ProviderState>;

  for (const provider of providers) {
    const all = sets.map((set) => set[provider]).filter(Boolean);
    const calls = all.reduce((sum, row) => sum + row.calls, 0);
    const failures = all.reduce((sum, row) => sum + row.failures, 0);
    const used = all.some((row) => row.used);
    const first = all[0];
    const lastError = all.map((row) => row.lastError).find((row) => row) || null;
    const requestUrl = all.map((row) => row.requestUrl).find((row) => row) || null;
    const responseStatus = all.map((row) => row.responseStatus).find((row) => row != null) ?? null;

    let status: ProviderStatusCode = first?.status || "configured";
    if (!first?.keyPresent) {
      status = "key_missing";
    } else if (!first.chainSupported) {
      status = "unsupported_chain";
    } else if (failures > 0) {
      status = "request_failed";
    } else if (used) {
      status = "used";
    } else if (calls > 0) {
      status = "not_used";
    } else if (first.keyPresent && first.chainSupported) {
      status = "ready";
    }

    merged[provider] = {
      status,
      keyPresent: first?.keyPresent || false,
      chainSupported: first?.chainSupported || false,
      called: calls > 0,
      used,
      failures,
      requestUrl,
      responseStatus,
      error: lastError,
    };
  }

  return merged;
}

export async function POST(req: NextRequest) {
  try {
    ensureWhaleEnvLoaded();

    const body = (await req.json().catch(() => null)) as { token?: unknown; chain?: unknown } | null;
    const tokenInput = typeof body?.token === "string" ? body.token.trim() : "";
    const chainInput = typeof body?.chain === "string" ? body.chain.trim().toLowerCase() : "";

    if (!tokenInput) {
      return NextResponse.json({ ok: false, error: "token is required" }, { status: 400 });
    }

    let token: ResolvedToken;
    try {
      token = await resolveToken(tokenInput, chainInput || null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid token input";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    console.info("[whale-analyze][provider-env]", {
      chainResolved: token.chain,
      hasAlchemyKey: Boolean((process.env.WHALE_ALCHEMY_API_KEY || "").trim()),
      hasCovalentKey: Boolean((process.env.WHALE_COVALENT_API_KEY || "").trim()),
      hasDuneKey: Boolean((process.env.WHALE_DUNE_API_KEY || "").trim()),
      hasArkhamKey: Boolean((process.env.WHALE_ARKHAM_API_KEY || "").trim()),
    });

    const [transferData, holderData] = await Promise.all([
      fetchTransfersWithFallback({
        chain: token.chain,
        tokenAddress: token.tokenAddress,
        fromBlock: "0x0",
        limit: Number(process.env.WHALE_PROVIDER_TRANSFER_LIMIT || 500),
      }),
      fetchTopHoldersWithFallback({
        chain: token.chain,
        tokenAddress: token.tokenAddress,
        totalSupply: token.totalSupply,
        limit: Number(process.env.WHALE_PROVIDER_HOLDER_LIMIT || 120),
      }),
    ]);

    const wallets = new Set<string>();
    for (const t of transferData.transfers) {
      wallets.add(t.fromAddress);
      wallets.add(t.toAddress);
    }

    const labelsData = await fetchWalletLabelsWithFallback(token.chain, Array.from(wallets).slice(0, 600));
    const labelMap = new Map(labelsData.labels.map((row) => [normalizeAddress(row.walletAddress), row]));
    const providerStates = mergeProviderDiagnostics(
      transferData.providerDiagnostics,
      holderData.providerDiagnostics,
      labelsData.providerDiagnostics
    );

    console.info("[whale-analyze][covalent-debug]", {
      chainResolved: token.chain,
      called: providerStates.covalent.called,
      keyPresent: providerStates.covalent.keyPresent,
      chainSupported: providerStates.covalent.chainSupported,
      requestUrl: providerStates.covalent.requestUrl,
      responseStatus: providerStates.covalent.responseStatus,
      status: providerStates.covalent.status,
      error: providerStates.covalent.error,
    });

    const now = Date.now();
    const d1 = now - 24 * 60 * 60 * 1000;
    const d7 = now - 7 * 24 * 60 * 60 * 1000;

    let exchangeInflow1d = 0;
    let exchangeOutflow1d = 0;
    let exchangeInflow7d = 0;
    let exchangeOutflow7d = 0;
    let smartMoneyNetflow7d = 0;
    let exchangeTaggedEdges = 0;

    for (const t of transferData.transfers) {
      const ts = new Date(t.blockTime).getTime();
      const amount = toNum(t.amountDecimal);
      const fromLabel = labelMap.get(normalizeAddress(t.fromAddress))?.labelType || null;
      const toLabel = labelMap.get(normalizeAddress(t.toAddress))?.labelType || null;

      const fromExchange = fromLabel === "exchange";
      const toExchange = toLabel === "exchange";
      const fromSmart = fromLabel === "smart_money";
      const toSmart = toLabel === "smart_money";

      if (fromExchange || toExchange) exchangeTaggedEdges += 1;

      if (ts >= d1) {
        if (toExchange) exchangeInflow1d += amount;
        if (fromExchange) exchangeOutflow1d += amount;
      }

      if (ts >= d7) {
        if (toExchange) exchangeInflow7d += amount;
        if (fromExchange) exchangeOutflow7d += amount;
        if (toSmart) smartMoneyNetflow7d += amount;
        if (fromSmart) smartMoneyNetflow7d -= amount;
      }
    }

    const whaleNetflow1d = exchangeOutflow1d - exchangeInflow1d;
    const whaleNetflow7d = exchangeOutflow7d - exchangeInflow7d;
    const exchangeNetflow1d = exchangeInflow1d - exchangeOutflow1d;
    const exchangeNetflow7d = exchangeInflow7d - exchangeOutflow7d;

    const sortedHolders = holderData.holders.slice().sort((a, b) => b.balance - a.balance);
    const top10Concentration = sortedHolders.slice(0, 10).reduce((sum, row) => sum + toNum(row.pctSupply), 0);

    const transferCoverage = clamp(transferData.transfers.length / 120, 0, 1);
    const holderCoverage = clamp(holderData.holders.length / 50, 0, 1);
    const exchangeLabelCoverage =
      transferData.transfers.length > 0 ? clamp(exchangeTaggedEdges / transferData.transfers.length, 0, 1) : 0;

    const providerSet = new Set<string>([
      ...transferData.sourceProviders.map((row) => row.toLowerCase()),
      ...holderData.sourceProviders.map((row) => row.toLowerCase()),
      ...labelsData.sourceProviders.map((row) => row.toLowerCase()),
    ]);

    const sourceCoverage = clamp(
      SOURCE_PRIORITY.filter((source) => providerSet.has(source)).length / SOURCE_PRIORITY.length,
      0,
      1
    );

    const confidence = clamp(
      transferCoverage * 30 + holderCoverage * 15 + exchangeLabelCoverage * 20 + sourceCoverage * 35,
      0,
      100
    );

    const grossFlow7d = Math.abs(exchangeInflow7d) + Math.abs(exchangeOutflow7d);
    const whaleState = getWhaleState(whaleNetflow7d, grossFlow7d);

    const directionalStrength = grossFlow7d > 0 ? whaleNetflow7d / grossFlow7d : 0;
    const smartStrength = grossFlow7d > 0 ? smartMoneyNetflow7d / grossFlow7d : 0;

    let score = 50;
    score += directionalStrength * 42;
    score += smartStrength * 18;
    if (top10Concentration > 0.55) score -= 15;
    else if (top10Concentration > 0.4) score -= 8;
    const clampedScore = clamp(score, 0, 100);

    const insufficientData =
      confidence < SAFE_CONFIDENCE_THRESHOLD ||
      transferCoverage < MIN_TRANSFER_COVERAGE ||
      exchangeLabelCoverage < MIN_EXCHANGE_LABEL_COVERAGE;

    const action = insufficientData ? "NO_SIGNAL" : scoreToAction(clampedScore);
    const status = statusFromAction(action, insufficientData);

    const primarySources = SOURCE_PRIORITY.filter((source) => providerSet.has(source));
    const extraSources = Array.from(providerSet).filter((source) => !SOURCE_PRIORITY.includes(source as (typeof SOURCE_PRIORITY)[number]));
    const sources = [...primarySources, ...extraSources];

    const reasons: string[] = [
      `Whale netflow 7d is ${formatSigned(whaleNetflow7d)} (${whaleState.toLowerCase()})`,
      `Exchange netflow 7d is ${formatSigned(exchangeNetflow7d)}`,
      `Smart money netflow 7d is ${formatSigned(smartMoneyNetflow7d)}`,
      `Top 10 holder concentration is ${(top10Concentration * 100).toFixed(2)}%`,
      `Sources used: ${sources.length > 0 ? sources.join(", ") : "none"}`,
    ];

    if (insufficientData) {
      reasons.unshift("Data quality below safe threshold, directional signal is blocked");
    }

    return NextResponse.json({
      ok: true,
      symbol: token.symbol,
      chain: token.chain,
      tokenAddress: token.tokenAddress,
      action,
      status,
      confidence,
      whaleState,
      sources,
      reasons,
      metrics: {
        whaleNetflow1d,
        whaleNetflow7d,
        exchangeNetflow1d,
        exchangeNetflow7d,
        smartMoneyNetflow7d,
        transferCoverage,
        exchangeLabelCoverage,
      },
      providerStates,
      analyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analyze failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function formatSigned(value: number): string {
  if (value > 0) return `+${value.toFixed(2)}`;
  if (value < 0) return value.toFixed(2);
  return "0.00";
}
