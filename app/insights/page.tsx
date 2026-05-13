"use client";
import { useEffect } from "react";
export default function InsightsRedirect() {
  useEffect(() => { window.location.href = "/dashboard?tab=insights"; }, []);
  return (
    <div style={{ minHeight:"100vh", background:"#060d1a", display:"flex", alignItems:"center", justifyContent:"center", color:"#2a2a3a", fontSize:14 }}>Redirecting to Insights…</div>
  );
}