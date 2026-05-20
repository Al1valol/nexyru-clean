'use client'
import React, { useState, useEffect } from 'react'

interface Player {
  id: number
  name?: string
  first_name?: string
  last_name?: string
  team?: string
  avg?: any
  homeRuns?: number
  rbi?: number
  hits?: number
  ops?: string
  runs?: number
  atBats?: number
}

export default function PlayerStatsDashboard() {
  const [sport, setSport] = useState<'nba'|'mlb'>('nba')
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [propLines, setPropLines] = useState<Record<string,string>>({})

  const s = {
    card: '#111111', border: '#1e1e2a', green: '#22c55e',
    red: '#ef4444', muted: '#6b7280', accent: '#6366f1'
  }

  const fetchPlayers = async (q = '') => {
    setLoading(true)
    setPlayers([])
    try {
      const url = sport === 'nba'
        ? `/api/players?sport=nba&search=${q || 'lebron'}`
        : `/api/players?sport=mlb`
      const res = await fetch(url)
      const data = await res.json()
      if (sport === 'nba') {
        setPlayers((data.data || []).sort((a:any,b:any) => (b.avg?.pts||0)-(a.avg?.pts||0)))
      } else {
        setPlayers((data.players || []).sort((a:any,b:any) => (b.homeRuns||0)-(a.homeRuns||0)))
      }
    } catch(e) { setPlayers([]) }
    setLoading(false)
  }

  useEffect(() => { fetchPlayers() }, [sport])

  const addPaperBet = (playerName: string, propType: string, line: string, side: string) => {
    const bet = {
      id: Date.now(), type:'prop',
      sport: sport.toUpperCase(),
      game: playerName + ' — ' + propType,
      pick: side + ' ' + line + ' ' + propType,
      odds: -110, book:'DraftKings', stake:100, potWin:90.9,
      status:'pending', placedAt: new Date().toISOString(),
      notes: 'Prop bet: ' + side + ' ' + line
    }
    const ex = JSON.parse(localStorage.getItem('nexyru_value_bets')||'[]')
    localStorage.setItem('nexyru_value_bets', JSON.stringify([bet,...ex]))
    alert('Added to paper bets! ✅')
  }

  const PropHelper = ({ player }: { player: Player }) => {
    const isNBA = sport === 'nba'
    const props = isNBA ? [
      { key:'pts', label:'Points', avg: player.avg?.pts?.toFixed(1) },
      { key:'reb', label:'Rebounds', avg: player.avg?.reb?.toFixed(1) },
      { key:'ast', label:'Assists', avg: player.avg?.ast?.toFixed(1) },
    ] : [
      { key:'hits', label:'Hits/Game', avg: ((player.hits||0)/((player.atBats||1)/3.3)).toFixed(2) },
      { key:'hr', label:'HR/Game', avg: ((player.homeRuns||0)/162).toFixed(3) },
      { key:'rbi', label:'RBI/Game', avg: ((player.rbi||0)/162).toFixed(2) },
    ]

    const playerName = isNBA
      ? ((player.first_name||'') + ' ' + (player.last_name||'')).trim()
      : (player.name || '')

    return (
      <div style={{background:'rgba(99,102,241,0.05)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:10, padding:14, marginTop:10}}>
        <div style={{fontSize:13, fontWeight:700, color:'#a5b4fc', marginBottom:10}}>
          🎯 Prop Bet Helper — {playerName}
        </div>
        {props.map(prop => {
          const line = parseFloat(propLines[prop.key]||'')
          const avg = parseFloat(prop.avg||'0')
          const diff = avg - line
          const rec = !propLines[prop.key] ? null
            : Math.abs(diff) < (isNBA ? 1 : 0.1) ? {text:'TOO CLOSE', color:s.muted}
            : diff > (isNBA ? 1.5 : 0.1) ? {text:'✅ OVER', color:s.green}
            : {text:'⬇️ UNDER', color:s.red}
          return (
            <div key={prop.key} style={{display:'flex', alignItems:'center', gap:10, marginBottom:8, flexWrap:'wrap'}}>
              <div style={{fontSize:12, color:'#9ca3af', width:90}}>{prop.label}</div>
              <div style={{fontSize:12, color:s.muted}}>Avg: <strong style={{color:'#fff'}}>{prop.avg}</strong></div>
              <input
                placeholder="Line"
                value={propLines[prop.key]||''}
                onChange={e => setPropLines(prev => ({...prev, [prop.key]: e.target.value}))}
                style={{width:70, padding:'4px 8px', borderRadius:6, border:`1px solid ${s.border}`, background:'#1a1a24', color:'#fff', fontSize:12, outline:'none'}}
              />
              {rec && <span style={{fontSize:13, fontWeight:800, color:rec.color}}>{rec.text}</span>}
              {rec && rec.text !== 'TOO CLOSE' && (
                <button onClick={() => addPaperBet(playerName, prop.label, propLines[prop.key], rec.text.includes('OVER') ? 'OVER' : 'UNDER')}
                  style={{padding:'4px 10px', borderRadius:6, border:'none', background:'rgba(99,102,241,0.2)', color:'#a5b4fc', fontSize:11, fontWeight:700, cursor:'pointer'}}>
                  + Paper Bet
                </button>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div>
      {/* Sport switcher */}
      <div style={{display:'flex', gap:8, marginBottom:16}}>
        {[{id:'nba',label:'🏀 NBA'},{id:'mlb',label:'⚾ MLB'}].map(sp => (
          <button key={sp.id} onClick={() => { setSport(sp.id as any); setSelectedPlayer(null); setPropLines({}) }}
            style={{padding:'8px 16px', borderRadius:8, border:`1px solid ${sport===sp.id?s.accent:s.border}`,
            background: sport===sp.id?'rgba(99,102,241,0.15)':'transparent',
            color: sport===sp.id?'#a5b4fc':'#6b7280', fontSize:13, fontWeight:sport===sp.id?700:400, cursor:'pointer'}}>
            {sp.label}
          </button>
        ))}
      </div>

      {/* Search (NBA only) */}
      {sport === 'nba' && (
        <div style={{display:'flex', gap:8, marginBottom:16}}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            onKeyDown={e => e.key==='Enter' && fetchPlayers(search)}
            placeholder="Search players (e.g. curry, jokic)..."
            style={{flex:1, padding:'8px 12px', borderRadius:8, border:`1px solid ${s.border}`, background:'#1a1a24', color:'#fff', fontSize:13, outline:'none'}}/>
          <button onClick={() => fetchPlayers(search)}
            style={{padding:'8px 16px', borderRadius:8, border:'none', background:s.accent, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer'}}>
            Search
          </button>
        </div>
      )}

      {/* Players */}
      {loading ? (
        <div style={{color:s.muted, padding:32, textAlign:'center'}}>Loading {sport.toUpperCase()} stats...</div>
      ) : players.length === 0 ? (
        <div style={{color:s.muted, padding:32, textAlign:'center'}}>No players found</div>
      ) : players.map((player, i) => {
        const isNBA = sport === 'nba'
        const playerName = isNBA
          ? ((player.first_name||'') + ' ' + (player.last_name||'')).trim() || 'Player '+i
          : (player.name || 'Player '+i)
        const isSelected = selectedPlayer?.id === player.id

        return (
          <div key={player.id||i}>
            <div onClick={() => { setSelectedPlayer(isSelected?null:player); setPropLines({}) }}
              style={{background: isSelected?'rgba(99,102,241,0.08)':s.card,
              border:`1px solid ${isSelected?'rgba(99,102,241,0.3)':s.border}`,
              borderRadius:12, padding:16, marginBottom: isSelected?0:10, cursor:'pointer'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12}}>
                <div>
                  <div style={{fontSize:15, fontWeight:700}}>{playerName}</div>
                  <div style={{fontSize:12, color:s.muted}}>{isNBA ? (player.avg?.team_abbreviation || 'NBA') : player.team} {isNBA ? `· ${player.avg?.games_played||0} GP` : ''}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:28, fontWeight:800, color: isNBA?'#60a5fa':'#f59e0b'}}>
                    {isNBA ? player.avg?.pts?.toFixed(1) : player.homeRuns}
                  </div>
                  <div style={{fontSize:10, color:s.muted}}>{isNBA?'PPG':'HR'}</div>
                </div>
              </div>

              {isNBA ? (
                <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8}}>
                  {[
                    {label:'REB', value: player.avg?.reb?.toFixed(1)},
                    {label:'AST', value: player.avg?.ast?.toFixed(1)},
                    {label:'MIN', value: player.avg?.min},
                    {label:'FG%', value: player.avg?.fg_pct ? (player.avg.fg_pct*100).toFixed(1)+'%' : 'N/A'},
                  ].map(stat => (
                    <div key={stat.label} style={{background:'#1a1a24', borderRadius:6, padding:8, textAlign:'center'}}>
                      <div style={{fontSize:13, fontWeight:700}}>{stat.value||'—'}</div>
                      <div style={{fontSize:10, color:s.muted}}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8}}>
                  {[
                    {label:'AVG', value: player.avg},
                    {label:'RBI', value: player.rbi},
                    {label:'OPS', value: player.ops},
                    {label:'R', value: player.runs},
                  ].map(stat => (
                    <div key={stat.label} style={{background:'#1a1a24', borderRadius:6, padding:8, textAlign:'center'}}>
                      <div style={{fontSize:13, fontWeight:700}}>{stat.value||'—'}</div>
                      <div style={{fontSize:10, color:s.muted}}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {isSelected && <PropHelper player={player} />}
            {isSelected && <div style={{marginBottom:10}}/>}
          </div>
        )
      })}
    </div>
  )
}
