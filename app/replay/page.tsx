"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Sidebar from "@/components/Sidebar";

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
}

type SetupAnswer = "yes" | "partial" | "no";
type Grade = "A" | "B" | "C" | "D" | "F";
type SessionType = "quick" | "last" | "worst" | "all";
type Phase = "picker" | "review" | "done";

const EMOTIONS = [
  "Neutral", "Confident", "FOMO", "Fearful",
  "Revenge", "Greedy", "Frustrated", "Bored",
];

interface Review {
  tradeId: string;
  setup: SetupAnswer | null;
  clarity: number | null;
  emotion: string | null;
  grade: Grade | null;
  notes: string;
  pnl: number;
  reviewedAt: number;
}

interface SessionSummary {
  type: SessionType;
  count: number;
  setupAccuracy: number;
  avgClarity: number;
  mostCommonEmotion: string | null;
  keyInsight: string;
  totalPnl: number;
  savedAt: number;
}

// ───────────────────────── storage ─────────────────────────

const SESSION_KEY = "tradedesk_session_v1";
const tradesKey = (u: string) => `tradedesk_trades_${u}_v1`;
const reviewsKey = (u: string) => `nexyru_reviews_${u}`;
const sessionsKey = (u: string) => `nexyru_review_sessions_${u}`;

// ───────────────────────── screenshot loading (IDB) ─────────────────────────

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

// ───────────────────────── helpers ─────────────────────────

function getTradeMs(t: Trade): number {
  if (typeof t.date === "number") return t.date;
  if (typeof t.date === "string") {
    const v = new Date(t.date).getTime();
    return isNaN(v) ? 0 : v;
  }
  return 0;
}

