import fs from "node:fs";
import path from "node:path";

let loaded = false;

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    if (!key) continue;

    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    out[key] = value;
  }
  return out;
}

function candidateEnvPaths(): string[] {
  const cwd = process.cwd();
  const paths = [
    path.join(cwd, ".env.dev"),
    path.join(cwd, "next-apollo-pg-ws", ".env.dev"),
    path.join(cwd, "..", ".env.dev"),
    path.join(cwd, "..", "..", ".env.dev"),
    path.join(cwd, "..", "..", "..", ".env.dev"),
  ];

  return Array.from(new Set(paths));
}

export function ensureWhaleEnvLoaded(): void {
  if (loaded) return;
  loaded = true;

  const importantKeys = [
    "WHALE_ALCHEMY_API_KEY",
    "WHALE_COVALENT_API_KEY",
    "WHALE_DUNE_API_KEY",
    "WHALE_ARKHAM_API_KEY",
  ];

  const alreadyPresent = importantKeys.some((key) => Boolean((process.env[key] || "").trim()));
  if (alreadyPresent) {
    return;
  }

  for (const envPath of candidateEnvPaths()) {
    if (!fs.existsSync(envPath)) continue;

    const content = fs.readFileSync(envPath, "utf8");
    const parsed = parseEnvFile(content);

    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] == null || process.env[key] === "") {
        process.env[key] = value;
      }
    }

    console.info("[whale-env] loaded fallback env file", {
      envPath,
      hasAlchemyKey: Boolean((process.env.WHALE_ALCHEMY_API_KEY || "").trim()),
      hasCovalentKey: Boolean((process.env.WHALE_COVALENT_API_KEY || "").trim()),
    });
    return;
  }

  console.info("[whale-env] fallback env file not found", {
    cwd,
  });
}
