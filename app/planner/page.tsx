"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";

// ── Instruments ───────────────────────────────────────────────────
type InstrumentKey = "ES" | "NQ" | "CL" | "GC" | "BTC" | "ETH" | "SOL" | "FOREX";

interface InstrumentSpec {
  key:        InstrumentKey;
  label:      string;
  tooltip:    string;
  tickSize:   number;
  tickValue:  number;
  multiplier: number;
  unit:       string;
}

const INSTRUMENTS: InstrumentSpec[] = [
  { key:"ES",    label:"ES",    tooltip:"ES = $50 / point (S&P 500 futures)",   tickSize:0.25,   tickValue:12.50, multiplier:50,      unit:"pts"  },
  { key:"NQ",    label:"NQ",    tooltip:"NQ = $20 / point (Nasdaq futures)",    tickSize:0.25,   tickValue:5.00,  multiplier:20,      unit:"pts"  },
  { key:"CL",    label:"CL",    tooltip:"CL = $1,000 / point (Crude Oil)",      tickSize:0.01,   tickValue:10.00, multiplier:1000,    unit:"pts"  },
  { key:"GC",    label:"GC",    tooltip:"GC = $100 / point (Gold futures)",     tickSize:0.10,   tickValue:10.00, multiplier:100,     unit:"pts"  },
  { key:"BTC",   label:"BTC",   tooltip:"BTC = $1 / point (per coin)",          tickSize:1,      tickValue:1,     multiplier:1,       unit:"$"    },
  { key:"ETH",   label:"ETH",   tooltip:"ETH = $1 / point (per coin)",          tickSize:0.01,   tickValue:0.01,  multiplier:1,       unit:"$"    },
  { key:"SOL",   label:"SOL",   tooltip:"SOL = $1 / point (per coin)",          tickSize:0.01,   tickValue:0.01,  multiplier:1,       unit:"$"    },
  { key:"FOREX", label:"FOREX", tooltip:"FOREX = $10 / pip (standard lot)",     tickSize:0.0001, tickValue:10,    multiplier:100000,  unit:"pips" },
];

const DAYS      = ["Mon","Tue","Wed","Thu","Fri"] as const;
const TIMEZONES = ["ET","CT","MT","PT"] as const;

// ── Storage keys ──────────────────────────────────────────────────
const KEY_ACCOUNT = "nexyru_trade_planner_account";
const KEY_RISK    = "nexyru_trade_planner_risk";
const KEY_SESSION = "nexyru_trade_planner_session";

interface SessionPrefs {
  sessionStart:    string;
  sessionEnd:      string;
  timezone:        typeof TIMEZONES[number];
  maxTradesPerDay: number;
  tradingDays:     Record<string, boolean>;
}

const DEFAULT_SESSION: SessionPrefs = {
  sessionStart:    "09:30",
  sessionEnd:      "11:00",
  timezone:        "ET",
  maxTradesPerDay: 3,
  tradingDays:     { Mon:true, Tue:true, Wed:true, Thu:true, Fri:true },
};

