"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const FEATURES = [
  {
    title: "Challenge Tracker",
    desc: "Real-time daily loss, drawdown, and target tracking with accurate 2026 rules.",
  },
  {
    title: "Psychology Tracker",
    desc: "Understand which emotions and mistakes cost you money.",
  },
  {
    title: "Trade Replay",
    desc: "Review trades with your broker screenshots and entry/exit analysis.",
  },
  {
    title: "Setup Finder",
    desc: "Discover your highest win-rate setups automatically.",
  },
  {
    title: "Pre-Trade Checklist",
    desc: "Stay disciplined with a quick checklist before every trade.",
  },
  {
    title: "Trade Planner",
    desc: "Position sizing and session management for funded accounts.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Import",
    desc: "Upload a CSV from your prop firm. Takes under a minute.",
  },
  {
    n: "02",
    title: "Configure",
    desc: "Select your prop firm and account size. Rules fill automatically.",
  },
  {
    n: "03",
    title: "Trade",
    desc: "Use your data to trade smarter and protect your account.",
  },
];

const FREE_FEATURES = [
  "Trade journal — up to 100 trades",
  "Challenge tracker — 1 account",
  "Pre-trade checklist",
  "Best setup finder",
  "Psychology tracker",
  "Trade replay — last 10 trades",
  "AI strategy builder — 3 uses/day",
  "Syncs across all your devices",
];

const PRO_FEATURES = [
  "Everything in Free, unlimited",
  "Multiple challenge accounts",
  "Full trade replay history",
  "Unlimited AI strategy generations",
  "CSV export",
  "Advanced analytics",
  "Priority support + early access",
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 select-none">
      <span
        aria-hidden
        className="inline-flex h-6 w-6 items-center justify-center rounded-md"
        style={{ background: "var(--accent)" }}
      >
        <span
          className="block h-2 w-2 rounded-sm"
          style={{ background: "#fff" }}
        />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-white">
        Nexyru
      </span>
    </Link>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className="sticky top-0 z-50 transition-colors"
      style={{
        backdropFilter: "saturate(180%) blur(10px)",
        WebkitBackdropFilter: "saturate(180%) blur(10px)",
        background: scrolled
          ? "rgba(10, 10, 15, 0.78)"
          : "rgba(10, 10, 15, 0.4)",
        borderBottom: scrolled
          ? "1px solid var(--border)"
          : "1px solid transparent",
      }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="text-[13px] text-[var(--text-2)] hover:text-white transition-colors"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="text-[13px] text-[var(--text-2)] hover:text-white transition-colors"
          >
            Pricing
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden sm:inline-flex h-8 items-center rounded-md px-3 text-[13px] text-[var(--text-2)] hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link href="/login" className="nx-btn-primary h-8 text-[13px]">
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-6 pt-24 pb-20 sm:pt-32 sm:pb-28">
        <p
          className="mb-6 text-[13px] font-medium"
          style={{ color: "var(--accent)" }}
        >
          Built for prop traders
        </p>
        <h1
          className="max-w-4xl text-[44px] leading-[1.05] font-bold tracking-tight text-white sm:text-[56px] lg:text-[64px]"
          style={{ letterSpacing: "-0.02em" }}
        >
          The journal that keeps your funded account alive.
        </h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-[var(--text-2)] sm:text-[18px]">
          Track challenge rules, find your edge, and understand your
          psychology. Built specifically for Apex, TopstepX, FTMO, and other
          prop firms.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/login"
            className="nx-btn-primary h-10 px-5 text-[14px]"
          >
            Start for free
          </Link>
          <a href="#features" className="nx-btn-ghost h-10 px-5 text-[14px]">
            See features
          </a>
        </div>
      </div>
      {/* Subtle radial highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 0%, rgba(99,102,241,0.10) 0%, rgba(10,10,15,0) 60%)",
        }}
      />
    </section>
  );
}

function Features() {
  return (
    <section
      id="features"
      className="border-t"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <p className="nx-label mb-3">Features</p>
        <h2
          className="max-w-2xl text-[28px] font-semibold tracking-tight text-white sm:text-[34px]"
          style={{ letterSpacing: "-0.01em" }}
        >
          Everything you need to keep a funded account.
        </h2>
        <div
          className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-xl border md:grid-cols-2 lg:grid-cols-3"
          style={{ borderColor: "var(--border)", background: "var(--border)" }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-[var(--surface)] p-6 transition-colors hover:bg-[var(--surface-2)]"
            >
              <h3 className="text-[15px] font-semibold text-white">
                {f.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-2)]">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="border-t" style={{ borderColor: "var(--border)" }}>
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <p className="nx-label mb-3">How it works</p>
        <h2
          className="max-w-2xl text-[28px] font-semibold tracking-tight text-white sm:text-[34px]"
          style={{ letterSpacing: "-0.01em" }}
        >
          Three steps from CSV to clarity.
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="nx-card p-6">
              <div
                className="text-[12px] font-semibold tracking-widest"
                style={{ color: "var(--accent)" }}
              >
                {s.n}
              </div>
              <h3 className="mt-4 text-[16px] font-semibold text-white">
                {s.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-2)]">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Mockups ─────────────────────────────────────────────────────── */

function ProgressRing({
  size = 96,
  stroke = 8,
  pct,
  color,
  label,
  value,
  subValue,
}: {
  size?: number;
  stroke?: number;
  pct: number;
  color: string;
  label: string;
  value: string;
  subValue: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(pct, 100) / 100) * c;
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="var(--surface-2)"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-[14px] font-semibold tabular-nums"
            style={{ color }}
          >
            {pct}%
          </span>
        </div>
      </div>
      <div className="mt-3 text-center">
        <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </p>
        <p
          className="mt-1 text-[13px] font-semibold tabular-nums"
          style={{ color }}
        >
          {value}
        </p>
        <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
          {subValue}
        </p>
      </div>
    </div>
  );
}

function ChallengeMockup() {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            Apex $50k · Evaluation
          </p>
          <h4 className="mt-1 text-[15px] font-semibold text-white">
            Challenge Tracker
          </h4>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{
            background: "rgba(16,185,129,0.1)",
            color: "var(--success)",
            border: "1px solid rgba(16,185,129,0.3)",
          }}
        >
          On Track
        </span>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-4">
        <ProgressRing
          pct={9}
          color="var(--success)"
          label="Daily Loss"
          value="$240"
          subValue="of $2,500"
        />
        <ProgressRing
          pct={61}
          color="#3b82f6"
          label="Profit Target"
          value="$1,840"
          subValue="of $3,000"
        />
        <ProgressRing
          pct={7}
          color="var(--success)"
          label="Drawdown"
          value="$180"
          subValue="of $2,500"
        />
      </div>
    </div>
  );
}

