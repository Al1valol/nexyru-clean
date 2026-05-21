import { NextRequest, NextResponse } from 'next/server'

const ODDS_KEY = '21dc56ed56eb5bf7ddfbb44ba8de79c3'

export async function GET(req: NextRequest) {
  const sport = req.nextUrl.searchParams.get('sport') || 'baseball_mlb'

  // Fetch each market separately since the API requires individual market calls for props
  const markets = sport === 'baseball_mlb'
    ? ['batter_hits', 'batter_home_runs', 'pitcher_strikeouts', 'batter_rbis']
    : sport === 'basketball_nba'
    ? ['player_points', 'player_rebounds', 'player_assists']
    : ['batter_hits', 'batter_home_runs']

  try {
    const allGames: any[] = []

    for (const market of markets) {
      try {
        const res = await fetch(
          `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${ODDS_KEY}&regions=us&markets=${market}&oddsFormat=american`,
          { cache: 'no-store' }
        )
        if (!res.ok) continue
        const data = await res.json()
        if (!Array.isArray(data)) continue

        // Merge market data into games
        data.forEach((game: any) => {
          const existing = allGames.find(g => g.id === game.id)
          if (existing) {
            game.bookmakers?.forEach((bk: any) => {
              const existingBk = existing.bookmakers?.find((b: any) => b.key === bk.key)
              if (existingBk) {
                existingBk.markets = [...(existingBk.markets || []), ...(bk.markets || [])]
              } else {
                existing.bookmakers = [...(existing.bookmakers || []), bk]
              }
            })
          } else {
            allGames.push(game)
          }
        })
      } catch(e) {
        continue
      }
    }

    return NextResponse.json({ games: allGames })
  } catch(e: any) {
    return NextResponse.json({ error: e.message, games: [] })
  }
}
