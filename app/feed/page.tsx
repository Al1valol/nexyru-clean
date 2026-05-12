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

const LIKED_KEY = "nexyru_liked_posts";
const LIKED_COMMENTS_KEY = "nexyru_liked_comments";

function readSet(key: string): Set<string> {
  try {
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}
function writeSet(key: string, set: Set<string>) {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch {}
}

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

function fmtPrice(n: any) {
  if (n === null || n === undefined || isNaN(Number(n))) return null;
  const v = Number(n);
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export default function FeedPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [bounceId, setBounceId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [commentsByPost, setCommentsByPost] = useState<Record<string, any[]>>({});
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState<Set<string>>(new Set());
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [commentLikeCounts, setCommentLikeCounts] = useState<Record<string, number>>({});
  const [sharedId, setSharedId] = useState<string | null>(null);
  const supabaseRef = useRef<any>(null);
  const profileIdRef = useRef<string | null>(null);
  const currentUserRef = useRef<string | null>(null);

  const resolveProfileId = useCallback(async () => {
    if (profileIdRef.current) return profileIdRef.current;
    if (!supabaseRef.current) return null;
    try {
      const u = JSON.parse(localStorage.getItem("tradedesk_session_v1") || "{}").username;
      if (!u) return null;
      currentUserRef.current = u;
      const { data } = await supabaseRef.current.supabase.from("profiles").select("id").eq("username", u).single();
      if (data?.id) { profileIdRef.current = data.id; return data.id; }
    } catch {}
    return null;
  }, []);

  useEffect(() => {
    setLikedComments(readSet(LIKED_COMMENTS_KEY));
    import("@/lib/supabase-helpers").then((mod) => {
      supabaseRef.current = mod;
      loadFeed(filter, mod);
      resolveProfileId();
    });
  }, []);

  useEffect(() => {
    if (!supabaseRef.current) return;
    loadFeed(filter, supabaseRef.current);
  }, [filter]);

  const loadFeed = async (f: string, mod: any) => {
    const { supabase, getGlobalFeed, getBigWinsFeed } = mod;
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
      const likedLs = readSet(LIKED_KEY);
      data = data.map((p: any) => ({ ...p, liked: likedLs.has(p.id) }));
      setPosts(data);
    } catch (e) {
      console.error(e);
      setPosts([]);
    }
    setLoading(false);
  };

  const handleLike = (postId: string) => {
    setBounceId(postId);
    setTimeout(() => setBounceId(prev => prev === postId ? null : prev), 320);

    const set = readSet(LIKED_KEY);
    const wasLiked = set.has(postId);
    if (wasLiked) set.delete(postId); else set.add(postId);
    writeSet(LIKED_KEY, set);

    setPosts(prev => prev.map(p => p.id === postId
      ? { ...p, liked: !wasLiked, likes_count: Math.max(0, (p.likes_count || 0) + (wasLiked ? -1 : 1)) }
      : p
    ));

    (async () => {
      const pid = await resolveProfileId();
      if (!pid || !supabaseRef.current) return;
      const { likePost, unlikePost } = supabaseRef.current;
      try {
        if (wasLiked) await unlikePost(pid, postId);
        else await likePost(pid, postId);
      } catch {}
    })();
  };

  const toggleComments = async (postId: string) => {
    const isOpen = expanded.has(postId);
    const next = new Set(expanded);
    if (isOpen) next.delete(postId); else next.add(postId);
    setExpanded(next);
    if (!isOpen && !commentsByPost[postId]) await fetchComments(postId);
  };

  const fetchComments = async (postId: string) => {
    if (!supabaseRef.current) return;
    setLoadingComments(prev => { const n = new Set(prev); n.add(postId); return n; });
    try {
      const { getComments } = supabaseRef.current;
      const data = await getComments(postId);
      setCommentsByPost(prev => ({ ...prev, [postId]: data }));
    } catch {
      setCommentsByPost(prev => ({ ...prev, [postId]: [] }));
    }
    setLoadingComments(prev => { const n = new Set(prev); n.delete(postId); return n; });
  };

  const submitComment = async (postId: string) => {
    const text = (draft[postId] || "").trim();
    if (!text || posting.has(postId)) return;
    const pid = await resolveProfileId();
    if (!pid || !supabaseRef.current) return;

    setPosting(prev => { const n = new Set(prev); n.add(postId); return n; });
    const { addComment } = supabaseRef.current;
    const optimistic = {
      id: `tmp-${Date.now()}`,
      user_id: pid,
      post_id: postId,
      content: text,
      created_at: new Date().toISOString(),
      profile: {
        username: currentUserRef.current,
        display_name: null,
        avatar_url: null,
      },
      _optimistic: true,
    };
    setCommentsByPost(prev => ({ ...prev, [postId]: [...(prev[postId] || []), optimistic] }));
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
    setDraft(prev => ({ ...prev, [postId]: "" }));

    try {
      const real = await addComment({ user_id: pid, post_id: postId, content: text });
      if (real) {
        setCommentsByPost(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).map(c => c.id === optimistic.id ? { ...real, profile: optimistic.profile } : c),
        }));
      }
    } catch {}
    setPosting(prev => { const n = new Set(prev); n.delete(postId); return n; });
  };

  const toggleCommentLike = (commentId: string) => {
    setLikedComments(prev => {
      const next = new Set(prev);
      const was = next.has(commentId);
      if (was) next.delete(commentId); else next.add(commentId);
      writeSet(LIKED_COMMENTS_KEY, next);
      setCommentLikeCounts(c => ({
        ...c,
        [commentId]: Math.max(0, (c[commentId] || 0) + (was ? -1 : 1)),
      }));
      return next;
    });
  };

  const sharePost = async (postId: string, username: string) => {
    try {
      const url = `${window.location.origin}/trader/@${username}`;
      await navigator.clipboard.writeText(url);
      setSharedId(postId);
      setTimeout(() => setSharedId(prev => prev === postId ? null : prev), 1800);
    } catch {}
  };

  const trending = Object.entries(
    posts.reduce((a: any, p: any) => { a[p.username] = (a[p.username] || 0) + 1; return a; }, {})
  ).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);

  return (
    <div style={{ minHeight: "100vh", background: "#060d1a", color: "#c8d8f0", fontFamily: "system-ui,sans-serif" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes p2{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes bounce{0%{transform:scale(1)}30%{transform:scale(1.35)}55%{transform:scale(0.9)}100%{transform:scale(1)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .nx-bounce{display:inline-block;animation:bounce 320ms ease-out}
        .nx-comments{animation:slideDown 220ms ease-out;overflow:hidden}
        .nx-react-btn{transition:background-color 140ms ease, color 140ms ease, transform 140ms ease}
        .nx-react-btn:hover{background:rgba(56,189,248,0.06);color:#cbd5e1}
        .nx-react-btn:active{transform:scale(0.96)}
        .nx-link:hover{color:#7dd3fc !important;text-decoration:underline}
        .nx-profile-link{transition:color 140ms ease}
        .nx-profile-link:hover{color:#7dd3fc}
        .nx-input:focus{outline:none;border-color:rgba(56,189,248,0.5)!important;background:#0a1322!important}
      `}</style>
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
            const isExpanded = expanded.has(post.id);
            const comments = commentsByPost[post.id] || [];
            const isLoadingC = loadingComments.has(post.id);
            const entry = fmtPrice(post.entry_price);
            const exit = fmtPrice(post.exit_price);
            const isShared = sharedId === post.id;
            const isBouncing = bounceId === post.id;

            return (
              <div key={post.id} style={{ borderRadius: 20, background: "#0b1120", border: "1px solid #1a2540", padding: "20px 24px", marginBottom: 14, boxShadow: "0 1px 0 rgba(255,255,255,0.02) inset" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <a href={`/trader/@${post.username}`} style={{ width: 44, height: 44, borderRadius: 13, background: ac + "22", border: `1.5px solid ${ac}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: ac, flexShrink: 0, textDecoration: "none" }}>
                    {post.username?.slice(0, 2).toUpperCase()}
                  </a>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      <a href={`/trader/@${post.username}`} className="nx-link" style={{ fontSize: 14, fontWeight: 800, color: "#f0f4ff", textDecoration: "none", transition: "color 140ms ease" }}>@{post.username}</a>
                      {post.verified_trader && <span title="Verified" style={{ fontSize: 11, color: "#38bdf8" }}>✓</span>}
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: post.side === "long" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)", color: post.side === "long" ? "#34d399" : "#f87171" }}>
                        {post.side === "long" ? "▲ LONG" : "▼ SHORT"}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", fontFamily: "monospace" }}>{post.symbol}</span>
                      <span style={{ fontSize: 11, color: "#2e3f5a", marginLeft: "auto" }}>{timeAgo(post.created_at)}</span>
                    </div>

                    {post.pnl !== null && post.pnl !== undefined && (
                      <div style={{ display: "inline-flex", padding: "8px 14px", borderRadius: 12, background: pos ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${pos ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`, marginBottom: 10 }}>
                        <span style={{ fontSize: 20, fontWeight: 900, color: pos ? "#34d399" : "#f87171", fontFamily: "monospace" }}>{pos ? "+" : ""}{(post.pnl ?? 0).toFixed(2)}</span>
                      </div>
                    )}

                    {(entry || exit) && (
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 8 }}>
                        {entry && <><span style={{ color: "#3a4a6a" }}>Entry</span> <span style={{ color: "#94a3b8" }}>{entry}</span></>}
                        {entry && exit && <span style={{ color: "#2e3f5a" }}>→</span>}
                        {exit && <><span style={{ color: "#3a4a6a" }}>Exit</span> <span style={{ color: "#94a3b8" }}>{exit}</span></>}
                        {post.setup_name && <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 6, background: "rgba(167,139,250,0.08)", color: "#a78bfa", fontSize: 10, fontWeight: 700 }}>{post.setup_name}</span>}
                      </div>
                    )}

                    {post.notes && <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 12px", lineHeight: 1.6 }}>{post.notes}</p>}

                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 10, borderTop: "1px solid #131e36", paddingTop: 10 }}>
                      <button
                        onClick={() => handleLike(post.id)}
                        className="nx-react-btn"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: post.liked ? "#f43f5e" : "#64748b", padding: "6px 10px", borderRadius: 8 }}
                      >
                        <span className={isBouncing ? "nx-bounce" : ""} style={{ fontSize: 14, lineHeight: 1 }}>{post.liked ? "❤️" : "🤍"}</span>
                        <span>{post.likes_count || 0}</span>
                        <span style={{ color: "#3a4a6a", fontSize: 11, marginLeft: 2 }}>Like</span>
                      </button>

                      <button
                        onClick={() => toggleComments(post.id)}
                        className="nx-react-btn"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: isExpanded ? "rgba(56,189,248,0.06)" : "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: isExpanded ? "#38bdf8" : "#64748b", padding: "6px 10px", borderRadius: 8 }}
                      >
                        <span style={{ fontSize: 14, lineHeight: 1 }}>💬</span>
                        <span>{post.comments_count || 0}</span>
                        <span style={{ color: "#3a4a6a", fontSize: 11, marginLeft: 2 }}>Comment</span>
                      </button>

                      <button
                        onClick={() => sharePost(post.id, post.username)}
                        className="nx-react-btn"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: isShared ? "#34d399" : "#64748b", padding: "6px 10px", borderRadius: 8 }}
                      >
                        <span style={{ fontSize: 14, lineHeight: 1 }}>{isShared ? "✅" : "📤"}</span>
                        <span style={{ fontSize: 11 }}>{isShared ? "Copied!" : "Share"}</span>
                      </button>

                      <div style={{ flex: 1 }} />
                      <a href={`/trader/@${post.username}`} className="nx-profile-link" style={{ fontSize: 11, color: "#3a4a6a", textDecoration: "none" }}>View Profile →</a>
                    </div>

                    {isExpanded && (
                      <div className="nx-comments" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #131e36" }}>
                        {isLoadingC ? (
                          <div style={{ fontSize: 11, color: "#3a4a6a", padding: "12px 0" }}>Loading comments…</div>
                        ) : (
                          <>
                            {comments.length === 0 && (
                              <div style={{ fontSize: 11, color: "#3a4a6a", padding: "4px 0 12px" }}>No comments yet. Be the first.</div>
                            )}
                            {comments.map((c: any) => {
                              const cu = c.profile?.username || "user";
                              const cAc = getAC(cu);
                              const cLiked = likedComments.has(c.id);
                              const cCount = commentLikeCounts[c.id] || 0;
                              return (
                                <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 12, animation: "fadeIn 200ms ease-out" }}>
                                  <a href={`/trader/@${cu}`} style={{ width: 30, height: 30, borderRadius: 9, background: cAc + "22", border: `1px solid ${cAc}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: cAc, flexShrink: 0, textDecoration: "none" }}>
                                    {cu.slice(0, 2).toUpperCase()}
                                  </a>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ background: "#0a1322", border: "1px solid #131e36", borderRadius: 12, padding: "8px 12px" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                                        <a href={`/trader/@${cu}`} className="nx-link" style={{ fontSize: 12, fontWeight: 800, color: "#e2e8f0", textDecoration: "none" }}>@{cu}</a>
                                        <span style={{ fontSize: 10, color: "#2e3f5a" }}>{timeAgo(c.created_at)}</span>
                                      </div>
                                      <div style={{ fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.5, wordBreak: "break-word" }}>{c.content}</div>
                                    </div>
                                    <button
                                      onClick={() => toggleCommentLike(c.id)}
                                      style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontSize: 11, color: cLiked ? "#f43f5e" : "#3a4a6a", padding: "4px 4px 0", marginTop: 2 }}
                                    >
                                      <span style={{ fontSize: 11 }}>{cLiked ? "❤️" : "🤍"}</span>
                                      {cCount > 0 && <span>{cCount}</span>}
                                      <span style={{ color: "#2e3f5a" }}>Like</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "flex-end" }}>
                              <textarea
                                value={draft[post.id] || ""}
                                onChange={(e) => setDraft(prev => ({ ...prev, [post.id]: e.target.value }))}
                                placeholder="Add a comment…"
                                rows={1}
                                className="nx-input"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(post.id); }
                                }}
                                style={{ flex: 1, resize: "none", background: "#0a1322", border: "1px solid #1a2540", borderRadius: 10, padding: "10px 12px", color: "#e2e8f0", fontSize: 12.5, fontFamily: "inherit", minHeight: 38, maxHeight: 120, transition: "border-color 140ms, background 140ms" }}
                              />
                              <button
                                onClick={() => submitComment(post.id)}
                                disabled={!((draft[post.id] || "").trim()) || posting.has(post.id)}
                                style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: (draft[post.id] || "").trim() ? "linear-gradient(180deg,#38bdf8,#0ea5e9)" : "#131e36", color: (draft[post.id] || "").trim() ? "#06121f" : "#3a4a6a", fontSize: 12, fontWeight: 800, cursor: (draft[post.id] || "").trim() ? "pointer" : "not-allowed", transition: "opacity 140ms" }}
                              >
                                {posting.has(post.id) ? "…" : "Post"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
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