function fmtDate(v: number | string | undefined) {
  if (!v) return "—";
  const d = new Date(typeof v === "number" ? v : v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function fmtShortDate(v: number | string | undefined) {
  if (!v) return "—";
  const d = new Date(typeof v === "number" ? v : v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric" });
}

function fmtMoney(n: number | undefined) {
  if (n === undefined || n === null || isNaN(Number(n))) return "$0.00";
  const v = Number(n);
  const sign = v < 0 ? "-" : v > 0 ? "+" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

function fmtPrice(n: number | string | undefined) {
  if (n === undefined || n === null || n === "") return "—";
  const v = Number(n);
  if (isNaN(v)) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function pickQuickReview(trades: Trade[]): Trade[] {
  const pool = trades.filter((t) => Number.isFinite(getTradeMs(t)) && getTradeMs(t) > 0);
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(5, shuffled.length));
}

function pickLastSession(trades: Trade[]): Trade[] {
  if (!trades.length) return [];
  const sorted = [...trades].sort((a, b) => getTradeMs(b) - getTradeMs(a));
  const latest = getTradeMs(sorted[0]);
  if (!latest) return [];
  const dayStart = new Date(latest).setHours(0, 0, 0, 0);
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  return sorted.filter((t) => {
    const tm = getTradeMs(t);
    return tm >= dayStart && tm < dayEnd;
  });
}

function pickWorstTrades(trades: Trade[]): Trade[] {
  return [...trades]
    .filter((t) => Number.isFinite(Number(t.pnl)) && Number(t.pnl) < 0)
    .sort((a, b) => Number(a.pnl ?? 0) - Number(b.pnl ?? 0))
    .slice(0, Math.min(5, trades.length));
}

function computeInsight(setup: SetupAnswer | null, clarity: number | null, pnl: number): {
  text: string;
  tone: "green" | "yellow" | "red" | "orange" | "blue";
} {
  const profitable = pnl > 0;
  const loss = pnl < 0;

  if (setup === "yes" && profitable) {
    return { text: "Clean execution. This is exactly the kind of trade to repeat.", tone: "green" };
  }
  if (setup === "yes" && loss) {
    return { text: "Good process, bad outcome. Losses happen — what matters is the setup was right.", tone: "yellow" };
  }
  if (setup === "no" && profitable) {
    return { text: "Lucky this time — but trades outside your setup will hurt you long term.", tone: "yellow" };
  }
  if (setup === "no" && loss) {
    return { text: "Outside your setup AND a loss. This is the pattern to break.", tone: "red" };
  }
  if (clarity !== null && clarity >= 4 && loss) {
    return { text: "High confidence on a losing trade — worth reflecting on what you missed.", tone: "orange" };
  }
  if (clarity !== null && clarity <= 2 && profitable) {
    return { text: "Low confidence but it worked — can you identify why the setup was actually valid?", tone: "blue" };
  }
  if (setup === "partial" && profitable) {
    return { text: "Partial setup, profitable outcome. Refine what made this work next time.", tone: "yellow" };
  }
  if (setup === "partial" && loss) {
    return { text: "Partial setup, loss. Either wait for the full setup or refine your criteria.", tone: "orange" };
  }
  return { text: "Every trade is data. Keep reviewing.", tone: "blue" };
}

const TONE_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  green:  { border: "#10b981", bg: "rgba(16,185,129,0.08)",  text: "#a7f3d0" },
  yellow: { border: "#eab308", bg: "rgba(234,179,8,0.08)",   text: "#fde68a" },
  red:    { border: "#ef4444", bg: "rgba(239,68,68,0.08)",   text: "#fca5a5" },
  orange: { border: "#f97316", bg: "rgba(249,115,22,0.08)",  text: "#fed7aa" },
  blue:   { border: "#3b82f6", bg: "rgba(59,130,246,0.08)",  text: "#bfdbfe" },
};

const GRADE_COLORS: Record<Grade, string> = {
  A: "#10b981",
  B: "#65a30d",
  C: "#eab308",
  D: "#f97316",
  F: "#ef4444",
};

// ───────────────────────── page ─────────────────────────

export default function ReviewPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#080808" }}>
      <Sidebar activePath="/replay" />
      <main style={{ flex: 1, marginLeft: 56 }}>
        <ReviewPageInner />
      </main>
    </div>
  );
}

function ReviewPageInner() {
  const [username, setUsername] = useState<string | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const [phase, setPhase] = useState<Phase>("picker");
  const [sessionType, setSessionType] = useState<SessionType>("quick");
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);

  // per-trade answers
  const [setup, setSetup] = useState<SetupAnswer | null>(null);
  const [clarity, setClarity] = useState<number | null>(null);
  const [emotion, setEmotion] = useState<string | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [notes, setNotes] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [pnlDisplay, setPnlDisplay] = useState(0);

  // session results buffer
  const [sessionReviews, setSessionReviews] = useState<Review[]>([]);

  // ui
  const [shot, setShot] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [transitionKey, setTransitionKey] = useState(0);

  // ── load ──
  useEffect(() => {
    try {
      const sess = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
      const u = sess?.username || null;
      setUsername(u);
      if (!u) { setLoading(false); return; }
      const raw = localStorage.getItem(tradesKey(u));
      const all: Trade[] = raw ? JSON.parse(raw) || [] : [];
      setTrades(all);
    } catch (e) {
      console.warn("trade review load failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const sessionTrades = useMemo(() => {
    if (!sessionIds.length) return [];
    const byId: Record<string, Trade> = {};
    for (const t of trades) byId[t.id] = t;
    return sessionIds.map((id) => byId[id]).filter(Boolean) as Trade[];
  }, [sessionIds, trades]);

  const current = sessionTrades[idx];

  // load screenshot for current trade
  useEffect(() => {
    if (!current) { setShot(null); return; }
    let cancelled = false;
    setShot(null);
    loadShot(current.id).then((url) => {
      if (!cancelled) setShot(url);
    });
    return () => { cancelled = true; };
  }, [current?.id]);

  // count-up animation on reveal
  useEffect(() => {
    if (!revealed || !current) return;
    const target = Number(current.pnl) || 0;
    const dur = 700;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setPnlDisplay(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [revealed, current?.id]);

  // ── derived for picker ──
  const lastSession = useMemo(() => pickLastSession(trades), [trades]);
  const worstTrades = useMemo(() => pickWorstTrades(trades), [trades]);
  const worstTotalLoss = useMemo(
    () => worstTrades.reduce((s, t) => s + (Number(t.pnl) || 0), 0),
    [worstTrades]
  );
  const lastSessionDate = lastSession[0] ? fmtShortDate(getTradeMs(lastSession[0])) : "—";

  // ── start session ──
  const startSession = useCallback((type: SessionType) => {
    let selected: Trade[] = [];
    if (type === "quick") selected = pickQuickReview(trades);
    else if (type === "last") selected = lastSession;
    else if (type === "worst") selected = worstTrades;
    else if (type === "all") selected = [...trades].sort((a, b) => getTradeMs(b) - getTradeMs(a));
    if (!selected.length) return;
    setSessionType(type);
    setSessionIds(selected.map((t) => t.id));
    setIdx(0);
    setSessionReviews([]);
    resetTradeState();
    setPhase("review");
    setTransitionKey((k) => k + 1);
  }, [trades, lastSession, worstTrades]);

  const resetTradeState = () => {
    setSetup(null);
    setClarity(null);
    setEmotion(null);
    setGrade(null);
    setNotes("");
    setRevealed(false);
    setPnlDisplay(0);
  };

  const endSession = () => {
    setPhase("picker");
    setSessionIds([]);
    resetTradeState();
  };

  // ── save review for current trade ──
  const saveCurrentReview = (): Review | null => {
    if (!current || !username) return null;
    const review: Review = {
      tradeId: current.id,
      setup,
      clarity,
      emotion,
      grade,
      notes: notes.trim(),
      pnl: Number(current.pnl) || 0,
      reviewedAt: Date.now(),
    };
    try {
      const raw = localStorage.getItem(reviewsKey(username));
      const arr: Review[] = raw ? JSON.parse(raw) || [] : [];
      arr.push(review);
      localStorage.setItem(reviewsKey(username), JSON.stringify(arr));
    } catch (e) {
      console.warn("save review failed", e);
    }
    return review;
  };

  const goNextTrade = (review: Review | null) => {
    const updated = review ? [...sessionReviews, review] : sessionReviews;
    setSessionReviews(updated);
    if (idx + 1 >= sessionTrades.length) {
      finishSession(updated);
    } else {
      setIdx(idx + 1);
      resetTradeState();
      setTransitionKey((k) => k + 1);
    }
  };

  const finishSession = (reviews: Review[]) => {
    if (!username) { setPhase("done"); return; }
    const summary = buildSessionSummary(sessionType, reviews);
    try {
      const raw = localStorage.getItem(sessionsKey(username));
      const arr: SessionSummary[] = raw ? JSON.parse(raw) || [] : [];
      arr.push(summary);
      localStorage.setItem(sessionsKey(username), JSON.stringify(arr));
    } catch (e) {
      console.warn("save session failed", e);
    }
    setPhase("done");
  };

  const sessionSummary = useMemo(
    () => buildSessionSummary(sessionType, sessionReviews),
    [sessionType, sessionReviews]
  );

  // ── render ──

  if (loading) {
    return <CenterMsg>Loading…</CenterMsg>;
  }
  if (!username) {
    return <CenterMsg>Sign in to review your trades.</CenterMsg>;
  }
  if (!trades.length) {
    return (
      <CenterMsg>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: "#fff" }}>No trades yet</h2>
          <p style={{ color: "#888", fontSize: 14 }}>Log some trades first to start reviewing.</p>
        </div>
      </CenterMsg>
    );
  }

  if (phase === "picker") {
    return (
      <Picker
        totalCount={trades.length}
        lastSession={lastSession}
        lastSessionDate={lastSessionDate}
        worstTrades={worstTrades}
        worstTotalLoss={worstTotalLoss}
        onStart={startSession}
      />
    );
  }

  if (phase === "done") {
    return (
      <Complete
        summary={sessionSummary}
        onReview={() => setPhase("picker")}
      />
    );
  }

  // phase === "review"
  if (!current) {
    return <CenterMsg>Trade not found.</CenterMsg>;
  }

  return (
    <ReviewScreen
      key={transitionKey}
      trade={current}
      idx={idx}
      total={sessionTrades.length}
      sessionType={sessionType}
      setup={setup}
      setSetup={setSetup}
      clarity={clarity}
      setClarity={setClarity}
      emotion={emotion}
      setEmotion={setEmotion}
      grade={grade}
      setGrade={setGrade}
      notes={notes}
      setNotes={setNotes}
      revealed={revealed}
      setRevealed={setRevealed}
      pnlDisplay={pnlDisplay}
      shot={shot}
      onZoom={() => setZoom(true)}
      onEnd={endSession}
      onSave={() => {
        const r = saveCurrentReview();
        goNextTrade(r);
      }}
      onSkip={() => goNextTrade(null)}
      zoom={zoom}
      onCloseZoom={() => setZoom(false)}
    />
  );
}

// ───────────────────────── session summary ─────────────────────────

const SESSION_LABEL: Record<SessionType, string> = {
  quick: "Quick Review",
  last: "Last Session",
  worst: "Worst Trades",
  all: "All Trades",
};

function buildSessionSummary(type: SessionType, reviews: Review[]): SessionSummary {
  const count = reviews.length;
  const setupYes = reviews.filter((r) => r.setup === "yes").length;
  const setupAccuracy = count ? setupYes / count : 0;
  const clarityValues = reviews.map((r) => r.clarity).filter((c): c is number => c !== null);
  const avgClarity = clarityValues.length
    ? clarityValues.reduce((s, v) => s + v, 0) / clarityValues.length
    : 0;

  const emotionCounts: Record<string, number> = {};
  for (const r of reviews) {
    if (r.emotion) emotionCounts[r.emotion] = (emotionCounts[r.emotion] || 0) + 1;
  }
  let mostCommonEmotion: string | null = null;
  let mostCount = 0;
  for (const [e, c] of Object.entries(emotionCounts)) {
    if (c > mostCount) { mostCount = c; mostCommonEmotion = e; }
  }

  const losses = reviews.filter((r) => r.pnl < 0);
  const lossesOutsideSetup = losses.filter((r) => r.setup === "no");
  const highConfidenceLosses = losses.filter((r) => (r.clarity ?? 0) >= 4);
  const totalPnl = reviews.reduce((s, r) => s + r.pnl, 0);

  let keyInsight = "Every session of review is progress.";
  if (count > 0) {
    if (setupYes === count && count >= 3) {
      keyInsight = `${count === count ? "100%" : ""} setup accuracy this session. Your discipline is showing.`;
    } else if (lossesOutsideSetup.length >= 2 && losses.length) {
      const recoverable = Math.abs(
        lossesOutsideSetup.reduce((s, r) => s + r.pnl, 0)
      );
      keyInsight = `${lossesOutsideSetup.length} of ${losses.length} losses were outside your setup. Sticking to your setup could add ${fmtMoney(recoverable).replace("+", "")} to your results.`;
    } else if (highConfidenceLosses.length >= 2) {
      keyInsight = `You had high confidence on ${highConfidenceLosses.length} losing trades. Consider being more selective.`;
    } else if (setupAccuracy >= 0.8) {
      keyInsight = `${Math.round(setupAccuracy * 100)}% setup accuracy this session. Your discipline is showing.`;
    } else if (setupAccuracy < 0.5 && count >= 3) {
      keyInsight = `Only ${Math.round(setupAccuracy * 100)}% of trades were your setup. Tighten your entry criteria.`;
    }
  }

  return {
    type,
    count,
    setupAccuracy,
    avgClarity,
    mostCommonEmotion,
    keyInsight,
    totalPnl,
    savedAt: Date.now(),
  };
}

// ───────────────────────── picker screen ─────────────────────────

function Picker({
  totalCount,
  lastSession,
  lastSessionDate,
  worstTrades,
  worstTotalLoss,
  onStart,
}: {
  totalCount: number;
  lastSession: Trade[];
  lastSessionDate: string;
  worstTrades: Trade[];
  worstTotalLoss: number;
  onStart: (t: SessionType) => void;
}) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 880 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{
            fontSize: 40,
            fontWeight: 800,
            color: "#fff",
            margin: 0,
            letterSpacing: "-0.02em",
          }}>
            Trade Review
          </h1>
          <p style={{
            color: "#888",
            fontSize: 15,
            marginTop: 10,
          }}>
            Learn from your trades in under 5 minutes
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 16,
        }}>
          <PickerCard
            title="Quick Review"
            description="5 random trades · ~3 minutes"
            buttonLabel="Start"
            disabled={totalCount === 0}
            onClick={() => onStart("quick")}
          />
          <PickerCard
            title="Last Session"
            description="Your most recent trading day"
            meta={lastSession.length ? `${lastSessionDate} · ${lastSession.length} trade${lastSession.length === 1 ? "" : "s"}` : "No trades yet"}
            buttonLabel="Start"
            disabled={lastSession.length === 0}
            onClick={() => onStart("last")}
          />
          <PickerCard
            title="Worst Trades"
            description="Your 5 biggest losses"
            meta={worstTrades.length ? fmtMoney(worstTotalLoss) : "No losses logged"}
            metaColor="#ef4444"
            buttonLabel="Review"
            disabled={worstTrades.length === 0}
            onClick={() => onStart("worst")}
          />
          <PickerCard
            title="All Trades"
            description={`Review everything · ${totalCount} trade${totalCount === 1 ? "" : "s"} total`}
            buttonLabel="Start"
            disabled={totalCount === 0}
            onClick={() => onStart("all")}
          />
        </div>
      </div>
    </div>
  );
}

