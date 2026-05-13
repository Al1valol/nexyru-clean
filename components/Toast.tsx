"use client";

import React, { useEffect, useRef, useState } from "react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  exiting: boolean;
}

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: "rgba(52,211,153,0.08)",  border: "#10b981", text: "#10b981", icon: "✓" },
  error:   { bg: "rgba(248,113,113,0.08)", border: "#ef4444", text: "#ef4444", icon: "✕" },
  warning: { bg: "rgba(245,158,11,0.08)",  border: "#f59e0b", text: "#f59e0b", icon: "" },
  info:    { bg: "rgba(99,102,241,0.08)",  border: "#6366f1", text: "#6366f1", icon: "i" },
};

declare global {
  interface Window {
    showToast?: (message: string, type?: ToastType) => void;
  }
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.showToast = (message: string, type: ToastType = "info") => {
      const id = ++idRef.current;
      setToasts(prev => {
        const next = [...prev, { id, message, type, exiting: false }];
        return next.length > 3 ? next.slice(-3) : next;
      });
      setTimeout(() => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
      }, 3000);
    };
    return () => { delete window.showToast; };
  }, []);

  const dismiss = (id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
  };

  return (
    <><style>{`
        @keyframes nexyruToastIn  { from { transform: translateX(120%); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        @keyframes nexyruToastOut { from { transform: translateX(0);   opacity: 1 } to { transform: translateX(120%); opacity: 0 } }
        .nexyru-toast { animation: nexyruToastIn 0.25s ease-out forwards; }
        .nexyru-toast.exiting { animation: nexyruToastOut 0.3s ease-in forwards; }
      `}</style><div style={{ position:"fixed", bottom:20, right:20, zIndex:9999, display:"flex", flexDirection:"column", gap:10, pointerEvents:"none" }}>
        {toasts.map(t => {
          const c = TOAST_COLORS[t.type] ?? TOAST_COLORS.info;
          return (
            <div key={t.id} className={`nexyru-toast${t.exiting ? " exiting" : ""}`} style={{
              pointerEvents:"auto",
              minWidth: 260, maxWidth: 380,
              background: "#111118",
              border: "1px solid rgba(30,41,59,0.8)",
              borderLeft: `3px solid ${c.border}`,
              borderRadius: 10,
              padding: "12px 14px",
              boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
              display:"flex", alignItems:"flex-start", gap:10,
              fontSize: 13, color:"#ffffff",
              fontFamily: "system-ui,-apple-system,sans-serif",
            }}><div style={{
                width:20, height:20, borderRadius:"50%",
                background: c.bg, color: c.text,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontWeight:800, fontSize:12, flexShrink:0,
              }}>{c.icon}</div><div style={{ flex:1, lineHeight:1.4, paddingTop:1 }}>{t.message}</div><button onClick={() => dismiss(t.id)} style={{
                background:"transparent", border:"none", cursor:"pointer",
                color:"#6b7280", padding:0, fontSize:14, lineHeight:1,
                marginTop:1, flexShrink:0,
              }} aria-label="Dismiss">✕</button></div>
          );
        })}
      </div></>
  );
}
