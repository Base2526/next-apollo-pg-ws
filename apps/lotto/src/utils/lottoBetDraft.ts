// lottoBetDraft.ts
// Helper functions for persisting lotto bet draft state in localStorage

const STORAGE_KEY_PREFIX = "lotto_bet_draft";
const VERSION = 1;

export interface LottoBetDraft {
  version: number;
  savedAt: number;
  selectedBetTypeCode: string | null;
  currentNumber: string;
  price: number;
  cart: any[];
  // YEEKEE_VIP specific fields
  drawId?: number | string;
  draw_id?: number | string;
  roundNo?: number;
  round_no?: number;
  drawDate?: string;
  draw_date?: string;
}

function getStorageKey(categoryCode?: string): string {
  return categoryCode ? `${STORAGE_KEY_PREFIX}_${categoryCode}` : STORAGE_KEY_PREFIX;
}

export function loadBetDraft(categoryCode?: string): LottoBetDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getStorageKey(categoryCode));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed.version !== VERSION ||
      !("cart" in parsed) ||
      !Array.isArray(parsed.cart)
    ) {
      clearBetDraft(categoryCode);
      return null;
    }
    return parsed as LottoBetDraft;
  } catch (e) {
    clearBetDraft(categoryCode);
    return null;
  }
}

export function saveBetDraft(draft: LottoBetDraft, categoryCode?: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(categoryCode), JSON.stringify(draft));
  } catch (e) {
    // ignore
  }
}

export function clearBetDraft(categoryCode?: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getStorageKey(categoryCode));
  } catch (e) {
    // ignore
  }
}
