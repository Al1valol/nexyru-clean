"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineStyle,
  CrosshairMode,
  ColorType,
  createSeriesMarkers,
  createTextWatermark,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type SeriesMarker,
  type CandlestickData,
  type HistogramData,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";

interface ChartRow extends CandlestickData<UTCTimestamp> {
  volume?: number;
}

// ───────────────────────── types ─────────────────────────

interface Trade {
  id: string;
  pair?: string;
  symbol?: string;
  type?: "long" | "short" | string;
  entryPrice?: number | string;
  exitPrice?: number | string;
  size?: number | string;
  date?: number | string;
  strategy?: string;
  notes?: string;
  pnl?: number;
  pnlPct?: number;
  tags?: string[];
  _hasScreenshot?: boolean;
  screenshot?: string | null;
  screenshotUrl?: string | null;
}

type Triad = "yes" | "no" | "partial";
type Grade = "A" | "B" | "C" | "D" | "F";
type Phase = "entry" | "reveal" | "grade";

interface ExitOption {
  label: string;
  price: number;
  isCorrect: boolean;
}

interface Review {
  tradeId: string;
  matchedSetup: Triad | null;
  exitPickedIdx: number | null;
  exitPickedCorrect: boolean;
  confidence: number;            // 1..5
  grade: Grade | null;
  differently: string;
  score: number;                 // 0..25
  setupCorrect: boolean;         // true if setup answer aligned w/ outcome
  reviewedAt: number;
}

// ───────────────────── screenshot loading (IDB) ─────────────────────

const shotCache: Record<string, string | null> = {};

function openShotDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("tradedesk_screenshots", 1);
    req.onupgradeneeded = (e: any) =>
      e.target.result.createObjectStore("shots", { keyPath: "id" });
    req.onsuccess = (e: any) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadShot(tradeId: string): Promise<string | null> {
  if (shotCache[tradeId] !== undefined) return shotCache[tradeId];
  try {
    const db = await openShotDB();
    const tx = db.transaction("shots", "readonly");
    const req = tx.objectStore("shots").get(tradeId);
    return await new Promise((res) => {
      req.onsuccess = () => {
        const v = (req.result as any)?.dataUrl ?? null;
        shotCache[tradeId] = v;
        res(v);
      };
      req.onerror = () => {
        shotCache[tradeId] = null;
        res(null);
      };
    });
  } catch {
    shotCache[tradeId] = null;
    return null;
  }
}

// ───────────────────── constants & helpers ─────────────────────

const SESSION_KEY = "tradedesk_session_v1";
const tradesKey = (u: string) => `tradedesk_trades_${u}_v1`;
const reviewsKey = (u: string) => `nexyru_trade_reviews_${u}`;
const quickModeKey = (u: string) => `nexyru_replay_quickmode_${u}`;

const GRADE_LIST: Grade[] = ["A", "B", "C", "D", "F"];
const GRADE_COLOR: Record<Grade, string> = {
  A: "#22d3a5",
  B: "#a3e635",
  C: "#f59e0b",
  D: "#fb7185",
  F: "#f43f5e",
};

// Scoring constants
const PTS_SETUP_FULL = 10;
const PTS_SETUP_PARTIAL = 5;
const PTS_EXIT = 10;
const PTS_CONFIDENCE = 5;
const MAX_PER_TRADE = PTS_SETUP_FULL + PTS_EXIT + PTS_CONFIDENCE; // 25

function scoreReview(args: {
  pnl: number;
  matchedSetup: Triad | null;
  exitPickedCorrect: boolean;
  confidence: number; // 1..5
}): { total: number; setupPts: number; exitPts: number; confPts: number; setupCorrect: boolean } {
  const { pnl, matchedSetup, exitPickedCorrect, confidence } = args;
  const isWinner = pnl >= 0;

  let setupPts = 0;
  let setupCorrect = false;
  if (matchedSetup === "yes" && isWinner) { setupPts = PTS_SETUP_FULL; setupCorrect = true; }
  else if (matchedSetup === "no" && !isWinner) { setupPts = PTS_SETUP_FULL; setupCorrect = true; }
  else if (matchedSetup === "partial") { setupPts = PTS_SETUP_PARTIAL; }

  const exitPts = exitPickedCorrect ? PTS_EXIT : 0;

  let confPts = 0;
  if (confidence >= 4 && isWinner) confPts = PTS_CONFIDENCE;
  else if (confidence <= 2 && !isWinner) confPts = PTS_CONFIDENCE;

  return { total: setupPts + exitPts + confPts, setupPts, exitPts, confPts, setupCorrect };
}

function scoreToGrade(pct: number): Grade {
  if (pct >= 80) return "A";
  if (pct >= 65) return "B";
  if (pct >= 50) return "C";
  if (pct >= 35) return "D";
  return "F";
}

// Deterministic shuffle seeded by trade id so options stay stable per trade.
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function generateExitOptions(actualExit: number, entry: number, tradeId: string): {
  options: ExitOption[];
  correctIndex: number;
} {
  if (!isFinite(actualExit) || actualExit <= 0) {
    return { options: [], correctIndex: -1 };
  }
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const span = Math.max(Math.abs(actualExit - entry), actualExit * 0.005);
  const small = span * 0.4;
  const large = span * 1.4;

  const h = hashString(tradeId);
  const sign1 = (h & 1) ? 1 : -1;
  const sign2 = ((h >> 1) & 1) ? 1 : -1;

  const close = actualExit + sign1 * small;
  const worse = actualExit + sign2 * large;

  const triples: ExitOption[] = [
    { label: `$${fmt(close)}`, price: close, isCorrect: false },
    { label: `$${fmt(actualExit)}`, price: actualExit, isCorrect: true },
    { label: `$${fmt(worse)}`, price: worse, isCorrect: false },
  ];

  const order = [(h >> 2) % 3, ((h >> 5) % 2), 0];
  const out: ExitOption[] = [];
  const pool = [...triples];
  for (const _ of [0, 1, 2]) {
    const i = order.shift()! % pool.length;
    out.push(pool[i]);
    pool.splice(i, 1);
  }
  const correctIndex = out.findIndex((o) => o.isCorrect);
  return { options: out, correctIndex };
}

