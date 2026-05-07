"use client";

import { useState, useEffect } from "react";

interface Strategy {
  id: string;
  name: string;
  status: string;
  monthly_price: number;
  user_id: string;
  backtest_results: {
    return_pct: number;
    win_rate: number;
    max_drawdown: number;
    trades_count: number;
  }[];
}

interface Trader {
  username:         string;
  strategies:       Strategy[];
  followers:        number;
  winRate:          number;
  consistency:      number;
  maxDrawdown:      number;
  totalTrades:      number;
  bestReturn:       number;
  rank:             string;
  rankColor:        string;
  revenue:          number;
  currentWinStreak: number;
}

function calcConsistency(wr: number, dd: number, trades: number) {
  if (trades < 5) return 0;
  return Math.round(Math.min(100,wr*1.4)*0.5 + Math.max(0,100-dd*3)*0.3 + Math.min(100,trades/2)*0.2);
}

function getRank(trades: number, wr: number, cons: number) {
  if (trades>=200&&wr>=55&&cons>=75) return { label:"Funded Trader",    color:"#f59e0b" };
  if (trades>=100&&wr>=50&&cons>=65) return { label:"Verified Trader",  color:"#a78bfa" };
  if (trades>=50 &&wr>=45&&cons>=50) return { label:"Consistent Trader",color:"#34d399" };
  if (trades>=20)                    return { label:"Active Trader",    color:"#38bdf8" };
  return                                    { label:"Beginner",         color:"#64748b" };
}

const RANK_ORDER = ["Funded Trader","Verified Trader","Consistent Trader","Active Trader","Beginner"];