function PickerCard({
  title,
  description,
  meta,
  metaColor,
  buttonLabel,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  meta?: string;
  metaColor?: string;
  buttonLabel: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "#111111",
        border: `1px solid ${hover && !disabled ? "#2a2a2a" : "#1e1e1e"}`,
        borderRadius: 12,
        padding: 24,
        transition: "transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease",
        transform: hover && !disabled ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hover && !disabled ? "0 12px 32px rgba(0,0,0,0.4)" : "none",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <div>
        <h3 style={{
          color: "#fff",
          fontSize: 20,
          fontWeight: 700,
          margin: 0,
          marginBottom: 6,
        }}>
          {title}
        </h3>
        <div style={{ color: "#888", fontSize: 13.5 }}>{description}</div>
        {meta && (
          <div style={{
            color: metaColor || "#9ca3af",
            fontSize: 13,
            marginTop: 8,
            fontWeight: 600,
          }}>
            {meta}
          </div>
        )}
      </div>
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          marginTop: "auto",
          alignSelf: "flex-start",
          padding: "10px 18px",
          borderRadius: 8,
          background: disabled ? "#1a1a1a" : "#6366f1",
          color: disabled ? "#555" : "#fff",
          border: "none",
          fontSize: 14,
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "background 0.15s ease",
        }}
      >
        {buttonLabel} →
      </button>
    </div>
  );
}

