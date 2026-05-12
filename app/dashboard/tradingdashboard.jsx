"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  TrendingUp, TrendingDown, Activity, X, BookOpen, AlertCircle,
  Target, Award, ChevronUp, ChevronDown, ChevronsUpDown, Search,
  Plus, Globe, ChevronRight, Edit2, Trash, Users, UserCheck,
  UserMinus, Radio, Repeat2, Sparkles, Wand2, RefreshCw, Upload,
  FileText, Link2, Download, BarChart2, Layers,
  LogOut, User, UserPlus, Eye, EyeOff, FlaskConical,
  Calendar, ArrowUpRight, ArrowDownRight,
  Zap, Shield, Image, Webhook, Wallet, Check, TestTube2, Play,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts";

// ═══════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════

const AUTH_KEY    = "tradedesk_accounts_v1";
const SESSION_KEY = "tradedesk_session_v1";
const COPY_FOLLOWS_KEY = "tradedesk_follows_v1";
const COPY_TRADES_KEY  = (u) => `tradedesk_copytrades_${u}_v1`;

const COMMON_PAIRS = [
  "BTC/USD","ETH/USD","SOL/USD","XRP/USD","BNB/USD","ADA/USD","DOGE/USD","AVAX/USD",
  "EUR/USD","GBP/USD","USD/JPY","AUD/USD","USD/CAD","USD/CHF","NZD/USD","EUR/GBP",
  "AAPL","NVDA","TSLA","MSFT","GOOGL","META","AMZN","SPY","QQQ",
  "ES","NQ","GC","CL","SI","BTC-PERP",
];

// ═══════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════

function accountKey(u) { return `tradedesk_trades_${u}_v1`; }

// ── Screenshot store — IndexedDB so base64 images don't bloat localStorage ──
const _screenshotCache = {};   // in-memory cache to avoid repeated IDB reads

function openScreenshotDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("tradedesk_screenshots", 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore("shots", { keyPath: "id" });
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = () => reject(req.error);
  });
}

async function saveScreenshot(tradeId, dataUrl) {
  if (!dataUrl) return;
  _screenshotCache[tradeId] = dataUrl;
  try {
    const db    = await openScreenshotDB();
    const tx    = db.transaction("shots", "readwrite");
    tx.objectStore("shots").put({ id: tradeId, dataUrl });
  } catch (e) { console.warn("Screenshot save failed:", e); }
}

async function loadScreenshot(tradeId) {
  if (_screenshotCache[tradeId]) return _screenshotCache[tradeId];
  try {
    const db  = await openScreenshotDB();
    const tx  = db.transaction("shots", "readonly");
    const req = tx.objectStore("shots").get(tradeId);
    return await new Promise((res, rej) => {
      req.onsuccess = () => { const v = req.result?.dataUrl ?? null; if (v) _screenshotCache[tradeId] = v; res(v); };
      req.onerror   = () => rej(req.error);
    });
  } catch { return null; }
}

async function deleteScreenshot(tradeId) {
  delete _screenshotCache[tradeId];
  try {
    const db = await openScreenshotDB();
    const tx = db.transaction("shots", "readwrite");
    tx.objectStore("shots").delete(tradeId);
  } catch {}
}

// Strip screenshot from trade before persisting to localStorage.
// The dataUrl is saved separately in IDB; the trade record just keeps
// a flag so we know to load it back on read.
function stripScreenshot(trade) {
  const { screenshot, ...rest } = trade;
  return { ...rest, _hasScreenshot: !!screenshot };
}

function loadUserTrades(username) {
  try {
    const raw = localStorage.getItem(accountKey(username));
    if (raw === null) return null;
    return JSON.parse(raw) ?? [];
  } catch { return null; }
}

function saveUserTrades(username, trades) {
  // Save screenshots to IDB, strip them from the localStorage payload
  trades.forEach(t => {
    if (t.screenshot) saveScreenshot(t.id, t.screenshot);
  });
  const stripped = trades.map(stripScreenshot);
  try {
    localStorage.setItem(accountKey(username), JSON.stringify(stripped));
  } catch (e) {
    // Last resort: if still too big, drop oldest trades' screenshots
    console.error("localStorage quota hit even after stripping — this shouldn't happen:", e);
  }
}

// Rehydrate a single trade's screenshot from IDB (returns promise)
async function rehydrateScreenshot(trade) {
  if (!trade._hasScreenshot) return trade;
  const screenshot = await loadScreenshot(trade.id);
  return { ...trade, screenshot };
}

function computeStats(trades) {
  if (!trades || !trades.length) return { totalTrades:0, wins:0, losses:0, winRate:0, totalPnl:0, bestTrade:0, worstTrade:0, currentStreak:0, avgWin:0, avgLoss:0, profitFactor:0 };
  const sorted  = [...trades].sort((a,b) => a.date - b.date);
  const wins    = sorted.filter(t => (t.pnl ?? 0) > 0);
  const losses  = sorted.filter(t => (t.pnl ?? 0) < 0);
  const totalPnl = +sorted.reduce((s,t) => s + (t.pnl ?? 0), 0).toFixed(4);
  let streak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const w = (sorted[i].pnl ?? 0) > 0;
    if (streak === 0)          streak = w ? 1 : -1;
    else if (streak > 0 && w)  streak++;
    else if (streak < 0 && !w) streak--;
    else break;
  }
  const grossWin  = wins.reduce((s,t) => s + (t.pnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s,t) => s + (t.pnl ?? 0), 0));
  return {
    totalTrades: sorted.length, wins: wins.length, losses: losses.length,
    winRate: +((wins.length / sorted.length) * 100).toFixed(1), totalPnl,
    bestTrade:  wins.length   ? Math.max(...wins.map(t => t.pnl ?? 0))   : 0,
    worstTrade: losses.length ? Math.min(...losses.map(t => t.pnl ?? 0)) : 0,
    currentStreak: streak,
    avgWin:  wins.length   ? +(grossWin/wins.length).toFixed(4)   : 0,
    avgLoss: losses.length ? +(grossLoss/losses.length).toFixed(4) : 0,
    profitFactor: grossLoss > 0 ? +(grossWin/grossLoss).toFixed(2) : grossWin > 0 ? 999 : 0,
  };
}

function buildCumPnl(trades) {
  const sorted = [...trades].sort((a,b) => a.date - b.date);
  let cum = 0;
  return sorted.map(t => ({
    date: t.date, cumPnl: +(cum += (t.pnl ?? 0)).toFixed(4),
    label: new Date(t.date).toLocaleDateString("en-US", { month:"short", day:"numeric" }),
  }));
}

function hashPassword(pw) {
  let h = 0x811c9dc5;
  for (let i = 0; i < pw.length; i++) { h ^= pw.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h.toString(16);
}

// ── Copy trading storage helpers ──────────────────────────────
function loadFollows() {
  try { return JSON.parse(localStorage.getItem(COPY_FOLLOWS_KEY) || "{}"); } catch { return {}; }
}
function saveFollows(d) { localStorage.setItem(COPY_FOLLOWS_KEY, JSON.stringify(d)); }
function loadCopyTrades(u) {
  try { return JSON.parse(localStorage.getItem(COPY_TRADES_KEY(u)) || "[]"); } catch { return []; }
}
function saveCopyTrades(u, t) { localStorage.setItem(COPY_TRADES_KEY(u), JSON.stringify(t)); }

function getAllTraders() {
  try {
    const accounts = JSON.parse(localStorage.getItem(AUTH_KEY) || "{}");
    return Object.entries(accounts).map(([username, acc]) => ({
      username, displayName: acc.displayName, createdAt: acc.createdAt ?? 0,
    }));
  } catch { return []; }
}

function getTraderJournal(u) {
  try { const r = localStorage.getItem(`tradedesk_trades_${u}_v1`); return r ? JSON.parse(r) : []; }
  catch { return []; }
}

function computeTraderStats(username) {
  const trades = getTraderJournal(username);
  if (!trades.length) return { totalTrades:0, winRate:0, totalPnl:0, avgPnl:0 };
  const wins = trades.filter(t => (t.pnl??0)>0).length;
  const totalPnl = +trades.reduce((s,t) => s + (t.pnl ?? 0), 0).toFixed(2);
  return { totalTrades: trades.length, winRate: +((wins/trades.length)*100).toFixed(1), totalPnl, avgPnl: +(totalPnl/trades.length).toFixed(2) };
}

// ═══════════════════════════════════════════════════════════════
//  AUTH HOOK
// ═══════════════════════════════════════════════════════════════

function useAuth() {
  const [session,  setSession]  = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [pendingGoogle, setPendingGoogle] = useState(null);

  useEffect(() => {
    // Check URL hash for Google OAuth token first
    const hash = window.location.hash;
    if (hash.includes("access_token=")) {
      try {
        const params = new URLSearchParams(hash.slice(1));
        const token = params.get("access_token");
        const payload = JSON.parse(atob(token.split(".")[1]));
        const email = payload.email || "";
        const autoUsername = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
        const displayName = payload.user_metadata?.full_name || autoUsername;
        const googleData = { email, displayName, token, autoUsername };
        window.history.replaceState(null, "", "/dashboard");
        // Check if user already has a chosen username
        const existing = localStorage.getItem(`nexyru_google_username_${email}`);
        if (existing) {
          const s = { username: existing, displayName, email, googleAuth: true };
          localStorage.setItem(SESSION_KEY, JSON.stringify(s));
          setSession(s);
        } else {
          setPendingGoogle(googleData);
          setNeedsUsername(true);
        }
        setHydrated(true);
        return;
      } catch(e) { console.error("OAuth parse error", e); }
    }
    // Check existing session
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.googleAuth) { setSession(s); setHydrated(true); return; }
        const accounts = JSON.parse(localStorage.getItem(AUTH_KEY) || "{}");
        if (accounts[s.username]) setSession(s);
      }
    } catch {}
    setHydrated(true);
  }, []);

  const confirmUsername = useCallback((username) => {
    if (!pendingGoogle) return "No Google session found.";
    const u = username.toLowerCase().trim();
    if (!u || u.length < 3) return "Username must be at least 3 characters.";
    if (!/^[a-z0-9_]+$/.test(u)) return "Letters, numbers, underscores only.";
    // Save username mapping for this email
    localStorage.setItem(`nexyru_google_username_${pendingGoogle.email}`, u);
    const s = { username: u, displayName: pendingGoogle.displayName, email: pendingGoogle.email, googleAuth: true };
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    // Trigger demo seeding for new users
    localStorage.setItem(`nexyru_needs_seed_${u}`, "1");
    setSession(s);
    setNeedsUsername(false);
    setPendingGoogle(null);
    return null;
  }, [pendingGoogle]);

  const login = useCallback((username, password) => {
    const accounts = JSON.parse(localStorage.getItem(AUTH_KEY) || "{}");
    const acc = accounts[username.toLowerCase()];
    if (!acc) return "Account not found.";
    if (acc.passwordHash !== hashPassword(password)) return "Incorrect password.";
    const s = { username: username.toLowerCase(), displayName: acc.displayName };
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    setSession(s);
    return null;
  }, []);

  const register = useCallback((username, displayName, password) => {
    const u = username.toLowerCase().trim();
    if (!u || u.length < 3) return "Username must be at least 3 characters.";
    if (!/^[a-z0-9_]+$/.test(u)) return "Username: letters, numbers, underscores only.";
    if (!password || password.length < 4) return "Password must be at least 4 characters.";
    if (!displayName.trim()) return "Display name required.";
    const accounts = JSON.parse(localStorage.getItem(AUTH_KEY) || "{}");
    if (accounts[u]) return "Username already taken.";
    accounts[u] = { displayName: displayName.trim(), passwordHash: hashPassword(password), createdAt: Date.now() };
    localStorage.setItem(AUTH_KEY, JSON.stringify(accounts));
    const s = { username: u, displayName: displayName.trim() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    setSession(s);
    // Mark as new user — seeding happens after account system initializes
    localStorage.setItem(`nexyru_needs_seed_${u}`, "1");
    return null;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }, []);

  return { session, hydrated, needsUsername, pendingGoogle, confirmUsername, login, register, logout };
}

// ═══════════════════════════════════════════════════════════════
//  STARTER EXPERIENCE — Auto-seed demo data for new users
// ═══════════════════════════════════════════════════════════════

const DEMO_FLAG_KEY = "nexyru_demo_mode_v1";
const isDemoMode    = (u) => localStorage.getItem(`${DEMO_FLAG_KEY}_${u}`) === "1";
const setDemoMode   = (u, v) => v
  ? localStorage.setItem(`${DEMO_FLAG_KEY}_${u}`, "1")
  : localStorage.removeItem(`${DEMO_FLAG_KEY}_${u}`);

function generateStarterData(username) {
  const PAIRS      = ["BTC-USD","ETH-USD","NQ1!","ES1!","MNQ1!","MES1!","SOL-USD","GC1!"];
  const STRATEGIES = ["Breakout Momentum","VWAP Reversal","EMA Cross","Support & Resistance","Opening Range"];
  const EMOTIONS   = ["calm","confident","calm","calm","confident","fomo","calm","fear","confident","calm","neutral","confident","calm","fomo"];
  const WIN_NOTES  = [
    "Textbook setup — waited for confirmation before entering",
    "Clean breakout above resistance, held through first pullback",
    "Followed the plan perfectly, took profit at target",
    "Patient entry on the retest, great RR on this one",
    "Strong momentum, sized in properly",
    "Was calm and focused, no hesitation on entry",
  ];
  const LOSS_NOTES = [
    "Entered too early, didn't wait for confirmation",
    "Chased the move after missing the ideal entry",
    "Stopped out, market reversed sharply at open",
    "Should have waited for the retest, got impatient",
    "Sized too big given the setup quality",
    "Revenge traded after previous loss — need to work on this",
    "FOMO entry at the top, learned my lesson",
  ];

  const now    = Date.now();
  const DAY_MS = 86400000;

  function rnd(min, max) { return Math.random() * (max - min) + min; }
  function pick(arr)     { return arr[Math.floor(Math.random() * arr.length)]; }
  function roundTo(n, d) { return parseFloat(n.toFixed(d)); }

  const trades = [];
  const winTargetPct = rnd(0.55, 0.70);
  let wins = 0;

  for (let i = 0; i < 14; i++) {
    const daysAgo    = rnd(0.5, 29);
    const date       = now - daysAgo * DAY_MS;
    const pair       = pick(PAIRS);
    const strategy   = pick(STRATEGIES);
    const type       = Math.random() > 0.45 ? "long" : "short";
    const isCrypto   = pair.includes("USD");
    const basePrice  = isCrypto
      ? pair.includes("BTC") ? rnd(62000, 71000) : pair.includes("ETH") ? rnd(3100, 3800) : rnd(120, 185)
      : pair.includes("NQ") ? rnd(17800, 19200) : pair.includes("ES") ? rnd(5050, 5380) : rnd(1950, 2150);

    const shouldWin  = (wins / (i + 1)) < winTargetPct && Math.random() > 0.3;
    const size       = isCrypto ? roundTo(rnd(0.05, 0.5), 3) : Math.max(1, Math.round(rnd(1, 3)));
    const movePct    = shouldWin ? rnd(0.4, 1.8) : rnd(0.2, 0.9);
    const moveAmt    = basePrice * (movePct / 100);
    const entryPrice = roundTo(basePrice, 2);
    const exitPrice  = shouldWin
      ? roundTo(entryPrice + (type === "long" ? moveAmt : -moveAmt), 2)
      : roundTo(entryPrice + (type === "long" ? -moveAmt : moveAmt), 2);
    const rawPnl     = (type === "long" ? exitPrice - entryPrice : entryPrice - exitPrice) * size;
    const pnl        = roundTo(rawPnl, 2);
    const pnlPct     = roundTo(((exitPrice - entryPrice) / entryPrice * 100) * (type === "long" ? 1 : -1), 3);

    if (pnl > 0) wins++;

    // Psychology data
    const emotion      = shouldWin ? pick(["calm","calm","confident","confident","neutral"]) : pick(["fomo","fear","calm","neutral","calm"]);
    const confidence   = shouldWin ? Math.round(rnd(6, 9)) : Math.round(rnd(3, 7));
    const rulesFollowed= shouldWin ? Math.random() > 0.15 : Math.random() > 0.6;
    const notes        = shouldWin ? pick(WIN_NOTES) : pick(LOSS_NOTES);

    trades.push({
      id:          `demo_${i}_${Date.now()}`,
      pair, symbol: pair.replace("/","").replace("1!","").replace("-",""),
      type, entryPrice, exitPrice, size,
      date:        date - rnd(0, 8 * 3600000),
      strategy,
      notes,
      emotion,
      confidence,
      rulesFollowed,
      stopLoss:    roundTo(entryPrice * (type === "long" ? 0.993 : 1.007), 2),
      takeProfit:  roundTo(entryPrice * (type === "long" ? 1.018 : 0.982), 2),
      tags:        ["Demo"],
      source:      "demo",
      pnl, pnlPct,
      accountId:   null,
    });
  }

  trades.sort((a, b) => a.date - b.date);
  return trades;
}

function seedStarterData(username) {
  if (isDemoMode(username)) return;
  const existing = loadUserTrades(username);
  if (existing.length > 0) return;

  // Get or create default account first
  let accts = loadPaperAccounts(username);
  if (!accts || accts.length === 0) {
    const def = makeDefaultAccount();
    savePaperAccounts(username, [def]);
    saveActiveAccountId(username, def.id);
    accts = [def];
  }

  const accountId = accts[0].id;
  const trades = generateStarterData(username).map(t => ({ ...t, accountId }));
  saveUserTrades(username, trades);
  setDemoMode(username, true);
}

// ── Demo mode banner with toggle ──────────────────────────────
function DemoBanner({ username, onClear }) {
  const [demo, setDemo]       = useState(false);
  const [confirming, setConf] = useState(false);

  useEffect(() => {
    // Only show demo banner if flag is explicitly set AND trades are all demo
    const flagSet = isDemoMode(username);
    if (!flagSet) { setDemo(false); return; }
    try {
      const trades = JSON.parse(localStorage.getItem(`tradedesk_trades_${username}_v1`) ?? "[]");
      if (trades.length > 0 && trades.every(t => t.source === "demo")) {
        setDemo(true);
      } else {
        setDemo(false);
      }
    } catch { setDemo(false); }
  }, [username]);

  if (!demo) return null;

  const handleConfirm = () => {
    onClear();
    setDemo(false);
    setConf(false);
  };

  return (
    <div style={{ padding:"14px 18px", borderRadius:14, background:"linear-gradient(135deg,rgba(251,191,36,0.07),rgba(249,115,22,0.05))", border:"1px solid rgba(251,191,36,0.25)", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, flex:1, minWidth:200 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:"rgba(251,191,36,0.12)", border:"1px solid rgba(251,191,36,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>🎮</div>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:3 }}>
            <span style={{ fontSize:12, fontWeight:800, color:"#fbbf24" }}>Demo Mode</span>
            <span style={{ fontSize:9, fontWeight:700, padding:"1px 7px", borderRadius:10, background:"rgba(251,191,36,0.15)", border:"1px solid rgba(251,191,36,0.25)", color:"#fbbf24" }}>SAMPLE DATA</span>
          </div>
          <div style={{ fontSize:11, color:"#64748b" }}>
            {confirming ? "⚠️ This will delete all demo trades. Are you sure?" : "You're viewing sample trades. Switch to real mode when ready to log your own."}
          </div>
        </div>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        {!confirming ? (
          <>
            <span style={{ fontSize:11, color:"#64748b" }}>Demo</span>
            <div onClick={() => setConf(true)} style={{ width:44, height:24, borderRadius:12, background:"rgba(251,191,36,0.15)", border:"1px solid rgba(251,191,36,0.3)", cursor:"pointer", position:"relative" }}>
              <div style={{ position:"absolute", top:3, left:3, width:16, height:16, borderRadius:"50%", background:"#fbbf24", boxShadow:"0 0 8px rgba(251,191,36,0.4)" }}/>
            </div>
            <span style={{ fontSize:11, color:"#475569" }}>Real</span>
          </>
        ) : (
          <>
            <button onClick={handleConfirm} style={{ padding:"6px 14px", borderRadius:8, border:"none", background:"linear-gradient(135deg,#0ea5a0,#34d399)", color:"#000", fontSize:11, fontWeight:800, cursor:"pointer" }}>
              ✓ Yes, switch to real
            </button>
            <button onClick={() => setConf(false)} style={{ padding:"6px 12px", borderRadius:8, border:"1px solid #1a2035", background:"transparent", color:"#475569", fontSize:11, cursor:"pointer" }}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  COPY TRADING HOOK
// ═══════════════════════════════════════════════════════════════

function useCopyTrading(username) {
  const [follows, setFollows] = useState(() => {
    const all = loadFollows(); return all[username]?.following ?? [];
  });

  const persist = useCallback((next) => {
    const all = loadFollows(); all[username] = { following: next }; saveFollows(all);
  }, [username]);

  const follow = useCallback((trader, multiplier = 1) => {
    setFollows(prev => {
      if (prev.find(f => f.trader === trader)) return prev;
      const next = [...prev, { trader, multiplier, since: Date.now() }];
      persist(next); return next;
    });
  }, [persist]);

  const unfollow = useCallback((trader) => {
    setFollows(prev => { const next = prev.filter(f => f.trader !== trader); persist(next); return next; });
  }, [persist]);

  const setMultiplier = useCallback((trader, multiplier) => {
    setFollows(prev => { const next = prev.map(f => f.trader === trader ? { ...f, multiplier } : f); persist(next); return next; });
  }, [persist]);

  const isFollowing = useCallback((trader) => follows.some(f => f.trader === trader), [follows]);

  const broadcastTrade = useCallback((trade) => {
    if (!username) return;
    const allFollows = loadFollows();
    Object.entries(allFollows).forEach(([follower, data]) => {
      if (follower === username) return;
      const rel = (data.following ?? []).find(f => f.trader === username);
      if (!rel) return;
      const existing = loadCopyTrades(follower);
      saveCopyTrades(follower, [...existing, {
        ...trade, id: `copy_${trade.id}_${follower}`, copiedFrom: username,
        size: +(trade.size * (rel.multiplier ?? 1)).toFixed(4), multiplier: rel.multiplier ?? 1,
      }]);
    });
  }, [username]);

  const [pendingCopies, setPendingCopies] = useState([]);
  useEffect(() => {
    const check = () => {
      const copies = loadCopyTrades(username);
      if (copies.length) { setPendingCopies(copies); saveCopyTrades(username, []); }
    };
    check();
    const id = setInterval(check, 3000);
    return () => clearInterval(id);
  }, [username]);

  return { follows, follow, unfollow, setMultiplier, isFollowing, broadcastTrade, pendingCopies };
}

// ═══════════════════════════════════════════════════════════════
//  AUTH SCREEN
// ═══════════════════════════════════════════════════════════════

function AuthScreen({ auth }) {
  const [mode,        setMode]        = useState("login");
  const [username,    setUsername]    = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password,    setPassword]    = useState("");
  const [showPw,      setShowPw]      = useState(false);
  const [err,         setErr]         = useState("");

  const submit = () => {
    setErr("");
    const e = mode === "login"
      ? auth.login(username, password)
      : auth.register(username, displayName, password);
    if (e) setErr(e);
  };

  const inp = {
    width:"100%", padding:"11px 14px", borderRadius:10,
    background:"#111827", border:"1px solid #1e2d3e",
    fontSize:13, color:"#e2e8f0", outline:"none", boxSizing:"border-box",
  };

  return (
    <div style={{ minHeight:"100vh", background:"#080c18", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ width:"100%", maxWidth:380 }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:52, height:52, borderRadius:16, background:"linear-gradient(135deg,#0369a1,#38bdf8)", marginBottom:16 }}>
            <BookOpen size={24} style={{ color:"#fff" }}/>
          </div>
          <div style={{ fontSize:24, fontWeight:800, color:"#f1f5f9" }}>Nexyru</div>
          <div style={{ fontSize:12, color:"#475569", marginTop:4 }}>Trading Journal · Strategy · Copy Trading</div>
        </div>
        <div style={{ background:"#0d1120", borderRadius:16, border:"1px solid #1a2035", padding:"28px" }}>
          <div style={{ display:"flex", borderRadius:8, background:"#111827", padding:3, marginBottom:24, gap:3 }}>
            {[["login","Sign In"],["register","Create Account"]].map(([m,label]) => (
              <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{ flex:1, padding:"8px", borderRadius:6, border:"none", background: mode===m?"#1e3a52":"transparent", color: mode===m?"#38bdf8":"#64748b", fontSize:12, fontWeight:600, cursor:"pointer" }}>{label}</button>
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <label style={{ display:"block", fontSize:10, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Username</label>
              <div style={{ position:"relative" }}>
                <User size={14} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#475569" }}/>
                <input style={{ ...inp, paddingLeft:36 }} placeholder="username" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key==="Enter" && submit()}/>
              </div>
            </div>
            {mode === "register" && (
              <div>
                <label style={{ display:"block", fontSize:10, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Display Name</label>
                <input style={inp} placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} onKeyDown={e => e.key==="Enter" && submit()}/>
              </div>
            )}
            <div>
              <label style={{ display:"block", fontSize:10, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Password</label>
              <div style={{ position:"relative" }}>
                {showPw
                  ? <Eye size={14} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", color:"#475569", cursor:"pointer" }} onClick={() => setShowPw(false)}/>
                  : <EyeOff size={14} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", color:"#475569", cursor:"pointer" }} onClick={() => setShowPw(true)}/>}
                <input type={showPw?"text":"password"} style={{ ...inp, paddingRight:36 }} placeholder="••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==="Enter" && submit()}/>
              </div>
            </div>
          </div>
          {err && <div style={{ marginTop:12, padding:"9px 12px", borderRadius:8, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", fontSize:12, color:"#f87171", display:"flex", alignItems:"center", gap:7 }}><AlertCircle size={13}/>{err}</div>}
          <button onClick={submit} style={{ width:"100%", marginTop:20, padding:"12px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#0369a1,#38bdf8)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 20px rgba(56,189,248,0.25)" }}>
            {mode==="login" ? "Sign In" : "Create Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  STAT CARD
// ═══════════════════════════════════════════════════════════════

function StatCard({ label, value, sub, pos, icon }) {
  const accent = pos === true ? "#34d399" : pos === false ? "#f87171" : "#38bdf8";
  const border = pos === true ? "rgba(16,185,129,0.2)" : pos === false ? "rgba(239,68,68,0.2)" : "rgba(51,65,85,0.6)";
  return (
    <div style={{ borderRadius:12, border:`1px solid ${border}`, background:"rgba(15,23,42,0.85)", padding:"14px 16px" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:10 }}>
        <span style={{ fontSize:9, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.08em" }}>{label}</span>
        <span style={{ color:accent, opacity:0.7 }}>{icon}</span>
      </div>
      <div style={{ fontSize:22, fontWeight:800, fontFamily:"monospace", color:accent, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:"#64748b", marginTop:6 }}>{sub}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TRADE FORM  — Manual Trade Entry
// ═══════════════════════════════════════════════════════════════

function TradeForm({ onSave, onClose, initial, strategies }) {
  const blank = {
    pair:"BTC/USD", type:"long", entryPrice:"", exitPrice:"",
    stopLoss:"", takeProfit:"", size:"1",
    date: new Date().toISOString().slice(0,16),
    strategy:"", tags:"", notes:"", screenshot:null, source:"manual",
  };
  const [f, setF] = useState(initial ? {
    ...blank, ...initial,
    date: initial.date ? new Date(initial.date).toISOString().slice(0,16) : blank.date,
    tags: (initial.tags ?? []).join(", "),
  } : blank);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);

  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  const pnl = useMemo(() => {
    const entry = parseFloat(f.entryPrice), exit = parseFloat(f.exitPrice), size = parseFloat(f.size) || 1;
    if (!entry || !exit) return null;
    const raw = f.type === "long" ? (exit - entry) * size : (entry - exit) * size;
    const pct = (exit - entry) / entry * 100 * (f.type === "long" ? 1 : -1);
    return { pnl: +raw.toFixed(4), pct: +pct.toFixed(3) };
  }, [f.entryPrice, f.exitPrice, f.type, f.size]);

  const [draggingOver, setDraggingOver] = useState(false);

  const loadImageFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => set("screenshot", ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleImage = (e) => loadImageFile(e.target.files?.[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDraggingOver(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file) { loadImageFile(file); return; }
    // Also handle dragging an image element from browser
    const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (url && /^https?:\/\/.+\.(png|jpe?g|gif|webp|bmp)(\?.*)?$/i.test(url)) {
      set("screenshot", url);
    }
  };

  // Paste from clipboard anywhere while form is open
  useEffect(() => {
    const onPaste = (e) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const img = items.find(item => item.type.startsWith("image/"));
      if (img) { loadImageFile(img.getAsFile()); }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (!f.pair.trim())  return setErr("Pair is required.");
    if (!f.entryPrice)   return setErr("Entry price is required.");
    if (!f.exitPrice)    return setErr("Exit price is required.");
    setErr("");
    onSave({
      id: initial?.id ?? `trade_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      pair: f.pair.trim(), symbol: f.pair.trim().replace("/",""),
      type: f.type,
      entryPrice: parseFloat(f.entryPrice), exitPrice: parseFloat(f.exitPrice),
      stopLoss:   f.stopLoss   ? parseFloat(f.stopLoss)   : null,
      takeProfit: f.takeProfit ? parseFloat(f.takeProfit) : null,
      size: parseFloat(f.size) || 1,
      date: new Date(f.date).getTime() || Date.now(),
      strategy:   f.strategy || "Untagged",
      tags:       f.tags ? f.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      notes:      f.notes, screenshot: f.screenshot ?? null,
      source:     f.source ?? "manual", confidence: 3,
      pnl:        pnl?.pnl ?? 0, pnlPercent: pnl?.pct ?? 0,
    });
  };

  const inp = { width:"100%", padding:"9px 12px", borderRadius:8, boxSizing:"border-box", background:"#111827", border:"1px solid #1e2d3e", fontSize:12, color:"#e2e8f0", outline:"none" };
  const lbl = { display:"block", fontSize:10, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 };
  const row = { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:80, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)" }}/>
      <div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:560, borderRadius:16, border:"1px solid #1a2035", background:"#0d1120", boxShadow:"0 25px 60px rgba(0,0,0,0.6)", maxHeight:"92vh", overflowY:"auto" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid #1a2035", position:"sticky", top:0, background:"#0d1120", zIndex:1 }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#e2e8f0", display:"flex", alignItems:"center", gap:8 }}>
            <Zap size={15} style={{ color:"#38bdf8" }}/>{initial ? "Edit Trade" : "Log a Trade"}
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer" }}><X size={16}/></button>
        </div>
        <div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:16 }}>
          <div style={row}>
            <div>
              <label style={lbl}>Pair / Instrument</label>
              <input list="pairs-list" style={inp} value={f.pair} onChange={e => set("pair", e.target.value)} placeholder="BTC/USD"/>
              <datalist id="pairs-list">{COMMON_PAIRS.map(p => <option key={p} value={p}/>)}</datalist>
            </div>
            <div>
              <label style={lbl}>Direction</label>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                {["long","short"].map(t => (
                  <button key={t} onClick={() => set("type", t)} style={{ padding:"9px 0", borderRadius:8, border:`1px solid ${f.type===t?(t==="long"?"rgba(16,185,129,0.5)":"rgba(239,68,68,0.5)"):"#1e2d3e"}`, background: f.type===t?(t==="long"?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.12)"):"transparent", color: f.type===t?(t==="long"?"#34d399":"#f87171"):"#64748b", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                    {t==="long" ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>}{t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={row}>
            <div><label style={lbl}>Entry Price *</label><input type="number" style={inp} value={f.entryPrice} onChange={e => set("entryPrice", e.target.value)} placeholder="e.g. 96500"/></div>
            <div><label style={lbl}>Exit Price *</label><input type="number" style={inp} value={f.exitPrice} onChange={e => set("exitPrice", e.target.value)} placeholder="e.g. 98200"/></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <div><label style={lbl}>Stop Loss</label><input type="number" style={inp} value={f.stopLoss} onChange={e => set("stopLoss", e.target.value)} placeholder="—"/></div>
            <div><label style={lbl}>Take Profit</label><input type="number" style={inp} value={f.takeProfit} onChange={e => set("takeProfit", e.target.value)} placeholder="—"/></div>
            <div><label style={lbl}>Size / Lots</label><input type="number" style={inp} value={f.size} onChange={e => set("size", e.target.value)} placeholder="1"/></div>
          </div>
          {pnl !== null && (
            <div style={{ padding:"10px 14px", borderRadius:8, background: pnl.pnl>=0?"rgba(16,185,129,0.08)":"rgba(239,68,68,0.08)", border:`1px solid ${pnl.pnl>=0?"rgba(16,185,129,0.25)":"rgba(239,68,68,0.25)"}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontSize:11, color:"#64748b" }}>Calculated PnL</span>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <span style={{ fontSize:14, fontWeight:800, fontFamily:"monospace", color: pnl.pnl>=0?"#34d399":"#f87171" }}>{pnl.pnl>=0?"+":""}{pnl.pnl.toFixed(4)}</span>
                <span style={{ fontSize:11, fontFamily:"monospace", color: pnl.pnl>=0?"#34d399":"#f87171" }}>{pnl.pct>=0?"+":""}{pnl.pct.toFixed(3)}%</span>
              </div>
            </div>
          )}
          <div style={row}>
            <div><label style={lbl}>Trade Date</label><input type="datetime-local" style={inp} value={f.date} onChange={e => set("date", e.target.value)}/></div>
            <div>
              <label style={lbl}>Strategy</label>
              <input list="strats-list" style={inp} value={f.strategy} onChange={e => set("strategy", e.target.value)} placeholder="e.g. Breakout"/>
              <datalist id="strats-list">{(strategies ?? []).map(s => <option key={s} value={s}/>)}</datalist>
            </div>
          </div>
          <div><label style={lbl}>Tags <span style={{ fontWeight:400, textTransform:"none" }}>(comma separated)</span></label><input style={inp} value={f.tags} onChange={e => set("tags", e.target.value)} placeholder="With Trend, FOMO, Clean Setup..."/></div>
          <div><label style={lbl}>Notes</label><textarea style={{ ...inp, resize:"vertical", minHeight:72, fontFamily:"inherit", lineHeight:1.5 }} value={f.notes} onChange={e => set("notes", e.target.value)} placeholder="What happened? Why did you take this trade?"/></div>
          <div>
            <label style={lbl}>Chart Screenshot</label>
            <div
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDraggingOver(true); }}
              onDragEnter={e => { e.preventDefault(); setDraggingOver(true); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDraggingOver(false); }}
              style={{
                padding: f.screenshot ? "8px" : "20px 16px",
                borderRadius: 8, cursor: "pointer", textAlign: "center",
                border: `2px dashed ${draggingOver ? "#38bdf8" : f.screenshot ? "#1e2d3e" : "#1e2d3e"}`,
                background: draggingOver ? "rgba(56,189,248,0.06)" : "#111827",
                transition: "all 0.15s",
                position: "relative",
              }}
            >
              {f.screenshot ? (
                <div style={{ position: "relative" }}>
                  <img src={f.screenshot} alt="screenshot" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 6, objectFit: "contain", display: "block" }}/>
                  {/* Drag-over overlay when already has image */}
                  {draggingOver && (
                    <div style={{ position: "absolute", inset: 0, borderRadius: 6, background: "rgba(56,189,248,0.15)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed #38bdf8" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8" }}>Drop to replace</span>
                    </div>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); set("screenshot", null); }}
                    style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}
                  >
                    <X size={12}/>
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: draggingOver ? "rgba(56,189,248,0.15)" : "#1a2035", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                    <Image size={18} style={{ color: draggingOver ? "#38bdf8" : "#475569" }}/>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: draggingOver ? "#38bdf8" : "#64748b" }}>
                      {draggingOver ? "Drop image here" : "Drop image, click to browse, or ⌘V to paste"}
                    </div>
                    <div style={{ fontSize: 10, color: "#334155", marginTop: 3 }}>PNG, JPG, GIF, WebP</div>
                  </div>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImage}/>
          </div>
          {err && <div style={{ padding:"9px 12px", borderRadius:8, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", fontSize:12, color:"#f87171", display:"flex", alignItems:"center", gap:7 }}><AlertCircle size={12}/>{err}</div>}

          <div style={{ display:"flex", gap:10, paddingTop:4 }}>
            <button onClick={onClose} style={{ flex:1, padding:"11px", borderRadius:10, border:"1px solid #1e2d3e", background:"transparent", color:"#64748b", fontSize:13, fontWeight:600, cursor:"pointer" }}>Cancel</button>
            <button onClick={submit} style={{ flex:2, padding:"11px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#0369a1,#38bdf8)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 16px rgba(56,189,248,0.25)" }}>
              {initial ? "Save Changes" : "Log Trade"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  CSV UPLOADER

// ── Reconstruction wrapper ─────────────────────────────────────
function parseAndReconstructCSV(text) {
  const result = parseCSV(text);
  const { trades, broker } = result;

  const lines = text.trim().split("\n");
  const headers = (lines[0] ?? "").split(",").map(h => h.trim().replace(/^"|"$/g,"").toLowerCase());
  const isExecution = headers.some(h => ["filledprice","boughtprice","transacttime","filltime"].some(k => h.includes(k)));

  if (!isExecution) {
    return { trades, broker, isExecution: false, stats: { totalRows: trades.length, parsed: trades.length, reconstructed: trades.length, scaleIns: 0, scaleOuts: 0 } };
  }

  // Execution-level fills — reconstruct into complete trades
  const reconstructed = reconstructTradesFromFills(trades);
  return {
    trades: reconstructed, broker, isExecution: true,
    stats: { totalRows: trades.length, parsed: trades.length, reconstructed: reconstructed.length,
      scaleIns:  reconstructed.filter(t => t.tags?.includes("Scale-In")).length,
      scaleOuts: reconstructed.filter(t => t.tags?.includes("Scale-Out")).length },
  };
}

function reconstructTradesFromFills(fills) {
  const bySymbol = {};
  fills.forEach(f => { if (!bySymbol[f.pair]) bySymbol[f.pair] = []; bySymbol[f.pair].push(f); });
  const trades = [];
  for (const [, symFills] of Object.entries(bySymbol)) {
    const sorted = [...symFills].sort((a, b) => a.date - b.date);
    let open = null;
    for (const fill of sorted) {
      const isBuy = fill.type === "long";
      if (!open) { open = { direction: fill.type, fills: [fill], qty: fill.size, wpx: fill.entryPrice * fill.size }; continue; }
      const adding = (open.direction === "long" && isBuy) || (open.direction === "short" && !isBuy);
      if (adding) { open.fills.push(fill); open.qty += fill.size; open.wpx += fill.entryPrice * fill.size; }
      else {
        const avgEntry = open.wpx / open.qty;
        const avgExit  = fill.entryPrice || 0;
        const closeQty = Math.min(fill.size, open.qty);
        const grossPnl = open.direction === "long" ? (avgExit - avgEntry) * closeQty : (avgEntry - avgExit) * closeQty;
        const tags = ["Reconstructed", ...(open.fills.length > 1 ? ["Scale-In"] : [])];
        trades.push({ ...open.fills[0], id: `rec_${open.fills[0].date}_${Math.random().toString(36).slice(2,5)}`,
          type: open.direction, entryPrice: +avgEntry.toFixed(5), exitPrice: +avgExit.toFixed(5), size: closeQty,
          pnl: +grossPnl.toFixed(4), pnlPercent: avgEntry > 0 ? +((avgExit-avgEntry)/avgEntry*100*(open.direction==="long"?1:-1)).toFixed(3) : 0,
          source: "broker_import", tags,
          notes: `${open.fills.length > 1 ? `Scale-in: ${open.fills.length} entries · ` : ""}Hold: ${Math.round((fill.date - open.fills[0].date)/60000)}m`,
        });
        if (open.qty - closeQty < 0.0001) open = null;
        else { open.qty -= closeQty; open.wpx -= avgEntry * closeQty; }
      }
    }
    if (open) trades.push({ ...open.fills[0], id: `rec_open_${Date.now()}`, tags: ["Open Position", "Reconstructed"], source: "broker_import" });
  }
  return trades;
}
// ═══════════════════════════════════════════════════════════════

// ── Broker CSV format detection ────────────────────────────────
const BROKER_SIGNATURES = {
  tradovate: {
    name: "Tradovate",
    detect: (headers) => headers.some(h => /orderId|contractName|boughtPrice|soldPrice/i.test(h)),
    fieldMap: {
      pair:       ["contractName","Contract","symbol"],
      type:       ["action","side","type"],
      entryPrice: ["boughtPrice","entryPrice","fillPrice"],
      exitPrice:  ["soldPrice","exitPrice","closePrice"],
      size:       ["qty","quantity","contractQty"],
      date:       ["transactTime","fillTime","timestamp","date"],
      pnl:        ["pnl","realizedPnl","profit"],
    },
  },
  apex: {
    name: "Apex Trader Funding",
    detect: (headers) => headers.some(h => /TradeDate|OpenPrice|ClosePrice|NetProfit/i.test(h)),
    fieldMap: {
      pair:       ["Symbol","Instrument","Contract"],
      type:       ["TradeType","Side","Direction","B/S"],
      entryPrice: ["OpenPrice","EntryPrice","AvgEntryPrice"],
      exitPrice:  ["ClosePrice","ExitPrice","AvgExitPrice"],
      size:       ["Qty","Quantity","Size","Volume"],
      date:       ["TradeDate","Date","OpenTime"],
      pnl:        ["NetProfit","P&L","PnL","Profit"],
    },
  },
  topstepx: {
    name: "TopstepX",
    detect: (headers) => headers.some(h => /OpenTime|CloseTime|OpenPrice|ClosePrice/i.test(h)) && headers.some(h => /Commissions/i.test(h)),
    fieldMap: {
      pair:       ["Symbol","Contract","Instrument"],
      type:       ["Side","Direction","BuySell"],
      entryPrice: ["OpenPrice","EntryPrice"],
      exitPrice:  ["ClosePrice","ExitPrice"],
      size:       ["Quantity","Size","Qty"],
      date:       ["OpenTime","Date","TradeDate"],
      pnl:        ["NetP&L","PnL","Profit","NetProfit"],
    },
  },
  ninjatrader: {
    name: "NinjaTrader",
    detect: (headers) => headers.some(h => /Entry time|Exit time|Entry price|Exit price/i.test(h)),
    fieldMap: {
      pair:       ["Instrument","Symbol","Market"],
      type:       ["Market pos.","Side","Direction","Action"],
      entryPrice: ["Entry price","EntryPrice","Open"],
      exitPrice:  ["Exit price","ExitPrice","Close"],
      size:       ["Quantity","Qty","Size"],
      date:       ["Entry time","EntryTime","Date"],
      pnl:        ["Profit","P&L","PnL","Net profit"],
    },
  },
  tradelocker: {
    name: "TradeLocker",
    detect: (headers) => headers.some(h => /openPrice|closePrice|tradeType/i.test(h)),
    fieldMap: {
      pair:       ["symbol","instrument","pair"],
      type:       ["tradeType","side","direction"],
      entryPrice: ["openPrice","entryPrice"],
      exitPrice:  ["closePrice","exitPrice"],
      size:       ["volume","size","quantity","lots"],
      date:       ["openTime","date","timestamp"],
      pnl:        ["profit","pnl","netProfit"],
    },
  },
  ibkr: {
    name: "Interactive Brokers",
    detect: (headers) => headers.some(h => /Realized P\/L|T\. Price|Open Price/i.test(h)) || headers.some(h => /DataDiscriminator|Asset Category/i.test(h)),
    fieldMap: {
      pair:       ["Symbol","Instrument","Description"],
      type:       ["Buy/Sell","Action","Side"],
      entryPrice: ["T. Price","TradePrice","Open Price"],
      exitPrice:  ["Close Price","ExitPrice","Proceeds"],
      size:       ["Quantity","Qty","Size"],
      date:       ["Date/Time","TradeDate","Date"],
      pnl:        ["Realized P/L","PnL","Profit"],
    },
  },
};

function detectBroker(headers) {
  const normalised = headers.map(h => h.trim());
  for (const [key, broker] of Object.entries(BROKER_SIGNATURES)) {
    if (broker.detect(normalised)) return { key, ...broker };
  }
  return null;
}

const CSV_FIELD_MAP = {
  pair:       ["pair","symbol","instrument","market","ticker","asset"],
  type:       ["type","direction","side","position","action"],
  entryPrice: ["entry","entry_price","entryprice","open","open_price","buy"],
  exitPrice:  ["exit","exit_price","exitprice","close","close_price","sell"],
  stopLoss:   ["sl","stop","stop_loss","stoploss"],
  takeProfit: ["tp","take_profit","takeprofit","target"],
  size:       ["size","lots","quantity","volume","qty"],
  date:       ["date","datetime","time","timestamp","open_time","entry_date"],
  strategy:   ["strategy","setup","pattern","system"],
  notes:      ["notes","comment","comments","reason"],
  pnl:        ["pnl","profit","profit_loss","p&l","result"],
};

function parseCSVRow(row, headers, brokerFieldMap = null) {
  const obj = {};
  headers.forEach((h, i) => { obj[h.toLowerCase().replace(/[\s_\-\.\/]+/g,"_")] = row[i]?.trim() ?? ""; });

  // Use broker-specific field map if detected, otherwise fall back to generic
  const fieldMap = brokerFieldMap ?? CSV_FIELD_MAP;
  const get = (keys) => {
    if (!keys) return "";
    for (const k of keys) {
      const v = obj[k.toLowerCase().replace(/[\s_\-\.\/]+/g,"_")];
      if (v) return v;
    }
    return "";
  };

  const pair       = get(fieldMap.pair) || "UNKNOWN";
  const typeRaw    = get(fieldMap.type).toLowerCase();
  const type       = typeRaw.includes("short") || typeRaw.includes("sell") || typeRaw.includes("s") && typeRaw.length === 1 ? "short" : "long";
  const entryPrice = parseFloat(get(fieldMap.entryPrice)) || 0;
  const exitPrice  = parseFloat(get(fieldMap.exitPrice))  || 0;
  const size       = parseFloat(get(fieldMap.size ?? CSV_FIELD_MAP.size)) || 1;
  const dateRaw    = get(fieldMap.date ?? CSV_FIELD_MAP.date);
  const date       = dateRaw ? (new Date(dateRaw).getTime() || Date.now()) : Date.now();
  const strategy   = get(fieldMap.strategy ?? CSV_FIELD_MAP.strategy) || "Broker Import";
  const notes      = get(fieldMap.notes ?? CSV_FIELD_MAP.notes);
  const rawPnl     = parseFloat(get(fieldMap.pnl ?? CSV_FIELD_MAP.pnl));
  const calcPnl    = !isNaN(rawPnl) && rawPnl !== 0 ? rawPnl
    : entryPrice && exitPrice ? (type==="long"?(exitPrice-entryPrice)*size:(entryPrice-exitPrice)*size) : 0;
  const pnlPercent = entryPrice ? ((exitPrice-entryPrice)/entryPrice*100*(type==="long"?1:-1)) : 0;

  return {
    id: `csv_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    pair, symbol: pair.replace("/",""), type, entryPrice, exitPrice, size, date, strategy, notes,
    stopLoss:null, takeProfit:null, tags:["Imported"], screenshot:null, confidence:3,
    source: brokerFieldMap ? "broker_import" : "csv",
    pnl:+calcPnl.toFixed(4), pnlPercent:+pnlPercent.toFixed(3),
  };
}

function parseCSV(text) {
  const lines = text.trim().split("\n").map(l => l.split(","));
  if (lines.length < 2) return { trades: [], broker: null };
  const headers = lines[0].map(h => h.trim().replace(/^"|"$/g,""));

  // Detect broker
  const broker = detectBroker(headers);
  const fieldMap = broker ? broker.fieldMap : null;

  const trades = lines.slice(1)
    .map(row => row.map(c => c.trim().replace(/^"|"$/g,"")))
    .filter(row => row.some(c => c.length > 0))
    .map(row => parseCSVRow(row, headers, fieldMap))
    .filter(t => t.pair && t.pair !== "UNKNOWN");

  return { trades, broker };
}

function CSVUploader({ onImport, onClose }) {
  const [preview,   setPreview]   = useState(null);
  const [broker,    setBroker]    = useState(null);
  const [shots,     setShots]     = useState({});
  const [step,      setStep]      = useState("csv");
  const [error,     setError]     = useState("");
  const [dragIdx,   setDragIdx]   = useState(null);
  const fileRef   = useRef(null);
  const imgRefs   = useRef({});

  const handleFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const { trades, broker: detectedBroker, isExecution, stats } = parseAndReconstructCSV(text);
        if (!trades.length) { setError("No valid trades found. Check your CSV columns."); return; }
        setPreview(trades);
        setBroker(detectedBroker);
        setShots({}); setError("");
        // Show reconstruction info if execution-level data
        if (isExecution && stats.reconstructed < stats.totalRows) {
          console.log(`[Nexyru] Reconstructed ${stats.reconstructed} trades from ${stats.totalRows} raw fills`);
        }
      } catch (err) { setError("Failed to parse CSV: " + err.message); }
    };
    reader.readAsText(file);
  };

  const loadShot = (tradeId, file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => setShots(prev => ({ ...prev, [tradeId]: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const handleImgInput = (tradeId, e) => loadShot(tradeId, e.target.files?.[0]);

  const handleRowDrop = (tradeId, e) => {
    e.preventDefault(); setDragIdx(null);
    const file = e.dataTransfer.files?.[0];
    if (file) { loadShot(tradeId, file); return; }
    const url = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
    if (url && /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(url)) {
      setShots(prev => ({ ...prev, [tradeId]: url }));
    }
  };

  useEffect(() => {
    if (step !== "screenshots" || !preview) return;
    const onPaste = (e) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const img = items.find(item => item.type.startsWith("image/"));
      if (!img) return;
      const firstEmpty = preview.find(t => !shots[t.id]);
      if (firstEmpty) loadShot(firstEmpty.id, img.getAsFile());
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [step, preview, shots]); // eslint-disable-line react-hooks/exhaustive-deps

  const doImport = () => {
    onImport(preview.map(t => ({ ...t, screenshot: shots[t.id] ?? null })));
    onClose();
  };

  const shotCount = Object.keys(shots).length;
  const th = { padding:"8px 12px", fontSize:9, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.07em", borderBottom:"1px solid rgba(30,41,59,0.8)" };
  const td = { padding:"8px 12px", fontSize:11, borderBottom:"1px solid rgba(30,41,59,0.5)", color:"#94a3b8", fontFamily:"monospace" };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:80, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)" }}/>
      <div style={{ position:"relative", zIndex:10, width:"100%", maxWidth: step === "screenshots" ? 800 : 720, maxHeight:"92vh", borderRadius:16, border:"1px solid #1a2035", background:"#0d1120", boxShadow:"0 25px 60px rgba(0,0,0,0.6)", display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid #1a2035", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#e2e8f0", display:"flex", alignItems:"center", gap:8 }}>
              {step === "csv"
                ? <><Upload size={15} style={{ color:"#38bdf8" }}/> Import from CSV</>
                : <><Image size={15} style={{ color:"#38bdf8" }}/> Attach Screenshots <span style={{ fontSize:11, color:"#475569", fontWeight:400 }}>(optional)</span></>
              }
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              {["csv","screenshots"].map((s, i) => (
                <div key={s} style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <div style={{ width:20, height:20, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, background: step===s?"#38bdf8":preview?"rgba(56,189,248,0.2)":"#1a2035", color: step===s?"#000":preview?"#38bdf8":"#334155" }}>{i+1}</div>
                  {i === 0 && <div style={{ width:20, height:1, background:"#1a2035" }}/>}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer" }}><X size={16}/></button>
        </div>

        {/* Step 1: CSV */}
        {step === "csv" && (
          <div style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ padding:"12px 16px", borderRadius:10, background:"rgba(56,189,248,0.05)", border:"1px solid rgba(56,189,248,0.15)", fontSize:11, color:"#64748b", lineHeight:1.7 }}>
              <strong style={{ color:"#38bdf8" }}>Supported brokers:</strong> MT4/MT5, TradingView, cTrader, Interactive Brokers, Oanda, and any CSV-exporting platform.<br/>
              <strong style={{ color:"#94a3b8" }}>Required columns:</strong> pair/symbol, entry price, exit price, direction/type.
            </div>
            {!preview && (
              <div onClick={() => fileRef.current?.click()} style={{ padding:"40px 20px", borderRadius:12, border:"2px dashed #1e2d3e", cursor:"pointer", textAlign:"center", background:"#111827" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor="#38bdf8"; e.currentTarget.style.background="rgba(56,189,248,0.04)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d3e"; e.currentTarget.style.background="#111827"; }}
                onDrop={e => { e.preventDefault(); fileRef.current.files = e.dataTransfer.files; handleFile({ target: fileRef.current }); }}
                onDragOver={e => e.preventDefault()}>
                <FileText size={32} style={{ color:"#334155", marginBottom:12 }}/>
                <div style={{ fontSize:13, color:"#64748b", marginBottom:6 }}>Drop CSV file here or click to browse</div>
                <div style={{ fontSize:11, color:"#334155" }}>Supports .csv files up to 5MB</div>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display:"none" }} onChange={handleFile}/>
            {error && <div style={{ padding:"10px 14px", borderRadius:8, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", fontSize:12, color:"#f87171", display:"flex", alignItems:"center", gap:7 }}><AlertCircle size={12}/>{error}</div>}
            {preview && (
              <div>
                {/* Broker detected banner */}
                {broker && (
                  <div style={{ marginBottom:10, padding:"10px 14px", borderRadius:9, background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.3)", display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:16 }}>✅</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#34d399" }}>Broker detected: {broker.name}</div>
                      <div style={{ fontSize:10, color:"#3a6a8a", marginTop:1 }}>These trades will be tagged as <strong style={{ color:"#34d399" }}>verified broker imports</strong> and count toward your rank progression.</div>
                    </div>
                  </div>
                )}
                {!broker && (
                  <div style={{ marginBottom:10, padding:"8px 12px", borderRadius:9, background:"rgba(251,191,36,0.06)", border:"1px solid rgba(251,191,36,0.2)", display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:14 }}>⚠️</span>
                    <div style={{ fontSize:11, color:"#64748b" }}>
                      Broker not recognised — trades imported as <strong>manual</strong>. Supported brokers: Tradovate, Apex, TopstepX, NinjaTrader, TradeLocker, IBKR.
                    </div>
                  </div>
                )}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                  <div style={{ fontSize:12, color:"#94a3b8" }}><span style={{ fontWeight:700, color:"#34d399" }}>{preview.length}</span> trades found</div>
                  <button onClick={() => { setPreview(null); setBroker(null); setShots({}); setError(""); }} style={{ fontSize:11, color:"#475569", background:"none", border:"none", cursor:"pointer" }}>← Re-upload</button>
                </div>
                <div style={{ borderRadius:10, border:"1px solid #1a2035", overflow:"auto", maxHeight:240 }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", minWidth:540 }}>
                    <thead><tr>{["Pair","Type","Entry","Exit","PnL","Date","Strategy"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {preview.slice(0,20).map((t,i) => (
                        <tr key={i}>
                          <td style={{ ...td, fontWeight:700, color:"#e2e8f0" }}>{t.pair}</td>
                          <td style={{ ...td, color:t.type==="long"?"#34d399":"#f87171" }}>{t.type.toUpperCase()}</td>
                          <td style={td}>{t.entryPrice}</td>
                          <td style={td}>{t.exitPrice}</td>
                          <td style={{ ...td, color:(t.pnl??0)>=0?"#34d399":"#f87171", fontWeight:700 }}>{(t.pnl??0)>=0?"+":""}{(t.pnl??0).toFixed(4)}</td>
                          <td style={td}>{new Date(t.date).toLocaleDateString()}</td>
                          <td style={td}>{t.strategy}</td>
                        </tr>
                      ))}
                      {preview.length > 20 && <tr><td colSpan={7} style={{ ...td, textAlign:"center", color:"#475569" }}>...and {preview.length-20} more trades</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Screenshots */}
        {step === "screenshots" && preview && (
          <div style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ padding:"10px 14px", borderRadius:9, background:"rgba(56,189,248,0.05)", border:"1px solid rgba(56,189,248,0.15)", fontSize:11, color:"#64748b", lineHeight:1.6 }}>
              Drop, click, or <strong style={{ color:"#94a3b8" }}>⌘V paste</strong> a screenshot onto each trade row. Paste fills the next empty slot automatically.{shotCount > 0 && <span style={{ color:"#34d399", marginLeft:6 }}>✓ {shotCount} attached</span>}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {preview.map((t, idx) => {
                const shot = shots[t.id];
                const isDrag = dragIdx === t.id;
                const w = (t.pnl??0)>=0;
                return (
                  <div key={t.id}
                    onDrop={e => handleRowDrop(t.id, e)}
                    onDragOver={e => { e.preventDefault(); setDragIdx(t.id); }}
                    onDragEnter={e => { e.preventDefault(); setDragIdx(t.id); }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragIdx(null); }}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:9, border:`1px solid ${isDrag?"rgba(56,189,248,0.5)":shot?"rgba(52,211,153,0.25)":"#1a2035"}`, background:isDrag?"rgba(56,189,248,0.05)":shot?"rgba(52,211,153,0.03)":"#111827", transition:"all 0.12s" }}>
                    <div style={{ fontSize:10, fontFamily:"monospace", color:"#334155", width:20, textAlign:"center", flexShrink:0 }}>{idx+1}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:"#e2e8f0" }}>{t.pair}</span>
                        <span style={{ fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:4, background:t.type==="long"?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)", color:t.type==="long"?"#34d399":"#f87171" }}>{t.type.toUpperCase()}</span>
                        <span style={{ fontSize:10, fontFamily:"monospace", color:w?"#34d399":"#f87171" }}>{w?"+":""}{(t.pnl??0).toFixed(2)}</span>
                      </div>
                      <div style={{ fontSize:9, color:"#334155", marginTop:2 }}>{t.strategy} · {new Date(t.date).toLocaleDateString()}</div>
                    </div>
                    {shot ? (
                      <div style={{ position:"relative", flexShrink:0 }}>
                        <img src={shot} alt="shot" style={{ width:72, height:48, objectFit:"cover", borderRadius:6, border:"1px solid rgba(52,211,153,0.3)", display:"block" }}/>
                        <button onClick={() => setShots(prev => { const n={...prev}; delete n[t.id]; return n; })}
                          style={{ position:"absolute", top:-6, right:-6, width:18, height:18, borderRadius:"50%", background:"rgba(239,68,68,0.9)", border:"none", cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <X size={9}/>
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => imgRefs.current[t.id]?.click()}
                        style={{ width:72, height:48, flexShrink:0, borderRadius:6, border:`2px dashed ${isDrag?"#38bdf8":"#1e2d3e"}`, background:isDrag?"rgba(56,189,248,0.08)":"transparent", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3 }}>
                        <Image size={12} style={{ color:isDrag?"#38bdf8":"#334155" }}/>
                        <span style={{ fontSize:8, color:isDrag?"#38bdf8":"#334155" }}>{isDrag?"Drop":"Add"}</span>
                      </button>
                    )}
                    <input ref={el => imgRefs.current[t.id] = el} type="file" accept="image/*" style={{ display:"none" }} onChange={e => handleImgInput(t.id, e)}/>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding:"14px 20px", borderTop:"1px solid #1a2035", display:"flex", gap:10, flexShrink:0 }}>
          {step === "csv" && !preview && (
            <button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid #1e2d3e", background:"transparent", color:"#64748b", fontSize:12, fontWeight:600, cursor:"pointer" }}>Cancel</button>
          )}
          {step === "csv" && preview && <>
            <button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid #1e2d3e", background:"transparent", color:"#64748b", fontSize:12, fontWeight:600, cursor:"pointer" }}>Cancel</button>
            <button onClick={() => setStep("screenshots")} style={{ flex:2, padding:"10px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#0369a1,#38bdf8)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
              Next — Add Screenshots →
            </button>
          </>}
          {step === "screenshots" && <>
            <button onClick={() => setStep("csv")} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid #1e2d3e", background:"transparent", color:"#64748b", fontSize:12, fontWeight:600, cursor:"pointer" }}>← Back</button>
            <button onClick={doImport} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid #1a2035", background:"#111827", color:"#94a3b8", fontSize:12, fontWeight:600, cursor:"pointer" }}>Skip & Import</button>
            <button onClick={doImport} style={{ flex:2, padding:"10px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#0369a1,#38bdf8)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 16px rgba(56,189,248,0.2)" }}>
              Import {preview.length} Trades{shotCount > 0 ? ` + ${shotCount} Screenshot${shotCount!==1?"s":""}` : ""}
            </button>
          </>}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
//  SCREENSHOT IMPORTER — AI reads trade data from chart image
// ═══════════════════════════════════════════════════════════════

function ScreenshotImporter({ onImportAll, onClose }) {
  // images: [{ id, dataUrl, status: "idle"|"processing"|"done"|"error", trades: [], error: "" }]
  const [images,   setImages]   = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [step,     setStep]     = useState("upload"); // "upload" | "review"
  const fileRef = useRef(null);

  const addImages = (files) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!imgs.length) return;
    imgs.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImages(prev => [...prev, {
          id:      `img_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
          dataUrl: ev.target.result,
          status:  "idle",
          trades:  [],
          error:   "",
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Paste — add pasted image to queue
  useEffect(() => {
    const onPaste = (e) => {
      if (step !== "upload") return;
      const items = Array.from(e.clipboardData?.items ?? []);
      const imgs  = items.filter(i => i.type.startsWith("image/")).map(i => i.getAsFile());
      if (imgs.length) addImages(imgs);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeImage = (id) => setImages(prev => prev.filter(img => img.id !== id));

  // Analyse a single image — updates its entry in state
  const analyseOne = async (img) => {
    setImages(prev => prev.map(i => i.id === img.id ? { ...i, status:"processing", error:"", trades:[] } : i));
    try {
      const base64    = img.dataUrl.split(",")[1];
      const mediaType = img.dataUrl.split(";")[0].split(":")[1];
      const res = await fetch("/api/analyse-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mediaType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      const trades = (data.trades ?? (data.trade ? [data.trade] : [])).map(t => ({
        ...t, screenshot: img.dataUrl,
        id: `shot_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        _selected: true,
      }));
      if (!trades.length) throw new Error("No trades found in this screenshot");
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, status:"done", trades } : i));
    } catch (e) {
      setImages(prev => prev.map(i => i.id === img.id ? { ...i, status:"error", error: e.message } : i));
    }
  };

  // Analyse all idle images in parallel
  const analyseAll = async () => {
    const toProcess = images.filter(i => i.status === "idle" || i.status === "error");
    await Promise.all(toProcess.map(analyseOne));
    setStep("review");
  };

  // Toggle a trade's selected state in the review step
  const toggleTrade = (imgId, tradeId) => {
    setImages(prev => prev.map(img => img.id !== imgId ? img : {
      ...img, trades: img.trades.map(t => t.id === tradeId ? { ...t, _selected: !t._selected } : t)
    }));
  };

  // Edit a field on a trade in-place
  const editTrade = (imgId, tradeId, field, value) => {
    setImages(prev => prev.map(img => img.id !== imgId ? img : {
      ...img, trades: img.trades.map(t => t.id === tradeId ? { ...t, [field]: value } : t)
    }));
  };

  const allTrades = images.flatMap(i => i.trades);
  const selectedTrades = allTrades.filter(t => t._selected);
  const doneCount = images.filter(i => i.status === "done").length;
  const processingCount = images.filter(i => i.status === "processing").length;
  const anyProcessing = processingCount > 0;

  const doImport = () => {
    // Strip internal _selected flag before saving
    onImportAll(selectedTrades.map(({ _selected, ...t }) => ({
      ...t, source: "screenshot", tags: ["Screenshot Import"], confidence: 3,
    })));
    onClose();
  };

  const inp = { padding:"5px 8px", borderRadius:6, background:"#0d1120", border:"1px solid #1e2d3e", fontSize:11, color:"#e2e8f0", outline:"none", width:"100%", boxSizing:"border-box" };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:80, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)" }}/>
      <div style={{ position:"relative", zIndex:10, width:"100%", maxWidth: step === "review" ? 860 : 600, maxHeight:"92vh", borderRadius:16, border:"1px solid #1a2035", background:"#0d1120", boxShadow:"0 25px 60px rgba(0,0,0,0.6)", display:"flex", flexDirection:"column", transition:"max-width 0.2s" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid #1a2035", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#e2e8f0", display:"flex", alignItems:"center", gap:8 }}>
              <Sparkles size={15} style={{ color:"#818cf8" }}/> AI Screenshot Import
            </div>
            {/* Step pills */}
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              {["upload","review"].map((s, i) => (
                <div key={s} style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <div style={{ width:20, height:20, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, background: step===s?"#818cf8":doneCount>0?"rgba(129,140,248,0.3)":"#1a2035", color: step===s?"#fff":doneCount>0?"#818cf8":"#334155" }}>{i+1}</div>
                  {i===0 && <div style={{ width:20, height:1, background:"#1a2035" }}/>}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer" }}><X size={16}/></button>
        </div>

        {/* ── STEP 1: Upload ── */}
        {step === "upload" && (
          <div style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:14 }}>

            <div style={{ padding:"10px 14px", borderRadius:9, background:"rgba(129,140,248,0.06)", border:"1px solid rgba(129,140,248,0.2)", fontSize:11, color:"#64748b", lineHeight:1.6 }}>
              Drop multiple screenshots at once — Claude will read every trade from every image. Each screenshot can contain multiple trades (e.g. a trade history list). You'll review and edit results before importing.
            </div>

            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDrop={e => { e.preventDefault(); setDragOver(false); addImages(e.dataTransfer.files); }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
              style={{ borderRadius:10, border:`2px dashed ${dragOver?"#818cf8":"#1e2d3e"}`, background:dragOver?"rgba(129,140,248,0.06)":"#111827", cursor:"pointer", padding:"28px 20px", textAlign:"center", transition:"all 0.15s" }}
            >
              <div style={{ pointerEvents:"none", display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                <div style={{ width:44, height:44, borderRadius:12, background:dragOver?"rgba(129,140,248,0.15)":"#1a2035", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Upload size={20} style={{ color:dragOver?"#818cf8":"#475569" }}/>
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:dragOver?"#818cf8":"#64748b" }}>
                  {dragOver ? "Drop screenshots here" : "Drop screenshots, click to browse, or ⌘V to paste"}
                </div>
                <div style={{ fontSize:10, color:"#334155" }}>Multiple files supported · PNG, JPG, WebP · Each can contain multiple trades</div>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={e => addImages(e.target.files)}/>

            {/* Image queue */}
            {images.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#64748b" }}>{images.length} screenshot{images.length!==1?"s":""} queued</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:8 }}>
                  {images.map(img => (
                    <div key={img.id} style={{ position:"relative", borderRadius:8, overflow:"hidden", border:`1px solid ${img.status==="done"?"rgba(52,211,153,0.3)":img.status==="error"?"rgba(239,68,68,0.3)":img.status==="processing"?"rgba(129,140,248,0.3)":"#1a2035"}` }}>
                      <img src={img.dataUrl} alt="" style={{ width:"100%", height:90, objectFit:"cover", display:"block" }}/>
                      {/* Status overlay */}
                      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {img.status==="processing" && <span style={{ display:"inline-block", width:18, height:18, border:"2px solid rgba(255,255,255,0.2)", borderTopColor:"#818cf8", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>}
                        {img.status==="done"       && <span style={{ fontSize:18 }}>✓</span>}
                        {img.status==="error"      && <span style={{ fontSize:16 }}>⚠</span>}
                      </div>
                      {/* Status label */}
                      <div style={{ padding:"4px 6px", background:"rgba(13,17,32,0.9)", fontSize:9, fontWeight:700, color: img.status==="done"?"#34d399":img.status==="error"?"#f87171":img.status==="processing"?"#818cf8":"#475569", textAlign:"center" }}>
                        {img.status==="done"       ? `${img.trades.length} trade${img.trades.length!==1?"s":""}` :
                         img.status==="error"      ? "Error" :
                         img.status==="processing" ? "Analysing…" : "Queued"}
                      </div>
                      {/* Remove */}
                      <button onClick={() => removeImage(img.id)} style={{ position:"absolute", top:4, right:4, width:18, height:18, borderRadius:"50%", background:"rgba(0,0,0,0.7)", border:"none", cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <X size={9}/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Review ── */}
        {step === "review" && (
          <div style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ padding:"10px 14px", borderRadius:9, background:"rgba(129,140,248,0.06)", border:"1px solid rgba(129,140,248,0.2)", fontSize:11, color:"#64748b", lineHeight:1.6 }}>
              <strong style={{ color:"#818cf8" }}>{allTrades.length} trade{allTrades.length!==1?"s":""} found</strong> across {doneCount} screenshot{doneCount!==1?"s":""}. Edit any field, uncheck trades to skip them, then click Import.
            </div>

            {images.map(img => (
              <div key={img.id}>
                {/* Image thumbnail + status */}
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <img src={img.dataUrl} alt="" style={{ width:52, height:36, objectFit:"cover", borderRadius:5, border:"1px solid #1a2035", flexShrink:0 }}/>
                  <div>
                    {img.status==="done"  && <div style={{ fontSize:11, fontWeight:700, color:"#34d399" }}>✓ {img.trades.length} trade{img.trades.length!==1?"s":""} extracted</div>}
                    {img.status==="error" && <div style={{ fontSize:11, color:"#f87171" }}>⚠ {img.error}</div>}
                  </div>
                </div>

                {/* Trade cards for this image */}
                {img.trades.map(t => (
                  <div key={t.id} style={{ marginBottom:8, borderRadius:9, border:`1px solid ${t._selected?"rgba(129,140,248,0.3)":"#1a2035"}`, background:t._selected?"rgba(129,140,248,0.04)":"#111827", overflow:"hidden", opacity:t._selected?1:0.45, transition:"all 0.15s" }}>
                    {/* Trade header */}
                    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderBottom:"1px solid rgba(30,41,59,0.6)" }}>
                      <input type="checkbox" checked={t._selected} onChange={() => toggleTrade(img.id, t.id)} style={{ cursor:"pointer", accentColor:"#818cf8", width:14, height:14, flexShrink:0 }}/>
                      <span style={{ fontSize:12, fontWeight:700, color:"#e2e8f0" }}>{t.pair ?? "Unknown"}</span>
                      <span style={{ fontSize:9, fontWeight:700, padding:"1px 7px", borderRadius:4, background:t.type==="long"?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.12)", color:t.type==="long"?"#34d399":"#f87171" }}>{(t.type??"long").toUpperCase()}</span>
                      {t.pnl != null && <span style={{ fontSize:11, fontFamily:"monospace", color:(t.pnl??0)>=0?"#34d399":"#f87171", marginLeft:"auto" }}>{(t.pnl??0)>=0?"+":""}{t.pnl}</span>}
                    </div>
                    {/* Editable fields */}
                    {t._selected && (
                      <div style={{ padding:"10px 12px", display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                        {[
                          { label:"Pair",    field:"pair",       val:t.pair ?? "" },
                          { label:"Type",    field:"type",       val:t.type ?? "long", opts:["long","short"] },
                          { label:"Entry",   field:"entryPrice", val:t.entryPrice ?? "" },
                          { label:"Exit",    field:"exitPrice",  val:t.exitPrice ?? "" },
                          { label:"SL",      field:"stopLoss",   val:t.stopLoss ?? "" },
                          { label:"TP",      field:"takeProfit", val:t.takeProfit ?? "" },
                          { label:"Size",    field:"size",       val:t.size ?? 1 },
                          { label:"Strategy",field:"strategy",   val:t.strategy ?? "" },
                          { label:"PnL",     field:"pnl",        val:t.pnl ?? "" },
                        ].map(({ label, field, val, opts }) => (
                          <div key={field}>
                            <div style={{ fontSize:8, color:"#334155", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{label}</div>
                            {opts ? (
                              <select value={val} onChange={e => editTrade(img.id, t.id, field, e.target.value)} style={{ ...inp, cursor:"pointer" }}>
                                {opts.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : (
                              <input value={val} onChange={e => editTrade(img.id, t.id, field, e.target.value)} style={inp}/>
                            )}
                          </div>
                        ))}
                        {/* Notes spans full width */}
                        <div style={{ gridColumn:"1/-1" }}>
                          <div style={{ fontSize:8, color:"#334155", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>Notes (from AI)</div>
                          <input value={t.notes ?? ""} onChange={e => editTrade(img.id, t.id, "notes", e.target.value)} style={inp}/>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ padding:"14px 20px", borderTop:"1px solid #1a2035", display:"flex", gap:10, flexShrink:0 }}>
          {step === "upload" && (
            <>
              <button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid #1e2d3e", background:"transparent", color:"#64748b", fontSize:12, fontWeight:600, cursor:"pointer" }}>Cancel</button>
              <button onClick={analyseAll} disabled={!images.length || anyProcessing} style={{
                flex:3, padding:"10px", borderRadius:9, border:"none",
                background: !images.length||anyProcessing ? "#1a2035" : "linear-gradient(135deg,#4f46e5,#818cf8)",
                color: !images.length||anyProcessing ? "#334155" : "#fff",
                fontSize:12, fontWeight:700, cursor: !images.length||anyProcessing ? "not-allowed":"pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:7,
              }}>
                {anyProcessing
                  ? <><span style={{ display:"inline-block", width:11, height:11, border:"2px solid #334155", borderTopColor:"#818cf8", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/> Analysing {processingCount} screenshot{processingCount!==1?"s":""}…</>
                  : <><Sparkles size={13}/> Analyse {images.length || ""} Screenshot{images.length!==1?"s":""} with AI</>
                }
              </button>
            </>
          )}
          {step === "review" && (
            <>
              <button onClick={() => setStep("upload")} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid #1e2d3e", background:"transparent", color:"#64748b", fontSize:12, fontWeight:600, cursor:"pointer" }}>← Back</button>
              <button onClick={doImport} disabled={!selectedTrades.length} style={{
                flex:3, padding:"10px", borderRadius:9, border:"none",
                background: selectedTrades.length ? "linear-gradient(135deg,#0369a1,#38bdf8)" : "#1a2035",
                color: selectedTrades.length ? "#fff" : "#334155",
                fontSize:12, fontWeight:700, cursor: selectedTrades.length ? "pointer" : "not-allowed",
                boxShadow: selectedTrades.length ? "0 4px 16px rgba(56,189,248,0.2)" : "none",
              }}>
                Import {selectedTrades.length} Trade{selectedTrades.length!==1?"s":""}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ImportHub({ onManual, onCSV, onScreenshot, onClose, accountType }) {
  const isRestricted = accountType === "funded" || accountType === "real";

  const integrations = [
    {
      id:"manual", icon:<Zap size={20}/>, label:"Manual Entry",
      desc: isRestricted ? "❌ Not allowed on funded/real accounts — import from broker only" : "Log a trade you've taken on any platform",
      color:"#38bdf8", available:!isRestricted,
      action:() => { onClose(); onManual(); },
      blocked: isRestricted,
    },
    {
      id:"screenshot", icon:<Sparkles size={20}/>, label:"AI Screenshot",
      desc: isRestricted ? "❌ Not allowed on funded/real accounts — import from broker only" : "Drop a chart screenshot — Claude reads the trade data for you",
      color:"#818cf8", available:!isRestricted,
      action:() => { onClose(); onScreenshot(); },
      blocked: isRestricted,
    },
    {
      id:"csv", icon:<FileText size={20}/>, label:"Broker CSV Import",
      desc: isRestricted ? "✅ Import your broker CSV — Tradovate, Apex, TopstepX, IBKR" : "Upload MT4/MT5, TradingView, cTrader, IBKR export",
      color:"#34d399", available:true,
      action:() => { onClose(); onCSV(); },
      blocked: false,
    },
    { id:"webhook", icon:<Webhook size={20}/>,  label:"Webhook Ingestion", desc:"Auto-import via HTTP webhook (TradingView alerts, etc.)", color:"#fbbf24", available:false, comingSoon:true },
    { id:"api",     icon:<Link2 size={20}/>,    label:"Broker API",        desc:"Connect directly to Tradovate, IBKR, Binance",          color:"#a78bfa", available:false, comingSoon:true },
    { id:"mt4",     icon:<Download size={20}/>, label:"MT4 / MT5 Plugin",  desc:"Install EA plugin to auto-sync trades from MetaTrader",  color:"#f97316", available:false, comingSoon:true },
  ];

  return (
    <div style={{ position:"fixed", inset:0, zIndex:80, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)" }}/>
      <div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:580, borderRadius:16, border:"1px solid #1a2035", background:"#0d1120", boxShadow:"0 25px 60px rgba(0,0,0,0.6)", overflow:"hidden" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid #1a2035" }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#e2e8f0", display:"flex", alignItems:"center", gap:8 }}>
            <Upload size={15} style={{ color:"#38bdf8" }}/> Add Trades
            {isRestricted && <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10, background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.2)", color:"#f87171" }}>Broker imports only</span>}
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer" }}><X size={16}/></button>
        </div>

        {isRestricted && (
          <div style={{ margin:"12px 20px 0", padding:"10px 14px", borderRadius:10, background:"rgba(248,113,113,0.06)", border:"1px solid rgba(248,113,113,0.2)", fontSize:11, color:"#f87171", lineHeight:1.6 }}>
            You're on a <strong>{accountType === "funded" ? "Funded" : "Real"} Account</strong>. Manual entry and screenshot imports are disabled — all trades must come from your broker CSV to ensure accuracy.
          </div>
        )}

        <div style={{ padding:20, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {integrations.map(i => (
            <button key={i.id} onClick={i.available && !i.blocked ? i.action : undefined}
              disabled={!i.available || i.blocked}
              style={{ padding:"16px", borderRadius:12, border:`1px solid ${i.available&&!i.blocked?i.color+"30":"#1a2035"}`, background: i.available&&!i.blocked?i.color+"08":"#111827", textAlign:"left", cursor: i.available&&!i.blocked?"pointer":"not-allowed", opacity: i.available&&!i.blocked?1:0.45, transition:"all 0.15s" }}>
              <div style={{ color:i.blocked?"#334155":i.color, marginBottom:8 }}>{i.icon}</div>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                <span style={{ fontSize:12, fontWeight:700, color: i.available&&!i.blocked?"#e2e8f0":"#475569" }}>{i.label}</span>
                {i.comingSoon && <span style={{ fontSize:8, fontWeight:700, color:"#fbbf24", background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.2)", padding:"1px 6px", borderRadius:10 }}>SOON</span>}
                {i.blocked && <span style={{ fontSize:8, fontWeight:700, color:"#f87171", background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.2)", padding:"1px 6px", borderRadius:10 }}>BLOCKED</span>}
              </div>
              <div style={{ fontSize:10, color: i.blocked?"#f87171":"#475569", lineHeight:1.5 }}>{i.desc}</div>
            </button>
          ))}
        </div>
        <div style={{ padding:"12px 20px", borderTop:"1px solid #1a2035", fontSize:10, color:"#334155", textAlign:"center" }}>
          {isRestricted ? "Funded and real accounts require broker CSV imports for trade verification" : "Nexyru never connects to live brokers. All trades are imported after execution."}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TRADE TABLE
// ═══════════════════════════════════════════════════════════════

function TradeDetail({ trade, onClose }) {
  const [screenshot, setScreenshot] = useState(trade.screenshot ?? null);
  const [tradeNotes, setTradeNotes] = useState(null);

  // ── Review mode state ──────────────────────────────────────
  const [reviewing,     setReviewing]     = useState(false);
  const [availMistakes, setAvailMistakes] = useState([]);
  const [selMistakes,   setSelMistakes]   = useState([]);
  const [emotion,       setEmotion]       = useState("calm");
  const [confidence,    setConfidence]    = useState(5);
  const [followedRules, setFollowedRules] = useState(true);
  const [tradeReason,   setTradeReason]   = useState("");
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);

  const EMOTIONS = [
    { id:"calm",      label:"😌 Calm",      color:"#34d399" },
    { id:"confident", label:"💪 Confident",  color:"#38bdf8" },
    { id:"fomo",      label:"😰 FOMO",       color:"#fbbf24" },
    { id:"fear",      label:"😨 Fear",       color:"#f97316" },
    { id:"revenge",   label:"😤 Revenge",    color:"#f87171" },
  ];

  const lbl = { display:"block", fontSize:9, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:5 };
  const inp = { width:"100%", padding:"8px 10px", borderRadius:7, boxSizing:"border-box", background:"#0d1120", border:"1px solid #1e2d3e", fontSize:12, color:"#e2e8f0", outline:"none" };

  const EMOTION_LABELS = { calm:"😌 Calm", confident:"💪 Confident", fomo:"😰 FOMO", fear:"😨 Fear", revenge:"😤 Revenge" };

  useEffect(() => {
    if (screenshot || !trade._hasScreenshot) return;
    rehydrateScreenshot(trade).then(t => setScreenshot(t.screenshot ?? null));
  }, [trade.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (trade.source === "demo") return; // Skip API calls for demo trades
    fetch(`/api/trade-notes/notes?trade_id=${trade.id}`).then(r => r.json()).then(d => {
      if (d) {
        setTradeNotes(d);
        setEmotion(d.emotion ?? "calm");
        setConfidence(d.confidence ?? 5);
        setFollowedRules(d.followed_rules ?? true);
        setTradeReason(d.notes ?? "");
      }
    }).catch(() => {});
    fetch("/api/trade-notes/mistakes").then(r => r.json()).then(d => { if (Array.isArray(d)) setAvailMistakes(d); }).catch(() => {});
  }, [trade.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveReview = async () => {
    setSaving(true);
    try {
      await fetch("/api/trade-notes/notes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trade_id: trade.id, setup: trade.strategy ?? null,
          confidence, emotion, notes: tradeReason,
          followed_rules: followedRules, mistake_ids: selMistakes,
        }),
      });
      setTradeNotes({ emotion, confidence, followed_rules: followedRules, notes: tradeReason });
      setSaved(true);
      setTimeout(() => { setSaved(false); setReviewing(false); }, 1000);
    } catch {} finally { setSaving(false); }
  };


  return (
    <div style={{ position:"fixed", inset:0, zIndex:90, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)" }}/>
      <div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:480, maxHeight:"90vh", borderRadius:16, border:"1px solid #1a2035", background:"#0d1120", boxShadow:"0 25px 60px rgba(0,0,0,0.6)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* Sticky header */}
        <div style={{ display:"flex", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid #1a2035", flexShrink:0 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:"#e2e8f0" }}>{trade.pair}</div>
            <div style={{ fontSize:11, color:"#475569", marginTop:3 }}>{new Date(trade.date).toLocaleString()} · {trade.source}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer" }}><X size={18}/></button>
        </div>
        {/* Scrollable content */}
        <div style={{ flex:1, overflowY:"auto", padding:"20px" }}>
        {screenshot && <img src={screenshot} alt="" style={{ width:"100%", borderRadius:8, marginBottom:16, maxHeight:200, objectFit:"contain", background:"#111827" }}/>}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
          {[
            { label:"Direction", val: trade.type?.toUpperCase(), color: trade.type==="long"?"#34d399":"#f87171" },
            { label:"Strategy",  val: trade.strategy, color:"#94a3b8" },
            { label:"Entry",     val: trade.entryPrice, color:"#94a3b8" },
            { label:"Exit",      val: trade.exitPrice,  color:"#94a3b8" },
            { label:"SL",        val: trade.stopLoss  ?? "—", color:"#f87171" },
            { label:"TP",        val: trade.takeProfit ?? "—", color:"#34d399" },
            { label:"Size",      val: trade.size, color:"#94a3b8" },
            { label:"PnL",       val: `${(trade.pnl??0)>=0?"+":""}${(trade.pnl??0).toFixed(4)}`, color: (trade.pnl??0)>=0?"#34d399":"#f87171" },
          ].map(({ label,val,color }) => (
            <div key={label} style={{ background:"#111827", borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:9, color:"#334155", textTransform:"uppercase", marginBottom:4 }}>{label}</div>
              <div style={{ fontSize:13, fontWeight:700, fontFamily:"monospace", color }}>{val}</div>
            </div>
          ))}
        </div>
        {trade.notes && <div style={{ padding:"12px", borderRadius:8, background:"#111827", fontSize:12, color:"#64748b", lineHeight:1.6, marginBottom:12 }}>{trade.notes}</div>}
        {(trade.tags??[]).length > 0 && <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>{trade.tags.map(tag => <span key={tag} style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:"rgba(56,189,248,0.08)", border:"1px solid rgba(56,189,248,0.2)", color:"#38bdf8" }}>{tag}</span>)}</div>}

        {/* ── Trade Review ─────────────────────────────────── */}
        {!reviewing ? (
          <div style={{ borderRadius:10, border:"1px solid rgba(129,140,248,0.2)", background:"rgba(129,140,248,0.04)", padding:"12px 14px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#818cf8", display:"flex", alignItems:"center", gap:6 }}>
                🧠 Trade Review
              </div>
              <button onClick={() => setReviewing(true)} style={{ padding:"5px 12px", borderRadius:7, border:"1px solid rgba(129,140,248,0.3)", background:"rgba(129,140,248,0.08)", color:"#818cf8", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                {tradeNotes ? "✏️ Edit Review" : "✍️ Write Review"}
              </button>
            </div>

            {/* Show existing review summary */}
            {tradeNotes ? (
              <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:8 }}>
                {tradeNotes.notes && <div style={{ fontSize:12, color:"#94a3b8", lineHeight:1.6 }}>{tradeNotes.notes}</div>}
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {tradeNotes.emotion && (
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"rgba(129,140,248,0.1)", color:"#818cf8", border:"1px solid rgba(129,140,248,0.2)" }}>
                      {EMOTION_LABELS[tradeNotes.emotion] ?? tradeNotes.emotion}
                    </span>
                  )}
                  {tradeNotes.confidence && (
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"rgba(56,189,248,0.08)", color:"#38bdf8", border:"1px solid rgba(56,189,248,0.2)" }}>
                      Confidence: {tradeNotes.confidence}/10
                    </span>
                  )}
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:tradeNotes.followed_rules?"rgba(52,211,153,0.08)":"rgba(239,68,68,0.08)", color:tradeNotes.followed_rules?"#34d399":"#f87171", border:`1px solid ${tradeNotes.followed_rules?"rgba(52,211,153,0.2)":"rgba(239,68,68,0.2)"}` }}>
                    {tradeNotes.followed_rules ? "✅ Rules followed" : "❌ Rules broken"}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize:11, color:"#334155", marginTop:8 }}>No review yet — reflect on this trade to build your trading journal.</div>
            )}
          </div>
        ) : (
          /* Review form — fixed overlay so it doesn't push content off screen */
          <div style={{ position:"fixed", inset:0, zIndex:90, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
            <div onClick={() => setReviewing(false)} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(4px)" }}/>
            <div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:480, maxHeight:"85vh", borderRadius:14, border:"1px solid rgba(129,140,248,0.35)", background:"#0d1120", boxShadow:"0 24px 60px rgba(0,0,0,0.7)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

              {/* Header */}
              <div style={{ padding:"14px 18px", borderBottom:"1px solid #1a2035", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#818cf8", display:"flex", alignItems:"center", gap:6 }}>✍️ Trade Review</div>
                <button onClick={() => setReviewing(false)} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer" }}><X size={15}/></button>
              </div>

              {/* Scrollable body */}
              <div style={{ flex:1, overflowY:"auto", padding:"16px 18px", display:"flex", flexDirection:"column", gap:12 }}>
                <div>
                  <label style={lbl}>What happened? Why did you take this trade?</label>
                  <textarea value={tradeReason} onChange={e => setTradeReason(e.target.value)}
                    placeholder="Describe your reasoning, what you saw, and what you would do differently..."
                    style={{ ...inp, resize:"vertical", minHeight:72, fontFamily:"inherit", lineHeight:1.6 }}/>
                </div>

                <div>
                  <label style={{ ...lbl, display:"flex", justifyContent:"space-between" }}>
                    Confidence going in <span style={{ color:"#38bdf8", fontFamily:"monospace" }}>{confidence}/10</span>
                  </label>
                  <input type="range" min={1} max={10} value={confidence} onChange={e => setConfidence(parseInt(e.target.value))} style={{ width:"100%", accentColor:"#818cf8" }}/>
                </div>

                <div>
                  <label style={lbl}>Emotional state</label>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {EMOTIONS.map(em => (
                      <button key={em.id} onClick={() => setEmotion(em.id)} style={{ padding:"5px 10px", borderRadius:20, border:`1px solid ${emotion===em.id?em.color:"#1e2d3e"}`, background:emotion===em.id?`${em.color}18`:"transparent", color:emotion===em.id?em.color:"#475569", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                        {em.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={lbl}>Followed your trading rules?</label>
                  <div style={{ display:"flex", gap:8 }}>
                    {[true, false].map(v => (
                      <button key={String(v)} onClick={() => setFollowedRules(v)} style={{ flex:1, padding:"7px", borderRadius:8, border:`1px solid ${followedRules===v?(v?"rgba(52,211,153,0.5)":"rgba(239,68,68,0.5)"):"#1e2d3e"}`, background:followedRules===v?(v?"rgba(52,211,153,0.1)":"rgba(239,68,68,0.1)"):"transparent", color:followedRules===v?(v?"#34d399":"#f87171"):"#475569", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        {v ? "✅ Yes" : "❌ No"}
                      </button>
                    ))}
                  </div>
                </div>

                {availMistakes.length > 0 && (
                  <div>
                    <label style={lbl}>Mistakes made</label>
                    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                      {availMistakes.map(m => {
                        const sel = selMistakes.includes(m.id);
                        return (
                          <label key={m.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", borderRadius:7, background:sel?"rgba(239,68,68,0.08)":"#111827", border:`1px solid ${sel?"rgba(239,68,68,0.3)":"#1e2d3e"}`, cursor:"pointer" }}>
                            <input type="checkbox" checked={sel} onChange={() => setSelMistakes(prev => sel ? prev.filter(id=>id!==m.id) : [...prev, m.id])} style={{ accentColor:"#f87171", width:14, height:14 }}/>
                            <span style={{ fontSize:11, color:sel?"#f87171":"#94a3b8", fontWeight:sel?700:400 }}>{m.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding:"12px 18px", borderTop:"1px solid #1a2035", display:"flex", gap:8, flexShrink:0 }}>
                <button onClick={() => setReviewing(false)} style={{ flex:1, padding:"9px", borderRadius:8, border:"1px solid #1e2d3e", background:"transparent", color:"#64748b", fontSize:12, fontWeight:600, cursor:"pointer" }}>Cancel</button>
                <button onClick={saveReview} disabled={saving} style={{ flex:2, padding:"9px", borderRadius:8, border:"none", background:saved?"rgba(52,211,153,0.2)":"linear-gradient(135deg,#4f46e5,#818cf8)", color:saved?"#34d399":"#fff", fontSize:12, fontWeight:700, cursor:saving?"not-allowed":"pointer" }}>
                  {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Review"}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>{/* end scrollable content */}
      </div>
    </div>
  );
}

function TradeTable({ trades, onEdit, onDelete, onReview }) {
  const [err, setErr] = useState(false);
  if (err) return (
    <div style={{ padding:"24px", borderRadius:12, border:"1px dashed rgba(248,113,113,0.3)", textAlign:"center" }}>
      <div style={{ fontSize:32, marginBottom:8 }}>⚠️</div>
      <div style={{ fontSize:13, fontWeight:700, color:"#f87171", marginBottom:8 }}>Couldn't render trade table</div>
      <button onClick={() => setErr(false)} style={{ padding:"7px 16px", borderRadius:8, border:"1px solid rgba(56,189,248,0.3)", background:"transparent", color:"#38bdf8", fontSize:12, cursor:"pointer" }}>Retry</button>
    </div>
  );
  const [search,  setSearch]  = useState("");
  const [typeF,   setTypeF]   = useState("all");
  const [stratF,  setStratF]  = useState("all");
  const [sortK,   setSortK]   = useState("date");
  const [sortD,   setSortD]   = useState("desc");
  const [viewing, setViewing] = useState(null);
  const [reviewMap, setReviewMap] = useState({}); // { tradeId: { emotion, confidence, followed_rules, notes } }
  const [sharedSet, setSharedSet] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("nexyru_shared_trades") || "[]")); } catch { return new Set(); }
  });
  const [unsharing, setUnsharing] = useState(null);
  const [confirmUnshare, setConfirmUnshare] = useState(null);

  useEffect(() => {
    const h = () => {
      try { setSharedSet(new Set(JSON.parse(localStorage.getItem("nexyru_shared_trades") || "[]"))); } catch {}
    };
    window.addEventListener("nexyruSharedUpdate", h);
    return () => window.removeEventListener("nexyruSharedUpdate", h);
  }, []);

  const handleUnshare = async (tradeId) => {
    setConfirmUnshare(null);
    setUnsharing(String(tradeId));
    try {
      const SUPA = "https://xsrcaceydyqytbipvrok.supabase.co";
      const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcmNhY2V5ZHlxeXRiaXB2cm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDg0MjUsImV4cCI6MjA5MzUyNDQyNX0.IfIkjTtAAb0-iZLu8CE-3GgdNGKxSNJKczSAZlQV62A";
      const u = JSON.parse(localStorage.getItem("tradedesk_session_v1") || "{}").username;
      if (!u) throw new Error("Not signed in");
      const r = await fetch(`${SUPA}/rest/v1/profiles?username=eq.${encodeURIComponent(u)}&select=id`, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } });
      const p = await r.json();
      if (!p?.length) throw new Error("Profile not found");
      const userId = p[0].id;
      const del = await fetch(`${SUPA}/rest/v1/trade_posts?trade_id=eq.${encodeURIComponent(String(tradeId))}&user_id=eq.${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: { apikey: KEY, Authorization: "Bearer " + KEY },
      });
      if (!del.ok) { const e = await del.text(); throw new Error(e || "Delete failed"); }
      const arr = JSON.parse(localStorage.getItem("nexyru_shared_trades") || "[]").filter(id => id !== String(tradeId));
      localStorage.setItem("nexyru_shared_trades", JSON.stringify(arr));
      setSharedSet(new Set(arr));
      window.dispatchEvent(new CustomEvent("nexyruSharedUpdate"));
    } catch (e) {
      alert("Failed to remove from feed: " + e.message);
    } finally {
      setUnsharing(null);
    }
  };

  // Load review notes for all visible trades
  useEffect(() => {
    if (!trades.length) return;
    // Skip API calls for demo trades entirely
    const realTrades = trades.filter(t => t.source !== "demo");
    if (!realTrades.length) return;
    // Fetch each trade's notes — stagger to avoid hammering the API
    realTrades.slice(0, 50).forEach((t, i) => {
      setTimeout(() => {
        fetch(`/api/trade-notes/notes?trade_id=${t.id}`)
          .then(r => r.json())
          .then(d => { if (d) setReviewMap(prev => ({ ...prev, [t.id]: d })); })
          .catch(() => {});
      }, i * 30);
    });
  }, [trades.map(t=>t.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const strategies = useMemo(() => ["all", ...Array.from(new Set(trades.map(t=>t.strategy).filter(Boolean))).sort()], [trades]);

  const filtered = useMemo(() => {
    let r = [...trades];
    if (search) { const q = search.toLowerCase(); r = r.filter(t => t.pair?.toLowerCase().includes(q) || t.strategy?.toLowerCase().includes(q) || (t.tags??[]).some(tag=>tag.toLowerCase().includes(q)) || t.notes?.toLowerCase().includes(q)); }
    if (typeF !== "all") r = r.filter(t => t.type === typeF);
    if (stratF !== "all") r = r.filter(t => t.strategy === stratF);
    r.sort((a,b) => { const va=a[sortK], vb=b[sortK]; const c=va<vb?-1:va>vb?1:0; return sortD==="asc"?c:-c; });
    return r;
  }, [trades, search, typeF, stratF, sortK, sortD]);

  const toggleSort = k => { if (sortK===k) setSortD(d=>d==="asc"?"desc":"asc"); else { setSortK(k); setSortD("desc"); } };
  const SIcon = ({ c }) => c!==sortK ? <ChevronsUpDown size={10} style={{ color:"#475569" }}/> : sortD==="asc" ? <ChevronUp size={10} style={{ color:"#38bdf8" }}/> : <ChevronDown size={10} style={{ color:"#38bdf8" }}/>;
  const th = { padding:"8px 12px", textAlign:"left", fontSize:9, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.07em", cursor:"pointer", userSelect:"none", whiteSpace:"nowrap", borderBottom:"1px solid rgba(30,41,59,0.8)", background:"rgba(10,15,30,0.98)" };
  const td = { padding:"9px 12px", fontSize:11, borderBottom:"1px solid rgba(30,41,59,0.4)" };
  const sel = { padding:"5px 10px", borderRadius:7, background:"#111827", border:"1px solid #1e2d3e", fontSize:11, color:"#94a3b8", cursor:"pointer", outline:"none" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {viewing && <TradeDetail trade={viewing} onClose={() => {
          // Refresh review for this trade when modal closes (skip for demo trades)
          if (viewing.source !== "demo") {
            fetch(`/api/trade-notes/notes?trade_id=${viewing.id}`)
              .then(r => r.json())
              .then(d => { if (d) setReviewMap(prev => ({ ...prev, [viewing.id]: d })); })
              .catch(() => {});
          }
          setViewing(null);
        }}/>}
      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        <div style={{ position:"relative", flex:1, minWidth:160 }}>
          <Search size={12} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#475569" }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search trades…" style={{ ...sel, paddingLeft:30, width:"100%", boxSizing:"border-box" }}/>
        </div>
        <select value={typeF} onChange={e=>setTypeF(e.target.value)} style={sel}><option value="all">All Types</option><option value="long">Long</option><option value="short">Short</option></select>
        <select value={stratF} onChange={e=>setStratF(e.target.value)} style={sel}>{strategies.map(s=><option key={s} value={s}>{s==="all"?"All Strategies":s}</option>)}</select>
        <span style={{ fontSize:10, color:"#334155", marginLeft:"auto" }}>{filtered.length} trades</span>
      </div>
      {filtered.length === 0 ? (
        <div style={{ padding:"40px", textAlign:"center", color:"#334155", fontSize:12, borderRadius:12, border:"1px dashed #1a2035" }}>
          {trades.length===0 ? "No trades yet. Log your first trade to get started." : "No trades match your filters."}
        </div>
      ) : (
        <div style={{ borderRadius:12, border:"1px solid #1a2035", overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:640 }}>
              <thead>
                <tr>
                  <th onClick={()=>toggleSort("pair")} style={th}><div style={{ display:"flex", alignItems:"center", gap:3 }}>Pair<SIcon c="pair"/></div></th>
                  <th style={{ ...th, cursor:"default" }}>Type</th>
                  <th onClick={()=>toggleSort("entryPrice")} style={th}><div style={{ display:"flex", alignItems:"center", gap:3 }}>Entry<SIcon c="entryPrice"/></div></th>
                  <th onClick={()=>toggleSort("exitPrice")} style={th}><div style={{ display:"flex", alignItems:"center", gap:3 }}>Exit<SIcon c="exitPrice"/></div></th>
                  <th onClick={()=>toggleSort("pnl")} style={th}><div style={{ display:"flex", alignItems:"center", gap:3 }}>PnL<SIcon c="pnl"/></div></th>
                  <th style={{ ...th, cursor:"default" }}>Strategy</th>
                  <th style={{ ...th, cursor:"default" }}>🧠 Psychology</th>
                  <th onClick={()=>toggleSort("date")} style={th}><div style={{ display:"flex", alignItems:"center", gap:3 }}>Date<SIcon c="date"/></div></th>
                  <th style={{ ...th, cursor:"default" }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const w   = (t.pnl??0)>=0;
                  const rev = reviewMap[t.id] ?? (t.source === "demo" && t.emotion ? {
                    emotion: t.emotion,
                    confidence: t.confidence ?? 5,
                    followed_rules: t.rulesFollowed ?? true,
                    notes: t.notes ?? "",
                  } : null);
                  const EMOJIS = { calm:"😌", confident:"💪", fomo:"😰", fear:"😨", revenge:"😤" };
                  return (
                    <tr key={t.id} style={{ cursor:"pointer" }} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                      <td style={{ ...td, fontWeight:700, color:"#e2e8f0", fontFamily:"monospace" }} onClick={()=>setViewing(t)}>
                        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                          {t.pair}
                          {(t.screenshot || t._hasScreenshot) && <Image size={9} style={{ color:"#475569" }}/>}
                          {t.copiedFrom && <span style={{ fontSize:7, fontWeight:700, color:"#818cf8", background:"rgba(129,140,248,0.1)", padding:"1px 5px", borderRadius:8 }}>COPY</span>}
                          {t.source === "broker_import" && <span style={{ fontSize:7, fontWeight:700, color:"#34d399", background:"rgba(52,211,153,0.1)", padding:"1px 5px", borderRadius:8, border:"1px solid rgba(52,211,153,0.2)" }}>✓ BROKER</span>}
                          {(() => { try { const g = gradeTradeLocally(t, trades); return <span style={{ fontSize:7, fontWeight:800, color:g.gradeColor, background:`${g.gradeColor}15`, padding:"1px 5px", borderRadius:8, border:`1px solid ${g.gradeColor}30` }}>{g.grade}</span>; } catch { return null; } })()}
                        </div>
                      </td>
                      <td style={td} onClick={()=>setViewing(t)}>
                        <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:4, background: t.type==="long"?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)", color: t.type==="long"?"#34d399":"#f87171", border:`1px solid ${t.type==="long"?"rgba(16,185,129,0.25)":"rgba(239,68,68,0.25)"}` }}>
                          {t.type==="long"?"▲":"▼"} {t.type?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ ...td, fontFamily:"monospace", color:"#94a3b8" }} onClick={()=>setViewing(t)}>{t.entryPrice}</td>
                      <td style={{ ...td, fontFamily:"monospace", color:"#94a3b8" }} onClick={()=>setViewing(t)}>{t.exitPrice}</td>
                      <td style={{ ...td, fontFamily:"monospace", fontWeight:700, color: w?"#34d399":"#f87171" }} onClick={()=>setViewing(t)}>
                        <div>{w?"+":""}{(t.pnl??0).toFixed(4)}</div>
                        <div style={{ fontSize:9, opacity:0.7 }}>{(t.pnlPercent??0)>=0?"+":""}{(t.pnlPercent??0).toFixed(3)}%</div>
                      </td>
                      <td style={{ ...td, color:"#64748b" }} onClick={()=>setViewing(t)}>{t.strategy}</td>

                      {/* Psychology column */}
                      <td style={td} onClick={()=>setViewing(t)}>
                        {rev ? (
                          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                            {/* Emotion + confidence */}
                            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                              <span style={{ fontSize:13 }}>{EMOJIS[rev.emotion] ?? "—"}</span>
                              <span style={{ fontSize:9, color:"#64748b", fontFamily:"monospace" }}>{rev.emotion}</span>
                            </div>
                            {/* Confidence bar */}
                            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                              <div style={{ width:40, height:3, borderRadius:2, background:"#1a2035", overflow:"hidden" }}>
                                <div style={{ width:`${(rev.confidence/10)*100}%`, height:"100%", background: rev.confidence>=7?"#34d399":rev.confidence>=4?"#fbbf24":"#f87171", borderRadius:2 }}/>
                              </div>
                              <span style={{ fontSize:9, color:"#475569", fontFamily:"monospace" }}>{rev.confidence}/10</span>
                            </div>
                            {/* Rules */}
                            <span style={{ fontSize:9, fontWeight:700, color: rev.followed_rules?"#34d399":"#f87171" }}>
                              {rev.followed_rules ? "✅ rules" : "❌ rules"}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize:9, color:"#334155" }}>—</span>
                        )}
                      </td>

                      <td style={{ ...td, color:"#64748b", whiteSpace:"nowrap" }} onClick={()=>setViewing(t)}>{new Date(t.date).toLocaleDateString()}</td>
                      <td style={{...td, padding:"4px 8px"}}>
                        {sharedSet.has(String(t.id)) ? (
                          confirmUnshare===String(t.id) ? (
                            <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"3px 8px",borderRadius:8,border:"1px solid #1e2d3e",background:"rgba(10,15,30,0.9)"}} onClick={(e)=>e.stopPropagation()}>
                              <span style={{fontSize:10,fontWeight:600,color:"#94a3b8"}}>Remove from feed?</span>
                              <button
                                onClick={(e)=>{e.stopPropagation(); handleUnshare(t.id);}}
                                style={{padding:"3px 9px",borderRadius:6,border:"1px solid rgba(239,68,68,0.45)",cursor:"pointer",background:"rgba(239,68,68,0.15)",color:"#f87171",fontSize:10,fontWeight:700}}>
                                Yes
                              </button>
                              <button
                                onClick={(e)=>{e.stopPropagation(); setConfirmUnshare(null);}}
                                style={{padding:"3px 9px",borderRadius:6,border:"1px solid #334155",cursor:"pointer",background:"transparent",color:"#94a3b8",fontSize:10,fontWeight:700}}>
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e)=>{e.stopPropagation(); setConfirmUnshare(String(t.id));}}
                              disabled={unsharing===String(t.id)}
                              title="Click to remove from feed"
                              style={{padding:"3px 10px",borderRadius:8,border:"1px solid rgba(52,211,153,0.3)",cursor:unsharing===String(t.id)?"wait":"pointer",background:"rgba(52,211,153,0.1)",color:"#34d399",fontSize:10,fontWeight:700}}>
                              {unsharing===String(t.id) ? "…" : "✓ Posted"}
                            </button>
                          )
                        ) : (
                          <button
                            onClick={(e)=>{e.stopPropagation(); window.__pendingShare=t; window.dispatchEvent(new CustomEvent('nexyruShare'));}}
                            style={{padding:"3px 10px",borderRadius:8,border:"1px solid rgba(56,189,248,0.25)",cursor:"pointer",background:"rgba(56,189,248,0.08)",color:"#38bdf8",fontSize:10,fontWeight:700}}>
                            📡 Share
                          </button>
                        )}
                      </td>
                      <td style={td}>
                        <div style={{ display:"flex", gap:4 }}>
                          <button onClick={()=>onReview?.(t)} title="AI Review" style={{ padding:"4px 8px", borderRadius:6, border:"1px solid rgba(129,140,248,0.25)", background:"rgba(129,140,248,0.06)", color:"#818cf8", cursor:"pointer", display:"flex", alignItems:"center", gap:3, fontSize:10, fontWeight:600 }}><span>🤖</span></button>
                          <button onClick={()=>onEdit(t)} style={{ padding:"4px 8px", borderRadius:6, border:"1px solid #1e2d3e", background:"transparent", color:"#475569", cursor:"pointer" }}><Edit2 size={10}/></button>
                          <button onClick={()=>onDelete(t.id)} style={{ padding:"4px 8px", borderRadius:6, border:"1px solid rgba(239,68,68,0.2)", background:"transparent", color:"#f87171", cursor:"pointer" }}><Trash size={10}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ANALYTICS PANEL
// ═══════════════════════════════════════════════════════════════

function MistakeInsightsWidget() {
  const [mistakes, setMistakes] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch("/api/analytics/mistakes")
      .then(r => { if (!r.ok) throw new Error("API error"); return r.json(); })
      .then(d => { if (d.mistakes) setMistakes(d.mistakes); })
      .catch(() => {}) // Silently fail — not critical
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!mistakes.length) return null;

  const biggest  = mistakes[0];
  const maxCount = mistakes[0]?.count ?? 1;

  return (
    <div style={{ borderRadius:12, border:"1px solid rgba(239,68,68,0.2)", background:"rgba(239,68,68,0.03)", padding:"16px 18px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#f87171", display:"flex", alignItems:"center", gap:7 }}>
          🔴 Top Mistakes
        </div>
        {biggest && (
          <span style={{ fontSize:10, padding:"2px 9px", borderRadius:10, background:"rgba(239,68,68,0.12)", color:"#f87171", border:"1px solid rgba(239,68,68,0.25)", fontWeight:700 }}>
            Biggest leak: {biggest.name}
          </span>
        )}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {mistakes.slice(0, 7).map((m, i) => (
          <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ fontSize:10, color:"#475569", width:16, textAlign:"right", flexShrink:0 }}>{i+1}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:11, fontWeight: i===0?700:400, color: i===0?"#f87171":"#94a3b8" }}>{m.name}</span>
                <span style={{ fontSize:11, fontFamily:"monospace", color:"#64748b", flexShrink:0, marginLeft:8 }}>{m.count}×</span>
              </div>
              <div style={{ height:4, borderRadius:2, background:"#1a2035", overflow:"hidden" }}>
                <div style={{ width:`${(m.count/maxCount)*100}%`, height:"100%", background: i===0?"#ef4444":"rgba(239,68,68,0.4)", borderRadius:2 }}/>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsPanel({ trades }) {
  const stats     = useMemo(() => computeStats(trades), [trades]);
  const chartData = useMemo(() => buildCumPnl(trades),  [trades]);
  const finalPnl  = chartData.length ? chartData[chartData.length-1].cumPnl : 0;
  const lineClr   = finalPnl >= 0 ? "#10b981" : "#ef4444";

  const byDay = useMemo(() => {
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const map  = {};
    trades.forEach(t => {
      const d = days[new Date(t.date).getDay()];
      if (!map[d]) map[d] = { day:d, wins:0, losses:0, pnl:0 };
      map[d].pnl += (t.pnl??0);
      if ((t.pnl??0)>0) map[d].wins++; else map[d].losses++;
    });
    return days.map(d => map[d] ?? { day:d, wins:0, losses:0, pnl:0 });
  }, [trades]);

  if (!trades.length) return <div style={{ padding:"40px", textAlign:"center", color:"#334155", borderRadius:12, border:"1px dashed #1a2035" }}>Log trades to see analytics</div>;

  const streakLabel = stats.currentStreak > 0 ? `${stats.currentStreak}W` : stats.currentStreak < 0 ? `${Math.abs(stats.currentStreak)}L` : "—";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10 }}>
        <StatCard label="Total Trades" value={String(stats.totalTrades)} sub={`${stats.wins}W / ${stats.losses}L`} pos={null} icon={<Activity size={14}/>}/>
        <StatCard label="Win Rate"     value={`${stats.winRate}%`}       sub={`PF ${stats.profitFactor}`}        pos={stats.winRate>=50}    icon={<Target size={14}/>}/>
        <StatCard label="Total PnL"    value={`${stats.totalPnl>=0?"+":""}${(stats.totalPnl??0).toFixed(4)}`} sub={`Avg W: +${(stats.avgWin??0).toFixed(4)}`} pos={stats.totalPnl>=0} icon={<TrendingUp size={14}/>}/>
        <StatCard label="Best Trade"   value={`+${(stats.bestTrade??0).toFixed(4)}`}  pos={true}  icon={<Award size={14}/>}/>
        <StatCard label="Worst Trade"  value={(stats.worstTrade??0).toFixed(4)}       pos={false} icon={<TrendingDown size={14}/>}/>
        <StatCard label="Streak"       value={streakLabel} sub={`Avg L: -${(stats.avgLoss??0).toFixed(4)}`} pos={stats.currentStreak>0?true:stats.currentStreak<0?false:null} icon={<Zap size={14}/>}/>
      </div>
      {chartData.length > 1 && (
        <div style={{ borderRadius:12, border:"1px solid rgba(51,65,85,0.6)", background:"rgba(15,23,42,0.85)", padding:"16px 16px 8px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <span style={{ fontSize:12, fontWeight:500, color:"#cbd5e1" }}>Equity Curve</span>
            <span style={{ fontSize:12, fontFamily:"monospace", fontWeight:700, color:lineClr }}>{finalPnl>=0?"+":""}{(finalPnl??0).toFixed(4)}</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top:4, right:4, left:-20, bottom:0 }}>
              <defs><linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={lineClr} stopOpacity={0.25}/><stop offset="95%" stopColor={lineClr} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" vertical={false}/>
              <XAxis dataKey="label" tick={{ fontSize:9, fill:"#64748b" }} tickLine={false} axisLine={false}/>
              <YAxis tick={{ fontSize:9, fill:"#64748b" }} tickLine={false} axisLine={false}/>
              <Tooltip contentStyle={{ background:"#0d1120", border:"1px solid #1e2d3e", borderRadius:8, fontSize:11 }} labelStyle={{ color:"#94a3b8" }} itemStyle={{ color:lineClr }}/>
              <Area type="monotone" dataKey="cumPnl" stroke={lineClr} strokeWidth={2} fill="url(#cumGrad)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {trades.length >= 5 && (
        <div style={{ borderRadius:12, border:"1px solid rgba(51,65,85,0.6)", background:"rgba(15,23,42,0.85)", padding:"16px 16px 8px" }}>
          <div style={{ fontSize:12, fontWeight:500, color:"#cbd5e1", marginBottom:14 }}>PnL by Day of Week</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={byDay} margin={{ top:4, right:4, left:-20, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" vertical={false}/>
              <XAxis dataKey="day" tick={{ fontSize:9, fill:"#64748b" }} tickLine={false} axisLine={false}/>
              <YAxis tick={{ fontSize:9, fill:"#64748b" }} tickLine={false} axisLine={false}/>
              <Tooltip contentStyle={{ background:"#0d1120", border:"1px solid #1e2d3e", borderRadius:8, fontSize:11 }} labelStyle={{ color:"#94a3b8" }}/>
              <Bar dataKey="pnl" fill="#38bdf8" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <MistakeInsightsWidget/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  INSIGHTS PANEL
// ═══════════════════════════════════════════════════════════════

function insightsByStrategy(trades) {
  const map = {};
  trades.forEach(t => {
    const s = t.strategy || "Unknown";
    if (!map[s]) map[s] = { wins:0, losses:0, pnl:0, count:0 };
    map[s].count++; map[s].pnl += (t.pnl ?? 0);
    if ((t.pnl ?? 0) > 0) map[s].wins++; else map[s].losses++;
  });
  return Object.entries(map).map(([strategy,d]) => ({ strategy, ...d, winRate: d.count ? +(d.wins/d.count*100).toFixed(1) : 0 })).filter(d=>d.count>=2).sort((a,b)=>b.pnl-a.pnl);
}

function insightsByTag(trades) {
  const map = {};
  trades.forEach(t => {
    (t.tags ?? []).forEach(tag => {
      if (!map[tag]) map[tag] = { wins:0, losses:0, pnl:0, count:0 };
      map[tag].count++; map[tag].pnl += (t.pnl ?? 0);
      if ((t.pnl ?? 0) > 0) map[tag].wins++; else map[tag].losses++;
    });
  });
  return Object.entries(map).map(([tag,d]) => ({ tag, ...d, winRate: d.count ? +(d.wins/d.count*100).toFixed(1) : 0 })).filter(d=>d.count>=2).sort((a,b)=>b.winRate-a.winRate);
}

// ═══════════════════════════════════════════════════════════════
//  AI TRADE REVIEW SYSTEM
// ═══════════════════════════════════════════════════════════════

function gradeTradeLocally(trade, allTrades) {
  if (!trade) return { score:50, grade:"C", gradeColor:"#fbbf24", strengths:[], issues:[], flags:[], rr:null };
  let score = 70;
  const issues = [], strengths = [], flags = [];
  const pnl = trade.pnl ?? 0;

  // ── RR Analysis ──────────────────────────────────────────────
  const rr = trade.stopLoss && trade.takeProfit && trade.entryPrice
    ? Math.abs((trade.takeProfit - trade.entryPrice) / (trade.entryPrice - trade.stopLoss))
    : null;
  if (rr !== null) {
    if (rr >= 2.5)       { score += 12; strengths.push(`Excellent RR of ${rr.toFixed(1)}:1`); }
    else if (rr >= 1.5)  { score += 6;  strengths.push(`Good RR of ${rr.toFixed(1)}:1`); }
    else if (rr < 1)     { score -= 15; issues.push(`Poor RR of ${rr.toFixed(1)}:1 — risking more than potential gain`); }
    else                 { score -= 5;  issues.push(`Below average RR of ${rr.toFixed(1)}:1`); }
  }

  // ── Win/Loss quality ─────────────────────────────────────────
  if ((trade.pnl ?? 0) > 0) {
    score += 8;
    strengths.push("Profitable trade");
    // Check if they let it run
    if (rr && rr >= 1.5) strengths.push("Let winner run to target");
  } else {
    score -= 10;
    issues.push("Trade closed at a loss");
    if (rr && rr < 0.8) issues.push("Small stop, big target — poor planning");
  }

  // ── Confidence check ─────────────────────────────────────────
  const conf = trade.confidence ?? 5;
  if (conf >= 8) { score += 5; strengths.push("High conviction entry"); }
  if (conf <= 3) { score -= 8; issues.push("Low confidence entry — avoid low-conviction setups"); flags.push("LOW_CONFIDENCE"); }

  // ── Emotional check ──────────────────────────────────────────
  const emotion = (trade.emotion ?? trade.notes ?? "").toLowerCase();
  if (emotion.includes("fomo"))     { score -= 12; flags.push("FOMO"); issues.push("FOMO entry detected — chasing price"); }
  if (emotion.includes("revenge"))  { score -= 15; flags.push("REVENGE"); issues.push("Revenge trade detected — emotional decision"); }
  if (emotion.includes("fear"))     { score -= 8;  flags.push("FEAR"); issues.push("Fear may have influenced entry/exit timing"); }
  if (emotion.includes("calm") || emotion.includes("confident")) { score += 5; strengths.push("Calm, disciplined mindset"); }

  // ── Revenge trading detection ─────────────────────────────────
  const sorted = [...(allTrades ?? [])].filter(t => t && t.date).sort((a,b) => a.date - b.date);
  const idx    = sorted.findIndex(t => t.id === trade.id);
  if (idx >= 1) {
    const prev = sorted[idx - 1];
    const timeDiff = (trade.date - prev.date) / 60000; // minutes
    if ((prev.pnl ?? 0) < 0 && timeDiff < 15) {
      score -= 18; flags.push("REVENGE"); issues.push("Entered within 15 min of a loss — possible revenge trade");
    }
    if ((prev.pnl ?? 0) < 0 && (trade.pnl ?? 0) < 0) {
      issues.push("Back-to-back losses — consider a break after consecutive losses");
    }
  }

  // ── Overtrading check ────────────────────────────────────────
  const sameDay = allTrades.filter(t => {
    return new Date(t.date).toDateString() === new Date(trade.date).toDateString();
  });
  if (sameDay.length > 6) { score -= 10; flags.push("OVERTRADE"); issues.push(`${sameDay.length} trades in one day — possible overtrading`); }
  else if (sameDay.length > 4) { score -= 5; issues.push(`${sameDay.length} trades today — watch for overtrading`); }

  // ── Session timing ───────────────────────────────────────────
  const hour = new Date(trade.date).getHours();
  if (hour >= 9 && hour <= 11)  { score += 5; strengths.push("NY open session — high liquidity"); }
  if (hour >= 13 && hour <= 14) { score += 3; strengths.push("London/NY overlap — strong session"); }
  if (hour >= 20 || hour <= 6)  { score -= 8; issues.push("Late night / off-hours trade — low liquidity risk"); }

  // ── Position sizing (if available) ───────────────────────────
  if (trade.size && trade.entryPrice) {
    const posValue = trade.size * trade.entryPrice;
    if (posValue > 100000) { flags.push("OVERSIZE"); issues.push("Very large position — check your risk %"); }
  }

  // ── Rules followed ───────────────────────────────────────────
  if (trade.rulesFollowed === true || trade.rulesFollowed === "true") {
    score += 8; strengths.push("Followed trading rules");
  } else if (trade.rulesFollowed === false || trade.rulesFollowed === "false") {
    score -= 10; issues.push("Rules not followed — stick to your plan");
  }

  score = Math.max(0, Math.min(100, score));

  const grade = score >= 90 ? "A+" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : score >= 50 ? "D" : "F";
  const gradeColor = score >= 80 ? "#34d399" : score >= 65 ? "#38bdf8" : score >= 50 ? "#fbbf24" : "#f87171";

  return { score, grade, gradeColor, strengths, issues, flags, rr };
}

// ── AI Trade Review Card ───────────────────────────────────────
function AITradeReview({ trade, allTrades, onClose }) {
  const [aiReview, setAiReview]   = useState(null);
  const [loading,  setLoading]    = useState(false);
  const local = useMemo(() => gradeTradeLocally(trade, allTrades), [trade, allTrades]);

  const getAIReview = async () => {
    setLoading(true);
    try {
      const rr = local.rr ? `${local.rr.toFixed(2)}:1` : "unknown";
      const prompt = `You are an elite trading coach reviewing a single trade. Be direct, specific, and honest.

TRADE DATA:
- Pair: ${trade.pair}
- Direction: ${trade.type}
- Entry: ${trade.entryPrice} | Exit: ${trade.exitPrice}
- Size: ${trade.size}
- PnL: ${(trade.pnl ?? 0) >= 0 ? "+" : ""}${(trade.pnl ?? 0).toFixed(2)}
- Strategy: ${trade.strategy ?? "Unknown"}
- RR Ratio: ${rr}
- Confidence: ${trade.confidence ?? "N/A"}/10
- Emotion: ${trade.emotion ?? "Not recorded"}
- Notes: ${trade.notes ?? "None"}
- Time: ${new Date(trade.date).toLocaleString()}
- Rules followed: ${trade.rulesFollowed ?? "Not recorded"}
- Detected flags: ${local.flags.join(", ") || "None"}

LOCAL SCORE: ${local.score}/100 (Grade: ${local.grade})

Write a coaching review with these exact sections:
**VERDICT** (1 sentence — honest assessment)
**WHAT YOU DID WELL** (2-3 bullet points, be specific)
**WHAT TO FIX** (2-3 bullet points, actionable)
**NEXT TIME** (1 clear directive)

Max 150 words. Be a tough but fair coach.`;

      const res  = await fetch("/api/generate-insights", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: { prompt, raw: true } }),
      });
      const data = await res.json();
      setAiReview(data.insight ?? "Could not generate review.");
    } catch { setAiReview("Failed to connect to AI coach."); }
    finally { setLoading(false); }
  };

  const FLAG_LABELS = {
    FOMO:         { label:"FOMO Entry",        color:"#f97316", icon:"⚡" },
    REVENGE:      { label:"Revenge Trade",      color:"#f87171", icon:"💢" },
    OVERTRADE:    { label:"Overtrading",        color:"#fbbf24", icon:"⚠️" },
    LOW_CONFIDENCE:{ label:"Low Conviction",   color:"#94a3b8", icon:"❓" },
    OVERSIZE:     { label:"Oversized Position", color:"#f87171", icon:"📦" },
    FEAR:         { label:"Fear-Based Exit",    color:"#a78bfa", icon:"😨" },
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(8px)" }}/>
      <div style={{ position:"relative", zIndex:10, background:"#0a1628", border:"1px solid #1e2f4a", borderRadius:24, width:"100%", maxWidth:560, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 40px 100px rgba(0,0,0,0.9)" }}>

        {/* Header */}
        <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid #111827", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <span style={{ fontSize:16 }}>🤖</span>
              <span style={{ fontSize:15, fontWeight:800, color:"#f0f4ff" }}>AI Trade Review</span>
            </div>
            <div style={{ fontSize:11, color:"#3a4a6a" }}>{trade.pair} · {trade.type} · {new Date(trade.date).toLocaleDateString()}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:20, lineHeight:1 }}>×</button>
        </div>

        <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:16 }}>

          {/* Score card */}
          <div style={{ borderRadius:16, background:`linear-gradient(135deg,${local.gradeColor}12,${local.gradeColor}06)`, border:`1px solid ${local.gradeColor}30`, padding:"20px 24px", display:"flex", alignItems:"center", gap:20 }}>
            {/* Grade badge */}
            <div style={{ width:72, height:72, borderRadius:16, background:`${local.gradeColor}18`, border:`2px solid ${local.gradeColor}44`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:`0 0 24px ${local.gradeColor}20` }}>
              <span style={{ fontSize:28, fontWeight:900, color:local.gradeColor, fontFamily:"monospace" }}>{local.grade}</span>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, color:"#475569", marginBottom:6 }}>Trade Score</div>
              {/* Score bar */}
              <div style={{ height:8, borderRadius:4, background:"#111d30", marginBottom:6, overflow:"hidden" }}>
                <div style={{ width:`${local.score}%`, height:"100%", background:`linear-gradient(90deg,${local.gradeColor}88,${local.gradeColor})`, borderRadius:4, transition:"width 1s", boxShadow:`0 0 8px ${local.gradeColor}44` }}/>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                <span style={{ color:local.gradeColor, fontWeight:800, fontFamily:"monospace" }}>{local.score}/100</span>
                {local.rr && <span style={{ color:"#38bdf8" }}>RR: {local.rr.toFixed(1)}:1</span>}
                <span style={{ color: (trade.pnl??0)>=0?"#34d399":"#f87171", fontWeight:700 }}>{(trade.pnl??0)>=0?"+":""}{(trade.pnl??0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Behavior flags */}
          {local.flags.length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {local.flags.map(f => {
                const fl = FLAG_LABELS[f] ?? { label:f, color:"#64748b", icon:"⚠️" };
                return (
                  <div key={f} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:20, background:`${fl.color}12`, border:`1px solid ${fl.color}30`, fontSize:11, fontWeight:700, color:fl.color }}>
                    {fl.icon} {fl.label}
                  </div>
                );
              })}
            </div>
          )}

          {/* Strengths */}
          {local.strengths.length > 0 && (
            <div style={{ borderRadius:12, background:"rgba(52,211,153,0.05)", border:"1px solid rgba(52,211,153,0.15)", padding:"14px 16px" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#34d399", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>✅ Strengths</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {local.strengths.map((s,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, fontSize:11, color:"#64748b" }}>
                    <span style={{ color:"#34d399", flexShrink:0, marginTop:1 }}>•</span>{s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Issues */}
          {local.issues.length > 0 && (
            <div style={{ borderRadius:12, background:"rgba(248,113,113,0.05)", border:"1px solid rgba(248,113,113,0.15)", padding:"14px 16px" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#f87171", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>⚠️ Issues</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {local.issues.map((s,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, fontSize:11, color:"#64748b" }}>
                    <span style={{ color:"#f87171", flexShrink:0, marginTop:1 }}>•</span>{s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk meter */}
          <div style={{ borderRadius:12, background:"#0d1628", border:"1px solid #1a2540", padding:"14px 16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8", marginBottom:12 }}>Risk Assessment</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {[
                { label:"Confidence",    val: trade.confidence ?? 5, max:10, color:"#38bdf8" },
                { label:"Risk/Reward",   val: local.rr ? Math.min(local.rr, 5) : 1, max:5, color:local.rr && local.rr>=2?"#34d399":"#fbbf24" },
                { label:"Discipline",    val: trade.rulesFollowed ? 9 : local.flags.length > 0 ? 3 : 6, max:10, color:"#a78bfa" },
                { label:"Timing",        val: (() => { const h=new Date(trade.date).getHours(); return h>=9&&h<=11?9:h>=13&&h<=14?7:h>=20||h<=6?3:5; })(), max:10, color:"#f97316" },
              ].map(m => (
                <div key={m.label}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:10, color:"#3a4a6a" }}>{m.label}</span>
                    <span style={{ fontSize:10, color:m.color, fontWeight:700, fontFamily:"monospace" }}>{(m.val/m.max*100).toFixed(0)}%</span>
                  </div>
                  <div style={{ height:4, borderRadius:2, background:"#111d30", overflow:"hidden" }}>
                    <div style={{ width:`${(m.val/m.max)*100}%`, height:"100%", background:`linear-gradient(90deg,${m.color}66,${m.color})`, borderRadius:2 }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Coach section */}
          <div style={{ borderRadius:12, background:"rgba(129,140,248,0.05)", border:"1px solid rgba(129,140,248,0.2)", overflow:"hidden" }}>
            <div style={{ padding:"14px 16px", borderBottom:"1px solid rgba(129,140,248,0.1)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:16 }}>✨</span>
                <span style={{ fontSize:12, fontWeight:700, color:"#818cf8" }}>AI Coach Feedback</span>
              </div>
              {!aiReview && (
                <button onClick={getAIReview} disabled={loading} style={{ padding:"6px 14px", borderRadius:8, border:"none", background:loading?"#1a2035":"linear-gradient(135deg,#4f46e5,#818cf8)", color:loading?"#334155":"#fff", fontSize:11, fontWeight:700, cursor:loading?"not-allowed":"pointer" }}>
                  {loading ? <span style={{ display:"flex", alignItems:"center", gap:6 }}><span style={{ display:"inline-block", width:10, height:10, border:"2px solid #334155", borderTopColor:"#818cf8", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/> Analyzing…</span> : "✨ Get AI Feedback"}
                </button>
              )}
            </div>
            {aiReview ? (
              <div style={{ padding:"14px 16px", fontSize:12, color:"#94a3b8", lineHeight:2, whiteSpace:"pre-wrap" }}>
                {aiReview.split(/\*\*(.*?)\*\*/g).map((part,i) =>
                  i%2===1 ? <strong key={i} style={{ color:"#e2e8f0", fontWeight:700 }}>{part}</strong> : part
                )}
              </div>
            ) : !loading ? (
              <div style={{ padding:"14px 16px", fontSize:11, color:"#2e3f5a", textAlign:"center" }}>
                Get personalised AI coaching feedback on this trade
              </div>
            ) : null}
          </div>

        </div>
      </div>
    </div>
  );
}

// ── AI Insight Cards for Insights tab ─────────────────────────
function AIInsightCard({ insight }) {
  const COLOR = {
    positive: { bg:"rgba(52,211,153,0.06)",  border:"rgba(52,211,153,0.25)",  text:"#34d399" },
    warning:  { bg:"rgba(248,113,113,0.06)", border:"rgba(248,113,113,0.25)", text:"#f87171" },
    neutral:  { bg:"rgba(56,189,248,0.06)",  border:"rgba(56,189,248,0.25)",  text:"#38bdf8" },
  };
  const c = COLOR[insight.type] ?? COLOR.neutral;

  return (
    <div style={{ borderRadius:14, background:c.bg, border:`1px solid ${c.border}`, padding:"16px 18px", position:"relative", overflow:"hidden" }}>
      {/* Glow */}
      <div style={{ position:"absolute", top:-20, right:-20, width:80, height:80, borderRadius:"50%", background:`${c.text}08`, pointerEvents:"none" }}/>
      <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:`${c.text}15`, border:`1px solid ${c.text}25`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
          {insight.icon}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:5, gap:8 }}>
            <div style={{ fontSize:12, fontWeight:800, color:"#e2e8f0" }}>{insight.title}</div>
            {insight.metric && (
              <span style={{ fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:10, background:`${c.text}15`, color:c.text, flexShrink:0 }}>{insight.metric}</span>
            )}
          </div>
          <div style={{ fontSize:11, color:"#64748b", lineHeight:1.7 }}>{insight.body}</div>
          {insight.action && (
            <div style={{ marginTop:8, fontSize:10, fontWeight:700, color:c.text, display:"flex", alignItems:"center", gap:4 }}>
              → {insight.action}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function generateInsights(trades) {
  if (trades.length < 3) return [];
  const insights = [];
  const byStrat  = insightsByStrategy(trades);
  const byTag    = insightsByTag(trades);
  const wins     = trades.filter(t => (t.pnl??0)>0);
  const winRate  = +(wins.length/trades.length*100).toFixed(1);
  const longs    = trades.filter(t => t.type==="long");
  const shorts   = trades.filter(t => t.type==="short");

  if (byStrat.length > 0) {
    const best = byStrat[0];
    if (best.winRate >= 55) insights.push({ type:"positive", icon:"🏆", title:`Best strategy: ${best.strategy}`, body:`${best.winRate}% win rate across ${best.count} trades. PnL: ${(best.pnl??0)>=0?"+":""}${(best.pnl??0).toFixed(2)}.`, metric:`${best.winRate}% WR` });
    const worst = [...byStrat].sort((a,b)=>a.winRate-b.winRate)[0];
    if (worst && worst.winRate<40 && worst.count>=3) insights.push({ type:"warning", icon:"⚠️", title:`Avoid: ${worst.strategy}`, body:`Only ${worst.winRate}% win rate on ${worst.count} trades. Consider dropping it.`, metric:`${worst.winRate}% WR` });
  }
  if (byTag.length > 0) {
    const bestTag = byTag[0];
    if (bestTag.winRate>=60) insights.push({ type:"positive", icon:"🏷️", title:`Tag "${bestTag.tag}" is working`, body:`${bestTag.winRate}% WR on ${bestTag.count} trades.`, metric:`${bestTag.winRate}% WR` });
    const worstTag = [...byTag].sort((a,b)=>a.winRate-b.winRate)[0];
    if (worstTag && worstTag.winRate<35 && worstTag.count>=2) insights.push({ type:"warning", icon:"🚫", title:`Avoid trades tagged "${worstTag.tag}"`, body:`Only ${worstTag.winRate}% WR. Total loss: ${(worstTag?.pnl??0).toFixed(2)}.`, metric:`${worstTag.winRate}% WR` });
  }
  if (longs.length>=2 && shorts.length>=2) {
    const longWR  = longs.filter(t=>(t.pnl??0)>0).length/longs.length*100;
    const shortWR = shorts.filter(t=>(t.pnl??0)>0).length/shorts.length*100;
    const better  = longWR>=shortWR?"long":"short";
    if (Math.abs(longWR-shortWR)>=15) insights.push({ type: longWR>=shortWR&&longWR>=55?"positive":"neutral", icon: better==="long"?"📈":"📉", title:`You trade ${better}s better`, body:`${better==="long"?"Longs":"Shorts"}: ${(better==="long"?longWR:shortWR).toFixed(0)}% WR vs ${(better==="long"?shortWR:longWR).toFixed(0)}% WR.`, metric:`+${Math.abs(longWR-shortWR).toFixed(0)}% edge` });
  }
  const sorted = [...trades].sort((a,b)=>a.date-b.date); let maxLoss=0, curL=0;
  sorted.forEach(t => { if((t.pnl??0)<0){curL++;maxLoss=Math.max(maxLoss,curL);}else curL=0; });
  if (maxLoss>=4) insights.push({ type:"warning", icon:"🔴", title:`Max ${maxLoss}-trade losing streak`, body:`Consider pausing after 3 consecutive losses to avoid revenge trading.`, metric:`${maxLoss} losses` });
  if (winRate>=60) insights.push({ type:"positive", icon:"✅", title:"Above-average win rate", body:`At ${winRate}% you're above the 50% threshold.`, metric:`${winRate}% WR` });
  else if (winRate<40) insights.push({ type:"warning", icon:"📉", title:`Low win rate: ${winRate}%`, body:`Check your profit factor — if above 1.5 you may be fine. Otherwise tighten entries.`, metric:`${winRate}% WR` });
  return insights.slice(0,8);
}

// ── Deep Pattern Detection ────────────────────────────────────
function detectPatterns(trades) {
  if (trades.length < 5) return [];
  const patterns = [];

  // ── 1. Time of day analysis ──────────────────────────────
  const byHour = {};
  trades.forEach(t => {
    const h = new Date(t.date).getHours();
    if (!byHour[h]) byHour[h] = { wins:0, losses:0, pnl:0 };
    if ((t.pnl??0)>0) byHour[h].wins++;
    else byHour[h].losses++;
    byHour[h].pnl += (t.pnl??0);
  });
  const hourEntries = Object.entries(byHour)
    .filter(([,v]) => v.wins + v.losses >= 2)
    .map(([h,v]) => ({ hour:parseInt(h), ...v, wr: v.wins/(v.wins+v.losses)*100 }));

  if (hourEntries.length >= 2) {
    const worst = hourEntries.sort((a,b) => a.pnl - b.pnl)[0];
    const best  = hourEntries.sort((a,b) => b.wr - a.wr)[0];
    const fmt   = h => h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h-12}pm`;

    if ((worst.pnl??0)<0 && (worst.wins + worst.losses) >= 3) {
      patterns.push({
        type:"warning", icon:"🕐", severity:"high",
        title:`Losses spike around ${fmt(worst.hour)}`,
        body:`You've lost ${Math.abs(worst.pnl??0).toFixed(2)} across ${worst.wins+worst.losses} trades at this hour with only ${worst.wr.toFixed(0)}% WR. Consider avoiding trading between ${fmt(worst.hour)} and ${fmt(worst.hour+1)}.`,
        metric:`${worst.wr.toFixed(0)}% WR`,
        action:"Avoid this time window",
      });
    }
    if (best.wr >= 65 && (best.wins + best.losses) >= 3) {
      patterns.push({
        type:"positive", icon:"⏰", severity:"medium",
        title:`Best performance at ${fmt(best.hour)}`,
        body:`You win ${best.wr.toFixed(0)}% of trades around ${fmt(best.hour)}. ${best.wins+best.losses} trades, ${(best.pnl??0)>=0 ? "+" : ""}${(best.pnl??0).toFixed(2)} total PnL. Focus more of your trading here.`,
        metric:`${best.wr.toFixed(0)}% WR`,
        action:"Trade more at this time",
      });
    }
  }

  // ── 2. Day of week analysis ──────────────────────────────
  const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const byDay = {};
  trades.forEach(t => {
    const d = new Date(t.date).getDay();
    if (!byDay[d]) byDay[d] = { wins:0, losses:0, pnl:0, count:0 };
    if ((t.pnl??0)>0) byDay[d].wins++; else byDay[d].losses++;
    byDay[d].pnl   += (t.pnl??0);
    byDay[d].count++;
  });
  const dayEntries = Object.entries(byDay)
    .filter(([,v]) => v.count >= 2)
    .map(([d,v]) => ({ day:DAYS[parseInt(d)], ...v, wr: v.wins/v.count*100 }));

  if (dayEntries.length >= 2) {
    const worstDay = [...dayEntries].sort((a,b) => a.wr - b.wr)[0];
    const bestDay  = [...dayEntries].sort((a,b) => b.wr - a.wr)[0];
    if (worstDay.wr < 40 && worstDay.count >= 3) {
      patterns.push({
        type:"warning", icon:"📅", severity:"high",
        title:`${worstDay.day}s are your worst day`,
        body:`Only ${worstDay.wr.toFixed(0)}% WR on ${worstDay.day}s across ${worstDay.count} trades. Total PnL on ${worstDay.day}s: ${(worstDay?.pnl??0).toFixed(2)}. Consider sitting out or reducing size.`,
        metric:`${worstDay.wr.toFixed(0)}% WR`,
        action:`Avoid trading on ${worstDay.day}s`,
      });
    }
    if (bestDay.wr >= 65 && bestDay.count >= 3 && bestDay.day !== worstDay?.day) {
      patterns.push({
        type:"positive", icon:"🗓️", severity:"medium",
        title:`${bestDay.day}s are your best day`,
        body:`${bestDay.wr.toFixed(0)}% WR on ${bestDay.day}s across ${bestDay.count} trades. Total: ${bestDay.pnl >= 0 ? "+" : ""}${(bestDay?.pnl??0).toFixed(2)}. Your edge is strongest here.`,
        metric:`${bestDay.wr.toFixed(0)}% WR`,
        action:`Size up on ${bestDay.day}s`,
      });
    }
  }

  // ── 3. Revenge trading / losses after losses ─────────────
  const sorted = [...trades].sort((a,b) => new Date(a.date) - new Date(b.date));
  let afterLossWins = 0, afterLossTotal = 0;
  let afterWinWins  = 0, afterWinTotal  = 0;
  let consecutiveLosses = 0, overtradeCount = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i-1], curr = sorted[i];
    const sameDay = new Date(prev.date).toDateString() === new Date(curr.date).toDateString();

    if (prev.pnl < 0) {
      afterLossTotal++;
      if (curr.pnl > 0) afterLossWins++;
      // Check for overtrading — multiple trades same day after a loss
      if (sameDay) overtradeCount++;
    } else {
      afterWinTotal++;
      if (curr.pnl > 0) afterWinWins++;
    }

    if (curr.pnl < 0) consecutiveLosses++;
    else consecutiveLosses = 0;
  }

  const afterLossWR = afterLossTotal > 3 ? (afterLossWins / afterLossTotal) * 100 : null;
  const afterWinWR  = afterWinTotal  > 3 ? (afterWinWins  / afterWinTotal)  * 100 : null;

  if (afterLossWR !== null && afterWinWR !== null) {
    const drop = afterWinWR - afterLossWR;
    if (drop >= 15) {
      patterns.push({
        type:"warning", icon:"😤", severity:"high",
        title:"Win rate drops after a loss",
        body:`After a winning trade you win ${afterWinWR.toFixed(0)}% of the time. After a losing trade it drops to ${afterLossWR.toFixed(0)}%. This suggests emotional decision-making after losses — possible revenge trading.`,
        metric:`-${drop.toFixed(0)}% WR`,
        action:"Take a break after each loss",
      });
    }
  }

  // ── 4. Overtrading detection ─────────────────────────────
  const byDate = {};
  trades.forEach(t => {
    const d = new Date(t.date).toDateString();
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(t);
  });
  const heavyDays = Object.entries(byDate)
    .filter(([,ts]) => ts.length >= 5)
    .map(([d,ts]) => ({
      date: d,
      count: ts.length,
      pnl: ts.reduce((s,t) => s+(t.pnl??0), 0),
      wr: ts.filter(t=>(t.pnl??0)>0).length/ts.length*100,
    }));

  if (heavyDays.length >= 2) {
    const avgHeavyWR  = heavyDays.reduce((s,d) => s+d.wr, 0) / heavyDays.length;
    const avgHeavyPnl = heavyDays.reduce((s,d) => s+(d.pnl??0), 0) / heavyDays.length;
    if (avgHeavyWR < 45 || avgHeavyPnl < 0) {
      patterns.push({
        type:"warning", icon:"⚡", severity:"medium",
        title:"Overtrading on busy days",
        body:`On days you trade 5+ times your average win rate is ${avgHeavyWR.toFixed(0)}% with average PnL of ${(avgHeavyPnl??0).toFixed(2)}. More trades doesn't mean more profit — quality over quantity.`,
        metric:`${avgHeavyWR.toFixed(0)}% WR`,
        action:"Set a daily trade limit",
      });
    }
  }

  // ── 5. Stop loss discipline ──────────────────────────────
  const bigLosses = trades.filter(t => (t.pnl??0)<0).sort((a,b) => a.pnl - b.pnl);
  if (bigLosses.length >= 3) {
    const avgLoss = bigLosses.reduce((s,t) => s+(t.pnl??0), 0) / bigLosses.length;
    const avgWin  = trades.filter(t=>(t.pnl??0)>0).reduce((s,t) => s+(t.pnl??0), 0) / (trades.filter(t=>(t.pnl??0)>0).length || 1);
    const rrRatio = Math.abs(avgWin / avgLoss);
    if (rrRatio < 1) {
      patterns.push({
        type:"warning", icon:"🛑", severity:"high",
        title:"Losses bigger than wins",
        body:`Your average win is ${avgWin.toFixed(2)} but your average loss is ${Math.abs(avgLoss).toFixed(2)}. R:R ratio of ${rrRatio.toFixed(2)}. Even with a good win rate this will bleed your account. Tighten stop losses.`,
        metric:`${rrRatio.toFixed(2)} R:R`,
        action:"Tighten your stop losses",
      });
    } else if (rrRatio >= 2) {
      patterns.push({
        type:"positive", icon:"✂️", severity:"low",
        title:"Excellent risk management",
        body:`Your average win (${avgWin.toFixed(2)}) is ${rrRatio.toFixed(1)}x your average loss (${Math.abs(avgLoss).toFixed(2)}). This R:R means you can be profitable even with a 40% win rate.`,
        metric:`${rrRatio.toFixed(1)}:1 R:R`,
        action:"Keep this up",
      });
    }
  }

  // ── 6. Consistency trend ─────────────────────────────────
  if (sorted.length >= 10) {
    const half   = Math.floor(sorted.length / 2);
    const first  = sorted.slice(0, half);
    const second = sorted.slice(half);
    const firstWR  = first.filter(t=>(t.pnl??0)>0).length / first.length * 100;
    const secondWR = second.filter(t=>(t.pnl??0)>0).length / second.length * 100;
    const diff = secondWR - firstWR;
    if (diff >= 10) {
      patterns.push({
        type:"positive", icon:"📈", severity:"medium",
        title:"You're improving over time",
        body:`Your win rate in recent trades (${secondWR.toFixed(0)}%) is ${diff.toFixed(0)}% higher than your earlier trades (${firstWR.toFixed(0)}%). Keep doing what you're doing.`,
        metric:`+${diff.toFixed(0)}% improvement`,
        action:"Stay consistent",
      });
    } else if (diff <= -10) {
      patterns.push({
        type:"warning", icon:"📉", severity:"high",
        title:"Performance declining recently",
        body:`Your recent win rate (${secondWR.toFixed(0)}%) is ${Math.abs(diff).toFixed(0)}% lower than earlier (${firstWR.toFixed(0)}%). Review your last 10 trades for a common mistake.`,
        metric:`${diff.toFixed(0)}% decline`,
        action:"Review your last 10 trades",
      });
    }
  }

  // Sort by severity
  const order = { high:0, medium:1, low:2 };
  return patterns.sort((a,b) => order[a.severity] - order[b.severity]);
}

function InsightsPanel({ trades }) {
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError,   setAiError]   = useState("");
  const [crashed,   setCrashed]   = useState(false);

  const insights = useMemo(() => {
    try { return generateInsights(trades); } catch { return []; }
  }, [trades]);

  const patterns = useMemo(() => {
    try { return detectPatterns(trades); } catch { return []; }
  }, [trades]);

  const generateAI = async () => {
    setAiLoading(true); setAiError(""); setAiInsight("");
    try {
      const summary = {
        totalTrades: trades.length,
        winRate: trades.length > 0 ? +(trades.filter(t=>(t.pnl??0)>0).length/trades.length*100).toFixed(1) : 0,
        totalPnl: +trades.reduce((s,t)=>s+(t.pnl??0),0).toFixed(4),
        patterns: patterns.slice(0,5).map(p => `${p.title}: ${p.body}`),
        topInsights: insights.slice(0,3).map(i=>`${i.title}: ${i.body}`),
        strategies: (() => { try { return insightsByStrategy(trades).slice(0,3); } catch { return []; } })(),
      };
      const res  = await fetch("/api/generate-insights", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ summary }) });
      const data = await res.json();
      if (!res.ok || data.error) return setAiError(data.error ?? "Failed");
      setAiInsight(data.insight);
    } catch { setAiError("Network error."); }
    finally { setAiLoading(false); }
  };

  const SEVERITY_STYLES = {
    warning:  { border:"rgba(239,68,68,0.25)",  bg:"rgba(239,68,68,0.04)",  badge:"#f87171", badgeBg:"rgba(239,68,68,0.1)",  dot:"#f87171" },
    positive: { border:"rgba(52,211,153,0.25)", bg:"rgba(52,211,153,0.04)", badge:"#34d399", badgeBg:"rgba(52,211,153,0.1)", dot:"#34d399" },
    neutral:  { border:"rgba(56,189,248,0.2)",  bg:"rgba(56,189,248,0.04)", badge:"#38bdf8", badgeBg:"rgba(56,189,248,0.1)", dot:"#38bdf8" },
  };

  if (trades.length < 5) return (
    <div style={{ padding:"32px 24px", borderRadius:12, border:"1px dashed #1a2035", textAlign:"center", color:"#334155", fontSize:12 }}>
      <div style={{ fontSize:32, marginBottom:12 }}>🔍</div>
      <div style={{ fontSize:14, fontWeight:700, color:"#475569", marginBottom:6 }}>Not enough data yet</div>
      Log at least 5 trades to unlock pattern detection
    </div>
  );

  if (crashed) return (
    <div style={{ padding:"32px 24px", borderRadius:12, border:"1px dashed rgba(248,113,113,0.3)", textAlign:"center" }}>
      <div style={{ fontSize:32, marginBottom:12 }}>⚠️</div>
      <div style={{ fontSize:14, fontWeight:700, color:"#f87171", marginBottom:6 }}>Couldn't load insights</div>
      <div style={{ fontSize:12, color:"#475569", marginBottom:16 }}>Try refreshing or logging more trades</div>
      <button onClick={() => setCrashed(false)} style={{ padding:"8px 18px", borderRadius:9, border:"1px solid rgba(56,189,248,0.3)", background:"transparent", color:"#38bdf8", fontSize:12, cursor:"pointer" }}>Try again</button>
    </div>
  );

  const warnings  = patterns.filter(p => p.type === "warning");
  const positives = patterns.filter(p => p.type === "positive");

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* Pattern Detection Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:"#f1f5f9", display:"flex", alignItems:"center", gap:8 }}>
            🔍 Pattern Detection
            <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"rgba(56,189,248,0.1)", border:"1px solid rgba(56,189,248,0.2)", color:"#38bdf8", fontWeight:700 }}>
              {patterns.length} pattern{patterns.length !== 1 ? "s" : ""} found
            </span>
          </div>
          <div style={{ fontSize:11, color:"#475569", marginTop:3 }}>Analysed {trades.length} trades for behavioural patterns</div>
        </div>
        {warnings.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:10, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)" }}>
            <span style={{ width:6, height:6, borderRadius:3, background:"#f87171", display:"inline-block" }}/>
            <span style={{ fontSize:11, color:"#f87171", fontWeight:700 }}>{warnings.length} issue{warnings.length !== 1 ? "s" : ""} need attention</span>
          </div>
        )}
      </div>

      {/* Patterns grid */}
      {patterns.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
          {patterns.map((p, i) => {
            const s = SEVERITY_STYLES[p.type] ?? SEVERITY_STYLES.neutral;
            return (
              <div key={i} style={{ borderRadius:12, border:`1px solid ${s.border}`, background:s.bg, padding:"14px 16px", display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:20, lineHeight:1 }}>{p.icon}</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:800, color:"#e2e8f0", lineHeight:1.3 }}>{p.title}</div>
                      {p.metric && <span style={{ fontSize:9, fontWeight:700, color:s.badge, background:s.badgeBg, padding:"1px 6px", borderRadius:10, marginTop:3, display:"inline-block" }}>{p.metric}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize:8, fontWeight:700, padding:"2px 6px", borderRadius:6, flexShrink:0, marginTop:2,
                    background: p.severity === "high" ? "rgba(239,68,68,0.15)" : p.severity === "medium" ? "rgba(251,191,36,0.1)" : "rgba(52,211,153,0.1)",
                    color:      p.severity === "high" ? "#f87171"              : p.severity === "medium" ? "#fbbf24"              : "#34d399",
                  }}>{p.severity?.toUpperCase()}</span>
                </div>
                <p style={{ fontSize:11, color:"#64748b", lineHeight:1.7, margin:0 }}>{p.body}</p>
                {p.action && (
                  <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:s.badge, fontWeight:700, marginTop:2 }}>
                    <span>→</span> {p.action}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {patterns.length === 0 && (
        <div style={{ padding:"24px", borderRadius:12, border:"1px solid #1a2035", textAlign:"center", color:"#334155", fontSize:12 }}>
          No strong patterns detected yet — keep logging trades for more insights
        </div>
      )}

      {/* Divider */}
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ flex:1, height:1, background:"#1a2035" }}/>
        <span style={{ fontSize:10, color:"#334155", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em" }}>Rule-based Insights</span>
        <div style={{ flex:1, height:1, background:"#1a2035" }}/>
      </div>

      {/* Existing rule-based insights — now using beautiful AIInsightCard */}
      {insights.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {insights.map((ins, i) => <AIInsightCard key={i} insight={ins}/>)}
        </div>
      )}

      {/* AI Coach */}
      <div style={{ borderRadius:12, border:"1px solid rgba(99,102,241,0.25)", background:"rgba(99,102,241,0.05)", padding:"16px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: aiInsight ? 12 : 0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <Wand2 size={13} style={{ color:"#818cf8" }}/>
            <div>
              <span style={{ fontSize:12, fontWeight:700, color:"#94a3b8" }}>AI Coach Summary</span>
              <div style={{ fontSize:10, color:"#475569", marginTop:1 }}>Claude analyzes your patterns and gives personalised advice</div>
            </div>
          </div>
          <button onClick={generateAI} disabled={aiLoading} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 16px", borderRadius:8, border:"none", background:aiLoading?"#1a2035":"linear-gradient(135deg,#4f46e5,#818cf8)", color:aiLoading?"#334155":"#fff", fontSize:11, fontWeight:700, cursor:aiLoading?"not-allowed":"pointer", flexShrink:0 }}>
            {aiLoading ? "Analyzing…" : aiInsight ? <><RefreshCw size={11}/> Re-analyze</> : <><Sparkles size={11}/> Analyze my trades</>}
          </button>
        </div>
        {aiInsight && <div style={{ fontSize:12, color:"#94a3b8", lineHeight:1.9, borderTop:"1px solid rgba(99,102,241,0.15)", paddingTop:12, whiteSpace:"pre-wrap" }}>{aiInsight}</div>}
        {aiError   && <div style={{ marginTop:8, fontSize:11, color:"#f87171", display:"flex", alignItems:"center", gap:6 }}><AlertCircle size={11}/>{aiError}</div>}
      </div>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  STRATEGY CARDS
// ═══════════════════════════════════════════════════════════════

function StrategyCards({ trades }) {
  const byStrat = useMemo(() => insightsByStrategy(trades), [trades]);
  if (!byStrat.length) return <div style={{ padding:"32px", textAlign:"center", color:"#334155", borderRadius:12, border:"1px dashed #1a2035", fontSize:12 }}>Log trades with different strategies to see performance breakdowns</div>;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12 }}>
      {byStrat.map(s => {
        const pnlPos = s.pnl >= 0;
        return (
          <div key={s.strategy} style={{ borderRadius:12, border:`1px solid ${pnlPos?"rgba(52,211,153,0.2)":"rgba(239,68,68,0.2)"}`, background:"#0d1120", padding:"16px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#e2e8f0" }}>{s.strategy}</div>
              <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background: s.winRate>=50?"rgba(52,211,153,0.1)":"rgba(239,68,68,0.1)", color: s.winRate>=50?"#34d399":"#f87171", border:`1px solid ${s.winRate>=50?"rgba(52,211,153,0.3)":"rgba(239,68,68,0.3)"}`}}>{s.winRate}% WR</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
              {[
                { label:"Trades",    val:String(s.count),                                          color:"#94a3b8" },
                { label:"PnL",       val:`${pnlPos?"+":""}${(s.pnl??0).toFixed(2)}`,                   color:pnlPos?"#34d399":"#f87171" },
                { label:"Avg/Trade", val:`${(s.pnl??0)/s.count>=0?"+":""}${((s.pnl??0)/s.count).toFixed(2)}`, color:(s.pnl??0)/s.count>=0?"#34d399":"#f87171" },
              ].map(({ label,val,color }) => (
                <div key={label} style={{ textAlign:"center", padding:"8px 4px", borderRadius:7, background:"#111827" }}>
                  <div style={{ fontSize:8, color:"#334155", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:12, fontWeight:700, fontFamily:"monospace", color }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:12, height:4, borderRadius:2, background:"#1a2035", overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${s.winRate}%`, background: s.winRate>=50?"#10b981":"#ef4444", borderRadius:2 }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PAPER TRADING ACCOUNT SYSTEM
// ═══════════════════════════════════════════════════════════════

const ACCOUNTS_STORAGE_KEY = (u) => `tradedesk_paper_accounts_${u}_v1`;
const ACTIVE_ACCOUNT_KEY   = (u) => `tradedesk_active_account_${u}_v1`;

// ── Account model ─────────────────────────────────────────────
// ── Account progression tiers ─────────────────────────────────
const ACCOUNT_TIERS = [
  { size: 10000,  label: "$10k",  next: 50000,  targetPct: 10, color: "#38bdf8" },
  { size: 50000,  label: "$50k",  next: 100000, targetPct: 10, color: "#a78bfa" },
  { size: 100000, label: "$100k", next: null,   targetPct: 10, color: "#f59e0b" },
];

function getAccountTier(startingBalance) {
  return ACCOUNT_TIERS.find(t => t.size === startingBalance) ?? ACCOUNT_TIERS[0];
}

function checkUpgradeEligible(account) {
  const tier = getAccountTier(account.startingBalance);
  if (!tier.next) return null;
  const pnl     = account.balance - account.startingBalance;
  const pnlPct  = (pnl / account.startingBalance) * 100;
  return pnlPct >= tier.targetPct ? tier.next : null;
}

// ── Account upgrade banner ─────────────────────────────────────
function AccountUpgradeBanner({ account, onUpgrade }) {
  const nextSize = checkUpgradeEligible(account);
  if (!nextSize || account.type !== "paper") return null;

  const tier    = getAccountTier(account.startingBalance);
  const pnl     = account.balance - account.startingBalance;
  const pnlPct  = (pnl / account.startingBalance) * 100;

  return (
    <div style={{ padding:"14px 18px", borderRadius:12, background:"linear-gradient(135deg,rgba(245,158,11,0.1),rgba(167,139,250,0.08))", border:"1px solid rgba(245,158,11,0.4)", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
      <div style={{ fontSize:28 }}>🎉</div>
      <div style={{ flex:1, minWidth:200 }}>
        <div style={{ fontSize:13, fontWeight:800, color:"#f59e0b", marginBottom:4 }}>
          You've hit +{pnlPct.toFixed(1)}% on your {tier.label} account!
        </div>
        <div style={{ fontSize:11, color:"#94a3b8" }}>
          You're eligible to upgrade to a ${nextSize.toLocaleString()} paper account. Keep your track record and start fresh with more capital.
        </div>
      </div>
      <button onClick={() => onUpgrade(nextSize)} style={{ padding:"9px 20px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#d97706,#f59e0b)", color:"#000", fontSize:12, fontWeight:800, cursor:"pointer", flexShrink:0 }}>
        Upgrade to ${nextSize.toLocaleString()} →
      </button>
    </div>
  );
}

// { id, name, type: "paper"|"funded"|"real", balance, startingBalance, createdAt }

function loadPaperAccounts(username) {
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY(username));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function savePaperAccounts(username, accounts) {
  localStorage.setItem(ACCOUNTS_STORAGE_KEY(username), JSON.stringify(accounts));
}

function loadActiveAccountId(username) {
  return localStorage.getItem(ACTIVE_ACCOUNT_KEY(username)) ?? null;
}

function saveActiveAccountId(username, id) {
  localStorage.setItem(ACTIVE_ACCOUNT_KEY(username), id);
}

function makeDefaultAccount() {
  return {
    id:              `acct_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    name:            "Paper Account",
    type:            "paper",
    balance:         10000,
    startingBalance: 10000,
    createdAt:       Date.now(),
  };
}

// Trade execution routing — paper vs funded
function executeTrade(trade, account) {
  if (account.type === "paper") {
    // Simulate: PnL already calculated at log time — just tag with accountId
    return { ...trade, accountId: account.id };
  }
  if (account.type === "funded") {
    // Placeholder — wire real broker API here in the future
    console.warn("[Nexyru] Funded account execution not yet implemented.");
    return { ...trade, accountId: account.id, _fundedPending: true };
  }
  return trade;
}

// ── usePaperAccounts hook ──────────────────────────────────────
function usePaperAccounts(username) {
  const [accounts, setAccounts] = useState(() => {
    const saved = loadPaperAccounts(username);
    // If there's only a funded account with $0, add a paper account too
    if (saved && saved.length) {
      const hasPaper = saved.some(a => a.type === "paper");
      if (!hasPaper) {
        const def = makeDefaultAccount();
        const next = [def, ...saved];
        savePaperAccounts(username, next);
        return next;
      }
      return saved;
    }
    const def = makeDefaultAccount();
    savePaperAccounts(username, [def]);
    return [def];
  });

  const [activeId, setActiveIdState] = useState(() => {
    const saved = loadActiveAccountId(username);
    const accts = loadPaperAccounts(username);
    // Prefer paper account as default
    const paperAcct = accts?.find(a => a.type === "paper");
    const preferredId = saved ?? paperAcct?.id ?? accts?.[0]?.id ?? null;
    if (preferredId) saveActiveAccountId(username, preferredId);
    return preferredId;
  });

  // Ensure activeId is always valid
  useEffect(() => {
    if (!activeId && accounts.length > 0) {
      const paper = accounts.find(a => a.type === "paper") ?? accounts[0];
      saveActiveAccountId(username, paper.id);
      setActiveIdState(paper.id);
    }
  }, [accounts, activeId, username]);

  const persist = useCallback((next) => {
    savePaperAccounts(username, next);
    setAccounts(next);
  }, [username]);

  const activeAccount = accounts.find(a => a.id === activeId) ?? accounts[0];

  const setActiveAccount = useCallback((id) => {
    saveActiveAccountId(username, id);
    setActiveIdState(id);
  }, [username]);

  const addAccount = useCallback((name, type, startingBalance) => {
    const acc = {
      id:              `acct_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      name:            name.trim() || (type === "paper" ? "Paper Account" : "Funded Account"),
      type,
      balance:         type === "paper" ? startingBalance : 0,
      startingBalance: type === "paper" ? startingBalance : 0,
      createdAt:       Date.now(),
    };
    const next = [...accounts, acc];
    persist(next);
    setActiveAccount(acc.id);
    return acc;
  }, [accounts, persist, setActiveAccount]);

  const deleteAccount = useCallback((id) => {
    if (accounts.length <= 1) return; // always keep one
    const next = accounts.filter(a => a.id !== id);
    persist(next);
    if (activeId === id) setActiveAccount(next[0].id);
  }, [accounts, activeId, persist, setActiveAccount]);

  // Sync balance from trades: starting balance ± sum of all trade PnLs for this account
  const syncBalance = useCallback((allTrades) => {
    setAccounts(prev => {
      const next = prev.map(acc => {
        const acctTrades = allTrades.filter(t => t.accountId === acc.id);
        const pnl        = acctTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
        return { ...acc, balance: +(acc.startingBalance + pnl).toFixed(4) };
      });
      savePaperAccounts(username, next);
      return next;
    });
  }, [username]);

  return { accounts, activeAccount, setActiveAccount, addAccount, deleteAccount, syncBalance };
}

// ── AddAccountModal ────────────────────────────────────────────
function AddAccountModal({ onAdd, onClose }) {
  const [name,    setName]    = useState("");
  const [type,    setType]    = useState("paper");
  const [balance, setBalance] = useState("10000");
  const [broker,  setBroker]  = useState("tradovate");
  const [err,     setErr]     = useState("");

  const submit = () => {
    if (!name.trim()) return setErr("Account name is required.");
    if (type === "paper") {
      const b = parseFloat(balance);
      if (!b || b <= 0) return setErr("Starting balance must be a positive number.");
      if (b > 10_000_000) return setErr("Starting balance too large.");
    }
    onAdd(name, type, parseFloat(balance) || 10000);
    onClose();
  };

  const inp = {
    width:"100%", padding:"9px 12px", borderRadius:8, boxSizing:"border-box",
    background:"#111827", border:"1px solid #1e2d3e", fontSize:12, color:"#e2e8f0", outline:"none",
  };
  const lbl = { display:"block", fontSize:10, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:90, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)" }}/>
      <div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:400, borderRadius:16, border:"1px solid #1a2035", background:"#0d1120", boxShadow:"0 25px 60px rgba(0,0,0,0.6)", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid #1a2035" }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#e2e8f0", display:"flex", alignItems:"center", gap:8 }}>
            <Wallet size={15} style={{ color:"#38bdf8" }}/> New Trading Account
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer" }}><X size={16}/></button>
        </div>

        <div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:16 }}>

          {/* Account type toggle */}
          <div>
            <label style={lbl}>Account Type</label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
              {[
                { id:"paper",  icon:"📄", label:"Paper",   desc:"Simulated — risk free", color:"#38bdf8" },
                { id:"funded", icon:"💰", label:"Funded",  desc:"Prop firm account",      color:"#a78bfa" },
                { id:"real",   icon:"🔗", label:"Real",    desc:"Your own capital",       color:"#34d399" },
              ].map(t => (
                <button key={t.id} onClick={() => setType(t.id)} style={{
                  padding:"12px 10px", borderRadius:10, textAlign:"left", cursor:"pointer",
                  border:`1px solid ${type===t.id ? t.color+"50" : "#1a2035"}`,
                  background: type===t.id ? t.color+"10" : "#111827",
                  transition:"all 0.15s",
                }}>
                  <div style={{ fontSize:18, marginBottom:5 }}>{t.icon}</div>
                  <div style={{ fontSize:11, fontWeight:700, color: type===t.id ? t.color : "#64748b", marginBottom:3 }}>{t.label}</div>
                  <div style={{ fontSize:9, color:"#334155", lineHeight:1.4 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Paper — free size selection */}
          {type === "paper" && (
            <div>
              <label style={lbl}>Account Size</label>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
                {[10000, 50000, 100000].map(size => (
                  <button key={size} onClick={() => setBalance(String(size))} style={{
                    padding:"12px 10px", borderRadius:10, textAlign:"center", cursor:"pointer",
                    border:`1px solid ${balance===String(size) ? "#38bdf855" : "#1a2035"}`,
                    background: balance===String(size) ? "#38bdf810" : "#111827",
                    transition:"all 0.15s",
                  }}>
                    <div style={{ fontSize:14, fontWeight:900, color: balance===String(size) ? "#38bdf8" : "#64748b", fontFamily:"monospace" }}>
                      ${(size/1000).toFixed(0)}k
                    </div>
                    <div style={{ fontSize:9, color:"#334155", marginTop:3 }}>
                      {size === 10000 ? "Starter" : size === 50000 ? "Intermediate" : "Advanced"}
                    </div>
                  </button>
                ))}
              </div>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:12, color:"#475569", fontWeight:700 }}>$</span>
                <input type="number" style={{ ...inp, paddingLeft:24 }} value={balance} onChange={e => setBalance(e.target.value)} min="100" placeholder="Custom amount" onKeyDown={e => e.key === "Enter" && submit()}/>
              </div>
              <div style={{ fontSize:10, color:"#334155", marginTop:6 }}>Or enter any custom amount — match your TradingView paper account exactly</div>
            </div>
          )}

          {/* Account name */}
          <div>
            <label style={lbl}>Account Name</label>
            <input style={inp} value={name} onChange={e => setName(e.target.value)}
              placeholder={type === "paper" ? "e.g. Main Paper, Scalping Lab" : type === "real" ? "e.g. My Tradovate Account" : "e.g. Tradeify Funded"}
              onKeyDown={e => e.key === "Enter" && submit()}
            />
          </div>

          {/* Real account — broker info */}
          {type === "real" && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <label style={lbl}>Broker</label>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                  {["Tradovate","Apex","TopstepX","NinjaTrader","IBKR","Other"].map(b => (
                    <button key={b} onClick={() => setBroker(b.toLowerCase())} style={{ padding:"7px 6px", borderRadius:8, fontSize:10, fontWeight:700, cursor:"pointer", border:`1px solid ${broker===b.toLowerCase()?"rgba(52,211,153,0.4)":"#1a2035"}`, background:broker===b.toLowerCase()?"rgba(52,211,153,0.1)":"#111827", color:broker===b.toLowerCase()?"#34d399":"#64748b" }}>{b}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={lbl}>Starting Balance (USD)</label>
                <div style={{ position:"relative" }}>
                  <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:12, color:"#475569", fontWeight:700 }}>$</span>
                  <input type="number" style={{ ...inp, paddingLeft:24 }} value={balance} onChange={e => setBalance(e.target.value)} min="100" placeholder="50000" onKeyDown={e => e.key === "Enter" && submit()}/>
                </div>
              </div>
              <div style={{ padding:"10px 12px", borderRadius:9, background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.2)", fontSize:11, color:"#64748b", lineHeight:1.6 }}>
                Import trades via <strong style={{ color:"#34d399" }}>CSV export</strong> from your broker. Auto-import via API coming soon when you get a funded Tradovate account.
              </div>
            </div>
          )}

          {/* Funded account notice */}
          {type === "funded" && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <label style={lbl}>Prop Firm</label>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                  {["Tradeify","Apex","TopstepX","Earn2Trade","FTMO","Other"].map(b => (
                    <button key={b} onClick={() => setBroker(b.toLowerCase())} style={{ padding:"7px 6px", borderRadius:8, fontSize:10, fontWeight:700, cursor:"pointer", border:`1px solid ${broker===b.toLowerCase()?"rgba(167,139,250,0.4)":"#1a2035"}`, background:broker===b.toLowerCase()?"rgba(167,139,250,0.1)":"#111827", color:broker===b.toLowerCase()?"#a78bfa":"#64748b" }}>{b}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={lbl}>Account Size (USD)</label>
                <div style={{ position:"relative" }}>
                  <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:12, color:"#475569", fontWeight:700 }}>$</span>
                  <input type="number" style={{ ...inp, paddingLeft:24 }} value={balance} onChange={e => setBalance(e.target.value)} min="100" placeholder="100000" onKeyDown={e => e.key === "Enter" && submit()}/>
                </div>
              </div>
              <div style={{ padding:"10px 12px", borderRadius:9, background:"rgba(167,139,250,0.06)", border:"1px solid rgba(167,139,250,0.2)", fontSize:11, color:"#64748b", lineHeight:1.6 }}>
                Import your funded account trades via <strong style={{ color:"#a78bfa" }}>CSV export</strong> from Tradovate. Trades tagged as <strong style={{ color:"#a78bfa" }}>✓ BROKER</strong> count toward your verified rank.
              </div>
            </div>
          )}

          {err && (
            <div style={{ padding:"9px 12px", borderRadius:8, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", fontSize:12, color:"#f87171", display:"flex", alignItems:"center", gap:7 }}>
              <AlertCircle size={12}/>{err}
            </div>
          )}

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid #1e2d3e", background:"transparent", color:"#64748b", fontSize:12, fontWeight:600, cursor:"pointer" }}>Cancel</button>
            <button onClick={submit} style={{ flex:2, padding:"10px", borderRadius:9, border:"none", background: type==="paper" ? "linear-gradient(135deg,#0369a1,#38bdf8)" : "linear-gradient(135deg,#4c1d95,#a78bfa)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", boxShadow: type==="paper" ? "0 4px 16px rgba(56,189,248,0.25)" : "0 4px 16px rgba(167,139,250,0.25)" }}>
              Create {type === "paper" ? "Paper" : "Funded"} Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AccountSwitcher (top bar dropdown) ────────────────────────
function AccountSwitcher({ accounts, activeAccount, onSwitch, onAdd, trades }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  if (!activeAccount) return null;

  const pnl     = activeAccount.balance - activeAccount.startingBalance;
  const pnlPct  = activeAccount.startingBalance > 0 ? (pnl / activeAccount.startingBalance * 100) : 0;
  const pnlPos  = pnl >= 0;
  const typeClr = activeAccount.type === "real" ? "#34d399" : activeAccount.type === "funded" ? "#a78bfa" : "#38bdf8";
  const canUpgrade = checkUpgradeEligible(activeAccount);

  return (
    <div ref={ref} style={{ position:"relative", flexShrink:0 }}>
      {/* Trigger button */}
      <button onClick={() => setOpen(v => !v)} style={{
        display:"flex", alignItems:"center", gap:8, padding:"5px 10px", borderRadius:8,
        border:`1px solid ${open ? typeClr + "50" : "#1a2035"}`,
        background: open ? typeClr + "08" : "#111827",
        cursor:"pointer", transition:"all 0.15s",
      }}>
        {/* Account type dot — pulse if upgrade available */}
        <span style={{ width:7, height:7, borderRadius:"50%", background: canUpgrade ? "#f59e0b" : typeClr, flexShrink:0, animation: canUpgrade ? "pulse 1.5s infinite" : "none" }}/>
        <div style={{ textAlign:"left" }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#e2e8f0", whiteSpace:"nowrap", maxWidth:120, overflow:"hidden", textOverflow:"ellipsis" }}>
            {activeAccount.name} {canUpgrade ? "⬆️" : ""}
          </div>
          <div style={{ fontSize:9, fontFamily:"monospace", color: pnlPos ? "#34d399" : "#f87171" }}>
            ${activeAccount.balance.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 })}
            <span style={{ opacity:0.7 }}> {pnlPos?"+":""}{pnlPct.toFixed(1)}%</span>
          </div>
        </div>
        <ChevronDown size={11} style={{ color:"#475569", transform:open?"rotate(180deg)":"none", transition:"transform 0.2s", flexShrink:0 }}/>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", right:0,
          width:260, borderRadius:12, border:"1px solid #1a2035",
          background:"#0d1120", boxShadow:"0 16px 48px rgba(0,0,0,0.5)",
          zIndex:200, overflow:"hidden",
        }}>
          {/* Header */}
          <div style={{ padding:"10px 14px", borderBottom:"1px solid #1a2035", fontSize:9, fontWeight:700, color:"#334155", textTransform:"uppercase", letterSpacing:"0.07em" }}>
            Trading Accounts
          </div>

          {/* Account list */}
          <div style={{ maxHeight:280, overflowY:"auto" }}>
            {accounts.map(acc => {
              const ap    = acc.balance - acc.startingBalance;
              const apPct = acc.startingBalance > 0 ? (ap / acc.startingBalance * 100) : 0;
              const apPos = ap >= 0;
              const tc    = acc.type === "funded" ? "#a78bfa" : "#38bdf8";
              const isAct = acc.id === activeAccount.id;
              const accTrades = trades.filter(t => t.accountId === acc.id);
              return (
                <button key={acc.id} onClick={() => { onSwitch(acc.id); setOpen(false); }} style={{
                  width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
                  border:"none", cursor:"pointer", textAlign:"left",
                  background: isAct ? tc + "10" : "transparent",
                  borderLeft: isAct ? `2px solid ${tc}` : "2px solid transparent",
                  transition:"background 0.12s",
                }}
                onMouseEnter={e => { if (!isAct) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = "transparent"; }}
                >
                  {/* Icon */}
                  <div style={{ width:32, height:32, borderRadius:8, background: isAct ? tc+"20" : "#1a2035", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <span style={{ fontSize:14 }}>{acc.type === "funded" ? "💰" : "📄"}</span>
                  </div>
                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ fontSize:11, fontWeight:700, color:"#e2e8f0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{acc.name}</span>
                      <span style={{ fontSize:8, fontWeight:700, color:tc, background:tc+"15", padding:"1px 5px", borderRadius:8, flexShrink:0 }}>{acc.type}</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
                      <span style={{ fontSize:10, fontFamily:"monospace", color:"#94a3b8" }}>${acc.balance.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
                      <span style={{ fontSize:9, fontFamily:"monospace", color: apPos?"#34d399":"#f87171" }}>{apPos?"+":""}{apPct.toFixed(1)}%</span>
                      <span style={{ fontSize:9, color:"#334155" }}>·</span>
                      <span style={{ fontSize:9, color:"#334155" }}>{accTrades.length} trades</span>
                    </div>
                  </div>
                  {isAct && <Check size={13} style={{ color:tc, flexShrink:0 }}/>}
                </button>
              );
            })}
          </div>

          {/* Add account */}
          <div style={{ padding:"8px 12px", borderTop:"1px solid #1a2035" }}>
            <button onClick={() => { onAdd(); setOpen(false); }} style={{
              width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
              padding:"8px", borderRadius:8, border:"1px dashed #1e2d3e",
              background:"transparent", color:"#38bdf8", fontSize:11, fontWeight:700, cursor:"pointer",
            }}>
              <Plus size={12}/> New Account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Account Stats Card (shown on Dashboard) ───────────────────
function AccountStatsCard({ activeAccount, trades }) {
  if (!activeAccount) return null;

  const accTrades = trades.filter(t => t.accountId === activeAccount.id);
  const pnl       = activeAccount.balance - activeAccount.startingBalance;
  const pnlPct    = activeAccount.startingBalance > 0 ? (pnl / activeAccount.startingBalance * 100) : 0;
  const pnlPos    = pnl >= 0;
  const typeClr   = activeAccount.type === "funded" ? "#a78bfa" : "#38bdf8";
  const wins      = accTrades.filter(t => (t.pnl??0)>0).length;
  const wr        = accTrades.length ? +((wins / accTrades.length) * 100).toFixed(1) : 0;

  return (
    <div style={{
      borderRadius:12, overflow:"hidden",
      border:`1px solid ${typeClr}30`,
      background:`linear-gradient(135deg, ${typeClr}08, rgba(13,17,32,0.9))`,
    }}>
      {/* Account header */}
      <div style={{ padding:"12px 16px", borderBottom:`1px solid ${typeClr}20`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:16 }}>{activeAccount.type === "funded" ? "💰" : "📄"}</span>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#e2e8f0" }}>{activeAccount.name}</div>
            <div style={{ fontSize:9, fontWeight:700, color:typeClr, textTransform:"uppercase", letterSpacing:"0.08em" }}>{activeAccount.type} account</div>
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:18, fontWeight:800, fontFamily:"monospace", color:"#f1f5f9" }}>
            ${activeAccount.balance.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
          </div>
          <div style={{ fontSize:10, fontFamily:"monospace", color: pnlPos?"#34d399":"#f87171" }}>
            {pnlPos?"+":""}{pnlPct.toFixed(2)}% return
          </div>
        </div>
      </div>
      {/* Mini stats */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", padding:"10px 0" }}>
        {[
          { label:"Balance",  val:`$${activeAccount.balance.toLocaleString("en-US",{minimumFractionDigits:2})}`, color:"#f1f5f9" },
          { label:"PnL",      val:`${pnlPos?"+":""}${pnl.toFixed(2)}`,              color:pnlPos?"#34d399":"#f87171" },
          { label:"Return",   val:`${pnlPos?"+":""}${pnlPct.toFixed(2)}%`,          color:pnlPos?"#34d399":"#f87171" },
          { label:"Win Rate", val:accTrades.length ? `${wr}%` : "—",                color:wr>=50?"#34d399":"#fbbf24" },
        ].map(({ label,val,color }) => (
          <div key={label} style={{ textAlign:"center", padding:"4px 8px", borderRight:"1px solid rgba(30,41,59,0.4)" }}>
            <div style={{ fontSize:8, color:"#334155", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{label}</div>
            <div style={{ fontSize:11, fontWeight:700, fontFamily:"monospace", color }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Score & ranking helpers ───────────────────────────────────

function calculateWinRate(trades) {
  if (!trades.length) return 0;
  return +((trades.filter(t => (t.pnl??0)>0).length / trades.length) * 100).toFixed(1);
}

function calculatePnL(trades) {
  return +trades.reduce((s, t) => s + (t.pnl ?? 0), 0).toFixed(4);
}

function calculateScore(trades) {
  if (!trades.length) return 0;
  const wr     = calculateWinRate(trades) / 100;          // 0-1
  const totalPnl = calculatePnL(trades);
  const n      = trades.length;
  const wins   = trades.filter(t => (t.pnl??0)>0);
  const losses = trades.filter(t => (t.pnl??0)<0);
  const grossWin  = wins.reduce((s,t)=>s+(t.pnl??0),0);
  const grossLoss = Math.abs(losses.reduce((s,t)=>s+(t.pnl??0),0));
  const pf     = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 5 : 0;
  // Composite: 40% win-rate, 30% profit factor, 20% total PnL (normalised), 10% trade count
  const pnlScore  = Math.tanh(totalPnl / 1000) * 100;    // sigmoid-like, caps extremes
  const countBonus = Math.min(n / 20, 1) * 10;           // up to 10 pts for activity
  return +(wr * 40 + Math.min(pf, 5) / 5 * 30 + pnlScore * 0.2 + countBonus).toFixed(1);
}

function getPerformanceBadges(trades) {
  const badges = [];
  if (!trades.length) return badges;
  const wr       = calculateWinRate(trades);
  const pnl      = calculatePnL(trades);
  const n        = trades.length;
  const wins     = trades.filter(t => (t.pnl??0)>0);
  const losses   = trades.filter(t => (t.pnl??0)<0);
  const grossWin  = wins.reduce((s,t)=>s+(t.pnl??0),0);
  const grossLoss = Math.abs(losses.reduce((s,t)=>s+(t.pnl??0),0));
  const pf        = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 5 : 0;

  if (wr >= 65 && n >= 5)      badges.push({ emoji:"🔥", label:"High Win Rate", color:"#fbbf24", bg:"rgba(251,191,36,0.12)" });
  if (pnl > 0 && n >= 10)      badges.push({ emoji:"🟢", label:"Consistent",   color:"#34d399", bg:"rgba(52,211,153,0.12)" });
  if (pf >= 2.5)               badges.push({ emoji:"⭐", label:"High PF",       color:"#818cf8", bg:"rgba(129,140,248,0.12)" });
  if (n >= 20)                  badges.push({ emoji:"📊", label:"Veteran",       color:"#38bdf8", bg:"rgba(56,189,248,0.12)" });
  if (grossLoss > grossWin * 0.4) badges.push({ emoji:"⚠️", label:"High Risk",  color:"#f97316", bg:"rgba(249,115,22,0.12)" });
  return badges;
}

function filterTradesByRange(trades, range) {
  if (range === "all") return trades;
  const now  = Date.now();
  const ms   = range === "day" ? 86_400_000 : range === "week" ? 7 * 86_400_000 : 30 * 86_400_000;
  return trades.filter(t => t.date >= now - ms);
}

function buildLeaderboard(range = "all") {
  try {
    const accounts = JSON.parse(localStorage.getItem(AUTH_KEY) || "{}");
    return Object.entries(accounts)
      .map(([username, acc]) => {
        const allTrades  = getTraderJournal(username);
        const trades     = filterTradesByRange(allTrades, range);
        const followers  = countFollowers(username);
        return {
          username, displayName: acc.displayName,
          trades, totalTrades: trades.length, allTimeTradeCount: allTrades.length,
          pnl:      calculatePnL(trades),
          winRate:  calculateWinRate(trades),
          score:    calculateScore(trades),
          badges:   getPerformanceBadges(trades),
          followers,
          avgPnl:   trades.length ? +(calculatePnL(trades) / trades.length).toFixed(4) : 0,
        };
      })
      .filter(t => t.allTimeTradeCount > 0) // only show traders who have logged trades
      .sort((a, b) => b.score - a.score);
  } catch { return []; }
}

function countFollowers(username) {
  try {
    const all = JSON.parse(localStorage.getItem(COPY_FOLLOWS_KEY) || "{}");
    return Object.values(all).filter(u => (u.following ?? []).some(f => f.trader === username)).length;
  } catch { return 0; }
}

// ── Trader Profile (full-page modal) ──────────────────────────

function TraderProfile({ username, displayName, session, copyTrading, onClose }) {
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    setTrades(getTraderJournal(username));
  }, [username]);

  const stats  = useMemo(() => computeTraderStats(username), [username, trades]);
  const badges = useMemo(() => getPerformanceBadges(trades), [trades]);
  const isFollowing = copyTrading.isFollowing(username);
  const isSelf      = username === session.username;
  const rel         = copyTrading.follows.find(f => f.trader === username);
  const followers   = countFollowers(username);

  const chartData = useMemo(() => {
    const sorted = [...trades].sort((a,b) => a.date - b.date);
    let cum = 0;
    return sorted.map(t => ({
      label: new Date(t.date).toLocaleDateString("en-US", { month:"short", day:"numeric" }),
      cumPnl: +(cum += (t.pnl??0)).toFixed(4),
    }));
  }, [trades]);

  const byStrat = useMemo(() => insightsByStrategy(trades), [trades]);
  const finalPnl  = chartData.length ? chartData[chartData.length-1].cumPnl : 0;
  const lineClr   = finalPnl >= 0 ? "#10b981" : "#ef4444";
  const recent    = [...trades].sort((a,b) => b.date - a.date).slice(0,8);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(6px)" }}/>
      <div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:720, maxHeight:"92vh", borderRadius:20, border:"1px solid #1a2035", background:"#0d1120", boxShadow:"0 30px 80px rgba(0,0,0,0.7)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #1a2035", background:"linear-gradient(135deg,rgba(3,105,161,0.15),rgba(56,189,248,0.08))" }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:16 }}>
              <div style={{ width:56, height:56, borderRadius:"50%", background:"linear-gradient(135deg,#0369a1,#38bdf8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:800, color:"#fff", flexShrink:0 }}>{displayName[0].toUpperCase()}</div>
              <div>
                <div style={{ fontSize:18, fontWeight:800, color:"#f1f5f9" }}>{displayName}</div>
                <div style={{ fontSize:11, color:"#475569", fontFamily:"monospace" }}>@{username}</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:8 }}>
                  {badges.map(b => (
                    <span key={b.label} style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:b.bg, color:b.color, border:`1px solid ${b.color}30` }}>{b.emoji} {b.label}</span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {!isSelf && (
                <button onClick={() => isFollowing ? copyTrading.unfollow(username) : copyTrading.follow(username)} style={{ display:"flex", alignItems:"center", gap:5, padding:"8px 16px", borderRadius:9, border:`1px solid ${isFollowing?"rgba(239,68,68,0.4)":"rgba(56,189,248,0.4)"}`, background:isFollowing?"rgba(239,68,68,0.08)":"rgba(56,189,248,0.08)", color:isFollowing?"#f87171":"#38bdf8", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                  {isFollowing ? <><UserMinus size={13}/> Unfollow</> : <><UserCheck size={13}/> Follow</>}
                </button>
              )}
              <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", padding:4 }}><X size={18}/></button>
            </div>
          </div>

          {/* Key stats row */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginTop:20 }}>
            {[
              { label:"Score",     val: String(+(calculateScore(trades)).toFixed(0)),              color:"#818cf8" },
              { label:"PnL",       val: `${stats.totalPnl>=0?"+":""}${(stats.totalPnl??0).toFixed(2)}`, color: stats.totalPnl>=0?"#34d399":"#f87171" },
              { label:"Win Rate",  val: `${stats.winRate}%`,                                       color: stats.winRate>=50?"#34d399":"#fbbf24" },
              { label:"Trades",    val: String(stats.totalTrades),                                  color:"#94a3b8" },
              { label:"Followers", val: String(followers),                                          color:"#38bdf8" },
            ].map(({ label,val,color }) => (
              <div key={label} style={{ textAlign:"center", padding:"10px 8px", borderRadius:10, background:"rgba(17,24,39,0.6)", border:"1px solid rgba(30,45,62,0.8)" }}>
                <div style={{ fontSize:8, color:"#334155", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:15, fontWeight:800, fontFamily:"monospace", color }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Multiplier (following only) */}
          {isFollowing && !isSelf && (
            <div style={{ marginTop:12, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", borderRadius:8, background:"rgba(56,189,248,0.06)", border:"1px solid rgba(56,189,248,0.15)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}><Repeat2 size={11} style={{ color:"#38bdf8" }}/><span style={{ fontSize:11, color:"#64748b" }}>Copy multiplier:</span></div>
              <div style={{ display:"flex", gap:4 }}>{[0.25,0.5,1,2,3].map(m => <button key={m} onClick={()=>copyTrading.setMultiplier(username,m)} style={{ padding:"3px 8px", borderRadius:6, fontSize:10, fontWeight:700, cursor:"pointer", border:"none", background:rel?.multiplier===m?"#38bdf8":"#1a2035", color:rel?.multiplier===m?"#000":"#475569" }}>{m}x</button>)}</div>
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div style={{ flex:1, overflowY:"auto", padding:"20px 24px", display:"flex", flexDirection:"column", gap:20 }}>

          {/* Equity curve */}
          {chartData.length > 1 && (
            <div style={{ borderRadius:12, border:"1px solid rgba(51,65,85,0.6)", background:"rgba(15,23,42,0.85)", padding:"16px 16px 8px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                <span style={{ fontSize:12, fontWeight:600, color:"#cbd5e1" }}>Equity Curve</span>
                <span style={{ fontSize:12, fontFamily:"monospace", fontWeight:700, color:lineClr }}>{finalPnl>=0?"+":""}{(finalPnl??0).toFixed(4)}</span>
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={chartData} margin={{ top:4,right:4,left:-20,bottom:0 }}>
                  <defs><linearGradient id={`grad_${username}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={lineClr} stopOpacity={0.25}/><stop offset="95%" stopColor={lineClr} stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" vertical={false}/>
                  <XAxis dataKey="label" tick={{ fontSize:9, fill:"#64748b" }} tickLine={false} axisLine={false}/>
                  <YAxis tick={{ fontSize:9, fill:"#64748b" }} tickLine={false} axisLine={false}/>
                  <Tooltip contentStyle={{ background:"#0d1120", border:"1px solid #1e2d3e", borderRadius:8, fontSize:11 }} itemStyle={{ color:lineClr }}/>
                  <Area type="monotone" dataKey="cumPnl" stroke={lineClr} strokeWidth={2} fill={`url(#grad_${username})`} dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Strategy breakdown */}
          {byStrat.length > 0 && (
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"#94a3b8", marginBottom:10 }}>Strategy Breakdown</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:8 }}>
                {byStrat.map(s => (
                  <div key={s.strategy} style={{ borderRadius:9, border:`1px solid ${(s.pnl??0)>=0?"rgba(52,211,153,0.2)":"rgba(239,68,68,0.2)"}`, background:"rgba(17,24,39,0.6)", padding:"10px 12px" }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#e2e8f0", marginBottom:6, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.strategy}</div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, fontFamily:"monospace" }}>
                      <span style={{ color: (s.pnl??0)>=0?"#34d399":"#f87171" }}>{(s.pnl??0)>=0?"+":""}{(s.pnl??0).toFixed(2)}</span>
                      <span style={{ color:"#64748b" }}>{s.winRate}% WR</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent trade history */}
          {recent.length > 0 ? (
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"#94a3b8", marginBottom:10 }}>Recent Trades</div>
              <div style={{ borderRadius:10, border:"1px solid #1a2035", overflow:"hidden" }}>
                {recent.map(t => (
                  <div key={t.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 14px", borderBottom:"1px solid rgba(30,41,59,0.4)" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:4, background:t.type==="long"?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)", color:t.type==="long"?"#34d399":"#f87171" }}>{t.type==="long"?"▲":"▼"}</span>
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:"#e2e8f0" }}>{t.pair}</div>
                        <div style={{ fontSize:9, color:"#475569" }}>{t.strategy} · {new Date(t.date).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:12, fontWeight:700, fontFamily:"monospace", color:(t.pnl??0)>=0?"#34d399":"#f87171" }}>{(t.pnl??0)>=0?"+":""}{(t.pnl??0).toFixed(4)}</div>
                      <div style={{ fontSize:9, color:(t.pnl??0)>=0?"#34d399":"#f87171", opacity:0.7 }}>{(t.pnlPercent??0)>=0?"+":""}{(t.pnlPercent??0).toFixed(3)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding:"32px 24px", borderRadius:12, border:"1px dashed #1a2035", textAlign:"center", animation:"fadeIn 0.3s ease" }}>
              <div style={{ fontSize:36, marginBottom:12 }}>📊</div>
              <div style={{ fontSize:14, fontWeight:700, color:"#f1f5f9", marginBottom:6 }}>No trades yet</div>
              <div style={{ fontSize:12, color:"#475569", marginBottom:16 }}>Log your first trade to start building your track record</div>
              <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                <button onClick={onAddTrade} style={{ padding:"8px 18px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#0369a1,#38bdf8)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                  + Log Trade
                </button>
                <button onClick={onOpenImport} style={{ padding:"8px 18px", borderRadius:9, border:"1px solid #1a2035", background:"transparent", color:"#94a3b8", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                  Import CSV
                </button>
              </div>
            </div>
          )}

          {!trades.length && <div style={{ textAlign:"center", padding:"32px", color:"#334155", fontSize:12 }}>No trades logged yet</div>}
        </div>
      </div>
    </div>
  );
}

// ── Leaderboard row ───────────────────────────────────────────

function LeaderboardRow({ rank, trader, session, copyTrading, onViewProfile }) {
  const isFollowing = copyTrading.isFollowing(trader.username);
  const isSelf      = trader.username === session.username;
  const pnlPos      = trader.pnl >= 0;

  const rankStyle = rank === 1
    ? { color:"#fbbf24", bg:"rgba(251,191,36,0.12)", border:"rgba(251,191,36,0.3)" }
    : rank === 2
    ? { color:"#94a3b8", bg:"rgba(148,163,184,0.08)", border:"rgba(148,163,184,0.2)" }
    : rank === 3
    ? { color:"#f97316", bg:"rgba(249,115,22,0.08)", border:"rgba(249,115,22,0.2)" }
    : { color:"#334155", bg:"transparent", border:"transparent" };

  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

  return (
    <div
      onClick={() => onViewProfile(trader)}
      style={{
        display:"grid", gridTemplateColumns:"44px 1fr auto auto auto auto", alignItems:"center", gap:12,
        padding:"12px 16px", cursor:"pointer", transition:"background 0.15s",
        borderBottom:"1px solid rgba(30,41,59,0.4)",
        background: rank <= 3 ? rankStyle.bg : "transparent",
      }}
      onMouseEnter={e => e.currentTarget.style.background = rank<=3 ? rankStyle.bg : "rgba(255,255,255,0.02)"}
      onMouseLeave={e => e.currentTarget.style.background = rank<=3 ? rankStyle.bg : "transparent"}
    >
      {/* Rank */}
      <div style={{ textAlign:"center" }}>
        {medal
          ? <span style={{ fontSize:18 }}>{medal}</span>
          : <span style={{ fontSize:12, fontWeight:800, color:rankStyle.color || "#334155", fontFamily:"monospace" }}>#{rank}</span>
        }
      </div>

      {/* Identity */}
      <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
        <div style={{ width:34, height:34, borderRadius:"50%", flexShrink:0, background:`linear-gradient(135deg,${rank<=3?"#0369a1":"#1a2035"},${rank<=3?"#38bdf8":"#334155"})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, color:"#fff" }}>{trader.displayName[0].toUpperCase()}</div>
        <div style={{ minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:12, fontWeight:700, color:"#e2e8f0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{trader.displayName}</span>
            {isSelf && <span style={{ fontSize:8, color:"#38bdf8", background:"rgba(56,189,248,0.1)", padding:"1px 5px", borderRadius:8, fontWeight:700 }}>You</span>}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:2, flexWrap:"wrap" }}>
            {trader.badges.slice(0,2).map(b => <span key={b.label} style={{ fontSize:8, color:b.color, fontWeight:700 }}>{b.emoji} {b.label}</span>)}
            <span style={{ fontSize:9, color:"#334155" }}>@{trader.username}</span>
          </div>
        </div>
      </div>

      {/* PnL */}
      <div style={{ textAlign:"right", minWidth:70 }}>
        <div style={{ fontSize:12, fontWeight:700, fontFamily:"monospace", color:pnlPos?"#34d399":"#f87171" }}>{pnlPos?"+":""}{trader.pnl.toFixed(2)}</div>
        <div style={{ fontSize:9, color:"#334155" }}>PnL</div>
      </div>

      {/* Win rate */}
      <div style={{ textAlign:"right", minWidth:52 }}>
        <div style={{ fontSize:12, fontWeight:700, fontFamily:"monospace", color:trader.winRate>=50?"#34d399":"#fbbf24" }}>{trader.winRate}%</div>
        <div style={{ fontSize:9, color:"#334155" }}>WR</div>
      </div>

      {/* Score */}
      <div style={{ textAlign:"right", minWidth:46 }}>
        <div style={{ fontSize:12, fontWeight:700, fontFamily:"monospace", color:"#818cf8" }}>{trader.score.toFixed(0)}</div>
        <div style={{ fontSize:9, color:"#334155" }}>Score</div>
      </div>

      {/* Follow button */}
      <div onClick={e => e.stopPropagation()}>
        {!isSelf ? (
          <button
            onClick={() => isFollowing ? copyTrading.unfollow(trader.username) : copyTrading.follow(trader.username)}
            style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 12px", borderRadius:7, fontSize:10, fontWeight:700, cursor:"pointer", border:`1px solid ${isFollowing?"rgba(239,68,68,0.3)":"rgba(56,189,248,0.3)"}`, background:isFollowing?"rgba(239,68,68,0.07)":"rgba(56,189,248,0.07)", color:isFollowing?"#f87171":"#38bdf8", whiteSpace:"nowrap" }}>
            {isFollowing ? <><UserMinus size={9}/> Unfollow</> : <><UserCheck size={9}/> Follow</>}
          </button>
        ) : <div style={{ width:68 }}/>}
      </div>
    </div>
  );
}

// ── Full leaderboard page ─────────────────────────────────────

function CopyTradingPage({ session, copyTrading }) {
  const [range,     setRange]     = useState("all");   // "day"|"week"|"month"|"all"
  const [minWR,     setMinWR]     = useState(0);       // min win-rate filter
  const [search,    setSearch]    = useState("");
  const [tab,       setTab]       = useState("leaderboard"); // "leaderboard"|"following"
  const [leaders,   setLeaders]   = useState([]);
  const [profile,   setProfile]   = useState(null);   // trader object being viewed
  const [refreshAt, setRefreshAt] = useState(Date.now());

  // Refresh leaderboard every 5s or when range changes
  useEffect(() => {
    const rebuild = () => setLeaders(buildLeaderboard(range));
    rebuild();
    const id = setInterval(rebuild, 5000);
    return () => clearInterval(id);
  }, [range, refreshAt]);

  const filtered = leaders.filter(t => {
    if (tab === "following" && !copyTrading.isFollowing(t.username)) return false;
    if (minWR > 0 && t.winRate < minWR) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.displayName.toLowerCase().includes(q) && !t.username.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const followingCount = copyTrading.follows.length;

  const RANGE_OPTS = [
    { id:"day",   label:"24h" },
    { id:"week",  label:"7d"  },
    { id:"month", label:"30d" },
    { id:"all",   label:"All" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* Profile modal */}
      {profile && (
        <TraderProfile
          username={profile.username}
          displayName={profile.displayName}
          session={session}
          copyTrading={copyTrading}
          onClose={() => setProfile(null)}
        />
      )}

      {/* Page header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800, color:"#f1f5f9", display:"flex", alignItems:"center", gap:10 }}>
            <Users size={20} style={{ color:"#38bdf8" }}/> Social Trading
          </div>
          <div style={{ fontSize:11, color:"#475569", marginTop:3 }}>Leaderboard · Follow top traders · Simulate copy trading</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {followingCount > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:20, background:"rgba(56,189,248,0.08)", border:"1px solid rgba(56,189,248,0.2)" }}>
              <Radio size={10} style={{ color:"#38bdf8" }}/>
              <span style={{ fontSize:11, fontWeight:700, color:"#38bdf8" }}>Following {followingCount}</span>
            </div>
          )}
          <button onClick={() => setRefreshAt(Date.now())} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:8, border:"1px solid #1a2035", background:"#111827", color:"#64748b", fontSize:11, cursor:"pointer" }}>
            <RefreshCw size={11}/> Refresh
          </button>
        </div>
      </div>

      {/* Simulation notice */}
      <div style={{ padding:"10px 16px", borderRadius:10, background:"rgba(99,102,241,0.05)", border:"1px solid rgba(99,102,241,0.2)", fontSize:11, color:"#64748b", lineHeight:1.6 }}>
        <strong style={{ color:"#818cf8" }}>Simulation only.</strong> All data is from manually logged trades — no live broker connections. Following a trader automatically adds their new trades to your journal (simulated).
      </div>

      {/* Top 3 podium */}
      {leaders.slice(0,3).length > 0 && tab === "leaderboard" && range === "all" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1.1fr 1fr", gap:12 }}>
          {[leaders[1], leaders[0], leaders[2]].filter(Boolean).map((t, podiumIdx) => {
            const actualRank = podiumIdx === 1 ? 1 : podiumIdx === 0 ? 2 : 3;
            const medal = ["🥈","🥇","🥉"][podiumIdx];
            const h  = podiumIdx === 1 ? 130 : 110;
            const pnlPos = (t.pnl??0)>=0;
            return (
              <div key={t.username} onClick={() => setProfile(t)} style={{ borderRadius:14, border:`1px solid ${actualRank===1?"rgba(251,191,36,0.4)":actualRank===2?"rgba(148,163,184,0.25)":"rgba(249,115,22,0.3)"}`, background:`linear-gradient(160deg,${actualRank===1?"rgba(251,191,36,0.08)":actualRank===2?"rgba(148,163,184,0.05)":"rgba(249,115,22,0.06)"},rgba(13,17,32,0.9))`, padding:"16px", textAlign:"center", cursor:"pointer", position:"relative", height:h }}>
                <div style={{ fontSize:28, marginBottom:6 }}>{medal}</div>
                <div style={{ width:36, height:36, borderRadius:"50%", background:"linear-gradient(135deg,#0369a1,#38bdf8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:"#fff", margin:"0 auto 8px" }}>{t.displayName[0].toUpperCase()}</div>
                <div style={{ fontSize:12, fontWeight:700, color:"#e2e8f0", marginBottom:3 }}>{t.displayName}</div>
                <div style={{ fontSize:13, fontWeight:800, fontFamily:"monospace", color:pnlPos?"#34d399":"#f87171" }}>{pnlPos?"+":""}{(t.pnl??0).toFixed(2)}</div>
                <div style={{ fontSize:10, color:"#64748b" }}>{t.winRate}% WR · Score {t.score.toFixed(0)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs + Filters */}
      <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        {/* Tab switcher */}
        <div style={{ display:"flex", gap:2, borderBottom:"1px solid #1a2035" }}>
          {[["leaderboard",`🏆 Leaderboard (${leaders.length})`],["following",`Following (${followingCount})`]].map(([id,label]) => (
            <button key={id} onClick={()=>setTab(id)} style={{ padding:"6px 14px", border:"none", background:"transparent", fontSize:11, fontWeight:600, cursor:"pointer", color:tab===id?"#e2e8f0":"#475569", borderBottom:tab===id?"2px solid #38bdf8":"2px solid transparent", marginBottom:-1, whiteSpace:"nowrap" }}>{label}</button>
          ))}
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:6, marginLeft:"auto", flexWrap:"wrap" }}>
          {/* Time range */}
          <div style={{ display:"flex", borderRadius:8, overflow:"hidden", border:"1px solid #1a2035" }}>
            {RANGE_OPTS.map(r => (
              <button key={r.id} onClick={()=>setRange(r.id)} style={{ padding:"5px 10px", border:"none", fontSize:10, fontWeight:700, cursor:"pointer", background:range===r.id?"#1e3a52":"#111827", color:range===r.id?"#38bdf8":"#475569" }}>{r.label}</button>
            ))}
          </div>
          {/* Win rate filter */}
          <select value={minWR} onChange={e=>setMinWR(Number(e.target.value))} style={{ padding:"5px 9px", borderRadius:7, background:"#111827", border:"1px solid #1a2035", fontSize:10, color:"#94a3b8", cursor:"pointer", outline:"none" }}>
            <option value={0}>All WR</option>
            <option value={50}>≥50% WR</option>
            <option value={60}>≥60% WR</option>
            <option value={70}>≥70% WR</option>
          </select>
          {/* Search */}
          <div style={{ position:"relative" }}>
            <Search size={11} style={{ position:"absolute", left:8, top:"50%", transform:"translateY(-50%)", color:"#475569" }}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{ padding:"5px 8px 5px 26px", borderRadius:7, background:"#111827", border:"1px solid #1a2035", fontSize:11, color:"#e2e8f0", outline:"none", width:120 }}/>
          </div>
        </div>
      </div>

      {/* Leaderboard table */}
      {filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"48px 24px", borderRadius:12, border:"1px dashed #1a2035", color:"#334155" }}>
          <Users size={32} style={{ marginBottom:12, opacity:0.3 }}/>
          <div style={{ fontSize:13 }}>{tab==="following"?"You're not following anyone yet.":"No traders found for this filter."}</div>
          {tab==="following" && <button onClick={()=>setTab("leaderboard")} style={{ marginTop:10, fontSize:11, color:"#38bdf8", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>Browse leaderboard →</button>}
        </div>
      ) : (
        <div style={{ borderRadius:12, border:"1px solid #1a2035", overflow:"hidden" }}>
          {/* Table header */}
          <div style={{ display:"grid", gridTemplateColumns:"44px 1fr auto auto auto auto", gap:12, padding:"8px 16px", background:"rgba(10,15,30,0.95)", borderBottom:"1px solid rgba(30,41,59,0.8)" }}>
            {["#","Trader","PnL","WR","Score",""].map(h => (
              <div key={h} style={{ fontSize:9, fontWeight:700, color:"#334155", textTransform:"uppercase", letterSpacing:"0.07em", textAlign: h==="Trader"?"left":"right" }}>{h}</div>
            ))}
          </div>
          {filtered.map((trader, idx) => (
            <LeaderboardRow
              key={trader.username}
              rank={idx + 1}
              trader={trader}
              session={session}
              copyTrading={copyTrading}
              onViewProfile={setProfile}
            />
          ))}
        </div>
      )}

      {/* Score explanation */}
      <div style={{ padding:"10px 16px", borderRadius:10, background:"rgba(17,24,39,0.5)", border:"1px solid #1a2035", fontSize:10, color:"#334155", lineHeight:1.7 }}>
        <strong style={{ color:"#475569" }}>Score formula:</strong> 40% Win Rate + 30% Profit Factor + 20% Total PnL + 10% Activity. Filters by selected time range. Click any row to view full trader profile and equity curve.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  BACKTESTING ENGINE
// ═══════════════════════════════════════════════════════════════

// ── Indicator helpers (fast, no external deps) ────────────────

function btSMA(closes, period) {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    let s = 0; for (let j = 0; j < period; j++) s += closes[i - j];
    return s / period;
  });
}

function btEMA(closes, period) {
  const k = 2 / (period + 1);
  const out = new Array(closes.length).fill(null);
  let started = false, prev = 0;
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) continue;
    if (!started) { let s = 0; for (let j = 0; j < period; j++) s += closes[i - j]; prev = s / period; out[i] = prev; started = true; continue; }
    prev = closes[i] * k + prev * (1 - k); out[i] = prev;
  }
  return out;
}

function btRSI(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return out;
  let ag = 0, al = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) ag += d; else al -= d;
  }
  ag /= period; al /= period;
  out[period] = 100 - 100 / (1 + (al === 0 ? Infinity : ag / al));
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (period - 1) + (d > 0 ? d : 0)) / period;
    al = (al * (period - 1) + (d < 0 ? -d : 0)) / period;
    out[i] = 100 - 100 / (1 + (al === 0 ? Infinity : ag / al));
  }
  return out;
}

function btMACD(closes, fast = 12, slow = 26, signal = 9) {
  const emaFast   = btEMA(closes, fast);
  const emaSlow   = btEMA(closes, slow);
  const macdLine  = closes.map((_, i) => emaFast[i] !== null && emaSlow[i] !== null ? emaFast[i] - emaSlow[i] : null);
  const validMACD = macdLine.filter(v => v !== null);
  const sigRaw    = btEMA(validMACD, signal);
  const sigLine   = new Array(closes.length).fill(null);
  let si = 0;
  for (let i = 0; i < closes.length; i++) { if (macdLine[i] !== null) { sigLine[i] = sigRaw[si++] ?? null; } }
  const hist = closes.map((_, i) => macdLine[i] !== null && sigLine[i] !== null ? macdLine[i] - sigLine[i] : null);
  return { macd: macdLine, signal: sigLine, hist };
}

// ── Built-in strategy definitions ─────────────────────────────

const BUILTIN_STRATEGIES = [
  {
    id: "ema_cross",
    name: "EMA Crossover (9/21)",
    description: "Buy when EMA9 crosses above EMA21, sell when crosses below. Classic trend-following.",
    params: [
      { key: "fast", label: "Fast EMA", type: "number", default: 9,  min: 2,  max: 50 },
      { key: "slow", label: "Slow EMA", type: "number", default: 21, min: 5,  max: 200 },
    ],
    build: (p) => ({
      indicators: (closes) => ({ emaF: btEMA(closes, p.fast), emaS: btEMA(closes, p.slow) }),
      entry: (i, ind) => ind.emaF[i] !== null && ind.emaS[i] !== null && ind.emaF[i-1] !== null && ind.emaS[i-1] !== null
        && ind.emaF[i] > ind.emaS[i] && ind.emaF[i-1] <= ind.emaS[i-1],
      exit:  (i, ind) => ind.emaF[i] !== null && ind.emaS[i] !== null
        && ind.emaF[i] < ind.emaS[i],
    }),
  },
  {
    id: "rsi_reversion",
    name: "RSI Mean Reversion",
    description: "Buy when RSI crosses back above oversold level, sell when RSI crosses below overbought.",
    params: [
      { key: "period",     label: "RSI Period",    type: "number", default: 14, min: 2,  max: 50  },
      { key: "oversold",   label: "Oversold Level", type: "number", default: 30, min: 5,  max: 45  },
      { key: "overbought", label: "Overbought Level",type: "number", default: 70, min: 55, max: 95  },
    ],
    build: (p) => ({
      indicators: (closes) => ({ rsi: btRSI(closes, p.period) }),
      entry: (i, ind) => ind.rsi[i] !== null && ind.rsi[i-1] !== null
        && ind.rsi[i] >= p.oversold && ind.rsi[i-1] < p.oversold,
      exit:  (i, ind) => ind.rsi[i] !== null && ind.rsi[i-1] !== null
        && ind.rsi[i] <= p.overbought && ind.rsi[i-1] > p.overbought,
    }),
  },
  {
    id: "macd_zero",
    name: "MACD Zero-Line Cross",
    description: "Buy when MACD crosses above zero, sell when crosses below. Momentum trend filter.",
    params: [
      { key: "fast",   label: "Fast Period",   type: "number", default: 12, min: 2,  max: 50  },
      { key: "slow",   label: "Slow Period",   type: "number", default: 26, min: 5,  max: 200 },
      { key: "signal", label: "Signal Period", type: "number", default: 9,  min: 2,  max: 50  },
    ],
    build: (p) => ({
      indicators: (closes) => btMACD(closes, p.fast, p.slow, p.signal),
      entry: (i, ind) => ind.macd[i] !== null && ind.macd[i-1] !== null
        && ind.macd[i] > 0 && ind.macd[i-1] <= 0,
      exit:  (i, ind) => ind.macd[i] !== null && ind.macd[i-1] !== null
        && ind.macd[i] < 0 && ind.macd[i-1] >= 0,
    }),
  },
  {
    id: "breakout",
    name: "N-Bar High Breakout",
    description: "Buy when price breaks above the highest close of the last N bars. Momentum breakout.",
    params: [
      { key: "n",   label: "Lookback Bars", type: "number", default: 20, min: 5,  max: 200 },
      { key: "sma", label: "Trend SMA",     type: "number", default: 50, min: 10, max: 300 },
    ],
    build: (p) => ({
      indicators: (closes) => ({ sma: btSMA(closes, p.sma) }),
      entry: (i, ind, closes) => {
        if (i < p.n || ind.sma[i] === null) return false;
        const highN = Math.max(...closes.slice(i - p.n, i));
        return closes[i] > highN && closes[i] > ind.sma[i];
      },
      exit: (i, ind) => ind.sma[i] !== null && ind.sma[i-1] !== null,  // exit handled by SL/TP only
    }),
  },
  {
    id: "sma_trend",
    name: "SMA 50/200 Trend",
    description: "Buy when 50 SMA crosses above 200 SMA (Golden Cross), sell on Death Cross.",
    params: [
      { key: "fast", label: "Fast SMA",  type: "number", default: 50,  min: 5,  max: 200 },
      { key: "slow", label: "Slow SMA",  type: "number", default: 200, min: 20, max: 500 },
    ],
    build: (p) => ({
      indicators: (closes) => ({ sF: btSMA(closes, p.fast), sS: btSMA(closes, p.slow) }),
      entry: (i, ind) => ind.sF[i] !== null && ind.sS[i] !== null && ind.sF[i-1] !== null && ind.sS[i-1] !== null
        && ind.sF[i] > ind.sS[i] && ind.sF[i-1] <= ind.sS[i-1],
      exit:  (i, ind) => ind.sF[i] !== null && ind.sS[i] !== null
        && ind.sF[i] < ind.sS[i],
    }),
  },
];

// ── Core engine ───────────────────────────────────────────────

function runBacktest({ candles, strategy, initialBalance, riskPct, slPct, tpPct, maxHoldBars }) {
  if (!candles || candles.length < 30) return null;

  const closes = candles.map(c => c.close);
  const highs   = candles.map(c => c.high);
  const lows    = candles.map(c => c.low);
  const times   = candles.map(c => c.time);

  // Build indicators once
  const ind = strategy.indicators(closes);

  const FEE  = 0.001; // 0.1% round-trip
  const SLIP = 0.0005;

  let balance   = initialBalance;
  let peak      = initialBalance;
  let maxDD     = 0;
  const trades  = [];
  const equity  = [{ time: times[0], balance: initialBalance, label: new Date(times[0] * 1000).toLocaleDateString("en-US",{month:"short",day:"numeric"}) }];
  let pos       = null; // { entry, sl, tp, openBar, openTime }

  for (let i = 1; i < candles.length; i++) {
    if (!pos) {
      // Check entry
      const signal = strategy.entry(i, ind, closes, highs, lows);
      if (signal) {
        const entry = closes[i] * (1 + SLIP);
        const riskAmt = balance * (riskPct / 100);
        const slPrice = entry * (1 - slPct / 100);
        const tpPrice = entry * (1 + tpPct / 100);
        const slDist  = entry - slPrice;
        const size    = slDist > 0 ? riskAmt / slDist : 1;
        pos = { entry, sl: slPrice, tp: tpPrice, size, openBar: i, openTime: times[i] };
      }
    } else {
      // Check SL/TP hit intra-bar
      let exitPrice = null, exitReason = "";
      const bar = candles[i];

      if (bar.low <= pos.sl)   { exitPrice = pos.sl;  exitReason = "SL"; }
      else if (bar.high >= pos.tp) { exitPrice = pos.tp; exitReason = "TP"; }
      else if (strategy.exit(i, ind, closes, highs, lows)) { exitPrice = closes[i] * (1 - SLIP); exitReason = "Signal"; }
      else if (maxHoldBars && i - pos.openBar >= maxHoldBars) { exitPrice = closes[i]; exitReason = "MaxHold"; }

      if (exitPrice !== null) {
        const gross = (exitPrice - pos.entry) * pos.size;
        const fee   = (pos.entry + exitPrice) * pos.size * FEE / 2;
        const pnl   = gross - fee;
        balance     = +(balance + pnl).toFixed(4);

        trades.push({
          id:          `bt_${i}`,
          openBar:     pos.openBar,
          closeBar:    i,
          openTime:    pos.openTime,
          closeTime:   times[i],
          entryPrice:  pos.entry,
          exitPrice,
          size:        pos.size,
          pnl:         +pnl.toFixed(4),
          pnlPct:      +((pnl / (pos.entry * pos.size)) * 100).toFixed(3),
          exitReason,
          holdBars:    i - pos.openBar,
        });

        if (balance > peak) peak = balance;
        const dd = peak > 0 ? (peak - balance) / peak * 100 : 0;
        if (dd > maxDD) maxDD = dd;

        pos = null;
        equity.push({ time: times[i], balance, label: new Date(times[i]*1000).toLocaleDateString("en-US",{month:"short",day:"numeric"}) });
      }
    }
  }

  if (!trades.length) return { trades:[], equity:[{time:times[0],balance:initialBalance,label:"Start"},{time:times[times.length-1],balance:initialBalance,label:"End"}], metrics: null };

  const wins       = trades.filter(t => (t.pnl??0)>0);
  const losses     = trades.filter(t => (t.pnl??0)<=0);
  const grossWin   = wins.reduce((s,t)=>s+(t.pnl??0),0);
  const grossLoss  = Math.abs(losses.reduce((s,t)=>s+(t.pnl??0),0));
  const totalPnl   = balance - initialBalance;
  const returnPct  = (totalPnl / initialBalance) * 100;
  const avgHold    = trades.reduce((s,t)=>s+t.holdBars,0) / trades.length;
  const slHits     = trades.filter(t=>t.exitReason==="SL").length;
  const tpHits     = trades.filter(t=>t.exitReason==="TP").length;

  return {
    trades,
    equity,
    metrics: {
      totalTrades:   trades.length,
      wins:          wins.length,
      losses:        losses.length,
      winRate:       +((wins.length / trades.length) * 100).toFixed(1),
      totalPnl:      +totalPnl.toFixed(4),
      returnPct:     +returnPct.toFixed(2),
      finalBalance:  +balance.toFixed(4),
      maxDrawdown:   +maxDD.toFixed(2),
      profitFactor:  grossLoss > 0 ? +(grossWin / grossLoss).toFixed(2) : grossWin > 0 ? 999 : 0,
      avgWin:        wins.length   ? +(grossWin / wins.length).toFixed(4)   : 0,
      avgLoss:       losses.length ? +(grossLoss / losses.length).toFixed(4) : 0,
      avgHoldBars:   +avgHold.toFixed(1),
      slHits, tpHits,
      expectancy:    +((wins.length/trades.length * (grossWin/Math.max(wins.length,1))) - (losses.length/trades.length * (grossLoss/Math.max(losses.length,1)))).toFixed(4),
    },
  };
}

// ── Candle generator for offline backtesting ──────────────────

function genBacktestCandles(n = 500, basePrice = 50000, volatility = 0.018) {
  let price = basePrice;
  const candles = [];
  let trend = (Math.random() - 0.4) * 0.001;
  for (let i = 0; i < n; i++) {
    if (i % 80 === 0) trend = (Math.random() - 0.4) * 0.0015;
    const open  = price;
    const noise = (Math.random() - 0.5) * volatility;
    const close = Math.max(1, open * (1 + trend + noise));
    const wick  = Math.random() * volatility * 0.5;
    const high  = Math.max(open, close) * (1 + wick);
    const low   = Math.min(open, close) * (1 - wick);
    const time  = Math.floor(Date.now() / 1000) - (n - i) * 3600;
    candles.push({ time, open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2) });
    price = close;
  }
  return candles;
}

// ═══════════════════════════════════════════════════════════════
//  MARKET DATA FETCHING
// ═══════════════════════════════════════════════════════════════

// Supported symbols for backtesting
// ── Symbol catalogue (crypto via Coinbase) ───────────────────
const BT_SYMBOLS = [
  // ── Crypto (Coinbase) ──────────────────────────────────────
  { id:"BTC-USD",  label:"BTC / USD",       dec:2, base:97000, source:"coinbase" },
  { id:"ETH-USD",  label:"ETH / USD",       dec:2, base:1850,  source:"coinbase" },
  { id:"SOL-USD",  label:"SOL / USD",       dec:3, base:148,   source:"coinbase" },
  { id:"XRP-USD",  label:"XRP / USD",       dec:4, base:2.1,   source:"coinbase" },
  { id:"LINK-USD", label:"LINK / USD",      dec:3, base:13,    source:"coinbase" },
  { id:"ADA-USD",  label:"ADA / USD",       dec:4, base:0.75,  source:"coinbase" },
  { id:"AVAX-USD", label:"AVAX / USD",      dec:3, base:28,    source:"coinbase" },
  { id:"BNB-USD",  label:"BNB / USD",       dec:2, base:620,   source:"coinbase" },
  // ── Futures & Indexes (Yahoo Finance) ─────────────────────
  { id:"ES=F",     label:"S&P 500 Futures", dec:2, base:5300,  source:"yahoo" },
  { id:"NQ=F",     label:"Nasdaq Futures",  dec:2, base:18500, source:"yahoo" },
  { id:"YM=F",     label:"Dow Futures",     dec:0, base:39000, source:"yahoo" },
  { id:"RTY=F",    label:"Russell 2000 Fut",dec:2, base:2100,  source:"yahoo" },
  { id:"GC=F",     label:"Gold Futures",    dec:2, base:2350,  source:"yahoo" },
  { id:"CL=F",     label:"Crude Oil Fut",   dec:2, base:78,    source:"yahoo" },
  { id:"^GSPC",    label:"S&P 500 Index",   dec:2, base:5300,  source:"yahoo" },
  { id:"^NDX",     label:"Nasdaq 100",      dec:2, base:18500, source:"yahoo" },
];

// Timeframe definitions: label, Coinbase granularity string, seconds per candle
const BT_TIMEFRAMES = [
  { id:"1m",  label:"1m",  gran:"ONE_MINUTE",     sec:60    },
  { id:"5m",  label:"5m",  gran:"FIVE_MINUTE",    sec:300   },
  { id:"15m", label:"15m", gran:"FIFTEEN_MINUTE", sec:900   },
  { id:"1h",  label:"1h",  gran:"ONE_HOUR",       sec:3600  },
  { id:"4h",  label:"4h",  gran:"SIX_HOUR",       sec:21600 },
  { id:"1d",  label:"1D",  gran:"ONE_DAY",        sec:86400 },
];

// How many candles cover 2 years for each timeframe
// (capped at practical limits — 1m/5m would be millions)
const TF_2Y_CANDLES = {
  "1m":  3000,   // ~2 trading days at 1m — impractical to go further
  "5m":  6000,   // ~3 weeks
  "15m": 8640,   // ~3 months
  "1h":  17520,  // 2 years × 365 × 24 = 17,520
  "4h":  4380,   // 2 years × 365 × 6  = 4,380
  "1d":  730,    // 2 years × 365       = 730
};

// In-memory cache: key → {ts, candles}
const _btCache = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function fetchBtCandles(symbolId, tfId, limitOverride = null) {
  const limit = limitOverride ?? TF_2Y_CANDLES[tfId] ?? 730;
  const key   = `${symbolId}_${tfId}_${limit}`;
  const cached = _btCache[key];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { candles: cached.candles, source: "cached" };
  }

  const sym = BT_SYMBOLS.find(s => s.id === symbolId);

  // ── Futures / Indexes: Yahoo Finance (already returns up to 5y) ──
  if (sym?.source === "yahoo") {
    const res  = await fetch(`/api/yahoo?symbol=${encodeURIComponent(symbolId)}&tf=${tfId}&limit=${Math.min(limit, 2000)}`);
    if (!res.ok) throw new Error(`Yahoo Finance error ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (!data.candles?.length) throw new Error("No data returned from Yahoo Finance");
    _btCache[key] = { ts: Date.now(), candles: data.candles };
    return { candles: data.candles, source: "live" };
  }

  // ── Crypto: Coinbase — paginate backwards in 300-candle chunks ──
  const tf    = BT_TIMEFRAMES.find(t => t.id === tfId);
  if (!tf) throw new Error("Unknown timeframe");

  const PAGE_SIZE = 300;
  const pages     = Math.ceil(limit / PAGE_SIZE);
  const now       = Math.floor(Date.now() / 1000);
  const all       = [];

  for (let p = 0; p < pages; p++) {
    const pageEnd   = now - p * PAGE_SIZE * tf.sec;
    const pageStart = pageEnd - PAGE_SIZE * tf.sec;
    const params    = `product_id=${symbolId}&start=${pageStart}&end=${pageEnd}&granularity=${tf.gran}`;

    try {
      const res  = await fetch(`/api/coinbase?params=${encodeURIComponent(params)}`);
      if (!res.ok) throw new Error(`Coinbase ${res.status}`);
      const data = await res.json();
      if (data?.candles?.length) {
        all.push(...data.candles);
      } else {
        break; // No more data available
      }
      // Small delay between pages to avoid rate limiting
      if (p < pages - 1 && pages > 3) await new Promise(r => setTimeout(r, 120));
    } catch (e) {
      if (all.length > 0) break; // Use what we have
      throw e;
    }
  }

  if (!all.length) throw new Error("No candles returned from Coinbase");

  const seen   = new Set();
  const parsed = all
    .filter(c => { const k = c.start; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => parseInt(a.start) - parseInt(b.start))
    .map(c => ({
      time:  parseInt(c.start),
      open:  parseFloat(c.open),
      high:  parseFloat(c.high),
      low:   parseFloat(c.low),
      close: parseFloat(c.close),
    }))
    .filter(c => c.close > 0);

  _btCache[key] = { ts: Date.now(), candles: parsed };
  return { candles: parsed, source: "live" };
}

// ═══════════════════════════════════════════════════════════════
//  STRATEGY CONDITION PARSER
//  Converts natural language / condition strings into engine predicates
// ═══════════════════════════════════════════════════════════════

// Available condition atoms
// State-based conditions check ongoing state (fires every bar the condition is true)
// Cross conditions check for a recent crossover within a lookback window
const COND_DEFINITIONS = [
  // ── RSI conditions ─────────────────────────────────────────
  { id:"rsi_below",          label:"RSI <",              hint:"value", side:"entry",
    build:(v,ind) => (i) => ind.rsi14?.[i] != null && ind.rsi14[i] < v },
  { id:"rsi_above",          label:"RSI >",              hint:"value", side:"exit",
    build:(v,ind) => (i) => ind.rsi14?.[i] != null && ind.rsi14[i] > v },
  // Cross within last 3 bars (much more practical than exact-bar cross)
  { id:"rsi_cross_up",       label:"RSI crossed up",     hint:"value", side:"entry",
    build:(v,ind) => (i) => {
      if (!ind.rsi14?.[i]) return false;
      for (let k = 0; k < 3; k++) {
        if (i-k < 1) break;
        if (ind.rsi14[i-k] >= v && ind.rsi14[i-k-1] < v) return true;
      }
      return false;
    }},
  { id:"rsi_cross_down",     label:"RSI crossed down",   hint:"value", side:"exit",
    build:(v,ind) => (i) => {
      if (!ind.rsi14?.[i]) return false;
      for (let k = 0; k < 3; k++) {
        if (i-k < 1) break;
        if (ind.rsi14[i-k] <= v && ind.rsi14[i-k-1] > v) return true;
      }
      return false;
    }},
  // ── MACD conditions ────────────────────────────────────────
  { id:"macd_cross_up",      label:"MACD > 0",           hint:null, side:"entry",
    build:(_,ind) => (i) => ind.macd?.[i] != null && ind.macd[i] > 0 },
  { id:"macd_cross_down",    label:"MACD < 0",           hint:null, side:"exit",
    build:(_,ind) => (i) => ind.macd?.[i] != null && ind.macd[i] < 0 },
  // ── EMA conditions — state-based (is above/below, not crossing) ──
  { id:"ema9_above_ema21",   label:"EMA9 > EMA21",       hint:null, side:"entry",
    build:(_,ind) => (i) => ind.ema9?.[i] != null && ind.ema21?.[i] != null && ind.ema9[i] > ind.ema21[i] },
  { id:"ema9_below_ema21",   label:"EMA9 < EMA21",       hint:null, side:"exit",
    build:(_,ind) => (i) => ind.ema9?.[i] != null && ind.ema21?.[i] != null && ind.ema9[i] < ind.ema21[i] },
  // ── Price vs SMA — state-based ─────────────────────────────
  { id:"price_above_sma50",  label:"Price > SMA50",      hint:null, side:"entry",
    build:(_,ind,closes) => (i) => ind.sma50?.[i] != null && closes[i] > ind.sma50[i] },
  { id:"price_below_sma50",  label:"Price < SMA50",      hint:null, side:"exit",
    build:(_,ind,closes) => (i) => ind.sma50?.[i] != null && closes[i] < ind.sma50[i] },
  { id:"price_above_sma200", label:"Price > SMA200",     hint:null, side:"entry",
    build:(_,ind,closes) => (i) => ind.sma200?.[i] != null && closes[i] > ind.sma200[i] },
  { id:"price_below_sma200", label:"Price < SMA200",     hint:null, side:"exit",
    build:(_,ind,closes) => (i) => ind.sma200?.[i] != null && closes[i] < ind.sma200[i] },
  // ── Breakout conditions ────────────────────────────────────
  { id:"breakout_high",      label:"N-bar high breakout", hint:"bars", side:"entry",
    build:(v,_,closes) => (i) => { if(i<v) return false; return closes[i] > Math.max(...closes.slice(i-v,i)); }},
  { id:"breakdown_low",      label:"N-bar low breakdown", hint:"bars", side:"exit",
    build:(v,_,closes) => (i) => { if(i<v) return false; return closes[i] < Math.min(...closes.slice(i-v,i)); }},
  // ── Candle pattern conditions ──────────────────────────────
  { id:"consecutive_green",  label:"N green candles",    hint:"count", side:"entry",
    build:(v,_,__,candles) => (i) => i>=v && Array.from({length:v},(_,k)=>candles[i-k]).every(c=>c.close>c.open) },
  { id:"consecutive_red",    label:"N red candles",      hint:"count", side:"exit",
    build:(v,_,__,candles) => (i) => i>=v && Array.from({length:v},(_,k)=>candles[i-k]).every(c=>c.close<c.open) },
];

// Build all indicators needed for the chosen conditions
function buildIndicatorsForConditions(closes, candles, condIds) {
  const needs = new Set(condIds);
  const ind = {};
  const hasAny = (...ids) => ids.some(id => needs.has(id));

  if (hasAny("rsi_below","rsi_above","rsi_cross_up","rsi_cross_down")) ind.rsi14 = btRSI(closes, 14);
  if (hasAny("macd_cross_up","macd_cross_down")) { const { macd } = btMACD(closes); ind.macd = macd; }
  if (hasAny("ema9_above_ema21","ema9_below_ema21")) { ind.ema9 = btEMA(closes,9); ind.ema21 = btEMA(closes,21); }
  if (hasAny("price_above_sma50","price_below_sma50")) ind.sma50 = btSMA(closes,50);
  if (hasAny("price_above_sma200","price_below_sma200")) ind.sma200 = btSMA(closes,200);
  return ind;
}

// Compile a custom strategy from condition lists into an engine-compatible strategy
function compileCustomStrategy(entryConds, exitConds) {
  return {
    indicators: (closes, candles) => {
      const allIds = [...entryConds.map(c=>c.id), ...exitConds.map(c=>c.id)];
      return buildIndicatorsForConditions(closes, candles, allIds);
    },
    entry: (i, ind, closes, highs, lows, candles) => {
      if (!entryConds.length) return false;
      // ALL entry conditions must be true (AND logic)
      return entryConds.every(c => {
        const def = COND_DEFINITIONS.find(d => d.id === c.id);
        if (!def) return false;
        return def.build(c.value ?? 14, ind, closes, candles)(i);
      });
    },
    exit: (i, ind, closes, highs, lows, candles) => {
      if (!exitConds.length) return false;
      // ANY exit condition fires (OR logic)
      return exitConds.some(c => {
        const def = COND_DEFINITIONS.find(d => d.id === c.id);
        if (!def) return false;
        return def.build(c.value ?? 14, ind, closes, candles)(i);
      });
    },
  };
}

// ── Update runBacktest to pass candles to indicators & conditions ──
// (Monkey-patch: the existing runBacktest already works, we just need
//  to thread `candles` through so custom conditions can access OHLC data)
function runBacktestV2({ candles, strategy, initialBalance, riskPct, slPct, tpPct, maxHoldBars }) {
  if (!candles || candles.length < 30) return null;

  const closes = candles.map(c => c.close);
  const highs   = candles.map(c => c.high);
  const lows    = candles.map(c => c.low);
  const times   = candles.map(c => c.time);

  const ind = strategy.indicators ? strategy.indicators(closes, candles) : {};

  const FEE      = 0.001;
  const SLIP     = 0.0005;
  const COOLDOWN = 2; // bars to wait after a trade closes before re-entering

  let balance    = initialBalance;
  let peak       = initialBalance;
  let maxDD      = 0;
  let lastExitBar = -COOLDOWN;
  const trades   = [];
  const equity   = [{ time: times[0], balance: initialBalance, label: new Date(times[0]*1000).toLocaleDateString("en-US",{month:"short",day:"numeric"}) }];
  let pos = null;

  for (let i = 1; i < candles.length; i++) {
    if (!pos) {
      // Respect cooldown and don't enter on the very first available bar
      if (i - lastExitBar < COOLDOWN) continue;

      const signal = strategy.entry(i, ind, closes, highs, lows, candles);
      if (signal) {
        const entry   = closes[i] * (1 + SLIP);
        const riskAmt = balance * (riskPct / 100);
        const slPrice = entry * (1 - slPct / 100);
        const tpPrice = entry * (1 + tpPct / 100);
        const slDist  = entry - slPrice;
        const size    = slDist > 0 ? riskAmt / slDist : 1;
        pos = { entry, sl: slPrice, tp: tpPrice, size, openBar: i, openTime: times[i] };
      }
    } else {
      let exitPrice = null, exitReason = "";
      const bar = candles[i];

      if (bar.low <= pos.sl)                                              { exitPrice = pos.sl;           exitReason = "SL";      }
      else if (bar.high >= pos.tp)                                        { exitPrice = pos.tp;           exitReason = "TP";      }
      else if (strategy.exit(i, ind, closes, highs, lows, candles))      { exitPrice = closes[i]*(1-SLIP); exitReason = "Signal"; }
      else if (maxHoldBars && i - pos.openBar >= maxHoldBars)            { exitPrice = closes[i];        exitReason = "MaxHold"; }

      if (exitPrice !== null) {
        const gross = (exitPrice - pos.entry) * pos.size;
        const fee   = (pos.entry + exitPrice) * pos.size * FEE / 2;
        const pnl   = gross - fee;
        balance     = +(balance + pnl).toFixed(4);
        trades.push({
          id:`bt_${i}`, openBar:pos.openBar, closeBar:i,
          openTime:pos.openTime, closeTime:times[i],
          entryPrice:pos.entry, exitPrice, size:pos.size,
          pnl:+pnl.toFixed(4), pnlPct:+((pnl/(pos.entry*pos.size))*100).toFixed(3),
          exitReason, holdBars:i-pos.openBar,
        });
        if (balance > peak) peak = balance;
        const dd = peak > 0 ? (peak-balance)/peak*100 : 0;
        if (dd > maxDD) maxDD = dd;
        lastExitBar = i;
        pos = null;
        equity.push({ time:times[i], balance, label:new Date(times[i]*1000).toLocaleDateString("en-US",{month:"short",day:"numeric"}) });
      }
    }
  }

  if (!trades.length) return { trades:[], equity:[{time:times[0],balance:initialBalance,label:"Start"},{time:times[times.length-1],balance:initialBalance,label:"End"}], metrics:null };

  const wins=trades.filter(t=>(t.pnl??0)>0), losses=trades.filter(t=>(t.pnl??0)<=0);
  const grossWin=wins.reduce((s,t)=>s+(t.pnl??0),0), grossLoss=Math.abs(losses.reduce((s,t)=>s+(t.pnl??0),0));
  const totalPnl=balance-initialBalance, returnPct=(totalPnl/initialBalance)*100;
  const slHits=trades.filter(t=>t.exitReason==="SL").length, tpHits=trades.filter(t=>t.exitReason==="TP").length;

  return {
    trades, equity,
    metrics: {
      totalTrades:trades.length, wins:wins.length, losses:losses.length,
      winRate:+((wins.length/trades.length)*100).toFixed(1),
      totalPnl:+totalPnl.toFixed(4), returnPct:+returnPct.toFixed(2),
      finalBalance:+balance.toFixed(4), maxDrawdown:+maxDD.toFixed(2),
      profitFactor:grossLoss>0?+(grossWin/grossLoss).toFixed(2):grossWin>0?999:0,
      avgWin:wins.length?+(grossWin/wins.length).toFixed(4):0,
      avgLoss:losses.length?+(grossLoss/losses.length).toFixed(4):0,
      avgHoldBars:+(trades.reduce((s,t)=>s+t.holdBars,0)/trades.length).toFixed(1),
      slHits, tpHits,
      expectancy:+((wins.length/trades.length*(grossWin/Math.max(wins.length,1)))-(losses.length/trades.length*(grossLoss/Math.max(losses.length,1)))).toFixed(4),
    },
  };
}

// ── BacktestPanel — upgraded ────────────────────────────────────

function BacktestPanel() {
  // Data settings
  const [symbol,      setSymbol]      = useState("BTC-USD");
  const [tfId,        setTfId]        = useState("1h");
  const [dataSource,  setDataSource]  = useState("live"); // "live" | "sim"
  const [fetchStatus, setFetchStatus] = useState("");     // "fetching"|"ok"|"fallback"|""

  // Strategy mode
  const [stratMode,   setStratMode]   = useState("builtin"); // "builtin" | "custom"
  const [stratId,     setStratId]     = useState("ema_cross");
  const [params,      setParams]      = useState({});

  // Custom strategy conditions
  const [entryConds,  setEntryConds]  = useState([{ id:"rsi_cross_up", value:30 }]);
  const [exitConds,   setExitConds]   = useState([{ id:"rsi_cross_down", value:70 }]);

  // Risk settings
  const [initialBal,  setInitialBal]  = useState(10000);
  const [riskPct,     setRiskPct]     = useState(1);
  const [slPct,       setSlPct]       = useState(2);
  const [tpPct,       setTpPct]       = useState(4);
  const [maxHold,     setMaxHold]     = useState(100);

  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState("");
  const [tradeTab,    setTradeTab]    = useState("metrics");

  const strat = BUILTIN_STRATEGIES.find(s => s.id === stratId);

  useEffect(() => {
    if (!strat) return;
    const defaults = {};
    strat.params.forEach(p => { defaults[p.key] = p.default; });
    setParams(defaults);
    setResult(null);
  }, [stratId]);

  const setParam = (key, val) => setParams(prev => ({ ...prev, [key]: val }));

  // ── Condition builder helpers ──────────────────────────────
  const addCond = (side) => {
    const def = COND_DEFINITIONS.find(d => d.side === side);
    if (!def) return;
    const setter = side === "entry" ? setEntryConds : setExitConds;
    setter(prev => [...prev, { id: def.id, value: 14 }]);
  };

  const removeCond = (side, idx) => {
    const setter = side === "entry" ? setEntryConds : setExitConds;
    setter(prev => prev.filter((_,i) => i !== idx));
  };

  const setCond = (side, idx, patch) => {
    const setter = side === "entry" ? setEntryConds : setExitConds;
    setter(prev => prev.map((c,i) => i===idx ? {...c,...patch} : c));
  };

  // ── Run ────────────────────────────────────────────────────
  const run = async () => {
    setLoading(true); setError(""); setResult(null); setFetchStatus("");
    await new Promise(r => setTimeout(r, 20));
    try {
      let candles, source = "sim", note = "";

      if (dataSource === "live") {
        try {
          setFetchStatus("fetching");
          const resp = await fetchBtCandles(symbol, tfId);
          candles = resp.candles;
          source  = resp.source;
          note    = resp.note ?? "";
          setFetchStatus(source === "sim" ? "fallback" : "ok");
        } catch (fetchErr) {
          console.warn("Fetch failed, using simulated data:", fetchErr.message);
          const sym = BT_SYMBOLS.find(s => s.id === symbol);
          candles = genBacktestCandles(500, sym?.base ?? 50000);
          source  = "sim";
          setFetchStatus("fallback");
        }
      } else {
        const sym = BT_SYMBOLS.find(s => s.id === symbol);
        candles = genBacktestCandles(500, sym?.base ?? 50000);
        setFetchStatus("sim");
      }

      let builtStrat;
      if (stratMode === "custom") {
        if (!entryConds.length) { setError("Add at least one entry condition."); setLoading(false); return; }
        if (!exitConds.length)  { setError("Add at least one exit condition."); setLoading(false); return; }
        builtStrat = compileCustomStrategy(entryConds, exitConds);
      } else {
        builtStrat = strat.build({ ...params });
      }

      const res = runBacktestV2({
        candles, strategy: builtStrat,
        initialBalance: initialBal, riskPct,
        slPct, tpPct,
        maxHoldBars: maxHold > 0 ? maxHold : null,
      });

      if (!res || !res.metrics) {
        setError("No trades generated. Try different conditions, looser SL/TP, or a longer timeframe.");
      } else {
        setResult({ ...res, source, symbol, tfId, note });
        setTradeTab("metrics");
      }
    } catch (e) { setError("Engine error: " + e.message); }
    setLoading(false);
  };

  const inp = { width:"100%", padding:"7px 10px", borderRadius:7, boxSizing:"border-box", background:"#111827", border:"1px solid #1e2d3e", fontSize:12, color:"#e2e8f0", outline:"none" };
  const lbl = { display:"block", fontSize:9, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:5 };
  const m   = result?.metrics;
  const lineClr = m ? (m.totalPnl >= 0 ? "#10b981" : "#ef4444") : "#38bdf8";

  // Condition row component
  const CondRow = ({ cond, side, idx }) => {
    const def = COND_DEFINITIONS.find(d => d.id === cond.id);
    const sideOptions = COND_DEFINITIONS.filter(d => d.side === side || d.side === "both");
    return (
      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 10px", borderRadius:7, background:"#111827", border:"1px solid #1e2d3e" }}>
        <select value={cond.id} onChange={e => setCond(side, idx, { id: e.target.value, value: COND_DEFINITIONS.find(d=>d.id===e.target.value)?.hint === "value" ? 14 : COND_DEFINITIONS.find(d=>d.id===e.target.value)?.hint === "bars" ? 20 : COND_DEFINITIONS.find(d=>d.id===e.target.value)?.hint === "count" ? 3 : null })}
          style={{ flex:1, ...inp, padding:"5px 8px" }}>
          {COND_DEFINITIONS.filter(d => d.side === side).map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
        {def?.hint && (
          <input type="number" value={cond.value ?? ""} onChange={e => setCond(side, idx, { value: parseFloat(e.target.value) || 14 })}
            style={{ ...inp, width:60, padding:"5px 8px", flexShrink:0 }} placeholder={def.hint}/>
        )}
        <button onClick={() => removeCond(side, idx)} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", padding:2, flexShrink:0 }}><X size={12}/></button>
      </div>
    );
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* ── Earnings dashboard ── */}
      <EarningsDashboard strategies={strategies} session={session}/>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800, color:"#f1f5f9", display:"flex", alignItems:"center", gap:10 }}>
            <TestTube2 size={20} style={{ color:"#38bdf8" }}/> Backtesting Engine
          </div>
          <div style={{ fontSize:11, color:"#475569", marginTop:3 }}>
            {dataSource === "live" ? "Live Coinbase data" : "Simulated data"} · {symbol} · {tfId} · 0.1% fee + slippage
          </div>
        </div>
        {/* Data source + fetch status */}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {fetchStatus === "fetching" && <span style={{ fontSize:10, color:"#fbbf24", display:"flex", alignItems:"center", gap:5 }}><span style={{ display:"inline-block", width:10, height:10, border:"2px solid #334155", borderTopColor:"#fbbf24", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/> Fetching…</span>}
          {fetchStatus === "ok"       && <span style={{ fontSize:10, color:"#34d399" }}>●  Live data loaded</span>}
          {fetchStatus === "fallback" && <span style={{ fontSize:10, color:"#f97316" }}>⚠  Coinbase offline — using simulated data</span>}
          <div style={{ display:"flex", borderRadius:7, overflow:"hidden", border:"1px solid #1a2035" }}>
            {[["live","📡 Live"],["sim","🔬 Sim"]].map(([id,label]) => (
              <button key={id} onClick={()=>setDataSource(id)} style={{ padding:"5px 12px", border:"none", fontSize:10, fontWeight:700, cursor:"pointer", background:dataSource===id?"#1e3a52":"#111827", color:dataSource===id?"#38bdf8":"#475569" }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"340px 1fr", gap:20, alignItems:"start" }}>

        {/* ── LEFT ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

          {/* Market settings */}
          <div style={{ borderRadius:12, border:"1px solid #1a2035", background:"#0d1120", padding:"14px" }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10, display:"flex", alignItems:"center", gap:5 }}>
              <Activity size={11}/> Market
            </div>

            {/* Symbol list — grouped */}
            <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:12 }}>
              <div style={{ fontSize:9, fontWeight:700, color:"#334155", textTransform:"uppercase", letterSpacing:"0.07em", padding:"2px 0" }}>Crypto</div>
              {BT_SYMBOLS.filter(s => s.source==="coinbase").map(s => (
                <button key={s.id} onClick={() => { setSymbol(s.id); setResult(null); }} style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"7px 10px", borderRadius:7, border:`1px solid ${symbol===s.id?"rgba(56,189,248,0.4)":"#1a2035"}`,
                  background: symbol===s.id ? "rgba(56,189,248,0.08)" : "#111827",
                  cursor:"pointer", transition:"all 0.12s",
                }}>
                  <span style={{ fontSize:11, fontWeight:700, color: symbol===s.id?"#38bdf8":"#94a3b8" }}>{s.label}</span>
                  <span style={{ fontSize:8, color:"#38bdf8", background:"rgba(56,189,248,0.08)", padding:"1px 6px", borderRadius:10 }}>Coinbase</span>
                </button>
              ))}
              <div style={{ fontSize:9, fontWeight:700, color:"#334155", textTransform:"uppercase", letterSpacing:"0.07em", padding:"6px 0 2px" }}>Futures & Indexes</div>
              {BT_SYMBOLS.filter(s => s.source==="yahoo").map(s => (
                <button key={s.id} onClick={() => { setSymbol(s.id); setResult(null); }} style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"7px 10px", borderRadius:7, border:`1px solid ${symbol===s.id?"rgba(251,191,36,0.4)":"#1a2035"}`,
                  background: symbol===s.id ? "rgba(251,191,36,0.06)" : "#111827",
                  cursor:"pointer", transition:"all 0.12s",
                }}>
                  <span style={{ fontSize:11, fontWeight:700, color: symbol===s.id?"#fbbf24":"#94a3b8" }}>{s.label}</span>
                  <span style={{ fontSize:8, color:"#fbbf24", background:"rgba(251,191,36,0.08)", padding:"1px 6px", borderRadius:10 }}>Yahoo</span>
                </button>
              ))}
            </div>

            {/* Timeframe */}
            <div>
              <label style={lbl}>Timeframe</label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
                {BT_TIMEFRAMES.map(t => (
                  <button key={t.id} onClick={()=>{setTfId(t.id);setResult(null);}} style={{ padding:"4px 8px", borderRadius:5, border:"none", fontSize:10, fontWeight:700, cursor:"pointer", background:tfId===t.id?"#1e3a52":"#111827", color:tfId===t.id?"#38bdf8":"#475569" }}>{t.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Strategy mode toggle */}
          <div style={{ borderRadius:12, border:"1px solid #1a2035", background:"#0d1120", padding:"14px" }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10, display:"flex", alignItems:"center", gap:5 }}>
              <Layers size={11}/> Strategy
            </div>
            <div style={{ display:"flex", borderRadius:7, overflow:"hidden", border:"1px solid #1a2035", marginBottom:14 }}>
              {[["builtin","📚 Built-in"],["custom","⚙️ Custom Builder"]].map(([id,label]) => (
                <button key={id} onClick={()=>{setStratMode(id);setResult(null);}} style={{ flex:1, padding:"7px 8px", border:"none", fontSize:10, fontWeight:700, cursor:"pointer", background:stratMode===id?"rgba(56,189,248,0.12)":"transparent", color:stratMode===id?"#38bdf8":"#475569" }}>{label}</button>
              ))}
            </div>

            {stratMode === "builtin" && (
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {BUILTIN_STRATEGIES.map(s => (
                  <button key={s.id} onClick={() => setStratId(s.id)} style={{ padding:"8px 10px", borderRadius:8, textAlign:"left", cursor:"pointer", border:`1px solid ${stratId===s.id?"rgba(56,189,248,0.4)":"#1a2035"}`, background:stratId===s.id?"rgba(56,189,248,0.08)":"#111827", transition:"all 0.15s" }}>
                    <div style={{ fontSize:11, fontWeight:700, color:stratId===s.id?"#38bdf8":"#94a3b8" }}>{s.name}</div>
                    <div style={{ fontSize:9, color:"#334155", marginTop:2 }}>{s.description}</div>
                  </button>
                ))}
              </div>
            )}

            {stratMode === "custom" && (
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {/* Entry conditions */}
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:"#34d399", marginBottom:6, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span>▲ Entry — ALL must be true</span>
                    <button onClick={()=>addCond("entry")} style={{ background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.2)", color:"#34d399", borderRadius:5, padding:"2px 8px", fontSize:9, cursor:"pointer", fontWeight:700 }}>+ Add</button>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                    {entryConds.map((c,i) => <CondRow key={i} cond={c} side="entry" idx={i}/>)}
                    {!entryConds.length && <div style={{ fontSize:10, color:"#334155", fontStyle:"italic", padding:"8px 10px" }}>No entry conditions — click + Add</div>}
                  </div>
                </div>
                {/* Exit conditions */}
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:"#f87171", marginBottom:6, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span>▼ Exit — ANY fires</span>
                    <button onClick={()=>addCond("exit")} style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", color:"#f87171", borderRadius:5, padding:"2px 8px", fontSize:9, cursor:"pointer", fontWeight:700 }}>+ Add</button>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                    {exitConds.map((c,i) => <CondRow key={i} cond={c} side="exit" idx={i}/>)}
                    {!exitConds.length && <div style={{ fontSize:10, color:"#334155", fontStyle:"italic", padding:"8px 10px" }}>No exit conditions — click + Add</div>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Params (builtin only) */}
          {stratMode === "builtin" && strat?.params.length > 0 && (
            <div style={{ borderRadius:12, border:"1px solid #1a2035", background:"#0d1120", padding:"14px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10, display:"flex", alignItems:"center", gap:5 }}><Zap size={11}/> Parameters</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {strat.params.map(p => (
                  <div key={p.key}>
                    <label style={lbl}>{p.label}</label>
                    <input type="number" style={inp} min={p.min} max={p.max} value={params[p.key]??p.default} onChange={e=>setParam(p.key,parseFloat(e.target.value)||p.default)}/>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk */}
          <div style={{ borderRadius:12, border:"1px solid #1a2035", background:"#0d1120", padding:"14px" }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10, display:"flex", alignItems:"center", gap:5 }}><Shield size={11}/> Risk & Capital</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <div><label style={lbl}>Balance</label><div style={{ position:"relative" }}><span style={{ position:"absolute", left:8, top:"50%", transform:"translateY(-50%)", fontSize:11, color:"#475569" }}>$</span><input type="number" style={{ ...inp, paddingLeft:18 }} value={initialBal} min={100} onChange={e=>setInitialBal(parseFloat(e.target.value)||10000)}/></div></div>
              <div><label style={lbl}>Risk / Trade %</label><input type="number" style={inp} value={riskPct} min={0.01} max={100} step={0.01} onChange={e=>setRiskPct(e.target.value)} onBlur={e=>{const v=parseFloat(e.target.value);setRiskPct(isNaN(v)||v<=0?0.01:v);}}/></div>
              <div><label style={lbl}>Stop Loss %</label><input type="number" style={inp} value={slPct} min={0.01} max={50} step={0.01} onChange={e=>setSlPct(e.target.value)} onBlur={e=>{const v=parseFloat(e.target.value);setSlPct(isNaN(v)||v<=0?0.01:v);}}/></div>
              <div><label style={lbl}>Take Profit %</label><input type="number" style={inp} value={tpPct} min={0.01} max={100} step={0.01} onChange={e=>setTpPct(e.target.value)} onBlur={e=>{const v=parseFloat(e.target.value);setTpPct(isNaN(v)||v<=0?0.01:v);}}/></div>
              <div><label style={lbl}>Max Hold (bars)</label><input type="number" style={inp} value={maxHold} min={0} max={2000} onChange={e=>setMaxHold(parseInt(e.target.value)||0)}/></div>
              <div><label style={lbl}>R:R Ratio</label><div style={{ padding:"7px 10px", borderRadius:7, background:"rgba(56,189,248,0.06)", border:"1px solid rgba(56,189,248,0.15)", fontSize:12, fontWeight:700, fontFamily:"monospace", color:"#38bdf8" }}>1 : {(tpPct/slPct).toFixed(1)}</div></div>
            </div>
          </div>

          {/* Run */}
          <button onClick={run} disabled={loading} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"13px", borderRadius:10, border:"none", background:loading?"#1a2035":"linear-gradient(135deg,#0369a1,#38bdf8)", color:loading?"#334155":"#fff", fontSize:13, fontWeight:700, cursor:loading?"not-allowed":"pointer", boxShadow:loading?"none":"0 4px 20px rgba(56,189,248,0.3)", transition:"all 0.2s" }}>
            {loading ? <><span style={{ display:"inline-block", width:12, height:12, border:"2px solid #334155", borderTopColor:"#475569", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/> Running…</> : <><Play size={14}/> Run Backtest</>}
          </button>

          {error && <div style={{ padding:"10px 12px", borderRadius:8, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", fontSize:11, color:"#f87171", display:"flex", alignItems:"center", gap:6 }}><AlertCircle size={11}/>{error}</div>}
        </div>

        {/* ── RIGHT: Results ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {!result && !loading && (
            <div style={{ padding:"80px 40px", borderRadius:14, border:"1px dashed #1a2035", textAlign:"center", color:"#334155" }}>
              <TestTube2 size={40} style={{ opacity:0.3, marginBottom:16 }}/>
              <div style={{ fontSize:14, fontWeight:600, color:"#475569", marginBottom:8 }}>Configure and run a backtest</div>
              <div style={{ fontSize:11, lineHeight:1.6 }}>Pick a symbol, timeframe, and strategy<br/>then click Run Backtest to see results.</div>
            </div>
          )}

          {result && m && (
            <>
              {/* Source badge + summary */}
              <div style={{ borderRadius:12, border:`1px solid ${m.totalPnl>=0?"rgba(16,185,129,0.25)":"rgba(239,68,68,0.25)"}`, background:`linear-gradient(135deg,${m.totalPnl>=0?"rgba(16,185,129,0.07)":"rgba(239,68,68,0.07)"},rgba(13,17,32,0.9))`, padding:"14px 18px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                      <span style={{ fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:8, background:result.source==="cached"?"rgba(251,191,36,0.12)":result.source==="live"?"rgba(52,211,153,0.12)":result.source==="sim"?"rgba(56,189,248,0.12)":"rgba(249,115,22,0.12)", color:result.source==="cached"?"#fbbf24":result.source==="live"?"#34d399":result.source==="sim"?"#38bdf8":"#f97316" }}>
                        {result.source==="cached"?"📦 Cached":result.source==="live"?"📡 Live Data":result.source==="sim"?"🔬 Simulated":"⚠ Fallback"}
                      </span>
                      <span style={{ fontSize:9, color:"#475569" }}>{result.symbol} · {result.tfId} · {m.totalTrades} trades</span>
                    </div>
                    <div style={{ fontSize:22, fontWeight:800, fontFamily:"monospace", color:m.totalPnl>=0?"#34d399":"#f87171" }}>
                      {m.totalPnl>=0?"+":""}{m.totalPnl.toFixed(2)}
                      <span style={{ fontSize:13, fontWeight:600, marginLeft:8 }}>{m.totalPnl>=0?"+":""}{m.returnPct}%</span>
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:10, color:"#64748b" }}>Final balance</div>
                    <div style={{ fontSize:16, fontWeight:700, fontFamily:"monospace", color:"#e2e8f0" }}>${m.finalBalance.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
                  </div>
                </div>
              </div>

              {/* Equity curve */}
              {result.equity.length > 1 && (
                <div style={{ borderRadius:12, border:"1px solid rgba(51,65,85,0.6)", background:"rgba(15,23,42,0.85)", padding:"14px 16px 8px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:"#cbd5e1" }}>Equity Curve</span>
                    <span style={{ fontSize:10, color:"#475569", fontFamily:"monospace" }}>Max DD: <span style={{ color:"#f87171" }}>-{m.maxDrawdown}%</span></span>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={result.equity} margin={{ top:4, right:4, left:-20, bottom:0 }}>
                      <defs><linearGradient id="btGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={lineClr} stopOpacity={0.25}/><stop offset="95%" stopColor={lineClr} stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" vertical={false}/>
                      <XAxis dataKey="label" tick={{ fontSize:8, fill:"#64748b" }} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                      <YAxis tick={{ fontSize:8, fill:"#64748b" }} tickLine={false} axisLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                      <Tooltip contentStyle={{ background:"#0d1120", border:"1px solid #1e2d3e", borderRadius:8, fontSize:10 }} formatter={(v)=>[`$${v.toFixed(2)}`,"Balance"]} itemStyle={{ color:lineClr }}/>
                      <Area type="monotone" dataKey="balance" stroke={lineClr} strokeWidth={2} fill="url(#btGrad2)" dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Tabs */}
              <div style={{ borderRadius:12, border:"1px solid #1a2035", background:"#0d1120", overflow:"hidden" }}>
                <div style={{ display:"flex", borderBottom:"1px solid #1a2035" }}>
                  {[["metrics","📊 Metrics"],["trades","🔁 Trades"]].map(([id,label]) => (
                    <button key={id} onClick={()=>setTradeTab(id)} style={{ flex:1, padding:"10px", border:"none", background:tradeTab===id?"rgba(56,189,248,0.06)":"transparent", color:tradeTab===id?"#38bdf8":"#475569", fontSize:11, fontWeight:700, cursor:"pointer", borderBottom:tradeTab===id?"2px solid #38bdf8":"2px solid transparent" }}>{label}</button>
                  ))}
                </div>

                {tradeTab === "metrics" && (
                  <div style={{ padding:"16px" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:12 }}>
                      {[
                        { label:"Win Rate",     val:`${m.winRate}%`,                color:m.winRate>=50?"#34d399":"#fbbf24" },
                        { label:"Profit Factor",val:m.profitFactor===999?"∞":String(m.profitFactor), color:m.profitFactor>=1.5?"#34d399":m.profitFactor>=1?"#fbbf24":"#f87171" },
                        { label:"Max Drawdown", val:`-${m.maxDrawdown}%`,           color:m.maxDrawdown>20?"#f87171":m.maxDrawdown>10?"#fbbf24":"#34d399" },
                        { label:"Trades",       val:String(m.totalTrades),          color:"#94a3b8" },
                        { label:"W / L",        val:`${m.wins} / ${m.losses}`,      color:"#94a3b8" },
                        { label:"Avg Hold",     val:`${m.avgHoldBars} bars`,        color:"#94a3b8" },
                        { label:"Avg Win",      val:`+${m.avgWin.toFixed(2)}`,      color:"#34d399" },
                        { label:"Avg Loss",     val:`-${m.avgLoss.toFixed(2)}`,     color:"#f87171" },
                        { label:"Expectancy",   val:m.expectancy.toFixed(4),        color:m.expectancy>0?"#34d399":"#f87171" },
                        { label:"SL Hits",      val:String(m.slHits),              color:"#f87171" },
                        { label:"TP Hits",      val:String(m.tpHits),              color:"#34d399" },
                        { label:"Return",       val:`${m.returnPct}%`,              color:m.returnPct>=0?"#34d399":"#f87171" },
                      ].map(({ label,val,color }) => (
                        <div key={label} style={{ background:"#111827", borderRadius:8, padding:"9px 10px" }}>
                          <div style={{ fontSize:8, color:"#334155", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>{label}</div>
                          <div style={{ fontSize:13, fontWeight:700, fontFamily:"monospace", color }}>{val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding:"8px 12px", borderRadius:7, background:"rgba(99,102,241,0.06)", border:"1px solid rgba(99,102,241,0.15)", fontSize:10, color:"#64748b" }}>
                      R:R 1:{(tpPct/slPct).toFixed(1)} · SL {slPct}% · TP {tpPct}% · Risk {riskPct}%/trade
                    </div>
                  </div>
                )}

                {tradeTab === "trades" && (
                  <div style={{ overflowX:"auto", maxHeight:340 }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", minWidth:480 }}>
                      <thead>
                        <tr style={{ background:"rgba(10,15,30,0.95)" }}>
                          {["#","Entry","Exit","PnL","Hold","Exit"].map(h => (
                            <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:9, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", borderBottom:"1px solid rgba(30,41,59,0.8)", whiteSpace:"nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.trades.map((t,idx) => (
                          <tr key={t.id} style={{ borderBottom:"1px solid rgba(30,41,59,0.4)" }} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                            <td style={{ padding:"7px 12px", fontSize:11, color:"#334155", fontFamily:"monospace" }}>{idx+1}</td>
                            <td style={{ padding:"7px 12px", fontSize:11, fontFamily:"monospace", color:"#94a3b8" }}>{t.entryPrice.toFixed(2)}</td>
                            <td style={{ padding:"7px 12px", fontSize:11, fontFamily:"monospace", color:"#94a3b8" }}>{t.exitPrice.toFixed(2)}</td>
                            <td style={{ padding:"7px 12px", fontSize:11, fontFamily:"monospace", fontWeight:700, color:(t.pnl??0)>=0?"#34d399":"#f87171" }}>{(t.pnl??0)>=0?"+":""}{(t.pnl??0).toFixed(4)}</td>
                            <td style={{ padding:"7px 12px", fontSize:11, fontFamily:"monospace", color:"#64748b" }}>{t.holdBars}</td>
                            <td style={{ padding:"7px 12px" }}>
                              <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:8, background:t.exitReason==="TP"?"rgba(52,211,153,0.1)":t.exitReason==="SL"?"rgba(239,68,68,0.1)":"rgba(56,189,248,0.1)", color:t.exitReason==="TP"?"#34d399":t.exitReason==="SL"?"#f87171":"#38bdf8" }}>{t.exitReason}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={{ padding:"10px 14px", borderRadius:9, background:"rgba(251,191,36,0.05)", border:"1px solid rgba(251,191,36,0.15)", fontSize:10, color:"#78716c", lineHeight:1.6 }}>
                ⚠️ <strong style={{ color:"#fbbf24" }}>Backtest ≠ live performance.</strong>{" "}
                {result.source==="live"
                  ? `Real historical data was used — but past performance doesn't guarantee future results.`
                  : result.source==="cached"
                  ? "Cached historical data was used."
                  : "Simulated price data was used — results are illustrative only."}
                {result.note && <><br/><span style={{ color:"#64748b" }}>{result.note}</span></>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Simple date picker modal ──────────────────────────────────
function DatePickerModal({ trade, onSave, onClose }) {
  const init = trade.date ? new Date(trade.date) : new Date();
  const [day,   setDay]   = useState(init.getDate());
  const [month, setMonth] = useState(init.getMonth() + 1); // 1-12
  const [year,  setYear]  = useState(init.getFullYear());

  const daysInMonth = new Date(year, month, 0).getDate();

  const save = () => {
    const ts = new Date(year, month - 1, day, 12, 0, 0).getTime();
    onSave({ ...trade, date: ts, _dateFromImage: true });
    onClose();
  };

  const sel = {
    padding:"8px 12px", borderRadius:8, background:"#111827",
    border:"1px solid #1e2d3e", fontSize:13, fontWeight:700,
    color:"#e2e8f0", outline:"none", cursor:"pointer", textAlign:"center",
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:90, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(4px)" }}/>
      <div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:300, borderRadius:14, border:"1px solid #1a2035", background:"#0d1120", boxShadow:"0 20px 50px rgba(0,0,0,0.6)", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:"1px solid #1a2035" }}>
          <span style={{ fontSize:13, fontWeight:700, color:"#e2e8f0", display:"flex", alignItems:"center", gap:7 }}>
            <Calendar size={14} style={{ color:"#38bdf8" }}/> Set Trade Date
          </span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer" }}><X size={15}/></button>
        </div>

        <div style={{ padding:"20px 18px", display:"flex", flexDirection:"column", gap:16 }}>
          {/* Trade info */}
          <div style={{ fontSize:11, color:"#64748b", textAlign:"center" }}>
            <span style={{ fontWeight:700, color:"#94a3b8" }}>{trade.pair ?? "Trade"}</span>
            {" · "}{trade.type?.toUpperCase()}{" · "}
            <span style={{ color:(trade.pnl??0)>=0?"#34d399":"#f87171", fontWeight:700 }}>
              {(trade.pnl??0)>=0?"+":""}{(trade.pnl??0).toFixed(2)}
            </span>
          </div>

          {/* Pickers */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            {/* Month */}
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:9, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Month</div>
              <select value={month} onChange={e => { setMonth(Number(e.target.value)); setDay(d => Math.min(d, new Date(year, Number(e.target.value), 0).getDate())); }} style={sel}>
                {MONTH_NAMES.map((name, i) => <option key={i} value={i+1}>{name.slice(0,3)}</option>)}
              </select>
            </div>

            {/* Day */}
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:9, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Day</div>
              <select value={day} onChange={e => setDay(Number(e.target.value))} style={sel}>
                {Array.from({length: daysInMonth}, (_, i) => i+1).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Year */}
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:9, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Year</div>
              <select value={year} onChange={e => setYear(Number(e.target.value))} style={sel}>
                {Array.from({length: 10}, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Preview */}
          <div style={{ textAlign:"center", fontSize:12, color:"#64748b", fontFamily:"monospace" }}>
            {MONTH_NAMES[month-1]} {day}, {year}
          </div>

          {/* Buttons */}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid #1e2d3e", background:"transparent", color:"#64748b", fontSize:12, fontWeight:600, cursor:"pointer" }}>Cancel</button>
            <button onClick={save} style={{ flex:2, padding:"10px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#0369a1,#38bdf8)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>Set Date</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function isUnknownDate(trade) {
  // Screenshot trades where no date was extracted from the image
  return trade.source === "screenshot" && !trade._dateFromImage;
}

function groupByDay(trades) {
  const map = {};
  trades.forEach(t => {
    if (isUnknownDate(t)) return;
    const d   = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    if (!map[key]) map[key] = [];
    map[key].push(t);
  });
  return map;
}

function CalendarPage({ trades, onEditTrade, onSaveTrade }) {
  const today = new Date();
  const [year,        setYear]        = useState(today.getFullYear());
  const [month,       setMonth]       = useState(today.getMonth());
  const [selected,    setSelected]    = useState(null);
  const [datePicking, setDatePicking] = useState(null); // trade being date-picked

  const byDay = useMemo(() => groupByDay(trades), [trades]);

  const unknownTrades = useMemo(() => trades.filter(isUnknownDate), [trades]);

  // Build calendar grid — array of weeks, each week is 7 cells (null = padding)
  const grid = useMemo(() => {
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [...Array(firstDay).fill(null), ...Array.from({length: daysInMonth}, (_,i) => i+1)];
    while (cells.length % 7) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i+7));
    return weeks;
  }, [year, month]);

  // Monthly totals
  const monthStats = useMemo(() => {
    const prefix = `${year}-${String(month+1).padStart(2,"0")}`;
    const ts = Object.entries(byDay).filter(([k]) => k.startsWith(prefix)).flatMap(([,v]) => v);
    const pnl = +ts.reduce((s,t) => s+(t.pnl??0), 0).toFixed(2);
    return { total: ts.length, pnl, wins: ts.filter(t=>(t.pnl??0)>0).length, losses: ts.filter(t=>(t.pnl??0)<=0&&t.pnl!==undefined).length };
  }, [byDay, year, month]);

  const prevMonth = () => month===0 ? (setYear(y=>y-1), setMonth(11)) : setMonth(m=>m-1);
  const nextMonth = () => month===11? (setYear(y=>y+1), setMonth(0))  : setMonth(m=>m+1);

  const selectDay = (day) => {
    if (!day) return;
    const key = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const ts  = byDay[key];
    if (ts?.length) setSelected(s => s?.key===key ? null : { key, trades:ts, label:`${MONTH_NAMES[month]} ${day}, ${year}` });
  };

  const dayBg = (pnl, count) => {
    if (!count) return null;
    if (pnl > 0)  return pnl > 50 ? "rgba(16,185,129,0.28)" : "rgba(16,185,129,0.14)";
    if (pnl < 0)  return pnl < -50? "rgba(239,68,68,0.28)"  : "rgba(239,68,68,0.14)";
    return "rgba(100,116,139,0.15)";
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* Date picker modal */}
      {datePicking && (
        <DatePickerModal
          trade={datePicking}
          onClose={() => setDatePicking(null)}
          onSave={(updated) => { onSaveTrade(updated); setDatePicking(null); }}
        />
      )}

      {/* Page header + nav */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800, color:"#f1f5f9", display:"flex", alignItems:"center", gap:10 }}>
            <Calendar size={20} style={{ color:"#38bdf8" }}/> Trade Calendar
          </div>
          <div style={{ fontSize:11, color:"#475569", marginTop:3 }}>Daily activity · green = profit · red = loss · click a day to drill in</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <button onClick={prevMonth} style={{ width:32, height:32, borderRadius:8, border:"1px solid #1a2035", background:"#111827", color:"#94a3b8", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
          <div style={{ minWidth:170, textAlign:"center", fontSize:14, fontWeight:700, color:"#e2e8f0" }}>{MONTH_NAMES[month]} {year}</div>
          <button onClick={nextMonth} style={{ width:32, height:32, borderRadius:8, border:"1px solid #1a2035", background:"#111827", color:"#94a3b8", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
          <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }} style={{ padding:"5px 12px", borderRadius:7, border:"1px solid #1a2035", background:"#111827", color:"#64748b", fontSize:11, fontWeight:600, cursor:"pointer" }}>Today</button>
        </div>
      </div>

      {/* Monthly summary */}
      {monthStats.total > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
          {[
            { label:"Trades this month", val:String(monthStats.total),                                       color:"#94a3b8" },
            { label:"Wins",              val:String(monthStats.wins),                                        color:"#34d399" },
            { label:"Losses",            val:String(monthStats.losses),                                      color:"#f87171" },
            { label:"Net PnL",           val:`${(monthStats.pnl??0)>=0?"+":""}${(monthStats.pnl??0).toFixed(2)}`,                 color:(monthStats.pnl??0)>=0?"#34d399":"#f87171" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ borderRadius:10, border:"1px solid #1a2035", background:"#0d1120", padding:"10px 14px" }}>
              <div style={{ fontSize:9, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>{label}</div>
              <div style={{ fontSize:20, fontWeight:800, fontFamily:"monospace", color }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      <div style={{ borderRadius:14, border:"1px solid #1a2035", background:"#0d1120", overflow:"hidden" }}>
        {/* Day-of-week header */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom:"1px solid #1a2035" }}>
          {DAY_LABELS.map(d => (
            <div key={d} style={{ padding:"8px 4px", textAlign:"center", fontSize:10, fontWeight:700, color:"#334155", textTransform:"uppercase", letterSpacing:"0.07em" }}>{d}</div>
          ))}
        </div>

        {grid.map((week, wi) => (
          <div key={wi} style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom: wi < grid.length-1 ? "1px solid rgba(30,41,59,0.4)" : "none" }}>
            {week.map((day, di) => {
              if (!day) return <div key={di} style={{ minHeight:80, borderRight: di<6 ? "1px solid rgba(30,41,59,0.4)" : "none" }}/>;

              const key   = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const ts    = byDay[key] ?? [];
              const pnl   = +ts.reduce((s,t) => s+(t.pnl??0), 0).toFixed(2);
              const isToday = day===today.getDate() && month===today.getMonth() && year===today.getFullYear();
              const isSelected = selected?.key === key;

              return (
                <div key={di} onClick={() => selectDay(day)} style={{
                  minHeight:80, padding:"6px 7px", position:"relative",
                  background: isSelected ? "rgba(56,189,248,0.08)" : (dayBg(pnl, ts.length) ?? "transparent"),
                  border: isSelected ? "2px solid rgba(56,189,248,0.4)" : "none",
                  borderRight: di<6 ? "1px solid rgba(30,41,59,0.4)" : "none",
                  cursor: ts.length ? "pointer" : "default",
                  boxSizing:"border-box",
                  transition:"background 0.1s",
                }}
                onMouseEnter={e => { if (ts.length && !isSelected) e.currentTarget.style.filter="brightness(1.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.filter=""; }}
                >
                  {/* Day number */}
                  <div style={{ marginBottom:3 }}>
                    {isToday ? (
                      <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:20, height:20, borderRadius:"50%", background:"#38bdf8", color:"#000", fontSize:10, fontWeight:800 }}>{day}</span>
                    ) : (
                      <span style={{ fontSize:11, fontWeight:500, color: ts.length?"#cbd5e1":"#334155" }}>{day}</span>
                    )}
                  </div>

                  {/* PnL + count */}
                  {ts.length > 0 && (
                    <>
                      <div style={{ fontSize:10, fontWeight:800, fontFamily:"monospace", color:pnl>=0?"#34d399":"#f87171", lineHeight:1.2 }}>
                        {pnl>=0?"+":""}{pnl}
                      </div>
                      <div style={{ fontSize:8, color:"#64748b", marginTop:2 }}>
                        {ts.length} trade{ts.length!==1?"s":""}
                      </div>
                      {/* Dot strip */}
                      <div style={{ display:"flex", flexWrap:"wrap", gap:2, marginTop:5 }}>
                        {ts.slice(0,8).map((t,i) => (
                          <div key={i} style={{ width:5, height:5, borderRadius:"50%", background:(t.pnl??0)>=0?"#10b981":"#ef4444", flexShrink:0 }}/>
                        ))}
                        {ts.length>8 && <span style={{ fontSize:7, color:"#475569", lineHeight:"5px" }}>+{ts.length-8}</span>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Selected day detail */}
      {selected && (
        <div style={{ borderRadius:12, border:"1px solid rgba(56,189,248,0.25)", background:"#0d1120", overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid #1a2035" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <Calendar size={13} style={{ color:"#38bdf8" }}/>
              <span style={{ fontSize:13, fontWeight:700, color:"#e2e8f0" }}>{selected.label}</span>
              <span style={{ fontSize:10, color:"#475569" }}>— {selected.trades.length} trade{selected.trades.length!==1?"s":""}</span>
              {/* Day PnL */}
              <span style={{ fontSize:12, fontFamily:"monospace", fontWeight:700, color: selected.trades.reduce((s,t)=>s+(t.pnl??0),0)>=0?"#34d399":"#f87171" }}>
                {selected.trades.reduce((s,t)=>s+(t.pnl??0),0)>=0?"+":""}{selected.trades.reduce((s,t)=>s+(t.pnl??0),0).toFixed(2)}
              </span>
            </div>
            <button onClick={()=>setSelected(null)} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer" }}><X size={14}/></button>
          </div>
          <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:7 }}>
            {selected.trades.map(t => {
              const w = (t.pnl??0)>=0;
              return (
                <div key={t.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 12px", borderRadius:8, background:"#111827", border:`1px solid ${w?"rgba(16,185,129,0.18)":"rgba(239,68,68,0.18)"}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                    <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:4, background:t.type==="long"?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.12)", color:t.type==="long"?"#34d399":"#f87171", flexShrink:0 }}>
                      {t.type==="long"?"▲":"▼"} {t.type?.toUpperCase()}
                    </span>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:"#e2e8f0" }}>{t.pair}</div>
                      <div style={{ fontSize:9, color:"#475569" }}>{t.strategy} · {new Date(t.date).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:13, fontWeight:700, fontFamily:"monospace", color:w?"#34d399":"#f87171" }}>{w?"+":""}{(t.pnl??0).toFixed(2)}</div>
                      <div style={{ fontSize:9, color:w?"#34d399":"#f87171", opacity:0.7 }}>{(t.pnlPercent??0)>=0?"+":""}{(t.pnlPercent??0).toFixed(2)}%</div>
                    </div>
                    <button onClick={() => onEditTrade(t)} style={{ padding:"4px 8px", borderRadius:6, border:"1px solid #1e2d3e", background:"transparent", color:"#475569", cursor:"pointer" }}>
                      <Edit2 size={10}/>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unknown date section */}
      {unknownTrades.length > 0 && (
        <div style={{ borderRadius:12, border:"1px solid rgba(251,191,36,0.25)", background:"#0d1120", overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid #1a2035", display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:16 }}>❓</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#fbbf24" }}>Unknown Date</div>
              <div style={{ fontSize:10, color:"#64748b" }}>
                {unknownTrades.length} screenshot trade{unknownTrades.length!==1?"s":""} where no date was visible — click "Set Date" to add them to the calendar
              </div>
            </div>
          </div>
          <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:7 }}>
            {unknownTrades.map(t => {
              const w = (t.pnl??0)>=0;
              return (
                <div key={t.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 12px", borderRadius:8, background:"#111827", border:"1px solid rgba(251,191,36,0.12)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:4, background:"rgba(251,191,36,0.1)", color:"#fbbf24", flexShrink:0 }}>NO DATE</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#e2e8f0" }}>{t.pair ?? "Unknown"}</div>
                      <div style={{ fontSize:9, color:"#475569" }}>{t.strategy}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:13, fontWeight:700, fontFamily:"monospace", color:w?"#34d399":"#f87171" }}>{w?"+":""}{(t.pnl??0).toFixed(2)}</div>
                    </div>
                    <button onClick={() => setDatePicking(t)} style={{ padding:"5px 10px", borderRadius:6, border:"1px solid rgba(251,191,36,0.3)", background:"rgba(251,191,36,0.06)", color:"#fbbf24", cursor:"pointer", fontSize:10, fontWeight:700 }}>
                      Set Date
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {trades.length === 0 && (
        <div style={{ padding:"60px 24px", textAlign:"center", borderRadius:12, border:"1px dashed #1a2035", color:"#334155" }}>
          <Calendar size={40} style={{ opacity:0.3, marginBottom:16 }}/>
          <div style={{ fontSize:13, color:"#475569" }}>No trades yet — log your first trade to see it on the calendar</div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  JOURNAL PAGE  — trades + calendar + analytics unified
// ═══════════════════════════════════════════════════════════════

function JournalPage({ trades, onEdit, onDelete, onAdd, onCSV, onSaveTrade, activeAccount, username }) {
  const [reviewTrade, setReviewTrade] = useState(null);
  const inDemo = username && isDemoMode(username);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:32 }}>
      {/* AI Trade Review Modal */}
      {reviewTrade && <AITradeReview trade={reviewTrade} allTrades={trades} onClose={() => setReviewTrade(null)}/>}

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:"#f1f5f9" }}>Journal</div>
          {activeAccount && (
            <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>
              {activeAccount.name} · {trades.length} trade{trades.length!==1?"s":""}
            </div>
          )}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {inDemo && (
            <div style={{ fontSize:10, fontWeight:700, color:"#fbbf24", background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.25)", padding:"4px 10px", borderRadius:8 }}>
              🎮 Exit demo mode to add trades
            </div>
          )}
          <a href={inDemo ? undefined : "/import"} onClick={inDemo ? e => e.preventDefault() : undefined}
            title={inDemo ? "Exit demo mode to import trades" : "Import CSV"}
            style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", borderRadius:8, border:"1px solid rgba(56,189,248,0.25)", background:inDemo?"#0b1120":"rgba(56,189,248,0.06)", color:inDemo?"#334155":"#38bdf8", fontSize:11, fontWeight:700, cursor:inDemo?"not-allowed":"pointer", textDecoration:"none", opacity:inDemo?0.5:1 }}>
            <Upload size={11}/> Import CSV
          </a>
          <button onClick={inDemo ? undefined : onAdd} disabled={inDemo}
            title={inDemo ? "Exit demo mode to log trades" : "Log Trade"}
            style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", borderRadius:8, border:"none", background:inDemo?"#0b1120":"linear-gradient(135deg,#0369a1,#38bdf8)", color:inDemo?"#334155":"#fff", fontSize:11, fontWeight:700, cursor:inDemo?"not-allowed":"pointer", opacity:inDemo?0.5:1 }}>
            <Plus size={12}/> Log Trade
          </button>
        </div>
      </div>

      {/* Trades */}
      <section>
        <TradeTable trades={trades} onEdit={onEdit} onDelete={onDelete} onReview={setReviewTrade}/>
      </section>

      {/* Divider */}
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ flex:1, height:1, background:"#1a2035" }}/>
        <span style={{ fontSize:10, fontWeight:700, color:"#334155", textTransform:"uppercase", letterSpacing:"0.07em", display:"flex", alignItems:"center", gap:5 }}><Calendar size={11}/> Calendar</span>
        <div style={{ flex:1, height:1, background:"#1a2035" }}/>
      </div>

      {/* Calendar */}
      <section>
        <CalendarPage trades={trades} onEditTrade={t => onEdit(t)} onSaveTrade={onSaveTrade}/>
      </section>

      {/* Divider */}
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ flex:1, height:1, background:"#1a2035" }}/>
        <span style={{ fontSize:10, fontWeight:700, color:"#334155", textTransform:"uppercase", letterSpacing:"0.07em", display:"flex", alignItems:"center", gap:5 }}><BarChart2 size={11}/> Analytics</span>
        <div style={{ flex:1, height:1, background:"#1a2035" }}/>
      </div>

      {/* Analytics */}
      <section>
        <AnalyticsPanel trades={trades}/>
      </section>

    </div>
  );
}

// ── Activity Feed Logger ──────────────────────────────────────
async function logActivity(userId, type, data = {}) {
  if (!userId) return;
  try {
    await fetch("/api/activity", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ user_id: userId, type, data }),
    });
  } catch {}
}

// ── Platform nav dropdown ─────────────────────────────────────
function PlatformDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const items = [
      { href:"/leaderboard", emoji:"🏆", label:"Leaderboard",   color:"#818cf8" },
      { href:"/earnings",    emoji:"💰", label:"Earnings",       color:"#22d3a5" },
      { href:"/replay",      emoji:"📽️", label:"Trade Replay",    color:"#38bdf8" },
      { href:"/import",      emoji:"📥", label:"Import",         color:"#34d399" },
    ];

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius:7, border:`1px solid ${open?"#38bdf8":"#1a2035"}`, background:open?"rgba(56,189,248,0.08)":"transparent", color:open?"#38bdf8":"#64748b", fontSize:11, fontWeight:700, cursor:"pointer" }}>
        Platform {open ? "▲" : "▼"}
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 6px)", right:0, background:"#0d1120", border:"1px solid #1a2035", borderRadius:12, padding:"6px", minWidth:160, zIndex:100, boxShadow:"0 12px 40px rgba(0,0,0,0.6)" }}>
          {items.map(item => (
            <a key={item.href} href={item.href} onClick={() => setOpen(false)} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", borderRadius:8, color:"#94a3b8", fontSize:12, fontWeight:600, textDecoration:"none" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#111827"; e.currentTarget.style.color = item.color; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; }}>
              <span style={{ fontSize:14 }}>{item.emoji}</span>
              {item.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────
function Skeleton({ width = "100%", height = 16, radius = 6, style = {} }) {
  return (
    <div style={{ width, height, borderRadius:radius, background:"linear-gradient(90deg,#1a2035 25%,#1e2540 50%,#1a2035 75%)", backgroundSize:"200% 100%", animation:"shimmer 1.5s infinite", flexShrink:0, ...style }}/>
  );
}

function SkeletonCard({ lines = 3 }) {
  return (
    <div style={{ background:"#0d1120", border:"1px solid #1a2035", borderRadius:12, padding:"16px", display:"flex", flexDirection:"column", gap:10 }}>
      <Skeleton width="60%" height={14}/>
      {Array.from({length:lines-1}).map((_,i) => <Skeleton key={i} width={i===lines-2?"40%":"100%"} height={12}/>)}
    </div>
  );
}

// ── Weekly Challenges ─────────────────────────────────────────
// ── Weekly Performance Report ─────────────────────────────────
function WeeklyReport({ trades }) {
  const REPORT_KEY = "nexyru_weekly_report_v1";
  const [report,    setReport]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [expanded,  setExpanded]  = useState(false);
  const [lastGenerated, setLastGenerated] = useState(null);

  // Get last week's date range
  const now         = new Date();
  const dayOfWeek   = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const thisMonday  = new Date(now); thisMonday.setDate(now.getDate() - dayOfWeek); thisMonday.setHours(0,0,0,0);
  const lastMonday  = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSunday  = new Date(thisMonday); lastSunday.setDate(thisMonday.getDate() - 1); lastSunday.setHours(23,59,59,999);

  const lastWeekTrades = trades.filter(t => {
    const d = new Date(t.date);
    return d >= lastMonday && d <= lastSunday;
  });

  const isMonday    = dayOfWeek === 0;
  const weekLabel   = `${lastMonday.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${lastSunday.toLocaleDateString("en-US",{month:"short",day:"numeric"})}`;

  // Load saved report from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(REPORT_KEY) ?? "null");
      if (saved?.weekStart === lastMonday.toISOString()) {
        setReport(saved.report);
        setLastGenerated(saved.generatedAt);
      }
    } catch {}
  }, []);

  const generateReport = async () => {
    if (lastWeekTrades.length === 0) return;
    setLoading(true);
    try {
      // Build rich summary for Claude
      const wins       = lastWeekTrades.filter(t => (t.pnl??0) > 0);
      const losses     = lastWeekTrades.filter(t => (t.pnl??0) <= 0);
      const winRate    = Math.round((wins.length / lastWeekTrades.length) * 100);
      const totalPnl   = lastWeekTrades.reduce((s,t) => s+(t.pnl??0), 0);
      const bestTrade  = [...lastWeekTrades].sort((a,b) => (b.pnl??0)-(a.pnl??0))[0];
      const worstTrade = [...lastWeekTrades].sort((a,b) => (a.pnl??0)-(b.pnl??0))[0];
      const tradingDays = new Set(lastWeekTrades.map(t => new Date(t.date).toDateString())).size;
      const avgWin     = wins.length    ? wins.reduce((s,t)=>s+(t.pnl??0),0)/wins.length       : 0;
      const avgLoss    = losses.length  ? losses.reduce((s,t)=>s+(t.pnl??0),0)/losses.length   : 0;
      const patterns   = detectPatterns(lastWeekTrades).map(p => `${p.title}: ${p.body}`);

      // By strategy
      const byStrat = {};
      lastWeekTrades.forEach(t => {
        const s = t.strategy || "Unknown";
        if (!byStrat[s]) byStrat[s] = { wins:0, losses:0, pnl:0 };
        if ((t.pnl??0) > 0) byStrat[s].wins++; else byStrat[s].losses++;
        byStrat[s].pnl += (t.pnl??0);
      });
      const stratSummary = Object.entries(byStrat).map(([s,v]) => `${s}: ${v.wins}W/${v.losses}L, PnL ${(v.pnl??0).toFixed(2)}`);

      const prompt = `You are an expert trading coach reviewing a trader's weekly performance. Write a concise, personalised weekly performance report.

WEEK: ${weekLabel}
SUMMARY:
- Total trades: ${lastWeekTrades.length} across ${tradingDays} day(s)
- Win rate: ${winRate}% (${wins.length}W / ${losses.length}L)
- Total PnL: ${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
- Avg win: +${avgWin.toFixed(2)} | Avg loss: ${avgLoss.toFixed(2)}
- Best trade: ${bestTrade?.pair ?? "N/A"} +${(bestTrade?.pnl??0).toFixed(2)}
- Worst trade: ${worstTrade?.pair ?? "N/A"} ${(worstTrade?.pnl??0).toFixed(2)}
- Strategies used: ${stratSummary.join(", ") || "None tagged"}
- Patterns detected: ${patterns.length > 0 ? patterns.join("; ") : "None"}

Write a report with these sections:
1. **Week Summary** (2-3 sentences, honest assessment)
2. **What Worked** (specific positives from the data)
3. **What to Fix** (1-2 specific actionable improvements)
4. **Focus for Next Week** (one clear goal)

Be direct, specific, and use the actual numbers. Don't be generic. Max 200 words total.`;

      const res  = await fetch("/api/generate-insights", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ summary: { prompt, raw: true } }),
      });
      const data = await res.json();
      const text = data.insight ?? data.error ?? "Failed to generate report";

      // Save to localStorage
      const saved = { weekStart: lastMonday.toISOString(), report: text, generatedAt: new Date().toISOString() };
      localStorage.setItem(REPORT_KEY, JSON.stringify(saved));
      setReport(text);
      setLastGenerated(saved.generatedAt);
      setExpanded(true);
    } catch (e) {
      setReport("Failed to generate report — check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate on Monday if not done yet
  useEffect(() => {
    if (isMonday && lastWeekTrades.length > 0 && !report && !loading) {
      generateReport();
    }
  }, [isMonday, lastWeekTrades.length]);

  if (lastWeekTrades.length === 0) return null;

  return (
    <div style={{ borderRadius:16, border:`1px solid ${report ? "rgba(129,140,248,0.3)" : "#1a2035"}`, background: report ? "rgba(99,102,241,0.04)" : "#0b1120", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }} onClick={() => report && setExpanded(v => !v)}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:"linear-gradient(135deg,#4f46e5,#818cf8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>📋</div>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:13, fontWeight:800, color:"#f1f5f9" }}>Weekly Report</span>
              {isMonday && <span style={{ fontSize:9, padding:"1px 7px", borderRadius:10, background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.25)", color:"#34d399", fontWeight:700 }}>NEW</span>}
            </div>
            <div style={{ fontSize:10, color:"#475569", marginTop:1 }}>
              {weekLabel} · {lastWeekTrades.length} trade{lastWeekTrades.length!==1?"s":""}
              {lastGenerated && ` · Generated ${new Date(lastGenerated).toLocaleDateString()}`}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {!report && (
            <button onClick={e => { e.stopPropagation(); generateReport(); }} disabled={loading} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:9, border:"none", background:loading?"#1a2035":"linear-gradient(135deg,#4f46e5,#818cf8)", color:loading?"#334155":"#fff", fontSize:11, fontWeight:700, cursor:loading?"not-allowed":"pointer" }}>
              {loading ? <>
                <span style={{ display:"inline-block", width:10, height:10, border:"2px solid #334155", borderTopColor:"#818cf8", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
                Generating…
              </> : <><Sparkles size={11}/> Generate Report</>}
            </button>
          )}
          {report && (
            <>
              <button onClick={e => { e.stopPropagation(); generateReport(); }} disabled={loading} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 10px", borderRadius:7, border:"1px solid rgba(129,140,248,0.2)", background:"transparent", color:"#818cf8", fontSize:10, fontWeight:600, cursor:"pointer" }}>
                <RefreshCw size={9}/> {loading ? "…" : "Refresh"}
              </button>
              <ChevronDown size={14} style={{ color:"#475569", transform:expanded?"rotate(180deg)":"none", transition:"transform 0.2s", flexShrink:0 }}/>
            </>
          )}
        </div>
      </div>

      {/* Quick stats row — always visible */}
      {(() => {
        const wins    = lastWeekTrades.filter(t => (t.pnl??0) > 0);
        const wr      = Math.round(wins.length / lastWeekTrades.length * 100);
        const pnl     = lastWeekTrades.reduce((s,t) => s+(t.pnl??0), 0);
        const days    = new Set(lastWeekTrades.map(t => new Date(t.date).toDateString())).size;
        const pos     = pnl >= 0;
        return (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", borderTop:"1px solid #111827" }}>
            {[
              { label:"Trades",  value:String(lastWeekTrades.length), color:"#94a3b8" },
              { label:"Win Rate",value:`${wr}%`,                      color:wr>=55?"#34d399":wr>=45?"#fbbf24":"#f87171" },
              { label:"PnL",     value:`${pos?"+":""}${pnl.toFixed(2)}`, color:pos?"#34d399":"#f87171" },
              { label:"Days",    value:String(days),                   color:"#38bdf8" },
            ].map((s,i) => (
              <div key={i} style={{ padding:"10px 0", textAlign:"center", borderRight:i<3?"1px solid #111827":"none" }}>
                <div style={{ fontSize:9, color:"#3a4a6a", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{s.label}</div>
                <div style={{ fontSize:14, fontWeight:800, fontFamily:"monospace", color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Report text */}
      {expanded && report && (
        <div style={{ padding:"16px 18px", borderTop:"1px solid #111827" }}>
          <div style={{ fontSize:12, color:"#94a3b8", lineHeight:2, whiteSpace:"pre-wrap" }}>
            {report.split(/\*\*(.*?)\*\*/g).map((part, i) =>
              i % 2 === 1
                ? <strong key={i} style={{ color:"#e2e8f0", fontWeight:700 }}>{part}</strong>
                : part
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WeeklyChallenges({ trades }) {
  // Get start of current week (Monday)
  const now       = new Date();
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  // Last week's trades for adaptive difficulty
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekTrades = trades.filter(t => {
    const d = new Date(t.date);
    return d >= lastWeekStart && d < weekStart;
  });
  const lastWeekCount  = lastWeekTrades.length;
  const lastWeekWins   = lastWeekTrades.filter(t => (t.pnl ?? 0) > 0).length;
  const lastWeekWr     = lastWeekCount > 0 ? (lastWeekWins / lastWeekCount) * 100 : 0;
  const lastWeekDays   = new Set(lastWeekTrades.map(t => new Date(t.date).toDateString())).size;

  // This week's trades
  const weekTrades = trades.filter(t => new Date(t.date) >= weekStart);
  const weekWins   = weekTrades.filter(t => (t.pnl ?? 0) > 0).length;
  const weekWr     = weekTrades.length > 0 ? (weekWins / weekTrades.length) * 100 : 0;
  const tradingDays = new Set(weekTrades.map(t => new Date(t.date).toDateString())).size;

  // Win streak this week
  const sorted = [...weekTrades].sort((a, b) => new Date(a.date) - new Date(b.date));
  let maxStreak = 0, cur = 0;
  for (const t of sorted) {
    if ((t.pnl ?? 0) > 0) { cur++; if (cur > maxStreak) maxStreak = cur; }
    else cur = 0;
  }

  // ── Adaptive targets ──
  // If you crushed last week's target, bump it up. If you missed, keep it the same.
  const tradeTarget  = lastWeekCount >= 10  ? Math.min(20, lastWeekCount + 5)  : 10;
  const wrTarget     = lastWeekWr    >= 60  ? Math.min(75, Math.round(lastWeekWr) + 5) : 60;
  const streakTarget = maxStreak     >= 3   ? Math.min(7,  maxStreak + 1)       : 3;
  const daysTarget   = lastWeekDays  >= 3   ? Math.min(5,  lastWeekDays + 1)    : 3;

  const daysLeft = 7 - dayOfWeek;

  const CHALLENGES = [
    {
      id:      "log_trades",
      emoji:   "📝",
      title:   `Log ${tradeTarget} Trades`,
      desc:    lastWeekCount >= 10 ? `↑ Bumped up from last week's ${lastWeekCount}` : "Track every trade this week",
      current: weekTrades.length,
      target:  tradeTarget,
      color:   "#38bdf8",
    },
    {
      id:      "win_rate",
      emoji:   "🎯",
      title:   `Hit ${wrTarget}% Win Rate`,
      desc:    lastWeekWr >= 60 ? `↑ You hit ${Math.round(lastWeekWr)}% last week!` : "Stay disciplined and selective",
      current: Math.round(weekWr),
      target:  wrTarget,
      color:   "#34d399",
      suffix:  "%",
      showAs:  `${Math.round(weekWr)}% (${weekWins}W/${weekTrades.length - weekWins}L)`,
    },
    {
      id:      "streak",
      emoji:   "🔥",
      title:   `${streakTarget}-Win Streak`,
      desc:    maxStreak >= 3 ? `↑ You hit ${maxStreak} last week, go higher!` : "Win trades in a row",
      current: maxStreak,
      target:  streakTarget,
      color:   "#f97316",
    },
    {
      id:      "days",
      emoji:   "📅",
      title:   `Trade ${daysTarget} Days`,
      desc:    lastWeekDays >= 3 ? `↑ You traded ${lastWeekDays} days last week` : "Build a daily habit",
      current: tradingDays,
      target:  daysTarget,
      color:   "#a78bfa",
      showAs:  `${tradingDays} day${tradingDays !== 1 ? "s" : ""}`,
    },
  ];

  const completed = CHALLENGES.filter(c => c.current >= c.target).length;
  const isAdaptive = lastWeekCount > 0;

  return (
    <div style={{ borderRadius:16, border:"1px solid #1a2035", overflow:"hidden", background:"#0b1120" }}>
      {/* Header */}
      <div style={{ padding:"14px 16px", borderBottom:"1px solid #111827", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:16 }}>⚡</span>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ fontSize:13, fontWeight:800, color:"#f1f5f9" }}>Weekly Challenges</div>
              {isAdaptive && <span style={{ fontSize:9, padding:"1px 7px", borderRadius:10, background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.2)", color:"#fbbf24", fontWeight:700 }}>ADAPTIVE</span>}
            </div>
            <div style={{ fontSize:10, color:"#475569", marginTop:1 }}>Resets Monday · {daysLeft} day{daysLeft !== 1 ? "s" : ""} left · {isAdaptive ? "Scaled from your last week" : "Complete all 4 to level up"}</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:11, fontWeight:700, color: completed === CHALLENGES.length ? "#34d399" : "#64748b" }}>
            {completed}/{CHALLENGES.length} done
          </span>
          {completed === CHALLENGES.length && (
            <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.25)", color:"#34d399", fontWeight:700 }}>
              🏆 All Complete!
            </span>
          )}
        </div>
      </div>

      {/* Challenges grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:0 }}>
        {CHALLENGES.map((c, idx) => {
          const pct     = Math.min(100, (c.current / c.target) * 100);
          const done    = c.current >= c.target;
          const display = c.showAs ?? String(c.current);
          const isAdaptedUp = c.desc.startsWith("↑");

          return (
            <div key={c.id} style={{
              padding:"14px 16px",
              borderRight: idx % 2 === 0 ? "1px solid #111827" : "none",
              borderBottom: idx < 2 ? "1px solid #111827" : "none",
              background: done ? `${c.color}06` : "transparent",
              position:"relative", overflow:"hidden",
            }}>
              {done && <div style={{ position:"absolute", top:8, right:8, fontSize:16 }}>✅</div>}

              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <span style={{ fontSize:18 }}>{c.emoji}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{ fontSize:12, fontWeight:800, color: done ? c.color : "#e2e8f0" }}>{c.title}</div>
                    {isAdaptedUp && <span style={{ fontSize:8, color:"#fbbf24", fontWeight:700 }}>↑ HARDER</span>}
                  </div>
                  <div style={{ fontSize:10, color: isAdaptedUp ? "#fbbf24" : "#475569", marginTop:1 }}>{c.desc}</div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height:4, borderRadius:2, background:"#1a2035", marginBottom:6, overflow:"hidden" }}>
                <div style={{
                  width:`${pct}%`, height:"100%", borderRadius:2,
                  background: done
                    ? `linear-gradient(90deg,${c.color}aa,${c.color})`
                    : `linear-gradient(90deg,${c.color}55,${c.color}99)`,
                  transition:"width 0.6s ease",
                  boxShadow: done ? `0 0 8px ${c.color}66` : "none",
                }}/>
              </div>

              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontSize:10, fontFamily:"monospace", color: done ? c.color : "#64748b", fontWeight:700 }}>
                  {display} / {c.target}{c.suffix ?? ""}
                </span>
                {pct > 0 && !done && (
                  <span style={{ fontSize:9, color:"#334155" }}>{Math.round(pct)}%</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Adaptive explanation — only show first time */}
      {!isAdaptive && (
        <div style={{ padding:"10px 16px", borderTop:"1px solid #111827", fontSize:10, color:"#334155", lineHeight:1.5 }}>
          💡 Complete all 4 challenges this week — next week the targets will automatically scale based on your performance.
        </div>
      )}
    </div>
  );
}

function DashboardHome({ trades, allTrades, onAddTrade, onOpenImport, activeAccount, onAddStrat, onUpgradeAccount, username, onClearDemo }) {
  const stats   = useMemo(() => computeStats(trades), [trades]);
  const recent  = useMemo(() => [...trades].sort((a,b)=>b.date-a.date).slice(0,5), [trades]);
  const pnlPos  = stats.totalPnl >= 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div><div style={{ fontSize:20, fontWeight:800, color:"#f1f5f9" }}>Dashboard</div><div style={{ fontSize:11, color:"#475569", marginTop:3 }}>Your trading journal & performance hub</div></div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onOpenImport} style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 16px", borderRadius:9, border:"1px solid #1a2035", background:"#111827", color:"#94a3b8", fontSize:12, fontWeight:600, cursor:"pointer" }}><Upload size={13}/> Import</button>
          <button onClick={onAddTrade} style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 18px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#0369a1,#38bdf8)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 16px rgba(56,189,248,0.25)" }}><Plus size={14}/> Log Trade</button>
        </div>
      </div>
      {/* Shortcuts */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <a href="/leaderboard" style={{ textDecoration:"none", borderRadius:12, border:"1px solid rgba(129,140,248,0.25)", background:"rgba(129,140,248,0.05)", padding:"14px 16px", display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}
          onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(129,140,248,0.5)"}
          onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(129,140,248,0.25)"}>
          <div style={{ width:38, height:38, borderRadius:10, background:"rgba(129,140,248,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>🏆</div>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:"#818cf8" }}>Leaderboard</div>
            <div style={{ fontSize:10, color:"#475569", marginTop:2 }}>See top published strategies</div>
          </div>
          <ChevronRight size={14} style={{ color:"#475569", marginLeft:"auto", flexShrink:0 }}/>
        </a>
        <button onClick={onAddStrat} style={{ borderRadius:12, border:"1px solid rgba(129,140,248,0.25)", background:"rgba(129,140,248,0.05)", padding:"14px 16px", display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}
          onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(129,140,248,0.5)"}
          onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(129,140,248,0.25)"}>
          <div style={{ width:38, height:38, borderRadius:10, background:"rgba(129,140,248,0.15)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <FlaskConical size={18} style={{ color:"#818cf8" }}/>
          </div>
          <div style={{ textAlign:"left" }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#818cf8" }}>New Strategy</div>
            <div style={{ fontSize:10, color:"#475569", marginTop:2 }}>Build and backtest a strategy</div>
          </div>
          <ChevronRight size={14} style={{ color:"#475569", marginLeft:"auto", flexShrink:0 }}/>
        </button>
      </div>

      {/* Account stats card */}
      {activeAccount && <AccountStatsCard activeAccount={activeAccount} trades={allTrades ?? trades}/>}

      {trades.length > 0 ? (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:10 }}>
          <StatCard label="Total Trades" value={String(stats.totalTrades)} sub={`${stats.wins}W / ${stats.losses}L`} pos={null} icon={<Activity size={14}/>}/>
          <StatCard label="Win Rate"     value={`${stats.winRate}%`}       sub={`PF ${stats.profitFactor}`}         pos={stats.winRate>=50}   icon={<Zap size={14}/>}/>
          <StatCard label="Total PnL"    value={`${pnlPos?"+":""}${(stats.totalPnl??0).toFixed(2)}`} sub={`Avg W: +${(stats.avgWin??0).toFixed(2)}`} pos={pnlPos} icon={<TrendingUp size={14}/>}/>
          <StatCard label="Best Trade"   value={`+${(stats.bestTrade??0).toFixed(2)}`}  pos={true}  icon={<Award size={14}/>}/>
          <StatCard label="Worst Trade"  value={(stats.worstTrade??0).toFixed(2)}        pos={false} icon={<TrendingDown size={14}/>}/>
        </div>
      ) : (
        <div style={{ padding:"48px 24px", borderRadius:16, border:"2px dashed #1a2035", textAlign:"center" }}>
          <BookOpen size={40} style={{ color:"#334155", marginBottom:16 }}/>
          <div style={{ fontSize:16, fontWeight:700, color:"#475569", marginBottom:8 }}>Start your trading journal</div>
          <div style={{ fontSize:12, color:"#334155", marginBottom:24, lineHeight:1.6 }}>Log trades manually, import from CSV, or connect via webhook.<br/>Nexyru analyzes your performance and gives you actionable insights.</div>
          <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
            <button onClick={onAddTrade} style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 20px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#0369a1,#38bdf8)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}><Plus size={14}/> Log First Trade</button>
            <button onClick={onOpenImport} style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 20px", borderRadius:9, border:"1px solid #1a2035", background:"#111827", color:"#94a3b8", fontSize:12, fontWeight:600, cursor:"pointer" }}><Upload size={13}/> Import CSV</button>
          </div>
        </div>
      )}
      {/* Weekly Challenges — hidden for now */}
      {/* <WeeklyReport trades={trades}/> */}
      {/* <WeeklyChallenges trades={trades}/> */}

      {recent.length > 0 && (
        <div style={{ borderRadius:12, border:"1px solid #1a2035", overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid #111827", fontSize:12, fontWeight:700, color:"#94a3b8" }}>Recent Trades</div>
          {recent.map(t => {
            const w = (t.pnl??0)>=0;
            return (
              <div key={t.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 16px", borderBottom:"1px solid rgba(30,41,59,0.4)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:4, background:t.type==="long"?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)", color:t.type==="long"?"#34d399":"#f87171" }}>{t.type==="long"?"▲":"▼"}</span>
                  <div><div style={{ fontSize:12, fontWeight:700, color:"#e2e8f0" }}>{t.pair}</div><div style={{ fontSize:10, color:"#475569" }}>{t.strategy} · {new Date(t.date).toLocaleDateString()}</div></div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:13, fontWeight:700, fontFamily:"monospace", color:w?"#34d399":"#f87171" }}>{w?"+":""}{(t.pnl??0).toFixed(4)}</div>
                  <div style={{ fontSize:9, color:w?"#34d399":"#f87171", opacity:0.7 }}>{(t.pnlPercent??0)>=0?"+":""}{(t.pnlPercent??0).toFixed(3)}%</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  REUSABLE STRATEGY CARD COMPONENT
// ═══════════════════════════════════════════════════════════════

const STATUS_BADGE_STYLES = {
  backtested: { label:"Backtested", color:"#38bdf8", bg:"rgba(56,189,248,0.1)",  border:"rgba(56,189,248,0.3)"  },
  live:       { label:"Live",       color:"#34d399", bg:"rgba(52,211,153,0.1)",  border:"rgba(52,211,153,0.3)"  },
  verified:   { label:"✓ Verified", color:"#a78bfa", bg:"rgba(167,139,250,0.12)",border:"rgba(167,139,250,0.4)" },
};

function StrategyCard({ name, username, return_pct, win_rate, drawdown, status = "backtested", onView, onClone }) {
  const pos    = return_pct >= 0;
  const badge  = STATUS_BADGE_STYLES[status] ?? STATUS_BADGE_STYLES.backtested;
  const ddHigh = drawdown > 20;
  const wrGood = win_rate >= 50;

  return (
    <div style={{
      background:"#0d1120", borderRadius:12,
      border:"1px solid #1a2035",
      padding:"1.25rem", display:"flex", flexDirection:"column", gap:14,
      transition:"border-color 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor="#263d55"}
      onMouseLeave={e => e.currentTarget.style.borderColor="#1a2035"}
    >
      {/* Header — name + badge */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:15, fontWeight:700, color:"#f1f5f9", marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</div>
          <div style={{ fontSize:11, color:"#475569", fontFamily:"monospace" }}>@{username}</div>
        </div>
        <span style={{ fontSize:9, fontWeight:700, padding:"3px 9px", borderRadius:20, flexShrink:0, background:badge.bg, color:badge.color, border:`1px solid ${badge.border}` }}>
          {badge.label}
        </span>
      </div>

      {/* Return — hero stat */}
      <div>
        <div style={{ fontSize:9, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:5 }}>Return</div>
        <div style={{ fontSize:32, fontWeight:800, fontFamily:"monospace", lineHeight:1, color: pos?"#34d399":"#f87171" }}>
          {pos?"+":""}{return_pct.toFixed(1)}%
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        <div style={{ background:"#111827", borderRadius:8, padding:"10px 12px" }}>
          <div style={{ fontSize:9, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>Win rate</div>
          <div style={{ fontSize:16, fontWeight:700, fontFamily:"monospace", color: wrGood?"#34d399":"#fbbf24" }}>{win_rate.toFixed(0)}%</div>
        </div>
        <div style={{ background:"#111827", borderRadius:8, padding:"10px 12px" }}>
          <div style={{ fontSize:9, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>Max drawdown</div>
          <div style={{ fontSize:16, fontWeight:700, fontFamily:"monospace", color: ddHigh?"#f87171":"#94a3b8" }}>-{drawdown.toFixed(1)}%</div>
        </div>
      </div>

      <hr style={{ border:"none", borderTop:"1px solid #1a2035", margin:0 }}/>

      {/* Actions */}
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={onView} style={{ flex:1, padding:"8px 0", borderRadius:8, border:"1px solid #1e2d3e", background:"#111827", color:"#e2e8f0", fontSize:12, fontWeight:700, cursor:"pointer" }}>
          View
        </button>
        <button onClick={onClone} style={{ flex:1, padding:"8px 0", borderRadius:8, border:"1px solid rgba(129,140,248,0.3)", background:"rgba(129,140,248,0.08)", color:"#818cf8", fontSize:12, fontWeight:700, cursor:"pointer" }}>
          Clone
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  EARNINGS DASHBOARD
// ═══════════════════════════════════════════════════════════════

function EarningsDashboard({ strategies, session }) {
  const [followerCounts, setFollowerCounts] = useState({});  // { stratId: count }
  const [loading,        setLoading]        = useState(true);

  // Load follower counts for all published strategies
  useEffect(() => {
    const published = strategies.filter(s => s.backtests?.length > 0);
    if (!published.length) { setLoading(false); return; }

    Promise.all(
      published.map(s =>
        fetch(`/api/follow?strategy_id=${s.id}`)
          .then(r => r.json())
          .then(d => [s.id, d.count ?? 0])
          .catch(() => [s.id, 0])
      )
    ).then(results => {
      setFollowerCounts(Object.fromEntries(results));
      setLoading(false);
    });
  }, [strategies]);

  // Compute totals
  const totalFollowers    = Object.values(followerCounts).reduce((s, n) => s + n, 0);
  const monthlyEarnings   = strategies.reduce((sum, s) => {
    const count = followerCounts[s.id] ?? 0;
    return sum + count * (s.monthly_price ?? 0);
  }, 0);
  const annualEarnings    = monthlyEarnings * 12;
  const paidStrategies    = strategies.filter(s => (s.monthly_price ?? 0) > 0);
  const freeStrategies    = strategies.filter(s => !(s.monthly_price > 0));

  // Milestone progress
  const MILESTONES = [10, 50, 100, 500, 1000];
  const nextMilestone = MILESTONES.find(m => m > totalFollowers) ?? null;
  const prevMilestone = [...MILESTONES].reverse().find(m => m <= totalFollowers) ?? 0;
  const progress = nextMilestone
    ? Math.min(100, ((totalFollowers - prevMilestone) / (nextMilestone - prevMilestone)) * 100)
    : 100;

  if (!strategies.length) return null;

  const statCard = (label, value, sub, color, icon) => (
    <div style={{ borderRadius:12, border:"1px solid #1a2035", background:"#0d1120", padding:"16px 18px" }}>
      <div style={{ fontSize:10, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6, display:"flex", alignItems:"center", gap:5 }}>
        <span style={{ fontSize:14 }}>{icon}</span>{label}
      </div>
      <div style={{ fontSize:26, fontWeight:800, fontFamily:"monospace", color, lineHeight:1, marginBottom:4 }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:"#475569" }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ borderRadius:14, border:"1px solid rgba(52,211,153,0.2)", background:"linear-gradient(135deg,rgba(13,17,32,0.98),rgba(15,23,20,0.98))", overflow:"hidden" }}>

      {/* Header */}
      <div style={{ padding:"14px 18px", borderBottom:"1px solid rgba(52,211,153,0.1)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:"#34d399", display:"flex", alignItems:"center", gap:7 }}>
            💰 Earnings Dashboard
          </div>
          <div style={{ fontSize:10, color:"#475569", marginTop:2 }}>
            {paidStrategies.length} paid · {freeStrategies.length} free · mock payments
          </div>
        </div>
        <a href="/earnings" style={{ fontSize:11, fontWeight:700, color:"#34d399", padding:"5px 12px", borderRadius:8, border:"1px solid rgba(52,211,153,0.3)", background:"rgba(52,211,153,0.06)", textDecoration:"none", flexShrink:0 }}>
          Full Dashboard →
        </a>
        {monthlyEarnings > 0 && (
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:10, color:"#475569" }}>Est. annual</div>
            <div style={{ fontSize:16, fontWeight:800, fontFamily:"monospace", color:"#34d399" }}>${annualEarnings.toLocaleString()}</div>
          </div>
        )}
      </div>

      <div style={{ padding:"16px 18px", display:"flex", flexDirection:"column", gap:14 }}>

        {/* Stat cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          {statCard("Total Followers", loading ? "…" : String(totalFollowers), `across ${strategies.length} strateg${strategies.length!==1?"ies":"y"}`, "#38bdf8", "👥")}
          {statCard("Monthly Revenue", loading ? "…" : `$${monthlyEarnings.toFixed(0)}`, monthlyEarnings===0?"Set prices to earn":"estimated mock earnings", monthlyEarnings>0?"#34d399":"#475569", "💵")}
          {statCard("Per Follower", paidStrategies.length ? `$${(paidStrategies.reduce((s,p)=>s+(p.monthly_price??0),0)/paidStrategies.length).toFixed(0)}/mo` : "—", paidStrategies.length ? `avg across ${paidStrategies.length} paid strat${paidStrategies.length!==1?"s":""}` : "No paid strategies yet", "#fbbf24", "📊")}
        </div>

        {/* Strategy breakdown */}
        {strategies.some(s => (s.monthly_price ?? 0) > 0 || (followerCounts[s.id] ?? 0) > 0) && (
          <div style={{ borderRadius:10, border:"1px solid #1a2035", background:"#111827", overflow:"hidden" }}>
            <div style={{ fontSize:9, fontWeight:700, color:"#334155", textTransform:"uppercase", letterSpacing:"0.07em", padding:"8px 12px", borderBottom:"1px solid #1a2035" }}>Strategy Breakdown</div>
            {strategies.map(s => {
              const count   = followerCounts[s.id] ?? 0;
              const price   = s.monthly_price ?? 0;
              const revenue = count * price;
              const maxRev  = Math.max(...strategies.map(x => (followerCounts[x.id]??0)*(x.monthly_price??0)), 1);
              return (
                <div key={s.id} style={{ padding:"9px 12px", borderBottom:"1px solid rgba(30,41,59,0.5)", display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#e2e8f0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:3 }}>
                      <div style={{ flex:1, height:4, borderRadius:2, background:"#1a2035", overflow:"hidden" }}>
                        <div style={{ width:`${maxRev>0?(revenue/maxRev)*100:0}%`, height:"100%", background:"linear-gradient(90deg,#0369a1,#34d399)", borderRadius:2, transition:"width 0.5s" }}/>
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:14, flexShrink:0 }}>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:9, color:"#334155" }}>Followers</div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#38bdf8", fontFamily:"monospace" }}>{loading?"…":count}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:9, color:"#334155" }}>Price</div>
                      <div style={{ fontSize:12, fontWeight:700, color: price>0?"#fbbf24":"#334155", fontFamily:"monospace" }}>{price>0?`$${price}/mo`:"Free"}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:9, color:"#334155" }}>Revenue</div>
                      <div style={{ fontSize:12, fontWeight:700, color: revenue>0?"#34d399":"#334155", fontFamily:"monospace" }}>{revenue>0?`$${revenue.toFixed(0)}/mo`:"—"}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Milestone tracker */}
        <div style={{ borderRadius:10, border:"1px solid #1a2035", background:"#111827", padding:"10px 14px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#64748b" }}>
              🎯 Follower Milestone — {totalFollowers} / {nextMilestone ?? "1000+"}
            </div>
            {nextMilestone && (
              <div style={{ fontSize:10, color:"#475569" }}>{nextMilestone - totalFollowers} more to go</div>
            )}
          </div>
          <div style={{ height:6, borderRadius:3, background:"#1a2035", overflow:"hidden" }}>
            <div style={{ width:`${progress}%`, height:"100%", background:"linear-gradient(90deg,#818cf8,#38bdf8)", borderRadius:3, transition:"width 0.6s" }}/>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
            {MILESTONES.map(m => (
              <span key={m} style={{ fontSize:9, color: totalFollowers>=m ? "#38bdf8":"#334155", fontWeight: totalFollowers>=m?700:400 }}>
                {m>=1000?`${m/1000}k`:m}
              </span>
            ))}
          </div>
        </div>

        {/* CTA if no prices set */}
        {monthlyEarnings === 0 && paidStrategies.length === 0 && (
          <div style={{ padding:"10px 14px", borderRadius:9, background:"rgba(251,191,36,0.05)", border:"1px solid rgba(251,191,36,0.15)", fontSize:11, color:"#78716c", lineHeight:1.6, textAlign:"center" }}>
            💡 <strong style={{ color:"#fbbf24" }}>Set a monthly price</strong> on your strategies to start earning. Edit any strategy and set a subscription price — followers pay to copy your signals.
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  STRATEGY LAB

const STRAT_LAB_KEY = (u) => `tradedesk_stratlab_${u}_v1`;

function loadStratLab(username) {
  try { return JSON.parse(localStorage.getItem(STRAT_LAB_KEY(username)) || "[]"); }
  catch { return []; }
}
function saveStratLab(username, strategies) {
  localStorage.setItem(STRAT_LAB_KEY(username), JSON.stringify(strategies));
}

// Condition builder options (reuses backtest condition vocab)
const RULE_CONDITIONS = [
  { id:"rsi_below",         label:"RSI < value",              type:"threshold" },
  { id:"rsi_above",         label:"RSI > value",              type:"threshold" },
  { id:"rsi_cross_up",      label:"RSI crosses up value",     type:"threshold" },
  { id:"rsi_cross_down",    label:"RSI crosses down value",   type:"threshold" },
  { id:"ema9_above_ema21",  label:"EMA 9 crosses above EMA 21", type:"signal" },
  { id:"ema9_below_ema21",  label:"EMA 9 crosses below EMA 21", type:"signal" },
  { id:"macd_cross_up",     label:"MACD crosses above zero",  type:"signal" },
  { id:"macd_cross_down",   label:"MACD crosses below zero",  type:"signal" },
  { id:"price_above_sma50", label:"Price above SMA 50",       type:"signal" },
  { id:"price_below_sma50", label:"Price below SMA 50",       type:"signal" },
  { id:"price_above_sma200",label:"Price above SMA 200",      type:"signal" },
  { id:"price_below_sma200",label:"Price below SMA 200",      type:"signal" },
  { id:"breakout_high",     label:"N-bar high breakout",      type:"bars" },
  { id:"breakdown_low",     label:"N-bar low breakdown",      type:"bars" },
  { id:"consecutive_green", label:"N consecutive green bars", type:"bars" },
  { id:"consecutive_red",   label:"N consecutive red bars",   type:"bars" },
];

const BLANK_STRATEGY = {
  name: "", description: "",
  rules: { entryConds: [], exitConds: [], slPct: 2, tpPct: 4, riskPct: 1 },
};

// ── Strategy Form modal ───────────────────────────────────────
function StrategyFormModal({ initial, onSave, onClose }) {
  const [name,        setName]        = useState(initial?.name              ?? "");
  const [description, setDescription] = useState(initial?.description       ?? "");
  const [entryConds,  setEntryConds]  = useState(initial?.rules?.entryConds ?? []);
  const [exitConds,   setExitConds]   = useState(initial?.rules?.exitConds  ?? []);
  const [slPct,       setSlPct]       = useState(initial?.rules?.slPct      ?? 2);
  const [tpPct,       setTpPct]       = useState(initial?.rules?.tpPct      ?? 4);
  const [riskPct,     setRiskPct]     = useState(initial?.rules?.riskPct    ?? 1);
  const [monthlyPrice,setMonthlyPrice]= useState(initial?.monthly_price     ?? 0);
  const [err,         setErr]         = useState("");
  const [aiPrompt,    setAiPrompt]    = useState("");
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiErr,       setAiErr]       = useState("");

  // Valid condition IDs the AI can use
  const ENTRY_IDS = ["rsi_below","rsi_cross_up","ema9_above_ema21","macd_cross_up","price_above_sma50","price_above_sma200","breakout_high","consecutive_green"];
  const EXIT_IDS  = ["rsi_above","rsi_cross_down","ema9_below_ema21","macd_cross_down","price_below_sma50","price_below_sma200","breakdown_low","consecutive_red"];

  const generateFromAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true); setAiErr("");
    try {
      const res = await fetch("/api/generate-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          entryIds: ENTRY_IDS,
          exitIds:  EXIT_IDS,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? `Error ${res.status}`);

      const s = data.strategy;
      if (s.name)        setName(s.name);
      if (s.description) setDescription(s.description);
      if (s.entryConds?.length) setEntryConds(s.entryConds);
      if (s.exitConds?.length)  setExitConds(s.exitConds);
      if (s.slPct)   setSlPct(s.slPct);
      if (s.tpPct)   setTpPct(s.tpPct);
      if (s.riskPct) setRiskPct(s.riskPct);
      setAiPrompt("");
    } catch (e) {
      setAiErr(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const addCond = (side) => {
    const def = RULE_CONDITIONS[0];
    const setter = side === "entry" ? setEntryConds : setExitConds;
    setter(prev => [...prev, { id: def.id, value: 14 }]);
  };
  const removeCond = (side, idx) => {
    const setter = side === "entry" ? setEntryConds : setExitConds;
    setter(prev => prev.filter((_, i) => i !== idx));
  };
  const setCond = (side, idx, patch) => {
    const setter = side === "entry" ? setEntryConds : setExitConds;
    setter(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  };

  const submit = () => {
    if (!name.trim()) return setErr("Strategy name is required.");
    if (!entryConds.length) return setErr("Add at least one entry condition.");
    if (!exitConds.length)  return setErr("Add at least one exit condition.");
    setErr("");
    onSave({
      id:            initial?.id ?? `strat_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      name:          name.trim(),
      description:   description.trim(),
      rules:         { entryConds, exitConds, slPct, tpPct, riskPct },
      monthly_price: parseFloat(monthlyPrice) || 0,
      createdAt:     initial?.createdAt ?? Date.now(),
      backtests:     initial?.backtests ?? [],
    });
  };

  const inp = { width:"100%", padding:"8px 10px", borderRadius:7, boxSizing:"border-box", background:"#111827", border:"1px solid #1e2d3e", fontSize:12, color:"#e2e8f0", outline:"none" };
  const lbl = { display:"block", fontSize:9, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:5 };

  const CondRow = ({ cond, side, idx }) => {
    const def = RULE_CONDITIONS.find(d => d.id === cond.id);
    return (
      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 10px", borderRadius:7, background:"#111827", border:"1px solid #1e2d3e" }}>
        <select value={cond.id} onChange={e => setCond(side, idx, { id: e.target.value, value: 14 })}
          style={{ flex:1, ...inp, padding:"5px 8px" }}>
          {RULE_CONDITIONS.filter(d => side === "entry"
            ? ["rsi_below","rsi_cross_up","ema9_above_ema21","macd_cross_up","price_above_sma50","price_above_sma200","breakout_high","consecutive_green"].includes(d.id)
            : ["rsi_above","rsi_cross_down","ema9_below_ema21","macd_cross_down","price_below_sma50","price_below_sma200","breakdown_low","consecutive_red"].includes(d.id)
          ).map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
        {(def?.type === "threshold" || def?.type === "bars") && (
          <input type="number" value={cond.value ?? 14}
            onChange={e => setCond(side, idx, { value: parseFloat(e.target.value) || 14 })}
            style={{ ...inp, width:60, padding:"5px 8px", flexShrink:0 }}/>
        )}
        <button onClick={() => removeCond(side, idx)} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", padding:2, flexShrink:0 }}><X size={12}/></button>
      </div>
    );
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:80, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)" }}/>
      <div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:580, maxHeight:"92vh", borderRadius:16, border:"1px solid #1a2035", background:"#0d1120", boxShadow:"0 25px 60px rgba(0,0,0,0.6)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid #1a2035", flexShrink:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#e2e8f0", display:"flex", alignItems:"center", gap:8 }}>
            <FlaskConical size={15} style={{ color:"#818cf8" }}/> {initial ? "Edit Strategy" : "New Strategy"}
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer" }}><X size={16}/></button>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"20px", display:"flex", flexDirection:"column", gap:14 }}>

          {/* ── AI Generator ── */}
          <div style={{ borderRadius:10, border:"1px solid rgba(129,140,248,0.3)", background:"rgba(129,140,248,0.05)", padding:"12px 14px" }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#818cf8", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8, display:"flex", alignItems:"center", gap:5 }}>
              <Sparkles size={11}/> AI Strategy Builder
            </div>
            <div style={{ fontSize:11, color:"#64748b", marginBottom:10, lineHeight:1.5 }}>
              Describe your strategy in plain English — Claude will fill everything in for you.
            </div>
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => { if (e.key==="Enter" && (e.metaKey||e.ctrlKey)) generateFromAI(); }}
              placeholder={'e.g. "Buy when RSI is oversold and price is above the 200 SMA. Exit when RSI becomes overbought. Use 2% stop loss and 5% take profit."'}
              style={{ ...inp, resize:"vertical", minHeight:72, fontFamily:"inherit", lineHeight:1.5, marginBottom:8 }}
            />
            {aiErr && (
              <div style={{ fontSize:10, color:"#f87171", marginBottom:8, display:"flex", alignItems:"center", gap:5 }}>
                <AlertCircle size={11}/>{aiErr}
              </div>
            )}
            <button onClick={generateFromAI} disabled={!aiPrompt.trim() || aiLoading} style={{
              display:"flex", alignItems:"center", gap:6, padding:"8px 16px",
              borderRadius:8, border:"none", fontSize:12, fontWeight:700, cursor: !aiPrompt.trim()||aiLoading ? "not-allowed":"pointer",
              background: !aiPrompt.trim()||aiLoading ? "#1a2035":"linear-gradient(135deg,#4f46e5,#818cf8)",
              color: !aiPrompt.trim()||aiLoading ? "#334155":"#fff",
              boxShadow: !aiPrompt.trim()||aiLoading ? "none":"0 4px 14px rgba(129,140,248,0.35)",
            }}>
              {aiLoading
                ? <><span style={{ display:"inline-block", width:11, height:11, border:"2px solid #334155", borderTopColor:"#818cf8", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/> Generating…</>
                : <><Sparkles size={12}/> Generate Strategy <span style={{ fontSize:10, opacity:0.7 }}>⌘↵</span></>
              }
            </button>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ flex:1, height:1, background:"#1a2035" }}/>
            <span style={{ fontSize:10, color:"#334155" }}>or fill in manually</span>
            <div style={{ flex:1, height:1, background:"#1a2035" }}/>
          </div>
          <div>
            <label style={lbl}>Strategy Name *</label>
            <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. EMA Breakout with RSI Filter"/>
          </div>
          <div>
            <label style={lbl}>Description</label>
            <textarea style={{ ...inp, resize:"vertical", minHeight:60, fontFamily:"inherit", lineHeight:1.5 }}
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Describe when this strategy works and what market conditions it targets..."/>
          </div>

          {/* Entry conditions */}
          <div style={{ borderRadius:10, border:"1px solid rgba(52,211,153,0.2)", background:"rgba(52,211,153,0.03)", padding:"12px 14px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"#34d399" }}>▲ Entry Conditions <span style={{ color:"#475569", fontWeight:400 }}>(ALL must be true)</span></span>
              <button onClick={() => addCond("entry")} style={{ background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.2)", color:"#34d399", borderRadius:6, padding:"2px 10px", fontSize:10, fontWeight:700, cursor:"pointer" }}>+ Add</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {entryConds.map((c,i) => <CondRow key={i} cond={c} side="entry" idx={i}/>)}
              {!entryConds.length && <div style={{ fontSize:10, color:"#334155", fontStyle:"italic", padding:"6px 4px" }}>No entry conditions yet — click + Add</div>}
            </div>
          </div>

          {/* Exit conditions */}
          <div style={{ borderRadius:10, border:"1px solid rgba(239,68,68,0.2)", background:"rgba(239,68,68,0.03)", padding:"12px 14px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"#f87171" }}>▼ Exit Conditions <span style={{ color:"#475569", fontWeight:400 }}>(ANY fires)</span></span>
              <button onClick={() => addCond("exit")} style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", color:"#f87171", borderRadius:6, padding:"2px 10px", fontSize:10, fontWeight:700, cursor:"pointer" }}>+ Add</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {exitConds.map((c,i) => <CondRow key={i} cond={c} side="exit" idx={i}/>)}
              {!exitConds.length && <div style={{ fontSize:10, color:"#334155", fontStyle:"italic", padding:"6px 4px" }}>No exit conditions yet — click + Add</div>}
            </div>
          </div>

          {/* Risk defaults */}
          <div style={{ borderRadius:10, border:"1px solid #1a2035", background:"#111827", padding:"12px 14px" }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10, display:"flex", alignItems:"center", gap:5 }}><Shield size={11}/> Default Risk Settings</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
              <div><label style={lbl}>Risk / Trade %</label><input type="number" style={inp} value={riskPct} min={0.01} max={100} step={0.01} onChange={e => setRiskPct(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); setRiskPct(isNaN(v)||v<=0 ? 0.01 : v); }}/></div>
              <div><label style={lbl}>Stop Loss %</label><input type="number" style={inp} value={slPct} min={0.01} max={50} step={0.01} onChange={e => setSlPct(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); setSlPct(isNaN(v)||v<=0 ? 0.01 : v); }}/></div>
              <div><label style={lbl}>Take Profit %</label><input type="number" style={inp} value={tpPct} min={0.01} max={100} step={0.01} onChange={e => setTpPct(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); setTpPct(isNaN(v)||v<=0 ? 0.01 : v); }}/></div>
            </div>
          </div>

          {/* ── Pricing — set BEFORE publishing ── */}
          {(() => {
            const hasPx = parseFloat(String(monthlyPrice)) > 0;
            return (
              <div style={{ borderRadius:10, border:`1px solid ${hasPx ? "rgba(52,211,153,0.35)" : "rgba(251,191,36,0.3)"}`, background: hasPx ? "rgba(52,211,153,0.04)" : "rgba(251,191,36,0.04)", padding:"12px 14px" }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ color: hasPx ? "#34d399" : "#fbbf24", display:"flex", alignItems:"center", gap:5 }}>
                    💰 Subscription Price <span style={{ fontWeight:400, fontSize:9 }}>— set before publishing</span>
                  </span>
                  {!hasPx && <span style={{ fontSize:9, color:"#fbbf24", background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.2)", padding:"2px 8px", borderRadius:10 }}>⚠ Not set</span>}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ position:"relative", flex:1 }}>
                    <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:14, color:"#475569", fontWeight:700 }}>$</span>
                    <input
                      type="number" min={0} step={1} placeholder="0 = free"
                      style={{ ...inp, paddingLeft:26, fontSize:16, fontWeight:700, fontFamily:"monospace", color: hasPx ? "#34d399" : "#e2e8f0" }}
                      value={monthlyPrice}
                      onChange={e => setMonthlyPrice(e.target.value)}
                      onBlur={e => { const v = parseFloat(e.target.value); setMonthlyPrice(isNaN(v)||v < 0 ? 0 : v); }}
                    />
                  </div>
                  <span style={{ fontSize:12, color:"#475569", flexShrink:0 }}>/month per subscriber</span>
                </div>
                {hasPx ? (
                  <div style={{ marginTop:8, padding:"7px 10px", borderRadius:7, background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.2)", fontSize:11, color:"#34d399", lineHeight:1.6 }}>
                    💰 10 followers = ${(Number(monthlyPrice)*10).toFixed(0)}/mo · 50 = ${(Number(monthlyPrice)*50).toFixed(0)}/mo · 100 = ${(Number(monthlyPrice)*100).toFixed(0)}/mo
                  </div>
                ) : (
                  <div style={{ marginTop:8, fontSize:10, color:"#64748b", lineHeight:1.5 }}>
                    Set to $0 for free — you <strong style={{ color:"#fbbf24" }}>cannot change pricing for existing followers</strong> once they subscribe.
                  </div>
                )}
              </div>
            );
          })()}

          {err && <div style={{ padding:"9px 12px", borderRadius:8, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", fontSize:12, color:"#f87171", display:"flex", alignItems:"center", gap:7 }}><AlertCircle size={12}/>{err}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding:"14px 20px", borderTop:"1px solid #1a2035", display:"flex", gap:10, flexShrink:0 }}>
          <button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid #1e2d3e", background:"transparent", color:"#64748b", fontSize:12, fontWeight:600, cursor:"pointer" }}>Cancel</button>
          <button onClick={submit} style={{ flex:2, padding:"10px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#4f46e5,#818cf8)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 16px rgba(129,140,248,0.3)" }}>
            {initial ? "Save Changes" : "Create Strategy"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Strategy Lab main page ────────────────────────────────────
function StrategyLabPage({ session, trades }) {
  const [strategies, setStrategies] = useState(() => loadStratLab(session.username));
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [running,    setRunning]    = useState(null);
  const [expanded,   setExpanded]   = useState(null);
  const [publishing, setPublishing] = useState(null);
  const [pubError,   setPubError]   = useState({});
  const [pubDone,    setPubDone]    = useState({});
  const [goingLive,    setGoingLive]    = useState(null);
  const [liveError,    setLiveError]    = useState({});
  const [liveDone,     setLiveDone]     = useState({});
  const [makingPrivate,setMakingPrivate]= useState(null);
  const [privateDone,  setPrivateDone]  = useState({});
  const [justCloned,   setJustCloned]   = useState(null);  // id of newly cloned card

  // ── Clone — instant duplicate, auto-open editor ───────────
  const cloneStrategy = (source) => {
    const clone = {
      ...source,
      id:            `strat_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      name:          `${source.name} (copy)`,
      backtests:     [],
      monthly_price: source.monthly_price ?? 0,
      createdAt:     Date.now(),
    };
    const next = [...strategies, clone];
    persist(next);
    setJustCloned(clone.id);
    setExpanded(clone.id);
    // Auto-open editor after brief flash so user sees the new card
    setTimeout(() => {
      setEditing(clone);
      setShowForm(true);
      setJustCloned(null);
    }, 600);
  };

  // ── Make Private — delete from Supabase ───────────────────
  const makePrivate = async (strategy) => {
    if (!window.confirm("Remove this strategy from the public leaderboard?")) return;
    const supabaseId = typeof pubDone[strategy.id] === "string" ? pubDone[strategy.id] : null;
    if (!supabaseId) {
      // No Supabase ID stored — just clear local pub state
      setPubDone(prev => { const n={...prev}; delete n[strategy.id]; return n; });
      return;
    }
    setMakingPrivate(strategy.id);
    try {
      const res = await fetch(`/api/publish-strategy?id=${supabaseId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 404) throw new Error(data.error ?? `Error ${res.status}`);
      // Clear local publish state so the Publish button reappears
      setPubDone(prev  => { const n={...prev}; delete n[strategy.id]; return n; });
      setLiveDone(prev => { const n={...prev}; delete n[strategy.id]; return n; });
      setPrivateDone(prev => ({ ...prev, [strategy.id]: true }));
      setTimeout(() => setPrivateDone(prev => { const n={...prev}; delete n[strategy.id]; return n; }), 3000);
    } catch(e) {
      alert("Failed to remove: " + e.message);
    } finally {
      setMakingPrivate(null);
    }
  };

  // ── Go Live — update status in Supabase ───────────────────
  const goLive = async (strategy) => {
    if (!pubDone[strategy.id]) {
      alert("Publish the strategy to the leaderboard first, then you can go live.");
      return;
    }
    setGoingLive(strategy.id);
    setLiveError(prev => ({ ...prev, [strategy.id]: null }));
    try {
      // Find the Supabase strategy id from the last publish response
      // We stored it in pubDone as { strategyId: supabaseId }
      const supabaseId = typeof pubDone[strategy.id] === "string"
        ? pubDone[strategy.id]
        : null;

      if (!supabaseId) {
        throw new Error("Strategy not yet published. Click Publish first.");
      }

      const res = await fetch("/api/strategy-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy_id: supabaseId, status: "live" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? `Error ${res.status}`);
      setLiveDone(prev => ({ ...prev, [strategy.id]: true }));
    } catch (e) {
      setLiveError(prev => ({ ...prev, [strategy.id]: e.message }));
    } finally {
      setGoingLive(null);
    }
  };

  const persist = (next) => { saveStratLab(session.username, next); setStrategies(next); };

  // ── Publish latest backtest result to Supabase ─────────────
  const publishResult = async (strategy) => {
    const bt = strategy.backtests?.[0];
    if (!bt) return;

    // ── Verification check ────────────────────────────────
    const isVerified = bt.trades_count > 20 && bt.return_pct > 0;
    const status     = isVerified ? "verified" : "backtested";

    setPublishing(strategy.id);
    setPubError(prev => ({ ...prev, [strategy.id]: null }));
    setPubDone(prev  => ({ ...prev, [strategy.id]: false }));

    try {
      let authHeader = "";
      try {
        const { supabase } = await import("@/lib/supabase-client");
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
          authHeader = `Bearer ${data.session.access_token}`;
        }
      } catch {}

      const res = await fetch("/api/publish-strategy", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          user_id:       session.username,
          status,
          monthly_price: strategy.monthly_price ?? 0,
          strategy: {
            name:        strategy.name,
            description: strategy.description,
            rules:       strategy.rules,
          },
          backtest: {
            win_rate:     bt.win_rate,
            return_pct:   bt.return_pct,
            max_drawdown: bt.max_drawdown,
            trades_count: bt.trades_count,
            profit_factor:bt.profit_factor,
            equity_curve: bt.equity_curve ?? [],
          },
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error ?? `Server error ${res.status}`);
      }

      setPubDone(prev => ({ ...prev, [strategy.id]: data.strategy_id ?? true }));

      // Show verified toast if applicable
      if (isVerified) {
        setPubError(prev => ({ ...prev, [`${strategy.id}_verified`]: "✓ Verified" }));
        setTimeout(() => setPubError(prev => { const n={...prev}; delete n[`${strategy.id}_verified`]; return n; }), 4000);
      }

      setTimeout(() => { window.location.href = "/leaderboard"; }, 1400);

    } catch (e) {
      setPubError(prev => ({ ...prev, [strategy.id]: e.message }));
    } finally {
      setPublishing(null);
    }
  };

  const saveStrategy = (s) => {
    const exists = strategies.find(x => x.id === s.id);
    persist(exists ? strategies.map(x => x.id === s.id ? s : x) : [...strategies, s]);
    setShowForm(false); setEditing(null);
  };

  const deleteStrategy = (id) => {
    if (!window.confirm("Delete this strategy?")) return;
    persist(strategies.filter(s => s.id !== id));
  };

  // ── Symbol / timeframe picker for Strategy Lab backtests ──
  const [labSymbol,   setLabSymbol]   = useState("BTC-USD");
  const [labTf,       setLabTf]       = useState("1h");
  const [dataSource,  setDataSource]  = useState("live"); // "live" | "sim"
  const [fetchStatus, setFetchStatus] = useState("");     // per-run status

  // ── Run backtest with real Coinbase data ─────────────────
  const runBacktest = async (strategy) => {
    setRunning(strategy.id);
    setFetchStatus("fetching");
    await new Promise(r => setTimeout(r, 40));

    const compiled = compileCustomStrategy(
      strategy.rules.entryConds,
      strategy.rules.exitConds,
    );

    let candles;
    let dataLabel = "sim";

    if (dataSource === "live") {
      try {
        const resp = await fetchBtCandles(labSymbol, labTf);
        candles   = resp.candles;
        dataLabel = resp.source === "live" || resp.source === "cached" ? "live" : "sim";
        setFetchStatus(`live:${candles.length}`);
      } catch (err) {
        console.warn("Live fetch failed, using sim:", err.message);
        const sym = BT_SYMBOLS.find(s => s.id === labSymbol);
        candles   = genBacktestCandles(730, sym?.base ?? 97000);
        dataLabel = "sim";
        setFetchStatus("fallback");
      }
    } else {
      const sym = BT_SYMBOLS.find(s => s.id === labSymbol);
      candles   = genBacktestCandles(730, sym?.base ?? 97000);
      dataLabel = "sim";
      setFetchStatus("sim");
    }

    const result = runBacktestV2({
      candles,
      strategy:       compiled,
      initialBalance: 10000,
      riskPct:        strategy.rules.riskPct ?? 1,
      slPct:          strategy.rules.slPct   ?? 2,
      tpPct:          strategy.rules.tpPct   ?? 4,
      maxHoldBars:    100,
    });

    if (result?.metrics) {
      const bt = {
        id:           `bt_${Date.now()}`,
        runAt:        Date.now(),
        symbol:       labSymbol,
        tf:           labTf,
        dataSource:   dataLabel,
        win_rate:     result.metrics.winRate,
        return_pct:   result.metrics.returnPct,
        max_drawdown: result.metrics.maxDrawdown,
        trades_count: result.metrics.totalTrades,
        profit_factor:result.metrics.profitFactor,
        equity_curve: result.equity,
      };
      const updated = strategies.map(s => s.id === strategy.id
        ? { ...s, backtests: [bt, ...(s.backtests ?? [])].slice(0, 10) }
        : s
      );
      persist(updated);
      setExpanded(strategy.id);
    } else {
      alert("No trades generated on this data.\n\nTips:\n• Try a single condition (e.g. RSI < 30 only)\n• Use 1h or 4h timeframe for more signal frequency\n• Widen RSI thresholds (e.g. RSI < 40 instead of 30)\n• EMA9 > EMA21 and Price > SMA200 work well together on daily charts");
    }
    setRunning(null);
    setTimeout(() => setFetchStatus(""), 3000);
  };

  // Match real trades to this strategy
  const matchedTrades = (strategy) =>
    trades.filter(t => t.strategy?.toLowerCase() === strategy.name.toLowerCase());

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {showForm && (
        <StrategyFormModal
          initial={editing}
          onSave={saveStrategy}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800, color:"#f1f5f9", display:"flex", alignItems:"center", gap:10 }}>
            <FlaskConical size={20} style={{ color:"#818cf8" }}/> Strategy Lab
          </div>
          <div style={{ fontSize:11, color:"#475569", marginTop:3 }}>
            Build, document, and backtest your trading strategies
          </div>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 18px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#4f46e5,#818cf8)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 16px rgba(129,140,248,0.3)" }}>
          <Plus size={14}/> New Strategy
        </button>
      </div>

      {/* Empty state */}
      {!strategies.length && (
        <div style={{ padding:"60px 24px", textAlign:"center", borderRadius:14, border:"2px dashed #1a2035" }}>
          <FlaskConical size={40} style={{ color:"#334155", marginBottom:16 }}/>
          <div style={{ fontSize:15, fontWeight:700, color:"#475569", marginBottom:8 }}>No strategies yet</div>
          <div style={{ fontSize:12, color:"#334155", marginBottom:24, lineHeight:1.6 }}>
            Create a strategy by defining entry and exit conditions.<br/>Then run a backtest to see simulated performance.
          </div>
          <button onClick={() => setShowForm(true)} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"10px 22px", borderRadius:9, border:"none", background:"linear-gradient(135deg,#4f46e5,#818cf8)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            <Plus size={14}/> Create First Strategy
          </button>
        </div>
      )}

      {/* ── Backtest settings bar ── */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:10, border:"1px solid #1a2035", background:"#0d1120", flexWrap:"wrap" }}>
        <div style={{ fontSize:10, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.07em", flexShrink:0 }}>Backtest on:</div>

        {/* Symbol picker — grouped */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
          <span style={{ fontSize:9, color:"#334155", fontWeight:700, alignSelf:"center", marginRight:2 }}>Crypto:</span>
          {BT_SYMBOLS.filter(s => s.source==="coinbase").map(s => (
            <button key={s.id} onClick={() => setLabSymbol(s.id)} style={{ padding:"3px 9px", borderRadius:6, border:`1px solid ${labSymbol===s.id?"rgba(56,189,248,0.5)":"#1a2035"}`, background:labSymbol===s.id?"rgba(56,189,248,0.1)":"transparent", color:labSymbol===s.id?"#38bdf8":"#475569", fontSize:10, fontWeight:700, cursor:"pointer" }}>
              {s.label}
            </button>
          ))}
          <span style={{ fontSize:9, color:"#334155", fontWeight:700, alignSelf:"center", marginLeft:4, marginRight:2 }}>Futures:</span>
          {BT_SYMBOLS.filter(s => s.source==="yahoo").map(s => (
            <button key={s.id} onClick={() => setLabSymbol(s.id)} style={{ padding:"3px 9px", borderRadius:6, border:`1px solid ${labSymbol===s.id?"rgba(251,191,36,0.5)":"#1a2035"}`, background:labSymbol===s.id?"rgba(251,191,36,0.08)":"transparent", color:labSymbol===s.id?"#fbbf24":"#475569", fontSize:10, fontWeight:700, cursor:"pointer" }}>
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ width:1, height:18, background:"#1a2035", flexShrink:0 }}/>

        {/* Timeframe picker */}
        <div style={{ display:"flex", gap:3 }}>
          {BT_TIMEFRAMES.map(t => (
            <button key={t.id} onClick={() => setLabTf(t.id)} style={{ padding:"3px 8px", borderRadius:5, border:"none", background:labTf===t.id?"#1e3a52":"transparent", color:labTf===t.id?"#38bdf8":"#475569", fontSize:10, fontWeight:700, cursor:"pointer" }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ width:1, height:18, background:"#1a2035", flexShrink:0 }}/>

        {/* Data source toggle */}
        <div style={{ display:"flex", gap:3 }}>
          {[["live","📡 Live"],["sim","🔬 Sim"]].map(([id, label]) => (
            <button key={id} onClick={() => setDataSource(id)} style={{ padding:"3px 9px", borderRadius:6, border:"none", background:dataSource===id?"rgba(56,189,248,0.12)":"transparent", color:dataSource===id?"#38bdf8":"#475569", fontSize:10, fontWeight:700, cursor:"pointer" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Fetch status */}
        {fetchStatus && (
          <div style={{ marginLeft:"auto", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", gap:5, flexShrink:0,
            color: fetchStatus.startsWith("live")?"#34d399":fetchStatus==="fallback"?"#fbbf24":fetchStatus==="fetching"?"#38bdf8":"#64748b"
          }}>
            {fetchStatus==="fetching" && <span style={{ display:"inline-block", width:9, height:9, border:"1.5px solid #1a2035", borderTopColor:"#38bdf8", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>}
            {fetchStatus.startsWith("live") && `✓ ${parseInt(fetchStatus.split(":")[1]).toLocaleString()} real candles`}
            {fetchStatus==="sim"      && "🔬 Simulated"}
            {fetchStatus==="fallback" && "⚠ API unavailable — used sim"}
            {fetchStatus==="fetching" && "Fetching data…"}
          </div>
        )}
      </div>

      {/* Strategy cards */}
      {strategies.map(s => {
        const isExpanded  = expanded === s.id;
        const isRunning   = running  === s.id;
        const latestBt    = s.backtests?.[0];
        const matched     = matchedTrades(s);
        const realStats   = matched.length ? computeStats(matched) : null;

        return (
          <div key={s.id} style={{
            borderRadius:14,
            border:`1px solid ${justCloned===s.id ? "rgba(52,211,153,0.6)" : isExpanded?"rgba(129,140,248,0.35)":"#1a2035"}`,
            background: justCloned===s.id ? "rgba(52,211,153,0.06)" : "#0d1120",
            overflow:"hidden",
            transition:"all 0.3s",
            boxShadow: justCloned===s.id ? "0 0 24px rgba(52,211,153,0.15)" : "none",
          }}>

            {/* ── Reusable StrategyCard ── */}
            <StrategyCard
              name={s.name}
              username={session.username}
              return_pct={latestBt?.return_pct ?? 0}
              win_rate={latestBt?.win_rate ?? 0}
              drawdown={latestBt?.max_drawdown ?? 0}
              status={
                liveDone[s.id]                                              ? "live"
                : latestBt && latestBt.trades_count > 20 && latestBt.return_pct > 0 ? "verified"
                : latestBt                                                  ? "backtested"
                : "backtested"
              }
              onView={() => setExpanded(e => e===s.id ? null : s.id)}
              onClone={() => cloneStrategy(s)}
            />

            {/* Extra controls row below the card */}
            <div style={{ padding:"0 18px 14px", display:"flex", alignItems:"center", gap:8 }}>
              {/* Condition pills */}
              <div style={{ flex:1, display:"flex", flexWrap:"wrap", gap:4 }}>
                {(s.rules?.entryConds ?? []).map((c,i) => {
                  const def = RULE_CONDITIONS.find(d => d.id === c.id);
                  return <span key={i} style={{ fontSize:9, padding:"2px 7px", borderRadius:10, background:"rgba(52,211,153,0.08)", color:"#34d399", border:"1px solid rgba(52,211,153,0.2)" }}>▲ {def?.label}{c.value!=null?" "+c.value:""}</span>;
                })}
                {(s.rules?.exitConds ?? []).map((c,i) => {
                  const def = RULE_CONDITIONS.find(d => d.id === c.id);
                  return <span key={i} style={{ fontSize:9, padding:"2px 7px", borderRadius:10, background:"rgba(239,68,68,0.08)", color:"#f87171", border:"1px solid rgba(239,68,68,0.2)" }}>▼ {def?.label}{c.value!=null?" "+c.value:""}</span>;
                })}
              </div>
              {/* Action buttons */}
              <button onClick={() => runBacktest(s)} disabled={isRunning} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:7, border:"none", background:isRunning?"#1a2035":"linear-gradient(135deg,#0369a1,#38bdf8)", color:isRunning?"#334155":"#fff", fontSize:10, fontWeight:700, cursor:isRunning?"not-allowed":"pointer", flexShrink:0 }}>
                {isRunning ? <><span style={{ display:"inline-block", width:10, height:10, border:"2px solid #334155", borderTopColor:"#38bdf8", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/> Running…</> : <><Play size={10}/> Backtest</>}
              </button>
              {s.backtests?.length > 0 && (
                pubDone[s.id]
                  ? (
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:"#34d399", display:"flex", alignItems:"center", gap:4 }}><Check size={11}/> Published</span>
                      {privateDone[s.id]
                        ? <span style={{ fontSize:10, color:"#475569" }}>Removed</span>
                        : <button onClick={() => makePrivate(s)} disabled={makingPrivate===s.id} title="Remove from leaderboard" style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 9px", borderRadius:6, border:"1px solid rgba(239,68,68,0.3)", background:"rgba(239,68,68,0.07)", color:"#f87171", fontSize:10, fontWeight:700, cursor:makingPrivate===s.id?"not-allowed":"pointer" }}>
                            {makingPrivate===s.id ? <span style={{ display:"inline-block", width:9, height:9, border:"1.5px solid #334155", borderTopColor:"#f87171", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/> : <><EyeOff size={10}/> Make Private</>}
                          </button>
                      }
                    </div>
                  )
                  : (() => {
                      const hasPx  = (s.monthly_price ?? 0) > 0;
                      const btnBorder = hasPx ? "1px solid rgba(129,140,248,0.35)" : "1px solid rgba(251,191,36,0.35)";
                      const btnBg     = hasPx ? "rgba(129,140,248,0.08)" : "rgba(251,191,36,0.06)";
                      const btnColor  = hasPx ? "#818cf8" : "#fbbf24";
                      const btnLabel  = hasPx ? `Publish ($${s.monthly_price}/mo)` : "Publish (free)";
                      return (
                        <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}>
                          {!hasPx && (
                            <div style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 8px", borderRadius:6, background:"rgba(251,191,36,0.08)", border:"1px solid rgba(251,191,36,0.25)" }}>
                              <span style={{ fontSize:9, color:"#fbbf24", fontWeight:700 }}>⚠ No price set</span>
                              <button onClick={() => { setEditing(s); setShowForm(true); }} style={{ fontSize:9, color:"#fbbf24", background:"none", border:"none", cursor:"pointer", padding:0, textDecoration:"underline", fontWeight:700 }}>Set price first</button>
                            </div>
                          )}
                          <button
                            onClick={() => {
                              if (!hasPx) {
                                if (!window.confirm("⚠️ No price set — this strategy will be free forever.\n\nYou cannot charge existing followers later.\n\nPublish as free?")) return;
                              }
                              publishResult(s);
                            }}
                            disabled={publishing===s.id}
                            style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:7, border:btnBorder, background:btnBg, color:btnColor, fontSize:10, fontWeight:700, cursor:publishing===s.id?"not-allowed":"pointer" }}>
                            {publishing===s.id
                              ? <span style={{ display:"inline-block", width:10, height:10, border:"2px solid #334155", borderTopColor:"#818cf8", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
                              : <><Globe size={10}/> {btnLabel}</>
                            }
                          </button>
                        </div>
                      );
                    })()
              )}
              {/* Go Live — only available after publishing */}
              {pubDone[s.id] && (
                liveDone[s.id]
                  ? <span style={{ fontSize:10, fontWeight:700, color:"#34d399", display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>🟢 Live</span>
                  : <button onClick={() => goLive(s)} disabled={goingLive===s.id} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:7, border:"1px solid rgba(52,211,153,0.35)", background:"rgba(52,211,153,0.08)", color:"#34d399", fontSize:10, fontWeight:700, cursor:goingLive===s.id?"not-allowed":"pointer", flexShrink:0 }}>
                      {goingLive===s.id ? <span style={{ display:"inline-block", width:10, height:10, border:"2px solid #334155", borderTopColor:"#34d399", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/> : <>🟢 Go Live</>}
                    </button>
              )}
              {liveError[s.id] && <span style={{ fontSize:9, color:"#f87171", flexShrink:0 }}>{liveError[s.id]}</span>}
              <button onClick={() => { setEditing(s); setShowForm(true); }} style={{ padding:"5px 8px", borderRadius:7, border:"1px solid #1e2d3e", background:"transparent", color:"#475569", cursor:"pointer", flexShrink:0 }}><Edit2 size={11}/></button>
              <button onClick={() => deleteStrategy(s.id)} style={{ padding:"5px 8px", borderRadius:7, border:"1px solid rgba(239,68,68,0.2)", background:"transparent", color:"#f87171", cursor:"pointer", flexShrink:0 }}><Trash size={11}/></button>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div style={{ borderTop:"1px solid #1a2035" }}>

                {/* Real trade stats if trades match */}
                {realStats && (
                  <div style={{ padding:"14px 18px", borderBottom:"1px solid #1a2035" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>📊 Real Trade Performance ({matched.length} trades logged as "{s.name}")</div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
                      {[
                        { label:"Win Rate",     val:`${realStats.winRate}%`,                                          color:realStats.winRate>=50?"#34d399":"#fbbf24" },
                        { label:"Total PnL",    val:`${realStats.totalPnl>=0?"+":""}${realStats.totalPnl.toFixed(2)}`, color:realStats.totalPnl>=0?"#34d399":"#f87171" },
                        { label:"Profit Factor",val:String(realStats.profitFactor),                                   color:realStats.profitFactor>=1.5?"#34d399":"#fbbf24" },
                        { label:"Avg Win",      val:`+${realStats.avgWin.toFixed(2)}`,                               color:"#34d399" },
                        { label:"Avg Loss",     val:`-${realStats.avgLoss.toFixed(2)}`,                              color:"#f87171" },
                      ].map(({ label, val, color }) => (
                        <div key={label} style={{ textAlign:"center", padding:"8px", borderRadius:8, background:"#111827" }}>
                          <div style={{ fontSize:8, color:"#334155", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{label}</div>
                          <div style={{ fontSize:13, fontWeight:700, fontFamily:"monospace", color }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Backtest history */}
                {s.backtests?.length > 0 && (
                  <div style={{ padding:"14px 18px" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>🔬 Backtest History</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {s.backtests.map((bt, i) => {
                        const btPos = bt.return_pct >= 0;
                        const lineC = btPos ? "#10b981" : "#ef4444";
                        return (
                          <div key={bt.id} style={{ borderRadius:9, border:`1px solid ${i===0?"rgba(129,140,248,0.25)":"#1a2035"}`, background:i===0?"rgba(129,140,248,0.04)":"#111827", padding:"10px 14px" }}>
                            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom: i===0&&bt.equity_curve?.length>1?10:0 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                {i===0 && <span style={{ fontSize:9, fontWeight:700, color:"#818cf8", background:"rgba(129,140,248,0.12)", padding:"1px 6px", borderRadius:8 }}>Latest</span>}
                                <span style={{ fontSize:10, color:"#475569" }}>{new Date(bt.runAt).toLocaleString()}</span>
                                {bt.symbol && <span style={{ fontSize:9, color:"#334155", fontFamily:"monospace" }}>{bt.symbol} {bt.tf}</span>}
                                {bt.dataSource === "live"
                                  ? <span style={{ fontSize:9, color:"#34d399" }}>📡 Real</span>
                                  : <span style={{ fontSize:9, color:"#475569" }}>🔬 Sim</span>
                                }
                              </div>
                              <div style={{ display:"flex", gap:12 }}>
                                {[
                                  { label:"Return",  val:`${btPos?"+":""}${bt.return_pct?.toFixed(1)}%`,    color:btPos?"#34d399":"#f87171" },
                                  { label:"Win Rate",val:`${bt.win_rate?.toFixed(0)}%`,                    color:bt.win_rate>=50?"#34d399":"#fbbf24" },
                                  { label:"PF",      val:bt.profit_factor===999?"∞":bt.profit_factor?.toFixed(2), color:bt.profit_factor>=1.5?"#34d399":"#fbbf24" },
                                  { label:"Max DD",  val:`-${bt.max_drawdown?.toFixed(1)}%`,               color:bt.max_drawdown>20?"#f87171":"#94a3b8" },
                                  { label:"Trades",  val:String(bt.trades_count),                          color:"#94a3b8" },
                                ].map(({ label, val, color }) => (
                                  <div key={label} style={{ textAlign:"right" }}>
                                    <div style={{ fontSize:8, color:"#334155", textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
                                    <div style={{ fontSize:12, fontWeight:700, fontFamily:"monospace", color }}>{val}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {/* Mini equity curve for latest run */}
                            {i===0 && bt.equity_curve?.length > 1 && (
                              <ResponsiveContainer width="100%" height={60}>
                                <AreaChart data={bt.equity_curve} margin={{ top:2,right:2,left:-40,bottom:0 }}>
                                  <defs><linearGradient id={`slGrad_${bt.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={lineC} stopOpacity={0.25}/><stop offset="95%" stopColor={lineC} stopOpacity={0}/></linearGradient></defs>
                                  <Area type="monotone" dataKey="balance" stroke={lineC} strokeWidth={1.5} fill={`url(#slGrad_${bt.id})`} dot={false}/>
                                  <Tooltip contentStyle={{ background:"#0d1120", border:"1px solid #1e2d3e", borderRadius:6, fontSize:9 }} formatter={v=>[`$${v.toFixed(0)}`,"Balance"]} itemStyle={{ color:lineC }}/>
                                </AreaChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!realStats && !s.backtests?.length && (
                  <div style={{ padding:"20px 18px", textAlign:"center", fontSize:11, color:"#334155" }}>
                    No backtest runs yet — click <strong style={{ color:"#38bdf8" }}>Backtest</strong> to simulate this strategy
                  </div>
                )}

                {/* Publish Result */}
                {s.backtests?.length > 0 && (
                  <div style={{ padding:"14px 18px", borderTop:"1px solid #1a2035", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
                    <div style={{ fontSize:11, color:"#475569", lineHeight:1.5 }}>
                      Publish your latest backtest result to the leaderboard so other traders can see your strategy.
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, flexShrink:0 }}>
                      {pubDone[s.id] ? (
                        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:700, color:"#34d399" }}>
                          <Check size={14}/> Published! Redirecting…
                        </div>
                      ) : (
                        <button
                          onClick={() => publishResult(s)}
                          disabled={publishing === s.id}
                          style={{
                            display:"flex", alignItems:"center", gap:6,
                            padding:"8px 18px", borderRadius:9, border:"none",
                            background: publishing===s.id ? "#1a2035" : "linear-gradient(135deg,#4f46e5,#818cf8)",
                            color: publishing===s.id ? "#334155" : "#fff",
                            fontSize:12, fontWeight:700,
                            cursor: publishing===s.id ? "not-allowed" : "pointer",
                            boxShadow: publishing===s.id ? "none" : "0 4px 16px rgba(129,140,248,0.3)",
                          }}
                        >
                          {publishing === s.id
                            ? <><span style={{ display:"inline-block", width:11, height:11, border:"2px solid #334155", borderTopColor:"#818cf8", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/> Publishing…</>
                            : <><Globe size={13}/> Publish Result</>
                          }
                        </button>
                      )}
                      {pubError[s.id] && (
                        <div style={{ fontSize:10, color:"#f87171", display:"flex", alignItems:"center", gap:5 }}>
                          <AlertCircle size={11}/>{pubError[s.id]}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN TRADING DASHBOARD
// ═══════════════════════════════════════════════════════════════

function TradingDashboard({ session, onLogout }) {
  const [tab,           setTab]           = useState("dashboard");
  const [trades,        setTrades]        = useState([]);
  const [showForm,      setShowForm]      = useState(false);
  const [showCSV,       setShowCSV]       = useState(false);
  const [showHub,       setShowHub]       = useState(false);
  const [showAddAcct,   setShowAddAcct]   = useState(false);
  const [showShot,      setShowShot]      = useState(false);
  const [showAccountSetup, setShowAccountSetup] = useState(false);
  const [shareModalTrade, setShareModalTrade] = useState(null);
  const [editTrade,     setEditTrade]     = useState(null);

  const copyTrading  = useCopyTrading(session.username);
  const paperAccts   = usePaperAccounts(session.username);

  useEffect(()=>{ const h=()=>setShareModalTrade(window.__pendingShare||null); window.addEventListener('nexyruShare',h); return()=>window.removeEventListener('nexyruShare',h); },[]);

  // Seed demo data AFTER accounts are initialized
  useEffect(() => {
    const needsSeed = localStorage.getItem(`nexyru_needs_seed_${session.username}`);
    if (!needsSeed) return;
    const accts = loadPaperAccounts(session.username);
    if (!accts || accts.length === 0) return;
    // Always seed to paper account
    const paperAcct = accts.find(a => a.type === "paper") ?? accts[0];
    localStorage.removeItem(`nexyru_needs_seed_${session.username}`);
    const trades = generateStarterData(session.username).map(t => ({ ...t, accountId: paperAcct.id }));
    saveUserTrades(session.username, trades);
    setDemoMode(session.username, true);
    setTrades(trades);
  }, [session.username, paperAccts.accounts]);

  // Handle ?tab=stratlab&clone=1 from leaderboard redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam) setTab(tabParam);

    if (params.get("clone") === "1") {
      const raw = sessionStorage.getItem("tradedesk_clone_strategy");
      if (raw) {
        try {
          const clone = JSON.parse(raw);
          sessionStorage.removeItem("tradedesk_clone_strategy");
          // Add to Strategy Lab localStorage
          const existing = loadStratLab(session.username);
          saveStratLab(session.username, [...existing, clone]);
          // Clean URL without reload
          window.history.replaceState({}, "", "/dashboard?tab=stratlab");
        } catch {}
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load trades on mount — rehydrate screenshots from IDB
  useEffect(() => {
    const saved = loadUserTrades(session.username);
    if (!saved) {
      setTrades([]);
      saveUserTrades(session.username, []);
      return;
    }
    setTrades(saved);
    // Rehydrate screenshots in the background
    Promise.all(saved.map(rehydrateScreenshot)).then(hydrated => {
      setTrades(hydrated);
    });
  }, [session.username]);

  // Persist on change + sync account balances
  useEffect(() => {
    saveUserTrades(session.username, trades);
    paperAccts.syncBalance(trades);
  }, [trades, session.username]); // eslint-disable-line react-hooks/exhaustive-deps

  // Consume incoming copied trades
  useEffect(() => {
    if (!copyTrading.pendingCopies.length) return;
    const copies = copyTrading.pendingCopies.map(copy => ({
      id:    `copy_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      pair:  copy.pair ?? copy.symbol ?? "UNKNOWN",
      symbol: (copy.pair ?? copy.symbol ?? "UNKNOWN").replace("/",""),
      type:  copy.type, entryPrice: copy.entryPrice, exitPrice: copy.exitPrice,
      stopLoss: copy.stopLoss, takeProfit: copy.takeProfit,
      size: copy.size, date: Date.now(),
      strategy: copy.strategy ?? "Copy Trade",
      tags: ["Copy Trade"],
      notes: `Copied from @${copy.copiedFrom}${copy.multiplier?` (${copy.multiplier}x)`:""}`,
      screenshot: null, confidence: 3, source: "copy",
      copiedFrom: copy.copiedFrom, multiplier: copy.multiplier,
      accountId: paperAccts.activeAccount?.id ?? null,
      pnl: copy.pnl ?? 0, pnlPercent: copy.pnlPercent ?? 0,
    }));
    setTrades(prev => [...prev, ...copies]);
  }, [copyTrading.pendingCopies]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveTrade = useCallback((rawTrade) => {
    // Route through executeTrade to tag with accountId and handle type
    const trade = executeTrade(
      { ...rawTrade, accountId: rawTrade.accountId ?? paperAccts.activeAccount?.id ?? null },
      paperAccts.activeAccount ?? { type: "paper", id: null }
    );
    setTrades(prev => {
      const exists = prev.find(t => t.id === trade.id);
      const next   = exists ? prev.map(t => t.id===trade.id ? trade : t) : [...prev, trade];
      if (!exists && !trade.copiedFrom) {
        copyTrading.broadcastTrade(trade);
        // Log to activity feed
        logActivity(session.username, "trade_logged", { pair: trade.pair, type: trade.type, pnl: trade.pnl });
        // Check win streak milestone
        const sorted = [...next].filter(t => !t.copiedFrom).sort((a,b) => new Date(a.date) - new Date(b.date));
        let streak = 0;
        for (let i = sorted.length-1; i >= 0; i--) {
          if ((sorted[i].pnl ?? 0) > 0) streak++;
          else break;
        }
        if (streak === 5 || streak === 10 || streak === 20) {
          logActivity(session.username, "win_streak", { streak });
        }
      }
      return next;
    });
    setShowForm(false); setShowCSV(false); setEditTrade(null);
  }, [copyTrading, paperAccts.activeAccount, session?.username]);

  const deleteTrade = useCallback((id) => {
    if (!window.confirm("Delete this trade?")) return;
    deleteScreenshot(id);
    setTrades(prev => prev.filter(t => t.id !== id));
  }, []);

  const strategies = useMemo(() => Array.from(new Set(trades.map(t=>t.strategy).filter(Boolean))).sort(), [trades]);

  // Trades scoped to active account for display
  const activeTrades = useMemo(() => {
    if (!paperAccts.activeAccount || paperAccts.accounts.length === 0) return trades;
    const id = paperAccts.activeAccount.id;
    const isDefault = paperAccts.accounts[0]?.id === id;
    return trades.filter(t => t.accountId === id || (!t.accountId && isDefault));
  }, [trades, paperAccts.activeAccount, paperAccts.accounts]);

  const NAV_TABS = [
    { id:"dashboard",  label:"Dashboard",    icon:<Activity size={13}/> },
    { id:"journal",    label:"Journal",      icon:<BookOpen size={13}/> },
    { id:"stratlab",   label:"Strategy Lab", icon:<FlaskConical size={13}/> },
    { id:"insights",   label:"Insights",     icon:<Sparkles size={13}/> },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#080c18", display:"flex", flexDirection:"column", fontFamily:"system-ui,-apple-system,sans-serif", color:"#e2e8f0" }}>

      {/* Modals */}
      {(showForm || editTrade) && <TradeForm initial={editTrade} strategies={strategies} onSave={saveTrade} onClose={() => { setShowForm(false); setEditTrade(null); }}/>}
      
      {shareModalTrade && <ShareTradeModal trade={shareModalTrade} onClose={()=>setShareModalTrade(null)} />}

      {showAccountSetup && (
        <AccountSetupModal
          username={session.username}
          onComplete={(type, size, fundedInfo) => {
            setShowAccountSetup(false);
            // Clear demo mode when user sets up real account
            try {
              const u = JSON.parse(localStorage.getItem("tradedesk_session_v1")||"{}").username;
              localStorage.removeItem("nexyru_demo_mode_v1_"+u);
              localStorage.removeItem("nexyru_needs_seed_"+u);
              // Clear demo trades
              const trades = JSON.parse(localStorage.getItem("tradedesk_trades_"+u+"_v1")||"[]");
              const realTrades = trades.filter(t => t.source !== "demo");
              localStorage.setItem("tradedesk_trades_"+u+"_v1", JSON.stringify(realTrades));
            } catch(e) {}
            const name = type === "funded"
              ? `${fundedInfo?.propFirm || "Funded"} – ${fundedInfo?.phase === "phase1" ? "Phase 1" : fundedInfo?.phase === "phase2" ? "Phase 2" : "Funded"} ($${(size/1000).toFixed(0)}k)`
              : type === "live"
              ? `Live Account ($${(size/1000).toFixed(0)}k)`
              : `Paper Account ($${(size/1000).toFixed(0)}k)`;
            const acct = paperAccts.addAccount(name, type, size);
            // Save funded challenge rules to localStorage
            if (fundedInfo && acct) {
              localStorage.setItem(
                `nexyru_funded_rules_${session.username}_${acct?.id || Date.now()}`,
                JSON.stringify(fundedInfo)
              );
            }
          }}
          onSkip={() => setShowAccountSetup(false)}
        />
      )}
      {showCSV && <CSVUploader onImport={(imported) => setTrades(prev => [...prev, ...imported.map(t => ({ ...t, accountId: paperAccts.activeAccount?.id ?? null }))])} onClose={() => setShowCSV(false)}/>}
      {showHub && <ImportHub onManual={() => setShowForm(true)} onCSV={() => setShowCSV(true)} onScreenshot={() => setShowShot(true)} onClose={() => setShowHub(false)} accountType={paperAccts.activeAccount?.type ?? "paper"}/>}
      {showAddAcct && <AddAccountModal onAdd={paperAccts.addAccount} onClose={() => setShowAddAcct(false)}/>}
      {showShot && (
        <ScreenshotImporter
          onClose={() => setShowShot(false)}
          onImportAll={(trades) => {
            setTrades(prev => [...prev, ...trades.map(t => ({
              ...t,
              id: `shot_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
              accountId: paperAccts.activeAccount?.id ?? null,
            }))]);
            setShowShot(false);
          }}
        />
      )}

      {/* Top bar */}
      {/* ── Top nav bar ── */}
      <div style={{ display:"flex", alignItems:"center", height:52, borderBottom:"1px solid #1a2035", background:"#0d1120", flexShrink:0, padding:"0 16px", gap:8, position:"sticky", top:0, zIndex:50 }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:"linear-gradient(135deg,#0369a1,#38bdf8)", display:"flex", alignItems:"center", justifyContent:"center" }}><BookOpen size={14} style={{ color:"#fff" }}/></div>
          <span style={{ fontSize:14, fontWeight:800, color:"#f1f5f9" }} className="hide-mobile">Nexyru</span>
        </div>

        {/* Nav tabs — hidden on mobile (use bottom nav instead) */}
        <div style={{ display:"flex", alignItems:"center", gap:1, flex:1, overflowX:"auto" }} className="hide-mobile">
          {NAV_TABS.map(({ id, label, icon }) => (
            <button key={id} onClick={()=>setTab(id)} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 10px", borderRadius:7, fontSize:11, fontWeight:600, cursor:"pointer", border:"none", whiteSpace:"nowrap", background:tab===id?"rgba(56,189,248,0.12)":"transparent", color:tab===id?"#38bdf8":"#64748b" }}>
              {icon}{label}
            </button>
          ))}
          {isDemoMode(session.username) && (
            <span style={{ marginLeft:6, fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:10, background:"rgba(251,191,36,0.12)", border:"1px solid rgba(251,191,36,0.25)", color:"#fbbf24", whiteSpace:"nowrap" }}>
              🎮 DEMO MODE
            </span>
          )}
        </div>

        {/* Mobile: current tab label */}
        <div style={{ flex:1 }} className="show-mobile">
          <span style={{ fontSize:13, fontWeight:700, color:"#e2e8f0" }}>
            {NAV_TABS.find(t => t.id === tab)?.label ?? "Nexyru"}
          </span>
          {isDemoMode(session.username) && <span style={{ marginLeft:8, fontSize:9, fontWeight:700, padding:"1px 7px", borderRadius:10, background:"rgba(251,191,36,0.15)", border:"1px solid rgba(251,191,36,0.3)", color:"#fbbf24" }}>DEMO</span>}
        </div>

        {/* Right side */}
        <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
          <AccountSwitcher accounts={paperAccts.accounts} activeAccount={paperAccts.activeAccount} onSwitch={paperAccts.setActiveAccount} onAdd={() => setShowAddAcct(true)} trades={trades}/>
          <button onClick={()=>setShowHub(true)} style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius:7, border:"none", background:"rgba(56,189,248,0.1)", color:"#38bdf8", fontSize:11, fontWeight:700, cursor:"pointer" }}>
            <Plus size={12}/><span className="hide-mobile"> Add</span>
          </button>
          <span className="hide-mobile"><PlatformDropdown/></span>
          {/* User avatar — always visible */}
          <div style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 8px", borderRadius:8, border:"1px solid #1a2035", background:"#111827" }}>
            <a href={`/trader/@${session.username}`} style={{ display:"flex", alignItems:"center", gap:5, textDecoration:"none" }}>
              <div style={{ width:22, height:22, borderRadius:"50%", background:"linear-gradient(135deg,#0369a1,#38bdf8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:"#fff" }}>{session.displayName[0].toUpperCase()}</div>
              <span style={{ fontSize:11, color:"#94a3b8", fontWeight:600 }} className="hide-mobile">{session.displayName}</span>
            </a>
            <button onClick={onLogout} title="Sign out" style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", display:"flex", padding:2 }} className="hide-mobile"><LogOut size={12}/></button>
          </div>
        </div>
      </div>

      {/* ── Page content ── */}
      <div style={{ flex:1, overflowY:"auto", paddingBottom:60 }}>
        {/* Demo banner — always visible on all tabs */}
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"16px 16px 0" }}>
          <DemoBanner username={session.username} onClear={() => {
            setDemoMode(session.username, false);
            saveUserTrades(session.username, []);
            setTrades([]);
            setShowAccountSetup(true);
          }}/>
        </div>
        <div key={tab} className="page-enter" style={{ maxWidth:1200, margin:"0 auto", padding:"12px 16px 16px" }}>

      {/* ── Bottom nav — mobile only ── */}
      <div className="show-mobile" style={{ position:"fixed", bottom:0, left:0, right:0, height:56, background:"#0d1120", borderTop:"1px solid #1a2035", display:"flex", alignItems:"center", zIndex:50 }}>
        {NAV_TABS.map(({ id, label, icon }) => (
          <button key={id} onClick={()=>setTab(id)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, height:"100%", border:"none", background:"transparent", cursor:"pointer", color:tab===id?"#38bdf8":"#475569", fontSize:9, fontWeight:700 }}>
            <span style={{ fontSize:18 }}>{id==="dashboard"?"🏠":id==="journal"?"📝":id==="stratlab"?"⚗️":"✨"}</span>
            {label}
          </button>
        ))}
        <button onClick={()=>setShowHub(true)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, height:"100%", border:"none", background:"transparent", cursor:"pointer", color:"#38bdf8", fontSize:9, fontWeight:700 }}>
          <span style={{ fontSize:18 }}>➕</span>Add
        </button>
      </div>
          {tab==="dashboard"  && <DashboardHome trades={activeTrades} allTrades={trades} onAddTrade={()=>setShowForm(true)} onOpenImport={()=>setShowHub(true)} activeAccount={paperAccts.activeAccount} onAddStrat={()=>setTab("stratlab")} username={session.username} onClearDemo={() => {
              setDemoMode(session.username, false);
              saveUserTrades(session.username, []);
              setTrades([]);
            }} onUpgradeAccount={(nextSize) => {
              paperAccts.addAccount(`$${(nextSize/1000).toFixed(0)}k Paper Account`, "paper", nextSize);
            }}/>}
          {tab==="journal" && (
            <JournalPage
              trades={activeTrades}
              onEdit={t => setEditTrade(t)}
              onDelete={deleteTrade}
              onAdd={() => setShowForm(true)}
              onCSV={() => setShowCSV(true)}
              onSaveTrade={saveTrade}
              activeAccount={paperAccts.activeAccount}
              username={session.username}
            />
          )}
          {tab==="strategies" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ fontSize:18, fontWeight:800, color:"#f1f5f9" }}>Strategy Performance</div>
              <StrategyCards trades={activeTrades}/>
            </div>
          )}
          {tab==="insights"   && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ fontSize:18, fontWeight:800, color:"#f1f5f9" }}>AI Insights</div>
              <InsightsPanel trades={activeTrades}/>
            </div>
          )}
          {tab==="stratlab"   && <StrategyLabPage session={session} trades={activeTrades}/>}
          {tab==="copy" && <CopyTradingPage session={session} copyTrading={copyTrading}/> }
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse   { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
        .page-enter { animation: fadeIn 0.25s ease; }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e2d3e; border-radius: 2px; }
        a { transition: opacity 0.15s; }
        a:hover { opacity: 0.85; }
        button { transition: opacity 0.15s, transform 0.1s; }
        button:active { transform: scale(0.97); }
        .hide-mobile { display: flex !important; }
        .show-mobile { display: none !important; }
        @media (max-width: 640px) {
          .hide-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ROOT
// ═══════════════════════════════════════════════════════════════

// ── Google Auth Screen ─────────────────────────────────────────
function GoogleAuthScreen() {
  const url = "https://xsrcaceydyqytbipvrok.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fnexyru.com%2Fdashboard";
  return (
    <div style={{minHeight:"100vh",background:"#060d1a",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes glow{0%,100%{box-shadow:0 0 20px rgba(56,189,248,0.1)}50%{box-shadow:0 0 40px rgba(56,189,248,0.25)}}`}</style>
      <div style={{width:"100%",maxWidth:420,padding:20,animation:"fadeIn 0.5s ease"}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:72,height:72,borderRadius:20,background:"linear-gradient(135deg,#0f1e32,#1a2f4a)",border:"1px solid rgba(56,189,248,0.2)",marginBottom:20,animation:"glow 3s ease-in-out infinite"}}>
            <span style={{fontSize:32}}>📈</span>
          </div>
          <h1 style={{fontSize:36,fontWeight:900,color:"#f0f4ff",margin:"0 0 8px",letterSpacing:"-0.03em"}}>Nexyru</h1>
          <p style={{fontSize:14,color:"#3a4a6a",margin:0}}>Your trading journal & performance hub</p>
        </div>
        <div style={{background:"linear-gradient(135deg,#0d1628,#0f1e30)",border:"1px solid #1a2540",borderRadius:24,padding:"36px 32px"}}>
          <h2 style={{fontSize:20,fontWeight:800,color:"#f0f4ff",textAlign:"center",margin:"0 0 6px"}}>Welcome to Nexyru</h2>
          <p style={{fontSize:13,color:"#3a4a6a",textAlign:"center",margin:"0 0 28px"}}>Sign in to access your trades and insights</p>
          <a href={url} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,width:"100%",padding:"14px 20px",borderRadius:14,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.05)",color:"#f0f4ff",fontSize:15,fontWeight:700,textDecoration:"none",boxSizing:"border-box"}}>
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </a>
          <div style={{display:"flex",alignItems:"center",gap:12,margin:"24px 0"}}><div style={{flex:1,height:1,background:"#1a2540"}}/><span style={{fontSize:11,color:"#2e3f5a"}}>what you get</span><div style={{flex:1,height:1,background:"#1a2540"}}/></div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[["📊","AI-powered trade analysis & insights"],["🏆","Verified leaderboard rankings"],["📋","Copy top traders"],["🔄","Works across all your devices"]].map(([i,t],idx)=>(
              <div key={idx} style={{display:"flex",alignItems:"center",gap:10,fontSize:12,color:"#475569"}}><span style={{fontSize:16}}>{i}</span>{t}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Username Picker Screen ─────────────────────────────────────
function UsernamePickerScreen({ auth }) {
  const [username, setUsername] = useState(auth.pendingGoogle?.autoUsername || "");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = () => {
    setLoading(true);
    const err = auth.confirmUsername(username);
    if (err) { setError(err); setLoading(false); }
  };

  return (
    <div style={{minHeight:"100vh",background:"#060d1a",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{width:"100%",maxWidth:420,padding:20,animation:"fadeIn 0.4s ease"}}>
        {/* Avatar */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:72,height:72,borderRadius:20,background:"rgba(56,189,248,0.15)",border:"2px solid rgba(56,189,248,0.3)",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:28,fontWeight:900,color:"#38bdf8",marginBottom:16}}>
            {auth.pendingGoogle?.displayName?.slice(0,2).toUpperCase() || "👤"}
          </div>
          <div style={{fontSize:16,fontWeight:700,color:"#f0f4ff"}}>{auth.pendingGoogle?.displayName}</div>
          <div style={{fontSize:12,color:"#3a4a6a"}}>{auth.pendingGoogle?.email}</div>
        </div>

        <div style={{background:"linear-gradient(135deg,#0d1628,#0f1e30)",border:"1px solid #1a2540",borderRadius:24,padding:"32px 28px"}}>
          <h2 style={{fontSize:20,fontWeight:800,color:"#f0f4ff",margin:"0 0 6px",textAlign:"center"}}>Choose your username</h2>
          <p style={{fontSize:13,color:"#3a4a6a",textAlign:"center",margin:"0 0 24px"}}>This is how other traders will find you on Nexyru</p>

          <div style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",background:"#0b1628",border:`1px solid ${error?"rgba(248,113,113,0.4)":"#1a2540"}`,borderRadius:12,overflow:"hidden"}}>
              <span style={{padding:"0 12px",color:"#3a4a6a",fontSize:14,flexShrink:0}}>@</span>
              <input
                value={username}
                onChange={e => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,"")); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                placeholder="yourname"
                maxLength={20}
                style={{flex:1,padding:"13px 12px 13px 0",background:"transparent",border:"none",color:"#f0f4ff",fontSize:15,outline:"none"}}
                autoFocus
              />
            </div>
            {error && <div style={{fontSize:11,color:"#f87171",marginTop:6}}>{error}</div>}
            <div style={{fontSize:11,color:"#3a4a6a",marginTop:6}}>Letters, numbers and underscores only · 3-20 characters</div>
          </div>

          <button onClick={handleSubmit} disabled={loading || username.length < 3} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:username.length >= 3 ? "linear-gradient(135deg,#0369a1,#38bdf8)" : "#0d1628",color:username.length >= 3 ? "#fff" : "#3a4a6a",fontSize:15,fontWeight:700,cursor:username.length >= 3 ? "pointer" : "not-allowed"}}>
            {loading ? "Setting up…" : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Account Setup Modal ────────────────────────────────────────
function AccountSetupModal({ username, onComplete, onSkip }) {
  const [step,        setStep]        = useState(1);
  const [type,        setType]        = useState(null);
  const [size,        setSize]        = useState(null);
  const [loading,     setLoading]     = useState(false);
  // Funded-specific fields
  const [propFirm,    setPropFirm]    = useState("");
  const [phase,       setPhase]       = useState("phase1");
  const [profitTarget,setProfitTarget]= useState("");
  const [maxDrawdown, setMaxDrawdown] = useState("");
  const [dailyLoss,   setDailyLoss]   = useState("");
  const [minDays,     setMinDays]     = useState("");

  const TYPES = [
    { id:"paper",  emoji:"📝", label:"Paper Trading",   desc:"Practice with virtual money. No risk, full features.", color:"#38bdf8" },
    { id:"funded", emoji:"🏆", label:"Funded Account",  desc:"I'm trading with a prop firm challenge or funded account.", color:"#f59e0b" },
    { id:"live",   emoji:"💰", label:"Live Trading",    desc:"Trading with my own real capital.", color:"#34d399" },
  ];

  const SIZES = [
    { value:10000,  label:"$10K",  tag:null },
    { value:25000,  label:"$25K",  tag:"Popular" },
    { value:50000,  label:"$50K",  tag:null },
    { value:100000, label:"$100K", tag:"Most Common" },
    { value:150000, label:"$150K", tag:null },
    { value:200000, label:"$200K", tag:"Advanced" },
  ];

  const PROP_FIRMS = [
    "Apex Trader Funding", "TopstepX", "Topstep", "FTMO", "MyFundedFutures",
    "Take Profit Trader", "Earn2Trade", "TradeDay", "Uprofit", "Other"
  ];

  const totalSteps = type === "funded" ? 3 : 2;

  const handleDone = () => {
    if (!type || !size) return;
    setLoading(true);
    const fundedInfo = type === "funded" ? {
      propFirm, phase,
      profitTarget: parseFloat(profitTarget) || (size * 0.08),
      maxDrawdown:  parseFloat(maxDrawdown)  || (size * 0.06),
      dailyLoss:    parseFloat(dailyLoss)    || (size * 0.03),
      minDays:      parseInt(minDays)        || 10,
      startDate:    new Date().toISOString(),
    } : null;
    setTimeout(() => onComplete(type, size, fundedInfo), 400);
  };

  const selectedType = TYPES.find(t => t.id === type);
  const isFundedReady = type === "funded" ? propFirm.length > 0 : true;

  // Auto-fill defaults when size is selected
  const autoFill = (s) => {
    setSize(s);
    if (type === "funded") {
      if (!profitTarget) setProfitTarget(String(Math.round(s * 0.08)));
      if (!maxDrawdown)  setMaxDrawdown(String(Math.round(s * 0.06)));
      if (!dailyLoss)    setDailyLoss(String(Math.round(s * 0.03)));
      if (!minDays)      setMinDays("10");
    }
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:99999,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}>
      <div style={{position:"absolute",inset:0,background:"rgba(4,8,20,0.96)",backdropFilter:"blur(24px)"}}/>
      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:580,margin:"0 20px",maxHeight:"90vh",overflowY:"auto"}}>
        <style>{`@keyframes setupIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>

        <div style={{background:"linear-gradient(135deg,#0d1628,#0f1e30)",border:"1px solid #1a2540",borderRadius:28,overflow:"hidden",animation:"setupIn 0.4s ease",boxShadow:"0 40px 120px rgba(0,0,0,0.9)"}}>

          {/* Header */}
          <div style={{padding:"28px 32px 20px",borderBottom:"1px solid #111d30"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
              <div style={{width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,rgba(56,189,248,0.2),rgba(56,189,248,0.05))",border:"1px solid rgba(56,189,248,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🚀</div>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#38bdf8",letterSpacing:"0.08em",marginBottom:2}}>STEP {step} OF {totalSteps}</div>
                <h2 style={{fontSize:19,fontWeight:900,color:"#f0f4ff",margin:0,letterSpacing:"-0.02em"}}>
                  {step===1 ? "What type of account are you trading?" : step===2 ? "What's your account size?" : "Set up your funded challenge rules"}
                </h2>
              </div>
            </div>
            <div style={{display:"flex",gap:6,marginTop:14}}>
              {Array.from({length:totalSteps}).map((_,i) => (
                <div key={i} style={{flex:1,height:3,borderRadius:2,background:i+1<=step?"#38bdf8":"#1a2540",transition:"background 0.3s"}}/>
              ))}
            </div>
          </div>

          {/* Step 1 — Account Type */}
          {step === 1 && (
            <div style={{padding:"24px 32px 28px"}}>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {TYPES.map(t => (
                  <button key={t.id} onClick={() => setType(t.id)} style={{display:"flex",alignItems:"center",gap:16,padding:"16px 20px",borderRadius:16,border:`1.5px solid ${type===t.id?t.color+"60":"#1a2540"}`,background:type===t.id?`${t.color}0d`:"rgba(255,255,255,0.02)",cursor:"pointer",textAlign:"left",transition:"all 0.15s",outline:"none"}}>
                    <div style={{width:48,height:48,borderRadius:14,background:`${t.color}18`,border:`1.5px solid ${t.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{t.emoji}</div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                        <span style={{fontSize:14,fontWeight:800,color:type===t.id?t.color:"#e2e8f0"}}>{t.label}</span>
                        {type===t.id && <span style={{fontSize:10,color:t.color}}>✓</span>}
                      </div>
                      <span style={{fontSize:12,color:"#475569",lineHeight:1.5}}>{t.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:24}}>
                <button onClick={onSkip} style={{background:"none",border:"none",color:"#334155",fontSize:13,cursor:"pointer",padding:0}}>Skip for now</button>
                <button onClick={() => type && setStep(2)} disabled={!type} style={{padding:"11px 28px",borderRadius:14,border:"none",background:type?"linear-gradient(135deg,#0369a1,#38bdf8)":"#1a2540",color:type?"#fff":"#334155",fontSize:14,fontWeight:700,cursor:type?"pointer":"not-allowed"}}>
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Account Size */}
          {step === 2 && (
            <div style={{padding:"24px 32px 28px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,padding:"10px 14px",borderRadius:12,background:`${selectedType?.color}0d`,border:`1px solid ${selectedType?.color}25`}}>
                <span style={{fontSize:16}}>{selectedType?.emoji}</span>
                <span style={{fontSize:13,color:selectedType?.color,fontWeight:600}}>{selectedType?.label}</span>
                <button onClick={() => setStep(1)} style={{marginLeft:"auto",background:"none",border:"none",color:"#475569",fontSize:11,cursor:"pointer",padding:"2px 8px",borderRadius:6,border:"1px solid #1a2540"}}>Change</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:24}}>
                {SIZES.map(s => (
                  <button key={s.value} onClick={() => autoFill(s.value)} style={{padding:"14px 10px",borderRadius:14,border:`1.5px solid ${size===s.value?"rgba(56,189,248,0.5)":"#1a2540"}`,background:size===s.value?"rgba(56,189,248,0.08)":"rgba(255,255,255,0.02)",cursor:"pointer",textAlign:"center",position:"relative",outline:"none",transition:"all 0.15s"}}>
                    {s.tag && <div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,#0369a1,#38bdf8)",borderRadius:10,padding:"1px 8px",fontSize:8,fontWeight:700,color:"#fff",whiteSpace:"nowrap"}}>{s.tag}</div>}
                    <div style={{fontSize:16,fontWeight:900,color:size===s.value?"#38bdf8":"#e2e8f0",fontFamily:"monospace"}}>{s.label}</div>
                    <div style={{fontSize:10,color:"#3a4a6a",marginTop:2}}>{s.value.toLocaleString()}</div>
                  </button>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <button onClick={() => setStep(1)} style={{background:"none",border:"none",color:"#334155",fontSize:13,cursor:"pointer",padding:0}}>← Back</button>
                <button onClick={() => size && (type==="funded" ? setStep(3) : handleDone())} disabled={!size||loading} style={{padding:"11px 28px",borderRadius:14,border:"none",background:size&&!loading?"linear-gradient(135deg,#0369a1,#38bdf8)":"#1a2540",color:size&&!loading?"#fff":"#334155",fontSize:14,fontWeight:700,cursor:size&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",gap:8}}>
                  {loading ? "Setting up…" : type==="funded" ? "Next →" : "Let's go 🚀"}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Funded Challenge Rules (funded only) */}
          {step === 3 && type === "funded" && (
            <div style={{padding:"24px 32px 28px"}}>
              {/* Prop firm selector */}
              <div style={{marginBottom:16}}>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",letterSpacing:"0.06em",display:"block",marginBottom:8}}>PROP FIRM</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {PROP_FIRMS.map(f => (
                    <button key={f} onClick={() => setPropFirm(f)} style={{padding:"6px 12px",borderRadius:20,border:`1px solid ${propFirm===f?"rgba(245,158,11,0.5)":"#1a2540"}`,background:propFirm===f?"rgba(245,158,11,0.1)":"rgba(255,255,255,0.02)",color:propFirm===f?"#f59e0b":"#64748b",fontSize:11,fontWeight:propFirm===f?700:400,cursor:"pointer",outline:"none"}}>
                      {f}
                    </button>
                  ))}
                </div>
                {propFirm === "Other" && (
                  <input value={propFirm==="Other"?"":propFirm} onChange={e=>setPropFirm(e.target.value)} placeholder="Enter firm name…" style={{marginTop:8,width:"100%",padding:"9px 12px",borderRadius:10,border:"1px solid #1a2540",background:"#0b1120",color:"#e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                )}
              </div>

              {/* Phase */}
              <div style={{marginBottom:16}}>
                <label style={{fontSize:11,fontWeight:700,color:"#64748b",letterSpacing:"0.06em",display:"block",marginBottom:8}}>CHALLENGE PHASE</label>
                <div style={{display:"flex",gap:8}}>
                  {[{id:"phase1",label:"Phase 1"},{ id:"phase2",label:"Phase 2"},{id:"funded",label:"Funded"}].map(p => (
                    <button key={p.id} onClick={() => setPhase(p.id)} style={{flex:1,padding:"8px",borderRadius:10,border:`1px solid ${phase===p.id?"rgba(245,158,11,0.4)":"#1a2540"}`,background:phase===p.id?"rgba(245,158,11,0.08)":"rgba(255,255,255,0.02)",color:phase===p.id?"#f59e0b":"#64748b",fontSize:12,fontWeight:phase===p.id?700:400,cursor:"pointer",outline:"none"}}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Challenge rules grid */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                {[
                  { label:"PROFIT TARGET ($)", value:profitTarget, set:setProfitTarget, hint:`e.g. ${Math.round((size||100000)*0.08).toLocaleString()}`, color:"#34d399" },
                  { label:"MAX DRAWDOWN ($)", value:maxDrawdown,  set:setMaxDrawdown,  hint:`e.g. ${Math.round((size||100000)*0.06).toLocaleString()}`, color:"#f87171" },
                  { label:"DAILY LOSS LIMIT ($)", value:dailyLoss, set:setDailyLoss,   hint:`e.g. ${Math.round((size||100000)*0.03).toLocaleString()}`, color:"#fbbf24" },
                  { label:"MIN TRADING DAYS",   value:minDays,    set:setMinDays,     hint:"e.g. 10", color:"#38bdf8" },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{fontSize:10,fontWeight:700,color:f.color,letterSpacing:"0.06em",display:"block",marginBottom:6}}>{f.label}</label>
                    <input
                      type="number"
                      value={f.value}
                      onChange={e => f.set(e.target.value)}
                      placeholder={f.hint}
                      style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid rgba(${f.color==="34d399"?"52,211,153":f.color==="f87171"?"248,113,113":f.color==="fbbf24"?"251,191,36":"56,189,248"},0.2)`,background:"#0b1120",color:"#e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"monospace"}}
                    />
                  </div>
                ))}
              </div>

              {/* Info banner */}
              <div style={{padding:"10px 14px",borderRadius:12,background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.15)",marginBottom:20,fontSize:11,color:"#92400e",lineHeight:1.6}}>
                📊 Nexyru will <strong style={{color:"#f59e0b"}}>automatically track</strong> your daily P&L, drawdown, and progress toward your profit target. You'll get alerts when approaching limits.
              </div>

              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <button onClick={() => setStep(2)} style={{background:"none",border:"none",color:"#334155",fontSize:13,cursor:"pointer",padding:0}}>← Back</button>
                <button onClick={handleDone} disabled={!propFirm||loading} style={{padding:"11px 28px",borderRadius:14,border:"none",background:propFirm&&!loading?"linear-gradient(135deg,#92400e,#f59e0b)":"#1a2540",color:propFirm&&!loading?"#000":"#334155",fontSize:14,fontWeight:700,cursor:propFirm&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",gap:8}}>
                  {loading ? "Setting up…" : "Start Tracking 🏆"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ── Share Trade Button ─────────────────────────────────────────
function ShareTradeButton({ trade, username }) {
  const [state, setState] = React.useState("idle"); // idle | sharing | done | error
  const [showModal, setShowModal] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [visibility, setVisibility] = React.useState("public");

  const handleShare = async () => {
    setState("sharing");
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      // Get user profile id
      const profRes = await fetch(`${supabaseUrl}/rest/v1/profiles?username=eq.${username}&select=id`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      });
      const profiles = await profRes.json();
      if (!profiles?.length) throw new Error("Profile not found");
      const userId = profiles[0].id;

      // Check dedup - don't share same trade twice
      const dedupRes = await fetch(`${supabaseUrl}/rest/v1/trade_posts?trade_id=eq.${trade.id}&user_id=eq.${userId}&select=id`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      });
      const existing = await dedupRes.json();
      if (existing?.length) { setState("done"); setShowModal(false); return; }

      // Post to trade_posts
      const pnl = trade.pnl ?? 0;
      const post = {
        user_id:    userId,
        trade_id:   trade.id,
        symbol:     trade.symbol || trade.pair || "Unknown",
        side:       (trade.type === "long" || trade.side === "long") ? "long" : "short",
        entry_price: trade.entryPrice ?? null,
        exit_price:  trade.exitPrice ?? null,
        pnl:         pnl,
        contracts:   trade.contracts ?? trade.quantity ?? null,
        setup_name:  trade.strategy || trade.setup || null,
        timeframe:   trade.timeframe ?? null,
        notes:       notes || null,
        status:      "closed",
        visibility,
      };

      const postRes = await fetch(`${supabaseUrl}/rest/v1/trade_posts`, {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify(post)
      });

      if (!postRes.ok) throw new Error("Failed to post");
      setState("done");
      setShowModal(false);
    } catch (e) {
      console.error(e);
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  };

  const pnl = trade.pnl ?? 0;
  const pos = pnl >= 0;

  return (
    <>
      <button
        onClick={() => { if (state === "done") return; setShowModal(true); }}
        title={state === "done" ? "Already shared" : "Share to feed"}
        style={{
          padding: "3px 8px", borderRadius: 8, border: "none", cursor: state === "done" ? "default" : "pointer",
          background: state === "done" ? "rgba(52,211,153,0.1)" : "rgba(56,189,248,0.08)",
          color: state === "done" ? "#34d399" : "#38bdf8",
          fontSize: 10, fontWeight: 700, transition: "all 0.15s"
        }}>
        {state === "done" ? "✓ Shared" : state === "sharing" ? "…" : state === "error" ? "✗" : "📡 Share"}
      </button>

      {showModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          style={{ position:"fixed", inset:0, zIndex:99999, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(4,8,20,0.92)", backdropFilter:"blur(16px)", fontFamily:"system-ui,sans-serif" }}>
          <div style={{ background:"linear-gradient(135deg,#0d1628,#0f1e30)", border:"1px solid #1a2540", borderRadius:24, padding:"28px 28px 24px", maxWidth:420, width:"90%", boxShadow:"0 40px 120px rgba(0,0,0,0.9)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
              <h3 style={{ fontSize:18, fontWeight:900, color:"#f0f4ff", margin:0 }}>Share to Feed 📡</h3>
              <button onClick={() => setShowModal(false)} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:18 }}>✕</button>
            </div>

            {/* Trade preview */}
            <div style={{ padding:"14px 16px", borderRadius:14, background: pos?"rgba(52,211,153,0.08)":"rgba(248,113,113,0.08)", border:`1px solid ${pos?"rgba(52,211,153,0.2)":"rgba(248,113,113,0.2)"}`, marginBottom:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:4, background: trade.type==="long"?"rgba(52,211,153,0.15)":"rgba(248,113,113,0.15)", color: trade.type==="long"?"#34d399":"#f87171" }}>
                  {trade.type==="long"?"▲ LONG":"▼ SHORT"}
                </span>
                <span style={{ fontSize:14, fontWeight:800, color:"#f0f4ff", fontFamily:"monospace" }}>{trade.symbol || trade.pair}</span>
                {trade.strategy && <span style={{ fontSize:10, color:"#475569" }}>{trade.strategy}</span>}
              </div>
              <div style={{ fontSize:22, fontWeight:900, color: pos?"#34d399":"#f87171", fontFamily:"monospace" }}>
                {pos?"+":""}{pnl.toFixed(2)}
              </div>
              {trade.entryPrice && <div style={{ fontSize:10, color:"#475569", marginTop:4 }}>Entry {trade.entryPrice} → Exit {trade.exitPrice}</div>}
            </div>

            {/* Caption */}
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, fontWeight:700, color:"#64748b", display:"block", marginBottom:6, letterSpacing:"0.06em", textTransform:"uppercase" }}>Add a note (optional)</label>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="What was your setup? Any lessons learned?"
                rows={3}
                style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid #1a2540", background:"#0b1120", color:"#e2e8f0", fontSize:13, outline:"none", resize:"vertical", fontFamily:"system-ui", boxSizing:"border-box" }}
              />
            </div>

            {/* Visibility */}
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:11, fontWeight:700, color:"#64748b", display:"block", marginBottom:6, letterSpacing:"0.06em", textTransform:"uppercase" }}>Visibility</label>
              <div style={{ display:"flex", gap:8 }}>
                {[["public","🌍 Public"],["followers","👥 Followers"],["private","🔒 Private"]].map(([v,l]) => (
                  <button key={v} onClick={() => setVisibility(v)} style={{ flex:1, padding:"7px 4px", borderRadius:10, border:`1px solid ${visibility===v?"rgba(56,189,248,0.4)":"#1a2540"}`, background:visibility===v?"rgba(56,189,248,0.08)":"rgba(255,255,255,0.02)", color:visibility===v?"#38bdf8":"#475569", fontSize:11, fontWeight:visibility===v?700:500, cursor:"pointer" }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleShare} disabled={state==="sharing"} style={{ width:"100%", padding:"12px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#0369a1,#38bdf8)", color:"#fff", fontSize:14, fontWeight:700, cursor:state==="sharing"?"wait":"pointer" }}>
              {state==="sharing" ? "Sharing…" : "Share Trade 🚀"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ShareTradeModal({trade,onClose}){
  const[notes,setNotes]=React.useState('');
  const[vis,setVis]=React.useState('public');
  const[status,setStatus]=React.useState('idle');
  const SUPA='https://xsrcaceydyqytbipvrok.supabase.co';
  const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcmNhY2V5ZHlxeXRiaXB2cm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDg0MjUsImV4cCI6MjA5MzUyNDQyNX0.IfIkjTtAAb0-iZLu8CE-3GgdNGKxSNJKczSAZlQV62A';
  const pnl=trade.pnl??0; const pos=pnl>=0;
  const username=(()=>{try{return JSON.parse(localStorage.getItem('tradedesk_session_v1')||'{}').username||'';}catch{return '';}})();
  const share=async()=>{
    setStatus('sharing');
    try{
      const u=JSON.parse(localStorage.getItem('tradedesk_session_v1')||'{}').username;
      const r=await fetch(SUPA+'/rest/v1/profiles?username=eq.'+encodeURIComponent(u)+'&select=id',{headers:{apikey:KEY,Authorization:'Bearer '+KEY}});
      const p=await r.json(); if(!p?.length)throw new Error('Profile not found');
      const res=await fetch(SUPA+'/rest/v1/trade_posts',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({user_id:p[0].id,trade_id:String(trade.id),symbol:trade.symbol||trade.pair||'Unknown',side:trade.type==='long'?'long':'short',entry_price:trade.entryPrice??null,exit_price:trade.exitPrice??null,pnl,contracts:trade.contracts??trade.quantity??null,setup_name:trade.strategy||null,notes:notes||null,status:'closed',visibility:vis})});
      if(!res.ok){const e=await res.json();throw new Error(e.message);}
      try{
        const arr=JSON.parse(localStorage.getItem('nexyru_shared_trades')||'[]');
        const next=Array.from(new Set([...arr,String(trade.id)]));
        localStorage.setItem('nexyru_shared_trades',JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('nexyruSharedUpdate'));
      }catch{}
      setStatus('done'); setTimeout(onClose,1500);
    }catch(e){setStatus('error'+e.message);}
  };
  return(
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{position:'fixed',inset:0,zIndex:99999,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(4,8,20,0.92)',backdropFilter:'blur(16px)',fontFamily:'system-ui'}}>
      <div style={{background:'linear-gradient(135deg,#0d1628,#0f1e30)',border:'1px solid #1a2540',borderRadius:24,padding:28,maxWidth:440,width:'90%',boxShadow:'0 40px 120px rgba(0,0,0,0.9)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <h3 style={{fontSize:18,fontWeight:900,color:'#f0f4ff',margin:0}}>Share Trade 📡</h3>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#475569',cursor:'pointer',fontSize:18}}>✕</button>
        </div>
        {username && (
          <div style={{fontSize:11,color:'#64748b',marginBottom:16}}>
            Sharing as <a href={`/trader/@${username}`} style={{color:'#38bdf8',textDecoration:'none',fontWeight:700}}>@{username}</a>
          </div>
        )}
        <div style={{padding:'14px 16px',borderRadius:14,background:pos?'rgba(52,211,153,0.08)':'rgba(248,113,113,0.08)',border:'1px solid '+(pos?'rgba(52,211,153,0.2)':'rgba(248,113,113,0.2)'),marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
            <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,background:trade.type==='long'?'rgba(52,211,153,0.15)':'rgba(248,113,113,0.15)',color:trade.type==='long'?'#34d399':'#f87171'}}>{trade.type==='long'?'▲ LONG':'▼ SHORT'}</span>
            <span style={{fontSize:15,fontWeight:800,color:'#f0f4ff',fontFamily:'monospace'}}>{trade.symbol||trade.pair}</span>
          </div>
          <div style={{fontSize:24,fontWeight:900,color:pos?'#34d399':'#f87171',fontFamily:'monospace'}}>{pos?'+':''}{pnl.toFixed(2)}</div>
          {trade.entryPrice&&<div style={{fontSize:11,color:'#475569',marginTop:4}}>Entry {trade.entryPrice} → Exit {trade.exitPrice}</div>}
        </div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:6,textTransform:'uppercase'}}>Note (optional)</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="What was your setup?" rows={3} style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'1px solid #1a2540',background:'#0b1120',color:'#e2e8f0',fontSize:13,outline:'none',resize:'vertical',fontFamily:'system-ui',boxSizing:'border-box'}}/>
        </div>
        <div style={{marginBottom:20}}>
          <label style={{fontSize:11,fontWeight:700,color:'#64748b',display:'block',marginBottom:8,textTransform:'uppercase'}}>Visibility</label>
          <div style={{display:'flex',gap:8}}>
            {[['public','🌍 Public'],['followers','👥 Followers'],['private','🔒 Private']].map(([v,l])=>(
              <button key={v} onClick={()=>setVis(v)} style={{flex:1,padding:8,borderRadius:10,border:'1px solid '+(vis===v?'rgba(56,189,248,0.4)':'#1a2540'),background:vis===v?'rgba(56,189,248,0.08)':'rgba(255,255,255,0.02)',color:vis===v?'#38bdf8':'#475569',fontSize:11,fontWeight:vis===v?700:500,cursor:'pointer'}}>{l}</button>
            ))}
          </div>
        </div>
        {status.startsWith('error')&&<div style={{padding:'8px 12px',borderRadius:10,background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.2)',fontSize:12,color:'#f87171',marginBottom:12}}>{status.slice(5)}</div>}
        <button onClick={share} disabled={status==='sharing'||status==='done'} style={{width:'100%',padding:12,borderRadius:12,border:'none',background:status==='done'?'rgba(52,211,153,0.15)':'linear-gradient(135deg,#0369a1,#38bdf8)',color:status==='done'?'#34d399':'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
          {status==='done'?'✓ Shared!':status==='sharing'?'Sharing…':'Share Trade 🚀'}
        </button>
      </div>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────
export default function App() {
  const auth = useAuth();

  if (!auth.hydrated) return (
    <div style={{ minHeight:"100vh", background:"#080c18", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:32, height:32, border:"3px solid #1a2035", borderTopColor:"#38bdf8", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );

  if (!auth.session && !auth.needsUsername) return <GoogleAuthScreen/>;
  if (auth.needsUsername) return <UsernamePickerScreen auth={auth}/>;
  return <TradingDashboard session={auth.session} onLogout={auth.logout}/>;
}