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

    // Step 1: Get newest 50 token listings
    const listRes = await fetch(
      'https://public-api.birdeye.so/defi/v2/tokens/new_listing?limit=50',
      { headers, cache: 'no-store' }
    )

    const responseText = await listRes.text()
    console.log('Birdeye status:', listRes.status)
    console.log('Birdeye response:', responseText.substring(0, 300))
    console.log('API key used:', API_KEY.substring(0, 8) + '...')

    if (!listRes.ok) {
      return NextResponse.json({
        coins: [],
        error: 'Birdeye error: ' + listRes.status,
        detail: responseText.substring(0, 200),
        keyPrefix: API_KEY.substring(0, 8)
      })
    }

    const listData = JSON.parse(responseText)
    const tokens = listData?.data?.items || []

    if (tokens.length === 0) {
      return NextResponse.json({ coins: [], error: 'No tokens returned' })
    }

    // Step 2: Get price/volume data for all tokens at once
    const addresses = tokens.map((t: any) => t.address).join(',')
    const priceRes = await fetch(
      `https://public-api.birdeye.so/defi/multi_price?list_address=${addresses}`,
      { headers, cache: 'no-store' }
    )

    const priceData = priceRes.ok ? await priceRes.json() : {}
    const prices = priceData?.data || {}

    // Step 3: Convert to coin format
    const coins = tokens.map((token: any) => {
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

    console.log('Returning', coins.length, 'coins')
    return NextResponse.json({ coins, total: coins.length })

  } catch(e: any) {
    console.error('gems error:', e.message)
    return NextResponse.json({ coins: [], error: e.message })
  }
}
