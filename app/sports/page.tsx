"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, Activity, RefreshCw, Bell, BellOff,
  Search, Filter, Star, StarOff, Copy, ExternalLink, ChevronDown,
  ChevronUp, AlertTriangle, CheckCircle, XCircle, Clock, Zap,
  Shield, Target, BarChart2, Wallet, ArrowUpRight, ArrowDownRight,
  Radio, Eye, Trash2, Edit2, Plus, Award, BookOpen, Layers
} from 'lucide-react'

// ──────────────────────── theme ────────────────────────
const C = {
  bg: "#080808",
  card: "#0d0d12",
  card2: "#161616",
  border: "#16161f",
  borderSoft: "#1a1a1a",
  text: "#ffffff",
  textDim: "#9aa0aa",
  textMuted: "#6b7280",
  accent: "#6366f1",
  green: "#22c55e",
  red: "#ef4444",
  amber: "#f59e0b",
  blue: "#60a5fa",
};

// ──────────────────────── storage keys ────────────────────────
const BANKROLL_KEY = "sports_bankroll";
const PAPER_BETS_KEY = "sports_paper_bets";
const ARBS_TRACKED_KEY = "sports_arbs_tracked";
const PARLAYS_KEY = "sports_saved_parlays";
const BOOK_LOG_KEY = "sports_book_log";

// ──────────────────────── types ────────────────────────
type Section = "best" | "arb" | "parlays" | "props" | "bets" | "books";

type Outcome = { name: string; price: number };
type Bookmaker = {
  key: string;
  title: string;
  markets: { key: string; outcomes: Outcome[] }[];
};
type Game = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
};

type Pick = {
  game: Game;
  team: string;
  bestPrice: number;
  bestBook: string;
  worstPrice: number;
  worstBook: string;
  impliedProb: number;
  edge: number;
  score: number;
  opponentName?: string;
  opponentOdds?: number;
  opponentBook?: string;
};

type PaperBet = {
  id: number;
  type: "best-pick" | "arb" | "parlay" | "prop";
  sport: string;
  game: string;
  pick: string;
  odds: number;
  book: string;
  stake: number;
  potWin: number;
  status: "pending" | "won" | "lost" | "void" | "push";
  placedAt: string;
  settledAt?: string;
  notes?: string;
  profit?: number;
};

type BookEntry = {
  book: string;
  arbCount: number;
  normalCount: number;
  status: "healthy" | "limited" | "banned";
  note?: string;
};

type GameAnalysis = {
  pick: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  injuries: string;
  form: string;
  edge: string;
  warning: string | null;
  avoid: boolean;
};

// ──────────────────────── odds math ────────────────────────
const americanToDecimal = (a: number) => (a > 0 ? a / 100 + 1 : 100 / -a + 1);
const americanToImplied = (a: number) =>
  a > 0 ? 100 / (a + 100) : -a / (-a + 100);
const payoutOn = (stake: number, american: number) =>
  american > 0 ? (stake * american) / 100 : (stake * 100) / Math.abs(american);

function buildPicks(games: Game[]): Pick[] {
  const picks: Pick[] = [];
  for (const g of games) {
    const sides: Record<
      string,
      {
        best: { price: number; book: string };
        worst: { price: number; book: string };
      }
    > = {};
    for (const bm of g.bookmakers ?? []) {
      const h2h = bm.markets?.find((m) => m.key === "h2h");
      if (!h2h) continue;
      for (const o of h2h.outcomes) {
        const cur = sides[o.name];
        if (!cur) {
          sides[o.name] = {
            best: { price: o.price, book: bm.title },
            worst: { price: o.price, book: bm.title },
          };
        } else {
          if (americanToDecimal(o.price) > americanToDecimal(cur.best.price)) {
            cur.best = { price: o.price, book: bm.title };
          }
          if (americanToDecimal(o.price) < americanToDecimal(cur.worst.price)) {
            cur.worst = { price: o.price, book: bm.title };
          }
        }
      }
    }
    for (const team of Object.keys(sides)) {
      const { best, worst } = sides[team];
      const impliedProb = americanToImplied(best.price);
      const worstImplied = americanToImplied(worst.price);
      const edge = worstImplied - impliedProb;

      let score = 0;

      // 1. EDGE SCORE (50pts) - main factor, how much line shopping advantage
      const edgeScore = Math.min(50, Math.round(edge * 400));
      score += edgeScore;

      // 2. ODDS VALUE (30pts) - underdogs and slight favorites have more value
      // Sweet spot: +100 to -150 (40-60% implied)
      if (impliedProb >= 0.40 && impliedProb <= 0.60) score += 30; // coin flip range
      else if (impliedProb >= 0.30 && impliedProb <= 0.70) score += 18;
      else if (impliedProb >= 0.20 && impliedProb <= 0.80) score += 8;
      else score += 0; // extreme favorite/underdog = bad value

      // 3. UNDERDOG BONUS (20pts) - underdogs have higher EV potential
      if (best.price > 0) score += 20;           // underdog
      else if (best.price > -130) score += 15;   // slight favorite
      else if (best.price > -200) score += 8;    // moderate favorite
      else if (best.price > -300) score += 3;    // heavy favorite
      else score += 0;                            // -300+ = terrible value

      score = Math.max(0, Math.min(100, score));

      const opponentName = Object.keys(sides).find((k) => k !== team);
      const opponentSide = opponentName ? sides[opponentName] : undefined;

      picks.push({
        game: g,
        team,
        bestPrice: best.price,
        bestBook: best.book,
        worstPrice: worst.price,
        worstBook: worst.book,
        impliedProb,
        edge,
        score,
        opponentName,
        opponentOdds: opponentSide?.best.price,
        opponentBook: opponentSide?.best.book,
      });
    }
  }
  // Dedupe: keep only the higher-scoring side of each game so we never show
  // both teams of the same matchup as separate picks.
  const bestPickPerGame: Record<string, Pick> = {};
  for (const pick of picks) {
    const gameId = pick.game.id;
    if (!bestPickPerGame[gameId] || pick.score > bestPickPerGame[gameId].score) {
      bestPickPerGame[gameId] = pick;
    }
  }
  return Object.values(bestPickPerGame).sort((a, b) => b.score - a.score);
}

function scoreBadge(score: number) {
  if (score >= 75) return { label: "Strong", Icon: Activity, color: C.green };
  if (score >= 55) return { label: "Good", Icon: Star, color: C.blue };
  if (score >= 35) return { label: "Fair", Icon: Eye, color: C.amber };
  return { label: "Skip", Icon: null, color: C.textMuted };
}

function countdown(commence: string, now: number) {
  const t = new Date(commence).getTime();
  if (!isFinite(t)) return { label: "TBD", live: false };
  const diff = t - now;
  if (diff < -3 * 3600_000) return { label: "ended", live: false };
  if (diff < 0) return { label: "LIVE", live: true };
  const h = Math.floor(diff / 3600_000);
  const m = Math.floor((diff % 3600_000) / 60_000);
  if (h >= 24) return { label: `in ${Math.floor(h / 24)}d ${h % 24}h`, live: false };
  if (h >= 1) return { label: `in ${h}h ${m}m`, live: false };
  return { label: `in ${m}m`, live: false };
}

// ──────────────────────── storage helpers ────────────────────────
function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS<T>(key: string, v: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

// ──────────────────────── hooks ────────────────────────
function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const onResize = () => setM(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return m;
}

function useBankroll(): [number, (next: number | ((prev: number) => number)) => void] {
  const [v, setV] = useState<number>(1000);
  useEffect(() => {
    setV(readLS<number>(BANKROLL_KEY, 1000));
  }, []);
  const update = (next: number | ((prev: number) => number)) => {
    setV((prev) => {
      const n = typeof next === "function" ? (next as (p: number) => number)(prev) : next;
      writeLS(BANKROLL_KEY, n);
      return n;
    });
  };
  return [v, update];
}

function usePaperBets(): {
  bets: PaperBet[];
  add: (b: Omit<PaperBet, "id" | "placedAt" | "status">) => void;
  update: (id: number, patch: Partial<PaperBet>) => void;
  remove: (id: number) => void;
} {
  const [bets, setBets] = useState<PaperBet[]>([]);
  useEffect(() => {
    setBets(readLS<PaperBet[]>(PAPER_BETS_KEY, []));
  }, []);
  const persist = (next: PaperBet[]) => {
    setBets(next);
    writeLS(PAPER_BETS_KEY, next);
  };
  return {
    bets,
    add: (b) =>
      persist([
        {
          ...b,
          id: Date.now(),
          placedAt: new Date().toISOString(),
          status: "pending",
        },
        ...bets,
      ]),
    update: (id, patch) =>
      persist(
        bets.map((x) =>
          x.id === id
            ? {
                ...x,
                ...patch,
                settledAt:
                  patch.status && patch.status !== "pending"
                    ? new Date().toISOString()
                    : x.settledAt,
              }
            : x,
        ),
      ),
    remove: (id) => persist(bets.filter((x) => x.id !== id)),
  };
}

// ──────────────────────── page ────────────────────────
export default function SportsPage() {
  const [section, setSection] = useState<Section>("best");
  const [bankroll, setBankroll] = useBankroll();
  const paper = usePaperBets();
  const isMobile = useIsMobile();
  const [flash, setFlash] = useState<string | null>(null);
  const [defaultStake, setDefaultStake] = useState<number>(100);
  const [betModal, setBetModal] = useState<Omit<PaperBet, "id" | "placedAt" | "status" | "stake" | "potWin"> | null>(null);
  const [betStakeInput, setBetStakeInput] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ds = parseFloat(localStorage.getItem("sports_default_stake") || "");
    if (!isNaN(ds)) setDefaultStake(ds);
  }, []);

  const persistDefaultStake = (n: number) => {
    setDefaultStake(n);
    if (typeof window !== "undefined") localStorage.setItem("sports_default_stake", String(n));
  };

  const notify = useCallback((msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  }, []);

  const openBetModal = useCallback(
    (b: Omit<PaperBet, "id" | "placedAt" | "status">) => {
      const { stake, potWin, ...rest } = b;
      setBetModal(rest);
      setBetStakeInput(String(stake || defaultStake));
    },
    [defaultStake],
  );

  const confirmBet = () => {
    if (!betModal) return;
    const stake = parseFloat(betStakeInput) || defaultStake;
    const potWin =
      stake * (betModal.odds > 0 ? betModal.odds / 100 : 100 / Math.abs(betModal.odds));
    paper.add({ ...betModal, stake, potWin });
    setBankroll((prev) => Math.max(0, prev - stake));
    setBetModal(null);
    setSection("bets");
    notify(`✓ ${betModal.pick}`);
  };

  // Shared odds load
  const [games, setGames] = useState<Game[] | null>(null);
  const [oddsLoading, setOddsLoading] = useState(false);
  const [oddsError, setOddsError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const loadOdds = useCallback(async () => {
    setOddsLoading(true);
    setOddsError(null);
    try {
      const sports = [
        "baseball_mlb",
        "tennis_atp_french_open",
        "tennis_wta_french_open",
        "soccer_mls",
      ];
      const all: Game[] = [];
      for (const sport of sports) {
        try {
          const r = await fetch(`/api/odds?sport=${sport}`);
          if (!r.ok) continue;
          const data = await r.json();
          if (Array.isArray(data)) all.push(...(data as Game[]));
          else if (Array.isArray(data?.games)) all.push(...(data.games as Game[]));
        } catch {
          continue;
        }
      }
      if (all.length === 0) {
        setOddsError(
          "Odds API credits used up for this month. Data will refresh when credits reset. Showing cached data if available.",
        );
        try {
          const raw = localStorage.getItem("sports_odds_cache");
          const cached = raw ? JSON.parse(raw) : null;
          if (cached?.data && Array.isArray(cached.data)) {
            setGames(cached.data as Game[]);
          } else if (games === null) {
            setGames([]);
          }
        } catch {
          if (games === null) setGames([]);
        }
      } else {
        setGames(all);
        try {
          localStorage.setItem(
            "sports_odds_cache",
            JSON.stringify({ data: all, timestamp: Date.now() }),
          );
        } catch {}
      }
    } catch (e) {
      setOddsError(e instanceof Error ? e.message : "Network error");
      if (games === null) setGames([]);
    } finally {
      setOddsLoading(false);
    }
  }, [games]);

  // Hydrate from cache immediately on mount, then always try a fresh fetch.
  // Cached data shows instantly so the page feels responsive even when the
  // Odds API is rate-limited.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("sports_odds_cache");
      const cached = raw ? JSON.parse(raw) : null;
      if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
        setGames(cached.data as Game[]);
      }
    } catch {}
    loadOdds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sidebarItems: { id: Section; icon: any; label: string }[] = [
    { id: "best",    icon: <Target size={18}/>,     label: "Best Picks" },
    { id: "arb",     icon: <TrendingUp size={18}/>, label: "Arb Finder" },
    { id: "parlays", icon: <Layers size={18}/>,     label: "Parlays" },
    { id: "props",   icon: <Activity size={18}/>,   label: "Player Props" },
    { id: "bets",    icon: <BookOpen size={18}/>,   label: "Paper Bets" },
    { id: "books",   icon: <Shield size={18}/>,     label: "Book Health" },
  ];

  const mobileItems: { id: Section; Icon: any; label: string }[] = [
    { id: "best", Icon: Target, label: "Picks" },
    { id: "arb", Icon: Wallet, label: "Arbs" },
    { id: "props", Icon: Activity, label: "Props" },
    { id: "bets", Icon: BarChart2, label: "Bets" },
    { id: "books", Icon: BookOpen, label: "Books" },
  ];

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
      {/* Sidebar (desktop only) */}
      {!isMobile && (
        <aside style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 52,
          background: '#0a0a0f',
          borderRight: '1px solid #16161f',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 0,
          zIndex: 50,
          gap: 0,
        }}>
          <a href="/" aria-label="Nexyru" style={{
            width: 52,
            height: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #16161f',
            marginBottom: 8,
            flexShrink: 0,
            textDecoration: 'none',
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 900,
              color: '#fff',
              letterSpacing: '-0.05em',
            }}>N</div>
          </a>

          {sidebarItems.map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              title={item.label}
              style={{
                width: 52,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                background: section === item.id ? 'rgba(99,102,241,0.12)' : 'transparent',
                color: section === item.id ? '#6366f1' : '#4b5563',
                cursor: 'pointer',
                borderLeft: section === item.id ? '2px solid #6366f1' : '2px solid transparent',
                transition: 'all 0.15s',
                marginBottom: 2,
              }}
            >
              {item.icon}
            </button>
          ))}
        </aside>
      )}

      {/* Main */}
      <div style={{ marginLeft: isMobile ? 0 : 52, minHeight: '100vh', display: "flex", flexDirection: "column", paddingBottom: isMobile ? 80 : 0 }}>
        {isMobile && (
          <div style={{
            display:'flex', background:'rgba(8,8,8,0.95)', backdropFilter:'blur(12px)',
            borderBottom:'1px solid #16161f',
            padding:'0 4px'
          }}>
            {[
              {Icon: TrendingUp, label:'Trading', href:'/dashboard', active: false},
              {Icon: Activity, label:'Crypto', href:'/crypto', active: false},
              {Icon: Target, label:'Sports', href:'/sports', active: true},
              {Icon: BarChart2, label:'Options', href:'/options', active: false},
              {Icon: Zap, label:'Airdrops', href:'/airdrops', active: false},
              {Icon: Award, label:'JARVIS', href:'/morning', active: false},
            ].map(link => (
              <a key={link.href} href={link.href} style={{
                flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                padding:'10px 4px',
                fontSize:10, fontWeight: link.active ? 700 : 500,
                color: link.active ? '#fff' : '#4b5563',
                textDecoration:'none',
                borderBottom: link.active ? '2px solid #6366f1' : '2px solid transparent',
                transition:'color 0.15s, border-color 0.15s'
              }}>
                <link.Icon size={14}/>
                <span>{link.label}</span>
              </a>
            ))}
          </div>
        )}
        {/* Top bar */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: isMobile ? 6 : 12,
            padding: isMobile ? "12px 16px" : "0 24px",
            borderBottom: `1px solid ${C.border}`,
            background: "rgba(8,8,8,0.95)",
            backdropFilter: "blur(12px)",
            position: "fixed",
            top: 0,
            left: isMobile ? 0 : 52,
            right: 0,
            height: 52,
            zIndex: 30,
          }}
        >
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ fontSize:15, fontWeight:800, color:'#fff', letterSpacing:'-0.02em', whiteSpace:"nowrap" }}>
              Nexyru
            </div>
            {!isMobile && (
              <div
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: `1px solid ${C.border}`,
                  background: C.card,
                  fontSize: 11,
                  fontWeight: 700,
                  color: bankroll >= 1000 ? C.green : bankroll > 0 ? C.amber : C.red,
                  whiteSpace:"nowrap",
                }}
              >
                ${bankroll.toLocaleString()}
              </div>
            )}
          </div>

          {!isMobile && (
            <div style={{ display:"flex", gap:4, alignItems:"center" }}>
              {[
                { href:'/dashboard', label:'Trading',  active:false },
                { href:'/crypto',    label:'Crypto',   active:false },
                { href:'/sports',    label:'Sports',   active:true  },
                { href:'/options',   label:'Options',  active:false },
                { href:'/airdrops',  label:'Airdrops', active:false },
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
          )}

          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {isMobile && (
              <span style={{ fontSize: 12, fontWeight: 700, color: bankroll >= 1000 ? C.green : bankroll > 0 ? C.amber : C.red }}>
                ${bankroll.toFixed(0)}
              </span>
            )}
            <a href="/morning" style={{padding:'6px 12px', borderRadius:6, border:'1px solid #1e1e2a', background:'transparent', color:'#6b7280', fontSize:12, fontWeight:600, textDecoration:'none'}}>Briefing</a>
          </div>
        </header>

        {/* Flash */}
        {flash && (
          <div
            style={{
              position: "fixed",
              bottom: isMobile ? 80 : 20,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(34,197,94,0.15)",
              border: "1px solid rgba(34,197,94,0.4)",
              color: "#86efac",
              padding: "10px 18px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              zIndex: 100,
            }}
          >
            {flash}
          </div>
        )}

        {/* Section content */}
        <main style={{ padding: isMobile ? 12 : 20, paddingTop: isMobile ? 12 : 72, maxWidth: 1200, width: "100%" }}>
          {section === "best" && (
            <BestPicksPanel
              games={games}
              loading={oddsLoading}
              error={oddsError}
              onRefresh={loadOdds}
              nowMs={nowMs}
              onSwitchSection={setSection}
              onAddBet={openBetModal}
            />
          )}
          {section === "arb" && (
            <ArbFinderPanel
              games={games}
              loading={oddsLoading}
              error={oddsError}
              onRefresh={loadOdds}
              onNotify={notify}
            />
          )}
          {section === "parlays" && (
            <ParlaysPanel
              games={games}
              loading={oddsLoading}
              error={oddsError}
              onRefresh={loadOdds}
              onAddBet={openBetModal}
            />
          )}
          {section === "props" && (
            <PlayerPropsPanel
              onAddBet={openBetModal}
              onSwitchSection={setSection}
            />
          )}
          {section === "bets" && (
            <PaperBetsPanel
              bets={paper.bets}
              bankroll={bankroll}
              setBankroll={setBankroll}
              update={paper.update}
              remove={paper.remove}
              onNotify={notify}
              defaultStake={defaultStake}
              setDefaultStake={persistDefaultStake}
            />
          )}
          {section === "books" && (
            <BookHealthPanel bets={paper.bets} onNotify={notify} />
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 200,
            background: "rgba(8,8,8,0.95)",
            backdropFilter: "blur(12px)",
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            paddingBottom: "env(safe-area-inset-bottom)",
            height: 70,
          }}
        >
          {mobileItems.map((it) => (
            <button
              key={it.id}
              onClick={() => setSection(it.id)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                background: "transparent",
                gap: 4,
                cursor: "pointer",
                padding: "8px 4px",
                color: section === it.id ? "#a5b4fc" : "#4b5563",
                borderTop: section === it.id ? "2px solid #6366f1" : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >
              <it.Icon size={20}/>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: section === it.id ? 700 : 500,
                  letterSpacing: "-0.01em",
                }}
              >
                {it.label}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Bet stake modal */}
      {betModal && (
        <>
          <div
            onClick={() => setBetModal(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000 }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              zIndex: 2001,
              background: "#111",
              border: "1px solid #16161f",
              borderRadius: 16,
              padding: 24,
              width: 360,
              maxWidth: "90vw",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Place Paper Bet</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>{betModal.pick}</div>

            <div style={{ background: "#1a1a24", borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>Game</div>
              <div style={{ fontSize: 13, color: "#fff" }}>{betModal.game}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, marginBottom: 2 }}>Odds</div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: betModal.odds > 0 ? "#22c55e" : "#fff",
                }}
              >
                {betModal.odds > 0 ? "+" : ""}
                {betModal.odds}
              </div>
            </div>

            <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
              Stake ($)
            </label>
            <input
              value={betStakeInput}
              onChange={(e) => setBetStakeInput(e.target.value)}
              type="number"
              placeholder="Enter stake amount"
              onKeyDown={(e) => e.key === "Enter" && confirmBet()}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 8,
                border: "1px solid #16161f",
                background: "#1a1a24",
                color: "#fff",
                fontSize: 16,
                fontWeight: 700,
                outline: "none",
                boxSizing: "border-box",
                marginBottom: 8,
              }}
              autoFocus
            />

            {betStakeInput && parseFloat(betStakeInput) > 0 && (
              <div style={{ fontSize: 13, color: "#22c55e", marginBottom: 16, fontWeight: 600 }}>
                If wins: +$
                {(
                  parseFloat(betStakeInput) *
                  (betModal.odds > 0
                    ? betModal.odds / 100
                    : 100 / Math.abs(betModal.odds))
                ).toFixed(2)}{" "}
                profit
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setBetModal(null)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 8,
                  border: "1px solid #16161f",
                  background: "transparent",
                  color: "#fff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmBet}
                style={{
                  flex: 2,
                  padding: "10px",
                  borderRadius: 8,
                  border: "none",
                  background: "#6366f1",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Place Bet →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────── shared UI ────────────────────────
function SectionHeader({
  title,
  subtitle,
  right,
  Icon,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  Icon?: any;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 16,
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>
          {Icon && <Icon size={22}/>}
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6 }}>
            {subtitle}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}

function RefreshButton({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "9px 18px",
        borderRadius: 8,
        border: "none",
        background: loading ? C.card2 : C.accent,
        color: loading ? C.textDim : "#fff",
        fontSize: 13,
        fontWeight: 700,
        cursor: loading ? "not-allowed" : "pointer",
        minHeight: 36,
        transition: "all 0.15s",
      }}
    >
      <RefreshCw size={14}/>
      {loading ? "Loading…" : "Refresh"}
    </button>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.25)",
        color: "#fca5a5",
        fontSize: 12.5,
      }}
    >
      {children}
    </div>
  );
}

