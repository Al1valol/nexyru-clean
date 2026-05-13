"use client";

import { useEffect, useState } from "react";

const ALERTS_KEY = "nexyru_alerts";

const POINT_VALUES: Record<string, number> = {
  ES: 50, NQ: 20, CL: 1000, GC: 100, BTC: 5, ETH: 50, SOL: 50,
};

interface PositionConfig {
  accountSize?: number;
  riskPct?: number;
  stopPts?: number;
  symbol?: string;
  pointValue?: number;
}

interface StoredAlert {
  id: string;
  type: string;
  enabled: boolean;
  config: PositionConfig;
}

function readPositionConfig(): PositionConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ALERTS_KEY);
    if (!raw) return null;
    const alerts: StoredAlert[] = JSON.parse(raw);
    const a = alerts.find(x => x.type === "position_size" && x.enabled);
    return a?.config ?? null;
  } catch {
    return null;
  }
}

export default function PositionSizeWidget() {
  const [config, setConfig] = useState<PositionConfig | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Live inputs (start from alert config, user can tweak before each trade)
  const [account, setAccount] = useState<number>(50000);
  const [risk, setRisk] = useState<number>(1);
  const [stop, setStop] = useState<number>(10);
  const [symbol, setSymbol] = useState<string>("NQ");

  useEffect(() => {
    const sync = () => {
      const cfg = readPositionConfig();
      setConfig(cfg);
      if (cfg) {
        setAccount(cfg.accountSize ?? 50000);
        setRisk(cfg.riskPct ?? 1);
        setStop(cfg.stopPts ?? 10);
        setSymbol(cfg.symbol ?? "NQ");
      }
    };
    sync();
    const onStorage = (e: StorageEvent) => { if (e.key === ALERTS_KEY) sync(); };
    const onFocus = () => sync();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    const id = window.setInterval(sync, 4000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(id);
    };
  }, []);

  if (!config) return null;

  const pv = POINT_VALUES[symbol] ?? 20;
  const maxRisk = account * (risk / 100);
  const contracts = stop > 0 && pv > 0 ? Math.max(0, Math.floor(maxRisk / (stop * pv))) : 0;

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 700,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    display: "block",
    marginBottom: 4,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid #2a2a3a",
    background: "#0d0d10",
    color: "#ffffff",
    fontSize: 12,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 60,
        width: collapsed ? 56 : 240,
        borderRadius: 12,
        border: "1px solid #1e1e1e",
        background: "rgba(17,17,17,0.96)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
        backdropFilter: "blur(8px)",
        color: "#ffffff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        transition: "width 0.15s ease",
      }}
    >
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Open position size calculator"
          style={{
            width: 56, height: 56,
            border: "none",
            background: "transparent",
            color: "var(--accent, #6366f1)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="8" y1="14" x2="10" y2="14" />
            <line x1="14" y1="14" x2="16" y2="14" />
          </svg>
        </button>
      ) : (
        <div style={{ padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Position Size
            </div>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse"
              style={{
                width: 20, height: 20,
                borderRadius: 5,
                border: "1px solid #2a2a3a",
                background: "transparent",
                color: "#6b7280",
                cursor: "pointer",
                fontSize: 12,
                lineHeight: 1,
              }}
            >
              −
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>Account $</label>
              <input
                type="number"
                value={account}
                onChange={e => setAccount(Math.max(0, parseFloat(e.target.value) || 0))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Risk %</label>
              <input
                type="number"
                step={0.1}
                value={risk}
                onChange={e => setRisk(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>Stop (pts)</label>
              <input
                type="number"
                step={0.25}
                value={stop}
                onChange={e => setStop(Math.max(0.25, parseFloat(e.target.value) || 0.25))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Symbol</label>
              <select
                value={symbol}
                onChange={e => setSymbol(e.target.value)}
                style={{ ...inputStyle, appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}
              >
                {Object.keys(POINT_VALUES).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            padding: 10,
            borderRadius: 8,
            background: "rgba(99,102,241,0.08)",
            border: "1px solid rgba(99,102,241,0.22)",
          }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Risk $</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", fontFamily: "ui-monospace, monospace" }}>
                ${maxRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Contracts</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent, #6366f1)", fontFamily: "ui-monospace, monospace" }}>
                {contracts}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
