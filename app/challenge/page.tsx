"use client";

import { useEffect, useMemo, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────
type FirmKey = "apex" | "topstep" | "ftmo" | "mff" | "bulenox" | "custom";
type Phase   = "eval" | "phase2" | "funded_pa" | "express";

interface ChallengeAccount {
  id:              string;
  name:            string;
  firm:            FirmKey;
  accountSize:     number;
  phase:           Phase;
  startingBalance: number;
  peakBalance:     number;
  startDate:       string;   // YYYY-MM-DD
  dailyLoss:       number;   // 0 means "no daily limit" (Apex 4.0)
  maxDrawdown:     number;
  profitTarget:    number;
  minTradingDays:  number;   // 0 means "no minimum" (Apex 4.0)
  consistencyMax:  number;   // % cap. 0 means "no consistency rule" (FTMO)
  trailingType:    "eod" | "intraday";
  createdAt:       number;
}

interface Trade { id?:string; date:string; pnl:number; symbol?:string; pair?:string; side?:string; }

// ── 2026 Firm Presets ─────────────────────────────────────────────
const FIRMS: Record<FirmKey, { label:string; color:string; accent:string; sizes:number[]; tagline:string; }> = {
  apex:    { label:"Apex Trader Funding", color:"#22c55e", accent:"rgba(34,197,94,0.10)",  sizes:[25000,50000,100000,150000,250000], tagline:"4.0 — March 2026" },
  topstep: { label:"Topstep",             color:"#f97316", accent:"rgba(249,115,22,0.10)", sizes:[50000,100000,150000],               tagline:"2026 ruleset" },
  ftmo:    { label:"FTMO",                color:"#3b82f6", accent:"rgba(59,130,246,0.10)", sizes:[10000,25000,50000,100000,200000],   tagline:"Two-phase eval" },
  mff:     { label:"MyFundedFutures",     color:"#a855f7", accent:"rgba(168,85,247,0.10)", sizes:[50000,100000,150000],               tagline:"2026" },
  bulenox: { label:"Bulenox",             color:"#ef4444", accent:"rgba(239,68,68,0.10)",  sizes:[25000,50000,100000],                tagline:"2026" },
  custom:  { label:"Custom",              color:"#64748b", accent:"rgba(100,116,139,0.10)",sizes:[10000,25000,50000,100000,150000,200000,250000], tagline:"Manual rules" },
};

interface PresetRule { dailyLoss:number; maxDrawdown:number; profitTarget:number; profitTargetP2?:number; minTradingDays:number; consistencyMax:number; trailingType:"eod"|"intraday"; }

// Accurate 2026 rules per spec
const PRESETS: Record<FirmKey, Record<number, PresetRule>> = {
  apex: {
    25000:  { dailyLoss:0, maxDrawdown:1500, profitTarget:1500,  minTradingDays:0, consistencyMax:50, trailingType:"eod" },
    50000:  { dailyLoss:0, maxDrawdown:2500, profitTarget:3000,  minTradingDays:0, consistencyMax:50, trailingType:"eod" },
    100000: { dailyLoss:0, maxDrawdown:3000, profitTarget:6000,  minTradingDays:0, consistencyMax:50, trailingType:"eod" },
    150000: { dailyLoss:0, maxDrawdown:4500, profitTarget:9000,  minTradingDays:0, consistencyMax:50, trailingType:"eod" },
    250000: { dailyLoss:0, maxDrawdown:6500, profitTarget:15000, minTradingDays:0, consistencyMax:50, trailingType:"eod" },
  },
  topstep: {
    50000:  { dailyLoss:1000, maxDrawdown:2000, profitTarget:3000, minTradingDays:5, consistencyMax:30, trailingType:"eod" },
    100000: { dailyLoss:2000, maxDrawdown:3000, profitTarget:6000, minTradingDays:5, consistencyMax:30, trailingType:"eod" },
    150000: { dailyLoss:3000, maxDrawdown:4500, profitTarget:9000, minTradingDays:5, consistencyMax:30, trailingType:"eod" },
  },
  ftmo: {
    10000:  { dailyLoss:500,   maxDrawdown:1000,  profitTarget:1000,  profitTargetP2:500,   minTradingDays:4, consistencyMax:0, trailingType:"eod" },
    25000:  { dailyLoss:1250,  maxDrawdown:2500,  profitTarget:2500,  profitTargetP2:1250,  minTradingDays:4, consistencyMax:0, trailingType:"eod" },
    50000:  { dailyLoss:2500,  maxDrawdown:5000,  profitTarget:5000,  profitTargetP2:2500,  minTradingDays:4, consistencyMax:0, trailingType:"eod" },
    100000: { dailyLoss:5000,  maxDrawdown:10000, profitTarget:10000, profitTargetP2:5000,  minTradingDays:4, consistencyMax:0, trailingType:"eod" },
    200000: { dailyLoss:10000, maxDrawdown:20000, profitTarget:20000, profitTargetP2:10000, minTradingDays:4, consistencyMax:0, trailingType:"eod" },
  },
  mff: {
    50000:  { dailyLoss:2000, maxDrawdown:2500, profitTarget:3000, minTradingDays:1, consistencyMax:0, trailingType:"eod" },
    100000: { dailyLoss:3500, maxDrawdown:5000, profitTarget:6000, minTradingDays:1, consistencyMax:0, trailingType:"eod" },
    150000: { dailyLoss:5000, maxDrawdown:7500, profitTarget:9000, minTradingDays:1, consistencyMax:0, trailingType:"eod" },
  },
  bulenox: {
    25000:  { dailyLoss:1500, maxDrawdown:1500, profitTarget:1500, minTradingDays:1, consistencyMax:0, trailingType:"eod" },
    50000:  { dailyLoss:2000, maxDrawdown:2500, profitTarget:3000, minTradingDays:1, consistencyMax:0, trailingType:"eod" },
    100000: { dailyLoss:3500, maxDrawdown:5000, profitTarget:5000, minTradingDays:1, consistencyMax:0, trailingType:"eod" },
  },
  custom: {
    10000:  { dailyLoss:500,   maxDrawdown:1000,  profitTarget:1000,  minTradingDays:0, consistencyMax:0, trailingType:"eod" },
    25000:  { dailyLoss:1250,  maxDrawdown:2500,  profitTarget:2500,  minTradingDays:0, consistencyMax:0, trailingType:"eod" },
    50000:  { dailyLoss:2500,  maxDrawdown:5000,  profitTarget:5000,  minTradingDays:0, consistencyMax:0, trailingType:"eod" },
    100000: { dailyLoss:5000,  maxDrawdown:10000, profitTarget:10000, minTradingDays:0, consistencyMax:0, trailingType:"eod" },
    150000: { dailyLoss:7500,  maxDrawdown:15000, profitTarget:15000, minTradingDays:0, consistencyMax:0, trailingType:"eod" },
    200000: { dailyLoss:10000, maxDrawdown:20000, profitTarget:20000, minTradingDays:0, consistencyMax:0, trailingType:"eod" },
    250000: { dailyLoss:12500, maxDrawdown:25000, profitTarget:25000, minTradingDays:0, consistencyMax:0, trailingType:"eod" },
  },
};

const PHASES: Record<Phase, string> = {
  eval:      "Evaluation",
  phase2:    "Phase 2",
  funded_pa: "Funded PA",
  express:   "Express Funded",
};

// Firm-specific warning messages
function firmWarnings(firm:FirmKey, phase:Phase): string[] {
  switch (firm) {
    case "apex":
      return [
        "No trading within 8 minutes of NFP / CPI / FOMC releases",
        "No overnight positions — flat by session close",
        phase === "funded_pa"
          ? "50% consistency rule applies to PA payouts (largest day ≤ 50% of total)"
          : "Trailing drawdown applies — protect your peak balance",
      ];
    case "topstep":
      return [
        "Must be flat by 3:10 PM CT — no overnight positions",
        "30% consistency rule — no single day > 30% of total combine profits",
        "5 benchmark days ($150+ each) required before first payout",
        "For payouts: 40% consistency rule applies to payout window",
      ];
    case "ftmo":
      return [
        "Minimum 4 trading days per phase",
        "Daily loss limit 5% / Max drawdown 10% of account",
        "Phase 1 target 10%, Phase 2 target 5% — no consistency rule",
      ];
    case "mff":
      return [
        "Trailing drawdown until target hit — then locks at starting balance",
        "No overnight positions on evaluation accounts",
      ];
    case "bulenox":
      return [
        "End-of-day drawdown — calculated on closed equity at session close",
        "No overnight positions during evaluation",
      ];
    default:
      return ["Custom rules — verify against your firm's current ruleset"];
  }
}

// ── Storage ───────────────────────────────────────────────────────
function getUsername(): string {
  try { return JSON.parse(localStorage.getItem("tradedesk_session_v1") ?? "{}").username ?? "guest"; }
  catch { return "guest"; }
}
function challengeKey(u:string) { return `nexyru_challenge_${u}`; }
function tradesKey(u:string)    { return `tradedesk_trades_${u}_v1`; }

function loadAccounts(u:string): ChallengeAccount[] {
  try { const r = localStorage.getItem(challengeKey(u)); if(!r) return []; const j = JSON.parse(r); return Array.isArray(j) ? j : []; }
  catch { return []; }
}
function saveAccounts(u:string, accs:ChallengeAccount[]) {
  try { localStorage.setItem(challengeKey(u), JSON.stringify(accs)); } catch {}
}
function loadTrades(u:string): Trade[] {
  try { const r = localStorage.getItem(tradesKey(u)); return r ? JSON.parse(r) : []; } catch { return []; }
}

// ── Helpers ──────────────────────────────────────────────────────
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
  drawdownUsed:     number;
  totalProfit:      number;
  tradingDaysDone:  number;
  benchmarkDaysDone:number;     // Topstep: days with $150+ profit
  bestDayPnl:       number;
  consistencyScore: number;
  consistencyRatio: number;     // best day / total profit, as %
  byDay:            Record<string, DayStat>;
}

