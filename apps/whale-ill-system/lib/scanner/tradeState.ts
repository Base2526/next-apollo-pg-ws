export type TradeState = "STRONG_LONG" | "LONG" | "WATCH" | "WAIT" | "SHORT_BIAS" | "AVOID";

export type TradeStateInput = {
  score: number;
  smartMoneyInflow7d: number;
  whaleAccumulation7d: number;
  exchangeNetflow7d: number;
  daysToUnlock: number | null;
  top10Concentration: number;
  liquidity: number;
  volume24h: number;
};

function minLiquidity(): number {
  return Number(process.env.WHALE_MIN_LIQUIDITY_USD || 100000);
}

function minVolume(): number {
  return Number(process.env.WHALE_MIN_VOLUME_24H_USD || 500000);
}

export function decideTradeState(input: TradeStateInput): TradeState {
  const highUnlockRisk = input.daysToUnlock != null && input.daysToUnlock <= 7;
  const highConcentrationRisk = input.top10Concentration > 0.5;
  const tradable = input.liquidity >= minLiquidity() && input.volume24h >= minVolume();

  if (highUnlockRisk && highConcentrationRisk) return "AVOID";
  if (input.score < 25) return "AVOID";

  const strongBullish =
    input.score >= 85 &&
    input.smartMoneyInflow7d > 0 &&
    input.whaleAccumulation7d > 0 &&
    input.exchangeNetflow7d < 0 &&
    tradable;
  if (strongBullish) return "STRONG_LONG";

  if (input.score >= 70 && input.exchangeNetflow7d <= 0) return "LONG";
  if (input.score >= 50) return "WATCH";

  if (input.exchangeNetflow7d > 0 && input.whaleAccumulation7d < 0) return "SHORT_BIAS";
  if (input.score < 35 && (highUnlockRisk || input.exchangeNetflow7d > 0)) return "SHORT_BIAS";

  return "WAIT";
}

export function isPlayableState(state: TradeState): boolean {
  return state === "STRONG_LONG" || state === "LONG" || state === "WATCH";
}
