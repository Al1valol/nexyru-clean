"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { useUserPlan } from "@/lib/plan";
import { ProGatePage } from "@/components/ProGate";

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

type Triad = "yes" | "no" | "partial";
type Grade = "A+" | "A" | "B" | "C" | "D" | "F";

interface Review {
  tradeId: string;
  matchedSetup?: Triad | null;
  followedRules?: Triad | null;
  confidence?: number;
  differently?: string;
  grade?: Grade | null;
  reviewedAt: number;
  emotion?: EmotionKey | null;
  mistakes?: MistakeKey[];
}

// ───────────────────────── catalogs ─────────────────────────
type EmotionKey =
  | "fomo" | "fear" | "revenge" | "greed" | "confident"
  | "neutral" | "frustrated" | "bored" | "overconfident" | "tired";

const EMOTIONS: Record<EmotionKey, { emoji: string; label: string }> = {
  fomo:          { emoji: "", label: "FOMO" },
  fear:          { emoji: "", label: "Fear" },
  revenge:       { emoji: "", label: "Revenge" },
  greed:         { emoji: "", label: "Greed" },
  confident:     { emoji: "", label: "Confident" },
  neutral:       { emoji: "", label: "Neutral" },
  frustrated:    { emoji: "", label: "Frustrated" },
  bored:         { emoji: "", label: "Bored" },
  overconfident: { emoji: "", label: "Overconfident" },
  tired:         { emoji: "", label: "Tired" },
};

type MistakeKey =
  | "early_entry" | "early_exit" | "moved_sl" | "missed_entry" | "wrong_size"
  | "late_entry" | "overtraded" | "ignored_news" | "no_setup" | "broke_rules";

const MISTAKES: Record<MistakeKey, { emoji: string; label: string }> = {
  early_entry:  { emoji: "", label: "Early Entry" },
  early_exit:   { emoji: "", label: "Early Exit" },
  moved_sl:     { emoji: "", label: "Moved Stop Loss" },
  missed_entry: { emoji: "", label: "Missed Entry" },
  wrong_size:   { emoji: "", label: "Wrong Size" },
  late_entry:   { emoji: "⏰", label: "Late Entry" },
  overtraded:   { emoji: "", label: "Overtraded" },
  ignored_news: { emoji: "", label: "Ignored News" },
  no_setup:     { emoji: "", label: "No Setup" },
  broke_rules:  { emoji: "", label: "Broke Rules" },
};

// ───────────────────────── helpers ─────────────────────────
const SESSION_KEY = "tradedesk_session_v1";
const tradesKey = (u: string) => `tradedesk_trades_${u}_v1`;
const reviewsKey = (u: string) => `nexyru_trade_reviews_${u}`;
const emotionsKey = (u: string) => `nexyru_trade_emotions_${u}`;

interface EmotionEntry { tradeId: string; emotion: EmotionKey; date: number; }

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function getUsername(): string {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "{}").username || "guest"; }
  catch { return "guest"; }
}

