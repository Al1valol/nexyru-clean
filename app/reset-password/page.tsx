"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = "https://xsrcaceydyqytbipvrok.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcmNhY2V5ZHlxeXRiaXB2cm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDg0MjUsImV4cCI6MjA5MzUyNDQyNX0.IfIkjTtAAb0-iZLu8CE-3GgdNGKxSNJKczSAZlQV62A";

const supabase = createClient(SUPA_URL, SUPA_KEY, {
  auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true, flowType: "pkce" },
});

type Strength = { score: number; label: string; color: string };

function scorePassword(pw: string): Strength {
  if (!pw) return { score: 0, label: "", color: "#2a2a3a" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const cap = Math.min(score, 4);
  const labels = ["Very weak", "Weak", "Fair", "Strong", "Excellent"];
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981"];
  return { score: cap, label: labels[cap], color: colors[cap] };
}

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;

    const finalize = async () => {
      // Supabase JS auto-detects the access_token in the URL hash and creates a session.
      // We give it a tick, then check.
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
      } catch {}

      // Check for hash-based recovery error first
      const hash = window.location.hash || "";
      if (hash.includes("error")) {
        const params = new URLSearchParams(hash.slice(1));
        const desc = params.get("error_description") || params.get("error") || "Reset link is invalid or expired";
        if (mounted) {
          setError(desc.replace(/\+/g, " "));
          setReady(true);
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setHasSession(!!data.session);
      if (!data.session) {
        setError("Reset link is invalid or expired. Please request a new one.");
      }
      setReady(true);
    };

    finalize();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasSession(!!session);
        setError("");
        setReady(true);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const strength = useMemo(() => scorePassword(password), [password]);

  const submit = async () => {
    setError("");
    setInfo("");
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setError(err.message || "Could not update password");
        setLoading(false);
        return;
      }
      setDone(true);
      setInfo("Password updated! Redirecting…");
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1200);
    } catch (e) {
      setError((e as Error).message || "Something went wrong");
      setLoading(false);
    }
  };

  const card: React.CSSProperties = {
    background: "linear-gradient(135deg,#111118,#111118)",
    border: "1px solid #2a2a3a",
    borderRadius: 24,
    padding: "36px 32px",
  };
  const input: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    background: "#1a1a24",
    border: "1px solid #2a2a3a",
    color: "#ffffff",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };
  const label: React.CSSProperties = {
    display: "block",
    fontSize: 10,
    fontWeight: 700,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 6,
  };

  const canSubmit = hasSession && !done;

  return (
    <div style={{ minHeight: "100vh", background: "#060d1a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,sans-serif", padding: 20 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 34, fontWeight: 900, color: "#ffffff", margin: "0 0 6px", letterSpacing: "-0.03em" }}>Nexyru</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Your trading journal & performance hub</p>
        </div>

        <div style={card}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", textAlign: "center", margin: "0 0 6px" }}>
            Reset your password
          </h2>
          <p style={{ fontSize: 13, color: "#6b7280", textAlign: "center", margin: "0 0 24px" }}>
            Choose a new password for your account
          </p>

          {!ready ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
              <span style={{ width: 24, height: 24, border: "3px solid #2a2a3a", borderTopColor: "#6366f1", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={label}>New password</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && canSubmit && submit()}
                    placeholder="••••••••"
                    style={input}
                    disabled={!canSubmit}
                  />
                  {password && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            style={{
                              flex: 1,
                              height: 4,
                              borderRadius: 2,
                              background: i < strength.score ? strength.color : "#2a2a3a",
                              transition: "background 0.2s",
                            }}
                          />
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: strength.color, fontWeight: 600 }}>{strength.label}</div>
                    </div>
                  )}
                </div>
                <div>
                  <label style={label}>Confirm password</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && canSubmit && submit()}
                    placeholder="••••••••"
                    style={input}
                    disabled={!canSubmit}
                  />
                </div>
              </div>

              {error && (
                <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 12, color: "#ef4444" }}>
                  {error}
                </div>
              )}
              {info && !error && (
                <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", fontSize: 12, color: "#22c55e" }}>
                  {info}
                </div>
              )}

              <button
                onClick={submit}
                disabled={!canSubmit || loading}
                style={{
                  width: "100%",
                  marginTop: 18,
                  padding: "13px 20px",
                  borderRadius: 12,
                  border: "none",
                  background: !canSubmit || loading ? "#3a3a4a" : "#6366f1",
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: !canSubmit || loading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  boxShadow: !canSubmit || loading ? "none" : "0 4px 20px rgba(99,102,241,0.25)",
                }}
              >
                {loading && (
                  <span style={{ width: 16, height: 16, border: "2px solid #2a2a3a", borderTopColor: "#ffffff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                )}
                {loading ? "Updating…" : done ? "Password updated!" : "Update password"}
              </button>

              {!hasSession && (
                <a
                  href="/login"
                  style={{
                    display: "block",
                    textAlign: "center",
                    marginTop: 14,
                    padding: "8px",
                    color: "#9ca3af",
                    fontSize: 12,
                    textDecoration: "none",
                  }}
                >
                  Request a new <span style={{ color: "#6366f1", fontWeight: 700 }}>reset link</span>
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
