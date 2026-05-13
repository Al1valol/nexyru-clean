"use client";

import { useEffect, useMemo, useState } from "react";

// ── Constants ─────────────────────────────────────────────────────
type InstrumentKey = "ES" | "NQ" | "CL" | "GC" | "BTC" | "ETH" | "SOL";

interface InstrumentSpec {
  key:       InstrumentKey;
  label:     string;
  emoji:     string;
  tickSize:  number;
  tickValue: number;
  perPoint:  number;
  unit:      string;
}

const INSTRUMENTS: InstrumentSpec[] = [
  { key:"ES",  label:"ES — S&P 500",    emoji:"", tickSize:0.25,  tickValue:12.50, perPoint:50,   unit:"pts" },
  { key:"NQ",  label:"NQ — Nasdaq",     emoji:"", tickSize:0.25,  tickValue:5.00,  perPoint:20,   unit:"pts" },
  { key:"CL",  label:"CL — Crude Oil",  emoji:"",  tickSize:0.01,  tickValue:10.00, perPoint:1000, unit:"pts" },
  { key:"GC",  label:"GC — Gold",       emoji:"", tickSize:0.10,  tickValue:10.00, perPoint:100,  unit:"pts" },
  { key:"BTC", label:"BTC — Bitcoin",   emoji:"₿",  tickSize:1,     tickValue:1,     perPoint:1,    unit:"$"   },
  { key:"ETH", label:"ETH — Ethereum",  emoji:"Ξ",  tickSize:0.01,  tickValue:0.01,  perPoint:1,    unit:"$"   },
  { key:"SOL", label:"SOL — Solana",    emoji:"◎",  tickSize:0.01,  tickValue:0.01,  perPoint:1,    unit:"$"   },
];

const DAYS      = ["Mon","Tue","Wed","Thu","Fri"] as const;
const TIMEZONES = ["ET","CT","MT","PT"] as const;
const RR_OPTS   = ["1:1","1.5:1","2:1","2.5:1","3:1"] as const;

interface TradePlannerSettings {
  accountSize:        number;
  maxRiskPct:         number;
  maxTradesPerDay:    number;
  tradingDays:        Record<string, boolean>;
 sessionStart: string;
 sessionEnd: string;
 timezone: typeof TIMEZONES[number];
 primaryInstruments: Record<InstrumentKey, boolean>;
}

const DEFAULT_SETTINGS: TradePlannerSettings = {
  accountSize:        50000,
  maxRiskPct:         1,
  maxTradesPerDay:    3,
  tradingDays:        { Mon:true, Tue:true, Wed:true, Thu:true, Fri:true },
  sessionStart:       "09:30",
  sessionEnd:         "11:00",
  timezone:           "ET",
  primaryInstruments: { ES:true, NQ:true, CL:false, GC:false, BTC:false, ETH:false, SOL:false },
};

interface StrategyCond { id: string; params?: Record<string, unknown> }
interface SavedStrategy {
  id:           string;
  name:         string;
  description?: string;
  rules?: {
    entryConds?:  StrategyCond[];
    exitConds?:   StrategyCond[];
    filterConds?: StrategyCond[];
    slPct?:       number;
    tpPct?:       number;
    riskPct?:     number;
  };
}

type AlertType = "strategy" | "risk" | "session" | "price_level";

interface AlertItem {
  id:            string;
  type:          AlertType;
  name:          string;
  enabled:       boolean;
  lastTriggered: number | null;
  createdAt:     number;
  strategyId?:   string;
  dailyLossPct?: number;
  sessionTime?:  string;
  priceLevel?:   string;
  direction?:    "above" | "below" | "crosses";
  instrument?:   InstrumentKey;
}

const ALERT_TYPE_META: Record<AlertType, { icon: string; label: string; tone: string }> = {
  strategy:    { icon:"", label:"Strategy Signal", tone:"#6366f1" },
  risk:        { icon:"️", label:"Risk Alert",      tone:"#ef4444" },
  session:     { icon:"", label:"Session Alert",   tone:"#a5b4fc" },
  price_level: { icon:"", label:"Price Level",     tone:"#10b981" },
};

// ── Helpers ───────────────────────────────────────────────────────
function getUsername(): string {
  try { return JSON.parse(localStorage.getItem("tradedesk_session_v1") ?? "{}").username || "guest"; }
  catch { return "guest"; }
}

