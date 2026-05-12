import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pair = searchParams.get('pair') || 'SOLUSD';
  const interval = searchParams.get('interval') || '5';
  const since = searchParams.get('since') || '';

  try {
    const url = `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${interval}${since ? '&since='+since : ''}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    const data = await res.json();

    if (data.error?.length) {
      return NextResponse.json({ error: data.error[0], candles: [] });
    }

    // Kraken returns {result: {PAIRNAME: [[time,open,high,low,close,vwap,volume,count]]}}
    const pairData = Object.values(data.result).find((v: any) => Array.isArray(v)) as any[];

    const candles = (pairData || []).map((c: any) => ({
      time: c[0],
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[6]),
    }));

    return NextResponse.json({ candles, source: 'kraken' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, candles: [] });
  }
}
