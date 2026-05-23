import { NextRequest, NextResponse } from 'next/server'

const API_KEY = '21dc56ed56eb5bf7ddfbb44ba8de79c3'

export async function GET(req: NextRequest) {
  try {
    const [mlbRes, nbaRes] = await Promise.all([
      fetch(`https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?apiKey=${API_KEY}&regions=us&markets=player_hits,player_home_runs,player_strikeouts,player_runs,player_rbis,player_hits_runs_rbis,player_walks,player_total_bases,player_pitcher_hits_allowed,player_pitcher_strikeouts,player_pitcher_walks,player_pitcher_earned_runs&oddsFormat=american`, { cache: 'no-store' }),
      fetch(`https://api.the-odds-api.com/v4/sports/basketball_nba/odds?apiKey=${API_KEY}&regions=us&markets=player_points,player_rebounds,player_assists&oddsFormat=american`, { cache: 'no-store' })
    ])

    console.log('MLB response status:', mlbRes.status)
    console.log('NBA response status:', nbaRes.status)

    const mlbGames = mlbRes.ok ? await mlbRes.json() : []
    const nbaGames = nbaRes.ok ? await nbaRes.json() : []

    const allGames = [
      ...(Array.isArray(mlbGames) ? mlbGames : []),
      ...(Array.isArray(nbaGames) ? nbaGames : []),
    ]

    return NextResponse.json({ games: allGames })
  } catch(e: any) {
    console.log('player-props error:', e.message)
    return NextResponse.json({ error: e.message, games: [] })
  }
}
