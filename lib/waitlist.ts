// Shared waitlist helpers — used by app/page.tsx and app/pricing/page.tsx
//
// Strategy: save to localStorage synchronously (drives the UI), then
// best-effort POST to Supabase (fire-and-forget — never blocks the success
// state if the network is slow or Supabase is down).

const SUPA_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ||
  "https://xsrcaceydyqytbipvrok.supabase.co";

const SUPA_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcmNhY2V5ZHlxeXRiaXB2cm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDg0MjUsImV4cCI6MjA5MzUyNDQyNX0.IfIkjTtAAb0-iZLu8CE-3GgdNGKxSNJKczSAZlQV62A";

export type WaitlistPlan = "pro" | "elite";

const STORAGE_KEYS: Record<WaitlistPlan, string> = {
  pro: "nexyru_waitlist_pro",
  elite: "nexyru_waitlist_elite",
};

const DISCOUNT_LABEL: Record<WaitlistPlan, string> = {
  pro: "$19/mo",
  elite: "$29/mo locked in",
};

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function saveLocally(plan: WaitlistPlan, email: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = STORAGE_KEYS[plan];
    const list: string[] = JSON.parse(localStorage.getItem(key) || "[]");
    if (!list.includes(email)) list.push(email);
    localStorage.setItem(key, JSON.stringify(list));
  } catch {}
}

function pushToSupabase(plan: WaitlistPlan, email: string): void {
  if (typeof window === "undefined") return;
  // Fire-and-forget. We deliberately don't await — UI feedback is driven
  // by the localStorage save. Network failures are silent.
  fetch(`${SUPA_URL}/rest/v1/waitlist`, {
    method: "POST",
    headers: {
      apikey: SUPA_ANON_KEY,
      Authorization: `Bearer ${SUPA_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates",
    },
    body: JSON.stringify({
      email,
      plan,
      discount: DISCOUNT_LABEL[plan],
      signed_up_at: new Date().toISOString(),
    }),
  }).catch(() => {
    /* silent — best-effort */
  });
}

// Returns true if the email was accepted (valid + saved locally).
// The Supabase write happens in the background regardless.
export function submitWaitlist(plan: WaitlistPlan, rawEmail: string): boolean {
  const email = rawEmail.trim().toLowerCase();
  if (!isValidEmail(email)) return false;
  saveLocally(plan, email);
  pushToSupabase(plan, email);
  return true;
}
