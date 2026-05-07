"use client";

import { useEffect, useRef, useCallback } from "react";

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  index: number;
}

interface Trade {
  type: "BUY" | "SELL";
  entryIndex: number;
  exitIndex: number;
  entryPrice: number;
  exitPrice: number;
  expiresAt: number;
}

const VISIBLE = 52;
const CW = 13;
const GAP = 4;
const STEP = CW + GAP;
const CHART_H = 340;
const LOOKAHEAD = 22;
const ENTRY_OFF = 4;

function makeCandle(prev: Candle, idx: number): Candle {
  const drift = (Math.random() - 0.48) * 0.7;
  const vol = 1.0 + Math.random() * 1.6;
  const close = Math.max(50, prev.close + drift + (Math.random() - 0.5) * vol);
  const open = prev.close;
  const high = Math.max(open, close) + Math.random() * vol * 0.7;
  const low = Math.min(open, close) - Math.random() * vol * 0.7;
  return { open, high, low, close, index: idx };
}

function seed(): Candle[] {
  const out: Candle[] = [];
  let c: Candle = { open: 100, high: 101.2, low: 99.1, close: 100.4, index: 0 };
  out.push(c);
  for (let i = 1; i < VISIBLE + LOOKAHEAD + 10; i++) {
    c = makeCandle(c, i);
    out.push(c);
  }
  return out;
}

function buildTrade(candles: Candle[], currentIdx: number): Trade | null {
  const win = candles.slice(-LOOKAHEAD);
  if (win.length < ENTRY_OFF + 4) return null;
  const type: "BUY" | "SELL" = Math.random() > 0.5 ? "BUY" : "SELL";
  const lifespan = 6 + Math.floor(Math.random() * 5);
  const early = win.slice(0, ENTRY_OFF + 2);
  const late = win.slice(ENTRY_OFF + 2);
  if (!late.length) return null;
  if (type === "BUY") {
    let eC = early[0]; for (const c of early) if (c.low < eC.low) eC = c;
    let xC = late[0]; for (const c of late) if (c.high > xC.high) xC = c;
    if (xC.high <= eC.low) return null;
    return { type, entryIndex: eC.index, exitIndex: xC.index, entryPrice: eC.low, exitPrice: xC.high, expiresAt: currentIdx + lifespan };
  } else {
    let eC = early[0]; for (const c of early) if (c.high > eC.high) eC = c;
    let xC = late[0]; for (const c of late) if (c.low < xC.low) xC = c;
    if (xC.low >= eC.high) return null;
    return { type, entryIndex: eC.index, exitIndex: xC.index, entryPrice: eC.high, exitPrice: xC.low, expiresAt: currentIdx + lifespan };
  }
}

