import { NextRequest, NextResponse } from 'next/server'

const ODDS_KEY = '21dc56ed56eb5bf7ddfbb44ba8de79c3'

const PROP_MARKETS: Record<string, string[]> = {
  baseball_mlb: ['batter_hits', 'batter_home_runs', 'batter_rbis', 'pitcher_strikeouts'],
  basketball_nba: ['player_points', 'player_rebounds', 'player_assists'],
  americanfootball_nfl: ['player_reception_yards', 'player_rushing_yards', 'player_pass_tds'],
}

export async function GET(req: NextRequest) {
  const sport = req.nextUrl.searchParams.get('sport') || 'baseball_mlb'
  const markets = PROP_MARKETS[sport] || PROP_MARKETS['baseball_mlb']

  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${ODDS_KEY}&regions=us&markets=${markets.join(',')}&oddsFormat=american`,
      { next: { revalidate: 300 } } // cache 5 mins
    )
    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: err, games: [] })
    }
    const data = await res.json()
    return NextResponse.json({ games: Array.isArray(data) ? data : [] })
  } catch(e: any) {
    return NextResponse.json({ error: e.message, games: [] })
  }
}