// ──────────────────────── DEEP DIVE ────────────────────────
function DeepDiveSection({
  id,
  show,
  onRun,
  deepDives,
  deepDiving,
}: {
  id: string;
  show: boolean;
  onRun: () => void;
  deepDives: Record<string, any>;
  deepDiving: Record<string, boolean>;
}) {
  if (!show) return null;
  const dd = deepDives[id];
  const running = !!deepDiving[id];

  if (!dd) {
    return (
      <button
        onClick={onRun}
        disabled={running}
        style={{
          width: "100%",
          padding: 8,
          borderRadius: 8,
          marginTop: 8,
          border: "1px solid rgba(99,102,241,0.4)",
          background: "rgba(99,102,241,0.05)",
          color: running ? "#4b5563" : "#a5b4fc",
          fontSize: 12,
          fontWeight: 700,
          cursor: running ? "default" : "pointer",
        }}
      >
        <span style={{display:"inline-flex", alignItems:"center", gap:6}}><Search size={12}/> {running ? "Running deep dive (3 analyses)…" : "Deep Dive — Run Full Analysis"}</span>
      </button>
    );
  }

  return (
    <div
      style={{
        background: "rgba(99,102,241,0.05)",
        border: "1px solid rgba(99,102,241,0.3)",
        borderRadius: 10,
        padding: 14,
        marginTop: 8,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, color: "#a5b4fc", marginBottom: 10 }}>
        <span style={{display:"inline-flex", alignItems:"center", gap:6}}><Search size={14}/> Deep Dive Results — {dd.agreement}</span>
      </div>
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          marginBottom: 10,
          background: dd.confidence === "high" ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
          border: `1px solid ${dd.confidence === "high" ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.3)"}`,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: dd.confidence === "high" ? "#22c55e" : "#f59e0b",
          }}
        >
          Final Pick: {dd.pick}
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
          Confidence: {dd.confidence?.toUpperCase()} · {dd.agreement}
        </div>
      </div>
      {dd.analyses?.map((a: any, i: number) => (
        <div
          key={i}
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            marginBottom: 6,
            background: "#111",
            border: "1px solid #16161f",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 3 }}>
            Analysis {i + 1} —{" "}
            {i === 0 ? "General" : i === 1 ? "Head to Head / Form" : "Schedule / Line Movement"}
          </div>
          <div style={{ fontSize: 12, color: "#d1d5db", marginBottom: 3 }}>{a.reasoning}</div>
          {a.form && <div style={{ display:"flex", alignItems:"center", gap:6, fontSize: 11, color: "#6b7280" }}><BarChart2 size={11}/> {a.form}</div>}
          {a.edge && <div style={{ display:"flex", alignItems:"center", gap:6, fontSize: 11, color: "#6b7280" }}><Zap size={11}/> {a.edge}</div>}
          {a.warning && <div style={{ display:"flex", alignItems:"center", gap:6, fontSize: 11, color: "#f59e0b" }}><AlertTriangle size={11}/> {a.warning}</div>}
        </div>
      ))}
      <div style={{ display:"flex", alignItems:"center", gap:4, fontSize: 10, color: "#4b5563", marginTop: 6 }}>
        <AlertTriangle size={10}/> Always verify on{" "}
        <a
          href="https://www.espn.com/injuries"
          target="_blank"
          rel="noreferrer"
          style={{ color: "#60a5fa" }}
        >
          ESPN
        </a>{" "}
        before betting real money
      </div>
    </div>
  );
}

