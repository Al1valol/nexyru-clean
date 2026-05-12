"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";

// ───────────────────────── types ─────────────────────────
type Category = "must" | "good";

interface ChecklistItem {
  id: string;
  text: string;
  category: Category;
}

interface RunItem {
  itemId: string;
  text: string;
  category: Category;
  answer: "yes" | "no";
}

interface ChecklistRun {
  id: string;
  ts: number;
  symbol?: string;
  direction?: "LONG" | "SHORT";
  entry?: number;
  stop?: number;
  target?: number;
  rr?: number | null;
  dollarRisk?: number | null;
  contracts?: number | null;
  passed: boolean;
  items: RunItem[];
  failReason?: string;
  taken?: boolean;
}

interface PlannerSettings {
  accountSize: number;
  maxRiskPct: number;
}

// ───────────────────────── constants ─────────────────────────
const SESSION_KEY = "tradedesk_session_v1";
const itemsKey = (u: string) => `nexyru_checklist_${u}`;
const runsKey = (u: string) => `nexyru_checklist_runs_${u}`;
const plannerKey = (u: string) => `nexyru_trade_planner_${u}`;
const prefillKey = (u: string) => `nexyru_trade_prefill_${u}`;

const DEFAULT_ITEMS: ChecklistItem[] = [
  { id: "i_setup",    text: "Is this my setup?",                          category: "must" },
  { id: "i_session",  text: "Am I trading in my session hours?",          category: "must" },
  { id: "i_limit",    text: "Am I under my daily trade limit?",           category: "must" },
  { id: "i_stop",     text: "Is my stop loss defined?",                   category: "must" },
  { id: "i_target",   text: "Is my target defined (min 2R)?",             category: "must" },
  { id: "i_fomo",     text: "Am I free of FOMO?",                         category: "good" },
  { id: "i_revenge",  text: "Am I clear of revenge trading?",             category: "good" },
  { id: "i_news",     text: "Am I clear of major news in next 10 min?",   category: "good" },
  { id: "i_size",     text: "Is my position size correct?",               category: "must" },
  { id: "i_tomorrow", text: "Would I take this trade again tomorrow?",    category: "good" },
];

const FAIL_REASONS = [
  "Wrong setup",
  "Outside session hours",
  "Hit daily limit",
  "Risk too big",
  "FOMO",
  "Revenge trade",
  "Bad R:R",
  "Major news",
  "Tired / distracted",
  "Just felt off",
];

// Symbol → instrument inference for contract sizing
const INSTRUMENTS: { match: RegExp; tickSize: number; tickValue: number; perPoint: number }[] = [
  { match: /^NQ/i,   tickSize: 0.25, tickValue: 5.00,  perPoint: 20  },
  { match: /^ES/i,   tickSize: 0.25, tickValue: 12.50, perPoint: 50  },
  { match: /^CL/i,   tickSize: 0.01, tickValue: 10.00, perPoint: 1000 },
  { match: /^GC/i,   tickSize: 0.10, tickValue: 10.00, perPoint: 100 },
  { match: /BTC/i,   tickSize: 1,    tickValue: 1,     perPoint: 1   },
  { match: /ETH/i,   tickSize: 0.01, tickValue: 0.01,  perPoint: 1   },
  { match: /SOL/i,   tickSize: 0.01, tickValue: 0.01,  perPoint: 1   },
];

// ───────────────────────── helpers ─────────────────────────
function getUsername(): string {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "{}").username || "guest"; }
  catch { return "guest"; }
}

