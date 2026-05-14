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
type Grade = "A+" | "A" | "B" | "C" | "D" | "F";

type EmotionKey =
  | "fomo" | "fear" | "revenge" | "greed" | "confident"
  | "neutral" | "frustrated" | "bored" | "overconfident" | "tired";

const EMOTION_LABELS: Record<EmotionKey, string> = {
  fomo: "FOMO", fear: "Fear", revenge: "Revenge", greed: "Greed", confident: "Confident",
  neutral: "Neutral", frustrated: "Frustrated", bored: "Bored", overconfident: "Overconfident", tired: "Tired",
};
const EMOTION_KEYS = Object.keys(EMOTION_LABELS) as EmotionKey[];

type MistakeKey =
  | "early_entry" | "early_exit" | "moved_sl" | "missed_entry" | "wrong_size"
  | "late_entry" | "overtraded" | "ignored_news" | "no_setup" | "broke_rules";

const MISTAKE_LABELS: Record<MistakeKey, string> = {
  early_entry: "Early Entry", early_exit: "Early Exit", moved_sl: "Moved Stop Loss", missed_entry: "Missed Entry", wrong_size: "Wrong Size",
  late_entry: "Late Entry", overtraded: "Overtraded", ignored_news: "Ignored News", no_setup: "No Setup", broke_rules: "Broke Rules",
};
const MISTAKE_KEYS = Object.keys(MISTAKE_LABELS) as MistakeKey[];

interface Review {
  tradeId: string;
  matchedSetup: Triad | null;
  followedRules: Triad | null;
  confidence: number;
  differently: string;
  grade: Grade | null;
  reviewedAt: number;
  emotion?: EmotionKey | null;
  mistakes?: MistakeKey[];
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

const GRADE_LIST: Grade[] = ["A+", "A", "B", "C", "D", "F"];
const GRADE_SCORE: Record<Grade, number> = { "A+": 4.3, A: 4, B: 3, C: 2, D: 1, F: 0 };
const SCORE_TO_GRADE = (s: number): Grade => {
  if (s >= 4.15) return "A+";
  if (s >= 3.5) return "A";
  if (s >= 2.5) return "B";
  if (s >= 1.5) return "C";
  if (s >= 0.5) return "D";
  return "F";
};
const GRADE_COLOR: Record<Grade, string> = {
  "A+": "#22d3a5",
  A: "#10b981",
  B: "#a3e635",
  C: "#f59e0b",
  D: "#f59e0b",
  F: "#f43f5e",
};

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

// Symbols we recognize as crypto (routed to Binance). Values unused — Set semantics.
const CRYPTO_BASES = new Set<string>([
 "BTC", "ETH", "SOL", "DOGE", "ADA", "XRP", "AVAX", "MATIC", "DOT", "LINK",
 "UNI", "ATOM", "LTC", "BCH", "NEAR", "SHIB", "TRX", "XLM", "FIL", "ALGO",
 "APT", "ARB", "OP", "INJ", "TIA", "SUI", "PEPE", "WIF", "BONK", "HYPE",
]);

// Kraken uses XBT for Bitcoin and combined USD pairs without separators.
const KRAKEN_SYMBOL_MAP: Record<string, string> = {
  "SOL/USD": "SOLUSD",
  "BTC/USD": "XBTUSD",
  "ETH/USD": "ETHUSD",
  "DOGE/USD": "DOGEUSD",
  "XRP/USD": "XRPUSD",
  "SOL-USD": "SOLUSD",
  "BTC-USD": "XBTUSD",
  "ETH-USD": "ETHUSD",
  "DOGE-USD": "DOGEUSD",
  "XRP-USD": "XRPUSD",
};

function formatKrakenPair(raw: string): string {
  const pair = (raw || "").toUpperCase().trim();
  if (KRAKEN_SYMBOL_MAP[pair]) return KRAKEN_SYMBOL_MAP[pair];
  // Generic: strip separators, swap BTC→XBT (Kraken convention).
  const flat = pair.replace(/[\/\-]/g, "");
  return flat.replace(/^BTC/, "XBT");
}

const YAHOO_MAP: Record<string, string> = {
  "ES1!": "ES=F",
  "NQ1!": "NQ=F",
  "CL1!": "CL=F",
  "YM1!": "YM=F",
  "RTY1!": "RTY=F",
  "GC1!": "GC=F",
  "SI1!": "SI=F",
  "NG1!": "NG=F",
  "ZB1!": "ZB=F",
  "ZN1!": "ZN=F",
  "ZS1!": "ZS=F",
  "ZC1!": "ZC=F",
  "ZW1!": "ZW=F",
  "HG1!": "HG=F",
  "PL1!": "PL=F",
  "PA1!": "PA=F",
  "GOLD/USD": "GC=F",
  "SILVER/USD": "SI=F",
  "OIL/USD": "CL=F",
  "USOIL/USD": "CL=F",
  "COPPER/USD": "HG=F",
};

const YAHOO_INTERVAL: Record<Interval, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "60m",
};

// Kraken expects interval in minutes.
const KRAKEN_INTERVAL: Record<Interval, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",
};

const INTERVAL_MS: Record<Interval, number> = {
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
};

// 60 candles before entry, 20 after — full lead-up context.
const CANDLES_BEFORE = 60;
const CANDLES_AFTER = 20;

type Instrument =
  | { kind: "crypto"; krakenPair: string }
  | { kind: "yahoo"; yahooSymbol: string }
  | { kind: "unknown" };