function computeStats(acc:ChallengeAccount, allTrades:Trade[]): Computed {
  // Filter trades to those on/after the start date
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
  const drawdownUsed = Math.max(0, peak - currentBalance);

  const byDay = groupByDay(sorted);
  const allDays = Object.values(byDay);
  const profitableDays = allDays.filter(d => d.trades.length > 0);
  const tradingDaysDone = profitableDays.length;
  const benchmarkDaysDone = allDays.filter(d => d.pnl >= 150).length;
  const bestDayPnl = profitableDays.reduce((m,d) => Math.max(m, d.pnl), 0);

  let consistencyScore = 100;
  let consistencyRatio = 0;
  if (acc.consistencyMax > 0 && totalProfit > 0 && bestDayPnl > 0) {
    consistencyRatio = (bestDayPnl / totalProfit) * 100;
    consistencyScore = consistencyRatio <= acc.consistencyMax
      ? 100
      : Math.max(0, Math.round(100 - (consistencyRatio - acc.consistencyMax) * 2));
  }

  return { todayPnl, todayTrades, dailyLossUsed, currentBalance, peakBalance:peak, drawdownUsed, totalProfit, tradingDaysDone, benchmarkDaysDone, bestDayPnl, consistencyScore, consistencyRatio, byDay };
}

