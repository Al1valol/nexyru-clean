"use client";
import { useState, useEffect, useRef, useCallback } from "react";

interface Strategy { id:string; name:string; monthly_price:number; status:string; user_id:string; }

async function fetchFollowerCount(strategyId: string): Promise<number> {
  try {
    const res = await fetch(`/api/follow?strategy_id=${strategyId}`);
    const data = await res.json();
    return data.count ?? 0;
  } catch { return 0; }
}

function AnimatedNumber({ value, prefix="", suffix="", decimals=0 }: { value:number; prefix?:string; suffix?:string; decimals?:number }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = Date.now(), dur = 900;
    const tick = () => {
      const p = Math.min((Date.now()-start)/dur, 1);
      setDisplay((1-Math.pow(1-p,3))*value);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);
  return <span>{prefix}{decimals>0?display.toFixed(decimals):Math.round(display).toLocaleString()}{suffix}</span>;
}

function StatCard({ label, value, sub, accent, icon, loading }: { label:string; value:React.ReactNode; sub:string; accent:string; icon:string; loading?:boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{ flex:1, minWidth:180, background:hov?"#0f1623":"#0b1120", border:`1px solid ${hov?accent+"55":"#1a2540"}`, borderRadius:20, padding:"22px 24px", transition:"all 0.22s", transform:hov?"translateY(-3px)":"none", boxShadow:hov?`0 12px 40px ${accent}18`:"0 2px 12px rgba(0,0,0,0.3)", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:16, right:18, fontSize:22, opacity:0.15 }}>{icon}</div>
      <div style={{ fontSize:10, fontWeight:700, color:"#4a5a7a", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10 }}>{label}</div>
      <div style={{ fontSize:30, fontWeight:900, color:loading?"#1e2f4a":"#f0f4ff", fontFamily:"monospace", lineHeight:1, marginBottom:8 }}>{loading?"—":value}</div>
      <div style={{ fontSize:11, color:loading?"#1e2f4a":accent, fontWeight:600 }}>{loading?"Loading…":sub}</div>
    </div>
  );
}

