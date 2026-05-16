"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { useUserPlan, type Plan } from "@/lib/plan";
import { submitWaitlist, type WaitlistPlan } from "@/lib/waitlist";

type FeatureItem = { kind: "ok" | "no" | "soon"; label: string; description?: string };

const FREE_FEATURES: FeatureItem[] = [
  { kind: "ok", label: "Journal (50 trades)" },
  { kind: "ok", label: "Challenge tracker (1 account)" },
  { kind: "ok", label: "Pre-trade checklist" },
  { kind: "ok", label: "Basic stats" },
  { kind: "ok", label: "Screenshot import (1/day)" },
  { kind: "ok", label: "Trade Review (3 trades)" },
  { kind: "no", label: "AI features (upgrade required)" },
];

const PRO_FEATURES: FeatureItem[] = [
  { kind: "ok", label: "Everything in Free, unlimited" },
  { kind: "ok", label: "Psychology tracker" },
  { kind: "ok", label: "Best setup finder" },
  { kind: "ok", label: "Full trade review" },
  { kind: "ok", label: "Daily notes" },
  { kind: "ok", label: "All alerts" },
  { kind: "ok", label: "Advanced insights" },
  { kind: "ok", label: "AI strategy builder (10/day)" },
  { kind: "ok", label: "Screenshot import (20/day)" },
  { kind: "ok", label: "3 challenge accounts" },
  { kind: "ok", label: "CSV export" },
];

const ELITE_FEATURES: FeatureItem[] = [
  { kind: "ok", label: "Everything in Pro, unlimited" },
  { kind: "ok", label: "Unlimited AI strategy generations" },
  { kind: "ok", label: "Unlimited screenshot imports" },
  { kind: "ok", label: "Unlimited challenge accounts" },
  { kind: "ok", label: "Priority support" },
  {
    kind: "soon",
    label: "Strategy Code Export",
    description: "Export your strategy as Pine Script, NinjaScript, or Python. Ready to paste into TradingView or NinjaTrader.",
  },
  {
    kind: "soon",
    label: "Weekly PDF Report",
    description: "Auto-generated performance report every Monday. Win rate, psychology score, top mistakes, and key insights delivered to your inbox.",
  },
  {
    kind: "soon",
    label: "Mentor/Coach Access",
    description: "Share a read-only link of your journal with your trading coach. They see your trades, stats, and psychology patterns.",
  },
  {
    kind: "soon",
    label: "Multi-Account Dashboard",
    description: "See all your funded accounts side by side. Apex + TopstepX + FTMO on one screen.",
  },
  {
    kind: "soon",
    label: "Daily Loss Alerts",
    description: "Get a push notification before you breach your daily limit. Save your funded account automatically.",
  },
  {
    kind: "soon",
    label: "AI Trade Analysis",
    description: "Upload your trade screenshot and get instant AI feedback on your entry quality, timing, and risk management.",
  },
  {
    kind: "soon",
    label: "Broker CSV Auto-Detection",
    description: "Drop any broker CSV and we detect the format automatically. Apex, Rithmic, NinjaTrader, TradingView — all supported.",
  },
];

const IS_EMAIL = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function FeatureRow({ item }: { item: FeatureItem }) {
  const colors = {
    ok:   { glyph: "✓", color: "#e5e7eb", icon: "#10b981" },
    no:   { glyph: "✗", color: "#6b7280", icon: "#4b5563" },
    soon: { glyph: "→", color: "#d1d5db", icon: "#6366f1" },
  };
  const c = colors[item.kind];
  return (
    <li style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: c.color, lineHeight: 1.45 }}>
      <span style={{ color: c.icon, fontWeight: 800, marginTop: 1, flexShrink: 0, width: 12 }}>{c.glyph}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontWeight: item.description ? 600 : 400, color: item.description ? "#f3f4f6" : c.color }}>{item.label}</span>
        {item.description && (
          <span style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>{item.description}</span>
        )}
      </div>
    </li>
  );
}

