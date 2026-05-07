import { NextRequest, NextResponse } from "next/server";

const ALLOWED_SYMBOLS = new Set(["SPY", "QQQ", "DIA", "IWM", "VTI", "GLD", "TLT"]);

interface Candle {
  time:  number;
  open:  number;
  high:  number;
  low:   number;
  close: number;
}

function parseAlphaVantageDaily(raw: Record<string, unknown>, days: number): Candle[] {
  const series = raw["Time Series (Daily)"] as Record<string, Record<string, string>> | undefined;

  if (!series) {
    throw new Error(
      `Alpha Vantage response missing "Time Series (Daily)". Got keys: ${Object.keys(raw).join(", ")}`
    );
  }

  const candles: Candle[] = Object.entries(series)
    .map(([dateStr, v]) => ({
      time:  Math.floor(new Date(dateStr).getTime() / 1000),
      open:  parseFloat(v["1. open"]),
      high:  parseFloat(v["2. high"]),
      low:   parseFloat(v["3. low"]),
      close: parseFloat(v["4. close"]),
    }))
    .filter(c => c.close > 0 && !isNaN(c.close))
    .sort((a, b) => a.time - b.time);

  if (!candles.length) {
    throw new Error("Alpha Vantage returned zero valid candles");
  }

  return candles.slice(-days);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "SPY").toUpperCase();
  const days   = Math.min(parseInt(searchParams.get("days") ?? "500"), 2000);

  if (!ALLOWED_SYMBOLS.has(symbol)) {
    return NextResponse.json(
      { error: `Symbol not supported. Allowed: ${[...ALLOWED_SYMBOLS].join(", ")}` },
      { status: 400 }
    );
  }

  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!apiKey) {
    console.error("[index-data] ALPHA_VANTAGE_API_KEY is not set");
    return NextResponse.json({ error: "Missing ALPHA_VANTAGE_API_KEY" }, { status: 500 });
  }

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${apiKey}`;

  let raw: Record<string, unknown>;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Alpha Vantage HTTP error: ${res.status} ${res.statusText}`);
    }
    raw = await res.json() as Record<string, unknown>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[index-data] Fetch failed:", msg);
    return NextResponse.json({ error: `Alpha Vantage fetch failed: ${msg}` }, { status: 502 });
  }

  console.log("[index-data] Alpha Vantage response keys:", Object.keys(raw));

  if (raw["Note"]) {
    console.error("[index-data] Rate limit hit:", raw["Note"]);
    return NextResponse.json({ error: "Alpha Vantage rate limit hit" }, { status: 429 });
  }

  if (raw["Information"]) {
    console.error("[index-data] Information:", raw["Information"]);
    return NextResponse.json({ error: `Alpha Vantage: ${raw["Information"]}` }, { status: 403 });
  }

  if (raw["Error Message"]) {
    console.error("[index-data] Error Message:", raw["Error Message"]);
    return NextResponse.json({ error: `Alpha Vantage error: ${raw["Error Message"]}` }, { status: 400 });
  }

  let candles: Candle[];

  try {
    candles = parseAlphaVantageDaily(raw, days);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[index-data] Parse failed:", msg);
    return NextResponse.json({ error: `Failed to parse Alpha Vantage data: ${msg}` }, { status: 502 });
  }

  console.log(`[index-data] ${symbol}: returning ${candles.length} candles`);

  return NextResponse.json({ symbol, candles, source: "alpha_vantage", count: candles.length });
}
