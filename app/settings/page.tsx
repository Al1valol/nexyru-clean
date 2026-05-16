"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { createClient } from "@supabase/supabase-js";

// ── Supabase ──
const SUPA_URL = "https://xsrcaceydyqytbipvrok.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcmNhY2V5ZHlxeXRiaXB2cm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDg0MjUsImV4cCI6MjA5MzUyNDQyNX0.IfIkjTtAAb0-iZLu8CE-3GgdNGKxSNJKczSAZlQV62A";
const supabase = createClient(SUPA_URL, SUPA_KEY);

// ── Constants ──
const SESSION_KEY = "tradedesk_session_v1";
const tradesKey = (u: string) => `tradedesk_trades_${u}_v1`;

type Session = {
  username?: string;
  displayName?: string;
  email?: string;
  googleAuth?: boolean;
  supabaseUserId?: string | null;
};

type Category =
  | "profile"
  | "account"
  | "trading"
  | "notifications"
  | "display"
  | "data"
  | "danger";

type Profile = {
  displayName: string;
  username: string;
  bio: string;
  timezone: string;
  tradingSince: string;
  avatar: string;
};

type TradingPrefs = {
  accountType: "paper" | "live" | "funded";
  instruments: string[];
  timeframe: string;
  riskPerTrade: number;
  sessionStart: string;
  sessionEnd: string;
  currency: "USD" | "EUR" | "GBP" | "CAD";
  pnlIn: "points" | "dollars" | "both";
};

type Notifications = {
  dailyLossLimit: boolean;
  sessionStart: boolean;
  weeklyReport: boolean;
  milestoneAlerts: boolean;
};

type Display = {
  accentColor: string;
  theme: "dark" | "light";
  compactMode: boolean;
  showPnlColors: boolean;
  fontSize: "small" | "medium" | "large";
  numberFormat: "withCommas" | "plain";
};

const THEME_VARS = {
  dark: {
    "--bg": "#080808",
    "--surface": "#111111",
    "--surface2": "#1a1a1a",
    "--border": "#1e1e1e",
    "--text-primary": "#ffffff",
    "--text-secondary": "#6b7280",
    "--text-muted": "#374151",
  },
  light: {
    "--bg": "#ffffff",
    "--surface": "#f9fafb",
    "--surface2": "#f3f4f6",
    "--border": "#e5e7eb",
    "--text-primary": "#111827",
    "--text-secondary": "#6b7280",
    "--text-muted": "#9ca3af",
  },
} as const;

function applyTheme(theme: "dark" | "light") {
  if (typeof document === "undefined") return;
  const vars = THEME_VARS[theme];
  const css = `:root{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")}}`;
  let tag = document.getElementById("nexyru-theme-vars") as HTMLStyleElement | null;
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
}

function applyAccent(color: string) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--accent", color);
}

const TIMEZONES = [
  "Eastern (ET)",
  "Central (CT)",
  "Mountain (MT)",
  "Pacific (PT)",
  "Greenwich (GMT)",
  "Central European (CET)",
  "Japan (JST)",
  "Australian Eastern (AEST)",
];

const INSTRUMENTS = ["ES", "NQ", "CL", "GC", "BTC", "ETH", "SOL", "FOREX"];
const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "Daily"];
const ACCENT_COLORS = [
  { name: "indigo", value: "#6366f1" },
  { name: "blue", value: "#3b82f6" },
  { name: "green", value: "#22c55e" },
  { name: "purple", value: "#a855f7" },
  { name: "orange", value: "#f97316" },
  { name: "red", value: "#ef4444" },
];

// ── Helpers ──
function getSession(): Session {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
  } catch {
    return {};
  }
}

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function tradesToCsv(trades: Record<string, unknown>[]): string {
  if (!trades.length) return "id,symbol,type,entryPrice,exitPrice,size,pnl,date,notes\n";
  const cols = Array.from(
    trades.reduce((acc, t) => {
      Object.keys(t).forEach((k) => acc.add(k));
      return acc;
    }, new Set<string>())
  );
  const header = cols.join(",");
  const rows = trades.map((t) => cols.map((c) => csvEscape(t[c])).join(","));
  return [header, ...rows].join("\n");
}

