// app/api/ai-feedback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateFeedback } from "@/lib/ai/feedback";

const sb = (key: string) => ({
  apikey:        key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
});

async function supabaseGet(url: string, key: string) {
  const res  = await fetch(url, { headers: sb(key), cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? JSON.stringify(data));
  return data;
}

async function supabaseUpsert(url: string, key: string, body: object) {
  const res = await fetch(url, {
    method:  "POST",
    headers: { ...sb(key), Prefer: "resolution=merge-duplicates,return=representation" },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? JSON.stringify(data));
  return data;
}

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!base || !key) {
    return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });
  }

  try {
    const { trade_id, trade, recentTrades = [] } = await req.json();

    if (!trade_id || !trade) {
      return NextResponse.json({ error: "trade_id and trade are required" }, { status: 400 });
    }

    // 1. Fetch notes
    const notesRows = await supabaseGet(
      `${base}/rest/v1/trade_notes?trade_id=eq.${trade_id}&limit=1`,
      key
    );
    const notes = notesRows[0] ?? {
      setup: null, confidence: 5, emotion: "calm",
      notes: null, followed_rules: true,
    };

    // 2. Fetch mistakes
    const mistakeLogs = await supabaseGet(
      `${base}/rest/v1/trade_mistake_logs?trade_id=eq.${trade_id}&select=mistake_id`,
      key
    );
    const mistakeIds = mistakeLogs.map((r: any) => r.mistake_id);

    let mistakes: { name: string }[] = [];
    if (mistakeIds.length > 0) {
      mistakes = await supabaseGet(
        `${base}/rest/v1/trade_mistakes?id=in.(${mistakeIds.join(",")})&select=name`,
        key
      );
    }

    // 3. Generate feedback
    const result = generateFeedback(trade, notes, mistakes, recentTrades);

    // 4. Upsert into ai_feedback
    await supabaseUpsert(`${base}/rest/v1/ai_feedback`, key, {
      trade_id: trade_id,
      feedback: result.feedback,
      score:    result.score,
    });

    return NextResponse.json({ feedback: result.feedback, score: result.score, lines: result.lines });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ai-feedback]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return NextResponse.json({ error: "Missing env vars" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const trade_id = searchParams.get("trade_id");
  if (!trade_id) return NextResponse.json({ error: "Missing trade_id" }, { status: 400 });

  try {
    const res  = await fetch(`${base}/rest/v1/ai_feedback?trade_id=eq.${trade_id}&limit=1`, { headers: sb(key) });
    const data = await res.json();
    return NextResponse.json(data[0] ?? null);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}