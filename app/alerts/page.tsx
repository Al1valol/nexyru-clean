"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ── Types & constants ─────────────────────────────────────────────
type InstrumentKey = "ES" | "NQ" | "CL" | "GC" | "SI" | "BTC" | "ETH" | "SOL";

interface InstrumentSpec {
  key:      InstrumentKey;
  label:    string;
  emoji:    string;
  tickSize: number;
  tickValue:number;   // $ per tick
  perPoint: number;   // $ per point
  unit:     string;
}

const INSTRUMENTS: InstrumentSpec[] = [
  { key:"ES",  label:"ES — S&P 500",     emoji:"📈", tickSize:0.25, tickValue:12.50, perPoint:50,   unit:"pts" },
  { key:"NQ",  label:"NQ — Nasdaq 100",  emoji:"💻", tickSize:0.25, tickValue:5.00,  perPoint:20,   unit:"pts" },
  { key:"CL",  label:"CL — Crude Oil",   emoji:"🛢",  tickSize:0.01, tickValue:10.00, perPoint:1000, unit:"pts" },
  { key:"GC",  label:"GC — Gold",        emoji:"🥇", tickSize:0.10, tickValue:10.00, perPoint:100,  unit:"pts" },
  { key:"SI",  label:"SI — Silver",      emoji:"🥈", tickSize:0.005,tickValue:25.00, perPoint:5000, unit:"pts" },
  { key:"BTC", label:"BTC — Bitcoin",    emoji:"₿",  tickSize:1,    tickValue:1,     perPoint:1,    unit:"$" },
  { key:"ETH", label:"ETH — Ethereum",   emoji:"Ξ",  tickSize:0.01, tickValue:0.01,  perPoint:1,    unit:"$" },
  { key:"SOL", label:"SOL — Solana",     emoji:"◎",  tickSize:0.01, tickValue:0.01,  perPoint:1,    unit:"$" },
];

const DAYS      = ["Mon","Tue","Wed","Thu","Fri"] as const;
const TIMEZONES = ["ET","CT","MT","PT"] as const;
const TIMEFRAMES= ["1m","2m","5m","15m","30m","1h"] as const;
const RR_OPTS   = ["1:1","1.5:1","2:1","2.5:1","3:1"] as const;
const NO_TRADE_ZONES = ["News events", "Market open first 15min", "Last 30min of session"] as const;

const CONDITION_TYPES = [
  { id:"price_above",       label:"Price above [value]",          needsValue:true  },
  { id:"price_below",       label:"Price below [value]",          needsValue:true  },
  { id:"price_crosses",     label:"Price crosses [value]",        needsValue:true  },
  { id:"ema_crossover",     label:"EMA crossover (9/21)",         needsValue:false },
  { id:"rsi_above",         label:"RSI above [value]",            needsValue:true  },
  { id:"rsi_below",         label:"RSI below [value]",            needsValue:true  },
  { id:"new_session_high",  label:"New session high",             needsValue:false },
  { id:"new_session_low",   label:"New session low",              needsValue:false },
  { id:"approaching_dll",   label:"Approaching daily loss limit", needsValue:false },
  { id:"max_trades_reached",label:"Max trades reached",           needsValue:false },
] as const;
type ConditionId = typeof CONDITION_TYPES[number]["id"];

interface TradingSettings {
  accountSize:        number;
  maxRiskPct:         number;
  maxDailyLossPct:    number;
  maxTradesPerDay:    number;
  tradingDays:        Record<string, boolean>;
  sessionStart:       string;
  sessionEnd:         string;
  timezone:           typeof TIMEZONES[number];
  noTradeZones:       Record<string, boolean>;
  primaryInstruments: Record<InstrumentKey, boolean>;
  defaultTimeframe:   typeof TIMEFRAMES[number];
  linkedStrategyId:   string;
  minRR:              typeof RR_OPTS[number];
  waitForClose:       boolean;
  maxConcurrent:      number;
}

const DEFAULT_SETTINGS: TradingSettings = {
  accountSize:        50000,
  maxRiskPct:         1,
  maxDailyLossPct:    3,
  maxTradesPerDay:    3,
  tradingDays:        { Mon:true, Tue:true, Wed:true, Thu:true, Fri:true },
  sessionStart:       "09:30",
  sessionEnd:         "11:00",
  timezone:           "ET",
  noTradeZones:       { "News events":true, "Market open first 15min":true, "Last 30min of session":false },
  primaryInstruments: { ES:true, NQ:true, CL:false, GC:false, SI:false, BTC:false, ETH:false, SOL:false },
  defaultTimeframe:   "5m",
  linkedStrategyId:   "",
  minRR:              "2:1",
  waitForClose:       true,
  maxConcurrent:      1,
};

interface AlertItem {
  id:           string;
  name:         string;
  instrument:   InstrumentKey;
  condition:    ConditionId;
  value:        string;
  method:       "browser" | "email" | "both";
  repeating:    boolean;
  notes:        string;
  enabled:      boolean;
  lastTriggered:number | null;
  createdAt:    number;
}

interface SavedStrategy { id: string; name: string }

