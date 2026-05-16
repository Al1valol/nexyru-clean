import { useEffect, useState } from "react";

export type Plan = "free" | "pro" | "elite";

// Emails that always get elite access. CLIENT-SIDE GATE ONLY — this is
// readable in the JS bundle by anyone and bypassable via devtools. Any
// server-cost feature (AI calls, premium queries) must verify plan on
// the server, not trust this.
const ADMIN_EMAILS = ["calemax5@gmail.com"];

const isBrowser = () => typeof window !== "undefined";

// Pull the current user's email from whichever client-side store has it.
// Checks the Supabase auth token first (canonical), then falls back to the
// app's persisted session blob written by /login and /auth/complete.
function readCurrentEmail(): string {
  if (!isBrowser()) return "";
  try {
    const supaToken = localStorage.getItem("sb-xsrcaceydyqytbipvrok-auth-token");
    const supaUser = supaToken ? JSON.parse(supaToken) : null;
    const supaEmail = supaUser?.user?.email || supaUser?.currentSession?.user?.email;
    if (supaEmail) return String(supaEmail).toLowerCase();
  } catch {}
  try {
    const session = JSON.parse(localStorage.getItem("tradedesk_session_v1") || "{}");
    if (session?.email) return String(session.email).toLowerCase();
  } catch {}
  return "";
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(String(email).toLowerCase());
}

// Call from auth handlers right after the session is persisted, so the
// fast-path `nexyru_plan === 'elite'` is set for admin emails.
export function applyAdminPlanForEmail(email: string | null | undefined): void {
  if (!isBrowser()) return;
  if (isAdminEmail(email)) {
    try {
      localStorage.setItem("nexyru_plan", "elite");
    } catch {}
  }
}

export function getUserPlan(): Plan {
  if (!isBrowser()) return "free";

  // Admin override — always elite if the signed-in email is on the list.
  try {
    if (isAdminEmail(readCurrentEmail())) return "elite";
  } catch {}

  try {
    const plan = localStorage.getItem("nexyru_plan");
    if (plan === "elite") return "elite";
    if (plan === "pro") return "pro";
    return "free";
  } catch {
    return "free";
  }
}

export const LIMITS = {
  free: {
    maxTrades: 50,
    maxChallengeAccounts: 1,
    aiUsesPerDay: 0,
    screenshotImportsPerDay: 1,
    tradeReviewHistory: 3,
    hasInsights: false,
    hasPsychology: false,
    hasSetupFinder: false,
    hasAlerts: false,
    hasDailyNotes: false,
    hasCSVExport: false,
    hasMultipleAccounts: false,
  },
  pro: {
    maxTrades: Infinity,
    maxChallengeAccounts: 3,
    aiUsesPerDay: 10,
    screenshotImportsPerDay: 20,
    tradeReviewHistory: Infinity,
    hasInsights: true,
    hasPsychology: true,
    hasSetupFinder: true,
    hasAlerts: true,
    hasDailyNotes: true,
    hasCSVExport: true,
    hasMultipleAccounts: true,
  },
  elite: {
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
    hasMultipleAccounts: true,
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
