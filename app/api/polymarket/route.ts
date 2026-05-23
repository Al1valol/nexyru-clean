import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const endpoints = [
      'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&order=volume24hr&ascending=false',
      'https://clob.polymarket.com/markets?next_cursor=&active=true',
      'https://gamma-api.polymarket.com/markets?active=true&limit=100',
    ]

    let markets: any[] = []

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          cache: 'no-store',
          headers: { 'Accept': 'application/json' }
        })
        if (!res.ok) continue
        const data = await res.json()
        const markets1 = Array.isArray(data) ? data : []
        const markets2 = data?.markets || data?.data || []
        const found = markets1.length ? markets1 : markets2
        if (found.length) {
          markets = found
          break
        }
      } catch {
        continue
      }
    }

    if (!markets.length) {
      return NextResponse.json({ markets: getMockMarkets() })
    }

    const processed = markets.slice(0, 50).map((m: any) => {
      const outcomes = m.outcomes || []
      const yesOutcome = outcomes.find?.((o: any) => o.title?.toLowerCase() === 'yes') || outcomes[0]
      const noOutcome = outcomes.find?.((o: any) => o.title?.toLowerCase() === 'no') || outcomes[1]

      const yesPrice = parseFloat(
        m.outcomePrices?.[0] ||
        yesOutcome?.price ||
        m.bestBid ||
        m.lastTradePrice ||
        '0.5'
      )
      const noPrice = parseFloat(
        m.outcomePrices?.[1] ||
        noOutcome?.price ||
        (m.bestAsk ? String(1 - parseFloat(m.bestAsk)) : '') ||
        (yesPrice ? String(1 - yesPrice) : '0.5')
      )

      const endDate = m.endDate || m.endDateIso || m.end_date_iso || ''
      const daysLeft = endDate ? Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)) : 30

      const volume = parseFloat(m.volume || m.volumeNum || m.volume24hr || '0')
      const liquidity = parseFloat(m.liquidity || m.liquidityNum || '0')

      return {
        id: m.id || m.conditionId || m.condition_id || String(Math.random()),
        question: m.question || m.title || m.market_slug || '',
        category: m.category || m.tags?.[0] || 'General',
        endDate: endDate ? new Date(endDate).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : 'TBD',
        volume, liquidity,
        yesPrice: isNaN(yesPrice) ? 0.5 : yesPrice,
        noPrice: isNaN(noPrice) ? 0.5 : noPrice,
        probability: isNaN(yesPrice) ? 0.5 : yesPrice,
        active: true,
        slug: m.slug || m.marketSlug || m.market_slug || '',
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
  const today = Date.now()
  const d = (days: number) => new Date(today + days*86400000).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'})

  return [
    // CRYPTO
    { id:'btc-150k', question:'Will Bitcoin reach $150,000 before July 2026?', category:'Crypto', endDate:d(41), volume:2400000, liquidity:850000, yesPrice:0.42, noPrice:0.58, probability:0.42, active:true, slug:'bitcoin-150k', daysLeft:41, trending:true },
    { id:'eth-5k', question:'Will ETH reach $5,000 before August 2026?', category:'Crypto', endDate:d(72), volume:950000, liquidity:340000, yesPrice:0.28, noPrice:0.72, probability:0.28, active:true, slug:'eth-5k', daysLeft:72, trending:false },
    { id:'sol-300', question:'Will Solana reach $300 before June 2026?', category:'Crypto', endDate:d(39), volume:720000, liquidity:280000, yesPrice:0.61, noPrice:0.39, probability:0.61, active:true, slug:'sol-300', daysLeft:39, trending:true },
    { id:'btc-100k-end', question:'Will Bitcoin be above $100,000 on June 30 2026?', category:'Crypto', endDate:d(39), volume:1200000, liquidity:420000, yesPrice:0.73, noPrice:0.27, probability:0.73, active:true, slug:'btc-100k-june', daysLeft:39, trending:true },
    { id:'hype-price', question:'Will Hyperliquid (HYPE) reach $50 before July 2026?', category:'Crypto', endDate:d(41), volume:320000, liquidity:95000, yesPrice:0.58, noPrice:0.42, probability:0.58, active:true, slug:'hype-50', daysLeft:41, trending:false },
    { id:'xrp-5', question:'Will XRP reach $5 before August 2026?', category:'Crypto', endDate:d(72), volume:480000, liquidity:160000, yesPrice:0.33, noPrice:0.67, probability:0.33, active:true, slug:'xrp-5', daysLeft:72, trending:false },

    // POLITICS
    { id:'trump-approval', question:"Will Trump's approval rating exceed 50% in June 2026?", category:'Politics', endDate:d(39), volume:540000, liquidity:190000, yesPrice:0.22, noPrice:0.78, probability:0.22, active:true, slug:'trump-approval-50', daysLeft:39, trending:false },
    { id:'ukraine-ceasefire', question:'Will there be a Ukraine-Russia ceasefire before July 2026?', category:'Politics', endDate:d(41), volume:890000, liquidity:310000, yesPrice:0.38, noPrice:0.62, probability:0.38, active:true, slug:'ukraine-ceasefire', daysLeft:41, trending:true },
    { id:'us-recession', question:'Will the US enter a recession in 2026?', category:'Politics', endDate:d(220), volume:1100000, liquidity:380000, yesPrice:0.29, noPrice:0.71, probability:0.29, active:true, slug:'us-recession-2026', daysLeft:220, trending:false },
    { id:'next-us-president', question:'Will a Democrat win the 2028 US Presidential election?', category:'Politics', endDate:d(900), volume:2100000, liquidity:750000, yesPrice:0.45, noPrice:0.55, probability:0.45, active:true, slug:'dem-2028', daysLeft:900, trending:false },

    // ECONOMICS
    { id:'fed-june', question:'Will the Fed cut rates at the June 2026 meeting?', category:'Economics', endDate:d(27), volume:1800000, liquidity:620000, yesPrice:0.34, noPrice:0.66, probability:0.34, active:true, slug:'fed-june-2026', daysLeft:27, trending:true },
    { id:'fed-july', question:'Will the Fed cut rates at the July 2026 meeting?', category:'Economics', endDate:d(58), volume:980000, liquidity:340000, yesPrice:0.51, noPrice:0.49, probability:0.51, active:true, slug:'fed-july-2026', daysLeft:58, trending:false },
    { id:'inflation-3', question:'Will US CPI be above 3% in June 2026?', category:'Economics', endDate:d(45), volume:560000, liquidity:195000, yesPrice:0.41, noPrice:0.59, probability:0.41, active:true, slug:'cpi-3-june', daysLeft:45, trending:false },
    { id:'sp500-6000', question:'Will the S&P 500 reach 6,000 before July 2026?', category:'Economics', endDate:d(41), volume:740000, liquidity:260000, yesPrice:0.67, noPrice:0.33, probability:0.67, active:true, slug:'sp500-6000', daysLeft:41, trending:false },

    // STOCKS
    { id:'nvda-1500', question:'Will NVDA stock exceed $1,500 before July 2026?', category:'Stocks', endDate:d(41), volume:480000, liquidity:165000, yesPrice:0.45, noPrice:0.55, probability:0.45, active:true, slug:'nvda-1500', daysLeft:41, trending:false },
    { id:'tsla-400', question:'Will Tesla stock exceed $400 before August 2026?', category:'Stocks', endDate:d(72), volume:390000, liquidity:135000, yesPrice:0.38, noPrice:0.62, probability:0.38, active:true, slug:'tsla-400', daysLeft:72, trending:false },
    { id:'aapl-250', question:'Will Apple stock exceed $250 before July 2026?', category:'Stocks', endDate:d(41), volume:320000, liquidity:110000, yesPrice:0.52, noPrice:0.48, probability:0.52, active:true, slug:'aapl-250', daysLeft:41, trending:false },
    { id:'coinbase-400', question:'Will Coinbase (COIN) exceed $400 before August 2026?', category:'Stocks', endDate:d(72), volume:280000, liquidity:95000, yesPrice:0.41, noPrice:0.59, probability:0.41, active:true, slug:'coin-400', daysLeft:72, trending:false },

    // SPORTS
    { id:'nba-finals', question:'Will the Oklahoma City Thunder win the 2026 NBA Finals?', category:'Sports', endDate:d(25), volume:650000, liquidity:225000, yesPrice:0.31, noPrice:0.69, probability:0.31, active:true, slug:'okc-nba-2026', daysLeft:25, trending:true },
    { id:'world-cup-2026', question:'Will Brazil win the 2026 FIFA World Cup?', category:'Sports', endDate:d(410), volume:890000, liquidity:310000, yesPrice:0.18, noPrice:0.82, probability:0.18, active:true, slug:'brazil-wc-2026', daysLeft:410, trending:false },
    { id:'french-open', question:'Will Carlos Alcaraz win the 2026 French Open?', category:'Sports', endDate:d(15), volume:420000, liquidity:145000, yesPrice:0.28, noPrice:0.72, probability:0.28, active:true, slug:'alcaraz-french-open', daysLeft:15, trending:true },

    // AI/TECH
    { id:'gpt5', question:'Will OpenAI release GPT-5 before September 2026?', category:'Tech', endDate:d(120), volume:560000, liquidity:195000, yesPrice:0.72, noPrice:0.28, probability:0.72, active:true, slug:'gpt5-2026', daysLeft:120, trending:false },
    { id:'ai-regulation', question:'Will the US pass major AI regulation before end of 2026?', category:'Tech', endDate:d(220), volume:340000, liquidity:120000, yesPrice:0.24, noPrice:0.76, probability:0.24, active:true, slug:'us-ai-regulation', daysLeft:220, trending:false },
  ]
}
