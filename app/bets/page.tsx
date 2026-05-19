// @ts-nocheck
'use client';
import { useState, useEffect } from 'react';

// Odds-API calls go through /api/odds so the API key stays server-side.

export default function BetsPage() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myBets, setMyBets] = useState([]);
  const [bankroll, setBankroll] = useState(1000);
  const [addModal, setAddModal] = useState(null);
  const [stakeInput, setStakeInput] = useState('100');
  const [notesInput, setNotesInput] = useState('');

  // Hydrate from localStorage post-mount.
  useEffect(() => {
    try {
      const rawBets = localStorage.getItem('nexyru_value_bets');
      if (rawBets) setMyBets(JSON.parse(rawBets));
      const rawBank = localStorage.getItem('nexyru_bet_bankroll');
      if (rawBank) setBankroll(parseFloat(rawBank) || 1000);
    } catch {}
  }, []);

  const calcImplied = (odds) => {
    const o = parseFloat(odds);
    if (!o) return 0;
    return o > 0 ? 100 / (o + 100) : Math.abs(o) / (Math.abs(o) + 100);
  };

  const getValueRating = (odds, avgOdds) => {
    const implied = calcImplied(odds);
    const avgImplied = calcImplied(avgOdds);
    const edge = avgImplied - implied;
    if (edge > 0.05) return { label: '⭐⭐⭐ Great Value', color: '#22c55e', edge };
    if (edge > 0.02) return { label: '⭐⭐ Good Value', color: '#86efac', edge };
    if (edge > 0) return { label: '⭐ Slight Value', color: '#fbbf24', edge };
    return { label: '↓ No Value', color: '#6b7280', edge };
  };

  const fetchGames = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/odds?sport=upcoming&daysFrom=2');
      const body = await res.json();
      const data = Array.isArray(body?.games) ? body.games : [];

      const processed = data.map((game) => {
        const allOdds = {};
        game.bookmakers?.forEach((bk) => {
          bk.markets?.[0]?.outcomes?.forEach((o) => {
            if (!allOdds[o.name]) allOdds[o.name] = [];
            allOdds[o.name].push(o.price);
          });
        });

        const teamsWithOdds = Object.entries(allOdds).map(([team, odds]) => {
          const avgImplied = odds.reduce((s, o) => s + calcImplied(o), 0) / odds.length;
          const bestOdds = odds.reduce((best, curr) => (curr > best ? curr : best), odds[0]);
          const bestBook = game.bookmakers?.find((bk) => bk.markets?.[0]?.outcomes?.find((o) => o.name === team && o.price === bestOdds))?.title;
          const avgOddsRaw = odds.reduce((s, o) => s + o, 0) / odds.length;
          const value = getValueRating(bestOdds, avgOddsRaw);
          return { team, bestOdds, bestBook, avgImplied, value, allOdds: odds };
        });

        return { ...game, teamsWithOdds };
      });

      processed.sort((a, b) => {
        const aVal = Math.max(...(a.teamsWithOdds?.map((t) => t.value?.edge || 0) || [0]));
        const bVal = Math.max(...(b.teamsWithOdds?.map((t) => t.value?.edge || 0) || [0]));
        return bVal - aVal;
      });

      setGames(processed);
    } catch (e) {
      if (typeof console !== 'undefined') console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchGames(); }, []);

  const addBet = (game, teamData) => {
    setAddModal({ game, teamData });
    setStakeInput('100');
    setNotesInput('');
  };

  const confirmBet = () => {
    if (!addModal) return;
    const stake = parseFloat(stakeInput) || 100;
    const odds = addModal.teamData.bestOdds;
    const potentialWin = odds > 0 ? (stake * odds) / 100 : (stake * 100) / Math.abs(odds);

    const bet = {
      id: Date.now(),
      game: addModal.game.teamsWithOdds?.map((t) => t.team).join(' vs ') || 'Unknown',
      sport: addModal.game.sport_key,
      pick: addModal.teamData.team,
      odds,
      book: addModal.teamData.bestBook,
      stake,
      potentialWin,
      value: addModal.teamData.value,
      status: 'pending',
      placedAt: new Date().toISOString(),
      gameTime: addModal.game.commence_time,
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
  };

  const settleBet = (id, result) => {
    const bet = myBets.find((b) => b.id === id);
    if (!bet) return;

    let newBankroll = bankroll;
    if (result === 'won') newBankroll = bankroll + bet.potentialWin + bet.stake;
    else if (result === 'void') newBankroll = bankroll + bet.stake;

    const updated = myBets.map((b) => (b.id === id ? { ...b, status: result } : b));
    setMyBets(updated);
    setBankroll(newBankroll);
    try {
      localStorage.setItem('nexyru_value_bets', JSON.stringify(updated));
      localStorage.setItem('nexyru_bet_bankroll', String(newBankroll));
    } catch {}
  };

  const pending = myBets.filter((b) => b.status === 'pending');
  const settled = myBets.filter((b) => b.status !== 'pending');
  const won = myBets.filter((b) => b.status === 'won');
  const totalStaked = myBets.filter((b) => b.status !== 'pending').reduce((s, b) => s + b.stake, 0);
  const totalWon = won.reduce((s, b) => s + b.potentialWin + b.stake, 0);
  const netPnl = totalWon - totalStaked;
  const winRate = settled.length ? Math.round((won.length / settled.length) * 100) : 0;

  const s = { bg: '#080808', card: '#111111', border: '#1e1e2a', green: '#22c55e', red: '#ef4444', indigo: '#6366f1', muted: '#6b7280' };

  return (
    <div style={{ minHeight: '100vh', background: s.bg, fontFamily: 'system-ui', color: '#fff' }}>
      <div style={{ background: '#0a0a0f', borderBottom: `1px solid ${s.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/dashboard" style={{ color: s.muted, textDecoration: 'none', fontSize: 13 }}>← Dashboard</a>
          <div style={{ fontSize: 18, fontWeight: 800 }}>⭐ Value Bets</div>
          <div style={{ fontSize: 12, color: s.muted }}>Bets where the odds are in your favor</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13 }}>Bankroll: <strong style={{ color: s.green }}>${bankroll.toFixed(2)}</strong></div>
          <button onClick={fetchGames} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${s.border}`, background: 'transparent', color: '#fff', fontSize: 13, cursor: 'pointer' }}>🔄 Refresh</button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Bankroll', value: '$' + bankroll.toFixed(2), color: s.green },
            { label: 'Pending Bets', value: pending.length, color: '#fff' },
            { label: 'Win Rate', value: winRate + '%', color: s.green },
            { label: 'Net P&L', value: (netPnl >= 0 ? '+' : '') + ' $' + netPnl.toFixed(2), color: netPnl >= 0 ? s.green : s.red },
            { label: 'Total Bets', value: myBets.length, color: '#fff' },
          ].map((stat) => (
            <div key={stat.label} style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: '14px' }}>
              <div style={{ fontSize: 10, color: s.muted, textTransform: 'uppercase', marginBottom: 4 }}>{stat.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: s.muted }}>
              {loading ? 'Finding value bets...' : `${games.length} games analyzed · sorted by value`}
            </div>

            {games.map((game) => {
              const timeUntil = game.commence_time ? Math.floor((new Date(game.commence_time).getTime() - Date.now()) / 60000) : null;
              const timeLabel = timeUntil !== null
                ? (timeUntil < 0 ? '🔴 LIVE' : timeUntil < 60 ? `${timeUntil}m` : timeUntil < 1440 ? `${Math.floor(timeUntil / 60)}h ${timeUntil % 60}m` : `${Math.floor(timeUntil / 1440)}d`)
                : '';

              return (
                <div key={game.id} style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: s.muted, textTransform: 'uppercase' }}>{game.sport_key?.replace(/_/g, ' ')} · {timeLabel}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {game.teamsWithOdds?.map((teamData) => (
                      <div key={teamData.team} style={{
                        background: '#1a1a24', borderRadius: 10, padding: 12,
                        border: `1px solid ${teamData.value?.edge > 0.02 ? 'rgba(34,197,94,0.3)' : s.border}`,
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{teamData.team}</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: teamData.bestOdds > 0 ? s.green : '#fff', marginBottom: 4 }}>
                          {teamData.bestOdds > 0 ? '+' : ''}{teamData.bestOdds}
                        </div>
                        <div style={{ fontSize: 11, color: s.muted, marginBottom: 4 }}>{teamData.bestBook}</div>
                        <div style={{ fontSize: 11, color: s.muted, marginBottom: 6 }}>
                          {(teamData.avgImplied * 100).toFixed(1)}% implied · Bet $100 → win ${teamData.bestOdds > 0 ? teamData.bestOdds : (10000 / Math.abs(teamData.bestOdds)).toFixed(0)}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: teamData.value?.color, marginBottom: 8 }}>
                          {teamData.value?.label}
                          {teamData.value?.edge > 0 && <span style={{ color: s.muted }}> (+{(teamData.value.edge * 100).toFixed(1)}% edge)</span>}
                        </div>
                        <button onClick={() => addBet(game, teamData)} style={{
                          width: '100%', padding: '8px', borderRadius: 6, border: 'none',
                          background: teamData.value?.edge > 0.02 ? s.green : '#2a2a3a',
                          color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        }}>
                          + Add to Paper Bets
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ position: 'sticky', top: 80, alignSelf: 'start', maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📋 My Bets</div>

            {myBets.length === 0 ? (
              <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 24, textAlign: 'center', color: s.muted, fontSize: 13 }}>
                No bets yet. Click "Add to Paper Bets" on any game above.
              </div>
            ) : myBets.map((bet) => (
              <div key={bet.id} style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: s.muted, marginBottom: 4 }}>{bet.sport?.replace(/_/g, ' ')} · {new Date(bet.placedAt).toLocaleDateString()}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{bet.pick}</div>
                <div style={{ fontSize: 12, color: s.muted, marginBottom: 4 }}>{bet.game}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: bet.odds > 0 ? s.green : '#fff' }}>{bet.odds > 0 ? '+' : ''}{bet.odds} · {bet.book}</span>
                  <span style={{ fontSize: 12 }}>Stake: ${bet.stake}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: s.green, marginBottom: 8 }}>
                  Win: +${bet.potentialWin?.toFixed(2)}
                </div>
                {bet.notes && <div style={{ fontSize: 11, color: s.muted, marginBottom: 8, fontStyle: 'italic' }}>{bet.notes}</div>}
                {bet.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => settleBet(bet.id, 'won')} style={{ flex: 1, padding: '6px', borderRadius: 6, border: 'none', background: 'rgba(34,197,94,0.2)', color: s.green, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✓ Won</button>
                    <button onClick={() => settleBet(bet.id, 'lost')} style={{ flex: 1, padding: '6px', borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.2)', color: s.red, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✗ Lost</button>
                    <button onClick={() => settleBet(bet.id, 'void')} style={{ flex: 1, padding: '6px', borderRadius: 6, border: `1px solid ${s.border}`, background: 'transparent', color: s.muted, fontSize: 12, cursor: 'pointer' }}>↩ Void</button>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 700, color: bet.status === 'won' ? s.green : bet.status === 'lost' ? s.red : s.muted }}>
                    {bet.status === 'won' ? '✅ Won +$' + bet.potentialWin?.toFixed(2) : bet.status === 'lost' ? '❌ Lost -$' + bet.stake : '↩ Void'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {addModal && (
        <>
          <div onClick={() => setAddModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10001, background: s.card, border: `1px solid ${s.border}`, borderRadius: 16, padding: 24, width: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Add Paper Bet</div>
            <div style={{ fontSize: 14, marginBottom: 4 }}>Pick: <strong>{addModal.teamData.team}</strong></div>
            <div style={{ fontSize: 14, marginBottom: 16 }}>Odds: <strong style={{ color: s.green }}>{addModal.teamData.bestOdds > 0 ? '+' : ''}{addModal.teamData.bestOdds}</strong> at {addModal.teamData.bestBook}</div>
            <label style={{ fontSize: 12, color: s.muted, display: 'block', marginBottom: 4 }}>Stake ($)</label>
            <input value={stakeInput} onChange={(e) => setStakeInput(e.target.value)} type="number"
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: `1px solid ${s.border}`, background: '#1a1a24', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
            {stakeInput && (
              <div style={{ fontSize: 13, color: s.green, marginBottom: 12 }}>
                Potential win: +${(parseFloat(stakeInput) * (addModal.teamData.bestOdds > 0 ? addModal.teamData.bestOdds / 100 : 100 / Math.abs(addModal.teamData.bestOdds))).toFixed(2)}
              </div>
            )}
            <label style={{ fontSize: 12, color: s.muted, display: 'block', marginBottom: 4 }}>Notes (optional)</label>
            <textarea value={notesInput} onChange={(e) => setNotesInput(e.target.value)} placeholder="Why are you taking this bet?"
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: `1px solid ${s.border}`, background: '#1a1a24', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', minHeight: 60, marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAddModal(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${s.border}`, background: 'transparent', color: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmBet} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: s.green, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Place Bet →</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
