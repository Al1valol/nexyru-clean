"use client";

import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { useUserPlan } from "@/lib/plan";

interface ProGateProps {
  feature: string;
  children?: React.ReactNode;
  fallback?: React.ReactNode;
}

function UpgradeCard({ feature }: { feature: string }) {
  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #1e1e2a",
        borderRadius: 12,
        padding: 24,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
        {feature} is a Pro feature
      </div>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
        Upgrade to Nexyru Pro to unlock this and all other features
      </div>
      <a
        href="/pricing"
        style={{
          display: "inline-block",
          padding: "10px 20px",
          borderRadius: 8,
          background: "#6366f1",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Upgrade to Pro →
      </a>
    </div>
  );
}

export default function ProGate({ feature, children, fallback }: ProGateProps) {
  const plan = useUserPlan();
  if (plan !== "free") return <>{children}</>;
  return <>{fallback ?? <UpgradeCard feature={feature} />}</>;
}

// Full-page variant that keeps Sidebar + MobileNav around the upgrade card.
// Use as the only return when a page is Pro-gated.
export function ProGatePage({ feature, activePath }: { feature: string; activePath?: string }) {
  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <Sidebar activePath={activePath} />
      <MobileNav />
      <main
        className="main-with-sidebar"
        style={{
          maxWidth: 560,
          margin: "0 auto",
          padding: "80px 24px 96px",
        }}
      >
        <UpgradeCard feature={feature} />
      </main>
    </div>
  );
}
