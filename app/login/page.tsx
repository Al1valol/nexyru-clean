"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = "https://xsrcaceydyqytbipvrok.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzcmNhY2V5ZHlxeXRiaXB2cm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDg0MjUsImV4cCI6MjA5MzUyNDQyNX0.IfIkjTtAAb0-iZLu8CE-3GgdNGKxSNJKczSAZlQV62A";

const supabase = createClient(SUPA_URL, SUPA_KEY);

type Step = "signin" | "signup" | "verify" | "forgot" | "forgot-sent";

const SITE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://www.nexyru.com";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [resending, setResending] = useState(false);

  const persistSession = (user: { id?: string | null; email?: string | null; user_metadata?: Record<string, unknown> | null } | null) => {
    if (!user?.email) return;
    const username = user.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() || `user${Date.now().toString(36)}`;
    const displayName =
      (user.user_metadata && (user.user_metadata as Record<string, unknown>).full_name as string | undefined) ||
      (user.user_metadata && (user.user_metadata as Record<string, unknown>).name as string | undefined) ||
      username;
    const s = {
      username,
      displayName,
      email: user.email,
      googleAuth: true,
      supabaseUserId: user.id ?? null,
    };
    try {
      localStorage.setItem("tradedesk_session_v1", JSON.stringify(s));
      if (user.id) localStorage.setItem(`nexyru_supabase_user_id`, user.id);
    } catch {}
  };

  const submit = async () => {
    setError("");
    setInfo("");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      if (step === "signin") {
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (err) {
          const msg = err.message?.toLowerCase() ?? "";
          if (msg.includes("not confirmed") || msg.includes("email not")) {
            setError("Please verify your email before signing in");
          } else if (msg.includes("invalid") || msg.includes("credentials")) {
            setError("Invalid email or password");
          } else {
            setError(err.message || "Sign in failed");
          }
          setLoading(false);
          return;
        }
        persistSession(data.user);
        window.location.href = "/dashboard";
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: `${SITE_URL}/auth/callback?next=/dashboard`,
          },
        });
        if (err) {
          const msg = err.message?.toLowerCase() ?? "";
          if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
            setError("Email already in use");
          } else if (msg.includes("password")) {
            setError("Password must be at least 6 characters");
          } else {
            setError(err.message || "Sign up failed");
          }
          setLoading(false);
          return;
        }
        const user = data.user;
        if (user?.id) {
          try {
            await fetch(`${SUPA_URL}/rest/v1/profiles`, {
              method: "POST",
              headers: {
                apikey: SUPA_KEY,
                Authorization: `Bearer ${SUPA_KEY}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal,resolution=ignore-duplicates",
              },
              body: JSON.stringify({
                id: user.id,
                email: cleanEmail,
                username: cleanEmail.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase(),
                created_at: new Date().toISOString(),
              }),
            });
          } catch {}
        }
        if (data.session) {
          persistSession(user);
          window.location.href = "/dashboard";
        } else {
          setStep("verify");
          setLoading(false);
        }
      }
    } catch (e) {
      setError((e as Error).message || "Something went wrong");
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    setError("");
    setInfo("");
    setResending(true);
    try {
      const { error: err } = await supabase.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: `${SITE_URL}/auth/callback?next=/dashboard` },
      });
      if (err) {
        setError(err.message || "Could not resend email");
      } else {
        setInfo("Verification email sent. Please check your inbox.");
      }
    } catch (e) {
      setError((e as Error).message || "Could not resend email");
    } finally {
      setResending(false);
    }
  };

  const sendResetLink = async () => {
    setError("");
    setInfo("");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${SITE_URL}/auth/callback?type=recovery`,
      });
      if (err) {
        setError(err.message || "Could not send reset email");
        setLoading(false);
        return;
      }
      setStep("forgot-sent");
      setLoading(false);
    } catch (e) {
      setError((e as Error).message || "Something went wrong");
      setLoading(false);
    }
  };

  const signInGoogle = () => {
    setGoogleLoading(true);
    window.location.href = "/auth/signin";
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
  const primaryBtn = (busy: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "13px 20px",
    borderRadius: 12,
    border: "none",
    background: busy ? "#3a3a4a" : "#6366f1",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 700,
    cursor: busy ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    boxShadow: busy ? "none" : "0 4px 20px rgba(99,102,241,0.25)",
  });
  const linkBtn: React.CSSProperties = {
    width: "100%",
    marginTop: 12,
    padding: "8px",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "#9ca3af",
    fontSize: 12,
    cursor: "pointer",
  };

  const renderError = () =>
    error ? (
      <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", fontSize: 12, color: "#ef4444" }}>
        {error}
      </div>
    ) : null;
  const renderInfo = () =>
    info && !error ? (
      <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", fontSize: 12, color: "#a5b4fc" }}>
        {info}
      </div>
    ) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#060d1a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui,sans-serif", padding: 20 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 34, fontWeight: 900, color: "#ffffff", margin: "0 0 6px", letterSpacing: "-0.03em" }}>Nexyru</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Your trading journal & performance hub</p>
        </div>

        {(step === "signin" || step === "signup") && (
          <div style={card}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", textAlign: "center", margin: "0 0 6px" }}>
              {step === "signin" ? "Welcome back" : "Create your account"}
            </h2>
            <p style={{ fontSize: 13, color: "#6b7280", textAlign: "center", margin: "0 0 24px" }}>
              {step === "signin" ? "Sign in to access your trades and insights" : "Sign up to start tracking your trading"}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={label}>Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="you@example.com"
                  style={input}
                />
              </div>
              <div>
                <label style={label}>Password</label>
                <input
                  type="password"
                  autoComplete={step === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="••••••••"
                  style={input}
                />
              </div>
            </div>

            {renderError()}
            {renderInfo()}

            <button onClick={submit} disabled={loading} style={{ ...primaryBtn(loading), marginTop: 18 }}>
              {loading && (
                <span style={{ width: 16, height: 16, border: "2px solid #2a2a3a", borderTopColor: "#ffffff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
              )}
              {loading ? "Please wait…" : step === "signin" ? "Sign in" : "Sign up"}
            </button>

            {step === "signin" && (
              <button
                onClick={() => {
                  setError("");
                  setInfo("");
                  setStep("forgot");
                }}
                style={{ ...linkBtn, marginTop: 10, color: "#6366f1", fontWeight: 600 }}
              >
                Forgot password?
              </button>
            )}

            <button
              onClick={() => {
                setError("");
                setInfo("");
                setStep((s) => (s === "signin" ? "signup" : "signin"));
              }}
              style={linkBtn}
            >
              {step === "signin" ? (
                <>Don&apos;t have an account? <span style={{ color: "#6366f1", fontWeight: 700 }}>Sign up</span></>
              ) : (
                <>Already have an account? <span style={{ color: "#6366f1", fontWeight: 700 }}>Sign in</span></>
              )}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 18px" }}>
              <div style={{ flex: 1, height: 1, background: "#2a2a3a" }} />
              <span style={{ fontSize: 11, color: "#6b7280" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "#2a2a3a" }} />
            </div>

            <button
              onClick={signInGoogle}
              disabled={googleLoading}
              style={{
                width: "100%",
                padding: "13px 20px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 700,
                cursor: googleLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
              }}
            >
              {googleLoading ? (
                <span style={{ width: 20, height: 20, border: "2px solid #2a2a3a", borderTopColor: "#6366f1", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              {googleLoading ? "Redirecting…" : "Continue with Google"}
            </button>
          </div>
        )}

        {step === "verify" && (
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", textAlign: "center", margin: "0 0 10px" }}>
              Check your email
            </h2>
            <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", margin: "0 0 20px", lineHeight: 1.5 }}>
              We sent a verification link to <span style={{ color: "#ffffff", fontWeight: 600 }}>{email}</span>. Click the link to activate your account.
            </p>

            {renderError()}
            {renderInfo()}

            <button onClick={resendVerification} disabled={resending} style={{ ...primaryBtn(resending), marginTop: 18 }}>
              {resending && (
                <span style={{ width: 16, height: 16, border: "2px solid #2a2a3a", borderTopColor: "#ffffff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
              )}
              {resending ? "Sending…" : "Resend email"}
            </button>

            <button
              onClick={() => {
                setError("");
                setInfo("");
                setStep("signin");
              }}
              style={linkBtn}
            >
              Back to <span style={{ color: "#6366f1", fontWeight: 700 }}>sign in</span>
            </button>
          </div>
        )}

        {step === "forgot" && (
          <div style={card}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", textAlign: "center", margin: "0 0 6px" }}>
              Reset your password
            </h2>
            <p style={{ fontSize: 13, color: "#6b7280", textAlign: "center", margin: "0 0 24px" }}>
              Enter your email and we&apos;ll send you a reset link
            </p>

            <div>
              <label style={label}>Email</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendResetLink()}
                placeholder="you@example.com"
                style={input}
              />
            </div>

            {renderError()}
            {renderInfo()}

            <button onClick={sendResetLink} disabled={loading} style={{ ...primaryBtn(loading), marginTop: 18 }}>
              {loading && (
                <span style={{ width: 16, height: 16, border: "2px solid #2a2a3a", borderTopColor: "#ffffff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
              )}
              {loading ? "Sending…" : "Send reset link"}
            </button>

            <button
              onClick={() => {
                setError("");
                setInfo("");
                setStep("signin");
              }}
              style={linkBtn}
            >
              Back to <span style={{ color: "#6366f1", fontWeight: 700 }}>sign in</span>
            </button>
          </div>
        )}

        {step === "forgot-sent" && (
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", textAlign: "center", margin: "0 0 10px" }}>
              Check your email
            </h2>
            <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", margin: "0 0 20px", lineHeight: 1.5 }}>
              We sent a password reset link to <span style={{ color: "#ffffff", fontWeight: 600 }}>{email}</span>.
            </p>

            <button
              onClick={() => {
                setError("");
                setInfo("");
                setStep("signin");
              }}
              style={{ ...primaryBtn(false), marginTop: 8 }}
            >
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