function JournalMockup() {
  const trades = [
    { sym: "NQ1!", side: "LONG", entry: "21,450", exit: "21,520", pnl: 350 },
    { sym: "ES1!", side: "SHORT", entry: "5,842", exit: "5,810", pnl: 160 },
    { sym: "SOL/USD", side: "LONG", entry: "148.20", exit: "146.80", pnl: -70 },
    { sym: "NQ1!", side: "LONG", entry: "21,380", exit: "21,460", pnl: 400 },
  ];
  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            Last 4 trades
          </p>
          <h4 className="mt-1 text-[15px] font-semibold text-white">
            Trade Journal
          </h4>
        </div>
        <span className="text-[13px] font-semibold tabular-nums text-[var(--success)]">
          +$840.00
        </span>
      </div>
      <div className="mt-5 overflow-hidden rounded-lg" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-left text-[12px]">
          <thead style={{ background: "var(--surface-2)" }}>
            <tr className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              <th className="px-3 py-2 font-medium">Symbol</th>
              <th className="px-3 py-2 font-medium">Side</th>
              <th className="px-3 py-2 font-medium text-right">Entry</th>
              <th className="px-3 py-2 font-medium text-right">Exit</th>
              <th className="px-3 py-2 font-medium text-right">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => (
              <tr
                key={i}
                style={{
                  borderTop: "1px solid var(--border)",
                }}
              >
                <td className="px-3 py-2.5 font-medium text-white">{t.sym}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={
                      t.side === "LONG" ? "nx-badge-long" : "nx-badge-short"
                    }
                  >
                    {t.side}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[var(--text-2)]">
                  {t.entry}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[var(--text-2)]">
                  {t.exit}
                </td>
                <td
                  className="px-3 py-2.5 text-right font-semibold tabular-nums"
                  style={{
                    color: t.pnl >= 0 ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {t.pnl >= 0 ? "+" : "-"}${Math.abs(t.pnl).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PsychologyMockup() {
  const score = 72;
  const r = 40;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const insights = [
    "Your best day is Tuesday — averaging +$425",
    "You perform best between 9-10am",
    "71% win rate when you follow your rules",
  ];
  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            30-day score
          </p>
          <h4 className="mt-1 text-[15px] font-semibold text-white">
            Psychology Tracker
          </h4>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-5">
        <div className="relative" style={{ width: 96, height: 96 }}>
          <svg width={96} height={96} className="-rotate-90">
            <circle
              cx={48}
              cy={48}
              r={r}
              stroke="var(--surface-2)"
              strokeWidth={8}
              fill="none"
            />
            <circle
              cx={48}
              cy={48}
              r={r}
              stroke="var(--accent)"
              strokeWidth={8}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[20px] font-bold tabular-nums text-white">
              {score}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              /100
            </span>
          </div>
        </div>
        <div>
          <p
            className="text-[16px] font-semibold"
            style={{ color: "var(--accent)" }}
          >
            Disciplined
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-2)]">
            You stuck to your plan on 18 of 22 sessions.
          </p>
        </div>
      </div>
      <div className="mt-5 space-y-2">
        {insights.map((line) => (
          <div
            key={line}
            className="flex items-start gap-2 rounded-lg p-3"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            <span
              aria-hidden
              className="mt-1 inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--accent)" }}
            />
            <p className="text-[12px] leading-relaxed text-[var(--text-2)]">
              {line}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureShowcase() {
  return (
    <section className="border-t" style={{ borderColor: "var(--border)" }}>
      <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <p className="nx-label mb-3">A look inside</p>
        <h2
          className="max-w-3xl text-[28px] font-semibold tracking-tight text-white sm:text-[34px]"
          style={{ letterSpacing: "-0.01em" }}
        >
          The same tools used by funded traders, every day.
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div>
            <p
              className="mb-4 text-[12px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--accent)" }}
            >
              Challenge Tracker
            </p>
            <ChallengeMockup />
            <p className="mt-4 text-[13px] leading-relaxed text-[var(--text-2)]">
              Live rule tracking for every prop firm. Know exactly how close you
              are to a violation.
            </p>
          </div>
          <div>
            <p
              className="mb-4 text-[12px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--accent)" }}
            >
              Journal
            </p>
            <JournalMockup />
            <p className="mt-4 text-[13px] leading-relaxed text-[var(--text-2)]">
              Auto-imported from your prop firm. Tag setups, attach screenshots,
              find your edge.
            </p>
          </div>
          <div>
            <p
              className="mb-4 text-[12px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--accent)" }}
            >
              Psychology
            </p>
            <PsychologyMockup />
            <p className="mt-4 text-[13px] leading-relaxed text-[var(--text-2)]">
              Personalized insights that surface when, why, and how you trade
              your best.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ─────────────────────────────────────────────────────── */

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="mt-[2px] shrink-0"
      aria-hidden
    >
      <path
        d="M3.5 8.5L6.5 11.5L12.5 5"
        stroke="var(--success)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="mt-[2px] shrink-0"
      aria-hidden
    >
      <path
        d="M4 8H12"
        stroke="var(--text-muted)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FreeCard() {
  return (
    <div
      className="relative rounded-2xl p-8"
      style={{
        background: "var(--surface)",
        border: "1px solid rgba(255,255,255,0.18)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.04) inset, 0 30px 60px -30px rgba(99,102,241,0.25)",
      }}
    >
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-[18px] font-semibold text-white">Free</h3>
          <p className="mt-1 text-[13px] text-[var(--text-2)]">
            Start today, no card required
          </p>
        </div>
        <div className="text-right">
          <span className="text-[36px] font-bold text-white tabular-nums">
            $0
          </span>
          <span className="ml-1 text-[13px] text-[var(--text-muted)]">/mo</span>
        </div>
      </div>
      <Link
        href="/login"
        className="nx-btn-primary mt-6 w-full h-11 text-[14px]"
      >
        Get started free
      </Link>
      <div
        className="my-7 h-px w-full"
        style={{ background: "var(--border)" }}
      />
      <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
        Everything included
      </p>
      <ul className="mt-4 space-y-3">
        {FREE_FEATURES.map((feat) => (
          <li
            key={feat}
            className="flex items-start gap-3 text-[14px] text-white"
          >
            <CheckIcon />
            <span>{feat}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProCard() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("nexyru_waitlist");
      const list: string[] = raw ? JSON.parse(raw) : [];
      const stored = localStorage.getItem("nexyru_waitlist_me");
      if (stored && list.includes(stored)) setSubmitted(true);
    } catch {
      // ignore
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email");
      return;
    }
    try {
      const raw = localStorage.getItem("nexyru_waitlist");
      const list: string[] = raw ? JSON.parse(raw) : [];
      if (!list.includes(trimmed)) list.push(trimmed);
      localStorage.setItem("nexyru_waitlist", JSON.stringify(list));
      localStorage.setItem("nexyru_waitlist_me", trimmed);
      setSubmitted(true);
    } catch {
      setError("Couldn't save — try again");
    }
  };

  return (
    <div
      className="relative rounded-2xl p-8 overflow-hidden"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        opacity: 0.92,
      }}
    >
      {/* Coming Soon watermark */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <span
          className="text-[64px] font-bold uppercase tracking-widest"
          style={{
            color: "rgba(255,255,255,0.02)",
            letterSpacing: "0.2em",
          }}
        >
          Soon
        </span>
      </div>

      <span
        className="absolute -top-2 right-6 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          color: "var(--text-2)",
        }}
      >
        Coming Soon
      </span>

      <div className="relative">
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="text-[18px] font-semibold text-[var(--text-2)]">
              Pro
            </h3>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">
              Coming soon
            </p>
          </div>
          <div className="text-right">
            <span className="text-[36px] font-bold text-[var(--text-2)] tabular-nums">
              $19
            </span>
            <span className="ml-1 text-[13px] text-[var(--text-muted)]">
              /mo
            </span>
          </div>
        </div>

        {submitted ? (
          <div
            className="mt-6 flex items-center gap-3 rounded-lg px-4 py-3"
            style={{
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.3)",
            }}
          >
            <CheckIcon />
            <p className="text-[13px] font-medium text-white">
              You&apos;re on the list!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-2">
            <button
              type="submit"
              className="nx-btn-ghost w-full h-11 text-[14px]"
            >
              Join waitlist
            </button>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-10 rounded-lg px-3 text-[13px] text-white placeholder:text-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent)]"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
              aria-label="Email for waitlist"
            />
            {error && (
              <p className="text-[12px]" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            )}
          </form>
        )}

        <div
          className="my-7 h-px w-full"
          style={{ background: "var(--border)" }}
        />
        <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
          What you&apos;ll get
        </p>
        <ul className="mt-4 space-y-3">
          {PRO_FEATURES.map((feat) => (
            <li
              key={feat}
              className="flex items-start gap-3 text-[14px] text-[var(--text-muted)]"
            >
              <DashIcon />
              <span>{feat}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div
      className="relative rounded-2xl p-5"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            Apex $50k
          </p>
          <p className="mt-1 text-[13px] font-semibold text-white">Dashboard</p>
        </div>
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--danger)" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--warning)" }} />
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--success)" }} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div
          className="rounded-lg p-3"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            Net P&amp;L
          </p>
          <p className="mt-1 text-[18px] font-bold tabular-nums text-[var(--success)]">
            +$1,840
          </p>
        </div>
        <div
          className="rounded-lg p-3"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            Win rate
          </p>
          <p className="mt-1 text-[18px] font-bold tabular-nums text-white">
            71%
          </p>
        </div>
      </div>

      <div
        className="mt-3 rounded-lg p-3"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
        }}
      >
        <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
          Equity curve
        </p>
        <svg
          viewBox="0 0 200 60"
          className="mt-2 w-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,50 L20,42 L40,46 L60,34 L80,30 L100,32 L120,22 L140,24 L160,14 L180,18 L200,8 L200,60 L0,60 Z"
            fill="url(#eqGrad)"
          />
          <path
            d="M0,50 L20,42 L40,46 L60,34 L80,30 L100,32 L120,22 L140,24 L160,14 L180,18 L200,8"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div
        className="mt-3 flex items-center justify-between rounded-lg p-3"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
        }}
      >
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            Drawdown buffer
          </p>
          <p className="mt-1 text-[13px] font-semibold tabular-nums text-white">
            $2,320 <span className="text-[var(--text-muted)] font-normal">left</span>
          </p>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{
            background: "rgba(16,185,129,0.1)",
            color: "var(--success)",
            border: "1px solid rgba(16,185,129,0.3)",
          }}
        >
          Safe
        </span>
      </div>
    </div>
  );
}

