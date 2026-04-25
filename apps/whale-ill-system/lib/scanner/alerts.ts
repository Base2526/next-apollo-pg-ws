import type { PoolClient } from "pg";

import { sendLineAlertMessage } from "../alerts/line";
import { scannerLog } from "./logger";

type AlertCandidate = {
  token_id: string;
  symbol: string;
  chain: string;
  whale_score: number;
  final_trade_state: string;
  smart_money_score: number;
  exchange_pressure_score: number;
  concentration_risk_score: number;
  unlock_risk_score: number;
  reason_json: unknown;
  playability_score: number;
  data_confidence_score: number;
  whale_accumulation_7d: number;
  exchange_netflow_7d: number;
  days_to_next_unlock: number | null;
};

function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function cooldownMinutes(): number {
  return Math.max(1, Number(process.env.WHALE_ALERT_COOLDOWN_MINUTES || 90));
}

function longThreshold(): number {
  return Math.max(1, Number(process.env.WHALE_LONG_ALERT_SCORE_MIN || 70));
}

function dashboardUrl(tokenId: string): string {
  const base = process.env.WHALE_ILL_NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
  if (!base) return `/whale?tokenId=${encodeURIComponent(tokenId)}`;
  return `${base.replace(/\/$/, "")}/whale?tokenId=${encodeURIComponent(tokenId)}`;
}

function mapDisplayState(state: string): string {
  if (state === "STRONG_LONG") return "Strong Long";
  if (state === "LONG") return "Long";
  if (state === "WATCH") return "Watchlist";
  if (state === "SHORT_BIAS") return "Short Bias";
  if (state === "AVOID") return "Avoid";
  return "Wait";
}

function isLongCandidate(row: AlertCandidate): boolean {
  const state = row.final_trade_state;
  const highState = state === "STRONG_LONG" || state === "LONG" || state === "Strong Long" || state === "Long";
  return highState && toNum(row.whale_score) >= longThreshold() && toNum(row.data_confidence_score) >= 55;
}

function buildMessage(row: AlertCandidate): string {
  const reasons = Array.isArray(row.reason_json)
    ? row.reason_json.map((x) => String(x)).slice(0, 4).map((x) => `- ${x}`).join("\n")
    : "- Whale and exchange metrics aligned";

  const state = mapDisplayState(row.final_trade_state);
  return [
    `[WHALE LONG ALERT]`,
    `Token: ${row.symbol} (${row.chain})`,
    `State: ${state}`,
    `Score: ${toNum(row.whale_score).toFixed(0)}`,
    `Confidence: ${toNum(row.data_confidence_score).toFixed(0)}%`,
    `Why:`,
    reasons,
    `Whale netflow 7d: ${toNum(row.whale_accumulation_7d).toFixed(2)}`,
    `Exchange netflow 7d: ${toNum(row.exchange_netflow_7d).toFixed(2)}`,
    `Unlock risk days: ${row.days_to_next_unlock ?? "n/a"}`,
    `Dashboard: ${dashboardUrl(row.token_id)}`,
  ].join("\n");
}