function classifySymbol(raw: string): Instrument {
  const symbol = (raw || "").toUpperCase().trim();
  if (!symbol) return { kind: "unknown" };

  // Specific Yahoo mappings (futures, metals, oil) take precedence over crypto routing.
  if (YAHOO_MAP[symbol]) return { kind: "yahoo", yahooSymbol: YAHOO_MAP[symbol] };

  const base = symbol.split("/")[0].split("-")[0];
  if (CRYPTO_BASES.has(base)) {
    return { kind: "crypto", krakenPair: formatKrakenPair(symbol) };
  }

  // Plain equity ticker (AAPL, TSLA…) or anything else — let Yahoo try
  const yahooFallback = symbol.replace(/\/USD$/i, "").replace(/\//g, "-");
  if (!yahooFallback) return { kind: "unknown" };
  return { kind: "yahoo", yahooSymbol: yahooFallback };
}

async function fetchCandlesFromApi(
  krakenPair: string,
  interval: Interval,
  tradeTime: number,
): Promise<ChartRow[]> {
  // Kraken's `since` is in seconds. Anchor 60 candles before entry so the
  // window covers the lead-up plus the following bars (Kraken returns up to 720).
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
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function topTheme(reviews: Review[]): string | null {
  const STOP = new Set(["the","and","for","that","this","with","have","was","were","but","not","you","your","from","into","when","then","than","just","more","some","what","why","how","its","it's","i","a","an","of","to","in","on","is","be","by","as","or","at","it","my","me","we","do","did","didn't","could","would","should","too","so","if","get","got","go","gone"]);
  const counts: Record<string, number> = {};
  for (const r of reviews) {
    const text = (r.differently || "").toLowerCase();
    if (!text.trim()) continue;
    const words = text.match(/[a-z']{4,}/g) || [];
    const seen = new Set<string>();
    for (const w of words) {
      if (STOP.has(w) || seen.has(w)) continue;
      seen.add(w);
      counts[w] = (counts[w] || 0) + 1;
    }
  }
  const sorted = Object.entries(counts).sort((a, b) =>b[1] - a[1]);
 if (!sorted.length || sorted[0][1]< 2) {
    const withText = reviews.filter((r) => r.differently?.trim());
    return withText.length ? withText[withText.length - 1].differently.trim() : null;
  }
  return `Theme: "${sorted[0][0]}" mentioned in ${sorted[0][1]} reviews`;
}

// ───────────────────── session picker / scoring helpers ─────────────────────

type SessionType = "quick" | "last" | "worst" | "custom";

interface SessionResult {
  tradeId: string;
  correctIdentification: boolean;
  matchedSetup: Triad | null;
  quickConfidence: number;
  isWin: boolean;
  pnl: number;
}

interface Insight {
  tone: "good" | "warning" | "bad";
  message: string;
}

function getInsight(matchedSetup: Triad | null, quickConfidence: number, isWin: boolean, pnl: number): Insight | null {
  if (matchedSetup === "yes" && isWin) return { tone: "good", message: "Clean execution. This is what consistency looks like." };
  if (matchedSetup === "yes" && pnl < 0) return { tone: "warning", message: "Good setup, bad outcome. Losses happen — what matters is the process." };
  if (matchedSetup === "no" && isWin) return { tone: "warning", message: "Lucky win — but taking trades outside your setup will hurt you long term." };
  if (matchedSetup === "no" && pnl < 0) return { tone: "bad", message: "This is exactly why we stick to our setups. Avoid these." };
  if (quickConfidence >= 4 && isWin) return { tone: "good", message: "Your instincts are sharp on this one." };
  if (quickConfidence >= 4 && pnl < 0) return { tone: "bad", message: "High confidence on a losing trade — worth reviewing why." };
  return null;
}

function isCorrectIdentification(matchedSetup: Triad | null, isWin: boolean, pnl: number): boolean {
  if (matchedSetup === "yes" && isWin) return true;
  if (matchedSetup === "no" && pnl < 0) return true;
  return false;
}

function getTradeMs(t: Trade): number {
  return typeof t.date === "number" ? t.date : new Date(t.date || 0).getTime();
}

function pickQuickReview(trades: Trade[]): Trade[] {
  const pool = trades.filter((t) => Number.isFinite(getTradeMs(t)));
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(5, shuffled.length));
}

function pickLastSession(trades: Trade[]): Trade[] {
  if (!trades.length) return [];
  const latest = getTradeMs(trades[0]);
  if (!Number.isFinite(latest) || latest <= 0) return [];
  const dayStart = new Date(latest).setHours(0, 0, 0, 0);
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  return trades.filter((t) => {
    const tm = getTradeMs(t);
    return tm >= dayStart && tm < dayEnd;
  });
}

function pickWorstTrades(trades: Trade[]): Trade[] {
  return [...trades]
    .filter((t) => Number.isFinite(Number(t.pnl)))
    .sort((a, b) => Number(a.pnl ?? 0) - Number(b.pnl ?? 0))
    .slice(0, Math.min(5, trades.length));
}

// ───────────────────── page ─────────────────────

export default function ReplayPage() {
  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#0a0a0f" }}>
      <Sidebar activePath="/replay" />
      <main style={{ flex:1, marginLeft:56 }}>
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
 const [slideDir, setSlideDir] = useState<"next" | "prev">("next");
 const [slideKey, setSlideKey] = useState(0);
 const [interval, setInterval] = useState<Interval>("5m");
 const [zoomOpen, setZoomOpen] = useState(false);

 // draft form state
 const [matchedSetup, setMatchedSetup] = useState<Triad | null>(null);
 const [followedRules, setFollowedRules] = useState<Triad | null>(null);
 const [confidence, setConfidence] = useState(5);
 const [differently, setDifferently] = useState("");
 const [grade, setGrade] = useState<Grade | null>(null);
 const [emotion, setEmotion] = useState<EmotionKey | null>(null);
 const [mistakes, setMistakes] = useState<MistakeKey[]>([]);

 // reveal mechanic
 const [revealed, setReveal] = useState(false);
 const [quickConfidence, setQuickConfidence] = useState(0);

 // session picker / scoring
 const [sessionType, setSessionType] = useState<SessionType | null>(null);
 const [sessionTradeIds, setSessionTradeIds] = useState<string[]>([]);
 const [customSize, setCustomSize] = useState(10);
 const [streak, setStreak] = useState(0);
 const [streakFlash, setStreakFlash] = useState<number | null>(null);
 const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
 const [insight, setInsight] = useState<Insight | null>(null);
 const [shareCopied, setShareCopied] = useState(false);

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

      // if tradeId param present, auto-start a single-trade session
      try {
        const params = new URLSearchParams(window.location.search);
        const tradeId = params.get("tradeId");
        if (tradeId) {
          const found = sorted.find((t) => String(t.id) === String(tradeId));
          if (found) {
            setSessionType("custom");
            setSessionTradeIds([found.id]);
            setIdx(0);
          }
        }
      } catch {}
    } catch (e) {
      console.warn("replay load failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const sessionTrades = useMemo(() => {
    if (!sessionTradeIds.length) return [];
    const byId: Record<string, Trade> = {};
    for (const t of trades) byId[t.id] = t;
    return sessionTradeIds.map((id) => byId[id]).filter(Boolean) as Trade[];
  }, [sessionTradeIds, trades]);

  const lastSessionCount = useMemo(() => pickLastSession(trades).length, [trades]);

  const startSession = useCallback((type: SessionType, sizeOverride?: number) => {
    let selected: Trade[] = [];
    if (type === "quick") selected = pickQuickReview(trades);
    else if (type === "last") selected = pickLastSession(trades);
    else if (type === "worst") selected = pickWorstTrades(trades);
    else if (type === "custom") {
      const n = Math.max(1, Math.min(sizeOverride ?? customSize, trades.length));
      selected = trades.slice(0, n);
    }
    if (!selected.length) return;
    setSessionType(type);
    setSessionTradeIds(selected.map((t) => t.id));
    setIdx(0);
    setDone(false);
    setStreak(0);
    setStreakFlash(null);
    setSessionResults([]);
    setInsight(null);
    setShareCopied(false);
    setSlideDir("next");
  }, [trades, customSize]);

  const current = sessionTrades[idx];

  const { candles, loading: chartLoading, error: chartError } = useTradeChart(current, interval);
  const [hoverCandle, setHoverCandle] = useState<ChartRow | null>(null);
  useEffect(() => { setHoverCandle(null); }, [current?.id, interval]);

  // hydrate form when current trade changes
  useEffect(() => {
    if (!current) return;
    const existing = reviews[current.id];
    setMatchedSetup(existing?.matchedSetup ?? null);
    setFollowedRules(existing?.followedRules ?? null);
    setConfidence(existing?.confidence ?? 5);
    setDifferently(existing?.differently ?? "");
    setGrade(existing?.grade ?? null);
    setEmotion(existing?.emotion ?? null);
    setMistakes(existing?.mistakes ?? []);
    setReveal(false);
    setQuickConfidence(0);
    setSlideKey((k) => k + 1);
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

  const total = sessionTrades.length;
  const reviewedCount = useMemo(
    () => sessionTrades.filter((t) => reviews[t.id]).length,
    [sessionTrades, reviews]
  );
  const progressPct = total ? Math.round(((idx + (done ? 1 : 0)) / total) * 100) : 0;

 const sessionGrade = useMemo<Grade | null>(() => {
    const r = Object.values(reviews).filter((x) => x && x.grade);
    if (!r.length) return null;
    const avg = r.reduce((s, x) => s + (GRADE_SCORE[x.grade!] ?? 0), 0) / r.length;
    return SCORE_TO_GRADE(avg);
  }, [reviews]);

  const canAdvance = matchedSetup && followedRules && grade;

  const saveCurrent = useCallback(
    (r: Review) => {
      if (!username) return;
      const next = { ...reviews, [r.tradeId]: r };
      setReviews(next);
      try { localStorage.setItem(reviewsKey(username), JSON.stringify(next)); } catch {}
    },
    [reviews, username]
  );

  const handleReveal = () => {
    if (!current) return;
    setReveal(true);
    const pnlNum = Number(current.pnl ?? 0);
    const winNow = pnlNum > 0;
    const ins = getInsight(matchedSetup, quickConfidence, winNow, pnlNum);
    setInsight(ins);
    const correct = isCorrectIdentification(matchedSetup, winNow, pnlNum);
    if (correct) {
      const next = streak + 1;
      setStreak(next);
      if (next === 3 || next === 5 || next === 10) {
        setStreakFlash(next);
        setTimeout(() => setStreakFlash(null), 1800);
      }
    } else {
      setStreak(0);
    }
  };

  const recordSessionResult = (t: Trade) => {
    const pnlNum = Number(t.pnl ?? 0);
    const winNow = pnlNum > 0;
    const correct = isCorrectIdentification(matchedSetup, winNow, pnlNum);
    setSessionResults((prev) => {
      const filtered = prev.filter((r) => r.tradeId !== t.id);
      return [...filtered, {
        tradeId: t.id,
        correctIdentification: correct,
        matchedSetup,
        quickConfidence,
        isWin: winNow,
        pnl: pnlNum,
      }];
    });
  };

  const handleNext = () => {
    if (!current || !canAdvance) return;
    const r: Review = {
      tradeId: current.id,
      matchedSetup,
      followedRules,
      confidence,
      differently: differently.trim(),
      grade,
      reviewedAt: Date.now(),
      emotion,
      mistakes,
    };
    saveCurrent(r);
    recordSessionResult(current);
    setSlideDir("next");
    setInsight(null);
    if (idx + 1 >= total) setDone(true);
    else setIdx(idx + 1);
  };

  const handleSkip = () => {
    setSlideDir("next");
    setInsight(null);
    if (idx + 1 >= total) setDone(true);
    else setIdx(idx + 1);
  };

  const handlePrev = () => {
    setSlideDir("prev");
    setInsight(null);
    if (done) { setDone(false); setIdx(Math.max(0, total - 1)); return; }
    setIdx(Math.max(0, idx - 1));
  };

  const handleRestart = () => {
    setDone(false);
    setIdx(0);
    setSlideDir("next");
    setSessionType(null);
    setSessionTradeIds([]);
    setStreak(0);
    setStreakFlash(null);
    setSessionResults([]);
    setInsight(null);
    setShareCopied(false);
  };

  const handleResetAllReviews = () => {
    if (!username) return;
    setReviews({});
    try { localStorage.removeItem(reviewsKey(username)); } catch {}
    handleRestart();
  };

  // ── Session Summary ──
  const sessionSummary = useMemo(() => {
    if (!sessionResults.length) return null;
    const total = sessionResults.length;
    const correct = sessionResults.filter((r) => r.correctIdentification).length;
    const wins = sessionResults.filter((r) => r.isWin);
    const losses = sessionResults.filter((r) => !r.isWin);
    const lossesOutsideSetup = losses.filter((r) => r.matchedSetup === "no").length;
    const avgConfWin = wins.length
      ? wins.reduce((s, r) => s + (r.quickConfidence || 0), 0) / wins.length
      : 0;
    const avgConfLoss = losses.length
      ? losses.reduce((s, r) => s + (r.quickConfidence || 0), 0) / losses.length
      : 0;

    // Score 0-100: setup accuracy (70 pts) + confidence calibration (30 pts)
    const accuracyScore = (correct / total) * 70;
    let calibScore = 0;
    if (wins.length && losses.length) {
      const calibRatio = Math.max(0, (avgConfWin - avgConfLoss) / 5);
      calibScore = Math.min(30, calibRatio * 30 + 10);
    } else {
      calibScore = 20;
    }
    const score = Math.round(accuracyScore + calibScore);

    const confInsight = wins.length && losses.length
      ? (avgConfWin > avgConfLoss
          ? "winning trades — your gut is well calibrated"
          : avgConfLoss > avgConfWin
          ? "losing trades — your gut may be off"
          : "evenly split — confidence didn't separate wins from losses")
      : wins.length
      ? "winning trades"
      : "losing trades";

    return {
      total,
      correct,
      score,
      lossesOutsideSetup,
      lossesTotal: losses.length,
      confInsight,
    };
  }, [sessionResults]);

  const buildShareText = useCallback(() => {
    if (!sessionSummary) return "";
    const pct = sessionSummary.lossesTotal
      ? Math.round((sessionSummary.lossesOutsideSetup / sessionSummary.lossesTotal) * 100)
      : 0;
    const topLine = sessionSummary.lossesTotal && pct >= 50
      ? `${pct}% of my losses were outside my setup.`
      : `Setup accuracy: ${sessionSummary.correct}/${sessionSummary.total}.`;
    return `Just completed a Nexyru trade review session 📊\nSetup accuracy: ${sessionSummary.correct}/${sessionSummary.total} · Score: ${sessionSummary.score}/100\nTop insight: ${topLine}`;
  }, [sessionSummary]);

  const handleShare = async () => {
    const text = buildShareText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2200);
    } catch {}
  };

  // ───────────────────── render ─────────────────────

  if (loading) {
    return (
      <div style={shellStyle}><div style={{ color: "#2a2a3a", fontSize: 13 }}>Loading replay…</div></div>
    );
  }

  if (!username) {
    return (
      <div style={shellStyle}><div style={cardStyle}><div style={{ fontSize: 18, fontWeight: 800, color: "#ffffff", marginBottom: 8 }}>Sign in required</div><div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 18 }}>Trade Replay loads your local trade history.</div><a href="/login" style={primaryBtnStyle}>Go to login</a></div></div>
    );
  }

  if (!trades.length) {
    return (
      <div style={shellStyle}><div style={cardStyle}><div style={{ fontSize: 28, marginBottom: 8 }}>️</div><div style={{ fontSize: 18, fontWeight: 800, color: "#ffffff", marginBottom: 8 }}>No trades to replay</div><div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 18 }}>Log some trades in the dashboard, then come back to review them.</div><a href="/dashboard" style={primaryBtnStyle}>Open Dashboard</a></div></div>
    );
  }

  if (!sessionType) {
    return (
      <SessionPicker
        totalTrades={trades.length}
        lastSessionCount={lastSessionCount}
        customSize={customSize}
        onCustomSizeChange={setCustomSize}
        onStart={startSession}
      />
    );
  }

  if (done || idx >= total) {
    return (
      <div style={shellStyle}><div style={{ width: "100%", maxWidth: 760 }}>
        <TopProgressBar pct={100} />
        <ProgressBar idx={total} total={total} pct={100} sessionGrade={sessionGrade} streak={streak} streakFlash={streakFlash} done />
        <div style={{ ...cardStyle, marginTop: 18, padding: "36px 28px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#22d3a5", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>Session Complete</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", marginBottom: 6, letterSpacing: "-0.01em" }}>Here's what you learned</div>

          {sessionSummary ? (
            <SessionSummaryView
              summary={sessionSummary}
              onShare={handleShare}
              shareCopied={shareCopied}
              onReviewAgain={handleRestart}
            />
          ) : (
            <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 14 }}>
              You skipped through without grading any trades.{" "}
              <button onClick={handleRestart} style={{ background: "transparent", border: "none", color: "#6366f1", fontWeight: 700, cursor: "pointer", padding: 0 }}>Start over</button>
            </div>
          )}
        </div>
      </div></div>
    );
  }

  const t = current;
  const pnl = Number(t.pnl ?? 0);
  const isWin = pnl >0;
 const isLoss = pnl< 0;
  const pnlColor = isWin ? "#22d3a5" : isLoss ? "#f43f5e" : "#9ca3af";
  const sideUpper = (t.type || "").toString().toUpperCase();
  const isLong = sideUpper === "LONG";
  const sym = (t.pair || t.symbol || "").toString();
  const entry = Number(t.entryPrice ?? 0);
  const exit = Number(t.exitPrice ?? 0);
  const contracts = Number(t.size ?? 0);

  return (
    <div className="replay-shell" style={shellStyle}><style>{slideAnimCSS}</style><style>{`
        @media (max-width: 767px) {
          .replay-shell { padding: 16px 12px 90px !important; }
          .replay-chart-header { grid-template-columns: 1fr !important; gap: 8px !important; }
          .replay-chart-header-right { text-align: left !important; }
          .replay-grade-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .replay-emotion-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .replay-mistake-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style><div style={{ width: "100%", maxWidth: 760 }}>
        <TopProgressBar pct={Math.round((idx / total) * 100)} />
        <ProgressBar idx={idx} total={total} pct={Math.round(((idx) / total) * 100)} sessionGrade={sessionGrade} streak={streak} streakFlash={streakFlash} />

        {/* Sliding trade panel */}
        <div
          key={slideKey}
          style={{
            animation: `${slideDir === "next" ? "slideInNext" : "slideInPrev"} 0.32s cubic-bezier(0.22, 0.61, 0.36, 1) both`,
          }}
        >
          {/* Unified chart header: symbol+pills | OHLC | date */}
          <div className="replay-chart-header" style={{
            ...cardStyle,
            marginTop: 18,
            padding: "11px 14px",
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            gap: 14,
          }}>
            {/* Left: symbol, side, interval pills, screenshot */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span style={{
                fontSize: 15,
                fontWeight: 900,
                color: "#ffffff",
                letterSpacing: "-0.01em",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
              }}>
                {sym || "—"}
              </span><span style={{
                padding: "3px 8px",
                borderRadius: 6,
                background: isLong ? "rgba(34,211,165,0.18)" : "rgba(244,63,94,0.18)",
                color: isLong ? "#22d3a5" : "#f43f5e",
                border: `1px solid ${isLong ? "#22d3a566" : "#f43f5e66"}`,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.1em",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
              }}>
                {isLong ? "▲" : "▼"} {sideUpper || "—"}
              </span><div style={{ width: 1, height: 18, background: "#2a2a3a", margin: "0 2px" }} /><div style={{ display: "flex", gap: 3 }}>
                {(["1m", "5m", "15m", "1h"] as Interval[]).map((iv) =>(<IntervalBtn
                    key={iv}
                    label={iv}
                    active={interval === iv}
                    onClick={() => setInterval(iv)}
                  />
                ))}
              </div></div>

            {/* Center: live OHLC on hover (or capture-time note when no candles) */}
            <div style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minWidth: 0,
            }}>
              {candles && candles.length >0 ? (<OhlcRow candle={hoverCandle ?? candles[candles.length - 1]} />) : (<div style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#4a5a7a",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>Chart captured at time of trade</div>
              )}
            </div>

            {/* Right: trade datetime */}
            <span className="replay-chart-header-right" style={{
              fontSize: 11,
              color: "#9ca3af",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              whiteSpace: "nowrap",
              textAlign: "right",
            }}>
              {fmtTradeDateTime(t.date)}
            </span></div>

          {/* Chart card — premium screenshot frame */}
          <div style={{
            ...cardStyle,
            marginTop: 10,
            padding: 0,
            overflow: "hidden",
            position: "relative",
            border: `1px solid ${
              shot
                ? isWin ? "rgba(34,211,165,0.45)"
                : isLoss ? "rgba(244,63,94,0.45)"
                : "#1e2f4a"
                : "#1e2f4a"
            }`,
            boxShadow: shot
              ? isWin
                ? "0 0 0 1px rgba(34,211,165,0.18), 0 0 60px rgba(34,211,165,0.18), 0 12px 40px rgba(0,0,0,0.5)"
                : isLoss
                ? "0 0 0 1px rgba(244,63,94,0.18), 0 0 60px rgba(244,63,94,0.18), 0 12px 40px rgba(0,0,0,0.5)"
                : "0 12px 40px rgba(0,0,0,0.4)"
              : "0 12px 40px rgba(0,0,0,0.4)",
            transition: "border-color 0.3s, box-shadow 0.3s",
          }}><ChartArea
              trade={t}
              shot={shot}
              shotLoading={shotLoading}
              candles={candles}
              chartLoading={chartLoading}
              chartError={chartError}
              onHover={setHoverCandle}
              entry={entry}
              exit={exit}
              pnl={pnl}
              isWin={isWin}
              isLoss={isLoss}
              onZoom={() => setZoomOpen(true)}
              revealed={revealed}
            /></div>

          {/* Stats row */}
          <div style={{
            ...cardStyle,
            marginTop: 10,
            padding: "14px 16px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: 14,
          }}><StatCell label="Entry" value={fmtPrice(entry)} color="#22d3a5" /><StatCell
              label="Exit"
              value={
                <span style={{ opacity: revealed ? 1 : 0.4, transition: "opacity 0.4s ease" }}>
                  {revealed ? fmtPrice(exit) : "?"}
                </span>
              }
              color={revealed ? "#f43f5e" : "#4a5a7a"}
            /><StatCell
              label="PnL"
              value={
                <span style={{ opacity: revealed ? 1 : 0.4, transition: "opacity 0.4s ease" }}>
                  {revealed ? `${pnl > 0 ? "+" : ""}${fmtMoney(pnl)}` : "?"}
                </span>
              }
              color={revealed ? pnlColor : "#4a5a7a"}
            /><StatCell label="Duration" value="—" color="#9ca3af" /><StatCell
              label="Side"
              value={`${isLong ? "▲" : "▼"} ${sideUpper || "—"}`}
              color={isLong ? "#22d3a5" : "#f43f5e"}
            /></div>

          {/* strategy + notes (below chart) */}
          {(t.strategy || t.notes) && (
            <div style={{ ...cardStyle, marginTop: 12, padding: "14px 18px" }}>
              {t.strategy && (
                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: t.notes ? 8 : 0 }}><span style={{ color: "#4a5a7a", fontWeight: 700, marginRight: 8, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 10 }}>Setup</span><span style={{ color: "#ffffff", fontWeight: 700 }}>{t.strategy}</span></div>
              )}
              {t.notes && (
                <div style={{
                  fontSize: 12,
                  color: "#9ca3af",
                  lineHeight: 1.55,
                  whiteSpace: "pre-wrap",
                  background: "#111118",
                  border: "1px dashed #2a2a3a",
                  borderRadius: 10,
                  padding: "10px 12px",
                }}><div style={{ fontSize: 9, fontWeight: 700, color: "#4a5a7a", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Notes at the time</div>
                  {t.notes}
                </div>
              )}
            </div>
          )}

          {/* Review form */}
          <div style={{ ...cardStyle, marginTop: 12, padding: "22px" }}><div style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>
              {revealed ? "Review this trade" : "Before we reveal…"}
            </div>

            {!revealed && (
              <div style={{ animation: "slideInNext 0.32s cubic-bezier(0.22, 0.61, 0.36, 1) both" }}>
                <FormBlock label="Was this your setup?">
                  <TriadRow value={matchedSetup} onChange={setMatchedSetup} big />
                </FormBlock>
                <FormBlock label={`How clear was this entry? — ${quickConfidence || "—"}/5`}>
                  <QuickConfidenceDots value={quickConfidence} onChange={setQuickConfidence} />
                </FormBlock>
                <div style={{ fontSize: 11, color: "#4a5a7a", marginTop: -6, marginBottom: 14, textAlign: "left" }}>
                  Answer honestly — this feeds your psychology tracker.
                </div>
                <button
                  onClick={handleReveal}
                  disabled={!matchedSetup || !quickConfidence}
                  style={{
                    ...primaryBtnStyle,
                    width: "100%",
                    padding: "18px 20px",
                    minHeight: 56,
                    fontSize: 14,
                    marginTop: 4,
                    opacity: (matchedSetup && quickConfidence) ? 1 : 0.45,
                    cursor: (matchedSetup && quickConfidence) ? "pointer" : "not-allowed",
                  }}
                >Reveal Trade Result →</button>
                {(!matchedSetup || !quickConfidence) && (
                  <div style={{ marginTop: 10, fontSize: 11, color: "#4a5a7a", textAlign: "center" }}>
                    Pick a setup match and confidence to reveal.
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
                  <button
                    onClick={handlePrev}
                    disabled={idx === 0}
                    style={{
                      ...secondaryBtnStyle,
                      opacity: idx === 0 ? 0.4 : 1,
                      cursor: idx === 0 ? "not-allowed" : "pointer",
                      flex: "0 0 auto",
                    }}
                  >← Prev</button>
                  <button onClick={handleSkip} style={{ ...secondaryBtnStyle, flex: 1 }}>Skip Trade</button>
                </div>
              </div>
            )}

            {revealed && (<>
            {insight && <InsightCard insight={insight} />}
            <div style={{
              fontSize: 12,
              color: "#a5b4fc",
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: 10,
              padding: "9px 12px",
              marginBottom: 18,
              fontWeight: 600,
            }}>
              Your answers here appear in <a href="/psychology" style={{ color: "#a5b4fc", textDecoration: "underline" }}>Psychology Tracker</a>
            </div>
            <FormBlock label="How did you feel on this trade?">
              <div className="replay-emotion-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                {EMOTION_KEYS.map((key) => {
                  const active = emotion === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setEmotion(active ? null : key)}
                      style={{
                        padding: "12px 6px",
                        borderRadius: 999,
                        border: `1px solid ${active ? "#6366f1" : "#1e2540"}`,
                        background: active ? "rgba(99,102,241,0.18)" : "transparent",
                        color: active ? "#a5b4fc" : "#9ca3af",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        boxShadow: active ? "0 0 0 2px rgba(99,102,241,0.25)" : "none",
                      }}
                    >
                      {EMOTION_LABELS[key]}
                    </button>
                  );
                })}
              </div>
            </FormBlock>
            <FormBlock label="Any mistakes? (tap all that apply)">
              <div className="replay-mistake-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                {MISTAKE_KEYS.map((key) => {
                  const active = mistakes.includes(key);
                  return (
                    <button
                      key={key}
                      onClick={() => setMistakes(active ? mistakes.filter(m => m !== key) : [...mistakes, key])}
                      style={{
                        padding: "12px 6px",
                        borderRadius: 999,
                        border: `1px solid ${active ? "#f43f5e" : "#1e2540"}`,
                        background: active ? "rgba(244,63,94,0.15)" : "transparent",
                        color: active ? "#f43f5e" : "#9ca3af",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        boxShadow: active ? "0 0 0 2px rgba(244,63,94,0.22)" : "none",
                      }}
                    >
                      {MISTAKE_LABELS[key]}
                    </button>
                  );
                })}
              </div>
            </FormBlock>
            <FormBlock label="Was this your setup?"><TriadRow value={matchedSetup} onChange={setMatchedSetup} /></FormBlock><FormBlock label="Did you follow your rules?"><TriadRow value={followedRules} onChange={setFollowedRules} /></FormBlock><FormBlock label={`Confidence — ${confidence}/10`}><ConfidenceDots value={confidence} onChange={setConfidence} /></FormBlock><FormBlock label="What would you do differently?"><textarea
                value={differently}
                onChange={(e) => setDifferently(e.target.value)}
                placeholder="One honest takeaway. Skip if nothing comes to mind."
                rows={3}
                style={{
                  width: "100%",
                  background: "#111118",
                  border: "1px solid #2a2a3a",
                  borderRadius: 10,
                  color: "#ffffff",
                  fontSize: 13,
                  padding: "10px 12px",
                  fontFamily: "inherit",
                  resize: "vertical",
                  outline: "none",
                  lineHeight: 1.5,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a3a")}
              /></FormBlock><FormBlock label="Trade Grade"><div className="replay-grade-grid" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
                {GRADE_LIST.map((g) => {
                  const active = grade === g;
                  const c = GRADE_COLOR[g];
                  return (
                    <button
                      key={g}
                      onClick={() => setGrade(g)}
                      style={{
                        padding: "12px 0",
                        borderRadius: 999,
                        border: `1px solid ${active ? c : "#1e2540"}`,
                        background: active ? c : "transparent",
                        color: active ? "#000" : c,
                        fontSize: 14,
                        fontWeight: 900,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        boxShadow: active ? `0 0 0 3px ${c}22` : "none",
                      }}
                    >
                      {g}
                    </button>
                  );
                })}
              </div></FormBlock>

            {/* actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}><button
                onClick={handlePrev}
                disabled={idx === 0}
                style={{
                  ...secondaryBtnStyle,
                  opacity: idx === 0 ? 0.4 : 1,
                  cursor: idx === 0 ? "not-allowed" : "pointer",
                  flex: "0 0 auto",
                }}
              >← Prev</button><button
                onClick={handleSkip}
                style={{ ...secondaryBtnStyle, flex: "0 0 auto" }}
              >Skip</button><button
                onClick={handleNext}
                disabled={!canAdvance}
                style={{
                  ...primaryBtnStyle,
                  flex: 1,
                  opacity: canAdvance ? 1 : 0.45,
                  cursor: canAdvance ? "pointer" : "not-allowed",
                }}
              >
                {idx + 1 >= total ? "Finish →" : "Next →"}
              </button></div>

            {!canAdvance && (
              <div style={{ marginTop: 10, fontSize: 11, color: "#4a5a7a" }}>Pick setup, rules, and a grade to continue.</div>
            )}
            </>)}
          </div></div></div>

      {zoomOpen && shot && (
        <ZoomModal src={shot} onClose={() => setZoomOpen(false)} />
      )}
    </div>
  );
}

// ───────────────────── sub-components ─────────────────────

function ChartArea({
  trade, shot, shotLoading, candles, chartLoading, chartError, onHover,
  entry, exit, pnl, isWin, isLoss, onZoom, revealed,
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
  onZoom: () => void;
  revealed: boolean;
}) {
  const HEIGHT = 500;

  // Chart is the primary experience when we have candles
  if (chartLoading) {
    return <ChartSkeleton height={HEIGHT} />;
  }

  if (candles && candles.length > 0) {
    return (
      <div style={{ position: "relative", background: "#060d1a", height: HEIGHT }}><CandleChart trade={trade} candles={candles} height={HEIGHT} onHover={onHover} revealed={revealed} /></div>
    );
  }

  // Fallback: screenshot
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
      }}><div style={{ fontSize: 36, opacity: 0.5 }}></div><div style={{ fontWeight: 700, color: "#9ca3af", fontSize: 13 }}>
          {chartError ? "No chart data available" : "No chart or screenshot"}
        </div><div style={{ fontSize: 11, color: "#2a2a3a", maxWidth: 360 }}>
          {chartError
            ? `Could not load candles (${chartError}). Attach a chart screenshot to see it here.`
            : "Attach a chart screenshot when logging trades to see it here."}
        </div></div>
    );
  }

  const pnlPositive = pnl >0;
 const pnlBg = pnlPositive
 ? "linear-gradient(135deg, #22d3a5, #10b981)"
 : pnl< 0
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
        style={{ width: "100%", height: HEIGHT, objectFit: "contain", background: "#060d1a", display: "block" }}
      />

      {/* Top fade — for PnL badge legibility */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 110,
        background: "linear-gradient(180deg, rgba(6,13,26,0.78) 0%, rgba(6,13,26,0.35) 55%, rgba(6,13,26,0) 100%)",
        pointerEvents: "none",
      }} />

      {/* Bottom fade — for entry/exit badge legibility */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 130,
        background: "linear-gradient(0deg, rgba(6,13,26,0.85) 0%, rgba(6,13,26,0.4) 55%, rgba(6,13,26,0) 100%)",
        pointerEvents: "none",
      }} />

      {/* PnL badge — top center (hidden until revealed) */}
      <div style={{
        position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
        padding: "10px 20px",
        borderRadius: 999,
        background: revealed ? pnlBg : "rgba(13,22,40,0.85)",
        color: revealed ? "#04121e" : "#4a5a7a",
        fontSize: 17,
        fontWeight: 900,
        letterSpacing: "-0.01em",
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        boxShadow: revealed ? `${pnlGlow}, inset 0 1px 0 rgba(255,255,255,0.25)` : "0 6px 20px rgba(0,0,0,0.4)",
        whiteSpace: "nowrap",
        border: revealed ? "1px solid rgba(255,255,255,0.18)" : "1px dashed #2a2a3a",
        opacity: revealed ? 1 : 0.85,
        transition: "background 0.4s ease, color 0.4s ease, opacity 0.4s ease, box-shadow 0.4s ease",
      }}>
        {revealed ? `${pnlPositive ? "+" : ""}${fmtMoney(pnl)}` : "?"}
      </div>

      {/* Zoom button — top right */}
      <button
        onClick={onZoom}
        aria-label="Zoom screenshot"
        style={{
          position: "absolute", top: 18, right: 18,
          padding: "8px 12px",
          borderRadius: 10,
          background: "rgba(13,22,40,0.78)",
          color: "#9ca3af",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.06em",
          border: "1px solid rgba(99,102,241,0.35)",
          cursor: "pointer",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          textTransform: "uppercase",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(99,102,241,0.18)";
          e.currentTarget.style.color = "#6366f1";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(13,22,40,0.78)";
          e.currentTarget.style.color = "#9ca3af";
        }}
      >Zoom</button>

      {/* Entry badge — bottom left */}
      {entry >0 && (<div style={{
          position: "absolute", bottom: 18, left: 18,
          padding: "9px 14px",
          borderRadius: 10,
          background: "linear-gradient(135deg, #22d3a5, #10b981)",
          color: "#04121e",
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: "0.02em",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          boxShadow: "0 6px 20px rgba(34,211,165,0.5), inset 0 1px 0 rgba(255,255,255,0.25)",
          border: "1px solid rgba(255,255,255,0.18)",
          whiteSpace: "nowrap",
        }}>
          ▲ ENTRY ${entry.toFixed(2)}
        </div>
      )}

      {/* Exit badge — bottom right (hidden until revealed) */}
      {exit > 0 && revealed && (<div style={{
          position: "absolute", bottom: 18, right: 18,
          padding: "9px 14px",
          borderRadius: 10,
          background: "linear-gradient(135deg, #f43f5e, #be123c)",
          color: "#1a0008",
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: "0.02em",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          boxShadow: "0 6px 20px rgba(244,63,94,0.5), inset 0 1px 0 rgba(255,255,255,0.25)",
          border: "1px solid rgba(255,255,255,0.18)",
          whiteSpace: "nowrap",
          animation: "slideInNext 0.4s cubic-bezier(0.22, 0.61, 0.36, 1) both",
        }}>
          ▼ EXIT ${exit.toFixed(2)}
        </div>
      )}
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
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 32,
        cursor: "zoom-out",
        animation: "nexyruZoomFade 0.22s ease-out both",
      }}
    ><style>{`
        @keyframes nexyruZoomFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style><button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          position: "fixed", top: 22, right: 24,
          padding: "10px 16px",
          borderRadius: 10,
          background: "rgba(13,22,40,0.85)",
          color: "#ffffff",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          border: "1px solid #1e2f4a",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
        }}
      >✕ Close · Esc</button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Trade screenshot — full size"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "100%", maxHeight: "100%",
          objectFit: "contain",
          borderRadius: 14,
          boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)",
          cursor: "default",
        }}
      /></div>
  );
}

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div style={{
      height,
      background: "#060d1a",
      position: "relative",
      overflow: "hidden",
    }}><style>{`
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
      {/* faux grid */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
        {[20, 40, 60, 80].map((p) =>(<div key={p} style={{
            position: "absolute", left: 0, right: 0, top: `${p}%`,
            height: 1, background: "rgba(26, 37, 64, 0.6)",
          }} />
        ))}
      </div>
      {/* faux candles */}
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
              style={{
                flex: 1,
                height: `${h}%`,
                minWidth: 4,
                animationDelay: `${delay}s`,
              }}
            />
          );
        })}
      </div>
      {/* faux volume */}
      <div style={{
        position: "absolute", left: 20, right: 70, bottom: 30,
        height: 70,
        display: "flex", alignItems: "flex-end", gap: 4,
      }}>
        {Array.from({ length: 40 }).map((_, i) => {
          const h = 20 + ((i * 53) % 70);
          const delay = (i * 0.05) % 1.4;
          return (
            <div
              key={i}
              className="nx-skel-bar"
              style={{
                flex: 1,
                height: `${h}%`,
                minWidth: 4,
                opacity: 0.45,
                animationDelay: `${delay}s`,
              }}
            />
          );
        })}
      </div><div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        color: "#1e3a5f",
        fontSize: 38,
        fontWeight: 900,
        letterSpacing: "0.4em",
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        animation: "nexyruPulse 1.6s ease-in-out infinite",
        pointerEvents: "none",
      }}>NEXYRU</div></div>
  );
}

function CandleChart({
  trade, candles, height, onHover, revealed,
}: {
  trade: Trade;
  candles: ChartRow[];
  height: number;
  onHover: (c: ChartRow | null) => void;
  revealed: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // entry/exit times computed once for shading + scroll
  const tradeMs =
    typeof trade.date === "number" ? trade.date : new Date(trade.date || 0).getTime();
  const tradeSec = isFinite(tradeMs) ? Math.floor(tradeMs / 1000) : 0;
  const entryPrice = Number(trade.entryPrice ?? 0);
  const exitPrice = Number(trade.exitPrice ?? 0);
  const pnl = Number(trade.pnl ?? 0);

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
          color: "#6366f1",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#0ea5e9",
        },
        horzLine: {
          color: "#6366f1",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#0ea5e9",
        },
      },
      width: container.clientWidth,
      height,
      autoSize: false,
    });

    // Watermark
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

    // Candles
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

    // Volume bottom 20%
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

    // Find entry index
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

    // Markers
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
    if (exitPrice > 0 && tradeSec > 0 && revealed) {
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

    // Price lines
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
    if (exitPrice > 0 && revealed) {
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

    // Auto-scroll: entry at ~60% from left
    const visibleSize = Math.min(60, candles.length);
    const fromIdx = entryIdx - Math.round(visibleSize * 0.6);
    const toIdx = entryIdx + Math.round(visibleSize * 0.4);
    chart.timeScale().setVisibleLogicalRange({ from: fromIdx, to: toIdx });

    // Crosshair → hover candle
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
  }, [candles, entryPrice, exitPrice, tradeSec, height, onHover, pnl, revealed]);

  return (
    <div style={{ position: "relative", height, background: "#060d1a" }}><div ref={containerRef} style={{ width: "100%", height }} /></div>
  );
}

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
    >
      {label}
    </button>
  );
}

function OhlcRow({ candle }: { candle: ChartRow | null }) {
  const wrap: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
    fontSize: 11,
    fontWeight: 700,
    color: "#6b7280",
    letterSpacing: "0.02em",
    minHeight: 18,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  if (!candle) {
    return (
      <div style={{ ...wrap, color: "#2a2a3a", fontSize: 10, fontWeight: 600 }}>↕ hover for OHLC</div>
    );
  }

  const up = candle.close >= candle.open;
  const cColor = up ? "#10b981" : "#ef4444";
  const change = candle.close - candle.open;
  const changePct = candle.open !== 0 ? (change / candle.open) * 100 : 0;
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });

  const pair = (k: string, v: string, c?: string) =>(<span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}><span style={{ color: "#4a5a7a" }}>{k}</span><span style={{ color: c || "#9ca3af" }}>{v}</span></span>);

 return (<div style={wrap}>
      {pair("O", fmt(candle.open))}
      {pair("H", fmt(candle.high), "#10b981")}
      {pair("L", fmt(candle.low), "#ef4444")}
      {pair("C", fmt(candle.close), cColor)}
      <span style={{ color: cColor, fontSize: 10 }}>
        {change >= 0 ? "+" : ""}{fmt(change)} ({changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%)
      </span></div>
  );
}

function StatCell({ label, value, color }: { label: string; value: React.ReactNode; color: string }) {
  return (
    <div style={{ minWidth: 0 }}><div style={{
        fontSize: 9,
        fontWeight: 700,
        color: "#4a5a7a",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        marginBottom: 4,
      }}>
        {label}
      </div><div style={{
        fontSize: 15,
        fontWeight: 900,
        color,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        letterSpacing: "-0.01em",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>
        {value}
      </div></div>
  );
}

function ProgressBar({
  idx, total, pct, sessionGrade, streak, streakFlash, done,
}: { idx: number; total: number; pct: number; sessionGrade: Grade | null; streak?: number; streakFlash?: number | null; done?: boolean }) {
  return (
    <div>
      <style>{`
        @keyframes streakFlash {
          0% { transform: scale(1); color: #f59e0b; }
          30% { transform: scale(1.35); color: #fbbf24; text-shadow: 0 0 18px rgba(251,191,36,0.7); }
          100% { transform: scale(1); color: #f59e0b; text-shadow: none; }
        }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/dashboard" style={{ fontSize: 11, color: "#4a5a7a", textDecoration: "none", fontWeight: 600 }}>← Dashboard</a>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#ffffff", letterSpacing: "0.04em" }}>Trade Replay</div>
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 8 }}>
          <span>Trade {done ? total : idx + 1} of {total}</span>
          {typeof streak === "number" && streak > 0 && (
            <>
              <span style={{ color: "#1e2540" }}>·</span>
              <span
                key={streakFlash ?? streak}
                style={{
                  color: "#f59e0b",
                  fontWeight: 900,
                  animation: streakFlash ? "streakFlash 0.9s ease-out" : undefined,
                  display: "inline-block",
                }}
              >🔥 {streak} streak</span>
            </>
          )}
          {sessionGrade && (
            <><span style={{ color: "#1e2540" }}>·</span><span>Session Grade:{" "}
                <span style={{ color: GRADE_COLOR[sessionGrade], fontWeight: 900 }}>{sessionGrade}</span></span></>
          )}
        </div>
      </div>
      <div style={{
        height: 6,
        background: "#111118",
        border: "1px solid #2a2a3a",
        borderRadius: 999,
        overflow: "hidden",
      }}><div style={{
          width: `${pct}%`,
          height: "100%",
          background: "linear-gradient(90deg,#22d3a5,#6366f1)",
          transition: "width 0.4s ease",
        }} /></div>
    </div>
  );
}

function TopProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0,
      height: 3,
      background: "#0a0a0f",
      zIndex: 100,
      pointerEvents: "none",
    }}>
      <div style={{
        width: `${Math.max(0, Math.min(100, pct))}%`,
        height: "100%",
        background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
        boxShadow: "0 0 12px rgba(99,102,241,0.6)",
        transition: "width 0.5s cubic-bezier(0.22, 0.61, 0.36, 1)",
      }} />
    </div>
  );
}

function TriadRow({ value, onChange, big }: { value: Triad | null; onChange: (v: Triad) => void; big?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <TriadBtn label="Yes"     active={value === "yes"}     color="#22d3a5" big={big} onClick={() => onChange("yes")} />
      <TriadBtn label="Partial" active={value === "partial"} color="#f59e0b" big={big} onClick={() => onChange("partial")} />
      <TriadBtn label="No"      active={value === "no"}      color="#f43f5e" big={big} onClick={() => onChange("no")} />
    </div>
  );
}

function TriadBtn({
  label, active, color, onClick, big,
}: { label: string; active: boolean; color: string; onClick: () => void; big?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: big ? "0 10px" : "11px 10px",
        minHeight: big ? 56 : undefined,
        borderRadius: big ? 14 : 10,
        border: `1px solid ${active ? color : "#1e2540"}`,
        background: active ? `${color}22` : "transparent",
        color: active ? color : "#9ca3af",
        fontSize: big ? 14 : 12,
        fontWeight: 800,
        cursor: "pointer",
        transition: "all 0.15s",
        boxShadow: active && big ? `0 0 0 2px ${color}33` : "none",
      }}
    >
      {label}
    </button>
  );
}

