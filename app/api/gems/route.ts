import { NextResponse } from 'next/server'
export const maxDuration = 30

export async function GET() {
  try {
    const API_KEY = process.env.BIRDEYE_API_KEY || 'e969e629423e472aa5d9adc03fa7e49f'
    const headers = {
      'X-API-KEY': API_KEY,
      'x-chain': 'solana',
      'Accept': 'application/json',
    }

    // Fetch 3 batches - newest, 1 hour ago, 6 hours ago
    const now = Math.floor(Date.now() / 1000)
    const oneHourAgo = now - 3600
    const sixHoursAgo = now - 21600

    const [batch1, batch2, batch3] = await Promise.all([
      // Newest coins (last few minutes)
      fetch('https://public-api.birdeye.so/defi/v2/tokens/new_listing?limit=20',
        { headers, cache: 'no-store' }),
      // Coins from ~1 hour ago
      fetch(`https://public-api.birdeye.so/defi/v2/tokens/new_listing?limit=20&max_liquidity_added_at=${oneHourAgo}`,
        { headers, cache: 'no-store' }),
      // Coins from ~6 hours ago
      fetch(`https://public-api.birdeye.so/defi/v2/tokens/new_listing?limit=20&max_liquidity_added_at=${sixHoursAgo}`,
        { headers, cache: 'no-store' }),
    ])

    const [data1, data2, data3] = await Promise.all([
      batch1.ok ? batch1.json() : { data: { items: [] } },
      batch2.ok ? batch2.json() : { data: { items: [] } },
      batch3.ok ? batch3.json() : { data: { items: [] } },
    ])

    // Combine all items and dedupe by address
    const seen = new Set<string>()
    const allTokens = [
      ...(data1?.data?.items || []),
      ...(data2?.data?.items || []),
      ...(data3?.data?.items || []),
    ].filter(t => {
      if (!t.address || seen.has(t.address)) return false
      seen.add(t.address)
      return true
    })

    console.log('Total unique tokens:', allTokens.length)

    if (allTokens.length === 0) {
      return NextResponse.json({ coins: [], error: 'No tokens returned' })
    }

    // Step 2: Get price/volume data for all tokens at once
    const addresses = allTokens.map((t: any) => t.address).join(',')
    const priceRes = await fetch(
      `https://public-api.birdeye.so/defi/multi_price?list_address=${addresses}`,
      { headers, cache: 'no-store' }
    )

    const priceData = priceRes.ok ? await priceRes.json() : {}
    const prices = priceData?.data || {}

    // Step 3: Convert to coin format
    const coins = allTokens.map((token: any) => {
      const priceInfo = prices[token.address] || {}

      // Parse age from liquidityAddedAt ISO string
      const createdAt = token.liquidityAddedAt
        ? new Date(token.liquidityAddedAt).getTime()
        : 0
      const ageMs = createdAt ? Date.now() - createdAt : 999 * 3600000
      const ageHours = Math.max(0, ageMs / 3600000)

      const price = priceInfo.value || priceInfo.price || 0
      const priceChange1h = priceInfo.priceChange1h || priceInfo.priceChangePercent1h || 0
      const priceChange24h = priceInfo.priceChange24h || priceInfo.priceChangePercent24h || 0
      const liq = token.liquidity || 0

      return {
        coinId: token.address,
        pairAddress: token.address,
        name: token.name || 'Unknown',
        symbol: token.symbol || '???',
        chain: 'solana',
        chainId: 'solana',
        price: String(price),
        priceUsd: String(price),
        image: token.logoURI || null,
        url: `https://dexscreener.com/solana/${token.address}`,
        ageHours,
        liquidity: { usd: liq },
        marketCap: 0,
        volume: { h24: 0, h1: 0 },
        priceChange: {
          h1: priceChange1h,
          h6: 0,
          h24: priceChange24h,
        },
        txns: { h1: { buys: 0, sells: 0 } },
        buyRatio: 0.5,
        buys: 0,
        sells: 0,
        score: 0,
        snipeWindow: { id: 'watch', label: 'Watch', color: '#6b7280' },
        info: {
          socials: [],
          websites: [],
          imageUrl: token.logoURI
        },
        baseToken: {
          address: token.address,
          name: token.name,
          symbol: token.symbol,
        },
      }
    }).filter((c: any) => c.coinId && c.ageHours < 48)

    return NextResponse.json({ coins, total: coins.length })

  } catch(e: any) {
    return NextResponse.json({ coins: [], error: e.message })
  }
}
