"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const COLORS = {
  bg: "#080808",
  surface: "#111111",
  surface2: "#161616",
  border: "#222222",
  borderSoft: "#1a1a1a",
  borderMid: "#1e1e1e",
  borderHover: "#333333",
  text: "#ffffff",
  textDim: "#888888",
  textMuted: "#666666",
  textFaint: "#444444",
  accent: "#6366f1",
  accentDim: "rgba(99,102,241,0.12)",
  green: "#22c55e",
  greenDim: "rgba(34,197,94,0.12)",
  red: "#ef4444",
  amber: "#f59e0b",
  amberDim: "rgba(245,158,11,0.12)",
};

const PROP_FIRMS = [
  "Apex Trader Funding",
  "TopstepX",
  "FTMO",
  "MyFundedFutures",
  "Bulenox",
  "Tradeday",
];

const HERO_FIRM_TAGS = ["Apex", "TopstepX", "FTMO", "MyFundedFutures", "Bulenox"];

const FEATURES: {
  dot: string;
  title: string;
  desc: string;
  cta?: { label: string; href: string };
}[] = [
  {
    dot: COLORS.accent,
    title: "Challenge Tracker",
    desc: "Track your daily loss limit, max drawdown, and profit target in real time. Accurate 2026 rules for Apex, TopstepX, FTMO, and more.",
    cta: { label: "Set up Challenge Tracker →", href: "/challenge" },
  },
  {
    dot: "#a855f7",
    title: "Psychology Tracker",
    desc: "See exactly which emotions and mistakes are costing you money. Tag every trade with your mental state and watch the patterns emerge.",
    cta: { label: "Set up Psychology Tracker →", href: "/psychology" },
  },
  {
    dot: COLORS.green,
    title: "Trade Review",
    desc: "Review every trade against a real chart. See your entry and exit on actual candles. Learn the way pro athletes watch film.",
  },
  {
    dot: "#f59e0b",
    title: "Best Setup Finder",
    desc: "Automatically analyzes all your trades and surfaces your highest win-rate setups, best hours, and most profitable instruments.",
  },
  {
    dot: "#ec4899",
    title: "Pre-Trade Checklist",
    desc: "A quick mental checklist before every trade. Track which items you skip — and exactly how much it costs you.",
    cta: { label: "Open Checklist →", href: "/checklist" },
  },
  {
    dot: "#06b6d4",
    title: "Alerts",
    desc: "Get notified when your trading conditions are met — daily loss limits, session start, price levels, max trades, and profit targets.",
    cta: { label: "Open Alerts →", href: "/alerts" },
  },
];

const STEPS = [
  {
    n: "01",
    title: "Import your trades",
    desc: "Upload a CSV from your prop firm. Takes under a minute.",
  },
  {
    n: "02",
    title: "Configure your challenge",
    desc: "Select your firm and account size. Rules fill automatically.",
  },
  {
    n: "03",
    title: "Trade with clarity",
    desc: "Your data tells you exactly what works and what doesn't.",
  },
];

type Feature = { kind: "ok" | "no" | "soon"; label: string };

const FREE_FEATURES: Feature[] = [
  { kind: "ok", label: "Journal — 50 trades" },
  { kind: "ok", label: "Challenge tracker — 1 account" },
  { kind: "ok", label: "Pre-trade checklist" },
  { kind: "ok", label: "Basic stats" },
  { kind: "ok", label: "Screenshot import — 1/day" },
  { kind: "ok", label: "Trade Review — 3 trades" },
  { kind: "no", label: "AI features (upgrade required)" },
];

const PRO_FEATURES: Feature[] = [
  { kind: "ok", label: "Everything in Free, unlimited" },
  { kind: "ok", label: "Psychology tracker" },
  { kind: "ok", label: "Best setup finder" },
  { kind: "ok", label: "Full trade review history" },
  { kind: "ok", label: "Daily notes" },
  { kind: "ok", label: "All alerts" },
  { kind: "ok", label: "Advanced insights & charts" },
  { kind: "ok", label: "AI strategy builder — 10/day" },
  { kind: "ok", label: "Screenshot import — 20/day" },
  { kind: "ok", label: "3 challenge accounts" },
  { kind: "ok", label: "CSV export" },
];

