'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Activity, RefreshCw, Bell, BellOff,
  Search, Filter, Star, StarOff, Copy, ExternalLink, ChevronDown,
  ChevronUp, AlertTriangle, CheckCircle, XCircle, Clock, Zap,
  Shield, Target, BarChart2, Wallet, ArrowUpRight, ArrowDownRight,
  Radio, Eye, Trash2, Edit2, Plus, Award, BookOpen
} from 'lucide-react'

// Types
interface OptionsAlert {
  id: string
  ticker: string
  type: 'CALL' | 'PUT'
  strike: number
  expiry: string
  volume: number
  openInterest: number
  volumeRatio: number // volume / open interest - higher = more unusual
  impliedVolatility: number
  premium: number // total dollar value of the trade
  sentiment: 'VERY BULLISH' | 'BULLISH' | 'BEARISH' | 'VERY BEARISH'
  urgency: 'HIGH' | 'MEDIUM' | 'LOW'
  score: number // 0-100
  timestamp: string
  daysToExpiry: number
  inTheMoney: boolean
  sector?: string
}

interface PaperTrade {
  id: number
  ticker: string
  type: 'CALL' | 'PUT'
  strike: number
  expiry: string
  entryPrice: number
  contracts: number
  totalCost: number
  currentPrice?: number
  status: 'open' | 'won' | 'lost' | 'expired'
  pnl?: number
  pnlPct?: number
  notes: string
  placedAt: string
  closedAt?: string
}

