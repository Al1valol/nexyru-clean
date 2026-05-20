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

function americanToImpliedProb(odds: number): number {
  return odds > 0 ? 100 / (odds + 100) : -odds / (-odds + 100);
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

type OddsTabKey = "best" | "arb" | "parlays";

type ParlayLeg = {
  gameId: string;
  sport: string;
  teamName: string;
  odds: number;
  book: string;
  gameTime: string;
};

// Combined American odds from a list of legs. Each leg's American odds are
// converted to decimal, multiplied, then converted back. Returns null when
// fewer than 2 legs.
function calcParlay(legs: ParlayLeg[], stake: number) {
  if (legs.length < 2) return null;
  const decimalOdds = legs.map((leg) =>
    leg.odds > 0 ? leg.odds / 100 + 1 : 100 / Math.abs(leg.odds) + 1,
  );
  const combinedDecimal = decimalOdds.reduce((p, o) => p * o, 1);
  const combinedAmerican = combinedDecimal >= 2
    ? Math.round((combinedDecimal - 1) * 100)
    : Math.round(-100 / (combinedDecimal - 1));
  const payout = stake * combinedDecimal;
  const profit = payout - stake;
  return { combinedDecimal, combinedAmerican, payout, profit };
}

// Shared raw-odds cache used by OddsTab and app/arb/page.tsx so navigating
// between the two doesn't trigger a duplicate /api/odds fan-out.
const ODDS_CACHE_KEY = "nexyru_odds_raw_cache_v1";
const ODDS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export function OddsTab() {
  const [oddsTab, setOddsTab] = useState<OddsTabKey>("best");
  const [games, setGames] = useState<OddsGame[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestsRemaining, setRequestsRemaining] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [parlayLegs, setParlayLegs] = useState<ParlayLeg[]>([]);
  const [parlayStake, setParlayStake] = useState<string>("100");

  // Toggle a leg: same team → remove, different team for same game → replace,
  // new game → append. Both sides of one game can't be in the parlay.
  const addToParlay = useCallback((leg: ParlayLeg) => {
    setParlayLegs((prev) => {
      const isSame = prev.some((l) => l.gameId === leg.gameId && l.teamName === leg.teamName);
      const filtered = prev.filter((l) => l.gameId !== leg.gameId);
      return isSame ? filtered : [...filtered, leg];
    });
  }, []);
  const isInParlay = useCallback(
    (gameId: string, teamName: string) => parlayLegs.some((l) => l.gameId === gameId && l.teamName === teamName),
    [parlayLegs],
  );

  // Single fetch shared across Best Picks / Arb Finder / Parlays. Cache-aware:
  // skips the network call when a fresh cached payload is in localStorage
  // (also written by app/arb/page.tsx so the two surfaces share). Force-refresh
  // bypasses cache.
  const load = useCallback(async (force = false) => {
    if (!force) {
      try {
        const cached = localStorage.getItem(ODDS_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.fetchedAt && Date.now() - parsed.fetchedAt < ODDS_CACHE_TTL) {
            setGames((parsed.games as OddsGame[]) ?? []);
            setRequestsRemaining(parsed.requestsRemaining ?? null);
            setFetchedAt(parsed.fetchedAt);
            return;
          }
        }
      } catch {}
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/odds?sport=all`);
      const body = await res.json();
      if (!res.ok) {
        setError((body as { error?: string }).error ?? `Error (${res.status})`);
        setGames([]);
        return;
      }
      const fetchedGames = (body.games as OddsGame[]) ?? [];
      const remaining = (body.requestsRemaining as string | null) ?? null;
      const ts = Date.now();
      setGames(fetchedGames);
      setRequestsRemaining(remaining);
      setFetchedAt(ts);
      try {
        localStorage.setItem(
          ODDS_CACHE_KEY,
          JSON.stringify({ games: fetchedGames, requestsRemaining: remaining, fetchedAt: ts }),
        );
      } catch {}
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Force-refresh wrapper — used by the section Refresh buttons so they always
  // bypass cache.
  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const oddsTabs: { id: OddsTabKey; label: string }[] = [
    { id: "best", label: "🎯 Best Picks" },
    { id: "arb", label: "💰 Arb Finder" },
    { id: "parlays", label: "🎰 Parlays" },
  ];

  return (
    <section>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: `1px solid ${C.border}`, paddingBottom: 0, flexWrap: "wrap" }}>
        {oddsTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setOddsTab(t.id)}
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

      {oddsTab === "best" && <BestPicksPanel games={games} loading={loading} error={error} requestsRemaining={requestsRemaining} nowMs={nowMs} onRefresh={refresh} fetchedAt={fetchedAt}/>}
      {oddsTab === "arb" && <ArbFinderPanel games={games} loading={loading} error={error} nowMs={nowMs} onRefresh={refresh} fetchedAt={fetchedAt}/>}
      {oddsTab === "parlays" && <ParlaysPanel games={games} loading={loading} error={error} nowMs={nowMs} onRefresh={refresh} fetchedAt={fetchedAt}/>}
    </section>
  );
}

type SharedOddsProps = {
  games: OddsGame[] | null;
  loading: boolean;
  error: string | null;
  nowMs: number;
  onRefresh: () => void;
  fetchedAt: number | null;
};

// Format "Last updated X mins ago" — null fetchedAt → "Loading…".
function lastUpdatedLabel(fetchedAt: number | null, nowMs: number): string {
  if (!fetchedAt) return "Loading…";
  const ageMs = nowMs - fetchedAt;
  const mins = Math.floor(ageMs / 60_000);
  if (mins < 1) return "Updated just now";
  if (mins === 1) return "Updated 1 min ago";
  if (mins < 60) return `Updated ${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  return hours === 1 ? "Updated 1 hour ago" : `Updated ${hours} hours ago`;
}

function FanduelPanel({
  games, loading, error, requestsRemaining, nowMs, onRefresh,
  addToParlay, isInParlay, parlayCount,
}: SharedOddsProps & {
  requestsRemaining: string | null;
  addToParlay: (leg: ParlayLeg) => void;
  isInParlay: (gameId: string, teamName: string) => boolean;
  parlayCount: number;
}) {
  const [timeWindow, setTimeWindow] = useState<TimePillKey>("today");

  // Best odds across every bookmaker for each team. Skip games where either
  // side has no price at all (rare — typically markets that haven't opened).
  const decorated = useMemo(() => {
    if (!games) return [];
    const rows = [];
    for (const g of games) {
      const home = bestPriceForTeam(g, g.home_team);
      const away = bestPriceForTeam(g, g.away_team);
      if (!home || !away) continue;
      rows.push({ g, home, away, start: new Date(g.commence_time).getTime() });
    }
    return rows;
  }, [games]);

  const sorted = useMemo(() => {
    const span = TIME_PILL_MS[timeWindow];
    const cutoff = span === Infinity ? Infinity : nowMs + span;
    return decorated
      .filter((d) => d.start <= cutoff)
      .sort((a, b) => a.start - b.start);
  }, [decorated, timeWindow, nowMs]);

  return (
    <>
      <SectionTitle
        title="Best Odds"
        subtitle="Best line per team across all US books · bookmaker shown next to each odd"
        right={
          <button
            onClick={onRefresh}
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

      {error && <ErrorBox>{error}</ErrorBox>}

      <div style={{ background: "rgba(99,102,241,0.08)", border: `1px solid rgba(99,102,241,0.25)`, color: "#a5b4fc", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
        💡 <strong>Parlay</strong> = combine multiple bets for a much bigger payout. <strong>All legs must win.</strong> Click <strong>+ Parlay</strong> on any team to add it.
        {parlayCount > 0 && <span style={{ color: C.green, fontWeight: 700 }}> · {parlayCount} {parlayCount === 1 ? "leg" : "legs"} selected</span>}
      </div>

      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
        <strong style={{ color: C.text }}>{sorted.length}</strong> {sorted.length === 1 ? "game" : "games"} available
        {" across "}
        <strong style={{ color: C.text }}>{new Set(sorted.map(d => d.g.sport_key)).size}</strong> {new Set(sorted.map(d => d.g.sport_key)).size === 1 ? "sport" : "sports"}
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
          {loading ? "Loading lines…" : "No games in this window."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map(({ g, home, away }) => (
            <SimpleFanduelCard key={g.id} game={g} home={home} away={away} nowMs={nowMs} addToParlay={addToParlay} isInParlay={isInParlay}/>
          ))}
        </div>
      )}
    </>
  );
}

function SimpleFanduelCard({
  game, home, away, nowMs, addToParlay, isInParlay,
}: {
  game: OddsGame;
  home: BestOdds;
  away: BestOdds;
  nowMs: number;
  addToParlay: (leg: ParlayLeg) => void;
  isInParlay: (gameId: string, teamName: string) => boolean;
}) {
  const cd = countdownLabel(game.commence_time, nowMs);
  const start = new Date(game.commence_time);

  const pAway = americanToImpliedProb(away.price);
  const pHome = americanToImpliedProb(home.price);
  const overround = pAway + pHome;
  const edgePct = (overround - 1) * 100;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap", fontSize: 12 }}>
        <span style={{ fontSize: 16 }}>{sportIcon(game.sport_key)}</span>
        <span style={{ fontWeight: 700, color: C.text }}>{game.away_team} <span style={{ color: C.textMuted, fontWeight: 500 }}>vs</span> {game.home_team}</span>
        <span style={{ color: C.textMuted }}>·</span>
        <span style={{ color: C.textDim }}>
          {start.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </span>
        {cd.label && (cd.live ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: C.red, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            <span className="nexyru-pulse" style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: C.red }}/>
            LIVE
          </span>
        ) : (
          <span style={{ fontSize: 11, color: C.textMuted }}>· {cd.label}</span>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <SimpleOddsColumn team={game.away_team} odds={away.price} prob={pAway} book={away.book}/>
        <SimpleOddsColumn team={game.home_team} odds={home.price} prob={pHome} book={home.book}/>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 8 }}>
        {[
          { name: game.away_team, side: away },
          { name: game.home_team, side: home },
        ].map(({ name, side }) => {
          const selected = isInParlay(game.id, name);
          return (
            <button
              key={name}
              onClick={() => addToParlay({
                gameId: game.id,
                sport: game.sport_title || game.sport_key,
                teamName: name,
                odds: side.price,
                book: side.book,
                gameTime: game.commence_time,
              })}
              style={{
                padding: "6px 10px", borderRadius: 6,
                border: `1px solid ${selected ? C.accent : C.border}`,
                background: selected ? "rgba(99,102,241,0.2)" : "transparent",
                color: selected ? "#a5b4fc" : C.textMuted,
                fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}
            >
              {selected ? "✓ In Parlay" : "+ Parlay"}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 10, fontSize: 11.5, color: C.textMuted }}>
        Bookmaker edge: <strong style={{ color: edgePct <= 2 ? C.green : edgePct <= 5 ? C.text : C.amber }}>{edgePct.toFixed(2)}%</strong> <span>(lower = better for you)</span>
      </div>
    </div>
  );
}

function SimpleOddsColumn({
  team, odds, prob, book,
}: {
  team: string; odds: number; prob: number; book: string;
}) {
  const oddsStr = odds > 0 ? `+${odds}` : String(odds);
  const plain = odds > 0
    ? `You bet $100 → win $${odds} profit`
    : `You bet $${Math.abs(odds)} → win $100 profit`;
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{team}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        <span style={{ fontSize: 26, fontWeight: 900, color: odds > 0 ? C.green : C.text, letterSpacing: "-0.01em" }}>{oddsStr}</span>
        <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>at {book}</span>
      </div>
      <div style={{ fontSize: 11.5, color: C.textDim, lineHeight: 1.5 }}>
        {plain} · <span style={{ color: C.textMuted }}>{(prob * 100).toFixed(0)}% implied chance</span>
      </div>
    </div>
  );
}

function ParlayBar({
  legs, stake, onStakeChange, onRemove, onClear,
}: {
  legs: ParlayLeg[];
  stake: string;
  onStakeChange: (s: string) => void;
  onRemove: (gameId: string) => void;
  onClear: () => void;
}) {
  const stakeNum = Math.max(0, parseFloat(stake) || 0);
  const result = calcParlay(legs, stakeNum);

  const savePaperBet = () => {
    if (!result || stakeNum <= 0) return;
    const bet = {
      id: Date.now(),
      type: "parlay",
      legs,
      sport: "PARLAY",
      game: legs.map((l) => l.teamName).join(" + "),
      pick: `${legs.length}-leg parlay`,
      odds: result.combinedAmerican,
      book: "Multiple",
      stake: stakeNum,
      potWin: result.profit,
      status: "pending",
      placedAt: new Date().toISOString(),
      notes: legs.map((l) => `${l.teamName} ${l.odds > 0 ? "+" : ""}${l.odds} at ${l.book}`).join(" | "),
    };
    try {
      const existing = JSON.parse(localStorage.getItem("nexyru_value_bets") || "[]");
      localStorage.setItem("nexyru_value_bets", JSON.stringify([bet, ...existing]));
      if (typeof window !== "undefined") window.alert(`Parlay saved to paper bets — target +$${result.profit.toFixed(2)}`);
    } catch {}
    onClear();
  };

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
      background: "#0a0a0f", borderTop: `1px solid ${C.border}`,
      padding: "14px 20px", display: "flex", alignItems: "center", gap: 14,
      flexWrap: "wrap", boxShadow: "0 -8px 24px rgba(0,0,0,0.4)",
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#a5b4fc", whiteSpace: "nowrap" }}>
        🎰 Parlay Builder — {legs.length} legs
      </div>

      <div style={{ display: "flex", gap: 6, flex: 1, flexWrap: "wrap", minWidth: 0 }}>
        {legs.map((leg) => (
          <div key={leg.gameId} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 10px", borderRadius: 6,
            background: "rgba(99,102,241,0.15)", border: `1px solid rgba(99,102,241,0.3)`,
            fontSize: 12, color: "#a5b4fc",
          }}>
            {leg.teamName} ({leg.odds > 0 ? "+" : ""}{leg.odds})
            <button onClick={() => onRemove(leg.gameId)} aria-label="Remove leg"
              style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>
              ×
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, color: C.textMuted }}>Stake $</span>
        <input
          value={stake}
          onChange={(e) => onStakeChange(e.target.value)}
          type="number"
          style={{ width: 80, padding: "5px 8px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 13, outline: "none" }}
        />
      </div>

      {result && (
        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          <div style={{ fontSize: 11, color: C.textMuted }}>
            Combined odds: <strong style={{ color: C.text }}>{result.combinedAmerican > 0 ? "+" : ""}{result.combinedAmerican}</strong>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.green }}>
            Win: ${result.payout.toFixed(2)} <span style={{ fontSize: 12 }}>(+${result.profit.toFixed(2)})</span>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={savePaperBet}
          disabled={!result || stakeNum <= 0}
          style={{
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: !result || stakeNum <= 0 ? C.card2 : C.accent,
            color: !result || stakeNum <= 0 ? C.textMuted : "#fff",
            fontSize: 13, fontWeight: 700,
            cursor: !result || stakeNum <= 0 ? "not-allowed" : "pointer",
          }}
        >
          💾 Save Parlay
        </button>
        <button onClick={onClear}
          style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 13, cursor: "pointer" }}>
          Clear
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── arb finder panel ─────────────────────────

const ARB_TRACK_KEY = "nexyru_arbs";
const ARB_COUNTS_KEY = "nexyru_arb_counts";

type ArbRiskLevel = { level: string; color: string; msg: string };

function getArbRisk(awayBook: string, homeBook: string, roi: number): ArbRiskLevel {
  if (awayBook && homeBook && awayBook === homeBook) {
    return { level: "EXTREME", color: "#ef4444", msg: "Both books are the same — DO NOT do this arb" };
  }
  if (roi > 5) return { level: "HIGH", color: "#f97316", msg: "High ROI arbs are more suspicious — bet small" };
  if (roi > 2) return { level: "MEDIUM", color: "#fbbf24", msg: "Medium risk — keep stakes moderate" };
  return { level: "LOW", color: "#22c55e", msg: "Low risk — normal sized arb, hard to detect" };
}

// ───────────────────────── best picks ─────────────────────────

type Pick = {
  game: OddsGame;
  team: string;
  bestPrice: number;
  bestBook: string;
  impliedProb: number;
  avgImplied: number;
  edge: number;
  score: number;
};

// Score each pick 0-100 based on three factors:
//  1. Sweet-spot implied probability (40-65% range = most value)
//  2. Odds in a reasonable range (avoid huge favorites and longshots)
//  3. Edge vs market average (best book paying more than the consensus)
function scorePick(bestPrice: number, impliedProb: number, edge: number): number {
  let score = 0;
  if (impliedProb > 0.35 && impliedProb < 0.65) score += 40;
  else if (impliedProb > 0.25 && impliedProb < 0.75) score += 25;
  else score += 5;

  if (bestPrice < 0 && bestPrice > -200) score += 30;
  else if (bestPrice > 0 && bestPrice < 200) score += 25;
  else if (bestPrice > 200) score += 10;
  else if (bestPrice < -300) score += 5;

  if (edge > 0.03) score += 30;
  else if (edge > 0.01) score += 15;

  return Math.min(100, score);
}

function scoreBadge(score: number): { label: string; color: string } {
  if (score >= 75) return { label: "🔥 Strong", color: C.green };
  if (score >= 55) return { label: "⭐ Good", color: "#60a5fa" };
  if (score >= 35) return { label: "👀 Fair", color: C.amber };
  return { label: "❄️ Weak", color: C.textMuted };
}

function scoreReasoning(score: number): string {
  if (score >= 70) return "✅ Good value odds, near 50/50 probability";
  if (score >= 50) return "👍 Reasonable odds, slight edge detected";
  return "⚠️ Risky pick — odds may not be in your favor";
}

// Build the per-team pick list from games (same structure used by both
// BestPicksPanel and ParlaysPanel).
function buildPicks(games: OddsGame[] | null): Pick[] {
  if (!games) return [];
  const out: Pick[] = [];
  for (const g of games) {
    for (const teamName of [g.away_team, g.home_team]) {
      const probs: number[] = [];
      let bestPrice = -Infinity;
      let bestBook = "";
      for (const b of g.bookmakers ?? []) {
        const h2h = b.markets?.find((m) => m.key === "h2h");
        if (!h2h) continue;
        const o = h2h.outcomes.find((o) => o.name === teamName);
        if (!o) continue;
        probs.push(americanToImpliedProb(o.price));
        if (o.price > bestPrice) {
          bestPrice = o.price;
          bestBook = b.title;
        }
      }
      if (probs.length === 0 || !Number.isFinite(bestPrice)) continue;
      const impliedProb = americanToImpliedProb(bestPrice);
      const avgImplied = probs.reduce((s, p) => s + p, 0) / probs.length;
      const edge = avgImplied - impliedProb;
      const score = scorePick(bestPrice, impliedProb, edge);
      out.push({
        game: g,
        team: teamName,
        bestPrice,
        bestBook,
        impliedProb,
        avgImplied,
        edge,
        score,
      });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

const SPORT_FILTERS: { id: string; label: string; matches: (key: string) => boolean }[] = [
  { id: "all", label: "All", matches: () => true },
  { id: "mlb", label: "MLB", matches: (k) => k.includes("baseball_mlb") },
  { id: "soccer", label: "Soccer", matches: (k) => k.startsWith("soccer_") },
  { id: "tennis", label: "Tennis", matches: (k) => k.startsWith("tennis_") },
  { id: "mma", label: "MMA", matches: (k) => k.startsWith("mma_") },
];

const TIME_FILTERS: { id: string; label: string; hours: number | null }[] = [
  { id: "today", label: "Today", hours: 24 },
  { id: "week", label: "This Week", hours: 24 * 7 },
  { id: "all", label: "All", hours: null },
];

type EsportPlayer = {
  id: number;
  name: string;
  fullName?: string;
  role?: string;
  nationality?: string;
  image?: string;
  team?: string;
};

// Country code (ISO 3166-1 alpha-2) → flag emoji via regional indicator
// symbols. Returns empty string for missing/invalid codes.
function flagFromCode(code: string | undefined): string {
  if (!code || code.length !== 2) return "";
  const cc = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  return [...cc].map((c) => String.fromCodePoint(c.charCodeAt(0) - 65 + 0x1f1e6)).join("");
}

function EsportsPlayersPanel() {
  const [game, setGame] = useState<EsportGame>("csgo");
  const [players, setPlayers] = useState<EsportPlayer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("nexyru_esports_watchlist") || "[]"); }
    catch { return []; }
  });
  const [pickNote, setPickNote] = useState<string | null>(null);

  const toggleWatch = (p: EsportPlayer) => {
    const next = watchlist.includes(p.id)
      ? watchlist.filter((x) => x !== p.id)
      : [...watchlist, p.id];
    setWatchlist(next);
    try { localStorage.setItem("nexyru_esports_watchlist", JSON.stringify(next)); } catch {}
  };

  const showPick = (p: EsportPlayer, rank: number) => {
    const team = p.team || "their team";
    const role = p.role || "rostered";
    setPickNote(`If ${team} plays today, ${p.name} is worth watching — ${role} player ranked #${rank}`);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setPlayers(null);
      try {
        const r = await fetch(`/api/esports?game=${game}&type=players`);
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setError(j.error || `Failed (${r.status})`);
          setPlayers([]);
          return;
        }
        setPlayers((j.data as EsportPlayer[]) || []);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load");
          setPlayers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [game]);

  const gameMeta = ESPORT_GAMES.find((g) => g.id === game)!;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {ESPORT_GAMES.map((g) => (
          <button
            key={g.id}
            onClick={() => setGame(g.id)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: `1px solid ${game === g.id ? g.color : C.border}`,
              background: game === g.id ? `${g.color}26` : "transparent",
              color: game === g.id ? "#fff" : C.textDim,
              fontSize: 13,
              fontWeight: game === g.id ? 700 : 500,
              cursor: "pointer",
            }}
          >
            {g.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 10, padding: 12, marginBottom: 12, color: "#fbbf24", fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 24, color: C.textDim, fontSize: 13 }}>
          Loading {gameMeta.label} players…
        </div>
      )}

      {!loading && players && players.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: 24, color: C.textMuted, fontSize: 13 }}>
          No {gameMeta.label} players returned.
        </div>
      )}

      {pickNote && (
        <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 10, padding: 12, marginBottom: 12, color: "#a5b4fc", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span>🎯 {pickNote}</span>
          <button onClick={() => setPickNote(null)} style={{ background: "transparent", border: "none", color: "#a5b4fc", cursor: "pointer", fontSize: 14 }}>✕</button>
        </div>
      )}

      {!loading && players && players.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
          {players.map((p, i) => {
            const watched = watchlist.includes(p.id);
            return (
            <div
              key={p.id}
              style={{
                background: C.card,
                border: `1px solid ${watched ? "rgba(245,158,11,0.4)" : C.border}`,
                borderRadius: 10,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image}
                    alt={p.name}
                    style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", background: C.card2, flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 6, background: C.card2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {flagFromCode(p.nationality) || "🎮"}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {flagFromCode(p.nationality)} {p.name}
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    {p.team || "Free agent"}
                  </div>
                  {(p.role || p.fullName) && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                      {p.role && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: `${gameMeta.color}26`, color: gameMeta.color, letterSpacing: 0.3 }}>
                          {p.role.toUpperCase()}
                        </span>
                      )}
                      {p.fullName && (
                        <span style={{ fontSize: 10, color: C.textMuted }}>{p.fullName}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => showPick(p, i + 1)} style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.08)", color: "#a5b4fc", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  🎯 Performance Pick
                </button>
                <button onClick={() => toggleWatch(p)} style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: `1px solid ${watched ? "rgba(245,158,11,0.5)" : C.border}`, background: watched ? "rgba(245,158,11,0.12)" : "transparent", color: watched ? "#fbbf24" : C.textDim, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {watched ? "★ Watching" : "☆ Watchlist"}
                </button>
              </div>
            </div>
          );})}
        </div>
      )}

      {!loading && players && players.length > 0 && (
        <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 8 }}>
            Place esports player prop bets:
          </div>
          <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:8}}>
            {[
              {name:'Betway Esports', url:'https://betway.com/esports/player-props', color:'#00a651'},
              {name:'GG.bet', url:'https://gg.bet/en/player-props', color:'#ff6b00'},
              {name:'Pinnacle', url:'https://www.pinnacle.com/en/esports', color:'#e63946'},
            ].map(site => (
              <a key={site.name} href={site.url} target="_blank" rel="noreferrer" style={{
                padding:'6px 12px', borderRadius:6, fontSize:11, fontWeight:700,
                background:`${site.color}15`, border:`1px solid ${site.color}40`,
                color:site.color, textDecoration:'none'
              }}>{site.name} →</a>
            ))}
          </div>
          <div style={{fontSize:11, color:'#6b7280', marginTop:6}}>
            ⚠️ Esports player prop odds must be placed directly on betting sites — we show stats and picks only.
          </div>
        </div>
      )}
    </div>
  );
}

