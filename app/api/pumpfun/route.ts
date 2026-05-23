import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch(
      'https://frontend-api.pump.fun/coins?offset=0&limit=100&sort=last_reply&order=DESC&includeNsfw=false',
      { cache: 'no-store', headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }
    )
    if (!res.ok) return NextResponse.json({ coins: [] })
    const data = await res.json()
    return NextResponse.json({ coins: Array.isArray(data) ? data : [] })
  } catch(e: any) {
    return NextResponse.json({ coins: [], error: e.message })
  }
}
