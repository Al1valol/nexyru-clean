// @ts-nocheck
'use client';
import { useState, useEffect } from 'react';

// All external API calls go through /api/* proxies so keys stay server-side.

const CACHE_KEY = 'jarvis_briefing';

export default function MorningBriefing() {
  const [loading, setLoading] = useState(true);
  const [briefing, setBriefing] = useState(null);
  const [todos, setTodos] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [quickStats, setQuickStats] = useState({
    winRate: 0,
    todayPnl: 0,
    arbsFound: 0,
    openCrypto: 0,
    pendingBets: 0,
    trackedArbs: 0,
  });

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const todayStamp = () => new Date().toDateString();

  // Gather everything the briefing needs from localStorage + /api/odds.
  const fetchAllData = async () => {
    const data = {};

    // 1. Trading journal stats.
    try {
      const session = JSON.parse(localStorage.getItem('tradedesk_session_v1') || '{}');
      const username = session.username || 'user';
      const trades = JSON.parse(localStorage.getItem(`tradedesk_trades_${username}_v1`) || '[]');
      const today = new Date().toDateString();
      const todayTrades = trades.filter((t) => new Date(t.date).toDateString() === today);
      const openPositions = trades.filter((t) => t.status === 'open' || !t.exitPrice);
      const recentLosses = trades.filter((t) => {
        const d = new Date(t.date);
        const diffDays = (Date.now() - d.getTime()) / 86400000;
        return diffDays < 3 && parseFloat(t.pnl) < 0;
      });
      data.trading = {
        totalTrades: trades.length,
        todayTrades: todayTrades.length,
        todayPnl: todayTrades.reduce((s, t) => s + parseFloat(t.pnl || 0), 0),
        openPositions: openPositions.length,
        recentLosses: recentLosses.length,
        winRate: trades.length ? Math.round(trades.filter((t) => parseFloat(t.pnl) > 0).length / trades.length * 100) : 0,
      };
    } catch { data.trading = null; }

    // 2. Crypto positions.
    try {
      const store = JSON.parse(localStorage.getItem('nexyru_crypto_accounts') || '{}');
      const allPositions = (store.accounts || []).flatMap((a) => a.positions || []);
      const openCrypto = allPositions.filter((p) => p.status === 'open');
      const overnightPositions = openCrypto.filter((p) => {
        const age = (Date.now() - new Date(p.entryDate).getTime()) / 3600000;
        return age > 8;
      });
      data.crypto = {
        openPositions: openCrypto.map((p) => ({ symbol: p.symbol })),
        openPositionsCount: openCrypto.length,
        overnightCount: overnightPositions.length,
        overnightPositions: overnightPositions.map((p) => ({ symbol: p.symbol })),
        totalValue: openCrypto.reduce((s, p) => s + (p.amountUSD || 0), 0),
      };
    } catch { data.crypto = null; }

    // 3. Sports betting arbs (MLB only — single API call to keep it cheap).
    try {
      const res = await fetch('/api/odds?sport=baseball_mlb&daysFrom=2');
      const body = await res.json();
      const games = Array.isArray(body?.games) ? body.games : [];
      const arbs = games.filter((game) => {
        const teamOdds = {};
        game.bookmakers?.forEach((bk) => {
          bk.markets?.[0]?.outcomes?.forEach((o) => {
            if (!teamOdds[o.name] || o.price > teamOdds[o.name]) teamOdds[o.name] = o.price;
          });
        });
        const teams = Object.values(teamOdds);
        if (teams.length < 2) return false;
        const implied = teams.map((o) => o > 0 ? 100 / (o + 100) : Math.abs(o) / (Math.abs(o) + 100));
        return implied.reduce((s, i) => s + i, 0) < 1;
      });
      data.odds = { arbsFound: arbs.length, totalGames: games.length };
    } catch { data.odds = { arbsFound: 0, totalGames: 0 }; }

    // 4. Paper bets.
    try {
      const paperBets = JSON.parse(localStorage.getItem('nexyru_value_bets') || '[]');
      const pending = paperBets.filter((b) => b.status === 'pending');
      data.bets = { pendingBets: pending.length, totalBets: paperBets.length };
    } catch { data.bets = null; }

    // 5. Tracked arbs.
    try {
      const arbs = JSON.parse(localStorage.getItem('nexyru_arbs') || '[]');
      const pending = arbs.filter((a) => a.status === 'pending');
      data.arbs = { pendingArbs: pending.length };
    } catch { data.arbs = null; }

    return data;
  };

  const statsFromData = (data) => ({
    winRate: data?.trading?.winRate ?? 0,
    todayPnl: data?.trading?.todayPnl ?? 0,
    arbsFound: data?.odds?.arbsFound ?? 0,
    openCrypto: data?.crypto?.openPositionsCount ?? 0,
    pendingBets: data?.bets?.pendingBets ?? 0,
    trackedArbs: data?.arbs?.pendingArbs ?? 0,
  });

  const generateBriefing = async (data) => {
    const res = await fetch('/api/morning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        ...data,
      }),
    });
    const result = await res.json();
    if (!res.ok || !result?.briefing) {
      throw new Error(result?.error || `HTTP ${res.status}`);
    }
    return result.briefing;
  };

  const todosFromBriefing = (b) =>
    (b?.goals || []).map((g, i) => ({ id: i, text: g, done: false }));

  const saveCache = (next) => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch {}
  };

  const runBriefing = async ({ force = false } = {}) => {
    // Day-keyed cache: skip the API call if we already generated today's
    // briefing on this device. Refresh button passes { force: true }.
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        if (cached?.date === todayStamp() && cached.briefing) {
          setBriefing(cached.briefing);
          setTodos(cached.todos || todosFromBriefing(cached.briefing));
          if (cached.stats) setQuickStats(cached.stats);
          setLoading(false);
          return;
        }
      } catch {}
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchAllData();
      const stats = statsFromData(data);
      const parsed = await generateBriefing(data);
      const newTodos = todosFromBriefing(parsed);
      setBriefing(parsed);
      setTodos(newTodos);
      setQuickStats(stats);
      saveCache({ date: todayStamp(), briefing: parsed, todos: newTodos, stats });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runBriefing(); }, []);

  const toggleTodo = (id) => {
    setTodos((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        cached.todos = next;
        localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
      } catch {}
      return next;
    });
  };

  const s = {
    bg: '#010408',
    card: '#0a0f1a',
    border: '#0d2040',
    accent: '#00d4ff',
    green: '#00ff88',
    red: '#ff4444',
    yellow: '#ffaa00',
    muted: '#4a6080',
    text: '#c8e0f0',
  };

  // Predefined display order — drives both rendering and the cache shape.
  const sections = [
    { key: 'greeting', icon: '👋', label: 'GREETING', color: s.accent },
    { key: 'overnight', icon: '🌙', label: 'OVERNIGHT REPORT', color: '#7c66dc' },
    { key: 'opportunities', icon: '⚡', label: 'OPPORTUNITIES', color: s.green },
    { key: 'warnings', icon: '⚠️', label: 'WARNINGS', color: s.yellow },
    { key: 'motivation', icon: '🚀', label: 'MOTIVATION', color: s.green },
  ];

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: s.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
        <div style={{ fontSize: 48, marginBottom: 24, color: s.accent }}>⬡</div>
        <div style={{ color: s.accent, fontSize: 14, letterSpacing: '0.3em', marginBottom: 8 }}>INITIALIZING JARVIS</div>
        <div style={{ color: s.muted, fontSize: 11, letterSpacing: '0.2em' }}>ANALYZING YOUR PORTFOLIO...</div>
        <div style={{ marginTop: 32, display: 'flex', gap: 8 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: s.accent, opacity: 0.3, animation: `jarvisPulse ${0.8 + i * 0.1}s infinite alternate` }} />
          ))}
        </div>
        <style>{`@keyframes jarvisPulse{0%{opacity:0.2;transform:scale(1)}100%{opacity:1;transform:scale(1.5)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: s.bg, fontFamily: 'system-ui', color: s.text }}>
      <style>{`
        @keyframes jarvisPulse{0%{opacity:0.2}100%{opacity:1}}
        @keyframes jarvisFade{0%{opacity:0;transform:translateY(10px)}100%{opacity:1;transform:translateY(0)}}
        .jarvis-section:hover{border-color:${s.accent} !important;transition:all 0.2s;}
        .jarvis-todo:hover{background:rgba(0,212,255,0.05) !important;}
        @media (max-width: 900px){
          .jarvis-grid{grid-template-columns:1fr !important;}
          .jarvis-side{position:static !important;}
        }
      `}</style>

      {/* Header */}
      <div style={{ background: '#010b18', borderBottom: `1px solid ${s.border}`, padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: s.accent, letterSpacing: '-0.02em' }}>⬡ JARVIS</div>
          <div style={{ height: 16, width: 1, background: s.border }} />
          <div style={{ fontSize: 12, color: s.muted, letterSpacing: '0.1em' }}>DAILY INTELLIGENCE BRIEFING</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 11, color: s.muted }}>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
          <a href="/dashboard" style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${s.border}`, color: s.muted, textDecoration: 'none', fontSize: 12 }}>← Dashboard</a>
          <button onClick={() => runBriefing({ force: true })}
            style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${s.accent}33`, background: `${s.accent}11`, color: s.accent, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            🔄 Refresh Briefing
          </button>
        </div>
      </div>

      <div className="jarvis-grid" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>

        {/* Left: Briefing sections */}
        <div>
          <div style={{ marginBottom: 32, animation: 'jarvisFade 0.5s ease' }}>
            <div style={{ fontSize: 13, color: s.muted, letterSpacing: '0.2em', marginBottom: 8 }}>
              {getGreeting().toUpperCase()}, SIR
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 8 }}>
              Your morning briefing is ready.
            </div>
            <div style={{ fontSize: 13, color: s.muted }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

          {errorMsg && (
            <div style={{ background: 'rgba(255,68,68,0.08)', border: `1px solid ${s.red}55`, color: s.red, borderRadius: 10, padding: '12px 14px', fontSize: 13, marginBottom: 16 }}>
              <strong>Briefing failed.</strong> {errorMsg}
              {errorMsg.toLowerCase().includes('api key') && (
                <div style={{ marginTop: 4, opacity: 0.85 }}>Set ANTHROPIC_API_KEY in the Vercel project env.</div>
              )}
            </div>
          )}

          {briefing && sections.map((sec, idx) => {
            const value = briefing[sec.key];
            if (!value) return null;
            return (
              <div key={sec.key} className="jarvis-section" style={{
                background: s.card, border: `1px solid ${s.border}`,
                borderRadius: 12, padding: 20, marginBottom: 16,
                animation: `jarvisFade 0.4s ease ${idx * 0.1}s both`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 18 }}>{sec.icon}</span>
                  <div style={{ fontSize: 11, fontWeight: 800, color: sec.color, letterSpacing: '0.15em' }}>{sec.label}</div>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.7, color: s.text, whiteSpace: 'pre-wrap' }}>
                  {value}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Goals + Quick stats + Quick actions */}
        <div className="jarvis-side" style={{ position: 'sticky', top: 80, alignSelf: 'start' }}>

          <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span>🎯</span>
              <div style={{ fontSize: 11, fontWeight: 800, color: s.accent, letterSpacing: '0.15em' }}>TODAY&apos;S GOALS</div>
              <div style={{ marginLeft: 'auto', fontSize: 11, color: s.muted }}>
                {todos.filter((t) => t.done).length}/{todos.length} done
              </div>
            </div>

            <div style={{ height: 3, background: '#1a2a3a', borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: s.accent, borderRadius: 2, width: `${todos.length ? todos.filter((t) => t.done).length / todos.length * 100 : 0}%`, transition: 'width 0.3s' }} />
            </div>

            {todos.length === 0 ? (
              <div style={{ fontSize: 12, color: s.muted, fontStyle: 'italic' }}>JARVIS hasn&apos;t set goals yet.</div>
            ) : todos.map((todo) => (
              <div key={todo.id} className="jarvis-todo" onClick={() => toggleTodo(todo.id)}
                style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 8px', borderRadius: 8, cursor: 'pointer', marginBottom: 4 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
                  border: `2px solid ${todo.done ? s.green : s.muted}`,
                  background: todo.done ? s.green : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {todo.done && <span style={{ fontSize: 10, color: '#000', fontWeight: 900 }}>✓</span>}
                </div>
                <div style={{ fontSize: 13, color: todo.done ? s.muted : s.text, textDecoration: todo.done ? 'line-through' : 'none', lineHeight: 1.4 }}>
                  {todo.text}
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: s.muted, letterSpacing: '0.15em', marginBottom: 12 }}>QUICK STATS</div>
            {[
              { label: 'Trading Win Rate', value: `${quickStats.winRate}%`, color: quickStats.winRate >= 50 ? s.green : s.text },
              { label: "Today's P&L", value: `${quickStats.todayPnl >= 0 ? '+' : '-'}$${Math.abs(quickStats.todayPnl).toFixed(2)}`, color: quickStats.todayPnl >= 0 ? s.green : s.red },
              { label: 'Arbs Found Today', value: quickStats.arbsFound, color: s.green },
              { label: 'Open Crypto', value: `${quickStats.openCrypto} positions`, color: s.accent },
              { label: 'Pending Paper Bets', value: quickStats.pendingBets, color: s.yellow },
              { label: 'Tracked Arbs', value: quickStats.trackedArbs, color: s.green },
            ].map((stat) => (
              <div key={stat.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${s.border}` }}>
                <span style={{ fontSize: 12, color: s.muted }}>{stat.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: stat.color }}>{stat.value}</span>
              </div>
            ))}
          </div>

          <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: s.muted, letterSpacing: '0.15em', marginBottom: 12 }}>QUICK ACTIONS</div>
            {[
              { label: '🪙 Check Crypto', href: '/dashboard' },
              { label: '💰 Find Arbs', href: '/arb' },
              { label: '⭐ Value Bets', href: '/bets' },
              { label: '📈 Trading Journal', href: '/dashboard' },
            ].map((action) => (
              <a key={action.href + action.label} href={action.href} style={{
                display: 'block', padding: '10px 12px', borderRadius: 8,
                border: `1px solid ${s.border}`, marginBottom: 8,
                color: s.text, textDecoration: 'none', fontSize: 13,
                background: 'transparent',
              }}>
                {action.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
