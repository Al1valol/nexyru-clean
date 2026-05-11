// ============================================================
// NEXYRU — SUPABASE TYPESCRIPT TYPES
// Auto-generated shape matching the SQL schema
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// ── Database root type ────────────────────────────────────────
export interface Database {
  public: {
    Tables: {
      profiles:      { Row: Profile;      Insert: ProfileInsert;      Update: ProfileUpdate      }
      follows:       { Row: Follow;       Insert: FollowInsert;       Update: never              }
      trade_posts:   { Row: TradePost;    Insert: TradePostInsert;    Update: TradePostUpdate    }
      post_likes:    { Row: PostLike;     Insert: PostLikeInsert;     Update: never              }
      post_comments: { Row: PostComment;  Insert: PostCommentInsert;  Update: PostCommentUpdate  }
      notifications: { Row: Notification; Insert: NotificationInsert; Update: NotificationUpdate }
    }
    Views: {
      feed_posts:                  { Row: FeedPost              }
      unread_notification_counts:  { Row: UnreadNotificationCount }
    }
    Functions: {}
    Enums: {
      post_side:       'long' | 'short'
      post_status:     'open' | 'closed'
      post_visibility: 'public' | 'followers' | 'private'
      notification_type: 'like' | 'comment' | 'follow' | 'mention' | 'milestone'
    }
  }
}

// ── PROFILES ─────────────────────────────────────────────────
export interface Profile {
  id:              string
  username:        string
  display_name:    string | null
  avatar_url:      string | null
  bio:             string | null
  verified_trader: boolean
  follower_count:  number
  following_count: number
  total_pnl:       number | null
  win_rate:        number | null
  prop_firm:       string | null
  created_at:      string
  updated_at:      string
}

export type ProfileInsert = Omit<Profile, 'follower_count' | 'following_count' | 'created_at' | 'updated_at'> & {
  follower_count?:  number
  following_count?: number
}

export type ProfileUpdate = Partial<Pick<Profile,
  'username' | 'display_name' | 'avatar_url' | 'bio' | 'verified_trader' | 'prop_firm'
>>

// ── FOLLOWS ──────────────────────────────────────────────────
export interface Follow {
  follower_id:  string
  following_id: string
  created_at:   string
}

export type FollowInsert = Omit<Follow, 'created_at'>

// ── TRADE_POSTS ───────────────────────────────────────────────
export type PostSide       = 'long' | 'short'
export type PostStatus     = 'open' | 'closed'
export type PostVisibility = 'public' | 'followers' | 'private'

export interface TradePost {
  id:             string
  user_id:        string
  trade_id:       string | null
  symbol:         string
  side:           PostSide
  entry_price:    number | null
  exit_price:     number | null
  pnl:            number | null
  contracts:      number | null
  setup_name:     string | null
  timeframe:      string | null
  notes:          string | null
  screenshot_url: string | null
  status:         PostStatus
  visibility:     PostVisibility
  likes_count:    number
  comments_count: number
  created_at:     string
  updated_at:     string
}

export type TradePostInsert = Omit<TradePost,
  'id' | 'likes_count' | 'comments_count' | 'created_at' | 'updated_at'
> & {
  id?:             string
  likes_count?:    number
  comments_count?: number
}

export type TradePostUpdate = Partial<Pick<TradePost,
  'notes' | 'screenshot_url' | 'status' | 'visibility' | 'setup_name'
>>

// ── POST_LIKES ────────────────────────────────────────────────
export interface PostLike {
  user_id:    string
  post_id:    string
  created_at: string
}

export type PostLikeInsert = Omit<PostLike, 'created_at'>

// ── POST_COMMENTS ─────────────────────────────────────────────
export interface PostComment {
  id:         string
  user_id:    string
  post_id:    string
  content:    string
  created_at: string
  updated_at: string
}

export type PostCommentInsert = Omit<PostComment, 'id' | 'created_at' | 'updated_at'>
export type PostCommentUpdate  = Pick<PostComment, 'content'>

// ── NOTIFICATIONS ─────────────────────────────────────────────
export type NotificationType = 'like' | 'comment' | 'follow' | 'mention' | 'milestone'

export interface Notification {
  id:         string
  user_id:    string
  type:       NotificationType
  actor_id:   string | null
  post_id:    string | null
  read:       boolean
  created_at: string
}

export type NotificationInsert = Omit<Notification, 'id' | 'created_at' | 'read'> & { read?: boolean }
export type NotificationUpdate  = Pick<Notification, 'read'>

// ── VIEWS ─────────────────────────────────────────────────────
export interface FeedPost extends TradePost {
  username:        string
  display_name:    string | null
  avatar_url:      string | null
  verified_trader: boolean
}

export interface UnreadNotificationCount {
  user_id:      string
  unread_count: number
}

// ── Rich types (joined) ───────────────────────────────────────
export interface PostWithProfile extends TradePost {
  profile: Pick<Profile, 'username' | 'display_name' | 'avatar_url' | 'verified_trader'>
  liked_by_me?: boolean
}

export interface CommentWithProfile extends PostComment {
  profile: Pick<Profile, 'username' | 'display_name' | 'avatar_url'>
}

export interface NotificationWithActor extends Notification {
  actor?: Pick<Profile, 'username' | 'display_name' | 'avatar_url'>
  post?:  Pick<TradePost, 'id' | 'symbol' | 'side' | 'pnl'>
}