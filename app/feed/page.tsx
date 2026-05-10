"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────
interface FeedItem {
  id:         string;
  user_id:    string;
  type:       string;
  data:       Record<string, any>;
  created_at: string;
  likes?:     number;
  liked?:     boolean;
}

// ── Config ─────────────────────────────────────────────────────
const SUPABASE_URL  = "https://xsrcaceydyqytbipvrok.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcmNhY2V5ZHlxeXRiaXB2cm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDg0MjUsImV4cCI6MjA5MzUyNDQyNX0.IfIkjTtAAb0-iZLu8CE-3GgdNGKxSNJKczSAZlQV62A";

const FEED_TYPES: Record<string, { emoji:string; color:string; label:(d:any)=>string; big?:boolean }> = {
  trade_logged:       { emoji:"📝", color:"#38bdf8",  label: d=>`logged a ${d.type??""} on ${d.pair??""}` },
  big_win:            { emoji:"💰", color:"#34d399",  label: d=>`made +$${d.pnl?.toFixed(2)??""} on ${d.pair??""}`, big:true },
  win_streak:         { emoji:"🔥", color:"#f97316",  label: d=>`is on a ${d.streak}-win streak!`, big:true },
  challenge_passed:   { emoji:"🏆", color:"#f59e0b",  label: _=>`passed the funded challenge!`, big:true },
  challenge_started:  { emoji:"🎯", color:"#a78bfa",  label: _=>`started a funded challenge` },
  strategy_published: { emoji:"📊", color:"#818cf8",  label: d=>`published "${d.name??""}"` },
  signal_posted:      { emoji:"📡", color:"#34d399",  label: d=>`posted a ${d.direction??""} signal on ${d.pair??""}` },
  rank_up:            { emoji:"⬆️", color:"#22d3a5",  label: d=>`ranked up to ${d.rank??""}!`, big:true },
  verified:           { emoji:"✅", color:"#f59e0b",  label: _=>`is now a Verified Funded Trader!`, big:true },
  followed_trader:    { emoji:"👥", color:"#38bdf8",  label: d=>`followed @${d.trader??""}` },
  copy_trader:        { emoji:"📋", color:"#a78bfa",  label: d=>`started copying @${d.trader??""}` },
  weekly_complete:    { emoji:"⚡", color:"#fbbf24",  label: _=>`completed all weekly challenges!` },
};

const FILTERS = [
  { id:"all",       label:"🌍 Global" },
  { id:"following", label:"👥 Following" },
  { id:"verified",  label:"✅ Verified" },
  { id:"strategies",label:"📊 Strategies" },
  { id:"wins",      label:"💰 Big Wins" },
];

// ── Utils ──────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

function getAvatarColor(username: string) {
  const COLORS = ["#38bdf8","#a78bfa","#34d399","#f97316","#f59e0b","#f43f5e","#22d3ee"];
  return COLORS[(username?.charCodeAt(0) ?? 0) % COLORS.length];
}

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem("tradedesk_session_v1") ?? "{}"); }
  catch { return {}; }
}

