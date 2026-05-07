import { NextRequest, NextResponse } from "next/server";

const sb = (key: string) => ({
  apikey:         key,
  Authorization:  `Bearer ${key}`,
  "Content-Type": "application/json",
});

export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return NextResponse.json({ error: "Missing env vars" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const trade_id = searchParams.get("trade_id");
  if (!trade_id) return NextResponse.json({ error: "Missing trade_id" }, { status: 400 });

  const res  = await fetch(`${base}/rest/v1/trade_notes?trade_id=eq.${trade_id}&limit=1`, { headers: sb(key) });
  const data = await res.json();
  return NextResponse.json(data[0] ?? null);
}

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return NextResponse.json({ error: "Missing env vars" }, { status: 500 });

  try {
    const body = await req.json();
    const { trade_id, setup, confidence, emotion, notes, followed_rules, mistake_ids = [] } = body;
    if (!trade_id) return NextResponse.json({ error: "Missing trade_id" }, { status: 400 });

    const notesRes = await fetch(`${base}/rest/v1/trade_notes`, {
      method:  "POST",
      headers: { ...sb(key), Prefer: "resolution=merge-duplicates,return=minimal" },
      body:    JSON.stringify({ trade_id, setup, confidence, emotion, notes, followed_rules }),
    });
    if (!notesRes.ok) throw new Error((await notesRes.json()).message ?? "Failed to save notes");

    await fetch(`${base}/rest/v1/trade_mistake_logs?trade_id=eq.${trade_id}`, {
      method: "DELETE", headers: sb(key),
    });

    if (mistake_ids.length > 0) {
      const logsRes = await fetch(`${base}/rest/v1/trade_mistake_logs`, {
        method:  "POST",
        headers: { ...sb(key), Prefer: "return=minimal" },
        body:    JSON.stringify(mistake_ids.map((mid: string) => ({ trade_id, mistake_id: mid }))),
      });
      if (!logsRes.ok) throw new Error((await logsRes.json()).message ?? "Failed to save mistakes");
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
