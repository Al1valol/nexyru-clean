"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback } from "react";

const FILTERS = [
  { id:"all", label:"🌍 Global" },
  { id:"following", label:"👥 Following" },
  { id:"verified", label:"✅ Verified" },
  { id:"strategies", label:"📊 Strategies" },
  { id:"wins", label:"💰 Big Wins" },
];

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d/60000), h = Math.floor(d/3600000), dd = Math.floor(d/86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${dd}d ago`;
}

function getAC(u: string) {
  const C = ["#38bdf8","#a78bfa","#34d399","#f97316","#f59e0b","#f43f5e"];
  return C[(u?.charCodeAt(0)||0) % C.length];
}

export default function FeedPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef<any>(null);

  useEffect(() => {
    // Lazy-load supabase only on client
    import("@/lib/supabase-helpers").then(({ supabase, getGlobalFeed, getBigWinsFeed, getLikedPostIds, subscribeToFeed }) => {
      supabaseRef.current = { supabase, getGlobalFeed, getBigWinsFeed, getLikedPostIds, subscribeToFeed };
      loadFeed(filter, { supabase, getGlobalFeed, getBigWinsFeed, getLikedPostIds });
    });
  }, []);

  useEffect(() => {
    if (!supabaseRef.current) return;
    const { getGlobalFeed, getBigWinsFeed, getLikedPostIds, supabase } = supabaseRef.current;
    loadFeed(filter, { supabase, getGlobalFeed, getBigWinsFeed, getLikedPostIds });
  }, [filter]);

  const loadFeed = async (f: string, { supabase, getGlobalFeed, getBigWinsFeed, getLikedPostIds }: any) => {
    setLoading(true);
    try {
      let data: any[] = [];
      if (f === "wins") data = await getBigWinsFeed(200, 50);
      else {
        data = await getGlobalFeed(50);
        if (f === "verified") data = data.filter((p: any) => p.verified_trader);
        if (f === "strategies") data = data.filter((p: any) => !!p.setup_name);
        if (f === "following") {
          try {
            const u = JSON.parse(localStorage.getItem("tradedesk_session_v1") || "{}").username;
            if (u) {
              const { data: profile } = await supabase.from("profiles").select("id").eq("username", u).single();
              if (profile) {
                const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", profile.id);
                const ids = (follows || []).map((f: any) => f.following_id);
                data = data.filter((p: any) => ids.includes(p.user_id));
              }
            }
          } catch {}
        }
      }
      setPosts(data);
    } catch (e) {
      console.error(e);
      setPosts([]);
    }
    setLoading(false);
  };

  const handleLike = async (postId: string, liked: boolean) => {
    if (!supabaseRef.current) return;
    const { supabase, likePost, unlikePost } = supabaseRef.current as any;
    try {
      const u = JSON.parse(localStorage.getItem("tradedesk_session_v1") || "{}").username;
      if (!u) return;
      const { data: profile } = await supabase.from("profiles").select("id").eq("username", u).single();
      if (!profile) return;
      if (liked) {
        await unlikePost(profile.id, postId);
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, liked: false, likes_count: Math.max(0, p.likes_count - 1) } : p));
      } else {
        await likePost(profile.id, postId);
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, liked: true, likes_count: p.likes_count + 1 } : p));
      }
    } catch {}
  };

  const trending = Object.entries(
    posts.reduce((a: any, p: any) => { a[p.username] = (a[p.username] || 0) + 1; return a; }, {})
  ).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);

  return (
    <div style={{ minHeight: "100vh", background: "#060d1a", color: "#c8d8f0", fontFamily: "system-ui,sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes p2{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      <div style={{ borderBottom: "1px solid #0d1628", background: "rgba(6,13,26,0.97)", padding: "14px 24px", display: "flex", alignItems: "center", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(12px)" }}>
        <a href="/dashboard" style={{ fontSize: 12, color: "#3a4a6a", textDecoration: "none" }}>← Dashboard</a>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#34d399" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", display: "inline-block", animation: "p2 1.5s infinite" }} />
          Live
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px", display: "grid", gridTemplateColumns: "1fr 260px", gap: 24, alignItems: "start" }}>
        <div>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#f0f4ff", margin: "0 0 4px" }}>Social Feed</h1>
            <p style={{ fontSize: 13, color: "#3a4a6a", margin: 0 }}>{posts.length > 0 ? `${posts.length} trades shared` : "No trades shared yet"}</p>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${filter === f.id ? "rgba(56,189,248,0.4)" : "#1a2540"}`, background: filter === f.id ? "rgba(56,189,248,0.1)" : "#0b1120", color: filter === f.id ? "#38bdf8" : "#475569", fontSize: 12, fontWeight: filter === f.id ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#3a4a6a" }}>
              <div style={{ width: 24, height: 24, border: "2px solid #1a2540", borderTopColor: "#38bdf8", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
              Loading feed…
            </div>
          ) : posts.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", color: "#3a4a6a", border: "1px dashed #1a2540", borderRadius: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#475569", marginBottom: 8 }}>No trades shared yet</div>
              <div style={{ fontSize: 12 }}>Import trades and share them to appear here</div>
            </div>
          ) : posts.map((post: any) => {
            const pos = (post.pnl ?? 0) >= 0;
            const ac = getAC(post.username);
            return (
              <div key={post.id} style={{ borderRadius: 18, background: "#0b1120", border: "1px solid #1a2540", padding: "16px 20px", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <a href={`/trader/@${post.username}`} style={{ width: 40, height: 40, borderRadius: 12, background: ac + "22", border: `1.5px solid ${ac}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: ac, flexShrink: 0, textDecoration: "none" }}>
                    {post.username?.slice(0, 2).toUpperCase()}
                  </a>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <a href={`/trader/@${post.username}`} style={{ fontSize: 13, fontWeight: 800, color: "#f0f4ff", textDecoration: "none" }}>@{post.username}</a>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: post.side === "long" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", color: post.side === "long" ? "#34d399" : "#f87171" }}>
                        {post.side === "long" ? "▲ LONG" : "▼ SHORT"}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", fontFamily: "monospace" }}>{post.symbol}</span>
                    </div>
                    {post.pnl !== null && (
                      <div style={{ display: "inline-flex", padding: "6px 12px", borderRadius: 10, background: pos ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${pos ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`, marginBottom: 8 }}>
                        <span style={{ fontSize: 18, fontWeight: 900, color: pos ? "#34d399" : "#f87171", fontFamily: "monospace" }}>{pos ? "+" : ""}{(post.pnl ?? 0).toFixed(2)}</span>
                      </div>
                    )}
                    {post.notes && <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 8px", lineHeight: 1.6, fontStyle: "italic" }}>"{post.notes}"</p>}
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: "#2e3f5a" }}>{timeAgo(post.created_at)}</span>
                      <button onClick={() => handleLike(post.id, !!post.liked)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: post.liked ? "#f43f5e" : "#3a4a6a", padding: 0 }}>
                        {post.liked ? "❤️" : "🤍"} {post.likes_count}
                      </button>
                      <span style={{ fontSize: 11, color: "#2e3f5a" }}>💬 {post.comments_count}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ position: "sticky", top: 80 }}>
          <div style={{ background: "#0b1120", border: "1px solid #1a2540", borderRadius: 18, padding: "16px 18px", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#f0f4ff", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f97316", display: "inline-block" }} />
              Trending Traders
            </div>
            {trending.length === 0 ? <div style={{ fontSize: 11, color: "#2e3f5a" }}>No activity yet</div> : trending.map(([u, c]: any, i) => {
              const ac = getAC(u);
              return (
                <a key={u} href={`/trader/@${u}`} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, textDecoration: "none" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#2e3f5a", width: 16 }}>#{i + 1}</span>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: ac + "22", border: `1.5px solid ${ac}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: ac }}>{u.slice(0, 2).toUpperCase()}</div>
                  <div><div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>@{u}</div><div style={{ fontSize: 10, color: "#3a4a6a" }}>{c} posts</div></div>
                </a>
              );
            })}
          </div>
          <div style={{ padding: "12px 16px", borderRadius: 14, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399", display: "inline-block", animation: "p2 1.5s infinite" }} />
            <div><div style={{ fontSize: 11, fontWeight: 700, color: "#34d399" }}>Live Feed</div><div style={{ fontSize: 10, color: "#3a4a6a" }}>Real-time updates</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