function QuickConfidenceDots({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      {Array.from({ length: 5 }, (_, i) => i + 1).map((n) => {
        const filled = n <= value;
        return (
          <button
            key={n}
            onClick={() => onChange(n)}
            aria-label={`Set confidence to ${n}`}
            style={{
              flex: 1,
              minWidth: 0,
              aspectRatio: "1 / 1",
              maxWidth: 56,
              borderRadius: "50%",
              border: `1px solid ${filled ? "#6366f1" : "#1e2540"}`,
              background: filled ? "#6366f1" : "transparent",
              color: filled ? "#fff" : "#4a5a7a",
              fontSize: 14,
              fontWeight: 800,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              cursor: "pointer",
              padding: 0,
              transition: "all 0.12s",
              boxShadow: filled && n === value ? "0 0 0 3px #6366f133" : "none",
            }}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function ConfidenceDots({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const filled = n <= value;
        return (
          <button
            key={n}
            onClick={() => onChange(n)}
            aria-label={`Set confidence to ${n}`}
            style={{
              flex: 1,
              minWidth: 0,
              aspectRatio: "1 / 1",
              borderRadius: "50%",
              border: `1px solid ${filled ? "#6366f1" : "#1e2540"}`,
              background: filled ? "#6366f1" : "transparent",
              cursor: "pointer",
              padding: 0,
              transition: "all 0.12s",
              boxShadow: filled && n === value ? "0 0 0 3px #6366f133" : "none",
            }}
          />
        );
      })}
    </div>
  );
}

function FormBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}><div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", marginBottom: 8, letterSpacing: "0.02em" }}>
        {label}
      </div>
      {children}
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
      borderRadius: 14,
      padding: "16px 18px",
    }}><div style={{ fontSize: 10, fontWeight: 700, color: "#4a5a7a", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </div><div style={{
        fontSize: big ? 38 : 26,
        fontWeight: 900,
        color,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        lineHeight: 1.1,
      }}>
        {value}
      </div></div>
  );
}

