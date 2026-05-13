"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";

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

interface AlertConfig {
  lossPct?: number;
  time?: string;
  timezone?: string;
  symbol?: string;
  price?: number;
  direction?: "above" | "below";
  trades?: number;
  targetPct?: number;
  // strategy_signal
  strategyId?: string;
  strategyName?: string;
  timeframe?: StratTimeframe;
  symbolMode?: "default" | "custom";
  customSymbol?: string;
  entryConds?: StratCond[];
  // position_size
  accountSize?: number;
  riskPct?: number;
  stopPts?: number;
  pointValue?: number;
}

interface Alert {
  id: string;
  type: AlertType;
  name: string;
  enabled: boolean;
  config: AlertConfig;
  lastTriggered: number | null;
}

interface AlertTypeMeta {
  key: AlertType;
  label: string;
  description: string;
  icon: React.ReactNode;
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

// Humanize a condition id like "price_above_ema" → "Price above EMA"
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

// ── Helpers ───────────────────────────────────────────────────────
const newId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

const buildName = (type: AlertType, c: AlertConfig): string => {
  switch (type) {
    case "daily_loss":
      return `${c.lossPct ?? 80}% of daily loss limit`;
    case "session_start":
      return `Session start at ${c.time ?? "09:30"} ${c.timezone ?? "ET"}`;
    case "price_level":
      return `${c.symbol ?? "NQ"} ${c.direction ?? "above"} ${c.price ?? 0}`;
    case "max_trades":
      return `${c.trades ?? 3} trades today`;
    case "profit_target":
      return `${c.targetPct ?? 80}% to profit target`;
    case "strategy_signal":
      return c.strategyName
        ? `${c.strategyName} · ${c.timeframe ?? "5m"}`
        : "Strategy signal";
    case "position_size":
      return `Risk ${c.riskPct ?? 1}% of $${(c.accountSize ?? 50000).toLocaleString()}`;
  }
};

const relativeTime = (ts: number | null): string => {
  if (!ts) return "Last triggered: never";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Last triggered: just now";
  if (mins < 60) return `Last triggered: ${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Last triggered: ${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `Last triggered: ${days} day${days === 1 ? "" : "s"} ago`;
};

// ── Page ──────────────────────────────────────────────────────────
export default function AlertsPage() {
  const [loaded, setLoaded] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [strategies, setStrategies] = useState<SavedStrategy[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [showPicker, setShowPicker] = useState(false);
  const [editingType, setEditingType] = useState<AlertType | null>(null);
  const [draftConfig, setDraftConfig] = useState<AlertConfig>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setAlerts(JSON.parse(raw));
    } catch {}
    setStrategies(loadStrategies(getUsername()));
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

  const startCreate = (type: AlertType) => {
    setEditingType(type);
    const firstStrat = strategies[0];
    // Sensible defaults per type
    const defaults: Record<AlertType, AlertConfig> = {
      daily_loss:      { lossPct: 80 },
      session_start:   { time: "09:30", timezone: "ET" },
      price_level:     { symbol: "NQ", price: 0, direction: "above" },
      max_trades:      { trades: 3 },
      profit_target:   { targetPct: 80 },
      strategy_signal: firstStrat
        ? {
            strategyId: firstStrat.id,
            strategyName: firstStrat.name,
            timeframe: "5m",
            symbolMode: "default",
            entryConds: firstStrat.rules?.entryConds ?? [],
          }
        : { timeframe: "5m", symbolMode: "default", entryConds: [] },
      position_size:   { accountSize: 50000, riskPct: 1, stopPts: 10, symbol: "NQ", pointValue: POINT_VALUES.NQ },
    };
    setDraftConfig(defaults[type]);
    setShowPicker(false);
  };

  const saveDraft = () => {
    if (!editingType) return;
    const newAlert: Alert = {
      id: newId(),
      type: editingType,
      name: buildName(editingType, draftConfig),
      enabled: true,
      config: draftConfig,
      lastTriggered: null,
    };
    setAlerts(prev => [newAlert, ...prev]);
    setEditingType(null);
    setDraftConfig({});
  };

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const deleteAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    setConfirmDelete(null);
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
                  return (
                    <div key={a.id} style={{
                      ...card,
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      padding: "16px 18px",
                    }}>
                      <div style={{
                        width: 38, height: 38, flexShrink: 0,
                        borderRadius: 9,
                        background: "rgba(99,102,241,0.10)",
                        color: "var(--accent, #6366f1)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {meta.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                          {meta.label}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#ffffff", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.name}
                        </div>
                        <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "ui-monospace, monospace" }}>
                          {a.type === "strategy_signal"
                            ? "Fires when all entry conditions are met"
                            : a.type === "position_size"
                              ? "Floating reminder in bottom-right of dashboard"
                              : relativeTime(a.lastTriggered)}
                        </div>
                      </div>

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
                          flexShrink: 0,
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

                      {/* Delete */}
                      {confirming ? (
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
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
                            flexShrink: 0,
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
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent, #6366f1)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e1e1e"; }}
                  >
                    <div style={{ color: "var(--accent, #6366f1)" }}>{t.icon}</div>
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
              onClose={() => { setEditingType(null); setDraftConfig({}); }}
              title={ALERT_TYPES.find(t => t.key === editingType)!.label}
            >
              <AlertConfigFields
                type={editingType}
                config={draftConfig}
                onChange={setDraftConfig}
                strategies={strategies}
                label={label}
                input={input}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => { setEditingType(null); setDraftConfig({}); }} style={ghostBtn}>
                  Cancel
                </button>
                <button type="button" onClick={saveDraft} style={primaryBtn}>
                  Create alert
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
            input:focus, select:focus { border-color: var(--accent, #6366f1) !important; }
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
function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
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
          maxWidth: 520,
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

// ── Per-type config fields ────────────────────────────────────────
function AlertConfigFields({
  type, config, onChange, strategies, label, input,
}: {
  type: AlertType;
  config: AlertConfig;
  onChange: (c: AlertConfig) => void;
  strategies: SavedStrategy[];
  label: React.CSSProperties;
  input: React.CSSProperties;
}) {
  const set = (patch: AlertConfig) => onChange({ ...config, ...patch });

  if (type === "daily_loss") {
    return (
      <div>
        <label style={label}>Trigger at % of daily loss limit</label>
        <input
          type="number"
          min={1}
          max={100}
          value={config.lossPct ?? 80}
          onChange={e => set({ lossPct: Math.max(1, Math.min(100, parseInt(e.target.value) || 0)) })}
          style={input}
        />
        <p style={{ fontSize: 12, color: "#6b7280", marginTop: 10 }}>
          You'll get a heads-up when your day's losses cross this share of your daily limit.
        </p>
      </div>
    );
  }

  if (type === "session_start") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={label}>Time</label>
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
    );
  }

  if (type === "price_level") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <label style={label}>Symbol</label>
          <select
            value={config.symbol ?? "NQ"}
            onChange={e => set({ symbol: e.target.value })}
            style={{ ...input, appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}
          >
            {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Direction</label>
          <select
            value={config.direction ?? "above"}
            onChange={e => set({ direction: e.target.value as "above" | "below" })}
            style={{ ...input, appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}
          >
            <option value="above">Above</option>
            <option value="below">Below</option>
          </select>
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
    );
  }

  if (type === "max_trades") {
    return (
      <div>
        <label style={label}>Notify after N trades today</label>
        <input
          type="number"
          min={1}
          max={50}
          value={config.trades ?? 3}
          onChange={e => set({ trades: Math.max(1, Math.min(50, parseInt(e.target.value) || 1)) })}
          style={input}
        />
      </div>
    );
  }

  if (type === "strategy_signal") {
    const selected = strategies.find(s => s.id === config.strategyId);
    const entryConds = config.entryConds ?? selected?.rules?.entryConds ?? [];

    if (!strategies.length) {
      return (
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
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
            style={{ ...input, appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}
          >
            {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label style={label}>Entry conditions (read-only)</label>
          <div style={{
            border: "1px solid #1e1e1e",
            borderRadius: 9,
            background: "#080808",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: 200,
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={label}>Timeframe</label>
            <div style={{ display: "flex", gap: 4 }}>
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
            <label style={label}>Instrument</label>
            <select
              value={config.symbolMode ?? "default"}
              onChange={e => set({ symbolMode: e.target.value as "default" | "custom" })}
              style={{ ...input, appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}
            >
              <option value="default">Strategy default</option>
              <option value="custom">Custom…</option>
            </select>
          </div>
        </div>

        {config.symbolMode === "custom" && (
          <div>
            <label style={label}>Custom symbol</label>
            <select
              value={config.customSymbol ?? "NQ"}
              onChange={e => set({ customSymbol: e.target.value })}
              style={{ ...input, appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}
            >
              {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
          We'll ping you when every entry condition above is met on the selected timeframe.
        </p>
      </div>
    );
  }

  if (type === "position_size") {
    const account = config.accountSize ?? 50000;
    const risk = config.riskPct ?? 1;
    const stop = config.stopPts ?? 10;
    const sym = config.symbol ?? "NQ";
    const pv = POINT_VALUES[sym] ?? config.pointValue ?? 20;
    const maxRisk = account * (risk / 100);
    const contracts = stop > 0 && pv > 0 ? Math.max(0, Math.floor(maxRisk / (stop * pv))) : 0;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 13, color: "#9ca3af", margin: 0, lineHeight: 1.5 }}>
          Remind me of my position size before each trade. A floating mini calculator will pin to the bottom-right of the dashboard while this alert is enabled.
        </p>

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
            <label style={label}>Risk per trade (%)</label>
            <input
              type="number"
              min={0.1}
              max={10}
              step={0.1}
              value={risk}
              onChange={e => set({ riskPct: Math.max(0.1, Math.min(10, parseFloat(e.target.value) || 0.1)) })}
              style={input}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
          <div>
            <label style={label}>Symbol</label>
            <select
              value={sym}
              onChange={e => set({ symbol: e.target.value, pointValue: POINT_VALUES[e.target.value] ?? 1 })}
              style={{ ...input, appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}
            >
              {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
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
      </div>
    );
  }

  // profit_target
  return (
    <div>
      <label style={label}>Notify at % of challenge profit target</label>
      <input
        type="number"
        min={1}
        max={100}
        value={config.targetPct ?? 80}
        onChange={e => set({ targetPct: Math.max(1, Math.min(100, parseInt(e.target.value) || 0)) })}
        style={input}
      />
      <p style={{ fontSize: 12, color: "#6b7280", marginTop: 10 }}>
        We'll ping you when you cross this share of the way toward your active challenge target.
      </p>
    </div>
  );
}
