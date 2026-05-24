import { NextResponse } from 'next/server'

export async function GET() {
  const now = new Date()
  const estHour = now.getUTCHours() - 4 // EST
  const day = now.getUTCDay()
  const isMarketHours = day >= 1 && day <= 5 && estHour >= 9 && estHour < 16

  if (!isMarketHours) {
    return NextResponse.json({ alerts: [] })
  }

  // Try Barchart first
  try {
    const res = await fetch(
      'https://www.barchart.com/options/unusual-activity/stocks?raw=1&page=1&limit=20&minVolume=500&volumeRatioMin=3',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.barchart.com/options/unusual-activity/stocks',
          'X-Requested-With': 'XMLHttpRequest',
        },
        cache: 'no-store',
      }
    )

    if (res.ok) {
      const text = await res.text()
      try {
        const data = JSON.parse(text)
        const rows = data?.data || []
        if (rows.length > 0) {
          const alerts = rows
            .slice(0, 15)
            .map((row: any, i: number) => {
              const ticker = row.symbol || row.baseSymbol || 'UNKNOWN'
              const type = (row.optionType || 'call').toUpperCase() === 'CALL' ? 'CALL' : 'PUT'
              const strike = parseFloat(row.strikePrice || 0)
              const volume = parseInt(row.volume || 0)
              const openInterest = parseInt(row.openInterest || row.oi || 1)
              const volumeRatio = openInterest > 0 ? volume / openInterest : 1
              const iv = parseFloat(row.impliedVolatility || 0) * 100
              const premium = parseFloat(row.tradeValue || row.totalValue || 0)
              const expiry = row.expirationDate || ''
              const daysToExpiry = expiry
                ? Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000)
                : 30
              const stockPrice = parseFloat(row.baseLastPrice || 0)
              const inTheMoney = type === 'CALL' ? stockPrice > strike : stockPrice < strike

              let score = 0
              if (volumeRatio > 20) score += 40
              else if (volumeRatio > 10) score += 30
              else if (volumeRatio > 5) score += 20
              else score += 10
              if (premium > 1000000) score += 30
              else if (premium > 500000) score += 22
              else if (premium > 100000) score += 15
              else score += 5
              if (daysToExpiry <= 7) score += 20
              else if (daysToExpiry <= 14) score += 15
              else if (daysToExpiry <= 30) score += 10
              if (inTheMoney) score += 10

              return {
                id: `${ticker}_${strike}_${type}_${i}`,
                ticker,
                type,
                strike,
                expiry,
                volume,
                openInterest,
                volumeRatio: parseFloat(volumeRatio.toFixed(1)),
                impliedVolatility: parseFloat(iv.toFixed(1)),
                premium,
                score: Math.min(100, score),
                sentiment:
                  type === 'CALL'
                    ? volumeRatio > 10
                      ? 'VERY BULLISH'
                      : 'BULLISH'
                    : volumeRatio > 10
                      ? 'VERY BEARISH'
                      : 'BEARISH',
                urgency: score >= 70 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW',
                timestamp: new Date().toISOString(),
                daysToExpiry,
                inTheMoney,
                sector: '',
              }
            })
            .filter((a: any) => a.ticker !== 'UNKNOWN' && a.score > 0)
            .sort((a: any, b: any) => b.score - a.score)

          if (alerts.length > 0) return NextResponse.json({ alerts })
        }
      } catch (e) {}
    }
  } catch (e) {}

  // Fallback: simulated alerts seeded per-minute so they're consistent
  // within the minute but drift through the trading day.
  const watchlist = [
    'NVDA','AAPL','TSLA','META','AMZN','GOOGL','MSFT','AMD','COIN','PLTR',
    'ARM','SPY','QQQ','SMCI','MSTR',
  ]

  const seed = Math.floor(Date.now() / 60000)
  const seededRandom = (n: number) =>
    ((seed * 9301 + n * 49297 + 233995) % 233280) / 233280

  const alerts = watchlist
    .slice(0, 8)
    .map((ticker, i) => {
      const isCall = seededRandom(i) > 0.4
      const volumeRatio = 3 + seededRandom(i + 10) * 25
      const premium = 50000 + seededRandom(i + 20) * 2000000
      const daysToExpiry = Math.floor(3 + seededRandom(i + 30) * 28)
      const iv = 20 + seededRandom(i + 40) * 60
      const volume = Math.floor(500 + seededRandom(i + 50) * 10000)
      const openInterest = Math.floor(volume / volumeRatio)

      let score = 0
      if (volumeRatio > 20) score += 40
      else if (volumeRatio > 10) score += 30
      else if (volumeRatio > 5) score += 20
      else score += 10
      if (premium > 1000000) score += 30
      else if (premium > 500000) score += 22
      else if (premium > 100000) score += 15
      else score += 5
      if (daysToExpiry <= 7) score += 20
      else if (daysToExpiry <= 14) score += 15
      else if (daysToExpiry <= 30) score += 10

      const expiryDate = new Date(Date.now() + daysToExpiry * 86400000)
      const expiry = expiryDate.toISOString().split('T')[0]

      const basePrices: Record<string, number> = {
        NVDA: 1100, AAPL: 210, TSLA: 280, META: 580, AMZN: 220,
        GOOGL: 175, MSFT: 450, AMD: 160, COIN: 280, PLTR: 120,
        ARM: 160, SPY: 580, QQQ: 490, SMCI: 45, MSTR: 400,
      }
      const basePrice = basePrices[ticker] || 100
      const strike = Math.round((basePrice * (0.95 + seededRandom(i + 60) * 0.1)) / 5) * 5

      return {
        id: `${ticker}_${strike}_${isCall ? 'CALL' : 'PUT'}_live_${seed}`,
        ticker,
        type: isCall ? 'CALL' : 'PUT',
        strike,
        expiry,
        volume,
        openInterest,
        volumeRatio: parseFloat(volumeRatio.toFixed(1)),
        impliedVolatility: parseFloat(iv.toFixed(1)),
        premium: Math.round(premium),
        score: Math.min(100, score),
        sentiment: isCall
          ? volumeRatio > 10
            ? 'VERY BULLISH'
            : 'BULLISH'
          : volumeRatio > 10
            ? 'VERY BEARISH'
            : 'BEARISH',
        urgency: score >= 70 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW',
        timestamp: new Date().toISOString(),
        daysToExpiry,
        inTheMoney: seededRandom(i + 70) > 0.5,
        sector: '',
      }
    })
    .sort((a, b) => b.score - a.score)

  return NextResponse.json({ alerts, simulated: true })
}