export async function maybeSendLongAlert(client: PoolClient, tokenId: string): Promise<void> {
  const res = await client.query<AlertCandidate>(
    `
    WITH flow AS (
      SELECT COALESCE(SUM(netflow), 0)::float8 AS exchange_netflow_7d
      FROM whale_exchange_flow_daily
      WHERE token_id = $1::uuid
        AND stat_date >= NOW()::date - INTERVAL '7 day'
    ),
    unlocks AS (
      SELECT
        MIN(unlock_date) AS next_unlock_date,
        EXTRACT(DAY FROM MIN(unlock_date)::timestamp - NOW())::int AS days_to_next_unlock
      FROM whale_unlock_events
      WHERE token_id = $1::uuid
        AND unlock_date >= NOW()::date
    )
    SELECT
      r.token_id,
      t.symbol,
      t.chain,
      r.whale_score::float8 AS whale_score,
      r.final_trade_state,
      r.smart_money_score::float8 AS smart_money_score,
      r.exchange_pressure_score::float8 AS exchange_pressure_score,
      r.concentration_risk_score::float8 AS concentration_risk_score,
      r.unlock_risk_score::float8 AS unlock_risk_score,
      r.reason_json,
      p.playability_score::float8 AS playability_score,
      p.data_confidence_score::float8 AS data_confidence_score,
      p.whale_accumulation_7d::float8 AS whale_accumulation_7d,
      f.exchange_netflow_7d,
      u.days_to_next_unlock
    FROM whale_scanner_results r
    JOIN whale_tokens t ON t.id = r.token_id
    LEFT JOIN token_playability_score p ON p.token_id = r.token_id
    CROSS JOIN flow f
    CROSS JOIN unlocks u
    WHERE r.token_id = $1::uuid
    LIMIT 1
    `,
    [tokenId]
  );

  const row = res.rows[0];
  if (!row) return;
  if (!isLongCandidate(row)) return;

  const cooldown = cooldownMinutes();
  const dedupeKey = `${row.token_id}:${row.final_trade_state}:${Math.round(toNum(row.whale_score) / 5)}`;

  const prior = await client.query<{
    last_alerted_at: string | null;
    last_trade_state: string | null;
    last_score: number | null;
    dedupe_key: string | null;
  }>(
    `
    SELECT last_alerted_at, last_trade_state, last_score, dedupe_key
    FROM whale_alert_state
    WHERE token_id = $1::uuid
    LIMIT 1
    `,
    [tokenId]
  );

  const prev = prior.rows[0];
  const now = Date.now();
  if (prev?.last_alerted_at) {
    const elapsedMin = (now - new Date(prev.last_alerted_at).getTime()) / 60000;
    const sameDedupe = prev.dedupe_key === dedupeKey;
    if (sameDedupe && elapsedMin < cooldown) {
      scannerLog("info", "line alert skipped due to cooldown", {
        tokenId,
        dedupeKey,
        elapsedMin,
        cooldown,
      });
      return;
    }
  }

  const message = buildMessage(row);
  const send = await sendLineAlertMessage(message);

  await client.query(
    `
    INSERT INTO whale_alert_events (
      id,
      token_id,
      alert_type,
      state,
      score,
      confidence,
      dedupe_key,
      channel,
      message_text,
      reason_json,
      status,
      created_at
    )
    VALUES (
      uuid_generate_v4(),
      $1::uuid,
      'LONG_SETUP',
      $2,
      $3,
      $4,
      $5,
      'line',
      $6,
      $7::jsonb,
      $8,
      NOW()
    )
    `,
    [
      tokenId,
      row.final_trade_state,
      toNum(row.whale_score),
      toNum(row.data_confidence_score),
      dedupeKey,
      message,
      JSON.stringify(row.reason_json || []),
      send.ok ? "sent" : "skipped",
    ]
  );

  await client.query(
    `
    INSERT INTO whale_alert_state (
      id,
      token_id,
      last_trade_state,
      last_score,
      last_alerted_at,
      dedupe_key,
      updated_at,
      created_at
    )
    VALUES (
      uuid_generate_v4(),
      $1::uuid,
      $2,
      $3,
      NOW(),
      $4,
      NOW(),
      NOW()
    )
    ON CONFLICT (token_id)
    DO UPDATE SET
      last_trade_state = EXCLUDED.last_trade_state,
      last_score = EXCLUDED.last_score,
      last_alerted_at = EXCLUDED.last_alerted_at,
      dedupe_key = EXCLUDED.dedupe_key,
      updated_at = NOW()
    `,
    [tokenId, row.final_trade_state, toNum(row.whale_score), dedupeKey]
  );

  scannerLog(send.ok ? "info" : "warn", "line alert processed", {
    tokenId,
    symbol: row.symbol,
    sent: send.ok,
    channel: send.channel,
    status: send.status,
  });
}
