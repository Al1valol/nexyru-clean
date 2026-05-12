"use client";

import { useEffect, useMemo, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────
type FirmKey = "apex" | "ftmo" | "topstep" | "mff" | "bulenox" | "custom";
type Phase = "eval1" | "eval2" | "funded" | "pa";

interface ChallengeAccount {
  id:              string;
  name:            string;
  firm:            FirmKey;
  accountSize:     number;
  phase:           Phase;
  startingBalance: number;
  peakBalance:     number;
  dailyLoss:       number;
  maxDrawdown:     number;
  profitTarget:    number;
  minTradingDays:  number;
  maxTradesPerDay: number;
  consistencyMax:  number; // % of total profit a single day cannot exceed
  createdAt:       number;
}

interface Trade { id?:string; date:string; pnl:number; symbol?:string; pair?:string; side?:string; }

// ── Firm presets ──────────────────────────────────────────────────
const FIRMS: Record<FirmKey, { label:string; color:string; accent:string; }> = {
  apex:     { label:"Apex Trader Funding",  color:"#22c55e", accent:"rgba(34,197,94,0.10)" },
  ftmo:     { label:"FTMO",                 color:"#3b82f6", accent:"rgba(59,130,246,0.10)" },
  topstep:  { label:"TopstepX",             color:"#f97316", accent:"rgba(249,115,22,0.10)" },
  mff:      { label:"MyFundedFutures",      color:"#a855f7", accent:"rgba(168,85,247,0.10)" },
  bulenox:  { label:"Bulenox",              color:"#ef4444", accent:"rgba(239,68,68,0.10)" },
  custom:   { label:"Custom",               color:"#64748b", accent:"rgba(100,116,139,0.10)" },
};

const ACCOUNT_SIZES = [25000, 50000, 100000, 150000, 250000];

interface PresetRule { dailyLoss:number; maxDrawdown:number; profitTarget:number; minTradingDays:number; consistencyMax:number; }

// rules keyed by firm + size (best-effort real prop firm rules; defaults filled in)
const PRESETS: Record<FirmKey, Record<number, PresetRule>> = {
  apex: {
    25000:  { dailyLoss:1500,  maxDrawdown:1500,  profitTarget:1500,  minTradingDays:7,  consistencyMax:30 },
    50000:  { dailyLoss:2500,  maxDrawdown:3000,  profitTarget:3000,  minTradingDays:7,  consistencyMax:30 },
    100000: { dailyLoss:3500,  maxDrawdown:3000,  profitTarget:6000,  minTradingDays:7,  consistencyMax:30 },
    150000: { dailyLoss:4500,  maxDrawdown:5000,  profitTarget:9000,  minTradingDays:7,  consistencyMax:30 },
    250000: { dailyLoss:6500,  maxDrawdown:6500,  profitTarget:15000, minTradingDays:7,  consistencyMax:30 },
  },
  ftmo: {
    25000:  { dailyLoss:1250,  maxDrawdown:2500,  profitTarget:2500,  minTradingDays:4,  consistencyMax:40 },
    50000:  { dailyLoss:2500,  maxDrawdown:5000,  profitTarget:5000,  minTradingDays:4,  consistencyMax:40 },
    100000: { dailyLoss:5000,  maxDrawdown:10000, profitTarget:10000, minTradingDays:4,  consistencyMax:40 },
    150000: { dailyLoss:7500,  maxDrawdown:15000, profitTarget:15000, minTradingDays:4,  consistencyMax:40 },
    250000: { dailyLoss:12500, maxDrawdown:25000, profitTarget:25000, minTradingDays:4,  consistencyMax:40 },
  },
  topstep: {
    25000:  { dailyLoss:1000,  maxDrawdown:1500,  profitTarget:1500,  minTradingDays:5,  consistencyMax:30 },
    50000:  { dailyLoss:2000,  maxDrawdown:3000,  profitTarget:3000,  minTradingDays:5,  consistencyMax:30 },
    100000: { dailyLoss:3000,  maxDrawdown:4000,  profitTarget:6000,  minTradingDays:5,  consistencyMax:30 },
    150000: { dailyLoss:4500,  maxDrawdown:5500,  profitTarget:9000,  minTradingDays:5,  consistencyMax:30 },
    250000: { dailyLoss:6500,  maxDrawdown:7500,  profitTarget:15000, minTradingDays:5,  consistencyMax:30 },
  },
  mff: {
    25000:  { dailyLoss:500,   maxDrawdown:1500,  profitTarget:1500,  minTradingDays:1,  consistencyMax:50 },
    50000:  { dailyLoss:1100,  maxDrawdown:2000,  profitTarget:3000,  minTradingDays:1,  consistencyMax:50 },
    100000: { dailyLoss:2200,  maxDrawdown:3000,  profitTarget:6000,  minTradingDays:1,  consistencyMax:50 },
    150000: { dailyLoss:3300,  maxDrawdown:4500,  profitTarget:9000,  minTradingDays:1,  consistencyMax:50 },
    250000: { dailyLoss:5500,  maxDrawdown:6500,  profitTarget:15000, minTradingDays:1,  consistencyMax:50 },
  },
  bulenox: {
    25000:  { dailyLoss:1500,  maxDrawdown:1500,  profitTarget:1500,  minTradingDays:5,  consistencyMax:30 },
    50000:  { dailyLoss:2500,  maxDrawdown:2500,  profitTarget:3000,  minTradingDays:5,  consistencyMax:30 },
    100000: { dailyLoss:3500,  maxDrawdown:3500,  profitTarget:6000,  minTradingDays:5,  consistencyMax:30 },
    150000: { dailyLoss:4500,  maxDrawdown:4500,  profitTarget:9000,  minTradingDays:5,  consistencyMax:30 },
    250000: { dailyLoss:6500,  maxDrawdown:6500,  profitTarget:15000, minTradingDays:5,  consistencyMax:30 },
  },
  custom: {
    25000:  { dailyLoss:1250,  maxDrawdown:2500,  profitTarget:2500,  minTradingDays:5,  consistencyMax:30 },
    50000:  { dailyLoss:2500,  maxDrawdown:5000,  profitTarget:5000,  minTradingDays:5,  consistencyMax:30 },
    100000: { dailyLoss:5000,  maxDrawdown:10000, profitTarget:10000, minTradingDays:5,  consistencyMax:30 },
    150000: { dailyLoss:7500,  maxDrawdown:15000, profitTarget:15000, minTradingDays:5,  consistencyMax:30 },
    250000: { dailyLoss:12500, maxDrawdown:25000, profitTarget:25000, minTradingDays:5,  consistencyMax:30 },
  },
};

const PHASES: Record<Phase,string> = {
  eval1: "Evaluation Phase 1",
  eval2: "Evaluation Phase 2",
  funded:"Funded",
  pa:    "PA Account",
};

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

// ── Math helpers ─────────────────────────────────────────────────
function isSameDay(a:Date,b:Date) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }

