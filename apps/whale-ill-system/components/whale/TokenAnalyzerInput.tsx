"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onAnalyze: () => void;
  analyzing: boolean;
  onSync: () => void;
  syncing: boolean;
  historyItems: string[];
  onSelectHistory: (value: string) => void;
  onDeleteHistory: (value: string) => void;
  onClearHistory: () => void;
};

export function TokenAnalyzerInput({
  value,
  onChange,
  onAnalyze,
  analyzing,
  onSync,
  syncing,
  historyItems,
  onSelectHistory,
  onDeleteHistory,
  onClearHistory,
}: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onWindowClick(event: MouseEvent) {
      if (!historyRef.current) return;
      if (event.target instanceof Node && !historyRef.current.contains(event.target)) {
        setHistoryOpen(false);
      }
    }

    window.addEventListener("click", onWindowClick);
    return () => window.removeEventListener("click", onWindowClick);
  }, []);

  return (
    <section className="card" style={{ marginBottom: 12, position: "relative" }}>
      <div style={{ marginBottom: 10, fontSize: 12, color: "#9eb3cf", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Token Analyzer
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="input"
          style={{ minWidth: 280, flex: 1 }}
          type="text"
          value={value}
          placeholder="Enter token symbol or address"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAnalyze();
            }
          }}
          disabled={analyzing}
        />
        <button className="button" onClick={onAnalyze} disabled={analyzing || !value.trim()}>
          {analyzing ? "Analyzing..." : "Analyze 🔍"}
        </button>
        <button className="button" onClick={onSync} disabled={syncing || analyzing || !value.trim()}>
          {syncing ? "Syncing..." : "Sync Data"}
        </button>
        <div ref={historyRef} style={{ position: "relative" }}>
          <button className="button" onClick={() => setHistoryOpen((v) => !v)}>
            History ▾
          </button>
          {historyOpen ? (
            <div
              className="card"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                minWidth: 260,
                zIndex: 20,
                padding: 10,
                display: "grid",
                gap: 8,
              }}
            >
              {historyItems.length === 0 ? <div style={{ fontSize: 12, color: "#9eb3cf" }}>No recent tokens</div> : null}
              {historyItems.map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <button
                    className="button"
                    style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    onClick={() => {
                      onSelectHistory(item);
                      setHistoryOpen(false);
                    }}
                  >
                    {item}
                  </button>
                  <button className="button" onClick={() => onDeleteHistory(item)} aria-label={`Delete ${item} from history`}>
                    Delete
                  </button>
                </div>
              ))}
              {historyItems.length > 0 ? (
                <button
                  className="button"
                  onClick={() => {
                    onClearHistory();
                    setHistoryOpen(false);
                  }}
                >
                  Clear History
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
