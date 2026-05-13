"use client";
import TradingDashboard from "./tradingdashboard";
import PositionSizeWidget from "@/components/PositionSizeWidget";

export default function DashboardPage() {
  return (
    <>
      <TradingDashboard />
      <PositionSizeWidget />
    </>
  );
}
