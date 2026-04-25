"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TokenAnalyzerInput } from "./TokenAnalyzerInput";

type AnalyzeAction = "LONG" | "SHORT" | "NO_SIGNAL";
type AnalyzeStatus = "LONG" | "SHORT" | "NO_SIGNAL" | "INSUFFICIENT_DATA";
type WhaleState = "ACCUMULATING" | "DISTRIBUTING" | "NEUTRAL";
type ProviderStatusCode = "key_missing" | "configured" | "ready" | "used" | "not_used" | "request_failed" | "unsupported_chain";

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

type AnalyzeResponse = {
  ok: boolean;
  symbol: string;
  chain: string;
  tokenAddress: string;
  action: AnalyzeAction;
  status: AnalyzeStatus;
  confidence: number;
  whaleState: WhaleState;
  sources: string[];
  reasons: string[];
  metrics: {
    whaleNetflow1d: number;
    whaleNetflow7d: number;
    exchangeNetflow1d: number;
    exchangeNetflow7d: number;
    smartMoneyNetflow7d: number;
    transferCoverage: number;
    exchangeLabelCoverage: number;
  };
  providerStates?: Partial<Record<"arkham" | "covalent" | "alchemy" | "dune", ProviderState>>;
  analyzedAt: string;
};

type ViewState = "idle" | "loading" | "low-data" | "ready";

const HISTORY_KEY = "whale-analyzer-history-v1";
const HISTORY_LIMIT = 10;
const PRIMARY_SOURCES = ["arkham", "covalent", "alchemy"] as const;

function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatSigned(value: unknown): string {
  const n = toNum(value);
  if (n > 0) return `+${n.toFixed(2)}`;
  if (n < 0) return n.toFixed(2);
  return "0.00";
}

function formatPercent(value: unknown): string {
  return `${toNum(value).toFixed(1)}%`;
}

function toneFromValue(value: number): "green" | "red" | "neutral" {
  if (value > 0) return "green";
  if (value < 0) return "red";
  return "neutral";
}

function statusLabel(status: AnalyzeStatus): string {
  if (status === "INSUFFICIENT_DATA") return "INSUFFICIENT DATA";
  if (status === "NO_SIGNAL") return "NO SIGNAL";
  return status;
}

function statusIcon(status: AnalyzeStatus): string {
  if (status === "LONG") return "🟢";
  if (status === "SHORT") return "🔴";
  if (status === "NO_SIGNAL") return "⚪";
  return "⚫";
}

function statusTone(status: AnalyzeStatus): "green" | "red" | "neutral" {
  if (status === "LONG") return "green";
  if (status === "SHORT") return "red";
  return "neutral";
}

function providerBadgeClass(status: ProviderStatusCode | undefined): string {
  if (status === "used") return "used";
  if (status === "request_failed") return "failed";
  if (status === "key_missing") return "missing";
  if (status === "unsupported_chain") return "unsupported";
  if (status === "not_used") return "not-used";
  if (status === "ready") return "ready";
  if (status === "configured") return "configured";
  return "configured";
}

function providerBadgeLabel(status: ProviderStatusCode | undefined): string {
  if (status === "used") return "used";
  if (status === "request_failed") return "request failed";
  if (status === "key_missing") return "missing";
  if (status === "unsupported_chain") return "unsupported chain";
  if (status === "not_used") return "not used";
  if (status === "ready") return "ready";
  if (status === "configured") return "configured";
  return "configured";
}