// ───────────────────────── review screen ─────────────────────────

function ReviewScreen({
  trade,
  idx,
  total,
  sessionType,
  setup,
  setSetup,
  clarity,
  setClarity,
  emotion,
  setEmotion,
  grade,
  setGrade,
  notes,
  setNotes,
  revealed,
  setRevealed,
  pnlDisplay,
  shot,
  onZoom,
  onEnd,
  onSave,
  onSkip,
  zoom,
  onCloseZoom,
}: {
  trade: Trade;
  idx: number;
  total: number;
  sessionType: SessionType;
  setup: SetupAnswer | null;
  setSetup: (v: SetupAnswer) => void;
  clarity: number | null;
  setClarity: (v: number) => void;
  emotion: string | null;
  setEmotion: (v: string | null) => void;
  grade: Grade | null;
  setGrade: (v: Grade) => void;
  notes: string;
  setNotes: (v: string) => void;
  revealed: boolean;
  setRevealed: (b: boolean) => void;
  pnlDisplay: number;
  shot: string | null;
  onZoom: () => void;
  onEnd: () => void;
  onSave: () => void;
  onSkip: () => void;
  zoom: boolean;
  onCloseZoom: () => void;
}) {
  const direction = String(trade.type || "").toLowerCase();
  const isLong = direction === "long";
  const symbol = trade.symbol || trade.pair || "—";
  const progress = ((idx + 1) / total) * 100;

  // step: which question is currently active
  // 0 = setup, 1 = clarity, 2 = emotion, 3 = reveal-ready, 4 = revealed
  let step = 0;
  if (setup !== null) step = 1;
  if (clarity !== null) step = 2;
  // emotion is skippable, so we move to reveal-ready after clarity is set
  // but show emotion UI in step 2
  if (revealed) step = 4;

  const showReveal = setup !== null && clarity !== null && !revealed;
  const insight = revealed ? computeInsight(setup, clarity, Number(trade.pnl) || 0) : null;
  const tone = insight ? TONE_COLORS[insight.tone] : null;
  const pnl = Number(trade.pnl) || 0;

  return (
    <div style={{
      minHeight: "100vh",
      fontFamily: "Inter, system-ui, sans-serif",
      padding: "24px 24px 60px",
    }}>
      {/* top bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        maxWidth: 760,
        margin: "0 auto 28px",
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 8,
          }}>
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
              Trade {idx + 1} of {total}
            </span>
            <span style={{
              fontSize: 11,
              padding: "3px 8px",
              borderRadius: 999,
              background: "rgba(99,102,241,0.12)",
              color: "#a5b4fc",
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}>
              {SESSION_LABEL[sessionType]}
            </span>
          </div>
          <div style={{
            height: 3,
            background: "#1a1a1a",
            borderRadius: 999,
            overflow: "hidden",
          }}>
            <div style={{
              width: `${progress}%`,
              height: "100%",
              background: "#6366f1",
              transition: "width 0.3s ease",
            }} />
          </div>
        </div>
        <button
          onClick={onEnd}
          style={{
            background: "transparent",
            border: "1px solid #2a2a2a",
            color: "#9ca3af",
            padding: "8px 14px",
            borderRadius: 8,
            fontSize: 13,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          End Session
        </button>
      </div>

      {/* trade card */}
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{
          background: "#111111",
          border: "1px solid #1e1e1e",
          borderRadius: 14,
          padding: 24,
          marginBottom: 20,
          display: "flex",
          gap: 16,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 10,
              flexWrap: "wrap",
            }}>
              <span style={{
                color: "#fff",
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}>
                {symbol}
              </span>
              <span style={{
                padding: "4px 10px",
                borderRadius: 6,
                background: isLong ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                color: isLong ? "#10b981" : "#ef4444",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}>
                {isLong ? "LONG" : "SHORT"}
              </span>
            </div>
            <div style={{ color: "#888", fontSize: 13, marginBottom: 14 }}>
              {fmtDate(trade.date)}
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 12 }}>
              <PriceField label="Entry" value={fmtPrice(trade.entryPrice)} />
              <PriceField
                label="Exit"
                value={revealed ? fmtPrice(trade.exitPrice) : "?"}
                muted={!revealed}
              />
              <PriceField
                label="PnL"
                value={
                  revealed
                    ? fmtMoney(pnlDisplay)
                    : "?"
                }
                color={
                  revealed
                    ? pnl > 0 ? "#10b981" : pnl < 0 ? "#ef4444" : "#fff"
                    : "#555"
                }
                muted={!revealed}
              />
            </div>
            {trade.notes && (
              <div style={{
                marginTop: 8,
                padding: "10px 12px",
                background: "#0a0a0a",
                border: "1px solid #1a1a1a",
                borderRadius: 8,
                color: "#bbb",
                fontSize: 13,
                lineHeight: 1.5,
              }}>
                {trade.notes}
              </div>
            )}
          </div>
          {shot && (
            <button
              onClick={onZoom}
              style={{
                background: "transparent",
                border: "1px solid #1e1e1e",
                borderRadius: 8,
                padding: 0,
                cursor: "zoom-in",
                overflow: "hidden",
                width: 120,
                height: 80,
                flexShrink: 0,
              }}
            >
              <img
                src={shot}
                alt="screenshot"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </button>
          )}
        </div>

        {/* questions */}
        {!revealed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <QuestionCard title="Was this your setup?" delay={0}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <SetupButton
                  label="Yes, it was"
                  active={setup === "yes"}
                  color="#10b981"
                  onClick={() => setSetup("yes")}
                />
                <SetupButton
                  label="Partially"
                  active={setup === "partial"}
                  color="#eab308"
                  onClick={() => setSetup("partial")}
                />
                <SetupButton
                  label="No, it wasn't"
                  active={setup === "no"}
                  color="#ef4444"
                  onClick={() => setSetup("no")}
                />
              </div>
            </QuestionCard>

            {setup !== null && (
              <QuestionCard title="How clear was this entry?" delay={60}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <ClarityButton
                      key={n}
                      n={n}
                      active={clarity === n}
                      onClick={() => setClarity(n)}
                    />
                  ))}
                </div>
                <div style={{ color: "#666", fontSize: 12 }}>
                  1 = unclear · 5 = crystal clear
                </div>
              </QuestionCard>
            )}

            {clarity !== null && (
              <QuestionCard title="What emotion were you feeling?" delay={60} optional>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {EMOTIONS.map((e) => (
                    <EmotionPill
                      key={e}
                      label={e}
                      active={emotion === e}
                      onClick={() => setEmotion(emotion === e ? null : e)}
                    />
                  ))}
                </div>
              </QuestionCard>
            )}

            {showReveal && (
              <button
                onClick={() => setRevealed(true)}
                style={{
                  marginTop: 4,
                  padding: "16px 24px",
                  borderRadius: 10,
                  background: "#6366f1",
                  color: "#fff",
                  border: "none",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  width: "100%",
                  minHeight: 56,
                  animation: "fadeUp 0.3s ease",
                }}
              >
                Reveal Result →
              </button>
            )}
          </div>
        )}

        {/* reveal section */}
        {revealed && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            animation: "fadeUp 0.4s ease",
          }}>
            {insight && tone && (
              <div style={{
                borderLeft: `3px solid ${tone.border}`,
                background: tone.bg,
                padding: "14px 16px",
                borderRadius: 8,
                color: tone.text,
                fontSize: 14,
                fontWeight: 500,
                lineHeight: 1.5,
              }}>
                {insight.text}
              </div>
            )}

            <div style={{
              background: "#111111",
              border: "1px solid #1e1e1e",
              borderRadius: 12,
              padding: 20,
            }}>
              <div style={{
                color: "#888",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 12,
              }}>
                Grade this trade
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["A", "B", "C", "D", "F"] as Grade[]).map((g) => (
                  <GradeButton
                    key={g}
                    label={g}
                    color={GRADE_COLORS[g]}
                    active={grade === g}
                    onClick={() => setGrade(g)}
                  />
                ))}
              </div>
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What would you do differently?"
              rows={3}
              style={{
                background: "#111111",
                border: "1px solid #1e1e1e",
                borderRadius: 10,
                color: "#fff",
                padding: "12px 14px",
                fontSize: 14,
                fontFamily: "inherit",
                resize: "vertical",
                outline: "none",
                width: "100%",
                boxSizing: "border-box",
              }}
            />

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={onSkip}
                style={{
                  flex: 1,
                  padding: "14px 18px",
                  borderRadius: 10,
                  background: "transparent",
                  border: "1px solid #2a2a2a",
                  color: "#9ca3af",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  minHeight: 56,
                }}
              >
                Skip →
              </button>
              <button
                onClick={onSave}
                style={{
                  flex: 2,
                  padding: "14px 18px",
                  borderRadius: 10,
                  background: "#6366f1",
                  border: "none",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  minHeight: 56,
                }}
              >
                Save &amp; Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* zoom modal */}
      {zoom && shot && (
        <div
          onClick={onCloseZoom}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            zIndex: 200,
            cursor: "zoom-out",
          }}
        >
          <img
            src={shot}
            alt="screenshot"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              borderRadius: 12,
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes fadeUp {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ───────────────────────── small components ─────────────────────────

function CenterMsg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#9ca3af",
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 15,
    }}>
      {children}
    </div>
  );
}

