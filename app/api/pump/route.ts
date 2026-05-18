import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const sort = req.nextUrl.searchParams.get('sort') || 'created_timestamp';
  const order = req.nextUrl.searchParams.get('order') || 'DESC';
  const limit = req.nextUrl.searchParams.get('limit') || '20';

  try {
    const res = await fetch(
      `https://frontend-api.pump.fun/coins?limit=${limit}&sort=${sort}&order=${order}&includeNsfw=false`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Origin': 'https://pump.fun',
          'Referer': 'https://pump.fun/',
        },
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Pump.fun returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