export function WhaleDashboard() {
  const [tokenInput, setTokenInput] = useState("");
  const [historyItems, setHistoryItems] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const normalized = parsed.map((row) => String(row || "").trim()).filter(Boolean).slice(0, HISTORY_LIMIT);
        setHistoryItems(normalized);
      }
    } catch {
      setHistoryItems([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(historyItems));
  }, [historyItems]);

  const updateHistory = useCallback((value: string) => {
    const clean = value.trim();
    if (!clean) return;
    setHistoryItems((prev) => {
      const merged = [clean, ...prev.filter((row) => row.toLowerCase() !== clean.toLowerCase())];
      return merged.slice(0, HISTORY_LIMIT);
    });
  }, []);

  const runAnalyze = useCallback(
    async (rawToken: string, mode: "analyze" | "sync") => {
      const token = rawToken.trim();
      if (!token) return;

      setError("");
      if (mode === "sync") {
        setSyncing(true);
      } else {
        setAnalyzing(true);
      }

      try {
        const res = await fetch("/api/whale/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({ token }),
        });

        const json = (await res.json()) as AnalyzeResponse & { error?: string };
        if (!res.ok || !json.ok) {
          throw new Error(json.error || `Analyze HTTP ${res.status}`);
        }

        setResult(json);
        setTokenInput(token);
        updateHistory(token);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Analyze failed";
        setError(message.includes("Unsupported token input") ? "Token not recognized. Try ETH, BTC, SOL, or a token address." : message);
        if (mode === "analyze") {
          setResult(null);
        }
      } finally {
        setAnalyzing(false);
        setSyncing(false);
      }
    },
    [updateHistory]
  );

  const onAnalyze = useCallback(() => {
    void runAnalyze(tokenInput, "analyze");
  }, [runAnalyze, tokenInput]);

  const onSync = useCallback(() => {
    void runAnalyze(tokenInput, "sync");
  }, [runAnalyze, tokenInput]);

  const viewState = useMemo<ViewState>(() => {
    if (analyzing || syncing) return "loading";
    if (!result) return "idle";
    if (result.status === "INSUFFICIENT_DATA") return "low-data";
    return "ready";
  }, [analyzing, syncing, result]);

  const sourceStatus = useMemo(
    () =>
      PRIMARY_SOURCES.map((source) => ({
        source,
        status: result?.providerStates?.[source]?.status,
        detail: result?.providerStates?.[source],
      })),
    [result]
  );

  return (
    <main className="dashboard-wrap">
      <header className="card top-head">
        <h1>Token Analyzer Tool</h1>
        <p>Analyze token whale behavior with clear LONG / SHORT / NO SIGNAL output.</p>
      </header>

      <TokenAnalyzerInput
        value={tokenInput}
        onChange={setTokenInput}
        onAnalyze={onAnalyze}
        analyzing={analyzing}
        onSync={onSync}
        syncing={syncing}
        historyItems={historyItems}
        onSelectHistory={setTokenInput}
        onDeleteHistory={(value) => setHistoryItems((prev) => prev.filter((item) => item !== value))}
        onClearHistory={() => setHistoryItems([])}
      />

      {error ? <section className="card error">Error: {error}</section> : null}

      {viewState === "idle" ? (
        <section className="card">
          <strong>Type a token symbol or address and click Analyze.</strong>
          <div className="hint">Example: ETH, BTC, SOL, or 0x token address.</div>
        </section>
      ) : null}

      {viewState === "loading" ? <section className="card">Fetching multi-source whale data...</section> : null}

      {result ? (
        <>
          <section className="card token-meta">
            <div>
              <span className="label">Token</span>
              <strong>{result.symbol}</strong>
            </div>
            <div>
              <span className="label">Chain</span>
              <strong>{result.chain.toUpperCase()}</strong>
            </div>
            <div>
              <span className="label">Address</span>
              <strong className="mono">{result.tokenAddress}</strong>
            </div>
            <div>
              <span className="label">Updated</span>
              <strong>{new Date(result.analyzedAt).toLocaleString()}</strong>
            </div>
          </section>

          <section className={`card result-card ${statusTone(result.status)}`}>
            <div className="result-main">
              <div className="result-status">
                <span>{statusIcon(result.status)}</span>
                <h2>{statusLabel(result.status)}</h2>
              </div>
              <div className="result-line">
                Action: <strong>{result.action === "NO_SIGNAL" ? "NO SIGNAL" : result.action}</strong>
              </div>
              <div className="result-line">
                Confidence: <strong>{formatPercent(result.confidence)}</strong>
              </div>
              <div className="result-line">
                Whale Behavior: <strong>{result.whaleState}</strong>
              </div>
            </div>

            <div className="result-side">
              <h3>Sources</h3>
              <div className="source-list">
                {sourceStatus.map((row) => (
                  <span key={row.source} className={`source-pill ${providerBadgeClass(row.status)}`}>
                    {row.source}: {providerBadgeLabel(row.status)}
                  </span>
                ))}
              </div>
              <div className="source-combined">Used: {result.sources.length > 0 ? result.sources.join(" + ") : "none"}</div>
            </div>
          </section>

          <section className="signals-grid">
            <article className="card">
              <h3>Key Signals</h3>
              <div className="metric-row">
                <span>Whale Netflow 1d</span>
                <strong className={toneFromValue(toNum(result.metrics.whaleNetflow1d))}>{formatSigned(result.metrics.whaleNetflow1d)}</strong>
              </div>
              <div className="metric-row">
                <span>Whale Netflow 7d</span>
                <strong className={toneFromValue(toNum(result.metrics.whaleNetflow7d))}>{formatSigned(result.metrics.whaleNetflow7d)}</strong>
              </div>
              <div className="metric-row">
                <span>Exchange Netflow 7d</span>
                <strong className={toneFromValue(toNum(result.metrics.exchangeNetflow7d))}>{formatSigned(result.metrics.exchangeNetflow7d)}</strong>
              </div>
              <div className="metric-row">
                <span>Smart Money Netflow 7d</span>
                <strong className={toneFromValue(toNum(result.metrics.smartMoneyNetflow7d))}>{formatSigned(result.metrics.smartMoneyNetflow7d)}</strong>
              </div>
            </article>

            <article className="card">
              <h3>Reasoning</h3>
              <ul className="reason-list">
                {result.reasons.map((reason, idx) => (
                  <li key={`${reason}-${idx}`}>{reason}</li>
                ))}
              </ul>
              <div className="coverage-box">
                <div>Transfer coverage: {formatPercent(toNum(result.metrics.transferCoverage) * 100)}</div>
                <div>Exchange label coverage: {formatPercent(toNum(result.metrics.exchangeLabelCoverage) * 100)}</div>
              </div>
            </article>
          </section>
        </>
      ) : null}

      <style jsx>{`
        .dashboard-wrap {
          min-height: 100vh;
          padding: 24px;
          display: grid;
          gap: 14px;
          background:
            radial-gradient(circle at 8% 5%, rgba(22, 163, 74, 0.15), transparent 32%),
            radial-gradient(circle at 85% 10%, rgba(239, 68, 68, 0.14), transparent 34%),
            #08101c;
          color: #dbe7ff;
        }

        .card {
          background: rgba(10, 20, 38, 0.8);
          border: 1px solid #223452;
          border-radius: 14px;
          padding: 14px;
        }

        .top-head h1 {
          margin: 0;
          font-size: 28px;
        }

        .top-head p {
          margin: 8px 0 0;
          color: #9eb3cf;
        }

        .token-meta {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }

        .token-meta .label {
          display: block;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #89a0bf;
          margin-bottom: 6px;
        }

        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace;
          font-size: 12px;
          word-break: break-all;
        }

        .result-card {
          display: grid;
          grid-template-columns: minmax(260px, 1.1fr) minmax(240px, 1fr);
          gap: 16px;
          border-width: 2px;
        }

        .result-card.green {
          border-color: rgba(34, 197, 94, 0.7);
        }

        .result-card.red {
          border-color: rgba(239, 68, 68, 0.7);
        }

        .result-card.neutral {
          border-color: rgba(148, 163, 184, 0.7);
        }

        .result-status {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }

        .result-status h2 {
          margin: 0;
          font-size: clamp(28px, 4.2vw, 40px);
          line-height: 1;
        }

        .result-line {
          margin-top: 8px;
          color: #cbd8ed;
        }

        .result-line strong {
          color: #ffffff;
        }

        .result-side h3,
        .signals-grid h3 {
          margin: 0 0 10px;
        }

        .source-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .source-pill {
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 12px;
          border: 1px solid #304566;
        }

        .source-pill.used {
          color: #86efac;
          border-color: rgba(34, 197, 94, 0.65);
          background: rgba(22, 101, 52, 0.2);
        }

        .source-pill.ready,
        .source-pill.configured,
        .source-pill.not-used {
          color: #dbeafe;
          border-color: rgba(125, 211, 252, 0.55);
          background: rgba(14, 116, 144, 0.25);
        }

        .source-pill.failed {
          color: #fecaca;
          border-color: rgba(239, 68, 68, 0.7);
          background: rgba(127, 29, 29, 0.35);
        }

        .source-pill.unsupported {
          color: #fde68a;
          border-color: rgba(245, 158, 11, 0.65);
          background: rgba(120, 53, 15, 0.28);
        }

        .source-pill.missing {
          color: #cbd5e1;
          border-color: rgba(148, 163, 184, 0.55);
          background: rgba(51, 65, 85, 0.3);
        }

        .source-combined {
          margin-top: 10px;
          color: #9eb3cf;
          font-size: 13px;
        }

        .signals-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 14px;
        }

        .metric-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid #233653;
          color: #b9cae4;
        }

        .metric-row strong {
          color: #ffffff;
        }

        .reason-list {
          margin: 0;
          padding-left: 18px;
          display: grid;
          gap: 8px;
          color: #c8d8f3;
        }

        .coverage-box {
          margin-top: 12px;
          border: 1px solid #2a3f60;
          border-radius: 10px;
          padding: 10px;
          color: #9eb3cf;
          display: grid;
          gap: 6px;
          font-size: 13px;
        }

        .hint {
          margin-top: 8px;
          color: #9eb3cf;
        }

        .green {
          color: #4ade80;
        }

        .red {
          color: #f87171;
        }

        .neutral {
          color: #cbd5e1;
        }

        .error {
          color: #fecaca;
          border-color: rgba(239, 68, 68, 0.6);
        }

        @media (max-width: 900px) {
          .dashboard-wrap {
            padding: 16px;
          }

          .result-card {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
