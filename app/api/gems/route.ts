import { NextResponse } from 'next/server'
export const maxDuration = 30

export async function GET() {
  try {
    const BIRDEYE_KEY = process.env.BIRDEYE_API_KEY || 'e969e629423e472aa5d9adc03fa7e49f'
    const bh = { 'X-API-KEY': BIRDEYE_KEY, 'x-chain': 'solana', 'Accept': 'application/json' }
    const now = Math.floor(Date.now() / 1000)

    // Fetch Birdeye at 6 different time windows to get coins from brand new to 24h old
    const birdeyeResults = await Promise.allSettled([
      fetch('https://public-api.birdeye.so/defi/v2/tokens/new_listing?limit=20&min_liquidity=1000', {headers:bh, cache:'no-store'}),
      fetch(`https://public-api.birdeye.so/defi/v2/tokens/new_listing?limit=20&min_liquidity=1000&max_liquidity_added_at=${now-3600}`, {headers:bh, cache:'no-store'}),
      fetch(`https://public-api.birdeye.so/defi/v2/tokens/new_listing?limit=20&min_liquidity=1000&max_liquidity_added_at=${now-7200}`, {headers:bh, cache:'no-store'}),
      fetch(`https://public-api.birdeye.so/defi/v2/tokens/new_listing?limit=20&min_liquidity=1000&max_liquidity_added_at=${now-14400}`, {headers:bh, cache:'no-store'}),
      fetch(`https://public-api.birdeye.so/defi/v2/tokens/new_listing?limit=20&min_liquidity=1000&max_liquidity_added_at=${now-28800}`, {headers:bh, cache:'no-store'}),
      fetch(`https://public-api.birdeye.so/defi/v2/tokens/new_listing?limit=20&min_liquidity=1000&max_liquidity_added_at=${now-57600}`, {headers:bh, cache:'no-store'}),
    ])

    // Parse all Birdeye results
    const allBirdeyeTokens: any[] = []
    for (const result of birdeyeResults) {
      if (result.status === 'fulfilled' && result.value.ok) {
        const d = await result.value.json().catch(() => ({}))
        allBirdeyeTokens.push(...(d?.data?.items || []))
      }
    }

    // Also add DexScreener profiles and boosts for coins WITH socials
    const [profilesRes, boostsRes] = await Promise.all([
      fetch('https://api.dexscreener.com/token-profiles/latest/v1', {cache:'no-store'}),
      fetch('https://api.dexscreener.com/token-boosts/latest/v1', {cache:'no-store'}),
    ])
    const profiles = profilesRes.ok ? await profilesRes.json().catch(()=>[]) : []
    const boosts = boostsRes.ok ? await boostsRes.json().catch(()=>[]) : []
    const dexAddresses = [...new Set([
      ...(Array.isArray(profiles) ? profiles : []).map((p:any) => p?.tokenAddress),
      ...(Array.isArray(boosts) ? boosts : []).map((b:any) => b?.tokenAddress),
    ])].filter(Boolean)

    // Combine all addresses - Birdeye + DexScreener
    const seen = new Set<string>()
    const birdeyeAddresses = allBirdeyeTokens
      .map((t:any) => t.address)
      .filter((a:any) => a && !seen.has(a) && seen.add(a))

    const allAddresses = [...new Set([...birdeyeAddresses, ...dexAddresses])]
    console.log('Total addresses to fetch:', allAddresses.length)

    // Fetch DexScreener data in batches of 30
    const batches = []
    for (let i = 0; i < allAddresses.length; i += 30) {
      batches.push(allAddresses.slice(i, i + 30))
    }

    const batchResults = await Promise.all(
      batches.map(batch =>
        fetch(`https://api.dexscreener.com/latest/dex/tokens/${batch.join(',')}`, {cache:'no-store'})
          .then(r => r.json())
          .then(d => d?.pairs || [])
          .catch(() => [])
      )
    )

    const allPairs = batchResults.flat()
    console.log('Total pairs from DexScreener:', allPairs.length)

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
      const buyRatio = (buys + sells) > 0 ? buys / (buys + sells) : 0.5
      const hasTwitter = p.info?.socials?.some((s:any) => s.type === 'twitter')
      const hasTelegram = p.info?.socials?.some((s:any) => s.type === 'telegram')
      const liq = parseFloat(p.liquidity?.usd || 0)
      const vol24 = parseFloat(p.volume?.h24 || 0)
      const h1 = parseFloat(p.priceChange?.h1 || 0)
      const h6 = parseFloat(p.priceChange?.h6 || 0)
      const h24 = parseFloat(p.priceChange?.h24 || 0)

      // Profit potential score
      let score = 0

      // Momentum (30pts)
      if (h1 > 0 && h1 < 50) score += 30
      else if (h1 > 50 && h1 < 150) score += 20
      else if (h1 > 150 && h1 < 500) score += 8
      else if (h1 < 0 && h1 > -30) score += 12
      else if (h1 <= -30) score += 5

      // Entry timing (25pts)
      if (ageHours < 1) score += 25
      else if (ageHours < 2) score += 22
      else if (ageHours < 6) score += 15
      else if (ageHours < 12) score += 10
      else if (ageHours < 24) score += 5
      else if (ageHours < 48) score += 2

      // Safety (20pts)
      if (liq > 50000) score += 12
      else if (liq > 20000) score += 9
      else if (liq > 10000) score += 6
      else if (liq > 3000) score += 3
      if (buyRatio > 0.65) score += 5
      else if (buyRatio > 0.55) score += 3
      if (hasTwitter) score += 2
      if (hasTelegram) score += 1

      // Volume (15pts)
      if (vol24 > 500000) score += 15
      else if (vol24 > 100000) score += 12
      else if (vol24 > 50000) score += 9
      else if (vol24 > 10000) score += 6
      else if (vol24 > 2000) score += 3

      // Not pumped (10pts)
      if (h24 < 50) score += 10
      else if (h24 < 100) score += 7
      else if (h24 < 200) score += 4
      else if (h24 < 500) score += 1

      // Dip bounce bonus
      const isDip = h6 < -10 && h1 > 0

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
        liquidity: { usd: liq },
        marketCap: parseFloat(p.marketCap || 0),
        volume: { h24: vol24, h1: parseFloat(p.volume?.h1 || 0) },
        priceChange: { h1, h6, h24 },
        txns: p.txns,
        buyRatio, buys, sells,
        info: p.info || { socials: [], websites: [] },
        baseToken: p.baseToken,
        hasTwitter, hasTelegram,
        hasSocials: hasTwitter || hasTelegram,
        isDip,
        profitScore: Math.min(100, score),
      }
    })
    .filter(c =>
      c.coinId &&
      parseFloat(c.liquidity?.usd || 0) > 1000 &&
      parseFloat(c.volume?.h24 || 0) > 500 &&
      c.ageHours < 48
    )
    .sort((a, b) => b.profitScore - a.profitScore)
    .slice(0, 100)

    console.log('Final coins:', coins.length)
    return NextResponse.json({ coins, total: coins.length })

  } catch(e:any) {
    console.error('gems error:', e.message)
    return NextResponse.json({ coins: [], error: e.message })
  }
}
