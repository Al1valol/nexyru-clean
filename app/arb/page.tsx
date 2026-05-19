// @ts-nocheck
'use client';
import { useState, useEffect } from 'react';

// All Odds-API calls go through /api/odds so the API key stays server-side.
// The proxy returns { games, requestsRemaining }.

export default function ArbPage() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stake, setStake] = useState(1000);
  const [trackedArbs, setTrackedArbs] = useState([]);
  const [oddsA, setOddsA] = useState('');
  const [oddsB, setOddsB] = useState('');
  const [apiCallsLeft, setApiCallsLeft] = useState(null);

  // Hydrate from localStorage post-mount to avoid SSR/hydration mismatch.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('nexyru_tracked_arbs');
      if (raw) setTrackedArbs(JSON.parse(raw));
    } catch {}
  }, []);

  const calcImplied = (odds) => {
    const o = parseFloat(odds);
    if (!o) return 0;
    return o > 0 ? 100 / (o + 100) : Math.abs(o) / (Math.abs(o) + 100);
  };

  const calcArb = (a, b) => {
    const impA = calcImplied(a);
    const impB = calcImplied(b);
    const total = impA + impB;
    if (total >= 1) return null;
    const s = parseFloat(stake) || 1000;
    const betA = (s * impA) / total;
    const betB = (s * impB) / total;
    const profit = Math.min(
      betA * (parseFloat(a) > 0 ? parseFloat(a) / 100 : 100 / Math.abs(parseFloat(a))) + betA,
      betB * (parseFloat(b) > 0 ? parseFloat(b) / 100 : 100 / Math.abs(parseFloat(b))) + betB
    ) - s;
    const roi = (profit / s) * 100;
    return { betA, betB, profit, roi, total };
  };

  const fetchGames = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/odds?sport=upcoming&daysFrom=2');
      const body = await res.json();
      if (body?.requestsRemaining) setApiCallsLeft(String(body.requestsRemaining));
      const data = Array.isArray(body?.games) ? body.games : [];

      const processed = data.map((game) => {
        const allOdds = {};
        game.bookmakers?.forEach((bk) => {
          const market = bk.markets?.[0];
          market?.outcomes?.forEach((o) => {
            if (!allOdds[o.name]) allOdds[o.name] = [];
            allOdds[o.name].push({ book: bk.title, odds: o.price });
          });
        });

        const teams = Object.keys(allOdds);
        if (teams.length < 2) return { ...game, arb: null };

        const bestA = allOdds[teams[0]]?.reduce((best, curr) => (curr.odds > best.odds ? curr : best), allOdds[teams[0]][0]);
        const bestB = allOdds[teams[1]]?.reduce((best, curr) => (curr.odds > best.odds ? curr : best), allOdds[teams[1]][0]);

        const arb = bestA && bestB ? calcArb(bestA.odds, bestB.odds) : null;

        return {
          ...game,
          teams,
          bestA: { ...bestA, team: teams[0] },
          bestB: { ...bestB, team: teams[1] },
          arb,
          allOdds,
        };
      });

      processed.sort((a, b) => {
        if (a.arb && !b.arb) return -1;
        if (!a.arb && b.arb) return 1;
        if (a.arb && b.arb) return b.arb.profit - a.arb.profit;
        return 0;
      });

      setGames(processed);
    } catch (e) {
      if (typeof console !== 'undefined') console.error('Fetch error:', e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchGames(); }, []);

  const trackArb = (game) => {
    const entry = {
      id: Date.now(),
      game: game.teams.join(' vs '),
      sport: game.sport_key,
      teamA: game.bestA.team,
      oddsA: game.bestA.odds,
      bookA: game.bestA.book,
      teamB: game.bestB.team,
      oddsB: game.bestB.odds,
      bookB: game.bestB.book,
      stake,
      profit: game.arb?.profit,
      roi: game.arb?.roi,
      betA: game.arb?.betA,
      betB: game.arb?.betB,
      status: 'pending',
      trackedAt: new Date().toISOString(),
      gameTime: game.commence_time,
      result: null,
    };
    const updated = [entry, ...trackedArbs];
    setTrackedArbs(updated);
    try { localStorage.setItem('nexyru_tracked_arbs', JSON.stringify(updated)); } catch {}
  };

  const settleArb = (id, result) => {
    const updated = trackedArbs.map((a) => (a.id === id ? { ...a, status: result } : a));
    setTrackedArbs(updated);
    try { localStorage.setItem('nexyru_tracked_arbs', JSON.stringify(updated)); } catch {}
  };

  const settled = trackedArbs.filter((a) => a.status !== 'pending');
  const won = trackedArbs.filter((a) => a.status === 'won');
  const totalProfit = won.reduce((s, a) => s + (a.profit || 0), 0);
  const winRate = settled.length ? Math.round((won.length / settled.length) * 100) : 0;

  const s = {
    bg: '#080808', card: '#111111', border: '#1e1e2a',
    green: '#22c55e', red: '#ef4444', indigo: '#6366f1', muted: '#6b7280',
  };

  return (
    <div style={{ minHeight: '100vh', background: s.bg, fontFamily: 'system-ui', color: '#fff' }}>
      <div style={{ background: '#0a0a0f', borderBottom: `1px solid ${s.border}`, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/dashboard" style={{ color: s.muted, textDecoration: 'none', fontSize: 13 }}>← Dashboard</a>
          <div style={{ fontSize: 18, fontWeight: 800 }}>💰 Arb Finder</div>
          <div style={{ fontSize: 12, color: s.muted }}>Guaranteed profit opportunities</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {apiCallsLeft && <div style={{ fontSize: 11, color: s.muted }}>{apiCallsLeft} API calls left</div>}
          <button onClick={fetchGames} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${s.border}`, background: 'transparent', color: '#fff', fontSize: 13, cursor: 'pointer' }}>🔄 Refresh</button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Arbs Found', value: loading ? '...' : games.filter((g) => g.arb).length, color: s.green },
            { label: 'Tracked', value: trackedArbs.length, color: '#fff' },
            { label: 'Win Rate', value: winRate + '%', color: s.green },
            { label: 'Total Profit', value: '+$' + totalProfit.toFixed(2), color: totalProfit >= 0 ? s.green : s.red },
          ].map((stat) => (
            <div key={stat.label} style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: '16px' }}>
              <div style={{ fontSize: 11, color: s.muted, textTransform: 'uppercase', marginBottom: 4 }}>{stat.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
          <div>
            <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, color: s.muted }}>Calculate profit based on stake:</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: s.muted }}>$</span>
                <input value={stake} onChange={(e) => setStake(e.target.value)} type="number"
                  style={{ width: 120, padding: '6px 10px', borderRadius: 8, border: `1px solid ${s.border}`, background: '#1a1a24', color: '#fff', fontSize: 14, outline: 'none' }} />
              </div>
              <div style={{ fontSize: 12, color: s.muted }}>total to split across both bets</div>
            </div>

            <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🧮 Quick Arb Calculator</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: s.muted, display: 'block', marginBottom: 4 }}>Team A odds (e.g. +150)</label>
                  <input value={oddsA} onChange={(e) => setOddsA(e.target.value)} placeholder="+150"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${s.border}`, background: '#1a1a24', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                  {oddsA && (
                    <div style={{ fontSize: 11, color: s.muted, marginTop: 4 }}>
                      {parseFloat(oddsA) > 0 ? `Bet $100 → win $${parseFloat(oddsA)}` : `Bet $${Math.abs(parseFloat(oddsA))} → win $100`}
                      {' · '}{(calcImplied(oddsA) * 100).toFixed(1)}% implied
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 11, color: s.muted, display: 'block', marginBottom: 4 }}>Team B odds (e.g. +120)</label>
                  <input value={oddsB} onChange={(e) => setOddsB(e.target.value)} placeholder="+120"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${s.border}`, background: '#1a1a24', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                  {oddsB && (
                    <div style={{ fontSize: 11, color: s.muted, marginTop: 4 }}>
                      {parseFloat(oddsB) > 0 ? `Bet $100 → win $${parseFloat(oddsB)}` : `Bet $${Math.abs(parseFloat(oddsB))} → win $100`}
                      {' · '}{(calcImplied(oddsB) * 100).toFixed(1)}% implied
                    </div>
                  )}
                </div>
              </div>
              {oddsA && oddsB && (() => {
                const result = calcArb(oddsA, oddsB);
                if (!result) {
                  return (
                    <div style={{ background: 'rgba(107,114,128,0.1)', border: `1px solid ${s.border}`, borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 13, color: s.muted }}>No arb opportunity</div>
                      <div style={{ fontSize: 12, color: s.muted, marginTop: 4 }}>
                        Total implied: {((calcImplied(oddsA) + calcImplied(oddsB)) * 100).toFixed(1)}% (needs to be under 100%)
                      </div>
                    </div>
                  );
                }
                return (
                  <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: s.green, marginBottom: 8 }}>🎯 GUARANTEED PROFIT!</div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>Bet <strong style={{ color: s.green }}>${result.betA.toFixed(2)}</strong> on Team A</div>
                    <div style={{ fontSize: 13, marginBottom: 8 }}>Bet <strong style={{ color: s.green }}>${result.betB.toFixed(2)}</strong> on Team B</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: s.green }}>💰 +${result.profit.toFixed(2)} guaranteed ({result.roi.toFixed(2)}% ROI)</div>
                  </div>
                );
              })()}
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: s.muted }}>
              {loading ? 'Loading games...' : `${games.filter((g) => g.arb).length} arb opportunities found · ${games.length} total games`}
            </div>

            {games.map((game) => {
              const isArb = !!game.arb;
              const timeUntil = game.commence_time ? Math.floor((new Date(game.commence_time).getTime() - Date.now()) / 60000) : null;
              const timeLabel = timeUntil !== null
                ? (timeUntil < 0 ? '🔴 LIVE' : timeUntil < 60 ? `Starts in ${timeUntil}m` : `Starts in ${Math.floor(timeUntil / 60)}h ${timeUntil % 60}m`)
                : '';

              return (
                <div key={game.id} style={{
                  background: s.card,
                  border: `1px solid ${isArb ? 'rgba(34,197,94,0.4)' : s.border}`,
                  borderRadius: 12, padding: 16, marginBottom: 12,
                  boxShadow: isArb ? '0 0 20px rgba(34,197,94,0.08)' : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: s.muted, textTransform: 'uppercase' }}>{game.sport_key?.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: 11, color: s.muted }}>·</span>
                      <span style={{ fontSize: 11, color: timeUntil !== null && timeUntil < 0 ? s.red : s.muted }}>{timeLabel}</span>
                    </div>
                    {isArb && <div style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.15)', color: s.green }}>ARB ✓</div>}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{game.bestA?.team}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: s.green }}>{game.bestA?.odds > 0 ? '+' : ''}{game.bestA?.odds}</div>
                      <div style={{ fontSize: 11, color: s.muted }}>{game.bestA?.book}</div>
                      <div style={{ fontSize: 11, color: s.muted }}>{(calcImplied(game.bestA?.odds) * 100).toFixed(1)}% implied chance</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{game.bestB?.team}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: game.bestB?.odds > 0 ? s.green : s.red }}>{game.bestB?.odds > 0 ? '+' : ''}{game.bestB?.odds}</div>
                      <div style={{ fontSize: 11, color: s.muted }}>{game.bestB?.book}</div>
                      <div style={{ fontSize: 11, color: s.muted }}>{(calcImplied(game.bestB?.odds) * 100).toFixed(1)}% implied chance</div>
                    </div>
                  </div>

                  {isArb && (
                    <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                      <div style={{ fontSize: 13, color: s.green, fontWeight: 600, marginBottom: 4 }}>
                        💰 Bet ${game.arb.betA.toFixed(2)} on {game.bestA?.team} at {game.bestA?.book}
                      </div>
                      <div style={{ fontSize: 13, color: s.green, fontWeight: 600, marginBottom: 8 }}>
                        + Bet ${game.arb.betB.toFixed(2)} on {game.bestB?.team} at {game.bestB?.book}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: s.green }}>
                        = ${game.arb.profit.toFixed(2)} guaranteed profit · {game.arb.roi.toFixed(2)}% ROI
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    {isArb && (
                      <button onClick={() => trackArb(game)}
                        style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: s.green, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        + Track This Arb
                      </button>
                    )}
                    <button onClick={() => {
                      setOddsA(String(game.bestA?.odds));
                      setOddsB(String(game.bestB?.odds));
                      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                      style={{ flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${s.border}`, background: 'transparent', color: '#fff', fontSize: 13, cursor: 'pointer' }}>
                      Calculate →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ position: 'sticky', top: 80, alignSelf: 'start' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📋 Tracked Arbs</div>
            {trackedArbs.length === 0 ? (
              <div style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 24, textAlign: 'center', color: s.muted, fontSize: 13 }}>
                No tracked arbs yet. Click "Track This Arb" on any opportunity above.
              </div>
            ) : trackedArbs.map((arb) => (
              <div key={arb.id} style={{ background: s.card, border: `1px solid ${s.border}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: s.muted, marginBottom: 4 }}>{arb.sport?.replace(/_/g, ' ')} · {new Date(arb.trackedAt).toLocaleDateString()}</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{arb.game}</div>
                <div style={{ fontSize: 12, color: s.muted, marginBottom: 4 }}>
                  ${arb.betA?.toFixed(2)} on {arb.teamA} @ {arb.oddsA > 0 ? '+' : ''}{arb.oddsA} ({arb.bookA})
                </div>
                <div style={{ fontSize: 12, color: s.muted, marginBottom: 8 }}>
                  ${arb.betB?.toFixed(2)} on {arb.teamB} @ {arb.oddsB > 0 ? '+' : ''}{arb.oddsB} ({arb.bookB})
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.green, marginBottom: 8 }}>
                  Target: +${arb.profit?.toFixed(2)} ({arb.roi?.toFixed(2)}% ROI)
                </div>
                {arb.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => settleArb(arb.id, 'won')} style={{ flex: 1, padding: '6px', borderRadius: 6, border: 'none', background: 'rgba(34,197,94,0.2)', color: s.green, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✓ Hit</button>
                    <button onClick={() => settleArb(arb.id, 'lost')} style={{ flex: 1, padding: '6px', borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.2)', color: s.red, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✗ Miss</button>
                    <button onClick={() => settleArb(arb.id, 'void')} style={{ flex: 1, padding: '6px', borderRadius: 6, border: `1px solid ${s.border}`, background: 'transparent', color: s.muted, fontSize: 12, cursor: 'pointer' }}>↩ Void</button>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 700, color: arb.status === 'won' ? s.green : arb.status === 'lost' ? s.red : s.muted }}>
                    {arb.status === 'won' ? '✅ Hit — +$' + arb.profit?.toFixed(2) : arb.status === 'lost' ? '❌ Missed' : '↩ Void'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