interface DayStat { dateKey:string; date:Date; pnl:number; trades:Trade[]; }

function dayKey(d:Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

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
  todayPnl:        number;
  todayTrades:     Trade[];
  dailyLossUsed:   number;     // positive number = loss eaten today
  currentBalance:  number;
  peakBalance:     number;
  drawdownUsed:    number;     // positive = how far below peak
  totalProfit:     number;     // since starting balance
  tradingDaysDone: number;
  bestDayPnl:      number;
  consistencyScore:number;     // 0–100
  byDay:           Record<string,DayStat>;
}

function computeStats(acc:ChallengeAccount, trades:Trade[]): Computed {
  const sorted = [...trades].sort((a,b)=> new Date(a.date).getTime() - new Date(b.date).getTime());
  const today = new Date();
  const todayTrades = sorted.filter(t => isSameDay(new Date(t.date), today));
  const todayPnl    = todayTrades.reduce((s,t)=> s + (t.pnl ?? 0), 0);
  const dailyLossUsed = todayPnl < 0 ? Math.abs(todayPnl) : 0;

  const totalProfit  = sorted.reduce((s,t)=> s + (t.pnl ?? 0), 0);
  const currentBalance = acc.startingBalance + totalProfit;

  // Running peak balance across history
  let bal = acc.startingBalance;
  let peak = acc.peakBalance && acc.peakBalance >= acc.startingBalance ? acc.peakBalance : acc.startingBalance;
  for (const t of sorted) {
    bal += t.pnl ?? 0;
    if (bal > peak) peak = bal;
  }
  const drawdownUsed = Math.max(0, peak - currentBalance);

  const byDay = groupByDay(sorted);
  const profitableDays = Object.values(byDay).filter(d => d.pnl !== 0);
  const tradingDaysDone = profitableDays.length;

  const bestDayPnl = profitableDays.reduce((m,d) => Math.max(m, d.pnl), 0);
  // Consistency: ratio of best day to total profit. If best day > consistencyMax% of profit → score drops.
  let consistencyScore = 100;
  if (totalProfit > 0 && bestDayPnl > 0) {
    const ratio = (bestDayPnl / totalProfit) * 100;
    const limit = acc.consistencyMax;
    consistencyScore = ratio <= limit ? 100 : Math.max(0, Math.round(100 - (ratio - limit) * 2));
  } else if (totalProfit <= 0) {
    consistencyScore = 0;
  }

  return { todayPnl, todayTrades, dailyLossUsed, currentBalance, peakBalance:peak, drawdownUsed, totalProfit, tradingDaysDone, bestDayPnl, consistencyScore, byDay };
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
  mode?: "loss" | "fill";        // loss: green→yellow→red as value grows; fill: blue→green when complete
  trackColor?: string;
}