function getInitials(name: string): string {
  const n = (name || "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Styles ──
const card: React.CSSProperties = {
  background: "#111111",
  border: "1px solid #1e1e1e",
  borderRadius: 12,
  padding: 22,
  marginBottom: 16,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#6b7280",
  marginBottom: 14,
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#9ca3af",
  marginBottom: 6,
};

const input: React.CSSProperties = {
  width: "100%",
  background: "#0a0a0f",
  border: "1px solid #2a2a2a",
  borderRadius: 8,
  color: "#fff",
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const btnPrimary: React.CSSProperties = {
  background: "#6366f1",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 18px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const btnDanger: React.CSSProperties = {
  background: "transparent",
  color: "#ef4444",
  border: "1px solid #ef4444",
  borderRadius: 8,
  padding: "9px 16px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  background: "#1a1a24",
  color: "#fff",
  border: "1px solid #2a2a3a",
  borderRadius: 8,
  padding: "9px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const NAV: { key: Category; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "account", label: "Account & Security" },
  { key: "trading", label: "Trading Preferences" },
  { key: "notifications", label: "Notifications" },
  { key: "display", label: "Display & Theme" },
  { key: "data", label: "Data & Privacy" },
  { key: "danger", label: "Danger Zone" },
];

// ── Toggle Switch ──
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        border: "none",
        background: on ? "#6366f1" : "#2a2a2a",
        position: "relative",
        cursor: "pointer",
        transition: "background 0.15s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}

function ToggleRow({
  title,
  desc,
  on,
  onChange,
}: {
  title: string;
  desc?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 0",
        borderBottom: "1px solid #1e1e1e",
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{title}</div>
        {desc && (
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>{desc}</div>
        )}
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

// ── Inline Message ──
function FlashMsg({ msg, kind }: { msg: string; kind: "success" | "error" | "info" }) {
  if (!msg) return null;
  const palette =
    kind === "error"
      ? { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.4)", color: "#ef4444" }
      : kind === "success"
      ? { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.4)", color: "#22c55e" }
      : { bg: "rgba(99,102,241,0.08)", border: "rgba(99,102,241,0.4)", color: "#6366f1" };
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 8,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.color,
        fontSize: 13,
        fontWeight: 600,
        marginBottom: 12,
      }}
    >
      {msg}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════
export default function SettingsPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("profile");
  const [session, setSession] = useState<Session>(() => {
    if (typeof window === "undefined") return {};
    return getSession();
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const username = session.username || "guest";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0f" }}>
      <Sidebar activePath="/settings" />
      <MobileNav activePath="/settings" />
      <main
        className="settings-main"
        style={{
          flex: 1,
          marginLeft: 56,
          minHeight: "100vh",
          background: "#070b14",
          color: "#fff",
          padding: "32px 20px",
          paddingBottom: 72,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <style>{`
          @media (max-width: 900px) {
            .settings-main { padding: 16px !important; }
            .settings-grid { grid-template-columns: 1fr !important; }
            .settings-left-nav { position: static !important; }
          }
          @media (max-width: 767px) {
            .settings-left-nav {
              display: flex !important;
              flex-direction: row !important;
              overflow-x: auto !important;
              overflow-y: hidden !important;
              padding: 6px !important;
              gap: 4px !important;
              scrollbar-width: none;
              -webkit-overflow-scrolling: touch;
            }
            .settings-left-nav::-webkit-scrollbar { display: none; }
            .settings-left-nav button {
              flex: 0 0 auto !important;
              width: auto !important;
              white-space: nowrap !important;
              padding: 8px 14px !important;
              border-left: none !important;
              border-bottom: 2px solid transparent !important;
              min-height: 40px !important;
            }
            .settings-left-nav button[style*="border-left: 2px solid"] {
              border-bottom: 2px solid #6366f1 !important;
            }
          }
          input:focus, textarea:focus, select:focus { border-color: #6366f1 !important; }
          input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none;
            width: 18px; height: 18px; border-radius: 50%;
            background: #6366f1; cursor: pointer; border: 2px solid #fff;
          }
          input[type="range"] {
            -webkit-appearance: none; appearance: none;
            width: 100%; height: 6px; border-radius: 3px;
            background: #2a2a2a; outline: none;
          }
        `}</style>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <a href="/dashboard" style={{display:'flex', alignItems:'center', gap:6, color:'#6b7280', fontSize:13, textDecoration:'none', marginBottom:16}}>
            ← Back to Dashboard
          </a>
          <header style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>
              Settings
            </h1>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "6px 0 0" }}>
              Manage your account, preferences, and data
            </p>
          </header>

          <div
            className="settings-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "220px 1fr",
              gap: 24,
              alignItems: "start",
            }}
          >
            {/* LEFT NAV */}
            <nav
              className="settings-left-nav"
              style={{
                position: "sticky",
                top: 24,
                background: "#111111",
                border: "1px solid #1e1e1e",
                borderRadius: 12,
                padding: 8,
              }}
            >
              {NAV.map((n) => {
                const active = activeCategory === n.key;
                const danger = n.key === "danger";
                return (
                  <button
                    key={n.key}
                    type="button"
                    onClick={() => setActiveCategory(n.key)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      fontSize: 13,
                      fontWeight: active ? 700 : 500,
                      color: active ? "#fff" : danger ? "#ef4444" : "#9ca3af",
                      background: active ? "#1a1a24" : "transparent",
                      border: "none",
                      borderLeft: active
                        ? "2px solid #6366f1"
                        : "2px solid transparent",
                      borderRadius: 6,
                      cursor: "pointer",
                      marginBottom: 2,
                      transition: "background 0.1s, color 0.1s",
                    }}
                  >
                    {n.label}
                  </button>
                );
              })}
            </nav>

            {/* RIGHT CONTENT */}
            <div>
              {activeCategory === "profile" && (
                <ProfileSection session={session} username={username} />
              )}
              {activeCategory === "account" && (
                <AccountSection session={session} setSession={setSession} />
              )}
              {activeCategory === "trading" && (
                <TradingSection username={username} />
              )}
              {activeCategory === "notifications" && (
                <NotificationsSection username={username} />
              )}
              {activeCategory === "display" && <DisplaySection />}
              {activeCategory === "data" && (
                <DataPrivacySection session={session} username={username} />
              )}
              {activeCategory === "danger" && (
                <DangerSection username={username} />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PROFILE
// ═══════════════════════════════════════════════════════════════
function ProfileSection({ session, username }: { session: Session; username: string }) {
  const [profile, setProfile] = useState<Profile>(() =>
    readLS<Profile>(`nexyru_profile_${username}`, {
      displayName: session.displayName || "",
      username,
      bio: "",
      timezone: "Eastern (ET)",
      tradingSince: String(new Date().getFullYear()),
      avatar: "",
    })
  );
  const [flash, setFlash] = useState<{ msg: string; kind: "success" | "error" | "info" }>({
    msg: "",
    kind: "info",
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 1024 * 1024) {
      setFlash({ msg: "Image too large — keep it under 1 MB", kind: "error" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfile((p) => ({ ...p, avatar: String(reader.result || "") }));
    };
    reader.readAsDataURL(f);
  };

  const save = () => {
    if (profile.bio.length > 160) {
      setFlash({ msg: "Bio must be 160 characters or fewer", kind: "error" });
      return;
    }
    localStorage.setItem(`nexyru_profile_${username}`, JSON.stringify(profile));
    setFlash({ msg: "Profile saved", kind: "success" });
  };

  const years = useMemo(() => {
    const arr: string[] = [];
    const now = new Date().getFullYear();
    for (let y = now; y >= now - 50; y--) arr.push(String(y));
    return arr;
  }, []);

  const isGoogle = !!session.googleAuth;
  const initials = getInitials(profile.displayName || profile.username || "User");

  return (
    <section style={card}>
      <div style={sectionTitle}>Profile</div>

      <FlashMsg msg={flash.msg} kind={flash.kind} />

      {/* Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            background: profile.avatar
              ? `url(${profile.avatar}) center/cover`
              : "linear-gradient(135deg,#6366f1,#4f46e5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 32,
            fontWeight: 900,
            flexShrink: 0,
          }}
        >
          {!profile.avatar && initials}
        </div>
        <div>
          <button type="button" style={btnSecondary} onClick={() => fileRef.current?.click()}>
            Change Photo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={onPickPhoto}
          />
          {profile.avatar && (
            <button
              type="button"
              onClick={() => setProfile((p) => ({ ...p, avatar: "" }))}
              style={{
                ...btnSecondary,
                marginLeft: 8,
                color: "#9ca3af",
                border: "1px solid #2a2a3a",
              }}
            >
              Remove
            </button>
          )}
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>
            Saved locally as base64 (max 1 MB)
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div>
          <label style={label}>Display Name</label>
          <input
            style={input}
            value={profile.displayName}
            onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
            placeholder="Jane Trader"
          />
        </div>
        <div>
          <label style={label}>Username</label>
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#6b7280",
                fontSize: 14,
              }}
            >
              @
            </span>
            <input
              style={{
                ...input,
                paddingLeft: 26,
                opacity: isGoogle ? 0.6 : 1,
                cursor: isGoogle ? "not-allowed" : "text",
              }}
              value={profile.username}
              readOnly={isGoogle}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  username: e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase(),
                })
              }
              placeholder="username"
            />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={label}>Bio</label>
        <textarea
          style={{ ...input, minHeight: 80, resize: "vertical" }}
          value={profile.bio}
          maxLength={160}
          onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
          placeholder="Tell other traders about yourself"
        />
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, textAlign: "right" }}>
          {profile.bio.length}/160
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div>
          <label style={label}>Timezone</label>
          <select
            style={input}
            value={profile.timezone}
            onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={label}>Trading Since</label>
          <select
            style={input}
            value={profile.tradingSince}
            onChange={(e) => setProfile({ ...profile, tradingSince: e.target.value })}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button type="button" style={btnPrimary} onClick={save}>
        Save Profile
      </button>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ACCOUNT & SECURITY
// ═══════════════════════════════════════════════════════════════
function AccountSection({
  session,
  setSession,
}: {
  session: Session;
  setSession: (s: Session) => void;
}) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ msg: string; kind: "success" | "error" | "info" }>({
    msg: "",
    kind: "info",
  });

  const [newEmail, setNewEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [emailMsg, setEmailMsg] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);

  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    try {
      const token = localStorage.getItem("sb-xsrcaceydyqytbipvrok-auth-token");
      const parsed = token ? JSON.parse(token) : null;
      const email =
        parsed?.user?.email ||
        parsed?.currentSession?.user?.email ||
        session.email ||
        "";
      setUserEmail(email);
    } catch {
      setUserEmail(session.email || "");
    }
  }, [session.email]);

  const handlePasswordReset = async () => {
    setResetLoading(true);
    setResetMessage("");
    try {
      const res = await fetch("/api/send-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });
      const data = await res.json();
      if (data.ok) {
        setResetSent(true);
        setResetMessage(`Reset link sent to ${userEmail} — check your inbox.`);
      } else {
        setResetMessage("Could not send reset email. Try again.");
      }
    } catch {
      setResetMessage("Something went wrong. Try again.");
    }
    setResetLoading(false);
  };

  const sendEmailChange = async () => {
    setEmailMsg("");
    const trimmed = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailStatus("error");
      setEmailMsg("Enter a valid email address");
      return;
    }
    if (trimmed === (session.email || "").trim().toLowerCase()) {
      setEmailStatus("error");
      setEmailMsg("That's already your email");
      return;
    }
    setEmailStatus("sending");
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) {
        setEmailStatus("error");
        setEmailMsg(error.message);
        return;
      }
      setEmailStatus("sent");
      setEmailMsg(
        "Check your new email inbox to confirm the change. Your email won't update until you click the link."
      );
    } catch (e) {
      setEmailStatus("error");
      setEmailMsg((e as Error).message || "Failed to send verification email");
    }
  };

  const changePassword = async () => {
    setFlash({ msg: "", kind: "info" });
    if (!newPw || newPw.length < 6) {
      setFlash({ msg: "New password must be at least 6 characters", kind: "error" });
      return;
    }
    if (newPw !== confirmPw) {
      setFlash({ msg: "New passwords don't match", kind: "error" });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) {
        setFlash({ msg: error.message, kind: "error" });
      } else {
        setFlash({ msg: "Password updated", kind: "success" });
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      }
    } catch (e) {
      setFlash({ msg: (e as Error).message || "Update failed", kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {}
    setSession({});
    window.location.href = "/login";
  };

  return (
    <section style={card}>
      <div style={sectionTitle}>Account & Security</div>

      <FlashMsg msg={flash.msg} kind={flash.kind} />

      {/* Email */}
      <div style={{ marginBottom: 22 }}>
        <label style={label}>Email</label>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#0a0a0f",
            border: "1px solid #2a2a2a",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          <span style={{ color: "#fff", fontSize: 14 }}>{session.email || "—"}</span>
          <button
            type="button"
            style={btnSecondary}
            onClick={() => {
              setShowEmailForm((v) => !v);
              setEmailStatus("idle");
              setEmailMsg("");
              setNewEmail("");
            }}
          >
            {showEmailForm ? "Cancel" : "Change"}
          </button>
        </div>

        {showEmailForm && (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <input
              type="email"
              placeholder="New email address"
              style={input}
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
                if (emailStatus === "error" || emailStatus === "sent") {
                  setEmailStatus("idle");
                  setEmailMsg("");
                }
              }}
              autoComplete="email"
              disabled={emailStatus === "sending" || emailStatus === "sent"}
            />
            {emailMsg && (
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color:
                    emailStatus === "error"
                      ? "#ef4444"
                      : emailStatus === "sent"
                      ? "#22c55e"
                      : "#9ca3af",
                  lineHeight: 1.5,
                }}
              >
                {emailMsg}
              </div>
            )}
            <button
              type="button"
              style={{
                ...btnPrimary,
                opacity: emailStatus === "sending" || emailStatus === "sent" ? 0.6 : 1,
                width: "fit-content",
              }}
              onClick={sendEmailChange}
              disabled={emailStatus === "sending" || emailStatus === "sent"}
            >
              {emailStatus === "sending"
                ? "Sending..."
                : emailStatus === "sent"
                ? "Verification sent"
                : "Send verification email"}
            </button>
          </div>
        )}
      </div>

      {/* Reset password by email */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ ...label, fontSize: 13, color: "#fff", marginBottom: 10 }}>
          Forgot your current password?
        </div>
        {resetSent ? (
          <div
            style={{
              color: "#22c55e",
              fontSize: 13,
              padding: "10px 14px",
              background: "rgba(34,197,94,0.1)",
              borderRadius: 8,
              border: "1px solid rgba(34,197,94,0.2)",
            }}
          >
            {resetMessage || `Reset link sent to ${userEmail} — check your inbox.`}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={resetLoading || !userEmail}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid rgba(99,102,241,0.4)",
                background: "transparent",
                color: "#6366f1",
                fontSize: 13,
                fontWeight: 600,
                cursor: resetLoading || !userEmail ? "default" : "pointer",
                opacity: resetLoading || !userEmail ? 0.6 : 1,
              }}
            >
              {resetLoading
                ? "Sending..."
                : userEmail
                ? `Send reset link to ${userEmail}`
                : "Send password reset email"}
            </button>
            {resetMessage && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#ef4444",
                  lineHeight: 1.5,
                }}
              >
                {resetMessage}
              </div>
            )}
          </>
        )}
      </div>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 18px" }}>
        <div style={{ flex: 1, height: 1, background: "#2a2a2a" }} />
        <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: "0.04em" }}>
          or change password directly
        </span>
        <div style={{ flex: 1, height: 1, background: "#2a2a2a" }} />
      </div>

      {/* Password */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ ...label, fontSize: 13, color: "#fff", marginBottom: 12 }}>
          Change Password
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <input
            type="password"
            placeholder="Current password"
            style={input}
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            autoComplete="current-password"
          />
          <input
            type="password"
            placeholder="New password"
            style={input}
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            autoComplete="new-password"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            style={input}
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            autoComplete="new-password"
          />
          <button
            type="button"
            style={{ ...btnPrimary, opacity: busy ? 0.6 : 1, width: "fit-content" }}
            onClick={changePassword}
            disabled={busy}
          >
            {busy ? "Updating..." : "Update Password"}
          </button>
        </div>
      </div>

      {/* Connected */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ ...label, fontSize: 13, color: "#fff", marginBottom: 10 }}>
          Connected Accounts
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#0a0a0f",
            border: "1px solid #2a2a2a",
            borderRadius: 8,
            padding: "12px 14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                color: "#4285F4",
                fontSize: 14,
              }}
            >
              G
            </div>
            <span style={{ color: "#fff", fontSize: 14 }}>Google</span>
          </div>
          {session.googleAuth ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#22c55e",
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.3)",
                padding: "4px 10px",
                borderRadius: 99,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Connected
            </span>
          ) : (
            <span style={{ fontSize: 12, color: "#6b7280" }}>Not connected</span>
          )}
        </div>
      </div>

      {/* Sessions */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ ...label, fontSize: 13, color: "#fff", marginBottom: 8 }}>
          Active Sessions
        </div>
        <div style={{ fontSize: 13, color: "#9ca3af" }}>
          You&apos;re signed in on 1 device
        </div>
      </div>

      <button type="button" style={btnDanger} onClick={signOut}>
        Sign Out
      </button>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TRADING PREFERENCES