function fmtMoney(n: number | undefined | null) {
  if (n === undefined || n === null || isNaN(Number(n))) return "$0.00";
  const v = Number(n);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtMoney0(n: number | undefined | null) {
  if (n === undefined || n === null || isNaN(Number(n))) return "$0";
  const v = Number(n);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function parseDate(d: unknown): Date | null {
  if (d === undefined || d === null || d === "") return null;
  const dt = new Date(typeof d === "number" ? d : (d as string));
  return isNaN(dt.getTime()) ? null : dt;
}

function daysAgo(ms: number): string {
  const diff = Date.now() - ms;
  const d = Math.floor(diff / 86_400_000);
  if (d < 1) return "today";
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
}

function fmtShortDate(v: unknown): string {
  const d = parseDate(v);
  if (!d) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ───────────────────────── shared styles ─────────────────────────
const card: React.CSSProperties = { background:"#111118", border:"1px solid #2a2a3a", borderRadius:18, padding:22 };
const cardSm: React.CSSProperties = { background:"#111118", border:"1px solid #2a2a3a", borderRadius:12, padding:14 };
const sectionTitle = (color: string, label: string) =>(<div style={{ fontSize:11, fontWeight:800, color, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:14 }}>{label}</div>
);

// ───────────────────────── page ─────────────────────────
export default function PsychologyPage() {
  const plan = useUserPlan();
  if (plan === "free") return <ProGatePage feature="Psychology Tracker" activePath="/psychology" />;
  return <PsychologyPageInner />;
}

function PsychologyPageInner() {
  const [username, setUsername] = useState("guest");
  const [trades, setTrades] = useState<Trade[]>([]);
 const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [mounted, setMounted] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [emotionsList, setEmotionsList] = useState<EmotionEntry[]>([]);
  const [pendingEmotion, setPendingEmotion] = useState<EmotionKey | null>(null);
  const [pendingTradeId, setPendingTradeId] = useState<string | null>(null);
  const [emotionSaved, setEmotionSaved] = useState(false);
  const [mistakeFlash, setMistakeFlash] = useState<MistakeKey | null>(null);

  useEffect(() => {
    setMounted(true);
    const u = getUsername();
    setUsername(u);
    try {
      const t = JSON.parse(localStorage.getItem(tradesKey(u)) || "[]") || [];
      setTrades(Array.isArray(t) ? t : []);
    } catch {}
    try {
      const r = JSON.parse(localStorage.getItem(reviewsKey(u)) || "{}") || {};
      setReviews(r && typeof r === "object" ? r : {});
    } catch {}
    try {
      const e = JSON.parse(localStorage.getItem(emotionsKey(u)) || "[]") || [];
      setEmotionsList(Array.isArray(e) ? e : []);
    } catch {}
  }, []);

  const saveReviews = (next: Record<string, Review>) => {
    setReviews(next);
    try { localStorage.setItem(reviewsKey(username), JSON.stringify(next)); } catch {}
  };

  const saveEmotionsList = (next: EmotionEntry[]) => {
    setEmotionsList(next);
    try { localStorage.setItem(emotionsKey(username), JSON.stringify(next)); } catch {}
  };

  // ── Derived: sorted trades & reviewed pairs
  const sortedTrades = useMemo(() => {
    return [...trades]
      .filter(t => t && t.id)
      .sort((a, b) => {
        const da = parseDate(a.date)?.getTime() ?? 0;
        const db = parseDate(b.date)?.getTime() ?? 0;
        return db - da;
      });
  }, [trades]);

  const reviewedTrades = useMemo(() => {
    return sortedTrades
      .map(t => ({ t, r: reviews[t.id] as Review | undefined }))
      .filter(x => x.r);
  }, [sortedTrades, reviews]);

  // ── Psychology score 0-100
  const score = useMemo(() => {
    if (!trades.length) return { value: 0, ruleCompliance: 0, cleanPct: 0, bestStreak: 0 };

    // rule compliance % from reviews
    const reviewedList = reviewedTrades.map(x => x.r!);
    const followed = reviewedList.filter(r => r.followedRules === "yes").length;
    const ruleCompliance = reviewedList.length
      ? Math.round((followed / reviewedList.length) * 100)
      : 0;

    // % of trades with no mistakes tagged (consider only reviewed; or assume untagged = clean)
    const cleanCount = sortedTrades.filter(t => {
      const r = reviews[t.id];
      return !r || !r.mistakes || r.mistakes.length === 0;
    }).length;
    const cleanPct = Math.round((cleanCount / sortedTrades.length) * 100);

    // Session time consistency — std-dev of trade hours, normalized
    const hours = sortedTrades.map(t => parseDate(t.date)?.getHours()).filter((h): h is number => h !== undefined && h !== null);
    let consistency = 50;
    if (hours.length > 2) {
      const mean = hours.reduce((a, b) => a + b, 0) / hours.length;
      const variance = hours.reduce((a, b) => a + (b - mean) ** 2, 0) / hours.length;
      const std = Math.sqrt(variance);
      // std 0 → 100, std >= 6 → 0
      consistency = Math.max(0, Math.min(100, Math.round(100 - (std / 6) * 100)));
    }

    // Revenge trade frequency — penalize
    const revengeCount = reviewedList.filter(r =>r.emotion === "revenge").length;
 const revengeRate = reviewedList.length ? revengeCount / reviewedList.length : 0;
 const revengePenalty = Math.min(40, Math.round(revengeRate * 100));

 // Best streak — consecutive days with NO mistakes tagged among reviewed trades
 const byDay: Record<string, { clean: boolean }> = {};
    sortedTrades.forEach(t => {
      const d = parseDate(t.date);
      if (!d) return;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const r = reviews[t.id];
      const isClean = !r || !r.mistakes || r.mistakes.length === 0;
      if (byDay[key] === undefined) byDay[key] = { clean: isClean };
      else byDay[key].clean = byDay[key].clean && isClean;
    });
    const dayKeys = Object.keys(byDay).sort();
    let bestStreak = 0, current = 0, lastDate: Date | null = null;
    for (const k of dayKeys) {
      const [y, m, d] = k.split("-").map(Number);
      const dt = new Date(y, m, d);
      if (byDay[k].clean) {
        if (lastDate && (dt.getTime() - lastDate.getTime()) === 86_400_000) current += 1;
        else current = 1;
      } else current = 0;
      if (current > bestStreak) bestStreak = current;
      lastDate = dt;
    }

    // Weighted composite
    const raw =
      ruleCompliance * 0.35 +
      cleanPct      * 0.35 +
      consistency   * 0.20 +
      10 // base credit for showing up
      - revengePenalty * 0.30;
    const value = Math.max(0, Math.min(100, Math.round(raw)));

    return { value, ruleCompliance, cleanPct, bestStreak };
  }, [trades, sortedTrades, reviews, reviewedTrades]);

  // ── Emotion data
  const emotionStats = useMemo(() => {
    const map: Record<EmotionKey, { count: number; wins: number; pnl: number }> = {} as any;
    (Object.keys(EMOTIONS) as EmotionKey[]).forEach(k => { map[k] = { count: 0, wins: 0, pnl: 0 }; });
    for (const { t, r } of reviewedTrades) {
      if (!r?.emotion) continue;
      const pnl = Number(t.pnl) || 0;
      map[r.emotion].count += 1;
      if (pnl > 0) map[r.emotion].wins += 1;
      map[r.emotion].pnl += pnl;
    }
    return map;
  }, [reviewedTrades]);

  const hasAnyEmotion = useMemo(
    () =>(Object.values(emotionStats) as Array<{count:number}>).some(s => s.count > 0),
    [emotionStats]
  );

  const emotionCount = useMemo(
    () => Object.values(reviews).filter(r => r && r.emotion).length + emotionsList.length,
    [reviews, emotionsList]
  );

  const recentThreeTrades = useMemo(() => sortedTrades.slice(0, 3), [sortedTrades]);

  useEffect(() => {
    if (!pendingTradeId && recentThreeTrades.length) {
      setPendingTradeId(recentThreeTrades[0].id);
    }
  }, [recentThreeTrades, pendingTradeId]);

  const handleSaveEmotion = () => {
    if (!pendingEmotion || !pendingTradeId) return;
    const now = Date.now();
    const existing: Review = reviews[pendingTradeId] || { tradeId: pendingTradeId, reviewedAt: now };
    const nextReview: Review = { ...existing, tradeId: pendingTradeId, emotion: pendingEmotion, reviewedAt: now };
    saveReviews({ ...reviews, [pendingTradeId]: nextReview });
    const entry: EmotionEntry = { tradeId: pendingTradeId, emotion: pendingEmotion, date: now };
    saveEmotionsList([...emotionsList, entry]);
    setEmotionSaved(true);
    setPendingEmotion(null);
    setTimeout(() => setEmotionSaved(false), 3500);
  };

  // ── Mistake data
  const mistakeStats = useMemo(() => {
    type Row = { key: MistakeKey; count: number; cost: number; lastAt: number | null };
    const rows: Record<MistakeKey, Row> = {} as any;
    (Object.keys(MISTAKES) as MistakeKey[]).forEach(k => {
      rows[k] = { key: k, count: 0, cost: 0, lastAt: null };
    });
    for (const { t, r } of reviewedTrades) {
      if (!r?.mistakes || !r.mistakes.length) continue;
      const pnl = Number(t.pnl) || 0;
      const dt = parseDate(t.date)?.getTime() ?? r.reviewedAt;
      for (const mk of r.mistakes) {
        if (!rows[mk]) continue;
        rows[mk].count += 1;
        if (pnl < 0) rows[mk].cost += Math.abs(pnl);
        if (rows[mk].lastAt === null || dt > rows[mk].lastAt!) rows[mk].lastAt = dt;
      }
    }
    return Object.values(rows)
      .filter(r => r.count > 0)
      .sort((a, b) => b.cost - a.cost);
  }, [reviewedTrades]);

  const maxMistakeCost = mistakeStats.length ? mistakeStats[0].cost : 0;

  // ── Quick log mistake on last trade
  const lastTrade = sortedTrades[0];
  const lastTradeMistakes = lastTrade ? (reviews[lastTrade.id]?.mistakes || []) : [];

  const toggleMistakeOnLastTrade = (mk: MistakeKey) => {
    if (!lastTrade) {
      setFlash("No trades yet to tag");
      setTimeout(() => setFlash(null), 1800);
      return;
    }
    const existing: Review = reviews[lastTrade.id] || {
      tradeId: lastTrade.id,
      reviewedAt: Date.now(),
      mistakes: [],
    };
    const current = new Set<MistakeKey>(existing.mistakes || []);
    if (current.has(mk)) current.delete(mk); else current.add(mk);
    const next: Review = { ...existing, tradeId: lastTrade.id, mistakes: Array.from(current), reviewedAt: Date.now() };
    saveReviews({ ...reviews, [lastTrade.id]: next });
    setMistakeFlash(mk);
    setTimeout(() => setMistakeFlash(null), 1500);
  };

  // ── Auto insights
  type Insight = { emoji: string; text: string; impact: "HIGH" | "MEDIUM" | "LOW"; tone: "good" | "warn" | "bad" };
  const insights = useMemo<Insight[]>(() => {
    const out: Insight[] = [];
    if (!sortedTrades.length) return out;

    // day of week
    const byDow: Record<number, { count: number; pnl: number }> = {};
    for (let i = 0; i < 7; i++) byDow[i] = { count: 0, pnl: 0 };
    for (const t of sortedTrades) {
      const d = parseDate(t.date);
      if (!d) continue;
      byDow[d.getDay()].count += 1;
      byDow[d.getDay()].pnl += Number(t.pnl) || 0;
    }
    const dowAvg = Object.entries(byDow)
      .filter(([, v]) => v.count >= 2)
      .map(([k, v]) => ({ day: Number(k), avg: v.pnl / v.count, count: v.count }))
      .sort((a, b) => b.avg - a.avg);
    if (dowAvg.length >= 2) {
      const best = dowAvg[0], worst = dowAvg[dowAvg.length - 1];
      if (best.avg > 0) {
        out.push({
          emoji: "",
          text: `Your best day is ${DAY_NAMES[best.day]} averaging ${fmtMoney(best.avg)}`,
          impact: "HIGH",
          tone: "good",
        });
      }
      if (worst.avg < 0) {
        out.push({
          emoji: "",
          text: `You lose the most on ${DAY_NAMES[worst.day]} averaging ${fmtMoney(worst.avg)}`,
          impact: "HIGH",
          tone: "bad",
        });
      }
    }

    // time of day — first hour share
    const totalProfit = sortedTrades.filter(t => (Number(t.pnl) || 0) > 0).reduce((s, t) => s + (Number(t.pnl) || 0), 0);
    if (totalProfit > 0) {
      const hourCount: Record<number, number> = {};
      for (const t of sortedTrades) {
        const d = parseDate(t.date);
        if (!d) continue;
        const h = d.getHours();
        hourCount[h] = (hourCount[h] || 0) + (Number(t.pnl) || 0);
      }
      const peakHour = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0];
      if (peakHour && Number(peakHour[1]) > 0) {
        const pct = Math.round((Number(peakHour[1]) / totalProfit) * 100);
        if (pct >= 20) {
          out.push({
            emoji: "⏱️",
            text: `${pct}% of your profits come around hour ${peakHour[0]}:00`,
            impact: "MEDIUM",
            tone: "good",
          });
        }
      }
    }

    // streak analysis — after 2 losses
    let lossStreak = 0;
    let afterTwo = { wins: 0, total: 0 };
    let bestWinStreak = 0, currentWinStreak = 0;
    const chronological = [...sortedTrades].reverse();
    for (const t of chronological) {
      const pnl = Number(t.pnl) || 0;
      if (lossStreak >= 2) {
        afterTwo.total += 1;
        if (pnl > 0) afterTwo.wins += 1;
      }
      if (pnl < 0) lossStreak += 1;
      else lossStreak = 0;

      if (pnl > 0) { currentWinStreak += 1; if (currentWinStreak > bestWinStreak) bestWinStreak = currentWinStreak; }
      else currentWinStreak = 0;
    }
    if (afterTwo.total >= 3) {
      const wr = Math.round((afterTwo.wins / afterTwo.total) * 100);
      out.push({
        emoji: "",
        text: `After 2 losses in a row your win rate drops to ${wr}%`,
        impact: wr < 40 ? "HIGH" : "MEDIUM",
        tone: wr < 40 ? "bad" : "warn",
      });
    }
    if (bestWinStreak >= 2) {
      out.push({
        emoji: "",
        text: `Your longest win streak is ${bestWinStreak} trades`,
        impact: "LOW",
        tone: "good",
      });
    }

    // rule compliance vs broken
    const followed = reviewedTrades.filter(({ r }) => r?.followedRules === "yes");
    const broken   = reviewedTrades.filter(({ r }) => r?.followedRules === "no");
    if (followed.length >= 3) {
      const wr = Math.round((followed.filter(x => (Number(x.t.pnl) || 0) > 0).length / followed.length) * 100);
      out.push({
        emoji: "",
        text: `When you follow your rules you win ${wr}% of trades`,
        impact: "HIGH",
        tone: "good",
      });
    }
    if (broken.length >= 3) {
      const wr = Math.round((broken.filter(x => (Number(x.t.pnl) || 0) > 0).length / broken.length) * 100);
      out.push({
        emoji: "️",
        text: `When you break rules you win only ${wr}% of trades`,
        impact: "HIGH",
        tone: "bad",
      });
    }

    // overtrading by day
    const dayTrades: Record<number, number[]> = {};
    const tradesByDay: Record<string, { dow: number; count: number }> = {};
    for (const t of sortedTrades) {
      const d = parseDate(t.date);
      if (!d) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!tradesByDay[key]) tradesByDay[key] = { dow: d.getDay(), count: 0 };
      tradesByDay[key].count += 1;
    }
    for (const v of Object.values(tradesByDay)) {
      if (!dayTrades[v.dow]) dayTrades[v.dow] = [];
      dayTrades[v.dow].push(v.count);
    }
    const dowAvgCount = Object.entries(dayTrades).map(([k, arr]) => ({
      day: Number(k),
      avg: arr.reduce((a, b) => a + b, 0) / arr.length,
    })).sort((a, b) => b.avg - a.avg);
    if (dowAvgCount.length >= 2) {
      const peak = dowAvgCount[0];
      const others = dowAvgCount.slice(1);
      const othersAvg = others.reduce((s, x) => s + x.avg, 0) / others.length;
      if (peak.avg >= othersAvg * 1.4 && peak.avg >= 2) {
        out.push({
          emoji: "",
          text: `You overtrade on ${DAY_NAMES[peak.day]} taking ${peak.avg.toFixed(1)} trades avg vs ${othersAvg.toFixed(1)} on other days`,
          impact: "MEDIUM",
          tone: "warn",
        });
      }
    }

    return out;
  }, [sortedTrades, reviewedTrades]);

  // ── Weekly report
  const weekly = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const thisMonday = new Date(now); thisMonday.setDate(now.getDate() - dayOfWeek); thisMonday.setHours(0, 0, 0, 0);
    const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(thisMonday); lastSunday.setDate(thisMonday.getDate() - 1); lastSunday.setHours(23,59,59,999);

    const inRange = (t: Trade, from: Date, to: Date) => {
      const d = parseDate(t.date);
      return d && d >= from && d<= to;
    };
    const thisWeekTo = new Date(now); thisWeekTo.setHours(23, 59, 59, 999);
    const thisWeek = sortedTrades.filter(t => inRange(t, thisMonday, thisWeekTo));
    const lastWeek = sortedTrades.filter(t => inRange(t, lastMonday, lastSunday));

    const sumPnl = (arr: Trade[]) => arr.reduce((s, t) =>s + (Number(t.pnl) || 0), 0);
 const thisPnl = sumPnl(thisWeek);
 const lastPnl = sumPnl(lastWeek);

 // best/worst day this week
 const byDay: Record<string, number> = {};
    for (const t of thisWeek) {
      const d = parseDate(t.date);
      if (!d) continue;
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      byDay[k] = (byDay[k] || 0) + (Number(t.pnl) || 0);
    }
    const dayEntries = Object.entries(byDay).map(([k, v]) => {
      const [y, m, d] = k.split("-").map(Number);
      const dt = new Date(y, m, d);
      return { label: DAY_NAMES[dt.getDay()], pnl: v };
    });
    const bestDay  = dayEntries.length ? dayEntries.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;
    const worstDay = dayEntries.length ? dayEntries.reduce((a, b) =>(b.pnl< a.pnl ? b : a)) : null;

    // most common emotion / mistake this week
    const emoCount: Record<string, number> = {};
    const mistakeCount: Record<string, number> = {};
    for (const t of thisWeek) {
      const r = reviews[t.id];
      if (!r) continue;
      if (r.emotion) emoCount[r.emotion] = (emoCount[r.emotion] || 0) + 1;
      if (r.mistakes) for (const m of r.mistakes) mistakeCount[m] = (mistakeCount[m] || 0) + 1;
    }
    const topEmo = Object.entries(emoCount).sort((a, b) => b[1] - a[1])[0];
    const topMistake = Object.entries(mistakeCount).sort((a, b) => b[1] - a[1])[0];

    // weekly psychology score = rule compliance + clean trades among this week's reviewed trades
    const wReviewed = thisWeek.map(t => reviews[t.id]).filter(Boolean) as Review[];
    let wScore = 0;
    if (wReviewed.length) {
      const followed = wReviewed.filter(r => r.followedRules === "yes").length;
      const clean = thisWeek.filter(t => {
        const r = reviews[t.id];
        return !r || !r.mistakes || r.mistakes.length === 0;
      }).length;
      wScore = Math.round(((followed / wReviewed.length) * 50) + ((clean / thisWeek.length) * 50));
    } else if (thisWeek.length) {
      // untagged → assume clean
      wScore = 70;
    }

    let message: { tone: "good" | "warn"; text: string };
    if (wScore >= 70 && thisPnl >= lastPnl) {
      message = { tone: "good", text: "Keep it up!" };
    } else if (topMistake) {
      message = { tone: "warn", text: `Focus on: ${MISTAKES[topMistake[0] as MistakeKey].label}` };
    } else if (thisPnl < 0) {
      message = { tone: "warn", text: "Focus on: review your rules before each trade" };
    } else {
      message = { tone: "good", text: "Solid week — stay disciplined" };
    }

    return { thisPnl, lastPnl, thisCount: thisWeek.length, bestDay, worstDay, topEmo, topMistake, wScore, message };
  }, [sortedTrades, reviews]);

  // ── Score color & label
  const scoreMeta = (() => {
    if (score.value >= 80) return { color: "#22d3a5", label: "Elite", glow: "rgba(34,211,165,0.35)" };
    if (score.value >= 60) return { color: "#6366f1", label: "Disciplined", glow: "rgba(99,102,241,0.35)" };
    if (score.value >= 40) return { color: "#f59e0b", label: "Developing", glow: "rgba(245,158,11,0.35)" };
    return { color: "#ef4444", label: "Needs Work", glow: "rgba(248,113,113,0.35)" };
  })();

  if (!mounted) return null;

  // ── render
  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#0a0a0f" }}>
      <Sidebar activePath="/psychology" />
      <MobileNav activePath="/psychology" />
      <main className="psych-main" style={{ flex:1, marginLeft:56, minHeight:"100vh", background:"#070b14", color:"#ffffff", padding:"32px 20px", paddingBottom:72, fontFamily:"system-ui, -apple-system, sans-serif" }}><style>{`
        @media (max-width: 767px) {
          .psych-main { padding: 16px 16px 72px !important; }
          .psych-overview-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
          .psych-overview-stats { grid-template-columns: repeat(3, 1fr) !important; }
          .psych-emotion-grid { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .psych-emotion-form-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
          .psych-mistakes-grid { grid-template-columns: 1fr 1fr !important; }
          .psych-insights-grid { grid-template-columns: 1fr !important; }
          .psych-weekly-grid { grid-template-columns: 1fr 1fr !important; }
          .psych-title { font-size: 24px !important; }
        }
      `}</style><div style={{ maxWidth:1100, margin:"0 auto" }}>

        {/* HEADER */}
        <header style={{ marginBottom:28 }}><h1 className="psych-title" style={{ fontSize:32, fontWeight:900, margin:0, letterSpacing:"-0.02em" }}>Psychology Tracker</h1><p style={{ fontSize:14, color:"#6b7280", margin:"6px 0 0" }}>Understand what's costing you money</p></header>

        {flash && (
          <div style={{ marginBottom:16, padding:"10px 14px", borderRadius:10, background:"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.3)", color:"#6366f1", fontSize:12, fontWeight:700 }}>{flash}</div>
        )}

        {!trades.length && (
          <section style={{ ...card, textAlign:"center", padding:"60px 22px", marginBottom:24 }}><div style={{ fontSize:48, marginBottom:12 }}></div><h2 style={{ margin:"0 0 8px", fontSize:18 }}>No trades yet</h2><p style={{ color:"#6b7280", fontSize:13, margin:0 }}>Log trades in your dashboard to unlock psychology insights.</p></section>
        )}

        {!!trades.length && emotionCount === 0 && (
          <section style={{
            marginBottom:24,
            padding:"20px 22px",
            background:"linear-gradient(135deg, rgba(99,102,241,0.14), rgba(59,130,246,0.05))",
            border:"1px solid rgba(99,102,241,0.4)",
            borderRadius:14,
          }}>
            <div style={{ fontSize:12, fontWeight:900, color:"#a5b4fc", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:10 }}>Get started in 2 steps</div>
            <ol style={{ margin:"0 0 10px", paddingLeft:22, color:"#e2e8f0", fontSize:14, lineHeight:1.7 }}>
              <li>Tag how you felt on your recent trades below</li>
              <li>Use Trade Review to review trades in detail</li>
            </ol>
            <div style={{ fontSize:12, color:"#94a3b8", marginBottom:14 }}>The more you tag, the more patterns Nexyru finds.</div>
            <a href="/replay" style={{
              display:"inline-block",
              padding:"9px 16px",
              background:"#6366f1",
              color:"#fff",
              borderRadius:8,
              fontSize:12,
              fontWeight:800,
              textDecoration:"none",
              letterSpacing:"0.02em",
            }}>Go to Trade Review →</a>
          </section>
        )}

        {/* ───────────── SECTION 1: OVERVIEW SCORE ───────────── */}
        {!!trades.length && (
        <section style={{ ...card, marginBottom:24 }}>
          {sectionTitle("#a5b4fc", "Psychology Overview")}
          <div className="psych-overview-grid" style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:36, alignItems:"center" }}><ScoreRing value={score.value} color={scoreMeta.color} label={scoreMeta.label} glow={scoreMeta.glow}/><div className="psych-overview-stats" style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:14 }}><StatTile label="Rule Compliance" value={`${score.ruleCompliance}%`} color="#6366f1"/><StatTile label="Clean Trades"    value={`${score.cleanPct}%`}        color="#22d3a5"/><StatTile label="Best Streak"     value={`${score.bestStreak} ${score.bestStreak === 1 ? "day" : "days"}`} color="#f59e0b"/></div></div></section>
        )}

        {/* ───────────── SECTION 2: EMOTION TRACKER ───────────── */}
        {!!trades.length && (
        <section style={{ ...card, marginBottom:24 }}>
          {sectionTitle("#6b7280", "Emotion Tracker")}
          {emotionCount < 3 ? (
            <div>
              <h3 style={{ margin:"0 0 14px", fontSize:18, fontWeight:800, color:"#ffffff" }}>How did you feel on your last trade?</h3>
              <div className="psych-emotion-form-grid" style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:10, marginBottom:20 }}>
                {(Object.keys(EMOTIONS) as EmotionKey[]).map(key => {
                  const meta = EMOTIONS[key];
                  const active = pendingEmotion === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setPendingEmotion(key)}
                      style={{
                        padding:"14px 8px",
                        borderRadius:12,
                        border:`1px solid ${active ? "#6366f1" : "#2a2a3a"}`,
                        background: active ? "rgba(99,102,241,0.18)" : "#111118",
                        color: active ? "#a5b4fc" : "#e5e7eb",
                        fontSize:13,
                        fontWeight:700,
                        cursor:"pointer",
                        transition:"all 0.15s",
                        boxShadow: active ? "0 0 0 2px rgba(99,102,241,0.25)" : "none",
                      }}
                      onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = "#4b5563"; }}
                      onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = "#2a2a3a"; }}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>

              {recentThreeTrades.length > 0 && (
                <>
                  <div style={{ fontSize:13, fontWeight:700, color:"#cbd5e1", marginBottom:10 }}>Which trade?</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:18 }}>
                    {recentThreeTrades.map(t => {
                      const active = pendingTradeId === t.id;
                      const pnl = Number(t.pnl) || 0;
                      const pnlColor = pnl >= 0 ? "#22d3a5" : "#ef4444";
                      const sym = t.pair || t.symbol || "Trade";
                      return (
                        <button
                          key={t.id}
                          onClick={() => setPendingTradeId(t.id)}
                          style={{
                            padding:"8px 14px",
                            borderRadius:999,
                            border:`1px solid ${active ? "#6366f1" : "#2a2a3a"}`,
                            background: active ? "rgba(99,102,241,0.15)" : "#111118",
                            color: active ? "#a5b4fc" : "#cbd5e1",
                            fontSize:12,
                            fontWeight:700,
                            cursor:"pointer",
                            display:"inline-flex",
                            alignItems:"center",
                            gap:8,
                            transition:"all 0.15s",
                          }}
                        >
                          <span>{sym}</span>
                          <span style={{ color:"#6b7280" }}>·</span>
                          <span style={{ color:"#9ca3af" }}>{fmtShortDate(t.date)}</span>
                          <span style={{ color:"#6b7280" }}>·</span>
                          <span style={{ color:pnlColor, fontFamily:"monospace" }}>{fmtMoney0(pnl)}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <button
                onClick={handleSaveEmotion}
                disabled={!pendingEmotion || !pendingTradeId}
                style={{
                  padding:"11px 22px",
                  borderRadius:10,
                  border:"none",
                  background: pendingEmotion && pendingTradeId ? "#6366f1" : "#1e293b",
                  color: pendingEmotion && pendingTradeId ? "#fff" : "#6b7280",
                  fontSize:13,
                  fontWeight:800,
                  cursor: pendingEmotion && pendingTradeId ? "pointer" : "not-allowed",
                  transition:"all 0.15s",
                }}
              >
                Save
              </button>

              {emotionSaved && (
                <div style={{
                  marginTop:14,
                  padding:"10px 14px",
                  borderRadius:10,
                  background:"rgba(34,211,165,0.10)",
                  border:"1px solid rgba(34,211,165,0.35)",
                  color:"#22d3a5",
                  fontSize:13,
                  fontWeight:700,
                }}>
                  Emotion logged! Keep tagging trades to see your patterns.
                </div>
              )}
            </div>
          ) : (<div className="psych-emotion-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(170px, 1fr))", gap:12 }}>
              {(Object.keys(EMOTIONS) as EmotionKey[]).map(key => {
                const meta = EMOTIONS[key];
                const s = emotionStats[key];
                if (s.count === 0) return null;
                const wr = Math.round((s.wins / s.count) * 100);
                const good = wr >50;
 const tone = good ? "#22d3a5" : "#ef4444";
 return (<div key={key} style={{
                    background:"#111118",
                    border:`1px solid ${good ? "rgba(34,211,165,0.25)" : "rgba(248,113,113,0.25)"}`,
                    borderRadius:12, padding:14,
                  }}><div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}><span style={{ fontSize:22 }}>{meta.emoji}</span><span style={{ fontWeight:800, fontSize:13 }}>{meta.label}</span></div><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, fontSize:11 }}><Mini label="Trades" value={String(s.count)} color="#9ca3af"/><Mini label="Win rate" value={`${wr}%`} color={tone}/><Mini label="Avg PnL" value={fmtMoney(s.pnl / s.count)} color={s.pnl >= 0 ? "#22d3a5" : "#ef4444"}/><Mini label="Total"  value={fmtMoney0(s.pnl)} color={s.pnl >= 0 ? "#22d3a5" : "#ef4444"}/></div></div>
                );
              })}
            </div>
          )}
        </section>
        )}

        {/* ───────────── SECTION 3: MISTAKES TRACKER ───────────── */}
        {!!trades.length && (
        <section style={{ ...card, marginBottom:24 }}>
          {sectionTitle("#6b7280", "Mistakes Tracker")}

          {mistakeStats.length >0 && (<div style={{
              background:"linear-gradient(135deg, rgba(248,113,113,0.12), rgba(248,113,113,0.04))",
              border:"1px solid rgba(248,113,113,0.35)",
              borderRadius:14, padding:16, marginBottom:18,
            }}><div style={{ fontSize:10, fontWeight:800, color:"#ef4444", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6 }}>Most Costly Mistake</div><div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}><div style={{ fontSize:24 }}>{MISTAKES[mistakeStats[0].key].emoji}</div><div style={{ fontWeight:900, fontSize:18 }}>{MISTAKES[mistakeStats[0].key].label}</div><div style={{ marginLeft:"auto", fontWeight:900, fontSize:22, color:"#ef4444", fontFamily:"monospace" }}>−{fmtMoney0(mistakeStats[0].cost)}</div></div><div style={{ marginTop:6, fontSize:11, color:"#9ca3af" }}>{mistakeStats[0].count}× this has cost you avg {fmtMoney(mistakeStats[0].cost / mistakeStats[0].count)} per occurrence</div></div>
          )}

          {/* Quick log — moved above empty state for visibility */}
          <div style={{ background:"#0d0d14", border:"1px solid #2a2a3a", borderRadius:12, padding:16, marginBottom:18 }}>
            <div style={{ fontSize:14, fontWeight:800, color:"#ffffff", marginBottom:6 }}>Tag a mistake on your most recent trade:</div>
            <div style={{ fontSize:12, color:"#9ca3af", marginBottom:14 }}>
              {lastTrade ? (
                <>
                  <span style={{ color:"#6b7280", marginRight:6 }}>Last trade:</span>
                  <span style={{ color:"#e5e7eb", fontWeight:700 }}>{lastTrade.pair || lastTrade.symbol || "Trade"}</span>
                  <span style={{ color:(Number(lastTrade.pnl) || 0) >= 0 ? "#22d3a5" : "#ef4444", fontFamily:"monospace", marginLeft:8 }}>
                    {(Number(lastTrade.pnl) || 0) >= 0 ? "+" : ""}{fmtMoney0(Number(lastTrade.pnl) || 0)}
                  </span>
                  <span style={{ color:"#6b7280", margin:"0 6px" }}>·</span>
                  <span style={{ color:"#9ca3af" }}>{fmtShortDate(lastTrade.date)}</span>
                </>
              ) : "No trades yet"}
            </div>
            <div className="psych-mistakes-grid" style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:8 }}>
              {(Object.keys(MISTAKES) as MistakeKey[]).map(mk => {
                const meta = MISTAKES[mk];
                const active = lastTradeMistakes.includes(mk);
                const flashed = mistakeFlash === mk;
                return (
                  <button
                    key={mk}
                    onClick={() => toggleMistakeOnLastTrade(mk)}
                    disabled={!lastTrade}
                    style={{
                      padding:"12px 10px",
                      borderRadius:10,
                      border:`1px solid ${flashed ? "rgba(34,211,165,0.6)" : active ? "rgba(248,113,113,0.55)" : "#2a2a3a"}`,
                      background: flashed ? "rgba(34,211,165,0.15)" : active ? "rgba(248,113,113,0.12)" : "#111118",
                      color: flashed ? "#22d3a5" : active ? "#ef4444" : "#cbd5e1",
                      fontSize:12, fontWeight:700,
                      cursor: lastTrade ? "pointer" : "not-allowed",
                      display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                      opacity: lastTrade ? 1 : 0.5,
                      transition:"all 0.15s",
                      textAlign:"center",
                    }}>
                    {flashed ? "Saved!" : meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {mistakeStats.length === 0 ? (
            <div style={{ background:"#111118", border:"1px dashed #2a2a3a", borderRadius:12, padding:"28px 20px", textAlign:"center" }}><p style={{ margin:0, color:"#6b7280", fontSize:13 }}>No mistakes tagged yet. Tap any mistake above to start tracking what's costing you.</p></div>) : (<div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {mistakeStats.map((row, idx) => {
                const meta = MISTAKES[row.key];
                const rel = maxMistakeCost >0 ? (row.cost / maxMistakeCost) * 100 : 0;
 return (<div key={row.key} style={{
                    background:"#111118", border:"1px solid #2a2a3a", borderRadius:12, padding:"12px 14px",
                  }}><div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}><span style={{ fontSize:11, color:"#6b7280", fontWeight:800, width:18 }}>#{idx + 1}</span><span style={{ fontSize:18 }}>{meta.emoji}</span><span style={{ fontWeight:800, fontSize:13 }}>{meta.label}</span><span style={{ marginLeft:"auto", fontFamily:"monospace", fontSize:13, fontWeight:800, color:"#ef4444" }}>−{fmtMoney0(row.cost)}</span></div><div style={{ height:6, background:"#2a2a3a", borderRadius:3, overflow:"hidden", marginBottom:6 }}><div style={{ width:`${rel}%`, height:"100%", background:"linear-gradient(90deg, #ef4444, #ef4444)" }}/></div><div style={{ display:"flex", justifyContent:"space-between", fontSize:10.5, color:"#6b7280", fontWeight:600 }}><span>{row.count}× • avg {fmtMoney(row.cost / row.count)}</span><span>Last made: {row.lastAt ? daysAgo(row.lastAt) : "—"}</span></div></div>
                );
              })}
            </div>
          )}
        </section>
        )}

        {/* ───────────── SECTION 4: AUTO INSIGHTS ───────────── */}
        {!!trades.length && (
        <section style={{ ...card, marginBottom:24 }}>
          {sectionTitle("#6366f1", "Auto Insights")}
          {insights.length === 0 ? (
            <div style={{ background:"#111118", border:"1px dashed #2a2a3a", borderRadius:12, padding:"28px 20px", textAlign:"center" }}><p style={{ margin:0, color:"#6b7280", fontSize:13 }}>Add a few more trades to surface patterns.</p></div>) : (<div className="psych-insights-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:12 }}>
              {insights.map((ins, i) => {
                const tone = ins.tone === "good"
                  ? { bg:"rgba(34,211,165,0.08)", border:"rgba(34,211,165,0.3)", text:"#22d3a5" }
                  : ins.tone === "bad"
                  ? { bg:"rgba(248,113,113,0.08)", border:"rgba(248,113,113,0.3)", text:"#ef4444" }
                  : { bg:"rgba(245,158,11,0.08)", border:"rgba(245,158,11,0.3)", text:"#f59e0b" };
                const badgeColor = ins.impact === "HIGH" ? "#ef4444" : ins.impact === "MEDIUM" ? "#f59e0b" : "#22d3a5";
                const badgeEmoji = ins.impact === "HIGH" ? "" : ins.impact === "MEDIUM" ? "" : "";
                return (
                  <div key={i} style={{
                    background: tone.bg,
                    border: `1px solid ${tone.border}`,
                    borderRadius:12,
                    padding:14,
                  }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}><span style={{ fontSize:20 }}>{ins.emoji}</span><span style={{ fontSize:10, fontWeight:800, color: badgeColor, letterSpacing:"0.08em" }}>{badgeEmoji} {ins.impact}</span></div><div style={{ color: tone.text, fontSize:13, fontWeight:700, lineHeight:1.4 }}>{ins.text}</div></div>
                );
              })}
            </div>
          )}
        </section>
        )}

        {/* ───────────── SECTION 5: WEEKLY REPORT ───────────── */}
        {!!trades.length && (
        <section style={{ ...card, marginBottom:40 }}>
          {sectionTitle("#22d3a5", "Weekly Report")}
          <div className="psych-weekly-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:12 }}><WeeklyTile
              label="PnL this week"
              value={fmtMoney0(weekly.thisPnl)}
              color={weekly.thisPnl >= 0 ? "#22d3a5" : "#ef4444"}
              sub={`${weekly.thisPnl >= weekly.lastPnl ? "▲" : "▼"} vs last week ${fmtMoney0(weekly.lastPnl)}`}
            /><WeeklyTile
              label="Best day"
              value={weekly.bestDay ? weekly.bestDay.label : "—"}
              color="#22d3a5"
              sub={weekly.bestDay ? fmtMoney0(weekly.bestDay.pnl) : "No trades"}
            /><WeeklyTile
              label="Worst day"
              value={weekly.worstDay ? weekly.worstDay.label : "—"}
              color="#ef4444"
              sub={weekly.worstDay ? fmtMoney0(weekly.worstDay.pnl) : "No trades"}
            /><WeeklyTile
              label="Most common emotion"
              value={weekly.topEmo
                ? `${EMOTIONS[weekly.topEmo[0] as EmotionKey].emoji} ${EMOTIONS[weekly.topEmo[0] as EmotionKey].label}`
                : "—"}
              color="#ec4899"
              sub={weekly.topEmo ? `${weekly.topEmo[1]} trades` : "No reviews"}
            /><WeeklyTile
              label="Most common mistake"
              value={weekly.topMistake
                ? `${MISTAKES[weekly.topMistake[0] as MistakeKey].emoji} ${MISTAKES[weekly.topMistake[0] as MistakeKey].label}`
                : "—"}
              color="#ef4444"
              sub={weekly.topMistake ? `${weekly.topMistake[1]} times` : "Clean week"}
            /><WeeklyTile
              label="Psychology score"
              value={String(weekly.wScore)}
              color={weekly.wScore >= 80 ? "#22d3a5" : weekly.wScore >= 60 ? "#6366f1" : weekly.wScore >= 40 ? "#f59e0b" : "#ef4444"}
              sub="This week"
            /></div><div style={{
            marginTop:16,
            padding:"12px 14px",
            borderRadius:10,
            background: weekly.message.tone === "good" ? "rgba(34,211,165,0.10)" : "rgba(245,158,11,0.10)",
            border: `1px solid ${weekly.message.tone === "good" ? "rgba(34,211,165,0.3)" : "rgba(245,158,11,0.3)"}`,
            color: weekly.message.tone === "good" ? "#22d3a5" : "#f59e0b",
            fontWeight:800, fontSize:13,
          }}>
            {weekly.message.tone === "good" ? " " : "️ "}{weekly.message.text}
          </div></section>
        )}

      </div></main>
    </div>
  );
}

