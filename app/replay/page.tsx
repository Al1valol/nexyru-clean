"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";

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

interface Review {
  tradeId: string;
  matchedSetup: Triad | null;
  followedRules: Triad | null;
  confidence: number;
  differently: string;
  grade: Grade | null;
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
  A: "#34d399",
  B: "#a3e635",
  C: "#fbbf24",
  D: "#fb923c",
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

function formatSymbol(trade: Trade): string {
  const raw = (trade.symbol || trade.pair || "").toString().trim();
  if (!raw) return "";
  if (raw.includes(":")) return raw.toUpperCase();
  const norm = raw.toUpperCase().replace(/[\/\-\s]/g, "");
  const map: Record<string, string> = {
    SOLUSD: "COINBASE:SOLUSD",
    BTCUSD: "COINBASE:BTCUSD",
    ETHUSD: "COINBASE:ETHUSD",
    GOLDUSD: "OANDA:XAUUSD",
    XAUUSD: "OANDA:XAUUSD",
    SILVERUSD: "OANDA:XAGUSD",
    XAGUSD: "OANDA:XAGUSD",
    USOILUSD: "NYMEX:CL1!",
    "CL1!": "NYMEX:CL1!",
    "CL1!USD": "NYMEX:CL1!",
    "ES1!": "CME_MINI:ES1!",
    "ES1!USD": "CME_MINI:ES1!",
    "NQ1!": "CME_MINI:NQ1!",
    "NQ1!USD": "CME_MINI:NQ1!",
  };
  return map[norm] || raw.toUpperCase();
}

function fmtInfoDate(v: number | string | undefined): string {
  if (!v) return "—";
  const d = new Date(typeof v === "number" ? v : v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric" });
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
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!sorted.length || sorted[0][1] < 2) {
    const withText = reviews.filter((r) => r.differently?.trim());
    return withText.length ? withText[withText.length - 1].differently.trim() : null;
  }
  return `Theme: "${sorted[0][0]}" mentioned in ${sorted[0][1]} reviews`;
}

// ───────────────────── page ─────────────────────

export default function ReplayPage() {
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
  const [viewMode, setViewMode] = useState<"chart" | "screenshot" | "both">("chart");

  // draft form state
  const [matchedSetup, setMatchedSetup] = useState<Triad | null>(null);
  const [followedRules, setFollowedRules] = useState<Triad | null>(null);
  const [confidence, setConfidence] = useState(5);
  const [differently, setDifferently] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);

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

