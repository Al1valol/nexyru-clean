"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { useUserPlan } from "@/lib/plan";

const FREE_FEATURES = [
  "Trade journal (100 trades)",
  "Challenge tracker (1 account)",
  "Pre-trade checklist",
  "AI strategy builder (1/day)",
  "Screenshot import (3/day)",
  "Trade Review (5 trades)",
  "Sync across devices",
];

const PRO_FEATURES = [
  "Everything in Free, unlimited",
  "Psychology tracker",
  "Best setup finder",
  "Full trade review",
  "Daily notes",
  "All alert types",
  "Advanced insights",
  "CSV export",
  "Multiple challenge accounts",
];

function CheckIcon({ color }: { color: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function PricingPage() {
  const plan = useUserPlan();
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const list: string[] = JSON.parse(localStorage.getItem("nexyru_waitlist") || "[]");
      if (list.length) setJoined(true);
    } catch {}
  }, []);

  const submitWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const value = email.trim().toLowerCase();
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email");
      return;
    }
    try {
      const list: string[] = JSON.parse(localStorage.getItem("nexyru_waitlist") || "[]");
      if (!list.includes(value)) list.push(value);
      localStorage.setItem("nexyru_waitlist", JSON.stringify(list));
      setJoined(true);
      setEmail("");
    } catch {
      setError("Could not save to waitlist");
    }
  };

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <Sidebar activePath="/pricing" />
      <MobileNav />

      <main
        className="main-with-sidebar"
        style={{
          maxWidth: 980,
          margin: "0 auto",
          padding: "56px 24px 96px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>
            Simple, fair pricing
          </h1>
          <p style={{ fontSize: 14, color: "#9ca3af", marginTop: 8 }}>
            Start free. Upgrade when you outgrow the limits.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {/* FREE */}
          <div
            style={{
              background: "#0f0f17",
              border: `1px solid ${plan === "free" ? "rgba(99,102,241,0.45)" : "#1e1e2a"}`,
              borderRadius: 16,
              padding: 28,
              position: "relative",
            }}
          >
            {plan === "free" && (
              <div
                style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: "rgba(99,102,241,0.12)",
                  border: "1px solid rgba(99,102,241,0.35)",
                  color: "#6366f1",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Current
              </div>
            )}
            <div style={{ fontSize: 12, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 8 }}>
              Free
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 20 }}>
              <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em" }}>$0</span>
              <span style={{ fontSize: 13, color: "#6b7280" }}>/forever</span>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {FREE_FEATURES.map((f) => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#d1d5db" }}>
                  <CheckIcon color="#6b7280" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* PRO */}
          <div
            style={{
              background: "linear-gradient(180deg, rgba(99,102,241,0.06), #0f0f17)",
              border: "1px solid rgba(99,102,241,0.4)",
              borderRadius: 16,
              padding: 28,
              position: "relative",
              boxShadow: "0 10px 40px rgba(99,102,241,0.08)",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                fontSize: 9,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 999,
                background: "rgba(245,158,11,0.12)",
                border: "1px solid rgba(245,158,11,0.3)",
                color: "#f59e0b",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Coming soon
            </div>
            <div style={{ fontSize: 12, color: "#a5b4fc", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 8 }}>
              Pro
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 20 }}>
              <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em" }}>$19</span>
              <span style={{ fontSize: 13, color: "#6b7280" }}>/month</span>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 22px", display: "flex", flexDirection: "column", gap: 10 }}>
              {PRO_FEATURES.map((f) => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#e5e7eb" }}>
                  <CheckIcon color="#6366f1" />
                  {f}
                </li>
              ))}
            </ul>

            {joined ? (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(34,197,94,0.08)",
                  border: "1px solid rgba(34,197,94,0.25)",
                  color: "#22c55e",
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                You're on the list! We'll email when Pro is live.
              </div>
            ) : (
              <form onSubmit={submitWaitlist} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    aria-label="Email for waitlist"
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #2a2a3a",
                      background: "#0a0a0f",
                      color: "#fff",
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: "10px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: "#6366f1",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Join waitlist
                  </button>
                </div>
                {error && <div style={{ fontSize: 12, color: "#ef4444" }}>{error}</div>}
              </form>
            )}
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 32, fontSize: 12, color: "#4b5563" }}>
          Questions? <a href="/contact" style={{ color: "#6366f1", textDecoration: "none" }}>Get in touch</a>
        </p>
      </main>
    </div>
  );
}
