import { useEffect, useState } from "react";

export type Plan = "free" | "pro";

const isBrowser = () => typeof window !== "undefined";

export function getUserPlan(): Plan {
  if (!isBrowser()) return "free";
  try {
    const plan = localStorage.getItem("nexyru_plan");
    return plan === "pro" ? "pro" : "free";
  } catch {
    return "free";
  }
}

export const LIMITS = {
  free: {
    maxTrades: 100,
    maxChallengeAccounts: 1,
    aiUsesPerDay: 1,
    screenshotImportsPerDay: 3,
    tradeReviewHistory: 5,
    hasInsights: false,
    hasPsychology: false,
    hasSetupFinder: false,
    hasAlerts: false,
    hasDailyNotes: false,
    hasCSVExport: false,
  },
  pro: {
    maxTrades: Infinity,
    maxChallengeAccounts: Infinity,
    aiUsesPerDay: Infinity,
    screenshotImportsPerDay: Infinity,
    tradeReviewHistory: Infinity,
    hasInsights: true,
    hasPsychology: true,
    hasSetupFinder: true,
    hasAlerts: true,
    hasDailyNotes: true,
    hasCSVExport: true,
  },
} as const;

export function canDo(feature: keyof typeof LIMITS.free): boolean {
  const plan = getUserPlan();
  return LIMITS[plan][feature] as boolean;
}

export function getLimit(limit: keyof typeof LIMITS.free): number {
  const plan = getUserPlan();
  return LIMITS[plan][limit] as number;
}

export function trackDailyUsage(key: string): { used: number; limit: number; canUse: boolean } {
  if (!isBrowser()) return { used: 0, limit: Infinity, canUse: true };
  const plan = getUserPlan();
  const today = new Date().toDateString();
  const storageKey = `nexyru_usage_${key}_${today}`;
  const used = parseInt(localStorage.getItem(storageKey) || "0", 10);
  const limit = LIMITS[plan][key as keyof typeof LIMITS.free] as number;
  return { used, limit, canUse: used < limit };
}

export function incrementUsage(key: string): void {
  if (!isBrowser()) return;
  const today = new Date().toDateString();
  const storageKey = `nexyru_usage_${key}_${today}`;
  const used = parseInt(localStorage.getItem(storageKey) || "0", 10);
  localStorage.setItem(storageKey, String(used + 1));
}

// React hook for SSR-safe plan checks in components
export function useUserPlan(): Plan {
  const [plan, setPlan] = useState<Plan>("free");
  useEffect(() => {
    setPlan(getUserPlan());
    // Pick up plan changes from other tabs / waitlist signups
    const onStorage = (e: StorageEvent) => {
      if (e.key === "nexyru_plan") setPlan(getUserPlan());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return plan;
}