type GameAnalysis = {
  pick: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  injuries: string;
  form: string;
  edge: string;
  warning: string | null;
  avoid: boolean;
};

function BestPicksPanel({
  games, loading, error, requestsRemaining, nowMs, onRefresh, fetchedAt,
}: SharedOddsProps & { requestsRemaining: string | null }) {
  const [sportFilter, setSportFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("today");
  const [flash, setFlash] = useState<string | null>(null);
  const [gameAnalysis, setGameAnalysis] = useState<Record<string, GameAnalysis>>({});
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
  const [section, setSection] = useState<"gamepicks" | "playerprops" | "esports" | "esportsplayers">("gamepicks");

  const allPicks = useMemo(() => buildPicks(games), [games]);

  const filtered = useMemo(() => {
    const sportMatch = SPORT_FILTERS.find((s) => s.id === sportFilter)!;
    const timeMatch = TIME_FILTERS.find((t) => t.id === timeFilter)!;
    return allPicks.filter((p) => {
      if (!sportMatch.matches(p.game.sport_key || "")) return false;
      if (timeMatch.hours != null) {
        const start = new Date(p.game.commence_time).getTime();
        const cutoff = nowMs + timeMatch.hours * 3600_000;
        if (!Number.isFinite(start) || start > cutoff) return false;
      }
      return true;
    });
  }, [allPicks, sportFilter, timeFilter, nowMs]);

  const top3 = filtered.slice(0, 3);
  const rest = filtered.slice(3);
  const strongCount = filtered.filter((p) => p.score >= 75).length;

  const analyzeGame = async (p: Pick) => {
    const gameId = p.game.id;
    if (analyzing.has(gameId) || gameAnalysis[gameId]) return;
    setAnalyzing((prev) => new Set(prev).add(gameId));
    try {
      // Send BOTH sides of the game (regardless of which card was clicked) so
      // the model has the full matchup context.
      const away = allPicks.find((x) => x.game.id === gameId && x.team === p.game.away_team);
      const home = allPicks.find((x) => x.game.id === gameId && x.team === p.game.home_team);
      const res = await fetch("/api/analyze-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team1: p.game.away_team,
          team2: p.game.home_team,
          sport: p.game.sport_title || p.game.sport_key,
          odds1: away?.bestPrice ?? null,
          odds2: home?.bestPrice ?? null,
          gameTime: p.game.commence_time,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGameAnalysis((prev) => ({ ...prev, [gameId]: data as GameAnalysis }));
      } else {
        setFlash(`Analysis failed: ${data.error ?? res.status}`);
        setTimeout(() => setFlash(null), 4000);
      }
    } catch (e: any) {
      setFlash(`Analysis failed: ${e?.message ?? "network error"}`);
      setTimeout(() => setFlash(null), 4000);
    } finally {
      setAnalyzing((prev) => {
        const next = new Set(prev);
        next.delete(gameId);
        return next;
      });
    }
  };

  // Sequential analyze with 1s spacing — protects against rate limits and
  // keeps token usage predictable. Dedupes by game so two picks from the
  // same matchup count once.
  const analyzeTopPicks = async () => {
    const seenGames = new Set<string>();
    const targets: Pick[] = [];
    for (const p of filtered) {
      if (seenGames.has(p.game.id)) continue;
      if (gameAnalysis[p.game.id]) continue;
      seenGames.add(p.game.id);
      targets.push(p);
      if (targets.length === 5) break;
    }
    for (const p of targets) {
      await analyzeGame(p);
      await new Promise((r) => setTimeout(r, 1000));
    }
  };

  const addPaperBet = (p: Pick) => {
    const odds = p.bestPrice;
    const stake = 100;
    const potWin = odds > 0 ? (stake * odds) / 100 : (stake * 100) / Math.abs(odds);
    const bet = {
      id: Date.now(),
      type: "best-pick",
      sport: p.game.sport_key?.replace(/_/g, " ").toUpperCase(),
      game: `${p.game.away_team} vs ${p.game.home_team}`,
      pick: p.team,
      odds,
      book: p.bestBook,
      stake,
      potWin,
      edge: p.edge,
      score: p.score,
      status: "pending",
      placedAt: new Date().toISOString(),
      gameTime: p.game.commence_time,
      notes: `Best Picks score ${p.score}/100`,
    };
    try {
      const existing = JSON.parse(localStorage.getItem(VALUE_BETS_KEY) || "[]");
      localStorage.setItem(VALUE_BETS_KEY, JSON.stringify([bet, ...existing]));
    } catch {}
    setFlash(`✓ Added ${p.team} (${odds > 0 ? "+" : ""}${odds}) to paper bets`);
    setTimeout(() => setFlash(null), 2500);
  };

  const renderCard = (p: Pick, highlighted = false) => {
    const badge = scoreBadge(p.score);
    const cd = countdownLabel(p.game.commence_time, nowMs);
    return (
      <div
        key={`${p.game.id}-${p.team}`}
        style={{
          background: C.card,
          border: `1px solid ${highlighted ? "#fbbf24" : C.border}`,
          borderRadius: 12,
          padding: 14,
          boxShadow: highlighted ? "0 0 24px rgba(251,191,36,0.10)" : "none",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{p.team}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
              {p.game.away_team} vs {p.game.home_team} · {cd.live ? <span style={{ color: C.red, fontWeight: 700 }}>🔴 LIVE</span> : cd.label}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, background: `${badge.color}26`, color: badge.color, border: `1px solid ${badge.color}40`, letterSpacing: 0.4 }}>
              {badge.label}
            </span>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: p.score >= 75 ? C.green : p.score >= 55 ? "#60a5fa" : p.score >= 35 ? C.amber : C.textMuted, lineHeight: 1 }}>
                {p.score}
              </div>
              <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: 0.4 }}>/ 100</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: p.bestPrice > 0 ? C.green : "#fff" }}>
            {p.bestPrice > 0 ? "+" : ""}{p.bestPrice}
          </span>
          <span style={{ fontSize: 12, color: C.textMuted }}>at <strong style={{ color: C.text }}>{p.bestBook}</strong></span>
          <span style={{ fontSize: 12, color: C.textMuted }}>· {Math.round(p.impliedProb * 100)}% implied chance</span>
        </div>
        <div style={{ fontSize: 11.5, color: C.textDim, marginBottom: 10 }}>
          Bet $100 → win ${(p.bestPrice > 0 ? p.bestPrice : (100 * 100) / Math.abs(p.bestPrice)).toFixed(0)}
        </div>
        <div style={{ fontSize: 11.5, color: badge.color, marginBottom: 10, fontWeight: 600 }}>
          {scoreReasoning(p.score)}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => addPaperBet(p)}
            style={{
              flex: 1,
              padding: "7px 10px",
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: C.card2,
              color: C.text,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Paper Bet
          </button>
          <button
            onClick={() => analyzeGame(p)}
            disabled={analyzing.has(p.game.id) || !!gameAnalysis[p.game.id]}
            style={{
              flex: 1,
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid rgba(99,102,241,0.4)",
              background: analyzing.has(p.game.id) || gameAnalysis[p.game.id] ? C.card2 : "rgba(99,102,241,0.08)",
              color: analyzing.has(p.game.id) || gameAnalysis[p.game.id] ? C.textMuted : "#a5b4fc",
              fontSize: 12,
              fontWeight: 700,
              cursor: analyzing.has(p.game.id) || gameAnalysis[p.game.id] ? "default" : "pointer",
            }}
          >
            {analyzing.has(p.game.id) ? "🔍 Searching…" : gameAnalysis[p.game.id] ? "✓ Analyzed" : "✦ Deep Analysis"}
          </button>
        </div>

        {gameAnalysis[p.game.id] && (() => {
          const analysis = gameAnalysis[p.game.id];
          const recommendedPick = !analysis.avoid && analysis.pick !== "SKIP"
            ? allPicks.find((x) => x.game.id === p.game.id && x.team === analysis.pick)
            : null;
          const confColor =
            analysis.confidence === "high" ? C.green
            : analysis.confidence === "medium" ? C.amber
            : C.textMuted;
          return (
            <div
              style={{
                marginTop: 10,
                background: analysis.avoid ? "rgba(239,68,68,0.05)" : "rgba(99,102,241,0.05)",
                border: `1px solid ${analysis.avoid ? "rgba(239,68,68,0.2)" : "rgba(99,102,241,0.2)"}`,
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: analysis.avoid ? C.red : "#a5b4fc" }}>
                  {analysis.avoid ? "🚫 SKIP THIS GAME" : `✅ Pick: ${analysis.pick}`}
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: `${confColor}26`, color: confColor, letterSpacing: 0.4 }}>
                  {analysis.confidence.toUpperCase()} CONFIDENCE
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: "#d1d5db", lineHeight: 1.6, marginBottom: 10 }}>
                {analysis.reasoning}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                {analysis.injuries && analysis.injuries.toLowerCase() !== "none" && (
                  <div style={{ background: "rgba(239,68,68,0.08)", borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: C.red, fontWeight: 700, marginBottom: 2 }}>🏥 INJURIES</div>
                    <div style={{ fontSize: 11.5, color: "#fca5a5" }}>{analysis.injuries}</div>
                  </div>
                )}
                {analysis.form && (
                  <div style={{ background: "rgba(34,197,94,0.08)", borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: C.green, fontWeight: 700, marginBottom: 2 }}>📊 RECENT FORM</div>
                    <div style={{ fontSize: 11.5, color: "#86efac" }}>{analysis.form}</div>
                  </div>
                )}
                {analysis.edge && (
                  <div style={{ background: "rgba(99,102,241,0.08)", borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: "#a5b4fc", fontWeight: 700, marginBottom: 2 }}>⚡ EDGE</div>
                    <div style={{ fontSize: 11.5, color: "#c7d2fe" }}>{analysis.edge}</div>
                  </div>
                )}
                {analysis.warning && (
                  <div style={{ background: "rgba(245,158,11,0.08)", borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: C.amber, fontWeight: 700, marginBottom: 2 }}>⚠️ WARNING</div>
                    <div style={{ fontSize: 11.5, color: "#fde68a" }}>{analysis.warning}</div>
                  </div>
                )}
              </div>
              {recommendedPick && (
                <button
                  onClick={() => addPaperBet(recommendedPick)}
                  style={{
                    width: "100%",
                    padding: "9px",
                    borderRadius: 8,
                    border: "none",
                    background: C.accent,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  + Add {analysis.pick} to Paper Bets
                </button>
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 10,
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: "rgba(59,130,246,0.08)",
                  border: "1px solid rgba(59,130,246,0.2)",
                  fontSize: 11,
                  color: "#93c5fd",
                  flexWrap: "wrap",
                }}
              >
                ⚠️ <strong>Always verify current injuries on</strong>
                <a
                  href="https://www.espn.com/injuries"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#60a5fa", textDecoration: "none", fontWeight: 700 }}
                >
                  ESPN →
                </a>
                before placing any real money.
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <>
      <SectionTitle
        title="Best Picks"
        subtitle="Every pick scored 0-100 by implied probability, odds range, and edge"
        right={
          <button
            onClick={onRefresh}
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

      <div style={{ display: "flex", gap: 8, padding: "8px 0", flexWrap: "wrap" }}>
        {([
          { id: "gamepicks", label: "🏆 Game Picks" },
          { id: "playerprops", label: "🏀 Player Props" },
          { id: "esports", label: "🎮 Esports Matches" },
          { id: "esportsplayers", label: "👤 Esports Players" },
        ] as const).map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: `1px solid ${section === s.id ? C.accent : C.border}`,
              background: section === s.id ? "rgba(99,102,241,0.15)" : "transparent",
              color: section === s.id ? "#a5b4fc" : C.textMuted,
              fontSize: 12,
              fontWeight: section === s.id ? 700 : 400,
              cursor: "pointer",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "playerprops" && <PlayerStatsPanel />}
      {section === "esports" && <EsportsPanel />}
      {section === "esportsplayers" && <EsportsPlayersPanel />}

      {section === "gamepicks" && (
      <>
      {error && <ErrorBox>{error}</ErrorBox>}
      {flash && (
        <div style={{ background: "rgba(34,197,94,0.1)", border: `1px solid ${C.green}`, color: C.green, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          {flash}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: "rgba(59,130,246,0.06)",
          border: "1px solid rgba(59,130,246,0.15)",
          borderRadius: 8,
          marginBottom: 12,
          fontSize: 11,
          color: "#93c5fd",
          flexWrap: "wrap",
        }}
      >
        ℹ️ AI analysis uses training data — always check{" "}
        <a
          href="https://www.espn.com/injuries"
          target="_blank"
          rel="noreferrer"
          style={{ color: "#60a5fa", textDecoration: "none", fontWeight: 700 }}
        >
          ESPN injuries
        </a>{" "}
        and{" "}
        <a
          href="https://www.espn.com/espn/scoreboard"
          target="_blank"
          rel="noreferrer"
          style={{ color: "#60a5fa", textDecoration: "none", fontWeight: 700 }}
        >
          recent form
        </a>{" "}
        before betting real money.
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: C.textMuted }}>
          <strong style={{ color: C.text }}>{filtered.length}</strong> picks analyzed ·
          <strong style={{ color: C.green, marginLeft: 6 }}>{strongCount}</strong> strong
          {requestsRemaining && <> · <strong style={{ color: C.text }}>{requestsRemaining}</strong> Odds API calls left this month</>}
          <span style={{ marginLeft: 6 }}>· {lastUpdatedLabel(fetchedAt, nowMs)}</span>
        </div>
        <button
          onClick={analyzeTopPicks}
          disabled={analyzing.size > 0 || filtered.length === 0}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(99,102,241,0.4)",
            background: analyzing.size > 0 ? C.card2 : "rgba(99,102,241,0.08)",
            color: analyzing.size > 0 ? C.textMuted : "#a5b4fc",
            fontSize: 11.5,
            fontWeight: 700,
            cursor: analyzing.size > 0 || filtered.length === 0 ? "default" : "pointer",
          }}
        >
          {analyzing.size > 0 ? `🔍 Analyzing… (${analyzing.size})` : "✦ Analyze All Top Picks"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {SPORT_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setSportFilter(f.id)}
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              border: `1px solid ${sportFilter === f.id ? C.accent : C.border}`,
              background: sportFilter === f.id ? "rgba(99,102,241,0.2)" : "transparent",
              color: sportFilter === f.id ? "#a5b4fc" : C.textDim,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {TIME_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setTimeFilter(f.id)}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: `1px solid ${timeFilter === f.id ? C.accent : C.border}`,
              background: timeFilter === f.id ? "rgba(99,102,241,0.2)" : "transparent",
              color: timeFilter === f.id ? "#a5b4fc" : C.textDim,
              fontSize: 10.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {games === null ? (
        <LoadingBlock />
      ) : filtered.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, color: C.textMuted, fontSize: 13 }}>
          No picks match the current filters.
        </div>
      ) : (
        <>
          {top3.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#fbbf24", marginBottom: 8, letterSpacing: 0.6, textTransform: "uppercase" }}>
                🏆 Today's Top Picks
              </div>
              <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
                {top3.map((p) => renderCard(p, true))}
              </div>
            </>
          )}
          {rest.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>
                All other picks
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {rest.map((p) => renderCard(p))}
              </div>
            </>
          )}
        </>
      )}
      </>
      )}
    </>
  );
}

