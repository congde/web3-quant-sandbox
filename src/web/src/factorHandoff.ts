import type { FactorBacktestSpec } from "./types";

export const FACTOR_HANDOFF_KEY = "factorMine.leaderSpec";

export type FactorHandoff = {
  backtestSpec: FactorBacktestSpec;
  symbol: string;
  limit: number;
  stopLoss: number;
  takeProfit: number;
  trailingStop: number;
  maxHoldBars: number;
  label?: string;
  testIc?: number;
  method?: string;
  savedAt: number;
};

export function saveFactorHandoff(handoff: Omit<FactorHandoff, "savedAt">): void {
  if (typeof window === "undefined") {
    return;
  }
  const payload: FactorHandoff = { ...handoff, savedAt: Date.now() };
  window.sessionStorage.setItem(FACTOR_HANDOFF_KEY, JSON.stringify(payload));
}

export function loadFactorHandoff(): FactorHandoff | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.sessionStorage.getItem(FACTOR_HANDOFF_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as FactorHandoff;
    if (!parsed?.backtestSpec?.factor_source) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearFactorHandoff(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(FACTOR_HANDOFF_KEY);
}
