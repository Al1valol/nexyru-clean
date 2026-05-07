"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────
interface Strategy {
  id: string;
  name: string;
  status: string;
  monthly_price: number;
  created_at: string;
  backtest_results: {
    return_pct: number;
    win_rate: number;
    max_drawdown: number;
    trades_count: number;
  }[];
}

interface ProfileStats {
  verifiedTrades:     number;
  totalTrades:        number;
  verifiedTrades:     number;
  winRate:            number;
  avgRR:              number;
  consistency:        number;
  maxDrawdown:        number;
  totalPnl:           number;
  bestStreak:         number;
  currentWinStreak:   number;
  currentTradeStreak: number;
  bestTradeStreak:    number;
  joinDate:           string;
}

interface Badge {
  id:    string;
  label: string;
  icon:  string;
  color: string;
  desc:  string;
}

// ── Rank system ────────────────────────────────────────────────
function getRank(stats: ProfileStats): { label: string; color: string; next: string; progress: number } {
  const { winRate, totalTrades, consistency } = stats;
  if (totalTrades >= 200 && winRate >= 60 && consistency >= 80) return { label: "Funded Trader",    color: "#f59e0b", next: "Max rank reached",    progress: 100 };
  if (totalTrades >= 100 && winRate >= 55 && consistency >= 70) return { label: "Verified Trader",  color: "#a78bfa", next: "Funded Trader",       progress: Math.min(100, ((totalTrades-100)/100)*100) };
  if (totalTrades >= 50  && winRate >= 50 && consistency >= 55) return { label: "Consistent Trader",color: "#34d399", next: "Verified Trader",     progress: Math.min(100, ((totalTrades-50)/50)*100)   };
  if (totalTrades >= 20)                                        return { label: "Active Trader",    color: "#38bdf8", next: "Consistent Trader",   progress: Math.min(100, ((totalTrades-20)/30)*100)   };
  return                                                               { label: "Beginner",         color: "#64748b", next: "Active Trader",       progress: Math.min(100, (totalTrades/20)*100)        };
}

// ── Badge calculator ───────────────────────────────────────────
function getBadges(stats: ProfileStats, strategies: Strategy[]): Badge[] {
  const badges: Badge[] = [];
  if (stats.winRate >= 60)      badges.push({ id:"high_wr",    label:"Sharp Shooter",   icon:"🎯", color:"#34d399", desc:"60%+ win rate"                });
  if (stats.consistency >= 75)  badges.push({ id:"consistent", label:"Consistent",      icon:"📊", color:"#38bdf8", desc:"75+ consistency score"         });
  if (stats.totalTrades >= 100) badges.push({ id:"centurion",  label:"Centurion",       icon:"💯", color:"#a78bfa", desc:"100+ trades logged"            });
  if (stats.maxDrawdown < 10)   badges.push({ id:"low_dd",     label:"Risk Master",     icon:"🛡️", color:"#22d3a5", desc:"Max drawdown under 10%"        });
  if (stats.bestStreak >= 5)    badges.push({ id:"streak",     label:"On Fire",         icon:"🔥", color:"#f97316", desc:"5+ trade win streak"           });
  if (stats.totalPnl > 0)       badges.push({ id:"profitable", label:"In The Green",    icon:"💚", color:"#34d399", desc:"Overall positive PnL"          });
  if (strategies.some(s => s.status === "verified")) badges.push({ id:"verified", label:"Verified Strategy", icon:"✓", color:"#a78bfa", desc:"Has a verified strategy" });
  if (strategies.some(s => (s.monthly_price ?? 0) > 0)) badges.push({ id:"earner", label:"Earning",  icon:"💰", color:"#fbbf24", desc:"Has paid subscribers"       });
  return badges;
}

// ── Consistency score (0–100) ──────────────────────────────────
function calcConsistency(winRate: number, maxDrawdown: number, totalTrades: number): number {
  if (totalTrades < 5) return 0;
  const wrScore  = Math.min(100, winRate * 1.4);
  const ddScore  = Math.max(0, 100 - maxDrawdown * 3);
  const volScore = Math.min(100, totalTrades / 2);
  return Math.round((wrScore * 0.5 + ddScore * 0.3 + volScore * 0.2));
}

