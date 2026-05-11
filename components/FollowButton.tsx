"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
interface Props { targetUsername: string; currentUserId?: string; size?: "sm"|"md"|"lg"; variant?: "primary"|"outline"|"ghost"; showCount?: boolean; onFollowChange?: (f: boolean) => void; }
export default function FollowButton({ targetUsername, currentUserId, size="md", variant="primary", showCount=false, onFollowChange }: Props) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [targetId, setTargetId] = useState<string|null>(null);
  useEffect(() => { if (targetUsername) loadState(); }, [targetUsername, currentUserId]);
  const loadState = async () => {
    setIsLoading(true);
    try {
      const { data: p } = await supabase.from("profiles").select("id,follower_count").eq("username", targetUsername).single();
      if (!p) return;
      setTargetId(p.id); setFollowerCount(p.follower_count);
      if (currentUserId) {
        const { data: f } = await supabase.from("follows").select("follower_id").eq("follower_id", currentUserId).eq("following_id", p.id).maybeSingle();
        setIsFollowing(!!f);
      }
    } catch {}
    setIsLoading(false);
  };
  const handleClick = async () => {
    if (!currentUserId) { setError("Sign in to follow"); return; }
    if (!targetId || currentUserId === targetId) return;
    const prev = isFollowing;
    setIsFollowing(!prev); setFollowerCount(c => prev ? c-1 : c+1); setIsLoading(true); setError(null);
    try {
      if (prev) await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", targetId);
      else { const { error } = await supabase.from("follows").insert({ follower_id: currentUserId, following_id: targetId }); if (error && error.code !== "23505") throw error; }
      onFollowChange?.(!prev);
    } catch { setIsFollowing(prev); setFollowerCount(c => prev ? c+1 : c-1); setError("Failed to update"); }
    setIsLoading(false);
  };
  if (currentUserId && targetId && currentUserId === targetId) return null;
  const sz = { sm:{padding:"5px 12px",fontSize:11,height:28}, md:{padding:"8px 18px",fontSize:13,height:36}, lg:{padding:"11px 24px",fontSize:15,height:44} }[size];
  const base = { ...sz, borderRadius:10, fontWeight:700, cursor:isLoading?"wait":"pointer", transition:"all 0.15s", border:"none", display:"inline-flex", alignItems:"center", gap:6, fontFamily:"system-ui,sans-serif" };
  const style: any = isFollowing ? { ...base, background:isHovered?"rgba(248,113,113,0.12)":"rgba(52,211,153,0.1)", color:isHovered?"#f87171":"#34d399", border:`1px solid ${isHovered?"rgba(248,113,113,0.3)":"rgba(52,211,153,0.25)"}` } : variant==="outline" ? { ...base, background:"transparent", color:"#38bdf8", border:"1px solid rgba(56,189,248,0.4)" } : { ...base, background:"linear-gradient(135deg,#0369a1,#38bdf8)", color:"#fff", boxShadow:"0 4px 12px rgba(56,189,248,0.25)" };
  return (
    <div style={{ display:"inline-flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <button onClick={handleClick} disabled={!!(isLoading&&!isFollowing)} onMouseEnter={()=>setIsHovered(true)} onMouseLeave={()=>setIsHovered(false)} style={style}>
        {isLoading ? <><span style={{width:12,height:12,border:"2px solid currentColor",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block",animation:"fbspin 0.6s linear infinite"}}/>{isFollowing?"Following":"Follow"}</> : isFollowing ? (isHovered?"✕ Unfollow":"✓ Following") : "+ Follow"}
      </button>
      {showCount && <span style={{ fontSize:10, color:"#3a4a6a", fontFamily:"monospace" }}>{followerCount.toLocaleString()} followers</span>}
      {error && <span style={{ fontSize:10, color:"#f87171" }}>{error}</span>}
      <style>{`@keyframes fbspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