function Pricing() {
  return (
    <section
      id="pricing"
      className="border-t"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <p className="nx-label mb-3">Pricing</p>
        <h2
          className="max-w-2xl text-[28px] font-semibold tracking-tight text-white sm:text-[34px]"
          style={{ letterSpacing: "-0.01em" }}
        >
          Everything, free — while we build what&apos;s next.
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--text-2)]">
          Every Nexyru feature is free today. Pro will add unlimited AI and team
          tools later — join the waitlist to be first in.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <FreeCard />
          </div>
          <div className="lg:col-span-2">
            <DashboardPreview />
          </div>
          <div className="lg:col-span-5">
            <ProCard />
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t" style={{ borderColor: "var(--border)" }}>
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
        <Logo />
        <nav className="flex flex-wrap items-center gap-6 text-[13px] text-[var(--text-2)]">
          <a href="#features" className="hover:text-white transition-colors">
            Features
          </a>
          <a href="#pricing" className="hover:text-white transition-colors">
            Pricing
          </a>
          <Link href="/privacy" className="hover:text-white transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-white transition-colors">
            Terms
          </Link>
          <Link href="/contact" className="hover:text-white transition-colors">
            Contact
          </Link>
        </nav>
        <p className="text-[12px] text-[var(--text-muted)]">
          © {new Date().getFullYear()} Nexyru
        </p>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <Nav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <FeatureShowcase />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