function Chart() {
  const svgRef = useRef<SVGSVGElement>(null);
  const state = useRef<{ candles: Candle[]; trade: Trade | null; counter: number }>({ candles: [], trade: null, counter: 0 });
  const rafRef = useRef<number>(0);
  const lastTick = useRef<number>(0);

  const draw = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const { candles, trade } = state.current;
    if (!candles.length) return;
    const W = svg.clientWidth || 860;
    const H = CHART_H;
    const visible = candles.slice(-VISIBLE);
    let minP = Infinity, maxP = -Infinity;
    for (const c of visible) { if (c.low < minP) minP = c.low; if (c.high > maxP) maxP = c.high; }
    const pad = (maxP - minP) * 0.04;
    minP -= pad * 2; maxP += pad * 2;
    const pY = (p: number) => H - 30 - ((p - minP) / (maxP - minP)) * (H - 30);
    const iX = (idx: number) => 10 + (idx - visible[0].index) * STEP + CW / 2;
    const chartH = H - 30;

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const ns = "http://www.w3.org/2000/svg";
    const el = (tag: string, attrs: Record<string, string>) => {
      const e = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      return e;
    };

    const defs = el("defs", {});
    const mkGlow = (id: string, col: string) => {
      const f = el("filter", { id, x: "-60%", y: "-60%", width: "220%", height: "220%" });
      const b = el("feGaussianBlur", { stdDeviation: "2.5", result: "b" });
      const flood = el("feFlood", { "flood-color": col, result: "fc" });
      const comp = el("feComposite", { in: "fc", in2: "b", operator: "in", result: "s" });
      const merge = el("feMerge", {});
      const m1 = el("feMergeNode", { in: "s" }); const m2 = el("feMergeNode", { in: "SourceGraphic" });
      merge.appendChild(m1); merge.appendChild(m2);
      f.appendChild(b); f.appendChild(flood); f.appendChild(comp); f.appendChild(merge);
      return f;
    };
    defs.appendChild(mkGlow("gg", "#22c55e88"));
    defs.appendChild(mkGlow("gr", "#ef444488"));
    defs.appendChild(mkGlow("gp", "#a855f788"));
    svg.appendChild(defs);

    svg.appendChild(el("rect", { x: "0", y: "0", width: String(W), height: String(H), fill: "transparent" }));

    for (let i = 0; i <= 5; i++) {
      const y = (chartH / 5) * i;
      svg.appendChild(el("line", { x1: "0", x2: String(W), y1: String(y), y2: String(y), stroke: "#ffffff07", "stroke-width": "1" }));
      const p = maxP - ((maxP - minP) / 5) * i;
      const t = el("text", { x: String(W - 4), y: String(y - 3), "text-anchor": "end", fill: "#ffffff25", "font-size": "9", "font-family": "monospace" });
      t.textContent = p.toFixed(2); svg.appendChild(t);
    }

    if (trade) {
      const ei = visible.findIndex(c => c.index === trade.entryIndex);
      const xi = visible.findIndex(c => c.index === trade.exitIndex);
      if (ei !== -1 && xi !== -1) {
        const x1 = iX(trade.entryIndex) - CW / 2;
        const x2 = iX(trade.exitIndex) + CW / 2;
        const zc = trade.type === "BUY" ? "#22c55e08" : "#ef444408";
        const zb = trade.type === "BUY" ? "#22c55e20" : "#ef444420";
        svg.appendChild(el("rect", { x: String(x1), y: "0", width: String(x2 - x1), height: String(chartH), fill: zc }));
        for (const xp of [x1, x2])
          svg.appendChild(el("line", { x1: String(xp), x2: String(xp), y1: "0", y2: String(chartH), stroke: zb, "stroke-width": "1", "stroke-dasharray": "3,3" }));
        const ey = pY(trade.entryPrice), xy = pY(trade.exitPrice);
        const elc = trade.type === "BUY" ? "#22c55e" : "#ef4444";
        svg.appendChild(el("line", { x1: String(x1), x2: String(x2), y1: String(ey), y2: String(ey), stroke: elc, "stroke-width": "1", "stroke-dasharray": "4,3", opacity: "0.5" }));
        svg.appendChild(el("line", { x1: String(x1), x2: String(x2), y1: String(xy), y2: String(xy), stroke: "#a855f7", "stroke-width": "1", "stroke-dasharray": "4,3", opacity: "0.5" }));
      }
    }

    for (const c of visible) {
      const x = iX(c.index);
      const up = c.close >= c.open;
      const col = up ? "#22c55e" : "#ef4444";
      const bTop = pY(Math.max(c.open, c.close));
      const bBot = pY(Math.min(c.open, c.close));
      const bH = Math.max(1, bBot - bTop);
      svg.appendChild(el("line", { x1: String(x), x2: String(x), y1: String(pY(c.high)), y2: String(pY(c.low)), stroke: col, "stroke-width": "1.2", opacity: "0.65" }));
      svg.appendChild(el("rect", { x: String(x - CW / 2), y: String(bTop), width: String(CW), height: String(bH), fill: up ? "#22c55e1a" : "#ef44441a", stroke: col, "stroke-width": "1.2", rx: "1" }));
    }

    if (trade) {
      const drawSig = (idx: number, price: number, label: string, above: boolean, col: string, glow: string) => {
        const c = visible.find(v => v.index === idx);
        if (!c) return;
        const cx = iX(idx);
        const cy = pY(price);
        const ts = 5;
        const pts = above
          ? `${cx},${cy + ts * 2} ${cx - ts},${cy + ts * 3.5} ${cx + ts},${cy + ts * 3.5}`
          : `${cx},${cy - ts * 2} ${cx - ts},${cy - ts * 3.5} ${cx + ts},${cy - ts * 3.5}`;
        svg.appendChild(Object.assign(el("polygon", { points: pts, fill: col, filter: `url(#${glow})` })));
        const pw = label.length * 6.5 + 14;
        const ph = 16;
        const px = cx - pw / 2;
        const py = above ? cy + 10 : cy - 10 - ph;
        svg.appendChild(el("rect", { x: String(px), y: String(py), width: String(pw), height: String(ph), rx: "3", fill: col, opacity: "0.12", stroke: col, "stroke-width": "0.8" }));
        const t = el("text", { x: String(cx), y: String(py + ph / 2 + 4), "text-anchor": "middle", fill: col, "font-size": "9", "font-weight": "700", "font-family": "monospace", filter: `url(#${glow})` });
        t.textContent = label; svg.appendChild(t);
      };
      if (trade.type === "BUY") {
        drawSig(trade.entryIndex, trade.entryPrice, "BUY", true, "#22c55e", "gg");
        drawSig(trade.exitIndex, trade.exitPrice, "CLOSE", false, "#a855f7", "gp");
      } else {
        drawSig(trade.entryIndex, trade.entryPrice, "SELL", false, "#ef4444", "gr");
        drawSig(trade.exitIndex, trade.exitPrice, "CLOSE", true, "#a855f7", "gp");
      }
    }

    const last = visible[visible.length - 1];
    if (last) {
      const ly = pY(last.close);
      const lc = last.close >= last.open ? "#22c55e" : "#ef4444";
      svg.appendChild(el("line", { x1: "0", x2: String(W), y1: String(ly), y2: String(ly), stroke: lc, "stroke-width": "0.8", "stroke-dasharray": "3,4", opacity: "0.4" }));
      const bw = 68;
      const bx = W - bw - 2;
      svg.appendChild(el("rect", { x: String(bx), y: String(ly - 9), width: String(bw), height: "18", rx: "3", fill: lc }));
      const bt = el("text", { x: String(bx + bw / 2), y: String(ly + 5), "text-anchor": "middle", fill: "#000", "font-size": "10", "font-weight": "700", "font-family": "monospace" });
      bt.textContent = last.close.toFixed(2); svg.appendChild(bt);
    }

    svg.appendChild(el("rect", { x: "0", y: String(chartH), width: String(W), height: "30", fill: "#0f172a" }));
    svg.appendChild(el("line", { x1: "0", x2: String(W), y1: String(chartH), y2: String(chartH), stroke: "#ffffff0f", "stroke-width": "1" }));
  }, []);

  const tick = useCallback((ts: number) => {
    const interval = 2000 + Math.random() * 1000;
    if (ts - lastTick.current >= interval) {
      lastTick.current = ts;
      const s = state.current;
      const prev = s.candles[s.candles.length - 1];
      const nc = makeCandle(prev, s.counter + 1);
      s.counter = nc.index;
      s.candles = [...s.candles, nc];
      if (s.candles.length > VISIBLE + LOOKAHEAD + 20) s.candles = s.candles.slice(-(VISIBLE + LOOKAHEAD + 10));
      if (!s.trade || s.counter >= s.trade.expiresAt) s.trade = buildTrade(s.candles, s.counter);
      draw();
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [draw]);

  useEffect(() => {
    const candles = seed();
    state.current.candles = candles;
    state.current.counter = candles[candles.length - 1].index;
    state.current.trade = buildTrade(candles, state.current.counter);
    draw();
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick, draw]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  return (
    <svg
      ref={svgRef}
      style={{ display: "block", width: "100%", height: `${CHART_H}px` }}
      xmlns="http://www.w3.org/2000/svg"
    />
  );
}

export default function Page() {
  const scrollToWaitlist = () => {
    document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #020617;
          --bg2: #0a0f1e;
          --card: rgba(255,255,255,0.03);
          --border: rgba(255,255,255,0.07);
          --border-hover: rgba(255,255,255,0.13);
          --green: #22c55e;
          --red: #ef4444;
          --purple: #a855f7;
          --text: #f1f5f9;
          --muted: #64748b;
          --accent: #38bdf8;
        }

        html { scroll-behavior: smooth; }

        body {
          background: var(--bg);
          color: var(--text);
          font-family: 'DM Sans', sans-serif;
          min-height: 100vh;
          overflow-x: hidden;
        }

        /* ── Noise overlay ── */
        body::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
          opacity: 0.025;
          pointer-events: none;
          z-index: 0;
        }

        /* ── Glow orbs ── */
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
        }

        /* ── Nav ── */
        nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 40px;
          height: 64px;
          background: rgba(2,6,23,0.7);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border);
        }

        .nav-logo {
          font-family: 'Syne', sans-serif;
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: var(--text);
        }

        .nav-logo span {
          color: var(--accent);
        }

        .nav-btn {
          background: var(--accent);
          color: #020617;
          border: none;
          border-radius: 8px;
          padding: 9px 20px;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.2s;
        }

        .nav-btn:hover { opacity: 0.85; transform: translateY(-1px); }

        /* ── Section base ── */
        section {
          position: relative;
          z-index: 1;
        }

        /* ── Hero ── */
        .hero {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 120px 24px 80px;
          position: relative;
          overflow: hidden;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: rgba(56,189,248,0.08);
          border: 1px solid rgba(56,189,248,0.2);
          border-radius: 100px;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 500;
          color: var(--accent);
          margin-bottom: 32px;
          letter-spacing: 0.3px;
        }

        .badge-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 6px var(--accent);
          animation: bdot 2s infinite;
        }

        @keyframes bdot {
          0%,100%{opacity:1;} 50%{opacity:0.4;}
        }

        .hero h1 {
          font-family: 'Syne', sans-serif;
          font-size: clamp(44px, 7vw, 88px);
          font-weight: 800;
          line-height: 1.0;
          letter-spacing: -2px;
          color: var(--text);
          margin-bottom: 24px;
          max-width: 900px;
        }

        .hero h1 em {
          font-style: normal;
          background: linear-gradient(135deg, var(--accent), #818cf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero p {
          font-size: clamp(16px, 2vw, 20px);
          color: var(--muted);
          font-weight: 300;
          max-width: 520px;
          line-height: 1.65;
          margin-bottom: 44px;
        }

        .hero-cta {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .btn-primary {
          background: var(--accent);
          color: #020617;
          border: none;
          border-radius: 12px;
          padding: 15px 32px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 0 32px rgba(56,189,248,0.25);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 48px rgba(56,189,248,0.4);
        }

        .btn-secondary {
          background: transparent;
          color: var(--muted);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 14px 28px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px;
          font-weight: 400;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover {
          border-color: var(--border-hover);
          color: var(--text);
        }

        .hero-stats {
          display: flex;
          align-items: center;
          gap: 48px;
          margin-top: 72px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .stat {
          text-align: center;
        }

        .stat-num {
          font-family: 'Syne', sans-serif;
          font-size: 28px;
          font-weight: 700;
          color: var(--text);
          display: block;
        }

        .stat-label {
          font-size: 12px;
          color: var(--muted);
          margin-top: 4px;
          letter-spacing: 0.5px;
        }

        .stat-divider {
          width: 1px;
          height: 40px;
          background: var(--border);
        }

        /* ── Chart section ── */
        .chart-section {
          padding: 80px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .section-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 14px;
        }

        .section-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(28px, 4vw, 46px);
          font-weight: 700;
          letter-spacing: -1px;
          color: var(--text);
          text-align: center;
          margin-bottom: 12px;
        }

        .section-sub {
          font-size: 16px;
          color: var(--muted);
          text-align: center;
          max-width: 500px;
          line-height: 1.6;
          margin-bottom: 48px;
          font-weight: 300;
        }

        .chart-card {
          width: 100%;
          max-width: 1000px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 0 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03);
        }

        .chart-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          background: rgba(255,255,255,0.01);
        }

        .chart-pair {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .pair-name {
          font-family: 'Syne', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: var(--text);
        }

        .live-badge {
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.25);
          border-radius: 100px;
          padding: 3px 10px;
          font-size: 10px;
          font-weight: 600;
          color: #22c55e;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .live-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #22c55e;
          animation: bdot 1.5s infinite;
        }

        .legend-row {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .leg {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 500;
          color: var(--muted);
          font-family: monospace;
        }

        .leg-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
        }

        /* ── Features ── */
        .features-section {
          padding: 80px 24px;
          max-width: 1100px;
          margin: 0 auto;
          width: 100%;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
          margin-top: 48px;
        }

        .feature-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 28px;
          transition: border-color 0.2s, transform 0.2s;
        }

        .feature-card:hover {
          border-color: var(--border-hover);
          transform: translateY(-2px);
        }

        .feature-icon {
          width: 40px; height: 40px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
          margin-bottom: 16px;
        }

        .feature-card h3 {
          font-family: 'Syne', sans-serif;
          font-size: 17px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 8px;
        }

        .feature-card p {
          font-size: 14px;
          color: var(--muted);
          line-height: 1.6;
          font-weight: 300;
        }

        /* ── Waitlist ── */
        .waitlist-section {
          padding: 80px 24px 120px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .waitlist-card {
          width: 100%;
          max-width: 700px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 0 100px rgba(56,189,248,0.05);
        }

        .waitlist-top {
          padding: 40px 40px 32px;
          text-align: center;
          border-bottom: 1px solid var(--border);
          background: rgba(56,189,248,0.02);
        }

        .waitlist-top p {
          font-size: 15px;
          color: var(--muted);
          font-weight: 300;
          margin-top: 10px;
          line-height: 1.6;
        }

        .form-wrap {
          background: #ffffff;
          width: 100%;
        }

        .form-wrap iframe {
          display: block;
          width: 100%;
          border: none;
          min-height: 560px;
        }

        /* ── Footer ── */
        footer {
          border-top: 1px solid var(--border);
          padding: 32px 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          z-index: 1;
          flex-wrap: wrap;
          gap: 16px;
        }

        .footer-logo {
          font-family: 'Syne', sans-serif;
          font-size: 16px;
          font-weight: 800;
          color: var(--text);
        }

        .footer-logo span { color: var(--accent); }

        .footer-note {
          font-size: 12px;
          color: var(--muted);
        }

        @media (max-width: 640px) {
          nav { padding: 0 20px; }
          .hero h1 { letter-spacing: -1px; }
          .stat-divider { display: none; }
          footer { flex-direction: column; text-align: center; }
        }
      `}</style>

      {/* ── Navbar ── */}
      <nav>
        <div className="nav-logo">Nexy<span>ru</span></div>
        <button className="nav-btn" onClick={scrollToWaitlist}>Join Waitlist</button>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        {/* Orbs */}
        <div className="orb" style={{ width: 600, height: 600, top: -200, left: "50%", transform: "translateX(-50%)", background: "rgba(56,189,248,0.06)" }} />
        <div className="orb" style={{ width: 400, height: 400, bottom: 0, right: -100, background: "rgba(168,85,247,0.05)" }} />

        <div className="hero-badge">
          <div className="badge-dot" />
          Now in private beta — limited spots
        </div>

        <h1>
          Automate Your Trading.<br /><em>Scale Without Limits.</em>
        </h1>

        <p>Build your own strategies, execute trades automatically, and manage multiple accounts — all from one platform.</p>

        <div className="hero-cta">
          <button className="btn-primary" onClick={scrollToWaitlist}>
            Join Early Access →
          </button>
          <button className="btn-secondary" onClick={() => document.getElementById("chart-section")?.scrollIntoView({ behavior: "smooth" })}>
            See How It Works
          </button>
        </div>

        <div className="hero-stats">
          <div className="stat">
            <div className="stat-label">Built for multi-account trading</div>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <div className="stat-label">Custom strategy automation</div>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <div className="stat-label">Full control over execution</div>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <div className="stat-label">No manual trading required</div>
          </div>
        </div>
      </section>

      {/* ── Chart Section ── */}
      <section className="chart-section" id="chart-section">
        <div className="section-label">Live Demo</div>
        <h2 className="section-title">Signals That Don't Miss</h2>
        <p className="section-sub">Watch our AI identify high-probability setups in real time — entry, exit, and close, all managed automatically.</p>

        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-pair">
              <span className="pair-name">DEMO / USD</span>
              <span className="live-badge"><span className="live-dot" />LIVE</span>
            </div>
            <div className="legend-row">
              <div className="leg"><div className="leg-dot" style={{ background: "#22c55e" }} />BUY</div>
              <div className="leg"><div className="leg-dot" style={{ background: "#ef4444" }} />SELL</div>
              <div className="leg"><div className="leg-dot" style={{ background: "#a855f7" }} />CLOSE</div>
            </div>
          </div>
          <Chart />
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ position: "relative", zIndex: 1 }}>
        <div className="features-section">
          <div style={{ textAlign: "center" }}>
            <div className="section-label">Why Nexyru</div>
            <h2 className="section-title">Automate Your Edge.</h2>
            <p className="section-sub">Build, customize, and deploy trading strategies across multiple accounts — all in one place.</p>
          </div>
          <div className="features-grid">
            {[
              { icon: "⚡", bg: "rgba(56,189,248,0.1)", title: "Multi-Account Copy Trading", desc: "Execute the same strategy across multiple accounts instantly. Scale your trades without repeating work." },
              { icon: "🎯", bg: "rgba(34,197,94,0.1)", title: "Fully Automated Execution", desc: "Every buy and sell is handled automatically based on your rules. No manual entries, no missed trades." },
              { icon: "🛡️", bg: "rgba(168,85,247,0.1)", title: "Strategy Builder", desc: "Create your own trading logic with a flexible builder. Define exactly how your system behaves." },
              { icon: "📊", bg: "rgba(245,158,11,0.1)", title: "Complete Customization", desc: "Adjust entries, exits, risk, and timing to fit your strategy. You stay in full control." },
              { icon: "🔔", bg: "rgba(239,68,68,0.1)", title: "Real-Time Trade Sync", desc: "Trades execute across all connected accounts at the same time with zero delay." },
              { icon: "🔗", bg: "rgba(56,189,248,0.1)", title: "Built for Serious Traders", desc: "Designed for traders who want consistency, automation, and scalability — not guesswork." },
            ].map((f, i) => (
              <div className="feature-card" key={i}>
                <div className="feature-icon" style={{ background: f.bg }}>{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Waitlist ── */}
      <section className="waitlist-section" id="waitlist">
        <div className="section-label">Early Access</div>
        <h2 className="section-title" style={{ marginBottom: 12 }}>Get Early Access</h2>
        <p className="section-sub">Join the waitlist and be first to experience Nexyru when we open beta doors.</p>

        <div className="waitlist-card">
          <div className="waitlist-top">
            <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: "var(--text)" }}>
              Reserve Your Spot
            </h3>
            <p>Limited beta seats available. No credit card required.</p>
          </div>
          <div className="form-wrap">
            <iframe
              src="https://docs.google.com/forms/d/e/1FAIpQLSed3eET6aSFb21J3kneA7piDCgJNlTAvi81EoA5f7LCsOxtMQ/viewform?usp=dialog/viewform?embedded=true"
              title="Nexyru Early Access Waitlist"
              frameBorder="0"
              marginHeight={0}
              marginWidth={0}
            >
              Loading…
            </iframe>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer>
        <div className="footer-logo">Nexy<span>ru</span></div>
        <div className="footer-note">© 2025 Nexyru. Visual demo only — not financial advice.</div>
      </footer>
    </>
  );
}