// ═══════════════════════════════════════════════════════════════
function TradingSection({ username }: { username: string }) {
  const [prefs, setPrefs] = useState<TradingPrefs>(() =>
    readLS<TradingPrefs>(`nexyru_trading_prefs_${username}`, {
      accountType: "paper",
      instruments: ["ES", "NQ"],
      timeframe: "5m",
      riskPerTrade: 1,
      sessionStart: "09:30",
      sessionEnd: "16:00",
      currency: "USD",
      pnlIn: "dollars",
    })
  );
  const [flash, setFlash] = useState<{ msg: string; kind: "success" | "error" | "info" }>({
    msg: "",
    kind: "info",
  });

  const save = () => {
    localStorage.setItem(`nexyru_trading_prefs_${username}`, JSON.stringify(prefs));
    setFlash({ msg: "Trading preferences saved", kind: "success" });
  };

  const toggleInstrument = (i: string) => {
    setPrefs((p) => ({
      ...p,
      instruments: p.instruments.includes(i)
        ? p.instruments.filter((x) => x !== i)
        : [...p.instruments, i],
    }));
  };

  return (
    <section style={card}>
      <div style={sectionTitle}>Trading Preferences</div>

      <FlashMsg msg={flash.msg} kind={flash.kind} />

      {/* Account type */}
      <div style={{ marginBottom: 20 }}>
        <label style={label}>Default Account Type</label>
        <div style={{ display: "flex", gap: 8 }}>
          {(["paper", "live", "funded"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setPrefs({ ...prefs, accountType: t })}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                textTransform: "capitalize",
                background: prefs.accountType === t ? "rgba(99,102,241,0.15)" : "#0a0a0f",
                border:
                  prefs.accountType === t
                    ? "1px solid #6366f1"
                    : "1px solid #2a2a2a",
                color: prefs.accountType === t ? "#6366f1" : "#9ca3af",
                cursor: "pointer",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Instruments */}
      <div style={{ marginBottom: 20 }}>
        <label style={label}>Primary Instruments</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {INSTRUMENTS.map((i) => {
            const on = prefs.instruments.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleInstrument(i)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 700,
                  background: on ? "rgba(99,102,241,0.15)" : "#0a0a0f",
                  border: on ? "1px solid #6366f1" : "1px solid #2a2a2a",
                  color: on ? "#6366f1" : "#9ca3af",
                  cursor: "pointer",
                }}
              >
                {i}
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeframe */}
      <div style={{ marginBottom: 20 }}>
        <label style={label}>Default Timeframe</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setPrefs({ ...prefs, timeframe: tf })}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                background: prefs.timeframe === tf ? "rgba(99,102,241,0.15)" : "#0a0a0f",
                border:
                  prefs.timeframe === tf ? "1px solid #6366f1" : "1px solid #2a2a2a",
                color: prefs.timeframe === tf ? "#6366f1" : "#9ca3af",
                cursor: "pointer",
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Risk slider */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label style={{ ...label, marginBottom: 0 }}>Risk per Trade</label>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#6366f1" }}>
            {prefs.riskPerTrade.toFixed(1)}%
          </span>
        </div>
        <input
          type="range"
          min={0.5}
          max={5}
          step={0.1}
          value={prefs.riskPerTrade}
          onChange={(e) =>
            setPrefs({ ...prefs, riskPerTrade: parseFloat(e.target.value) })
          }
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6b7280", marginTop: 4 }}>
          <span>0.5%</span>
          <span>5%</span>
        </div>
      </div>

      {/* Session times */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div>
          <label style={label}>Session Start</label>
          <input
            type="time"
            style={input}
            value={prefs.sessionStart}
            onChange={(e) => setPrefs({ ...prefs, sessionStart: e.target.value })}
          />
        </div>
        <div>
          <label style={label}>Session End</label>
          <input
            type="time"
            style={input}
            value={prefs.sessionEnd}
            onChange={(e) => setPrefs({ ...prefs, sessionEnd: e.target.value })}
          />
        </div>
      </div>

      {/* Currency + PnL */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 22 }}>
        <div>
          <label style={label}>Currency</label>
          <select
            style={input}
            value={prefs.currency}
            onChange={(e) =>
              setPrefs({ ...prefs, currency: e.target.value as TradingPrefs["currency"] })
            }
          >
            {["USD", "EUR", "GBP", "CAD"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={label}>Show PnL In</label>
          <select
            style={input}
            value={prefs.pnlIn}
            onChange={(e) =>
              setPrefs({ ...prefs, pnlIn: e.target.value as TradingPrefs["pnlIn"] })
            }
          >
            <option value="points">Points</option>
            <option value="dollars">Dollars</option>
            <option value="both">Both</option>
          </select>
        </div>
      </div>

      <button type="button" style={btnPrimary} onClick={save}>
        Save Preferences
      </button>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════
function NotificationsSection({ username }: { username: string }) {
  const [prefs, setPrefs] = useState<Notifications>(() =>
    readLS<Notifications>(`nexyru_notifications_${username}`, {
      dailyLossLimit: true,
      sessionStart: true,
      weeklyReport: true,
      milestoneAlerts: true,
    })
  );
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(() => {
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission;
  });
  const [flash, setFlash] = useState<{ msg: string; kind: "success" | "error" | "info" }>({
    msg: "",
    kind: "info",
  });

  // auto-save toggles
  useEffect(() => {
    try {
      localStorage.setItem(`nexyru_notifications_${username}`, JSON.stringify(prefs));
    } catch {}
  }, [prefs, username]);

  const requestBrowser = async () => {
    if (perm === "unsupported") {
      setFlash({ msg: "This browser doesn't support notifications", kind: "error" });
      return;
    }
    try {
      const p = await Notification.requestPermission();
      setPerm(p);
      if (p === "granted") {
        setFlash({ msg: "Browser notifications enabled", kind: "success" });
      } else if (p === "denied") {
        setFlash({ msg: "Permission denied — enable in browser settings", kind: "error" });
      }
    } catch (e) {
      setFlash({ msg: (e as Error).message, kind: "error" });
    }
  };

  return (
    <section style={card}>
      <div style={sectionTitle}>Notifications</div>

      <FlashMsg msg={flash.msg} kind={flash.kind} />

      <ToggleRow
        title="Daily Loss Limit Warning"
        desc="Alert when reaching 70% and 90% of your daily loss limit"
        on={prefs.dailyLossLimit}
        onChange={(v) => setPrefs({ ...prefs, dailyLossLimit: v })}
      />
      <ToggleRow
        title="Session Start Reminder"
        desc="Get a reminder when your trading session begins"
        on={prefs.sessionStart}
        onChange={(v) => setPrefs({ ...prefs, sessionStart: v })}
      />
      <ToggleRow
        title="Weekly Performance Report"
        desc="Recap of your trading every Monday"
        on={prefs.weeklyReport}
        onChange={(v) => setPrefs({ ...prefs, weeklyReport: v })}
      />
      <ToggleRow
        title="Challenge Milestone Alerts"
        desc="When you hit a profit target or approach drawdown"
        on={prefs.milestoneAlerts}
        onChange={(v) => setPrefs({ ...prefs, milestoneAlerts: v })}
      />

      <div style={{ marginTop: 20 }}>
        <div style={{ ...label, fontSize: 13, color: "#fff", marginBottom: 6 }}>
          Browser Notifications
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
          Status:{" "}
          <span
            style={{
              fontWeight: 700,
              color:
                perm === "granted"
                  ? "#22c55e"
                  : perm === "denied"
                  ? "#ef4444"
                  : "#9ca3af",
            }}
          >
            {perm === "granted"
              ? "Enabled"
              : perm === "denied"
              ? "Blocked"
              : perm === "unsupported"
              ? "Not supported"
              : "Not enabled"}
          </span>
        </div>
        <button
          type="button"
          style={btnPrimary}
          onClick={requestBrowser}
          disabled={perm === "granted" || perm === "unsupported"}
        >
          {perm === "granted" ? "Already Enabled" : "Enable Browser Notifications"}
        </button>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DISPLAY & THEME
// ═══════════════════════════════════════════════════════════════
function DisplaySection() {
  const [display, setDisplay] = useState<Display>(() => {
    const defaults: Display = {
      accentColor: "#6366f1",
      theme: "dark",
      compactMode: false,
      showPnlColors: true,
      fontSize: "medium",
      numberFormat: "withCommas",
    };
    try {
      const accent = localStorage.getItem("nexyru_accent") || defaults.accentColor;
      const theme =
        (localStorage.getItem("nexyru_theme") as "light" | "dark" | null) ||
        defaults.theme;
      const raw = localStorage.getItem("nexyru_display");
      const parsed = raw ? JSON.parse(raw) : {};
      return { ...defaults, ...parsed, accentColor: accent, theme };
    } catch {
      return defaults;
    }
  });
  const [flash, setFlash] = useState<{ msg: string; kind: "success" | "error" | "info" }>({
    msg: "",
    kind: "info",
  });

  const pickAccent = (color: string) => {
    setDisplay((d) => ({ ...d, accentColor: color }));
    localStorage.setItem("nexyru_accent", color);
    applyAccent(color);
    setFlash({ msg: "Accent color updated", kind: "success" });
  };

  const pickTheme = (theme: "dark" | "light") => {
    setDisplay((d) => ({ ...d, theme }));
    localStorage.setItem("nexyru_theme", theme);
    applyTheme(theme);
    setFlash({ msg: `${theme === "light" ? "Light" : "Dark"} mode applied`, kind: "success" });
  };

  const updateDisplay = (patch: Partial<Display>) => {
    const next = { ...display, ...patch };
    setDisplay(next);
    localStorage.setItem("nexyru_display", JSON.stringify(next));
  };

  return (
    <section style={card}>
      <div style={sectionTitle}>Display & Theme</div>

      <FlashMsg msg={flash.msg} kind={flash.kind} />

      <div style={{ marginBottom: 22 }}>
        <label style={label}>Theme</label>
        <div style={{ display: "flex", gap: 10 }}>
          {(["dark", "light"] as const).map((t) => {
            const active = display.theme === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => pickTheme(t)}
                style={{
                  flex: 1,
                  textAlign: "left",
                  padding: "14px 16px",
                  borderRadius: 8,
                  background: active ? "rgba(99,102,241,0.15)" : "#0a0a0f",
                  border: active ? "1px solid #6366f1" : "1px solid #2a2a2a",
                  color: active ? "#fff" : "#9ca3af",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {t}
                <div
                  style={{
                    fontSize: 11,
                    color: active ? "#9ca3af" : "#6b7280",
                    fontWeight: 500,
                    marginTop: 2,
                  }}
                >
                  {active ? "Selected" : t === "light" ? "Bright theme" : "Default"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <label style={label}>Color Accent</label>
        <div style={{ display: "flex", gap: 10 }}>
          {ACCENT_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => pickAccent(c.value)}
              aria-label={c.name}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: c.value,
                border:
                  display.accentColor === c.value
                    ? "3px solid #fff"
                    : "3px solid transparent",
                boxShadow:
                  display.accentColor === c.value
                    ? `0 0 0 2px ${c.value}`
                    : "none",
                cursor: "pointer",
                transition: "transform 0.1s",
              }}
            />
          ))}
        </div>
      </div>

      <ToggleRow
        title="Compact Mode"
        desc="Reduce padding and spacing in tables"
        on={display.compactMode}
        onChange={(v) => updateDisplay({ compactMode: v })}
      />
      <ToggleRow
        title="Show PnL Colors"
        desc="Color PnL values green/red vs monochrome"
        on={display.showPnlColors}
        onChange={(v) => updateDisplay({ showPnlColors: v })}
      />

      <div style={{ marginTop: 18, marginBottom: 18 }}>
        <label style={label}>Font Size</label>
        <div style={{ display: "flex", gap: 8 }}>
          {(["small", "medium", "large"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => updateDisplay({ fontSize: s })}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                textTransform: "capitalize",
                background:
                  display.fontSize === s ? "rgba(99,102,241,0.15)" : "#0a0a0f",
                border:
                  display.fontSize === s ? "1px solid #6366f1" : "1px solid #2a2a2a",
                color: display.fontSize === s ? "#6366f1" : "#9ca3af",
                cursor: "pointer",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={label}>Number Format</label>
        <div style={{ display: "flex", gap: 8 }}>
          {([
            { v: "withCommas", l: "$1,234.56" },
            { v: "plain", l: "1234.56" },
          ] as const).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => updateDisplay({ numberFormat: o.v })}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background:
                  display.numberFormat === o.v
                    ? "rgba(99,102,241,0.15)"
                    : "#0a0a0f",
                border:
                  display.numberFormat === o.v
                    ? "1px solid #6366f1"
                    : "1px solid #2a2a2a",
                color: display.numberFormat === o.v ? "#6366f1" : "#9ca3af",
                cursor: "pointer",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DATA & PRIVACY
// ═══════════════════════════════════════════════════════════════
function DataPrivacySection({ session, username }: { session: Session; username: string }) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [visibility, setVisibility] = useState<"public" | "private">(() => {
    try {
      return localStorage.getItem("nexyru_profile_visibility") === "private"
        ? "private"
        : "public";
    } catch {
      return "public";
    }
  });
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ msg: string; kind: "success" | "error" | "info" }>({
    msg: "",
    kind: "info",
  });
  const importRef = useRef<HTMLInputElement>(null);

  const exportTrades = () => {
    try {
      const raw = localStorage.getItem(tradesKey(username));
      const trades = raw ? JSON.parse(raw) : [];
      const csv = tradesToCsv(trades);
      downloadFile(`nexyru-trades-${username}-${Date.now()}.csv`, csv, "text/csv");
      setFlash({ msg: `Exported ${trades.length} trades`, kind: "success" });
    } catch (e) {
      setFlash({ msg: (e as Error).message, kind: "error" });
    }
  };

  const exportSettings = () => {
    try {
      const all: Record<string, unknown> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith("nexyru_") || k.startsWith("tradedesk_")) {
          all[k] = localStorage.getItem(k);
        }
      }
      downloadFile(
        `nexyru-backup-${username}-${Date.now()}.json`,
        JSON.stringify(all, null, 2),
        "application/json"
      );
      setFlash({ msg: "Settings exported", kind: "success" });
    } catch (e) {
      setFlash({ msg: (e as Error).message, kind: "error" });
    }
  };

  const clearTrades = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    try {
      localStorage.removeItem(tradesKey(username));
      setConfirmClear(false);
      setFlash({ msg: "All trades cleared", kind: "success" });
    } catch (e) {
      setFlash({ msg: (e as Error).message, kind: "error" });
    }
  };

  const importBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        if (typeof parsed !== "object" || !parsed) throw new Error("Invalid format");
        let restored = 0;
        Object.entries(parsed).forEach(([k, v]) => {
          if (typeof v === "string" && (k.startsWith("nexyru_") || k.startsWith("tradedesk_"))) {
            localStorage.setItem(k, v);
            restored++;
          }
        });
        setFlash({ msg: `Restored ${restored} settings`, kind: "success" });
      } catch (err) {
        setFlash({ msg: `Import failed: ${(err as Error).message}`, kind: "error" });
      }
    };
    reader.readAsText(f);
    if (importRef.current) importRef.current.value = "";
  };

  const saveVisibility = async (v: "public" | "private") => {
    setVisibility(v);
    localStorage.setItem("nexyru_profile_visibility", v);
    if (!session.supabaseUserId) {
      setFlash({ msg: "Visibility saved locally", kind: "success" });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ visibility: v })
        .eq("id", session.supabaseUserId);
      if (error) throw error;
      setFlash({ msg: "Profile visibility updated", kind: "success" });
    } catch (e) {
      setFlash({
        msg: `Saved locally (sync failed: ${(e as Error).message})`,
        kind: "info",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={card}>
      <div style={sectionTitle}>Data & Privacy</div>

      <FlashMsg msg={flash.msg} kind={flash.kind} />

      <div style={{ display: "grid", gap: 14, marginBottom: 22 }}>
        <ActionRow
          title="Export All Trades"
          desc="Download a CSV of every trade in your journal"
          button={
            <button type="button" style={btnSecondary} onClick={exportTrades}>
              Export CSV
            </button>
          }
        />
        <ActionRow
          title="Export Settings"
          desc="Backup all profile, preferences, and notification settings"
          button={
            <button type="button" style={btnSecondary} onClick={exportSettings}>
              Export JSON
            </button>
          }
        />
        <ActionRow
          title="Import Backup"
          desc="Restore from a previously exported JSON file"
          button={
            <>
              <button
                type="button"
                style={btnSecondary}
                onClick={() => importRef.current?.click()}
              >
                Select File
              </button>
              <input
                ref={importRef}
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={importBackup}
              />
            </>
          }
        />
        <ActionRow
          title="Clear Journal"
          desc="Remove all trades from this browser (cannot be undone)"
          button={
            confirmClear ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={btnDanger} onClick={clearTrades}>
                  Confirm Delete
                </button>
                <button
                  type="button"
                  style={btnSecondary}
                  onClick={() => setConfirmClear(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" style={btnDanger} onClick={clearTrades}>
                Clear All Trades
              </button>
            )
          }
        />
      </div>

      <div>
        <label style={label}>Profile Visibility</label>
        <div style={{ display: "flex", gap: 8 }}>
          {(["public", "private"] as const).map((v) => (
            <button
              key={v}
              type="button"
              disabled={busy}
              onClick={() => saveVisibility(v)}
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                textTransform: "capitalize",
                background: visibility === v ? "rgba(99,102,241,0.15)" : "#0a0a0f",
                border: visibility === v ? "1px solid #6366f1" : "1px solid #2a2a2a",
                color: visibility === v ? "#6366f1" : "#9ca3af",
                cursor: busy ? "wait" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              {v}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>
          Public profiles appear in the Traders directory and leaderboard.
        </div>
      </div>
    </section>
  );
}

function ActionRow({
  title,
  desc,
  button,
}: {
  title: string;
  desc: string;
  button: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 16px",
        background: "#0a0a0f",
        border: "1px solid #2a2a2a",
        borderRadius: 8,
        gap: 14,
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{title}</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>{desc}</div>
      </div>
      <div style={{ flexShrink: 0 }}>{button}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DANGER ZONE
// ═══════════════════════════════════════════════════════════════
function DangerSection({ username }: { username: string }) {
  const [confirmTrades, setConfirmTrades] = useState(false);
  const [confirmAccount, setConfirmAccount] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [flash, setFlash] = useState<{ msg: string; kind: "success" | "error" | "info" }>({
    msg: "",
    kind: "info",
  });

  const deleteAllTrades = async () => {
    if (!confirmTrades) {
      setConfirmTrades(true);
      return;
    }
    try {
      localStorage.removeItem(tradesKey(username));
      try {
        const supaId =
          typeof window !== "undefined"
            ? localStorage.getItem("nexyru_supabase_user_id")
            : null;
        if (supaId) {
          await supabase.from("trade_posts").delete().eq("user_id", supaId);
        }
      } catch {}
      setConfirmTrades(false);
      setFlash({ msg: "All trades deleted from local + Supabase", kind: "success" });
    } catch (e) {
      setFlash({ msg: (e as Error).message, kind: "error" });
    }
  };

  const deleteAccount = () => {
    if (!confirmAccount) {
      setConfirmAccount(true);
      return;
    }
    setFlash({
      msg: "Contact support to delete your account: support@nexyru.com",
      kind: "info",
    });
    setConfirmAccount(false);
  };

  const resetSettings = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("nexyru_") && k !== "nexyru_supabase_user_id") {
          keys.push(k);
        }
      }
      keys.forEach((k) => localStorage.removeItem(k));
      setConfirmReset(false);
      setFlash({ msg: `Reset ${keys.length} settings`, kind: "success" });
    } catch (e) {
      setFlash({ msg: (e as Error).message, kind: "error" });
    }
  };

  return (
    <section
      style={{
        ...card,
        border: "1px solid rgba(239,68,68,0.4)",
      }}
    >
      <div style={{ ...sectionTitle, color: "#ef4444" }}>Danger Zone</div>

      <FlashMsg msg={flash.msg} kind={flash.kind} />

      <div style={{ display: "grid", gap: 12 }}>
        <DangerRow
          title="Delete All Trades"
          desc="Permanently clears every trade from local storage and Supabase"
          confirm={confirmTrades}
          onAction={deleteAllTrades}
          onCancel={() => setConfirmTrades(false)}
          actionLabel="Delete Trades"
        />
        <DangerRow
          title="Delete Account"
          desc="Permanently delete your account and all associated data"
          confirm={confirmAccount}
          onAction={deleteAccount}
          onCancel={() => setConfirmAccount(false)}
          actionLabel="Delete Account"
        />
        <DangerRow
          title="Reset All Settings"
          desc="Clears profile, preferences, and notification settings — keeps session"
          confirm={confirmReset}
          onAction={resetSettings}
          onCancel={() => setConfirmReset(false)}
          actionLabel="Reset Settings"
        />
      </div>
    </section>
  );
}

function DangerRow({
  title,
  desc,
  confirm,
  onAction,
  onCancel,
  actionLabel,
}: {
  title: string;
  desc: string;
  confirm: boolean;
  onAction: () => void;
  onCancel: () => void;
  actionLabel: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 16px",
        background: "#0a0a0f",
        border: "1px solid rgba(239,68,68,0.2)",
        borderRadius: 8,
        gap: 14,
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{title}</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>{desc}</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {confirm ? (
          <>
            <button
              type="button"
              style={{ ...btnDanger, background: "#ef4444", color: "#fff" }}
              onClick={onAction}
            >
              Confirm
            </button>
            <button type="button" style={btnSecondary} onClick={onCancel}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" style={btnDanger} onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
