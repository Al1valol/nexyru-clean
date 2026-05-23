'use client'
import { useState, useEffect } from 'react'

interface Airdrop {
  id: string
  name: string
  logo: string
  chain: string
  chainColor: string
  category: string
  description: string
  estimatedValue: string
  probability: 'HIGH' | 'MEDIUM' | 'LOW'
  deadline?: string
  daysLeft?: number
  vcBacking: string[]
  totalRaised: string
  tasks: Task[]
  links: {label: string, url: string}[]
  tips: string
  confirmed: boolean
  status: 'active' | 'ended' | 'claimed'
}

interface Task {
  id: string
  label: string
  description: string
  cost: string
  difficulty: 'easy' | 'medium' | 'hard'
  completed: boolean
  link: string
}

interface Progress {
  [airdropId: string]: {
    [taskId: string]: boolean
  }
}

export default function AirdropsPage() {
  const [progress, setProgress] = useState<Progress>({})
  const [filter, setFilter] = useState<'all'|'confirmed'|'likely'|'completed'>('all')
  const [chainFilter, setChainFilter] = useState('all')
  const [section, setSection] = useState<'airdrops'|'daily'|'learn'>('airdrops')
  const [isMobile, setIsMobile] = useState(false)
  const [expandedId, setExpandedId] = useState<string|null>(null)

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem('airdrop_progress') || '{}')
      setProgress(p)
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

  const airdrops: Airdrop[] = [
    {
      id: 'sonic',
      name: 'Sonic SVM',
      logo: '🎮',
      chain: 'Solana',
      chainColor: '#9945ff',
      category: 'Gaming/L2',
      description: 'First gaming chain on Solana. $12M raised. No token yet. Confirmed airdrop coming.',
      estimatedValue: '$200-2,000',
      probability: 'HIGH',
      vcBacking: ['Bitkraft', 'Solana Ventures'],
      totalRaised: '$12M',
      confirmed: true,
      status: 'active',
      tips: 'Play games daily for max points. The more you play the bigger your allocation.',
      tasks: [
        {id:'sonic1', label:'Create account on Sonic', description:'Sign up at app.sonic.game', cost:'Free', difficulty:'easy', completed:false, link:'https://app.sonic.game'},
        {id:'sonic2', label:'Play games daily', description:'Play any game for 15+ mins per day to earn points', cost:'Free', difficulty:'easy', completed:false, link:'https://app.sonic.game'},
        {id:'sonic3', label:'Complete daily check-in', description:'Check in every day for streak bonus', cost:'Free', difficulty:'easy', completed:false, link:'https://app.sonic.game'},
        {id:'sonic4', label:'Join Discord and verify', description:'Join Sonic Discord and verify your wallet', cost:'Free', difficulty:'easy', completed:false, link:'https://discord.gg/sonic'},
      ],
      links: [{label:'App', url:'https://app.sonic.game'},{label:'Twitter', url:'https://twitter.com/SonicSVM'}],
    },
    {
      id: 'kamino',
      name: 'Kamino Finance',
      logo: '🏦',
      chain: 'Solana',
      chainColor: '#9945ff',
      category: 'DeFi',
      description: 'Largest lending protocol on Solana. $34M TVL. No token. Very likely to airdrop.',
      estimatedValue: '$300-3,000',
      probability: 'HIGH',
      vcBacking: ['Multicoin', 'Sequoia'],
      totalRaised: '$10M',
      confirmed: false,
      status: 'active',
      tips: 'Supply and borrow assets to earn points. More TVL = bigger allocation.',
      tasks: [
        {id:'kamino1', label:'Connect wallet to Kamino', description:'Go to kamino.finance and connect Phantom wallet', cost:'Free', difficulty:'easy', completed:false, link:'https://kamino.finance'},
        {id:'kamino2', label:'Supply SOL or USDC', description:'Supply at least $10-50 to earn points', cost:'$10-50 minimum', difficulty:'easy', completed:false, link:'https://kamino.finance'},
        {id:'kamino3', label:'Borrow against collateral', description:'Borrow a small amount to increase your points multiplier', cost:'Gas ~$0.01', difficulty:'medium', completed:false, link:'https://kamino.finance'},
        {id:'kamino4', label:'Hold position for 30+ days', description:'Keep funds in protocol — longer = more points', cost:'Opportunity cost', difficulty:'easy', completed:false, link:'https://kamino.finance'},
      ],
      links: [{label:'App', url:'https://kamino.finance'},{label:'Twitter', url:'https://twitter.com/KaminoFinance'}],
    },
    {
      id: 'drift',
      name: 'Drift Protocol',
      logo: '📈',
      chain: 'Solana',
      chainColor: '#9945ff',
      category: 'DeFi/Perps',
      description: 'Largest perpetuals DEX on Solana. $1B+ volume. Has DRIFT token but Season 2 airdrop coming.',
      estimatedValue: '$100-1,500',
      probability: 'HIGH',
      vcBacking: ['Multicoin', 'Jump'],
      totalRaised: '$23.5M',
      confirmed: true,
      status: 'active',
      tips: 'Trade perps regularly. Even small trades count. Provide liquidity for bigger allocation.',
      tasks: [
        {id:'drift1', label:'Create Drift account', description:'Go to app.drift.trade and deposit funds', cost:'Free + gas', difficulty:'easy', completed:false, link:'https://app.drift.trade'},
        {id:'drift2', label:'Make 5+ trades', description:'Trade any perp pair. Size doesnt matter much.', cost:'Gas ~$0.001 each', difficulty:'easy', completed:false, link:'https://app.drift.trade'},
        {id:'drift3', label:'Provide liquidity', description:'Add to a liquidity pool for higher multiplier', cost:'$20-50 minimum', difficulty:'medium', completed:false, link:'https://app.drift.trade'},
        {id:'drift4', label:'Trade weekly', description:'Make at least 1 trade per week to maintain eligibility', cost:'Gas only', difficulty:'easy', completed:false, link:'https://app.drift.trade'},
      ],
      links: [{label:'App', url:'https://app.drift.trade'},{label:'Twitter', url:'https://twitter.com/DriftProtocol'}],
    },
    {
      id: 'marginfi',
      name: 'marginfi',
      logo: '💰',
      chain: 'Solana',
      chainColor: '#9945ff',
      category: 'DeFi/Lending',
      description: 'Top lending protocol on Solana. $500M+ TVL. No token yet. Strong airdrop signals.',
      estimatedValue: '$500-5,000',
      probability: 'HIGH',
      vcBacking: ['Multicoin', 'Foundation Capital'],
      totalRaised: '$19M',
      confirmed: false,
      status: 'active',
      tips: 'Supply assets and maintain positions. Early users get biggest allocations.',
      tasks: [
        {id:'mfi1', label:'Connect to marginfi', description:'Visit app.marginfi.com and connect wallet', cost:'Free', difficulty:'easy', completed:false, link:'https://app.marginfi.com'},
        {id:'mfi2', label:'Supply SOL or stablecoins', description:'Supply $10-100 to earn mrgnpoints', cost:'$10+ recommended', difficulty:'easy', completed:false, link:'https://app.marginfi.com'},
        {id:'mfi3', label:'Earn mrgnpoints daily', description:'Points accumulate while funds are deposited', cost:'None after deposit', difficulty:'easy', completed:false, link:'https://app.marginfi.com'},
        {id:'mfi4', label:'Refer friends', description:'Refer others for 10% of their points', cost:'Free', difficulty:'easy', completed:false, link:'https://app.marginfi.com'},
      ],
      links: [{label:'App', url:'https://app.marginfi.com'},{label:'Twitter', url:'https://twitter.com/marginfi'}],
    },
    {
      id: 'layerzero',
      name: 'LayerZero Season 2',
      logo: '🌐',
      chain: 'Multi-chain',
      chainColor: '#00d4ff',
      category: 'Infrastructure',
      description: 'Cross-chain messaging protocol. Already did Season 1 airdrop. Season 2 points program active.',
      estimatedValue: '$100-1,000',
      probability: 'HIGH',
      vcBacking: ['a16z', 'Sequoia', 'Coinbase'],
      totalRaised: '$263M',
      confirmed: true,
      status: 'active',
      tips: 'Bridge tokens across chains regularly. Use Stargate Finance which runs on LayerZero.',
      tasks: [
        {id:'lz1', label:'Bridge on Stargate', description:'Bridge any amount from one chain to another via Stargate', cost:'$5-15 gas', difficulty:'easy', completed:false, link:'https://stargate.finance'},
        {id:'lz2', label:'Bridge monthly', description:'Do at least 1 bridge per month to stay active', cost:'Gas per bridge', difficulty:'easy', completed:false, link:'https://stargate.finance'},
        {id:'lz3', label:'Use multiple chains', description:'Bridge between Solana, Base, Arbitrum for diversity', cost:'Gas each time', difficulty:'medium', completed:false, link:'https://stargate.finance'},
        {id:'lz4', label:'Check points on L0scan', description:'Track your LayerZero points at l0scan.com', cost:'Free', difficulty:'easy', completed:false, link:'https://l0scan.com'},
      ],
      links: [{label:'Stargate', url:'https://stargate.finance'},{label:'Twitter', url:'https://twitter.com/LayerZero_Labs'}],
    },
    {
      id: 'zksync',
      name: 'zkSync Era',
      logo: '⚡',
      chain: 'Ethereum L2',
      chainColor: '#8c8dfc',
      category: 'Infrastructure',
      description: 'Major Ethereum L2. Already airdropped ZK token. New ecosystem protocols launching = more airdrops.',
      estimatedValue: '$50-500',
      probability: 'MEDIUM',
      vcBacking: ['a16z', 'Dragonfly'],
      totalRaised: '$458M',
      confirmed: false,
      status: 'active',
      tips: 'Use protocols BUILT ON zkSync to qualify for their individual airdrops.',
      tasks: [
        {id:'zk1', label:'Bridge to zkSync', description:'Bridge $20-50 ETH to zkSync Era via official bridge', cost:'$5-15 gas', difficulty:'easy', completed:false, link:'https://bridge.zksync.io'},
        {id:'zk2', label:'Swap on SyncSwap', description:'Swap tokens on SyncSwap DEX (potential airdrop)', cost:'Gas ~$0.50', difficulty:'easy', completed:false, link:'https://syncswap.xyz'},
        {id:'zk3', label:'Use zkSync weekly', description:'Make at least 1 transaction per week', cost:'Gas each time', difficulty:'easy', completed:false, link:'https://bridge.zksync.io'},
      ],
      links: [{label:'Bridge', url:'https://bridge.zksync.io'},{label:'Twitter', url:'https://twitter.com/zksync'}],
    },
    {
      id: 'base-protocols',
      name: 'Base Ecosystem',
      logo: '🔵',
      chain: 'Base',
      chainColor: '#0052ff',
      category: 'Multi-protocol',
      description: 'Coinbase L2. Multiple protocols launching here with no tokens yet. Aerodrome, Morpho, and others likely to airdrop.',
      estimatedValue: '$200-2,000',
      probability: 'HIGH',
      vcBacking: ['Coinbase Ventures', 'a16z'],
      totalRaised: 'Coinbase backed',
      confirmed: false,
      status: 'active',
      tips: 'Use Aerodrome for LP and Morpho for lending. Both have no tokens and are prime airdrop candidates.',
      tasks: [
        {id:'base1', label:'Bridge to Base', description:'Bridge $20-50 from Ethereum or use Coinbase to Base', cost:'$1-5 gas', difficulty:'easy', completed:false, link:'https://bridge.base.org'},
        {id:'base2', label:'Swap on Aerodrome', description:'Swap tokens on Aerodrome DEX', cost:'Gas ~$0.10', difficulty:'easy', completed:false, link:'https://aerodrome.finance'},
        {id:'base3', label:'Supply on Morpho', description:'Supply USDC or ETH on Morpho lending protocol', cost:'$20 minimum recommended', difficulty:'easy', completed:false, link:'https://morpho.org'},
        {id:'base4', label:'Use Base weekly', description:'At least 1 transaction per week on Base', cost:'Almost free gas', difficulty:'easy', completed:false, link:'https://bridge.base.org'},
      ],
      links: [{label:'Aerodrome', url:'https://aerodrome.finance'},{label:'Morpho', url:'https://morpho.org'}],
    },
    {
      id: 'monad',
      name: 'Monad',
      logo: '🟣',
      chain: 'Monad',
      chainColor: '#836ef9',
      category: 'Infrastructure',
      description: 'Next gen EVM blockchain. $225M raised. Testnet live. Mainnet launch = likely massive airdrop.',
      estimatedValue: '$500-10,000',
      probability: 'HIGH',
      vcBacking: ['Paradigm', 'a16z'],
      totalRaised: '$225M',
      confirmed: false,
      status: 'active',
      tips: 'Testnet activity almost always counts for mainnet airdrops. Use the testnet NOW.',
      tasks: [
        {id:'monad1', label:'Join Monad Discord', description:'Join and get the community role', cost:'Free', difficulty:'easy', completed:false, link:'https://discord.gg/monad'},
        {id:'monad2', label:'Use Monad testnet', description:'Get testnet tokens and make transactions', cost:'Free (testnet)', difficulty:'easy', completed:false, link:'https://monad.xyz'},
        {id:'monad3', label:'Follow on Twitter', description:'Follow and engage with Monad content', cost:'Free', difficulty:'easy', completed:false, link:'https://twitter.com/monad_xyz'},
        {id:'monad4', label:'Use testnet DEX', description:'Swap on any DEX deployed on Monad testnet', cost:'Free (testnet)', difficulty:'easy', completed:false, link:'https://monad.xyz'},
      ],
      links: [{label:'Website', url:'https://monad.xyz'},{label:'Discord', url:'https://discord.gg/monad'}],
    },
  ]

  const toggleTask = (airdropId: string, taskId: string) => {
    const updated = {
      ...progress,
      [airdropId]: {
        ...(progress[airdropId] || {}),
        [taskId]: !progress[airdropId]?.[taskId]
      }
    }
    setProgress(updated)
    localStorage.setItem('airdrop_progress', JSON.stringify(updated))
  }

  const getCompletedCount = (airdrop: Airdrop) => {
    const p = progress[airdrop.id] || {}
    return airdrop.tasks.filter(t => p[t.id]).length
  }

  const filtered = airdrops
    .filter(a => filter === 'all' ? true : filter === 'confirmed' ? a.confirmed : filter === 'likely' ? !a.confirmed : getCompletedCount(a) === a.tasks.length)
    .filter(a => chainFilter === 'all' || a.chain === chainFilter)

  const chains = ['all', ...Array.from(new Set(airdrops.map(a => a.chain)))]

  const navItems = [
    {id:'airdrops', icon:'💧', label:'Airdrops'},
    {id:'daily', icon:'✅', label:'Daily Tasks'},
    {id:'learn', icon:'📚', label:'Learn'},
  ]

  const probColor = (p: string) => p === 'HIGH' ? C.green : p === 'MEDIUM' ? C.yellow : C.muted
  const probBg = (p: string) => p === 'HIGH' ? 'rgba(34,197,94,0.15)' : p === 'MEDIUM' ? 'rgba(245,158,11,0.15)' : 'rgba(107,114,128,0.15)'

  return (
    <div style={{background:C.bg, minHeight:'100vh', color:C.text, fontFamily:'system-ui,sans-serif'}}>

      {isMobile && (
        <div style={{display:'flex', background:'#0a0a0f', borderBottom:`1px solid ${C.border}`, padding:'0 2px'}}>
          {[
            {label:'📈', href:'/dashboard'},
            {label:'🪙', href:'/crypto'},
            {label:'🎰', href:'/sports'},
            {label:'📊', href:'/options'},
            {label:'💧', href:'/airdrops', active:true},
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
              {label:'💧 Airdrops', href:'/airdrops', active:true},
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
        <div style={{fontSize: isMobile?15:18, fontWeight:800}}>💧 Airdrop Hunter</div>
        <a href="/morning" style={{fontSize:11, color:'#a5b4fc', textDecoration:'none', padding:'6px 10px', borderRadius:6, border:'1px solid rgba(99,102,241,0.3)'}}>⬡ JARVIS</a>
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
              <div style={{fontSize:10, color:C.muted, marginBottom:6}}>YOUR PROGRESS</div>
              <div style={{fontSize:12, marginBottom:2}}>
                Airdrops: <strong>{airdrops.length}</strong>
              </div>
              <div style={{fontSize:12, marginBottom:2}}>
                Tasks done: <strong style={{color:C.green}}>
                  {airdrops.reduce((s,a) => s + getCompletedCount(a), 0)}
                </strong>/{airdrops.reduce((s,a) => s + a.tasks.length, 0)}
              </div>
              <div style={{fontSize:12}}>
                Est. value: <strong style={{color:C.green}}>$1,600-25,500</strong>
              </div>
            </div>
          </div>
        )}

        <div style={{flex:1, padding: isMobile?12:20, paddingBottom: isMobile?80:20}}>

          {section === 'airdrops' && (
            <div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:8}}>
                <div>
                  <div style={{fontSize:20, fontWeight:800, marginBottom:4}}>💧 Active Airdrops</div>
                  <div style={{fontSize:12, color:C.muted}}>Complete tasks to qualify for free tokens</div>
                </div>
                <div style={{background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:8, padding:'8px 12px', fontSize:12}}>
                  <span style={{color:C.muted}}>Total est. value: </span>
                  <strong style={{color:C.green}}>$1,600 - $25,500</strong>
                </div>
              </div>

              <div style={{background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:10, padding:12, marginBottom:16, fontSize:12, color:'#fbbf24', lineHeight:1.6}}>
                ⚠️ <strong>Airdrop risk:</strong> Not guaranteed. Only invest time and gas fees you can afford to lose. Never share your seed phrase. Only use official links.
              </div>

              <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap'}}>
                <div style={{display:'flex', gap:4}}>
                  {[
                    {id:'all', label:'All'},
                    {id:'confirmed', label:'✅ Confirmed'},
                    {id:'likely', label:'🔮 Likely'},
                  ].map(f => (
                    <button key={f.id} onClick={() => setFilter(f.id as any)} style={{
                      padding:'5px 12px', borderRadius:6, fontSize:12,
                      fontWeight: filter===f.id?700:400,
                      border:`1px solid ${filter===f.id?C.accent:C.border}`,
                      background: filter===f.id?'rgba(99,102,241,0.15)':'transparent',
                      color: filter===f.id?'#a5b4fc':C.muted, cursor:'pointer'
                    }}>{f.label}</button>
                  ))}
                </div>
                <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                  {chains.map(c => (
                    <button key={c} onClick={() => setChainFilter(c)} style={{
                      padding:'5px 12px', borderRadius:6, fontSize:12,
                      fontWeight: chainFilter===c?700:400,
                      border:`1px solid ${chainFilter===c?C.accent:C.border}`,
                      background: chainFilter===c?'rgba(99,102,241,0.15)':'transparent',
                      color: chainFilter===c?'#a5b4fc':C.muted, cursor:'pointer',
                      whiteSpace:'nowrap'
                    }}>{c}</button>
                  ))}
                </div>
              </div>

              {filtered.map(airdrop => {
                const completed = getCompletedCount(airdrop)
                const total = airdrop.tasks.length
                const pct = Math.round(completed/total*100)
                const isExpanded = expandedId === airdrop.id

                return (
                  <div key={airdrop.id} style={{
                    background:C.card,
                    border:`1px solid ${airdrop.confirmed?'rgba(34,197,94,0.3)':C.border}`,
                    borderRadius:12, marginBottom:12, overflow:'hidden'
                  }}>
                    <div style={{padding:16, cursor:'pointer'}} onClick={() => setExpandedId(isExpanded ? null : airdrop.id)}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10}}>
                        <div style={{display:'flex', alignItems:'center', gap:10}}>
                          <span style={{fontSize:28}}>{airdrop.logo}</span>
                          <div>
                            <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:2}}>
                              <span style={{fontSize:16, fontWeight:800}}>{airdrop.name}</span>
                              {airdrop.confirmed && <span style={{fontSize:10, padding:'2px 6px', borderRadius:4, background:'rgba(34,197,94,0.15)', color:C.green, fontWeight:700}}>✅ CONFIRMED</span>}
                            </div>
                            <div style={{display:'flex', gap:6, alignItems:'center'}}>
                              <span style={{fontSize:11, padding:'2px 6px', borderRadius:4, background:`${airdrop.chainColor}22`, color:airdrop.chainColor, fontWeight:600}}>{airdrop.chain}</span>
                              <span style={{fontSize:11, color:C.muted}}>{airdrop.category}</span>
                            </div>
                          </div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:14, fontWeight:800, color:C.green, marginBottom:2}}>{airdrop.estimatedValue}</div>
                          <span style={{fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:4, background:probBg(airdrop.probability), color:probColor(airdrop.probability)}}>
                            {airdrop.probability} prob.
                          </span>
                        </div>
                      </div>

                      <div style={{fontSize:12, color:'#9ca3af', marginBottom:10, lineHeight:1.5}}>{airdrop.description}</div>

                      <div style={{marginBottom:8}}>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:11, color:C.muted, marginBottom:4}}>
                          <span>Progress: {completed}/{total} tasks</span>
                          <span style={{color: pct===100?C.green:C.muted}}>{pct}%</span>
                        </div>
                        <div style={{height:6, background:'#1a1a24', borderRadius:3, overflow:'hidden'}}>
                          <div style={{height:'100%', width:`${pct}%`, background:pct===100?C.green:C.accent, borderRadius:3, transition:'width 0.3s'}}/>
                        </div>
                      </div>

                      <div style={{fontSize:11, color:C.muted, display:'flex', gap:12, flexWrap:'wrap'}}>
                        <span>Raised: <strong style={{color:C.text}}>{airdrop.totalRaised}</strong></span>
                        <span>VCs: <strong style={{color:C.text}}>{airdrop.vcBacking.join(', ')}</strong></span>
                        <span style={{color:C.accent}}>{isExpanded ? '▲ Less' : '▼ See tasks'}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{borderTop:`1px solid ${C.border}`, padding:16}}>
                        <div style={{fontSize:13, fontWeight:700, marginBottom:4}}>💡 Pro tip: {airdrop.tips}</div>

                        <div style={{fontSize:12, fontWeight:700, color:C.muted, marginBottom:10, marginTop:12, textTransform:'uppercase'}}>Tasks to complete:</div>

                        {airdrop.tasks.map(task => {
                          const done = progress[airdrop.id]?.[task.id] || false
                          return (
                            <div key={task.id} style={{
                              display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px',
                              background: done ? 'rgba(34,197,94,0.05)' : '#1a1a24',
                              border:`1px solid ${done?'rgba(34,197,94,0.2)':C.border}`,
                              borderRadius:8, marginBottom:8
                            }}>
                              <button onClick={() => toggleTask(airdrop.id, task.id)} style={{
                                width:22, height:22, borderRadius:4, flexShrink:0,
                                border:`2px solid ${done?C.green:C.muted}`,
                                background: done?C.green:'transparent',
                                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                                color:'#fff', fontSize:12, marginTop:1
                              }}>
                                {done ? '✓' : ''}
                              </button>
                              <div style={{flex:1}}>
                                <div style={{fontSize:13, fontWeight:600, color: done?C.muted:C.text, textDecoration:done?'line-through':'none', marginBottom:2}}>
                                  {task.label}
                                </div>
                                <div style={{fontSize:11, color:C.muted, marginBottom:4}}>{task.description}</div>
                                <div style={{display:'flex', gap:8, alignItems:'center'}}>
                                  <span style={{fontSize:10, padding:'2px 6px', borderRadius:4, background:'rgba(99,102,241,0.1)', color:'#a5b4fc'}}>
                                    {task.difficulty}
                                  </span>
                                  <span style={{fontSize:10, color:C.muted}}>Cost: {task.cost}</span>
                                  <a href={task.link} target="_blank" rel="noreferrer" style={{fontSize:10, color:C.accent, textDecoration:'none'}}>
                                    Go →
                                  </a>
                                </div>
                              </div>
                            </div>
                          )
                        })}

                        <div style={{display:'flex', gap:8, marginTop:12, flexWrap:'wrap'}}>
                          {airdrop.links.map(link => (
                            <a key={link.url} href={link.url} target="_blank" rel="noreferrer" style={{
                              padding:'7px 14px', borderRadius:8,
                              border:`1px solid ${C.accent}40`,
                              background:'rgba(99,102,241,0.08)',
                              color:'#a5b4fc', fontSize:12, fontWeight:700, textDecoration:'none'
                            }}>{link.label} →</a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {section === 'daily' && (
            <div>
              <div style={{fontSize:20, fontWeight:800, marginBottom:4}}>✅ Daily Tasks</div>
              <div style={{fontSize:12, color:C.muted, marginBottom:16}}>Quick tasks to do every day — takes 15-30 mins total</div>

              <div style={{background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:10, padding:12, marginBottom:20, fontSize:12, color:'#86efac', lineHeight:1.6}}>
                💡 <strong>Daily habit:</strong> Open this page every morning. Complete unchecked tasks. Close it. Takes 15-30 mins. Consistency = bigger airdrops.
              </div>

              {airdrops.map(airdrop => {
                const easyTasks = airdrop.tasks.filter(t => t.difficulty === 'easy')
                const hasUncompleted = easyTasks.some(t => !progress[airdrop.id]?.[t.id])

                return (
                  <div key={airdrop.id} style={{background:C.card, border:`1px solid ${!hasUncompleted?'rgba(34,197,94,0.3)':C.border}`, borderRadius:12, padding:16, marginBottom:12}}>
                    <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
                      <span style={{fontSize:22}}>{airdrop.logo}</span>
                      <div>
                        <div style={{fontSize:14, fontWeight:700}}>{airdrop.name}</div>
                        <div style={{fontSize:11, color:C.muted}}>{airdrop.chain} · {airdrop.estimatedValue}</div>
                      </div>
                      {!hasUncompleted && <span style={{marginLeft:'auto', fontSize:12, color:C.green, fontWeight:700}}>✅ All done!</span>}
                    </div>

                    {easyTasks.map(task => {
                      const done = progress[airdrop.id]?.[task.id] || false
                      return (
                        <div key={task.id} style={{
                          display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
                          background:'#1a1a24', borderRadius:6, marginBottom:6,
                          opacity: done ? 0.6 : 1
                        }}>
                          <button onClick={() => toggleTask(airdrop.id, task.id)} style={{
                            width:20, height:20, borderRadius:4, flexShrink:0,
                            border:`2px solid ${done?C.green:C.muted}`,
                            background:done?C.green:'transparent',
                            cursor:'pointer', color:'#fff', fontSize:11
                          }}>
                            {done?'✓':''}
                          </button>
                          <span style={{fontSize:12, flex:1, color:done?C.muted:C.text, textDecoration:done?'line-through':'none'}}>
                            {task.label}
                          </span>
                          <a href={task.link} target="_blank" rel="noreferrer" style={{fontSize:11, color:C.accent, textDecoration:'none', flexShrink:0}}>Go →</a>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          {section === 'learn' && (
            <div>
              <div style={{fontSize:20, fontWeight:800, marginBottom:4}}>📚 How Airdrops Work</div>
              <div style={{fontSize:12, color:C.muted, marginBottom:20}}>Everything you need to know</div>

              {[
                {title:'What is an airdrop?', content:'When a crypto project launches a token, they often give free tokens to early users as a reward for using their protocol before launch. This is called an airdrop. You can receive hundreds or thousands of dollars worth of tokens just for using an app.', example:'Jupiter (Solana DEX) gave $800+ in free JUP tokens to everyone who had made at least 1 swap before the snapshot date.'},
                {title:'How to qualify', content:'Each project sets their own rules. Usually you need to: use the protocol (swap, lend, bridge), hold positions for a minimum time, and be active regularly. The more you use the protocol the bigger your allocation.', example:'Arbitrum airdrop — users who made 10+ transactions got 1,750 ARB ($2,100). Users who made 3 transactions got 625 ARB ($750).'},
                {title:'What is a snapshot?', content:'A snapshot is when the project takes a photo of all wallets that qualify. After the snapshot your past activity is locked in — you either qualify or you don\'t. You need to be active BEFORE the snapshot which is usually unannounced.', example:'This is why you need to start NOW, not when the airdrop is announced. By then it\'s too late.'},
                {title:'How much does it cost?', content:'On Solana almost nothing — gas is less than $0.01 per transaction. On Base and Arbitrum gas is $0.10-2.00 per transaction. Avoid Ethereum mainnet where gas is $5-50. Your main cost is the capital you put into protocols temporarily.', example:'To qualify for Kamino Finance airdrop: deposit $20 USDC, pay $0.01 gas, leave for 30 days, withdraw. Total cost: ~$0.01 in gas + opportunity cost on $20.'},
                {title:'Rug pulls and scams', content:'NEVER share your seed phrase. NEVER approve random contracts. Only use official links from verified Twitter accounts or the official Discord. Fake airdrop websites are the #1 crypto scam.', example:'Real airdrops: you go to THEIR app and connect wallet. Fake airdrops: they ask you to enter your seed phrase or send tokens first. Always fake.'},
                {title:'Tax implications', content:'In most countries airdrop tokens are taxed as income at the fair market value when you receive them. Keep records of what you received and when. Consult a crypto-savvy accountant.', example:'You receive 1,000 tokens at $1 each = $1,000 taxable income. If they go to $5 and you sell = $4,000 additional capital gains.'},
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
    </div>
  )
}
