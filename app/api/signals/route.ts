import { NextRequest, NextResponse } from "next/server";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const headers = () => ({
  apikey:          SB_KEY!,
  Authorization:   `Bearer ${SB_KEY}`,
  "Content-Type":  "application/json",
  Prefer:          "return=representation",
});

// GET /api/signals — fetch recent signals
export async function GET(req: NextRequest) {
  if (!SB_URL || !SB_KEY) return NextResponse.json({ error: "Missing env" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const trader_id = searchParams.get("trader_id");
  const limit     = searchParams.get("limit") ?? "20";

  let url = `${SB_URL}/rest/v1/signals?select=*&order=created_at.desc&limit=${limit}`;
  if (trader_id) url += `&trader_id=eq.${trader_id}`;

  const res  = await fetch(url, { headers: headers() });
  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data }, { status: res.status });
  return NextResponse.json(data);
}

// POST /api/signals — post a new signal
export async function POST(req: NextRequest) {
  if (!SB_URL || !SB_KEY) return NextResponse.json({ error: "Missing env" }, { status: 500 });

  try {
    const body = await req.json();
    const { trader_id, trader_name, pair, direction, entry, stop_loss, take_profit, notes, risk_pct } = body;

    if (!trader_id || !pair || !direction || !entry)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const signal = {
      trader_id,
      trader_name:  trader_name ?? trader_id,
      pair:         pair.toUpperCase(),
      direction:    direction.toLowerCase(),  // "long" | "short"
      entry:        parseFloat(entry),
      stop_loss:    stop_loss    ? parseFloat(stop_loss)    : null,
      take_profit:  take_profit  ? parseFloat(take_profit)  : null,
      notes:        notes        ?? null,
      risk_pct:     risk_pct     ? parseFloat(risk_pct)     : 1,
      status:       "open",  // open | hit_tp | hit_sl | cancelled
      created_at:   new Date().toISOString(),
    };

    const res  = await fetch(`${SB_URL}/rest/v1/signals`, {
      method:  "POST",
      headers: headers(),
      body:    JSON.stringify(signal),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data }, { status: res.status });
    return NextResponse.json(data[0] ?? data);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH /api/signals — update signal status
export async function PATCH(req: NextRequest) {
  if (!SB_URL || !SB_KEY) return NextResponse.json({ error: "Missing env" }, { status: 500 });

  try {
    const { id, status } = await req.json();
    if (!id || !status) return NextResponse.json({ error: "Missing id or status" }, { status: 400 });

    const res  = await fetch(`${SB_URL}/rest/v1/signals?id=eq.${id}`, {
      method:  "PATCH",
      headers: headers(),
      body:    JSON.stringify({ status }),
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}