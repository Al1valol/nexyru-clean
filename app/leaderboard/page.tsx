"use client";

import { useEffect, useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
} from "recharts";

// ── Supabase REST fetch (no client library needed) ────────────
async function fetchFromSupabase(url: string, key: string) {
  // Build the nested select query using Supabase PostgREST syntax
  const query = new URLSearchParams({
    select: "id,user_id,name,description,rules,created_at,backtest_results(id,win_rate,return_pct,max_drawdown,trades_count,equity_curve,created_at)",
  });

  const endpoint = `${url}/rest/v1/strategies?${query.toString()}`;

  const res = await fetch(endpoint, {
    headers: {
      apikey:          key,
      Authorization:   `Bearer ${key}`,
      "Content-Type":  "application/json",
      // Tell Supabase we want nested relations
      Accept:          "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }

  return res.json();
}

// ── Types ─────────────────────────────────────────────────────
interface BacktestRow {
  id:           string;
  win_rate:     number;
  return_pct:   number;
  max_drawdown: number;
  trades_count: number;
  equity_curve: { time: number; balance: number }[];
  created_at:   string;
}

interface StrategyRow {
  id:               string;
  user_id:          string;
  name:             string;
  description:      string;
  rules:            Record<string, unknown>;
  created_at:       string;
  backtest_results: BacktestRow[];
}

// ── Helpers ───────────────────────────────────────────────────
function badge(wr: number, ret: number, dd: number) {
  if (wr >= 65 && ret >= 20)  return { label: "🔥 Hot",        color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)"  };
  if (wr >= 55 && ret >= 0)   return { label: "🟢 Consistent", color: "#34d399", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.3)"  };
  if (dd > 25)                return { label: "⚠ High Risk",   color: "#f97316", bg: "rgba(249,115,22,0.12)",  border: "rgba(249,115,22,0.3)"  };
  if (ret < 0)                return { label: "📉 Negative",   color: "#f87171", bg: "rgba(239,68,68,0.1)",    border: "rgba(239,68,68,0.25)"  };
                               return { label: "📊 Tested",    color: "#818cf8", bg: "rgba(129,140,248,0.1)",  border: "rgba(129,140,248,0.25)"};
}

function fmt(n: number, dec = 1) {
  return (n >= 0 ? "+" : "") + n.toFixed(dec);
}

function timeAgo(iso: string) {
  const s   = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)   return "just now";
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400)return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

// ── Stat pill ─────────────────────────────────────────────────
function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "monospace", color }}>{value}</span>
    </div>
  );
}