// ── SVG Ring ─────────────────────────────────────────────────────
interface RingProps {
  value:    number;
  max:      number;
  size?:    number;
  thickness?: number;
  centerTop?: string;
  centerBig?: string;
  centerSub?: string;
  mode?: "loss" | "fill";
  forceColor?: string;
}

function Ring({ value, max, size=170, thickness=13, centerTop, centerBig, centerSub, mode="loss", forceColor }: RingProps) {
  const pct = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  let color = "#22c55e";
  if (forceColor) color = forceColor;
  else if (mode === "loss") {
    if (pct >= 80)      color = "#ef4444";
    else if (pct >= 50) color = "#f59e0b";
    else                color = "#22c55e";
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
        {centerTop && <div style={{ fontSize:10, fontWeight:700, color:"#5a6a8a", textTransform:"uppercase", letterSpacing:"0.08em" }}>{centerTop}</div>}
        {centerBig && <div style={{ fontSize:17, fontWeight:900, color:"#f0f4ff", fontFamily:"monospace", marginTop:4, lineHeight:1.2 }}>{centerBig}</div>}
        {centerSub && <div style={{ fontSize:10, fontWeight:600, color:"#4a5a7a", marginTop:4 }}>{centerSub}</div>}
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const inp:React.CSSProperties = { width:"100%", padding:"10px 12px", borderRadius:9, border:"1px solid #1a2540", background:"#0d1628", color:"#f0f4ff", fontSize:13, fontWeight:700, fontFamily:"monospace", outline:"none", boxSizing:"border-box" };
const lbl:React.CSSProperties = { fontSize:10, fontWeight:700, color:"#4a5a7a", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 };
const card:React.CSSProperties = { background:"#0b1120", border:"1px solid #1a2540", borderRadius:18 };

function fmtUSD(n:number) {
  const sign = n < 0 ? "-" : "";
  return sign + "$" + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function fmtUSDsigned(n:number) {
  return (n >= 0 ? "+" : "-") + "$" + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// ── Setup Form ────────────────────────────────────────────────────
function SetupForm({ initial, onSave, onCancel }:{ initial?:ChallengeAccount; onSave:(a:ChallengeAccount)=>void; onCancel?:()=>void; }) {
  const [firm, setFirm]         = useState<FirmKey>(initial?.firm ?? "apex");
  const sizes = FIRMS[firm].sizes;
  const [size, setSize]         = useState<number>(initial?.accountSize ?? sizes[0]);
  const [name, setName]         = useState<string>(initial?.name ?? "");
  const [phase, setPhase]       = useState<Phase>(initial?.phase ?? "eval");
  const [starting, setStarting] = useState<string>(String(initial?.startingBalance ?? sizes[0]));
  const [startDate, setStartDate] = useState<string>(initial?.startDate ?? new Date().toISOString().slice(0,10));

  const presetForCurrent = () => PRESETS[firm][size] ?? PRESETS.custom[size] ?? PRESETS.custom[50000];

  // Pull active target depending on FTMO phase
  const activeTarget = (p:PresetRule) => (firm === "ftmo" && phase === "phase2" && p.profitTargetP2 != null) ? p.profitTargetP2 : p.profitTarget;

  const [overrides, setOverrides] = useState({
    dailyLoss:      false,
    maxDrawdown:    false,
    profitTarget:   false,
    minTradingDays: false,
    consistencyMax: false,
  });
  const initialPreset = PRESETS[firm][size] ?? PRESETS.custom[size] ?? PRESETS.custom[50000];
  const [dailyLoss,      setDailyLoss]      = useState<string>(String(initial?.dailyLoss      ?? initialPreset.dailyLoss));
  const [maxDrawdown,    setMaxDrawdown]    = useState<string>(String(initial?.maxDrawdown    ?? initialPreset.maxDrawdown));
  const [profitTarget,   setProfitTarget]   = useState<string>(String(initial?.profitTarget   ?? activeTarget(initialPreset)));
  const [minTradingDays, setMinTradingDays] = useState<string>(String(initial?.minTradingDays ?? initialPreset.minTradingDays));
  const [consistencyMax, setConsistencyMax] = useState<string>(String(initial?.consistencyMax ?? initialPreset.consistencyMax));
  const [trailingType,   setTrailingType]   = useState<"eod"|"intraday">(initial?.trailingType ?? initialPreset.trailingType);

  // When firm or size changes, snap size to a valid one and re-apply preset
  useEffect(() => {
    if (!FIRMS[firm].sizes.includes(size)) setSize(FIRMS[firm].sizes[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firm]);

  useEffect(() => {
    const p = presetForCurrent();
    if (!overrides.dailyLoss)      setDailyLoss(String(p.dailyLoss));
    if (!overrides.maxDrawdown)    setMaxDrawdown(String(p.maxDrawdown));
    if (!overrides.profitTarget)   setProfitTarget(String(activeTarget(p)));
    if (!overrides.minTradingDays) setMinTradingDays(String(p.minTradingDays));
    if (!overrides.consistencyMax) setConsistencyMax(String(p.consistencyMax));
    setTrailingType(p.trailingType);
    if (!initial) setStarting(String(size));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firm, size, phase]);

  const save = () => {
    const p = presetForCurrent();
    const acc:ChallengeAccount = {
      id:              initial?.id ?? `ch_${Date.now()}`,
      name:            name.trim() || `${FIRMS[firm].label} ${size/1000}K`,
      firm,
      accountSize:     size,
      phase,
      startingBalance: parseFloat(starting) || size,
      peakBalance:     initial?.peakBalance ?? (parseFloat(starting) || size),
      startDate:       startDate,
      dailyLoss:       parseFloat(dailyLoss),
      maxDrawdown:     parseFloat(maxDrawdown)  || p.maxDrawdown,
      profitTarget:    parseFloat(profitTarget) || activeTarget(p),
      minTradingDays:  parseInt(minTradingDays, 10) || 0,
      consistencyMax:  parseFloat(consistencyMax) || 0,
      trailingType,
      createdAt:       initial?.createdAt ?? Date.now(),
    };
    onSave(acc);
  };

  const showPhase2Target = firm === "ftmo";

  return (
    <div style={{ maxWidth:720, margin:"0 auto" }}>
      <div style={{ textAlign:"center", marginBottom:24 }}>
        <div style={{ fontSize:42, marginBottom:8 }}>🏆</div>
        <h2 style={{ fontSize:22, fontWeight:900, color:"#f0f4ff", margin:"0 0 6px" }}>{initial ? "Edit Challenge Account" : "Set Up Your Challenge"}</h2>
        <p style={{ fontSize:12, color:"#4a5a7a", margin:0 }}>2026 prop firm rules. Pick a firm — sizes and rules auto-fill. Override anything.</p>
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
          <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(sizes.length,6)},1fr)`, gap:8 }}>
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

        {/* Name + phase */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:18 }}>
          <div>
            <label style={lbl}>Account Nickname</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder={`${FIRMS[firm].label} ${size/1000}K`} style={inp}/>
          </div>
          <div>
            <label style={lbl}>Challenge Phase</label>
            <select value={phase} onChange={e=>setPhase(e.target.value as Phase)} style={inp}>
              <option value="eval">Evaluation</option>
              {showPhase2Target && <option value="phase2">Phase 2</option>}
              <option value="funded_pa">Funded PA</option>
              <option value="express">Express Funded</option>
            </select>
          </div>
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
            {FIRMS[firm].label} ${size/1000}K — {PHASES[phase]} Rules
          </div>

          {([
            { key:"dailyLoss",      label: firm === "apex" ? "Daily Loss (Apex 4.0: none)" : "Daily Loss Limit", value:dailyLoss,      set:setDailyLoss,      prefix:"$", noteWhenZero: firm === "apex" ? "No daily loss limit on Apex 4.0" : "Set 0 for no limit" },
            { key:"maxDrawdown",    label: `Max Drawdown (${trailingType === "intraday" ? "intraday" : "EOD"} trailing)`, value:maxDrawdown, set:setMaxDrawdown, prefix:"$" },
            { key:"profitTarget",   label: firm === "ftmo" ? (phase === "phase2" ? "Profit Target (Phase 2)" : "Profit Target (Phase 1)") : "Profit Target", value:profitTarget, set:setProfitTarget, prefix:"$" },
            { key:"minTradingDays", label: firm === "apex" ? "Min Trading Days (Apex 4.0: 0)" : "Min Trading Days", value:minTradingDays, set:setMinTradingDays, prefix:"", noteWhenZero: firm === "apex" ? "No minimum on Apex 4.0" : undefined },
            { key:"consistencyMax", label: firm === "ftmo" ? "Consistency % (FTMO: none)" : firm === "topstep" ? (phase === "funded_pa" ? "Consistency % (Topstep payout: 40)" : "Consistency % (Topstep combine: 30)") : firm === "apex" && phase === "funded_pa" ? "Consistency % (Apex PA: 50)" : "Consistency Max %", value:consistencyMax, set:setConsistencyMax, prefix:"" },
          ] as const).map((row) => {
            const labelText = row.label;
            const isZero = parseFloat(row.value) === 0;
            return (
              <div key={row.key} style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr auto", gap:10, alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:11, color:"#7a8aa8", fontWeight:600 }}>{labelText}</div>
                <div style={{ position:"relative" }}>
                  {row.prefix && <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:12, color:"#3a4a6a", pointerEvents:"none" }}>{row.prefix}</span>}
                  <input
                    value={row.value}
                    onChange={e => { row.set(e.target.value); setOverrides(o => ({ ...o, [row.key]:true })); }}
                    style={{ ...inp, paddingLeft: row.prefix ? 22 : 12 }}
                  />
                </div>
                <div style={{ fontSize:9, color:"#3a4a6a", whiteSpace:"nowrap", minWidth:130 }}>
                  {isZero && "noteWhenZero" in row && row.noteWhenZero ? row.noteWhenZero : ""}
                </div>
              </div>
            );
          })}

          {/* Trailing type */}
          <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr auto", gap:10, alignItems:"center", marginTop:8 }}>
            <div style={{ fontSize:11, color:"#7a8aa8", fontWeight:600 }}>Trailing Drawdown Type</div>
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

// ── Dashboard ────────────────────────────────────────────────────
function Dashboard({ account, stats, onEdit, onDelete }:{
  account:ChallengeAccount; stats:Computed; onEdit:()=>void; onDelete:()=>void;
}) {
  const firm = FIRMS[account.firm];

  const hasDailyLimit = account.dailyLoss > 0;
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

  // Session countdown — 16:00 CT (assume user local clock differs but display CT-relative)
  const [now, setNow] = useState(new Date());
  useEffect(()=>{ const t = setInterval(()=>setNow(new Date()), 30000); return ()=>clearInterval(t); }, []);
  const sessionEnd = new Date(now); sessionEnd.setHours(16,0,0,0);
  const sessionMs = Math.max(0, sessionEnd.getTime() - now.getTime());
  const sessionH = Math.floor(sessionMs / 3600000);
  const sessionM = Math.floor((sessionMs % 3600000) / 60000);

  // Topstep-specific consistency label depending on phase
  const consistencyContextLabel = (() => {
    if (account.firm === "ftmo") return "FTMO — no consistency rule";
    if (account.firm === "topstep") return account.phase === "funded_pa" ? "Topstep payout — 40% rule" : "Topstep combine — 30% rule";
    if (account.firm === "apex")    return account.phase === "funded_pa" ? "Apex PA payouts — 50% rule" : "Apex eval — no consistency rule";
    return `${account.consistencyMax}% rule`;
  })();
  const consistencyApplies = account.consistencyMax > 0;

  // FTMO phase label
  const ftmoPhaseLabel = account.firm === "ftmo"
    ? (account.phase === "phase2" ? "Phase 2 target 5%" : account.phase === "eval" ? "Phase 1 target 10%" : null)
    : null;

  // Topstep benchmark days
  const isTopstep = account.firm === "topstep";
  const isApex    = account.firm === "apex";
  const isFTMO    = account.firm === "ftmo";

  const warnings = firmWarnings(account.firm, account.phase);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* Account header */}
      <div style={{ ...card, padding:"22px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:14, borderColor: firm.color + "55", background: `linear-gradient(135deg, #0b1120, ${firm.accent})` }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6, flexWrap:"wrap" }}>
            <span style={{ width:12, height:12, borderRadius:3, background:firm.color }}/>
            <span style={{ fontSize:18, fontWeight:900, color:"#f0f4ff" }}>{account.name}</span>
            <span style={{ fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:20, background:firm.accent, color:firm.color, border:`1px solid ${firm.color}44` }}>{firm.label}</span>
            <span style={{ fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:20, background:"#0d1628", color:"#7a8aa8", border:"1px solid #1a2540" }}>{PHASES[account.phase]}</span>
            {ftmoPhaseLabel && <span style={{ fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:20, background:"rgba(59,130,246,0.15)", color:"#3b82f6", border:"1px solid rgba(59,130,246,0.35)" }}>{ftmoPhaseLabel}</span>}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:14, fontSize:11, color:"#5a6a8a", flexWrap:"wrap" }}>
            <span>Size <strong style={{ color:"#f0f4ff", fontFamily:"monospace" }}>${(account.accountSize/1000).toFixed(0)}K</strong></span>
            <span>Started <strong style={{ color:"#f0f4ff", fontFamily:"monospace" }}>{account.startDate}</strong></span>
            <span>Peak <strong style={{ color:"#f0f4ff", fontFamily:"monospace" }}>{fmtUSD(stats.peakBalance)}</strong></span>
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
        {/* Ring 1 — Daily Loss */}
        <div style={{ ...card, padding:"22px 18px 18px", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.1em" }}>Daily Loss</div>
          {hasDailyLimit ? (
            <>
              <Ring
                value={stats.dailyLossUsed} max={account.dailyLoss}
                centerBig={fmtUSD(stats.dailyLossUsed)}
                centerSub={`of ${fmtUSD(account.dailyLoss)}`}
                mode="loss"
              />
              <div style={{ fontSize:12, fontWeight:700, color: dailyPct >= 80 ? "#ef4444" : dailyPct >= 50 ? "#f59e0b" : "#22c55e", textAlign:"center" }}>
                Can lose <span style={{ fontFamily:"monospace" }}>{fmtUSD(dailyRemaining)}</span> more today
              </div>
              <div style={{ fontSize:10, color:"#4a5a7a" }}>Resets at midnight CT</div>
            </>
          ) : (
            <>
              <Ring
                value={stats.drawdownUsed} max={account.maxDrawdown}
                centerBig="N/A"
                centerSub="No daily limit"
                mode="loss"
                forceColor="#22c55e"
              />
              <div style={{ fontSize:12, fontWeight:700, color:"#22c55e", textAlign:"center" }}>
                No daily limit — Apex 4.0
              </div>
              <div style={{ fontSize:10, color:"#4a5a7a", textAlign:"center" }}>Trailing drawdown applies instead</div>
            </>
          )}
        </div>

        {/* Ring 2 — Max Drawdown */}
        <div style={{ ...card, padding:"22px 18px 18px", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.1em" }}>Max Drawdown</div>
          <Ring
            value={stats.drawdownUsed} max={account.maxDrawdown}
            centerBig={fmtUSD(stats.drawdownUsed)}
            centerSub={`of ${fmtUSD(account.maxDrawdown)}`}
            mode="loss"
          />
          <div style={{ fontSize:12, fontWeight:700, color: ddPct >= 80 ? "#ef4444" : ddPct >= 50 ? "#f59e0b" : "#22c55e", textAlign:"center" }}>
            <span style={{ fontFamily:"monospace" }}>{fmtUSD(ddRemaining)}</span> buffer to breach
          </div>
          <div style={{ fontSize:10, color:"#4a5a7a", textAlign:"center" }}>
            {account.trailingType === "intraday" ? "Intraday trailing" : "End-of-day trailing"} · peak {fmtUSD(stats.peakBalance)}
          </div>
        </div>

        {/* Ring 3 — Profit Target */}
        <div style={{ ...card, padding:"22px 18px 18px", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.1em" }}>Profit Target</div>
          <Ring
            value={Math.max(0, stats.totalProfit)} max={account.profitTarget}
            centerBig={fmtUSD(Math.max(0, stats.totalProfit))}
            centerSub={`of ${fmtUSD(account.profitTarget)}`}
            mode="fill"
          />
          <div style={{ fontSize:12, fontWeight:700, color: profitNeeded === 0 ? "#22c55e" : "#3b82f6", textAlign:"center" }}>
            {profitNeeded === 0 ? "🏆 Target hit!" : <><span style={{ fontFamily:"monospace" }}>{fmtUSD(profitNeeded)}</span> more to pass</>}
          </div>
          <div style={{ fontSize:10, color:"#4a5a7a" }}>
            {isFTMO ? (account.phase === "phase2" ? "Phase 2 · 5% target" : "Phase 1 · 10% target") : `${PHASES[account.phase]} phase`}
          </div>
        </div>

        {/* Ring 4 — Consistency */}
        <div style={{ ...card, padding:"22px 18px 18px", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.1em" }}>Consistency Score</div>
          {consistencyApplies ? (
            <>
              <Ring
                value={stats.consistencyScore} max={100}
                centerBig={`${stats.consistencyScore}%`}
                mode="fill"
              />
              <div style={{ fontSize:12, fontWeight:700, color: stats.consistencyScore >= 70 ? "#22c55e" : stats.consistencyScore >= 40 ? "#f59e0b" : "#ef4444", textAlign:"center" }}>
                Best day {stats.consistencyRatio.toFixed(0)}% of total
              </div>
              <div style={{ fontSize:10, color:"#4a5a7a", textAlign:"center" }}>{consistencyContextLabel}</div>
            </>
          ) : (
            <>
              <Ring
                value={100} max={100}
                centerBig="✓"
                centerSub="No rule"
                mode="fill"
                forceColor="#22c55e"
              />
              <div style={{ fontSize:12, fontWeight:700, color:"#22c55e", textAlign:"center" }}>
                No consistency rule
              </div>
              <div style={{ fontSize:10, color:"#4a5a7a", textAlign:"center" }}>{consistencyContextLabel}</div>
            </>
          )}
        </div>
      </div>

      {/* Trading day counter */}
      <div style={{ ...card, padding:"18px 22px" }}>
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:10, flexWrap:"wrap", gap:8 }}>
          <div>
            <div style={{ fontSize:11, color:"#5a6a8a", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em" }}>
              {isTopstep ? "Benchmark Days ($150+ profit)" : "Trading Days"}
            </div>
            <div style={{ fontSize:20, fontWeight:900, color:"#f0f4ff", fontFamily:"monospace", marginTop:2 }}>
              {isTopstep
                ? `${stats.benchmarkDaysDone} of 5 benchmark days`
                : isApex
                  ? `${stats.tradingDaysDone} days traded`
                  : `Day ${stats.tradingDaysDone} of ${account.minTradingDays || 0} minimum`}
            </div>
          </div>
          <div style={{ fontSize:12, fontWeight:700, color: (() => {
              if (isApex) return "#22c55e";
              if (isTopstep) return stats.benchmarkDaysDone >= 5 ? "#22c55e" : "#94a3b8";
              return stats.tradingDaysDone >= account.minTradingDays ? "#22c55e" : "#94a3b8";
            })() }}>
            {isApex ? "✅ No minimum — Apex 4.0"
              : isTopstep ? (stats.benchmarkDaysDone >= 5 ? "✅ Eligible for payout" : `${5 - stats.benchmarkDaysDone} more needed`)
              : (stats.tradingDaysDone >= account.minTradingDays ? "✅ Met" : `${Math.max(0, account.minTradingDays - stats.tradingDaysDone)} more needed`)}
          </div>
        </div>
        <div style={{ height:8, borderRadius:4, background:"#0f1a2e", overflow:"hidden" }}>
          <div style={{
            width: isApex ? "100%"
              : isTopstep ? `${Math.min(100, (stats.benchmarkDaysDone/5)*100)}%`
              : account.minTradingDays > 0
                ? `${Math.min(100, (stats.tradingDaysDone/account.minTradingDays)*100)}%`
                : "100%",
            height:"100%",
            background:"linear-gradient(90deg,#3b82f6,#22c55e)",
            borderRadius:4,
            transition:"width 0.7s",
          }}/>
        </div>
      </div>

      {/* Today + status */}
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

      {/* Important rules reminder */}
      <div style={{ ...card, padding:"18px 22px", borderColor:"rgba(245,158,11,0.25)", background:"linear-gradient(135deg, #0b1120, rgba(245,158,11,0.04))" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          <span style={{ fontSize:14 }}>⚠️</span>
          <div style={{ fontSize:11, fontWeight:800, color:"#f59e0b", textTransform:"uppercase", letterSpacing:"0.08em" }}>
            {firm.label} — Important Rules
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

      {/* Calendar */}
      <HistoryCalendar account={account} stats={stats}/>
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

  // Persist peak balance growth
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
          <p style={{ fontSize:13, color:"#5a6a8a", margin:"6px 0 0" }}>2026 prop firm rules. Track your funded account in real time.</p>
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
          <SetupForm
            onSave={upsertAccount}
            onCancel={accounts.length > 0 ? ()=>setMode("view") : undefined}
          />
        )}
        {mode === "edit" && active && (
          <SetupForm
            initial={active}
            onSave={upsertAccount}
            onCancel={()=>setMode("view")}
          />
        )}
        {mode === "view" && active && stats && (
          <Dashboard
            account={active}
            stats={stats}
            onEdit={()=>setMode("edit")}
            onDelete={()=>deleteAccount(active.id)}
          />
        )}
      </div>
    </div>
  );
}