function fmtMoney(n: number | null | undefined) {
  if (n === null || n === undefined || isNaN(Number(n))) return "—";
  const v = Number(n);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtMoney0(n: number | null | undefined) {
  if (n === null || n === undefined || isNaN(Number(n))) return "—";
  const v = Number(n);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function uid(prefix = "i") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function inferInstrument(sym: string) {
  if (!sym) return null;
  for (const inst of INSTRUMENTS) if (inst.match.test(sym)) return inst;
  return null;
}

// ───────────────────────── shared styles ─────────────────────────
const card: React.CSSProperties = { background: "#0b1120", border: "1px solid #1a2540", borderRadius: 18, padding: 22 };
const cardSm: React.CSSProperties = { background: "#0d1120", border: "1px solid #1a2035", borderRadius: 12, padding: 14 };
const inp: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 9, boxSizing: "border-box",
  background: "#0d1120", border: "1px solid #1a2540", fontSize: 13, color: "#e2e8f0",
  outline: "none", fontFamily: "system-ui",
};
const lbl: React.CSSProperties = {
  display: "block", fontSize: 10, fontWeight: 800, color: "#64748b",
  textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6,
};
const sectionTitle = (color: string, label: string) => (
  <div style={{ fontSize: 11, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>{label}</div>
);

// ───────────────────────── page ─────────────────────────
export default function ChecklistPage() {
  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState("guest");
  const [items, setItems] = useState<ChecklistItem[]>(DEFAULT_ITEMS);
  const [runs, setRuns] = useState<ChecklistRun[]>([]);
  const [planner, setPlanner] = useState<PlannerSettings>({ accountSize: 50000, maxRiskPct: 1 });
  const [flash, setFlash] = useState<string | null>(null);

  // Edit state for checklist items
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Trade details
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");

  // Run state
  const [running, setRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, "yes" | "no">>({});
  const [resultRun, setResultRun] = useState<ChecklistRun | null>(null);
  const [pickedFailReason, setPickedFailReason] = useState<string | null>(null);

  // Animation
  const [cardEnter, setCardEnter] = useState(false);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load
  useEffect(() => {
    setMounted(true);
    const u = getUsername();
    setUsername(u);

    try {
      const raw = localStorage.getItem(itemsKey(u));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          setItems(parsed.filter(x => x && typeof x.id === "string" && typeof x.text === "string"));
        }
      }
    } catch {}

    try {
      const raw = localStorage.getItem(runsKey(u));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setRuns(parsed);
      }
    } catch {}

    try {
      const raw = localStorage.getItem(plannerKey(u));
      if (raw) {
        const parsed = JSON.parse(raw);
        const s = parsed?.settings;
        if (s && typeof s.accountSize === "number" && typeof s.maxRiskPct === "number") {
          setPlanner({ accountSize: s.accountSize, maxRiskPct: s.maxRiskPct });
        }
      }
    } catch {}
  }, []);

  const saveItems = (next: ChecklistItem[]) => {
    setItems(next);
    try { localStorage.setItem(itemsKey(username), JSON.stringify(next)); } catch {}
  };

  const saveRuns = (next: ChecklistRun[]) => {
    setRuns(next);
    try { localStorage.setItem(runsKey(username), JSON.stringify(next)); } catch {}
  };

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1800);
  };

  // ── Item editing
  const startEdit = (id: string, text: string) => { setEditingId(id); setEditText(text); };
  const commitEdit = () => {
    if (!editingId) return;
    const trimmed = editText.trim();
    if (!trimmed) { setEditingId(null); return; }
    saveItems(items.map(it => it.id === editingId ? { ...it, text: trimmed } : it));
    setEditingId(null);
    setEditText("");
  };

  const deleteItem = (id: string) => {
    if (items.length <= 1) { showFlash("Need at least one item"); return; }
    saveItems(items.filter(it => it.id !== id));
  };

  const toggleCategory = (id: string) => {
    saveItems(items.map(it => it.id === id ? { ...it, category: it.category === "must" ? "good" : "must" } : it));
  };

  const addItem = () => {
    const next = [...items, { id: uid(), text: "New checklist item", category: "good" as Category }];
    saveItems(next);
    setTimeout(() => startEdit(next[next.length - 1].id, next[next.length - 1].text), 60);
  };

  // ── Drag reorder
  const onDragStart = (id: string) => setDragId(id);
  const onDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); if (dragOverId !== id) setDragOverId(id); };
  const onDrop = (id: string) => {
    if (!dragId || dragId === id) { setDragId(null); setDragOverId(null); return; }
    const from = items.findIndex(x => x.id === dragId);
    const to = items.findIndex(x => x.id === id);
    if (from < 0 || to < 0) return;
    const copy = items.slice();
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    saveItems(copy);
    setDragId(null); setDragOverId(null);
  };
  const onDragEnd = () => { setDragId(null); setDragOverId(null); };

  const resetDefaults = () => {
    if (typeof window !== "undefined" && !window.confirm("Reset checklist to default items?")) return;
    saveItems(DEFAULT_ITEMS);
  };

  // ── Trade calcs
  const calcs = useMemo(() => {
    const e = parseFloat(entry), s = parseFloat(stop), t = parseFloat(target);
    const validES = !isNaN(e) && !isNaN(s) && e !== s;
    const validET = !isNaN(e) && !isNaN(t) && e !== t;

    const risk = validES ? Math.abs(e - s) : 0;
    const reward = validET ? Math.abs(t - e) : 0;
    const rr = validES && validET && risk > 0 ? +(reward / risk).toFixed(2) : null;

    const dollarRisk = +(planner.accountSize * (planner.maxRiskPct / 100)).toFixed(2);

    let contracts: number | null = null;
    const inst = inferInstrument(symbol);
    if (inst && validES && risk > 0) {
      const ticksToStop = risk / inst.tickSize;
      const riskPerContract = ticksToStop * inst.tickValue;
      if (riskPerContract > 0) contracts = Math.max(0, Math.floor(dollarRisk / riskPerContract));
    }

    return { rr, dollarRisk, contracts, risk, reward };
  }, [entry, stop, target, symbol, planner]);

  // ── Run flow
  const beginRun = () => {
    setAnswers({});
    setStepIndex(0);
    setResultRun(null);
    setPickedFailReason(null);
    setRunning(true);
    triggerCardEnter();
  };

  const cancelRun = () => {
    setRunning(false);
    setResultRun(null);
    setAnswers({});
    setStepIndex(0);
  };

  const triggerCardEnter = () => {
    setCardEnter(false);
    if (enterTimer.current) clearTimeout(enterTimer.current);
    enterTimer.current = setTimeout(() => setCardEnter(true), 20);
  };

  const answer = (val: "yes" | "no") => {
    const current = items[stepIndex];
    if (!current) return;
    const nextAnswers = { ...answers, [current.id]: val };
    setAnswers(nextAnswers);

    if (stepIndex + 1 < items.length) {
      setStepIndex(stepIndex + 1);
      triggerCardEnter();
    } else {
      // finish
      finishRun(nextAnswers);
    }
  };

  const finishRun = (finalAnswers: Record<string, "yes" | "no">) => {
    const runItems: RunItem[] = items.map(it => ({
      itemId: it.id, text: it.text, category: it.category,
      answer: finalAnswers[it.id] || "no",
    }));
    const passed = runItems.filter(r => r.category === "must").every(r => r.answer === "yes");

    const run: ChecklistRun = {
      id: uid("run"),
      ts: Date.now(),
      symbol: symbol.trim() || undefined,
      direction,
      entry: entry ? parseFloat(entry) : undefined,
      stop: stop ? parseFloat(stop) : undefined,
      target: target ? parseFloat(target) : undefined,
      rr: calcs.rr,
      dollarRisk: calcs.dollarRisk,
      contracts: calcs.contracts,
      passed,
      items: runItems,
      taken: passed ? undefined : false,
    };
    setResultRun(run);
    saveRuns([run, ...runs].slice(0, 500));
    setRunning(false);
  };

  const goBack = () => {
    if (stepIndex === 0) { cancelRun(); return; }
    setStepIndex(stepIndex - 1);
    triggerCardEnter();
  };

  // After result actions
  const logTrade = () => {
    if (!resultRun) return;
    const prefill = {
      pair: resultRun.symbol || "",
      type: resultRun.direction === "SHORT" ? "short" : "long",
      entryPrice: resultRun.entry ?? "",
      stopLoss: resultRun.stop ?? "",
      takeProfit: resultRun.target ?? "",
      size: resultRun.contracts ?? 1,
      notes: `Pre-trade checklist passed. R:R ${resultRun.rr ?? "—"}, risk ${fmtMoney0(resultRun.dollarRisk)}.`,
      ts: Date.now(),
    };
    try { localStorage.setItem(prefillKey(username), JSON.stringify(prefill)); } catch {}
    // mark this run as taken
    const updated = runs.map(r => r.id === resultRun.id ? { ...r, taken: true } : r);
    saveRuns(updated);
    window.location.href = "/dashboard";
  };

  const sitOut = () => {
    if (!resultRun) return;
    const updated = runs.map(r => r.id === resultRun.id ? { ...r, taken: false, failReason: pickedFailReason || r.failReason } : r);
    saveRuns(updated);
    showFlash("Smart move. Wait for a better setup.");
    setResultRun(null);
    setSymbol(""); setEntry(""); setStop(""); setTarget("");
    setAnswers({}); setStepIndex(0);
  };

  const pickFailReason = (r: string) => {
    setPickedFailReason(r);
    if (!resultRun) return;
    const updated = runs.map(x => x.id === resultRun.id ? { ...x, failReason: r } : x);
    saveRuns(updated);
  };

  // ── Stats
  const stats = useMemo(() => {
    const total = runs.length;
    const passes = runs.filter(r => r.passed).length;
    const passRate = total > 0 ? Math.round((passes / total) * 100) : 0;

    // most failed item
    const failCount: Record<string, { text: string; count: number }> = {};
    for (const r of runs) {
      for (const it of r.items) {
        if (it.answer === "no") {
          if (!failCount[it.itemId]) failCount[it.itemId] = { text: it.text, count: 0 };
          failCount[it.itemId].count += 1;
        }
      }
    }
    const mostFailed = Object.values(failCount).sort((a, b) => b.count - a.count)[0] || null;

    const taken = runs.filter(r => r.taken === true);
    const skipped = runs.filter(r => r.passed === false || r.taken === false);
    // Skipped = passed===false (auto-skipped because failed) — these are bad trades avoided
    const avoidedBadTrades = runs.filter(r => !r.passed).length;

    // Win rate after taken trades — we don't have outcome on this page, but the spec says "Trades taken after passing: X — Win rate: X%"
    // Read trades from localStorage to compute win rate of trades taken after a passing run
    let takenWinRate: number | null = null;
    let takenCount = taken.length;
    try {
      const raw = localStorage.getItem(`tradedesk_trades_${username}_v1`);
      if (raw) {
        const trades = JSON.parse(raw);
        if (Array.isArray(trades) && taken.length) {
          // Match trades to taken runs by symbol & rough time window (within 24h)
          let matched = 0, wins = 0;
          for (const run of taken) {
            const candidate = trades.find((t: any) => {
              const tDate = t?.date ? new Date(t.date).getTime() : 0;
              if (Math.abs(tDate - run.ts) > 86_400_000) return false;
              if (run.symbol && t?.pair) {
                return String(t.pair).toUpperCase().includes(String(run.symbol).toUpperCase()) ||
                       String(run.symbol).toUpperCase().includes(String(t.pair).toUpperCase());
              }
              return true;
            });
            if (candidate) { matched += 1; if (Number(candidate.pnl) > 0) wins += 1; }
          }
          if (matched > 0) takenWinRate = Math.round((wins / matched) * 100);
        }
      }
    } catch {}

    return { total, passes, passRate, mostFailed, takenCount, avoidedBadTrades, takenWinRate };
  }, [runs, username]);

  if (!mounted) return null;

  // Current step item for run
  const currentItem = running ? items[stepIndex] : null;
  const totalSteps = items.length;
  const progressPct = totalSteps > 0 ? Math.round(((stepIndex) / totalSteps) * 100) : 0;
  const answeredCount = Object.keys(answers).length;

  return (
    <main style={{ minHeight: "100vh", background: "#070b14", color: "#f0f4ff", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`
        @keyframes cardSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.02); }
        }
        .pulse { animation: pulse 1.6s ease-in-out infinite; }
        .card-enter { animation: cardSlideIn 0.28s ease-out forwards; }
        .yesno-btn:hover { transform: translateY(-1px); }
      `}</style>

      {/* Top nav */}
      <div style={{ borderBottom: "1px solid #0d1628", background: "rgba(6,13,26,0.95)", padding: "14px 28px", display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(8px)" }}>
        <a href="/dashboard" style={{ fontSize: 12, color: "#3a4a6a", textDecoration: "none" }}>← Dashboard</a>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#f0f4ff" }}>✅ Pre-Trade Checklist</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: "#3a4a6a", fontWeight: 600 }}>{username ? `@${username}` : ""}</span>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 20px" }}>

        {/* HEADER */}
        <header style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>✅ Pre-Trade Checklist</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: "6px 0 0" }}>Run this before every trade</p>
        </header>

        {flash && (
          <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.3)", color: "#38bdf8", fontSize: 12, fontWeight: 700 }}>{flash}</div>
        )}

        {/* TOP GRID: My Checklist (left) | Run Checklist (right) */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 380px) minmax(0, 1fr)", gap: 20, alignItems: "flex-start", marginBottom: 24 }} className="checklist-top-grid">

          {/* ───── SECTION 1: MY CHECKLIST ───── */}
          <section style={card}>
            {sectionTitle("#a78bfa", "My Checklist")}
            <p style={{ margin: "0 0 14px", fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
              Click an item to edit. Drag to reorder. Toggle category between Must Pass and Good to Check.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map(it => {
                const isMust = it.category === "must";
                const isEditing = editingId === it.id;
                const dragging = dragId === it.id;
                const dragOver = dragOverId === it.id;
                return (
                  <div
                    key={it.id}
                    draggable={!isEditing}
                    onDragStart={() => onDragStart(it.id)}
                    onDragOver={e => onDragOver(e, it.id)}
                    onDrop={() => onDrop(it.id)}
                    onDragEnd={onDragEnd}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      background: "#0d1120",
                      border: `1px solid ${isMust ? "rgba(248,113,113,0.35)" : "rgba(251,191,36,0.30)"}`,
                      borderLeft: `3px solid ${isMust ? "#f87171" : "#fbbf24"}`,
                      borderRadius: 10, padding: "10px 12px",
                      opacity: dragging ? 0.4 : 1,
                      outline: dragOver ? "2px dashed #38bdf8" : "none",
                      cursor: isEditing ? "default" : "grab",
                      transition: "all 0.15s",
                    }}
                  >
                    <span style={{ color: "#475569", fontSize: 12, cursor: "grab" }}>⋮⋮</span>

                    {isEditing ? (
                      <input
                        autoFocus
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") { setEditingId(null); setEditText(""); } }}
                        style={{ ...inp, flex: 1, padding: "6px 8px", fontSize: 12 }}
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(it.id, it.text)}
                        style={{ flex: 1, textAlign: "left", background: "transparent", border: "none", color: "#e2e8f0", fontSize: 12.5, fontWeight: 600, cursor: "text", padding: 0 }}
                      >
                        {it.text}
                      </button>
                    )}

                    <button
                      onClick={() => toggleCategory(it.id)}
                      title="Toggle Must Pass / Good to Check"
                      style={{
                        padding: "4px 7px", borderRadius: 6, fontSize: 9, fontWeight: 800,
                        background: isMust ? "rgba(248,113,113,0.12)" : "rgba(251,191,36,0.12)",
                        color: isMust ? "#f87171" : "#fbbf24",
                        border: `1px solid ${isMust ? "rgba(248,113,113,0.4)" : "rgba(251,191,36,0.4)"}`,
                        cursor: "pointer", letterSpacing: "0.05em",
                      }}>
                      {isMust ? "🔴 MUST" : "🟡 GOOD"}
                    </button>

                    <button
                      onClick={() => deleteItem(it.id)}
                      title="Delete"
                      style={{ padding: "3px 7px", borderRadius: 6, fontSize: 13, color: "#64748b", background: "transparent", border: "none", cursor: "pointer" }}>
                      ×
                    </button>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                onClick={addItem}
                style={{ flex: 1, padding: "10px 12px", borderRadius: 9, background: "rgba(56,189,248,0.10)", color: "#38bdf8", border: "1px dashed rgba(56,189,248,0.45)", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                + Add Item
              </button>
              <button
                onClick={resetDefaults}
                title="Reset to defaults"
                style={{ padding: "10px 12px", borderRadius: 9, background: "transparent", color: "#64748b", border: "1px solid #1a2540", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Reset
              </button>
            </div>

            <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 9, background: "#0d1120", border: "1px solid #1a2035", fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
              <span style={{ color: "#f87171", fontWeight: 800 }}>🔴 Must Pass</span> blocks the trade if NO.
              <br/>
              <span style={{ color: "#fbbf24", fontWeight: 800 }}>🟡 Good to Check</span> shows a warning only.
            </div>
          </section>

          {/* ───── SECTION 2: RUN CHECKLIST ───── */}
          <section style={card}>
            {sectionTitle("#22d3a5", "Ready to trade?")}

            {/* ── PRE-RUN: trade details ── */}
            {!running && !resultRun && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }} className="trade-detail-row">
                  <div>
                    <label style={lbl}>Symbol</label>
                    <input
                      style={inp}
                      value={symbol}
                      onChange={e => setSymbol(e.target.value.toUpperCase())}
                      placeholder="NQ1!, BTC/USD"
                    />
                  </div>
                  <div>
                    <label style={lbl}>Direction</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {(["LONG", "SHORT"] as const).map(d => {
                        const active = direction === d;
                        const color = d === "LONG" ? "#22d3a5" : "#f87171";
                        return (
                          <button
                            key={d}
                            onClick={() => setDirection(d)}
                            style={{
                              flex: 1, padding: "10px 6px", borderRadius: 9, fontSize: 11, fontWeight: 800,
                              background: active ? `${color}1f` : "#0d1120",
                              color: active ? color : "#64748b",
                              border: `1px solid ${active ? color : "#1a2540"}`,
                              cursor: "pointer",
                            }}>
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Entry</label>
                    <input style={inp} type="number" step="any" value={entry} onChange={e => setEntry(e.target.value)} placeholder="0.00"/>
                  </div>
                  <div>
                    <label style={lbl}>Stop</label>
                    <input style={inp} type="number" step="any" value={stop} onChange={e => setStop(e.target.value)} placeholder="0.00"/>
                  </div>
                  <div>
                    <label style={lbl}>Target</label>
                    <input style={inp} type="number" step="any" value={target} onChange={e => setTarget(e.target.value)} placeholder="0.00"/>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
                  <StatTile label="R:R" value={calcs.rr !== null ? `${calcs.rr}R` : "—"} color={calcs.rr !== null && calcs.rr >= 2 ? "#22d3a5" : calcs.rr !== null && calcs.rr >= 1 ? "#fbbf24" : "#64748b"} />
                  <StatTile label="Dollar risk" value={fmtMoney0(calcs.dollarRisk)} color="#fbbf24" />
                  <StatTile label="Contracts" value={calcs.contracts !== null ? String(calcs.contracts) : "—"} color="#38bdf8" />
                </div>

                <button
                  onClick={beginRun}
                  className="pulse"
                  style={{
                    width: "100%", padding: "18px 20px", borderRadius: 14,
                    background: "linear-gradient(135deg, #22d3a5, #16a085)", color: "#031319",
                    border: "none", fontSize: 17, fontWeight: 900, cursor: "pointer",
                    boxShadow: "0 8px 28px rgba(34,211,165,0.35)", letterSpacing: "0.02em",
                  }}>
                  ▶ Run Checklist ({items.length} items)
                </button>

                <p style={{ marginTop: 10, fontSize: 11, color: "#64748b", textAlign: "center" }}>
                  Trade details are optional — but help you stay focused.
                </p>
              </>
            )}

            {/* ── RUNNING: question cards ── */}
            {running && currentItem && (
              <div>
                {/* Progress */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.06em" }}>
                      {stepIndex + 1} / {totalSteps}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>
                      {currentItem.category === "must"
                        ? <span style={{ color: "#f87171" }}>🔴 Must Pass</span>
                        : <span style={{ color: "#fbbf24" }}>🟡 Good to Check</span>}
                    </span>
                  </div>
                  <div style={{ height: 8, background: "#1a2035", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      width: `${Math.round(((stepIndex) / totalSteps) * 100)}%`, height: "100%",
                      background: "linear-gradient(90deg, #22d3a5, #38bdf8)",
                      transition: "width 0.3s ease",
                    }}/>
                  </div>
                </div>

                {/* Question card */}
                <div
                  key={currentItem.id}
                  className="card-enter"
                  style={{
                    background: "linear-gradient(135deg, #0d1628, #0b1120)",
                    border: `2px solid ${currentItem.category === "must" ? "rgba(248,113,113,0.35)" : "rgba(251,191,36,0.30)"}`,
                    borderRadius: 18,
                    padding: "44px 28px",
                    textAlign: "center",
                    minHeight: 240,
                    display: "flex", flexDirection: "column", justifyContent: "center",
                    marginBottom: 16,
                  }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#f0f4ff", lineHeight: 1.35, maxWidth: 560, margin: "0 auto" }}>
                    {currentItem.text}
                  </div>
                </div>

                {/* YES / NO */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <button
                    onClick={() => answer("yes")}
                    className="yesno-btn"
                    style={{
                      padding: "22px 20px", borderRadius: 14,
                      background: "linear-gradient(135deg, #22d3a5, #16a085)",
                      color: "#031319", border: "none",
                      fontSize: 22, fontWeight: 900, cursor: "pointer",
                      boxShadow: "0 6px 20px rgba(34,211,165,0.30)",
                      transition: "transform 0.12s",
                    }}>
                    ✅ YES
                  </button>
                  <button
                    onClick={() => answer("no")}
                    className="yesno-btn"
                    style={{
                      padding: "22px 20px", borderRadius: 14,
                      background: "linear-gradient(135deg, #f87171, #ef4444)",
                      color: "#1a0000", border: "none",
                      fontSize: 22, fontWeight: 900, cursor: "pointer",
                      boxShadow: "0 6px 20px rgba(248,113,113,0.30)",
                      transition: "transform 0.12s",
                    }}>
                    ❌ NO
                  </button>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button onClick={goBack} style={{ padding: "8px 14px", background: "transparent", color: "#64748b", border: "1px solid #1a2540", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    ← Back
                  </button>
                  <button onClick={cancelRun} style={{ padding: "8px 14px", background: "transparent", color: "#64748b", border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* ── RESULT: GO / DON'T ── */}
            {resultRun && (
              <ResultPanel
                run={resultRun}
                onLog={logTrade}
                onSitOut={sitOut}
                onPickFailReason={pickFailReason}
                pickedFailReason={pickedFailReason}
                onRunAgain={() => { setResultRun(null); setAnswers({}); setStepIndex(0); }}
              />
            )}
          </section>
        </div>

        {/* ───── SECTION 3: CHECKLIST STATS ───── */}
        <section style={{ ...card, marginBottom: 40 }}>
          {sectionTitle("#38bdf8", "Checklist Stats")}

          {runs.length === 0 ? (
            <div style={{ background: "#0d1120", border: "1px dashed #1a2540", borderRadius: 12, padding: "36px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>📋</div>
              <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>Run the checklist before your next trade to start tracking discipline.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <StatTile label="Total runs" value={String(stats.total)} color="#e2e8f0" />
              <StatTile label="Pass rate" value={`${stats.passRate}%`} color={stats.passRate >= 70 ? "#22d3a5" : stats.passRate >= 40 ? "#fbbf24" : "#f87171"} />
              <StatTile
                label="Most failed item"
                value={stats.mostFailed ? truncate(stats.mostFailed.text, 24) : "—"}
                color="#f87171"
                sub={stats.mostFailed ? `failed ${stats.mostFailed.count} time${stats.mostFailed.count === 1 ? "" : "s"}` : undefined}
              />
              <StatTile
                label="Trades taken after pass"
                value={String(stats.takenCount)}
                color="#22d3a5"
                sub={stats.takenWinRate !== null ? `Win rate: ${stats.takenWinRate}%` : "No match in trade log"}
              />
              <StatTile
                label="Trades skipped"
                value={String(stats.avoidedBadTrades)}
                color="#fbbf24"
                sub={stats.avoidedBadTrades > 0 ? `Saved you from ${stats.avoidedBadTrades} bad trade${stats.avoidedBadTrades === 1 ? "" : "s"}` : undefined}
              />
            </div>
          )}
        </section>

      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 880px) {
          .checklist-top-grid { grid-template-columns: 1fr !important; }
          .trade-detail-row { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </main>
  );
}

// ───────────────────────── subcomponents ─────────────────────────

function ResultPanel({
  run, onLog, onSitOut, onPickFailReason, pickedFailReason, onRunAgain,
}: {
  run: ChecklistRun;
  onLog: () => void;
  onSitOut: () => void;
  onPickFailReason: (r: string) => void;
  pickedFailReason: string | null;
  onRunAgain: () => void;
}) {
  if (run.passed) {
    return (
      <div className="card-enter" style={{ textAlign: "center" }}>
        <div style={{
          background: "linear-gradient(135deg, rgba(34,211,165,0.18), rgba(34,211,165,0.04))",
          border: "1px solid rgba(34,211,165,0.45)",
          borderRadius: 18, padding: "30px 22px", marginBottom: 16,
        }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🟢</div>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#22d3a5", letterSpacing: "-0.02em" }}>GO FOR IT</h2>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#94a3b8" }}>All Must Pass items checked. You're cleared.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
          {run.symbol && <StatTile label="Symbol" value={run.symbol} color="#e2e8f0" />}
          {run.direction && <StatTile label="Direction" value={run.direction} color={run.direction === "LONG" ? "#22d3a5" : "#f87171"} />}
          {run.entry !== undefined && <StatTile label="Entry" value={String(run.entry)} color="#38bdf8" />}
          {run.stop !== undefined && <StatTile label="Stop" value={String(run.stop)} color="#f87171" />}
          {run.target !== undefined && <StatTile label="Target" value={String(run.target)} color="#22d3a5" />}
          {run.rr !== null && run.rr !== undefined && <StatTile label="R:R" value={`${run.rr}R`} color={run.rr >= 2 ? "#22d3a5" : "#fbbf24"} />}
          {run.dollarRisk !== null && run.dollarRisk !== undefined && <StatTile label="Risk" value={fmtMoney0(run.dollarRisk)} color="#fbbf24" />}
          {run.contracts !== null && run.contracts !== undefined && <StatTile label="Contracts" value={String(run.contracts)} color="#38bdf8" />}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onLog}
            style={{
              flex: 1, padding: "16px 20px", borderRadius: 12,
              background: "linear-gradient(135deg, #22d3a5, #16a085)", color: "#031319",
              border: "none", fontSize: 15, fontWeight: 900, cursor: "pointer",
              boxShadow: "0 6px 20px rgba(34,211,165,0.30)",
            }}>
            📝 Log This Trade
          </button>
          <button
            onClick={onRunAgain}
            style={{ padding: "16px 20px", borderRadius: 12, background: "transparent", color: "#64748b", border: "1px solid #1a2540", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Run Again
          </button>
        </div>
      </div>
    );
  }

  // FAIL
  const failed = run.items.filter(i => i.category === "must" && i.answer === "no");
  return (
    <div className="card-enter" style={{ textAlign: "center" }}>
      <div style={{
        background: "linear-gradient(135deg, rgba(248,113,113,0.18), rgba(248,113,113,0.04))",
        border: "1px solid rgba(248,113,113,0.45)",
        borderRadius: 18, padding: "30px 22px", marginBottom: 16,
      }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🔴</div>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#f87171", letterSpacing: "-0.02em" }}>DON'T TAKE THIS TRADE</h2>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#94a3b8" }}>
          Sit this one out. The market will be here tomorrow — your account might not.
        </p>
      </div>

      {failed.length > 0 && (
        <div style={{ background: "#0d1120", border: "1px solid #1a2035", borderRadius: 12, padding: 14, marginBottom: 14, textAlign: "left" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>What failed</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {failed.map(f => (
              <div key={f.itemId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#e2e8f0" }}>
                <span style={{ color: "#f87171", fontWeight: 800 }}>✗</span>
                {f.text}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: "#0d1120", border: "1px solid #1a2035", borderRadius: 12, padding: 14, marginBottom: 14, textAlign: "left" }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>What went wrong?</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 6 }}>
          {FAIL_REASONS.map(r => {
            const active = pickedFailReason === r;
            return (
              <button
                key={r}
                onClick={() => onPickFailReason(r)}
                style={{
                  padding: "8px 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 700,
                  background: active ? "rgba(248,113,113,0.15)" : "#0b1120",
                  color: active ? "#fca5a5" : "#cbd5e1",
                  border: `1px solid ${active ? "rgba(248,113,113,0.5)" : "#1a2540"}`,
                  cursor: "pointer", textAlign: "left",
                }}>
                {r}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onSitOut}
          style={{
            flex: 1, padding: "16px 20px", borderRadius: 12,
            background: "linear-gradient(135deg, #1e293b, #0f172a)", color: "#e2e8f0",
            border: "1px solid #334155", fontSize: 14, fontWeight: 800, cursor: "pointer",
          }}>
          🧘 Sit this one out
        </button>
        <button
          onClick={onRunAgain}
          style={{ padding: "16px 20px", borderRadius: 12, background: "transparent", color: "#64748b", border: "1px solid #1a2540", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Run Again
        </button>
      </div>
    </div>
  );
}

function StatTile({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div style={cardSm}>
      <div style={{ fontSize: 10, color: "#64748b", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color, fontFamily: "system-ui", lineHeight: 1.2, wordBreak: "break-word" }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 6, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
