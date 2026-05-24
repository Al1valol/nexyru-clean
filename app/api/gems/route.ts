import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Fetch from GeckoTerminal server-side (no CORS issues)
    const pages = await Promise.all(
      [1,2,3,4,5].map(page =>
        fetch(
          `https://api.geckoterminal.com/api/v2/networks/solana/new_pools?page=${page}&include=base_token`,
          {
            cache: 'no-store',
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0'
            }
          }
        ).then(r => r.json()).catch(() => ({}))
      )
    )

    // Build token map from included data
    const tokenMap: Record<string, any> = {}
    pages.forEach(pageData => {
      ;(pageData?.included || []).forEach((item: any) => {
        if (item.type === 'token' && item.attributes?.address) {
          tokenMap[item.attributes.address] = {
            address: item.attributes.address,
            name: item.attributes.name,
            symbol: item.attributes.symbol,
            image: item.attributes.image_url,
          }
        }
      })
    })

    const allPools = pages.flatMap(d => d?.data || [])

    // Dedupe by token address keeping highest volume pool
    const bestPoolPerToken: Record<string, any> = {}
    allPools.forEach(pool => {
      const baseTokenId = pool.relationships?.base_token?.data?.id || ''
      const tokenAddress = baseTokenId.replace('solana_', '')
      if (!tokenAddress) return
      const vol24 = parseFloat(pool.attributes?.volume_usd?.h24 || 0)
      const existing = bestPoolPerToken[tokenAddress]
      if (!existing || vol24 > parseFloat(existing.attributes?.volume_usd?.h24 || 0)) {
        bestPoolPerToken[tokenAddress] = { ...pool, tokenAddress }
      }
    })

    const pools = Object.values(bestPoolPerToken)

    // Convert to coin format
    const coins = pools.map((pool: any) => {
      const attr = pool.attributes
      const tokenAddress = pool.tokenAddress
      const tokenInfo = tokenMap[tokenAddress] || {}
      const name = tokenInfo.name || attr.name?.split(' / ')?.[0] || 'Unknown'
      const symbol = tokenInfo.symbol || name

      const m5 = parseFloat(attr.price_change_percentage?.m5 || 0)
      const m15 = parseFloat(attr.price_change_percentage?.m15 || 0)
      const m30 = parseFloat(attr.price_change_percentage?.m30 || 0)
      const h1 = parseFloat(attr.price_change_percentage?.h1 || 0)
      const h6 = parseFloat(attr.price_change_percentage?.h6 || 0)
      const h24 = parseFloat(attr.price_change_percentage?.h24 || 0)

      const liq = parseFloat(attr.reserve_in_usd || 0)
      const mc = parseFloat(attr.market_cap_usd || attr.fdv_usd || 0)
      const vol24 = parseFloat(attr.volume_usd?.h24 || 0)
      const vol1h = parseFloat(attr.volume_usd?.h1 || 0)

      const buys = attr.transactions?.h1?.buys || 0
      const sells = attr.transactions?.h1?.sells || 0
      const buyRatio = (buys + sells) > 0 ? buys / (buys + sells) : 0.5

      const createdAt = attr.pool_created_at ? new Date(attr.pool_created_at).getTime() : 0
      const ageMs = createdAt ? Date.now() - createdAt : 999 * 3600000
      const ageHours = Math.max(0, ageMs / 3600000)

      // Score
      let score = 0
      if (ageHours < 0.5) score += 25
      else if (ageHours < 1) score += 20
      else if (ageHours < 2) score += 15
      else if (ageHours < 6) score += 10
      else if (ageHours < 12) score += 5
      if (m5 > 20) score += 25
      else if (m5 > 10) score += 18
      else if (m5 > 5) score += 12
      else if (m5 > 0) score += 6
      if (buyRatio > 0.7) score += 20
      else if (buyRatio > 0.6) score += 14
      else if (buyRatio > 0.5) score += 8
      if (liq > 50000) score += 15
      else if (liq > 20000) score += 11
      else if (liq > 5000) score += 7
      else if (liq > 1000) score += 3
      if (vol1h > 100000) score += 15
      else if (vol1h > 50000) score += 11
      else if (vol1h > 10000) score += 7
      else if (vol1h > 1000) score += 3

      // Snipe window
      let snipeWindow = { id: 'watch', label: 'Watch', color: '#6b7280' }
      if (h24 > 1000 || h6 > 500) snipeWindow = { id: 'toolate', label: 'Too Late', color: '#ef4444' }
      else if (ageHours < 6 && h24 < 300 && buyRatio > 0.5) snipeWindow = { id: 'prime', label: 'Prime Snipe', color: '#22c55e' }
      else if (ageHours < 12 && h24 < 500) snipeWindow = { id: 'early', label: 'Early', color: '#f59e0b' }

      return {
        pairAddress: attr.address,
        coinId: tokenAddress,
        name, symbol,
        chain: 'solana', chainId: 'solana',
        price: attr.base_token_price_usd,
        priceUsd: attr.base_token_price_usd,
        image: tokenInfo.image || null,
        url: `https://dexscreener.com/solana/${tokenAddress}`,
        priceChange: { m5, m15, m30, h1, h6, h24 },
        volume: { m5: parseFloat(attr.volume_usd?.m5 || 0), h1: vol1h, h6: parseFloat(attr.volume_usd?.h6 || 0), h24: vol24 },
        txns: attr.transactions,
        liquidity: { usd: liq },
        marketCap: mc,
        ageHours, buyRatio, buys, sells,
        score: Math.min(100, score),
        snipeWindow,
        info: { socials: [], websites: [] },
        baseToken: { address: tokenAddress, name, symbol },
      }
    }).filter(c => c.ageHours <= 24 && (Number(c.liquidity?.usd) || 0) > 100)
     .sort((a, b) => b.score - a.score)

    return NextResponse.json({ coins, total: coins.length })
  } catch (e: any) {
    return NextResponse.json({ coins: [], error: e.message })
  }
}
