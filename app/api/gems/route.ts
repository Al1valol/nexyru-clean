import { NextResponse } from 'next/server'
export const maxDuration = 30

export async function GET() {
  try {
    const [profilesRes, boostsRes] = await Promise.all([
      fetch('https://api.dexscreener.com/token-profiles/latest/v1', {cache:'no-store'}),
      fetch('https://api.dexscreener.com/token-boosts/latest/v1', {cache:'no-store'}),
    ])

    const profiles = profilesRes.ok ? await profilesRes.json().catch(()=>[]) : []
    const boosts = boostsRes.ok ? await boostsRes.json().catch(()=>[]) : []

    const addresses = [...new Set([
      ...(Array.isArray(profiles) ? profiles : []).map((p:any) => p?.tokenAddress),
      ...(Array.isArray(boosts) ? boosts : []).map((b:any) => b?.tokenAddress),
    ])].filter(Boolean) as string[]

    if (addresses.length === 0) return NextResponse.json({ coins: [], error: 'No addresses' })

    const pairsRes = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${addresses.slice(0,30).join(',')}`,
      {cache:'no-store'}
    )
    if (!pairsRes.ok) return NextResponse.json({ coins: [], error: 'DexScreener error' })

    const pairsData = await pairsRes.json().catch(()=>({}))
    const allPairs = pairsData?.pairs || []

    // Best pair per token
    const bestPair: Record<string,any> = {}
    allPairs.forEach((p:any) => {
      const key = p.baseToken?.address
      if (!key) return
      const vol = parseFloat(p.volume?.h24 || 0)
      if (!bestPair[key] || vol > parseFloat(bestPair[key].volume?.h24 || 0)) {
        bestPair[key] = p
      }
    })

    const coins = Object.values(bestPair).map((p:any) => {
      const createdAt = p.pairCreatedAt ? Number(p.pairCreatedAt) : 0
      const ageHours = createdAt ? Math.max(0, (Date.now() - createdAt) / 3600000) : 999
      const buys = p.txns?.h1?.buys || 0
      const sells = p.txns?.h1?.sells || 0
      const hasTwitter = p.info?.socials?.some((s:any) => s.type === 'twitter')
      const hasTelegram = p.info?.socials?.some((s:any) => s.type === 'telegram')

      return {
        coinId: p.baseToken?.address || p.pairAddress,
        pairAddress: p.pairAddress,
        name: p.baseToken?.name || 'Unknown',
        symbol: p.baseToken?.symbol || '???',
        chain: p.chainId || 'solana',
        chainId: p.chainId || 'solana',
        price: p.priceUsd,
        priceUsd: p.priceUsd,
        image: p.info?.imageUrl || null,
        url: `https://dexscreener.com/${p.chainId}/${p.baseToken?.address}`,
        ageHours,
        liquidity: { usd: parseFloat(p.liquidity?.usd || 0) },
        marketCap: parseFloat(p.marketCap || 0),
        volume: { h24: parseFloat(p.volume?.h24 || 0), h1: parseFloat(p.volume?.h1 || 0) },
        priceChange: {
          h1: parseFloat(p.priceChange?.h1 || 0),
          h6: parseFloat(p.priceChange?.h6 || 0),
          h24: parseFloat(p.priceChange?.h24 || 0),
        },
        txns: p.txns,
        buyRatio: (buys+sells) > 0 ? buys/(buys+sells) : 0.5,
        buys, sells,
        info: p.info || {socials:[], websites:[]},
        baseToken: p.baseToken,
        hasTwitter,
        hasTelegram,
        hasSocials: hasTwitter || hasTelegram,
      }
    })
    .filter(c => {
      // Must have real liquidity
      if (parseFloat(c.liquidity?.usd || 0) < 2000) return false
      // Must have contract address
      if (!c.coinId) return false
      // Must have Twitter or Telegram
      if (!c.hasTwitter && !c.hasTelegram) return false
      // Under 48 hours
      if (c.ageHours > 48) return false
      return true
    })
    .map(c => {
      // Calculate profit potential score
      const h1 = parseFloat(c.priceChange?.h1 || 0)
      const h24 = parseFloat(c.priceChange?.h24 || 0)
      const liq = parseFloat(c.liquidity?.usd || 0)
      const buyRatio = c.buyRatio || 0.5
      const vol24 = parseFloat(c.volume?.h24 || 0)
      const ageHours = c.ageHours || 999

      let score = 0

      // 1. MOMENTUM (30pts) - moving up but not exploded
      if (h1 > 0 && h1 < 50) score += 30      // healthy growth
      else if (h1 > 50 && h1 < 150) score += 20 // good but getting hot
      else if (h1 > 150 && h1 < 500) score += 8  // already pumping
      else if (h1 < 0 && h1 > -30) score += 12  // small dip = buy opportunity
      else if (h1 <= -30) score += 5             // big dip = risky

      // 2. ENTRY TIMING (25pts)
      if (ageHours < 1) score += 25
      else if (ageHours < 2) score += 22
      else if (ageHours < 6) score += 15
      else if (ageHours < 12) score += 8
      else if (ageHours < 24) score += 3

      // 3. SAFETY (20pts)
      if (liq > 50000) score += 20
      else if (liq > 20000) score += 16
      else if (liq > 10000) score += 12
      else if (liq > 5000) score += 7
      else if (liq > 2000) score += 3
      if (buyRatio > 0.65) score += 5
      else if (buyRatio > 0.55) score += 3

      // 4. VOLUME (15pts)
      if (vol24 > 500000) score += 15
      else if (vol24 > 100000) score += 12
      else if (vol24 > 50000) score += 9
      else if (vol24 > 10000) score += 5
      else if (vol24 > 2000) score += 2

      // 5. NOT PUMPED YET (10pts)
      if (h24 < 50) score += 10      // barely moved = huge opportunity
      else if (h24 < 100) score += 8  // modest pump
      else if (h24 < 200) score += 5  // some pump
      else if (h24 < 500) score += 2  // already pumped
      else score += 0                  // way pumped = skip

      return { ...c, profitScore: Math.min(100, score) }
    })
    .sort((a, b) => b.profitScore - a.profitScore)

    return NextResponse.json({ coins, total: coins.length })

  } catch(e:any) {
    return NextResponse.json({ coins: [], error: e.message })
  }
}
