"use client";

import { useEffect, useState } from "react";

// ── Instrument specs ──────────────────────────────────────────────
type InstrumentKey = "ES" | "NQ" | "CL" | "GC" | "CRYPTO";
interface Instrument {
  key:       InstrumentKey;
  label:     string;
  emoji:     string;
  perPoint:  number;
  tickSize:  number;
  unit:      string;
  custom?:   boolean;
}
const INSTRUMENTS: Instrument[] = [
  { key:"ES",     label:"ES — S&P 500 Futures",   emoji:"📈", perPoint:50,    tickSize:0.25, unit:"pts" },
  { key:"NQ",     label:"NQ — Nasdaq Futures",    emoji:"💻", perPoint:20,    tickSize:0.25, unit:"pts" },
  { key:"CL",     label:"CL — Crude Oil",         emoji:"🛢", perPoint:1000,  tickSize:0.01, unit:"pts" },
  { key:"GC",     label:"Gold (GC)",              emoji:"🥇", perPoint:100,   tickSize:0.10, unit:"pts" },
  { key:"CRYPTO", label:"Crypto (custom size)",   emoji:"₿",  perPoint:1,     tickSize:0.01, unit:"$",  custom:true },
];

// ── Strategy options ──────────────────────────────────────────────
const WATCH_LIST = ["ES","NQ","CL","Gold","SOL","BTC","ETH"] as const;
const DAYS       = ["Mon","Tue","Wed","Thu","Fri"] as const;
const RR_OPTIONS = [1.5, 2, 2.5, 3] as const;
const SETUP_TYPES = ["EMA Crossover","VWAP Bounce","Opening Range","Support/Resistance","Custom"] as const;

interface StrategySettings {
  startTime:      string;
  endTime:        string;
  maxTrades:      number;
  maxDailyLoss:   number;
  maxDailyLossPct:number;
  useDailyLossPct:boolean;
  days:           Record<string,boolean>;
  watch:          Record<string,boolean>;
  minRR:          number;
  setupType:      string;
  checklist:      string[];
}

const DEFAULT_SETTINGS: StrategySettings = {
  startTime:       "09:30",
  endTime:         "11:00",
  maxTrades:       3,
  maxDailyLoss:    1500,
  maxDailyLossPct: 3,
  useDailyLossPct: false,
  days:            { Mon:true, Tue:true, Wed:true, Thu:true, Fri:true },
  watch:           { NQ:true, ES:true, CL:false, Gold:false, SOL:false, BTC:false, ETH:false },
  minRR:           2,
  setupType:       "EMA Crossover",
  checklist:       ["Price above VWAP", "EMA 9 crossed above EMA 21", "Volume above average", "Market not in news time"],
};

