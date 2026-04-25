type LogLevel = "info" | "warn" | "error";

export function scannerLog(level: LogLevel, message: string, extra?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    service: "whale-scanner",
    level,
    message,
    ...(extra || {}),
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}
