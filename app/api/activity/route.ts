import { NextRequest, NextResponse } from "next/server";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const hdrs = () => ({
  apikey:         SB_KEY!,
  Authorization:  `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
  Prefer:         "return=representation",
});

// GET — fetch activity feed
export async function GET(req: NextRequest) {
  if (!SB_URL || !SB_KEY) return NextResponse.json({ error: "Missing env" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");
  const limit   = searchParams.get("limit") ?? "50";

  let url = `${SB_URL}/rest/v1/activity_feed?select=*&order=created_at.desc&limit=${limit}`;
  if (user_id) url += `&user_id=eq.${user_id}`;

  const res  = await fetch(url, { headers: hdrs() });
  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data }, { status: res.status });
  return NextResponse.json(data);
}

// POST — create activity item
export async function POST(req: NextRequest) {
  if (!SB_URL || !SB_KEY) return NextResponse.json({ error: "Missing env" }, { status: 500 });

  try {
    const body = await req.json();
    const { user_id, type, data } = body;

    if (!user_id || !type) return NextResponse.json({ error: "Missing user_id or type" }, { status: 400 });

    const item = {
      user_id,
      type,
      data:       data ?? {},
      created_at: new Date().toISOString(),
    };

    const res  = await fetch(`${SB_URL}/rest/v1/activity_feed`, {
      method:  "POST",
      headers: hdrs(),
      body:    JSON.stringify(item),
    });
    const result = await res.json();
    if (!res.ok) return NextResponse.json({ error: result }, { status: res.status });
    return NextResponse.json(result[0] ?? result);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}