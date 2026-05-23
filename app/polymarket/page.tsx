'use client'
import { useState, useEffect, useCallback } from 'react'

interface Market {
  id: string
  question: string
  category: string
  endDate: string
  volume: number
  liquidity: number
  yesPrice: number
  noPrice: number
  probability: number
  active: boolean
  slug: string
  description?: string
  daysLeft: number
  trending: boolean
  aiAnalysis?: any
}

interface PaperBet {
  id: number
  marketId: string
  question: string
  pick: 'YES' | 'NO'
  price: number
  shares: number
  totalCost: number
  potentialWin: number
  status: 'open' | 'won' | 'lost'
  pnl?: number
  placedAt: string
  settledAt?: string
  category: string
}

export default function PolymarketPage() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(false)
  const [section, setSection] = useState<'markets'|'trades'|'learn'>('markets')
  const [category, setCategory] = useState('all')
  const [sortBy, setSortBy] = useState<'volume'|'probability'|'ending'>('volume')
  const [analysis, setAnalysis] = useState<Record<string,any>>({})
  const [analyzing, setAnalyzing] = useState<Record<string,boolean>>({})
  const [trades, setTrades] = useState<PaperBet[]>([])
  const [bankroll, setBankroll] = useState(1000)
  const [betModal, setBetModal] = useState<{market: Market, pick: 'YES'|'NO'} | null>(null)
  const [betShares, setBetShares] = useState('10')
  const [isMobile, setIsMobile] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem('polymarket_bets') || '[]')
      setTrades(t)
      const b = parseFloat(localStorage.getItem('polymarket_bankroll') || '1000')
      setBankroll(b)
    } catch {}
  }, [])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const C = {
    bg:'#080808', card:'#111', border:'#1e1e2a',
    green:'#22c55e', red:'#ef4444', accent:'#6366f1',
    muted:'#6b7280', yellow:'#f59e0b', text:'#fff'
  }

  const fetchMarkets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/polymarket')
      const data = await res.json()
      setMarkets(data.markets || [])
    } catch(e) {
      console.error(e)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchMarkets() }, [fetchMarkets])

  const analyzeMarket = async (market: Market) => {
    if (analyzing[market.id] || analysis[market.id]) return
    setAnalyzing(prev => ({...prev, [market.id]: true}))
    try {
      const res = await fetch('/api/analyze-game', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          team1: 'YES',
          team2: 'NO',
          sport: 'PREDICTION',
          odds1: 0, odds2: 0,
          gameTime: market.endDate,
          context: `Prediction market analysis. Question: "${market.question}". Current YES price: ${(market.yesPrice*100).toFixed(1)}% (market gives ${(market.probability*100).toFixed(1)}% chance of YES). Volume: $${(market.volume/1000).toFixed(0)}k. Days remaining: ${market.daysLeft}. Category: ${market.category}. Should someone bet YES or NO on this market? Is the crowd probability correct or is there value on either side?`
        })
      })
      const data = await res.json()
      setAnalysis(prev => ({...prev, [market.id]: data}))
    } catch(e) {}
    setAnalyzing(prev => ({...prev, [market.id]: false}))
  }

  const placeBet = (market: Market, pick: 'YES'|'NO') => {
    const shares = parseFloat(betShares) || 10
    const price = pick === 'YES' ? market.yesPrice : market.noPrice
    const totalCost = shares * price
    const potentialWin = shares * 1

    const bet: PaperBet = {
      id: Date.now(),
      marketId: market.id,
      question: market.question,
      pick, price, shares, totalCost, potentialWin,
      status: 'open',
      placedAt: new Date().toISOString(),
      category: market.category
    }

    const updated = [bet, ...trades]
    setTrades(updated)
    localStorage.setItem('polymarket_bets', JSON.stringify(updated))
    const nb = bankroll - totalCost
    setBankroll(nb)
    localStorage.setItem('polymarket_bankroll', String(nb))
    setBetModal(null)
    setSection('trades')
  }

  const settleBet = (id: number, result: 'won'|'lost') => {
    const bet = trades.find(t => t.id === id)
    if (!bet) return
    const pnl = result === 'won' ? bet.potentialWin - bet.totalCost : -bet.totalCost
    const updated = trades.map(t => t.id === id ? {...t, status: result, pnl, settledAt: new Date().toISOString()} : t)
    setTrades(updated)
    localStorage.setItem('polymarket_bets', JSON.stringify(updated))
    if (result === 'won') {
      const nb = bankroll + bet.potentialWin
      setBankroll(nb)
      localStorage.setItem('polymarket_bankroll', String(nb))
    }
  }

  const categories = ['all', ...Array.from(new Set(markets.map(m => m.category))).filter(Boolean)]

  const filtered = markets
    .filter(m => category === 'all' || m.category === category)
    .filter(m => !search || m.question.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => sortBy === 'volume' ? b.volume - a.volume : sortBy === 'probability' ? Math.abs(b.probability - 0.5) - Math.abs(a.probability - 0.5) : a.daysLeft - b.daysLeft)

  const openTrades = trades.filter(t => t.status === 'open')
  const closedTrades = trades.filter(t => t.status !== 'open')
  const totalPnl = closedTrades.reduce((s,t) => s + (t.pnl||0), 0)
  const winRate = closedTrades.length ? Math.round(closedTrades.filter(t => t.status==='won').length/closedTrades.length*100) : 0

  const navItems = [
    {id:'markets', icon:'🔮', label:'Markets'},
    {id:'trades', icon:'💼', label:'Trades'},
    {id:'learn', icon:'📚', label:'Learn'},
  ]

  return (
    <div style={{background:C.bg, minHeight:'100vh', color:C.text, fontFamily:'system-ui,sans-serif'}}>

      {isMobile && (
        <div style={{display:'flex', background:'#0a0a0f', borderBottom:`1px solid ${C.border}`, padding:'0 2px'}}>
          {[
            {label:'📈', href:'/dashboard'},
            {label:'🪙', href:'/crypto'},
            {label:'🎰', href:'/sports'},
            {label:'📊', href:'/options'},
            {label:'🔮', href:'/polymarket', active:true},
            {label:'⬡', href:'/morning'},
          ].map(link => (
            <a key={link.href} href={link.href} style={{
              flex:1, textAlign:'center', padding:'10px 2px', fontSize:16,
              color: link.active ? '#fff' : C.muted, textDecoration:'none',
              borderBottom: link.active ? `2px solid ${C.accent}` : '2px solid transparent'
            }}>{link.label}</a>
          ))}
        </div>
      )}

      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding: isMobile ? '10px 12px' : '10px 24px',
        background:'#0a0a0f', borderBottom:`1px solid ${C.border}`,
        position:'sticky', top:0, zIndex:100
      }}>
        {!isMobile && (
          <div style={{display:'flex', gap:4, alignItems:'center'}}>
            {[
              {label:'📈 Trading', href:'/dashboard'},
              {label:'🪙 Crypto', href:'/crypto'},
              {label:'🎰 Sports', href:'/sports'},
              {label:'📊 Options', href:'/options'},
              {label:'🔮 Polymarket', href:'/polymarket', active:true},
            ].map(l => (
              <a key={l.href} href={l.href} style={{
                padding:'6px 12px', fontSize:13,
                color: l.active ? '#fff' : C.muted, textDecoration:'none',
                fontWeight: l.active ? 700 : 500,
                borderBottom: l.active ? `2px solid ${C.accent}` : '2px solid transparent'
              }}>{l.label}</a>
            ))}
          </div>
        )}
        <div style={{fontSize: isMobile?15:18, fontWeight:800}}>🔮 Polymarket</div>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <span style={{fontSize:12, fontWeight:700, color: bankroll>=1000?C.green:C.red}}>${bankroll.toFixed(0)}</span>
          <a href="/morning" style={{fontSize:11, color:'#a5b4fc', textDecoration:'none', padding:'6px 10px', borderRadius:6, border:'1px solid rgba(99,102,241,0.3)'}}>⬡ JARVIS</a>
        </div>
      </div>

      <div style={{display:'flex'}}>
        {!isMobile && (
          <div style={{width:180, background:'#0a0a0f', borderRight:`1px solid ${C.border}`, padding:'16px 0', position:'sticky', top:53, height:'calc(100vh - 53px)'}}>
            {navItems.map(item => (
              <button key={item.id} onClick={() => setSection(item.id as any)} style={{
                width:'100%', display:'flex', alignItems:'center', gap:10,
                padding:'10px 16px', border:'none',
                background: section===item.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: section===item.id ? '#a5b4fc' : C.muted,
                fontSize:13, fontWeight: section===item.id?700:400,
                cursor:'pointer', textAlign:'left',
                borderLeft: section===item.id ? `3px solid ${C.accent}` : '3px solid transparent'
              }}>
                <span style={{fontSize:16}}>{item.icon}</span>
                {item.label}
              </button>
            ))}

            <div style={{margin:'16px', padding:10, background:C.card, borderRadius:8, border:`1px solid ${C.border}`}}>
              <div style={{fontSize:10, color:C.muted, marginBottom:6}}>PAPER TRADING</div>
              <div style={{fontSize:12, marginBottom:2}}>Win rate: <strong style={{color:winRate>=50?C.green:C.red}}>{winRate}%</strong></div>
              <div style={{fontSize:12, marginBottom:2}}>P&L: <strong style={{color:totalPnl>=0?C.green:C.red}}>{totalPnl>=0?'+':''}${totalPnl.toFixed(0)}</strong></div>
              <div style={{fontSize:12}}>Open: <strong>{openTrades.length}</strong></div>
            </div>

            <a href="https://polymarket.com" target="_blank" rel="noreferrer" style={{
              display:'block', margin:'0 16px', padding:'8px 12px', borderRadius:8,
              background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.3)',
              color:'#a5b4fc', fontSize:12, fontWeight:700, textDecoration:'none', textAlign:'center'
            }}>
              Open Polymarket →
            </a>
          </div>
        )}

        <div style={{flex:1, padding: isMobile?12:20, paddingBottom: isMobile?80:20}}>

          {section === 'markets' && (
            <div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:8}}>
                <div>
                  <div style={{fontSize:20, fontWeight:800, marginBottom:4}}>🔮 Prediction Markets</div>
                  <div style={{fontSize:12, color:C.muted}}>Bet on real world events — politics, crypto, sports, news</div>
                </div>
                <button onClick={fetchMarkets} disabled={loading} style={{
                  padding:'8px 16px', borderRadius:8, border:'none',
                  background:C.accent, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer'
                }}>{loading ? '⟳ Loading...' : '⟳ Refresh'}</button>
              </div>

              <div style={{background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:10, padding:12, marginBottom:16, fontSize:12, color:'#a5b4fc', lineHeight:1.6}}>
                💡 <strong>How Polymarket works:</strong> Each market has YES/NO shares priced 0-100 cents. If YES wins the share pays $1. Buy YES at 30¢ → if it happens you get $1 (3x return). The price = market's estimated probability.
              </div>

              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search markets..."
                style={{width:'100%', padding:'10px 12px', borderRadius:8, border:`1px solid ${C.border}`, background:'#1a1a24', color:'#fff', fontSize:13, outline:'none', marginBottom:12, boxSizing:'border-box'}}/>

              <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap'}}>
                <div style={{display:'flex', gap:4, overflowX:'auto'}}>
                  {categories.slice(0,6).map(cat => (
                    <button key={cat} onClick={() => setCategory(cat)} style={{
                      padding:'5px 12px', borderRadius:6, fontSize:12, whiteSpace:'nowrap',
                      fontWeight: category===cat?700:400,
                      border:`1px solid ${category===cat?C.accent:C.border}`,
                      background: category===cat?'rgba(99,102,241,0.15)':'transparent',
                      color: category===cat?'#a5b4fc':C.muted, cursor:'pointer'
                    }}>{cat === 'all' ? 'All' : cat}</button>
                  ))}
                </div>
                <select value={sortBy} onChange={e=>setSortBy(e.target.value as any)} style={{
                  padding:'5px 10px', borderRadius:6, fontSize:12,
                  border:`1px solid ${C.border}`, background:'#1a1a24', color:'#fff', cursor:'pointer'
                }}>
                  <option value="volume">Sort: Volume</option>
                  <option value="probability">Sort: Most Uncertain</option>
                  <option value="ending">Sort: Ending Soon</option>
                </select>
              </div>

              {loading ? (
                <div style={{textAlign:'center', padding:48, color:C.muted}}>
                  <div style={{fontSize:32, marginBottom:12}}>🔮</div>
                  <div style={{fontSize:16, fontWeight:700}}>Loading markets...</div>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:32, textAlign:'center', color:C.muted}}>
                  No markets found
                </div>
              ) : filtered.map(market => {
                const ai = analysis[market.id]
                const isAnalyzing = analyzing[market.id]
                const yesPct = Math.round(market.yesPrice * 100)
                const noPct = Math.round(market.noPrice * 100)

                return (
                  <div key={market.id} style={{
                    background:C.card, border:`1px solid ${market.trending?'rgba(245,158,11,0.3)':C.border}`,
                    borderRadius:12, padding:16, marginBottom:12
                  }}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10, gap:8}}>
                      <div style={{flex:1}}>
                        <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:4, flexWrap:'wrap'}}>
                          {market.trending && <span style={{fontSize:10, padding:'2px 6px', borderRadius:4, background:'rgba(245,158,11,0.15)', color:C.yellow, fontWeight:700}}>🔥 TRENDING</span>}
                          <span style={{fontSize:10, padding:'2px 6px', borderRadius:4, background:'rgba(99,102,241,0.1)', color:'#a5b4fc'}}>{market.category}</span>
                          <span style={{fontSize:10, color:C.muted}}>{market.daysLeft}d left</span>
                        </div>
                        <div style={{fontSize:14, fontWeight:700, color:C.text, lineHeight:1.4}}>{market.question}</div>
                      </div>
                      <div style={{textAlign:'right', flexShrink:0}}>
                        <div style={{fontSize:22, fontWeight:900, color: yesPct > 50 ? C.green : C.red}}>{yesPct}%</div>
                        <div style={{fontSize:10, color:C.muted}}>chance YES</div>
                      </div>
                    </div>

                    <div style={{marginBottom:12}}>
                      <div style={{height:8, background:'#1a1a24', borderRadius:4, overflow:'hidden'}}>
                        <div style={{height:'100%', width:`${yesPct}%`, background: yesPct>50?C.green:C.red, borderRadius:4, transition:'width 0.3s'}}/>
                      </div>
                      <div style={{display:'flex', justifyContent:'space-between', marginTop:3, fontSize:10, color:C.muted}}>
                        <span style={{color:C.green}}>YES {yesPct}¢</span>
                        <span style={{color:C.red}}>NO {noPct}¢</span>
                      </div>
                    </div>

                    <div style={{display:'flex', gap:12, marginBottom:12, fontSize:12, color:C.muted}}>
                      <span>Vol: <strong style={{color:C.text}}>${(market.volume/1000).toFixed(0)}k</strong></span>
                      <span>Liq: <strong style={{color:C.text}}>${(market.liquidity/1000).toFixed(0)}k</strong></span>
                    </div>

                    {ai && (
                      <div style={{
                        background: ai.pick==='YES'?'rgba(34,197,94,0.08)':ai.pick==='NO'?'rgba(239,68,68,0.08)':'rgba(107,114,128,0.08)',
                        border:`1px solid ${ai.pick==='YES'?'rgba(34,197,94,0.3)':ai.pick==='NO'?'rgba(239,68,68,0.3)':'rgba(107,114,128,0.2)'}`,
                        borderRadius:8, padding:10, marginBottom:10
                      }}>
                        <div style={{fontSize:13, fontWeight:800, color:ai.pick==='YES'?C.green:ai.pick==='NO'?C.red:C.muted, marginBottom:4}}>
                          {ai.pick==='YES'?'✅ AI says YES':ai.pick==='NO'?'❌ AI says NO':ai.pick==='SKIP'?'⚖️ Too close to call':'👀 Watch this'}
                        </div>
                        <div style={{fontSize:12, color:'#d1d5db', lineHeight:1.5}}>{ai.reasoning}</div>
                        {ai.warning && <div style={{fontSize:11, color:C.yellow, marginTop:4}}>⚠️ {ai.warning}</div>}
                      </div>
                    )}

                    <div style={{background:'#1a1a24', borderRadius:8, padding:10, marginBottom:10, fontSize:12}}>
                      <div style={{color:C.muted, marginBottom:4}}>If you bet $10:</div>
                      <div style={{display:'flex', gap:16}}>
                        <span>YES → win <strong style={{color:C.green}}>${(10/market.yesPrice).toFixed(2)}</strong> if correct</span>
                        <span>NO → win <strong style={{color:C.green}}>${(10/market.noPrice).toFixed(2)}</strong> if correct</span>
                      </div>
                    </div>

                    <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                      {!ai && (
                        <button onClick={() => analyzeMarket(market)} disabled={isAnalyzing} style={{
                          flex:1, padding:'8px', borderRadius:8,
                          border:'1px solid rgba(99,102,241,0.4)',
                          background:'rgba(99,102,241,0.08)',
                          color:isAnalyzing?C.muted:'#a5b4fc',
                          fontSize:12, fontWeight:700, cursor:'pointer'
                        }}>
                          {isAnalyzing?'🤔 Analyzing...':'✦ AI Analysis'}
                        </button>
                      )}
                      <button onClick={() => { setBetModal({market, pick:'YES'}); setBetShares('10') }} style={{
                        flex:1, padding:'8px', borderRadius:8, border:'none',
                        background:'rgba(34,197,94,0.2)', color:C.green,
                        fontSize:12, fontWeight:700, cursor:'pointer'
                      }}>
                        + Bet YES ({yesPct}¢)
                      </button>
                      <button onClick={() => { setBetModal({market, pick:'NO'}); setBetShares('10') }} style={{
                        flex:1, padding:'8px', borderRadius:8, border:'none',
                        background:'rgba(239,68,68,0.2)', color:C.red,
                        fontSize:12, fontWeight:700, cursor:'pointer'
                      }}>
                        + Bet NO ({noPct}¢)
                      </button>
                      <a href={`https://polymarket.com/event/${market.slug}`} target="_blank" rel="noreferrer" style={{
                        padding:'8px 12px', borderRadius:8,
                        border:`1px solid ${C.border}`, background:'transparent',
                        color:C.muted, fontSize:12, textDecoration:'none', fontWeight:700
                      }}>
                        Poly →
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {section === 'trades' && (
            <div>
              <div style={{fontSize:20, fontWeight:800, marginBottom:4}}>💼 Paper Bets</div>
              <div style={{fontSize:12, color:C.muted, marginBottom:16}}>Track your prediction market picks</div>

              <div style={{display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:16}}>
                {[
                  {label:'BANKROLL', value:`$${bankroll.toFixed(0)}`, color:bankroll>=1000?C.green:C.red},
                  {label:'NET P&L', value:`${totalPnl>=0?'+':''}$${totalPnl.toFixed(0)}`, color:totalPnl>=0?C.green:C.red},
                  {label:'WIN RATE', value:`${winRate}%`, color:winRate>=50?C.green:C.red},
                  {label:'OPEN BETS', value:openTrades.length, color:C.text},
                ].map(s => (
                  <div key={s.label} style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:14}}>
                    <div style={{fontSize:10, color:C.muted, marginBottom:4}}>{s.label}</div>
                    <div style={{fontSize:20, fontWeight:700, color:s.color}}>{s.value}</div>
                  </div>
                ))}
              </div>

              {trades.length === 0 ? (
                <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:32, textAlign:'center', color:C.muted}}>
                  No bets yet — go to Markets and click Bet YES or Bet NO
                </div>
              ) : trades.map(trade => (
                <div key={trade.id} style={{
                  background:C.card,
                  border:`1px solid ${trade.status==='won'?'rgba(34,197,94,0.3)':trade.status==='lost'?'rgba(239,68,68,0.3)':C.border}`,
                  borderRadius:12, padding:16, marginBottom:10
                }}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
                    <div style={{flex:1, marginRight:8}}>
                      <div style={{fontSize:13, fontWeight:700, marginBottom:2, lineHeight:1.3}}>{trade.question}</div>
                      <div style={{fontSize:11, color:C.muted}}>
                        Bet <strong style={{color:trade.pick==='YES'?C.green:C.red}}>{trade.pick}</strong> at {Math.round(trade.price*100)}¢ · {trade.shares} shares · ${trade.totalCost.toFixed(2)} cost
                      </div>
                    </div>
                    <div style={{textAlign:'right', flexShrink:0}}>
                      {trade.status==='open' && <div style={{fontSize:12, fontWeight:700, color:C.yellow}}>⏳ OPEN</div>}
                      {trade.status==='won' && <div style={{fontSize:12, fontWeight:700, color:C.green}}>✅ +${trade.pnl?.toFixed(0)}</div>}
                      {trade.status==='lost' && <div style={{fontSize:12, fontWeight:700, color:C.red}}>❌ -${trade.totalCost.toFixed(0)}</div>}
                    </div>
                  </div>

                  <div style={{fontSize:12, color:C.muted, marginBottom:trade.status==='open'?10:0}}>
                    Potential win: <strong style={{color:C.green}}>${trade.potentialWin.toFixed(2)}</strong> · Return: <strong>{((trade.potentialWin/trade.totalCost-1)*100).toFixed(0)}%</strong>
                  </div>

                  {trade.status === 'open' && (
                    <div style={{display:'flex', gap:8}}>
                      <button onClick={() => settleBet(trade.id, 'won')} style={{flex:1, padding:'7px', borderRadius:6, border:'none', background:'rgba(34,197,94,0.2)', color:C.green, fontSize:12, fontWeight:700, cursor:'pointer'}}>
                        ✅ Won
                      </button>
                      <button onClick={() => settleBet(trade.id, 'lost')} style={{flex:1, padding:'7px', borderRadius:6, border:'none', background:'rgba(239,68,68,0.2)', color:C.red, fontSize:12, fontWeight:700, cursor:'pointer'}}>
                        ❌ Lost
                      </button>
                      <a href={`https://polymarket.com`} target="_blank" rel="noreferrer" style={{
                        padding:'7px 12px', borderRadius:6, border:`1px solid ${C.border}`,
                        color:C.muted, fontSize:12, textDecoration:'none'
                      }}>Check →</a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {section === 'learn' && (
            <div>
              <div style={{fontSize:20, fontWeight:800, marginBottom:4}}>📚 How Polymarket Works</div>
              <div style={{fontSize:12, color:C.muted, marginBottom:20}}>A quick guide to prediction markets</div>

              {[
                {title:'What is Polymarket?', content:'Polymarket is a prediction market where you bet on real world events. Unlike sports betting, there\'s no bookmaker taking a cut — prices are set by other traders. If you\'re smarter than the crowd, you make money.', example:'Will the Fed cut rates in June? Market says 34%. You think it\'s more likely — buy YES at 34¢, if it happens you get $1 (nearly 3x).'},
                {title:'How prices work', content:'Each market has YES and NO shares. Prices range from 1¢ to 99¢ and represent the market\'s probability. YES at 70¢ means 70% chance of happening. The prices always add up to roughly $1.', example:'YES = 65¢, NO = 35¢. Total ≈ $1. If YES wins, YES holders get $1 per share.'},
                {title:'Finding value', content:'You make money when the crowd is WRONG. If a market says 20% chance and you think it\'s 40%, buy YES at 20¢. When it resolves YES you get $1 — a 5x return. The key is knowing more than the market.', example:'Election market says incumbent wins 30%. You\'ve read the polls and think 55%. Buy YES at 30¢ → if right, get $1 = 3.3x.'},
                {title:'Risk management', content:'Never bet more than 5-10% of bankroll on one market. Diversify across multiple markets. The market is often right — only bet when you have a clear edge or information advantage.', example:'$1,000 bankroll → max $50-100 per market. Spread across 10-20 markets.'},
                {title:'Best markets to start', content:'Stick to markets you know well. Crypto price targets if you follow crypto. Sports outcomes if you follow sports. Avoid political markets unless you really follow politics closely.', example:'Good start: "Will BTC be above $100k by Dec 31?" — You already track BTC price from Coin Sniper.'},
              ].map((item, i) => (
                <div key={i} style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:16, marginBottom:12}}>
                  <div style={{fontSize:14, fontWeight:700, color:'#a5b4fc', marginBottom:8}}>{item.title}</div>
                  <div style={{fontSize:13, color:'#d1d5db', lineHeight:1.6, marginBottom:8}}>{item.content}</div>
                  <div style={{background:'rgba(99,102,241,0.05)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:6, padding:10, fontSize:12, color:C.muted}}>
                    💡 {item.example}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isMobile && (
        <div style={{position:'fixed', bottom:0, left:0, right:0, zIndex:200, background:'#0a0a0f', borderTop:`1px solid ${C.border}`, display:'flex', height:70}}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setSection(item.id as any)} style={{
              flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              border:'none', background:'transparent', gap:3, cursor:'pointer',
              borderTop: section===item.id ? `2px solid ${C.accent}` : '2px solid transparent'
            }}>
              <span style={{fontSize:22}}>{item.icon}</span>
              <span style={{fontSize:10, fontWeight:section===item.id?700:400, color:section===item.id?'#a5b4fc':C.muted}}>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {betModal && (
        <>
          <div onClick={() => setBetModal(null)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:2000}}/>
          <div style={{position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:2001, background:'#111', border:`1px solid ${C.border}`, borderRadius:16, padding:24, width:360, maxWidth:'90vw'}}>
            <div style={{fontSize:16, fontWeight:700, marginBottom:4}}>
              Bet <span style={{color:betModal.pick==='YES'?C.green:C.red}}>{betModal.pick}</span>
            </div>
            <div style={{fontSize:12, color:C.muted, marginBottom:16, lineHeight:1.4}}>{betModal.market.question}</div>

            <div style={{background:'#1a1a24', borderRadius:8, padding:12, marginBottom:16}}>
              <div style={{fontSize:12, color:C.muted, marginBottom:2}}>Current price</div>
              <div style={{fontSize:20, fontWeight:800, color:betModal.pick==='YES'?C.green:C.red}}>
                {Math.round((betModal.pick==='YES'?betModal.market.yesPrice:betModal.market.noPrice)*100)}¢ per share
              </div>
            </div>

            <label style={{fontSize:12, color:C.muted, display:'block', marginBottom:4}}>Number of shares</label>
            <input type="number" value={betShares} onChange={e=>setBetShares(e.target.value)} min="1"
              style={{width:'100%', padding:'10px', borderRadius:8, border:`1px solid ${C.border}`, background:'#1a1a24', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box', marginBottom:8}}/>

            {betShares && (
              <div style={{fontSize:13, marginBottom:16}}>
                <div style={{color:C.muted}}>Total cost: <strong style={{color:'#fff'}}>${(parseFloat(betShares) * (betModal.pick==='YES'?betModal.market.yesPrice:betModal.market.noPrice)).toFixed(2)}</strong></div>
                <div style={{color:C.muted}}>If correct: <strong style={{color:C.green}}>${parseFloat(betShares).toFixed(2)}</strong> (${(parseFloat(betShares) - parseFloat(betShares) * (betModal.pick==='YES'?betModal.market.yesPrice:betModal.market.noPrice)).toFixed(2)} profit)</div>
              </div>
            )}

            <div style={{display:'flex', gap:8}}>
              <button onClick={() => setBetModal(null)} style={{flex:1, padding:'10px', borderRadius:8, border:`1px solid ${C.border}`, background:'transparent', color:'#fff', fontSize:13, cursor:'pointer'}}>Cancel</button>
              <button onClick={() => placeBet(betModal.market, betModal.pick)} style={{flex:2, padding:'10px', borderRadius:8, border:'none', background:betModal.pick==='YES'?C.green:C.red, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer'}}>
                Place Bet →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