function Ring({ value, max, size=180, thickness=14, centerTop, centerBig, centerSub, mode="loss", trackColor="#0f1a2e" }: RingProps) {
  const pct = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  let color = "#22c55e";
  if (mode === "loss") {
    if (pct >= 90)      color = "#ef4444";
    else if (pct >= 70) color = "#f59e0b";
    else                color = "#22c55e";
  } else {
    color = pct >= 100 ? "#22c55e" : "#3b82f6";
  }

  return (
    <div style={{ position:"relative", width:size, height:size }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} stroke={trackColor} strokeWidth={thickness} fill="none"/>
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
        {centerBig && <div style={{ fontSize:18, fontWeight:900, color:"#f0f4ff", fontFamily:"monospace", marginTop:4, lineHeight:1.2 }}>{centerBig}</div>}
        {centerSub && <div style={{ fontSize:10, fontWeight:600, color:"#4a5a7a", marginTop:4 }}>{centerSub}</div>}
      </div>
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────
const inp:React.CSSProperties = { width:"100%", padding:"10px 12px", borderRadius:9, border:"1px solid #1a2540", background:"#0d1628", color:"#f0f4ff", fontSize:13, fontWeight:700, fontFamily:"monospace", outline:"none", boxSizing:"border-box" };
const lbl:React.CSSProperties = { fontSize:10, fontWeight:700, color:"#4a5a7a", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 };
const card:React.CSSProperties = { background:"#0b1120", border:"1px solid #1a2540", borderRadius:18 };

function fmtUSD(n:number) {
  const sign = n < 0 ? "-" : "";
  return sign + "$" + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function fmtUSDsigned(n:number) {
  const sign = n >= 0 ? "+" : "-";
  return sign + "$" + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// ── Setup Form ────────────────────────────────────────────────────
function SetupForm({ initial, onSave, onCancel }:{ initial?:ChallengeAccount; onSave:(a:ChallengeAccount)=>void; onCancel?:()=>void; }) {
  const [firm, setFirm]         = useState<FirmKey>(initial?.firm ?? "apex");
  const [size, setSize]         = useState<number>(initial?.accountSize ?? 50000);
  const [name, setName]         = useState<string>(initial?.name ?? "");
  const [phase, setPhase]       = useState<Phase>(initial?.phase ?? "eval1");
  const [starting, setStarting] = useState<string>(String(initial?.startingBalance ?? 50000));
  const [overrides, setOverrides] = useState({
    dailyLoss:       initial?.dailyLoss       != null,
    maxDrawdown:     initial?.maxDrawdown     != null,
    profitTarget:    initial?.profitTarget    != null,
    minTradingDays:  initial?.minTradingDays  != null,
    consistencyMax:  initial?.consistencyMax  != null,
    maxTradesPerDay: initial?.maxTradesPerDay != null,
  });
  const preset = PRESETS[firm][size] ?? PRESETS.custom[50000];
  const [dailyLoss,      setDailyLoss]      = useState<string>(String(initial?.dailyLoss      ?? preset.dailyLoss));
  const [maxDrawdown,    setMaxDrawdown]    = useState<string>(String(initial?.maxDrawdown    ?? preset.maxDrawdown));
  const [profitTarget,   setProfitTarget]   = useState<string>(String(initial?.profitTarget   ?? preset.profitTarget));
  const [minTradingDays, setMinTradingDays] = useState<string>(String(initial?.minTradingDays ?? preset.minTradingDays));
  const [consistencyMax, setConsistencyMax] = useState<string>(String(initial?.consistencyMax ?? preset.consistencyMax));
  const [maxTradesPerDay,setMaxTradesPerDay]= useState<string>(String(initial?.maxTradesPerDay ?? 5));

  // Re-apply preset when firm/size changes (unless overridden)
  useEffect(() => {
    const p = PRESETS[firm][size] ?? PRESETS.custom[50000];
    if (!overrides.dailyLoss)      setDailyLoss(String(p.dailyLoss));
    if (!overrides.maxDrawdown)    setMaxDrawdown(String(p.maxDrawdown));
    if (!overrides.profitTarget)   setProfitTarget(String(p.profitTarget));
    if (!overrides.minTradingDays) setMinTradingDays(String(p.minTradingDays));
    if (!overrides.consistencyMax) setConsistencyMax(String(p.consistencyMax));
    setStarting(prev => (initial ? prev : String(size)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firm, size]);

  const save = () => {
    const acc:ChallengeAccount = {
      id:              initial?.id ?? `ch_${Date.now()}`,
      name:            name.trim() || `${FIRMS[firm].label} ${size/1000}K`,
      firm,
      accountSize:     size,
      phase,
      startingBalance: parseFloat(starting) || size,
      peakBalance:     initial?.peakBalance ?? (parseFloat(starting) || size),
      dailyLoss:       parseFloat(dailyLoss)       || preset.dailyLoss,
      maxDrawdown:     parseFloat(maxDrawdown)     || preset.maxDrawdown,
      profitTarget:    parseFloat(profitTarget)    || preset.profitTarget,
      minTradingDays:  parseInt(minTradingDays)    || preset.minTradingDays,
      maxTradesPerDay: parseInt(maxTradesPerDay)   || 5,
      consistencyMax:  parseFloat(consistencyMax)  || preset.consistencyMax,
      createdAt:       initial?.createdAt ?? Date.now(),
    };
    onSave(acc);
  };

  return (
    <div style={{ maxWidth:680, margin:"0 auto" }}>
      <div style={{ textAlign:"center", marginBottom:24 }}>
        <div style={{ fontSize:42, marginBottom:8 }}>🏆</div>
        <h2 style={{ fontSize:22, fontWeight:900, color:"#f0f4ff", margin:"0 0 6px" }}>{initial ? "Edit Challenge Account" : "Set Up Your Challenge Account"}</h2>
        <p style={{ fontSize:12, color:"#4a5a7a", margin:0 }}>Pick your prop firm and account size. We&apos;ll auto-fill the rules — override anything you need.</p>
      </div>

      <div style={{ ...card, padding:24 }}>
        {/* Prop firm */}
        <div style={{ marginBottom:18 }}>
          <label style={lbl}>Prop Firm</label>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:8 }}>
            {(Object.keys(FIRMS) as FirmKey[]).map(k => {
              const f = FIRMS[k];
              const active = firm === k;
              return (
                <button key={k} onClick={()=>setFirm(k)} style={{
                  padding:"12px 10px", borderRadius:11,
                  border:`1px solid ${active ? f.color : "#1a2540"}`,
                  background: active ? f.accent : "#0d1628",
                  color: active ? f.color : "#7a8aa8",
                  fontSize:12, fontWeight:800, cursor:"pointer", textAlign:"left",
                  transition:"all 0.15s",
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ width:10, height:10, borderRadius:3, background:f.color, display:"inline-block" }}/>
                    {f.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Account size */}
        <div style={{ marginBottom:18 }}>
          <label style={lbl}>Account Size</label>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
            {ACCOUNT_SIZES.map(s => {
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
              {(Object.keys(PHASES) as Phase[]).map(p => <option key={p} value={p}>{PHASES[p]}</option>)}
            </select>
          </div>
        </div>

        {/* Rules */}
        <div style={{ padding:14, background:"#0d1628", borderRadius:12, border:"1px solid #1a2540", marginBottom:18 }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#94a3b8", marginBottom:12, display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:FIRMS[firm].color }}/>
            {FIRMS[firm].label} {size/1000}K — Rules
          </div>

          {([
            { key:"dailyLoss",      label:"Daily Loss Limit",  value:dailyLoss,      set:setDailyLoss,      prefix:"$" },
            { key:"maxDrawdown",    label:"Max Drawdown",      value:maxDrawdown,    set:setMaxDrawdown,    prefix:"$" },
            { key:"profitTarget",   label:"Profit Target",     value:profitTarget,   set:setProfitTarget,   prefix:"$" },
            { key:"minTradingDays", label:"Min Trading Days",  value:minTradingDays, set:setMinTradingDays, prefix:""  },
            { key:"maxTradesPerDay",label:"Max Trades / Day",  value:maxTradesPerDay,set:setMaxTradesPerDay,prefix:""  },
            { key:"consistencyMax", label:"Consistency Max %", value:consistencyMax, set:setConsistencyMax, prefix:""  },
          ] as const).map(row => (
            <div key={row.key} style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr auto", gap:10, alignItems:"center", marginBottom:8 }}>
              <div style={{ fontSize:11, color:"#7a8aa8", fontWeight:600 }}>{row.label}</div>
              <div style={{ position:"relative" }}>
                {row.prefix && <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:12, color:"#3a4a6a", pointerEvents:"none" }}>{row.prefix}</span>}
                <input
                  value={row.value}
                  onChange={e => { row.set(e.target.value); setOverrides(o => ({ ...o, [row.key]:true })); }}
                  disabled={!overrides[row.key as keyof typeof overrides]}
                  style={{ ...inp, paddingLeft: row.prefix ? 22 : 12, opacity: overrides[row.key as keyof typeof overrides] ? 1 : 0.55 }}
                />
              </div>
              <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:10, color:"#4a5a7a", cursor:"pointer", whiteSpace:"nowrap" }}>
                <input
                  type="checkbox"
                  checked={overrides[row.key as keyof typeof overrides]}
                  onChange={e => setOverrides(o => ({ ...o, [row.key]: e.target.checked }))}
                />
                Override
              </label>
            </div>
          ))}
        </div>

        {/* Starting balance */}
        <div style={{ marginBottom:18 }}>
          <label style={lbl}>Current / Starting Balance ($)</label>
          <input value={starting} onChange={e=>setStarting(e.target.value)} type="number" style={inp}/>
          <div style={{ fontSize:10, color:"#3a4a6a", marginTop:4 }}>What your account is at right now (used as the baseline for tracking).</div>
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

// ── Live Dashboard ────────────────────────────────────────────────
function Dashboard({ account, stats, onEdit, onDelete }:{
  account:ChallengeAccount; stats:Computed;
  onEdit:()=>void; onDelete:()=>void;
}) {
  const firm = FIRMS[account.firm];

  // Status badge logic
  const dailyPct = (stats.dailyLossUsed / account.dailyLoss) * 100;
  const ddPct    = (stats.drawdownUsed  / account.maxDrawdown) * 100;
  const dangerPct = Math.max(dailyPct, ddPct);
  const status =
    dangerPct >= 90 ? { label:"🚨 DANGER ZONE", color:"#ef4444", bg:"rgba(239,68,68,0.10)" } :
    dangerPct >= 70 ? { label:"⚠️ BE CAREFUL",   color:"#f59e0b", bg:"rgba(245,158,11,0.10)" } :
                      { label:"✅ ON TRACK",     color:"#22c55e", bg:"rgba(34,197,94,0.10)" };

  const profitNeeded = Math.max(0, account.profitTarget - stats.totalProfit);
  const dailyRemaining = Math.max(0, account.dailyLoss - stats.dailyLossUsed);
  const ddRemaining    = Math.max(0, account.maxDrawdown - stats.drawdownUsed);

  // Session countdown — assume CME futures regular close 16:00 CT
  const [now, setNow] = useState(new Date());
  useEffect(()=>{ const t = setInterval(()=>setNow(new Date()), 60000); return ()=>clearInterval(t); }, []);
  const sessionEnd = new Date(now); sessionEnd.setHours(17,0,0,0); // 5pm local rough proxy
  const sessionMs = Math.max(0, sessionEnd.getTime() - now.getTime());
  const sessionH  = Math.floor(sessionMs / 3600000);
  const sessionM  = Math.floor((sessionMs % 3600000) / 60000);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* Account header */}
      <div style={{ ...card, padding:"22px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:14, borderColor: firm.color + "55", background: `linear-gradient(135deg, #0b1120, ${firm.accent})` }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
            <span style={{ width:12, height:12, borderRadius:3, background:firm.color }}/>
            <span style={{ fontSize:18, fontWeight:900, color:"#f0f4ff" }}>{account.name}</span>
            <span style={{ fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:20, background:firm.accent, color:firm.color, border:`1px solid ${firm.color}44` }}>{firm.label}</span>
            <span style={{ fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:20, background:"#0d1628", color:"#7a8aa8", border:"1px solid #1a2540" }}>{PHASES[account.phase]}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:14, fontSize:11, color:"#5a6a8a" }}>
            <span>Size <strong style={{ color:"#f0f4ff", fontFamily:"monospace" }}>${(account.accountSize/1000).toFixed(0)}K</strong></span>
            <span>Starting <strong style={{ color:"#f0f4ff", fontFamily:"monospace" }}>{fmtUSD(account.startingBalance)}</strong></span>
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

      {/* 4 ring cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:14 }}>
        {/* Daily loss */}
        <div style={{ ...card, padding:"22px 18px 18px", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.1em" }}>Daily Loss Limit</div>
          <Ring
            value={stats.dailyLossUsed} max={account.dailyLoss}
            centerBig={`${fmtUSD(stats.dailyLossUsed)}`}
            centerSub={`of ${fmtUSD(account.dailyLoss)}`}
            mode="loss"
          />
          <div style={{ fontSize:12, fontWeight:700, color: dailyPct >= 90 ? "#ef4444" : dailyPct >= 70 ? "#f59e0b" : "#22c55e", textAlign:"center" }}>
            You can lose <span style={{ fontFamily:"monospace" }}>{fmtUSD(dailyRemaining)}</span> more today
          </div>
          <div style={{ fontSize:10, color:"#4a5a7a" }}>Resets at midnight CT</div>
        </div>

        {/* Max drawdown */}
        <div style={{ ...card, padding:"22px 18px 18px", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.1em" }}>Max Drawdown</div>
          <Ring
            value={stats.drawdownUsed} max={account.maxDrawdown}
            centerBig={fmtUSD(stats.drawdownUsed)}
            centerSub={`of ${fmtUSD(account.maxDrawdown)}`}
            mode="loss"
          />
          <div style={{ fontSize:12, fontWeight:700, color: ddPct >= 90 ? "#ef4444" : ddPct >= 70 ? "#f59e0b" : "#22c55e", textAlign:"center" }}>
            <span style={{ fontFamily:"monospace" }}>{fmtUSD(ddRemaining)}</span> buffer before breach
          </div>
          <div style={{ fontSize:10, color:"#4a5a7a" }}>Trailing from peak {fmtUSD(stats.peakBalance)}</div>
        </div>

        {/* Profit target */}
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
          <div style={{ fontSize:10, color:"#4a5a7a" }}>{account.minTradingDays} trading days minimum</div>
        </div>

        {/* Consistency */}
        <div style={{ ...card, padding:"22px 18px 18px", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:11, fontWeight:800, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.1em" }}>Consistency Score</div>
          <Ring
            value={stats.consistencyScore} max={100}
            centerBig={`${stats.consistencyScore}%`}
            mode="fill"
          />
          <div style={{ fontSize:12, fontWeight:700, color: stats.consistencyScore >= 70 ? "#22c55e" : stats.consistencyScore >= 40 ? "#f59e0b" : "#ef4444", textAlign:"center" }}>
            No single day {">"} {account.consistencyMax}% of total profit
          </div>
          <div style={{ fontSize:10, color:"#4a5a7a" }}>Best day {fmtUSD(stats.bestDayPnl)} of {fmtUSD(Math.max(0,stats.totalProfit))}</div>
        </div>
      </div>

      {/* Trading days counter */}
      <div style={{ ...card, padding:"18px 22px" }}>
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:10 }}>
          <div>
            <div style={{ fontSize:11, color:"#5a6a8a", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em" }}>Trading Days</div>
            <div style={{ fontSize:20, fontWeight:900, color:"#f0f4ff", fontFamily:"monospace", marginTop:2 }}>
              Day {stats.tradingDaysDone} of {account.minTradingDays} minimum
            </div>
          </div>
          <div style={{ fontSize:12, fontWeight:700, color: stats.tradingDaysDone >= account.minTradingDays ? "#22c55e" : "#94a3b8" }}>
            {stats.tradingDaysDone >= account.minTradingDays ? "✅ Met" : `${account.minTradingDays - stats.tradingDaysDone} more needed`}
          </div>
        </div>
        <div style={{ height:8, borderRadius:4, background:"#0f1a2e", overflow:"hidden" }}>
          <div style={{
            width:`${Math.min(100, (stats.tradingDaysDone/account.minTradingDays)*100)}%`,
            height:"100%",
            background:"linear-gradient(90deg,#3b82f6,#22c55e)",
            borderRadius:4,
            transition:"width 0.7s",
          }}/>
        </div>
      </div>

      {/* Today */}
      <div style={{ ...card, padding:"20px 22px", borderColor: status.color + "44", background:`linear-gradient(135deg, #0b1120, ${status.bg})` }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:14, marginBottom:14 }}>
          <div>
            <div style={{ fontSize:11, color:"#5a6a8a", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Today&apos;s Trading</div>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div>
                <div style={{ fontSize:10, color:"#4a5a7a" }}>PnL</div>
                <div style={{ fontSize:22, fontWeight:900, fontFamily:"monospace", color: stats.todayPnl >= 0 ? "#22c55e" : "#ef4444" }}>{fmtUSDsigned(stats.todayPnl)}</div>
              </div>
              <div>
                <div style={{ fontSize:10, color:"#4a5a7a" }}>Trades</div>
                <div style={{ fontSize:18, fontWeight:800, fontFamily:"monospace", color: stats.todayTrades.length >= account.maxTradesPerDay ? "#f59e0b" : "#f0f4ff" }}>
                  {stats.todayTrades.length} <span style={{ color:"#4a5a7a", fontSize:13 }}>of {account.maxTradesPerDay}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize:10, color:"#4a5a7a" }}>Session left</div>
                <div style={{ fontSize:18, fontWeight:800, fontFamily:"monospace", color:"#f0f4ff" }}>{sessionH}h {sessionM}m</div>
              </div>
            </div>
          </div>
          <div style={{ fontSize:12, fontWeight:800, padding:"8px 16px", borderRadius:24, background:status.bg, color:status.color, border:`1px solid ${status.color}55`, letterSpacing:"0.04em" }}>
            {status.label}
          </div>
        </div>

        <div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
            <span style={{ fontSize:10, color:"#5a6a8a", fontWeight:700 }}>Daily loss used</span>
            <span style={{ fontSize:10, color: dailyPct >= 90 ? "#ef4444" : "#5a6a8a", fontWeight:700, fontFamily:"monospace" }}>
              {fmtUSD(stats.dailyLossUsed)} / {fmtUSD(account.dailyLoss)}
            </span>
          </div>
          <div style={{ height:6, borderRadius:3, background:"#0f1a2e", overflow:"hidden" }}>
            <div style={{
              width:`${Math.min(100, dailyPct)}%`,
              height:"100%",
              background: dailyPct >= 90 ? "linear-gradient(90deg,#ef4444,#fca5a5)" : dailyPct >= 70 ? "linear-gradient(90deg,#f59e0b,#fcd34d)" : "linear-gradient(90deg,#22c55e,#86efac)",
              borderRadius:3,
              transition:"width 0.5s",
            }}/>
          </div>
        </div>
      </div>

      {/* History calendar */}
      <HistoryCalendar account={account} stats={stats}/>
    </div>
  );
}

// ── Calendar history ─────────────────────────────────────────────
function HistoryCalendar({ account, stats }:{
  account:ChallengeAccount; stats:Computed;
}) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selected, setSelected] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month+1, 0);
  const startOffset = firstDay.getDay(); // Sun=0
  const daysInMonth = lastDay.getDate();
  const cells: (Date | null)[] = [];
  for (let i=0; i<startOffset; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = cursor.toLocaleDateString("en-US",{ month:"long", year:"numeric" });

  function cellColor(d:Date): { bg:string; border:string; text:string; emoji?:string } {
    const k = dayKey(d);
    const day = stats.byDay[k];
    if (!day || day.pnl === 0 && day.trades.length === 0) return { bg:"#0d1628", border:"#1a2540", text:"#3a4a6a" };
    const lossPct = day.pnl < 0 ? (Math.abs(day.pnl) / account.dailyLoss) * 100 : 0;
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
                background: c.bg,
                color: c.text,
                cursor: day ? "pointer" : "default",
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                gap:2, padding:4,
                position:"relative",
                transition:"transform 0.15s",
              }}
              onMouseEnter={e => { if (day) e.currentTarget.style.transform = "scale(1.05)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
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

      {/* Legend */}
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

      {/* Selected day details */}
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

  // Persist updated peak balance back into account so trailing DD reference stays correct
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
      {/* Top bar */}
      <div style={{ borderBottom:"1px solid #0d1628", background:"rgba(6,13,26,0.95)", padding:"14px 28px", display:"flex", alignItems:"center", gap:16, position:"sticky", top:0, zIndex:10, backdropFilter:"blur(8px)" }}>
        <a href="/dashboard" style={{ fontSize:12, color:"#3a4a6a", textDecoration:"none" }}>← Dashboard</a>
        <span style={{ fontSize:14, fontWeight:800, color:"#f0f4ff" }}>Challenge Tracker</span>
        <div style={{ flex:1 }}/>
        {accounts.length > 0 && mode === "view" && (
          <button onClick={()=>setMode("new")} style={{ padding:"7px 14px", borderRadius:9, border:"1px solid #1a2540", background:"#0b1120", color:"#a78bfa", fontSize:11, fontWeight:800, cursor:"pointer" }}>+ Add Account</button>
        )}
      </div>

      {/* Header */}
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"28px 24px 12px" }}>
        <div style={{ marginBottom:18 }}>
          <h1 style={{ fontSize:28, fontWeight:900, color:"#f0f4ff", margin:0, letterSpacing:"-0.01em" }}>🏆 Challenge Tracker</h1>
          <p style={{ fontSize:13, color:"#5a6a8a", margin:"6px 0 0" }}>Track your funded account rules in real time</p>
        </div>

        {/* Account tabs */}
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