      // resume at first unreviewed trade
      const startIdx = sorted.findIndex((t) => !savedReviews[t.id]);
      setIdx(startIdx >= 0 ? startIdx : sorted.length);
      if (startIdx === -1 && sorted.length > 0) setDone(true);
    } catch (e) {
      console.warn("replay load failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const current = trades[idx];

  // hydrate form when current trade changes
  useEffect(() => {
    if (!current) return;
    const existing = reviews[current.id];
    setMatchedSetup(existing?.matchedSetup ?? null);
    setFollowedRules(existing?.followedRules ?? null);
    setConfidence(existing?.confidence ?? 5);
    setDifferently(existing?.differently ?? "");
    setGrade(existing?.grade ?? null);
    setSlideKey((k) => k + 1);
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
  const reviewedCount = useMemo(
    () => trades.filter((t) => reviews[t.id]).length,
    [trades, reviews]
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
    };
    saveCurrent(r);
    setSlideDir("next");
    if (idx + 1 >= total) setDone(true);
    else setIdx(idx + 1);
  };

  const handleSkip = () => {
    setSlideDir("next");
    if (idx + 1 >= total) setDone(true);
    else setIdx(idx + 1);
  };

  const handlePrev = () => {
    setSlideDir("prev");
    if (done) { setDone(false); setIdx(Math.max(0, total - 1)); return; }
    setIdx(Math.max(0, idx - 1));
  };

  const handleRestart = () => {
    if (!username) return;
    setReviews({});
    try { localStorage.removeItem(reviewsKey(username)); } catch {}
    setDone(false);
    setIdx(0);
    setSlideDir("next");
  };

  // ── Summary ──
  const reviewedList = useMemo(
    () => Object.values(reviews).filter((r) => r && r.grade),
    [reviews]
  );

  const summary = useMemo(() => {
    if (!reviewedList.length) return null;
    const scoreAvg =
      reviewedList.reduce((s, r) => s + (GRADE_SCORE[r.grade!] ?? 0), 0) /
      reviewedList.length;
    const avgGrade = SCORE_TO_GRADE(scoreAvg);
    const matched = reviewedList.filter((r) => r.matchedSetup === "yes").length;
    const matchedPct = Math.round((matched / reviewedList.length) * 100);
    const ruled = reviewedList.filter((r) => r.followedRules === "yes").length;
    const ruledPct = Math.round((ruled / reviewedList.length) * 100);
    const avgConf =
      reviewedList.reduce((s, r) => s + (r.confidence || 0), 0) / reviewedList.length;

    // best/worst by pnl among reviewed trades
    const reviewedTrades = trades.filter((t) => reviews[t.id]);
    let best: Trade | null = null;
    let worst: Trade | null = null;
    for (const t of reviewedTrades) {
      const p = Number(t.pnl ?? 0);
      if (best === null || p > Number(best.pnl ?? 0)) best = t;
      if (worst === null || p < Number(worst.pnl ?? 0)) worst = t;
    }

    return {
      avgGrade,
      matchedPct,
      ruledPct,
      avgConf: avgConf.toFixed(1),
      lesson: topTheme(reviewedList),
      count: reviewedList.length,
      best,
      worst,
    };
  }, [reviewedList, trades, reviews]);

  // ───────────────────── render ─────────────────────

  if (loading) {
    return (
      <div style={shellStyle}>
        <div style={{ color: "#3a4a6a", fontSize: 13 }}>Loading replay…</div>
      </div>
    );
  }

  if (!username) {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#f0f4ff", marginBottom: 8 }}>
            Sign in required
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 18 }}>
            Trade Replay loads your local trade history.
          </div>
          <a href="/login" style={primaryBtnStyle}>Go to login</a>
        </div>
      </div>
    );
  }

  if (!trades.length) {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📽️</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#f0f4ff", marginBottom: 8 }}>
            No trades to replay
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 18 }}>
            Log some trades in the dashboard, then come back to review them.
          </div>
          <a href="/dashboard" style={primaryBtnStyle}>Open Dashboard</a>
        </div>
      </div>
    );
  }

  if (done || idx >= total) {
    return (
      <div style={shellStyle}>
        <div style={{ width: "100%", maxWidth: 760 }}>
          <ProgressBar idx={total} total={total} pct={100} sessionGrade={sessionGrade} done />

          <div style={{ ...cardStyle, marginTop: 18, padding: "36px 28px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#22d3a5", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>
              Replay Complete
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#f0f4ff", marginBottom: 28, letterSpacing: "-0.01em" }}>
              Session summary
            </div>

            {summary ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 22 }}>
                  <SummaryStat label="Session Grade" value={summary.avgGrade} color={GRADE_COLOR[summary.avgGrade]} big />
                  <SummaryStat label="Setup Match" value={`${summary.matchedPct}%`} color={pctColor(summary.matchedPct)} />
                  <SummaryStat label="Rules Followed" value={`${summary.ruledPct}%`} color={pctColor(summary.ruledPct)} />
                  <SummaryStat label="Avg Confidence" value={summary.avgConf} color="#38bdf8" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 22 }}>
                  <BestWorstCard label="Best Trade" trade={summary.best} positive />
                  <BestWorstCard label="Worst Trade" trade={summary.worst} positive={false} />
                </div>

                <div style={{ background: "#0b1120", border: "1px solid #1a2540", borderRadius: 14, padding: "18px 20px", marginBottom: 22 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#4a5a7a", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
                    Top Lesson
                  </div>
                  <div style={{ fontSize: 14, color: summary.lesson ? "#f0f4ff" : "#4a5a7a", lineHeight: 1.5, fontStyle: summary.lesson ? "normal" : "italic" }}>
                    {summary.lesson || "Not enough notes yet — add reflections to surface patterns."}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={handleRestart} style={{ ...primaryBtnStyle, flex: "1 1 200px" }}>
                    Start New Session
                  </button>
                  <a href="/dashboard" style={{ ...secondaryBtnStyle, flex: "1 1 140px", textAlign: "center" }}>
                    Back to Dashboard
                  </a>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: "#94a3b8" }}>
                You skipped through without grading any trades.{" "}
                <button onClick={handleRestart} style={{ background: "transparent", border: "none", color: "#38bdf8", fontWeight: 700, cursor: "pointer", padding: 0 }}>
                  Start over
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const t = current;
  const pnl = Number(t.pnl ?? 0);
  const isWin = pnl > 0;
  const isLoss = pnl < 0;
  const pnlColor = isWin ? "#22d3a5" : isLoss ? "#f43f5e" : "#94a3b8";
  const sideUpper = (t.type || "").toString().toUpperCase();
  const isLong = sideUpper === "LONG";
  const sym = (t.pair || t.symbol || "").toString();
  const entry = Number(t.entryPrice ?? 0);
  const exit = Number(t.exitPrice ?? 0);
  const contracts = Number(t.size ?? 0);

  return (
    <div style={shellStyle}>
      <style>{slideAnimCSS}</style>

      <div style={{ width: "100%", maxWidth: 760 }}>
        <ProgressBar idx={idx} total={total} pct={Math.round(((idx) / total) * 100)} sessionGrade={sessionGrade} />

        {/* Sliding trade panel */}
        <div
          key={slideKey}
          style={{
            animation: `${slideDir === "next" ? "slideInNext" : "slideInPrev"} 0.32s cubic-bezier(0.22, 0.61, 0.36, 1) both`,
          }}
        >
          {/* Info bar */}
          <div style={{
            ...cardStyle,
            marginTop: 18,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            fontSize: 12,
            color: "#cbd5e1",
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          }}>
            <span style={{ color: "#4a5a7a", fontWeight: 700, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Viewing
            </span>
            <span style={{ color: "#f0f4ff", fontWeight: 800 }}>{sym || "—"}</span>
            <span style={{ color: "#1e2540" }}>·</span>
            <span>{fmtInfoDate(t.date)}</span>
            <span style={{ color: "#1e2540" }}>·</span>
            <span>5min chart</span>
            <span style={{ color: "#1e2540" }}>·</span>
            <span>
              Entry <span style={{ color: "#22d3a5", fontWeight: 700 }}>{fmtPrice(entry)}</span>
              <span style={{ color: "#4a5a7a", margin: "0 4px" }}>→</span>
              Exit <span style={{ color: "#f43f5e", fontWeight: 700 }}>{fmtPrice(exit)}</span>
            </span>
          </div>

          {/* View toggle */}
          <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
            <ToggleBtn label="📈 Live Chart" active={viewMode === "chart"} onClick={() => setViewMode("chart")} />
            <ToggleBtn label="📸 Screenshot" active={viewMode === "screenshot"} onClick={() => setViewMode("screenshot")} disabled={!shot && !shotLoading} />
            <ToggleBtn label="📊 Both" active={viewMode === "both"} onClick={() => setViewMode("both")} disabled={!shot && !shotLoading} />
          </div>

          {/* Chart card */}
          <div style={{
            ...cardStyle,
            marginTop: 10,
            padding: 0,
            overflow: "hidden",
            position: "relative",
          }}>
            <ChartArea
              trade={t}
              shot={shot}
              shotLoading={shotLoading}
              viewMode={viewMode}
            />

            {/* Top overlay: symbol + side + date */}
            <div style={{
              position: "absolute",
              top: 14, left: 14, right: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              pointerEvents: "none",
              zIndex: 3,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={overlayChipStrong}>
                  {sym || "—"}
                </div>
                <div style={{
                  ...overlayChip,
                  background: isLong ? "rgba(34,211,165,0.22)" : "rgba(244,63,94,0.22)",
                  color: isLong ? "#22d3a5" : "#f43f5e",
                  border: `1px solid ${isLong ? "#22d3a566" : "#f43f5e66"}`,
                  fontSize: 10,
                  letterSpacing: "0.1em",
                }}>
                  {sideUpper || "—"}
                </div>
              </div>
              <div style={{ ...overlayChip, fontSize: 10, color: "#cbd5e1" }}>
                {fmtDate(t.date)}
              </div>
            </div>

            {/* Horizontal entry/exit reference lines (chart visible only) */}
            {(viewMode === "chart" || viewMode === "both") && entry > 0 && (
              <ReferenceLine label="ENTRY" value={fmtPrice(entry)} color="#22d3a5" top="42%" half={viewMode === "both"} />
            )}
            {(viewMode === "chart" || viewMode === "both") && exit > 0 && (
              <ReferenceLine label="EXIT" value={fmtPrice(exit)} color="#f43f5e" top="58%" half={viewMode === "both"} />
            )}

            {/* Bottom-left: contracts */}
            <div style={{
              position: "absolute",
              bottom: 14,
              left: 14,
              pointerEvents: "none",
              zIndex: 3,
            }}>
              <div style={{ ...overlayChip, fontSize: 11, color: "#cbd5e1" }}>
                <span style={{ color: "#4a5a7a", marginRight: 6, fontWeight: 700 }}>SIZE</span>
                {contracts ? `${contracts} ${contracts === 1 ? "contract" : "contracts"}` : "—"}
              </div>
            </div>

            {/* Bottom-right: PnL badge */}
            <div style={{
              position: "absolute",
              bottom: 14,
              right: 14,
              pointerEvents: "none",
              zIndex: 3,
            }}>
              <div style={{
                padding: "10px 14px",
                borderRadius: 12,
                background: `${pnlColor}22`,
                border: `1px solid ${pnlColor}88`,
                color: pnlColor,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontWeight: 900,
                fontSize: 17,
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                letterSpacing: "-0.01em",
                boxShadow: `0 6px 18px ${pnlColor}33`,
              }}>
                {pnl > 0 ? "+" : ""}{fmtMoney(pnl)}
                {t.pnlPct !== undefined && t.pnlPct !== null && (
                  <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.85 }}>
                    ({Number(t.pnlPct) > 0 ? "+" : ""}{Number(t.pnlPct).toFixed(2)}%)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* strategy + notes (below chart) */}
          {(t.strategy || t.notes) && (
            <div style={{ ...cardStyle, marginTop: 12, padding: "14px 18px" }}>
              {t.strategy && (
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: t.notes ? 8 : 0 }}>
                  <span style={{ color: "#4a5a7a", fontWeight: 700, marginRight: 8, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 10 }}>Setup</span>
                  <span style={{ color: "#f0f4ff", fontWeight: 700 }}>{t.strategy}</span>
                </div>
              )}
              {t.notes && (
                <div style={{
                  fontSize: 12,
                  color: "#cbd5e1",
                  lineHeight: 1.55,
                  whiteSpace: "pre-wrap",
                  background: "#0b1120",
                  border: "1px dashed #1a2540",
                  borderRadius: 10,
                  padding: "10px 12px",
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#4a5a7a", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
                    Notes at the time
                  </div>
                  {t.notes}
                </div>
              )}
            </div>
          )}

          {/* Review form */}
          <div style={{ ...cardStyle, marginTop: 12, padding: "22px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16 }}>
              Review this trade
            </div>

            <FormBlock label="Was this your setup?">
              <TriadRow value={matchedSetup} onChange={setMatchedSetup} />
            </FormBlock>

            <FormBlock label="Did you follow your rules?">
              <TriadRow value={followedRules} onChange={setFollowedRules} />
            </FormBlock>

            <FormBlock label={`Confidence — ${confidence}/10`}>
              <ConfidenceDots value={confidence} onChange={setConfidence} />
            </FormBlock>

            <FormBlock label="What would you do differently?">
              <textarea
                value={differently}
                onChange={(e) => setDifferently(e.target.value)}
                placeholder="One honest takeaway. Skip if nothing comes to mind."
                rows={3}
                style={{
                  width: "100%",
                  background: "#0b1120",
                  border: "1px solid #1a2540",
                  borderRadius: 10,
                  color: "#f0f4ff",
                  fontSize: 13,
                  padding: "10px 12px",
                  fontFamily: "inherit",
                  resize: "vertical",
                  outline: "none",
                  lineHeight: 1.5,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#38bdf8")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#1a2540")}
              />
            </FormBlock>

            <FormBlock label="Trade Grade">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
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
              </div>
            </FormBlock>

            {/* actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
              <button
                onClick={handlePrev}
                disabled={idx === 0}
                style={{
                  ...secondaryBtnStyle,
                  opacity: idx === 0 ? 0.4 : 1,
                  cursor: idx === 0 ? "not-allowed" : "pointer",
                  flex: "0 0 auto",
                }}
              >
                ← Prev
              </button>
              <button
                onClick={handleSkip}
                style={{ ...secondaryBtnStyle, flex: "0 0 auto" }}
              >
                Skip
              </button>
              <button
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
              </button>
            </div>

            {!canAdvance && (
              <div style={{ marginTop: 10, fontSize: 11, color: "#4a5a7a" }}>
                Pick setup, rules, and a grade to continue.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────── sub-components ─────────────────────

function ChartArea({
  trade, shot, shotLoading, viewMode,
}: { trade: Trade; shot: string | null; shotLoading: boolean; viewMode: "chart" | "screenshot" | "both" }) {
  const HEIGHT = 500;
  const tvSym = formatSymbol(trade);
  const src = tvSym
    ? `https://www.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${encodeURIComponent(tvSym)}&interval=5&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=131722&studies=RSI@tv-basicstudies,MACD@tv-basicstudies&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&showpopupbutton=1`
    : "";

  const chartEl = tvSym ? (
    <iframe
      key={trade.id}
      src={src}
      width="100%"
      height={String(HEIGHT)}
      frameBorder="0"
      style={{ display: "block", border: 0, height: HEIGHT, borderRadius: 12 }}
      title={`Chart ${tvSym}`}
    />
  ) : (
    <div style={{ height: HEIGHT, background: "#060d1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#3a4a6a", gap: 8 }}>
      <div style={{ fontSize: 32 }}>📊</div>
      <div style={{ fontSize: 12 }}>No chart available for this symbol</div>
    </div>
  );

  const screenshotEl = shotLoading ? (
    <div style={{ height: HEIGHT, background: "#060d1a", display: "flex", alignItems: "center", justifyContent: "center", color: "#3a4a6a", fontSize: 12 }}>
      Loading screenshot…
    </div>
  ) : shot ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={shot}
      alt="Trade screenshot"
      style={{ width: "100%", height: HEIGHT, objectFit: "cover", display: "block" }}
    />
  ) : (
    <div style={{ height: HEIGHT, background: "#060d1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#3a4a6a", gap: 8 }}>
      <div style={{ fontSize: 28 }}>📸</div>
      <div style={{ fontSize: 12 }}>No screenshot attached</div>
    </div>
  );

  if (viewMode === "screenshot") {
    return <div style={{ background: "#060d1a", height: HEIGHT }}>{screenshotEl}</div>;
  }

  if (viewMode === "both") {
    return (
      <div style={{ display: "flex", background: "#060d1a", height: HEIGHT }}>
        <div style={{ width: "50%", borderRight: "1px solid #1a2540", overflow: "hidden" }}>{screenshotEl}</div>
        <div style={{ width: "50%", overflow: "hidden" }}>{chartEl}</div>
      </div>
    );
  }

  return <div style={{ background: "#060d1a", height: HEIGHT }}>{chartEl}</div>;
}

function ProgressBar({
  idx, total, pct, sessionGrade, done,
}: { idx: number; total: number; pct: number; sessionGrade: Grade | null; done?: boolean }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="/dashboard" style={{ fontSize: 11, color: "#4a5a7a", textDecoration: "none", fontWeight: 600 }}>
            ← Dashboard
          </a>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#f0f4ff", letterSpacing: "0.04em" }}>
            📽️ Trade Replay
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 8 }}>
          <span>Trade {done ? total : idx + 1} of {total}</span>
          {sessionGrade && (
            <>
              <span style={{ color: "#1e2540" }}>·</span>
              <span>Session Grade:{" "}
                <span style={{ color: GRADE_COLOR[sessionGrade], fontWeight: 900 }}>{sessionGrade}</span>
              </span>
            </>
          )}
        </div>
      </div>
      <div style={{
        height: 6,
        background: "#0b1120",
        border: "1px solid #1a2540",
        borderRadius: 999,
        overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`,
          height: "100%",
          background: "linear-gradient(90deg,#22d3a5,#38bdf8)",
          transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

function TriadRow({ value, onChange }: { value: Triad | null; onChange: (v: Triad) => void }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <TriadBtn label="✅ Yes"     active={value === "yes"}     color="#22d3a5" onClick={() => onChange("yes")} />
      <TriadBtn label="⚠️ Partial" active={value === "partial"} color="#fbbf24" onClick={() => onChange("partial")} />
      <TriadBtn label="❌ No"      active={value === "no"}      color="#f43f5e" onClick={() => onChange("no")} />
    </div>
  );
}

function TriadBtn({
  label, active, color, onClick,
}: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "11px 10px",
        borderRadius: 10,
        border: `1px solid ${active ? color : "#1e2540"}`,
        background: active ? `${color}22` : "transparent",
        color: active ? color : "#94a3b8",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
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
              border: `1px solid ${filled ? "#38bdf8" : "#1e2540"}`,
              background: filled ? "#38bdf8" : "transparent",
              cursor: "pointer",
              padding: 0,
              transition: "all 0.12s",
              boxShadow: filled && n === value ? "0 0 0 3px #38bdf833" : "none",
            }}
          />
        );
      })}
    </div>
  );
}

function ReferenceLine({
  label, value, color, top, half,
}: { label: string; value: string; color: string; top: string; half?: boolean }) {
  return (
    <div style={{
      position: "absolute",
      top,
      right: 0,
      width: half ? "50%" : "100%",
      height: 1,
      background: `linear-gradient(90deg, transparent 0%, ${color}66 25%, ${color} 100%)`,
      pointerEvents: "none",
      zIndex: 2,
    }}>
      <div style={{
        position: "absolute",
        right: 10,
        top: -10,
        padding: "3px 8px",
        background: color,
        color: "#000",
        fontSize: 9,
        fontWeight: 900,
        borderRadius: 4,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        letterSpacing: "0.06em",
        boxShadow: `0 2px 8px ${color}55`,
        whiteSpace: "nowrap",
      }}>
        {label} {value}
      </div>
    </div>
  );
}

function ToggleBtn({
  label, active, onClick, disabled,
}: { label: string; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${active ? "#38bdf8" : "#1e2540"}`,
        background: active ? "rgba(56,189,248,0.15)" : "#0d1628",
        color: active ? "#38bdf8" : disabled ? "#3a4a6a" : "#94a3b8",
        fontSize: 12,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

function FormBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 8, letterSpacing: "0.02em" }}>
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
      background: "#0b1120",
      border: `1px solid ${color}33`,
      borderRadius: 14,
      padding: "16px 18px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#4a5a7a", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{
        fontSize: big ? 38 : 26,
        fontWeight: 900,
        color,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        lineHeight: 1.1,
      }}>
        {value}
      </div>
    </div>
  );
}

function BestWorstCard({ label, trade, positive }: { label: string; trade: Trade | null; positive: boolean }) {
  const color = positive ? "#22d3a5" : "#f43f5e";
  if (!trade) {
    return (
      <div style={{ background: "#0b1120", border: `1px solid ${color}22`, borderRadius: 14, padding: "16px 18px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#4a5a7a", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
          {label}
        </div>
        <div style={{ fontSize: 13, color: "#4a5a7a" }}>—</div>
      </div>
    );
  }
  const pnl = Number(trade.pnl ?? 0);
  return (
    <div style={{ background: "#0b1120", border: `1px solid ${color}44`, borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#4a5a7a", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#f0f4ff", letterSpacing: "-0.01em" }}>
          {trade.pair || trade.symbol || "—"}
        </div>
        <div style={{
          fontSize: 16, fontWeight: 900, color,
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
        }}>
          {pnl > 0 ? "+" : ""}{fmtMoney(pnl)}
        </div>
      </div>
      <div style={{ fontSize: 10, color: "#4a5a7a", marginTop: 4 }}>
        {fmtDate(trade.date)} · {(trade.type || "").toString().toUpperCase()}
      </div>
    </div>
  );
}

function pctColor(p: number) {
  return p >= 70 ? "#22d3a5" : p >= 40 ? "#fbbf24" : "#f43f5e";
}

// ───────────────────── styles ─────────────────────

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#060d1a",
  color: "#f0f4ff",
  padding: "32px 18px 80px",
  display: "flex",
  justifyContent: "center",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const cardStyle: React.CSSProperties = {
  background: "#0d1628",
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
  background: "linear-gradient(135deg,#0ea5a0,#22d3a5)",
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
  color: "#94a3b8",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "none",
};

const overlayChip: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 6,
  background: "rgba(6,13,26,0.72)",
  border: "1px solid #1e2f4a",
  color: "#f0f4ff",
  fontWeight: 700,
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
};

const overlayChipStrong: React.CSSProperties = {
  ...overlayChip,
  fontSize: 14,
  fontWeight: 900,
  letterSpacing: "-0.01em",
  padding: "6px 12px",
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
