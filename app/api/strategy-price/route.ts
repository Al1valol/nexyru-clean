import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  try {
    const { strategy_id, monthly_price } = await req.json();
    if (!strategy_id) return NextResponse.json({ error: "Missing strategy_id" }, { status: 400 });
    const res = await fetch(`${url}/rest/v1/strategies?id=eq.${strategy_id}`, {
      method: "PATCH",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ monthly_price: parseFloat(monthly_price) || 0 }),
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
