"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";

// ──────────────────────── theme ────────────────────────
const C = {
  bg: "#080808",
  card: "#111111",
  card2: "#161616",
  border: "#1e1e2a",
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
type Section = "best" | "arb" | "parlays" | "props" | "esports" | "bets" | "books";

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
  type: "best-pick" | "arb" | "parlay" | "prop" | "esports";
  sport: string;
  game: string;
  pick: string;
  odds: number;
  book: string;
  stake: number;
  potWin: number;
  status: "pending" | "won" | "lost" | "void";
  placedAt: string;
  settledAt?: string;
  notes?: string;
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

      // Score: peak at 50% implied (true coin-flip with value), edge bonus from line shopping
      const dist = Math.abs(impliedProb - 0.5);
      const probScore = Math.max(0, 80 - dist * 160);
      const edgeBonus = Math.min(35, edge * 250);
      const score = Math.max(0, Math.min(100, Math.round(probScore + edgeBonus)));

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
  if (score >= 75) return { label: "🔥 Strong", color: C.green };
  if (score >= 55) return { label: "⭐ Good", color: C.blue };
  if (score >= 35) return { label: "👀 Fair", color: C.amber };
  return { label: "Skip", color: C.textMuted };
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
    const onResize = () => setM(window.innerWidth < 760);
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

  const notify = useCallback((msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2500);
  }, []);

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

  const sidebarItems: { id: Section; icon: string; label: string }[] = [
    { id: "best", icon: "🎯", label: "Best Picks" },
    { id: "arb", icon: "💰", label: "Arb Finder" },
    { id: "parlays", icon: "🎰", label: "Parlays" },
    { id: "props", icon: "🏀", label: "Player Props" },
    { id: "esports", icon: "🎮", label: "Esports" },
    { id: "bets", icon: "📋", label: "Paper Bets" },
    { id: "books", icon: "📚", label: "Book Health" },
  ];

  const mobileItems: { id: Section; icon: string; label: string }[] = [
    { id: "best", icon: "🎯", label: "Picks" },
    { id: "arb", icon: "💰", label: "Arbs" },
    { id: "props", icon: "🏀", label: "Props" },
    { id: "bets", icon: "📋", label: "Bets" },
    { id: "books", icon: "📚", label: "Books" },
  ];

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", display: "flex" }}>
      {/* Sidebar (desktop only) */}
      {!isMobile && (
        <aside
          style={{
            width: 180,
            background: "#0a0a0f",
            borderRight: `1px solid ${C.border}`,
            position: "sticky",
            top: 0,
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            padding: "16px 0",
            flexShrink: 0,
          }}
        >
          <div style={{ padding: "0 16px 14px", borderBottom: `1px solid ${C.border}`, marginBottom: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>🎰 Sports</div>
          </div>
          {sidebarItems.map((it) => (
            <button
              key={it.id}
              onClick={() => setSection(it.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                border: "none",
                background: section === it.id ? "rgba(99,102,241,0.15)" : "transparent",
                color: section === it.id ? "#a5b4fc" : C.textMuted,
                fontSize: 13,
                fontWeight: section === it.id ? 700 : 400,
                cursor: "pointer",
                textAlign: "left",
                borderLeft: section === it.id ? `3px solid ${C.accent}` : "3px solid transparent",
              }}
            >
              <span style={{ fontSize: 16 }}>{it.icon}</span>
              {it.label}
            </button>
          ))}
        </aside>
      )}

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", paddingBottom: isMobile ? 64 : 0 }}>
        {/* Top bar */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderBottom: `1px solid ${C.border}`,
            background: "#0a0a0f",
            position: "sticky",
            top: 0,
            zIndex: 30,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em" }}>
            🎰 Sports Betting
          </div>
          <div
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              border: `1px solid ${C.border}`,
              background: C.card,
              fontSize: 12,
              fontWeight: 700,
              color: bankroll >= 1000 ? C.green : bankroll > 0 ? C.amber : C.red,
            }}
          >
            Bankroll: ${bankroll.toLocaleString()}
          </div>
          <div style={{ flex: 1 }} />
          <a
            href="/dashboard"
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.card,
              color: C.textDim,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ← Dashboard
          </a>
          <a
            href="/morning"
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid rgba(0,212,255,0.3)",
              background: "rgba(0,212,255,0.06)",
              color: "#00d4ff",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            ⬡ JARVIS
          </a>
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
        <main style={{ padding: isMobile ? 12 : 20, maxWidth: 1200, width: "100%" }}>
          {section === "best" && (
            <BestPicksPanel
              games={games}
              loading={oddsLoading}
              error={oddsError}
              onRefresh={loadOdds}
              nowMs={nowMs}
              onSwitchSection={setSection}
              onAddBet={(b) => {
                paper.add(b);
                setBankroll((prev) => Math.max(0, prev - b.stake));
                notify(`✓ ${b.pick} added to paper bets`);
              }}
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
              onAddBet={(b) => {
                paper.add(b);
                setBankroll((prev) => Math.max(0, prev - b.stake));
                notify("✓ Parlay added to paper bets");
              }}
            />
          )}
          {section === "props" && (
            <PlayerPropsPanel
              onAddBet={(b) => {
                paper.add(b);
                setBankroll((prev) => Math.max(0, prev - b.stake));
                notify(`✓ ${b.pick}`);
              }}
              onSwitchSection={setSection}
            />
          )}
          {section === "esports" && (
            <EsportsPanel
              nowMs={nowMs}
              onAddBet={(b) => {
                paper.add(b);
                setBankroll((prev) => Math.max(0, prev - b.stake));
                notify("✓ Esports bet logged");
              }}
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
            />
          )}
          {section === "books" && (
            <BookHealthPanel bets={paper.bets} onNotify={notify} />
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: 60,
            background: "#0a0a0f",
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            zIndex: 50,
          }}
        >
          {mobileItems.map((it) => (
            <button
              key={it.id}
              onClick={() => setSection(it.id)}
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                color: section === it.id ? "#a5b4fc" : C.textMuted,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              <span style={{ fontSize: 18 }}>{it.icon}</span>
              {it.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

// ──────────────────────── shared UI ────────────────────────
function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 14,
      }}
    >
      <div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3 }}>
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
        padding: "6px 14px",
        borderRadius: 999,
        border: `1px solid ${loading ? C.border : C.accent}`,
        background: loading ? C.card2 : C.accent,
        color: loading ? C.textDim : "#fff",
        fontSize: 12,
        fontWeight: 700,
        cursor: loading ? "not-allowed" : "pointer",
        minHeight: 32,
      }}
    >
      {loading ? "Loading…" : "↻ Refresh"}
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
        {running ? "🔍 Running deep dive (3 analyses)…" : "🔍 Deep Dive — Run Full Analysis"}
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
        🔍 Deep Dive Results — {dd.agreement}
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
            border: "1px solid #1e1e2a",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 3 }}>
            Analysis {i + 1} —{" "}
            {i === 0 ? "General" : i === 1 ? "Head to Head / Form" : "Schedule / Line Movement"}
          </div>
          <div style={{ fontSize: 12, color: "#d1d5db", marginBottom: 3 }}>{a.reasoning}</div>
          {a.form && <div style={{ fontSize: 11, color: "#6b7280" }}>📊 {a.form}</div>}
          {a.edge && <div style={{ fontSize: 11, color: "#6b7280" }}>⚡ {a.edge}</div>}
          {a.warning && <div style={{ fontSize: 11, color: "#f59e0b" }}>⚠️ {a.warning}</div>}
        </div>
      ))}
      <div style={{ fontSize: 10, color: "#4b5563", marginTop: 6 }}>
        ⚠️ Always verify on{" "}
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
    let list = picks;
    if (sport !== "all") list = list.filter((p) => p.game.sport_title === sport);
    list = list.filter((p) => {
      const t = new Date(p.game.commence_time).getTime();
      return !isFinite(t) || t > nowMs - 3 * 3600_000;
    });
    return list.slice(0, 30);
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
        title="🎯 Best Picks"
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
          <div style={{ fontSize: 32, marginBottom: 12 }}>📡</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
            Odds API Credits Used Up
          </div>
          <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 16 }}>
            Free tier resets monthly. 500 credits/month · Currently at limit.
          </div>
          <div style={{ fontSize: 13, color: C.textMuted }}>
            Meanwhile use: Player Props (NBA/MLB stats) · Esports picks · Arb Finder (cached)
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
            <button
              onClick={() => onSwitchSection("props")}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: C.accent,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                minHeight: 36,
              }}
            >
              🏀 Player Props →
            </button>
            <button
              onClick={() => onSwitchSection("esports")}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: "transparent",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                minHeight: 36,
              }}
            >
              🎮 Esports →
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
                      <span style={{ color: C.red, fontWeight: 700 }}>🔴 LIVE</span>
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
                  display: "inline-block",
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
                  {analyzing.has(p.game.id) ? "🔍…" : a ? "✓ Analyzed" : "✦ Analyze"}
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
                      {a.avoid ? "🚫 SKIP" : `✅ Pick: ${a.pick}`}
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
                      🏥 <strong>Injuries:</strong> {a.injuries}
                    </div>
                  )}
                  {a.form && (
                    <div style={{ fontSize: 11.5, color: "#86efac", marginBottom: 4 }}>
                      📊 <strong>Form:</strong> {a.form}
                    </div>
                  )}
                  {a.edge && (
                    <div style={{ fontSize: 11.5, color: "#c7d2fe", marginBottom: 4 }}>
                      ⚡ <strong>Edge:</strong> {a.edge}
                    </div>
                  )}
                  {a.warning && (
                    <div style={{ fontSize: 11.5, color: "#fde68a", marginBottom: 4 }}>
                      ⚠️ <strong>Warning:</strong> {a.warning}
                    </div>
                  )}
                  <div style={{ fontSize: 10.5, color: "#93c5fd", marginTop: 8 }}>
                    ⚠️ Verify injuries on{" "}
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
        title="💰 Arb Finder"
        subtitle="Risk-free profit by hedging both sides across books. ROI capped at 8% (anything higher is usually stale)."
        right={<RefreshButton loading={loading} onClick={onRefresh} />}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={() => setArbMode("game")} style={pillStyle(arbMode === "game")}>
          💰 Game Arbs
        </button>
        <button onClick={() => setArbMode("prop")} style={pillStyle(arbMode === "prop")}>
          🏀 Prop Arbs
        </button>
      </div>

      {arbMode === "prop" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {[
              { id: "baseball_mlb", label: "⚾ MLB" },
              { id: "basketball_nba", label: "🏀 NBA" },
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
                      💰 True Arbs ({propArbs.length})
                    </button>
                    <button onClick={() => setShowMiddles(true)} style={pillStyle(showMiddles)}>
                      🎯 Middles ({middles.length})
                    </button>
                  </div>

                  {!showMiddles && propArbs.length === 0 && (
                    <div
                      style={{
                        background: "#111",
                        border: "1px solid #1e1e2a",
                        borderRadius: 12,
                        padding: 32,
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 24, marginBottom: 8 }}>📡</div>
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
                        border: "1px solid #1e1e2a",
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
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#22c55e" }}>
                            💰 +${arb.profit.toFixed(2)} guaranteed · {arb.roi.toFixed(2)}% ROI
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
                            onNotify("✅ Prop arb tracked!");
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
                            🎯 MIDDLE
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
                            If {mid.player} scores between {mid.lineOver} and {mid.lineUnder} — BOTH bets win! 🎉
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
        title="🎰 Parlays"
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
                ? `✅ Expected value: +$${p.ev.toFixed(2)} per $100`
                : `❌ Expected value: −$${Math.abs(p.ev).toFixed(2)} per $100 — house edge`}
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
    alert(`✅ Placed paper bet: ${b.pick} ${b.line} ${b.prop} for ${b.player}`);
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
      { time: "12 PM - 2 PM", status: "📋 Some afternoon game props open", active: false },
      { time: "3 PM - 5 PM", status: "📈 Main prop lines start posting", active: true },
      { time: "5 PM - 7 PM", status: "🔥 Most props available — best time to check", active: true },
      { time: "7 PM - 10 PM", status: "⚡ Games starting — props close at first pitch", active: true },
      { time: "After 10 PM", status: "❌ Props closed for the day", active: false },
    ];

    return (
      <div
        style={{
          background: "#111",
          border: "1px solid #1e1e2a",
          borderRadius: 12,
          padding: 32,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 12 }}>⏱️</div>
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
            💡 Pro Tips
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
          🔄 Check Again Now
        </button>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #1e1e2a" }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
            Meanwhile — these always work:
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => setPropsMode("avg")}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #1e1e2a",
                background: "transparent",
                color: "#a5b4fc",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              📊 Season Average Picks →
            </button>
            <button
              onClick={() => onSwitchSection("esports")}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #1e1e2a",
                background: "transparent",
                color: "#a5b4fc",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              🎮 Esports Picks →
            </button>
            <button
              onClick={() => onSwitchSection("best")}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #1e1e2a",
                background: "transparent",
                color: "#a5b4fc",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              🎯 Best Game Picks →
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <SectionHeader
        title="🏀 Player Props — Best Bets Today"
        subtitle="Ranked by statistical edge vs standard prop lines"
        right={<RefreshButton loading={loading} onClick={load} />}
      />

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {[
          { id: "avg" as const, label: "📊 Season Average Picks" },
          { id: "real" as const, label: "🎯 Real Lines" },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setPropsMode(m.id)}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: `1px solid ${propsMode === m.id ? C.accent : C.border}`,
              background: propsMode === m.id ? "rgba(99,102,241,0.15)" : "transparent",
              color: propsMode === m.id ? "#a5b4fc" : C.textMuted,
              fontSize: 12,
              fontWeight: propsMode === m.id ? 700 : 500,
              cursor: "pointer",
            }}
          >
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
        ℹ️ Lines are estimated — always verify on DraftKings or FanDuel before betting real money
      </div>

      {/* Count */}
      {bets.length > 0 && (
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12, fontWeight: 600 }}>
          {bets.length} prop bet{bets.length === 1 ? "" : "s"} · {strongCount} 🔥 Strong · sorted by edge
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
                ? { emoji: "🔥", label: "Strong", color: C.green }
                : b.edgePct > 12
                  ? { emoji: "⭐", label: "Good", color: "#a5b4fc" }
                  : b.edgePct > 5
                    ? { emoji: "👀", label: "Fair", color: C.amber }
                    : { emoji: "·", label: "Low", color: C.textMuted };
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
                    display: "inline-block",
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
                  {badge.emoji} {badge.label}
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
                    {analyzing.has(b.id) ? "🔍…" : a ? "✓ Analyzed" : "✦ AI Analyze"}
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
                        {a.avoid ? "🚫 SKIP" : `✅ Pick: ${a.pick}`}
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
                        🏥 <strong>Injuries:</strong> {a.injuries}
                      </div>
                    )}
                    {a.form && (
                      <div style={{ fontSize: 11.5, color: "#86efac", marginBottom: 4 }}>
                        📊 <strong>Form:</strong> {a.form}
                      </div>
                    )}
                    {a.edge && (
                      <div style={{ fontSize: 11.5, color: "#c7d2fe", marginBottom: 4 }}>
                        ⚡ <strong>Edge:</strong> {a.edge}
                      </div>
                    )}
                    {a.warning && (
                      <div style={{ fontSize: 11.5, color: "#fde68a", marginBottom: 4 }}>
                        ⚠️ <strong>Warning:</strong> {a.warning}
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
            🎯 Real prop lines pulled live from US sportsbooks. Compared against season averages
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

// ──────────────────────── ESPORTS ────────────────────────
type EsportMatch = {
  id: number;
  begin_at: string | null;
  status: string;
  bo: number;
  tournament: string;
  league: string;
  isLive?: boolean;
  opponents: {
    id?: number;
    name: string;
    image?: string;
    acronym?: string;
    ranking?: number | null;
  }[];
};

// /api/analyze-game returns this shape; "pick" is a team name or "SKIP".
type EsportPrediction = {
  pick: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  injuries?: string;
  form?: string;
  edge?: string;
  warning?: string | null;
  avoid?: boolean;
};

type EsportGame = "csgo" | "lol" | "valorant" | "dota2";

const ESPORT_LABELS: Record<EsportGame, string> = {
  csgo: "🔫 CS2",
  lol: "⚔️ LoL",
  valorant: "🎯 Valorant",
  dota2: "🌿 Dota 2",
};

// Convert two PandaScore rankings into estimated American odds + win probs.
// Lower rank number = better team. Unknown ranks fall back to 50 (mid-tier).
function estimateOdds(r1?: number | null, r2?: number | null) {
  const rank1 = !r1 || r1 >= 999 ? 50 : r1;
  const rank2 = !r2 || r2 >= 999 ? 50 : r2;
  const total = rank1 + rank2;
  const prob1 = rank2 / total;
  const prob2 = rank1 / total;
  const toAmerican = (p: number) =>
    p >= 0.5 ? Math.round((-100 * p) / (1 - p)) : Math.round((100 * (1 - p)) / p);
  return {
    odds1: toAmerican(prob1),
    odds2: toAmerican(prob2),
    prob1: Math.round(prob1 * 100),
    prob2: Math.round(prob2 * 100),
  };
}

function EsportsPanel({
  nowMs,
  onAddBet,
}: {
  nowMs: number;
  onAddBet: (b: Omit<PaperBet, "id" | "placedAt" | "status">) => void;
}) {
  const [game, setGame] = useState<EsportGame>("csgo");
  const [matches, setMatches] = useState<EsportMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Record<number, EsportPrediction>>({});
  const [predicting, setPredicting] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Pull live + upcoming in parallel — live matches need an isLive flag so
      // the UI can show 🔴 LIVE and a red border.
      const [matchRes, liveRes] = await Promise.all([
        fetch(`/api/esports?game=${game}&type=matches`),
        fetch(`/api/esports?game=${game}&type=live`),
      ]);
      const matchBody = await matchRes.json().catch(() => null);
      const liveBody = await liveRes.json().catch(() => null);
      const live: EsportMatch[] = Array.isArray(liveBody?.data) ? liveBody.data : [];
      const upcoming: EsportMatch[] = Array.isArray(matchBody?.data) ? matchBody.data : [];
      const all: EsportMatch[] = [
        ...live.map((m) => ({ ...m, isLive: true })),
        ...upcoming,
      ];
      setMatches(all);
      if (all.length === 0 && (matchBody?.error || liveBody?.error)) {
        setError(matchBody?.error ?? liveBody?.error ?? "Failed to load matches");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [game]);

  useEffect(() => {
    load();
  }, [load]);

  const predict = async (m: EsportMatch) => {
    if (predicting.has(m.id) || predictions[m.id]) return;
    if (m.opponents.length < 2) return;
    setPredicting((prev) => new Set(prev).add(m.id));
    try {
      const t1 = m.opponents[0].name;
      const t2 = m.opponents[1].name;
      const odds = estimateOdds(m.opponents[0].ranking, m.opponents[1].ranking);
      const r = await fetch("/api/analyze-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team1: t1,
          team2: t2,
          sport: game.toUpperCase(),
          odds1: odds.odds1,
          odds2: odds.odds2,
          gameTime: m.begin_at,
        }),
      });
      const data = await r.json();
      if (r.ok) setPredictions((prev) => ({ ...prev, [m.id]: data as EsportPrediction }));
    } finally {
      setPredicting((prev) => {
        const n = new Set(prev);
        n.delete(m.id);
        return n;
      });
    }
  };

  // Rank-based verdict — if both teams have a ranking, use the gap to decide.
  // Without ranking data (which PandaScore only sometimes returns), default
  // to acronym presence as a weak tier proxy.
  const verdict = (m: EsportMatch): { label: string; color: string } => {
    if (m.opponents.length < 2) return { label: "TBD", color: C.textMuted };
    const r1 = m.opponents[0].ranking;
    const r2 = m.opponents[1].ranking;
    const hasRanks = r1 != null && r2 != null && r1 < 999 && r2 < 999;
    if (hasRanks) {
      const diff = Math.abs(r1! - r2!);
      if (diff > 20) return { label: "BET FAVORITE", color: C.green };
      if (diff > 10) return { label: "LEAN FAVORITE", color: "#86efac" };
      if (diff > 5) return { label: "SLIGHT EDGE", color: C.amber };
      return { label: "COIN FLIP", color: C.textMuted };
    }
    const aTier = m.opponents[0].acronym ? 1 : 0;
    const bTier = m.opponents[1].acronym ? 1 : 0;
    if (aTier === bTier) return { label: "COIN FLIP", color: C.textMuted };
    return { label: "SLIGHT EDGE", color: C.amber };
  };

  const sites = [
    { name: "Betway", url: "https://betway.com/esports", color: "#00a651" },
    { name: "GG.bet", url: "https://gg.bet", color: "#ff6b00" },
    { name: "Pinnacle", url: "https://pinnacle.com/esports", color: "#e63946" },
  ];

  return (
    <>
      <SectionHeader
        title="🎮 Esports"
        subtitle="Live and upcoming pro matches. Estimated odds and AI predictions."
        right={<RefreshButton loading={loading} onClick={load} />}
      />
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {(["csgo", "lol", "valorant", "dota2"] as const).map((g) => (
          <button
            key={g}
            onClick={() => {
              setGame(g);
              setMatches([]);
              setPredictions({});
            }}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${game === g ? C.accent : C.border}`,
              background: game === g ? "rgba(99,102,241,0.15)" : "transparent",
              color: game === g ? "#a5b4fc" : C.textMuted,
              fontSize: 12,
              fontWeight: game === g ? 700 : 400,
              cursor: "pointer",
              minHeight: 40,
            }}
          >
            {ESPORT_LABELS[g]}
          </button>
        ))}
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}
      {loading && !error && (
        <div style={{ color: C.textMuted, padding: 32, textAlign: "center" }}>Loading matches…</div>
      )}
      {!loading && matches.length === 0 && !error && (
        <div
          style={{
            color: C.textMuted,
            padding: 32,
            textAlign: "center",
            background: C.card,
            borderRadius: 12,
          }}
        >
          No upcoming {ESPORT_LABELS[game].replace(/^[^A-Za-z]+/, "").trim()} matches found.
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {matches.map((m) => {
          const v = verdict(m);
          const t1 = m.opponents[0]?.name ?? "TBD";
          const t2 = m.opponents[1]?.name ?? "TBD";
          const r1 = m.opponents[0]?.ranking ?? null;
          const r2 = m.opponents[1]?.ranking ?? null;
          const odds = estimateOdds(r1, r2);
          const cd = m.begin_at ? countdown(m.begin_at, nowMs) : { label: "TBD", live: false };
          const isLive = m.isLive || cd.live;
          const timeLabel = isLive ? "🔴 LIVE" : cd.label;
          const pred = predictions[m.id];

          const aiPick = pred && !pred.avoid && pred.pick !== "SKIP" ? pred.pick : null;
          const aiOdds = aiPick === t1 ? odds.odds1 : aiPick === t2 ? odds.odds2 : -110;

          const addAiBet = () => {
            if (!aiPick) return;
            onAddBet({
              type: "esports",
              sport: ESPORT_LABELS[game].replace(/^[^A-Za-z]+/, "").trim(),
              game: `${t1} vs ${t2}`,
              pick: `${aiPick} to win`,
              odds: aiOdds,
              book: "Betway",
              stake: 100,
              potWin: payoutOn(100, aiOdds),
              notes: pred?.reasoning ?? "",
            });
            alert(`✅ Bet on ${aiPick} added to paper bets!`);
          };

          return (
            <div
              key={m.id}
              style={{
                background: C.card,
                border: `1px solid ${isLive ? "rgba(239,68,68,0.3)" : C.border}`,
                borderRadius: 12,
                padding: 16,
              }}
            >
              {/* Header row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 11, color: C.textMuted, minWidth: 0 }}>
                  {m.tournament || m.league || "—"} · BO{m.bo || "?"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: isLive ? C.red : C.textMuted, fontWeight: isLive ? 700 : 400 }}>
                    {timeLabel}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: 4,
                      background: `${v.color}18`,
                      color: v.color,
                    }}
                  >
                    {v.label}
                  </span>
                </div>
              </div>

              {/* Two-column teams + estimated odds */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                {[
                  { name: t1, odds: odds.odds1, prob: odds.prob1, rank: r1 },
                  { name: t2, odds: odds.odds2, prob: odds.prob2, rank: r2 },
                ].map((team, i) => (
                  <div
                    key={i}
                    style={{ background: "#1a1a24", borderRadius: 8, padding: 12, textAlign: "center" }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
                      {team.name}
                    </div>
                    {team.rank && team.rank < 999 ? (
                      <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>Rank #{team.rank}</div>
                    ) : null}
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: team.odds > 0 ? C.green : "#fff",
                      }}
                    >
                      {team.odds > 0 ? "+" : ""}
                      {team.odds}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{team.prob}% to win</div>
                  </div>
                ))}
              </div>

              {/* AI Prediction result */}
              {pred && (
                <div
                  style={{
                    background: "rgba(99,102,241,0.05)",
                    border: "1px solid rgba(99,102,241,0.2)",
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#a5b4fc" }}>
                      🏆 AI picks {pred.pick}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background:
                          pred.confidence === "high"
                            ? "rgba(34,197,94,0.15)"
                            : pred.confidence === "medium"
                              ? "rgba(245,158,11,0.15)"
                              : "rgba(107,114,128,0.15)",
                        color:
                          pred.confidence === "high"
                            ? C.green
                            : pred.confidence === "medium"
                              ? C.amber
                              : C.textMuted,
                      }}
                    >
                      {pred.confidence?.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.5 }}>
                    {pred.reasoning}
                  </div>
                  {aiPick && (
                    <button
                      onClick={addAiBet}
                      style={{
                        marginTop: 8,
                        padding: "7px 14px",
                        borderRadius: 6,
                        border: "none",
                        background: C.accent,
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        minHeight: 36,
                      }}
                    >
                      + Paper Bet on {aiPick}
                    </button>
                  )}
                </div>
              )}

              {/* AI predict button */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => predict(m)}
                  disabled={predicting.has(m.id) || !!pred || m.opponents.length < 2}
                  style={{
                    flex: 1,
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid rgba(99,102,241,0.4)",
                    background: "rgba(99,102,241,0.08)",
                    color: pred ? "#4b5563" : "#a5b4fc",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: pred ? "default" : "pointer",
                    minHeight: 36,
                  }}
                >
                  {predicting.has(m.id) ? "🔍 Predicting…" : pred ? "✓ Predicted" : "✦ AI Predict"}
                </button>
              </div>

              {/* Betting sites */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                {sites.map((s) => (
                  <a
                    key={s.name}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      background: `${s.color}15`,
                      border: `1px solid ${s.color}40`,
                      color: s.color,
                      textDecoration: "none",
                    }}
                  >
                    {s.name} →
                  </a>
                ))}
                <div style={{ fontSize: 10, color: "#4b5563", alignSelf: "center" }}>
                  Verify odds on site before betting
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ──────────────────────── PAPER BETS ────────────────────────
function PaperBetsPanel({
  bets,
  bankroll,
  setBankroll,
  update,
  remove,
  onNotify,
}: {
  bets: PaperBet[];
  bankroll: number;
  setBankroll: (next: number | ((prev: number) => number)) => void;
  update: (id: number, patch: Partial<PaperBet>) => void;
  remove: (id: number) => void;
  onNotify: (m: string) => void;
}) {
  const [adjust, setAdjust] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "settled">("all");

  const pending = bets.filter((b) => b.status === "pending");
  const settled = bets.filter((b) => b.status !== "pending");
  const won = bets.filter((b) => b.status === "won");
  const lost = bets.filter((b) => b.status === "lost");

  const totalStaked = settled.reduce((s, b) => s + b.stake, 0);
  const totalProfit = settled.reduce((s, b) => {
    if (b.status === "won") return s + b.potWin;
    if (b.status === "lost") return s - b.stake;
    return s;
  }, 0);
  const winRate = won.length + lost.length > 0 ? (won.length / (won.length + lost.length)) * 100 : 0;
  const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;

  const settle = (b: PaperBet, status: "won" | "lost" | "void") => {
    update(b.id, { status });
    // Reserve-on-placement model: stake was already deducted when the bet
    // was added. Wins refund stake + profit; voids refund stake; losses are
    // already accounted for.
    if (status === "won") setBankroll((prev) => prev + b.stake + b.potWin);
    else if (status === "void") setBankroll((prev) => prev + b.stake);
    onNotify(`✓ Marked ${b.pick} as ${status.toUpperCase()}`);
  };

  const deposit = () => {
    const n = parseFloat(adjust);
    if (!isNaN(n) && n !== 0) {
      setBankroll(Math.max(0, bankroll + n));
      setAdjust("");
      onNotify(n > 0 ? `+ Deposited $${n}` : `− Withdrew $${Math.abs(n)}`);
    }
  };

  const display = filter === "pending" ? pending : filter === "settled" ? settled : bets;

  return (
    <>
      <SectionHeader
        title="📋 Paper Bets"
        subtitle="Track virtual bets with real bankroll discipline. Separate from crypto."
      />

      {/* Stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        {[
          { label: "Bankroll", value: `$${bankroll.toLocaleString()}`, color: C.text },
          {
            label: "P&L",
            value: `${totalProfit >= 0 ? "+" : ""}$${totalProfit.toFixed(2)}`,
            color: totalProfit >= 0 ? C.green : C.red,
          },
          { label: "Win rate", value: `${winRate.toFixed(0)}%`, color: C.blue },
          {
            label: "ROI",
            value: `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`,
            color: roi >= 0 ? C.green : C.red,
          },
          { label: "Total bets", value: String(bets.length), color: C.text },
          { label: "Pending", value: String(pending.length), color: C.amber },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: 12,
            }}
          >
            <div style={{ fontSize: 10.5, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Bankroll adjust */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 14,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          value={adjust}
          onChange={(e) => setAdjust(e.target.value)}
          placeholder="Amount (+ deposit, − withdraw)"
          inputMode="decimal"
          style={{
            flex: 1,
            minWidth: 200,
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
          onClick={deposit}
          style={{
            padding: "10px 18px",
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
          Apply
        </button>
        <button
          onClick={() => {
            setBankroll(1000);
            onNotify("✓ Bankroll reset to $1000");
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: "transparent",
            color: C.textDim,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            minHeight: 40,
          }}
        >
          Reset
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {([
          { id: "all" as const, label: `All (${bets.length})` },
          { id: "pending" as const, label: `Pending (${pending.length})` },
          { id: "settled" as const, label: `Settled (${settled.length})` },
        ]).map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: `1px solid ${filter === f.id ? C.accent : C.border}`,
              background: filter === f.id ? "rgba(99,102,241,0.15)" : "transparent",
              color: filter === f.id ? "#a5b4fc" : C.textMuted,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {display.length === 0 && (
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
          No bets yet. Add some from Best Picks, Player Props, or Esports.
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {display.map((b) => (
          <div
            key={b.id}
            style={{
              background: C.card,
              border: `1px solid ${
                b.status === "won"
                  ? "rgba(34,197,94,0.3)"
                  : b.status === "lost"
                    ? "rgba(239,68,68,0.3)"
                    : C.border
              }`,
              borderRadius: 10,
              padding: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{b.pick}</div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                  {b.sport} · {b.game}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: b.odds > 0 ? C.green : C.text }}>
                  {b.odds > 0 ? "+" : ""}
                  {b.odds}
                </div>
                <div style={{ fontSize: 10, color: C.textMuted }}>{b.book}</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>
              ${b.stake.toFixed(0)} → ${b.potWin.toFixed(0)}
              {b.notes && <span style={{ color: C.textMuted }}> · {b.notes}</span>}
            </div>
            {b.status === "pending" ? (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => settle(b, "won")}
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid rgba(34,197,94,0.4)",
                    background: "rgba(34,197,94,0.1)",
                    color: C.green,
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    minHeight: 32,
                  }}
                >
                  ✓ Won
                </button>
                <button
                  onClick={() => settle(b, "lost")}
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid rgba(239,68,68,0.4)",
                    background: "rgba(239,68,68,0.1)",
                    color: C.red,
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    minHeight: 32,
                  }}
                >
                  ✗ Lost
                </button>
                <button
                  onClick={() => settle(b, "void")}
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: `1px solid ${C.border}`,
                    background: "transparent",
                    color: C.textMuted,
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    minHeight: 32,
                  }}
                >
                  Void
                </button>
                <button
                  onClick={() => remove(b.id)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: `1px solid ${C.border}`,
                    background: "transparent",
                    color: C.textMuted,
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    minHeight: 32,
                  }}
                >
                  🗑
                </button>
              </div>
            ) : (
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: b.status === "won" ? C.green : b.status === "lost" ? C.red : C.textMuted,
                }}
              >
                {b.status === "won" && `✓ Won +$${b.potWin.toFixed(2)}`}
                {b.status === "lost" && `✗ Lost −$${b.stake.toFixed(2)}`}
                {b.status === "void" && "Void"}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
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
        title="📚 Book Health"
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
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    {e.arbCount} arbs · {e.normalCount} normal bets
                  </div>
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
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  onClick={() => adjust(e.book, "arb")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(245,158,11,0.4)",
                    background: "rgba(245,158,11,0.08)",
                    color: C.amber,
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    minHeight: 32,
                  }}
                >
                  + Arb
                </button>
                <button
                  onClick={() => adjust(e.book, "normal")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(34,197,94,0.4)",
                    background: "rgba(34,197,94,0.08)",
                    color: C.green,
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    minHeight: 32,
                  }}
                >
                  + Normal
                </button>
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
