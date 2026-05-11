"use server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
export interface ActionResult { success: boolean; error?: string; data?: any; }
export async function followUserAction(followerId: string, targetUsername: string): Promise<ActionResult> {
  try {
    const { data: t } = await supabase.from("profiles").select("id").eq("username",targetUsername).single();
    if (!t) return { success:false, error:"User not found" };
    if (t.id === followerId) return { success:false, error:"Cannot follow yourself" };
    const { error } = await supabase.from("follows").insert({ follower_id:followerId, following_id:t.id });
    if (error && error.code !== "23505") return { success:false, error:error.message };
    revalidatePath(`/trader/@${targetUsername}`);
    return { success:true };
  } catch { return { success:false, error:"Unexpected error" }; }
}
export async function unfollowUserAction(followerId: string, targetUsername: string): Promise<ActionResult> {
  try {
    const { data: t } = await supabase.from("profiles").select("id").eq("username",targetUsername).single();
    if (!t) return { success:false, error:"User not found" };
    const { error } = await supabase.from("follows").delete().eq("follower_id",followerId).eq("following_id",t.id);
    if (error) return { success:false, error:error.message };
    revalidatePath(`/trader/@${targetUsername}`);
    return { success:true };
  } catch { return { success:false, error:"Unexpected error" }; }
}
export async function getFollowersAction(username: string): Promise<ActionResult> {
  try {
    const { data: p } = await supabase.from("profiles").select("id").eq("username",username).single();
    if (!p) return { success:false, error:"User not found" };
    const { data: follows } = await supabase.from("follows").select("follower_id").eq("following_id",p.id);
    const ids = (follows||[]).map((r:any)=>r.follower_id);
    if (!ids.length) return { success:true, data:[] };
    const { data } = await supabase.from("profiles").select("id,username,display_name,avatar_url,verified_trader,follower_count").in("id",ids).order("follower_count",{ascending:false});
    return { success:true, data:data??[] };
  } catch { return { success:false, error:"Unexpected error" }; }
}
export async function getFollowingAction(username: string): Promise<ActionResult> {
  try {
    const { data: p } = await supabase.from("profiles").select("id").eq("username",username).single();
    if (!p) return { success:false, error:"User not found" };
    const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id",p.id);
    const ids = (follows||[]).map((r:any)=>r.following_id);
    if (!ids.length) return { success:true, data:[] };
    const { data } = await supabase.from("profiles").select("id,username,display_name,avatar_url,verified_trader,follower_count").in("id",ids).order("follower_count",{ascending:false});
    return { success:true, data:data??[] };
  } catch { return { success:false, error:"Unexpected error" }; }
}
