// ============================================================
// NEXYRU — SUPABASE HELPER FUNCTIONS
// ============================================================

import { createClient } from '@supabase/supabase-js'
import type {
  Profile, TradePost, TradePostInsert,
  PostComment, PostCommentInsert, FeedPost,
  NotificationWithActor, PostWithProfile
} from './supabase-types'

// Use untyped client to avoid strict generic conflicts with joined queries
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export { supabase }

// ── Auth ──────────────────────────────────────────────────────
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

// ============================================================
// PROFILES
// ============================================================

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', userId).single()
  if (error) return null
  return data as Profile
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('username', username).single()
  if (error) return null
  return data as Profile
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'username' | 'display_name' | 'avatar_url' | 'bio' | 'prop_firm'>>
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles').update(updates).eq('id', userId).select().single()
  if (error) { console.error('updateProfile:', error); return null }
  return data as Profile
}

export async function searchProfiles(query: string, limit = 10): Promise<Profile[]> {
  const { data } = await supabase
    .from('profiles').select('*').ilike('username', `%${query}%`)
    .order('follower_count', { ascending: false }).limit(limit)
  return (data ?? []) as Profile[]
}

export async function getTopTraders(limit = 20): Promise<Profile[]> {
  const { data } = await supabase
    .from('profiles').select('*')
    .order('follower_count', { ascending: false }).limit(limit)
  return (data ?? []) as Profile[]
}

// ============================================================
// FOLLOWS
// ============================================================

export async function followUser(followerId: string, followingId: string): Promise<boolean> {
  const { error } = await supabase
    .from('follows').insert({ follower_id: followerId, following_id: followingId })
  return !error
}

export async function unfollowUser(followerId: string, followingId: string): Promise<boolean> {
  const { error } = await supabase
    .from('follows').delete().eq('follower_id', followerId).eq('following_id', followingId)
  return !error
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { data } = await supabase
    .from('follows').select('follower_id')
    .eq('follower_id', followerId).eq('following_id', followingId).maybeSingle()
  return !!data
}

export async function getFollowers(userId: string): Promise<Profile[]> {
  const { data } = await supabase
    .from('follows').select('follower_id').eq('following_id', userId)
  const ids = (data ?? []).map((r: any) => r.follower_id)
  if (!ids.length) return []
  const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids)
  return (profiles ?? []) as Profile[]
}

export async function getFollowing(userId: string): Promise<Profile[]> {
  const { data } = await supabase
    .from('follows').select('following_id').eq('follower_id', userId)
  const ids = (data ?? []).map((r: any) => r.following_id)
  if (!ids.length) return []
  const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids)
  return (profiles ?? []) as Profile[]
}

// ============================================================
// TRADE POSTS
// ============================================================

export async function createPost(post: TradePostInsert): Promise<TradePost | null> {
  const { data, error } = await supabase
    .from('trade_posts').insert(post).select().single()
  if (error) { console.error('createPost:', error); return null }
  return data as TradePost
}

export async function deletePost(postId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('trade_posts').delete().eq('id', postId).eq('user_id', userId)
  return !error
}

export async function getGlobalFeed(limit = 20, offset = 0): Promise<FeedPost[]> {
  const { data } = await supabase
    .from('trade_posts')
    .select('*, profile:profiles!user_id(username,display_name,avatar_url,verified_trader)')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  return ((data ?? []) as any[]).map((p: any) => ({
    ...p,
    username:        p.profile?.username        ?? null,
    display_name:    p.profile?.display_name    ?? null,
    avatar_url:      p.profile?.avatar_url      ?? null,
    verified_trader: p.profile?.verified_trader ?? false,
  })) as FeedPost[]
}

export async function getFollowingFeed(userId: string, limit = 20, offset = 0): Promise<PostWithProfile[]> {
  const { data: follows } = await supabase
    .from('follows').select('following_id').eq('follower_id', userId)
  const ids = (follows ?? []).map((f: any) => f.following_id)
  if (!ids.length) return []
  const { data } = await supabase
    .from('trade_posts')
    .select('*, profile:profiles!user_id(username,display_name,avatar_url,verified_trader)')
    .eq('visibility', 'public')
    .in('user_id', ids)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  return (data ?? []) as PostWithProfile[]
}

export async function getBigWinsFeed(minPnl = 500, limit = 20): Promise<FeedPost[]> {
  const { data } = await supabase
    .from('trade_posts')
    .select('*, profile:profiles!user_id(username,display_name,avatar_url,verified_trader)')
    .eq('visibility', 'public')
    .gte('pnl', minPnl)
    .order('pnl', { ascending: false })
    .limit(limit)
  return ((data ?? []) as any[]).map((p: any) => ({
    ...p,
    username:        p.profile?.username        ?? null,
    display_name:    p.profile?.display_name    ?? null,
    avatar_url:      p.profile?.avatar_url      ?? null,
    verified_trader: p.profile?.verified_trader ?? false,
  })) as FeedPost[]
}

