import { NextRequest, NextResponse } from "next/server";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const hdrs = () => ({
  apikey:         SB_KEY!,
  Authorization:  `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
  Prefer:         "return=representation",
});

// GET /api/trader-follows?follower_id=x — get who x is following
// GET /api/trader-follows?trader_id=x  — get x's followers
// GET /api/trader-follows?follower_id=x&trader_id=y — check if x follows y
export async function GET(req: NextRequest) {
  if (!SB_URL || !SB_KEY) return NextResponse.json({ error: "Missing env" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const follower_id = searchParams.get("follower_id");
  const trader_id   = searchParams.get("trader_id");

  let url = `${SB_URL}/rest/v1/trader_follows?select=*`;
  if (follower_id && trader_id) {
    // Check if specific follow exists
    url += `&follower_id=eq.${follower_id}&trader_id=eq.${trader_id}`;
  } else if (follower_id) {
    url += `&follower_id=eq.${follower_id}`;
  } else if (trader_id) {
    url += `&trader_id=eq.${trader_id}`;
  }

  const res  = await fetch(url, { headers: hdrs() });
  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data }, { status: res.status });
  return NextResponse.json(data);
}

// POST /api/trader-follows — follow a trader
export async function POST(req: NextRequest) {
  if (!SB_URL || !SB_KEY) return NextResponse.json({ error: "Missing env" }, { status: 500 });

  try {
    const { follower_id, trader_id } = await req.json();
    if (!follower_id || !trader_id) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    if (follower_id === trader_id)   return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });

    const res  = await fetch(`${SB_URL}/rest/v1/trader_follows`, {
      method:  "POST",
      headers: hdrs(),
      body:    JSON.stringify({ follower_id, trader_id, created_at: new Date().toISOString() }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data }, { status: res.status });
    return NextResponse.json(data[0] ?? data);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/trader-follows — unfollow a trader
export async function DELETE(req: NextRequest) {
  if (!SB_URL || !SB_KEY) return NextResponse.json({ error: "Missing env" }, { status: 500 });

  try {
    const { follower_id, trader_id } = await req.json();
    if (!follower_id || !trader_id) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const res = await fetch(
      `${SB_URL}/rest/v1/trader_follows?follower_id=eq.${follower_id}&trader_id=eq.${trader_id}`,
      { method: "DELETE", headers: hdrs() }
    );
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}