export default function BrowseTraders() {
  const [traders,     setTraders]     = useState<Trader[]>([]);
  const [following,   setFollowing]   = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState("");
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [sortBy,      setSortBy]      = useState<"consistency"|"winRate"|"followers"|"rank"|"return">("consistency");
  const [filterRank,  setFilterRank]  = useState("all");

  useEffect(() => {
    loadTraders();
    try {
      const session = JSON.parse(localStorage.getItem("tradedesk_session_v1") ?? "{}");
      const user = session.username ?? "";
      setCurrentUser(user);
      if (user) {
        fetch(`/api/trader-follows?follower_id=${user}`)
          .then(r => r.json())
          .then(d => { if (Array.isArray(d)) setFollowing(d.map((f:any) => f.trader_id)); })
          .catch(() => {});
      }
    } catch {}
  }, []);

  const loadTraders = async () => {
    setLoading(true);
    try {
      const [bt, live, ver] = await Promise.all([
        fetch("/api/leaderboard?status=backtested").then(r => r.json()),
        fetch("/api/leaderboard?status=live").then(r => r.json()),
        fetch("/api/leaderboard?status=verified").then(r => r.json()),
      ]);

      const all: Strategy[] = [
        ...(Array.isArray(bt)   ? bt   : []),
        ...(Array.isArray(live) ? live : []),
        ...(Array.isArray(ver)  ? ver  : []),
      ];

      // Group by user_id
      const byUser: Record<string, Strategy[]> = {};
      for (const s of all) {
        if (!byUser[s.user_id]) byUser[s.user_id] = [];
        byUser[s.user_id].push(s);
      }

      // Fetch follower counts for all strategies
      const followerMap: Record<string, number> = {};
      await Promise.all(all.map(async s => {
        const d = await fetch(`/api/follow?strategy_id=${s.id}`).then(r => r.json());
        followerMap[s.id] = d.count ?? 0;
      }));

      // Build trader profiles
      const traderList: Trader[] = Object.entries(byUser).map(([username, strats]) => {
        // Try real journal trades from localStorage first
        let avgWr = 0, avgDD = 0, total = 0, bestRet = 0, currentWinStreak = 0;
        try {
          const key = `tradedesk_trades_${username}_v1`;
          const raw = JSON.parse(localStorage.getItem(key) ?? "[]");
          const real: any[] = Array.isArray(raw) ? raw : [];
          if (real.length > 0) {
            total   = real.length;
            const wins = real.filter(t => (t.pnl ?? 0) > 0).length;
            avgWr   = (wins / total) * 100;
            bestRet = Math.max(...real.map(t => t.pnlPercent ?? 0));
            let peak = 0, bal = 0, streak = 0;
            for (const t of real) {
              bal += t.pnl ?? 0;
              if (bal > peak) peak = bal;
              const dd = peak > 0 ? ((peak - bal) / peak) * 100 : 0;
              if (dd > avgDD) avgDD = dd;
              if ((t.pnl ?? 0) > 0) streak++; else streak = 0;
            }
            currentWinStreak = streak;
          }
        } catch {}

        // Fall back to backtest data if no real trades found
        if (total === 0) {
          const bts = strats.flatMap(s => s.backtest_results ?? []);
          avgWr   = bts.length ? bts.reduce((s,b) => s+b.win_rate,    0)/bts.length : 0;
          avgDD   = bts.length ? bts.reduce((s,b) => s+b.max_drawdown,0)/bts.length : 0;
          total   = bts.reduce((s,b) => s+b.trades_count, 0);
          bestRet = bts.length ? Math.max(...bts.map(b => b.return_pct)) : 0;
        }

        const cons    = calcConsistency(avgWr, avgDD, total);
        const rank    = getRank(total, avgWr, cons);
        const followers = strats.reduce((s,st) => s+(followerMap[st.id]??0), 0);
        const revenue   = strats.reduce((s,st) => s+(followerMap[st.id]??0)*(st.monthly_price??0), 0);

        return {
          username, strategies: strats,
          followers, winRate: Math.round(avgWr),
          consistency: cons, maxDrawdown: parseFloat(avgDD.toFixed(1)),
          totalTrades: total, bestReturn: parseFloat(bestRet.toFixed(1)),
          rank: rank.label, rankColor: rank.color, revenue, currentWinStreak,
        };
      });

      setTraders(traderList);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Filter + sort
  const filtered = traders
    .filter(t => {
      if (search && !t.username.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterRank !== "all" && t.rank !== filterRank) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "consistency") return b.consistency - a.consistency;
      if (sortBy === "winRate")     return b.winRate - a.winRate;
      if (sortBy === "followers")   return b.followers - a.followers;
      if (sortBy === "return")      return b.bestReturn - a.bestReturn;
      if (sortBy === "rank")        return RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
      return 0;
    });

  const AVATAR_COLORS = ["#38bdf8","#a78bfa","#34d399","#f97316","#f59e0b"];

  return (
    <div style={{ minHeight:"100vh", background:"#060d1a", color:"#c8d8f0", fontFamily:"system-ui,sans-serif" }}>

      {/* Nav */}
      <div style={{ borderBottom:"1px solid #0d1628", background:"rgba(6,13,26,0.95)", padding:"14px 28px", display:"flex", alignItems:"center", gap:16, position:"sticky", top:0, zIndex:10, backdropFilter:"blur(8px)" }}>
        <a href="/leaderboard" style={{ fontSize:12, color:"#3a4a6a", textDecoration:"none" }}>← Leaderboard</a>
        <span style={{ fontSize:14, fontWeight:800, color:"#f0f4ff" }}>Browse Traders</span>
        <div style={{ flex:1 }}/>
        <a href="/dashboard" style={{ padding:"6px 14px", borderRadius:8, border:"1px solid #1a2540", background:"#0b1120", color:"#4a5a7a", fontSize:11, fontWeight:600, textDecoration:"none" }}>Dashboard</a>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px" }}>

        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <h1 style={{ fontSize:26, fontWeight:900, color:"#f0f4ff", margin:"0 0 6px", letterSpacing:"-0.02em" }}>Browse Traders</h1>
          <p style={{ fontSize:13, color:"#3a4a6a", margin:0 }}>
            {loading ? "Loading…" : `${traders.length} trader${traders.length!==1?"s":""} on the platform · Ranked by consistency`}
          </p>
        </div>

        {/* Filters */}
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:24, alignItems:"center" }}>
          {/* Search */}
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search traders…"
            style={{ padding:"8px 14px", borderRadius:10, background:"#0b1120", border:"1px solid #1a2540", color:"#e2e8f0", fontSize:12, outline:"none", width:200 }}
          />

          {/* Sort */}
          <div style={{ display:"flex", gap:4 }}>
            {[
              { key:"consistency", label:"Consistency" },
              { key:"winRate",     label:"Win Rate"    },
              { key:"followers",   label:"Followers"   },
              { key:"return",      label:"Best Return" },
              { key:"rank",        label:"Rank"        },
            ].map(s => (
              <button key={s.key} onClick={() => setSortBy(s.key as typeof sortBy)} style={{ padding:"6px 12px", borderRadius:8, border:"none", fontSize:11, fontWeight:700, cursor:"pointer", transition:"all 0.15s",
                background: sortBy===s.key ? "#38bdf8" : "#111d30",
                color:       sortBy===s.key ? "#000"    : "#4a5a7a",
              }}>{s.label}</button>
            ))}
          </div>

          {/* Rank filter */}
          <select value={filterRank} onChange={e => setFilterRank(e.target.value)} style={{ padding:"7px 12px", borderRadius:9, background:"#0b1120", border:"1px solid #1a2540", color:"#94a3b8", fontSize:12, outline:"none", cursor:"pointer" }}>
            <option value="all">All Ranks</option>
            {RANK_ORDER.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display:"flex", justifyContent:"center", padding:"60px 0", gap:12, color:"#3a4a6a", fontSize:13 }}>
            <span style={{ display:"inline-block", width:16, height:16, border:"2px solid #1a2540", borderTopColor:"#38bdf8", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
            Loading traders…
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 0", color:"#3a4a6a" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
            <div style={{ fontSize:14, fontWeight:700, color:"#f0f4ff" }}>No traders found</div>
            <div style={{ fontSize:12, marginTop:6 }}>Try a different search or filter</div>
          </div>
        )}

        {/* Trader grid */}
        {!loading && filtered.length > 0 && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:16 }}>
            {filtered.map((t, idx) => {
              const avatarColor = AVATAR_COLORS[t.username.charCodeAt(0) % AVATAR_COLORS.length];
              const pos = t.bestReturn >= 0;
              return (
                <div key={t.username} style={{ background:"#0b1120", border:"1px solid #1a2540", borderRadius:20, overflow:"hidden", transition:"all 0.2s", position:"relative" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.border = "1px solid #1e2f4a"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 30px rgba(0,0,0,0.4)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.border = "1px solid #1a2540"; (e.currentTarget as HTMLDivElement).style.transform = "none"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
                >
                  {/* Rank badge top-right */}
                  {idx < 3 && (
                    <div style={{ position:"absolute", top:12, right:12, fontSize:18 }}>
                      {idx===0?"🥇":idx===1?"🥈":"🥉"}
                    </div>
                  )}

                  {/* Card header */}
                  <div style={{ padding:"20px 20px 14px", display:"flex", alignItems:"center", gap:14 }}>
                    <div style={{ width:52, height:52, borderRadius:14, background:`${avatarColor}22`, border:`2px solid ${avatarColor}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:900, color:avatarColor, flexShrink:0, fontFamily:"monospace" }}>
                      {t.username.slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, flexWrap:"wrap" }}>
                        <span style={{ fontSize:14, fontWeight:800, color:"#f0f4ff" }}>@{t.username}</span>
                        {t.currentWinStreak >= 3 && (
                          <span style={{ fontSize:10, fontWeight:800, padding:"2px 7px", borderRadius:10,
                            background: t.currentWinStreak >= 10 ? "rgba(249,115,22,0.15)" : t.currentWinStreak >= 5 ? "rgba(251,191,36,0.12)" : "rgba(52,211,153,0.1)",
                            color:      t.currentWinStreak >= 10 ? "#f97316"               : t.currentWinStreak >= 5 ? "#fbbf24"               : "#34d399",
                            border:    `1px solid ${t.currentWinStreak >= 10 ? "rgba(249,115,22,0.3)" : t.currentWinStreak >= 5 ? "rgba(251,191,36,0.25)" : "rgba(52,211,153,0.2)"}`,
                          }}>
                            {t.currentWinStreak >= 10 ? "🔥" : t.currentWinStreak >= 5 ? "⚡" : "📈"} {t.currentWinStreak} streak
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:20, background:`${t.rankColor}15`, border:`1px solid ${t.rankColor}30`, color:t.rankColor }}>
                        {t.rank}
                      </span>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:9, color:"#3a4a6a", marginBottom:2 }}>Consistency</div>
                      <div style={{ fontSize:20, fontWeight:900, fontFamily:"monospace", color: t.consistency>=70?"#38bdf8":t.consistency>=50?"#94a3b8":"#3a4a6a" }}>{t.consistency}</div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:0, borderTop:"1px solid #0d1828", borderBottom:"1px solid #0d1828" }}>
                    {[
                      { label:"Win Rate",  value:`${t.winRate}%`,              color: t.winRate>=55?"#34d399":t.winRate>=45?"#fbbf24":"#f87171" },
                      { label:"Max DD",    value:`${t.maxDrawdown}%`,           color: t.maxDrawdown<15?"#34d399":t.maxDrawdown<25?"#fbbf24":"#f87171" },
                      { label:"Best Ret",  value:`${pos?"+":""}${t.bestReturn}%`,color: pos?"#34d399":"#f87171" },
                    ].map((s,i) => (
                      <div key={i} style={{ padding:"10px 0", textAlign:"center", borderRight: i<2?"1px solid #0d1828":"none" }}>
                        <div style={{ fontSize:9, color:"#3a4a6a", marginBottom:3, textTransform:"uppercase", letterSpacing:"0.07em" }}>{s.label}</div>
                        <div style={{ fontSize:13, fontWeight:800, fontFamily:"monospace", color:s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Rank progression ladder */}
                  {(() => {
                    const RANKS = [
                      { label:"Beginner",          color:"#64748b", req:"20 trades" },
                      { label:"Active Trader",     color:"#38bdf8", req:"50 trades" },
                      { label:"Consistent Trader", color:"#34d399", req:"100 trades" },
                      { label:"Verified Trader",   color:"#a78bfa", req:"200 trades" },
                      { label:"Funded Trader",     color:"#f59e0b", req:"Broker required" },
                    ];
                    const currentIdx = RANKS.findIndex(r => r.label === t.rank);
                    return (
                      <div style={{ padding:"12px 20px", borderTop:"1px solid #0d1828" }}>
                        <div style={{ fontSize:9, fontWeight:700, color:"#2e3f5a", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Rank Progression</div>
                        <div style={{ display:"flex", alignItems:"center", gap:0 }}>
                          {RANKS.map((r, i) => {
                            const done    = i < currentIdx;
                            const active  = i === currentIdx;
                            const locked  = i > currentIdx;
                            return (
                              <div key={i} style={{ display:"flex", alignItems:"center", flex: i < RANKS.length-1 ? 1 : "none" }}>
                                <div title={`${r.label} — ${r.req}`} style={{ width:22, height:22, borderRadius:11, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:800, cursor:"default",
                                  background: done ? `${r.color}25` : active ? `${r.color}20` : "#111d30",
                                  border: `1px solid ${done || active ? r.color : "#1e2f4a"}`,
                                  color: done || active ? r.color : "#2e3f5a",
                                  boxShadow: active ? `0 0 8px ${r.color}44` : "none",
                                }}>
                                  {done ? "✓" : active ? "●" : "○"}
                                </div>
                                {i < RANKS.length-1 && (
                                  <div style={{ flex:1, height:2, background: done ? `${r.color}44` : "#111d30", margin:"0 2px" }}/>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                          {RANKS.map((r,i) => (
                            <div key={i} style={{ fontSize:7, color: i <= currentIdx ? r.color : "#1e2f4a", fontWeight:700, textAlign:"center", width:22, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {r.label.split(" ")[0]}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Footer */}
                  <div style={{ padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ display:"flex", gap:14, fontSize:11, color:"#3a4a6a" }}>
                      <span>{t.strategies.length} strateg{t.strategies.length!==1?"ies":"y"}</span>
                      {t.followers > 0 && <span style={{ color:"#38bdf8" }}>👥 {t.followers}</span>}
                      {t.revenue > 0 && <span style={{ color:"#22d3a5" }}>💰 ${t.revenue}/mo</span>}
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      {currentUser && currentUser !== t.username && (
                        <button onClick={async () => {
                          const isF = following.includes(t.username);
                          if (isF) {
                            await fetch("/api/trader-follows", { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({follower_id:currentUser,trader_id:t.username}) });
                            setFollowing(prev => prev.filter(u => u !== t.username));
                          } else {
                            await fetch("/api/trader-follows", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({follower_id:currentUser,trader_id:t.username}) });
                            setFollowing(prev => [...prev, t.username]);
                          }
                        }} style={{ padding:"5px 12px", borderRadius:8, fontSize:10, fontWeight:700, cursor:"pointer", transition:"all 0.15s",
                          border:`1px solid ${following.includes(t.username)?"rgba(248,113,113,0.3)":"rgba(56,189,248,0.25)"}`,
                          background:following.includes(t.username)?"rgba(248,113,113,0.06)":"rgba(56,189,248,0.06)",
                          color:following.includes(t.username)?"#f87171":"#38bdf8",
                        }}>
                          {following.includes(t.username) ? "✓ Following" : "+ Follow"}
                        </button>
                      )}
                      <a href={`/trader/@${t.username}`} style={{ padding:"6px 14px", borderRadius:8, background:"rgba(56,189,248,0.08)", border:"1px solid rgba(56,189,248,0.2)", color:"#38bdf8", fontSize:11, fontWeight:700, textDecoration:"none" }}>View →</a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}