"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────
type FirmKey = "apex" | "topstep" | "ftmo" | "mff" | "bulenox" | "custom";
type PhaseKey =
  | "eval"          // Apex / MFF / Bulenox / Custom evaluation
  | "pa"            // Apex Performance Account
  | "combine"       // Topstep Trading Combine
  | "express"       // Topstep Express Funded
  | "phase1"        // FTMO Phase 1
  | "phase2"        // FTMO Phase 2
  | "ftmo_funded"   // FTMO Funded
  | "funded";       // Generic funded for MFF/Bulenox/Custom

interface ChallengeAccount {
  id:              string;
  name:            string;
  firm:            FirmKey;
  accountSize:     number;
  phase:           PhaseKey;
  startingBalance: number;
  peakBalance:     number;
  startDate:       string;
  dailyLoss:       number;     // 0 = no daily limit
  maxDrawdown:     number;
  profitTarget:    number;     // 0 = no target (funded)
  minTradingDays:  number;
  consistencyMax:  number;     // 0 = no consistency rule
  trailingType:    "eod" | "intraday";
  maxContracts:    number;     // 0 = not tracked
  trailingLocksAt: number;     // 0 = no lock. Positive $ offset from starting balance (e.g. 100 = locks at start+$100)
  benchmarkDays:   number;     // 0 = not required. e.g. 5 for Topstep
  profitableDays:  number;     // 0 = not required. e.g. 5 of 8 for Apex PA
  createdAt:       number;
}

interface Trade { id?:string; date:string; pnl:number; symbol?:string; pair?:string; side?:string; }

// ── Firms + phase definitions ─────────────────────────────────────
const FIRMS: Record<FirmKey, { label:string; color:string; accent:string; sizes:number[]; tagline:string; }> = {
  apex:    { label:"Apex Trader Funding", color:"#22c55e", accent:"rgba(34,197,94,0.10)",  sizes:[25000,50000,100000,150000,250000], tagline:"4.0 — March 2026" },
  topstep: { label:"Topstep",             color:"#f97316", accent:"rgba(249,115,22,0.10)", sizes:[50000,100000,150000],               tagline:"2026 ruleset" },
  ftmo:    { label:"FTMO",                color:"#3b82f6", accent:"rgba(59,130,246,0.10)", sizes:[10000,25000,50000,100000,200000],   tagline:"Two-phase eval" },
  mff:     { label:"MyFundedFutures",     color:"#a855f7", accent:"rgba(168,85,247,0.10)", sizes:[50000,100000,150000],               tagline:"2026" },
  bulenox: { label:"Bulenox",             color:"#ef4444", accent:"rgba(239,68,68,0.10)",  sizes:[25000,50000,100000],                tagline:"2026" },
  custom:  { label:"Custom",              color:"#64748b", accent:"rgba(100,116,139,0.10)",sizes:[10000,25000,50000,100000,150000,200000,250000], tagline:"Manual rules" },
};

const FIRM_PHASES: Record<FirmKey, Array<{ key:PhaseKey; label:string; sub?:string }>> = {
  apex: [
    { key:"eval", label:"Evaluation",                sub:"Pass the challenge" },
    { key:"pa",   label:"Performance Account (PA)",  sub:"Live funded — payout phase" },
  ],
  topstep: [
    { key:"combine", label:"Trading Combine", sub:"Evaluation" },
    { key:"express", label:"Express Funded",  sub:"Live funded — payout phase" },
  ],
  ftmo: [
    { key:"phase1",      label:"Phase 1 (Challenge)",   sub:"10% target" },
    { key:"phase2",      label:"Phase 2 (Verification)", sub:"5% target" },
    { key:"ftmo_funded", label:"FTMO Funded",           sub:"Live profit split" },
  ],
  mff: [
    { key:"eval",   label:"Evaluation", sub:"Pass the challenge" },
    { key:"funded", label:"Funded",     sub:"Live account" },
  ],
  bulenox: [
    { key:"eval",   label:"Evaluation", sub:"Pass the challenge" },
    { key:"funded", label:"Funded",     sub:"Live account" },
  ],
  custom: [
    { key:"eval",   label:"Evaluation", sub:"Pre-funded" },
    { key:"funded", label:"Funded",     sub:"Live account" },
  ],
};

// ── Phase Rules (2026 accurate) ───────────────────────────────────
interface PhaseRule {
  dailyLoss:       number;
  maxDrawdown:     number;
  profitTarget:    number;
  minTradingDays:  number;
  consistencyMax:  number;
  trailingType:    "eod" | "intraday";
  maxContracts:    number;
  trailingLocksAt: number;
  benchmarkDays:   number;
  profitableDays:  number;
}

const blank: PhaseRule = { dailyLoss:0, maxDrawdown:0, profitTarget:0, minTradingDays:0, consistencyMax:0, trailingType:"eod", maxContracts:0, trailingLocksAt:0, benchmarkDays:0, profitableDays:0 };

const RULES: Record<FirmKey, Partial<Record<PhaseKey, Record<number, PhaseRule>>>> = {
  apex: {
    eval: {
      25000:  { ...blank, maxDrawdown:1500, profitTarget:1500,  trailingType:"eod", maxContracts:10 },
      50000:  { ...blank, maxDrawdown:2500, profitTarget:3000,  trailingType:"eod", maxContracts:14 },
      100000: { ...blank, maxDrawdown:3000, profitTarget:6000,  trailingType:"eod", maxContracts:20 },
      150000: { ...blank, maxDrawdown:4500, profitTarget:9000,  trailingType:"eod", maxContracts:25 },
      250000: { ...blank, maxDrawdown:6500, profitTarget:15000, trailingType:"eod", maxContracts:35 },
    },
    pa: {
      25000:  { ...blank, maxDrawdown:1500, consistencyMax:50, trailingLocksAt:100, maxContracts:6,  profitableDays:5, minTradingDays:8 },
      50000:  { ...blank, maxDrawdown:2500, consistencyMax:50, trailingLocksAt:100, maxContracts:8,  profitableDays:5, minTradingDays:8 },
      100000: { ...blank, maxDrawdown:3000, consistencyMax:50, trailingLocksAt:100, maxContracts:12, profitableDays:5, minTradingDays:8 },
      150000: { ...blank, maxDrawdown:4500, consistencyMax:50, trailingLocksAt:100, maxContracts:16, profitableDays:5, minTradingDays:8 },
      250000: { ...blank, maxDrawdown:6500, consistencyMax:50, trailingLocksAt:100, maxContracts:20, profitableDays:5, minTradingDays:8 },
    },
  },
  topstep: {
    combine: {
      50000:  { ...blank, dailyLoss:1000, maxDrawdown:2000, profitTarget:3000, benchmarkDays:5 },
      100000: { ...blank, dailyLoss:2000, maxDrawdown:3000, profitTarget:6000, benchmarkDays:5 },
      150000: { ...blank, dailyLoss:3000, maxDrawdown:4500, profitTarget:9000, benchmarkDays:5 },
    },
    express: {
      50000:  { ...blank, dailyLoss:1000, maxDrawdown:2000, consistencyMax:40, benchmarkDays:5 },
      100000: { ...blank, dailyLoss:2000, maxDrawdown:3000, consistencyMax:40, benchmarkDays:5 },
      150000: { ...blank, dailyLoss:3000, maxDrawdown:4500, consistencyMax:40, benchmarkDays:5 },
    },
  },
  ftmo: {
    phase1: {
      10000:  { ...blank, dailyLoss:500,   maxDrawdown:1000,  profitTarget:1000,  minTradingDays:4 },
      25000:  { ...blank, dailyLoss:1250,  maxDrawdown:2500,  profitTarget:2500,  minTradingDays:4 },
      50000:  { ...blank, dailyLoss:2500,  maxDrawdown:5000,  profitTarget:5000,  minTradingDays:4 },
      100000: { ...blank, dailyLoss:5000,  maxDrawdown:10000, profitTarget:10000, minTradingDays:4 },
      200000: { ...blank, dailyLoss:10000, maxDrawdown:20000, profitTarget:20000, minTradingDays:4 },
    },
    phase2: {
      10000:  { ...blank, dailyLoss:500,   maxDrawdown:1000,  profitTarget:500,   minTradingDays:4 },
      25000:  { ...blank, dailyLoss:1250,  maxDrawdown:2500,  profitTarget:1250,  minTradingDays:4 },
      50000:  { ...blank, dailyLoss:2500,  maxDrawdown:5000,  profitTarget:2500,  minTradingDays:4 },
      100000: { ...blank, dailyLoss:5000,  maxDrawdown:10000, profitTarget:5000,  minTradingDays:4 },
      200000: { ...blank, dailyLoss:10000, maxDrawdown:20000, profitTarget:10000, minTradingDays:4 },
    },
    ftmo_funded: {
      10000:  { ...blank, dailyLoss:500,   maxDrawdown:1000  },
      25000:  { ...blank, dailyLoss:1250,  maxDrawdown:2500  },
      50000:  { ...blank, dailyLoss:2500,  maxDrawdown:5000  },
      100000: { ...blank, dailyLoss:5000,  maxDrawdown:10000 },
      200000: { ...blank, dailyLoss:10000, maxDrawdown:20000 },
    },
  },
  mff: {
    eval: {
      50000:  { ...blank, dailyLoss:2000, maxDrawdown:2500, profitTarget:3000, minTradingDays:1 },
      100000: { ...blank, dailyLoss:3500, maxDrawdown:5000, profitTarget:6000, minTradingDays:1 },
      150000: { ...blank, dailyLoss:5000, maxDrawdown:7500, profitTarget:9000, minTradingDays:1 },
    },
    funded: {
      50000:  { ...blank, dailyLoss:2000, maxDrawdown:2500 },
      100000: { ...blank, dailyLoss:3500, maxDrawdown:5000 },
      150000: { ...blank, dailyLoss:5000, maxDrawdown:7500 },
    },
  },
  bulenox: {
    eval: {
      25000:  { ...blank, dailyLoss:1500, maxDrawdown:1500, profitTarget:1500, minTradingDays:1 },
      50000:  { ...blank, dailyLoss:2000, maxDrawdown:2500, profitTarget:3000, minTradingDays:1 },
      100000: { ...blank, dailyLoss:3500, maxDrawdown:5000, profitTarget:5000, minTradingDays:1 },
    },
    funded: {
      25000:  { ...blank, dailyLoss:1500, maxDrawdown:1500 },
      50000:  { ...blank, dailyLoss:2000, maxDrawdown:2500 },
      100000: { ...blank, dailyLoss:3500, maxDrawdown:5000 },
    },
  },
  custom: {
    eval: {
      10000:  { ...blank, dailyLoss:500,   maxDrawdown:1000,  profitTarget:1000  },
      25000:  { ...blank, dailyLoss:1250,  maxDrawdown:2500,  profitTarget:2500  },
      50000:  { ...blank, dailyLoss:2500,  maxDrawdown:5000,  profitTarget:5000  },
      100000: { ...blank, dailyLoss:5000,  maxDrawdown:10000, profitTarget:10000 },
      150000: { ...blank, dailyLoss:7500,  maxDrawdown:15000, profitTarget:15000 },
      200000: { ...blank, dailyLoss:10000, maxDrawdown:20000, profitTarget:20000 },
      250000: { ...blank, dailyLoss:12500, maxDrawdown:25000, profitTarget:25000 },
    },
    funded: {
      10000:  { ...blank, dailyLoss:500,   maxDrawdown:1000  },
      25000:  { ...blank, dailyLoss:1250,  maxDrawdown:2500  },
      50000:  { ...blank, dailyLoss:2500,  maxDrawdown:5000  },
      100000: { ...blank, dailyLoss:5000,  maxDrawdown:10000 },
      150000: { ...blank, dailyLoss:7500,  maxDrawdown:15000 },
      200000: { ...blank, dailyLoss:10000, maxDrawdown:20000 },
      250000: { ...blank, dailyLoss:12500, maxDrawdown:25000 },
    },
  },
};