function fmtDate(v: number | string | undefined) {
  if (!v) return "—";
  const d = new Date(typeof v === "number" ? v : v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function fmtMoney(n: number | undefined) {
  if (n === undefined || n === null || isNaN(Number(n))) return "$0.00";
  const v = Number(n);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPrice(n: number | string | undefined) {
  if (n === undefined || n === null || n === "") return "—";
  const v = Number(n);
  if (isNaN(v)) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

type Interval = "1m" | "5m" | "15m" | "1h";

const CRYPTO_BASES = new Set<string>([
 "BTC", "ETH", "SOL", "DOGE", "ADA", "XRP", "AVAX", "MATIC", "DOT", "LINK",
 "UNI", "ATOM", "LTC", "BCH", "NEAR", "SHIB", "TRX", "XLM", "FIL", "ALGO",
 "APT", "ARB", "OP", "INJ", "TIA", "SUI", "PEPE", "WIF", "BONK", "HYPE",
]);

const KRAKEN_SYMBOL_MAP: Record<string, string> = {
  "SOL/USD": "SOLUSD", "BTC/USD": "XBTUSD", "ETH/USD": "ETHUSD", "DOGE/USD": "DOGEUSD", "XRP/USD": "XRPUSD",
  "SOL-USD": "SOLUSD", "BTC-USD": "XBTUSD", "ETH-USD": "ETHUSD", "DOGE-USD": "DOGEUSD", "XRP-USD": "XRPUSD",
};

function formatKrakenPair(raw: string): string {
  const pair = (raw || "").toUpperCase().trim();
  if (KRAKEN_SYMBOL_MAP[pair]) return KRAKEN_SYMBOL_MAP[pair];
  const flat = pair.replace(/[\/\-]/g, "");
  return flat.replace(/^BTC/, "XBT");
}

const KRAKEN_INTERVAL: Record<Interval, string> = {
  "1m": "1", "5m": "5", "15m": "15", "1h": "60",
};

const CANDLES_BEFORE = 60;
const PHASE1_BEFORE = 20; // candles shown before entry in Phase 1
const REVEAL_AFTER = 20;  // candles shown after entry in Phase 2

type Instrument =
  | { kind: "crypto"; krakenPair: string }
  | { kind: "yahoo"; yahooSymbol: string }
  | { kind: "unknown" };

const YAHOO_MAP: Record<string, string> = {
  "ES1!": "ES=F", "NQ1!": "NQ=F", "CL1!": "CL=F", "YM1!": "YM=F", "RTY1!": "RTY=F",
  "GC1!": "GC=F", "SI1!": "SI=F", "NG1!": "NG=F",
};

function classifySymbol(raw: string): Instrument {
  const symbol = (raw || "").toUpperCase().trim();
  if (!symbol) return { kind: "unknown" };
  if (YAHOO_MAP[symbol]) return { kind: "yahoo", yahooSymbol: YAHOO_MAP[symbol] };
  const base = symbol.split("/")[0].split("-")[0];
  if (CRYPTO_BASES.has(base)) {
    return { kind: "crypto", krakenPair: formatKrakenPair(symbol) };
  }
  const yahooFallback = symbol.replace(/\/USD$/i, "").replace(/\//g, "-");
  if (!yahooFallback) return { kind: "unknown" };
  return { kind: "yahoo", yahooSymbol: yahooFallback };
}

async function fetchCandlesFromApi(
  krakenPair: string,
  interval: Interval,
  tradeTime: number,
): Promise<ChartRow[]> {
  const intervalMinutes = Number(KRAKEN_INTERVAL[interval]);
  const since = Math.floor(tradeTime / 1000) - CANDLES_BEFORE * intervalMinutes * 60;
  const url =
    `/api/candles?pair=${encodeURIComponent(krakenPair)}` +
    `&interval=${encodeURIComponent(KRAKEN_INTERVAL[interval])}` +
    `&since=${since}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Candles API ${res.status}`);
  const body = (await res.json()) as {
    candles?: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>;
    error?: string;
  };
  if (body.error && (!body.candles || body.candles.length === 0)) {
    throw new Error(body.error);
  }
  const rows = (body.candles || [])
    .map((c): ChartRow => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: typeof c.volume === "number" ? c.volume : undefined,
    }))
    .filter(
      (c) =>
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close),
    )
    .sort((a, b) => (a.time as number) - (b.time as number));
  return rows;
}

function useTradeChart(trade: Trade | undefined, interval: Interval) {
  const [candles, setCandles] = useState<ChartRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!trade) {
      setCandles(null);
      setError(null);
      setLoading(false);
      return;
    }
    const symbol = (trade.symbol || trade.pair || "").toString();
    const info = classifySymbol(symbol);
    const tradeTime =
      typeof trade.date === "number" ? trade.date : new Date(trade.date || 0).getTime();

    let cancelled = false;
    setLoading(true);
    setError(null);
    setCandles(null);

    (async () => {
      try {
        if (!Number.isFinite(tradeTime) || tradeTime <= 0) {
          throw new Error("Missing trade timestamp");
        }
        let data: ChartRow[];
        if (info.kind === "crypto") {
          data = await fetchCandlesFromApi(info.krakenPair, interval, tradeTime);
        } else {
          throw new Error("Unsupported symbol — crypto only");
        }
        if (cancelled) return;
        if (!data.length) throw new Error("No candle data");
        setCandles(data);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Failed to load candles");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [trade?.id, interval]);

  return { candles, loading, error };
}

function fmtTradeDateTime(v: number | string | undefined): string {
  if (!v) return "—";
  const d = new Date(typeof v === "number" ? v : v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    timeZoneName: "short",
  });
}

// ───────────────────── page ─────────────────────

export default function ReplayPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0f" }}>
      <Sidebar activePath="/replay" />
      <main style={{ flex: 1, marginLeft: 56 }}>
        <ReplayPageInner />
      </main>
    </div>
  );
}