// ──────────────────────── BEST PICKS ────────────────────────
function BestPicksPanel({
  games,
  loading,
  error,
  onRefresh,
  nowMs,
  onAddBet,
  onSwitchSection,
}: {
  games: Game[] | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  nowMs: number;
  onAddBet: (b: Omit<PaperBet, "id" | "placedAt" | "status">) => void;
  onSwitchSection: (s: Section) => void;
}) {
  const [analysis, setAnalysis] = useState<Record<string, GameAnalysis>>({});
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
  const [deepDives, setDeepDives] = useState<Record<string, any>>({});
  const [deepDiving, setDeepDiving] = useState<Record<string, boolean>>({});
  const [sport, setSport] = useState<string>("all");

  const picks = useMemo(() => (games ? buildPicks(games) : []), [games]);

  const deepDive = async (
    id: string,
    team1: string,
    team2: string,
    sportLabel: string,
    odds1: any,
    odds2: any,
    context?: string,
  ) => {
    setDeepDiving((prev) => ({ ...prev, [id]: true }));
    try {
      const [analysis1, analysis2, analysis3] = await Promise.all([
        fetch("/api/analyze-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ team1, team2, sport: sportLabel, odds1, odds2, gameTime: "Today", context }),
        }).then((r) => r.json()),
        fetch("/api/analyze-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            team1,
            team2,
            sport: sportLabel,
            odds1,
            odds2,
            gameTime: "Today",
            context:
              (context || "") +
              " Focus on: historical head to head record, home vs away performance, recent streak.",
          }),
        }).then((r) => r.json()),
        fetch("/api/analyze-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            team1,
            team2,
            sport: sportLabel,
            odds1,
            odds2,
            gameTime: "Today",
            context:
              (context || "") +
              " Focus on: weather/venue factors, fatigue/schedule, line movement and sharp money indicators.",
          }),
        }).then((r) => r.json()),
      ]);

      const allPick = [analysis1.pick, analysis2.pick, analysis3.pick];
      const majorityPick = allPick
        .slice()
        .sort(
          (a, b) =>
            allPick.filter((v) => v === a).length - allPick.filter((v) => v === b).length,
        )
        .pop();
      const highConf = [analysis1, analysis2, analysis3].filter((a) => a.confidence === "high").length;

      setDeepDives((prev) => ({
        ...prev,
        [id]: {
          pick: majorityPick,
          confidence: highConf >= 2 ? "high" : highConf >= 1 ? "medium" : "low",
          analyses: [analysis1, analysis2, analysis3],
          agreement: allPick.filter((p) => p === majorityPick).length + "/3 analyses agree",
        },
      }));
    } catch (e) {}
    setDeepDiving((prev) => ({ ...prev, [id]: false }));
  };

  const sports = useMemo(() => {
    const set = new Set<string>();
    picks.forEach((p) => p.game.sport_title && set.add(p.game.sport_title));
    return Array.from(set);
  }, [picks]);

  const filtered = useMemo(() => {
    let list = picks  // picks should already be deduped by buildPicks
    if (sport !== "all") list = list.filter((p) => p.game.sport_title === sport)
    list = list.filter((p) => {
      const t = new Date(p.game.commence_time).getTime()
      return !isFinite(t) || t > nowMs - 3 * 3600_000
    })

    // EXTRA SAFETY DEDUP - ensure only one pick per game
    const seenGames = new Set<string>()
    list = list.filter(p => {
      if (seenGames.has(p.game.id)) return false
      seenGames.add(p.game.id)
      return true
    })

    return list.slice(0, 30)
  }, [picks, sport, nowMs]);

  const analyzeGame = async (p: Pick) => {
    const id = p.game.id;
    if (analyzing.has(id) || analysis[id]) return;
    setAnalyzing((prev) => new Set(prev).add(id));
    try {
      const r = await fetch("/api/analyze-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team1: p.team,
          team2: p.opponentName || "Opponent",
          sport: p.game.sport_title,
          odds1: p.bestPrice,
          odds2: p.opponentOdds ?? -110,
          gameTime: "Today",
        }),
      });
      const data = await r.json();
      if (r.ok) setAnalysis((prev) => ({ ...prev, [id]: data as GameAnalysis }));
    } finally {
      setAnalyzing((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  };

  return (
    <>
      <SectionHeader
        Icon={Target}
        title="Best Picks"
        subtitle="Every pick scored 0-100 by line value and matchup quality"
        right={<RefreshButton loading={loading} onClick={onRefresh} />}
      />

      {sports.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {["all", ...sports].map((s) => (
            <button
              key={s}
              onClick={() => setSport(s)}
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                border: `1px solid ${sport === s ? C.accent : C.border}`,
                background: sport === s ? "rgba(99,102,241,0.15)" : "transparent",
                color: sport === s ? "#a5b4fc" : C.textMuted,
                fontSize: 11.5,
                fontWeight: sport === s ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {s === "all" ? "All sports" : s}
            </button>
          ))}
        </div>
      )}

      {error && filtered.length > 0 && <ErrorBox>{error}</ErrorBox>}
      {!error && loading && games === null && (
        <div style={{ color: C.textMuted, padding: 32, textAlign: "center", fontSize: 13 }}>
          Loading odds…
        </div>
      )}
      {!loading && games && filtered.length === 0 && (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
          }}
        >
          <Radio size={32} style={{ marginBottom: 12, opacity: 0.5, color: C.textMuted }}/>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
            Odds API Credits Used Up
          </div>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
            Free tier resets monthly. 500 credits/month · Currently at limit.
          </div>
          <div style={{ fontSize: 13, color: C.textMuted }}>
            Meanwhile use: Player Props (NBA/MLB stats) · Arb Finder (cached)
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
            <button
              onClick={() => onSwitchSection("props")}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "9px 18px",
                borderRadius: 8,
                border: "none",
                background: C.accent,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                minHeight: 36,
                transition: "all 0.15s",
              }}
            >
              <Activity size={14}/> Player Props
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {filtered.map((p) => {
          const badge = scoreBadge(p.score);
          const cd = countdown(p.game.commence_time, nowMs);
          const a = analysis[p.game.id];
          return (
            <div
              key={`${p.game.id}-${p.team}`}
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{p.team}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    {p.game.away_team} @ {p.game.home_team}
                  </div>
                  <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>
                    {cd.live ? (
                      <span style={{ display:"inline-flex", alignItems:"center", gap:4, color: C.red, fontWeight: 700 }}><span style={{width:6, height:6, borderRadius:"50%", background:C.red, boxShadow:`0 0 8px ${C.red}`}}/> LIVE</span>
                    ) : (
                      `${p.game.sport_title} · ${cd.label}`
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: p.score >= 75 ? C.green : p.score >= 55 ? C.blue : p.score >= 35 ? C.amber : C.textMuted,
                      lineHeight: 1,
                    }}
                  >
                    {p.score}
                  </div>
                  <div style={{ fontSize: 9, color: C.textMuted }}>/ 100</div>
                </div>
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  borderRadius: 6,
                  fontSize: 10.5,
                  fontWeight: 700,
                  background: `${badge.color}26`,
                  color: badge.color,
                  border: `1px solid ${badge.color}40`,
                  marginBottom: 8,
                }}
              >
                {badge.Icon && <badge.Icon size={11}/>}
                {badge.label}
              </div>

              <div style={{ fontSize: 20, fontWeight: 800, color: p.bestPrice > 0 ? C.green : "#fff" }}>
                {p.bestPrice > 0 ? "+" : ""}
                {p.bestPrice}
              </div>
              <div style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 4 }}>
                at <strong style={{ color: C.text }}>{p.bestBook}</strong> · {Math.round(p.impliedProb * 100)}% implied
              </div>
              <div style={{ fontSize: 11.5, color: C.textDim, marginBottom: 10 }}>
                Bet $100 → win ${payoutOn(100, p.bestPrice).toFixed(0)}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() =>
                    onAddBet({
                      type: "best-pick",
                      sport: p.game.sport_title,
                      game: `${p.game.away_team} @ ${p.game.home_team}`,
                      pick: p.team,
                      odds: p.bestPrice,
                      book: p.bestBook,
                      stake: 100,
                      potWin: payoutOn(100, p.bestPrice),
                      notes: `Best Pick score ${p.score}/100`,
                    })
                  }
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: C.card2,
                    color: C.text,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    minHeight: 36,
                  }}
                >
                  + Paper Bet
                </button>
                <button
                  onClick={() => analyzeGame(p)}
                  disabled={analyzing.has(p.game.id) || !!a}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(99,102,241,0.4)",
                    background: analyzing.has(p.game.id) || a ? C.card2 : "rgba(99,102,241,0.08)",
                    color: analyzing.has(p.game.id) || a ? C.textMuted : "#a5b4fc",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: analyzing.has(p.game.id) || a ? "default" : "pointer",
                    minHeight: 36,
                  }}
                >
                  {analyzing.has(p.game.id) ? "Analyzing…" : a ? "Analyzed" : "Analyze"}
                </button>
              </div>

              {a && (
                <div
                  style={{
                    marginTop: 10,
                    background: a.avoid ? "rgba(239,68,68,0.06)" : "rgba(99,102,241,0.06)",
                    border: `1px solid ${a.avoid ? "rgba(239,68,68,0.2)" : "rgba(99,102,241,0.2)"}`,
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: a.avoid ? C.red : "#a5b4fc" }}>
                      {a.avoid ? <span style={{display:"inline-flex", alignItems:"center", gap:4}}><XCircle size={12}/> SKIP</span> : <span style={{display:"inline-flex", alignItems:"center", gap:4}}><CheckCircle size={12}/> Pick: {a.pick}</span>}
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: 4,
                        background:
                          a.confidence === "high"
                            ? "rgba(34,197,94,0.18)"
                            : a.confidence === "medium"
                              ? "rgba(245,158,11,0.18)"
                              : "rgba(107,114,128,0.18)",
                        color:
                          a.confidence === "high"
                            ? C.green
                            : a.confidence === "medium"
                              ? C.amber
                              : C.textMuted,
                      }}
                    >
                      {a.confidence.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.6, marginBottom: 8 }}>
                    {a.reasoning}
                  </div>
                  {a.injuries && a.injuries.toLowerCase() !== "none" && (
                    <div style={{ fontSize: 11.5, color: "#fca5a5", marginBottom: 4 }}>
                      <Shield size={12} style={{display:"inline", verticalAlign:"middle", marginRight:4}}/> <strong>Injuries:</strong> {a.injuries}
                    </div>
                  )}
                  {a.form && (
                    <div style={{ fontSize: 11.5, color: "#86efac", marginBottom: 4 }}>
                      <BarChart2 size={12} style={{display:"inline", verticalAlign:"middle", marginRight:4}}/> <strong>Form:</strong> {a.form}
                    </div>
                  )}
                  {a.edge && (
                    <div style={{ fontSize: 11.5, color: "#c7d2fe", marginBottom: 4 }}>
                      <Zap size={12} style={{display:"inline", verticalAlign:"middle", marginRight:4}}/> <strong>Edge:</strong> {a.edge}
                    </div>
                  )}
                  {a.warning && (
                    <div style={{ fontSize: 11.5, color: "#fde68a", marginBottom: 4 }}>
                      <AlertTriangle size={12} style={{display:"inline", verticalAlign:"middle", marginRight:4}}/> <strong>Warning:</strong> {a.warning}
                    </div>
                  )}
                  <div style={{ fontSize: 10.5, color: "#93c5fd", marginTop: 8 }}>
                    <AlertTriangle size={11} style={{display:"inline", verticalAlign:"middle", marginRight:4}}/> Verify injuries on{" "}
                    <a
                      href="https://www.espn.com/injuries"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#60a5fa", fontWeight: 700 }}
                    >
                      ESPN
                    </a>{" "}
                    before placing real money.
                  </div>
                  {!a.avoid && a.pick !== "SKIP" && (
                    <button
                      onClick={() => {
                        const pick = picks.find((x) => x.game.id === p.game.id && x.team === a.pick);
                        if (!pick) return;
                        onAddBet({
                          type: "best-pick",
                          sport: pick.game.sport_title,
                          game: `${pick.game.away_team} @ ${pick.game.home_team}`,
                          pick: pick.team,
                          odds: pick.bestPrice,
                          book: pick.bestBook,
                          stake: 100,
                          potWin: payoutOn(100, pick.bestPrice),
                          notes: `AI: ${a.confidence} confidence`,
                        });
                      }}
                      style={{
                        marginTop: 10,
                        width: "100%",
                        padding: 9,
                        borderRadius: 8,
                        border: "none",
                        background: C.accent,
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        minHeight: 36,
                      }}
                    >
                      + Paper Bet on {a.pick}
                    </button>
                  )}
                </div>
              )}

              <DeepDiveSection
                id={p.game.id}
                show={!!a}
                onRun={() =>
                  deepDive(
                    p.game.id,
                    p.team,
                    p.opponentName || "Opponent",
                    p.game.sport_title,
                    p.bestPrice,
                    p.opponentOdds ?? -110,
                  )
                }
                deepDives={deepDives}
                deepDiving={deepDiving}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}

// ──────────────────────── ARB FINDER ────────────────────────
type Arb = {
  game: Game;
  team1: { name: string; price: number; book: string };
  team2: { name: string; price: number; book: string };
  roi: number; // negative = arb (book overround < 1)
  profit: number; // on $100 total stake
  stakeA: number;
  stakeB: number;
};

function findArbs(games: Game[]): Arb[] {
  const arbs: Arb[] = [];
  for (const g of games) {
    // best price per team across books
    const best: Record<string, { price: number; book: string }> = {};
    for (const bm of g.bookmakers ?? []) {
      const h2h = bm.markets?.find((m) => m.key === "h2h");
      if (!h2h) continue;
      for (const o of h2h.outcomes) {
        const cur = best[o.name];
        if (!cur || americanToDecimal(o.price) > americanToDecimal(cur.price)) {
          best[o.name] = { price: o.price, book: bm.title };
        }
      }
    }
    const teams = Object.keys(best);
    if (teams.length !== 2) continue;
    const [t1, t2] = teams;
    if (best[t1].book === best[t2].book) continue;
    const d1 = americanToDecimal(best[t1].price);
    const d2 = americanToDecimal(best[t2].price);
    const margin = 1 / d1 + 1 / d2;
    if (margin >= 1) continue; // no arb
    const profitPct = (1 - margin) * 100;
    if (profitPct > 8) continue; // too good — probably stale/wrong, skip
    const stake = 100;
    const stakeA = (stake / d1) / margin;
    const stakeB = (stake / d2) / margin;
    const profit = stake * (1 / margin) - stake;
    arbs.push({
      game: g,
      team1: { name: t1, ...best[t1] },
      team2: { name: t2, ...best[t2] },
      roi: profitPct,
      profit,
      stakeA: Math.round(stakeA * 100) / 100,
      stakeB: Math.round(stakeB * 100) / 100,
    });
  }
  arbs.sort((a, b) => b.roi - a.roi);
  return arbs;
}

// Find prop arbs and middles from raw OddsAPI per-game bookmaker data.
function findPropArbs(games: any[]) {
  const arbs: any[] = [];
  const middles: any[] = [];

  games.forEach((game) => {
    game.bookmakers?.forEach((bk: any) => {
      bk.markets?.forEach((market: any) => {
        const playerOdds: Record<string, any[]> = {};

        market.outcomes?.forEach((outcome: any) => {
          const key = `${outcome.description}_${market.key}`;
          if (!playerOdds[key]) playerOdds[key] = [];
          playerOdds[key].push({ ...outcome, book: bk.title, marketKey: market.key });
        });

        Object.entries(playerOdds).forEach(([key, outcomes]) => {
          const overs = outcomes.filter((o) => o.name === "Over");
          const unders = outcomes.filter((o) => o.name === "Under");
          if (overs.length === 0 || unders.length === 0) return;

          const bestOver = overs.reduce((b, c) => (c.price > b.price ? c : b));
          const bestUnder = unders.reduce((b, c) => (c.price > b.price ? c : b));
          if (bestOver.book === bestUnder.book) return;

          const implOver =
            bestOver.price > 0
              ? 100 / (bestOver.price + 100)
              : Math.abs(bestOver.price) / (Math.abs(bestOver.price) + 100);
          const implUnder =
            bestUnder.price > 0
              ? 100 / (bestUnder.price + 100)
              : Math.abs(bestUnder.price) / (Math.abs(bestUnder.price) + 100);
          const total = implOver + implUnder;

          const player = outcomes[0]?.description || "Unknown";
          const marketLabel = market.key
            .replace("batter_", "")
            .replace("pitcher_", "")
            .replace("player_", "")
            .replace(/_/g, " ");

          if (total < 1) {
            const stake = 1000;
            const betOver = (stake * implOver) / total;
            const betUnder = (stake * implUnder) / total;
            const returnOver =
              betOver *
                (bestOver.price > 0 ? bestOver.price / 100 : 100 / Math.abs(bestOver.price)) +
              betOver;
            const returnUnder =
              betUnder *
                (bestUnder.price > 0 ? bestUnder.price / 100 : 100 / Math.abs(bestUnder.price)) +
              betUnder;
            const profit = Math.min(returnOver, returnUnder) - stake;
            const roi = (profit / stake) * 100;

            if (roi > 0 && roi < 8) {
              arbs.push({
                id: key + "_arb",
                player,
                marketLabel,
                game: `${game.home_team} vs ${game.away_team}`,
                sport: game.sport_key,
                bestOver,
                bestUnder,
                implOver,
                implUnder,
                profit,
                roi,
                stake,
                betOver,
                betUnder,
                type: "arb",
              });
            }
          } else if (total < 1.08) {
            const lineOver = bestOver.point;
            const lineUnder = bestUnder.point;
            if (lineOver && lineUnder && lineUnder > lineOver) {
              middles.push({
                id: key + "_middle",
                player,
                marketLabel,
                game: `${game.home_team} vs ${game.away_team}`,
                sport: game.sport_key,
                bestOver,
                bestUnder,
                lineOver,
                lineUnder,
                middleRange: `${lineOver} - ${lineUnder}`,
                type: "middle",
              });
            }
          }
        });
      });
    });
  });

  return { arbs, middles };
}