// ───────────────────────── parlays ─────────────────────────

type ParlayCalc = {
  combinedDecimal: number;
  combinedAmerican: number;
  combinedProb: number;
  payout: number;
  profit: number;
  ev: number;
};

type CalcLeg = { odds: number; impliedProb: number };

function calcParlayMath(legs: CalcLeg[], stake: number): ParlayCalc | null {
  if (legs.length < 2) return null;
  const combinedProb = legs.reduce((p, l) => p * l.impliedProb, 1);
  const combinedDecimal = legs.reduce((p, l) => {
    const dec = l.odds > 0 ? l.odds / 100 + 1 : 100 / Math.abs(l.odds) + 1;
    return p * dec;
  }, 1);
  const combinedAmerican =
    combinedDecimal >= 2
      ? Math.round((combinedDecimal - 1) * 100)
      : Math.round(-100 / (combinedDecimal - 1));
  const payout = stake * combinedDecimal;
  const profit = payout - stake;
  // EV = expected return − stake. With independence assumption: prob of all hitting × payout.
  const ev = combinedProb * payout - stake;
  return { combinedDecimal, combinedAmerican, combinedProb, payout, profit, ev };
}

// Per-book pick: same shape as Pick but the odds are the *specific book's*
// price, not the cross-book best. Parlays must be same-book to actually be
// placeable, so the parlays tab works off this shape rather than buildPicks().
type BookPick = {
  gameId: string;
  game: OddsGame;
  team: string;
  odds: number;
  book: string;
  impliedProb: number;
  avgImplied: number;
  edge: number;
  score: number;
};

function buildPicksByBook(games: OddsGame[] | null): Map<string, BookPick[]> {
  const out = new Map<string, BookPick[]>();
  if (!games) return out;
  for (const g of games) {
    for (const teamName of [g.away_team, g.home_team]) {
      // First pass: gather every book's price for this team to compute the
      // market-average implied probability (used as the "true" estimate).
      const allPrices: { book: string; price: number }[] = [];
      for (const b of g.bookmakers ?? []) {
        const h2h = b.markets?.find((m) => m.key === "h2h");
        if (!h2h) continue;
        const o = h2h.outcomes.find((o) => o.name === teamName);
        if (!o) continue;
        allPrices.push({ book: b.title, price: o.price });
      }
      if (allPrices.length === 0) continue;
      const avgImplied =
        allPrices.reduce((s, p) => s + americanToImpliedProb(p.price), 0) / allPrices.length;

      // Second pass: one BookPick per (team, book) so we can group parlays
      // by sportsbook later.
      for (const { book, price } of allPrices) {
        const impliedProb = americanToImpliedProb(price);
        const edge = avgImplied - impliedProb;
        const score = edge * 100 + (price > -200 && price < 200 ? 20 : 0);
        const pick: BookPick = {
          gameId: g.id,
          game: g,
          team: teamName,
          odds: price,
          book,
          impliedProb,
          avgImplied,
          edge,
          score,
        };
        const arr = out.get(book) ?? [];
        arr.push(pick);
        out.set(book, arr);
      }
    }
  }
  return out;
}

type BookParlay = ParlayCalc & {
  id: string;
  type: string;
  book: string;
  legs: BookPick[];
};

function buildBookSuggestions(picksByBook: Map<string, BookPick[]>): BookParlay[] {
  const suggestions: BookParlay[] = [];
  for (const [book, picks] of picksByBook) {
    // One pick per game per book (skip the lower-scored side when both teams
    // are listed). Keeps a parlay from accidentally including both sides of a
    // game.
    const byGame = new Map<string, BookPick>();
    for (const p of [...picks].sort((a, b) => b.score - a.score)) {
      if (!byGame.has(p.gameId)) byGame.set(p.gameId, p);
    }
    const clean = Array.from(byGame.values()).sort((a, b) => b.score - a.score);
    for (const n of [2, 3, 4]) {
      if (clean.length < n) continue;
      const legs = clean.slice(0, n);
      const calc = calcParlayMath(legs, 100);
      if (!calc) continue;
      const type = n === 2 ? "2-Leg Safe" : n === 3 ? "3-Leg Value" : "4-Leg Longshot";
      const id = `${book}_${type.replace(/\s/g, "_")}`;
      suggestions.push({ id, type, book, legs, ...calc });
    }
  }
  return suggestions.sort((a, b) => b.ev - a.ev);
}

type LegAnalysis = { leg: BookPick; analysis: GameAnalysis };
type ParlayVerdict = "STRONG BET" | "LEAN BET" | "RISKY" | "SKIP";
type ParlayAnalysisResult = {
  legAnalyses: LegAnalysis[];
  verdict: ParlayVerdict;
  anyAvoid: boolean;
  highConfCount: number;
  lowConfCount: number;
};

