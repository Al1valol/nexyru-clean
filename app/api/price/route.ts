import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-side proxy for live token prices.
// - ?ids=bitcoin,ethereum → CoinGecko simple/price (CoinGecko named coins)
// - ?address=0x... (with optional &chain=base) → DexScreener tokens
// Keeping these calls off the browser avoids per-client rate limits and
// CORS surprises, and lets us swap providers without touching the client.
export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids") || "";
  const address = req.nextUrl.searchParams.get("address") || "";

  try {
    if (ids) {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`,
        { cache: "no-store", headers: { Accept: "application/json" } },
      );
      const data = await res.json();
      return NextResponse.json(data);
    }

    if (address) {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(address)}`,
        { cache: "no-store", headers: { Accept: "application/json" } },
      );
      const data = await res.json();
      const pair = data?.pairs?.[0];
      const price = pair ? parseFloat(pair.priceUsd || "0") : 0;
      return NextResponse.json({ price, pair });
    }

    return NextResponse.json({ error: "No ids or address provided" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
