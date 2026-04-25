import { runWhaleScanner } from "../scanner/runScan";

export async function runScanner(limit?: number) {
  return runWhaleScanner(limit);
}