// ── Strategy card ─────────────────────────────────────────────
function StrategyCard({
  strategy, rank, expanded, onToggle,
}: {
  strategy: StrategyRow;
  rank:     number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const bt     = strategy.backtest_results[0];
  const b      = badge(bt.win_rate, bt.return_pct, bt.max_drawdown);
  const pnlPos = bt.return_pct >= 0;
  const lineC  = pnlPos ? "#10b981" : "#ef4444";
  const medal  = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  const handle = strategy.user_id.length > 12
    ? strategy.user_id.slice(0, 8) + "…"
    : strategy.user_id;

  // ── Follower state ──────────────────────────────────────────
  const [followers,  setFollowers]  = useState<number | null>(null);
  const [following,  setFollowing]  = useState(false);   // is current user following
  const [copying,    setCopying]    = useState(false);    // loading state
  const [copyDone,   setCopyDone]   = useState(false);    // success flash

  // Derive a stable "current user" id from localStorage
  const userId = typeof window !== "undefined"
    ? (JSON.parse(localStorage.getItem("tradedesk_session_v1") ?? "{}").username ?? "anonymous")
    : "anonymous";

  // Load follower count on mount
  useEffect(() => {
    fetch(`/api/follow?strategy_id=${strategy.id}`)
      .then(r => r.json())
      .then(d => setFollowers(d.count ?? 0))
      .catch(() => setFollowers(0));
  }, [strategy.id]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (copying) return;
    setCopying(true);
    try {
      const method = following ? "DELETE" : "POST";
      const res    = await fetch("/api/follow", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ follower_user_id: userId, strategy_id: strategy.id }),
      });
      if (!res.ok) throw new Error("Failed");
      const delta = following ? -1 : 1;
      setFollowers(prev => (prev ?? 0) + delta);
      setFollowing(prev => !prev);
      if (!following) {
        // Store the strategy in sessionStorage so Strategy Lab can pick it up
        const clone = {
          id:            `strat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name:          `${strategy.name} (copy)`,
          description:   strategy.description ?? "",
          rules:         strategy.rules ?? {},
          monthly_price: 0,
          backtests:     [],
          createdAt:     Date.now(),
          _clonedFrom:   strategy.user_id,
        };
        sessionStorage.setItem("tradedesk_clone_strategy", JSON.stringify(clone));
        setCopyDone(true);
        // Redirect to dashboard Strategy Lab after short confirmation flash
        setTimeout(() => { window.location.href = "/dashboard?tab=stratlab&clone=1"; }, 900);
      }
    } catch {
      alert("Could not copy strategy. Please try again.");
    } finally {
      setCopying(false);
    }
  };

  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${expanded ? "rgba(129,140,248,0.4)" : rank <= 3 ? "rgba(129,140,248,0.25)" : "#1a2035"}`,
        background: expanded
          ? "rgba(129,140,248,0.06)"
          : rank === 1 ? "rgba(251,191,36,0.04)"
          : rank === 2 ? "rgba(148,163,184,0.03)"
          : rank === 3 ? "rgba(249,115,22,0.03)"
          : "#0d1120",
        overflow: "hidden",
        transition: "all 0.18s",
        cursor: "pointer",
      }}
      onClick={onToggle}
    >
      {/* Card body */}
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Top row: rank + name + badges */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          {/* Rank */}
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {medal
              ? <span style={{ fontSize: 18 }}>{medal}</span>
              : <span style={{ fontSize: 12, fontWeight: 800, color: "#818cf8", fontFamily: "monospace" }}>#{rank}</span>
            }
          </div>

          {/* Name + user + followers */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {strategy.name}
            </div>
            <div style={{ fontSize: 10, color: "#475569", marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
              <span>by <span style={{ color: "#64748b", fontFamily: "monospace" }}>{handle}</span></span>
              <span>·</span>
              <span>{timeAgo(bt.created_at)}</span>
              {followers !== null && (
                <>
                  <span>·</span>
                  <span style={{ color: following ? "#38bdf8" : "#475569" }}>
                    👥 {followers} {followers === 1 ? "copy" : "copies"}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Badges */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: b.bg, color: b.color, border: `1px solid ${b.border}` }}>
              {b.label}
            </span>
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "rgba(56,189,248,0.08)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}>
              Backtested
            </span>
          </div>
        </div>

        {/* Stats row — limited info to protect signal */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(17,24,39,0.7)", border: "1px solid rgba(30,41,59,0.6)" }}>
          {/* Return — shown */}
          <Stat label="Return" value={`${fmt(bt.return_pct)}%`} color={pnlPos ? "#34d399" : "#f87171"} />
          {/* Win rate — blurred */}
          <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
            <span style={{ fontSize:9, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em" }}>Win Rate</span>
            <span style={{ fontSize:14, fontWeight:800, fontFamily:"monospace", color:"#475569", filter:"blur(5px)", userSelect:"none" }}>67%</span>
          </div>
          {/* Max DD — blurred */}
          <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
            <span style={{ fontSize:9, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em" }}>Max DD</span>
            <span style={{ fontSize:14, fontWeight:800, fontFamily:"monospace", color:"#475569", filter:"blur(5px)", userSelect:"none" }}>-9.2%</span>
          </div>
          {/* Trades — shown as range only */}
          <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
            <span style={{ fontSize:9, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em" }}>Trades</span>
            <span style={{ fontSize:14, fontWeight:800, fontFamily:"monospace", color:"#94a3b8" }}>
              {bt.trades_count < 20 ? "<20" : bt.trades_count < 50 ? "20–50" : bt.trades_count < 100 ? "50–100" : "100+"}
            </span>
          </div>
        </div>

        {/* Description */}
        {strategy.description && (
          <p style={{ fontSize: 11, color: "#475569", margin: 0, lineHeight: 1.6, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {strategy.description}
          </p>
        )}

        {/* Copy Strategy button */}
        <div onClick={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={handleCopy} disabled={copying} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: copying ? "not-allowed" : "pointer",
            background: copyDone ? "rgba(52,211,153,0.15)"
              : following ? "rgba(239,68,68,0.08)"
              : "rgba(56,189,248,0.1)",
            color: copyDone ? "#34d399" : following ? "#f87171" : "#38bdf8",
            border: `1px solid ${copyDone ? "rgba(52,211,153,0.3)" : following ? "rgba(239,68,68,0.3)" : "rgba(56,189,248,0.3)"}`,
            transition: "all 0.15s",
          }}>
            {copying
              ? <><span style={{ display: "inline-block", width: 11, height: 11, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#38bdf8", borderRadius: "50%", animation: "spin 0.7s linear infinite" }}/> Copying…</>
              : copyDone ? "✓ Strategy Copied!"
              : following ? "✕ Unfollow"
              : "⊕ Copy Strategy"
            }
          </button>
          {followers !== null && followers > 0 && (
            <span style={{ fontSize: 10, color: "#334155" }}>
              {followers} trader{followers !== 1 ? "s" : ""} following this strategy
            </span>
          )}
        </div>
      </div>

      {/* Expanded: equity curve + conditions */}
      {expanded && (
        <div style={{ borderTop: "1px solid #1a2035" }} onClick={e => e.stopPropagation()}>
          {bt.equity_curve?.length > 1 && (
            <div style={{ padding: "16px 20px 8px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                Equity Curve
                <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: "rgba(251,191,36,0.08)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}>🔒 Exact % hidden</span>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={bt.equity_curve} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`g_${strategy.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={lineC} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={lineC} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis tick={{ fontSize: 9, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "#0d1120", border: "1px solid #1e2d3e", borderRadius: 8, fontSize: 10 }} formatter={(v: unknown) => [`$${Number(v).toFixed(2)}`, "Balance"]} itemStyle={{ color: lineC }}/>
                  <Area type="monotone" dataKey="balance" stroke={lineC} strokeWidth={2} fill={`url(#g_${strategy.id})`} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {strategy.rules && (
            <div style={{ padding: "12px 20px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em" }}>Strategy Signals</span>
                <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: "rgba(251,191,36,0.08)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}>🔒 Subscribe to unlock</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {((strategy.rules as any).entryConds ?? []).map((_: any, i: number) => (
                  <span key={`e${i}`} style={{ fontSize: 9, padding: "3px 10px", borderRadius: 10, background: "rgba(52,211,153,0.04)", color: "transparent", border: "1px solid rgba(52,211,153,0.12)", filter: "blur(4px)", userSelect: "none", pointerEvents: "none" }}>▲ entry signal {i+1}</span>
                ))}
                {((strategy.rules as any).exitConds ?? []).map((_: any, i: number) => (
                  <span key={`x${i}`} style={{ fontSize: 9, padding: "3px 10px", borderRadius: 10, background: "rgba(239,68,68,0.04)", color: "transparent", border: "1px solid rgba(239,68,68,0.12)", filter: "blur(4px)", userSelect: "none", pointerEvents: "none" }}>▼ exit signal {i+1}</span>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "#2e3f5a" }}>
                {((strategy.rules as any).entryConds?.length ?? 0) + ((strategy.rules as any).exitConds?.length ?? 0)} signal{(((strategy.rules as any).entryConds?.length ?? 0) + ((strategy.rules as any).exitConds?.length ?? 0)) !== 1 ? "s" : ""} — Copy strategy to get full access
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function LeaderboardPage() {
  const [rows,     setRows]     = useState<StrategyRow[]>([]);
  const [liveRows,     setLiveRows]     = useState<StrategyRow[]>([]);
  const [verifiedRows, setVerifiedRows] = useState<StrategyRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [tab,      setTab]      = useState<"backtested" | "live" | "verified">("backtested");
  const [sort,     setSort]     = useState<"return_pct" | "win_rate" | "max_drawdown">("return_pct");
  const [search,   setSearch]   = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true); setError("");
      try {
        const [btRes, liveRes, verRes] = await Promise.all([
          fetch("/api/leaderboard?status=backtested"),
          fetch("/api/leaderboard?status=live"),
          fetch("/api/leaderboard?status=verified"),
        ]);
        const [btData, liveData, verData] = await Promise.all([btRes.json(), liveRes.json(), verRes.json()]);
        if (!btRes.ok || btData.error) throw new Error(btData.error ?? `HTTP ${btRes.status}`);
        setRows(Array.isArray(btData) ? btData.filter((s:any) => s.backtest_results?.length > 0) as StrategyRow[] : []);
        setLiveRows(Array.isArray(liveData) ? liveData.filter((s:any) => s.backtest_results?.length > 0) as StrategyRow[] : []);
        setVerifiedRows(Array.isArray(verData) ? verData.filter((s:any) => s.backtest_results?.length > 0) as StrategyRow[] : []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally { setLoading(false); }
    }
    load();
  }, []);

  const sorted = useMemo(() => {
    let r = [...rows];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.user_id.toLowerCase().includes(q)
      );
    }

    // Sort
    r.sort((a, b) => {
      const btA = a.backtest_results[0];
      const btB = b.backtest_results[0];
      if (sort === "max_drawdown") return btA.max_drawdown - btB.max_drawdown; // lower = better
      return btB[sort] - btA[sort]; // higher = better for return + win_rate
    });

    return r;
  }, [rows, sort, search]);

  const SORT_OPTS = [
    { id: "return_pct",   label: "Return %" },
    { id: "win_rate",     label: "Win Rate" },
    { id: "max_drawdown", label: "Drawdown" },
  ] as const;

  return (
    <div style={{ minHeight: "100vh", background: "#080c18", fontFamily: "system-ui,-apple-system,sans-serif", color: "#e2e8f0" }}>

      {/* Top bar */}
      <div style={{ borderBottom: "1px solid #1a2035", background: "#0d1120", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#4f46e5,#818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🏆</div>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9" }}>Strategy Leaderboard</span>
        </div>
        <a href="/dashboard" style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #1a2035", background: "#111827", color: "#94a3b8", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
          ← Dashboard
        </a>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #1a2035", gap: 0 }}>
          {[
            { id: "backtested" as const, label: "Backtested", count: rows.length },
            { id: "live"       as const, label: "Live",        count: liveRows.length },
            { id: "verified"   as const, label: "✓ Verified",  count: verifiedRows.length },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "10px 20px",
              border: "none", background: "transparent", cursor: "pointer",
              fontSize: 13, fontWeight: 700,
              color:        tab === t.id ? "#e2e8f0" : "#475569",
              borderBottom: tab === t.id ? "2px solid #818cf8" : "2px solid transparent",
              marginBottom: -1,
            }}>
              {t.label}
              <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10, background: tab===t.id ? "rgba(129,140,248,0.15)" : "#111827", color: tab===t.id ? "#818cf8" : "#334155" }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {tab === "live" ? (
          liveRows.length === 0 ? (
            <div style={{ padding: "80px 24px", textAlign: "center", borderRadius: 14, border: "1px dashed #1a2035" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🟢</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#475569", marginBottom: 8 }}>No live strategies yet</div>
              <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.6 }}>
                Publish a strategy from the Strategy Lab, then click <strong style={{ color: "#34d399" }}>Go Live</strong> to appear here.
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {liveRows.map((s, idx) => (
                <StrategyCard key={s.id} strategy={s} rank={idx + 1} expanded={expanded === s.id} onToggle={() => setExpanded(e => e === s.id ? null : s.id)}/>
              ))}
            </div>
          )
        ) : tab === "verified" ? (
          verifiedRows.length === 0 ? (
            <div style={{ padding: "80px 24px", textAlign: "center", borderRadius: 14, border: "1px dashed #1a2035" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#a78bfa", marginBottom: 8 }}>No verified strategies yet</div>
              <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.6 }}>
                Strategies are auto-verified when they have <strong style={{ color: "#e2e8f0" }}>more than 20 trades</strong> and a <strong style={{ color: "#e2e8f0" }}>positive return</strong>.
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {verifiedRows.map((s, idx) => (
                <StrategyCard key={s.id} strategy={s} rank={idx + 1} expanded={expanded === s.id} onToggle={() => setExpanded(e => e === s.id ? null : s.id)}/>
              ))}
            </div>
          )
        ) : (
          <>
            {/* Filters row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {/* Search */}
              <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#475569" }}>🔍</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search strategies or users…"
                  style={{ width: "100%", padding: "8px 12px 8px 30px", borderRadius: 8, background: "#111827", border: "1px solid #1e2d3e", fontSize: 12, color: "#e2e8f0", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              {/* Sort */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#475569" }}>
                Sort by:
                {SORT_OPTS.map(o => (
                  <button key={o.id} onClick={() => setSort(o.id)} style={{
                    padding: "5px 12px", borderRadius: 7, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer",
                    background: sort === o.id ? "rgba(129,140,248,0.15)" : "#111827",
                    color:      sort === o.id ? "#818cf8"                : "#475569",
                  }}>
                    {o.label}
                  </button>
                ))}
              </div>

              <span style={{ fontSize: 10, color: "#334155", marginLeft: "auto" }}>
                {sorted.length} strateg{sorted.length !== 1 ? "ies" : "y"}
              </span>
            </div>

            {/* Loading */}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px", gap: 10, color: "#475569" }}>
                <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #1a2035", borderTopColor: "#818cf8", borderRadius: "50%", animation: "spin 0.7s linear infinite" }}/>
                Loading strategies…
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f87171", marginBottom: 8 }}>⚠ Failed to load leaderboard</div>
                <div style={{ fontSize: 12, color: "#f87171", opacity: 0.85, marginBottom: 12, lineHeight: 1.6 }}>{error}</div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.8, borderTop: "1px solid rgba(239,68,68,0.15)", paddingTop: 10 }}>
                  <strong style={{ color: "#94a3b8" }}>To fix:</strong><br/>
                  1. Open <code style={{ color: "#94a3b8", background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4 }}>.env.local</code> in your project root<br/>
                  2. Make sure these lines exist:<br/>
                  <code style={{ color: "#818cf8" }}>NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co</code><br/>
                  <code style={{ color: "#818cf8" }}>NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...</code><br/>
                  3. Restart: <code style={{ color: "#94a3b8", background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4 }}>npm run dev</code>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && sorted.length === 0 && (
              <div style={{ padding: "60px 24px", textAlign: "center", borderRadius: 14, border: "1px dashed #1a2035" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🏆</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#475569", marginBottom: 8 }}>
                  {search ? "No strategies match your search" : "No published strategies yet"}
                </div>
                <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.6 }}>
                  {search
                    ? "Try a different search term"
                    : <>Run a backtest in the <a href="/dashboard" style={{ color: "#818cf8" }}>Strategy Lab</a>, then click "Publish Result"</>
                  }
                </div>
              </div>
            )}

            {/* Card grid */}
            {!loading && sorted.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                {sorted.map((s, idx) => (
                  <StrategyCard
                    key={s.id}
                    strategy={s}
                    rank={idx + 1}
                    expanded={expanded === s.id}
                    onToggle={() => setExpanded(e => e === s.id ? null : s.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e2d3e; border-radius: 2px; }
      `}</style>
    </div>
  );
}