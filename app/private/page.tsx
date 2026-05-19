"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ───────────────────────── auth ─────────────────────────
const PASSWORD = "nexyru2026";
const AUTH_KEY = "nexyru_private_auth";

// ───────────────────────── theme ─────────────────────────
const C = {
  bg: "#080808",
  card: "#111111",
  card2: "#161616",
  border: "#1e1e2a",
  borderSoft: "#1a1a1a",
  text: "#ffffff",
  textDim: "#9aa0aa",
  textMuted: "#6b7280",
  accent: "#6366f1",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#f59e0b",
};

// ───────────────────────── page ─────────────────────────
type Tab = "journal" | "crypto" | "odds";

export default function PrivatePage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("journal");

  useEffect(() => {
    try {
      setAuthed(localStorage.getItem(AUTH_KEY) === "true");
    } catch {
      setAuthed(false);
    }
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch {}
    setAuthed(false);
  }, []);

  if (authed === null) {
    return <div style={{ background: C.bg, minHeight: "100vh" }} />;
  }
  if (!authed) {
    return <PasswordGate onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div
      style={{
        background: C.bg,
        color: C.text,
        minHeight: "100vh",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <TopBar tab={tab} setTab={setTab} />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 96px" }}>
        {tab === "journal" && <JournalTab />}
        {tab === "crypto" && <CryptoTab />}
        {tab === "odds" && <OddsTab />}
      </main>
      <button
        onClick={logout}
        style={{
          position: "fixed",
          bottom: 16,
          right: 20,
          background: "transparent",
          border: "none",
          color: C.textMuted,
          fontSize: 12,
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        Logout
      </button>
      <style jsx global>{`
        @keyframes nexyru-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .nexyru-shake { animation: nexyru-shake 0.4s ease-in-out; }
        @keyframes nexyru-spin {
          to { transform: rotate(360deg); }
        }
        .nexyru-spin { animation: nexyru-spin 0.9s linear infinite; }
        @keyframes nexyru-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        .nexyru-pulse { animation: nexyru-pulse 1.2s ease-in-out infinite; }
        .odds-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 260px;
          gap: 18px;
        }
        @media (max-width: 820px) {
          .odds-grid { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>
    </div>
  );
}

// ───────────────────────── password gate ─────────────────────────
function PasswordGate({ onSuccess }: { onSuccess: () => void }) {
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (value === PASSWORD) {
      try {
        localStorage.setItem(AUTH_KEY, "true");
      } catch {}
      onSuccess();
    } else {
      setWrong(true);
      setTimeout(() => setWrong(false), 500);
    }
  }

  return (
    <div
      style={{
        background: C.bg,
        color: C.text,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <form
        onSubmit={submit}
        className={wrong ? "nexyru-shake" : ""}
        style={{
          background: C.card,
          border: `1px solid ${wrong ? C.red : C.border}`,
          borderRadius: 14,
          padding: 32,
          width: "100%",
          maxWidth: 360,
          textAlign: "center",
          transition: "border-color 150ms",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 11,
            background: "linear-gradient(135deg,#6366f1,#4f46e5)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            color: "#fff",
            fontSize: 20,
            marginBottom: 16,
          }}
        >
          N
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Private</div>
        <div style={{ color: C.textDim, fontSize: 13, marginBottom: 20 }}>
          Enter password to continue
        </div>
        <input
          ref={inputRef}
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Password"
          style={{
            width: "100%",
            background: C.card2,
            border: `1px solid ${wrong ? C.red : C.border}`,
            borderRadius: 8,
            padding: "11px 14px",
            color: C.text,
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 12,
            transition: "border-color 150ms",
          }}
        />
        <button
          type="submit"
          style={{
            width: "100%",
            background: C.accent,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "11px 14px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Enter
        </button>
      </form>
    </div>
  );
}

// ───────────────────────── top bar ─────────────────────────
const TABS: { key: Tab; label: string }[] = [
  { key: "journal", label: "Journal" },
  { key: "crypto", label: "Crypto" },
  { key: "odds", label: "Odds" },
];

function TopBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <header
      style={{
        background: C.bg,
        borderBottom: `1px solid ${C.border}`,
        position: "sticky",
        top: 0,
        zIndex: 10,
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <a
          href="/"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "linear-gradient(135deg,#6366f1,#4f46e5)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            color: "#fff",
            fontSize: 14,
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          N
        </a>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: active ? C.text : C.textMuted,
                  padding: "6px 4px",
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  borderBottom: `2px solid ${active ? C.accent : "transparent"}`,
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

// ───────────────────────── journal tab ─────────────────────────
interface Trade {
  pnl?: number | string;
  date?: number | string;
  symbol?: string;
  pair?: string;
  type?: string;
}

function loadAllTrades(): Trade[] {
  if (typeof window === "undefined") return [];
  const all: Trade[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (!key.startsWith("tradedesk_trades_") || !key.endsWith("_v1")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) all.push(...parsed);
      } catch {}
    }
  } catch {}
  return all;
}

function tradePnl(t: Trade): number | null {
  const v = typeof t.pnl === "number" ? t.pnl : parseFloat(String(t.pnl ?? ""));
  return Number.isFinite(v) ? v : null;
}
function tradeTs(t: Trade): number | null {
  if (t.date === undefined || t.date === null) return null;
  if (typeof t.date === "number") return t.date;
  const parsed = new Date(t.date).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function JournalTab() {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    setTrades(loadAllTrades());
  }, []);

  // Chronological trades with valid pnl
  const chrono = useMemo(() => {
    return trades
      .map((t) => ({ t, pnl: tradePnl(t), ts: tradeTs(t) }))
      .filter((x): x is { t: Trade; pnl: number; ts: number | null } => x.pnl !== null)
      .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
  }, [trades]);

  const stats = useMemo(() => {
    let pnlTotal = 0;
    let wins = 0;
    let losses = 0;
    let best = -Infinity;
    let winSum = 0;
    let lossSum = 0;
    for (const { pnl } of chrono) {
      pnlTotal += pnl;
      if (pnl > 0) {
        wins++;
        winSum += pnl;
      } else if (pnl < 0) {
        losses++;
        lossSum += pnl;
      }
      if (pnl > best) best = pnl;
    }
    const decided = wins + losses;
    const winRate = decided > 0 ? (wins / decided) * 100 : 0;
    const avgWin = wins > 0 ? winSum / wins : 0;
    const avgLoss = losses > 0 ? lossSum / losses : 0;
    const profitFactor =
      lossSum < 0 ? winSum / Math.abs(lossSum) : winSum > 0 ? Infinity : 0;

    // Current streak (from the latest trade backward)
    let streakLen = 0;
    let streakKind: "win" | "loss" | null = null;
    for (let i = chrono.length - 1; i >= 0; i--) {
      const pnl = chrono[i].pnl;
      const kind: "win" | "loss" | null =
        pnl > 0 ? "win" : pnl < 0 ? "loss" : null;
      if (kind === null) break;
      if (streakKind === null) {
        streakKind = kind;
        streakLen = 1;
      } else if (streakKind === kind) {
        streakLen++;
      } else {
        break;
      }
    }

    // Per-day aggregation
    const byDay = new Map<string, number>();
    for (const { pnl, ts } of chrono) {
      if (ts === null) continue;
      const day = new Date(ts).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + pnl);
    }
    let bestDay: { day: string; pnl: number } | null = null;
    let worstDay: { day: string; pnl: number } | null = null;
    for (const [day, pnl] of byDay) {
      if (bestDay === null || pnl > bestDay.pnl) bestDay = { day, pnl };
      if (worstDay === null || pnl < worstDay.pnl) worstDay = { day, pnl };
    }

    return {
      count: chrono.length,
      pnlTotal,
      winRate,
      best: best === -Infinity ? 0 : best,
      profitFactor,
      avgWin,
      avgLoss,
      streakLen,
      streakKind,
      bestDay,
      worstDay,
    };
  }, [chrono]);

  const equityPoints = useMemo(() => {
    const pts: number[] = [];
    let cum = 0;
    for (const { pnl } of chrono) {
      cum += pnl;
      pts.push(cum);
    }
    return pts;
  }, [chrono]);

  const recent = useMemo(() => chrono.slice(-10).reverse(), [chrono]);

  return (
    <section>
      <SectionTitle title="Journal" subtitle="Aggregate stats across all accounts" />

      {/* Row 1 — core stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <StatCard label="Total Trades" value={stats.count.toLocaleString()} />
        <StatCard
          label="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          color={stats.winRate >= 50 ? C.green : C.textDim}
        />
        <StatCard
          label="Total PnL"
          value={`${stats.pnlTotal >= 0 ? "+" : ""}$${stats.pnlTotal.toFixed(2)}`}
          color={stats.pnlTotal >= 0 ? C.green : C.red}
        />
        <StatCard
          label="Best Trade"
          value={`$${stats.best.toFixed(2)}`}
          color={stats.best > 0 ? C.green : C.textDim}
        />
      </div>

      {/* Row 2 — performance ratios */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <StatCard
          label="Profit Factor"
          value={
            !Number.isFinite(stats.profitFactor)
              ? stats.profitFactor === Infinity
                ? "∞"
                : "—"
              : stats.profitFactor.toFixed(2)
          }
          color={stats.profitFactor >= 1.5 ? C.green : stats.profitFactor < 1 ? C.red : C.text}
        />
        <StatCard
          label="Avg Win"
          value={`+$${stats.avgWin.toFixed(2)}`}
          color={C.green}
        />
        <StatCard
          label="Avg Loss"
          value={`$${stats.avgLoss.toFixed(2)}`}
          color={C.red}
        />
      </div>

      {/* Row 3 — streak / day extremes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
          marginBottom: 22,
        }}
      >
        <StatCard
          label="Current Streak"
          value={
            stats.streakKind === null
              ? "—"
              : `${stats.streakLen} ${stats.streakKind} streak`
          }
          color={
            stats.streakKind === "win"
              ? C.green
              : stats.streakKind === "loss"
                ? C.red
                : C.textDim
          }
        />
        <StatCard
          label="Best Day"
          value={
            stats.bestDay
              ? `+$${stats.bestDay.pnl.toFixed(2)}`
              : "—"
          }
          color={C.green}
          subtext={stats.bestDay ? stats.bestDay.day : undefined}
        />
        <StatCard
          label="Worst Day"
          value={
            stats.worstDay
              ? `$${stats.worstDay.pnl.toFixed(2)}`
              : "—"
          }
          color={C.red}
          subtext={stats.worstDay ? stats.worstDay.day : undefined}
        />
      </div>

      {/* Equity curve */}
      <EquityCurveCard points={equityPoints} />

      {/* Recent trades */}
      <Subhead>Recent Trades</Subhead>
      {recent.length === 0 ? (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 18,
            color: C.textMuted,
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          No trades found in localStorage.
        </div>
      ) : (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 20,
          }}
        >
          {recent.map((entry, i) => {
            const { t, pnl, ts } = entry;
            const isLong = String(t.type ?? "").toLowerCase() === "long";
            const isShort = String(t.type ?? "").toLowerCase() === "short";
            const sym = t.symbol ?? t.pair ?? "—";
            const date = ts ? new Date(ts).toLocaleDateString() : "—";
            return (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "110px 1fr 80px 100px",
                  alignItems: "center",
                  padding: "10px 14px",
                  background: i % 2 === 1 ? C.card2 : "transparent",
                  fontSize: 13,
                  gap: 10,
                }}
              >
                <span style={{ color: C.textDim, fontSize: 12 }}>{date}</span>
                <span style={{ fontWeight: 600 }}>{sym}</span>
                {isLong || isShort ? (
                  <span
                    style={{
                      justifySelf: "start",
                      background: isLong
                        ? "rgba(34,197,94,0.12)"
                        : "rgba(239,68,68,0.12)",
                      border: `1px solid ${isLong ? C.green : C.red}`,
                      color: isLong ? C.green : C.red,
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 10.5,
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {isLong ? "Long" : "Short"}
                  </span>
                ) : (
                  <span style={{ color: C.textMuted, fontSize: 11 }}>—</span>
                )}
                <span
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    color: pnl >= 0 ? C.green : C.red,
                  }}
                >
                  {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <a
        href="/dashboard"
        style={{
          display: "inline-block",
          background: C.accent,
          color: "#fff",
          textDecoration: "none",
          padding: "10px 18px",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Open Full Journal →
      </a>
    </section>
  );
}

function StatCard({
  label,
  value,
  color,
  subtext,
}: {
  label: string;
  value: string;
  color?: string;
  subtext?: string;
}) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          color: C.textMuted,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.01em",
          color: color ?? C.text,
        }}
      >
        {value}
      </div>
      {subtext && (
        <div style={{ color: C.textMuted, fontSize: 11, marginTop: 4 }}>{subtext}</div>
      )}
    </div>
  );
}

function EquityCurveCard({ points }: { points: number[] }) {
  // Coordinate space
  const W = 760;
  const H = 180;
  const PAD_L = 12;
  const PAD_R = 12;
  const PAD_T = 14;
  const PAD_B = 14;

  if (points.length < 2) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 18,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            color: C.textMuted,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Equity Curve
        </div>
        <div style={{ color: C.textMuted, fontSize: 13 }}>
          Need at least 2 trades to draw a curve.
        </div>
      </div>
    );
  }

  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const range = max - min || 1;
  const stepX = (W - PAD_L - PAD_R) / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = PAD_L + i * stepX;
    const y = PAD_T + (H - PAD_T - PAD_B) * (1 - (p - min) / range);
    return [x, y] as const;
  });

  const polyline = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const end = points[points.length - 1];

  // Zero line position (if 0 falls within range)
  const zeroY =
    min < 0 && max > 0
      ? PAD_T + (H - PAD_T - PAD_B) * (1 - (0 - min) / range)
      : null;

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          color: C.textMuted,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 10,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>Equity Curve</span>
        <span style={{ color: C.textMuted, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
          {points.length} trades
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: 180, display: "block" }}
      >
        {zeroY !== null && (
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={zeroY}
            y2={zeroY}
            stroke={C.border}
            strokeDasharray="3 3"
          />
        )}
        <polyline
          points={polyline}
          fill="none"
          stroke={end >= 0 ? C.green : C.red}
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
          fontSize: 12,
          color: C.textDim,
        }}
      >
        <span>$0.00</span>
        <span
          style={{
            color: end >= 0 ? C.green : C.red,
            fontWeight: 700,
          }}
        >
          {end >= 0 ? "+" : ""}${end.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

// ───────────────────────── crypto tab ─────────────────────────
interface TrendingCoin {
  item: {
    id: string;
    name: string;
    symbol: string;
    market_cap_rank: number | null;
    data?: { price?: number; price_change_percentage_24h?: { usd?: number } };
  };
}
interface DexPair {
  pairAddress: string;
  chainId: string;
  dexId: string;
  baseToken: { symbol: string; name: string; address: string };
  quoteToken: { symbol: string };
  priceUsd?: string;
  priceChange?: { h1?: number; h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  pairCreatedAt?: number;
}
interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_24h_in_currency?: number | null;
  market_cap_rank: number | null;
}

const CHAIN_BADGES: Record<string, { bg: string; border: string; fg: string; label: string }> = {
  solana: { bg: "rgba(147,51,234,0.18)", border: "rgba(147,51,234,0.55)", fg: "#c4a4ff", label: "SOL" },
  ethereum: { bg: "rgba(59,130,246,0.18)", border: "rgba(59,130,246,0.55)", fg: "#93c5fd", label: "ETH" },
  base: { bg: "rgba(34,197,94,0.18)", border: "rgba(34,197,94,0.55)", fg: "#86efac", label: "BASE" },
  bsc: { bg: "rgba(234,179,8,0.18)", border: "rgba(234,179,8,0.55)", fg: "#fde047", label: "BSC" },
  arbitrum: { bg: "rgba(56,189,248,0.18)", border: "rgba(56,189,248,0.55)", fg: "#7dd3fc", label: "ARB" },
  polygon: { bg: "rgba(168,85,247,0.18)", border: "rgba(168,85,247,0.55)", fg: "#d8b4fe", label: "POLY" },
  optimism: { bg: "rgba(239,68,68,0.18)", border: "rgba(239,68,68,0.55)", fg: "#fca5a5", label: "OP" },
  avalanche: { bg: "rgba(244,63,94,0.18)", border: "rgba(244,63,94,0.55)", fg: "#fda4af", label: "AVAX" },
};

function chainBadge(chainId: string) {
  const key = chainId.toLowerCase();
  return (
    CHAIN_BADGES[key] ?? {
      bg: "rgba(120,120,140,0.15)",
      border: "rgba(120,120,140,0.4)",
      fg: "#c0c0d0",
      label: chainId.toUpperCase().slice(0, 5),
    }
  );
}

export function CryptoTab() {
  const [trending, setTrending] = useState<TrendingCoin[] | null>(null);
  const [pairs, setPairs] = useState<DexPair[] | null>(null);
  const [gainers, setGainers] = useState<MarketCoin[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [trendRes, pairsRes, gainersRes] = await Promise.allSettled([
        fetch("https://api.coingecko.com/api/v3/search/trending"),
        fetch("https://api.dexscreener.com/latest/dex/search?q=meme"),
        fetch(
          "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=price_change_percentage_24h_desc&per_page=10&page=1&sparkline=false&price_change_percentage=1h,24h",
        ),
      ]);

      if (trendRes.status === "fulfilled" && trendRes.value.ok) {
        const data = (await trendRes.value.json()) as { coins?: TrendingCoin[] };
        setTrending((data.coins ?? []).slice(0, 7));
      }
      if (pairsRes.status === "fulfilled" && pairsRes.value.ok) {
        const data = (await pairsRes.value.json()) as { pairs?: DexPair[] };
        const sorted = [...(data.pairs ?? [])]
          .filter((p) => (p.volume?.h24 ?? 0) > 0)
          .sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0))
          .slice(0, 10);
        setPairs(sorted);
      }
      if (gainersRes.status === "fulfilled" && gainersRes.value.ok) {
        const data = (await gainersRes.value.json()) as MarketCoin[];
        setGainers(data.slice(0, 10));
      }
      setUpdatedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  async function copyAddress(addr: string) {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(addr);
      setTimeout(() => setCopied((cur) => (cur === addr ? null : cur)), 1200);
    } catch {}
  }

  const filteredTrending = useMemo(() => {
    if (!trending) return trending;
    const q = search.trim().toLowerCase();
    if (!q) return trending;
    return trending.filter(
      (c) =>
        c.item.name.toLowerCase().includes(q) ||
        c.item.symbol.toLowerCase().includes(q),
    );
  }, [trending, search]);

  return (
    <section>
      <SectionTitle
        title="Crypto"
        subtitle="Auto-refreshes every 5 min · CoinGecko + DexScreener"
        right={
          <button
            onClick={load}
            disabled={loading}
            style={{
              background: C.card2,
              border: `1px solid ${C.border}`,
              color: C.text,
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {loading && <Spinner small />}
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        }
      />
      {error && <ErrorBox>{error}</ErrorBox>}

      <Subhead>Trending coins</Subhead>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter by name or symbol..."
        style={{
          width: "100%",
          background: C.card2,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: "9px 12px",
          color: C.text,
          fontSize: 13,
          outline: "none",
          boxSizing: "border-box",
          marginBottom: 10,
        }}
      />
      {filteredTrending === null ? (
        <LoadingBlock />
      ) : filteredTrending.length === 0 ? (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 14,
            color: C.textMuted,
            fontSize: 13,
            marginBottom: 24,
          }}
        >
          No coins match &ldquo;{search}&rdquo;.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {filteredTrending.map((c) => {
            const change = c.item.data?.price_change_percentage_24h?.usd;
            const positive = (change ?? 0) >= 0;
            const tint =
              change === undefined
                ? "rgba(255,255,255,0.02)"
                : positive
                  ? "rgba(34,197,94,0.07)"
                  : "rgba(239,68,68,0.07)";
            const tintBorder =
              change === undefined
                ? C.border
                : positive
                  ? "rgba(34,197,94,0.35)"
                  : "rgba(239,68,68,0.35)";
            return (
              <div
                key={c.item.id}
                style={{
                  background: `linear-gradient(180deg, ${tint}, transparent 80%), ${C.card}`,
                  border: `1px solid ${tintBorder}`,
                  borderRadius: 10,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>
                      {c.item.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: C.textMuted,
                        marginTop: 2,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {c.item.symbol}
                    </div>
                  </div>
                  {c.item.market_cap_rank !== null &&
                    c.item.market_cap_rank !== undefined && (
                      <span
                        style={{
                          background: C.card2,
                          border: `1px solid ${C.border}`,
                          color: C.textDim,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 999,
                          whiteSpace: "nowrap",
                        }}
                      >
                        #{c.item.market_cap_rank}
                      </span>
                    )}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  {change !== undefined ? (
                    <span
                      style={{
                        color: positive ? C.green : C.red,
                        fontSize: 22,
                        fontWeight: 800,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {positive ? "+" : ""}
                      {change.toFixed(2)}%
                    </span>
                  ) : (
                    <span style={{ color: C.textMuted, fontSize: 16 }}>—</span>
                  )}
                  <a
                    href={`https://www.coingecko.com/en/coins/${c.item.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open on CoinGecko"
                    style={{
                      color: C.textDim,
                      textDecoration: "none",
                      fontSize: 14,
                    }}
                  >
                    🔗
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Subhead>New hot pairs (DexScreener)</Subhead>
      {pairs === null ? (
        <LoadingBlock />
      ) : (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 70px 70px 70px 90px 90px 30px",
              padding: "10px 14px",
              borderBottom: `1px solid ${C.border}`,
              fontSize: 11,
              fontWeight: 700,
              color: C.textMuted,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              gap: 8,
            }}
          >
            <span>Pair</span>
            <span>Chain</span>
            <span>1h</span>
            <span>24h</span>
            <span style={{ textAlign: "right" }}>Liq</span>
            <span style={{ textAlign: "right" }}>Vol 24h</span>
            <span />
          </div>
          {pairs.map((p) => {
            const ageHr = p.pairCreatedAt
              ? (Date.now() - p.pairCreatedAt) / (1000 * 60 * 60)
              : null;
            const vol = p.volume?.h24 ?? 0;
            const fire = vol > 500_000 && ageHr !== null && ageHr < 24;
            const h1 = p.priceChange?.h1;
            const h24 = p.priceChange?.h24;
            const chain = chainBadge(p.chainId);
            const addr = p.baseToken.address ?? "";
            const tail = addr ? addr.slice(-6) : "";
            const isCopied = copied === addr;
            return (
              <div
                key={p.pairAddress}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 70px 70px 70px 90px 90px 30px",
                  padding: "10px 14px",
                  borderTop: `1px solid ${C.borderSoft}`,
                  fontSize: 13,
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    {p.baseToken.symbol}/{p.quoteToken.symbol}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: C.textMuted,
                      marginTop: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span style={{ flex: "0 1 auto", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.baseToken.name}
                    </span>
                    {tail && (
                      <button
                        onClick={() => copyAddress(addr)}
                        title={`Copy ${addr}`}
                        style={{
                          background: "transparent",
                          border: `1px solid ${C.border}`,
                          color: isCopied ? C.green : C.textDim,
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                          fontSize: 10.5,
                          padding: "1px 6px",
                          borderRadius: 4,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isCopied ? "copied ✓" : `…${tail}`}
                      </button>
                    )}
                    <span style={{ color: C.textMuted, fontSize: 10.5 }}>
                      ·{" "}
                      {ageHr === null
                        ? "?"
                        : ageHr < 24
                          ? `${ageHr.toFixed(0)}h`
                          : `${(ageHr / 24).toFixed(0)}d`}
                    </span>
                  </div>
                </span>
                <span>
                  <span
                    style={{
                      display: "inline-block",
                      background: chain.bg,
                      border: `1px solid ${chain.border}`,
                      color: chain.fg,
                      fontSize: 10.5,
                      fontWeight: 800,
                      letterSpacing: "0.04em",
                      padding: "2px 7px",
                      borderRadius: 4,
                    }}
                  >
                    {chain.label}
                  </span>
                </span>
                <ChangeCell value={h1} />
                <ChangeCell value={h24} />
                <span style={{ textAlign: "right", color: C.textDim, fontSize: 12 }}>
                  {p.liquidity?.usd ? `$${formatBigNum(p.liquidity.usd)}` : "—"}
                </span>
                <span style={{ textAlign: "right", color: C.textDim, fontSize: 12 }}>
                  ${formatBigNum(vol)}
                </span>
                <span style={{ textAlign: "center" }}>{fire ? "🔥" : ""}</span>
              </div>
            );
          })}
        </div>
      )}

      <Subhead>Top gainers (24h)</Subhead>
      {gainers === null ? (
        <LoadingBlock />
      ) : (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "32px 1fr 110px 80px 80px",
              padding: "10px 14px",
              borderBottom: `1px solid ${C.border}`,
              fontSize: 11,
              fontWeight: 700,
              color: C.textMuted,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <span>#</span>
            <span>Coin</span>
            <span style={{ textAlign: "right" }}>Price</span>
            <span style={{ textAlign: "right" }}>1h</span>
            <span style={{ textAlign: "right" }}>24h</span>
          </div>
          {gainers.map((c) => {
            const h1 = c.price_change_percentage_1h_in_currency;
            const h24 =
              c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h;
            return (
              <div
                key={c.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px 1fr 110px 80px 80px",
                  padding: "10px 14px",
                  borderTop: `1px solid ${C.borderSoft}`,
                  fontSize: 13,
                  alignItems: "center",
                }}
              >
                <span style={{ color: C.textMuted, fontSize: 12 }}>
                  {c.market_cap_rank ?? "—"}
                </span>
                <span>
                  <span style={{ fontWeight: 600 }}>{c.name}</span>{" "}
                  <span
                    style={{
                      color: C.textMuted,
                      textTransform: "uppercase",
                      fontSize: 11,
                    }}
                  >
                    {c.symbol}
                  </span>
                </span>
                <span style={{ textAlign: "right", color: C.textDim }}>
                  ${formatPrice(c.current_price)}
                </span>
                <ChangeCell value={h1} alignRight />
                <ChangeCell value={h24} alignRight />
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{
          textAlign: "right",
          color: C.textMuted,
          fontSize: 11,
          marginBottom: 4,
        }}
      >
        Last updated{" "}
        {updatedAt
          ? new Date(updatedAt).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
            })
          : "—"}
      </div>
    </section>
  );
}

function ChangeCell({ value, alignRight }: { value: number | null | undefined; alignRight?: boolean }) {
  if (value === null || value === undefined) {
    return (
      <span style={{ color: C.textMuted, fontSize: 12, textAlign: alignRight ? "right" : "left" }}>
        —
      </span>
    );
  }
  const positive = value >= 0;
  return (
    <span
      style={{
        color: positive ? C.green : C.red,
        fontSize: 12,
        fontWeight: 600,
        textAlign: alignRight ? "right" : "left",
      }}
    >
      {positive ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

function formatBigNum(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}
function formatPrice(n: number): string {
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 0.01) return n.toFixed(4);
  return n.toExponential(2);
}

// ───────────────────────── odds tab ─────────────────────────
interface OddsOutcome {
  name: string;
  price: number;
}
interface OddsMarket {
  key: string;
  outcomes: OddsOutcome[];
}
interface OddsBookmaker {
  key: string;
  title: string;
  last_update?: string;
  markets: OddsMarket[];
}
interface OddsGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

// Countdown-based time pills. Each pill is an upper bound on time-until-start
// (live games count for every bucket since they're more imminent than upcoming).
type TimePillKey = "soon" | "today" | "week" | "all";
const TIME_PILLS: { label: string; key: TimePillKey }[] = [
  { label: "Starting Soon <1h", key: "soon" },
  { label: "Today", key: "today" },
  { label: "This Week", key: "week" },
  { label: "All", key: "all" },
];

const TIME_PILL_MS: Record<TimePillKey, number> = {
  soon: 60 * 60 * 1000,
  today: 24 * 3600 * 1000,
  week: 7 * 24 * 3600 * 1000,
  all: Infinity,
};

// Value rating A/B/C/D based on the bookmaker's vig (overround - 1).
// A = sharp book, D = heavy juice.
function valueRating(overround: number | null): { grade: string; color: string; label: string } | null {
  if (overround === null || !Number.isFinite(overround)) return null;
  const edgePct = (overround - 1) * 100;
  if (edgePct <= 2) return { grade: "A", color: "#22c55e", label: "Sharp book — close to fair odds" };
  if (edgePct <= 4) return { grade: "B", color: "#84cc16", label: "Good value" };
  if (edgePct <= 6) return { grade: "C", color: "#f59e0b", label: "Average vig" };
  return { grade: "D", color: "#ef4444", label: "Heavy bookmaker edge" };
}

// Risk tier for a game based on how lopsided the favourite is, expressed as
// the implied-probability gap. LOW = even matchup, HIGH = heavy favourite.
function riskLevelForOdds(
  home: BestOdds | null,
  away: BestOdds | null,
): { tier: "low" | "medium" | "high"; label: string; color: string; note: string } | null {
  if (!home || !away) return null;
  const pH = americanToImpliedProb(home.price);
  const pA = americanToImpliedProb(away.price);
  const gap = Math.abs(pH - pA);
  if (gap < 0.15) return { tier: "low", label: "LOW RISK", color: "#22c55e", note: "Even matchup — outcome is hard to predict" };
  if (gap < 0.35) return { tier: "medium", label: "MEDIUM RISK", color: "#f59e0b", note: "Clear favourite — moderate edge" };
  return { tier: "high", label: "HIGH RISK", color: "#ef4444", note: "Heavy favourite — big swings on either side" };
}

interface BestOdds {
  team: string;
  price: number;
  book: string;
}

function bestPriceForTeam(game: OddsGame, team: string): BestOdds | null {
  let best: BestOdds | null = null;
  for (const b of game.bookmakers ?? []) {
    const h2h = b.markets?.find((m) => m.key === "h2h");
    if (!h2h) continue;
    for (const o of h2h.outcomes) {
      if (o.name !== team) continue;
      if (best === null || o.price > best.price) {
        best = { team: o.name, price: o.price, book: b.title };
      }
    }
  }
  return best;
}

function fanduelPriceForTeam(game: OddsGame, team: string): BestOdds | null {
  const fd = (game.bookmakers ?? []).find((b) => (b.key ?? "").toLowerCase() === "fanduel");
  if (!fd) return null;
  const h2h = fd.markets?.find((m) => m.key === "h2h");
  if (!h2h) return null;
  const o = h2h.outcomes.find((o) => o.name === team);
  if (!o) return null;
  return { team: o.name, price: o.price, book: fd.title };
}

// Average implied probability across every book that prices this team. Used
// to gauge whether a single book is offering above- or below-market value.
function avgImpliedForTeam(game: OddsGame, team: string): number | null {
  const probs: number[] = [];
  for (const b of game.bookmakers ?? []) {
    const h2h = b.markets?.find((m) => m.key === "h2h");
    if (!h2h) continue;
    const o = h2h.outcomes.find((o) => o.name === team);
    if (!o) continue;
    probs.push(americanToImpliedProb(o.price));
  }
  if (probs.length === 0) return null;
  return probs.reduce((s, p) => s + p, 0) / probs.length;
}

function americanToImpliedProb(odds: number): number {
  return odds > 0 ? 100 / (odds + 100) : -odds / (-odds + 100);
}

interface ArbStakes {
  stakeA: number;
  stakeB: number;
  totalStake: number;
  profit: number;
}

function calcArbStakes(oddsA: number, oddsB: number, targetProfit = 100): ArbStakes | null {
  const pA = americanToImpliedProb(oddsA);
  const pB = americanToImpliedProb(oddsB);
  const overround = pA + pB;
  if (overround >= 1) return null;
  const totalPayout = targetProfit / (1 - overround);
  const stakeA = totalPayout * pA;
  const stakeB = totalPayout * pB;
  return {
    stakeA,
    stakeB,
    totalStake: stakeA + stakeB,
    profit: totalPayout - (stakeA + stakeB),
  };
}

function sportIcon(sportKey: string): string {
  if (sportKey.startsWith("soccer_")) return "⚽";
  if (sportKey.includes("basketball")) return "🏀";
  if (sportKey.includes("baseball")) return "⚾";
  if (sportKey.includes("icehockey")) return "🏒";
  if (sportKey.includes("mma")) return "🥊";
  if (sportKey.includes("americanfootball")) return "🏈";
  if (sportKey.includes("tennis")) return "🎾";
  if (sportKey.includes("golf")) return "⛳";
  return "🎯";
}

function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function countdownLabel(commenceISO: string, nowMs: number): { label: string; live: boolean } {
  const start = new Date(commenceISO).getTime();
  if (!Number.isFinite(start)) return { label: "", live: false };
  const diff = start - nowMs;
  if (diff <= 0) {
    const elapsed = -diff;
    if (elapsed < 3 * 60 * 60 * 1000) return { label: "Live", live: true };
    return { label: `Started ${formatDuration(elapsed)} ago`, live: false };
  }
  return { label: `Starts in ${formatDuration(diff)}`, live: false };
}

export function OddsTab() {
  const [oddsTab, setOddsTab] = useState<"fanduel" | "polymarket">("fanduel");

  return (
    <section>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
        {[
          { id: "fanduel", label: "📊 FanDuel" },
          { id: "polymarket", label: "🎲 Polymarket / Kalshi" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setOddsTab(t.id as "fanduel" | "polymarket")}
            style={{
              padding: "10px 20px",
              border: "none",
              background: "transparent",
              color: oddsTab === t.id ? "#fff" : "#6b7280",
              fontSize: 13,
              fontWeight: oddsTab === t.id ? 700 : 500,
              borderBottom: oddsTab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {oddsTab === "fanduel" ? <FanduelPanel /> : <PredictionMarketsPanel />}
    </section>
  );
}

function FanduelPanel() {
  const [games, setGames] = useState<OddsGame[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestsRemaining, setRequestsRemaining] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState<TimePillKey>("today");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/odds?sport=upcoming&daysFrom=30`);
      const body = await res.json();
      if (!res.ok) {
        setError((body as { error?: string }).error ?? `Error (${res.status})`);
        setGames([]);
        return;
      }
      setGames((body.games as OddsGame[]) ?? []);
      setRequestsRemaining((body.requestsRemaining as string | null) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // FanDuel-only decorations. Games without FanDuel odds are dropped.
  const decorated = useMemo(() => {
    if (!games) return [];
    const rows = [];
    for (const g of games) {
      const home = fanduelPriceForTeam(g, g.home_team);
      const away = fanduelPriceForTeam(g, g.away_team);
      if (!home || !away) continue;
      const start = new Date(g.commence_time).getTime();
      rows.push({ g, home, away, start });
    }
    return rows;
  }, [games]);

  const sorted = useMemo(() => {
    const cutoff = TIME_PILL_MS[timeWindow] === Infinity ? Infinity : nowMs + TIME_PILL_MS[timeWindow];
    return decorated
      .filter((d) => d.start <= cutoff)
      .sort((a, b) => a.start - b.start);
  }, [decorated, timeWindow, nowMs]);

  const refresh = () => load();

  return (
    <>
      <SectionTitle
        title="FanDuel Odds"
        subtitle="Live FanDuel lines · compared to market average for value"
        right={
          <button
            onClick={refresh}
            disabled={loading}
            style={{
              background: loading ? C.card2 : C.accent,
              color: loading ? C.textDim : "#fff",
              border: `1px solid ${loading ? C.border : C.accent}`,
              borderRadius: 999,
              padding: "4px 12px",
              fontSize: 11.5,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: "0.02em",
            }}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      <ArbCalculator />

      {error && <ErrorBox>{error}</ErrorBox>}

      <Subhead>Games</Subhead>

      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
        <strong style={{ color: C.text }}>{sorted.length}</strong> FanDuel {sorted.length === 1 ? "game" : "games"} available
        {" · "}
        <strong style={{ color: C.text }}>{requestsRemaining ?? "—"}</strong> API calls left
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {TIME_PILLS.map((f) => {
          const active = timeWindow === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setTimeWindow(f.key)}
              style={{
                background: active ? C.accent : C.card2,
                color: active ? "#fff" : C.text,
                border: `1px solid ${active ? C.accent : C.border}`,
                borderRadius: 999,
                padding: "5px 12px",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {games === null ? (
        <LoadingBlock />
      ) : sorted.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, color: C.textMuted, fontSize: 13 }}>
          {loading ? "Loading FanDuel lines…" : "No FanDuel games in this window."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map(({ g, home, away }) => (
            <GameCard
              key={g.id}
              game={g}
              home={home}
              away={away}
              isArb={false}
              expanded={expandedId === g.id}
              onToggle={() => setExpandedId((cur) => (cur === g.id ? null : g.id))}
              nowMs={nowMs}
              fanduelOnly
            />
          ))}
        </div>
      )}
    </>
  );
}

// ───────────────────────── prediction markets ─────────────────────────

type PolyMarket = {
  id?: string;
  question?: string;
  outcomes?: string; // JSON-stringified ["Yes","No"]
  outcomePrices?: string; // JSON-stringified ["0.67","0.33"]
  volume?: string | number;
  category?: string;
  slug?: string;
};

type KalshiMarket = {
  ticker?: string;
  title?: string;
  category?: string;
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  volume?: number;
};

type NormalizedMarket = {
  source: "polymarket" | "kalshi";
  id: string;
  question: string;
  yesPct: number; // 0-100
  noPct: number;  // 0-100
  volume: number;
  category: string;
  url: string;
};

function safeParseJson<T>(s: unknown): T | null {
  if (typeof s !== "string") return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}

function normalizePolymarket(m: PolyMarket): NormalizedMarket | null {
  const prices = safeParseJson<string[]>(m.outcomePrices);
  const outcomes = safeParseJson<string[]>(m.outcomes);
  if (!prices || prices.length !== 2 || !outcomes || outcomes.length !== 2) return null;
  const yes = parseFloat(prices[0]);
  const no = parseFloat(prices[1]);
  if (!Number.isFinite(yes) || !Number.isFinite(no)) return null;
  const vol = typeof m.volume === "number" ? m.volume : parseFloat(String(m.volume ?? "0")) || 0;
  return {
    source: "polymarket",
    id: m.id ?? m.slug ?? m.question ?? Math.random().toString(36).slice(2),
    question: m.question ?? "Unknown market",
    yesPct: yes * 100,
    noPct: no * 100,
    volume: vol,
    category: m.category || "Other",
    url: m.slug ? `https://polymarket.com/event/${m.slug}` : "https://polymarket.com",
  };
}

function normalizeKalshi(m: KalshiMarket): NormalizedMarket | null {
  // Use the midpoint of bid/ask in cents → fraction.
  const yesMid = (Number(m.yes_bid ?? NaN) + Number(m.yes_ask ?? NaN)) / 2;
  if (!Number.isFinite(yesMid)) return null;
  const yesPct = Math.max(0, Math.min(100, yesMid));
  return {
    source: "kalshi",
    id: m.ticker ?? Math.random().toString(36).slice(2),
    question: m.title ?? "Unknown market",
    yesPct,
    noPct: 100 - yesPct,
    volume: Number(m.volume ?? 0) || 0,
    category: m.category || "Other",
    url: m.ticker ? `https://kalshi.com/markets/${encodeURIComponent(m.ticker)}` : "https://kalshi.com",
  };
}

const CATEGORY_PILLS = ["All", "Sports", "Politics", "Crypto", "Finance", "World"];

function PredictionMarketsPanel() {
  const [subTab, setSubTab] = useState<"polymarket" | "kalshi">("polymarket");
  const [poly, setPoly] = useState<NormalizedMarket[] | null>(null);
  const [kalshi, setKalshi] = useState<NormalizedMarket[] | null>(null);
  const [kalshiError, setKalshiError] = useState<string | null>(null);
  const [polyError, setPolyError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch("/api/polymarket").then((r) => r.json()).catch((e) => ({ error: String(e) })),
      fetch("/api/kalshi").then((r) => r.json()).catch((e) => ({ error: String(e), markets: [] })),
    ]).then(([p, k]) => {
      if (cancelled) return;
      if (p?.error) setPolyError(p.error);
      else setPoly((p?.markets as PolyMarket[] ?? []).map(normalizePolymarket).filter((x): x is NormalizedMarket => x !== null).sort((a, b) => b.volume - a.volume));
      if (k?.error) setKalshiError(k.error);
      const kNorm = (k?.markets as KalshiMarket[] ?? []).map(normalizeKalshi).filter((x): x is NormalizedMarket => x !== null).sort((a, b) => b.volume - a.volume);
      setKalshi(kNorm);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const showKalshiFallback = subTab === "kalshi" && (kalshiError !== null || (kalshi !== null && kalshi.length === 0));
  const active: NormalizedMarket[] | null = subTab === "polymarket" || showKalshiFallback ? poly : kalshi;
  const sourceLabel = subTab === "kalshi" && showKalshiFallback ? "Kalshi requires login — showing Polymarket data" : null;

  const filtered = useMemo(() => {
    if (!active) return [];
    if (category === "All") return active;
    const needle = category.toLowerCase();
    return active.filter((m) => m.category.toLowerCase().includes(needle));
  }, [active, category]);

  return (
    <>
      <SectionTitle
        title="Prediction Markets"
        subtitle="Real-money markets pricing the probability of real-world events"
      />

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { id: "polymarket", label: "Polymarket" },
          { id: "kalshi", label: "Kalshi" },
        ].map((t) => {
          const isActive = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id as "polymarket" | "kalshi")}
              style={{
                padding: "5px 14px",
                borderRadius: 999,
                border: `1px solid ${isActive ? C.accent : C.border}`,
                background: isActive ? C.accent : C.card2,
                color: isActive ? "#fff" : C.text,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {sourceLabel && (
        <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", color: C.amber, borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>
          ⚠️ {sourceLabel}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {CATEGORY_PILLS.map((c) => {
          const isActive = category === c;
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                border: `1px solid ${isActive ? C.accent : C.border}`,
                background: isActive ? C.accent : C.card2,
                color: isActive ? "#fff" : C.text,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : (subTab === "polymarket" && polyError) ? (
        <ErrorBox>Polymarket failed: {polyError}</ErrorBox>
      ) : filtered.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, color: C.textMuted, fontSize: 13 }}>
          No markets in this category right now.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))", gap: 12 }}>
          {filtered.map((m) => <PredictionMarketCard key={m.source + ":" + m.id} m={m}/>)}
        </div>
      )}
    </>
  );
}

function PredictionMarketCard({ m }: { m: NormalizedMarket }) {
  const yesColor = m.yesPct >= 50 ? C.green : C.red;
  const noColor = m.noPct >= 50 ? C.green : C.red;
  const fmtVol = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  };
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: C.text, lineHeight: 1.35, flex: 1, minWidth: 0 }}>{m.question}</div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "rgba(99,102,241,0.18)", color: "#a5b4fc", whiteSpace: "nowrap", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {m.category}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>YES</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: yesColor, marginTop: 2 }}>{m.yesPct.toFixed(0)}¢</div>
        </div>
        <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>NO</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: noColor, marginTop: 2 }}>{m.noPct.toFixed(0)}¢</div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: C.textDim }}>
        The market thinks there&apos;s a <strong style={{ color: yesColor }}>{m.yesPct.toFixed(0)}%</strong> chance of YES
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10.5, color: C.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
          <span>Total bet</span>
          <span style={{ color: C.text }}>{fmtVol(m.volume)}</span>
        </div>
        <div style={{ height: 5, background: C.card2, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, Math.log10(Math.max(1, m.volume)) * 14)}%`, background: "linear-gradient(90deg, #6366f1, #a5b4fc)" }}/>
        </div>
      </div>

      <a
        href={m.url}
        target="_blank"
        rel="noreferrer"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: "9px 14px", borderRadius: 8,
          background: C.green, color: "#fff",
          fontSize: 13, fontWeight: 700, textDecoration: "none",
        }}
      >
        Bet YES on {m.source === "polymarket" ? "Polymarket" : "Kalshi"} →
      </a>
    </div>
  );
}

// ───────────────────────── arb math helpers ─────────────────────────

// American odds → multiplier on stake to compute payout (stake + profit).
function americanPayoutMultiplier(odds: number): number {
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / -odds;
}

// Stake needed at these odds to win exactly $100 profit.
function stakeToWin100(odds: number): number {
  return odds > 0 ? 10000 / odds : -odds;
}

// "+150 means you'd win $150 on a $100 bet" / "-120 means you'd risk $120 to win $100"
function americanOddsPlainEnglish(odds: number): string {
  if (!Number.isFinite(odds)) return "";
  if (odds > 0) return `Bet $100 → win $${odds.toFixed(0)}`;
  return `Bet $${(-odds).toFixed(0)} → win $100`;
}

function ArbCalculator() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [stakeInput, setStakeInput] = useState("1000");

  const totalStake = Math.max(0, parseFloat(stakeInput) || 0);
  const oa = parseFloat(a);
  const ob = parseFloat(b);
  const aValid = Number.isFinite(oa);
  const bValid = Number.isFinite(ob);

  const result = useMemo(() => {
    if (!aValid || !bValid) return null;
    const pA = americanToImpliedProb(oa);
    const pB = americanToImpliedProb(ob);
    const overround = pA + pB;
    if (overround >= 1 || totalStake <= 0) {
      return { arb: false as const, pA, pB, overround };
    }
    const betA = (totalStake * pA) / overround;
    const betB = (totalStake * pB) / overround;
    const payoutA = betA * americanPayoutMultiplier(oa);
    const payoutB = betB * americanPayoutMultiplier(ob);
    const profit = Math.min(payoutA, payoutB) - totalStake;
    const roi = (profit / totalStake) * 100;
    return { arb: true as const, betA, betB, payoutA, payoutB, profit, roi, totalStake, pA, pB, overround };
  }, [aValid, bValid, oa, ob, totalStake]);

  const inputStyle = {
    width: "100%",
    background: C.card2,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "9px 12px",
    color: C.text,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  };
  const labelStyle = { display: "block", fontSize: 12, color: C.textDim, marginBottom: 4, fontWeight: 600 } as const;
  const hintStyle = { fontSize: 11, color: C.textMuted, marginTop: 4 } as const;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 18 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 2 }}>
        💰 Find Your Guaranteed Profit
      </div>
      <div style={{ fontSize: 12.5, color: C.textDim, marginBottom: 14 }}>
        Enter odds from two different bookmakers on the same game.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Team A odds (e.g. +150)</label>
          <input type="number" value={a} onChange={(e) => setA(e.target.value)} placeholder="+150" style={inputStyle}/>
          {aValid && (
            <div style={hintStyle}>
              If you bet $100, you win ${oa > 0 ? oa.toFixed(0) : (10000 / Math.abs(oa)).toFixed(0)}
            </div>
          )}
        </div>
        <div>
          <label style={labelStyle}>Team B odds (e.g. +120)</label>
          <input type="number" value={b} onChange={(e) => setB(e.target.value)} placeholder="+120" style={inputStyle}/>
          {bValid && (
            <div style={hintStyle}>
              If you bet $100, you win ${ob > 0 ? ob.toFixed(0) : (10000 / Math.abs(ob)).toFixed(0)}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <label style={{ fontSize: 12.5, color: C.textDim, fontWeight: 600 }}>Total amount you want to bet: $</label>
        <input
          type="number"
          value={stakeInput}
          onChange={(e) => setStakeInput(e.target.value)}
          placeholder="1000"
          style={{ ...inputStyle, width: 130, padding: "6px 10px", fontSize: 13 }}
        />
      </div>

      {result === null ? (
        <div style={{ background: C.card2, border: `1px dashed ${C.border}`, borderRadius: 10, padding: "14px 16px", color: C.textMuted, fontSize: 13 }}>
          Enter both teams' odds above to see if there's a guaranteed profit.
        </div>
      ) : !result.arb ? (
        (() => {
          const edge = (result.overround - 1) * 100;
          const favSide = result.pA > result.pB ? "A" : "B";
          const favOdds = favSide === "A" ? oa : ob;
          return (
            <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", color: C.textDim, fontSize: 13, lineHeight: 1.75 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>
                No guaranteed profit on these odds
              </div>
              {totalStake <= 0 ? (
                <div>Enter a stake amount above $0.</div>
              ) : (
                <>
                  <div>The bookmaker edge is <strong style={{ color: C.amber }}>{edge.toFixed(2)}%</strong> (they have the advantage).</div>
                  <div>
                    Implied probability: A=<strong style={{ color: C.text }}>{(result.pA * 100).toFixed(1)}%</strong> + B=<strong style={{ color: C.text }}>{(result.pB * 100).toFixed(1)}%</strong> = <strong style={{ color: C.text }}>{(result.overround * 100).toFixed(1)}%</strong> total (needs to be under 100% for arb)
                  </div>
                  <div style={{ marginTop: 6 }}>
                    💡 Tip: Try finding better odds on Team {favSide} ({favOdds > 0 ? "+" : ""}{favOdds}) at a different bookmaker.
                  </div>
                </>
              )}
            </div>
          );
        })()
      ) : (
        <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.4)", borderRadius: 10, padding: "16px 18px", color: C.text, fontSize: 13.5, lineHeight: 1.75 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.green, marginBottom: 6, letterSpacing: "0.04em" }}>
            🎯 GUARANTEED PROFIT FOUND!
          </div>
          <div style={{ borderTop: `1px solid rgba(34,197,94,0.3)`, margin: "8px 0" }}/>
          <div>
            Bet <strong style={{ color: C.green }}>${result.betA.toFixed(2)}</strong> on Team A → You win <strong style={{ color: C.text }}>${result.payoutA.toFixed(2)}</strong> no matter what
          </div>
          <div>
            Bet <strong style={{ color: C.green }}>${result.betB.toFixed(2)}</strong> on Team B → You win <strong style={{ color: C.text }}>${result.payoutB.toFixed(2)}</strong> no matter what
          </div>
          <div style={{ borderTop: `1px solid rgba(34,197,94,0.3)`, margin: "8px 0" }}/>
          <div>💰 Profit: <strong style={{ color: C.green }}>+${result.profit.toFixed(2)}</strong> guaranteed</div>
          <div>📊 Return: <strong style={{ color: C.green }}>+{result.roi.toFixed(2)}%</strong> on your ${result.totalStake.toLocaleString()}</div>
          <div>⚡ Risk: <strong style={{ color: C.green }}>ZERO</strong> <span style={{ color: C.textDim }}>(both sides covered)</span></div>
        </div>
      )}
    </div>
  );
}

function GameCard({
  game,
  home,
  away,
  isArb,
  expanded,
  onToggle,
  nowMs,
  fanduelOnly,
}: {
  game: OddsGame;
  home: BestOdds | null;
  away: BestOdds | null;
  isArb: boolean;
  expanded: boolean;
  onToggle: () => void;
  nowMs: number;
  fanduelOnly?: boolean;
}) {
  const arb = isArb && home && away ? calcArbStakes(home.price, away.price, 1000) : null;
  const start = new Date(game.commence_time);
  const cd = countdownLabel(game.commence_time, nowMs);
  const risk = riskLevelForOdds(home, away);

  const overround = home && away
    ? americanToImpliedProb(home.price) + americanToImpliedProb(away.price)
    : null;
  const edgePct = overround !== null ? (overround - 1) * 100 : null;
  const rating = valueRating(overround);
  const pAway = away ? americanToImpliedProb(away.price) : null;
  const pHome = home ? americanToImpliedProb(home.price) : null;
  const fmtOdds = (n: number) => `${n > 0 ? "+" : ""}${n}`;

  // FanDuel value vs market average. Lower implied prob at FanDuel = better
  // value (longer payout) than the average book on this team.
  const avgAway = fanduelOnly ? avgImpliedForTeam(game, game.away_team) : null;
  const avgHome = fanduelOnly ? avgImpliedForTeam(game, game.home_team) : null;
  const valueChip = (fdProb: number | null, avg: number | null) => {
    if (fdProb === null || avg === null) return null;
    const diff = avg - fdProb;
    if (diff > 0.005) return { label: "✓ Good value", color: C.green };
    if (diff < -0.005) return { label: "↓ Below average", color: C.textMuted };
    return { label: "Market average", color: C.textDim };
  };
  const awayValue = valueChip(pAway, avgAway);
  const homeValue = valueChip(pHome, avgHome);

  // All bookmaker rows for expanded view
  const bookRows = useMemo(() => {
    const rows: { book: string; awayPrice: number | null; homePrice: number | null }[] = [];
    for (const b of game.bookmakers ?? []) {
      const h2h = b.markets?.find((m) => m.key === "h2h");
      if (!h2h) continue;
      const aw = h2h.outcomes.find((o) => o.name === game.away_team)?.price ?? null;
      const ho = h2h.outcomes.find((o) => o.name === game.home_team)?.price ?? null;
      rows.push({ book: b.title, awayPrice: aw, homePrice: ho });
    }
    return rows;
  }, [game]);

  return (
    <div
      onClick={onToggle}
      style={{
        background: C.card,
        border: `1px solid ${isArb ? C.green : C.border}`,
        borderRadius: 12,
        padding: 16,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 16 }}>{sportIcon(game.sport_key)}</span>
        <span
          style={{
            fontSize: 11,
            color: C.textMuted,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {game.sport_title}
        </span>
        <span style={{ color: C.textMuted, fontSize: 12 }}>·</span>
        <span style={{ fontSize: 12, color: C.textDim }}>
          {start.toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
        {cd.label && (
          cd.live ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: C.red, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              <span
                className="nexyru-pulse"
                style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: C.red }}
              />
              LIVE
            </span>
          ) : (
            <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>
              · {cd.label}
            </span>
          )
        )}
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>
          {risk && (
            <span
              title={risk.note}
              style={{
                background: `${risk.color}22`,
                border: `1px solid ${risk.color}66`,
                color: risk.color,
                padding: "2px 10px",
                borderRadius: 999,
                fontSize: 10.5,
                fontWeight: 800,
                letterSpacing: "0.04em",
              }}
            >
              {risk.label}
            </span>
          )}
          {isArb && (
            <span
              style={{
                background: "rgba(34,197,94,0.15)",
                border: `1px solid ${C.green}`,
                color: C.green,
                padding: "2px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.04em",
              }}
            >
              ARB ✓
            </span>
          )}
          <span style={{ color: C.textMuted, fontSize: 11 }}>
            {expanded ? "▲" : "▼"}
          </span>
        </span>
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 10 }}>
        {game.away_team} <span style={{ color: C.textMuted, fontWeight: 500 }}>vs</span> {game.home_team}
      </div>

      {(home || away) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, lineHeight: 1.5, color: C.textDim }}>
          {away && home && (
            <div>
              📊 <span style={{ color: C.textMuted }}>{fanduelOnly ? "FanDuel:" : "Best odds:"}</span>{" "}
              <strong style={{ color: C.green }}>{game.away_team} {fmtOdds(away.price)}</strong>
              {!fanduelOnly && <span style={{ color: C.textMuted }}> ({away.book})</span>}
              {" vs "}
              <strong style={{ color: C.green }}>{game.home_team} {fmtOdds(home.price)}</strong>
              {!fanduelOnly && <span style={{ color: C.textMuted }}> ({home.book})</span>}
            </div>
          )}
          {pAway !== null && pHome !== null && (
            <div>
              💰 <span style={{ color: C.textMuted }}>Implied chance:</span>{" "}
              {game.away_team} has <strong style={{ color: C.text }}>{(pAway * 100).toFixed(0)}%</strong> likely · {game.home_team} has <strong style={{ color: C.text }}>{(pHome * 100).toFixed(0)}%</strong> likely
            </div>
          )}
          {fanduelOnly && (awayValue || homeValue) && (
            <div>
              ⚡ <span style={{ color: C.textMuted }}>Value vs market:</span>{" "}
              {awayValue && (
                <span style={{ color: awayValue.color, fontWeight: 600 }}>{game.away_team}: {awayValue.label}</span>
              )}
              {awayValue && homeValue && <span style={{ color: C.textMuted }}> · </span>}
              {homeValue && (
                <span style={{ color: homeValue.color, fontWeight: 600 }}>{game.home_team}: {homeValue.label}</span>
              )}
            </div>
          )}
          {!fanduelOnly && edgePct !== null && rating && (
            <div>
              ⚡ <span style={{ color: C.textMuted }}>Bookmaker edge:</span>{" "}
              <strong style={{ color: edgePct <= 0 ? C.green : edgePct <= 4 ? C.text : C.amber }}>{edgePct.toFixed(2)}%</strong>{" "}
              <span style={{ color: C.textMuted }}>(lower = closer to fair odds)</span>
              {" · "}
              <span title={rating.label} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: C.textMuted }}>Value:</span>{" "}
                <strong style={{ color: rating.color, fontSize: 13 }}>{rating.grade}</strong>
              </span>
            </div>
          )}
          {risk && (
            <div style={{ fontSize: 11, color: C.textMuted }}>{risk.note}</div>
          )}
        </div>
      )}

      {arb && (
        <div style={{ marginTop: 12, background: "rgba(34,197,94,0.1)", border: `1px solid ${C.green}`, borderRadius: 10, padding: "12px 14px", fontSize: 13, lineHeight: 1.65, color: C.text }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: C.green, marginBottom: 6, letterSpacing: "0.03em" }}>
            🎯 ARB OPPORTUNITY — Guaranteed profit!
          </div>
          <div>
            Bet <strong style={{ color: C.green }}>${arb.stakeA.toFixed(2)}</strong> on {away?.team} at <strong style={{ color: C.text }}>{away?.book}</strong>{" + "}
            <strong style={{ color: C.green }}>${arb.stakeB.toFixed(2)}</strong> on {home?.team} at <strong style={{ color: C.text }}>{home?.book}</strong>
          </div>
          <div style={{ marginTop: 4 }}>
            = <strong style={{ color: C.green }}>${arb.profit.toFixed(2)} profit guaranteed</strong> on ${arb.totalStake.toLocaleString(undefined, { maximumFractionDigits: 0 })} total stake
          </div>
          <div>
            = <strong style={{ color: C.green }}>{((arb.profit / arb.totalStake) * 100).toFixed(2)}% return</strong>
            {" · "}
            <strong style={{ color: C.green }}>ZERO risk</strong>
          </div>
        </div>
      )}

      {expanded && bookRows.length > 0 && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              padding: "6px 0",
              fontSize: 10.5,
              fontWeight: 700,
              color: C.textMuted,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              borderBottom: `1px solid ${C.borderSoft}`,
              marginBottom: 4,
            }}
          >
            <span>Bookmaker</span>
            <span style={{ textAlign: "right" }}>{game.away_team}</span>
            <span style={{ textAlign: "right" }}>{game.home_team}</span>
          </div>
          {bookRows.map((r) => {
            const bestAway =
              away !== null && r.awayPrice !== null && r.awayPrice === away.price;
            const bestHome =
              home !== null && r.homePrice !== null && r.homePrice === home.price;
            // Row contributes to a cross-book arb when it carries the best
            // price for one team and the game has an arb overall.
            const rowInArb = isArb && (bestAway || bestHome);
            return (
              <div
                key={r.book}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  padding: "5px 8px",
                  margin: "0 -8px",
                  borderRadius: 6,
                  background: rowInArb ? "rgba(34,197,94,0.08)" : "transparent",
                  fontSize: 12.5,
                  color: C.textDim,
                  alignItems: "center",
                }}
              >
                <span style={{ color: C.text }}>{r.book}</span>
                <span
                  style={{
                    textAlign: "right",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    color: r.awayPrice === null ? C.textMuted : bestAway ? C.green : C.textDim,
                    fontWeight: bestAway ? 700 : 500,
                  }}
                >
                  {r.awayPrice === null
                    ? "—"
                    : `${r.awayPrice > 0 ? "+" : ""}${r.awayPrice}`}
                </span>
                <span
                  style={{
                    textAlign: "right",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    color: r.homePrice === null ? C.textMuted : bestHome ? C.green : C.textDim,
                    fontWeight: bestHome ? 700 : 500,
                  }}
                >
                  {r.homePrice === null
                    ? "—"
                    : `${r.homePrice > 0 ? "+" : ""}${r.homePrice}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── shared bits ─────────────────────────
function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ margin: "4px 0 0", color: C.textDim, fontSize: 13 }}>{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

function Subhead({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: C.textMuted,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        margin: "16px 0 10px",
      }}
    >
      {children}
    </div>
  );
}

function LoadingBlock() {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        color: C.textMuted,
        fontSize: 13,
        marginBottom: 16,
      }}
    >
      <Spinner />
      Loading...
    </div>
  );
}

function Spinner({ small }: { small?: boolean } = {}) {
  const size = small ? 12 : 16;
  return (
    <span
      className="nexyru-spin"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid ${C.textMuted}`,
        borderTopColor: "transparent",
        borderRadius: "50%",
      }}
    />
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.25)",
        color: "#fca5a5",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 13,
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}