// ── helpers ──────────────────────────────────────────────────────
function getUsername(): string {
  try { return JSON.parse(localStorage.getItem("tradedesk_session_v1") ?? "{}").username || "guest"; }
  catch { return "guest"; }
}
const fmtMoney = (n: number) => (n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
const clamp    = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ── Position Size Calculator ─────────────────────────────────────
function PositionCalculator({ accountSize, setAccountSize }: { accountSize: number; setAccountSize: (n:number)=>void }) {
  const [riskPct,  setRiskPct]   = useState(1);
  const [entry,    setEntry]     = useState("");
  const [stop,     setStop]      = useState("");
  const [target,   setTarget]    = useState("");
  const [instKey,  setInstKey]   = useState<InstrumentKey>("NQ");
  const [cryptoSize, setCryptoSize] = useState("1");

  const inst = INSTRUMENTS.find(i => i.key === instKey)!;

  const entryN  = parseFloat(entry);
  const stopN   = parseFloat(stop);
  const targetN = parseFloat(target);
  const cryptoN = parseFloat(cryptoSize) || 1;

  const perPoint = inst.custom ? cryptoN : inst.perPoint;

  const dollarRisk = accountSize * (riskPct / 100);
  const pointsToStop = entryN && stopN ? Math.abs(entryN - stopN) : 0;
  const ticksToStop  = pointsToStop && inst.tickSize ? pointsToStop / inst.tickSize : 0;
  const riskPerContract = pointsToStop * perPoint;
  const contracts = riskPerContract > 0 ? Math.floor(dollarRisk / riskPerContract) : 0;
  const positionValue = entryN && contracts ? entryN * perPoint * contracts : 0;
  const maxLoss = contracts > 0 ? -(pointsToStop * perPoint * contracts) : 0;

  const rewardPoints = targetN && entryN ? Math.abs(targetN - entryN) : 0;
  const rr = pointsToStop > 0 && rewardPoints > 0 ? rewardPoints / pointsToStop : 0;

  // Risk meter colors
  let meterColor = "#34d399"; // green
  let meterLabel = "Conservative";
  if (riskPct > 1 && riskPct <= 2) { meterColor = "#fbbf24"; meterLabel = "Moderate"; }
  if (riskPct > 2)                 { meterColor = "#f87171"; meterLabel = "Aggressive"; }

  // Losses to blow 10%
  const lossesToTenPct = riskPct > 0 ? Math.ceil(10 / riskPct) : 0;

  const inp: React.CSSProperties = { width:"100%", padding:"11px 13px", borderRadius:10, border:"1px solid #1a2540", background:"#0d1628", color:"#f0f4ff", fontSize:14, fontFamily:"monospace", outline:"none", boxSizing:"border-box", fontWeight:600 };
  const lbl: React.CSSProperties = { fontSize:10, fontWeight:700, color:"#4a5a7a", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 };

  return (
    <section style={{ background:"#0b1120", border:"1px solid #1a2540", borderRadius:18, padding:24 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
        <span style={{ fontSize:20 }}>🧮</span>
        <h2 style={{ fontSize:18, fontWeight:900, color:"#f0f4ff", margin:0, letterSpacing:"-0.01em" }}>Position Size Calculator</h2>
      </div>
      <p style={{ fontSize:12, color:"#3a4a6a", margin:"0 0 20px" }}>Math-first sizing. No external data needed.</p>

      {/* Instrument picker */}
      <div style={{ marginBottom:16 }}>
        <label style={lbl}>Instrument</label>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(110px, 1fr))", gap:8 }}>
          {INSTRUMENTS.map(i => (
            <button key={i.key} onClick={() => setInstKey(i.key)} style={{
              padding:"10px 8px", borderRadius:10,
              border:`1px solid ${instKey===i.key ? "#38bdf8" : "#1a2540"}`,
              background: instKey===i.key ? "rgba(56,189,248,0.08)" : "#0d1628",
              color: instKey===i.key ? "#38bdf8" : "#94a3b8",
              fontSize:11, fontWeight:700, cursor:"pointer", textAlign:"center", lineHeight:1.3
            }}>
              <div style={{ fontSize:16, marginBottom:3 }}>{i.emoji}</div>
              {i.key}
              <div style={{ fontSize:9, color:"#3a4a6a", marginTop:2, fontWeight:500 }}>
                {i.custom ? "custom" : `$${i.perPoint}/pt`}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Crypto contract size */}
      {inst.custom && (
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Contract Size ($ per $1 move)</label>
          <input type="number" value={cryptoSize} onChange={e => setCryptoSize(e.target.value)} placeholder="1" style={inp}/>
          <div style={{ fontSize:10, color:"#3a4a6a", marginTop:5 }}>E.g. BTC perp 1.0 = $1 per $1 move per contract.</div>
        </div>
      )}

      {/* Account & risk */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
        <div>
          <label style={lbl}>Account Size ($)</label>
          <input type="number" value={accountSize} onChange={e => setAccountSize(parseFloat(e.target.value) || 0)} style={inp}/>
        </div>
        <div>
          <label style={lbl}>Risk % per trade</label>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <input type="range" min="0.1" max="5" step="0.1" value={riskPct} onChange={e => setRiskPct(parseFloat(e.target.value))} style={{ flex:1, accentColor:meterColor }}/>
            <div style={{ width:54, padding:"7px 0", borderRadius:8, background:`${meterColor}15`, border:`1px solid ${meterColor}30`, color:meterColor, fontSize:13, fontWeight:800, fontFamily:"monospace", textAlign:"center" }}>
              {riskPct.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Risk meter */}
      <div style={{ marginBottom:18, padding:"10px 12px", borderRadius:10, background:`${meterColor}10`, border:`1px solid ${meterColor}30`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:meterColor, boxShadow:`0 0 12px ${meterColor}` }}/>
          <span style={{ fontSize:12, fontWeight:700, color:meterColor }}>{meterLabel}</span>
        </div>
        <div style={{ display:"flex", gap:3 }}>
          {[0,1,2,3,4].map(i => {
            const filled = riskPct >= (i+1);
            const col = i < 2 ? "#34d399" : i < 4 ? "#fbbf24" : "#f87171";
            return <div key={i} style={{ width:18, height:6, borderRadius:3, background: filled ? col : "#1a2540" }}/>;
          })}
        </div>
      </div>

      {/* Prices */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:18 }}>
        <div>
          <label style={lbl}>Entry</label>
          <input type="number" value={entry} onChange={e=>setEntry(e.target.value)} placeholder="0.00" style={inp}/>
        </div>
        <div>
          <label style={lbl}>Stop Loss</label>
          <input type="number" value={stop} onChange={e=>setStop(e.target.value)} placeholder="0.00" style={{ ...inp, borderColor:"rgba(248,113,113,0.25)" }}/>
        </div>
        <div>
          <label style={lbl}>Target (opt.)</label>
          <input type="number" value={target} onChange={e=>setTarget(e.target.value)} placeholder="0.00" style={{ ...inp, borderColor:"rgba(52,211,153,0.25)" }}/>
        </div>
      </div>

      {/* Output */}
      <div style={{ background:"#060d1a", border:"1px solid #1a2540", borderRadius:14, padding:18 }}>
        <div style={{ fontSize:10, fontWeight:800, color:"#3a4a6a", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:14 }}>
          Calculated Position
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
          <Stat label="Dollar Risk"            value={fmtMoney(dollarRisk)} accent="#38bdf8"/>
          <Stat label={`${inst.unit} to Stop`} value={pointsToStop ? pointsToStop.toFixed(2) + (inst.unit === "pts" ? ` (${ticksToStop.toFixed(0)} ticks)` : "") : "—"} accent="#f0f4ff"/>
          <Stat label="Contracts to Trade"     value={contracts > 0 ? `${contracts}` : "—"} accent={contracts > 0 ? "#34d399" : "#3a4a6a"} big/>
          <Stat label="Position Value"         value={positionValue ? fmtMoney(positionValue) : "—"} accent="#f0f4ff"/>
          <Stat label="Risk/Reward"            value={rr > 0 ? `${rr.toFixed(2)}R` : "—"} accent={rr >= 2 ? "#34d399" : rr > 0 ? "#fbbf24" : "#3a4a6a"}/>
          <Stat label="Max Loss if Stopped"    value={maxLoss ? `${fmtMoney(maxLoss)} (${riskPct.toFixed(1)}%)` : "—"} accent="#f87171"/>
        </div>

        {/* Warning */}
        <div style={{ padding:"11px 13px", borderRadius:10, background:"rgba(251,191,36,0.06)", border:"1px solid rgba(251,191,36,0.2)", fontSize:12, color:"#fbbf24", display:"flex", gap:8, alignItems:"flex-start" }}>
          <span style={{ fontSize:14 }}>⚠</span>
          <span>
            At <strong>{riskPct.toFixed(1)}%</strong> per trade, <strong>{lossesToTenPct}</strong> losses in a row would blow <strong>10%</strong> of your account.
          </span>
        </div>

        {contracts === 0 && entryN > 0 && stopN > 0 && (
          <div style={{ marginTop:10, padding:"10px 12px", borderRadius:10, background:"rgba(248,113,113,0.07)", border:"1px solid rgba(248,113,113,0.2)", fontSize:11, color:"#f87171" }}>
            ⚠ Stop is too wide for this risk %. Reduce position or widen risk to take this trade.
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, accent, big = false }: { label: string; value: string; accent: string; big?: boolean }) {
  return (
    <div>
      <div style={{ fontSize:10, color:"#3a4a6a", textTransform:"uppercase", letterSpacing:"0.08em", fontWeight:700, marginBottom:4 }}>{label}</div>
      <div style={{ fontSize: big ? 22 : 16, fontWeight:800, color:accent, fontFamily:"monospace" }}>{value}</div>
    </div>
  );
}

// ── Strategy Settings ────────────────────────────────────────────
function StrategySettingsPanel({ accountSize, settings, setSettings }: { accountSize: number; settings: StrategySettings; setSettings: (s: StrategySettings) => void }) {
  const [newChecklist, setNewChecklist] = useState("");

  const addItem = () => {
    if (!newChecklist.trim()) return;
    setSettings({ ...settings, checklist: [...settings.checklist, newChecklist.trim()] });
    setNewChecklist("");
  };
  const removeItem = (idx: number) => setSettings({ ...settings, checklist: settings.checklist.filter((_,i) => i !== idx) });

  const inp: React.CSSProperties = { padding:"9px 11px", borderRadius:9, border:"1px solid #1a2540", background:"#0d1628", color:"#f0f4ff", fontSize:13, fontFamily:"monospace", outline:"none", boxSizing:"border-box", fontWeight:600 };
  const lbl: React.CSSProperties = { fontSize:10, fontWeight:700, color:"#4a5a7a", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 };

  const dailyLossDollar = settings.useDailyLossPct ? Math.round(accountSize * settings.maxDailyLossPct / 100) : settings.maxDailyLoss;

  // Build trade plan
  const watchList = Object.keys(settings.watch).filter(k => settings.watch[k]);
  const dayList   = Object.keys(settings.days).filter(k => settings.days[k]);
  const riskPerTrade = Math.round(accountSize * 0.01); // 1% reference

  // Expected signals — rough heuristic
  let signalsPerWeek = "2-3";
  const watchCount = watchList.length;
  if (watchCount === 0) signalsPerWeek = "0";
  else if (watchCount === 1 && settings.maxTrades <= 2) signalsPerWeek = "1-2";
  else if (watchCount >= 4 || settings.maxTrades >= 5) signalsPerWeek = "5-8";
  else if (watchCount >= 2) signalsPerWeek = "3-5";

  return (
    <section style={{ background:"#0b1120", border:"1px solid #1a2540", borderRadius:18, padding:24 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
        <span style={{ fontSize:20 }}>⚙️</span>
        <h2 style={{ fontSize:18, fontWeight:900, color:"#f0f4ff", margin:0, letterSpacing:"-0.01em" }}>Strategy Signal Settings</h2>
      </div>
      <p style={{ fontSize:12, color:"#3a4a6a", margin:"0 0 20px" }}>Define your rules. Saved automatically.</p>

      {/* Setup Rules */}
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:11, fontWeight:800, color:"#38bdf8", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:12 }}>Setup Rules</div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <div>
            <label style={lbl}>Start time</label>
            <input type="time" value={settings.startTime} onChange={e => setSettings({ ...settings, startTime: e.target.value })} style={{ ...inp, width:"100%" }}/>
          </div>
          <div>
            <label style={lbl}>End time</label>
            <input type="time" value={settings.endTime} onChange={e => setSettings({ ...settings, endTime: e.target.value })} style={{ ...inp, width:"100%" }}/>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <div>
            <label style={lbl}>Max trades / day</label>
            <input type="number" min="1" max="20" value={settings.maxTrades} onChange={e => setSettings({ ...settings, maxTrades: clamp(parseInt(e.target.value)||1, 1, 50) })} style={{ ...inp, width:"100%" }}/>
          </div>
          <div>
            <label style={lbl}>
              Max daily loss
              <button onClick={() => setSettings({ ...settings, useDailyLossPct: !settings.useDailyLossPct })} style={{ marginLeft:8, background:"transparent", border:"none", color:"#38bdf8", fontSize:10, cursor:"pointer", textTransform:"none", letterSpacing:0, fontWeight:600 }}>
                use {settings.useDailyLossPct ? "$" : "%"}
              </button>
            </label>
            {settings.useDailyLossPct ? (
              <input type="number" min="0.5" max="20" step="0.5" value={settings.maxDailyLossPct} onChange={e => setSettings({ ...settings, maxDailyLossPct: parseFloat(e.target.value)||3 })} style={{ ...inp, width:"100%" }}/>
            ) : (
              <input type="number" min="50" step="50" value={settings.maxDailyLoss} onChange={e => setSettings({ ...settings, maxDailyLoss: parseFloat(e.target.value)||0 })} style={{ ...inp, width:"100%" }}/>
            )}
          </div>
        </div>

        {/* Days */}
        <div style={{ marginBottom:14 }}>
          <label style={lbl}>Trading days</label>
          <div style={{ display:"flex", gap:6 }}>
            {DAYS.map(d => (
              <button key={d} onClick={() => setSettings({ ...settings, days: { ...settings.days, [d]: !settings.days[d] } })} style={{
                flex:1, padding:"9px 0", borderRadius:8,
                border:`1px solid ${settings.days[d] ? "#38bdf8" : "#1a2540"}`,
                background: settings.days[d] ? "rgba(56,189,248,0.08)" : "#0d1628",
                color: settings.days[d] ? "#38bdf8" : "#3a4a6a",
                fontSize:11, fontWeight:700, cursor:"pointer"
              }}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Instruments */}
        <div style={{ marginBottom:14 }}>
          <label style={lbl}>Instruments to watch</label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {WATCH_LIST.map(w => (
              <button key={w} onClick={() => setSettings({ ...settings, watch: { ...settings.watch, [w]: !settings.watch[w] } })} style={{
                padding:"7px 13px", borderRadius:8,
                border:`1px solid ${settings.watch[w] ? "#38bdf8" : "#1a2540"}`,
                background: settings.watch[w] ? "rgba(56,189,248,0.08)" : "#0d1628",
                color: settings.watch[w] ? "#38bdf8" : "#3a4a6a",
                fontSize:11, fontWeight:700, cursor:"pointer"
              }}>
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* Min RR */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div>
            <label style={lbl}>Min R:R required</label>
            <div style={{ display:"flex", gap:4 }}>
              {RR_OPTIONS.map(rr => (
                <button key={rr} onClick={() => setSettings({ ...settings, minRR: rr })} style={{
                  flex:1, padding:"9px 0", borderRadius:8,
                  border:`1px solid ${settings.minRR===rr ? "#38bdf8" : "#1a2540"}`,
                  background: settings.minRR===rr ? "rgba(56,189,248,0.08)" : "#0d1628",
                  color: settings.minRR===rr ? "#38bdf8" : "#3a4a6a",
                  fontSize:11, fontWeight:700, cursor:"pointer"
                }}>{rr}R</button>
              ))}
            </div>
          </div>
          <div>
            <label style={lbl}>Setup type</label>
            <select value={settings.setupType} onChange={e => setSettings({ ...settings, setupType: e.target.value })} style={{ ...inp, width:"100%", appearance:"none", WebkitAppearance:"none", cursor:"pointer" }}>
              {SETUP_TYPES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Signal Checklist */}
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:11, fontWeight:800, color:"#a78bfa", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:12 }}>Signal Checklist</div>
        <p style={{ fontSize:11, color:"#3a4a6a", margin:"0 0 12px" }}>Conditions that must be true before entering.</p>

        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
          {settings.checklist.map((item, idx) => (
            <div key={idx} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", borderRadius:9, background:"#0d1628", border:"1px solid #1a2540" }}>
              <span style={{ fontSize:11, color:"#a78bfa" }}>☐</span>
              <span style={{ flex:1, fontSize:12, color:"#c8d8f0" }}>{item}</span>
              <button onClick={() => removeItem(idx)} style={{ background:"transparent", border:"none", color:"#3a4a6a", cursor:"pointer", fontSize:14, padding:"0 4px" }} title="Remove">✕</button>
            </div>
          ))}
        </div>

        <div style={{ display:"flex", gap:8 }}>
          <input value={newChecklist} onChange={e => setNewChecklist(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addItem(); }} placeholder="Add a checklist item…" style={{ ...inp, flex:1, fontFamily:"system-ui" }}/>
          <button onClick={addItem} style={{ padding:"9px 16px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#7c3aed,#a78bfa)", color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer" }}>+ Add</button>
        </div>
      </div>

      {/* Trade Plan */}
      <div style={{ background:"linear-gradient(135deg, rgba(56,189,248,0.08), rgba(167,139,250,0.08))", border:"1px solid rgba(56,189,248,0.2)", borderRadius:14, padding:18 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
          <span style={{ fontSize:18 }}>📋</span>
          <span style={{ fontSize:13, fontWeight:800, color:"#f0f4ff" }}>Your Trade Plan</span>
        </div>
        <div style={{ display:"grid", gap:8, fontSize:12, color:"#94a3b8", lineHeight:1.6 }}>
          <PlanRow k="Instrument" v={watchList.length ? watchList.join(", ") : "—"}/>
          <PlanRow k="Session"    v={`${settings.startTime} – ${settings.endTime} · ${dayList.join(", ") || "no days"}`}/>
          <PlanRow k="Max trades" v={`${settings.maxTrades}/day · stop after ${fmtMoney(dailyLossDollar)} daily loss`}/>
          <PlanRow k="Risk/trade" v={`${fmtMoney(riskPerTrade)} (1% of ${fmtMoney(accountSize)})`}/>
          <PlanRow k="Min setup"  v={`${settings.minRR}R or better · ${settings.setupType}`}/>
          <PlanRow k="Checklist"  v={`${settings.checklist.length} item${settings.checklist.length===1?"":"s"}`}/>
        </div>
        <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid rgba(56,189,248,0.15)", fontSize:12, color:"#38bdf8", fontWeight:700 }}>
          → Expected: {signalsPerWeek} signals per week
        </div>
      </div>
    </section>
  );
}

function PlanRow({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display:"flex", gap:12 }}>
      <span style={{ minWidth:90, color:"#3a4a6a", fontWeight:700, textTransform:"uppercase", fontSize:10, letterSpacing:"0.08em", paddingTop:2 }}>{k}</span>
      <span style={{ flex:1, color:"#e2e8f0", fontFamily:"monospace" }}>{v}</span>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────
export default function SignalsPage() {
  const [username,    setUsername]    = useState("");
  const [accountSize, setAccountSize] = useState(50000);
  const [settings,    setSettings]    = useState<StrategySettings>(DEFAULT_SETTINGS);
  const [loaded,      setLoaded]      = useState(false);
  const [savedFlash,  setSavedFlash]  = useState(false);

  // Load
  useEffect(() => {
    const u = getUsername();
    setUsername(u);
    try {
      const raw = localStorage.getItem(`nexyru_strategy_settings_${u}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.settings) setSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
        if (typeof parsed.accountSize === "number") setAccountSize(parsed.accountSize);
      }
    } catch {}
    setLoaded(true);
  }, []);

  // Save
  useEffect(() => {
    if (!loaded || !username) return;
    try {
      localStorage.setItem(`nexyru_strategy_settings_${username}`, JSON.stringify({ accountSize, settings }));
      setSavedFlash(true);
      const t = setTimeout(() => setSavedFlash(false), 1200);
      return () => clearTimeout(t);
    } catch {}
  }, [accountSize, settings, loaded, username]);

  return (
    <div style={{ minHeight:"100vh", background:"#060d1a", color:"#c8d8f0", fontFamily:"system-ui,sans-serif" }}>

      {/* Top nav */}
      <div style={{ borderBottom:"1px solid #0d1628", background:"rgba(6,13,26,0.95)", padding:"14px 28px", display:"flex", alignItems:"center", gap:16, position:"sticky", top:0, zIndex:10, backdropFilter:"blur(8px)" }}>
        <a href="/dashboard" style={{ fontSize:12, color:"#3a4a6a", textDecoration:"none" }}>← Dashboard</a>
        <span style={{ fontSize:14, fontWeight:800, color:"#f0f4ff" }}>⚡ Signal Generator</span>
        <div style={{ flex:1 }}/>
        <span style={{ fontSize:10, color: savedFlash ? "#34d399" : "#2e3f5a", fontWeight:700, transition:"color 0.3s" }}>
          {savedFlash ? "✓ Saved" : "Auto-save on"}
        </span>
      </div>

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"32px 20px" }}>

        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <h1 style={{ fontSize:28, fontWeight:900, color:"#f0f4ff", margin:"0 0 6px", letterSpacing:"-0.02em" }}>Strategy Signal Generator</h1>
          <p style={{ fontSize:13, color:"#3a4a6a", margin:0 }}>
            Build your trading edge: sizing math + rule-based setup definition. Everything saves locally to your profile.
          </p>
        </div>

        {/* Two-column on desktop */}
        <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)", gap:20 }} className="signals-grid">
          <PositionCalculator accountSize={accountSize} setAccountSize={setAccountSize}/>
          <StrategySettingsPanel accountSize={accountSize} settings={settings} setSettings={setSettings}/>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .signals-grid { grid-template-columns: 1fr !important; }
        }
        input[type="range"] {
          height: 4px; border-radius: 4px; background: #1a2540;
        }
      `}</style>
    </div>
  );
}
