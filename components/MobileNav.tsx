"use client";

import { usePathname } from "next/navigation";

const TAB_ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const Icons = {
  overview: (
    <svg {...TAB_ICON_PROPS}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  ),
  trades: (
    <svg {...TAB_ICON_PROPS}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  calendar: (
    <svg {...TAB_ICON_PROPS}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M3 10h18" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
    </svg>
  ),
  gear: (
    <svg {...TAB_ICON_PROPS}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

const ACTIVE = "#6366f1";
const INACTIVE = "#6b7280";

function TabLink({
  label,
  icon,
  href,
  active,
}: {
  label: string;
  icon: React.ReactNode;
  href: string;
  active: boolean;
}) {
  const color = active ? ACTIVE : INACTIVE;
  return (
    <a
      href={href}
      aria-label={label}
      style={{
        flex: 1,
        textDecoration: "none",
        color,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.02em",
        minWidth: 0,
      }}
    >
      {icon}
      {label}
    </a>
  );
}

export default function MobileNav(_props: { activePath?: string }) {
  const pathname = usePathname();
  const onSettings = pathname === "/settings";

  return (
    <>
      <nav
        className="nx-mobile-nav"
        aria-label="Primary"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: 60,
          background: "#0f0f14",
          borderTop: "1px solid #1e1e2a",
          display: "none",
          alignItems: "stretch",
          zIndex: 9999,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <TabLink label="Overview" icon={Icons.overview} href="/dashboard" active={false} />
        <TabLink label="Trades" icon={Icons.trades} href="/dashboard" active={false} />
        <TabLink label="Calendar" icon={Icons.calendar} href="/dashboard" active={false} />
        <TabLink label="Settings" icon={Icons.gear} href="/settings" active={onSettings} />
      </nav>
      <style>{`
        @media (max-width: 767px) {
          .nx-mobile-nav { display: flex !important; }
        }
      `}</style>
    </>
  );
}