const ELITE_FEATURES: Feature[] = [
  { kind: "ok",   label: "Everything in Pro, unlimited" },
  { kind: "ok",   label: "Unlimited AI strategy generations" },
  { kind: "ok",   label: "Unlimited screenshot imports" },
  { kind: "ok",   label: "Unlimited challenge accounts" },
  { kind: "ok",   label: "Priority support" },
  { kind: "soon", label: "Strategy Code Export — Pine Script, NinjaScript & Python" },
  { kind: "soon", label: "Weekly PDF Performance Report" },
  { kind: "soon", label: "Mentor/Coach read-only journal sharing" },
  { kind: "soon", label: "Multi-Account Dashboard" },
  { kind: "soon", label: "Daily Loss Push Notifications" },
  { kind: "soon", label: "AI Trade Screenshot Analysis" },
  { kind: "soon", label: "Broker CSV Auto-Detection" },
];

// ─── Pricing card for the landing page ────────────────────────────
type LPBadge = { label: string; color: string; bg?: string; border?: string; gradient?: string; shadow?: string };

type PricingCardLPProps = {
  tier: "free" | "pro" | "elite";
  price: string;
  cadence: string;
  priceCaption?: { text: string; color: string };
  cornerBadge?: LPBadge;
  topBadge?: LPBadge;
  features: Feature[];
  cta: React.ReactNode;
  footerNote?: { text: string; color: string; bg: string; border: string };
  borderColor: string;
  background: string;
  boxShadow?: string;
};

function FeatureRowLP({ item }: { item: Feature }) {
  const palette = {
    ok:   { glyph: "✓", color: COLORS.text,    icon: COLORS.green },
    no:   { glyph: "✗", color: COLORS.textMuted, icon: COLORS.textFaint },
    soon: { glyph: "→", color: "#d1d5db",      icon: COLORS.amber },
  };
  const p = palette[item.kind];
  return (
    <li style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: p.color, lineHeight: 1.5, marginBottom: 12 }}>
      <span style={{ color: p.icon, fontWeight: 800, marginTop: 1, flexShrink: 0, width: 12 }}>{p.glyph}</span>
      <span>{item.label}</span>
    </li>
  );
}

function PricingCardLP({ price, cadence, priceCaption, cornerBadge, topBadge, features, cta, footerNote, borderColor, background, boxShadow }: PricingCardLPProps) {
  return (
    <div
      style={{
        background,
        border: `1px solid ${borderColor}`,
        borderRadius: 16,
        padding: 32,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        boxShadow: boxShadow ?? "none",
      }}
    >
      {topBadge && (
        <div
          style={{
            position: "absolute",
            top: -10,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 9,
            fontWeight: 800,
            padding: "4px 12px",
            borderRadius: 999,
            background: topBadge.gradient ?? topBadge.bg ?? "transparent",
            color: topBadge.color,
            letterSpacing: "0.08em",
            boxShadow: topBadge.shadow ?? "none",
            whiteSpace: "nowrap",
          }}
        >
          {topBadge.label}
        </div>
      )}

      {cornerBadge && (
        <span
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            fontSize: 10,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 999,
            background: cornerBadge.bg ?? "transparent",
            color: cornerBadge.color,
            border: cornerBadge.border ? `1px solid ${cornerBadge.border}` : "none",
            letterSpacing: "0.06em",
          }}
        >
          {cornerBadge.label}
        </span>
      )}

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 40, fontWeight: 800, color: COLORS.text, letterSpacing: "-0.02em" }}>{price}</span>
          <span style={{ color: COLORS.textMuted, fontSize: 15 }}>{cadence}</span>
        </div>
        {priceCaption && (
          <div style={{ marginTop: 6, fontSize: 12, color: priceCaption.color, fontWeight: 600 }}>
            {priceCaption.text}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 24 }}>{cta}</div>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, flex: 1 }}>
        {features.map((f) => (
          <FeatureRowLP key={f.label} item={f} />
        ))}
      </ul>

      {footerNote && (
        <div
          style={{
            marginTop: 18,
            padding: "10px 12px",
            borderRadius: 10,
            background: footerNote.bg,
            border: `1px solid ${footerNote.border}`,
            fontSize: 12,
            color: footerNote.color,
            fontWeight: 600,
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          {footerNote.text}
        </div>
      )}
    </div>
  );
}

