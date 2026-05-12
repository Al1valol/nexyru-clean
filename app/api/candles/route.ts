import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const CRYPTO_HINTS = ["USDT", "BUSD", "USDC", "FDUSD"];
const CRYPTO_SUFFIXES = ["USD", "BTC", "ETH", "BNB"];

function looksLikeCrypto(symbol: string): boolean {
  const s = symbol.toUpperCase();
  if (s.endsWith("=F")) return false; // Yahoo futures
  if (CRYPTO_HINTS.some((h) => s.includes(h))) return true;
  if (CRYPTO_SUFFIXES.some((suf) => s.endsWith(suf))) return true;
  return false;
}

const YAHOO_INTERVAL: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "60m",
  "60m": "60m",
  "1d": "1d",
};

async function fetchBinance(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number,
): Promise<Candle[]> {
  const url =
    `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}` +
    `&interval=${encodeURIComponent(interval)}` +
    `&startTime=${startTime}&endTime=${endTime}&limit=100`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error("Binance: invalid response");

  return rows
    .map((row: any[]): Candle => ({
      time: Math.floor(Number(row[0]) / 1000),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
    }))
    .filter(
      (c) =>
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close),
    )
    .sort((a, b) => a.time - b.time);
}

async function fetchYahoo(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number,
): Promise<Candle[]> {
  const ivl = YAHOO_INTERVAL[interval] || "5m";
  const period1 = Math.floor(startTime / 1000);
  const period2 = Math.floor(endTime / 1000);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${ivl}&period1=${period1}&period2=${period2}&includePrePost=false`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Nexyru/1.0)",
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const raw = await res.json();
  const result = raw?.chart?.result?.[0];
  if (!result) throw new Error("Yahoo: no result");

  const timestamps: number[] = result.timestamp || [];
  const q = result.indicators?.quote?.[0];
  if (!timestamps.length || !q) throw new Error("Yahoo: empty quote");

  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    const v = q.volume?.[i];
    if (
      Number.isFinite(o) &&
      Number.isFinite(h) &&
      Number.isFinite(l) &&
      Number.isFinite(c)
    ) {
      candles.push({
        time: timestamps[i],
        open: o,
        high: h,
        low: l,
        close: c,
        volume: Number.isFinite(v) ? v : 0,
      });
    }
  }
  return candles.sort((a, b) => a.time - b.time);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "").trim();
  const interval = (searchParams.get("interval") || "5m").trim();
  const startTime = Number(searchParams.get("startTime"));
  const endTime = Number(searchParams.get("endTime"));

  if (!symbol) {
    return NextResponse.json({ candles: [], error: "Missing symbol" });
  }
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    return NextResponse.json({ candles: [], error: "Invalid startTime/endTime" });
  }

  const source: "binance" | "yahoo" = looksLikeCrypto(symbol) ? "binance" : "yahoo";

  try {
    const candles =
      source === "binance"
        ? await fetchBinance(symbol, interval, startTime, endTime)
        : await fetchYahoo(symbol, interval, startTime, endTime);

    return NextResponse.json({ candles, source });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ candles: [], source, error: msg });
  }
}