function PricingModal({ strategy, onClose, onSave }: { strategy:Strategy; onClose:()=>void; onSave:(id:string,price:number)=>Promise<void> }) {
  const [price, setPrice] = useState(String(strategy.monthly_price??0));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const handleSave = async () => {
    setSaving(true);
    await onSave(strategy.id, parseFloat(price)||0);
    setSaved(true);
    setTimeout(()=>{ setSaved(false); onClose(); }, 800);
    setSaving(false);
  };
  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(6px)" }}/>
      <div style={{ position:"relative", zIndex:10, background:"#0d1628", border:"1px solid #1e2f4a", borderRadius:20, padding:"28px", width:"100%", maxWidth:380, boxShadow:"0 30px 80px rgba(0,0,0,0.8)" }}>
        <div style={{ fontSize:15, fontWeight:800, color:"#f0f4ff", marginBottom:6 }}>Set Price — {strategy.name}</div>
        <div style={{ fontSize:11, color:"#4a5a7a", marginBottom:20 }}>Changes apply to new subscribers.</div>
        <div style={{ display:"flex", alignItems:"center", background:"#111d30", border:"1px solid #1e2f4a", borderRadius:10, overflow:"hidden", marginBottom:20 }}>
          <span style={{ padding:"12px 14px", color:"#4a5a7a", fontSize:18, fontWeight:700 }}>$</span>
          <input value={price} onChange={e=>setPrice(e.target.value)} type="number" min="0" placeholder="0 = free" style={{ flex:1, background:"transparent", border:"none", color:"#f0f4ff", fontSize:20, fontWeight:700, padding:"12px 0", outline:"none", fontFamily:"monospace" }}/>
          <span style={{ padding:"12px 14px", color:"#4a5a7a", fontSize:12 }}>/mo</span>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:"10px", borderRadius:10, border:"1px solid #1e2f4a", background:"transparent", color:"#4a5a7a", fontSize:13, fontWeight:600, cursor:"pointer" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex:2, padding:"10px", borderRadius:10, border:"none", background:saved?"rgba(34,211,165,0.2)":"linear-gradient(135deg,#0ea5a0,#22d3a5)", color:saved?"#22d3a5":"#000", fontSize:13, fontWeight:800, cursor:saving?"not-allowed":"pointer" }}>
            {saving?"Saving…":saved?"✓ Saved!":"Save Price"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EarningsDashboard() {
  const [strategies,     setStrategies]     = useState<Strategy[]>([]);
  const [followerCounts, setFollowerCounts] = useState<Record<string,number>>({});
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState("");
  const [editingStrat,   setEditingStrat]   = useState<Strategy|null>(null);
  const [username,       setUsername]       = useState("");

  const MILESTONES = [10,50,100,500,1000];

  const load = useCallback(async (user:string) => {
    if (!user) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [btRes, liveRes, verRes] = await Promise.all([
        fetch("/api/leaderboard?status=backtested"),
        fetch("/api/leaderboard?status=live"),
        fetch("/api/leaderboard?status=verified"),
      ]);
      const [bt, live, ver] = await Promise.all([btRes.json(), liveRes.json(), verRes.json()]);
      const all: Strategy[] = [
        ...(Array.isArray(bt)?bt:[]),
        ...(Array.isArray(live)?live:[]),
        ...(Array.isArray(ver)?ver:[]),
      ].filter((s:any) => s.user_id === user);

      const counts: Record<string,number> = {};
      await Promise.all(all.map(async s => { counts[s.id] = await fetchFollowerCount(s.id); }));
      setStrategies(all);
      setFollowerCounts(counts);
    } catch(e:unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    try {
      const session = JSON.parse(localStorage.getItem("tradedesk_session_v1")??"{}");
      const user = session.username??"";
      setUsername(user);
      load(user);
    } catch { setLoading(false); }
  }, [load]);

  const savePrice = async (strategyId:string, price:number) => {
    await fetch("/api/strategy-price", {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ strategy_id:strategyId, monthly_price:price }),
    });
    setStrategies(prev => prev.map(s => s.id===strategyId ? {...s, monthly_price:price} : s));
    setEditingStrat(null);
  };

  const totalFollowers  = Object.values(followerCounts).reduce((s,n)=>s+n, 0);
  const monthlyRevenue  = strategies.reduce((sum,s)=>sum+(followerCounts[s.id]??0)*(s.monthly_price??0), 0);
  const paidStrats      = strategies.filter(s=>(s.monthly_price??0)>0);
  const maxRevenue      = Math.max(...strategies.map(s=>(followerCounts[s.id]??0)*(s.monthly_price??0)),1);
  const nextMilestone   = MILESTONES.find(m=>m>totalFollowers)??null;
  const prevMilestone   = [...MILESTONES].reverse().find(m=>m<=totalFollowers)??0;
  const milestoneProgress = nextMilestone ? Math.min(100,((totalFollowers-prevMilestone)/(nextMilestone-prevMilestone))*100) : 100;

  const checks = [
    { label:"Strategy Published",   done: strategies.length > 0 },
    { label:"Has Followers",        done: totalFollowers > 0 },
    { label:"Has Paid Strategy",    done: paidStrats.length > 0 },
    { label:"Earning Revenue",      done: monthlyRevenue > 0 },
  ];
  const doneCount = checks.filter(c=>c.done).length;

  return (
    <div style={{ minHeight:"100vh", background:"#060d1a", color:"#c8d8f0", fontFamily:"system-ui,sans-serif", padding:"32px 28px", maxWidth:1200, margin:"0 auto" }}>
      {editingStrat && <PricingModal strategy={editingStrat} onClose={()=>setEditingStrat(null)} onSave={savePrice}/>}

      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div>
            <h1 style={{ fontSize:28, fontWeight:900, color:"#f0f4ff", margin:0, letterSpacing:"-0.02em" }}>Earnings Dashboard</h1>
            <p style={{ fontSize:13, color:"#3a4a6a", margin:"6px 0 0" }}>Live data · {username?`@${username}`:"—"} · Real follower counts from Supabase</p>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>load(username)} style={{ padding:"7px 14px", borderRadius:9, border:"1px solid #1a2540", background:"#0b1120", color:"#4a5a7a", fontSize:12, fontWeight:600, cursor:"pointer" }}>🔄 Refresh</button>
            <a href="/dashboard" style={{ padding:"7px 16px", borderRadius:10, border:"1px solid #1a2540", background:"#0b1120", color:"#4a5a7a", fontSize:12, fontWeight:600, textDecoration:"none" }}>← Dashboard</a>
          </div>
        </div>
      </div>

      {error && <div style={{ padding:"14px 18px", borderRadius:12, background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", color:"#f87171", fontSize:12, marginBottom:20 }}>⚠ {error}</div>}

      {/* Empty state */}
      {!loading && strategies.length===0 && (
        <div style={{ padding:"24px", borderRadius:16, background:"linear-gradient(135deg,#0d1628,#0f1e30)", border:"1px solid rgba(56,189,248,0.2)", marginBottom:24, display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
          <div style={{ fontSize:32 }}>🚀</div>
          <div style={{ flex:1, minWidth:200 }}>
            <div style={{ fontSize:14, fontWeight:800, color:"#f0f4ff", marginBottom:4 }}>No published strategies yet</div>
            <div style={{ fontSize:12, color:"#3a6a8a", lineHeight:1.6 }}>Publish a strategy from the Strategy Lab to start earning from subscribers.</div>
          </div>
          <a href="/dashboard?tab=stratlab" style={{ padding:"10px 20px", borderRadius:10, background:"linear-gradient(135deg,#0369a1,#38bdf8)", color:"#fff", fontSize:12, fontWeight:700, textDecoration:"none" }}>Go to Strategy Lab →</a>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:20 }}>
        <StatCard loading={loading} label="Monthly Revenue" icon="💵" accent="#22d3a5"
          value={<AnimatedNumber value={monthlyRevenue} prefix="$"/>}
          sub={monthlyRevenue>0?`$${(monthlyRevenue*12).toLocaleString()} projected/year`:"Set prices on strategies to earn"}/>
        <StatCard loading={loading} label="Total Followers" icon="👥" accent="#38bdf8"
          value={<AnimatedNumber value={totalFollowers}/>}
          sub={`across ${strategies.length} strateg${strategies.length!==1?"ies":"y"}`}/>
        <StatCard loading={loading} label="Paid Strategies" icon="💰" accent="#fbbf24"
          value={<AnimatedNumber value={paidStrats.length}/>}
          sub={paidStrats.length>0?`avg $${(paidStrats.reduce((s,p)=>s+(p.monthly_price??0),0)/paidStrats.length).toFixed(0)}/mo`:"No paid strategies yet"}/>
        <StatCard loading={loading} label="Status" icon="🏆" accent="#a78bfa"
          value={monthlyRevenue>0?"Earning":"Inactive"}
          sub={monthlyRevenue>0?"Revenue flowing in":"Needs subscribers"}/>
      </div>

      {/* Strategy table */}
      {!loading && strategies.length>0 && (
        <div style={{ background:"#0b1120", border:"1px solid #1a2540", borderRadius:20, overflow:"hidden", marginBottom:16 }}>
          <div style={{ padding:"20px 24px", borderBottom:"1px solid #1a2540", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ fontSize:15, fontWeight:800, color:"#f0f4ff" }}>Your Strategies</div>
            {monthlyRevenue>0 && <div style={{ fontSize:18, fontWeight:900, color:"#22d3a5", fontFamily:"monospace" }}>${monthlyRevenue.toFixed(0)}/mo total</div>}
          </div>
          {strategies.map(s => {
            const fCount  = followerCounts[s.id]??0;
            const revenue = fCount*(s.monthly_price??0);
            const bar     = maxRevenue>0?(revenue/maxRevenue)*100:0;
            return (
              <div key={s.id} style={{ padding:"12px 20px", borderBottom:"1px solid #0d1828", display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:"#e2e8f0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</span>
                    <span style={{ fontSize:9, padding:"1px 7px", borderRadius:10, background:"rgba(129,140,248,0.1)", color:"#818cf8", border:"1px solid rgba(129,140,248,0.2)", flexShrink:0 }}>{s.status}</span>
                  </div>
                  <div style={{ height:3, borderRadius:2, background:"#1a2035", overflow:"hidden" }}>
                    <div style={{ width:`${bar}%`, height:"100%", background:"linear-gradient(90deg,#0369a1,#22d3a5)", transition:"width 0.6s" }}/>
                  </div>
                </div>
                <div style={{ display:"flex", gap:16, alignItems:"center", flexShrink:0 }}>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:9, color:"#334155", marginBottom:2 }}>Followers</div>
                    <div style={{ fontSize:14, fontWeight:700, color:"#38bdf8", fontFamily:"monospace" }}>{fCount}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:9, color:"#334155", marginBottom:2 }}>Price</div>
                    <div style={{ fontSize:14, fontWeight:700, color:(s.monthly_price??0)>0?"#fbbf24":"#334155", fontFamily:"monospace" }}>
                      {(s.monthly_price??0)>0?`$${s.monthly_price}/mo`:"Free"}
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:9, color:"#334155", marginBottom:2 }}>Revenue</div>
                    <div style={{ fontSize:14, fontWeight:700, color:revenue>0?"#22d3a5":"#334155", fontFamily:"monospace" }}>
                      {revenue>0?`$${revenue.toFixed(0)}/mo`:"—"}
                    </div>
                  </div>
                  <button onClick={()=>setEditingStrat(s)} style={{ padding:"5px 12px", borderRadius:8, border:"1px solid rgba(34,211,165,0.3)", background:"rgba(34,211,165,0.06)", color:"#22d3a5", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                    ✏️ Price
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Milestone */}
      {!loading && (
        <div style={{ background:"#0b1120", border:"1px solid #1a2540", borderRadius:20, padding:"20px 24px", marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontSize:15, fontWeight:800, color:"#f0f4ff" }}>🎯 Follower Milestone</div>
            <div style={{ fontSize:11, color:"#3a4a6a" }}>
              <span style={{ color:"#38bdf8", fontWeight:700 }}>{totalFollowers}</span>
              {nextMilestone?` / ${nextMilestone} — ${nextMilestone-totalFollowers} to go`:" — all milestones reached!"}
            </div>
          </div>
          <div style={{ height:6, borderRadius:3, background:"#111d30", marginBottom:10, overflow:"hidden" }}>
            <div style={{ width:`${milestoneProgress}%`, height:"100%", background:"linear-gradient(90deg,#818cf8,#38bdf8)", borderRadius:3, transition:"width 0.8s" }}/>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            {MILESTONES.map(m=>(
              <span key={m} style={{ fontSize:10, color:totalFollowers>=m?"#38bdf8":"#1e2f4a", fontWeight:totalFollowers>=m?700:400 }}>
                {m>=1000?`${m/1000}k`:m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Status checklist */}
      <div style={{ background:"#0b1120", border:"1px solid #1a2540", borderRadius:20, padding:"20px 24px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:10 }}>
          <div style={{ fontSize:15, fontWeight:800, color:"#f0f4ff" }}>Monetization Status</div>
          <span style={{ fontSize:11, fontWeight:800, padding:"5px 14px", borderRadius:20,
            background:doneCount===checks.length?"rgba(34,211,165,0.12)":"rgba(251,146,60,0.1)",
            border:`1px solid ${doneCount===checks.length?"rgba(34,211,165,0.35)":"rgba(251,146,60,0.3)"}`,
            color:doneCount===checks.length?"#22d3a5":"#fb923c",
          }}>{doneCount}/{checks.length} complete</span>
        </div>
        <div style={{ height:4, borderRadius:2, background:"#111d30", marginBottom:14, overflow:"hidden" }}>
          <div style={{ width:`${(doneCount/checks.length)*100}%`, height:"100%", background:"linear-gradient(90deg,#22d3a5,#38bdf8)", borderRadius:2 }}/>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:8 }}>
          {checks.map((c,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:20, height:20, borderRadius:10, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800,
                background:c.done?"rgba(34,211,165,0.15)":"#111d30",
                border:`1px solid ${c.done?"#22d3a5":"#1e2f4a"}`,
                color:c.done?"#22d3a5":"#2e3f5a",
              }}>{c.done?"✓":"○"}</div>
              <span style={{ fontSize:12, color:c.done?"#c8d8f0":"#3a4a6a", fontWeight:c.done?600:400 }}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop:24, textAlign:"center", fontSize:10, color:"#1e2f4a" }}>
        Live data from Supabase · Click 🔄 Refresh to update
      </div>
    </div>
  );
}
