"use client";

import { useState, useRef, useCallback } from "react";
import {
  parseAndReconstructCSV,
  saveImportRecord,
  loadImportHistory,
  type ReconstructedTrade,
  type ImportRecord,
} from "@/lib/reconstructionEngine";

// ── Types ──────────────────────────────────────────────────────

interface ImportState {
  phase: "idle" | "uploading" | "preview" | "importing" | "done" | "error";
  trades: ReconstructedTrade[];
  broker: string | null;
  isExecution: boolean;
  stats: { totalRows: number; parsed: number; reconstructed: number; scaleIns: number; scaleOuts: number } | null;
  filename: string;
  error: string;
}

const BROKER_COLORS: Record<string, string> = {
  tradovate:   "#38bdf8",
  ninjatrader: "#a78bfa",
  apex:        "#f97316",
  ibkr:        "#34d399",
  topstepx:    "#fbbf24",
  generic:     "#64748b",
};

const BROKER_LABELS: Record<string, string> = {
  tradovate:   "Tradovate",
  ninjatrader: "NinjaTrader",
  apex:        "Apex Trader",
  ibkr:        "Interactive Brokers",
  topstepx:    "TopstepX",
  generic:     "Generic CSV",
};

function getUser() {
  try { return JSON.parse(localStorage.getItem("tradedesk_session_v1") ?? "{}"); }
  catch { return {}; }
}

function getActiveAccountId(): string | null {
  try {
    const { username } = getUser();
    if (!username) return null;
    return localStorage.getItem(`nexyru_active_account_${username}`);
  } catch { return null; }
}

function saveTradesLocally(trades: ReconstructedTrade[]) {
  const { username } = getUser();
  if (!username) return;
  const key = `tradedesk_trades_${username}_v1`;
  const existing: ReconstructedTrade[] = (() => {
    try { return JSON.parse(localStorage.getItem(key) ?? "[]"); }
    catch { return []; }
  })();
  // Deduplicate by id
  const existingIds = new Set(existing.map(t => t.id));
  const newTrades = trades.filter(t => !existingIds.has(t.id));
  localStorage.setItem(key, JSON.stringify([...existing, ...newTrades]));
  return newTrades.length;
}

// ── Components ─────────────────────────────────────────────────

function BrokerBadge({ broker }: { broker: string | null }) {
  const b = broker ?? "generic";
  const color = BROKER_COLORS[b] ?? "#64748b";
  const label = BROKER_LABELS[b] ?? broker ?? "Unknown";
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, background:`${color}15`, border:`1px solid ${color}30`, color }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:color, display:"inline-block" }}/>
      {label}
    </span>
  );
}

function StatCard({ label, value, color = "#94a3b8", sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div style={{ background:"#0d1628", border:"1px solid #1a2540", borderRadius:12, padding:"14px 16px", textAlign:"center" }}>
      <div style={{ fontSize:9, fontWeight:700, color:"#3a4a6a", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:900, fontFamily:"monospace", color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:"#475569", marginTop:4 }}>{sub}</div>}
    </div>
  );
}

