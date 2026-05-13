"use client";
import Link from "next/link";
import { useState, useEffect } from "react";

const PROP_FIRMS = ["Apex Trader Funding", "TopstepX", "FTMO", "MyFundedFutures", "Bulenox", "Tradeday"];

const FEATURES = [
  {
    icon: "🏆",
    title: "Challenge Tracker",
    desc: "Never blow another funded account. Track your daily loss, drawdown, and profit target in real time with accurate 2026 prop firm rules.",
    color: "#38bdf8",
  },
  {
    icon: "🧠",
    title: "Psychology Tracker",
    desc: "See exactly which emotions and mistakes are costing you money. Revenge trading? FOMO? We show you the dollar cost.",
    color: "#a78bfa",
  },
  {
    icon: "📽️",
    title: "Trade Replay",
    desc: "Review every trade with your actual broker screenshot and entry/exit markers. Learn from your mistakes the way pro athletes watch film.",
    color: "#34d399",
  },
  {
    icon: "🎯",
    title: "Best Setup Finder",
    desc: "Automatically analyzes all your trades to find your highest win rate setups, best times to trade, and which instruments you actually perform best on.",
    color: "#f59e0b",
  },
  {
    icon: "✅",
    title: "Pre-Trade Checklist",
    desc: "Run a quick mental checklist before every trade. Track which checklist items you skip — and how much it costs you.",
    color: "#ec4899",
  },
  {
    icon: "⚡",
    title: "Trade Planner",
    desc: "Set your risk per trade, daily limits, and session times once. Get the exact contract size for every trade automatically.",
    color: "#f97316",
  },
];

const STEPS = [
  { n: "1", title: "Import your trades", desc: "Upload a CSV from your prop firm platform. Takes 30 seconds." },
  { n: "2", title: "Set up your challenge", desc: "Pick your prop firm and account size. Rules auto-fill. We track everything." },
  { n: "3", title: "Trade smarter", desc: "Use insights from your own data to find your edge and protect your funded account." },
];

const PLANS = [
  {
    name: "FREE",
    price: "$0",
    period: "/mo",
    features: ["50 trades per month", "Journal & basic stats", "Challenge tracker (1 account)", "Pre-trade checklist"],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "PRO",
    price: "$19",
    period: "/mo",
    features: [
      "Unlimited trades",
      "All 6 tools",
      "Multiple challenge accounts",
      "Psychology & mistakes tracker",
      "Best setup finder",
      "Trade replay with charts",
    ],
    cta: "Start Pro Trial",
    popular: true,
  },
  {
    name: "ELITE",
    price: "$39",
    period: "/mo",
    features: ["Everything in Pro", "AI trade analysis", "Priority support", "Early access to new features"],
    cta: "Go Elite",
    popular: false,
  },
];

