import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-side proxy for CoinGecko market chart data.
// ?id=hyperliquid&days=30 → /coins/{id}/market_chart
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  const days = req.nextUrl.searchParams.get("days") || "30";

  if (!id) {
    return NextResponse.json({ error: "No id provided" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${encodeURIComponent(days)}`,
      { cache: "no-store", headers: { Accept: "application/json" } },
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: `CoinGecko ${res.status}` },
        { status: 502 },
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
