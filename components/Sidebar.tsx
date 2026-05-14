"use client";

import { useEffect, useState } from "react";

const ICON_PROPS = {
  width: "20",
  height: "20",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.5",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS = {
  dashboard: (
    <svg {...ICON_PROPS}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  journal: (
    <svg {...ICON_PROPS}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  trophy: (
    <svg {...ICON_PROPS}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </svg>
  ),
  brain: (
    <svg {...ICON_PROPS}>
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  ),
  target: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  checklist: (
    <svg {...ICON_PROPS}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  lightning: (
    <svg {...ICON_PROPS}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  bell: (
    <svg {...ICON_PROPS}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  play: (
    <svg {...ICON_PROPS}>
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  ),
  flask: (
    <svg {...ICON_PROPS}>
      <path d="M9 2v6L3.5 18.5A2 2 0 0 0 5.3 21.5h13.4a2 2 0 0 0 1.8-3L15 8V2" />
      <path d="M8 2h8" />
      <path d="M6 14h12" />
    </svg>
  ),
  chart: (
    <svg {...ICON_PROPS}>
      <line x1="3" y1="21" x2="21" y2="21" />
      <line x1="7" y1="21" x2="7" y2="13" />
      <line x1="12" y1="21" x2="12" y2="9" />
      <line x1="17" y1="21" x2="17" y2="5" />
    </svg>
  ),
  gear: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

function SidebarItem({
  icon,
  label,
  href,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  active: boolean;
}) {
  const [hover, setHover] = useState(false);
  const bg = active ? "#1e1e2a" : hover ? "#1a1a24" : "transparent";
  const color = active ? "var(--accent)" : hover ? "#ffffff" : "#6b7280";
  return (
    <div
      style={{ position: "relative", display: "flex", justifyContent: "center" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <a
        href={href}
        aria-label={label}
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: bg,
          border: "none",
          borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
          paddingLeft: active ? 0 : 2,
          cursor: "pointer",
          color,
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.15s, color 0.15s",
        }}
      >
        {icon}
      </a>
      {hover && (
        <span
          style={{
            position: "absolute",
            left: 48,
            top: "50%",
            transform: "translateY(-50%)",
            background: "#1e1e2a",
            border: "1px solid #2a2a3a",
            borderRadius: 6,
            padding: "4px 10px",
            fontSize: 12,
            color: "#fff",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 100,
            boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
            fontWeight: 600,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

function SidebarDivider() {
  return (
    <div
      style={{
        width: 24,
        height: 1,
        background: "#1e1e2a",
        margin: "6px 0",
        flexShrink: 0,
      }}
    />
  );
}

function SidebarGroupLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        width: 40,
        textAlign: "center",
        fontSize: 8,
        color: "#333333",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        fontWeight: 700,
        marginTop: 2,
        marginBottom: 2,
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      {label}
    </div>
  );
}

export default function Sidebar({ activePath }: { activePath?: string }) {
  useEffect(() => {
    try {
      const accent = localStorage.getItem("nexyru_accent") || "#6366f1";
      document.documentElement.style.setProperty("--accent", accent);

      const theme = localStorage.getItem("nexyru_theme") || "dark";
      if (theme === "light") {
        document.documentElement.classList.add("light-mode");
      } else {
        document.documentElement.classList.remove("light-mode");
      }
    } catch {}
  }, []);

  const isActive = (href: string) => activePath === href;

  return (
    <aside
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: 56,
        background: "#0f0f14",
        borderRight: "1px solid #1e1e2a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "10px 0 14px",
        zIndex: 50,
      }}
    >
      <a
        href="/"
        aria-label="Nexyru"
        style={{
          width: 36,
          height: 36,
          borderRadius: 9,
          background: "linear-gradient(135deg,#6366f1,#4f46e5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
          marginBottom: 14,
          flexShrink: 0,
          fontWeight: 900,
          color: "#fff",
          fontSize: 16,
          letterSpacing: "-0.02em",
        }}
      >
        N
      </a>

      <nav
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        {/* Group 1 — Main */}
        <SidebarItem icon={ICONS.dashboard} label="Dashboard" href="/dashboard" active={isActive("/dashboard")} />
        <SidebarItem icon={ICONS.journal} label="Journal" href="/dashboard?tab=journal" active={isActive("/dashboard?tab=journal")} />

        <SidebarDivider />

        {/* Group 2 — Daily */}
        <SidebarGroupLabel label="Daily" />
        <SidebarItem icon={ICONS.checklist} label="Checklist" href="/checklist" active={isActive("/checklist")} />
        <SidebarItem icon={ICONS.bell} label="Alerts" href="/alerts" active={isActive("/alerts")} />
        <SidebarItem icon={ICONS.trophy} label="Challenge" href="/challenge" active={isActive("/challenge")} />

        <SidebarDivider />

        {/* Group 3 — Analyze */}
        <SidebarGroupLabel label="Analyze" />
        <SidebarItem icon={ICONS.brain} label="Psychology" href="/psychology" active={isActive("/psychology")} />
        <SidebarItem icon={ICONS.target} label="Best Setups" href="/setups" active={isActive("/setups")} />
        <SidebarItem icon={ICONS.chart} label="Insights" href="/dashboard?tab=insights" active={isActive("/dashboard?tab=insights")} />
        <SidebarItem icon={ICONS.play} label="Trade Review" href="/replay" active={isActive("/replay")} />

        <SidebarDivider />

        {/* Group 4 — Build */}
        <SidebarGroupLabel label="Build" />
        <SidebarItem icon={ICONS.flask} label="Strategy Lab" href="/dashboard?tab=stratlab" active={isActive("/dashboard?tab=stratlab")} />
      </nav>

      <SidebarItem icon={ICONS.gear} label="Settings" href="/settings" active={isActive("/settings")} />
    </aside>
  );
}