const TESTIMONIALS = [
  {
    text: "Finally passed my Apex $50k eval on my third attempt. The challenge tracker showing my trailing drawdown in real time was a game changer.",
    name: "Jake M.",
    firm: "Apex Trader Funding",
  },
  {
    text: "The psychology tracker showed me I was revenge trading after every loss and it was costing me $800/month. Just seeing the data made me stop.",
    name: "Sarah K.",
    firm: "TopstepX Funded",
  },
  {
    text: "Best $19 I spend every month. The setup finder told me to stop trading oil and focus on NQ — my win rate went from 41% to 68%.",
    name: "Marcus T.",
    firm: "FTMO Funded",
  },
];

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      style={{
        background: "#060d1a",
        color: "#c8d8f0",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflowX: "hidden",
        scrollBehavior: "smooth",
      }}
    >
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 30px rgba(56,189,248,0.2); } 50% { box-shadow: 0 0 60px rgba(56,189,248,0.4); } }
        .cta-primary { transition: all 0.2s ease; }
        .cta-primary:hover { transform: translateY(-2px); box-shadow: 0 20px 60px rgba(56,189,248,0.4) !important; }
        .cta-ghost { transition: all 0.2s ease; }
        .cta-ghost:hover { background: rgba(255,255,255,0.06) !important; border-color: rgba(255,255,255,0.18) !important; }
        .feature-card { transition: all 0.25s ease; }
        .feature-card:hover { transform: translateY(-4px); border-color: rgba(56,189,248,0.25) !important; }
        .plan-card { transition: all 0.25s ease; }
        .plan-card:hover { transform: translateY(-4px); }
        .nav-link { transition: color 0.15s ease; }
        .nav-link:hover { color: #f0f4ff !important; }
        .firm-pill { transition: all 0.2s ease; }
        .firm-pill:hover { border-color: rgba(56,189,248,0.4) !important; color: #f0f4ff !important; }
        @media (max-width: 768px) {
          .nav-links { display: none !important; }
          .hero-ctas { flex-direction: column; width: 100%; }
          .hero-ctas a { width: 100%; justify-content: center; }
          .grid-2 { grid-template-columns: 1fr !important; }
          .grid-3 { grid-template-columns: 1fr !important; }
          .grid-3-features { grid-template-columns: 1fr !important; }
          .section-padding { padding: 60px 20px !important; }
          .nav-container { padding: 0 20px !important; }
          .footer { flex-direction: column; text-align: center; }
        }
      `}</style>

      {/* ═══════════════════════ NAV ═══════════════════════ */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          height: 64,
          background: scrolled ? "rgba(6,13,26,0.85)" : "transparent",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
          transition: "all 0.3s ease",
        }}
      >
        <div
          className="nav-container"
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            height: "100%",
            padding: "0 40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link
            href="/"
            style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "linear-gradient(135deg, #0369a1, #38bdf8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
            >
              📈
            </div>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#f0f4ff", letterSpacing: "-0.02em" }}>
              Nexyru
            </span>
          </Link>

          <div className="nav-links" style={{ display: "flex", gap: 32, alignItems: "center" }}>
            <a href="#features" className="nav-link" style={{ fontSize: 14, color: "#94a3b8", textDecoration: "none", fontWeight: 500 }}>
              Features
            </a>
            <a href="#pricing" className="nav-link" style={{ fontSize: 14, color: "#94a3b8", textDecoration: "none", fontWeight: 500 }}>
              Pricing
            </a>
            <a href="#prop-traders" className="nav-link" style={{ fontSize: 14, color: "#94a3b8", textDecoration: "none", fontWeight: 500 }}>
              For Prop Traders
            </a>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Link
              href="/login"
              className="cta-ghost"
              style={{
                fontSize: 14,
                color: "#c8d8f0",
                textDecoration: "none",
                padding: "8px 16px",
                borderRadius: 10,
                fontWeight: 500,
              }}
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="cta-primary"
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#fff",
                textDecoration: "none",
                padding: "9px 18px",
                borderRadius: 10,
                background: "linear-gradient(135deg, #0369a1, #38bdf8)",
                boxShadow: "0 4px 16px rgba(56,189,248,0.25)",
              }}
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section
        className="section-padding"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "140px 40px 80px",
          position: "relative",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "15%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 700,
            height: 700,
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(56,189,248,0.09) 0%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 16px",
            borderRadius: 100,
            border: "1px solid rgba(52,211,153,0.3)",
            background: "rgba(52,211,153,0.06)",
            marginBottom: 32,
            animation: "fadeUp 0.6s ease both",
            position: "relative",
            zIndex: 1,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#34d399",
              animation: "pulse 2s infinite",
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#34d399" }}>Now live — join free</span>
        </div>

        <h1
          style={{
            fontSize: "clamp(42px, 7vw, 84px)",
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: "-0.035em",
            marginBottom: 24,
            animation: "fadeUp 0.7s ease 0.1s both",
            position: "relative",
            zIndex: 1,
          }}
        >
          <span style={{ color: "#f0f4ff" }}>Stop losing funded accounts.</span>
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #38bdf8, #a78bfa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Start trading with data.
          </span>
        </h1>

        <p
          style={{
            fontSize: "clamp(16px, 2vw, 20px)",
            color: "#94a3b8",
            maxWidth: 640,
            lineHeight: 1.6,
            marginBottom: 40,
            animation: "fadeUp 0.7s ease 0.2s both",
            position: "relative",
            zIndex: 1,
          }}
        >
          Nexyru is the trading journal built specifically for prop firm traders. Track your challenge
          rules, analyze your psychology, and find your edge — all in one place.
        </p>

        <div
          className="hero-ctas"
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "center",
            marginBottom: 24,
            animation: "fadeUp 0.7s ease 0.3s both",
            position: "relative",
            zIndex: 1,
          }}
        >
          <Link
            href="/login"
            className="cta-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "16px 32px",
              borderRadius: 14,
              background: "linear-gradient(135deg, #0369a1, #38bdf8)",
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 8px 32px rgba(56,189,248,0.3)",
            }}
          >
            Start for Free →
          </Link>
          <a
            href="#how-it-works"
            className="cta-ghost"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "16px 32px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.03)",
              color: "#c8d8f0",
              fontSize: 16,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            See how it works
          </a>
        </div>

        <div
          style={{
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
            justifyContent: "center",
            marginBottom: 60,
            fontSize: 13,
            color: "#64748b",
            animation: "fadeUp 0.7s ease 0.4s both",
            position: "relative",
            zIndex: 1,
          }}
        >
          <span>
            <span style={{ color: "#34d399", marginRight: 6 }}>✓</span>No credit card
          </span>
          <span>
            <span style={{ color: "#34d399", marginRight: 6 }}>✓</span>Works with Apex, TopstepX, FTMO & more
          </span>
          <span>
            <span style={{ color: "#34d399", marginRight: 6 }}>✓</span>Free forever plan
          </span>
        </div>

        {/* App mockup */}
        <div
          style={{
            width: "100%",
            maxWidth: 1000,
            animation: "fadeUp 0.9s ease 0.5s both",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #0b1120, #0d1628)",
              borderRadius: 20,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 40px 100px rgba(0,0,0,0.6), 0 0 80px rgba(56,189,248,0.1)",
            }}
          >
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #0369a1, #38bdf8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                  }}
                >
                  📈
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#f0f4ff" }}>Nexyru</span>
              </div>
              {["Dashboard", "Trades", "Challenge", "Psychology"].map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: 11,
                    color: t === "Dashboard" ? "#38bdf8" : "#475569",
                    fontWeight: t === "Dashboard" ? 700 : 500,
                    padding: "4px 10px",
                    borderRadius: 8,
                    background: t === "Dashboard" ? "rgba(56,189,248,0.1)" : "transparent",
                  }}
                >
                  {t}
                </span>
              ))}
              <div
                style={{
                  marginLeft: "auto",
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: 10,
                  background: "rgba(52,211,153,0.1)",
                  border: "1px solid rgba(52,211,153,0.25)",
                  color: "#34d399",
                  letterSpacing: "0.05em",
                }}
              >
                ● LIVE
              </div>
            </div>
            <div
              style={{
                padding: "24px",
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 14,
              }}
            >
              {[
                { l: "Total P&L", v: "+$8,432", c: "#34d399", s: "+12.4% this month" },
                { l: "Win Rate", v: "67.3%", c: "#38bdf8", s: "128 trades" },
                { l: "Profit Target", v: "84%", c: "#a78bfa", s: "$8.4k / $10k" },
                { l: "Daily Loss", v: "Safe", c: "#34d399", s: "-$240 / -$3k" },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 14,
                    padding: 16,
                    border: "1px solid rgba(255,255,255,0.05)",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      color: "#475569",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 8,
                    }}
                  >
                    {s.l}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.c, fontFamily: "monospace" }}>
                    {s.v}
                  </div>
                  <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>{s.s}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "0 24px 24px" }}>
              <div
                style={{
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                {[
                  { p: "NQ1!", t: "LONG", pnl: "+$312.50", c: "#34d399" },
                  { p: "ES1!", t: "SHORT", pnl: "+$187.50", c: "#34d399" },
                  { p: "CL1!", t: "LONG", pnl: "-$95.00", c: "#f87171" },
                ].map((t, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.03)" : "none",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: "#e2e8f0",
                        fontFamily: "monospace",
                        width: 50,
                      }}
                    >
                      {t.p}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 4,
                        background:
                          t.t === "LONG" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                        color: t.t === "LONG" ? "#34d399" : "#f87171",
                      }}
                    >
                      {t.t}
                    </span>
                    <span style={{ flex: 1 }} />
                    <span
                      style={{ fontSize: 13, fontWeight: 900, color: t.c, fontFamily: "monospace" }}
                    >
                      {t.pnl}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ PROP FIRM LOGOS ═══════════════════════ */}
      <section
        id="prop-traders"
        className="section-padding"
        style={{
          padding: "60px 40px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", textAlign: "center" }}>
          <p
            style={{
              fontSize: 12,
              color: "#475569",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 24,
            }}
          >
            Works with every major prop firm
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "center",
            }}
          >
            {PROP_FIRMS.map((firm) => (
              <div
                key={firm}
                className="firm-pill"
                style={{
                  padding: "10px 22px",
                  borderRadius: 100,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.03)",
                  fontSize: 14,
                  color: "#94a3b8",
                  fontWeight: 600,
                }}
              >
                {firm}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ PROBLEM / SOLUTION ═══════════════════════ */}
      <section className="section-padding" style={{ padding: "100px 40px" }}>
        <div
          className="grid-2"
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 48,
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, rgba(248,113,113,0.04), rgba(248,113,113,0.01))",
              border: "1px solid rgba(248,113,113,0.15)",
              borderRadius: 24,
              padding: 40,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#f87171",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              The Problem
            </div>
            <h2
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "#f0f4ff",
                lineHeight: 1.25,
                marginBottom: 28,
                letterSpacing: "-0.02em",
              }}
            >
              Most funded traders fail not because they can't trade — but because they have no system
              for tracking rules, mistakes, and psychology.
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                "80% of funded accounts are blown within 90 days",
                "The #1 reason: breaking daily loss limits",
                "Most traders don't track their mistakes",
              ].map((stat, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "14px 16px",
                    background: "rgba(248,113,113,0.05)",
                    borderRadius: 12,
                    border: "1px solid rgba(248,113,113,0.1)",
                  }}
                >
                  <span style={{ color: "#f87171", fontSize: 18, lineHeight: 1, marginTop: 2 }}>✕</span>
                  <span style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.5, fontWeight: 500 }}>
                    {stat}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: "linear-gradient(135deg, rgba(52,211,153,0.05), rgba(56,189,248,0.03))",
              border: "1px solid rgba(52,211,153,0.2)",
              borderRadius: 24,
              padding: 40,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#34d399",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              The Solution
            </div>
            <h2
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "#f0f4ff",
                lineHeight: 1.25,
                marginBottom: 28,
                letterSpacing: "-0.02em",
              }}
            >
              Nexyru gives you the tools professional traders use — built specifically for the funded
              trading world.
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                "Real-time challenge rule tracking",
                "Psychology & mistake cost analysis",
                "Find your highest-edge setups automatically",
              ].map((stat, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "14px 16px",
                    background: "rgba(52,211,153,0.06)",
                    borderRadius: 12,
                    border: "1px solid rgba(52,211,153,0.15)",
                  }}
                >
                  <span style={{ color: "#34d399", fontSize: 18, lineHeight: 1, marginTop: 2 }}>✓</span>
                  <span style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.5, fontWeight: 500 }}>
                    {stat}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FEATURES GRID ═══════════════════════ */}
      <section
        id="features"
        className="section-padding"
        style={{ padding: "100px 40px", background: "rgba(255,255,255,0.015)" }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#38bdf8",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Everything you need
            </div>
            <h2
              style={{
                fontSize: "clamp(32px, 5vw, 52px)",
                fontWeight: 900,
                color: "#f0f4ff",
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
              }}
            >
              Six tools. One platform.
            </h2>
            <p
              style={{
                fontSize: 16,
                color: "#64748b",
                marginTop: 16,
                maxWidth: 560,
                margin: "16px auto 0",
                lineHeight: 1.6,
              }}
            >
              Every feature is designed around the realities of funded trading and prop firm challenges.
            </p>
          </div>
          <div
            className="grid-3-features"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}
          >
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="feature-card"
                style={{
                  background: "linear-gradient(135deg, #0b1120, #0d1628)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 20,
                  padding: 28,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: `${f.color}15`,
                    border: `1px solid ${f.color}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 26,
                    marginBottom: 20,
                  }}
                >
                  {f.icon}
                </div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#f0f4ff",
                    marginBottom: 10,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {f.title}
                </h3>
                <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ HOW IT WORKS ═══════════════════════ */}
      <section id="how-it-works" className="section-padding" style={{ padding: "100px 40px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#a78bfa",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              How it works
            </div>
            <h2
              style={{
                fontSize: "clamp(32px, 5vw, 52px)",
                fontWeight: 900,
                color: "#f0f4ff",
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
              }}
            >
              Get started in 3 steps
            </h2>
          </div>
          <div
            className="grid-3"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}
          >
            {STEPS.map((step, i) => (
              <div
                key={i}
                style={{
                  position: "relative",
                  background: "linear-gradient(135deg, #0b1120, #0d1628)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 20,
                  padding: 32,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #0369a1, #38bdf8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    fontWeight: 900,
                    color: "#fff",
                    marginBottom: 20,
                    boxShadow: "0 4px 20px rgba(56,189,248,0.3)",
                  }}
                >
                  {step.n}
                </div>
                <h3
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#f0f4ff",
                    marginBottom: 10,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {step.title}
                </h3>
                <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.65 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ PRICING ═══════════════════════ */}
      <section
        id="pricing"
        className="section-padding"
        style={{ padding: "100px 40px", background: "rgba(255,255,255,0.015)" }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#34d399",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Simple pricing
            </div>
            <h2
              style={{
                fontSize: "clamp(32px, 5vw, 52px)",
                fontWeight: 900,
                color: "#f0f4ff",
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
              }}
            >
              Start free. Upgrade when you're ready.
            </h2>
          </div>
          <div
            className="grid-3"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}
          >
            {PLANS.map((plan, i) => (
              <div
                key={i}
                className="plan-card"
                style={{
                  position: "relative",
                  background: plan.popular
                    ? "linear-gradient(135deg, rgba(56,189,248,0.08), rgba(167,139,250,0.05))"
                    : "linear-gradient(135deg, #0b1120, #0d1628)",
                  border: plan.popular
                    ? "1px solid rgba(56,189,248,0.4)"
                    : "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 20,
                  padding: 32,
                  boxShadow: plan.popular ? "0 20px 60px rgba(56,189,248,0.15)" : "none",
                }}
              >
                {plan.popular && (
                  <div
                    style={{
                      position: "absolute",
                      top: -12,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "linear-gradient(135deg, #0369a1, #38bdf8)",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "5px 14px",
                      borderRadius: 100,
                      letterSpacing: "0.1em",
                      boxShadow: "0 4px 16px rgba(56,189,248,0.4)",
                    }}
                  >
                    MOST POPULAR
                  </div>
                )}
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: plan.popular ? "#38bdf8" : "#94a3b8",
                    letterSpacing: "0.12em",
                    marginBottom: 16,
                  }}
                >
                  {plan.name}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 28 }}>
                  <span
                    style={{
                      fontSize: 48,
                      fontWeight: 900,
                      color: "#f0f4ff",
                      letterSpacing: "-0.03em",
                      lineHeight: 1,
                    }}
                  >
                    {plan.price}
                  </span>
                  <span style={{ fontSize: 16, color: "#64748b", fontWeight: 500 }}>
                    {plan.period}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
                  {plan.features.map((feat, j) => (
                    <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span
                        style={{
                          color: plan.popular ? "#38bdf8" : "#34d399",
                          fontSize: 14,
                          lineHeight: 1.5,
                          flexShrink: 0,
                        }}
                      >
                        ✓
                      </span>
                      <span style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.5 }}>{feat}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/login"
                  className="cta-primary"
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "14px 20px",
                    borderRadius: 12,
                    background: plan.popular
                      ? "linear-gradient(135deg, #0369a1, #38bdf8)"
                      : "rgba(255,255,255,0.05)",
                    border: plan.popular ? "none" : "1px solid rgba(255,255,255,0.1)",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                    textDecoration: "none",
                    boxShadow: plan.popular ? "0 4px 20px rgba(56,189,248,0.3)" : "none",
                  }}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ TESTIMONIALS ═══════════════════════ */}
      <section className="section-padding" style={{ padding: "100px 40px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#f59e0b",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Real traders. Real results.
            </div>
            <h2
              style={{
                fontSize: "clamp(32px, 5vw, 52px)",
                fontWeight: 900,
                color: "#f0f4ff",
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
              }}
            >
              Funded traders trust Nexyru
            </h2>
          </div>
          <div
            className="grid-3"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}
          >
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                style={{
                  background: "linear-gradient(135deg, #0b1120, #0d1628)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 20,
                  padding: 28,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", gap: 2, marginBottom: 16 }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s} style={{ color: "#f59e0b", fontSize: 14 }}>
                      ★
                    </span>
                  ))}
                </div>
                <p
                  style={{
                    fontSize: 15,
                    color: "#cbd5e1",
                    lineHeight: 1.65,
                    marginBottom: 24,
                    flex: 1,
                  }}
                >
                  "{t.text}"
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    paddingTop: 20,
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, rgba(56,189,248,0.25), rgba(167,139,250,0.25))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 900,
                      color: "#38bdf8",
                    }}
                  >
                    {t.name[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{t.firm}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ CTA BANNER ═══════════════════════ */}
      <section className="section-padding" style={{ padding: "60px 40px" }}>
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            background:
              "linear-gradient(135deg, #0c2545 0%, #0f3a6e 50%, #1450a3 100%)",
            borderRadius: 28,
            padding: "80px 40px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
            border: "1px solid rgba(56,189,248,0.25)",
            boxShadow: "0 30px 80px rgba(56,189,248,0.2)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 600,
              height: 600,
              borderRadius: "50%",
              background: "radial-gradient(ellipse, rgba(56,189,248,0.2) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2
              style={{
                fontSize: "clamp(32px, 5vw, 52px)",
                fontWeight: 900,
                color: "#fff",
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                marginBottom: 16,
              }}
            >
              Ready to protect your funded account?
            </h2>
            <p
              style={{
                fontSize: 18,
                color: "rgba(255,255,255,0.85)",
                marginBottom: 36,
                maxWidth: 560,
                margin: "0 auto 36px",
                lineHeight: 1.5,
              }}
            >
              Join traders who use Nexyru to trade smarter, not harder.
            </p>
            <Link
              href="/login"
              className="cta-primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "18px 40px",
                borderRadius: 16,
                background: "#fff",
                color: "#0369a1",
                fontSize: 17,
                fontWeight: 800,
                textDecoration: "none",
                boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                animation: "glow 3s ease-in-out infinite",
              }}
            >
              Get Started Free →
            </Link>
            <div
              style={{
                marginTop: 20,
                fontSize: 13,
                color: "rgba(255,255,255,0.7)",
                fontWeight: 500,
              }}
            >
              No credit card required. Free plan available.
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FOOTER ═══════════════════════ */}
      <footer
        className="footer section-padding"
        style={{
          padding: "40px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "linear-gradient(135deg, #0369a1, #38bdf8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
              }}
            >
              📈
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#f0f4ff" }}>Nexyru</span>
          </div>
          <div style={{ fontSize: 12, color: "#475569" }}>The trading journal for funded traders.</div>
        </div>
        <div style={{ display: "flex", gap: 28 }}>
          {[
            ["Privacy", "/privacy"],
            ["Terms", "/terms"],
            ["Contact", "/contact"],
          ].map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className="nav-link"
              style={{ fontSize: 13, color: "#64748b", textDecoration: "none", fontWeight: 500 }}
            >
              {label}
            </Link>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "#334155" }}>© 2026 Nexyru. Built for funded traders.</div>
      </footer>
    </div>
  );
}