export default function OptionsPage() {
  const [alerts, setAlerts] = useState<OptionsAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [section, setSection] = useState<'scanner'|'watchlist'|'trades'|'learn'>('scanner')
  const [analysis, setAnalysis] = useState<Record<string, any>>({})
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({})
  const [trades, setTrades] = useState<PaperTrade[]>([])
  const [bankroll, setBankroll] = useState(10000)
  const [watchlist, setWatchlist] = useState<string[]>([
    'NVDA', 'AAPL', 'TSLA', 'META', 'AMZN',
    'GOOGL', 'MSFT', 'SPY', 'QQQ', 'AMD',
    'COIN', 'MSTR', 'PLTR', 'ARM', 'SMCI'
  ])
  const [tradeModal, setTradeModal] = useState<OptionsAlert | null>(null)
  const [tradeContracts, setTradeContracts] = useState('1')
  const [tradePrice, setTradePrice] = useState('')
  const [filterType, setFilterType] = useState<'all'|'CALL'|'PUT'>('all')
  const [filterUrgency, setFilterUrgency] = useState<'all'|'HIGH'|'MEDIUM'>('all')
  const [sortBy, setSortBy] = useState<'score'|'premium'|'ratio'>('score')
  const [isMobile, setIsMobile] = useState(false)
  const [alertsEnabled, setAlertsEnabled] = useState(false)

  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem('options_paper_trades') || '[]')
      setTrades(t)
      const b = parseFloat(localStorage.getItem('options_bankroll') || '10000')
      setBankroll(b)
      const saved = localStorage.getItem('options_watchlist')
      if (saved) {
        setWatchlist(JSON.parse(saved))
      } else {
        const defaults = [
          'NVDA', 'AAPL', 'TSLA', 'META', 'AMZN',
          'GOOGL', 'MSFT', 'SPY', 'QQQ', 'AMD',
          'COIN', 'MSTR', 'PLTR', 'ARM', 'SMCI'
        ]
        localStorage.setItem('options_watchlist', JSON.stringify(defaults))
        setWatchlist(defaults)
      }
      setAlertsEnabled(localStorage.getItem('options_alerts') === 'true')
    } catch {}
  }, [])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const C = {
    bg: '#080808', card: '#111111', border: '#1e1e2a',
    green: '#22c55e', red: '#ef4444', accent: '#6366f1',
    muted: '#6b7280', yellow: '#f59e0b', text: '#ffffff'
  }

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/options-flow')
      const data = await res.json()
      setAlerts(data.alerts || [])
      setLastUpdated(new Date())
    } catch(e) {
      console.error('Failed to fetch options flow:', e)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAlerts()
    // Auto refresh every 5 minutes during market hours
    const interval = setInterval(() => {
      const now = new Date()
      const hour = now.getHours()
      const day = now.getDay()
      if (day >= 1 && day <= 5 && hour >= 9 && hour < 16) {
        fetchAlerts()
      }
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchAlerts])

  // Browser notifications for high urgency alerts
  useEffect(() => {
    if (!alertsEnabled) return
    const highUrgency = alerts.filter(a => a.urgency === 'HIGH')
    highUrgency.forEach(alert => {
      const key = 'notified_' + alert.id
      if (!localStorage.getItem(key)) {
        new Notification(`${alert.ticker} ${alert.type} Alert!`, {
          body: `$${(alert.premium/1000).toFixed(0)}k unusual ${alert.type} activity · Score ${alert.score}/100`,
          icon: '/favicon.ico'
        })
        localStorage.setItem(key, '1')
      }
    })
  }, [alerts, alertsEnabled])

  const enableNotifications = async () => {
    const perm = await Notification.requestPermission()
    if (perm === 'granted') {
      setAlertsEnabled(true)
      localStorage.setItem('options_alerts', 'true')
    }
  }

  const analyzeAlert = async (alert: OptionsAlert) => {
    if (analyzing[alert.id] || analysis[alert.id]) return
    setAnalyzing(prev => ({...prev, [alert.id]: true}))
    try {
      const res = await fetch('/api/analyze-game', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          team1: alert.ticker,
          team2: 'SKIP',
          sport: 'OPTIONS',
          odds1: 0, odds2: 0,
          gameTime: 'Today',
          context: `Unusual options activity detected. Stock: ${alert.ticker}. Someone bought ${alert.volume.toLocaleString()} ${alert.type} contracts at $${alert.strike} strike expiring ${alert.expiry} (${alert.daysToExpiry} days). Total premium spent: $${(alert.premium/1000).toFixed(0)}k. Volume is ${alert.volumeRatio.toFixed(1)}x normal. IV: ${alert.impliedVolatility}%. ${alert.inTheMoney ? 'In the money' : 'Out of the money'}. Should a retail trader follow this unusual options flow? Reply with pick as BUY to follow, SKIP to avoid, WATCH to monitor.`
        })
      })
      const data = await res.json()
      setAnalysis(prev => ({...prev, [alert.id]: data}))
    } catch(e) {}
    setAnalyzing(prev => ({...prev, [alert.id]: false}))
  }

  const placePaperTrade = (alert: OptionsAlert) => {
    const contracts = parseInt(tradeContracts) || 1
    const price = parseFloat(tradePrice) || (alert.premium / alert.volume / 100)
    const totalCost = price * contracts * 100

    const trade: PaperTrade = {
      id: Date.now(),
      ticker: alert.ticker,
      type: alert.type,
      strike: alert.strike,
      expiry: alert.expiry,
      entryPrice: price,
      contracts,
      totalCost,
      status: 'open',
      notes: `Following unusual activity. Volume ratio: ${alert.volumeRatio.toFixed(1)}x. Score: ${alert.score}/100`,
      placedAt: new Date().toISOString()
    }

    const updated = [trade, ...trades]
    setTrades(updated)
    localStorage.setItem('options_paper_trades', JSON.stringify(updated))
    setBankroll(prev => {
      const nb = prev - totalCost
      localStorage.setItem('options_bankroll', String(nb))
      return nb
    })
    setTradeModal(null)
    setSection('trades')
  }

  const settleTrade = (id: number, result: 'won'|'lost'|'expired', closePrice?: number) => {
    const trade = trades.find(t => t.id === id)
    if (!trade) return

    const pnl = result === 'won' && closePrice
      ? (closePrice - trade.entryPrice) * trade.contracts * 100
      : result === 'lost' || result === 'expired'
      ? -trade.totalCost
      : 0

    const pnlPct = (pnl / trade.totalCost) * 100

    const updated = trades.map(t => t.id === id ? {
      ...t, status: result, pnl, pnlPct,
      closedAt: new Date().toISOString()
    } : t)
    setTrades(updated)
    localStorage.setItem('options_paper_trades', JSON.stringify(updated))

    if (result === 'won') {
      setBankroll(prev => {
        const nb = prev + trade.totalCost + pnl
        localStorage.setItem('options_bankroll', String(nb))
        return nb
      })
    }
  }

  const urgencyColor = (u: string) => u === 'HIGH' ? C.red : u === 'MEDIUM' ? C.yellow : C.muted
  const sentimentColor = (s: string) => s.includes('BULLISH') ? C.green : C.red
  const SentimentIcon = ({s}: {s: string}) => {
    if (s === 'VERY BULLISH') return <ArrowUpRight size={18}/>
    if (s === 'BULLISH') return <TrendingUp size={18}/>
    if (s === 'BEARISH') return <TrendingDown size={18}/>
    return <ArrowDownRight size={18}/>
  }

  const filtered = alerts
    .filter(a => filterType === 'all' || a.type === filterType)
    .filter(a => filterUrgency === 'all' || a.urgency === filterUrgency)
    .sort((a, b) => sortBy === 'score' ? b.score - a.score : sortBy === 'premium' ? b.premium - a.premium : b.volumeRatio - a.volumeRatio)

  const openTrades = trades.filter(t => t.status === 'open')
  const closedTrades = trades.filter(t => t.status !== 'open')
  const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl || 0), 0)
  const winRate = closedTrades.length ? Math.round(closedTrades.filter(t => t.status === 'won').length / closedTrades.length * 100) : 0

  const navItems = [
    {id:'scanner', Icon: Radio, label:'Scanner'},
    {id:'watchlist', Icon: Star, label:'Watchlist'},
    {id:'trades', Icon: Wallet, label:'Trades'},
    {id:'learn', Icon: BookOpen, label:'Learn'},
  ]

  return (
    <div style={{background: C.bg, minHeight:'100vh', color: C.text, fontFamily:'system-ui,sans-serif'}}>

      {/* Mobile app switcher */}
      {isMobile && (
        <div style={{display:'flex', background:'rgba(8,8,8,0.95)', backdropFilter:'blur(12px)', borderBottom:`1px solid ${C.border}`, padding:'0 4px'}}>
          {[
            {Icon: TrendingUp, label:'Trading', href:'/dashboard'},
            {Icon: Activity, label:'Crypto', href:'/crypto'},
            {Icon: Target, label:'Sports', href:'/sports'},
            {Icon: BarChart2, label:'Options', href:'/options', active:true},
            {Icon: Zap, label:'Airdrops', href:'/airdrops'},
            {Icon: Award, label:'JARVIS', href:'/morning'},
          ].map(link => (
            <a key={link.href} href={link.href} style={{
              flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2,
              padding:'8px 2px', fontSize:10,
              fontWeight: link.active ? 700 : 500,
              color: link.active ? '#fff' : '#4b5563',
              textDecoration:'none',
              borderBottom: link.active ? `2px solid ${C.accent}` : '2px solid transparent',
              transition:'color 0.15s, border-color 0.15s'
            }}>
              <link.Icon size={14}/>
              <span>{link.label}</span>
            </a>
          ))}
        </div>
      )}

      {/* Top bar */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding: isMobile ? '12px 16px' : '14px 24px',
        background:'rgba(8,8,8,0.95)', backdropFilter:'blur(12px)',
        borderBottom:`1px solid ${C.border}`,
        position:'sticky', top:0, zIndex:100, gap:12
      }}>
        <div style={{display:'flex', alignItems:'center', gap:8, fontSize: 14, fontWeight:800, color:'#fff', whiteSpace:'nowrap', letterSpacing:'-0.01em'}}>
          <BarChart2 size={16}/> Options Flow
        </div>

        {!isMobile && (
          <div style={{display:'flex', gap:4, alignItems:'center'}}>
            {[
              { href:'/dashboard', Icon: TrendingUp, label:'Trading',  active:false },
              { href:'/crypto',    Icon: Activity,   label:'Crypto',   active:false },
              { href:'/sports',    Icon: Target,     label:'Sports',   active:false },
              { href:'/options',   Icon: BarChart2,  label:'Options',  active:true  },
              { href:'/airdrops',  Icon: Zap,        label:'Airdrops', active:false },
            ].map(l => (
              <a key={l.href} href={l.href} style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'6px 14px', fontSize:13, fontWeight:500,
                color: l.active ? '#fff' : '#4b5563',
                textDecoration:'none', whiteSpace:'nowrap',
                borderBottom: l.active ? '2px solid #6366f1' : '2px solid transparent',
                transition:'color 0.15s, border-color 0.15s',
                letterSpacing:'-0.01em'
              }}>
                <l.Icon size={14}/> {l.label}
              </a>
            ))}
          </div>
        )}

        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <div style={{fontSize:13, color: bankroll >= 10000 ? C.green : C.red, fontWeight:700, whiteSpace:'nowrap'}}>
            ${bankroll.toLocaleString('en-US', {maximumFractionDigits:0})}
          </div>
          <button onClick={enableNotifications} style={{
            display:'flex', alignItems:'center', gap:6,
            padding:'8px 14px', borderRadius:8, fontSize:13, fontWeight:600,
            border:`1px solid ${alertsEnabled ? 'rgba(34,197,94,0.25)' : '#1e1e2a'}`,
            background: alertsEnabled ? 'rgba(34,197,94,0.15)' : 'transparent',
            color: alertsEnabled ? C.green : '#6b7280', cursor:'pointer',
            transition:'all 0.15s'
          }}>
            {alertsEnabled ? <Bell size={14}/> : <BellOff size={14}/>}
            {alertsEnabled ? 'ON' : 'Alerts'}
          </button>
          <a href="/morning" style={{display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#a5b4fc', textDecoration:'none', padding:'8px 14px', borderRadius:8, border:`1px solid rgba(99,102,241,0.3)`, whiteSpace:'nowrap', fontWeight:600}}>
            <Award size={14}/> JARVIS
          </a>
        </div>
      </div>

      <div style={{display:'flex', minHeight:'calc(100vh - 60px)'}}>

        {/* Desktop sidebar */}
        {!isMobile && (
          <div style={{width:180, background:'#0a0a0f', borderRight:`1px solid ${C.border}`, padding:'16px 0', position:'sticky', top:60, height:'calc(100vh - 60px)'}}>
            {navItems.map(item => (
              <button key={item.id} onClick={() => setSection(item.id as any)} style={{
                width:'100%', display:'flex', alignItems:'center', gap:10,
                padding:'10px 16px', border:'none',
                background: section===item.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: section===item.id ? '#a5b4fc' : '#6b7280',
                fontSize:13, fontWeight: section===item.id ? 700 : 500,
                cursor:'pointer', textAlign:'left',
                borderLeft: section===item.id ? `3px solid ${C.accent}` : '3px solid transparent',
                transition:'all 0.15s'
              }}>
                <item.Icon size={16}/>
                {item.label}
              </button>
            ))}

            {/* Market status */}
            <div style={{margin:'16px', padding:12, background:'#0f0f15', borderRadius:12, border:`1px solid ${C.border}`, boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}}>
              {(() => {
                const now = new Date()
                const hour = now.getHours()
                const day = now.getDay()
                const isOpen = day >= 1 && day <= 5 && hour >= 9 && hour < 16
                return (
                  <>
                    <div style={{fontSize:11, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, marginBottom:6}}>MARKET</div>
                    <div style={{display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:700, color: isOpen ? C.green : C.muted}}>
                      <span style={{width:8, height:8, borderRadius:'50%', background: isOpen ? C.green : C.red, boxShadow: isOpen ? `0 0 8px ${C.green}` : 'none'}}/>
                      {isOpen ? 'OPEN' : 'CLOSED'}
                    </div>
                    <div style={{fontSize:11, color:C.muted, marginTop:4}}>
                      {isOpen ? 'Live data' : 'Opens 9:30 EST'}
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Stats */}
            <div style={{margin:'0 16px', padding:12, background:'#0f0f15', borderRadius:12, border:`1px solid ${C.border}`, boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}}>
              <div style={{fontSize:11, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, marginBottom:8}}>PAPER TRADING</div>
              <div style={{fontSize:13, color:'#d1d5db', marginBottom:4, lineHeight:1.6}}>
                Win rate: <strong style={{color: winRate >= 50 ? C.green : C.red}}>{winRate}%</strong>
              </div>
              <div style={{fontSize:13, color:'#d1d5db', marginBottom:4, lineHeight:1.6}}>
                P&L: <strong style={{color: totalPnl >= 0 ? C.green : C.red}}>{totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(0)}</strong>
              </div>
              <div style={{fontSize:13, color:'#d1d5db', lineHeight:1.6}}>
                Open: <strong>{openTrades.length}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <div style={{flex:1, padding: isMobile ? '12px' : '20px', paddingBottom: isMobile ? 80 : 20, overflowX:'hidden'}}>

          {/* SCANNER SECTION */}
          {section === 'scanner' && (
            <div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:8}}>
                <div>
                  <div style={{display:'flex', alignItems:'center', gap:8, fontSize:22, fontWeight:800, letterSpacing:'-0.02em', marginBottom:4}}>
                    <Radio size={22}/> Options Flow Scanner
                  </div>
                  <div style={{fontSize:13, color:'#d1d5db', lineHeight:1.6}}>
                    Unusual options activity — when whales make big bets
                    {lastUpdated && ` · Updated ${lastUpdated.toLocaleTimeString()}`}
                  </div>
                </div>
                <button onClick={fetchAlerts} disabled={loading} style={{
                  display:'flex', alignItems:'center', gap:6,
                  padding:'9px 18px', borderRadius:8, border:'none',
                  background: C.accent, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
                  transition:'all 0.15s'
                }}>
                  <RefreshCw size={14} className={loading ? 'spin' : ''}/>
                  {loading ? 'Scanning...' : 'Refresh'}
                </button>
              </div>

              {/* Info banner */}
              <div style={{background:'rgba(99,102,241,0.06)', border:`1px solid rgba(99,102,241,0.2)`, borderRadius:12, padding:14, marginBottom:16, fontSize:13, color:'#a5b4fc', lineHeight:1.6, display:'flex', alignItems:'flex-start', gap:8}}>
                <Zap size={14} style={{flexShrink:0, marginTop:2}}/>
                <div><strong>How to use:</strong> When you see HIGH urgency with score 70+, someone big is making a move. Click AI Analysis to understand why. If it says BUY, consider following with paper money first. Always verify on your own before using real money.</div>
              </div>

              {/* Filters */}
              <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap'}}>
                <div style={{display:'flex', gap:4}}>
                  {['all','CALL','PUT'].map(f => (
                    <button key={f} onClick={() => setFilterType(f as any)} style={{
                      display:'flex', alignItems:'center', gap:6,
                      padding:'8px 14px', borderRadius:8, fontSize:13, fontWeight: filterType===f ? 700 : 600,
                      border:`1px solid ${filterType===f ? C.accent : '#1e1e2a'}`,
                      background: filterType===f ? `rgba(99,102,241,0.15)` : 'transparent',
                      color: filterType===f ? '#a5b4fc' : '#6b7280', cursor:'pointer',
                      transition:'all 0.15s'
                    }}>
                      {f === 'CALL' && <TrendingUp size={12}/>}
                      {f === 'PUT' && <TrendingDown size={12}/>}
                      {f === 'all' ? 'All' : f === 'CALL' ? 'Calls' : 'Puts'}
                    </button>
                  ))}
                </div>
                <div style={{display:'flex', gap:4}}>
                  {['all','HIGH','MEDIUM'].map(f => (
                    <button key={f} onClick={() => setFilterUrgency(f as any)} style={{
                      display:'flex', alignItems:'center', gap:6,
                      padding:'8px 14px', borderRadius:8, fontSize:13, fontWeight: filterUrgency===f ? 700 : 600,
                      border:`1px solid ${filterUrgency===f ? (f==='HIGH'?'rgba(239,68,68,0.5)':f==='MEDIUM'?'rgba(245,158,11,0.5)':C.accent) : '#1e1e2a'}`,
                      background: filterUrgency===f ? (f==='HIGH'?'rgba(239,68,68,0.1)':f==='MEDIUM'?'rgba(245,158,11,0.1)':`rgba(99,102,241,0.15)`) : 'transparent',
                      color: filterUrgency===f ? (f==='HIGH'?C.red:f==='MEDIUM'?C.yellow:'#a5b4fc') : '#6b7280', cursor:'pointer',
                      transition:'all 0.15s'
                    }}>
                      {f === 'HIGH' && <AlertTriangle size={12}/>}
                      {f === 'MEDIUM' && <Zap size={12}/>}
                      {f === 'all' ? 'All' : f === 'HIGH' ? 'High' : 'Medium'}
                    </button>
                  ))}
                </div>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{
                  padding:'5px 10px', borderRadius:6, fontSize:12,
                  border:`1px solid ${C.border}`, background:'#1a1a24', color:'#fff', cursor:'pointer'
                }}>
                  <option value="score">Sort: Score</option>
                  <option value="premium">Sort: Premium $</option>
                  <option value="ratio">Sort: Volume Ratio</option>
                </select>
              </div>

              {/* Alert cards */}
              {loading && alerts.length === 0 ? (
                <div style={{textAlign:'center', padding:48, color:C.muted}}>
                  <Radio size={32} style={{marginBottom:12, opacity:0.5}}/>
                  <div style={{fontSize:16, fontWeight:700, marginBottom:8, color:'#fff'}}>Scanning options flow...</div>
                  <div style={{fontSize:13}}>Checking for unusual activity across all US stocks</div>
                </div>
              ) : alerts.length === 0 ? (
                <div style={{background:'#0f0f15', border:`1px solid ${C.border}`, borderRadius:12, padding:32, textAlign:'center', boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}}>
                  <Clock size={32} style={{marginBottom:12, opacity:0.5, color:C.muted}}/>
                  <div style={{fontSize:16, fontWeight:700, color:C.text, marginBottom:8}}>No unusual activity right now</div>
                  <div style={{fontSize:13, color:'#d1d5db', marginBottom:16, lineHeight:1.6}}>
                    Markets may be closed or activity is normal today.
                    Scanner runs automatically every 5 minutes during market hours (9:30am-4pm EST).
                  </div>
                  <div style={{fontSize:12, color:C.muted}}>
                    Best times to check: First hour (9:30-10:30am) and last hour (3-4pm) EST
                  </div>
                </div>
              ) : filtered.map(alert => {
                const ai = analysis[alert.id]
                const isAnalyzing = analyzing[alert.id]

                return (
                  <div key={alert.id} style={{
                    background: '#0f0f15',
                    border:`1px solid ${alert.urgency==='HIGH' ? 'rgba(239,68,68,0.4)' : alert.urgency==='MEDIUM' ? 'rgba(245,158,11,0.3)' : C.border}`,
                    borderRadius:12, padding:16, marginBottom:12,
                    boxShadow: alert.urgency==='HIGH' ? '0 0 20px rgba(239,68,68,0.08)' : '0 1px 3px rgba(0,0,0,0.3)',
                    transition:'border-color 0.2s'
                  }}>
                    {/* Header */}
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12}}>
                      <div>
                        <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
                          <span style={{fontSize:22, fontWeight:900, color:C.text}}>{alert.ticker}</span>
                          <span style={{
                            display:'inline-flex', alignItems:'center', gap:4,
                            fontSize:12, fontWeight:800, padding:'3px 8px', borderRadius:4,
                            background: alert.type==='CALL' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                            color: alert.type==='CALL' ? C.green : C.red
                          }}>
                            {alert.type==='CALL' ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                            {alert.type}
                          </span>
                          <span style={{
                            display:'inline-flex', alignItems:'center', gap:4,
                            fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:4,
                            background: alert.urgency==='HIGH' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                            color: urgencyColor(alert.urgency)
                          }}>
                            {alert.urgency==='HIGH' ? <AlertTriangle size={12}/> : <Zap size={12}/>}
                            {alert.urgency}
                          </span>
                        </div>
                        <div style={{display:'flex', alignItems:'center', gap:6, fontSize:12, color:C.muted}}>
                          ${alert.strike} strike · Expires {alert.expiry} ({alert.daysToExpiry}d) ·
                          {alert.inTheMoney ? <span style={{display:'inline-flex', alignItems:'center', gap:3, color:C.green}}><CheckCircle size={12}/>ITM</span> : <span style={{display:'inline-flex', alignItems:'center', gap:3}}>OTM</span>}
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:24, fontWeight:900, color: alert.score >= 70 ? C.green : alert.score >= 50 ? C.yellow : C.muted}}>
                          {alert.score}
                        </div>
                        <div style={{fontSize:10, color:C.muted}}>/100</div>
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:16}}>
                      {[
                        {label:'VOLUME', value: alert.volume.toLocaleString(), color: C.text},
                        {label:'VS NORMAL', value: `${alert.volumeRatio.toFixed(1)}x`, color: alert.volumeRatio > 10 ? C.red : alert.volumeRatio > 5 ? C.yellow : C.text},
                        {label:'PREMIUM', value: `$${alert.premium >= 1000000 ? (alert.premium/1000000).toFixed(1)+'M' : (alert.premium/1000).toFixed(0)+'k'}`, color: C.green},
                        {label:'IV', value: `${alert.impliedVolatility}%`, color: C.text},
                      ].map(stat => (
                        <div key={stat.label} style={{background:'#0f0f15', borderRadius:10, padding:'12px 10px', textAlign:'center', border:'1px solid #1e1e2a'}}>
                          <div style={{fontSize:10, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, marginBottom:6}}>{stat.label}</div>
                          <div style={{fontSize:18, fontWeight:800, color:stat.color, letterSpacing:'-0.02em'}}>{stat.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Sentiment */}
                    <div style={{
                      display:'flex', alignItems:'center', gap:8, marginBottom:12,
                      padding:'8px 12px', borderRadius:8,
                      background: alert.type==='CALL' ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
                      border: `1px solid ${alert.type==='CALL' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`
                    }}>
                      <SentimentIcon s={alert.sentiment}/>
                      <div>
                        <div style={{fontSize:13, fontWeight:700, color: sentimentColor(alert.sentiment)}}>{alert.sentiment}</div>
                        <div style={{fontSize:11, color:C.muted}}>
                          {alert.type==='CALL' ? 'Betting price goes UP' : 'Betting price goes DOWN'} by {alert.expiry}
                        </div>
                      </div>
                    </div>

                    {/* AI Analysis result */}
                    {ai && (
                      <div style={{
                        background: ai.pick==='BUY' ? 'rgba(34,197,94,0.08)' : ai.pick==='WATCH' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
                        border:`1px solid ${ai.pick==='BUY' ? 'rgba(34,197,94,0.3)' : ai.pick==='WATCH' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        borderRadius:8, padding:12, marginBottom:10
                      }}>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
                          <span style={{display:'inline-flex', alignItems:'center', gap:6, fontSize:14, fontWeight:800, color: ai.pick==='BUY'?C.green:ai.pick==='WATCH'?C.yellow:C.red}}>
                            {ai.pick==='BUY' ? <><CheckCircle size={14}/>FOLLOW THIS TRADE</> : ai.pick==='WATCH' ? <><Eye size={14}/>WATCH & WAIT</> : <><XCircle size={14}/>SKIP THIS ONE</>}
                          </span>
                          <span style={{fontSize:11, color:C.muted}}>{ai.confidence} confidence</span>
                        </div>
                        <div style={{fontSize:13, color:'#d1d5db', lineHeight:1.6}}>{ai.reasoning}</div>
                        {ai.warning && <div style={{display:'flex', alignItems:'center', gap:4, fontSize:11, color:C.yellow, marginTop:6}}><AlertTriangle size={11}/> {ai.warning}</div>}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                      {!ai && (
                        <button onClick={() => analyzeAlert(alert)} disabled={isAnalyzing} style={{
                          flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                          padding:'9px 14px', borderRadius:8,
                          border:`1px solid rgba(99,102,241,0.4)`,
                          background:'rgba(99,102,241,0.08)',
                          color: isAnalyzing ? C.muted : '#a5b4fc',
                          fontSize:13, fontWeight:700, cursor:'pointer',
                          transition:'all 0.15s'
                        }}>
                          <Zap size={14}/>
                          {isAnalyzing ? 'Analyzing...' : 'AI Analysis'}
                        </button>
                      )}
                      <button onClick={() => { setTradeModal(alert); setTradeContracts('1'); setTradePrice('') }} style={{
                        flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                        padding:'9px 18px', borderRadius:8, border:'none',
                        background: C.accent, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
                        transition:'all 0.15s'
                      }}>
                        <Plus size={14}/> Paper Trade
                      </button>
                      <a href={`https://finance.yahoo.com/quote/${alert.ticker}/options`} target="_blank" rel="noreferrer" style={{
                        display:'flex', alignItems:'center', gap:6,
                        padding:'8px 14px', borderRadius:8,
                        border:`1px solid #1e1e2a`,
                        background:'transparent', color:'#6b7280',
                        fontSize:13, fontWeight:600, textDecoration:'none',
                        transition:'all 0.15s'
                      }}>
                        Yahoo <ExternalLink size={12}/>
                      </a>
                      <button onClick={() => {
                        const wl = watchlist.includes(alert.ticker)
                          ? watchlist.filter(t => t !== alert.ticker)
                          : [...watchlist, alert.ticker]
                        setWatchlist(wl)
                        localStorage.setItem('options_watchlist', JSON.stringify(wl))
                      }} style={{
                        display:'flex', alignItems:'center', justifyContent:'center',
                        padding:'8px 10px', borderRadius:8,
                        border:`1px solid ${watchlist.includes(alert.ticker) ? 'rgba(245,158,11,0.4)' : '#1e1e2a'}`,
                        background: watchlist.includes(alert.ticker) ? 'rgba(245,158,11,0.1)' : 'transparent',
                        color: watchlist.includes(alert.ticker) ? C.yellow : '#6b7280',
                        cursor:'pointer', transition:'all 0.15s'
                      }}>
                        {watchlist.includes(alert.ticker) ? <Star size={14} fill="currentColor"/> : <StarOff size={14}/>}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* WATCHLIST SECTION */}
          {section === 'watchlist' && (
            <div>
              <div style={{display:'flex', alignItems:'center', gap:8, fontSize:22, fontWeight:800, letterSpacing:'-0.02em', marginBottom:4}}>
                <Star size={22}/> Watchlist
              </div>
              <div style={{fontSize:13, color:'#d1d5db', marginBottom:16, lineHeight:1.6}}>Stocks you're monitoring for unusual activity</div>

              <div style={{display:'flex', gap:8, marginBottom:16}}>
                <input
                  placeholder="Add ticker (e.g. NVDA)"
                  style={{flex:1, padding:'10px 12px', borderRadius:8, border:`1px solid ${C.border}`, background:'#1a1a24', color:'#fff', fontSize:13, outline:'none'}}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value.toUpperCase().trim()
                      if (val && !watchlist.includes(val)) {
                        const wl = [...watchlist, val]
                        setWatchlist(wl)
                        localStorage.setItem('options_watchlist', JSON.stringify(wl));
                        (e.target as HTMLInputElement).value = ''
                      }
                    }
                  }}
                />
              </div>

              <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
                {watchlist.map(ticker => {
                  const tickerAlerts = alerts.filter(a => a.ticker === ticker)
                  return (
                    <div key={ticker} style={{
                      background:'#0f0f15', border:`1px solid ${tickerAlerts.length > 0 ? 'rgba(34,197,94,0.4)' : C.border}`,
                      borderRadius:12, padding:'14px 16px', minWidth:140, boxShadow:'0 1px 3px rgba(0,0,0,0.3)', transition:'border-color 0.2s'
                    }}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
                        <span style={{fontSize:16, fontWeight:800, letterSpacing:'-0.02em'}}>{ticker}</span>
                        <button onClick={() => {
                          const wl = watchlist.filter(t => t !== ticker)
                          setWatchlist(wl)
                          localStorage.setItem('options_watchlist', JSON.stringify(wl))
                        }} style={{display:'flex', alignItems:'center', background:'transparent', border:'none', color:C.muted, cursor:'pointer'}}>
                          <Trash2 size={14}/>
                        </button>
                      </div>
                      {tickerAlerts.length > 0 ? (
                        <div style={{display:'flex', alignItems:'center', gap:4, fontSize:11, color:C.green, fontWeight:700}}>
                          <AlertTriangle size={11}/> {tickerAlerts.length} alert{tickerAlerts.length>1?'s':''}
                        </div>
                      ) : (
                        <div style={{fontSize:11, color:C.muted}}>No alerts today</div>
                      )}
                      <a href={`https://finance.yahoo.com/quote/${ticker}/options`} target="_blank" rel="noreferrer"
                        style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:11, color:'#a5b4fc', textDecoration:'none', marginTop:4}}>
                        View options <ExternalLink size={10}/>
                      </a>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* TRADES SECTION */}
          {section === 'trades' && (
            <div>
              <div style={{display:'flex', alignItems:'center', gap:8, fontSize:22, fontWeight:800, letterSpacing:'-0.02em', marginBottom:4}}>
                <Wallet size={22}/> Paper Trades
              </div>
              <div style={{fontSize:13, color:'#d1d5db', marginBottom:16, lineHeight:1.6}}>Track your options picks without real money</div>

              {/* Stats */}
              <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:16}}>
                {[
                  {label:'BANKROLL', value:`$${bankroll.toLocaleString('en-US',{maximumFractionDigits:0})}`, color: bankroll>=10000?C.green:C.red},
                  {label:'NET P&L', value:`${totalPnl>=0?'+':''}$${totalPnl.toFixed(0)}`, color:totalPnl>=0?C.green:C.red},
                  {label:'WIN RATE', value:`${winRate}%`, color:winRate>=50?C.green:C.red},
                  {label:'OPEN', value:openTrades.length, color:C.text},
                ].map(s => (
                  <div key={s.label} style={{background:'#0f0f15', borderRadius:10, padding:'12px 10px', textAlign:'center', border:'1px solid #1e1e2a'}}>
                    <div style={{fontSize:10, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, marginBottom:6}}>{s.label}</div>
                    <div style={{fontSize:18, fontWeight:800, color:s.color, letterSpacing:'-0.02em'}}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Trade list */}
              {trades.length === 0 ? (
                <div style={{background:'#0f0f15', border:`1px solid ${C.border}`, borderRadius:12, padding:32, textAlign:'center', color:C.muted, boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}}>
                  No paper trades yet — click "Paper Trade" on any alert in the Scanner
                </div>
              ) : trades.map(trade => (
                <div key={trade.id} style={{
                  background:'#0f0f15',
                  border:`1px solid ${trade.status==='won'?'rgba(34,197,94,0.3)':trade.status==='lost'||trade.status==='expired'?'rgba(239,68,68,0.3)':C.border}`,
                  borderRadius:12, padding:16, marginBottom:10, boxShadow:'0 1px 3px rgba(0,0,0,0.3)', transition:'border-color 0.2s'
                }}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
                    <div>
                      <div style={{fontSize:16, fontWeight:800}}>
                        {trade.ticker} {trade.type} ${trade.strike}
                      </div>
                      <div style={{fontSize:11, color:C.muted}}>
                        Expires {trade.expiry} · {trade.contracts} contract{trade.contracts>1?'s':''} · Paid ${trade.entryPrice.toFixed(2)}/share
                      </div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      {trade.status==='open' && <div style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontWeight:700, color:C.yellow}}><Clock size={12}/> OPEN</div>}
                      {trade.status==='won' && <div style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontWeight:700, color:C.green}}><CheckCircle size={12}/> +${trade.pnl?.toFixed(0)} ({trade.pnlPct?.toFixed(0)}%)</div>}
                      {trade.status==='lost' && <div style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontWeight:700, color:C.red}}><XCircle size={12}/> -${trade.totalCost.toFixed(0)}</div>}
                      {trade.status==='expired' && <div style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:12, fontWeight:700, color:C.muted}}><Clock size={12}/> Expired</div>}
                    </div>
                  </div>

                  <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:12}}>
                    <div style={{background:'#0f0f15', borderRadius:10, padding:'12px 10px', textAlign:'center', border:'1px solid #1e1e2a'}}>
                      <div style={{fontSize:10, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, marginBottom:6}}>CONTRACTS</div>
                      <div style={{fontSize:18, fontWeight:800, color:'#fff', letterSpacing:'-0.02em'}}>{trade.contracts}</div>
                    </div>
                    <div style={{background:'#0f0f15', borderRadius:10, padding:'12px 10px', textAlign:'center', border:'1px solid #1e1e2a'}}>
                      <div style={{fontSize:10, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, marginBottom:6}}>ENTRY</div>
                      <div style={{fontSize:18, fontWeight:800, color:'#fff', letterSpacing:'-0.02em'}}>${trade.entryPrice.toFixed(2)}</div>
                    </div>
                    <div style={{background:'#0f0f15', borderRadius:10, padding:'12px 10px', textAlign:'center', border:'1px solid #1e1e2a'}}>
                      <div style={{fontSize:10, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, marginBottom:6}}>TOTAL COST</div>
                      <div style={{fontSize:18, fontWeight:800, color:'#fff', letterSpacing:'-0.02em'}}>${trade.totalCost.toFixed(0)}</div>
                    </div>
                  </div>

                  {trade.notes && <div style={{fontSize:11, color:C.muted, marginBottom:10, fontStyle:'italic'}}>{trade.notes}</div>}

                  {trade.status === 'open' && (
                    <div>
                      <div style={{fontSize:11, color:C.muted, marginBottom:6}}>Mark result:</div>
                      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:8}}>
                        <button onClick={() => {
                          const closePrice = parseFloat(prompt('Close price per share? (e.g. 5.50)') || '0')
                          if (closePrice > 0) settleTrade(trade.id, 'won', closePrice)
                        }} style={{display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:8, background:'rgba(34,197,94,0.15)', color:C.green, fontSize:13, fontWeight:700, cursor:'pointer', border:'1px solid rgba(34,197,94,0.25)'}}>
                          <CheckCircle size={12}/> Won
                        </button>
                        <button onClick={() => settleTrade(trade.id, 'lost')} style={{display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:8, background:'rgba(239,68,68,0.15)', color:C.red, fontSize:13, fontWeight:700, cursor:'pointer', border:'1px solid rgba(239,68,68,0.25)'}}>
                          <XCircle size={12}/> Lost
                        </button>
                        <button onClick={() => settleTrade(trade.id, 'expired')} style={{display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:8, border:`1px solid #1e1e2a`, background:'transparent', color:'#6b7280', fontSize:13, fontWeight:600, cursor:'pointer'}}>
                          <Clock size={12}/> Expired
                        </button>
                      </div>
                      <a href={`https://finance.yahoo.com/quote/${trade.ticker}/options`} target="_blank" rel="noreferrer"
                        style={{display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px', borderRadius:8, border:`1px solid rgba(59,130,246,0.3)`, background:'rgba(59,130,246,0.05)', color:'#60a5fa', fontSize:12, textDecoration:'none', fontWeight:600}}>
                        <Search size={12}/> Check price on Yahoo Finance
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* LEARN SECTION */}
          {section === 'learn' && (
            <div>
              <div style={{display:'flex', alignItems:'center', gap:8, fontSize:22, fontWeight:800, letterSpacing:'-0.02em', marginBottom:4}}>
                <BookOpen size={22}/> Learn Options
              </div>
              <div style={{fontSize:13, color:'#d1d5db', marginBottom:20, lineHeight:1.6}}>Quick guide to understanding unusual options activity</div>

              {[
                {
                  title:'What is a CALL option?',
                  content:'A call option gives the buyer the right to purchase a stock at a specific price (strike price) before the expiry date. You buy calls when you think the stock price will go UP.',
                  example:'NVDA $900 CALL expiring in 2 weeks — you\'re betting NVDA will be above $900 before the option expires.'
                },
                {
                  title:'What is a PUT option?',
                  content:'A put option gives the buyer the right to sell a stock at a specific price before expiry. You buy puts when you think the stock price will go DOWN.',
                  example:'TSLA $200 PUT — you\'re betting TSLA will fall below $200.'
                },
                {
                  title:'What makes activity "unusual"?',
                  content:'When the volume (trades happening today) is much higher than the open interest (total existing contracts), someone new is making a big bet. A 10x ratio means 10x more contracts traded today than normal.',
                  example:'Normal day: 500 contracts traded. Unusual day: 8,000 contracts. That\'s 16x normal — someone is very confident.'
                },
                {
                  title:'What is a "sweep"?',
                  content:'A sweep is when someone buys options aggressively across multiple exchanges simultaneously. This signals urgency — they want to get in fast before the price moves. Sweeps are the most bullish/bearish signal.',
                  example:'Instead of waiting for a good price, they pay whatever it takes to fill 5,000 contracts immediately across NYSE, CBOE, and BATS.'
                },
                {
                  title:'In the money vs out of the money?',
                  content:'ITM (in the money) = the option already has value. OTM (out of the money) = the stock needs to move for the option to have value. OTM options are cheaper but riskier.',
                  example:'NVDA at $850. $800 CALL is ITM (already profitable). $950 CALL is OTM (needs to go up $100 more).'
                },
                {
                  title:'How to follow unusual activity',
                  content:'1. See the alert. 2. Check AI analysis. 3. Verify there\'s no earnings announcement (that would explain it). 4. Paper trade first. 5. If right, consider real money with small size.',
                  example:'Start with 1-2 contracts maximum. One contract = 100 shares. A $5 option price means $500 total cost per contract.'
                },
              ].map((item, i) => (
                <div key={i} style={{background:'#0f0f15', border:`1px solid ${C.border}`, borderRadius:12, padding:16, marginBottom:12, boxShadow:'0 1px 3px rgba(0,0,0,0.3)', transition:'border-color 0.2s'}}>
                  <div style={{fontSize:14, fontWeight:700, color:'#a5b4fc', marginBottom:8}}>{item.title}</div>
                  <div style={{fontSize:13, color:'#d1d5db', lineHeight:1.6, marginBottom:8}}>{item.content}</div>
                  <div style={{background:'rgba(99,102,241,0.05)', border:`1px solid rgba(99,102,241,0.15)`, borderRadius:8, padding:10, fontSize:12, color:'#d1d5db', display:'flex', alignItems:'flex-start', gap:6, lineHeight:1.6}}>
                    <Zap size={12} style={{flexShrink:0, marginTop:2, color:'#a5b4fc'}}/>
                    <div><strong style={{color:'#a5b4fc'}}>Example:</strong> {item.example}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <div style={{
          position:'fixed', bottom:0, left:0, right:0, zIndex:200,
          background:'rgba(8,8,8,0.95)', backdropFilter:'blur(12px)', borderTop:`1px solid ${C.border}`,
          display:'flex', height:70, paddingBottom:'env(safe-area-inset-bottom)'
        }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setSection(item.id as any)} style={{
              flex:1, display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center',
              border:'none', background:'transparent', gap:4, cursor:'pointer',
              color: section===item.id?'#a5b4fc':'#4b5563',
              borderTop: section===item.id ? `2px solid ${C.accent}` : '2px solid transparent',
              transition:'all 0.15s'
            }}>
              <item.Icon size={20}/>
              <span style={{fontSize:11, fontWeight:section===item.id?700:500, letterSpacing:'-0.01em'}}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Paper trade modal */}
      {tradeModal && (
        <>
          <div onClick={() => setTradeModal(null)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:2000}}/>
          <div style={{
            position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
            zIndex:2001, background:'#111', border:`1px solid ${C.border}`,
            borderRadius:16, padding:24, width:360, maxWidth:'90vw'
          }}>
            <div style={{fontSize:16, fontWeight:700, marginBottom:4}}>Paper Trade</div>
            <div style={{fontSize:13, color:C.muted, marginBottom:16}}>
              {tradeModal.ticker} {tradeModal.type} ${tradeModal.strike} · Exp {tradeModal.expiry}
            </div>

            <label style={{fontSize:12, color:C.muted, display:'block', marginBottom:4}}>Number of contracts</label>
            <input type="number" value={tradeContracts} onChange={e => setTradeContracts(e.target.value)} min="1"
              style={{width:'100%', padding:'10px', borderRadius:8, border:`1px solid ${C.border}`, background:'#1a1a24', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box', marginBottom:12}}/>

            <label style={{fontSize:12, color:C.muted, display:'block', marginBottom:4}}>Entry price per share ($)</label>
            <input type="number" value={tradePrice} onChange={e => setTradePrice(e.target.value)} placeholder="e.g. 3.50"
              style={{width:'100%', padding:'10px', borderRadius:8, border:`1px solid ${C.border}`, background:'#1a1a24', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box', marginBottom:8}}/>

            {tradePrice && tradeContracts && (
              <div style={{fontSize:13, color:C.green, marginBottom:16, fontWeight:600}}>
                Total cost: ${(parseFloat(tradePrice) * parseInt(tradeContracts) * 100).toFixed(0)}
                <div style={{fontSize:11, color:C.muted, fontWeight:400, marginTop:2}}>
                  1 contract = 100 shares · profit/loss is multiplied by 100
                </div>
              </div>
            )}

            <div style={{display:'flex', gap:8}}>
              <button onClick={() => setTradeModal(null)} style={{flex:1, padding:'10px', borderRadius:8, border:`1px solid ${C.border}`, background:'transparent', color:'#fff', fontSize:13, cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={() => placePaperTrade(tradeModal)} style={{flex:2, padding:'10px', borderRadius:8, border:'none', background:C.accent, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer'}}>
                Place Paper Trade →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
