"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";

// ── Types ─────────────────────────────────────────────────────────
type AlertType =
  | "daily_loss"
  | "session_start"
  | "price_level"
  | "max_trades"
  | "profit_target"
  | "strategy_signal"
  | "position_size";

type StratTimeframe = "1m" | "5m" | "15m" | "1h";
type WeekDay = "mon" | "tue" | "wed" | "thu" | "fri";

interface StratCond {
  id: string;
  params?: Record<string, string | number>;
}

interface SavedStrategy {
  id: string;
  name: string;
  description?: string;
  defaultSymbol?: string;
  rules?: {
    entryConds?: StratCond[];
  };
}

interface ChallengeAccount {
  id: string;
  name: string;
  accountSize?: number;
  dailyLoss?: number;
  profitTarget?: number;
}

interface AlertConfig {
  // ── Common
  message?: string;
  notifyBrowser?: boolean;
  notifySound?: boolean;
  accountId?: string;

  // ── daily_loss
  lossPct?: number;
  lossPct2Enabled?: boolean;
  lossPct2?: number;
  lossRepeat?: "daily" | "every";

  // ── session_start
  time?: string;
  days?: WeekDay[];
  timezone?: string;
  earlyWarning?: number;          // mins, 0 = none
  showChecklist?: boolean;

  // ── price_level
  symbol?: string;
  condition?: "reaches" | "above" | "below" | "touches";
  price?: number;
  bias?: "long" | "short" | "watch";
  note?: string;
  expiresEnabled?: boolean;
  expiresDays?: number;
  repeatMode?: "once" | "repeat";

  // ── max_trades
  trades?: number;
  warnAt?: number;                // 1 or 2 trades remaining
  period?: "day" | "session" | "week";
  hardStop?: boolean;

  // ── profit_target
  targetPct?: number;
  checkpoints?: number[];
  celebration?: boolean;

  // ── strategy_signal
  strategyId?: string;
  strategyName?: string;
  timeframe?: StratTimeframe;
  symbolMode?: "default" | "custom";
  customSymbol?: string;
  instruments?: string[];
  entryConds?: StratCond[];
  cooldown?: number;              // mins
  sessionOnly?: boolean;

  // ── position_size
  accountSize?: number;
  riskPct?: number;
  stopPts?: number;
  pointValue?: number;
  showBefore?: "every_trade" | "manual";
  displayAs?: "floating" | "banner";
  showMaxTrades?: boolean;

  // legacy / overflow
  direction?: "above" | "below";
}

interface Alert {
  id: string;
  type: AlertType;
  name: string;
  enabled: boolean;
  config: AlertConfig;
  lastTriggered: number | null;
  triggerCount?: number;
  todayCount?: number;
}

interface AlertTypeMeta {
  key: AlertType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

// ── Constants ─────────────────────────────────────────────────────
const STORAGE_KEY = "nexyru_alerts";
const SESSION_KEY = "tradedesk_session_v1";
const STRAT_KEYS = (u: string) => [
  `nexyru_strategies_${u}`,
  `tradedesk_stratlab_${u}_v1`,
];
const TIMEZONES = ["ET", "CT", "MT", "PT"] as const;
const SYMBOLS = ["ES", "NQ", "CL", "GC", "BTC", "ETH", "SOL"] as const;
const TIMEFRAMES: StratTimeframe[] = ["1m", "5m", "15m", "1h"];
const WEEKDAYS: { key: WeekDay; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
];
const POINT_VALUES: Record<string, number> = {
  ES: 50, NQ: 20, CL: 1000, GC: 100, BTC: 5, ETH: 50, SOL: 50,
};

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ALERT_TYPES: AlertTypeMeta[] = [
  {
    key: "daily_loss",
    label: "Daily Loss Warning",
    description: "Notify me when I've used X% of my daily loss limit",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.10)",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    key: "session_start",
    label: "Session Start",
    description: "Remind me at 9:30am ET to start my session",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.10)",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    key: "price_level",
    label: "Price Level",
    description: "Notify me when [symbol] reaches [price]",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.10)",
    icon: (
      <svg {...ICON_PROPS}>
        <line x1="3" y1="21" x2="21" y2="21" />
        <line x1="7" y1="21" x2="7" y2="13" />
        <line x1="12" y1="21" x2="12" y2="9" />
        <line x1="17" y1="21" x2="17" y2="5" />
      </svg>
    ),
  },
  {
    key: "max_trades",
    label: "Max Trades",
    description: "Notify me when I've taken [X] trades today",
    color: "#a855f7",
    bg: "rgba(168,85,247,0.10)",
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    key: "profit_target",
    label: "Profit Target",
    description: "Notify me when I'm [X]% to my challenge profit target",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.10)",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    key: "strategy_signal",
    label: "Strategy Signal",
    description: "Fire when all entry conditions from a saved strategy are met",
    color: "#6366f1",
    bg: "rgba(99,102,241,0.10)",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M9 2v6l-3 3a4 4 0 0 0 4 7h0a4 4 0 0 0 4-7l-3-3V2" />
        <line x1="8" y1="2" x2="16" y2="2" />
      </svg>
    ),
  },
  {
    key: "position_size",
    label: "Position Size",
    description: "Remind me of my position size before each trade",
    color: "#14b8a6",
    bg: "rgba(20,184,166,0.10)",
    icon: (
      <svg {...ICON_PROPS}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="14" x2="10" y2="14" />
        <line x1="14" y1="14" x2="16" y2="14" />
        <line x1="8" y1="17" x2="10" y2="17" />
        <line x1="14" y1="17" x2="16" y2="17" />
      </svg>
    ),
  },
];

