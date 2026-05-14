"use client";

import { useEffect, useState } from "react";

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
  dashboard: (
    <svg {...TAB_ICON_PROPS}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  journal: (
    <svg {...TAB_ICON_PROPS}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  notes: (
    <svg {...TAB_ICON_PROPS}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  ),
  tools: (
    <svg {...TAB_ICON_PROPS}>
      <circle cx="5" cy="5" r="1.5" />
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="19" cy="5" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
      <circle cx="5" cy="19" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
      <circle cx="19" cy="19" r="1.5" />
    </svg>
  ),
  profile: (
    <svg {...TAB_ICON_PROPS}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  challenge: (
    <svg {...TAB_ICON_PROPS}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </svg>
  ),
  psychology: (
    <svg {...TAB_ICON_PROPS}>
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  ),
  target: (
    <svg {...TAB_ICON_PROPS}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  checklist: (
    <svg {...TAB_ICON_PROPS}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  bell: (
    <svg {...TAB_ICON_PROPS}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  play: (
    <svg {...TAB_ICON_PROPS}>
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  ),
  chart: (
    <svg {...TAB_ICON_PROPS}>
      <line x1="3" y1="21" x2="21" y2="21" />
      <line x1="7" y1="21" x2="7" y2="13" />
      <line x1="12" y1="21" x2="12" y2="9" />
      <line x1="17" y1="21" x2="17" y2="5" />
    </svg>
  ),
  flask: (
    <svg {...TAB_ICON_PROPS}>
      <path d="M9 2v6L3.5 18.5A2 2 0 0 0 5.3 21.5h13.4a2 2 0 0 0 1.8-3L15 8V2" />
      <path d="M8 2h8" />
      <path d="M6 14h12" />
    </svg>
  ),
};

type ToolItem = { label: string; href: string; icon: React.ReactNode };

const TOOLS: ToolItem[] = [
  { label: "Challenge", href: "/challenge", icon: Icons.challenge },
  { label: "Psychology", href: "/psychology", icon: Icons.psychology },
  { label: "Best Setups", href: "/setups", icon: Icons.target },
  { label: "Checklist", href: "/checklist", icon: Icons.checklist },
  { label: "Alerts", href: "/alerts", icon: Icons.bell },
  { label: "Trade Review", href: "/replay", icon: Icons.play },
  { label: "Insights", href: "/dashboard?tab=insights", icon: Icons.chart },
  { label: "Strategy Lab", href: "/dashboard?tab=stratlab", icon: Icons.flask },
];

function isActiveHref(path: string | undefined, href: string): boolean {
  if (!path) return false;
  if (href === path) return true;
  // Treat /dashboard active for any /dashboard path that isn't journal/insights/stratlab
  if (
    href === "/dashboard" &&
    path.startsWith("/dashboard") &&
    !path.includes("tab=journal") &&
    !path.includes("tab=insights") &&
    !path.includes("tab=stratlab")
  ) {
    return true;
  }
  return false;
}

function isToolsActive(path?: string): boolean {
  if (!path) return false;
  return TOOLS.some((t) => path === t.href || path.startsWith(t.href.split("?")[0]));
}

function ToolsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setDragY(0);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.2s ease",
          zIndex: 199,
        }}
        aria-hidden={!open}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tools"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          background: "#0f0f14",
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderTop: "1px solid #1e1e2a",
          padding: "8px 16px 24px",
          transform: open
            ? `translateY(${dragY}px)`
            : "translateY(100%)",
          transition: touchStartY ? "none" : "transform 0.25s ease",
          zIndex: 200,
          boxShadow: "0 -20px 50px rgba(0,0,0,0.4)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
        onTouchStart={(e) => setTouchStartY(e.touches[0].clientY)}
        onTouchMove={(e) => {
          if (touchStartY != null) {
            const delta = e.touches[0].clientY - touchStartY;
            if (delta > 0) setDragY(delta);
          }
        }}
        onTouchEnd={() => {
          if (dragY > 80) {
            onClose();
          } else {
            setDragY(0);
          }
          setTouchStartY(null);
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 999,
            background: "#2a2a3a",
            margin: "8px auto 16px",
          }}
        />
        <div
          style={{
            fontSize: 12,
            color: "#6b7280",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 700,
            marginBottom: 14,
            padding: "0 4px",
          }}
        >
          All Tools
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          {TOOLS.map((t) => (
            <a
              key={t.href}
              href={t.href}
              onClick={onClose}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 10,
                padding: "16px 14px",
                background: "#15151e",
                border: "1px solid #1e1e2a",
                borderRadius: 12,
                color: "#fff",
                textDecoration: "none",
                minHeight: 88,
              }}
            >
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: "rgba(99,102,241,0.12)",
                  color: "#6366f1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {t.icon}
              </span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{t.label}</span>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}

function TabButton({
  label,
  icon,
  href,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  href?: string;
  active: boolean;
  onClick?: () => void;
}) {
  const color = active ? "var(--accent)" : "#6b7280";
  const content = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        color,
        height: "100%",
        flex: 1,
        textDecoration: "none",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        minWidth: 0,
      }}
    >
      {icon}
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.02em" }}>
        {label}
      </span>
    </div>
  );
  if (onClick) {
    return (
      <button
        onClick={onClick}
        aria-label={label}
        data-compact="true"
        style={{
          flex: 1,
          background: "none",
          border: "none",
          padding: 0,
          color,
          minHeight: 0,
          height: "100%",
          cursor: "pointer",
        }}
      >
        {content}
      </button>
    );
  }
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
      }}
    >
      {content}
    </a>
  );
}

export default function MobileNav({ activePath }: { activePath?: string }) {
  const [toolsOpen, setToolsOpen] = useState(false);

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
          height: 56,
          background: "#0f0f14",
          borderTop: "1px solid #1e1e2a",
          display: "none",
          alignItems: "center",
          zIndex: 90,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <TabButton
          label="Dashboard"
          icon={Icons.dashboard}
          href="/dashboard"
          active={isActiveHref(activePath, "/dashboard")}
        />
        <TabButton
          label="Journal"
          icon={Icons.journal}
          href="/dashboard?tab=journal"
          active={activePath === "/dashboard?tab=journal"}
        />
        <TabButton
          label="Notes"
          icon={Icons.notes}
          href="/notes"
          active={activePath === "/notes"}
        />
        <TabButton
          label="Tools"
          icon={Icons.tools}
          onClick={() => setToolsOpen(true)}
          active={toolsOpen || isToolsActive(activePath)}
        />
        <TabButton
          label="Settings"
          icon={Icons.profile}
          href="/settings"
          active={activePath === "/settings"}
        />
      </nav>
      <ToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} />
      <style>{`
        @media (max-width: 767px) {
          .nx-mobile-nav { display: flex !important; }
        }
      `}</style>
    </>
  );
}
