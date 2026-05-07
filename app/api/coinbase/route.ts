import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const params = searchParams.get("params") ?? "";

  // Parse out product_id for the URL path, rest go as query params
  const parsed     = new URLSearchParams(params);
  const productId  = parsed.get("product_id") ?? "BTC-USD";
  parsed.delete("product_id");

  const hasExtra = parsed.toString().length > 0;
  const url = `https://api.coinbase.com/api/v3/brokerage/market/products/${productId}/candles${hasExtra ? "?" + parsed.toString() : ""}`;

  try {
    const res  = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 0 },
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Coinbase fetch failed" }, { status: 502 });
  }
}