// ── Helpers ───────────────────────────────────────────────────────
const humanizeCond = (id: string): string => {
  const parts = id.split("_");
  const acronyms = new Set(["ema", "sma", "vwap", "rsi", "atr", "bos", "fvg", "macd"]);
  return parts
    .map(p => acronyms.has(p) ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
};

const condLine = (c: StratCond): string => {
  const base = humanizeCond(c.id);
  if (!c.params || !Object.keys(c.params).length) return base;
  const suffix = Object.entries(c.params)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  return `${base} (${suffix})`;
};

const loadStrategies = (username: string): SavedStrategy[] => {
  if (typeof window === "undefined") return [];
  for (const key of STRAT_KEYS(username)) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((s: SavedStrategy) => ({
          ...s,
          rules: { entryConds: s.rules?.entryConds ?? [] },
        }));
      }
    } catch {}
  }
  return [];
};

const loadAccounts = (username: string): ChallengeAccount[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`nexyru_challenge_${username}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getUsername = (): string => {
  if (typeof window === "undefined") return "guest";
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return "guest";
    const s = JSON.parse(raw);
    return s.username || "guest";
  } catch {
    return "guest";
  }
};

const newId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

const defaultName = (type: AlertType): string => {
  switch (type) {
    case "daily_loss":      return "Daily Loss Warning";
    case "session_start":   return "Session Start";
    case "price_level":     return "Price Level Alert";
    case "max_trades":      return "Max Trades";
    case "profit_target":   return "Profit Target";
    case "strategy_signal": return "Strategy Signal";
    case "position_size":   return "Position Size Reminder";
  }
};

const defaultMessage = (type: AlertType, c: AlertConfig): string => {
  switch (type) {
    case "daily_loss":
      return `You've used ${c.lossPct ?? 80}% of your daily loss limit. Consider stopping for the day.`;
    case "session_start":
      return "Time to trade. Check your levels, confirm your setup, stick to the plan.";
    case "price_level":
      return `${c.symbol ?? "NQ"} hit your level at ${c.price ?? 0}.`;
    case "max_trades":
      return `You've hit your trade limit (${c.trades ?? 3} per ${c.period ?? "day"}). Step away.`;
    case "profit_target":
      return `You're ${c.targetPct ?? 80}% of the way to your profit target. Stay disciplined.`;
    case "strategy_signal":
      return `Your ${c.strategyName ?? "strategy"} setup may be forming. Check your entry conditions.`;
    case "position_size":
      return "Confirm your position size before entering.";
  }
};

const summarize = (a: Alert, accounts: ChallengeAccount[]): string => {
  const c = a.config;
  const acct = accounts.find(x => x.id === c.accountId);
  switch (a.type) {
    case "daily_loss": {
      const dl = acct?.dailyLoss ?? 0;
      const dollars = dl > 0 ? ` · $${Math.round(dl * (c.lossPct ?? 80) / 100).toLocaleString()}` : "";
      return `Triggers at ${c.lossPct ?? 80}% of daily loss${dollars}`;
    }
    case "session_start": {
      const days = (c.days ?? ["mon","tue","wed","thu","fri"]).map(d => d[0].toUpperCase()).join("");
      return `${c.time ?? "09:30"} ${c.timezone ?? "ET"} · ${days}`;
    }
    case "price_level": {
      const verb = c.condition === "above" ? "breaks above"
                 : c.condition === "below" ? "breaks below"
                 : c.condition === "touches" ? "touches"
                 : "reaches";
      return `${c.symbol ?? "NQ"} ${verb} ${c.price ?? 0}`;
    }
    case "max_trades":
      return `${c.trades ?? 3} trades per ${c.period ?? "day"}${c.hardStop ? " · hard stop" : ""}`;
    case "profit_target":
      return `Triggers at ${c.targetPct ?? 80}% of profit target`;
    case "strategy_signal":
      return `${c.strategyName ?? "Strategy"} · ${c.timeframe ?? "5m"}${c.cooldown ? ` · ${c.cooldown}m cooldown` : ""}`;
    case "position_size":
      return `Risk ${c.riskPct ?? 1}% of $${(c.accountSize ?? 50000).toLocaleString()}`;
  }
};

