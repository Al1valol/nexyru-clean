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

const PLAN_FREE = {
  name: "Free",
  price: "$0",
  tagline: "Get started, no card required",
  features: [
    "Trade journal (up to 100 trades)",
    "Challenge tracker",
    "Pre-trade checklist",
  ],
};

const PLAN_PRO = {
  name: "Pro",
  price: "$19",
  tagline: "For serious funded traders",
  features: [
    "Everything in Free",
    "Unlimited trades",
    "Psychology tracker",
    "Setup finder",
    "Trade replay",
    "Trade planner",
  ],
};

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

function FeatureCard({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="nx-card p-6 transition-colors hover:bg-[var(--surface-2)]">
      <h3 className="text-[15px] font-semibold text-white">{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-2)]">
        {desc}
      </p>
    </div>
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
        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-xl border md:grid-cols-2 lg:grid-cols-3"
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

function PlanCard({
  plan,
  highlight = false,
}: {
  plan: typeof PLAN_FREE;
  highlight?: boolean;
}) {
  return (
    <div
      className="relative rounded-xl p-7"
      style={{
        background: "var(--surface)",
        border: highlight
          ? "1px solid var(--accent)"
          : "1px solid var(--border)",
      }}
    >
      {highlight && (
        <span
          className="absolute -top-2 right-6 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
          style={{ background: "var(--accent)" }}
        >
          Popular
        </span>
      )}
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-semibold text-white">{plan.name}</h3>
        <div className="text-right">
          <span className="text-[28px] font-bold text-white tabular-nums">
            {plan.price}
          </span>
          <span className="ml-1 text-[13px] text-[var(--text-muted)]">
            /mo
          </span>
        </div>
      </div>
      <p className="mt-1 text-[13px] text-[var(--text-2)]">{plan.tagline}</p>
      <Link
        href="/login"
        className={
          highlight
            ? "nx-btn-primary mt-6 w-full h-10 text-[14px]"
            : "nx-btn-ghost mt-6 w-full h-10 text-[14px]"
        }
      >
        Get started
      </Link>
      <ul className="mt-7 space-y-3">
        {plan.features.map((feat) => (
          <li
            key={feat}
            className="flex items-start gap-2 text-[14px] text-[var(--text-2)]"
          >
            <span
              aria-hidden
              className="mt-[7px] inline-block h-1 w-1 rounded-full"
              style={{ background: "var(--accent)" }}
            />
            <span>{feat}</span>
          </li>
        ))}
      </ul>
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
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <p className="nx-label mb-3">Pricing</p>
        <h2
          className="max-w-2xl text-[28px] font-semibold tracking-tight text-white sm:text-[34px]"
          style={{ letterSpacing: "-0.01em" }}
        >
          Simple, honest pricing.
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 md:max-w-3xl">
          <PlanCard plan={PLAN_FREE} />
          <PlanCard plan={PLAN_PRO} highlight />
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
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