// ── Helpers ───────────────────────────────────────────────────────
const fmtMoney = (n: number) =>
  (n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

const fmtNum = (n: number, d = 2) =>
  n.toLocaleString(undefined, { maximumFractionDigits: d });

// ── Page ──────────────────────────────────────────────────────────
export default function TradePlannerPage() {
  const [loaded, setLoaded]       = useState(false);
  const [accountSize, setAccount] = useState<number>(50000);
  const [riskPct, setRiskPct]     = useState<number>(1);
  const [entry, setEntry]         = useState<string>("");
  const [stop, setStop]           = useState<string>("");
  const [inst, setInst]           = useState<InstrumentKey>("NQ");

  const [session, setSession]     = useState<SessionPrefs>(DEFAULT_SESSION);
  const [showSession, setShowSession] = useState(false);

  const [savedFlash, setSavedFlash] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const a = localStorage.getItem(KEY_ACCOUNT);
      if (a && !isNaN(parseFloat(a))) setAccount(parseFloat(a));
      const r = localStorage.getItem(KEY_RISK);
      if (r && !isNaN(parseFloat(r))) setRiskPct(parseFloat(r));
      const s = localStorage.getItem(KEY_SESSION);
      if (s) setSession({ ...DEFAULT_SESSION, ...JSON.parse(s) });
    } catch {}
    setLoaded(true);
  }, []);

  // Persist session prefs whenever they change
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(KEY_SESSION, JSON.stringify(session)); } catch {}
  }, [session, loaded]);

  // ── Calculations ────────────────────────────────────────────────
  const spec = INSTRUMENTS.find(i => i.key === inst)!;

  const entryN = parseFloat(entry);
  const stopN  = parseFloat(stop);
  const valid  = !isNaN(entryN) && !isNaN(stopN) && entryN > 0 && stopN > 0 && entryN !== stopN;

  const dollarRisk    = accountSize * (riskPct / 100);
  const stopDistance  = valid ? Math.abs(entryN - stopN) : 0;
  const ticksToStop   = valid && spec.tickSize ? stopDistance / spec.tickSize : 0;
  const riskPerUnit   = ticksToStop * spec.tickValue;
  const contracts     = riskPerUnit > 0 ? Math.floor(dollarRisk / riskPerUnit) : 0;
  const actualLoss    = contracts * riskPerUnit;
  const positionValue = valid ? entryN * spec.multiplier * contracts : 0;

  // Display distance in correct unit
  const distanceDisplay = useMemo(() => {
    if (!valid) return "—";
    if (spec.unit === "pips") {
      const pips = stopDistance / 0.0001;
      return `${fmtNum(pips, 1)} pips`;
    }
    return `${fmtNum(stopDistance, 2)} ${spec.unit}`;
  }, [valid, spec, stopDistance]);

  // Risk meter color
  const riskColor =
    riskPct < 1   ? "#10b981"
    : riskPct <= 2 ? "#f59e0b"
    : "#ef4444";

  const riskMeterPct = Math.min(100, (riskPct / 5) * 100);

  const maxDailyLoss = Math.round(accountSize * (riskPct / 100) * session.maxTradesPerDay);

  // Save handler
  const saveSettings = () => {
    try {
      localStorage.setItem(KEY_ACCOUNT, String(accountSize));
      localStorage.setItem(KEY_RISK, String(riskPct));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch {}
  };

  // ── Styles ──────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: "#111111",
    border: "1px solid #1e1e1e",
    borderRadius: 14,
    padding: 28,
  };

  const label: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    display: "block",
    marginBottom: 8,
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid #1e1e1e",
    background: "#080808",
    color: "#ffffff",
    fontSize: 15,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontWeight: 500,
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#080808" }}>
      <Sidebar activePath="/planner" />
      <main style={{ flex:1, marginLeft:56 }}>
        <div style={{ minHeight:"100vh", background:"#080808", color:"#ffffff", fontFamily:"system-ui, -apple-system, sans-serif" }}>

          {/* Top bar */}
          <div style={{
            borderBottom: "1px solid #1e1e1e",
            background: "rgba(8,8,8,0.95)",
            padding: "14px 28px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            position: "sticky",
            top: 0,
            zIndex: 10,
            backdropFilter: "blur(8px)",
          }}>
            <a href="/dashboard" style={{ fontSize: 12, color: "#6b7280", textDecoration: "none" }}>← Dashboard</a>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>Trade Planner</span>
          </div>

          <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}>

            {/* ═══ SECTION 1: POSITION CALCULATOR ═══ */}
            <section style={card}>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: "#ffffff", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
                  Position Calculator
                </h2>
                <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                  Enter your trade details to get exact contract size
                </p>
              </div>

              {/* 2x2 input grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                {/* Account Size */}
                <div>
                  <label style={label}>Account Size ($)</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={accountSize || ""}
                    onChange={e => setAccount(parseFloat(e.target.value) || 0)}
                    placeholder="50000"
                    style={input}
                  />
                </div>

                {/* Risk Per Trade */}
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ ...label, marginBottom: 0 }}>Risk Per Trade</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: "#6366f1", fontFamily: "ui-monospace, monospace", letterSpacing: "-0.01em" }}>
                      {riskPct.toFixed(2)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={5}
                    step={0.25}
                    value={riskPct}
                    onChange={e => setRiskPct(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "#6366f1", marginTop: 6 }}
                  />
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, fontFamily: "ui-monospace, monospace" }}>
                    = {fmtMoney(dollarRisk)} per trade
                  </div>
                </div>

                {/* Entry Price */}
                <div>
                  <label style={label}>Entry Price</label>
                  <input
                    type="number"
                    step="any"
                    value={entry}
                    onChange={e => setEntry(e.target.value)}
                    placeholder="21,450.00"
                    style={input}
                  />
                </div>

                {/* Stop Loss Price */}
                <div>
                  <label style={label}>Stop Loss Price</label>
                  <input
                    type="number"
                    step="any"
                    value={stop}
                    onChange={e => setStop(e.target.value)}
                    placeholder="21,420.00"
                    style={input}
                  />
                </div>
              </div>

              {/* Instrument pills */}
              <div style={{ marginBottom: 24 }}>
                <label style={label}>Instrument</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {INSTRUMENTS.map(i => {
                    const on = inst === i.key;
                    return (
                      <button
                        key={i.key}
                        type="button"
                        title={i.tooltip}
                        onClick={() => setInst(i.key)}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 999,
                          border: `1px solid ${on ? "#6366f1" : "#1e1e1e"}`,
                          background: on ? "rgba(99,102,241,0.12)" : "#080808",
                          color: on ? "#6366f1" : "#9ca3af",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "ui-monospace, monospace",
                          letterSpacing: "0.02em",
                          transition: "all 0.15s",
                        }}
                      >
                        {i.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* RESULT BOX */}
              <div style={{
                background: "#080808",
                border: "1px solid #1e1e1e",
                borderLeft: "3px solid #6366f1",
                borderRadius: 10,
                padding: "22px 24px",
                marginBottom: 20,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
                  Contracts to Trade
                </div>
                <div style={{
                  fontSize: 48,
                  fontWeight: 700,
                  color: valid && contracts > 0 ? "#ffffff" : "#374151",
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  marginBottom: 16,
                }}>
                  {valid && contracts > 0 ? contracts : "—"}
                </div>

                <div style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px 16px",
                  fontSize: 12,
                  color: "#9ca3af",
                  fontFamily: "ui-monospace, monospace",
                  paddingTop: 14,
                  borderTop: "1px solid #1e1e1e",
                }}>
                  <span>Dollar Risk: <span style={{ color: "#ffffff", fontWeight: 600 }}>{fmtMoney(valid && contracts > 0 ? actualLoss : dollarRisk)}</span></span>
                  <span style={{ color: "#374151" }}>·</span>
                  <span>Stop Distance: <span style={{ color: "#ffffff", fontWeight: 600 }}>{distanceDisplay}</span></span>
                  <span style={{ color: "#374151" }}>·</span>
                  <span>Position Value: <span style={{ color: "#ffffff", fontWeight: 600 }}>{valid && contracts > 0 ? fmtMoney(positionValue) : "—"}</span></span>
                </div>
              </div>

              {/* Risk meter */}
              <div style={{ marginBottom: 24 }}>
                <div style={{
                  height: 6,
                  background: "#1e1e1e",
                  borderRadius: 999,
                  overflow: "hidden",
                  marginBottom: 8,
                }}>
                  <div style={{
                    height: "100%",
                    width: `${riskMeterPct}%`,
                    background: riskColor,
                    borderRadius: 999,
                    transition: "all 0.2s",
                  }} />
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af", fontFamily: "ui-monospace, monospace" }}>
                  You are risking <span style={{ color: riskColor, fontWeight: 700 }}>{riskPct.toFixed(2)}%</span> of your account on this trade
                </div>
              </div>

              {/* Save button */}
              <button
                type="button"
                onClick={saveSettings}
                style={{
                  width: "100%",
                  padding: "13px 20px",
                  borderRadius: 9,
                  border: "none",
                  background: savedFlash ? "#10b981" : "#6366f1",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >
                {savedFlash ? "✓ Saved" : "Save Settings"}
              </button>
            </section>

            {/* ═══ SECTION 2: SESSION RULES ═══ */}
            <div style={{ marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setShowSession(s => !s)}
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  borderRadius: showSession ? "14px 14px 0 0" : 14,
                  border: "1px solid #1e1e1e",
                  borderBottom: showSession ? "none" : "1px solid #1e1e1e",
                  background: "#111111",
                  color: "#9ca3af",
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>Session rules</span>
                <span style={{
                  fontSize: 12,
                  color: "#6b7280",
                  transform: showSession ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                  display: "inline-block",
                }}>▾</span>
              </button>

              {showSession && (
                <div style={{
                  background: "#111111",
                  border: "1px solid #1e1e1e",
                  borderTop: "none",
                  borderRadius: "0 0 14px 14px",
                  padding: "20px 28px 28px",
                }}>
                  {/* Session times */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={label}>Session</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                      <input
                        type="time"
                        value={session.sessionStart}
                        onChange={e => setSession(s => ({ ...s, sessionStart: e.target.value }))}
                        style={input}
                      />
                      <input
                        type="time"
                        value={session.sessionEnd}
                        onChange={e => setSession(s => ({ ...s, sessionEnd: e.target.value }))}
                        style={input}
                      />
                      <select
                        value={session.timezone}
                        onChange={e => setSession(s => ({ ...s, timezone: e.target.value as typeof TIMEZONES[number] }))}
                        style={{ ...input, appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}
                      >
                        {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Max trades / day */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                    <div>
                      <label style={label}>Max trades / day</label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={session.maxTradesPerDay}
                        onChange={e => setSession(s => ({ ...s, maxTradesPerDay: Math.max(1, Math.min(50, parseInt(e.target.value) || 1)) }))}
                        style={input}
                      />
                    </div>
                    <div>
                      <label style={label}>Max daily loss (auto)</label>
                      <input
                        type="text"
                        readOnly
                        value={fmtMoney(maxDailyLoss)}
                        style={{ ...input, color: "#ef4444", cursor: "not-allowed", opacity: 0.85 }}
                      />
                    </div>
                  </div>

                  {/* Trading days */}
                  <div>
                    <label style={label}>Trading days</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {DAYS.map(d => {
                        const on = session.tradingDays[d];
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setSession(s => ({ ...s, tradingDays: { ...s.tradingDays, [d]: !on } }))}
                            style={{
                              flex: 1,
                              padding: "10px 0",
                              borderRadius: 8,
                              border: `1px solid ${on ? "#6366f1" : "#1e1e1e"}`,
                              background: on ? "rgba(99,102,241,0.12)" : "#080808",
                              color: on ? "#6366f1" : "#6b7280",
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                          >
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

          <style>{`
            input[type="range"] {
              height: 4px;
              border-radius: 4px;
              background: #1e1e1e;
            }
            input[type="number"]::-webkit-outer-spin-button,
            input[type="number"]::-webkit-inner-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }
            input[type="number"] {
              -moz-appearance: textfield;
            }
            input:focus, select:focus {
              border-color: #6366f1 !important;
            }
            @media (max-width: 640px) {
              .planner-grid { grid-template-columns: 1fr !important; }
            }
          `}</style>
        </div>
      </main>
    </div>
  );
}