function readStrategies(username: string): SavedStrategy[] {
  if (!username) return [];
  try {
    const fromLab = JSON.parse(localStorage.getItem(`tradedesk_stratlab_${username}_v1`) || "[]");
    if (Array.isArray(fromLab) && fromLab.length) {
      return fromLab.filter((s: { id?: unknown; name?: unknown }) =>
        s && typeof s.id === "string" && typeof s.name === "string") as SavedStrategy[];
    }
  } catch {}
  try {
    const fromNexyru = JSON.parse(localStorage.getItem(`nexyru_strategies_${username}`) || "[]");
    if (Array.isArray(fromNexyru)) {
      return fromNexyru.filter((s: { id?: unknown; name?: unknown }) =>
        s && typeof s.id === "string" && typeof s.name === "string") as SavedStrategy[];
    }
  } catch {}
  return [];
}

const uid = () => Math.random().toString(36).slice(2, 10);
const fmtMoney = (n: number) =>(n< 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function timeAgo(ms: number | null): string {
  if (!ms) return "Never triggered";
  const diff = Date.now() - ms;
  if (diff < 60_000)     return `${Math.floor(diff/1000)}s ago`;
  if (diff < 3_600_000)  return `${Math.floor(diff/60_000)} mins ago`;
  if (diff < 86_400_000) return `${Math.floor(diff/3_600_000)} hrs ago`;
  return `${Math.floor(diff/86_400_000)} days ago`;
}

function humanizeCondId(id: string): string {
  return id.split("_").map(w => {
    if (["ema","sma","rsi","macd","vwap","atr","bb","orb","ny"].includes(w)) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(" ");
}

function describeCond(cond: StrategyCond): string {
  const base = humanizeCondId(cond.id);
  const p = cond.params ?? {};
  const parts = Object.entries(p)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${v}`);
  return parts.length ? `${base} · ${parts.join(", ")}` : base;
}

function alertDescription(a: AlertItem, strategies: SavedStrategy[]): string {
  switch (a.type) {
    case "strategy": {
      const s = strategies.find(x => x.id === a.strategyId);
      return s ? `When ${s.name} fires` : "No strategy selected";
    }
    case "risk":        return `Warn at ${a.dailyLossPct ?? 80}% of daily loss limit`;
    case "session":     return `Session start at ${a.sessionTime ?? "—"}`;
    case "price_level": return `${a.instrument ?? "—"} ${a.direction ?? "above"} ${a.priceLevel ?? "—"}`;
  }
}

// ── Shared styles ─────────────────────────────────────────────────
const lbl: React.CSSProperties = { fontSize:10, fontWeight:700, color:"#4a5a7a", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:6 };
const inp: React.CSSProperties = { padding:"10px 12px", borderRadius:9, border:"1px solid #2a2a3a", background:"#111118", color:"#ffffff", fontSize:13, fontFamily:"monospace", outline:"none", boxSizing:"border-box", fontWeight:600, width:"100%" };
const cardSx: React.CSSProperties = { background:"#111118", border:"1px solid #2a2a3a", borderRadius:18, padding:22 };
const sectionTitle = (color: string, label: string) =>(<div style={{ fontSize:11, fontWeight:800, color, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:12 }}>{label}</div>
);

// ── SECTION 1: SETTINGS ───────────────────────────────────────────
function SettingsPanel({
  settings, setSettings, onSave, savedFlash,
}: {
  settings: TradePlannerSettings;
  setSettings: (s: TradePlannerSettings) => void;
  onSave: () => void;
  savedFlash: boolean;
}) {
  const dailyLossDollar = Math.round(settings.accountSize * 3 / 100); // default 3% suggestion
  const maxDailyLoss = Math.round(settings.accountSize * settings.maxRiskPct * settings.maxTradesPerDay / 100);

  return (
    <section style={cardSx}><div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}><span style={{ fontSize:20 }}>️</span><h2 style={{ fontSize:17, fontWeight:900, color:"#ffffff", margin:0, letterSpacing:"-0.01em" }}>My Settings</h2></div><p style={{ fontSize:11, color:"#2a2a3a", margin:"0 0 18px" }}>Account, risk and session.</p>

      {/* Account & Risk */}
      <div style={{ marginBottom:20 }}>
        {sectionTitle("#6366f1", "Account & Risk")}

        <div style={{ marginBottom:12 }}><label style={lbl}>Account size ($)</label><input type="number" min={100} step={100} value={settings.accountSize}
            onChange={e => setSettings({ ...settings, accountSize: parseFloat(e.target.value) || 0 })} style={inp}/></div><div style={{ marginBottom:12 }}><label style={lbl}>Risk per trade —<span style={{ color:"#6366f1", fontFamily:"monospace" }}>{settings.maxRiskPct.toFixed(1)}%</span></label><input type="range" min="0.5" max="5" step="0.1" value={settings.maxRiskPct}
            onChange={e => setSettings({ ...settings, maxRiskPct: parseFloat(e.target.value) })}
            style={{ width:"100%", accentColor:"#6366f1" }}/></div><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}><div><label style={lbl}>Max daily loss (auto)</label><input type="text" readOnly value={fmtMoney(maxDailyLoss)}
              style={{ ...inp, color:"#ef4444", cursor:"not-allowed", opacity:0.85 }}/></div><div><label style={lbl}>Max trades / day</label><input type="number" min={1} max={50} value={settings.maxTradesPerDay}
              onChange={e => setSettings({ ...settings, maxTradesPerDay: clamp(parseInt(e.target.value)||1, 1, 50) })} style={inp}/></div></div><div><label style={lbl}>Trading days</label><div style={{ display:"flex", gap:4 }}>
            {DAYS.map(d =>(<button key={d}
                onClick={() => setSettings({ ...settings, tradingDays: { ...settings.tradingDays, [d]: !settings.tradingDays[d] } })}
                style={{
                  flex:1, padding:"8px 0", borderRadius:8,
                  border:`1px solid ${settings.tradingDays[d] ? "#6366f1" : "#2a2a3a"}`,
                  background: settings.tradingDays[d] ? "rgba(99,102,241,0.08)" : "#111118",
                  color: settings.tradingDays[d] ? "#6366f1" : "#2a2a3a",
                  fontSize:10, fontWeight:700, cursor:"pointer"
                }}>{d}</button>
            ))}
          </div></div></div>

      {/* Session */}
      <div style={{ marginBottom:20 }}>
        {sectionTitle("#a5b4fc", "Session")}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}><div><label style={lbl}>Start</label><input type="time" value={settings.sessionStart}
              onChange={e => setSettings({ ...settings, sessionStart: e.target.value })} style={inp}/></div><div><label style={lbl}>End</label><input type="time" value={settings.sessionEnd}
              onChange={e => setSettings({ ...settings, sessionEnd: e.target.value })} style={inp}/></div><div><label style={lbl}>Timezone</label><select value={settings.timezone}
              onChange={e => setSettings({ ...settings, timezone: e.target.value as typeof TIMEZONES[number] })}
              style={{ ...inp, appearance:"none", WebkitAppearance:"none", cursor:"pointer" }}>
              {TIMEZONES.map(tz =><option key={tz} value={tz}>{tz}</option>)}
            </select></div></div></div>

      {/* Instruments */}
      <div style={{ marginBottom:20 }}>
        {sectionTitle("#10b981", "Instruments")}
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {INSTRUMENTS.map(i => {
            const on = settings.primaryInstruments[i.key];
            return (
              <button key={i.key}
                onClick={() => setSettings({ ...settings, primaryInstruments: { ...settings.primaryInstruments, [i.key]: !on } })}
                style={{
                  padding:"6px 12px", borderRadius:8,
                  border:`1px solid ${on ? "#10b981" : "#2a2a3a"}`,
                  background: on ? "rgba(52,211,153,0.08)" : "#111118",
                  color: on ? "#10b981" : "#2a2a3a",
                  fontSize:11, fontWeight:700, cursor:"pointer"
                }}><span style={{ marginRight:5 }}>{i.emoji}</span>{i.key}
              </button>
            );
          })}
        </div></div><button onClick={onSave} style={{
        width:"100%", padding:"13px 20px", borderRadius:11, border:"none",
        background: savedFlash
          ? "linear-gradient(135deg, #22d3a5, #10b981)"
          : "linear-gradient(135deg, #6366f1, #6366f1)",
        color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer", letterSpacing:"0.02em",
        boxShadow: "0 6px 20px rgba(99,102,241,0.25)", transition:"all 0.2s"
      }}>
        {savedFlash ? "✓ Saved" : " Save Settings"}
      </button><div style={{ fontSize:10, color:"#2a2a3a", marginTop:8, textAlign:"center", fontFamily:"monospace" }}>
        Suggested daily loss cap: {fmtMoney(dailyLossDollar)} (3% of account)
      </div></section>
  );
}

// ── SECTION 2: STRATEGY + SIZER ───────────────────────────────────
function StrategyPanel({
  settings, strategies, selectedId, setSelectedId, minRR, setMinRR,
}: {
  settings: TradePlannerSettings;
  strategies: SavedStrategy[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  minRR: typeof RR_OPTS[number];
  setMinRR: (r: typeof RR_OPTS[number]) => void;
}) {
  const [entry, setEntry] = useState("");
  const [stop,  setStop]  = useState("");
  const [instKey, setInstKey] = useState<InstrumentKey>(() => {
    const allowed = (Object.entries(settings.primaryInstruments) as [InstrumentKey, boolean][])
      .filter(([, v]) => v).map(([k]) => k);
    return allowed[0] ?? "NQ";
  });

  const allowed = useMemo(() =>
    (Object.entries(settings.primaryInstruments) as [InstrumentKey, boolean][])
      .filter(([, v]) => v).map(([k]) => k),
    [settings.primaryInstruments]);

  useEffect(() => {
    if (allowed.length && !allowed.includes(instKey)) setInstKey(allowed[0]);
  }, [allowed, instKey]);

  const selected = strategies.find(s => s.id === selectedId);
  const entryConds = selected?.rules?.entryConds ?? [];

  const inst = INSTRUMENTS.find(i => i.key === instKey)!;
  const entryN = parseFloat(entry);
  const stopN  = parseFloat(stop);
  const stopDistance = entryN && stopN ? Math.abs(entryN - stopN) : 0;
  const ticksToStop  = stopDistance && inst.tickSize ? stopDistance / inst.tickSize : 0;

  const dollarRisk = settings.accountSize * (settings.maxRiskPct / 100);
  const riskPerContract = ticksToStop * inst.tickValue;
  const contracts = riskPerContract >0 ? Math.floor(dollarRisk / riskPerContract) : 0;
 const projectedLoss = contracts * riskPerContract;

 const meterColor = contracts === 0 ? "#2a2a3a"
 : settings.maxRiskPct<= 1 ? "#10b981"
    : settings.maxRiskPct <= 2 ? "#f59e0b"
    : "#ef4444";

  return (
    <section style={cardSx}><div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}><span style={{ fontSize:20 }}></span><h2 style={{ fontSize:17, fontWeight:900, color:"#ffffff", margin:0, letterSpacing:"-0.01em" }}>My Strategy</h2></div><p style={{ fontSize:11, color:"#2a2a3a", margin:"0 0 18px" }}>Pick a saved strategy and size your trade.</p><div style={{ marginBottom:14 }}><label style={lbl}>Strategy</label><select value={selectedId} onChange={e => setSelectedId(e.target.value)}
          style={{ ...inp, appearance:"none", WebkitAppearance:"none", cursor:"pointer" }}><option value="">— Choose a saved strategy —</option>
          {strategies.length === 0 && <option value="" disabled>No saved strategies. Build one in Strategy Lab.</option>}
          {strategies.map(s =><option key={s.id} value={s.id}>{s.name}</option>)}
        </select></div>

      {selected && (
        <div style={{
          marginBottom:14, padding:"12px 14px", borderRadius:11,
          background:"rgba(99,102,241,0.06)", border:"1px solid rgba(99,102,241,0.22)"
        }}><div style={{ fontSize:10, color:"#9ca3af", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Entry checklist</div>
          {entryConds.length === 0 ? (
            <div style={{ fontSize:11, color:"#5a6a8a", fontStyle:"italic" }}>No entry conditions saved.</div>) : (<div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {entryConds.map((c, i) =>(<div key={i} style={{
                  display:"flex", alignItems:"center", gap:8, padding:"6px 10px", borderRadius:7,
                  background:"#111118", border:"1px solid #2a2a3a",
                  fontSize:11, color:"#c8d8f0", fontFamily:"monospace"
                }}><span style={{ color:"#6366f1" }}></span>
                  {describeCond(c)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom:18 }}><label style={lbl}>Minimum R:R</label><div style={{ display:"flex", gap:4 }}>
          {RR_OPTS.map(r => {
            const on = minRR === r;
            return (
              <button key={r} onClick={() => setMinRR(r)} style={{
                flex:1, padding:"9px 0", borderRadius:8,
                border:`1px solid ${on ? "#a5b4fc" : "#2a2a3a"}`,
                background: on ? "rgba(165,180,252,0.08)" : "#111118",
                color: on ? "#a5b4fc" : "#2a2a3a",
                fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"monospace"
              }}>{r}</button>
            );
          })}
        </div></div><div style={{
        marginBottom:18, padding:"12px 14px", borderRadius:11,
        background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.22)",
        fontSize:12, color:"#ffffff", fontWeight:700, lineHeight:1.5
      }}>Based on settings: risk<span style={{ color:"#10b981", fontFamily:"monospace" }}>{fmtMoney(dollarRisk)}</span> per trade
        ({settings.maxRiskPct.toFixed(1)}% of {fmtMoney(settings.accountSize)})
      </div>

      {/* Position Sizer */}
      <div style={{
        marginTop:18, paddingTop:18, borderTop:"1px solid #2a2a3a"
      }}><div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}><span style={{ fontSize:16 }}></span><h3 style={{ fontSize:13, fontWeight:900, color:"#ffffff", margin:0 }}>Position Sizer</h3></div><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}><div><label style={lbl}>Instrument</label><select value={instKey} onChange={e => setInstKey(e.target.value as InstrumentKey)}
              style={{ ...inp, appearance:"none", WebkitAppearance:"none", cursor:"pointer", fontSize:12 }}>
              {(allowed.length ? allowed : INSTRUMENTS.map(i => i.key)).map(k => {
                const i = INSTRUMENTS.find(x =>x.key === k)!;
 return<option key={k} value={k}>{i.emoji} {k}</option>;
              })}
            </select></div><div><label style={lbl}>Entry</label><input type="number" value={entry} onChange={e => setEntry(e.target.value)} placeholder="0.00" style={inp}/></div><div><label style={lbl}>Stop</label><input type="number" value={stop} onChange={e => setStop(e.target.value)} placeholder="0.00"
              style={{ ...inp, borderColor:"rgba(248,113,113,0.25)" }}/></div></div><div style={{
          padding:"12px 14px", borderRadius:11,
          background:`${meterColor}10`, border:`1px solid ${meterColor}40`,
          display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, alignItems:"center"
        }}><div><div style={{ fontSize:9, fontWeight:800, color:"#2a2a3a", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>Contracts</div><div style={{ fontSize:22, fontWeight:900, color:meterColor, fontFamily:"monospace", lineHeight:1 }}>
              {contracts > 0 ? contracts : "—"}
            </div></div><div><div style={{ fontSize:9, fontWeight:800, color:"#2a2a3a", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>$ Risk</div><div style={{ fontSize:13, fontWeight:800, color:"#6366f1", fontFamily:"monospace", lineHeight:1.2 }}>
              {fmtMoney(dollarRisk)}
            </div></div><div><div style={{ fontSize:9, fontWeight:800, color:"#2a2a3a", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>Loss</div><div style={{ fontSize:13, fontWeight:800, color:meterColor, fontFamily:"monospace", lineHeight:1.2 }}>
              {contracts > 0 ? fmtMoney(projectedLoss) : "—"}
            </div></div></div></div></section>
  );
}

// ── SECTION 3: ALERTS ─────────────────────────────────────────────
function AlertModal({
  initial, settings, strategies, onClose, onSave,
}: {
  initial: AlertItem | null;
  settings: TradePlannerSettings;
  strategies: SavedStrategy[];
  onClose: () => void;
  onSave: (a: AlertItem) => void;
}) {
  const allowed = (Object.entries(settings.primaryInstruments) as [InstrumentKey, boolean][])
    .filter(([, v]) => v).map(([k]) =>k);
 const fallbackInst = allowed[0] ?? "ES";

 const [type, setType] = useState<AlertType>(initial?.type ?? "strategy");
 const [name, setName] = useState(initial?.name ?? "");
 const [strategyId, setStrategyId] = useState(initial?.strategyId ?? "");
 const [dailyLossPct, setDailyLossPct] = useState(initial?.dailyLossPct ?? 80);
 const [sessionTime, setSessionTime] = useState(initial?.sessionTime ?? settings.sessionStart);
 const [priceLevel, setPriceLevel] = useState(initial?.priceLevel ?? "");
 const [direction, setDirection] = useState<"above"|"below"|"crosses">(initial?.direction ?? "above");
 const [instrument, setInstrument] = useState<InstrumentKey>(initial?.instrument ?? fallbackInst);

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (type === "strategy")    return !!strategyId;
    if (type === "risk")        return dailyLossPct >= 1 && dailyLossPct<= 100;
    if (type === "session")     return /^\d{2}:\d{2}$/.test(sessionTime);
    if (type === "price_level") return !!priceLevel.trim() && !isNaN(parseFloat(priceLevel));
    return false;
  }, [name, type, strategyId, dailyLossPct, sessionTime, priceLevel]);

  const submit = () => {
    const base: AlertItem = {
      id:            initial?.id ?? uid(),
      type,
      name:          name.trim(),
      enabled:       initial?.enabled ?? true,
      lastTriggered: initial?.lastTriggered ?? null,
      createdAt:     initial?.createdAt ?? Date.now(),
    };
    let saved: AlertItem = base;
    if (type === "strategy")         saved = { ...base, strategyId };
    else if (type === "risk")        saved = { ...base, dailyLossPct };
    else if (type === "session")     saved = { ...base, sessionTime };
    else if (type === "price_level") saved = { ...base, instrument, direction, priceLevel: priceLevel.trim() };
    onSave(saved);
  };

  const TYPE_TABS: { id: AlertType; label: string }[] = [
    { id:"strategy",    label:" Signal" },
    { id:"risk",        label:"️ Risk" },
    { id:"session",     label:" Session" },
    { id:"price_level", label:" Price" },
  ];

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:"rgba(3,8,18,0.85)", backdropFilter:"blur(6px)",
      zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20
    }}><div onClick={e => e.stopPropagation()} style={{
        background:"#111118", border:"1px solid #2a2a3a", borderRadius:18, padding:22,
        maxWidth:480, width:"100%", maxHeight:"90vh", overflowY:"auto",
        boxShadow:"0 24px 60px rgba(0,0,0,0.6)"
      }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}><h3 style={{ fontSize:16, fontWeight:900, color:"#ffffff", margin:0 }}>
            {initial ? "Edit Alert" : "New Alert"}
          </h3><button onClick={onClose} style={{ background:"transparent", border:"none", color:"#2a2a3a", fontSize:22, cursor:"pointer", padding:0, lineHeight:1 }}>×</button></div><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:5, marginBottom:14 }}>
          {TYPE_TABS.map(t => {
            const on = type === t.id;
            const tone = ALERT_TYPE_META[t.id].tone;
            return (
              <button key={t.id} onClick={() => setType(t.id)} style={{
                padding:"9px 4px", borderRadius:8,
                border:`1px solid ${on ? tone : "#2a2a3a"}`,
                background: on ? `${tone}14` : "#111118",
                color: on ? tone : "#5a6a8a",
                fontSize:10, fontWeight:800, cursor:"pointer"
              }}>{t.label}</button>
            );
          })}
        </div><div style={{ marginBottom:12 }}><label style={lbl}>Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. NQ breakout"
            style={{ ...inp, fontFamily:"system-ui" }}/></div>

        {type === "strategy" && (
          <div style={{ marginBottom:12 }}><label style={lbl}>Strategy</label><select value={strategyId} onChange={e => setStrategyId(e.target.value)}
              style={{ ...inp, appearance:"none", WebkitAppearance:"none", cursor:"pointer" }}><option value="">— Choose strategy —</option>
              {strategies.map(s =><option key={s.id} value={s.id}>{s.name}</option>)}
            </select></div>
        )}

        {type === "risk" && (
          <div style={{ marginBottom:12 }}><label style={lbl}>Warn at<span style={{ color:"#ef4444", fontFamily:"monospace" }}>{dailyLossPct}%</span>of daily loss</label><input type="range" min={50} max={100} step={5} value={dailyLossPct}
              onChange={e => setDailyLossPct(parseInt(e.target.value, 10))}
              style={{ width:"100%", accentColor:"#ef4444" }}/></div>
        )}

        {type === "session" && (
          <div style={{ marginBottom:12 }}><label style={lbl}>Notify at</label><input type="time" value={sessionTime} onChange={e => setSessionTime(e.target.value)} style={inp}/></div>
        )}

        {type === "price_level" && (
          <><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}><div><label style={lbl}>Instrument</label><select value={instrument} onChange={e => setInstrument(e.target.value as InstrumentKey)}
                  style={{ ...inp, appearance:"none", WebkitAppearance:"none", cursor:"pointer" }}>
                  {INSTRUMENTS.map(i =><option key={i.key} value={i.key}>{i.emoji} {i.key}</option>)}
                </select></div><div><label style={lbl}>Direction</label><div style={{ display:"flex", gap:3 }}>
                  {(["above","below","crosses"] as const).map(d => {
                    const on = direction === d;
                    return (
                      <button key={d} onClick={() => setDirection(d)} style={{
                        flex:1, padding:"10px 0", borderRadius:7,
                        border:`1px solid ${on ? "#10b981" : "#2a2a3a"}`,
                        background: on ? "rgba(52,211,153,0.08)" : "#111118",
                        color: on ? "#10b981" : "#5a6a8a",
                        fontSize:10, fontWeight:700, cursor:"pointer", textTransform:"capitalize"
                      }}>{d}</button>
                    );
                  })}
                </div></div></div><div style={{ marginBottom:12 }}><label style={lbl}>Price</label><input type="number" value={priceLevel} onChange={e => setPriceLevel(e.target.value)}
                placeholder="0.00" style={inp}/></div></>
        )}

        <div style={{ display:"flex", gap:8, marginTop:14 }}><button onClick={onClose} style={{
            flex:1, padding:"11px 14px", borderRadius:9, border:"1px solid #2a2a3a",
            background:"#111118", color:"#9ca3af", fontSize:12, fontWeight:700, cursor:"pointer"
          }}>Cancel</button><button disabled={!canSave} onClick={submit} style={{
            flex:2, padding:"11px 14px", borderRadius:9, border:"none",
            background: canSave ? "linear-gradient(135deg,#6366f1,#6366f1)" : "#2a2a3a",
            color: canSave ? "#fff" : "#5a6a8a", fontSize:12, fontWeight:800,
            cursor: canSave ? "pointer" : "not-allowed"
          }}>{initial ? "Save Changes" : "+ Create"}</button></div></div></div>
  );
}

function AlertsPanel({
  settings, alerts, strategies, onAdd, onToggle, onEdit, onDelete, tick,
}: {
  settings: TradePlannerSettings;
  alerts: AlertItem[];
  strategies: SavedStrategy[];
  onAdd: () => void;
  onToggle: (id: string) => void;
  onEdit: (a: AlertItem) => void;
  onDelete: (id: string) => void;
  tick: number;
}) {
  void tick;
  void settings;
  const enabled = alerts.filter(a =>a.enabled).length;

 return (<section style={cardSx}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:14 }}><div><div style={{ display:"flex", alignItems:"center", gap:10 }}><span style={{ fontSize:20 }}></span><h2 style={{ fontSize:17, fontWeight:900, color:"#ffffff", margin:0, letterSpacing:"-0.01em" }}>Alerts</h2></div><p style={{ fontSize:11, color:"#2a2a3a", margin:"3px 0 0" }}>{alerts.length} saved · {enabled} active</p></div><button onClick={onAdd} style={{
          padding:"9px 14px", borderRadius:9, border:"none",
          background:"linear-gradient(135deg, #6366f1, #6366f1)",
          color:"#fff", fontSize:12, fontWeight:800, cursor:"pointer",
          boxShadow:"0 4px 14px rgba(99,102,241,0.3)", whiteSpace:"nowrap"
        }}>+ New Alert</button></div>

      {alerts.length === 0 ? (
        <div style={{
          padding:"30px 16px", textAlign:"center", borderRadius:12,
          background:"#111118", border:"1px dashed #2a2a3a"
        }}><div style={{ fontSize:28, marginBottom:6 }}></div><div style={{ fontSize:12, fontWeight:800, color:"#9ca3af", marginBottom:3 }}>No alerts yet</div><div style={{ fontSize:11, color:"#2a2a3a" }}>Create your first alert to get notified.</div></div>) : (<div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {alerts.map(a => {
            const meta = ALERT_TYPE_META[a.type];
            return (
              <div key={a.id} style={{
                background:"#111118",
                border:`1px solid ${a.enabled ? `${meta.tone}40` : "#2a2a3a"}`,
                borderRadius:12, padding:13
              }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:6 }}><div style={{ display:"flex", alignItems:"center", gap:7, minWidth:0, flex:1 }}><span style={{ fontSize:14 }}>{meta.icon}</span><span style={{ fontSize:12, fontWeight:800, color:"#ffffff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.name}</span></div><button onClick={() => onToggle(a.id)} title={a.enabled ? "Disable" : "Enable"} style={{
                    width:34, height:20, borderRadius:10, border:"none", padding:0,
                    background: a.enabled ? "#10b981" : "#2a2a3a",
                    position:"relative", cursor:"pointer", flexShrink:0
                  }}><span style={{
                      position:"absolute", top:2, left: a.enabled ? 16 : 2,
                      width:16, height:16, borderRadius:"50%", background:"#fff",
                      transition:"left 0.18s", boxShadow:"0 1px 3px rgba(0,0,0,0.4)"
                    }}/></button></div><div style={{ fontSize:9, color: meta.tone, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3 }}>
                  {meta.label}
                </div><div style={{ fontSize:10, color:"#9ca3af", fontFamily:"monospace", marginBottom:8 }}>
                  {alertDescription(a, strategies)}
                </div><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}><div style={{ fontSize:9, color: a.lastTriggered ? "#f59e0b" : "#2a2a3a", fontWeight:600 }}>
                    Last: {timeAgo(a.lastTriggered)}
                  </div><div style={{ display:"flex", gap:5 }}><button onClick={() => onEdit(a)} style={{ background:"transparent", border:"1px solid #2a2a3a", color:"#9ca3af", borderRadius:6, padding:"3px 7px", fontSize:9, fontWeight:700, cursor:"pointer" }}>Edit</button><button onClick={() => onDelete(a.id)} style={{ background:"transparent", border:"1px solid rgba(248,113,113,0.3)", color:"#ef4444", borderRadius:6, padding:"3px 7px", fontSize:9, fontWeight:700, cursor:"pointer" }}>Delete</button></div></div></div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function TradePlannerPage() {
  const [username, setUsername]   = useState("");
  const [settings, setSettings]   = useState<TradePlannerSettings>(DEFAULT_SETTINGS);
 const [strategies, setStrategies] = useState<SavedStrategy[]>([]);
 const [selectedStrategyId, setSelectedStrategyId] = useState("");
 const [minRR, setMinRR] = useState<typeof RR_OPTS[number]>("2:1");
 const [alerts, setAlerts] = useState<AlertItem[]>([]);
 const [loaded, setLoaded] = useState(false);
 const [savedFlash, setSavedFlash] = useState(false);
 const [editing, setEditing] = useState<AlertItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const u = getUsername();
    setUsername(u);

    try {
      const raw = localStorage.getItem(`nexyru_trade_planner_${u}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.settings)             setSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
        if (typeof parsed.selectedStrategyId === "string") setSelectedStrategyId(parsed.selectedStrategyId);
        if (typeof parsed.minRR === "string" && (RR_OPTS as readonly string[]).includes(parsed.minRR)) {
          setMinRR(parsed.minRR as typeof RR_OPTS[number]);
        }
      }
    } catch {}

    try {
      const a = localStorage.getItem(`nexyru_alerts_${u}`);
      if (a) {
        const parsed = JSON.parse(a);
        if (Array.isArray(parsed)) setAlerts(parsed.filter(x => x && typeof x.id === "string"));
      }
    } catch {}

    setStrategies(readStrategies(u));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || !username) return;
    try { localStorage.setItem(`nexyru_alerts_${username}`, JSON.stringify(alerts)); } catch {}
  }, [alerts, loaded, username]);

  useEffect(() => {
    if (!loaded || !username) return;
    try {
      localStorage.setItem(`nexyru_trade_planner_${username}`,
        JSON.stringify({ settings, selectedStrategyId, minRR }));
    } catch {}
  }, [selectedStrategyId, minRR, loaded, username, settings]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const saveSettings = () => {
    if (!username) return;
    try {
      localStorage.setItem(`nexyru_trade_planner_${username}`,
        JSON.stringify({ settings, selectedStrategyId, minRR }));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch {}
  };

  const openCreate = () => {
    if (username) setStrategies(readStrategies(username));
    setEditing(null);
    setShowModal(true);
  };
  const openEdit = (a: AlertItem) => {
    if (username) setStrategies(readStrategies(username));
    setEditing(a);
    setShowModal(true);
  };
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
  const deleteAlert = (id: string) => setAlerts(prev => prev.filter(a =>a.id !== id));

 return (<div style={{ minHeight:"100vh", background:"#060d1a", color:"#c8d8f0", fontFamily:"system-ui,sans-serif" }}>

      {/* Top nav */}
      <div style={{ borderBottom:"1px solid #111118", background:"rgba(6,13,26,0.95)", padding:"14px 28px", display:"flex", alignItems:"center", gap:16, position:"sticky", top:0, zIndex:10, backdropFilter:"blur(8px)" }}><a href="/dashboard" style={{ fontSize:12, color:"#2a2a3a", textDecoration:"none" }}>← Dashboard</a><span style={{ fontSize:14, fontWeight:800, color:"#ffffff" }}>Trade Planner</span><div style={{ flex:1 }}/><span style={{ fontSize:10, color:"#2a2a3a", fontWeight:600 }}>{username ? `@${username}` : ""}</span></div><div style={{ maxWidth:1400, margin:"0 auto", padding:"32px 20px" }}>

        {/* Header */}
        <div style={{ marginBottom:28 }}><h1 style={{ fontSize:30, fontWeight:900, color:"#ffffff", margin:"0 0 6px", letterSpacing:"-0.02em" }}>Trade Planner</h1><p style={{ fontSize:13, color:"#2a2a3a", margin:0 }}>Your trading settings, strategy and alerts in one place.</p></div>

        {/* Three-column grid */}
        <div className="planner-grid" style={{
          display:"grid",
          gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)",
          gap:20,
          alignItems:"flex-start"
        }}><SettingsPanel settings={settings} setSettings={setSettings} onSave={saveSettings} savedFlash={savedFlash}/><StrategyPanel
            settings={settings}
            strategies={strategies}
            selectedId={selectedStrategyId}
            setSelectedId={setSelectedStrategyId}
            minRR={minRR}
            setMinRR={setMinRR}
          /><AlertsPanel
            settings={settings}
            alerts={alerts}
            strategies={strategies}
            onAdd={openCreate}
            onToggle={toggleAlert}
            onEdit={openEdit}
            onDelete={deleteAlert}
            tick={tick}
          /></div></div>

      {showModal && (
        <AlertModal
          initial={editing}
          settings={settings}
          strategies={strategies}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={upsertAlert}
        />
      )}

      <style>{`
        @media (max-width: 1100px) {
          .planner-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 760px) {
          .planner-grid { grid-template-columns: 1fr !important; }
        }
        input[type="range"] {
          height: 4px; border-radius: 4px; background: #2a2a3a;
        }
      `}</style></div>
  );
}