function BestWorstCard({ label, trade, positive }: { label: string; trade: Trade | null; positive: boolean }) {
  const color = positive ? "#22d3a5" : "#f43f5e";
  if (!trade) {
    return (
      <div style={{ background: "#111118", border: `1px solid ${color}22`, borderRadius: 14, padding: "16px 18px" }}><div style={{ fontSize: 10, fontWeight: 700, color: "#4a5a7a", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
          {label}
        </div><div style={{ fontSize: 13, color: "#4a5a7a" }}>—</div></div>
    );
  }
  const pnl = Number(trade.pnl ?? 0);
  return (
    <div style={{ background: "#111118", border: `1px solid ${color}44`, borderRadius: 14, padding: "16px 18px" }}><div style={{ fontSize: 10, fontWeight: 700, color: "#4a5a7a", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </div><div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}><div style={{ fontSize: 16, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.01em" }}>
          {trade.pair || trade.symbol || "—"}
        </div><div style={{
          fontSize: 16, fontWeight: 900, color,
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
        }}>
          {pnl > 0 ? "+" : ""}{fmtMoney(pnl)}
        </div></div><div style={{ fontSize: 10, color: "#4a5a7a", marginTop: 4 }}>
        {fmtDate(trade.date)} · {(trade.type || "").toString().toUpperCase()}
      </div></div>
  );
}

function pctColor(p: number) {
  return p >= 70 ? "#22d3a5" : p >= 40 ? "#f59e0b" : "#f43f5e";
}

// ───────────────────── session picker ─────────────────────

function SessionPicker({
  totalTrades, lastSessionCount, customSize, onCustomSizeChange, onStart,
}: {
  totalTrades: number;
  lastSessionCount: number;
  customSize: number;
  onCustomSizeChange: (n: number) => void;
  onStart: (type: SessionType, sizeOverride?: number) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const maxCustom = Math.min(totalTrades, 50);

  return (
    <div style={shellStyle}>
      <style>{`
        @keyframes nxPickerIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .nx-session-card {
          background: #111118;
          border: 1px solid #1e2f4a;
          border-radius: 18px;
          padding: 22px 22px;
          text-align: left;
          cursor: pointer;
          transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
          display: flex;
          flex-direction: column;
          gap: 8px;
          color: inherit;
          font-family: inherit;
        }
        .nx-session-card:hover {
          transform: translateY(-3px);
          border-color: rgba(99,102,241,0.55);
          box-shadow: 0 12px 36px rgba(99,102,241,0.18);
        }
        .nx-session-card:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
      <div style={{ width: "100%", maxWidth: 760, animation: "nxPickerIn 0.32s ease-out" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href="/dashboard" style={{ fontSize: 11, color: "#4a5a7a", textDecoration: "none", fontWeight: 600 }}>← Dashboard</a>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#ffffff", letterSpacing: "0.04em" }}>Trade Replay</div>
          </div>
          <div style={{ fontSize: 11, color: "#4a5a7a", fontWeight: 700, fontFamily: "monospace" }}>
            {totalTrades} trades available
          </div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}>
          Pick a session
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#ffffff", marginBottom: 22, letterSpacing: "-0.01em" }}>
          What do you want to review today?
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          <button className="nx-session-card" onClick={() => onStart("quick")}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#22d3a5", letterSpacing: "0.04em" }}>Quick Review</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#ffffff" }}>5 random trades</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>~3 minutes. Spot patterns across your whole history.</div>
          </button>

          <button
            className="nx-session-card"
            onClick={() => onStart("last")}
            disabled={lastSessionCount === 0}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: "#6366f1", letterSpacing: "0.04em" }}>Last Session</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#ffffff" }}>Most recent trading day</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              {lastSessionCount === 0 ? "No trades found." : `${lastSessionCount} trade${lastSessionCount === 1 ? "" : "s"} to review.`}
            </div>
          </button>

          <button className="nx-session-card" onClick={() => onStart("worst")}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#f43f5e", letterSpacing: "0.04em" }}>Worst Trades</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#ffffff" }}>Your 5 biggest losses</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>Learn from the trades that hurt the most.</div>
          </button>

          <button
            className="nx-session-card"
            onClick={() => setShowCustom((v) => !v)}
            style={showCustom ? { borderColor: "rgba(99,102,241,0.55)" } : undefined}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: "#a5b4fc", letterSpacing: "0.04em" }}>Custom</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#ffffff" }}>Pick how many</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>Choose 1–{maxCustom} most-recent trades.</div>
          </button>
        </div>

        {showCustom && (
          <div style={{ ...cardStyle, marginTop: 14, padding: "18px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", marginBottom: 10, letterSpacing: "0.02em" }}>
              How many recent trades? — {customSize}
            </div>
            <input
              type="range"
              min={1}
              max={maxCustom}
              value={Math.min(customSize, maxCustom)}
              onChange={(e) => onCustomSizeChange(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#6366f1" }}
            />
            <button
              onClick={() => onStart("custom", customSize)}
              style={{
                ...primaryBtnStyle,
                width: "100%",
                padding: "16px 20px",
                minHeight: 56,
                fontSize: 14,
                marginTop: 12,
              }}
            >
              Start Custom Session →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const palette = {
    good:    { bg: "linear-gradient(135deg, rgba(34,211,165,0.22), rgba(16,185,129,0.18))", border: "rgba(34,211,165,0.55)", accent: "#22d3a5" },
    warning: { bg: "linear-gradient(135deg, rgba(245,158,11,0.22), rgba(217,119,6,0.18))", border: "rgba(245,158,11,0.55)", accent: "#f59e0b" },
    bad:     { bg: "linear-gradient(135deg, rgba(244,63,94,0.22), rgba(190,18,60,0.18))", border: "rgba(244,63,94,0.55)", accent: "#f43f5e" },
  }[insight.tone];
  return (
    <div style={{
      animation: "nxInsightFade 0.5s ease-out both",
      background: palette.bg,
      border: `1px solid ${palette.border}`,
      borderRadius: 14,
      padding: "14px 16px",
      marginBottom: 16,
      display: "flex",
      alignItems: "center",
      gap: 12,
    }}>
      <style>{`
        @keyframes nxInsightFade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{
        width: 6, alignSelf: "stretch",
        borderRadius: 999,
        background: palette.accent,
        boxShadow: `0 0 12px ${palette.accent}`,
      }} />
      <div style={{
        fontSize: 16,
        fontWeight: 700,
        color: "#ffffff",
        lineHeight: 1.4,
      }}>{insight.message}</div>
    </div>
  );
}

function SessionSummaryView({
  summary, onShare, shareCopied, onReviewAgain,
}: {
  summary: { total: number; correct: number; score: number; lossesOutsideSetup: number; lossesTotal: number; confInsight: string };
  onShare: () => void;
  shareCopied: boolean;
  onReviewAgain: () => void;
}) {
  const scoreColor = summary.score >= 80 ? "#22d3a5" : summary.score >= 60 ? "#f59e0b" : "#f43f5e";
  const lossPct = summary.lossesTotal ? Math.round((summary.lossesOutsideSetup / summary.lossesTotal) * 100) : 0;

  return (
    <>
      <div style={{
        marginTop: 18,
        padding: "28px 24px",
        background: "linear-gradient(135deg, #111118, #0a0a0f)",
        border: `1px solid ${scoreColor}55`,
        borderRadius: 18,
        textAlign: "center",
        boxShadow: `0 0 60px ${scoreColor}22`,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#4a5a7a", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8 }}>
          Your Score
        </div>
        <div style={{
          fontSize: 88,
          fontWeight: 900,
          color: scoreColor,
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          lineHeight: 1,
          letterSpacing: "-0.04em",
          textShadow: `0 0 40px ${scoreColor}44`,
        }}>
          {summary.score}
          <span style={{ fontSize: 28, color: "#4a5a7a", fontWeight: 700 }}>/100</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 18 }}>
        <InsightStatCard
          accent="#22d3a5"
          label="Setup Accuracy"
          value={`You correctly identified ${summary.correct}/${summary.total} trades.`}
        />
        <InsightStatCard
          accent="#6366f1"
          label="Confidence Calibration"
          value={`Your confidence was highest on ${summary.confInsight}.`}
        />
        <InsightStatCard
          accent="#f43f5e"
          label="Pattern Spotted"
          value={
            summary.lossesTotal
              ? `${summary.lossesOutsideSetup} out of ${summary.lossesTotal} losing trades (${lossPct}%) were outside your setup.`
              : "No losses in this session — nice run."
          }
        />
      </div>

      <button
        onClick={onShare}
        style={{
          marginTop: 18,
          width: "100%",
          padding: "16px 20px",
          minHeight: 56,
          borderRadius: 14,
          border: "1px solid rgba(99,102,241,0.45)",
          background: shareCopied ? "rgba(34,211,165,0.15)" : "rgba(99,102,241,0.12)",
          color: shareCopied ? "#22d3a5" : "#a5b4fc",
          fontSize: 13,
          fontWeight: 800,
          cursor: "pointer",
          letterSpacing: "0.04em",
          transition: "all 0.18s",
        }}
      >
        {shareCopied ? "✓ Copied to clipboard" : "Share Session"}
      </button>

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={onReviewAgain} style={{ ...primaryBtnStyle, flex: "1 1 200px", minHeight: 56 }}>Review Again</button>
        <a href="/dashboard" style={{ ...secondaryBtnStyle, flex: "1 1 140px", textAlign: "center", minHeight: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>Back to Dashboard</a>
      </div>
    </>
  );
}

function InsightStatCard({ accent, label, value }: { accent: string; label: string; value: string }) {
  return (
    <div style={{
      background: "#111118",
      border: `1px solid ${accent}33`,
      borderRadius: 14,
      padding: "16px 18px",
      display: "flex",
      gap: 14,
      alignItems: "center",
    }}>
      <div style={{
        width: 4, alignSelf: "stretch",
        borderRadius: 999,
        background: accent,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#4a5a7a", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 14, color: "#ffffff", fontWeight: 600, lineHeight: 1.45 }}>
          {value}
        </div>
      </div>
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

const slideAnimCSS = `
@keyframes slideInNext {
  from { transform: translateX(24px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
@keyframes slideInPrev {
  from { transform: translateX(-24px); opacity: 0; }
  to   { transform: translateX(0);     opacity: 1; }
}
`;
