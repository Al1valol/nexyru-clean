import { NextResponse } from 'next/server'
export const maxDuration = 30

export async function GET() {
  try {
    const BIRDEYE_KEY = process.env.BIRDEYE_API_KEY || 'e969e629423e472aa5d9adc03fa7e49f'
    const now = Math.floor(Date.now() / 1000)

    // Fetch all sources in parallel
    const [profilesRes, boostsRes, b1Res, b2Res, b3Res] = await Promise.allSettled([
      fetch('https://api.dexscreener.com/token-profiles/latest/v1'),
      fetch('https://api.dexscreener.com/token-boosts/latest/v1'),
      fetch('https://public-api.birdeye.so/defi/v2/tokens/new_listing?limit=20', {
        headers: { 'X-API-KEY': BIRDEYE_KEY, 'x-chain': 'solana', 'Accept': 'application/json' },
        cache: 'no-store'
      }),
      fetch(`https://public-api.birdeye.so/defi/v2/tokens/new_listing?limit=20&max_liquidity_added_at=${now - 7200}`, {
        headers: { 'X-API-KEY': BIRDEYE_KEY, 'x-chain': 'solana', 'Accept': 'application/json' },
        cache: 'no-store'
      }),
      fetch(`https://public-api.birdeye.so/defi/v2/tokens/new_listing?limit=20&max_liquidity_added_at=${now - 14400}`, {
        headers: { 'X-API-KEY': BIRDEYE_KEY, 'x-chain': 'solana', 'Accept': 'application/json' },
        cache: 'no-store'
      }),
    ])

    // Parse DexScreener sources
    const getJson = async (r: PromiseSettledResult<Response>) => {
      if (r.status !== 'fulfilled' || !r.value.ok) return []
      return r.value.json().catch(() => [])
    }
    const [profiles, boosts] = await Promise.all([getJson(profilesRes), getJson(boostsRes)])

    // Get all DexScreener addresses
    const dexAddresses = [...new Set([
      ...(Array.isArray(profiles) ? profiles : []).map((p: any) => p?.tokenAddress),
      ...(Array.isArray(boosts) ? boosts : []).map((b: any) => b?.tokenAddress),
    ])].filter(Boolean).slice(0, 30) as string[]

    // Fetch full pair data from DexScreener (has socials, price, volume)
    let dexCoins: any[] = []
    if (dexAddresses.length > 0) {
      const pairsRes = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${dexAddresses.join(',')}`,
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

        dexCoins = Object.values(bestPair).map((p: any) => {
          const createdAt = p.pairCreatedAt ? Number(p.pairCreatedAt) : 0
          const ageHours = createdAt ? Math.max(0, (Date.now() - createdAt) / 3600000) : 999
          const buys = p.txns?.h1?.buys || 0
          const sells = p.txns?.h1?.sells || 0
          const hasTwitter = p.info?.socials?.some((s: any) => s.type === 'twitter')
          const hasTelegram = p.info?.socials?.some((s: any) => s.type === 'telegram')
          const hasWebsite = (p.info?.websites || []).length > 0

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
            volume: {
              h24: parseFloat(p.volume?.h24 || 0),
              h1: parseFloat(p.volume?.h1 || 0),
            },
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
            hasSocials: hasTwitter || hasTelegram || hasWebsite,
            hasTwitter,
            hasTelegram,
          }
        })
        // Filter: must have at least Twitter OR Telegram
        .filter(c => c.hasTwitter || c.hasTelegram)
      }
    }

    // Parse Birdeye for additional coins (no social filter since no social data)
    const getBirdeyeItems = async (r: PromiseSettledResult<Response>) => {
      if (r.status !== 'fulfilled' || !r.value.ok) return []
      const d = await r.value.json().catch(() => ({}))
      return d?.data?.items || []
    }

    const [b1, b2, b3] = await Promise.all([
      getBirdeyeItems(b1Res),
      getBirdeyeItems(b2Res),
      getBirdeyeItems(b3Res),
    ])

    // Only use Birdeye coins that are NOT already in dexCoins
    const dexIds = new Set(dexCoins.map(c => c.coinId))
    const birdeyeExtra = [...b1, ...b2, ...b3]
      .filter((t: any) => t.address && !dexIds.has(t.address))
      .filter((t: any) => (t.liquidity || 0) > 2000) // Only decent liquidity
      .slice(0, 20) // Cap at 20 extra
      .map((token: any) => {
        const createdAt = token.liquidityAddedAt ? new Date(token.liquidityAddedAt).getTime() : 0
        const ageHours = createdAt ? Math.max(0, (Date.now() - createdAt) / 3600000) : 999
        return {
          coinId: token.address,
          pairAddress: token.address,
          name: token.name || 'Unknown',
          symbol: token.symbol || '???',
          chain: 'solana', chainId: 'solana',
          price: '0', priceUsd: '0',
          image: token.logoURI || null,
          url: `https://dexscreener.com/solana/${token.address}`,
          ageHours,
          liquidity: { usd: token.liquidity || 0 },
          marketCap: 0,
          volume: { h24: 0, h1: 0 },
          priceChange: { h1: 0, h6: 0, h24: 0 },
          txns: { h1: { buys: 0, sells: 0 } },
          buyRatio: 0.5, buys: 0, sells: 0,
          info: { socials: [], websites: [] },
          baseToken: { address: token.address, name: token.name, symbol: token.symbol },
          hasSocials: false, hasTwitter: false, hasTelegram: false,
        }
      })

    // Only DexScreener coins with Twitter
    const allCoins = dexCoins
      .filter(c => c.coinId && c.ageHours < 48 && parseFloat(c.liquidity?.usd || 0) > 500)

    console.log('Coins with socials:', dexCoins.length, 'Birdeye extra:', birdeyeExtra.length)
    return NextResponse.json({ coins: allCoins, total: allCoins.length })

  } catch(e: any) {
    console.error('gems error:', e.message)
    return NextResponse.json({ coins: [], error: e.message })
  }
}
