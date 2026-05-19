// @ts-nocheck
'use client';
import { useState, useEffect } from 'react';

// Odds-API calls go through /api/odds so the API key stays server-side.

export default function ArbPage() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stake, setStake] = useState(1000);
  const [tracked, setTracked] = useState([]);
  const [activeTab, setActiveTab] = useState('finder'); // finder | tracked | paper
  const [paperBets, setPaperBets] = useState([]);
  const [bankroll, setBankroll] = useState(1000);

  // Hydrate from localStorage post-mount to avoid SSR/hydration mismatch.
  useEffect(() => {
    try {
      const t = localStorage.getItem('nexyru_arbs');
      if (t) setTracked(JSON.parse(t));
      const p = localStorage.getItem('nexyru_arb_paper');
      if (p) setPaperBets(JSON.parse(p));
      const b = localStorage.getItem('nexyru_arb_bankroll');
      if (b) setBankroll(parseFloat(b) || 1000);
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
        // Best odds per team across ALL bookmakers.
        const teamOdds = {};
        game.bookmakers?.forEach((bk) => {
          bk.markets?.[0]?.outcomes?.forEach((o) => {
            if (!teamOdds[o.name] || o.price > teamOdds[o.name].price) {
              teamOdds[o.name] = { price: o.price, book: bk.title };
            }
          });
        });

        const teams = Object.keys(teamOdds);
        if (teams.length < 2) return null;

        const a = teamOdds[teams[0]];
        const b = teamOdds[teams[1]];
        const impA = implied(a.price);
        const impB = implied(b.price);
        const total = impA + impB;
        const isArb = total < 1;

        return {
          id: game.id,
          sport: game.sport_key?.replace(/_/g, ' ').toUpperCase(),
          time: game.commence_time,
          teamA: { name: teams[0], ...a },
          teamB: { name: teams[1], ...b },
          impA, impB, total, isArb,
        };
      }).filter(Boolean).sort((x, y) => (y.isArb ? 1 : 0) - (x.isArb ? 1 : 0));

      setGames(processed);
    } catch (e) {
      if (typeof console !== 'undefined') console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchGames(); }, []);

  // Recalc on current stake so the displayed arb scales with the input.
  const arbForGame = (game) => {
    const s = parseFloat(stake) || 1000;
    const { impA, impB, total } = game;
    if (total >= 1) return null;
    const betA = (s * impA) / total;
    const betB = (s * impB) / total;
    const winA = betA * (game.teamA.price > 0 ? game.teamA.price / 100 : 100 / Math.abs(game.teamA.price)) + betA;
    const winB = betB * (game.teamB.price > 0 ? game.teamB.price / 100 : 100 / Math.abs(game.teamB.price)) + betB;
    const profit = Math.min(winA, winB) - s;
    return { betA, betB, profit, roi: (profit / s) * 100 };
  };

  const trackArb = (game) => {
    const arb = arbForGame(game);
    if (!arb) return;
    const entry = {
      id: Date.now(),
      sport: game.sport,
      teamA: game.teamA.name, oddsA: game.teamA.price, bookA: game.teamA.book,
      teamB: game.teamB.name, oddsB: game.teamB.price, bookB: game.teamB.book,
      stake: parseFloat(stake), betA: arb.betA, betB: arb.betB,
      profit: arb.profit, roi: arb.roi,
      status: 'pending', trackedAt: new Date().toISOString(), gameTime: game.time,
    };
    const updated = [entry, ...tracked];
    setTracked(updated);
    try { localStorage.setItem('nexyru_arbs', JSON.stringify(updated)); } catch {}
  };

  const paperBet = (game) => {
    const arb = arbForGame(game);
    if (!arb) return;
    const entry = {
      id: Date.now(),
      sport: game.sport,
      teamA: game.teamA.name, oddsA: game.teamA.price, bookA: game.teamA.book,
      teamB: game.teamB.name, oddsB: game.teamB.price, bookB: game.teamB.book,
      stake: parseFloat(stake), betA: arb.betA, betB: arb.betB,
      profit: arb.profit, roi: arb.roi,
      status: 'pending', placedAt: new Date().toISOString(), gameTime: game.time,
    };
    const newBankroll = bankroll - parseFloat(stake);
    const updated = [entry, ...paperBets];
    setPaperBets(updated);
    setBankroll(newBankroll);
    try {
      localStorage.setItem('nexyru_arb_paper', JSON.stringify(updated));
      localStorage.setItem('nexyru_arb_bankroll', String(newBankroll));
    } catch {}
    setActiveTab('paper');
  };

  const settlePaper = (id, result) => {
    const bet = paperBets.find((b) => b.id === id);
    if (!bet) return;
    let newBankroll = bankroll;
    if (result === 'hit') newBankroll = bankroll + parseFloat(bet.stake) + bet.profit;
    else if (result === 'miss') newBankroll = bankroll; // stake already deducted on place
    else if (result === 'void') newBankroll = bankroll + parseFloat(bet.stake);
    const updated = paperBets.map((b) => (b.id === id ? { ...b, status: result } : b));
    setPaperBets(updated);
    setBankroll(newBankroll);
    try {
      localStorage.setItem('nexyru_arb_paper', JSON.stringify(updated));
      localStorage.setItem('nexyru_arb_bankroll', String(newBankroll));
    } catch {}
  };

  const settleTracked = (id, result) => {
    const updated = tracked.map((t) => (t.id === id ? { ...t, status: result } : t));
    setTracked(updated);
    try { localStorage.setItem('nexyru_arbs', JSON.stringify(updated)); } catch {}
  };

  const s = { bg: '#080808', card: '#111', border: '#1e1e2a', green: '#22c55e', red: '#ef4444', muted: '#6b7280', accent: '#6366f1' };

  const paperWon = paperBets.filter((b) => b.status === 'hit');
  const paperSettled = paperBets.filter((b) => b.status !== 'pending');
  const paperProfit = paperWon.reduce((sum, b) => sum + b.profit, 0);

  const TimeLabel = ({ time }) => {
    if (!time) return null;
    const mins = Math.floor((new Date(time).getTime() - Date.now()) / 60000);
    if (mins < 0) return <span style={{ color: s.red, fontWeight: 700 }}>🔴 LIVE</span>;
    if (mins < 60) return <span style={{ color: '#f59e0b' }}>⚡ Starts in {mins}m</span>;
    if (mins < 1440) return <span style={{ color: s.muted }}>Starts in {Math.floor(mins / 60)}h {mins % 60}m</span>;
    return <span style={{ color: s.muted }}>Starts in {Math.floor(mins / 1440)}d</span>;
  };

  return (
    <div style={{ minHeight: '100vh', background: s.bg, fontFamily: 'system-ui', color: '#fff' }}>
      {/* Header */}
      <div style={{ background: '#0a0a0f', borderBottom: `1px solid ${s.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/dashboard" style={{ color: s.muted, textDecoration: 'none', fontSize: 13 }}>← Back</a>
          <span style={{ fontSize: 18, fontWeight: 800 }}>💰 Arb Finder</span>
          <span style={{ fontSize: 12, color: s.muted }}>Guaranteed profit on any outcome</span>
        </div>
        <button onClick={fetchGames} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${s.border}`, background: 'transparent', color: '#fff', fontSize: 12, cursor: 'pointer' }}>🔄 Refresh</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${s.border}`, background: '#0a0a0f', padding: '0 24px' }}>
        {[['finder', '🔍 Arb Finder'], ['tracked', '📋 Tracked'], ['paper', '🎮 Paper Bets']].map(([id, label]) => (
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
            <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: s.muted }}>I want to bet a total of:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: s.muted, fontSize: 16 }}>$</span>
                <input value={stake} onChange={(e) => setStake(e.target.value)} type="number"
                  style={{ width: 100, padding: '6px 10px', borderRadius: 8, border: `1px solid ${s.border}`, background: '#1a1a24', color: '#fff', fontSize: 16, fontWeight: 700, outline: 'none' }} />
              </div>
              <span style={{ fontSize: 13, color: s.muted }}>split across both sides</span>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 48, color: s.muted }}>Loading games...</div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: s.muted, marginBottom: 12 }}>
                  {games.filter((g) => g.isArb).length} guaranteed profit opportunities · {games.length} total games
                </div>
                {games.map((game) => {
                  const arb = arbForGame(game);
                  return (
                    <div key={game.id} style={{
                      background: s.card,
                      border: `1px solid ${game.isArb ? 'rgba(34,197,94,0.5)' : s.border}`,
                      borderRadius: 12, padding: 16, marginBottom: 12,
                      boxShadow: game.isArb ? '0 0 20px rgba(34,197,94,0.08)' : 'none',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: s.muted }}>{game.sport}</span>
                          <span style={{ fontSize: 11, color: s.muted }}>·</span>
                          <span style={{ fontSize: 11 }}><TimeLabel time={game.time} /></span>
                        </div>
                        {game.isArb && (
                          <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.15)', color: s.green }}>
                            ✓ GUARANTEED PROFIT
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        {[game.teamA, game.teamB].map((team, i) => (
                          <div key={i} style={{ background: '#1a1a24', borderRadius: 8, padding: 12 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{team.name}</div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: team.price > 0 ? s.green : '#fff', marginBottom: 2 }}>
                              {team.price > 0 ? '+' : ''}{team.price}
                            </div>
                            <div style={{ fontSize: 11, color: s.muted }}>{team.book}</div>
                            <div style={{ fontSize: 11, color: s.muted, marginTop: 2 }}>
                              {(implied(team.price) * 100).toFixed(0)}% implied chance
                            </div>
                            {arb && (
                              <div style={{ fontSize: 12, color: s.green, fontWeight: 600, marginTop: 4 }}>
                                Bet ${i === 0 ? arb.betA.toFixed(2) : arb.betB.toFixed(2)} here
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {arb ? (
                        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: 14, marginBottom: 12 }}>
                          <div style={{ fontSize: 13, color: s.green, marginBottom: 4 }}>
                            ✅ Bet <strong>${arb.betA.toFixed(2)}</strong> on {game.teamA.name} at {game.teamA.book}
                          </div>
                          <div style={{ fontSize: 13, color: s.green, marginBottom: 10 }}>
                            ✅ Bet <strong>${arb.betB.toFixed(2)}</strong> on {game.teamB.name} at {game.teamB.book}
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: s.green }}>
                            💰 No matter who wins → you profit <strong>+${arb.profit.toFixed(2)}</strong> ({arb.roi.toFixed(2)}% ROI)
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: s.muted, marginBottom: 12 }}>
                          No arb on this game. Book edge: {((game.total - 1) * 100).toFixed(1)}%
                        </div>
                      )}

                      {arb && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => paperBet(game)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: s.accent, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                            🎮 Paper Bet
                          </button>
                          <button onClick={() => trackArb(game)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${s.green}`, background: 'transparent', color: s.green, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                            📋 Track
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* TRACKED */}
        {activeTab === 'tracked' && (
          <div>
            <div style={{ fontSize: 14, color: s.muted, marginBottom: 16 }}>
              Arbs you've spotted and want to remember. Mark as Hit or Miss after the game.
            </div>
            {tracked.length === 0 ? (
              <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 32, textAlign: 'center', color: s.muted }}>
                No tracked arbs yet. Go to Arb Finder and click "Track" on any opportunity.
              </div>
            ) : tracked.map((arb) => (
              <div key={arb.id} style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: s.muted, marginBottom: 6 }}>{arb.sport} · {new Date(arb.trackedAt).toLocaleDateString()}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{arb.teamA} vs {arb.teamB}</div>
                <div style={{ fontSize: 12, color: s.muted, marginBottom: 2 }}>${arb.betA?.toFixed(2)} on {arb.teamA} ({arb.oddsA > 0 ? '+' : ''}{arb.oddsA}) at {arb.bookA}</div>
                <div style={{ fontSize: 12, color: s.muted, marginBottom: 8 }}>${arb.betB?.toFixed(2)} on {arb.teamB} ({arb.oddsB > 0 ? '+' : ''}{arb.oddsB}) at {arb.bookB}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: s.green, marginBottom: 12 }}>Target profit: +${arb.profit?.toFixed(2)} ({arb.roi?.toFixed(2)}% ROI)</div>
                {arb.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => settleTracked(arb.id, 'hit')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'rgba(34,197,94,0.2)', color: s.green, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✓ Hit</button>
                    <button onClick={() => settleTracked(arb.id, 'miss')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.2)', color: s.red, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✗ Miss</button>
                    <button onClick={() => settleTracked(arb.id, 'void')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${s.border}`, background: 'transparent', color: s.muted, fontSize: 13, cursor: 'pointer' }}>↩ Void</button>
                  </div>
                ) : (
                  <div style={{ fontSize: 14, fontWeight: 700, color: arb.status === 'hit' ? s.green : arb.status === 'miss' ? s.red : s.muted }}>
                    {arb.status === 'hit' ? `✅ Hit — +$${arb.profit?.toFixed(2)}` : arb.status === 'miss' ? '❌ Missed' : '↩ Void'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* PAPER BETS */}
        {activeTab === 'paper' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Bankroll', value: '$' + bankroll.toFixed(2), color: s.green },
                { label: 'Total Bets', value: paperBets.length, color: '#fff' },
                { label: 'Win Rate', value: paperSettled.length ? Math.round(paperWon.length / paperSettled.length * 100) + '%' : '0%', color: s.green },
                { label: 'Total Profit', value: (paperProfit >= 0 ? '+' : '') + ' $' + paperProfit.toFixed(2), color: paperProfit >= 0 ? s.green : s.red },
              ].map((stat) => (
                <div key={stat.label} style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 10, color: s.muted, textTransform: 'uppercase', marginBottom: 4 }}>{stat.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {paperBets.length === 0 ? (
              <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 32, textAlign: 'center', color: s.muted }}>
                No paper bets yet. Go to Arb Finder and click "🎮 Paper Bet" on any arb opportunity.
              </div>
            ) : paperBets.map((bet) => (
              <div key={bet.id} style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: s.muted, marginBottom: 6 }}>{bet.sport} · {new Date(bet.placedAt).toLocaleDateString()}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{bet.teamA} vs {bet.teamB}</div>
                <div style={{ fontSize: 12, color: s.muted, marginBottom: 2 }}>${bet.betA?.toFixed(2)} on {bet.teamA} ({bet.oddsA > 0 ? '+' : ''}{bet.oddsA}) at {bet.bookA}</div>
                <div style={{ fontSize: 12, color: s.muted, marginBottom: 8 }}>${bet.betB?.toFixed(2)} on {bet.teamB} ({bet.oddsB > 0 ? '+' : ''}{bet.oddsB}) at {bet.bookB}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: s.green, marginBottom: 12 }}>Target: +${bet.profit?.toFixed(2)} guaranteed</div>
                {bet.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => settlePaper(bet.id, 'hit')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'rgba(34,197,94,0.2)', color: s.green, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✓ Hit</button>
                    <button onClick={() => settlePaper(bet.id, 'miss')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.2)', color: s.red, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✗ Miss</button>
                    <button onClick={() => settlePaper(bet.id, 'void')} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${s.border}`, background: 'transparent', color: s.muted, fontSize: 13, cursor: 'pointer' }}>↩ Void</button>
                  </div>
                ) : (
                  <div style={{ fontSize: 14, fontWeight: 700, color: bet.status === 'hit' ? s.green : bet.status === 'miss' ? s.red : s.muted }}>
                    {bet.status === 'hit' ? `✅ Hit — +$${bet.profit?.toFixed(2)} profit` : bet.status === 'miss' ? `❌ Missed — -$${parseFloat(bet.stake).toFixed(2)}` : '↩ Void — stake returned'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
