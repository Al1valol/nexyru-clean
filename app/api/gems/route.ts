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
    .filter(c => c.coinId && (c.hasTwitter || c.hasTelegram))
    .sort((a,b) => {
      // Sort by score - prioritize fresh coins with good liquidity
      const scoreA = (a.ageHours < 6 ? 30 : a.ageHours < 24 ? 10 : 0) +
                     (parseFloat(a.liquidity?.usd||0) > 10000 ? 20 : 0) +
                     (a.buyRatio > 0.6 ? 15 : 0)
      const scoreB = (b.ageHours < 6 ? 30 : b.ageHours < 24 ? 10 : 0) +
                     (parseFloat(b.liquidity?.usd||0) > 10000 ? 20 : 0) +
                     (b.buyRatio > 0.6 ? 15 : 0)
      return scoreB - scoreA
    })

    console.log('Coins with socials:', coins.length, 'of', Object.keys(bestPair).length)
    return NextResponse.json({ coins, total: coins.length })

  } catch(e:any) {
    return NextResponse.json({ coins: [], error: e.message })
  }
}
