type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onResponse?: (response: Response) => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextBackoff(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const raw = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
  const jitter = raw * (0.8 + Math.random() * 0.4);
  return Math.round(jitter);
}

function parseRetryAfterMs(response: Response): number | null {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return null;

  const numeric = Number(retryAfter);
  if (Number.isFinite(numeric) && numeric >= 0) return numeric * 1000;

  const asDate = new Date(retryAfter);
  if (!Number.isFinite(asDate.getTime())) return null;
  return Math.max(0, asDate.getTime() - Date.now());
}

export async function requestJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    headers = {},
    body,
    timeoutMs = 20000,
    retries = 2,
    baseDelayMs = 500,
    maxDelayMs = 5000,
    onResponse,
  } = options;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (onResponse) {
        onResponse(response);
      }

      if (response.ok) {
        return (await response.json()) as T;
      }

      const isRetryableStatus = response.status === 429 || response.status >= 500;
      if (attempt < retries && isRetryableStatus) {
        const retryAfterMs = parseRetryAfterMs(response);
        const waitMs = retryAfterMs ?? nextBackoff(attempt, baseDelayMs, maxDelayMs);
        await sleep(waitMs);
        continue;
      }

      const bodyText = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status} from ${url} - ${bodyText.slice(0, 400)}`);
    } catch (error) {
      clearTimeout(timer);
      if (attempt >= retries) {
        throw error;
      }
      await sleep(nextBackoff(attempt, baseDelayMs, maxDelayMs));
    }
  }

  throw new Error(`Unreachable request state for ${url}`);
}

export function normalizeAddress(address: string): string {
  return String(address || "").trim().toLowerCase();
}

export function chainToCovalentId(chain: string): number | null {
  const c = chain.toLowerCase();
  if (c === "eth" || c === "ethereum") return 1;
  if (c === "bsc") return 56;
  if (c === "polygon") return 137;
  if (c === "base") return 8453;
  if (c === "arb" || c === "arbitrum") return 42161;
  return null;
}

export function chainToCovalentSlug(chain: string): string | null {
  const c = chain.toLowerCase();
  if (c === "eth" || c === "ethereum") return "eth-mainnet";
  if (c === "bsc") return "bsc-mainnet";
  if (c === "polygon") return "matic-mainnet";
  if (c === "base") return "base-mainnet";
  if (c === "arb" || c === "arbitrum") return "arbitrum-mainnet";
  return null;
}