function ParlaysPanel({ games, loading, error, nowMs, onRefresh, fetchedAt }: SharedOddsProps) {
  const [stake, setStake] = useState<string>("100");
  const [bookFilter, setBookFilter] = useState<string>("all");
  const [manualLegIds, setManualLegIds] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<string | null>(null);
  const [parlayAnalysis, setParlayAnalysis] = useState<Record<string, ParlayAnalysisResult>>({});
  const [parlayAnalyzing, setParlayAnalyzing] = useState<Set<string>>(new Set());

  const picksByBook = useMemo(() => buildPicksByBook(games), [games]);
  // Filter each book's picks to only include games in the next week.
  const eligibleByBook = useMemo(() => {
    const out = new Map<string, BookPick[]>();
    for (const [book, picks] of picksByBook) {
      const eligible = picks.filter((p) => {
        const start = new Date(p.game.commence_time).getTime();
        return Number.isFinite(start) && start - nowMs < 24 * 7 * 3600_000 && start - nowMs > -3 * 3600_000;
      });
      if (eligible.length > 0) out.set(book, eligible);
    }
    return out;
  }, [picksByBook, nowMs]);

  const allSuggestions = useMemo(() => buildBookSuggestions(eligibleByBook), [eligibleByBook]);
  const availableBooks = useMemo(
    () => Array.from(eligibleByBook.keys()).sort(),
    [eligibleByBook],
  );
  const filteredSuggestions = useMemo(
    () => (bookFilter === "all" ? allSuggestions : allSuggestions.filter((s) => s.book === bookFilter)),
    [allSuggestions, bookFilter],
  );

  const stakeNum = Math.max(0, parseFloat(stake) || 0);

  // Manual builder leg identity now includes the book — picks are per-book.
  // First leg defines the book; subsequent legs are restricted to the same
  // book (cross-book parlays don't actually exist as a placeable bet).
  const manualLegs = useMemo(() => {
    const lookup = new Map<string, BookPick>();
    for (const picks of eligibleByBook.values()) {
      for (const p of picks) lookup.set(`${p.book}|${p.gameId}|${p.team}`, p);
    }
    return Array.from(manualLegIds)
      .map((id) => lookup.get(id))
      .filter((p): p is BookPick => Boolean(p));
  }, [eligibleByBook, manualLegIds]);

  const manualBook = manualLegs[0]?.book ?? null;

  const toggleLeg = (p: BookPick) => {
    const id = `${p.book}|${p.gameId}|${p.team}`;
    setManualLegIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      // Different book than the first leg → reset and start over.
      const currentBook = manualLegs[0]?.book;
      if (currentBook && currentBook !== p.book) {
        next.clear();
      }
      // Same-game replacement within the picked book.
      for (const existingId of Array.from(next)) {
        if (existingId.startsWith(`${p.book}|${p.gameId}|`)) next.delete(existingId);
      }
      if (next.size >= 6) return prev;
      next.add(id);
      return next;
    });
  };

  const saveParlayToPaperBets = (parlay: BookParlay | { type: string; book: string; legs: BookPick[] } & Partial<ParlayCalc>) => {
    const legs = parlay.legs;
    if (legs.length < 2 || stakeNum <= 0) return;
    const calc = calcParlayMath(legs, stakeNum);
    if (!calc) return;
    const bet = {
      id: Date.now(),
      type: "parlay",
      sport: "PARLAY",
      game: legs.map((l) => l.team).join(" + "),
      pick: `${parlay.type} at ${parlay.book}`,
      odds: calc.combinedAmerican,
      book: parlay.book,
      stake: stakeNum,
      potWin: calc.profit,
      edge: 0,
      status: "pending",
      placedAt: new Date().toISOString(),
      gameTime: legs[0].game.commence_time,
      notes: legs.map((l) => `${l.team} (${l.odds > 0 ? "+" : ""}${l.odds})`).join(" | "),
    };
    try {
      const existing = JSON.parse(localStorage.getItem(VALUE_BETS_KEY) || "[]");
      localStorage.setItem(VALUE_BETS_KEY, JSON.stringify([bet, ...existing]));
    } catch {}
    setFlash(`✓ Saved ${parlay.type} parlay at ${parlay.book} to paper bets`);
    setTimeout(() => setFlash(null), 2500);
  };

  // Analyze every leg of a parlay through /api/analyze-game in sequence, then
  // roll up to a single STRONG BET / LEAN BET / RISKY / SKIP verdict. Each
  // leg's API call uses web search (~$0.03-0.05) so a 4-leg parlay = ~$0.20.
  const analyzeParlay = async (parlay: BookParlay) => {
    if (parlayAnalyzing.has(parlay.id) || parlayAnalysis[parlay.id]) return;
    setParlayAnalyzing((prev) => new Set(prev).add(parlay.id));
    try {
      const legAnalyses: LegAnalysis[] = [];
      for (const leg of parlay.legs) {
        const opponentName =
          leg.team === leg.game.away_team ? leg.game.home_team : leg.game.away_team;
        // Use the SAME book's opponent odds if available, so the analyst sees
        // the actual line the user could place.
        const opponentPick = picksByBook
          .get(leg.book)
          ?.find((x) => x.gameId === leg.gameId && x.team === opponentName);
        try {
          const res = await fetch("/api/analyze-game", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              team1: leg.team,
              team2: opponentName,
              sport: leg.game.sport_title || leg.game.sport_key,
              odds1: leg.odds,
              odds2: opponentPick?.odds ?? null,
              gameTime: leg.game.commence_time,
            }),
          });
          if (res.ok) {
            const analysis = (await res.json()) as GameAnalysis;
            legAnalyses.push({ leg, analysis });
          }
        } catch {
          // Skip the leg; continue with the rest.
        }
        // 800ms gap protects against rate limits when a parlay has 3-4 legs.
        await new Promise((r) => setTimeout(r, 800));
      }

      const allPick = legAnalyses.length > 0 && legAnalyses.every(
        (la) => la.analysis.pick === la.leg.team && !la.analysis.avoid,
      );
      const anyAvoid = legAnalyses.some((la) => la.analysis.avoid);
      const highConfCount = legAnalyses.filter((la) => la.analysis.confidence === "high").length;
      const lowConfCount = legAnalyses.filter((la) => la.analysis.confidence === "low").length;
      const verdict: ParlayVerdict = anyAvoid
        ? "SKIP"
        : allPick && highConfCount >= parlay.legs.length - 1
        ? "STRONG BET"
        : allPick
        ? "LEAN BET"
        : "RISKY";

      setParlayAnalysis((prev) => ({
        ...prev,
        [parlay.id]: { legAnalyses, verdict, anyAvoid, highConfCount, lowConfCount },
      }));
    } catch (e) {
      setFlash(`Parlay analysis failed: ${e instanceof Error ? e.message : "network error"}`);
      setTimeout(() => setFlash(null), 4000);
    } finally {
      setParlayAnalyzing((prev) => {
        const next = new Set(prev);
        next.delete(parlay.id);
        return next;
      });
    }
  };

  const renderParlayCard = (p: BookParlay) => {
    const evPositive = p.ev > 0;
    return (
      <div
        key={`${p.book}-${p.type}-${p.legs.map((l) => l.gameId).join(",")}`}
        style={{
          background: C.card,
          border: `1px solid ${evPositive ? "rgba(34,197,94,0.3)" : C.border}`,
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{p.type}</span>
            <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 8 }}>at {p.book}</span>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 4,
              background: evPositive ? "rgba(34,197,94,0.15)" : "rgba(107,114,128,0.15)",
              color: evPositive ? C.green : C.textMuted,
            }}
          >
            EV: {evPositive ? "+" : ""}${p.ev.toFixed(2)}
          </span>
        </div>

        {p.legs.map((leg) => (
          <div
            key={`${leg.gameId}-${leg.team}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              borderBottom: `1px solid ${C.border}`,
              fontSize: 13,
            }}
          >
            <span style={{ color: "#fff" }}>{leg.team}</span>
            <span style={{ color: leg.odds > 0 ? C.green : "#9ca3af", fontWeight: 600 }}>
              {leg.odds > 0 ? "+" : ""}{leg.odds}
            </span>
          </div>
        ))}

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>COMBINED ODDS</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
              {p.combinedAmerican > 0 ? "+" : ""}{p.combinedAmerican}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>WIN CHANCE</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
              {(p.combinedProb * 100).toFixed(1)}%
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>BET ${stakeNum} → WIN</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.green }}>
              ${((p.payout / 100) * stakeNum).toFixed(0)}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>
          {evPositive
            ? "✅ Positive EV — statistically worth betting"
            : `Expected loss: $${Math.abs(p.ev).toFixed(2)} per $100 long-term`}
        </div>

        <button
          onClick={() => saveParlayToPaperBets(p)}
          style={{
            width: "100%",
            marginTop: 10,
            padding: "9px",
            borderRadius: 8,
            border: "none",
            background: C.accent,
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          + Add to Paper Bets
        </button>

        <button
          onClick={() => analyzeParlay(p)}
          disabled={parlayAnalyzing.has(p.id) || !!parlayAnalysis[p.id]}
          style={{
            width: "100%",
            marginTop: 8,
            padding: "8px",
            borderRadius: 8,
            border: "1px solid rgba(99,102,241,0.4)",
            background: parlayAnalyzing.has(p.id) || parlayAnalysis[p.id] ? C.card2 : "rgba(99,102,241,0.08)",
            color: parlayAnalyzing.has(p.id) || parlayAnalysis[p.id] ? C.textMuted : "#a5b4fc",
            fontSize: 12,
            fontWeight: 700,
            cursor: parlayAnalyzing.has(p.id) || parlayAnalysis[p.id] ? "default" : "pointer",
          }}
        >
          {parlayAnalyzing.has(p.id)
            ? "🔍 Analyzing all legs…"
            : parlayAnalysis[p.id]
            ? "✓ Analyzed"
            : "✦ AI Analyze This Parlay"}
        </button>

        {parlayAnalysis[p.id] && (() => {
          const pa = parlayAnalysis[p.id];
          const verdictStyles: Record<ParlayVerdict, { bg: string; border: string; color: string; text: string }> = {
            "STRONG BET": { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)", color: C.green, text: "✅ STRONG PARLAY — AI backs all legs" },
            "LEAN BET": { bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.3)", color: "#a5b4fc", text: "👍 DECENT PARLAY — Most legs look good" },
            "RISKY": { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", color: C.amber, text: "⚠️ RISKY — Some legs are questionable" },
            "SKIP": { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", color: C.red, text: "🚫 SKIP — AI found issues with this parlay" },
          };
          const vs = verdictStyles[pa.verdict];
          return (
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  marginBottom: 10,
                  background: vs.bg,
                  border: `1px solid ${vs.border}`,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, color: vs.color }}>{vs.text}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                  {pa.highConfCount} high confidence · {pa.lowConfCount} low confidence · {pa.legAnalyses.length} legs analyzed
                </div>
              </div>

              {pa.legAnalyses.map((la, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    padding: "8px 10px",
                    borderRadius: 6,
                    marginBottom: 6,
                    background: la.analysis.avoid
                      ? "rgba(239,68,68,0.06)"
                      : la.analysis.pick === la.leg.team
                      ? "rgba(34,197,94,0.06)"
                      : "rgba(245,158,11,0.06)",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 2 }}>
                      {la.analysis.avoid ? "🚫" : la.analysis.pick === la.leg.team ? "✅" : "⚠️"} {la.leg.team}
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.4 }}>
                      {la.analysis.reasoning}
                    </div>
                    {la.analysis.injuries && la.analysis.injuries.toLowerCase() !== "none" && (
                      <div style={{ fontSize: 10, color: C.red, marginTop: 3 }}>🏥 {la.analysis.injuries}</div>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 3,
                      marginLeft: 8,
                      whiteSpace: "nowrap",
                      background:
                        la.analysis.confidence === "high"
                          ? "rgba(34,197,94,0.15)"
                          : la.analysis.confidence === "medium"
                          ? "rgba(245,158,11,0.15)"
                          : "rgba(107,114,128,0.15)",
                      color:
                        la.analysis.confidence === "high"
                          ? C.green
                          : la.analysis.confidence === "medium"
                          ? C.amber
                          : C.textMuted,
                    }}
                  >
                    {la.analysis.confidence.toUpperCase()}
                  </span>
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 4,
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: "rgba(59,130,246,0.08)",
                  border: "1px solid rgba(59,130,246,0.2)",
                  fontSize: 11,
                  color: "#93c5fd",
                  flexWrap: "wrap",
                }}
              >
                ⚠️ <strong>Always verify current injuries on</strong>
                <a
                  href="https://www.espn.com/injuries"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#60a5fa", textDecoration: "none", fontWeight: 700 }}
                >
                  ESPN →
                </a>
                before placing any real money.
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  // Manual builder pick pool — once first leg is chosen, restrict to same book.
  const manualPickPool = useMemo(() => {
    const all: BookPick[] = [];
    for (const picks of eligibleByBook.values()) all.push(...picks);
    const pool = manualBook ? all.filter((p) => p.book === manualBook) : all;
    return pool.sort((a, b) => b.score - a.score).slice(0, 60);
  }, [eligibleByBook, manualBook]);

  const manualCalc = manualLegs.length >= 2 ? calcParlayMath(manualLegs, stakeNum) : null;

  return (
    <>
      <SectionTitle
        title="Smart Parlays"
        subtitle="Same-book combos · honest EV math · build your own"
        right={
          <button
            onClick={onRefresh}
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

      {error && <ErrorBox>{error}</ErrorBox>}
      {flash && (
        <div style={{ background: "rgba(34,197,94,0.1)", border: `1px solid ${C.green}`, color: C.green, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          {flash}
        </div>
      )}

      <div
        style={{
          background: "rgba(245,158,11,0.08)",
          border: "1px solid rgba(245,158,11,0.2)",
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          fontSize: 12,
          color: "#fbbf24",
        }}
      >
        ⚠️ All legs in a parlay must be placed at the SAME sportsbook. Suggestions below are grouped by book automatically.
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: C.textDim }}>Stake: $</span>
        <input
          type="number"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          style={{ width: 100, padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 14, fontWeight: 700, outline: "none" }}
        />
        <span style={{ fontSize: 12, color: C.textMuted }}>used for every parlay calc below</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: C.textMuted }}>{lastUpdatedLabel(fetchedAt, nowMs)}</span>
      </div>

      {availableBooks.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          <button
            onClick={() => setBookFilter("all")}
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              border: `1px solid ${bookFilter === "all" ? C.accent : C.border}`,
              background: bookFilter === "all" ? "rgba(99,102,241,0.2)" : "transparent",
              color: bookFilter === "all" ? "#a5b4fc" : C.textDim,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            All books
          </button>
          {availableBooks.map((book) => (
            <button
              key={book}
              onClick={() => setBookFilter(book)}
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                border: `1px solid ${bookFilter === book ? C.accent : C.border}`,
                background: bookFilter === book ? "rgba(99,102,241,0.2)" : "transparent",
                color: bookFilter === book ? "#a5b4fc" : C.textDim,
                fontSize: 11.5,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {book}
            </button>
          ))}
        </div>
      )}

      {games === null ? (
        <LoadingBlock />
      ) : (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>
            Auto-suggested · sorted by EV
          </div>
          {filteredSuggestions.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, color: C.textMuted, fontSize: 13, marginBottom: 14 }}>
              No same-book parlays available for the current filter. Try "All books" or refresh the odds.
            </div>
          ) : (
            filteredSuggestions.slice(0, 12).map((p) => renderParlayCard(p))
          )}

          <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginTop: 24, marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>
            Build your own ({manualLegs.length}/6 legs{manualBook ? ` · locked to ${manualBook}` : ""})
          </div>
          {manualCalc && (
            <div style={{ background: C.card, border: `1px solid ${C.accent}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.6 }}>
                <div>Combined odds: <strong style={{ color: manualCalc.combinedAmerican > 0 ? C.green : C.text }}>{manualCalc.combinedAmerican > 0 ? "+" : ""}{manualCalc.combinedAmerican}</strong></div>
                <div>All {manualLegs.length} must win: <strong>{(manualCalc.combinedProb * 100).toFixed(1)}%</strong></div>
                <div>Bet ${stakeNum} → win <strong style={{ color: C.green }}>${manualCalc.profit.toFixed(2)}</strong></div>
                <div style={{ marginTop: 6, color: manualCalc.ev > 0 ? C.green : manualCalc.ev < -20 ? C.red : C.amber, fontWeight: 700 }}>
                  Expected value: {manualCalc.ev >= 0 ? "+" : ""}${manualCalc.ev.toFixed(2)} per ${stakeNum} bet
                </div>
              </div>
              <button
                onClick={() => saveParlayToPaperBets({ type: "Custom", book: manualBook ?? "?", legs: manualLegs, ...manualCalc })}
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: C.accent,
                  color: "#fff",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Save Custom Parlay to Paper Bets
              </button>
            </div>
          )}

          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>
            {manualBook
              ? `Showing only ${manualBook}'s lines. Click a leg to add/remove. Picking from a different book resets the parlay.`
              : "Pick your first leg — that locks the parlay to that book."}
          </div>
          <div style={{ display: "grid", gap: 6, maxHeight: 500, overflowY: "auto" }}>
            {manualPickPool.map((p) => {
              const id = `${p.book}|${p.gameId}|${p.team}`;
              const selected = manualLegIds.has(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleLeg(p)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${selected ? C.accent : C.border}`,
                    background: selected ? "rgba(99,102,241,0.15)" : C.card,
                    color: C.text,
                    fontSize: 12.5,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>
                    <input type="checkbox" checked={selected} readOnly style={{ marginRight: 8 }} />
                    <strong>{p.team}</strong>
                    <span style={{ color: C.textMuted, marginLeft: 6 }}>
                      vs {p.team === p.game.away_team ? p.game.home_team : p.game.away_team}
                    </span>
                    {!manualBook && <span style={{ color: C.textMuted, marginLeft: 6, fontSize: 11 }}>· {p.book}</span>}
                  </span>
                  <span>
                    <span style={{ color: p.odds > 0 ? C.green : C.text, fontWeight: 700 }}>
                      {p.odds > 0 ? "+" : ""}{p.odds}
                    </span>
                    <span style={{ color: C.textMuted, marginLeft: 6 }}>{Math.round(p.impliedProb * 100)}%</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

function ArbFinderPanel({ games, loading, error, nowMs, onRefresh, fetchedAt }: SharedOddsProps) {
  const [stake, setStake] = useState<string>("1000");
  const [tracked, setTracked] = useState<{ id: number }[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  // Per-day per-book arb counts — used to warn when bookmaker exposure gets
  // high enough to risk an account limit.
  const [arbCounts, setArbCounts] = useState<{ date: string; books: Record<string, number> }>({
    date: "",
    books: {},
  });

  // Hydrate tracked list + counts from localStorage post-mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ARB_TRACK_KEY);
      if (raw) setTracked(JSON.parse(raw));
      const today = new Date().toDateString();
      const c = JSON.parse(localStorage.getItem(ARB_COUNTS_KEY) || "{}");
      if (c && c.date === today) setArbCounts(c);
      else setArbCounts({ date: today, books: {} });
    } catch {}
  }, []);

  const bumpBookCounts = (bookA: string, bookB: string) => {
    const today = new Date().toDateString();
    setArbCounts((prev) => {
      const base = prev?.date === today ? prev : { date: today, books: {} };
      const books = { ...base.books };
      if (bookA) books[bookA] = (books[bookA] || 0) + 1;
      if (bookB && bookB !== bookA) books[bookB] = (books[bookB] || 0) + 1;
      const next = { date: today, books };
      try { localStorage.setItem(ARB_COUNTS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const todayBookEntries = Object.entries(arbCounts?.books || {}).sort((a, b) => b[1] - a[1]);
  const todayTotalArbs = Object.values(arbCounts?.books || {}).reduce((s, n) => s + n, 0);
  const overLimitBooks = todayBookEntries.filter(([, n]) => n > 2);

  const stakeNum = Math.max(0, parseFloat(stake) || 0);

  // Decorate each game with best price per side + arb math at current stake.
  const decorated = useMemo(() => {
    if (!games) return [];
    const rows: Array<{
      g: OddsGame;
      home: BestOdds;
      away: BestOdds;
      overround: number;
      isArb: boolean;
      sameBook: boolean;
      suspicious: boolean;
      stakeAway?: number; stakeHome?: number; profit?: number; roi?: number;
    }> = [];
    for (const g of games) {
      const home = bestPriceForTeam(g, g.home_team);
      const away = bestPriceForTeam(g, g.away_team);
      if (!home || !away) continue;
      const pAway = americanToImpliedProb(away.price);
      const pHome = americanToImpliedProb(home.price);
      const overround = pAway + pHome;
      // Real cross-book arbs require two different books. Same-book "arbs"
      // are stale-feed artifacts — books always bake in vig on their own line.
      const sameBook = away.book === home.book;
      // overround > 0.85 sanity-checks the upstream feed: implied probs on a
      // 2-outcome market should sum near 1.0. Anything way below means at
      // least one price is broken — not a real arb opportunity.
      const dataPlausible = overround > 0.85 && overround < 1;
      const potentialArb = dataPlausible && stakeNum > 0 && !sameBook;
      let stakeAway, stakeHome, profit, roi;
      if (potentialArb) {
        stakeAway = (stakeNum * pAway) / overround;
        stakeHome = (stakeNum * pHome) / overround;
        profit = (stakeNum * (1 - overround)) / overround;
        roi = (profit / stakeNum) * 100;
      }
      // Real arb: passes all sanity checks AND ROI is in the believable range.
      // Anything ≥ 8% on h2h is almost always one book's stale line, not a
      // real edge — flag for manual verification, no profit display, no Track.
      const r = roi ?? 0;
      const isArb = potentialArb && r > 0 && r < 8;
      const suspicious = potentialArb && r >= 8;
      rows.push({ g, home, away, overround, isArb, sameBook, suspicious, stakeAway, stakeHome, profit, roi });
    }
    // Arbs first (highest profit), then non-arbs by start time.
    rows.sort((a, b) => {
      if (a.isArb !== b.isArb) return a.isArb ? -1 : 1;
      if (a.isArb && b.isArb) return (b.profit ?? 0) - (a.profit ?? 0);
      return new Date(a.g.commence_time).getTime() - new Date(b.g.commence_time).getTime();
    });
    return rows;
  }, [games, stakeNum]);

  const arbCount = decorated.filter((d) => d.isArb && !d.suspicious).length;

  const trackArb = (row: typeof decorated[number]) => {
    if (!row.isArb) return;
    const entry = {
      id: Date.now(),
      sport: row.g.sport_key?.replace(/_/g, " ").toUpperCase(),
      gameTime: row.g.commence_time,
      teamA: row.g.away_team, oddsA: row.away.price, bookA: row.away.book,
      teamB: row.g.home_team, oddsB: row.home.price, bookB: row.home.book,
      stake: stakeNum,
      betA: row.stakeAway, betB: row.stakeHome,
      profit: row.profit, roi: row.roi,
      status: "pending",
      trackedAt: new Date().toISOString(),
    };
    const next = [entry, ...tracked];
    setTracked(next);
    try { localStorage.setItem(ARB_TRACK_KEY, JSON.stringify(next)); } catch {}
    bumpBookCounts(row.away.book, row.home.book);
    setFlash(`✓ Tracked — ${row.g.away_team} vs ${row.g.home_team}`);
    setTimeout(() => setFlash(null), 2500);
  };

  const fmtOdds = (n: number) => `${n > 0 ? "+" : ""}${n}`;

  return (
    <>
      <SectionTitle
        title="Arb Finder"
        subtitle="Cross-book guaranteed-profit opportunities · uses Best Odds data"
        right={
          <button
            onClick={onRefresh}
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

      {error && <ErrorBox>{error}</ErrorBox>}
      {flash && (
        <div style={{ background: "rgba(34,197,94,0.1)", border: `1px solid ${C.green}`, color: C.green, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          {flash}
        </div>
      )}

      <div style={{
        background: "rgba(245,158,11,0.08)",
        border: "1px solid rgba(245,158,11,0.25)",
        borderRadius: 10, padding: 14, marginBottom: 16,
        fontSize: 13, color: "#fbbf24", lineHeight: 1.6,
      }}>
        ⚠️ <strong>Arbing Warning:</strong> Bookmakers monitor for arbing and will limit your account if detected.
        To stay under the radar: never bet both sides at the same book · mix in some normal bets ·
        don&apos;t always bet the maximum · withdraw winnings gradually ·
        <strong> never do more than 2-3 arbs per day per bookmaker.</strong>
      </div>

      {(todayTotalArbs > 0 || overLimitBooks.length > 0) && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12.5, color: C.textMuted }}>
          Today: <strong style={{ color: C.text }}>{todayTotalArbs}</strong> {todayTotalArbs === 1 ? "arb" : "arbs"} placed
          {overLimitBooks.map(([book, n]) => (
            <div key={book} style={{ color: C.red, marginTop: 6, fontSize: 12, fontWeight: 600 }}>
              ⚠️ You&apos;ve placed {n} arbs at <strong>{book}</strong> today — consider stopping to avoid detection
            </div>
          ))}
        </div>
      )}

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: C.textDim }}>Calculate for: $</span>
        <input
          type="number"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          style={{ width: 110, padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 15, fontWeight: 700, outline: "none" }}
        />
        <span style={{ fontSize: 13, color: C.textDim }}>total stake — split across both sides</span>
      </div>

      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
        <strong style={{ color: C.text }}>{decorated.length}</strong> {decorated.length === 1 ? "game" : "games"} loaded across <strong style={{ color: C.text }}>{new Set(decorated.map(d => d.g.sport_key)).size}</strong> {new Set(decorated.map(d => d.g.sport_key)).size === 1 ? "sport" : "sports"} · <strong style={{ color: arbCount > 0 ? C.green : C.text }}>{arbCount}</strong> {arbCount === 1 ? "arb" : "arbs"} found · {lastUpdatedLabel(fetchedAt, nowMs)}
      </div>

      {games === null ? (
        <LoadingBlock />
      ) : decorated.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, color: C.textMuted, fontSize: 13 }}>
          {loading ? "Loading games…" : "No games available."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {decorated.map((row) => {
            const cd = countdownLabel(row.g.commence_time, nowMs);
            const isArb = row.isArb;
            return (
              <div
                key={row.g.id}
                style={{
                  background: C.card,
                  border: `1px solid ${isArb ? C.green : C.border}`,
                  borderRadius: 12,
                  padding: 14,
                  opacity: isArb ? 1 : 0.6,
                  boxShadow: isArb ? "0 0 20px rgba(34,197,94,0.08)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap", fontSize: 12 }}>
                  <span style={{ fontSize: 16 }}>{sportIcon(row.g.sport_key)}</span>
                  <span style={{ fontWeight: 700, color: C.text }}>{row.g.away_team} <span style={{ color: C.textMuted, fontWeight: 500 }}>vs</span> {row.g.home_team}</span>
                  <span style={{ color: C.textMuted }}>·</span>
                  <span style={{ color: C.textDim }}>
                    {cd.live ? <span style={{ color: C.red, fontWeight: 700 }}>🔴 LIVE</span> : (cd.label || "")}
                  </span>
                  {isArb && !row.suspicious && (
                    <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 6, background: "rgba(34,197,94,0.15)", color: C.green, letterSpacing: "0.04em" }}>
                      ✓ GUARANTEED PROFIT
                    </span>
                  )}
                  {row.suspicious && (
                    <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 6, background: "rgba(245,158,11,0.15)", color: "#fbbf24", letterSpacing: "0.04em" }}>
                      ⚠️ VERIFY ODDS
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
                  {row.sameBook ? (
                    <span style={{ color: "#fbbf24" }}>Both odds from <strong>{row.away.book}</strong> — not a real arb</span>
                  ) : (
                    <>
                      {row.g.away_team} {fmtOdds(row.away.price)} at <strong style={{ color: C.text }}>{row.away.book}</strong>
                      <span style={{ margin: "0 6px" }}>·</span>
                      {row.g.home_team} {fmtOdds(row.home.price)} at <strong style={{ color: C.text }}>{row.home.book}</strong>
                    </>
                  )}
                </div>

                {row.suspicious ? (
                  <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 10, padding: "12px 14px", fontSize: 13, lineHeight: 1.55, color: "#fbbf24", fontWeight: 600 }}>
                    ⚠️ Possible arb but odds may be stale — verify manually before betting.
                    <div style={{ color: C.textMuted, fontWeight: 500, marginTop: 4, fontSize: 12 }}>
                      Reported ROI {row.roi!.toFixed(2)}% is above the 8% threshold where h2h arbs are almost always feed errors.
                    </div>
                  </div>
                ) : isArb ? (
                  <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 10, padding: "12px 14px", fontSize: 13.5, lineHeight: 1.6, color: C.text }}>
                    {(() => {
                      const risk = getArbRisk(row.away.book, row.home.book, row.roi ?? 0);
                      return (
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                          background: `${risk.color}15`, border: `1px solid ${risk.color}40`,
                          color: risk.color, marginBottom: 10,
                        }}>
                          🛡️ Risk: {risk.level} — {risk.msg}
                        </div>
                      );
                    })()}
                    <div>
                      Bet <strong style={{ color: C.green }}>${row.stakeAway!.toFixed(2)}</strong> on {row.g.away_team} at <strong>{row.away.book}</strong> ({fmtOdds(row.away.price)})
                    </div>
                    <div>
                      Bet <strong style={{ color: C.green }}>${row.stakeHome!.toFixed(2)}</strong> on {row.g.home_team} at <strong>{row.home.book}</strong> ({fmtOdds(row.home.price)})
                    </div>
                    <div style={{ marginTop: 6, fontSize: 15, fontWeight: 800, color: C.green }}>
                      = +${row.profit!.toFixed(2)} guaranteed profit · {row.roi!.toFixed(2)}% ROI
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: C.textMuted }}>
                    {row.sameBook
                      ? `Same-book offer — can't be arbed across two books.`
                      : `No arb — book edge ${((row.overround - 1) * 100).toFixed(2)}%.`}
                  </div>
                )}

                {isArb && !row.suspicious && (
                  <button
                    onClick={() => trackArb(row)}
                    style={{ marginTop: 10, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.green}`, background: "transparent", color: C.green, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    + Track Arb
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tracked.length > 0 && (
        <div style={{ marginTop: 24, fontSize: 11, color: C.textMuted }}>
          {tracked.length} arb{tracked.length === 1 ? "" : "s"} tracked · stored locally on this device
        </div>
      )}
    </>
  );
}

// ───────────────────────── value bets panel ─────────────────────────

const VALUE_BETS_KEY = "nexyru_value_bets";

type ValueTeam = { name: string; bestPrice: number; bestBook: string; avgImplied: number; edge: number };

function valueLabel(edge: number): { label: string; color: string } {
  if (edge > 0.05) return { label: "⭐⭐⭐ Great Value", color: "#22c55e" };
  if (edge > 0.02) return { label: "⭐⭐ Good Value", color: "#86efac" };
  if (edge > 0) return { label: "⭐ Slight Value", color: "#fbbf24" };
  return { label: "No Edge", color: C.textMuted };
}

function ValueBetsPanel({ games, loading, error, nowMs, onRefresh }: SharedOddsProps) {
  const [myBets, setMyBets] = useState<{ id: number }[]>([]);
  const [addModal, setAddModal] = useState<{ game: OddsGame; team: ValueTeam } | null>(null);
  const [stakeInput, setStakeInput] = useState("100");
  const [notesInput, setNotesInput] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VALUE_BETS_KEY);
      if (raw) setMyBets(JSON.parse(raw));
    } catch {}
  }, []);

  // Decorate each game with per-team best price + market-average implied prob.
  // Edge = avgImplied - impliedAtBestBook (positive = best book paying more).
  const decorated = useMemo(() => {
    if (!games) return [];
    const rows: Array<{ g: OddsGame; teams: ValueTeam[]; maxEdge: number }> = [];
    for (const g of games) {
      const teamData: ValueTeam[] = [];
      for (const teamName of [g.away_team, g.home_team]) {
        const probs: number[] = [];
        let bestPrice = -Infinity;
        let bestBook = "";
        for (const b of g.bookmakers ?? []) {
          const h2h = b.markets?.find((m) => m.key === "h2h");
          if (!h2h) continue;
          const o = h2h.outcomes.find((o) => o.name === teamName);
          if (!o) continue;
          probs.push(americanToImpliedProb(o.price));
          if (o.price > bestPrice) { bestPrice = o.price; bestBook = b.title; }
        }
        if (probs.length === 0) continue;
        const avgImplied = probs.reduce((s, p) => s + p, 0) / probs.length;
        const edge = avgImplied - americanToImpliedProb(bestPrice);
        teamData.push({ name: teamName, bestPrice, bestBook, avgImplied, edge });
      }
      if (teamData.length < 2) continue;
      const maxEdge = Math.max(...teamData.map((t) => t.edge));
      rows.push({ g, teams: teamData, maxEdge });
    }
    rows.sort((a, b) => b.maxEdge - a.maxEdge);
    return rows;
  }, [games]);

  const openAdd = (game: OddsGame, team: ValueTeam) => {
    setAddModal({ game, team });
    setStakeInput("100");
    setNotesInput("");
  };

  const confirmBet = () => {
    if (!addModal) return;
    const stakeNum = Math.max(0, parseFloat(stakeInput) || 0);
    if (stakeNum <= 0) return;
    const odds = addModal.team.bestPrice;
    const potWin = odds > 0 ? (stakeNum * odds) / 100 : (stakeNum * 100) / Math.abs(odds);
    const entry = {
      id: Date.now(),
      sport: addModal.game.sport_key?.replace(/_/g, " ").toUpperCase(),
      game: `${addModal.game.away_team} vs ${addModal.game.home_team}`,
      pick: addModal.team.name,
      odds, book: addModal.team.bestBook,
      stake: stakeNum, potWin,
      edge: addModal.team.edge,
      status: "pending",
      placedAt: new Date().toISOString(),
      gameTime: addModal.game.commence_time,
      notes: notesInput,
    };
    const next = [entry, ...myBets];
    setMyBets(next);
    try { localStorage.setItem(VALUE_BETS_KEY, JSON.stringify(next)); } catch {}
    setAddModal(null);
    setFlash(`✓ Added bet — ${addModal.team.name} (${odds > 0 ? "+" : ""}${odds})`);
    setTimeout(() => setFlash(null), 2500);
  };

  const fmtOdds = (n: number) => `${n > 0 ? "+" : ""}${n}`;

  return (
    <>
      <SectionTitle
        title="Value Bets"
        subtitle="Per-team value rating vs market average · uses Best Odds data"
        right={
          <button
            onClick={onRefresh}
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

      {error && <ErrorBox>{error}</ErrorBox>}
      {flash && (
        <div style={{ background: "rgba(34,197,94,0.1)", border: `1px solid ${C.green}`, color: C.green, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          {flash}
        </div>
      )}

      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
        <strong style={{ color: C.text }}>{decorated.length}</strong> {decorated.length === 1 ? "game" : "games"} across <strong style={{ color: C.text }}>{new Set(decorated.map(d => d.g.sport_key)).size}</strong> {new Set(decorated.map(d => d.g.sport_key)).size === 1 ? "sport" : "sports"} · sorted by best value
        {myBets.length > 0 && <> · {myBets.length} bet{myBets.length === 1 ? "" : "s"} tracked</>}
      </div>

      {games === null ? (
        <LoadingBlock />
      ) : decorated.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, color: C.textMuted, fontSize: 13 }}>
          {loading ? "Loading games…" : "No games available."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {decorated.map((row) => {
            const cd = countdownLabel(row.g.commence_time, nowMs);
            return (
              <div key={row.g.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap", fontSize: 12 }}>
                  <span style={{ fontSize: 16 }}>{sportIcon(row.g.sport_key)}</span>
                  <span style={{ fontWeight: 700, color: C.text }}>{row.g.away_team} <span style={{ color: C.textMuted, fontWeight: 500 }}>vs</span> {row.g.home_team}</span>
                  <span style={{ color: C.textMuted }}>·</span>
                  <span style={{ color: C.textDim }}>{cd.live ? <span style={{ color: C.red, fontWeight: 700 }}>🔴 LIVE</span> : cd.label}</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {row.teams.map((team) => {
                    const v = valueLabel(team.edge);
                    return (
                      <div
                        key={team.name}
                        style={{
                          background: C.card2,
                          borderRadius: 10,
                          padding: 12,
                          border: `1px solid ${team.edge > 0.02 ? "rgba(34,197,94,0.3)" : C.border}`,
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{team.name}</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 22, fontWeight: 900, color: team.bestPrice > 0 ? C.green : C.text }}>{fmtOdds(team.bestPrice)}</span>
                          <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>at {team.bestBook}</span>
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>
                          {(americanToImpliedProb(team.bestPrice) * 100).toFixed(0)}% implied · market avg {(team.avgImplied * 100).toFixed(0)}%
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: v.color, marginBottom: 8 }}>
                          {v.label}
                          {team.edge > 0 && <span style={{ color: C.textMuted }}> (+{(team.edge * 100).toFixed(1)}% edge)</span>}
                        </div>
                        <button
                          onClick={() => openAdd(row.g, team)}
                          style={{
                            width: "100%",
                            padding: "7px 10px",
                            borderRadius: 6,
                            border: team.edge > 0.02 ? "none" : `1px solid ${C.border}`,
                            background: team.edge > 0.02 ? C.accent : C.card,
                            color: team.edge > 0.02 ? "#fff" : C.text,
                            fontSize: 12, fontWeight: 700, cursor: "pointer",
                          }}
                        >
                          + Add Bet
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {addModal && (
        <>
          <div onClick={() => setAddModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 1001, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, width: 380, color: C.text }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Add Bet</div>
            <div style={{ fontSize: 12.5, color: C.textDim, marginBottom: 14 }}>
              {addModal.game.away_team} vs {addModal.game.home_team}
            </div>
            <div style={{ background: C.card2, borderRadius: 8, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{addModal.team.name}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: addModal.team.bestPrice > 0 ? C.green : C.text }}>{fmtOdds(addModal.team.bestPrice)}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>at {addModal.team.bestBook}</div>
            </div>
            <label style={{ fontSize: 11, color: C.textMuted, display: "block", marginBottom: 4, fontWeight: 600 }}>Stake ($)</label>
            <input
              type="number"
              value={stakeInput}
              onChange={(e) => setStakeInput(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 6 }}
            />
            {(() => {
              const s = parseFloat(stakeInput) || 0;
              if (s <= 0) return null;
              const odds = addModal.team.bestPrice;
              const profit = odds > 0 ? (s * odds) / 100 : (s * 100) / Math.abs(odds);
              return <div style={{ fontSize: 12.5, color: C.green, marginBottom: 12 }}>If wins: +${profit.toFixed(2)} profit</div>;
            })()}
            <label style={{ fontSize: 11, color: C.textMuted, display: "block", marginBottom: 4, fontWeight: 600 }}>Notes (optional)</label>
            <textarea
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder="Why this bet?"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 12.5, outline: "none", boxSizing: "border-box", resize: "vertical", minHeight: 50, marginBottom: 14, fontFamily: "inherit" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setAddModal(null)} style={{ flex: 1, padding: "9px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textDim, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              <button onClick={confirmBet} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: C.green, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Place Bet →</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ───────────────────────── player stats ─────────────────────────

type StatsSport = "nba" | "mlb" | "nfl";

// Compare a season average to a user-entered prop line. Tiered confidence:
// absolute delta + percentage edge both matter, so a 0.5-rebound edge on 5 RPG
// isn't treated the same as a 0.5-point edge on 24 PPG.
type PropVerdict = { rec: "OVER" | "UNDER" | "TOO CLOSE"; confidence: "HIGH" | "MEDIUM" | "LOW"; color: string };

type PlayerProp = {
  player: string;
  game: string;
  gameId: string;
  commenceTime: string;
  market: string;
  marketLabel: string;
  line: number;
  overOdds: number | null;
  overBook: string | null;
  underOdds: number | null;
  underBook: string | null;
};

// Map a prop market key to the corresponding season-average field on the NBA
// stats row. Skip markets without a clean mapping (e.g. threes — not in our
// leagueLeaders payload).
function statValueForMarket(player: any, market: string): number | null {
  switch (market) {
    case "player_points": return Number(player?.ppg) || null;
    case "player_rebounds": return Number(player?.rpg) || null;
    case "player_assists": return Number(player?.apg) || null;
    case "player_points_rebounds_assists":
      return (Number(player?.ppg) || 0) + (Number(player?.rpg) || 0) + (Number(player?.apg) || 0) || null;
    default: return null;
  }
}

function propVerdict(avg: number, lineStr: string): PropVerdict | null {
  const line = parseFloat(lineStr);
  if (!Number.isFinite(line) || line <= 0 || !avg) return null;
  const diff = avg - line;
  // Proportional thresholds so the same logic works across scales — NBA PPG
  // (~25), MLB per-game hits (~1.0), MLB per-game HR (~0.3). Absolute
  // thresholds would call a 0.5-HR diff "too close" when it's actually a
  // huge edge. 5% diff = too close; 15%+ = high confidence.
  const ratio = Math.abs(diff) / avg;
  if (ratio < 0.05) return { rec: "TOO CLOSE", confidence: "LOW", color: C.textMuted };
  if (diff > 0 && ratio > 0.15) return { rec: "OVER", confidence: "HIGH", color: C.green };
  if (diff > 0) return { rec: "OVER", confidence: "MEDIUM", color: "#86efac" };
  if (ratio > 0.15) return { rec: "UNDER", confidence: "HIGH", color: C.red };
  return { rec: "UNDER", confidence: "MEDIUM", color: "#fca5a5" };
}

function PlayerStatsPanel() {
  const [statsSport, setStatsSport] = useState<StatsSport>("nba");
  const [statsPlayers, setStatsPlayers] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsSearch, setStatsSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [propLines, setPropLines] = useState<{ pts: string; reb: string; ast: string }>({ pts: "", reb: "", ast: "" });
  const [propOdds, setPropOdds] = useState<PlayerProp[]>([]);
  const [propsLoading, setPropsLoading] = useState(false);
  const [propsError, setPropsError] = useState<string | null>(null);
  const [propsSearch, setPropsSearch] = useState("");
  const [propsFilter, setPropsFilter] = useState<string>("all");
  const [propFlash, setPropFlash] = useState<string | null>(null);

  // Single fetch — proxy returns the season leaderboard pre-flattened. Search
  // filters happen client-side so typing is instant; the search box doesn't
  // need to round-trip.
  const loadNBA = useCallback(async () => {
    setStatsLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/players?sport=nba`);
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || `Failed (${r.status})`);
        setStatsPlayers([]);
        return;
      }
      setStatsPlayers(j.data || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
      setStatsPlayers([]);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadMLB = useCallback(async () => {
    setStatsLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/players?sport=mlb`);
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || `Failed (${r.status})`);
        setStatsPlayers([]);
        return;
      }
      // New shape from route: { players: [{ id, name, team, avg, homeRuns,
      // rbi, hits, ops, atBats, runs, strikeouts, gamesPlayed }] }, already
      // sorted by HR desc and deduped across HR+AVG fetches.
      const raw: any[] = Array.isArray(j.players) ? j.players : [];
      const arr = raw.map((p, i) => ({
        id: p.id ?? Math.random(),
        name: p.name ?? "Unknown",
        team: p.team ?? "",
        rank: i + 1,
        stats: {
          avg: p.avg ?? "—",
          homeRuns: p.homeRuns ?? 0,
          rbi: p.rbi ?? 0,
          ops: p.ops ?? "—",
          hits: p.hits ?? 0,
          runs: p.runs ?? 0,
          atBats: p.atBats ?? 0,
          gp: p.gamesPlayed ?? 0,
        },
      }));
      setStatsPlayers(arr);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
      setStatsPlayers([]);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadProps = useCallback(async (sport: "basketball_nba" | "baseball_mlb") => {
    setPropsLoading(true);
    setPropsError(null);
    setPropsFilter("all");
    try {
      const markets =
        sport === "basketball_nba"
          ? "player_points,player_rebounds,player_assists,player_threes"
          : "batter_hits,batter_home_runs,batter_rbis,batter_total_bases,pitcher_strikeouts";
      const r = await fetch(`/api/player-props?sport=${sport}&markets=${markets}`);
      const j = await r.json();
      if (!r.ok) {
        setPropsError(j.error || `Props failed (${r.status})`);
        setPropOdds([]);
        return;
      }
      setPropOdds((j.data as PlayerProp[]) || []);
    } catch (e: any) {
      setPropsError(e?.message || "Props failed");
      setPropOdds([]);
    } finally {
      setPropsLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedPlayer(null);
    setPropLines({ pts: "", reb: "", ast: "" });
    if (statsSport === "nba") {
      loadNBA();
      loadProps("basketball_nba");
    } else if (statsSport === "mlb") {
      loadMLB();
      loadProps("baseball_mlb");
    } else {
      setStatsPlayers([]);
      setPropOdds([]);
    }
  }, [statsSport, loadNBA, loadMLB, loadProps]);

  // Quick paper bet from the inline helper — no live market, just the user's
  // what-if line. Books out at standard -110/DraftKings so the bet still
  // computes a believable potWin in the value-bets ledger.
  const addInlinePaperBet = (
    player: any,
    propLabel: string,
    line: string,
    side: "OVER" | "UNDER",
  ) => {
    const odds = -110;
    const stake = 100;
    const potWin = (stake * 100) / 110;
    const bet = {
      id: Date.now(),
      type: "prop",
      sport: statsSport === "mlb" ? "MLB" : "NBA",
      game: `${player.name} — ${propLabel}`,
      pick: `${side} ${line} ${propLabel}`,
      odds,
      book: "DraftKings",
      stake,
      potWin,
      edge: 0,
      status: "pending",
      placedAt: new Date().toISOString(),
      gameTime: null,
      notes: `Season avg vs line ${line} (no live market)`,
    };
    try {
      const existing = JSON.parse(localStorage.getItem(VALUE_BETS_KEY) || "[]");
      localStorage.setItem(VALUE_BETS_KEY, JSON.stringify([bet, ...existing]));
    } catch {}
    setPropFlash(`✓ Added ${player.name} ${side} ${line} ${propLabel} to paper bets`);
    setTimeout(() => setPropFlash(null), 3000);
  };

  const addPropBet = (prop: PlayerProp, side: "over" | "under") => {
    const odds = side === "over" ? prop.overOdds : prop.underOdds;
    const book = side === "over" ? prop.overBook : prop.underBook;
    if (odds === null || !book) return;
    const stake = 100;
    const potWin = odds > 0 ? (stake * odds) / 100 : (stake * 100) / Math.abs(odds);
    const bet = {
      id: Date.now(),
      type: "prop",
      sport: "NBA",
      game: `${prop.player} — ${prop.marketLabel}`,
      pick: `${side.toUpperCase()} ${prop.line} ${prop.marketLabel}`,
      odds,
      book,
      stake,
      potWin,
      edge: 0,
      status: "pending",
      placedAt: new Date().toISOString(),
      gameTime: prop.commenceTime,
      notes: `${prop.player} prop · ${prop.game}`,
    };
    try {
      const existing = JSON.parse(localStorage.getItem(VALUE_BETS_KEY) || "[]");
      localStorage.setItem(VALUE_BETS_KEY, JSON.stringify([bet, ...existing]));
    } catch {}
    setPropFlash(`✓ Added ${prop.player} ${side.toUpperCase()} ${prop.line} ${prop.marketLabel} to paper bets`);
    setTimeout(() => setPropFlash(null), 3000);
  };

  // Search + market filter applied client-side over the prop list.
  const visibleProps = propOdds.filter((p) => {
    if (propsFilter !== "all" && p.market !== propsFilter) return false;
    if (propsSearch.trim() && !p.player.toLowerCase().includes(propsSearch.trim().toLowerCase())) return false;
    return true;
  });

  const playerByName = new Map<string, any>();
  statsPlayers.forEach((p) => playerByName.set(p.name.toLowerCase().trim(), p));

  // Client-side filter — proxy already returned the full leaderboard.
  const visiblePlayers = statsSport === "nba" && statsSearch.trim()
    ? statsPlayers.filter((p) => p.name.toLowerCase().includes(statsSearch.trim().toLowerCase()))
    : statsPlayers;

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // No-op: filter is applied live on input change. Form here so Enter
    // doesn't reload the page.
  };

  const sportBtn = (id: StatsSport, label: string) => (
    <button
      key={id}
      onClick={() => setStatsSport(id)}
      style={{
        padding: "8px 16px",
        borderRadius: 8,
        border: `1px solid ${statsSport === id ? C.accent : C.border}`,
        background: statsSport === id ? "rgba(99,102,241,0.15)" : "transparent",
        color: statsSport === id ? "#fff" : C.textDim,
        fontSize: 13,
        fontWeight: statsSport === id ? 700 : 500,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {sportBtn("nba", "🏀 NBA")}
        {sportBtn("mlb", "⚾ MLB")}
        {sportBtn("nfl", "🏈 NFL")}
      </div>

      {statsSport === "nba" && (
        <form onSubmit={onSearchSubmit} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            value={statsSearch}
            onChange={(e) => setStatsSearch(e.target.value)}
            placeholder="Search players (e.g. curry, jokic) — blank shows the full 2025-26 leaderboard"
            style={{
              flex: 1,
              padding: "9px 12px",
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.card2,
              color: "#fff",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "9px 16px",
              borderRadius: 8,
              border: "none",
              background: C.accent,
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </form>
      )}

      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.08)",
            border: `1px solid rgba(239,68,68,0.35)`,
            borderRadius: 10,
            padding: 12,
            marginBottom: 16,
            color: C.red,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {statsSport === "nfl" && (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
            color: C.textDim,
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          🏈 NFL season starts September 2026 — check back then for player stats and prop bet helpers.
        </div>
      )}

      {statsLoading && (
        <div style={{ textAlign: "center", padding: 32, color: C.textDim, fontSize: 13 }}>
          Loading player stats…
        </div>
      )}

      {!statsLoading && statsSport === "nba" && visiblePlayers.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: 32, color: C.textDim, fontSize: 13 }}>
          {statsSearch.trim()
            ? `No NBA players matching "${statsSearch}". Note: only qualified leaders are listed.`
            : "No NBA players found."}
        </div>
      )}

      {!statsLoading && statsSport === "nba" && visiblePlayers.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {visiblePlayers.map((p) => {
            const isSelected = selectedPlayer?.id === p.id;
            const ppg = Number(p.ppg) || 0;
            const rpg = Number(p.rpg) || 0;
            const apg = Number(p.apg) || 0;
            const mpg = Number(p.mpg) || 0;
            const fgPct = p.fg_pct != null ? (Number(p.fg_pct) * 100).toFixed(1) + "%" : "—";
            const gp = p.gp ?? "—";
            return (
              <div
                key={p.id}
                style={{
                  background: C.card,
                  border: `1px solid ${isSelected ? C.accent : C.border}`,
                  borderRadius: 12,
                  padding: 16,
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onClick={() => {
                  if (isSelected) {
                    setSelectedPlayer(null);
                  } else {
                    setSelectedPlayer(p);
                    setPropLines({ pts: "", reb: "", ast: "" });
                  }
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
                      {p.team}
                      {gp !== "—" ? ` · ${gp} GP` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                      {ppg.toFixed(1)}
                    </div>
                    <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>
                      PPG
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {[
                    { label: "REB", value: rpg.toFixed(1) },
                    { label: "AST", value: apg.toFixed(1) },
                    { label: "MIN", value: mpg.toFixed(1) },
                    { label: "FG%", value: fgPct },
                  ].map((s) => (
                    <div
                      key={s.label}
                      style={{
                        background: C.card2,
                        borderRadius: 8,
                        padding: "8px 10px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {isSelected && (
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: `1px solid ${C.border}`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: "#a5b4fc" }}>
                      🎯 Prop Bet Helper
                    </div>
                    {(
                      [
                        { key: "pts" as const, label: "Points", avg: ppg },
                        { key: "reb" as const, label: "Rebounds", avg: rpg },
                        { key: "ast" as const, label: "Assists", avg: apg },
                      ]
                    ).map((row) => {
                      const lineVal = propLines[row.key];
                      const verdict = propVerdict(row.avg, lineVal);
                      return (
                        <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                          <div style={{ fontSize: 12, color: C.textDim, width: 70 }}>{row.label}</div>
                          <div style={{ fontSize: 11, color: C.textMuted }}>
                            Avg: <strong style={{ color: "#fff" }}>{row.avg.toFixed(1)}</strong>
                          </div>
                          <input
                            type="number"
                            step="0.5"
                            value={lineVal}
                            onChange={(e) => setPropLines((prev) => ({ ...prev, [row.key]: e.target.value }))}
                            placeholder="Line"
                            style={{
                              width: 90,
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: `1px solid ${C.border}`,
                              background: C.card2,
                              color: "#fff",
                              fontSize: 12,
                              outline: "none",
                            }}
                          />
                          {verdict && (
                            <>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  color: verdict.color,
                                }}
                              >
                                {verdict.rec === "OVER" ? "✅ OVER" : verdict.rec === "UNDER" ? "⬇️ UNDER" : "⚡ TOO CLOSE"}
                              </span>
                              {verdict.rec !== "TOO CLOSE" && (
                                <button
                                  onClick={() => addInlinePaperBet(p, row.label, lineVal, verdict.rec as "OVER" | "UNDER")}
                                  style={{
                                    padding: "3px 9px",
                                    borderRadius: 6,
                                    border: "none",
                                    background: "rgba(99,102,241,0.2)",
                                    color: "#a5b4fc",
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  + Paper Bet
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                    <div style={{ fontSize: 10, color: C.textMuted, marginTop: 8, fontStyle: "italic" }}>
                      Enter a line to compare against the season average. + Paper Bet logs a -110 / DraftKings entry.
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(statsSport === "nba" || statsSport === "mlb") && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
            🎯 Player Props — Live Odds
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
            Best Over/Under across US books · season averages compared · click to add to paper bets
          </div>

          {propFlash && (
            <div
              style={{
                background: "rgba(34,197,94,0.1)",
                border: `1px solid ${C.green}`,
                color: C.green,
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              {propFlash}
            </div>
          )}

          {propsError && (
            <div
              style={{
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.3)",
                borderRadius: 10,
                padding: 12,
                marginBottom: 12,
                color: "#fbbf24",
                fontSize: 13,
              }}
            >
              {propsError}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
            <input
              value={propsSearch}
              onChange={(e) => setPropsSearch(e.target.value)}
              placeholder="Search player props…"
              style={{
                flex: "1 1 200px",
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: C.card2,
                color: "#fff",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {(() => {
              // Derive pills from what's actually in the loaded prop list so
              // MLB shows hits/HR/etc and NBA shows points/reb/ast, no manual
              // sport-aware list needed.
              const seen = new Map<string, string>();
              propOdds.forEach((p) => seen.set(p.market, p.marketLabel));
              const pills = [{ id: "all", label: "All" }, ...Array.from(seen, ([id, label]) => ({ id, label }))];
              return pills.map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setPropsFilter(pill.id)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 999,
                    border: `1px solid ${propsFilter === pill.id ? C.accent : C.border}`,
                    background: propsFilter === pill.id ? "rgba(99,102,241,0.2)" : "transparent",
                    color: propsFilter === pill.id ? "#a5b4fc" : C.textDim,
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {pill.label}
                </button>
              ));
            })()}
          </div>

          {propsLoading ? (
            <div style={{ textAlign: "center", padding: 24, color: C.textDim, fontSize: 13 }}>
              Loading player props…
            </div>
          ) : visibleProps.length === 0 ? (
            <div style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 12, padding: 18, color: C.textMuted, fontSize: 13, textAlign: "center" }}>
              {propOdds.length === 0
                ? `No ${statsSport === "nba" ? "NBA" : "MLB"} player props available right now — books may not have posted lines yet for upcoming games.`
                : `No props match the current filter or search.`}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {visibleProps.map((prop) => {
                const match = playerByName.get(prop.player.toLowerCase().trim());
                const seasonAvg = match ? statValueForMarket(match, prop.market) : null;
                const overBetter = seasonAvg != null ? seasonAvg > prop.line + 0.5 : null;
                const underBetter = seasonAvg != null ? seasonAvg < prop.line - 0.5 : null;
                const propKey = `${prop.gameId}|${prop.market}|${prop.player}|${prop.line}`;
                return (
                  <div
                    key={propKey}
                    style={{
                      background: C.card,
                      border: `1px solid ${C.border}`,
                      borderRadius: 12,
                      padding: 14,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{prop.player}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                          {prop.game} · {prop.marketLabel}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted, whiteSpace: "nowrap" }}>
                        Line: <strong style={{ color: C.text }}>{prop.line}</strong>
                      </div>
                    </div>

                    {seasonAvg != null && (
                      <div
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          marginBottom: 10,
                          background: overBetter ? "rgba(34,197,94,0.08)" : underBetter ? "rgba(239,68,68,0.08)" : "rgba(99,102,241,0.06)",
                          border: `1px solid ${overBetter ? "rgba(34,197,94,0.25)" : underBetter ? "rgba(239,68,68,0.25)" : C.border}`,
                          fontSize: 12,
                          fontWeight: 600,
                          color: overBetter ? C.green : underBetter ? C.red : C.textDim,
                        }}
                      >
                        Season avg: <strong>{seasonAvg.toFixed(1)}</strong>
                        {overBetter && " — ✅ OVER looks good"}
                        {underBetter && " — ⬇️ UNDER looks good"}
                        {!overBetter && !underBetter && " — too close to call"}
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {[
                        { side: "over" as const, label: "OVER", odds: prop.overOdds, book: prop.overBook },
                        { side: "under" as const, label: "UNDER", odds: prop.underOdds, book: prop.underBook },
                      ].map((col) => (
                        <div key={col.side} style={{ background: C.card2, borderRadius: 8, padding: 10, textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>
                            {col.label} {prop.line}
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: col.odds != null && col.odds > 0 ? C.green : "#fff" }}>
                            {col.odds != null ? (col.odds > 0 ? "+" : "") + col.odds : "—"}
                          </div>
                          <div style={{ fontSize: 10, color: C.textMuted }}>{col.book ?? "—"}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button
                        onClick={() => addPropBet(prop, "over")}
                        disabled={prop.overOdds === null}
                        style={{
                          flex: 1,
                          padding: 8,
                          borderRadius: 6,
                          border: "none",
                          background: prop.overOdds === null ? C.card2 : "rgba(34,197,94,0.15)",
                          color: prop.overOdds === null ? C.textMuted : C.green,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: prop.overOdds === null ? "not-allowed" : "pointer",
                        }}
                      >
                        Bet OVER
                      </button>
                      <button
                        onClick={() => addPropBet(prop, "under")}
                        disabled={prop.underOdds === null}
                        style={{
                          flex: 1,
                          padding: 8,
                          borderRadius: 6,
                          border: "none",
                          background: prop.underOdds === null ? C.card2 : "rgba(239,68,68,0.15)",
                          color: prop.underOdds === null ? C.textMuted : C.red,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: prop.underOdds === null ? "not-allowed" : "pointer",
                        }}
                      >
                        Bet UNDER
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!statsLoading && statsSport === "mlb" && statsPlayers.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: 32, color: C.textDim, fontSize: 13 }}>
          No MLB leaders returned for the 2025 season.
        </div>
      )}

      {!statsLoading && statsSport === "mlb" && statsPlayers.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {statsPlayers.map((p) => {
            const isSelected = selectedPlayer?.id === p.id;
            // Per-game rates for MLB props. Prefer gp; fall back to atBats/3.3
            // approximation when gp is missing (matches user's spec formula).
            const gp = Number(p.stats.gp) || 0;
            const ab = Number(p.stats.atBats) || 0;
            const hits = Number(p.stats.hits) || 0;
            const hr = Number(p.stats.homeRuns) || 0;
            const rbi = Number(p.stats.rbi) || 0;
            const hitsPerGame = gp > 0 ? hits / gp : (ab > 0 ? (hits / ab) * 3.3 : 0);
            const hrPerGame = gp > 0 ? hr / gp : 0;
            const rbiPerGame = gp > 0 ? rbi / gp : 0;
            return (
            <div
              key={p.id}
              style={{
                background: C.card,
                border: `1px solid ${isSelected ? C.accent : C.border}`,
                borderRadius: 12,
                padding: 16,
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
              onClick={() => {
                if (isSelected) {
                  setSelectedPlayer(null);
                } else {
                  setSelectedPlayer(p);
                  setPropLines({ pts: "", reb: "", ast: "" });
                }
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
                    {p.team}
                    {p.rank != null && <span style={{ color: C.textMuted }}> · HR #{p.rank}</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.amber, lineHeight: 1 }}>
                    {p.stats.homeRuns ?? "—"}
                  </div>
                  <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>
                    HR
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {[
                  { label: "AVG", value: p.stats.avg ?? "—" },
                  { label: "RBI", value: p.stats.rbi ?? "—" },
                  { label: "OPS", value: p.stats.ops ?? "—" },
                  { label: "R", value: p.stats.runs ?? "—" },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      background: C.card2,
                      borderRadius: 8,
                      padding: "8px 10px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {isSelected && (
                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 14,
                    borderTop: `1px solid ${C.border}`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: "#a5b4fc" }}>
                    🎯 MLB Prop Helper
                  </div>
                  {([
                    { key: "pts" as const, label: "Hits", avg: hitsPerGame, paperLabel: "Hits" },
                    { key: "reb" as const, label: "HR", avg: hrPerGame, paperLabel: "HR" },
                    { key: "ast" as const, label: "RBI", avg: rbiPerGame, paperLabel: "RBI" },
                  ]).map((row) => {
                    const lineVal = propLines[row.key];
                    const verdict = propVerdict(row.avg, lineVal);
                    return (
                      <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 12, color: C.textDim, width: 70 }}>{row.label}</div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>
                          Per-game: <strong style={{ color: "#fff" }}>{row.avg.toFixed(2)}</strong>
                        </div>
                        <input
                          type="number"
                          step="0.5"
                          value={lineVal}
                          onChange={(e) => setPropLines((prev) => ({ ...prev, [row.key]: e.target.value }))}
                          placeholder="Line"
                          style={{
                            width: 90,
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: `1px solid ${C.border}`,
                            background: C.card2,
                            color: "#fff",
                            fontSize: 12,
                            outline: "none",
                          }}
                        />
                        {verdict && (
                          <>
                            <span style={{ fontSize: 12, fontWeight: 800, color: verdict.color }}>
                              {verdict.rec === "OVER" ? "✅ OVER" : verdict.rec === "UNDER" ? "⬇️ UNDER" : "⚡ TOO CLOSE"}
                            </span>
                            {verdict.rec !== "TOO CLOSE" && (
                              <button
                                onClick={() => addInlinePaperBet(p, row.paperLabel, lineVal, verdict.rec as "OVER" | "UNDER")}
                                style={{
                                  padding: "3px 9px",
                                  borderRadius: 6,
                                  border: "none",
                                  background: "rgba(99,102,241,0.2)",
                                  color: "#a5b4fc",
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                + Paper Bet
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ fontSize: 10, color: C.textMuted, marginTop: 8, fontStyle: "italic" }}>
                    Per-game = season total ÷ games played{gp === 0 && ab > 0 ? " (or hits/AB × 3.3 when GP missing)" : ""}.
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── esports ─────────────────────────

type EsportGame = "csgo" | "lol" | "valorant" | "dota2";

const ESPORT_GAMES: { id: EsportGame; label: string; color: string }[] = [
  { id: "csgo", label: "🔫 CS2", color: "#f59e0b" },
  { id: "lol", label: "⚔️ LoL", color: "#6366f1" },
  { id: "valorant", label: "🎯 Valorant", color: "#ef4444" },
  { id: "dota2", label: "🌿 Dota 2", color: "#22c55e" },
];

const ESPORT_MANUAL_KEY = "nexyru_esports_manual";

type ManualMatch = {
  id: number;
  game: EsportGame;
  team1: string;
  team2: string;
  tournament: string;
  startsAt: string;
  bo: number;
  pick: string;
};

type EsportMatch = {
  id: number;
  begin_at: string | null;
  status: string;
  bo: number;
  tournament: string;
  league: string;
  opponents: { id?: number; name: string; image?: string; acronym?: string }[];
  isLive?: boolean;
};

type EsportTeam = {
  id: number;
  name: string;
  acronym?: string;
  location?: string;
  image?: string;
};

// PandaScore's free tier doesn't return team rankings on /matches/upcoming
// or /teams. We approximate "favorite" via a hand-curated leaderboard per
// game — lower index = higher rank. Update when the meta shifts (rosters,
// recent results); a stale list will misclassify upsets as favorites.
const TOP_TEAMS: Record<EsportGame, string[]> = {
  csgo: [
    "Vitality", "Spirit", "MOUZ", "NAVI", "G2", "FaZe", "Falcons", "Liquid",
    "Astralis", "Heroic", "MIBR", "FURIA", "Complexity", "Cloud9", "BIG",
    "NIP", "Pain", "Eternal Fire", "TYLOO", "B8",
  ],
  lol: [
    "T1", "Gen.G", "Hanwha Life", "KT Rolster", "Bilibili Gaming",
    "Top Esports", "JD Gaming", "Weibo Gaming", "G2 Esports", "Fnatic",
    "MAD Lions", "FlyQuest", "Cloud9", "Team Liquid", "100 Thieves",
  ],
  valorant: [
    "Sentinels", "Evil Geniuses", "100 Thieves", "NRG", "LOUD",
    "FNATIC", "Karmine Corp", "Team Heretics", "Team Vitality",
    "Team Liquid", "Paper Rex", "DRX", "T1", "Gen.G", "ZETA DIVISION",
  ],
  dota2: [
    "Team Liquid", "Team Falcons", "BetBoom Team", "Team Spirit",
    "Tundra Esports", "Aurora Gaming", "Xtreme Gaming", "Heroic",
    "Nigma Galaxy", "OG",
  ],
};

function getTeamRank(name: string | undefined, acronym: string | undefined, game: EsportGame): number {
  if (!name) return 999;
  const top = TOP_TEAMS[game];
  const ln = name.toLowerCase().trim();
  const la = acronym?.toLowerCase().trim();
  for (let i = 0; i < top.length; i++) {
    const t = top[i].toLowerCase();
    if (ln === t || ln.includes(t) || t.includes(ln)) return i + 1;
    if (la && (la === t || t.includes(la))) return i + 1;
  }
  return 999;
}

type BettingAngle = {
  bothRanked: boolean;
  oneRanked: boolean;
  favoriteName: string;
  underdogName: string;
  favRank: number;
  dogRank: number;
  verdict: { pill: string; recText: string; color: string };
  formatInsight: string;
  tournamentInsight: string;
};

type EstimatedOdds = { odds1: number; odds2: number; prob1: number; prob2: number };

// Crude implied-odds estimate from curated ranks. Honest disclaimer: this is
// not a real market price — it's a ratio of two arbitrary leaderboard
// positions, useful only as a rough indicator of who's favored. Treat unknown
// rank (999 sentinel from getTeamRank) as the middle of the pack (50).
function estimateOdds(r1: number, r2: number): EstimatedOdds {
  if (r1 >= 999 && r2 >= 999) {
    return { odds1: -110, odds2: -110, prob1: 50, prob2: 50 };
  }
  const rank1 = r1 >= 999 ? 50 : r1;
  const rank2 = r2 >= 999 ? 50 : r2;
  const total = rank1 + rank2;
  const p1 = rank2 / total;
  const p2 = rank1 / total;
  const toAmerican = (p: number) =>
    p >= 0.5
      ? Math.round((-100 * p) / (1 - p))
      : Math.round((100 * (1 - p)) / p);
  return {
    odds1: toAmerican(p1),
    odds2: toAmerican(p2),
    prob1: Math.round(p1 * 100),
    prob2: Math.round(p2 * 100),
  };
}

type EsportPrediction = {
  winner: string;
  confidence: "high" | "medium" | "low";
  probability: number;
  reasoning: string;
  bet: string;
  betReason: string;
};

const BETTING_SITES = [
  { name: "Betway", url: "https://betway.com/esports", color: "#00a651" },
  { name: "GG.bet", url: "https://gg.bet", color: "#ff6b00" },
  { name: "Stake", url: "https://stake.com/esports", color: "#1c8aff" },
  { name: "Pinnacle", url: "https://pinnacle.com/esports", color: "#e63946" },
];

function computeBettingAngle(match: EsportMatch, game: EsportGame): BettingAngle {
  const opp1 = match.opponents[0];
  const opp2 = match.opponents[1];
  const r1 = getTeamRank(opp1?.name, opp1?.acronym, game);
  const r2 = getTeamRank(opp2?.name, opp2?.acronym, game);
  const bothRanked = r1 < 999 && r2 < 999;
  const oneRanked = (r1 < 999) !== (r2 < 999);
  const favIdx = r1 <= r2 ? 0 : 1;
  const favoriteName = match.opponents[favIdx]?.name ?? "TBD";
  const underdogName = match.opponents[1 - favIdx]?.name ?? "TBD";
  const favRank = Math.min(r1, r2);
  const dogRank = Math.max(r1, r2);
  // When only one team is ranked, treat as a clear edge (proxy rankDiff of 25)
  // — they're playing an unknown opponent, which is usually a lower-tier team.
  const rankDiff = bothRanked ? Math.abs(r1 - r2) : oneRanked ? 25 : 0;

  let verdict: BettingAngle["verdict"];
  if (!bothRanked && !oneRanked) {
    verdict = { pill: "COIN FLIP", recText: "⚡ COIN FLIP — Both teams unranked, skip or look for value odds", color: C.textMuted };
  } else if (rankDiff > 20) {
    verdict = { pill: "BET FAVORITE", recText: "✅ BET FAVORITE — Large skill gap, favorite should win comfortably", color: C.green };
  } else if (rankDiff > 10) {
    verdict = { pill: "LEAN FAVORITE", recText: "⭐ LEAN FAVORITE — Moderate edge, worth betting at good odds", color: "#86efac" };
  } else if (rankDiff > 5) {
    verdict = { pill: "SKIP", recText: "👀 SLIGHT EDGE — Close match, only bet if odds are +150 or better on favorite", color: C.amber };
  } else {
    verdict = { pill: "COIN FLIP", recText: "⚡ COIN FLIP — Too close to call, skip or look for value odds", color: C.textMuted };
  }

  let formatInsight: string;
  if (match.bo === 1) formatInsight = "⚠️ BO1 = high variance, upsets common — bet small";
  else if (match.bo === 3) formatInsight = "✅ BO3 = more skill-based, favorites win more often";
  else if (match.bo >= 5) formatInsight = "💎 BO5 = most reliable, favorites almost always win";
  else formatInsight = "Format not reported";

  const lg = (match.league || "").toLowerCase();
  const isMajor = ["major", "championship", "premier"].some((w) => lg.includes(w));
  const tournamentInsight = isMajor
    ? "🏆 Major tournament — results more predictable"
    : "📋 Minor event — expect more upsets";

  return { bothRanked, oneRanked, favoriteName, underdogName, favRank, dogRank, verdict, formatInsight, tournamentInsight };
}

function EsportsPanel() {
  const [game, setGame] = useState<EsportGame>("csgo");
  const [matches, setMatches] = useState<EsportMatch[] | null>(null);
  const [teams, setTeams] = useState<EsportTeam[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState<ManualMatch[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<Omit<ManualMatch, "id" | "game">>({
    team1: "",
    team2: "",
    tournament: "",
    startsAt: "",
    bo: 3,
    pick: "",
  });
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [expandedAngleIds, setExpandedAngleIds] = useState<Set<number>>(new Set());
  const [predictions, setPredictions] = useState<Record<number, EsportPrediction>>({});
  const [predicting, setPredicting] = useState<Set<number>>(new Set());

  const toggleAngle = (id: number) => {
    setExpandedAngleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const predictMatch = async (m: EsportMatch, r1: number, r2: number) => {
    if (predicting.has(m.id) || predictions[m.id]) return;
    setPredicting((prev) => new Set(prev).add(m.id));
    try {
      const opp1 = m.opponents[0];
      const opp2 = m.opponents[1];
      const res = await fetch("/api/esports/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team1: opp1?.name ?? "Team 1",
          team2: opp2?.name ?? "Team 2",
          team1Rank: r1,
          team2Rank: r2,
          tournament: m.tournament || m.league || "Unknown",
          format: m.bo > 0 ? `Best of ${m.bo}` : "Unknown",
          game,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPredictions((prev) => ({ ...prev, [m.id]: data as EsportPrediction }));
      }
    } catch {
      // Surface failures via the absence of a prediction; button stays clickable.
    } finally {
      setPredicting((prev) => {
        const next = new Set(prev);
        next.delete(m.id);
        return next;
      });
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ESPORT_MANUAL_KEY);
      if (raw) setManual(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async (g: EsportGame) => {
    setLoading(true);
    setError(null);
    setMatches(null);
    setTeams(null);
    try {
      const [liveRes, matchRes, teamRes] = await Promise.all([
        fetch(`/api/esports?game=${g}&type=live`),
        fetch(`/api/esports?game=${g}&type=matches`),
        fetch(`/api/esports?game=${g}&type=teams`),
      ]);
      const liveJson = await liveRes.json();
      const matchJson = await matchRes.json();
      const teamJson = await teamRes.json();
      if (!matchRes.ok) {
        setError(matchJson.error || `Failed (${matchRes.status})`);
        setMatches([]);
        setTeams([]);
        return;
      }
      const liveMatches: EsportMatch[] = (liveRes.ok ? liveJson.data || [] : []).map(
        (m: EsportMatch) => ({ ...m, isLive: true }),
      );
      const upcoming: EsportMatch[] = matchJson.data || [];
      // Live matches first — they're more time-sensitive for betting decisions.
      setMatches([...liveMatches, ...upcoming]);
      setTeams(teamRes.ok ? teamJson.data || [] : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
      setMatches([]);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(game); }, [game, load]);

  const persistManual = (next: ManualMatch[]) => {
    setManual(next);
    try { localStorage.setItem(ESPORT_MANUAL_KEY, JSON.stringify(next)); } catch {}
  };

  const addManualMatch = () => {
    if (!draft.team1.trim() || !draft.team2.trim()) return;
    const entry: ManualMatch = {
      id: Date.now(),
      game,
      team1: draft.team1.trim(),
      team2: draft.team2.trim(),
      tournament: draft.tournament.trim(),
      startsAt: draft.startsAt,
      bo: draft.bo,
      pick: draft.pick.trim(),
    };
    persistManual([entry, ...manual]);
    setDraft({ team1: "", team2: "", tournament: "", startsAt: "", bo: 3, pick: "" });
    setShowAdd(false);
  };

  const removeManualMatch = (id: number) => {
    persistManual(manual.filter((m) => m.id !== id));
  };

  const gameManual = manual.filter((m) => m.game === game);
  const gameMeta = ESPORT_GAMES.find((g) => g.id === game)!;

  const gameBtn = (id: EsportGame, label: string, color: string) => (
    <button
      key={id}
      onClick={() => setGame(id)}
      style={{
        padding: "8px 16px",
        borderRadius: 8,
        border: `1px solid ${game === id ? color : C.border}`,
        background: game === id ? `${color}26` : "transparent",
        color: game === id ? "#fff" : C.textDim,
        fontSize: 13,
        fontWeight: game === id ? 700 : 500,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {ESPORT_GAMES.map((g) => gameBtn(g.id, g.label, g.color))}
      </div>

      {error && (
        <div
          style={{
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.35)",
            borderRadius: 10,
            padding: 14,
            marginBottom: 16,
            color: "#fbbf24",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <strong>🎮 No live esports data.</strong> {error}
          <div style={{ color: C.textMuted, marginTop: 6, fontSize: 12 }}>
            Sign up free at <a href="https://pandascore.co" target="_blank" rel="noreferrer" style={{ color: C.accent }}>pandascore.co</a>,
            add <code>PANDASCORE_TOKEN</code> to Vercel env, and this section will populate automatically.
            You can still track matches manually below.
          </div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 24, color: C.textDim, fontSize: 13 }}>
          Loading {gameMeta.label} matches…
        </div>
      )}

      {!loading && !error && matches && matches.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Upcoming matches
          </div>
          <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
            {matches.map((m) => {
              const cd = m.begin_at ? countdownLabel(m.begin_at, nowMs) : { label: "", live: false };
              const opp1 = m.opponents[0];
              const opp2 = m.opponents[1];
              const showLive = m.isLive || cd.live;
              const angle = computeBettingAngle(m, game);
              const expanded = expandedAngleIds.has(m.id);
              return (
                <div
                  key={m.id}
                  style={{
                    background: C.card,
                    border: `1px solid ${showLive ? "rgba(239,68,68,0.5)" : C.border}`,
                    borderRadius: 12,
                    padding: 14,
                    boxShadow: showLive ? "0 0 20px rgba(239,68,68,0.08)" : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, fontSize: 12, color: C.textMuted, flexWrap: "wrap", gap: 8 }}>
                    <span style={{ color: gameMeta.color, fontWeight: 700 }}>{gameMeta.label}</span>
                    <span>{m.tournament || m.league || "—"}</span>
                    <span style={{ color: showLive ? C.red : C.textDim, fontWeight: showLive ? 700 : 500 }}>
                      {showLive ? "🔴 LIVE" : cd.label || (m.begin_at ? new Date(m.begin_at).toLocaleString() : "—")}
                    </span>
                    <span
                      style={{
                        marginLeft: "auto",
                        padding: "3px 10px",
                        borderRadius: 6,
                        fontSize: 10.5,
                        fontWeight: 800,
                        background: `${angle.verdict.color}26`,
                        color: angle.verdict.color,
                        border: `1px solid ${angle.verdict.color}40`,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {angle.verdict.pill}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center" }}>
                    <div style={{ textAlign: "right", fontSize: 14, fontWeight: 700 }}>
                      {opp1?.name ?? "TBD"}
                      {opp1?.acronym && <span style={{ color: C.textMuted, fontWeight: 500, marginLeft: 6 }}>({opp1.acronym})</span>}
                    </div>
                    <div style={{ color: C.textMuted, fontSize: 12, fontWeight: 700 }}>vs</div>
                    <div style={{ textAlign: "left", fontSize: 14, fontWeight: 700 }}>
                      {opp2?.name ?? "TBD"}
                      {opp2?.acronym && <span style={{ color: C.textMuted, fontWeight: 500, marginLeft: 6 }}>({opp2.acronym})</span>}
                    </div>
                  </div>
                  {m.bo > 0 && (
                    <div style={{ marginTop: 10, fontSize: 11, color: C.textMuted, textAlign: "center" }}>
                      Best of {m.bo}
                    </div>
                  )}

                  {(() => {
                    // Estimated odds derived from curated rank — not a real
                    // market price. Surface as "ESTIMATED" so users don't
                    // confuse it with a sportsbook quote.
                    const r1 = getTeamRank(opp1?.name, opp1?.acronym, game);
                    const r2 = getTeamRank(opp2?.name, opp2?.acronym, game);
                    const eo = estimateOdds(r1, r2);
                    return (
                      <>
                        <div style={{ marginTop: 12, fontSize: 10, color: C.textMuted, textAlign: "center", letterSpacing: 0.6, textTransform: "uppercase" }}>
                          Estimated odds (from rankings)
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
                          {[
                            { name: opp1?.name ?? "TBD", odds: eo.odds1, prob: eo.prob1 },
                            { name: opp2?.name ?? "TBD", odds: eo.odds2, prob: eo.prob2 },
                          ].map((side, i) => (
                            <div key={i} style={{ background: C.card2, borderRadius: 8, padding: 10, textAlign: "center" }}>
                              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>{side.name}</div>
                              <div style={{ fontSize: 20, fontWeight: 800, color: side.odds > 0 ? C.green : "#fff" }}>
                                {side.odds > 0 ? "+" : ""}{side.odds}
                              </div>
                              <div style={{ fontSize: 11, color: C.textMuted }}>{side.prob}% to win</div>
                            </div>
                          ))}
                        </div>

                        <div style={{ marginTop: 10 }}>
                          {predictions[m.id] ? (
                            (() => {
                              const p = predictions[m.id];
                              const confColor =
                                p.confidence === "high" ? C.green
                                : p.confidence === "medium" ? C.amber
                                : C.textMuted;
                              const isBet = p.bet.toUpperCase().startsWith("BET");
                              return (
                                <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, fontSize: 12.5, lineHeight: 1.55 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                                    <span style={{ fontWeight: 700 }}>🏆 AI picks {p.winner}</span>
                                    <span style={{ color: C.textMuted, fontWeight: 500 }}>({p.probability}%)</span>
                                    <span style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: `${confColor}26`, color: confColor, border: `1px solid ${confColor}40`, textTransform: "uppercase", letterSpacing: 0.5 }}>
                                      {p.confidence}
                                    </span>
                                  </div>
                                  {p.reasoning && (
                                    <div style={{ color: C.textDim, marginBottom: 8 }}>{p.reasoning}</div>
                                  )}
                                  <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: 6, fontSize: 11.5, fontWeight: 800, background: isBet ? `${C.green}26` : `${C.textMuted}26`, color: isBet ? C.green : C.textMuted, border: `1px solid ${isBet ? C.green : C.textMuted}40`, letterSpacing: 0.4 }}>
                                    {p.bet}
                                  </div>
                                  {p.betReason && (
                                    <div style={{ color: C.textMuted, marginTop: 6, fontSize: 11.5 }}>{p.betReason}</div>
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                            <button
                              onClick={() => predictMatch(m, r1, r2)}
                              disabled={predicting.has(m.id)}
                              style={{
                                width: "100%",
                                padding: "8px 12px",
                                borderRadius: 8,
                                border: `1px solid ${predicting.has(m.id) ? C.border : C.accent}`,
                                background: predicting.has(m.id) ? C.card2 : `${C.accent}26`,
                                color: predicting.has(m.id) ? C.textMuted : "#a5b4fc",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: predicting.has(m.id) ? "not-allowed" : "pointer",
                              }}
                            >
                              {predicting.has(m.id) ? "Thinking…" : "✦ AI Predict"}
                            </button>
                          )}
                        </div>
                      </>
                    );
                  })()}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    {BETTING_SITES.map((site) => (
                      <a
                        key={site.name}
                        href={site.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: `${site.color}15`,
                          border: `1px solid ${site.color}40`,
                          color: site.color,
                          textDecoration: "none",
                        }}
                      >
                        {site.name} →
                      </a>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>
                    ⚠️ Verify odds directly on site — our estimates are based on rankings only.
                  </div>

                  <button
                    onClick={() => toggleAngle(m.id)}
                    style={{
                      marginTop: 10,
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: `1px solid ${C.border}`,
                      background: "transparent",
                      color: C.textDim,
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {expanded ? "▲ Hide betting angle" : "▼ Show betting angle"}
                  </button>

                  {expanded && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 12,
                        background: C.card2,
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        fontSize: 12.5,
                        lineHeight: 1.6,
                      }}
                    >
                      {angle.bothRanked || angle.oneRanked ? (
                        <div style={{ marginBottom: 8 }}>
                          <div>
                            🏆 <strong>Favorite:</strong> {angle.favoriteName}
                            {angle.favRank < 999 && <span style={{ color: C.textMuted }}> (Ranked #{angle.favRank})</span>}
                          </div>
                          <div>
                            🐕 <strong>Underdog:</strong> {angle.underdogName}
                            {angle.dogRank < 999
                              ? <span style={{ color: C.textMuted }}> (Ranked #{angle.dogRank})</span>
                              : <span style={{ color: C.textMuted }}> (Unranked)</span>}
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginBottom: 8, color: C.textMuted, fontStyle: "italic" }}>
                          Neither team in the curated top-{TOP_TEAMS[game].length} list — no rank signal available.
                        </div>
                      )}
                      <div style={{ color: angle.verdict.color, fontWeight: 700, marginBottom: 6 }}>
                        {angle.verdict.recText}
                      </div>
                      <div style={{ color: C.textDim, marginBottom: 4 }}>{angle.formatInsight}</div>
                      <div style={{ color: C.textDim }}>{angle.tournamentInsight}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {!loading && !error && matches && matches.length === 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, color: C.textMuted, fontSize: 13, marginBottom: 24 }}>
          No upcoming {gameMeta.label} matches in PandaScore right now.
        </div>
      )}

      {!loading && !error && teams && teams.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Top teams
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
            {teams.map((t, i) => (
              <div
                key={t.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 1fr auto auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 14px",
                  borderBottom: i < teams.length - 1 ? `1px solid ${C.border}` : "none",
                  fontSize: 13,
                }}
              >
                <span style={{ color: C.textMuted, fontWeight: 700 }}>#{i + 1}</span>
                <span style={{ fontWeight: 600 }}>{t.name}</span>
                <span style={{ fontSize: 11, color: C.textMuted }}>{t.acronym || ""}</span>
                <span style={{ fontSize: 11, color: C.textMuted }}>{t.location || ""}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* manual tracker — always available */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Your tracked matches ({gameManual.length})
        </div>
        <button
          onClick={() => setShowAdd((s) => !s)}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: showAdd ? C.card2 : C.accent,
            color: showAdd ? C.textDim : "#fff",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {showAdd ? "Cancel" : "+ Add match"}
        </button>
      </div>

      {showAdd && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input
              placeholder="Team 1"
              value={draft.team1}
              onChange={(e) => setDraft({ ...draft, team1: e.target.value })}
              style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 13, outline: "none" }}
            />
            <input
              placeholder="Team 2"
              value={draft.team2}
              onChange={(e) => setDraft({ ...draft, team2: e.target.value })}
              style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 13, outline: "none" }}
            />
          </div>
          <input
            placeholder="Tournament (e.g. ESL Pro League S20)"
            value={draft.tournament}
            onChange={(e) => setDraft({ ...draft, tournament: e.target.value })}
            style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 13, outline: "none" }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 10 }}>
            <input
              type="datetime-local"
              value={draft.startsAt}
              onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
              style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 13, outline: "none" }}
            />
            <select
              value={draft.bo}
              onChange={(e) => setDraft({ ...draft, bo: parseInt(e.target.value, 10) })}
              style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 13, outline: "none" }}
            >
              <option value={1}>BO1</option>
              <option value={3}>BO3</option>
              <option value={5}>BO5</option>
            </select>
          </div>
          <input
            placeholder="Your pick (optional)"
            value={draft.pick}
            onChange={(e) => setDraft({ ...draft, pick: e.target.value })}
            style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 13, outline: "none" }}
          />
          <button
            onClick={addManualMatch}
            disabled={!draft.team1.trim() || !draft.team2.trim()}
            style={{
              padding: "9px",
              borderRadius: 8,
              border: "none",
              background: !draft.team1.trim() || !draft.team2.trim() ? C.card2 : C.green,
              color: !draft.team1.trim() || !draft.team2.trim() ? C.textDim : "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: !draft.team1.trim() || !draft.team2.trim() ? "not-allowed" : "pointer",
            }}
          >
            Save match
          </button>
        </div>
      )}

      {gameManual.length === 0 ? (
        <div style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 12, padding: 18, color: C.textMuted, fontSize: 12.5, textAlign: "center" }}>
          No matches tracked for {gameMeta.label}. Add one above to log a match you're watching.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {gameManual.map((m) => {
            const cd = m.startsAt ? countdownLabel(m.startsAt, nowMs) : { label: "", live: false };
            return (
              <div
                key={m.id}
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: 12,
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {m.team1} <span style={{ color: C.textMuted, fontWeight: 500 }}>vs</span> {m.team2}
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>
                    {m.tournament || "—"} · BO{m.bo}
                    {cd.label && <> · <span style={{ color: cd.live ? C.red : C.textDim, fontWeight: cd.live ? 700 : 500 }}>{cd.live ? "🔴 LIVE" : cd.label}</span></>}
                  </div>
                  {m.pick && (
                    <div style={{ fontSize: 11, color: C.accent, marginTop: 3, fontWeight: 600 }}>
                      Pick: {m.pick}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeManualMatch(m.id)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 6,
                    border: `1px solid ${C.border}`,
                    background: "transparent",
                    color: C.textMuted,
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── prediction markets ─────────────────────────

type PolyMarket = {
  id?: string;
  question?: string;
  outcomes?: string;
  outcomePrices?: string;
  volume?: string | number;
  liquidity?: string | number;
  category?: string;
  slug?: string;
  endDate?: string;
  endDateIso?: string;
};

type SimpleMarket = {
  id: string;
  question: string;
  yesPct: number;
  noPct: number;
  volume: number;
  liquidity: number;
  score: number;
  category: string;
  slug: string;
  endDate: string;
};

// 0-100 score: 40pts volume + 20pts liquidity + 40pts edge (closer to 50/50
// = more interesting bet).
function scoreMarket(yesFrac: number, volume: number, liquidity: number): number {
  let score = 0;
  if (volume > 1_000_000) score += 40;
  else if (volume > 500_000) score += 35;
  else if (volume > 100_000) score += 28;
  else if (volume > 50_000) score += 20;
  else if (volume > 10_000) score += 12;
  else score += 5;

  if (liquidity > 100_000) score += 20;
  else if (liquidity > 50_000) score += 15;
  else if (liquidity > 10_000) score += 10;
  else score += 3;

  const distFrom50 = Math.abs(yesFrac - 0.5);
  if (distFrom50 < 0.05) score += 40;
  else if (distFrom50 < 0.10) score += 35;
  else if (distFrom50 < 0.20) score += 25;
  else if (distFrom50 < 0.30) score += 15;
  else score += 5;

  return Math.min(100, score);
}

function scoreBadgeForMarket(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: "🔥 Hot", color: "#22c55e", bg: "rgba(34,197,94,0.15)" };
  if (score >= 60) return { label: "⭐ Good", color: "#60a5fa", bg: "rgba(96,165,250,0.15)" };
  if (score >= 40) return { label: "👀 Watch", color: "#facc15", bg: "rgba(250,204,21,0.15)" };
  return { label: "❄️ Low", color: "#6b7280", bg: "rgba(107,114,128,0.15)" };
}

function safeParseJson<T>(s: unknown): T | null {
  if (typeof s !== "string") return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}

// Polymarket's gamma-api returns empty `category` for most markets, so the
// category filter never matched anything. Derive a category from keywords in
// the question text instead.
function detectCategory(question: string): string {
  const q = (question || "").toLowerCase();
  if (q.includes("bitcoin") || q.includes("crypto") || q.includes("eth") || q.includes("ether") || q.includes("sol") || q.includes("solana") || q.includes("token") || q.includes(" price"))
    return "Crypto";
  if (q.includes("election") || q.includes("president") || q.includes("congress") || q.includes("senate") || q.includes("democrat") || q.includes("republican") || q.includes("trump") || q.includes("biden") || q.includes("vote"))
    return "Politics";
  if (q.includes("nba") || q.includes("nfl") || q.includes("mlb") || q.includes("nhl") || q.includes("wimbledon") || q.includes("world cup") || q.includes("super bowl") || q.includes("champion") || q.includes("winner") || q.includes("game") || q.includes("match") || q.includes("tournament") || q.includes("league"))
    return "Sports";
  if (q.includes("fed") || q.includes("rate") || q.includes("gdp") || q.includes("inflation") || q.includes("stock") || q.includes("recession") || q.includes("economy") || q.includes("market"))
    return "Finance";
  if (q.includes("war") || q.includes("ukraine") || q.includes("russia") || q.includes("china") || q.includes("taiwan") || q.includes("ai") || q.includes("nuclear") || q.includes("israel") || q.includes("iran"))
    return "World";
  return "Other";
}

function normalizePolymarket(m: PolyMarket): SimpleMarket | null {
  const prices = safeParseJson<string[]>(m.outcomePrices);
  const outcomes = safeParseJson<string[]>(m.outcomes);
  if (!prices || prices.length !== 2 || !outcomes || outcomes.length !== 2) return null;
  const yes = parseFloat(prices[0]);
  const no = parseFloat(prices[1]);
  if (!Number.isFinite(yes) || !Number.isFinite(no)) return null;
  const toNum = (v: unknown) =>
    typeof v === "number" ? v : parseFloat(String(v ?? "0")) || 0;
  const question = m.question ?? "Unknown market";
  const volume = toNum(m.volume);
  const liquidity = toNum(m.liquidity);
  return {
    id: m.id ?? m.slug ?? question ?? Math.random().toString(36).slice(2),
    question,
    yesPct: yes * 100,
    noPct: no * 100,
    volume,
    liquidity,
    score: scoreMarket(yes, volume, liquidity),
    category: m.category && m.category.trim() !== "" ? m.category : detectCategory(question),
    slug: m.slug ?? "",
    endDate: m.endDate ?? m.endDateIso ?? "",
  };
}

const CATEGORY_PILLS = ["All", "Sports", "Politics", "Crypto", "Finance", "World"];

type PolySortMode = "score" | "volume" | "even" | "trending";

const POLY_SORT_OPTIONS: { id: PolySortMode; label: string }[] = [
  { id: "score", label: "🏆 Best Score" },
  { id: "volume", label: "💰 Most Volume" },
  { id: "even", label: "⚖️ Most Even" },
  { id: "trending", label: "🔥 Trending" },
];

type AiPrediction = {
  probability: number;
  confidence: string;
  reasoning: string;
  error?: string;
};

function PolymarketPanel() {
  const [markets, setMarkets] = useState<SimpleMarket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const [sortMode, setSortMode] = useState<PolySortMode>("score");
  const [aiPredictions, setAiPredictions] = useState<Record<string, AiPrediction>>({});
  const [predicting, setPredicting] = useState<Record<string, boolean>>({});
  const [batchPredicting, setBatchPredicting] = useState(false);

  const predictMarket = useCallback(async (m: SimpleMarket) => {
    setPredicting((p) => ({ ...p, [m.id]: true }));
    try {
      const res = await fetch("/api/predict-market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: m.question,
          yesPrice: m.yesPct / 100,
          volume: m.volume,
          endDate: m.endDate || "unknown",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiPredictions((p) => ({ ...p, [m.id]: { probability: 0, confidence: "low", reasoning: "", error: data?.error || `HTTP ${res.status}` } }));
      } else {
        setAiPredictions((p) => ({ ...p, [m.id]: data as AiPrediction }));
      }
    } catch (e) {
      setAiPredictions((p) => ({ ...p, [m.id]: { probability: 0, confidence: "low", reasoning: "", error: e instanceof Error ? e.message : "Network error" } }));
    } finally {
      setPredicting((p) => ({ ...p, [m.id]: false }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/polymarket")
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        if (body?.error) {
          setError(body.error);
          setMarkets([]);
          return;
        }
        const arr = (body?.markets as PolyMarket[] ?? [])
          .map(normalizePolymarket)
          .filter((x): x is SimpleMarket => x !== null);
        setMarkets(arr);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e));
        setMarkets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const ranked = useMemo(() => {
    if (!markets) return [];
    const byCat = category === "All"
      ? markets
      : markets.filter((m) => m.category.toLowerCase().includes(category.toLowerCase()));
    const sorted = byCat.slice();
    if (sortMode === "score") sorted.sort((a, b) => b.score - a.score);
    else if (sortMode === "even") sorted.sort((a, b) => Math.abs(a.yesPct - 50) - Math.abs(b.yesPct - 50));
    else sorted.sort((a, b) => b.volume - a.volume); // volume + trending
    return sorted;
  }, [markets, category, sortMode]);

  const sortLabel = POLY_SORT_OPTIONS.find((o) => o.id === sortMode)?.label ?? "";

  const predictTop5 = async () => {
    if (batchPredicting) return;
    setBatchPredicting(true);
    try {
      const top = ranked.slice(0, 5);
      // Sequential with a small delay between calls — keeps us under rate
      // limits and lets the UI surface results as they land instead of
      // all-at-once when the Promise.all resolves.
      for (const m of top) {
        await predictMarket(m);
        await new Promise((r) => setTimeout(r, 500));
      }
    } finally {
      setBatchPredicting(false);
    }
  };
  const batchCount = Math.min(5, ranked.length);

  return (
    <>
      <SectionTitle
        title="Polymarket"
        subtitle="Plain-English chance · AI predictions compare to market price"
        right={
          ranked.length > 0 ? (
            <button
              onClick={predictTop5}
              disabled={batchPredicting}
              title={`Runs ${batchCount} Claude API call${batchCount === 1 ? "" : "s"} — about $0.01 total`}
              style={{
                background: batchPredicting ? C.card2 : "rgba(99,102,241,0.15)",
                color: batchPredicting ? C.textDim : "#a5b4fc",
                border: `1px solid ${C.accent}`,
                borderRadius: 999,
                padding: "4px 14px",
                fontSize: 11.5,
                fontWeight: 700,
                cursor: batchPredicting ? "wait" : "pointer",
                letterSpacing: "0.02em",
              }}
            >
              {batchPredicting ? `🤔 Predicting ${batchCount}…` : `✦ Predict Top ${batchCount}`}
            </button>
          ) : null
        }
      />

      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {POLY_SORT_OPTIONS.map((o) => {
          const active = sortMode === o.id;
          return (
            <button
              key={o.id}
              onClick={() => setSortMode(o.id)}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: `1px solid ${active ? C.accent : C.border}`,
                background: active ? C.accent : C.card2,
                color: active ? "#fff" : C.text,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {CATEGORY_PILLS.map((c) => {
          const active = category === c;
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                border: `1px solid ${active ? C.accent : C.border}`,
                background: active ? C.accent : C.card2,
                color: active ? "#fff" : C.text,
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
      ) : error ? (
        <ErrorBox>Polymarket failed: {error}</ErrorBox>
      ) : ranked.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, color: C.textMuted, fontSize: 13 }}>
          No markets in this category right now.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
            <strong style={{ color: C.text }}>{ranked.length}</strong> {ranked.length === 1 ? "market" : "markets"} · sorted by {sortLabel}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ranked.map((m) => (
              <PolymarketRow
                key={m.id}
                m={m}
                prediction={aiPredictions[m.id]}
                predicting={!!predicting[m.id]}
                onPredict={() => predictMarket(m)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function PolymarketRow({
  m,
  prediction,
  predicting,
  onPredict,
}: {
  m: SimpleMarket;
  prediction?: AiPrediction;
  predicting: boolean;
  onPredict: () => void;
}) {
  const url = m.slug ? `https://polymarket.com/event/${m.slug}` : "https://polymarket.com";
  const badge = scoreBadgeForMarket(m.score);

  // Plain-English read on the YES price. 5 spec'd buckets, with 40-45 and
  // 55-60 folded into adjacent buckets so nothing slips through a gap.
  const signal = (() => {
    if (m.yesPct > 75) return { text: "Market is very confident YES happens. Low upside on YES bet.", color: C.textMuted };
    if (m.yesPct >= 55) return { text: "Market leans YES. Decent odds on NO if you disagree.", color: C.text };
    if (m.yesPct >= 45) return { text: "⚡ Coin flip — could go either way. Both sides have value.", color: C.green };
    if (m.yesPct >= 25) return { text: "Market leans NO. Decent odds on YES if you disagree.", color: C.text };
    return { text: "Market is very confident NO. High risk, high reward on YES.", color: C.amber };
  })();

  const fmtMoney = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}k`;
    return `$${v.toFixed(0)}`;
  };

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text, flex: 1, minWidth: 0, lineHeight: 1.4 }}>{m.question}</span>
        <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 6, background: badge.bg, color: badge.color, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
          {badge.label} — {m.score}/100
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10, fontSize: 12.5, flexWrap: "wrap" }}>
        <span><span style={{ color: C.textMuted }}>YES </span><strong style={{ color: C.green }}>{m.yesPct.toFixed(0)}%</strong></span>
        <span style={{ color: C.textMuted }}>·</span>
        <span><span style={{ color: C.textMuted }}>NO </span><strong style={{ color: C.red }}>{m.noPct.toFixed(0)}%</strong></span>
        <span style={{ color: C.textMuted }}>·</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "rgba(99,102,241,0.18)", color: "#a5b4fc", whiteSpace: "nowrap", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {m.category}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, height: 8, borderRadius: 4, overflow: "hidden", display: "flex", background: C.card2, border: `1px solid ${C.border}` }}>
          <div style={{ width: `${m.yesPct}%`, background: C.green }}/>
          <div style={{ width: `${m.noPct}%`, background: C.red }}/>
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 8 }}>
        Volume: <strong style={{ color: C.text }}>{fmtMoney(m.volume)}</strong>
        {m.liquidity > 0 && <> · Liquidity: <strong style={{ color: C.text }}>{fmtMoney(m.liquidity)}</strong></>}
      </div>

      <div style={{ fontSize: 12, color: signal.color, marginBottom: 10, lineHeight: 1.45 }}>
        Signal: {signal.text}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#a5b4fc", textDecoration: "none", fontWeight: 600 }}>
          View on Polymarket →
        </a>
        {!prediction && (
          <button
            onClick={onPredict}
            disabled={predicting}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: `1px solid rgba(99,102,241,0.4)`,
              background: "transparent",
              color: predicting ? C.textMuted : "#a5b4fc",
              fontSize: 11,
              fontWeight: 700,
              cursor: predicting ? "wait" : "pointer",
            }}
          >
            {predicting ? "🤔 Predicting…" : "✦ AI Predict"}
          </button>
        )}
      </div>

      {prediction && <AiPredictionPanel marketYes={m.yesPct} prediction={prediction}/>}
    </div>
  );
}

function AiPredictionPanel({ marketYes, prediction }: { marketYes: number; prediction: AiPrediction }) {
  if (prediction.error) {
    return (
      <div style={{ background: "rgba(239,68,68,0.08)", border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 8, padding: "10px 12px", marginTop: 10, fontSize: 12, color: "#fca5a5" }}>
        <strong>AI prediction failed.</strong> {prediction.error}
        {prediction.error.toLowerCase().includes("api key") && (
          <div style={{ marginTop: 4, color: "#fca5a5", opacity: 0.8 }}>
            Set ANTHROPIC_API_KEY in the Vercel project env to enable predictions.
          </div>
        )}
      </div>
    );
  }
  const aiYes = prediction.probability;
  const diff = aiYes - marketYes;
  const meaningful = Math.abs(diff) > 5;
  return (
    <div style={{ background: C.card2, borderRadius: 8, padding: 12, marginTop: 10, border: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 700 }}>Market says</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.text }}>{marketYes.toFixed(0)}%</div>
        </div>
        <div style={{ fontSize: 18, color: C.textMuted, padding: "0 12px" }}>vs</div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 10, color: "#a5b4fc", marginBottom: 2, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 700 }}>AI predicts</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#a5b4fc" }}>{aiYes}%</div>
        </div>
      </div>

      {meaningful ? (
        <div style={{
          padding: "10px 12px", borderRadius: 6,
          background: diff > 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${diff > 0 ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          marginBottom: 8,
        }}>
          {diff > 0 ? (
            <>
              <div style={{ color: C.green, fontSize: 13, fontWeight: 700 }}>
                ✅ BET YES — AI thinks {diff.toFixed(0)}% more likely than market
              </div>
              <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>
                Market underpricing YES — potential edge on YES bet
              </div>
            </>
          ) : (
            <>
              <div style={{ color: C.red, fontSize: 13, fontWeight: 700 }}>
                ✅ BET NO — AI thinks {Math.abs(diff).toFixed(0)}% less likely than market
              </div>
              <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>
                Market overpricing YES — NO has value
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 8 }}>
          ≈ Fair price — AI and market roughly agree. No clear edge.
        </div>
      )}

      <div style={{ fontSize: 11, color: C.textMuted, fontStyle: "italic" }}>
        AI confidence: {prediction.confidence}
        {prediction.reasoning && <> · {prediction.reasoning}</>}
      </div>
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
