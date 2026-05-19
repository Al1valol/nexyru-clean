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

type OddsTabKey = "best" | "polymarket" | "arb" | "value";

// One Odds API call per sport (each costs 1 credit). The proxy at /api/odds
// accepts a comma-separated list and fans out in parallel server-side. List
// the sports we care about; the proxy silently skips any that the upstream
// 404s (eg. off-season tennis events).
const ODDS_SPORTS = [
  "baseball_mlb",
  "basketball_nba",
  "americanfootball_nfl",
  "icehockey_nhl",
  "soccer_epl",
  "soccer_uefa_champs_league",
  "soccer_mls",
  "tennis_atp_french_open",
  "tennis_wta_french_open",
  "mma_mixed_martial_arts",
  "basketball_ncaab",
  "baseball_ncaa",
];

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

export function OddsTab() {
  const [oddsTab, setOddsTab] = useState<OddsTabKey>("best");
  const [games, setGames] = useState<OddsGame[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestsRemaining, setRequestsRemaining] = useState<string | null>(null);
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

  // Single fetch shared across Best Odds / Arb Finder / Value Bets — Polymarket
  // is a separate API. Proxy fans out to all listed sports in parallel.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/odds?sports=${ODDS_SPORTS.join(",")}&daysFrom=7`);
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
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const oddsTabs: { id: OddsTabKey; label: string }[] = [
    { id: "best", label: "📊 Best Odds" },
    { id: "polymarket", label: "🎲 Polymarket" },
    { id: "arb", label: "💰 Arb Finder" },
    { id: "value", label: "⭐ Value Bets" },
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

      {oddsTab === "best" && (
        <FanduelPanel
          games={games} loading={loading} error={error} requestsRemaining={requestsRemaining}
          nowMs={nowMs} onRefresh={load}
          addToParlay={addToParlay} isInParlay={isInParlay}
          parlayCount={parlayLegs.length}
        />
      )}
      {oddsTab === "polymarket" && <PolymarketPanel />}
      {oddsTab === "arb" && <ArbFinderPanel games={games} loading={loading} error={error} nowMs={nowMs} onRefresh={load}/>}
      {oddsTab === "value" && <ValueBetsPanel games={games} loading={loading} error={error} nowMs={nowMs} onRefresh={load}/>}

      {oddsTab === "best" && parlayLegs.length >= 2 && (
        <ParlayBar
          legs={parlayLegs}
          stake={parlayStake}
          onStakeChange={setParlayStake}
          onRemove={(gameId) => setParlayLegs((prev) => prev.filter((l) => l.gameId !== gameId))}
          onClear={() => setParlayLegs([])}
        />
      )}
    </section>
  );
}

type SharedOddsProps = {
  games: OddsGame[] | null;
  loading: boolean;
  error: string | null;
  nowMs: number;
  onRefresh: () => void;
};

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

  // Cross-book arb: when the best price on each side sums to under 100%
  // implied probability, the two books together leave a guaranteed edge.
  const arb = overround < 1 ? calcArbStakes(away.price, home.price, 1000) : null;

  return (
    <div style={{ background: C.card, border: `1px solid ${arb ? C.green : C.border}`, borderRadius: 12, padding: 16 }}>
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

      {arb && (
        <div style={{ marginTop: 12, background: "rgba(34,197,94,0.1)", border: `1px solid ${C.green}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.text, lineHeight: 1.55 }}>
          💰 <strong style={{ color: C.green }}>ARB:</strong> Bet <strong style={{ color: C.green }}>${arb.stakeA.toFixed(2)}</strong> on {game.away_team} at <strong style={{ color: C.text }}>{away.book}</strong> + <strong style={{ color: C.green }}>${arb.stakeB.toFixed(2)}</strong> on {game.home_team} at <strong style={{ color: C.text }}>{home.book}</strong> = <strong style={{ color: C.green }}>${arb.profit.toFixed(2)} guaranteed</strong> <span style={{ color: C.textMuted }}>(on ${arb.totalStake.toFixed(0)} total)</span>
        </div>
      )}
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

function ArbFinderPanel({ games, loading, error, nowMs, onRefresh }: SharedOddsProps) {
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
      const isArb = overround < 1 && stakeNum > 0 && !sameBook;
      let stakeAway, stakeHome, profit, roi;
      if (isArb) {
        stakeAway = (stakeNum * pAway) / overround;
        stakeHome = (stakeNum * pHome) / overround;
        profit = (stakeNum * (1 - overround)) / overround;
        roi = (profit / stakeNum) * 100;
      }
      // ROI > 10% is virtually never a real arb on h2h markets — flag for
      // manual verification instead of presenting it as guaranteed.
      const suspicious = isArb && (roi ?? 0) > 10;
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
        <strong style={{ color: C.text }}>{decorated.length}</strong> {decorated.length === 1 ? "game" : "games"} loaded across <strong style={{ color: C.text }}>{new Set(decorated.map(d => d.g.sport_key)).size}</strong> {new Set(decorated.map(d => d.g.sport_key)).size === 1 ? "sport" : "sports"} · <strong style={{ color: arbCount > 0 ? C.green : C.text }}>{arbCount}</strong> {arbCount === 1 ? "arb" : "arbs"} found
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
                  <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 10, padding: "12px 14px", fontSize: 13, lineHeight: 1.55, color: C.text }}>
                    <div style={{ fontWeight: 800, color: "#fbbf24", marginBottom: 4 }}>
                      Suspicious arb — likely stale data
                    </div>
                    <div style={{ color: C.textMuted, marginBottom: 6 }}>
                      Reported ROI of <strong style={{ color: "#fbbf24" }}>{row.roi!.toFixed(2)}%</strong> is too high to be real (legit arbs cap out at ~5%). One book&apos;s feed is probably outdated. <strong>Verify both prices manually before betting.</strong>
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>
                      If real → bet ${row.stakeAway!.toFixed(2)} on {row.g.away_team} at {row.away.book} + ${row.stakeHome!.toFixed(2)} on {row.g.home_team} at {row.home.book}.
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
