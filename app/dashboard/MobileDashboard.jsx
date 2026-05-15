import React, { useState } from 'react';

export default function MobileDashboard({
  trades,
  session,
  activeAccount,
  onAddTrade,
  onImport,
  showForm,
  showHub,
}) {
  const [tab, setTab] = useState('home');
  const [showTools, setShowTools] = useState(false);

  const activeTrades = trades || [];
  const totalPnl = activeTrades.reduce((s, t) => s + (t.pnl || 0), 0);
  const wins = activeTrades.filter(t => (t.pnl || 0) > 0);
  const winRate = activeTrades.length ? Math.round(wins.length / activeTrades.length * 100) : 0;

  const s = {
    bg: '#080808',
    card: { background: '#111111', border: '1px solid #1e1e2a', borderRadius: 12, padding: 16 },
    label: { fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 },
    title: { fontSize: 18, fontWeight: 700, color: '#ffffff', marginBottom: 4 },
    green: '#22c55e',
    red: '#ef4444',
    accent: 'var(--accent, #6366f1)',
  };

  return (
    <div style={{ background: s.bg, minHeight: '100vh', maxWidth: '100vw', overflowX: 'hidden', fontFamily: 'system-ui, -apple-system', paddingBottom: 72 }}>

      {/* TOP BAR */}
      <div style={{ position: 'sticky', top: 0, zIndex: 200, background: '#0f0f14', borderBottom: '1px solid #1e1e2a', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>Nexyru</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{session?.username}</span>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: s.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>
            {(session?.username || '?')[0].toUpperCase()}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: '16px 16px 0' }}>

        {/* HOME TAB */}
        {tab === 'home' && (
          <div>
            <div style={{ ...s.card, marginBottom: 12 }}>
              <div style={s.label}>{activeAccount?.name || 'Paper Account'}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', marginBottom: 12 }}>
                ${(activeAccount?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { l: 'Total PnL', v: (totalPnl >= 0 ? '+' : '') + totalPnl.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }), c: totalPnl >= 0 ? s.green : s.red },
                  { l: 'Win Rate', v: winRate + '%', c: '#a78bfa' },
                  { l: 'Trades', v: activeTrades.length, c: '#fff' },
                  { l: 'Best Trade', v: activeTrades.length ? '+$' + Math.max(...activeTrades.map(t => t.pnl || 0)).toFixed(2) : '$0', c: s.green },
                ].map(({ l, v, c }) => (
                  <div key={l} style={{ background: '#1a1a24', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: c, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Recent Trades</div>
            {activeTrades.length === 0 ? (
              <div style={{ ...s.card, textAlign: 'center', padding: 32 }}>
                <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>No trades yet</div>
                <button onClick={onImport} style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.4)', background: 'transparent', color: '#6366f1', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginRight: 8 }}>Import CSV</button>
                <button onClick={onAddTrade} style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: s.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Log Trade</button>
              </div>
            ) : activeTrades.slice(0, 10).map(t => (
              <div key={t.id} style={{ ...s.card, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{t.pair || t.symbol}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: t.type === 'long' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: t.type === 'long' ? s.green : s.red, flexShrink: 0 }}>
                      {(t.type || '').toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: (t.pnl || 0) >= 0 ? s.green : s.red, flexShrink: 0, marginLeft: 12 }}>
                  {(t.pnl || 0) >= 0 ? '+' : ''}{(t.pnl || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* JOURNAL TAB */}
        {tab === 'journal' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={s.title}>Journal</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{activeTrades.length} trades</div>
              </div>
              <button onClick={onImport} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.4)', background: 'transparent', color: '#6366f1', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Import CSV</button>
            </div>
            {activeTrades.length === 0 ? (
              <div style={{ ...s.card, textAlign: 'center', padding: 32 }}>
                <div style={{ color: '#6b7280', fontSize: 13 }}>No trades yet — import a CSV to get started</div>
              </div>
            ) : activeTrades.map(t => (
              <div key={t.id} style={{ ...s.card, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{t.pair || t.symbol}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: t.type === 'long' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: t.type === 'long' ? s.green : s.red, flexShrink: 0 }}>
                      {(t.type || '').toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {t.strategy || 'No strategy'}</div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: (t.pnl || 0) >= 0 ? s.green : s.red, flexShrink: 0, marginLeft: 12 }}>
                  {(t.pnl || 0) >= 0 ? '+' : ''}{(t.pnl || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* FLOATING + BUTTON */}
      <button
        onClick={onAddTrade}
        style={{ position: 'fixed', bottom: 72, right: 16, width: 56, height: 56, borderRadius: '50%', background: s.accent, border: 'none', color: '#fff', fontSize: 26, cursor: 'pointer', zIndex: 8000, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(99,102,241,0.5)', lineHeight: 1 }}
      >+</button>

      {/* BOTTOM NAV */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 56, background: '#0f0f14', borderTop: '1px solid #1e1e2a', display: 'flex', alignItems: 'stretch', zIndex: 9999 }}>
        {[
          { id: 'home', label: 'Home', icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
          { id: 'journal', label: 'Journal', icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' },
        ].map(({ id, label, icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, border: 'none', background: 'transparent', cursor: 'pointer', color: tab === id ? 'var(--accent, #6366f1)' : '#6b7280', fontSize: 10, fontWeight: 600 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d={icon} />
            </svg>
            <span>{label}</span>
          </button>
        ))}
        <a href="/notes" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textDecoration: 'none', color: '#6b7280', fontSize: 10, fontWeight: 600 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
          <span>Notes</span>
        </a>
        <button onClick={() => setShowTools(v => !v)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, border: 'none', background: 'transparent', cursor: 'pointer', color: showTools ? 'var(--accent, #6366f1)' : '#6b7280', fontSize: 10, fontWeight: 600 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="5" r="1.5" /><circle cx="12" cy="5" r="1.5" /><circle cx="19" cy="5" r="1.5" /><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /><circle cx="5" cy="19" r="1.5" /><circle cx="12" cy="19" r="1.5" /><circle cx="19" cy="19" r="1.5" /></svg>
          <span>Tools</span>
        </button>
        <a href="/settings" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textDecoration: 'none', color: '#6b7280', fontSize: 10, fontWeight: 600 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          <span>Profile</span>
        </a>
      </nav>

      {/* TOOLS SHEET */}
      {showTools && (
        <>
          <div onClick={() => setShowTools(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000 }} />
          <div style={{ position: 'fixed', bottom: 56, left: 0, right: 0, zIndex: 10001, maxHeight: '75vh', overflowY: 'auto', background: '#0f0f14', borderRadius: '20px 20px 0 0', borderTop: '1px solid #1e1e2a', padding: 20 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#2a2a3a', margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Tools</span>
              <button onClick={() => setShowTools(false)} style={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 8, color: '#9ca3af', width: 32, height: 32, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { href: '/checklist', label: 'Checklist' },
                { href: '/alerts', label: 'Alerts' },
                { href: '/challenge', label: 'Challenge' },
                { href: '/psychology', label: 'Psychology' },
                { href: '/setups', label: 'Best Setups' },
                { href: '/replay', label: 'Trade Review' },
                { href: '/notes', label: 'Daily Notes' },
                { href: '/settings', label: 'Settings' },
              ].map(item => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setShowTools(false)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 56, borderRadius: 12, background: '#1a1a24', border: '1px solid #2a2a3a', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', textAlign: 'center', padding: '12px 8px' }}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
