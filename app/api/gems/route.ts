import { NextResponse } from 'next/server'

export const maxDuration = 30

export async function GET() {
  try {
    const API_KEY = process.env.BIRDEYE_API_KEY || 'e969e629423e472aa5d9adc03fa7e49f'

    // Fetch new token listings from Birdeye — sorted by creation time
    const res = await fetch(
      'https://public-api.birdeye.so/defi/v2/tokens/new_listing?time_to=now&limit=50&meme_platform_enabled=true',
      {
        headers: {
          'X-API-KEY': API_KEY,
          'x-chain': 'solana',
          'Accept': 'application/json',
        },
        cache: 'no-store'
      }
    )

    if (!res.ok) {
      console.error('Birdeye error:', res.status, await res.text())
      return NextResponse.json({ coins: [], error: 'Birdeye API error: ' + res.status })
    }

    const data = await res.json()
    const tokens = data?.data?.items || data?.data || []

    console.log('Birdeye tokens:', tokens.length)

    // Convert to our coin format
    const coins = tokens.map((token: any) => {
      const ageMs = token.creation_time ? Date.now() - token.creation_time * 1000 : 999 * 3600000
      const ageHours = Math.max(0, ageMs / 3600000)

      return {
        coinId: token.address,
        pairAddress: token.address,
        name: token.name || 'Unknown',
        symbol: token.symbol || '???',
        chain: 'solana',
        chainId: 'solana',
        price: token.price || token.lastTradeUnixTime,
        priceUsd: String(token.price || 0),
        image: token.logoURI || null,
        url: `https://dexscreener.com/solana/${token.address}`,
        ageHours,
        liquidity: { usd: token.liquidity || 0 },
        marketCap: token.mc || 0,
        volume: { h24: token.v24hUSD || 0, h1: token.v1hUSD || 0 },
        priceChange: {
          h1: token.priceChange1hPercent || 0,
          h6: token.priceChange6hPercent || 0,
          h24: token.priceChange24hPercent || 0,
        },
        txns: {
          h1: {
            buys: token.buy1h || 0,
            sells: token.sell1h || 0,
          }
        },
        buyRatio: token.buy1h && token.sell1h
          ? token.buy1h / Math.max(token.buy1h + token.sell1h, 1)
          : 0.5,
        buys: token.buy1h || 0,
        sells: token.sell1h || 0,
        score: 0,
        snipeWindow: { id: 'watch', label: 'Watch', color: '#6b7280' },
        info: { socials: [], websites: [] },
        baseToken: {
          address: token.address,
          name: token.name,
          symbol: token.symbol
        },
      }
    }).filter((c: any) => c.coinId)

    return NextResponse.json({ coins, total: coins.length })
  } catch(e: any) {
    console.error('gems error:', e.message)
    return NextResponse.json({ coins: [], error: e.message })
  }
}