// ── Stat pill ──────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background:"#0d1628", border:"1px solid #1a2540", borderRadius:12, padding:"14px 18px", textAlign:"center" }}>
      <div style={{ fontSize:9, fontWeight:700, color:"#3a4a6a", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:900, fontFamily:"monospace", color: color ?? "#f0f4ff", lineHeight:1 }}>{value}</div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function TraderProfile() {
  const params  = useParams();
  const username = decodeURIComponent((params?.username as string) ?? "").replace(/^@/, "");

  const [strategies,  setStrategies]  = useState<Strategy[]>([]);
  const [stats,       setStats]       = useState<ProfileStats | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [notFound,    setNotFound]    = useState(false);
  const [followerCounts, setFollowerCounts] = useState<Record<string,number>>({});

  const [isFollowing,   setIsFollowing]   = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [currentUser,   setCurrentUser]   = useState("");

  useEffect(() => {
    if (!username) return;
    loadProfile();
    // Get current logged in user
    try {
      const session = JSON.parse(localStorage.getItem("tradedesk_session_v1") ?? "{}");
      setCurrentUser(session.username ?? "");
    } catch {}
  }, [username]);

  // Check follow status when currentUser is set
  useEffect(() => {
    if (!currentUser || !username || currentUser === username) return;
    fetch(`/api/trader-follows?follower_id=${currentUser}&trader_id=${username}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d) && d.length > 0) setIsFollowing(true); })
      .catch(() => {});
    fetch(`/api/trader-follows?trader_id=${username}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setFollowerCount(d.length); })
      .catch(() => {});
  }, [currentUser, username]);

  const toggleFollow = async () => {
    if (!currentUser || followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await fetch("/api/trader-follows", {
          method:  "DELETE",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ follower_id: currentUser, trader_id: username }),
        });
        setIsFollowing(false);
        setFollowerCount(p => Math.max(0, p - 1));
      } else {
        await fetch("/api/trader-follows", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ follower_id: currentUser, trader_id: username }),
        });
        setIsFollowing(true);
        setFollowerCount(p => p + 1);
        // Log to activity feed
        await fetch("/api/activity", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ user_id: currentUser, type: "followed_trader", data: { trader: username } }),
        }).catch(() => {});
      }
    } catch {}
    setFollowLoading(false);
  };

  const loadProfile = async () => {
    setLoading(true);
    try {
      // Fetch all published strategies for this user
      const [btRes, liveRes, verRes] = await Promise.all([
        fetch("/api/leaderboard?status=backtested"),
        fetch("/api/leaderboard?status=live"),
        fetch("/api/leaderboard?status=verified"),
      ]);
      const [bt, live, ver] = await Promise.all([btRes.json(), liveRes.json(), verRes.json()]);
      const allStrats: Strategy[] = [
        ...(Array.isArray(bt)   ? bt   : []),
        ...(Array.isArray(live) ? live : []),
        ...(Array.isArray(ver)  ? ver  : []),
      ].filter((s: any) => s.user_id === username);

      // Fetch follower counts
      const counts: Record<string,number> = {};
      await Promise.all(allStrats.map(async s => {
        const r = await fetch(`/api/follow?strategy_id=${s.id}`);
        const d = await r.json();
        counts[s.id] = d.count ?? 0;
      }));
      setFollowerCounts(counts);

      // Build stats from backtest results
      if (allStrats.length === 0) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Use real journal trades from localStorage first
      let winRate = 0, maxDD = 0, totalPnl = 0, total = 0, bestStreak = 0;
      let currentWinStreak = 0, currentTradeStreak = 0, bestTradeStreak = 0;
      try {
        const key = `tradedesk_trades_${username}_v1`;
        const raw = JSON.parse(localStorage.getItem(key) ?? "[]");
        const real: any[] = Array.isArray(raw) ? raw : [];
        if (real.length > 0) {
          total = real.length;
          const wins = real.filter(t => (t.pnl ?? 0) > 0).length;
          winRate = Math.round((wins / total) * 100);
          totalPnl = real.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0);
          // Max drawdown + win streak
          let peak = 0, bal = 0, streak = 0, maxStreak = 0;
          for (const t of real) {
            bal += t.pnl ?? 0;
            if (bal > peak) peak = bal;
            const dd = peak > 0 ? ((peak - bal) / peak) * 100 : 0;
            if (dd > maxDD) maxDD = dd;
            if ((t.pnl ?? 0) > 0) { streak++; if (streak > maxStreak) maxStreak = streak; }
            else streak = 0;
          }
          const verifiedTrades = real.filter((t:any) => t.source === "broker_import").length;
          // Daily trade streak
          const days = [...new Set(real.map((t:any) => new Date(t.date).toISOString().split("T")[0]))].sort() as string[];
          let dayStreak = 1, bestDay = 1;
          for (let i = 1; i < days.length; i++) {
            const diff = Math.round((new Date(days[i]).getTime() - new Date(days[i-1]).getTime()) / 86400000);
            if (diff === 1) { dayStreak++; if (dayStreak > bestDay) bestDay = dayStreak; }
            else dayStreak = 1;
          }
          if (days.length === 1) bestDay = 1;
          const lastDay   = days[days.length - 1] ?? "";
          const today     = new Date().toISOString().split("T")[0];
          const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
          currentTradeStreak = (lastDay === today || lastDay === yesterday) ? dayStreak : 0;
          bestTradeStreak    = bestDay;
        }
      } catch {}

      // Fall back to backtest data if no real trades
      if (total === 0) {
        const bts = allStrats.flatMap(s => s.backtest_results ?? []);
        const avgWr  = bts.length ? bts.reduce((s,b) => s + b.win_rate,    0) / bts.length : 0;
        const avgDD  = bts.length ? bts.reduce((s,b) => s + b.max_drawdown,0) / bts.length : 0;
        total    = bts.reduce((s,b) => s + b.trades_count, 0);
        totalPnl = bts.length ? bts.reduce((s,b) => s + b.return_pct, 0) / bts.length : 0;
        winRate  = Math.round(avgWr);
        maxDD    = parseFloat(avgDD.toFixed(1));
        bestStreak = Math.floor(avgWr / 15);
      }

      const profileStats: ProfileStats = {
        totalTrades: total,
        verifiedTrades: real.filter((t:any) => t.source === "broker_import").length,
        winRate,
        avgRR:             parseFloat((winRate > 50 ? 1.5 + (winRate - 50) / 30 : 0.8).toFixed(2)),
        consistency:       calcConsistency(winRate, maxDD, total),
        maxDrawdown:       parseFloat(maxDD.toFixed(1)),
        totalPnl:          parseFloat(totalPnl.toFixed(2)),
        bestStreak,
        currentWinStreak,
        currentTradeStreak,
        bestTradeStreak,
        joinDate:          allStrats[0].created_at,
      };

      setStrategies(allStrats);
      setStats(profileStats);
    } catch (e) {
      console.error(e);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#060d1a", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, color:"#3a4a6a", fontSize:14 }}>
        <span style={{ display:"inline-block", width:18, height:18, border:"2px solid #1a2540", borderTopColor:"#38bdf8", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
        Loading trader profile…
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (notFound || !stats) return (
    <div style={{ minHeight:"100vh", background:"#060d1a", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
      <div style={{ fontSize:48 }}>👤</div>
      <div style={{ fontSize:20, fontWeight:800, color:"#f0f4ff" }}>Trader not found</div>
      <div style={{ fontSize:13, color:"#3a4a6a" }}>@{username} hasn't published any strategies yet</div>
      <a href="/leaderboard" style={{ padding:"9px 20px", borderRadius:10, background:"rgba(56,189,248,0.1)", border:"1px solid rgba(56,189,248,0.2)", color:"#38bdf8", fontSize:12, fontWeight:700, textDecoration:"none" }}>Browse Leaderboard</a>
    </div>
  );

  const rank   = getRank(stats);
  const badges = getBadges(stats, strategies);
  const totalFollowers = Object.values(followerCounts).reduce((s,n) => s+n, 0);
  const monthlyRevenue = strategies.reduce((sum,s) => sum + (followerCounts[s.id]??0) * (s.monthly_price??0), 0);

  // Avatar initials + color
  const avatarColor = ["#38bdf8","#a78bfa","#34d399","#f97316","#f59e0b"][username.charCodeAt(0) % 5];
  const initials    = username.slice(0,2).toUpperCase();

  return (
    <div style={{ minHeight:"100vh", background:"#060d1a", color:"#c8d8f0", fontFamily:"system-ui,sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Top nav */}
      <div style={{ borderBottom:"1px solid #0d1628", background:"#060d1a", padding:"14px 28px", display:"flex", alignItems:"center", gap:16, position:"sticky", top:0, zIndex:10, backdropFilter:"blur(8px)" }}>
        <a href="/leaderboard" style={{ fontSize:12, color:"#3a4a6a", textDecoration:"none", display:"flex", alignItems:"center", gap:5 }}>← Leaderboard</a>
        <div style={{ flex:1 }}/>
        <a href="/dashboard" style={{ padding:"6px 14px", borderRadius:8, border:"1px solid #1a2540", background:"#0b1120", color:"#4a5a7a", fontSize:11, fontWeight:600, textDecoration:"none" }}>Dashboard</a>
      </div>

      <div style={{ maxWidth:900, margin:"0 auto", padding:"32px 24px", animation:"fadeIn 0.4s ease" }}>

        {/* ── Profile header ── */}
        <div style={{ background:"linear-gradient(135deg,#0d1628,#0f1e30)", border:"1px solid #1a2540", borderRadius:24, padding:"32px", marginBottom:20, position:"relative", overflow:"hidden" }}>
          {/* Background decoration */}
          <div style={{ position:"absolute", top:-40, right:-40, width:200, height:200, borderRadius:"50%", background:`${avatarColor}08`, pointerEvents:"none" }}/>

          <div style={{ display:"flex", alignItems:"flex-start", gap:24, flexWrap:"wrap" }}>
            {/* Avatar */}
            <div style={{ width:80, height:80, borderRadius:20, background:`${avatarColor}22`, border:`2px solid ${avatarColor}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, fontWeight:900, color:avatarColor, flexShrink:0, fontFamily:"monospace" }}>
              {initials}
            </div>

            {/* Name + rank */}
            <div style={{ flex:1, minWidth:200 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:6 }}>
                <h1 style={{ fontSize:24, fontWeight:900, color:"#f0f4ff", margin:0, letterSpacing:"-0.02em" }}>@{username}</h1>
                <span style={{ fontSize:11, fontWeight:800, padding:"4px 12px", borderRadius:20, background:`${rank.color}18`, border:`1px solid ${rank.color}44`, color:rank.color }}>
                  {rank.label}
                </span>
              </div>
              <div style={{ fontSize:12, color:"#3a4a6a", marginBottom:10 }}>
                Member since {new Date(stats.joinDate).toLocaleDateString("en-US",{month:"long",year:"numeric"})}
                {" · "}{strategies.length} published strateg{strategies.length!==1?"ies":"y"}
                {totalFollowers > 0 && ` · ${totalFollowers} strategy follower${totalFollowers!==1?"s":""}`}
                {followerCount > 0 && ` · ${followerCount} trader follower${followerCount!==1?"s":""}`}
              </div>

              {/* Follow button */}
              {currentUser && currentUser !== username && (
                <button onClick={toggleFollow} disabled={followLoading} style={{
                  display:"inline-flex", alignItems:"center", gap:6, marginBottom:14,
                  padding:"7px 16px", borderRadius:10, fontSize:12, fontWeight:700,
                  cursor:followLoading?"not-allowed":"pointer", transition:"all 0.15s",
                  border:`1px solid ${isFollowing?"rgba(248,113,113,0.3)":"rgba(56,189,248,0.3)"}`,
                  background:isFollowing?"rgba(248,113,113,0.06)":"rgba(56,189,248,0.08)",
                  color:isFollowing?"#f87171":"#38bdf8",
                }}>
                  {followLoading ? "…" : isFollowing ? "✓ Following" : "+ Follow"}
                </button>
              )}

              {/* Rank progress bar */}
              {rank.progress < 100 && (
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                    <span style={{ fontSize:10, color:"#3a4a6a" }}>Progress to {rank.next}</span>
                    <span style={{ fontSize:10, color:rank.color, fontWeight:700 }}>{Math.round(rank.progress)}%</span>
                  </div>
                  <div style={{ height:5, borderRadius:3, background:"#111d30", overflow:"hidden" }}>
                    <div style={{ width:`${rank.progress}%`, height:"100%", background:`linear-gradient(90deg,${rank.color}88,${rank.color})`, borderRadius:3, transition:"width 0.8s" }}/>
                  </div>
                </div>
              )}
            </div>

            {/* Revenue (only shown if earning) */}
            {monthlyRevenue > 0 && (
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontSize:10, color:"#3a4a6a", marginBottom:4 }}>Est. Monthly</div>
                <div style={{ fontSize:22, fontWeight:900, color:"#22d3a5", fontFamily:"monospace" }}>${monthlyRevenue.toFixed(0)}</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Stat pills ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10, marginBottom:20 }}>
          <StatPill label="Win Rate"     value={`${stats.winRate}%`}        color={stats.winRate >= 55 ? "#34d399" : stats.winRate >= 45 ? "#fbbf24" : "#f87171"}/>
          <StatPill label="Consistency"  value={`${stats.consistency}`}     color={stats.consistency >= 70 ? "#38bdf8" : "#94a3b8"}/>
          <StatPill label="Avg RR"       value={`${stats.avgRR}`}           color={stats.avgRR >= 1.5 ? "#34d399" : "#94a3b8"}/>
          <StatPill label="Max Drawdown" value={`${stats.maxDrawdown}%`}    color={stats.maxDrawdown < 15 ? "#34d399" : stats.maxDrawdown < 25 ? "#fbbf24" : "#f87171"}/>
          <StatPill label="Total Trades" value={String(stats.totalTrades)}  color="#94a3b8"/>
          <StatPill label="Followers"    value={String(totalFollowers)}     color="#38bdf8"/>
        </div>

        {/* ── Streaks ── */}
        <div style={{ background:"#0b1120", border:"1px solid #1a2540", borderRadius:20, padding:"20px 22px", marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:800, color:"#f0f4ff", marginBottom:16 }}>🔥 Streaks</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12 }}>

            {/* Current win streak */}
            <div style={{ background: stats.currentWinStreak >= 5 ? "rgba(249,115,22,0.08)" : "#0d1628", border:`1px solid ${stats.currentWinStreak >= 5 ? "rgba(249,115,22,0.4)" : "#1a2540"}`, borderRadius:14, padding:"16px", textAlign:"center", position:"relative", overflow:"hidden" }}>
              {stats.currentWinStreak >= 5 && <div style={{ position:"absolute", inset:0, background:"radial-gradient(circle at 50% 0%,rgba(249,115,22,0.1),transparent 70%)", pointerEvents:"none" }}/>}
              <div style={{ fontSize:28, marginBottom:6 }}>{stats.currentWinStreak >= 10 ? "🔥" : stats.currentWinStreak >= 5 ? "⚡" : stats.currentWinStreak >= 3 ? "📈" : "➖"}</div>
              <div style={{ fontSize:32, fontWeight:900, fontFamily:"monospace", color: stats.currentWinStreak >= 5 ? "#f97316" : stats.currentWinStreak >= 3 ? "#34d399" : "#3a4a6a", lineHeight:1 }}>{stats.currentWinStreak}</div>
              <div style={{ fontSize:10, color:"#3a4a6a", marginTop:6, fontWeight:600 }}>Current Win Streak</div>
              {stats.currentWinStreak >= 5 && <div style={{ fontSize:9, color:"#f97316", marginTop:4, fontWeight:700 }}>ON FIRE</div>}
            </div>

            {/* Best win streak */}
            <div style={{ background:"#0d1628", border:"1px solid #1a2540", borderRadius:14, padding:"16px", textAlign:"center" }}>
              <div style={{ fontSize:28, marginBottom:6 }}>🏆</div>
              <div style={{ fontSize:32, fontWeight:900, fontFamily:"monospace", color:"#fbbf24", lineHeight:1 }}>{stats.bestStreak}</div>
              <div style={{ fontSize:10, color:"#3a4a6a", marginTop:6, fontWeight:600 }}>Best Win Streak</div>
            </div>

            {/* Daily trade streak */}
            <div style={{ background: stats.currentTradeStreak >= 7 ? "rgba(56,189,248,0.08)" : "#0d1628", border:`1px solid ${stats.currentTradeStreak >= 7 ? "rgba(56,189,248,0.35)" : "#1a2540"}`, borderRadius:14, padding:"16px", textAlign:"center" }}>
              <div style={{ fontSize:28, marginBottom:6 }}>📅</div>
              <div style={{ fontSize:32, fontWeight:900, fontFamily:"monospace", color: stats.currentTradeStreak >= 7 ? "#38bdf8" : stats.currentTradeStreak >= 3 ? "#94a3b8" : "#3a4a6a", lineHeight:1 }}>{stats.currentTradeStreak}</div>
              <div style={{ fontSize:10, color:"#3a4a6a", marginTop:6, fontWeight:600 }}>Day Trade Streak</div>
              {stats.currentTradeStreak === 0 && <div style={{ fontSize:9, color:"#f87171", marginTop:4, fontWeight:700 }}>STREAK BROKEN</div>}
            </div>

            {/* Best daily streak */}
            <div style={{ background:"#0d1628", border:"1px solid #1a2540", borderRadius:14, padding:"16px", textAlign:"center" }}>
              <div style={{ fontSize:28, marginBottom:6 }}>⭐</div>
              <div style={{ fontSize:32, fontWeight:900, fontFamily:"monospace", color:"#a78bfa", lineHeight:1 }}>{stats.bestTradeStreak}</div>
              <div style={{ fontSize:10, color:"#3a4a6a", marginTop:6, fontWeight:600 }}>Best Day Streak</div>
            </div>

          </div>
        </div>

        {/* ── Badges ── */}
        {badges.length > 0 && (
          <div style={{ background:"#0b1120", border:"1px solid #1a2540", borderRadius:20, padding:"20px 22px", marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#f0f4ff", marginBottom:14 }}>Badges</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
              {badges.map(b => (
                <div key={b.id} title={b.desc} style={{ display:"flex", alignItems:"center", gap:7, padding:"7px 14px", borderRadius:12, background:`${b.color}10`, border:`1px solid ${b.color}33`, cursor:"default" }}>
                  <span style={{ fontSize:16 }}>{b.icon}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:b.color }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Published strategies ── */}
        <div style={{ background:"#0b1120", border:"1px solid #1a2540", borderRadius:20, overflow:"hidden", marginBottom:20 }}>
          <div style={{ padding:"20px 22px", borderBottom:"1px solid #1a2540" }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#f0f4ff" }}>Published Strategies</div>
          </div>
          {strategies.length === 0 ? (
            <div style={{ padding:"40px 24px", textAlign:"center", color:"#3a4a6a", fontSize:12 }}>No published strategies yet</div>
          ) : (
            strategies.map(s => {
              const bt        = s.backtest_results?.[0];
              const fCount    = followerCounts[s.id] ?? 0;
              const pos       = (bt?.return_pct ?? 0) >= 0;
              const STATUS_C  = { verified:"#a78bfa", live:"#34d399", backtested:"#38bdf8" } as Record<string,string>;
              const sc        = STATUS_C[s.status] ?? "#38bdf8";
              return (
                <div key={s.id} style={{ padding:"16px 22px", borderBottom:"1px solid #0d1828", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
                  <div style={{ flex:1, minWidth:160 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:4 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:"#e2e8f0" }}>{s.name}</span>
                      <span style={{ fontSize:9, padding:"1px 7px", borderRadius:10, background:`${sc}15`, color:sc, border:`1px solid ${sc}30`, fontWeight:700 }}>{s.status}</span>
                    </div>
                    {bt && (
                      <div style={{ display:"flex", gap:12, fontSize:11, color:"#3a4a6a" }}>
                        <span style={{ color: pos ? "#34d399" : "#f87171", fontWeight:700 }}>{pos?"+":""}{bt.return_pct.toFixed(1)}%</span>
                        <span>{bt.win_rate.toFixed(0)}% WR</span>
                        <span>{bt.trades_count} trades</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:16, flexShrink:0 }}>
                    {fCount > 0 && <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:9, color:"#3a4a6a" }}>Followers</div>
                      <div style={{ fontSize:14, fontWeight:700, color:"#38bdf8", fontFamily:"monospace" }}>{fCount}</div>
                    </div>}
                    {(s.monthly_price ?? 0) > 0 && <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:9, color:"#3a4a6a" }}>Price</div>
                      <div style={{ fontSize:14, fontWeight:700, color:"#fbbf24", fontFamily:"monospace" }}>${s.monthly_price}/mo</div>
                    </div>}
                    <a href="/leaderboard" style={{ padding:"6px 14px", borderRadius:8, background:"rgba(56,189,248,0.08)", border:"1px solid rgba(56,189,248,0.2)", color:"#38bdf8", fontSize:11, fontWeight:700, textDecoration:"none" }}>View →</a>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Rank progression ── */}
        <div style={{ background:"#0b1120", border:"1px solid #1a2540", borderRadius:20, padding:"20px 22px" }}>
          <div style={{ fontSize:13, fontWeight:800, color:"#f0f4ff", marginBottom:16 }}>Rank Progression</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[
              { label:"Beginner",          req:"Start trading",                   color:"#64748b" },
              { label:"Active Trader",     req:"20+ trades",                      color:"#38bdf8" },
              { label:"Consistent Trader", req:"50+ trades, 50%+ WR",             color:"#34d399" },
              { label:"Verified Trader",   req:"100+ trades, 55%+ WR, 70+ score", color:"#a78bfa" },
              { label:"Funded Trader",     req:"200+ trades, 60%+ WR, 80+ score", color:"#f59e0b" },
            ].map((r, i) => {
              const active = rank.label === r.label;
              const past   = ["Beginner","Active Trader","Consistent Trader","Verified Trader","Funded Trader"].indexOf(r.label) <
                             ["Beginner","Active Trader","Consistent Trader","Verified Trader","Funded Trader"].indexOf(rank.label);
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderRadius:10, background: active ? `${r.color}10` : "transparent", border:`1px solid ${active ? r.color+"40" : "#1a2540"}` }}>
                  <div style={{ width:22, height:22, borderRadius:11, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800,
                    background: active || past ? `${r.color}20` : "#111d30",
                    border:`1px solid ${active || past ? r.color : "#1e2f4a"}`,
                    color: active || past ? r.color : "#2e3f5a",
                  }}>{past ? "✓" : active ? "●" : "○"}</div>
                  <div style={{ flex:1 }}>
                    <span style={{ fontSize:12, fontWeight: active ? 800 : 600, color: active ? r.color : past ? "#c8d8f0" : "#3a4a6a" }}>{r.label}</span>
                    <span style={{ fontSize:10, color:"#2e3f5a", marginLeft:8 }}>{r.req}</span>
                  </div>
                  {active && <span style={{ fontSize:10, fontWeight:700, color:r.color }}>Current</span>}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}