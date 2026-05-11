"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
export interface FollowState { isFollowing: boolean; followerCount: number; followingCount: number; isLoading: boolean; error: string|null; }
export function useFollow(targetUsername: string, currentUserId?: string) {
  const [state, setState] = useState<FollowState>({ isFollowing:false, followerCount:0, followingCount:0, isLoading:true, error:null });
  useEffect(() => {
    if (!targetUsername) return;
    load();
    const ch = supabase.channel(`profile:${targetUsername}`).on("postgres_changes",{event:"*",schema:"public",table:"follows"},()=>load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [targetUsername, currentUserId]);
  const load = async () => {
    setState(s=>({...s,isLoading:true,error:null}));
    try {
      const { data: p } = await supabase.from("profiles").select("id,follower_count,following_count").eq("username", targetUsername).single();
      if (!p) { setState(s=>({...s,isLoading:false})); return; }
      let isFollowing = false;
      if (currentUserId) { const { data: f } = await supabase.from("follows").select("follower_id").eq("follower_id",currentUserId).eq("following_id",p.id).maybeSingle(); isFollowing=!!f; }
      setState({ isFollowing, followerCount:p.follower_count, followingCount:p.following_count, isLoading:false, error:null });
    } catch { setState(s=>({...s,isLoading:false,error:"Failed to load"})); }
  };
  const toggle = useCallback(async () => {
    if (!currentUserId) { setState(s=>({...s,error:"Sign in to follow"})); return; }
    const { data: t } = await supabase.from("profiles").select("id").eq("username",targetUsername).single();
    if (!t) return;
    const prev = state.isFollowing;
    setState(s=>({...s,isFollowing:!prev,followerCount:prev?s.followerCount-1:s.followerCount+1,isLoading:true}));
    try {
      if (prev) await supabase.from("follows").delete().eq("follower_id",currentUserId).eq("following_id",t.id);
      else await supabase.from("follows").insert({follower_id:currentUserId,following_id:t.id});
      setState(s=>({...s,isLoading:false}));
    } catch { setState(s=>({...s,isFollowing:prev,followerCount:prev?s.followerCount+1:s.followerCount-1,isLoading:false,error:"Failed to update"})); }
  }, [state.isFollowing, currentUserId, targetUsername]);
  return { ...state, toggle };
}