function ReplayPageInner() {
  const [username, setUsername] = useState<string | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [shot, setShot] = useState<string | null>(null);
  const [shotLoading, setShotLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [interval, setInterval] = useState<Interval>("5m");
  const [zoomOpen, setZoomOpen] = useState(false);
  const [quickMode, setQuickMode] = useState(false);

  // Phase + answers
  const [phase, setPhase] = useState<Phase>("entry");
  const [questionStep, setQuestionStep] = useState(0);
  const [answerSetup, setAnswerSetup] = useState<Triad | null>(null);
  const [answerExitIdx, setAnswerExitIdx] = useState<number | null>(null);
  const [answerConfidence, setAnswerConfidence] = useState<number | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [differently, setDifferently] = useState("");

  // Streak
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  // ── Initial load ──
  useEffect(() => {
    try {
      const sess = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
      const u = sess?.username || null;
      setUsername(u);
      if (!u) { setLoading(false); return; }

      const raw = localStorage.getItem(tradesKey(u));
      const all: Trade[] = raw ? JSON.parse(raw) || [] : [];
      const sorted = [...all].sort((a, b) => {
        const av = typeof a.date === "number" ? a.date : new Date(a.date || 0).getTime();
        const bv = typeof b.date === "number" ? b.date : new Date(b.date || 0).getTime();
        return bv - av;
      });
      setTrades(sorted);

      const savedReviews = JSON.parse(localStorage.getItem(reviewsKey(u)) || "{}") || {};
      setReviews(savedReviews);

      const savedQuick = localStorage.getItem(quickModeKey(u));
      if (savedQuick === "1") setQuickMode(true);

      let startIdx = -1;
      try {
        const params = new URLSearchParams(window.location.search);
        const tradeId = params.get("tradeId");
        if (tradeId) {
          const found = sorted.findIndex((t) => String(t.id) === String(tradeId));
          if (found >= 0) startIdx = found;
        }
      } catch {}

      if (startIdx < 0) startIdx = sorted.findIndex((t) => !savedReviews[t.id]);
      setIdx(startIdx >= 0 ? startIdx : sorted.length);
      if (startIdx === -1 && sorted.length > 0) setDone(true);
    } catch (e) {
      console.warn("replay load failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const current = trades[idx];
  const { candles, loading: chartLoading, error: chartError } = useTradeChart(current, interval);
  const [hoverCandle, setHoverCandle] = useState<ChartRow | null>(null);
  useEffect(() => { setHoverCandle(null); }, [current?.id, interval]);

  // reset per-trade state
  useEffect(() => {
    if (!current) return;
    setPhase("entry");
    setQuestionStep(0);
    setAnswerSetup(null);
    setAnswerExitIdx(null);
    setAnswerConfidence(null);
    setGrade(null);
    setDifferently("");
    setZoomOpen(false);
  }, [current?.id]);

  // load screenshot for current trade
  useEffect(() => {
    setShot(null);
    if (!current) return;
    const direct = current.screenshot || current.screenshotUrl;
    if (direct) { setShot(direct); return; }
    if (!current._hasScreenshot) return;
    setShotLoading(true);
    loadShot(current.id).then((d) => {
      setShot(d);
      setShotLoading(false);
    });
  }, [current?.id]);

  const total = trades.length;

  // Persist quick mode
  useEffect(() => {
    if (!username) return;
    try { localStorage.setItem(quickModeKey(username), quickMode ? "1" : "0"); } catch {}
  }, [quickMode, username]);

  const sessionScore = useMemo(() => {
    return Object.values(reviews).reduce((s, r) => s + (r?.score || 0), 0);
  }, [reviews]);

  const sessionMaxScore = useMemo(() => {
    return Object.keys(reviews).length * MAX_PER_TRADE;
  }, [reviews]);

  const sessionGrade = useMemo<Grade | null>(() => {
    if (sessionMaxScore === 0) return null;
    return scoreToGrade((sessionScore / sessionMaxScore) * 100);
  }, [sessionScore, sessionMaxScore]);

  // Derive current trade primitives
  const t = current;
  const pnl = t ? Number(t.pnl ?? 0) : 0;
  const isWin = pnl > 0;
  const isLoss = pnl < 0;
  const pnlColor = isWin ? "#22d3a5" : isLoss ? "#f43f5e" : "#9ca3af";
  const sideUpper = (t?.type || "").toString().toUpperCase();
  const isLong = sideUpper === "LONG";
  const sym = (t?.pair || t?.symbol || "").toString();
  const entry = t ? Number(t.entryPrice ?? 0) : 0;
  const exit = t ? Number(t.exitPrice ?? 0) : 0;

  // Exit options memoized per-trade
  const exitOptions = useMemo(() => {
    if (!t) return { options: [] as ExitOption[], correctIndex: -1 };
    return generateExitOptions(exit, entry, t.id);
  }, [t?.id, exit, entry]);

  // Phase-based candle slicing
  const phasedCandles = useMemo(() => {
    if (!candles || !candles.length || !t) return candles;
    const tradeMs = typeof t.date === "number" ? t.date : new Date(t.date || 0).getTime();
    const tradeSec = Math.floor(tradeMs / 1000);
    let entryIdx = 0;
    let best = Infinity;
    for (let i = 0; i < candles.length; i++) {
      const d = Math.abs((candles[i].time as number) - tradeSec);
      if (d < best) { best = d; entryIdx = i; }
    }
    if (phase === "entry") {
      const start = Math.max(0, entryIdx - PHASE1_BEFORE);
      return candles.slice(start, entryIdx + 1);
    }
    // reveal & grade — show 20 after exit-ish (we don't know exit time, approximate as entry + REVEAL_AFTER)
    const start = Math.max(0, entryIdx - PHASE1_BEFORE);
    const end = Math.min(candles.length, entryIdx + REVEAL_AFTER + 1);
    return candles.slice(start, end);
  }, [candles, phase, t?.id, t?.date]);

  const saveCurrent = useCallback(
    (r: Review) => {
      if (!username) return;
      const next = { ...reviews, [r.tradeId]: r };
      setReviews(next);
      try { localStorage.setItem(reviewsKey(username), JSON.stringify(next)); } catch {}
    },
    [reviews, username]
  );

  // Move from entry → reveal (also commits whatever answers exist).
  const handleReveal = () => {
    setPhase("reveal");
  };

  const handleSelectSetup = (v: Triad) => {
    setAnswerSetup(v);
    if (!quickMode) setQuestionStep(1);
  };
  const handleSelectExit = (i: number) => {
    setAnswerExitIdx(i);
    if (!quickMode) setQuestionStep(2);
  };
  const handleSelectConfidence = (n: number) => {
    setAnswerConfidence(n);
  };

  const proceedToReveal = () => {
    setPhase("reveal");
  };

  const proceedToGrade = () => {
    setPhase("grade");
  };

  const handleSaveAndNext = (skipNotes: boolean) => {
    if (!current) return;
    const exitPickedCorrect =
      exitOptions.correctIndex >= 0 && answerExitIdx === exitOptions.correctIndex;
    const conf = answerConfidence ?? 3;
    const { total: scoreTotal, setupCorrect } = scoreReview({
      pnl,
      matchedSetup: answerSetup,
      exitPickedCorrect,
      confidence: conf,
    });

    const r: Review = {
      tradeId: current.id,
      matchedSetup: answerSetup,
      exitPickedIdx: answerExitIdx,
      exitPickedCorrect,
      confidence: conf,
      grade,
      differently: skipNotes ? "" : differently.trim(),
      score: scoreTotal,
      setupCorrect,
      reviewedAt: Date.now(),
    };
    saveCurrent(r);

    // Streak
    if (setupCorrect) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
    } else {
      setStreak(0);
    }

    if (idx + 1 >= total) setDone(true);
    else setIdx(idx + 1);
  };

  const handleSkipTrade = () => {
    if (idx + 1 >= total) setDone(true);
    else setIdx(idx + 1);
  };

  const handleRestart = () => {
    if (!username) return;
    setReviews({});
    try { localStorage.removeItem(reviewsKey(username)); } catch {}
    setDone(false);
    setIdx(0);
    setStreak(0);
    setBestStreak(0);
  };

  // ───────────────────── render ─────────────────────

  if (loading) {
    return (
      <div style={shellStyle}>
        <div style={{ color: "#2a2a3a", fontSize: 13 }}>Loading replay…</div>
      </div>
    );
  }

  if (!username) {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#ffffff", marginBottom: 8 }}>Sign in required</div>
          <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 18 }}>Trade Replay loads your local trade history.</div>
          <a href="/login" style={primaryBtnStyle}>Go to login</a>
        </div>
      </div>
    );
  }

  if (!trades.length) {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#ffffff", marginBottom: 8 }}>No trades to replay</div>
          <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 18 }}>Log some trades in the dashboard, then come back to review them.</div>
          <a href="/dashboard" style={primaryBtnStyle}>Open Dashboard</a>
        </div>
      </div>
    );
  }

  if (done || idx >= total) {
    return (
      <EndSessionScreen
        reviews={reviews}
        trades={trades}
        sessionScore={sessionScore}
        sessionMaxScore={sessionMaxScore}
        sessionGrade={sessionGrade}
        bestStreak={bestStreak}
        onRestart={handleRestart}
      />
    );
  }

  if (!t) return null;

  const setupAlignsWithOutcome =
    (answerSetup === "yes" && pnl >= 0) ||
    (answerSetup === "no" && pnl < 0);

  return (
    <div className="replay-shell" style={shellStyle}>
      <style>{replayCSS}</style>
      <div style={{ width: "100%", maxWidth: 760 }}>
        <TopBar
          idx={idx}
          total={total}
          sessionScore={sessionScore}
          streak={streak}
          quickMode={quickMode}
          onQuickToggle={() => setQuickMode((q) => !q)}
        />

        {/* Chart header (symbol, side, interval, date) */}
        <div className="replay-chart-header" style={{
          ...cardStyle,
          marginTop: 14,
          padding: "11px 14px",
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          gap: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 15, fontWeight: 900, color: "#ffffff",
              letterSpacing: "-0.01em", fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}>{sym || "—"}</span>
            <span style={{
              padding: "3px 8px", borderRadius: 6,
              background: isLong ? "rgba(34,211,165,0.18)" : "rgba(244,63,94,0.18)",
              color: isLong ? "#22d3a5" : "#f43f5e",
              border: `1px solid ${isLong ? "#22d3a566" : "#f43f5e66"}`,
              fontSize: 9, fontWeight: 800, letterSpacing: "0.1em",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}>
              {isLong ? "▲" : "▼"} {sideUpper || "—"}
            </span>
            <div style={{ width: 1, height: 18, background: "#2a2a3a", margin: "0 2px" }} />
            <div style={{ display: "flex", gap: 3 }}>
              {(["1m", "5m", "15m", "1h"] as Interval[]).map((iv) => (
                <IntervalBtn
                  key={iv}
                  label={iv}
                  active={interval === iv}
                  onClick={() => setInterval(iv)}
                />
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minWidth: 0 }}>
            {phasedCandles && phasedCandles.length > 0 ? (
              <OhlcRow candle={hoverCandle ?? phasedCandles[phasedCandles.length - 1]} />
            ) : (
              <div style={{
                fontSize: 10, fontWeight: 700, color: "#4a5a7a",
                letterSpacing: "0.12em", textTransform: "uppercase",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>Chart captured at time of trade</div>
            )}
          </div>

          <span className="replay-chart-header-right" style={{
            fontSize: 11, color: "#9ca3af",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            whiteSpace: "nowrap", textAlign: "right",
          }}>{fmtTradeDateTime(t.date)}</span>
        </div>

        {/* Chart card */}
        <div
          key={`${t.id}-${phase}`}
          style={{
            ...cardStyle,
            marginTop: 10,
            padding: 0,
            overflow: "hidden",
            position: "relative",
            border: `1px solid ${
              phase === "entry" ? "#1e2f4a" :
              isWin ? "rgba(34,211,165,0.45)" :
              isLoss ? "rgba(244,63,94,0.45)" : "#1e2f4a"
            }`,
            boxShadow: phase === "entry"
              ? "0 12px 40px rgba(0,0,0,0.4)"
              : isWin
                ? "0 0 0 1px rgba(34,211,165,0.18), 0 0 60px rgba(34,211,165,0.18), 0 12px 40px rgba(0,0,0,0.5)"
                : isLoss
                  ? "0 0 0 1px rgba(244,63,94,0.18), 0 0 60px rgba(244,63,94,0.18), 0 12px 40px rgba(0,0,0,0.5)"
                  : "0 12px 40px rgba(0,0,0,0.4)",
            animation: phase === "reveal"
              ? (isWin ? "nxFlashWin 0.9s ease-out" : isLoss ? "nxFlashLoss 0.9s ease-out" : "none")
              : "none",
            transition: "border-color 0.4s, box-shadow 0.4s",
          }}
        >
          <ChartArea
            trade={t}
            shot={shot}
            shotLoading={shotLoading}
            candles={phasedCandles}
            chartLoading={chartLoading}
            chartError={chartError}
            onHover={setHoverCandle}
            entry={entry}
            exit={exit}
            pnl={pnl}
            isWin={isWin}
            isLoss={isLoss}
            phase={phase}
            onZoom={() => setZoomOpen(true)}
          />
        </div>

        {/* Stats row — entry visible, exit/pnl gated */}
        <div style={{
          ...cardStyle,
          marginTop: 10,
          padding: "14px 16px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          gap: 14,
        }}>
          <StatCell label="Entry" value={fmtPrice(entry)} color="#22d3a5" />
          <StatCell
            label="Exit"
            value={phase === "entry" ? "???" : fmtPrice(exit)}
            color={phase === "entry" ? "#4a5a7a" : "#f43f5e"}
          />
          <StatCell
            label="PnL"
            value={
              phase === "entry"
                ? "???"
                : phase === "reveal"
                  ? <CountUp to={pnl} duration={900} format={(n) => `${n >= 0 ? "+" : ""}${fmtMoney(n)}`} />
                  : `${pnl > 0 ? "+" : ""}${fmtMoney(pnl)}`
            }
            color={phase === "entry" ? "#4a5a7a" : pnlColor}
          />
          <StatCell
            label="Side"
            value={`${isLong ? "▲" : "▼"} ${sideUpper || "—"}`}
            color={isLong ? "#22d3a5" : "#f43f5e"}
          />
        </div>

        {/* Phase: ENTRY — question cards */}
        {phase === "entry" && (
          <div style={{ marginTop: 14 }}>
            {quickMode ? (
              <div style={{ ...cardStyle, padding: "28px 22px", textAlign: "center" }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "#6366f1",
                  letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 8,
                }}>Quick Mode</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#ffffff", marginBottom: 18 }}>
                  Make your call, then reveal.
                </div>
                <button onClick={proceedToReveal} style={{ ...primaryBtnStyle, padding: "18px 28px", fontSize: 16 }}>
                  REVEAL TRADE →
                </button>
                <div style={{ marginTop: 14, fontSize: 11, color: "#4a5a7a" }}>
                  Quick mode skips the questions. Toggle it off in the top bar for full review.
                </div>
              </div>
            ) : (
              <>
                {questionStep === 0 && (
                  <QuestionCard step={1} total={3} question="Was this your setup?">
                    <div className="replay-big-triad" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                      <BigChoice label="YES" sub="It matched" color="#22d3a5" onClick={() => handleSelectSetup("yes")} />
                      <BigChoice label="PARTIAL" sub="Sort of" color="#f59e0b" onClick={() => handleSelectSetup("partial")} />
                      <BigChoice label="NO" sub="Not really" color="#f43f5e" onClick={() => handleSelectSetup("no")} />
                    </div>
                  </QuestionCard>
                )}

                {questionStep === 1 && (
                  <QuestionCard
                    step={2}
                    total={3}
                    question="Where would you have exited?"
                    onBack={() => setQuestionStep(0)}
                  >
                    {exitOptions.options.length > 0 ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                        {exitOptions.options.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => handleSelectExit(i)}
                            style={{
                              padding: "20px 22px",
                              borderRadius: 14,
                              border: "1px solid #1e2540",
                              background: "linear-gradient(180deg, #1a1a26, #15151f)",
                              color: "#ffffff",
                              fontSize: 18,
                              fontWeight: 900,
                              fontFamily: "ui-monospace, SFMono-Regular, monospace",
                              cursor: "pointer",
                              textAlign: "left",
                              transition: "all 0.15s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = "#6366f1";
                              e.currentTarget.style.background = "linear-gradient(180deg, #1f1f30, #1a1a26)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = "#1e2540";
                              e.currentTarget.style.background = "linear-gradient(180deg, #1a1a26, #15151f)";
                            }}
                          >
                            <span style={{ color: "#6366f1", marginRight: 10 }}>{String.fromCharCode(65 + i)}.</span>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: "#4a5a7a", fontSize: 13, padding: "16px 0" }}>
                        No exit price recorded — skipping this question.
                        <div style={{ marginTop: 12 }}>
                          <button onClick={() => { setAnswerExitIdx(null); setQuestionStep(2); }} style={secondaryBtnStyle}>
                            Continue →
                          </button>
                        </div>
                      </div>
                    )}
                  </QuestionCard>
                )}

                {questionStep === 2 && (
                  <QuestionCard
                    step={3}
                    total={3}
                    question="How confident were you in this entry?"
                    onBack={() => setQuestionStep(1)}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                      {[1, 2, 3, 4, 5].map((n) => {
                        const active = answerConfidence === n;
                        const colors = ["#f43f5e", "#fb7185", "#f59e0b", "#a3e635", "#22d3a5"];
                        const c = colors[n - 1];
                        return (
                          <button
                            key={n}
                            onClick={() => handleSelectConfidence(n)}
                            style={{
                              padding: "26px 0",
                              borderRadius: 14,
                              border: `1px solid ${active ? c : "#1e2540"}`,
                              background: active ? `${c}22` : "transparent",
                              color: active ? c : "#9ca3af",
                              fontSize: 26,
                              fontWeight: 900,
                              cursor: "pointer",
                              transition: "all 0.15s",
                              fontFamily: "ui-monospace, SFMono-Regular, monospace",
                              boxShadow: active ? `0 0 0 3px ${c}33` : "none",
                            }}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      fontSize: 10, color: "#4a5a7a", marginTop: 6,
                      fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                    }}>
                      <span>Low</span><span>High</span>
                    </div>
                    <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
                      <button
                        onClick={() => setQuestionStep(1)}
                        style={{ ...secondaryBtnStyle, flex: "0 0 auto" }}
                      >← Back</button>
                      <button
                        onClick={proceedToReveal}
                        disabled={answerConfidence === null}
                        style={{
                          ...primaryBtnStyle, flex: 1,
                          opacity: answerConfidence === null ? 0.45 : 1,
                          cursor: answerConfidence === null ? "not-allowed" : "pointer",
                          padding: "16px 22px", fontSize: 14,
                        }}
                      >
                        REVEAL TRADE →
                      </button>
                    </div>
                  </QuestionCard>
                )}
              </>
            )}
          </div>
        )}

        {/* Phase: REVEAL — result summary */}
        {phase === "reveal" && (
          <RevealCard
            answerSetup={answerSetup}
            answerExitIdx={answerExitIdx}
            answerConfidence={answerConfidence}
            exitOptions={exitOptions}
            actualExit={exit}
            pnl={pnl}
            isWin={isWin}
            setupAligns={setupAlignsWithOutcome}
            strategy={t.strategy}
            notes={t.notes}
            onContinue={proceedToGrade}
            quickMode={quickMode}
          />
        )}

        {/* Phase: GRADE */}
        {phase === "grade" && (
          <div style={{ ...cardStyle, marginTop: 14, padding: "22px" }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: "#6366f1",
              letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 14,
            }}>
              Grade This Trade
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#ffffff", marginBottom: 18 }}>
              How well did you execute?
            </div>
            <div className="replay-grade-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {GRADE_LIST.map((g) => {
                const active = grade === g;
                const c = GRADE_COLOR[g];
                return (
                  <button
                    key={g}
                    onClick={() => setGrade(g)}
                    style={{
                      padding: "22px 0",
                      borderRadius: 14,
                      border: `1px solid ${active ? c : "#1e2540"}`,
                      background: active ? c : "transparent",
                      color: active ? "#000" : c,
                      fontSize: 26,
                      fontWeight: 900,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      boxShadow: active ? `0 0 0 3px ${c}33` : "none",
                      fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    }}
                  >
                    {g}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 22 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: "#9ca3af",
                marginBottom: 8, letterSpacing: "0.04em",
              }}>What would you do differently?</div>
              <textarea
                value={differently}
                onChange={(e) => setDifferently(e.target.value)}
                placeholder="One honest takeaway. Optional."
                rows={3}
                style={{
                  width: "100%", background: "#111118",
                  border: "1px solid #2a2a3a", borderRadius: 10,
                  color: "#ffffff", fontSize: 13, padding: "10px 12px",
                  fontFamily: "inherit", resize: "vertical", outline: "none",
                  lineHeight: 1.5,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a3a")}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              <button
                onClick={handleSkipTrade}
                style={{ ...secondaryBtnStyle, flex: "0 0 auto" }}
              >Skip Trade</button>
              <button
                onClick={() => handleSaveAndNext(true)}
                disabled={!grade}
                style={{
                  ...secondaryBtnStyle, flex: "0 0 auto",
                  opacity: !grade ? 0.45 : 1,
                  cursor: !grade ? "not-allowed" : "pointer",
                }}
              >Skip notes →</button>
              <button
                onClick={() => handleSaveAndNext(false)}
                disabled={!grade}
                style={{
                  ...primaryBtnStyle, flex: 1,
                  opacity: !grade ? 0.45 : 1,
                  cursor: !grade ? "not-allowed" : "pointer",
                }}
              >
                {idx + 1 >= total ? "Save & Finish →" : "Save & Next →"}
              </button>
            </div>

            {!grade && (
              <div style={{ marginTop: 10, fontSize: 11, color: "#4a5a7a" }}>
                Pick a grade to continue.
              </div>
            )}
          </div>
        )}
      </div>

      {zoomOpen && shot && (
        <ZoomModal src={shot} onClose={() => setZoomOpen(false)} />
      )}
    </div>
  );
}

// ───────────────────── TopBar ─────────────────────

function TopBar({
  idx, total, sessionScore, streak, quickMode, onQuickToggle,
}: {
  idx: number;
  total: number;
  sessionScore: number;
  streak: number;
  quickMode: boolean;
  onQuickToggle: () => void;
}) {
  const pct = total ? Math.round((idx / total) * 100) : 0;
  return (
    <div>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: 12, flexWrap: "wrap", marginBottom: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/dashboard" style={{ fontSize: 11, color: "#4a5a7a", textDecoration: "none", fontWeight: 600 }}>← Dashboard</a>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#ffffff", letterSpacing: "0.04em" }}>Trade Replay</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
          <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700 }}>
            Trade {idx + 1} of {total}
          </span>
          <span style={{ color: "#1e2540" }}>·</span>
          <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700 }}>
            Session Score: <span style={{ color: "#22d3a5", fontWeight: 900 }}>{sessionScore} pts</span>
          </span>
          {streak >= 2 && (
            <>
              <span style={{ color: "#1e2540" }}>·</span>
              <span style={{
                fontSize: 11, fontWeight: 900, color: "#f59e0b",
                padding: "3px 8px",
                background: "rgba(245,158,11,0.12)",
                border: "1px solid rgba(245,158,11,0.35)",
                borderRadius: 999,
              }}>
                🔥 {streak} streak
              </span>
            </>
          )}
          <button
            onClick={onQuickToggle}
            style={{
              fontSize: 10, fontWeight: 800,
              padding: "5px 10px",
              borderRadius: 999,
              border: `1px solid ${quickMode ? "#6366f1" : "#1e2540"}`,
              background: quickMode ? "rgba(99,102,241,0.18)" : "transparent",
              color: quickMode ? "#a5b4fc" : "#9ca3af",
              cursor: "pointer",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: "inherit",
            }}
            title="Skip the 3 questions — go straight to reveal + grade"
          >
            {quickMode ? "⚡ Quick Mode ON" : "Quick Mode"}
          </button>
        </div>
      </div>
      <div style={{
        height: 6, background: "#111118",
        border: "1px solid #2a2a3a", borderRadius: 999, overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: "linear-gradient(90deg,#22d3a5,#6366f1)",
          transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

// ───────────────────── QuestionCard ─────────────────────

function QuestionCard({
  step, total, question, onBack, children,
}: {
  step: number;
  total: number;
  question: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="nx-q-card" style={{ ...cardStyle, padding: "26px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: "#6366f1",
          letterSpacing: "0.16em", textTransform: "uppercase",
        }}>
          Question {step} of {total}
        </div>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: "transparent", border: "none",
              color: "#4a5a7a", fontSize: 11, fontWeight: 700,
              cursor: "pointer", padding: 4,
            }}
          >← Back</button>
        )}
      </div>
      <div style={{
        fontSize: 22, fontWeight: 900, color: "#ffffff",
        marginBottom: 22, letterSpacing: "-0.01em",
      }}>{question}</div>
      {children}
    </div>
  );
}