function getRule(firm:FirmKey, phase:PhaseKey, size:number): PhaseRule {
  const firmRules = RULES[firm];
  const phaseRules = firmRules?.[phase];
  if (phaseRules && phaseRules[size]) return phaseRules[size];
  // Fall back to closest size in custom
  return RULES.custom.eval?.[size] ?? blank;
}

// Normalize phase when firm changes — pick first valid phase
function normalizePhase(firm:FirmKey, phase:PhaseKey): PhaseKey {
  const phases = FIRM_PHASES[firm].map(p => p.key);
  if (phases.includes(phase)) return phase;
  return phases[0];
}

// Backwards-compat: legacy phase strings ("funded_pa", etc.) → new
function migratePhase(firm:FirmKey, raw:string): PhaseKey {
  const phases = FIRM_PHASES[firm].map(p => p.key);
  if (phases.includes(raw as PhaseKey)) return raw as PhaseKey;
  // Map legacy
  if (firm === "apex"    && (raw === "funded_pa" || raw === "express")) return "pa";
  if (firm === "topstep" && raw === "funded_pa") return "express";
  if (firm === "ftmo"    && raw === "eval")       return "phase1";
  if (firm === "ftmo"    && raw === "funded_pa")  return "ftmo_funded";
  if (raw === "funded_pa" || raw === "express")   return "funded";
  return phases[0];
}

// ── Phase warnings ────────────────────────────────────────────────
function getPhaseWarnings(firm:FirmKey, phase:PhaseKey): string[] {
  const k = `${firm}.${phase}`;
  switch (k) {
    case "apex.eval":
      return [
        "No trading 8 mins before/after NFP, CPI, FOMC",
        "No overnight positions — flat by session close",
        "Trailing drawdown applies — protect your peak balance",
        "No consistency rule during evaluation",
        "No minimum trading days (removed in Apex 4.0)",
      ];
    case "apex.pa":
      return [
        "⚠️ Contract limits drop significantly in PA vs Eval — adjust your strategy",
        "Trailing drawdown locks at starting balance + $100 (becomes fixed floor)",
        "50% consistency rule on payouts: no single day > 50% of total profits",
        "Need 8 trading days, 5 must be profitable, for first payout",
        "100% of first $25K profit, then 90/10 split",
        "No overnight positions still applies",
        "No trading 8 mins before/after NFP, CPI, FOMC",
      ];
    case "topstep.combine":
      return [
        "Must be flat by 3:10 PM CT — no overnight positions",
        "Minimum 5 benchmark days ($150+ profit each)",
        "No consistency rule for passing — only for payouts",
        "End-of-day trailing drawdown",
      ];
    case "topstep.express":
      return [
        "Must be flat by 3:10 PM CT — no overnight positions",
        "40% consistency rule for payouts (stricter than combine's 30%)",
        "Need 5 benchmark days ($150+) before first payout",
        "Payout requires 3+ days after hitting 40% consistency target",
        "Payout capped at 50% of balance or $5,000 max",
        "90/10 split (legacy traders 100% first $10K)",
      ];
    case "ftmo.phase1":
      return [
        "Profit target: 10% of account",
        "Daily loss: 5% of account · Max drawdown: 10% of account",
        "Minimum 4 trading days",
        "No consistency rule",
      ];
    case "ftmo.phase2":
      return [
        "Profit target: 5% of account (HALF of Phase 1)",
        "Daily loss: 5% of account · Max drawdown: 10% of account",
        "Minimum 4 trading days",
        "No consistency rule",
      ];
    case "ftmo.ftmo_funded":
      return [
        "No profit target — you're live",
        "Daily loss: 5% · Max drawdown: 10%",
        "80/20 profit split (scaling to 90/10)",
        "Scaling plan available",
      ];
    case "mff.eval":
      return ["Trailing drawdown until target hit", "No overnight positions on evaluation"];
    case "mff.funded":
      return ["Drawdown locks at starting balance", "Live account — payout phase"];
    case "bulenox.eval":
      return ["End-of-day drawdown", "No overnight positions during evaluation"];
    case "bulenox.funded":
      return ["End-of-day drawdown", "Live account — payout phase"];
    default:
      return ["Custom rules — verify against your firm's current ruleset"];
  }
}

// ── Rule tooltips (plain-English explanations) ────────────────────
const TOOLTIPS = {
  dailyLoss:      "The maximum you can lose in a single trading day. Hit this and your account is breached. Resets at midnight CT.",
  maxDrawdown:    "How far below your peak balance you can go before failing. Most firms trail this up with your profits.",
  profitTarget:   "Profit you need to reach to pass to the next phase, get funded, or qualify for a payout.",
  minTradingDays: "Minimum number of days you must place at least one trade before passing or requesting a payout.",
  consistencyMax: "No single day's profit can exceed this percentage of your total profits. Prevents one lucky day from passing you.",
  maxContracts:   "Maximum number of contracts you can hold open at once. Hitting this limit is a hard rule breach.",
  trailingLocks:  "After your peak reaches a certain level, the drawdown floor locks in place and stops trailing up.",
  benchmarkDays:  "Trading days where you made at least $150 in profit. Required by Topstep before your first payout.",
};

