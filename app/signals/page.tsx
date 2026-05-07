"use client";

import { useState, useEffect, useCallback } from "react";

interface Signal {
  id:           string;
  trader_id:    string;
  trader_name:  string;
  pair:         string;
  direction:    "long" | "short";
  entry:        number;
  stop_loss:    number | null;
  take_profit:  number | null;
  notes:        string | null;
  risk_pct:     number;
  status:       "open" | "hit_tp" | "hit_sl" | "cancelled";
  created_at:   string;
}

function getUser() {
  try { return JSON.parse(localStorage.getItem("tradedesk_session_v1") ?? "{}"); }
  catch { return {}; }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

// ── Post Signal Modal ──────────────────────────────────────────
function PostSignalModal({ onClose, onPost }: { onClose: () => void; onPost: (s: Partial<Signal>) => Promise<void> }) {
  const [pair,      setPair]      = useState("");
  const [direction, setDirection] = useState<"long"|"short">("long");
  const [entry,     setEntry]     = useState("");
  const [sl,        setSl]        = useState("");
  const [tp,        setTp]        = useState("");
  const [notes,     setNotes]     = useState("");
  const [riskPct,   setRiskPct]   = useState("1");
  const [posting,   setPosting]   = useState(false);
  const [error,     setError]     = useState("");

  const rr = sl && tp && entry
    ? Math.abs((parseFloat(tp) - parseFloat(entry)) / (parseFloat(entry) - parseFloat(sl))).toFixed(2)
    : null;

  const submit = async () => {
    if (!pair || !entry) { setError("Pair and entry are required"); return; }
    setPosting(true); setError("");
    try {
      await onPost({ pair, direction, entry: parseFloat(entry), stop_loss: sl ? parseFloat(sl) : null, take_profit: tp ? parseFloat(tp) : null, notes: notes || null, risk_pct: parseFloat(riskPct) || 1 });
      onClose();
    } catch (e: unknown) {
      setError(String(e));
    } finally { setPosting(false); }
  };

  const inp: React.CSSProperties = { width:"100%", padding:"9px 12px", borderRadius:9, border:"1px solid #1a2540", background:"#0d1628", color:"#f0f4ff", fontSize:13, fontFamily:"monospace", outline:"none", boxSizing:"border-box" };
  const lbl: React.CSSProperties = { fontSize:10, fontWeight:700, color:"#4a5a7a", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:5 };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(6px)" }}/>
      <div style={{ position:"relative", zIndex:10, background:"#0d1628", border:"1px solid #1e2f4a", borderRadius:20, padding:28, width:"100%", maxWidth:420, boxShadow:"0 30px 80px rgba(0,0,0,0.8)" }}>
        <div style={{ fontSize:16, fontWeight:800, color:"#f0f4ff", marginBottom:20 }}>📡 Post Signal</div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <div>
            <label style={lbl}>Pair</label>
            <input value={pair} onChange={e => setPair(e.target.value.toUpperCase())} placeholder="BTC-USD" style={inp}/>
          </div>
          <div>
            <label style={lbl}>Direction</label>
            <div style={{ display:"flex", gap:6 }}>
              {(["long","short"] as const).map(d => (
                <button key={d} onClick={() => setDirection(d)} style={{ flex:1, padding:"9px 0", borderRadius:9, border:`1px solid ${direction===d ? (d==="long"?"rgba(52,211,153,0.4)":"rgba(248,113,113,0.4)") : "#1a2540"}`, background: direction===d ? (d==="long"?"rgba(52,211,153,0.12)":"rgba(248,113,113,0.12)") : "#0d1628", color: direction===d ? (d==="long"?"#34d399":"#f87171") : "#4a5a7a", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                  {d === "long" ? "▲ Long" : "▼ Short"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:14 }}>
          <div><label style={lbl}>Entry</label><input value={entry} onChange={e=>setEntry(e.target.value)} type="number" placeholder="0.00" style={inp}/></div>
          <div><label style={lbl}>Stop Loss</label><input value={sl} onChange={e=>setSl(e.target.value)} type="number" placeholder="0.00" style={inp}/></div>
          <div><label style={lbl}>Take Profit</label><input value={tp} onChange={e=>setTp(e.target.value)} type="number" placeholder="0.00" style={inp}/></div>
        </div>

        {rr && (
          <div style={{ padding:"8px 12px", borderRadius:8, background:"rgba(56,189,248,0.06)", border:"1px solid rgba(56,189,248,0.15)", fontSize:11, color:"#38bdf8", marginBottom:14 }}>
            R:R Ratio — {rr}:1
          </div>
        )}

        <div style={{ marginBottom:14 }}>
          <label style={lbl}>Risk % (suggested)</label>
          <input value={riskPct} onChange={e=>setRiskPct(e.target.value)} type="number" min="0.1" max="5" step="0.1" style={inp}/>
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={lbl}>Notes (optional)</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Setup rationale, key levels, context…" rows={3} style={{ ...inp, resize:"vertical", fontFamily:"system-ui", fontSize:12 }}/>
        </div>

        {error && <div style={{ fontSize:11, color:"#f87171", marginBottom:12 }}>⚠ {error}</div>}

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:10, borderRadius:10, border:"1px solid #1e2f4a", background:"transparent", color:"#4a5a7a", fontSize:13, fontWeight:600, cursor:"pointer" }}>Cancel</button>
          <button onClick={submit} disabled={posting} style={{ flex:2, padding:10, borderRadius:10, border:"none", background:"linear-gradient(135deg,#0369a1,#38bdf8)", color:"#fff", fontSize:13, fontWeight:800, cursor:posting?"not-allowed":"pointer" }}>
            {posting ? "Posting…" : "📡 Post Signal"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Copy Modal ─────────────────────────────────────────────────
function CopyModal({ signal, onClose, onCopy }: { signal: Signal; onClose: () => void; onCopy: (accountSize: number, riskPct: number) => Promise<void> }) {
  const [acctSize, setAcctSize] = useState("10000");
  const [riskPct,  setRiskPct]  = useState(String(signal.risk_pct ?? 1));
  const [copying,  setCopying]  = useState(false);

  const riskAmt  = (parseFloat(acctSize)||10000) * ((parseFloat(riskPct)||1) / 100);
  const slDist   = signal.stop_loss && signal.entry ? Math.abs(signal.entry - signal.stop_loss) : null;
  const posSize  = slDist && slDist > 0 ? (riskAmt / slDist).toFixed(4) : null;

  const submit = async () => {
    setCopying(true);
    await onCopy(parseFloat(acctSize)||10000, parseFloat(riskPct)||1);
    setCopying(false);
    onClose();
  };

  const inp: React.CSSProperties = { width:"100%", padding:"9px 12px", borderRadius:9, border:"1px solid #1a2540", background:"#0d1628", color:"#f0f4ff", fontSize:14, fontWeight:700, fontFamily:"monospace", outline:"none", boxSizing:"border-box" };
  const lbl: React.CSSProperties = { fontSize:10, fontWeight:700, color:"#4a5a7a", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:5 };
  const dirColor = signal.direction === "long" ? "#34d399" : "#f87171";

  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(6px)" }}/>
      <div style={{ position:"relative", zIndex:10, background:"#0d1628", border:"1px solid #1e2f4a", borderRadius:20, padding:28, width:"100%", maxWidth:380, boxShadow:"0 30px 80px rgba(0,0,0,0.8)" }}>
        <div style={{ fontSize:16, fontWeight:800, color:"#f0f4ff", marginBottom:4 }}>Copy Trade</div>
        <div style={{ fontSize:12, color:"#3a4a6a", marginBottom:20 }}>
          <span style={{ color:dirColor, fontWeight:700 }}>{signal.direction === "long" ? "▲ Long" : "▼ Short"}</span> {signal.pair} @ {signal.entry}
        </div>

        {/* Signal summary */}
        <div style={{ padding:"12px 14px", borderRadius:10, background:"#111d30", border:"1px solid #1a2540", marginBottom:16, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:9, color:"#3a4a6a", marginBottom:3 }}>ENTRY</div>
            <div style={{ fontSize:13, fontWeight:800, color:"#f0f4ff", fontFamily:"monospace" }}>{signal.entry}</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:9, color:"#3a4a6a", marginBottom:3 }}>STOP</div>
            <div style={{ fontSize:13, fontWeight:800, color:"#f87171", fontFamily:"monospace" }}>{signal.stop_loss ?? "—"}</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:9, color:"#3a4a6a", marginBottom:3 }}>TARGET</div>
            <div style={{ fontSize:13, fontWeight:800, color:"#34d399", fontFamily:"monospace" }}>{signal.take_profit ?? "—"}</div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <div><label style={lbl}>Account Size ($)</label><input value={acctSize} onChange={e=>setAcctSize(e.target.value)} type="number" style={inp}/></div>
          <div><label style={lbl}>Risk %</label><input value={riskPct} onChange={e=>setRiskPct(e.target.value)} type="number" min="0.1" max="5" step="0.1" style={inp}/></div>
        </div>

        {/* Calculated position */}
        <div style={{ padding:"12px 14px", borderRadius:10, background:"rgba(56,189,248,0.06)", border:"1px solid rgba(56,189,248,0.15)", marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:11, color:"#3a6a8a" }}>Risk Amount</span>
            <span style={{ fontSize:13, fontWeight:700, color:"#38bdf8", fontFamily:"monospace" }}>${riskAmt.toFixed(2)}</span>
          </div>
          {posSize && (
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:11, color:"#3a6a8a" }}>Suggested Size</span>
              <span style={{ fontSize:13, fontWeight:700, color:"#38bdf8", fontFamily:"monospace" }}>{posSize} units</span>
            </div>
          )}
        </div>

        <div style={{ fontSize:10, color:"#2e3f5a", marginBottom:16, lineHeight:1.5 }}>
          ⚠ This is a manual copy — you need to place this trade yourself in your broker. Nexyru tracks that you copied it.
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:10, borderRadius:10, border:"1px solid #1e2f4a", background:"transparent", color:"#4a5a7a", fontSize:13, fontWeight:600, cursor:"pointer" }}>Cancel</button>
          <button onClick={submit} disabled={copying} style={{ flex:2, padding:10, borderRadius:10, border:"none", background:"linear-gradient(135deg,#0ea5a0,#34d399)", color:"#000", fontSize:13, fontWeight:800, cursor:copying?"not-allowed":"pointer" }}>
            {copying ? "Saving…" : "✓ I Copied This"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Signal card ────────────────────────────────────────────────
function SignalCard({ signal, userId, onCopy }: { signal: Signal; userId: string; onCopy: (s: Signal) => void }) {
  const [copied, setCopied] = useState(false);
  const isOwn    = signal.trader_id === userId;
  const dirColor = signal.direction === "long" ? "#34d399" : "#f87171";
  const dirIcon  = signal.direction === "long" ? "▲" : "▼";

  const STATUS_STYLE: Record<string, { color:string; bg:string; label:string }> = {
    open:      { color:"#38bdf8", bg:"rgba(56,189,248,0.1)",  label:"🟢 Open"     },
    hit_tp:    { color:"#34d399", bg:"rgba(52,211,153,0.1)",  label:"✅ Hit TP"   },
    hit_sl:    { color:"#f87171", bg:"rgba(248,113,113,0.1)", label:"❌ Hit SL"   },
    cancelled: { color:"#64748b", bg:"rgba(100,116,139,0.1)", label:"⏹ Cancelled" },
  };
  const ss = STATUS_STYLE[signal.status] ?? STATUS_STYLE.open;

  const rr = signal.stop_loss && signal.take_profit && signal.entry
    ? Math.abs((signal.take_profit - signal.entry) / (signal.entry - signal.stop_loss)).toFixed(1)
    : null;

  useEffect(() => {
    if (!userId || !signal.id) return;
    fetch(`/api/signal-copies?signal_id=${signal.id}&user_id=${userId}`)
      .then(r => r.json())
      .then(d => { if (d) setCopied(true); })
      .catch(() => {});
  }, [signal.id, userId]);

  const avatarColor = ["#38bdf8","#a78bfa","#34d399","#f97316","#f59e0b"][signal.trader_name.charCodeAt(0) % 5];

  return (
    <div style={{ background:"#0b1120", border:`1px solid ${signal.status==="open"?"#1a2540":"#111827"}`, borderRadius:18, overflow:"hidden", opacity: signal.status !== "open" ? 0.75 : 1 }}>

      {/* Header */}
      <div style={{ padding:"14px 16px", display:"flex", alignItems:"center", gap:12, borderBottom:"1px solid #111827" }}>
        <a href={`/trader/@${signal.trader_id}`} style={{ width:36, height:36, borderRadius:10, background:`${avatarColor}22`, border:`1px solid ${avatarColor}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:900, color:avatarColor, flexShrink:0, fontFamily:"monospace", textDecoration:"none" }}>
          {signal.trader_name.slice(0,2).toUpperCase()}
        </a>
        <div style={{ flex:1, minWidth:0 }}>
          <a href={`/trader/@${signal.trader_id}`} style={{ fontSize:13, fontWeight:700, color:"#e2e8f0", textDecoration:"none" }}>@{signal.trader_name}</a>
          <div style={{ fontSize:10, color:"#3a4a6a", marginTop:1 }}>{timeAgo(signal.created_at)}</div>
        </div>
        <span style={{ fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:10, background:ss.bg, color:ss.color }}>{ss.label}</span>
      </div>

      {/* Signal body */}
      <div style={{ padding:"14px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <span style={{ fontSize:22, fontWeight:900, color:"#f0f4ff", fontFamily:"monospace" }}>{signal.pair}</span>
          <span style={{ fontSize:13, fontWeight:800, padding:"4px 10px", borderRadius:8, background:`${dirColor}15`, border:`1px solid ${dirColor}30`, color:dirColor }}>
            {dirIcon} {signal.direction.toUpperCase()}
          </span>
          {rr && <span style={{ fontSize:11, fontWeight:700, color:"#38bdf8", marginLeft:"auto" }}>R:R {rr}:1</span>}
        </div>

        {/* Price levels */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
          <div style={{ padding:"8px 10px", borderRadius:9, background:"#0d1628", border:"1px solid #1a2540", textAlign:"center" }}>
            <div style={{ fontSize:9, color:"#3a4a6a", marginBottom:3 }}>ENTRY</div>
            <div style={{ fontSize:13, fontWeight:800, color:"#f0f4ff", fontFamily:"monospace" }}>{signal.entry}</div>
          </div>
          <div style={{ padding:"8px 10px", borderRadius:9, background:"#0d1628", border:"1px solid rgba(248,113,113,0.2)", textAlign:"center" }}>
            <div style={{ fontSize:9, color:"#3a4a6a", marginBottom:3 }}>STOP</div>
            <div style={{ fontSize:13, fontWeight:800, color:"#f87171", fontFamily:"monospace" }}>{signal.stop_loss ?? "—"}</div>
          </div>
          <div style={{ padding:"8px 10px", borderRadius:9, background:"#0d1628", border:"1px solid rgba(52,211,153,0.2)", textAlign:"center" }}>
            <div style={{ fontSize:9, color:"#3a4a6a", marginBottom:3 }}>TARGET</div>
            <div style={{ fontSize:13, fontWeight:800, color:"#34d399", fontFamily:"monospace" }}>{signal.take_profit ?? "—"}</div>
          </div>
        </div>

        {signal.notes && (
          <div style={{ fontSize:11, color:"#64748b", lineHeight:1.6, padding:"8px 10px", borderRadius:8, background:"#0d1628", marginBottom:12 }}>
            {signal.notes}
          </div>
        )}

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:10, color:"#2e3f5a" }}>Suggested risk: {signal.risk_pct}%</span>
          {!isOwn && signal.status === "open" && (
            copied ? (
              <span style={{ fontSize:11, fontWeight:700, color:"#34d399", display:"flex", alignItems:"center", gap:5 }}>✓ Copied</span>
            ) : (
              <button onClick={() => onCopy(signal)} style={{ padding:"7px 16px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#0369a1,#38bdf8)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                Copy Trade →
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function SignalsPage() {
  const [signals,     setSignals]     = useState<Signal[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showPost,    setShowPost]    = useState(false);
  const [copyTarget,  setCopyTarget]  = useState<Signal | null>(null);
  const [filter,      setFilter]      = useState<"all"|"open"|"closed">("open");
  const [userId,      setUserId]      = useState("");
  const [userName,    setUserName]    = useState("");
  const [error,       setError]       = useState("");

  useEffect(() => {
    const user = getUser();
    setUserId(user.username ?? "");
    setUserName(user.displayName ?? user.username ?? "");
    loadSignals();
  }, []);

  const loadSignals = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/signals?limit=50");
      const data = await res.json();
      if (Array.isArray(data)) setSignals(data);
      else setError("Failed to load signals");
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  const postSignal = async (s: Partial<Signal>) => {
    const res = await fetch("/api/signals", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...s, trader_id: userId, trader_name: userName }),
    });
    if (!res.ok) throw new Error(await res.text());
    await loadSignals();
  };

  const copySignal = async (accountSize: number, riskPct: number) => {
    if (!copyTarget) return;
    await fetch("/api/signal-copies", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ signal_id: copyTarget.id, user_id: userId, account_size: accountSize, risk_pct: riskPct }),
    });
  };

  const filtered = signals.filter(s => {
    if (filter === "open")   return s.status === "open";
    if (filter === "closed") return s.status !== "open";
    return true;
  });

  return (
    <div style={{ minHeight:"100vh", background:"#060d1a", color:"#c8d8f0", fontFamily:"system-ui,sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Nav */}
      <div style={{ borderBottom:"1px solid #0d1628", background:"rgba(6,13,26,0.95)", padding:"14px 28px", display:"flex", alignItems:"center", gap:16, position:"sticky", top:0, zIndex:10, backdropFilter:"blur(8px)" }}>
        <a href="/dashboard" style={{ fontSize:12, color:"#3a4a6a", textDecoration:"none" }}>← Dashboard</a>
        <span style={{ fontSize:14, fontWeight:800, color:"#f0f4ff" }}>📡 Signal Feed</span>
        <div style={{ flex:1 }}/>
        <button onClick={() => loadSignals()} style={{ padding:"5px 11px", borderRadius:8, border:"1px solid #1a2540", background:"#0b1120", color:"#4a5a7a", fontSize:11, fontWeight:600, cursor:"pointer" }}>🔄</button>
        <button onClick={() => setShowPost(true)} style={{ padding:"7px 16px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#0369a1,#38bdf8)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
          📡 Post Signal
        </button>
      </div>

      <div style={{ maxWidth:800, margin:"0 auto", padding:"28px 20px" }}>

        {/* Header */}
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontSize:24, fontWeight:900, color:"#f0f4ff", margin:"0 0 6px", letterSpacing:"-0.02em" }}>Signal Feed</h1>
          <p style={{ fontSize:13, color:"#3a4a6a", margin:0 }}>
            Verified traders post signals · Copy manually with suggested sizing · Track outcomes
          </p>
        </div>

        {/* Filter tabs */}
        <div style={{ display:"flex", gap:4, marginBottom:20, borderBottom:"1px solid #1a2540", paddingBottom:1 }}>
          {(["open","closed","all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding:"7px 16px", border:"none", background:"transparent", fontSize:12, fontWeight:600, cursor:"pointer", color: filter===f?"#38bdf8":"#4a5a7a", borderBottom: filter===f?"2px solid #38bdf8":"2px solid transparent", marginBottom:-1, textTransform:"capitalize" }}>
              {f === "open" ? "🟢 Open" : f === "closed" ? "⬜ Closed" : "All"}
              {f === "open" && signals.filter(s=>s.status==="open").length > 0 && (
                <span style={{ marginLeft:6, fontSize:10, background:"rgba(56,189,248,0.15)", color:"#38bdf8", padding:"1px 6px", borderRadius:10 }}>
                  {signals.filter(s=>s.status==="open").length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && <div style={{ padding:"12px 16px", borderRadius:10, background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", color:"#f87171", fontSize:12, marginBottom:16 }}>⚠ {error}</div>}

        {/* Loading */}
        {loading && (
          <div style={{ display:"flex", justifyContent:"center", padding:"48px 0", gap:10, color:"#3a4a6a", fontSize:13 }}>
            <span style={{ display:"inline-block", width:16, height:16, border:"2px solid #1a2540", borderTopColor:"#38bdf8", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
            Loading signals…
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📡</div>
            <div style={{ fontSize:15, fontWeight:700, color:"#f0f4ff", marginBottom:6 }}>
              {filter === "open" ? "No open signals right now" : "No signals yet"}
            </div>
            <div style={{ fontSize:12, color:"#3a4a6a", marginBottom:20 }}>
              {filter === "open" ? "Check back soon or switch to All to see past signals" : "Be the first to post a signal"}
            </div>
            <button onClick={() => setShowPost(true)} style={{ padding:"9px 20px", borderRadius:10, background:"rgba(56,189,248,0.1)", border:"1px solid rgba(56,189,248,0.2)", color:"#38bdf8", fontSize:12, fontWeight:700, cursor:"pointer" }}>
              📡 Post First Signal
            </button>
          </div>
        )}

        {/* Signals */}
        {!loading && filtered.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {filtered.map(s => (
              <SignalCard key={s.id} signal={s} userId={userId} onCopy={sig => setCopyTarget(sig)}/>
            ))}
          </div>
        )}
      </div>

      {showPost  && <PostSignalModal onClose={() => setShowPost(false)} onPost={postSignal}/>}
      {copyTarget && <CopyModal signal={copyTarget} onClose={() => setCopyTarget(null)} onCopy={copySignal}/>}
    </div>
  );
}