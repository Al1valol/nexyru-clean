import React, { useState, useEffect } from 'react';

export default function MobileDashboard({ trades, session, activeAccount, accounts, onSwitchAccount, onAddAccount, onAddTrade, onImport }) {
  const [tab, setTab] = useState('overview');
  const [showAccounts, setShowAccounts] = useState(false);

  const activeTrades = trades || [];
  const totalPnl = activeTrades.reduce((s,t) => s+(t.pnl||0), 0);
  const startingBalance = activeAccount?.startingBalance ?? 100000;
  const displayBalance = startingBalance + totalPnl;
  const wins = activeTrades.filter(t => (t.pnl||0) > 0);
  const losses = activeTrades.filter(t => (t.pnl||0) < 0);
  const winRate = activeTrades.length ? Math.round(wins.length/activeTrades.length*100) : 0;
  const avgWin = wins.length ? wins.reduce((s,t)=>s+(t.pnl||0),0)/wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s,t)=>s+(t.pnl||0),0)/losses.length) : 0;
  const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : 0;
  const bestTrade = activeTrades.length ? Math.max(...activeTrades.map(t=>t.pnl||0)) : 0;
  const worstTrade = activeTrades.length ? Math.min(...activeTrades.map(t=>t.pnl||0)) : 0;

  // Group trades by date for calendar
  const tradesByDate = activeTrades.reduce((acc,t) => {
    const d = new Date(t.date).toDateString();
    if (!acc[d]) acc[d] = {pnl:0, count:0};
    acc[d].pnl += (t.pnl||0);
    acc[d].count++;
    return acc;
  }, {});

  const fmt = (n) => {
    const abs = Math.abs(n);
    const str = abs.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
    return (n >= 0 ? '+$' : '-$') + str;
  };

  const s = {
    bg: '#080808',
    card: {background:'#111111', border:'1px solid #1e1e2a', borderRadius:12},
    green: '#22c55e',
    red: '#ef4444',
    accent: '#6366f1',
    muted: '#6b7280',
  };

  return (
    <div style={{background:s.bg, minHeight:'100vh', maxWidth:'100vw', overflowX:'hidden', fontFamily:'system-ui,-apple-system', paddingBottom:72}}>

      {/* TOP BAR */}
      <div style={{position:'sticky', top:0, zIndex:200, background:'rgba(8,8,8,0.95)', backdropFilter:'blur(10px)', borderBottom:'1px solid #1e1e2a', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <span style={{fontSize:18, fontWeight:800, color:'#fff', letterSpacing:'-0.02em'}}>Nexyru</span>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <div style={{fontSize:11, color:s.muted}}>{session?.username}</div>
          <div style={{width:30, height:30, borderRadius:'50%', background:s.accent, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:12, fontWeight:700}}>
            {(session?.username||'?')[0].toUpperCase()}
          </div>
        </div>
      </div>

      {/* TAB BAR */}
      <div style={{display:'flex', borderBottom:'1px solid #1e1e2a', background:'#0a0a0f', padding:'0 16px'}}>
        {[
          {id:'overview', label:'Overview'},
          {id:'trades', label:'Trades'},
          {id:'calendar', label:'Calendar'},
        ].map(({id, label}) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding:'12px 16px', border:'none', background:'transparent',
            color: tab===id ? '#fff' : s.muted,
            fontSize:13, fontWeight: tab===id ? 700 : 500,
            borderBottom: tab===id ? `2px solid ${s.accent}` : '2px solid transparent',
            cursor:'pointer', marginBottom:-1
          }}>{label}</button>
        ))}
      </div>

      <div style={{padding:16}}>

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div>
            {/* Big balance card - tappable to switch accounts */}
            <div onClick={() => setShowAccounts(true)} style={{...s.card, padding:20, marginBottom:12, background:'linear-gradient(135deg, #111111, #0f0f18)', cursor:'pointer', position:'relative'}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6}}>
                <div style={{fontSize:11, color:s.muted, textTransform:'uppercase', letterSpacing:'0.08em'}}>
                  {activeAccount?.name || 'Paper Account'}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
              <div style={{fontSize:36, fontWeight:800, color:'#fff', letterSpacing:'-0.02em', marginBottom:4}}>
                ${displayBalance.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}
              </div>
              <div style={{fontSize:14, color: totalPnl>=0 ? s.green : s.red, fontWeight:600}}>
                {fmt(totalPnl)} all time
              </div>
            </div>

            {/* Key stats 2x2 */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12}}>
              {[
                {label:'Win Rate', value:winRate+'%', color:'#a78bfa'},
                {label:'Profit Factor', value: profitFactor > 0 ? profitFactor.toFixed(2) : 'N/A', color:'#38bdf8'},
                {label:'Total Trades', value:activeTrades.length, color:'#fff'},
                {label:'Avg Win', value: avgWin > 0 ? '+$'+avgWin.toFixed(2) : '$0', color:s.green},
              ].map(({label,value,color}) => (
                <div key={label} style={{...s.card, padding:'14px 16px'}}>
                  <div style={{fontSize:10, color:s.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>{label}</div>
                  <div style={{fontSize:20, fontWeight:700, color}}>{value}</div>
                </div>
              ))}
            </div>

            {/* Best/Worst */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12}}>
              <div style={{...s.card, padding:'14px 16px', borderColor:'rgba(34,197,94,0.2)'}}>
                <div style={{fontSize:10, color:s.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Best Trade</div>
                <div style={{fontSize:18, fontWeight:700, color:s.green}}>+${bestTrade.toFixed(2)}</div>
              </div>
              <div style={{...s.card, padding:'14px 16px', borderColor:'rgba(239,68,68,0.2)'}}>
                <div style={{fontSize:10, color:s.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6}}>Worst Trade</div>
                <div style={{fontSize:18, fontWeight:700, color:s.red}}>${worstTrade.toFixed(2)}</div>
              </div>
            </div>

            {/* Recent trades - just 5, clean */}
            <div style={{fontSize:11, color:s.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, marginTop:4}}>Recent</div>
            {activeTrades.slice(0,5).map(t => (
              <div key={t.id} style={{...s.card, padding:'12px 16px', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                <div>
                  <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:2}}>
                    <span style={{fontSize:14, fontWeight:700, color:'#fff'}}>{t.pair||t.symbol}</span>
                    <span style={{fontSize:10, padding:'2px 6px', borderRadius:4, background:t.type==='long'?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)', color:t.type==='long'?s.green:s.red, fontWeight:700}}>
                      {(t.type||'').toUpperCase()}
                    </span>
                  </div>
                  <div style={{fontSize:11, color:s.muted}}>
                    {new Date(t.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                  </div>
                </div>
                <div style={{fontSize:16, fontWeight:700, color:(t.pnl||0)>=0?s.green:s.red}}>
                  {fmt(t.pnl||0)}
                </div>
              </div>
            ))}

            {activeTrades.length === 0 && (
              <div style={{...s.card, padding:32, textAlign:'center', marginTop:8}}>
                <div style={{color:s.muted, fontSize:13, marginBottom:16}}>No trades yet</div>
                <div style={{fontSize:12, color:'#374151'}}>Import trades on desktop to see your stats here</div>
              </div>
            )}
          </div>
        )}

        {/* TRADES TAB */}
        {tab === 'trades' && (
          <div>
            <div style={{fontSize:11, color:s.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12}}>
              {activeTrades.length} trades
            </div>
            {activeTrades.map(t => (
              <div key={t.id} style={{...s.card, padding:'12px 16px', marginBottom:8, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                <div style={{minWidth:0, flex:1}}>
                  <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:2}}>
                    <span style={{fontSize:13, fontWeight:700, color:'#fff'}}>{t.pair||t.symbol}</span>
                    <span style={{fontSize:10, padding:'2px 6px', borderRadius:4, background:t.type==='long'?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)', color:t.type==='long'?s.green:s.red, fontWeight:700}}>
                      {(t.type||'').toUpperCase()}
                    </span>
                  </div>
                  <div style={{fontSize:11, color:s.muted}}>
                    {new Date(t.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                    {t.entryPrice ? ` · ${t.entryPrice} → ${t.exitPrice||'?'}` : ''}
                  </div>
                </div>
                <div style={{fontSize:15, fontWeight:700, color:(t.pnl||0)>=0?s.green:s.red, flexShrink:0, marginLeft:12}}>
                  {fmt(t.pnl||0)}
                </div>
              </div>
            ))}
            {activeTrades.length === 0 && (
              <div style={{...s.card, padding:32, textAlign:'center'}}>
                <div style={{color:s.muted, fontSize:13}}>No trades yet — import on desktop</div>
              </div>
            )}
          </div>
        )}

        {/* CALENDAR TAB */}
        {tab === 'calendar' && (() => {
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth();
          const daysInMonth = new Date(year, month+1, 0).getDate();
          const firstDay = new Date(year, month, 1).getDay();
          const monthName = now.toLocaleString('default',{month:'long'});

          return (
            <div>
              <div style={{fontSize:15, fontWeight:700, color:'#fff', marginBottom:16}}>
                {monthName} {year}
              </div>
              <div style={{...s.card, padding:16, marginBottom:16}}>
                <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:10}}>
                  {['S','M','T','W','T','F','S'].map((d,i) => (
                    <div key={i} style={{textAlign:'center', fontSize:11, color:s.muted, fontWeight:600, padding:'4px 0'}}>{d}</div>
                  ))}
                </div>
                <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3}}>
                  {Array.from({length:firstDay}).map((_,i) => <div key={'e'+i}/>)}
                  {Array.from({length:daysInMonth}).map((_,i) => {
                    const day = i+1;
                    const dateStr = new Date(year,month,day).toDateString();
                    const dayData = tradesByDate[dateStr];
                    const isToday = day === now.getDate();
                    return (
                      <div key={day} style={{
                        aspectRatio:'1', display:'flex', flexDirection:'column',
                        alignItems:'center', justifyContent:'center',
                        borderRadius:8, fontSize:12, fontWeight: isToday ? 800 : 500,
                        background: dayData ? (dayData.pnl>=0?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)') : 'transparent',
                        border: isToday ? `1px solid ${s.accent}` : '1px solid transparent',
                        color: dayData ? (dayData.pnl>=0?s.green:s.red) : isToday ? '#fff' : '#374151',
                      }}>
                        {day}
                        {dayData && <div style={{fontSize:8, marginTop:1}}>{dayData.count}t</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* This month stats */}
              <div style={{fontSize:11, color:s.muted, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8}}>This Month</div>
              {(() => {
                const monthTrades = activeTrades.filter(t => {
                  const d = new Date(t.date);
                  return d.getMonth() === month && d.getFullYear() === year;
                });
                const monthPnl = monthTrades.reduce((s,t)=>s+(t.pnl||0),0);
                const monthWins = monthTrades.filter(t=>(t.pnl||0)>0).length;
                return (
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
                    {[
                      {label:'PnL', value:fmt(monthPnl), color:monthPnl>=0?s.green:s.red},
                      {label:'Trades', value:monthTrades.length, color:'#fff'},
                      {label:'Win Rate', value:monthTrades.length?Math.round(monthWins/monthTrades.length*100)+'%':'0%', color:'#a78bfa'},
                    ].map(({label,value,color}) => (
                      <div key={label} style={{...s.card, padding:'12px 10px', textAlign:'center'}}>
                        <div style={{fontSize:9, color:s.muted, textTransform:'uppercase', marginBottom:4}}>{label}</div>
                        <div style={{fontSize:14, fontWeight:700, color}}>{value}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          );
        })()}

      </div>

      {/* BOTTOM NAV - simple, just 4 items */}
      <nav style={{position:'fixed', bottom:0, left:0, right:0, height:60, background:'#0f0f14', borderTop:'1px solid #1e1e2a', display:'flex', alignItems:'stretch', zIndex:9999, paddingBottom:'env(safe-area-inset-bottom)'}}>
        {[
          {id:'overview', label:'Overview', path:'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'},
          {id:'trades', label:'Trades', path:'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'},
          {id:'calendar', label:'Calendar', path:'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'},
        ].map(({id,label,path}) => (
          <button key={id} onClick={() => setTab(id)} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, border:'none', background:'transparent', cursor:'pointer', color: tab===id ? '#6366f1' : '#6b7280', fontSize:10, fontWeight:600}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d={path}/>
            </svg>
            {label}
          </button>
        ))}
        <a href="/settings" style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, textDecoration:'none', color:'#6b7280', fontSize:10, fontWeight:600}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Settings
        </a>
      </nav>

      {/* ACCOUNTS SHEET */}
      {showAccounts && (
        <>
          <div onClick={() => setShowAccounts(false)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:10000}}/>
          <div style={{position:'fixed', bottom:0, left:0, right:0, zIndex:10001, background:'#0f0f14', borderRadius:'20px 20px 0 0', borderTop:'1px solid #1e1e2a', padding:20, maxHeight:'70vh', overflowY:'auto', paddingBottom:'calc(20px + env(safe-area-inset-bottom))'}}>
            <div style={{width:36, height:4, borderRadius:2, background:'#2a2a3a', margin:'0 auto 16px'}}/>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
              <span style={{color:'#fff', fontWeight:700, fontSize:15}}>Switch Account</span>
              <button onClick={() => setShowAccounts(false)} style={{background:'#1a1a24', border:'1px solid #2a2a3a', borderRadius:8, color:'#9ca3af', width:32, height:32, cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center'}}>×</button>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:8, marginBottom:12}}>
              {(accounts || []).map(acc => {
                const isActive = acc.id === activeAccount?.id;
                const typeColor = acc.type === 'funded' ? '#22c55e' : '#9ca3af';
                const typeBg = acc.type === 'funded' ? 'rgba(34,197,94,0.12)' : 'rgba(156,163,175,0.12)';
                return (
                  <button key={acc.id} onClick={() => { onSwitchAccount && onSwitchAccount(acc.id); setShowAccounts(false); }} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'14px 16px', borderRadius:12,
                    background: isActive ? 'rgba(99,102,241,0.12)' : '#1a1a24',
                    border: `1px solid ${isActive ? s.accent : '#2a2a3a'}`,
                    cursor:'pointer', textAlign:'left', width:'100%'
                  }}>
                    <div style={{minWidth:0, flex:1}}>
                      <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
                        <span style={{fontSize:14, fontWeight:700, color:'#fff'}}>{acc.name}</span>
                        <span style={{fontSize:9, padding:'2px 6px', borderRadius:4, background:typeBg, color:typeColor, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em'}}>
                          {acc.type}
                        </span>
                      </div>
                      <div style={{fontSize:13, color:s.muted, fontWeight:600}}>
                        ${(acc.balance || 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}
                      </div>
                    </div>
                    {isActive && (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={s.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            <button onClick={() => { setShowAccounts(false); onAddAccount && onAddAccount('New Paper Account', 'paper', 100000); }} style={{
              width:'100%', padding:'14px 16px', borderRadius:12,
              background:'transparent', border:`1px dashed ${s.accent}`,
              color:s.accent, fontSize:13, fontWeight:700, cursor:'pointer'
            }}>
              + New Account
            </button>
          </div>
        </>
      )}

      {/* Keep modals working */}
      {/* showForm and showHub modals are handled by parent TradingDashboard */}
    </div>
  );
}