// ── helpers ──────────────────────────────────────────────────────
function getUsername(): string {
  try { return JSON.parse(localStorage.getItem("tradedesk_session_v1") ?? "{}").username || "guest"; }
  catch { return "guest"; }
}
function readStrategies(): SavedStrategy[] {
  try {
    const raw = JSON.parse(localStorage.getItem("tradedesk_strategies_v8") || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((s: { id?: unknown; name?: unknown }) => s && typeof s.id === "string" && typeof s.name === "string")
      .map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }));
  } catch { return []; }
}
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtMoney = (n: number) => (n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function timeAgo(ms: number | null): string {
  if (!ms) return "Never triggered";
  const diff = Date.now() - ms;
  if (diff < 60_000)        return `Last triggered: ${Math.floor(diff/1000)}s ago`;
  if (diff < 3_600_000)     return `Last triggered: ${Math.floor(diff/60_000)} mins ago`;
  if (diff < 86_400_000)    return `Last triggered: ${Math.floor(diff/3_600_000)} hrs ago`;
  return `Last triggered: ${Math.floor(diff/86_400_000)} days ago`;
}

function conditionDescription(a: AlertItem): string {
  switch (a.condition) {
    case "price_above":        return `${a.instrument} price above ${a.value}`;
    case "price_below":        return `${a.instrument} price below ${a.value}`;
    case "price_crosses":      return `${a.instrument} price crosses ${a.value}`;
    case "ema_crossover":      return `${a.instrument} EMA(9) crosses EMA(21)`;
    case "rsi_above":          return `${a.instrument} RSI above ${a.value}`;
    case "rsi_below":          return `${a.instrument} RSI below ${a.value}`;
    case "new_session_high":   return `${a.instrument} makes new session high`;
    case "new_session_low":    return `${a.instrument} makes new session low`;
    case "approaching_dll":    return `Within 80% of daily loss limit`;
    case "max_trades_reached": return `Daily max trade count reached`;
  }
}

// ── Cheap simulated price feed (no external API).
// Stable per-instrument seed so multiple alerts watching the same symbol see the same tick.
function nextPrice(prev: number | null, inst: InstrumentKey): number {
  const base: Record<InstrumentKey, number> = {
    ES:5300, NQ:18500, CL:78.50, GC:2350, SI:30.50,
    BTC:67500, ETH:3400, SOL:165,
  };
  const start = prev ?? base[inst];
  const drift = (Math.random() - 0.5) * 0.0015;
  return Math.max(0.01, start * (1 + drift));
}

// ─────────────────────────────────────────────────────────────────
// Trading Settings panel
// ─────────────────────────────────────────────────────────────────
function TradingSettingsPanel({
  settings, setSettings, strategies, onSave, savedFlash,
}: {
  settings: TradingSettings;
  setSettings: (s: TradingSettings) => void;
  strategies: SavedStrategy[];
  onSave: () => void;
  savedFlash: boolean;
}) {
  const lbl: React.CSSProperties = { fontSize:10, fontWeight:700, color:"#4a5a7a", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 };
  const inp: React.CSSProperties = { padding:"10px 12px", borderRadius:9, border:"1px solid #1a2540", background:"#0d1628", color:"#f0f4ff", fontSize:13, fontFamily:"monospace", outline:"none", boxSizing:"border-box", fontWeight:600, width:"100%" };
  const sectionTitle = (color: string, label: string) => (
    <div style={{ fontSize:11, fontWeight:800, color, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:12 }}>{label}</div>
  );

  const dailyLossDollar = Math.round(settings.accountSize * settings.maxDailyLossPct / 100);
  const selectedInstruments = (Object.entries(settings.primaryInstruments) as [InstrumentKey, boolean][])
    .filter(([, v]) => v).map(([k]) => k);
  const firstInst = INSTRUMENTS.find(i => i.key === selectedInstruments[0]) ?? INSTRUMENTS[0];

  return (
    <section style={{ background:"#0b1120", border:"1px solid #1a2540", borderRadius:18, padding:24 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
        <span style={{ fontSize:20 }}>⚙️</span>
        <h2 style={{ fontSize:18, fontWeight:900, color:"#f0f4ff", margin:0, letterSpacing:"-0.01em" }}>My Trading Settings</h2>
      </div>
      <p style={{ fontSize:12, color:"#3a4a6a", margin:"0 0 20px" }}>Set up once. Reused by every alert.</p>

      {/* ── Account ── */}
      <div style={{ marginBottom:24 }}>
        {sectionTitle("#38bdf8", "Account Settings")}

        <div style={{ marginBottom:14 }}>
          <label style={lbl}>Account size ($)</label>
          <input type="number" min={100} step={100} value={settings.accountSize}
            onChange={e => setSettings({ ...settings, accountSize: parseFloat(e.target.value) || 0 })} style={inp}/>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={lbl}>Max risk per trade — <span style={{ color:"#38bdf8", fontFamily:"monospace" }}>{settings.maxRiskPct.toFixed(1)}%</span></label>
          <input type="range" min="0.5" max="5" step="0.1" value={settings.maxRiskPct}
            onChange={e => setSettings({ ...settings, maxRiskPct: parseFloat(e.target.value) })}
            style={{ width:"100%", accentColor:"#38bdf8" }}/>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <div>
            <label style={lbl}>Max daily loss — <span style={{ color:"#f87171", fontFamily:"monospace" }}>{settings.maxDailyLossPct.toFixed(1)}%</span></label>
            <input type="range" min="1" max="10" step="0.5" value={settings.maxDailyLossPct}
              onChange={e => setSettings({ ...settings, maxDailyLossPct: parseFloat(e.target.value) })}
              style={{ width:"100%", accentColor:"#f87171" }}/>
          </div>
          <div>
            <label style={lbl}>Max daily loss ($) — auto</label>
            <input type="text" readOnly value={fmtMoney(dailyLossDollar)} style={{ ...inp, color:"#f87171", cursor:"not-allowed", opacity:0.85 }}/>
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={lbl}>Max trades per day</label>
          <input type="number" min={1} max={50} value={settings.maxTradesPerDay}
            onChange={e => setSettings({ ...settings, maxTradesPerDay: clamp(parseInt(e.target.value)||1, 1, 50) })} style={inp}/>
        </div>

        <div>
          <label style={lbl}>Trading days</label>
          <div style={{ display:"flex", gap:6 }}>
            {DAYS.map(d => (
              <button key={d}
                onClick={() => setSettings({ ...settings, tradingDays: { ...settings.tradingDays, [d]: !settings.tradingDays[d] } })}
                style={{
                  flex:1, padding:"9px 0", borderRadius:8,
                  border:`1px solid ${settings.tradingDays[d] ? "#38bdf8" : "#1a2540"}`,
                  background: settings.tradingDays[d] ? "rgba(56,189,248,0.08)" : "#0d1628",
                  color: settings.tradingDays[d] ? "#38bdf8" : "#3a4a6a",
                  fontSize:11, fontWeight:700, cursor:"pointer"
                }}>{d}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Session ── */}
      <div style={{ marginBottom:24 }}>
        {sectionTitle("#a78bfa", "Session Settings")}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:14 }}>
          <div>
            <label style={lbl}>Session start</label>
            <input type="time" value={settings.sessionStart} onChange={e => setSettings({ ...settings, sessionStart: e.target.value })} style={inp}/>
          </div>
          <div>
            <label style={lbl}>Session end</label>
            <input type="time" value={settings.sessionEnd} onChange={e => setSettings({ ...settings, sessionEnd: e.target.value })} style={inp}/>
          </div>
          <div>
            <label style={lbl}>Timezone</label>
            <select value={settings.timezone} onChange={e => setSettings({ ...settings, timezone: e.target.value as typeof TIMEZONES[number] })} style={{ ...inp, appearance:"none", WebkitAppearance:"none", cursor:"pointer" }}>
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label style={lbl}>No-trade zones</label>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {NO_TRADE_ZONES.map(z => {
              const on = !!settings.noTradeZones[z];
              return (
                <button key={z}
                  onClick={() => setSettings({ ...settings, noTradeZones: { ...settings.noTradeZones, [z]: !on } })}
                  style={{
                    display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:9,
                    border:`1px solid ${on ? "#a78bfa" : "#1a2540"}`,
                    background: on ? "rgba(167,139,250,0.08)" : "#0d1628",
                    color: on ? "#a78bfa" : "#5a6a8a",
                    fontSize:12, fontWeight:600, cursor:"pointer", textAlign:"left"
                  }}>
                  <span style={{ fontSize:13 }}>{on ? "☑" : "☐"}</span>
                  {z}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Instruments ── */}
      <div style={{ marginBottom:24 }}>
        {sectionTitle("#34d399", "Instrument Settings")}

        <div style={{ marginBottom:14 }}>
          <label style={lbl}>Primary instruments</label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {INSTRUMENTS.map(i => {
              const on = settings.primaryInstruments[i.key];
              return (
                <button key={i.key}
                  onClick={() => setSettings({ ...settings, primaryInstruments: { ...settings.primaryInstruments, [i.key]: !on } })}
                  style={{
                    padding:"7px 13px", borderRadius:8,
                    border:`1px solid ${on ? "#34d399" : "#1a2540"}`,
                    background: on ? "rgba(52,211,153,0.08)" : "#0d1628",
                    color: on ? "#34d399" : "#3a4a6a",
                    fontSize:11, fontWeight:700, cursor:"pointer"
                  }}>
                  <span style={{ marginRight:5 }}>{i.emoji}</span>{i.key}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div>
            <label style={lbl}>Default timeframe</label>
            <select value={settings.defaultTimeframe} onChange={e => setSettings({ ...settings, defaultTimeframe: e.target.value as typeof TIMEFRAMES[number] })} style={{ ...inp, appearance:"none", WebkitAppearance:"none", cursor:"pointer" }}>
              {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Tick / point value</label>
            <input type="text" readOnly
              value={selectedInstruments.length ? `${firstInst.key}: $${firstInst.tickValue}/tick · $${firstInst.perPoint}/${firstInst.unit}` : "—"}
              style={{ ...inp, cursor:"not-allowed", opacity:0.85, fontSize:11 }}/>
          </div>
        </div>
      </div>

      {/* ── Strategy ── */}
      <div style={{ marginBottom:20 }}>
        {sectionTitle("#fbbf24", "Strategy Settings")}

        <div style={{ marginBottom:14 }}>
          <label style={lbl}>Link to strategy</label>
          <select value={settings.linkedStrategyId} onChange={e => setSettings({ ...settings, linkedStrategyId: e.target.value })} style={{ ...inp, appearance:"none", WebkitAppearance:"none", cursor:"pointer" }}>
            <option value="">— Choose from Strategy Lab —</option>
            {strategies.length === 0 && <option value="" disabled>No saved strategies yet</option>}
            {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <div>
            <label style={lbl}>Minimum R:R required</label>
            <select value={settings.minRR} onChange={e => setSettings({ ...settings, minRR: e.target.value as typeof RR_OPTS[number] })} style={{ ...inp, appearance:"none", WebkitAppearance:"none", cursor:"pointer" }}>
              {RR_OPTS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Max concurrent trades</label>
            <input type="number" min={1} max={20} value={settings.maxConcurrent}
              onChange={e => setSettings({ ...settings, maxConcurrent: clamp(parseInt(e.target.value)||1, 1, 20) })} style={inp}/>
          </div>
        </div>

        <button
          onClick={() => setSettings({ ...settings, waitForClose: !settings.waitForClose })}
          style={{
            display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:9,
            border:`1px solid ${settings.waitForClose ? "#fbbf24" : "#1a2540"}`,
            background: settings.waitForClose ? "rgba(251,191,36,0.08)" : "#0d1628",
            color: settings.waitForClose ? "#fbbf24" : "#5a6a8a",
            fontSize:12, fontWeight:600, cursor:"pointer", textAlign:"left", width:"100%"
          }}>
          <span style={{ fontSize:13 }}>{settings.waitForClose ? "☑" : "☐"}</span>
          Wait for candle close (entry confirmation)
        </button>
      </div>

      {/* Save */}
      <button onClick={onSave} style={{
        width:"100%", padding:"14px 20px", borderRadius:12, border:"none",
        background: savedFlash
          ? "linear-gradient(135deg, #22d3a5, #34d399)"
          : "linear-gradient(135deg, #38bdf8, #818cf8)",
        color:"#fff", fontSize:14, fontWeight:800, cursor:"pointer", letterSpacing:"0.02em",
        boxShadow: "0 6px 20px rgba(56,189,248,0.25)", transition:"all 0.2s"
      }}>
        {savedFlash ? "✓ Settings Saved" : "💾 Save Settings"}
      </button>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// Alert Modal
// ─────────────────────────────────────────────────────────────────
function AlertModal({
  initial, allowedInstruments, onClose, onSave,
}: {
  initial: AlertItem | null;
  allowedInstruments: InstrumentKey[];
  onClose: () => void;
  onSave: (a: AlertItem) => void;
}) {
  const fallbackInst = allowedInstruments[0] ?? "ES";
  const [name,       setName]       = useState(initial?.name       ?? "");
  const [instrument, setInstrument] = useState<InstrumentKey>(initial?.instrument ?? fallbackInst);
  const [condition,  setCondition]  = useState<ConditionId>(initial?.condition ?? "price_above");
  const [value,      setValue]      = useState(initial?.value      ?? "");
  const [method,     setMethod]     = useState<AlertItem["method"]>(initial?.method ?? "browser");
  const [repeating,  setRepeating]  = useState(initial?.repeating  ?? false);
  const [notes,      setNotes]      = useState(initial?.notes      ?? "");

  const cond = CONDITION_TYPES.find(c => c.id === condition)!;
  const canSave = name.trim().length > 0 && (!cond.needsValue || value.trim().length > 0);

  const lbl: React.CSSProperties = { fontSize:10, fontWeight:700, color:"#4a5a7a", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 };
  const inp: React.CSSProperties = { padding:"10px 12px", borderRadius:9, border:"1px solid #1a2540", background:"#0d1628", color:"#f0f4ff", fontSize:13, outline:"none", boxSizing:"border-box", fontWeight:600, width:"100%", fontFamily:"system-ui" };

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:"rgba(3,8,18,0.85)", backdropFilter:"blur(6px)",
      zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"#0b1120", border:"1px solid #1a2540", borderRadius:18, padding:24,
        maxWidth:520, width:"100%", maxHeight:"90vh", overflowY:"auto",
        boxShadow:"0 24px 60px rgba(0,0,0,0.6)"
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
          <h3 style={{ fontSize:18, fontWeight:900, color:"#f0f4ff", margin:0 }}>
            {initial ? "Edit Alert" : "Create Alert"}
          </h3>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#3a4a6a", fontSize:22, cursor:"pointer", padding:0, lineHeight:1 }}>×</button>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={lbl}>Alert name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. NQ break of 18,500" style={inp}/>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <div>
            <label style={lbl}>Instrument</label>
            <select value={instrument} onChange={e => setInstrument(e.target.value as InstrumentKey)} style={{ ...inp, appearance:"none", WebkitAppearance:"none", cursor:"pointer", fontFamily:"monospace" }}>
              {INSTRUMENTS.map(i => (
                <option key={i.key} value={i.key} disabled={allowedInstruments.length > 0 && !allowedInstruments.includes(i.key)}>
                  {i.emoji} {i.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>Condition</label>
            <select value={condition} onChange={e => setCondition(e.target.value as ConditionId)} style={{ ...inp, appearance:"none", WebkitAppearance:"none", cursor:"pointer" }}>
              {CONDITION_TYPES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        </div>

        {cond.needsValue && (
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Value</label>
            <input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="0.00" style={{ ...inp, fontFamily:"monospace" }}/>
          </div>
        )}

        <div style={{ marginBottom:14 }}>
          <label style={lbl}>Alert method</label>
          <div style={{ display:"flex", gap:6 }}>
            {([
              { v:"browser", icon:"🔔", label:"Browser" },
              { v:"email",   icon:"📧", label:"Email" },
              { v:"both",    icon:"✨", label:"Both" },
            ] as const).map(opt => (
              <button key={opt.v} onClick={() => setMethod(opt.v)}
                style={{
                  flex:1, padding:"10px 0", borderRadius:9,
                  border:`1px solid ${method===opt.v ? "#38bdf8" : "#1a2540"}`,
                  background: method===opt.v ? "rgba(56,189,248,0.08)" : "#0d1628",
                  color: method===opt.v ? "#38bdf8" : "#5a6a8a",
                  fontSize:12, fontWeight:700, cursor:"pointer"
                }}>{opt.icon} {opt.label}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={lbl}>Trigger frequency</label>
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={() => setRepeating(false)} style={{
              flex:1, padding:"10px 0", borderRadius:9,
              border:`1px solid ${!repeating ? "#a78bfa" : "#1a2540"}`,
              background: !repeating ? "rgba(167,139,250,0.08)" : "#0d1628",
              color: !repeating ? "#a78bfa" : "#5a6a8a",
              fontSize:12, fontWeight:700, cursor:"pointer"
            }}>⏱ One-time</button>
            <button onClick={() => setRepeating(true)} style={{
              flex:1, padding:"10px 0", borderRadius:9,
              border:`1px solid ${repeating ? "#a78bfa" : "#1a2540"}`,
              background: repeating ? "rgba(167,139,250,0.08)" : "#0d1628",
              color: repeating ? "#a78bfa" : "#5a6a8a",
              fontSize:12, fontWeight:700, cursor:"pointer"
            }}>🔁 Repeating</button>
          </div>
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={lbl}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            placeholder="Why this alert matters…"
            style={{ ...inp, resize:"vertical", minHeight:70, fontFamily:"system-ui" }}/>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{
            flex:1, padding:"12px 16px", borderRadius:10, border:"1px solid #1a2540",
            background:"#0d1628", color:"#94a3b8", fontSize:13, fontWeight:700, cursor:"pointer"
          }}>Cancel</button>
          <button
            disabled={!canSave}
            onClick={() => {
              const saved: AlertItem = {
                id:            initial?.id ?? uid(),
                name:          name.trim(),
                instrument,
                condition,
                value:         cond.needsValue ? value.trim() : "",
                method,
                repeating,
                notes:         notes.trim(),
                enabled:       initial?.enabled ?? true,
                lastTriggered: initial?.lastTriggered ?? null,
                createdAt:     initial?.createdAt ?? Date.now(),
              };
              onSave(saved);
            }}
            style={{
              flex:2, padding:"12px 16px", borderRadius:10, border:"none",
              background: canSave ? "linear-gradient(135deg,#38bdf8,#818cf8)" : "#1a2540",
              color: canSave ? "#fff" : "#5a6a8a", fontSize:13, fontWeight:800,
              cursor: canSave ? "pointer" : "not-allowed",
              boxShadow: canSave ? "0 6px 20px rgba(56,189,248,0.25)" : "none"
            }}>
            {initial ? "Save Changes" : "+ Create Alert"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Alert Card
// ─────────────────────────────────────────────────────────────────
function AlertCard({
  alert, onToggle, onEdit, onDelete, tick,
}: {
  alert: AlertItem;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  tick: number; // forces re-render so "X mins ago" stays fresh
}) {
  // tick is intentionally referenced to keep relative time labels fresh
  void tick;
  const inst = INSTRUMENTS.find(i => i.key === alert.instrument);
  const accent = alert.enabled ? "#34d399" : "#3a4a6a";

  return (
    <div style={{
      background:"#0d1628", border:`1px solid ${alert.enabled ? "rgba(52,211,153,0.25)" : "#1a2540"}`,
      borderRadius:14, padding:16
    }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8, gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0, flex:1 }}>
          <span style={{ fontSize:16 }}>{inst?.emoji ?? "📈"}</span>
          <span style={{ fontSize:13, fontWeight:800, color:"#f0f4ff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{alert.name}</span>
        </div>
        <button onClick={onToggle} title={alert.enabled ? "Disable" : "Enable"} style={{
          width:38, height:22, borderRadius:11, border:"none", padding:0,
          background: alert.enabled ? "#34d399" : "#1a2540",
          position:"relative", cursor:"pointer", flexShrink:0
        }}>
          <span style={{
            position:"absolute", top:2, left: alert.enabled ? 18 : 2,
            width:18, height:18, borderRadius:"50%", background:"#fff",
            transition:"left 0.18s", boxShadow:"0 1px 3px rgba(0,0,0,0.4)"
          }}/>
        </button>
      </div>

      <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4, fontFamily:"monospace" }}>
        {conditionDescription(alert)}
      </div>

      {alert.notes && (
        <div style={{ fontSize:11, color:"#5a6a8a", marginBottom:8, fontStyle:"italic" }}>
          “{alert.notes}”
        </div>
      )}

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginTop:10 }}>
        <div style={{ fontSize:10, color: alert.lastTriggered ? "#fbbf24" : "#3a4a6a", fontWeight:600 }}>
          {timeAgo(alert.lastTriggered)}
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <span style={{ fontSize:9, padding:"3px 7px", borderRadius:6, background:"#1a2540", color:"#94a3b8", fontWeight:700 }}>
            {alert.method === "browser" ? "🔔" : alert.method === "email" ? "📧" : "🔔📧"}
          </span>
          <span style={{ fontSize:9, padding:"3px 7px", borderRadius:6, background:"#1a2540", color:"#94a3b8", fontWeight:700 }}>
            {alert.repeating ? "🔁 Repeat" : "⏱ Once"}
          </span>
          <button onClick={onEdit} title="Edit" style={{ background:"transparent", border:"1px solid #1a2540", color:"#94a3b8", borderRadius:6, padding:"3px 8px", fontSize:10, fontWeight:700, cursor:"pointer" }}>Edit</button>
          <button onClick={onDelete} title="Delete" style={{ background:"transparent", border:"1px solid rgba(248,113,113,0.3)", color:"#f87171", borderRadius:6, padding:"3px 8px", fontSize:10, fontWeight:700, cursor:"pointer" }}>Delete</button>
        </div>
      </div>

      <div style={{ position:"absolute", width:0, height:0, color:accent }}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Position Size Calculator (bottom of right panel)
// ─────────────────────────────────────────────────────────────────
function PositionSizeCalc({ settings }: { settings: TradingSettings }) {
  const allowed = (Object.entries(settings.primaryInstruments) as [InstrumentKey, boolean][])
    .filter(([, v]) => v).map(([k]) => k);
  const defaultKey: InstrumentKey = allowed[0] ?? "NQ";

  const [instKey, setInstKey] = useState<InstrumentKey>(defaultKey);
  const [entry,   setEntry]   = useState("");
  const [stop,    setStop]    = useState("");

  // Keep selected instrument valid if user changes allowed set
  useEffect(() => {
    if (allowed.length === 0) return;
    if (!allowed.includes(instKey)) setInstKey(allowed[0]);
  }, [allowed, instKey]);

  const inst = INSTRUMENTS.find(i => i.key === instKey)!;
  const entryN = parseFloat(entry);
  const stopN  = parseFloat(stop);
  const stopDistance = entryN && stopN ? Math.abs(entryN - stopN) : 0;
  const ticksToStop  = stopDistance && inst.tickSize ? stopDistance / inst.tickSize : 0;

  const dollarRisk    = settings.accountSize * (settings.maxRiskPct / 100);
  const riskPerContract = ticksToStop * inst.tickValue;
  const contracts = riskPerContract > 0 ? Math.floor(dollarRisk / riskPerContract) : 0;
  const projectedLoss = contracts * riskPerContract;
  const underMax = projectedLoss <= dollarRisk;

  const meterColor = contracts > 0 ? (underMax ? "#34d399" : "#f87171") : "#3a4a6a";

  const lbl: React.CSSProperties = { fontSize:10, fontWeight:700, color:"#4a5a7a", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 };
  const inp: React.CSSProperties = { padding:"10px 12px", borderRadius:9, border:"1px solid #1a2540", background:"#0a1224", color:"#f0f4ff", fontSize:13, fontFamily:"monospace", outline:"none", boxSizing:"border-box", fontWeight:600, width:"100%" };

  return (
    <section style={{ background:"#0b1120", border:"1px solid #1a2540", borderRadius:18, padding:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
        <span style={{ fontSize:18 }}>🧮</span>
        <h3 style={{ fontSize:14, fontWeight:900, color:"#f0f4ff", margin:0 }}>Position Size Calculator</h3>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
        <div>
          <label style={lbl}>Instrument</label>
          <select value={instKey} onChange={e => setInstKey(e.target.value as InstrumentKey)} style={{ ...inp, appearance:"none", WebkitAppearance:"none", cursor:"pointer" }}>
            {(allowed.length ? allowed : INSTRUMENTS.map(i => i.key)).map(k => {
              const i = INSTRUMENTS.find(x => x.key === k)!;
              return <option key={k} value={k}>{i.emoji} {k}</option>;
            })}
          </select>
        </div>
        <div>
          <label style={lbl}>Entry price</label>
          <input type="number" value={entry} onChange={e => setEntry(e.target.value)} placeholder="0.00" style={inp}/>
        </div>
        <div>
          <label style={lbl}>Stop loss</label>
          <input type="number" value={stop} onChange={e => setStop(e.target.value)} placeholder="0.00" style={{ ...inp, borderColor:"rgba(248,113,113,0.25)" }}/>
        </div>
      </div>

      <div style={{
        padding:"14px 16px", borderRadius:12, background:`${meterColor}10`, border:`1px solid ${meterColor}40`,
        display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, alignItems:"center"
      }}>
        <div>
          <div style={{ fontSize:9, fontWeight:800, color:"#3a4a6a", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>Contracts</div>
          <div style={{ fontSize:24, fontWeight:900, color:meterColor, fontFamily:"monospace", lineHeight:1 }}>
            {contracts > 0 ? contracts : "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize:9, fontWeight:800, color:"#3a4a6a", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>$ Risk</div>
          <div style={{ fontSize:15, fontWeight:800, color:"#38bdf8", fontFamily:"monospace", lineHeight:1.2 }}>
            {fmtMoney(dollarRisk)}
            <div style={{ fontSize:10, color:"#3a4a6a", marginTop:2 }}>
              {settings.maxRiskPct.toFixed(1)}% of {fmtMoney(settings.accountSize)}
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontSize:9, fontWeight:800, color:"#3a4a6a", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>Projected loss</div>
          <div style={{ fontSize:15, fontWeight:800, color:meterColor, fontFamily:"monospace", lineHeight:1.2 }}>
            {contracts > 0 ? fmtMoney(projectedLoss) : "—"}
            <div style={{ fontSize:10, color:"#3a4a6a", marginTop:2 }}>
              {stopDistance ? `${stopDistance.toFixed(2)} ${inst.unit}` : "—"} · {ticksToStop ? `${ticksToStop.toFixed(0)} ticks` : ""}
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontSize:10, color:"#3a4a6a", marginTop:10, fontFamily:"monospace", textAlign:"center" }}>
        Contracts = (Account × Risk%) ÷ (Stop Distance × Tick Value)
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const [username, setUsername] = useState("");
  const [settings, setSettings] = useState<TradingSettings>(DEFAULT_SETTINGS);
  const [alerts,   setAlerts]   = useState<AlertItem[]>([]);
  const [strategies, setStrategies] = useState<SavedStrategy[]>([]);
  const [loaded,    setLoaded]    = useState(false);
  const [savedFlash,setSavedFlash] = useState(false);
  const [editing,   setEditing]   = useState<AlertItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [permStatus,setPermStatus]= useState<NotificationPermission | "unsupported">("default");
  const [tick,      setTick]      = useState(0);

  // ── Load on mount ───────────────────────────────────
  useEffect(() => {
    const u = getUsername();
    setUsername(u);
    try {
      const s = localStorage.getItem(`nexyru_trading_settings_${u}`);
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(s) });
    } catch {}
    try {
      const a = localStorage.getItem(`nexyru_alerts_${u}`);
      if (a) {
        const parsed = JSON.parse(a);
        if (Array.isArray(parsed)) setAlerts(parsed);
      }
    } catch {}
    setStrategies(readStrategies());
    setLoaded(true);

    if (typeof window !== "undefined" && "Notification" in window) {
      setPermStatus(Notification.permission);
      if (Notification.permission === "default") {
        Notification.requestPermission().then(p => setPermStatus(p));
      }
    } else {
      setPermStatus("unsupported");
    }
  }, []);

  // ── Persist alerts whenever they change ────────────
  useEffect(() => {
    if (!loaded || !username) return;
    try { localStorage.setItem(`nexyru_alerts_${username}`, JSON.stringify(alerts)); } catch {}
  }, [alerts, loaded, username]);

  // ── Manual save for settings ───────────────────────
  const saveSettings = () => {
    if (!username) return;
    try {
      localStorage.setItem(`nexyru_trading_settings_${username}`, JSON.stringify(settings));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch {}
  };

  // ── Tick: bump every 15s so "X mins ago" stays fresh ────────
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  // ── Simulated price feed + condition check every 30s ──────
  const pricesRef = useRef<Partial<Record<InstrumentKey, number>>>({});
  const prevPricesRef = useRef<Partial<Record<InstrumentKey, number>>>({});
  const sessionExtremesRef = useRef<Partial<Record<InstrumentKey, { hi:number; lo:number }>>>({});

  useEffect(() => {
    if (!loaded) return;
    const evaluate = () => {
      const symbols = new Set(alerts.filter(a => a.enabled).map(a => a.instrument));
      symbols.forEach(sym => {
        const prev = pricesRef.current[sym] ?? null;
        const next = nextPrice(prev, sym);
        prevPricesRef.current[sym] = prev ?? next;
        pricesRef.current[sym] = next;
        const ext = sessionExtremesRef.current[sym] ?? { hi: next, lo: next };
        sessionExtremesRef.current[sym] = { hi: Math.max(ext.hi, next), lo: Math.min(ext.lo, next) };
      });

      let mutated = false;
      const updated = alerts.map(a => {
        if (!a.enabled) return a;
        if (!a.repeating && a.lastTriggered) return a;

        const p     = pricesRef.current[a.instrument];
        const pPrev = prevPricesRef.current[a.instrument];
        if (typeof p !== "number") return a;

        const numericVal = parseFloat(a.value);
        const ext = sessionExtremesRef.current[a.instrument];

        let triggered = false;
        switch (a.condition) {
          case "price_above":
            triggered = !isNaN(numericVal) && p > numericVal;
            break;
          case "price_below":
            triggered = !isNaN(numericVal) && p < numericVal;
            break;
          case "price_crosses":
            triggered = !isNaN(numericVal) && typeof pPrev === "number" &&
                        ((pPrev < numericVal && p >= numericVal) || (pPrev > numericVal && p <= numericVal));
            break;
          case "new_session_high":
            triggered = !!ext && p >= ext.hi;
            break;
          case "new_session_low":
            triggered = !!ext && p <= ext.lo;
            break;
          // EMA / RSI / risk-state conditions need real data feeds.
          // We don't fake-fire them — they stay armed but quiet.
          default:
            triggered = false;
        }

        if (!triggered) return a;
        mutated = true;

        // Browser notification (if permitted)
        if ((a.method === "browser" || a.method === "both") &&
            typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(`🔔 ${a.name}`, {
              body: conditionDescription(a) + ` — current ${p.toFixed(2)}`,
              tag:  a.id,
            });
          } catch {}
        }
        return { ...a, lastTriggered: Date.now() };
      });

      if (mutated) setAlerts(updated);
    };

    evaluate();
    const id = setInterval(evaluate, 30_000);
    return () => clearInterval(id);
  }, [alerts, loaded]);

  // ── CRUD ─────────────────────────────────────────────
  const upsertAlert = (a: AlertItem) => {
    setAlerts(prev => {
      const i = prev.findIndex(x => x.id === a.id);
      if (i >= 0) { const copy = prev.slice(); copy[i] = a; return copy; }
      return [a, ...prev];
    });
    setShowModal(false);
    setEditing(null);
  };
  const toggleAlert = (id: string) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  const deleteAlert = (id: string) => setAlerts(prev => prev.filter(a => a.id !== id));

  const allowedInstruments = useMemo(
    () => (Object.entries(settings.primaryInstruments) as [InstrumentKey, boolean][])
            .filter(([, v]) => v).map(([k]) => k),
    [settings.primaryInstruments]
  );

  const enabledCount = alerts.filter(a => a.enabled).length;

  return (
    <div style={{ minHeight:"100vh", background:"#060d1a", color:"#c8d8f0", fontFamily:"system-ui,sans-serif" }}>

      {/* Top nav */}
      <div style={{ borderBottom:"1px solid #0d1628", background:"rgba(6,13,26,0.95)", padding:"14px 28px", display:"flex", alignItems:"center", gap:16, position:"sticky", top:0, zIndex:10, backdropFilter:"blur(8px)" }}>
        <a href="/dashboard" style={{ fontSize:12, color:"#3a4a6a", textDecoration:"none" }}>← Dashboard</a>
        <span style={{ fontSize:14, fontWeight:800, color:"#f0f4ff" }}>🔔 Trading Alerts</span>
        <div style={{ flex:1 }}/>
        {permStatus === "denied" && (
          <span style={{ fontSize:10, color:"#f87171", fontWeight:700 }}>
            ⚠ Browser notifications blocked
          </span>
        )}
        {permStatus === "default" && (
          <button onClick={() => "Notification" in window && Notification.requestPermission().then(p => setPermStatus(p))}
            style={{ background:"transparent", border:"1px solid #1a2540", color:"#38bdf8", borderRadius:7, padding:"5px 10px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
            Enable notifications
          </button>
        )}
        {permStatus === "granted" && (
          <span style={{ fontSize:10, color:"#34d399", fontWeight:700 }}>✓ Notifications on</span>
        )}
      </div>

      <div style={{ maxWidth:1280, margin:"0 auto", padding:"32px 20px" }}>

        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <h1 style={{ fontSize:28, fontWeight:900, color:"#f0f4ff", margin:"0 0 6px", letterSpacing:"-0.02em" }}>Trading Alerts</h1>
          <p style={{ fontSize:13, color:"#3a4a6a", margin:0 }}>
            Configure once. Get notified when your conditions are met — {alerts.length} alert{alerts.length===1?"":"s"} saved, {enabledCount} active.
          </p>
        </div>

        {/* Two-column */}
        <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)", gap:20 }} className="alerts-grid">

          {/* LEFT */}
          <TradingSettingsPanel
            settings={settings}
            setSettings={setSettings}
            strategies={strategies}
            onSave={saveSettings}
            savedFlash={savedFlash}
          />

          {/* RIGHT */}
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <section style={{ background:"#0b1120", border:"1px solid #1a2540", borderRadius:18, padding:24 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:18 }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:20 }}>🔔</span>
                    <h2 style={{ fontSize:18, fontWeight:900, color:"#f0f4ff", margin:0, letterSpacing:"-0.01em" }}>Active Alerts</h2>
                  </div>
                  <p style={{ fontSize:12, color:"#3a4a6a", margin:"4px 0 0" }}>Price alerts evaluate every 30s.</p>
                </div>
                <button onClick={() => { setEditing(null); setShowModal(true); }} style={{
                  padding:"11px 18px", borderRadius:10, border:"none",
                  background:"linear-gradient(135deg, #38bdf8, #818cf8)",
                  color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer",
                  boxShadow:"0 6px 20px rgba(56,189,248,0.3)", whiteSpace:"nowrap"
                }}>
                  + Create Alert
                </button>
              </div>

              {alerts.length === 0 ? (
                <div style={{
                  padding:"36px 20px", textAlign:"center", borderRadius:14,
                  background:"#0d1628", border:"1px dashed #1a2540"
                }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>🔕</div>
                  <div style={{ fontSize:14, fontWeight:800, color:"#94a3b8", marginBottom:4 }}>No alerts yet</div>
                  <div style={{ fontSize:12, color:"#3a4a6a" }}>Create your first alert to get notified when conditions are met.</div>
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {alerts.map(a => (
                    <AlertCard
                      key={a.id}
                      alert={a}
                      tick={tick}
                      onToggle={() => toggleAlert(a.id)}
                      onEdit={() => { setEditing(a); setShowModal(true); }}
                      onDelete={() => deleteAlert(a.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            <PositionSizeCalc settings={settings}/>
          </div>
        </div>
      </div>

      {showModal && (
        <AlertModal
          initial={editing}
          allowedInstruments={allowedInstruments}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={upsertAlert}
        />
      )}

      <style>{`
        @media (max-width: 900px) {
          .alerts-grid { grid-template-columns: 1fr !important; }
        }
        input[type="range"] {
          height: 4px; border-radius: 4px; background: #1a2540;
        }
      `}</style>
    </div>
  );
}
