import { NextRequest, NextResponse } from "next/server";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const headers = () => ({
  apikey:         SB_KEY!,
  Authorization:  `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
  Prefer:         "return=representation",
});

// GET — check if user copied a signal
export async function GET(req: NextRequest) {
  if (!SB_URL || !SB_KEY) return NextResponse.json({ error: "Missing env" }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const signal_id = searchParams.get("signal_id");
  const user_id   = searchParams.get("user_id");
  if (!signal_id || !user_id) return NextResponse.json(null);

  const res  = await fetch(`${SB_URL}/rest/v1/signal_copies?signal_id=eq.${signal_id}&user_id=eq.${user_id}&select=*`, { headers: headers() });
  const data = await res.json();
  return NextResponse.json(Array.isArray(data) ? data[0] ?? null : null);
}

// POST — mark signal as copied
export async function POST(req: NextRequest) {
  if (!SB_URL || !SB_KEY) return NextResponse.json({ error: "Missing env" }, { status: 500 });
  try {
    const { signal_id, user_id, account_size, risk_pct } = await req.json();
    if (!signal_id || !user_id) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    // Calculate suggested size
    const riskAmt  = (account_size ?? 10000) * ((risk_pct ?? 1) / 100);

    const copy = {
      signal_id,
      user_id,
      account_size: account_size ?? 10000,
      risk_pct:     risk_pct    ?? 1,
      risk_amount:  parseFloat(riskAmt.toFixed(2)),
      copied_at:    new Date().toISOString(),
      outcome:      "pending",  // pending | won | lost | cancelled
    };

    const res  = await fetch(`${SB_URL}/rest/v1/signal_copies`, {
      method:  "POST",
      headers: headers(),
      body:    JSON.stringify(copy),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data }, { status: res.status });
    return NextResponse.json(data[0] ?? data);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}