function CurrentBadge() {
  return (
    <div
      style={{
        position: "absolute",
        top: 14,
        right: 14,
        fontSize: 9,
        fontWeight: 700,
        padding: "3px 8px",
        borderRadius: 999,
        background: "rgba(99,102,241,0.12)",
        border: "1px solid rgba(99,102,241,0.35)",
        color: "#6366f1",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      Current
    </div>
  );
}

function PopularBadge() {
  return (
    <div
      style={{
        position: "absolute",
        top: -10,
        left: "50%",
        transform: "translateX(-50%)",
        fontSize: 9,
        fontWeight: 800,
        padding: "4px 10px",
        borderRadius: 999,
        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
        color: "#fff",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        boxShadow: "0 4px 16px rgba(99,102,241,0.4)",
        whiteSpace: "nowrap",
      }}
    >
      Most Popular
    </div>
  );
}

function MostValueBadge() {
  return (
    <div
      style={{
        position: "absolute",
        top: -10,
        left: "50%",
        transform: "translateX(-50%)",
        fontSize: 9,
        fontWeight: 800,
        padding: "4px 10px",
        borderRadius: 999,
        background: "linear-gradient(135deg, #f59e0b, #d97706)",
        color: "#1a1a0f",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        boxShadow: "0 4px 16px rgba(245,158,11,0.45)",
        whiteSpace: "nowrap",
      }}
    >
      Most Value
    </div>
  );
}

function ComingSoonBadge() {
  return (
    <div
      style={{
        position: "absolute",
        top: 14,
        right: 14,
        fontSize: 9,
        fontWeight: 700,
        padding: "3px 8px",
        borderRadius: 999,
        background: "rgba(245,158,11,0.12)",
        border: "1px solid rgba(245,158,11,0.3)",
        color: "#f59e0b",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      Coming soon
    </div>
  );
}

const STORAGE_KEY_FOR: Record<WaitlistPlan, string> = {
  pro:   "nexyru_waitlist_pro",
  elite: "nexyru_waitlist_elite",
};

function WaitlistForm({ plan }: { plan: WaitlistPlan }) {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const storageKey = STORAGE_KEY_FOR[plan];

  useEffect(() => {
    try {
      const list: string[] = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (list.length) setJoined(true);
    } catch {}
  }, [storageKey]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!IS_EMAIL(email)) {
      setError("Enter a valid email");
      return;
    }
    if (!submitWaitlist(plan, email)) {
      setError("Enter a valid email");
      return;
    }
    setJoined(true);
    setEmail("");
  };

  if (joined) {
    return (
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          background: "rgba(34,197,94,0.08)",
          border: "1px solid rgba(34,197,94,0.25)",
          color: "#22c55e",
          fontSize: 12,
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        You're on the list! We'll email when it's live.
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email for waitlist"
          style={{
            flex: 1,
            minWidth: 0,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #2a2a3a",
            background: "#0a0a0f",
            color: "#fff",
            fontSize: 12,
            outline: "none",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "none",
            background: "#6366f1",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Join
        </button>
      </div>
      {error && <div style={{ fontSize: 11, color: "#ef4444" }}>{error}</div>}
    </form>
  );
}

type PricingCardProps = {
  tier: Plan;
  title: string;
  subtitle?: string;
  price: string;
  cadence: string;
  features: FeatureItem[];
  cta: React.ReactNode;
  current: boolean;
  badge?: "popular" | "value" | null;
  comingSoon?: boolean;
  borderColor: string;
  glow?: string;
  urgencyNote?: string;
};

function PricingCard({ tier, title, subtitle, price, cadence, features, cta, current, badge, comingSoon, borderColor, glow, urgencyNote }: PricingCardProps) {
  const isElite = tier === "elite";
  const titleColor = isElite ? "#f59e0b" : tier === "pro" ? "#a5b4fc" : "#9ca3af";

  return (
    <div
      style={{
        background: isElite
          ? "linear-gradient(180deg, rgba(245,158,11,0.06) 0%, rgba(245,158,11,0.015) 35%, #0f0f17 100%)"
          : "linear-gradient(180deg, rgba(255,255,255,0.02), #0f0f17)",
        border: `1px solid ${borderColor}`,
        borderRadius: 16,
        padding: 28,
        position: "relative",
        boxShadow: glow ?? "none",
        display: "flex",
        flexDirection: "column",
        opacity: comingSoon && !current && !badge ? 0.92 : 1,
        overflow: "hidden",
      }}
    >
      {isElite && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 110,
            background: "radial-gradient(ellipse at top, rgba(245,158,11,0.18), transparent 70%)",
            pointerEvents: "none",
          }}
        />
      )}

      {badge === "popular" && <PopularBadge />}
      {badge === "value" && <MostValueBadge />}
      {current && <CurrentBadge />}
      {comingSoon && !current && !badge && <ComingSoonBadge />}

      <div style={{ position: "relative" }}>
        <div
          style={{
            fontSize: 12,
            color: titleColor,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontWeight: 800,
            marginBottom: subtitle ? 4 : 8,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 14, lineHeight: 1.5 }}>
            {subtitle}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 20 }}>
          <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff" }}>{price}</span>
          <span style={{ fontSize: 13, color: "#6b7280" }}>{cadence}</span>
        </div>

        <div style={{ marginBottom: 18 }}>{cta}</div>

        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {features.map((f) => (
            <FeatureRow key={f.label} item={f} />
          ))}
        </ul>

        {urgencyNote && (
          <div
            style={{
              marginTop: 18,
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.3)",
              fontSize: 11,
              color: "#fcd34d",
              fontWeight: 600,
              lineHeight: 1.5,
              textAlign: "center",
            }}
          >
            {urgencyNote}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PricingPage() {
  const plan = useUserPlan();

  const freeCta = (
    <a
      href="/login"
      style={{
        display: "block",
        textAlign: "center",
        padding: "11px 16px",
        borderRadius: 10,
        border: "1px solid #2a2a3a",
        background: "transparent",
        color: "#fff",
        fontSize: 13,
        fontWeight: 700,
        textDecoration: "none",
      }}
    >
      Get started free
    </a>
  );

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <Sidebar activePath="/pricing" />
      <MobileNav />

      <main
        className="main-with-sidebar"
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "56px 24px 96px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", margin: 0, color: "#fff" }}>
            Simple, fair pricing
          </h1>
          <p style={{ fontSize: 14, color: "#9ca3af", marginTop: 8 }}>
            Start free. Upgrade when you outgrow the limits.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18,
            alignItems: "stretch",
          }}
        >
          <PricingCard
            tier="free"
            title="Free"
            price="$0"
            cadence="/forever"
            features={FREE_FEATURES}
            cta={freeCta}
            current={plan === "free"}
            borderColor={plan === "free" ? "rgba(255,255,255,0.5)" : "#2a2a3a"}
          />

          <PricingCard
            tier="pro"
            title="Pro"
            price="$19"
            cadence="/month"
            features={PRO_FEATURES}
            cta={<WaitlistForm plan="pro" />}
            current={plan === "pro"}
            badge="popular"
            comingSoon={plan !== "pro"}
            borderColor="rgba(99,102,241,0.55)"
            glow="0 10px 40px rgba(99,102,241,0.12)"
          />

          <PricingCard
            tier="elite"
            title="Elite"
            subtitle="For serious funded traders who want every edge"
            price="$39"
            cadence="/month"
            features={ELITE_FEATURES}
            cta={<WaitlistForm plan="elite" />}
            current={plan === "elite"}
            badge="value"
            comingSoon={plan !== "elite"}
            borderColor="rgba(245,158,11,0.4)"
            glow="0 10px 40px rgba(245,158,11,0.15)"
            urgencyNote="Early waitlist members lock in $29/mo when Pro launches — $10 savings forever."
          />
        </div>

        <p style={{ textAlign: "center", marginTop: 36, fontSize: 12, color: "#4b5563" }}>
          Questions? <a href="/contact" style={{ color: "#6366f1", textDecoration: "none" }}>Get in touch</a>
        </p>
      </main>
    </div>
  );
}
