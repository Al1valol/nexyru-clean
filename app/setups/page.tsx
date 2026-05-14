"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";

// ───────────────────────── types ─────────────────────────
interface Trade {
  id?: string;
  pair?: string;
  symbol?: string;
  type?: "long" | "short" | string;
  side?: string;
  entryPrice?: number | string;
  exitPrice?: number | string;
  size?: number | string;
  date?: number | string;
  strategy?: string;
  notes?: string;
  pnl?: number;
  pnlPct?: number;
  tags?: string[];
}

type SetupRow = {
  name: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  profitFactor: number;
  bestTrade: number;
  worstTrade: number;
  expectancy: number;
};

type InstrumentRow = {
  symbol: string;
  trades: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  longCount: number;
  shortCount: number;
  longWinRate: number;
  shortWinRate: number;
  bestDirection: "long" | "short" | "even";
};

type SortDir = "asc" | "desc";

// ───────────────────────── helpers ─────────────────────────
const SESSION_KEY = "tradedesk_session_v1";
const tradesKey = (u: string) => `tradedesk_trades_${u}_v1`;

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_LABELS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

function getUsername(): string {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "{}").username || "guest";
  } catch {
    return "guest";
  }
}

function fmtMoney(n: number | undefined | null) {
  if (n === undefined || n === null || isNaN(Number(n))) return "$0.00";
  const v = Number(n);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtMoney0(n: number | undefined | null) {
  if (n === undefined || n === null || isNaN(Number(n))) return "$0";
  const v = Number(n);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function parseDate(d: unknown): Date | null {
  if (d === undefined || d === null || d === "") return null;
  const dt = new Date(typeof d === "number" ? d : (d as string));
  return isNaN(dt.getTime()) ? null : dt;
}

function fmtHour(h: number) {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function normalizeDir(t: Trade): "long" | "short" | null {
  const raw = (t.type || t.side || "").toString().toLowerCase();
  if (raw.startsWith("long") || raw === "buy") return "long";
  if (raw.startsWith("short") || raw === "sell") return "short";
  return null;
}

function getSymbol(t: Trade): string {
  return (t.symbol || t.pair || "—").toString().toUpperCase();
}

function getStrategy(t: Trade): string {
  const s = (t.strategy || "").toString().trim();
  return s || "Unspecified";
}

// ───────────────────────── shared styles ─────────────────────────
const FONT_STACK = "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const card: React.CSSProperties = {
  background: "#111111",
  border: "1px solid #1e1e1e",
  borderRadius: 12,
  padding: 20,
};

const sectionLabel = (label: string) => (
  <div
    style={{
      fontSize: 11,
      fontWeight: 700,
      color: "#6b7280",
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      marginBottom: 6,
    }}
  >
    {label}
  </div>
);

const th: React.CSSProperties = {
  padding: "12px 14px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 600,
  color: "#4b5563",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  borderBottom: "1px solid #1e1e1e",
  cursor: "pointer",
  userSelect: "none",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "14px",
  fontSize: 13,
  color: "#ffffff",
  borderBottom: "1px solid #111111",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

// ───────────────────────── page ─────────────────────────
export default function SetupsPage() {
  const [, setUsername] = useState("guest");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [mounted, setMounted] = useState(false);

  const [setupSort, setSetupSort] = useState<{ key: keyof SetupRow; dir: SortDir }>({
    key: "expectancy",
    dir: "desc",
  });
  const [instSort, setInstSort] = useState<{ key: keyof InstrumentRow; dir: SortDir }>({
    key: "totalPnl",
    dir: "desc",
  });

  useEffect(() => {
    setMounted(true);
    const u = getUsername();
    setUsername(u);
    try {
      const t = JSON.parse(localStorage.getItem(tradesKey(u)) || "[]") || [];
      setTrades(Array.isArray(t) ? t : []);
    } catch {}
  }, []);

  // ── Derived: clean valid trades
  const validTrades = useMemo(
    () =>
      trades.filter((t) => t && !isNaN(Number(t.pnl)) && t.pnl !== undefined && t.pnl !== null),
    [trades]
  );

  // ── Setup breakdown
  const setupRows = useMemo<SetupRow[]>(() => {
    const map = new Map<string, Trade[]>();
    for (const t of validTrades) {
      const name = getStrategy(t);
      const arr = map.get(name) || [];
      arr.push(t);
      map.set(name, arr);
    }
    const rows: SetupRow[] = [];
    for (const [name, ts] of map.entries()) {
      const pnls = ts.map((t) => Number(t.pnl) || 0);
      const wins = pnls.filter((p) => p > 0);
      const losses = pnls.filter((p) => p < 0);
      const totalPnl = pnls.reduce((s, p) => s + p, 0);
      const grossWin = wins.reduce((s, p) => s + p, 0);
      const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0));
      const profitFactor = grossLoss === 0 ? (grossWin > 0 ? Infinity : 0) : grossWin / grossLoss;
      const winRate = ts.length ? (wins.length / ts.length) * 100 : 0;
      const lossRate = ts.length ? (losses.length / ts.length) * 100 : 0;
      const avgWin = wins.length ? grossWin / wins.length : 0;
      const avgLoss = losses.length ? grossLoss / losses.length : 0;
      const expectancy = (avgWin * winRate) / 100 - (avgLoss * lossRate) / 100;
      rows.push({
        name,
        trades: ts.length,
        wins: wins.length,
        losses: losses.length,
        winRate,
        avgPnl: ts.length ? totalPnl / ts.length : 0,
        totalPnl,
        profitFactor,
        bestTrade: pnls.length ? Math.max(...pnls) : 0,
        worstTrade: pnls.length ? Math.min(...pnls) : 0,
        expectancy,
      });
    }
    return rows;
  }, [validTrades]);

  const sortedSetups = useMemo(() => {
    const arr = [...setupRows];
    arr.sort((a, b) => {
      const av = a[setupSort.key];
      const bv = b[setupSort.key];
      if (typeof av === "string" || typeof bv === "string") {
        return setupSort.dir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      }
      const an = Number(av);
      const bn = Number(bv);
      if (!isFinite(an) && !isFinite(bn)) return 0;
      if (!isFinite(an)) return setupSort.dir === "asc" ? 1 : -1;
      if (!isFinite(bn)) return setupSort.dir === "asc" ? -1 : 1;
      return setupSort.dir === "asc" ? an - bn : bn - an;
    });
    return arr;
  }, [setupRows, setupSort]);

  // ── Instrument breakdown
  const instrumentRows = useMemo<InstrumentRow[]>(() => {
    const map = new Map<string, Trade[]>();
    for (const t of validTrades) {
      const sym = getSymbol(t);
      const arr = map.get(sym) || [];
      arr.push(t);
      map.set(sym, arr);
    }
    const rows: InstrumentRow[] = [];
    for (const [sym, ts] of map.entries()) {
      const pnls = ts.map((t) => Number(t.pnl) || 0);
      const wins = pnls.filter((p) => p > 0).length;
      const totalPnl = pnls.reduce((s, p) => s + p, 0);
      const winRate = ts.length ? (wins / ts.length) * 100 : 0;

      const longs = ts.filter((t) => normalizeDir(t) === "long");
      const shorts = ts.filter((t) => normalizeDir(t) === "short");
      const longWins = longs.filter((t) => (Number(t.pnl) || 0) > 0).length;
      const shortWins = shorts.filter((t) => (Number(t.pnl) || 0) > 0).length;
      const longWinRate = longs.length ? (longWins / longs.length) * 100 : 0;
      const shortWinRate = shorts.length ? (shortWins / shorts.length) * 100 : 0;
      let bestDirection: "long" | "short" | "even" = "even";
      if (longs.length && shorts.length) {
        bestDirection = longWinRate > shortWinRate ? "long" : longWinRate < shortWinRate ? "short" : "even";
      } else if (longs.length) bestDirection = "long";
      else if (shorts.length) bestDirection = "short";

      rows.push({
        symbol: sym,
        trades: ts.length,
        winRate,
        avgPnl: ts.length ? totalPnl / ts.length : 0,
        totalPnl,
        longCount: longs.length,
        shortCount: shorts.length,
        longWinRate,
        shortWinRate,
        bestDirection,
      });
    }
    return rows;
  }, [validTrades]);

  const sortedInstruments = useMemo(() => {
    const arr = [...instrumentRows];
    arr.sort((a, b) => {
      const av = a[instSort.key];
      const bv = b[instSort.key];
      if (typeof av === "string" || typeof bv === "string") {
        return instSort.dir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      }
      const an = Number(av);
      const bn = Number(bv);
      return instSort.dir === "asc" ? an - bn : bn - an;
    });
    return arr;
  }, [instrumentRows, instSort]);

  // ── Hour-of-day stats
  const hourStats = useMemo(() => {
    const m: Record<number, { count: number; wins: number; pnl: number }> = {};
    for (const h of HOUR_LABELS) m[h] = { count: 0, wins: 0, pnl: 0 };
    for (const t of validTrades) {
      const d = parseDate(t.date);
      if (!d) continue;
      const h = d.getHours();
      if (m[h] === undefined) continue;
      m[h].count += 1;
      const p = Number(t.pnl) || 0;
      if (p > 0) m[h].wins += 1;
      m[h].pnl += p;
    }
    return HOUR_LABELS.map((h) => ({
      hour: h,
      count: m[h].count,
      winRate: m[h].count ? (m[h].wins / m[h].count) * 100 : 0,
      pnl: m[h].pnl,
    }));
  }, [validTrades]);

  const bestHour = useMemo(() => {
    const candidates = hourStats.filter((h) => h.count >= 2);
    if (!candidates.length) return null;
    return candidates.reduce((best, cur) => (cur.winRate > best.winRate ? cur : best), candidates[0]);
  }, [hourStats]);

  // ── Day-of-week stats (Mon–Fri)
  const dowStats = useMemo(() => {
    const days = [1, 2, 3, 4, 5];
    const m: Record<number, { count: number; wins: number; pnl: number }> = {};
    for (const d of days) m[d] = { count: 0, wins: 0, pnl: 0 };
    for (const t of validTrades) {
      const dt = parseDate(t.date);
      if (!dt) continue;
      const day = dt.getDay();
      if (m[day] === undefined) continue;
      m[day].count += 1;
      const p = Number(t.pnl) || 0;
      if (p > 0) m[day].wins += 1;
      m[day].pnl += p;
    }
    return days.map((d) => ({
      day: d,
      label: DAY_NAMES_SHORT[d],
      count: m[d].count,
      avgPnl: m[d].count ? m[d].pnl / m[d].count : 0,
      totalPnl: m[d].pnl,
    }));
  }, [validTrades]);

  // ── Long vs Short
  const longShortStats = useMemo(() => {
    const longs = validTrades.filter((t) => normalizeDir(t) === "long");
    const shorts = validTrades.filter((t) => normalizeDir(t) === "short");
    const stat = (arr: Trade[]) => {
      const pnls = arr.map((t) => Number(t.pnl) || 0);
      const wins = pnls.filter((p) => p > 0).length;
      const total = pnls.reduce((s, p) => s + p, 0);
      return {
        count: arr.length,
        winRate: arr.length ? (wins / arr.length) * 100 : 0,
        avgPnl: arr.length ? total / arr.length : 0,
        totalPnl: total,
      };
    };
    return { long: stat(longs), short: stat(shorts) };
  }, [validTrades]);

  // ── Best summary highlights
  const bestSetup = sortedSetups[0];
  const bestInstrument = useMemo(() => {
    const arr = [...instrumentRows].sort((a, b) => b.avgPnl - a.avgPnl);
    return arr[0];
  }, [instrumentRows]);

  // ── Recommendations
  type Rec = { title: string; text: string; impact: "HIGH" | "MEDIUM" | "LOW" };
  const recommendations = useMemo<Rec[]>(() => {
    const out: Rec[] = [];
    if (!validTrades.length) return out;

    if (bestSetup && bestSetup.trades >= 3 && bestSetup.expectancy > 0) {
      out.push({
        title: "KEEP DOING",
        text: `Your ${bestSetup.name} setup has a ${bestSetup.winRate.toFixed(0)}% win rate over ${bestSetup.trades} trades. Trade it more.`,
        impact: "HIGH",
      });
    }

    const worstSetup = [...setupRows]
      .filter((s) => s.trades >= 3)
      .sort((a, b) => a.expectancy - b.expectancy)[0];
    if (worstSetup && worstSetup.expectancy < 0 && worstSetup !== bestSetup) {
      out.push({
        title: "AVOID",
        text: `You lose on ${worstSetup.name} ${(100 - worstSetup.winRate).toFixed(0)}% of the time. Stop trading it.`,
        impact: "HIGH",
      });
    }

    if (bestHour && bestHour.count >= 3 && bestHour.winRate >= 55) {
      out.push({
        title: "TIMING",
        text: `Your best hour is ${fmtHour(bestHour.hour)} — win rate ${bestHour.winRate.toFixed(0)}% across ${bestHour.count} trades.`,
        impact: "MEDIUM",
      });
    }

    const worstHour = hourStats
      .filter((h) => h.count >= 3)
      .sort((a, b) => a.winRate - b.winRate)[0];
    if (worstHour && worstHour.winRate < 40) {
      out.push({
        title: "TIMING",
        text: `Avoid trading at ${fmtHour(worstHour.hour)} — win rate drops to ${worstHour.winRate.toFixed(0)}%.`,
        impact: "MEDIUM",
      });
    }

    const ls = longShortStats;
    if (ls.long.count >= 3 && ls.short.count >= 3) {
      const diff = ls.long.winRate - ls.short.winRate;
      if (Math.abs(diff) >= 10) {
        const stronger = diff > 0 ? "LONG" : "SHORT";
        const weaker = diff > 0 ? "SHORT" : "LONG";
        const strongRate = diff > 0 ? ls.long.winRate : ls.short.winRate;
        const weakRate = diff > 0 ? ls.short.winRate : ls.long.winRate;
        out.push({
          title: "DIRECTION",
          text: `Focus on ${stronger} trades — you win ${strongRate.toFixed(0)}% vs ${weakRate.toFixed(0)}% on ${weaker}s.`,
          impact: "HIGH",
        });
      }
    }

    if (bestInstrument && bestInstrument.trades >= 3 && bestInstrument.avgPnl > 0) {
      out.push({
        title: "SIZE UP",
        text: `${bestInstrument.symbol} has your highest avg PnL at ${fmtMoney(bestInstrument.avgPnl)}/trade — consider sizing up.`,
        impact: "MEDIUM",
      });
    }

    const worstDow = [...dowStats]
      .filter((d) => d.count >= 2)
      .sort((a, b) => a.avgPnl - b.avgPnl)[0];
    if (worstDow && worstDow.avgPnl < 0) {
      out.push({
        title: "WEEKDAY",
        text: `${worstDow.label} is your worst day — averaging ${fmtMoney(worstDow.avgPnl)} per trade.`,
        impact: "LOW",
      });
    }

    return out.slice(0, 5);
  }, [validTrades, bestSetup, setupRows, bestHour, hourStats, longShortStats, bestInstrument, dowStats]);

  // ── Sorting helpers
  const toggleSetupSort = (k: keyof SetupRow) => {
    setSetupSort((cur) => (cur.key === k ? { key: k, dir: cur.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" }));
  };
  const toggleInstSort = (k: keyof InstrumentRow) => {
    setInstSort((cur) => (cur.key === k ? { key: k, dir: cur.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" }));
  };

  const setupArrow = (k: keyof SetupRow) => (setupSort.key === k ? (setupSort.dir === "asc" ? " ▲" : " ▼") : "");
  const instArrow = (k: keyof InstrumentRow) => (instSort.key === k ? (instSort.dir === "asc" ? " ▲" : " ▼") : "");

  // ── Render
  if (!mounted) {
    return <div style={{ minHeight: "100vh", background: "#080808" }} />;
  }

  const hasTrades = validTrades.length > 0;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#080808", fontFamily: FONT_STACK }}>
      <Sidebar activePath="/setups" />
      <MobileNav activePath="/setups" />
      <main style={{ flex: 1, marginLeft: 56 }}>
        <div
          className="setups-main"
          style={{
            minHeight: "100vh",
            background: "#080808",
            color: "#ffffff",
            padding: "32px",
            fontFamily: FONT_STACK,
          }}
        >
          <style>{`
            @media (max-width: 767px) {
              .setups-main { padding: 20px 16px 80px !important; }
              .setups-hide-mobile { display: none !important; }
              .setups-table { min-width: 0 !important; }
              .setups-title { font-size: 20px !important; }
            }
            .setups-row:hover { background: #161616 !important; }
          `}</style>

          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            {/* ════════ HEADER ════════ */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
              <div>
                <div
                  className="setups-title"
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: "#ffffff",
                    letterSpacing: "-0.01em",
                    marginBottom: 4,
                  }}
                >
                  Best Setup Finder
                </div>
                <div style={{ fontSize: 14, color: "#6b7280" }}>
                  Discover what actually works in your trading
                </div>
              </div>
              <div
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: 999,
                  padding: "6px 12px",
                  fontSize: 12,
                  color: "#6b7280",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {hasTrades ? `${validTrades.length} trades analyzed` : "No trades yet"}
              </div>
            </div>

            {!hasTrades && (
              <div
                style={{
                  ...card,
                  textAlign: "center",
                  padding: 48,
                  marginBottom: 24,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 600, color: "#ffffff", marginBottom: 8 }}>
                  No trades logged yet
                </div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
                  Add trades to your journal to unlock your edge analysis.
                </div>
                <a
                  href="/dashboard"
                  style={{
                    display: "inline-block",
                    padding: "10px 18px",
                    borderRadius: 10,
                    background: "#6366f1",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Go to Journal
                </a>
              </div>
            )}

            {hasTrades && (
              <>
                {/* ════════ TOP 3 HIGHLIGHT CARDS ════════ */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 16,
                    marginBottom: 24,
                  }}
                >
                  <HighlightCard
                    tag="BEST SETUP"
                    big={bestSetup ? `${bestSetup.winRate.toFixed(0)}%` : "—"}
                    line={
                      bestSetup
                        ? `Your #1 setup is ${bestSetup.name} with ${bestSetup.winRate.toFixed(0)}% win rate on ${bestSetup.trades} trades`
                        : "Add more trades to surface your edge"
                    }
                    accent="#6366f1"
                  />
                  <HighlightCard
                    tag="BEST INSTRUMENT"
                    big={bestInstrument ? fmtMoney0(bestInstrument.avgPnl) : "—"}
                    line={
                      bestInstrument
                        ? `Your most profitable instrument is ${bestInstrument.symbol} averaging ${fmtMoney(bestInstrument.avgPnl)} per trade`
                        : "Add trades to surface your best instrument"
                    }
                    accent="#22c55e"
                  />
                  <HighlightCard
                    tag="BEST TIME"
                    big={bestHour ? `${bestHour.winRate.toFixed(0)}%` : "—"}
                    line={
                      bestHour
                        ? `You perform best between ${fmtHour(bestHour.hour)} and ${fmtHour(bestHour.hour + 1)} with ${bestHour.winRate.toFixed(0)}% win rate`
                        : "Need more session data to find your best hour"
                    }
                    accent="#f59e0b"
                  />
                </div>

                {/* ════════ SETUP BREAKDOWN ════════ */}
                <div style={{ ...card, marginBottom: 24, padding: 0, overflow: "hidden" }}>
                  <div style={{ padding: "20px 20px 14px" }}>
                    {sectionLabel("Setup Breakdown")}
                    <div style={{ fontSize: 13, color: "#4b5563" }}>
                      Sorted by expectancy — the math-weighted measure of how much each setup earns per trade.
                    </div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="setups-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
                      <thead>
                        <tr>
                          <th style={th} onClick={() => toggleSetupSort("name")}>Setup{setupArrow("name")}</th>
                          <th className="setups-hide-mobile" style={th} onClick={() => toggleSetupSort("trades")}>Trades{setupArrow("trades")}</th>
                          <th style={th} onClick={() => toggleSetupSort("winRate")}>Win Rate{setupArrow("winRate")}</th>
                          <th className="setups-hide-mobile" style={th} onClick={() => toggleSetupSort("avgPnl")}>Avg PnL{setupArrow("avgPnl")}</th>
                          <th style={th} onClick={() => toggleSetupSort("totalPnl")}>Total PnL{setupArrow("totalPnl")}</th>
                          <th className="setups-hide-mobile" style={th} onClick={() => toggleSetupSort("profitFactor")}>Profit Factor{setupArrow("profitFactor")}</th>
                          <th className="setups-hide-mobile" style={th} onClick={() => toggleSetupSort("bestTrade")}>Best{setupArrow("bestTrade")}</th>
                          <th className="setups-hide-mobile" style={th} onClick={() => toggleSetupSort("worstTrade")}>Worst{setupArrow("worstTrade")}</th>
                          <th className="setups-hide-mobile" style={th} onClick={() => toggleSetupSort("expectancy")}>Expectancy{setupArrow("expectancy")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedSetups.map((r, i) => (
                          <tr key={r.name} className="setups-row">
                            <td style={{ ...td, fontWeight: 600, color: "#ffffff" }}>
                              {i === 0 && setupSort.key === "expectancy" && setupSort.dir === "desc" && (
                                <span
                                  style={{
                                    display: "inline-block",
                                    background: "#6366f1",
                                    color: "#ffffff",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    marginRight: 8,
                                    letterSpacing: "0.05em",
                                  }}
                                >
                                  BEST
                                </span>
                              )}
                              {r.name}
                            </td>
                            <td className="setups-hide-mobile" style={td}>{r.trades}</td>
                            <td style={{ ...td, color: r.winRate > 50 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                              {r.winRate.toFixed(0)}%
                            </td>
                            <td className="setups-hide-mobile" style={{ ...td, color: r.avgPnl >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                              {fmtMoney(r.avgPnl)}
                            </td>
                            <td style={{ ...td, color: r.totalPnl >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                              {fmtMoney(r.totalPnl)}
                            </td>
                            <td className="setups-hide-mobile" style={{ ...td, fontWeight: 600 }}>
                              {isFinite(r.profitFactor) ? r.profitFactor.toFixed(2) : "∞"}
                            </td>
                            <td className="setups-hide-mobile" style={{ ...td, color: "#22c55e", fontWeight: 600 }}>{fmtMoney(r.bestTrade)}</td>
                            <td className="setups-hide-mobile" style={{ ...td, color: "#ef4444", fontWeight: 600 }}>{fmtMoney(r.worstTrade)}</td>
                            <td className="setups-hide-mobile" style={{ ...td, color: r.expectancy >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                              {fmtMoney(r.expectancy)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ════════ INSTRUMENT ANALYSIS ════════ */}
                <div style={{ ...card, marginBottom: 24, padding: 0, overflow: "hidden" }}>
                  <div style={{ padding: "20px 20px 14px" }}>
                    {sectionLabel("Instrument Analysis")}
                    <div style={{ fontSize: 13, color: "#4b5563" }}>
                      Which symbols pay you — and which direction you trade them best.
                    </div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="setups-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
                      <thead>
                        <tr>
                          <th style={th} onClick={() => toggleInstSort("symbol")}>Symbol{instArrow("symbol")}</th>
                          <th className="setups-hide-mobile" style={th} onClick={() => toggleInstSort("trades")}>Trades{instArrow("trades")}</th>
                          <th style={th} onClick={() => toggleInstSort("winRate")}>Win Rate{instArrow("winRate")}</th>
                          <th className="setups-hide-mobile" style={th} onClick={() => toggleInstSort("avgPnl")}>Avg PnL{instArrow("avgPnl")}</th>
                          <th style={th} onClick={() => toggleInstSort("totalPnl")}>Total PnL{instArrow("totalPnl")}</th>
                          <th className="setups-hide-mobile" style={th} onClick={() => toggleInstSort("longWinRate")}>Long Win%{instArrow("longWinRate")}</th>
                          <th className="setups-hide-mobile" style={th} onClick={() => toggleInstSort("shortWinRate")}>Short Win%{instArrow("shortWinRate")}</th>
                          <th className="setups-hide-mobile" style={th}>Best Dir</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedInstruments.map((r) => (
                          <tr key={r.symbol} className="setups-row">
                            <td style={{ ...td, fontWeight: 600, color: "#ffffff" }}>{r.symbol}</td>
                            <td className="setups-hide-mobile" style={td}>{r.trades}</td>
                            <td style={{ ...td, color: r.winRate > 50 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                              {r.winRate.toFixed(0)}%
                            </td>
                            <td className="setups-hide-mobile" style={{ ...td, color: r.avgPnl >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                              {fmtMoney(r.avgPnl)}
                            </td>
                            <td style={{ ...td, color: r.totalPnl >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                              {fmtMoney(r.totalPnl)}
                            </td>
                            <td className="setups-hide-mobile" style={td}>
                              {r.longCount > 0 ? `${r.longWinRate.toFixed(0)}% (${r.longCount})` : "—"}
                            </td>
                            <td className="setups-hide-mobile" style={td}>
                              {r.shortCount > 0 ? `${r.shortWinRate.toFixed(0)}% (${r.shortCount})` : "—"}
                            </td>
                            <td className="setups-hide-mobile" style={td}>
                              {r.bestDirection === "long" && <DirBadge dir="long" />}
                              {r.bestDirection === "short" && <DirBadge dir="short" />}
                              {r.bestDirection === "even" && (
                                <span style={{ color: "#6b7280", fontWeight: 500, fontSize: 11 }}>EVEN</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ════════ TIME ANALYSIS ════════ */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
                    gap: 16,
                    marginBottom: 24,
                  }}
                >
                  {/* Hour of Day */}
                  <div style={card}>
                    {sectionLabel("Win Rate by Hour")}
                    <div style={{ fontSize: 13, color: "#4b5563", marginBottom: 16 }}>
                      Hour-by-hour performance, 6am–4pm.
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 180, padding: "8px 0 12px" }}>
                      {hourStats.map((h) => {
                        const isBest = bestHour && h.hour === bestHour.hour;
                        const hasData = h.count > 0;
                        const heightPct = hasData ? Math.max(4, h.winRate) : 0;
                        const positive = h.winRate >= 50;
                        const barColor = !hasData ? "transparent" : positive ? "#6366f1" : "#ef4444";
                        return (
                          <div
                            key={h.hour}
                            style={{
                              flex: 1,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 4,
                              height: "100%",
                            }}
                          >
                            <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, height: 14 }}>
                              {hasData ? `${h.winRate.toFixed(0)}%` : ""}
                            </div>
                            <div
                              style={{
                                width: "100%",
                                flex: 1,
                                background: "#1a1a1a",
                                borderRadius: 4,
                                position: "relative",
                                display: "flex",
                                alignItems: "flex-end",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: "100%",
                                  height: `${heightPct}%`,
                                  background: barColor,
                                  borderRadius: 4,
                                  transition: "height 200ms ease",
                                }}
                              />
                              {isBest && (
                                <div
                                  style={{
                                    position: "absolute",
                                    top: 4,
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    background: "#6366f1",
                                    boxShadow: "0 0 0 3px rgba(99,102,241,0.25)",
                                  }}
                                />
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>{fmtHour(h.hour)}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", textAlign: "center", marginTop: 4 }}>
                      {bestHour
                        ? `Best hour: ${fmtHour(bestHour.hour)} — ${bestHour.winRate.toFixed(0)}% win rate`
                        : "Add more timestamped trades"}
                    </div>
                  </div>

                  {/* Day of Week */}
                  <div style={card}>
                    {sectionLabel("Avg PnL by Day")}
                    <div style={{ fontSize: 13, color: "#4b5563", marginBottom: 16 }}>
                      Average PnL per trade, Monday through Friday.
                    </div>
                    {(() => {
                      const maxAbs = Math.max(1, ...dowStats.map((d) => Math.abs(d.avgPnl)));
                      return (
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 180, padding: "8px 0 12px" }}>
                          {dowStats.map((d) => {
                            const hasData = d.count > 0;
                            const heightPct = hasData ? Math.max(4, (Math.abs(d.avgPnl) / maxAbs) * 90) : 0;
                            const positive = d.avgPnl >= 0;
                            const barColor = !hasData ? "transparent" : positive ? "#6366f1" : "#ef4444";
                            return (
                              <div
                                key={d.day}
                                style={{
                                  flex: 1,
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  gap: 4,
                                  height: "100%",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: hasData ? (positive ? "#22c55e" : "#ef4444") : "#6b7280",
                                    fontWeight: 600,
                                    height: 14,
                                    fontVariantNumeric: "tabular-nums",
                                  }}
                                >
                                  {hasData ? fmtMoney0(d.avgPnl) : ""}
                                </div>
                                <div
                                  style={{
                                    width: "100%",
                                    flex: 1,
                                    background: "#1a1a1a",
                                    borderRadius: 4,
                                    display: "flex",
                                    alignItems: "flex-end",
                                    overflow: "hidden",
                                  }}
                                >
                                  <div
                                    style={{
                                      width: "100%",
                                      height: `${heightPct}%`,
                                      background: barColor,
                                      borderRadius: 4,
                                      transition: "height 200ms ease",
                                    }}
                                  />
                                </div>
                                <div style={{ fontSize: 11, color: "#ffffff", fontWeight: 600 }}>{d.label}</div>
                                <div style={{ fontSize: 10, color: "#6b7280" }}>
                                  {d.count} trade{d.count === 1 ? "" : "s"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* ════════ LONG vs SHORT ════════ */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ marginBottom: 12 }}>{sectionLabel("Long vs Short")}</div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                      gap: 16,
                    }}
                  >
                    <DirectionCard
                      label="LONG"
                      accent="#22c55e"
                      count={longShortStats.long.count}
                      winRate={longShortStats.long.winRate}
                      avgPnl={longShortStats.long.avgPnl}
                      totalPnl={longShortStats.long.totalPnl}
                      stronger={
                        longShortStats.long.count > 0 &&
                        longShortStats.long.winRate > longShortStats.short.winRate
                      }
                    />
                    <DirectionCard
                      label="SHORT"
                      accent="#ef4444"
                      count={longShortStats.short.count}
                      winRate={longShortStats.short.winRate}
                      avgPnl={longShortStats.short.avgPnl}
                      totalPnl={longShortStats.short.totalPnl}
                      stronger={
                        longShortStats.short.count > 0 &&
                        longShortStats.short.winRate > longShortStats.long.winRate
                      }
                    />
                  </div>
                  {longShortStats.long.count > 0 && longShortStats.short.count > 0 && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "14px 16px",
                        background: "#111111",
                        border: "1px solid #1e1e1e",
                        borderRadius: 10,
                        fontSize: 13,
                        color: "#ffffff",
                        textAlign: "center",
                      }}
                    >
                      {(() => {
                        const diff = longShortStats.long.winRate - longShortStats.short.winRate;
                        if (Math.abs(diff) < 1)
                          return (
                            <span style={{ color: "#6b7280" }}>
                              Your long and short performance is essentially even.
                            </span>
                          );
                        const stronger = diff > 0 ? "LONG" : "SHORT";
                        return (
                          <>
                            <span style={{ color: "#6b7280" }}>You are </span>
                            <span style={{ color: "#ffffff", fontWeight: 700 }}>
                              {Math.abs(diff).toFixed(0)}%
                            </span>
                            <span style={{ color: "#6b7280" }}> better at </span>
                            <span style={{ color: diff > 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
                              {stronger}
                            </span>
                            <span style={{ color: "#6b7280" }}>
                              {" "}trades than {diff > 0 ? "SHORT" : "LONG"} trades.
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* ════════ RECOMMENDATIONS ════════ */}
                <div>
                  <div style={{ marginBottom: 12 }}>{sectionLabel("Recommendations")}</div>
                  {recommendations.length === 0 ? (
                    <div style={{ ...card, fontSize: 13, color: "#6b7280", padding: 20 }}>
                      Log more trades to unlock personalized recommendations.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {recommendations.map((rec, i) => (
                        <RecCard key={i} rec={rec} />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ───────────────────────── components ─────────────────────────
function HighlightCard({
  tag,
  big,
  line,
  accent,
}: {
  tag: string;
  big: string;
  line: string;
  accent: string;
}) {
  return (
    <div
      style={{
        background: "#111111",
        border: "1px solid #1e1e1e",
        borderLeft: `3px solid ${accent}`,
        borderRadius: 12,
        padding: 24,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#6b7280",
          letterSpacing: "0.1em",
          marginBottom: 14,
          textTransform: "uppercase",
        }}
      >
        {tag}
      </div>
      <div
        style={{
          fontSize: 40,
          fontWeight: 800,
          color: "#ffffff",
          letterSpacing: "-0.02em",
          marginBottom: 10,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {big}
      </div>
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{line}</div>
    </div>
  );
}

function DirBadge({ dir }: { dir: "long" | "short" }) {
  const isLong = dir === "long";
  const bg = isLong ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)";
  const color = isLong ? "#22c55e" : "#ef4444";
  const border = isLong ? "rgba(34,197,94,0.19)" : "rgba(239,68,68,0.19)";
  return (
    <span
      style={{
        display: "inline-block",
        background: bg,
        color,
        border: `1px solid ${border}`,
        fontSize: 10,
        fontWeight: 700,
        padding: "3px 7px",
        borderRadius: 4,
        letterSpacing: "0.05em",
      }}
    >
      {isLong ? "LONG" : "SHORT"}
    </span>
  );
}

function DirectionCard({
  label,
  accent,
  count,
  winRate,
  avgPnl,
  totalPnl,
  stronger,
}: {
  label: string;
  accent: string;
  count: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  stronger: boolean;
}) {
  return (
    <div
      style={{
        background: "#111111",
        border: "1px solid #1e1e1e",
        borderLeft: `3px solid ${accent}`,
        borderRadius: 12,
        padding: 20,
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "0.08em",
          }}
        >
          {label}
        </div>
        {stronger && count > 0 && (
          <div
            style={{
              background: "#6366f1",
              color: "#ffffff",
              fontSize: 10,
              fontWeight: 700,
              padding: "3px 7px",
              borderRadius: 4,
              letterSpacing: "0.05em",
            }}
          >
            STRONGER
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Stat label="Trades" value={count.toString()} />
        <Stat
          label="Win Rate"
          value={`${winRate.toFixed(0)}%`}
          color={winRate > 50 ? "#22c55e" : "#ef4444"}
        />
        <Stat
          label="Avg PnL"
          value={fmtMoney(avgPnl)}
          color={avgPnl >= 0 ? "#22c55e" : "#ef4444"}
        />
        <Stat
          label="Total PnL"
          value={fmtMoney(totalPnl)}
          color={totalPnl >= 0 ? "#22c55e" : "#ef4444"}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: "#6b7280",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: color || "#ffffff",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function RecCard({ rec }: { rec: { title: string; text: string; impact: "HIGH" | "MEDIUM" | "LOW" } }) {
  const impactBg =
    rec.impact === "HIGH"
      ? "rgba(239,68,68,0.08)"
      : rec.impact === "MEDIUM"
        ? "rgba(245,158,11,0.08)"
        : "rgba(34,197,94,0.08)";
  const impactColor =
    rec.impact === "HIGH" ? "#ef4444" : rec.impact === "MEDIUM" ? "#f59e0b" : "#22c55e";

  return (
    <div
      style={{
        background: "#111111",
        border: "1px solid #1e1e1e",
        borderRadius: 10,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#6b7280",
            letterSpacing: "0.1em",
            marginBottom: 6,
            textTransform: "uppercase",
          }}
        >
          {rec.title}
        </div>
        <div style={{ fontSize: 14, color: "#ffffff", lineHeight: 1.5 }}>{rec.text}</div>
      </div>
      <div
        style={{
          background: impactBg,
          color: impactColor,
          fontSize: 10,
          fontWeight: 700,
          padding: "4px 8px",
          borderRadius: 4,
          letterSpacing: "0.08em",
          flexShrink: 0,
        }}
      >
        {rec.impact}
      </div>
    </div>
  );
}
