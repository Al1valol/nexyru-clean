"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ───────────────────────── auth ─────────────────────────
const PASSWORD = "nexyru2026";
const AUTH_KEY = "nexyru_private_auth";

// ───────────────────────── theme ─────────────────────────
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
};

// ───────────────────────── page ─────────────────────────
type Tab = "journal" | "crypto" | "odds" | "poker";

export default function PrivatePage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("journal");

  useEffect(() => {
    try {
      setAuthed(localStorage.getItem(AUTH_KEY) === "true");
    } catch {
      setAuthed(false);
    }
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch {}
    setAuthed(false);
  }, []);

  if (authed === null) {
    return <div style={{ background: C.bg, minHeight: "100vh" }} />;
  }
  if (!authed) {
    return <PasswordGate onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div
      style={{
        background: C.bg,
        color: C.text,
        minHeight: "100vh",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <TopBar tab={tab} setTab={setTab} />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 96px" }}>
        {tab === "journal" && <JournalTab />}
        {tab === "crypto" && <CryptoTab />}
        {tab === "odds" && <OddsTab />}
        {tab === "poker" && <PokerTab />}
      </main>
      <button
        onClick={logout}
        style={{
          position: "fixed",
          bottom: 16,
          right: 20,
          background: "transparent",
          border: "none",
          color: C.textMuted,
          fontSize: 12,
          cursor: "pointer",
          textDecoration: "underline",
        }}
      >
        Logout
      </button>
      <style jsx global>{`
        @keyframes nexyru-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .nexyru-shake { animation: nexyru-shake 0.4s ease-in-out; }
        @keyframes nexyru-spin {
          to { transform: rotate(360deg); }
        }
        .nexyru-spin { animation: nexyru-spin 0.9s linear infinite; }
      `}</style>
    </div>
  );
}

// ───────────────────────── password gate ─────────────────────────
function PasswordGate({ onSuccess }: { onSuccess: () => void }) {
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (value === PASSWORD) {
      try {
        localStorage.setItem(AUTH_KEY, "true");
      } catch {}
      onSuccess();
    } else {
      setWrong(true);
      setTimeout(() => setWrong(false), 500);
    }
  }

  return (
    <div
      style={{
        background: C.bg,
        color: C.text,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <form
        onSubmit={submit}
        className={wrong ? "nexyru-shake" : ""}
        style={{
          background: C.card,
          border: `1px solid ${wrong ? C.red : C.border}`,
          borderRadius: 14,
          padding: 32,
          width: "100%",
          maxWidth: 360,
          textAlign: "center",
          transition: "border-color 150ms",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 11,
            background: "linear-gradient(135deg,#6366f1,#4f46e5)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            color: "#fff",
            fontSize: 20,
            marginBottom: 16,
          }}
        >
          N
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Private</div>
        <div style={{ color: C.textDim, fontSize: 13, marginBottom: 20 }}>
          Enter password to continue
        </div>
        <input
          ref={inputRef}
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Password"
          style={{
            width: "100%",
            background: C.card2,
            border: `1px solid ${wrong ? C.red : C.border}`,
            borderRadius: 8,
            padding: "11px 14px",
            color: C.text,
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
            marginBottom: 12,
            transition: "border-color 150ms",
          }}
        />
        <button
          type="submit"
          style={{
            width: "100%",
            background: C.accent,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "11px 14px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Enter
        </button>
      </form>
    </div>
  );
}

// ───────────────────────── top bar ─────────────────────────
const TABS: { key: Tab; label: string }[] = [
  { key: "journal", label: "Journal" },
  { key: "crypto", label: "Crypto" },
  { key: "odds", label: "Odds" },
  { key: "poker", label: "Poker" },
];

function TopBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <header
      style={{
        background: C.bg,
        borderBottom: `1px solid ${C.border}`,
        position: "sticky",
        top: 0,
        zIndex: 10,
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <a
          href="/"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "linear-gradient(135deg,#6366f1,#4f46e5)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            color: "#fff",
            fontSize: 14,
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          N
        </a>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: active ? C.text : C.textMuted,
                  padding: "6px 4px",
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  borderBottom: `2px solid ${active ? C.accent : "transparent"}`,
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

// ───────────────────────── journal tab ─────────────────────────
interface Trade {
  pnl?: number | string;
  date?: number | string;
}

function loadAllTrades(): Trade[] {
  if (typeof window === "undefined") return [];
  const all: Trade[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (!key.startsWith("tradedesk_trades_") || !key.endsWith("_v1")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) all.push(...parsed);
      } catch {}
    }
  } catch {}
  return all;
}

function JournalTab() {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    setTrades(loadAllTrades());
  }, []);

  const stats = useMemo(() => {
    let pnlTotal = 0;
    let wins = 0;
    let losses = 0;
    let best = -Infinity;
    let count = 0;
    for (const t of trades) {
      const v = typeof t.pnl === "number" ? t.pnl : parseFloat(String(t.pnl ?? ""));
      if (!Number.isFinite(v)) continue;
      count++;
      pnlTotal += v;
      if (v > 0) wins++;
      else if (v < 0) losses++;
      if (v > best) best = v;
    }
    const decided = wins + losses;
    const winRate = decided > 0 ? (wins / decided) * 100 : 0;
    return {
      count,
      pnlTotal,
      winRate,
      best: best === -Infinity ? 0 : best,
    };
  }, [trades]);

  return (
    <section>
      <SectionTitle title="Journal" subtitle="Aggregate stats across all accounts" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <StatCard label="Total Trades" value={stats.count.toLocaleString()} />
        <StatCard
          label="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          color={stats.winRate >= 50 ? C.green : C.textDim}
        />
        <StatCard
          label="Total PnL"
          value={`${stats.pnlTotal >= 0 ? "+" : ""}$${stats.pnlTotal.toFixed(2)}`}
          color={stats.pnlTotal >= 0 ? C.green : C.red}
        />
        <StatCard
          label="Best Trade"
          value={`$${stats.best.toFixed(2)}`}
          color={stats.best > 0 ? C.green : C.textDim}
        />
      </div>
      <a
        href="/dashboard"
        style={{
          display: "inline-block",
          background: C.accent,
          color: "#fff",
          textDecoration: "none",
          padding: "10px 18px",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Open Full Journal →
      </a>
    </section>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          color: C.textMuted,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.01em",
          color: color ?? C.text,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ───────────────────────── crypto tab ─────────────────────────
interface TrendingCoin {
  item: {
    id: string;
    name: string;
    symbol: string;
    market_cap_rank: number | null;
    data?: { price?: number; price_change_percentage_24h?: { usd?: number } };
  };
}
interface DexPair {
  pairAddress: string;
  chainId: string;
  dexId: string;
  baseToken: { symbol: string; name: string };
  quoteToken: { symbol: string };
  priceUsd?: string;
  priceChange?: { h1?: number; h24?: number };
  volume?: { h24?: number };
  pairCreatedAt?: number;
}
interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  market_cap_rank: number | null;
}

function CryptoTab() {
  const [trending, setTrending] = useState<TrendingCoin[] | null>(null);
  const [pairs, setPairs] = useState<DexPair[] | null>(null);
  const [gainers, setGainers] = useState<MarketCoin[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [trendRes, pairsRes, gainersRes] = await Promise.allSettled([
        fetch("https://api.coingecko.com/api/v3/search/trending"),
        fetch("https://api.dexscreener.com/latest/dex/search?q=meme"),
        fetch(
          "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=price_change_percentage_24h_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h",
        ),
      ]);

      if (trendRes.status === "fulfilled" && trendRes.value.ok) {
        const data = (await trendRes.value.json()) as { coins?: TrendingCoin[] };
        setTrending((data.coins ?? []).slice(0, 7));
      }
      if (pairsRes.status === "fulfilled" && pairsRes.value.ok) {
        const data = (await pairsRes.value.json()) as { pairs?: DexPair[] };
        const sorted = [...(data.pairs ?? [])]
          .filter((p) => (p.volume?.h24 ?? 0) > 0)
          .sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0))
          .slice(0, 10);
        setPairs(sorted);
      }
      if (gainersRes.status === "fulfilled" && gainersRes.value.ok) {
        const data = (await gainersRes.value.json()) as MarketCoin[];
        setGainers(data.slice(0, 10));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <section>
      <SectionTitle
        title="Crypto"
        subtitle="Auto-refreshes every 5 min · CoinGecko + DexScreener"
        right={
          <button
            onClick={load}
            disabled={loading}
            style={{
              background: C.card2,
              border: `1px solid ${C.border}`,
              color: C.text,
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {loading && <Spinner small />}
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        }
      />
      {error && <ErrorBox>{error}</ErrorBox>}

      <Subhead>Trending coins (top 7)</Subhead>
      {trending === null ? (
        <LoadingBlock />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {trending.map((c) => {
            const change = c.item.data?.price_change_percentage_24h?.usd;
            const positive = (change ?? 0) >= 0;
            return (
              <div
                key={c.item.id}
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                      {c.item.name}{" "}
                      <span style={{ color: C.textMuted, fontWeight: 500 }}>
                        {c.item.symbol}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                      Rank #{c.item.market_cap_rank ?? "—"}
                    </div>
                  </div>
                  {change !== undefined && (
                    <span
                      style={{
                        color: positive ? C.green : C.red,
                        fontSize: 13,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {positive ? "+" : ""}
                      {change.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Subhead>New hot pairs (DexScreener)</Subhead>
      {pairs === null ? (
        <LoadingBlock />
      ) : (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 70px 80px 80px 90px 30px",
              padding: "10px 14px",
              borderBottom: `1px solid ${C.border}`,
              fontSize: 11,
              fontWeight: 700,
              color: C.textMuted,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              gap: 8,
            }}
          >
            <span>Pair</span>
            <span>Chain</span>
            <span>1h</span>
            <span>24h</span>
            <span style={{ textAlign: "right" }}>Vol 24h</span>
            <span />
          </div>
          {pairs.map((p) => {
            const ageHr = p.pairCreatedAt
              ? (Date.now() - p.pairCreatedAt) / (1000 * 60 * 60)
              : null;
            const vol = p.volume?.h24 ?? 0;
            const fire = vol > 500_000 && ageHr !== null && ageHr < 24;
            const h1 = p.priceChange?.h1;
            const h24 = p.priceChange?.h24;
            return (
              <div
                key={p.pairAddress}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 70px 80px 80px 90px 30px",
                  padding: "10px 14px",
                  borderTop: `1px solid ${C.borderSoft}`,
                  fontSize: 13,
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    {p.baseToken.symbol}/{p.quoteToken.symbol}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: C.textMuted,
                      marginTop: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {p.baseToken.name} · age{" "}
                    {ageHr === null ? "?" : ageHr < 24 ? `${ageHr.toFixed(0)}h` : `${(ageHr / 24).toFixed(0)}d`}
                  </div>
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: C.textDim,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {p.chainId}
                </span>
                <ChangeCell value={h1} />
                <ChangeCell value={h24} />
                <span style={{ textAlign: "right", color: C.textDim, fontSize: 12 }}>
                  ${formatBigNum(vol)}
                </span>
                <span style={{ textAlign: "center" }}>{fire ? "🔥" : ""}</span>
              </div>
            );
          })}
        </div>
      )}

      <Subhead>Top gainers (24h)</Subhead>
      {gainers === null ? (
        <LoadingBlock />
      ) : (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "30px 1fr 120px 100px",
              padding: "10px 14px",
              borderBottom: `1px solid ${C.border}`,
              fontSize: 11,
              fontWeight: 700,
              color: C.textMuted,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            <span>#</span>
            <span>Coin</span>
            <span style={{ textAlign: "right" }}>Price</span>
            <span style={{ textAlign: "right" }}>24h</span>
          </div>
          {gainers.map((c) => (
            <div
              key={c.id}
              style={{
                display: "grid",
                gridTemplateColumns: "30px 1fr 120px 100px",
                padding: "10px 14px",
                borderTop: `1px solid ${C.borderSoft}`,
                fontSize: 13,
                alignItems: "center",
              }}
            >
              <span style={{ color: C.textMuted, fontSize: 12 }}>
                {c.market_cap_rank ?? "—"}
              </span>
              <span>
                <span style={{ fontWeight: 600 }}>{c.name}</span>{" "}
                <span style={{ color: C.textMuted, textTransform: "uppercase", fontSize: 11 }}>
                  {c.symbol}
                </span>
              </span>
              <span style={{ textAlign: "right", color: C.textDim }}>
                ${formatPrice(c.current_price)}
              </span>
              <ChangeCell value={c.price_change_percentage_24h} alignRight />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ChangeCell({ value, alignRight }: { value: number | null | undefined; alignRight?: boolean }) {
  if (value === null || value === undefined) {
    return (
      <span style={{ color: C.textMuted, fontSize: 12, textAlign: alignRight ? "right" : "left" }}>
        —
      </span>
    );
  }
  const positive = value >= 0;
  return (
    <span
      style={{
        color: positive ? C.green : C.red,
        fontSize: 12,
        fontWeight: 600,
        textAlign: alignRight ? "right" : "left",
      }}
    >
      {positive ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

function formatBigNum(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}
function formatPrice(n: number): string {
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 0.01) return n.toFixed(4);
  return n.toExponential(2);
}

// ───────────────────────── odds tab ─────────────────────────
interface OddsOutcome {
  name: string;
  price: number;
}
interface OddsMarket {
  key: string;
  outcomes: OddsOutcome[];
}
interface OddsBookmaker {
  key: string;
  title: string;
  last_update?: string;
  markets: OddsMarket[];
}
interface OddsGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

const SPORT_FILTERS: { label: string; key: string }[] = [
  { label: "All", key: "upcoming" },
  { label: "NFL", key: "americanfootball_nfl" },
  { label: "NBA", key: "basketball_nba" },
  { label: "MLB", key: "baseball_mlb" },
  { label: "NHL", key: "icehockey_nhl" },
  { label: "MMA", key: "mma_mixed_martial_arts" },
  { label: "Soccer", key: "soccer_epl" },
];

interface BestOdds {
  team: string;
  price: number;
  book: string;
}

function bestPriceForTeam(game: OddsGame, team: string): BestOdds | null {
  let best: BestOdds | null = null;
  for (const b of game.bookmakers ?? []) {
    const h2h = b.markets?.find((m) => m.key === "h2h");
    if (!h2h) continue;
    for (const o of h2h.outcomes) {
      if (o.name !== team) continue;
      if (best === null || o.price > best.price) {
        best = { team: o.name, price: o.price, book: b.title };
      }
    }
  }
  return best;
}

function americanToImpliedProb(odds: number): number {
  return odds > 0 ? 100 / (odds + 100) : -odds / (-odds + 100);
}

interface ArbStakes {
  stakeA: number;
  stakeB: number;
  totalStake: number;
  profit: number;
}

function calcArbStakes(oddsA: number, oddsB: number, targetProfit = 100): ArbStakes | null {
  const pA = americanToImpliedProb(oddsA);
  const pB = americanToImpliedProb(oddsB);
  const overround = pA + pB;
  if (overround >= 1) return null;
  const totalPayout = targetProfit / (1 - overround);
  const stakeA = totalPayout * pA;
  const stakeB = totalPayout * pB;
  return {
    stakeA,
    stakeB,
    totalStake: stakeA + stakeB,
    profit: totalPayout - (stakeA + stakeB),
  };
}

function OddsTab() {
  const [sport, setSport] = useState<string>("upcoming");
  const [games, setGames] = useState<OddsGame[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestsRemaining, setRequestsRemaining] = useState<string | null>(null);

  const load = useCallback(async (sportKey: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/odds?sport=${encodeURIComponent(sportKey)}&daysFrom=2`);
      const body = await res.json();
      if (!res.ok) {
        setError((body as { error?: string }).error ?? `Error (${res.status})`);
        setGames([]);
        return;
      }
      setGames((body.games as OddsGame[]) ?? []);
      setRequestsRemaining((body.requestsRemaining as string | null) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(sport);
  }, [sport, load]);

  // Sort: arbs first, then by start time
  const sorted = useMemo(() => {
    if (!games) return [];
    const decorated = games.map((g) => {
      const home = bestPriceForTeam(g, g.home_team);
      const away = bestPriceForTeam(g, g.away_team);
      const isArb = home !== null && away !== null && home.price > 0 && away.price > 0;
      return { g, home, away, isArb };
    });
    decorated.sort((a, b) => {
      if (a.isArb !== b.isArb) return a.isArb ? -1 : 1;
      return new Date(a.g.commence_time).getTime() - new Date(b.g.commence_time).getTime();
    });
    return decorated;
  }, [games]);

  return (
    <section>
      <SectionTitle
        title="Odds"
        subtitle="Best line per team across US books · arbs sorted first"
        right={
          requestsRemaining !== null ? (
            <span style={{ fontSize: 11, color: C.textMuted }}>
              {requestsRemaining} API calls left
            </span>
          ) : null
        }
      />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {SPORT_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setSport(f.key)}
            style={{
              background: sport === f.key ? C.accent : C.card2,
              color: sport === f.key ? "#fff" : C.text,
              border: `1px solid ${sport === f.key ? C.accent : C.border}`,
              borderRadius: 999,
              padding: "5px 12px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      {games === null ? (
        <LoadingBlock />
      ) : sorted.length === 0 ? (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 18,
            color: C.textMuted,
            fontSize: 13,
          }}
        >
          {loading ? "Loading..." : "No games in the selected window."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map(({ g, home, away, isArb }) => (
            <GameCard
              key={g.id}
              game={g}
              home={home}
              away={away}
              isArb={isArb}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function GameCard({
  game,
  home,
  away,
  isArb,
}: {
  game: OddsGame;
  home: BestOdds | null;
  away: BestOdds | null;
  isArb: boolean;
}) {
  const arb = isArb && home && away ? calcArbStakes(home.price, away.price) : null;
  const start = new Date(game.commence_time);
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${isArb ? C.green : C.border}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: C.textMuted,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {game.sport_title}
        </span>
        <span style={{ color: C.textMuted, fontSize: 12 }}>·</span>
        <span style={{ fontSize: 12, color: C.textDim }}>
          {start.toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
        {isArb && (
          <span
            style={{
              marginLeft: "auto",
              background: "rgba(34,197,94,0.15)",
              border: `1px solid ${C.green}`,
              color: C.green,
              padding: "2px 10px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.04em",
            }}
          >
            ARB ✓
          </span>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <TeamLine team={game.away_team} odds={away} />
        <TeamLine team={game.home_team} odds={home} alignRight />
      </div>

      {arb && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${C.border}`,
            fontSize: 12.5,
            color: C.textDim,
            lineHeight: 1.6,
          }}
        >
          Bet <strong style={{ color: C.green }}>${arb.stakeA.toFixed(2)}</strong> on{" "}
          {away?.team} at {away?.book} +{" "}
          <strong style={{ color: C.green }}>${arb.stakeB.toFixed(2)}</strong> on{" "}
          {home?.team} at {home?.book} ={" "}
          <strong style={{ color: C.green }}>${arb.profit.toFixed(2)} guaranteed profit</strong>{" "}
          (total stake ${arb.totalStake.toFixed(2)})
        </div>
      )}
    </div>
  );
}

function TeamLine({
  team,
  odds,
  alignRight,
}: {
  team: string;
  odds: BestOdds | null;
  alignRight?: boolean;
}) {
  return (
    <div style={{ textAlign: alignRight ? "right" : "left" }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{team}</div>
      {odds ? (
        <div style={{ marginTop: 4 }}>
          <span
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: odds.price > 0 ? C.green : C.text,
              letterSpacing: "-0.01em",
            }}
          >
            {odds.price > 0 ? "+" : ""}
            {odds.price}
          </span>
          <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 6 }}>
            {odds.book}
          </span>
        </div>
      ) : (
        <div style={{ marginTop: 4, fontSize: 12, color: C.textMuted }}>—</div>
      )}
    </div>
  );
}

// ───────────────────────── poker tab ─────────────────────────
function PokerTab() {
  const [hand, setHand] = useState("");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const analyze = useCallback(async () => {
    if (!hand.trim()) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const res = await fetch("/api/analyze-poker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hand }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError((body as { error?: string }).error ?? `Error (${res.status})`);
        return;
      }
      setAnalysis((body.analysis as string) ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze");
    } finally {
      setLoading(false);
    }
  }, [hand]);

  const copy = useCallback(async () => {
    if (!analysis) return;
    try {
      await navigator.clipboard.writeText(analysis);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }, [analysis]);

  return (
    <section>
      <SectionTitle title="Poker" subtitle="Paste a hand history — Claude returns a structured breakdown" />
      <textarea
        value={hand}
        onChange={(e) => setHand(e.target.value)}
        placeholder="Paste your hand history here..."
        style={{
          width: "100%",
          minHeight: 200,
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 14,
          color: C.text,
          fontSize: 13,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          outline: "none",
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={analyze}
          disabled={loading || !hand.trim()}
          style={{
            background: C.accent,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading || !hand.trim() ? "default" : "pointer",
            opacity: loading || !hand.trim() ? 0.6 : 1,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {loading && <Spinner small />}
          {loading ? "Analyzing..." : "Analyze Hand"}
        </button>
        {analysis && (
          <button
            onClick={copy}
            style={{
              background: C.card2,
              color: C.text,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {copied ? "Copied!" : "Copy Analysis"}
          </button>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 14 }}>
          <ErrorBox>{error}</ErrorBox>
        </div>
      )}

      {analysis && (
        <div
          style={{
            marginTop: 20,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 18,
          }}
        >
          <RenderAnalysis text={analysis} />
        </div>
      )}
    </section>
  );
}

function RenderAnalysis({ text }: { text: string }) {
  // Split on **bold** markers. Sections look like "**1. PRE-FLOP**".
  // We treat any `**...**` chunk as a header line.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <div style={{ fontSize: 14, lineHeight: 1.7, color: C.textDim, whiteSpace: "pre-wrap" }}>
      {parts.map((p, i) => {
        const m = p.match(/^\*\*([^*]+)\*\*$/);
        if (m) {
          return (
            <span
              key={i}
              style={{
                display: "block",
                marginTop: i === 0 ? 0 : 16,
                marginBottom: 6,
                color: C.text,
                fontWeight: 700,
                fontSize: 14.5,
                letterSpacing: "0.01em",
              }}
            >
              {m[1].trim()}
            </span>
          );
        }
        return (
          <span key={i}>
            {p}
          </span>
        );
      })}
    </div>
  );
}

// ───────────────────────── shared bits ─────────────────────────
function SectionTitle({
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
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ margin: "4px 0 0", color: C.textDim, fontSize: 13 }}>{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

function Subhead({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: C.textMuted,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        margin: "16px 0 10px",
      }}
    >
      {children}
    </div>
  );
}

function LoadingBlock() {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        color: C.textMuted,
        fontSize: 13,
        marginBottom: 16,
      }}
    >
      <Spinner />
      Loading...
    </div>
  );
}

function Spinner({ small }: { small?: boolean } = {}) {
  const size = small ? 12 : 16;
  return (
    <span
      className="nexyru-spin"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid ${C.textMuted}`,
        borderTopColor: "transparent",
        borderRadius: "50%",
      }}
    />
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.25)",
        color: "#fca5a5",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 13,
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}
