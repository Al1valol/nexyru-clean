"use client";
import { useState, useEffect } from "react";

interface Trader {
  username: string;
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  winStreak: number;
  verifiedTrades: number;
  rank: string;
  rankColor: string;
  avatarColor: string;
}

const AVATAR_COLORS = ["#6366f1","#a5b4fc","#10b981","#f59e0b","#f59e0b","#f43f5e","#22d3ee","#6366f1"];

function getRank(trades:number, wr:number) {
  if(trades>=200&&wr>=60) return {label:"Funded Trader",  color:"#f59e0b"};
  if(trades>=100&&wr>=55) return {label:"Verified Trader",color:"#a5b4fc"};
  if(trades>=50 &&wr>=50) return {label:"Consistent",     color:"#10b981"};
  if(trades>=20)          return {label:"Active Trader",  color:"#6366f1"};
  return                         {label:"Beginner",       color:"#6b7280"};
}

function TraderCard({ trader, currentUser }: { trader: Trader; currentUser: string }) {
  const rank = getRank(trader.totalTrades, trader.winRate);
  const isOwn = trader.username === currentUser;
  const pos = trader.totalPnl >= 0;

 return (<a href={`/trader/@${trader.username}`} style={{ textDecoration:"none", display:"block" }}><div style={{ background:"#111118", border:"1px solid #2a2a3a", borderRadius:18, padding:"20px", cursor:"pointer", transition:"all 0.15s", position:"relative", overflow:"hidden" }}
        onMouseEnter={e=>(e.currentTarget.style.border="1px solid #1e3050")}
        onMouseLeave={e=>(e.currentTarget.style.border="1px solid #2a2a3a")}><div style={{ position:"absolute", top:-20, right:-20, width:80, height:80, borderRadius:"50%", background:`${trader.avatarColor}07`, pointerEvents:"none" }}/>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}><div style={{ width:48, height:48, borderRadius:14, background:`${trader.avatarColor}20`, border:`1.5px solid ${trader.avatarColor}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:900, color:trader.avatarColor, fontFamily:"monospace", flexShrink:0, position:"relative" }}>
            {trader.username.slice(0,2).toUpperCase()}
            {trader.verifiedTrades >= 50 && (<div style={{ position:"absolute", bottom:-3, right:-3, width:14, height:14, borderRadius:"50%", background:"#f59e0b", border:"1.5px solid #060d1a", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, fontWeight:900, color:"#000" }}>✓</div>
            )}
          </div><div style={{ flex:1, minWidth:0 }}><div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}><span style={{ fontSize:13, fontWeight:800, color:"#ffffff", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>@{trader.username}</span>
              {isOwn && <span style={{ fontSize:8, fontWeight:700, padding:"1px 6px", borderRadius:8, background:"rgba(99,102,241,0.1)", color:"#6366f1", flexShrink:0 }}>YOU</span>}
            </div><span style={{ fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:10, background:`${rank.color}15`, border:`1px solid ${rank.color}30`, color:rank.color }}>{rank.label}</span></div></div>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
          {[
            { label:"Win Rate", value:`${trader.winRate}%`, color: trader.winRate>=55?"#10b981":trader.winRate>=45?"#f59e0b":"#ef4444" },
            { label:"PnL",      value:`${pos?"+":""}${trader.totalPnl>=1000?`${(trader.totalPnl/1000).toFixed(1)}k`:trader.totalPnl.toFixed(0)}`, color:pos?"#10b981":"#ef4444" },
            { label:"Trades",   value:String(trader.totalTrades), color:"#9ca3af" },
          ].map((s,i) =>(<div key={i} style={{ background:"#111118", borderRadius:10, padding:"10px 8px", textAlign:"center" }}><div style={{ fontSize:8, fontWeight:700, color:"#2a2a3a", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>{s.label}</div><div style={{ fontSize:16, fontWeight:900, fontFamily:"monospace", color:s.color, lineHeight:1 }}>{s.value}</div></div>
          ))}
        </div>

        {/* Win streak */}
        {trader.winStreak >= 3 && (<div style={{ marginTop:10, display:"flex", alignItems:"center", gap:5, fontSize:10, color:"#f59e0b", fontWeight:700 }}>
            {trader.winStreak >= 7 ? "" : ""} {trader.winStreak} win streak
          </div>
        )}
      </div></a>
  );
}

export default function BrowseTraders() {
  const [traders, setTraders]     = useState<Trader[]>([]);
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState("");
 const [sortBy, setSortBy] = useState<"winRate"|"trades"|"pnl">("trades");
  const [currentUser, setCurrentUser] = useState("");

  useEffect(() => {
    // Get current user
    try {
      const s = JSON.parse(localStorage.getItem("tradedesk_session_v1") ?? "{}");
      setCurrentUser(s.username ?? "");
    } catch {}

    loadTraders();
  }, []);

  const loadTraders = () => {
    setLoading(true);
    try {
      // Discover all users from localStorage accounts registry
      const accounts: Record<string, any> = JSON.parse(localStorage.getItem("tradedesk_accounts_v1") ?? "{}");
      const usernames = Object.keys(accounts);

      if (!usernames.length) {
        setLoading(false);
        return;
      }

      const result: Trader[] = [];

      for (const username of usernames) {
        try {
          const raw: any[] = JSON.parse(localStorage.getItem(`tradedesk_trades_${username}_v1`) ?? "[]");
          const trades = raw.filter(t => t.source !== "demo"); // skip demo trades for public stats

          // If only demo trades exist, use them anyway for new users
          const displayTrades = trades.length > 0 ? trades : raw;
          if (!displayTrades.length) {
            // Still show the user with zero stats
            result.push({
              username,
              totalTrades: 0,
              winRate: 0,
              totalPnl: 0,
              winStreak: 0,
              verifiedTrades: 0,
              rank: "Beginner",
              rankColor: "#6b7280",
              avatarColor: AVATAR_COLORS[username.charCodeAt(0) % AVATAR_COLORS.length],
            });
            continue;
          }

          const wins = displayTrades.filter((t: any) => (t.pnl ?? 0) > 0).length;
          const winRate = Math.round((wins / displayTrades.length) * 100);
          const totalPnl = displayTrades.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0);
          const verifiedTrades = displayTrades.filter((t: any) => t.source === "broker_import").length;

          // Win streak
          const sorted = [...displayTrades].sort((a: any, b: any) => b.date - a.date);
          let streak = 0;
          for (const t of sorted) {
            if ((t.pnl ?? 0) > 0) streak++;
            else break;
          }

          const rank = getRank(displayTrades.length, winRate);
          result.push({
            username,
            totalTrades: displayTrades.length,
            winRate,
            totalPnl: parseFloat(totalPnl.toFixed(2)),
            winStreak: streak,
            verifiedTrades,
            rank: rank.label,
            rankColor: rank.color,
            avatarColor: AVATAR_COLORS[username.charCodeAt(0) % AVATAR_COLORS.length],
          });
        } catch {}
      }

      setTraders(result);
    } catch {}
    setLoading(false);
  };

  const filtered = traders
    .filter(t => !search || t.username.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "winRate") return b.winRate - a.winRate;
      if (sortBy === "pnl")    return b.totalPnl - a.totalPnl;
      return b.totalTrades - a.totalTrades;
    });

  return (
    <div style={{ minHeight:"100vh", background:"#060d1a", color:"#c8d8f0", fontFamily:"system-ui,sans-serif" }}><style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Nav */}
      <div style={{ borderBottom:"1px solid #111118", background:"rgba(6,13,26,0.97)", padding:"14px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:10, backdropFilter:"blur(12px)" }}><a href="/dashboard" style={{ fontSize:12, color:"#2a2a3a", textDecoration:"none" }}>← Dashboard</a><div style={{ flex:1 }}/><a href="/leaderboard" style={{ padding:"6px 14px", borderRadius:8, border:"1px solid #2a2a3a", background:"#111118", color:"#6b7280", fontSize:11, fontWeight:600, textDecoration:"none" }}>Leaderboard</a></div><div style={{ maxWidth:1100, margin:"0 auto", padding:"28px 20px", animation:"fadeIn 0.4s ease" }}>

        {/* Header */}
        <div style={{ marginBottom:24 }}><h1 style={{ fontSize:24, fontWeight:900, color:"#ffffff", margin:"0 0 6px", letterSpacing:"-0.02em" }}>Browse Traders</h1><p style={{ fontSize:13, color:"#2a2a3a", margin:0 }}>
            {traders.length} trader{traders.length !== 1 ? "s" : ""} on Nexyru · Click any profile to view their stats
          </p></div>

        {/* Search + Sort */}
        <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}><div style={{ flex:1, minWidth:200, position:"relative" }}><span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:14, color:"#2a2a3a" }}></span><input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by username…"
              style={{ width:"100%", padding:"10px 12px 10px 36px", borderRadius:10, background:"#111118", border:"1px solid #2a2a3a", color:"#ffffff", fontSize:12, outline:"none", boxSizing:"border-box" }}
            /></div><div style={{ display:"flex", gap:6 }}>
            {([["trades","Most Trades"],["winRate","Win Rate"],["pnl","Top PnL"]] as const).map(([key, label]) =>(<button key={key} onClick={() => setSortBy(key)} style={{ padding:"9px 14px", borderRadius:9, border:`1px solid ${sortBy===key?"rgba(99,102,241,0.4)":"#2a2a3a"}`, background:sortBy===key?"rgba(99,102,241,0.08)":"#111118", color:sortBy===key?"#6366f1":"#6b7280", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                {label}
              </button>
            ))}
          </div></div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign:"center", padding:"60px", color:"#2a2a3a" }}><div style={{ display:"inline-block", width:24, height:24, border:"2px solid #2a2a3a", borderTopColor:"#6366f1", borderRadius:"50%", animation:"spin 0.7s linear infinite", marginBottom:12 }}/><div style={{ fontSize:13 }}>Finding traders…</div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>) : filtered.length === 0 ? (<div style={{ textAlign:"center", padding:"80px 20px", color:"#2a2a3a" }}><div style={{ fontSize:48, marginBottom:16 }}></div><div style={{ fontSize:16, fontWeight:700, color:"#6b7280", marginBottom:8 }}>
              {search ? `No traders matching "${search}"` : "No traders found"}
            </div><div style={{ fontSize:12 }}>
              {!search && "Traders appear here once they register and log trades"}
            </div></div>) : (<div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:14 }}>
            {filtered.map(t =>(<TraderCard key={t.username} trader={t} currentUser={currentUser}/>
            ))}
          </div>
        )}
      </div></div>
  );
}