// ── Storage ───────────────────────────────────────────────────────
function getUsername(): string {
  try { return JSON.parse(localStorage.getItem("tradedesk_session_v1") ?? "{}").username ?? "guest"; }
  catch { return "guest"; }
}
function challengeKey(u:string) { return `nexyru_challenge_${u}`; }
function tradesKey(u:string)    { return `tradedesk_trades_${u}_v1`; }

function loadAccounts(u:string): ChallengeAccount[] {
  try {
    const r = localStorage.getItem(challengeKey(u));
    if (!r) return [];
    const j = JSON.parse(r);
    if (!Array.isArray(j)) return [];
    // Migrate legacy phases
    return j.map((a:ChallengeAccount) => ({
      ...a,
      phase: migratePhase(a.firm, a.phase as string),
      maxContracts:    a.maxContracts    ?? 0,
      trailingLocksAt: a.trailingLocksAt ?? 0,
      benchmarkDays:   a.benchmarkDays   ?? 0,
      profitableDays:  a.profitableDays  ?? 0,
    }));
  } catch { return []; }
}
function saveAccounts(u:string, accs:ChallengeAccount[]) {
  try { localStorage.setItem(challengeKey(u), JSON.stringify(accs)); } catch {}
}
function loadTrades(u:string): Trade[] {
  try { const r = localStorage.getItem(tradesKey(u)); return r ? JSON.parse(r) : []; } catch { return []; }
}

// ── Math ─────────────────────────────────────────────────────────
function isSameDay(a:Date, b:Date) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function dayKey(d:Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

interface DayStat { dateKey:string; date:Date; pnl:number; trades:Trade[]; }
function groupByDay(trades:Trade[]): Record<string, DayStat> {
  const out:Record<string,DayStat> = {};
  for (const t of trades) {
    const d = new Date(t.date);
    if (isNaN(d.getTime())) continue;
    const k = dayKey(d);
    if (!out[k]) out[k] = { dateKey:k, date:new Date(d.getFullYear(),d.getMonth(),d.getDate()), pnl:0, trades:[] };
    out[k].pnl += t.pnl ?? 0;
    out[k].trades.push(t);
  }
  return out;
}

interface Computed {
  todayPnl:         number;
  todayTrades:      Trade[];
  dailyLossUsed:    number;
  currentBalance:   number;
  peakBalance:      number;
  effectivePeak:    number;     // capped if trailing locks
  drawdownUsed:     number;
  totalProfit:      number;
  tradingDaysDone:  number;
  benchmarkDaysDone:number;
  profitableDaysDone:number;
  bestDayPnl:       number;
  consistencyScore: number;
  consistencyRatio: number;
  trailingIsLocked: boolean;
  byDay:            Record<string, DayStat>;
}

function computeStats(acc:ChallengeAccount, allTrades:Trade[]): Computed {
  const start = new Date(acc.startDate + "T00:00:00");
  const trades = allTrades.filter(t => {
    const d = new Date(t.date);
    return !isNaN(d.getTime()) && d.getTime() >= start.getTime();
  });

  const sorted = [...trades].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const today = new Date();
  const todayTrades = sorted.filter(t => isSameDay(new Date(t.date), today));
  const todayPnl = todayTrades.reduce((s,t) => s + (t.pnl ?? 0), 0);
  const dailyLossUsed = todayPnl < 0 ? Math.abs(todayPnl) : 0;

  const totalProfit = sorted.reduce((s,t) => s + (t.pnl ?? 0), 0);
  const currentBalance = acc.startingBalance + totalProfit;

  let bal = acc.startingBalance;
  let peak = acc.peakBalance && acc.peakBalance >= acc.startingBalance ? acc.peakBalance : acc.startingBalance;
  for (const t of sorted) {
    bal += t.pnl ?? 0;
    if (bal > peak) peak = bal;
  }

  // Trailing lock: once peak reaches startingBalance + maxDrawdown + trailingLocksAt, peak caps there
  const lockThreshold = acc.trailingLocksAt > 0
    ? acc.startingBalance + acc.maxDrawdown + acc.trailingLocksAt
    : Infinity;
  const trailingIsLocked = peak >= lockThreshold;
  const effectivePeak = trailingIsLocked ? lockThreshold : peak;
  const drawdownUsed = Math.max(0, effectivePeak - currentBalance);

  const byDay = groupByDay(sorted);
  const allDays = Object.values(byDay);
  const profitableDaysDone = allDays.filter(d => d.pnl > 0).length;
  const tradingDaysDone = allDays.filter(d => d.trades.length > 0).length;
  const benchmarkDaysDone = allDays.filter(d => d.pnl >= 150).length;
  const bestDayPnl = allDays.reduce((m,d) => Math.max(m, d.pnl), 0);

  let consistencyScore = 100;
  let consistencyRatio = 0;
  if (acc.consistencyMax > 0 && totalProfit > 0 && bestDayPnl > 0) {
    consistencyRatio = (bestDayPnl / totalProfit) * 100;
    consistencyScore = consistencyRatio <= acc.consistencyMax
      ? 100
      : Math.max(0, Math.round(100 - (consistencyRatio - acc.consistencyMax) * 2));
  }

  return { todayPnl, todayTrades, dailyLossUsed, currentBalance, peakBalance:peak, effectivePeak, drawdownUsed, totalProfit, tradingDaysDone, benchmarkDaysDone, profitableDaysDone, bestDayPnl, consistencyScore, consistencyRatio, trailingIsLocked, byDay };
}

// ── Ring ─────────────────────────────────────────────────────────
function Ring({ value, max, size=170, thickness=13, centerBig, centerSub, mode="loss", forceColor }:{
  value:number; max:number; size?:number; thickness?:number;
  centerBig?:string; centerSub?:string;
  mode?:"loss"|"fill"; forceColor?:string;
}) {
  const pct = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  let color = "#22c55e";
  if (forceColor) color = forceColor;
  else if (mode === "loss") {
    if (pct >= 80) color = "#ef4444";
    else if (pct >= 50) color = "#f59e0b";
    else color = "#22c55e";
  } else {
    color = pct >= 100 ? "#22c55e" : "#3b82f6";
  }

  return (
    <div style={{ position:"relative", width:size, height:size }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} stroke="#0f1a2e" strokeWidth={thickness} fill="none"/>
        <circle
          cx={size/2} cy={size/2} r={r}
          stroke={color} strokeWidth={thickness} fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition:"stroke-dasharray 0.7s ease, stroke 0.4s" }}
        />
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:"0 8px" }}>
        {centerBig && <div style={{ fontSize:17, fontWeight:900, color:"#f0f4ff", fontFamily:"monospace", lineHeight:1.2 }}>{centerBig}</div>}
        {centerSub && <div style={{ fontSize:10, fontWeight:600, color:"#4a5a7a", marginTop:4 }}>{centerSub}</div>}
      </div>
    </div>
  );
}

// ── Tooltip icon ─────────────────────────────────────────────────
function Info({ text }:{ text:string }) {
  return (
    <span title={text} style={{
      display:"inline-flex", alignItems:"center", justifyContent:"center",
      width:14, height:14, borderRadius:"50%",
      background:"#1a2540", color:"#7a8aa8",
      fontSize:9, fontWeight:800, cursor:"help", marginLeft:6, flexShrink:0,
      fontStyle:"italic", fontFamily:"serif",
    }}>i</span>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const inp:React.CSSProperties = { width:"100%", padding:"10px 12px", borderRadius:9, border:"1px solid #1a2540", background:"#0d1628", color:"#f0f4ff", fontSize:13, fontWeight:700, fontFamily:"monospace", outline:"none", boxSizing:"border-box" };
const lbl:React.CSSProperties = { fontSize:10, fontWeight:700, color:"#4a5a7a", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 };
const card:React.CSSProperties = { background:"#0b1120", border:"1px solid #1a2540", borderRadius:18 };

function fmtUSD(n:number) { return (n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 }); }
function fmtUSDsigned(n:number) { return (n >= 0 ? "+" : "-") + "$" + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 }); }

