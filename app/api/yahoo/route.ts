import { NextRequest, NextResponse } from "next/server";

// Map our timeframe IDs to Yahoo Finance intervals and ranges
const TF_MAP: Record<string, { interval: string; range: string }> = {
  "1m":  { interval: "1m",  range: "7d"   },
  "5m":  { interval: "5m",  range: "60d"  },
  "15m": { interval: "15m", range: "60d"  },
  "1h":  { interval: "1h",  range: "730d" },
  "4h":  { interval: "1h",  range: "730d" },  // Yahoo has no 4h; use 1h
  "1d":  { interval: "1d",  range: "5y"   },
};

interface Candle {
  time:  number;
  open:  number;
  high:  number;
  low:   number;
  close: number;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") ?? "ES=F";
  const tfId   = searchParams.get("tf")     ?? "1d";
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "500"), 2000);

  const tf = TF_MAP[tfId] ?? TF_MAP["1d"];

  // Yahoo Finance v8 chart API — no key required
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${tf.interval}&range=${tf.range}&includePrePost=false`;

  let raw: any;
  try {
    const res = await fetch(url, {
      headers: {
        // Yahoo requires a user-agent or it blocks the request
        "User-Agent": "Mozilla/5.0 (compatible; TradeDesk/1.0)",
        "Accept":     "application/json",
      },
      next: { revalidate: 300 }, // cache 5 min on server
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Yahoo Finance returned HTTP ${res.status} for ${symbol}` },
        { status: res.status }
      );
    }

    raw = await res.json();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Fetch failed: ${msg}` }, { status: 502 });
  }

  // Parse Yahoo's chart response
  const result = raw?.chart?.result?.[0];
  if (!result) {
    const errMsg = raw?.chart?.error?.description ?? "No data returned";
    return NextResponse.json({ error: errMsg }, { status: 404 });
  }

  const timestamps = result.timestamp as number[];
  const q          = result.indicators?.quote?.[0];

  if (!timestamps?.length || !q) {
    return NextResponse.json({ error: "No candle data in Yahoo response" }, { status: 404 });
  }

  const candles: Candle[] = timestamps
    .map((t, i) => ({
      time:  t,
      open:  q.open?.[i]  ?? 0,
      high:  q.high?.[i]  ?? 0,
      low:   q.low?.[i]   ?? 0,
      close: q.close?.[i] ?? 0,
    }))
    .filter(c => c.close > 0 && c.open > 0)
    .slice(-limit);

  if (!candles.length) {
    return NextResponse.json({ error: `No valid candles for ${symbol}` }, { status: 404 });
  }

  console.log(`[yahoo] ${symbol} ${tf.interval}: ${candles.length} candles`);

  return NextResponse.json({
    symbol,
    candles,
    source: "yahoo_finance",
    count:  candles.length,
  });
}