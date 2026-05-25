import { NextResponse } from 'next/server'
export const maxDuration = 30

export async function GET() {
  try {
    const BIRDEYE_KEY = process.env.BIRDEYE_API_KEY || 'e969e629423e472aa5d9adc03fa7e49f'
    const birdeyeHeaders = {
      'X-API-KEY': BIRDEYE_KEY,
      'x-chain': 'solana',
      'Accept': 'application/json',
    }

    const now = Math.floor(Date.now() / 1000)
    const oneHourAgo = now - 3600
    const threeHoursAgo = now - 10800
    const sixHoursAgo = now - 21600

    // Fetch ALL sources in parallel
    const [
      birdeyeNew,
      birdeye1h,
      birdeye3h,
      birdeye6h,
      dexProfiles,
      dexBoosts,
    ] = await Promise.allSettled([
      // Birdeye - 4 time windows = 80 coins
      fetch('https://public-api.birdeye.so/defi/v2/tokens/new_listing?limit=20', { headers: birdeyeHeaders, cache: 'no-store' }),
      fetch(`https://public-api.birdeye.so/defi/v2/tokens/new_listing?limit=20&max_liquidity_added_at=${oneHourAgo}`, { headers: birdeyeHeaders, cache: 'no-store' }),
      fetch(`https://public-api.birdeye.so/defi/v2/tokens/new_listing?limit=20&max_liquidity_added_at=${threeHoursAgo}`, { headers: birdeyeHeaders, cache: 'no-store' }),
      fetch(`https://public-api.birdeye.so/defi/v2/tokens/new_listing?limit=20&max_liquidity_added_at=${sixHoursAgo}`, { headers: birdeyeHeaders, cache: 'no-store' }),
      // DexScreener - profiles and boosts
      fetch('https://api.dexscreener.com/token-profiles/latest/v1'),
      fetch('https://api.dexscreener.com/token-boosts/latest/v1'),
    ])

    // Parse Birdeye results
    const parseBirdeye = async (result: PromiseSettledResult<Response>) => {
      if (result.status !== 'fulfilled' || !result.value.ok) return []
      const d = await result.value.json().catch(() => ({}))
      return d?.data?.items || []
    }

    const [b1, b2, b3, b4] = await Promise.all([
      parseBirdeye(birdeyeNew),
      parseBirdeye(birdeye1h),
      parseBirdeye(birdeye3h),
      parseBirdeye(birdeye6h),
    ])

    // Parse DexScreener results
    const parseJson = async (result: PromiseSettledResult<Response>) => {
      if (result.status !== 'fulfilled') return []
      const d = await result.value.json().catch(() => [])
      return Array.isArray(d) ? d : []
    }

    const [profiles, boosts] = await Promise.all([
      parseJson(dexProfiles),
      parseJson(dexBoosts),
    ])

    // Convert Birdeye tokens to our format
    const birdeyeTokens = [...b1, ...b2, ...b3, ...b4]
    const seen = new Set<string>()
    const uniqueBirdeye = birdeyeTokens.filter(t => {
      if (!t.address || seen.has(t.address)) return false
      seen.add(t.address)
      return true
    })

    // Get DexScreener addresses
    const dexAddresses = [
      ...profiles.map((p: any) => p?.tokenAddress),
      ...boosts.map((b: any) => b?.tokenAddress),
    ].filter((a): a is string => !!a && !seen.has(a))

    // Remove dupes from dex addresses too
    const uniqueDexAddresses = [...new Set(dexAddresses)].slice(0, 30)

    // Fetch pair data for DexScreener addresses
    let dexPairs: any[] = []
    if (uniqueDexAddresses.length > 0) {
      const pairsRes = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${uniqueDexAddresses.join(',')}`,
        { cache: 'no-store' }
      )
      if (pairsRes.ok) {
        const pairsData = await pairsRes.json().catch(() => ({}))
        const allPairs = pairsData?.pairs || []
        // Best pair per token
        const bestPair: Record<string, any> = {}
        allPairs.forEach((p: any) => {
          const key = p.baseToken?.address
          if (!key) return
          const vol = parseFloat(p.volume?.h24 || 0)
          if (!bestPair[key] || vol > parseFloat(bestPair[key].volume?.h24 || 0)) {
            bestPair[key] = p
          }
        })
        dexPairs = Object.values(bestPair)
      }
    }

    // Convert DexScreener pairs to our format
    const dexCoins = dexPairs.map((p: any) => {
      const createdAt = p.pairCreatedAt ? Number(p.pairCreatedAt) : 0
      const ageHours = createdAt ? Math.max(0, (Date.now() - createdAt) / 3600000) : 999
      const buys = p.txns?.h1?.buys || 0
      const sells = p.txns?.h1?.sells || 0
      return {
        coinId: p.baseToken?.address || p.pairAddress,
        pairAddress: p.pairAddress,
        name: p.baseToken?.name || 'Unknown',
        symbol: p.baseToken?.symbol || '???',
        chain: 'solana',
        chainId: 'solana',
        price: p.priceUsd,
        priceUsd: p.priceUsd,
        image: p.info?.imageUrl || null,
        url: `https://dexscreener.com/solana/${p.baseToken?.address}`,
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
        buyRatio: (buys + sells) > 0 ? buys / (buys + sells) : 0.5,
        buys, sells,
        info: p.info || { socials: [], websites: [] },
        baseToken: p.baseToken,
      }
    })

    // Convert Birdeye tokens to our format
    const birdeyeCoins = uniqueBirdeye.map((token: any) => {
      const createdAt = token.liquidityAddedAt ? new Date(token.liquidityAddedAt).getTime() : 0
      const ageHours = createdAt ? Math.max(0, (Date.now() - createdAt) / 3600000) : 999
      return {
        coinId: token.address,
        pairAddress: token.address,
        name: token.name || 'Unknown',
        symbol: token.symbol || '???',
        chain: 'solana',
        chainId: 'solana',
        price: '0',
        priceUsd: '0',
        image: token.logoURI || null,
        url: `https://dexscreener.com/solana/${token.address}`,
        ageHours,
        liquidity: { usd: token.liquidity || 0 },
        marketCap: 0,
        volume: { h24: 0, h1: 0 },
        priceChange: { h1: 0, h6: 0, h24: 0 },
        txns: { h1: { buys: 0, sells: 0 } },
        buyRatio: 0.5,
        buys: 0, sells: 0,
        info: { socials: [], websites: [] },
        baseToken: { address: token.address, name: token.name, symbol: token.symbol },
      }
    })

    // Merge all coins, dedupe by coinId
    const allCoins: Record<string, any> = {}

    // DexScreener coins have better data (price, volume, txns) — add first
    dexCoins.forEach(c => { if (c.coinId) allCoins[c.coinId] = c })

    // Birdeye fills in coins not in DexScreener
    birdeyeCoins.forEach(c => {
      if (c.coinId && !allCoins[c.coinId]) allCoins[c.coinId] = c
    })

    const coins = Object.values(allCoins)
      .filter(c => c.ageHours < 24 && parseFloat(c.liquidity?.usd || 0) > 500)

    console.log('Total coins:', coins.length, '(Birdeye:', uniqueBirdeye.length, 'DexScreener:', dexCoins.length, ')')
    return NextResponse.json({ coins, total: coins.length })

  } catch(e: any) {
    console.error('gems error:', e.message)
    return NextResponse.json({ coins: [], error: e.message })
  }
}