const TRADES = [
  { sym: "NQ1!", dir: "LONG", pnl: 312.5, grade: "A" },
  { sym: "ES1!", dir: "SHORT", pnl: 187.5, grade: "B+" },
  { sym: "CL1!", dir: "LONG", pnl: -95.0, grade: "C" },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [proEmail, setProEmail] = useState("");
  const [proJoined, setProJoined] = useState(false);
  const [eliteEmail, setEliteEmail] = useState("");
  const [eliteJoined, setEliteJoined] = useState(false);

  useEffect(() => {
    try {
      const pro = JSON.parse(localStorage.getItem("nexyru_waitlist_pro") || "[]");
      if (Array.isArray(pro) && pro.length) setProJoined(true);
      const elite = JSON.parse(localStorage.getItem("nexyru_waitlist_elite") || "[]");
      if (Array.isArray(elite) && elite.length) setEliteJoined(true);
    } catch {}
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function saveWaitlist(storageKey: string, email: string): boolean {
    const value = email.trim().toLowerCase();
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
    try {
      const raw = localStorage.getItem(storageKey);
      const list: string[] = raw ? JSON.parse(raw) : [];
      if (!list.includes(value)) list.push(value);
      localStorage.setItem(storageKey, JSON.stringify(list));
    } catch {}
    return true;
  }

  function joinPro(e: React.FormEvent) {
    e.preventDefault();
    if (!saveWaitlist("nexyru_waitlist_pro", proEmail)) return;
    setProJoined(true);
    setProEmail("");
  }

  function joinElite(e: React.FormEvent) {
    e.preventDefault();
    if (!saveWaitlist("nexyru_waitlist_elite", eliteEmail)) return;
    setEliteJoined(true);
    setEliteEmail("");
  }

  return (
    <div
      style={{
        background: COLORS.bg,
        color: COLORS.text,
        scrollBehavior: "smooth",
        minHeight: "100vh",
      }}
    >
      {/* ─── NAV ───────────────────────────────────────────────────── */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(8,8,8,0.8)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: scrolled
            ? `1px solid ${COLORS.borderSoft}`
            : "1px solid transparent",
          transition: "border-color 200ms ease",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: `linear-gradient(135deg, ${COLORS.accent}, #4f46e5)`,
              }}
            />
            <span
              style={{
                color: COLORS.text,
                fontWeight: 600,
                fontSize: 15,
                letterSpacing: "-0.01em",
              }}
            >
              Nexyru
            </span>
          </Link>

          <div className="nx-nav-links" style={{ display: "flex", gap: 28 }}>
            <a href="#features" style={navLink}>
              Features
            </a>
            <a href="#pricing" style={navLink}>
              Pricing
            </a>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link
              href="/login"
              className="nx-ghost-link"
              style={{
                color: COLORS.textDim,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
                padding: "8px 12px",
                transition: "color 150ms ease",
              }}
            >
              Sign in
            </Link>
            <Link
              href="/login"
              style={{
                background: COLORS.accent,
                color: "#fff",
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
                padding: "8px 14px",
                borderRadius: 8,
                transition: "background 150ms ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#4f46e5")}
              onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.accent)}
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── HERO ──────────────────────────────────────────────────── */}
      <section
        style={{
          padding: "100px 24px 80px",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <div className="nx-hero-grid">
          {/* LEFT */}
          <div>
            <div
              style={{
                color: COLORS.textDim,
                fontSize: 13,
                marginBottom: 24,
                fontWeight: 500,
              }}
            >
              Free to start · No credit card
            </div>

            <h1
              style={{
                fontSize: "clamp(36px, 5.5vw, 56px)",
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: "-0.025em",
                color: COLORS.text,
                margin: 0,
                marginBottom: 24,
              }}
            >
              The trading journal that keeps your funded account alive.
            </h1>

            <p
              style={{
                fontSize: 18,
                color: COLORS.textDim,
                lineHeight: 1.55,
                margin: 0,
                marginBottom: 32,
                maxWidth: 520,
              }}
            >
              Built specifically for prop firm traders. Track your daily loss
              limits, understand your psychology, and find your edge — all in
              one place.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 36 }}>
              <Link
                href="/login"
                style={{
                  background: COLORS.accent,
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 500,
                  textDecoration: "none",
                  padding: "12px 22px",
                  borderRadius: 10,
                  transition: "background 150ms ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#4f46e5")}
                onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.accent)}
              >
                Start for free
              </Link>
              <a
                href="#features"
                style={{
                  background: "transparent",
                  color: COLORS.text,
                  fontSize: 15,
                  fontWeight: 500,
                  textDecoration: "none",
                  padding: "12px 22px",
                  borderRadius: 10,
                  border: `1px solid ${COLORS.textFaint}`,
                  transition: "border-color 150ms ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = COLORS.textDim)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = COLORS.textFaint)
                }
              >
                See how it works
              </a>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {HERO_FIRM_TAGS.map((firm) => (
                <span
                  key={firm}
                  style={{
                    background: COLORS.borderSoft,
                    border: `1px solid #2a2a2a`,
                    color: COLORS.textMuted,
                    fontSize: 12,
                    padding: "5px 12px",
                    borderRadius: 999,
                    fontWeight: 500,
                  }}
                >
                  {firm}
                </span>
              ))}
            </div>
          </div>

          {/* RIGHT — app mockup */}
          <div>
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ─── SOCIAL PROOF BAR ──────────────────────────────────────── */}
      <section
        style={{
          background: COLORS.surface,
          borderTop: `1px solid ${COLORS.borderMid}`,
          borderBottom: `1px solid ${COLORS.borderMid}`,
          padding: "32px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <span
            style={{
              color: COLORS.textDim,
              fontSize: 13,
              fontWeight: 500,
              marginRight: 8,
            }}
          >
            Works with every major prop firm
          </span>
          {PROP_FIRMS.map((firm) => (
            <span
              key={firm}
              style={{
                background: COLORS.borderSoft,
                border: `1px solid ${COLORS.textFaint}`,
                color: COLORS.textDim,
                fontSize: 12,
                padding: "5px 12px",
                borderRadius: 999,
                fontWeight: 500,
              }}
            >
              {firm}
            </span>
          ))}
        </div>
      </section>

      {/* ─── PROBLEM ───────────────────────────────────────────────── */}
      <section style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <div className="nx-label" style={sectionLabel}>
            THE PROBLEM
          </div>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
              color: COLORS.text,
              margin: "16px 0 20px",
            }}
          >
            80% of funded accounts fail within 90 days.
          </h2>
          <p
            style={{
              fontSize: 17,
              color: COLORS.textDim,
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Not because traders can&apos;t trade. Because they have no system. No
            way to track their rules, understand their mistakes, or see their
            patterns. Nexyru fixes that.
          </p>
        </div>

        <div
          style={{
            maxWidth: 900,
            margin: "60px auto 0",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 24,
          }}
        >
          {[
            { stat: "80%", label: "of funded accounts fail in 90 days" },
            { stat: "#1 reason", label: "breaking daily loss limits" },
            { stat: "Most traders", label: "never track their psychology" },
          ].map((s) => (
            <div key={s.stat} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: COLORS.text,
                  letterSpacing: "-0.02em",
                  marginBottom: 8,
                }}
              >
                {s.stat}
              </div>
              <div style={{ color: COLORS.textMuted, fontSize: 14, lineHeight: 1.5 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ──────────────────────────────────────────────── */}
      <section id="features" style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div className="nx-label" style={sectionLabel}>
              FEATURES
            </div>
            <h2
              style={{
                fontSize: "clamp(28px, 4vw, 40px)",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: COLORS.text,
                margin: "16px 0 0",
              }}
            >
              Everything a funded trader needs.
            </h2>
          </div>

          <div className="nx-feature-grid">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} f={f} />
            ))}
          </div>

          {/* SPOTLIGHT — Challenge Tracker */}
          <div
            style={{
              marginTop: 80,
              background: COLORS.surface,
              border: `1px solid ${COLORS.borderMid}`,
              borderRadius: 16,
              padding: 48,
              overflow: "hidden",
            }}
            className="nx-spotlight"
          >
            <div className="nx-spotlight-grid">
              <div>
                <div className="nx-label" style={{ ...sectionLabel, textAlign: "left" }}>
                  FEATURE SPOTLIGHT
                </div>
                <h3
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: COLORS.text,
                    letterSpacing: "-0.02em",
                    margin: "12px 0 16px",
                    lineHeight: 1.2,
                  }}
                >
                  Know exactly where you stand on every rule, every day.
                </h3>
                <p
                  style={{
                    color: COLORS.textDim,
                    fontSize: 16,
                    lineHeight: 1.6,
                    margin: "0 0 20px",
                  }}
                >
                  The Challenge Tracker shows your live progress against every
                  rule your prop firm enforces. Daily loss limits, trailing
                  drawdown, profit targets — all updated in real time as you
                  trade.
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {[
                    "Accurate 2026 rules for every major prop firm",
                    "Trailing drawdown calculated to the cent",
                    "Warning alerts before you break a rule",
                  ].map((item) => (
                    <li
                      key={item}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        color: COLORS.textDim,
                        fontSize: 14,
                        lineHeight: 1.6,
                        marginBottom: 8,
                      }}
                    >
                      <span style={{ color: COLORS.green, marginTop: 1 }}>✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <ChallengeTrackerMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ──────────────────────────────────────────── */}
      <section style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div className="nx-label" style={sectionLabel}>
              HOW IT WORKS
            </div>
            <h2
              style={{
                fontSize: "clamp(28px, 4vw, 40px)",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: COLORS.text,
                margin: "16px 0 0",
              }}
            >
              From CSV to clarity in three steps.
            </h2>
          </div>

          <div className="nx-steps">
            {STEPS.map((s, i) => (
              <div key={s.n} className="nx-step">
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: COLORS.accent,
                    letterSpacing: "0.04em",
                    marginBottom: 12,
                  }}
                >
                  STEP {s.n}
                </div>
                <h3
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: COLORS.text,
                    margin: "0 0 8px",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {s.title}
                </h3>
                <p
                  style={{
                    color: COLORS.textMuted,
                    fontSize: 14,
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {s.desc}
                </p>
                {i < STEPS.length - 1 && (
                  <div className="nx-step-line" aria-hidden />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ─── PRICING ───────────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 11, color: COLORS.accent, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12, fontWeight: 700 }}>
              PRICING
            </div>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-0.02em", color: COLORS.text, margin: "0 0 12px" }}>
              Simple, fair pricing.
            </h2>
            <p style={{ color: COLORS.textDim, fontSize: 16, margin: 0 }}>
              Start free. Upgrade when you&apos;re ready.
            </p>
          </div>

          <div className="nx-pricing-grid">
            {/* ── FREE ─────────────────────────── */}
            <PricingCardLP
              tier="free"
              price="$0"
              cadence="/forever"
              cornerBadge={{ label: "FREE", color: COLORS.textDim, bg: "rgba(255,255,255,0.04)", border: COLORS.border }}
              features={FREE_FEATURES}
              cta={
                <Link
                  href="/login"
                  style={{
                    display: "block",
                    textAlign: "center",
                    background: "transparent",
                    color: COLORS.accent,
                    border: `1px solid ${COLORS.accent}`,
                    borderRadius: 10,
                    padding: "12px 18px",
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Get started free
                </Link>
              }
              borderColor={COLORS.border}
              background={COLORS.surface}
            />

            {/* ── PRO ──────────────────────────── */}
            <PricingCardLP
              tier="pro"
              price="$19"
              cadence="/month"
              priceCaption={{ text: "Coming soon — join the waitlist", color: COLORS.textDim }}
              topBadge={{ label: "MOST POPULAR", color: "#fff", gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)", shadow: "0 4px 16px rgba(99,102,241,0.4)" }}
              features={PRO_FEATURES}
              cta={
                proJoined ? (
                  <div
                    style={{
                      textAlign: "center",
                      color: COLORS.green,
                      fontSize: 14,
                      fontWeight: 600,
                      padding: "12px 16px",
                      background: COLORS.greenDim,
                      border: `1px solid rgba(34,197,94,0.3)`,
                      borderRadius: 10,
                    }}
                  >
                    You&apos;re on the list! 🎉
                  </div>
                ) : (
                  <form onSubmit={joinPro} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      type="email"
                      value={proEmail}
                      onChange={(e) => setProEmail(e.target.value)}
                      placeholder="you@email.com"
                      required
                      aria-label="Pro waitlist email"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        background: COLORS.bg,
                        border: `1px solid ${COLORS.border}`,
                        color: COLORS.text,
                        fontSize: 14,
                        padding: "10px 12px",
                        borderRadius: 8,
                        outline: "none",
                      }}
                    />
                    <button
                      type="submit"
                      style={{
                        background: COLORS.accent,
                        color: "#fff",
                        fontSize: 14,
                        fontWeight: 600,
                        padding: "10px 18px",
                        borderRadius: 8,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Join
                    </button>
                  </form>
                )
              }
              borderColor="rgba(99,102,241,0.5)"
              background={COLORS.surface}
              boxShadow="0 0 30px rgba(99,102,241,0.1)"
            />

            {/* ── ELITE ────────────────────────── */}
            <PricingCardLP
              tier="elite"
              price="$39"
              cadence="/month"
              priceCaption={{ text: "Early waitlist → lock in $29/mo forever", color: COLORS.amber }}
              topBadge={{ label: "MOST VALUE", color: "#1a1a0f", gradient: "linear-gradient(135deg, #f59e0b, #d97706)", shadow: "0 4px 16px rgba(245,158,11,0.45)" }}
              features={ELITE_FEATURES}
              cta={
                eliteJoined ? (
                  <div
                    style={{
                      textAlign: "center",
                      color: COLORS.amber,
                      fontSize: 14,
                      fontWeight: 600,
                      padding: "12px 16px",
                      background: COLORS.amberDim,
                      border: `1px solid rgba(245,158,11,0.3)`,
                      borderRadius: 10,
                    }}
                  >
                    You&apos;re on the list! 🎉
                  </div>
                ) : (
                  <form onSubmit={joinElite} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      type="email"
                      value={eliteEmail}
                      onChange={(e) => setEliteEmail(e.target.value)}
                      placeholder="you@email.com"
                      required
                      aria-label="Elite waitlist email"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        background: COLORS.bg,
                        border: `1px solid ${COLORS.border}`,
                        color: COLORS.text,
                        fontSize: 14,
                        padding: "10px 12px",
                        borderRadius: 8,
                        outline: "none",
                      }}
                    />
                    <button
                      type="submit"
                      style={{
                        background: COLORS.amber,
                        color: "#1a1a0f",
                        fontSize: 14,
                        fontWeight: 700,
                        padding: "10px 18px",
                        borderRadius: 8,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Join Elite
                    </button>
                  </form>
                )
              }
              footerNote={{
                text: "Join now — early members lock in $29/mo when we launch",
                color: COLORS.amber,
                bg: COLORS.amberDim,
                border: "rgba(245,158,11,0.3)",
              }}
              borderColor="rgba(245,158,11,0.4)"
              background="linear-gradient(135deg, #111111, #0f0e08)"
              boxShadow="0 0 30px rgba(245,158,11,0.08)"
            />
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─────────────────────────────────────────────── */}
      <section style={{ padding: "100px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: "clamp(32px, 5vw, 48px)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              color: COLORS.text,
              margin: "0 0 16px",
              lineHeight: 1.1,
            }}
          >
            Ready to stop guessing?
          </h2>
          <p
            style={{
              fontSize: 17,
              color: COLORS.textDim,
              lineHeight: 1.55,
              margin: "0 0 32px",
            }}
          >
            Start tracking your trades today. Free, no card required.
          </p>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              background: COLORS.accent,
              color: "#fff",
              fontSize: 16,
              fontWeight: 500,
              textDecoration: "none",
              padding: "14px 28px",
              borderRadius: 12,
              transition: "background 150ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#4f46e5")}
            onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.accent)}
          >
            Get started free
          </Link>
          <div
            style={{
              marginTop: 20,
              color: COLORS.textDim,
              fontSize: 13,
            }}
          >
            Takes 2 minutes to import your first trades
          </div>
        </div>
      </section>

      {/* ─── FOOTER ────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: `1px solid ${COLORS.borderMid}`,
          padding: "48px 24px 32px",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
          }}
        >
          <div
            className="nx-footer-row"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 24,
              marginBottom: 32,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Link
                href="/"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  textDecoration: "none",
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: `linear-gradient(135deg, ${COLORS.accent}, #4f46e5)`,
                  }}
                />
                <span
                  style={{
                    color: COLORS.text,
                    fontWeight: 600,
                    fontSize: 15,
                  }}
                >
                  Nexyru
                </span>
              </Link>
              <span style={{ color: COLORS.textMuted, fontSize: 13 }}>
                The trading journal for funded traders
              </span>
            </div>

            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <Link href="/privacy" style={footerLink}>
                Privacy
              </Link>
              <Link href="/terms" style={footerLink}>
                Terms
              </Link>
              <Link href="/contact" style={footerLink}>
                Contact
              </Link>
            </div>
          </div>

          <div
            style={{
              borderTop: `1px solid ${COLORS.borderSoft}`,
              paddingTop: 24,
              color: COLORS.textMuted,
              fontSize: 13,
            }}
          >
            © 2026 Nexyru
          </div>
        </div>
      </footer>

      {/* ─── PAGE-SCOPED CSS ───────────────────────────────────────── */}
      <style jsx>{`
        :global(.nx-ghost-link:hover) {
          color: #fff !important;
        }
        :global(.nx-feature-cta:hover) {
          text-decoration: underline !important;
        }
        :global(a[style*="color: rgb(136, 136, 136)"]:hover) {
          color: #fff;
        }
        .nx-hero-grid {
          display: grid;
          grid-template-columns: 55% 45%;
          gap: 56px;
          align-items: center;
        }
        .nx-feature-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .nx-spotlight-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: center;
        }
        .nx-steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
          position: relative;
        }
        .nx-step {
          position: relative;
          padding-right: 24px;
        }
        .nx-step-line {
          position: absolute;
          right: -16px;
          top: 38px;
          width: 32px;
          height: 1px;
          background: linear-gradient(
            to right,
            ${COLORS.border},
            transparent
          );
        }
        .nx-pricing-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 24px;
          align-items: stretch;
        }
        @media (max-width: 880px) {
          .nx-hero-grid {
            grid-template-columns: 1fr;
            gap: 48px;
          }
          .nx-feature-grid {
            grid-template-columns: 1fr;
          }
          .nx-spotlight-grid {
            grid-template-columns: 1fr;
            gap: 32px;
          }
          .nx-steps {
            grid-template-columns: 1fr;
            gap: 32px;
          }
          .nx-step-line {
            display: none;
          }
          .nx-pricing-grid {
            grid-template-columns: 1fr;
          }
          .nx-spotlight {
            padding: 32px 24px !important;
          }
          .nx-footer-row {
            flex-direction: column;
          }
          .nx-nav-links {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ─── helpers ─────────────────────────────────────────────────── */

const navLink: React.CSSProperties = {
  color: COLORS.textDim,
  fontSize: 14,
  fontWeight: 500,
  textDecoration: "none",
  transition: "color 150ms ease",
};

const footerLink: React.CSSProperties = {
  color: COLORS.textDim,
  fontSize: 13,
  textDecoration: "none",
  transition: "color 150ms ease",
};

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.12em",
  color: COLORS.accent,
  textTransform: "uppercase",
  textAlign: "center",
};

function FeatureCard({
  f,
}: {
  f: {
    dot: string;
    title: string;
    desc: string;
    cta?: { label: string; href: string };
  };
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: COLORS.surface,
        border: `1px solid ${hover ? COLORS.borderHover : "#1e1e1e"}`,
        borderRadius: 14,
        padding: 24,
        transition: "border-color 200ms ease, transform 200ms ease",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          background: f.dot,
          marginBottom: 16,
          boxShadow: `0 0 12px ${f.dot}66`,
        }}
      />
      <h3
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: COLORS.text,
          margin: "0 0 8px",
          letterSpacing: "-0.01em",
        }}
      >
        {f.title}
      </h3>
      <p
        style={{
          color: COLORS.textMuted,
          fontSize: 14,
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        {f.desc}
      </p>
      {f.cta && (
        <Link
          href={f.cta.href}
          className="nx-feature-cta"
          style={{
            marginTop: 12,
            color: COLORS.accent,
            fontSize: 13,
            textDecoration: "none",
            fontWeight: 500,
            alignSelf: "flex-start",
          }}
        >
          {f.cta.label}
        </Link>
      )}
    </div>
  );
}

/* ─── Dashboard mockup ────────────────────────────────────────── */

function DashboardMockup() {
  return (
    <div
      style={{
        background: COLORS.borderSoft,
        border: `1px solid #2a2a2a`,
        borderRadius: 14,
        boxShadow:
          "0 24px 60px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.02)",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: `1px solid #222`,
          background: "#0e0e0e",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              background: `linear-gradient(135deg, ${COLORS.accent}, #4f46e5)`,
            }}
          />
          <span style={{ fontSize: 12, color: COLORS.text, fontWeight: 600 }}>
            Nexyru
          </span>
          <span
            style={{
              marginLeft: 12,
              fontSize: 11,
              color: COLORS.text,
              background: "#1a1a1a",
              padding: "3px 8px",
              borderRadius: 6,
              fontWeight: 500,
            }}
          >
            Dashboard
          </span>
        </div>
        <span style={{ fontSize: 11, color: COLORS.textMuted }}>
          Apex $50k · Eval
        </span>
      </div>

      {/* Stats grid */}
      <div
        style={{
          padding: 16,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <StatCard
          label="Total P&L"
          value="+$8,432"
          valueColor={COLORS.green}
          sub="This week"
        />
        <StatCard
          label="Win Rate"
          value="67.3%"
          valueColor={COLORS.accent}
          sub="42 trades"
        />
        <StatCard
          label="Profit Target"
          value="84%"
          valueColor={COLORS.green}
          sub="Apex $50k — 84% to goal"
          progress={84}
          progressColor={COLORS.green}
        />
        <StatCard
          label="Daily Loss"
          value="Safe"
          valueColor={COLORS.green}
          sub="-$240 of -$3,000"
        />
      </div>

      {/* Trade rows */}
      <div
        style={{
          borderTop: `1px solid #1f1f1f`,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div
          style={{
            color: COLORS.textMuted,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.08em",
            padding: "4px 8px",
          }}
        >
          RECENT TRADES
        </div>
        {TRADES.map((t) => (
          <TradeRow key={t.sym + t.dir} t={t} />
        ))}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueColor,
  sub,
  progress,
  progressColor,
}: {
  label: string;
  value: string;
  valueColor: string;
  sub: string;
  progress?: number;
  progressColor?: string;
}) {
  return (
    <div
      style={{
        background: "#0e0e0e",
        border: `1px solid #1f1f1f`,
        borderRadius: 10,
        padding: 12,
      }}
    >
      <div
        style={{
          color: COLORS.textMuted,
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: valueColor,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div style={{ color: COLORS.textMuted, fontSize: 11 }}>{sub}</div>
      {typeof progress === "number" && (
        <div
          style={{
            marginTop: 8,
            background: "#1a1a1a",
            height: 4,
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: progressColor ?? COLORS.accent,
              borderRadius: 999,
            }}
          />
        </div>
      )}
    </div>
  );
}

function TradeRow({ t }: { t: (typeof TRADES)[number] }) {
  const isLong = t.dir === "LONG";
  const positive = t.pnl >= 0;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 8px",
        borderRadius: 8,
        background: "transparent",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            color: COLORS.text,
            fontSize: 13,
            fontWeight: 600,
            minWidth: 44,
          }}
        >
          {t.sym}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.06em",
            padding: "2px 6px",
            borderRadius: 4,
            background: isLong
              ? "rgba(34,197,94,0.12)"
              : "rgba(239,68,68,0.12)",
            color: isLong ? COLORS.green : COLORS.red,
            border: `1px solid ${isLong ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          }}
        >
          {t.dir}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            color: positive ? COLORS.green : COLORS.red,
            fontSize: 13,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {positive ? "+" : ""}
          {t.pnl < 0 ? "-" : ""}${Math.abs(t.pnl).toFixed(2)}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: COLORS.text,
            background: "#1a1a1a",
            padding: "2px 6px",
            borderRadius: 4,
            minWidth: 20,
            textAlign: "center",
          }}
        >
          {t.grade}
        </span>
      </div>
    </div>
  );
}

/* ─── Challenge Tracker mockup ────────────────────────────────── */

function ChallengeTrackerMockup() {
  return (
    <div
      style={{
        background: "#0c0c0c",
        border: `1px solid #1f1f1f`,
        borderRadius: 14,
        padding: 28,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <ProgressRing
          label="Daily Loss"
          percent={9}
          color={COLORS.green}
          centerTop="$240"
          centerBottom="/ $2,500"
        />
        <ProgressRing
          label="Profit Target"
          percent={61}
          color={COLORS.accent}
          centerTop="$1,840"
          centerBottom="/ $3,000"
        />
        <ProgressRing
          label="Drawdown"
          percent={7}
          color={COLORS.green}
          centerTop="$180"
          centerBottom="/ $2,500"
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          background: "#111",
          border: `1px solid #1f1f1f`,
          borderRadius: 10,
        }}
      >
        <div>
          <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>
            Apex Trader Funding · $50k
          </div>
          <div style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 2 }}>
            Evaluation · Day 8
          </div>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            padding: "5px 10px",
            borderRadius: 999,
            background: COLORS.greenDim,
            color: COLORS.green,
            border: `1px solid ${COLORS.green}44`,
          }}
        >
          ON TRACK
        </span>
      </div>
    </div>
  );
}

function ProgressRing({
  label,
  percent,
  color,
  centerTop,
  centerBottom,
}: {
  label: string;
  percent: number;
  color: string;
  centerTop: string;
  centerBottom: string;
}) {
  const size = 110;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#1f1f1f"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: COLORS.text,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {centerTop}
          </div>
          <div
            style={{
              color: COLORS.textMuted,
              fontSize: 10,
              marginTop: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {centerBottom}
          </div>
        </div>
      </div>
      <div
        style={{
          color: COLORS.textDim,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.04em",
          marginTop: 10,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}
