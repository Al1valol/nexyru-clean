import { NextRequest, NextResponse } from "next/server";

// SQL to run in Supabase SQL editor before this route works:
//
// CREATE TABLE IF NOT EXISTS public.trades (
//   id text NOT NULL,
//   user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
//   data jsonb NOT NULL,
//   created_at timestamptz DEFAULT now(),
//   updated_at timestamptz DEFAULT now(),
//   PRIMARY KEY (id, user_id)
// );
// ALTER TABLE public.trades DISABLE ROW LEVEL SECURITY;

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") || "https://xsrcaceydyqytbipvrok.supabase.co";
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcmNhY2V5ZHlxeXRiaXB2cm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDg0MjUsImV4cCI6MjA5MzUyNDQyNX0.IfIkjTtAAb0-iZLu8CE-3GgdNGKxSNJKczSAZlQV62A";

const sbHeaders = () => ({
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  "Content-Type": "application/json",
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");
  if (!userId) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/trades?user_id=eq.${encodeURIComponent(userId)}&select=id,data,created_at,updated_at`,
      { headers: sbHeaders(), cache: "no-store" }
    );
    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: body, trades: [] }, { status: res.status });
    }
    const rows: Array<{ id: string; data: unknown }> = await res.json();
    const trades = rows.map((r) => {
      const d = (r.data ?? {}) as Record<string, unknown>;
      return { ...d, id: r.id };
    });
    return NextResponse.json({ trades });
  } catch (e) {
    return NextResponse.json({ error: String(e), trades: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId: string | undefined = body.user_id;
    const trades: Array<Record<string, unknown>> | undefined = body.trades;

    if (!userId) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    if (!Array.isArray(trades)) return NextResponse.json({ error: "trades must be an array" }, { status: 400 });

    if (trades.length === 0) return NextResponse.json({ ok: true, count: 0 });

    const now = new Date().toISOString();
    const rows = trades
      .filter((t) => t && (t.id !== undefined && t.id !== null))
      .map((t) => ({
        id: String(t.id),
        user_id: userId,
        data: t,
        updated_at: now,
      }));

    if (rows.length === 0) return NextResponse.json({ ok: true, count: 0 });

    const res = await fetch(`${SUPA_URL}/rest/v1/trades?on_conflict=id,user_id`, {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json({ error: errBody }, { status: res.status });
    }
    return NextResponse.json({ ok: true, count: rows.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tradeId = searchParams.get("trade_id");
  const userId = searchParams.get("user_id");
  if (!tradeId) return NextResponse.json({ error: "Missing trade_id" }, { status: 400 });

  try {
    const filter = userId
      ? `id=eq.${encodeURIComponent(tradeId)}&user_id=eq.${encodeURIComponent(userId)}`
      : `id=eq.${encodeURIComponent(tradeId)}`;
    const res = await fetch(`${SUPA_URL}/rest/v1/trades?${filter}`, {
      method: "DELETE",
      headers: sbHeaders(),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json({ error: errBody }, { status: res.status });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
