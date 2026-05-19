import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-side proxy for the Polymarket Gamma API. Keeps the call off the
// browser so we don't hit CORS or rate limits per-client.
export async function GET() {
  try {
    const res = await fetch(
      "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=20&order=volume&ascending=false",
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (!res.ok) {
      return NextResponse.json({ error: `Polymarket ${res.status}` }, { status: 502 });
    }
    const body = await res.json();
    return NextResponse.json({ markets: Array.isArray(body) ? body : [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 502 },
    );
  }
}
