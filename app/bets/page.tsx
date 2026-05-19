// @ts-nocheck
'use client';
import { useState, useEffect } from 'react';

// Odds-API calls go through /api/odds so the API key stays server-side.

export default function BetsPage() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myBets, setMyBets] = useState([]);
  const [bankroll, setBankroll] = useState(1000);
  const [activeTab, setActiveTab] = useState('finder');
  const [addModal, setAddModal] = useState(null);
  const [stakeInput, setStakeInput] = useState('100');
  const [notesInput, setNotesInput] = useState('');

  // Hydrate from localStorage post-mount to avoid SSR/hydration mismatch.
  useEffect(() => {
    try {
      const b = localStorage.getItem('nexyru_value_bets');
      if (b) setMyBets(JSON.parse(b));
      const br = localStorage.getItem('nexyru_bet_bankroll');
      if (br) setBankroll(parseFloat(br) || 1000);
    } catch {}
  }, []);

  const implied = (odds) => {
    const o = parseFloat(odds);
    if (!o) return 0;
    return o > 0 ? 100 / (o + 100) : Math.abs(o) / (Math.abs(o) + 100);
  };

  const fetchGames = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/odds?sport=upcoming&daysFrom=3');
      const body = await res.json();
      const raw = Array.isArray(body?.games) ? body.games : [];

      const processed = raw.map((game) => {
        const teamOdds = {};
        const teamBestBook = {};

        game.bookmakers?.forEach((bk) => {
          bk.markets?.[0]?.outcomes?.forEach((o) => {
            if (!teamOdds[o.name]) teamOdds[o.name] = [];
            teamOdds[o.name].push(o.price);
            if (!teamBestBook[o.name] || o.price > (teamBestBook[o.name].price || -Infinity)) {
              teamBestBook[o.name] = { price: o.price, book: bk.title };
            }
          });
        });

        const teams = Object.keys(teamOdds);
        if (teams.length < 2) return null;

        return {
          id: game.id,
          sport: game.sport_key?.replace(/_/g, ' ').toUpperCase(),
          time: game.commence_time,
          teams: teams.map((name) => {
            const odds = teamOdds[name];
            const avg = odds.reduce((s, o) => s + implied(o), 0) / odds.length;
            const best = teamBestBook[name];
            // Positive edge = best book is paying more (lower implied prob) than market average.
            const edge = avg - implied(best.price);
            return { name, bestPrice: best.price, bestBook: best.book, avgImplied: avg, edge };
          }),
        };
      }).filter(Boolean).sort((a, b) => {
        const aEdge = Math.max(...a.teams.map((t) => t.edge));
        const bEdge = Math.max(...b.teams.map((t) => t.edge));
        return bEdge - aEdge;
      });

      setGames(processed);
    } catch (e) {
      if (typeof console !== 'undefined') console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchGames(); }, []);

  const getValueLabel = (edge) => {
    if (edge > 0.05) return { label: '⭐⭐⭐ Great Value', color: '#22c55e' };
    if (edge > 0.02) return { label: '⭐⭐ Good Value', color: '#86efac' };
    if (edge > 0) return { label: '⭐ Slight Value', color: '#fbbf24' };
    return { label: 'No Edge', color: '#6b7280' };
  };

  const addBet = (game, team) => {
    setAddModal({ game, team });
    setStakeInput('100');
    setNotesInput('');
  };

  const confirmBet = () => {
    if (!addModal) return;
    const stake = parseFloat(stakeInput) || 100;
    const odds = addModal.team.bestPrice;
    const potWin = odds > 0 ? (stake * odds) / 100 : (stake * 100) / Math.abs(odds);
    const bet = {
      id: Date.now(),
      sport: addModal.game.sport,
      game: addModal.game.teams.map((t) => t.name).join(' vs '),
      pick: addModal.team.name,
      odds, book: addModal.team.bestBook,
      stake, potWin,
      value: getValueLabel(addModal.team.edge),
      status: 'pending',
      placedAt: new Date().toISOString(),
      gameTime: addModal.game.time,
      notes: notesInput,
    };
    const updated = [bet, ...myBets];
    const newBankroll = bankroll - stake;
    setMyBets(updated);
    setBankroll(newBankroll);
    try {
      localStorage.setItem('nexyru_value_bets', JSON.stringify(updated));
      localStorage.setItem('nexyru_bet_bankroll', String(newBankroll));
    } catch {}
    setAddModal(null);
    setActiveTab('bets');
  };

  const settleBet = (id, result) => {
    const bet = myBets.find((b) => b.id === id);
    if (!bet) return;
    let newBankroll = bankroll;
    if (result === 'won') newBankroll = bankroll + bet.potWin + bet.stake;
    else if (result === 'void') newBankroll = bankroll + bet.stake;
    const updated = myBets.map((b) => (b.id === id ? { ...b, status: result } : b));
    setMyBets(updated);
    setBankroll(newBankroll);
    try {
      localStorage.setItem('nexyru_value_bets', JSON.stringify(updated));
      localStorage.setItem('nexyru_bet_bankroll', String(newBankroll));
    } catch {}
  };

  const s = { bg: '#080808', card: '#111', border: '#1e1e2a', green: '#22c55e', red: '#ef4444', muted: '#6b7280', accent: '#6366f1' };

  const settled = myBets.filter((b) => b.status !== 'pending');
  const won = myBets.filter((b) => b.status === 'won');
  const totalStaked = settled.reduce((acc, b) => acc + b.stake, 0);
  const totalWon = won.reduce((acc, b) => acc + b.potWin + b.stake, 0);
  const netPnl = totalWon - totalStaked;
  const winRate = settled.length ? Math.round((won.length / settled.length) * 100) : 0;

  const TimeLabel = ({ time }) => {
    if (!time) return null;
    const mins = Math.floor((new Date(time).getTime() - Date.now()) / 60000);
    if (mins < 0) return <span style={{ color: s.red, fontWeight: 700 }}>🔴 LIVE</span>;
    if (mins < 60) return <span style={{ color: '#f59e0b' }}>⚡ {mins}m</span>;
    if (mins < 1440) return <span style={{ color: s.muted }}>{Math.floor(mins / 60)}h {mins % 60}m</span>;
    return <span style={{ color: s.muted }}>{Math.floor(mins / 1440)}d</span>;
  };

  return (
    <div style={{ minHeight: '100vh', background: s.bg, fontFamily: 'system-ui', color: '#fff' }}>
      {/* Header */}
      <div style={{ background: '#0a0a0f', borderBottom: `1px solid ${s.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/dashboard" style={{ color: s.muted, textDecoration: 'none', fontSize: 13 }}>← Back</a>
          <span style={{ fontSize: 18, fontWeight: 800 }}>⭐ Value Bets</span>
          <span style={{ fontSize: 12, color: s.muted }}>Bets where odds are in your favor</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13 }}>Bankroll: <strong style={{ color: s.green }}>${bankroll.toFixed(2)}</strong></span>
          <button onClick={fetchGames} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${s.border}`, background: 'transparent', color: '#fff', fontSize: 12, cursor: 'pointer' }}>🔄 Refresh</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${s.border}`, background: '#0a0a0f', padding: '0 24px' }}>
        {[['finder', '🔍 Find Value'], ['bets', '📋 My Bets']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            padding: '12px 20px', border: 'none', background: 'transparent',
            color: activeTab === id ? '#fff' : s.muted, fontSize: 13, fontWeight: activeTab === id ? 700 : 400,
            borderBottom: activeTab === id ? `2px solid ${s.accent}` : '2px solid transparent',
            cursor: 'pointer', marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px' }}>

        {/* FINDER */}
        {activeTab === 'finder' && (
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 48, color: s.muted }}>Analyzing games for value...</div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: s.muted, marginBottom: 12 }}>{games.length} games analyzed · sorted by best value</div>
                {games.map((game) => (
                  <div key={game.id} style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontSize: 11, color: s.muted, fontWeight: 700 }}>{game.sport}</span>
                      <span style={{ fontSize: 11 }}><TimeLabel time={game.time} /></span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {game.teams.map((team) => {
                        const val = getValueLabel(team.edge);
                        const potWin = team.bestPrice > 0 ? team.bestPrice : (10000 / Math.abs(team.bestPrice));
                        return (
                          <div key={team.name} style={{
                            background: '#1a1a24', borderRadius: 10, padding: 12,
                            border: `1px solid ${team.edge > 0.02 ? 'rgba(34,197,94,0.3)' : s.border}`,
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{team.name}</div>
                            <div style={{ fontSize: 26, fontWeight: 800, color: team.bestPrice > 0 ? s.green : '#fff', marginBottom: 2 }}>
                              {team.bestPrice > 0 ? '+' : ''}{team.bestPrice}
                            </div>
                            <div style={{ fontSize: 11, color: s.muted, marginBottom: 2 }}>{team.bestBook}</div>
                            <div style={{ fontSize: 11, color: s.muted, marginBottom: 6 }}>
                              Bet $100 → win ${potWin.toFixed(0)} · {(implied(team.bestPrice) * 100).toFixed(0)}% chance
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: val.color, marginBottom: 8 }}>
                              {val.label}
                              {team.edge > 0 && <span style={{ color: s.muted }}> (+{(team.edge * 100).toFixed(1)}% edge)</span>}
                            </div>
                            <button onClick={() => addBet(game, team)} style={{
                              width: '100%', padding: '8px', borderRadius: 6, border: 'none',
                              background: team.edge > 0.02 ? s.accent : '#2a2a3a',
                              color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            }}>+ Add Bet</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* BETS */}
        {activeTab === 'bets' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Bankroll', value: '$' + bankroll.toFixed(2), color: s.green },
                { label: 'Win Rate', value: winRate + '%', color: s.green },
                { label: 'Net P&L', value: (netPnl >= 0 ? '+' : '') + ' $' + netPnl.toFixed(2), color: netPnl >= 0 ? s.green : s.red },
                { label: 'Total Bets', value: myBets.length, color: '#fff' },
              ].map((stat) => (
                <div key={stat.label} style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 10, color: s.muted, textTransform: 'uppercase', marginBottom: 4 }}>{stat.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {myBets.length === 0 ? (
              <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 32, textAlign: 'center', color: s.muted }}>
                No bets yet. Go to Find Value and click "+ Add Bet" on any game.
              </div>
            ) : myBets.map((bet) => (
              <div key={bet.id} style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: s.muted, marginBottom: 4 }}>{bet.sport} · {new Date(bet.placedAt).toLocaleDateString()}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{bet.pick}</div>
                <div style={{ fontSize: 12, color: s.muted, marginBottom: 4 }}>{bet.game}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: bet.odds > 0 ? s.green : '#fff', fontWeight: 700 }}>{bet.odds > 0 ? '+' : ''}{bet.odds} at {bet.book}</span>
                  <span style={{ fontSize: 13 }}>Stake: <strong>${bet.stake}</strong></span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.green, marginBottom: 8 }}>
                  If wins: +${bet.potWin?.toFixed(2)} profit
                </div>
                {bet.notes && <div style={{ fontSize: 11, color: s.muted, marginBottom: 8, fontStyle: 'italic' }}>{bet.notes}</div>}
                {bet.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => settleBet(bet.id, 'won')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'rgba(34,197,94,0.2)', color: s.green, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✓ Won</button>
                    <button onClick={() => settleBet(bet.id, 'lost')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.2)', color: s.red, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✗ Lost</button>
                    <button onClick={() => settleBet(bet.id, 'void')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${s.border}`, background: 'transparent', color: s.muted, fontSize: 13, cursor: 'pointer' }}>↩ Void</button>
                  </div>
                ) : (
                  <div style={{ fontSize: 14, fontWeight: 700, color: bet.status === 'won' ? s.green : bet.status === 'lost' ? s.red : s.muted }}>
                    {bet.status === 'won' ? '✅ Won +$' + bet.potWin?.toFixed(2) : bet.status === 'lost' ? '❌ Lost -$' + bet.stake : '↩ Void'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add bet modal */}
      {addModal && (
        <>
          <div onClick={() => setAddModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10001, background: s.card, border: `1px solid ${s.border}`, borderRadius: 16, padding: 24, width: 380 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Add Bet</div>
            <div style={{ fontSize: 14, color: s.muted, marginBottom: 16 }}>{addModal.game.teams.map((t) => t.name).join(' vs ')}</div>
            <div style={{ background: '#1a1a24', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{addModal.team.name}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: addModal.team.bestPrice > 0 ? s.green : '#fff' }}>{addModal.team.bestPrice > 0 ? '+' : ''}{addModal.team.bestPrice}</div>
              <div style={{ fontSize: 12, color: s.muted }}>{addModal.team.bestBook}</div>
            </div>
            <label style={{ fontSize: 12, color: s.muted, display: 'block', marginBottom: 4 }}>Stake ($)</label>
            <input value={stakeInput} onChange={(e) => setStakeInput(e.target.value)} type="number"
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: `1px solid ${s.border}`, background: '#1a1a24', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 6 }} />
            {stakeInput && (
              <div style={{ fontSize: 13, color: s.green, marginBottom: 12 }}>
                If wins: +${(parseFloat(stakeInput) * (addModal.team.bestPrice > 0 ? addModal.team.bestPrice / 100 : 100 / Math.abs(addModal.team.bestPrice))).toFixed(2)} profit
              </div>
            )}
            <label style={{ fontSize: 12, color: s.muted, display: 'block', marginBottom: 4 }}>Notes (why this bet?)</label>
            <textarea value={notesInput} onChange={(e) => setNotesInput(e.target.value)} placeholder="Optional..."
              style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${s.border}`, background: '#1a1a24', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', minHeight: 50, marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAddModal(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${s.border}`, background: 'transparent', color: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmBet} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: s.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Place Bet →</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