export async function getUserPosts(userId: string, limit = 20, offset = 0): Promise<TradePost[]> {
  const { data } = await supabase
    .from('trade_posts').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  return (data ?? []) as TradePost[]
}

export async function getPostById(postId: string): Promise<PostWithProfile | null> {
  const { data, error } = await supabase
    .from('trade_posts')
    .select('*, profile:profiles!user_id(username,display_name,avatar_url,verified_trader)')
    .eq('id', postId).single()
  if (error) return null
  return data as PostWithProfile
}

// ============================================================
// LIKES
// ============================================================

export async function likePost(userId: string, postId: string): Promise<boolean> {
  const { error } = await supabase
    .from('post_likes').insert({ user_id: userId, post_id: postId })
  return !error
}

export async function unlikePost(userId: string, postId: string): Promise<boolean> {
  const { error } = await supabase
    .from('post_likes').delete().eq('user_id', userId).eq('post_id', postId)
  return !error
}

export async function hasLikedPost(userId: string, postId: string): Promise<boolean> {
  const { data } = await supabase
    .from('post_likes').select('user_id')
    .eq('user_id', userId).eq('post_id', postId).maybeSingle()
  return !!data
}

export async function getLikedPostIds(userId: string, postIds: string[]): Promise<Set<string>> {
  const { data } = await supabase
    .from('post_likes').select('post_id').eq('user_id', userId).in('post_id', postIds)
  return new Set((data ?? []).map((r: any) => r.post_id as string))
}

// ============================================================
// COMMENTS
// ============================================================

export async function getComments(postId: string): Promise<PostComment[]> {
  const { data } = await supabase
    .from('post_comments')
    .select('*, profile:profiles!user_id(username,display_name,avatar_url)')
    .eq('post_id', postId).order('created_at', { ascending: true })
  return (data ?? []) as PostComment[]
}

export async function addComment(comment: PostCommentInsert): Promise<PostComment | null> {
  const { data, error } = await supabase
    .from('post_comments').insert(comment).select().single()
  if (error) { console.error('addComment:', error); return null }
  return data as PostComment
}

export async function deleteComment(commentId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('post_comments').delete().eq('id', commentId).eq('user_id', userId)
  return !error
}

// ============================================================
// NOTIFICATIONS
// ============================================================

export async function getNotifications(userId: string, limit = 30): Promise<NotificationWithActor[]> {
  const { data } = await supabase
    .from('notifications')
    .select(`
      *,
      actor:profiles!actor_id(username,display_name,avatar_url),
      post:trade_posts!post_id(id,symbol,side,pnl)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as NotificationWithActor[]
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications').select('*', { count: 'exact', head: true })
    .eq('user_id', userId).eq('read', false)
  return count ?? 0
}

export async function markAllRead(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications').update({ read: true })
    .eq('user_id', userId).eq('read', false)
  return !error
}

export async function markNotificationRead(notificationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications').update({ read: true }).eq('id', notificationId)
  return !error
}

// ============================================================
// REALTIME SUBSCRIPTIONS
// ============================================================

export function subscribeToFeed(onPost: (post: FeedPost) => void) {
  return supabase.channel('feed')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'trade_posts', filter: 'visibility=eq.public' },
      (payload: any) => onPost(payload.new as FeedPost)
    ).subscribe()
}

export function subscribeToNotifications(
  userId: string,
  onNotification: (n: NotificationWithActor) => void
) {
  return supabase.channel(`notifications:${userId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload: any) => onNotification(payload.new as NotificationWithActor)
    ).subscribe()
}

export function subscribeToPostLikes(postId: string, onLike: (count: number) => void) {
  return supabase.channel(`likes:${postId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'post_likes', filter: `post_id=eq.${postId}` },
      async () => {
        const { data } = await supabase
          .from('trade_posts').select('likes_count').eq('id', postId).single()
        if (data) onLike((data as any).likes_count as number)
      }
    ).subscribe()
}

export function subscribeToComments(postId: string, onComment: (comment: PostComment) => void) {
  return supabase.channel(`comments:${postId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` },
      (payload: any) => onComment(payload.new as PostComment)
    ).subscribe()
}

// ============================================================
// EXAMPLE USAGE
// ============================================================

/*

// 1. Feed with like status
const feed = await getGlobalFeed(20, 0)
const likedIds = await getLikedPostIds(userId, feed.map(p => p.id))
const enriched = feed.map(p => ({ ...p, liked_by_me: likedIds.has(p.id) }))

// 2. Toggle like
const liked = await hasLikedPost(userId, postId)
if (liked) await unlikePost(userId, postId)
else await likePost(userId, postId)

// 3. Realtime feed (inside useEffect)
const channel = subscribeToFeed(post => setPosts(prev => [post, ...prev]))
return () => supabase.removeChannel(channel)

// 4. Unread badge
const count = await getUnreadCount(userId)

// 5. Mark all read
await markAllRead(userId)

*/