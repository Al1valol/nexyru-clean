// app/api/analytics/mistakes/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return NextResponse.json({ error: "Missing env vars" }, { status: 500 });

  const headers = {
    apikey:        key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  try {
    // Fetch all mistakes
    const mistakesRes = await fetch(`${base}/rest/v1/trade_mistakes?select=id,name`, { headers });
    const mistakes    = await mistakesRes.json();

    // Fetch all mistake logs
    const logsRes = await fetch(`${base}/rest/v1/trade_mistake_logs?select=trade_id,mistake_id`, { headers });
    const logs    = await logsRes.json();

    if (!Array.isArray(mistakes) || !Array.isArray(logs)) {
      return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
    }

    // Group logs by mistake_id
    const grouped: Record<string, string[]> = {};
    for (const log of logs) {
      if (!grouped[log.mistake_id]) grouped[log.mistake_id] = [];
      grouped[log.mistake_id].push(log.trade_id);
    }

    const results = mistakes
      .map((m: any) => ({
        id:        m.id,
        name:      m.name,
        count:     grouped[m.id]?.length ?? 0,
        trade_ids: grouped[m.id] ?? [],
      }))
      .filter(m => m.count > 0)
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ mistakes: results });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}