// ── Generate local feed from localStorage trades ───────────────
function generateLocalFeed(): FeedItem[] {
  const items: FeedItem[] = [];
  try {
    const accounts: Record<string,any> = JSON.parse(localStorage.getItem("tradedesk_accounts_v1") ?? "{}");
    for (const username of Object.keys(accounts)) {
      const trades: any[] = JSON.parse(localStorage.getItem(`tradedesk_trades_${username}_v1`) ?? "[]");
      const realTrades = trades.filter(t => t.source !== "demo");
      
      // Big wins
      realTrades.filter(t => (t.pnl??0) > 50).forEach(t => {
        items.push({ id:`bw_${t.id}`, user_id:username, type:"big_win", data:{ pair:t.pair, pnl:t.pnl, type:t.type }, created_at: new Date(t.date).toISOString(), likes: 0 });
      });

      // Win streaks
      let streak = 0, maxStreak = 0;
      [...realTrades].sort((a,b)=>a.date-b.date).forEach(t => {
        if((t.pnl??0)>0){streak++;if(streak>maxStreak){maxStreak=streak;}}else streak=0;
      });
      if (maxStreak >= 3) {
        items.push({ id:`ws_${username}`, user_id:username, type:"win_streak", data:{ streak:maxStreak }, created_at: new Date(Date.now()).toISOString(), likes: 0 });
      }
    }
  } catch {}
  return items.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// ── Feed Card ──────────────────────────────────────────────────
function FeedCard({ item, onLike, isNew }: { item: FeedItem; onLike: (id:string)=>void; isNew?: boolean }) {
  const cfg = FEED_TYPES[item.type] ?? { emoji:"📌", color:"#64748b", label:()=>"posted an update" };
  const ac  = getAvatarColor(item.user_id);

  return (
    <div style={{ borderRadius:18, background:item.liked?"#0d1a2d":"#0b1120", border:`1px solid ${isNew?"rgba(56,189,248,0.4)":cfg.big?"rgba("+hexToRgb(cfg.color)+",0.2)":"#1a2540"}`, padding:"16px 20px", transition:"all 0.3s", position:"relative", overflow:"hidden", animation:isNew?"slideIn 0.4s ease":"none" }}>
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

      {/* Glow for big events */}
      {cfg.big && <div style={{ position:"absolute", top:0, right:0, width:120, height:120, borderRadius:"50%", background:`${cfg.color}08`, pointerEvents:"none" }}/>}

      {/* Live indicator for new items */}
      {isNew && <div style={{ position:"absolute", top:12, right:12, display:"flex", alignItems:"center", gap:4, fontSize:9, fontWeight:700, color:"#38bdf8" }}>
        <span style={{ width:6, height:6, borderRadius:"50%", background:"#38bdf8", display:"inline-block", animation:"pulse 1s ease-in-out infinite" }}/>
        LIVE
      </div>}

      <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
        {/* Avatar */}
        <div style={{ width:40, height:40, borderRadius:12, background:`${ac}22`, border:`1.5px solid ${ac}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:900, color:ac, flexShrink:0 }}>
          {item.user_id.slice(0,2).toUpperCase()}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
            <a href={`/trader/@${item.user_id}`} style={{ fontSize:13, fontWeight:800, color:"#f0f4ff", textDecoration:"none" }}>@{item.user_id}</a>
            <span style={{ fontSize:12, color:"#475569" }}>{cfg.label(item.data)}</span>
            {cfg.big && <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10, background:`${cfg.color}15`, color:cfg.color }}>{cfg.emoji}</span>}
          </div>

          {/* Extra data for big wins */}
          {item.type === "big_win" && item.data.pnl && (
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 12px", borderRadius:10, background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.2)", marginBottom:8 }}>
              <span style={{ fontSize:18, fontWeight:900, color:"#34d399", fontFamily:"monospace" }}>+${item.data.pnl.toFixed(2)}</span>
              <span style={{ fontSize:11, color:"#3a4a6a" }}>{item.data.pair} · {item.data.type}</span>
            </div>
          )}

          {item.type === "win_streak" && (
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:10, background:"rgba(249,115,22,0.08)", border:"1px solid rgba(249,115,22,0.2)", marginBottom:8 }}>
              <span style={{ fontSize:20 }}>{"🔥".repeat(Math.min(item.data.streak, 5))}</span>
              <span style={{ fontSize:14, fontWeight:900, color:"#f97316", fontFamily:"monospace" }}>{item.data.streak} wins in a row</span>
            </div>
          )}

          {item.type === "strategy_published" && item.data.name && (
            <div style={{ padding:"8px 12px", borderRadius:10, background:"rgba(129,140,248,0.08)", border:"1px solid rgba(129,140,248,0.2)", marginBottom:8, fontSize:12, color:"#818cf8", fontWeight:600 }}>
              📊 {item.data.name}
              {item.data.return_pct && <span style={{ marginLeft:8, color:"#34d399" }}>+{item.data.return_pct}%</span>}
            </div>
          )}

          {/* Footer */}
          <div style={{ display:"flex", alignItems:"center", gap:16, marginTop:8 }}>
            <span style={{ fontSize:11, color:"#2e3f5a" }}>{timeAgo(item.created_at)}</span>
            <button onClick={() => onLike(item.id)} style={{ display:"flex", alignItems:"center", gap:4, background:"none", border:"none", cursor:"pointer", fontSize:11, color:item.liked?"#f43f5e":"#3a4a6a", fontWeight:item.liked?700:400, padding:0 }}>
              {item.liked?"❤️":"🤍"} {(item.likes??0) + (item.liked?1:0)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

// ── Trending Sidebar ───────────────────────────────────────────
function TrendingSidebar({ feed }: { feed: FeedItem[] }) {
  const traders = Object.entries(
    feed.reduce((acc, item) => {
      acc[item.user_id] = (acc[item.user_id] || 0) + 1;
      return acc;
    }, {} as Record<string,number>)
  ).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const hotStrats = feed.filter(f => f.type === "strategy_published").slice(0,3);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Trending Traders */}
      <div style={{ background:"#0b1120", border:"1px solid #1a2540", borderRadius:18, padding:"16px 18px" }}>
        <div style={{ fontSize:12, fontWeight:800, color:"#f0f4ff", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:"#f97316", display:"inline-block" }}/>
          Trending Traders
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {traders.map(([username, count], i) => {
            const ac = getAvatarColor(username);
            return (
              <a key={username} href={`/trader/@${username}`} style={{ display:"flex", alignItems:"center", gap:10, textDecoration:"none" }}>
                <span style={{ fontSize:11, fontWeight:700, color:"#2e3f5a", width:16 }}>#{i+1}</span>
                <div style={{ width:32, height:32, borderRadius:10, background:`${ac}22`, border:`1.5px solid ${ac}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900, color:ac }}>
                  {username.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#e2e8f0" }}>@{username}</div>
                  <div style={{ fontSize:10, color:"#3a4a6a" }}>{count} activit{count===1?"y":"ies"}</div>
                </div>
              </a>
            );
          })}
          {traders.length === 0 && <div style={{ fontSize:11, color:"#2e3f5a" }}>No activity yet</div>}
        </div>
      </div>

      {/* Hot Strategies */}
      {hotStrats.length > 0 && (
        <div style={{ background:"#0b1120", border:"1px solid #1a2540", borderRadius:18, padding:"16px 18px" }}>
          <div style={{ fontSize:12, fontWeight:800, color:"#f0f4ff", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:"#818cf8", display:"inline-block" }}/>
            Hot Strategies
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {hotStrats.map(item => (
              <a key={item.id} href="/leaderboard" style={{ textDecoration:"none" }}>
                <div style={{ padding:"10px 12px", borderRadius:12, background:"rgba(129,140,248,0.06)", border:"1px solid rgba(129,140,248,0.15)" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#818cf8", marginBottom:2 }}>{item.data.name}</div>
                  <div style={{ fontSize:10, color:"#3a4a6a" }}>by @{item.user_id}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Live indicator */}
      <div style={{ padding:"12px 16px", borderRadius:14, background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.15)", display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ width:8, height:8, borderRadius:"50%", background:"#34d399", display:"inline-block", animation:"pulse 1.5s ease-in-out infinite" }}/>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:"#34d399" }}>Live Feed</div>
          <div style={{ fontSize:10, color:"#3a4a6a" }}>Updates every 30s</div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function FeedPage() {
  const [feed,      setFeed]      = useState<FeedItem[]>([]);
  const [filter,    setFilter]    = useState("all");
  const [loading,   setLoading]   = useState(true);
  const [newItems,  setNewItems]  = useState<Set<string>>(new Set());
  const [liked,     setLiked]     = useState<Set<string>>(new Set());
  const [page,      setPage]      = useState(0);
  const [hasMore,   setHasMore]   = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const currentUser = getCurrentUser();
  const PAGE_SIZE   = 20;

  const fetchFeed = useCallback(async (reset = false) => {
    const offset = reset ? 0 : page * PAGE_SIZE;
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), order:"created_at.desc" });
      
      // Add filter
      if (filter === "wins")       params.set("type", "eq.big_win");
      if (filter === "strategies") params.set("type", "eq.strategy_published");
      if (filter === "verified")   params.set("type", "eq.verified");

      const res = await fetch(`${SUPABASE_URL}/rest/v1/activity_feed?${params}`, {
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }
      });
      
      let data: FeedItem[] = res.ok ? await res.json() : [];
      if (!Array.isArray(data)) data = [];

      // Merge with local feed
      const localFeed = generateLocalFeed();
      const allFeed = reset 
        ? [...localFeed, ...data].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        : [...data];

      const paginated = reset ? allFeed.slice(0, PAGE_SIZE) : allFeed;
      
      setFeed(prev => reset ? paginated : [...prev, ...paginated]);
      setHasMore(paginated.length === PAGE_SIZE);
      if (!reset) setPage(p => p + 1);
    } catch {
      // Fall back to local feed only
      const localFeed = generateLocalFeed();
      setFeed(localFeed);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    setPage(0);
    setFeed([]);
    fetchFeed(true);
  }, [filter]);

  // Realtime polling
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/activity_feed?limit=5&order=created_at.desc`, {
          headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }
        });
        if (!res.ok) return;
        const fresh: FeedItem[] = await res.json();
        if (!Array.isArray(fresh)) return;
        setFeed(prev => {
          const existingIds = new Set(prev.map(f => f.id));
          const newOnes = fresh.filter(f => !existingIds.has(f.id));
          if (newOnes.length === 0) return prev;
          setNewItems(s => new Set([...s, ...newOnes.map(n => n.id)]));
          setTimeout(() => setNewItems(s => { const n = new Set(s); newOnes.forEach(i => n.delete(i.id)); return n; }), 5000);
          return [...newOnes, ...prev];
        });
      } catch {}
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Infinite scroll
  useEffect(() => {
    if (!bottomRef.current) return;
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        fetchFeed(false);
      }
    }, { threshold: 0.1 });
    observerRef.current.observe(bottomRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, fetchFeed]);

  const handleLike = (id: string) => {
    setLiked(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const filtered = feed.filter(item => {
    if (filter === "all") return true;
    if (filter === "wins") return item.type === "big_win" || item.type === "win_streak";
    if (filter === "strategies") return item.type === "strategy_published";
    if (filter === "verified") return item.type === "verified" || item.type === "rank_up";
    if (filter === "following") {
      try {
        const follows: any[] = JSON.parse(localStorage.getItem(`nexyru_following_${currentUser.username}`) ?? "[]");
        return follows.includes(item.user_id);
      } catch { return false; }
    }
    return true;
  });

  return (
    <div style={{ minHeight:"100vh", background:"#060d1a", color:"#c8d8f0", fontFamily:"system-ui,sans-serif" }}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes slideIn{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Nav */}
      <div style={{ borderBottom:"1px solid #0d1628", background:"rgba(6,13,26,0.97)", padding:"14px 24px", display:"flex", alignItems:"center", gap:14, position:"sticky", top:0, zIndex:10, backdropFilter:"blur(12px)" }}>
        <a href="/dashboard" style={{ fontSize:12, color:"#3a4a6a", textDecoration:"none" }}>← Dashboard</a>
        <div style={{ flex:1 }}/>
        {/* Live pulse */}
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#34d399" }}>
          <span style={{ width:7, height:7, borderRadius:"50%", background:"#34d399", display:"inline-block", animation:"pulse 1.5s ease-in-out infinite" }}/>
          Live
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"24px 20px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:24, alignItems:"start" }}>
          
          {/* Main feed */}
          <div>
            {/* Header */}
            <div style={{ marginBottom:20 }}>
              <h1 style={{ fontSize:22, fontWeight:900, color:"#f0f4ff", margin:"0 0 4px", letterSpacing:"-0.02em" }}>
                Social Feed
              </h1>
              <p style={{ fontSize:13, color:"#3a4a6a", margin:0 }}>See what traders are doing right now</p>
            </div>

            {/* Filters */}
            <div style={{ display:"flex", gap:8, marginBottom:20, overflowX:"auto", paddingBottom:4 }}>
              {FILTERS.map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding:"7px 14px", borderRadius:20, border:`1px solid ${filter===f.id?"rgba(56,189,248,0.4)":"#1a2540"}`, background:filter===f.id?"rgba(56,189,248,0.1)":"#0b1120", color:filter===f.id?"#38bdf8":"#475569", fontSize:12, fontWeight:filter===f.id?700:500, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Feed */}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {loading && feed.length === 0 ? (
                Array.from({length:5}).map((_,i) => (
                  <div key={i} style={{ height:80, borderRadius:18, background:"linear-gradient(90deg,#0b1120,#111d30,#0b1120)", backgroundSize:"200% 100%", animation:"shimmer 1.5s infinite", border:"1px solid #1a2540" }}>
                    <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <div style={{ padding:"60px", textAlign:"center", color:"#3a4a6a", border:"1px dashed #1a2540", borderRadius:20 }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>📭</div>
                  <div style={{ fontSize:15, fontWeight:700, color:"#475569", marginBottom:8 }}>Nothing here yet</div>
                  <div style={{ fontSize:12 }}>
                    {filter === "following" ? "Follow some traders to see their activity" : "Be the first to log a trade!"}
                  </div>
                </div>
              ) : (
                filtered.map(item => (
                  <FeedCard
                    key={item.id}
                    item={{ ...item, liked: liked.has(item.id) }}
                    onLike={handleLike}
                    isNew={newItems.has(item.id)}
                  />
                ))
              )}

              {/* Infinite scroll trigger */}
              <div ref={bottomRef} style={{ height:40, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {loading && feed.length > 0 && (
                  <div style={{ width:20, height:20, border:"2px solid #1a2540", borderTopColor:"#38bdf8", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}>
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  </div>
                )}
                {!hasMore && feed.length > 0 && <span style={{ fontSize:11, color:"#1e2f4a" }}>You're all caught up</span>}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ position:"sticky", top:80 }}>
            <TrendingSidebar feed={filtered}/>
          </div>
        </div>
      </div>
    </div>
  );
}