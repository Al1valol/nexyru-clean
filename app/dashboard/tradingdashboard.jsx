"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  TrendingUp, TrendingDown, Activity, X, BookOpen, AlertCircle,
  Target, Award, ChevronUp, ChevronDown, ChevronsUpDown, Search,
  Plus, ChevronRight, Edit2, Trash, Users, UserCheck,
  UserMinus, Radio, Repeat2, Sparkles, Wand2, RefreshCw, Upload,
  FileText, Link2, Download, BarChart2, Layers,
  LogOut, User, UserPlus, Eye, EyeOff, FlaskConical,
  Calendar, ArrowUpRight, ArrowDownRight,
  Zap, Shield, Image, Webhook, Wallet, Check, TestTube2, Play,
  CheckSquare, Bell, Trophy, Brain, Settings,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts";
import MobileDashboard from "./MobileDashboard";

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

// ── Number formatting helpers ─────────────────────────────────
function fmtMoney(n, { signed = false } = {}) {
  const v = Number(n) || 0;
  const abs = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (signed) {
    if (v > 0) return `+$${abs}`;
    if (v < 0) return `-$${abs}`;
    return `$${abs}`;
  }
  return v < 0 ? `-$${abs}` : `$${abs}`;
}
function fmtPct(n, { signed = false, digits = 1 } = {}) {
  const v = Number(n) || 0;
  const s = v.toFixed(digits);
  if (signed && v > 0) return `+${s}%`;
  return `${s}%`;
}
function fmtNum(n) {
  return (Number(n) || 0).toLocaleString("en-US");
}
function formatPrice(price) {
  const v = Number(price) || 0;
  const abs = Math.abs(v);
  if (abs < 10)   return v.toFixed(4);
  if (abs < 1000) return v.toFixed(2);
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
  const losses  = sorted.filter(t =>(t.pnl ?? 0)< 0);
  const totalPnl = +sorted.reduce((s,t) => s + (t.pnl ?? 0), 0).toFixed(4);
  let streak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const w = (sorted[i].pnl ?? 0) > 0;
    if (streak === 0)          streak = w ? 1 : -1;
    else if (streak >0 && w) streak++;
 else if (streak< 0 && !w) streak--;
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
//  MOBILE DETECTION HOOK
// ═══════════════════════════════════════════════════════════════

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const check = () =>setIsMobile(window.innerWidth< breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
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
        const supabaseUserId = payload.sub || null;
        const googleData = { email, displayName, token, autoUsername, supabaseUserId };
        window.history.replaceState(null, "", "/dashboard");
        if (supabaseUserId) {
          try { localStorage.setItem("nexyru_supabase_user_id", supabaseUserId); } catch {}
        }
        // Check if user already has a chosen username
        const existing = localStorage.getItem(`nexyru_google_username_${email}`);
        if (existing) {
          const s = { username: existing, displayName, email, googleAuth: true, supabaseUserId };
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
        // Self-heal: /auth/callback (email verify, password reset) sets sb-* auth
        // storage but never updates SESSION_KEY, and pre-supabaseUserId sessions
        // exist from older deploys. Recover the id from the live token so the
        // cross-device sync useEffect can actually fire.
        if (!s.supabaseUserId) {
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (!k || !k.startsWith("sb-") || !k.endsWith("-auth-token")) continue;
              const tok = JSON.parse(localStorage.getItem(k) || "{}");
              const uid = tok?.user?.id || tok?.currentSession?.user?.id;
              if (uid) {
                s.supabaseUserId = uid;
                s.googleAuth = true;
                localStorage.setItem(SESSION_KEY, JSON.stringify(s));
                break;
              }
            }
          } catch {}
        }
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
    const s = { username: u, displayName: pendingGoogle.displayName, email: pendingGoogle.email, googleAuth: true, supabaseUserId: pendingGoogle.supabaseUserId || null };
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
    const type       = Math.random() >0.45 ? "long" : "short";
 const isCrypto = pair.includes("USD");
 const basePrice = isCrypto
 ? pair.includes("BTC") ? rnd(62000, 71000) : pair.includes("ETH") ? rnd(3100, 3800) : rnd(120, 185)
 : pair.includes("NQ") ? rnd(17800, 19200) : pair.includes("ES") ? rnd(5050, 5380) : rnd(1950, 2150);

 const shouldWin = (wins / (i + 1))< winTargetPct && Math.random() > 0.3;
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
    <div style={{ padding:"14px 18px", borderRadius:14, background:"linear-gradient(135deg,rgba(245,158,11,0.07),rgba(245,158,11,0.05))", border:"1px solid rgba(245,158,11,0.25)", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}><div style={{ display:"flex", alignItems:"center", gap:10, flex:1, minWidth:200 }}><div style={{ width:36, height:36, borderRadius:10, background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}></div><div><div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:3 }}><span style={{ fontSize:12, fontWeight:800, color:"#f59e0b" }}>Demo Mode</span><span style={{ fontSize:9, fontWeight:700, padding:"1px 7px", borderRadius:10, background:"rgba(245,158,11,0.15)", border:"1px solid rgba(245,158,11,0.25)", color:"#f59e0b" }}>SAMPLE DATA</span></div><div style={{ fontSize:11, color:"#6b7280" }}>
            {confirming ? "️ This will delete all demo trades. Are you sure?" : "You're viewing sample trades. Switch to real mode when ready to log your own."}
          </div></div></div><div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        {!confirming ? (
          <><span style={{ fontSize:11, color:"#6b7280" }}>Demo</span><div onClick={() => setConf(true)} style={{ width:44, height:24, borderRadius:12, background:"rgba(245,158,11,0.15)", border:"1px solid rgba(245,158,11,0.3)", cursor:"pointer", position:"relative" }}><div style={{ position:"absolute", top:3, left:3, width:16, height:16, borderRadius:"50%", background:"#f59e0b", boxShadow:"0 0 8px rgba(245,158,11,0.4)" }}/></div><span style={{ fontSize:11, color:"#6b7280" }}>Real</span></>) : (<><button onClick={handleConfirm} style={{ padding:"6px 14px", borderRadius:8, border:"none", background:"linear-gradient(135deg,#10b981,#10b981)", color:"#000", fontSize:11, fontWeight:800, cursor:"pointer" }}>✓ Yes, switch to real</button><button onClick={() => setConf(false)} style={{ padding:"6px 12px", borderRadius:8, border:"1px solid #2a2a3a", background:"transparent", color:"#6b7280", fontSize:11, cursor:"pointer" }}>Cancel</button></>
        )}
      </div></div>
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
    background:"#1a1a24", border:"1px solid #2a2a3a",
    fontSize:13, color:"#ffffff", outline:"none", boxSizing:"border-box",
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a0f", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}><div style={{ width:"100%", maxWidth:380 }}><div style={{ textAlign:"center", marginBottom:40 }}><div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:52, height:52, borderRadius:16, background:"#6366f1", marginBottom:16 }}><BookOpen size={24} style={{ color:"#fff" }}/></div><div style={{ fontSize:24, fontWeight:800, color:"#ffffff" }}>Nexyru</div><div style={{ fontSize:12, color:"#6b7280", marginTop:4 }}>Trading Journal · Strategy · Copy Trading</div></div><div style={{ background:"#111118", borderRadius:16, border:"1px solid #2a2a3a", padding:"28px" }}><div style={{ display:"flex", borderRadius:8, background:"#1a1a24", padding:3, marginBottom:24, gap:3 }}>
            {[["login","Sign In"],["register","Create Account"]].map(([m,label]) =>(<button key={m} onClick={() => { setMode(m); setErr(""); }} style={{ flex:1, padding:"8px", borderRadius:6, border:"none", background: mode===m?"#2a2a3a":"transparent", color: mode===m?"#6366f1":"#6b7280", fontSize:12, fontWeight:600, cursor:"pointer" }}>{label}</button>
            ))}
          </div><div style={{ display:"flex", flexDirection:"column", gap:14 }}><div><label style={{ display:"block", fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Username</label><div style={{ position:"relative" }}><User size={14} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#6b7280" }}/><input style={{ ...inp, paddingLeft:36 }} placeholder="username" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key==="Enter" && submit()}/></div></div>
            {mode === "register" && (
              <div><label style={{ display:"block", fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Display Name</label><input style={inp} placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} onKeyDown={e => e.key==="Enter" && submit()}/></div>
            )}
            <div><label style={{ display:"block", fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Password</label><div style={{ position:"relative" }}>
                {showPw
                  ? <Eye size={14} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", color:"#6b7280", cursor:"pointer" }} onClick={() => setShowPw(false)}/>:<EyeOff size={14} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", color:"#6b7280", cursor:"pointer" }} onClick={() => setShowPw(true)}/>}
                <input type={showPw?"text":"password"} style={{ ...inp, paddingRight:36 }} placeholder="••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==="Enter" && submit()}/></div></div></div>
          {err && <div style={{ marginTop:12, padding:"9px 12px", borderRadius:8, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", fontSize:12, color:"#ef4444", display:"flex", alignItems:"center", gap:7 }}><AlertCircle size={13}/>{err}</div>}
          <button onClick={submit} style={{ width:"100%", marginTop:20, padding:"12px", borderRadius:10, border:"none", background:"#6366f1", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 20px rgba(99,102,241,0.25)" }}>
            {mode==="login" ? "Sign In" : "Create Account"}
          </button></div></div></div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  STAT CARD
// ═══════════════════════════════════════════════════════════════

function StatCard({ label, value, sub, pos, icon }) {
  const LABEL_ACCENT = {
    "Total Trades": "#6366f1",
    "Win Rate":     "#a5b4fc",
    "Best Trade":   "#10b981",
    "Worst Trade":  "#ef4444",
  };
  const topAccent = LABEL_ACCENT[label] ?? (pos === true ? "#10b981" : pos === false ? "#ef4444" : "#6366f1");
  const accent    = pos === true ? "#10b981" : pos === false ? "#ef4444" : "#ffffff";
  const border    = "rgba(51,65,85,0.5)";
  const glow      = pos === true ? "rgba(52,211,153,0.15)" : pos === false ? "rgba(248,113,113,0.15)" : "rgba(99,102,241,0.15)";
  return (
    <div
      style={{
        position:"relative",
        borderRadius:12,
        border:`1px solid ${border}`,
        background:"linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0))",
        backgroundColor:"rgba(15,23,42,0.85)",
        padding:"14px 16px",
        overflow:"hidden",
        transition:"box-shadow 0.18s, transform 0.18s, border-color 0.18s",
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 8px 22px ${glow}`; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
    ><div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:topAccent }}/><div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:10 }}><span style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.1em" }}>{label}</span><span style={{ color:topAccent, opacity:0.75 }}>{icon}</span></div><div style={{
        fontSize:"clamp(16px, 4.2vw, 30px)",
        fontWeight:800,
        letterSpacing:"-0.5px",
        color:accent,
        lineHeight:1.1,
        fontFamily:'-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif',
        fontVariantNumeric:"tabular-nums",
        whiteSpace:"nowrap",
        overflow:"hidden",
        textOverflow:"ellipsis",
      }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:"#6b7280", marginTop:8, letterSpacing:"0.01em" }}>{sub}</div>}
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

  const inp = { width:"100%", padding:"9px 12px", borderRadius:8, boxSizing:"border-box", background:"#1a1a24", border:"1px solid #2a2a3a", fontSize:12, color:"#ffffff", outline:"none" };
  const lbl = { display:"block", fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 };
  const row = { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:80, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}><div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)" }}/><div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:560, borderRadius:16, border:"1px solid #2a2a3a", background:"#111118", boxShadow:"0 25px 60px rgba(0,0,0,0.6)", maxHeight:"92vh", overflowY:"auto" }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid #2a2a3a", position:"sticky", top:0, background:"#111118", zIndex:1 }}><div style={{ fontSize:14, fontWeight:700, color:"#ffffff", display:"flex", alignItems:"center", gap:8 }}><Zap size={15} style={{ color:"#6366f1" }}/>{initial ? "Edit Trade" : "Log a Trade"}
          </div><button onClick={onClose} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer" }}><X size={16}/></button></div><div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:16 }}><div style={row}><div><label style={lbl}>Pair / Instrument</label><input list="pairs-list" style={inp} value={f.pair} onChange={e => set("pair", e.target.value)} placeholder="BTC/USD"/><datalist id="pairs-list">{COMMON_PAIRS.map(p =><option key={p} value={p}/>)}</datalist></div><div><label style={lbl}>Direction</label><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                {["long","short"].map(t =>(<button key={t} onClick={() => set("type", t)} style={{ padding:"9px 0", borderRadius:8, border:`1px solid ${f.type===t?(t==="long"?"rgba(16,185,129,0.5)":"rgba(239,68,68,0.5)"):"#2a2a3a"}`, background: f.type===t?(t==="long"?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.12)"):"transparent", color: f.type===t?(t==="long"?"#10b981":"#ef4444"):"#6b7280", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:4 }}>
                    {t==="long" ? <ArrowUpRight size={13}/>:<ArrowDownRight size={13}/>}{t.toUpperCase()}
                  </button>
                ))}
              </div></div></div><div style={row}><div><label style={lbl}>Entry Price *</label><input type="number" style={inp} value={f.entryPrice} onChange={e => set("entryPrice", e.target.value)} placeholder="e.g. 96500"/></div><div><label style={lbl}>Exit Price *</label><input type="number" style={inp} value={f.exitPrice} onChange={e => set("exitPrice", e.target.value)} placeholder="e.g. 98200"/></div></div><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}><div><label style={lbl}>Stop Loss</label><input type="number" style={inp} value={f.stopLoss} onChange={e => set("stopLoss", e.target.value)} placeholder="—"/></div><div><label style={lbl}>Take Profit</label><input type="number" style={inp} value={f.takeProfit} onChange={e => set("takeProfit", e.target.value)} placeholder="—"/></div><div><label style={lbl}>Size / Lots</label><input type="number" style={inp} value={f.size} onChange={e => set("size", e.target.value)} placeholder="1"/></div></div>
          {pnl !== null && (
            <div style={{ padding:"10px 14px", borderRadius:8, background: pnl.pnl>=0?"rgba(16,185,129,0.08)":"rgba(239,68,68,0.08)", border:`1px solid ${pnl.pnl>=0?"rgba(16,185,129,0.25)":"rgba(239,68,68,0.25)"}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}><span style={{ fontSize:11, color:"#6b7280" }}>Calculated PnL</span><div style={{ display:"flex", alignItems:"center", gap:14 }}><span style={{ fontSize:14, fontWeight:800, fontFamily:"monospace", color: pnl.pnl>=0?"#10b981":"#ef4444" }}>{pnl.pnl>=0?"+":""}{pnl.pnl.toFixed(4)}</span><span style={{ fontSize:11, fontFamily:"monospace", color: pnl.pnl>=0?"#10b981":"#ef4444" }}>{pnl.pct>=0?"+":""}{pnl.pct.toFixed(3)}%</span></div></div>
          )}
          <div style={row}><div><label style={lbl}>Trade Date</label><input type="datetime-local" style={inp} value={f.date} onChange={e => set("date", e.target.value)}/></div><div><label style={lbl}>Strategy</label><input list="strats-list" style={inp} value={f.strategy} onChange={e => set("strategy", e.target.value)} placeholder="e.g. Breakout"/><datalist id="strats-list">{(strategies ?? []).map(s =><option key={s} value={s}/>)}</datalist></div></div><div><label style={lbl}>Tags<span style={{ fontWeight:400, textTransform:"none" }}>(comma separated)</span></label><input style={inp} value={f.tags} onChange={e => set("tags", e.target.value)} placeholder="With Trend, FOMO, Clean Setup..."/></div><div><label style={lbl}>Notes</label><textarea style={{ ...inp, resize:"vertical", minHeight:72, fontFamily:"inherit", lineHeight:1.5 }} value={f.notes} onChange={e => set("notes", e.target.value)} placeholder="What happened? Why did you take this trade?"/></div><div><label style={lbl}>Chart Screenshot</label><div
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDraggingOver(true); }}
              onDragEnter={e => { e.preventDefault(); setDraggingOver(true); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDraggingOver(false); }}
              style={{
                padding: f.screenshot ? "8px" : "20px 16px",
                borderRadius: 8, cursor: "pointer", textAlign: "center",
                border: `2px dashed ${draggingOver ? "#6366f1" : f.screenshot ? "#2a2a3a" : "#2a2a3a"}`,
                background: draggingOver ? "rgba(99,102,241,0.06)" : "#1a1a24",
                transition: "all 0.15s",
                position: "relative",
              }}
            >
              {f.screenshot ? (
                <div style={{ position: "relative" }}><img src={f.screenshot} alt="screenshot" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 6, objectFit: "contain", display: "block" }}/>
                  {/* Drag-over overlay when already has image */}
                  {draggingOver && (
                    <div style={{ position: "absolute", inset: 0, borderRadius: 6, background: "rgba(99,102,241,0.15)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed #6366f1" }}><span style={{ fontSize: 12, fontWeight: 700, color: "#6366f1" }}>Drop to replace</span></div>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); set("screenshot", null); }}
                    style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: "50%", width: 24, height: 24, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}
                  ><X size={12}/></button></div>) : (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none" }}><div style={{ width: 40, height: 40, borderRadius: 10, background: draggingOver ? "rgba(99,102,241,0.15)" : "#2a2a3a", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}><Image size={18} style={{ color: draggingOver ? "#6366f1" : "#6b7280" }}/></div><div><div style={{ fontSize: 12, fontWeight: 600, color: draggingOver ? "#6366f1" : "#6b7280" }}>
                      {draggingOver ? "Drop image here" : "Drop image, click to browse, or ⌘V to paste"}
                    </div><div style={{ fontSize: 10, color: "#374151", marginTop: 3 }}>PNG, JPG, GIF, WebP</div></div></div>
              )}
            </div><input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImage}/></div>
          {err && <div style={{ padding:"9px 12px", borderRadius:8, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", fontSize:12, color:"#ef4444", display:"flex", alignItems:"center", gap:7 }}><AlertCircle size={12}/>{err}</div>}

          <div style={{ display:"flex", gap:10, paddingTop:4 }}><button onClick={onClose} style={{ flex:1, padding:"11px", borderRadius:10, border:"1px solid #2a2a3a", background:"transparent", color:"#6b7280", fontSize:13, fontWeight:600, cursor:"pointer" }}>Cancel</button><button onClick={submit} style={{ flex:2, padding:"11px", borderRadius:10, border:"none", background:"#6366f1", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 16px rgba(99,102,241,0.25)" }}>
              {initial ? "Save Changes" : "Log Trade"}
            </button></div></div></div></div>
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
  const lines = text.trim().split("\n").map(l =>l.split(","));
 if (lines.length< 2) return { trades: [], broker: null };
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

function CSVUploader({ onImport, onClose, initialTab = "csv" }) {
  // ── Tab state (CSV import vs. AI screenshot import) ──
  const [tab, setTab] = useState(initialTab === "ai" ? "ai" : "csv");

  // ── CSV flow state ──
  const [preview,   setPreview]   = useState(null);
  const [broker,    setBroker]    = useState(null);
  const [shots,     setShots]     = useState({});
  const [step,      setStep]      = useState("csv");
  const [error,     setError]     = useState("");
  const [dragIdx,   setDragIdx]   = useState(null);
  const fileRef   = useRef(null);
  const imgRefs   = useRef({});

  // ── AI screenshot flow state ──
  // aiImages: [{ id, name, dataUrl, mediaType, status: "idle"|"processing"|"done"|"error", trades:[{id,_selected,...}], error:"" }]
  const MAX_SHOTS = 20;
  const [aiImages,   setAiImages]   = useState([]);
  const [aiStep,     setAiStep]     = useState("upload"); // "upload" | "review"
  const [aiDragOver, setAiDragOver] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0, label: "" });
  const aiCancelRef = useRef(false);
  const aiFileRef = useRef(null);

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
    if (tab !== "csv" || step !== "screenshots" || !preview) return;
    const onPaste = (e) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const img = items.find(item => item.type.startsWith("image/"));
      if (!img) return;
      const firstEmpty = preview.find(t => !shots[t.id]);
      if (firstEmpty) loadShot(firstEmpty.id, img.getAsFile());
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [tab, step, preview, shots]); // eslint-disable-line react-hooks/exhaustive-deps

  const doImport = () => {
    onImport(preview.map(t => ({ ...t, screenshot: shots[t.id] ?? null })));
    onClose();
  };

  // ── AI screenshot helpers ──
  const SUPPORTED_IMG = /^image\/(png|jpe?g|webp)$/i;

  const addAiImages = (files) => {
    const list = Array.from(files ?? []).filter(f => SUPPORTED_IMG.test(f.type));
    if (!list.length) return;
    const remaining = MAX_SHOTS - aiImages.length;
    const accepted  = list.slice(0, Math.max(0, remaining));
    accepted.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        setAiImages(prev => prev.length >= MAX_SHOTS ? prev : [...prev, {
          id: `img_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
          name: file.name || "screenshot.png",
          dataUrl,
          mediaType: file.type || "image/png",
          status: "idle",
          trades: [],
          error: "",
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAiImage = (id) => setAiImages(prev => prev.filter(i => i.id !== id));

  // Paste support on AI tab upload step
  useEffect(() => {
    if (tab !== "ai" || aiStep !== "upload") return;
    const onPaste = (e) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imgs  = items.filter(i => i.type.startsWith("image/")).map(i => i.getAsFile()).filter(Boolean);
      if (imgs.length) addAiImages(imgs);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [tab, aiStep, aiImages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const analyseAi = async () => {
    if (aiProcessing) return;
    aiCancelRef.current = false;
    const queue = aiImages.filter(i => i.status === "idle" || i.status === "error");
    if (!queue.length) return;
    setAiProcessing(true);
    setAiProgress({ current: 0, total: queue.length, label: `Analysing screenshot 1 of ${queue.length}…` });

    for (let i = 0; i < queue.length; i++) {
      if (aiCancelRef.current) break;
      const img = queue[i];
      setAiProgress({ current: i, total: queue.length, label: `Analysing screenshot ${i + 1} of ${queue.length}…` });
      setAiImages(prev => prev.map(x => x.id === img.id ? { ...x, status: "processing", error: "", trades: [] } : x));

      try {
        const base64 = img.dataUrl.split(",")[1];
        const res = await fetch("/api/analyse-screenshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64, mediaType: img.mediaType }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
        const trades = (data.trades ?? (data.trade ? [data.trade] : [])).map(t => ({
          ...t,
          id: `shot_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
          _selected: true,
        }));
        if (!trades.length) throw new Error("No trades found in this screenshot");
        setAiImages(prev => prev.map(x => x.id === img.id ? { ...x, status: "done", trades } : x));
      } catch (e) {
        setAiImages(prev => prev.map(x => x.id === img.id ? { ...x, status: "error", error: e.message } : x));
      }

      setAiProgress({ current: i + 1, total: queue.length, label: `Analysing screenshot ${Math.min(i + 2, queue.length)} of ${queue.length}…` });
      if (i < queue.length - 1 && !aiCancelRef.current) {
        await new Promise(r => setTimeout(r, 500)); // rate-limit spacer
      }
    }

    setAiProcessing(false);
    setAiProgress({ current: 0, total: 0, label: "" });
    aiCancelRef.current = false;
    setAiStep("review");
  };

  const cancelAi = () => { aiCancelRef.current = true; };

  const toggleAiTrade = (imgId, tradeId) => {
    setAiImages(prev => prev.map(img => img.id !== imgId ? img : {
      ...img, trades: img.trades.map(t => t.id === tradeId ? { ...t, _selected: !t._selected } : t),
    }));
  };

  const allAiTrades = aiImages.flatMap(i => i.trades.map(t => ({ ...t, _imgId: i.id, _imgDataUrl: i.dataUrl })));
  const selectedAiTrades = allAiTrades.filter(t => t._selected);

  const setAllAiSelected = (val) => {
    setAiImages(prev => prev.map(img => ({
      ...img, trades: img.trades.map(t => ({ ...t, _selected: val })),
    })));
  };

  const editAiTrade = (imgId, tradeId, field, value) => {
    setAiImages(prev => prev.map(img => img.id !== imgId ? img : {
      ...img, trades: img.trades.map(t => t.id === tradeId ? { ...t, [field]: value } : t),
    }));
  };

  const doAiImport = () => {
    const toImport = selectedAiTrades.map(({ _selected, _imgId, _imgDataUrl, confidence, ...t }) => ({
      ...t,
      screenshot: _imgDataUrl,
      source: "screenshot",
      tags: ["Screenshot Import"],
      _aiConfidence: confidence,
    }));
    onImport(toImport);
    onClose();
  };

  const shotCount = Object.keys(shots).length;
  const aiDoneCount = aiImages.filter(i => i.status === "done").length;
  const aiErrorCount = aiImages.filter(i => i.status === "error").length;
  const th = { padding:"8px 12px", fontSize:9, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", borderBottom:"1px solid rgba(30,41,59,0.8)" };
  const td = { padding:"8px 12px", fontSize:11, borderBottom:"1px solid rgba(30,41,59,0.5)", color:"#9ca3af", fontFamily:"monospace" };
  const aiInp = { padding:"5px 8px", borderRadius:6, background:"#111118", border:"1px solid #2a2a3a", fontSize:11, color:"#ffffff", outline:"none", width:"100%", boxSizing:"border-box" };

  const confidenceBadge = (c) => {
    const conf = (c || "MEDIUM").toUpperCase();
    const palette = conf === "HIGH"
      ? { bg:"rgba(16,185,129,0.12)", fg:"#10b981", br:"rgba(16,185,129,0.25)" }
      : conf === "LOW"
      ? { bg:"rgba(239,68,68,0.12)",  fg:"#ef4444", br:"rgba(239,68,68,0.25)" }
      : { bg:"rgba(245,158,11,0.12)", fg:"#f59e0b", br:"rgba(245,158,11,0.25)" };
    return (
      <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:10, background:palette.bg, color:palette.fg, border:`1px solid ${palette.br}`, letterSpacing:"0.04em" }}>{conf}</span>
    );
  };

  const modalWidth = tab === "ai"
    ? (aiStep === "review" ? 920 : 680)
    : (step === "screenshots" ? 800 : 720);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:80, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}><div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)" }}/><div style={{ position:"relative", zIndex:10, width:"100%", maxWidth: modalWidth, maxHeight:"92vh", borderRadius:16, border:"1px solid #2a2a3a", background:"#111118", boxShadow:"0 25px 60px rgba(0,0,0,0.6)", display:"flex", flexDirection:"column", transition:"max-width 0.2s" }}>

        {/* Header */}
        <div style={{ padding:"14px 20px 0", borderBottom:"1px solid #2a2a3a", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#ffffff", display:"flex", alignItems:"center", gap:8 }}>
              {tab === "csv"
                ? (step === "csv" ? <><Upload size={15} style={{ color:"#6366f1" }}/>Import Trades</> : <><Image size={15} style={{ color:"#6366f1" }}/>Attach Screenshots<span style={{ fontSize:11, color:"#6b7280", fontWeight:400 }}>(optional)</span></>)
                : <><Sparkles size={15} style={{ color:"#6366f1" }}/>Import Trades<span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:10, background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.25)", color:"#6366f1", letterSpacing:"0.04em" }}>AI</span></>
              }
            </div>
            <button onClick={onClose} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer" }}><X size={16}/></button>
          </div>

          {/* Tab bar */}
          <div style={{ display:"flex", gap:4 }}>
            {[
              { id:"csv", icon:<FileText size={12}/>, label:"CSV Import" },
              { id:"ai",  icon:<Sparkles size={12}/>, label:"Screenshot Import" },
            ].map(t => {
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 14px", border:"none", background:"transparent", color:active?"#ffffff":"#6b7280", fontSize:12, fontWeight:active?700:600, cursor:"pointer", borderBottom:`2px solid ${active?"var(--accent)":"transparent"}`, marginBottom:-1, transition:"all 0.15s" }}>
                  {t.icon}{t.label}
                  {t.id === "ai" && <span style={{ fontSize:8, fontWeight:800, padding:"1px 5px", borderRadius:8, background:"linear-gradient(135deg,#6366f1,#a855f7)", color:"#fff", letterSpacing:"0.06em" }}>NEW</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── CSV TAB ── */}
        {tab === "csv" && step === "csv" && (
          <div style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:16 }}><div style={{ padding:"12px 16px", borderRadius:10, background:"rgba(99,102,241,0.05)", border:"1px solid rgba(99,102,241,0.15)", fontSize:11, color:"#6b7280", lineHeight:1.7 }}><strong style={{ color:"#6366f1" }}>Supported brokers:</strong> MT4/MT5, TradingView, cTrader, Interactive Brokers, Oanda, and any CSV-exporting platform.<br/><strong style={{ color:"#9ca3af" }}>Required columns:</strong> pair/symbol, entry price, exit price, direction/type.</div>
            {!preview && (
              <div onClick={() => fileRef.current?.click()} style={{ padding:"40px 20px", borderRadius:12, border:"2px dashed #2a2a3a", cursor:"pointer", textAlign:"center", background:"#1a1a24" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor="#6366f1"; e.currentTarget.style.background="rgba(99,102,241,0.04)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="#2a2a3a"; e.currentTarget.style.background="#1a1a24"; }}
                onDrop={e => { e.preventDefault(); fileRef.current.files = e.dataTransfer.files; handleFile({ target: fileRef.current }); }}
                onDragOver={e => e.preventDefault()}><FileText size={32} style={{ color:"#374151", marginBottom:12 }}/><div style={{ fontSize:13, color:"#6b7280", marginBottom:6 }}>Drop CSV file here or click to browse</div><div style={{ fontSize:11, color:"#374151" }}>Supports .csv files up to 5MB</div></div>
            )}
            <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display:"none" }} onChange={handleFile}/>
            {error && <div style={{ padding:"10px 14px", borderRadius:8, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", fontSize:12, color:"#ef4444", display:"flex", alignItems:"center", gap:7 }}><AlertCircle size={12}/>{error}</div>}
            {preview && (
              <div>
                {broker && (
                  <div style={{ marginBottom:10, padding:"10px 14px", borderRadius:9, background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.3)", display:"flex", alignItems:"center", gap:8 }}><span style={{ fontSize:16 }}></span><div><div style={{ fontSize:12, fontWeight:700, color:"#10b981" }}>Broker detected: {broker.name}</div><div style={{ fontSize:10, color:"#3a6a8a", marginTop:1 }}>These trades will be tagged as<strong style={{ color:"#10b981" }}> verified broker imports</strong>.</div></div></div>
                )}
                {!broker && (
                  <div style={{ marginBottom:10, padding:"8px 12px", borderRadius:9, background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.2)", display:"flex", alignItems:"center", gap:8 }}><span style={{ fontSize:14 }}>️</span><div style={{ fontSize:11, color:"#6b7280" }}>Broker not recognised — trades imported as<strong> manual</strong>. Supported brokers: Tradovate, Apex, TopstepX, NinjaTrader, TradeLocker, IBKR.</div></div>
                )}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}><div style={{ fontSize:12, color:"#9ca3af" }}><span style={{ fontWeight:700, color:"#10b981" }}>{preview.length} </span>trades found</div><button onClick={() => { setPreview(null); setBroker(null); setShots({}); setError(""); }} style={{ fontSize:11, color:"#6b7280", background:"none", border:"none", cursor:"pointer" }}>← Re-upload</button></div><div style={{ borderRadius:10, border:"1px solid #2a2a3a", overflow:"auto", maxHeight:240 }}><table style={{ width:"100%", borderCollapse:"collapse", minWidth:540 }}><thead><tr>{["Pair","Type","Entry","Exit","PnL","Date","Strategy"].map(h =><th key={h} style={th}>{h}</th>)}</tr></thead><tbody>
                      {preview.slice(0,20).map((t,i) =>(<tr key={i}><td style={{ ...td, fontWeight:700, color:"#ffffff" }}>{t.pair}</td><td style={{ ...td, color:t.type==="long"?"#10b981":"#ef4444" }}>{t.type.toUpperCase()}</td><td style={td}>{t.entryPrice}</td><td style={td}>{t.exitPrice}</td><td style={{ ...td, color:(t.pnl??0)>=0?"#10b981":"#ef4444", fontWeight:700 }}>{(t.pnl??0)>=0?"+":""}{(t.pnl??0).toFixed(4)}</td><td style={td}>{new Date(t.date).toLocaleDateString()}</td><td style={td}>{t.strategy}</td></tr>
                      ))}
                      {preview.length >20 &&<tr><td colSpan={7} style={{ ...td, textAlign:"center", color:"#6b7280" }}>...and {preview.length-20} more trades</td></tr>}
                    </tbody></table></div></div>
            )}
          </div>
        )}

        {tab === "csv" && step === "screenshots" && preview && (
          <div style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:12 }}><div style={{ padding:"10px 14px", borderRadius:9, background:"rgba(99,102,241,0.05)", border:"1px solid rgba(99,102,241,0.15)", fontSize:11, color:"#6b7280", lineHeight:1.6 }}>Drop, click, or<strong style={{ color:"#9ca3af" }}> ⌘V paste </strong>a screenshot onto each trade row. Paste fills the next empty slot automatically.{shotCount >0 &&<span style={{ color:"#10b981", marginLeft:6 }}>✓ {shotCount} attached</span>}
            </div><div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {preview.map((t, idx) => {
                const shot = shots[t.id];
                const isDrag = dragIdx === t.id;
                const w = (t.pnl??0)>=0;
                return (<div key={t.id}
                    onDrop={e => handleRowDrop(t.id, e)}
                    onDragOver={e => { e.preventDefault(); setDragIdx(t.id); }}
                    onDragEnter={e => { e.preventDefault(); setDragIdx(t.id); }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragIdx(null); }}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:9, border:`1px solid ${isDrag?"rgba(99,102,241,0.5)":shot?"rgba(52,211,153,0.25)":"#2a2a3a"}`, background:isDrag?"rgba(99,102,241,0.05)":shot?"rgba(52,211,153,0.03)":"#1a1a24", transition:"all 0.12s" }}><div style={{ fontSize:10, fontFamily:"monospace", color:"#374151", width:20, textAlign:"center", flexShrink:0 }}>{idx+1}</div><div style={{ flex:1, minWidth:0 }}><div style={{ display:"flex", alignItems:"center", gap:6 }}><span style={{ fontSize:11, fontWeight:700, color:"#ffffff" }}>{t.pair}</span><span style={{ fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:4, background:t.type==="long"?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)", color:t.type==="long"?"#10b981":"#ef4444" }}>{t.type.toUpperCase()}</span><span style={{ fontSize:10, fontFamily:"monospace", color:w?"#10b981":"#ef4444" }}>{w?"+":""}{(t.pnl??0).toFixed(2)}</span></div><div style={{ fontSize:9, color:"#374151", marginTop:2 }}>{t.strategy} · {new Date(t.date).toLocaleDateString()}</div></div>
                    {shot ? (
                      <div style={{ position:"relative", flexShrink:0 }}><img src={shot} alt="shot" style={{ width:72, height:48, objectFit:"cover", borderRadius:6, border:"1px solid rgba(52,211,153,0.3)", display:"block" }}/><button onClick={() => setShots(prev => { const n={...prev}; delete n[t.id]; return n; })}
                          style={{ position:"absolute", top:-6, right:-6, width:18, height:18, borderRadius:"50%", background:"rgba(239,68,68,0.9)", border:"none", cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}><X size={9}/></button></div>) : (<button onClick={() => imgRefs.current[t.id]?.click()}
                        style={{ width:72, height:48, flexShrink:0, borderRadius:6, border:`2px dashed ${isDrag?"#6366f1":"#2a2a3a"}`, background:isDrag?"rgba(99,102,241,0.08)":"transparent", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3 }}><Image size={12} style={{ color:isDrag?"#6366f1":"#374151" }}/><span style={{ fontSize:8, color:isDrag?"#6366f1":"#374151" }}>{isDrag?"Drop":"Add"}</span></button>
                    )}
                    <input ref={el => imgRefs.current[t.id] = el} type="file" accept="image/*" style={{ display:"none" }} onChange={e => handleImgInput(t.id, e)}/></div>
                );
              })}
            </div></div>
        )}

        {/* ── AI SCREENSHOT TAB ── */}
        {tab === "ai" && aiStep === "upload" && (
          <div style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ padding:"10px 14px", borderRadius:9, background:"linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.05))", border:"1px solid rgba(99,102,241,0.25)", fontSize:11, color:"#9ca3af", lineHeight:1.6, display:"flex", alignItems:"center", gap:10 }}>
              <Sparkles size={16} style={{ color:"#a855f7", flexShrink:0 }}/>
              <span>Drop up to <strong style={{ color:"#ffffff" }}>{MAX_SHOTS}</strong> chart screenshots. Claude reads each one and extracts symbol, direction, entry/exit, and PnL. Review and edit before importing.</span>
            </div>

            {/* Drop zone */}
            <div
              onClick={() => !aiProcessing && aiFileRef.current?.click()}
              onDrop={e => { e.preventDefault(); setAiDragOver(false); addAiImages(e.dataTransfer.files); }}
              onDragOver={e => { e.preventDefault(); setAiDragOver(true); }}
              onDragEnter={e => { e.preventDefault(); setAiDragOver(true); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setAiDragOver(false); }}
              style={{ borderRadius:14, border:`2px dashed ${aiDragOver?"#6366f1":"rgba(99,102,241,0.35)"}`, background:aiDragOver?"rgba(99,102,241,0.08)":"#0f0f17", cursor: aiProcessing ? "not-allowed" : "pointer", padding:"36px 24px", textAlign:"center", transition:"all 0.15s", opacity:aiProcessing?0.5:1 }}
            >
              <div style={{ pointerEvents:"none", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
                <div style={{ width:54, height:54, borderRadius:14, background: aiDragOver ? "rgba(99,102,241,0.2)" : "linear-gradient(135deg,#1a1a24,#23232f)", border:"1px solid rgba(99,102,241,0.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Upload size={24} style={{ color: aiDragOver?"#a5b4fc":"#6366f1" }}/>
                </div>
                <div style={{ fontSize:14, fontWeight:700, color:aiDragOver?"#a5b4fc":"#ffffff" }}>
                  {aiDragOver ? "Drop your screenshots" : "Drop your trade screenshots here"}
                </div>
                <div style={{ fontSize:11, color:"#6b7280" }}>or <span style={{ color:"#6366f1", fontWeight:600 }}>click to browse</span> · <span style={{ color:"#9ca3af" }}>⌘V to paste</span></div>
                <div style={{ fontSize:10, color:"#374151", marginTop:2 }}>Multiple files at once · PNG, JPG, JPEG, WebP · Max {MAX_SHOTS}</div>
              </div>
            </div>
            <input ref={aiFileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" multiple style={{ display:"none" }} onChange={e => { addAiImages(e.target.files); e.target.value = ""; }}/>

            {/* Count + thumbnail grid */}
            {aiImages.length > 0 && (
              <>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ fontSize:12, color:"#9ca3af" }}>
                    <strong style={{ color:"#ffffff" }}>{aiImages.length}</strong> screenshot{aiImages.length!==1?"s":""} selected
                    {aiImages.length >= MAX_SHOTS && <span style={{ marginLeft:8, fontSize:10, color:"#f59e0b" }}>· Max reached</span>}
                  </div>
                  <button onClick={() => setAiImages([])} disabled={aiProcessing} style={{ fontSize:11, color:"#6b7280", background:"none", border:"none", cursor: aiProcessing ? "not-allowed" : "pointer" }}>Clear all</button>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:10 }}>
                  {aiImages.map(img => (
                    <div key={img.id} style={{ position:"relative", borderRadius:10, overflow:"hidden", border:`1px solid ${img.status==="done"?"rgba(16,185,129,0.4)":img.status==="error"?"rgba(239,68,68,0.4)":img.status==="processing"?"rgba(99,102,241,0.5)":"#2a2a3a"}`, background:"#0f0f17" }}>
                      <img src={img.dataUrl} alt="" style={{ width:"100%", height:88, objectFit:"cover", display:"block" }}/>
                      {(img.status === "processing" || img.status === "done" || img.status === "error") && (
                        <div style={{ position:"absolute", top:0, left:0, right:0, height:88, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.5)" }}>
                          {img.status === "processing" && <span style={{ display:"inline-block", width:22, height:22, border:"2px solid rgba(255,255,255,0.18)", borderTopColor:"#6366f1", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>}
                          {img.status === "done"       && <Check size={22} style={{ color:"#10b981" }}/>}
                          {img.status === "error"      && <AlertCircle size={22} style={{ color:"#ef4444" }}/>}
                        </div>
                      )}
                      <div style={{ padding:"5px 8px", fontSize:9, color:"#6b7280", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }} title={img.name}>{img.name}</div>
                      {!aiProcessing && (
                        <button onClick={(e) => { e.stopPropagation(); removeAiImage(img.id); }} aria-label="Remove screenshot"
                          style={{ position:"absolute", top:5, right:5, width:20, height:20, borderRadius:"50%", background:"rgba(0,0,0,0.7)", border:"1px solid rgba(255,255,255,0.15)", cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}><X size={11}/></button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Progress bar (during processing) */}
            {aiProcessing && aiProgress.total > 0 && (
              <div style={{ padding:"14px 16px", borderRadius:12, background:"#0f0f17", border:"1px solid rgba(99,102,241,0.3)", display:"flex", flexDirection:"column", gap:9 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:11, color:"#9ca3af" }}>
                  <span style={{ display:"flex", alignItems:"center", gap:7 }}>
                    <span style={{ display:"inline-block", width:11, height:11, border:"2px solid #374151", borderTopColor:"#6366f1", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
                    <span style={{ color:"#ffffff", fontWeight:600 }}>{aiProgress.label}</span>
                  </span>
                  <span style={{ fontFamily:"monospace", color:"#6366f1", fontWeight:700 }}>{Math.round((aiProgress.current / aiProgress.total) * 100)}%</span>
                </div>
                <div style={{ height:6, borderRadius:6, background:"#1a1a24", overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${(aiProgress.current / aiProgress.total) * 100}%`, background:"linear-gradient(90deg,#6366f1,#a855f7)", transition:"width 0.25s ease", borderRadius:6 }}/>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "ai" && aiStep === "review" && (
          <div style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ padding:"10px 14px", borderRadius:9, background:"rgba(99,102,241,0.06)", border:"1px solid rgba(99,102,241,0.2)", fontSize:11, color:"#9ca3af", lineHeight:1.6, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
              <span>
                <strong style={{ color:"#6366f1" }}>{allAiTrades.length} trade{allAiTrades.length!==1?"s":""} found</strong>
                {" "}across {aiDoneCount} screenshot{aiDoneCount!==1?"s":""}.{aiErrorCount > 0 && <span style={{ color:"#ef4444", marginLeft:6 }}>{aiErrorCount} failed.</span>} Edit any field inline before importing.
              </span>
              <span style={{ display:"flex", gap:6 }}>
                <button onClick={() => setAllAiSelected(true)}  style={{ fontSize:10, padding:"4px 9px", borderRadius:6, border:"1px solid #2a2a3a", background:"transparent", color:"#9ca3af", cursor:"pointer", fontWeight:600 }}>Select all</button>
                <button onClick={() => setAllAiSelected(false)} style={{ fontSize:10, padding:"4px 9px", borderRadius:6, border:"1px solid #2a2a3a", background:"transparent", color:"#9ca3af", cursor:"pointer", fontWeight:600 }}>Deselect all</button>
              </span>
            </div>

            {/* Failed images banner */}
            {aiErrorCount > 0 && (
              <div style={{ padding:"8px 12px", borderRadius:8, background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.2)", fontSize:11, color:"#ef4444", display:"flex", alignItems:"center", gap:7 }}>
                <AlertCircle size={12}/> {aiErrorCount} screenshot{aiErrorCount!==1?"s":""} couldn't be read. Click <button onClick={() => setAiStep("upload")} style={{ background:"none", border:"none", color:"#ef4444", textDecoration:"underline", cursor:"pointer", fontSize:11, padding:0 }}>back</button> to retry.
              </div>
            )}

            {/* Trade table */}
            <div style={{ borderRadius:11, border:"1px solid #2a2a3a", overflow:"hidden", background:"#0f0f17" }}>
              <div style={{ display:"grid", gridTemplateColumns:"34px 70px 1.2fr 0.8fr 1fr 1fr 0.9fr 0.9fr", gap:8, padding:"9px 12px", borderBottom:"1px solid #2a2a3a", background:"#13131c", fontSize:9, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.08em" }}>
                <span></span><span>Shot</span><span>Symbol</span><span>Dir</span><span>Entry</span><span>Exit</span><span>PnL</span><span>Conf</span>
              </div>

              {allAiTrades.length === 0 && (
                <div style={{ padding:"24px 16px", textAlign:"center", fontSize:12, color:"#6b7280" }}>No trades extracted. Try different screenshots.</div>
              )}

              {allAiTrades.map(t => {
                const isLow = (t.confidence || "").toUpperCase() === "LOW";
                return (
                  <div key={t.id} style={{ display:"grid", gridTemplateColumns:"34px 70px 1.2fr 0.8fr 1fr 1fr 0.9fr 0.9fr", gap:8, padding:"9px 12px", alignItems:"center", borderBottom:"1px solid rgba(30,41,59,0.5)", background: isLow ? "rgba(245,158,11,0.04)" : t._selected ? "transparent" : "rgba(30,30,42,0.4)", opacity: t._selected ? 1 : 0.5, transition:"all 0.12s" }}>
                    <input type="checkbox" checked={t._selected} onChange={() => toggleAiTrade(t._imgId, t.id)} style={{ cursor:"pointer", accentColor:"#6366f1", width:14, height:14 }}/>
                    <img src={t._imgDataUrl} alt="" style={{ width:60, height:38, objectFit:"cover", borderRadius:5, border:"1px solid #2a2a3a" }}/>
                    <input value={t.pair ?? ""} onChange={e => editAiTrade(t._imgId, t.id, "pair", e.target.value)} style={{ ...aiInp, fontWeight:700 }}/>
                    <select value={t.type ?? "long"} onChange={e => editAiTrade(t._imgId, t.id, "type", e.target.value)} style={{ ...aiInp, cursor:"pointer", color:(t.type==="short")?"#ef4444":"#10b981", fontWeight:700 }}>
                      <option value="long">LONG</option><option value="short">SHORT</option>
                    </select>
                    <input value={t.entryPrice ?? ""} onChange={e => editAiTrade(t._imgId, t.id, "entryPrice", e.target.value === "" ? null : parseFloat(e.target.value) || e.target.value)} style={aiInp}/>
                    <input value={t.exitPrice ?? ""}  onChange={e => editAiTrade(t._imgId, t.id, "exitPrice",  e.target.value === "" ? null : parseFloat(e.target.value) || e.target.value)} style={aiInp}/>
                    <input value={t.pnl ?? ""}        onChange={e => editAiTrade(t._imgId, t.id, "pnl",        e.target.value === "" ? null : parseFloat(e.target.value) || e.target.value)} style={{ ...aiInp, color:(parseFloat(t.pnl)||0)>=0?"#10b981":"#ef4444", fontWeight:700 }}/>
                    <div style={{ display:"flex", alignItems:"center" }}>{confidenceBadge(t.confidence)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding:"14px 20px", borderTop:"1px solid #2a2a3a", display:"flex", gap:10, flexShrink:0 }}>
          {tab === "csv" && step === "csv" && !preview && (
            <button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid #2a2a3a", background:"transparent", color:"#6b7280", fontSize:12, fontWeight:600, cursor:"pointer" }}>Cancel</button>
          )}
          {tab === "csv" && step === "csv" && preview && <><button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid #2a2a3a", background:"transparent", color:"#6b7280", fontSize:12, fontWeight:600, cursor:"pointer" }}>Cancel</button><button onClick={() => setStep("screenshots")} style={{ flex:2, padding:"10px", borderRadius:9, border:"none", background:"#6366f1", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>Next — Add Screenshots →</button></>}
          {tab === "csv" && step === "screenshots" && <><button onClick={() => setStep("csv")} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid #2a2a3a", background:"transparent", color:"#6b7280", fontSize:12, fontWeight:600, cursor:"pointer" }}>← Back</button><button onClick={doImport} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid #2a2a3a", background:"#1a1a24", color:"#9ca3af", fontSize:12, fontWeight:600, cursor:"pointer" }}>Skip & Import</button><button onClick={doImport} style={{ flex:2, padding:"10px", borderRadius:9, border:"none", background:"#6366f1", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 16px rgba(99,102,241,0.2)" }}>
              Import {preview.length} Trades{shotCount > 0 ? ` + ${shotCount} Screenshot${shotCount!==1?"s":""}` : ""}
            </button></>}

          {tab === "ai" && aiStep === "upload" && (
            <>
              {aiProcessing ? (
                <button onClick={cancelAi} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid rgba(239,68,68,0.4)", background:"rgba(239,68,68,0.08)", color:"#ef4444", fontSize:12, fontWeight:700, cursor:"pointer" }}>Cancel Analysis</button>
              ) : (
                <button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid #2a2a3a", background:"transparent", color:"#6b7280", fontSize:12, fontWeight:600, cursor:"pointer" }}>Cancel</button>
              )}
              <button
                onClick={analyseAi}
                disabled={!aiImages.length || aiProcessing}
                style={{
                  flex:3, padding:"10px", borderRadius:9, border:"none",
                  background: !aiImages.length || aiProcessing ? "#2a2a3a" : "linear-gradient(135deg,#6366f1,#a855f7)",
                  color:      !aiImages.length || aiProcessing ? "#6b7280" : "#fff",
                  fontSize:12, fontWeight:700,
                  cursor: !aiImages.length || aiProcessing ? "not-allowed" : "pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:7,
                  boxShadow: !aiImages.length || aiProcessing ? "none" : "0 4px 16px rgba(99,102,241,0.25)",
                }}>
                {aiProcessing
                  ? <>Analysing… {aiProgress.current}/{aiProgress.total}</>
                  : <><Sparkles size={13}/>Analyze {aiImages.length || ""} Screenshot{aiImages.length===1?"":"s"} with AI</>}
              </button>
            </>
          )}

          {tab === "ai" && aiStep === "review" && (
            <>
              <button onClick={() => setAiStep("upload")} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid #2a2a3a", background:"transparent", color:"#6b7280", fontSize:12, fontWeight:600, cursor:"pointer" }}>← Back</button>
              <button
                onClick={doAiImport}
                disabled={!selectedAiTrades.length}
                style={{
                  flex:3, padding:"10px", borderRadius:9, border:"none",
                  background: selectedAiTrades.length ? "linear-gradient(135deg,#6366f1,#a855f7)" : "#2a2a3a",
                  color:      selectedAiTrades.length ? "#fff" : "#6b7280",
                  fontSize:12, fontWeight:700,
                  cursor:     selectedAiTrades.length ? "pointer" : "not-allowed",
                  boxShadow:  selectedAiTrades.length ? "0 4px 16px rgba(99,102,241,0.25)" : "none",
                }}>
                Import {selectedAiTrades.length} Trade{selectedAiTrades.length===1?"":"s"}
              </button>
            </>
          )}
        </div></div></div>
  );
}

function ImportHub({ onManual, onCSV, onScreenshot, onClose, accountType }) {
  const isRestricted = accountType === "funded" || accountType === "real";

  const integrations = [
    {
      id:"manual", icon:<Zap size={20}/>, label:"Manual Entry",
      desc: isRestricted ? " Not allowed on funded/real accounts — import from broker only" : "Log a trade you've taken on any platform",
      color:"#6366f1", available:!isRestricted,
      action:() => { onClose(); onManual(); },
      blocked: isRestricted,
    },
    {
      id:"screenshot", icon:<Sparkles size={20}/>, label:"AI Screenshot",
      desc: isRestricted ? " Not allowed on funded/real accounts — import from broker only" : "Drop a chart screenshot — Claude reads the trade data for you",
      color:"#6366f1", available:!isRestricted,
      action:() => { onClose(); onScreenshot(); },
      blocked: isRestricted,
    },
    {
      id:"csv", icon:<FileText size={20}/>, label:"Broker CSV Import",
      desc: isRestricted ? " Import your broker CSV — Tradovate, Apex, TopstepX, IBKR" : "Upload MT4/MT5, TradingView, cTrader, IBKR export",
      color:"#10b981", available:true,
      action:() => { onClose(); onCSV(); },
      blocked: false,
    },
    { id:"webhook", icon:<Webhook size={20}/>,  label:"Webhook Ingestion", desc:"Auto-import via HTTP webhook (TradingView alerts, etc.)", color:"#f59e0b", available:false, comingSoon:true },
    { id:"api",     icon:<Link2 size={20}/>,    label:"Broker API",        desc:"Connect directly to Tradovate, IBKR, Binance",          color:"#a5b4fc", available:false, comingSoon:true },
    { id:"mt4",     icon:<Download size={20}/>, label:"MT4 / MT5 Plugin",  desc:"Install EA plugin to auto-sync trades from MetaTrader",  color:"#f59e0b", available:false, comingSoon:true },
  ];

  return (
    <div style={{ position:"fixed", inset:0, zIndex:80, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}><div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)" }}/><div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:580, borderRadius:16, border:"1px solid #2a2a3a", background:"#111118", boxShadow:"0 25px 60px rgba(0,0,0,0.6)", overflow:"hidden" }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid #2a2a3a" }}><div style={{ fontSize:14, fontWeight:700, color:"#ffffff", display:"flex", alignItems:"center", gap:8 }}><Upload size={15} style={{ color:"#6366f1" }}/> Add Trades
            {isRestricted && <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10, background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.2)", color:"#ef4444" }}>Broker imports only</span>}
          </div><button onClick={onClose} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer" }}><X size={16}/></button></div>

        {isRestricted && (
          <div style={{ margin:"12px 20px 0", padding:"10px 14px", borderRadius:10, background:"rgba(248,113,113,0.06)", border:"1px solid rgba(248,113,113,0.2)", fontSize:11, color:"#ef4444", lineHeight:1.6 }}>You're on a<strong>{accountType === "funded" ? "Funded" : "Real"} Account</strong>. Manual entry and screenshot imports are disabled — all trades must come from your broker CSV to ensure accuracy.</div>
        )}

        <div style={{ padding:20, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {integrations.map(i =>(<button key={i.id} onClick={i.available && !i.blocked ? i.action : undefined}
              disabled={!i.available || i.blocked}
              style={{ padding:"16px", borderRadius:12, border:`1px solid ${i.available&&!i.blocked?i.color+"30":"#2a2a3a"}`, background: i.available&&!i.blocked?i.color+"08":"#1a1a24", textAlign:"left", cursor: i.available&&!i.blocked?"pointer":"not-allowed", opacity: i.available&&!i.blocked?1:0.45, transition:"all 0.15s" }}><div style={{ color:i.blocked?"#374151":i.color, marginBottom:8 }}>{i.icon}</div><div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}><span style={{ fontSize:12, fontWeight:700, color: i.available&&!i.blocked?"#ffffff":"#6b7280" }}>{i.label}</span>
                {i.comingSoon && <span style={{ fontSize:8, fontWeight:700, color:"#f59e0b", background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.2)", padding:"1px 6px", borderRadius:10 }}>SOON</span>}
                {i.blocked && <span style={{ fontSize:8, fontWeight:700, color:"#ef4444", background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.2)", padding:"1px 6px", borderRadius:10 }}>BLOCKED</span>}
              </div><div style={{ fontSize:10, color: i.blocked?"#ef4444":"#6b7280", lineHeight:1.5 }}>{i.desc}</div></button>
          ))}
        </div><div style={{ padding:"12px 20px", borderTop:"1px solid #2a2a3a", fontSize:10, color:"#374151", textAlign:"center" }}>
          {isRestricted ? "Funded and real accounts require broker CSV imports for trade verification" : "Nexyru never connects to live brokers. All trades are imported after execution."}
        </div></div></div>
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
    { id:"calm",      label:" Calm",      color:"#10b981" },
    { id:"confident", label:" Confident",  color:"#6366f1" },
    { id:"fomo",      label:" FOMO",       color:"#f59e0b" },
    { id:"fear",      label:" Fear",       color:"#f59e0b" },
    { id:"revenge",   label:" Revenge",    color:"#ef4444" },
  ];

  const lbl = { display:"block", fontSize:9, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:5 };
  const inp = { width:"100%", padding:"8px 10px", borderRadius:7, boxSizing:"border-box", background:"#111118", border:"1px solid #2a2a3a", fontSize:12, color:"#ffffff", outline:"none" };

  const EMOTION_LABELS = { calm:" Calm", confident:" Confident", fomo:" FOMO", fear:" Fear", revenge:" Revenge" };

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
    <div style={{ position:"fixed", inset:0, zIndex:90, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}><div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)" }}/><div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:480, maxHeight:"90vh", borderRadius:16, border:"1px solid #2a2a3a", background:"#111118", boxShadow:"0 25px 60px rgba(0,0,0,0.6)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* Sticky header */}
        <div style={{ display:"flex", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid #2a2a3a", flexShrink:0 }}><div><div style={{ fontSize:16, fontWeight:800, color:"#ffffff" }}>{trade.pair}</div><div style={{ fontSize:11, color:"#6b7280", marginTop:3 }}>{new Date(trade.date).toLocaleString()} · {trade.source}</div></div><button onClick={onClose} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer" }}><X size={18}/></button></div>
        {/* Scrollable content */}
        <div style={{ flex:1, overflowY:"auto", padding:"20px" }}>
        {screenshot && <img src={screenshot} alt="" style={{ width:"100%", borderRadius:8, marginBottom:16, maxHeight:200, objectFit:"contain", background:"#1a1a24" }}/>}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
          {[
            { label:"Direction", val: trade.type?.toUpperCase(), color: trade.type==="long"?"#10b981":"#ef4444" },
            { label:"Strategy",  val: trade.strategy, color:"#9ca3af" },
            { label:"Entry",     val: trade.entryPrice, color:"#9ca3af" },
            { label:"Exit",      val: trade.exitPrice,  color:"#9ca3af" },
            { label:"SL",        val: trade.stopLoss  ?? "—", color:"#ef4444" },
            { label:"TP",        val: trade.takeProfit ?? "—", color:"#10b981" },
            { label:"Size",      val: trade.size, color:"#9ca3af" },
            { label:"PnL",       val: `${(trade.pnl??0)>=0?"+":""}${(trade.pnl??0).toFixed(4)}`, color: (trade.pnl??0)>=0?"#10b981":"#ef4444" },
          ].map(({ label,val,color }) =>(<div key={label} style={{ background:"#1a1a24", borderRadius:8, padding:"10px 12px" }}><div style={{ fontSize:9, color:"#374151", textTransform:"uppercase", marginBottom:4 }}>{label}</div><div style={{ fontSize:13, fontWeight:700, fontFamily:"monospace", color }}>{val}</div></div>
          ))}
        </div>
        {trade.notes && <div style={{ padding:"12px", borderRadius:8, background:"#1a1a24", fontSize:12, color:"#6b7280", lineHeight:1.6, marginBottom:12 }}>{trade.notes}</div>}
        {(trade.tags??[]).length >0 &&<div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>{trade.tags.map(tag =><span key={tag} style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.2)", color:"#6366f1" }}>{tag}</span>)}</div>}

        {/* ── Trade Review ─────────────────────────────────── */}
        {!reviewing ? (
          <div style={{ borderRadius:10, border:"1px solid rgba(99,102,241,0.2)", background:"rgba(99,102,241,0.04)", padding:"12px 14px" }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}><div style={{ fontSize:11, fontWeight:700, color:"#6366f1", display:"flex", alignItems:"center", gap:6 }}>Trade Review</div><button onClick={() => setReviewing(true)} style={{ padding:"5px 12px", borderRadius:7, border:"1px solid rgba(99,102,241,0.3)", background:"rgba(99,102,241,0.08)", color:"#6366f1", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                {tradeNotes ? "️ Edit Review" : "️ Write Review"}
              </button></div>

            {/* Show existing review summary */}
            {tradeNotes ? (
              <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:8 }}>
                {tradeNotes.notes && <div style={{ fontSize:12, color:"#9ca3af", lineHeight:1.6 }}>{tradeNotes.notes}</div>}
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {tradeNotes.emotion && (
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"rgba(99,102,241,0.1)", color:"#6366f1", border:"1px solid rgba(99,102,241,0.2)" }}>
                      {EMOTION_LABELS[tradeNotes.emotion] ?? tradeNotes.emotion}
                    </span>
                  )}
                  {tradeNotes.confidence && (
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"rgba(99,102,241,0.08)", color:"#6366f1", border:"1px solid rgba(99,102,241,0.2)" }}>
                      Confidence: {tradeNotes.confidence}/10
                    </span>
                  )}
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:tradeNotes.followed_rules?"rgba(52,211,153,0.08)":"rgba(239,68,68,0.08)", color:tradeNotes.followed_rules?"#10b981":"#ef4444", border:`1px solid ${tradeNotes.followed_rules?"rgba(52,211,153,0.2)":"rgba(239,68,68,0.2)"}` }}>
                    {tradeNotes.followed_rules ? " Rules followed" : " Rules broken"}
                  </span></div></div>) : (<div style={{ fontSize:11, color:"#374151", marginTop:8 }}>No review yet — reflect on this trade to build your trading journal.</div>
            )}
          </div>) : (
 /* Review form — fixed overlay so it doesn't push content off screen */<div style={{ position:"fixed", inset:0, zIndex:90, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}><div onClick={() => setReviewing(false)} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(4px)" }}/><div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:480, maxHeight:"85vh", borderRadius:14, border:"1px solid rgba(99,102,241,0.35)", background:"#111118", boxShadow:"0 24px 60px rgba(0,0,0,0.7)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

              {/* Header */}
              <div style={{ padding:"14px 18px", borderBottom:"1px solid #2a2a3a", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}><div style={{ fontSize:13, fontWeight:700, color:"#6366f1", display:"flex", alignItems:"center", gap:6 }}>️ Trade Review</div><button onClick={() => setReviewing(false)} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer" }}><X size={15}/></button></div>

              {/* Scrollable body */}
              <div style={{ flex:1, overflowY:"auto", padding:"16px 18px", display:"flex", flexDirection:"column", gap:12 }}><div><label style={lbl}>What happened? Why did you take this trade?</label><textarea value={tradeReason} onChange={e => setTradeReason(e.target.value)}
                    placeholder="Describe your reasoning, what you saw, and what you would do differently..."
                    style={{ ...inp, resize:"vertical", minHeight:72, fontFamily:"inherit", lineHeight:1.6 }}/></div><div><label style={{ ...lbl, display:"flex", justifyContent:"space-between" }}>Confidence going in<span style={{ color:"#6366f1", fontFamily:"monospace" }}>{confidence}/10</span></label><input type="range" min={1} max={10} value={confidence} onChange={e => setConfidence(parseInt(e.target.value))} style={{ width:"100%", accentColor:"#6366f1" }}/></div><div><label style={lbl}>Emotional state</label><div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {EMOTIONS.map(em =>(<button key={em.id} onClick={() => setEmotion(em.id)} style={{ padding:"5px 10px", borderRadius:20, border:`1px solid ${emotion===em.id?em.color:"#2a2a3a"}`, background:emotion===em.id?`${em.color}18`:"transparent", color:emotion===em.id?em.color:"#6b7280", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                        {em.label}
                      </button>
                    ))}
                  </div></div><div><label style={lbl}>Followed your trading rules?</label><div style={{ display:"flex", gap:8 }}>
                    {[true, false].map(v =>(<button key={String(v)} onClick={() => setFollowedRules(v)} style={{ flex:1, padding:"7px", borderRadius:8, border:`1px solid ${followedRules===v?(v?"rgba(52,211,153,0.5)":"rgba(239,68,68,0.5)"):"#2a2a3a"}`, background:followedRules===v?(v?"rgba(52,211,153,0.1)":"rgba(239,68,68,0.1)"):"transparent", color:followedRules===v?(v?"#10b981":"#ef4444"):"#6b7280", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        {v ? " Yes" : " No"}
                      </button>
                    ))}
                  </div></div>

                {availMistakes.length >0 && (<div><label style={lbl}>Mistakes made</label><div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                      {availMistakes.map(m => {
                        const sel = selMistakes.includes(m.id);
                        return (
                          <label key={m.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", borderRadius:7, background:sel?"rgba(239,68,68,0.08)":"#1a1a24", border:`1px solid ${sel?"rgba(239,68,68,0.3)":"#2a2a3a"}`, cursor:"pointer" }}><input type="checkbox" checked={sel} onChange={() => setSelMistakes(prev => sel ? prev.filter(id=>id!==m.id) : [...prev, m.id])} style={{ accentColor:"#ef4444", width:14, height:14 }}/><span style={{ fontSize:11, color:sel?"#ef4444":"#9ca3af", fontWeight:sel?700:400 }}>{m.name}</span></label>
                        );
                      })}
                    </div></div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding:"12px 18px", borderTop:"1px solid #2a2a3a", display:"flex", gap:8, flexShrink:0 }}><button onClick={() => setReviewing(false)} style={{ flex:1, padding:"9px", borderRadius:8, border:"1px solid #2a2a3a", background:"transparent", color:"#6b7280", fontSize:12, fontWeight:600, cursor:"pointer" }}>Cancel</button><button onClick={saveReview} disabled={saving} style={{ flex:2, padding:"9px", borderRadius:8, border:"none", background:saved?"rgba(52,211,153,0.2)":"#6366f1", color:saved?"#10b981":"#fff", fontSize:12, fontWeight:700, cursor:saving?"not-allowed":"pointer" }}>
                  {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Review"}
                </button></div></div></div>
        )}
        </div>{/* end scrollable content */}
      </div></div>
  );
}

function TradeTable({ trades, onEdit, onDelete, onReview, onAdd, onImport, username }) {
  const [err, setErr] = useState(false);
  const isMobile = useIsMobile();
  const [notesModalDate, setNotesModalDate] = useState(null); // { key, label }
  const [notesTick, setNotesTick] = useState(0);
  useEffect(() => {
    const h = () => setNotesTick(t => t + 1);
    window.addEventListener("nexyruDailyNotesUpdate", h);
    return () => window.removeEventListener("nexyruDailyNotesUpdate", h);
  }, []);
  const dateKeyForTrade = (t) => {
    const d = new Date(t.date);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const noteSet = useMemo(() => {
    if (!username) return new Set();
    const s = new Set();
    trades.forEach(t => {
      const k = dateKeyForTrade(t);
      if (k && hasDailyNotes(username, k)) s.add(k);
    });
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, username, notesTick]);
  if (err) return (
    <div style={{ padding:"24px", borderRadius:12, border:"1px dashed rgba(248,113,113,0.3)", textAlign:"center" }}><div style={{ fontSize:32, marginBottom:8 }}>️</div><div style={{ fontSize:13, fontWeight:700, color:"#ef4444", marginBottom:8 }}>Couldn't render trade table</div><button onClick={() => setErr(false)} style={{ padding:"7px 16px", borderRadius:8, border:"1px solid rgba(99,102,241,0.3)", background:"transparent", color:"#6366f1", fontSize:12, cursor:"pointer" }}>Retry</button></div>
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
  const [confirmingTradeDelete, setConfirmingTradeDelete] = useState(null);

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
      toast("Failed to remove from feed: " + e.message, "error");
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
  const SIcon = ({ c }) =>c!==sortK ?<ChevronsUpDown size={10} style={{ color:"#6b7280" }}/>: sortD==="asc" ?<ChevronUp size={10} style={{ color:"#6366f1" }}/>:<ChevronDown size={10} style={{ color:"#6366f1" }}/>;
  const th = { padding:"10px 14px", textAlign:"left", fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.08em", cursor:"pointer", userSelect:"none", whiteSpace:"nowrap", borderBottom:"1px solid rgba(30,41,59,0.8)", background:"rgba(10,15,30,0.98)" };
  const td = { padding:"11px 14px", fontSize:11, borderBottom:"1px solid rgba(30,41,59,0.4)" };
  const sysFont = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif';
  const sel = { padding:"5px 10px", borderRadius:7, background:"#1a1a24", border:"1px solid #2a2a3a", fontSize:11, color:"#9ca3af", cursor:"pointer", outline:"none" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {notesModalDate && username && (
        <DailyNotesModal username={username} dateKey={notesModalDate.key} dateLabel={notesModalDate.label} onClose={() => setNotesModalDate(null)}/>
      )}
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
      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}><div style={{ position:"relative", flex:1, minWidth:160 }}><Search size={12} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#6b7280" }}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search trades…" style={{ ...sel, paddingLeft:30, width:"100%", boxSizing:"border-box" }}/></div><select value={typeF} onChange={e=>setTypeF(e.target.value)} style={sel}><option value="all">All Types</option><option value="long">Long</option><option value="short">Short</option></select><select value={stratF} onChange={e=>setStratF(e.target.value)} style={sel}>{strategies.map(s=><option key={s} value={s}>{s==="all"?"All Strategies":s}</option>)}</select><span style={{ fontSize:10, color:"#374151", marginLeft:"auto" }}>{filtered.length} trades</span></div>
      {filtered.length === 0 ? (
        trades.length === 0 ? (
          <div style={{ padding:"56px 24px", textAlign:"center", borderRadius:12, border:"2px dashed #2a2a3a" }}><div style={{ fontSize:46, marginBottom:12, lineHeight:1 }}></div><div style={{ fontSize:15, fontWeight:700, color:"#9ca3af", marginBottom:6 }}>Your journal is empty</div><div style={{ fontSize:12, color:"#6b7280", marginBottom:18 }}>Import a CSV or log your first trade to get started</div><div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
              {onImport && (
                <button onClick={onImport} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"9px 18px", borderRadius:10, border:"1px solid rgba(99,102,241,0.4)", background:"transparent", color:"#6366f1", fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}><Upload size={12}/>Import CSV</button>
              )}
              {onAdd && (
                <button onClick={onAdd} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"9px 18px", borderRadius:10, border:"none", background:"var(--accent)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 14px rgba(99,102,241,0.25)", transition:"all 0.15s" }}><Plus size={13}/>Log Trade</button>
              )}
            </div></div>) : (<div style={{ padding:"40px", textAlign:"center", color:"#6b7280", fontSize:12, borderRadius:12, border:"1px dashed #2a2a3a" }}>No trades match your filters.</div>)
 ) : isMobile ? (<div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.map(t => {
            const w = (t.pnl ?? 0) >= 0;
            const isLong = t.type === "long";
            const isCSV  = t.source === "csv_import" || t.source === "broker_import";
            const isShot = t.source === "screenshot_import";
            const sourceLabel = isShot ? "Screenshot Import" : isCSV ? "CSV Import" : t.source === "copy" ? "Copy Trade" : t.source === "demo" ? "Demo" : "Manual";
            const dateLabel = new Date(t.date).toLocaleDateString(undefined, { month:"short", day:"numeric" });
            return (
              <div key={t.id}
                   onClick={() => setViewing(t)}
                   style={{
                     position:"relative",
                     borderRadius:12,
                     border:"1px solid rgba(30,41,59,0.7)",
                     borderLeft:`3px solid ${w ? "rgba(52,211,153,0.55)" : "rgba(248,113,113,0.55)"}`,
                     background:"rgba(13,17,32,0.55)",
                     padding:"12px 14px",
                     display:"flex",
                     flexDirection:"column",
                     gap:6,
                     cursor:"pointer",
                     WebkitTapHighlightColor:"transparent",
                   }}>
                {/* Top row */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}><div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}><span style={{ fontSize:9, fontWeight:800, padding:"3px 7px", borderRadius:5, background: isLong?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.12)", color: isLong?"#10b981":"#ef4444", border:`1px solid ${isLong?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)"}`, whiteSpace:"nowrap" }}>
                      {isLong?"▲ LONG":"▼ SHORT"}
                    </span><span style={{ fontSize:14, fontWeight:800, color:"#ffffff", letterSpacing:"-0.01em", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.pair}</span></div><span style={{ fontSize:14, fontWeight:800, color: w?"#10b981":"#ef4444", fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" }}>
                    {fmtMoney(t.pnl ?? 0, { signed:true })}
                  </span></div>
                {/* Bottom row */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, fontSize:11, color:"#6b7280" }}><span style={{ fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    Entry {formatPrice(t.entryPrice)} → Exit {formatPrice(t.exitPrice)}
                  </span><span style={{ whiteSpace:"nowrap", textAlign:"right", flexShrink:0, display:"inline-flex", alignItems:"center", gap:5, justifyContent:"flex-end" }}>
                    {dateLabel} · {sourceLabel}
                    {username && (() => { const k = dateKeyForTrade(t); if (!k || !noteSet.has(k)) return null; return (<span onClick={(e) => { e.stopPropagation(); setNotesModalDate({ key: k, label: formatNotesDateLong(k) }); }} title="Daily notes for this day" style={{ padding:"1px 5px", borderRadius:5, border:"1px solid rgba(99,102,241,0.3)", background:"rgba(99,102,241,0.08)", color:"#a5b4fc", fontSize:10, lineHeight:1, cursor:"pointer" }}>📝</span>); })()}
                  </span></div>
                {/* Action buttons */}
                <div style={{ position:"absolute", top:8, right:8, display:"flex", gap:4 }} onClick={e => e.stopPropagation()}><button onClick={(e) => { e.stopPropagation(); window.location.href = `/replay?tradeId=${t.id}`; }} aria-label="Replay this trade" title="Replay this trade"
                    style={{ width:32, height:32, borderRadius:8, border:"1px solid rgba(34,197,94,0.25)", background:"rgba(13,17,32,0.95)", color:"#22c55e", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><Play size={12}/></button><button onClick={() => onEdit(t)} aria-label="Edit trade"
                    style={{ width:32, height:32, borderRadius:8, border:"1px solid #2a2a3a", background:"rgba(13,17,32,0.95)", color:"#9ca3af", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><Edit2 size={12}/></button>
                  {confirmingTradeDelete === t.id ? (
                    <><button onClick={(e) => { e.stopPropagation(); setConfirmingTradeDelete(null); onDelete(t.id); }} aria-label="Confirm delete"
                        style={{ height:32, padding:"0 8px", borderRadius:8, border:"1px solid #ef4444", background:"rgba(239,68,68,0.2)", color:"#ef4444", fontSize:11, fontWeight:700, cursor:"pointer" }}>✓</button><button onClick={(e) => { e.stopPropagation(); setConfirmingTradeDelete(null); }} aria-label="Cancel"
                        style={{ height:32, padding:"0 8px", borderRadius:8, border:"1px solid #374151", background:"rgba(13,17,32,0.95)", color:"#9ca3af", fontSize:11, fontWeight:700, cursor:"pointer" }}>✗</button></>) : (<button onClick={(e) => { e.stopPropagation(); setConfirmingTradeDelete(t.id); setTimeout(() => setConfirmingTradeDelete(curr => curr === t.id ? null : curr), 3000); }} aria-label="Delete trade"
                      style={{ width:32, height:32, borderRadius:8, border:"1px solid rgba(239,68,68,0.25)", background:"rgba(13,17,32,0.95)", color:"#ef4444", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}><Trash size={12}/></button>
                  )}
                </div></div>
            );
          })}
        </div>) : (<div style={{ borderRadius:12, border:"1px solid #2a2a3a", overflow:"hidden" }}><div style={{ overflowX:"auto" }}><table style={{ width:"100%", borderCollapse:"collapse", minWidth:640 }}><thead><tr><th onClick={()=>toggleSort("pair")} style={th}><div style={{ display:"flex", alignItems:"center", gap:3 }}>Pair<SIcon c="pair"/></div></th><th style={{ ...th, cursor:"default" }}>Type</th><th onClick={()=>toggleSort("entryPrice")} style={th}><div style={{ display:"flex", alignItems:"center", gap:3 }}>Entry<SIcon c="entryPrice"/></div></th><th onClick={()=>toggleSort("exitPrice")} style={th}><div style={{ display:"flex", alignItems:"center", gap:3 }}>Exit<SIcon c="exitPrice"/></div></th><th onClick={()=>toggleSort("pnl")} style={th}><div style={{ display:"flex", alignItems:"center", gap:3 }}>PnL<SIcon c="pnl"/></div></th><th style={{ ...th, cursor:"default" }}>Strategy</th><th style={{ ...th, cursor:"default" }}>Psychology</th><th onClick={()=>toggleSort("date")} style={th}><div style={{ display:"flex", alignItems:"center", gap:3 }}>Date<SIcon c="date"/></div></th><th style={{ ...th, cursor:"default" }}></th></tr></thead><tbody>
                {filtered.map((t, rowIdx) => {
                  const w   = (t.pnl??0)>=0;
                  const rev = reviewMap[t.id] ?? (t.source === "demo" && t.emotion ? {
                    emotion: t.emotion,
                    confidence: t.confidence ?? 5,
                    followed_rules: t.rulesFollowed ?? true,
                    notes: t.notes ?? "",
                  } : null);
                  const EMOJIS = { calm:"", confident:"", fomo:"", fear:"", revenge:"" };
                  const winBorder = `2px solid ${w ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`;
                  const zebraBg = rowIdx % 2 === 1 ? "rgba(255,255,255,0.012)" : "transparent";
                  return (
                    <tr key={t.id}
                        style={{ cursor:"pointer", minHeight:52, transition:"background 0.12s", background:zebraBg }}
                        onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.03)"}
                        onMouseLeave={e=>e.currentTarget.style.background=zebraBg}><td style={{ ...td, fontWeight:700, color:"#ffffff", borderLeft: winBorder, minHeight:52, height:52, letterSpacing:"-0.01em" }} onClick={()=>setViewing(t)}><div style={{ display:"flex", alignItems:"center", gap:5 }}>
                          {t.pair}
                          {(t.screenshot || t._hasScreenshot) && <Image size={9} style={{ color:"#6b7280" }}/>}
                          {t.copiedFrom && <span style={{ fontSize:7, fontWeight:700, color:"#6366f1", background:"rgba(99,102,241,0.1)", padding:"1px 5px", borderRadius:8 }}>COPY</span>}
                          {t.source === "broker_import" && <span style={{ fontSize:7, fontWeight:700, color:"#10b981", background:"rgba(52,211,153,0.1)", padding:"1px 5px", borderRadius:8, border:"1px solid rgba(52,211,153,0.2)" }}>✓ BROKER</span>}
                          {(() => { try { const g = gradeTradeLocally(t, trades); return <span style={{ fontSize:7, fontWeight:800, color:g.gradeColor, background:`${g.gradeColor}15`, padding:"1px 5px", borderRadius:8, border:`1px solid ${g.gradeColor}30` }}>{g.grade}</span>; } catch { return null; } })()}
                        </div></td><td style={td} onClick={()=>setViewing(t)}><span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:4, background: t.type==="long"?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)", color: t.type==="long"?"#10b981":"#ef4444", border:`1px solid ${t.type==="long"?"rgba(16,185,129,0.25)":"rgba(239,68,68,0.25)"}` }}>
                          {t.type==="long"?"▲":"▼"} {t.type?.toUpperCase()}
                        </span></td><td style={{ ...td, color:"#9ca3af", fontVariantNumeric:"tabular-nums" }} onClick={()=>setViewing(t)}>{formatPrice(t.entryPrice)}</td><td style={{ ...td, color:"#9ca3af", fontVariantNumeric:"tabular-nums" }} onClick={()=>setViewing(t)}>{formatPrice(t.exitPrice)}</td><td style={{ ...td, fontWeight:800, color: w?"#10b981":"#ef4444", fontFamily:sysFont, fontVariantNumeric:"tabular-nums", letterSpacing:"-0.01em" }} onClick={()=>setViewing(t)}><div style={{ fontSize:13 }}>{fmtMoney(t.pnl ?? 0, { signed:true })}</div>
                        {Math.abs(t.pnlPercent ?? 0) >= 0.05 &&<div style={{ fontSize:10, opacity:0.7, fontWeight:600, marginTop:1 }}>{fmtPct(t.pnlPercent ?? 0, { signed:true })}</div>}
                      </td><td style={{ ...td, color:"#6b7280" }} onClick={()=>setViewing(t)}>{t.strategy}</td>

                      {/* Psychology column */}
                      <td style={td} onClick={()=>setViewing(t)}>
                        {rev ? (
                          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                            {/* Emotion + confidence */}
                            <div style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ fontSize:13 }}>{EMOJIS[rev.emotion] ?? "—"}</span><span style={{ fontSize:9, color:"#6b7280", fontFamily:"monospace" }}>{rev.emotion}</span></div>
                            {/* Confidence bar */}
                            <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:40, height:3, borderRadius:2, background:"#2a2a3a", overflow:"hidden" }}><div style={{ width:`${(rev.confidence/10)*100}%`, height:"100%", background: rev.confidence>=7?"#10b981":rev.confidence>=4?"#f59e0b":"#ef4444", borderRadius:2 }}/></div><span style={{ fontSize:9, color:"#6b7280", fontFamily:"monospace" }}>{rev.confidence}/10</span></div>
                            {/* Rules */}
                            <span style={{ fontSize:9, fontWeight:700, color: rev.followed_rules?"#10b981":"#ef4444" }}>
                              {rev.followed_rules ? " rules" : " rules"}
                            </span></div>) : (<span style={{ fontSize:9, color:"#374151" }}>—</span>
                        )}
                      </td><td style={{ ...td, color:"#6b7280", whiteSpace:"nowrap" }}><span onClick={()=>setViewing(t)} style={{ cursor:"pointer" }}>{new Date(t.date).toLocaleDateString()}</span>{username && (() => { const k = dateKeyForTrade(t); if (!k || !noteSet.has(k)) return null; return (<button onClick={(e) => { e.stopPropagation(); setNotesModalDate({ key: k, label: formatNotesDateLong(k) }); }} title="Daily notes for this day" aria-label="View daily notes" style={{ marginLeft:6, padding:"2px 6px", borderRadius:6, border:"1px solid rgba(99,102,241,0.3)", background:"rgba(99,102,241,0.08)", color:"#a5b4fc", cursor:"pointer", fontSize:11, lineHeight:1 }}>📝</button>); })()}</td><td style={td}><div style={{ display:"flex", gap:4 }}><button onClick={()=>onReview?.(t)} title="AI Review" style={{ padding:"4px 8px", borderRadius:6, border:"1px solid rgba(99,102,241,0.25)", background:"rgba(99,102,241,0.06)", color:"#6366f1", cursor:"pointer", display:"flex", alignItems:"center", gap:3, fontSize:10, fontWeight:600, transition:"all 0.15s" }}><span></span></button><button onClick={(e)=>{ e.stopPropagation(); window.location.href = `/replay?tradeId=${t.id}`; }} title="Replay this trade" style={{ padding:"4px 8px", borderRadius:6, border:"1px solid rgba(34,197,94,0.25)", background:"transparent", color:"#22c55e", cursor:"pointer", transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"center" }} onMouseEnter={e=>e.currentTarget.style.background="rgba(34,197,94,0.08)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}><Play size={10}/></button><button onClick={()=>onEdit(t)} style={{ padding:"4px 8px", borderRadius:6, border:"1px solid #2a2a3a", background:"transparent", color:"#6b7280", cursor:"pointer", transition:"all 0.15s" }}><Edit2 size={10}/></button>
                          {confirmingTradeDelete === t.id ? (
                            <div style={{ display:"flex", gap:3 }}><button onClick={(e) => { e.stopPropagation(); setConfirmingTradeDelete(null); onDelete(t.id); }} title="Confirm delete" style={{ padding:"4px 7px", borderRadius:6, border:"1px solid #ef4444", background:"rgba(239,68,68,0.18)", color:"#ef4444", cursor:"pointer", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", gap:2 }}>✓ Delete</button><button onClick={(e) => { e.stopPropagation(); setConfirmingTradeDelete(null); }} title="Cancel" style={{ padding:"4px 7px", borderRadius:6, border:"1px solid #374151", background:"transparent", color:"#9ca3af", cursor:"pointer", fontSize:10, fontWeight:700 }}>✗</button></div>) : (<button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmingTradeDelete(t.id);
                                setTimeout(() => setConfirmingTradeDelete(curr => curr === t.id ? null : curr), 3000);
                              }}
                              title="Delete trade"
                              style={{ padding:"4px 8px", borderRadius:6, border:"1px solid rgba(239,68,68,0.2)", background:"transparent", color:"#ef4444", cursor:"pointer", transition:"all 0.15s" }}
                              onMouseEnter={e=>e.currentTarget.style.background="rgba(239,68,68,0.08)"}
                              onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                            ><Trash size={10}/></button>
                          )}
                        </div></td></tr>
                  );
                })}
              </tbody></table></div></div>
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
    <div style={{ borderRadius:12, border:"1px solid rgba(239,68,68,0.2)", background:"rgba(239,68,68,0.03)", padding:"16px 18px" }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}><div style={{ fontSize:13, fontWeight:700, color:"#ef4444", display:"flex", alignItems:"center", gap:7 }}>Top Mistakes</div>
        {biggest && (
          <span style={{ fontSize:10, padding:"2px 9px", borderRadius:10, background:"rgba(239,68,68,0.12)", color:"#ef4444", border:"1px solid rgba(239,68,68,0.25)", fontWeight:700 }}>
            Biggest leak: {biggest.name}
          </span>
        )}
      </div><div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {mistakes.slice(0, 7).map((m, i) =>(<div key={m.id} style={{ display:"flex", alignItems:"center", gap:10 }}><div style={{ fontSize:10, color:"#6b7280", width:16, textAlign:"right", flexShrink:0 }}>{i+1}</div><div style={{ flex:1, minWidth:0 }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}><span style={{ fontSize:11, fontWeight: i===0?700:400, color: i===0?"#ef4444":"#9ca3af" }}>{m.name}</span><span style={{ fontSize:11, fontFamily:"monospace", color:"#6b7280", flexShrink:0, marginLeft:8 }}>{m.count}×</span></div><div style={{ height:4, borderRadius:2, background:"#2a2a3a", overflow:"hidden" }}><div style={{ width:`${(m.count/maxCount)*100}%`, height:"100%", background: i===0?"#ef4444":"rgba(239,68,68,0.4)", borderRadius:2 }}/></div></div></div>
        ))}
      </div></div>
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

  if (!trades.length) return <div style={{ padding:"40px", textAlign:"center", color:"#374151", borderRadius:12, border:"1px dashed #2a2a3a" }}>Log trades to see analytics</div>;

  const streakLabel = stats.currentStreak > 0 ? `${stats.currentStreak}W` : stats.currentStreak < 0 ? `${Math.abs(stats.currentStreak)}L` : "—";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, overflow:"hidden", minWidth:0, maxWidth:"100%" }}><div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10, minWidth:0 }}><StatCard label="Total Trades" value={String(stats.totalTrades)} sub={`${stats.wins}W / ${stats.losses}L`} pos={null} icon={<Activity size={14}/>}/><StatCard label="Win Rate"     value={`${stats.winRate}%`}       sub={`PF ${stats.profitFactor}`}        pos={stats.winRate>=50}    icon={<Target size={14}/>}/><StatCard label="Total PnL"    value={fmtMoney(stats.totalPnl ?? 0, { signed:true })} sub={`Avg W: ${fmtMoney(stats.avgWin ?? 0, { signed:true })}`} pos={stats.totalPnl>=0} icon={<TrendingUp size={14}/>}/><StatCard label="Best Trade"   value={fmtMoney(stats.bestTrade ?? 0, { signed:true })} pos={true}  icon={<Award size={14}/>}/><StatCard label="Worst Trade"  value={fmtMoney(stats.worstTrade ?? 0)}                 pos={false} icon={<TrendingDown size={14}/>}/><StatCard label="Streak"       value={streakLabel} sub={`Avg L: -${fmtMoney(stats.avgLoss ?? 0)}`} pos={stats.currentStreak>0?true:stats.currentStreak<0?false:null} icon={<Zap size={14}/>}/></div>
      {chartData.length >1 && (<div style={{ borderRadius:12, border:"1px solid rgba(51,65,85,0.6)", background:"rgba(15,23,42,0.85)", padding:"16px 16px 8px" }}><div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}><span style={{ fontSize:12, fontWeight:500, color:"#9ca3af" }}>Equity Curve</span><span style={{ fontSize:12, fontFamily:"monospace", fontWeight:700, color:lineClr }}>{finalPnl>=0?"+":""}{(finalPnl??0).toFixed(4)}</span></div><ResponsiveContainer width="100%" height={180}><AreaChart data={chartData} margin={{ top:4, right:4, left:-20, bottom:0 }}><defs><linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={lineClr} stopOpacity={0.25}/><stop offset="95%" stopColor={lineClr} stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" vertical={false}/><XAxis dataKey="label" tick={{ fontSize:9, fill:"#6b7280" }} tickLine={false} axisLine={false}/><YAxis tick={{ fontSize:9, fill:"#6b7280" }} tickLine={false} axisLine={false}/><Tooltip contentStyle={{ background:"#111118", border:"1px solid #2a2a3a", borderRadius:8, fontSize:11 }} labelStyle={{ color:"#9ca3af" }} itemStyle={{ color:lineClr }}/><Area type="monotone" dataKey="cumPnl" stroke={lineClr} strokeWidth={2} fill="url(#cumGrad)" dot={false}/></AreaChart></ResponsiveContainer></div>
      )}
      {trades.length >= 5 && (<div style={{ borderRadius:12, border:"1px solid rgba(51,65,85,0.6)", background:"rgba(15,23,42,0.85)", padding:"16px 16px 8px" }}><div style={{ fontSize:12, fontWeight:500, color:"#9ca3af", marginBottom:14 }}>PnL by Day of Week</div><ResponsiveContainer width="100%" height={120}><BarChart data={byDay} margin={{ top:4, right:4, left:-20, bottom:0 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" vertical={false}/><XAxis dataKey="day" tick={{ fontSize:9, fill:"#6b7280" }} tickLine={false} axisLine={false}/><YAxis tick={{ fontSize:9, fill:"#6b7280" }} tickLine={false} axisLine={false}/><Tooltip contentStyle={{ background:"#111118", border:"1px solid #2a2a3a", borderRadius:8, fontSize:11 }} labelStyle={{ color:"#9ca3af" }}/><Bar dataKey="pnl" fill="#6366f1" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
      )}
      <MistakeInsightsWidget/></div>
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
  if (!trade) return { score:50, grade:"C", gradeColor:"#f59e0b", strengths:[], issues:[], flags:[], rr:null };
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
  if (hour >= 9 && hour<= 11)  { score += 5; strengths.push("NY open session — high liquidity"); }
  if (hour >= 13 && hour<= 14) { score += 3; strengths.push("London/NY overlap — strong session"); }
  if (hour >= 20 || hour<= 6)  { score -= 8; issues.push("Late night / off-hours trade — low liquidity risk"); }

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
  const gradeColor = score >= 80 ? "#10b981" : score >= 65 ? "#6366f1" : score >= 50 ? "#f59e0b" : "#ef4444";

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
    FOMO:         { label:"FOMO Entry",        color:"#f59e0b", icon:"" },
    REVENGE:      { label:"Revenge Trade",      color:"#ef4444", icon:"" },
    OVERTRADE:    { label:"Overtrading",        color:"#f59e0b", icon:"️" },
    LOW_CONFIDENCE:{ label:"Low Conviction",   color:"#9ca3af", icon:"" },
    OVERSIZE:     { label:"Oversized Position", color:"#ef4444", icon:"" },
    FEAR:         { label:"Fear-Based Exit",    color:"#a5b4fc", icon:"" },
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}><div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(8px)" }}/><div style={{ position:"relative", zIndex:10, background:"#0a1628", border:"1px solid #1e2f4a", borderRadius:24, width:"100%", maxWidth:560, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 40px 100px rgba(0,0,0,0.9)" }}>

        {/* Header */}
        <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid #1a1a24", display:"flex", alignItems:"center", justifyContent:"space-between" }}><div><div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}><span style={{ fontSize:16 }}></span><span style={{ fontSize:15, fontWeight:800, color:"#ffffff" }}>AI Trade Review</span></div><div style={{ fontSize:11, color:"#2a2a3a" }}>{trade.pair} · {trade.type} · {new Date(trade.date).toLocaleDateString()}</div></div><button onClick={onClose} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer", fontSize:20, lineHeight:1 }}>×</button></div><div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:16 }}>

          {/* Score card */}
          <div style={{ borderRadius:16, background:`linear-gradient(135deg,${local.gradeColor}12,${local.gradeColor}06)`, border:`1px solid ${local.gradeColor}30`, padding:"20px 24px", display:"flex", alignItems:"center", gap:20 }}>
            {/* Grade badge */}
            <div style={{ width:72, height:72, borderRadius:16, background:`${local.gradeColor}18`, border:`2px solid ${local.gradeColor}44`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:`0 0 24px ${local.gradeColor}20` }}><span style={{ fontSize:28, fontWeight:900, color:local.gradeColor, fontFamily:"monospace" }}>{local.grade}</span></div><div style={{ flex:1 }}><div style={{ fontSize:12, color:"#6b7280", marginBottom:6 }}>Trade Score</div>
              {/* Score bar */}
              <div style={{ height:8, borderRadius:4, background:"#111118", marginBottom:6, overflow:"hidden" }}><div style={{ width:`${local.score}%`, height:"100%", background:`linear-gradient(90deg,${local.gradeColor}88,${local.gradeColor})`, borderRadius:4, transition:"width 1s", boxShadow:`0 0 8px ${local.gradeColor}44` }}/></div><div style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}><span style={{ color:local.gradeColor, fontWeight:800, fontFamily:"monospace" }}>{local.score}/100</span>
                {local.rr && <span style={{ color:"#6366f1" }}>RR: {local.rr.toFixed(1)}:1</span>}
                <span style={{ color: (trade.pnl??0)>=0?"#10b981":"#ef4444", fontWeight:700 }}>{(trade.pnl??0)>=0?"+":""}{(trade.pnl??0).toFixed(2)}</span></div></div></div>

          {/* Behavior flags */}
          {local.flags.length >0 && (<div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {local.flags.map(f => {
                const fl = FLAG_LABELS[f] ?? { label:f, color:"#6b7280", icon:"️" };
                return (
                  <div key={f} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:20, background:`${fl.color}12`, border:`1px solid ${fl.color}30`, fontSize:11, fontWeight:700, color:fl.color }}>
                    {fl.icon} {fl.label}
                  </div>
                );
              })}
            </div>
          )}

          {/* Strengths */}
          {local.strengths.length >0 && (<div style={{ borderRadius:12, background:"rgba(52,211,153,0.05)", border:"1px solid rgba(52,211,153,0.15)", padding:"14px 16px" }}><div style={{ fontSize:11, fontWeight:700, color:"#10b981", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>Strengths</div><div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {local.strengths.map((s,i) =>(<div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, fontSize:11, color:"#6b7280" }}><span style={{ color:"#10b981", flexShrink:0, marginTop:1 }}>•</span>{s}
                  </div>
                ))}
              </div></div>
          )}

          {/* Issues */}
          {local.issues.length >0 && (<div style={{ borderRadius:12, background:"rgba(248,113,113,0.05)", border:"1px solid rgba(248,113,113,0.15)", padding:"14px 16px" }}><div style={{ fontSize:11, fontWeight:700, color:"#ef4444", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>️ Issues</div><div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {local.issues.map((s,i) =>(<div key={i} style={{ display:"flex", alignItems:"flex-start", gap:8, fontSize:11, color:"#6b7280" }}><span style={{ color:"#ef4444", flexShrink:0, marginTop:1 }}>•</span>{s}
                  </div>
                ))}
              </div></div>
          )}

          {/* Risk meter */}
          <div style={{ borderRadius:12, background:"#111118", border:"1px solid #2a2a3a", padding:"14px 16px" }}><div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", marginBottom:12 }}>Risk Assessment</div><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {[
                { label:"Confidence",    val: trade.confidence ?? 5, max:10, color:"#6366f1" },
                { label:"Risk/Reward",   val: local.rr ? Math.min(local.rr, 5) : 1, max:5, color:local.rr && local.rr>=2?"#10b981":"#f59e0b" },
                { label:"Discipline",    val: trade.rulesFollowed ? 9 : local.flags.length > 0 ? 3 : 6, max:10, color:"#a5b4fc" },
                { label:"Timing",        val: (() => { const h=new Date(trade.date).getHours(); return h>=9&&h<=11?9:h>=13&&h<=14?7:h>=20||h<=6?3:5; })(), max:10, color:"#f59e0b" },
              ].map(m =>(<div key={m.label}><div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}><span style={{ fontSize:10, color:"#2a2a3a" }}>{m.label}</span><span style={{ fontSize:10, color:m.color, fontWeight:700, fontFamily:"monospace" }}>{(m.val/m.max*100).toFixed(0)}%</span></div><div style={{ height:4, borderRadius:2, background:"#111118", overflow:"hidden" }}><div style={{ width:`${(m.val/m.max)*100}%`, height:"100%", background:`linear-gradient(90deg,${m.color}66,${m.color})`, borderRadius:2 }}/></div></div>
              ))}
            </div></div>

          {/* AI Coach section */}
          <div style={{ borderRadius:12, background:"rgba(99,102,241,0.05)", border:"1px solid rgba(99,102,241,0.2)", overflow:"hidden" }}><div style={{ padding:"14px 16px", borderBottom:"1px solid rgba(99,102,241,0.1)", display:"flex", alignItems:"center", justifyContent:"space-between" }}><div style={{ display:"flex", alignItems:"center", gap:8 }}><span style={{ fontSize:16 }}></span><span style={{ fontSize:12, fontWeight:700, color:"#6366f1" }}>AI Coach Feedback</span></div>
              {!aiReview && (
                <button onClick={getAIReview} disabled={loading} style={{ padding:"6px 14px", borderRadius:8, border:"none", background:loading?"#2a2a3a":"#6366f1", color:loading?"#374151":"#fff", fontSize:11, fontWeight:700, cursor:loading?"not-allowed":"pointer" }}>
                  {loading ? <span style={{ display:"flex", alignItems:"center", gap:6 }}><span style={{ display:"inline-block", width:10, height:10, border:"2px solid #374151", borderTopColor:"#6366f1", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>Analyzing…</span> : " Get AI Feedback"}
                </button>
              )}
            </div>
            {aiReview ? (
              <div style={{ padding:"14px 16px", fontSize:12, color:"#9ca3af", lineHeight:2, whiteSpace:"pre-wrap" }}>
                {aiReview.split(/\*\*(.*?)\*\*/g).map((part,i) =>i%2===1 ?<strong key={i} style={{ color:"#ffffff", fontWeight:700 }}>{part}</strong> : part
                )}
              </div>) : !loading ? (<div style={{ padding:"14px 16px", fontSize:11, color:"#2e3f5a", textAlign:"center" }}>Get personalised AI coaching feedback on this trade</div>
            ) : null}
          </div></div></div></div>
  );
}

// ── AI Insight Cards for Insights tab ─────────────────────────
function AIInsightCard({ insight }) {
  const COLOR = {
    positive: { bg:"rgba(52,211,153,0.06)",  border:"rgba(52,211,153,0.25)",  text:"#10b981" },
    warning:  { bg:"rgba(248,113,113,0.06)", border:"rgba(248,113,113,0.25)", text:"#ef4444" },
    neutral:  { bg:"rgba(99,102,241,0.06)",  border:"rgba(99,102,241,0.25)",  text:"#6366f1" },
  };
  const c = COLOR[insight.type] ?? COLOR.neutral;

  return (
    <div style={{ borderRadius:14, background:c.bg, border:`1px solid ${c.border}`, padding:"16px 18px", position:"relative", overflow:"hidden" }}>
      {/* Glow */}
      <div style={{ position:"absolute", top:-20, right:-20, width:80, height:80, borderRadius:"50%", background:`${c.text}08`, pointerEvents:"none" }}/><div style={{ display:"flex", alignItems:"flex-start", gap:12 }}><div style={{ width:36, height:36, borderRadius:10, background:`${c.text}15`, border:`1px solid ${c.text}25`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
          {insight.icon}
        </div><div style={{ flex:1, minWidth:0 }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:5, gap:8 }}><div style={{ fontSize:12, fontWeight:800, color:"#ffffff" }}>{insight.title}</div>
            {insight.metric && (
              <span style={{ fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:10, background:`${c.text}15`, color:c.text, flexShrink:0 }}>{insight.metric}</span>
            )}
          </div><div style={{ fontSize:11, color:"#6b7280", lineHeight:1.7 }}>{insight.body}</div>
          {insight.action && (
            <div style={{ marginTop:8, fontSize:10, fontWeight:700, color:c.text, display:"flex", alignItems:"center", gap:4 }}>
              → {insight.action}
            </div>
          )}
        </div></div></div>
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
    if (best.winRate >= 55) insights.push({ type:"positive", icon:"", title:`Best strategy: ${best.strategy}`, body:`${best.winRate}% win rate across ${best.count} trades. PnL: ${(best.pnl??0)>=0?"+":""}${(best.pnl??0).toFixed(2)}.`, metric:`${best.winRate}% WR` });
    const worst = [...byStrat].sort((a,b)=>a.winRate-b.winRate)[0];
 if (worst && worst.winRate<40 && worst.count>=3) insights.push({ type:"warning", icon:"️", title:`Avoid: ${worst.strategy}`, body:`Only ${worst.winRate}% win rate on ${worst.count} trades. Consider dropping it.`, metric:`${worst.winRate}% WR` });
  }
  if (byTag.length > 0) {
    const bestTag = byTag[0];
    if (bestTag.winRate>=60) insights.push({ type:"positive", icon:"️", title:`Tag "${bestTag.tag}" is working`, body:`${bestTag.winRate}% WR on ${bestTag.count} trades.`, metric:`${bestTag.winRate}% WR` });
    const worstTag = [...byTag].sort((a,b)=>a.winRate-b.winRate)[0];
 if (worstTag && worstTag.winRate<35 && worstTag.count>=2) insights.push({ type:"warning", icon:"", title:`Avoid trades tagged "${worstTag.tag}"`, body:`Only ${worstTag.winRate}% WR. Total loss: ${(worstTag?.pnl??0).toFixed(2)}.`, metric:`${worstTag.winRate}% WR` });
  }
  if (longs.length>=2 && shorts.length>=2) {
    const longWR  = longs.filter(t=>(t.pnl??0)>0).length/longs.length*100;
    const shortWR = shorts.filter(t=>(t.pnl??0)>0).length/shorts.length*100;
    const better  = longWR>=shortWR?"long":"short";
    if (Math.abs(longWR-shortWR)>=15) insights.push({ type: longWR>=shortWR&&longWR>=55?"positive":"neutral", icon: better==="long"?"":"", title:`You trade ${better}s better`, body:`${better==="long"?"Longs":"Shorts"}: ${(better==="long"?longWR:shortWR).toFixed(0)}% WR vs ${(better==="long"?shortWR:longWR).toFixed(0)}% WR.`, metric:`+${Math.abs(longWR-shortWR).toFixed(0)}% edge` });
  }
  const sorted = [...trades].sort((a,b)=>a.date-b.date); let maxLoss=0, curL=0;
  sorted.forEach(t => { if((t.pnl??0)<0){curL++;maxLoss=Math.max(maxLoss,curL);}else curL=0; });
  if (maxLoss>=4) insights.push({ type:"warning", icon:"", title:`Max ${maxLoss}-trade losing streak`, body:`Consider pausing after 3 consecutive losses to avoid revenge trading.`, metric:`${maxLoss} losses` });
  if (winRate>=60) insights.push({ type:"positive", icon:"", title:"Above-average win rate", body:`At ${winRate}% you're above the 50% threshold.`, metric:`${winRate}% WR` });
  else if (winRate<40) insights.push({ type:"warning", icon:"", title:`Low win rate: ${winRate}%`, body:`Check your profit factor — if above 1.5 you may be fine. Otherwise tighten entries.`, metric:`${winRate}% WR` });
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
    const fmt   = h =>h === 0 ? "12am" : h< 12 ? `${h}am` : h === 12 ? "12pm" : `${h-12}pm`;

    if ((worst.pnl??0)<0 && (worst.wins + worst.losses) >= 3) {
      patterns.push({
        type:"warning", icon:"", severity:"high",
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
    const bestDay  = [...dayEntries].sort((a,b) =>b.wr - a.wr)[0];
 if (worstDay.wr< 40 && worstDay.count >= 3) {
      patterns.push({
        type:"warning", icon:"", severity:"high",
        title:`${worstDay.day}s are your worst day`,
        body:`Only ${worstDay.wr.toFixed(0)}% WR on ${worstDay.day}s across ${worstDay.count} trades. Total PnL on ${worstDay.day}s: ${(worstDay?.pnl??0).toFixed(2)}. Consider sitting out or reducing size.`,
        metric:`${worstDay.wr.toFixed(0)}% WR`,
        action:`Avoid trading on ${worstDay.day}s`,
      });
    }
    if (bestDay.wr >= 65 && bestDay.count >= 3 && bestDay.day !== worstDay?.day) {
      patterns.push({
        type:"positive", icon:"️", severity:"medium",
        title:`${bestDay.day}s are your best day`,
        body:`${bestDay.wr.toFixed(0)}% WR on ${bestDay.day}s across ${bestDay.count} trades. Total: ${bestDay.pnl >= 0 ? "+" : ""}${(bestDay?.pnl??0).toFixed(2)}. Your edge is strongest here.`,
        metric:`${bestDay.wr.toFixed(0)}% WR`,
        action:`Size up on ${bestDay.day}s`,
      });
    }
  }

  // ── 3. Revenge trading / losses after losses ─────────────
  const sorted = [...trades].sort((a,b) =>new Date(a.date) - new Date(b.date));
 let afterLossWins = 0, afterLossTotal = 0;
 let afterWinWins = 0, afterWinTotal = 0;
 let consecutiveLosses = 0, overtradeCount = 0;

 for (let i = 1; i< sorted.length; i++) {
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
        type:"warning", icon:"", severity:"high",
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
    const avgHeavyPnl = heavyDays.reduce((s,d) =>s+(d.pnl??0), 0) / heavyDays.length;
 if (avgHeavyWR< 45 || avgHeavyPnl < 0) {
      patterns.push({
        type:"warning", icon:"", severity:"medium",
        title:"Overtrading on busy days",
        body:`On days you trade 5+ times your average win rate is ${avgHeavyWR.toFixed(0)}% with average PnL of ${(avgHeavyPnl??0).toFixed(2)}. More trades doesn't mean more profit — quality over quantity.`,
        metric:`${avgHeavyWR.toFixed(0)}% WR`,
        action:"Set a daily trade limit",
      });
    }
  }

  // ── 5. Stop loss discipline ──────────────────────────────
  const bigLosses = trades.filter(t =>(t.pnl??0)<0).sort((a,b) => a.pnl - b.pnl);
  if (bigLosses.length >= 3) {
    const avgLoss = bigLosses.reduce((s,t) => s+(t.pnl??0), 0) / bigLosses.length;
    const avgWin  = trades.filter(t=>(t.pnl??0)>0).reduce((s,t) => s+(t.pnl??0), 0) / (trades.filter(t=>(t.pnl??0)>0).length || 1);
 const rrRatio = Math.abs(avgWin / avgLoss);
 if (rrRatio< 1) {
      patterns.push({
        type:"warning", icon:"", severity:"high",
        title:"Losses bigger than wins",
        body:`Your average win is ${avgWin.toFixed(2)} but your average loss is ${Math.abs(avgLoss).toFixed(2)}. R:R ratio of ${rrRatio.toFixed(2)}. Even with a good win rate this will bleed your account. Tighten stop losses.`,
        metric:`${rrRatio.toFixed(2)} R:R`,
        action:"Tighten your stop losses",
      });
    } else if (rrRatio >= 2) {
      patterns.push({
        type:"positive", icon:"️", severity:"low",
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
        type:"positive", icon:"", severity:"medium",
        title:"You're improving over time",
        body:`Your win rate in recent trades (${secondWR.toFixed(0)}%) is ${diff.toFixed(0)}% higher than your earlier trades (${firstWR.toFixed(0)}%). Keep doing what you're doing.`,
        metric:`+${diff.toFixed(0)}% improvement`,
        action:"Stay consistent",
      });
    } else if (diff <= -10) {
      patterns.push({
        type:"warning", icon:"", severity:"high",
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
    warning:  { border:"rgba(239,68,68,0.25)",  bg:"rgba(239,68,68,0.04)",  badge:"#ef4444", badgeBg:"rgba(239,68,68,0.1)",  dot:"#ef4444" },
    positive: { border:"rgba(52,211,153,0.25)", bg:"rgba(52,211,153,0.04)", badge:"#10b981", badgeBg:"rgba(52,211,153,0.1)", dot:"#10b981" },
    neutral:  { border:"rgba(99,102,241,0.2)",  bg:"rgba(99,102,241,0.04)", badge:"#6366f1", badgeBg:"rgba(99,102,241,0.1)", dot:"#6366f1" },
  };

  if (trades.length < 5) return (
    <div style={{ padding:"32px 24px", borderRadius:12, border:"1px dashed #2a2a3a", textAlign:"center", color:"#374151", fontSize:12 }}><div style={{ fontSize:32, marginBottom:12 }}></div><div style={{ fontSize:14, fontWeight:700, color:"#6b7280", marginBottom:6 }}>Not enough data yet</div>Log at least 5 trades to unlock pattern detection</div>);

 if (crashed) return (<div style={{ padding:"32px 24px", borderRadius:12, border:"1px dashed rgba(248,113,113,0.3)", textAlign:"center" }}><div style={{ fontSize:32, marginBottom:12 }}>️</div><div style={{ fontSize:14, fontWeight:700, color:"#ef4444", marginBottom:6 }}>Couldn't load insights</div><div style={{ fontSize:12, color:"#6b7280", marginBottom:16 }}>Try refreshing or logging more trades</div><button onClick={() => setCrashed(false)} style={{ padding:"8px 18px", borderRadius:9, border:"1px solid rgba(99,102,241,0.3)", background:"transparent", color:"#6366f1", fontSize:12, cursor:"pointer" }}>Try again</button></div>
  );

  const warnings  = patterns.filter(p => p.type === "warning");
  const positives = patterns.filter(p =>p.type === "positive");

 return (<div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* Pattern Detection Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}><div><div style={{ fontSize:15, fontWeight:800, color:"#ffffff", display:"flex", alignItems:"center", gap:8 }}>Pattern Detection<span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"rgba(99,102,241,0.1)", border:"1px solid rgba(99,102,241,0.2)", color:"#6366f1", fontWeight:700 }}>
              {patterns.length} pattern{patterns.length !== 1 ? "s" : ""} found
            </span></div><div style={{ fontSize:11, color:"#6b7280", marginTop:3 }}>Analysed {trades.length} trades for behavioural patterns</div></div>
        {warnings.length >0 && (<div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:10, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)" }}><span style={{ width:6, height:6, borderRadius:3, background:"#ef4444", display:"inline-block" }}/><span style={{ fontSize:11, color:"#ef4444", fontWeight:700 }}>{warnings.length} issue{warnings.length !== 1 ? "s" : ""} need attention</span></div>
        )}
      </div>

      {/* Patterns grid */}
      {patterns.length >0 && (<div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
          {patterns.map((p, i) => {
            const s = SEVERITY_STYLES[p.type] ?? SEVERITY_STYLES.neutral;
            return (
              <div key={i} style={{ borderRadius:12, border:`1px solid ${s.border}`, background:s.bg, padding:"14px 16px", display:"flex", flexDirection:"column", gap:8 }}><div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}><div style={{ display:"flex", alignItems:"center", gap:8 }}><span style={{ fontSize:20, lineHeight:1 }}>{p.icon}</span><div><div style={{ fontSize:12, fontWeight:800, color:"#ffffff", lineHeight:1.3 }}>{p.title}</div>
                      {p.metric && <span style={{ fontSize:9, fontWeight:700, color:s.badge, background:s.badgeBg, padding:"1px 6px", borderRadius:10, marginTop:3, display:"inline-block" }}>{p.metric}</span>}
                    </div></div><span style={{ fontSize:8, fontWeight:700, padding:"2px 6px", borderRadius:6, flexShrink:0, marginTop:2,
                    background: p.severity === "high" ? "rgba(239,68,68,0.15)" : p.severity === "medium" ? "rgba(245,158,11,0.1)" : "rgba(52,211,153,0.1)",
                    color:      p.severity === "high" ? "#ef4444"              : p.severity === "medium" ? "#f59e0b"              : "#10b981",
                  }}>{p.severity?.toUpperCase()}</span></div><p style={{ fontSize:11, color:"#6b7280", lineHeight:1.7, margin:0 }}>{p.body}</p>
                {p.action && (
                  <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:s.badge, fontWeight:700, marginTop:2 }}><span>→</span> {p.action}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {patterns.length === 0 && (
        <div style={{ padding:"24px", borderRadius:12, border:"1px solid #2a2a3a", textAlign:"center", color:"#374151", fontSize:12 }}>No strong patterns detected yet — keep logging trades for more insights</div>
      )}

      {/* Divider */}
      <div style={{ display:"flex", alignItems:"center", gap:12 }}><div style={{ flex:1, height:1, background:"#2a2a3a" }}/><span style={{ fontSize:10, color:"#374151", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em" }}>Rule-based Insights</span><div style={{ flex:1, height:1, background:"#2a2a3a" }}/></div>

      {/* Existing rule-based insights — now using beautiful AIInsightCard */}
      {insights.length >0 && (<div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {insights.map((ins, i) =><AIInsightCard key={i} insight={ins}/>)}
        </div>
      )}

      {/* AI Coach */}
      <div style={{ borderRadius:12, border:"1px solid rgba(99,102,241,0.25)", background:"rgba(99,102,241,0.05)", padding:"16px" }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: aiInsight ? 12 : 0 }}><div style={{ display:"flex", alignItems:"center", gap:7 }}><Wand2 size={13} style={{ color:"#6366f1" }}/><div><span style={{ fontSize:12, fontWeight:700, color:"#9ca3af" }}>AI Coach Summary</span><div style={{ fontSize:10, color:"#6b7280", marginTop:1 }}>Claude analyzes your patterns and gives personalised advice</div></div></div><button onClick={generateAI} disabled={aiLoading} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 16px", borderRadius:8, border:"none", background:aiLoading?"#2a2a3a":"#6366f1", color:aiLoading?"#374151":"#fff", fontSize:11, fontWeight:700, cursor:aiLoading?"not-allowed":"pointer", flexShrink:0 }}>
            {aiLoading ? "Analyzing…" : aiInsight ? <><RefreshCw size={11}/>Re-analyze</>:<><Sparkles size={11}/>Analyze my trades</>}
          </button></div>
        {aiInsight && <div style={{ fontSize:12, color:"#9ca3af", lineHeight:1.9, borderTop:"1px solid rgba(99,102,241,0.15)", paddingTop:12, whiteSpace:"pre-wrap" }}>{aiInsight}</div>}
        {aiError   && <div style={{ marginTop:8, fontSize:11, color:"#ef4444", display:"flex", alignItems:"center", gap:6 }}><AlertCircle size={11}/>{aiError}</div>}
      </div></div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  INSIGHTS ANALYTICS PAGE — full Tradervue-style analytics wall
// ═══════════════════════════════════════════════════════════════

function getHoldMinutes(t) {
  if (typeof t.holdMinutes === "number") return t.holdMinutes;
  if (typeof t.durationMin === "number") return t.durationMin;
  if (typeof t.durationMs  === "number") return t.durationMs / 60000;
  if (typeof t.holdMs      === "number") return t.holdMs / 60000;
  if (t.entryDate && t.exitDate) {
    const a = new Date(t.entryDate).getTime();
    const b = new Date(t.exitDate).getTime();
    if (!isNaN(a) && !isNaN(b) && b > a) return (b - a) / 60000;
  }
  if (t.entryTime && t.exitTime) {
    const a = new Date(t.entryTime).getTime();
    const b = new Date(t.exitTime).getTime();
    if (!isNaN(a) && !isNaN(b) && b > a) return (b - a) / 60000;
  }
  return null;
}

function fmtDuration(min) {
  if (min == null || isNaN(min)) return "—";
  if (min < 1)   return `${Math.round(min*60)}s`;
  if (min < 60)  return `${min.toFixed(1)}m`;
  if (min < 1440) return `${(min/60).toFixed(1)}h`;
  return `${(min/1440).toFixed(1)}d`;
}

function computeAnalytics(trades) {
  const sorted = [...trades].filter(t => t && t.date != null).sort((a,b) => a.date - b.date);
  const n = sorted.length;

  const wins  = sorted.filter(t => (t.pnl ?? 0) > 0);
  const losses = sorted.filter(t =>(t.pnl ?? 0)< 0);
  const breakeven = sorted.filter(t => (t.pnl ?? 0) === 0);

  const totalPnl = sorted.reduce((s,t) => s + (t.pnl ?? 0), 0);
  const grossWin  = wins.reduce((s,t)   => s + (t.pnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s,t) => s + (t.pnl ?? 0), 0));
  const winRate = n ? (wins.length / n) * 100 : 0;
  const avgWin  = wins.length   ? grossWin  / wins.length   : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;

  // Hold time
  const holdTimes = sorted.map(getHoldMinutes).filter(v => v != null);
  const avgHoldMin = holdTimes.length ? holdTimes.reduce((s,v) => s+v, 0) / holdTimes.length : null;

  // Daily PnL aggregation
  const dailyMap = {};
  sorted.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    if (!dailyMap[key]) dailyMap[key] = { date:key, ts:new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(), pnl:0, trades:0, wins:0 };
    dailyMap[key].pnl += (t.pnl ?? 0);
    dailyMap[key].trades += 1;
    if ((t.pnl ?? 0) > 0) dailyMap[key].wins += 1;
  });
  const daily = Object.values(dailyMap).sort((a,b) => a.ts - b.ts);
  const bestDay  = daily.length ? Math.max(...daily.map(d => d.pnl))  : 0;
  const worstDay = daily.length ? Math.min(...daily.map(d => d.pnl)) : 0;

  // Equity curve
  let cum = 0;
  const equity = sorted.map((t, i) => {
    cum += (t.pnl ?? 0);
    return { x: i+1, y: cum, date: t.date };
  });

  // By hour (6am-5pm = hours 6..17)
  const hourly = [];
  for (let h = 6; h <= 17; h++) {
    const hTrades = sorted.filter(t => new Date(t.date).getHours() === h);
    const hWins   = hTrades.filter(t => (t.pnl ?? 0) > 0).length;
    hourly.push({
      hour: h,
      label: h === 12 ? "12p" : h > 12 ? `${h-12}p` : `${h}a`,
      count: hTrades.length,
      winRate: hTrades.length ? (hWins / hTrades.length) * 100 : 0,
      pnl: hTrades.reduce((s,t) => s + (t.pnl ?? 0), 0),
    });
  }
  const hourlyWithTrades = hourly.filter(h => h.count > 0);
  const bestHour = hourlyWithTrades.length
    ? hourlyWithTrades.reduce((best,h) => h.winRate > best.winRate ? h : best, hourlyWithTrades[0])
    : null;

  // By day of week (Mon-Fri)
  const dowMap = { 1:{n:"Mon",p:0,c:0,w:0}, 2:{n:"Tue",p:0,c:0,w:0}, 3:{n:"Wed",p:0,c:0,w:0}, 4:{n:"Thu",p:0,c:0,w:0}, 5:{n:"Fri",p:0,c:0,w:0} };
  sorted.forEach(t => {
    const d = new Date(t.date).getDay();
    if (dowMap[d]) {
      dowMap[d].p += (t.pnl ?? 0);
      dowMap[d].c += 1;
      if ((t.pnl ?? 0) > 0) dowMap[d].w += 1;
    }
  });
  const byDow = [1,2,3,4,5].map(i => ({
    name: dowMap[i].n,
    avgPnl: dowMap[i].c ? dowMap[i].p / dowMap[i].c : 0,
    totalPnl: dowMap[i].p,
    count: dowMap[i].c,
    winRate: dowMap[i].c ? (dowMap[i].w / dowMap[i].c) * 100 : 0,
  }));

  // Duration buckets
  const buckets = [
    { label: "<5m",   min:0,    max:5,    trades:[], wins:0 },
    { label: "5-15m", min:5,    max:15,   trades:[], wins:0 },
    { label: "15-60m",min:15,   max:60,   trades:[], wins:0 },
    { label: "1-4h",  min:60,   max:240,  trades:[], wins:0 },
    { label: "Overnight", min:240, max:Infinity, trades:[], wins:0 },
  ];
  sorted.forEach(t => {
    const m = getHoldMinutes(t);
    if (m == null) return;
    const b = buckets.find(b => m >= b.min && m< b.max);
    if (b) {
      b.trades.push(t);
      if ((t.pnl ?? 0) > 0) b.wins += 1;
    }
  });
  const durationBuckets = buckets.map(b => ({
    label: b.label,
    count: b.trades.length,
    winRate: b.trades.length ? (b.wins / b.trades.length) * 100 : 0,
    pnl: b.trades.reduce((s,t) => s + (t.pnl ?? 0), 0),
  }));
  const bestDurationBucket = durationBuckets.filter(b => b.count > 0)
    .reduce((best, b) => !best || b.winRate > best.winRate ? b : best, null);

  // By symbol
  const symMap = {};
  sorted.forEach(t => {
    const sym = (t.symbol || t.pair || "—").toString();
    if (!symMap[sym]) symMap[sym] = { symbol:sym, trades:0, wins:0, pnl:0, gw:0, gl:0, best:-Infinity, worst:Infinity };
    const e = symMap[sym];
    const p = t.pnl ?? 0;
    e.trades += 1;
    if (p > 0) { e.wins += 1; e.gw += p; }
    else if (p < 0) { e.gl += Math.abs(p); }
    e.pnl += p;
    if (p >e.best) e.best = p;
 if (p< e.worst) e.worst = p;
  });
  const bySymbol = Object.values(symMap).map(s => ({
    symbol:s.symbol,
    trades:s.trades,
    winRate: s.trades ? (s.wins / s.trades) * 100 : 0,
    avgPnl: s.trades ? s.pnl / s.trades : 0,
    totalPnl: s.pnl,
    profitFactor: s.gl > 0 ? s.gw / s.gl : s.gw > 0 ? 999 : 0,
    best: s.best === -Infinity ? 0 : s.best,
    worst: s.worst === Infinity ? 0 : s.worst,
  })).sort((a,b) => b.totalPnl - a.totalPnl);

  // Streaks
  let curStreak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const w = (sorted[i].pnl ?? 0) > 0;
    if (curStreak === 0)              curStreak = w ? 1 : -1;
    else if (curStreak >0 && w) curStreak += 1;
 else if (curStreak< 0 && !w)     curStreak -= 1;
    else break;
  }
  let longestWin = 0, longestLoss = 0, runWin = 0, runLoss = 0;
  let afterWinTotal = 0, afterWinWins = 0, afterLossTotal = 0, afterLossWins = 0;
  sorted.forEach((t, i) => {
    const w = (t.pnl ?? 0) > 0;
    if (w)  { runWin += 1; runLoss = 0; if (runWin > longestWin) longestWin = runWin; }
    else    { runLoss += 1; runWin = 0; if (runLoss > longestLoss) longestLoss = runLoss; }
    if (i > 0) {
      const prevWin = (sorted[i-1].pnl ?? 0) > 0;
      if (prevWin) { afterWinTotal += 1; if (w) afterWinWins += 1; }
      else         { afterLossTotal += 1; if (w) afterLossWins += 1; }
    }
  });
  const afterWinRate  = afterWinTotal  ? (afterWinWins  / afterWinTotal)  * 100 : 0;
  const afterLossRate = afterLossTotal ? (afterLossWins / afterLossTotal) * 100 : 0;

  // Long vs Short
  const longs  = sorted.filter(t => t.type === "long");
  const shorts = sorted.filter(t => t.type === "short");
  const sideStat = (arr) => {
    const c = arr.length;
    const w = arr.filter(t => (t.pnl ?? 0) > 0).length;
    const p = arr.reduce((s,t) => s + (t.pnl ?? 0), 0);
    return { count: c, wins: w, winRate: c ? (w / c) * 100 : 0, pnl: p, avg: c ? p / c : 0 };
  };
  const longStats  = sideStat(longs);
  const shortStats = sideStat(shorts);

  // Monthly (last 6 months)
  const monthMap = {};
  sorted.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if (!monthMap[key]) monthMap[key] = { key, year:d.getFullYear(), month:d.getMonth(), trades:0, wins:0, pnl:0 };
    monthMap[key].trades += 1;
    monthMap[key].pnl += (t.pnl ?? 0);
    if ((t.pnl ?? 0) > 0) monthMap[key].wins += 1;
  });
  const monthly = Object.values(monthMap)
    .sort((a,b) => b.key.localeCompare(a.key))
    .slice(0, 6)
    .map(m => ({
      ...m,
      label: new Date(m.year, m.month, 1).toLocaleDateString("en-US", { month:"short", year:"numeric" }),
      winRate: m.trades ? (m.wins / m.trades) * 100 : 0,
    }));

  // Risk Analysis
  const rrs = sorted.map(t => {
    if (t.stopLoss && t.takeProfit && t.entryPrice) {
      const r = Math.abs((t.takeProfit - t.entryPrice) / (t.entryPrice - t.stopLoss));
      return isFinite(r) ? r : null;
    }
    return null;
  }).filter(v =>v != null && isFinite(v) && v< 100);
  const avgRR = rrs.length ? rrs.reduce((s,v) => s + v, 0) / rrs.length : 0;

  const expectedValue = n ? totalPnl / n : 0;
  const mean = expectedValue;
  const stdDev = n
    ? Math.sqrt(sorted.reduce((s,t) => s + Math.pow((t.pnl ?? 0) - mean, 2), 0) / n)
    : 0;
  const sharpeLike = stdDev > 0 ? mean / stdDev : 0;

  const lossRate = n ? losses.length / n : 0;
  const riskOfRuin = lossRate > 0 && avgWin > 0 && avgLoss > 0
    ? Math.min(100, Math.pow(lossRate / (1 - lossRate) * (avgLoss / avgWin), Math.min(20, longestLoss + 5)) * 100)
    : 0;

  // PnL distribution
  const pnlBuckets = [
    { label: "<-$500",      min:-Infinity, max:-500,    count:0, color:"#ef4444" },
    { label: "-$500 to $0", min:-500,      max:0,       count:0, color:"#ef4444" },
    { label: "$0-$100",     min:0,         max:100,     count:0, color:"#86efac" },
    { label: "$100-$500",   min:100,       max:500,     count:0, color:"#10b981" },
    { label: "$500-$1k",    min:500,       max:1000,    count:0, color:"#10b981" },
    { label: ">$1k",        min:1000,      max:Infinity,count:0, color:"#059669" },
  ];
  sorted.forEach(t => {
    const p = t.pnl ?? 0;
    const b = pnlBuckets.find(b => p >= b.min && p< b.max);
    if (b) b.count += 1;
  });

  return {
    n, wins, losses, breakeven, totalPnl, winRate, avgWin, avgLoss, profitFactor,
    avgHoldMin, hasHoldData: holdTimes.length > 0,
    bestDay, worstDay, daily, equity,
    hourly, bestHour,
    byDow,
    durationBuckets, bestDurationBucket,
    bySymbol,
    curStreak, longestWin, longestLoss, afterWinRate, afterLossRate, afterWinTotal, afterLossTotal,
    longStats, shortStats,
    monthly,
    avgRR, expectedValue, sharpeLike, longestLossStreak: longestLoss, riskOfRuin,
    pnlBuckets,
  };
}

function InsightsAnalyticsPage({ trades }) {
  const a = useMemo(() => computeAnalytics(trades || []), [trades]);

  if (!trades || trades.length === 0) {
    return (
      <div style={{ padding:"64px 24px", borderRadius:12, border:"1px dashed #1a1a24", textAlign:"center", color:"#6b7280", background:"#0f0f14" }}><div style={{ fontSize:42, marginBottom:14 }}></div><div style={{ fontSize:15, fontWeight:800, color:"#9ca3af", marginBottom:6 }}>No trades to analyze yet</div><div style={{ fontSize:12, color:"#6b7280" }}>Import trades to see your analytics</div></div>
    );
  }

  // ── Design tokens ────────────────────────────────────────────
  const CARD_BG     = "#0f0f14";
  const CARD_BORDER = "#1a1a24";
  const INDIGO      = "#6366f1";
  const INDIGO_SOFT = "rgba(99,102,241,0.08)";
  const GREEN       = "#22c55e";
  const RED         = "#ef4444";
  const PURPLE      = "#a78bfa";
  const BLUE        = "#3b82f6";
  const MUTED       = "#6b7280";
  const GRID        = "#1f1f2a";

  const sectionLabel = (text) => (
    <div style={{ fontSize:11, color:MUTED, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.14em", marginBottom:14 }}>{text}</div>
  );

  const card = {
    background: CARD_BG,
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: 12,
    padding: 20,
  };

  const mono = { fontFamily:"'JetBrains Mono','SF Mono',ui-monospace,monospace" };

  // ── Date / hour formatting helpers ───────────────────────────
  const fmtShortDate = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, (m||1)-1, d||1).toLocaleDateString("en-US", { month:"short", day:"numeric" });
  };
  const fmtHour = (h) => {
    if (h === 0)  return "12am";
    if (h === 12) return "12pm";
    return h < 12 ? `${h}am` : `${h-12}pm`;
  };

  // ── ROW 1: Key stats ─────────────────────────────────────────
  const keyStats = [
    { label:"Total Trades",  value:a.n.toLocaleString(),                                       color:"#ffffff", accent:INDIGO },
    { label:"Total P&L",     value:fmtMoney(a.totalPnl, { signed:true }),                      color:a.totalPnl>=0?GREEN:RED, accent:a.totalPnl>=0?GREEN:RED },
    { label:"Win Rate",      value:`${a.winRate.toFixed(1)}%`,                                 color:PURPLE,    accent:PURPLE },
    { label:"Profit Factor", value:a.profitFactor>=999?"∞":a.profitFactor.toFixed(2),          color:BLUE,      accent:BLUE },
    { label:"Avg Win",       value:fmtMoney(a.avgWin, { signed:true }),                        color:GREEN,     accent:GREEN },
    { label:"Avg Loss",      value:`-${fmtMoney(a.avgLoss)}`,                                  color:RED,       accent:RED },
    { label:"Best Day",      value:fmtMoney(a.bestDay, { signed:true }),                       color:GREEN,     accent:GREEN },
    { label:"Worst Day",     value:fmtMoney(a.worstDay, { signed:true }),                      color:RED,       accent:RED },
  ];

  // ── Equity curve SVG ─────────────────────────────────────────
  const eqW = 600, eqH = 240, eqPad = { l:8, r:12, t:20, b:24 };
  const yVals = a.equity.map(p => p.y);
  const yMin = Math.min(0, ...(yVals.length ? yVals : [0]));
  const yMax = Math.max(0, ...(yVals.length ? yVals : [0]));
  const yRange = (yMax - yMin) || 1;
  const xMax = Math.max(1, a.equity.length);
  const eqPoints = a.equity.map(p => {
    const x = eqPad.l + ((p.x - 1) / Math.max(1, xMax - 1)) * (eqW - eqPad.l - eqPad.r);
    const y = eqH - eqPad.b - ((p.y - yMin) / yRange) * (eqH - eqPad.t - eqPad.b);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  const lastEq = a.equity[a.equity.length - 1];
  const zeroY = eqH - eqPad.b - ((0 - yMin) / yRange) * (eqH - eqPad.t - eqPad.b);
  const gridLevels = [0, 0.25, 0.5, 0.75, 1].map(p => ({
    y: eqH - eqPad.b - p * (eqH - eqPad.t - eqPad.b),
    pct: Math.round(p * 100),
  }));
  const areaPath = a.equity.length
    ? `M ${eqPad.l},${zeroY} L ${eqPoints.split(" ").join(" L ")} L ${(eqPad.l + ((xMax-1) / Math.max(1, xMax-1)) * (eqW - eqPad.l - eqPad.r)).toFixed(2)},${zeroY} Z`
    : "";
  const lastTotalColor = (lastEq?.y ?? 0) >= 0 ? GREEN : RED;

  // ── Daily P&L bars ───────────────────────────────────────────
  const dailyDisplay = a.daily.slice(-30);
  const dailyMaxAbs = Math.max(1, ...dailyDisplay.map(d => Math.abs(d.pnl)));

  // ── Hourly chart ─────────────────────────────────────────────
  const hourMaxCount = Math.max(1, ...a.hourly.map(h => h.count));
  const wrToColor = (wr, hasData) => {
    if (!hasData) return "#1a1a24";
    const t = Math.max(0, Math.min(1, wr / 100));
    if (t >= 0.5) {
      const k = (t - 0.5) * 2;
      const r = Math.round(245 + (34 - 245) * k);
      const g = Math.round(158 + (197 - 158) * k);
      const b = Math.round(11 + (94 - 11) * k);
      return `rgb(${r},${g},${b})`;
    }
    const k = t * 2;
    const r = Math.round(239 + (245 - 239) * k);
    const g = Math.round(68 + (158 - 68) * k);
    const b = Math.round(68 + (11 - 68) * k);
    return `rgb(${r},${g},${b})`;
  };

  // ── Day of week ──────────────────────────────────────────────
  const dowsWithData = a.byDow.filter(d => d.count > 0);
  const bestDow  = dowsWithData.length ? dowsWithData.reduce((b,d) => d.avgPnl > b.avgPnl ? d : b) : null;
  const worstDow = dowsWithData.length ? dowsWithData.reduce((b,d) => d.avgPnl < b.avgPnl ? d : b) : null;

  // ── Win/Loss distribution ────────────────────────────────────
  const wlTotal = a.wins.length + a.losses.length;
  const winPct  = wlTotal ? (a.wins.length / wlTotal) * 100 : 0;
  const lossPct = wlTotal ? (a.losses.length / wlTotal) * 100 : 0;
  const wRatio  = a.avgLoss > 0 ? a.avgWin / a.avgLoss : a.avgWin > 0 ? 999 : 0;

  // ── Long vs Short ────────────────────────────────────────────
  const sideEdge = (() => {
    const lw = a.longStats.winRate, sw = a.shortStats.winRate;
    if (a.longStats.count < 2 || a.shortStats.count < 2) return null;
    const diff = Math.abs(lw - sw);
    if (diff < 5) return null;
    return { side: lw > sw ? "LONG" : "SHORT", pct: diff.toFixed(0) };
  })();

  // ── Duration buckets ─────────────────────────────────────────
  const durMaxCount = Math.max(1, ...a.durationBuckets.map(b => b.count));

  // ── Symbol max pnl ───────────────────────────────────────────
  const symMaxAbs = Math.max(1, ...a.bySymbol.map(s => Math.abs(s.totalPnl)));

  // ── P&L distribution ─────────────────────────────────────────
  const pnlMaxCount = Math.max(1, ...a.pnlBuckets.map(b => b.count));

  // ── Best hour pill string ────────────────────────────────────
  const bestHourPill = a.bestHour ? `Best hour: ${fmtHour(a.bestHour.hour)} (${a.bestHour.winRate.toFixed(0)}% win rate)` : "Not enough data";

  // ── Streak text ──────────────────────────────────────────────
  const streakCount = Math.abs(a.curStreak);
  const streakIsWin = a.curStreak >= 0;
  const streakText = `${streakCount} ${streakIsWin ? "win" : "loss"} streak`;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* ───── ROW 1: KEY STATS BAR ───── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12 }} className="insights-stat-grid">
        {keyStats.map(s => (
          <div
            key={s.label}
            style={{
              height: 80,
              padding: "12px 16px",
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 12,
              borderTop: `2px solid ${s.accent}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <div style={{ fontSize:10, color:MUTED, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em" }}>{s.label}</div>
            <div style={{ ...mono, fontSize:20, fontWeight:700, color:s.color, lineHeight:1.1, letterSpacing:"-0.01em" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ───── ROW 2: EQUITY CURVE + DAILY P&L ───── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }} className="insights-row-2">
        <div style={card}>
          {sectionLabel("Equity Curve")}
          <div style={{ position:"relative" }}>
            <svg viewBox={`0 0 ${eqW} ${eqH}`} preserveAspectRatio="none" style={{ width:"100%", height:260, display:"block" }}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={INDIGO} stopOpacity="0.22"/>
                  <stop offset="100%" stopColor={INDIGO} stopOpacity="0"/>
                </linearGradient>
              </defs>
              {/* dashed grid */}
              {gridLevels.map((g, i) => (
                <line key={i} x1={eqPad.l} x2={eqW-eqPad.r} y1={g.y} y2={g.y} stroke={GRID} strokeDasharray="3 4" strokeWidth="1"/>
              ))}
              {/* zero baseline (solid) */}
              <line x1={eqPad.l} x2={eqW-eqPad.r} y1={zeroY} y2={zeroY} stroke="#2a2a3a" strokeWidth="1"/>
              {/* fill */}
              {a.equity.length > 1 && <path d={areaPath} fill="url(#eqGrad)"/>}
              {/* line */}
              {a.equity.length > 1 && <polyline points={eqPoints} fill="none" stroke={INDIGO} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>}
              {/* end dot */}
              {lastEq && (() => {
                const x = eqPad.l + ((lastEq.x - 1) / Math.max(1, xMax - 1)) * (eqW - eqPad.l - eqPad.r);
                const y = eqH - eqPad.b - ((lastEq.y - yMin) / yRange) * (eqH - eqPad.t - eqPad.b);
                return <circle cx={x} cy={y} r="4" fill={INDIGO} stroke={CARD_BG} strokeWidth="2"/>;
              })()}
            </svg>
            {/* floating total badge */}
            <div style={{ position:"absolute", top:8, right:10, padding:"6px 12px", background:"#080808", border:`1px solid ${CARD_BORDER}`, borderRadius:8, ...mono, fontSize:13, fontWeight:700, color:lastTotalColor, boxShadow:"0 4px 16px rgba(0,0,0,0.4)" }}>
              {fmtMoney(lastEq?.y ?? 0, { signed:true })}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:10, color:MUTED, fontWeight:700 }}>
              <span>Trade #1</span>
              <span>Trade #{a.n}</span>
            </div>
          </div>
        </div>

        <div style={card}>
          {sectionLabel("Daily P&L")}
          <div style={{ position:"relative", height:200, padding:"0 4px" }}>
            {/* zero line */}
            <div style={{ position:"absolute", left:4, right:4, top:"50%", height:1, background:"#2a2a3a" }}/>
            <div style={{ display:"flex", alignItems:"stretch", justifyContent:"space-between", height:"100%", gap:4 }}>
              {dailyDisplay.length === 0 && <div style={{ width:"100%", textAlign:"center", color:MUTED, fontSize:11, alignSelf:"center" }}>No daily data</div>}
              {dailyDisplay.map(d => {
                const h = (Math.abs(d.pnl) / dailyMaxAbs) * 45;
                const pos = d.pnl >= 0;
                return (
                  <div
                    key={d.date}
                    title={`${fmtShortDate(d.date)} · ${fmtMoney(d.pnl,{signed:true})} · ${d.trades} trade${d.trades!==1?"s":""}`}
                    style={{ flex:1, display:"flex", flexDirection:"column", height:"100%", minWidth:0, cursor:"pointer" }}
                  >
                    <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"flex-end", alignItems:"center" }}>
                      {pos && <div style={{ width:"75%", height:`${h * 2}%`, background:GREEN, borderRadius:"3px 3px 0 0", minHeight:2 }}/>}
                    </div>
                    <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"flex-start", alignItems:"center" }}>
                      {!pos && <div style={{ width:"75%", height:`${h * 2}%`, background:RED, borderRadius:"0 0 3px 3px", minHeight:2 }}/>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:12, fontSize:10, color:MUTED, fontWeight:700 }}>
            <span>{dailyDisplay[0]?.date ? fmtShortDate(dailyDisplay[0].date) : "—"}</span>
            <span>{dailyDisplay.length} day{dailyDisplay.length!==1?"s":""}</span>
            <span>{dailyDisplay[dailyDisplay.length-1]?.date ? fmtShortDate(dailyDisplay[dailyDisplay.length-1].date) : "—"}</span>
          </div>
        </div>
      </div>

      {/* ───── ROW 3: PERFORMANCE BY TIME OF DAY ───── */}
      <div style={card}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginBottom:18 }}>
          <div style={{ fontSize:11, color:MUTED, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.14em" }}>Performance by Time of Day</div>
          <div style={{ padding:"6px 12px", borderRadius:8, background:"rgba(99,102,241,0.1)", border:`1px solid rgba(99,102,241,0.3)`, fontSize:11, fontWeight:700, color:INDIGO }}>
            {bestHourPill}
          </div>
        </div>
        <div style={{ position:"relative", height:200, paddingTop:24 }}>
          {/* 50% breakeven line */}
          <div style={{ position:"absolute", left:0, right:0, top:"calc(24px + 50%)", height:1, background:GRID, borderTop:`1px dashed ${GRID}` }}>
            <span style={{ position:"absolute", right:0, top:-14, fontSize:9, color:MUTED, fontWeight:700, ...mono }}>50%</span>
          </div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:"100%" }}>
            {a.hourly.map(h => {
              const wr = h.winRate;
              const fillH = h.count > 0 ? Math.max(6, wr) : 0;
              const isBest = a.bestHour && a.bestHour.hour === h.hour && h.count > 0;
              const color = wrToColor(wr, h.count > 0);
              return (
                <div key={h.hour} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6, minWidth:0 }}>
                  <div style={{ ...mono, fontSize:11, fontWeight:700, color: h.count>0 ? (wr>=50?GREEN:RED) : "#374151", lineHeight:1 }}>
                    {h.count > 0 ? `${wr.toFixed(0)}%` : ""}
                  </div>
                  <div style={{ flex:1, width:"100%", display:"flex", alignItems:"flex-end" }}>
                    <div
                      title={`${fmtHour(h.hour)}: ${wr.toFixed(1)}% WR · ${h.count} trades · ${fmtMoney(h.pnl,{signed:true})}`}
                      style={{
                        width:"100%",
                        height:`${fillH}%`,
                        background:color,
                        borderRadius:"4px 4px 0 0",
                        minHeight: h.count>0 ? 6 : 0,
                        boxShadow: isBest ? `0 0 0 2px ${INDIGO}` : "none",
                        transition:"height 0.2s",
                      }}
                    />
                  </div>
                  <div style={{ fontSize:10, color:"#9ca3af", fontWeight:700, ...mono }}>{fmtHour(h.hour)}</div>
                  <div style={{ fontSize:9, color:MUTED, ...mono }}>{h.count > 0 ? `${h.count} trade${h.count!==1?"s":""}` : "—"}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ───── ROW 4: DAY OF WEEK ───── */}
      <div>
        <div style={{ fontSize:11, color:MUTED, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.14em", marginBottom:14 }}>Performance by Day of Week</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12 }} className="insights-dow-grid">
          {a.byDow.map(d => {
            const pos = d.avgPnl >= 0;
            const isBest  = bestDow  && bestDow.name  === d.name && d.count > 0;
            const isWorst = worstDow && worstDow.name === d.name && d.count > 0 && d.avgPnl < 0;
            const borderColor = isBest ? INDIGO : isWorst ? RED : CARD_BORDER;
            return (
              <div key={d.name} style={{
                ...card,
                border: `1px solid ${borderColor}`,
                boxShadow: isBest ? `0 0 0 1px ${INDIGO}40` : "none",
                padding: 18,
                textAlign: "center",
              }}>
                <div style={{ fontSize:11, color:MUTED, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:8 }}>{d.name}</div>
                <div style={{ ...mono, fontSize:20, fontWeight:700, color: d.count===0 ? "#374151" : pos?GREEN:RED, lineHeight:1.1, marginBottom:6 }}>
                  {d.count > 0 ? fmtMoney(d.avgPnl,{signed:true}) : "—"}
                </div>
                <div style={{ fontSize:10, color:MUTED, fontWeight:600 }}>
                  {d.count} trade{d.count!==1?"s":""}{d.count>0 ? ` · ${d.winRate.toFixed(0)}% WR` : ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ───── ROW 5: WIN/LOSS + LONG/SHORT ───── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }} className="insights-row-5">

        {/* Win/Loss Distribution */}
        <div style={card}>
          {sectionLabel("Win / Loss Distribution")}
          {wlTotal === 0 ? (
            <div style={{ padding:"24px", textAlign:"center", color:MUTED, fontSize:11 }}>No trades</div>
          ) : (
            <>
              <div style={{ display:"flex", height:36, borderRadius:8, overflow:"hidden", border:`1px solid ${CARD_BORDER}` }}>
                <div style={{
                  width: `${winPct}%`,
                  background: GREEN,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:12, fontWeight:700, color:"#031a0d",
                  ...mono,
                }}>
                  {winPct >= 12 ? `${winPct.toFixed(1)}%` : ""}
                </div>
                <div style={{
                  width: `${lossPct}%`,
                  background: RED,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:12, fontWeight:700, color:"#1f0606",
                  ...mono,
                }}>
                  {lossPct >= 12 ? `${lossPct.toFixed(1)}%` : ""}
                </div>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, fontSize:10, color:MUTED, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em" }}>
                <span>{a.wins.length} Wins</span>
                <span>{a.losses.length} Losses{a.breakeven.length > 0 ? ` · ${a.breakeven.length} BE` : ""}</span>
              </div>

              <div style={{ marginTop:18, padding:"14px 16px", background:"#080808", borderRadius:10, border:`1px solid ${CARD_BORDER}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                <div>
                  <div style={{ fontSize:10, color:MUTED, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:3 }}>Avg Win vs Avg Loss</div>
                  <div style={{ ...mono, fontSize:13, fontWeight:700 }}>
                    <span style={{ color:GREEN }}>{fmtMoney(a.avgWin,{signed:true})}</span>
                    <span style={{ color:MUTED, margin:"0 8px" }}>vs</span>
                    <span style={{ color:RED }}>-{fmtMoney(a.avgLoss)}</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop:12, padding:"16px", background:"#080808", borderRadius:10, border:`1px solid ${CARD_BORDER}`, textAlign:"center" }}>
                <div style={{ fontSize:10, color:MUTED, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:6 }}>Win / Loss Ratio</div>
                <div style={{ ...mono, fontSize:32, fontWeight:700, color: wRatio>=1 ? GREEN : RED, lineHeight:1 }}>
                  {wRatio>=999 ? "∞" : wRatio.toFixed(2)}
                  <span style={{ fontSize:18, color:MUTED, marginLeft:2 }}>:1</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Long vs Short */}
        <div style={card}>
          {sectionLabel("Long vs Short")}
          {(a.longStats.count + a.shortStats.count) === 0 ? (
            <div style={{ padding:"24px", textAlign:"center", color:MUTED, fontSize:11 }}>No directional trades logged</div>
          ) : (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {[
                  { name:"LONG",  stats:a.longStats,  color:GREEN, borderSide:"borderLeft" },
                  { name:"SHORT", stats:a.shortStats, color:RED,   borderSide:"borderLeft" },
                ].map(({ name, stats, color }) => (
                  <div key={name} style={{
                    padding:"16px",
                    background:"#080808",
                    borderRadius:10,
                    border:`1px solid ${CARD_BORDER}`,
                    borderLeft:`3px solid ${color}`,
                  }}>
                    <div style={{ fontSize:11, color, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.14em", marginBottom:12 }}>{name}</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      <div>
                        <div style={{ fontSize:9, color:MUTED, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em" }}>Trades</div>
                        <div style={{ ...mono, fontSize:16, fontWeight:700, color:"#fff" }}>{stats.count}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:9, color:MUTED, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em" }}>Win Rate</div>
                        <div style={{ ...mono, fontSize:16, fontWeight:700, color: stats.count===0 ? MUTED : stats.winRate>=50 ? GREEN : RED }}>
                          {stats.count > 0 ? `${stats.winRate.toFixed(0)}%` : "—"}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize:9, color:MUTED, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em" }}>Total P&L</div>
                        <div style={{ ...mono, fontSize:16, fontWeight:700, color: stats.pnl>=0 ? GREEN : RED }}>
                          {stats.count > 0 ? fmtMoney(stats.pnl,{signed:true}) : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {sideEdge && (
                <div style={{ marginTop:14, padding:"12px 14px", background:"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.25)", borderRadius:10, textAlign:"center", fontSize:12, color:"#cbd5e1", fontWeight:600 }}>
                  You are <span style={{ color:INDIGO, fontWeight:800 }}>{sideEdge.pct}%</span> better at <span style={{ color:INDIGO, fontWeight:800 }}>{sideEdge.side}</span> trades
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ───── ROW 6: STREAKS ───── */}
      <div style={card}>
        {sectionLabel("Streaks")}
        <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr 1fr 1fr 1fr", gap:14 }} className="insights-streak-grid">
          <div style={{
            padding:"18px 20px",
            background:"#080808",
            borderRadius:10,
            border:`1px solid ${CARD_BORDER}`,
            borderLeft:`3px solid ${streakIsWin ? GREEN : RED}`,
          }}>
            <div style={{ fontSize:10, color:MUTED, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:6 }}>Current Streak</div>
            <div style={{ ...mono, fontSize:24, fontWeight:700, color: streakIsWin ? GREEN : RED, lineHeight:1.1 }}>{streakText}</div>
          </div>
          <div style={{ padding:"18px 20px", background:"#080808", borderRadius:10, border:`1px solid ${CARD_BORDER}` }}>
            <div style={{ fontSize:10, color:MUTED, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:6 }}>Longest Win</div>
            <div style={{ ...mono, fontSize:22, fontWeight:700, color:GREEN }}>{a.longestWin} <span style={{ fontSize:11, color:MUTED, fontWeight:600 }}>trades</span></div>
          </div>
          <div style={{ padding:"18px 20px", background:"#080808", borderRadius:10, border:`1px solid ${CARD_BORDER}` }}>
            <div style={{ fontSize:10, color:MUTED, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:6 }}>Longest Loss</div>
            <div style={{ ...mono, fontSize:22, fontWeight:700, color:RED }}>{a.longestLoss} <span style={{ fontSize:11, color:MUTED, fontWeight:600 }}>trades</span></div>
          </div>
          <div style={{ padding:"18px 20px", background:"#080808", borderRadius:10, border:`1px solid ${CARD_BORDER}` }}>
            <div style={{ fontSize:10, color:MUTED, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:6 }}>WR After Win</div>
            <div style={{ ...mono, fontSize:22, fontWeight:700, color: a.afterWinRate>=50 ? GREEN : a.afterWinTotal===0 ? MUTED : RED }}>
              {a.afterWinTotal > 0 ? `${a.afterWinRate.toFixed(0)}%` : "—"}
            </div>
            <div style={{ fontSize:10, color:MUTED, marginTop:2 }}>{a.afterWinTotal} sample{a.afterWinTotal!==1?"s":""}</div>
          </div>
          <div style={{ padding:"18px 20px", background:"#080808", borderRadius:10, border:`1px solid ${CARD_BORDER}` }}>
            <div style={{ fontSize:10, color:MUTED, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:6 }}>WR After Loss</div>
            <div style={{ ...mono, fontSize:22, fontWeight:700, color: a.afterLossRate>=50 ? GREEN : a.afterLossTotal===0 ? MUTED : RED }}>
              {a.afterLossTotal > 0 ? `${a.afterLossRate.toFixed(0)}%` : "—"}
            </div>
            <div style={{ fontSize:10, color:MUTED, marginTop:2 }}>{a.afterLossTotal} sample{a.afterLossTotal!==1?"s":""}</div>
          </div>
        </div>
      </div>

      {/* ───── ROW 7: SYMBOL TABLE ───── */}
      <div style={card}>
        {sectionLabel("Performance by Symbol")}
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${CARD_BORDER}` }}>
                {["Symbol","Trades","Win Rate","Avg PnL","Total PnL","Profit Factor","Best","Worst"].map((h, i) => (
                  <th key={h} style={{ textAlign: i===0 ? "left" : "right", padding:"10px 12px", fontSize:10, color:MUTED, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {a.bySymbol.length === 0 && (
                <tr><td colSpan={8} style={{ padding:24, textAlign:"center", color:MUTED }}>No symbol data</td></tr>
              )}
              {a.bySymbol.map(s => {
                const pos = s.totalPnl >= 0;
                const barW = (Math.abs(s.totalPnl) / symMaxAbs) * 100;
                return (
                  <tr key={s.symbol} style={{ borderBottom:`1px solid ${CARD_BORDER}` }}>
                    <td style={{ padding:"12px", fontWeight:700, color:"#fff" }}>{s.symbol}</td>
                    <td style={{ padding:"12px", textAlign:"right", ...mono, color:"#9ca3af" }}>{s.trades}</td>
                    <td style={{ padding:"12px", textAlign:"right", ...mono, color: s.winRate>=50?GREEN:RED, fontWeight:700 }}>{s.winRate.toFixed(1)}%</td>
                    <td style={{ padding:"12px", textAlign:"right", ...mono, color: s.avgPnl>=0?GREEN:RED }}>{fmtMoney(s.avgPnl,{signed:true})}</td>
                    <td style={{ padding:"12px", textAlign:"right", ...mono, color: pos?GREEN:RED, fontWeight:700 }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:10 }}>
                        <div style={{ flex:1, maxWidth:80, height:5, background:"#080808", borderRadius:3, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${barW}%`, background: pos?GREEN:RED, borderRadius:3 }}/>
                        </div>
                        <span>{fmtMoney(s.totalPnl,{signed:true})}</span>
                      </div>
                    </td>
                    <td style={{ padding:"12px", textAlign:"right", ...mono, color:"#9ca3af" }}>{s.profitFactor>=999?"∞":s.profitFactor.toFixed(2)}</td>
                    <td style={{ padding:"12px", textAlign:"right", ...mono, color:GREEN }}>{fmtMoney(s.best,{signed:true})}</td>
                    <td style={{ padding:"12px", textAlign:"right", ...mono, color:RED }}>{fmtMoney(s.worst,{signed:true})}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ───── ROW 8: DURATION + MONTHLY ───── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }} className="insights-row-6">
        <div style={card}>
          {sectionLabel("Trade Duration")}
          {a.hasHoldData ? (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {a.durationBuckets.map(b => {
                const isBest = a.bestDurationBucket && a.bestDurationBucket.label === b.label && b.count > 0;
                const w = (b.count / durMaxCount) * 100;
                const wrColor = b.count === 0 ? MUTED : b.winRate >= 50 ? GREEN : RED;
                return (
                  <div key={b.label} style={{ display:"grid", gridTemplateColumns:"90px 1fr 60px", gap:12, alignItems:"center" }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", display:"flex", alignItems:"center", gap:6 }}>
                      {isBest && <span style={{ color:INDIGO }}>★</span>}{b.label}
                    </div>
                    <div style={{ height:18, background:"#080808", borderRadius:5, position:"relative", overflow:"hidden" }}>
                      <div style={{ position:"absolute", left:0, top:0, bottom:0, width:`${w}%`, background: isBest ? INDIGO : "rgba(99,102,241,0.4)", borderRadius:5 }}/>
                      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", paddingLeft:8, fontSize:10, color:"#fff", ...mono, fontWeight:700 }}>{b.count} trade{b.count!==1?"s":""}</div>
                    </div>
                    <div style={{ ...mono, fontSize:11, fontWeight:700, color:wrColor, textAlign:"right" }}>
                      {b.count > 0 ? `${b.winRate.toFixed(0)}%` : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding:"32px 16px", textAlign:"center", color:MUTED, fontSize:11 }}>No hold-time data on logged trades</div>
          )}
        </div>

        <div style={card}>
          {sectionLabel("Monthly Performance")}
          {a.monthly.length === 0 ? (
            <div style={{ padding:"24px 16px", textAlign:"center", color:MUTED, fontSize:11 }}>No monthly data</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {a.monthly.map(m => {
                const pos = m.pnl >= 0;
                return (
                  <div key={m.key} style={{
                    display:"grid",
                    gridTemplateColumns:"1.4fr 0.8fr 0.8fr 1fr",
                    gap:8,
                    padding:"12px 14px",
                    borderRadius:8,
                    background:"#080808",
                    border:`1px solid ${CARD_BORDER}`,
                    alignItems:"center",
                  }}>
                    <div style={{ fontSize:12, fontWeight:700, color:"#fff" }}>{m.label}</div>
                    <div style={{ ...mono, fontSize:11, color:"#9ca3af", textAlign:"right" }}>{m.trades} trade{m.trades!==1?"s":""}</div>
                    <div style={{ ...mono, fontSize:11, fontWeight:700, color:m.winRate>=50?GREEN:RED, textAlign:"right" }}>{m.winRate.toFixed(0)}%</div>
                    <div style={{ ...mono, fontSize:13, fontWeight:700, color:pos?GREEN:RED, textAlign:"right" }}>{fmtMoney(m.pnl,{signed:true})}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ───── ROW 9: RISK + P&L DISTRIBUTION ───── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }} className="insights-row-7">
        <div style={card}>
          {sectionLabel("Risk Analysis")}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[
              { label:"Avg Risk/Reward", val:a.avgRR>0 ? `${a.avgRR.toFixed(2)}:1` : "—",       color: a.avgRR>=2?GREEN:a.avgRR>=1?"#f59e0b":RED },
              { label:"Expected Value",  val:fmtMoney(a.expectedValue,{signed:true}),           color: a.expectedValue>=0?GREEN:RED },
              { label:"Sharpe-like",     val:a.sharpeLike.toFixed(2),                           color: a.sharpeLike>=1?GREEN:a.sharpeLike>=0?"#f59e0b":RED },
              { label:"Max Consec Losses", val:String(a.longestLossStreak),                     color: a.longestLossStreak<=3?GREEN:a.longestLossStreak<=6?"#f59e0b":RED },
              { label:"Risk of Ruin",    val:`${a.riskOfRuin.toFixed(2)}%`,                     color: a.riskOfRuin<=5?GREEN:a.riskOfRuin<=20?"#f59e0b":RED },
              { label:"Total P&L",       val:fmtMoney(a.totalPnl,{signed:true}),                color: a.totalPnl>=0?GREEN:RED },
            ].map(s => (
              <div key={s.label} style={{ padding:"14px", background:"#080808", borderRadius:8, border:`1px solid ${CARD_BORDER}` }}>
                <div style={{ fontSize:10, color:MUTED, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:5 }}>{s.label}</div>
                <div style={{ ...mono, fontSize:17, fontWeight:700, color:s.color }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          {sectionLabel("P&L Distribution")}
          <div style={{ display:"flex", alignItems:"flex-end", height:180, gap:8, padding:"0 4px", borderBottom:`1px solid ${CARD_BORDER}`, marginBottom:10 }}>
            {a.pnlBuckets.map(b => {
              const h = (b.count / pnlMaxCount) * 100;
              return (
                <div key={b.label} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end", height:"100%", minWidth:0 }}>
                  <div style={{ ...mono, fontSize:10, fontWeight:700, color:"#9ca3af", marginBottom:4 }}>{b.count}</div>
                  <div
                    title={`${b.label}: ${b.count} trade${b.count!==1?"s":""}`}
                    style={{ width:"80%", height:`${h}%`, background:b.color, borderRadius:"4px 4px 0 0", minHeight: b.count>0?3:0 }}
                  />
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:8, padding:"0 4px" }}>
            {a.pnlBuckets.map(b => (
              <div key={b.label} style={{ flex:1, fontSize:9, color:MUTED, textAlign:"center", fontWeight:700, ...mono, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.label}</div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .insights-row-2, .insights-row-5, .insights-row-6, .insights-row-7 { grid-template-columns: 1fr !important; }
          .insights-dow-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .insights-streak-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  STRATEGY CARDS
// ═══════════════════════════════════════════════════════════════

function StrategyCards({ trades }) {
  const byStrat = useMemo(() =>insightsByStrategy(trades), [trades]);
 if (!byStrat.length) return<div style={{ padding:"32px", textAlign:"center", color:"#374151", borderRadius:12, border:"1px dashed #2a2a3a", fontSize:12 }}>Log trades with different strategies to see performance breakdowns</div>;
 return (<div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12 }}>
      {byStrat.map(s => {
        const pnlPos = s.pnl >= 0;
 return (<div key={s.strategy} style={{ borderRadius:12, border:`1px solid ${pnlPos?"rgba(52,211,153,0.2)":"rgba(239,68,68,0.2)"}`, background:"#111118", padding:"16px" }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}><div style={{ fontSize:13, fontWeight:700, color:"#ffffff" }}>{s.strategy}</div><span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background: s.winRate>=50?"rgba(52,211,153,0.1)":"rgba(239,68,68,0.1)", color: s.winRate>=50?"#10b981":"#ef4444", border:`1px solid ${s.winRate>=50?"rgba(52,211,153,0.3)":"rgba(239,68,68,0.3)"}`}}>{s.winRate}% WR</span></div><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
              {[
                { label:"Trades",    val:String(s.count),                                          color:"#9ca3af" },
                { label:"PnL",       val:`${pnlPos?"+":""}${(s.pnl??0).toFixed(2)}`,                   color:pnlPos?"#10b981":"#ef4444" },
                { label:"Avg/Trade", val:`${(s.pnl??0)/s.count>=0?"+":""}${((s.pnl??0)/s.count).toFixed(2)}`, color:(s.pnl??0)/s.count>=0?"#10b981":"#ef4444" },
              ].map(({ label,val,color }) =>(<div key={label} style={{ textAlign:"center", padding:"8px 4px", borderRadius:7, background:"#1a1a24" }}><div style={{ fontSize:8, color:"#374151", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{label}</div><div style={{ fontSize:12, fontWeight:700, fontFamily:"monospace", color }}>{val}</div></div>
              ))}
            </div><div style={{ marginTop:12, height:4, borderRadius:2, background:"#2a2a3a", overflow:"hidden" }}><div style={{ height:"100%", width:`${s.winRate}%`, background: s.winRate>=50?"#10b981":"#ef4444", borderRadius:2 }}/></div></div>
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
  { size: 10000,  label: "$10k",  next: 50000,  targetPct: 10, color: "#6366f1" },
  { size: 50000,  label: "$50k",  next: 100000, targetPct: 10, color: "#a5b4fc" },
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
    <div style={{ padding:"14px 18px", borderRadius:12, background:"linear-gradient(135deg,rgba(245,158,11,0.1),rgba(165,180,252,0.08))", border:"1px solid rgba(245,158,11,0.4)", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}><div style={{ fontSize:28 }}></div><div style={{ flex:1, minWidth:200 }}><div style={{ fontSize:13, fontWeight:800, color:"#f59e0b", marginBottom:4 }}>
          You've hit +{pnlPct.toFixed(1)}% on your {tier.label} account!
        </div><div style={{ fontSize:11, color:"#9ca3af" }}>
          You're eligible to upgrade to a ${nextSize.toLocaleString()} paper account. Keep your track record and start fresh with more capital.
        </div></div><button onClick={() => onUpgrade(nextSize)} style={{ padding:"9px 20px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#d97706,#f59e0b)", color:"#000", fontSize:12, fontWeight:800, cursor:"pointer", flexShrink:0 }}>
        Upgrade to ${nextSize.toLocaleString()} →
      </button></div>
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
    background:"#1a1a24", border:"1px solid #2a2a3a", fontSize:12, color:"#ffffff", outline:"none",
  };
  const lbl = { display:"block", fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:90, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}><div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)" }}/><div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:400, borderRadius:16, border:"1px solid #2a2a3a", background:"#111118", boxShadow:"0 25px 60px rgba(0,0,0,0.6)", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid #2a2a3a" }}><div style={{ fontSize:14, fontWeight:700, color:"#ffffff", display:"flex", alignItems:"center", gap:8 }}><Wallet size={15} style={{ color:"#6366f1" }}/>New Trading Account</div><button onClick={onClose} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer" }}><X size={16}/></button></div><div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:16 }}>

          {/* Account type toggle */}
          <div><label style={lbl}>Account Type</label><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
              {[
                { id:"paper",  icon:"", label:"Paper",   desc:"Simulated — risk free", color:"#6366f1" },
                { id:"funded", icon:"", label:"Funded",  desc:"Prop firm account",      color:"#a5b4fc" },
                { id:"real",   icon:"", label:"Real",    desc:"Your own capital",       color:"#10b981" },
              ].map(t =>(<button key={t.id} onClick={() => setType(t.id)} style={{
                  padding:"12px 10px", borderRadius:10, textAlign:"left", cursor:"pointer",
                  border:`1px solid ${type===t.id ? t.color+"50" : "#2a2a3a"}`,
                  background: type===t.id ? t.color+"10" : "#1a1a24",
                  transition:"all 0.15s",
                }}><div style={{ fontSize:18, marginBottom:5 }}>{t.icon}</div><div style={{ fontSize:11, fontWeight:700, color: type===t.id ? t.color : "#6b7280", marginBottom:3 }}>{t.label}</div><div style={{ fontSize:9, color:"#374151", lineHeight:1.4 }}>{t.desc}</div></button>
              ))}
            </div></div>

          {/* Paper — free size selection */}
          {type === "paper" && (
            <div><label style={lbl}>Account Size</label><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
                {[10000, 50000, 100000].map(size =>(<button key={size} onClick={() => setBalance(String(size))} style={{
                    padding:"12px 10px", borderRadius:10, textAlign:"center", cursor:"pointer",
                    border:`1px solid ${balance===String(size) ? "#6366f155" : "#2a2a3a"}`,
                    background: balance===String(size) ? "#6366f110" : "#1a1a24",
                    transition:"all 0.15s",
                  }}><div style={{ fontSize:14, fontWeight:900, color: balance===String(size) ? "#6366f1" : "#6b7280", fontFamily:"monospace" }}>
                      ${(size/1000).toFixed(0)}k
                    </div><div style={{ fontSize:9, color:"#374151", marginTop:3 }}>
                      {size === 10000 ? "Starter" : size === 50000 ? "Intermediate" : "Advanced"}
                    </div></button>
                ))}
              </div><div style={{ position:"relative" }}><span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:12, color:"#6b7280", fontWeight:700 }}>$</span><input type="number" style={{ ...inp, paddingLeft:24 }} value={balance} onChange={e => setBalance(e.target.value)} min="100" placeholder="Custom amount" onKeyDown={e => e.key === "Enter" && submit()}/></div><div style={{ fontSize:10, color:"#374151", marginTop:6 }}>Or enter any custom amount — match your TradingView paper account exactly</div></div>
          )}

          {/* Account name */}
          <div><label style={lbl}>Account Name</label><input style={inp} value={name} onChange={e => setName(e.target.value)}
              placeholder={type === "paper" ? "e.g. Main Paper, Scalping Lab" : type === "real" ? "e.g. My Tradovate Account" : "e.g. Tradeify Funded"}
              onKeyDown={e => e.key === "Enter" && submit()}
            /></div>

          {/* Real account — broker info */}
          {type === "real" && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}><div><label style={lbl}>Broker</label><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                  {["Tradovate","Apex","TopstepX","NinjaTrader","IBKR","Other"].map(b =>(<button key={b} onClick={() => setBroker(b.toLowerCase())} style={{ padding:"7px 6px", borderRadius:8, fontSize:10, fontWeight:700, cursor:"pointer", border:`1px solid ${broker===b.toLowerCase()?"rgba(52,211,153,0.4)":"#2a2a3a"}`, background:broker===b.toLowerCase()?"rgba(52,211,153,0.1)":"#1a1a24", color:broker===b.toLowerCase()?"#10b981":"#6b7280" }}>{b}</button>
                  ))}
                </div></div><div><label style={lbl}>Starting Balance (USD)</label><div style={{ position:"relative" }}><span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:12, color:"#6b7280", fontWeight:700 }}>$</span><input type="number" style={{ ...inp, paddingLeft:24 }} value={balance} onChange={e => setBalance(e.target.value)} min="100" placeholder="50000" onKeyDown={e => e.key === "Enter" && submit()}/></div></div><div style={{ padding:"10px 12px", borderRadius:9, background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.2)", fontSize:11, color:"#6b7280", lineHeight:1.6 }}>Import trades via<strong style={{ color:"#10b981" }}>CSV export</strong>from your broker. Auto-import via API coming soon when you get a funded Tradovate account.</div></div>
          )}

          {/* Funded account notice */}
          {type === "funded" && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}><div><label style={lbl}>Prop Firm</label><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                  {["Tradeify","Apex","TopstepX","Earn2Trade","FTMO","Other"].map(b =>(<button key={b} onClick={() => setBroker(b.toLowerCase())} style={{ padding:"7px 6px", borderRadius:8, fontSize:10, fontWeight:700, cursor:"pointer", border:`1px solid ${broker===b.toLowerCase()?"rgba(165,180,252,0.4)":"#2a2a3a"}`, background:broker===b.toLowerCase()?"rgba(165,180,252,0.1)":"#1a1a24", color:broker===b.toLowerCase()?"#a5b4fc":"#6b7280" }}>{b}</button>
                  ))}
                </div></div><div><label style={lbl}>Account Size (USD)</label><div style={{ position:"relative" }}><span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:12, color:"#6b7280", fontWeight:700 }}>$</span><input type="number" style={{ ...inp, paddingLeft:24 }} value={balance} onChange={e => setBalance(e.target.value)} min="100" placeholder="100000" onKeyDown={e => e.key === "Enter" && submit()}/></div></div><div style={{ padding:"10px 12px", borderRadius:9, background:"rgba(165,180,252,0.06)", border:"1px solid rgba(165,180,252,0.2)", fontSize:11, color:"#6b7280", lineHeight:1.6 }}>Import your funded account trades via<strong style={{ color:"#a5b4fc" }}>CSV export</strong>from Tradovate. Trades tagged as<strong style={{ color:"#a5b4fc" }}>✓ BROKER</strong>are marked as verified broker imports.</div></div>
          )}

          {err && (
            <div style={{ padding:"9px 12px", borderRadius:8, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", fontSize:12, color:"#ef4444", display:"flex", alignItems:"center", gap:7 }}><AlertCircle size={12}/>{err}
            </div>
          )}

          <div style={{ display:"flex", gap:10 }}><button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid #2a2a3a", background:"transparent", color:"#6b7280", fontSize:12, fontWeight:600, cursor:"pointer" }}>Cancel</button><button onClick={submit} style={{ flex:2, padding:"10px", borderRadius:9, border:"none", background: type==="paper" ? "#6366f1" : "linear-gradient(135deg,#4c1d95,#a5b4fc)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", boxShadow: type==="paper" ? "0 4px 16px rgba(99,102,241,0.25)" : "0 4px 16px rgba(165,180,252,0.25)" }}>
              Create {type === "paper" ? "Paper" : "Funded"} Account
            </button></div></div></div></div>
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
 const typeClr = activeAccount.type === "real" ? "#10b981" : activeAccount.type === "funded" ? "#a5b4fc" : "#6366f1";
 const canUpgrade = checkUpgradeEligible(activeAccount);

 return (<div ref={ref} style={{ position:"relative", flexShrink:0 }}>
      {/* Trigger button */}
      <button onClick={() => setOpen(v => !v)} style={{
        display:"flex", alignItems:"center", gap:10, padding:"6px 12px", borderRadius:9,
        border:`1px solid ${open ? typeClr + "50" : "#2a2a3a"}`,
        background: open ? typeClr + "08" : "#1a1a24",
        cursor:"pointer", transition:"all 0.15s",
      }}>
        {/* Account type dot — pulse if upgrade available */}
        <span style={{ width:7, height:7, borderRadius:"50%", background: canUpgrade ? "#f59e0b" : typeClr, flexShrink:0, animation: canUpgrade ? "pulse 1.5s infinite" : "none" }}/><div style={{ textAlign:"left", lineHeight:1.2 }}><div style={{ fontSize:10, fontWeight:600, color:"#6b7280", whiteSpace:"nowrap", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", letterSpacing:"0.01em" }}>
            {activeAccount.name} {canUpgrade ? "⬆️" : ""}
          </div><div style={{ marginTop:2, fontSize:12, fontWeight:700, color: pnlPos ? "#10b981" : "#ef4444", letterSpacing:"-0.01em", fontVariantNumeric:"tabular-nums" }}>
            ${activeAccount.balance.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 })}
            <span style={{ opacity:0.8, marginLeft:5, fontWeight:600 }}>{pnlPos?"+":""}{pnlPct.toFixed(1)}%</span></div></div><ChevronDown size={13} strokeWidth={2.5} style={{ color:"#6b7280", transform:open?"rotate(180deg)":"none", transition:"transform 0.2s", flexShrink:0 }}/></button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", right:0,
          width:260, borderRadius:12, border:"1px solid #2a2a3a",
          background:"#111118", boxShadow:"0 16px 48px rgba(0,0,0,0.5)",
          zIndex:200, overflow:"hidden",
        }}>
          {/* Header */}
          <div style={{ padding:"10px 14px", borderBottom:"1px solid #2a2a3a", fontSize:9, fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.07em" }}>Trading Accounts</div>

          {/* Account list */}
          <div style={{ maxHeight:280, overflowY:"auto" }}>
            {accounts.map(acc => {
              const ap    = acc.balance - acc.startingBalance;
              const apPct = acc.startingBalance > 0 ? (ap / acc.startingBalance * 100) : 0;
              const apPos = ap >= 0;
              const tc    = acc.type === "funded" ? "#a5b4fc" : "#6366f1";
              const isAct = acc.id === activeAccount.id;
              const accTrades = trades.filter(t =>t.accountId === acc.id);
 return (<button key={acc.id} onClick={() => { onSwitch(acc.id); setOpen(false); }} style={{
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
                  <div style={{ width:32, height:32, borderRadius:8, background: isAct ? tc+"20" : "#2a2a3a", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><span style={{ fontSize:14 }}>{acc.type === "funded" ? "" : ""}</span></div>
                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}><div style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ fontSize:11, fontWeight:700, color:"#ffffff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{acc.name}</span><span style={{ fontSize:8, fontWeight:700, color:tc, background:tc+"15", padding:"1px 5px", borderRadius:8, flexShrink:0 }}>{acc.type}</span></div><div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2 }}><span style={{ fontSize:10, fontFamily:"monospace", color:"#9ca3af" }}>${acc.balance.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span><span style={{ fontSize:9, fontFamily:"monospace", color: apPos?"#10b981":"#ef4444" }}>{apPos?"+":""}{apPct.toFixed(1)}%</span><span style={{ fontSize:9, color:"#374151" }}>·</span><span style={{ fontSize:9, color:"#374151" }}>{accTrades.length} trades</span></div></div>
                  {isAct && <Check size={13} style={{ color:tc, flexShrink:0 }}/>}
                </button>
              );
            })}
          </div>

          {/* Add account */}
          <div style={{ padding:"8px 12px", borderTop:"1px solid #2a2a3a" }}><button onClick={() => { onAdd(); setOpen(false); }} style={{
              width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
              padding:"8px", borderRadius:8, border:"1px dashed #2a2a3a",
              background:"transparent", color:"#6366f1", fontSize:11, fontWeight:700, cursor:"pointer",
            }}><Plus size={12}/>New Account</button></div></div>
      )}
    </div>
  );
}

// ── Account Stats Card (shown on Dashboard) ───────────────────
function AccountStatsCard({ activeAccount, trades }) {
  const isMobile = useIsMobile();
  if (!activeAccount) return null;

  const accTrades = trades.filter(t => t.accountId === activeAccount.id);
  const pnl       = activeAccount.balance - activeAccount.startingBalance;
  const pnlPct    = activeAccount.startingBalance > 0 ? (pnl / activeAccount.startingBalance * 100) : 0;
  const pnlPos    = pnl >= 0;
  const typeClr   = activeAccount.type === "funded" ? "#a5b4fc" : "#6366f1";
  const wins      = accTrades.filter(t => (t.pnl??0)>0).length;
  const wr        = accTrades.length ? +((wins / accTrades.length) * 100).toFixed(1) : 0;

  const perfClr = pnlPos ? "#10b981" : "#ef4444";
  const sysFont = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif';

  const miniStats = [
    { label:"Balance",  val: fmtMoney(activeAccount.balance), color:"#ffffff" },
    { label:"PnL",      val: fmtMoney(pnl, { signed:true }),  color:pnlPos?"#10b981":"#ef4444" },
    { label:"Return",   val: fmtPct(pnlPct, { signed:true }), color:pnlPos?"#10b981":"#ef4444" },
    { label:"Win Rate", val: accTrades.length ? fmtPct(wr) : "—", color:wr>=50?"#10b981":"#f59e0b" },
  ];

  return (
    <div style={{
      borderRadius:12, overflow:"hidden",
      border:`1px solid ${typeClr}25`,
      borderLeft:`3px solid ${perfClr}`,
      background:`linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0)), linear-gradient(135deg, ${typeClr}08, rgba(13,17,32,0.92))`,
    }}>
      {/* Account header */}
      <div style={{ padding: isMobile ? "12px 14px" : "14px 18px", borderBottom:`1px solid ${typeClr}18`, display:"flex", alignItems: isMobile ? "flex-start" : "center", justifyContent:"space-between", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 10 : 0 }}><div style={{ display:"flex", alignItems:"center", gap:10 }}><span style={{ fontSize:18 }}>{activeAccount.type === "funded" ? "" : ""}</span><div><div style={{ fontSize:14, fontWeight:700, color:"#ffffff", letterSpacing:"-0.01em" }}>{activeAccount.name}</div><div style={{ fontSize:10, fontWeight:700, color:typeClr, textTransform:"uppercase", letterSpacing:"0.1em", marginTop:2 }}>{activeAccount.type} account</div></div></div><div style={{ textAlign: isMobile ? "left" : "right", width: isMobile ? "100%" : "auto" }}><div style={{
            fontSize: isMobile ? 22 : 24,
            fontWeight:800,
            letterSpacing:"-0.5px",
            color:"#ffffff",
            lineHeight:1,
            fontFamily:sysFont,
            fontVariantNumeric:"tabular-nums",
          }}>
            {fmtMoney(activeAccount.balance)}
          </div><div style={{ fontSize:11, color:perfClr, marginTop:4, fontWeight:600, fontVariantNumeric:"tabular-nums" }}>
            {fmtPct(pnlPct, { signed:true })} return
          </div></div></div>
      {/* Mini stats */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", padding:"12px 0", gap: isMobile ? "8px 0" : 0 }}>
        {miniStats.map(({ label,val,color }, idx, arr) =>(<div key={label} style={{
            textAlign:"center",
            padding:"4px 10px",
            borderRight: isMobile ? (idx % 2 === 0 ? "1px solid rgba(30,41,59,0.4)" : "none") : (idx < arr.length-1 ? "1px solid rgba(30,41,59,0.4)" : "none"),
          }}><div style={{ fontSize:9, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:5, fontWeight:700 }}>{label}</div><div style={{
              fontSize:14,
              fontWeight:700,
              color,
              letterSpacing:"-0.01em",
              fontFamily:sysFont,
              fontVariantNumeric:"tabular-nums",
            }}>{val}</div></div>
        ))}
      </div></div>
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
  const losses = trades.filter(t =>(t.pnl??0)<0);
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
  const losses   = trades.filter(t =>(t.pnl??0)<0);
  const grossWin  = wins.reduce((s,t)=>s+(t.pnl??0),0);
  const grossLoss = Math.abs(losses.reduce((s,t)=>s+(t.pnl??0),0));
  const pf        = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 5 : 0;

  if (wr >= 65 && n >= 5)      badges.push({ emoji:"", label:"High Win Rate", color:"#f59e0b", bg:"rgba(245,158,11,0.12)" });
  if (pnl > 0 && n >= 10)      badges.push({ emoji:"", label:"Consistent",   color:"#10b981", bg:"rgba(52,211,153,0.12)" });
  if (pf >= 2.5)               badges.push({ emoji:"⭐", label:"High PF",       color:"#6366f1", bg:"rgba(99,102,241,0.12)" });
  if (n >= 20)                  badges.push({ emoji:"", label:"Veteran",       color:"#6366f1", bg:"rgba(99,102,241,0.12)" });
  if (grossLoss > grossWin * 0.4) badges.push({ emoji:"️", label:"High Risk",  color:"#f59e0b", bg:"rgba(245,158,11,0.12)" });
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
  const isFollowing = copyTrading.isFollowing(username);
  const isSelf      = username === session.username;
  const rel         = copyTrading.follows.find(f => f.trader === username);

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
  const recent    = [...trades].sort((a,b) =>b.date - a.date).slice(0,8);

 return (<div style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}><div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(6px)" }}/><div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:720, maxHeight:"92vh", borderRadius:20, border:"1px solid #2a2a3a", background:"#111118", boxShadow:"0 30px 80px rgba(0,0,0,0.7)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #2a2a3a", background:"linear-gradient(135deg,rgba(3,105,161,0.15),rgba(99,102,241,0.08))" }}><div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16 }}><div style={{ display:"flex", alignItems:"center", gap:16 }}><div style={{ width:56, height:56, borderRadius:"50%", background:"#6366f1", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:800, color:"#fff", flexShrink:0 }}>{displayName[0].toUpperCase()}</div><div><div style={{ fontSize:18, fontWeight:800, color:"#ffffff" }}>{displayName}</div><div style={{ fontSize:11, color:"#6b7280", fontFamily:"monospace" }}>@{username}</div></div></div><div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {!isSelf && (
                <button onClick={() => isFollowing ? copyTrading.unfollow(username) : copyTrading.follow(username)} style={{ display:"flex", alignItems:"center", gap:5, padding:"8px 16px", borderRadius:9, border:`1px solid ${isFollowing?"rgba(239,68,68,0.4)":"rgba(99,102,241,0.4)"}`, background:isFollowing?"rgba(239,68,68,0.08)":"rgba(99,102,241,0.08)", color:isFollowing?"#ef4444":"#6366f1", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                  {isFollowing ? <><UserMinus size={13}/>Unfollow</>:<><UserCheck size={13}/>Follow</>}
                </button>
              )}
              <button onClick={onClose} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer", padding:4 }}><X size={18}/></button></div></div>

          {/* Key stats row */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginTop:20 }}>
            {[
              { label:"Score",     val: String(+(calculateScore(trades)).toFixed(0)),              color:"#6366f1" },
              { label:"PnL",       val: `${stats.totalPnl>=0?"+":""}${(stats.totalPnl??0).toFixed(2)}`, color: stats.totalPnl>=0?"#10b981":"#ef4444" },
              { label:"Win Rate",  val: `${stats.winRate}%`,                                       color: stats.winRate>=50?"#10b981":"#f59e0b" },
              { label:"Trades",    val: String(stats.totalTrades),                                  color:"#9ca3af" },
            ].map(({ label,val,color }) =>(<div key={label} style={{ textAlign:"center", padding:"10px 8px", borderRadius:10, background:"rgba(17,24,39,0.6)", border:"1px solid rgba(30,45,62,0.8)" }}><div style={{ fontSize:8, color:"#374151", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>{label}</div><div style={{ fontSize:15, fontWeight:800, fontFamily:"monospace", color }}>{val}</div></div>
            ))}
          </div>

          {/* Multiplier (following only) */}
          {isFollowing && !isSelf && (
            <div style={{ marginTop:12, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", borderRadius:8, background:"rgba(99,102,241,0.06)", border:"1px solid rgba(99,102,241,0.15)" }}><div style={{ display:"flex", alignItems:"center", gap:6 }}><Repeat2 size={11} style={{ color:"#6366f1" }}/><span style={{ fontSize:11, color:"#6b7280" }}>Copy multiplier:</span></div><div style={{ display:"flex", gap:4 }}>{[0.25,0.5,1,2,3].map(m =><button key={m} onClick={()=>copyTrading.setMultiplier(username,m)} style={{ padding:"3px 8px", borderRadius:6, fontSize:10, fontWeight:700, cursor:"pointer", border:"none", background:rel?.multiplier===m?"#6366f1":"#2a2a3a", color:rel?.multiplier===m?"#000":"#6b7280" }}>{m}x</button>)}</div></div>
          )}
        </div>

        {/* Scrollable body */}
        <div style={{ flex:1, overflowY:"auto", padding:"20px 24px", display:"flex", flexDirection:"column", gap:20 }}>

          {/* Equity curve */}
          {chartData.length >1 && (<div style={{ borderRadius:12, border:"1px solid rgba(51,65,85,0.6)", background:"rgba(15,23,42,0.85)", padding:"16px 16px 8px" }}><div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}><span style={{ fontSize:12, fontWeight:600, color:"#9ca3af" }}>Equity Curve</span><span style={{ fontSize:12, fontFamily:"monospace", fontWeight:700, color:lineClr }}>{finalPnl>=0?"+":""}{(finalPnl??0).toFixed(4)}</span></div><ResponsiveContainer width="100%" height={150}><AreaChart data={chartData} margin={{ top:4,right:4,left:-20,bottom:0 }}><defs><linearGradient id={`grad_${username}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={lineClr} stopOpacity={0.25}/><stop offset="95%" stopColor={lineClr} stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" vertical={false}/><XAxis dataKey="label" tick={{ fontSize:9, fill:"#6b7280" }} tickLine={false} axisLine={false}/><YAxis tick={{ fontSize:9, fill:"#6b7280" }} tickLine={false} axisLine={false}/><Tooltip contentStyle={{ background:"#111118", border:"1px solid #2a2a3a", borderRadius:8, fontSize:11 }} itemStyle={{ color:lineClr }}/><Area type="monotone" dataKey="cumPnl" stroke={lineClr} strokeWidth={2} fill={`url(#grad_${username})`} dot={false}/></AreaChart></ResponsiveContainer></div>
          )}

          {/* Strategy breakdown */}
          {byStrat.length >0 && (<div><div style={{ fontSize:12, fontWeight:700, color:"#9ca3af", marginBottom:10 }}>Strategy Breakdown</div><div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:8 }}>
                {byStrat.map(s =>(<div key={s.strategy} style={{ borderRadius:9, border:`1px solid ${(s.pnl??0)>=0?"rgba(52,211,153,0.2)":"rgba(239,68,68,0.2)"}`, background:"rgba(17,24,39,0.6)", padding:"10px 12px" }}><div style={{ fontSize:11, fontWeight:700, color:"#ffffff", marginBottom:6, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.strategy}</div><div style={{ display:"flex", justifyContent:"space-between", fontSize:10, fontFamily:"monospace" }}><span style={{ color: (s.pnl??0)>=0?"#10b981":"#ef4444" }}>{(s.pnl??0)>=0?"+":""}{(s.pnl??0).toFixed(2)}</span><span style={{ color:"#6b7280" }}>{s.winRate}% WR</span></div></div>
                ))}
              </div></div>
          )}

          {/* Recent trade history */}
          {recent.length >0 ? (<div><div style={{ fontSize:12, fontWeight:700, color:"#9ca3af", marginBottom:10 }}>Recent Trades</div><div style={{ borderRadius:10, border:"1px solid #2a2a3a", overflow:"hidden" }}>
                {recent.map(t =>(<div key={t.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 14px", borderBottom:"1px solid rgba(30,41,59,0.4)" }}><div style={{ display:"flex", alignItems:"center", gap:10 }}><span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:4, background:t.type==="long"?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)", color:t.type==="long"?"#10b981":"#ef4444" }}>{t.type==="long"?"▲":"▼"}</span><div><div style={{ fontSize:11, fontWeight:700, color:"#ffffff" }}>{t.pair}</div><div style={{ fontSize:9, color:"#6b7280" }}>{t.strategy} · {new Date(t.date).toLocaleDateString()}</div></div></div><div style={{ textAlign:"right" }}><div style={{ fontSize:12, fontWeight:700, fontFamily:"monospace", color:(t.pnl??0)>=0?"#10b981":"#ef4444" }}>{fmtMoney(t.pnl ?? 0, { signed:true })}</div>
                      {Math.abs(t.pnlPercent ?? 0) >= 0.05 &&<div style={{ fontSize:9, color:(t.pnl??0)>=0?"#10b981":"#ef4444", opacity:0.7 }}>{fmtPct(t.pnlPercent ?? 0, { signed:true })}</div>}
                    </div></div>
                ))}
              </div></div>) : (<div style={{ padding:"32px 24px", borderRadius:12, border:"1px dashed #2a2a3a", textAlign:"center", animation:"fadeIn 0.3s ease" }}><div style={{ fontSize:36, marginBottom:12 }}></div><div style={{ fontSize:14, fontWeight:700, color:"#ffffff", marginBottom:6 }}>No trades yet</div><div style={{ fontSize:12, color:"#6b7280", marginBottom:16 }}>Log your first trade to start building your track record</div><div style={{ display:"flex", gap:10, justifyContent:"center" }}><button onClick={onAddTrade} style={{ padding:"8px 18px", borderRadius:9, border:"none", background:"var(--accent)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>+ Log Trade</button><button onClick={onOpenImport} style={{ padding:"8px 18px", borderRadius:9, border:"1px solid #2a2a3a", background:"transparent", color:"#9ca3af", fontSize:12, fontWeight:600, cursor:"pointer" }}>Import CSV</button></div></div>
          )}

          {!trades.length && <div style={{ textAlign:"center", padding:"32px", color:"#374151", fontSize:12 }}>No trades logged yet</div>}
        </div></div></div>
  );
}

// ── Leaderboard row ───────────────────────────────────────────

function LeaderboardRow({ rank, trader, session, copyTrading, onViewProfile }) {
  const isFollowing = copyTrading.isFollowing(trader.username);
  const isSelf      = trader.username === session.username;
  const pnlPos      = trader.pnl >= 0;

  const rankStyle = rank === 1
    ? { color:"#f59e0b", bg:"rgba(245,158,11,0.12)", border:"rgba(245,158,11,0.3)" }
    : rank === 2
    ? { color:"#9ca3af", bg:"rgba(148,163,184,0.08)", border:"rgba(148,163,184,0.2)" }
    : rank === 3
    ? { color:"#f59e0b", bg:"rgba(245,158,11,0.08)", border:"rgba(245,158,11,0.2)" }
    : { color:"#374151", bg:"transparent", border:"transparent" };

  const medal = rank === 1 ? "" : rank === 2 ? "" : rank === 3 ? "" : null;

  return (
    <div
      onClick={() => onViewProfile(trader)}
      style={{
        display:"grid", gridTemplateColumns:"44px 1fr auto auto auto auto", alignItems:"center", gap:12,
        padding:"12px 16px", cursor:"pointer", transition:"background 0.15s",
        borderBottom:"1px solid rgba(30,41,59,0.4)",
        background: rank <= 3 ? rankStyle.bg : "transparent",
      }}
      onMouseEnter={e =>e.currentTarget.style.background = rank<=3 ? rankStyle.bg : "rgba(255,255,255,0.02)"}
      onMouseLeave={e =>e.currentTarget.style.background = rank<=3 ? rankStyle.bg : "transparent"}
    >
      {/* Rank */}
      <div style={{ textAlign:"center" }}>
        {medal
          ? <span style={{ fontSize:18 }}>{medal}</span>:<span style={{ fontSize:12, fontWeight:800, color:rankStyle.color || "#374151", fontFamily:"monospace" }}>#{rank}</span>
        }
      </div>

      {/* Identity */}
      <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}><div style={{ width:34, height:34, borderRadius:"50%", flexShrink:0, background:`#6366f1`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, color:"#fff" }}>{trader.displayName[0].toUpperCase()}</div><div style={{ minWidth:0 }}><div style={{ display:"flex", alignItems:"center", gap:6 }}><span style={{ fontSize:12, fontWeight:700, color:"#ffffff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{trader.displayName}</span>
            {isSelf && <span style={{ fontSize:8, color:"#6366f1", background:"rgba(99,102,241,0.1)", padding:"1px 5px", borderRadius:8, fontWeight:700 }}>You</span>}
          </div><div style={{ display:"flex", alignItems:"center", gap:5, marginTop:2, flexWrap:"wrap" }}>
            <span style={{ fontSize:9, color:"#374151" }}>@{trader.username}</span></div></div></div>

      {/* PnL */}
      <div style={{ textAlign:"right", minWidth:70 }}><div style={{ fontSize:12, fontWeight:700, fontFamily:"monospace", color:pnlPos?"#10b981":"#ef4444" }}>{pnlPos?"+":""}{trader.pnl.toFixed(2)}</div><div style={{ fontSize:9, color:"#374151" }}>PnL</div></div>

      {/* Win rate */}
      <div style={{ textAlign:"right", minWidth:52 }}><div style={{ fontSize:12, fontWeight:700, fontFamily:"monospace", color:trader.winRate>=50?"#10b981":"#f59e0b" }}>{trader.winRate}%</div><div style={{ fontSize:9, color:"#374151" }}>WR</div></div>

      {/* Score */}
      <div style={{ textAlign:"right", minWidth:46 }}><div style={{ fontSize:12, fontWeight:700, fontFamily:"monospace", color:"#6366f1" }}>{trader.score.toFixed(0)}</div><div style={{ fontSize:9, color:"#374151" }}>Score</div></div>

      {/* Follow button */}
      <div onClick={e => e.stopPropagation()}>
        {!isSelf ? (
          <button
            onClick={() => isFollowing ? copyTrading.unfollow(trader.username) : copyTrading.follow(trader.username)}
            style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 12px", borderRadius:7, fontSize:10, fontWeight:700, cursor:"pointer", border:`1px solid ${isFollowing?"rgba(239,68,68,0.3)":"rgba(99,102,241,0.3)"}`, background:isFollowing?"rgba(239,68,68,0.07)":"rgba(99,102,241,0.07)", color:isFollowing?"#ef4444":"#6366f1", whiteSpace:"nowrap" }}>
            {isFollowing ? <><UserMinus size={9}/>Unfollow</>:<><UserCheck size={9}/>Follow</>}
          </button>) :<div style={{ width:68 }}/>}
      </div></div>
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
    if (minWR >0 && t.winRate< minWR) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.displayName.toLowerCase().includes(q) && !t.username.toLowerCase().includes(q)) return false;
    }
    return true;
  });

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
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}><div><div style={{ fontSize:20, fontWeight:800, color:"#ffffff", display:"flex", alignItems:"center", gap:10 }}><Users size={20} style={{ color:"#6366f1" }}/>Social Trading</div><div style={{ fontSize:11, color:"#6b7280", marginTop:3 }}>Leaderboard · Follow top traders · Simulate copy trading</div></div><div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={() => setRefreshAt(Date.now())} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:8, border:"1px solid #2a2a3a", background:"#1a1a24", color:"#6b7280", fontSize:11, cursor:"pointer" }}><RefreshCw size={11}/>Refresh</button></div></div>

      {/* Simulation notice */}
      <div style={{ padding:"10px 16px", borderRadius:10, background:"rgba(99,102,241,0.05)", border:"1px solid rgba(99,102,241,0.2)", fontSize:11, color:"#6b7280", lineHeight:1.6 }}><strong style={{ color:"#6366f1" }}>Simulation only.</strong>All data is from manually logged trades — no live broker connections. Following a trader automatically adds their new trades to your journal (simulated).</div>

      {/* Top 3 podium */}
      {leaders.slice(0,3).length >0 && tab === "leaderboard" && range === "all" && (<div style={{ display:"grid", gridTemplateColumns:"1fr 1.1fr 1fr", gap:12 }}>
          {[leaders[1], leaders[0], leaders[2]].filter(Boolean).map((t, podiumIdx) => {
            const actualRank = podiumIdx === 1 ? 1 : podiumIdx === 0 ? 2 : 3;
            const medal = ["","",""][podiumIdx];
            const h  = podiumIdx === 1 ? 130 : 110;
            const pnlPos = (t.pnl??0)>=0;
 return (<div key={t.username} onClick={() => setProfile(t)} style={{ borderRadius:14, border:`1px solid ${actualRank===1?"rgba(245,158,11,0.4)":actualRank===2?"rgba(148,163,184,0.25)":"rgba(245,158,11,0.3)"}`, background:`linear-gradient(160deg,${actualRank===1?"rgba(245,158,11,0.08)":actualRank===2?"rgba(148,163,184,0.05)":"rgba(245,158,11,0.06)"},rgba(13,17,32,0.9))`, padding:"16px", textAlign:"center", cursor:"pointer", position:"relative", height:h }}><div style={{ fontSize:28, marginBottom:6 }}>{medal}</div><div style={{ width:36, height:36, borderRadius:"50%", background:"#6366f1", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:"#fff", margin:"0 auto 8px" }}>{t.displayName[0].toUpperCase()}</div><div style={{ fontSize:12, fontWeight:700, color:"#ffffff", marginBottom:3 }}>{t.displayName}</div><div style={{ fontSize:13, fontWeight:800, fontFamily:"monospace", color:pnlPos?"#10b981":"#ef4444" }}>{pnlPos?"+":""}{(t.pnl??0).toFixed(2)}</div><div style={{ fontSize:10, color:"#6b7280" }}>{t.winRate}% WR · Score {t.score.toFixed(0)}</div></div>
            );
          })}
        </div>
      )}

      {/* Tabs + Filters */}
      <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        {/* Tab switcher */}
        <div style={{ display:"flex", gap:2, borderBottom:"1px solid #2a2a3a" }}>
          {[["leaderboard",` Leaderboard (${leaders.length})`],["following","Following"]].map(([id,label]) =>(<button key={id} onClick={()=>setTab(id)} style={{ padding:"6px 14px", border:"none", background:"transparent", fontSize:11, fontWeight:600, cursor:"pointer", color:tab===id?"#ffffff":"#6b7280", borderBottom:tab===id?"2px solid #6366f1":"2px solid transparent", marginBottom:-1, whiteSpace:"nowrap" }}>{label}</button>
          ))}
        </div><div style={{ display:"flex", alignItems:"center", gap:6, marginLeft:"auto", flexWrap:"wrap" }}>
          {/* Time range */}
          <div style={{ display:"flex", borderRadius:8, overflow:"hidden", border:"1px solid #2a2a3a" }}>
            {RANGE_OPTS.map(r =>(<button key={r.id} onClick={()=>setRange(r.id)} style={{ padding:"5px 10px", border:"none", fontSize:10, fontWeight:700, cursor:"pointer", background:range===r.id?"#2a2a3a":"#1a1a24", color:range===r.id?"#6366f1":"#6b7280" }}>{r.label}</button>
            ))}
          </div>
          {/* Win rate filter */}
          <select value={minWR} onChange={e=>setMinWR(Number(e.target.value))} style={{ padding:"5px 9px", borderRadius:7, background:"#1a1a24", border:"1px solid #2a2a3a", fontSize:10, color:"#9ca3af", cursor:"pointer", outline:"none" }}><option value={0}>All WR</option><option value={50}>≥50% WR</option><option value={60}>≥60% WR</option><option value={70}>≥70% WR</option></select>
          {/* Search */}
          <div style={{ position:"relative" }}><Search size={11} style={{ position:"absolute", left:8, top:"50%", transform:"translateY(-50%)", color:"#6b7280" }}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{ padding:"5px 8px 5px 26px", borderRadius:7, background:"#1a1a24", border:"1px solid #2a2a3a", fontSize:11, color:"#ffffff", outline:"none", width:120 }}/></div></div></div>

      {/* Leaderboard table */}
      {filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"48px 24px", borderRadius:12, border:"1px dashed #2a2a3a", color:"#374151" }}><Users size={32} style={{ marginBottom:12, opacity:0.3 }}/><div style={{ fontSize:13 }}>{tab==="following"?"You're not following anyone yet.":"No traders found for this filter."}</div>
          {tab==="following" && <button onClick={()=>setTab("leaderboard")} style={{ marginTop:10, fontSize:11, color:"#6366f1", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>Browse leaderboard →</button>}
        </div>) : (<div style={{ borderRadius:12, border:"1px solid #2a2a3a", overflow:"hidden" }}>
          {/* Table header */}
          <div style={{ display:"grid", gridTemplateColumns:"44px 1fr auto auto auto auto", gap:12, padding:"8px 16px", background:"rgba(10,15,30,0.95)", borderBottom:"1px solid rgba(30,41,59,0.8)" }}>
            {["#","Trader","PnL","WR","Score",""].map(h =>(<div key={h} style={{ fontSize:9, fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.07em", textAlign: h==="Trader"?"left":"right" }}>{h}</div>
            ))}
          </div>
          {filtered.map((trader, idx) =>(<LeaderboardRow
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
      <div style={{ padding:"10px 16px", borderRadius:10, background:"rgba(17,24,39,0.5)", border:"1px solid #2a2a3a", fontSize:10, color:"#374151", lineHeight:1.7 }}><strong style={{ color:"#6b7280" }}>Score formula:</strong>40% Win Rate + 30% Profit Factor + 20% Total PnL + 10% Activity. Filters by selected time range. Click any row to view full trader profile and equity curve.</div></div>
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
    ag = (ag * (period - 1) + (d >0 ? d : 0)) / period;
 al = (al * (period - 1) + (d< 0 ? -d : 0)) / period;
    out[i] = 100 - 100 / (1 + (al === 0 ? Infinity : ag / al));
  }
  return out;
}

function btMACD(closes, fast = 12, slow = 26, signal = 9) {
  const emaFast   = btEMA(closes, fast);
  const emaSlow   = btEMA(closes, slow);
  const macdLine  = closes.map((_, i) => emaFast[i] !== null && emaSlow[i] !== null ? emaFast[i] - emaSlow[i] : null);
  const validMACD = macdLine.filter(v =>v !== null);
 const sigRaw = btEMA(validMACD, signal);
 const sigLine = new Array(closes.length).fill(null);
 let si = 0;
 for (let i = 0; i< closes.length; i++) { if (macdLine[i] !== null) { sigLine[i] = sigRaw[si++] ?? null; } }
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
        && ind.emaF[i] >ind.emaS[i] && ind.emaF[i-1]<= ind.emaS[i-1],
      exit:  (i, ind) =>ind.emaF[i] !== null && ind.emaS[i] !== null
 && ind.emaF[i]< ind.emaS[i],
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
        && ind.rsi[i] >= p.oversold && ind.rsi[i-1]< p.oversold,
      exit:  (i, ind) =>ind.rsi[i] !== null && ind.rsi[i-1] !== null
 && ind.rsi[i]<= p.overbought && ind.rsi[i-1] > p.overbought,
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
        && ind.macd[i] >0 && ind.macd[i-1]<= 0,
      exit:  (i, ind) =>ind.macd[i] !== null && ind.macd[i-1] !== null
 && ind.macd[i]< 0 && ind.macd[i-1] >= 0,
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
        && ind.sF[i] >ind.sS[i] && ind.sF[i-1]<= ind.sS[i-1],
      exit:  (i, ind) =>ind.sF[i] !== null && ind.sS[i] !== null
 && ind.sF[i]< ind.sS[i],
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
  const losses     = trades.filter(t =>(t.pnl??0)<=0);
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
  const tf    = BT_TIMEFRAMES.find(t =>t.id === tfId);
 if (!tf) throw new Error("Unknown timeframe");

 const PAGE_SIZE = 300;
 const pages = Math.ceil(limit / PAGE_SIZE);
 const now = Math.floor(Date.now() / 1000);
 const all = [];

 for (let p = 0; p< pages; p++) {
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
    build:(v,ind) => (i) =>ind.rsi14?.[i] != null && ind.rsi14[i]< v },
  { id:"rsi_above",          label:"RSI >",              hint:"value", side:"exit",
    build:(v,ind) => (i) => ind.rsi14?.[i] != null && ind.rsi14[i] > v },
  // Cross within last 3 bars (much more practical than exact-bar cross)
  { id:"rsi_cross_up",       label:"RSI crossed up",     hint:"value", side:"entry",
    build:(v,ind) => (i) => {
      if (!ind.rsi14?.[i]) return false;
      for (let k = 0; k < 3; k++) {
        if (i-k < 1) break;
        if (ind.rsi14[i-k] >= v && ind.rsi14[i-k-1]< v) return true;
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
    build:(_,ind) => (i) =>ind.macd?.[i] != null && ind.macd[i]< 0 },
  // ── EMA conditions — state-based (is above/below, not crossing) ──
  { id:"ema9_above_ema21",   label:"EMA9 > EMA21",       hint:null, side:"entry",
    build:(_,ind) => (i) => ind.ema9?.[i] != null && ind.ema21?.[i] != null && ind.ema9[i] > ind.ema21[i] },
  { id:"ema9_below_ema21",   label:"EMA9 < EMA21",       hint:null, side:"exit",
    build:(_,ind) => (i) =>ind.ema9?.[i] != null && ind.ema21?.[i] != null && ind.ema9[i]< ind.ema21[i] },
  // ── Price vs SMA — state-based ─────────────────────────────
  { id:"price_above_sma50",  label:"Price > SMA50",      hint:null, side:"entry",
    build:(_,ind,closes) => (i) => ind.sma50?.[i] != null && closes[i] > ind.sma50[i] },
  { id:"price_below_sma50",  label:"Price < SMA50",      hint:null, side:"exit",
    build:(_,ind,closes) => (i) =>ind.sma50?.[i] != null && closes[i]< ind.sma50[i] },
  { id:"price_above_sma200", label:"Price > SMA200",     hint:null, side:"entry",
    build:(_,ind,closes) => (i) => ind.sma200?.[i] != null && closes[i] > ind.sma200[i] },
  { id:"price_below_sma200", label:"Price < SMA200",     hint:null, side:"exit",
    build:(_,ind,closes) => (i) =>ind.sma200?.[i] != null && closes[i]< ind.sma200[i] },
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

  const inp = { width:"100%", padding:"7px 10px", borderRadius:7, boxSizing:"border-box", background:"#1a1a24", border:"1px solid #2a2a3a", fontSize:12, color:"#ffffff", outline:"none" };
  const lbl = { display:"block", fontSize:9, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:5 };
  const m   = result?.metrics;
  const lineClr = m ? (m.totalPnl >= 0 ? "#10b981" : "#ef4444") : "#6366f1";

  // Condition row component
  const CondRow = ({ cond, side, idx }) => {
    const def = COND_DEFINITIONS.find(d => d.id === cond.id);
    const sideOptions = COND_DEFINITIONS.filter(d =>d.side === side || d.side === "both");
 return (<div style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 10px", borderRadius:7, background:"#1a1a24", border:"1px solid #2a2a3a" }}><select value={cond.id} onChange={e => setCond(side, idx, { id: e.target.value, value: COND_DEFINITIONS.find(d=>d.id===e.target.value)?.hint === "value" ? 14 : COND_DEFINITIONS.find(d=>d.id===e.target.value)?.hint === "bars" ? 20 : COND_DEFINITIONS.find(d=>d.id===e.target.value)?.hint === "count" ? 3 : null })}
          style={{ flex:1, ...inp, padding:"5px 8px" }}>
          {COND_DEFINITIONS.filter(d => d.side === side).map(d =><option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
        {def?.hint && (
          <input type="number" value={cond.value ?? ""} onChange={e => setCond(side, idx, { value: parseFloat(e.target.value) || 14 })}
            style={{ ...inp, width:60, padding:"5px 8px", flexShrink:0 }} placeholder={def.hint}/>
        )}
        <button onClick={() => removeCond(side, idx)} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer", padding:2, flexShrink:0 }}><X size={12}/></button></div>
    );
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}><div><div style={{ fontSize:20, fontWeight:800, color:"#ffffff", display:"flex", alignItems:"center", gap:10 }}><TestTube2 size={20} style={{ color:"#6366f1" }}/>Backtesting Engine</div><div style={{ fontSize:11, color:"#6b7280", marginTop:3 }}>
            {dataSource === "live" ? "Live Coinbase data" : "Simulated data"} · {symbol} · {tfId} · 0.1% fee + slippage
          </div></div>
        {/* Data source + fetch status */}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {fetchStatus === "fetching" && <span style={{ fontSize:10, color:"#f59e0b", display:"flex", alignItems:"center", gap:5 }}><span style={{ display:"inline-block", width:10, height:10, border:"2px solid #374151", borderTopColor:"#f59e0b", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>Fetching…</span>}
          {fetchStatus === "ok"       && <span style={{ fontSize:10, color:"#10b981" }}>● Live data loaded</span>}
          {fetchStatus === "fallback" && <span style={{ fontSize:10, color:"#f59e0b" }}>Coinbase offline — using simulated data</span>}
          <div style={{ display:"flex", borderRadius:7, overflow:"hidden", border:"1px solid #2a2a3a" }}>
            {[["live"," Live"],["sim"," Sim"]].map(([id,label]) =>(<button key={id} onClick={()=>setDataSource(id)} style={{ padding:"5px 12px", border:"none", fontSize:10, fontWeight:700, cursor:"pointer", background:dataSource===id?"#2a2a3a":"#1a1a24", color:dataSource===id?"#6366f1":"#6b7280" }}>{label}</button>
            ))}
          </div></div></div><div style={{ display:"grid", gridTemplateColumns:"340px 1fr", gap:20, alignItems:"start" }}>

        {/* ── LEFT ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

          {/* Market settings */}
          <div style={{ borderRadius:12, border:"1px solid #2a2a3a", background:"#111118", padding:"14px" }}><div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10, display:"flex", alignItems:"center", gap:5 }}><Activity size={11}/>Market</div>

            {/* Symbol list — grouped */}
            <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:12 }}><div style={{ fontSize:9, fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.07em", padding:"2px 0" }}>Crypto</div>
              {BT_SYMBOLS.filter(s => s.source==="coinbase").map(s =>(<button key={s.id} onClick={() => { setSymbol(s.id); setResult(null); }} style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"7px 10px", borderRadius:7, border:`1px solid ${symbol===s.id?"rgba(99,102,241,0.4)":"#2a2a3a"}`,
                  background: symbol===s.id ? "rgba(99,102,241,0.08)" : "#1a1a24",
                  cursor:"pointer", transition:"all 0.12s",
                }}><span style={{ fontSize:11, fontWeight:700, color: symbol===s.id?"#6366f1":"#9ca3af" }}>{s.label}</span><span style={{ fontSize:8, color:"#6366f1", background:"rgba(99,102,241,0.08)", padding:"1px 6px", borderRadius:10 }}>Coinbase</span></button>
              ))}
              <div style={{ fontSize:9, fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.07em", padding:"6px 0 2px" }}>Futures & Indexes</div>
              {BT_SYMBOLS.filter(s => s.source==="yahoo").map(s =>(<button key={s.id} onClick={() => { setSymbol(s.id); setResult(null); }} style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"7px 10px", borderRadius:7, border:`1px solid ${symbol===s.id?"rgba(245,158,11,0.4)":"#2a2a3a"}`,
                  background: symbol===s.id ? "rgba(245,158,11,0.06)" : "#1a1a24",
                  cursor:"pointer", transition:"all 0.12s",
                }}><span style={{ fontSize:11, fontWeight:700, color: symbol===s.id?"#f59e0b":"#9ca3af" }}>{s.label}</span><span style={{ fontSize:8, color:"#f59e0b", background:"rgba(245,158,11,0.08)", padding:"1px 6px", borderRadius:10 }}>Yahoo</span></button>
              ))}
            </div>

            {/* Timeframe */}
            <div><label style={lbl}>Timeframe</label><div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
                {BT_TIMEFRAMES.map(t =>(<button key={t.id} onClick={()=>{setTfId(t.id);setResult(null);}} style={{ padding:"4px 8px", borderRadius:5, border:"none", fontSize:10, fontWeight:700, cursor:"pointer", background:tfId===t.id?"#2a2a3a":"#1a1a24", color:tfId===t.id?"#6366f1":"#6b7280" }}>{t.label}</button>
                ))}
              </div></div></div>

          {/* Strategy mode toggle */}
          <div style={{ borderRadius:12, border:"1px solid #2a2a3a", background:"#111118", padding:"14px" }}><div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10, display:"flex", alignItems:"center", gap:5 }}><Layers size={11}/>Strategy</div><div style={{ display:"flex", borderRadius:7, overflow:"hidden", border:"1px solid #2a2a3a", marginBottom:14 }}>
              {[["builtin"," Built-in"],["custom","️ Custom Builder"]].map(([id,label]) =>(<button key={id} onClick={()=>{setStratMode(id);setResult(null);}} style={{ flex:1, padding:"7px 8px", border:"none", fontSize:10, fontWeight:700, cursor:"pointer", background:stratMode===id?"rgba(99,102,241,0.12)":"transparent", color:stratMode===id?"#6366f1":"#6b7280" }}>{label}</button>
              ))}
            </div>

            {stratMode === "builtin" && (
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {BUILTIN_STRATEGIES.map(s =>(<button key={s.id} onClick={() => setStratId(s.id)} style={{ padding:"8px 10px", borderRadius:8, textAlign:"left", cursor:"pointer", border:`1px solid ${stratId===s.id?"rgba(99,102,241,0.4)":"#2a2a3a"}`, background:stratId===s.id?"rgba(99,102,241,0.08)":"#1a1a24", transition:"all 0.15s" }}><div style={{ fontSize:11, fontWeight:700, color:stratId===s.id?"#6366f1":"#9ca3af" }}>{s.name}</div><div style={{ fontSize:9, color:"#374151", marginTop:2 }}>{s.description}</div></button>
                ))}
              </div>
            )}

            {stratMode === "custom" && (
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                {/* Entry conditions */}
                <div><div style={{ fontSize:10, fontWeight:700, color:"#10b981", marginBottom:6, display:"flex", alignItems:"center", justifyContent:"space-between" }}><span>▲ Entry — ALL must be true</span><button onClick={()=>addCond("entry")} style={{ background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.2)", color:"#10b981", borderRadius:5, padding:"2px 8px", fontSize:9, cursor:"pointer", fontWeight:700 }}>+ Add</button></div><div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                    {entryConds.map((c,i) =><CondRow key={i} cond={c} side="entry" idx={i}/>)}
                    {!entryConds.length && <div style={{ fontSize:10, color:"#374151", fontStyle:"italic", padding:"8px 10px" }}>No entry conditions — click + Add</div>}
                  </div></div>
                {/* Exit conditions */}
                <div><div style={{ fontSize:10, fontWeight:700, color:"#ef4444", marginBottom:6, display:"flex", alignItems:"center", justifyContent:"space-between" }}><span>▼ Exit — ANY fires</span><button onClick={()=>addCond("exit")} style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", color:"#ef4444", borderRadius:5, padding:"2px 8px", fontSize:9, cursor:"pointer", fontWeight:700 }}>+ Add</button></div><div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                    {exitConds.map((c,i) =><CondRow key={i} cond={c} side="exit" idx={i}/>)}
                    {!exitConds.length && <div style={{ fontSize:10, color:"#374151", fontStyle:"italic", padding:"8px 10px" }}>No exit conditions — click + Add</div>}
                  </div></div></div>
            )}
          </div>

          {/* Params (builtin only) */}
          {stratMode === "builtin" && strat?.params.length >0 && (<div style={{ borderRadius:12, border:"1px solid #2a2a3a", background:"#111118", padding:"14px" }}><div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10, display:"flex", alignItems:"center", gap:5 }}><Zap size={11}/>Parameters</div><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {strat.params.map(p =>(<div key={p.key}><label style={lbl}>{p.label}</label><input type="number" style={inp} min={p.min} max={p.max} value={params[p.key]??p.default} onChange={e=>setParam(p.key,parseFloat(e.target.value)||p.default)}/></div>
                ))}
              </div></div>
          )}

          {/* Risk */}
          <div style={{ borderRadius:12, border:"1px solid #2a2a3a", background:"#111118", padding:"14px" }}><div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10, display:"flex", alignItems:"center", gap:5 }}><Shield size={11}/>Risk & Capital</div><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}><div><label style={lbl}>Balance</label><div style={{ position:"relative" }}><span style={{ position:"absolute", left:8, top:"50%", transform:"translateY(-50%)", fontSize:11, color:"#6b7280" }}>$</span><input type="number" style={{ ...inp, paddingLeft:18 }} value={initialBal} min={100} onChange={e=>setInitialBal(parseFloat(e.target.value)||10000)}/></div></div><div><label style={lbl}>Risk / Trade %</label><input type="number" style={inp} value={riskPct} min={0.01} max={100} step={0.01} onChange={e=>setRiskPct(e.target.value)} onBlur={e=>{const v=parseFloat(e.target.value);setRiskPct(isNaN(v)||v<=0?0.01:v);}}/></div><div><label style={lbl}>Stop Loss %</label><input type="number" style={inp} value={slPct} min={0.01} max={50} step={0.01} onChange={e=>setSlPct(e.target.value)} onBlur={e=>{const v=parseFloat(e.target.value);setSlPct(isNaN(v)||v<=0?0.01:v);}}/></div><div><label style={lbl}>Take Profit %</label><input type="number" style={inp} value={tpPct} min={0.01} max={100} step={0.01} onChange={e=>setTpPct(e.target.value)} onBlur={e=>{const v=parseFloat(e.target.value);setTpPct(isNaN(v)||v<=0?0.01:v);}}/></div><div><label style={lbl}>Max Hold (bars)</label><input type="number" style={inp} value={maxHold} min={0} max={2000} onChange={e=>setMaxHold(parseInt(e.target.value)||0)}/></div><div><label style={lbl}>R:R Ratio</label><div style={{ padding:"7px 10px", borderRadius:7, background:"rgba(99,102,241,0.06)", border:"1px solid rgba(99,102,241,0.15)", fontSize:12, fontWeight:700, fontFamily:"monospace", color:"#6366f1" }}>1 : {(tpPct/slPct).toFixed(1)}</div></div></div></div>

          {/* Run */}
          <button onClick={run} disabled={loading} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"13px", borderRadius:10, border:"none", background:loading?"#2a2a3a":"#6366f1", color:loading?"#374151":"#fff", fontSize:13, fontWeight:700, cursor:loading?"not-allowed":"pointer", boxShadow:loading?"none":"0 4px 20px rgba(99,102,241,0.3)", transition:"all 0.2s" }}>
            {loading ? <><span style={{ display:"inline-block", width:12, height:12, border:"2px solid #374151", borderTopColor:"#6b7280", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>Running…</>:<><Play size={14}/>Run Backtest</>}
          </button>

          {error && <div style={{ padding:"10px 12px", borderRadius:8, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", fontSize:11, color:"#ef4444", display:"flex", alignItems:"center", gap:6 }}><AlertCircle size={11}/>{error}</div>}
        </div>

        {/* ── RIGHT: Results ── */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {!result && !loading && (
            <div style={{ padding:"80px 40px", borderRadius:14, border:"1px dashed #2a2a3a", textAlign:"center", color:"#374151" }}><TestTube2 size={40} style={{ opacity:0.3, marginBottom:16 }}/><div style={{ fontSize:14, fontWeight:600, color:"#6b7280", marginBottom:8 }}>Configure and run a backtest</div><div style={{ fontSize:11, lineHeight:1.6 }}>Pick a symbol, timeframe, and strategy<br/>then click Run Backtest to see results.</div></div>
          )}

          {result && m && (
            <>
              {/* Source badge + summary */}
              <div style={{ borderRadius:12, border:`1px solid ${m.totalPnl>=0?"rgba(16,185,129,0.25)":"rgba(239,68,68,0.25)"}`, background:`linear-gradient(135deg,${m.totalPnl>=0?"rgba(16,185,129,0.07)":"rgba(239,68,68,0.07)"},rgba(13,17,32,0.9))`, padding:"14px 18px" }}><div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}><div><div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}><span style={{ fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:8, background:result.source==="cached"?"rgba(245,158,11,0.12)":result.source==="live"?"rgba(52,211,153,0.12)":result.source==="sim"?"rgba(99,102,241,0.12)":"rgba(245,158,11,0.12)", color:result.source==="cached"?"#f59e0b":result.source==="live"?"#10b981":result.source==="sim"?"#6366f1":"#f59e0b" }}>
                        {result.source==="cached"?" Cached":result.source==="live"?" Live Data":result.source==="sim"?" Simulated":" Fallback"}
                      </span><span style={{ fontSize:9, color:"#6b7280" }}>{result.symbol} · {result.tfId} · {m.totalTrades} trades</span></div><div style={{ fontSize:22, fontWeight:800, fontFamily:"monospace", color:m.totalPnl>=0?"#10b981":"#ef4444" }}>
                      {m.totalPnl>=0?"+":""}{m.totalPnl.toFixed(2)}
                      <span style={{ fontSize:13, fontWeight:600, marginLeft:8 }}>{m.totalPnl>=0?"+":""}{m.returnPct}%</span></div></div><div style={{ textAlign:"right" }}><div style={{ fontSize:10, color:"#6b7280" }}>Final balance</div><div style={{ fontSize:16, fontWeight:700, fontFamily:"monospace", color:"#ffffff" }}>${m.finalBalance.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div></div></div>

              {/* Equity curve */}
              {result.equity.length >1 && (<div style={{ borderRadius:12, border:"1px solid rgba(51,65,85,0.6)", background:"rgba(15,23,42,0.85)", padding:"14px 16px 8px" }}><div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}><span style={{ fontSize:11, fontWeight:600, color:"#9ca3af" }}>Equity Curve</span><span style={{ fontSize:10, color:"#6b7280", fontFamily:"monospace" }}>Max DD:<span style={{ color:"#ef4444" }}>-{m.maxDrawdown}%</span></span></div><ResponsiveContainer width="100%" height={180}><AreaChart data={result.equity} margin={{ top:4, right:4, left:-20, bottom:0 }}><defs><linearGradient id="btGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={lineClr} stopOpacity={0.25}/><stop offset="95%" stopColor={lineClr} stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" vertical={false}/><XAxis dataKey="label" tick={{ fontSize:8, fill:"#6b7280" }} tickLine={false} axisLine={false} interval="preserveStartEnd"/><YAxis tick={{ fontSize:8, fill:"#6b7280" }} tickLine={false} axisLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/><Tooltip contentStyle={{ background:"#111118", border:"1px solid #2a2a3a", borderRadius:8, fontSize:10 }} formatter={(v)=>[`$${v.toFixed(2)}`,"Balance"]} itemStyle={{ color:lineClr }}/><Area type="monotone" dataKey="balance" stroke={lineClr} strokeWidth={2} fill="url(#btGrad2)" dot={false}/></AreaChart></ResponsiveContainer></div>
              )}

              {/* Tabs */}
              <div style={{ borderRadius:12, border:"1px solid #2a2a3a", background:"#111118", overflow:"hidden" }}><div style={{ display:"flex", borderBottom:"1px solid #2a2a3a" }}>
                  {[["metrics"," Metrics"],["trades"," Trades"]].map(([id,label]) =>(<button key={id} onClick={()=>setTradeTab(id)} style={{ flex:1, padding:"10px", border:"none", background:tradeTab===id?"rgba(99,102,241,0.06)":"transparent", color:tradeTab===id?"#6366f1":"#6b7280", fontSize:11, fontWeight:700, cursor:"pointer", borderBottom:tradeTab===id?"2px solid #6366f1":"2px solid transparent" }}>{label}</button>
                  ))}
                </div>

                {tradeTab === "metrics" && (
                  <div style={{ padding:"16px" }}><div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:12 }}>
                      {[
                        { label:"Win Rate",     val:`${m.winRate}%`,                color:m.winRate>=50?"#10b981":"#f59e0b" },
                        { label:"Profit Factor",val:m.profitFactor===999?"∞":String(m.profitFactor), color:m.profitFactor>=1.5?"#10b981":m.profitFactor>=1?"#f59e0b":"#ef4444" },
                        { label:"Max Drawdown", val:`-${m.maxDrawdown}%`,           color:m.maxDrawdown>20?"#ef4444":m.maxDrawdown>10?"#f59e0b":"#10b981" },
                        { label:"Trades",       val:String(m.totalTrades),          color:"#9ca3af" },
                        { label:"W / L",        val:`${m.wins} / ${m.losses}`,      color:"#9ca3af" },
                        { label:"Avg Hold",     val:`${m.avgHoldBars} bars`,        color:"#9ca3af" },
                        { label:"Avg Win",      val:`+${m.avgWin.toFixed(2)}`,      color:"#10b981" },
                        { label:"Avg Loss",     val:`-${m.avgLoss.toFixed(2)}`,     color:"#ef4444" },
                        { label:"Expectancy",   val:m.expectancy.toFixed(4),        color:m.expectancy>0?"#10b981":"#ef4444" },
                        { label:"SL Hits",      val:String(m.slHits),              color:"#ef4444" },
                        { label:"TP Hits",      val:String(m.tpHits),              color:"#10b981" },
                        { label:"Return",       val:`${m.returnPct}%`,              color:m.returnPct>=0?"#10b981":"#ef4444" },
                      ].map(({ label,val,color }) =>(<div key={label} style={{ background:"#1a1a24", borderRadius:8, padding:"9px 10px" }}><div style={{ fontSize:8, color:"#374151", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>{label}</div><div style={{ fontSize:13, fontWeight:700, fontFamily:"monospace", color }}>{val}</div></div>
                      ))}
                    </div><div style={{ padding:"8px 12px", borderRadius:7, background:"rgba(99,102,241,0.06)", border:"1px solid rgba(99,102,241,0.15)", fontSize:10, color:"#6b7280" }}>
                      R:R 1:{(tpPct/slPct).toFixed(1)} · SL {slPct}% · TP {tpPct}% · Risk {riskPct}%/trade
                    </div></div>
                )}

                {tradeTab === "trades" && (
                  <div style={{ overflowX:"auto", maxHeight:340 }}><table style={{ width:"100%", borderCollapse:"collapse", minWidth:480 }}><thead><tr style={{ background:"rgba(10,15,30,0.95)" }}>
                          {["#","Entry","Exit","PnL","Hold","Exit"].map(h =>(<th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:9, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", borderBottom:"1px solid rgba(30,41,59,0.8)", whiteSpace:"nowrap" }}>{h}</th>
                          ))}
                        </tr></thead><tbody>
                        {result.trades.map((t,idx) =>(<tr key={t.id} style={{ borderBottom:"1px solid rgba(30,41,59,0.4)" }} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"} onMouseLeave={e=>e.currentTarget.style.background=""}><td style={{ padding:"7px 12px", fontSize:11, color:"#374151", fontFamily:"monospace" }}>{idx+1}</td><td style={{ padding:"7px 12px", fontSize:11, fontFamily:"monospace", color:"#9ca3af" }}>{t.entryPrice.toFixed(2)}</td><td style={{ padding:"7px 12px", fontSize:11, fontFamily:"monospace", color:"#9ca3af" }}>{t.exitPrice.toFixed(2)}</td><td style={{ padding:"7px 12px", fontSize:11, fontFamily:"monospace", fontWeight:700, color:(t.pnl??0)>=0?"#10b981":"#ef4444" }}>{(t.pnl??0)>=0?"+":""}{(t.pnl??0).toFixed(4)}</td><td style={{ padding:"7px 12px", fontSize:11, fontFamily:"monospace", color:"#6b7280" }}>{t.holdBars}</td><td style={{ padding:"7px 12px" }}><span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:8, background:t.exitReason==="TP"?"rgba(52,211,153,0.1)":t.exitReason==="SL"?"rgba(239,68,68,0.1)":"rgba(99,102,241,0.1)", color:t.exitReason==="TP"?"#10b981":t.exitReason==="SL"?"#ef4444":"#6366f1" }}>{t.exitReason}</span></td></tr>
                        ))}
                      </tbody></table></div>
                )}
              </div><div style={{ padding:"10px 14px", borderRadius:9, background:"rgba(245,158,11,0.05)", border:"1px solid rgba(245,158,11,0.15)", fontSize:10, color:"#78716c", lineHeight:1.6 }}>️<strong style={{ color:"#f59e0b" }}>Backtest ≠ live performance.</strong>{" "}
                {result.source==="live"
                  ? `Real historical data was used — but past performance doesn't guarantee future results.`
                  : result.source==="cached"
                  ? "Cached historical data was used."
                  : "Simulated price data was used — results are illustrative only."}
                {result.note && <><br/><span style={{ color:"#6b7280" }}>{result.note}</span></>}
              </div></>
          )}
        </div></div></div>
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
    padding:"8px 12px", borderRadius:8, background:"#1a1a24",
    border:"1px solid #2a2a3a", fontSize:13, fontWeight:700,
    color:"#ffffff", outline:"none", cursor:"pointer", textAlign:"center",
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:90, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}><div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(4px)" }}/><div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:300, borderRadius:14, border:"1px solid #2a2a3a", background:"#111118", boxShadow:"0 20px 50px rgba(0,0,0,0.6)", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:"1px solid #2a2a3a" }}><span style={{ fontSize:13, fontWeight:700, color:"#ffffff", display:"flex", alignItems:"center", gap:7 }}><Calendar size={14} style={{ color:"#6366f1" }}/>Set Trade Date</span><button onClick={onClose} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer" }}><X size={15}/></button></div><div style={{ padding:"20px 18px", display:"flex", flexDirection:"column", gap:16 }}>
          {/* Trade info */}
          <div style={{ fontSize:11, color:"#6b7280", textAlign:"center" }}><span style={{ fontWeight:700, color:"#9ca3af" }}>{trade.pair ?? "Trade"}</span>
            {" · "}{trade.type?.toUpperCase()}{" · "}
            <span style={{ color:(trade.pnl??0)>=0?"#10b981":"#ef4444", fontWeight:700 }}>
              {(trade.pnl??0)>=0?"+":""}{(trade.pnl??0).toFixed(2)}
            </span></div>

          {/* Pickers */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            {/* Month */}
            <div style={{ textAlign:"center" }}><div style={{ fontSize:9, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Month</div><select value={month} onChange={e => { setMonth(Number(e.target.value)); setDay(d => Math.min(d, new Date(year, Number(e.target.value), 0).getDate())); }} style={sel}>
                {MONTH_NAMES.map((name, i) =><option key={i} value={i+1}>{name.slice(0,3)}</option>)}
              </select></div>

            {/* Day */}
            <div style={{ textAlign:"center" }}><div style={{ fontSize:9, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Day</div><select value={day} onChange={e => setDay(Number(e.target.value))} style={sel}>
                {Array.from({length: daysInMonth}, (_, i) => i+1).map(d =><option key={d} value={d}>{d}</option>)}
              </select></div>

            {/* Year */}
            <div style={{ textAlign:"center" }}><div style={{ fontSize:9, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>Year</div><select value={year} onChange={e => setYear(Number(e.target.value))} style={sel}>
                {Array.from({length: 10}, (_, i) => new Date().getFullYear() - i).map(y =><option key={y} value={y}>{y}</option>)}
              </select></div></div>

          {/* Preview */}
          <div style={{ textAlign:"center", fontSize:12, color:"#6b7280", fontFamily:"monospace" }}>
            {MONTH_NAMES[month-1]} {day}, {year}
          </div>

          {/* Buttons */}
          <div style={{ display:"flex", gap:8 }}><button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid #2a2a3a", background:"transparent", color:"#6b7280", fontSize:12, fontWeight:600, cursor:"pointer" }}>Cancel</button><button onClick={save} style={{ flex:2, padding:"10px", borderRadius:9, border:"none", background:"#6366f1", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>Set Date</button></div></div></div></div>
  );
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const WEEKDAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MOODS = ["Focused","Confident","Neutral","Anxious","Distracted"];

// ── Daily notes helpers (localStorage-backed) ────────────────
function dailyNotesKey(username, dateStr) {
  return `nexyru_daily_notes_${username}_${dateStr}`;
}
function loadDailyNotes(username, dateStr) {
  if (!username || !dateStr) return null;
  try {
    const raw = localStorage.getItem(dailyNotesKey(username, dateStr));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveDailyNotesEntry(username, dateStr, data) {
  if (!username || !dateStr) return;
  try {
    localStorage.setItem(dailyNotesKey(username, dateStr), JSON.stringify({ ...data, date: dateStr }));
    window.dispatchEvent(new CustomEvent("nexyruDailyNotesUpdate"));
  } catch {}
}
function hasDailyNotes(username, dateStr) {
  const n = loadDailyNotes(username, dateStr);
  return !!(n && (n.plan?.trim() || n.review?.trim() || n.mood));
}
function loadAllDailyNotes(username) {
  if (!username) return [];
  const prefix = `nexyru_daily_notes_${username}_`;
  const list = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        try {
          const obj = JSON.parse(localStorage.getItem(k) || "");
          if (obj && obj.date) list.push(obj);
        } catch {}
      }
    }
  } catch {}
  return list.sort((a,b) => (b.date || "").localeCompare(a.date || ""));
}
function todayKeyStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function formatNotesDateLong(dateStr) {
  if (!dateStr) return "";
  const [y,m,d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m||1)-1, d||1);
  return `${WEEKDAY_NAMES[dt.getDay()]}, ${MONTH_NAMES[dt.getMonth()]} ${dt.getDate()}`;
}

// ── Mood pill ─────────────────────────────────────────────────
function MoodBadge({ mood }) {
  if (!mood) return null;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", padding:"3px 9px", borderRadius:999, background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.35)", color:"#a5b4fc", fontSize:10, fontWeight:700, letterSpacing:"0.02em" }}>
      {mood}
    </span>
  );
}

// ── Daily notes card (edit) ───────────────────────────────────
function DailyNotesCard({ username, dateKey, dateLabel, autoFocus = false }) {
  const [plan, setPlan]     = useState("");
  const [review, setReview] = useState("");
  const [mood, setMood]     = useState("");
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    const d = loadDailyNotes(username, dateKey);
    setPlan(d?.plan ?? "");
    setReview(d?.review ?? "");
    setMood(d?.mood ?? "");
  }, [username, dateKey]);

  const handleSave = () => {
    saveDailyNotesEntry(username, dateKey, { plan, review, mood });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const taStyle = {
    width:"100%", height:120, padding:"10px 12px", borderRadius:9, boxSizing:"border-box",
    background:"#0a0a0f", border:"1px solid #1e1e1e", color:"#e5e7eb",
    fontSize:12, fontFamily:"inherit", resize:"vertical", outline:"none",
    transition:"border-color 0.15s",
  };
  const onFocus = e => { e.target.style.borderColor = "#6366f1"; };
  const onBlur  = e => { e.target.style.borderColor = "#1e1e1e"; };

  return (
    <div style={{ borderRadius:14, border:"1px solid #2a2a3a", background:"#111118", padding:18 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, flexWrap:"wrap", gap:8 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:"#ffffff", display:"flex", alignItems:"center", gap:8 }}>
            <BookOpen size={14} style={{ color:"#6366f1" }}/>Daily Notes
          </div>
          <div style={{ fontSize:11, color:"#6b7280", marginTop:3 }}>{dateLabel}</div>
        </div>
        {saved && (
          <span style={{ fontSize:10, fontWeight:700, color:"#10b981", background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.3)", padding:"3px 10px", borderRadius:999 }}>
            Saved
          </span>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:12 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Pre-Session Plan</div>
          <textarea
            autoFocus={autoFocus}
            value={plan}
            onChange={e => setPlan(e.target.value)}
            placeholder="What's your plan for today? Key levels, news events, max trades..."
            onFocus={onFocus} onBlur={onBlur}
            style={taStyle}
          />
        </div>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Post-Session Review</div>
          <textarea
            value={review}
            onChange={e => setReview(e.target.value)}
            placeholder="How did the session go? What did you do well? What to improve?"
            onFocus={onFocus} onBlur={onBlur}
            style={taStyle}
          />
        </div>
      </div>

      <div style={{ marginTop:14 }}>
        <div style={{ fontSize:10, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Mood</div>
        <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
          {MOODS.map(m => {
            const active = mood === m;
            return (
              <button key={m} onClick={() => setMood(active ? "" : m)}
                style={{
                  padding:"7px 14px", borderRadius:999, cursor:"pointer", fontSize:11, fontWeight:700,
                  background: active ? "rgba(99,102,241,0.16)" : "#111111",
                  border: active ? "1px solid #6366f1" : "1px solid #2a2a3a",
                  color: active ? "#a5b4fc" : "#9ca3af",
                  transition:"all 0.12s",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#1a1a1a"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "#111111"; }}
              >{m}</button>
            );
          })}
        </div>
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16 }}>
        <button onClick={handleSave}
          style={{ padding:"9px 20px", borderRadius:9, border:"none", background:"#6366f1", color:"#ffffff", fontSize:12, fontWeight:700, cursor:"pointer", transition:"background 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background = "#4f46e5"}
          onMouseLeave={e => e.currentTarget.style.background = "#6366f1"}
        >Save Notes</button>
      </div>
    </div>
  );
}

// ── Selected-day notes panel (read-only + edit toggle) ────────
function SelectedDayNotes({ username, dateKey, dateLabel }) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setNotes(loadDailyNotes(username, dateKey));
  }, [username, dateKey, tick, editing]);

  useEffect(() => {
    const h = () => setTick(t => t + 1);
    window.addEventListener("nexyruDailyNotesUpdate", h);
    return () => window.removeEventListener("nexyruDailyNotesUpdate", h);
  }, []);

  if (editing) {
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        <DailyNotesCard username={username} dateKey={dateKey} dateLabel={`Editing notes for ${dateLabel}`} autoFocus/>
        <div style={{ display:"flex", justifyContent:"flex-end" }}>
          <button onClick={() => setEditing(false)} style={{ padding:"7px 14px", borderRadius:8, border:"1px solid #2a2a3a", background:"transparent", color:"#9ca3af", fontSize:11, fontWeight:700, cursor:"pointer" }}>Done</button>
        </div>
      </div>
    );
  }

  const empty = !notes || (!notes.plan?.trim() && !notes.review?.trim() && !notes.mood);

  return (
    <div style={{ borderRadius:12, border:"1px solid #2a2a3a", background:"#111118", overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid #2a2a3a" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <BookOpen size={13} style={{ color:"#6366f1" }}/>
          <span style={{ fontSize:13, fontWeight:700, color:"#ffffff" }}>Notes for {dateLabel}</span>
          {notes?.mood && <MoodBadge mood={notes.mood}/>}
        </div>
        <button onClick={() => setEditing(true)} style={{ padding:"5px 12px", borderRadius:7, border:"1px solid rgba(99,102,241,0.35)", background:"rgba(99,102,241,0.08)", color:"#a5b4fc", fontSize:10, fontWeight:700, cursor:"pointer" }}>
          {empty ? "Add Notes" : "Edit"}
        </button>
      </div>

      {empty ? (
        <div style={{ padding:"20px 16px", color:"#6b7280", fontSize:12 }}>
          No notes for this day yet. Click "Add Notes" to write your pre-session plan or post-session review.
        </div>
      ) : (
        <div style={{ padding:"14px 16px", display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:12 }}>
          <div style={{ borderRadius:10, background:"#0a0a0f", border:"1px solid #1e1e1e", padding:"10px 12px" }}>
            <div style={{ fontSize:9, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Pre-Session Plan</div>
            <div style={{ fontSize:12, color: notes.plan ? "#e5e7eb" : "#4b5563", whiteSpace:"pre-wrap", lineHeight:1.5 }}>
              {notes.plan || "—"}
            </div>
          </div>
          <div style={{ borderRadius:10, background:"#0a0a0f", border:"1px solid #1e1e1e", padding:"10px 12px" }}>
            <div style={{ fontSize:9, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>Post-Session Review</div>
            <div style={{ fontSize:12, color: notes.review ? "#e5e7eb" : "#4b5563", whiteSpace:"pre-wrap", lineHeight:1.5 }}>
              {notes.review || "—"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Daily notes modal (used from TradeTable) ──────────────────
function DailyNotesModal({ username, dateKey, dateLabel, onClose }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div onClick={e => e.stopPropagation()} style={{ width:"100%", maxWidth:720, maxHeight:"90vh", overflow:"auto", borderRadius:14, border:"1px solid #2a2a3a", background:"#0f0f14" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:"1px solid #2a2a3a" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, fontWeight:700, color:"#ffffff" }}>
            <BookOpen size={14} style={{ color:"#6366f1" }}/>Notes — {dateLabel}
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer" }}><X size={15}/></button>
        </div>
        <div style={{ padding:18 }}>
          <DailyNotesCard username={username} dateKey={dateKey} dateLabel={dateLabel}/>
        </div>
      </div>
    </div>
  );
}


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

function CalendarPage({ trades, onEditTrade, onSaveTrade, username }) {
  const today = new Date();
  const [year,        setYear]        = useState(today.getFullYear());
  const [month,       setMonth]       = useState(today.getMonth());
  const [selected,    setSelected]    = useState(null);
  const [datePicking, setDatePicking] = useState(null); // trade being date-picked

  const todayKey   = todayKeyStr(today);
  const todayLabel = `${WEEKDAY_NAMES[today.getDay()]}, ${MONTH_NAMES[today.getMonth()]} ${today.getDate()}`;

  const byDay = useMemo(() => groupByDay(trades), [trades]);

  const unknownTrades = useMemo(() => trades.filter(isUnknownDate), [trades]);

  // Build calendar grid — array of weeks, each week is 7 cells (null = padding)
  const grid = useMemo(() => {
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [...Array(firstDay).fill(null), ...Array.from({length: daysInMonth}, (_,i) =>i+1)];
 while (cells.length % 7) cells.push(null);
 const weeks = [];
 for (let i = 0; i< cells.length; i += 7) weeks.push(cells.slice(i, i+7));
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
    if (pnl > 0)  return pnl >50 ? "rgba(16,185,129,0.28)" : "rgba(16,185,129,0.14)";
 if (pnl< 0)  return pnl < -50? "rgba(239,68,68,0.28)"  : "rgba(239,68,68,0.14)";
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
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}><div><div style={{ fontSize:20, fontWeight:800, color:"#ffffff", display:"flex", alignItems:"center", gap:10 }}><Calendar size={20} style={{ color:"#6366f1" }}/>Trade Calendar</div><div style={{ fontSize:11, color:"#6b7280", marginTop:3 }}>Daily activity · green = profit · red = loss · click a day to drill in</div></div><div style={{ display:"flex", alignItems:"center", gap:6 }}><button onClick={prevMonth} style={{ width:32, height:32, borderRadius:8, border:"1px solid #2a2a3a", background:"#1a1a24", color:"#9ca3af", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button><div style={{ minWidth:170, textAlign:"center", fontSize:14, fontWeight:700, color:"#ffffff" }}>{MONTH_NAMES[month]} {year}</div><button onClick={nextMonth} style={{ width:32, height:32, borderRadius:8, border:"1px solid #2a2a3a", background:"#1a1a24", color:"#9ca3af", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>›</button><button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }} style={{ padding:"5px 12px", borderRadius:7, border:"1px solid #2a2a3a", background:"#1a1a24", color:"#6b7280", fontSize:11, fontWeight:600, cursor:"pointer" }}>Today</button></div></div>

      {/* Monthly summary */}
      {monthStats.total >0 && (<div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
          {[
            { label:"Trades this month", val:String(monthStats.total),                                       color:"#9ca3af" },
            { label:"Wins",              val:String(monthStats.wins),                                        color:"#10b981" },
            { label:"Losses",            val:String(monthStats.losses),                                      color:"#ef4444" },
            { label:"Net PnL",           val:`${(monthStats.pnl??0)>=0?"+":""}${(monthStats.pnl??0).toFixed(2)}`,                 color:(monthStats.pnl??0)>=0?"#10b981":"#ef4444" },
          ].map(({ label, val, color }) =>(<div key={label} style={{ borderRadius:10, border:"1px solid #2a2a3a", background:"#111118", padding:"10px 14px" }}><div style={{ fontSize:9, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>{label}</div><div style={{ fontSize:20, fontWeight:800, fontFamily:"monospace", color }}>{val}</div></div>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      <div style={{ borderRadius:14, border:"1px solid #2a2a3a", background:"#111118", overflow:"hidden" }}>
        {/* Day-of-week header */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom:"1px solid #2a2a3a" }}>
          {DAY_LABELS.map(d =>(<div key={d} style={{ padding:"8px 4px", textAlign:"center", fontSize:10, fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.07em" }}>{d}</div>
          ))}
        </div>

        {grid.map((week, wi) =>(<div key={wi} style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom: wi < grid.length-1 ? "1px solid rgba(30,41,59,0.4)" : "none" }}>
            {week.map((day, di) => {
              if (!day) return <div key={di} style={{ minHeight:80, borderRight: di<6 ? "1px solid rgba(30,41,59,0.4)" : "none" }}/>;

              const key   = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const ts    = byDay[key] ?? [];
              const pnl   = +ts.reduce((s,t) =>s+(t.pnl??0), 0).toFixed(2);
 const isToday = day===today.getDate() && month===today.getMonth() && year===today.getFullYear();
 const isSelected = selected?.key === key;

 return (<div key={di} onClick={() => selectDay(day)} style={{
                  minHeight:80, padding:"6px 7px", position:"relative",
                  background: isSelected ? "rgba(99,102,241,0.08)" : (dayBg(pnl, ts.length) ?? "transparent"),
                  border: isSelected ? "2px solid rgba(99,102,241,0.4)" : "none",
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
                      <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:20, height:20, borderRadius:"50%", background:"#6366f1", color:"#000", fontSize:10, fontWeight:800 }}>{day}</span>) : (<span style={{ fontSize:11, fontWeight:500, color: ts.length?"#9ca3af":"#374151" }}>{day}</span>
                    )}
                  </div>

                  {/* PnL + count */}
                  {ts.length >0 && (<><div style={{ fontSize:10, fontWeight:800, fontFamily:"monospace", color:pnl>=0?"#10b981":"#ef4444", lineHeight:1.2 }}>
                        {pnl>=0?"+":""}{pnl}
                      </div><div style={{ fontSize:8, color:"#6b7280", marginTop:2 }}>
                        {ts.length} trade{ts.length!==1?"s":""}
                      </div>
                      {/* Dot strip */}
                      <div style={{ display:"flex", flexWrap:"wrap", gap:2, marginTop:5 }}>
                        {ts.slice(0,8).map((t,i) =>(<div key={i} style={{ width:5, height:5, borderRadius:"50%", background:(t.pnl??0)>=0?"#10b981":"#ef4444", flexShrink:0 }}/>
                        ))}
                        {ts.length>8 &&<span style={{ fontSize:7, color:"#6b7280", lineHeight:"5px" }}>+{ts.length-8}</span>}
                      </div></>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Selected day detail */}
      {selected && (
        <div style={{ borderRadius:12, border:"1px solid rgba(99,102,241,0.25)", background:"#111118", overflow:"hidden" }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid #2a2a3a" }}><div style={{ display:"flex", alignItems:"center", gap:8 }}><Calendar size={13} style={{ color:"#6366f1" }}/><span style={{ fontSize:13, fontWeight:700, color:"#ffffff" }}>{selected.label}</span><span style={{ fontSize:10, color:"#6b7280" }}>— {selected.trades.length} trade{selected.trades.length!==1?"s":""}</span>
              {/* Day PnL */}
              <span style={{ fontSize:12, fontFamily:"monospace", fontWeight:700, color: selected.trades.reduce((s,t)=>s+(t.pnl??0),0)>=0?"#10b981":"#ef4444" }}>
                {selected.trades.reduce((s,t)=>s+(t.pnl??0),0)>=0?"+":""}{selected.trades.reduce((s,t)=>s+(t.pnl??0),0).toFixed(2)}
              </span></div><button onClick={()=>setSelected(null)} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer" }}><X size={14}/></button></div><div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:7 }}>
            {selected.trades.map(t => {
              const w = (t.pnl??0)>=0;
 return (<div key={t.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 12px", borderRadius:8, background:"#1a1a24", border:`1px solid ${w?"rgba(16,185,129,0.18)":"rgba(239,68,68,0.18)"}` }}><div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}><span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:4, background:t.type==="long"?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.12)", color:t.type==="long"?"#10b981":"#ef4444", flexShrink:0 }}>
                      {t.type==="long"?"▲":"▼"} {t.type?.toUpperCase()}
                    </span><div style={{ minWidth:0 }}><div style={{ fontSize:12, fontWeight:700, color:"#ffffff" }}>{t.pair}</div><div style={{ fontSize:9, color:"#6b7280" }}>{t.strategy} · {new Date(t.date).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div></div></div><div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}><div style={{ textAlign:"right" }}><div style={{ fontSize:13, fontWeight:700, fontFamily:"monospace", color:w?"#10b981":"#ef4444" }}>{w?"+":""}{(t.pnl??0).toFixed(2)}</div><div style={{ fontSize:9, color:w?"#10b981":"#ef4444", opacity:0.7 }}>{(t.pnlPercent??0)>=0?"+":""}{(t.pnlPercent??0).toFixed(2)}%</div></div><button onClick={() => onEditTrade(t)} style={{ padding:"4px 8px", borderRadius:6, border:"1px solid #2a2a3a", background:"transparent", color:"#6b7280", cursor:"pointer" }}><Edit2 size={10}/></button></div></div>
              );
            })}
          </div></div>
      )}

      {/* Unknown date section */}
      {unknownTrades.length >0 && (<div style={{ borderRadius:12, border:"1px solid rgba(245,158,11,0.25)", background:"#111118", overflow:"hidden" }}><div style={{ padding:"12px 16px", borderBottom:"1px solid #2a2a3a", display:"flex", alignItems:"center", gap:10 }}><span style={{ fontSize:16 }}></span><div><div style={{ fontSize:13, fontWeight:700, color:"#f59e0b" }}>Unknown Date</div><div style={{ fontSize:10, color:"#6b7280" }}>
                {unknownTrades.length} screenshot trade{unknownTrades.length!==1?"s":""} where no date was visible — click "Set Date" to add them to the calendar
              </div></div></div><div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:7 }}>
            {unknownTrades.map(t => {
              const w = (t.pnl??0)>=0;
 return (<div key={t.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 12px", borderRadius:8, background:"#1a1a24", border:"1px solid rgba(245,158,11,0.12)" }}><div style={{ display:"flex", alignItems:"center", gap:10 }}><span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:4, background:"rgba(245,158,11,0.1)", color:"#f59e0b", flexShrink:0 }}>NO DATE</span><div><div style={{ fontSize:12, fontWeight:700, color:"#ffffff" }}>{t.pair ?? "Unknown"}</div><div style={{ fontSize:9, color:"#6b7280" }}>{t.strategy}</div></div></div><div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}><div style={{ textAlign:"right" }}><div style={{ fontSize:13, fontWeight:700, fontFamily:"monospace", color:w?"#10b981":"#ef4444" }}>{w?"+":""}{(t.pnl??0).toFixed(2)}</div></div><button onClick={() => setDatePicking(t)} style={{ padding:"5px 10px", borderRadius:6, border:"1px solid rgba(245,158,11,0.3)", background:"rgba(245,158,11,0.06)", color:"#f59e0b", cursor:"pointer", fontSize:10, fontWeight:700 }}>Set Date</button></div></div>
              );
            })}
          </div></div>
      )}

      {/* Empty state */}
      {trades.length === 0 && (
        <div style={{ padding:"60px 24px", textAlign:"center", borderRadius:12, border:"1px dashed #2a2a3a", color:"#374151" }}><Calendar size={40} style={{ opacity:0.3, marginBottom:16 }}/><div style={{ fontSize:13, color:"#6b7280" }}>No trades yet — log your first trade to see it on the calendar</div></div>
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
  const isMobile = useIsMobile();

  const [isFirstVisit, setIsFirstVisit] = useState(false);
  useEffect(() => {
    if (!username) return;
    const key = `nexyru_first_visit_${username}`;
    try {
      const seen = localStorage.getItem(key);
      if (!seen) {
        setIsFirstVisit(true);
        localStorage.setItem(key, "1");
      }
    } catch {}
  }, [username]);
  const showImportHint = isFirstVisit && trades.length === 0 && !inDemo;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:32 }}>
      {/* AI Trade Review Modal */}
      {reviewTrade && <AITradeReview trade={reviewTrade} allTrades={trades} onClose={() => setReviewTrade(null)}/>}

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}><div><div style={{ fontSize:22, fontWeight:800, color:"#ffffff", letterSpacing:"-0.02em" }}>Journal</div>
          {activeAccount && (
            <div style={{ fontSize:12, color:"#6b7280", marginTop:4 }}>
              {activeAccount.name} · {trades.length} trade{trades.length!==1?"s":""}
            </div>
          )}
        </div><div style={{display: isMobile ? 'none' : 'flex', gap:8}}>
          <div style={{ position:"relative" }}>
            {showImportHint && (
              <style>{`@keyframes nexyruImportPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.55), 0 0 0 0 rgba(99,102,241,0); } 50% { box-shadow: 0 0 0 6px rgba(99,102,241,0), 0 0 18px 2px rgba(99,102,241,0.45); } }`}</style>
            )}
            <button onClick={inDemo ? undefined : onCSV}
              title={inDemo ? "Exit demo mode to import trades" : "Import CSV"}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", borderRadius:8, border:`1px solid ${showImportHint ? "rgba(99,102,241,0.65)" : "rgba(99,102,241,0.25)"}`, background:inDemo?"#111118":"rgba(99,102,241,0.06)", color:inDemo?"#374151":"#6366f1", fontSize:11, fontWeight:700, cursor:inDemo?"not-allowed":"pointer", textDecoration:"none", opacity:inDemo?0.5:1, animation: showImportHint ? "nexyruImportPulse 1.8s ease-in-out infinite" : undefined }}><Upload size={11}/>Import CSV</button>
            {showImportHint && (
              <div style={{ position:"absolute", top:"calc(100% + 10px)", right:0, background:"#111118", border:"1px solid rgba(99,102,241,0.45)", borderRadius:8, padding:"7px 12px", fontSize:10, fontWeight:600, color:"#6366f1", whiteSpace:"nowrap", boxShadow:"0 8px 24px rgba(0,0,0,0.5)", zIndex:50 }}><div style={{ position:"absolute", top:-5, right:24, width:9, height:9, background:"#111118", borderLeft:"1px solid rgba(99,102,241,0.45)", borderTop:"1px solid rgba(99,102,241,0.45)", transform:"rotate(45deg)" }}/>Start here — import your trades</div>
            )}
          </div><button onClick={inDemo ? undefined : onAdd} disabled={inDemo}
            title={inDemo ? "Exit demo mode to log trades" : "Log Trade"}
            style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 14px", borderRadius:8, border:"none", background:inDemo?"#111118":"var(--accent)", color:inDemo?"#374151":"#fff", fontSize:11, fontWeight:700, cursor:inDemo?"not-allowed":"pointer", opacity:inDemo?0.5:1 }}><Plus size={12}/>Log Trade</button></div></div>

      {/* Trades */}
      <section><TradeTable trades={trades} onEdit={onEdit} onDelete={onDelete} onReview={setReviewTrade} onAdd={inDemo ? undefined : onAdd} onImport={inDemo ? undefined : onCSV} username={username}/></section>

      {/* Divider */}
      <div style={{ display:"flex", alignItems:"center", gap:12 }}><div style={{ flex:1, height:1, background:"#2a2a3a" }}/><span style={{ fontSize:10, fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.07em", display:"flex", alignItems:"center", gap:5 }}><Calendar size={11}/>Calendar</span><div style={{ flex:1, height:1, background:"#2a2a3a" }}/></div>

      {/* Calendar */}
      <section><CalendarPage trades={trades} onEditTrade={t => onEdit(t)} onSaveTrade={onSaveTrade} username={username}/></section>

      {/* Divider */}
      <div style={{ display:"flex", alignItems:"center", gap:12 }}><div style={{ flex:1, height:1, background:"#2a2a3a" }}/><span style={{ fontSize:10, fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.07em", display:"flex", alignItems:"center", gap:5 }}><BarChart2 size={11}/>Analytics</span><div style={{ flex:1, height:1, background:"#2a2a3a" }}/></div>

      {/* Analytics */}
      <section><AnalyticsPanel trades={trades}/></section></div>
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

// ── Tools nav dropdown ────────────────────────────────────────
function ToolsDropdown({ onSelectTab }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const sections = [
    {
      heading: "Analyze",
      items: [
        { key:"psychology", href:"/psychology",        emoji:"", label:"Psychology",   color:"#ec4899" },
        { key:"setups",     href:"/setups",            emoji:"", label:"Best Setups",  color:"#22c55e" },
        { key:"insights",   tab:"insights",            emoji:"", label:"Insights",     color:"#f59e0b" },
      ],
    },
    {
      heading: "Manage",
      items: [
        { key:"checklist", href:"/checklist", emoji:"", label:"Checklist",     color:"#22d3a5" },
        { key:"alerts",    href:"/alerts",    emoji:"", label:"Alerts",        color:"#6366f1" },
        { key:"challenge", href:"/challenge", emoji:"", label:"Challenge",     color:"#a5b4fc" },
      ],
    },
    {
      heading: "Review",
      items: [
        { key:"replay",   href:"/replay",  emoji:"️", label:"Trade Review",  color:"#6366f1" },
        { key:"stratlab", tab:"stratlab",  emoji:"", label:"Strategy Lab",  color:"#6366f1" },
      ],
    },
  ];

  const handleClick = (e, item) => {
    if (item.tab) {
      e.preventDefault();
      setOpen(false);
      onSelectTab?.(item.tab);
    } else {
      setOpen(false);
    }
  };

  return (
    <div ref={ref} style={{ position:"relative" }}><button onClick={() => setOpen(o => !o)} style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", borderRadius:7, border:`1px solid ${open?"#6366f1":"#2a2a3a"}`, background:open?"rgba(99,102,241,0.08)":"transparent", color:open?"#6366f1":"#6b7280", fontSize:11, fontWeight:700, cursor:"pointer" }}>
        Tools {open ? "▲" : "▼"}
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 6px)", right:0, background:"#111118", border:"1px solid #2a2a3a", borderRadius:12, padding:"6px", minWidth:200, zIndex:100, boxShadow:"0 12px 40px rgba(0,0,0,0.6)" }}>
          {sections.map((section, sIdx) =>(<div key={section.heading} style={{ marginTop: sIdx === 0 ? 0 : 4 }}><div style={{ padding:"6px 10px 4px", fontSize:9, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.1em" }}>
                {section.heading}
              </div>
              {section.items.map(item =>(<a key={item.key} href={item.href ?? "#"} onClick={(e) => handleClick(e, item)} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", borderRadius:8, color:"#9ca3af", fontSize:12, fontWeight:600, textDecoration:"none", cursor:"pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#1a1a24"; e.currentTarget.style.color = item.color; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9ca3af"; }}><span style={{ fontSize:14 }}>{item.emoji}</span>
                  {item.label}
                </a>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────
function Skeleton({ width = "100%", height = 16, radius = 6, style = {} }) {
  return (
    <div style={{ width, height, borderRadius:radius, background:"linear-gradient(90deg,#2a2a3a 25%,#1e2540 50%,#2a2a3a 75%)", backgroundSize:"200% 100%", animation:"shimmer 1.5s infinite", flexShrink:0, ...style }}/>
  );
}

function SkeletonCard({ lines = 3 }) {
  return (
    <div style={{ background:"#111118", border:"1px solid #2a2a3a", borderRadius:12, padding:"16px", display:"flex", flexDirection:"column", gap:10 }}><Skeleton width="60%" height={14}/>
      {Array.from({length:lines-1}).map((_,i) =><Skeleton key={i} width={i===lines-2?"40%":"100%"} height={12}/>)}
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
    return d >= lastMonday && d<= lastSunday;
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
      const losses     = lastWeekTrades.filter(t =>(t.pnl??0)<= 0);
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
    <div style={{ borderRadius:16, border:`1px solid ${report ? "rgba(99,102,241,0.3)" : "#2a2a3a"}`, background: report ? "rgba(99,102,241,0.04)" : "#111118", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }} onClick={() => report && setExpanded(v => !v)}><div style={{ display:"flex", alignItems:"center", gap:10 }}><div style={{ width:34, height:34, borderRadius:10, background:"#6366f1", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}></div><div><div style={{ display:"flex", alignItems:"center", gap:6 }}><span style={{ fontSize:13, fontWeight:800, color:"#ffffff" }}>Weekly Report</span>
              {isMonday && <span style={{ fontSize:9, padding:"1px 7px", borderRadius:10, background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.25)", color:"#10b981", fontWeight:700 }}>NEW</span>}
            </div><div style={{ fontSize:10, color:"#6b7280", marginTop:1 }}>
              {weekLabel} · {lastWeekTrades.length} trade{lastWeekTrades.length!==1?"s":""}
              {lastGenerated && ` · Generated ${new Date(lastGenerated).toLocaleDateString()}`}
            </div></div></div><div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {!report && (
            <button onClick={e => { e.stopPropagation(); generateReport(); }} disabled={loading} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:9, border:"none", background:loading?"#2a2a3a":"#6366f1", color:loading?"#374151":"#fff", fontSize:11, fontWeight:700, cursor:loading?"not-allowed":"pointer" }}>
              {loading ? <><span style={{ display:"inline-block", width:10, height:10, border:"2px solid #374151", borderTopColor:"#6366f1", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>Generating…</>:<><Sparkles size={11}/>Generate Report</>}
            </button>
          )}
          {report && (
            <><button onClick={e => { e.stopPropagation(); generateReport(); }} disabled={loading} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 10px", borderRadius:7, border:"1px solid rgba(99,102,241,0.2)", background:"transparent", color:"#6366f1", fontSize:10, fontWeight:600, cursor:"pointer" }}><RefreshCw size={9}/> {loading ? "…" : "Refresh"}
              </button><ChevronDown size={14} style={{ color:"#6b7280", transform:expanded?"rotate(180deg)":"none", transition:"transform 0.2s", flexShrink:0 }}/></>
          )}
        </div></div>

      {/* Quick stats row — always visible */}
      {(() => {
        const wins    = lastWeekTrades.filter(t => (t.pnl??0) > 0);
        const wr      = Math.round(wins.length / lastWeekTrades.length * 100);
        const pnl     = lastWeekTrades.reduce((s,t) => s+(t.pnl??0), 0);
        const days    = new Set(lastWeekTrades.map(t => new Date(t.date).toDateString())).size;
        const pos     = pnl >= 0;
 return (<div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", borderTop:"1px solid #1a1a24" }}>
            {[
              { label:"Trades",  value:String(lastWeekTrades.length), color:"#9ca3af" },
              { label:"Win Rate",value:`${wr}%`,                      color:wr>=55?"#10b981":wr>=45?"#f59e0b":"#ef4444" },
              { label:"PnL",     value:`${pos?"+":""}${pnl.toFixed(2)}`, color:pos?"#10b981":"#ef4444" },
              { label:"Days",    value:String(days),                   color:"#6366f1" },
            ].map((s,i) =>(<div key={i} style={{ padding:"10px 0", textAlign:"center", borderRight:i<3?"1px solid #1a1a24":"none" }}><div style={{ fontSize:9, color:"#2a2a3a", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{s.label}</div><div style={{ fontSize:14, fontWeight:800, fontFamily:"monospace", color:s.color }}>{s.value}</div></div>
            ))}
          </div>
        );
      })()}

      {/* Report text */}
      {expanded && report && (
        <div style={{ padding:"16px 18px", borderTop:"1px solid #1a1a24" }}><div style={{ fontSize:12, color:"#9ca3af", lineHeight:2, whiteSpace:"pre-wrap" }}>
            {report.split(/\*\*(.*?)\*\*/g).map((part, i) =>i % 2 === 1
 ?<strong key={i} style={{ color:"#ffffff", fontWeight:700 }}>{part}</strong>
                : part
            )}
          </div></div>
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
    return d >= lastWeekStart && d< weekStart;
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
      emoji:   "",
      title:   `Log ${tradeTarget} Trades`,
      desc:    lastWeekCount >= 10 ? `↑ Bumped up from last week's ${lastWeekCount}` : "Track every trade this week",
      current: weekTrades.length,
      target:  tradeTarget,
      color:   "#6366f1",
    },
    {
      id:      "win_rate",
      emoji:   "",
      title:   `Hit ${wrTarget}% Win Rate`,
      desc:    lastWeekWr >= 60 ? `↑ You hit ${Math.round(lastWeekWr)}% last week!` : "Stay disciplined and selective",
      current: Math.round(weekWr),
      target:  wrTarget,
      color:   "#10b981",
      suffix:  "%",
      showAs:  `${Math.round(weekWr)}% (${weekWins}W/${weekTrades.length - weekWins}L)`,
    },
    {
      id:      "streak",
      emoji:   "",
      title:   `${streakTarget}-Win Streak`,
      desc:    maxStreak >= 3 ? `↑ You hit ${maxStreak} last week, go higher!` : "Win trades in a row",
      current: maxStreak,
      target:  streakTarget,
      color:   "#f59e0b",
    },
    {
      id:      "days",
      emoji:   "",
      title:   `Trade ${daysTarget} Days`,
      desc:    lastWeekDays >= 3 ? `↑ You traded ${lastWeekDays} days last week` : "Build a daily habit",
      current: tradingDays,
      target:  daysTarget,
      color:   "#a5b4fc",
      showAs:  `${tradingDays} day${tradingDays !== 1 ? "s" : ""}`,
    },
  ];

  const completed = CHALLENGES.filter(c => c.current >= c.target).length;
  const isAdaptive = lastWeekCount >0;

 return (<div style={{ borderRadius:16, border:"1px solid #2a2a3a", overflow:"hidden", background:"#111118" }}>
      {/* Header */}
      <div style={{ padding:"14px 16px", borderBottom:"1px solid #1a1a24", display:"flex", alignItems:"center", justifyContent:"space-between" }}><div style={{ display:"flex", alignItems:"center", gap:8 }}><span style={{ fontSize:16 }}></span><div><div style={{ display:"flex", alignItems:"center", gap:6 }}><div style={{ fontSize:13, fontWeight:800, color:"#ffffff" }}>Weekly Challenges</div>
              {isAdaptive && <span style={{ fontSize:9, padding:"1px 7px", borderRadius:10, background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.2)", color:"#f59e0b", fontWeight:700 }}>ADAPTIVE</span>}
            </div><div style={{ fontSize:10, color:"#6b7280", marginTop:1 }}>Resets Monday · {daysLeft} day{daysLeft !== 1 ? "s" : ""} left · {isAdaptive ? "Scaled from your last week" : "Complete all 4 to level up"}</div></div></div><div style={{ display:"flex", alignItems:"center", gap:8 }}><span style={{ fontSize:11, fontWeight:700, color: completed === CHALLENGES.length ? "#10b981" : "#6b7280" }}>
            {completed}/{CHALLENGES.length} done
          </span>
          {completed === CHALLENGES.length && (
            <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.25)", color:"#10b981", fontWeight:700 }}>All Complete!</span>
          )}
        </div></div>

      {/* Challenges grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:0 }}>
        {CHALLENGES.map((c, idx) => {
          const pct     = Math.min(100, (c.current / c.target) * 100);
          const done    = c.current >= c.target;
 const display = c.showAs ?? String(c.current);
 const isAdaptedUp = c.desc.startsWith("↑");

 return (<div key={c.id} style={{
              padding:"14px 16px",
              borderRight: idx % 2 === 0 ? "1px solid #1a1a24" : "none",
              borderBottom: idx < 2 ? "1px solid #1a1a24" : "none",
              background: done ? `${c.color}06` : "transparent",
              position:"relative", overflow:"hidden",
            }}>
              {done && <div style={{ position:"absolute", top:8, right:8, fontSize:16 }}></div>}

              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}><span style={{ fontSize:18 }}>{c.emoji}</span><div style={{ flex:1, minWidth:0 }}><div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ fontSize:12, fontWeight:800, color: done ? c.color : "#ffffff" }}>{c.title}</div>
                    {isAdaptedUp && <span style={{ fontSize:8, color:"#f59e0b", fontWeight:700 }}>↑ HARDER</span>}
                  </div><div style={{ fontSize:10, color: isAdaptedUp ? "#f59e0b" : "#6b7280", marginTop:1 }}>{c.desc}</div></div></div>

              {/* Progress bar */}
              <div style={{ height:4, borderRadius:2, background:"#2a2a3a", marginBottom:6, overflow:"hidden" }}><div style={{
                  width:`${pct}%`, height:"100%", borderRadius:2,
                  background: done
                    ? `linear-gradient(90deg,${c.color}aa,${c.color})`
                    : `linear-gradient(90deg,${c.color}55,${c.color}99)`,
                  transition:"width 0.6s ease",
                  boxShadow: done ? `0 0 8px ${c.color}66` : "none",
                }}/></div><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}><span style={{ fontSize:10, fontFamily:"monospace", color: done ? c.color : "#6b7280", fontWeight:700 }}>
                  {display} / {c.target}{c.suffix ?? ""}
                </span>
                {pct >0 && !done && (<span style={{ fontSize:9, color:"#374151" }}>{Math.round(pct)}%</span>
                )}
              </div></div>
          );
        })}
      </div>

      {/* Adaptive explanation — only show first time */}
      {!isAdaptive && (
        <div style={{ padding:"10px 16px", borderTop:"1px solid #1a1a24", fontSize:10, color:"#374151", lineHeight:1.5 }}>Complete all 4 challenges this week — next week the targets will automatically scale based on your performance.</div>
      )}
    </div>
  );
}

// ── First-time onboarding banner ──────────────────────────────
function OnboardingBanner({ onOpenImport, onDismiss }) {
  const steps = [
    { n:"1️⃣", label:"Import your trades",      cta:"Import CSV",        onClick: onOpenImport, href: null },
    { n:"2️⃣", label:"Set up your challenge",   cta:"Challenge Tracker", onClick: null,         href:"/challenge" },
    { n:"3️⃣", label:"Review your trades",      cta:"Trade Review",      onClick: null,         href:"/replay" },
  ];

  return (
    <div style={{
      position:"relative",
      background:"rgba(99,102,241,0.04)",
      borderLeft:"3px solid #6366f1",
      border:"1px solid #2a2a3a",
      borderLeftWidth:3,
      borderLeftColor:"#6366f1",
      borderRadius:10,
      padding:"14px 16px 28px",
    }}><div style={{ fontSize:13, fontWeight:700, color:"#ffffff", marginBottom:12 }}><span style={{ marginRight:6 }}></span>Welcome! Here's how to get started:</div><div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:10 }}>
        {steps.map(s =>(<div key={s.n} style={{ display:"flex", alignItems:"center", gap:10, fontSize:12, color:"#9ca3af" }}><span style={{ fontSize:14, flexShrink:0 }}>{s.n}</span><span style={{ flex:1, minWidth:0 }}>{s.label}</span>
            {s.href ? (
              <a href={s.href} style={{ padding:"5px 10px", borderRadius:7, border:"1px solid rgba(99,102,241,0.3)", background:"rgba(99,102,241,0.08)", color:"#6366f1", fontSize:10, fontWeight:700, textDecoration:"none", whiteSpace:"nowrap", flexShrink:0 }}>
                {s.cta}
              </a>) : (<button onClick={s.onClick} style={{ padding:"5px 10px", borderRadius:7, border:"1px solid rgba(99,102,241,0.3)", background:"rgba(99,102,241,0.08)", color:"#6366f1", fontSize:10, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
                {s.cta}
              </button>
            )}
          </div>
        ))}
      </div><button onClick={onDismiss}
        style={{ position:"absolute", bottom:6, right:10, padding:0, border:"none", background:"transparent", color:"#6b7280", fontSize:10, fontWeight:600, cursor:"pointer", textDecoration:"underline" }}
        onMouseEnter={e => { e.currentTarget.style.color = "#9ca3af"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "#6b7280"; }}>Dismiss</button></div>
  );
}

function DashboardHome({ trades, allTrades, onAddTrade, onOpenImport, activeAccount, onUpgradeAccount, username, onClearDemo, loading }) {
  const stats   = useMemo(() => computeStats(trades), [trades]);
  const recent  = useMemo(() => [...trades].sort((a,b)=>b.date-a.date).slice(0,5), [trades]);
  const pnlPos  = stats.totalPnl >= 0;
  const isMobile = useIsMobile();

  const [onboardingDismissed, setOnboardingDismissed] = useState(true);
  useEffect(() => {
    if (!username) return;
    try {
      setOnboardingDismissed(localStorage.getItem(`nexyru_onboarding_dismissed_${username}`) === "1");
    } catch { setOnboardingDismissed(false); }
  }, [username]);
  const dismissOnboarding = () => {
    try { localStorage.setItem(`nexyru_onboarding_dismissed_${username}`, "1"); } catch {}
    setOnboardingDismissed(true);
  };
  const showOnboarding = trades.length < 3 && !onboardingDismissed && username;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}><div><div style={{ fontSize:22, fontWeight:800, color:"#ffffff", letterSpacing:"-0.02em" }}>Dashboard</div><div style={{ fontSize:12, color:"#6b7280", marginTop:4 }}>Your trading journal & performance hub</div></div>{!isMobile && (<div style={{ display:"flex", gap:8 }}><button onClick={onAddTrade} style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 18px", borderRadius:9, border:"none", background:"var(--accent)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 16px rgba(99,102,241,0.25)" }}><Plus size={14}/>Log Trade</button></div>)}</div>

      {showOnboarding && <OnboardingBanner onOpenImport={onOpenImport} onDismiss={dismissOnboarding}/>}

      {/* Account stats card */}
      {activeAccount && <AccountStatsCard activeAccount={activeAccount} trades={allTrades ?? trades}/>}

      {trades.length >0 ? (
 (<div style={{ display:'flex', gap: isMobile ? 8 : 16, overflowX: isMobile ? 'auto' : 'visible', flexWrap: isMobile ? 'nowrap' : 'wrap', paddingBottom: isMobile ? 8 : 0, WebkitOverflowScrolling: 'touch' }}><div style={{ minWidth: isMobile ? '130px' : 'auto', flex: isMobile ? "0 0 130px" : "1 1 150px" }}><StatCard label="Total Trades" value={fmtNum(stats.totalTrades)} sub={`${stats.wins}W / ${stats.losses}L`} pos={null} icon={<Activity size={14}/>}/></div><div style={{ minWidth: isMobile ? '130px' : 'auto', flex: isMobile ? "0 0 130px" : "1 1 150px" }}><StatCard label="Win Rate"     value={fmtPct(stats.winRate)}       sub={`PF ${stats.profitFactor}`}         pos={stats.winRate>=50}   icon={<Zap size={14}/>}/></div><div style={{ minWidth: isMobile ? '130px' : 'auto', flex: isMobile ? "0 0 130px" : "1 1 150px" }}><StatCard label="Total PnL"    value={fmtMoney(stats.totalPnl ?? 0, { signed:true })} sub={`Avg W: ${fmtMoney(stats.avgWin ?? 0, { signed:true })}`} pos={pnlPos} icon={<TrendingUp size={14}/>}/></div><div style={{ minWidth: isMobile ? '130px' : 'auto', flex: isMobile ? "0 0 130px" : "1 1 150px" }}><StatCard label="Best Trade"   value={fmtMoney(stats.bestTrade ?? 0, { signed:true })}  pos={true}  icon={<Award size={14}/>}/></div><div style={{ minWidth: isMobile ? '130px' : 'auto', flex: isMobile ? "0 0 130px" : "1 1 150px" }}><StatCard label="Worst Trade"  value={fmtMoney(stats.worstTrade ?? 0, { signed:true })}  pos={false} icon={<TrendingDown size={14}/>}/></div></div>)
 ) : !showOnboarding && (<div style={{ padding:"56px 24px", borderRadius:16, border:"2px dashed #2a2a3a", textAlign:"center" }}><div style={{ fontSize:48, marginBottom:14, lineHeight:1 }}></div><div style={{ fontSize:17, fontWeight:700, color:"#9ca3af", marginBottom:8 }}>Your journal is empty</div><div style={{ fontSize:12, color:"#6b7280", marginBottom:24, lineHeight:1.6 }}>Import a CSV or log your first trade to get started.<br/>Nexyru analyzes your performance and gives you actionable insights.</div><div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}><button onClick={onAddTrade} style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 20px", borderRadius:10, border:"none", background:"var(--accent)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.15s", boxShadow:"0 4px 14px rgba(99,102,241,0.25)" }}><Plus size={14}/>Log Trade</button><button onClick={onOpenImport} style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 20px", borderRadius:10, border:"1px solid rgba(99,102,241,0.4)", background:"transparent", color:"#6366f1", fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}><Upload size={13}/>Import CSV</button></div></div>
      )}
      {/* Weekly Challenges — hidden for now */}
      {/* <WeeklyReport trades={trades}/> */}
      {/* <WeeklyChallenges trades={trades}/> */}

      {loading ? (
        <div style={{ borderRadius:12, border:"1px solid #2a2a3a", overflow:"hidden" }}><div style={{ padding:"12px 16px", borderBottom:"1px solid #2a2a3a", fontSize:12, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.1em" }}>Recent Trades</div><style>{`@keyframes nexyruPulse { 0%,100%{opacity:0.4} 50%{opacity:0.85} }`}</style>
          {[0,1,2].map(i =>(<div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid rgba(30,41,59,0.4)", borderLeft:"2px solid rgba(51,65,85,0.4)", minHeight:52 }}><div style={{ display:"flex", alignItems:"center", gap:10 }}><div style={{ width:26, height:14, borderRadius:4, background:"#2a2a3a", animation:`nexyruPulse 1.4s ease-in-out ${i*0.15}s infinite` }}/><div><div style={{ width:80, height:12, borderRadius:4, background:"#2a2a3a", animation:`nexyruPulse 1.4s ease-in-out ${i*0.15}s infinite`, marginBottom:5 }}/><div style={{ width:120, height:9, borderRadius:4, background:"#111118", animation:`nexyruPulse 1.4s ease-in-out ${i*0.15+0.05}s infinite` }}/></div></div><div style={{ width:70, height:14, borderRadius:4, background:"#2a2a3a", animation:`nexyruPulse 1.4s ease-in-out ${i*0.15+0.1}s infinite` }}/></div>
          ))}
        </div>
      ) : recent.length >0 && (<div style={{ borderRadius:12, border:"1px solid #2a2a3a", overflow:"hidden", background:"rgba(13,17,32,0.4)" }}><div style={{ padding:"12px 16px", borderBottom:"1px solid #2a2a3a", fontSize:12, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.1em" }}>Recent Trades</div>
          {recent.map((t, i) => {
            const w     = (t.pnl??0)>=0;
            const isLong= t.type === "long";
            const dotClr= isLong ? "#10b981" : "#ef4444";
            const pct   = t.pnlPercent ?? 0;
            const showPct = Math.abs(pct) >= 0.05;
 return (<div key={t.id}
                   style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderBottom: i === recent.length-1 ? "none" : "1px solid rgba(30,41,59,0.5)", cursor:"pointer", transition:"background 0.12s", minHeight:56 }}
                   onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.025)"}
                   onMouseLeave={e=>e.currentTarget.style.background=""}><div style={{ display:"flex", alignItems:"center", gap:12 }}><span style={{ width:8, height:8, borderRadius:"50%", background:dotClr, boxShadow:`0 0 8px ${dotClr}80`, flexShrink:0 }}/><div><div style={{ fontSize:14, fontWeight:700, color:"#ffffff", letterSpacing:"-0.01em" }}>{t.pair}</div><div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>{t.strategy ? `${t.strategy} · ` : ""}{new Date(t.date).toLocaleDateString()}</div></div></div><div style={{ textAlign:"right" }}><div style={{
                    fontSize:15,
                    fontWeight:700,
                    color:w?"#10b981":"#ef4444",
                    letterSpacing:"-0.01em",
                    fontFamily:'-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif',
                    fontVariantNumeric:"tabular-nums",
                  }}>{fmtMoney(t.pnl ?? 0, { signed:true })}</div>
                  {showPct && (
                    <div style={{ fontSize:11, color:w?"#10b981":"#ef4444", opacity:0.65, marginTop:2, fontVariantNumeric:"tabular-nums" }}>{fmtPct(pct, { signed:true })}</div>
                  )}
                </div></div>
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
  backtested: { label:"Backtested", color:"#6366f1", bg:"rgba(99,102,241,0.1)",  border:"rgba(99,102,241,0.3)"  },
  live:       { label:"Live",       color:"#10b981", bg:"rgba(52,211,153,0.1)",  border:"rgba(52,211,153,0.3)"  },
  verified:   { label:"✓ Verified", color:"#a5b4fc", bg:"rgba(165,180,252,0.12)",border:"rgba(165,180,252,0.4)" },
};

function StrategyCard({ name, username, return_pct, win_rate, drawdown, status = "backtested", onView, onClone }) {
  const pos    = return_pct >= 0;
  const badge  = STATUS_BADGE_STYLES[status] ?? STATUS_BADGE_STYLES.backtested;
  const ddHigh = drawdown > 20;
  const wrGood = win_rate >= 50;

 return (<div style={{
      background:"#111118", borderRadius:12,
      border:"1px solid #2a2a3a",
      padding:"1.25rem", display:"flex", flexDirection:"column", gap:14,
      transition:"border-color 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor="#263d55"}
      onMouseLeave={e => e.currentTarget.style.borderColor="#2a2a3a"}
    >
      {/* Header — name + badge */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10 }}><div style={{ minWidth:0 }}><div style={{ fontSize:15, fontWeight:700, color:"#ffffff", marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</div><div style={{ fontSize:11, color:"#6b7280", fontFamily:"monospace" }}>@{username}</div></div><span style={{ fontSize:9, fontWeight:700, padding:"3px 9px", borderRadius:20, flexShrink:0, background:badge.bg, color:badge.color, border:`1px solid ${badge.border}` }}>
          {badge.label}
        </span></div>

      {/* Return — hero stat */}
      <div><div style={{ fontSize:9, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:5 }}>Return</div><div style={{ fontSize:32, fontWeight:800, fontFamily:"monospace", lineHeight:1, color: pos?"#10b981":"#ef4444" }}>
          {pos?"+":""}{return_pct.toFixed(1)}%
        </div></div>

      {/* Stats grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}><div style={{ background:"#1a1a24", borderRadius:8, padding:"10px 12px" }}><div style={{ fontSize:9, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>Win rate</div><div style={{ fontSize:16, fontWeight:700, fontFamily:"monospace", color: wrGood?"#10b981":"#f59e0b" }}>{win_rate.toFixed(0)}%</div></div><div style={{ background:"#1a1a24", borderRadius:8, padding:"10px 12px" }}><div style={{ fontSize:9, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>Max drawdown</div><div style={{ fontSize:16, fontWeight:700, fontFamily:"monospace", color: ddHigh?"#ef4444":"#9ca3af" }}>-{drawdown.toFixed(1)}%</div></div></div><hr style={{ border:"none", borderTop:"1px solid #2a2a3a", margin:0 }}/>

      {/* Actions */}
      <div style={{ display:"flex", gap:8 }}><button onClick={onView} style={{ flex:1, padding:"8px 0", borderRadius:8, border:"1px solid #2a2a3a", background:"#1a1a24", color:"#ffffff", fontSize:12, fontWeight:700, cursor:"pointer" }}>View</button><button onClick={onClone} style={{ flex:1, padding:"8px 0", borderRadius:8, border:"1px solid rgba(99,102,241,0.3)", background:"rgba(99,102,241,0.08)", color:"#6366f1", fontSize:12, fontWeight:700, cursor:"pointer" }}>Clone</button></div></div>
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

// ── Condition library — categorized, every trader type ─────────
const COND_CATEGORIES = [
  { id:"price_action",    label:"Price Action",    color:"#f59e0b" },
  { id:"moving_averages", label:"Moving Averages", color:"#6366f1" },
  { id:"vwap",            label:"VWAP",            color:"#a5b4fc" },
  { id:"rsi",             label:"RSI",             color:"#ec4899" },
  { id:"momentum_volume", label:"Momentum/Volume", color:"#22d3ee" },
  { id:"session_time",    label:"Session/Time",    color:"#f59e0b" },
  { id:"risk_position",   label:"Risk/Position",   color:"#ef4444" },
];

// Each condition: { id, category, label, desc?, sides:[entry|exit|filter], params? }
//   params: [{ name, type:"number"|"select"|"time", default, options?, step?, label?, hint? }]
const RULE_CONDITIONS = [
  // ── Price Action ─────────────────────────────────────────────
  { id:"trendline_break_bull", category:"price_action", label:"Trendline break bullish", desc:"closes above falling trendline", sides:["entry"] },
  { id:"trendline_break_bear", category:"price_action", label:"Trendline break bearish", desc:"closes below rising trendline",  sides:["entry","exit"] },
  { id:"support_bounce",       category:"price_action", label:"Support bounce",          desc:"touches support and reverses up", sides:["entry"] },
  { id:"resistance_bounce",    category:"price_action", label:"Resistance bounce",       desc:"touches resistance and reverses down", sides:["entry","exit"] },
  { id:"support_break",        category:"price_action", label:"Support break",           desc:"closes below support",            sides:["entry","exit"] },
  { id:"resistance_break",     category:"price_action", label:"Resistance break",        desc:"closes above resistance",         sides:["entry"] },
  { id:"higher_high",          category:"price_action", label:"Higher high formed",      sides:["entry","filter"] },
  { id:"lower_low",            category:"price_action", label:"Lower low formed",        sides:["entry","exit","filter"] },
  { id:"higher_low",           category:"price_action", label:"Higher low formed",       sides:["entry","filter"] },
  { id:"lower_high",           category:"price_action", label:"Lower high formed",       sides:["exit","filter"] },
  { id:"engulf_bull",          category:"price_action", label:"Bullish engulfing candle", sides:["entry"] },
  { id:"engulf_bear",          category:"price_action", label:"Bearish engulfing candle", sides:["entry","exit"] },
  { id:"pin_bar_bull",         category:"price_action", label:"Pin bar bullish",         desc:"long lower wick", sides:["entry"] },
  { id:"pin_bar_bear",         category:"price_action", label:"Pin bar bearish",         desc:"long upper wick", sides:["entry","exit"] },
  { id:"inside_bar",           category:"price_action", label:"Inside bar",              desc:"inside previous range", sides:["entry","filter"] },
  { id:"outside_bar",          category:"price_action", label:"Outside bar",             desc:"outside previous range", sides:["entry","filter"] },

  // ── Moving Averages ──────────────────────────────────────────
  { id:"price_above_ema", category:"moving_averages", label:"Price above EMA", sides:["entry","filter"],
    params:[{ name:"period", type:"select", options:[8,9,20,21,50,100,200], default:21 }] },
  { id:"price_below_ema", category:"moving_averages", label:"Price below EMA", sides:["entry","exit","filter"],
    params:[{ name:"period", type:"select", options:[8,9,20,21,50,100,200], default:21 }] },
  { id:"ema_cross_up",    category:"moving_averages", label:"EMA crosses above EMA", sides:["entry"],
    params:[
      { name:"fast", label:"fast", type:"select", options:[5,8,9,12,20,21,50], default:9 },
      { name:"slow", label:"slow", type:"select", options:[20,21,26,50,100,200], default:21 },
    ]},
  { id:"ema_cross_down",  category:"moving_averages", label:"EMA crosses below EMA", sides:["entry","exit"],
    params:[
      { name:"fast", label:"fast", type:"select", options:[5,8,9,12,20,21,50], default:9 },
      { name:"slow", label:"slow", type:"select", options:[20,21,26,50,100,200], default:21 },
    ]},
  { id:"price_bounce_ema",category:"moving_averages", label:"Price bounces off EMA", sides:["entry"],
    params:[{ name:"period", type:"select", options:[8,9,20,21,50,100,200], default:50 }] },
  { id:"price_above_sma", category:"moving_averages", label:"Price above SMA", sides:["entry","filter"],
    params:[{ name:"period", type:"select", options:[20,50,100,200], default:200 }] },
  { id:"price_below_sma", category:"moving_averages", label:"Price below SMA", sides:["entry","exit","filter"],
    params:[{ name:"period", type:"select", options:[20,50,100,200], default:200 }] },
  { id:"sma_cross_up",    category:"moving_averages", label:"SMA crosses above SMA", sides:["entry"],
    params:[
      { name:"fast", label:"fast", type:"select", options:[10,20,50,100], default:50 },
      { name:"slow", label:"slow", type:"select", options:[50,100,200], default:200 },
    ]},

  // ── VWAP ─────────────────────────────────────────────────────
  { id:"price_above_vwap",   category:"vwap", label:"Price above VWAP",       sides:["entry","filter"] },
  { id:"price_below_vwap",   category:"vwap", label:"Price below VWAP",       sides:["entry","exit","filter"] },
  { id:"vwap_reclaim",       category:"vwap", label:"Price reclaims VWAP",    desc:"was below, now above", sides:["entry"] },
  { id:"vwap_loses",         category:"vwap", label:"Price loses VWAP",       desc:"was above, now below", sides:["exit"] },
  { id:"vwap_within",        category:"vwap", label:"Price within X% of VWAP",sides:["entry","filter"],
    params:[{ name:"percent", type:"number", default:0.5, step:0.1, label:"%" }] },
  { id:"vwap_stretch_long",  category:"vwap", label:"VWAP stretch long",      desc:"price X% above VWAP", sides:["exit","filter"],
    params:[{ name:"percent", type:"number", default:2, step:0.1, label:"%" }] },
  { id:"vwap_stretch_short", category:"vwap", label:"VWAP stretch short",     desc:"price X% below VWAP", sides:["entry","filter"],
    params:[{ name:"percent", type:"number", default:2, step:0.1, label:"%" }] },

  // ── RSI ──────────────────────────────────────────────────────
  { id:"rsi_above",      category:"rsi", label:"RSI above value", sides:["entry","filter"],
    params:[{ name:"value", type:"number", default:50, label:"RSI" }] },
  { id:"rsi_below",      category:"rsi", label:"RSI below value", sides:["entry","filter"],
    params:[{ name:"value", type:"number", default:30, label:"RSI" }] },
  { id:"rsi_cross_up",   category:"rsi", label:"RSI crosses up value", sides:["entry"],
    params:[{ name:"value", type:"number", default:50, label:"RSI" }] },
  { id:"rsi_cross_down", category:"rsi", label:"RSI crosses down value", sides:["exit"],
    params:[{ name:"value", type:"number", default:50, label:"RSI" }] },
  { id:"rsi_oversold",   category:"rsi", label:"RSI oversold (<30)",   sides:["entry"] },
  { id:"rsi_overbought", category:"rsi", label:"RSI overbought (>70)", sides:["exit"] },
  { id:"rsi_bull_div",   category:"rsi", label:"RSI bullish divergence", sides:["entry"] },
  { id:"rsi_bear_div",   category:"rsi", label:"RSI bearish divergence", sides:["exit"] },

  // ── Momentum / Volume ────────────────────────────────────────
  { id:"volume_above_avg", category:"momentum_volume", label:"Volume above average", sides:["entry","filter"],
    params:[{ name:"multiplier", type:"number", default:1.5, step:0.1, label:"×avg" }] },
  { id:"volume_spike",     category:"momentum_volume", label:"Volume spike", desc:"largest bar in Y candles", sides:["entry","filter"],
    params:[{ name:"lookback", type:"number", default:20, label:"bars" }] },
  { id:"macd_cross_up",    category:"momentum_volume", label:"MACD crosses above signal", sides:["entry"] },
  { id:"macd_cross_down",  category:"momentum_volume", label:"MACD crosses below signal", sides:["exit"] },
  { id:"macd_hist_pos",    category:"momentum_volume", label:"MACD histogram positive", sides:["entry","filter"] },
  { id:"macd_hist_neg",    category:"momentum_volume", label:"MACD histogram negative", sides:["exit","filter"] },
  { id:"bb_upper_touch",   category:"momentum_volume", label:"Bollinger upper touch", sides:["exit"] },
  { id:"bb_lower_touch",   category:"momentum_volume", label:"Bollinger lower touch", sides:["entry"] },
  { id:"bb_squeeze",       category:"momentum_volume", label:"Bollinger squeeze", desc:"bands narrowing", sides:["entry","filter"] },
  { id:"atr_above",        category:"momentum_volume", label:"ATR above value", desc:"high volatility", sides:["entry","filter"],
    params:[{ name:"value", type:"number", default:1, step:0.1, label:"ATR" }] },
  { id:"atr_below",        category:"momentum_volume", label:"ATR below value", desc:"low volatility",  sides:["entry","filter"],
    params:[{ name:"value", type:"number", default:0.5, step:0.1, label:"ATR" }] },

  // ── Session / Time ───────────────────────────────────────────
  { id:"orb_long",   category:"session_time", label:"Opening range breakout long",  desc:"break above first Xmin high", sides:["entry"],
    params:[{ name:"minutes", type:"select", options:[15,30,60], default:30, label:"min" }] },
  { id:"orb_short",  category:"session_time", label:"Opening range breakout short", desc:"break below first Xmin low",  sides:["entry","exit"],
    params:[{ name:"minutes", type:"select", options:[15,30,60], default:30, label:"min" }] },
  { id:"time_after", category:"session_time", label:"Time of day after", sides:["filter"],
    params:[{ name:"time", type:"time", default:"09:30", label:"ET" }] },
  { id:"time_before",category:"session_time", label:"Time of day before", sides:["filter"],
    params:[{ name:"time", type:"time", default:"16:00", label:"ET" }] },
  { id:"day_of_week",category:"session_time", label:"Day of week is", sides:["filter"],
    params:[{ name:"day", type:"select", options:["Mon","Tue","Wed","Thu","Fri"], default:"Mon" }] },
  { id:"london_open",category:"session_time", label:"London session open (3-4am ET)", sides:["filter"] },
  { id:"ny_open",    category:"session_time", label:"NY session open (9:30am ET)",    sides:["filter"] },
  { id:"avoid_news", category:"session_time", label:"Avoid news",       desc:"no trade within X mins of major news", sides:["filter"],
    params:[{ name:"minutes", type:"number", default:15, label:"min" }] },

  // ── Risk / Position ──────────────────────────────────────────
  { id:"daily_loss_ok",       category:"risk_position", label:"Daily loss limit not hit", sides:["filter"],
    params:[{ name:"percent", type:"number", default:3, step:0.1, label:"% max loss" }] },
  { id:"max_trades_ok",       category:"risk_position", label:"Max daily trades not reached", sides:["filter"],
    params:[{ name:"trades", type:"number", default:5, label:"trades" }] },
  { id:"prev_trade_win",      category:"risk_position", label:"Previous trade was winner",   sides:["filter"] },
  { id:"prev_trade_loss",     category:"risk_position", label:"Previous trade was loser",    sides:["filter"] },
  { id:"consec_losses_under", category:"risk_position", label:"Consecutive losses under",    sides:["filter"],
    params:[{ name:"count", type:"number", default:3, label:"losses" }] },
];

// Build default params object for a given condition def
function defaultParamsFor(def) {
  const p = {};
  (def?.params ?? []).forEach(pp => { p[pp.name] = pp.default; });
  return p;
}
// Render a human-readable param suffix for a condition pill
function paramSuffix(def, cond) {
  if (!def?.params?.length) return "";
  const parts = def.params.map(pp => {
    const raw = cond.params?.[pp.name] ?? (cond.value != null && def.params.length === 1 ? cond.value : pp.default);
    if (pp.label === "%" || pp.name === "percent")   return `${raw}%`;
    if (pp.name === "time")                          return `${raw} ET`;
    if (pp.name === "fast" || pp.name === "slow")    return `${pp.label} ${raw}`;
    return `${raw}`;
  });
  return ` ${parts.join(" / ")}`;
}

// ── Pre-built strategy templates ─────────────────────────────
const STRATEGY_TEMPLATES = [
  {
    name: "EMA Crossover",
    description: "EMA 9 crosses EMA 21 while above SMA 50; RSI confirms uptrend.",
    entryConds: [
      { id:"ema_cross_up",    params:{ fast:9, slow:21 } },
      { id:"price_above_sma", params:{ period:50 } },
      { id:"rsi_above",       params:{ value:50 } },
    ],
    exitConds:  [{ id:"ema_cross_down", params:{ fast:9, slow:21 } }],
    filterConds:[],
    slPct:2, tpPct:4, riskPct:1,
  },
  {
    name: "VWAP Reclaim",
    description: "Price reclaims VWAP on volume, after the NY open.",
    entryConds: [
      { id:"vwap_reclaim",     params:{} },
      { id:"volume_above_avg", params:{ multiplier:1.5 } },
    ],
    exitConds:  [{ id:"vwap_loses", params:{} }],
    filterConds:[{ id:"time_after", params:{ time:"09:30" } }],
    slPct:1.5, tpPct:3, riskPct:1,
  },
  {
    name: "Opening Range Breakout",
    description: "Break first 30-min high with volume spike, after 10am ET.",
    entryConds: [
      { id:"orb_long",     params:{ minutes:30 } },
      { id:"volume_spike", params:{ lookback:20 } },
    ],
    exitConds:  [{ id:"vwap_loses", params:{} }],
    filterConds:[{ id:"time_after", params:{ time:"10:00" } }],
    slPct:1, tpPct:3, riskPct:1,
  },
  {
    name: "Support/Resistance",
    description: "Support bounce + RSI cross up from oversold + bullish pin bar.",
    entryConds: [
      { id:"support_bounce", params:{} },
      { id:"rsi_cross_up",   params:{ value:50 } },
      { id:"pin_bar_bull",   params:{} },
    ],
    exitConds:  [{ id:"resistance_bounce", params:{} }],
    filterConds:[],
    slPct:1.5, tpPct:4, riskPct:1,
  },
  {
    name: "Trend Following",
    description: "Above EMA 200, EMA 20 above EMA 50, RSI above 50 but not overbought.",
    entryConds: [
      { id:"price_above_ema", params:{ period:200 } },
      { id:"ema_cross_up",    params:{ fast:20, slow:50 } },
      { id:"rsi_above",       params:{ value:50 } },
    ],
    exitConds:  [
      { id:"rsi_overbought",  params:{} },
      { id:"price_below_ema", params:{ period:50 } },
    ],
    filterConds:[],
    slPct:3, tpPct:9, riskPct:1,
  },
];

const BLANK_STRATEGY = {
  name: "", description: "",
  rules: { entryConds: [], exitConds: [], filterConds: [], slPct: 2, tpPct: 4, riskPct: 1 },
};

// Migrate legacy { id, value } → { id, params }
function migrateCond(c) {
  if (!c || typeof c !== "object") return c;
  if (c.params && typeof c.params === "object") return c;
  const def = RULE_CONDITIONS.find(d => d.id === c.id);
  if (!def) return { id: c.id, params: {} };
  const params = defaultParamsFor(def);
  if (c.value != null && def.params?.length === 1) params[def.params[0].name] = c.value;
  return { id: c.id, params };
}

// ── Strategy Form modal ───────────────────────────────────────
function StrategyFormModal({ initial, onSave, onClose }) {
  const [name,        setName]        = useState(initial?.name              ?? "");
  const [description, setDescription] = useState(initial?.description       ?? "");
  const [entryConds,  setEntryConds]  = useState((initial?.rules?.entryConds ?? []).map(migrateCond));
  const [exitConds,   setExitConds]   = useState((initial?.rules?.exitConds  ?? []).map(migrateCond));
  const [filterConds, setFilterConds] = useState((initial?.rules?.filterConds?? []).map(migrateCond));
  const [slPct,       setSlPct]       = useState(initial?.rules?.slPct      ?? 2);
  const [tpPct,       setTpPct]       = useState(initial?.rules?.tpPct      ?? 4);
  const [riskPct,     setRiskPct]     = useState(initial?.rules?.riskPct    ?? 1);
  const [err,         setErr]         = useState("");
  const [aiPrompt,    setAiPrompt]    = useState("");
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiErr,       setAiErr]       = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  // category pickers per section
  const [pickEntryCat,  setPickEntryCat]  = useState("price_action");
  const [pickEntryCond, setPickEntryCond] = useState("");
  const [pickExitCat,   setPickExitCat]   = useState("price_action");
  const [pickExitCond,  setPickExitCond]  = useState("");
  const [pickFilterCat, setPickFilterCat] = useState("session_time");
  const [pickFilterCond,setPickFilterCond]= useState("");
  // drag state
  const dragRef = useRef(null);

  // Valid condition IDs the AI can use (subset that the backtest engine supports)
  const ENTRY_IDS = ["rsi_below","rsi_cross_up","ema_cross_up","macd_cross_up","price_above_sma","price_above_ema","volume_above_avg","engulf_bull","pin_bar_bull"];
  const EXIT_IDS  = ["rsi_above","rsi_cross_down","ema_cross_down","macd_cross_down","price_below_sma","price_below_ema","rsi_overbought","engulf_bear","pin_bar_bear"];

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
      if (s.entryConds?.length) setEntryConds(s.entryConds.map(migrateCond));
      if (s.exitConds?.length)  setExitConds(s.exitConds.map(migrateCond));
      if (s.filterConds?.length) setFilterConds(s.filterConds.map(migrateCond));
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

  const setterFor = (side) => side === "entry" ? setEntryConds : side === "exit" ? setExitConds : setFilterConds;
  const listFor   = (side) => side === "entry" ? entryConds   : side === "exit" ? exitConds   : filterConds;

  const addCondById = (side, id) => {
    const def = RULE_CONDITIONS.find(d => d.id === id);
    if (!def) return;
    setterFor(side)(prev => [...prev, { id: def.id, params: defaultParamsFor(def) }]);
  };
  const removeCond = (side, idx) => {
    setterFor(side)(prev => prev.filter((_, i) => i !== idx));
  };
  const setCondParam = (side, idx, name, value) => {
    setterFor(side)(prev => prev.map((c, i) => i === idx
      ? { ...c, params: { ...(c.params ?? {}), [name]: value } }
      : c));
  };
  // ── drag-to-reorder ────────────────────────────────────────
  const onDragStart = (side, idx) => { dragRef.current = { side, idx }; };
  const onDragOver  = (e) => { e.preventDefault(); };
  const onDrop = (side, idx) => {
    const src = dragRef.current;
    if (!src || src.side !== side || src.idx === idx) { dragRef.current = null; return; }
    setterFor(side)(prev => {
      const next = [...prev];
      const [moved] = next.splice(src.idx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    dragRef.current = null;
  };

  const applyTemplate = (tpl) => {
    if (!name.trim()) setName(tpl.name);
    if (!description.trim()) setDescription(tpl.description);
    setEntryConds(tpl.entryConds ?? []);
    setExitConds(tpl.exitConds ?? []);
    setFilterConds(tpl.filterConds ?? []);
    if (tpl.slPct)   setSlPct(tpl.slPct);
    if (tpl.tpPct)   setTpPct(tpl.tpPct);
    if (tpl.riskPct) setRiskPct(tpl.riskPct);
    setTemplatesOpen(false);
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
      rules:         { entryConds, exitConds, filterConds, slPct, tpPct, riskPct },
      createdAt:     initial?.createdAt ?? Date.now(),
      backtests:     initial?.backtests ?? [],
    });
  };

  const inp = { width:"100%", padding:"8px 10px", borderRadius:7, boxSizing:"border-box", background:"#1a1a24", border:"1px solid #2a2a3a", fontSize:12, color:"#ffffff", outline:"none" };
  const lbl = { display:"block", fontSize:9, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:5 };

  // Side → theme colors for tags & sections
  const SIDE_THEME = {
    entry:  { border:"rgba(52,211,153,0.35)", bg:"rgba(52,211,153,0.10)", chip:"rgba(52,211,153,0.18)", text:"#10b981", icon:"▲" },
    exit:   { border:"rgba(239,68,68,0.35)",  bg:"rgba(239,68,68,0.10)",  chip:"rgba(239,68,68,0.18)",  text:"#ef4444", icon:"▼" },
    filter: { border:"rgba(251,146,60,0.4)",  bg:"rgba(251,146,60,0.10)", chip:"rgba(251,146,60,0.18)", text:"#f59e0b", icon:"⏱" },
  };

  // Tag pill for a chosen condition (with inline param editors)
  const CondTag = ({ cond, side, idx }) => {
    const def = RULE_CONDITIONS.find(d =>d.id === cond.id);
 const theme = SIDE_THEME[side];
 if (!def) return null;
 return (<div
        draggable
        onDragStart={() => onDragStart(side, idx)}
        onDragOver={onDragOver}
        onDrop={() => onDrop(side, idx)}
        title={def.desc ?? def.label}
        style={{
          display:"inline-flex", alignItems:"center", gap:6,
          padding:"5px 8px 5px 10px", borderRadius:999,
          background: theme.bg, border:`1px solid ${theme.border}`, color: theme.text,
          fontSize:11, fontWeight:600, cursor:"grab", userSelect:"none",
        }}><span style={{ opacity:0.7, fontSize:10 }}>⋮⋮</span><span>{theme.icon} {def.label}</span>
        {(def.params ?? []).map(pp => {
          const val = cond.params?.[pp.name] ?? pp.default;
          const ctrlBase = {
            background:"rgba(0,0,0,0.25)", border:`1px solid ${theme.border}`,
            color: theme.text, borderRadius:6, fontSize:10, fontWeight:700,
            padding:"2px 6px", outline:"none",
          };
          if (pp.type === "select") {
            return (
              <select key={pp.name} value={val}
                onChange={e => {
                  const raw = e.target.value;
                  const cast = (typeof pp.options?.[0] === "number") ? parseFloat(raw) : raw;
                  setCondParam(side, idx, pp.name, cast);
                }}
                style={ctrlBase}>
                {pp.options.map(o =><option key={o} value={o} style={{ background:"#111118", color:"#ffffff" }}>
                  {pp.label ? `${pp.label}=${o}` : o}
                </option>)}
              </select>
            );
          }
          if (pp.type === "time") {
            return (
              <input key={pp.name} type="time" value={val}
                onChange={e => setCondParam(side, idx, pp.name, e.target.value)}
                style={{ ...ctrlBase, width:90 }}/>
            );
          }
          return (
            <input key={pp.name} type="number" value={val}
              step={pp.step ?? 1}
              onChange={e => setCondParam(side, idx, pp.name, parseFloat(e.target.value))}
              style={{ ...ctrlBase, width:56 }}
              placeholder={pp.label ?? pp.name}/>
          );
        })}
        <button onClick={() => removeCond(side, idx)}
          style={{ background:"none", border:"none", color:theme.text, opacity:0.7, cursor:"pointer", padding:0, marginLeft:2, display:"inline-flex" }}
          aria-label="remove"><X size={12}/></button></div>
    );
  };

  // Picker: Category → Condition → Add
  const CondPicker = ({ side, cat, setCat, condId, setCondId }) => {
    const theme = SIDE_THEME[side];
    const inCat = RULE_CONDITIONS.filter(d =>d.category === cat && d.sides.includes(side));
 return (<div style={{ display:"flex", gap:6, marginTop:8 }}><select value={cat} onChange={e => { setCat(e.target.value); setCondId(""); }}
          style={{ ...inp, padding:"6px 8px", fontSize:11, flex:"0 0 130px" }}>
          {COND_CATEGORIES.map(c =><option key={c.id} value={c.id}>{c.label}</option>)}
        </select><select value={condId} onChange={e => setCondId(e.target.value)}
          style={{ ...inp, padding:"6px 8px", fontSize:11, flex:1 }}><option value="">— pick a condition —</option>
          {inCat.map(d =><option key={d.id} value={d.id}>{d.label}{d.desc?` · ${d.desc}`:""}</option>)}
        </select><button
          disabled={!condId}
          onClick={() => { addCondById(side, condId); setCondId(""); }}
          style={{
            padding:"6px 12px", borderRadius:7, border:`1px solid ${theme.border}`,
            background: condId ? theme.chip : "transparent",
            color: condId ? theme.text : "#374151",
            fontSize:11, fontWeight:700, cursor: condId ? "pointer" : "not-allowed", flexShrink:0,
          }}>+ Add</button></div>
    );
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:80, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}><div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)" }}/><div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:580, maxHeight:"92vh", borderRadius:16, border:"1px solid #2a2a3a", background:"#111118", boxShadow:"0 25px 60px rgba(0,0,0,0.6)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid #2a2a3a", flexShrink:0 }}><div style={{ fontSize:14, fontWeight:700, color:"#ffffff", display:"flex", alignItems:"center", gap:8 }}><FlaskConical size={15} style={{ color:"#6366f1" }}/> {initial ? "Edit Strategy" : "New Strategy"}
          </div><button onClick={onClose} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer" }}><X size={16}/></button></div><div style={{ flex:1, overflowY:"auto", padding:"20px", display:"flex", flexDirection:"column", gap:14 }}>

          {/* ── AI Generator ── */}
          <div style={{ borderRadius:10, border:"1px solid rgba(99,102,241,0.3)", background:"rgba(99,102,241,0.05)", padding:"12px 14px" }}><div style={{ fontSize:10, fontWeight:700, color:"#6366f1", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8, display:"flex", alignItems:"center", gap:5 }}><Sparkles size={11}/>AI Strategy Builder</div><div style={{ fontSize:11, color:"#6b7280", marginBottom:10, lineHeight:1.5 }}>Describe your strategy in plain English — Claude will fill everything in for you.</div><textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => { if (e.key==="Enter" && (e.metaKey||e.ctrlKey)) generateFromAI(); }}
              placeholder={'e.g. "Buy when RSI is oversold and price is above the 200 SMA. Exit when RSI becomes overbought. Use 2% stop loss and 5% take profit."'}
              style={{ ...inp, resize:"vertical", minHeight:72, fontFamily:"inherit", lineHeight:1.5, marginBottom:8 }}
            />
            {aiErr && (
              <div style={{ fontSize:10, color:"#ef4444", marginBottom:8, display:"flex", alignItems:"center", gap:5 }}><AlertCircle size={11}/>{aiErr}
              </div>
            )}
            <button onClick={generateFromAI} disabled={!aiPrompt.trim() || aiLoading} style={{
              display:"flex", alignItems:"center", gap:6, padding:"8px 16px",
              borderRadius:8, border:"none", fontSize:12, fontWeight:700, cursor: !aiPrompt.trim()||aiLoading ? "not-allowed":"pointer",
              background: !aiPrompt.trim()||aiLoading ? "#2a2a3a":"#6366f1",
              color: !aiPrompt.trim()||aiLoading ? "#374151":"#fff",
              boxShadow: !aiPrompt.trim()||aiLoading ? "none":"0 4px 14px rgba(99,102,241,0.35)",
            }}>
              {aiLoading
                ? <><span style={{ display:"inline-block", width:11, height:11, border:"2px solid #374151", borderTopColor:"#6366f1", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>Generating…</>:<><Sparkles size={12}/>Generate Strategy<span style={{ fontSize:10, opacity:0.7 }}>⌘↵</span></>
              }
            </button></div><div style={{ display:"flex", alignItems:"center", gap:8 }}><div style={{ flex:1, height:1, background:"#2a2a3a" }}/><span style={{ fontSize:10, color:"#374151" }}>or fill in manually</span><div style={{ flex:1, height:1, background:"#2a2a3a" }}/></div><div><label style={lbl}>Strategy Name *</label><input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. EMA Breakout with RSI Filter"/></div><div><label style={lbl}>Description</label><textarea style={{ ...inp, resize:"vertical", minHeight:60, fontFamily:"inherit", lineHeight:1.5 }}
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Describe when this strategy works and what market conditions it targets..."/></div>

          {/* ── Template Strategies ── */}
          <div style={{ position:"relative" }}><button onClick={() => setTemplatesOpen(o => !o)} style={{
              width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8,
              padding:"9px 12px", borderRadius:8,
              border:"1px solid rgba(99,102,241,0.3)", background:"rgba(99,102,241,0.06)",
              color:"#6366f1", fontSize:11, fontWeight:700, cursor:"pointer",
            }}><span style={{ display:"flex", alignItems:"center", gap:6 }}><Wand2 size={12}/>Template Strategies<span style={{ color:"#6b7280", fontWeight:400 }}>— pre-built setups</span></span><span style={{ fontSize:10 }}>{templatesOpen ? "▴" : "▾"}</span></button>
            {templatesOpen && (
              <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:6 }}>
                {STRATEGY_TEMPLATES.map(tpl =>(<button key={tpl.name} onClick={() => applyTemplate(tpl)} style={{
                    textAlign:"left", padding:"9px 12px", borderRadius:8,
                    border:"1px solid #2a2a3a", background:"#1a1a24", cursor:"pointer",
                  }}><div style={{ fontSize:11, fontWeight:700, color:"#ffffff", marginBottom:3 }}>{tpl.name}</div><div style={{ fontSize:10, color:"#6b7280", lineHeight:1.5 }}>{tpl.description}</div></button>
                ))}
              </div>
            )}
          </div>

          {/* ── Entry Conditions ── */}
          <div style={{ borderRadius:10, border:"1px solid rgba(52,211,153,0.2)", background:"rgba(52,211,153,0.03)", padding:"12px 14px" }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}><span style={{ fontSize:11, fontWeight:700, color:"#10b981" }}>▲ Entry Conditions<span style={{ color:"#6b7280", fontWeight:400 }}>(ALL must be true)</span></span><span style={{ fontSize:9, color:"#6b7280" }}>drag tags to reorder</span></div><div style={{ display:"flex", flexWrap:"wrap", gap:6, minHeight:24 }}>
              {entryConds.map((c,i) =><CondTag key={`e${i}`} cond={c} side="entry" idx={i}/>)}
              {!entryConds.length && <div style={{ fontSize:10, color:"#374151", fontStyle:"italic", padding:"4px 2px" }}>No entry conditions yet — pick one below</div>}
            </div><CondPicker side="entry" cat={pickEntryCat} setCat={setPickEntryCat} condId={pickEntryCond} setCondId={setPickEntryCond}/></div>

          {/* ── Exit Conditions ── */}
          <div style={{ borderRadius:10, border:"1px solid rgba(239,68,68,0.2)", background:"rgba(239,68,68,0.03)", padding:"12px 14px" }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}><span style={{ fontSize:11, fontWeight:700, color:"#ef4444" }}>▼ Exit Conditions<span style={{ color:"#6b7280", fontWeight:400 }}>(ANY fires)</span></span><span style={{ fontSize:9, color:"#6b7280" }}>drag tags to reorder</span></div><div style={{ display:"flex", flexWrap:"wrap", gap:6, minHeight:24 }}>
              {exitConds.map((c,i) =><CondTag key={`x${i}`} cond={c} side="exit" idx={i}/>)}
              {!exitConds.length && <div style={{ fontSize:10, color:"#374151", fontStyle:"italic", padding:"4px 2px" }}>No exit conditions yet — pick one below</div>}
            </div><CondPicker side="exit" cat={pickExitCat} setCat={setPickExitCat} condId={pickExitCond} setCondId={setPickExitCond}/></div>

          {/* ── Filters (time-of-day, risk) ── */}
          <div style={{ borderRadius:10, border:"1px solid rgba(251,146,60,0.25)", background:"rgba(251,146,60,0.04)", padding:"12px 14px" }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}><span style={{ fontSize:11, fontWeight:700, color:"#f59e0b" }}>⏱ Filters<span style={{ color:"#6b7280", fontWeight:400 }}>(time / risk gates)</span></span><span style={{ fontSize:9, color:"#6b7280" }}>optional</span></div><div style={{ display:"flex", flexWrap:"wrap", gap:6, minHeight:24 }}>
              {filterConds.map((c,i) =><CondTag key={`f${i}`} cond={c} side="filter" idx={i}/>)}
              {!filterConds.length && <div style={{ fontSize:10, color:"#374151", fontStyle:"italic", padding:"4px 2px" }}>No filters — add time-of-day or risk gates below</div>}
            </div><CondPicker side="filter" cat={pickFilterCat} setCat={setPickFilterCat} condId={pickFilterCond} setCondId={setPickFilterCond}/></div>

          {/* Risk defaults */}
          <div style={{ borderRadius:10, border:"1px solid #2a2a3a", background:"#1a1a24", padding:"12px 14px" }}><div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10, display:"flex", alignItems:"center", gap:5 }}><Shield size={11}/>Default Risk Settings</div><div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}><div><label style={lbl}>Risk / Trade %</label><input type="number" style={inp} value={riskPct} min={0.01} max={100} step={0.01} onChange={e => setRiskPct(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); setRiskPct(isNaN(v)||v<=0 ? 0.01 : v); }}/></div><div><label style={lbl}>Stop Loss %</label><input type="number" style={inp} value={slPct} min={0.01} max={50} step={0.01} onChange={e => setSlPct(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); setSlPct(isNaN(v)||v<=0 ? 0.01 : v); }}/></div><div><label style={lbl}>Take Profit %</label><input type="number" style={inp} value={tpPct} min={0.01} max={100} step={0.01} onChange={e => setTpPct(e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); setTpPct(isNaN(v)||v<=0 ? 0.01 : v); }}/></div></div></div>

          {err && <div style={{ padding:"9px 12px", borderRadius:8, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", fontSize:12, color:"#ef4444", display:"flex", alignItems:"center", gap:7 }}><AlertCircle size={12}/>{err}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding:"14px 20px", borderTop:"1px solid #2a2a3a", display:"flex", gap:10, flexShrink:0 }}><button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:9, border:"1px solid #2a2a3a", background:"transparent", color:"#6b7280", fontSize:12, fontWeight:600, cursor:"pointer" }}>Cancel</button><button onClick={submit} style={{ flex:2, padding:"10px", borderRadius:9, border:"none", background:"#6366f1", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 16px rgba(99,102,241,0.3)" }}>
            {initial ? "Save Changes" : "Create Strategy"}
          </button></div></div></div>
  );
}

// ── Strategy Lab main page ────────────────────────────────────
function StrategyLabPage({ session, trades }) {
  const [strategies, setStrategies] = useState(() => loadStratLab(session.username));
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [running,    setRunning]    = useState(null);
  const [expanded,   setExpanded]   = useState(null);
  const [justCloned,   setJustCloned]   = useState(null);  // id of newly cloned card
  const [confirmingDelete,  setConfirmingDelete]  = useState(null); // strategy.id awaiting confirm

  // ── Clone — instant duplicate, auto-open editor ───────────
  const cloneStrategy = (source) => {
    const clone = {
      ...source,
      id:            `strat_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      name:          `${source.name} (copy)`,
      backtests:     [],
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

  const persist = (next) => { saveStratLab(session.username, next); setStrategies(next); };

  const saveStrategy = (s) => {
    const exists = strategies.find(x => x.id === s.id);
    persist(exists ? strategies.map(x => x.id === s.id ? s : x) : [...strategies, s]);
    setShowForm(false); setEditing(null);
  };

  const deleteStrategy = (id) => {
    persist(strategies.filter(s => s.id !== id));
    toast("Strategy deleted", "success");
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
      toast("No trades generated. Try widening conditions or using a different timeframe.", "warning");
    }
    setRunning(null);
    setTimeout(() => setFetchStatus(""), 3000);
  };

  // Match real trades to this strategy
  const matchedTrades = (strategy) =>
    trades.filter(t =>t.strategy?.toLowerCase() === strategy.name.toLowerCase());

 return (<div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {showForm && (
        <StrategyFormModal
          initial={editing}
          onSave={saveStrategy}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}><div><div style={{ fontSize:20, fontWeight:800, color:"#ffffff", display:"flex", alignItems:"center", gap:10 }}><FlaskConical size={20} style={{ color:"#6366f1" }}/>Strategy Lab</div><div style={{ fontSize:11, color:"#6b7280", marginTop:3 }}>Build, document, and backtest your trading strategies</div></div><button onClick={() => { setEditing(null); setShowForm(true); }} style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 18px", borderRadius:9, border:"none", background:"#6366f1", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 16px rgba(99,102,241,0.3)" }}><Plus size={14}/>New Strategy</button></div>

      {/* Empty state */}
      {!strategies.length && (
        <div style={{ padding:"60px 24px", textAlign:"center", borderRadius:14, border:"2px dashed #2a2a3a" }}><FlaskConical size={40} style={{ color:"#374151", marginBottom:16 }}/><div style={{ fontSize:15, fontWeight:700, color:"#6b7280", marginBottom:8 }}>No strategies yet</div><div style={{ fontSize:12, color:"#374151", marginBottom:24, lineHeight:1.6 }}>Create a strategy by defining entry and exit conditions.<br/>Then run a backtest to see simulated performance.</div><button onClick={() => setShowForm(true)} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"10px 22px", borderRadius:9, border:"none", background:"#6366f1", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}><Plus size={14}/>Create First Strategy</button></div>
      )}

      {/* ── Backtest settings bar ── */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:10, border:"1px solid #2a2a3a", background:"#111118", flexWrap:"wrap" }}><div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", flexShrink:0 }}>Backtest on:</div>

        {/* Symbol picker — grouped */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}><span style={{ fontSize:9, color:"#374151", fontWeight:700, alignSelf:"center", marginRight:2 }}>Crypto:</span>
          {BT_SYMBOLS.filter(s => s.source==="coinbase").map(s =>(<button key={s.id} onClick={() => setLabSymbol(s.id)} style={{ padding:"3px 9px", borderRadius:6, border:`1px solid ${labSymbol===s.id?"rgba(99,102,241,0.5)":"#2a2a3a"}`, background:labSymbol===s.id?"rgba(99,102,241,0.1)":"transparent", color:labSymbol===s.id?"#6366f1":"#6b7280", fontSize:10, fontWeight:700, cursor:"pointer" }}>
              {s.label}
            </button>
          ))}
          <span style={{ fontSize:9, color:"#374151", fontWeight:700, alignSelf:"center", marginLeft:4, marginRight:2 }}>Futures:</span>
          {BT_SYMBOLS.filter(s => s.source==="yahoo").map(s =>(<button key={s.id} onClick={() => setLabSymbol(s.id)} style={{ padding:"3px 9px", borderRadius:6, border:`1px solid ${labSymbol===s.id?"rgba(245,158,11,0.5)":"#2a2a3a"}`, background:labSymbol===s.id?"rgba(245,158,11,0.08)":"transparent", color:labSymbol===s.id?"#f59e0b":"#6b7280", fontSize:10, fontWeight:700, cursor:"pointer" }}>
              {s.label}
            </button>
          ))}
        </div><div style={{ width:1, height:18, background:"#2a2a3a", flexShrink:0 }}/>

        {/* Timeframe picker */}
        <div style={{ display:"flex", gap:3 }}>
          {BT_TIMEFRAMES.map(t =>(<button key={t.id} onClick={() => setLabTf(t.id)} style={{ padding:"3px 8px", borderRadius:5, border:"none", background:labTf===t.id?"#2a2a3a":"transparent", color:labTf===t.id?"#6366f1":"#6b7280", fontSize:10, fontWeight:700, cursor:"pointer" }}>
              {t.label}
            </button>
          ))}
        </div><div style={{ width:1, height:18, background:"#2a2a3a", flexShrink:0 }}/>

        {/* Data source toggle */}
        <div style={{ display:"flex", gap:3 }}>
          {[["live"," Live"],["sim"," Sim"]].map(([id, label]) =>(<button key={id} onClick={() => setDataSource(id)} style={{ padding:"3px 9px", borderRadius:6, border:"none", background:dataSource===id?"rgba(99,102,241,0.12)":"transparent", color:dataSource===id?"#6366f1":"#6b7280", fontSize:10, fontWeight:700, cursor:"pointer" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Fetch status */}
        {fetchStatus && (
          <div style={{ marginLeft:"auto", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", gap:5, flexShrink:0,
            color: fetchStatus.startsWith("live")?"#10b981":fetchStatus==="fallback"?"#f59e0b":fetchStatus==="fetching"?"#6366f1":"#6b7280"
          }}>
            {fetchStatus==="fetching" && <span style={{ display:"inline-block", width:9, height:9, border:"1.5px solid #2a2a3a", borderTopColor:"#6366f1", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>}
            {fetchStatus.startsWith("live") && `✓ ${parseInt(fetchStatus.split(":")[1]).toLocaleString()} real candles`}
            {fetchStatus==="sim"      && " Simulated"}
            {fetchStatus==="fallback" && " API unavailable — used sim"}
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
            border:`1px solid ${justCloned===s.id ? "rgba(52,211,153,0.6)" : isExpanded?"rgba(99,102,241,0.35)":"#2a2a3a"}`,
            background: justCloned===s.id ? "rgba(52,211,153,0.06)" : "#111118",
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
                latestBt && latestBt.trades_count > 20 && latestBt.return_pct > 0 ? "verified"
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
                  const def = RULE_CONDITIONS.find(d =>d.id === c.id);
 if (!def) return null;
 return<span key={`e${i}`} style={{ fontSize:9, padding:"2px 7px", borderRadius:10, background:"rgba(52,211,153,0.08)", color:"#10b981", border:"1px solid rgba(52,211,153,0.2)" }}>▲ {def.label}{paramSuffix(def, c)}</span>;
                })}
                {(s.rules?.exitConds ?? []).map((c,i) => {
                  const def = RULE_CONDITIONS.find(d =>d.id === c.id);
 if (!def) return null;
 return<span key={`x${i}`} style={{ fontSize:9, padding:"2px 7px", borderRadius:10, background:"rgba(239,68,68,0.08)", color:"#ef4444", border:"1px solid rgba(239,68,68,0.2)" }}>▼ {def.label}{paramSuffix(def, c)}</span>;
                })}
                {(s.rules?.filterConds ?? []).map((c,i) => {
                  const def = RULE_CONDITIONS.find(d =>d.id === c.id);
 if (!def) return null;
 return<span key={`f${i}`} style={{ fontSize:9, padding:"2px 7px", borderRadius:10, background:"rgba(251,146,60,0.08)", color:"#f59e0b", border:"1px solid rgba(251,146,60,0.25)" }}>⏱ {def.label}{paramSuffix(def, c)}</span>;
                })}
              </div>
              {/* Action buttons */}
              <button onClick={() => runBacktest(s)} disabled={isRunning} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:7, border:"none", background:isRunning?"#2a2a3a":"#6366f1", color:isRunning?"#374151":"#fff", fontSize:10, fontWeight:700, cursor:isRunning?"not-allowed":"pointer", flexShrink:0 }}>
                {isRunning ? <><span style={{ display:"inline-block", width:10, height:10, border:"2px solid #374151", borderTopColor:"#6366f1", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>Running…</>:<><Play size={10}/>Backtest</>}
              </button><button onClick={() => { setEditing(s); setShowForm(true); }} style={{ padding:"5px 8px", borderRadius:7, border:"1px solid #2a2a3a", background:"transparent", color:"#6b7280", cursor:"pointer", flexShrink:0 }}><Edit2 size={11}/></button>
              {confirmingDelete === s.id ? (
                <div style={{ display:"flex", gap:4, flexShrink:0 }}><button onClick={() => { setConfirmingDelete(null); deleteStrategy(s.id); }} style={{ padding:"5px 9px", borderRadius:7, border:"1px solid #ef4444", background:"rgba(239,68,68,0.15)", color:"#ef4444", fontSize:10, fontWeight:700, cursor:"pointer" }}>✓ Delete</button><button onClick={() => setConfirmingDelete(null)} style={{ padding:"5px 9px", borderRadius:7, border:"1px solid #374151", background:"transparent", color:"#9ca3af", fontSize:10, fontWeight:700, cursor:"pointer" }}>✗</button></div>) : (<button onClick={() => { setConfirmingDelete(s.id); setTimeout(() => setConfirmingDelete(curr => curr === s.id ? null : curr), 3000); }} style={{ padding:"5px 8px", borderRadius:7, border:"1px solid rgba(239,68,68,0.2)", background:"transparent", color:"#ef4444", cursor:"pointer", flexShrink:0 }}><Trash size={11}/></button>
              )}
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div style={{ borderTop:"1px solid #2a2a3a" }}>

                {/* Real trade stats if trades match */}
                {realStats && (
                  <div style={{ padding:"14px 18px", borderBottom:"1px solid #2a2a3a" }}><div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}> Real Trade Performance ({matched.length} trades logged as "{s.name}")</div><div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
                      {[
                        { label:"Win Rate",     val:`${realStats.winRate}%`,                                          color:realStats.winRate>=50?"#10b981":"#f59e0b" },
                        { label:"Total PnL",    val:`${realStats.totalPnl>=0?"+":""}${realStats.totalPnl.toFixed(2)}`, color:realStats.totalPnl>=0?"#10b981":"#ef4444" },
                        { label:"Profit Factor",val:String(realStats.profitFactor),                                   color:realStats.profitFactor>=1.5?"#10b981":"#f59e0b" },
                        { label:"Avg Win",      val:`+${realStats.avgWin.toFixed(2)}`,                               color:"#10b981" },
                        { label:"Avg Loss",     val:`-${realStats.avgLoss.toFixed(2)}`,                              color:"#ef4444" },
                      ].map(({ label, val, color }) =>(<div key={label} style={{ textAlign:"center", padding:"8px", borderRadius:8, background:"#1a1a24" }}><div style={{ fontSize:8, color:"#374151", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{label}</div><div style={{ fontSize:13, fontWeight:700, fontFamily:"monospace", color }}>{val}</div></div>
                      ))}
                    </div></div>
                )}

                {/* Backtest history */}
                {s.backtests?.length >0 && (<div style={{ padding:"14px 18px" }}><div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>Backtest History</div><div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {s.backtests.map((bt, i) => {
                        const btPos = bt.return_pct >= 0;
 const lineC = btPos ? "#10b981" : "#ef4444";
 return (<div key={bt.id} style={{ borderRadius:9, border:`1px solid ${i===0?"rgba(99,102,241,0.25)":"#2a2a3a"}`, background:i===0?"rgba(99,102,241,0.04)":"#1a1a24", padding:"10px 14px" }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom: i===0&&bt.equity_curve?.length>1?10:0 }}><div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                {i===0 && <span style={{ fontSize:9, fontWeight:700, color:"#6366f1", background:"rgba(99,102,241,0.12)", padding:"1px 6px", borderRadius:8 }}>Latest</span>}
                                <span style={{ fontSize:10, color:"#6b7280" }}>{new Date(bt.runAt).toLocaleString()}</span>
                                {bt.symbol && <span style={{ fontSize:9, color:"#374151", fontFamily:"monospace" }}>{bt.symbol} {bt.tf}</span>}
                                {bt.dataSource === "live"
                                  ? <span style={{ fontSize:9, color:"#10b981" }}>Real</span>:<span style={{ fontSize:9, color:"#6b7280" }}>Sim</span>
                                }
                              </div><div style={{ display:"flex", gap:12 }}>
                                {[
                                  { label:"Return",  val:`${btPos?"+":""}${bt.return_pct?.toFixed(1)}%`,    color:btPos?"#10b981":"#ef4444" },
                                  { label:"Win Rate",val:`${bt.win_rate?.toFixed(0)}%`,                    color:bt.win_rate>=50?"#10b981":"#f59e0b" },
                                  { label:"PF",      val:bt.profit_factor===999?"∞":bt.profit_factor?.toFixed(2), color:bt.profit_factor>=1.5?"#10b981":"#f59e0b" },
                                  { label:"Max DD",  val:`-${bt.max_drawdown?.toFixed(1)}%`,               color:bt.max_drawdown>20?"#ef4444":"#9ca3af" },
                                  { label:"Trades",  val:String(bt.trades_count),                          color:"#9ca3af" },
                                ].map(({ label, val, color }) =>(<div key={label} style={{ textAlign:"right" }}><div style={{ fontSize:8, color:"#374151", textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div><div style={{ fontSize:12, fontWeight:700, fontFamily:"monospace", color }}>{val}</div></div>
                                ))}
                              </div></div>
                            {/* Mini equity curve for latest run */}
                            {i===0 && bt.equity_curve?.length >1 && (<ResponsiveContainer width="100%" height={60}><AreaChart data={bt.equity_curve} margin={{ top:2,right:2,left:-40,bottom:0 }}><defs><linearGradient id={`slGrad_${bt.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={lineC} stopOpacity={0.25}/><stop offset="95%" stopColor={lineC} stopOpacity={0}/></linearGradient></defs><Area type="monotone" dataKey="balance" stroke={lineC} strokeWidth={1.5} fill={`url(#slGrad_${bt.id})`} dot={false}/><Tooltip contentStyle={{ background:"#111118", border:"1px solid #2a2a3a", borderRadius:6, fontSize:9 }} formatter={v=>[`$${v.toFixed(0)}`,"Balance"]} itemStyle={{ color:lineC }}/></AreaChart></ResponsiveContainer>
                            )}
                          </div>
                        );
                      })}
                    </div></div>
                )}

                {!realStats && !s.backtests?.length && (
                  <div style={{ padding:"20px 18px", textAlign:"center", fontSize:11, color:"#374151" }}>No backtest runs yet — click<strong style={{ color:"#6366f1" }}>Backtest</strong>to simulate this strategy</div>
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
//  SIDEBAR NAV (left rail)
// ═══════════════════════════════════════════════════════════════

const SIDEBAR_ICON_PROPS = {
  width:"20", height:"20", viewBox:"0 0 24 24",
  fill:"none", stroke:"currentColor",
  strokeWidth:"1.5", strokeLinecap:"round", strokeLinejoin:"round",
};

const SIDEBAR_ICONS = {
  dashboard: (
    <svg {...SIDEBAR_ICON_PROPS}>
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  journal: (
    <svg {...SIDEBAR_ICON_PROPS}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  trophy: (
    <svg {...SIDEBAR_ICON_PROPS}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
    </svg>
  ),
  brain: (
    <svg {...SIDEBAR_ICON_PROPS}>
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
    </svg>
  ),
  target: (
    <svg {...SIDEBAR_ICON_PROPS}>
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  checklist: (
    <svg {...SIDEBAR_ICON_PROPS}>
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
  ),
  lightning: (
    <svg {...SIDEBAR_ICON_PROPS}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  ),
  bell: (
    <svg {...SIDEBAR_ICON_PROPS}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  play: (
    <svg {...SIDEBAR_ICON_PROPS}>
      <polygon points="6 4 20 12 6 20 6 4"/>
    </svg>
  ),
  flask: (
    <svg {...SIDEBAR_ICON_PROPS}>
      <path d="M9 2v6L3.5 18.5A2 2 0 0 0 5.3 21.5h13.4a2 2 0 0 0 1.8-3L15 8V2"/>
      <path d="M8 2h8"/>
      <path d="M6 14h12"/>
    </svg>
  ),
  chart: (
    <svg {...SIDEBAR_ICON_PROPS}>
      <line x1="3" y1="21" x2="21" y2="21"/>
      <line x1="7" y1="21" x2="7" y2="13"/>
      <line x1="12" y1="21" x2="12" y2="9"/>
      <line x1="17" y1="21" x2="17" y2="5"/>
    </svg>
  ),
  gear: (
    <svg {...SIDEBAR_ICON_PROPS}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
};

const TAB_LABELS = {
  dashboard:  "Dashboard",
  journal:    "Journal",
  insights:   "Insights",
  stratlab:   "Strategy Lab",
  strategies: "Strategies",
  copy:       "Copy Trading",
};

function SidebarItem({ icon, label, active, onClick, href }) {
  const [hover, setHover] = useState(false);
  const bg    = active ? "#1e1e2a" : (hover ? "#1a1a24" : "transparent");
  const color = active ? "var(--accent)" : (hover ? "#ffffff" : "#6b7280");
  const commonStyle = {
    width:40, height:40,
    borderRadius:8,
    background:bg,
    border:"none",
    borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
    paddingLeft: active ? 0 : 2,
    cursor:"pointer",
    color,
    textDecoration:"none",
    display:"flex", alignItems:"center", justifyContent:"center",
    transition:"background 0.15s, color 0.15s",
  };
  return (
    <div
      style={{ position:"relative", display:"flex", justifyContent:"center" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}>
      {href ? (
        <a href={href} aria-label={label} style={commonStyle}>{icon}</a>
      ) : (
        <button type="button" onClick={onClick} aria-label={label} style={commonStyle}>{icon}</button>
      )}
      {hover && (
        <span style={{
          position:"absolute", left:48, top:"50%", transform:"translateY(-50%)",
          background:"#1e1e2a", border:"1px solid #2a2a3a", borderRadius:6,
          padding:"4px 10px", fontSize:12, color:"#fff", whiteSpace:"nowrap",
          pointerEvents:"none", zIndex:100, boxShadow:"0 4px 14px rgba(0,0,0,0.5)",
          fontWeight:600,
        }}>{label}</span>
      )}
    </div>
  );
}

function SidebarDivider() {
  return <div style={{ width:24, height:1, background:"#1e1e2a", margin:"6px 0", flexShrink:0 }}/>;
}

function SidebarGroupLabel({ label }) {
  return (
    <div style={{
      width:40, textAlign:"center", fontSize:8, color:"#333333",
      textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:700,
      marginTop:2, marginBottom:2, userSelect:"none", flexShrink:0,
    }}>{label}</div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SYNC INDICATOR
// ═══════════════════════════════════════════════════════════════

function SyncIndicator({ status }) {
  const cfg = {
    syncing: { label: "Syncing…", color: "#9ca3af", bg: "rgba(156,163,175,0.08)", border: "rgba(156,163,175,0.25)", spin: true },
    saved:   { label: "Saved",    color: "#10b981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.25)",  spin: false },
    offline: { label: "Offline",  color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)",  spin: false },
    idle:    { label: "Ready",    color: "#6b7280", bg: "transparent",            border: "transparent",            spin: false },
  };
  const c = cfg[status] ?? cfg.idle;
  if (status === "idle") return null;
  return (
    <div
      title={status === "offline" ? "Sync failed — changes saved locally" : c.label}
      className="hide-mobile"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 9px",
        borderRadius: 8,
        border: `1px solid ${c.border}`,
        background: c.bg,
        color: c.color,
        fontSize: 10,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <style>{`@keyframes nx-spin{to{transform:rotate(360deg)}}`}</style>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: c.spin ? "transparent" : c.color,
          border: c.spin ? `1.5px solid ${c.color}` : "none",
          borderTopColor: c.spin ? "transparent" : undefined,
          display: "inline-block",
          animation: c.spin ? "nx-spin 0.7s linear infinite" : "none",
          boxSizing: "border-box",
        }}
      />
      {c.label}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN TRADING DASHBOARD
// ═══════════════════════════════════════════════════════════════

function TradingDashboard({ session, onLogout }) {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  const [tab,           setTab]           = useState("dashboard");
  const [trades,        setTrades]        = useState([]);
  const [tradesLoading, setTradesLoading] = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [showCSV,       setShowCSV]       = useState(false);
  const [csvInitialTab, setCsvInitialTab] = useState("csv"); // "csv" | "ai"
  const [showHub,       setShowHub]       = useState(false);
  const [showAddAcct,   setShowAddAcct]   = useState(false);
  const [showAccountSetup, setShowAccountSetup] = useState(false);
  const [editTrade,     setEditTrade]     = useState(null);
  const [showMobileTools, setShowMobileTools] = useState(false);

  useEffect(() => {
    if (!showMobileTools) return;
    const onKey = (e) => { if (e.key === "Escape") setShowMobileTools(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showMobileTools]);

  const toolsSheetTouch = useRef({ y: 0, dragging: false });
  const handleToolsTouchStart = (e) => {
    toolsSheetTouch.current = { y: e.touches[0].clientY, dragging: true };
  };
  const handleToolsTouchEnd = (e) => {
    if (!toolsSheetTouch.current.dragging) return;
    const endY = e.changedTouches[0].clientY;
    if (endY - toolsSheetTouch.current.y > 60) setShowMobileTools(false);
    toolsSheetTouch.current.dragging = false;
  };

  // Cross-device sync state
  const [syncStatus,    setSyncStatus]    = useState("idle"); // "idle" | "syncing" | "saved" | "offline"
  const rawSupabaseUserId = session?.supabaseUserId ?? null;
  // Only treat as a real Supabase session if an sb- auth token exists in localStorage.
  // localStorage-only accounts may carry a stale supabaseUserId but no active session,
  // in which case sync would always fail and falsely show "Offline".
  const hasSupabaseSession = (() => {
    if (typeof window === "undefined") return false;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("sb-")) return true;
      }
    } catch {}
    return false;
  })();
  const supabaseUserId = (rawSupabaseUserId && hasSupabaseSession) ? rawSupabaseUserId : null;
  const initialSyncDoneRef = useRef(false);
  const skipNextPushRef = useRef(false);
  const pushTimerRef = useRef(null);

  const copyTrading  = useCopyTrading(session.username);
  const paperAccts   = usePaperAccounts(session.username);

  // Apply saved theme + accent on mount
  useEffect(() => {
    try {
      const accent = localStorage.getItem("nexyru_accent") || "#6366f1";
      document.documentElement.style.setProperty("--accent", accent);

      const theme = localStorage.getItem("nexyru_theme") === "light" ? "light" : "dark";
      const vars = theme === "light"
        ? {
            "--bg": "#ffffff",
            "--surface": "#f9fafb",
            "--surface2": "#f3f4f6",
            "--border": "#e5e7eb",
            "--text-primary": "#111827",
            "--text-secondary": "#6b7280",
            "--text-muted": "#9ca3af",
          }
        : {
            "--bg": "#080808",
            "--surface": "#111111",
            "--surface2": "#1a1a1a",
            "--border": "#1e1e1e",
            "--text-primary": "#ffffff",
            "--text-secondary": "#6b7280",
            "--text-muted": "#374151",
          };
      const css = `:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";")}}`;
      let tag = document.getElementById("nexyru-theme-vars");
      if (!tag) {
        tag = document.createElement("style");
        tag.id = "nexyru-theme-vars";
        document.head.appendChild(tag);
      }
      tag.textContent = css;
      if (theme === "light") {
        document.documentElement.classList.add("light-mode");
      } else {
        document.documentElement.classList.remove("light-mode");
      }
    } catch {}
  }, []);

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

  // Load trades on mount — local first for instant UI, then Supabase sync
  useEffect(() => {
    let cancelled = false;
    setTradesLoading(true);
    initialSyncDoneRef.current = false;

    const localSaved = loadUserTrades(session.username) ?? [];
    setTrades(localSaved);
    setTradesLoading(false);

    // Rehydrate screenshots in the background
    Promise.all(localSaved.map(rehydrateScreenshot)).then(hydrated => {
      if (!cancelled) setTrades(prev => {
        // Only replace if we haven't already moved past this baseline
        if (prev.length !== hydrated.length) return prev;
        return hydrated;
      });
    });

    // If we have a Supabase user, sync with the cloud
    if (!supabaseUserId) {
      initialSyncDoneRef.current = true;
      return () => { cancelled = true; };
    }

    setSyncStatus("syncing");
    (async () => {
      try {
        const res = await fetch(`/api/trades?user_id=${encodeURIComponent(supabaseUserId)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const body = await res.json();
        const remote = Array.isArray(body.trades) ? body.trades : [];
        if (cancelled) return;

        if (remote.length > 0) {
          // Cloud wins on a new device — overwrite local
          saveUserTrades(session.username, remote);
          skipNextPushRef.current = true;
          setTrades(remote);
          // Rehydrate any screenshots that exist locally in IDB (best-effort)
          Promise.all(remote.map(rehydrateScreenshot)).then(hyd => {
            if (!cancelled) {
              skipNextPushRef.current = true;
              setTrades(hyd);
            }
          }).catch(() => {});
          initialSyncDoneRef.current = true;
          setSyncStatus("saved");
        } else if (localSaved.length > 0) {
          // First-time upload — push local trades to Supabase
          const stripped = localSaved.map(stripScreenshot);
          const upRes = await fetch("/api/trades", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: supabaseUserId, trades: stripped }),
          });
          initialSyncDoneRef.current = true;
          if (cancelled) return;
          setSyncStatus(upRes.ok ? "saved" : "offline");
        } else {
          initialSyncDoneRef.current = true;
          setSyncStatus("saved");
        }
      } catch (e) {
        if (!cancelled) {
          initialSyncDoneRef.current = true;
          setSyncStatus("offline");
        }
      }
    })();

    return () => { cancelled = true; };
  }, [session.username, supabaseUserId]);

  // Persist on change: localStorage immediately, Supabase debounced
  useEffect(() => {
    saveUserTrades(session.username, trades);
    paperAccts.syncBalance(trades);

    if (!supabaseUserId || !initialSyncDoneRef.current) return;
    if (skipNextPushRef.current) {
      skipNextPushRef.current = false;
      return;
    }

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    setSyncStatus("syncing");
    pushTimerRef.current = setTimeout(async () => {
      try {
        const stripped = trades.map(stripScreenshot);
        const res = await fetch("/api/trades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: supabaseUserId, trades: stripped }),
        });
        setSyncStatus(res.ok ? "saved" : "offline");
      } catch {
        setSyncStatus("offline");
      }
    }, 600);
  }, [trades, session.username, supabaseUserId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    deleteScreenshot(id);
    setTrades(prev => prev.filter(t => t.id !== id));
    if (supabaseUserId) {
      fetch(`/api/trades?trade_id=${encodeURIComponent(id)}&user_id=${encodeURIComponent(supabaseUserId)}`, { method: "DELETE" }).catch(() => {});
    }
    toast("Trade deleted", "success");
  }, [supabaseUserId]);

  const strategies = useMemo(() => Array.from(new Set(trades.map(t=>t.strategy).filter(Boolean))).sort(), [trades]);

  // Trades scoped to active account for display
  const activeTrades = useMemo(() => {
    if (!paperAccts.activeAccount || paperAccts.accounts.length === 0) return trades;
    const id = paperAccts.activeAccount.id;
    const isDefault = paperAccts.accounts[0]?.id === id;
    return trades.filter(t => t.accountId === id || (!t.accountId && isDefault));
  }, [trades, paperAccts.activeAccount, paperAccts.accounts]);

  if (typeof window !== "undefined" && window.innerWidth < 768 || isMobile) {
    return (
      <>
        <MobileDashboard
          trades={activeTrades}
          session={session}
          activeAccount={paperAccts?.activeAccount}
          onAddTrade={() => setShowForm(true)}
          onImport={() => setShowHub(true)}
          showForm={showForm}
          showHub={showHub}
        />
        {(showForm || editTrade) && <TradeForm initial={editTrade} strategies={strategies} onSave={saveTrade} onClose={() => { setShowForm(false); setEditTrade(null); }}/>}
        {showHub && <ImportHub onManual={() => setShowForm(true)} onCSV={() => { setCsvInitialTab("csv"); setShowCSV(true); }} onScreenshot={() => { setCsvInitialTab("ai"); setShowCSV(true); }} onClose={() => setShowHub(false)} accountType={paperAccts.activeAccount?.type ?? "paper"}/>}
      </>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a0f", fontFamily:"system-ui,-apple-system,sans-serif", color:"#ffffff" }}>

      {/* Modals */}
      {(showForm || editTrade) && <TradeForm initial={editTrade} strategies={strategies} onSave={saveTrade} onClose={() => { setShowForm(false); setEditTrade(null); }}/>}

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
      {showCSV && <CSVUploader initialTab={csvInitialTab} onImport={(imported) => setTrades(prev => [...prev, ...imported.map(t => ({ ...t, accountId: paperAccts.activeAccount?.id ?? null }))])} onClose={() => setShowCSV(false)}/>}
      {showHub && <ImportHub onManual={() => setShowForm(true)} onCSV={() => { setCsvInitialTab("csv"); setShowCSV(true); }} onScreenshot={() => { setCsvInitialTab("ai"); setShowCSV(true); }} onClose={() => setShowHub(false)} accountType={paperAccts.activeAccount?.type ?? "paper"}/>}
      {showAddAcct && <AddAccountModal onAdd={paperAccts.addAccount} onClose={() => setShowAddAcct(false)}/>}

      {/* ── Left Sidebar (desktop) ── */}
      <aside className="hide-mobile" style={{ position:"fixed", top:0, left:0, bottom:0, width:56, background:"#0f0f14", borderRight:"1px solid #1e1e2a", display:"flex", flexDirection:"column", alignItems:"center", padding:"10px 0 14px", zIndex:50 }}>
        {/* Logo mark */}
        <a href="/" aria-label="Nexyru" style={{ width:36, height:36, borderRadius:9, background:"linear-gradient(135deg,#6366f1,#4f46e5)", display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none", marginBottom:14, flexShrink:0, fontWeight:900, color:"#fff", fontSize:16, letterSpacing:"-0.02em" }}>N</a>

        {/* Nav stack */}
        <nav style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
          {/* Group 1 — Main */}
          <SidebarItem icon={SIDEBAR_ICONS.dashboard} label="Dashboard"    active={tab==="dashboard"} onClick={()=>setTab("dashboard")}/>
          <SidebarItem icon={SIDEBAR_ICONS.journal}   label="Journal"      active={tab==="journal"}   onClick={()=>setTab("journal")}/>

          <SidebarDivider/>

          {/* Group 2 — Daily */}
          <SidebarGroupLabel label="Daily"/>
          <SidebarItem icon={SIDEBAR_ICONS.checklist} label="Checklist"     href="/checklist"/>
          <SidebarItem icon={SIDEBAR_ICONS.bell}      label="Alerts"        href="/alerts"/>
          <SidebarItem icon={SIDEBAR_ICONS.trophy}    label="Challenge"     href="/challenge"/>

          <SidebarDivider/>

          {/* Group 3 — Analyze */}
          <SidebarGroupLabel label="Analyze"/>
          <SidebarItem icon={SIDEBAR_ICONS.brain}     label="Psychology"    href="/psychology"/>
          <SidebarItem icon={SIDEBAR_ICONS.target}    label="Best Setups"   href="/setups"/>
          <SidebarItem icon={SIDEBAR_ICONS.chart}     label="Insights"      active={tab==="insights"}  onClick={()=>setTab("insights")}/>
          <SidebarItem icon={SIDEBAR_ICONS.play}      label="Trade Review"  href="/replay"/>

          <SidebarDivider/>

          {/* Group 4 — Build */}
          <SidebarGroupLabel label="Build"/>
          <SidebarItem icon={SIDEBAR_ICONS.flask}     label="Strategy Lab"  active={tab==="stratlab"}  onClick={()=>setTab("stratlab")}/>
        </nav>

        {/* Settings at bottom */}
        <SidebarItem icon={SIDEBAR_ICONS.gear} label="Settings" href="/settings"/>
      </aside>

      {/* ── Main column (top bar + content) ── */}
      <div className="main-with-sidebar" style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>

        {/* ── Top bar ── */}
        <header style={{ height:48, background:"#0a0a0f", borderBottom:"1px solid #1e1e2a", display:"flex", alignItems:"center", padding:"0 16px", gap:10, position:"sticky", top:0, zIndex:40, flexShrink:0, maxWidth:"100%", overflow:"hidden" }}>
          {/* Breadcrumb */}
          <div style={{ flex:1, display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
            <span style={{ fontSize:13, fontWeight:700, color:"#ffffff", letterSpacing:"-0.01em", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
              {TAB_LABELS[tab] ?? "Dashboard"}
            </span>
            {isDemoMode(session.username) && (
              <span style={{ fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:10, background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.25)", color:"#f59e0b", whiteSpace:"nowrap" }} className="hide-mobile">DEMO MODE</span>
            )}
          </div>

          {/* Right: account selector + Log Trade + avatar */}
          <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
            {supabaseUserId && <SyncIndicator status={syncStatus} />}
            <AccountSwitcher accounts={paperAccts.accounts} activeAccount={paperAccts.activeAccount} onSwitch={paperAccts.setActiveAccount} onAdd={() => setShowAddAcct(true)} trades={trades}/>
            {!isMobile && (
              <button onClick={()=>setShowHub(true)} style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:8, border:"none", background:"var(--accent)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                <Plus size={13}/><span>Log Trade</span>
              </button>
            )}
            <div style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 8px", borderRadius:8, border:"1px solid #2a2a3a", background:"#1a1a24" }}>
              <a href={`/trader/@${session.username}`} style={{ display:"flex", alignItems:"center", gap:5, textDecoration:"none" }}>
                <div style={{ width:22, height:22, borderRadius:"50%", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:"#fff" }}>{session.displayName[0].toUpperCase()}</div>
                <span style={{ fontSize:11, color:"#9ca3af", fontWeight:600 }} className="hide-mobile">{session.displayName}</span>
              </a>
              <button onClick={onLogout} title="Sign out" style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer", display:"flex", padding:2 }} className="hide-mobile"><LogOut size={12}/></button>
            </div>
          </div>
        </header>

        {/* ── Page content ── */}
        <main style={{ flex:1, padding:"24px", paddingBottom: isMobile ? 70 : 0, background:"#0a0a0f" }}>
          <div style={{ maxWidth:1200, margin:"0 auto" }}>
            <DemoBanner username={session.username} onClear={() => {
              setDemoMode(session.username, false);
              saveUserTrades(session.username, []);
              setTrades([]);
              setShowAccountSetup(true);
            }}/>
          </div>
          <div key={tab} className="page-enter" style={{ maxWidth:1200, margin:"0 auto", paddingTop:12 }}>

          {tab==="dashboard"  && <DashboardHome loading={tradesLoading} trades={activeTrades} allTrades={trades} onAddTrade={()=>setShowForm(true)} onOpenImport={()=>setShowHub(true)} activeAccount={paperAccts.activeAccount} username={session.username} onClearDemo={() => {
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
              onCSV={() => { setCsvInitialTab("csv"); setShowCSV(true); }}
              onSaveTrade={saveTrade}
              activeAccount={paperAccts.activeAccount}
              username={session.username}
            />
          )}
          {tab==="strategies" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}><div style={{ fontSize:18, fontWeight:800, color:"#ffffff" }}>Strategy Performance</div><StrategyCards trades={activeTrades}/></div>
          )}
          {tab==="insights"   && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}><div style={{ fontSize:18, fontWeight:800, color:"#ffffff" }}>Insights</div><InsightsAnalyticsPage trades={activeTrades}/></div>
          )}
          {tab==="stratlab"   && <StrategyLabPage session={session} trades={activeTrades}/>}
          {tab==="copy" && <CopyTradingPage session={session} copyTrading={copyTrading}/> }
          </div>
        </main>
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
        ::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 2px; }
        a { transition: opacity 0.15s; }
        a:hover { opacity: 0.85; }
        button { transition: opacity 0.15s, transform 0.1s; }
        button:active { transform: scale(0.97); }
        .hide-mobile { display: flex !important; }
        .show-mobile { display: none !important; }
        .main-with-sidebar { margin-left: 56px; }
        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
          .main-with-sidebar { margin-left: 0 !important; }
          aside.hide-mobile { display: none !important; }
        }
      `}</style>
      {isMobile && (
        <button
          onClick={() => setShowForm(true)}
          style={{
            position:'fixed', bottom:72, right:16,
            width:56, height:56, borderRadius:'50%',
            background:'var(--accent)', border:'none',
            color:'#fff', fontSize:28, cursor:'pointer',
            zIndex:8000, display:'flex', alignItems:'center',
            justifyContent:'center',
            boxShadow:'0 4px 20px rgba(99,102,241,0.5)',
            lineHeight:1
          }}
        >+</button>
      )}
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
    <div style={{minHeight:"100vh",background:"#060d1a",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}><style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes glow{0%,100%{box-shadow:0 0 20px rgba(99,102,241,0.1)}50%{box-shadow:0 0 40px rgba(99,102,241,0.25)}}`}</style><div style={{width:"100%",maxWidth:420,padding:20,animation:"fadeIn 0.5s ease"}}><div style={{textAlign:"center",marginBottom:40}}><div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:72,height:72,borderRadius:20,background:"linear-gradient(135deg,#0f1e32,#1a2f4a)",border:"1px solid rgba(99,102,241,0.2)",marginBottom:20,animation:"glow 3s ease-in-out infinite"}}><span style={{fontSize:32}}></span></div><h1 style={{fontSize:36,fontWeight:900,color:"#ffffff",margin:"0 0 8px",letterSpacing:"-0.03em"}}>Nexyru</h1><p style={{fontSize:14,color:"#2a2a3a",margin:0}}>Your trading journal & performance hub</p></div><div style={{background:"linear-gradient(135deg,#111118,#111118)",border:"1px solid #2a2a3a",borderRadius:24,padding:"36px 32px"}}><h2 style={{fontSize:20,fontWeight:800,color:"#ffffff",textAlign:"center",margin:"0 0 6px"}}>Welcome to Nexyru</h2><p style={{fontSize:13,color:"#2a2a3a",textAlign:"center",margin:"0 0 28px"}}>Sign in to access your trades and insights</p><a href={url} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,width:"100%",padding:"14px 20px",borderRadius:14,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.05)",color:"#ffffff",fontSize:15,fontWeight:700,textDecoration:"none",boxSizing:"border-box"}}><svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>Continue with Google</a><div style={{display:"flex",alignItems:"center",gap:12,margin:"24px 0"}}><div style={{flex:1,height:1,background:"#2a2a3a"}}/><span style={{fontSize:11,color:"#2e3f5a"}}>what you get</span><div style={{flex:1,height:1,background:"#2a2a3a"}}/></div><div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[["","AI-powered trade analysis & insights"],["","Verified leaderboard rankings"],["","Copy top traders"],["","Works across all your devices"]].map(([i,t],idx)=>(<div key={idx} style={{display:"flex",alignItems:"center",gap:10,fontSize:12,color:"#6b7280"}}><span style={{fontSize:16}}>{i}</span>{t}</div>
            ))}
          </div></div></div></div>
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
    <div style={{minHeight:"100vh",background:"#060d1a",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}><style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style><div style={{width:"100%",maxWidth:420,padding:20,animation:"fadeIn 0.4s ease"}}>
        {/* Avatar */}
        <div style={{textAlign:"center",marginBottom:32}}><div style={{width:72,height:72,borderRadius:20,background:"rgba(99,102,241,0.15)",border:"2px solid rgba(99,102,241,0.3)",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:28,fontWeight:900,color:"#6366f1",marginBottom:16}}>
            {auth.pendingGoogle?.displayName?.slice(0,2).toUpperCase() || ""}
          </div><div style={{fontSize:16,fontWeight:700,color:"#ffffff"}}>{auth.pendingGoogle?.displayName}</div><div style={{fontSize:12,color:"#2a2a3a"}}>{auth.pendingGoogle?.email}</div></div><div style={{background:"linear-gradient(135deg,#111118,#111118)",border:"1px solid #2a2a3a",borderRadius:24,padding:"32px 28px"}}><h2 style={{fontSize:20,fontWeight:800,color:"#ffffff",margin:"0 0 6px",textAlign:"center"}}>Choose your username</h2><p style={{fontSize:13,color:"#2a2a3a",textAlign:"center",margin:"0 0 24px"}}>This is how other traders will find you on Nexyru</p><div style={{marginBottom:16}}><div style={{display:"flex",alignItems:"center",background:"#0b1628",border:`1px solid ${error?"rgba(248,113,113,0.4)":"#2a2a3a"}`,borderRadius:12,overflow:"hidden"}}><span style={{padding:"0 12px",color:"#2a2a3a",fontSize:14,flexShrink:0}}>@</span><input
                value={username}
                onChange={e => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,"")); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                placeholder="yourname"
                maxLength={20}
                style={{flex:1,padding:"13px 12px 13px 0",background:"transparent",border:"none",color:"#ffffff",fontSize:15,outline:"none"}}
                autoFocus
              /></div>
            {error && <div style={{fontSize:11,color:"#ef4444",marginTop:6}}>{error}</div>}
            <div style={{fontSize:11,color:"#2a2a3a",marginTop:6}}>Letters, numbers and underscores only · 3-20 characters</div></div><button onClick={handleSubmit} disabled={loading || username.length < 3} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:username.length >= 3 ? "#6366f1" : "#111118",color:username.length >= 3 ? "#fff" : "#2a2a3a",fontSize:15,fontWeight:700,cursor:username.length >= 3 ? "pointer" : "not-allowed"}}>
            {loading ? "Setting up…" : "Continue →"}
          </button></div></div></div>
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
    { id:"paper",  emoji:"", label:"Paper Trading",   desc:"Practice with virtual money. No risk, full features.", color:"#6366f1" },
    { id:"funded", emoji:"", label:"Funded Account",  desc:"I'm trading with a prop firm challenge or funded account.", color:"#f59e0b" },
    { id:"live",   emoji:"", label:"Live Trading",    desc:"Trading with my own real capital.", color:"#10b981" },
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
    <div style={{position:"fixed",inset:0,zIndex:99999,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}><div style={{position:"absolute",inset:0,background:"rgba(4,8,20,0.96)",backdropFilter:"blur(24px)"}}/><div style={{position:"relative",zIndex:1,width:"100%",maxWidth:580,margin:"0 20px",maxHeight:"90vh",overflowY:"auto"}}><style>{`@keyframes setupIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style><div style={{background:"linear-gradient(135deg,#111118,#111118)",border:"1px solid #2a2a3a",borderRadius:28,overflow:"hidden",animation:"setupIn 0.4s ease",boxShadow:"0 40px 120px rgba(0,0,0,0.9)"}}>

          {/* Header */}
          <div style={{padding:"28px 32px 20px",borderBottom:"1px solid #111118"}}><div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}><div style={{width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,rgba(99,102,241,0.2),rgba(99,102,241,0.05))",border:"1px solid rgba(99,102,241,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}></div><div><div style={{fontSize:11,fontWeight:700,color:"#6366f1",letterSpacing:"0.08em",marginBottom:2}}>STEP {step} OF {totalSteps}</div><h2 style={{fontSize:19,fontWeight:900,color:"#ffffff",margin:0,letterSpacing:"-0.02em"}}>
                  {step===1 ? "What type of account are you trading?" : step===2 ? "What's your account size?" : "Set up your funded challenge rules"}
                </h2></div></div><div style={{display:"flex",gap:6,marginTop:14}}>
              {Array.from({length:totalSteps}).map((_,i) =>(<div key={i} style={{flex:1,height:3,borderRadius:2,background:i+1<=step?"#6366f1":"#2a2a3a",transition:"background 0.3s"}}/>
              ))}
            </div></div>

          {/* Step 1 — Account Type */}
          {step === 1 && (
            <div style={{padding:"24px 32px 28px"}}><div style={{display:"flex",flexDirection:"column",gap:10}}>
                {TYPES.map(t =>(<button key={t.id} onClick={() => setType(t.id)} style={{display:"flex",alignItems:"center",gap:16,padding:"16px 20px",borderRadius:16,border:`1.5px solid ${type===t.id?t.color+"60":"#2a2a3a"}`,background:type===t.id?`${t.color}0d`:"rgba(255,255,255,0.02)",cursor:"pointer",textAlign:"left",transition:"all 0.15s",outline:"none"}}><div style={{width:48,height:48,borderRadius:14,background:`${t.color}18`,border:`1.5px solid ${t.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{t.emoji}</div><div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}><span style={{fontSize:14,fontWeight:800,color:type===t.id?t.color:"#ffffff"}}>{t.label}</span>
                        {type===t.id && <span style={{fontSize:10,color:t.color}}>✓</span>}
                      </div><span style={{fontSize:12,color:"#6b7280",lineHeight:1.5}}>{t.desc}</span></div></button>
                ))}
              </div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:24}}><button onClick={onSkip} style={{background:"none",border:"none",color:"#374151",fontSize:13,cursor:"pointer",padding:0}}>Skip for now</button><button onClick={() => type && setStep(2)} disabled={!type} style={{padding:"11px 28px",borderRadius:14,border:"none",background:type?"#6366f1":"#2a2a3a",color:type?"#fff":"#374151",fontSize:14,fontWeight:700,cursor:type?"pointer":"not-allowed"}}>Continue →</button></div></div>
          )}

          {/* Step 2 — Account Size */}
          {step === 2 && (
            <div style={{padding:"24px 32px 28px"}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,padding:"10px 14px",borderRadius:12,background:`${selectedType?.color}0d`,border:`1px solid ${selectedType?.color}25`}}><span style={{fontSize:16}}>{selectedType?.emoji}</span><span style={{fontSize:13,color:selectedType?.color,fontWeight:600}}>{selectedType?.label}</span><button onClick={() => setStep(1)} style={{marginLeft:"auto",background:"none",border:"none",color:"#6b7280",fontSize:11,cursor:"pointer",padding:"2px 8px",borderRadius:6,border:"1px solid #2a2a3a"}}>Change</button></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:24}}>
                {SIZES.map(s =>(<button key={s.value} onClick={() => autoFill(s.value)} style={{padding:"14px 10px",borderRadius:14,border:`1.5px solid ${size===s.value?"rgba(99,102,241,0.5)":"#2a2a3a"}`,background:size===s.value?"rgba(99,102,241,0.08)":"rgba(255,255,255,0.02)",cursor:"pointer",textAlign:"center",position:"relative",outline:"none",transition:"all 0.15s"}}>
                    {s.tag && <div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",background:"#6366f1",borderRadius:10,padding:"1px 8px",fontSize:8,fontWeight:700,color:"#fff",whiteSpace:"nowrap"}}>{s.tag}</div>}
                    <div style={{fontSize:16,fontWeight:900,color:size===s.value?"#6366f1":"#ffffff",fontFamily:"monospace"}}>{s.label}</div><div style={{fontSize:10,color:"#2a2a3a",marginTop:2}}>{s.value.toLocaleString()}</div></button>
                ))}
              </div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><button onClick={() => setStep(1)} style={{background:"none",border:"none",color:"#374151",fontSize:13,cursor:"pointer",padding:0}}>← Back</button><button onClick={() => size && (type==="funded" ? setStep(3) : handleDone())} disabled={!size||loading} style={{padding:"11px 28px",borderRadius:14,border:"none",background:size&&!loading?"#6366f1":"#2a2a3a",color:size&&!loading?"#fff":"#374151",fontSize:14,fontWeight:700,cursor:size&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",gap:8}}>
                  {loading ? "Setting up…" : type==="funded" ? "Next →" : "Let's go "}
                </button></div></div>
          )}

          {/* Step 3 — Funded Challenge Rules (funded only) */}
          {step === 3 && type === "funded" && (
            <div style={{padding:"24px 32px 28px"}}>
              {/* Prop firm selector */}
              <div style={{marginBottom:16}}><label style={{fontSize:11,fontWeight:700,color:"#6b7280",letterSpacing:"0.06em",display:"block",marginBottom:8}}>PROP FIRM</label><div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {PROP_FIRMS.map(f =>(<button key={f} onClick={() => setPropFirm(f)} style={{padding:"6px 12px",borderRadius:20,border:`1px solid ${propFirm===f?"rgba(245,158,11,0.5)":"#2a2a3a"}`,background:propFirm===f?"rgba(245,158,11,0.1)":"rgba(255,255,255,0.02)",color:propFirm===f?"#f59e0b":"#6b7280",fontSize:11,fontWeight:propFirm===f?700:400,cursor:"pointer",outline:"none"}}>
                      {f}
                    </button>
                  ))}
                </div>
                {propFirm === "Other" && (
                  <input value={propFirm==="Other"?"":propFirm} onChange={e=>setPropFirm(e.target.value)} placeholder="Enter firm name…" style={{marginTop:8,width:"100%",padding:"9px 12px",borderRadius:10,border:"1px solid #2a2a3a",background:"#111118",color:"#ffffff",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                )}
              </div>

              {/* Phase */}
              <div style={{marginBottom:16}}><label style={{fontSize:11,fontWeight:700,color:"#6b7280",letterSpacing:"0.06em",display:"block",marginBottom:8}}>CHALLENGE PHASE</label><div style={{display:"flex",gap:8}}>
                  {[{id:"phase1",label:"Phase 1"},{ id:"phase2",label:"Phase 2"},{id:"funded",label:"Funded"}].map(p =>(<button key={p.id} onClick={() => setPhase(p.id)} style={{flex:1,padding:"8px",borderRadius:10,border:`1px solid ${phase===p.id?"rgba(245,158,11,0.4)":"#2a2a3a"}`,background:phase===p.id?"rgba(245,158,11,0.08)":"rgba(255,255,255,0.02)",color:phase===p.id?"#f59e0b":"#6b7280",fontSize:12,fontWeight:phase===p.id?700:400,cursor:"pointer",outline:"none"}}>
                      {p.label}
                    </button>
                  ))}
                </div></div>

              {/* Challenge rules grid */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                {[
                  { label:"PROFIT TARGET ($)", value:profitTarget, set:setProfitTarget, hint:`e.g. ${Math.round((size||100000)*0.08).toLocaleString()}`, color:"#10b981" },
                  { label:"MAX DRAWDOWN ($)", value:maxDrawdown,  set:setMaxDrawdown,  hint:`e.g. ${Math.round((size||100000)*0.06).toLocaleString()}`, color:"#ef4444" },
                  { label:"DAILY LOSS LIMIT ($)", value:dailyLoss, set:setDailyLoss,   hint:`e.g. ${Math.round((size||100000)*0.03).toLocaleString()}`, color:"#f59e0b" },
                  { label:"MIN TRADING DAYS",   value:minDays,    set:setMinDays,     hint:"e.g. 10", color:"#6366f1" },
                ].map(f =>(<div key={f.label}><label style={{fontSize:10,fontWeight:700,color:f.color,letterSpacing:"0.06em",display:"block",marginBottom:6}}>{f.label}</label><input
                      type="number"
                      value={f.value}
                      onChange={e => f.set(e.target.value)}
                      placeholder={f.hint}
                      style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid rgba(${f.color==="34d399"?"52,211,153":f.color==="f87171"?"248,113,113":f.color==="fbbf24"?"251,191,36":"56,189,248"},0.2)`,background:"#111118",color:"#ffffff",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"monospace"}}
                    /></div>
                ))}
              </div>

              {/* Info banner */}
              <div style={{padding:"10px 14px",borderRadius:12,background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.15)",marginBottom:20,fontSize:11,color:"#f59e0b",lineHeight:1.6}}>Nexyru will<strong style={{color:"#f59e0b"}}>automatically track</strong>your daily P&L, drawdown, and progress toward your profit target. You'll get alerts when approaching limits.</div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><button onClick={() => setStep(2)} style={{background:"none",border:"none",color:"#374151",fontSize:13,cursor:"pointer",padding:0}}>← Back</button><button onClick={handleDone} disabled={!propFirm||loading} style={{padding:"11px 28px",borderRadius:14,border:"none",background:propFirm&&!loading?"linear-gradient(135deg,#f59e0b,#f59e0b)":"#2a2a3a",color:propFirm&&!loading?"#000":"#374151",fontSize:14,fontWeight:700,cursor:propFirm&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",gap:8}}>
                  {loading ? "Setting up…" : "Start Tracking "}
                </button></div></div>
          )}
        </div></div></div>
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

 return (<><button
        onClick={() => { if (state === "done") return; setShowModal(true); }}
        title={state === "done" ? "Already shared" : "Share to feed"}
        style={{
          padding: "3px 8px", borderRadius: 8, border: "none", cursor: state === "done" ? "default" : "pointer",
          background: state === "done" ? "rgba(52,211,153,0.1)" : "rgba(99,102,241,0.08)",
          color: state === "done" ? "#10b981" : "#6366f1",
          fontSize: 10, fontWeight: 700, transition: "all 0.15s"
        }}>
        {state === "done" ? "✓ Shared" : state === "sharing" ? "…" : state === "error" ? "✗" : " Share"}
      </button>

      {showModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          style={{ position:"fixed", inset:0, zIndex:99999, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(4,8,20,0.92)", backdropFilter:"blur(16px)", fontFamily:"system-ui,sans-serif" }}><div style={{ background:"linear-gradient(135deg,#111118,#111118)", border:"1px solid #2a2a3a", borderRadius:24, padding:"28px 28px 24px", maxWidth:420, width:"90%", boxShadow:"0 40px 120px rgba(0,0,0,0.9)" }}><div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}><h3 style={{ fontSize:18, fontWeight:900, color:"#ffffff", margin:0 }}>Share to Feed</h3><button onClick={() => setShowModal(false)} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer", fontSize:18 }}>✕</button></div>

            {/* Trade preview */}
            <div style={{ padding:"14px 16px", borderRadius:14, background: pos?"rgba(52,211,153,0.08)":"rgba(248,113,113,0.08)", border:`1px solid ${pos?"rgba(52,211,153,0.2)":"rgba(248,113,113,0.2)"}`, marginBottom:16 }}><div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}><span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:4, background: trade.type==="long"?"rgba(52,211,153,0.15)":"rgba(248,113,113,0.15)", color: trade.type==="long"?"#10b981":"#ef4444" }}>
                  {trade.type==="long"?"▲ LONG":"▼ SHORT"}
                </span><span style={{ fontSize:14, fontWeight:800, color:"#ffffff", fontFamily:"monospace" }}>{trade.symbol || trade.pair}</span>
                {trade.strategy && <span style={{ fontSize:10, color:"#6b7280" }}>{trade.strategy}</span>}
              </div><div style={{ fontSize:22, fontWeight:900, color: pos?"#10b981":"#ef4444", fontFamily:"monospace" }}>
                {pos?"+":""}{pnl.toFixed(2)}
              </div>
              {trade.entryPrice && <div style={{ fontSize:10, color:"#6b7280", marginTop:4 }}>Entry {trade.entryPrice} → Exit {trade.exitPrice}</div>}
            </div>

            {/* Caption */}
            <div style={{ marginBottom:14 }}><label style={{ fontSize:11, fontWeight:700, color:"#6b7280", display:"block", marginBottom:6, letterSpacing:"0.06em", textTransform:"uppercase" }}>Add a note (optional)</label><textarea
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="What was your setup? Any lessons learned?"
                rows={3}
                style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid #2a2a3a", background:"#111118", color:"#ffffff", fontSize:13, outline:"none", resize:"vertical", fontFamily:"system-ui", boxSizing:"border-box" }}
              /></div>

            {/* Visibility */}
            <div style={{ marginBottom:20 }}><label style={{ fontSize:11, fontWeight:700, color:"#6b7280", display:"block", marginBottom:6, letterSpacing:"0.06em", textTransform:"uppercase" }}>Visibility</label><div style={{ display:"flex", gap:8 }}>
                {[["public"," Public"],["followers"," Followers"],["private"," Private"]].map(([v,l]) =>(<button key={v} onClick={() => setVisibility(v)} style={{ flex:1, padding:"7px 4px", borderRadius:10, border:`1px solid ${visibility===v?"rgba(99,102,241,0.4)":"#2a2a3a"}`, background:visibility===v?"rgba(99,102,241,0.08)":"rgba(255,255,255,0.02)", color:visibility===v?"#6366f1":"#6b7280", fontSize:11, fontWeight:visibility===v?700:500, cursor:"pointer" }}>
                    {l}
                  </button>
                ))}
              </div></div><button onClick={handleShare} disabled={state==="sharing"} style={{ width:"100%", padding:"12px", borderRadius:12, border:"none", background:"#6366f1", color:"#fff", fontSize:14, fontWeight:700, cursor:state==="sharing"?"wait":"pointer" }}>
              {state==="sharing" ? "Sharing…" : "Share Trade "}
            </button></div></div>
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
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{position:'fixed',inset:0,zIndex:99999,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(4,8,20,0.92)',backdropFilter:'blur(16px)',fontFamily:'system-ui'}}><div style={{background:'linear-gradient(135deg,#111118,#111118)',border:'1px solid #2a2a3a',borderRadius:24,padding:28,maxWidth:440,width:'90%',boxShadow:'0 40px 120px rgba(0,0,0,0.9)'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}><h3 style={{fontSize:18,fontWeight:900,color:'#ffffff',margin:0}}>Share Trade</h3><button onClick={onClose} style={{background:'none',border:'none',color:'#6b7280',cursor:'pointer',fontSize:18}}>✕</button></div>
        {username && (
          <div style={{fontSize:11,color:'#6b7280',marginBottom:16}}>Sharing as<a href={`/trader/@${username}`} style={{color:'#6366f1',textDecoration:'none',fontWeight:700}}>@{username}</a></div>
        )}
        <div style={{padding:'14px 16px',borderRadius:14,background:pos?'rgba(52,211,153,0.08)':'rgba(248,113,113,0.08)',border:'1px solid '+(pos?'rgba(52,211,153,0.2)':'rgba(248,113,113,0.2)'),marginBottom:16}}><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}><span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,background:trade.type==='long'?'rgba(52,211,153,0.15)':'rgba(248,113,113,0.15)',color:trade.type==='long'?'#10b981':'#ef4444'}}>{trade.type==='long'?'▲ LONG':'▼ SHORT'}</span><span style={{fontSize:15,fontWeight:800,color:'#ffffff',fontFamily:'monospace'}}>{trade.symbol||trade.pair}</span></div><div style={{fontSize:24,fontWeight:900,color:pos?'#10b981':'#ef4444',fontFamily:'monospace'}}>{pos?'+':''}{pnl.toFixed(2)}</div>
          {trade.entryPrice&&<div style={{fontSize:11,color:'#6b7280',marginTop:4}}>Entry {trade.entryPrice} → Exit {trade.exitPrice}</div>}
        </div><div style={{marginBottom:14}}><label style={{fontSize:11,fontWeight:700,color:'#6b7280',display:'block',marginBottom:6,textTransform:'uppercase'}}>Note (optional)</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="What was your setup?" rows={3} style={{width:'100%',padding:'10px 12px',borderRadius:10,border:'1px solid #2a2a3a',background:'#111118',color:'#ffffff',fontSize:13,outline:'none',resize:'vertical',fontFamily:'system-ui',boxSizing:'border-box'}}/></div><div style={{marginBottom:20}}><label style={{fontSize:11,fontWeight:700,color:'#6b7280',display:'block',marginBottom:8,textTransform:'uppercase'}}>Visibility</label><div style={{display:'flex',gap:8}}>
            {[['public',' Public'],['followers',' Followers'],['private',' Private']].map(([v,l])=>(<button key={v} onClick={()=>setVis(v)} style={{flex:1,padding:8,borderRadius:10,border:'1px solid '+(vis===v?'rgba(99,102,241,0.4)':'#2a2a3a'),background:vis===v?'rgba(99,102,241,0.08)':'rgba(255,255,255,0.02)',color:vis===v?'#6366f1':'#6b7280',fontSize:11,fontWeight:vis===v?700:500,cursor:'pointer'}}>{l}</button>
            ))}
          </div></div>
        {status.startsWith('error')&&<div style={{padding:'8px 12px',borderRadius:10,background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.2)',fontSize:12,color:'#ef4444',marginBottom:12}}>{status.slice(5)}</div>}
        <button onClick={share} disabled={status==='sharing'||status==='done'} style={{width:'100%',padding:12,borderRadius:12,border:'none',background:status==='done'?'rgba(52,211,153,0.15)':'#6366f1',color:status==='done'?'#10b981':'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
          {status==='done'?'✓ Shared!':status==='sharing'?'Sharing…':'Share Trade '}
        </button></div></div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TOAST HELPER — calls window.showToast (container mounted in root layout)
// ═══════════════════════════════════════════════════════════════

function toast(message, type = "info") {
  if (typeof window !== "undefined" && typeof window.showToast === "function") {
    window.showToast(message, type);
  } else if (typeof window !== "undefined") {
    // Container not yet mounted — retry shortly.
    setTimeout(() => { try { window.showToast?.(message, type); } catch {} }, 50);
  }
}

// ── App ────────────────────────────────────────────────────────
export default function App() {
  const auth = useAuth();

  if (!auth.hydrated) return (
    <div style={{ minHeight:"100vh", background:"#0a0a0f", display:"flex", alignItems:"center", justifyContent:"center" }}><div style={{ width:32, height:32, border:"3px solid #2a2a3a", borderTopColor:"#6366f1", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/><style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style></div>);

 if (!auth.session && !auth.needsUsername) return<GoogleAuthScreen/>;
 if (auth.needsUsername) return<UsernamePickerScreen auth={auth}/>;
 return<TradingDashboard session={auth.session} onLogout={auth.logout}/>;
}
