"use client";

import { useState, useEffect, useCallback } from "react";

interface FeedItem {
  id:         string;
  user_id:    string;
  type:       string;
  data:       Record<string, any>;
  created_at: string;
}

const FEED_TYPES: Record<string, { emoji: string; color: string; label: (d: Record<string,any>) => string }> = {
  trade_logged:      { emoji:"📝", color:"#38bdf8", label: d => `logged a ${d.type ?? ""} trade on ${d.pair ?? ""}` },
  win_streak:        { emoji:"🔥", color:"#f97316", label: d => `hit a ${d.streak}-win streak` },
  challenge_passed:  { emoji:"🏆", color:"#f59e0b", label: d => `passed the funded challenge!` },
  challenge_started: { emoji:"🎯", color:"#a78bfa", label: d => `started a funded challenge` },
  strategy_published:{ emoji:"📊", color:"#818cf8", label: d => `published strategy "${d.name ?? ""}"` },
  signal_posted:     { emoji:"📡", color:"#34d399", label: d => `posted a ${d.direction ?? ""} signal on ${d.pair ?? ""}` },
  rank_up:           { emoji:"⬆️", color:"#22d3a5", label: d => `ranked up to ${d.rank ?? ""}!` },
  weekly_complete:   { emoji:"⚡", color:"#fbbf24", label: d => `completed all weekly challenges!` },
  trade_shared:      { emoji:"🔗", color:"#38bdf8", label: d => `shared a trade — ${d.pair ?? ""} ${d.pnl >= 0 ? "+" : ""}${d.pnl?.toFixed(2) ?? ""}` },
};

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

function getUser() {
  try { return JSON.parse(localStorage.getItem("tradedesk_session_v1") ?? "{}"); }
  catch { return {}; }
}

const AVATAR_COLORS = ["#38bdf8","#a78bfa","#34d399","#f97316","#f59e0b"];

