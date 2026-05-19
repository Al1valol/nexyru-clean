import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-side proxy for Kalshi public /markets endpoint. Most read endpoints
// are unauthenticated; returns an explicit error so the client can fall back
// to Polymarket-only display if Kalshi requires login or rate-limits us.
export async function GET() {
  try {
    const res = await fetch(
      "https://trading-api.kalshi.com/trade-api/v2/markets?limit=20&status=open",
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: `Kalshi ${res.status}`, markets: [] },
        { status: 502 },
      );
    }
    const body = await res.json();
    return NextResponse.json({ markets: Array.isArray(body?.markets) ? body.markets : [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed", markets: [] },
      { status: 502 },
    );
  }
}
