import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!address) return NextResponse.json({ error: 'No address' }, { status: 400 })

  try {
    const res = await fetch(
      `https://api.rugcheck.xyz/v1/tokens/${address}/report`,
      { cache: 'no-store', headers: { 'Accept': 'application/json' } }
    )
    if (!res.ok) return NextResponse.json({ error: 'RugCheck error' }, { status: res.status })
    const data = await res.json()

    // Extract what we need
    const topHolders = (data.topHolders || []).slice(0, 10)
    const totalTopHolderPct = topHolders.reduce((s: number, h: any) => s + (h.pct || 0), 0)
    const insiders = topHolders.filter((h: any) => h.insider)
    const top1Pct = topHolders[0]?.pct || 0
    const top10Pct = totalTopHolderPct

    // Rug risk assessment
    let rugRisk = 'LOW'
    let rugReasons: string[] = []

    if (top1Pct > 50) { rugRisk = 'EXTREME'; rugReasons.push(`Top holder owns ${top1Pct.toFixed(1)}%`) }
    else if (top1Pct > 20) { rugRisk = 'HIGH'; rugReasons.push(`Top holder owns ${top1Pct.toFixed(1)}%`) }
    else if (top1Pct > 10) { rugRisk = 'MEDIUM'; rugReasons.push(`Top holder owns ${top1Pct.toFixed(1)}%`) }

    if (insiders.length > 0) { rugRisk = 'HIGH'; rugReasons.push(`${insiders.length} insider wallets detected`) }
    if (top10Pct > 80) rugReasons.push(`Top 10 hold ${top10Pct.toFixed(1)}% of supply`)
    if ((data.risks || []).length > 0) rugReasons.push(...data.risks.slice(0,2).map((r: any) => r.name || r.description))

    return NextResponse.json({
      score: data.score || 0,
      rugRisk,
      rugReasons,
      top1Pct: top1Pct.toFixed(1),
      top10Pct: top10Pct.toFixed(1),
      topHolders: topHolders.map((h: any) => ({
        owner: h.owner,
        pct: h.pct?.toFixed(2),
        insider: h.insider,
        uiAmount: h.uiAmount
      })),
      insiderCount: insiders.length,
      risks: (data.risks || []).slice(0, 5),
      holderCount: data.totalHolders || topHolders.length,
    })
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