function TradePreviewRow({ trade, i }: { trade: ReconstructedTrade; i: number }) {
  const pos = trade.pnl >= 0;
  const holdMin = Math.round(trade.holdDuration / 60000);
  const holdStr = holdMin < 60 ? `${holdMin}m` : `${(holdMin/60).toFixed(1)}h`;

  return (
    <tr style={{ borderBottom:"1px solid #0d1628" }}>
      <td style={{ padding:"8px 12px", fontSize:11, color:"#64748b" }}>{i + 1}</td>
      <td style={{ padding:"8px 12px", fontSize:11, fontWeight:700, color:"#e2e8f0", fontFamily:"monospace" }}>
        {trade.symbol}
        {trade.tags.includes("Scale-In") && <span style={{ marginLeft:4, fontSize:8, fontWeight:700, color:"#38bdf8", background:"rgba(56,189,248,0.1)", padding:"1px 5px", borderRadius:6 }}>SCALE-IN</span>}
        {trade.tags.includes("Scale-Out") && <span style={{ marginLeft:4, fontSize:8, fontWeight:700, color:"#a78bfa", background:"rgba(167,139,250,0.1)", padding:"1px 5px", borderRadius:6 }}>SCALE-OUT</span>}
        {trade.tags.includes("Open Position") && <span style={{ marginLeft:4, fontSize:8, fontWeight:700, color:"#fbbf24", background:"rgba(251,191,36,0.1)", padding:"1px 5px", borderRadius:6 }}>OPEN</span>}
      </td>
      <td style={{ padding:"8px 12px" }}>
        <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:4, background:trade.direction==="long"?"rgba(52,211,153,0.1)":"rgba(248,113,113,0.1)", color:trade.direction==="long"?"#34d399":"#f87171" }}>
          {trade.direction === "long" ? "▲ LONG" : "▼ SHORT"}
        </span>
      </td>
      <td style={{ padding:"8px 12px", fontSize:11, color:"#94a3b8", fontFamily:"monospace" }}>{trade.avgEntry.toFixed(2)}</td>
      <td style={{ padding:"8px 12px", fontSize:11, color:"#94a3b8", fontFamily:"monospace" }}>{trade.avgExit.toFixed(2)}</td>
      <td style={{ padding:"8px 12px", fontSize:11, fontWeight:700, color: pos ? "#34d399" : "#f87171", fontFamily:"monospace" }}>
        {pos ? "+" : ""}{trade.pnl.toFixed(2)}
      </td>
      <td style={{ padding:"8px 12px", fontSize:11, color:"#64748b" }}>{trade.quantity}</td>
      <td style={{ padding:"8px 12px", fontSize:11, color:"#475569" }}>{holdStr}</td>
      <td style={{ padding:"8px 12px", fontSize:11, color:"#475569" }}>{trade.executions.length} fills</td>
    </tr>
  );
}