function BigChoice({
  label, sub, color, onClick,
}: { label: string; sub?: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "22px 12px",
        borderRadius: 16,
        border: `1px solid ${color}55`,
        background: `linear-gradient(180deg, ${color}11, transparent)`,
        color: color,
        fontSize: 18,
        fontWeight: 900,
        cursor: "pointer",
        transition: "all 0.15s",
        letterSpacing: "0.06em",
        textAlign: "center",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `linear-gradient(180deg, ${color}26, ${color}0a)`;
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = `0 0 0 3px ${color}22`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `linear-gradient(180deg, ${color}11, transparent)`;
        e.currentTarget.style.borderColor = `${color}55`;
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div>{label}</div>
      {sub && (
        <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", marginTop: 4, letterSpacing: "0.04em" }}>{sub}</div>
      )}
    </button>
  );
}

// ───────────────────── RevealCard ─────────────────────

function RevealCard({
  answerSetup, answerExitIdx, answerConfidence,
  exitOptions, actualExit, pnl, isWin,
  setupAligns, strategy, notes, onContinue, quickMode,
}: {
  answerSetup: Triad | null;
  answerExitIdx: number | null;
  answerConfidence: number | null;
  exitOptions: { options: ExitOption[]; correctIndex: number };
  actualExit: number;
  pnl: number;
  isWin: boolean;
  setupAligns: boolean;
  strategy?: string;
  notes?: string;
  onContinue: () => void;
  quickMode: boolean;
}) {
  const setupLabel =
    answerSetup === "yes" ? "YES — it was your setup" :
    answerSetup === "partial" ? "PARTIAL — sort of" :
    answerSetup === "no" ? "NO — not your setup" : "—";

  const exitChosen = answerExitIdx !== null && exitOptions.options[answerExitIdx]
    ? exitOptions.options[answerExitIdx]
    : null;
  const exitCorrect = exitChosen?.isCorrect === true;
  const accentColor = isWin ? "#22d3a5" : pnl < 0 ? "#f43f5e" : "#9ca3af";

  return (
    <div style={{ ...cardStyle, marginTop: 14, padding: "26px 22px" }} className="nx-reveal-card">
      <div style={{
        fontSize: 11, fontWeight: 700, color: accentColor,
        letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 10,
      }}>The Reveal</div>

      <div style={{
        fontSize: 32, fontWeight: 900, color: accentColor,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        letterSpacing: "-0.01em", marginBottom: 18,
      }}>
        Actual exit: <CountUp to={pnl} duration={1000} format={(n) => `${n >= 0 ? "+" : ""}${fmtMoney(n)}`} />
      </div>

      {!quickMode && answerSetup && (
        <ReviewLine
          label="You said"
          value={setupLabel}
          ok={setupAligns}
        />
      )}

      {!quickMode && exitChosen && (
        <ReviewLine
          label="Your exit pick"
          value={`${exitChosen.label} — actual was $${actualExit.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          ok={exitCorrect}
        />
      )}

      {!quickMode && answerConfidence !== null && (
        <ReviewLine
          label="Your confidence"
          value={`${answerConfidence}/5${
            (answerConfidence >= 4 && isWin) || (answerConfidence <= 2 && pnl < 0)
              ? " — well calibrated"
              : ""
          }`}
          ok={(answerConfidence >= 4 && isWin) || (answerConfidence <= 2 && pnl < 0)}
        />
      )}

      {(strategy || notes) && (
        <div style={{
          marginTop: 18,
          background: "#0f1424",
          border: "1px solid #1e2f4a",
          borderRadius: 12,
          padding: "14px 16px",
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: "#6366f1",
            letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 8,
          }}>Insight</div>
          {strategy && (
            <div style={{ fontSize: 13, color: "#ffffff", fontWeight: 700, marginBottom: notes ? 6 : 0 }}>
              {strategy}
            </div>
          )}
          {notes && (
            <div style={{ fontSize: 12, color: "#a5b4fc", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
              {notes}
            </div>
          )}
        </div>
      )}

      <button
        onClick={onContinue}
        style={{ ...primaryBtnStyle, marginTop: 22, width: "100%", padding: "16px 22px", fontSize: 14 }}
      >Grade this trade →</button>
    </div>
  );
}

function ReviewLine({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 10,
      padding: "10px 0", borderBottom: "1px solid #1e2540",
      flexWrap: "wrap",
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "#4a5a7a",
        letterSpacing: "0.12em", textTransform: "uppercase",
        minWidth: 120,
      }}>{label}</div>
      <div style={{
        fontSize: 14, fontWeight: 700,
        color: ok ? "#22d3a5" : "#f43f5e",
        flex: 1,
      }}>
        <span style={{ marginRight: 6 }}>{ok ? "✓" : "✗"}</span>
        {value}
      </div>
    </div>
  );
}

// ───────────────────── CountUp ─────────────────────

function CountUp({ to, duration, format }: { to: number; duration: number; format: (n: number) => string }) {
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const from = fromRef.current;
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <>{format(val)}</>;
}

// ───────────────────── EndSessionScreen ─────────────────────

function EndSessionScreen({
  reviews, trades, sessionScore, sessionMaxScore, sessionGrade, bestStreak, onRestart,
}: {
  reviews: Record<string, Review>;
  trades: Trade[];
  sessionScore: number;
  sessionMaxScore: number;
  sessionGrade: Grade | null;
  bestStreak: number;
  onRestart: () => void;
}) {
  const reviewedList = Object.values(reviews).filter((r) => r);

  const setupCorrectCount = reviewedList.filter((r) => r.setupCorrect).length;
  const exitCorrectCount = reviewedList.filter((r) => r.exitPickedCorrect).length;
  const reviewedTotal = reviewedList.length;
  const pct = sessionMaxScore > 0 ? (sessionScore / sessionMaxScore) * 100 : 0;

  // Best trade
  const reviewedTrades = trades.filter((t) => reviews[t.id]);
  let best: Trade | null = null;
  let bestPnl = -Infinity;
  for (const t of reviewedTrades) {
    const p = Number(t.pnl ?? 0);
    if (p > bestPnl) { bestPnl = p; best = t; }
  }
  const bestReview = best ? reviews[best.id] : null;

  const insight = (() => {
    if (!reviewedTotal) return "Review at least one trade to surface patterns.";
    const setupAcc = setupCorrectCount / reviewedTotal;
    const exitAcc = exitCorrectCount / reviewedTotal;
    if (setupAcc > exitAcc + 0.15) return "You're better at identifying your setup than exiting at the right price.";
    if (exitAcc > setupAcc + 0.15) return "You read exits well — sharpen your setup recognition next.";
    if (setupAcc >= 0.7 && exitAcc >= 0.7) return "Strong session — both setup ID and exit reads are dialed in.";
    if (setupAcc <= 0.3 && exitAcc <= 0.3) return "Patterns are still forming — keep journaling and review more trades.";
    return "Balanced — you read setups and exits about equally well.";
  })();

  const handleShare = async () => {
    const grade = sessionGrade ?? "—";
    const text = `Nexyru Replay — ${sessionScore} pts (Grade ${grade}) · Setup ${setupCorrectCount}/${reviewedTotal} · Exit ${exitCorrectCount}/${reviewedTotal}`;
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title: "Nexyru Replay", text });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        alert("Copied to clipboard");
      }
    } catch {}
  };

  return (
    <div style={shellStyle}>
      <style>{replayCSS}</style>
      {sessionScore > 80 && <ConfettiBurst />}
      <div style={{ width: "100%", maxWidth: 760 }}>
        <div style={{ ...cardStyle, padding: "36px 28px" }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: "#22d3a5",
            letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12,
          }}>Session Complete</div>

          <div style={{
            fontSize: 38, fontWeight: 900, color: "#ffffff",
            letterSpacing: "-0.02em", marginBottom: 6, fontFamily: "ui-monospace, SFMono-Regular, monospace",
          }}>
            {sessionScore} <span style={{ color: "#4a5a7a", fontSize: 22 }}>/ {sessionMaxScore} pts</span>
          </div>
          <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 22 }}>{Math.round(pct)}% of max</div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 14, marginBottom: 22,
          }}>
            <SummaryStat
              label="Session Grade"
              value={sessionGrade ?? "—"}
              color={sessionGrade ? GRADE_COLOR[sessionGrade] : "#4a5a7a"}
              big
            />
            <SummaryStat
              label="Setup Accuracy"
              value={`${setupCorrectCount}/${reviewedTotal}`}
              color={accuracyColor(setupCorrectCount, reviewedTotal)}
            />
            <SummaryStat
              label="Exit Picks"
              value={`${exitCorrectCount}/${reviewedTotal}`}
              color={accuracyColor(exitCorrectCount, reviewedTotal)}
            />
            <SummaryStat
              label="Best Streak"
              value={`🔥 ${bestStreak}`}
              color="#f59e0b"
            />
          </div>

          {best && (
            <div style={{
              background: "#0f1424", border: "1px solid #1e2f4a",
              borderRadius: 14, padding: "18px 20px", marginBottom: 18,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: "#4a5a7a",
                letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8,
              }}>Best Trade Reviewed</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#ffffff" }}>
                  {best.pair || best.symbol || "—"}
                </div>
                <div style={{
                  fontSize: 18, fontWeight: 900, color: "#22d3a5",
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                }}>
                  +{fmtMoney(Math.max(0, bestPnl))}
                </div>
              </div>
              {bestReview?.grade && (
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                  Grade <span style={{ color: GRADE_COLOR[bestReview.grade], fontWeight: 900 }}>{bestReview.grade}</span>
                  {" "}· {bestReview.score} pts
                </div>
              )}
            </div>
          )}

          <div style={{
            background: "rgba(99,102,241,0.08)",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 14, padding: "18px 20px", marginBottom: 22,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: "#a5b4fc",
              letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8,
            }}>Key Insight</div>
            <div style={{ fontSize: 14, color: "#ffffff", lineHeight: 1.5 }}>{insight}</div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={onRestart} style={{ ...primaryBtnStyle, flex: "1 1 200px" }}>
              Review Again
            </button>
            <button onClick={handleShare} style={{ ...secondaryBtnStyle, flex: "1 1 140px" }}>
              Share Results
            </button>
            <a href="/dashboard" style={{ ...secondaryBtnStyle, flex: "1 1 140px", textAlign: "center" }}>
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function accuracyColor(n: number, total: number) {
  if (!total) return "#4a5a7a";
  const pct = n / total;
  if (pct >= 0.7) return "#22d3a5";
  if (pct >= 0.4) return "#f59e0b";
  return "#f43f5e";
}

// ───────────────────── ConfettiBurst ─────────────────────

function ConfettiBurst() {
  const pieces = useMemo(() => {
    const colors = ["#22d3a5", "#6366f1", "#f59e0b", "#a3e635", "#fb7185", "#a5b4fc"];
    return Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 1.8 + Math.random() * 1.6,
      rotate: Math.random() * 720 - 360,
      color: colors[i % colors.length],
      size: 6 + Math.random() * 8,
    }));
  }, []);
  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none", zIndex: 100, overflow: "hidden",
    }}>
      <style>{`
        @keyframes nxConfettiFall {
          0%   { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate3d(0, 110vh, 0) rotate(var(--r)); opacity: 0; }
        }
      `}</style>
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.4,
            background: p.color,
            borderRadius: 2,
            ["--r" as any]: `${p.rotate}deg`,
            animation: `nxConfettiFall ${p.duration}s ${p.delay}s cubic-bezier(0.4, 0, 0.6, 1) forwards`,
          }}
        />
      ))}
    </div>
  );
}

// ───────────────────── ChartArea ─────────────────────

function ChartArea({
  trade, shot, shotLoading, candles, chartLoading, chartError, onHover,
  entry, exit, pnl, isWin, isLoss, phase, onZoom,
}: {
  trade: Trade;
  shot: string | null;
  shotLoading: boolean;
  candles: ChartRow[] | null;
  chartLoading: boolean;
  chartError: string | null;
  onHover: (c: ChartRow | null) => void;
  entry: number;
  exit: number;
  pnl: number;
  isWin: boolean;
  isLoss: boolean;
  phase: Phase;
  onZoom: () => void;
}) {
  const HEIGHT = 500;
  const showExit = phase !== "entry";

  if (chartLoading) {
    return <ChartSkeleton height={HEIGHT} />;
  }

  if (candles && candles.length > 0) {
    return (
      <div style={{ position: "relative", background: "#060d1a", height: HEIGHT }}>
        <CandleChart
          trade={trade}
          candles={candles}
          height={HEIGHT}
          onHover={onHover}
          showExit={showExit}
          phase={phase}
        />
      </div>
    );
  }

  if (shotLoading) {
    return (
      <div style={{ height: HEIGHT, background: "#060d1a", display: "flex", alignItems: "center", justifyContent: "center", color: "#2a2a3a", fontSize: 12 }}>Loading screenshot…</div>
    );
  }

  if (!shot) {
    return (
      <div style={{
        height: HEIGHT, background: "#060d1a",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        color: "#2a2a3a", gap: 10, padding: 16, textAlign: "center",
      }}>
        <div style={{ fontWeight: 700, color: "#9ca3af", fontSize: 13 }}>
          {chartError ? "No chart data available" : "No chart or screenshot"}
        </div>
        <div style={{ fontSize: 11, color: "#2a2a3a", maxWidth: 360 }}>
          {chartError
            ? `Could not load candles (${chartError}). Attach a chart screenshot to see it here.`
            : "Attach a chart screenshot when logging trades to see it here."}
        </div>
      </div>
    );
  }

  // Screenshot fallback — entry-only / reveal swap
  const pnlPositive = pnl > 0;
  const pnlBg = pnlPositive
    ? "linear-gradient(135deg, #22d3a5, #10b981)"
    : pnl < 0
      ? "linear-gradient(135deg, #f43f5e, #be123c)"
      : "linear-gradient(135deg, #6b7280, #374151)";
  const pnlGlow = pnlPositive
    ? "0 6px 24px rgba(34,211,165,0.45)"
    : pnl < 0
      ? "0 6px 24px rgba(244,63,94,0.45)"
      : "0 6px 24px rgba(0,0,0,0.4)";

  return (
    <div style={{ position: "relative", background: "#060d1a", height: HEIGHT }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={shot}
        alt="Trade screenshot"
        style={{
          width: "100%", height: HEIGHT, objectFit: "contain",
          background: "#060d1a", display: "block",
          filter: phase === "entry" ? "blur(10px) brightness(0.7)" : "none",
          transition: "filter 0.5s",
        }}
      />

      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 110,
        background: "linear-gradient(180deg, rgba(6,13,26,0.78) 0%, rgba(6,13,26,0.35) 55%, rgba(6,13,26,0) 100%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 130,
        background: "linear-gradient(0deg, rgba(6,13,26,0.85) 0%, rgba(6,13,26,0.4) 55%, rgba(6,13,26,0) 100%)",
        pointerEvents: "none",
      }} />

      {showExit ? (
        <div style={{
          position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
          padding: "10px 20px", borderRadius: 999,
          background: pnlBg, color: "#04121e",
          fontSize: 17, fontWeight: 900, letterSpacing: "-0.01em",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          boxShadow: `${pnlGlow}, inset 0 1px 0 rgba(255,255,255,0.25)`,
          whiteSpace: "nowrap", border: "1px solid rgba(255,255,255,0.18)",
          animation: phase === "reveal" ? "nxMarkerPop 0.5s ease-out both" : "none",
        }}>
          {pnlPositive ? "+" : ""}{fmtMoney(pnl)}
        </div>
      ) : (
        <div style={{
          position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
          padding: "10px 20px", borderRadius: 999,
          background: "rgba(99,102,241,0.18)",
          color: "#a5b4fc",
          fontSize: 14, fontWeight: 900, letterSpacing: "0.1em",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          boxShadow: "0 6px 24px rgba(99,102,241,0.3)",
          border: "1px solid rgba(99,102,241,0.45)",
        }}>
          ??? PNL HIDDEN ???
        </div>
      )}

      <button
        onClick={onZoom}
        aria-label="Zoom screenshot"
        style={{
          position: "absolute", top: 18, right: 18,
          padding: "8px 12px", borderRadius: 10,
          background: "rgba(13,22,40,0.78)", color: "#9ca3af",
          fontSize: 11, fontWeight: 800, letterSpacing: "0.06em",
          border: "1px solid rgba(99,102,241,0.35)", cursor: "pointer",
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          textTransform: "uppercase", transition: "all 0.15s",
        }}
      >Zoom</button>

      {entry > 0 && (
        <div style={{
          position: "absolute", bottom: 18, left: 18,
          padding: "9px 14px", borderRadius: 10,
          background: "linear-gradient(135deg, #22d3a5, #10b981)",
          color: "#04121e",
          fontSize: 13, fontWeight: 900, letterSpacing: "0.02em",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          boxShadow: "0 6px 20px rgba(34,211,165,0.5), inset 0 1px 0 rgba(255,255,255,0.25)",
          border: "1px solid rgba(255,255,255,0.18)", whiteSpace: "nowrap",
        }}>
          ▲ ENTRY ${entry.toFixed(2)}
        </div>
      )}

      {showExit && exit > 0 && (
        <div style={{
          position: "absolute", bottom: 18, right: 18,
          padding: "9px 14px", borderRadius: 10,
          background: "linear-gradient(135deg, #f43f5e, #be123c)",
          color: "#1a0008",
          fontSize: 13, fontWeight: 900, letterSpacing: "0.02em",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          boxShadow: "0 6px 20px rgba(244,63,94,0.5), inset 0 1px 0 rgba(255,255,255,0.25)",
          border: "1px solid rgba(255,255,255,0.18)", whiteSpace: "nowrap",
          animation: phase === "reveal" ? "nxMarkerSlide 0.55s ease-out both" : "none",
        }}>
          ▼ EXIT ${exit.toFixed(2)}
        </div>
      )}

      {!showExit && exit > 0 && (
        <div style={{
          position: "absolute", bottom: 18, right: 18,
          padding: "9px 14px", borderRadius: 10,
          background: "rgba(13,22,40,0.78)",
          color: "#4a5a7a",
          fontSize: 13, fontWeight: 900, letterSpacing: "0.02em",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          border: "1px dashed #2a2a3a", whiteSpace: "nowrap",
        }}>
          ▼ EXIT ???
        </div>
      )}
    </div>
  );
}

// ───────────────────── CandleChart ─────────────────────

function CandleChart({
  trade, candles, height, onHover, showExit, phase,
}: {
  trade: Trade;
  candles: ChartRow[];
  height: number;
  onHover: (c: ChartRow | null) => void;
  showExit: boolean;
  phase: Phase;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const tradeMs =
    typeof trade.date === "number" ? trade.date : new Date(trade.date || 0).getTime();
  const tradeSec = isFinite(tradeMs) ? Math.floor(tradeMs / 1000) : 0;
  const entryPrice = Number(trade.entryPrice ?? 0);
  const exitPrice = Number(trade.exitPrice ?? 0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || candles.length === 0) return;

    const chart: IChartApi = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "#060d1a" },
        textColor: "#6b7280",
        fontSize: 11,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(26, 37, 64, 0.8)", style: LineStyle.Solid },
        horzLines: { color: "rgba(26, 37, 64, 0.8)", style: LineStyle.Solid },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 9,
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.28 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "#6366f1", width: 1, style: LineStyle.Dashed,
          labelBackgroundColor: "#0ea5e9",
        },
        horzLine: {
          color: "#6366f1", width: 1, style: LineStyle.Dashed,
          labelBackgroundColor: "#0ea5e9",
        },
      },
      width: container.clientWidth,
      height,
      autoSize: false,
    });

    const panes = chart.panes();
    if (panes.length > 0) {
      createTextWatermark(panes[0], {
        horzAlign: "center",
        vertAlign: "center",
        lines: [
          {
            text: "NEXYRU",
            color: "rgba(99,102,241, 0.06)",
            fontSize: 92,
            fontStyle: "bold",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          },
        ],
      });
    }

    const series: ISeriesApi<"Candlestick"> = chart.addSeries(CandlestickSeries, {
      upColor: "#10b98130",
      downColor: "#ef444430",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
      borderVisible: true,
      wickVisible: true,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    series.setData(candles);

    const hasVolume = candles.some(
      (c) => Number.isFinite(c.volume) && (c.volume ?? 0) > 0
    );
    if (hasVolume) {
      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      chart.priceScale("vol").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
        borderVisible: false,
      });
      const volData: HistogramData<UTCTimestamp>[] = candles.map((c) => ({
        time: c.time,
        value: Number.isFinite(c.volume) ? Number(c.volume) : 0,
        color:
          c.close >= c.open
            ? "rgba(52, 211, 153, 0.4)"
            : "rgba(248, 113, 113, 0.4)",
      }));
      volSeries.setData(volData);
    }

    // Find entry index within the (possibly sliced) candle window
    let entryIdx = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < candles.length; i++) {
      const d = Math.abs((candles[i].time as number) - tradeSec);
      if (d < bestDiff) {
        bestDiff = d;
        entryIdx = i;
      }
    }
    const entryTime = candles[entryIdx].time;

    const markers: SeriesMarker<UTCTimestamp>[] = [];
    if (entryPrice > 0 && tradeSec > 0) {
      markers.push({
        time: entryTime,
        position: "belowBar",
        color: "#10b981",
        shape: "arrowUp",
        size: 2,
        text: `▲ ENTRY $${entryPrice.toFixed(2)}`,
      });
    }
    if (showExit && exitPrice > 0 && tradeSec > 0) {
      markers.push({
        time: entryTime,
        position: "aboveBar",
        color: "#ef4444",
        shape: "arrowDown",
        size: 2,
        text: `▼ EXIT $${exitPrice.toFixed(2)}`,
      });
    }
    if (markers.length) createSeriesMarkers(series, markers);

    if (entryPrice > 0) {
      series.createPriceLine({
        price: entryPrice,
        color: "#10b981",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "ENTRY",
        axisLabelColor: "#10b981",
        axisLabelTextColor: "#0a1f17",
      });
    }
    if (showExit && exitPrice > 0) {
      series.createPriceLine({
        price: exitPrice,
        color: "#ef4444",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "EXIT",
        axisLabelColor: "#ef4444",
        axisLabelTextColor: "#2a0e0e",
      });
    }

    const visibleSize = Math.min(60, candles.length);
    const fromIdx = entryIdx - Math.round(visibleSize * 0.6);
    const toIdx = entryIdx + Math.round(visibleSize * 0.4);
    chart.timeScale().setVisibleLogicalRange({ from: fromIdx, to: toIdx });

    const moveHandler = (param: MouseEventParams<Time>) => {
      if (!param.time) {
        onHover(null);
        return;
      }
      const t = param.time as number;
      const row = candles.find((c) => c.time === t);
      onHover(row || null);
    };
    chart.subscribeCrosshairMove(moveHandler);

    const resizeObs = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height });
    });
    resizeObs.observe(container);

    return () => {
      chart.unsubscribeCrosshairMove(moveHandler);
      resizeObs.disconnect();
      chart.remove();
    };
  }, [candles, entryPrice, exitPrice, tradeSec, height, onHover, showExit, phase]);

  return (
    <div style={{ position: "relative", height, background: "#060d1a" }}>
      <div ref={containerRef} style={{ width: "100%", height }} />
    </div>
  );
}

// ───────────────────── small sub-components ─────────────────────

function IntervalBtn({
  label, active, onClick, disabled,
}: { label: string; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "7px 12px",
        borderRadius: 8,
        border: `1px solid ${active ? "#6366f1" : "#1e2540"}`,
        background: active ? "rgba(99,102,241,0.15)" : "transparent",
        color: active ? "#6366f1" : disabled ? "#2a2a3a" : "#9ca3af",
        fontSize: 11,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s",
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
      }}
    >{label}</button>
  );
}

function OhlcRow({ candle }: { candle: ChartRow | null }) {
  const wrap: React.CSSProperties = {
    display: "flex", justifyContent: "center", alignItems: "center", gap: 14,
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
    fontSize: 11, fontWeight: 700, color: "#6b7280",
    letterSpacing: "0.02em", minHeight: 18, whiteSpace: "nowrap",
    overflow: "hidden", textOverflow: "ellipsis",
  };
  if (!candle) {
    return <div style={{ ...wrap, color: "#2a2a3a", fontSize: 10, fontWeight: 600 }}>↕ hover for OHLC</div>;
  }
  const up = candle.close >= candle.open;
  const cColor = up ? "#10b981" : "#ef4444";
  const change = candle.close - candle.open;
  const changePct = candle.open !== 0 ? (change / candle.open) * 100 : 0;
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  const pair = (k: string, v: string, c?: string) => (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
      <span style={{ color: "#4a5a7a" }}>{k}</span>
      <span style={{ color: c || "#9ca3af" }}>{v}</span>
    </span>
  );
  return (
    <div style={wrap}>
      {pair("O", fmt(candle.open))}
      {pair("H", fmt(candle.high), "#10b981")}
      {pair("L", fmt(candle.low), "#ef4444")}
      {pair("C", fmt(candle.close), cColor)}
      <span style={{ color: cColor, fontSize: 10 }}>
        {change >= 0 ? "+" : ""}{fmt(change)} ({changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%)
      </span>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: React.ReactNode; color: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: "#4a5a7a",
        letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontSize: 15, fontWeight: 900, color,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        letterSpacing: "-0.01em", whiteSpace: "nowrap",
        overflow: "hidden", textOverflow: "ellipsis",
      }}>{value}</div>
    </div>
  );
}

function SummaryStat({
  label, value, color, big,
}: { label: string; value: React.ReactNode; color: string; big?: boolean }) {
  return (
    <div style={{
      background: "#111118",
      border: `1px solid ${color}33`,
      borderRadius: 14, padding: "16px 18px",
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "#4a5a7a",
        letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8,
      }}>{label}</div>
      <div style={{
        fontSize: big ? 38 : 26, fontWeight: 900, color,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        lineHeight: 1.1,
      }}>{value}</div>
    </div>
  );
}

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div style={{ height, background: "#060d1a", position: "relative", overflow: "hidden" }}>
      <style>{`
        @keyframes nexyruPulse {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 0.85; }
        }
        .nx-skel-bar {
          background: linear-gradient(180deg, #111118 0%, #0a1320 100%);
          border-radius: 2px;
          animation: nexyruPulse 1.4s ease-in-out infinite;
        }
      `}</style>
      <div style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
        {[20, 40, 60, 80].map((p) => (
          <div key={p} style={{
            position: "absolute", left: 0, right: 0, top: `${p}%`,
            height: 1, background: "rgba(26, 37, 64, 0.6)",
          }} />
        ))}
      </div>
      <div style={{
        position: "absolute", inset: 0,
        padding: "30px 70px 110px 20px",
        display: "flex", alignItems: "flex-end", gap: 4,
      }}>
        {Array.from({ length: 40 }).map((_, i) => {
          const h = 30 + ((i * 37) % 60);
          const delay = (i * 0.04) % 1.4;
          return (
            <div
              key={i}
              className="nx-skel-bar"
              style={{ flex: 1, height: `${h}%`, minWidth: 4, animationDelay: `${delay}s` }}
            />
          );
        })}
      </div>
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        color: "#1e3a5f", fontSize: 38, fontWeight: 900,
        letterSpacing: "0.4em",
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        animation: "nexyruPulse 1.6s ease-in-out infinite",
        pointerEvents: "none",
      }}>NEXYRU</div>
    </div>
  );
}

function ZoomModal({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Trade screenshot zoom view"
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(2, 6, 14, 0.92)",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 32, cursor: "zoom-out",
      }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          position: "fixed", top: 22, right: 24,
          padding: "10px 16px", borderRadius: 10,
          background: "rgba(13,22,40,0.85)", color: "#ffffff",
          fontSize: 12, fontWeight: 800, letterSpacing: "0.06em",
          textTransform: "uppercase", border: "1px solid #1e2f4a",
          cursor: "pointer", backdropFilter: "blur(8px)",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
        }}
      >✕ Close · Esc</button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Trade screenshot — full size"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
          borderRadius: 14,
          boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)",
          cursor: "default",
        }}
      />
    </div>
  );
}

// ───────────────────── styles ─────────────────────

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#060d1a",
  color: "#ffffff",
  padding: "32px 18px 80px",
  display: "flex",
  justifyContent: "center",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const cardStyle: React.CSSProperties = {
  background: "#111118",
  border: "1px solid #1e2f4a",
  borderRadius: 18,
  padding: "22px",
  boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
};

const primaryBtnStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "13px 18px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(135deg,#10b981,#22d3a5)",
  color: "#000",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
  textDecoration: "none",
  textAlign: "center",
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "13px 18px",
  borderRadius: 12,
  border: "1px solid #1e2f4a",
  background: "transparent",
  color: "#9ca3af",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "none",
};

const replayCSS = `
@keyframes nxFlashWin {
  0%   { box-shadow: 0 0 0 1px rgba(34,211,165,0.18), 0 0 60px rgba(34,211,165,0.18), 0 12px 40px rgba(0,0,0,0.5); }
  20%  { box-shadow: 0 0 0 4px rgba(34,211,165,0.55), 0 0 120px rgba(34,211,165,0.55), 0 12px 60px rgba(34,211,165,0.4); }
  100% { box-shadow: 0 0 0 1px rgba(34,211,165,0.18), 0 0 60px rgba(34,211,165,0.18), 0 12px 40px rgba(0,0,0,0.5); }
}
@keyframes nxFlashLoss {
  0%   { box-shadow: 0 0 0 1px rgba(244,63,94,0.18), 0 0 60px rgba(244,63,94,0.18), 0 12px 40px rgba(0,0,0,0.5); }
  20%  { box-shadow: 0 0 0 4px rgba(244,63,94,0.55), 0 0 120px rgba(244,63,94,0.55), 0 12px 60px rgba(244,63,94,0.4); }
  100% { box-shadow: 0 0 0 1px rgba(244,63,94,0.18), 0 0 60px rgba(244,63,94,0.18), 0 12px 40px rgba(0,0,0,0.5); }
}
@keyframes nxMarkerPop {
  from { transform: translateX(-50%) scale(0.4); opacity: 0; }
  to   { transform: translateX(-50%) scale(1);   opacity: 1; }
}
@keyframes nxMarkerSlide {
  from { transform: translateX(60px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
.nx-reveal-card { animation: nxRevealIn 0.45s cubic-bezier(0.22, 0.61, 0.36, 1) both; }
@keyframes nxRevealIn {
  from { transform: translateY(8px); opacity: 0; }
  to   { transform: translateY(0);   opacity: 1; }
}
.nx-q-card { animation: nxQuestionIn 0.32s cubic-bezier(0.22, 0.61, 0.36, 1) both; }
@keyframes nxQuestionIn {
  from { transform: translateX(16px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
@media (max-width: 767px) {
  .replay-shell { padding: 16px 12px 90px !important; }
  .replay-chart-header { grid-template-columns: 1fr !important; gap: 8px !important; }
  .replay-chart-header-right { text-align: left !important; }
  .replay-grade-grid { grid-template-columns: repeat(5, 1fr) !important; }
  .replay-big-triad { gap: 8px !important; }
}
`;
