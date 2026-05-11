"use client";
// @ts-nocheck
export const dynamic = "force-dynamic";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  getGlobalFeed, getFollowingFeed, getBigWinsFeed,
  likePost, unlikePost, getLikedPostIds,
  subscribeToFeed, supabase
} from "@/lib/supabase-helpers";
import type { FeedPost } from "@/lib/supabase-types";

const FILTERS = [
  { id:"all",       label:"🌍 Global" },
  { id:"following", label:"👥 Following" },
  { id:"verified",  label:"✅ Verified" },
  { id:"strategies",label:"📊 Strategies" },
  { id:"wins",      label:"💰 Big Wins" },
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
  const COLORS = ["#38bdf8","#a78bfa","#34d399","#f97316","#f59e0b","#f43f5e"];
  return COLORS[(u?.charCodeAt(0) || 0) % COLORS.length];
}

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem("tradedesk_session_v1") || "{}"); }
  catch { return {}; }
}

function FeedCard({ post, onLike, isNew }: { post: FeedPost & { liked?: boolean }; onLike: (id: string, liked: boolean) => void; isNew?: boolean }) {
  const pos = (post.pnl ?? 0) >= 0;
  const ac = getAC(post.username);

  return (
    <div style={{ borderRadius: 18, background: "#0b1120", border: `1px solid ${isNew ? "rgba(56,189,248,0.5)" : (post.pnl ?? 0) > 500 ? "rgba(52,211,153,0.2)" : "#1a2540"}`, padding: "16px 20px", position: "relative", overflow: "hidden", marginBottom: 12, transition: "border-color 0.3s" }}>
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse2{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {isNew && (
        <div style={{ position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 700, color: "#38bdf8" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#38bdf8", display: "inline-block", animation: "pulse2 1s infinite" }}/>
          LIVE
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <a href={`/trader/@${post.username}`} style={{ textDecoration: "none", flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${ac}22`, border: `1.5px solid ${ac}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: ac, position: "relative" }}>
            {post.username.slice(0, 2).toUpperCase()}
            {post.verified_trader && (
              <div style={{ position: "absolute", bottom: -3, right: -3, width: 14, height: 14, borderRadius: "50%", background: "#f59e0b", border: "1.5px solid #060d1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 900, color: "#000" }}>✓</div>
            )}
          </div>
        </a>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <a href={`/trader/@${post.username}`} style={{ fontSize: 13, fontWeight: 800, color: "#f0f4ff", textDecoration: "none" }}>@{post.username}</a>
            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: post.side === "long" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", color: post.side === "long" ? "#34d399" : "#f87171" }}>
              {post.side === "long" ? "▲ LONG" : "▼ SHORT"}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", fontFamily: "monospace" }}>{post.symbol}</span>
            {post.setup_name && <span style={{ fontSize: 10, color: "#475569" }}>{post.setup_name}</span>}
          </div>

          {post.pnl !== null && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 10, background: pos ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${pos ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`, marginBottom: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: pos ? "#34d399" : "#f87171", fontFamily: "monospace" }}>
                {pos ? "+" : ""}{(post.pnl ?? 0).toFixed(2)}
              </span>
              {post.contracts && <span style={{ fontSize: 11, color: "#3a4a6a" }}>{post.contracts} contracts</span>}
            </div>
          )}

          {post.notes && (
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 8px", lineHeight: 1.6, fontStyle: "italic" }}>"{post.notes}"</p>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: "#2e3f5a" }}>{timeAgo(post.created_at)}</span>
            <button
              onClick={() => onLike(post.id, !!post.liked)}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: post.liked ? "#f43f5e" : "#3a4a6a", fontWeight: post.liked ? 700 : 400, padding: 0 }}
            >
              {post.liked ? "❤️" : "🤍"} {post.likes_count + (post.liked ? 0 : 0)}
            </button>
            <span style={{ fontSize: 11, color: "#2e3f5a" }}>💬 {post.comments_count}</span>
            {post.status === "open" && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "rgba(56,189,248,0.1)", color: "#38bdf8" }}>OPEN</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendingSidebar({ posts }: { posts: FeedPost[] }) {
  const traders = Object.entries(
    posts.reduce((acc, p) => { acc[p.username] = (acc[p.username] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const bigWins = [...posts].filter(p => (p.pnl ?? 0) > 200).sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0)).slice(0, 3);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: "#0b1120", border: "1px solid #1a2540", borderRadius: 18, padding: "16px 18px" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#f0f4ff", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f97316", display: "inline-block" }}/>
          Trending Traders
        </div>
        {traders.length === 0 ? (
          <div style={{ fontSize: 11, color: "#2e3f5a" }}>No activity yet</div>
        ) : traders.map(([u, c], i) => {
          const ac = getAC(u);
          return (
            <a key={u} href={`/trader/@${u}`} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#2e3f5a", width: 16 }}>#{i + 1}</span>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `${ac}22`, border: `1.5px solid ${ac}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: ac }}>{u.slice(0, 2).toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>@{u}</div>
                <div style={{ fontSize: 10, color: "#3a4a6a" }}>{c} post{c !== 1 ? "s" : ""}</div>
              </div>
            </a>
          );
        })}
      </div>

      {bigWins.length > 0 && (
        <div style={{ background: "#0b1120", border: "1px solid #1a2540", borderRadius: 18, padding: "16px 18px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#f0f4ff", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399", display: "inline-block" }}/>
            Big Wins Today
          </div>
          {bigWins.map(p => (
            <div key={p.id} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#64748b" }}>@{p.username} · {p.symbol}</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#34d399", fontFamily: "monospace" }}>+${(p.pnl ?? 0).toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: "12px 16px", borderRadius: 14, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399", display: "inline-block", animation: "pulse2 1.5s infinite" }}/>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#34d399" }}>Live Feed</div>
          <div style={{ fontSize: 10, color: "#3a4a6a" }}>Real-time updates</div>
        </div>
      </div>
    </div>
  );
}

export default function FeedPage() {
  const [posts,   setPosts]   = useState<(FeedPost & { liked?: boolean })[]>([]);
  const [filter,  setFilter]  = useState("all");
  const [loading, setLoading] = useState(true);
  const [newIds,  setNewIds]  = useState<Set<string>>(new Set());
  const [likedIds,setLikedIds]= useState<Set<string>>(new Set());
  const channelRef = useRef<any>(null);
  const currentUser = getCurrentUser();

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      let data: FeedPost[] = [];
      if (filter === "following" && currentUser.username) {
        // Get user's Supabase ID first
        const { data: profile } = await supabase.from("profiles").select("id").eq("username", currentUser.username).single();
        if (profile) data = await getFollowingFeed(profile.id, 50);
      } else if (filter === "wins") {
        data = await getBigWinsFeed(200, 50);
      } else {
        data = await getGlobalFeed(50);
        if (filter === "verified") data = data.filter(p => p.verified_trader);
        if (filter === "strategies") data = data.filter(p => !!p.setup_name);
      }

      // Check which posts current user has liked
      if (data.length > 0 && currentUser.username) {
        const { data: profile } = await supabase.from("profiles").select("id").eq("username", currentUser.username).single();
        if (profile) {
          const liked = await getLikedPostIds(profile.id, data.map(p => p.id));
          setLikedIds(liked);
          setPosts(data.map(p => ({ ...p, liked: liked.has(p.id) })));
        } else {
          setPosts(data);
        }
      } else {
        setPosts(data);
      }
    } catch (e) {
      console.error("Feed error:", e);
      setPosts([]);
    }
    setLoading(false);
  }, [filter, currentUser.username]);

  useEffect(() => {
    fetchPosts();

    // Subscribe to real-time new posts
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = subscribeToFeed((newPost) => {
      setPosts(prev => {
        if (prev.find(p => p.id === newPost.id)) return prev;
        setNewIds(s => { const n = new Set(s); n.add(newPost.id); setTimeout(() => setNewIds(s2 => { const n2 = new Set(s2); n2.delete(newPost.id); return n2; }), 5000); return n; });
        return [newPost, ...prev];
      });
    });

    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [fetchPosts]);

  const handleLike = async (postId: string, currentlyLiked: boolean) => {
    if (!currentUser.username) return;
    const { data: profile } = await supabase.from("profiles").select("id").eq("username", currentUser.username).single();
    if (!profile) return;

    if (currentlyLiked) {
      await unlikePost(profile.id, postId);
      setLikedIds(prev => { const n = new Set(prev); n.delete(postId); return n; });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, liked: false, likes_count: Math.max(0, p.likes_count - 1) } : p));
    } else {
      await likePost(profile.id, postId);
      setLikedIds(prev => new Set([...prev, postId]));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, liked: true, likes_count: p.likes_count + 1 } : p));
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#060d1a", color: "#c8d8f0", fontFamily: "system-ui,sans-serif" }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse2{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      <div style={{ borderBottom: "1px solid #0d1628", background: "rgba(6,13,26,0.97)", padding: "14px 24px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(12px)" }}>
        <a href="/dashboard" style={{ fontSize: 12, color: "#3a4a6a", textDecoration: "none" }}>← Dashboard</a>
        <div style={{ flex: 1 }}/>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#34d399" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", display: "inline-block", animation: "pulse2 1.5s infinite" }}/>
          Live
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 24, alignItems: "start" }}>
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: "#f0f4ff", margin: "0 0 4px" }}>Social Feed</h1>
              <p style={{ fontSize: 13, color: "#3a4a6a", margin: 0 }}>
                {posts.length > 0 ? `${posts.length} trades shared` : "Be the first to share a trade"}
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
              {FILTERS.map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)} style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${filter === f.id ? "rgba(56,189,248,0.4)" : "#1a2540"}`, background: filter === f.id ? "rgba(56,189,248,0.1)" : "#0b1120", color: filter === f.id ? "#38bdf8" : "#475569", fontSize: 12, fontWeight: filter === f.id ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {f.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "60px", color: "#3a4a6a" }}>
                <div style={{ width: 24, height: 24, border: "2px solid #1a2540", borderTopColor: "#38bdf8", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }}/>
                <div style={{ fontSize: 13 }}>Loading feed…</div>
              </div>
            ) : posts.length === 0 ? (
              <div style={{ padding: "60px", textAlign: "center", color: "#3a4a6a", border: "1px dashed #1a2540", borderRadius: 20 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#475569", marginBottom: 8 }}>
                  {filter === "following" ? "Follow traders to see their posts" : "No trades shared yet"}
                </div>
                <div style={{ fontSize: 12 }}>Import real trades and share them to appear here</div>
              </div>
            ) : (
              posts.map(post => (
                <FeedCard
                  key={post.id}
                  post={post}
                  onLike={handleLike}
                  isNew={newIds.has(post.id)}
                />
              ))
            )}
          </div>

          <div style={{ position: "sticky", top: 80 }}>
            <TrendingSidebar posts={posts}/>
          </div>
        </div>
      </div>
    </div>
  );
}