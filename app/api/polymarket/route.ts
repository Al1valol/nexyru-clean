import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [activeRes, volumeRes] = await Promise.all([
      fetch('https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=50&order=volume24hr&ascending=false', {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      }),
      fetch('https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=50&order=volume&ascending=false', {
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      })
    ])

    let markets: any[] = []

    if (activeRes.ok) {
      const data = await activeRes.json()
      markets = Array.isArray(data) ? data : (data.markets || [])
    }

    if (!markets.length && volumeRes.ok) {
      const data = await volumeRes.json()
      markets = Array.isArray(data) ? data : (data.markets || [])
    }

    if (!markets.length) {
      return NextResponse.json({ markets: getMockMarkets() })
    }

    const processed = markets.slice(0, 30).map((m: any) => {
      const outcomes = m.outcomes || []
      const yesOutcome = outcomes.find((o: any) => o.title?.toLowerCase() === 'yes') || outcomes[0]
      const noOutcome = outcomes.find((o: any) => o.title?.toLowerCase() === 'no') || outcomes[1]

      const yesPrice = parseFloat(yesOutcome?.price || m.outcomePrices?.[0] || '0.5')
      const noPrice = parseFloat(noOutcome?.price || m.outcomePrices?.[1] || '0.5')

      const endDate = m.endDate || m.endDateIso || ''
      const daysLeft = endDate ? Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)) : 30

      const volume = parseFloat(m.volume || m.volumeNum || '0')
      const liquidity = parseFloat(m.liquidity || m.liquidityNum || '0')

      return {
        id: m.id || m.conditionId || String(Math.random()),
        question: m.question || m.title || '',
        category: m.category || m.tags?.[0] || 'General',
        endDate: endDate ? new Date(endDate).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : 'TBD',
        volume, liquidity,
        yesPrice: isNaN(yesPrice) ? 0.5 : yesPrice,
        noPrice: isNaN(noPrice) ? 0.5 : noPrice,
        probability: isNaN(yesPrice) ? 0.5 : yesPrice,
        active: true,
        slug: m.slug || m.marketSlug || '',
        description: m.description || '',
        daysLeft,
        trending: volume > 100000
      }
    }).filter((m: any) => m.question && m.yesPrice > 0 && m.yesPrice < 1)
      .sort((a: any, b: any) => b.volume - a.volume)

    return NextResponse.json({ markets: processed.length ? processed : getMockMarkets() })
  } catch (e: any) {
    return NextResponse.json({ markets: getMockMarkets() })
  }
}

function getMockMarkets() {
  return [
    {
      id: 'btc-100k-2025',
      question: 'Will Bitcoin reach $150,000 before July 2026?',
      category: 'Crypto',
      endDate: 'Jul 1, 2026',
      volume: 2400000,
      liquidity: 850000,
      yesPrice: 0.42,
      noPrice: 0.58,
      probability: 0.42,
      active: true,
      slug: 'will-bitcoin-reach-150000',
      daysLeft: 41,
      trending: true
    },
    {
      id: 'fed-rate-june',
      question: 'Will the Fed cut rates at the June 2026 meeting?',
      category: 'Economics',
      endDate: 'Jun 18, 2026',
      volume: 1800000,
      liquidity: 620000,
      yesPrice: 0.34,
      noPrice: 0.66,
      probability: 0.34,
      active: true,
      slug: 'fed-cut-june-2026',
      daysLeft: 27,
      trending: true
    },
    {
      id: 'eth-5k',
      question: 'Will ETH reach $5,000 before August 2026?',
      category: 'Crypto',
      endDate: 'Aug 1, 2026',
      volume: 950000,
      liquidity: 340000,
      yesPrice: 0.28,
      noPrice: 0.72,
      probability: 0.28,
      active: true,
      slug: 'eth-5000-aug-2026',
      daysLeft: 72,
      trending: false
    },
    {
      id: 'solana-300',
      question: 'Will Solana reach $300 before June 2026?',
      category: 'Crypto',
      endDate: 'Jun 30, 2026',
      volume: 720000,
      liquidity: 280000,
      yesPrice: 0.61,
      noPrice: 0.39,
      probability: 0.61,
      active: true,
      slug: 'sol-300-june-2026',
      daysLeft: 39,
      trending: true
    },
    {
      id: 'trump-approval',
      question: "Will Trump's approval rating exceed 50% in June 2026?",
      category: 'Politics',
      endDate: 'Jun 30, 2026',
      volume: 540000,
      liquidity: 190000,
      yesPrice: 0.22,
      noPrice: 0.78,
      probability: 0.22,
      active: true,
      slug: 'trump-approval-50-june',
      daysLeft: 39,
      trending: false
    },
    {
      id: 'nvidia-1500',
      question: 'Will NVDA stock exceed $1,500 before July 2026?',
      category: 'Stocks',
      endDate: 'Jul 1, 2026',
      volume: 480000,
      liquidity: 165000,
      yesPrice: 0.45,
      noPrice: 0.55,
      probability: 0.45,
      active: true,
      slug: 'nvda-1500-july-2026',
      daysLeft: 41,
      trending: false
    },
  ]
}