function FeedCard({ item }: { item: FeedItem }) {
  const def        = FEED_TYPES[item.type] ?? { emoji:"📌", color:"#64748b", label: () => item.type };
  const avatarColor = AVATAR_COLORS[item.user_id.charCodeAt(0) % AVATAR_COLORS.length];
  const isStreak   = item.type === "win_streak";
  const isRankUp   = item.type === "rank_up";
  const isChallenge= item.type === "challenge_passed";

  return (
    <div style={{
      background: isStreak || isRankUp || isChallenge ? `${def.color}06` : "#0b1120",
      border: `1px solid ${isStreak || isRankUp || isChallenge ? def.color + "30" : "#1a2540"}`,
      borderRadius: 14,
      padding: "14px 16px",
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      transition: "border-color 0.2s",
    }}>
      {/* Avatar */}
      <a href={`/trader/@${item.user_id}`} style={{ width:38, height:38, borderRadius:11, background:`${avatarColor}22`, border:`1px solid ${avatarColor}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:900, color:avatarColor, flexShrink:0, fontFamily:"monospace", textDecoration:"none" }}>
        {item.user_id.slice(0,2).toUpperCase()}
      </a>

      {/* Content */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
          <span style={{ fontSize:16 }}>{def.emoji}</span>
          <span style={{ fontSize:13, color:"#f0f4ff" }}>
            <a href={`/trader/@${item.user_id}`} style={{ fontWeight:800, color:"#f0f4ff", textDecoration:"none" }}>@{item.user_id}</a>
            {" "}
            <span style={{ color:"#64748b" }}>{def.label(item.data)}</span>
          </span>
        </div>

        {/* Extra detail for certain types */}
        {item.type === "signal_posted" && item.data.entry && (
          <div style={{ marginTop:8, display:"flex", gap:8, flexWrap:"wrap" }}>
            <span style={{ fontSize:10, padding:"2px 8px", borderRadius:8, background:`${item.data.direction==="long"?"rgba(52,211,153,0.1)":"rgba(248,113,113,0.1)"}`, color:item.data.direction==="long"?"#34d399":"#f87171", fontWeight:700 }}>
              {item.data.direction === "long" ? "▲ Long" : "▼ Short"} {item.data.pair}
            </span>
            <span style={{ fontSize:10, color:"#3a4a6a" }}>Entry: {item.data.entry}</span>
            {item.data.stop_loss  && <span style={{ fontSize:10, color:"#f87171" }}>SL: {item.data.stop_loss}</span>}
            {item.data.take_profit && <span style={{ fontSize:10, color:"#34d399" }}>TP: {item.data.take_profit}</span>}
            <a href="/signals" style={{ fontSize:10, color:"#38bdf8", textDecoration:"none", fontWeight:700 }}>View Signal →</a>
          </div>
        )}

        {item.type === "trade_shared" && (
          <div style={{ marginTop:8, padding:"8px 10px", borderRadius:9, background:"#0d1628", border:"1px solid #1a2540", fontSize:11, color:"#64748b" }}>
            {item.data.pair} · {item.data.type} · PnL: <span style={{ color:item.data.pnl>=0?"#34d399":"#f87171", fontWeight:700 }}>{item.data.pnl>=0?"+":""}{item.data.pnl?.toFixed(4)}</span>
            {item.data.notes && <span style={{ marginLeft:8 }}>"{item.data.notes}"</span>}
          </div>
        )}

        {item.type === "rank_up" && (
          <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:11, fontWeight:700, padding:"2px 9px", borderRadius:10, background:`${def.color}15`, border:`1px solid ${def.color}30`, color:def.color }}>
              {item.data.rank}
            </span>
          </div>
        )}
      </div>

      <div style={{ fontSize:10, color:"#2e3f5a", whiteSpace:"nowrap", flexShrink:0, marginTop:2 }}>{timeAgo(item.created_at)}</div>
    </div>
  );
}

// ── Share Trade Modal ──────────────────────────────────────────
function ShareModal({ onClose, onShare }: { onClose: () => void; onShare: (notes: string) => Promise<void> }) {
  const [notes,   setNotes]   = useState("");
  const [sharing, setSharing] = useState(false);

  const user   = getUser();
  const trades: any[] = (() => {
    try { return JSON.parse(localStorage.getItem(`tradedesk_trades_${user.username}_v1`) ?? "[]"); } catch { return []; }
  })();
  const [selected, setSelected] = useState<any>(trades[0] ?? null);

  const submit = async () => {
    if (!selected) return;
    setSharing(true);
    await onShare(notes);
    setSharing(false);
    onClose();
  };

  const inp: React.CSSProperties = { width:"100%", padding:"9px 12px", borderRadius:9, border:"1px solid #1a2540", background:"#0d1628", color:"#f0f4ff", fontSize:13, outline:"none", boxSizing:"border-box" };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(6px)" }}/>
      <div style={{ position:"relative", zIndex:10, background:"#0d1628", border:"1px solid #1e2f4a", borderRadius:20, padding:28, width:"100%", maxWidth:400, boxShadow:"0 30px 80px rgba(0,0,0,0.8)" }}>
        <div style={{ fontSize:16, fontWeight:800, color:"#f0f4ff", marginBottom:4 }}>🔗 Share a Trade</div>
        <div style={{ fontSize:11, color:"#3a4a6a", marginBottom:20 }}>Share a trade from your journal to the activity feed</div>

        {trades.length === 0 ? (
          <div style={{ textAlign:"center", padding:"24px", color:"#3a4a6a", fontSize:12 }}>No trades logged yet</div>
        ) : (
          <>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:10, fontWeight:700, color:"#4a5a7a", textTransform:"uppercase" as const, letterSpacing:"0.08em", display:"block", marginBottom:5 }}>Select Trade</label>
              <select value={selected?.id ?? ""} onChange={e => setSelected(trades.find((t:any) => t.id === e.target.value))} style={{ ...inp, cursor:"pointer" }}>
                {trades.slice(0,20).map((t:any) => (
                  <option key={t.id} value={t.id}>
                    {t.pair} · {t.type} · {t.pnl >= 0 ? "+" : ""}{t.pnl?.toFixed(4)} · {new Date(t.date).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            {selected && (
              <div style={{ padding:"10px 12px", borderRadius:10, background:"#111d30", border:"1px solid #1a2540", marginBottom:14, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:9, color:"#3a4a6a", marginBottom:2 }}>PAIR</div>
                  <div style={{ fontSize:12, fontWeight:700, color:"#f0f4ff", fontFamily:"monospace" }}>{selected.pair}</div>
                </div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:9, color:"#3a4a6a", marginBottom:2 }}>TYPE</div>
                  <div style={{ fontSize:12, fontWeight:700, color:selected.type==="long"?"#34d399":"#f87171" }}>{selected.type}</div>
                </div>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:9, color:"#3a4a6a", marginBottom:2 }}>PNL</div>
                  <div style={{ fontSize:12, fontWeight:700, color:selected.pnl>=0?"#34d399":"#f87171", fontFamily:"monospace" }}>{selected.pnl>=0?"+":""}{selected.pnl?.toFixed(4)}</div>
                </div>
              </div>
            )}

            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:10, fontWeight:700, color:"#4a5a7a", textTransform:"uppercase" as const, letterSpacing:"0.08em", display:"block", marginBottom:5 }}>Add a note (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="What was your thinking on this trade?" rows={3} style={{ ...inp, resize:"vertical", fontFamily:"system-ui", fontSize:12 }}/>
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={onClose} style={{ flex:1, padding:10, borderRadius:10, border:"1px solid #1e2f4a", background:"transparent", color:"#4a5a7a", fontSize:13, fontWeight:600, cursor:"pointer" }}>Cancel</button>
              <button onClick={submit} disabled={sharing || !selected} style={{ flex:2, padding:10, borderRadius:10, border:"none", background:"linear-gradient(135deg,#0369a1,#38bdf8)", color:"#fff", fontSize:13, fontWeight:800, cursor:sharing?"not-allowed":"pointer" }}>
                {sharing ? "Sharing…" : "🔗 Share Trade"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function ActivityFeedPage() {
  const [feed,        setFeed]        = useState<FeedItem[]>([]);
  const [following,   setFollowing]   = useState<string[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showShare,   setShowShare]   = useState(false);
  const [filter,      setFilter]      = useState("all");
  const [userId,      setUserId]      = useState("");
  const [error,       setError]       = useState("");

  useEffect(() => {
    const user = getUser();
    setUserId(user.username ?? "");
    loadFeed();
    // Load who this user follows
    if (user.username) {
      fetch(`/api/trader-follows?follower_id=${user.username}`)
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setFollowing(d.map((f:any) => f.trader_id)); })
        .catch(() => {});
    }
  }, []);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/activity?limit=50");
      const data = await res.json();
      if (Array.isArray(data)) setFeed(data);
      else setError("Could not load feed");
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  const shareTrade = async (notes: string) => {
    const user   = getUser();
    const trades: any[] = (() => {
      try { return JSON.parse(localStorage.getItem(`tradedesk_trades_${user.username}_v1`) ?? "[]"); } catch { return []; }
    })();
    const trade = trades[0];
    if (!trade) return;

    await fetch("/api/activity", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        user_id: userId, type: "trade_shared",
        data: { pair: trade.pair, type: trade.type, pnl: trade.pnl, notes },
      }),
    });
    await loadFeed();
  };

  const FILTER_TYPES: Record<string, string[]> = {
    all:        [],
    following:  [],
    trades:     ["trade_logged", "trade_shared"],
    milestones: ["win_streak", "rank_up", "challenge_passed", "weekly_complete"],
    signals:    ["signal_posted"],
    strategies: ["strategy_published"],
  };

  const filtered = feed.filter(f => {
    if (filter === "following") return following.includes(f.user_id);
    if (filter !== "all" && FILTER_TYPES[filter]?.length) return FILTER_TYPES[filter].includes(f.type);
    return true;
  });

  return (
    <div style={{ minHeight:"100vh", background:"#060d1a", color:"#c8d8f0", fontFamily:"system-ui,sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Nav */}
      <div style={{ borderBottom:"1px solid #0d1628", background:"rgba(6,13,26,0.95)", padding:"14px 28px", display:"flex", alignItems:"center", gap:16, position:"sticky", top:0, zIndex:10, backdropFilter:"blur(8px)" }}>
        <a href="/dashboard" style={{ fontSize:12, color:"#3a4a6a", textDecoration:"none" }}>← Dashboard</a>
        <span style={{ fontSize:14, fontWeight:800, color:"#f0f4ff" }}>🌐 Activity Feed</span>
        <div style={{ flex:1 }}/>
        <button onClick={() => loadFeed()} style={{ padding:"5px 11px", borderRadius:8, border:"1px solid #1a2540", background:"#0b1120", color:"#4a5a7a", fontSize:11, fontWeight:600, cursor:"pointer" }}>🔄</button>
        <button onClick={() => setShowShare(true)} style={{ padding:"7px 16px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#0369a1,#38bdf8)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
          🔗 Share Trade
        </button>
      </div>

      <div style={{ maxWidth:700, margin:"0 auto", padding:"28px 20px" }}>

        {/* Header */}
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontSize:24, fontWeight:900, color:"#f0f4ff", margin:"0 0 6px", letterSpacing:"-0.02em" }}>Activity Feed</h1>
          <p style={{ fontSize:13, color:"#3a4a6a", margin:0 }}>See what traders on Nexyru are doing right now</p>
        </div>

        {/* Filter pills */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:20 }}>
          {[
            { key:"all",        label:"All" },
            { key:"following",  label:`👥 Following${following.length > 0 ? ` (${following.length})` : ""}` },
            { key:"milestones", label:"🏆 Milestones" },
            { key:"signals",    label:"📡 Signals" },
            { key:"strategies", label:"📊 Strategies" },
            { key:"trades",     label:"📝 Trades" },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding:"5px 14px", borderRadius:20, border:`1px solid ${filter===f.key?"#38bdf8":"#1a2540"}`, background:filter===f.key?"rgba(56,189,248,0.1)":"transparent", color:filter===f.key?"#38bdf8":"#4a5a7a", fontSize:11, fontWeight:700, cursor:"pointer" }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && <div style={{ padding:"12px 16px", borderRadius:10, background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", color:"#f87171", fontSize:12, marginBottom:16 }}>⚠ {error}</div>}

        {/* Loading */}
        {loading && (
          <div style={{ display:"flex", justifyContent:"center", padding:"48px 0", gap:10, color:"#3a4a6a", fontSize:13 }}>
            <span style={{ display:"inline-block", width:16, height:16, border:"2px solid #1a2540", borderTopColor:"#38bdf8", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
            Loading feed…
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🌐</div>
            <div style={{ fontSize:15, fontWeight:700, color:"#f0f4ff", marginBottom:6 }}>Nothing here yet</div>
            <div style={{ fontSize:12, color:"#3a4a6a", marginBottom:20 }}>Activity from traders on Nexyru will appear here.<br/>Log trades, post signals, and pass challenges to generate activity.</div>
          </div>
        )}

        {/* Feed */}
        {!loading && filtered.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {filtered.map(item => <FeedCard key={item.id} item={item}/>)}
          </div>
        )}
      </div>

      {showShare && <ShareModal onClose={() => setShowShare(false)} onShare={shareTrade}/>}
    </div>
  );
}