// ── Setup Form ────────────────────────────────────────────────────
function SetupForm({ initial, onSave, onCancel }:{ initial?:ChallengeAccount; onSave:(a:ChallengeAccount)=>void; onCancel?:()=>void; }) {
  const [firm, setFirm]     = useState<FirmKey>(initial?.firm ?? "apex");
  const sizes = FIRMS[firm].sizes;
  const [size, setSize]     = useState<number>(initial?.accountSize ?? sizes[0]);
  const [phase, setPhase]   = useState<PhaseKey>(initial?.phase ?? FIRM_PHASES[firm][0].key);
  const [name, setName]     = useState<string>(initial?.name ?? "");
  const [starting, setStarting] = useState<string>(String(initial?.startingBalance ?? sizes[0]));
  const [startDate, setStartDate] = useState<string>(initial?.startDate ?? new Date().toISOString().slice(0,10));

  // Track current rule snapshot
  const rule = useMemo(() => getRule(firm, phase, size), [firm, phase, size]);

  // Editable rule values
  const [dailyLoss,       setDailyLoss]       = useState<string>(String(initial?.dailyLoss       ?? rule.dailyLoss));
  const [maxDrawdown,     setMaxDrawdown]     = useState<string>(String(initial?.maxDrawdown     ?? rule.maxDrawdown));
  const [profitTarget,    setProfitTarget]    = useState<string>(String(initial?.profitTarget    ?? rule.profitTarget));
  const [minTradingDays,  setMinTradingDays]  = useState<string>(String(initial?.minTradingDays  ?? rule.minTradingDays));
  const [consistencyMax,  setConsistencyMax]  = useState<string>(String(initial?.consistencyMax  ?? rule.consistencyMax));
  const [maxContracts,    setMaxContracts]    = useState<string>(String(initial?.maxContracts    ?? rule.maxContracts));
  const [trailingLocksAt, setTrailingLocksAt] = useState<string>(String(initial?.trailingLocksAt ?? rule.trailingLocksAt));
  const [benchmarkDays,   setBenchmarkDays]   = useState<string>(String(initial?.benchmarkDays   ?? rule.benchmarkDays));
  const [trailingType,    setTrailingType]    = useState<"eod"|"intraday">(initial?.trailingType ?? rule.trailingType);

  // Phase-changed banner
  const [phaseChanged, setPhaseChanged] = useState(false);
  const prevPhase = useRef<PhaseKey>(phase);
  const prevFirm  = useRef<FirmKey>(firm);
  const isFirstRender = useRef(true);

  // When firm changes, snap phase + size
  useEffect(() => {
    if (!FIRMS[firm].sizes.includes(size)) setSize(FIRMS[firm].sizes[0]);
    setPhase(prev => normalizePhase(firm, prev));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firm]);

  // When firm/phase/size changes — replace ALL rule fields with new preset
  useEffect(() => {
    const r = getRule(firm, phase, size);
    setDailyLoss(String(r.dailyLoss));
    setMaxDrawdown(String(r.maxDrawdown));
    setProfitTarget(String(r.profitTarget));
    setMinTradingDays(String(r.minTradingDays));
    setConsistencyMax(String(r.consistencyMax));
    setMaxContracts(String(r.maxContracts));
    setTrailingLocksAt(String(r.trailingLocksAt));
    setBenchmarkDays(String(r.benchmarkDays));
    setTrailingType(r.trailingType);
    if (!initial) setStarting(String(size));

    // Banner when phase changes (skip on first render)
    if (!isFirstRender.current && (prevPhase.current !== phase || prevFirm.current !== firm)) {
      setPhaseChanged(true);
      const t = setTimeout(() => setPhaseChanged(false), 5000);
      return () => clearTimeout(t);
    }
    isFirstRender.current = false;
    prevPhase.current = phase;
    prevFirm.current = firm;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firm, phase, size]);

  const save = () => {
    const r = getRule(firm, phase, size);
    const acc:ChallengeAccount = {
      id:              initial?.id ?? `ch_${Date.now()}`,
      name:            name.trim() || `${FIRMS[firm].label} ${size/1000}K`,
      firm,
      accountSize:     size,
      phase,
      startingBalance: parseFloat(starting) || size,
      peakBalance:     initial?.peakBalance ?? (parseFloat(starting) || size),
      startDate:       startDate,
      dailyLoss:       parseFloat(dailyLoss)       || 0,
      maxDrawdown:     parseFloat(maxDrawdown)     || r.maxDrawdown,
      profitTarget:    parseFloat(profitTarget)    || 0,
      minTradingDays:  parseInt(minTradingDays, 10) || 0,
      consistencyMax:  parseFloat(consistencyMax)  || 0,
      maxContracts:    parseInt(maxContracts, 10)  || 0,
      trailingLocksAt: parseFloat(trailingLocksAt) || 0,
      benchmarkDays:   parseInt(benchmarkDays, 10) || 0,
      profitableDays:  initial?.profitableDays    ?? r.profitableDays,
      trailingType,
      createdAt:       initial?.createdAt ?? Date.now(),
    };
    onSave(acc);
  };

  const phases = FIRM_PHASES[firm];
  const currentPhaseDef = phases.find(p => p.key === phase) ?? phases[0];

  // Rules to show (some hidden per phase)
  const isFundedPhase = phase === "pa" || phase === "express" || phase === "ftmo_funded" || phase === "funded";

  return (
    <div style={{ maxWidth:720, margin:"0 auto" }}>
      <div style={{ textAlign:"center", marginBottom:24 }}>
        <div style={{ fontSize:42, marginBottom:8 }}>🏆</div>
        <h2 style={{ fontSize:22, fontWeight:900, color:"#f0f4ff", margin:"0 0 6px" }}>{initial ? "Edit Challenge Account" : "Set Up Your Challenge"}</h2>
        <p style={{ fontSize:12, color:"#4a5a7a", margin:0 }}>2026 prop firm rules — each phase has its own ruleset.</p>
      </div>

      <div style={{ ...card, padding:24 }}>
        {/* Firm picker */}
        <div style={{ marginBottom:18 }}>
          <label style={lbl}>Prop Firm</label>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:8 }}>
            {(Object.keys(FIRMS) as FirmKey[]).map(k => {
              const f = FIRMS[k];
              const active = firm === k;
              return (
                <button key={k} onClick={()=>setFirm(k)} style={{
                  padding:"12px 12px", borderRadius:11,
                  border:`1px solid ${active ? f.color : "#1a2540"}`,
                  background: active ? f.accent : "#0d1628",
                  color: active ? f.color : "#7a8aa8",
                  fontSize:12, fontWeight:800, cursor:"pointer", textAlign:"left",
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                    <span style={{ width:10, height:10, borderRadius:3, background:f.color, display:"inline-block" }}/>
                    {f.label}
                  </div>
                  <div style={{ fontSize:9, color: active ? f.color : "#4a5a7a", opacity:0.8, fontWeight:600 }}>{f.tagline}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Account size */}
        <div style={{ marginBottom:18 }}>
          <label style={lbl}>Account Size</label>
          <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(sizes.length,7)},1fr)`, gap:8 }}>
            {sizes.map(s => {
              const active = size === s;
              return (
                <button key={s} onClick={()=>setSize(s)} style={{
                  padding:"10px 4px", borderRadius:9,
                  border:`1px solid ${active ? FIRMS[firm].color : "#1a2540"}`,
                  background: active ? FIRMS[firm].accent : "#0d1628",
                  color: active ? FIRMS[firm].color : "#7a8aa8",
                  fontSize:13, fontWeight:800, fontFamily:"monospace", cursor:"pointer",
                }}>${s/1000}k</button>
              );
            })}
          </div>
        </div>

        {/* Phase picker */}
        <div style={{ marginBottom:18 }}>
          <label style={lbl}>Challenge Phase</label>
          <div style={{ display:"grid", gridTemplateColumns:`repeat(${phases.length},1fr)`, gap:8 }}>
            {phases.map(p => {
              const active = phase === p.key;
              return (
                <button key={p.key} onClick={()=>setPhase(p.key)} style={{
                  padding:"10px 12px", borderRadius:10,
                  border:`1px solid ${active ? FIRMS[firm].color : "#1a2540"}`,
                  background: active ? FIRMS[firm].accent : "#0d1628",
                  color: active ? FIRMS[firm].color : "#7a8aa8",
                  fontSize:12, fontWeight:800, cursor:"pointer", textAlign:"left",
                }}>
                  <div>{p.label}</div>
                  {p.sub && <div style={{ fontSize:9, fontWeight:600, opacity:0.75, marginTop:2 }}>{p.sub}</div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Phase Rules Changed banner */}
        {phaseChanged && (
          <div style={{
            padding:"10px 14px", borderRadius:10,
            background:"rgba(245,158,11,0.10)", border:"1px solid rgba(245,158,11,0.4)",
            color:"#f59e0b", fontSize:12, fontWeight:800, marginBottom:14,
            display:"flex", alignItems:"center", gap:8,
          }}>
            <span>⚠️</span>
            <span>Phase Rules Changed — rules below have been reset to {currentPhaseDef.label}.</span>
          </div>
        )}

        {/* Name */}
        <div style={{ marginBottom:18 }}>
          <label style={lbl}>Account Nickname</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder={`${FIRMS[firm].label} ${size/1000}K`} style={inp}/>
        </div>

        {/* Start date + starting balance */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:18 }}>
          <div>
            <label style={lbl}>Start Date</label>
            <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} style={inp}/>
          </div>
          <div>
            <label style={lbl}>Starting Balance ($)</label>
            <input value={starting} onChange={e=>setStarting(e.target.value)} type="number" style={inp}/>
          </div>
        </div>

        {/* Rules */}
        <div style={{ padding:14, background:"#0d1628", borderRadius:12, border:"1px solid #1a2540", marginBottom:18 }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#94a3b8", marginBottom:12, display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:FIRMS[firm].color }}/>
            {FIRMS[firm].label} ${size/1000}K — {currentPhaseDef.label} Rules
          </div>

          <RuleRow label="Daily Loss Limit"   tip={TOOLTIPS.dailyLoss}      value={dailyLoss}      set={setDailyLoss}      prefix="$" zeroNote="No daily limit"/>
          <RuleRow label="Max Drawdown"       tip={TOOLTIPS.maxDrawdown}    value={maxDrawdown}    set={setMaxDrawdown}    prefix="$" />
          {!isFundedPhase && (
            <RuleRow label="Profit Target"    tip={TOOLTIPS.profitTarget}   value={profitTarget}   set={setProfitTarget}   prefix="$" />
          )}
          <RuleRow label="Min Trading Days"   tip={TOOLTIPS.minTradingDays} value={minTradingDays} set={setMinTradingDays} prefix=""  zeroNote="No minimum"/>
          <RuleRow label="Consistency Max %"  tip={TOOLTIPS.consistencyMax} value={consistencyMax} set={setConsistencyMax} prefix=""  zeroNote="No consistency rule"/>
          {firm === "apex" && (
            <RuleRow label="Max Contracts"    tip={TOOLTIPS.maxContracts}   value={maxContracts}   set={setMaxContracts}   prefix=""  zeroNote="Not tracked"/>
          )}
          {firm === "apex" && phase === "pa" && (
            <RuleRow label="Trailing Locks At (+$)" tip={TOOLTIPS.trailingLocks} value={trailingLocksAt} set={setTrailingLocksAt} prefix="$" zeroNote="No lock"/>
          )}
          {firm === "topstep" && (
            <RuleRow label="Benchmark Days ($150+)" tip={TOOLTIPS.benchmarkDays} value={benchmarkDays} set={setBenchmarkDays} prefix="" zeroNote="Not required"/>
          )}

          {/* Trailing type */}
          <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr auto", gap:10, alignItems:"center", marginTop:8 }}>
            <div style={{ fontSize:11, color:"#7a8aa8", fontWeight:600, display:"flex", alignItems:"center" }}>
              Trailing Drawdown Type
              <Info text="EOD (end of day) trails based on closing balance. Intraday trails on live unrealized PnL — much riskier."/>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {(["eod","intraday"] as const).map(t => (
                <button key={t} onClick={()=>setTrailingType(t)} style={{
                  flex:1, padding:"8px 6px", borderRadius:8,
                  border:`1px solid ${trailingType === t ? FIRMS[firm].color : "#1a2540"}`,
                  background: trailingType === t ? FIRMS[firm].accent : "#0b1120",
                  color: trailingType === t ? FIRMS[firm].color : "#7a8aa8",
                  fontSize:11, fontWeight:800, cursor:"pointer",
                }}>{t === "eod" ? "End of Day" : "Intraday"}</button>
              ))}
            </div>
            <div style={{ minWidth:130 }}/>
          </div>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          {onCancel && <button onClick={onCancel} style={{ padding:"12px 18px", borderRadius:11, border:"1px solid #1a2540", background:"transparent", color:"#7a8aa8", fontSize:12, fontWeight:700, cursor:"pointer" }}>Cancel</button>}
          <button onClick={save} style={{ flex:1, padding:14, borderRadius:12, border:"none", background:`linear-gradient(135deg,${FIRMS[firm].color},#a78bfa)`, color:"#fff", fontSize:14, fontWeight:900, cursor:"pointer", letterSpacing:"0.02em" }}>
            {initial ? "💾 Save Changes" : "🚀 Start Tracking"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RuleRow({ label, tip, value, set, prefix, zeroNote }:{
  label:string; tip:string; value:string; set:(v:string)=>void; prefix:string; zeroNote?:string;
}) {
  const isZero = parseFloat(value) === 0;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr auto", gap:10, alignItems:"center", marginBottom:8 }}>
      <div style={{ fontSize:11, color:"#7a8aa8", fontWeight:600, display:"flex", alignItems:"center" }}>
        {label}
        <Info text={tip}/>
      </div>
      <div style={{ position:"relative" }}>
        {prefix && <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:12, color:"#3a4a6a", pointerEvents:"none" }}>{prefix}</span>}
        <input value={value} onChange={e=>set(e.target.value)} style={{ ...inp, paddingLeft: prefix ? 22 : 12 }}/>
      </div>
      <div style={{ fontSize:9, color:"#3a4a6a", whiteSpace:"nowrap", minWidth:130 }}>
        {isZero && zeroNote ? zeroNote : ""}
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────
function Dashboard({ account, stats, onEdit, onDelete }:{
  account:ChallengeAccount; stats:Computed; onEdit:()=>void; onDelete:()=>void;
}) {
  const firm = FIRMS[account.firm];
  const phaseDef = FIRM_PHASES[account.firm].find(p => p.key === account.phase) ?? FIRM_PHASES[account.firm][0];

  const hasDailyLimit = account.dailyLoss > 0;
  const hasTarget     = account.profitTarget > 0;
  const hasConsistency = account.consistencyMax > 0;

  const dailyPct = hasDailyLimit ? (stats.dailyLossUsed / account.dailyLoss) * 100 : 0;
  const ddPct    = account.maxDrawdown > 0 ? (stats.drawdownUsed / account.maxDrawdown) * 100 : 0;
  const dangerPct = Math.max(dailyPct, ddPct);
  const status =
    dangerPct >= 80 ? { label:"🚨 DANGER ZONE", color:"#ef4444", bg:"rgba(239,68,68,0.10)" } :
    dangerPct >= 50 ? { label:"⚠️ BE CAREFUL",   color:"#f59e0b", bg:"rgba(245,158,11,0.10)" } :
                      { label:"✅ ON TRACK",     color:"#22c55e", bg:"rgba(34,197,94,0.10)" };

  const profitNeeded   = Math.max(0, account.profitTarget - stats.totalProfit);
  const dailyRemaining = hasDailyLimit ? Math.max(0, account.dailyLoss - stats.dailyLossUsed) : 0;
  const ddRemaining    = Math.max(0, account.maxDrawdown - stats.drawdownUsed);

  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(()=>setNow(new Date()), 30000); return ()=>clearInterval(t); }, []);
  const sessionEnd = new Date(now); sessionEnd.setHours(16,0,0,0);
  const sessionMs = Math.max(0, sessionEnd.getTime() - now.getTime());
  const sessionH = Math.floor(sessionMs / 3600000);
  const sessionM = Math.floor((sessionMs % 3600000) / 60000);

  const warnings = getPhaseWarnings(account.firm, account.phase);

  // Topstep payout eligibility heuristic
  const topstepPayoutReady = account.firm === "topstep" && account.phase === "express"
    && stats.benchmarkDaysDone >= account.benchmarkDays && stats.consistencyScore >= 50;

  // Apex PA payout eligibility
  const apexPaPayoutReady = account.firm === "apex" && account.phase === "pa"
    && stats.tradingDaysDone >= account.minTradingDays && stats.profitableDaysDone >= account.profitableDays;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* Account header */}
      <div style={{ ...card, padding:"22px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:14, borderColor: firm.color + "55", background: `linear-gradient(135deg, #0b1120, ${firm.accent})` }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6, flexWrap:"wrap" }}>
            <span style={{ width:12, height:12, borderRadius:3, background:firm.color }}/>
            <span style={{ fontSize:18, fontWeight:900, color:"#f0f4ff" }}>{account.name}</span>
            <span style={{ fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:20, background:firm.accent, color:firm.color, border:`1px solid ${firm.color}44` }}>{firm.label}</span>
            <span style={{ fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:20, background:"#0d1628", color:"#7a8aa8", border:"1px solid #1a2540" }}>{phaseDef.label}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:14, fontSize:11, color:"#5a6a8a", flexWrap:"wrap" }}>
            <span>Size <strong style={{ color:"#f0f4ff", fontFamily:"monospace" }}>${(account.accountSize/1000).toFixed(0)}K</strong></span>
            <span>Started <strong style={{ color:"#f0f4ff", fontFamily:"monospace" }}>{account.startDate}</strong></span>
            <span>Peak <strong style={{ color:"#f0f4ff", fontFamily:"monospace" }}>{fmtUSD(stats.peakBalance)}</strong></span>
            {account.maxContracts > 0 && <span>Max contracts <strong style={{ color:"#f0f4ff", fontFamily:"monospace" }}>{account.maxContracts}</strong></span>}
            {stats.trailingIsLocked && <span style={{ color:"#22c55e", fontWeight:700 }}>🔒 Trailing locked</span>}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:10, color:"#5a6a8a", textTransform:"uppercase", letterSpacing:"0.08em" }}>Current Balance</div>
            <div style={{ fontSize:26, fontWeight:900, fontFamily:"monospace", color: stats.totalProfit >= 0 ? "#22c55e" : "#ef4444" }}>{fmtUSD(stats.currentBalance)}</div>
            <div style={{ fontSize:11, color: stats.totalProfit >= 0 ? "#22c55e" : "#ef4444", fontWeight:800, fontFamily:"monospace" }}>{fmtUSDsigned(stats.totalProfit)}</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <button onClick={onEdit} style={{ padding:"7px 12px", borderRadius:8, border:"1px solid #1a2540", background:"#0d1628", color:"#94a3b8", fontSize:11, fontWeight:700, cursor:"pointer" }}>Edit</button>
            <button onClick={onDelete} style={{ padding:"7px 12px", borderRadius:8, border:"1px solid rgba(239,68,68,0.25)", background:"transparent", color:"#ef4444", fontSize:11, fontWeight:700, cursor:"pointer" }}>Delete</button>
          </div>
        </div>
      </div>

      {/* 4 rings */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))", gap:14 }}>
        {/* Daily Loss */}
        <div style={{ ...card, padding:"22px 18px 18px", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.1em", display:"flex", alignItems:"center" }}>
            Daily Loss<Info text={TOOLTIPS.dailyLoss}/>
          </div>
          {hasDailyLimit ? (
            <>
              <Ring value={stats.dailyLossUsed} max={account.dailyLoss}
                centerBig={fmtUSD(stats.dailyLossUsed)} centerSub={`of ${fmtUSD(account.dailyLoss)}`} mode="loss"/>
              <div style={{ fontSize:12, fontWeight:700, color: dailyPct >= 80 ? "#ef4444" : dailyPct >= 50 ? "#f59e0b" : "#22c55e", textAlign:"center" }}>
                Can lose <span style={{ fontFamily:"monospace" }}>{fmtUSD(dailyRemaining)}</span> more today
              </div>
              <div style={{ fontSize:10, color:"#4a5a7a" }}>Resets at midnight CT</div>
            </>
          ) : (
            <>
              <Ring value={0} max={100} centerBig="N/A" centerSub="No daily limit" mode="loss" forceColor="#22c55e"/>
              <div style={{ fontSize:12, fontWeight:700, color:"#22c55e", textAlign:"center" }}>No daily limit — Apex 4.0</div>
              <div style={{ fontSize:10, color:"#4a5a7a", textAlign:"center" }}>Trailing drawdown applies instead</div>
            </>
          )}
        </div>

        {/* Max Drawdown */}
        <div style={{ ...card, padding:"22px 18px 18px", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.1em", display:"flex", alignItems:"center" }}>
            Max Drawdown<Info text={TOOLTIPS.maxDrawdown}/>
          </div>
          <Ring value={stats.drawdownUsed} max={account.maxDrawdown}
            centerBig={fmtUSD(stats.drawdownUsed)} centerSub={`of ${fmtUSD(account.maxDrawdown)}`} mode="loss"/>
          <div style={{ fontSize:12, fontWeight:700, color: ddPct >= 80 ? "#ef4444" : ddPct >= 50 ? "#f59e0b" : "#22c55e", textAlign:"center" }}>
            <span style={{ fontFamily:"monospace" }}>{fmtUSD(ddRemaining)}</span> buffer to breach
          </div>
          <div style={{ fontSize:10, color:"#4a5a7a", textAlign:"center" }}>
            {stats.trailingIsLocked
              ? `🔒 Locked at ${fmtUSD(account.startingBalance + account.trailingLocksAt)}`
              : `${account.trailingType === "intraday" ? "Intraday" : "EOD"} trailing · peak ${fmtUSD(stats.peakBalance)}`}
          </div>
        </div>

        {/* Profit Target — replaced with phase-specific card on funded phases */}
        {hasTarget ? (
          <div style={{ ...card, padding:"22px 18px 18px", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
            <div style={{ fontSize:11, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.1em", display:"flex", alignItems:"center" }}>
              Profit Target<Info text={TOOLTIPS.profitTarget}/>
            </div>
            <Ring value={Math.max(0, stats.totalProfit)} max={account.profitTarget}
              centerBig={fmtUSD(Math.max(0, stats.totalProfit))} centerSub={`of ${fmtUSD(account.profitTarget)}`} mode="fill"/>
            <div style={{ fontSize:12, fontWeight:700, color: profitNeeded === 0 ? "#22c55e" : "#3b82f6", textAlign:"center" }}>
              {profitNeeded === 0 ? "🏆 Target hit!" : <><span style={{ fontFamily:"monospace" }}>{fmtUSD(profitNeeded)}</span> more to pass</>}
            </div>
            <div style={{ fontSize:10, color:"#4a5a7a" }}>{phaseDef.label}</div>
          </div>
        ) : (
          <div style={{ ...card, padding:"22px 18px 18px", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
            <div style={{ fontSize:11, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.1em" }}>Total Profit</div>
            <Ring value={Math.max(0, stats.totalProfit)} max={Math.max(stats.totalProfit, account.accountSize * 0.05)}
              centerBig={fmtUSDsigned(stats.totalProfit)} centerSub="live funded" mode="fill"/>
            <div style={{ fontSize:12, fontWeight:700, color:"#22c55e", textAlign:"center" }}>
              {phaseDef.label} — no profit target
            </div>
            <div style={{ fontSize:10, color:"#4a5a7a", textAlign:"center" }}>
              {account.firm === "apex"    ? "100% first $25K, then 90/10"
                : account.firm === "topstep" ? "90/10 split (legacy 100% first $10K)"
                : account.firm === "ftmo"    ? "80/20 split (scaling to 90/10)"
                : "Live profit split"}
            </div>
          </div>
        )}

        {/* Consistency */}
        <div style={{ ...card, padding:"22px 18px 18px", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.1em", display:"flex", alignItems:"center" }}>
            Consistency<Info text={TOOLTIPS.consistencyMax}/>
          </div>
          {hasConsistency ? (
            <>
              <Ring value={stats.consistencyScore} max={100}
                centerBig={`${stats.consistencyScore}%`} centerSub={`max ${account.consistencyMax}%/day`} mode="fill"/>
              <div style={{ fontSize:12, fontWeight:700, color: stats.consistencyScore >= 70 ? "#22c55e" : stats.consistencyScore >= 40 ? "#f59e0b" : "#ef4444", textAlign:"center" }}>
                Best day {stats.consistencyRatio.toFixed(0)}% of total
              </div>
              <div style={{ fontSize:10, color:"#4a5a7a", textAlign:"center" }}>
                {fmtUSD(stats.bestDayPnl)} of {fmtUSD(Math.max(0, stats.totalProfit))}
              </div>
            </>
          ) : (
            <>
              <Ring value={100} max={100} centerBig="✓" centerSub="No rule" mode="fill" forceColor="#22c55e"/>
              <div style={{ fontSize:12, fontWeight:700, color:"#22c55e", textAlign:"center" }}>No consistency rule</div>
              <div style={{ fontSize:10, color:"#4a5a7a", textAlign:"center" }}>{phaseDef.label}</div>
            </>
          )}
        </div>
      </div>

      {/* Trading day counter — phase-specific */}
      <div style={{ ...card, padding:"18px 22px" }}>
        <TradingDaysPanel account={account} stats={stats} payoutReady={apexPaPayoutReady || topstepPayoutReady}/>
      </div>

      {/* Today panel */}
      <div style={{ ...card, padding:"20px 22px", borderColor: status.color + "44", background:`linear-gradient(135deg, #0b1120, ${status.bg})` }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:14, marginBottom:14 }}>
          <div>
            <div style={{ fontSize:11, color:"#5a6a8a", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Today</div>
            <div style={{ display:"flex", alignItems:"center", gap:18, flexWrap:"wrap" }}>
              <div>
                <div style={{ fontSize:10, color:"#4a5a7a" }}>PnL</div>
                <div style={{ fontSize:22, fontWeight:900, fontFamily:"monospace", color: stats.todayPnl >= 0 ? "#22c55e" : "#ef4444" }}>{fmtUSDsigned(stats.todayPnl)}</div>
              </div>
              <div>
                <div style={{ fontSize:10, color:"#4a5a7a" }}>Trades</div>
                <div style={{ fontSize:18, fontWeight:800, fontFamily:"monospace", color:"#f0f4ff" }}>{stats.todayTrades.length}</div>
              </div>
              <div>
                <div style={{ fontSize:10, color:"#4a5a7a" }}>Session ends in</div>
                <div style={{ fontSize:18, fontWeight:800, fontFamily:"monospace", color:"#f0f4ff" }}>{sessionH}h {sessionM}m</div>
              </div>
            </div>
          </div>
          <div style={{ fontSize:12, fontWeight:800, padding:"8px 16px", borderRadius:24, background:status.bg, color:status.color, border:`1px solid ${status.color}55`, letterSpacing:"0.04em" }}>
            {status.label}
          </div>
        </div>

        {hasDailyLimit && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
              <span style={{ fontSize:10, color:"#5a6a8a", fontWeight:700 }}>Daily loss used</span>
              <span style={{ fontSize:10, color: dailyPct >= 80 ? "#ef4444" : "#5a6a8a", fontWeight:700, fontFamily:"monospace" }}>
                {fmtUSD(stats.dailyLossUsed)} / {fmtUSD(account.dailyLoss)}
              </span>
            </div>
            <div style={{ height:6, borderRadius:3, background:"#0f1a2e", overflow:"hidden" }}>
              <div style={{
                width:`${Math.min(100, dailyPct)}%`, height:"100%",
                background: dailyPct >= 80 ? "linear-gradient(90deg,#ef4444,#fca5a5)" : dailyPct >= 50 ? "linear-gradient(90deg,#f59e0b,#fcd34d)" : "linear-gradient(90deg,#22c55e,#86efac)",
                borderRadius:3, transition:"width 0.5s",
              }}/>
            </div>
          </div>
        )}
      </div>

      {/* Phase rules / warnings */}
      <div style={{ ...card, padding:"18px 22px", borderColor:"rgba(245,158,11,0.25)", background:"linear-gradient(135deg, #0b1120, rgba(245,158,11,0.04))" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          <span style={{ fontSize:14 }}>⚠️</span>
          <div style={{ fontSize:11, fontWeight:800, color:"#f59e0b", textTransform:"uppercase", letterSpacing:"0.08em" }}>
            {firm.label} — {phaseDef.label} Rules
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {warnings.map((w,i) => (
            <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, fontSize:12, color:"#c8d8f0", lineHeight:1.5 }}>
              <span style={{ color:"#f59e0b", marginTop:2 }}>•</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      </div>

      <HistoryCalendar account={account} stats={stats}/>
    </div>
  );
}

// ── Trading days panel (phase-aware) ─────────────────────────────
function TradingDaysPanel({ account, stats, payoutReady }:{ account:ChallengeAccount; stats:Computed; payoutReady:boolean; }) {
  const isApexPa = account.firm === "apex" && account.phase === "pa";
  const isTopstep = account.firm === "topstep";

  if (isApexPa) {
    const daysOk = stats.tradingDaysDone >= account.minTradingDays;
    const profOk = stats.profitableDaysDone >= account.profitableDays;
    return (
      <>
        <div style={{ fontSize:11, color:"#5a6a8a", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>
          Apex PA Payout Eligibility
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <ProgressBar label="Trading days" current={stats.tradingDaysDone} required={account.minTradingDays} ok={daysOk}/>
          <ProgressBar label="Profitable days" current={stats.profitableDaysDone} required={account.profitableDays} ok={profOk}/>
        </div>
        <div style={{ fontSize:11, fontWeight:700, color: payoutReady ? "#22c55e" : "#94a3b8", marginTop:12 }}>
          {payoutReady ? "✅ Eligible to request payout" : "Both criteria needed for first payout"}
        </div>
      </>
    );
  }

  if (isTopstep) {
    const benchOk = stats.benchmarkDaysDone >= account.benchmarkDays;
    return (
      <>
        <div style={{ fontSize:11, color:"#5a6a8a", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8, display:"flex", alignItems:"center" }}>
          Benchmark Days ($150+ profit)<Info text={TOOLTIPS.benchmarkDays}/>
        </div>
        <ProgressBar label={`${stats.benchmarkDaysDone} of ${account.benchmarkDays} benchmark days`} current={stats.benchmarkDaysDone} required={account.benchmarkDays} ok={benchOk}/>
        <div style={{ fontSize:11, fontWeight:700, color: benchOk ? "#22c55e" : "#94a3b8", marginTop:10 }}>
          {benchOk ? (account.phase === "express" ? "✅ Eligible for payout requests" : "✅ Benchmark days met") : `${account.benchmarkDays - stats.benchmarkDaysDone} more benchmark days needed`}
        </div>
      </>
    );
  }

  // Generic min trading days
  return (
    <>
      <div style={{ fontSize:11, color:"#5a6a8a", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8, display:"flex", alignItems:"center" }}>
        Trading Days<Info text={TOOLTIPS.minTradingDays}/>
      </div>
      {account.minTradingDays > 0 ? (
        <ProgressBar label={`Day ${stats.tradingDaysDone} of ${account.minTradingDays} minimum`}
          current={stats.tradingDaysDone} required={account.minTradingDays} ok={stats.tradingDaysDone >= account.minTradingDays}/>
      ) : (
        <div style={{ fontSize:13, fontWeight:800, color:"#22c55e" }}>
          ✅ No minimum trading days {account.firm === "apex" ? "(Apex 4.0)" : ""}
        </div>
      )}
    </>
  );
}

function ProgressBar({ label, current, required, ok }:{ label:string; current:number; required:number; ok:boolean; }) {
  const pct = required > 0 ? Math.min(100, (current/required)*100) : 100;
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
        <span style={{ fontSize:11, color:"#94a3b8", fontWeight:700 }}>{label}</span>
        <span style={{ fontSize:11, color: ok ? "#22c55e" : "#5a6a8a", fontWeight:800, fontFamily:"monospace" }}>{current}/{required}</span>
      </div>
      <div style={{ height:7, borderRadius:4, background:"#0f1a2e", overflow:"hidden" }}>
        <div style={{
          width:`${pct}%`, height:"100%",
          background: ok ? "linear-gradient(90deg,#22c55e,#86efac)" : "linear-gradient(90deg,#3b82f6,#22c55e)",
          borderRadius:4, transition:"width 0.7s",
        }}/>
      </div>
    </div>
  );
}

// ── Calendar ─────────────────────────────────────────────────────
function HistoryCalendar({ account, stats }:{ account:ChallengeAccount; stats:Computed; }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selected, setSelected] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month+1, 0);
  const startOffset = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const cells: (Date | null)[] = [];
  for (let i=0; i<startOffset; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = cursor.toLocaleDateString("en-US",{ month:"long", year:"numeric" });

  function cellColor(d:Date): { bg:string; border:string; text:string; emoji?:string } {
    const k = dayKey(d);
    const day = stats.byDay[k];
    if (!day || (day.pnl === 0 && day.trades.length === 0)) return { bg:"#0d1628", border:"#1a2540", text:"#3a4a6a" };
    const lossPct = day.pnl < 0 && account.dailyLoss > 0 ? (Math.abs(day.pnl) / account.dailyLoss) * 100 : 0;
    if (lossPct >= 70) return { bg:"rgba(249,115,22,0.18)", border:"rgba(249,115,22,0.45)", text:"#fb923c", emoji:"⚠️" };
    if (day.pnl > 0)   return { bg:"rgba(34,197,94,0.14)",  border:"rgba(34,197,94,0.4)",   text:"#22c55e" };
    if (day.pnl < 0)   return { bg:"rgba(239,68,68,0.12)",  border:"rgba(239,68,68,0.35)",  text:"#ef4444" };
    return { bg:"#0d1628", border:"#1a2540", text:"#94a3b8" };
  }

  const selectedDay = selected ? stats.byDay[selected] : null;

  return (
    <div style={{ ...card, padding:"20px 22px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <div style={{ fontSize:11, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.08em" }}>📅 Trading History</div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={()=>setCursor(new Date(year, month-1, 1))} style={{ padding:"5px 10px", borderRadius:7, border:"1px solid #1a2540", background:"#0d1628", color:"#94a3b8", fontSize:12, fontWeight:700, cursor:"pointer" }}>←</button>
          <span style={{ fontSize:13, fontWeight:800, color:"#f0f4ff", minWidth:140, textAlign:"center" }}>{monthLabel}</span>
          <button onClick={()=>setCursor(new Date(year, month+1, 1))} style={{ padding:"5px 10px", borderRadius:7, border:"1px solid #1a2540", background:"#0d1628", color:"#94a3b8", fontSize:12, fontWeight:700, cursor:"pointer" }}>→</button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6, marginBottom:6 }}>
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
          <div key={d} style={{ fontSize:9, fontWeight:700, color:"#4a5a7a", textTransform:"uppercase", letterSpacing:"0.08em", textAlign:"center", paddingBottom:4 }}>{d}</div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} style={{ aspectRatio:"1.1", borderRadius:8, background:"transparent" }}/>;
          const c = cellColor(d);
          const k = dayKey(d);
          const day = stats.byDay[k];
          const isToday = isSameDay(d, new Date());
          const isSel = selected === k;
          return (
            <button
              key={i}
              onClick={() => day ? setSelected(isSel ? null : k) : null}
              disabled={!day}
              style={{
                aspectRatio:"1.1", borderRadius:9,
                border:`1px solid ${isSel ? "#a78bfa" : isToday ? "#a78bfa55" : c.border}`,
                background: c.bg, color: c.text,
                cursor: day ? "pointer" : "default",
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                gap:2, padding:4, position:"relative",
              }}
            >
              <div style={{ fontSize:12, fontWeight:800, color:isToday ? "#a78bfa" : c.text }}>{d.getDate()}</div>
              {day && day.pnl !== 0 && (
                <div style={{ fontSize:9, fontWeight:800, fontFamily:"monospace", color:c.text }}>
                  {day.pnl >= 0 ? "+" : "-"}${Math.abs(Math.round(day.pnl))}
                </div>
              )}
              {c.emoji && <div style={{ position:"absolute", top:2, right:3, fontSize:9 }}>{c.emoji}</div>}
            </button>
          );
        })}
      </div>

      <div style={{ display:"flex", flexWrap:"wrap", gap:14, marginTop:14, fontSize:10, color:"#5a6a8a" }}>
        {[
          { c:"#22c55e", l:"Profitable" },
          { c:"#ef4444", l:"Loss" },
          { c:"#fb923c", l:"Near daily limit" },
          { c:"#3a4a6a", l:"No trades" },
        ].map(x => (
          <div key={x.l} style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ width:8, height:8, borderRadius:2, background:x.c, display:"inline-block" }}/>
            {x.l}
          </div>
        ))}
      </div>

      {selectedDay && (
        <div style={{ marginTop:16, padding:14, borderRadius:11, background:"#0d1628", border:"1px solid #1a2540" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#f0f4ff" }}>
              {selectedDay.date.toLocaleDateString("en-US",{ weekday:"long", month:"long", day:"numeric" })}
            </div>
            <div style={{ fontSize:14, fontWeight:900, fontFamily:"monospace", color: selectedDay.pnl >= 0 ? "#22c55e" : "#ef4444" }}>
              {fmtUSDsigned(selectedDay.pnl)}
            </div>
          </div>
          <div style={{ fontSize:11, color:"#5a6a8a", marginBottom:10 }}>{selectedDay.trades.length} trade{selectedDay.trades.length === 1 ? "" : "s"}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {selectedDay.trades.slice(0, 12).map((t, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 10px", borderRadius:8, background:"#0b1120", border:"1px solid #1a2540" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:11, fontWeight:800, color:"#f0f4ff", fontFamily:"monospace" }}>{t.symbol ?? t.pair ?? "—"}</span>
                  {t.side && <span style={{ fontSize:9, fontWeight:700, color:"#94a3b8", padding:"1px 6px", borderRadius:4, background:"#1a2540" }}>{t.side}</span>}
                  <span style={{ fontSize:10, color:"#4a5a7a" }}>{new Date(t.date).toLocaleTimeString("en-US",{ hour:"2-digit", minute:"2-digit" })}</span>
                </div>
                <span style={{ fontSize:12, fontWeight:800, fontFamily:"monospace", color: (t.pnl ?? 0) >= 0 ? "#22c55e" : "#ef4444" }}>{fmtUSDsigned(t.pnl ?? 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────
export default function ChallengePage() {
  const [username, setUsername] = useState<string>("");
  const [accounts, setAccounts] = useState<ChallengeAccount[]>([]);
  const [trades, setTrades]     = useState<Trade[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode]         = useState<"view" | "new" | "edit">("view");
  const [loaded, setLoaded]     = useState(false);

  useEffect(() => {
    const u = getUsername();
    setUsername(u);
    const accs = loadAccounts(u);
    setAccounts(accs);
    setTrades(loadTrades(u));
    if (accs.length === 0) setMode("new");
    else setActiveId(accs[0].id);
    setLoaded(true);
  }, []);

  const active = useMemo(() => accounts.find(a => a.id === activeId) ?? null, [accounts, activeId]);
  const stats  = useMemo(() => active ? computeStats(active, trades) : null, [active, trades]);

  useEffect(() => {
    if (!active || !stats) return;
    if (stats.peakBalance > active.peakBalance) {
      const next = accounts.map(a => a.id === active.id ? { ...a, peakBalance: stats.peakBalance } : a);
      setAccounts(next);
      saveAccounts(username, next);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats?.peakBalance]);

  function upsertAccount(a:ChallengeAccount) {
    const exists = accounts.some(x => x.id === a.id);
    const next = exists ? accounts.map(x => x.id === a.id ? a : x) : [...accounts, a];
    setAccounts(next);
    saveAccounts(username, next);
    setActiveId(a.id);
    setMode("view");
  }
  function deleteAccount(id:string) {
    if (!confirm("Delete this challenge account? This can't be undone.")) return;
    const next = accounts.filter(a => a.id !== id);
    setAccounts(next);
    saveAccounts(username, next);
    if (next.length === 0) { setActiveId(null); setMode("new"); }
    else setActiveId(next[0].id);
  }

  if (!loaded) {
    return <div style={{ minHeight:"100vh", background:"#060d1a", display:"flex", alignItems:"center", justifyContent:"center", color:"#3a4a6a" }}>Loading…</div>;
  }

  return (
    <div style={{ minHeight:"100vh", background:"#060d1a", color:"#c8d8f0", fontFamily:"system-ui,-apple-system,sans-serif" }}>
      <div style={{ borderBottom:"1px solid #0d1628", background:"rgba(6,13,26,0.95)", padding:"14px 28px", display:"flex", alignItems:"center", gap:16, position:"sticky", top:0, zIndex:10, backdropFilter:"blur(8px)" }}>
        <a href="/dashboard" style={{ fontSize:12, color:"#3a4a6a", textDecoration:"none" }}>← Dashboard</a>
        <span style={{ fontSize:14, fontWeight:800, color:"#f0f4ff" }}>Challenge Tracker</span>
        <div style={{ flex:1 }}/>
        {accounts.length > 0 && mode === "view" && (
          <button onClick={()=>setMode("new")} style={{ padding:"7px 14px", borderRadius:9, border:"1px solid #1a2540", background:"#0b1120", color:"#a78bfa", fontSize:11, fontWeight:800, cursor:"pointer" }}>+ Add Account</button>
        )}
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"28px 24px 12px" }}>
        <div style={{ marginBottom:18 }}>
          <h1 style={{ fontSize:28, fontWeight:900, color:"#f0f4ff", margin:0, letterSpacing:"-0.01em" }}>🏆 Challenge Tracker</h1>
          <p style={{ fontSize:13, color:"#5a6a8a", margin:"6px 0 0" }}>2026 prop firm rules — each phase has its own ruleset.</p>
        </div>

        {accounts.length > 1 && mode === "view" && (
          <div style={{ display:"flex", gap:8, marginBottom:18, flexWrap:"wrap" }}>
            {accounts.map(a => {
              const f = FIRMS[a.firm];
              const isActive = a.id === activeId;
              return (
                <button key={a.id} onClick={()=>setActiveId(a.id)} style={{
                  padding:"8px 14px", borderRadius:10,
                  border:`1px solid ${isActive ? f.color : "#1a2540"}`,
                  background: isActive ? f.accent : "#0b1120",
                  color: isActive ? f.color : "#7a8aa8",
                  fontSize:11, fontWeight:800, cursor:"pointer",
                  display:"flex", alignItems:"center", gap:8,
                }}>
                  <span style={{ width:8, height:8, borderRadius:2, background:f.color }}/>
                  {a.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 24px 48px" }}>
        {mode === "new" && (
          <SetupForm onSave={upsertAccount} onCancel={accounts.length > 0 ? ()=>setMode("view") : undefined}/>
        )}
        {mode === "edit" && active && (
          <SetupForm initial={active} onSave={upsertAccount} onCancel={()=>setMode("view")}/>
        )}
        {mode === "view" && active && stats && (
          <Dashboard account={active} stats={stats} onEdit={()=>setMode("edit")} onDelete={()=>deleteAccount(active.id)}/>
        )}
      </div>
    </div>
  );
}