function PriceField({ label, value, color, muted }: { label: string; value: string; color?: string; muted?: boolean }) {
  return (
    <div>
      <div style={{
        color: "#666",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        color: color || (muted ? "#555" : "#9ca3af"),
        fontSize: 22,
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
      }}>
        {value}
      </div>
    </div>
  );
}

function QuestionCard({
  title,
  children,
  delay,
  optional,
}: {
  title: string;
  children: React.ReactNode;
  delay?: number;
  optional?: boolean;
}) {
  return (
    <div style={{
      background: "#111111",
      border: "1px solid #1e1e1e",
      borderRadius: 12,
      padding: 20,
      animation: `fadeUp 0.32s ease both`,
      animationDelay: `${delay || 0}ms`,
    }}>
      <div style={{
        color: "#fff",
        fontSize: 16,
        fontWeight: 700,
        marginBottom: 14,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        {title}
        {optional && (
          <span style={{
            fontSize: 11,
            fontWeight: 500,
            color: "#666",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}>
            optional
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function SetupButton({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: "1 1 160px",
        minHeight: 56,
        padding: "14px 16px",
        borderRadius: 10,
        background: active ? `${color}1a` : "#0a0a0a",
        border: `1px solid ${active ? color : "#1e1e1e"}`,
        color: active ? color : "#d1d5db",
        fontSize: 15,
        fontWeight: 600,
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s, color 0.15s",
      }}
    >
      {label}
    </button>
  );
}

function ClarityButton({
  n,
  active,
  onClick,
}: {
  n: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: active ? "rgba(99,102,241,0.18)" : "#0a0a0a",
        border: `1px solid ${active ? "#6366f1" : "#1e1e1e"}`,
        color: active ? "#a5b4fc" : "#d1d5db",
        fontSize: 18,
        fontWeight: 700,
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      {n}
    </button>
  );
}

function EmotionPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 999,
        background: active ? "rgba(99,102,241,0.18)" : "#0a0a0a",
        border: `1px solid ${active ? "#6366f1" : "#1e1e1e"}`,
        color: active ? "#a5b4fc" : "#d1d5db",
        fontSize: 13.5,
        fontWeight: 600,
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      {label}
    </button>
  );
}

function GradeButton({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: "1 1 0",
        minWidth: 56,
        minHeight: 56,
        borderRadius: 999,
        background: active ? `${color}22` : "#0a0a0a",
        border: `1.5px solid ${active ? color : "#1e1e1e"}`,
        color: active ? color : "#d1d5db",
        fontSize: 20,
        fontWeight: 800,
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      {label}
    </button>
  );
}

// ───────────────────────── complete screen ─────────────────────────

function Complete({
  summary,
  onReview,
}: {
  summary: SessionSummary;
  onReview: () => void;
}) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: 560, width: "100%", textAlign: "center" }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "rgba(16,185,129,0.12)",
          border: "1.5px solid #10b981",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px",
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 style={{
          color: "#fff",
          fontSize: 32,
          fontWeight: 800,
          margin: 0,
          marginBottom: 8,
          letterSpacing: "-0.02em",
        }}>
          Session complete!
        </h1>
        <p style={{ color: "#888", fontSize: 15, marginBottom: 32 }}>
          You reviewed {summary.count} trade{summary.count === 1 ? "" : "s"}.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
          marginBottom: 24,
          textAlign: "left",
        }}>
          <StatCard
            label="Setup accuracy"
            value={`${Math.round(summary.setupAccuracy * 100)}%`}
            sub={`${Math.round(summary.setupAccuracy * summary.count)} of ${summary.count} matched`}
          />
          <StatCard
            label="Avg confidence"
            value={summary.avgClarity ? `${summary.avgClarity.toFixed(1)}/5` : "—"}
          />
          <StatCard
            label="Most common emotion"
            value={summary.mostCommonEmotion || "—"}
          />
        </div>

        <div style={{
          background: "#111111",
          border: "1px solid #1e1e1e",
          borderLeft: "3px solid #6366f1",
          padding: "18px 18px",
          borderRadius: 10,
          color: "#e5e7eb",
          fontSize: 14.5,
          lineHeight: 1.55,
          textAlign: "left",
          marginBottom: 28,
          fontWeight: 500,
        }}>
          {summary.keyInsight}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onReview}
            style={{
              flex: 1,
              padding: "14px 18px",
              borderRadius: 10,
              background: "transparent",
              border: "1px solid #2a2a2a",
              color: "#d1d5db",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              minHeight: 52,
            }}
          >
            Review Again
          </button>
          <a
            href="/dashboard"
            style={{
              flex: 1,
              padding: "14px 18px",
              borderRadius: 10,
              background: "#6366f1",
              border: "none",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              minHeight: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
            }}
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: "#111111",
      border: "1px solid #1e1e1e",
      borderRadius: 10,
      padding: "14px 16px",
    }}>
      <div style={{
        color: "#888",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        color: "#fff",
        fontSize: 22,
        fontWeight: 800,
        letterSpacing: "-0.01em",
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
