// @ts-nocheck
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  TrendingUp, TrendingDown, Activity, RefreshCw, Bell, BellOff,
  Search, Filter, Star, StarOff, Copy, ExternalLink, ChevronDown,
  ChevronUp, AlertTriangle, CheckCircle, XCircle, Clock, Zap,
  Shield, Target, BarChart2, Wallet, ArrowUpRight, ArrowDownRight,
  Radio, Eye, Trash2, Edit2, Plus, Award, BookOpen
} from 'lucide-react'

function PriceChangeRow({ priceChange }: { priceChange: any }) {
  const timeframes = [
    { label: '5m', value: parseFloat(priceChange?.m5 || 0) },
    { label: '1h', value: parseFloat(priceChange?.h1 || 0) },
    { label: '6h', value: parseFloat(priceChange?.h6 || 0) },
    { label: '24h', value: parseFloat(priceChange?.h24 || 0) },
  ]

  return (
    <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:10}}>
      {timeframes.map(tf => {
        const isPos = tf.value > 0
        const isNeg = tf.value < 0
        const color = isPos ? '#22c55e' : isNeg ? '#ef4444' : '#6b7280'
        const bg = isPos ? 'rgba(34,197,94,0.08)' : isNeg ? 'rgba(239,68,68,0.08)' : 'rgba(107,114,128,0.08)'
        const border = isPos ? 'rgba(34,197,94,0.2)' : isNeg ? 'rgba(239,68,68,0.2)' : 'rgba(107,114,128,0.15)'

        return (
          <div key={tf.label} style={{
            background: bg,
            border: `1px solid ${border}`,
            borderRadius: 6,
            padding: '6px 4px',
            textAlign: 'center'
          }}>
            <div style={{fontSize:9, color:'#4b5563', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3}}>
              {tf.label}
            </div>
            <div style={{fontSize:13, fontWeight:800, color, letterSpacing:'-0.02em'}}>
              {isPos ? '+' : ''}{tf.value.toFixed(1)}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

function toast(message, type = "info") {
  if (typeof window !== "undefined" && typeof window.showToast === "function") {
    window.showToast(message, type);
  } else if (typeof window !== "undefined") {
    setTimeout(() => { try { window.showToast?.(message, type); } catch {} }, 50);
  }
}

function parseCoinPrice(p) {
  if (typeof p === 'number') return p;
  if (typeof p === 'string') return parseFloat(p.replace(/[$,]/g, '')) || 0;
  return 0;
}

function computeMomentumScore(coin, position) {
  const change = coin.data?.price_change_percentage_24h?.usd || 0;
  const rank = coin.market_cap_rank;
  // 24h change: +20% = 40pts, 0% = 20pts, -20% = 0pts (linear, clamped)
  const changePts = Math.max(0, Math.min(40, 20 + change));
  // Rank: <100 = 30, <500 = 20, <1000 = 10, else 0
  const rankPts = !rank ? 0 : rank < 100 ? 30 : rank < 500 ? 20 : rank < 1000 ? 10 : 0;
  // Position: index 0 (pos 1) = 30, index 6 (pos 7) = 10 (linear)
  const positionPts = Math.max(0, 30 - position * (20 / 6));
  return Math.round(changePts + rankPts + positionPts);
}

function scoreBadge(score) {
  if (score >= 70) return { label: 'Strong', bg: 'rgba(34,197,94,0.15)', color: '#22c55e' };
  if (score >= 40) return { label: 'Neutral', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' };
  return { label: 'Weak', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' };
}

// Routes through /api/price so CoinGecko / DexScreener calls don't get hit
// per-client (CoinGecko throttles aggressively from the browser). Detection:
// '0x' or ':' in the id means a DexScreener contract address; otherwise a
// CoinGecko named coin like 'bitcoin' / 'hyperliquid'.
async function fetchCurrentPrice(coinId: string): Promise<number> {
  if (!coinId) return 0;
  try {
    // EVM address (0x...) or chain-prefixed (solana:ADDRESS, base:ADDRESS)
    if (coinId.includes('0x') || coinId.includes(':')) {
      const address = coinId.split(':').pop() || coinId;
      const res = await fetch(`/api/price?address=${encodeURIComponent(address)}`);
      const data = await res.json();
      return data?.price || 0;
    }

    // Solana address — base58, typically 32-44 chars, no special prefix
    // Detect by length and character set (no spaces, no hyphens)
    const isSolanaAddress = coinId.length >= 32 && coinId.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(coinId);
    if (isSolanaAddress) {
      const res = await fetch(`/api/price?address=${encodeURIComponent(coinId)}`);
      const data = await res.json();
      return data?.price || 0;
    }

    // CoinGecko named coin (bitcoin, ethereum, hyperliquid etc)
    const res = await fetch(`/api/price?ids=${encodeURIComponent(coinId)}`);
    const data = await res.json();
    return data?.[coinId]?.usd || 0;
  } catch { return 0; }
}

// Heuristic risk classification. CoinGecko coins are gated on market-cap rank
// (anything off the list is treated as low-tier). DexScreener coins (memecoins
// on a contract address) are gated on liquidity, age, mcap, and vol/liq ratio.
// Solana addresses are base58 with no '0x' / ':' so callers must tag the source
// explicitly via coin.source.
function getVerificationStatus(coin) {
  const isDex = coin?.source === 'dexscreener'
    || (coin?.coinId && (coin.coinId.includes('0x') || coin.coinId.includes(':')));

  if (!isDex) {
    const rank = coin?.market_cap_rank || coin?.marketCapRank || 999999;
    if (rank <= 100) return { status: 'verified', label: 'Verified', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', reason: 'Top 100 by market cap', warnings: [] };
    if (rank <= 500) return { status: 'verified', label: 'Verified', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', reason: 'Established coin', warnings: [] };
    return { status: 'unverified', label: 'Unverified', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', reason: 'Low market cap rank', warnings: [] };
  }

  const liq  = parseFloat(coin.liquidity?.usd ?? coin.liquidity ?? 0);
  const vol  = parseFloat(coin.volume?.h24 ?? coin.volume24h ?? 0);
  const age  = coin.ageHours ?? 9999;
  const mcap = parseFloat(coin.marketCap  || 0);

  const warnings = [];
  if (liq < 1000) warnings.push('Very low liquidity — hard to sell');
  else if (liq < 10000) warnings.push('Low liquidity');
  if (age < 1) warnings.push('Less than 1 hour old');
  else if (age < 6) warnings.push('Very new coin');
  if (mcap < 10000) warnings.push('Extremely low market cap');
  if (vol > 0 && liq > 0 && vol / liq > 10) warnings.push('Unusual volume vs liquidity ratio');
  if (liq < 5000 && age < 24) warnings.push('High rug pull risk');

  if (warnings.length === 0 && liq > 50000 && age > 48) {
    return { status: 'verified', label: 'Low Risk', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', reason: 'Good liquidity and age', warnings: [] };
  }
  if (warnings.length <= 1 && liq > 10000) {
    return { status: 'caution', label: 'Caution', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', reason: warnings[0] || 'New or low cap coin', warnings };
  }
  return { status: 'danger', label: 'High Risk', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', reason: 'Multiple risk factors', warnings };
}

function VerificationBadge({ v }) {
  const tooltip = v.warnings && v.warnings.length > 0
    ? `${v.reason}\n\nWarnings:\n• ${v.warnings.join('\n• ')}`
    : v.reason;
  return (
    <span
      title={tooltip}
      style={{
        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
        background: v.bg, color: v.color, border: `1px solid ${v.color}33`,
        whiteSpace: 'nowrap', cursor: 'help',
      }}
    >
      {v.label}
    </span>
  );
}

function VerificationBanner({ v }) {
  if (v.status !== 'danger' || !v.warnings?.length) return null;
  return (
    <div style={{
      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
      borderRadius: 6, padding: '6px 10px', marginTop: 8, fontSize: 11, color: '#ef4444',
    }}>
       {v.warnings.join(' · ')}
    </div>
  );
}

// Maps a verification status to the user-facing filter bucket.
function verificationBucket(status) {
  if (status === 'verified') return 'low';
  if (status === 'danger') return 'high';
  return 'caution';
}

// Routes a coin to the right DEX swap URL based on chain.
// Coins without a contract address (CoinGecko named coins like 'bitcoin')
// resolve to the CoinGecko page. Catches any unexpected shape so a single
// bad coin never throws and trips the ChartErrorBoundary.
function getBuyUrl(coin) {
  try {
    const chainId = (coin?.chainId || coin?.chain || '').toLowerCase();
    const rawId = coin?.coinId || coin?.id || '';
    const address = rawId.includes(':') ? (rawId.split(':').pop() || '') : rawId;
    const isPumpFun = address.endsWith('pump');

    if (!address || (!address.startsWith('0x') && !isPumpFun && address.length < 30)) {
      return {
        url: `https://www.coingecko.com/en/coins/${coin?.id || coin?.coinId || ''}`,
        label: 'View on CoinGecko',
        color: '#6366f1',
        icon: '',
        isPumpFun: false,
        pumpUrl: null,
      };
    }

    if (chainId === 'solana' || chainId === 'sol' || isPumpFun) {
      return {
        url: `https://jup.ag/swap/SOL-${address}`,
        label: 'Buy on Jupiter',
        color: '#22c55e',
        icon: '',
        isPumpFun,
        pumpUrl: isPumpFun ? `https://pump.fun/${address}` : null,
      };
    }
    if (chainId === 'base') {
      return { url: `https://app.uniswap.org/swap?chain=base&outputCurrency=${address}`, label: 'Buy on Uniswap', color: '#ff007a', icon: '', isPumpFun: false, pumpUrl: null };
    }
    if (chainId === 'ethereum' || chainId === 'eth') {
      return { url: `https://app.uniswap.org/swap?chain=mainnet&outputCurrency=${address}`, label: 'Buy on Uniswap', color: '#ff007a', icon: '', isPumpFun: false, pumpUrl: null };
    }
    if (chainId === 'bsc' || chainId === 'bnb') {
      return { url: `https://pancakeswap.finance/swap?chain=bsc&outputCurrency=${address}`, label: 'Buy on PancakeSwap', color: '#f59e0b', icon: '', isPumpFun: false, pumpUrl: null };
    }
    if (chainId === 'arbitrum') {
      return { url: `https://app.uniswap.org/swap?chain=arbitrum&outputCurrency=${address}`, label: 'Buy on Uniswap', color: '#ff007a', icon: '', isPumpFun: false, pumpUrl: null };
    }
    if (chainId === 'polygon') {
      return { url: `https://app.uniswap.org/swap?chain=polygon&outputCurrency=${address}`, label: 'Buy on Uniswap', color: '#8247e5', icon: '', isPumpFun: false, pumpUrl: null };
    }
    if (chainId === 'avalanche') {
      return { url: `https://traderjoexyz.com/avalanche/trade?outputCurrency=${address}`, label: 'Buy on TraderJoe', color: '#e84142', icon: '', isPumpFun: false, pumpUrl: null };
    }
    return { url: coin?.url || `https://dexscreener.com/${chainId}/${address}`, label: 'View on DexScreener', color: '#6366f1', icon: '', isPumpFun: false, pumpUrl: null };
  } catch {
    return { url: '#', label: 'View Chart', color: '#6366f1', icon: '', isPumpFun: false, pumpUrl: null };
  }
}

function CryptoTrending({ refreshKey, onUpdated, signals = [], onLogSignal, onBuy }) {
  const [coins, setCoins] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('https://api.coingecko.com/api/v3/search/trending')
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        setCoins(d.coins || []);
        setLoading(false);
        onUpdated?.(Date.now());
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey, onUpdated]);

  const loggedCoinIds = React.useMemo(() => new Set(signals.map(s => s.coinId)), [signals]);

  if (loading && coins.length === 0) return <div style={{color:"#6b7280",padding:32}}>Loading trending coins...</div>;
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))",gap:12}}>
      {coins.map(({item:c}, position) => {
        const change = c.data?.price_change_percentage_24h?.usd || 0;
        const pos = change >= 0;
        const score = computeMomentumScore(c, position);
        const badge = scoreBadge(score);
        const risk = 100 - score;
        const target = score / 2;
        const logged = loggedCoinIds.has(c.id);
        const onLog = () => {
          if (logged || !onLogSignal) return;
          onLogSignal({
            id: Date.now(),
            coinId: c.id,
            name: c.name,
            symbol: c.symbol,
            score,
            priceAtSignal: parseCoinPrice(c.data?.price),
            change24h: change,
            loggedAt: new Date().toISOString(),
            didTake: false,
            exitPrice: null,
            exitedAt: null,
            notes: '',
            targetGain: null,
            stopLoss: null,
            targetHitNotified: false,
            stopHitNotified: false,
          });
        };
        return (
          <div key={c.id} style={{background: pos?"rgba(34,197,94,0.05)":"rgba(239,68,68,0.05)", border:`1px solid ${pos?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)"}`, borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>{c.name}</div>
                <div style={{fontSize:11,color:"#6b7280"}}>{c.symbol}</div>
              </div>
              <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:"rgba(99,102,241,0.15)",color:"#a5b4fc"}}>#{c.market_cap_rank||'?'}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:6, background:badge.bg, color:badge.color}}>{badge.label}</span>
              <span style={{fontSize:11, color:"#6b7280"}}>Score <span style={{color:"#fff", fontWeight:700}}>{score}</span></span>
            </div>
            <div style={{fontSize:22,fontWeight:800,color:pos?"#22c55e":"#ef4444"}}>{pos?"+":""}{change.toFixed(2)}%</div>
            <div style={{display:"flex",gap:14,fontSize:11,color:"#9ca3af"}}>
              <div>Risk <span style={{color:"#fff",fontWeight:700}}>{risk}%</span></div>
              <div>Target <span style={{color:"#22c55e",fontWeight:700}}>+{target.toFixed(0)}%</span></div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:2,flexWrap:"wrap"}}>
              <button
                onClick={onLog}
                disabled={logged}
                style={{
                  flex:1, padding:"7px 10px", borderRadius:8, border:"none",
                  background: logged ? "#2a2a3a" : "#6366f1",
                  color: logged ? "#6b7280" : "#fff",
                  fontSize:12, fontWeight:700, cursor: logged ? "default" : "pointer",
                  minWidth:90,
                }}
              >{logged ? "Logged " : "Log Signal"}</button>
              <button
                onClick={() => onBuy?.({
                  coinId: c.id,
                  name: c.name,
                  symbol: c.symbol,
                  price: parseCoinPrice(c.data?.price),
                })}
                style={{
                  flex:1, padding:"7px 10px", borderRadius:8, border:"none",
                  background:"#22c55e", color:"#fff",
                  fontSize:12, fontWeight:700, cursor:"pointer",
                  minWidth:70,
                }}
              >Buy →</button>
              <a href={`https://www.coingecko.com/en/coins/${c.id}`} target="_blank" rel="noreferrer" style={{
                padding:"7px 10px", borderRadius:8, border:"1px solid #2a2a3a",
                color:"#9ca3af", fontSize:12, fontWeight:700, textDecoration:"none",
                whiteSpace:"nowrap", display:"inline-flex", alignItems:"center"
              }}>Chart ↗</a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CryptoNewPairs({ refreshKey, onUpdated }) {
  const [pairs, setPairs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch('https://api.dexscreener.com/latest/dex/search?q=meme')
      .then(r => r.json())
      .then(d => {
        const arr = (d.pairs || []).slice(0, 50);
        arr.sort((a, b) => parseFloat(b.priceChange?.h24 || 0) - parseFloat(a.priceChange?.h24 || 0));
        setPairs(arr);
        setLoading(false);
        onUpdated?.(Date.now());
      })
      .catch(() => setLoading(false));
  }, [onUpdated]);

  React.useEffect(() => {
    load();
    const id = setInterval(load, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [refreshKey, load]);

  const chainColor = (chain) => ({solana:"#9945ff",ethereum:"#627eea",base:"#0052ff",bsc:"#f0b90b"}[chain?.toLowerCase()]||"#6b7280");
  const formatPrice = (price) => {
    if (!price) return '—';
    if (price < 0.0001) return '$' + price.toExponential(2);
    if (price < 1) return '$' + price.toFixed(6);
    return '$' + price.toFixed(4);
  };
  const formatAge = (hrs) => {
    if (hrs === null) return '?';
    if (hrs < 1) return '<1h';
    if (hrs < 24) return Math.floor(hrs) + 'h';
    return Math.floor(hrs / 24) + 'd';
  };

  if (loading && pairs.length === 0) return <div style={{color:"#6b7280",padding:32}}>Loading new pairs...</div>;
  return (
    <div style={{background:"#0d0d12",border:"1px solid #16161f",borderRadius:12,overflow:"hidden"}}>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr 1fr",padding:"10px 16px",borderBottom:"1px solid #16161f"}}>
        {["Pair","Chain","Price","1h%","24h%","Volume 24h","Age"].map(h => (
          <div key={h} style={{fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase"}}>{h}</div>
        ))}
      </div>
      {pairs.map((p,i) => {
        const vol = parseFloat(p.volume?.h24 || 0);
        const ageHrs = p.pairCreatedAt ? (() => {
          const ts = typeof p.pairCreatedAt === 'number' && p.pairCreatedAt < 2000000000
            ? p.pairCreatedAt * 1000
            : p.pairCreatedAt
          return (Date.now() - new Date(ts).getTime()) / 3600000
        })() : null;
        const hot = vol > 500000 && ageHrs !== null && ageHrs < 24;
        const ch1 = parseFloat(p.priceChange?.h1 || 0);
        const ch24 = parseFloat(p.priceChange?.h24 || 0);
        return (
          <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr 1fr",padding:"10px 16px",borderBottom:"1px solid #16161f",alignItems:"center"}}>
            <div style={{fontWeight:600,color:"#fff",fontSize:13}}>{p.baseToken?.symbol}/{p.quoteToken?.symbol} {hot?"":""}</div>
            <div><span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:chainColor(p.chainId)+"22",color:chainColor(p.chainId),fontWeight:700}}>{p.chainId?.toUpperCase()?.slice(0,4)}</span></div>
            <div style={{color:"#fff",fontSize:12}}>{formatPrice(parseFloat(p.priceUsd || 0))}</div>
            <div style={{color: ch1>=0 ? "#22c55e" : "#ef4444",fontSize:12}}>{ch1>=0?"+":""}{ch1.toFixed(1)}%</div>
            <div style={{color: ch24>=0 ? "#22c55e" : "#ef4444",fontSize:12}}>{ch24>=0?"+":""}{ch24.toFixed(1)}%</div>
            <div style={{color:"#fff",fontSize:12}}>${vol>1e6?(vol/1e6).toFixed(1)+"M":vol>1e3?(vol/1e3).toFixed(0)+"K":vol.toFixed(0)}</div>
            <div style={{color:"#6b7280",fontSize:12}}>{formatAge(ageHrs)}</div>
          </div>
        );
      })}
    </div>
  );
}

function gemBadge(score) {
  if (score >= 71) return { label: 'GEM',  bg: 'rgba(99,102,241,0.20)', color: '#a5b4fc', desc: 'High momentum, good liquidity, very new — high risk/reward' };
  if (score >= 51) return { label: 'Hot',  bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', desc: 'Good volume and momentum — worth watching' };
  if (score >= 31) return { label: 'Watch',bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', desc: 'Some activity but needs more confirmation' };
  return                  { label: 'Low',  bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', desc: 'Low activity — proceed with extreme caution' };
}

function gemScore(pair) {
  let score = 0;
  const ageHours = pair.pairCreatedAt ? (() => {
    const ts = typeof pair.pairCreatedAt === 'number' && pair.pairCreatedAt < 2000000000
      ? pair.pairCreatedAt * 1000
      : pair.pairCreatedAt
    return (Date.now() - new Date(ts).getTime()) / 3600000
  })() : 999;
  const vol = parseFloat(pair.volume?.h24 || 0);
  const liq = parseFloat(pair.liquidity?.usd || 0);
  const c1h = parseFloat(pair.priceChange?.h1 || 0);
  const c6h = parseFloat(pair.priceChange?.h6 || 0);

  if (ageHours < 6)       score += 25;
  else if (ageHours < 24) score += 20;
  else if (ageHours < 48) score += 15;
  else if (ageHours < 72) score += 10;

  if (vol > 1_000_000)    score += 25;
  else if (vol > 500_000) score += 20;
  else if (vol > 100_000) score += 15;
  else if (vol >  50_000) score += 10;
  else if (vol >  10_000) score += 5;

  if (c1h > 20)      score += 20;
  else if (c1h > 10) score += 15;
  else if (c1h > 5)  score += 10;
  else if (c1h > 0)  score += 5;

  if (c6h > 50)      score += 15;
  else if (c6h > 20) score += 10;
  else if (c6h > 0)  score += 5;

  if (liq > 100_000)    score += 15;
  else if (liq > 50_000)  score += 10;
  else if (liq > 10_000)  score += 5;

  return Math.min(100, score);
}

function formatAgeLabel(hours) {
  if (hours == null || !isFinite(hours)) return '?';
  if (hours < 1) return '<1 hour old';
  if (hours < 24) return Math.floor(hours) + (Math.floor(hours) === 1 ? ' hour old' : ' hours old');
  const days = Math.floor(hours / 24);
  return days + (days === 1 ? ' day old' : ' days old');
}

function formatBigUsd(n) {
  if (!n) return '$0';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n.toFixed(0);
}

// Pump.fun coins all mint on Solana with a fixed 1,000,000,000 (1B) total supply.
// Price per token ≈ usd_market_cap / TOTAL_SUPPLY.
const PUMP_TOTAL_SUPPLY = 1_000_000_000;

function formatPumpMcap(n) {
  if (!n || !isFinite(n)) return '—';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'k';
  return '$' + Math.round(n).toLocaleString();
}

function formatPumpAge(ageHours) {
  if (!isFinite(ageHours) || ageHours < 0) return '?';
  if (ageHours < 1) return Math.max(1, Math.floor(ageHours * 60)) + 'm old';
  if (ageHours < 24) return ageHours.toFixed(1) + 'h old';
  return Math.floor(ageHours / 24) + 'd old';
}

// Penalize coins that already pumped — reward early entry signals.
function scoreGem(pair: any): number {
  let score = 0;
  const h1 = parseFloat(pair.priceChange?.h1 || 0);
  const h24 = parseFloat(pair.priceChange?.h24 || 0);
  const vol24 = parseFloat(pair.volume?.h24 || 0);
  const liq = parseFloat(pair.liquidity?.usd || 0);
  const mc = parseFloat(pair.marketCap || pair.fdv || 0);
  const buys = pair.txns?.h1?.buys || 0;
  const sells = pair.txns?.h1?.sells || 0;
  const buyRatio = (buys + sells) > 0 ? buys / (buys + sells) : 0.5;

  const createdAt = pair.pairCreatedAt;
  const ageMs = createdAt
    ? (() => {
        if (typeof createdAt === 'number') {
          // DexScreener returns Unix timestamp in milliseconds
          // But if the number is less than 2000000000 it's in SECONDS not ms
          const ms = createdAt < 2000000000 ? createdAt * 1000 : createdAt
          return Date.now() - ms
        }
        // String format — parse as ISO date
        return Date.now() - new Date(createdAt).getTime()
      })()
    : 999 * 3600000;
  const ageHours = ageMs / 3600000;

  // Aliases preserved for existing code below
  const priceChange1h = h1;
  const priceChange24h = h24;
  const volume24h = vol24;
  const liquidity = liq;
  const marketCap = mc;

  // AGE (30pts) — sweet spot 1-6 hours
  if (ageHours < 0.5) score += 10;
  else if (ageHours < 2) score += 30;
  else if (ageHours < 6) score += 25;
  else if (ageHours < 24) score += 12;
  else if (ageHours < 48) score += 4;
  else score += 0;

  // PUMP PENALTY — already pumped = too late
  if (priceChange1h > 500) score -= 35;
  else if (priceChange1h > 200) score -= 25;
  else if (priceChange1h > 100) score -= 15;
  else if (priceChange1h > 50) score -= 5;
  else if (priceChange1h > 10 && priceChange1h < 50) score += 15;
  else if (priceChange1h >= 0) score += 10;

  if (priceChange24h > 1000) score -= 20;
  else if (priceChange24h > 500) score -= 10;

  // LIQUIDITY (20pts)
  if (liquidity > 5000 && liquidity < 100000) score += 20;
  else if (liquidity > 1000 && liquidity < 500000) score += 12;
  else if (liquidity < 1000) score -= 10;
  else score += 5;

  // VOLUME (15pts)
  if (volume24h > 50000) score += 15;
  else if (volume24h > 10000) score += 10;
  else if (volume24h > 1000) score += 5;

  // BUY PRESSURE (15pts)
  if (buyRatio > 0.7) score += 15;
  else if (buyRatio > 0.6) score += 10;
  else if (buyRatio > 0.5) score += 5;
  else score -= 5;

  // MARKET CAP (20pts) — lower = more room
  if (marketCap > 0 && marketCap < 50000) score += 20;
  else if (marketCap < 200000) score += 14;
  else if (marketCap < 1000000) score += 8;
  else if (marketCap < 5000000) score += 3;
  else score += 0;

  return Math.max(0, Math.min(100, score));
}

function getSignals(coin: any) {
  const signals: { text: string; color: string }[] = [];
  const createdAt = coin.pairCreatedAt;
  const ageMs = createdAt
    ? (typeof createdAt === 'number'
      ? (createdAt < 2000000000 ? Date.now() - createdAt * 1000 : Date.now() - createdAt)
      : Date.now() - new Date(createdAt).getTime())
    : 999 * 3600000;
  const age = ageMs / 3600000;
  const priceChange1h = parseFloat(coin.priceChange?.h1 || 0);
  const buys = coin.txns?.h1?.buys || 0;
  const sells = coin.txns?.h1?.sells || 0;
  const buyRatio = buys / Math.max(buys + sells, 1);
  const liquidity = parseFloat(coin.liquidity?.usd || 0);

  if (age < 2) signals.push({ text: '🆕 Under 2h old', color: '#22c55e' });
  else if (age < 6) signals.push({ text: '⏰ Under 6h old', color: '#86efac' });

  if (priceChange1h > 500) signals.push({ text: ' Already pumped 1h', color: '#ef4444' });
  else if (priceChange1h > 100) signals.push({ text: 'Big 1h move', color: '#f59e0b' });
  else if (priceChange1h > 10) signals.push({ text: 'Early momentum', color: '#22c55e' });
  else if (priceChange1h >= 0) signals.push({ text: 'Flat — untouched', color: '#60a5fa' });

  if (buyRatio > 0.7) signals.push({ text: 'Strong buy pressure', color: '#22c55e' });
  else if (buyRatio > 0.6) signals.push({ text: 'More buyers than sellers', color: '#86efac' });
  else signals.push({ text: ' Selling pressure', color: '#ef4444' });

  if (liquidity < 5000) signals.push({ text: ' Low liquidity — rug risk', color: '#ef4444' });
  else if (liquidity < 50000) signals.push({ text: 'Healthy liquidity', color: '#22c55e' });

  return signals;
}

function getSnipeWindow(coin: any) {
  const createdAt = coin.pairCreatedAt;
  const ageMs = createdAt
    ? (typeof createdAt === 'number'
      ? (createdAt < 2000000000 ? Date.now() - createdAt * 1000 : Date.now() - createdAt)
      : Date.now() - new Date(createdAt).getTime())
    : 999 * 3600000;
  const age = ageMs / 3600000;
  const priceChange1h = parseFloat(coin.priceChange?.h1 || 0);

  if (priceChange1h > 500)
    return { id: 'toolate', label: 'TOO LATE', color: '#ef4444', desc: 'Already pumped hard — missed it' };
  if (age < 1 && priceChange1h < 50)
    return { id: 'prime', label: 'PRIME SNIPE', color: '#22c55e', desc: 'Under 1h old, not yet pumped' };
  if (age < 3 && priceChange1h < 100)
    return { id: 'early', label: 'EARLY', color: '#86efac', desc: 'Still very early entry' };
  if (age < 6 && priceChange1h < 200)
    return { id: 'watch', label: 'WATCH', color: '#fbbf24', desc: 'Getting late but possible' };
  return { id: 'cold', label: ' COLD', color: '#6b7280', desc: 'Likely missed this one' };
}

const getVerdict = (coin: any) => {
  const ageHours = coin.ageHours || 999
  const liq = parseFloat(coin.liquidity?.usd || 0)
  const buyRatio = coin.buyRatio || 0.5
  const h1 = parseFloat(coin.priceChange?.h1 || 0)
  const h24 = parseFloat(coin.priceChange?.h24 || 0)
  const hasTwitter = coin.info?.socials?.some((s:any) => s.type === 'twitter')
  const hasTelegram = coin.info?.socials?.some((s:any) => s.type === 'telegram')

  let positives = 0
  let negatives = 0
  const reasons: string[] = []

  // Age check
  if (ageHours < 2) { positives++; reasons.push('Fresh launch') }
  else if (ageHours < 6) { positives++ }
  else if (ageHours > 24) negatives++

  // Pump check
  if (h24 > 500) { negatives += 2; reasons.push('Already pumped hard') }
  else if (h24 < 100 && h1 > 0) { positives++; reasons.push('Still early') }

  // Liquidity check
  if (liq > 20000) { positives++; reasons.push('Strong liquidity') }
  else if (liq > 5000) positives++
  else { negatives++; reasons.push('Low liquidity') }

  // Buy pressure
  if (buyRatio > 0.65) { positives++; reasons.push('Strong buyers') }
  else if (buyRatio > 0.55) positives++
  else if (buyRatio < 0.4) { negatives++; reasons.push('Selling pressure') }

  // Socials
  if (hasTwitter || hasTelegram) positives++
  else { negatives++; reasons.push('No socials') }

  let verdict: 'STRONG BUY' | 'BUY' | 'WATCH' | 'SKIP'
  let verdictColor: string
  let verdictBg: string

  if (negatives >= 2) {
    verdict = 'SKIP'; verdictColor = '#ef4444'; verdictBg = 'rgba(239,68,68,0.12)'
  } else if (positives >= 4) {
    verdict = 'STRONG BUY'; verdictColor = '#22c55e'; verdictBg = 'rgba(34,197,94,0.12)'
  } else if (positives >= 2) {
    verdict = 'BUY'; verdictColor = '#86efac'; verdictBg = 'rgba(34,197,94,0.08)'
  } else {
    verdict = 'WATCH'; verdictColor = '#f59e0b'; verdictBg = 'rgba(245,158,11,0.1)'
  }

  return { verdict, verdictColor, verdictBg, reasons: reasons.slice(0, 2) }
}

function CryptoGems({ refreshKey, onUpdated, signals = [], onLogSignal, onBuy }) {
  const [gems, setGems] = React.useState([]);
  const [gemsLoading, setGemsLoading] = React.useState(true);
  const [gemsLastUpdated, setGemsLastUpdated] = React.useState(null);
  const [secondsAgo, setSecondsAgo] = React.useState(0);
  const [snipeFilter, setSnipeFilter] = React.useState('all'); // 'prime' | 'early' | 'watch' | 'toolate' | 'all'
  const [ageFilter, setAgeFilter] = React.useState('all');     // 'all' | '1' | '6' | '24' | '48'
  const [scoreFilter, setScoreFilter] = React.useState('all'); // 'all' | 'hot' | 'gems'
  const [sortBy, setSortBy] = React.useState('score');         // 'score' | 'age' | 'mcap' | 'change' | 'volume'
  const [riskFilter, setRiskFilter] = React.useState('all');   // 'all' | 'low' | 'caution' | 'high'
  const [copiedId, setCopiedId] = React.useState(null);
  const [snipeAnalysis, setSnipeAnalysis] = React.useState<Record<string,any>>({});
  const [snipeAnalyzing, setSnipeAnalyzing] = React.useState<Record<string,boolean>>({});
  const [tab, setTab] = React.useState<'sniper'|'fomo'>('sniper');
  const [rugData, setRugData] = React.useState<Record<string, any>>({});
  const [rugLoading, setRugLoading] = React.useState<Record<string, boolean>>({});
  const [alertsEnabled, setAlertsEnabled] = useState(() => typeof window !== 'undefined' && localStorage.getItem('sniper_alerts') === 'true')
  const [knownPrimeIds, setKnownPrimeIds] = useState<Set<string>>(() => new Set())
  const [alertedIds, setAlertedIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try { return new Set(JSON.parse(localStorage.getItem('sniper_alerted_ids') || '[]')) } catch { return new Set() }
  })
  const [whaleWallet, setWhaleWallet] = React.useState('');
  const [savedWhales, setSavedWhales] = React.useState<{address:string;label:string}[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('sniper_whales') || '[]'); } catch { return []; }
  });
  const [autoVerdicts, setAutoVerdicts] = useState<Record<string,any>>({})

  const getAutoVerdict = (coin: any) => {
    const ageHours = coin.ageHours || 999
    const liq = parseFloat(coin.liquidity?.usd || 0)
    const buyRatio = coin.buyRatio || 0.5
    const h1 = parseFloat(coin.priceChange?.h1 || 0)
    const h24 = parseFloat(coin.priceChange?.h24 || 0)
    const hasTwitter = coin.info?.socials?.some((s:any) => s.type === 'twitter')
    const hasTelegram = coin.info?.socials?.some((s:any) => s.type === 'telegram')
    const vol24 = parseFloat(coin.volume?.h24 || 0)

    const redFlags: string[] = []
    const greenFlags: string[] = []

    if (h24 > 500) redFlags.push('Already pumped 500%+')
    if (h1 > 200) redFlags.push('Up 200% in last hour')
    if (liq < 3000) redFlags.push('Very low liquidity')
    if (buyRatio < 0.35) redFlags.push('Mostly selling')
    if (!hasTwitter && !hasTelegram) redFlags.push('No community')
    if (ageHours > 48) redFlags.push('Too old')
    if (vol24 < 1000) redFlags.push('No volume')

    if (ageHours < 2) greenFlags.push('Just launched')
    else if (ageHours < 6) greenFlags.push('Still early')
    if (liq > 20000) greenFlags.push('Strong liquidity')
    else if (liq > 5000) greenFlags.push('Good liquidity')
    if (buyRatio > 0.65) greenFlags.push('Strong buying')
    else if (buyRatio > 0.55) greenFlags.push('More buyers')
    if (hasTwitter) greenFlags.push('Has Twitter')
    if (hasTelegram) greenFlags.push('Has Telegram')
    if (h1 > 0 && h1 < 100) greenFlags.push('Healthy growth')

    let verdict: 'SAFE TO TRY' | 'RISKY' | 'AVOID'
    let color: string
    let bg: string
    let emoji: string

    if (redFlags.length >= 3) {
      verdict = 'AVOID'; color = '#ef4444'; bg = 'rgba(239,68,68,0.1)'; emoji = '🚫'
    } else if (redFlags.length >= 1 || greenFlags.length < 3) {
      verdict = 'RISKY'; color = '#f59e0b'; bg = 'rgba(245,158,11,0.1)'; emoji = '⚠️'
    } else {
      verdict = 'SAFE TO TRY'; color = '#22c55e'; bg = 'rgba(34,197,94,0.1)'; emoji = '✅'
    }

    const price = parseFloat(coin.priceUsd || coin.price || '0')
    const stopLossPrice = price * 0.5
    const target2x = price * 2
    const target5x = price * 5

    return { verdict, color, bg, emoji, redFlags, greenFlags, stopLossPrice, target2x, target5x, price }
  }

  const enableAlerts = async () => {
    if (!('Notification' in window)) {
      alert('Your browser does not support notifications')
      return
    }
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      setAlertsEnabled(true)
      localStorage.setItem('sniper_alerts', 'true')
      new Notification('Coin Sniper Alerts ON', {
        body: 'You will be notified when a new Prime Snipe appears',
        icon: '/favicon.ico'
      })
    } else {
      alert('Please allow notifications in your browser settings to get alerts')
    }
  };

  const getTradeLinks = (coin: any) => {
    const address = coin.baseToken?.address || coin.pairAddress || '';
    const chain = (coin.chainId || coin.chain || '').toLowerCase();
    const links: {label:string;url:string;color:string}[] = [];

    if (chain === 'solana' || chain === 'sol') {
      if (address) {
        links.push({ label: 'Buy on Jupiter', url: `https://jup.ag/swap/SOL-${address}`, color: '#22c55e' });
        links.push({ label: 'Trade on FOMO',  url: `https://fomo.family/token/${address}?ref=al1valol`, color: '#6366f1' });
      }
    } else if (chain === 'base') {
      if (address) links.push({ label: 'Buy on Uniswap', url: `https://app.uniswap.org/swap?chain=base&outputCurrency=${address}`, color: '#ff007a' });
    } else if (chain === 'ethereum' || chain === 'eth') {
      if (address) links.push({ label: 'Buy on Uniswap', url: `https://app.uniswap.org/swap?outputCurrency=${address}`, color: '#ff007a' });
    } else if (chain === 'bsc') {
      if (address) links.push({ label: 'Buy on PancakeSwap', url: `https://pancakeswap.finance/swap?outputCurrency=${address}`, color: '#f59e0b' });
    }

    links.push({
      label: 'DexScreener',
      url: coin.url || `https://dexscreener.com/${chain}/${address}`,
      color: '#6b7280',
    });
    return links;
  };

  const SparkLine = ({ coin }: { coin: any }) => {
    const m5 = parseFloat(coin.priceChange?.m5 || 0);
    const h1 = parseFloat(coin.priceChange?.h1 || 0);
    const points = [0, m5 / 2, m5, (m5 + h1) / 2, h1];
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const isUp = h1 > 0;
    return (
      <svg width="80" height="24" style={{ display: 'block' }}>
        <polyline
          points={points.map((v, i) => `${i * 20},${22 - ((v - min) / range) * 20}`).join(' ')}
          fill="none"
          stroke={isUp ? '#22c55e' : '#ef4444'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  const checkRug = async (coin: any) => {
    const address = coin.baseToken?.address;
    if (!address || rugData[address]) return;

    const chain = (coin.chainId || coin.chain || '').toLowerCase();
    if (chain !== 'solana' && chain !== 'sol') {
      setRugData(prev => ({...prev, [address]: { error: 'Only available for Solana tokens' }}));
      return;
    }

    setRugLoading(prev => ({...prev, [address]: true}));
    try {
      const res = await fetch(`/api/rugcheck?address=${address}`);
      const data = await res.json();
      setRugData(prev => ({...prev, [address]: data}));
    } catch(e) {}
    setRugLoading(prev => ({...prev, [address]: false}));
  };

  const formatNum = (n: number) => {
    if (n >= 1000000) return (n/1000000).toFixed(1)+'M';
    if (n >= 1000) return (n/1000).toFixed(1)+'k';
    return n.toFixed(0);
  };

  const getContractAddress = (coin: any) => {
    if (coin.coinId?.includes(':')) return coin.coinId.split(':').pop();
    if (coin.pairAddress) return coin.pairAddress;
    return null;
  };

  const getFomoLink = (coin: any) => {
    const address = getContractAddress(coin);
    const chain = (coin.chain || '').toLowerCase();
    if (!address) return 'https://fomo.family/r/al1valol';
    if (chain === 'solana' || chain === 'sol') return `https://fomo.family/r/al1valol`;
    if (chain === 'base') return `https://fomo.family/r/al1valol`;
    return `https://dexscreener.com/${chain}/${address}`;
  };

  const getJupiterLink = (coin: any) => {
    const address = getContractAddress(coin);
    const chain = (coin.chain || '').toLowerCase();
    if (chain === 'solana' || chain === 'sol') {
      return address ? `https://jup.ag/swap/SOL-${address}` : null;
    }
    return null;
  };

  const getUniswapLink = (coin: any) => {
    const address = getContractAddress(coin);
    const chain = (coin.chain || '').toLowerCase();
    if (chain === 'base') return address ? `https://app.uniswap.org/swap?chain=base&outputCurrency=${address}` : null;
    if (chain === 'ethereum' || chain === 'eth') return address ? `https://app.uniswap.org/swap?outputCurrency=${address}` : null;
    return null;
  };

  const getRiskLevel = (coin: any) => {
    const liq = parseFloat(coin.liquidity?.usd || 0);
    const mc = parseFloat(coin.marketCap || 0);
    const h1 = parseFloat(coin.priceChange?.h1 || 0);
    if (liq < 1000) return { label: 'Extreme Risk', color: '#ef4444', desc: 'Very low liquidity — rug risk' };
    if (liq < 5000) return { label: ' High Risk', color: '#f97316', desc: 'Low liquidity' };
    if (h1 > 500) return { label: ' High Risk', color: '#f97316', desc: 'Already pumped hard' };
    if (liq > 20000 && mc < 500000) return { label: 'Low Risk', color: '#22c55e', desc: 'Good liquidity for size' };
    return { label: 'Medium Risk', color: '#f59e0b', desc: 'Normal meme coin risk' };
  };

  const analyzeSnipe = async (coin: any) => {
    const id = coin.coinId || coin.pairAddress;
    setSnipeAnalyzing(prev => ({...prev, [id]: true}));
    try {
      const res = await fetch('/api/analyze-game', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          team1: coin.name || coin.symbol,
          team2: 'SKIP',
          sport: 'CRYPTO',
          odds1: 0,
          odds2: 0,
          gameTime: 'Now',
          context: `Meme coin snipe analysis. Coin: ${coin.name} (${coin.symbol}) on ${coin.chain}. Age: ${coin.ageHours?.toFixed(1)}h. Price change 1h: ${coin.priceChange?.h1}%, 24h: ${coin.priceChange?.h24}%. Market cap: $${coin.marketCap}. Liquidity: $${coin.liquidity?.usd}. Volume 24h: $${coin.volume?.h24}. Buy ratio: ${Math.round((coin.buyRatio||0.5)*100)}%. Score: ${coin.score}/100. Should I snipe this meme coin right now? Reply with pick as BUY, SKIP, or WATCH.`
        })
      });
      const data = await res.json();

      const verdict = data.pick === coin.name || data.pick?.includes('BUY') ? 'BUY'
        : data.avoid ? 'SKIP'
        : data.pick === 'SKIP' ? 'SKIP'
        : 'WATCH';

      setSnipeAnalysis(prev => ({...prev, [id]: {
        verdict,
        confidence: data.confidence || 'medium',
        reason: data.reasoning || 'Analysis complete',
        risk: data.warning ? 'high' : 'medium'
      }}));
    } catch(e) {
      console.error('Snipe analyze error:', e);
    }
    setSnipeAnalyzing(prev => ({...prev, [id]: false}));
  };

  const fetchGems = React.useCallback(async () => {
    setGemsLoading(true)
    try {
      const res = await fetch('/api/gems', { cache: 'no-store' })
      const data = await res.json()

      const coins = (data.coins || []).map((coin: any) => {
        const score = scoreGem(coin)
        const signals = getSignals(coin)
        const snipeWindow = getSnipeWindow(coin)
        return {
          ...coin,
          gemScore: score,
          score,
          signals,
          snipeWindow,
          change1h: parseFloat(coin.priceChange?.h1 || 0),
          change24h: parseFloat(coin.priceChange?.h24 || 0),
          volume24h: parseFloat(coin.volume?.h24 || 0),
        }
      })

      coins.sort((a: any, b: any) => b.gemScore - a.gemScore)
      setGems(coins)
      const now = Date.now()
      setGemsLastUpdated(now)
      setSecondsAgo(0)
      onUpdated?.(now)
    } catch(e: any) {
      console.error('fetchGems error:', e?.message || e)
      setGems([])
    }
    setGemsLoading(false)
  }, [refreshKey])

  // Auto-refresh every 60 seconds. The component only mounts while the gems
  // sub-section is active, so this is equivalent to gating on appMode/section.
  React.useEffect(() => {
    fetchGems();
    const id = setInterval(fetchGems, 60_000);
    return () => clearInterval(id);
  }, [fetchGems, refreshKey]);

  useEffect(() => {
    if (gems.length === 0) return
    gems.forEach(coin => {
      const id = coin.coinId || coin.pairAddress
      if (autoVerdicts[id]) return
      const verdict = getAutoVerdict(coin)
      setAutoVerdicts(prev => ({...prev, [id]: verdict}))
    })
  }, [gems])

  // 1-second tick so "updated Xs ago" stays live
  React.useEffect(() => {
    const tick = setInterval(() => {
      if (gemsLastUpdated) setSecondsAgo(Math.floor((Date.now() - gemsLastUpdated) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [gemsLastUpdated]);

  // Restore alerts toggle from localStorage on mount
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem('sniper_alerts') === 'true' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      setAlertsEnabled(true);
    }
  }, []);

  // Fire browser notifications when new Prime Snipes appear
  useEffect(() => {
    if (!alertsEnabled || gems.length === 0) return

    const primeSnipes = gems.filter(g =>
      g.snipeWindow?.id === 'prime' ||
      (g.ageHours < 1 && parseFloat(g.priceChange?.h1 || 0) < 50)
    )

    primeSnipes.forEach(coin => {
      const id = coin.baseToken?.address || coin.pairAddress
      if (!id || alertedIds.has(id)) return

      // New prime snipe found - send notification
      const ageDisplay = coin.ageHours < 1
        ? `${Math.round(coin.ageHours * 60)}m old`
        : `${coin.ageHours.toFixed(1)}h old`

      const name = coin.baseToken?.name || coin.name || 'New Coin'
      const symbol = coin.baseToken?.symbol || coin.symbol || ''
      const chain = (coin.chainId || coin.chain || '').toUpperCase()

      try {
        const notif = new Notification(`PRIME SNIPE: ${name}`, {
          body: `${symbol} on ${chain} · ${ageDisplay} · Score ${coin.score}/100 · Not yet pumped`,
          icon: coin.image || '/favicon.ico',
          tag: id, // prevents duplicate notifications
          requireInteraction: true // stays on screen until dismissed
        })

        // Clicking notification opens the crypto page
        notif.onclick = () => {
          window.focus()
          window.location.href = '/crypto'
        }
      } catch(e) {}

      // Mark as alerted so we don't notify again
      const newAlerted = new Set([...alertedIds, id])
      setAlertedIds(newAlerted)
      localStorage.setItem('sniper_alerted_ids', JSON.stringify([...newAlerted]))
    })

    // Clean up old alerted IDs (keep last 100 to prevent localStorage bloat)
    if (alertedIds.size > 100) {
      const trimmed = new Set([...alertedIds].slice(-100))
      setAlertedIds(trimmed)
      localStorage.setItem('sniper_alerted_ids', JSON.stringify([...trimmed]))
    }
  }, [gems, alertsEnabled]);

  const loggedKeys = React.useMemo(
    () => new Set(signals.map(s => s.coinId)),
    [signals]
  );

  const primeCount = gems.filter(g => g.snipeWindow?.id === 'prime').length

  const visible = React.useMemo(() => {
    let arr = gems;
    if (snipeFilter === 'dip') {
      arr = arr.filter(c => c.isDip === true);
    } else if (snipeFilter !== 'all') {
      arr = arr.filter(c => c.snipeWindow?.id === snipeFilter);
    }
    if (ageFilter !== 'all') {
      const max = parseFloat(ageFilter);
      arr = arr.filter(c => c.ageHours < max);
    }
    if (scoreFilter === 'hot') arr = arr.filter(c => c.gemScore >= 50);
    else if (scoreFilter === 'gems') arr = arr.filter(c => c.gemScore >= 70);
    if (riskFilter !== 'all') {
      arr = arr.filter(c => verificationBucket(getVerificationStatus({ ...c, source: 'dexscreener' }).status) === riskFilter);
    }
    arr = [...arr];
    if (sortBy === 'score') {
      // Primary: score desc. Always push >500% 1h pumpers to the bottom regardless of score.
      arr.sort((a, b) => {
        const aPumped = (a.change1h || 0) > 500 ? 1 : 0;
        const bPumped = (b.change1h || 0) > 500 ? 1 : 0;
        if (aPumped !== bPumped) return aPumped - bPumped;
        return b.gemScore - a.gemScore;
      });
    }
    else if (sortBy === 'mcap')    arr.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    else if (sortBy === 'change')  arr.sort((a, b) => (b.change24h || 0) - (a.change24h || 0));
    else if (sortBy === 'volume')  arr.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
    else                           arr.sort((a, b) => (a.ageHours || 0) - (b.ageHours || 0));
    return arr;
  }, [gems, snipeFilter, ageFilter, scoreFilter, sortBy, riskFilter]);

  const launchedInLastHour = gems.filter(c => c.ageHours < 1).length;

  const pillStyle = (active, accent) => ({
    padding: '5px 12px', borderRadius: 999, border: `1px solid ${active ? (accent || '#6366f1') : '#16161f'}`,
    background: active ? (accent || '#6366f1') : '#1a1a24',
    color: active ? '#fff' : '#9ca3af',
    fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  });

  const sniperLoading = gemsLoading && gems.length === 0;

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:16, borderBottom:'1px solid #16161f' }}>
        {[
          ['sniper', 'Coin Sniper'],
          ['fomo', 'Trade on FOMO'],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as 'sniper'|'fomo')} style={{
            padding:'10px 16px', border:'none', background:'transparent',
            color: tab === id ? '#fff' : '#6b7280',
            fontSize:13, fontWeight:700, cursor:'pointer',
            borderBottom: tab === id ? '2px solid #6366f1' : '2px solid transparent',
            marginBottom:-1,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'fomo' && (
        <div style={{padding:20}}>
          <div style={{fontSize:20, fontWeight:800, color:'#fff', marginBottom:8}}> Trade on FOMO</div>
          <div style={{fontSize:13, color:'#6b7280', marginBottom:20}}>
            FOMO is a social trading app with 120,000+ users. Trade meme coins instantly and share your picks to build a following.
          </div>

          <div style={{background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:12, padding:20, marginBottom:16}}>
            <div style={{fontSize:15, fontWeight:700, color:'#a5b4fc', marginBottom:8}}> FOMO Referral Program</div>
            <div style={{fontSize:13, color:'#d1d5db', marginBottom:12, lineHeight:1.6}}>
              Share your referral link and earn a percentage of trading fees from everyone who signs up through you — forever.
            </div>
            <a href="https://fomo.family/r/al1valol" target="_blank" rel="noreferrer" style={{
              display:'block', padding:'12px', borderRadius:8, border:'none',
              background:'#6366f1', color:'#fff', fontSize:14, fontWeight:700,
              textDecoration:'none', textAlign:'center', marginBottom:8
            }}>
              Join FOMO & Get Your Referral Link →
            </a>
            <div style={{fontSize:11, color:'#6b7280', textAlign:'center'}}>
              Sign up → Profile → Share → Earn % of every trade your referrals make
            </div>
          </div>

          <div style={{background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:8, padding:12, marginTop:8, marginBottom:16}}>
            <div style={{fontSize:12, fontWeight:700, color:'#22c55e', marginBottom:4}}> Your Referral Link</div>
            <div style={{fontSize:11, color:'#86efac', marginBottom:8, wordBreak:'break-all', fontFamily:'monospace'}}>
              https://fomo.family/r/al1valol
            </div>
            <button onClick={() => {
              navigator.clipboard.writeText('https://fomo.family/r/al1valol');
              alert('Copied to clipboard!');
            }} style={{display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, background:'rgba(34,197,94,0.15)', color:'#22c55e', fontSize:13, fontWeight:700, cursor:'pointer', border:'1px solid rgba(34,197,94,0.25)'}}>
              <Copy size={12}/> Copy Link
            </button>
            <div style={{fontSize:10, color:'#6b7280', marginTop:6}}>
              Share this link on Twitter/X when you post picks — earn % of every trade your referrals make forever
            </div>
          </div>

          <div style={{background:'#0d0d12', border:'1px solid #16161f', borderRadius:12, padding:20, marginBottom:16}}>
            <div style={{fontSize:15, fontWeight:700, color:'#fff', marginBottom:12}}> How to use Coin Sniper + FOMO</div>
            {[
              {step:'1', text:'Find a PRIME SNIPE coin here in Coin Sniper'},
              {step:'2', text:'Check the AI analysis — if it says BUY with high confidence'},
              {step:'3', text:'Open FOMO app and search the coin name or contract address'},
              {step:'4', text:'Buy a small position ($50-200) quickly before it pumps'},
              {step:'5', text:'Share your pick on Twitter/X with your FOMO referral link'},
              {step:'6', text:'When followers join FOMO through your link you earn their fees forever'},
            ].map(s => (
              <div key={s.step} style={{display:'flex', gap:12, marginBottom:10, alignItems:'flex-start'}}>
                <div style={{width:24, height:24, borderRadius:'50%', background:'rgba(99,102,241,0.2)', color:'#a5b4fc', fontSize:12, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                  {s.step}
                </div>
                <div style={{fontSize:13, color:'#d1d5db', lineHeight:1.5}}>{s.text}</div>
              </div>
            ))}
          </div>

          <div style={{fontSize:13, fontWeight:700, color:'#6b7280', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.05em'}}>Quick Links</div>
          {[
            {name:'FOMO App (fomo.family)', url:'https://fomo.family/r/al1valol', desc:'Main trading platform — cross chain'},
            {name:'FOMO.gg', url:'https://fomo.gg', desc:'Meme coin launchpad on Solana'},
            {name:'iOS App', url:'https://fomo.family/r/al1valol', desc:'Download on iPhone'},
            {name:'Android App', url:'https://fomo.family/r/al1valol', desc:'Download on Android'},
          ].map(link => (
            <a key={link.url} href={link.url} target="_blank" rel="noreferrer" style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'12px 14px', borderRadius:8, border:'1px solid #16161f',
              background:'transparent', textDecoration:'none', marginBottom:8
            }}>
              <div>
                <div style={{fontSize:13, fontWeight:600, color:'#fff'}}>{link.name}</div>
                <div style={{fontSize:11, color:'#6b7280'}}>{link.desc}</div>
              </div>
              <span style={{color:'#6b7280', fontSize:14}}>→</span>
            </a>
          ))}

          <div style={{marginTop:16, padding:14, background:'#0d0d12', border:'1px solid #16161f', borderRadius:12}}>
            <div style={{fontSize:13, fontWeight:700, color:'#fff', marginBottom:8}}> Current Top Snipes to Trade on FOMO</div>
            <div style={{fontSize:12, color:'#6b7280', marginBottom:10}}>Based on Coin Sniper scores right now:</div>
            {gems.filter(g => g.snipeWindow?.id === 'prime' || g.snipeWindow?.id === 'early').slice(0,3).map((coin, i) => (
              <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #16161f'}}>
                <div>
                  <div style={{fontSize:13, fontWeight:700, color:'#fff'}}>{coin.name} ({coin.symbol})</div>
                  <div style={{fontSize:11, color:'#6b7280'}}>{coin.chain} · Score {coin.profitScore || coin.score || coin.gemScore}/100 · {coin.snipeWindow?.label}</div>
                </div>
                {getContractAddress(coin) && (
                  <button onClick={() => {
                    navigator.clipboard.writeText(getContractAddress(coin) || '');
                    alert(`Contract copied: ${getContractAddress(coin)}\n\nPaste this in FOMO or Jupiter to find ${coin.name}`);
                  }} style={{padding:'6px 12px', borderRadius:6, border:'none', background:'#6366f1', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer'}}>
                     Copy CA
                  </button>
                )}
              </div>
            ))}
            {gems.filter(g => g.snipeWindow?.id === 'prime' || g.snipeWindow?.id === 'early').length === 0 && (
              <div style={{fontSize:12, color:'#6b7280'}}>No prime snipes right now — check back soon</div>
            )}
          </div>
        </div>
      )}

      {tab === 'sniper' && sniperLoading && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14, padding:48, color:'#9ca3af', fontSize:13 }}>
          <div style={{ width:24, height:24, border:'3px solid #2a2a3a', borderTopColor:'#6366f1', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
          Loading fresh launches from DexScreener…
        </div>
      )}

      {tab === 'sniper' && !sniperLoading && <>
      <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', color:'#fcd34d', fontSize:12, marginBottom:12 }}>
         New coins are extremely high risk. Most will go to zero. Only invest what you can afford to lose completely.
      </div>

      {launchedInLastHour > 0 && (
        <div style={{ padding:'8px 14px', borderRadius:10, background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.30)', color:'#fca5a5', fontSize:12, fontWeight:700, marginBottom:12, display:'inline-flex', alignItems:'center', gap:8 }}>
          <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'#ef4444', animation:'pulse 1.5s ease-in-out infinite' }}/>
          LIVE: {launchedInLastHour} {launchedInLastHour === 1 ? 'coin' : 'coins'} launched in last hour
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <div style={{ fontSize:11, color:'#6b7280', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span>
            {gemsLastUpdated
              ? `Last updated: ${secondsAgo < 1 ? 'just now' : secondsAgo + (secondsAgo === 1 ? ' second' : ' seconds') + ' ago'}`
              : 'Loading…'}
          </span>
          <span style={{ color:'#4b5563' }}>· source: dexscreener · auto-refreshes every 60s</span>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {primeCount > 0 && (
            <div style={{
              padding:'6px 12px', borderRadius:8,
              background:'rgba(34,197,94,0.1)',
              border:'1px solid rgba(34,197,94,0.3)',
              fontSize:12, fontWeight:700, color:'#22c55e'
            }}>
               {primeCount} Prime Snipe{primeCount > 1 ? 's' : ''} right now
            </div>
          )}
          <button onClick={alertsEnabled ? () => {
            setAlertsEnabled(false)
            localStorage.setItem('sniper_alerts', 'false')
          } : enableAlerts} style={{
            padding:'7px 14px', borderRadius:8,
            border:`1px solid ${alertsEnabled ? 'rgba(34,197,94,0.4)' : '#2a2a3a'}`,
            background: alertsEnabled ? 'rgba(34,197,94,0.1)' : 'transparent',
            color: alertsEnabled ? '#22c55e' : '#6b7280',
            fontSize:12, fontWeight:700, cursor:'pointer',
            display:'flex', alignItems:'center', gap:6
          }}>
            {alertsEnabled ? 'Alerts ON' : 'Enable Alerts'}
          </button>
          <button onClick={async () => {
            const primes = gems.filter(g => g.snipeWindow?.id === 'prime').slice(0,3);
            for (const coin of primes) {
              await analyzeSnipe(coin);
              await new Promise(r => setTimeout(r, 500));
            }
          }} style={{
            padding:'8px 16px', borderRadius:8, border:'1px solid rgba(99,102,241,0.4)',
            background:'rgba(99,102,241,0.08)', color:'#a5b4fc',
            fontSize:12, fontWeight:700, cursor:'pointer'
          }}>
             Analyze All Prime Snipes
          </button>
          <button
            onClick={() => fetchGems()}
            disabled={gemsLoading}
            style={{
              padding:'6px 14px', borderRadius:8, border:'1px solid #2a2a3a',
              background:'#1a1a24',
              color: gemsLoading ? '#6b7280' : '#fff',
              fontSize:12, fontWeight:700, cursor: gemsLoading ? 'not-allowed' : 'pointer',
              display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
            }}
          >
            {gemsLoading ? (
              <>
                <div style={{ width:12, height:12, border:'2px solid #2a2a3a', borderTopColor:'#a5b4fc', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
                Refreshing…
              </>
            ) : (
              <> Refresh</>
            )}
          </button>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase', fontWeight:700, minWidth:60 }}>Window</span>
          {[
            ['prime',   'Prime Snipes', '#22c55e'],
            ['early',   'Early',         '#86efac'],
            ['watch',   'Watch',         '#fbbf24'],
            ['toolate', 'Too Late',      '#ef4444'],
            ['dip',     '🔄 Dip Bounces', '#a5b4fc'],
            ['all',     'All',              '#6366f1'],
          ].map(([id, label, accent]) => (
            <button key={id} onClick={() => setSnipeFilter(id)} style={pillStyle(snipeFilter === id, accent)}>{label}</button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase', fontWeight:700, minWidth:60 }}>Age</span>
          {[['all','All'],['1','<1h'],['6','<6h'],['24','<24h'],['48','<48h']].map(([id, label]) => (
            <button key={id} onClick={() => setAgeFilter(id)} style={pillStyle(ageFilter === id)}>{label}</button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase', fontWeight:700, minWidth:60 }}>Score</span>
          {[['all','All'],['hot','Hot+ (50+)'],['gems','Gems only (70+)']].map(([id, label]) => (
            <button key={id} onClick={() => setScoreFilter(id)} style={pillStyle(scoreFilter === id, id === 'gems' ? '#6366f1' : '#22c55e')}>{label}</button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase', fontWeight:700, minWidth:60 }}>Sort</span>
          {[['score','Score'],['age','Newest'],['mcap','Market cap'],['change','24h change'],['volume','Volume']].map(([id, label]) => (
            <button key={id} onClick={() => setSortBy(id)} style={pillStyle(sortBy === id)}>{label}</button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase', fontWeight:700, minWidth:60 }}>Risk</span>
          {[['all','All','#6366f1'],['low','Low Risk','#22c55e'],['caution','Caution','#f59e0b'],['high','High Risk','#ef4444']].map(([id, label, accent]) => (
            <button key={id} onClick={() => setRiskFilter(id)} style={pillStyle(riskFilter === id, accent)}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ fontSize:12, color:'#9ca3af', marginBottom:12 }}>
        {visible.length} {visible.length === 1 ? 'gem' : 'gems'} found · updated {secondsAgo < 1 ? 'just now' : secondsAgo + 's ago'}
      </div>

      {visible.length === 0 ? (
        <div style={{ textAlign:'center', padding:48, color:'#6b7280', fontSize:13, background:'#0d0d12', border:'1px dashed #16161f', borderRadius:12 }}>
          No coins matching your filters right now. Try widening the age or score filter.
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap:12 }}>
          {visible.map((coin, idx) => {
            const id = coin.coinId || coin.pairAddress
            const verdict = autoVerdicts[id] || getAutoVerdict(coin)
            const liq = parseFloat(coin.liquidity?.usd || 0)
            const hasTwitter = coin.info?.socials?.some((s:any) => s.type === 'twitter')
            const hasTelegram = coin.info?.socials?.some((s:any) => s.type === 'telegram')
            const twitterUrl = coin.info?.socials?.find((s:any) => s.type === 'twitter')?.url
            const telegramUrl = coin.info?.socials?.find((s:any) => s.type === 'telegram')?.url
            const ageDisplay = coin.ageHours < 1
              ? Math.round(coin.ageHours * 60) + 'm old'
              : coin.ageHours.toFixed(1) + 'h old'

            return (
              <div key={id || idx} style={{
                background: '#0f0f15',
                border: `2px solid ${verdict.verdict === 'SAFE TO TRY' ? 'rgba(34,197,94,0.3)' : verdict.verdict === 'AVOID' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.2)'}`,
                borderRadius: 14,
                padding: 16,
                marginBottom: 12,
              }}>

                {/* TOP: Verdict badge - biggest element */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 10,
                  background: verdict.bg, marginBottom: 12,
                }}>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <span style={{fontSize:22}}>{verdict.emoji}</span>
                    <div>
                      <div style={{fontSize:16, fontWeight:900, color:verdict.color, letterSpacing:'-0.02em'}}>
                        {verdict.verdict}
                      </div>
                      <div style={{fontSize:11, color:verdict.color, opacity:0.8}}>
                        {verdict.greenFlags.slice(0,2).join(' · ')}
                      </div>
                    </div>
                  </div>
                  {verdict.redFlags.length > 0 && (
                    <div style={{fontSize:11, color:'#f59e0b', textAlign:'right', maxWidth:120}}>
                      ⚠ {verdict.redFlags[0]}
                    </div>
                  )}
                </div>

                {coin.isDip && (
                  <div style={{
                    display:'flex', alignItems:'center', gap:6,
                    padding:'6px 12px', borderRadius:8, marginBottom:8,
                    background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.3)'
                  }}>
                    <span style={{fontSize:14}}>🔄</span>
                    <div>
                      <span style={{fontSize:12, fontWeight:800, color:'#a5b4fc'}}>DIP BOUNCE</span>
                      <span style={{fontSize:11, color:'#6b7280', marginLeft:6}}>
                        Down {Math.abs(parseFloat(coin.priceChange?.h6||0)).toFixed(0)}% in 6h but recovering now
                      </span>
                    </div>
                  </div>
                )}

                {/* COIN HEADER */}
                <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12}}>
                  {coin.image && (
                    <img src={coin.image} style={{width:40, height:40, borderRadius:'50%', flexShrink:0}}
                      onError={e => (e.currentTarget.style.display='none')} alt=""/>
                  )}
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:16, fontWeight:800, color:'#fff'}}>{coin.name}</div>
                    <div style={{fontSize:12, color:'#6b7280'}}>{coin.symbol} · {ageDisplay}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:13, fontWeight:700, color:'#fff'}}>${parseFloat(coin.priceUsd||'0').toExponential(2)}</div>
                    <div style={{fontSize:12, fontWeight:700, color: parseFloat(coin.priceChange?.h1||0) >= 0 ? '#22c55e' : '#ef4444'}}>
                      {parseFloat(coin.priceChange?.h1||0) >= 0 ? '+' : ''}{parseFloat(coin.priceChange?.h1||0).toFixed(1)}% 1h
                    </div>
                  </div>
                </div>

                {/* 4 KEY STATS */}
                <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:12}}>
                  {[
                    {
                      label:'LIQUIDITY',
                      value: liq >= 1000 ? '$'+(liq/1000).toFixed(0)+'k' : '$'+liq.toFixed(0),
                      color: liq > 20000 ? '#22c55e' : liq > 5000 ? '#f59e0b' : '#ef4444',
                      icon: liq > 5000 ? '✓' : '✗'
                    },
                    {
                      label:'BUYS/SELLS',
                      value: (coin.buys||0) + '/' + (coin.sells||0),
                      color: (coin.buyRatio||0.5) > 0.55 ? '#22c55e' : '#f59e0b',
                      icon: (coin.buyRatio||0.5) > 0.55 ? '✓' : '~'
                    },
                    {
                      label:'24H CHANGE',
                      value: (parseFloat(coin.priceChange?.h24||0) >= 0 ? '+' : '') + parseFloat(coin.priceChange?.h24||0).toFixed(0) + '%',
                      color: parseFloat(coin.priceChange?.h24||0) > 500 ? '#ef4444' : parseFloat(coin.priceChange?.h24||0) > 0 ? '#22c55e' : '#6b7280',
                      icon: parseFloat(coin.priceChange?.h24||0) > 500 ? '!' : '~'
                    },
                    {
                      label:'VOLUME',
                      value: parseFloat(coin.volume?.h24||0) >= 1000 ? '$'+(parseFloat(coin.volume?.h24||0)/1000).toFixed(0)+'k' : '$'+parseFloat(coin.volume?.h24||0).toFixed(0),
                      color: parseFloat(coin.volume?.h24||0) > 10000 ? '#22c55e' : '#6b7280',
                      icon: parseFloat(coin.volume?.h24||0) > 10000 ? '✓' : '~'
                    },
                  ].map(s => (
                    <div key={s.label} style={{background:'#1a1a24', borderRadius:8, padding:'8px 6px', textAlign:'center'}}>
                      <div style={{fontSize:9, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600, marginBottom:3}}>{s.label}</div>
                      <div style={{fontSize:13, fontWeight:800, color:s.color}}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* STOP LOSS + TAKE PROFIT */}
                <div style={{background:'#1a1a24', borderRadius:8, padding:'10px 12px', marginBottom:12}}>
                  <div style={{fontSize:10, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, marginBottom:8}}>
                    If you invest $100:
                  </div>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:10, color:'#ef4444', fontWeight:600, marginBottom:2}}>Stop Loss</div>
                      <div style={{fontSize:12, fontWeight:800, color:'#ef4444'}}>-$50</div>
                      <div style={{fontSize:9, color:'#6b7280'}}>Sell if down 50%</div>
                    </div>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:10, color:'#f59e0b', fontWeight:600, marginBottom:2}}>Target 1</div>
                      <div style={{fontSize:12, fontWeight:800, color:'#f59e0b'}}>+$100</div>
                      <div style={{fontSize:9, color:'#6b7280'}}>Sell half at 2x</div>
                    </div>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:10, color:'#22c55e', fontWeight:600, marginBottom:2}}>Target 2</div>
                      <div style={{fontSize:12, fontWeight:800, color:'#22c55e'}}>+$400</div>
                      <div style={{fontSize:9, color:'#6b7280'}}>Let rest ride to 5x</div>
                    </div>
                  </div>
                </div>

                {/* SOCIALS */}
                <div style={{display:'flex', gap:6, marginBottom:12, alignItems:'center'}}>
                  {hasTwitter && (
                    <a href={twitterUrl} target="_blank" rel="noreferrer" style={{
                      display:'flex', alignItems:'center', gap:4,
                      padding:'5px 10px', borderRadius:6,
                      background:'rgba(29,161,242,0.12)', border:'1px solid rgba(29,161,242,0.25)',
                      color:'#1da1f2', fontSize:12, fontWeight:600, textDecoration:'none'
                    }}>Twitter</a>
                  )}
                  {hasTelegram && (
                    <a href={telegramUrl} target="_blank" rel="noreferrer" style={{
                      display:'flex', alignItems:'center', gap:4,
                      padding:'5px 10px', borderRadius:6,
                      background:'rgba(33,150,243,0.12)', border:'1px solid rgba(33,150,243,0.25)',
                      color:'#2196f3', fontSize:12, fontWeight:600, textDecoration:'none'
                    }}>Telegram</a>
                  )}
                  <div style={{marginLeft:'auto', fontSize:11, color:'#4b5563'}}>
                    {coin.chainId?.toUpperCase() || 'SOL'}
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
                  <button onClick={() => {
                    onBuy?.({
                      ...coin, id: coin.coinId, coinId: coin.coinId,
                      price: parseFloat(coin.priceUsd||'0'),
                      priceUsd: coin.priceUsd, source: 'dexscreener',
                    })
                  }} style={{
                    padding:'10px', borderRadius:8, border:'none',
                    background:'rgba(99,102,241,0.2)', color:'#a5b4fc',
                    fontSize:12, fontWeight:700, cursor:'pointer'
                  }}>
                    📝 Paper
                  </button>
                  <button onClick={() => {
                    const addr = coin.baseToken?.address || coin.coinId
                    if (addr) { navigator.clipboard.writeText(addr); window.open('https://fomo.family/r/al1valol','_blank') }
                    const t = document.createElement('div')
                    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1a1a2e;border:1px solid #6366f1;color:#fff;padding:10px 16px;border-radius:8px;font-size:12px;z-index:9999'
                    t.textContent = '📋 CA copied! Paste in FOMO'
                    document.body.appendChild(t)
                    setTimeout(() => t.remove(), 3000)
                  }} style={{
                    padding:'10px', borderRadius:8, border:'none',
                    background: verdict.verdict === 'SAFE TO TRY' ? '#22c55e' : verdict.verdict === 'AVOID' ? '#374151' : '#6366f1',
                    color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer'
                  }}>
                    🎯 Buy on FOMO
                  </button>
                  <button onClick={() => {
                    const addr = coin.baseToken?.address || coin.coinId
                    if (addr) navigator.clipboard.writeText(addr)
                  }} style={{
                    padding:'10px', borderRadius:8,
                    border:'1px solid #1e1e2a', background:'transparent',
                    color:'#6b7280', fontSize:12, cursor:'pointer'
                  }}>
                    📋 Copy CA
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{marginTop:20, background:'#0d0d12', border:'1px solid #16161f', borderRadius:12, padding:16}}>
        <div style={{fontSize:13, fontWeight:700, color:'#fff', marginBottom:8}}> Whale Wallet Tracker</div>
        <div style={{fontSize:12, color:'#6b7280', marginBottom:10}}>
          Paste a known whale wallet address to see what they're buying on DexScreener
        </div>
        <div style={{display:'flex', gap:8, marginBottom:10}}>
          <input
            value={whaleWallet} onChange={e=>setWhaleWallet(e.target.value)}
            placeholder="Paste wallet address (0x... or Solana address)"
            style={{flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid #16161f', background:'#1a1a24', color:'#fff', fontSize:12, outline:'none'}}
          />
          <button onClick={() => {
            if (whaleWallet) {
              window.open(`https://dexscreener.com/solana?q=${whaleWallet}`, '_blank');
            }
          }} style={{padding:'8px 14px', borderRadius:8, border:'none', background:'#6366f1', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer'}}>
            Track →
          </button>
        </div>
        <div style={{fontSize:10, color:'#4b5563'}}>
          Opens DexScreener wallet view — see recent buys and positions
        </div>

        <div style={{marginTop:8}}>
          {savedWhales.map(w => (
            <div key={w.address} style={{display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #16161f', fontSize:11}}>
              <span style={{color:'#9ca3af'}}>{w.label || w.address.substring(0,8)+'...'}</span>
              <a href={`https://dexscreener.com/solana?q=${w.address}`} target="_blank" rel="noreferrer" style={{color:'#6366f1', textDecoration:'none'}}>View →</a>
            </div>
          ))}
          {whaleWallet && (
            <button onClick={() => {
              const label = prompt('Label for this wallet (e.g. "Top Solana Whale")');
              const updated = [...savedWhales, {address: whaleWallet, label: label || whaleWallet.substring(0,8)}];
              setSavedWhales(updated);
              localStorage.setItem('sniper_whales', JSON.stringify(updated));
              setWhaleWallet('');
            }} style={{marginTop:6, padding:'5px 10px', borderRadius:6, border:'1px solid #2a2a3a', background:'transparent', color:'#6b7280', fontSize:11, cursor:'pointer'}}>
              + Save This Wallet
            </button>
          )}
        </div>
      </div>
      </>}
    </div>
  );
}

function CryptoGainers({ refreshKey, onUpdated }) {
  const [coins, setCoins] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [timeframe, setTimeframe] = React.useState('24h');

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=percent_change_24h&per_page=100&sparkline=false&price_change_percentage=1h,24h,7d')
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        setCoins(Array.isArray(d) ? d : []);
        setLoading(false);
        onUpdated?.(Date.now());
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey, onUpdated]);

  const sortKey = timeframe === '1h' ? 'price_change_percentage_1h_in_currency'
                : timeframe === '7d' ? 'price_change_percentage_7d_in_currency'
                : 'price_change_percentage_24h';

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? coins.filter(c =>
      c.name?.toLowerCase().includes(q) || c.symbol?.toLowerCase().includes(q)
    ) : coins;
    return [...list]
      .sort((a, b) => parseFloat(b[sortKey] || 0) - parseFloat(a[sortKey] || 0))
      .slice(0, 20);
  }, [coins, search, sortKey]);

  const formatMcap = (mcap) => {
    if (!mcap) return '—';
    if (mcap >= 1e9) return '$' + (mcap/1e9).toFixed(2) + 'B';
    if (mcap >= 1e6) return '$' + (mcap/1e6).toFixed(1) + 'M';
    return '$' + mcap.toLocaleString();
  };

  if (loading && coins.length === 0) return <div style={{color:"#6b7280",padding:32}}>Loading top gainers...</div>;
  return (
    <div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16}}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or symbol..."
          style={{flex:1, padding:"8px 12px", borderRadius:8, border:"1px solid #16161f", background:"#1a1a24", color:"#fff", fontSize:13, outline:"none"}}
        />
        <div style={{display:"flex",gap:4,background:"#1a1a24",borderRadius:8,padding:4,border:"1px solid #16161f"}}>
          {['1h','24h','7d'].map(t => (
            <button key={t} onClick={() => setTimeframe(t)} style={{
              padding:"5px 12px", border:"none", borderRadius:6,
              background: timeframe===t ? "#6366f1" : "transparent",
              color: timeframe===t ? "#fff" : "#9ca3af",
              fontSize:11, fontWeight:700, cursor:"pointer"
            }}>{t}</button>
          ))}
        </div>
      </div>
      <div style={{background:"#0d0d12",border:"1px solid #16161f",borderRadius:12,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"40px 2fr 1fr 1fr 1fr 1fr",padding:"10px 16px",borderBottom:"1px solid #16161f"}}>
          {["#","Coin","Price","1h%","24h%","Mkt Cap"].map(h => (
            <div key={h} style={{fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase"}}>{h}</div>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div style={{padding:24,color:"#6b7280",fontSize:13}}>No coins match your search.</div>
        ) : filtered.map((c,i) => {
          const ch1 = parseFloat(c.price_change_percentage_1h_in_currency || 0);
          const ch24 = parseFloat(c.price_change_percentage_24h || 0);
          return (
            <div key={c.id} style={{display:"grid",gridTemplateColumns:"40px 2fr 1fr 1fr 1fr 1fr",padding:"10px 16px",borderBottom:"1px solid #16161f",alignItems:"center"}}>
              <div style={{color:"#6b7280",fontSize:12}}>{i+1}</div>
              <div style={{fontWeight:600,color:"#fff",fontSize:13}}>{c.name} <span style={{color:"#6b7280",fontSize:11}}>{c.symbol?.toUpperCase()}</span></div>
              <div style={{color:"#fff",fontSize:12}}>${c.current_price?.toLocaleString()}</div>
              <div style={{color: ch1>=0 ? "#22c55e" : "#ef4444",fontSize:12}}>{ch1>=0?"+":""}{ch1.toFixed(2)}%</div>
              <div style={{color: ch24>=0 ? "#22c55e" : "#ef4444",fontSize:12}}>{ch24>=0?"+":""}{ch24.toFixed(2)}%</div>
              <div style={{color:"#fff",fontSize:12}}>{formatMcap(c.market_cap)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CryptoWatchlist({ refreshKey, onUpdated }) {
  const [list, setList] = React.useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('nexyru_watchlist') || '[]');
      // Migrate legacy shape ({id: timestamp, symbol: string}) to {id, symbol, name}
      return stored
        .map(c => {
          if (!c) return null;
          if (typeof c === 'string') return { id: c.toLowerCase(), symbol: c.toUpperCase(), name: c };
          if (typeof c.id === 'string') return { id: c.id, symbol: c.symbol || c.id.toUpperCase(), name: c.name || c.id };
          return null;
        })
        .filter(Boolean);
    } catch { return []; }
  });
  const [input, setInput] = React.useState('');
  const [addError, setAddError] = React.useState(null);
  const [adding, setAdding] = React.useState(false);
  const [prices, setPrices] = React.useState({});

  const persist = (next) => {
    setList(next);
    try { localStorage.setItem('nexyru_watchlist', JSON.stringify(next)); } catch {}
  };

  const remove = (id) => persist(list.filter(c => c.id !== id));

  const addCoin = async () => {
    const id = input.trim().toLowerCase();
    if (!id) return;
    if (list.find(c => c.id === id)) {
      setAddError('Already in watchlist');
      return;
    }
    setAddError(null);
    setAdding(true);
    try {
      const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(id)}`);
      const d = await r.json();
      if (!Array.isArray(d) || d.length === 0) {
        setAddError(`"${id}" not found. Use the CoinGecko id (e.g. bitcoin, ethereum, solana).`);
        return;
      }
      const coin = d[0];
      persist([...list, { id: coin.id, symbol: (coin.symbol || '').toUpperCase(), name: coin.name }]);
      setInput('');
    } catch {
      setAddError('Failed to add — check your connection.');
    } finally {
      setAdding(false);
    }
  };

  const loadPrices = React.useCallback(() => {
    if (list.length === 0) {
      setPrices({});
      onUpdated?.(Date.now());
      return;
    }
    const ids = list.map(c => c.id).join(',');
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`)
      .then(r => r.json())
      .then(d => {
        setPrices(d || {});
        onUpdated?.(Date.now());
      })
      .catch(() => {});
  }, [list, onUpdated]);

  React.useEffect(() => {
    loadPrices();
    const id = setInterval(loadPrices, 60_000);
    return () => clearInterval(id);
  }, [loadPrices, refreshKey]);

  return (
    <div>
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",gap:8}}>
          <input
            value={input}
            onChange={e => { setInput(e.target.value); setAddError(null); }}
            onKeyDown={e => { if (e.key === 'Enter') addCoin(); }}
            placeholder="Add coin (e.g. bitcoin, ethereum, solana)"
            style={{flex:1, padding:"8px 12px", borderRadius:8, border:"1px solid #16161f", background:"#1a1a24", color:"#fff", fontSize:13, outline:"none"}}
          />
          <button
            onClick={addCoin}
            disabled={adding || !input.trim()}
            style={{padding:"8px 16px", borderRadius:8, border:"none", background: adding || !input.trim() ? "#2a2a3a" : "#6366f1", color:"#fff", fontSize:13, fontWeight:600, cursor: adding || !input.trim() ? "not-allowed" : "pointer"}}
          >
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
        {addError && <div style={{color:"#ef4444",fontSize:12,marginTop:8}}>{addError}</div>}
      </div>
      {list.length === 0 ? (
        <div style={{textAlign:"center", padding:48, color:"#6b7280", fontSize:13, background:"#0d0d12", border:"1px dashed #16161f", borderRadius:12}}>
          Add coins to track them here
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))",gap:12}}>
          {list.map(c => {
            const p = prices[c.id];
            const price = p?.usd;
            const change = p?.usd_24h_change ?? 0;
            const pos = change >= 0;
            const priceStr = price === undefined ? '—'
              : '$' + price.toLocaleString(undefined, { maximumFractionDigits: price >= 1 ? 2 : 6 });
            return (
              <div key={c.id} style={{background:"#0d0d12",border:"1px solid #16161f",borderRadius:12,padding:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>{c.name}</div>
                    <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{c.symbol}</div>
                  </div>
                  <button onClick={() => remove(c.id)} title="Remove" style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:20,lineHeight:1,padding:0}}>×</button>
                </div>
                <div style={{fontSize:22,fontWeight:800,color:"#fff",marginBottom:4}}>{priceStr}</div>
                <div style={{fontSize:13,fontWeight:700,color: pos ? "#22c55e" : "#ef4444"}}>
                  {pos ? '+' : ''}{change.toFixed(2)}% <span style={{color:"#6b7280",fontWeight:500,fontSize:11}}>24h</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Sparkline({ points, width = 80, height = 24, color }) {
  if (!points || points.length < 2) return null;
  const ys = points.map(p => typeof p === 'number' ? p : p.v);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const range = max - min || 1;
  const stepX = width / (ys.length - 1);
  const path = ys.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i * stepX).toFixed(1)} ${(height - ((v - min) / range) * height).toFixed(1)}`).join(' ');
  const stroke = color || (ys[ys.length - 1] >= ys[0] ? '#22c55e' : '#ef4444');
  return (
    <svg width={width} height={height} style={{display:'block'}}>
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}

function SignalCard({ signal, livePrice, livePriceChange24h, history, onUpdate, onRemove }) {
  const [notesDraft, setNotesDraft] = React.useState(signal.notes || '');
  const [exitDraft, setExitDraft] = React.useState(signal.exitPrice ?? '');
  const [targetDraft, setTargetDraft] = React.useState(signal.targetGain ?? '');
  const [stopDraft, setStopDraft] = React.useState(signal.stopLoss ?? '');

  React.useEffect(() => { setNotesDraft(signal.notes || ''); }, [signal.id, signal.notes]);

  const entry = Number(signal.priceAtSignal) || 0;
  const cur = typeof livePrice === 'number' ? livePrice : null;
  const changeSinceLog = (cur && entry > 0) ? ((cur / entry) - 1) * 100 : null;

  const badge = scoreBadge(signal.score || 0);

  // Hindsight: filter history points after loggedAt, find max
  const hindsight = React.useMemo(() => {
    if (!history || history.length === 0 || entry <= 0) return null;
    const loggedTs = new Date(signal.loggedAt).getTime();
    const tsHistory = history[0] && typeof history[0] === 'object' ? history : history.map(v => ({ t: 0, v }));
    const afterLog = tsHistory.filter(p => p.t >= loggedTs);
    const series = afterLog.length > 1 ? afterLog : tsHistory;
    if (series.length === 0) return null;
    let bestPt = series[0];
    for (const p of series) if (p.v > bestPt.v) bestPt = p;
    const bestPct = ((bestPt.v / entry) - 1) * 100;
    return { bestPct, bestTs: bestPt.t, series };
  }, [history, signal.loggedAt, entry]);

  const requestNotifyPerm = () => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      try { Notification.requestPermission().catch(() => {}); } catch {}
    }
  };

  const saveTarget = () => {
    const v = targetDraft === '' ? null : Math.max(0, parseFloat(targetDraft) || 0);
    onUpdate({ targetGain: v, targetHitNotified: false });
    if (v != null && v > 0) requestNotifyPerm();
  };
  const saveStop = () => {
    const v = stopDraft === '' ? null : Math.max(0, parseFloat(stopDraft) || 0);
    onUpdate({ stopLoss: v, stopHitNotified: false });
    if (v != null && v > 0) requestNotifyPerm();
  };
  const saveNotes = () => {
    if (notesDraft !== signal.notes) onUpdate({ notes: notesDraft });
  };
  const toggleTaken = () => {
    if (signal.didTake) {
      onUpdate({ didTake: false, exitPrice: null, exitedAt: null });
      setExitDraft('');
    } else {
      onUpdate({ didTake: true, exitedAt: new Date().toISOString() });
    }
  };
  const saveExit = () => {
    const v = exitDraft === '' ? null : (parseFloat(exitDraft) || null);
    onUpdate({ exitPrice: v });
  };

  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleDateString(undefined, { month:'short', day:'numeric' }); }
    catch { return '—'; }
  };
  const fmtPrice = (n) => {
    if (n == null || !isFinite(n)) return '—';
    return '$' + n.toLocaleString(undefined, { maximumFractionDigits: n >= 1 ? 4 : 8 });
  };

  return (
    <div style={{background:"#0d0d12",border:"1px solid #16161f",borderRadius:12,padding:16,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>{signal.name}</div>
            <div style={{fontSize:11,color:"#6b7280"}}>{signal.symbol} · logged {fmtDate(signal.loggedAt)}</div>
          </div>
          <span style={{fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:6, background:badge.bg, color:badge.color}}>{badge.label}</span>
        </div>
        <button onClick={onRemove} title="Remove" style={{background:"none",border:"none",color:"#6b7280",cursor:"pointer",fontSize:18,lineHeight:1,padding:0}}>×</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(110px, 1fr))",gap:10}}>
        <div>
          <div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",marginBottom:2}}>Entry</div>
          <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{fmtPrice(entry)}</div>
        </div>
        <div>
          <div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",marginBottom:2}}>Current</div>
          <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{fmtPrice(cur)}</div>
        </div>
        <div>
          <div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",marginBottom:2}}>Since logged</div>
          <div style={{fontSize:13,fontWeight:700,color: changeSinceLog == null ? "#6b7280" : changeSinceLog >= 0 ? "#22c55e" : "#ef4444"}}>
            {changeSinceLog == null ? '—' : (changeSinceLog >= 0 ? '+' : '') + changeSinceLog.toFixed(2) + '%'}
          </div>
        </div>
        <div>
          <div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",marginBottom:2}}>If held</div>
          <div style={{fontSize:13,fontWeight:700,color: hindsight && hindsight.bestPct >= 0 ? "#22c55e" : "#ef4444"}}>
            {hindsight ? (hindsight.bestPct >= 0 ? '+' : '') + hindsight.bestPct.toFixed(1) + '%' : '—'}
          </div>
        </div>
        <div style={{minWidth:80}}>
          <div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase",marginBottom:2}}>7d trend</div>
          {history && history.length > 1 ? <Sparkline points={history} width={100} height={26}/> : <div style={{fontSize:11,color:"#6b7280"}}>loading…</div>}
        </div>
      </div>

      {hindsight && (
        <div style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.18)",borderRadius:8,padding:"8px 12px",fontSize:11,color:"#a5b4fc"}}>
          <strong style={{color:"#fff"}}>What if?</strong>{' '}
          If you held until today you would have {changeSinceLog == null ? 'unknown' : (changeSinceLog >= 0 ? 'made' : 'lost')}{' '}
          <span style={{color: changeSinceLog == null ? '#a5b4fc' : changeSinceLog >= 0 ? '#22c55e' : '#ef4444', fontWeight:700}}>
            {changeSinceLog == null ? '—' : Math.abs(changeSinceLog).toFixed(2) + '%'}
          </span>.{' '}
          Best exit would have been{' '}
          <span style={{color: hindsight.bestPct >= 0 ? '#22c55e' : '#ef4444', fontWeight:700}}>
            {(hindsight.bestPct >= 0 ? '+' : '') + hindsight.bestPct.toFixed(1) + '%'}
          </span>
          {hindsight.bestTs ? ' on ' + new Date(hindsight.bestTs).toLocaleDateString(undefined, { month:'short', day:'numeric' }) : ''}.
        </div>
      )}

      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:11,color:"#9ca3af"}}>Target +</span>
          <input
            type="number" value={targetDraft}
            onChange={e => setTargetDraft(e.target.value)}
            onBlur={saveTarget}
            placeholder="20"
            style={{width:60, padding:"5px 8px", borderRadius:6, border:"1px solid #2a2a3a", background:"#1a1a24", color:"#fff", fontSize:12, outline:"none"}}
          />
          <span style={{fontSize:11,color:"#9ca3af"}}>%</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:11,color:"#9ca3af"}}>Stop −</span>
          <input
            type="number" value={stopDraft}
            onChange={e => setStopDraft(e.target.value)}
            onBlur={saveStop}
            placeholder="10"
            style={{width:60, padding:"5px 8px", borderRadius:6, border:"1px solid #2a2a3a", background:"#1a1a24", color:"#fff", fontSize:12, outline:"none"}}
          />
          <span style={{fontSize:11,color:"#9ca3af"}}>%</span>
        </div>
        <div style={{flex:1}}/>
        <button
          onClick={toggleTaken}
          style={{
            padding:"6px 14px", borderRadius:8, border:"none",
            background: signal.didTake ? "#22c55e" : "#6366f1", color:"#fff",
            fontSize:12, fontWeight:700, cursor:"pointer"
          }}
        >{signal.didTake ? "Taken " : "Mark as Taken"}</button>
      </div>

      {signal.didTake && (
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:11,color:"#9ca3af"}}>Exit price $</span>
          <input
            type="number" value={exitDraft}
            onChange={e => setExitDraft(e.target.value)}
            onBlur={saveExit}
            placeholder={String(cur ?? '0.00')}
            style={{width:120, padding:"5px 8px", borderRadius:6, border:"1px solid #2a2a3a", background:"#1a1a24", color:"#fff", fontSize:12, outline:"none"}}
          />
          {signal.exitPrice != null && entry > 0 && (() => {
            const pnl = ((signal.exitPrice / entry) - 1) * 100;
            return (
              <span style={{fontSize:12, fontWeight:700, color: pnl >= 0 ? "#22c55e" : "#ef4444"}}>
                P&L {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
              </span>
            );
          })()}
        </div>
      )}

      <textarea
        value={notesDraft}
        onChange={e => setNotesDraft(e.target.value)}
        onBlur={saveNotes}
        placeholder="Notes (thesis, catalysts, exit plan…)"
        rows={2}
        style={{width:"100%", padding:"8px 10px", borderRadius:8, border:"1px solid #16161f", background:"#1a1a24", color:"#fff", fontSize:12, outline:"none", resize:"vertical", fontFamily:"inherit"}}
      />
    </div>
  );
}

function CryptoJournal({ refreshKey, onUpdated, signals, onUpdateSignals }) {
  const [tab, setTab] = React.useState('all');
  const [prices, setPrices] = React.useState({});
  const [history, setHistory] = React.useState({});

  const loadPrices = React.useCallback(() => {
    if (!signals || signals.length === 0) {
      setPrices({});
      onUpdated?.(Date.now());
      return;
    }
    const ids = [...new Set(signals.map(s => s.coinId))].join(',');
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`)
      .then(r => r.json())
      .then(d => { setPrices(d || {}); onUpdated?.(Date.now()); })
      .catch(() => {});
  }, [signals, onUpdated]);

  React.useEffect(() => {
    loadPrices();
    const id = setInterval(loadPrices, 60_000);
    return () => clearInterval(id);
  }, [loadPrices, refreshKey]);

  // Lazy historical chart fetching (staggered)
  React.useEffect(() => {
    const need = (signals || []).filter(s => !history[s.coinId]);
    if (need.length === 0) return;
    let cancelled = false;
    const timers = [];
    need.forEach((s, i) => {
      timers.push(setTimeout(() => {
        if (cancelled) return;
        fetch(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(s.coinId)}/market_chart?vs_currency=usd&days=7`)
          .then(r => r.json())
          .then(d => {
            if (cancelled) return;
            const pts = (d.prices || []).map(p => ({ t: p[0], v: p[1] }));
            setHistory(prev => ({ ...prev, [s.coinId]: pts }));
          })
          .catch(() => {});
      }, i * 1200));
    });
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [signals, history]);

  const updateSignal = (id, patch) => {
    onUpdateSignals(signals.map(s => s.id === id ? { ...s, ...patch } : s));
  };
  const removeSignal = (id) => {
    if (typeof window !== 'undefined' && !window.confirm('Remove this signal from your journal?')) return;
    onUpdateSignals(signals.filter(s => s.id !== id));
  };

  const taken = (signals || []).filter(s => s.didTake);
  const closed = taken.filter(s => s.exitPrice != null && s.priceAtSignal > 0);
  const wins = closed.filter(s => s.exitPrice > s.priceAtSignal).length;
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : null;
  const totalPnl = closed.reduce((sum, s) => sum + (((s.exitPrice / s.priceAtSignal) - 1) * 100), 0);

  const tabs = [
    { id: 'all', label: `All Signals (${signals?.length || 0})` },
    { id: 'taken', label: `My Trades (${taken.length})` },
  ];

  return (
    <div>
      <div style={{display:"flex",gap:4,marginBottom:16,background:"#1a1a24",borderRadius:10,padding:4,border:"1px solid #16161f",width:"fit-content"}}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:"7px 16px", border:"none", borderRadius:7,
            background: tab===t.id ? "#6366f1" : "transparent",
            color: tab===t.id ? "#fff" : "#9ca3af",
            fontSize:12, fontWeight:700, cursor:"pointer"
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'taken' && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))",gap:10,marginBottom:16}}>
          <div style={{background:"#0d0d12",border:"1px solid #16161f",borderRadius:10,padding:12}}>
            <div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase"}}>Logged</div>
            <div style={{fontSize:18,fontWeight:800,color:"#fff",marginTop:4}}>{signals?.length || 0}</div>
          </div>
          <div style={{background:"#0d0d12",border:"1px solid #16161f",borderRadius:10,padding:12}}>
            <div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase"}}>Taken</div>
            <div style={{fontSize:18,fontWeight:800,color:"#fff",marginTop:4}}>{taken.length}</div>
          </div>
          <div style={{background:"#0d0d12",border:"1px solid #16161f",borderRadius:10,padding:12}}>
            <div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase"}}>Win rate</div>
            <div style={{fontSize:18,fontWeight:800,color:"#fff",marginTop:4}}>{winRate == null ? '—' : winRate.toFixed(0) + '%'}</div>
          </div>
          <div style={{background:"#0d0d12",border:"1px solid #16161f",borderRadius:10,padding:12}}>
            <div style={{fontSize:10,color:"#6b7280",textTransform:"uppercase"}}>Total P&amp;L</div>
            <div style={{fontSize:18,fontWeight:800,color: totalPnl >= 0 ? "#22c55e" : "#ef4444",marginTop:4}}>
              {closed.length === 0 ? '—' : (totalPnl >= 0 ? '+' : '') + totalPnl.toFixed(1) + '%'}
            </div>
          </div>
        </div>
      )}

      {(!signals || signals.length === 0) ? (
        <div style={{textAlign:"center", padding:48, color:"#6b7280", fontSize:13, background:"#0d0d12", border:"1px dashed #16161f", borderRadius:12}}>
          {tab === 'taken' ? 'No taken trades yet. Mark logged signals as taken to track them here.' : 'No logged signals yet. Click "Log Signal" on a trending coin to start.'}
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {(tab === 'taken' ? taken : signals).length === 0 ? (
            <div style={{textAlign:"center", padding:32, color:"#6b7280", fontSize:13}}>
              No taken trades yet.
            </div>
          ) : (tab === 'taken' ? taken : signals).map(sig => (
            <SignalCard
              key={sig.id}
              signal={sig}
              livePrice={prices[sig.coinId]?.usd}
              livePriceChange24h={prices[sig.coinId]?.usd_24h_change}
              history={history[sig.coinId]}
              onUpdate={(patch) => updateSignal(sig.id, patch)}
              onRemove={() => removeSignal(sig.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const CRYPTO_ACCOUNTS_KEY = 'nexyru_crypto_accounts';

function loadCryptoAccountStore() {
  try {
    const raw = localStorage.getItem(CRYPTO_ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.accounts)) return parsed;
    }
  } catch {}
  return { accounts: [], activeAccountId: null };
}

function persistCryptoAccountStore(store) {
  try { localStorage.setItem(CRYPTO_ACCOUNTS_KEY, JSON.stringify(store)); } catch {}
}

function makeShortId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function updateAccountInStore(store, accountId, transform) {
  return {
    ...store,
    accounts: (store.accounts || []).map(a => a.id === accountId ? transform(a) : a),
  };
}

function depositToAccount(store, accountId, amount, note) {
  if (!(amount > 0)) return store;
  return updateAccountInStore(store, accountId, acc => ({
    ...acc,
    balance: (acc.balance || 0) + amount,
    history: [
      { id: makeShortId('h'), type: 'deposit', amount, note: note || '', date: new Date().toISOString() },
      ...(acc.history || []),
    ],
  }));
}

function withdrawFromAccount(store, accountId, amount, note) {
  if (!(amount > 0)) return store;
  return updateAccountInStore(store, accountId, acc => ({
    ...acc,
    balance: (acc.balance || 0) - amount,
    history: [
      { id: makeShortId('h'), type: 'withdraw', amount, note: note || '', date: new Date().toISOString() },
      ...(acc.history || []),
    ],
  }));
}

function buyPositionInAccount(store, accountId, coin, usdAmount, atPrice, extra = {}) {
  if (!(atPrice > 0) || !(usdAmount > 0)) return store;
  return updateAccountInStore(store, accountId, acc => {
    if ((acc.balance || 0) < usdAmount) return acc;
    const amount = usdAmount / atPrice;
    const positionId = makeShortId('pos');
    const nowIso = new Date().toISOString();
    const position = {
      id: positionId,
      coinId: coin.coinId,
      symbol: coin.symbol,
      name: coin.name,
      chain: coin.chain || null,
      pairAddress: coin.pairAddress || null,
      dexUrl: coin.dexUrl || null,
      amount,
      amountUSD: usdAmount,
      entryPrice: atPrice,
      entryDate: nowIso,
      currentPrice: atPrice,
      status: 'open',
      notes: extra.notes || '',
      exitPrice: null,
      exitDate: null,
      exitNotes: '',
      alertTarget: extra.targetPct ?? null,
      alertStop: extra.stopLossPct ?? null,
      targetHitNotified: false,
      stopHitNotified: false,
      realizedPnl: null,
    };
    return {
      ...acc,
      balance: acc.balance - usdAmount,
      positions: [position, ...(acc.positions || [])],
      history: [
        { id: makeShortId('h'), type: 'buy', positionId, coinId: coin.coinId, symbol: coin.symbol, name: coin.name, amount, price: atPrice, usd: usdAmount, date: nowIso },
        ...(acc.history || []),
      ],
    };
  });
}

function closePositionInAccount(store, accountId, positionId, exitPrice, exitNotes = '') {
  if (!(exitPrice > 0)) return store;
  return updateAccountInStore(store, accountId, acc => {
    const pos = (acc.positions || []).find(p => p.id === positionId);
    if (!pos || pos.status !== 'open') return acc;
    const proceeds = pos.amount * exitPrice;
    const pnl = (exitPrice - pos.entryPrice) * pos.amount;
    const totalRealized = (pos.realizedPnl || 0) + pnl;
    const nowIso = new Date().toISOString();
    return {
      ...acc,
      balance: (acc.balance || 0) + proceeds,
      positions: acc.positions.map(p => p.id === positionId
        ? { ...p, status: 'closed', exitPrice, exitDate: nowIso, exitNotes: exitNotes || '', realizedPnl: totalRealized, currentPrice: exitPrice }
        : p),
      history: [
        { id: makeShortId('h'), type: 'sell', positionId, coinId: pos.coinId, symbol: pos.symbol, name: pos.name, amount: pos.amount, price: exitPrice, usd: proceeds, pnl, date: nowIso, exitNotes: exitNotes || '' },
        ...(acc.history || []),
      ],
    };
  });
}

// Close a fraction of an open position. Cost basis (entryPrice per coin) stays
// the same for the remaining coins; amountUSD is scaled down proportionally so
// stored cost-basis stays correct, and proceeds go back to the account balance.
function partialClosePositionInAccount(store, accountId, positionId, exitPrice, percent, exitNotes = '') {
  if (!(exitPrice > 0) || !(percent > 0) || !(percent < 100)) return store;
  return updateAccountInStore(store, accountId, acc => {
    const pos = (acc.positions || []).find(p => p.id === positionId);
    if (!pos || pos.status !== 'open') return acc;
    const totalCoins = pos.amount;
    const closeCoins = totalCoins * (percent / 100);
    const keepCoins = totalCoins - closeCoins;
    const proceeds = closeCoins * exitPrice;
    // P&L on the closed slice only.
    const pnl = (exitPrice - pos.entryPrice) * closeCoins;
    // Scale stored cost basis proportionally to coins remaining. Fall back to
    // entryPrice * totalCoins if amountUSD isn't on the position (older buys).
    const originalAmountUSD = pos.amountUSD != null ? pos.amountUSD : pos.entryPrice * totalCoins;
    const originalCostPerCoin = totalCoins > 0 ? originalAmountUSD / totalCoins : 0;
    const remainingCostBasis = originalCostPerCoin * keepCoins;
    const nowIso = new Date().toISOString();
    const noteAddition = `Partial close ${percent}% at $${exitPrice} (P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)})${exitNotes ? ' — ' + exitNotes : ''}`;
    return {
      ...acc,
      balance: (acc.balance || 0) + proceeds,
      positions: acc.positions.map(p => p.id === positionId
        ? {
            ...p,
            amount: keepCoins,
            amountUSD: remainingCostBasis,
            partialCloseCount: (p.partialCloseCount || 0) + 1,
            realizedPnl: (p.realizedPnl || 0) + pnl,
            exitNotes: (p.exitNotes ? p.exitNotes + ' | ' : '') + noteAddition,
          }
        : p),
      history: [
        { id: makeShortId('h'), type: 'partial_sell', positionId, coinId: pos.coinId, symbol: pos.symbol, name: pos.name, amount: closeCoins, price: exitPrice, usd: proceeds, pnl, date: nowIso, exitNotes: exitNotes || '', partialPercent: percent },
        ...(acc.history || []),
      ],
    };
  });
}

function setPositionAlerts(store, accountId, positionId, target, stop) {
  return updateAccountInStore(store, accountId, acc => ({
    ...acc,
    positions: (acc.positions || []).map(p => p.id === positionId
      ? { ...p, alertTarget: target, alertStop: stop, targetHitNotified: false, stopHitNotified: false }
      : p),
  }));
}

function fmtUsd(n, opts = {}) {
  if (n == null || !isFinite(n)) return '—';
  const max = opts.maxFractionDigits ?? (Math.abs(n) >= 1 ? 2 : 6);
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: max });
}

function fmtDateShort(iso) {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return '—'; }
}

function fmtHoldDuration(fromIso, toIso) {
  try {
    const ms = new Date(toIso || Date.now()).getTime() - new Date(fromIso).getTime();
    if (ms < 0) return '—';
    const days = Math.floor(ms / 86400000);
    if (days >= 1) return days + (days === 1 ? ' day' : ' days');
    const hours = Math.floor(ms / 3600000);
    if (hours >= 1) return hours + (hours === 1 ? ' hour' : ' hours');
    const minutes = Math.max(1, Math.floor(ms / 60000));
    return minutes + (minutes === 1 ? ' min' : ' mins');
  } catch { return '—'; }
}

function momentumBadge(change24h) {
  if (change24h >= 20) return { label: 'Surging', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' };
  if (change24h >= 3)  return { label: 'Rising',  color: '#22c55e', bg: 'rgba(34,197,94,0.15)' };
  if (change24h > -3)  return { label: 'Flat',    color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' };
  return                       { label: 'Falling', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
}

function CryptoHotNow({ refreshKey, onUpdated, signals = [], onLogSignal, onBuy }) {
  const [coins, setCoins] = React.useState([]);     // trending wrapper objects
  const [prices, setPrices] = React.useState({});   // { coinId: { usd, usd_24h_change } }
  const [loading, setLoading] = React.useState(true);
  const [loadedAt, setLoadedAt] = React.useState(null);
  const [, setTick] = React.useState(0);
  const [riskFilter, setRiskFilter] = React.useState('all'); // 'all' | 'low' | 'caution' | 'high'

  // Re-render every 30s so "updated X mins ago" stays fresh
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('https://api.coingecko.com/api/v3/search/trending');
      const d = await r.json();
      const top = (d?.coins || []).slice(0, 10);
      setCoins(top);
      // Batch-fetch live prices + 24h change
      const ids = top.map(({ item }) => item?.id).filter(Boolean).join(',');
      if (ids) {
        try {
          const pr = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`);
          const pd = await pr.json();
          setPrices(pd || {});
        } catch {}
      }
      const now = Date.now();
      setLoadedAt(now);
      onUpdated?.(now);
    } catch {} finally {
      setLoading(false);
    }
  }, [onUpdated]);

  React.useEffect(() => {
    load();
    const id = setInterval(load, 3 * 60 * 1000);
    return () => clearInterval(id);
  }, [load, refreshKey]);

  const loggedCoinIds = React.useMemo(() => new Set(signals.map(s => s.coinId)), [signals]);

  // Compute a max volume across the visible set to scale the volume bars
  const maxVol = React.useMemo(() => {
    let m = 0;
    for (const { item } of coins) {
      const v = prices[item?.id]?.usd_24h_vol || 0;
      if (v > m) m = v;
    }
    return m;
  }, [coins, prices]);

  const updatedAgo = (() => {
    if (!loadedAt) return '—';
    const m = Math.floor((Date.now() - loadedAt) / 60000);
    if (m < 1) return 'just now';
    if (m === 1) return '1 min ago';
    return m + ' mins ago';
  })();

  const visible = React.useMemo(() => {
    if (riskFilter === 'all') return coins;
    return coins.filter(({ item: c }) => verificationBucket(getVerificationStatus({ ...c, source: 'coingecko' }).status) === riskFilter);
  }, [coins, riskFilter]);

  if (loading && coins.length === 0) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14, padding:48, color:'#9ca3af', fontSize:13 }}>
        <div style={{ width:24, height:24, border:'3px solid #2a2a3a', borderTopColor:'#6366f1', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
        Loading what's trending right now…
      </div>
    );
  }

  const pillStyle = (active, accent) => ({
    padding: '5px 12px', borderRadius: 999, border: `1px solid ${active ? (accent || '#6366f1') : '#16161f'}`,
    background: active ? (accent || '#6366f1') : '#1a1a24',
    color: active ? '#fff' : '#9ca3af',
    fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  });

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        <span style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase', fontWeight:700, minWidth:60 }}>Risk</span>
        {[['all','All','#6366f1'],['low','Low Risk','#22c55e'],['caution','Caution','#f59e0b'],['high','High Risk','#ef4444']].map(([id, label, accent]) => (
          <button key={id} onClick={() => setRiskFilter(id)} style={pillStyle(riskFilter === id, accent)}>{label}</button>
        ))}
      </div>
      <div style={{ fontSize:12, color:'#9ca3af', marginBottom:12 }}>
        {visible.length} {visible.length === 1 ? 'coin' : 'coins'} trending · updated {updatedAgo}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(min(100%, 380px), 1fr))', gap:12 }}>
        {visible.map(({ item: c }) => {
          const live = prices[c.id] || {};
          const change = (live.usd_24h_change ?? c.data?.price_change_percentage_24h?.usd) || 0;
          const pos = change >= 0;
          const price = live.usd ?? parseCoinPrice(c.data?.price);
          const vol = live.usd_24h_vol || 0;
          const volPct = maxVol > 0 ? Math.max(2, (vol / maxVol) * 100) : 0;
          const mom = momentumBadge(change);
          const logged = loggedCoinIds.has(c.id);
          const verification = getVerificationStatus({ ...c, source: 'coingecko' });
          const onLog = () => {
            if (logged || !onLogSignal) return;
            onLogSignal({
              id: Date.now(),
              coinId: c.id,
              name: c.name,
              symbol: c.symbol,
              score: 50,
              priceAtSignal: price || 0,
              change24h: change,
              loggedAt: new Date().toISOString(),
              didTake: false, exitPrice: null, exitedAt: null,
              notes: '', targetGain: null, stopLoss: null,
              targetHitNotified: false, stopHitNotified: false,
            });
          };
          return (
            <div key={c.id} style={{ background: pos?"rgba(34,197,94,0.05)":"rgba(239,68,68,0.05)", border:`1px solid ${pos?"rgba(34,197,94,0.18)":"rgba(239,68,68,0.18)"}`, borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    <span style={{ fontSize:15, fontWeight:800, color:'#fff' }}>{c.name}</span>
                    <VerificationBadge v={verification}/>
                  </div>
                  <div style={{ fontSize:11, color:'#6b7280' }}>{c.symbol}</div>
                </div>
                <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background:'rgba(99,102,241,0.15)', color:'#a5b4fc' }}>#{c.market_cap_rank || '?'}</span>
              </div>

              <VerificationBanner v={verification}/>

              <div style={{ display:'flex', alignItems:'baseline', gap:10, flexWrap:'wrap' }}>
                <div style={{ fontSize:26, fontWeight:900, color: pos ? '#22c55e' : '#ef4444' }}>{pos?'+':''}{change.toFixed(2)}%</div>
                <div style={{ fontSize:13, color:'#fff', fontWeight:600 }}>{price ? fmtUsd(price, { maxFractionDigits: price >= 1 ? 4 : 8 }) : '—'}</div>
              </div>

              <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:6, background:mom.bg, color:mom.color, alignSelf:'flex-start' }}>{mom.label}</span>

              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:10, color:'#6b7280', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.04em', fontWeight:700 }}>
                  <span>Volume 24h</span>
                  <span style={{ color:'#9ca3af' }}>{vol > 0 ? formatBigUsd(vol) : '—'}</span>
                </div>
                <div style={{ height:6, background:'#1a1a24', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width: volPct + '%', background:'linear-gradient(90deg, #6366f1, #a5b4fc)', borderRadius:3, transition:'width 0.3s ease' }}/>
                </div>
              </div>

              <div style={{ display:'flex', gap:8, marginTop:2, flexWrap:'wrap' }}>
                <button
                  onClick={onLog}
                  disabled={logged}
                  style={{
                    flex:1, padding:'7px 10px', borderRadius:8, border:'none',
                    background: logged ? '#2a2a3a' : '#1a1a24',
                    color: logged ? '#6b7280' : '#a5b4fc',
                    fontSize:12, fontWeight:700, cursor: logged ? 'default' : 'pointer', minWidth:80,
                    border: logged ? 'none' : '1px solid #2a2a3a',
                  }}
                >{logged ? 'Logged ' : 'Log Signal'}</button>
                <button
                  onClick={() => onBuy?.({ coinId: c.id, name: c.name, symbol: c.symbol, price: price || 0 })}
                  style={{
                    flex:1, padding:'7px 10px', borderRadius:8, border:'none',
                    background:'#22c55e', color:'#fff',
                    fontSize:12, fontWeight:700, cursor:'pointer', minWidth:70,
                  }}
                >Buy →</button>
                {(() => {
                  const buyInfo = getBuyUrl(c);
                  return (
                    <a href={buyInfo.url} target="_blank" rel="noreferrer" style={{
                      display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                      padding:'7px 12px', borderRadius:8,
                      background: buyInfo.color, color:'#fff',
                      fontSize:12, fontWeight:700, textDecoration:'none',
                      whiteSpace:'nowrap',
                    }}>
                      {buyInfo.icon} {buyInfo.label}
                    </a>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function capTier(mcap) {
  if (!mcap) return { id: 'unknown', label: '—', color: '#6b7280' };
  if (mcap >= 10e9) return { id: 'large', label: 'LARGE', color: '#22c55e' };
  if (mcap >= 1e9)  return { id: 'mid',   label: 'MID',   color: '#6366f1' };
  return                     { id: 'small', label: 'SMALL', color: '#f59e0b' };
}

function CryptoUptrends({ refreshKey, onUpdated, onBuy }) {
  const [coins, setCoins] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [timeframe, setTimeframe] = React.useState('all'); // 'all' | '24-7' | '7'
  const [capFilter, setCapFilter] = React.useState('all'); // 'all' | 'large' | 'mid' | 'small'

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&sparkline=true&price_change_percentage=1h,24h,7d')
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        setCoins(Array.isArray(d) ? d : []);
        setLoading(false);
        onUpdated?.(Date.now());
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey, onUpdated]);

  const filtered = React.useMemo(() => {
    const passesTimeframe = (c) => {
      const h1  = c.price_change_percentage_1h_in_currency  || 0;
      const h24 = c.price_change_percentage_24h             || 0;
      const d7  = c.price_change_percentage_7d_in_currency  || 0;
      if (timeframe === '7')    return d7 > 0;
      if (timeframe === '24-7') return h24 > 0 && d7 > 0;
      return h1 > 0 && h24 > 0 && d7 > 0;
    };
    let arr = coins.filter(passesTimeframe);
    if (capFilter !== 'all') arr = arr.filter(c => capTier(c.market_cap).id === capFilter);
    arr = arr.map(c => {
      const h1  = c.price_change_percentage_1h_in_currency  || 0;
      const h24 = c.price_change_percentage_24h             || 0;
      const d7  = c.price_change_percentage_7d_in_currency  || 0;
      const score = (h1 * 0.5) + (h24 * 0.3) + (d7 * 0.2);
      return { ...c, _score: score };
    });
    arr.sort((a, b) => b._score - a._score);
    return arr;
  }, [coins, timeframe, capFilter]);

  const pillStyle = (active, accent) => ({
    padding: '5px 12px', borderRadius: 999, border: `1px solid ${active ? (accent || '#6366f1') : '#16161f'}`,
    background: active ? (accent || '#6366f1') : '#1a1a24',
    color: active ? '#fff' : '#9ca3af',
    fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  });

  if (loading && coins.length === 0) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14, padding:48, color:'#9ca3af', fontSize:13 }}>
        <div style={{ width:24, height:24, border:'3px solid #2a2a3a', borderTopColor:'#6366f1', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
        Scanning top 100 by market cap for clean uptrends…
      </div>
    );
  }

  return (
    <div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase', fontWeight:700, minWidth:80 }}>Up across</span>
          {[['all','1h + 24h + 7d'],['24-7','24h + 7d'],['7','7d only']].map(([id, label]) => (
            <button key={id} onClick={() => setTimeframe(id)} style={pillStyle(timeframe === id, '#22c55e')}>{label}</button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase', fontWeight:700, minWidth:80 }}>Market cap</span>
          {[['all','All'],['large','Large >$10B'],['mid','Mid $1B–$10B'],['small','Small <$1B']].map(([id, label]) => (
            <button key={id} onClick={() => setCapFilter(id)} style={pillStyle(capFilter === id)}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ fontSize:12, color:'#9ca3af', marginBottom:12 }}>
        {filtered.length} {filtered.length === 1 ? 'coin' : 'coins'} on a confirmed uptrend
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:48, color:'#6b7280', fontSize:13, background:'#0d0d12', border:'1px dashed #16161f', borderRadius:12 }}>
          Market may be down — no coins showing uptrend across all timeframes. Try a shorter filter.
        </div>
      ) : (
        <div style={{ background:'#0d0d12', border:'1px solid #16161f', borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'40px 2fr 1fr 60px 60px 60px 70px 80px 90px', gap:10, padding:'10px 14px', borderBottom:'1px solid #16161f' }}>
            {['#','Coin','Mkt Cap','1h','24h','7d','Score','7d Trend','Buy'].map(h => (
              <div key={h} style={{ fontSize:10, fontWeight:700, color:'#6b7280', textTransform:'uppercase' }}>{h}</div>
            ))}
          </div>
          {filtered.map((c, i) => {
            const h1  = c.price_change_percentage_1h_in_currency  || 0;
            const h24 = c.price_change_percentage_24h             || 0;
            const d7  = c.price_change_percentage_7d_in_currency  || 0;
            const tier = capTier(c.market_cap);
            const sparkPoints = c.sparkline_in_7d?.price || [];
            return (
              <div key={c.id} style={{ display:'grid', gridTemplateColumns:'40px 2fr 1fr 60px 60px 60px 70px 80px 90px', gap:10, padding:'10px 14px', borderBottom:'1px solid #16161f', alignItems:'center' }}>
                <div style={{ fontSize:12, color:'#6b7280' }}>{i + 1}</div>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', minWidth:0 }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{c.name}</div>
                    <div style={{ fontSize:11, color:'#6b7280' }}>{(c.symbol || '').toUpperCase()}</div>
                  </div>
                  <span style={{ fontSize:9, fontWeight:800, padding:'2px 6px', borderRadius:4, background: tier.color + '22', color: tier.color, letterSpacing:'0.04em' }}>{tier.label}</span>
                  <VerificationBadge v={getVerificationStatus({ ...c, source: 'coingecko' })}/>
                </div>
                <div style={{ fontSize:12, color:'#fff' }}>{formatBigUsd(c.market_cap || 0)}</div>
                <div style={{ fontSize:12, fontWeight:700, color:'#22c55e' }}>+{h1.toFixed(2)}%</div>
                <div style={{ fontSize:12, fontWeight:700, color:'#22c55e' }}>+{h24.toFixed(2)}%</div>
                <div style={{ fontSize:12, fontWeight:700, color:'#22c55e' }}>+{d7.toFixed(2)}%</div>
                <div style={{ fontSize:12, fontWeight:800, color:'#a5b4fc' }}>{c._score.toFixed(1)}</div>
                <div>{sparkPoints.length > 1 ? <Sparkline points={sparkPoints} width={70} height={22} color="#22c55e"/> : <span style={{ color:'#6b7280', fontSize:11 }}>—</span>}</div>
                <button
                  onClick={() => onBuy?.({ coinId: c.id, name: c.name, symbol: c.symbol, price: c.current_price })}
                  style={{ padding:'6px 10px', borderRadius:6, border:'none', background:'#22c55e', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}
                >Buy →</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CryptoMyStats({ store, refreshKey, onUpdated }) {
  const accounts = store?.accounts || [];

  // Aggregate all positions across all accounts
  const allPositions = React.useMemo(() => {
    const out = [];
    for (const a of accounts) {
      for (const p of (a.positions || [])) out.push({ ...p, _accountName: a.name, _accountType: a.type });
    }
    return out;
  }, [accounts]);

  const closed = allPositions.filter(p => p.status === 'closed' && p.entryPrice > 0 && p.exitPrice != null);
  const open = allPositions.filter(p => p.status === 'open');

  // Live prices for open positions, keyed by position id.
  // Per-position fetch so we can route DexScreener vs CoinGecko per coin.
  const openKey = React.useMemo(() => open.map(p => `${p.id}:${p.coinId}`).join(','), [open]);
  const [livePrices, setLivePrices] = React.useState({});
  React.useEffect(() => {
    if (open.length === 0) { setLivePrices({}); onUpdated?.(Date.now()); return; }
    let cancelled = false;
    const load = async () => {
      const next = {};
      await Promise.all(open.map(async p => { next[p.id] = await fetchCurrentPrice(p.coinId); }));
      if (!cancelled) { setLivePrices(next); onUpdated?.(Date.now()); }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey, refreshKey, onUpdated]);

  // Money totals
  const totalDeposits = accounts.reduce((s, a) => s + (a.history || []).filter(h => h.type === 'deposit').reduce((x, h) => x + h.amount, 0), 0);
  const totalWithdraws = accounts.reduce((s, a) => s + (a.history || []).filter(h => h.type === 'withdraw').reduce((x, h) => x + h.amount, 0), 0);
  const totalCash = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const openValue = open.reduce((s, p) => {
    const cur = livePrices[p.id] || p.currentPrice || p.entryPrice;
    return s + cur * p.amount;
  }, 0);
  const currentValue = totalCash + openValue;
  const netInvested = totalDeposits - totalWithdraws;
  const totalPnl = currentValue - netInvested;
  const totalReturnPct = netInvested > 0 ? (totalPnl / netInvested) * 100 : 0;

  // Realized / unrealized
  const realizedPnl = closed.reduce((s, p) => s + ((p.exitPrice - p.entryPrice) * p.amount), 0);
  const unrealizedPnl = open.reduce((s, p) => {
    const cur = livePrices[p.id] || p.currentPrice || p.entryPrice;
    return s + ((cur - p.entryPrice) * p.amount);
  }, 0);

  // Trade stats
  const closedWithPnl = closed.map(p => ({
    ...p,
    _pnl: (p.exitPrice - p.entryPrice) * p.amount,
    _pnlPct: ((p.exitPrice / p.entryPrice) - 1) * 100,
  }));
  const wins = closedWithPnl.filter(p => p._pnl > 0).length;
  const winRate = closedWithPnl.length > 0 ? (wins / closedWithPnl.length) * 100 : null;
  const bestTrades = [...closedWithPnl].sort((a, b) => b._pnlPct - a._pnlPct).slice(0, 5);
  const worstTrades = [...closedWithPnl].sort((a, b) => a._pnlPct - b._pnlPct).slice(0, 5);

  // Chain breakdown (closed + open)
  const chainTotals = new Map();
  for (const p of allPositions) {
    const key = p.chain || 'other';
    chainTotals.set(key, (chainTotals.get(key) || 0) + 1);
  }
  const totalForChains = [...chainTotals.values()].reduce((s, v) => s + v, 0);
  const chainBreakdown = [...chainTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([chain, count]) => ({ chain, count, pct: totalForChains > 0 ? (count / totalForChains) * 100 : 0 }));
  const chainColors = { solana:'#9945ff', ethereum:'#627eea', base:'#0052ff', bsc:'#f0b90b' };

  // Timing analysis
  const dayBuckets = [[], [], [], [], [], [], []]; // Sun..Sat
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  for (const p of closedWithPnl) {
    try {
      const d = new Date(p.entryDate).getDay();
      dayBuckets[d].push(p._pnlPct);
    } catch {}
  }
  const dayAverages = dayBuckets.map((arr, i) => ({
    day: dayNames[i],
    avg: arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null,
    n: arr.length,
  }));
  const bestDay = dayAverages.filter(d => d.avg != null).sort((a, b) => b.avg - a.avg)[0];
  const winningHolds = closedWithPnl.filter(p => p._pnl > 0).map(p => new Date(p.exitDate).getTime() - new Date(p.entryDate).getTime());
  const losingHolds  = closedWithPnl.filter(p => p._pnl <= 0).map(p => new Date(p.exitDate).getTime() - new Date(p.entryDate).getTime());
  const avgWinHold  = winningHolds.length > 0 ? winningHolds.reduce((s, v) => s + v, 0) / winningHolds.length : null;
  const avgLossHold = losingHolds.length > 0 ? losingHolds.reduce((s, v) => s + v, 0) / losingHolds.length : null;
  const fmtMs = (ms) => {
    if (ms == null) return '—';
    const hrs = ms / 3600000;
    if (hrs >= 24) return (hrs / 24).toFixed(1) + 'd';
    if (hrs >= 1) return hrs.toFixed(1) + 'h';
    return Math.max(1, Math.round(hrs * 60)) + 'm';
  };

  // Monthly P&L
  const monthBuckets = new Map();
  for (const p of closedWithPnl) {
    try {
      const d = new Date(p.exitDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthBuckets.set(key, (monthBuckets.get(key) || 0) + p._pnl);
    } catch {}
  }
  const monthlyPnl = [...monthBuckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const maxAbsMonth = Math.max(0, ...monthlyPnl.map(([, v]) => Math.abs(v)));

  if (accounts.length === 0) {
    return (
      <div style={{ textAlign:'center', padding:48, color:'#6b7280', fontSize:13, background:'#0d0d12', border:'1px dashed #16161f', borderRadius:12 }}>
        Create a crypto account to start tracking stats.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:10, marginBottom:16 }}>
        <Stat label="Total invested" value={fmtUsd(netInvested)} color="#fff"/>
        <Stat label="Current value" value={fmtUsd(currentValue)} color="#fff"/>
        <Stat label="Total P&L" value={(totalPnl >= 0 ? '+' : '−') + fmtUsd(Math.abs(totalPnl))} color={totalPnl >= 0 ? '#22c55e' : '#ef4444'}/>
        <Stat label="Return %" value={netInvested > 0 ? (totalReturnPct >= 0 ? '+' : '') + totalReturnPct.toFixed(2) + '%' : '—'} color={totalReturnPct >= 0 ? '#22c55e' : '#ef4444'}/>
        <Stat label="Realized P&L" value={(realizedPnl >= 0 ? '+' : '−') + fmtUsd(Math.abs(realizedPnl))} color={realizedPnl >= 0 ? '#22c55e' : '#ef4444'}/>
        <Stat label="Unrealized P&L" value={(unrealizedPnl >= 0 ? '+' : '−') + fmtUsd(Math.abs(unrealizedPnl))} color={unrealizedPnl >= 0 ? '#22c55e' : '#ef4444'}/>
        <Stat label="Win rate" value={winRate == null ? '—' : winRate.toFixed(0) + '%'} color="#fff"/>
        <Stat label="Trades closed" value={String(closedWithPnl.length)} color="#fff"/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap:14, marginBottom:14 }}>
        <div style={{ background:'#0d0d12', border:'1px solid #16161f', borderRadius:12, padding:14 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:10 }}>Best performing trades</div>
          {bestTrades.length === 0 ? (
            <div style={{ fontSize:12, color:'#6b7280' }}>No closed trades yet.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column' }}>
              {bestTrades.map(p => (
                <TradeRow key={p.id} p={p}/>
              ))}
            </div>
          )}
        </div>
        <div style={{ background:'#0d0d12', border:'1px solid #16161f', borderRadius:12, padding:14 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:10 }}>Worst performing trades</div>
          {worstTrades.length === 0 ? (
            <div style={{ fontSize:12, color:'#6b7280' }}>No closed trades yet.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column' }}>
              {worstTrades.map(p => (
                <TradeRow key={p.id} p={p}/>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap:14, marginBottom:14 }}>
        <div style={{ background:'#0d0d12', border:'1px solid #16161f', borderRadius:12, padding:14 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:10 }}>Chain breakdown</div>
          {chainBreakdown.length === 0 ? (
            <div style={{ fontSize:12, color:'#6b7280' }}>No positions yet.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {chainBreakdown.map(({ chain, count, pct }) => {
                const color = chainColors[chain.toLowerCase()] || '#9ca3af';
                return (
                  <div key={chain}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
                      <span style={{ color:'#fff', fontWeight:700, textTransform:'uppercase' }}>{chain}</span>
                      <span style={{ color:'#9ca3af' }}>{count} {count === 1 ? 'trade' : 'trades'} · {pct.toFixed(0)}%</span>
                    </div>
                    <div style={{ height:6, background:'#1a1a24', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width: pct + '%', background:color, borderRadius:3 }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ background:'#0d0d12', border:'1px solid #16161f', borderRadius:12, padding:14 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:10 }}>Timing analysis</div>
          {closedWithPnl.length === 0 ? (
            <div style={{ fontSize:12, color:'#6b7280' }}>Close some trades to see timing analysis.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ fontSize:12, color:'#9ca3af' }}>
                Best day to enter: <span style={{ color:'#22c55e', fontWeight:700 }}>{bestDay ? `${bestDay.day} (avg ${bestDay.avg >= 0 ? '+' : ''}${bestDay.avg.toFixed(1)}% · ${bestDay.n} trades)` : '—'}</span>
              </div>
              <div style={{ fontSize:12, color:'#9ca3af' }}>
                Avg hold (wins): <span style={{ color:'#22c55e', fontWeight:700 }}>{fmtMs(avgWinHold)}</span>
              </div>
              <div style={{ fontSize:12, color:'#9ca3af' }}>
                Avg hold (losses): <span style={{ color:'#ef4444', fontWeight:700 }}>{fmtMs(avgLossHold)}</span>
              </div>
              <div style={{ paddingTop:6, borderTop:'1px solid #16161f', marginTop:4 }}>
                <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', fontWeight:700, marginBottom:6 }}>By day of week (avg P&L %)</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4 }}>
                  {dayAverages.map(d => (
                    <div key={d.day} style={{ background:'#1a1a24', borderRadius:6, padding:'6px 4px', textAlign:'center' }}>
                      <div style={{ fontSize:10, color:'#6b7280', fontWeight:700 }}>{d.day}</div>
                      <div style={{ fontSize:11, fontWeight:700, color: d.avg == null ? '#6b7280' : d.avg >= 0 ? '#22c55e' : '#ef4444', marginTop:2 }}>
                        {d.avg == null ? '—' : (d.avg >= 0 ? '+' : '') + d.avg.toFixed(0) + '%'}
                      </div>
                      <div style={{ fontSize:9, color:'#6b7280' }}>{d.n}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ background:'#0d0d12', border:'1px solid #16161f', borderRadius:12, padding:14 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:10 }}>Monthly realized P&L</div>
        {monthlyPnl.length === 0 ? (
          <div style={{ fontSize:12, color:'#6b7280' }}>No closed trades yet.</div>
        ) : (
          <div style={{ display:'flex', alignItems:'flex-end', gap:6, minHeight:120 }}>
            {monthlyPnl.map(([month, pnl]) => {
              const heightPct = maxAbsMonth > 0 ? (Math.abs(pnl) / maxAbsMonth) * 100 : 0;
              const isPos = pnl >= 0;
              return (
                <div key={month} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  <div style={{ fontSize:10, fontWeight:700, color: isPos ? '#22c55e' : '#ef4444' }}>{(isPos ? '+' : '−') + fmtUsd(Math.abs(pnl))}</div>
                  <div style={{ width:'100%', maxWidth:60, height:`${Math.max(4, heightPct)}px`, background: isPos ? '#22c55e' : '#ef4444', borderRadius:4, opacity:0.85 }}/>
                  <div style={{ fontSize:10, color:'#6b7280' }}>{month.slice(2)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TradeRow({ p }) {
  const fmtPrice = (n) => fmtUsd(n, { maxFractionDigits: n >= 1 ? 4 : 8 });
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr auto auto', gap:8, padding:'6px 0', borderBottom:'1px solid #16161f', alignItems:'center', fontSize:11 }}>
      <div style={{ color:'#fff', fontWeight:700 }}>{p.name || p.symbol} <span style={{ color:'#6b7280', fontWeight:400 }}>{(p.symbol || '').toUpperCase()}</span></div>
      <div style={{ color:'#9ca3af' }}>{fmtPrice(p.entryPrice)} → {fmtPrice(p.exitPrice)}</div>
      <div style={{ color:'#9ca3af' }}>{fmtHoldDuration(p.entryDate, p.exitDate)}</div>
      <div style={{ color: p._pnlPct >= 0 ? '#22c55e' : '#ef4444', fontWeight:700, whiteSpace:'nowrap' }}>{(p._pnlPct >= 0 ? '+' : '') + p._pnlPct.toFixed(1) + '%'}</div>
      <div style={{ color:'#6b7280' }}>{p._accountName}</div>
    </div>
  );
}

class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Chart error:', error, info?.componentStack);
    }
  }
  componentDidUpdate(prevProps) {
    // Reset the error state if the boundary's children change identity (e.g.
    // a new position is clicked) so the next chart gets a fresh attempt.
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ color: '#6b7280', fontSize: 13, padding: 16, background: '#0d0d12', border: '1px dashed #16161f', borderRadius: 10, textAlign: 'center' }}>
          Chart unavailable
        </div>
      );
    }
    return this.props.children;
  }
}

function isCoinGeckoCoinId(coinId) {
  // CoinGecko ids are short slugs like 'bitcoin', 'pepe', 'wrapped-eth'.
  // DexScreener-sourced ids include a contract ('0x...') or a 'chain:address' prefix.
  return !!coinId && !coinId.includes('0x') && !coinId.includes(':') && coinId.length < 30;
}

function PositionChartModal({ position, onClose }) {
  const [history, setHistory] = React.useState(null);
  const [dexPair, setDexPair] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);

  const isDexCoin = !isCoinGeckoCoinId(position?.coinId);

  const minDays = position?.status === 'open' ? 30 : 90;
  const ageDays = React.useMemo(() => {
    try {
      const entryTs = position?.entryDate ? new Date(position.entryDate).getTime() : NaN;
      if (!isFinite(entryTs)) return 0;
      return Math.ceil((Date.now() - entryTs) / 86400000);
    } catch { return 0; }
  }, [position?.entryDate]);
  const days = Math.min(365, Math.max(minDays, (Number.isFinite(ageDays) ? ageDays : 0) + 7));

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(null); setHistory(null); setDexPair(null);
    if (!position?.coinId) { setErr('No coin id'); setLoading(false); return; }

    // DexScreener path — token address or chain:address. Free API only exposes
    // a current snapshot (no OHLCV), so we fetch the pair and render stats.
    if (isDexCoin) {
      const fetchDex = async () => {
        try {
          // Strip a leading "chain:" prefix if present
          const rawId = position.coinId || '';
          const chain = position.chain || (rawId.includes(':') ? rawId.split(':')[0] : 'ethereum');
          const address = rawId.includes(':') ? rawId.split(':').slice(1).join(':') : rawId;

          // Preferred: direct pair lookup (faster, exact match)
          if (position.pairAddress && chain) {
            try {
              const r = await fetch(`https://api.dexscreener.com/latest/dex/pairs/${chain}/${position.pairAddress}`);
              if (r.ok) {
                const d = await r.json();
                const pair = d?.pair || (Array.isArray(d?.pairs) ? d.pairs[0] : null);
                if (!cancelled && pair) { setDexPair(pair); setLoading(false); return; }
              }
            } catch {}
          }

          // Fallback: look up by token address — DexScreener returns all pairs
          // containing the token; pick the most-liquid one.
          if (address) {
            const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
            if (r.ok) {
              const d = await r.json();
              const arr = Array.isArray(d?.pairs) ? d.pairs : [];
              const best = arr
                .slice()
                .sort((a, b) => parseFloat(b.liquidity?.usd || 0) - parseFloat(a.liquidity?.usd || 0))[0];
              if (!cancelled && best) { setDexPair(best); setLoading(false); return; }
            }
          }

          if (!cancelled) { setErr('Pair not found on DexScreener.'); setLoading(false); }
        } catch (e) {
          if (!cancelled) { setErr(e?.message || 'Failed to load pair data.'); setLoading(false); }
        }
      };
      fetchDex();
      return () => { cancelled = true; };
    }

    // CoinGecko path — proxied to dodge per-client rate limits.
    fetch(`/api/chart?id=${encodeURIComponent(position.coinId)}&days=${days}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load chart')))
      .then(d => {
        if (cancelled) return;
        const raw = Array.isArray(d?.prices) ? d.prices : [];
        const pts = [];
        for (const row of raw) {
          if (!Array.isArray(row) || row.length < 2) continue;
          const t = Number(row[0]);
          const v = Number(row[1]);
          if (Number.isFinite(t) && Number.isFinite(v)) pts.push({ t, v });
        }
        setHistory(pts);
        setLoading(false);
      })
      .catch(e => { if (!cancelled) { setErr(e?.message || 'Failed to load chart'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [position?.coinId, position?.chain, position?.pairAddress, days, isDexCoin]);

  // Layout sizing
  const [size, setSize] = React.useState({ w: 800, h: 360 });
  const wrapRef = React.useRef(null);
  React.useEffect(() => {
    const measure = () => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(320, Math.floor(r.width)), h: Math.max(220, Math.floor(r.height)) });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const entryTsRaw = position?.entryDate ? new Date(position.entryDate).getTime() : NaN;
  const entryTs = Number.isFinite(entryTsRaw) ? entryTsRaw : 0;
  const exitTsRaw = position?.exitDate ? new Date(position.exitDate).getTime() : null;
  const exitTs = (typeof exitTsRaw === 'number' && Number.isFinite(exitTsRaw)) ? exitTsRaw : null;
  const entryPrice = Number(position?.entryPrice) || 0;
  const exitPrice = (position?.exitPrice != null && Number.isFinite(Number(position.exitPrice))) ? Number(position.exitPrice) : null;
  const positionAmount = Number(position?.amount) || 0;
  const dexLivePrice = dexPair ? Number(dexPair.priceUsd) : NaN;
  const currentPrice = (history && history.length > 0 && Number.isFinite(history[history.length - 1]?.v))
    ? history[history.length - 1].v
    : (Number.isFinite(dexLivePrice) && dexLivePrice > 0
        ? dexLivePrice
        : (Number(position?.currentPrice) || entryPrice));

  // Hindsight: best price after entry within the data window
  const hindsight = React.useMemo(() => {
    try {
      if (!Array.isArray(history) || history.length === 0 || !Number.isFinite(entryTs) || entryTs <= 0) return null;
      const afterEntry = history.filter(p => p && Number.isFinite(p.t) && Number.isFinite(p.v) && p.t >= entryTs);
      if (afterEntry.length === 0) return null;
      let best = afterEntry[0];
      for (const p of afterEntry) if (p.v > best.v) best = p;
      return best;
    } catch { return null; }
  }, [history, entryTs]);

  const closedPnl = (exitPrice != null && entryPrice > 0) ? (exitPrice - entryPrice) * positionAmount : null;
  const closedPnlPct = (exitPrice != null && entryPrice > 0) ? ((exitPrice / entryPrice) - 1) * 100 : null;
  const openPnl = exitPrice == null ? (currentPrice - entryPrice) * positionAmount : null;
  const openPnlPct = exitPrice == null && entryPrice > 0 ? ((currentPrice / entryPrice) - 1) * 100 : null;

  // Build SVG
  const pad = { top: 14, right: 18, bottom: 28, left: 56 };
  const innerW = size.w - pad.left - pad.right;
  const innerH = size.h - pad.top - pad.bottom;

  const linePath = React.useMemo(() => {
    try {
      if (!Array.isArray(history) || history.length < 2) return null;
      let minT = history[0].t, maxT = history[0].t, minV = history[0].v, maxV = history[0].v;
      for (const p of history) {
        if (!p || !Number.isFinite(p.t) || !Number.isFinite(p.v)) continue;
        if (p.t < minT) minT = p.t;
        if (p.t > maxT) maxT = p.t;
        if (p.v < minV) minV = p.v;
        if (p.v > maxV) maxV = p.v;
      }
      if (!Number.isFinite(minT) || !Number.isFinite(maxT) || !Number.isFinite(minV) || !Number.isFinite(maxV)) return null;
      const rangeT = (maxT - minT) || 1;
      const rangeV = (maxV - minV) || 1;
      const px = (t) => pad.left + ((t - minT) / rangeT) * innerW;
      const py = (v) => pad.top + innerH - ((v - minV) / rangeV) * innerH;
      const d = history.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.t).toFixed(2)},${py(p.v).toFixed(2)}`).join(' ');
      const areaD = `${d} L${px(maxT).toFixed(2)},${(pad.top + innerH).toFixed(2)} L${px(minT).toFixed(2)},${(pad.top + innerH).toFixed(2)} Z`;
      const yTicks = [];
      for (let i = 0; i <= 4; i++) {
        const v = minV + (rangeV * i) / 4;
        yTicks.push({ y: py(v), v });
      }
      const xTicks = [];
      for (let i = 0; i <= 4; i++) {
        const t = minT + (rangeT * i) / 4;
        xTicks.push({ x: px(t), t });
      }
      return { d, areaD, px, py, minT, maxT, minV, maxV, yTicks, xTicks };
    } catch {
      return null;
    }
  }, [history, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const trendColor = exitPrice != null
    ? (closedPnl >= 0 ? '#22c55e' : '#ef4444')
    : (openPnl >= 0 ? '#22c55e' : '#ef4444');

  const fmtChartDate = (ts) => {
    try { return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
    catch { return ''; }
  };
  const fmtPrice = (v) => fmtUsd(v, { maxFractionDigits: v >= 1 ? 4 : 8 });

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1100, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:"#0a0a0f", border:"1px solid #16161f", borderRadius:14, padding:24, width:"80vw", height:"80vh", maxWidth:1200, color:"#fff", display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ fontSize:22, fontWeight:800 }}>{position.name}</div>
              <span style={{ fontSize:11, fontWeight:800, padding:"3px 8px", borderRadius:5, background: position.status === 'open' ? "rgba(99,102,241,0.18)" : "rgba(107,114,128,0.18)", color: position.status === 'open' ? "#a5b4fc" : "#9ca3af" }}>{position.status.toUpperCase()}</span>
            </div>
            <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>{(position?.symbol || '').toUpperCase()} · {positionAmount.toLocaleString(undefined, { maximumFractionDigits: 8 })} held · entered {fmtDateShort(position?.entryDate)}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background:"none", border:"none", color:"#9ca3af", cursor:"pointer", fontSize:24, lineHeight:1 }}>×</button>
        </div>

        <div ref={wrapRef} style={{ flex:1, minHeight:240, background:"#0f0f14", border:"1px solid #16161f", borderRadius:10, position:"relative", overflow:"hidden" }}>
          {loading && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", gap:12, color:"#9ca3af", fontSize:13 }}>
              <div style={{ width:22, height:22, border:'3px solid #2a2a3a', borderTopColor:'#6366f1', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
              {isDexCoin ? 'Loading pair data from DexScreener…' : `Loading ${days}-day price history…`}
            </div>
          )}
          {err && !loading && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:"#ef4444", fontSize:13, padding:24, textAlign:"center" }}>
              {isDexCoin
                ? `Couldn't load pair data for ${position?.symbol || 'this coin'} from DexScreener.`
                : `Couldn't load chart for this coin. CoinGecko may not have data for it (${position?.coinId}).`}
            </div>
          )}
          {!loading && !err && isDexCoin && dexPair && (() => {
            const cur = Number(dexPair.priceUsd) || 0;
            const ch1 = parseFloat(dexPair.priceChange?.h1 || 0);
            const ch6 = parseFloat(dexPair.priceChange?.h6 || 0);
            const ch24 = parseFloat(dexPair.priceChange?.h24 || 0);
            const vol = parseFloat(dexPair.volume?.h24 || 0);
            const liq = parseFloat(dexPair.liquidity?.usd || 0);
            const livePnl = entryPrice > 0 ? (cur - entryPrice) * positionAmount : 0;
            const livePnlPct = entryPrice > 0 ? ((cur / entryPrice) - 1) * 100 : 0;
            const linkUrl = position.dexUrl || (dexPair.url || (dexPair.chainId && dexPair.pairAddress ? `https://dexscreener.com/${dexPair.chainId}/${dexPair.pairAddress}` : null));
            const pctCard = (label, ch) => (
              <div style={{ background:"#1a1a24", border:"1px solid #16161f", borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", fontWeight:700 }}>{label}</div>
                <div style={{ fontSize:16, fontWeight:800, color: ch >= 0 ? "#22c55e" : "#ef4444", marginTop:4 }}>
                  {ch >= 0 ? '+' : ''}{ch.toFixed(2)}%
                </div>
              </div>
            );
            return (
              <div style={{ position:"absolute", inset:0, padding:18, overflowY:"auto" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:14, gap:12, flexWrap:"wrap" }}>
                  <div>
                    <div style={{ fontSize:11, color:"#6b7280", textTransform:"uppercase", fontWeight:700, letterSpacing:"0.04em" }}>Price snapshot</div>
                    <div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>DexScreener doesn't expose OHLCV via free API — showing live stats instead.</div>
                  </div>
                  {linkUrl && (
                    <a href={linkUrl} target="_blank" rel="noreferrer" style={{ fontSize:12, fontWeight:700, color:"#a5b4fc", textDecoration:"none", whiteSpace:"nowrap" }}>
                      Full chart on DexScreener →
                    </a>
                  )}
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:10, marginBottom:12 }}>
                  <div style={{ background:"#1a1a24", border:"1px solid #16161f", borderRadius:8, padding:"10px 12px" }}>
                    <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", fontWeight:700 }}>Entry</div>
                    <div style={{ fontSize:16, fontWeight:800, color:"#fff", marginTop:4 }}>{fmtPrice(entryPrice)}</div>
                  </div>
                  <div style={{ background:"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.25)", borderRadius:8, padding:"10px 12px" }}>
                    <div style={{ fontSize:10, color:"#a5b4fc", textTransform:"uppercase", fontWeight:700 }}>Current</div>
                    <div style={{ fontSize:18, fontWeight:800, color:"#fff", marginTop:4 }}>{fmtPrice(cur)}</div>
                  </div>
                  <div style={{ background:"#1a1a24", border:`1px solid ${livePnl >= 0 ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`, borderRadius:8, padding:"10px 12px" }}>
                    <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", fontWeight:700 }}>P&L from entry</div>
                    <div style={{ fontSize:16, fontWeight:800, color: livePnl >= 0 ? "#22c55e" : "#ef4444", marginTop:4 }}>
                      {(livePnl >= 0 ? '+' : '−')}{fmtUsd(Math.abs(livePnl))}
                    </div>
                    <div style={{ fontSize:11, fontWeight:700, color: livePnlPct >= 0 ? "#22c55e" : "#ef4444", marginTop:2 }}>
                      {(livePnlPct >= 0 ? '+' : '')}{livePnlPct.toFixed(2)}%
                    </div>
                  </div>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(110px, 1fr))", gap:10, marginBottom:12 }}>
                  {pctCard('1h change', ch1)}
                  {pctCard('6h change', ch6)}
                  {pctCard('24h change', ch24)}
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:10 }}>
                  <div style={{ background:"#1a1a24", border:"1px solid #16161f", borderRadius:8, padding:"10px 12px" }}>
                    <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", fontWeight:700 }}>Volume 24h</div>
                    <div style={{ fontSize:14, fontWeight:700, color:"#fff", marginTop:4 }}>{formatBigUsd(vol)}</div>
                  </div>
                  <div style={{ background:"#1a1a24", border:"1px solid #16161f", borderRadius:8, padding:"10px 12px" }}>
                    <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", fontWeight:700 }}>Liquidity</div>
                    <div style={{ fontSize:14, fontWeight:700, color:"#fff", marginTop:4 }}>{formatBigUsd(liq)}</div>
                  </div>
                  <div style={{ background:"#1a1a24", border:"1px solid #16161f", borderRadius:8, padding:"10px 12px" }}>
                    <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", fontWeight:700 }}>Chain</div>
                    <div style={{ fontSize:14, fontWeight:700, color:"#fff", marginTop:4 }}>{(dexPair.chainId || position.chain || '?').toUpperCase()}</div>
                  </div>
                </div>
              </div>
            );
          })()}
          {!loading && !err && !isDexCoin && linePath && (
            <svg width={size.w} height={size.h} style={{ display:"block" }}>
              <defs>
                <linearGradient id={`pos-area-${position.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={trendColor} stopOpacity="0.22"/>
                  <stop offset="100%" stopColor={trendColor} stopOpacity="0"/>
                </linearGradient>
              </defs>
              {/* gridlines */}
              {linePath.yTicks.map((t, i) => (
                <g key={`y${i}`}>
                  <line x1={pad.left} y1={t.y} x2={size.w - pad.right} y2={t.y} stroke="#16161f" strokeWidth="1"/>
                  <text x={pad.left - 8} y={t.y + 3} fill="#6b7280" fontSize="10" textAnchor="end">{fmtPrice(t.v)}</text>
                </g>
              ))}
              {linePath.xTicks.map((t, i) => (
                <text key={`x${i}`} x={t.x} y={size.h - pad.bottom + 14} fill="#6b7280" fontSize="10" textAnchor="middle">{fmtChartDate(t.t)}</text>
              ))}
              <path d={linePath.areaD} fill={`url(#pos-area-${position.id})`}/>
              <path d={linePath.d} fill="none" stroke={trendColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>

              {/* Entry marker */}
              {entryTs >= linePath.minT && entryTs <= linePath.maxT && (() => {
                const x = linePath.px(entryTs);
                return (
                  <g>
                    <line x1={x} y1={pad.top} x2={x} y2={size.h - pad.bottom} stroke="#22c55e" strokeWidth="1.5" strokeDasharray="4 4"/>
                    <rect x={x + 6} y={pad.top + 6} width={Math.min(140, Math.max(80, 60 + (`${fmtPrice(entryPrice)}`).length * 6))} height="22" rx="4" fill="rgba(34,197,94,0.18)" stroke="rgba(34,197,94,0.5)"/>
                    <text x={x + 12} y={pad.top + 21} fill="#22c55e" fontSize="11" fontWeight="700">BUY {fmtPrice(entryPrice)}</text>
                  </g>
                );
              })()}

              {/* Exit marker */}
              {exitTs && exitTs >= linePath.minT && exitTs <= linePath.maxT && (() => {
                const x = linePath.px(exitTs);
                const labelWidth = Math.min(160, Math.max(120, 80 + (`${fmtPrice(exitPrice)}`).length * 6));
                const labelOffset = x + labelWidth + 10 > size.w - pad.right ? -labelWidth - 12 : 6;
                return (
                  <g>
                    <line x1={x} y1={pad.top} x2={x} y2={size.h - pad.bottom} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 4"/>
                    <rect x={x + labelOffset} y={pad.top + 32} width={labelWidth} height="38" rx="4" fill="rgba(239,68,68,0.16)" stroke="rgba(239,68,68,0.5)"/>
                    <text x={x + labelOffset + 6} y={pad.top + 47} fill="#ef4444" fontSize="11" fontWeight="700">SELL {fmtPrice(exitPrice)}</text>
                    <text x={x + labelOffset + 6} y={pad.top + 62} fill={closedPnl >= 0 ? "#22c55e" : "#ef4444"} fontSize="11" fontWeight="800">
                      {(closedPnl >= 0 ? '+' : '−')}{fmtUsd(Math.abs(closedPnl))} ({(closedPnlPct >= 0 ? '+' : '')}{closedPnlPct.toFixed(2)}%)
                    </text>
                  </g>
                );
              })()}
            </svg>
          )}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:10 }}>
          <Stat label="Entry" value={fmtPrice(entryPrice)} color="#fff"/>
          <Stat label={exitPrice != null ? "Exit" : "Current"} value={fmtPrice(exitPrice ?? currentPrice)} color="#fff"/>
          <Stat
            label="P&L"
            value={exitPrice != null
              ? (closedPnl >= 0 ? '+' : '−') + fmtUsd(Math.abs(closedPnl))
              : (openPnl >= 0 ? '+' : '−') + fmtUsd(Math.abs(openPnl))}
            color={(exitPrice != null ? closedPnl : openPnl) >= 0 ? "#22c55e" : "#ef4444"}
          />
          <Stat
            label="P&L %"
            value={exitPrice != null
              ? (closedPnlPct >= 0 ? '+' : '') + closedPnlPct.toFixed(2) + '%'
              : (openPnlPct >= 0 ? '+' : '') + openPnlPct.toFixed(2) + '%'}
            color={(exitPrice != null ? closedPnlPct : openPnlPct) >= 0 ? "#22c55e" : "#ef4444"}
          />
          <Stat label="Hold time" value={fmtHoldDuration(position.entryDate, position.exitDate)} color="#fff"/>
        </div>

        {(position.notes || position.exitNotes) && (
          <div style={{ background:"#0d0d12", border:"1px solid #16161f", borderRadius:10, padding:12, display:"flex", flexDirection:"column", gap:6 }}>
            {position.notes && <div style={{ fontSize:12, color:"#9ca3af" }}><span style={{ color:"#a5b4fc", fontWeight:700 }}>Entry notes:</span> {position.notes}</div>}
            {position.exitNotes && <div style={{ fontSize:12, color:"#9ca3af" }}><span style={{ color:"#f59e0b", fontWeight:700 }}>Exit notes:</span> {position.exitNotes}</div>}
          </div>
        )}

        {/* Hindsight — CoinGecko coins use the actual post-entry peak */}
        {!isDexCoin && position.status === 'closed' && hindsight && exitPrice != null && (() => {
          const bestPct = ((hindsight.v / entryPrice) - 1) * 100;
          const bestProceeds = hindsight.v * positionAmount;
          const actualProceeds = exitPrice * positionAmount;
          const leftOnTable = bestProceeds - actualProceeds;
          const captureRatio = bestProceeds > 0 ? actualProceeds / bestProceeds : 0;
          const nearPeak = captureRatio >= 0.9;
          return (
            <div style={{ background:"rgba(99,102,241,0.06)", border:"1px solid rgba(99,102,241,0.18)", borderRadius:10, padding:14 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#a5b4fc", marginBottom:6 }}>What if you held longer?</div>
              <div style={{ fontSize:12, color:"#9ca3af", marginBottom:4 }}>
                Best possible exit: <span style={{ color:"#22c55e", fontWeight:700 }}>{fmtPrice(hindsight.v)}</span>
                {' '}({(bestPct >= 0 ? '+' : '')}{bestPct.toFixed(2)}%)
                {' on '}{fmtDateShort(hindsight.t)}
              </div>
              {nearPeak ? (
                <div style={{ fontSize:13, color:"#22c55e", fontWeight:700 }}>You sold at near the perfect time!  (captured {(captureRatio * 100).toFixed(0)}% of the peak)</div>
              ) : leftOnTable > 0 ? (
                <div style={{ fontSize:13, color:"#f59e0b", fontWeight:700 }}>You left {fmtUsd(leftOnTable)} on the table by selling early.</div>
              ) : (
                <div style={{ fontSize:13, color:"#22c55e", fontWeight:700 }}>You exited above the post-entry peak — well-timed exit.</div>
              )}
            </div>
          );
        })()}

        {/* Hindsight estimate for DexScreener coins — no OHLCV available, so
            use the 24h change to approximate the recent peak. */}
        {isDexCoin && dexPair && position.status === 'closed' && exitPrice != null && entryPrice > 0 && (() => {
          const cur = Number(dexPair.priceUsd) || 0;
          const ch24 = parseFloat(dexPair.priceChange?.h24 || 0);
          // Approximate yesterday's price and use the higher snapshot as a peak estimate
          const price24hAgo = ch24 !== -100 ? cur / (1 + ch24 / 100) : cur;
          const estimatedPeak = Math.max(cur, price24hAgo);
          if (!Number.isFinite(estimatedPeak) || estimatedPeak <= 0) return null;
          const peakPct = ((estimatedPeak / entryPrice) - 1) * 100;
          return (
            <div style={{ background:"rgba(99,102,241,0.06)", border:"1px solid rgba(99,102,241,0.18)", borderRadius:10, padding:14 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#a5b4fc", marginBottom:6 }}>What if you held longer?</div>
              <div style={{ fontSize:12, color:"#9ca3af" }}>
                If you held until peak today: estimated{' '}
                <span style={{ color: peakPct >= 0 ? "#22c55e" : "#ef4444", fontWeight:700 }}>{(peakPct >= 0 ? '+' : '')}{peakPct.toFixed(2)}%</span>
                {' '}(based on 24h high · estimate, not exact data)
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function computeBalanceSeries(account) {
  try {
    if (!account || !Array.isArray(account.history)) return { points: [], starting: 0 };
    const history = [...account.history].reverse(); // newest-first → chronological
    if (history.length === 0) return { points: [], starting: 0 };
    let balance = 0;
    const points = [];
    for (const h of history) {
      if (!h || typeof h !== 'object') continue;
      const amt = Number(h.amount) || 0;
      const usd = Number(h.usd) || 0;
      if (h.type === 'deposit')       balance += amt;
      else if (h.type === 'withdraw') balance -= amt;
      else if (h.type === 'buy')      balance -= usd;
      else if (h.type === 'sell')     balance += usd;
      const ts = h.date ? new Date(h.date).getTime() : NaN;
      if (!isFinite(ts) || !isFinite(balance)) continue;
      points.push({ ts, balance, event: h });
    }
    return { points, starting: 0 };
  } catch {
    return { points: [], starting: 0 };
  }
}

function BalanceChart({ account, onDeposit }) {
  const allSeries = React.useMemo(() => computeBalanceSeries(account), [account]);
  const [tf, setTf] = React.useState('all'); // '1w' | '1m' | '3m' | 'all'
  const [hover, setHover] = React.useState(null); // { idx, x } or null

  const [size, setSize] = React.useState({ w: 800, h: 200 });
  const wrapRef = React.useRef(null);
  React.useEffect(() => {
    const measure = () => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(320, Math.floor(r.width)), h: 200 });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const cutoff = (() => {
    if (tf === '1w') return Date.now() - 7 * 86400000;
    if (tf === '1m') return Date.now() - 30 * 86400000;
    if (tf === '3m') return Date.now() - 90 * 86400000;
    return -Infinity;
  })();
  const points = (allSeries.points || []).filter(p => p && isFinite(p.ts) && isFinite(p.balance) && p.ts >= cutoff);

  const starting = isFinite(allSeries.starting) ? allSeries.starting : 0;
  const balances = (allSeries.points || []).map(p => p?.balance).filter(v => typeof v === 'number' && isFinite(v));
  // Reduce instead of spread — large arrays + spread blow the call stack on some engines
  const allTimeHigh = balances.length ? balances.reduce((m, v) => v > m ? v : m, balances[0]) : 0;
  const allTimeLow  = balances.length ? balances.reduce((m, v) => v < m ? v : m, balances[0]) : 0;
  const current = balances.length ? balances[balances.length - 1] : 0;
  const safeHistory = Array.isArray(account?.history) ? account.history : [];
  const totalDeposits  = safeHistory.filter(h => h?.type === 'deposit').reduce((s, h) => s + (Number(h.amount) || 0), 0);
  const totalWithdraws = safeHistory.filter(h => h?.type === 'withdraw').reduce((s, h) => s + (Number(h.amount) || 0), 0);
  const netPnl = current - (totalDeposits - totalWithdraws);

  const pad = { top: 12, right: 12, bottom: 24, left: 56 };
  const innerW = size.w - pad.left - pad.right;
  const innerH = size.h - pad.top - pad.bottom;

  const chart = React.useMemo(() => {
    try {
      if (!Array.isArray(points) || points.length < 2) return null;
      let minT = points[0].ts, maxT = points[0].ts, minV = Math.min(0, points[0].balance), maxV = points[0].balance;
      for (const p of points) {
        if (p.ts < minT) minT = p.ts;
        if (p.ts > maxT) maxT = p.ts;
        if (p.balance < minV) minV = p.balance;
        if (p.balance > maxV) maxV = p.balance;
      }
      if (!isFinite(minT) || !isFinite(maxT) || !isFinite(minV) || !isFinite(maxV)) return null;
      const rangeT = (maxT - minT) || 1;
      const rangeV = (maxV - minV) || 1;
      const px = (t) => pad.left + ((t - minT) / rangeT) * innerW;
      const py = (v) => pad.top + innerH - ((v - minV) / rangeV) * innerH;
      const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.ts).toFixed(2)},${py(p.balance).toFixed(2)}`).join(' ');
      const areaD = `${d} L${px(maxT).toFixed(2)},${(pad.top + innerH).toFixed(2)} L${px(minT).toFixed(2)},${(pad.top + innerH).toFixed(2)} Z`;
      const yTicks = [];
      for (let i = 0; i <= 3; i++) {
        const v = minV + (rangeV * i) / 3;
        yTicks.push({ y: py(v), v });
      }
      return { d, areaD, px, py, minT, maxT, minV, maxV, yTicks };
    } catch {
      return null;
    }
  }, [points, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const trendColor = current >= starting ? '#22c55e' : '#ef4444';

  const onMouseMove = (e) => {
    if (!chart || points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < pad.left || x > size.w - pad.right) { setHover(null); return; }
    // Find nearest point
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(chart.px(points[i].ts) - x);
      if (d < best) { best = d; nearest = i; }
    }
    setHover({ idx: nearest });
  };

  const eventLabel = (ev) => {
    if (!ev) return '';
    if (ev.type === 'deposit') return `Deposit ${fmtUsd(ev.amount)}`;
    if (ev.type === 'withdraw') return `Withdrawal ${fmtUsd(ev.amount)}`;
    if (ev.type === 'buy') return `Bought ${(ev.symbol || '').toUpperCase()} ${fmtUsd(ev.usd || 0)}`;
    if (ev.type === 'sell') return `Sold ${(ev.symbol || '').toUpperCase()} ${fmtUsd(ev.usd || 0)}`;
    return ev.type;
  };

  const isEmpty = !allSeries.points || allSeries.points.length < 2;

  return (
    <div style={{ background:"#0f0f14", border:"1px solid #16161f", borderRadius:12, padding:16, marginBottom:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, flexWrap:"wrap", gap:8 }}>
        <div>
          <div style={{ fontSize:11, color:"#6b7280", textTransform:"uppercase", fontWeight:700, letterSpacing:"0.04em" }}>Balance</div>
          <div style={{ fontSize:26, fontWeight:900, color:"#fff", marginTop:2 }}>{fmtUsd(current)}</div>
        </div>
        <div style={{ display:"flex", gap:4, background:"#1a1a24", borderRadius:8, padding:4, border:"1px solid #16161f" }}>
          {[['1w','1W'],['1m','1M'],['3m','3M'],['all','All']].map(([id, label]) => (
            <button key={id} onClick={() => setTf(id)} style={{
              padding:"5px 12px", border:"none", borderRadius:6,
              background: tf === id ? "#6366f1" : "transparent",
              color: tf === id ? "#fff" : "#9ca3af",
              fontSize:11, fontWeight:700, cursor:"pointer",
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div ref={wrapRef} style={{ position:"relative", height:size.h }}>
        {isEmpty ? (
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
            <svg width={size.w} height={size.h} style={{ position:"absolute", inset:0, opacity:0.4 }}>
              <line x1={pad.left} y1={size.h / 2} x2={size.w - pad.right} y2={size.h / 2} stroke="#2a2a3a" strokeWidth="2" strokeDasharray="4 4"/>
              <text x={pad.left - 8} y={size.h / 2 + 4} fill="#6b7280" fontSize="10" textAnchor="end">$0</text>
            </svg>
            <div style={{ position:"relative", color:"#9ca3af", fontSize:13, textAlign:"center", padding:"0 24px" }}>
              {(allSeries.points?.length ?? 0) === 0
                ? 'Make your first deposit to start tracking your balance'
                : 'Make your first deposit to see balance history'}
            </div>
            <button onClick={onDeposit} style={{ position:"relative", padding:"10px 18px", borderRadius:10, border:"none", background:"#22c55e", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>+ Deposit</button>
          </div>
        ) : !chart || points.length === 0 ? (
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:"#6b7280", fontSize:12 }}>
            No activity in the selected timeframe.
          </div>
        ) : (
          <svg
            width={size.w} height={size.h}
            onMouseMove={onMouseMove}
            onMouseLeave={() => setHover(null)}
            style={{ display:"block" }}
          >
            <defs>
              <linearGradient id={`bal-grad-${account?.id || 'na'}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={trendColor} stopOpacity="0.25"/>
                <stop offset="100%" stopColor={trendColor} stopOpacity="0"/>
              </linearGradient>
            </defs>
            {chart.yTicks.map((t, i) => (
              <g key={i}>
                <line x1={pad.left} y1={t.y} x2={size.w - pad.right} y2={t.y} stroke="#16161f" strokeWidth="1"/>
                <text x={pad.left - 8} y={t.y + 3} fill="#6b7280" fontSize="10" textAnchor="end">{fmtUsd(t.v, { maxFractionDigits: 0 })}</text>
              </g>
            ))}
            {chart.areaD && <path d={chart.areaD} fill={`url(#bal-grad-${account?.id || 'na'})`}/>}
            <path d={chart.d} fill="none" stroke={trendColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
            {points.map((p, i) => (
              <circle key={i} cx={chart.px(p.ts)} cy={chart.py(p.balance)} r={hover?.idx === i ? 4 : 2.5} fill={trendColor}/>
            ))}
            {hover != null && points[hover.idx] && (() => {
              const p = points[hover.idx];
              const cx = chart.px(p.ts);
              const cy = chart.py(p.balance);
              return (
                <g>
                  <line x1={cx} y1={pad.top} x2={cx} y2={pad.top + innerH} stroke="#6366f1" strokeWidth="1" strokeDasharray="3 3"/>
                  <circle cx={cx} cy={cy} r="5" fill={trendColor} stroke="#0f0f14" strokeWidth="2"/>
                </g>
              );
            })()}
          </svg>
        )}

        {hover != null && points[hover.idx] && chart && (() => {
          const p = points[hover.idx];
          const cx = chart.px(p.ts);
          const tooltipLeft = Math.min(Math.max(8, cx - 90), size.w - 188);
          return (
            <div style={{
              position:"absolute", top:8, left: tooltipLeft, width:180, pointerEvents:"none",
              background:"#0a0a0f", border:"1px solid #2a2a3a", borderRadius:8, padding:"8px 10px",
              fontSize:11, color:"#fff", boxShadow:"0 4px 14px rgba(0,0,0,0.5)",
            }}>
              <div style={{ color:"#6b7280", fontSize:10, marginBottom:2 }}>{new Date(p.ts).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}</div>
              <div style={{ fontSize:14, fontWeight:800 }}>{fmtUsd(p.balance)}</div>
              <div style={{ color:"#9ca3af", marginTop:2, fontSize:11 }}>{eventLabel(p.event)}</div>
            </div>
          );
        })()}
      </div>

      {!isEmpty && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(120px, 1fr))", gap:8, marginTop:14 }}>
          <Stat label="Starting" value={fmtUsd(starting)} color="#fff"/>
          <Stat label="Current" value={fmtUsd(current)} color="#fff"/>
          <Stat label="All-time high" value={fmtUsd(allTimeHigh)} color="#22c55e"/>
          <Stat label="All-time low" value={fmtUsd(allTimeLow)} color="#ef4444"/>
          <Stat label="Total deposited" value={fmtUsd(totalDeposits)} color="#fff"/>
          <Stat label="Total withdrawn" value={fmtUsd(totalWithdraws)} color="#fff"/>
          <Stat label="Net P&L" value={(netPnl >= 0 ? '+' : '−') + fmtUsd(Math.abs(netPnl))} color={netPnl >= 0 ? '#22c55e' : '#ef4444'}/>
        </div>
      )}
    </div>
  );
}

function CryptoBuyModal({ coin, store, livePrice, onClose, onConfirm }) {
  const [accountId, setAccountId] = React.useState(() => store?.activeAccountId || store?.accounts?.[0]?.id || '');
  const [usdInput, setUsdInput] = React.useState('');
  const [priceInput, setPriceInput] = React.useState(() => {
    const p = livePrice ?? coin?.priceAtSignal ?? coin?.price;
    return p ? String(p) : '';
  });
  const [notesInput, setNotesInput] = React.useState('');
  const [targetInput, setTargetInput] = React.useState('');
  const [stopInput, setStopInput] = React.useState('');
  const [error, setError] = React.useState(null);

  // If the live price arrives after the modal mounts, prefill the entry field
  // as long as the user hasn't typed anything yet.
  React.useEffect(() => {
    if (livePrice && !priceInput) setPriceInput(String(livePrice));
  }, [livePrice]); // eslint-disable-line react-hooks/exhaustive-deps

  const usd = parseFloat(usdInput) || 0;
  const price = parseFloat(priceInput) || 0;
  const amount = price > 0 ? usd / price : 0;
  const account = store?.accounts?.find(a => a.id === accountId) || null;
  const insufficient = account && usd > (account.balance || 0);

  const confirm = () => {
    if (!accountId) { setError('Pick an account.'); return; }
    if (!(usd > 0)) { setError('Enter a USD amount.'); return; }
    if (!(price > 0)) { setError('Enter a valid price.'); return; }
    if (insufficient) { setError('Not enough balance in that account.'); return; }
    const target = targetInput.trim() === '' ? null : Math.max(0, parseFloat(targetInput) || 0);
    const stop   = stopInput.trim()   === '' ? null : Math.max(0, parseFloat(stopInput)   || 0);
    onConfirm({
      accountId,
      usdAmount: usd,
      price,
      notes: notesInput.trim(),
      targetPct: target,
      stopLossPct: stop,
    });
  };

  if (!coin) return null;
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16, overflowY:"auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ background:"#0f0f14", border:"1px solid #16161f", borderRadius:14, padding:20, width:"100%", maxWidth:460, color:"#fff", margin:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800 }}>Buy {(coin.symbol || coin.name || '').toUpperCase()}</div>
            <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>{coin.name || coin.symbol}{livePrice ? ' · current ' + fmtUsd(livePrice) : ''}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer", fontSize:20, lineHeight:1 }}>×</button>
        </div>

        <label style={{ display:"block", fontSize:11, color:"#9ca3af", marginBottom:6, textTransform:"uppercase", fontWeight:700, letterSpacing:"0.04em" }}>Account</label>
        {store?.accounts?.length ? (
          <select
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid #16161f", background:"#1a1a24", color:"#fff", fontSize:13, outline:"none", marginBottom:14 }}
          >
            {store.accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.type.toUpperCase()}) · {fmtUsd(a.balance)}</option>
            ))}
          </select>
        ) : (
          <div style={{ padding:"10px 12px", borderRadius:8, background:"rgba(245,158,11,0.10)", border:"1px solid rgba(245,158,11,0.25)", color:"#fcd34d", fontSize:12, marginBottom:14 }}>
            No accounts yet. Create one from the Accounts section first.
          </div>
        )}

        <label style={{ display:"block", fontSize:11, color:"#9ca3af", marginBottom:6, textTransform:"uppercase", fontWeight:700, letterSpacing:"0.04em" }}>Amount in USD</label>
        <input
          type="number" value={usdInput} onChange={e => { setUsdInput(e.target.value); setError(null); }}
          placeholder="500" style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid #16161f", background:"#1a1a24", color:"#fff", fontSize:13, outline:"none", marginBottom:6 }}
        />
        <div style={{ fontSize:11, color:"#6b7280", marginBottom:14 }}>
          ≈ {amount > 0 ? amount.toLocaleString(undefined, { maximumFractionDigits: 8 }) : '0'} {(coin.symbol || '').toUpperCase()}
        </div>

        <label style={{ display:"block", fontSize:11, color:"#9ca3af", marginBottom:6, textTransform:"uppercase", fontWeight:700, letterSpacing:"0.04em" }}>Entry Price (USD)</label>
        <input
          type="number" value={priceInput} onChange={e => { setPriceInput(e.target.value); setError(null); }}
          placeholder="0.00" style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid #16161f", background:"#1a1a24", color:"#fff", fontSize:13, outline:"none", marginBottom:14 }}
        />

        <label style={{ display:"block", fontSize:11, color:"#9ca3af", marginBottom:6, textTransform:"uppercase", fontWeight:700, letterSpacing:"0.04em" }}>Entry notes (optional)</label>
        <textarea
          value={notesInput} onChange={e => setNotesInput(e.target.value)}
          placeholder="Why are you buying this? (thesis, catalyst, source…)"
          rows={2}
          style={{ width:"100%", padding:"8px 12px", borderRadius:8, border:"1px solid #16161f", background:"#1a1a24", color:"#fff", fontSize:13, outline:"none", marginBottom:14, resize:"vertical", fontFamily:"inherit" }}
        />

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
          <div>
            <label style={{ display:"block", fontSize:11, color:"#9ca3af", marginBottom:6, textTransform:"uppercase", fontWeight:700, letterSpacing:"0.04em" }}>Target %</label>
            <div style={{ position:"relative" }}>
              <input
                type="number" value={targetInput} onChange={e => setTargetInput(e.target.value)}
                placeholder="50"
                style={{ width:"100%", padding:"9px 28px 9px 12px", borderRadius:8, border:"1px solid #16161f", background:"#1a1a24", color:"#fff", fontSize:13, outline:"none" }}
              />
              <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", color:"#6b7280", fontSize:12 }}>%</span>
            </div>
          </div>
          <div>
            <label style={{ display:"block", fontSize:11, color:"#9ca3af", marginBottom:6, textTransform:"uppercase", fontWeight:700, letterSpacing:"0.04em" }}>Stop loss %</label>
            <div style={{ position:"relative" }}>
              <input
                type="number" value={stopInput} onChange={e => setStopInput(e.target.value)}
                placeholder="20"
                style={{ width:"100%", padding:"9px 28px 9px 12px", borderRadius:8, border:"1px solid #16161f", background:"#1a1a24", color:"#fff", fontSize:13, outline:"none" }}
              />
              <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", color:"#6b7280", fontSize:12 }}>%</span>
            </div>
          </div>
        </div>

        {error && <div style={{ color:"#ef4444", fontSize:12, marginBottom:10 }}>{error}</div>}
        {insufficient && !error && <div style={{ color:"#f59e0b", fontSize:12, marginBottom:10 }}>Account balance is {fmtUsd(account.balance)} — not enough for this purchase.</div>}

        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:8, border:"1px solid #2a2a3a", background:"transparent", color:"#9ca3af", fontSize:13, fontWeight:700, cursor:"pointer" }}>Cancel</button>
          <button onClick={confirm} disabled={!store?.accounts?.length || insufficient} style={{ flex:1, padding:"10px", borderRadius:8, border:"none", background: (!store?.accounts?.length || insufficient) ? "#2a2a3a" : "#22c55e", color:"#fff", fontSize:13, fontWeight:700, cursor: (!store?.accounts?.length || insufficient) ? "not-allowed" : "pointer" }}>Confirm Buy →</button>
        </div>
      </div>
    </div>
  );
}

function CryptoAccounts({ store, onUpdate, refreshKey, onUpdated, onRequestBuy }) {
  const accounts = store?.accounts || [];
  const initialActiveId = store?.activeAccountId || accounts[0]?.id || null;
  const activeAccount = accounts.find(a => a.id === initialActiveId) || accounts[0] || null;

  const [tab, setTab] = React.useState('positions');
  const [createType, setCreateType] = React.useState(null);
  const [createName, setCreateName] = React.useState('');
  const [createBalance, setCreateBalance] = React.useState('');
  const [txnDialog, setTxnDialog] = React.useState(null); // 'deposit' | 'withdraw'
  const [txnAmount, setTxnAmount] = React.useState('');
  const [txnNote, setTxnNote] = React.useState('');
  const [closeFor, setCloseFor] = React.useState(null); // position object
  const [closePrice, setClosePrice] = React.useState('');
  const [closeNotes, setCloseNotes] = React.useState('');
  const [exitMode, setExitMode] = React.useState('full'); // 'full' | 'partial'
  const [partialPercent, setPartialPercent] = React.useState(50);
  const [chartModal, setChartModal] = React.useState(null);
  const [livePrices, setLivePrices] = React.useState({});
  const [alertEdits, setAlertEdits] = React.useState({}); // positionId -> { target, stop }

  const openForPrices = React.useMemo(() => {
    if (!activeAccount) return [];
    return (activeAccount.positions || []).filter(p => p.status === 'open');
  }, [activeAccount]);
  const openKey = React.useMemo(() => openForPrices.map(p => `${p.id}:${p.coinId}`).join(','), [openForPrices]);

  React.useEffect(() => {
    if (openForPrices.length === 0) {
      setLivePrices({});
      onUpdated?.(Date.now());
      return;
    }
    let cancelled = false;
    const load = async () => {
      const next = {};
      await Promise.all(openForPrices.map(async p => { next[p.id] = await fetchCurrentPrice(p.coinId); }));
      if (!cancelled) { setLivePrices(next); onUpdated?.(Date.now()); }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey, refreshKey, onUpdated]);

  const setActiveAccount = (id) => onUpdate(prev => ({ ...prev, activeAccountId: id }));

  const createAccount = () => {
    const name = createName.trim();
    const balance = Math.max(0, parseFloat(createBalance) || 0);
    if (!name || !createType) return;
    const id = makeShortId('acc');
    const nowIso = new Date().toISOString();
    const acc = {
      id, name, type: createType, balance, createdAt: nowIso,
      positions: [],
      history: balance > 0 ? [{ id: makeShortId('h'), type: 'deposit', amount: balance, note: 'Starting balance', date: nowIso }] : [],
    };
    onUpdate(prev => ({
      ...prev,
      accounts: [...(prev.accounts || []), acc],
      activeAccountId: prev.activeAccountId || id,
    }));
    setCreateType(null);
    setCreateName('');
    setCreateBalance('');
  };

  const deleteAccount = (id) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this account and all of its history?')) return;
    onUpdate(prev => {
      const accts = (prev.accounts || []).filter(a => a.id !== id);
      const activeId = prev.activeAccountId === id ? (accts[0]?.id ?? null) : prev.activeAccountId;
      return { ...prev, accounts: accts, activeAccountId: activeId };
    });
  };

  const submitTxn = () => {
    const amount = parseFloat(txnAmount) || 0;
    if (!(amount > 0) || !activeAccount) return;
    if (txnDialog === 'deposit') onUpdate(prev => depositToAccount(prev, activeAccount.id, amount, txnNote));
    else if (txnDialog === 'withdraw') onUpdate(prev => withdrawFromAccount(prev, activeAccount.id, amount, txnNote));
    setTxnDialog(null); setTxnAmount(''); setTxnNote('');
  };

  const submitClose = () => {
    if (!closeFor) return;
    const exit = parseFloat(closePrice) || 0;
    if (!(exit > 0)) return;
    const sym = (closeFor.symbol || closeFor.name || '').toUpperCase();
    if (exitMode === 'partial') {
      const pct = Math.min(95, Math.max(5, partialPercent));
      const closeCoins = closeFor.amount * (pct / 100);
      const pnl = (exit - closeFor.entryPrice) * closeCoins;
      onUpdate(prev => partialClosePositionInAccount(prev, activeAccount.id, closeFor.id, exit, pct, closeNotes.trim()));
      try { toast(`Closed ${pct}% of ${sym} — P&L ${pnl >= 0 ? '+' : '−'}${fmtUsd(Math.abs(pnl))}`, pnl >= 0 ? 'success' : 'error'); } catch {}
    } else {
      const pnl = (exit - closeFor.entryPrice) * closeFor.amount;
      onUpdate(prev => closePositionInAccount(prev, activeAccount.id, closeFor.id, exit, closeNotes.trim()));
      try { toast(`Closed ${sym} — P&L ${pnl >= 0 ? '+' : '−'}${fmtUsd(Math.abs(pnl))}`, pnl >= 0 ? 'success' : 'error'); } catch {}
    }
    setCloseFor(null); setClosePrice(''); setCloseNotes('');
    setExitMode('full'); setPartialPercent(50);
  };

  const saveAlerts = (positionId) => {
    const edit = alertEdits[positionId] || {};
    const target = edit.target === '' || edit.target == null ? null : Math.max(0, parseFloat(edit.target) || 0);
    const stop   = edit.stop   === '' || edit.stop   == null ? null : Math.max(0, parseFloat(edit.stop)   || 0);
    onUpdate(prev => setPositionAlerts(prev, activeAccount.id, positionId, target, stop));
    if ((target != null && target > 0) || (stop != null && stop > 0)) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try { Notification.requestPermission().catch(() => {}); } catch {}
      }
    }
  };

  // ---------- Empty / accounts list view ----------
  if (!activeAccount) {
    return (
      <div>
        <div style={{ textAlign:"center", padding:48, color:"#6b7280", fontSize:13, background:"#0d0d12", border:"1px dashed #16161f", borderRadius:12, marginBottom:16 }}>
          No crypto accounts yet. Create one to start tracking trades.
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => setCreateType('paper')} style={{ flex:1, padding:"10px 14px", borderRadius:10, border:"1px solid #2a2a3a", background:"#1a1a24", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>+ New Paper Account</button>
          <button onClick={() => setCreateType('real')}  style={{ flex:1, padding:"10px 14px", borderRadius:10, border:"none",            background:"#6366f1", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>+ New Real Account</button>
        </div>
        {createType && <CreateAccountForm type={createType} name={createName} balance={createBalance} onName={setCreateName} onBalance={setCreateBalance} onCancel={() => { setCreateType(null); setCreateName(''); setCreateBalance(''); }} onSubmit={createAccount}/>}
      </div>
    );
  }

  const positions = activeAccount.positions || [];
  const openPositions = positions.filter(p => p.status === 'open');
  const closedPositions = positions.filter(p => p.status === 'closed');

  // Live current prices on open positions
  const positionsWithLive = openPositions.map(p => {
    const cur = livePrices[p.id] || p.currentPrice || p.entryPrice;
    const value = cur * p.amount;
    const cost = p.amountUSD ?? (p.entryPrice * p.amount);
    const pnl = value - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    return { ...p, _cur: cur, _value: value, _pnl: pnl, _pnlPct: pnlPct };
  });

  const unrealizedPnl = positionsWithLive.reduce((s, p) => s + p._pnl, 0);
  const openValue = positionsWithLive.reduce((s, p) => s + p._cur * p.amount, 0);
  const closedPnl = closedPositions.reduce((s, p) => s + ((p.exitPrice - p.entryPrice) * p.amount), 0);

  const history = activeAccount.history || [];
  const deposits = history.filter(h => h.type === 'deposit').reduce((s, h) => s + h.amount, 0);
  const withdraws = history.filter(h => h.type === 'withdraw').reduce((s, h) => s + h.amount, 0);
  const netInvested = deposits - withdraws;
  const currentValue = activeAccount.balance + openValue;
  const totalPnl = currentValue - netInvested;
  const totalReturnPct = netInvested > 0 ? (totalPnl / netInvested) * 100 : 0;

  const closedWithPnl = closedPositions.map(p => ({ ...p, _pnl: (p.exitPrice - p.entryPrice) * p.amount, _pnlPct: p.entryPrice > 0 ? ((p.exitPrice / p.entryPrice) - 1) * 100 : 0 }));
  const wins = closedWithPnl.filter(p => p._pnl > 0).length;
  const winRate = closedWithPnl.length > 0 ? (wins / closedWithPnl.length) * 100 : null;
  const bestTrade = closedWithPnl.length > 0 ? closedWithPnl.reduce((b, p) => p._pnlPct > b._pnlPct ? p : b) : null;
  const worstTrade = closedWithPnl.length > 0 ? closedWithPnl.reduce((b, p) => p._pnlPct < b._pnlPct ? p : b) : null;
  const avgHoldMs = closedPositions.length > 0
    ? closedPositions.reduce((s, p) => s + (new Date(p.exitDate).getTime() - new Date(p.entryDate).getTime()), 0) / closedPositions.length
    : 0;
  const avgHoldHrs = avgHoldMs / 3600000;
  const avgHold = avgHoldHrs >= 24 ? Math.round(avgHoldHrs / 24) + 'd' : Math.round(avgHoldHrs) + 'h';

  const tabs = [
    { id:'positions', label:'Positions' },
    { id:'history',   label:'History' },
    { id:'stats',     label:'Stats' },
  ];

  return (
    <div>
      {/* Account switcher */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:18 }}>
        {accounts.map(a => {
          const isActive = a.id === activeAccount.id;
          return (
            <div key={a.id} onClick={() => setActiveAccount(a.id)} style={{
              cursor:"pointer",
              padding:"10px 14px",
              borderRadius:10,
              border: isActive ? "1px solid #6366f1" : "1px solid #16161f",
              background: isActive ? "rgba(99,102,241,0.08)" : "#0d0d12",
              minWidth:200,
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                <span style={{ fontSize:9, fontWeight:800, padding:"2px 6px", borderRadius:4, background: a.type === 'real' ? "rgba(34,197,94,0.15)" : "rgba(99,102,241,0.18)", color: a.type === 'real' ? "#22c55e" : "#a5b4fc", letterSpacing:"0.05em" }}>{a.type.toUpperCase()}</span>
                <span style={{ fontSize:13, color:"#fff", fontWeight:700 }}>{a.name}</span>
                {isActive && <span style={{ fontSize:9, marginLeft:"auto", color:"#6366f1", fontWeight:800, textTransform:"uppercase" }}>Active</span>}
              </div>
              <div style={{ fontSize:16, fontWeight:800, color:"#fff" }}>{fmtUsd(a.balance)}</div>
            </div>
          );
        })}
        <div style={{ display:"flex", flexDirection:"column", gap:6, justifyContent:"center" }}>
          <button onClick={() => setCreateType('paper')} style={{ padding:"6px 12px", borderRadius:8, border:"1px solid #2a2a3a", background:"#1a1a24", color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>+ New Paper Account</button>
          <button onClick={() => setCreateType('real')}  style={{ padding:"6px 12px", borderRadius:8, border:"none",            background:"#6366f1", color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>+ New Real Account</button>
        </div>
      </div>

      {createType && <CreateAccountForm type={createType} name={createName} balance={createBalance} onName={setCreateName} onBalance={setCreateBalance} onCancel={() => { setCreateType(null); setCreateName(''); setCreateBalance(''); }} onSubmit={createAccount}/>}

      {/* Header */}
      <div style={{ background:"#0f0f14", border:"1px solid #16161f", borderRadius:12, padding:18, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14, flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:11, fontWeight:800, padding:"3px 8px", borderRadius:5, background: activeAccount.type === 'real' ? "rgba(34,197,94,0.18)" : "rgba(99,102,241,0.20)", color: activeAccount.type === 'real' ? "#22c55e" : "#a5b4fc", letterSpacing:"0.05em" }}>{activeAccount.type.toUpperCase()}</span>
              <span style={{ fontSize:18, fontWeight:800, color:"#fff" }}>{activeAccount.name}</span>
            </div>
            <div style={{ fontSize:30, fontWeight:900, color:"#fff", marginTop:6 }}>{fmtUsd(currentValue)}</div>
            <div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>Cash {fmtUsd(activeAccount.balance)} · Open positions {fmtUsd(openValue)}</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => { setTxnDialog('deposit'); setTxnAmount(''); setTxnNote(''); }} style={{ padding:"10px 16px", borderRadius:10, border:"none", background:"#22c55e", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>+ Deposit</button>
            <button onClick={() => { setTxnDialog('withdraw'); setTxnAmount(''); setTxnNote(''); }} style={{ padding:"10px 16px", borderRadius:10, border:"1px solid #2a2a3a", background:"transparent", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>− Withdraw</button>
            <button onClick={() => deleteAccount(activeAccount.id)} title="Delete account" style={{ padding:"10px 12px", borderRadius:10, border:"1px solid #2a2a3a", background:"transparent", color:"#ef4444", fontSize:13, fontWeight:700, cursor:"pointer" }}>×</button>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(120px, 1fr))", gap:10 }}>
          <Stat label="Unrealized P&L" value={(unrealizedPnl >= 0 ? '+' : '−') + fmtUsd(Math.abs(unrealizedPnl))} color={unrealizedPnl >= 0 ? "#22c55e" : "#ef4444"}/>
          <Stat label="Realized P&L" value={(closedPnl >= 0 ? '+' : '−') + fmtUsd(Math.abs(closedPnl))} color={closedPnl >= 0 ? "#22c55e" : "#ef4444"}/>
          <Stat label="Total P&L" value={(totalPnl >= 0 ? '+' : '−') + fmtUsd(Math.abs(totalPnl))} color={totalPnl >= 0 ? "#22c55e" : "#ef4444"}/>
          <Stat label="Return" value={netInvested > 0 ? (totalReturnPct >= 0 ? '+' : '') + totalReturnPct.toFixed(2) + '%' : '—'} color={totalReturnPct >= 0 ? "#22c55e" : "#ef4444"}/>
          <Stat label="Win rate" value={winRate == null ? '—' : winRate.toFixed(0) + '%'} color="#fff"/>
          <Stat label="Open" value={String(openPositions.length)} color="#fff"/>
        </div>
      </div>

      {/* Activity feed — simple history list (replaces SVG balance chart) */}
      <div style={{ background:"#0f0f14", border:"1px solid #16161f", borderRadius:12, padding:16, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ fontSize:11, color:"#6b7280", textTransform:"uppercase", fontWeight:700, letterSpacing:"0.04em" }}>Activity</div>
          {(activeAccount?.history?.length ?? 0) === 0 && (
            <button onClick={() => { setTxnDialog('deposit'); setTxnAmount(''); setTxnNote(''); }} style={{ padding:"6px 14px", borderRadius:8, border:"none", background:"#22c55e", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>+ Deposit</button>
          )}
        </div>
        {(activeAccount?.history?.length ?? 0) === 0 ? (
          <div style={{ textAlign:"center", padding:24, color:"#6b7280", fontSize:13 }}>
            Make your first deposit to start tracking your balance.
          </div>
        ) : (
          <div style={{ maxHeight:240, overflowY:"auto" }}>
            {(activeAccount.history || []).map((h, i) => {
              if (!h) return null;
              const isDeposit  = h.type === 'deposit';
              const isWithdraw = h.type === 'withdraw' || h.type === 'withdrawal';
              const isBuy      = h.type === 'buy';
              const isSell     = h.type === 'sell';
              const color = isDeposit ? '#22c55e' : isWithdraw ? '#ef4444' : isSell ? (Number(h.pnl) >= 0 ? '#22c55e' : '#ef4444') : '#a5b4fc';
              const sign = (isDeposit || isSell) ? '+' : '−';
              const amount = isBuy || isSell ? (Number(h.usd) || 0) : (Number(h.amount) || 0);
              const label = isBuy ? `Bought ${(h.symbol || '').toUpperCase() || h.coinId || 'token'}`
                          : isSell ? `Sold ${(h.symbol || '').toUpperCase() || h.coinId || 'token'}`
                          : isDeposit ? 'Deposit'
                          : isWithdraw ? 'Withdrawal'
                          : (h.type || 'Event');
              return (
                <div key={h.id || i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #16161f", gap:12 }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:13, color:"#fff", fontWeight:600 }}>{label}</div>
                    <div style={{ fontSize:11, color:"#6b7280" }}>
                      {fmtDateShort(h.date)}
                      {h.note ? ` · ${h.note}` : ''}
                    </div>
                  </div>
                  <span style={{ color, fontSize:13, fontWeight:700, whiteSpace:"nowrap" }}>
                    {sign}{fmtUsd(Math.abs(amount))}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:14, background:"#1a1a24", borderRadius:10, padding:4, border:"1px solid #16161f", width:"fit-content" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:"7px 16px", border:"none", borderRadius:7,
            background: tab===t.id ? "#6366f1" : "transparent",
            color: tab===t.id ? "#fff" : "#9ca3af",
            fontSize:12, fontWeight:700, cursor:"pointer",
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'positions' && (
        <div>
          {/* Open positions */}
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#fff", marginBottom:8 }}>Open positions ({openPositions.length})</div>
            {openPositions.length === 0 ? (
              <div style={{ padding:20, background:"#0d0d12", border:"1px dashed #16161f", borderRadius:10, color:"#6b7280", fontSize:12, textAlign:"center" }}>
                No open positions. Click "Buy →" on any trending coin to start.
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {positionsWithLive.map(p => {
                  const edit = alertEdits[p.id] || { target: p.alertTarget ?? '', stop: p.alertStop ?? '' };
                  return (
                    <div key={p.id} onClick={() => setChartModal({ position: p })} style={{ background:"#0d0d12", border:"1px solid #16161f", borderRadius:10, padding:14, cursor:"pointer", transition:"border-color 0.15s, background 0.15s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "#2a2a3a"; e.currentTarget.style.background = "#141420"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "#16161f"; e.currentTarget.style.background = "#0d0d12"; }}>
                      <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr 1fr 1fr auto", gap:12, alignItems:"center" }}>
                        <div>
                          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                            <span style={{ fontSize:13, fontWeight:700, color:"#fff" }}>{p.name}</span>
                            {p.partialCloseCount > 0 && (
                              <span style={{ fontSize:10, fontWeight:700, padding:"2px 6px", borderRadius:4, background:"rgba(245,158,11,0.15)", color:"#f59e0b" }} title={`${p.partialCloseCount} partial close${p.partialCloseCount === 1 ? '' : 's'}`}>Partial</span>
                            )}
                            {p.alertTarget != null && p.alertTarget > 0 && (
                              <span style={{ fontSize:10, fontWeight:700, padding:"2px 6px", borderRadius:4, background:"rgba(34,197,94,0.15)", color:"#22c55e" }}> +{p.alertTarget}%</span>
                            )}
                            {p.alertStop != null && p.alertStop > 0 && (
                              <span style={{ fontSize:10, fontWeight:700, padding:"2px 6px", borderRadius:4, background:"rgba(239,68,68,0.15)", color:"#ef4444" }}> -{p.alertStop}%</span>
                            )}
                          </div>
                          <div style={{ fontSize:11, color:"#6b7280" }}>{p.symbol?.toUpperCase()} · {p.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })}</div>
                        </div>
                        <div>
                          <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase" }}>Entry</div>
                          <div style={{ fontSize:12, color:"#fff" }}>{fmtUsd(p.entryPrice, { maxFractionDigits: 8 })}</div>
                        </div>
                        <div>
                          <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase" }}>Current</div>
                          <div style={{ fontSize:12, color:"#fff", transition:"color 0.3s ease" }}>{fmtUsd(p._cur, { maxFractionDigits: 8 })}</div>
                        </div>
                        <div>
                          <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase" }}>Value</div>
                          <div style={{ fontSize:12, color:"#fff", transition:"color 0.3s ease" }}>{fmtUsd(p._value)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase" }}>P&L</div>
                          <div style={{ fontSize:12, fontWeight:700, transition:"color 0.3s ease", color: p._pnl >= 0 ? "#22c55e" : "#ef4444" }}>{(p._pnl >= 0 ? '+' : '−') + fmtUsd(Math.abs(p._pnl))}</div>
                        </div>
                        <div>
                          <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase" }}>P&L %</div>
                          <div style={{ fontSize:12, fontWeight:700, transition:"color 0.3s ease", color: p._pnlPct >= 0 ? "#22c55e" : "#ef4444" }}>{(p._pnlPct >= 0 ? '+' : '') + p._pnlPct.toFixed(2) + '%'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase" }}>Held</div>
                          <div style={{ fontSize:12, color:"#fff" }}>{fmtHoldDuration(p.entryDate)}</div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setCloseFor(p); setClosePrice(String(p._cur || p.entryPrice)); setCloseNotes(''); }} style={{ padding:"8px 14px", borderRadius:8, border:"none", background:"#22c55e", color:"#fff", fontSize:12, fontWeight:800, cursor:"pointer", whiteSpace:"nowrap", letterSpacing:"0.02em" }}>Close Position →</button>
                      </div>

                      <div onClick={(e) => e.stopPropagation()} style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #16161f", display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", cursor:"default" }}>
                        <span style={{ fontSize:11, color:"#9ca3af" }}>Alerts:</span>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ fontSize:11, color:"#9ca3af" }}>Target +</span>
                          <input type="number" value={edit.target} onChange={e => setAlertEdits(prev => ({ ...prev, [p.id]: { ...edit, target: e.target.value } }))} onBlur={() => saveAlerts(p.id)} placeholder="20" style={{ width:60, padding:"4px 8px", borderRadius:6, border:"1px solid #2a2a3a", background:"#1a1a24", color:"#fff", fontSize:12, outline:"none" }}/>
                          <span style={{ fontSize:11, color:"#9ca3af" }}>%</span>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ fontSize:11, color:"#9ca3af" }}>Stop −</span>
                          <input type="number" value={edit.stop} onChange={e => setAlertEdits(prev => ({ ...prev, [p.id]: { ...edit, stop: e.target.value } }))} onBlur={() => saveAlerts(p.id)} placeholder="10" style={{ width:60, padding:"4px 8px", borderRadius:6, border:"1px solid #2a2a3a", background:"#1a1a24", color:"#fff", fontSize:12, outline:"none" }}/>
                          <span style={{ fontSize:11, color:"#9ca3af" }}>%</span>
                        </div>
                        {(p.alertTarget || p.alertStop) && <span style={{ fontSize:10, color:"#22c55e", fontWeight:700 }} title="Alert is active and being checked every 60s">● Active</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Closed positions */}
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#fff", marginBottom:8 }}>Closed positions ({closedPositions.length})</div>
            {closedPositions.length === 0 ? (
              <div style={{ padding:16, background:"#0d0d12", border:"1px dashed #16161f", borderRadius:10, color:"#6b7280", fontSize:12, textAlign:"center" }}>No closed trades yet.</div>
            ) : (
              <div style={{ background:"#0d0d12", border:"1px solid #16161f", borderRadius:10, overflow:"hidden" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr 1fr", padding:"10px 14px", borderBottom:"1px solid #16161f" }}>
                  {["Coin","Entry","Exit","Held for","P&L","P&L %"].map(h => (
                    <div key={h} style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase" }}>{h}</div>
                  ))}
                </div>
                {closedWithPnl.sort((a, b) => new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime()).map(p => (
                  <div
                    key={p.id}
                    onClick={() => setChartModal({ position: p })}
                    style={{ borderBottom:"1px solid #16161f", cursor:"pointer", transition:"background 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#141420"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr 1fr", padding:"10px 14px", alignItems:"center" }}>
                      <div style={{ fontSize:12, color:"#fff", fontWeight:600 }}>{p.name} <span style={{ color:"#6b7280", fontWeight:400 }}>{p.symbol?.toUpperCase()}</span></div>
                      <div style={{ fontSize:12, color:"#fff" }}>{fmtUsd(p.entryPrice, { maxFractionDigits: 6 })}</div>
                      <div style={{ fontSize:12, color:"#fff" }}>{fmtUsd(p.exitPrice, { maxFractionDigits: 6 })}</div>
                      <div style={{ fontSize:12, color:"#9ca3af" }}>{fmtHoldDuration(p.entryDate, p.exitDate)}</div>
                      <div style={{ fontSize:12, fontWeight:700, color: p._pnl >= 0 ? "#22c55e" : "#ef4444" }}>{(p._pnl >= 0 ? '+' : '−') + fmtUsd(Math.abs(p._pnl))}</div>
                      <div style={{ fontSize:12, fontWeight:700, color: p._pnlPct >= 0 ? "#22c55e" : "#ef4444" }}>{(p._pnlPct >= 0 ? '+' : '') + p._pnlPct.toFixed(2) + '%'}</div>
                    </div>
                    {(p.notes || p.exitNotes) && (
                      <div style={{ padding:"0 14px 10px", display:"flex", flexDirection:"column", gap:4 }}>
                        {p.notes && <div style={{ fontSize:11, color:"#6b7280" }}><span style={{ color:"#a5b4fc", fontWeight:700 }}>Entry:</span> {p.notes}</div>}
                        {p.exitNotes && <div style={{ fontSize:11, color:"#6b7280" }}><span style={{ color:"#f59e0b", fontWeight:700 }}>Exit:</span> {p.exitNotes}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div style={{ background:"#0d0d12", border:"1px solid #16161f", borderRadius:10, overflow:"hidden" }}>
          {history.length === 0 ? (
            <div style={{ padding:20, color:"#6b7280", fontSize:12, textAlign:"center" }}>No activity yet.</div>
          ) : history.map(h => {
            let line;
            const date = fmtDateShort(h.date);
            if (h.type === 'deposit') line = `Deposited ${fmtUsd(h.amount)}${h.note ? ' — ' + h.note : ''} on ${date}`;
            else if (h.type === 'withdraw') line = `Withdrew ${fmtUsd(h.amount)}${h.note ? ' — ' + h.note : ''} on ${date}`;
            else if (h.type === 'buy') line = `Bought ${h.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${h.symbol || ''} at ${fmtUsd(h.price)} on ${date}`;
            else if (h.type === 'sell') {
              const pnlStr = h.pnl != null ? ` (${h.pnl >= 0 ? '+' : '−'}${fmtUsd(Math.abs(h.pnl))})` : '';
              line = `Sold ${h.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} ${h.symbol || ''} at ${fmtUsd(h.price)} on ${date}${pnlStr}`;
            } else line = `${h.type}: ${date}`;
            const color = h.type === 'buy' ? "#a5b4fc"
                        : h.type === 'sell' ? (h.pnl >= 0 ? "#22c55e" : "#ef4444")
                        : h.type === 'deposit' ? "#22c55e"
                        : h.type === 'withdraw' ? "#f59e0b" : "#fff";
            return (
              <div key={h.id} style={{ padding:"10px 14px", borderBottom:"1px solid #16161f", fontSize:12, color, display:"flex", justifyContent:"space-between", gap:12 }}>
                <span>{line}</span>
                <span style={{ color:"#6b7280", fontSize:11, whiteSpace:"nowrap" }}>{new Date(h.date).toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit' })}</span>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'stats' && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))", gap:10 }}>
          <Stat label="Total deposited" value={fmtUsd(deposits)} color="#fff"/>
          <Stat label="Total withdrawn" value={fmtUsd(withdraws)} color="#fff"/>
          <Stat label="Net invested" value={fmtUsd(netInvested)} color="#fff"/>
          <Stat label="Current value" value={fmtUsd(currentValue)} color="#fff"/>
          <Stat label="Total P&L" value={(totalPnl >= 0 ? '+' : '−') + fmtUsd(Math.abs(totalPnl))} color={totalPnl >= 0 ? "#22c55e" : "#ef4444"}/>
          <Stat label="Unrealized P&L" value={(unrealizedPnl >= 0 ? '+' : '−') + fmtUsd(Math.abs(unrealizedPnl))} color={unrealizedPnl >= 0 ? "#22c55e" : "#ef4444"}/>
          <Stat label="Realized P&L" value={(closedPnl >= 0 ? '+' : '−') + fmtUsd(Math.abs(closedPnl))} color={closedPnl >= 0 ? "#22c55e" : "#ef4444"}/>
          <Stat label="Win rate" value={winRate == null ? '—' : winRate.toFixed(0) + '%'} color="#fff"/>
          <Stat label="Best trade" value={bestTrade ? (bestTrade._pnlPct >= 0 ? '+' : '') + bestTrade._pnlPct.toFixed(1) + '% ' + (bestTrade.symbol || '').toUpperCase() : '—'} color="#22c55e"/>
          <Stat label="Worst trade" value={worstTrade ? worstTrade._pnlPct.toFixed(1) + '% ' + (worstTrade.symbol || '').toUpperCase() : '—'} color="#ef4444"/>
          <Stat label="Avg hold" value={closedPositions.length ? avgHold : '—'} color="#fff"/>
          <Stat label="Trades closed" value={String(closedPositions.length)} color="#fff"/>
        </div>
      )}

      {/* Deposit / Withdraw dialog */}
      {txnDialog && (
        <div onClick={() => setTxnDialog(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#0f0f14", border:"1px solid #16161f", borderRadius:14, padding:20, width:"100%", maxWidth:380, color:"#fff" }}>
            <div style={{ fontSize:18, fontWeight:800, marginBottom:12 }}>{txnDialog === 'deposit' ? '+ Deposit' : '− Withdraw'}</div>
            <label style={{ display:"block", fontSize:11, color:"#9ca3af", marginBottom:6, textTransform:"uppercase", fontWeight:700 }}>Amount (USD)</label>
            <input type="number" value={txnAmount} onChange={e => setTxnAmount(e.target.value)} placeholder="100" style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid #16161f", background:"#1a1a24", color:"#fff", fontSize:13, outline:"none", marginBottom:12 }}/>
            <label style={{ display:"block", fontSize:11, color:"#9ca3af", marginBottom:6, textTransform:"uppercase", fontWeight:700 }}>Note (optional)</label>
            <input type="text" value={txnNote} onChange={e => setTxnNote(e.target.value)} placeholder="e.g. paycheck, transferred from bank" style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid #16161f", background:"#1a1a24", color:"#fff", fontSize:13, outline:"none", marginBottom:14 }}/>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setTxnDialog(null)} style={{ flex:1, padding:"10px", borderRadius:8, border:"1px solid #2a2a3a", background:"transparent", color:"#9ca3af", fontSize:13, fontWeight:700, cursor:"pointer" }}>Cancel</button>
              <button onClick={submitTxn} style={{ flex:1, padding:"10px", borderRadius:8, border:"none", background: txnDialog === 'deposit' ? "#22c55e" : "#f59e0b", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Position chart modal */}
      {chartModal?.position && (
        <ChartErrorBoundary
          resetKey={chartModal.position.id}
          fallback={
            <div onClick={() => setChartModal(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1100, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
              <div onClick={e => e.stopPropagation()} style={{ background:"#0a0a0f", border:"1px solid #16161f", borderRadius:14, padding:24, maxWidth:420, color:"#fff" }}>
                <div style={{ fontSize:16, fontWeight:800, marginBottom:6 }}>Chart unavailable</div>
                <div style={{ fontSize:12, color:"#9ca3af", marginBottom:14 }}>This position's price data couldn't be rendered.</div>
                <button onClick={() => setChartModal(null)} style={{ padding:"8px 14px", borderRadius:8, border:"1px solid #2a2a3a", background:"transparent", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>Close</button>
              </div>
            </div>
          }
        >
          <PositionChartModal position={chartModal.position} onClose={() => setChartModal(null)}/>
        </ChartErrorBoundary>
      )}

      {/* Close position dialog */}
      {closeFor && (() => {
        const liveCur = livePrices[closeFor.id] || closeFor._cur || closeFor.currentPrice || closeFor.entryPrice;
        const sym = (closeFor.symbol || '').toUpperCase();
        const exit = parseFloat(closePrice) || 0;
        const pnl = exit > 0 ? (exit - closeFor.entryPrice) * closeFor.amount : null;
        const pnlPct = exit > 0 ? ((exit / closeFor.entryPrice) - 1) * 100 : null;
        return (
          <div onClick={() => setCloseFor(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16, overflowY:"auto" }}>
            <div onClick={e => e.stopPropagation()} style={{ background:"#0f0f14", border:"1px solid #16161f", borderRadius:14, padding:20, width:"100%", maxWidth:440, color:"#fff", margin:"auto" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:18, fontWeight:800 }}>Close {sym} position</div>
                  <div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>{closeFor.name} · {closeFor.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} {sym}</div>
                </div>
                <button onClick={() => setCloseFor(null)} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer", fontSize:20, lineHeight:1 }}>×</button>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
                <div style={{ background:"#1a1a24", border:"1px solid #16161f", borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", fontWeight:700 }}>Entry price</div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#fff", marginTop:4 }}>{fmtUsd(closeFor.entryPrice, { maxFractionDigits: 6 })}</div>
                  <div style={{ fontSize:10, color:"#6b7280", marginTop:2 }}>locked</div>
                </div>
                <div style={{ background:"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.25)", borderRadius:8, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:"#a5b4fc", textTransform:"uppercase", fontWeight:700 }}>Current price</div>
                  <div style={{ fontSize:20, fontWeight:800, color:"#fff", marginTop:4 }}>{fmtUsd(liveCur, { maxFractionDigits: 6 })}</div>
                  <button
                    onClick={() => setClosePrice(String(liveCur))}
                    style={{ marginTop:4, padding:"2px 8px", fontSize:10, fontWeight:700, color:"#a5b4fc", background:"transparent", border:"1px solid rgba(99,102,241,0.4)", borderRadius:4, cursor:"pointer" }}
                  >Use current</button>
                </div>
              </div>

              {/* Mode toggle */}
              <div style={{ display:"flex", gap:6, marginBottom:14 }}>
                {[
                  { id:'full', label:'Close All' },
                  { id:'partial', label:'Partial Close' },
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setExitMode(m.id)}
                    style={{
                      flex:1, padding:"8px", borderRadius:8,
                      border:`1px solid ${exitMode === m.id ? '#6366f1' : '#16161f'}`,
                      background: exitMode === m.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                      color: exitMode === m.id ? '#a5b4fc' : '#9ca3af',
                      fontSize:12, fontWeight:700, cursor:'pointer',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {exitMode === 'partial' && (() => {
                const positionUSD = closeFor.entryPrice * closeFor.amount;
                const partialUSD = positionUSD * partialPercent / 100;
                const setPercent = (pct) => setPartialPercent(Math.min(95, Math.max(5, pct)));
                return (
                  <div style={{ marginBottom:14 }}>
                    <label style={{ fontSize:12, color:'#6b7280', display:'block', marginBottom:8 }}>
                      How much do you want to close?
                    </label>

                    <div style={{ marginBottom:8 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:12, color:'#6b7280' }}>Percentage</span>
                        <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{partialPercent}%</span>
                      </div>
                      <input
                        type="range" min={5} max={95} step={5} value={partialPercent}
                        onChange={e => setPercent(parseInt(e.target.value))}
                        style={{ width:'100%', accentColor:'#6366f1' }}
                      />
                      <div style={{ display:'flex', justifyContent:'space-between', marginTop:2 }}>
                        <span style={{ fontSize:10, color:'#6b7280' }}>5%</span>
                        <span style={{ fontSize:10, color:'#6b7280' }}>95%</span>
                      </div>
                    </div>

                    <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                      {[25, 50, 75].map(pct => (
                        <button key={pct} onClick={() => setPercent(pct)} style={{
                          flex:1, padding:'6px', borderRadius:6,
                          border:`1px solid ${partialPercent === pct ? '#6366f1' : '#16161f'}`,
                          background: partialPercent === pct ? 'rgba(99,102,241,0.15)' : 'transparent',
                          color: partialPercent === pct ? '#a5b4fc' : '#6b7280',
                          fontSize:12, fontWeight:700, cursor:'pointer',
                        }}>{pct}%</button>
                      ))}
                    </div>

                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:12, color:'#6b7280' }}>Or enter amount: $</span>
                      <input
                        type="number" value={partialUSD.toFixed(2)}
                        onChange={e => {
                          const usd = parseFloat(e.target.value) || 0;
                          if (positionUSD > 0) setPercent(Math.round((usd / positionUSD) * 100));
                        }}
                        style={{ width:100, padding:'6px 8px', borderRadius:6, border:'1px solid #16161f', background:'#1a1a24', color:'#fff', fontSize:13, outline:'none' }}
                      />
                    </div>

                    <div style={{ background:'#1a1a24', borderRadius:8, padding:12, marginTop:10 }}>
                      <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>Summary:</div>
                      <div style={{ fontSize:13, color:'#fff', marginBottom:2 }}>
                        Closing: <strong style={{ color:'#ef4444' }}>${(positionUSD * partialPercent / 100).toFixed(2)}</strong> ({partialPercent}% of position)
                      </div>
                      <div style={{ fontSize:13, color:'#fff' }}>
                        Keeping: <strong style={{ color:'#22c55e' }}>${(positionUSD * (100 - partialPercent) / 100).toFixed(2)}</strong> ({100 - partialPercent}% remains open)
                      </div>
                    </div>
                  </div>
                );
              })()}

              <label style={{ display:"block", fontSize:11, color:"#9ca3af", marginBottom:6, textTransform:"uppercase", fontWeight:700, letterSpacing:"0.04em" }}>Exit price (USD)</label>
              <input
                type="number" value={closePrice} onChange={e => setClosePrice(e.target.value)} placeholder="0.00"
                style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid #16161f", background:"#1a1a24", color:"#fff", fontSize:13, outline:"none", marginBottom:14 }}
              />

              {pnl != null && (() => {
                const shownPnl = exitMode === 'partial' ? pnl * (partialPercent / 100) : pnl;
                return (
                  <div style={{ padding:"12px 14px", background: shownPnl >= 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border:`1px solid ${shownPnl >= 0 ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`, borderRadius:8, marginBottom:14, fontSize:13, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ color:"#9ca3af", fontWeight:600 }}>
                      Estimated P&L{exitMode === 'partial' ? ` (on ${partialPercent}%)` : ''}
                    </span>
                    <span style={{ color: shownPnl >= 0 ? "#22c55e" : "#ef4444", fontWeight:800, fontSize:15 }}>{(shownPnl >= 0 ? '+' : '−')}{fmtUsd(Math.abs(shownPnl))} ({(pnlPct >= 0 ? '+' : '')}{pnlPct.toFixed(2)}%)</span>
                  </div>
                );
              })()}

              <label style={{ display:"block", fontSize:11, color:"#9ca3af", marginBottom:6, textTransform:"uppercase", fontWeight:700, letterSpacing:"0.04em" }}>Exit notes (optional)</label>
              <textarea
                value={closeNotes} onChange={e => setCloseNotes(e.target.value)}
                placeholder="Why are you selling? (target hit, thesis broken, profit-taking…)"
                rows={2}
                style={{ width:"100%", padding:"8px 12px", borderRadius:8, border:"1px solid #16161f", background:"#1a1a24", color:"#fff", fontSize:13, outline:"none", marginBottom:14, resize:"vertical", fontFamily:"inherit" }}
              />

              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => setCloseFor(null)} style={{ flex:1, padding:"10px", borderRadius:8, border:"1px solid #2a2a3a", background:"transparent", color:"#9ca3af", fontSize:13, fontWeight:700, cursor:"pointer" }}>Cancel</button>
                <button onClick={submitClose} disabled={!(exit > 0)} style={{ flex:1, padding:"10px", borderRadius:8, border:"none", background: exit > 0 ? "#ef4444" : "#2a2a3a", color:"#fff", fontSize:13, fontWeight:700, cursor: exit > 0 ? "pointer" : "not-allowed" }}>
                  {exitMode === 'partial' ? `Close ${partialPercent}% of Position` : 'Close Entire Position'} →
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function CreateAccountForm({ type, name, balance, onName, onBalance, onCancel, onSubmit }) {
  const canSubmit = name.trim().length > 0;
  return (
    <div style={{ background:"#0f0f14", border:"1px solid #16161f", borderRadius:10, padding:14, marginBottom:16 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
        <span style={{ fontSize:11, fontWeight:800, padding:"3px 8px", borderRadius:5, background: type === 'real' ? "rgba(34,197,94,0.18)" : "rgba(99,102,241,0.20)", color: type === 'real' ? "#22c55e" : "#a5b4fc", letterSpacing:"0.05em" }}>{type.toUpperCase()}</span>
        <span style={{ fontSize:13, fontWeight:700, color:"#fff" }}>New {type === 'real' ? 'real' : 'paper'} account</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr auto auto", gap:8 }}>
        <input value={name} onChange={e => onName(e.target.value)} placeholder="Account name (e.g. Main Portfolio)" style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #16161f", background:"#1a1a24", color:"#fff", fontSize:13, outline:"none" }}/>
        <input type="number" value={balance} onChange={e => onBalance(e.target.value)} placeholder="Starting balance USD" style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #16161f", background:"#1a1a24", color:"#fff", fontSize:13, outline:"none" }}/>
        <button onClick={onCancel} style={{ padding:"8px 14px", borderRadius:8, border:"1px solid #2a2a3a", background:"transparent", color:"#9ca3af", fontSize:12, fontWeight:700, cursor:"pointer" }}>Cancel</button>
        <button onClick={onSubmit} disabled={!canSubmit} style={{ padding:"8px 14px", borderRadius:8, border:"none", background: canSubmit ? "#6366f1" : "#2a2a3a", color:"#fff", fontSize:12, fontWeight:700, cursor: canSubmit ? "pointer" : "not-allowed" }}>Create</button>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background:"#0d0d12", border:"1px solid #16161f", borderRadius:10, padding:12 }}>
      <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.04em", fontWeight:700 }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:800, color: color || "#fff", marginTop:4 }}>{value}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CRYPTO DASHBOARD WRAPPER
// ═══════════════════════════════════════════════════════════════

export default function CryptoDashboard({ isAdmin, session }: { isAdmin: boolean, session: any }) {
  const [cryptoSection, setCryptoSection] = useState('hotnow');

  const [coinBot, setCoinBot] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('nexyru_coinbot') || '{}') } catch { return {} }
  })
  const [coinBotRunning, setCoinBotRunning] = React.useState(() => localStorage.getItem('nexyru_coinbot_running') === 'true')
  const [coinBotTrades, setCoinBotTrades] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('nexyru_coinbot_trades') || '[]') } catch { return [] }
  })
  const [coinBotTab, setCoinBotTab] = React.useState('strategy')
  const [coinBotAnalysis, setCoinBotAnalysis] = React.useState(null)
  const [coinBotAnalyzing, setCoinBotAnalyzing] = React.useState(false)

  const saveCoinBot = (updates) => {
    const updated = {...coinBot, ...updates}
    setCoinBot(updated)
    localStorage.setItem('nexyru_coinbot', JSON.stringify(updated))
  }

  const [savedCoinBots, setSavedCoinBots] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('nexyru_saved_coinbots') || '[]') } catch { return [] }
  })
  const [activeCoinBotId, setActiveCoinBotId] = React.useState(null)
  const [newBotName, setNewBotName] = React.useState('')

  const saveCoinBotConfig = () => {
    if (!newBotName.trim()) return
    const bot = {
      id: `coinbot_${Date.now()}`,
      name: newBotName.trim(),
      createdAt: new Date().toISOString(),
      running: false,
      trades: [],
      stats: { wins: 0, losses: 0, totalPnl: 0 },
      config: { ...coinBot }
    }
    const updated = [...savedCoinBots, bot]
    setSavedCoinBots(updated)
    localStorage.setItem('nexyru_saved_coinbots', JSON.stringify(updated))
    setNewBotName('')
    setActiveCoinBotId(bot.id)
  }

  const deleteSavedBot = (botId) => {
    const updated = savedCoinBots.filter(b => b.id !== botId)
    setSavedCoinBots(updated)
    localStorage.setItem('nexyru_saved_coinbots', JSON.stringify(updated))
    if (activeCoinBotId === botId) setActiveCoinBotId(null)
  }

  const loadBotConfig = (bot) => {
    setCoinBot(bot.config)
    localStorage.setItem('nexyru_coinbot', JSON.stringify(bot.config))
    setActiveCoinBotId(bot.id)
  }

  useEffect(() => {
    const saved = localStorage.getItem('nexyru_coinbot')
    if (!saved || Object.keys(JSON.parse(saved || '{}')).length === 0) {
      const defaults = {
        maxAge: '2 hours',
        minLiquidity: '$5,000',
        minBuyRatio: '55%',
        maxH24Pump: '300%',
        requireTwitter: 'Yes',
        takeProfitX: '3x',
        stopLossPct: '50%',
        maxPositionSize: '$100',
        extraRules: 'Only Solana. Skip if top holder > 20%. Prefer active buy pressure.',
        requiredSignals: ['Has Twitter', 'Buy ratio > 60%', 'Not already up 100%+', 'Liquidity > $10k'],
      }
      setCoinBot(defaults)
      localStorage.setItem('nexyru_coinbot', JSON.stringify(defaults))
    }
  }, [])

  const [cryptoRefreshKey, setCryptoRefreshKey] = useState(0);
  const [cryptoLastUpdated, setCryptoLastUpdated] = useState(null);
  const [, setCryptoTick] = useState(0);
  const [cryptoSignals, setCryptoSignals] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nexyru_crypto_signals') || '[]'); } catch { return []; }
  });
  const logCryptoSignal = useCallback((signal) => {
    setCryptoSignals(prev => {
      if (prev.some(s => s.coinId === signal.coinId)) return prev;
      const next = [signal, ...prev];
      try { localStorage.setItem('nexyru_crypto_signals', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  const [cryptoAccountStore, setCryptoAccountStore] = useState(loadCryptoAccountStore);
  const updateCryptoAccountStore = useCallback((next) => {
    setCryptoAccountStore(prev => {
      const updated = typeof next === 'function' ? next(prev) : next;
      persistCryptoAccountStore(updated);
      return updated;
    });
  }, []);
  const [buyModalCoin, setBuyModalCoin] = useState(null);
  const [buyModalLivePrice, setBuyModalLivePrice] = useState(null);

  const [dips, setDips] = useState<any[]>([])
  const [dipsLoading, setDipsLoading] = useState(false)
  const [dipsScanned, setDipsScanned] = useState(0)
  const [dipAnalysis, setDipAnalysis] = useState<Record<string,any>>({})
  const [dipAnalyzing, setDipAnalyzing] = useState<Record<string,boolean>>({})

  const fetchDips = async () => {
    setDipsLoading(true)
    try {
      // Use same gems API but filter for dip pattern
      const res = await fetch('/api/gems', { cache: 'no-store' })
      const data = await res.json()
      const allCoins = data.coins || []

      // Filter for dip bounce pattern: down in 6h but up in last 1h
      const dips = allCoins.filter((coin: any) => {
        const h1 = parseFloat(coin.priceChange?.h1 || 0)
        const h6 = parseFloat(coin.priceChange?.h6 || 0)
        const liq = parseFloat(coin.liquidity?.usd || 0)
        const vol24 = parseFloat(coin.volume?.h24 || 0)

        return (
          h6 < -5 &&        // Down in last 6 hours
          h1 > 0 &&         // But up in last 1 hour (bouncing)
          liq > 1000 &&     // Has liquidity
          vol24 > 500       // Has volume
        )
      }).map((coin: any) => {
        const h1 = parseFloat(coin.priceChange?.h1 || 0)
        const h6 = parseFloat(coin.priceChange?.h6 || 0)
        const liq = parseFloat(coin.liquidity?.usd || 0)
        const vol24 = parseFloat(coin.volume?.h24 || 0)
        const buyRatio = coin.buyRatio || 0.5

        // Score the dip
        let score = 0

        // Bounce strength (40pts)
        if (h1 > 20) score += 40
        else if (h1 > 10) score += 30
        else if (h1 > 5) score += 20
        else if (h1 > 2) score += 12
        else score += 5

        // Dip size (30pts) - bigger dip = more room to recover
        const dip = Math.abs(h6)
        if (dip > 50) score += 30
        else if (dip > 30) score += 22
        else if (dip > 15) score += 14
        else if (dip > 5) score += 8

        // Buy pressure (20pts)
        if (buyRatio > 0.65) score += 20
        else if (buyRatio > 0.55) score += 14
        else if (buyRatio > 0.45) score += 8

        // Volume + liquidity (10pts)
        if (vol24 > 50000) score += 10
        else if (vol24 > 10000) score += 6
        else if (vol24 > 1000) score += 3

        const dipLabel = dip > 50 ? 'Big dip -' + dip.toFixed(0) + '%'
          : dip > 30 ? 'Medium dip -' + dip.toFixed(0) + '%'
          : 'Small dip -' + dip.toFixed(0) + '%'

        const recoveryLabel = h1 > 20 ? 'Strong bounce +' + h1.toFixed(0) + '%'
          : h1 > 10 ? 'Good bounce +' + h1.toFixed(0) + '%'
          : h1 > 5 ? 'Recovering +' + h1.toFixed(0) + '%'
          : 'Just turned green +' + h1.toFixed(1) + '%'

        return {
          ...coin,
          score: Math.min(100, score),
          h1, h6,
          vol: vol24,
          liq,
          dipLabel,
          recoveryLabel,
        }
      }).sort((a: any, b: any) => b.score - a.score)

      console.log('Dip coins found:', dips.length, 'from', allCoins.length, 'total')
      setDips(dips)
    } catch(e: any) {
      console.error('fetchDips error:', e)
    }
    setDipsLoading(false)
  }

  const analyzeDip = async (coin: any) => {
    const id = coin.baseToken?.address || coin.pairAddress
    if (dipAnalyzing[id] || dipAnalysis[id]) return
    setDipAnalyzing(prev => ({...prev, [id]: true}))
    try {
      const res = await fetch('/api/analyze-game', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          team1: 'BUY',
          team2: 'SKIP',
          sport: 'CRYPTO_DIP',
          odds1: 0, odds2: 0,
          gameTime: 'Now',
          context: `Meme coin dip analysis. Coin: ${coin.name} (${coin.symbol}) on ${coin.chain}. Down ${coin.pullback.toFixed(0)}% in 24h. Last 1h: ${coin.h1 > 0 ? '+' : ''}${coin.h1.toFixed(1)}%. Volume 24h: $${(coin.vol/1000).toFixed(0)}k. Liquidity: $${(coin.liq/1000).toFixed(0)}k. Buy ratio last hour: ${Math.round(coin.buyRatio*100)}% buys. Score: ${coin.score}/100. Is this a good dip to buy — is it recovering or still falling? Reply with pick BUY, SKIP, or WATCH.`
        })
      })
      const data = await res.json()
      setDipAnalysis(prev => ({...prev, [id]: data}))
    } catch(e) {}
    setDipAnalyzing(prev => ({...prev, [id]: false}))
  }

  useEffect(() => {
    if (cryptoSection === 'dipfinder') fetchDips()
  }, [cryptoSection])

  useEffect(() => {
    if (!buyModalCoin) return;
    let cancelled = false;
    setBuyModalLivePrice(null);
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(buyModalCoin.coinId)}&vs_currencies=usd`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        const p = d?.[buyModalCoin.coinId]?.usd;
        if (typeof p === 'number') setBuyModalLivePrice(p);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [buyModalCoin]);

  const handleConfirmBuy = useCallback(({ accountId, usdAmount, price, notes, targetPct, stopLossPct }) => {
    if (!buyModalCoin) return;
    setCryptoAccountStore(prev => {
      const next = buyPositionInAccount(prev, accountId, {
        coinId: buyModalCoin.coinId,
        name: buyModalCoin.name,
        symbol: buyModalCoin.symbol,
        chain: buyModalCoin.chain || null,
        pairAddress: buyModalCoin.pairAddress || null,
        dexUrl: buyModalCoin.dexUrl || null,
      }, usdAmount, price, { notes, targetPct, stopLossPct });
      persistCryptoAccountStore(next);
      return next;
    });
    const sym = (buyModalCoin.symbol || buyModalCoin.name || '').toUpperCase();
    try { toast(`Bought ${sym} for ${fmtUsd(usdAmount)}`, 'success'); } catch {}
    if ((targetPct != null && targetPct > 0) || (stopLossPct != null && stopLossPct > 0)) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        try { Notification.requestPermission().catch(() => {}); } catch {}
      }
    }
    setBuyModalCoin(null);
  }, [buyModalCoin]);

  useEffect(() => { setCryptoLastUpdated(null); }, [cryptoSection]);
  useEffect(() => {
    const id = setInterval(() => setCryptoTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const cryptoSectionLabel = {
    hotnow:    "What's trending across the market right now (auto-refresh 3m)",
    gems:      'Find meme coins BEFORE they pump — early signals only',
    dipfinder: 'Down in the last 4-6 hours but recovering in the last hour — buy the bounce',
    uptrends:  'Top 100 coins on a confirmed uptrend across 1h / 24h / 7d',
    accounts:  'Paper & real account portfolios',
    mystats:   'Aggregate stats across all your accounts',
  }[cryptoSection] || cryptoSection;

  const cryptoSignalsRef = useRef(cryptoSignals);
  const cryptoAccountStoreRef = useRef(cryptoAccountStore);
  useEffect(() => { cryptoSignalsRef.current = cryptoSignals; }, [cryptoSignals]);
  useEffect(() => { cryptoAccountStoreRef.current = cryptoAccountStore; }, [cryptoAccountStore]);
  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    const check = async () => {
      const sigs = cryptoSignalsRef.current || [];
      const store = cryptoAccountStoreRef.current || { accounts: [] };
      const watchSigs = sigs.filter(s =>
        !s.didTake && s.priceAtSignal > 0 &&
        ((s.targetGain && !s.targetHitNotified) || (s.stopLoss && !s.stopHitNotified))
      );
      const watchPositions = [];
      for (const acc of store.accounts || []) {
        for (const pos of acc.positions || []) {
          if (pos.status !== 'open') continue;
          if (!(pos.alertTarget || pos.alertStop)) continue;
          if (pos.targetHitNotified && pos.stopHitNotified) continue;
          if ((pos.alertTarget && pos.targetHitNotified) && (!pos.alertStop || pos.stopHitNotified)) continue;
          watchPositions.push({ accountId: acc.id, pos });
        }
      }
      if (watchSigs.length === 0 && watchPositions.length === 0) return;
      try {
        const idSet = new Set();
        watchSigs.forEach(s => idSet.add(s.coinId));
        watchPositions.forEach(({ pos }) => idSet.add(pos.coinId));
        const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent([...idSet].join(','))}&vs_currencies=usd`);
        const d = await r.json();
        if (!d) return;

        const sigPatches = new Map();
        for (const s of watchSigs) {
          const cur = d[s.coinId]?.usd;
          if (typeof cur !== 'number') continue;
          const change = ((cur / s.priceAtSignal) - 1) * 100;
          let patch = sigPatches.get(s.id) || {};
          if (s.targetGain && !s.targetHitNotified && change >= s.targetGain) {
            if (Notification.permission === 'granted') {
              try { new Notification(`${s.name} hit +${s.targetGain}% target`, { body: `Consider taking profit. Current $${cur}` }); } catch {}
            }
            patch.targetHitNotified = true;
          }
          if (s.stopLoss && !s.stopHitNotified && change <= -s.stopLoss) {
            if (Notification.permission === 'granted') {
              try { new Notification(`${s.name} hit −${s.stopLoss}% stop loss`, { body: `Consider cutting losses. Current $${cur}` }); } catch {}
            }
            patch.stopHitNotified = true;
          }
          if (Object.keys(patch).length > 0) sigPatches.set(s.id, patch);
        }
        if (sigPatches.size > 0) {
          setCryptoSignals(prev => {
            const next = prev.map(s => sigPatches.has(s.id) ? { ...s, ...sigPatches.get(s.id) } : s);
            try { localStorage.setItem('nexyru_crypto_signals', JSON.stringify(next)); } catch {}
            return next;
          });
        }

        const posPatches = new Map();
        for (const { pos } of watchPositions) {
          const cur = d[pos.coinId]?.usd;
          if (typeof cur !== 'number') continue;
          const change = ((cur / pos.entryPrice) - 1) * 100;
          let patch = posPatches.get(pos.id) || {};
          if (pos.alertTarget && !pos.targetHitNotified && change >= pos.alertTarget) {
            if (Notification.permission === 'granted') {
              try { new Notification(`${(pos.symbol || pos.name)} hit +${pos.alertTarget}% target`, { body: `Consider taking profit. Current $${cur}` }); } catch {}
            }
            patch.targetHitNotified = true;
          }
          if (pos.alertStop && !pos.stopHitNotified && change <= -pos.alertStop) {
            if (Notification.permission === 'granted') {
              try { new Notification(`${(pos.symbol || pos.name)} hit −${pos.alertStop}% stop`, { body: `Consider cutting losses. Current $${cur}` }); } catch {}
            }
            patch.stopHitNotified = true;
          }
          if (Object.keys(patch).length > 0) posPatches.set(pos.id, patch);
        }
        if (posPatches.size > 0) {
          setCryptoAccountStore(prev => {
            const next = {
              ...prev,
              accounts: (prev.accounts || []).map(acc => ({
                ...acc,
                positions: (acc.positions || []).map(p => posPatches.has(p.id) ? { ...p, ...posPatches.get(p.id) } : p),
              })),
            };
            persistCryptoAccountStore(next);
            return next;
          });
        }
      } catch {}
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  const formatRelative = (ts) => {
    if (!ts) return '—';
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 5) return 'just now';
    if (d < 60) return d + 's ago';
    if (d < 3600) return Math.floor(d/60) + 'm ago';
    return Math.floor(d/3600) + 'h ago';
  };

  const [bannerOffset, setBannerOffset] = useState(0);
  useEffect(() => {
    try {
      setBannerOffset(localStorage.getItem("nexyru_beta_banner_dismissed") === "1" ? 0 : 28);
    } catch {}
  }, []);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const cryptoMobileItems = [
    { id: 'hotnow',    Icon: Activity,     label: 'Hot' },
    { id: 'gems',      Icon: Target,       label: 'Sniper' },
    { id: 'dipfinder', Icon: TrendingDown, label: 'Dips' },
    { id: 'uptrends',  Icon: TrendingUp,   label: 'Trends' },
    { id: 'accounts',  Icon: Wallet,       label: 'Accounts' },
    { id: 'mystats',   Icon: BarChart2,    label: 'Stats' },
  ];

  return (
    <>
      {buyModalCoin && <CryptoBuyModal coin={buyModalCoin} livePrice={buyModalLivePrice} store={cryptoAccountStore} onClose={() => setBuyModalCoin(null)} onConfirm={handleConfirmBuy}/>}

      <aside className="hide-mobile" style={{ position:"fixed", top:bannerOffset, left:0, bottom:0, width:56, background:'#0a0a0f', borderRight:'1px solid #16161f', display:'flex', flexDirection:'column', paddingTop:16, flexShrink:0, zIndex:50 }}>
        {[
          {id:'hotnow',    label:'Hot Now',     Icon: Activity},
          {id:'gems',      label:'Coin Sniper', Icon: Target},
          {id:'coinbot',   label:'Coin Bot',    Icon: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/></svg>},
          {id:'dipfinder', label:'Dip Finder',  Icon: TrendingDown},
          {id:'uptrends',  label:'Uptrends',    Icon: TrendingUp},
          {id:'accounts',  label:'Accounts',    Icon: Wallet},
          {id:'mystats',   label:'My Stats',    Icon: BarChart2},
        ].map(s=>(
          <div key={s.id} onClick={()=>setCryptoSection(s.id)} title={s.label} style={{
            width:56, height:48, display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', color: cryptoSection===s.id ? '#6366f1' : '#6b7280',
            background: cryptoSection===s.id ? 'rgba(99,102,241,0.08)' : 'transparent',
            borderLeft: cryptoSection===s.id ? '2px solid #6366f1' : '2px solid transparent',
            transition:'all 0.15s', marginBottom:4
          }}><s.Icon size={18}/></div>
        ))}
      </aside>

      <header style={{
        background:"rgba(8,8,8,0.95)", backdropFilter:"blur(12px)", borderBottom:"1px solid #16161f",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding: isMobile ? '12px 16px' : '14px 24px', gap:12, position:"sticky", top:bannerOffset, zIndex:100,
        marginLeft: isMobile ? 0 : 56,
      }}>
        <div style={{ fontSize:15, fontWeight:800, color:'#fff', letterSpacing:'-0.02em', whiteSpace:"nowrap" }}>
          Nexyru
        </div>
        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
          {[
            { href:'/dashboard', label:'Trading', active:false },
            { href:'/crypto',    label:'Crypto',  active:true  },
            { href:'/sports',    label:'Sports',  active:false },
            { href:'/options',   label:'Options', active:false },
            { href:'/airdrops',  label:'Airdrops', active:false },
            { href:'/productlab', label:'Product Lab', active:false },
          ].map(l => (
            <a key={l.href} href={l.href} style={{
              padding:'6px 14px', fontSize:13,
              color: l.active ? '#ffffff' : '#6b7280',
              textDecoration:'none', whiteSpace:'nowrap',
              fontWeight: l.active ? 700 : 500,
              borderBottom: l.active ? '2px solid #6366f1' : '2px solid transparent',
              transition:'color 0.15s'
            }}>{l.label}</a>
          ))}
        </div>
        <a href="/morning" style={{padding:'6px 12px', borderRadius:6, border:'1px solid #1e1e2a', background:'transparent', color:'#6b7280', fontSize:12, fontWeight:600, textDecoration:'none'}}>Briefing</a>
      </header>

      <div style={{ flex:1, padding: isMobile ? 12 : 24, overflowY:"auto", marginLeft: isMobile ? 0 : 80, paddingBottom: isMobile ? 80 : 0 }}>
        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom: isMobile ? 12 : 20, gap: isMobile ? 8 : 16, flexWrap:"wrap" }}>
          <div>
            <div style={{ fontSize: isMobile ? 16 : 22, fontWeight:800, color:"#fff", letterSpacing:"-0.01em" }}>Crypto</div>
            {!isMobile && <div style={{ fontSize:13, color:"#6b7280", marginTop:2 }}>{cryptoSectionLabel}</div>}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap: isMobile ? 6 : 12 }}>
            {!isMobile && (
              <span style={{ fontSize:11, color:"#6b7280" }}>
                {cryptoLastUpdated ? 'Last updated ' + formatRelative(cryptoLastUpdated) : 'Loading…'}
              </span>
            )}
            <button
              onClick={() => setCryptoRefreshKey(k => k + 1)}
              style={{
                display:"flex", alignItems:"center", gap:6,
                padding: isMobile ? "8px 12px" : "9px 18px", borderRadius:8, border:"none",
                background:"#6366f1", color:"#fff", fontSize:13, fontWeight:700,
                cursor:"pointer", letterSpacing:"-0.01em", transition:"all 0.15s"
              }}
            ><RefreshCw size={14}/> Refresh</button>
          </div>
        </div>
        {cryptoSection === 'hotnow'    && <ChartErrorBoundary resetKey="hotnow"><CryptoHotNow    refreshKey={cryptoRefreshKey} onUpdated={setCryptoLastUpdated} signals={cryptoSignals} onLogSignal={logCryptoSignal} onBuy={setBuyModalCoin} /></ChartErrorBoundary>}
        {cryptoSection === 'gems'      && <ChartErrorBoundary resetKey="gems"><CryptoGems      refreshKey={cryptoRefreshKey} onUpdated={setCryptoLastUpdated} signals={cryptoSignals} onLogSignal={logCryptoSignal} onBuy={setBuyModalCoin} /></ChartErrorBoundary>}
        {cryptoSection === 'dipfinder' && (
          <div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:8}}>
              <div>
                <div style={{display:'flex', alignItems:'center', gap:8, fontSize:22, fontWeight:800, letterSpacing:'-0.02em', marginBottom:4}}>
                  <TrendingDown size={22}/> Dip Finder
                </div>
                <div style={{fontSize:13, color:'#d1d5db', lineHeight:1.6}}>Down in the last 4-6 hours but recovering in the last hour — buy the bounce</div>
              </div>
              <button onClick={fetchDips} disabled={dipsLoading} style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'9px 18px', borderRadius:8, border:'none',
                background:'#6366f1', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
                transition:'all 0.15s'
              }}>
                <RefreshCw size={14}/>
                {dipsLoading ? 'Scanning...' : 'Refresh'}
              </button>
            </div>

            <div style={{background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:12, padding:14, marginBottom:16, fontSize:13, color:'#a5b4fc', lineHeight:1.6, display:'flex', alignItems:'flex-start', gap:8}}>
              <Zap size={14} style={{flexShrink:0, marginTop:2}}/>
              <div><strong>Strategy:</strong> These coins dipped recently but are now bouncing back up in the last hour. The dip already happened — you're buying the recovery. Look for strong 1h bounce + healthy volume.</div>
            </div>

            {dipsLoading ? (
              <div style={{textAlign:'center', padding:48, color:'#6b7280'}}>
                <RefreshCw size={32} style={{marginBottom:12, opacity:0.5}}/>
                <div style={{fontSize:16, fontWeight:700}}>Scanning for dips...</div>
              </div>
            ) : dips.length === 0 && !dipsLoading ? (
              <div style={{background:'#111', border:'1px solid #1e1e2a', borderRadius:12, padding:32, textAlign:'center'}}>
                <div style={{fontSize:32, marginBottom:12}}>📈</div>
                <div style={{fontSize:15, fontWeight:700, color:'#fff', marginBottom:8}}>No dip bounces right now</div>
                <div style={{fontSize:13, color:'#6b7280', marginBottom:16, lineHeight:1.6}}>
                  Looking for coins that dropped in the last 6 hours but are now recovering.<br/>
                  Market might be trending up — check back after a selloff.
                </div>
                <button onClick={fetchDips} style={{
                  padding:'10px 24px', borderRadius:8, border:'none',
                  background:'#6366f1', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer'
                }}>
                  Scan Again
                </button>
              </div>
            ) : (
              <div>
                <div style={{fontSize:13, color:'#6b7280', marginBottom:16}}>
                  {dips.length} bounce candidates found from {dipsScanned}+ coins scanned
                </div>

                {dips.map(coin => {
                  const id = coin.baseToken?.address || coin.pairAddress
                  const ai = dipAnalysis[id]
                  const isAnalyzing = dipAnalyzing[id]

                  return (
                    <div key={id} style={{
                      background:'#0d0d12',
                      border:`1px solid ${(coin.profitScore || coin.score || coin.gemScore) >= 70 ? 'rgba(99,102,241,0.4)' : (coin.profitScore || coin.score || coin.gemScore) >= 50 ? 'rgba(245,158,11,0.3)' : '#16161f'}`,
                      borderRadius:12, padding:16, marginBottom:12
                    }}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10}}>
                        <div style={{display:'flex', alignItems:'center', gap:10}}>
                          {coin.info?.imageUrl && <img src={coin.info.imageUrl} style={{width:32, height:32, borderRadius:'50%'}} alt="" onError={e => (e.currentTarget.style.display='none')}/>}
                          <div>
                            <div style={{fontSize:15, fontWeight:800}}>{coin.name}</div>
                            <div style={{fontSize:11, color:'#6b7280'}}>{coin.symbol} · {coin.chain?.toUpperCase()}</div>
                          </div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:24, fontWeight:900, color: (coin.profitScore || coin.score || coin.gemScore) >= 70 ? '#6366f1' : (coin.profitScore || coin.score || coin.gemScore) >= 50 ? '#f59e0b' : '#6b7280'}}>
                            {coin.profitScore || coin.score || coin.gemScore}
                          </div>
                          <div style={{fontSize:10, color:'#6b7280'}}>/100</div>
                        </div>
                      </div>

                      <PriceChangeRow priceChange={coin.priceChange} />

                      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:12}}>
                        {[
                          {label:'24H DIP', value:`${coin.h24.toFixed(0)}%`, color:'#ef4444'},
                          {label:'1H NOW', value:`${coin.h1 > 0 ? '+' : ''}${coin.h1.toFixed(1)}%`, color: coin.h1 > 0 ? '#22c55e' : coin.h1 > -5 ? '#f59e0b' : '#ef4444'},
                          {label:'LIQUIDITY', value:`$${coin.liq >= 1000 ? (coin.liq/1000).toFixed(0)+'k' : coin.liq.toFixed(0)}`, color:'#fff'},
                          {label:'BUY %', value:`${Math.round(coin.buyRatio*100)}%`, color: coin.buyRatio > 0.6 ? '#22c55e' : coin.buyRatio > 0.45 ? '#f59e0b' : '#ef4444'},
                        ].map(s => (
                          <div key={s.label} style={{background:'#1a1a24', borderRadius:6, padding:8, textAlign:'center'}}>
                            <div style={{fontSize:9, color:'#6b7280', marginBottom:2}}>{s.label}</div>
                            <div style={{fontSize:13, fontWeight:700, color:s.color}}>{s.value}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{display:'flex', gap:6, marginBottom:10, flexWrap:'wrap'}}>
                        <span style={{fontSize:11, padding:'3px 8px', borderRadius:4, background:'rgba(239,68,68,0.1)', color:'#ef4444', fontWeight:600}}>
                          {coin.dipLabel}
                        </span>
                        <span style={{fontSize:11, padding:'3px 8px', borderRadius:4, background: coin.h1 > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)', color: coin.h1 > 0 ? '#22c55e' : '#6b7280', fontWeight:600}}>
                          {coin.recoveryLabel}
                        </span>
                        <span style={{fontSize:11, padding:'3px 8px', borderRadius:4, background:'rgba(99,102,241,0.08)', color:'#a5b4fc'}}>
                          Vol: ${coin.vol >= 1000 ? (coin.vol/1000).toFixed(0)+'k' : coin.vol.toFixed(0)}
                        </span>
                      </div>

                      {ai && (
                        <div style={{
                          background: ai.pick==='BUY' ? 'rgba(34,197,94,0.08)' : ai.pick==='WATCH' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
                          border:`1px solid ${ai.pick==='BUY' ? 'rgba(34,197,94,0.3)' : ai.pick==='WATCH' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
                          borderRadius:8, padding:10, marginBottom:10
                        }}>
                          <div style={{fontSize:13, fontWeight:800, color: ai.pick==='BUY'?'#22c55e':ai.pick==='WATCH'?'#f59e0b':'#ef4444', marginBottom:4}}>
                            {ai.pick==='BUY'?'Buy the dip':ai.pick==='WATCH'?'Wait for confirmation':'Skip — still falling'}
                          </div>
                          <div style={{fontSize:12, color:'#d1d5db'}}>{ai.reasoning}</div>
                        </div>
                      )}

                      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6}}>
                        {!ai ? (
                          <button onClick={() => analyzeDip(coin)} disabled={isAnalyzing} style={{
                            gridColumn:'1', padding:'8px', borderRadius:8,
                            border:'1px solid rgba(99,102,241,0.4)',
                            background:'rgba(99,102,241,0.08)',
                            color: isAnalyzing ? '#4b5563' : '#a5b4fc',
                            fontSize:11, fontWeight:700, cursor:'pointer'
                          }}>
                            {isAnalyzing ? 'Analyzing...' : 'AI Analysis'}
                          </button>
                        ) : (
                          <div/>
                        )}

                        <button onClick={() => {
                          const price = parseFloat(coin.priceUsd || coin.price || '0')
                          setBuyModalCoin({
                            ...coin,
                            id: id,
                            coinId: id,
                            price,
                            priceUsd: String(price),
                            source: 'dexscreener',
                          })
                          setBuyModalLivePrice(price)
                        }} style={{
                          padding:'8px', borderRadius:8, border:'none',
                          background:'rgba(99,102,241,0.2)', color:'#a5b4fc',
                          fontSize:11, fontWeight:700, cursor:'pointer'
                        }}>
                           Paper
                        </button>

                        <button onClick={() => {
                          navigator.clipboard.writeText(id)
                          window.open('https://fomo.family/r/al1valol', '_blank')
                          const toast = document.createElement('div')
                          toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1a1a2e;border:1px solid #6366f1;color:#fff;padding:10px 16px;borderRadius:8px;fontSize:12px;zIndex:9999'
                          toast.innerHTML = 'CA copied! Paste in FOMO'
                          document.body.appendChild(toast)
                          setTimeout(() => toast.remove(), 3000)
                        }} style={{
                          padding:'8px', borderRadius:8,
                          border:'1px solid rgba(99,102,241,0.3)',
                          background:'rgba(99,102,241,0.08)',
                          color:'#a5b4fc', fontSize:11, fontWeight:700, cursor:'pointer'
                        }}>
                           FOMO
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        {cryptoSection === 'uptrends'  && <ChartErrorBoundary resetKey="uptrends"><CryptoUptrends  refreshKey={cryptoRefreshKey} onUpdated={setCryptoLastUpdated} onBuy={setBuyModalCoin} /></ChartErrorBoundary>}
        {cryptoSection === 'accounts'  && <ChartErrorBoundary resetKey={`accounts:${cryptoAccountStore?.activeAccountId ?? 'none'}`} fallback={<div style={{ padding:32, color:'#9ca3af', background:'#0d0d12', border:'1px solid #16161f', borderRadius:12, fontSize:13, textAlign:'center' }}>Error loading accounts. Refresh the page or pick a different account.</div>}><CryptoAccounts  refreshKey={cryptoRefreshKey} onUpdated={setCryptoLastUpdated} store={cryptoAccountStore} onUpdate={updateCryptoAccountStore} onRequestBuy={setBuyModalCoin} /></ChartErrorBoundary>}
        {cryptoSection === 'mystats'   && <ChartErrorBoundary resetKey="mystats"><CryptoMyStats   refreshKey={cryptoRefreshKey} onUpdated={setCryptoLastUpdated} store={cryptoAccountStore} /></ChartErrorBoundary>}

        {cryptoSection === 'coinbot' && (
          <div style={{maxWidth:800, margin:'0 auto'}}>

            <div style={{marginBottom:24}}>
              <div style={{fontSize:22, fontWeight:800, color:'#fff', letterSpacing:'-0.02em', marginBottom:4}}>
                Meme Coin Bot
              </div>
              <div style={{fontSize:13, color:'#6b7280'}}>
                Define your snipe strategy, backtest against past coins, and let the bot auto-paper-trade new launches
              </div>
            </div>

            {/* Sub tabs */}
            <div style={{display:'flex', gap:4, marginBottom:24, borderBottom:'1px solid #1e1e2a', paddingBottom:0}}>
              {[
                {id:'strategy', label:'Strategy'},
                {id:'backtest', label:'Backtest'},
                {id:'bot', label:'Auto Bot'},
                {id:'performance', label:'Performance'},
              ].map(t => (
                <button key={t.id} onClick={() => setCoinBotTab(t.id)} style={{
                  padding:'8px 16px', border:'none', background:'transparent',
                  color: coinBotTab===t.id ? '#fff' : '#6b7280',
                  fontSize:13, fontWeight: coinBotTab===t.id ? 700 : 500,
                  cursor:'pointer', borderBottom: coinBotTab===t.id ? '2px solid #6366f1' : '2px solid transparent',
                  marginBottom:-1
                }}>{t.label}</button>
              ))}
            </div>

            {/* STRATEGY TAB */}
            {coinBotTab === 'strategy' && (
              <div>
                <div style={{fontSize:13, color:'#6b7280', marginBottom:20, lineHeight:1.6}}>
                  Define the rules the bot uses to decide which coins to paper trade and when to exit.
                </div>

                {/* Max Age */}
                <div style={{marginBottom:16}}>
                  <label style={{display:'block', fontSize:13, fontWeight:700, color:'#fff', marginBottom:3}}>Maximum coin age to enter?</label>
                  <div style={{fontSize:11, color:'#4b5563', marginBottom:6}}>Bot will ignore coins older than this</div>
                  <select value={coinBot.maxAge || '2'} onChange={e => saveCoinBot({maxAge: e.target.value})}
                    style={{width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #1e1e2a', background:'#1a1a24', color:'#fff', fontSize:13, outline:'none'}}>
                    <option value="0.5">30 minutes — ultra fresh only</option>
                    <option value="1">1 hour</option>
                    <option value="2">2 hours (recommended)</option>
                    <option value="4">4 hours</option>
                    <option value="6">6 hours</option>
                    <option value="12">12 hours</option>
                    <option value="24">24 hours</option>
                  </select>
                </div>

                {/* Min Liquidity */}
                <div style={{marginBottom:16}}>
                  <label style={{display:'block', fontSize:13, fontWeight:700, color:'#fff', marginBottom:3}}>Minimum liquidity required?</label>
                  <div style={{fontSize:11, color:'#4b5563', marginBottom:6}}>Skip coins with less liquidity than this</div>
                  <select value={coinBot.minLiquidity || '5000'} onChange={e => saveCoinBot({minLiquidity: e.target.value})}
                    style={{width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #1e1e2a', background:'#1a1a24', color:'#fff', fontSize:13, outline:'none'}}>
                    <option value="1000">$1,000 — accept almost anything</option>
                    <option value="3000">$3,000</option>
                    <option value="5000">$5,000 (recommended)</option>
                    <option value="10000">$10,000 — safer entries</option>
                    <option value="20000">$20,000 — conservative</option>
                    <option value="50000">$50,000 — very safe only</option>
                  </select>
                </div>

                {/* Min Buy Ratio */}
                <div style={{marginBottom:16}}>
                  <label style={{display:'block', fontSize:13, fontWeight:700, color:'#fff', marginBottom:3}}>Minimum buy pressure?</label>
                  <div style={{fontSize:11, color:'#4b5563', marginBottom:6}}>Only enter when this % of transactions are buys</div>
                  <select value={coinBot.minBuyRatio || '55'} onChange={e => saveCoinBot({minBuyRatio: e.target.value})}
                    style={{width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #1e1e2a', background:'#1a1a24', color:'#fff', fontSize:13, outline:'none'}}>
                    <option value="45">45% — allow slight sell pressure</option>
                    <option value="50">50% — balanced</option>
                    <option value="55">55% (recommended)</option>
                    <option value="60">60% — clear buy pressure</option>
                    <option value="65">65% — strong buyers only</option>
                    <option value="70">70% — very aggressive buying only</option>
                  </select>
                </div>

                {/* Max 24h Pump */}
                <div style={{marginBottom:16}}>
                  <label style={{display:'block', fontSize:13, fontWeight:700, color:'#fff', marginBottom:3}}>Maximum 24h pump allowed?</label>
                  <div style={{fontSize:11, color:'#4b5563', marginBottom:6}}>Skip coins already up more than this in 24h</div>
                  <select value={coinBot.maxH24Pump || '300'} onChange={e => saveCoinBot({maxH24Pump: e.target.value})}
                    style={{width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #1e1e2a', background:'#1a1a24', color:'#fff', fontSize:13, outline:'none'}}>
                    <option value="50">50% — only barely moved coins</option>
                    <option value="100">100% — under 2x</option>
                    <option value="200">200%</option>
                    <option value="300">300% (recommended)</option>
                    <option value="500">500% — allow big pumps</option>
                    <option value="1000">1000% — anything goes</option>
                  </select>
                </div>

                {/* Take Profit */}
                <div style={{marginBottom:16}}>
                  <label style={{display:'block', fontSize:13, fontWeight:700, color:'#fff', marginBottom:3}}>Take profit target?</label>
                  <div style={{fontSize:11, color:'#4b5563', marginBottom:6}}>Exit when coin reaches this multiplier from entry</div>
                  <select value={coinBot.takeProfitX || '3'} onChange={e => saveCoinBot({takeProfitX: e.target.value})}
                    style={{width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #1e1e2a', background:'#1a1a24', color:'#fff', fontSize:13, outline:'none'}}>
                    <option value="1.5">1.5x — quick 50% profit</option>
                    <option value="2">2x — double your money</option>
                    <option value="3">3x (recommended)</option>
                    <option value="5">5x — moonshot target</option>
                    <option value="10">10x — high risk high reward</option>
                    <option value="20">20x — lottery ticket</option>
                  </select>
                </div>

                {/* Stop Loss */}
                <div style={{marginBottom:16}}>
                  <label style={{display:'block', fontSize:13, fontWeight:700, color:'#fff', marginBottom:3}}>Stop loss?</label>
                  <div style={{fontSize:11, color:'#4b5563', marginBottom:6}}>Exit if coin drops this much from entry price</div>
                  <select value={coinBot.stopLossPct || '50'} onChange={e => saveCoinBot({stopLossPct: e.target.value})}
                    style={{width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #1e1e2a', background:'#1a1a24', color:'#fff', fontSize:13, outline:'none'}}>
                    <option value="20">20% — very tight stop</option>
                    <option value="30">30% — tight stop</option>
                    <option value="40">40%</option>
                    <option value="50">50% (recommended)</option>
                    <option value="60">60% — loose stop</option>
                    <option value="75">75% — very loose</option>
                  </select>
                </div>

                {/* Position Size */}
                <div style={{marginBottom:16}}>
                  <label style={{display:'block', fontSize:13, fontWeight:700, color:'#fff', marginBottom:3}}>Paper trade size per coin?</label>
                  <div style={{fontSize:11, color:'#4b5563', marginBottom:6}}>Simulated money per trade</div>
                  <select value={coinBot.maxPositionSize || '100'} onChange={e => saveCoinBot({maxPositionSize: e.target.value})}
                    style={{width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #1e1e2a', background:'#1a1a24', color:'#fff', fontSize:13, outline:'none'}}>
                    <option value="25">$25 per trade</option>
                    <option value="50">$50 per trade</option>
                    <option value="100">$100 per trade (recommended)</option>
                    <option value="250">$250 per trade</option>
                    <option value="500">$500 per trade</option>
                    <option value="1000">$1,000 per trade</option>
                  </select>
                </div>

                {/* Require Twitter */}
                <div style={{marginBottom:16}}>
                  <label style={{display:'block', fontSize:13, fontWeight:700, color:'#fff', marginBottom:3}}>Require social presence?</label>
                  <div style={{fontSize:11, color:'#4b5563', marginBottom:6}}>Filter out coins with no Twitter or Telegram</div>
                  <select value={coinBot.requireTwitter || 'yes'} onChange={e => saveCoinBot({requireTwitter: e.target.value})}
                    style={{width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #1e1e2a', background:'#1a1a24', color:'#fff', fontSize:13, outline:'none'}}>
                    <option value="yes">Yes — must have Twitter or Telegram</option>
                    <option value="twitter">Twitter only</option>
                    <option value="telegram">Telegram only</option>
                    <option value="both">Both Twitter AND Telegram</option>
                    <option value="no">No — show all coins</option>
                  </select>
                </div>

                {/* Signal checklist */}
                <div style={{marginBottom:20}}>
                  <label style={{display:'block', fontSize:13, fontWeight:700, color:'#fff', marginBottom:4}}>
                    Required signals for entry
                  </label>
                  <div style={{fontSize:11, color:'#4b5563', marginBottom:8}}>Bot will only enter when ALL selected signals are present</div>
                  <div style={{display:'flex', flexWrap:'wrap', gap:8}}>
                    {[
                      'Price flat (not pumped yet)',
                      'Volume increasing',
                      'Buy ratio > 60%',
                      'Has Twitter',
                      'Has Telegram',
                      'Liquidity > $10k',
                      'Age < 1 hour',
                      'Age < 2 hours',
                      'Not already up 100%+',
                      'Rug check passed',
                    ].map(signal => {
                      const selected = (coinBot.requiredSignals || []).includes(signal)
                      return (
                        <button key={signal} onClick={() => {
                          const current = coinBot.requiredSignals || []
                          const updated = selected ? current.filter(s => s !== signal) : [...current, signal]
                          saveCoinBot({requiredSignals: updated})
                        }} style={{
                          padding:'6px 12px', borderRadius:6, fontSize:12, fontWeight:600,
                          border: selected ? '1px solid #22c55e' : '1px solid #1e1e2a',
                          background: selected ? 'rgba(34,197,94,0.12)' : 'transparent',
                          color: selected ? '#22c55e' : '#6b7280',
                          cursor:'pointer'
                        }}>{signal}</button>
                      )
                    })}
                  </div>
                </div>

                {/* Saved bots list */}
                {savedCoinBots.length > 0 && (
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:12, fontWeight:700, color:'#fff', marginBottom:10}}>Your Saved Bots</div>
                    <div style={{display:'flex', flexDirection:'column', gap:8}}>
                      {savedCoinBots.map(bot => (
                        <div key={bot.id} style={{
                          display:'flex', alignItems:'center', justifyContent:'space-between',
                          padding:'10px 14px', borderRadius:8,
                          background: activeCoinBotId===bot.id ? 'rgba(99,102,241,0.12)' : '#1a1a24',
                          border:`1px solid ${activeCoinBotId===bot.id ? '#6366f1' : '#1e1e2a'}`,
                        }}>
                          <div>
                            <div style={{fontSize:13, fontWeight:700, color:'#fff'}}>{bot.name}</div>
                            <div style={{fontSize:11, color:'#4b5563', marginTop:2}}>
                              {new Date(bot.createdAt).toLocaleDateString()} ·
                              Age: {bot.config.maxAge}h ·
                              TP: {bot.config.takeProfitX}x ·
                              SL: {bot.config.stopLossPct}%
                            </div>
                          </div>
                          <div style={{display:'flex', gap:6, alignItems:'center'}}>
                            <div style={{
                              fontSize:11, fontWeight:700,
                              color:(bot.stats?.totalPnl||0)>=0?'#22c55e':'#ef4444'
                            }}>
                              {(bot.stats?.totalPnl||0)>=0?'+':''}${(bot.stats?.totalPnl||0).toFixed(0)}
                            </div>
                            <button onClick={() => loadBotConfig(bot)} style={{
                              padding:'5px 10px', borderRadius:6, border:'none',
                              background:'rgba(99,102,241,0.15)', color:'#a5b4fc',
                              fontSize:11, fontWeight:700, cursor:'pointer'
                            }}>Load</button>
                            <button onClick={() => deleteSavedBot(bot.id)} style={{
                              padding:'5px 8px', borderRadius:6,
                              border:'1px solid rgba(239,68,68,0.2)', background:'transparent',
                              color:'#ef4444', fontSize:11, cursor:'pointer'
                            }}>×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Create new bot */}
                <div style={{
                  padding:16, borderRadius:10,
                  background:'#1a1a24', border:'1px solid #1e1e2a',
                  marginTop:8, marginBottom:16
                }}>
                  <div style={{fontSize:13, fontWeight:700, color:'#fff', marginBottom:4}}>Save as New Bot</div>
                  <div style={{fontSize:11, color:'#4b5563', marginBottom:12}}>
                    Give this configuration a name to save it. You can run multiple bots with different settings at the same time.
                  </div>
                  <div style={{display:'flex', gap:8}}>
                    <input
                      value={newBotName}
                      onChange={e => setNewBotName(e.target.value)}
                      onKeyDown={e => e.key==='Enter' && saveCoinBotConfig()}
                      placeholder='e.g. "Conservative 2h Bot" or "Aggressive Degen Bot"'
                      style={{
                        flex:1, padding:'9px 12px', borderRadius:8,
                        border:'1px solid #1e1e2a', background:'#111',
                        color:'#fff', fontSize:13, outline:'none',
                      }}
                    />
                    <button
                      onClick={saveCoinBotConfig}
                      disabled={!newBotName.trim()}
                      style={{
                        padding:'9px 18px', borderRadius:8, border:'none',
                        background: newBotName.trim() ? '#6366f1' : '#1e1e2a',
                        color: newBotName.trim() ? '#fff' : '#4b5563',
                        fontSize:13, fontWeight:700, cursor: newBotName.trim() ? 'pointer' : 'default',
                        whiteSpace:'nowrap'
                      }}
                    >
                      + Save Bot
                    </button>
                  </div>
                </div>

                <div style={{padding:14, borderRadius:10, background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)'}}>
                  <div style={{fontSize:13, fontWeight:700, color:'#22c55e', marginBottom:3}}>✓ Strategy saved</div>
                  <div style={{fontSize:12, color:'#6b7280'}}>
                    Go to Backtest to see how these rules would have performed on past coins.
                    Go to Auto Bot to start automatic paper trading.
                  </div>
                </div>
              </div>
            )}

            {/* BACKTEST TAB */}
            {coinBotTab === 'backtest' && (
              <div>
                <div style={{fontSize:13, color:'#6b7280', marginBottom:20, lineHeight:1.6}}>
                  AI analyzes the coins that appeared in your Coin Sniper and shows how your strategy rules would have performed.
                </div>

                {savedCoinBots.length > 0 && (
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:12, color:'#6b7280', marginBottom:8}}>Load a saved bot config:</div>
                    <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                      {savedCoinBots.map(bot => (
                        <button key={bot.id} onClick={() => loadBotConfig(bot)} style={{
                          padding:'6px 12px', borderRadius:7,
                          border:`1px solid ${activeCoinBotId===bot.id?'#6366f1':'#1e1e2a'}`,
                          background: activeCoinBotId===bot.id?'rgba(99,102,241,0.15)':'#1a1a24',
                          color: activeCoinBotId===bot.id?'#a5b4fc':'#6b7280',
                          fontSize:12, fontWeight:600, cursor:'pointer'
                        }}>{bot.name}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strategy summary */}
                <div style={{background:'#1a1a24', borderRadius:10, padding:14, marginBottom:20}}>
                  <div style={{fontSize:12, fontWeight:700, color:'#fff', marginBottom:10}}>Current Strategy:</div>
                  {[
                    {label:'Max age', value: coinBot.maxAge},
                    {label:'Min liquidity', value: coinBot.minLiquidity},
                    {label:'Min buy ratio', value: coinBot.minBuyRatio},
                    {label:'Max 24h pump', value: coinBot.maxH24Pump},
                    {label:'Take profit', value: coinBot.takeProfitX},
                    {label:'Stop loss', value: coinBot.stopLossPct},
                    {label:'Position size', value: coinBot.maxPositionSize},
                    {label:'Required signals', value: (coinBot.requiredSignals || []).join(', ')},
                  ].filter(r => r.value).map(r => (
                    <div key={r.label} style={{display:'flex', gap:8, marginBottom:5, fontSize:12}}>
                      <span style={{color:'#4b5563', minWidth:100}}>{r.label}:</span>
                      <span style={{color:'#d1d5db'}}>{r.value}</span>
                    </div>
                  ))}
                  {Object.keys(coinBot).filter(k => coinBot[k]).length === 0 && (
                    <div style={{color:'#4b5563', fontSize:12}}>No strategy defined — go to Strategy tab first</div>
                  )}
                </div>

                <button onClick={async () => {
                  setCoinBotAnalyzing(true)
                  try {
                    // Get tracked coins from API
                    const tracked = await fetch('/api/track-coin').then(r=>r.json()).catch(()=>({tracked:[]}))
                    const coins = tracked.tracked || []

                    const res = await fetch('/api/analyze-game', {
                      method: 'POST',
                      headers: {'Content-Type':'application/json'},
                      body: JSON.stringify({
                        team1: 'STRATEGY',
                        team2: 'NO_FILTER',
                        sport: 'COIN_BACKTEST',
                        odds1: 0, odds2: 0,
                        gameTime: 'Historical',
                        context: `You are a meme coin trading analyst. Analyze these strategy rules for snipe trading.

STRATEGY RULES:
- Max coin age: ${coinBot.maxAge || 'Not set'}
- Min liquidity: ${coinBot.minLiquidity || 'Not set'}
- Min buy ratio: ${coinBot.minBuyRatio || 'Not set'}
- Max 24h pump before entry: ${coinBot.maxH24Pump || 'Not set'}
- Take profit: ${coinBot.takeProfitX || 'Not set'}
- Stop loss: ${coinBot.stopLossPct || 'Not set'}
- Required signals: ${(coinBot.requiredSignals || []).join(', ') || 'None selected'}
- Extra rules: ${coinBot.extraRules || 'None'}

${coins.length > 0 ? `
TRACKED COINS (${coins.length} total):
${coins.slice(0,10).map(c => `${c.name} | entry stats: ${JSON.stringify(c.entry_stats)} | outcome 24h: ${c.outcome_24h || 'unknown'}`).join('\n')}
` : 'No tracked coin data yet - will analyze based on strategy rules alone'}

Based on these meme coin snipe strategy rules:
1. Are these rules conservative or aggressive?
2. What percentage of coins would pass these filters?
3. Which rules are most important for avoiding rugs?
4. Which rules might be too strict and miss good trades?
5. Estimated win rate with these rules applied to meme coin sniping?
6. What improvements would you suggest?

Reply with JSON:
{
  "estimatedWinRate": 45,
  "coinsPassingFilter": "~15-20 per day",
  "bestRule": "rule that protects most from rugs",
  "tooStrictRule": "rule that might miss good trades",
  "improvements": ["suggestion 1", "suggestion 2", "suggestion 3"],
  "riskLevel": "Conservative / Balanced / Aggressive",
  "summary": "2-3 sentence assessment"
}`
                      })
                    })
                    const data = await res.json()
                    try {
                      const text = data.reasoning || data.edge || JSON.stringify(data)
                      const match = text.match(/\{[\s\S]*\}/)
                      if (match) {
                        setCoinBotAnalysis(JSON.parse(match[0]))
                      } else {
                        setCoinBotAnalysis({summary: text, improvements: []})
                      }
                    } catch {
                      setCoinBotAnalysis({summary: data.reasoning || 'Analysis complete', improvements: []})
                    }
                  } catch(e) { console.error(e) }
                  setCoinBotAnalyzing(false)
                }} disabled={coinBotAnalyzing} style={{
                  width:'100%', padding:'12px', borderRadius:10, border:'none',
                  background: coinBotAnalyzing ? '#1a1a24' : '#6366f1',
                  color: coinBotAnalyzing ? '#6b7280' : '#fff',
                  fontSize:14, fontWeight:700, cursor: coinBotAnalyzing ? 'default' : 'pointer',
                  marginBottom:20
                }}>
                  {coinBotAnalyzing ? '🤔 Analyzing strategy...' : 'Analyze My Strategy'}
                </button>

                {coinBotAnalysis && (
                  <div>
                    <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16}}>
                      {[
                        {label:'EST. WIN RATE', value: coinBotAnalysis.estimatedWinRate ? coinBotAnalysis.estimatedWinRate+'%' : 'N/A', color:'#22c55e'},
                        {label:'DAILY COINS', value: coinBotAnalysis.coinsPassingFilter || 'N/A', color:'#a5b4fc'},
                        {label:'RISK LEVEL', value: coinBotAnalysis.riskLevel || 'N/A', color:'#f59e0b'},
                      ].map(s => (
                        <div key={s.label} style={{background:'#1a1a24', borderRadius:10, padding:14, textAlign:'center'}}>
                          <div style={{fontSize:10, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6}}>{s.label}</div>
                          <div style={{fontSize:16, fontWeight:800, color:s.color}}>{s.value}</div>
                        </div>
                      ))}
                    </div>

                    {coinBotAnalysis.bestRule && (
                      <div style={{background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:10, padding:14, marginBottom:10}}>
                        <div style={{fontSize:12, fontWeight:700, color:'#22c55e', marginBottom:4}}>✓ Strongest Rule</div>
                        <div style={{fontSize:13, color:'#d1d5db'}}>{coinBotAnalysis.bestRule}</div>
                      </div>
                    )}

                    {coinBotAnalysis.tooStrictRule && (
                      <div style={{background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:10, padding:14, marginBottom:10}}>
                        <div style={{fontSize:12, fontWeight:700, color:'#f59e0b', marginBottom:4}}>⚠ Possibly Too Strict</div>
                        <div style={{fontSize:13, color:'#d1d5db'}}>{coinBotAnalysis.tooStrictRule}</div>
                      </div>
                    )}

                    {coinBotAnalysis.improvements?.length > 0 && (
                      <div style={{background:'#1a1a24', borderRadius:10, padding:14, marginBottom:10}}>
                        <div style={{fontSize:12, fontWeight:700, color:'#fff', marginBottom:10}}>Suggested Improvements:</div>
                        {coinBotAnalysis.improvements.map((imp, i) => (
                          <div key={i} style={{display:'flex', gap:8, marginBottom:6, fontSize:13, color:'#d1d5db'}}>
                            <span style={{color:'#6366f1', flexShrink:0, fontWeight:700}}>{i+1}.</span>
                            {imp}
                          </div>
                        ))}
                      </div>
                    )}

                    {coinBotAnalysis.summary && (
                      <div style={{background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:10, padding:14}}>
                        <div style={{fontSize:12, fontWeight:700, color:'#a5b4fc', marginBottom:4}}>AI Assessment</div>
                        <div style={{fontSize:13, color:'#d1d5db', lineHeight:1.6}}>{coinBotAnalysis.summary}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* AUTO BOT TAB */}
            {coinBotTab === 'bot' && (
              <div>
                {savedCoinBots.length > 0 && (
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:12, fontWeight:700, color:'#fff', marginBottom:8}}>Select bot to run:</div>
                    <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                      {savedCoinBots.map(bot => (
                        <button key={bot.id} onClick={() => {
                          loadBotConfig(bot)
                          setCoinBotTab('bot')
                        }} style={{
                          padding:'8px 14px', borderRadius:8,
                          border:`1px solid ${activeCoinBotId===bot.id?'#6366f1':'#1e1e2a'}`,
                          background: activeCoinBotId===bot.id?'rgba(99,102,241,0.15)':'transparent',
                          color: activeCoinBotId===bot.id?'#a5b4fc':'#6b7280',
                          fontSize:12, fontWeight:600, cursor:'pointer'
                        }}>
                          {bot.name}
                          {bot.running && <span style={{marginLeft:6, width:6, height:6, borderRadius:'50%', background:'#22c55e', display:'inline-block'}}/>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{fontSize:13, color:'#6b7280', marginBottom:20, lineHeight:1.6}}>
                  The bot watches new coins every 60 seconds. When a coin matches your strategy rules it automatically places a paper trade.
                </div>

                {/* Bot status card */}
                <div style={{
                  background: coinBotRunning ? 'rgba(34,197,94,0.08)' : '#1a1a24',
                  border: `2px solid ${coinBotRunning ? 'rgba(34,197,94,0.4)' : '#1e1e2a'}`,
                  borderRadius:14, padding:20, marginBottom:20,
                }}>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
                    <div>
                      <div style={{fontSize:16, fontWeight:800, color: coinBotRunning ? '#22c55e' : '#fff', marginBottom:4}}>
                        {coinBotRunning ? '🟢 Bot Active' : '⚫ Bot Stopped'}
                      </div>
                      <div style={{fontSize:12, color:'#6b7280'}}>
                        {coinBotRunning
                          ? 'Scanning new coins every 60 seconds and paper trading matches automatically'
                          : 'Start to begin automatic paper trading based on your strategy'
                        }
                      </div>
                    </div>
                    <button onClick={() => {
                      const newState = !coinBotRunning
                      setCoinBotRunning(newState)
                      localStorage.setItem('nexyru_coinbot_running', String(newState))

                      if (newState) {
                        const runCoinBot = async () => {
                          if (localStorage.getItem('nexyru_coinbot_running') !== 'true') return

                          try {
                            const strat = JSON.parse(localStorage.getItem('nexyru_coinbot') || '{}')

                            // Fetch current gems
                            const gemsRes = await fetch('/api/gems')
                            const gemsData = await gemsRes.json()
                            const coins = gemsData.coins || []

                            // Filter coins by strategy rules
                            const maxAge = parseFloat(strat.maxAge) || 6
                            const minLiq = parseFloat(strat.minLiquidity?.replace(/[^0-9.]/g,'')) || 3000
                            const minBuyRatio = parseFloat(strat.minBuyRatio?.replace(/[^0-9.]/g,'')) / 100 || 0.55
                            const maxPump = parseFloat(strat.maxH24Pump?.replace(/[^0-9.]/g,'')) || 500
                            const requireSocials = strat.requiredSignals?.includes('Has Twitter') || strat.requireTwitter === 'Yes'

                            const matching = coins.filter(coin => {
                              if (coin.ageHours > maxAge) return false
                              if (parseFloat(coin.liquidity?.usd||0) < minLiq) return false
                              if ((coin.buyRatio||0) < minBuyRatio) return false
                              if (parseFloat(coin.priceChange?.h24||0) > maxPump) return false
                              if (requireSocials && !coin.hasTwitter && !coin.hasTelegram) return false
                              return true
                            })

                            // For each matching coin not already in bot trades, place a paper trade
                            const existingTrades = JSON.parse(localStorage.getItem('nexyru_coinbot_trades') || '[]')
                            const existingIds = new Set(existingTrades.map(t => t.coinId))

                            const newTrades = matching
                              .filter(coin => !existingIds.has(coin.coinId))
                              .slice(0, 3) // Max 3 new trades per cycle
                              .map(coin => {
                                const entryPrice = parseFloat(coin.priceUsd || '0')
                                const takeProfitMultiplier = parseFloat(strat.takeProfitX?.replace(/[^0-9.]/g,'')) || 3
                                const stopLossPct = parseFloat(strat.stopLossPct?.replace(/[^0-9.]/g,'')) / 100 || 0.5
                                const positionSize = parseFloat(strat.maxPositionSize?.replace(/[^0-9.]/g,'')) || 100

                                return {
                                  id: Date.now() + Math.random(),
                                  coinId: coin.coinId,
                                  name: coin.name,
                                  symbol: coin.symbol,
                                  chain: coin.chain,
                                  entryPrice,
                                  takeProfitPrice: entryPrice * takeProfitMultiplier,
                                  stopLossPrice: entryPrice * (1 - stopLossPct),
                                  positionSize,
                                  placedAt: new Date().toISOString(),
                                  status: 'open',
                                  pnl: null,
                                  pnlPct: null,
                                  entryStats: {
                                    ageHours: coin.ageHours,
                                    liquidity: parseFloat(coin.liquidity?.usd||0),
                                    buyRatio: coin.buyRatio,
                                    h1: parseFloat(coin.priceChange?.h1||0),
                                    h24: parseFloat(coin.priceChange?.h24||0),
                                    hasTwitter: coin.hasTwitter,
                                    hasTelegram: coin.hasTelegram,
                                  }
                                }
                              })

                            if (newTrades.length > 0) {
                              const updated = [...newTrades, ...existingTrades].slice(0, 100)
                              localStorage.setItem('nexyru_coinbot_trades', JSON.stringify(updated))
                              setCoinBotTrades(updated)
                            }

                            // Check existing open trades for TP/SL hits
                            const updatedTrades = existingTrades.map(trade => {
                              if (trade.status !== 'open') return trade

                              // Find current price
                              const currentCoin = coins.find(c => c.coinId === trade.coinId)
                              if (!currentCoin) return trade

                              const currentPrice = parseFloat(currentCoin.priceUsd || '0')
                              if (currentPrice <= 0) return trade

                              const pnlPct = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
                              const pnl = (pnlPct / 100) * trade.positionSize

                              // Check TP hit
                              if (currentPrice >= trade.takeProfitPrice) {
                                return {...trade, status:'won', currentPrice, pnl, pnlPct, closedAt: new Date().toISOString()}
                              }
                              // Check SL hit
                              if (currentPrice <= trade.stopLossPrice) {
                                return {...trade, status:'lost', currentPrice, pnl: -trade.positionSize*(parseFloat((localStorage.getItem('nexyru_coinbot')||'{}').replace(/.*stopLossPct[^0-9.]*([0-9.]+).*/,'$1')||'50')/100), pnlPct, closedAt: new Date().toISOString()}
                              }
                              // Update current price
                              return {...trade, currentPrice, pnl, pnlPct}
                            })

                            localStorage.setItem('nexyru_coinbot_trades', JSON.stringify(updatedTrades))
                            setCoinBotTrades(updatedTrades)

                          } catch(e) { console.error('Bot error:', e) }

                          // Run again in 60 seconds
                          setTimeout(runCoinBot, 60000)
                        }

                        runCoinBot()
                      }
                    }} style={{
                      padding:'10px 20px', borderRadius:8, border:'none',
                      background: coinBotRunning ? 'rgba(239,68,68,0.2)' : '#22c55e',
                      color: coinBotRunning ? '#ef4444' : '#fff',
                      fontSize:13, fontWeight:700, cursor:'pointer', flexShrink:0
                    }}>
                      {coinBotRunning ? 'Stop Bot' : 'Start Bot'}
                    </button>
                  </div>

                  {/* Strategy summary in bot card */}
                  <div style={{fontSize:11, color:'#4b5563', borderTop:'1px solid #1e1e2a', paddingTop:10, display:'flex', gap:16, flexWrap:'wrap'}}>
                    <span>Age: <strong style={{color:'#9ca3af'}}>{coinBot.maxAge || 'Not set'}</strong></span>
                    <span>Liq: <strong style={{color:'#9ca3af'}}>{coinBot.minLiquidity || 'Not set'}</strong></span>
                    <span>TP: <strong style={{color:'#22c55e'}}>{coinBot.takeProfitX || 'Not set'}</strong></span>
                    <span>SL: <strong style={{color:'#ef4444'}}>{coinBot.stopLossPct || 'Not set'}</strong></span>
                  </div>
                </div>

                {/* Bot trades */}
                <div style={{fontSize:14, fontWeight:700, color:'#fff', marginBottom:12}}>
                  Bot Trades ({coinBotTrades.length})
                </div>

                {coinBotTrades.length === 0 ? (
                  <div style={{background:'#1a1a24', borderRadius:10, padding:24, textAlign:'center', color:'#4b5563', fontSize:13}}>
                    No bot trades yet. Define your strategy and start the bot — it will paper trade automatically when coins match your rules.
                  </div>
                ) : coinBotTrades.map((trade: any) => {
                  const pnlColor = (trade.pnl||0) >= 0 ? '#22c55e' : '#ef4444'
                  return (
                    <div key={trade.id} style={{
                      background:'#1a1a24',
                      border:`1px solid ${trade.status==='won'?'rgba(34,197,94,0.3)':trade.status==='lost'?'rgba(239,68,68,0.3)':'#1e1e2a'}`,
                      borderRadius:10, padding:14, marginBottom:8
                    }}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
                        <div>
                          <span style={{fontSize:14, fontWeight:800, color:'#fff'}}>{trade.name}</span>
                          <span style={{fontSize:11, color:'#6b7280', marginLeft:6}}>{trade.symbol}</span>
                          <div style={{fontSize:11, color:'#4b5563', marginTop:2}}>
                            {new Date(trade.placedAt).toLocaleString()} · ${trade.positionSize} position
                          </div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          {trade.status === 'open' && <span style={{fontSize:12, fontWeight:700, color:'#f59e0b'}}>⏳ Open</span>}
                          {trade.status === 'won' && <span style={{fontSize:12, fontWeight:700, color:'#22c55e'}}>✓ Won +${(trade.pnl||0).toFixed(0)}</span>}
                          {trade.status === 'lost' && <span style={{fontSize:12, fontWeight:700, color:'#ef4444'}}>✗ Lost ${(trade.pnl||0).toFixed(0)}</span>}
                        </div>
                      </div>

                      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:8}}>
                        {[
                          {label:'ENTRY', value:'$'+parseFloat(trade.entryPrice||0).toExponential(2), color:'#fff'},
                          {label:'CURRENT', value: trade.currentPrice ? '$'+parseFloat(trade.currentPrice).toExponential(2) : 'N/A', color:'#fff'},
                          {label:'TARGET', value:'$'+parseFloat(trade.takeProfitPrice||0).toExponential(2), color:'#22c55e'},
                          {label:'STOP', value:'$'+parseFloat(trade.stopLossPrice||0).toExponential(2), color:'#ef4444'},
                        ].map(s => (
                          <div key={s.label} style={{background:'#111', borderRadius:6, padding:'6px', textAlign:'center'}}>
                            <div style={{fontSize:9, color:'#4b5563', marginBottom:2}}>{s.label}</div>
                            <div style={{fontSize:11, fontWeight:700, color:s.color}}>{s.value}</div>
                          </div>
                        ))}
                      </div>

                      {trade.pnl !== null && trade.status === 'open' && (
                        <div style={{fontSize:12, fontWeight:700, color:pnlColor, marginBottom:6}}>
                          Current P&L: {(trade.pnl||0) >= 0 ? '+' : ''}${(trade.pnl||0).toFixed(2)} ({(trade.pnlPct||0).toFixed(1)}%)
                        </div>
                      )}

                      {/* Entry stats */}
                      <div style={{fontSize:10, color:'#4b5563', display:'flex', gap:8, flexWrap:'wrap'}}>
                        <span>Age: {(trade.entryStats?.ageHours||0).toFixed(1)}h</span>
                        <span>Liq: ${Math.round(trade.entryStats?.liquidity||0).toLocaleString()}</span>
                        <span>Buys: {Math.round((trade.entryStats?.buyRatio||0.5)*100)}%</span>
                        <span>1h: {(trade.entryStats?.h1||0).toFixed(0)}%</span>
                        {trade.entryStats?.hasTwitter && <span style={{color:'#1da1f2'}}>Twitter ✓</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* PERFORMANCE TAB */}
            {coinBotTab === 'performance' && (
              <div>
                <div style={{fontSize:13, color:'#6b7280', marginBottom:20}}>
                  Track the bot's performance and learn which entry signals actually predict pumps.
                </div>

                {savedCoinBots.length > 0 && (
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:12, color:'#6b7280', marginBottom:8}}>Load a saved bot config:</div>
                    <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:16}}>
                      {savedCoinBots.map(bot => (
                        <button key={bot.id} onClick={() => loadBotConfig(bot)} style={{
                          padding:'6px 12px', borderRadius:7,
                          border:`1px solid ${activeCoinBotId===bot.id?'#6366f1':'#1e1e2a'}`,
                          background: activeCoinBotId===bot.id?'rgba(99,102,241,0.15)':'#1a1a24',
                          color: activeCoinBotId===bot.id?'#a5b4fc':'#6b7280',
                          fontSize:12, fontWeight:600, cursor:'pointer'
                        }}>{bot.name}</button>
                      ))}
                    </div>

                    <div style={{fontSize:12, fontWeight:700, color:'#fff', marginBottom:8}}>Per-bot performance</div>
                    {savedCoinBots.map(bot => {
                      const closed = (bot.trades||[]).filter(t => t.status !== 'open')
                      const wins = closed.filter(t => t.status === 'won')
                      const winRate = closed.length ? Math.round(wins.length/closed.length*100) : 0
                      const totalPnl = closed.reduce((s,t) => s+(t.pnl||0), 0)
                      return (
                        <div key={bot.id} style={{
                          background:'#1a1a24', border:'1px solid #1e1e2a',
                          borderRadius:10, padding:14, marginBottom:10
                        }}>
                          <div style={{display:'flex', justifyContent:'space-between', marginBottom:10}}>
                            <div style={{fontSize:14, fontWeight:700, color:'#fff'}}>{bot.name}</div>
                            <div style={{fontSize:13, fontWeight:700, color:totalPnl>=0?'#22c55e':'#ef4444'}}>
                              {totalPnl>=0?'+':''}${totalPnl.toFixed(0)}
                            </div>
                          </div>
                          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8}}>
                            {[
                              {label:'WIN RATE', value:winRate+'%', color:winRate>=50?'#22c55e':'#ef4444'},
                              {label:'TRADES', value:(bot.trades||[]).length, color:'#fff'},
                              {label:'WINS', value:wins.length, color:'#22c55e'},
                              {label:'LOSSES', value:closed.length-wins.length, color:'#ef4444'},
                            ].map(s => (
                              <div key={s.label} style={{background:'#111', borderRadius:6, padding:'8px', textAlign:'center'}}>
                                <div style={{fontSize:9, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3}}>{s.label}</div>
                                <div style={{fontSize:15, fontWeight:800, color:s.color}}>{s.value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {(() => {
                  const closed = coinBotTrades.filter(t => t.status !== 'open')
                  const wins = closed.filter(t => t.status === 'won')
                  const losses = closed.filter(t => t.status === 'lost')
                  const totalPnl = closed.reduce((s,t) => s + (t.pnl||0), 0)
                  const winRate = closed.length ? Math.round(wins.length/closed.length*100) : 0
                  const avgWin = wins.length ? wins.reduce((s,t) => s + (t.pnl||0), 0) / wins.length : 0
                  const avgLoss = losses.length ? Math.abs(losses.reduce((s,t) => s + (t.pnl||0), 0) / losses.length) : 0

                  return (
                    <div>
                      {/* Stats grid */}
                      <div style={{display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:20}}>
                        {[
                          {label:'WIN RATE', value:winRate+'%', color:winRate>=50?'#22c55e':'#ef4444'},
                          {label:'NET P&L', value:(totalPnl>=0?'+':'')+'$'+totalPnl.toFixed(0), color:totalPnl>=0?'#22c55e':'#ef4444'},
                          {label:'AVG WIN', value:'+$'+avgWin.toFixed(0), color:'#22c55e'},
                          {label:'AVG LOSS', value:'-$'+avgLoss.toFixed(0), color:'#ef4444'},
                          {label:'TOTAL TRADES', value:coinBotTrades.length, color:'#fff'},
                          {label:'OPEN', value:coinBotTrades.filter(t=>t.status==='open').length, color:'#f59e0b'},
                        ].map(s => (
                          <div key={s.label} style={{background:'#1a1a24', borderRadius:10, padding:14}}>
                            <div style={{fontSize:10, color:'#4b5563', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4}}>{s.label}</div>
                            <div style={{fontSize:22, fontWeight:800, color:s.color}}>{s.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* What signals worked */}
                      {closed.length >= 5 && (
                        <div style={{background:'#1a1a24', borderRadius:10, padding:16, marginBottom:16}}>
                          <div style={{fontSize:13, fontWeight:700, color:'#fff', marginBottom:12}}>What signals predicted wins:</div>

                          {[
                            {
                              label:'Had Twitter',
                              wins: wins.filter(t=>t.entryStats?.hasTwitter).length,
                              total: closed.filter(t=>t.entryStats?.hasTwitter).length,
                            },
                            {
                              label:'Age < 1h',
                              wins: wins.filter(t=>(t.entryStats?.ageHours||99)<1).length,
                              total: closed.filter(t=>(t.entryStats?.ageHours||99)<1).length,
                            },
                            {
                              label:'Age 1-6h',
                              wins: wins.filter(t=>{const a=t.entryStats?.ageHours||99; return a>=1&&a<6}).length,
                              total: closed.filter(t=>{const a=t.entryStats?.ageHours||99; return a>=1&&a<6}).length,
                            },
                            {
                              label:'Buy ratio > 60%',
                              wins: wins.filter(t=>(t.entryStats?.buyRatio||0)>0.6).length,
                              total: closed.filter(t=>(t.entryStats?.buyRatio||0)>0.6).length,
                            },
                            {
                              label:'1h change > 0%',
                              wins: wins.filter(t=>(t.entryStats?.h1||0)>0).length,
                              total: closed.filter(t=>(t.entryStats?.h1||0)>0).length,
                            },
                          ].filter(s => s.total > 0).map(s => {
                            const rate = Math.round(s.wins/s.total*100)
                            return (
                              <div key={s.label} style={{marginBottom:10}}>
                                <div style={{display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4}}>
                                  <span style={{color:'#d1d5db'}}>{s.label}</span>
                                  <span style={{color:rate>=50?'#22c55e':'#ef4444', fontWeight:700}}>{rate}% win rate ({s.wins}/{s.total})</span>
                                </div>
                                <div style={{height:6, background:'#111', borderRadius:3, overflow:'hidden'}}>
                                  <div style={{height:'100%', width:rate+'%', background:rate>=50?'#22c55e':'#ef4444', borderRadius:3}}/>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {closed.length < 5 && (
                        <div style={{background:'#1a1a24', borderRadius:10, padding:24, textAlign:'center', color:'#4b5563', fontSize:13}}>
                          Need at least 5 closed trades for performance analysis. Keep the bot running!
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {isMobile && (
        <div style={{
          position:'fixed', bottom:0, left:0, right:0, zIndex:200,
          background:'rgba(8,8,8,0.95)', backdropFilter:'blur(12px)', borderTop:'1px solid #16161f',
          display:'flex', paddingBottom:'env(safe-area-inset-bottom)',
          height:70
        }}>
          {cryptoMobileItems.map(item => (
            <button key={item.id} onClick={() => setCryptoSection(item.id)} style={{
              flex:1, display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center',
              border:'none', background:'transparent',
              gap:4, cursor:'pointer', padding:'8px 4px',
              color: cryptoSection===item.id ? '#a5b4fc' : '#4b5563',
              borderTop: cryptoSection===item.id ? '2px solid #6366f1' : '2px solid transparent',
              transition:'all 0.15s',
            }}>
              <item.Icon size={20}/>
              <span style={{
                fontSize:11, fontWeight: cryptoSection===item.id ? 700 : 500,
                letterSpacing:'-0.01em'
              }}>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