const relativeTime = (ts: number | null): string => {
  if (!ts) return "Never";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

// ── Page ──────────────────────────────────────────────────────────
export default function AlertsPage() {
  const [loaded, setLoaded] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [strategies, setStrategies] = useState<SavedStrategy[]>([]);
  const [accounts, setAccounts] = useState<ChallengeAccount[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  // Modal / draft state
  const [showPicker, setShowPicker] = useState(false);
  const [editingType, setEditingType] = useState<AlertType | null>(null);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [draftConfig, setDraftConfig] = useState<AlertConfig>({});
  const [draftName, setDraftName] = useState("");

  // Inline editing
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [nameBuffer, setNameBuffer] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setAlerts(JSON.parse(raw));
    } catch {}
    const u = getUsername();
    setStrategies(loadStrategies(u));
    setAccounts(loadAccounts(u));
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    } else {
      setPermission("unsupported");
    }
    setLoaded(true);
  }, []);

  // Persist
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts)); } catch {}
  }, [alerts, loaded]);

  const requestPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  // Sensible defaults per type
  const buildDefaults = (type: AlertType): AlertConfig => {
    const firstStrat = strategies[0];
    const firstAcct = accounts[0];
    const baseCommon: AlertConfig = {
      notifyBrowser: true,
      notifySound: false,
      accountId: firstAcct?.id,
    };
    switch (type) {
      case "daily_loss":
        return { ...baseCommon, lossPct: 80, lossPct2Enabled: false, lossPct2: 50, lossRepeat: "daily" };
      case "session_start":
        return { ...baseCommon, time: "09:30", timezone: "ET", days: ["mon","tue","wed","thu","fri"], earlyWarning: 0, showChecklist: false };
      case "price_level":
        return { ...baseCommon, symbol: "NQ", condition: "reaches", price: 0, bias: "watch", expiresEnabled: false, expiresDays: 7, repeatMode: "once" };
      case "max_trades":
        return { ...baseCommon, trades: 3, warnAt: 1, period: "day", hardStop: false };
      case "profit_target":
        return { ...baseCommon, targetPct: 80, checkpoints: [50, 75, 100], celebration: true };
      case "strategy_signal":
        return firstStrat
          ? { ...baseCommon, strategyId: firstStrat.id, strategyName: firstStrat.name, timeframe: "5m", symbolMode: "default", entryConds: firstStrat.rules?.entryConds ?? [], instruments: [], cooldown: 15, sessionOnly: true }
          : { ...baseCommon, timeframe: "5m", symbolMode: "default", entryConds: [], instruments: [], cooldown: 15, sessionOnly: true };
      case "position_size":
        return { ...baseCommon, accountSize: firstAcct?.accountSize ?? 50000, riskPct: 1, stopPts: 10, symbol: "NQ", pointValue: POINT_VALUES.NQ, showBefore: "every_trade", displayAs: "floating", showMaxTrades: true };
    }
  };

  const startCreate = (type: AlertType) => {
    setEditingType(type);
    setEditingAlertId(null);
    setDraftConfig(buildDefaults(type));
    setDraftName(defaultName(type));
    setShowPicker(false);
  };

  const startEdit = (a: Alert) => {
    setEditingType(a.type);
    setEditingAlertId(a.id);
    setDraftConfig({ ...buildDefaults(a.type), ...a.config });
    setDraftName(a.name);
    setShowPicker(false);
  };

  const closeModal = () => {
    setEditingType(null);
    setEditingAlertId(null);
    setDraftConfig({});
    setDraftName("");
  };

  const saveDraft = () => {
    if (!editingType) return;
    const name = draftName.trim() || defaultName(editingType);
    const cfg = { ...draftConfig, message: draftConfig.message ?? defaultMessage(editingType, draftConfig) };
    if (editingAlertId) {
      setAlerts(prev => prev.map(a =>
        a.id === editingAlertId ? { ...a, name, config: cfg, type: editingType } : a
      ));
    } else {
      const newAlert: Alert = {
        id: newId(),
        type: editingType,
        name,
        enabled: true,
        config: cfg,
        lastTriggered: null,
        triggerCount: 0,
        todayCount: 0,
      };
      setAlerts(prev => [newAlert, ...prev]);
    }
    closeModal();
  };

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const deleteAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    setConfirmDelete(null);
  };

  const startNameEdit = (a: Alert) => {
    setEditingNameId(a.id);
    setNameBuffer(a.name);
  };

  const commitNameEdit = () => {
    if (editingNameId && nameBuffer.trim()) {
      setAlerts(prev => prev.map(a =>
        a.id === editingNameId ? { ...a, name: nameBuffer.trim() } : a
      ));
    }
    setEditingNameId(null);
    setNameBuffer("");
  };

  // ── Styles ──────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: "#111111",
    border: "1px solid #1e1e1e",
    borderRadius: 14,
    padding: 20,
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
    padding: "11px 13px",
    borderRadius: 8,
    border: "1px solid #1e1e1e",
    background: "#080808",
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontWeight: 500,
    outline: "none",
    boxSizing: "border-box",
  };

  const primaryBtn: React.CSSProperties = {
    padding: "10px 16px",
    borderRadius: 9,
    border: "none",
    background: "var(--accent, #6366f1)",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    letterSpacing: "0.01em",
  };

  const ghostBtn: React.CSSProperties = {
    padding: "10px 16px",
    borderRadius: 9,
    border: "1px solid #1e1e1e",
    background: "#080808",
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#080808" }}>
      <Sidebar activePath="/alerts" />
      <MobileNav activePath="/alerts" />
      <main style={{ flex: 1, marginLeft: 56 }}>
        <div style={{ minHeight: "100vh", background: "#080808", color: "#ffffff", fontFamily: "system-ui, -apple-system, sans-serif" }}>

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
            <span style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>Alerts</span>
          </div>

          <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 80px" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: "#ffffff", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
                  Alerts
                </h1>
                <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
                  Get notified when your trading conditions are met
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                style={{ ...primaryBtn, whiteSpace: "nowrap" }}
              >
                + New Alert
              </button>
            </div>

            {/* Notification permission banner */}
            {permission !== "granted" && permission !== "unsupported" && (
              <div style={{
                ...card,
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                borderLeft: "3px solid var(--accent, #6366f1)",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#ffffff", marginBottom: 2 }}>
                    Browser notifications are off
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Enable notifications so we can ping you when an alert triggers.
                  </div>
                </div>
                <button type="button" onClick={requestPermission} style={primaryBtn}>
                  Enable Notifications
                </button>
              </div>
            )}
            {permission === "unsupported" && (
              <div style={{ ...card, marginBottom: 20, fontSize: 12, color: "#9ca3af" }}>
                Browser notifications are not supported in this environment.
              </div>
            )}

            {/* Alert list */}
            {alerts.length === 0 ? (
              <div style={{
                ...card,
                padding: 40,
                textAlign: "center",
                color: "#6b7280",
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af", marginBottom: 4 }}>
                  No alerts yet
                </div>
                <div style={{ fontSize: 13 }}>
                  Click <span style={{ color: "#ffffff" }}>+ New Alert</span> to create your first one.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {alerts.map(a => {
                  const meta = ALERT_TYPES.find(t => t.key === a.type)!;
                  const confirming = confirmDelete === a.id;
                  const editingName = editingNameId === a.id;
                  const summary = summarize(a, accounts);
                  const fired = a.triggerCount ?? 0;
                  const firedToday = a.todayCount ?? 0;
                  return (
                    <div key={a.id} style={{
                      ...card,
                      padding: "16px 18px",
                      opacity: a.enabled ? 1 : 0.65,
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                        {/* Icon */}
                        <div style={{
                          width: 40, height: 40, flexShrink: 0,
                          borderRadius: 9,
                          background: meta.bg,
                          color: meta.color,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          marginTop: 2,
                        }}>
                          {meta.icon}
                        </div>

                        {/* Main */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                            {/* Type badge */}
                            <span style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "3px 7px",
                              borderRadius: 5,
                              background: meta.bg,
                              color: meta.color,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                            }}>
                              {meta.label}
                            </span>
                            {!a.enabled && (
                              <span style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "3px 7px",
                                borderRadius: 5,
                                background: "#1e1e1e",
                                color: "#6b7280",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                              }}>
                                Off
                              </span>
                            )}
                          </div>

                          {/* Editable name */}
                          {editingName ? (
                            <input
                              autoFocus
                              type="text"
                              value={nameBuffer}
                              onChange={e => setNameBuffer(e.target.value)}
                              onBlur={commitNameEdit}
                              onKeyDown={e => {
                                if (e.key === "Enter") commitNameEdit();
                                if (e.key === "Escape") { setEditingNameId(null); setNameBuffer(""); }
                              }}
                              style={{
                                ...input,
                                padding: "5px 8px",
                                fontSize: 15,
                                fontWeight: 600,
                                fontFamily: "system-ui, sans-serif",
                                marginBottom: 4,
                              }}
                            />
                          ) : (
                            <div
                              onClick={() => startNameEdit(a)}
                              title="Click to rename"
                              style={{
                                fontSize: 15,
                                fontWeight: 600,
                                color: "#ffffff",
                                marginBottom: 4,
                                cursor: "text",
                                padding: "2px 0",
                              }}
                            >
                              {a.name}
                            </div>
                          )}

                          {/* Summary */}
                          <div style={{ fontSize: 12, color: "#9ca3af", fontFamily: "ui-monospace, monospace", marginBottom: 6 }}>
                            {summary}
                          </div>

                          {/* Metadata */}
                          <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#6b7280", flexWrap: "wrap" }}>
                            <span>Last fired: {relativeTime(a.lastTriggered)}</span>
                            <span>·</span>
                            <span>
                              {fired === 0
                                ? "Never fired"
                                : firedToday > 0
                                  ? `Fired ${firedToday}× today`
                                  : `Fired ${fired}× total`}
                            </span>
                          </div>
                        </div>

                        {/* Right controls */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          {/* Toggle */}
                          <button
                            type="button"
                            onClick={() => toggleAlert(a.id)}
                            aria-label={a.enabled ? "Disable alert" : "Enable alert"}
                            style={{
                              width: 40, height: 22,
                              borderRadius: 999,
                              border: "none",
                              background: a.enabled ? "var(--accent, #6366f1)" : "#1e1e1e",
                              position: "relative",
                              cursor: "pointer",
                              transition: "background 0.15s",
                            }}
                          >
                            <span style={{
                              position: "absolute",
                              top: 3, left: a.enabled ? 21 : 3,
                              width: 16, height: 16,
                              borderRadius: "50%",
                              background: "#ffffff",
                              transition: "left 0.15s",
                            }} />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => startEdit(a)}
                            aria-label="Edit alert"
                            style={{
                              width: 32, height: 32,
                              borderRadius: 8,
                              border: "1px solid #1e1e1e",
                              background: "#080808",
                              color: "#9ca3af",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                          </button>

                          {/* Delete */}
                          {confirming ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => deleteAlert(a.id)}
                                style={{ ...ghostBtn, padding: "7px 12px", fontSize: 12, color: "#ef4444", borderColor: "#3a1414", background: "rgba(239,68,68,0.06)" }}
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(null)}
                                style={{ ...ghostBtn, padding: "7px 12px", fontSize: 12 }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(a.id)}
                              aria-label="Delete alert"
                              style={{
                                width: 32, height: 32,
                                borderRadius: 8,
                                border: "1px solid #1e1e1e",
                                background: "#080808",
                                color: "#6b7280",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1.5 14a2 2 0 0 1-2 1.8h-7a2 2 0 0 1-2-1.8L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Type picker modal ─────────────────────────────────── */}
          {showPicker && (
            <Modal onClose={() => setShowPicker(false)} title="Choose an alert type">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {ALERT_TYPES.map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => startCreate(t.key)}
                    style={{
                      textAlign: "left",
                      padding: 16,
                      borderRadius: 11,
                      border: "1px solid #1e1e1e",
                      background: "#0d0d10",
                      color: "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = t.color; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e1e1e"; }}
                  >
                    <div style={{
                      width: 36, height: 36,
                      borderRadius: 9,
                      background: t.bg,
                      color: t.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {t.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", marginBottom: 4 }}>{t.label}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.4 }}>{t.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Modal>
          )}

          {/* ── Config modal ──────────────────────────────────────── */}
          {editingType && (
            <Modal
              onClose={closeModal}
              title={`${editingAlertId ? "Edit" : "Configure"} ${ALERT_TYPES.find(t => t.key === editingType)!.label}`}
              wide
            >
              <AlertConfigFields
                type={editingType}
                config={draftConfig}
                onChange={setDraftConfig}
                name={draftName}
                onNameChange={setDraftName}
                strategies={strategies}
                accounts={accounts}
                label={label}
                input={input}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end", paddingTop: 16, borderTop: "1px solid #1e1e1e" }}>
                <button type="button" onClick={closeModal} style={ghostBtn}>
                  Cancel
                </button>
                <button type="button" onClick={saveDraft} style={primaryBtn}>
                  {editingAlertId ? "Save changes" : "Create alert"}
                </button>
              </div>
            </Modal>
          )}

          <style>{`
            input[type="number"]::-webkit-outer-spin-button,
            input[type="number"]::-webkit-inner-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }
            input[type="number"] { -moz-appearance: textfield; }
            input:focus, select:focus, textarea:focus { border-color: var(--accent, #6366f1) !important; }
            input[type="range"] {
              -webkit-appearance: none;
              appearance: none;
              height: 4px;
              background: #1e1e1e;
              border-radius: 999px;
              outline: none;
            }
            input[type="range"]::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 16px;
              height: 16px;
              border-radius: 50%;
              background: var(--accent, #6366f1);
              cursor: pointer;
              border: 2px solid #ffffff;
            }
            input[type="range"]::-moz-range-thumb {
              width: 14px;
              height: 14px;
              border-radius: 50%;
              background: var(--accent, #6366f1);
              cursor: pointer;
              border: 2px solid #ffffff;
            }
            @media (max-width: 640px) {
              .alert-grid { grid-template-columns: 1fr !important; }
            }
          `}</style>
        </div>
      </main>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────
function Modal({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: wide ? 540 : 520,
          background: "#111111",
          border: "1px solid #1e1e1e",
          borderRadius: 16,
          padding: 24,
          color: "#ffffff",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 30, height: 30,
              borderRadius: 7,
              border: "1px solid #1e1e1e",
              background: "#080808",
              color: "#9ca3af",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Reusable bits ─────────────────────────────────────────────────
function Section({ title, children, first }: { title: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div style={{
      padding: first ? "0 0 18px" : "18px 0",
      borderTop: first ? "none" : "1px solid #1e1e1e",
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        marginBottom: 14,
      }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, on, onChange }: { label: string; desc?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: "#ffffff", fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{desc}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!on)}
        style={{
          width: 36, height: 20,
          borderRadius: 999,
          border: "none",
          background: on ? "var(--accent, #6366f1)" : "#1e1e1e",
          position: "relative",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <span style={{
          position: "absolute",
          top: 2, left: on ? 18 : 2,
          width: 16, height: 16,
          borderRadius: "50%",
          background: "#ffffff",
          transition: "left 0.15s",
        }} />
      </button>
    </div>
  );
}

function PresetPills({ values, current, onPick, suffix }: { values: number[]; current: number; onPick: (v: number) => void; suffix?: string }) {
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
      {values.map(v => {
        const active = v === current;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onPick(v)}
            style={{
              padding: "5px 10px",
              borderRadius: 6,
              border: active ? "1px solid var(--accent, #6366f1)" : "1px solid #1e1e1e",
              background: active ? "rgba(99,102,241,0.12)" : "#080808",
              color: active ? "var(--accent, #6366f1)" : "#9ca3af",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {v}{suffix}
          </button>
        );
      })}
    </div>
  );
}

// ── Per-type config fields ────────────────────────────────────────
function AlertConfigFields({
  type, config, onChange, name, onNameChange, strategies, accounts, label, input,
}: {
  type: AlertType;
  config: AlertConfig;
  onChange: (c: AlertConfig) => void;
  name: string;
  onNameChange: (n: string) => void;
  strategies: SavedStrategy[];
  accounts: ChallengeAccount[];
  label: React.CSSProperties;
  input: React.CSSProperties;
}) {
  const set = (patch: Partial<AlertConfig>) => onChange({ ...config, ...patch });
  const selectedAccount = accounts.find(a => a.id === config.accountId);

  const nameSection = (
    <Section title="Alert" first>
      <div>
        <label style={label}>Alert name</label>
        <input
          type="text"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          style={{ ...input, fontFamily: "system-ui, sans-serif" }}
        />
      </div>
    </Section>
  );

  const notifySection = (
    <Section title="Notification">
      <ToggleRow
        label="Browser notification"
        desc="Show a system popup when this fires"
        on={config.notifyBrowser !== false}
        onChange={v => set({ notifyBrowser: v })}
      />
      <ToggleRow
        label="Sound"
        desc="Play a chime when this fires"
        on={!!config.notifySound}
        onChange={v => set({ notifySound: v })}
      />
      <div>
        <label style={label}>Message</label>
        <textarea
          value={config.message ?? defaultMessage(type, config)}
          onChange={e => set({ message: e.target.value })}
          rows={2}
          style={{ ...input, fontFamily: "system-ui, sans-serif", resize: "vertical", fontSize: 13, lineHeight: 1.5 }}
        />
      </div>
    </Section>
  );

  const accountSelect = accounts.length > 0 && (
    <div>
      <label style={label}>Linked account</label>
      <select
        value={config.accountId ?? ""}
        onChange={e => set({ accountId: e.target.value || undefined })}
        style={{ ...input, appearance: "none", WebkitAppearance: "none", cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
      >
        <option value="">No account linked</option>
        {accounts.map(a => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
    </div>
  );

  // ── DAILY LOSS ─────────────────────────────────────────────────
  if (type === "daily_loss") {
    const pct = config.lossPct ?? 80;
    const pct2 = config.lossPct2 ?? 50;
    const dailyLimit = selectedAccount?.dailyLoss ?? 0;
    const dollarAt = dailyLimit > 0 ? Math.round(dailyLimit * pct / 100) : 0;

    return (
      <div>
        {nameSection}

        <Section title="Trigger">
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <label style={{ ...label, marginBottom: 0 }}>Trigger at</label>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", fontFamily: "ui-monospace, monospace" }}>
                {pct}%
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={pct}
              onChange={e => set({ lossPct: parseInt(e.target.value) })}
              style={{ width: "100%" }}
            />
            <PresetPills values={[50, 70, 80, 90]} current={pct} onPick={v => set({ lossPct: v })} suffix="%" />
            {dailyLimit > 0 && (
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 10, fontFamily: "ui-monospace, monospace" }}>
                = ${dollarAt.toLocaleString()} of ${dailyLimit.toLocaleString()} daily limit
              </div>
            )}
          </div>

          <ToggleRow
            label={`Add a second warning at ${pct2}%`}
            desc="Get pinged earlier in the day too"
            on={!!config.lossPct2Enabled}
            onChange={v => set({ lossPct2Enabled: v })}
          />
          {config.lossPct2Enabled && (
            <div>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={pct2}
                onChange={e => set({ lossPct2: parseInt(e.target.value) })}
                style={{ width: "100%" }}
              />
              <PresetPills values={[30, 40, 50, 60]} current={pct2} onPick={v => set({ lossPct2: v })} suffix="%" />
            </div>
          )}
        </Section>

        {notifySection}

        <Section title="Behavior">
          <div>
            <label style={label}>Repeat</label>
            <select
              value={config.lossRepeat ?? "daily"}
              onChange={e => set({ lossRepeat: e.target.value as "daily" | "every" })}
              style={{ ...input, appearance: "none", WebkitAppearance: "none", cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
            >
              <option value="daily">Once per day</option>
              <option value="every">Every time I log a losing trade</option>
            </select>
          </div>
          {accountSelect}
        </Section>
      </div>
    );
  }

  // ── SESSION START ──────────────────────────────────────────────
  if (type === "session_start") {
    const days = config.days ?? ["mon","tue","wed","thu","fri"];
    const toggleDay = (d: WeekDay) => {
      const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d];
      set({ days: next });
    };

    return (
      <div>
        {nameSection}

        <Section title="Schedule">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={label}>Session time</label>
              <input
                type="time"
                value={config.time ?? "09:30"}
                onChange={e => set({ time: e.target.value })}
                style={input}
              />
            </div>
            <div>
              <label style={label}>Timezone</label>
              <select
                value={config.timezone ?? "ET"}
                onChange={e => set({ timezone: e.target.value })}
                style={{ ...input, appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}
              >
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={label}>Days of week</label>
            <div style={{ display: "flex", gap: 6 }}>
              {WEEKDAYS.map(d => {
                const active = days.includes(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleDay(d.key)}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: 7,
                      border: active ? "1px solid var(--accent, #6366f1)" : "1px solid #1e1e1e",
                      background: active ? "rgba(99,102,241,0.12)" : "#080808",
                      color: active ? "var(--accent, #6366f1)" : "#9ca3af",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={label}>Early warning</label>
            <select
              value={String(config.earlyWarning ?? 0)}
              onChange={e => set({ earlyWarning: parseInt(e.target.value) })}
              style={{ ...input, appearance: "none", WebkitAppearance: "none", cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
            >
              <option value="0">No early warning</option>
              <option value="5">5 minutes before</option>
              <option value="10">10 minutes before</option>
              <option value="15">15 minutes before</option>
              <option value="30">30 minutes before</option>
            </select>
          </div>
        </Section>

        {notifySection}

        <Section title="Behavior">
          <ToggleRow
            label="Open my pre-trade checklist"
            desc="Pop the checklist when the session starts"
            on={!!config.showChecklist}
            onChange={v => set({ showChecklist: v })}
          />
        </Section>
      </div>
    );
  }

  // ── PRICE LEVEL ────────────────────────────────────────────────
  if (type === "price_level") {
    return (
      <div>
        {nameSection}

        <Section title="Trigger">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={label}>Symbol</label>
              <input
                type="text"
                value={config.symbol ?? ""}
                onChange={e => set({ symbol: e.target.value.toUpperCase() })}
                placeholder="ES1!, NQ1!, SOL/USD…"
                style={input}
              />
            </div>
            <div>
              <label style={label}>Price</label>
              <input
                type="number"
                step="any"
                value={config.price ?? ""}
                onChange={e => set({ price: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                style={input}
              />
            </div>
          </div>

          <div>
            <label style={label}>Condition</label>
            <select
              value={config.condition ?? "reaches"}
              onChange={e => set({ condition: e.target.value as AlertConfig["condition"] })}
              style={{ ...input, appearance: "none", WebkitAppearance: "none", cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
            >
              <option value="reaches">Price reaches</option>
              <option value="above">Price breaks above</option>
              <option value="below">Price breaks below</option>
              <option value="touches">Price touches</option>
            </select>
          </div>

          <div>
            <label style={label}>Direction context</label>
            <div style={{ display: "flex", gap: 6 }}>
              {([
                { v: "long",  l: "Looking LONG" },
                { v: "short", l: "Looking SHORT" },
                { v: "watch", l: "Just watching" },
              ] as const).map(o => {
                const active = (config.bias ?? "watch") === o.v;
                return (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => set({ bias: o.v })}
                    style={{
                      flex: 1,
                      padding: "9px 0",
                      borderRadius: 7,
                      border: active ? "1px solid var(--accent, #6366f1)" : "1px solid #1e1e1e",
                      background: active ? "rgba(99,102,241,0.12)" : "#080808",
                      color: active ? "var(--accent, #6366f1)" : "#9ca3af",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {o.l}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={label}>Why is this level important?</label>
            <textarea
              value={config.note ?? ""}
              onChange={e => set({ note: e.target.value })}
              rows={2}
              placeholder="e.g. Previous day high, key resistance"
              style={{ ...input, fontFamily: "system-ui, sans-serif", resize: "vertical", fontSize: 13, lineHeight: 1.5 }}
            />
          </div>
        </Section>

        {notifySection}

        <Section title="Behavior">
          <ToggleRow
            label={`Expire after ${config.expiresDays ?? 7} days`}
            on={!!config.expiresEnabled}
            onChange={v => set({ expiresEnabled: v })}
          />
          {config.expiresEnabled && (
            <div>
              <input
                type="number"
                min={1}
                max={365}
                value={config.expiresDays ?? 7}
                onChange={e => set({ expiresDays: Math.max(1, Math.min(365, parseInt(e.target.value) || 1)) })}
                style={input}
              />
            </div>
          )}
          <div>
            <label style={label}>Repeat</label>
            <div style={{ display: "flex", gap: 6 }}>
              {([
                { v: "once",   l: "One-time alert" },
                { v: "repeat", l: "Repeat every cross" },
              ] as const).map(o => {
                const active = (config.repeatMode ?? "once") === o.v;
                return (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => set({ repeatMode: o.v })}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: 7,
                      border: active ? "1px solid var(--accent, #6366f1)" : "1px solid #1e1e1e",
                      background: active ? "rgba(99,102,241,0.12)" : "#080808",
                      color: active ? "var(--accent, #6366f1)" : "#9ca3af",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {o.l}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>
      </div>
    );
  }

  // ── MAX TRADES ─────────────────────────────────────────────────
  if (type === "max_trades") {
    const trades = config.trades ?? 3;
    return (
      <div>
        {nameSection}

        <Section title="Trigger">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={label}>Max trades</label>
              <input
                type="number"
                min={1}
                max={50}
                value={trades}
                onChange={e => set({ trades: Math.max(1, Math.min(50, parseInt(e.target.value) || 1)) })}
                style={input}
              />
            </div>
            <div>
              <label style={label}>Per</label>
              <select
                value={config.period ?? "day"}
                onChange={e => set({ period: e.target.value as "day" | "session" | "week" })}
                style={{ ...input, appearance: "none", WebkitAppearance: "none", cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
              >
                <option value="day">Per day</option>
                <option value="session">Per session</option>
                <option value="week">Per week</option>
              </select>
            </div>
          </div>

          <div>
            <label style={label}>Early warning</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2].map(n => {
                const active = (config.warnAt ?? 1) === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set({ warnAt: n })}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: 7,
                      border: active ? "1px solid var(--accent, #6366f1)" : "1px solid #1e1e1e",
                      background: active ? "rgba(99,102,241,0.12)" : "#080808",
                      color: active ? "var(--accent, #6366f1)" : "#9ca3af",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Warn at {n} trade{n === 1 ? "" : "s"} left
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        {notifySection}

        <Section title="Behavior">
          <ToggleRow
            label="Hard stop"
            desc="Lock the journal with a banner once the limit is reached"
            on={!!config.hardStop}
            onChange={v => set({ hardStop: v })}
          />
          {accountSelect}
        </Section>
      </div>
    );
  }

  // ── PROFIT TARGET ──────────────────────────────────────────────
  if (type === "profit_target") {
    const target = config.targetPct ?? 80;
    const checkpoints = config.checkpoints ?? [50, 75, 100];
    const toggleCheckpoint = (v: number) => {
      const next = checkpoints.includes(v)
        ? checkpoints.filter(x => x !== v)
        : [...checkpoints, v].sort((a, b) => a - b);
      set({ checkpoints: next });
    };

    return (
      <div>
        {nameSection}

        <Section title="Trigger">
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <label style={{ ...label, marginBottom: 0 }}>Primary trigger at</label>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", fontFamily: "ui-monospace, monospace" }}>
                {target}%
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={100}
              step={5}
              value={target}
              onChange={e => set({ targetPct: parseInt(e.target.value) })}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={label}>Also notify at</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[25, 50, 75, 90, 100].map(v => {
                const active = checkpoints.includes(v);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => toggleCheckpoint(v)}
                    style={{
                      flex: "1 1 0",
                      padding: "10px 0",
                      borderRadius: 7,
                      border: active ? "1px solid var(--accent, #6366f1)" : "1px solid #1e1e1e",
                      background: active ? "rgba(99,102,241,0.12)" : "#080808",
                      color: active ? "var(--accent, #6366f1)" : "#9ca3af",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "ui-monospace, monospace",
                    }}
                  >
                    {v}%
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        {notifySection}

        <Section title="Behavior">
          <ToggleRow
            label="Celebration at 100%"
            desc="Show a confetti animation when you hit the target"
            on={config.celebration !== false}
            onChange={v => set({ celebration: v })}
          />
          {accountSelect}
        </Section>
      </div>
    );
  }

  // ── STRATEGY SIGNAL ────────────────────────────────────────────
  if (type === "strategy_signal") {
    const selected = strategies.find(s => s.id === config.strategyId);
    const entryConds = config.entryConds ?? selected?.rules?.entryConds ?? [];
    const instruments = config.instruments ?? [];

    if (!strategies.length) {
      return (
        <div>
          {nameSection}
          <div style={{
            padding: 20,
            borderRadius: 10,
            border: "1px dashed #2a2a3a",
            background: "#0d0d10",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#9ca3af", marginBottom: 6 }}>
              No saved strategies
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              Build a strategy in the <a href="/dashboard?tab=stratlab" style={{ color: "var(--accent, #6366f1)", textDecoration: "none" }}>Strategy Lab</a> first, then come back here.
            </div>
          </div>
        </div>
      );
    }

    const toggleInstrument = (s: string) => {
      const next = instruments.includes(s) ? instruments.filter(x => x !== s) : [...instruments, s];
      set({ instruments: next });
    };

    return (
      <div>
        {nameSection}

        <Section title="Strategy">
          <div>
            <label style={label}>Strategy</label>
            <select
              value={config.strategyId ?? ""}
              onChange={e => {
                const s = strategies.find(x => x.id === e.target.value);
                if (!s) return;
                set({
                  strategyId: s.id,
                  strategyName: s.name,
                  entryConds: s.rules?.entryConds ?? [],
                });
              }}
              style={{ ...input, appearance: "none", WebkitAppearance: "none", cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
            >
              {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label style={label}>Timeframe</label>
            <div style={{ display: "flex", gap: 6 }}>
              {TIMEFRAMES.map(tf => {
                const active = (config.timeframe ?? "5m") === tf;
                return (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => set({ timeframe: tf })}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: 7,
                      border: active ? "1px solid var(--accent, #6366f1)" : "1px solid #1e1e1e",
                      background: active ? "rgba(99,102,241,0.12)" : "#080808",
                      color: active ? "var(--accent, #6366f1)" : "#9ca3af",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {tf}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={label}>Instruments to watch</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SYMBOLS.map(s => {
                const active = instruments.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleInstrument(s)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 999,
                      border: active ? "1px solid var(--accent, #6366f1)" : "1px solid #1e1e1e",
                      background: active ? "rgba(99,102,241,0.12)" : "#080808",
                      color: active ? "var(--accent, #6366f1)" : "#9ca3af",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "ui-monospace, monospace",
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
              Leave empty to use the strategy default.
            </div>
          </div>

          <div>
            <label style={label}>Checklist before entry</label>
            <div style={{
              border: "1px solid #1e1e1e",
              borderRadius: 9,
              background: "#080808",
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              maxHeight: 180,
              overflowY: "auto",
            }}>
              {entryConds.length === 0 ? (
                <div style={{ fontSize: 12, color: "#6b7280" }}>This strategy has no entry conditions.</div>
              ) : entryConds.map((c, i) => (
                <div key={`${c.id}_${i}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{
                    width: 16, height: 16,
                    borderRadius: 4,
                    border: "1px solid #2a2a3a",
                    background: "rgba(99,102,241,0.10)",
                    color: "var(--accent, #6366f1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <span style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.4 }}>{condLine(c)}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {notifySection}

        <Section title="Behavior">
          <div>
            <label style={label}>Cooldown after firing</label>
            <select
              value={String(config.cooldown ?? 15)}
              onChange={e => set({ cooldown: parseInt(e.target.value) })}
              style={{ ...input, appearance: "none", WebkitAppearance: "none", cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
            >
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </div>
          <ToggleRow
            label="Only during my trading session"
            desc="Suppress this alert outside your configured session hours"
            on={config.sessionOnly !== false}
            onChange={v => set({ sessionOnly: v })}
          />
        </Section>
      </div>
    );
  }

  // ── POSITION SIZE ──────────────────────────────────────────────
  if (type === "position_size") {
    const account = config.accountSize ?? 50000;
    const risk = config.riskPct ?? 1;
    const stop = config.stopPts ?? 10;
    const sym = config.symbol ?? "NQ";
    const pv = POINT_VALUES[sym] ?? config.pointValue ?? 20;
    const maxRisk = account * (risk / 100);
    const contracts = stop > 0 && pv > 0 ? Math.max(0, Math.floor(maxRisk / (stop * pv))) : 0;

    return (
      <div>
        {nameSection}

        <Section title="Sizing">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={label}>Account size ($)</label>
              <input
                type="number"
                min={0}
                step={500}
                value={account}
                onChange={e => set({ accountSize: Math.max(0, parseFloat(e.target.value) || 0) })}
                style={input}
              />
            </div>
            <div>
              <label style={label}>Default instrument</label>
              <select
                value={sym}
                onChange={e => set({ symbol: e.target.value, pointValue: POINT_VALUES[e.target.value] ?? 1 })}
                style={{ ...input, appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}
              >
                {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <label style={{ ...label, marginBottom: 0 }}>Risk per trade</label>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", fontFamily: "ui-monospace, monospace" }}>
                {risk.toFixed(2)}%
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={5}
              step={0.1}
              value={risk}
              onChange={e => set({ riskPct: parseFloat(e.target.value) })}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={label}>Default stop (pts)</label>
            <input
              type="number"
              min={0.25}
              step={0.25}
              value={stop}
              onChange={e => set({ stopPts: Math.max(0.25, parseFloat(e.target.value) || 0.25) })}
              style={input}
            />
          </div>

          <div style={{
            padding: 14,
            borderRadius: 10,
            border: "1px solid rgba(99,102,241,0.25)",
            background: "rgba(99,102,241,0.06)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Max risk</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", fontFamily: "ui-monospace, monospace" }}>
                ${maxRisk.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Contracts</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent, #6366f1)", fontFamily: "ui-monospace, monospace" }}>
                {contracts}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Display">
          <div>
            <label style={label}>Show before</label>
            <div style={{ display: "flex", gap: 6 }}>
              {([
                { v: "every_trade", l: "Every trade I log" },
                { v: "manual",      l: "Only when I open the calculator" },
              ] as const).map(o => {
                const active = (config.showBefore ?? "every_trade") === o.v;
                return (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => set({ showBefore: o.v })}
                    style={{
                      flex: 1,
                      padding: "10px 8px",
                      borderRadius: 7,
                      border: active ? "1px solid var(--accent, #6366f1)" : "1px solid #1e1e1e",
                      background: active ? "rgba(99,102,241,0.12)" : "#080808",
                      color: active ? "var(--accent, #6366f1)" : "#9ca3af",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {o.l}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={label}>Display as</label>
            <div style={{ display: "flex", gap: 6 }}>
              {([
                { v: "floating", l: "Floating widget" },
                { v: "banner",   l: "Banner in journal" },
              ] as const).map(o => {
                const active = (config.displayAs ?? "floating") === o.v;
                return (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => set({ displayAs: o.v })}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: 7,
                      border: active ? "1px solid var(--accent, #6366f1)" : "1px solid #1e1e1e",
                      background: active ? "rgba(99,102,241,0.12)" : "#080808",
                      color: active ? "var(--accent, #6366f1)" : "#9ca3af",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {o.l}
                  </button>
                );
              })}
            </div>
          </div>

          <ToggleRow
            label="Show max trades remaining"
            desc="Also display how many trades you have left for the period"
            on={config.showMaxTrades !== false}
            onChange={v => set({ showMaxTrades: v })}
          />
        </Section>
      </div>
    );
  }

  return null;
}
