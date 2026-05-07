import { NextRequest, NextResponse } from "next/server";

const headers = (key: string) => ({
  apikey:         key,
  Authorization:  `Bearer ${key}`,
  "Content-Type": "application/json",
});

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Missing env vars" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const strategy_id = searchParams.get("strategy_id");
  if (!strategy_id) return NextResponse.json({ error: "Missing strategy_id" }, { status: 400 });

  try {
    const res  = await fetch(`${url}/rest/v1/followers?strategy_id=eq.${strategy_id}&select=id`, { headers: headers(key) });
    const data = await res.json();
    return NextResponse.json({ count: Array.isArray(data) ? data.length : 0 });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Missing env vars" }, { status: 500 });

  try {
    const { follower_user_id, strategy_id } = await req.json();
    if (!follower_user_id || !strategy_id) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const res = await fetch(`${url}/rest/v1/followers`, {
      method:  "POST",
      headers: { ...headers(key), Prefer: "return=minimal,resolution=ignore-duplicates" },
      body:    JSON.stringify({ follower_user_id, strategy_id }),
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: body }, { status: res.status });
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Missing env vars" }, { status: 500 });

  try {
    const { follower_user_id, strategy_id } = await req.json();
    const res = await fetch(
      `${url}/rest/v1/followers?follower_user_id=eq.${follower_user_id}&strategy_id=eq.${strategy_id}`,
      { method: "DELETE", headers: headers(key) }
    );
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