function ImportHistory() {
  const { username } = getUser();
  const history = loadImportHistory(username);
  if (!history.length) return null;

  return (
    <div style={{ background:"#0b1120", border:"1px solid #1a2540", borderRadius:16, overflow:"hidden", marginTop:24 }}>
      <div style={{ padding:"14px 18px", borderBottom:"1px solid #111827", fontSize:12, fontWeight:700, color:"#94a3b8" }}>
        📋 Import History
      </div>
      {history.slice(0, 10).map(r => (
        <div key={r.id} style={{ padding:"12px 18px", borderBottom:"1px solid #0d1628", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <BrokerBadge broker={r.broker}/>
          <div style={{ flex:1, minWidth:150 }}>
            <div style={{ fontSize:11, fontWeight:600, color:"#e2e8f0" }}>{r.filename}</div>
            <div style={{ fontSize:10, color:"#3a4a6a", marginTop:2 }}>
              {new Date(r.importedAt).toLocaleString()} · {r.tradesCreated} trades
            </div>
          </div>
          <div style={{ display:"flex", gap:10, fontSize:10, color:"#3a4a6a" }}>
            <span style={{ color:"#34d399" }}>✓ {r.successRows}</span>
            {r.failedRows > 0 && <span style={{ color:"#f87171" }}>✗ {r.failedRows}</span>}
            {r.reconstructed > 0 && <span style={{ color:"#38bdf8" }}>⟲ {r.reconstructed} reconstructed</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────

export default function ImportPage() {
  const [state, setState] = useState<ImportState>({
    phase: "idle", trades: [], broker: null, isExecution: false,
    stats: null, filename: "", error: "",
  });
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setState(s => ({ ...s, phase: "uploading", filename: file.name, error: "" }));
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const accountId = getActiveAccountId();
        const result = parseAndReconstructCSV(text, accountId);

        if (!result.trades.length) {
          setState(s => ({ ...s, phase: "error", error: "No valid trades found. Check your CSV format." }));
          return;
        }

        setState(s => ({
          ...s, phase: "preview",
          trades:      result.trades,
          broker:      result.broker,
          isExecution: result.isExecution,
          stats:       result.stats,
        }));
      } catch (err) {
        setState(s => ({ ...s, phase: "error", error: `Parse error: ${err}` }));
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const confirmImport = () => {
    setState(s => ({ ...s, phase: "importing" }));
    const { username } = getUser();
    const added = saveTradesLocally(state.trades);

    saveImportRecord(username, {
      broker:       state.broker ?? "generic",
      filename:     state.filename,
      importedAt:   Date.now(),
      totalRows:    state.stats?.totalRows ?? 0,
      successRows:  state.stats?.parsed ?? 0,
      failedRows:   (state.stats?.totalRows ?? 0) - (state.stats?.parsed ?? 0),
      reconstructed:state.stats?.reconstructed ?? 0,
      tradesCreated:added ?? 0,
      accountId:    getActiveAccountId(),
    });

    setTimeout(() => setState(s => ({ ...s, phase: "done" })), 600);
  };

  const reset = () => setState({ phase:"idle", trades:[], broker:null, isExecution:false, stats:null, filename:"", error:"" });

  const pnlSum    = state.trades.reduce((s, t) => s + t.pnl, 0);
  const winRate   = state.trades.length ? (state.trades.filter(t => t.pnl > 0).length / state.trades.length * 100) : 0;
  const scaleIns  = state.trades.filter(t => t.tags.includes("Scale-In")).length;
  const scaleOuts = state.trades.filter(t => t.tags.includes("Scale-Out")).length;

  return (
    <div style={{ minHeight:"100vh", background:"#060d1a", color:"#c8d8f0", fontFamily:"system-ui,sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Nav */}
      <div style={{ borderBottom:"1px solid #0d1628", background:"rgba(6,13,26,0.95)", padding:"14px 28px", display:"flex", alignItems:"center", gap:16, position:"sticky", top:0, zIndex:10, backdropFilter:"blur(8px)" }}>
        <a href="/dashboard" style={{ fontSize:12, color:"#3a4a6a", textDecoration:"none" }}>← Dashboard</a>
        <span style={{ fontSize:14, fontWeight:800, color:"#f0f4ff" }}>📥 Import Trades</span>
        <div style={{ flex:1 }}/>
        {state.broker && <BrokerBadge broker={state.broker}/>}
        {state.phase === "preview" && (
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={reset} style={{ padding:"7px 14px", borderRadius:9, border:"1px solid #1a2035", background:"transparent", color:"#64748b", fontSize:11, fontWeight:600, cursor:"pointer" }}>
              Cancel
            </button>
            <button onClick={confirmImport} style={{ padding:"7px 18px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#0ea5a0,#34d399)", color:"#000", fontSize:12, fontWeight:800, cursor:"pointer" }}>
              ✓ Import {state.trades.length} Trades
            </button>
          </div>
        )}
        {state.phase === "done" && (
          <div style={{ display:"flex", gap:8 }}>
            <a href="/dashboard" style={{ padding:"7px 14px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#0ea5a0,#34d399)", color:"#000", fontSize:12, fontWeight:800, textDecoration:"none", cursor:"pointer" }}>
              View Journal →
            </a>
            <button onClick={reset} style={{ padding:"7px 14px", borderRadius:9, border:"1px solid #1a2035", background:"transparent", color:"#64748b", fontSize:11, cursor:"pointer" }}>
              Import More
            </button>
          </div>
        )}
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 24px" }}>

        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <h1 style={{ fontSize:24, fontWeight:900, color:"#f0f4ff", margin:"0 0 8px", letterSpacing:"-0.02em" }}>
            Trade Import Engine
          </h1>
          <p style={{ fontSize:13, color:"#3a4a6a", margin:0 }}>
            Upload broker CSVs · Auto-detects format · Reconstructs scale-ins &amp; scale-outs into complete trades
          </p>
        </div>

        {/* ── Idle / Upload ── */}
        {(state.phase === "idle" || state.phase === "uploading") && (
          <div style={{ animation:"fadeIn 0.3s ease" }}>
            {/* Supported brokers */}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
              {Object.entries(BROKER_LABELS).map(([key, label]) => (
                <BrokerBadge key={key} broker={key}/>
              ))}
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? "#38bdf8" : "#1a2540"}`,
                borderRadius: 20,
                background: dragging ? "rgba(56,189,248,0.04)" : "#0b1120",
                padding: "64px 32px",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display:"none" }} onChange={handleFileInput}/>
              {state.phase === "uploading" ? (
                <>
                  <div style={{ display:"inline-block", width:32, height:32, border:"3px solid #1a2540", borderTopColor:"#38bdf8", borderRadius:"50%", animation:"spin 0.7s linear infinite", marginBottom:16 }}/>
                  <div style={{ fontSize:14, color:"#38bdf8", fontWeight:700 }}>Parsing {state.filename}…</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize:48, marginBottom:16 }}>📂</div>
                  <div style={{ fontSize:16, fontWeight:800, color: dragging ? "#38bdf8" : "#f0f4ff", marginBottom:8 }}>
                    {dragging ? "Drop it!" : "Drop your broker CSV here"}
                  </div>
                  <div style={{ fontSize:12, color:"#3a4a6a", marginBottom:16 }}>
                    or click to browse · Supports Tradovate, NinjaTrader, Apex, TopstepX, IBKR
                  </div>
                  <div style={{ display:"inline-block", padding:"8px 20px", borderRadius:10, border:"1px solid rgba(56,189,248,0.3)", background:"rgba(56,189,248,0.06)", color:"#38bdf8", fontSize:12, fontWeight:700 }}>
                    Choose File
                  </div>
                </>
              )}
            </div>

            {/* Reconstruction explained */}
            <div style={{ marginTop:20, display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12 }}>
              {[
                { icon:"⟲", title:"Reconstruction Engine", desc:"Converts raw fills into complete trades with weighted avg entry/exit" },
                { icon:"📊", title:"Scale-In / Scale-Out", desc:"Groups multiple partial fills into one verified trade with full PnL" },
                { icon:"🔄", title:"Reversal Detection", desc:"Handles long→short flips and partial closes automatically" },
                { icon:"✓",  title:"Verified Badge", desc:"Reconstructed trades get ✓ BROKER badge for leaderboard eligibility" },
              ].map((f, i) => (
                <div key={i} style={{ padding:"14px 16px", borderRadius:12, background:"rgba(30,41,59,0.3)", border:"1px solid #1a2540" }}>
                  <div style={{ fontSize:20, marginBottom:8 }}>{f.icon}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:"#e2e8f0", marginBottom:4 }}>{f.title}</div>
                  <div style={{ fontSize:11, color:"#475569", lineHeight:1.6 }}>{f.desc}</div>
                </div>
              ))}
            </div>

            <ImportHistory/>
          </div>
        )}

        {/* ── Error ── */}
        {state.phase === "error" && (
          <div style={{ padding:"32px", borderRadius:16, background:"rgba(248,113,113,0.06)", border:"1px solid rgba(248,113,113,0.25)", textAlign:"center", animation:"fadeIn 0.3s ease" }}>
            <div style={{ fontSize:36, marginBottom:12 }}>❌</div>
            <div style={{ fontSize:16, fontWeight:700, color:"#f87171", marginBottom:8 }}>Import Failed</div>
            <div style={{ fontSize:12, color:"#64748b", marginBottom:20 }}>{state.error}</div>
            <button onClick={reset} style={{ padding:"9px 20px", borderRadius:10, border:"1px solid rgba(248,113,113,0.3)", background:"transparent", color:"#f87171", fontSize:12, fontWeight:700, cursor:"pointer" }}>
              Try Again
            </button>
          </div>
        )}

        {/* ── Preview ── */}
        {state.phase === "preview" && (
          <div style={{ animation:"fadeIn 0.3s ease" }}>
            {/* Stats row */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:10, marginBottom:20 }}>
              <StatCard label="Trades" value={state.trades.length} color="#f0f4ff"/>
              <StatCard label="Win Rate" value={`${winRate.toFixed(0)}%`} color={winRate >= 50 ? "#34d399" : "#f87171"}/>
              <StatCard label="Net PnL" value={`${pnlSum >= 0 ? "+" : ""}${pnlSum.toFixed(2)}`} color={pnlSum >= 0 ? "#34d399" : "#f87171"}/>
              <StatCard label="Scale-Ins" value={scaleIns} color="#38bdf8" sub={`${scaleIns} reconstructed`}/>
              <StatCard label="Scale-Outs" value={scaleOuts} color="#a78bfa" sub={`${scaleOuts} reconstructed`}/>
              <StatCard label="Raw Rows" value={state.stats?.totalRows ?? 0} color="#64748b" sub={`${state.stats?.parsed ?? 0} parsed`}/>
            </div>

            {/* Info banner */}
            {state.isExecution && (
              <div style={{ padding:"10px 16px", borderRadius:10, background:"rgba(56,189,248,0.06)", border:"1px solid rgba(56,189,248,0.2)", marginBottom:16, fontSize:11, color:"#38bdf8" }}>
                ⟲ <strong>Execution-level data detected</strong> — fills have been reconstructed into {state.trades.length} complete trades from {state.stats?.totalRows} raw executions
              </div>
            )}

            {/* Preview table */}
            <div style={{ background:"#0b1120", border:"1px solid #1a2540", borderRadius:16, overflow:"hidden" }}>
              <div style={{ padding:"14px 18px", borderBottom:"1px solid #111827", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontSize:12, fontWeight:700, color:"#94a3b8" }}>Preview — {state.trades.length} trades</span>
                <span style={{ fontSize:11, color:"#3a4a6a" }}>Review before importing</span>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"rgba(10,15,30,0.98)" }}>
                      {["#","Symbol","Direction","Avg Entry","Avg Exit","PnL","Qty","Hold","Fills"].map(h => (
                        <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:9, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.07em", borderBottom:"1px solid rgba(30,41,59,0.8)", whiteSpace:"nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.trades.slice(0, 100).map((t, i) => (
                      <TradePreviewRow key={t.id} trade={t} i={i}/>
                    ))}
                  </tbody>
                </table>
                {state.trades.length > 100 && (
                  <div style={{ padding:"12px", textAlign:"center", fontSize:11, color:"#3a4a6a" }}>
                    …and {state.trades.length - 100} more trades
                  </div>
                )}
              </div>
            </div>

            {/* Confirm button */}
            <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16 }}>
              <button onClick={confirmImport} style={{ padding:"12px 28px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#0ea5a0,#34d399)", color:"#000", fontSize:13, fontWeight:800, cursor:"pointer" }}>
                ✓ Import {state.trades.length} Trades to Journal
              </button>
            </div>
          </div>
        )}

        {/* ── Importing ── */}
        {state.phase === "importing" && (
          <div style={{ textAlign:"center", padding:"80px 0", animation:"fadeIn 0.3s ease" }}>
            <div style={{ display:"inline-block", width:40, height:40, border:"3px solid #1a2540", borderTopColor:"#34d399", borderRadius:"50%", animation:"spin 0.7s linear infinite", marginBottom:20 }}/>
            <div style={{ fontSize:16, fontWeight:700, color:"#f0f4ff", marginBottom:8 }}>Saving trades…</div>
            <div style={{ fontSize:12, color:"#3a4a6a" }}>Adding {state.trades.length} reconstructed trades to your journal</div>
          </div>
        )}

        {/* ── Done ── */}
        {state.phase === "done" && (
          <div style={{ textAlign:"center", padding:"64px 0", animation:"fadeIn 0.3s ease" }}>
            <div style={{ fontSize:56, marginBottom:16 }}>✅</div>
            <div style={{ fontSize:22, fontWeight:900, color:"#34d399", marginBottom:8 }}>Import Complete</div>
            <div style={{ fontSize:13, color:"#3a4a6a", marginBottom:24 }}>
              {state.trades.length} trades added to your journal
              {scaleIns > 0 && ` · ${scaleIns} scale-in trades reconstructed`}
              {scaleOuts > 0 && ` · ${scaleOuts} scale-out trades reconstructed`}
            </div>
            <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
              <a href="/dashboard" style={{ padding:"11px 24px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#0ea5a0,#34d399)", color:"#000", fontSize:13, fontWeight:800, textDecoration:"none" }}>
                View Journal →
              </a>
              <button onClick={reset} style={{ padding:"11px 20px", borderRadius:12, border:"1px solid #1a2540", background:"transparent", color:"#64748b", fontSize:12, cursor:"pointer" }}>
                Import Another File
              </button>
            </div>
            <ImportHistory/>
          </div>
        )}

      </div>
    </div>
  );
}