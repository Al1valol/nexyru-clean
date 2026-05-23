"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import CryptoDashboard from "@/app/dashboard/CryptoDashboard";
import { isAdminEmail } from "@/lib/plan";

const SESSION_KEY = "tradedesk_session_v1";

type Session = {
  username: string;
  displayName?: string;
  email?: string;
  googleAuth?: boolean;
  supabaseUserId?: string | null;
} | null;

export default function CryptoPage() {
  const [session, setSession] = useState<Session>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) setSession(JSON.parse(raw) as Session);
    } catch {}
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return <div style={{ background: "#0a0a0f", minHeight: "100vh" }} />;
  }

  if (!session) {
    return (
      <div style={{ background: "#0a0a0f", color: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <TopNav active="crypto" />
        <div style={{ padding: 40, textAlign: "center", color: "#9aa0aa" }}>
          You need to sign in to view Crypto.{" "}
          <a href="/login" style={{ color: "#a5b4fc", fontWeight: 700 }}>
            Sign in →
          </a>
        </div>
      </div>
    );
  }

  const isAdmin = isAdminEmail(session.email ?? "");

  return (
    <div style={{ background: "#0a0a0f", color: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
        <CryptoDashboard isAdmin={isAdmin} session={session} />
      </div>
    </div>
  );
}

function TopNav({ active }: { active: "trading" | "crypto" | "sports" | "options" }) {
  const links = [
    { id: "trading" as const, label: "📈 Trading", href: "/dashboard" },
    { id: "crypto" as const, label: "🪙 Crypto", href: "/crypto" },
    { id: "sports" as const, label: "🎰 Sports", href: "/sports" },
    { id: "options" as const, label: "📊 Options", href: "/options" },
  ];
  return (
    <header
      style={{
        height: 48,
        background: "#0a0a0f",
        borderBottom: "1px solid #1e1e2a",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 10,
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <a
        href="/dashboard"
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: "#ffffff",
          letterSpacing: "-0.01em",
          textDecoration: "none",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        Nexyru
      </a>
      <nav style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: 2, minWidth: 0 }}>
        {links.map((n) => {
          const isActive = n.id === active;
          return (
            <a
              key={n.id}
              href={n.href}
              style={{
                padding: "6px 14px",
                color: isActive ? "#ffffff" : "#6b7280",
                fontSize: 12,
                fontWeight: isActive ? 700 : 600,
                textDecoration: "none",
                borderBottom: isActive ? "2px solid #6366f1" : "2px solid transparent",
                whiteSpace: "nowrap",
                transition: "color 0.15s",
              }}
            >
              {n.label}
            </a>
          );
        })}
      </nav>
      <div style={{ width: 80, flexShrink: 0 }} />
    </header>
  );
}