function ArbFinderPanel({
  games,
  loading,
  error,
  onRefresh,
  onNotify,
}: {
  games: Game[] | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onNotify: (m: string) => void;
}) {
  const arbs = useMemo(() => (games ? findArbs(games) : []), [games]);
  const [tracked, setTracked] = useState<Arb[]>([]);
  const [arbMode, setArbMode] = useState<"game" | "prop">("game");
  const [propArbGames, setPropArbGames] = useState<any[]>([]);
  const [propArbLoading, setPropArbLoading] = useState(false);
  const [propArbSport, setPropArbSport] = useState("baseball_mlb");
  const [showMiddles, setShowMiddles] = useState(false);

  useEffect(() => {
    setTracked(readLS<Arb[]>(ARBS_TRACKED_KEY, []));
  }, []);

  const fetchPropArbs = useCallback(async (sport: string) => {
    setPropArbLoading(true);
    try {
      const res = await fetch(`/api/player-props?sport=${sport}`);
      const data = await res.json();
      setPropArbGames(data.games || []);
    } catch (e) {}
    setPropArbLoading(false);
  }, []);

  useEffect(() => {
    if (arbMode === "prop") fetchPropArbs(propArbSport);
  }, [arbMode, propArbSport, fetchPropArbs]);

  const trackArb = (a: Arb) => {
    const next = [a, ...tracked];
    setTracked(next);
    writeLS(ARBS_TRACKED_KEY, next);
    onNotify("✓ Arb tracked");
  };

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px",
    borderRadius: 999,
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? "rgba(99,102,241,0.15)" : "transparent",
    color: active ? "#a5b4fc" : C.textMuted,
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    cursor: "pointer",
  });

  return (
    <>
      <SectionHeader
        Icon={Wallet}
        title="Arb Finder"
        subtitle="Risk-free profit by hedging both sides across books. ROI capped at 8% (anything higher is usually stale)."
        right={<RefreshButton loading={loading} onClick={onRefresh} />}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={() => setArbMode("game")} style={pillStyle(arbMode === "game")}>
          <span style={{display:"inline-flex", alignItems:"center", gap:6}}><Wallet size={12}/> Game Arbs</span>
        </button>
        <button onClick={() => setArbMode("prop")} style={pillStyle(arbMode === "prop")}>
          <span style={{display:"inline-flex", alignItems:"center", gap:6}}><Activity size={12}/> Prop Arbs</span>
        </button>
      </div>

      {arbMode === "prop" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {[
              { id: "baseball_mlb", label: "MLB" },
              { id: "basketball_nba", label: "NBA" },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setPropArbSport(s.id)}
                style={pillStyle(propArbSport === s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {propArbLoading ? (
            <div style={{ color: C.textMuted, textAlign: "center", padding: 32 }}>
              Scanning prop lines across 8 bookmakers…
            </div>
          ) : (
            (() => {
              const { arbs: propArbs, middles } = findPropArbs(propArbGames);
              return (
                <div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <button onClick={() => setShowMiddles(false)} style={pillStyle(!showMiddles)}>
                      <span style={{display:"inline-flex", alignItems:"center", gap:6}}><Wallet size={12}/> True Arbs ({propArbs.length})</span>
                    </button>
                    <button onClick={() => setShowMiddles(true)} style={pillStyle(showMiddles)}>
                      <span style={{display:"inline-flex", alignItems:"center", gap:6}}><Target size={12}/> Middles ({middles.length})</span>
                    </button>
                  </div>

                  {!showMiddles && propArbs.length === 0 && (
                    <div
                      style={{
                        background: "#111",
                        border: "1px solid #16161f",
                        borderRadius: 12,
                        padding: 32,
                        textAlign: "center",
                      }}
                    >
                      <Radio size={24} style={{ marginBottom: 8, opacity: 0.5 }}/>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
                        No prop arbs right now
                      </div>
                      <div style={{ fontSize: 13, color: "#6b7280" }}>
                        Markets are efficient — check back when games start. Arbs appear 1-2 hours
                        before game time.
                      </div>
                    </div>
                  )}

                  {showMiddles && middles.length === 0 && (
                    <div
                      style={{
                        background: "#111",
                        border: "1px solid #16161f",
                        borderRadius: 12,
                        padding: 32,
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 13, color: "#6b7280" }}>No middles found right now</div>
                    </div>
                  )}

                  {!showMiddles &&
                    propArbs.map((arb) => (
                      <div
                        key={arb.id}
                        style={{
                          background: "#111",
                          border: "1px solid rgba(34,197,94,0.4)",
                          borderRadius: 12,
                          padding: 16,
                          marginBottom: 12,
                          boxShadow: "0 0 20px rgba(34,197,94,0.05)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{arb.player}</div>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>
                              {arb.game} · {arb.marketLabel}
                            </div>
                          </div>
                          <div
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              background: "rgba(34,197,94,0.15)",
                              color: "#22c55e",
                              fontSize: 12,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                            }}
                          >
                            ✓ PROP ARB
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                          <div style={{ background: "#1a1a24", borderRadius: 8, padding: 10 }}>
                            <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>
                              OVER at {arb.bestOver.book}
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: "#22c55e" }}>
                              {arb.bestOver.price > 0 ? "+" : ""}
                              {arb.bestOver.price}
                            </div>
                            {arb.bestOver.point != null && (
                              <div style={{ fontSize: 12, color: "#9ca3af" }}>Line: {arb.bestOver.point}</div>
                            )}
                            <div style={{ fontSize: 12, color: "#22c55e", marginTop: 4 }}>
                              Bet ${arb.betOver.toFixed(2)}
                            </div>
                          </div>
                          <div style={{ background: "#1a1a24", borderRadius: 8, padding: 10 }}>
                            <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>
                              UNDER at {arb.bestUnder.book}
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: "#22c55e" }}>
                              {arb.bestUnder.price > 0 ? "+" : ""}
                              {arb.bestUnder.price}
                            </div>
                            {arb.bestUnder.point != null && (
                              <div style={{ fontSize: 12, color: "#9ca3af" }}>Line: {arb.bestUnder.point}</div>
                            )}
                            <div style={{ fontSize: 12, color: "#22c55e", marginTop: 4 }}>
                              Bet ${arb.betUnder.toFixed(2)}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            background: "rgba(34,197,94,0.08)",
                            border: "1px solid rgba(34,197,94,0.2)",
                            borderRadius: 8,
                            padding: 12,
                            marginBottom: 10,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 16, fontWeight: 800, color: "#22c55e" }}>
                            <Wallet size={16}/> +${arb.profit.toFixed(2)} guaranteed · {arb.roi.toFixed(2)}% ROI
                          </div>
                          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                            On $1,000 total stake · Different bookmakers
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            const bet = {
                              id: Date.now(),
                              type: "prop_arb",
                              sport: arb.sport,
                              game: arb.player + " — " + arb.marketLabel,
                              pick: `OVER at ${arb.bestOver.book} + UNDER at ${arb.bestUnder.book}`,
                              odds: 0,
                              book: "Multiple",
                              stake: 1000,
                              potWin: arb.profit,
                              status: "pending",
                              placedAt: new Date().toISOString(),
                              notes: `Prop arb: $${arb.betOver.toFixed(2)} OVER at ${arb.bestOver.book} + $${arb.betUnder.toFixed(2)} UNDER at ${arb.bestUnder.book}`,
                            };
                            const ex = JSON.parse(localStorage.getItem("sports_paper_bets") || "[]");
                            localStorage.setItem("sports_paper_bets", JSON.stringify([bet, ...ex]));
                            onNotify("Prop arb tracked!");
                          }}
                          style={{
                            width: "100%",
                            padding: 10,
                            borderRadius: 8,
                            border: "none",
                            background: "#22c55e",
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          + Track This Prop Arb
                        </button>
                      </div>
                    ))}

                  {showMiddles &&
                    middles.map((mid) => (
                      <div
                        key={mid.id}
                        style={{
                          background: "#111",
                          border: "1px solid rgba(99,102,241,0.4)",
                          borderRadius: 12,
                          padding: 16,
                          marginBottom: 12,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{mid.player}</div>
                            <div style={{ fontSize: 12, color: "#6b7280" }}>
                              {mid.game} · {mid.marketLabel}
                            </div>
                          </div>
                          <div
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              background: "rgba(99,102,241,0.15)",
                              color: "#a5b4fc",
                              fontSize: 12,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span style={{display:"inline-flex", alignItems:"center", gap:4}}><Target size={12}/> MIDDLE</span>
                          </div>
                        </div>

                        <div
                          style={{
                            background: "rgba(99,102,241,0.05)",
                            border: "1px solid rgba(99,102,241,0.2)",
                            borderRadius: 8,
                            padding: 12,
                            marginBottom: 10,
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#a5b4fc", marginBottom: 4 }}>
                            Middle range: {mid.middleRange}
                          </div>
                          <div style={{ fontSize: 12, color: "#9ca3af" }}>
                            Bet OVER {mid.lineOver} at {mid.bestOver.book} + UNDER {mid.lineUnder} at{" "}
                            {mid.bestUnder.book}
                          </div>
                          <div style={{ fontSize: 12, color: "#a5b4fc", marginTop: 4 }}>
                            If {mid.player} scores between {mid.lineOver} and {mid.lineUnder} — BOTH bets win!
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div style={{ background: "#1a1a24", borderRadius: 8, padding: 10, textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: "#6b7280" }}>OVER {mid.lineOver}</div>
                            <div style={{ fontSize: 16, fontWeight: 700 }}>{mid.bestOver.book}</div>
                            <div style={{ fontSize: 14, color: "#22c55e" }}>
                              {mid.bestOver.price > 0 ? "+" : ""}
                              {mid.bestOver.price}
                            </div>
                          </div>
                          <div style={{ background: "#1a1a24", borderRadius: 8, padding: 10, textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: "#6b7280" }}>UNDER {mid.lineUnder}</div>
                            <div style={{ fontSize: 16, fontWeight: 700 }}>{mid.bestUnder.book}</div>
                            <div style={{ fontSize: 14, color: "#22c55e" }}>
                              {mid.bestUnder.price > 0 ? "+" : ""}
                              {mid.bestUnder.price}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              );
            })()
          )}
        </>
      )}

      {arbMode === "game" && (
        <>
      {error && <ErrorBox>{error}</ErrorBox>}
      {!error && loading && games === null && (
        <div style={{ color: C.textMuted, padding: 32, textAlign: "center" }}>Loading odds…</div>
      )}
      {!loading && games && arbs.length === 0 && (
        <div
          style={{
            color: C.textMuted,
            padding: 32,
            textAlign: "center",
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
          }}
        >
          No arbs right now. Markets are efficient — check back later.
        </div>
      )}
      <div style={{ display: "grid", gap: 12 }}>
        {arbs.map((a, i) => (
          <div
            key={`${a.game.id}-${i}`}
            style={{
              background: C.card,
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  {a.game.away_team} @ {a.game.home_team}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{a.game.sport_title}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.green }}>
                  +{a.roi.toFixed(2)}%
                </div>
                <div style={{ fontSize: 10, color: C.textMuted }}>guaranteed ROI</div>
              </div>
            </div>
            <div
              style={{
                background: C.card2,
                borderRadius: 8,
                padding: 10,
                fontSize: 12,
                color: C.textDim,
                lineHeight: 1.7,
                marginBottom: 10,
              }}
            >
              Bet <strong style={{ color: C.text }}>${a.stakeA.toFixed(2)}</strong> on{" "}
              <strong style={{ color: C.green }}>{a.team1.name}</strong> ({a.team1.price > 0 ? "+" : ""}
              {a.team1.price}) at <strong style={{ color: C.text }}>{a.team1.book}</strong>
              <br />+ <strong style={{ color: C.text }}>${a.stakeB.toFixed(2)}</strong> on{" "}
              <strong style={{ color: C.green }}>{a.team2.name}</strong> ({a.team2.price > 0 ? "+" : ""}
              {a.team2.price}) at <strong style={{ color: C.text }}>{a.team2.book}</strong>
              <br />= <strong style={{ color: C.green }}>${a.profit.toFixed(2)} profit</strong> on $100
            </div>
            <button
              onClick={() => trackArb(a)}
              style={{
                width: "100%",
                padding: 9,
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: C.card2,
                color: C.text,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                minHeight: 36,
              }}
            >
              + Track Arb
            </button>
          </div>
        ))}
      </div>

      {tracked.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.textDim, marginTop: 24, marginBottom: 8 }}>
            Tracked ({tracked.length})
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {tracked.slice(0, 10).map((a, i) => (
              <div
                key={i}
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: 10,
                  fontSize: 11.5,
                  color: C.textDim,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>
                  {a.team1.name} ({a.team1.book}) vs {a.team2.name} ({a.team2.book})
                </span>
                <span style={{ color: C.green, fontWeight: 700 }}>+{a.roi.toFixed(2)}%</span>
              </div>
            ))}
            <button
              onClick={() => {
                setTracked([]);
                writeLS(ARBS_TRACKED_KEY, []);
              }}
              style={{
                marginTop: 4,
                padding: "6px 12px",
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                background: "transparent",
                color: C.textMuted,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Clear tracked
            </button>
          </div>
        </>
      )}
        </>
      )}
    </>
  );
}

// ──────────────────────── PARLAYS ────────────────────────
type ParlayLeg = {
  gameId: string;
  team: string;
  price: number;
  book: string;
  matchup: string;
  impliedProb: number;
};
type ParlaySuggestion = {
  book: string;
  legs: ParlayLeg[];
  combinedDecimal: number;
  combinedAmerican: number;
  payoutOn100: number;
  winProb: number;
  ev: number;
};

function buildParlays(games: Game[]): ParlaySuggestion[] {
  // Group best picks by book — only use picks from same bookmaker so parlay is placeable.
  const byBook: Record<string, ParlayLeg[]> = {};
  for (const g of games) {
    for (const bm of g.bookmakers ?? []) {
      const h2h = bm.markets?.find((m) => m.key === "h2h");
      if (!h2h) continue;
      for (const o of h2h.outcomes) {
        const implied = americanToImplied(o.price);
        // Prefer slight favorites (40-65% implied) so parlays don't blow up the EV.
        if (implied < 0.4 || implied > 0.65) continue;
        if (!byBook[bm.title]) byBook[bm.title] = [];
        byBook[bm.title].push({
          gameId: g.id,
          team: o.name,
          price: o.price,
          book: bm.title,
          matchup: `${g.away_team} @ ${g.home_team}`,
          impliedProb: implied,
        });
      }
    }
  }

  const suggestions: ParlaySuggestion[] = [];
  for (const book of Object.keys(byBook)) {
    // Sort by implied prob (highest = safest) and dedupe by game
    const legs = byBook[book]
      .sort((a, b) => b.impliedProb - a.impliedProb)
      .filter((leg, i, arr) => arr.findIndex((x) => x.gameId === leg.gameId) === i);

    for (const size of [2, 3, 4]) {
      if (legs.length < size) continue;
      const picked = legs.slice(0, size);
      const combinedDecimal = picked.reduce((acc, l) => acc * americanToDecimal(l.price), 1);
      const combinedAmerican =
        combinedDecimal >= 2
          ? Math.round((combinedDecimal - 1) * 100)
          : Math.round(-100 / (combinedDecimal - 1));
      const winProb = picked.reduce((acc, l) => acc * l.impliedProb, 1);
      const payoutOn100 = 100 * combinedDecimal - 100;
      const ev = winProb * payoutOn100 - (1 - winProb) * 100;
      suggestions.push({
        book,
        legs: picked,
        combinedDecimal,
        combinedAmerican,
        payoutOn100,
        winProb,
        ev,
      });
    }
  }

  suggestions.sort((a, b) => b.ev - a.ev);
  return suggestions.slice(0, 6);
}

function ParlaysPanel({
  games,
  loading,
  error,
  onRefresh,
  onAddBet,
}: {
  games: Game[] | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onAddBet: (b: Omit<PaperBet, "id" | "placedAt" | "status">) => void;
}) {
  const parlays = useMemo(() => (games ? buildParlays(games) : []), [games]);
  const [saved, setSaved] = useState<ParlaySuggestion[]>([]);
  useEffect(() => {
    setSaved(readLS<ParlaySuggestion[]>(PARLAYS_KEY, []));
  }, []);

  const save = (p: ParlaySuggestion) => {
    const next = [p, ...saved];
    setSaved(next);
    writeLS(PARLAYS_KEY, next);
  };

  return (
    <>
      <SectionHeader
        Icon={Award}
        title="Parlays"
        subtitle="Auto-suggested 2-4 leg parlays grouped by bookmaker. EV shown honestly — most parlays are bad bets."
        right={<RefreshButton loading={loading} onClick={onRefresh} />}
      />
      {error && <ErrorBox>{error}</ErrorBox>}
      {!error && loading && games === null && (
        <div style={{ color: C.textMuted, padding: 32, textAlign: "center" }}>Loading odds…</div>
      )}
      {!loading && games && parlays.length === 0 && (
        <div
          style={{
            color: C.textMuted,
            padding: 32,
            textAlign: "center",
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
          }}
        >
          Not enough qualifying picks for parlay suggestions.
        </div>
      )}
      <div style={{ display: "grid", gap: 12 }}>
        {parlays.map((p, i) => (
          <div
            key={i}
            style={{
              background: C.card,
              border: `1px solid ${p.ev > 0 ? "rgba(34,197,94,0.3)" : C.border}`,
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  {p.legs.length}-leg parlay · {p.book}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted }}>
                  {(p.winProb * 100).toFixed(1)}% win probability
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: p.combinedAmerican > 0 ? C.green : "#fff",
                  }}
                >
                  {p.combinedAmerican > 0 ? "+" : ""}
                  {p.combinedAmerican}
                </div>
                <div style={{ fontSize: 10, color: C.textMuted }}>
                  $100 → win ${p.payoutOn100.toFixed(0)}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
              {p.legs.map((l, j) => (
                <div
                  key={j}
                  style={{
                    background: C.card2,
                    borderRadius: 6,
                    padding: "7px 10px",
                    fontSize: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ color: C.text }}>{l.team}</strong>
                    <div style={{ fontSize: 10, color: C.textMuted }}>{l.matchup}</div>
                  </div>
                  <div style={{ color: l.price > 0 ? C.green : C.text, fontWeight: 700, fontSize: 13 }}>
                    {l.price > 0 ? "+" : ""}
                    {l.price}
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: p.ev > 0 ? C.green : C.red,
                marginBottom: 10,
                fontWeight: 700,
              }}
            >
              {p.ev > 0
                ? <span style={{display:"inline-flex", alignItems:"center", gap:4}}><CheckCircle size={12}/> Expected value: +${p.ev.toFixed(2)} per $100</span>
                : <span style={{display:"inline-flex", alignItems:"center", gap:4}}><XCircle size={12}/> Expected value: −${Math.abs(p.ev).toFixed(2)} per $100 — house edge</span>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => save(p)}
                style={{
                  flex: 1,
                  padding: 9,
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: C.card2,
                  color: C.text,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  minHeight: 36,
                }}
              >
                + Save Parlay
              </button>
              <button
                onClick={() =>
                  onAddBet({
                    type: "parlay",
                    sport: "Mixed",
                    game: p.legs.map((l) => l.matchup).join(" + "),
                    pick: p.legs.map((l) => l.team).join(" / "),
                    odds: p.combinedAmerican,
                    book: p.book,
                    stake: 100,
                    potWin: p.payoutOn100,
                    notes: `${p.legs.length}-leg parlay, ${(p.winProb * 100).toFixed(1)}% win prob`,
                  })
                }
                style={{
                  flex: 1,
                  padding: 9,
                  borderRadius: 8,
                  border: "none",
                  background: C.accent,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  minHeight: 36,
                }}
              >
                + Paper Bet
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ──────────────────────── PLAYER PROPS ────────────────────────
type NbaPlayer = {
  id: number;
  name: string;
  team: string;
  gp: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  fg_pct: number;
};
type MlbPlayer = {
  id: number;
  name: string;
  team: string;
  avg: string;
  homeRuns: number;
  rbi: number;
  hits: number;
  ops: string;
  atBats: number;
  runs: number;
  gamesPlayed: number;
};

type Confidence = "HIGH" | "MEDIUM" | "LOW";
type PropBet = {
  id: string;
  player: string;
  team: string;
  prop: string;
  propLower: string;
  line: number;
  avg: number;
  avgDisplay: string;
  pick: "OVER";
  edge: number;
  edgePct: number;
  confidence: Confidence;
  odds: number;
  sport: "NBA" | "MLB";
};

const CONF_ORDER: Record<Confidence, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

// Generate ranked prop bet candidates from season averages. Lines are
// synthetic: NBA = 15% below avg rounded to nearest 0.5; MLB HR = 25% below
// avg rounded to nearest 0.1; MLB hits = 15% below avg rounded to 0.5. The
// "edge" is the gap between season avg and the line — bigger = better OVER.
function generatePropBets(
  nba: NbaPlayer[],
  mlb: MlbPlayer[],
  sport: "nba" | "mlb",
): PropBet[] {
  const out: PropBet[] = [];

  if (sport === "nba") {
    for (const p of nba) {
      const push = (
        key: string,
        prop: string,
        avg: number,
        decimals: 1 | 2,
        highEdge: number,
        medEdge: number,
      ) => {
        const line = Math.round(avg * 0.85 * 2) / 2;
        const edge = avg - line;
        if (edge <= 0) return;
        const confidence: Confidence =
          edge > highEdge ? "HIGH" : edge > medEdge ? "MEDIUM" : "LOW";
        out.push({
          id: `${p.id}_${key}`,
          player: p.name,
          team: p.team,
          prop,
          propLower: prop.toLowerCase(),
          line,
          avg,
          avgDisplay: avg.toFixed(decimals),
          pick: "OVER",
          edge,
          edgePct: Math.round((edge / avg) * 100),
          confidence,
          odds: -110,
          sport: "NBA",
        });
      };
      if (p.ppg > 10) push("pts", "Points", p.ppg, 1, 5, 2);
      if (p.rpg > 4) push("reb", "Rebounds", p.rpg, 1, 2, 1);
      if (p.apg > 3) push("ast", "Assists", p.apg, 1, 2, 1);
    }
  } else {
    for (const p of mlb) {
      const games = 162;
      const hr = p.homeRuns || 0;
      const hits = p.hits || 0;
      const hrPerGame = hr / games;
      const hitsPerGame = hits / games;

      if (hrPerGame > 0.1) {
        const line = Math.round(hrPerGame * 0.75 * 10) / 10;
        const edge = hrPerGame - line;
        const confidence: Confidence =
          hrPerGame > 0.3 ? "HIGH" : hrPerGame > 0.2 ? "MEDIUM" : "LOW";
        out.push({
          id: `${p.id}_hr`,
          player: p.name,
          team: p.team,
          prop: "Home Runs/Game",
          propLower: "home runs/game",
          line,
          avg: hrPerGame,
          avgDisplay: hrPerGame.toFixed(3),
          pick: "OVER",
          edge,
          edgePct: edge > 0 ? Math.round((edge / hrPerGame) * 100) : 0,
          confidence,
          odds: -110,
          sport: "MLB",
        });
      }

      if (hitsPerGame > 0.5) {
        const line = Math.round(hitsPerGame * 0.85 * 2) / 2;
        const edge = hitsPerGame - line;
        out.push({
          id: `${p.id}_hits`,
          player: p.name,
          team: p.team,
          prop: "Hits/Game",
          propLower: "hits/game",
          line,
          avg: hitsPerGame,
          avgDisplay: hitsPerGame.toFixed(2),
          pick: "OVER",
          edge,
          edgePct: edge > 0 ? Math.round((edge / hitsPerGame) * 100) : 0,
          confidence: "MEDIUM",
          odds: -110,
          sport: "MLB",
        });
      }
    }
  }

  // Sort by confidence (HIGH > MEDIUM > LOW), then edge% descending.
  return out.sort((a, b) => {
    const c = CONF_ORDER[a.confidence] - CONF_ORDER[b.confidence];
    return c !== 0 ? c : b.edgePct - a.edgePct;
  });
}

function PlayerPropsPanel({
  onAddBet,
  onSwitchSection,
}: {
  onAddBet: (b: Omit<PaperBet, "id" | "placedAt" | "status">) => void;
  onSwitchSection: (s: Section) => void;
}) {
  const [sport, setSport] = useState<"all" | "nba" | "mlb">("all");
  const [nba, setNba] = useState<NbaPlayer[]>([]);
  const [mlb, setMlb] = useState<MlbPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [analysis, setAnalysis] = useState<Record<string, GameAnalysis>>({});
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
  const [deepDives, setDeepDives] = useState<Record<string, any>>({});
  const [deepDiving, setDeepDiving] = useState<Record<string, boolean>>({});
  const [propsMode, setPropsMode] = useState<"avg" | "real">("avg");
  const [realPropLines, setRealPropLines] = useState<any[]>([]);
  const [realPropsLoading, setRealPropsLoading] = useState(false);

  const deepDive = async (
    id: string,
    team1: string,
    team2: string,
    sportLabel: string,
    odds1: any,
    odds2: any,
    context?: string,
  ) => {
    setDeepDiving((prev) => ({ ...prev, [id]: true }));
    try {
      const [analysis1, analysis2, analysis3] = await Promise.all([
        fetch("/api/analyze-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ team1, team2, sport: sportLabel, odds1, odds2, gameTime: "Today", context }),
        }).then((r) => r.json()),
        fetch("/api/analyze-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            team1,
            team2,
            sport: sportLabel,
            odds1,
            odds2,
            gameTime: "Today",
            context:
              (context || "") +
              " Focus on: historical head to head record, home vs away performance, recent streak.",
          }),
        }).then((r) => r.json()),
        fetch("/api/analyze-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            team1,
            team2,
            sport: sportLabel,
            odds1,
            odds2,
            gameTime: "Today",
            context:
              (context || "") +
              " Focus on: weather/venue factors, fatigue/schedule, line movement and sharp money indicators.",
          }),
        }).then((r) => r.json()),
      ]);

      const allPick = [analysis1.pick, analysis2.pick, analysis3.pick];
      const majorityPick = allPick
        .slice()
        .sort(
          (a, b) =>
            allPick.filter((v) => v === a).length - allPick.filter((v) => v === b).length,
        )
        .pop();
      const highConf = [analysis1, analysis2, analysis3].filter((a) => a.confidence === "high").length;

      setDeepDives((prev) => ({
        ...prev,
        [id]: {
          pick: majorityPick,
          confidence: highConf >= 2 ? "high" : highConf >= 1 ? "medium" : "low",
          analyses: [analysis1, analysis2, analysis3],
          agreement: allPick.filter((p) => p === majorityPick).length + "/3 analyses agree",
        },
      }));
    } catch (e) {}
    setDeepDiving((prev) => ({ ...prev, [id]: false }));
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nbaRes, mlbRes] = await Promise.all([
        fetch(`/api/players?sport=nba&search=${search}`),
        fetch("/api/players?sport=mlb"),
      ]);
      const nbaData = await nbaRes.json();
      const mlbData = await mlbRes.json();
      if (!nbaRes.ok && !mlbRes.ok) {
        setError(nbaData.error ?? mlbData.error ?? "Failed to load players");
      }
      setNba(((nbaData.data as NbaPlayer[]) ?? []).sort((a, b) => b.ppg - a.ppg));
      setMlb(((mlbData.players as MlbPlayer[]) ?? []).sort((a, b) => b.homeRuns - a.homeRuns));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scoredBets = useMemo(() => {
    const nbaBets = generatePropBets(nba, [], "nba");
    const mlbBets = generatePropBets([], mlb, "mlb");
    const all = [...nbaBets, ...mlbBets];
    return all
      .map((b) => ({
        ...b,
        propScore: Math.min(
          100,
          Math.round(
            b.edgePct * 3 +
              (b.confidence === "HIGH" ? 20 : b.confidence === "MEDIUM" ? 10 : 0) +
              (b.pick === "OVER" ? 5 : 0),
          ),
        ),
      }))
      .sort((a, b) => b.propScore - a.propScore);
  }, [nba, mlb]);

  const bets = useMemo(() => {
    if (sport === "all") return scoredBets;
    return scoredBets.filter((b) => b.sport.toLowerCase() === sport);
  }, [scoredBets, sport]);

  const strongCount = bets.filter((b) => b.edgePct > 20).length;

  const placeBet = (b: PropBet) => {
    onAddBet({
      type: "prop",
      sport: b.sport,
      game: `${b.player} — ${b.prop}`,
      pick: `${b.pick} ${b.line} ${b.prop}`,
      odds: -110,
      book: "DraftKings",
      stake: 110,
      potWin: 100,
      notes: `Avg ${b.avgDisplay} vs line ${b.line} — ${b.edgePct}% edge`,
    });
    alert(`Placed paper bet: ${b.pick} ${b.line} ${b.prop} for ${b.player}`);
  };

  const analyzeProp = async (b: PropBet) => {
    if (analyzing.has(b.id) || analysis[b.id]) return;
    setAnalyzing((prev) => new Set(prev).add(b.id));
    try {
      const r = await fetch("/api/analyze-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team1: b.player,
          team2: b.pick === "OVER" ? `OVER ${b.line}` : `UNDER ${b.line}`,
          sport: b.sport,
          odds1: -110,
          odds2: -110,
          gameTime: "Today",
          context: `Player prop bet: ${b.player} (${b.team}) — ${b.prop} ${b.pick} ${b.line}. Season average: ${b.avg}. Statistical edge: ${b.edgePct}% above the line.`,
        }),
      });
      const data = await r.json();
      if (r.ok) setAnalysis((prev) => ({ ...prev, [b.id]: data as GameAnalysis }));
    } finally {
      setAnalyzing((prev) => {
        const n = new Set(prev);
        n.delete(b.id);
        return n;
      });
    }
  };

  const fetchRealProps = useCallback(async () => {
    setRealPropsLoading(true);
    try {
      const apiSport = sport === "nba" ? "basketball_nba" : "baseball_mlb";
      const res = await fetch(`/api/player-props?sport=${apiSport}`);
      const data = await res.json();
      const props: any[] = [];
      (data.games || []).forEach((game: any) => {
        game.bookmakers?.forEach((bk: any) => {
          bk.markets?.forEach((market: any) => {
            const playerGroups: Record<string, any[]> = {};
            market.outcomes?.forEach((outcome: any) => {
              const key = `${outcome.description}_${market.key}`;
              if (!playerGroups[key]) playerGroups[key] = [];
              playerGroups[key].push({ ...outcome, book: bk.title });
            });
            Object.entries(playerGroups).forEach(([key, outcomes]) => {
              const over = outcomes.find((o) => o.name === "Over");
              const under = outcomes.find((o) => o.name === "Under");
              if (!over && !under) return;
              const player = outcomes[0]?.description || "";
              const line = over?.point ?? under?.point;
              const marketLabel = market.key
                .replace("batter_", "")
                .replace("pitcher_", "")
                .replace("player_", "")
                .replace(/_/g, " ")
                .replace(/\b\w/g, (l: string) => l.toUpperCase());
              props.push({
                id: key + "_" + bk.key,
                player,
                line,
                marketLabel,
                game: `${game.home_team} vs ${game.away_team}`,
                sport: game.sport_key,
                overOdds: over?.price,
                underOdds: under?.price,
                overBook: over?.book || bk.title,
                underBook: under?.book || bk.title,
                gameTime: game.commence_time,
              });
            });
          });
        });
      });
      setRealPropLines(props);
    } catch (e) {}
    setRealPropsLoading(false);
  }, [sport]);

  useEffect(() => {
    if (propsMode === "real") fetchRealProps();
  }, [propsMode, sport, fetchRealProps]);

  // Score a real-line prop 0-100 against our season-avg player data.
  const scoreRealProp = (prop: any) => {
    const isNba = prop.sport?.includes("basketball");
    const players: any[] = isNba ? nba : mlb;
    const playerName = (prop.player || "").toLowerCase();
    const player = players.find((p: any) => {
      const name = (p.name || "").toLowerCase();
      const lastName = name.split(" ").slice(-1)[0] || "";
      return name.includes(playerName) || (lastName && playerName.includes(lastName));
    });
    if (!player) return { score: 50, pick: null as null | "OVER" | "UNDER", avg: null as number | null, edgePct: 0 };

    const label = prop.marketLabel || "";
    const avg = isNba
      ? label.includes("Point")
        ? player.ppg
        : label.includes("Rebound")
          ? player.rpg
          : label.includes("Assist")
            ? player.apg
            : null
      : label.includes("Hit")
        ? (player.hits || 0) / 162
        : label.includes("Home")
          ? (player.homeRuns || 0) / 162
          : label.toLowerCase().includes("rbi")
            ? (player.rbi || 0) / 162
            : null;

    if (!avg || prop.line == null)
      return { score: 50, pick: null as null | "OVER" | "UNDER", avg, edgePct: 0 };
    const diff = avg - prop.line;
    const edgePct = Math.abs((diff / avg) * 100);
    const pick: "OVER" | "UNDER" = diff > 0 ? "OVER" : "UNDER";
    const score = Math.min(100, Math.round(50 + edgePct * 2));
    return { score, pick, avg, diff, edgePct };
  };

  const scoredRealProps = useMemo(
    () =>
      realPropLines
        .map((p) => ({ ...p, ...scoreRealProp(p) }))
        .sort((a, b) => b.score - a.score),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [realPropLines, nba, mlb],
  );

  const PropMarketCountdown = () => {
    const [timeInfo, setTimeInfo] = useState("");
    const [nextWindow, setNextWindow] = useState("");

    useEffect(() => {
      const update = () => {
        const estHour = parseInt(
          new Date().toLocaleString("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: "America/New_York",
          }),
        );
        if (estHour >= 15 && estHour < 22) {
          setTimeInfo("Props should be open — markets may be between games");
          setNextWindow("");
        } else if (estHour < 15) {
          const hoursUntil = 15 - estHour;
          setTimeInfo(`Prop markets open in about ${hoursUntil} hour${hoursUntil === 1 ? "" : "s"}`);
          setNextWindow("Markets typically open 3-4 PM EST when books post afternoon/evening lines");
        } else {
          setTimeInfo("Today's props have closed — games are underway or finished");
          setNextWindow("Check back tomorrow afternoon around 3 PM EST");
        }
      };
      update();
      const interval = setInterval(update, 60000);
      return () => clearInterval(interval);
    }, []);

    const slots = [
      { time: "12 PM - 2 PM", status: "Some afternoon game props open", active: false },
      { time: "3 PM - 5 PM", status: "Main prop lines start posting", active: true },
      { time: "5 PM - 7 PM", status: "Most props available — best time to check", active: true },
      { time: "7 PM - 10 PM", status: "Games starting — props close at first pitch", active: true },
      { time: "After 10 PM", status: "Props closed for the day", active: false },
    ];

    return (
      <div
        style={{
          background: "#111",
          border: "1px solid #16161f",
          borderRadius: 12,
          padding: 32,
          textAlign: "center",
        }}
      >
        <Clock size={36} style={{ marginBottom: 12, opacity: 0.5, color: C.textMuted }}/>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
          No Real Prop Lines Right Now
        </div>
        <div style={{ fontSize: 14, color: "#a5b4fc", marginBottom: 8, fontWeight: 600 }}>
          {timeInfo}
        </div>
        {nextWindow && (
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>{nextWindow}</div>
        )}

        <div
          style={{
            background: "#1a1a24",
            borderRadius: 10,
            padding: 16,
            marginBottom: 20,
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#6b7280",
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            When Prop Lines Are Available (EST)
          </div>
          {slots.map((slot, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0",
                borderBottom: i < slots.length - 1 ? "1px solid #2a2a3a" : "none",
              }}
            >
              <span style={{ fontSize: 12, color: "#9ca3af", width: 130 }}>{slot.time}</span>
              <span style={{ fontSize: 12, color: slot.active ? "#22c55e" : "#4b5563" }}>
                {slot.status}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            background: "rgba(99,102,241,0.05)",
            border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            textAlign: "left",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#a5b4fc", marginBottom: 6 }}>
            <span style={{display:"inline-flex", alignItems:"center", gap:6}}><Zap size={14}/> Pro Tips</span>
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>
            • Prop lines post closest to game time — check 2-3 hours before first pitch
            <br />• Lines move fast — arbs disappear in minutes once books notice
            <br />• MLB games typically start 7-10 PM EST on weekdays
            <br />• NBA/NFL props available in their respective seasons
          </div>
        </div>

        <button
          onClick={() => fetchRealProps()}
          style={{
            padding: "10px 24px",
            borderRadius: 8,
            border: "none",
            background: "#6366f1",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <span style={{display:"inline-flex", alignItems:"center", gap:6}}><RefreshCw size={12}/> Check Again Now</span>
        </button>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #16161f" }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
            Meanwhile — these always work:
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => setPropsMode("avg")}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #16161f",
                background: "transparent",
                color: "#a5b4fc",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <span style={{display:"inline-flex", alignItems:"center", gap:6}}><BarChart2 size={12}/> Season Average Picks</span>
            </button>
            <button
              onClick={() => onSwitchSection("best")}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "9px 18px",
                borderRadius: 8,
                border: "1px solid #16161f",
                background: "transparent",
                color: "#a5b4fc",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <Target size={12}/> Best Game Picks
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <SectionHeader
        Icon={Activity}
        title="Player Props — Best Bets Today"
        subtitle="Ranked by statistical edge vs standard prop lines"
        right={<RefreshButton loading={loading} onClick={load} />}
      />

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {[
          { id: "avg" as const, label: "Season Average Picks", Icon: BarChart2 },
          { id: "real" as const, label: "Real Lines", Icon: Target },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setPropsMode(m.id)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${propsMode === m.id ? C.accent : "#16161f"}`,
              background: propsMode === m.id ? "rgba(99,102,241,0.15)" : "transparent",
              color: propsMode === m.id ? "#a5b4fc" : "#6b7280",
              fontSize: 13,
              fontWeight: propsMode === m.id ? 700 : 600,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <m.Icon size={12}/>
            {m.label}
          </button>
        ))}
      </div>

      {/* Sport filter pills */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {[
          { id: "all" as const, label: "All" },
          { id: "nba" as const, label: "NBA" },
          { id: "mlb" as const, label: "MLB" },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setSport(s.id)}
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              border: `1px solid ${sport === s.id ? C.accent : C.border}`,
              background: sport === s.id ? "rgba(99,102,241,0.15)" : "transparent",
              color: sport === s.id ? "#a5b4fc" : C.textMuted,
              fontSize: 11.5,
              fontWeight: sport === s.id ? 700 : 500,
              cursor: "pointer",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {propsMode === "avg" && (<>
      {/* NBA search */}
      {(sport === "all" || sport === "nba") && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Search NBA players (e.g. curry, jokic)…"
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: "#1a1a24",
              color: "#fff",
              fontSize: 13,
              outline: "none",
              minHeight: 40,
            }}
          />
          <button
            onClick={() => load()}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: C.accent,
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              minHeight: 40,
            }}
          >
            Search
          </button>
        </div>
      )}

      {/* Info banner */}
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          background: "rgba(99,102,241,0.06)",
          border: "1px solid rgba(99,102,241,0.18)",
          color: "#a5b4fc",
          fontSize: 12,
          marginBottom: 12,
        }}
      >
        <span style={{display:"flex", alignItems:"center", gap:6}}><AlertTriangle size={12}/> Lines are estimated — always verify on DraftKings or FanDuel before betting real money</span>
      </div>

      {/* Count */}
      {bets.length > 0 && (
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12, fontWeight: 600 }}>
          {bets.length} prop bet{bets.length === 1 ? "" : "s"} · {strongCount} Strong · sorted by edge
        </div>
      )}

      {error && <ErrorBox>{error}</ErrorBox>}
      {loading && (
        <div style={{ color: C.textMuted, padding: 32, textAlign: "center" }}>
          Loading players…
        </div>
      )}
      {!loading && !error && bets.length === 0 && (
        <div
          style={{
            color: C.textMuted,
            padding: 32,
            textAlign: "center",
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
          }}
        >
          No qualifying prop bets found.
        </div>
      )}

      {/* Ranked bet cards — Best Picks layout */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {!loading &&
          bets.map((b) => {
            const a = analysis[b.id];
            const badge =
              b.edgePct > 20
                ? { Icon: Activity, label: "Strong", color: C.green }
                : b.edgePct > 12
                  ? { Icon: Star, label: "Good", color: "#a5b4fc" }
                  : b.edgePct > 5
                    ? { Icon: Eye, label: "Fair", color: C.amber }
                    : { Icon: null, label: "Low", color: C.textMuted };
            const scoreColor =
              b.propScore >= 75
                ? C.green
                : b.propScore >= 55
                  ? C.blue
                  : b.propScore >= 35
                    ? C.amber
                    : C.textMuted;
            const pickColor = b.pick === "OVER" ? C.green : C.red;
            return (
              <div
                key={b.id}
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{b.player}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                      {b.team || b.sport} · {b.prop}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: scoreColor,
                        lineHeight: 1,
                      }}
                    >
                      {b.propScore}
                    </div>
                    <div style={{ fontSize: 9, color: C.textMuted }}>/ 100</div>
                  </div>
                </div>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 8px",
                    borderRadius: 6,
                    fontSize: 10.5,
                    fontWeight: 700,
                    background: `${badge.color}26`,
                    color: badge.color,
                    border: `1px solid ${badge.color}40`,
                    marginBottom: 8,
                  }}
                >
                  {badge.Icon && <badge.Icon size={11}/>}
                  {badge.label}
                </div>

                <div style={{ fontSize: 20, fontWeight: 800, color: pickColor }}>
                  {b.pick} {b.line}
                </div>
                <div style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 4 }}>
                  Season avg: <strong style={{ color: C.text }}>{b.avgDisplay}</strong>
                </div>
                <div style={{ fontSize: 11.5, color: C.textDim, marginBottom: 10 }}>
                  Bet $110 → win $100
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => placeBet(b)}
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: `1px solid ${C.border}`,
                      background: C.card2,
                      color: C.text,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      minHeight: 36,
                    }}
                  >
                    + Paper Bet
                  </button>
                  <button
                    onClick={() => analyzeProp(b)}
                    disabled={analyzing.has(b.id) || !!a}
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(99,102,241,0.4)",
                      background: analyzing.has(b.id) || a ? C.card2 : "rgba(99,102,241,0.08)",
                      color: analyzing.has(b.id) || a ? C.textMuted : "#a5b4fc",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: analyzing.has(b.id) || a ? "default" : "pointer",
                      minHeight: 36,
                    }}
                  >
                    {analyzing.has(b.id) ? "Analyzing…" : a ? "Analyzed" : "AI Analyze"}
                  </button>
                </div>

                {a && (
                  <div
                    style={{
                      marginTop: 10,
                      background: a.avoid ? "rgba(239,68,68,0.06)" : "rgba(99,102,241,0.06)",
                      border: `1px solid ${a.avoid ? "rgba(239,68,68,0.2)" : "rgba(99,102,241,0.2)"}`,
                      borderRadius: 10,
                      padding: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: a.avoid ? C.red : "#a5b4fc" }}>
                        {a.avoid ? <span style={{display:"inline-flex", alignItems:"center", gap:4}}><XCircle size={12}/> SKIP</span> : <span style={{display:"inline-flex", alignItems:"center", gap:4}}><CheckCircle size={12}/> Pick: {a.pick}</span>}
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 4,
                          background:
                            a.confidence === "high"
                              ? "rgba(34,197,94,0.18)"
                              : a.confidence === "medium"
                                ? "rgba(245,158,11,0.18)"
                                : "rgba(107,114,128,0.18)",
                          color:
                            a.confidence === "high"
                              ? C.green
                              : a.confidence === "medium"
                                ? C.amber
                                : C.textMuted,
                        }}
                      >
                        {a.confidence.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.6, marginBottom: 8 }}>
                      {a.reasoning}
                    </div>
                    {a.injuries && a.injuries.toLowerCase() !== "none" && (
                      <div style={{ fontSize: 11.5, color: "#fca5a5", marginBottom: 4 }}>
                        <Shield size={12} style={{display:"inline", verticalAlign:"middle", marginRight:4}}/> <strong>Injuries:</strong> {a.injuries}
                      </div>
                    )}
                    {a.form && (
                      <div style={{ fontSize: 11.5, color: "#86efac", marginBottom: 4 }}>
                        <BarChart2 size={12} style={{display:"inline", verticalAlign:"middle", marginRight:4}}/> <strong>Form:</strong> {a.form}
                      </div>
                    )}
                    {a.edge && (
                      <div style={{ fontSize: 11.5, color: "#c7d2fe", marginBottom: 4 }}>
                        <Zap size={12} style={{display:"inline", verticalAlign:"middle", marginRight:4}}/> <strong>Edge:</strong> {a.edge}
                      </div>
                    )}
                    {a.warning && (
                      <div style={{ fontSize: 11.5, color: "#fde68a", marginBottom: 4 }}>
                        <AlertTriangle size={12} style={{display:"inline", verticalAlign:"middle", marginRight:4}}/> <strong>Warning:</strong> {a.warning}
                      </div>
                    )}
                    {!a.avoid && a.pick !== "SKIP" && (
                      <button
                        onClick={() => placeBet(b)}
                        style={{
                          marginTop: 10,
                          width: "100%",
                          padding: 9,
                          borderRadius: 8,
                          border: "none",
                          background: C.accent,
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          minHeight: 36,
                        }}
                      >
                        + Paper Bet — {b.pick} {b.line} {b.prop}
                      </button>
                    )}
                  </div>
                )}

                <DeepDiveSection
                  id={b.id}
                  show={!!a}
                  onRun={() =>
                    deepDive(
                      b.id,
                      b.player,
                      b.pick === "OVER" ? `OVER ${b.line}` : `UNDER ${b.line}`,
                      b.sport,
                      -110,
                      -110,
                      `Player prop bet: ${b.player} (${b.team}) — ${b.prop} ${b.pick} ${b.line}. Season average: ${b.avg}. Statistical edge: ${b.edgePct}% above the line.`,
                    )
                  }
                  deepDives={deepDives}
                  deepDiving={deepDiving}
                />
              </div>
            );
          })}
      </div>
      </>)}

      {propsMode === "real" && (
        <>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(34,197,94,0.06)",
              border: "1px solid rgba(34,197,94,0.18)",
              color: "#86efac",
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            <span style={{display:"inline-flex", alignItems:"center", gap:6}}><Target size={12}/> Real prop lines pulled live from US sportsbooks. Compared against season averages</span>
            where available.
          </div>

          {realPropsLoading && (
            <div style={{ color: C.textMuted, padding: 32, textAlign: "center" }}>
              Loading real prop lines…
            </div>
          )}

          {!realPropsLoading && scoredRealProps.length === 0 && <PropMarketCountdown />}

          {!realPropsLoading && scoredRealProps.length > 0 && (
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12, fontWeight: 600 }}>
              {scoredRealProps.length} real prop line{scoredRealProps.length === 1 ? "" : "s"} found
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 12,
            }}
          >
            {scoredRealProps.map((p) => {
              const scoreColor =
                p.score >= 75
                  ? C.green
                  : p.score >= 55
                    ? C.blue
                    : p.score >= 35
                      ? C.amber
                      : C.textMuted;
              const pickColor = p.pick === "OVER" ? C.green : p.pick === "UNDER" ? C.red : C.textMuted;
              return (
                <div
                  key={p.id}
                  style={{
                    background: C.card,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{p.player}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                        {p.game} · {p.marketLabel}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
                        {p.score}
                      </div>
                      <div style={{ fontSize: 9, color: C.textMuted }}>/ 100</div>
                    </div>
                  </div>

                  <div style={{ background: "#1a1a24", borderRadius: 8, padding: 10, marginBottom: 10, textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>LINE</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{p.line ?? "—"}</div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                    <div style={{ background: "#1a1a24", borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>
                        OVER · {p.overBook || "—"}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: C.green }}>
                        {p.overOdds != null ? `${p.overOdds > 0 ? "+" : ""}${p.overOdds}` : "—"}
                      </div>
                    </div>
                    <div style={{ background: "#1a1a24", borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>
                        UNDER · {p.underBook || "—"}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: C.red }}>
                        {p.underOdds != null ? `${p.underOdds > 0 ? "+" : ""}${p.underOdds}` : "—"}
                      </div>
                    </div>
                  </div>

                  {p.avg != null && p.pick && (
                    <div style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 8 }}>
                      Season avg: <strong style={{ color: C.text }}>{p.avg.toFixed(2)}</strong> · Recommendation:{" "}
                      <strong style={{ color: pickColor }}>{p.pick}</strong>
                      {p.edgePct ? <> · {p.edgePct.toFixed(0)}% edge</> : null}
                    </div>
                  )}
                  {p.avg == null && (
                    <div style={{ fontSize: 11.5, color: C.textDim, marginBottom: 8 }}>
                      No season-average data for this player.
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() =>
                        onAddBet({
                          type: "prop",
                          sport: p.sport?.includes("basketball") ? "NBA" : "MLB",
                          game: `${p.player} — ${p.marketLabel}`,
                          pick: `OVER ${p.line} ${p.marketLabel}`,
                          odds: p.overOdds ?? -110,
                          book: p.overBook || "Book",
                          stake: 100,
                          potWin: payoutOn(100, p.overOdds ?? -110),
                          notes: `Real line ${p.line} at ${p.overBook}`,
                        })
                      }
                      disabled={p.overOdds == null}
                      style={{
                        flex: 1,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: `1px solid ${C.border}`,
                        background: p.overOdds == null ? C.card2 : "rgba(34,197,94,0.08)",
                        color: p.overOdds == null ? C.textMuted : C.green,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: p.overOdds == null ? "default" : "pointer",
                        minHeight: 36,
                      }}
                    >
                      + Paper Bet OVER
                    </button>
                    <button
                      onClick={() =>
                        onAddBet({
                          type: "prop",
                          sport: p.sport?.includes("basketball") ? "NBA" : "MLB",
                          game: `${p.player} — ${p.marketLabel}`,
                          pick: `UNDER ${p.line} ${p.marketLabel}`,
                          odds: p.underOdds ?? -110,
                          book: p.underBook || "Book",
                          stake: 100,
                          potWin: payoutOn(100, p.underOdds ?? -110),
                          notes: `Real line ${p.line} at ${p.underBook}`,
                        })
                      }
                      disabled={p.underOdds == null}
                      style={{
                        flex: 1,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: `1px solid ${C.border}`,
                        background: p.underOdds == null ? C.card2 : "rgba(239,68,68,0.08)",
                        color: p.underOdds == null ? C.textMuted : C.red,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: p.underOdds == null ? "default" : "pointer",
                        minHeight: 36,
                      }}
                    >
                      + Paper Bet UNDER
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}


// ──────────────────────── PAPER BETS ────────────────────────
// Pick a sport-appropriate scoreboard/results site for the "check result" link.
function getResultLink(bet: any) {
  const sport = (bet.sport || "").toLowerCase();
  const game = encodeURIComponent(bet.game || "");

  if (sport.includes("cs") || sport.includes("csgo") || sport === "csgo") {
    return { url: "https://www.hltv.org/results", label: "Check Result on HLTV →", color: "#f59e0b" };
  }
  if (sport.includes("lol") || sport.includes("league")) {
    return { url: `https://lol.fandom.com/wiki/Special:Search?query=${game}`, label: "Check Result on LoL Wiki →", color: "#c89b3c" };
  }
  if (sport.includes("valorant")) {
    return { url: "https://www.vlr.gg/matches/results", label: "Check Result on VLR.gg →", color: "#ff4655" };
  }
  if (sport.includes("dota")) {
    return { url: "https://www.dotabuff.com/esports/matches", label: "Check Result on Dotabuff →", color: "#c23c2a" };
  }
  if (sport.includes("nba") || sport.includes("basketball")) {
    return { url: "https://www.espn.com/nba/scoreboard", label: "Check Result on ESPN →", color: "#60a5fa" };
  }
  if (sport.includes("mlb") || sport.includes("baseball")) {
    return { url: "https://www.espn.com/mlb/scoreboard", label: "Check Result on ESPN →", color: "#60a5fa" };
  }
  if (sport.includes("nfl") || sport.includes("football")) {
    return { url: "https://www.espn.com/nfl/scoreboard", label: "Check Result on ESPN →", color: "#60a5fa" };
  }
  if (sport.includes("soccer") || sport.includes("mls") || sport.includes("epl")) {
    return { url: "https://www.espn.com/soccer/scoreboard", label: "Check Result on ESPN →", color: "#60a5fa" };
  }
  if (sport.includes("tennis")) {
    return { url: "https://www.flashscore.com/tennis", label: "Check Result on Flashscore →", color: "#22c55e" };
  }
  if (sport.includes("prop")) {
    return { url: `https://www.espn.com/search/results?q=${game}`, label: "Check Stat on ESPN →", color: "#60a5fa" };
  }
  return { url: `https://www.google.com/search?q=${game}+result+score`, label: "Search Result on Google →", color: "#6b7280" };
}

const BankrollChart = ({ history }: { history: { value: number }[] }) => {
  if (history.length < 2) return null;
  const min = Math.min(...history.map((h) => h.value));
  const max = Math.max(...history.map((h) => h.value));
  const range = max - min || 100;
  const w = 100;
  const h = 50;
  const points = history
    .map((point, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = h - ((point.value - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  const isUp = history[history.length - 1].value >= history[0].value;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: 60, display: "block" }}>
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? "#22c55e" : "#ef4444"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={points.split(" ")[0].split(",")[0]}
        cy={points.split(" ")[0].split(",")[1]}
        r="2"
        fill={isUp ? "#22c55e" : "#ef4444"}
      />
    </svg>
  );
};

function PaperBetsPanel({
  bets,
  bankroll,
  setBankroll,
  update,
  remove,
  onNotify,
  defaultStake,
  setDefaultStake,
}: {
  bets: PaperBet[];
  bankroll: number;
  setBankroll: (next: number | ((prev: number) => number)) => void;
  update: (id: number, patch: Partial<PaperBet>) => void;
  remove: (id: number) => void;
  onNotify: (m: string) => void;
  defaultStake: number;
  setDefaultStake: (n: number) => void;
}) {
  const [startingBankroll, setStartingBankrollState] = useState<number>(1000);
  const [showSetup, setShowSetup] = useState(false);
  const [betFilter, setBetFilter] = useState<"all" | "pending" | "won" | "lost">("all");
  const [setupBankroll, setSetupBankroll] = useState("");
  const [setupStake, setSetupStake] = useState("");
  const [editingBet, setEditingBet] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sb = parseFloat(localStorage.getItem("sports_starting_bankroll") || "");
    if (!isNaN(sb)) setStartingBankrollState(sb);
  }, []);

  const persistStartingBankroll = (n: number) => {
    setStartingBankrollState(n);
    if (typeof window !== "undefined")
      localStorage.setItem("sports_starting_bankroll", String(n));
  };

  const settleBet = (id: number, result: "won" | "lost" | "void" | "push") => {
    const bet = bets.find((b) => b.id === id);
    if (!bet || bet.status !== "pending") return;

    let profit = 0;
    if (result === "won") {
      profit =
        bet.potWin ||
        bet.stake * (bet.odds > 0 ? bet.odds / 100 : 100 / Math.abs(bet.odds));
      setBankroll((prev) => prev + bet.stake + profit);
    } else if (result === "lost") {
      profit = -bet.stake;
      // bankroll already deducted when bet was placed
    } else {
      // void or push — return stake
      setBankroll((prev) => prev + bet.stake);
    }

    update(id, { status: result, profit, settledAt: new Date().toISOString() });
    onNotify(`✓ Marked ${bet.pick} as ${result.toUpperCase()}`);
  };

  const settled = bets.filter((b) => b.status !== "pending");
  const won = bets.filter((b) => b.status === "won");
  const lost = bets.filter((b) => b.status === "lost");
  const pending = bets.filter((b) => b.status === "pending");
  const totalStaked = settled.reduce((s, b) => s + b.stake, 0);
  const totalProfit =
    won.reduce((s, b) => s + (b.profit || b.potWin || 0), 0) -
    lost.reduce((s, b) => s + b.stake, 0);
  const winRate = settled.length ? Math.round((won.length / settled.length) * 100) : 0;
  const roi = totalStaked > 0 ? ((totalProfit / totalStaked) * 100).toFixed(1) : "0.0";

  const bankrollHistory = useMemo(() => {
    let running = startingBankroll;
    const history = [{ value: running, label: "Start" }];
    const sortedSettled = [...settled].sort(
      (a, b) =>
        new Date(a.settledAt || 0).getTime() - new Date(b.settledAt || 0).getTime(),
    );
    sortedSettled.forEach((bet) => {
      const delta =
        bet.status === "won"
          ? bet.profit || bet.potWin || 0
          : bet.status === "lost"
            ? -(bet.stake || 0)
            : 0;
      running += delta;
      history.push({ value: running, label: (bet.pick || "").substring(0, 10) });
    });
    return history;
  }, [settled, startingBankroll]);

  const filteredBets = bets.filter((b) =>
    betFilter === "all" ? true : b.status === betFilter,
  );

  const s = {
    bg: "#080808",
    card: "#111",
    border: "#16161f",
    green: "#22c55e",
    red: "#ef4444",
    muted: "#6b7280",
    accent: "#6366f1",
  };

  return (
    <div>
      {/* Setup modal */}
      {showSetup && (
        <>
          <div
            onClick={() => setShowSetup(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000 }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              zIndex: 1001,
              background: "#111",
              border: "1px solid #16161f",
              borderRadius: 16,
              padding: 24,
              width: 360,
            }}
          >
            <div style={{ display:"flex", alignItems:"center", gap:8, fontSize: 16, fontWeight: 700, marginBottom: 16 }}><Edit2 size={16}/> Paper Betting Setup</div>

            <label style={{ fontSize: 12, color: s.muted, display: "block", marginBottom: 4 }}>
              Starting Bankroll ($)
            </label>
            <input
              value={setupBankroll}
              onChange={(e) => setSetupBankroll(e.target.value)}
              placeholder={String(startingBankroll)}
              type="number"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: 8,
                border: "1px solid #16161f",
                background: "#1a1a24",
                color: "#fff",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
                marginBottom: 12,
              }}
            />

            <label style={{ fontSize: 12, color: s.muted, display: "block", marginBottom: 4 }}>
              Default Bet Size ($)
            </label>
            <input
              value={setupStake}
              onChange={(e) => setSetupStake(e.target.value)}
              placeholder={String(defaultStake)}
              type="number"
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: 8,
                border: "1px solid #16161f",
                background: "#1a1a24",
                color: "#fff",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
                marginBottom: 16,
              }}
            />

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowSetup(false)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 8,
                  border: "1px solid #16161f",
                  background: "transparent",
                  color: "#fff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const nb = parseFloat(setupBankroll) || startingBankroll;
                  const ns = parseFloat(setupStake) || defaultStake;
                  persistStartingBankroll(nb);
                  setBankroll(nb);
                  setDefaultStake(ns);
                  setShowSetup(false);
                  setSetupBankroll("");
                  setSetupStake("");
                  onNotify("✓ Settings saved");
                }}
                style={{
                  flex: 2,
                  padding: "10px",
                  borderRadius: 8,
                  border: "none",
                  background: s.accent,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Save Settings
              </button>
            </div>

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #16161f" }}>
              <button
                onClick={() => {
                  if (!confirm("Reset everything? This clears all bets and resets bankroll.")) return;
                  bets.forEach((b) => remove(b.id));
                  const nb = parseFloat(setupBankroll) || 1000;
                  persistStartingBankroll(nb);
                  setBankroll(nb);
                  setShowSetup(false);
                  onNotify("✓ Reset complete");
                }}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: 8,
                  border: "1px solid rgba(239,68,68,0.3)",
                  background: "rgba(239,68,68,0.08)",
                  color: s.red,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <span style={{display:"inline-flex", alignItems:"center", gap:6}}><Trash2 size={12}/> Reset Everything</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4, letterSpacing: "-0.02em" }}><BarChart2 size={22}/> Paper Bets</div>
          <div style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6 }}>
            Track your bets — mark won or lost after each game
          </div>
        </div>
        <button
          onClick={() => setShowSetup(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid #16161f",
            background: "transparent",
            color: "#6b7280",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          <Edit2 size={12}/> Setup
        </button>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,1fr)",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {[
          {
            label: "Bankroll",
            value: "$" + bankroll.toFixed(2),
            sub: `Started: $${startingBankroll}`,
            color: bankroll >= startingBankroll ? s.green : s.red,
          },
          {
            label: "Net P&L",
            value: (totalProfit >= 0 ? "+" : "") + " $" + totalProfit.toFixed(2),
            sub: `ROI: ${roi}%`,
            color: totalProfit >= 0 ? s.green : s.red,
          },
          {
            label: "Win Rate",
            value: winRate + "%",
            sub: `${won.length}W / ${lost.length}L / ${pending.length} pending`,
            color: winRate >= 55 ? s.green : winRate >= 45 ? "#f59e0b" : s.red,
          },
          {
            label: "Total Bets",
            value: String(bets.length),
            sub: `$${totalStaked.toFixed(0)} total staked`,
            color: "#fff",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{ background: s.card, border: "1px solid #16161f", borderRadius: 10, padding: 14 }}
          >
            <div
              style={{
                fontSize: 10,
                color: s.muted,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              {stat.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: stat.color, marginBottom: 2 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 11, color: s.muted }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Bankroll chart */}
      {bankrollHistory.length > 1 && (
        <div
          style={{
            background: s.card,
            border: "1px solid #16161f",
            borderRadius: 10,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 11, color: s.muted, marginBottom: 8 }}>BANKROLL OVER TIME</div>
          <BankrollChart history={bankrollHistory} />
        </div>
      )}

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { id: "all" as const, label: `All (${bets.length})` },
          { id: "pending" as const, Icon: Clock, label: `Pending (${pending.length})` },
          { id: "won" as const, Icon: CheckCircle, label: `Won (${won.length})` },
          { id: "lost" as const, Icon: XCircle, label: `Lost (${lost.length})` },
        ].map((f) => {
          const FIcon = (f as any).Icon;
          return (
          <button
            key={f.id}
            onClick={() => setBetFilter(f.id)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: betFilter === f.id ? 700 : 600,
              border: `1px solid ${betFilter === f.id ? s.accent : "#16161f"}`,
              background: betFilter === f.id ? "rgba(99,102,241,0.15)" : "transparent",
              color: betFilter === f.id ? "#a5b4fc" : "#6b7280",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {FIcon && <FIcon size={12}/>}
            {f.label}
          </button>
          );
        })}
      </div>

      {/* Bets list */}
      {filteredBets.length === 0 ? (
        <div
          style={{
            background: s.card,
            border: "1px solid #16161f",
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
            color: s.muted,
          }}
        >
          {bets.length === 0
            ? 'No bets yet — click "+ Paper Bet" on any pick to start tracking'
            : "No bets match this filter"}
        </div>
      ) : (
        [...filteredBets].reverse().map((bet) => (
          <div
            key={bet.id}
            style={{
              background: s.card,
              border: `1px solid ${
                bet.status === "won"
                  ? "rgba(34,197,94,0.3)"
                  : bet.status === "lost"
                    ? "rgba(239,68,68,0.3)"
                    : bet.status === "void"
                      ? "#16161f"
                      : "rgba(245,158,11,0.2)"
              }`,
              borderRadius: 12,
              padding: 16,
              marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 2 }}>
                  {bet.pick}
                </div>
                <div style={{ fontSize: 11, color: s.muted }}>{bet.game}</div>
                <div style={{ fontSize: 11, color: s.muted }}>
                  {bet.sport} ·{" "}
                  {new Date(bet.placedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {bet.status === "pending" && (
                  <div style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize: 12, fontWeight: 700, color: "#f59e0b" }}><Clock size={12}/> PENDING</div>
                )}
                {bet.status === "won" && (
                  <div style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize: 12, fontWeight: 700, color: s.green }}>
                    <CheckCircle size={12}/> WON +${(bet.profit ?? bet.potWin ?? 0).toFixed(2)}
                  </div>
                )}
                {bet.status === "lost" && (
                  <div style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize: 12, fontWeight: 700, color: s.red }}>
                    <XCircle size={12}/> LOST -${(bet.stake ?? 0).toFixed(2)}
                  </div>
                )}
                {bet.status === "void" && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: s.muted }}>VOID</div>
                )}
                {bet.status === "push" && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: s.muted }}>PUSH</div>
                )}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 8,
                marginBottom: bet.status === "pending" ? 12 : 0,
              }}
            >
              <div style={{ background: "#1a1a24", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: s.muted, marginBottom: 1 }}>STAKE</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>${bet.stake}</div>
              </div>
              <div style={{ background: "#1a1a24", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: s.muted, marginBottom: 1 }}>ODDS</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: bet.odds > 0 ? s.green : "#fff" }}>
                  {bet.odds > 0 ? "+" : ""}
                  {bet.odds}
                </div>
              </div>
              <div style={{ background: "#1a1a24", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: s.muted, marginBottom: 1 }}>TO WIN</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: s.green }}>
                  +${(bet.potWin || 0).toFixed(0)}
                </div>
              </div>
            </div>

            {bet.status === "pending" && (() => {
              const resultLink = getResultLink(bet);
              return (
                <a
                  href={resultLink.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "6px",
                    borderRadius: 6,
                    border: `1px solid ${resultLink.color}40`,
                    background: `${resultLink.color}08`,
                    color: resultLink.color,
                    fontSize: 11,
                    textDecoration: "none",
                    marginBottom: 8,
                  }}
                >
                  {resultLink.label}
                </a>
              );
            })()}

            {bet.status === "pending" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                <button
                  onClick={() => settleBet(bet.id, "won")}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "9px",
                    borderRadius: 8,
                    background: "rgba(34,197,94,0.15)",
                    color: s.green,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "1px solid rgba(34,197,94,0.25)",
                  }}
                >
                  <CheckCircle size={12}/> Won
                </button>
                <button
                  onClick={() => settleBet(bet.id, "lost")}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "9px",
                    borderRadius: 8,
                    background: "rgba(239,68,68,0.15)",
                    color: s.red,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "1px solid rgba(239,68,68,0.25)",
                  }}
                >
                  <XCircle size={12}/> Lost
                </button>
                <button
                  onClick={() => settleBet(bet.id, "push")}
                  style={{
                    padding: "9px",
                    borderRadius: 8,
                    border: "1px solid #16161f",
                    background: "transparent",
                    color: "#6b7280",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Push
                </button>
                <button
                  onClick={() => settleBet(bet.id, "void")}
                  style={{
                    padding: "9px",
                    borderRadius: 8,
                    border: "1px solid #16161f",
                    background: "transparent",
                    color: "#6b7280",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Void
                </button>
              </div>
            )}

            {bet.status !== "pending" && editingBet !== bet.id && (
              <button
                onClick={() => setEditingBet(bet.id)}
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid #2a2a3a",
                  background: "transparent",
                  color: "#6b7280",
                  fontSize: 11,
                  cursor: "pointer",
                  marginTop: 6,
                }}
              >
                <span style={{display:"inline-flex", alignItems:"center", gap:4}}><Edit2 size={11}/> Edit Result</span>
              </button>
            )}

            {editingBet === bet.id && bet.status !== "pending" && (
              <div style={{ marginTop: 8, padding: 10, background: "#1a1a24", borderRadius: 8, border: "1px solid #2a2a3a" }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>Change result or delete this bet:</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
                  {(["won", "lost", "push", "void"] as const).map((result) => (
                    <button
                      key={result}
                      onClick={() => {
                        let newBankroll = bankroll;
                        if (bet.status === "won") newBankroll -= bet.stake + (bet.profit || 0);
                        else if (bet.status === "lost") newBankroll += bet.stake;
                        else if (bet.status === "push" || bet.status === "void") newBankroll -= bet.stake;

                        let profit = 0;
                        if (result === "won") {
                          profit = bet.potWin || bet.stake * (bet.odds > 0 ? bet.odds / 100 : 100 / Math.abs(bet.odds));
                          newBankroll += bet.stake + profit;
                        } else if (result === "lost") {
                          profit = -bet.stake;
                        } else if (result === "push" || result === "void") {
                          newBankroll += bet.stake;
                        }

                        update(bet.id, { status: result, profit, settledAt: new Date().toISOString() });
                        setBankroll(newBankroll);
                        setEditingBet(null);
                      }}
                      style={{
                        padding: "7px",
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                        background:
                          result === "won"
                            ? "rgba(34,197,94,0.2)"
                            : result === "lost"
                              ? "rgba(239,68,68,0.2)"
                              : "rgba(107,114,128,0.2)",
                        color:
                          result === "won"
                            ? "#22c55e"
                            : result === "lost"
                              ? "#ef4444"
                              : "#9ca3af",
                      }}
                    >
                      {result === "won" ? <span style={{display:"inline-flex", alignItems:"center", gap:4}}><CheckCircle size={12}/> Won</span> : result === "lost" ? <span style={{display:"inline-flex", alignItems:"center", gap:4}}><XCircle size={12}/> Lost</span> : result === "push" ? "Push" : "Void"}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    let newBankroll = bankroll;
                    if (bet.status === "won") newBankroll -= bet.stake + (bet.profit || 0);
                    else if (bet.status === "lost") newBankroll += bet.stake;
                    else if (bet.status === "push" || bet.status === "void") newBankroll -= bet.stake;

                    update(bet.id, { status: "pending", profit: 0, settledAt: undefined });
                    setBankroll(newBankroll);
                    setEditingBet(null);
                  }}
                  style={{
                    width: "100%",
                    padding: "6px",
                    borderRadius: 6,
                    border: "1px solid rgba(245,158,11,0.3)",
                    background: "rgba(245,158,11,0.08)",
                    color: "#f59e0b",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    marginBottom: 8,
                  }}
                >
                  <span style={{display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6, width:"100%"}}><Clock size={12}/> Set Back to Pending</span>
                </button>

                <button
                  onClick={() => {
                    if (!confirm("Delete this bet permanently?")) return;
                    let newBankroll = bankroll;
                    if (bet.status === "won") newBankroll -= bet.stake + (bet.profit || 0);
                    else if (bet.status === "lost") newBankroll += bet.stake;
                    else if (bet.status === "push" || bet.status === "void") newBankroll -= bet.stake;

                    remove(bet.id);
                    setBankroll(newBankroll);
                    setEditingBet(null);
                  }}
                  style={{
                    width: "100%",
                    padding: "6px",
                    borderRadius: 6,
                    border: "1px solid rgba(239,68,68,0.3)",
                    background: "rgba(239,68,68,0.05)",
                    color: "#ef4444",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <span style={{display:"inline-flex", alignItems:"center", gap:6}}><Trash2 size={12}/> Delete This Bet</span>
                </button>

                <button
                  onClick={() => setEditingBet(null)}
                  style={{
                    width: "100%",
                    padding: "5px",
                    borderRadius: 6,
                    border: "1px solid #2a2a3a",
                    background: "transparent",
                    color: "#6b7280",
                    fontSize: 11,
                    cursor: "pointer",
                    marginTop: 6,
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {bet.status === "pending" && (
              <button
                onClick={() => {
                  if (!confirm("Delete this pending bet and refund the stake?")) return;
                  remove(bet.id);
                  setBankroll(bankroll + bet.stake);
                }}
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(239,68,68,0.2)",
                  background: "rgba(239,68,68,0.05)",
                  color: "#ef4444",
                  fontSize: 11,
                  cursor: "pointer",
                  marginTop: 6,
                  width: "100%",
                }}
              >
                <span style={{display:"inline-flex", alignItems:"center", gap:6}}><Trash2 size={12}/> Delete & Refund Stake</span>
              </button>
            )}

            {bet.notes && (
              <div style={{ fontSize: 11, color: s.muted, marginTop: 8, fontStyle: "italic" }}>
                {bet.notes}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ──────────────────────── BOOK HEALTH ────────────────────────
function BookHealthPanel({
  bets,
  onNotify,
}: {
  bets: PaperBet[];
  onNotify: (m: string) => void;
}) {
  const [log, setLog] = useState<BookEntry[]>([]);
  const [newBook, setNewBook] = useState("");

  useEffect(() => {
    setLog(readLS<BookEntry[]>(BOOK_LOG_KEY, []));
  }, []);

  // Merge book log with bet-derived counts
  const merged = useMemo(() => {
    const map = new Map<string, BookEntry>();
    log.forEach((e) => map.set(e.book, { ...e }));
    bets.forEach((b) => {
      if (!b.book || b.book === "Manual") return;
      const cur = map.get(b.book) ?? {
        book: b.book,
        arbCount: 0,
        normalCount: 0,
        status: "healthy" as const,
      };
      if (b.type === "arb") cur.arbCount += 1;
      else cur.normalCount += 1;
      map.set(b.book, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.arbCount + b.normalCount - (a.arbCount + a.normalCount));
  }, [log, bets]);

  const persist = (next: BookEntry[]) => {
    setLog(next);
    writeLS(BOOK_LOG_KEY, next);
  };

  const adjust = (book: string, kind: "arb" | "normal") => {
    const existing = log.find((e) => e.book === book);
    if (existing) {
      const next = log.map((e) =>
        e.book === book
          ? { ...e, arbCount: e.arbCount + (kind === "arb" ? 1 : 0), normalCount: e.normalCount + (kind === "normal" ? 1 : 0) }
          : e,
      );
      persist(next);
    } else {
      persist([
        ...log,
        {
          book,
          arbCount: kind === "arb" ? 1 : 0,
          normalCount: kind === "normal" ? 1 : 0,
          status: "healthy",
        },
      ]);
    }
    onNotify(`✓ Logged ${kind} bet at ${book}`);
  };

  const decrement = (book: string, kind: "arb" | "normal") => {
    const existing = log.find((e) => e.book === book);
    if (!existing) return;
    const field: "arbCount" | "normalCount" = kind === "arb" ? "arbCount" : "normalCount";
    if (existing[field] <= 0) return;
    persist(log.map((e) => (e.book === book ? { ...e, [field]: e[field] - 1 } : e)));
  };

  const setStatus = (book: string, status: BookEntry["status"]) => {
    const existing = log.find((e) => e.book === book);
    if (existing) {
      persist(log.map((e) => (e.book === book ? { ...e, status } : e)));
    } else {
      persist([...log, { book, arbCount: 0, normalCount: 0, status }]);
    }
  };

  const riskLevel = (e: BookEntry) => {
    if (e.status === "banned") return { label: "BANNED", color: C.red };
    if (e.status === "limited") return { label: "LIMITED", color: C.amber };
    const ratio = e.normalCount === 0 ? 1 : e.arbCount / Math.max(e.normalCount, 1);
    if (ratio > 0.5) return { label: "HIGH RISK", color: C.red };
    if (ratio > 0.2) return { label: "WATCH", color: C.amber };
    return { label: "HEALTHY", color: C.green };
  };

  return (
    <>
      <SectionHeader
        Icon={BookOpen}
        title="Book Health"
        subtitle="Track which books you've used and how. Arbing too often = limits/bans."
      />

      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 8 }}>
          Quick log
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={newBook}
            onChange={(e) => setNewBook(e.target.value)}
            placeholder="Bookmaker name (e.g. DraftKings)"
            style={{
              flex: 1,
              minWidth: 180,
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: "#1a1a24",
              color: "#fff",
              fontSize: 13,
              outline: "none",
              minHeight: 40,
            }}
          />
          <button
            onClick={() => {
              if (!newBook.trim()) return;
              adjust(newBook.trim(), "arb");
              setNewBook("");
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid rgba(245,158,11,0.4)",
              background: "rgba(245,158,11,0.1)",
              color: C.amber,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              minHeight: 40,
            }}
          >
            + Log Arb
          </button>
          <button
            onClick={() => {
              if (!newBook.trim()) return;
              adjust(newBook.trim(), "normal");
              setNewBook("");
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid rgba(34,197,94,0.4)",
              background: "rgba(34,197,94,0.1)",
              color: C.green,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              minHeight: 40,
            }}
          >
            + Log Normal Bet
          </button>
        </div>
      </div>

      {merged.length === 0 && (
        <div
          style={{
            color: C.textMuted,
            padding: 32,
            textAlign: "center",
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
          }}
        >
          No books logged yet. Place a paper bet or use the quick log above.
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {merged.map((e) => {
          const risk = riskLevel(e);
          return (
            <div
              key={e.book}
              style={{
                background: C.card,
                border: `1px solid ${risk.color}40`,
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{e.book}</div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: risk.color,
                    border: `1px solid ${risk.color}40`,
                    background: `${risk.color}15`,
                    padding: "3px 9px",
                    borderRadius: 6,
                    alignSelf: "flex-start",
                  }}
                >
                  {risk.label}
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: C.amber, fontWeight: 700, minWidth: 36 }}>Arbs</span>
                  <button
                    onClick={() => decrement(e.book, "arb")}
                    style={{
                      width: 24, height: 24, borderRadius: 4, border: "1px solid #2a2a3a",
                      background: "transparent", color: "#6b7280", fontSize: 14, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >−</button>
                  <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: "center" }}>{e.arbCount || 0}</span>
                  <button
                    onClick={() => adjust(e.book, "arb")}
                    style={{
                      width: 24, height: 24, borderRadius: 4, border: "1px solid #2a2a3a",
                      background: "transparent", color: "#6b7280", fontSize: 14, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >+</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: C.green, fontWeight: 700, minWidth: 48 }}>Normal</span>
                  <button
                    onClick={() => decrement(e.book, "normal")}
                    style={{
                      width: 24, height: 24, borderRadius: 4, border: "1px solid #2a2a3a",
                      background: "transparent", color: "#6b7280", fontSize: 14, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >−</button>
                  <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: "center" }}>{e.normalCount || 0}</span>
                  <button
                    onClick={() => adjust(e.book, "normal")}
                    style={{
                      width: 24, height: 24, borderRadius: 4, border: "1px solid #2a2a3a",
                      background: "transparent", color: "#6b7280", fontSize: 14, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >+</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  onClick={() => setStatus(e.book, e.status === "limited" ? "healthy" : "limited")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: `1px solid ${e.status === "limited" ? C.amber : C.border}`,
                    background: "transparent",
                    color: e.status === "limited" ? C.amber : C.textDim,
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    minHeight: 32,
                  }}
                >
                  {e.status === "limited" ? "✓ Limited" : "Mark limited"}
                </button>
                <button
                  onClick={() => setStatus(e.book, e.status === "banned" ? "healthy" : "banned")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: `1px solid ${e.status === "banned" ? C.red : C.border}`,
                    background: "transparent",
                    color: e.status === "banned" ? C.red : C.textDim,
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    minHeight: 32,
                  }}
                >
                  {e.status === "banned" ? "✓ Banned" : "Mark banned"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