// ───────────────────────── subcomponents ─────────────────────────

function ScoreRing({ value, color, label, glow }: { value: number; color: string; label: string; glow: string }) {
  const size = 180;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, value)) / 100) * circumference;
  return (
    <div style={{ position:"relative", width:size, height:size, filter:`drop-shadow(0 0 20px ${glow})` }}><svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}><circle cx={size/2} cy={size/2} r={radius} stroke="#2a2a3a" strokeWidth={stroke} fill="none"/><circle
          cx={size/2} cy={size/2} r={radius}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition:"stroke-dashoffset 0.6s ease" }}
        /></svg><div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}><div style={{ fontSize:46, fontWeight:900, color, lineHeight:1, fontFamily:"system-ui" }}>{value}</div><div style={{ fontSize:11, color, fontWeight:800, marginTop:6, textTransform:"uppercase", letterSpacing:"0.15em" }}>{label}</div></div></div>
  );
}

function StatTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={cardSm}><div style={{ fontSize:10, color:"#6b7280", fontWeight:800, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6 }}>{label}</div><div style={{ fontSize:22, fontWeight:900, color, fontFamily:"system-ui" }}>{value}</div></div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div><div style={{ fontSize:9, color:"#6b7280", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div><div style={{ fontSize:12, fontWeight:800, color, fontFamily:"monospace", marginTop:2 }}>{value}</div></div>
  );
}

function WeeklyTile({ label, value, color, sub }: { label: string; value: string; color: string; sub: string }) {
  return (
    <div style={cardSm}><div style={{ fontSize:10, color:"#6b7280", fontWeight:800, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>{label}</div><div style={{ fontSize:18, fontWeight:900, color, fontFamily:"system-ui", lineHeight:1.2 }}>{value}</div><div style={{ fontSize:11, color:"#6b7280", marginTop:6, fontWeight:600 }}>{sub}</div></div>
  );
}
