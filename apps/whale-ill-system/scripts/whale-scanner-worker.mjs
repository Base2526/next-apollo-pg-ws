const intervalMinutes = Number(process.env.WHALE_SCANNER_INTERVAL_MINUTES || 5);
const sleepMs = Math.max(1, intervalMinutes) * 60 * 1000;

const scannerUrl =
  process.env.WHALE_SCANNER_API_URL ||
  `http://localhost:${process.env.PORT || process.env.WHALE_ILL_PORT || "3010"}/api/whale/scan`;

const adminToken = process.env.WHALE_ADMIN_TOKEN || "";
const tokenLimit = process.env.WHALE_SCANNER_TOKEN_LIMIT || "";
const runOnceOnly = process.env.WHALE_SCANNER_RUN_ONCE === "1";

let running = false;

function log(level, message, extra = {}) {
  const row = {
    ts: new Date().toISOString(),
    service: "whale-scanner-worker",
    level,
    message,
    ...extra,
  };
  const line = JSON.stringify(row);
  if (level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
}

async function runOnce() {
  if (running) {
    log("warn", "scan skipped because previous run still active");
    return;
  }

  running = true;
  const startedAt = Date.now();

  try {
    const body = tokenLimit ? { limit: Number(tokenLimit) } : {};
    const response = await fetch(scannerUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(adminToken ? { "x-whale-admin-token": adminToken } : {}),
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) {
      throw new Error(`scanner call failed: ${response.status} ${JSON.stringify(payload).slice(0, 600)}`);
    }

    log("info", "scan completed", {
      durationMs: Date.now() - startedAt,
      summary: payload.summary || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("error", "scan failed", {
      durationMs: Date.now() - startedAt,
      error: message,
    });
  } finally {
    running = false;
  }
}

log("info", "worker started", {
  scannerUrl,
  intervalMinutes,
});

await runOnce();
if (!runOnceOnly) {
  setInterval(runOnce, sleepMs);
}
